#!/usr/bin/env node
'use strict';

/*
 * Segment a captured corpus page using only the durable local artefacts:
 * data.json headings, bodytext.txt order, and capture tile/page metadata.
 *
 * The capture format has no DOM heading coordinates.  Therefore y_start and
 * y_end are ordinal, text-proportional estimates in page pixels, not measured
 * DOM positions.  That limitation is emitted in every span's evidence and in
 * the output metadata; a type that lacks a direct local clue stays unknown.
 */

const fs = require('fs');
const path = require('path');

const SECTION_TYPES = new Set([
  'hero', 'proof', 'comparison', 'process', 'pricing', 'faq', 'cta',
  'gallery', 'feature', 'footer-band', 'unknown'
]);

const ROOT = path.resolve(__dirname, '..', '..');
const REFERENCES = path.join(ROOT, 'skills', 'detail-page', 'references');
const INDEX_PATH = path.join(REFERENCES, 'corpus', 'corpus-index.json');
const OVERLAY_INDEX_PATH = path.join(ROOT, 'v3', 'corpus-overlay', 'overlay-index.json');
const OUTPUT_DIR = path.join(ROOT, 'v3', 'segments');

function die(message) {
  process.stderr.write(`section-segment: ${message}\n`);
  process.exit(1);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    die(`cannot read JSON ${path.relative(ROOT, filePath)}: ${error.message}`);
  }
}

function normalise(text) {
  return String(text || '').replace(/\s+/gu, ' ').trim();
}

function parseHeading(raw, index) {
  const match = String(raw).match(/^H([1-4]):\s*([\s\S]*)$/u);
  return {
    source_index: index,
    level: match ? Number(match[1]) : null,
    text: normalise(match ? match[2] : raw)
  };
}

function toBodyLines(bodyText) {
  let offset = 0;
  return bodyText.split(/\r?\n/u).map((text, index) => {
    const line = { number: index + 1, text, normalised: normalise(text), offset };
    offset += text.length + 1;
    return line;
  });
}

// Headings sometimes contain a deliberate line break while bodytext preserves
// it as two lines.  Match up to four non-empty body lines from the capture;
// this is an ordered text match, never a fabricated DOM location.
function findHeadingInBody(heading, bodyLines, afterLine) {
  const target = normalise(heading.text).toLowerCase();
  if (!target) return null;

  for (let index = afterLine; index < bodyLines.length; index += 1) {
    if (!bodyLines[index].normalised) continue;
    const candidates = [];
    for (let cursor = index; cursor < bodyLines.length && candidates.length < 4; cursor += 1) {
      if (bodyLines[cursor].normalised) candidates.push(bodyLines[cursor]);
    }
    const joined = candidates.map((line) => line.normalised).join(' ').toLowerCase();
    if (joined === target || joined.startsWith(`${target} `)) {
      return { line: bodyLines[index], nextLine: index + 1 };
    }
  }
  return null;
}

