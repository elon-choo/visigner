#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const KINDS = Object.freeze({
  UNSOURCED_METRIC: 'unsourced-metric',
  SUPERLATIVE: 'superlative',
  REGULATED_CLAIM: 'health-financial-legal-claim',
});
const REVIEW_NOTE = 'you must verify/substantiate or remove this claim — provide a source or delete it';
const BLOCK_TAGS = new Set([
  'body', 'main', 'section', 'article', 'aside', 'header', 'footer', 'div',
  'p', 'li', 'blockquote', 'figure', 'figcaption', 'h1', 'h2', 'h3', 'h4',
  'h5', 'h6', 'td', 'th', 'dt', 'dd', 'title',
]);
const TERMINAL_TAGS = new Set(['p', 'li', 'blockquote', 'figcaption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'td', 'th', 'dt', 'dd', 'title']);
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const EXCLUDED_BLOCKS = Object.freeze(['script', 'style', 'svg', 'template', 'noscript', 'pre', 'code']);

const CLAIM_PATTERNS = Object.freeze([
  Object.freeze({
    kind: KINDS.REGULATED_CLAIM,
    priority: 3,
    regex: /\b(?:clinically\s+proven|FDA[-\s]+approved|guaranteed\s+(?:returns?|income|profits?)|risk[-\s]*free\s+(?:investment|returns?)|legally\s+compliant|tax[-\s]+deductible)\b/gi,
  }),
  Object.freeze({
    kind: KINDS.SUPERLATIVE,
    priority: 2,
    regex: /\b(?:the\s+best(?=\s+(?:platform|product|service|solution|tool|app|software|choice|brand|provider|system|device|formula|experience|results?|performance)\b|\s*[.!?]?\s*$)|world(?:'|’)s\s*#1|guaranteed)\b/gi,
  }),
  Object.freeze({
    kind: KINDS.UNSOURCED_METRIC,
    priority: 1,
    regex: /\b\d{1,3}(?:,\d{3})+(?:\+)?\s*(?:users?|customers?|members?|patients?|businesses?|teams?|downloads?|reviews?)\b/gi,
  }),
  Object.freeze({
    kind: KINDS.UNSOURCED_METRIC,
    priority: 1,
    regex: /\b\d+(?:\.\d+)?%\s*(?:uptime|effective|effectiveness|accuracy|satisfaction|success|improvement|faster|reduction|growth|recommended)\b/gi,
  }),
  Object.freeze({
    kind: KINDS.UNSOURCED_METRIC,
    priority: 1,
    regex: /#1\b|\bNo\.\s*1\b|\bnumber\s+one\b/gi,
  }),
  Object.freeze({
    kind: KINDS.UNSOURCED_METRIC,
    priority: 1,
    regex: /\b\d+(?:\.\d+)?\s*[x×]\s*(?:faster|better|more|stronger|longer|higher|growth)\b/gi,
  }),
  Object.freeze({
    kind: KINDS.UNSOURCED_METRIC,
    priority: 1,
    regex: /\brated\s+\d+(?:\.\d+)?\s*\/\s*\d+\b/gi,
  }),
  Object.freeze({
    kind: KINDS.UNSOURCED_METRIC,
    priority: 1,
    regex: /(?:고객|회원|사용자|구매자|참여자|응답자)\s*\d{1,3}(?:,\d{3})*(?:\+)?\s*명|\d{1,3}(?:,\d{3})*(?:\+)?\s*명\s*(?:고객|회원|사용자|구매자|참여자|응답자)|(?:후기|리뷰|판매|주문|구매|문의)\s*\d{1,3}(?:,\d{3})*(?:\+)?\s*(?:개|건)|\d{1,3}(?:,\d{3})*(?:\+)?\s*(?:개|건)\s*(?:후기|리뷰|판매|주문|구매|문의)|(?:절감|매출|수익)\s*\d{1,3}(?:,\d{3})*(?:\+)?\s*원|\d{1,3}(?:,\d{3})*(?:\+)?\s*원\s*(?:절감|매출|수익)/g,
  }),
  Object.freeze({
    kind: KINDS.UNSOURCED_METRIC,
    priority: 1,
    regex: /(?:재구매율|고객\s*만족도|만족도|추천율|성공률|정확도)\s*\d+(?:\.\d+)?%|\d+(?:\.\d+)?%\s*(?:재구매율|고객\s*만족도|만족도|추천율|성공률|정확도)|(?:월\s*)?\d+(?:\.\d+)?%\s*비용\s*절감/g,
  }),
  Object.freeze({
    kind: KINDS.SUPERLATIVE,
    priority: 2,
    regex: /(?:고객\s*)?만족도\s*1위|(?:업계|국내|세계|시장|카테고리|판매|브랜드)\s*1위|(?:업계|국내|세계|시장|카테고리|판매|브랜드|고객)\s*(?:최고|최초|유일)(?!점)|(?:최고|최초|유일)\s*(?:제품|브랜드|기술|서비스|솔루션|기록|선택|공법)|마감\s*임박|(?:수량|기간)\s*한정|한정\s*(?:수량|판매)/g,
  }),
]);

function mask(value) {
  return String(value).replace(/[^\n]/g, ' ');
}

function sourceWithoutNonCopy(html) {
  let source = String(html || '').replace(/<!--[\s\S]*?-->/g, mask);
  for (const tag of EXCLUDED_BLOCKS) {
    source = source.replace(new RegExp('<' + tag + '\\b[\\s\\S]*?<\\/' + tag + '\\s*>', 'gi'), mask);
  }
  return source;
}

function decodeEntity(entity) {
  const numeric = entity.match(/^&#(\d+);$/);
  const hex = entity.match(/^&#x([\da-f]+);$/i);
  const codePoint = numeric ? Number(numeric[1]) : (hex ? Number.parseInt(hex[1], 16) : null);
  if (codePoint !== null) {
    return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : entity;
  }
  const named = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: '\u00a0', quot: '"' };
  const name = entity.slice(1, -1).toLowerCase();
  return Object.hasOwn(named, name) ? named[name] : entity;
}

function visibleTextWithMap(fragment, baseOffset) {
  let text = '';
  const offsets = [];
  for (const token of String(fragment || '').matchAll(/<[^>]*>|[^<]+/g)) {
    if (token[0].startsWith('<')) continue;
    const raw = token[0];
    const rawBase = baseOffset + token.index;
    let cursor = 0;
    for (const entity of raw.matchAll(/&(?:#\d+|#x[\da-f]+|[a-z][\w-]*);/gi)) {
      const prefix = raw.slice(cursor, entity.index);
      text += prefix;
      for (let index = 0; index < prefix.length; index += 1) offsets.push(rawBase + cursor + index);
      const decoded = decodeEntity(entity[0]);
      text += decoded;
      for (let index = 0; index < decoded.length; index += 1) offsets.push(rawBase + entity.index);
      cursor = entity.index + entity[0].length;
    }
    const suffix = raw.slice(cursor);
    text += suffix;
    for (let index = 0; index < suffix.length; index += 1) offsets.push(rawBase + cursor + index);
  }
  return { text, offsets };
}

function parseBlockTree(source) {
  const root = { tag: 'document', attrs: '', openStart: 0, openEnd: 0, closeStart: source.length, end: source.length, parent: null, children: [] };
  const nodes = [];
  const stack = [];
  for (const tagMatch of source.matchAll(/<\/?\s*[a-z][^>]*>/gi)) {
    const raw = tagMatch[0];
    const closing = raw.match(/^<\s*\/\s*([a-z][\w-]*)/i);
    if (closing) {
      const name = closing[1].toLowerCase();
      const index = stack.map((entry) => entry.tag).lastIndexOf(name);
      if (index === -1) continue;
      const [entry] = stack.splice(index, 1);
      if (entry.node) {
        entry.node.closeStart = tagMatch.index;
        entry.node.end = tagMatch.index + raw.length;
      }
      continue;
    }
    const opening = raw.match(/^<\s*([a-z][\w-]*)([\s\S]*?)\/?\s*>$/i);
    if (!opening) continue;
    const tag = opening[1].toLowerCase();
    const parent = [...stack].reverse().find((entry) => entry.node)?.node || root;
    let node = null;
    if (BLOCK_TAGS.has(tag)) {
      node = {
        tag,
        attrs: opening[2] || '',
        openStart: tagMatch.index,
        openEnd: tagMatch.index + raw.length,
        closeStart: source.length,
        end: source.length,
        parent,
        children: [],
      };
      parent.children.push(node);
      nodes.push(node);
    }
    if (!VOID_TAGS.has(tag) && !/\/\s*>$/.test(raw)) stack.push({ tag, node });
  }
  return { root, nodes };
}

function attributeValue(attrs, name) {
  const escaped = name.replace(/[.*+?^$()|[\]{}]/g, '\\$&');
  const match = String(attrs || '').match(new RegExp('(?:^|\\s)' + escaped + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i'));
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : '';
}

function nodeLabel(node) {
  const id = attributeValue(node.attrs, 'id');
  return node.tag + (id ? '#' + id : '');
}

function lineAt(source, offset) {
  return source.slice(0, Math.max(0, offset)).split('\n').length;
}

function compact(value, limit = 180) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? text.slice(0, limit - 1).trimEnd() + '…' : text;
}

function sentenceAround(text, index, length) {
  const before = text.slice(0, index);
  const after = text.slice(index + length);
  const previousBoundary = Math.max(before.lastIndexOf('.'), before.lastIndexOf('!'), before.lastIndexOf('?'), before.lastIndexOf('\n'));
  const nextCandidates = [after.indexOf('.'), after.indexOf('!'), after.indexOf('?'), after.indexOf('\n')].filter((value) => value >= 0);
  const nextBoundary = nextCandidates.length ? Math.min(...nextCandidates) : after.length;
  return text.slice(previousBoundary + 1, index + length + nextBoundary + (nextBoundary < after.length ? 1 : 0));
}

function attrsHaveAttribution(node) {
  for (let current = node; current && !['document', 'body', 'main'].includes(current.tag); current = current.parent) {
    if (/\bdata-(?:source|citation|attribution)\s*=\s*(?:"[^"]+"|'[^']+'|[^\s>]+)/i.test(current.attrs)) return true;
    const describedBy = attributeValue(current.attrs, 'aria-describedby');
    if (/\b(?:source|citation|footnote|reference|attribution)\b/i.test(describedBy)) return true;
  }
  return false;
}

function citationScope(node) {
  const parent = node.parent;
  if (parent && !['document', 'body', 'main'].includes(parent.tag)) return parent;
  return node;
}

function hasSourcePhrase(value) {
  const text = String(value || '');
  if (/(?:출처|근거)\s*(?:[:：]|는\b|로\b|에\s*따르면)|(?:자료|조사|통계)\s*(?:출처|근거)\s*[:：]/i.test(text)) return true;
  if (/\b(?:source|citation|attribution)\s*:|\baccording\s+to\b|\bdata\s+from\b|\breported\s+by\b|\bverified\s+by\b|\bresearch\s+by\b/i.test(text)) return true;
  if (/\bbased\s+on\s+(?:(?:the\s+)?(?:data|study|report|audit|benchmark|dataset|methodology|analysis|survey|registry)|\d[\d,]*\s+(?:verified\s+)?(?:responses?|reviews?|participants?|customers?|patients?))\b/i.test(text)) return true;
  if (/\bper\s+(?:the\s+)?(?:(?:controlled|independent|published|external|third[-\s]+party)\s+)?(?:study|report|audit|benchmark|dataset|methodology|analysis|survey|registry)\b/i.test(text)) return true;
  return /\bper\s+(?:the\s+)?[A-Z][\w.-]+(?:\s+[A-Z][\w.-]+){0,3}\b/.test(text);
}

function sourceLinkSignal(nearby) {
  const cta = /(?:signup|sign-up|order|buy|subscribe|pricing|app|cart|checkout|demo|가입|주문|구매|구독|가격|장바구니|결제|신청|예약)/i;
  const sourceHint = /(?:source|citation|reference|footnote|methodology|research|study|report|audit|data|evidence|registry|database|record|verified|review|출처|근거|자료|조사|연구|보고서|검증|원문|방법|통계)/i;
  for (const match of String(nearby || '').matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
    const href = attributeValue(match[1], 'href').trim();
    if (!/^https?:\/\//i.test(href)) continue;
    const text = compact(match[2].replace(/<[^>]*>/g, ' '), 300);
    const combined = href + ' ' + text;
    if (cta.test(combined)) continue;
    if (sourceHint.test(combined)) return 'source link';
  }
  return null;
}

function sourceHasId(source, id) {
  const escaped = String(id || '').replace(/[.*+?^$()|[\]{}]/g, '\\$&');
  return escaped && new RegExp('\\bid\\s*=\\s*(?:"' + escaped + '"|\'' + escaped + '\'|'+ escaped + ')(?:\\s|>)', 'i').test(source);
}

function resolvedFootnoteSignal(nearby, source) {
  for (const match of String(nearby || '').matchAll(/<sup\b[^>]*>([\s\S]*?)<\/sup\s*>/gi)) {
    const body = match[1];
    const anchor = body.match(/<a\b([^>]*)>/i);
    const href = anchor ? attributeValue(anchor[1], 'href').trim() : '';
    if (/^#[A-Za-z][\w:.-]*$/.test(href) && sourceHasId(source, href.slice(1))) return 'resolved footnote reference';
    const number = compact(body.replace(/<[^>]*>/g, ''), 30).match(/^\[?(\d+)\]?$/);
    if (!number) continue;
    const candidates = ['fn-' + number[1], 'fn' + number[1], 'footnote-' + number[1], 'footnote' + number[1], 'ref-' + number[1], 'ref' + number[1], 'note-' + number[1], 'note' + number[1]];
    if (candidates.some((id) => sourceHasId(source, id))) return 'resolved footnote reference';
  }
  return null;
}

function citationSignal({ node, source, claimOffset, sentence }) {
  if (attrsHaveAttribution(node)) return 'data attribution';
  if (hasSourcePhrase(sentence)) return 'source phrase';
  const scope = citationScope(node);
  const start = Math.max(scope.openStart, claimOffset - 360);
  const end = Math.min(scope.end, claimOffset + 360);
  const nearby = source.slice(start, end);
  if (/\bdata-(?:source|citation|attribution)\s*=/i.test(nearby)) return 'data attribution';
  if (/<cite\b/i.test(nearby)) return 'cite element';
  const sourceLink = sourceLinkSignal(nearby);
  if (sourceLink) return sourceLink;
  const footnote = resolvedFootnoteSignal(nearby, source);
  if (footnote) return footnote;
  if (/\b(?:class|id)\s*=\s*(?:"[^"]*(?:source|citation|footnote|attribution)[^"]*"|'[^']*(?:source|citation|footnote|attribution)[^']*')/i.test(nearby)) return 'citation-labelled element';
  if (hasSourcePhrase(nearby)) return 'source phrase';
  return null;
}

function claimsInText(text) {
  const candidates = [];
  for (const pattern of CLAIM_PATTERNS) {
    for (const match of text.matchAll(pattern.regex)) {
      candidates.push({
        claim: compact(match[0]),
        kind: pattern.kind,
        priority: pattern.priority,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }
  candidates.sort((a, b) => a.start - b.start || b.priority - a.priority || (b.end - b.start) - (a.end - a.start));
  const selected = [];
  for (const candidate of candidates) {
    if (selected.some((item) => candidate.start < item.end && candidate.end > item.start)) continue;
    selected.push(candidate);
  }
  return selected.sort((a, b) => a.start - b.start);
}

function detectMetricClaims(pagePath) {
  const page = path.resolve(pagePath || '');
  let html;
  try {
    html = fs.readFileSync(page, 'utf8');
  } catch (error) {
    return {
      status: 'unavailable', zeroNetwork: true, page, flagCount: 0, items: [],
      substantiatedCount: 0, substantiatedClaims: [],
      errors: [{ source: page, error: compact(error && error.message, 1200) }],
    };
  }

  const source = sourceWithoutNonCopy(html);
  const { nodes } = parseBlockTree(source);
  const scanNodes = nodes.filter((node) => TERMINAL_TAGS.has(node.tag) || node.children.length === 0);
  const items = [];
  const substantiatedClaims = [];
  const seen = new Set();

  for (const node of scanNodes) {
    const fragment = source.slice(node.openEnd, node.closeStart);
    const visible = visibleTextWithMap(fragment, node.openEnd);
    if (!visible.text.trim()) continue;
    for (const candidate of claimsInText(visible.text)) {
      const claimOffset = visible.offsets[candidate.start] ?? node.openEnd;
      const identity = [candidate.kind, claimOffset, candidate.claim.toLowerCase()].join('|');
      if (seen.has(identity)) continue;
      seen.add(identity);
      const location = {
        line: lineAt(html, claimOffset),
        tag: nodeLabel(node),
        context: compact(sentenceAround(visible.text, candidate.start, candidate.end - candidate.start)),
      };
      const signal = citationSignal({
        node,
        source,
        claimOffset,
        sentence: sentenceAround(visible.text, candidate.start, candidate.end - candidate.start),
      });
      if (signal) {
        substantiatedClaims.push({ claim: candidate.claim, kind: candidate.kind, location, citationSignal: signal });
        continue;
      }
      items.push({ claim: candidate.claim, kind: candidate.kind, note: REVIEW_NOTE, location });
    }
  }

  items.sort((a, b) => a.location.line - b.location.line || a.claim.localeCompare(b.claim));
  substantiatedClaims.sort((a, b) => a.location.line - b.location.line || a.claim.localeCompare(b.claim));
  return {
    status: items.length ? 'human-verification-required' : 'clean',
    zeroNetwork: true,
    page,
    flagCount: items.length,
    items,
    substantiatedCount: substantiatedClaims.length,
    substantiatedClaims,
    errors: [],
  };
}

function main() {
  try {
    process.stdout.write(JSON.stringify(detectMetricClaims(process.argv[2]), null, 2) + '\n');
  } catch (error) {
    process.stdout.write(JSON.stringify({
      status: 'unavailable', zeroNetwork: true,
      page: process.argv[2] ? path.resolve(process.argv[2]) : null,
      flagCount: 0, items: [], substantiatedCount: 0, substantiatedClaims: [],
      errors: [{ source: 'detector', error: compact(error && error.message, 1200) }],
    }, null, 2) + '\n');
  }
}

if (require.main === module) main();

module.exports = { KINDS, REVIEW_NOTE, detectMetricClaims };
