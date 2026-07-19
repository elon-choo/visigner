#!/usr/bin/env node
'use strict';

// Stage 5 design-loop harness. It deliberately delegates retrieval,
// grounding, conformance, and visual-fidelity work to their owning modules.

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { inject, normalizeDesignDial } = require('./librarian-inject.js');
const { main: runConformance } = require('./conformance-check.js');
const { main: runFidelity } = require('./reproduce-and-score.js');
const {
  PRODUCT_PHOTO_HEADING,
  PRODUCT_PHOTO_MIN_CONFIDENCE,
  PRODUCT_PHOTO_SCHEMA,
  readCaptureTiles,
  readImageDimensions,
  tileMime,
} = require('./derive-recipe-vision.js');

const CONFORMANCE_OVERALL_THRESHOLD = 70;
const CONFORMANCE_PALETTE_THRESHOLD = 60;
const MISS_MESSAGE = 'MISS — no safe corpus match found — this is a database miss, not an empty value; do not invent one.';
const PRODUCT_PHOTO_MISS_MESSAGE = 'MISS — the recipe has no confidently verified product-photo region; do not invent a crop or substitute a description.';
const PRODUCT_PHOTO_SLOT_PREFIX = 'VISIGNER_PRODUCT_PHOTO:';
const OVERWRITE_MESSAGE = (file) => `REFUSING — output already exists: ${file}; skipped without an overwrite option.`;

function noGroundingBlock(note) {
  return [
    '# GROUNDING BLOCK — no safe recipe',
    '',
    MISS_MESSAGE,
    'no exemplar to imitate; build from first principles (no grounding).',
    `Librarian note: ${note || 'No on-brief positive exemplar with a recipe was found.'}`,
    'No recipe, record, or negative exemplar is injected as a model.',
  ].join('\n');
}

function ground(brief, options = {}) {
  // inject() owns the Librarian query plus the recipe-to-grounding format.
  const injected = inject(brief, {
    k: 1,
    indexPath: options.indexPath,
    variance: options.variance,
    motion: options.motion,
    density: options.density,
  });
  const match = injected.retrieval.matches[0] || null;

  // A neutral record or a positive record without a derived recipe is not a
  // safe imitation target for this recipe-driven loop.
  if (!match || match.exemplar_role !== 'positive' || !match.recipePath) {
    return {
      retrieval: injected.retrieval,
      groundingBlock: noGroundingBlock(injected.retrieval.note),
    };
  }

  return {
    retrieval: injected.retrieval,
    groundingBlock: injected.groundingBlock,
  };
}

function requireFiniteScore(value, label) {
  if (!Number.isFinite(value)) throw new Error(`conformance result is missing a finite ${label} score`);
  return value;
}

function verifiedCompletion(conformance, fidelity = null) {
  if (!conformance || typeof conformance !== 'object') {
    throw new Error('conformance result is required before a completion verdict can be made');
  }

  const overall = requireFiniteScore(conformance.overall, 'overall');
  const palette = requireFiniteScore(conformance.dimensions && conformance.dimensions.palette, 'palette');
  const overallPasses = overall >= CONFORMANCE_OVERALL_THRESHOLD;
  const palettePasses = palette >= CONFORMANCE_PALETTE_THRESHOLD;
  const complete = overallPasses && palettePasses;
  const reasons = [
    overallPasses
      ? `conformance overall ${overall} meets the ${CONFORMANCE_OVERALL_THRESHOLD} threshold`
      : `conformance overall ${overall} is below the ${CONFORMANCE_OVERALL_THRESHOLD} threshold`,
    palettePasses
      ? `palette ${palette} meets the ${CONFORMANCE_PALETTE_THRESHOLD} threshold`
      : `palette ${palette} is below the ${CONFORMANCE_PALETTE_THRESHOLD} threshold`,
    fidelity === null
      ? 'fidelity was not requested; completion is determined by the conformance gate'
      : 'fidelity was collected as advisory evidence and does not change the conformance completion rule',
  ];

  return { complete, conformance, fidelity, reasons };
}