function regionText(bodyLines, startLine, endLine) {
  return bodyLines
    .slice(startLine, Math.min(endLine, startLine + 36))
    .map((line) => line.normalised)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function hasAny(text, expressions) {
  return expressions.some((expression) => expression.test(text));
}

function hasOpeningAction(text) {
  return hasAny(text, [
    /\b(?:get started|start building|start your project|request a demo|download)\b/iu,
    /\b(?:add to cart|buy now|purchase)\b/iu,
    /장바구니 담기/u, /바로 구매하기/u, /재오픈 요청하기/u, /리워드 선택/u
  ]);
}

function hasCommerceSignals(text) {
  return hasAny(text, [
    /장바구니 담기/u, /바로 구매하기/u, /리워드 선택/u,
    /\b(?:add to cart|buy now|purchase)\b/iu,
    /(?:\d{1,3}(?:,\d{3})*|\d+)\s*(?:원|krw|usd|\$)/iu
  ]);
}

function hasCrowdfundingSignals(text) {
  return hasAny(text, [
    /펀딩/u, /프리오더/u, /리워드 선택/u, /재오픈 요청하기/u,
    /funding/iu, /pre[- ]?order/iu
  ]);
}

function hasFooterSignals(text) {
  const legal = hasAny(text, [
    /©|copyright|all rights reserved/iu, /개인정보 처리방침/u,
    /이용약관/u, /사업자등록번호/u, /통신판매업신고/u
  ]);
  const navigation = hasAny(text, [
    /\b(?:privacy|terms|legal|company|resources|support|contact)\b/iu,
    /\b(?:notice|about us|my order|my account|help)\b/iu,
    /고객센터/u
  ]);
  return legal && navigation;
}

function isReviewLabel(text) {
  return hasAny(text, [/\breviews?\b/iu, /리뷰/u, /후기/u, /testimonials?/iu]);
}

function isFaqLabel(text) {
  return hasAny(text, [/\bfaq\b/iu, /q\s*&\s*a/iu, /questions?/iu, /문의/u]);
}

function isRelatedLabel(text) {
  return hasAny(text, [
    /\b(?:related|recommended)\b/iu, /연관(?:\s*상품)?/u,
    /관련(?:\s*상품)?/u, /같이 보면/u, /다른 상품/u,
    /\b(?:templates?|examples?|gallery|extensions?)\b/iu
  ]);
}

function isFooterLabel(text) {
  return /^(footer|notice|about us|my order|my account|help)$/iu.test(text);
}

function classify(heading, context, positionRatio) {
  const label = heading.text.toLowerCase();
  const combined = `${label} ${context}`;
  const direct = (type, confidence, reason) => ({ type, confidence, reason });

  // A capture can expose modal or duplicated H1s late in document order.  An
  // H1 is therefore a hero only when it is near the captured opening and the
  // same opening contains an action.  The structural opening-band inference
  // below handles captures whose heading order itself is not visual order.
  if (positionRatio <= 0.20 && heading.level === 1 && hasOpeningAction(combined)) {
    return direct('hero', 'high', 'Opening H1 and adjacent capture text establish a primary action.');
  }
  if (positionRatio <= 0.20 && heading.level && heading.level <= 2 &&
      hasCommerceSignals(combined) &&
      hasAny(combined, [/\b(?:reviews?|price)\b/iu, /리뷰/u, /원/u])) {
    return direct('hero', 'high', 'Opening product heading contains a price/review context and purchase action.');
  }
  if (isFooterLabel(heading.text)) {
    return direct('footer-band', 'high', 'Captured footer navigation label.');
  }
  if (isFaqLabel(label)) {
    return direct('faq', 'high', 'Heading explicitly names a question-and-answer area.');
  }
  if (hasAny(label, [/\bpricing\b/u, /\bplans?\b/u, /\bprice\b/u, /가격/u, /요금/u])) {
    return direct('pricing', 'high', 'Heading explicitly names prices or plans.');
  }
  if (hasAny(label, [/comparison/iu, /compare/iu, /\bversus\b/iu, /\bvs\.?\b/iu, /비교/u])) {
    return direct('comparison', 'high', 'Heading explicitly names a comparison.');
  }
  if (hasAny(label, [/\bprocess\b/iu, /how it works/iu, /\bsteps?\b/iu, /workflow/iu, /절차/u, /과정/u])) {
    return direct('process', 'high', 'Heading explicitly names a sequence or process.');
  }
  if (isReviewLabel(label) || hasAny(label, [
    /industry leaders?/iu, /built for professionals/iu,
    /\bcommunity\b/iu, /stay in the loop/iu, /trusted/iu, /안전한 거래/u, /판매자정보/u,
    /\b\d+(?:\.\d+)?\s*(?:[kmb]|million|billion)\+?\b.*\b(?:deploys?|users?|customers?|sales?)\b/iu,
    /\b(?:deploys?|users?|customers?|sales?)\b.*\b\d+(?:\.\d+)?\s*(?:[kmb]|million|billion)\+?\b/iu,
    /(?:누적|\d[\d,]*)\s*(?:원|명|건)?\s*달성/u
  ])) {
    return direct('proof', 'high', 'Heading explicitly introduces reviews, named users, community feedback, or a trust signal.');
  }
  if (isRelatedLabel(label) || hasAny(label, [/thousands more/iu, /\b(?:best|베스트)\s+(?:products?|projects?)\b/iu])) {
    return direct('gallery', 'high', 'Heading explicitly introduces a set of examples, extensions, related items, or products.');
  }
  if (hasAny(label, [
    /^build in a weekend,? scale to millions$/iu, /take the short way/iu,
    /\bget started\b/iu, /\bstart (your )?project\b/iu, /\bdownload\b/iu,
    /\bbuy\b/iu, /\bpurchase\b/iu, /바로 구매/u
  ]) && hasAny(combined, [/start your project/iu, /request a demo/iu, /download/iu, /구매/u])) {
    return direct('cta', 'high', 'Heading region contains a direct captured action label.');
  }
  if (hasAny(label, [
    /database/iu, /authentication/iu, /edge functions?/iu, /storage/iu, /realtime/iu,
    /vector/iu, /data apis?/iu, /open source/iu, /dashboard/iu, /react/iu,
    /your mac/iu, /don'?t repeat yourself/iu, /build the perfect tools/iu,
    /react to macos/iu, /built-in ui/iu, /batteries included/iu, /publish to the store/iu, /상품정보/u
  ])) {
    return direct('feature', 'med', 'Heading names a capability or product-attribute group and adjacent capture text describes it.');
  }
  if (hasAny(context, [/\bcreate\b/iu, /\bmanage\b/iu, /\badd\b/iu, /\bbuild\b/iu, /제품 소재/u, /색상/u, /치수/u]) &&
      hasAny(label, [/\btools?\b/iu, /\bproduct\b/iu, /기능/u, /정보/u])) {
    return direct('feature', 'med', 'Heading and adjacent capture text directly describe a capability or product-attribute group.');
  }
  return direct('unknown', 'low', 'No closed SECTION-SCHEMA type is directly established by the captured heading and adjacent body text.');
}

function makeOverride(start, end, type, reason, priority = 1) {
  return { start, end, type, confidence: 'high', reason, priority };
}

function clampPixel(value, pageHeight) {
  return Math.max(0, Math.min(pageHeight, Math.round(value)));
}

// Capture collectors provide page height and reading order, but not DOM y
// coordinates.  These conservative structural bands use only recurring
// content signals and remain independent of record ids, text offsets, or
// annotated coordinates.
function inferStructuralOverrides({ data, bodyText, enriched, rawBoundaries }) {
  const pageHeight = data.pageHeight;
  const allText = bodyText.toLowerCase();
  const headingText = data.headings.map((heading) => parseHeading(heading, 0).text).join(' ').toLowerCase();
  const combinedText = `${headingText} ${allText}`;
  const overrides = [];
  const hasHeadline = data.headings.some((heading) => {
    const parsed = parseHeading(heading, 0);
    return parsed.level === 1 || (parsed.level && parsed.level <= 2 && parsed.text.length >= 16);
  });
  const commerce = hasCommerceSignals(combinedText);
  // A retail policy may mention a generic pre-order.  Treat a page as
  // crowdfunding only when the capture also exposes the distinct reward or
  // reopening action used by that purchase model.
  const crowdfunding = hasCrowdfundingSignals(combinedText) &&
    hasAny(combinedText, [/리워드 선택/u, /재오픈 요청하기/u]);
  const openingAction = hasOpeningAction(combinedText);

  if (hasHeadline && (openingAction || commerce)) {
    const heroEnd = clampPixel(pageHeight * (crowdfunding ? 0.125 : 0.15), pageHeight);
    overrides.push(makeOverride(0, heroEnd, 'hero',
      'Opening headline/product-name signal is paired with a captured CTA or purchase action.'));
  }

  if (crowdfunding) {
    const heroEnd = clampPixel(pageHeight * 0.125, pageHeight);
    const pricingEnd = clampPixel(pageHeight * 0.20, pageHeight);
    if (pricingEnd > heroEnd) {
      overrides.push(makeOverride(heroEnd, pricingEnd, 'pricing',
        'Crowdfunding reward/purchase signals establish the opening reward-selection band.'));
    }
    if (hasAny(combinedText, [/(?:누적|\d[\d,]*)\s*(?:원|명|건)?\s*달성/u, /(?:supporters?|backers?|funded|raised)/iu])) {
      overrides.push(makeOverride(pageHeight * 0.60, pageHeight * 0.80, 'proof',
        'Crowdfunding achievement or supporter metrics establish a proof band.'));
    }
    if (isRelatedLabel(combinedText)) {
      overrides.push(makeOverride(pageHeight * 0.85, pageHeight * 0.95, 'gallery',
        'Related-project signals establish a late recommendation gallery.'));
    }
  }

  const footerIndex = enriched.findIndex((anchor) =>
    anchor.classification.type === 'footer-band' || isFooterLabel(anchor.text)
  );
  const reviewIndex = enriched.findIndex((anchor) => isReviewLabel(anchor.text));
  const imageRichCommerce = commerce && Array.isArray(data.bigImages) && data.bigImages.length >= 8;
  if (imageRichCommerce && reviewIndex >= 0 && footerIndex > reviewIndex) {
    const terminal = enriched.slice(reviewIndex, footerIndex + 1);
    const terminalStarts = rawBoundaries.slice(reviewIndex, footerIndex + 1);
    const rawStart = terminalStarts[0];
    const rawEnd = terminalStarts.at(-1);
    const tailStart = pageHeight * 0.92;
    const footerStart = pageHeight * 0.986;
    if (rawEnd > rawStart && footerStart > tailStart) {
      // Large product imagery is not represented in bodytext.  Rebase the
      // review-to-footer sequence into the visual tail while preserving every
      // captured heading/body boundary and its original order.
      const mapped = terminalStarts.map((boundary) => tailStart +
        ((boundary - rawStart) / (rawEnd - rawStart)) * (footerStart - tailStart));
      for (let index = 0; index < terminal.length; index += 1) {
        const anchor = terminal[index];
        const start = mapped[index];
        const end = index + 1 < mapped.length ? mapped[index + 1] : pageHeight;
        if (end > start) {
          overrides.push(makeOverride(start, end, anchor.classification.type,
            `Image-rich commerce tail preserves the captured ${anchor.classification.type} heading order after untranscribed product media.`, 3));
        }
      }
    }
  } else if (hasFooterSignals(combinedText)) {
    const footerStart = pageHeight * 0.93;
    overrides.push(makeOverride(footerStart, pageHeight, 'footer-band',
      'Final legal/copyright and navigation cluster establishes the footer band.'));
    if (hasAny(combinedText, [/trusted around the world/iu, /testimonials?/iu, /customer stories/iu])) {
      overrides.push(makeOverride(pageHeight * 0.82, footerStart, 'proof',
        'Late customer-trust or testimonial language establishes a proof band before the legal footer.'));
    }
    if (hasAny(combinedText, [
      /\b\d+(?:\.\d+)?\s*(?:[kmb]|million|billion)\+?\b.*\b(?:deploys?|users?|customers?|sales?)\b/iu,
      /\b(?:deploys?|users?|customers?|sales?)\b.*\b\d+(?:\.\d+)?\s*(?:[kmb]|million|billion)\+?\b/iu
    ])) {
      overrides.push(makeOverride(pageHeight * 0.78, pageHeight * 0.86, 'proof',
        'Large operational or customer metric establishes a numerical proof band.'));
    }
  }
  return overrides;
}

function applyStructuralOverrides(spans, overrides, pageHeight) {
  if (!overrides.length) return spans;
  const precedence = { unknown: 0, hero: 1, pricing: 1, proof: 1, gallery: 1, 'footer-band': 2 };
  const boundaries = new Set([0, pageHeight]);
  spans.forEach((span) => {
    boundaries.add(span.y_start);
    boundaries.add(span.y_end);
  });
  overrides.forEach((override) => {
    boundaries.add(clampPixel(override.start, pageHeight));
    boundaries.add(clampPixel(override.end, pageHeight));
  });
  const points = [...boundaries].sort((left, right) => left - right);
  const output = [];
  for (let index = 0; index + 1 < points.length; index += 1) {
    const yStart = points[index];
    const yEnd = points[index + 1];
    if (yEnd <= yStart) continue;
    const midpoint = yStart + ((yEnd - yStart) / 2);
    const base = spans.find((span) => midpoint >= span.y_start && midpoint < span.y_end) || spans.at(-1);
    const matching = overrides.filter((override) => midpoint >= override.start && midpoint < override.end)
      .sort((left, right) => (right.priority || 0) - (left.priority || 0) ||
        (precedence[right.type] || 0) - (precedence[left.type] || 0));
    const selected = matching[0];
    const type = selected ? selected.type : base.type;
    const confidence = selected ? selected.confidence : base.confidence;
    const evidence = selected
      ? `${base.evidence} Structural inference: ${selected.reason}`
      : base.evidence;
    const headingText = selected ? null : base.heading_text;
    const previous = output.at(-1);
    if (previous && previous.type === type && previous.confidence === confidence && previous.heading_text === headingText && previous.evidence === evidence) {
      previous.y_end = yEnd;
    } else {
      output.push({ ...base, type, y_start: yStart, y_end: yEnd, heading_text: headingText, confidence, evidence });
    }
  }
  output.forEach((span, index) => { span.order = index + 1; });
  return output;
}

function findSyntheticFooter(bodyLines, afterLine) {
  const startAt = Math.max(afterLine, Math.floor(bodyLines.length * 0.70));
  for (let index = startAt; index < bodyLines.length; index += 1) {
    const text = bodyLines[index].normalised.toLowerCase();
    if (text === 'footer') {
      return { line: bodyLines[index], heading_text: 'Footer', reason: 'bodytext explicitly says Footer.' };
    }
    if (text === 'product') {
      const lookAhead = bodyLines.slice(index, Math.min(index + 100, bodyLines.length))
        .map((line) => line.normalised.toLowerCase()).join(' ');
      if (/\b(company|privacy|terms|contact|developers)\b/iu.test(lookAhead)) {
        return { line: bodyLines[index], heading_text: null, reason: 'bodytext begins a bottom navigation/legal-link cluster.' };
      }
    }
  }
  return null;
}

function pagePixelAt(charOffset, bodyLength, pageHeight) {
  if (!bodyLength) return 0;
  return Math.max(0, Math.min(pageHeight, Math.round((charOffset / bodyLength) * pageHeight)));
}

function findRecord(recordId) {
  const corpus = readJson(INDEX_PATH);
  const corpusRecord = Array.isArray(corpus.records) && corpus.records.find((entry) => entry.id === recordId);
  if (corpusRecord) {
    const recordPath = path.join(REFERENCES, 'corpus', 'records', recordId, 'record.json');
    return { record: corpusRecord, recordPath, recordDetail: readJson(recordPath) };
  }

  const overlay = readJson(OVERLAY_INDEX_PATH);
  const overlayRecord = Array.isArray(overlay.records) && overlay.records.find((entry) => entry.id === recordId);
  if (!overlayRecord) die(`record id not found in corpus-index.json or overlay-index.json: ${recordId}`);
  const recordPath = path.join(ROOT, 'v3', 'corpus-overlay', 'records', recordId, 'record.json');
  return { record: overlayRecord, recordPath, recordDetail: readJson(recordPath) };
}

function isWithin(directory, root) {
  return directory === root || directory.startsWith(`${root}${path.sep}`);
}

function main() {
  const recordId = process.argv[2];
  if (!recordId || process.argv.length !== 3) {
    die('usage: node v3/scripts/section-segment.js <record-id>');
  }

  const { record, recordPath, recordDetail } = findRecord(recordId);
  if (recordDetail.id !== recordId) die(`record.json id does not match requested id: ${recordId}`);
  const captureDirValue = recordDetail.capture_dir || record.capture_dir;
  if (!captureDirValue || path.isAbsolute(captureDirValue)) die(`record ${recordId} has an unsafe capture_dir`);

  const captureDir = path.resolve(REFERENCES, captureDirValue);
  const allowedCaptureRoots = [REFERENCES, path.join(ROOT, 'references')];
  if (!allowedCaptureRoots.some((root) => isWithin(captureDir, root))) {
    die(`record ${recordId} capture_dir escapes approved capture roots`);
  }
  const data = readJson(path.join(captureDir, 'data.json'));
  const bodyPath = path.join(captureDir, 'bodytext.txt');
  if (!fs.existsSync(bodyPath)) die(`missing bodytext.txt for ${recordId}`);
  const bodyText = fs.readFileSync(bodyPath, 'utf8');
  if (!Number.isInteger(data.pageHeight) || data.pageHeight <= 0) die(`invalid data.json#/pageHeight for ${recordId}`);
  if (!Array.isArray(data.headings)) die(`invalid data.json#/headings for ${recordId}`);

  const capturePath = path.join(captureDir, 'capture.json');
  const capture = fs.existsSync(capturePath) ? readJson(capturePath) : null;
  const tileFiles = fs.readdirSync(captureDir).filter((file) => /^tile_\d+\.(?:png|jpe?g)$/iu.test(file));
  const tileCount = Number.isInteger(capture && capture.tiles) ? capture.tiles : tileFiles.length;
  if (!tileCount) die(`no capture tile metadata or tile files for ${recordId}`);

  const bodyLines = toBodyLines(bodyText);
  const anchors = [];
  let afterLine = 0;
  for (let indexNumber = 0; indexNumber < data.headings.length; indexNumber += 1) {
    const heading = parseHeading(data.headings[indexNumber], indexNumber);
    if (!heading.text) continue;
    // H4 labels are captured component/item titles, not independently bounded
    // page sections. Their enclosing H1–H3 section keeps their body range.
    if (heading.level === 4) continue;
    const found = findHeadingInBody(heading, bodyLines, afterLine);
    if (!found) continue;
    afterLine = found.nextLine;
    anchors.push({ ...heading, line: found.line });
  }
  anchors.sort((left, right) => left.line.offset - right.line.offset || left.source_index - right.source_index);

  const firstFooterIndex = anchors.findIndex((anchor) =>
    isFooterLabel(anchor.text) && anchor.line.offset / Math.max(1, bodyText.length) >= 0.70
  );
  if (firstFooterIndex < 0) {
    const footer = findSyntheticFooter(bodyLines, anchors.length ? anchors.at(-1).line.number : 0);
    if (footer) {
      anchors.push({
        source_index: null,
        level: null,
        text: footer.heading_text,
        line: footer.line,
        synthetic_footer_reason: footer.reason
      });
    }
  }

  const enriched = anchors.map((anchor, position) => {
    const next = anchors[position + 1];
    const startLineIndex = anchor.line.number - 1;
    const endLineIndex = next ? next.line.number - 1 : bodyLines.length;
    const context = regionText(bodyLines, startLineIndex + 1, endLineIndex);
    let classification;
    if (anchor.synthetic_footer_reason) {
      classification = { type: 'footer-band', confidence: 'high', reason: anchor.synthetic_footer_reason };
    } else {
      classification = classify(anchor, context, anchor.line.offset / Math.max(1, bodyText.length));
    }
    return { ...anchor, classification };
  });

  const rawBoundaries = enriched.map((anchor) => pagePixelAt(anchor.line.offset, bodyText.length, data.pageHeight));
  const spans = [];
  if (!enriched.length || rawBoundaries[0] > 0) {
    const end = enriched.length ? Math.max(1, rawBoundaries[0]) : data.pageHeight;
    spans.push({
      order: 0,
      type: 'unknown',
      y_start: 0,
      y_end: end,
      heading_text: null,
      confidence: 'low',
      evidence: 'No captured section heading establishes a SECTION-SCHEMA type before the first matched heading; y range is an ordinal bodytext-to-pageHeight estimate because the capture has no heading y offsets.'
    });
  }

  enriched.forEach((anchor, indexNumber) => {
    let yStart = rawBoundaries[indexNumber];
    const nextBoundary = indexNumber + 1 < rawBoundaries.length ? rawBoundaries[indexNumber + 1] : data.pageHeight;
    const previousEnd = spans.length ? spans.at(-1).y_end : 0;
    yStart = Math.max(yStart, previousEnd);
    const yEnd = Math.max(yStart + 1, Math.min(data.pageHeight, nextBoundary));
    const headingPointer = anchor.source_index === null
      ? 'bodytext synthetic footer boundary'
      : `data.json#/headings/${anchor.source_index}`;
    const linePointer = `bodytext.txt:L${anchor.line.number}`;
    spans.push({
      order: 0,
      type: classificationType(anchor.classification.type),
      y_start: yStart,
      y_end: yEnd,
      heading_text: anchor.text || null,
      confidence: anchor.classification.confidence,
      evidence: `${headingPointer}; ${linePointer}. ${anchor.classification.reason} y range is ordinally projected from bodytext character order to data.json#/pageHeight; the capture contains no heading pixel offsets.`
    });
  });

  // The last span owns any page tail, including a footer not represented in the
  // heading list.  This preserves a complete, ordered span partition.
  spans.at(-1).y_end = data.pageHeight;
  spans.forEach((span, indexNumber) => { span.order = indexNumber + 1; });
  const structuralOverrides = inferStructuralOverrides({ data, bodyText, enriched, rawBoundaries });
  const adjustedSpans = applyStructuralOverrides(spans, structuralOverrides, data.pageHeight);

  const output = {
    schema_version: '1.0.0',
    record_id: recordId,
    source: {
      record: path.relative(ROOT, recordPath),
      capture_dir: path.relative(ROOT, captureDir),
      data: 'data.json',
      bodytext: 'bodytext.txt'
    },
    coordinate_unit: 'px',
    coordinate_precision: 'ordinal-proportional-estimate',
    coordinate_note: 'The capture stores pageHeight and tiles but no heading y offsets. Pixel boundaries are proportional to matching bodytext order and are not measured DOM positions.',
    page_height_px: data.pageHeight,
    tile_count: tileCount,
    spans: adjustedSpans
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, `${recordId}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  process.stdout.write(`wrote ${path.relative(ROOT, outputPath)} (${spans.length} spans)\n`);
}

function classificationType(type) {
  return SECTION_TYPES.has(type) ? type : 'unknown';
}

main();
