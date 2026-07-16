#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const KINDS = Object.freeze({
  LOREM: 'lorem-ipsum',
  STAND_IN: 'stand-in-marker',
  TEMPLATE_TOKEN: 'template-token',
  BRAND_DEFAULT: 'brand-token-default',
  EMPTY_HEADING: 'empty-heading',
  DUPLICATE_HEADING: 'duplicate-heading',
});

const EXCLUDED_BLOCKS = Object.freeze(['script', 'style', 'svg', 'template', 'noscript', 'pre', 'code']);
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

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

function decodeEntities(value) {
  const named = {
    amp: '&', apos: "'", gt: '>', lt: '<', nbsp: '\u00a0', quot: '"',
  };
  return String(value || '').replace(/&(?:#(\d+)|#x([\da-f]+)|([a-z][\w-]*));/gi, (whole, decimal, hex, name) => {
    const codePoint = decimal ? Number(decimal) : (hex ? Number.parseInt(hex, 16) : null);
    if (codePoint !== null) {
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : whole;
    }
    return Object.hasOwn(named, name.toLowerCase()) ? named[name.toLowerCase()] : whole;
  });
}

function plainText(value) {
  return decodeEntities(String(value || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function lineAt(source, offset) {
  return source.slice(0, Math.max(0, offset)).split('\n').length;
}

function snippet(value, limit = 120) {
  const text = plainText(value);
  return text.length > limit ? text.slice(0, limit - 1).trimEnd() + '…' : text;
}

function humanizeToken(value) {
  const inner = String(value || '')
    .replace(/^\$?\{\{?\s*|\s*\}\}?$/g, '')
    .replace(/^%|%$/g, '')
    .replace(/^\[|\]$/g, '')
    .replace(/[_.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return inner || 'copy';
}

function textSegments(source) {
  const segments = [];
  const stack = [];
  for (const token of source.matchAll(/<[^>]*>|[^<]+/g)) {
    const raw = token[0];
    const offset = token.index;
    if (!raw.startsWith('<')) {
      const text = plainText(raw);
      if (text) segments.push({ text, raw, offset, tag: stack.at(-1) || 'text' });
      continue;
    }
    const closing = raw.match(/^<\s*\/\s*([a-z][\w-]*)/i);
    if (closing) {
      const name = closing[1].toLowerCase();
      const index = stack.lastIndexOf(name);
      if (index !== -1) stack.splice(index);
      continue;
    }
    const opening = raw.match(/^<\s*([a-z][\w-]*)/i);
    if (!opening) continue;
    const name = opening[1].toLowerCase();
    if (!VOID_TAGS.has(name) && !/\/\s*>$/.test(raw)) stack.push(name);
  }
  return segments;
}

function visibleAttributeSegments(source) {
  const segments = [];
  for (const tagMatch of source.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
    const tag = tagMatch[1].toLowerCase();
    const attrs = tagMatch[2];
    for (const attrMatch of attrs.matchAll(/\b(placeholder|value|aria-label|alt|title)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
      const text = plainText(attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '');
      if (!text) continue;
      segments.push({
        text,
        raw: text,
        offset: tagMatch.index,
        tag: tag + '[' + attrMatch[1].toLowerCase() + ']',
      });
    }
  }
  return segments;
}

function commentSegments(html) {
  const segments = [];
  for (const match of String(html || '').matchAll(/<!--[\s\S]*?-->/g)) {
    const text = plainText(match[0].slice(4, -3));
    if (text) segments.push({ text, raw: match[0], offset: match.index, tag: 'html-comment' });
  }
  return segments;
}

function markerIsStandIn(text, start, end) {
  const source = String(text || '');
  const before = source.slice(0, start);
  const after = source.slice(end);
  if (/^\s*[:：]/.test(after)) return true;
  const bracketed = (
    /\[\s*$/.test(before) && /^\s*\]/.test(after)
  ) || (
    /\{\{?\s*$/.test(before) && /^\s*\}\}?/.test(after)
  );
  if (bracketed) return true;

  const residual = source
    .replace(/(?<![\w-])(?:TODO|PLACEHOLDER|FIXME|TBD)(?![\w-])/g, '')
    .replace(/(?<![\w-])your\s+text\s+here(?![\w-])/gi, '')
    .replace(/(?<![가-힣\w-])(?:브랜드명|임시)(?![가-힣\w-])/g, '')
    .replace(/(?:여기에\s*(?:텍스트|내용)(?:을|를)?\s*(?:입력(?:하세요|해\s*주세요)?|작성(?:하세요|해\s*주세요)?)?|(?:텍스트|내용)\s*입력|예시\s*텍스트|임시\s*(?:텍스트|문구|내용))/g, '')
    .replace(/[\s·,;|/—–\-:[\]{}()]+/g, '');
  return residual.length === 0;
}

function detectCopyTokenGaps(pagePath) {
  const page = path.resolve(pagePath || '');
  let html;
  try {
    html = fs.readFileSync(page, 'utf8');
  } catch (error) {
    return {
      status: 'unavailable',
      zeroNetwork: true,
      page,
      gapCount: 0,
      items: [],
      errors: [{ source: page, error: String(error && error.message || error).replace(/\s+/g, ' ').slice(0, 1200) }],
    };
  }

  const source = sourceWithoutNonCopy(html);
  const items = [];
  const seen = new Set();
  function add(kind, value, segment, suggestion, extraLocation = {}) {
    const display = String(value || '').trim() || '(empty)';
    const location = {
      line: lineAt(html, segment.offset),
      tag: segment.tag || 'text',
      snippet: snippet(segment.raw) || '(empty)',
      ...extraLocation,
    };
    const key = [kind, display.toLowerCase(), location.line, location.tag].join('|');
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ kind, value: display, location, suggestion });
  }

  const segments = [...textSegments(source), ...visibleAttributeSegments(source), ...commentSegments(html)];
  const loremPattern = /\b(?:lorem\s+ipsum|dolor\s+sit\s+amet)\b/i;
  const markerPattern = /(?<![\w-])(?:TODO|PLACEHOLDER|FIXME|TBD)(?![\w-])/g;
  const standInPhrasePattern = /(?<![\w-])your\s+text\s+here(?![\w-])/gi;
  const koreanStandInPhrasePattern = /(?:여기에\s*(?:텍스트|내용)(?:을|를)?\s*(?:입력(?:하세요|해\s*주세요)?|작성(?:하세요|해\s*주세요)?)?|(?:텍스트|내용)\s*입력|예시\s*텍스트|임시\s*(?:텍스트|문구|내용))/g;
  const koreanMarkerPattern = /(?<![가-힣\w-])(?:브랜드명|임시)(?![가-힣\w-])/g;
  const tokenPattern = /\{\{\s*[A-Za-z_][\w.-]*\s*\}\}|\$\{\s*[A-Za-z_][\w.-]*\s*\}|(?<![\{$])\{\s*[A-Za-z_][\w.-]*\s*\}(?!\})|%[A-Z][A-Z0-9_.-]*%/g;
  const brandPattern = /(?<![\w-])(?:Brand\s+Name|Company\s+Name|\[BRAND\])(?![\w-])/gi;

  for (const segment of segments) {
    const lorem = segment.text.match(loremPattern);
    if (lorem) {
      add(KINDS.LOREM, lorem[0], segment, 'replace "' + lorem[0] + '" with your real page copy');
    }
    for (const match of segment.text.matchAll(markerPattern)) {
      if (!markerIsStandIn(segment.text, match.index, match.index + match[0].length)) continue;
      add(KINDS.STAND_IN, match[0], segment, 'replace "' + match[0] + '" with your real copy');
    }
    for (const match of segment.text.matchAll(standInPhrasePattern)) {
      add(KINDS.STAND_IN, match[0], segment, 'replace "' + match[0] + '" with your real copy');
    }
    for (const match of segment.text.matchAll(koreanStandInPhrasePattern)) {
      add(KINDS.STAND_IN, match[0], segment, 'replace "' + match[0] + '" with your real Korean copy');
    }
    for (const match of segment.text.matchAll(koreanMarkerPattern)) {
      if (!markerIsStandIn(segment.text, match.index, match.index + match[0].length)) continue;
      add(KINDS.STAND_IN, match[0], segment, 'replace "' + match[0] + '" with your real Korean copy');
    }
    if (!lorem && segment.text.trim() === 'Lorem') {
      add(KINDS.STAND_IN, 'Lorem', segment, 'replace "Lorem" with your real copy');
    }
    for (const match of segment.text.matchAll(tokenPattern)) {
      add(
        KINDS.TEMPLATE_TOKEN,
        match[0],
        segment,
        'replace "' + match[0] + '" with your real ' + humanizeToken(match[0]),
      );
    }
    for (const match of segment.text.matchAll(brandPattern)) {
      add(KINDS.BRAND_DEFAULT, match[0], segment, 'replace "' + match[0] + '" with your real brand name');
    }
    if (/^Untitled$/i.test(segment.text) && ['title', 'h1', 'h2', 'input[value]'].includes(segment.tag)) {
      add(KINDS.BRAND_DEFAULT, segment.text, segment, 'replace "' + segment.text + '" with your real page or brand title');
    }
  }

  const headingGroups = new Map();
  for (const match of source.matchAll(/<h([12])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi)) {
    const tag = 'h' + match[1];
    const text = plainText(match[2]);
    const segment = { raw: match[2], offset: match.index, tag };
    if (!text) {
      add(KINDS.EMPTY_HEADING, '(empty)', segment, 'replace empty ' + tag + ' with your real section heading');
      continue;
    }
    const key = text.toLocaleLowerCase();
    if (!headingGroups.has(key)) headingGroups.set(key, []);
    headingGroups.get(key).push({ text, segment, start: match.index, end: match.index + match[0].length });
  }
  for (const group of headingGroups.values()) {
    if (group.length < 2) continue;
    const standInLike = /^(?:heading|section\s+title|title|제목|섹션\s*제목|내용\s*제목)$/i.test(group[0].text);
    const adjacent = group.some((entry, index) => {
      if (index === 0) return false;
      return source.slice(group[index - 1].end, entry.start).trim() === '';
    });
    if (!standInLike && !adjacent) continue;
    const lines = group.map(({ segment }) => lineAt(html, segment.offset));
    add(
      KINDS.DUPLICATE_HEADING,
      group[0].text,
      group[0].segment,
      'replace repeated "' + group[0].text + '" headings with your real section headings',
      { lines },
    );
  }

  items.sort((a, b) => a.location.line - b.location.line || a.kind.localeCompare(b.kind));
  return {
    status: items.length ? 'gaps-detected' : 'clean',
    zeroNetwork: true,
    page,
    gapCount: items.length,
    items,
    errors: [],
  };
}

function main() {
  try {
    process.stdout.write(JSON.stringify(detectCopyTokenGaps(process.argv[2]), null, 2) + '\n');
  } catch (error) {
    process.stdout.write(JSON.stringify({
      status: 'unavailable',
      zeroNetwork: true,
      page: process.argv[2] ? path.resolve(process.argv[2]) : null,
      gapCount: 0,
      items: [],
      errors: [{ source: 'detector', error: String(error && error.message || error).replace(/\s+/g, ' ').slice(0, 1200) }],
    }, null, 2) + '\n');
  }
}

if (require.main === module) main();

module.exports = { KINDS, detectCopyTokenGaps };