function parseProductPhotoRecipe(recipe, { lastManifest = false } = {}) {
  const text = String(recipe || '').replace(/\r\n?/gu, '\n');
  const heading = lastManifest ? text.lastIndexOf(PRODUCT_PHOTO_HEADING) : text.indexOf(PRODUCT_PHOTO_HEADING);
  if (heading === -1) {
    throw new Error(`${PRODUCT_PHOTO_MISS_MESSAGE} The recipe has no ${PRODUCT_PHOTO_HEADING} block.`);
  }
  const jsonStart = text.indexOf('```json', heading);
  const jsonEnd = jsonStart === -1 ? -1 : text.indexOf('```', jsonStart + '```json'.length);
  if (jsonStart === -1 || jsonEnd === -1) throw new Error('product-photo recipe block must contain a JSON manifest');
  let manifest;
  try {
    manifest = JSON.parse(text.slice(jsonStart + '```json'.length, jsonEnd).trim());
  } catch (error) {
    throw new Error(`product-photo recipe manifest is invalid JSON: ${error.message}`);
  }
  if (!manifest || manifest.schema !== PRODUCT_PHOTO_SCHEMA) {
    throw new Error(`product-photo recipe manifest must use ${PRODUCT_PHOTO_SCHEMA}`);
  }
  if (manifest.status === 'miss') {
    if (!Array.isArray(manifest.regions) || manifest.regions.length !== 0) {
      throw new Error('product-photo MISS manifest must contain an explicit empty regions array');
    }
    return { status: 'miss', regions: [], message: manifest.message || PRODUCT_PHOTO_MISS_MESSAGE };
  }
  if (manifest.status !== 'resolved' || !Array.isArray(manifest.regions) || !manifest.regions.length) {
    throw new Error('product-photo recipe manifest must be resolved with at least one region, or explicit miss');
  }
  const ids = new Set();
  const regions = manifest.regions.map((region) => {
    const id = typeof region?.id === 'string' && /^[A-Za-z][A-Za-z0-9_-]*$/u.test(region.id) ? region.id : null;
    const tile = typeof region?.tile === 'string' && /^tile_\d+$/u.test(region.tile) ? region.tile : null;
    const role = typeof region?.role === 'string' && region.role.trim() ? region.role.trim() : null;
    const crop = region?.crop;
    const confidence = Number(region?.confidence);
    if (!id || ids.has(id)) throw new Error('product-photo recipe region ids must be unique safe identifiers');
    ids.add(id);
    if (!tile || !role || !crop || !Number.isFinite(confidence) || confidence < PRODUCT_PHOTO_MIN_CONFIDENCE || confidence > 1) {
      throw new Error(`product-photo region ${id} is missing verified tile, role, crop, or confidence`);
    }
    const box = { x: Number(crop.x), y: Number(crop.y), width: Number(crop.width), height: Number(crop.height) };
    if (!Object.values(box).every(Number.isInteger) || box.x < 0 || box.y < 0 || box.width < 1 || box.height < 1) {
      throw new Error(`product-photo region ${id} has an invalid crop box`);
    }
    if (region.provenance !== 'tile-vision' || typeof region.evidence !== 'string' || !region.evidence.trim()) {
      throw new Error(`product-photo region ${id} lacks tile-vision provenance evidence`);
    }
    if (region.verification?.provenance !== 'tile-vision' || Number(region.verification.confidence) < PRODUCT_PHOTO_MIN_CONFIDENCE || typeof region.verification.evidence !== 'string' || !region.verification.evidence.trim()) {
      throw new Error(`product-photo region ${id} lacks independently verified tile-vision evidence`);
    }
    return { ...region, id, tile, role, crop: box, confidence };
  });
  return { status: 'resolved', regions };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/gu, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function dataUriForFile(file, mime) {
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

function cropProductPhotoRegion(region, captureDir, { cropFn, cropDir } = {}) {
  const tiles = readCaptureTiles(captureDir, { maxTiles: Number.MAX_SAFE_INTEGER }).all;
  const source = tiles.find((tile) => tile.id === region.tile);
  if (!source) throw new Error(`${PRODUCT_PHOTO_MISS_MESSAGE} cited ${region.tile} is not present in ${path.resolve(captureDir)}.`);
  const dimensions = readImageDimensions(source.file);
  const crop = region.crop;
  if (crop.x + crop.width > dimensions.width || crop.y + crop.height > dimensions.height) {
    throw new Error(`product-photo region ${region.id} crop is outside ${region.tile} (${dimensions.width}×${dimensions.height})`);
  }
  if (cropFn) {
    const dataUri = cropFn({ region, source, dimensions });
    if (typeof dataUri !== 'string' || !/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/u.test(dataUri)) {
      throw new Error(`product-photo cropFn for ${region.id} did not return an image data URI`);
    }
    return { dataUri, source, dimensions, cropFile: null };
  }
  if (crop.x === 0 && crop.y === 0 && crop.width === dimensions.width && crop.height === dimensions.height) {
    return { dataUri: dataUriForFile(source.file, tileMime(source.file)), source, dimensions, cropFile: source.file };
  }
  const outputDir = cropDir || fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-product-photo-crops-'));
  const cropFile = path.join(outputDir, `${region.id}.png`);
  if (fs.existsSync(cropFile)) throw new Error(OVERWRITE_MESSAGE(cropFile));
  const result = childProcess.spawnSync('/usr/bin/sips', [
    '-s', 'format', 'png',
    '--cropToHeightWidth', String(crop.height), String(crop.width),
    '--cropOffset', String(crop.y), String(crop.x),
    source.file,
    '--out', cropFile,
  ], { encoding: 'utf8' });
  if (result.error || result.status !== 0 || !fs.existsSync(cropFile)) {
    throw new Error(`failed to crop ${region.id} from ${region.tile}: ${(result.error?.message || result.stderr || result.stdout || 'sips did not write an output file').trim()}`);
  }
  return { dataUri: dataUriForFile(cropFile, 'image/png'), source, dimensions, cropFile };
}

function dataUriByteLength(dataUri) {
  return Buffer.from(dataUri.slice(dataUri.indexOf(',') + 1), 'base64').length;
}

function safeClassName(value) {
  return typeof value === 'string' && /^[A-Za-z0-9 _-]*$/u.test(value) ? value.trim() : '';
}

const V4_ENHANCEMENT_SCHEMA = 'visigner.photo-carried-v4/v1';
const PRETENDARD_WEBFONT = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css';

function mergeProductPhotoManifests(primary, additions) {
  if (primary.status === 'miss') return primary;
  if (!additions || additions.status === 'miss') return primary;
  const ids = new Set(primary.regions.map((region) => region.id));
  const suffix = (id) => {
    const stem = `fullbleed_${id}`;
    let candidate = stem;
    let index = 2;
    while (ids.has(candidate)) candidate = `${stem}_${index++}`;
    ids.add(candidate);
    return candidate;
  };
  return {
    status: 'resolved',
    regions: [...primary.regions, ...additions.regions.map((region) => ({ ...region, id: suffix(region.id) }))],
  };
}

function colorToSrgb(raw) {
  const hex = String(raw).match(/^#([0-9a-f]{3,8})$/iu);
  if (hex) {
    let value = hex[1];
    if (value.length === 3 || value.length === 4) value = value.split('').map((part) => part + part).join('');
    const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
    const alpha = value.length === 8 ? Number.parseInt(value.slice(6, 8), 16) / 255 : 1;
    return `color(srgb ${channels.map((channel) => Number(channel.toFixed(5))).join(' ')}${alpha === 1 ? '' : ` / ${Number(alpha.toFixed(5))}`})`;
  }
  const rgb = String(raw).match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/iu);
  if (rgb) {
    const channels = [rgb[1], rgb[2], rgb[3]].map((channel) => Number((Number(channel) / 255).toFixed(5)));
    const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]);
    return `color(srgb ${channels.join(' ')}${alpha === 1 ? '' : ` / ${alpha}`})`;
  }
  throw new Error(`cannot tokenise unsupported CSS color ${raw}`);
}

function tokeniseInheritedColors(html) {
  const values = new Map();
  const colorRe = /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\)/gu;
  const withVars = String(html).replace(colorRe, (raw) => {
    const key = raw.toLowerCase();
    if (!values.has(key)) values.set(key, `--color-source-${String(values.size + 1).padStart(2, '0')}`);
    return `var(${values.get(key)})`;
  });
  const tokens = [...values.entries()].map(([raw, name]) => `${name}:${colorToSrgb(raw)}`).join(';');
  return { html: withVars, tokens };
}

function parseV4Enhancement(value) {
  if (!value || typeof value !== 'object' || value.schema !== V4_ENHANCEMENT_SCHEMA) {
    throw new Error(`v4 enhancement must use ${V4_ENHANCEMENT_SCHEMA}`);
  }
  const source = value.provenance;
  const empathy = value.empathy;
  const stickyCta = value.stickyCta;
  if (!source || typeof source.tile !== 'string' || typeof source.bodytext !== 'string' || !empathy || !stickyCta) {
    throw new Error('v4 enhancement requires tile/bodytext provenance plus empathy and stickyCta content');
  }
  const fields = [empathy.eyebrow, empathy.headline, empathy.body, stickyCta.recap, stickyCta.scarcity, stickyCta.action];
  if (!fields.every((field) => typeof field === 'string' && field.trim())) {
    throw new Error('v4 enhancement copy fields must be non-empty strings');
  }
  const proofSection = value.proofSection;
  if (!proofSection || typeof proofSection !== 'object'
    || typeof proofSection.kicker !== 'string' || !proofSection.kicker.trim()
    || typeof proofSection.headline !== 'string' || !proofSection.headline.trim()
    || !Array.isArray(proofSection.provenanceTiles) || !proofSection.provenanceTiles.length
    || !proofSection.provenanceTiles.every((tile) => typeof tile === 'string' && tile.trim())) {
    throw new Error('REFUSING — v4 enhancement must supply proofSection kicker, headline, and provenanceTiles; do not guess band copy or provenance.');
  }
  const sourceReplacements = value.sourceReplacements === undefined ? [] : value.sourceReplacements;
  if (!Array.isArray(sourceReplacements) || !sourceReplacements.every((item) => item && typeof item.find === 'string' && item.find && typeof item.replace === 'string' && item.replace && typeof item.source === 'string' && item.source)) {
    throw new Error('v4 sourceReplacements must contain exact non-empty find, replace, and source fields');
  }
  return {
    source,
    empathy: { eyebrow: empathy.eyebrow.trim(), headline: empathy.headline.trim(), body: empathy.body.trim() },
    stickyCta: { recap: stickyCta.recap.trim(), scarcity: stickyCta.scarcity.trim(), action: stickyCta.action.trim() },
    proofSection: {
      kicker: proofSection.kicker.trim(),
      headline: proofSection.headline.trim(),
      provenanceTiles: proofSection.provenanceTiles.map((tile) => tile.trim()),
    },
    sourceReplacements,
  };
}

function insertOnce(html, anchor, content, label) {
  const first = html.indexOf(anchor);
  if (first === -1 || html.indexOf(anchor, first + anchor.length) !== -1) {
    throw new Error(`REFUSING — v4 ${label} needs one exact build anchor; do not guess a placement.`);
  }
  return html.replace(anchor, `${content}${anchor}`);
}

function v4ContentBands(enhancement) {
  const provenance = `tile=${escapeHtml(enhancement.source.tile)}; bodytext=${escapeHtml(enhancement.source.bodytext)}`;
  const proof = enhancement.proofSection;
  return [
    `<section class="visigner-empathy" data-provenance="${provenance}"><p class="visigner-band-kicker">${escapeHtml(enhancement.empathy.eyebrow)}</p><h2>${escapeHtml(enhancement.empathy.headline)}</h2><p>${escapeHtml(enhancement.empathy.body)}</p></section>`,
    `<section class="visigner-proof-section" data-provenance="${escapeHtml(proof.provenanceTiles.join(','))}"><p class="visigner-band-kicker">${escapeHtml(proof.kicker)}</p><h2>${escapeHtml(proof.headline)}</h2><div class="visigner-proof-grid"><span class="visigner-proof-anchor"></span></div></section>`,
  ].join('');
}

function v4StyleSheet(tokens) {
  return `<link data-visigner-korean-font="pretendard" href="${PRETENDARD_WEBFONT}" rel="stylesheet"><style data-visigner-v4="true">@theme{${tokens};--color-white:color(srgb 1 1 1);--color-ink:color(srgb 0.067 0.067 0.078);--color-panel:color(srgb 0.969 0.969 0.984);--color-shadow:color(srgb 0 0 0 / .22);--font-display:"Pretendard Variable",Pretendard,sans-serif;--font-body:"Pretendard Variable",Pretendard,sans-serif}:root{${tokens};--color-white:color(srgb 1 1 1);--color-ink:color(srgb 0.067 0.067 0.078);--color-panel:color(srgb 0.969 0.969 0.984);--color-shadow:color(srgb 0 0 0 / .22);--font-display:"Pretendard Variable",Pretendard,sans-serif;--font-body:"Pretendard Variable",Pretendard,sans-serif}html,body{font-family:var(--font-body)}h1,h2,h3,h4,.brand,.percent,.stat b{font-family:var(--font-display)}.visigner-product-photo{display:block;max-width:100%;height:auto}.visigner-photo--hero{position:absolute;right:24px;bottom:24px;width:46%;max-height:45%;object-fit:cover;z-index:4;border:3px solid var(--color-white);box-shadow:0 16px 36px var(--color-shadow)}.visigner-photo--band{width:100%;height:300px;margin:0;object-fit:cover;object-position:center;box-shadow:0 12px 30px var(--color-shadow)}.visigner-empathy{margin:0 -7px 32px;padding:44px 54px;background:var(--color-panel);border-left:8px solid var(--color-source-04,var(--color-ink))}.visigner-band-kicker{margin:0 0 10px;font-size:13px;font-weight:800}.visigner-empathy h2,.visigner-proof-section h2{margin:0 0 14px;font-size:clamp(30px,4vw,44px);line-height:1.18;letter-spacing:-.07em}.visigner-empathy p:not(.visigner-band-kicker){margin:0;max-width:38em;font-size:17px;line-height:1.72;word-break:keep-all}.visigner-proof-section{margin:0 -7px 54px;padding:50px 54px;background:var(--color-ink);color:var(--color-white)}.visigner-proof-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:28px}.visigner-photo--proof{width:100%;height:330px;margin:0;object-fit:cover;box-shadow:0 12px 30px var(--color-shadow)}.medal-claim{margin-bottom:32px}.visigner-sticky-cta{display:none}@media(max-width:900px){.visigner-photo--hero{right:18px;bottom:18px;width:52%;max-height:38%}.visigner-photo--band{height:250px}.visigner-empathy,.visigner-proof-section{padding:36px 28px}.visigner-photo--proof{height:250px}}@media(max-width:680px){body{padding-bottom:112px}.visigner-photo--band{height:220px}.visigner-empathy,.visigner-proof-section{margin-left:-16px;margin-right:-16px;padding:32px 24px}.visigner-proof-grid{gap:8px;margin-top:20px}.visigner-photo--proof{height:210px}.visigner-sticky-cta{position:fixed;z-index:20;left:0;right:0;bottom:0;min-height:96px;padding:10px 14px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;background:var(--color-ink);color:var(--color-white);box-shadow:0 -10px 28px var(--color-shadow)}.visigner-sticky-cta p,.visigner-sticky-cta small{display:block;margin:0;line-height:1.35}.visigner-sticky-cta p{font-size:13px;font-weight:800}.visigner-sticky-cta small{font-size:11px}.visigner-sticky-cta a{display:grid;place-items:center;min-width:132px;min-height:56px;padding:0 12px;border-radius:8px;background:var(--color-source-07,var(--color-white));color:var(--color-ink);font-family:var(--font-display);font-size:14px;font-weight:900;text-decoration:none}}</style>`;
}

function applyV4Enhancement(html, rawEnhancement) {
  const enhancement = parseV4Enhancement(rawEnhancement);
  let output = String(html || '');
  for (const replacement of enhancement.sourceReplacements) {
    const first = output.indexOf(replacement.find);
    if (first === -1 || output.indexOf(replacement.find, first + replacement.find.length) !== -1) {
      throw new Error(`REFUSING — provenance replacement for ${replacement.source} needs one exact inherited value; do not guess a metric.`);
    }
    output = output.replace(replacement.find, replacement.replace);
  }
  output = insertOnce(output, '<div class="purple-block">', v4ContentBands(enhancement), 'content bands');
  output = insertOnce(output, '<section class="reward-list">', '<section class="reward-list" id="visigner-rewards">', 'CTA target').replace('<section class="reward-list">', '');
  output = output.replace('</body>', `<div class="visigner-sticky-cta" data-provenance="${escapeHtml(`${enhancement.source.tile}; ${enhancement.source.bodytext}`)}"><div><p>${escapeHtml(enhancement.stickyCta.recap)}</p><small>${escapeHtml(enhancement.stickyCta.scarcity)}</small></div><a href="#visigner-rewards">${escapeHtml(enhancement.stickyCta.action)}</a></div></body>`);
  output = output.replace(/Arial\s*,\s*"Apple SD Gothic Neo"\s*,\s*"Noto Sans KR"\s*,\s*sans-serif/giu, 'var(--font-body)')
    .replace(/Arial\s*,\s*sans-serif/giu, 'var(--font-display)')
    .replace(/\bArial\b/giu, 'var(--font-body)');
  const tokenised = tokeniseInheritedColors(output);
  if (!tokenised.html.includes('</head>')) throw new Error('v4 enhancement requires </head> to install font and token blocks');
  return tokenised.html.replace('</head>', `${v4StyleSheet(tokenised.tokens)}</head>`);
}

function productPhotoImageTag(region, dataUri, source, className = '') {
  const crop = region.crop;
  const classes = ['visigner-product-photo', safeClassName(className)].filter(Boolean).join(' ');
  return `<img class="${classes}" data-product-photo-id="${escapeHtml(region.id)}" data-product-photo-role="${escapeHtml(region.role)}" data-source-tile="${escapeHtml(source.id)}" data-crop="${crop.x},${crop.y},${crop.width},${crop.height}" src="${dataUri}" alt="${escapeHtml(region.role)}">`;
}

function placeProductPhotoSlots(html, slots, regions) {
  if (!Array.isArray(slots)) throw new Error('product-photo slot map must be an array');
  const regionIds = new Set(regions.map((region) => region.id));
  const seen = new Set();
  const byId = new Map();
  let output = String(html || '');
  for (const slot of slots) {
    const id = typeof slot?.id === 'string' ? slot.id : null;
    const anchor = typeof slot?.anchor === 'string' ? slot.anchor : null;
    const position = slot?.position === 'after' ? 'after' : (slot?.position === 'before' ? 'before' : null);
    const className = safeClassName(slot?.className);
    if (!id || !regionIds.has(id) || seen.has(id) || !anchor || !position || (slot?.className !== undefined && !className)) {
      throw new Error('product-photo slots must have one known id, one exact anchor, before|after position, and safe optional className');
    }
    const first = output.indexOf(anchor);
    if (first === -1 || output.indexOf(anchor, first + anchor.length) !== -1) {
      throw new Error(`REFUSING — product-photo slot ${id} needs one exact corresponding build anchor; do not guess a placement.`);
    }
    const marker = `<!-- ${PRODUCT_PHOTO_SLOT_PREFIX}${id} -->`;
    output = position === 'before'
      ? output.replace(anchor, `${marker}${anchor}`)
      : output.replace(anchor, `${anchor}${marker}`);
    byId.set(id, { className });
    seen.add(id);
  }
  const missing = [...regionIds].filter((id) => !seen.has(id));
  if (missing.length) throw new Error(`REFUSING — product-photo slot map omits ${missing.join(', ')}; do not invent a placement.`);
  return { html: output, byId };
}

function carriedPhotoStyleSheet() {
  return '<style data-visigner-photo-carrying="true">' +
    '.visigner-product-photo{display:block;max-width:100%;height:auto}.visigner-photo--section{width:calc(100% - 56px);margin:28px}.visigner-photo--hero{position:absolute;right:26px;bottom:26px;width:46%;max-height:45%;object-fit:cover;z-index:4;box-shadow:0 15px 32px rgba(0,0,0,.28);border:3px solid rgba(255,255,255,.88)}@media(max-width:900px){.visigner-photo--section{width:calc(100% - 32px);margin:20px 16px}.visigner-photo--hero{right:18px;bottom:18px;width:52%;max-height:38%}}' +
    '</style>';
}

function injectCarriedPhotoStyle(html) {
  if (html.includes('data-visigner-v4="true"')) return html;
  if (html.includes('data-visigner-photo-carrying="true"')) return html;
  if (!html.includes('</head>')) throw new Error('photo-carrying build must contain </head> to inject scoped image placement styles');
  return html.replace('</head>', `${carriedPhotoStyleSheet()}</head>`);
}

function embedProductPhotoRegions({ recipe, additionalPhotoRecipe = null, captureDir, html, cropFn, cropDir, slots } = {}) {
  const manifest = mergeProductPhotoManifests(
    parseProductPhotoRecipe(recipe),
    additionalPhotoRecipe === null ? null : parseProductPhotoRecipe(additionalPhotoRecipe, { lastManifest: true }),
  );
  if (manifest.status === 'miss') return { status: 'miss', html: String(html || ''), embedded: [], unresolved: [], message: manifest.message };
  const slotPlacement = slots === undefined ? null : placeProductPhotoSlots(html, slots, manifest.regions);
  let output = slotPlacement ? injectCarriedPhotoStyle(slotPlacement.html) : String(html || '');
  const embedded = [];
  const unresolved = [];
  for (const region of manifest.regions) {
    const marker = `<!-- ${PRODUCT_PHOTO_SLOT_PREFIX}${region.id} -->`;
    if (!output.includes(marker)) {
      unresolved.push({ id: region.id, role: region.role, reason: 'missing-corresponding-photo-slot' });
      continue;
    }
    const crop = cropProductPhotoRegion(region, captureDir, { cropFn, cropDir });
    output = output.replace(marker, productPhotoImageTag(region, crop.dataUri, crop.source, slotPlacement?.byId.get(region.id)?.className));
    embedded.push({
      id: region.id,
      role: region.role,
      tile: crop.source.id,
      crop: region.crop,
      bytes: dataUriByteLength(crop.dataUri),
      dataUri: crop.dataUri,
      cropFile: crop.cropFile,
    });
  }
  return { status: unresolved.length ? 'unresolved' : 'resolved', html: output, embedded, unresolved };
}

function productPhotoPageShell(manifest, title) {
  const sections = manifest.regions.map((region) => [
    '<section class="photo-section" data-product-photo-section="' + escapeHtml(region.role) + '">',
    '<p class="eyebrow">Carried from ' + escapeHtml(region.tile) + '</p>',
    '<h2>' + escapeHtml(region.role) + '</h2>',
    `<!-- ${PRODUCT_PHOTO_SLOT_PREFIX}${region.id} -->`,
    '</section>',
  ].join('\n')).join('\n');
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title || 'Product-photo carrying proof')}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f8f8fb;color:#111;font-family:Arial,sans-serif}.page{width:min(860px,100%);margin:auto;padding:48px 24px 80px}.intro{margin:0 0 48px;padding:24px;border:1px solid #ddd;background:#fff}.intro h1{margin:0;font-size:28px}.photo-section{margin:0 0 40px;padding:24px;background:#fff;border:1px solid #ddd}.photo-section h2{margin:0 0 18px;font-size:22px}.eyebrow{margin:0 0 8px;color:#555;font-size:13px}.visigner-product-photo{display:block;max-width:100%;height:auto;margin:auto}@media(max-width:680px){.page{padding:24px 12px 64px}.photo-section{padding:14px}}
</style></head><body><main class="page"><header class="intro"><h1>Verified product-photo carrying</h1><p>Each image below is a deterministic crop of the cited exemplar tile.</p></header>${sections}</main></body></html>`;
}

function buildPhotoCarryingPage({ recipe, additionalPhotoRecipe = null, enhancement = null, captureDir, cropFn, cropDir, title, baseHtml, slots } = {}) {
  const manifest = mergeProductPhotoManifests(
    parseProductPhotoRecipe(recipe),
    additionalPhotoRecipe === null ? null : parseProductPhotoRecipe(additionalPhotoRecipe, { lastManifest: true }),
  );
  if (manifest.status === 'miss') return { status: 'miss', html: '', embedded: [], unresolved: [], message: manifest.message };
  return embedProductPhotoRegions({
    recipe,
    additionalPhotoRecipe,
    captureDir,
    html: baseHtml === undefined ? productPhotoPageShell(manifest, title) : (enhancement === null ? baseHtml : applyV4Enhancement(baseHtml, enhancement)),
    cropFn,
    cropDir,
    slots,
  });
}

async function verify({ build, recipe, reference = null }, dependencies = {}) {
  const conformanceRunner = dependencies.conformanceRunner || runConformance;
  const fidelityRunner = dependencies.fidelityRunner || runFidelity;

  // Do not catch either call: an unavailable or broken oracle must surface,
  // never become a fabricated passing (or advisory) result.
  const conformance = conformanceRunner(['--build', build, '--recipe', recipe]);
  const fidelity = reference === null
    ? null
    : await fidelityRunner(['--repro', build, '--reference', reference]);

  return verifiedCompletion(conformance, fidelity);
}

function parseVerifyArgs(argv) {
  const args = { build: null, recipe: null, reference: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--build' || argument === '--recipe' || argument === '--reference') {
      const value = argv[++index];
      if (!value) throw new Error(`${argument} requires a value`);
      args[argument.slice(2)] = value;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  if (!args.build || !args.recipe) {
    throw new Error('verify requires --build <html> and --recipe <recipe.md>');
  }
  return args;
}

function parseGroundArgs(argv) {
  if (!argv[0]) throw new Error("ground requires '<brief-json>' [--variance 1-10] [--motion 1-10] [--density 1-10]");
  let brief;
  try {
    brief = JSON.parse(argv[0]);
  } catch (error) {
    throw new Error(`brief must be valid JSON: ${error.message}`);
  }

  const dials = {};
  for (let index = 1; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!['--variance', '--motion', '--density'].includes(flag) || argv[index + 1] === undefined) {
      throw new Error("ground requires '<brief-json>' [--variance 1-10] [--motion 1-10] [--density 1-10]");
    }
    const name = flag.slice(2);
    if (Object.prototype.hasOwnProperty.call(dials, name)) throw new Error(`ground received ${flag} more than once`);
    dials[name] = normalizeDesignDial(argv[index + 1], name);
    index += 1;
  }
  return { brief, dials };
}

function parseCarryPhotosArgs(argv) {
  const args = { recipe: null, capture: null, out: null, base: null, slots: null, photoAdditions: null, enhancement: null };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if ((flag !== '--recipe' && flag !== '--capture' && flag !== '--out' && flag !== '--base' && flag !== '--slots' && flag !== '--photo-additions' && flag !== '--enhancement') || !argv[index + 1]) {
      throw new Error('carry-photos requires --recipe <recipe.md> --capture <captureDir> --out <page.html> [--base <existing-build.html> --slots <slot-map.json> --photo-additions <vision-recipe.md> --enhancement <v4.json>]');
    }
    const key = flag === '--photo-additions' ? 'photoAdditions' : flag.slice(2);
    if (args[key] !== null) throw new Error(`carry-photos received ${flag} more than once`);
    args[key] = argv[index + 1];
    index += 1;
  }
  if (!args.recipe || !args.capture || !args.out) {
    throw new Error('carry-photos requires --recipe <recipe.md> --capture <captureDir> --out <page.html> [--base <existing-build.html> --slots <slot-map.json> --photo-additions <vision-recipe.md> --enhancement <v4.json>]');
  }
  if (Boolean(args.base) !== Boolean(args.slots)) throw new Error('carry-photos requires both --base and --slots when carrying into an existing build');
  if (args.enhancement && !args.base) throw new Error('carry-photos enhancement requires an existing --base build');
  return args;
}

function usage() {
  return [
    "Usage: node scripts/design-loop.js ground '<brief-json>' [--variance 1-10] [--motion 1-10] [--density 1-10]",
    '   or: node scripts/design-loop.js verify --build <html> --recipe <recipe.md> [--reference <captureDir>]',
    '   or: node scripts/design-loop.js carry-photos --recipe <recipe.md> --capture <captureDir> --out <page.html> [--base <existing-build.html> --slots <slot-map.json> --photo-additions <vision-recipe.md> --enhancement <v4.json>]',
  ].join('\n');
}

async function runCli(argv = process.argv.slice(2)) {
  try {
    if (argv[0] === 'ground') {
      const args = parseGroundArgs(argv.slice(1));
      const result = ground(args.brief, args.dials);
      console.log(result.groundingBlock);
      return result;
    }

    if (argv[0] === 'verify') {
      const verdict = await verify(parseVerifyArgs(argv.slice(1)));
      console.log(JSON.stringify(verdict, null, 2));
      return verdict;
    }

    if (argv[0] === 'carry-photos') {
      const args = parseCarryPhotosArgs(argv.slice(1));
      const recipe = fs.readFileSync(path.resolve(args.recipe), 'utf8');
      const out = path.resolve(args.out);
      if (fs.existsSync(out)) throw new Error(OVERWRITE_MESSAGE(out));
      let slots = null;
      if (args.slots) {
        try {
          slots = JSON.parse(fs.readFileSync(path.resolve(args.slots), 'utf8'));
        } catch (error) {
          throw new Error(`cannot read --slots ${path.resolve(args.slots)}: ${error.message}`);
        }
      }
      let enhancement = null;
      if (args.enhancement) {
        try {
          enhancement = JSON.parse(fs.readFileSync(path.resolve(args.enhancement), 'utf8'));
        } catch (error) {
          throw new Error(`cannot read --enhancement ${path.resolve(args.enhancement)}: ${error.message}`);
        }
      }
      const result = buildPhotoCarryingPage({
        recipe,
        additionalPhotoRecipe: args.photoAdditions ? fs.readFileSync(path.resolve(args.photoAdditions), 'utf8') : null,
        enhancement,
        captureDir: args.capture,
        title: path.basename(args.recipe),
        ...(args.base ? { baseHtml: fs.readFileSync(path.resolve(args.base), 'utf8'), slots } : {}),
      });
      if (result.status === 'miss') {
        console.log(`PRODUCT-PHOTO ${result.message}`);
        // Sibling MISS contract: a database miss is a non-zero exit, not a pass.
        process.exitCode = 1;
        return result;
      }
      if (result.unresolved.length) throw new Error(`REFUSING — no corresponding build slot for ${result.unresolved.map((item) => item.id).join(', ')}; do not guess a placement.`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, result.html, 'utf8');
      console.log(`PASS photo-carrying build ${out}`);
      for (const item of result.embedded) {
        console.log(`EMBED ${item.id} [${item.tile}] crop=${item.crop.x},${item.crop.y},${item.crop.width},${item.crop.height} bytes=${item.bytes} role=${item.role}`);
      }
      return { ...result, out };
    }

    throw new Error(usage());
  } catch (error) {
    console.error(`FAIL — ${error.message}`);
    process.exitCode = 1;
    return null;
  }
}

if (require.main === module) runCli();

module.exports = {
  CONFORMANCE_OVERALL_THRESHOLD,
  CONFORMANCE_PALETTE_THRESHOLD,
  ground,
  noGroundingBlock,
  PRODUCT_PHOTO_MISS_MESSAGE,
  PRODUCT_PHOTO_SLOT_PREFIX,
  V4_ENHANCEMENT_SCHEMA,
  applyV4Enhancement,
  buildPhotoCarryingPage,
  cropProductPhotoRegion,
  embedProductPhotoRegions,
  parseVerifyArgs,
  parseGroundArgs,
  parseCarryPhotosArgs,
  parseProductPhotoRecipe,
  runCli,
  verifiedCompletion,
  verify,
};
