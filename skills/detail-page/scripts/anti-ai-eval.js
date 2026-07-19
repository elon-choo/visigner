#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { mechanicalScore, readBrandLintReport } = require(path.join(__dirname, 'mechanical-score.js'));
const {
  detectPlaceholderShipped,
  detectEmDashFlood,
  detectScrollCue,
  detectDuplicateCtaIntent,
  detectGenericCta,
} = require(path.join(__dirname, 'copy-detectors.js'));

const REPORT_NAME = 'anti-ai-report.json';
const HARNESS_VERSION = '1.2.1';
const SKILL_ROOT = path.resolve(__dirname, '..');
const LEXICON_PATH = path.join(__dirname, 'design-lexicon.json');
const TELLS_PATH = path.join(SKILL_ROOT, 'references', 'anti-ai-tells.md');

const LABEL_CLASS_RE = /(?:^|-)(?:eyebrow|kicker|caption|cap|tag|label|meta|reg|clock|seat|id|num|code)(?:-|$)/i;
const CHIP_CLASS_RE = /(?:^|-)(?:chip|tag|badge|pill|lozenge)(?:-|$)/i;
const AVATAR_CLASS_RE = /(?:^|-)(?:avatar|initial|letter|axis-chip|monogram|seal)(?:-|$)/i;
const COLOR_OR_LAYOUT_CLASS_RE = /^(?:band|bg|text|surface|paper|mint|ink|green|primary|accent|muted|line|card|dark|light)(?:-|$)/i;
const IGNORE_STRUCTURE_TAGS = new Set(['script', 'style', 'path', 'defs', 'use', 'br', 'source', 'meta', 'link']);
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const SECTION_BLOCK_TAGS = new Set(['section', 'article', 'div', 'aside', 'header', 'footer']);
const FRAME_LOOP_TAGS = new Set(['div', 'section', 'article', 'aside', 'figure', 'header', 'footer']);

function fail(message, code) {
  process.stderr.write(`anti-ai-eval: ${message}\n`);
  process.exit(code || 1);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        args[a.slice(2, eq)] = a.slice(eq + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        args[a.slice(2)] = argv[++i];
      } else {
        args[a.slice(2)] = true;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function usage() {
  return [
    'usage: node anti-ai-eval.js <page.html> [--run run.json] [--tiles dir] [--manifest manifest.json]',
    '       [--brand-lint brand-lint.json]   fold token-discipline findings into mechanicalScore (fails open)',
    '       [--recipe recipe.md] [--category category] [--grounding librarian-out.md]',
    '',
    'Writes ./anti-ai-report.json and prints a compact summary.',
  ].join('\n');
}

function readText(file, label) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (e) {
    fail(`cannot read ${label || file}: ${file} (${e.code || e.message})`);
  }
}

function readJson(file, label) {
  const raw = readText(file, label);
  try {
    return JSON.parse(raw);
  } catch (e) {
    fail(`${label || file} is not valid JSON: ${e.message}`);
  }
}

function optionalReadJson(file, label) {
  if (!file) return null;
  return readJson(path.resolve(file), label);
}

function loadSources() {
  const lexicon = readJson(LEXICON_PATH, 'design-lexicon.json');
  const tellDoc = readText(TELLS_PATH, 'anti-ai-tells.md');
  lexicon.antiTells = Array.isArray(lexicon.antiTells) ? lexicon.antiTells : [];
  return { lexicon, tellDoc };
}

function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, ' ');
}

function stripScriptsAndStyles(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
}

function stripDataUris(s) {
  return String(s || '').replace(/\b(src|href)\s*=\s*(["'])data:[\s\S]*?\2/gi, '$1=$2[data-uri]$2');
}

function stripTags(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ');
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function compactSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function snippet(s, n) {
  return compactSpace(stripDataUris(s)).slice(0, n || 220);
}

function parseAttrs(attrText) {
  const attrs = {};
  const re = /([:@\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(attrText || ''))) {
    attrs[m[1].toLowerCase()] = m[2] != null ? m[2] : (m[3] != null ? m[3] : (m[4] != null ? m[4] : true));
  }
  return attrs;
}

function classListFromAttrs(attrs) {
  return String(attrs.class || '').split(/\s+/).map((s) => s.trim()).filter(Boolean);
}

function isRemoteHref(href) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(String(href || ''));
}

function localStylesheetPath(href, page) {
  const raw = String(href || '').trim();
  if (!raw || raw.startsWith('#') || isRemoteHref(raw)) return null;
  const clean = raw.split('#')[0].split('?')[0];
  if (!clean) return null;
  return path.resolve(path.dirname(page), clean);
}

function extractStyleBlocks(html, page, externalCssSkipped) {
  const out = [];
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  const linkRe = /<link\b([^>]*)>/gi;
  while ((m = linkRe.exec(html))) {
    const attrs = parseAttrs(m[1]);
    const rel = String(attrs.rel || '').toLowerCase();
    const href = attrs.href && attrs.href !== true ? String(attrs.href) : '';
    if (!/\bstylesheet\b/.test(rel) || !href) continue;
    if (isRemoteHref(href)) {
      externalCssSkipped.push({ href, reason: 'remote-url' });
      continue;
    }
    const cssPath = localStylesheetPath(href, page);
    if (!cssPath) continue;
    try {
      out.push(fs.readFileSync(cssPath, 'utf8'));
    } catch (e) {
      externalCssSkipped.push({ href, path: cssPath, reason: e.code || e.message });
    }
  }
  return out.join('\n');
}

function parseCss(css) {
  const vars = {};
  const varRe = /(--[\w-]+)\s*:\s*([^;{}]+);/g;
  let vm;
  while ((vm = varRe.exec(css))) vars[vm[1]] = compactSpace(vm[2]);

  const classes = new Map();
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let rm;
  while ((rm = ruleRe.exec(css))) {
    const selector = rm[1];
    const body = compactSpace(rm[2]);
    const clsRe = /\.(-?[_a-zA-Z][\w-]*)/g;
    let cm;
    while ((cm = clsRe.exec(selector))) {
      const name = cm[1];
      classes.set(name, (classes.get(name) || '') + ' ' + body);
    }
  }
  return { vars, classes };
}

function resolveVars(value, vars, depth) {
  let out = String(value || '');
  if ((depth || 0) > 8) return out;
  return out.replace(/var\(\s*(--[\w-]+)(?:\s*,\s*([^)]+))?\)/g, (_, name, fallback) => {
    if (Object.prototype.hasOwnProperty.call(vars, name)) return resolveVars(vars[name], vars, (depth || 0) + 1);
    return fallback || '';
  });
}

function styleFor(classList, inlineStyle, css) {
  const parts = [];
  for (const cls of classList || []) {
    if (css.classes.has(cls)) parts.push(css.classes.get(cls));
  }
  if (inlineStyle) parts.push(inlineStyle);
  return resolveVars(parts.join('; '), css.vars);
}

function propValue(style, prop) {
  const re = new RegExp(`(?:^|;)\\s*${prop.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*:\\s*([^;]+)`, 'i');
  const m = String(style || '').match(re);
  return m ? m[1].trim() : '';
}

function maxPx(value) {
  const vals = [];
  let m;
  const px = /(-?\d+(?:\.\d+)?)px/gi;
  while ((m = px.exec(value || ''))) vals.push(Number(m[1]));
  const rem = /(-?\d+(?:\.\d+)?)rem/gi;
  while ((m = rem.exec(value || ''))) vals.push(Number(m[1]) * 16);
  return vals.length ? Math.max.apply(null, vals) : null;
}

function stylePx(style, prop) {
  return maxPx(propValue(style, prop));
}

function attrPx(attrs, name) {
  const v = attrs && attrs[name];
  if (v == null || v === true) return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function borderWidthPx(style) {
  const bw = stylePx(style, 'border-width');
  if (bw != null) return bw;
  const b = propValue(style, 'border');
  return maxPx(b);
}

function countBucketValue(count) {
  if (count <= 0) return '0';
  if (count === 1) return '1';
  if (count <= 3) return '2-3';
  return '4+';
}

function textVolumeBucket(length) {
  if (length <= 0) return '0';
  if (length <= 40) return 'xs';
  if (length <= 120) return 'sm';
  if (length <= 280) return 'md';
  return 'lg';
}

function tagGroup(tag) {
  if (/^h[1-3]$/.test(tag)) return 'heading';
  if (/^(?:img|picture|video|svg|canvas)$/.test(tag)) return 'media';
  if (/^(?:ul|ol|dl|li|tr|table|tbody|thead)$/.test(tag)) return 'repeat';
  if (/^(?:p|span|strong|em|small|figcaption|blockquote)$/.test(tag)) return 'text';
  if (/^(?:a|button|input|select|textarea|form)$/.test(tag)) return 'control';
  return 'block';
}

function countMatches(s, re) {
  const m = String(s || '').match(re);
  return m ? m.length : 0;
}

function repeatedCardCount(html) {
  const structural = countMatches(html, /<(?:article|section|figure|aside)\b/gi);
  const divs = countMatches(html, /<div\b/gi);
  const headings = countMatches(html, /<h[1-4]\b/gi);
  return structural + (divs >= 3 && headings >= 2 ? Math.floor(divs / 3) : 0);
}

function topologyForHtml(html, tag) {
  const clean = stripDataUris(stripScriptsAndStyles(stripComments(html || '')));
  const headingCount = countMatches(clean, /<h[1-3]\b/gi) + (/^h[1-3]$/.test(tag) ? 1 : 0);
  const mediaCount = countMatches(clean, /<(?:img|picture|video|svg|canvas)\b/gi) +
    (/^(?:img|picture|video|svg|canvas)$/.test(tag) ? 1 : 0);
  const repeatCount = countMatches(clean, /<(?:li|tr)\b/gi) + repeatedCardCount(clean);
  const textLength = compactSpace(decodeEntities(stripTags(clean))).length;
  const topology = {
    tag: tagGroup(tag),
    heading: headingCount > 0 ? '1' : '0',
    media: countBucketValue(mediaCount),
    repeat: countBucketValue(repeatCount),
    text: textVolumeBucket(textLength),
  };
  topology.key = `${topology.tag}|h:${topology.heading}|m:${topology.media}|r:${topology.repeat}|t:${topology.text}`;
  return topology;
}

function topologyForElement(sectionBody, tag, openStart, openEnd) {
  let fragment = '';
  if (!VOID_TAGS.has(tag)) {
    const close = findClosingTag(sectionBody, tag, openStart);
    if (close && close.start >= openEnd) {
      fragment = sectionBody.slice(openEnd, close.start);
    } else {
      const next = sectionBody.indexOf('<', openEnd);
      fragment = sectionBody.slice(openEnd, next === -1 ? sectionBody.length : next);
    }
  }
  return topologyForHtml(fragment, tag);
}

function frameBorderWidthPx(style) {
  const border = propValue(style, 'border');
  const shorthand = maxPx(border);
  if (shorthand != null) return shorthand;

  const borderWidth = propValue(style, 'border-width');
  const width = maxPx(borderWidth);
  if (width != null) return width;

  const top = stylePx(style, 'border-top-width') || maxPx(propValue(style, 'border-top'));
  const right = stylePx(style, 'border-right-width') || maxPx(propValue(style, 'border-right'));
  const bottom = stylePx(style, 'border-bottom-width') || maxPx(propValue(style, 'border-bottom'));
  const left = stylePx(style, 'border-left-width') || maxPx(propValue(style, 'border-left'));
  if (top != null && right != null && bottom != null && left != null) return Math.max(top, right, bottom, left);
  return null;
}

function normalizeCssColor(value) {
  const s = compactSpace(String(value || '').toLowerCase()).replace(/\s*,\s*/g, ',');
  const fn = s.match(/\b(?:rgba?|hsla?)\([^)]+\)/);
  if (fn) return fn[0];
  const hex = s.match(/#[0-9a-f]{3,8}\b/);
  if (hex) return hex[0];
  const named = s.match(/\b(?:transparent|currentcolor|black|white|gray|grey|red|green|blue|navy|teal|cyan|magenta|yellow|orange|purple|pink|brown)\b/);
  if (named) return named[0];
  const cleaned = s
    .replace(/\b(?:solid|dashed|dotted|double|none|inset|outset|ridge|groove)\b/g, ' ')
    .replace(/-?\d+(?:\.\d+)?(?:px|rem|em|%)\b/g, ' ');
  return compactSpace(cleaned) || 'unknown';
}

function normalizeBorderColor(style) {
  return normalizeCssColor(propValue(style, 'border-color') || propValue(style, 'border'));
}

function parseOklchColor(value) {
  const m = String(value || '').match(/oklch\(\s*([0-9.]+%?)\s+([0-9.]+%?)\s+([0-9.]+)(?:deg)?(?:\s*\/\s*([0-9.]+%?))?\s*\)/i);
  if (!m) return null;
  const l = String(m[1]).endsWith('%') ? Number.parseFloat(m[1]) / 100 : Number.parseFloat(m[1]);
  const c = String(m[2]).endsWith('%') ? Number.parseFloat(m[2]) / 100 : Number.parseFloat(m[2]);
  const h = ((Number.parseFloat(m[3]) % 360) + 360) % 360;
  const alpha = m[4] ? (String(m[4]).endsWith('%') ? Number.parseFloat(m[4]) / 100 : Number.parseFloat(m[4])) : 1;
  if (![l, c, h, alpha].every(Number.isFinite)) return null;
  return { l, c, h, alpha, raw: compactSpace(m[0].toLowerCase()) };
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      default: h = ((r - g) / d + 4) * 60; break;
    }
  }
  return { l, c: s * 0.16, h, alpha: 1 };
}

function parseHexColor(value) {
  const m = String(value || '').match(/#([0-9a-f]{3,8})\b/i);
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3 || hex.length === 4) hex = hex.split('').map((ch) => ch + ch).join('');
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  if (![r, g, b].every(Number.isFinite)) return null;
  const out = rgbToHsl(r, g, b);
  out.raw = `#${m[1].toLowerCase()}`;
  if (hex.length >= 8) out.alpha = Number.parseInt(hex.slice(6, 8), 16) / 255;
  return out;
}

function parseRgbColor(value) {
  const m = String(value || '').match(/rgba?\(\s*([0-9.]+)\s*,?\s+([0-9.]+)\s*,?\s+([0-9.]+)(?:\s*[,/]\s*([0-9.]+%?))?\s*\)/i);
  if (!m) return null;
  const r = Number.parseFloat(m[1]);
  const g = Number.parseFloat(m[2]);
  const b = Number.parseFloat(m[3]);
  if (![r, g, b].every(Number.isFinite)) return null;
  const out = rgbToHsl(r, g, b);
  out.raw = compactSpace(m[0].toLowerCase());
  if (m[4]) out.alpha = String(m[4]).endsWith('%') ? Number.parseFloat(m[4]) / 100 : Number.parseFloat(m[4]);
  return out;
}

function parseNamedColor(value) {
  const named = {
    black: [0, 0, 0],
    white: [255, 255, 255],
    red: [255, 0, 0],
    green: [0, 128, 0],
    blue: [0, 0, 255],
    orange: [255, 165, 0],
    yellow: [255, 255, 0],
    brown: [150, 75, 0],
    purple: [128, 0, 128],
    pink: [255, 192, 203],
    gray: [128, 128, 128],
    grey: [128, 128, 128],
  };
  const key = compactSpace(String(value || '').toLowerCase());
  if (!Object.prototype.hasOwnProperty.call(named, key)) return null;
  const out = rgbToHsl(...named[key]);
  out.raw = key;
  return out;
}

function parseCssColorValue(value) {
  return parseOklchColor(value) || parseHexColor(value) || parseRgbColor(value) || parseNamedColor(value);
}

function colorValuesFromStyle(style) {
  const out = [];
  const re = /oklch\([^)]+\)|rgba?\([^)]+\)|#[0-9a-f]{3,8}\b|\b(?:black|white|gray|grey|red|green|blue|orange|yellow|brown|purple|pink)\b/gi;
  let m;
  while ((m = re.exec(String(style || '')))) out.push(m[0]);
  return out;
}

function circularHueSpan(hues) {
  if (hues.length <= 1) return 0;
  const sorted = hues.map((h) => ((h % 360) + 360) % 360).sort((a, b) => a - b);
  let largestGap = 0;
  for (let i = 0; i < sorted.length; i++) {
    const next = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + 360;
    largestGap = Math.max(largestGap, next - sorted[i]);
  }
  return 360 - largestGap;
}

function hueBucket(hue, size) {
  return Math.round((((hue % 360) + 360) % 360) / (size || 24));
}

function detectPaletteMonotony(ctx) {
  const seen = new Map();
  const addValues = (values, source) => {
    for (const raw of values) {
      const parsed = parseCssColorValue(raw);
      if (!parsed || parsed.alpha <= 0.05) continue;
      const key = parsed.raw || compactSpace(String(raw).toLowerCase());
      if (!seen.has(key)) seen.set(key, { ...parsed, source });
    }
  };

  addValues(Object.values(ctx.css.vars), 'vars');
  const usedClasses = new Set();
  for (const el of ctx.elements) for (const cls of el.classList || []) usedClasses.add(cls);
  for (const cls of usedClasses) {
    if (ctx.css.classes.has(cls)) addValues(colorValuesFromStyle(resolveVars(ctx.css.classes.get(cls), ctx.css.vars)), `.${cls}`);
  }
  for (const el of ctx.elements) if (el.style) addValues(colorValuesFromStyle(resolveVars(el.style, ctx.css.vars)), 'inline');

  const colors = [...seen.values()];
  const chromatic = colors.filter((c) => c.c >= 0.02);
  if (colors.length < 8 || chromatic.length < 6 || ctx.contentSections.length < 5) return null;

  const hues = chromatic.map((c) => c.h);
  const span = circularHueSpan(hues);
  const warmCount = chromatic.filter((c) => c.h >= 20 && c.h <= 105).length;
  const warmRatio = warmCount / chromatic.length;
  const hueBuckets = new Set(chromatic.map((c) => hueBucket(c.h, 24)));
  const accentBuckets = new Set(chromatic.filter((c) => c.c >= 0.12).map((c) => hueBucket(c.h, 18)));
  const neutralRatio = colors.filter((c) => c.c < 0.02).length / colors.length;

  if (!(span <= 82 && warmRatio >= 0.82 && hueBuckets.size <= 4 && accentBuckets.size <= 1)) return null;
  return {
    tell: 'palette-monotony',
    severity: 'low',
    evidence: {
      uniqueColors: colors.length,
      chromaticColors: chromatic.length,
      hueSpan: Number(span.toFixed(1)),
      warmHueRatio: Number(warmRatio.toFixed(2)),
      hueBuckets: hueBuckets.size,
      accentHueBuckets: accentBuckets.size,
      neutralRatio: Number(neutralRatio.toFixed(2)),
      samples: colors.slice(0, 10).map((c) => ({ color: c.raw, h: Number(c.h.toFixed(1)), c: Number(c.c.toFixed(3)), source: c.source })),
      source: sourceTell(ctx, ['acid-green', 'palette', 'near-black']),
    },
  };
}

function isMonoStyle(style) {
  const s = String(style || '').toLowerCase();
  return /font-family\s*:/.test(s) && (
    /monospace|ui-monospace|sfmono|menlo|consolas|courier/.test(s) ||
    /ibm plex mono|space mono|jetbrains mono|source code pro|fira code|dm mono/.test(s)
  );
}

function isSmallStyle(style) {
  const size = stylePx(style, 'font-size');
  return size != null && size <= 14.5;
}

function hasLetterSpacing(style) {
  return /letter-spacing\s*:\s*(?!0\b)[^;]+/i.test(style || '');
}

function extractElements(html) {
  const markup = stripScriptsAndStyles(html);
  const elements = [];
  const re = /<([a-z][\w:-]*)\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(markup))) {
    const tag = m[1].toLowerCase();
    if (tag.startsWith('!') || tag === 'html' || tag === 'head') continue;
    const attrs = parseAttrs(m[2]);
    const end = re.lastIndex;
    const nextLt = markup.indexOf('<', end);
    const text = nextLt === -1 ? '' : decodeEntities(markup.slice(end, nextLt));
    elements.push({
      tag,
      attrs,
      classList: classListFromAttrs(attrs),
      style: attrs.style && attrs.style !== true ? attrs.style : '',
      index: m.index,
      open: m[0],
      text: compactSpace(text),
    });
  }
  return elements;
}

function extractPairedElements(html) {
  const markup = stripScriptsAndStyles(html);
  const out = [];
  const re = /<(span|div|p|li|a|figcaption)\b([^>]*)>([^<]{0,240})<\/\1>/gi;
  let m;
  while ((m = re.exec(markup))) {
    const attrs = parseAttrs(m[2]);
    out.push({
      tag: m[1].toLowerCase(),
      attrs,
      classList: classListFromAttrs(attrs),
      style: attrs.style && attrs.style !== true ? attrs.style : '',
      body: m[3],
      text: compactSpace(decodeEntities(stripTags(m[3]))),
      index: m.index,
      snippet: snippet(m[0], 220),
    });
  }
  return out;
}

function sectionFromMatch(tag, attrsText, body, index, detection) {
  const attrs = parseAttrs(attrsText);
  const bodyNoComments = stripComments(body);
  const cleanBody = stripScriptsAndStyles(bodyNoComments);
  const visibleText = compactSpace(decodeEntities(stripTags(cleanBody)));
  const tagCount = (cleanBody.match(/<[a-z][\w:-]*\b/gi) || []).length;
  return {
    attrs,
    classList: classListFromAttrs(attrs),
    body,
    index,
    open: `<${tag}${attrsText}>`,
    textLength: visibleText.length,
    tagCount,
    detection,
  };
}

function extractTagSections(html, tag, detection) {
  const sections = [];
  const re = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let m;
  while ((m = re.exec(html))) {
    sections.push(sectionFromMatch(tag, m[1], m[2], m.index, detection));
  }
  return sections;
}

function findClosingTag(markup, tag, openStart) {
  const re = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
  re.lastIndex = openStart;
  let depth = 0;
  let m;
  while ((m = re.exec(markup))) {
    const token = m[0];
    const closing = /^<\//.test(token);
    const selfClosing = /\/>$/.test(token) || VOID_TAGS.has(tag);
    if (closing) {
      depth--;
      if (depth === 0) return { start: m.index, end: re.lastIndex };
    } else if (!selfClosing) {
      depth++;
    }
  }
  return null;
}

function extractDirectBlocksFromContainer(containerBody, offset, detection) {
  const sections = [];
  const re = /<([a-z][\w:-]*)\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(containerBody))) {
    const tag = m[1].toLowerCase();
    if (!SECTION_BLOCK_TAGS.has(tag)) continue;
    const close = findClosingTag(containerBody, tag, m.index);
    if (!close) continue;
    const body = containerBody.slice(re.lastIndex, close.start);
    sections.push(sectionFromMatch(tag, m[2], body, offset + m.index, detection));
    re.lastIndex = close.end;
  }
  return sections;
}

function extractMainArticleDirectSections(html) {
  const out = [];
  for (const tag of ['main', 'article']) {
    const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    let m;
    while ((m = re.exec(html))) {
      const bodyStart = m.index + m[0].indexOf(m[1]);
      out.push(...extractDirectBlocksFromContainer(m[1], bodyStart, 'main-article-blocks'));
    }
  }
  return out;
}

function extractRegionSections(html) {
  const out = [];
  const re = /<(section|article|main|aside|div|header|footer)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (!/(?:\brole\s*=\s*(?:"region"|'region'|region)|\baria-labelledby\s*=)/i.test(m[2])) continue;
    out.push(sectionFromMatch(m[1].toLowerCase(), m[2], m[3], m.index, 'region-aria'));
  }
  return out;
}

function extractHeadingSections(html) {
  const clean = stripScriptsAndStyles(html);
  const headings = [];
  const re = /<h([1-3])\b([^>]*)>[\s\S]*?<\/h\1>/gi;
  let m;
  while ((m = re.exec(clean))) headings.push({ index: m.index, end: re.lastIndex, tag: `h${m[1]}`, attrsText: m[2], open: m[0] });
  const sections = [];
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index;
    const end = i + 1 < headings.length ? headings[i + 1].index : clean.length;
    const body = clean.slice(start, end);
    sections.push(sectionFromMatch(headings[i].tag, headings[i].attrsText, body, start, 'heading-fallback'));
  }
  return sections;
}

function contentfulSections(sections) {
  return sections.filter((s) => s.textLength >= 6 && s.tagCount >= 2);
}

function extractSections(html) {
  const primary = extractTagSections(html, 'section', 'section-tags');
  if (primary.length >= 4) return { sections: primary, detection: 'section-tags' };
  const direct = extractMainArticleDirectSections(html);
  const region = extractRegionSections(html);
  const heading = extractHeadingSections(html);
  const candidates = [
    { sections: direct, detection: 'main-article-blocks' },
    { sections: region, detection: 'region-aria' },
    { sections: heading, detection: 'heading-fallback' },
    { sections: primary, detection: primary.length ? 'section-tags' : 'heading-fallback' },
  ];
  for (const candidate of candidates) {
    if (candidate.sections.length >= 4 || contentfulSections(candidate.sections).length >= 4) return candidate;
  }
  return candidates.sort((a, b) => contentfulSections(b.sections).length - contentfulSections(a.sections).length)[0];
}

function sourceTell(ctx, words) {
  const needles = Array.isArray(words) ? words : [words];
  for (const item of ctx.sources.lexicon.antiTells) {
    const tell = String(item.tell || '');
    const hay = tell.toLowerCase();
    if (needles.some((w) => hay.includes(String(w).toLowerCase()))) return tell;
  }
  const doc = String(ctx.sources.tellDoc || '').toLowerCase();
  for (const w of needles) {
    const idx = doc.indexOf(String(w).toLowerCase());
    if (idx !== -1) return snippet(ctx.sources.tellDoc.slice(Math.max(0, idx - 80), idx + 180), 180);
  }
  return null;
}

function buildContext(html, page, args, sources) {
  const cleanHtml = stripComments(html);
  const structureHtml = stripScriptsAndStyles(cleanHtml);
  const externalCssSkipped = [];
  const css = parseCss(extractStyleBlocks(html, page, externalCssSkipped));
  const sectionResult = extractSections(structureHtml);
  const sections = sectionResult.sections || [];
  const contentSections = contentfulSections(sections);
  return {
    page,
    args,
    sources,
    html,
    cleanHtml: structureHtml,
    css,
    externalCssSkipped,
    sectionDetection: sectionResult.detection,
    elements: extractElements(structureHtml),
    paired: extractPairedElements(structureHtml),
    sections,
    contentSections,
  };
}

function pushTell(out, tell, evidence, severity) {
  out.push({ tell, evidence, severity });
}

function detectMonoLabels(ctx) {
  const monoClasses = new Set();
  const labelClasses = new Set();
  for (const [cls, raw] of ctx.css.classes.entries()) {
    const style = resolveVars(raw, ctx.css.vars);
    if (isMonoStyle(style) || /\bmono\b/i.test(cls)) monoClasses.add(cls);
    if (isSmallStyle(style) || LABEL_CLASS_RE.test(cls)) labelClasses.add(cls);
  }

  const hits = [];
  const classCounts = {};
  for (const el of ctx.elements) {
    const cls = el.classList;
    if (!cls.length) continue;
    const fullStyle = styleFor(cls, el.style, ctx.css);
    const hasMono = isMonoStyle(fullStyle) || cls.some((c) => monoClasses.has(c) || /\bmono\b/i.test(c));
    if (!hasMono) continue;

    const labelRole = el.tag === 'figcaption' ||
      LABEL_CLASS_RE.test(cls.join(' ')) ||
      cls.some((c) => labelClasses.has(c)) ||
      LABEL_CLASS_RE.test(el.open);
    const smallEnough = isSmallStyle(fullStyle) || /\btext-(?:xs|sm)\b/.test(cls.join(' '));
    if (!labelRole || (!smallEnough && !hasLetterSpacing(fullStyle))) continue;

    hits.push({ el, style: fullStyle });
    for (const c of cls) {
      if (monoClasses.has(c) || labelClasses.has(c) || LABEL_CLASS_RE.test(c)) {
        classCounts[c] = (classCounts[c] || 0) + 1;
      }
    }
  }

  const denom = Math.max(1, (ctx.contentSections.length || ctx.sections.length || 1));
  const density = hits.length / denom;
  if (hits.length < 4 || density < 0.35) return null;
  const severity = hits.length >= 8 && density >= 0.55 ? 'high' : 'medium';
  return {
    tell: 'mono-label',
    severity,
    evidence: {
      count: hits.length,
      sections: denom,
      density: Number(density.toFixed(2)),
      classes: Object.entries(classCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count })),
      snippets: hits.slice(0, 5).map((h) => snippet(h.el.open + h.el.text, 180)),
      source: sourceTell(ctx, ['mono-label', 'monospace-label']),
    },
  };
}

function sectionPrefixFragment(section, maxChars) {
  const body = section.body || '';
  const heading = body.search(/<(?:h[1-3]|[a-z][\w:-]*\b[^>]*\brole\s*=\s*(?:"heading"|'heading'|heading))/i);
  const end = heading >= 0 ? Math.min(body.length, heading + 360) : Math.min(body.length, maxChars || 1100);
  return body.slice(0, end);
}

function markerLikeText(text) {
  const t = compactSpace(text);
  if (t.length < 2 || t.length > 44) return false;
  if (/(?:記錄|記録|文書|添附|寫眞|寫真|現場|人物|公開|確認|任命|案內|特典|發췌|發|発)/.test(t)) return true;
  const lead = compactSpace(t.split(/\s*[·—:|]\s*/)[0] || '');
  if (lead && lead.length <= 12 && /[가-힣A-Za-z]{2,}/.test(lead) && /[·—:|]/.test(t)) return true;
  return /^(?:기록|문서|첨부|자료|도판|증빙|임명장|라이브 안건)\s*(?:[·.]|\d)/i.test(t);
}

function labelElementsInFragment(fragment, ctx) {
  const out = [];
  const re = /<(span|p|div|figcaption|small|b|strong)\b([^>]*)>([\s\S]{0,300}?)<\/\1>/gi;
  let m;
  while ((m = re.exec(fragment || ''))) {
    const attrs = parseAttrs(m[2]);
    const classList = classListFromAttrs(attrs);
    const style = styleFor(classList, attrs.style && attrs.style !== true ? attrs.style : '', ctx.css);
    const text = compactSpace(decodeEntities(stripTags(m[3])));
    if (!text) continue;
    out.push({
      tag: m[1].toLowerCase(),
      attrs,
      classList,
      style,
      text,
      snippet: snippet(m[0], 180),
    });
  }
  return out;
}

function detectRepeatedDecorativeLabels(ctx) {
  const rows = [];
  for (let i = 0; i < ctx.contentSections.length; i++) {
    const section = ctx.contentSections[i];
    const fragment = sectionPrefixFragment(section, 1100);
    const candidates = labelElementsInFragment(fragment, ctx).filter((el) => {
      const classText = el.classList.join(' ');
      const labelRole = LABEL_CLASS_RE.test(classText) || el.tag === 'figcaption' || isSmallStyle(el.style) || hasLetterSpacing(el.style);
      if (!labelRole || !markerLikeText(el.text)) return false;
      if (/\b(?:button|cta|price|amount)\b/i.test(classText)) return false;
      return true;
    });
    if (!candidates.length) continue;
    const hit = candidates[0];
    const role = hit.classList.find((c) => LABEL_CLASS_RE.test(c)) || hit.tag;
    rows.push({ section: i + 1, role, text: hit.text, snippet: hit.snippet });
  }

  const denom = Math.max(1, ctx.contentSections.length);
  const ratio = rows.length / denom;
  const roleCounts = {};
  for (const row of rows) roleCounts[row.role] = (roleCounts[row.role] || 0) + 1;
  const topRole = Object.entries(roleCounts).sort((a, b) => b[1] - a[1])[0] || ['', 0];
  if (rows.length < 6 || ratio < 0.65 || topRole[1] < 4) return null;

  return {
    tell: 'repeated-decorative-label',
    severity: 'medium',
    evidence: {
      count: rows.length,
      sections: denom,
      coverage: Number(ratio.toFixed(2)),
      dominantRole: topRole[0],
      dominantRoleCount: topRole[1],
      labels: rows.slice(0, 10).map((row) => ({ section: row.section, text: row.text, role: row.role })),
      snippets: rows.slice(0, 5).map((row) => row.snippet),
      source: sourceTell(ctx, ['mono-label', 'eyebrow', 'garnish']),
    },
  };
}

function isPureEnLabelText(text) {
  const t = compactSpace(text);
  if (!/^[A-Za-z][A-Za-z0-9&.,'’\-·—\s]{1,30}$/.test(t)) return false;
  if (/[가-힣]/.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  return words.length >= 1 && words.length <= 4;
}

function enLabelCandidates(text) {
  const raw = compactSpace(decodeEntities(stripTags(text)));
  const out = [];
  if (isPureEnLabelText(raw)) out.push(raw);
  const lead = compactSpace(raw.split(/\s*[·—]\s*/)[0]);
  if (lead && lead !== raw && isPureEnLabelText(lead)) out.push(lead);
  return [...new Set(out)];
}

function isAllCapsLabel(text) {
  const letters = String(text || '').replace(/[^A-Za-z]/g, '');
  return letters.length >= 2 && letters === letters.toUpperCase();
}

function enLabelStyled(el, style, text, kind) {
  if (kind === 'heading') return true;
  if (kind === 'alt') return isAllCapsLabel(text);
  return /text-transform\s*:\s*uppercase/i.test(style || '') ||
    isAllCapsLabel(text) ||
    hasLetterSpacing(style) ||
    /font-variant\s*:\s*small-caps/i.test(style || '') ||
    LABEL_CLASS_RE.test((el.classList || []).join(' '));
}

// A heading set in ALL CAPS at display size is its own tell, but it is NOT a separate detector.
// enLabelStyled(..., 'heading') returns true unconditionally, so every ALL-CAPS h1-h3 already feeds
// en-label-overration's ration count. A standalone uppercase-heading detector would charge the same
// heading twice on any page with three or more of them. So it lives here, and only speaks when the
// ration tell stays silent.
//
// Display role is the discriminator: a 12px ALL-CAPS eyebrow is the label ration's business; a 48px
// ALL-CAPS h1 is the shouted heading. `text-transform: uppercase` counts even when the source text
// is not, because the reader sees the rendered form.
//
// Caveat worth knowing: styleFor resolves class rules and inline styles, not bare tag selectors, so
// `h2 { font-size: 12px }` is invisible here and such a heading is read as display size. A label
// styled that way in practice carries an eyebrow/kicker/label class, which is what LABEL_CLASS_RE
// catches.
function isUppercaseDisplayHeading(style, text, classList) {
  if (isSmallStyle(style)) return false;
  if (LABEL_CLASS_RE.test((classList || []).join(' '))) return false;
  return /text-transform\s*:\s*uppercase/i.test(style || '') || isAllCapsLabel(text);
}

function detectEnDisplayLabels(ctx) {
  const labels = new Map();
  const upperHeadings = [];
  const add = (text, snippetText) => {
    const key = compactSpace(text).toLowerCase();
    if (!labels.has(key)) labels.set(key, { text: compactSpace(text), count: 0, snippet: snippet(snippetText || text, 180) });
    labels.get(key).count++;
  };
  const skipClass = (classList) => /\b(?:btn|button|cta)\b/i.test((classList || []).join(' '));

  for (const el of ctx.paired) {
    if (['button', 'code', 'pre'].includes(el.tag)) continue;
    if (el.attrs && el.attrs['aria-hidden']) continue;
    if (skipClass(el.classList)) continue;
    const style = styleFor(el.classList, el.style, ctx.css);
    for (const text of enLabelCandidates(el.text)) {
      if (enLabelStyled(el, style, text, 'paired')) add(text, el.snippet);
    }
  }

  const headingRe = /<h([1-3])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = headingRe.exec(ctx.cleanHtml))) {
    const attrs = parseAttrs(m[2]);
    const classList = classListFromAttrs(attrs);
    if (skipClass(classList)) continue;
    const fake = { classList };
    const style = styleFor(classList, attrs.style && attrs.style !== true ? attrs.style : '', ctx.css);
    for (const text of enLabelCandidates(m[3])) {
      if (enLabelStyled(fake, style, text, 'heading')) add(text, m[0]);
      if (isUppercaseDisplayHeading(style, text, classList)) {
        upperHeadings.push({ level: Number(m[1]), text: compactSpace(text), snippet: snippet(m[0], 180) });
      }
    }
  }

  for (const el of ctx.elements) {
    if (el.tag === 'text') {
      const style = styleFor(el.classList, el.style, ctx.css);
      for (const text of enLabelCandidates(el.text)) {
        if (enLabelStyled(el, style, text, 'paired')) add(text, el.open + el.text);
      }
    }
    if (el.tag === 'img' && el.attrs && el.attrs.alt && el.attrs.alt !== true) {
      for (const text of enLabelCandidates(el.attrs.alt)) {
        if (enLabelStyled(el, '', text, 'alt')) add(text, el.open);
      }
    }
  }

  const rows = [...labels.values()].sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));
  if (rows.length >= 3) {
    return {
      tell: 'en-label-overration',
      severity: rows.length >= 5 ? 'medium' : 'low',
      evidence: {
        distinct: rows.length,
        occurrences: rows.reduce((sum, row) => sum + row.count, 0),
        labels: rows.slice(0, 8).map((row) => ({ text: row.text, count: row.count, snippet: row.snippet })),
        ration: '1-2 per page — masthead + at most one divider',
        source: sourceTell(ctx, ['EN label', 'rationed']),
      },
    };
  }

  // The ration tell stayed silent, so any shouted display heading has not been charged yet.
  if (!upperHeadings.length) return null;
  return {
    tell: 'uppercase-heading',
    severity: upperHeadings.length >= 2 ? 'medium' : 'low',
    evidence: {
      count: upperHeadings.length,
      headings: upperHeadings.slice(0, 8),
      dedupe: 'suppressed when en-label-overration fires — the same heading feeds that ration count',
      source: sourceTell(ctx, ['EN label', 'rationed']),
    },
  };
}

function detectBrowserMockups(ctx) {
  const hits = [];
  const re = /<([a-z][\w:-]*)\b([^>]*class\s*=\s*(?:"[^"]*(?:browser-bar|window-chrome|window-bar|chrome-bar|traffic-light)[^"]*"|'[^']*(?:browser-bar|window-chrome|window-bar|chrome-bar|traffic-light)[^']*')[^>]*)>([\s\S]{0,500}?)<\/\1>/gi;
  let m;
  while ((m = re.exec(ctx.cleanHtml))) {
    const body = m[3] || '';
    const emptyDotCount = (body.match(/<(?:i|span|b)\b[^>]*>\s*<\/(?:i|span|b)>/gi) || []).length;
    const dotClassCount = (body.match(/class\s*=\s*(?:"[^"]*(?:dot|traffic)[^"]*"|'[^']*(?:dot|traffic)[^']*')/gi) || []).length;
    if (emptyDotCount >= 3 || dotClassCount >= 3 || /browser-bar|window-chrome|traffic-light/i.test(m[2])) {
      hits.push(snippet(m[0], 220));
    }
  }

  const generic = [];
  const gRe = /<([a-z][\w:-]*)\b([^>]*)>([\s\S]{0,360}?)<\/\1>/gi;
  while ((m = gRe.exec(ctx.cleanHtml))) {
    if (!/\b(?:aria-hidden|role|class)\b/i.test(m[2])) continue;
    const body = m[3] || '';
    const dots = (body.match(/<(?:i|span|b)\b[^>]*(?:style\s*=\s*(?:"[^"]*(?:width|height)\s*:\s*\d+px[^"]*"|'[^']*(?:width|height)\s*:\s*\d+px[^']*'))?[^>]*>\s*<\/(?:i|span|b)>/gi) || []).length;
    if (dots >= 3 && /browser|window|chrome|traffic/i.test(m[0])) generic.push(snippet(m[0], 220));
  }
  for (const s of generic) if (!hits.includes(s)) hits.push(s);

  if (hits.length < 2) return null;
  return {
    tell: 'browser-mockup',
    severity: hits.length >= 4 ? 'high' : 'medium',
    evidence: {
      count: hits.length,
      repeatedChrome: true,
      snippets: hits.slice(0, 5),
      source: sourceTell(ctx, ['browser/window', 'window-chrome', 'browser']),
    },
  };
}

function detectGhostNumerals(ctx) {
  const hits = [];
  const textRe = /<text\b([^>]*)>([\s\S]{0,40}?)<\/text>/gi;
  let m;
  while ((m = textRe.exec(ctx.cleanHtml))) {
    const attrs = parseAttrs(m[1]);
    const rawText = compactSpace(stripTags(m[2]));
    if (!/^\d{1,4}$/.test(rawText)) continue;
    const attrText = m[1];
    const fillNone = /\bfill\s*=\s*(?:"none"|'none')/i.test(attrText) || /fill\s*:\s*(?:none|transparent)/i.test(attrText);
    const hasStroke = /\bstroke\s*=/i.test(attrText) || /(?:^|;)\\s*(?:-webkit-)?text-stroke\s*:/i.test(attrText);
    const fontSize = attrPx(attrs, 'font-size') || maxPx(attrText) || 0;
    const ghostClass = /ghost|outline|stroke/i.test(String(attrs.class || ''));
    if ((fillNone && hasStroke && fontSize >= 80) || (ghostClass && fontSize >= 80)) {
      hits.push({ value: rawText, fontSize, snippet: snippet(m[0], 220) });
    }
  }

  for (const el of ctx.elements) {
    const text = compactSpace(el.text);
    if (!/^\d{1,4}$/.test(text)) continue;
    const style = styleFor(el.classList, el.style, ctx.css);
    const fontSize = stylePx(style, 'font-size') || 0;
    const outlined = /(?:-webkit-)?text-stroke\s*:/i.test(style) ||
      /-webkit-text-fill-color\s*:\s*transparent/i.test(style) ||
      /ghost|outline|stroke/i.test(el.classList.join(' '));
    if (outlined && fontSize >= 64) {
      const snip = snippet(el.open + text, 220);
      if (!hits.some((h) => h.snippet === snip)) hits.push({ value: text, fontSize, snippet: snip });
    }
  }

  if (!hits.length) return null;
  return {
    tell: 'ghost-numeral',
    severity: 'high',
    evidence: {
      count: hits.length,
      numerals: hits.map((h) => h.value),
      snippets: hits.slice(0, 4).map((h) => h.snippet),
      source: sourceTell(ctx, ['ghosted outline numeral', 'outline numeral']),
    },
  };
}

function baseChipClass(classList) {
  const hit = (classList || []).find((c) => CHIP_CLASS_RE.test(c));
  return hit || null;
}

function detectOutlineChips(ctx) {
  const groups = {};
  const examples = {};
  for (const el of ctx.elements) {
    const base = baseChipClass(el.classList);
    if (!base) continue;
    const style = styleFor(el.classList, el.style, ctx.css);
    const bw = borderWidthPx(style);
    const classText = el.classList.join(' ');
    const isChipLike = CHIP_CLASS_RE.test(classText);
    if (!isChipLike || bw == null || bw > 2.1) continue;
    const bg = propValue(style, 'background') || propValue(style, 'background-color');
    const filled = bg && !/transparent|none|var\(--(?:color-)?(?:surface|paper|card|mint)\)/i.test(bg);
    if (filled && /fill/i.test(classText)) continue;
    const key = `${base}|border:${bw}`;
    groups[key] = (groups[key] || 0) + 1;
    if (!examples[key]) examples[key] = snippet(el.open + (el.text || ''), 180);
  }

  const top = Object.entries(groups).sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] < 4) return null;
  const [key, count] = top;
  return {
    tell: 'outline-chip',
    severity: count >= 8 ? 'high' : 'medium',
    evidence: {
      repeatedClass: key.split('|')[0],
      count,
      groups: Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([signature, n]) => ({ signature, count: n })),
      snippets: [examples[key]].filter(Boolean),
      source: sourceTell(ctx, ['outline chips', 'thin-outline chips']),
    },
  };
}

function sectionOrdinalForElement(ctx, el) {
  for (let i = 0; i < ctx.contentSections.length; i++) {
    const section = ctx.contentSections[i];
    const start = section.index;
    const end = section.index + section.open.length + section.body.length;
    if (el.index >= start && el.index <= end) return i;
  }
  return -1;
}

function detectUniformFrameLoop(ctx) {
  const groups = {};
  const sections = {};
  const examples = {};
  for (const el of ctx.elements) {
    if (!FRAME_LOOP_TAGS.has(el.tag)) continue;
    if (CHIP_CLASS_RE.test(el.classList.join(' '))) continue;
    const style = styleFor(el.classList, el.style, ctx.css);
    const bw = frameBorderWidthPx(style);
    if (bw == null || bw < 0.5 || bw > 2.5) continue;

    const signature = `${Math.round(bw)}px|${normalizeBorderColor(style)}`;
    groups[signature] = (groups[signature] || 0) + 1;
    if (!sections[signature]) sections[signature] = new Set();
    const sectionOrdinal = sectionOrdinalForElement(ctx, el);
    if (sectionOrdinal !== -1) sections[signature].add(sectionOrdinal);
    if (!examples[signature]) examples[signature] = snippet(el.open + (el.text || ''), 180);
  }

  const ranked = Object.entries(groups)
    .map(([signature, count]) => ({ signature, count, sections: sections[signature] ? sections[signature].size : 0 }))
    .sort((a, b) => b.count - a.count || b.sections - a.sections);
  const top = ranked.find((item) => item.count >= 8 && item.sections >= 4);
  if (!top) return null;
  return {
    tell: 'uniform-frame-loop',
    severity: 'medium',
    evidence: {
      signature: top.signature,
      count: top.count,
      sections: top.sections,
      groups: ranked.slice(0, 6),
      snippets: [examples[top.signature]].filter(Boolean),
      source: sourceTell(ctx, ['uniform frame', 'repeated frame', 'border loop']),
    },
  };
}

function isSingleLetter(text) {
  const t = compactSpace(text);
  return /^[A-Z0-9]$/.test(t) || /^[가-힣]$/.test(t);
}

function detectLetterSquareAvatars(ctx) {
  const groups = {};
  const examples = {};
  for (const el of ctx.paired) {
    if (!isSingleLetter(el.text)) continue;
    const classText = el.classList.join(' ');
    if (!AVATAR_CLASS_RE.test(classText)) continue;
    const style = styleFor(el.classList, el.style, ctx.css);
    const w = stylePx(style, 'width') || attrPx(el.attrs, 'width');
    const h = stylePx(style, 'height') || attrPx(el.attrs, 'height');
    const squareBySize = w != null && h != null && Math.abs(w - h) <= 4 && Math.max(w, h) <= 120;
    const squareByRule = /aspect-ratio\s*:\s*1\s*\/\s*1/i.test(style) || /axis-chip|avatar|initial|letter/i.test(classText);
    if (!squareBySize && !squareByRule) continue;
    const key = el.classList.find((c) => AVATAR_CLASS_RE.test(c)) || classText;
    groups[key] = (groups[key] || 0) + 1;
    if (!examples[key]) examples[key] = el.snippet;
  }

  const top = Object.entries(groups).sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] < 4) return null;
  const [key, count] = top;
  return {
    tell: 'letter-square-avatar',
    severity: count >= 6 ? 'high' : 'medium',
    evidence: {
      repeatedClass: key,
      count,
      groups: Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, n]) => ({ name, count: n })),
      snippets: [examples[key]].filter(Boolean),
      source: sourceTell(ctx, ['letter-square', 'placeholder avatars']),
    },
  };
}

function localAssetPath(src, page) {
  const raw = String(src || '').trim();
  if (!raw || raw.startsWith('#') || isRemoteHref(raw)) return null;
  const clean = raw.split('#')[0].split('?')[0];
  if (!clean) return null;
  return path.resolve(path.dirname(page), clean);
}

function isLetterCodeText(text) {
  const t = compactSpace(text);
  return /^[A-Z]$/.test(t) || /^[A-Z]\d$/.test(t) || /^[가-힣]$/.test(t);
}

function roundedSizeSignature(w, h) {
  const bw = Math.round(Number(w) / 10) * 10;
  const bh = Math.round(Number(h) / 10) * 10;
  return `${bw}x${bh}`;
}

function detectSvgLetterCodeBadges(ctx) {
  const out = [];
  const imgRe = /<(?:img|object)\b([^>]*)>/gi;
  let m;
  while ((m = imgRe.exec(ctx.cleanHtml))) {
    const attrs = parseAttrs(m[1]);
    const src = attrs.src || attrs.data;
    if (!src || src === true || !/\.svg(?:$|[?#])/i.test(String(src))) continue;
    const svgPath = localAssetPath(src, ctx.page);
    if (!svgPath) continue;
    let svg = '';
    try {
      svg = fs.readFileSync(svgPath, 'utf8');
    } catch (_) {
      continue;
    }
    const groups = {};
    const examples = {};
    const codesByGroup = {};
    const gRe = /<g\b([^>]*)>([\s\S]*?)<\/g>/gi;
    let gm;
    while ((gm = gRe.exec(svg))) {
      const body = gm[2] || '';
      const rect = body.match(/<rect\b([^>]*)\/?>/i);
      if (!rect) continue;
      const rAttrs = parseAttrs(rect[1]);
      const w = attrPx(rAttrs, 'width');
      const h = attrPx(rAttrs, 'height');
      if (w == null || h == null || w < 28 || h < 28 || w > 420 || h > 160) continue;
      const texts = [];
      const tRe = /<text\b([^>]*)>([\s\S]{0,40}?)<\/text>/gi;
      let tm;
      while ((tm = tRe.exec(body))) {
        const text = compactSpace(decodeEntities(stripTags(tm[2])));
        if (isLetterCodeText(text)) texts.push(text);
      }
      if (!texts.length) continue;
      const signature = roundedSizeSignature(w, h);
      groups[signature] = (groups[signature] || 0) + 1;
      if (!examples[signature]) examples[signature] = snippet(gm[0], 220);
      if (!codesByGroup[signature]) codesByGroup[signature] = [];
      codesByGroup[signature].push(...texts);
    }
    const top = Object.entries(groups).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 3) {
      out.push({
        src: String(src),
        file: svgPath,
        signature: top[0],
        count: top[1],
        codes: [...new Set(codesByGroup[top[0]] || [])],
        snippet: examples[top[0]],
      });
    }
  }
  return out;
}

function detectHtmlLetterCodeBadges(ctx) {
  const groups = {};
  const examples = {};
  const codes = {};
  for (const el of ctx.paired) {
    if (!isLetterCodeText(el.text)) continue;
    const style = styleFor(el.classList, el.style, ctx.css);
    const w = stylePx(style, 'width') || attrPx(el.attrs, 'width');
    const h = stylePx(style, 'height') || attrPx(el.attrs, 'height');
    const ar = propValue(style, 'aspect-ratio');
    const radius = propValue(style, 'border-radius');
    const shapeBySize = w != null && h != null && Math.abs(w - h) <= 8 && Math.max(w, h) <= 120;
    const shapeByRule = /1\s*\/\s*1/.test(ar) || /9999px|50%/.test(radius);
    if (!shapeBySize && !shapeByRule) continue;
    const sig = shapeBySize ? roundedSizeSignature(w, h) : `rule:${compactSpace(ar || radius)}`;
    groups[sig] = (groups[sig] || 0) + 1;
    if (!examples[sig]) examples[sig] = el.snippet;
    if (!codes[sig]) codes[sig] = [];
    codes[sig].push(el.text);
  }
  return Object.entries(groups)
    .filter(([, count]) => count >= 3)
    .map(([signature, count]) => ({
      signature,
      count,
      codes: [...new Set(codes[signature] || [])],
      snippet: examples[signature],
    }));
}

function detectLetterCodeBadges(ctx) {
  const svgHits = detectSvgLetterCodeBadges(ctx);
  const htmlHits = detectHtmlLetterCodeBadges(ctx);
  const hits = [...svgHits.map((hit) => ({ type: 'svg', ...hit })), ...htmlHits.map((hit) => ({ type: 'html', ...hit }))];
  if (!hits.length) return null;
  const top = hits.sort((a, b) => b.count - a.count)[0];
  return {
    tell: 'letter-code-badge',
    severity: 'medium',
    evidence: {
      count: top.count,
      type: top.type,
      signature: top.signature,
      codes: top.codes,
      sourceFile: top.file || null,
      groups: hits.slice(0, 6).map((hit) => ({ type: hit.type, signature: hit.signature, count: hit.count, codes: hit.codes, src: hit.src || null })),
      snippets: [top.snippet].filter(Boolean),
      source: sourceTell(ctx, ['letter-square', 'placeholder avatars']),
    },
  };
}

function anchorRanges(html) {
  const ranges = [];
  const re = /<a\b[\s\S]*?<\/a>/gi;
  let m;
  while ((m = re.exec(html))) ranges.push([m.index, re.lastIndex]);
  return ranges;
}

function indexInRanges(index, ranges) {
  return ranges.some(([start, end]) => index >= start && index <= end);
}

function detectMarkerSequence(ctx) {
  const ranges = anchorRanges(ctx.cleanHtml);
  const markerRe = /(기록|문서|첨부|자료|도판|증빙|record|doc|exhibit)\s*[·.]?\s*(\d{1,2})\b(?!\s*(?:월|일|년|시|분|명|개|%|원)|[.\d])/gi;
  const textRe = />([^<>]+)</g;
  const families = new Map();
  const snippets = [];
  let textMatch;
  while ((textMatch = textRe.exec(ctx.cleanHtml))) {
    const text = textMatch[1];
    markerRe.lastIndex = 0;
    let marker;
    while ((marker = markerRe.exec(text))) {
      const index = textMatch.index + 1 + marker.index;
      if (indexInRanges(index, ranges)) continue;
      const prefix = marker[1].toLowerCase();
      const num = Number(marker[2]);
      if (!families.has(prefix)) families.set(prefix, []);
      families.get(prefix).push({ prefix: marker[1], num, index });
      snippets.push(snippet(ctx.cleanHtml.slice(Math.max(0, index - 80), index + 120), 180));
    }
  }

  const rows = [];
  for (const [prefixKey, items] of families.entries()) {
    if (items.length < 3) continue;
    const sequence = items.map((item) => item.num);
    const inversions = [];
    for (let i = 1; i < sequence.length; i++) {
      if (sequence[i] < sequence[i - 1]) inversions.push([sequence[i - 1], sequence[i]]);
    }
    const counts = {};
    for (const n of sequence) counts[n] = (counts[n] || 0) + 1;
    const duplicates = Object.entries(counts).filter(([, count]) => count > 1).map(([n]) => Number(n));
    const min = Math.min(...sequence);
    const max = Math.max(...sequence);
    const present = new Set(sequence);
    const gaps = [];
    for (let n = min; n <= max; n++) if (!present.has(n)) gaps.push(n);
    rows.push({ prefix: items[0].prefix || prefixKey, sequence, inversions, gaps, duplicates });
  }

  const firing = rows.filter((row) => row.inversions.length || row.duplicates.length);
  if (!firing.length) return null;
  const high = firing.some((row) => row.inversions.length >= 2 || (row.inversions.length >= 1 && row.gaps.length >= 2));
  return {
    tell: 'marker-sequence-broken',
    severity: high ? 'high' : 'medium',
    evidence: {
      families: rows,
      snippets: snippets.slice(0, 4),
      source: sourceTell(ctx, ['numbered pseudo-editorial', 'numbering']),
    },
  };
}

const HANJA_NUMERAL_VALUES = {
  '零': 0, '〇': 0,
  '一': 1, '壹': 1,
  '二': 2, '貳': 2, '贰': 2,
  '三': 3, '參': 3, '叁': 3,
  '四': 4, '肆': 4,
  '五': 5, '伍': 5,
  '六': 6, '陸': 6, '陆': 6,
  '七': 7, '柒': 7,
  '八': 8, '捌': 8,
  '九': 9, '玖': 9,
};

function parseHanjaNumeral(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (Object.prototype.hasOwnProperty.call(HANJA_NUMERAL_VALUES, s)) return HANJA_NUMERAL_VALUES[s];
  const tenIdx = s.indexOf('十');
  if (tenIdx === -1) return null;
  const left = s.slice(0, tenIdx);
  const right = s.slice(tenIdx + 1);
  const tens = left ? HANJA_NUMERAL_VALUES[left] : 1;
  const ones = right ? HANJA_NUMERAL_VALUES[right] : 0;
  if (!Number.isFinite(tens) || !Number.isFinite(ones)) return null;
  return tens * 10 + ones;
}

function parseRomanNumeral(raw) {
  const s = String(raw || '').trim().toUpperCase();
  const table = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
  return Object.prototype.hasOwnProperty.call(table, s) ? table[s] : null;
}

function parseMarkerNumber(raw) {
  const s = compactSpace(raw);
  if (/^\d{1,2}$/.test(s)) return Number(s);
  const hanja = parseHanjaNumeral(s);
  if (hanja != null) return hanja;
  return parseRomanNumeral(s);
}

function markerFamilyKey(prefix) {
  const p = String(prefix || '').toLowerCase();
  if (/^(?:記錄|記録|记录|기록|record)$/.test(p)) return 'record';
  if (/^(?:文書|文书|문서|doc)$/.test(p)) return 'document';
  if (/^(?:添附|첨부|exhibit)$/.test(p)) return 'attachment';
  if (/^(?:資料|资料|자료)$/.test(p)) return 'material';
  if (/^(?:圖版|圖|图|도판)$/.test(p)) return 'figure';
  if (/^(?:寫眞|寫真|사진)$/.test(p)) return 'photo';
  if (/^(?:現場|현장)$/.test(p)) return 'scene';
  return p;
}

function hasSequentialRun(sequence, minRun) {
  let run = 1;
  for (let i = 1; i < sequence.length; i++) {
    if (sequence[i] === sequence[i - 1] + 1) {
      run++;
      if (run >= minRun) return true;
    } else if (sequence[i] !== sequence[i - 1]) {
      run = 1;
    }
  }
  return false;
}

function detectMultiscriptNumbering(ctx) {
  const ranges = anchorRanges(ctx.cleanHtml);
  const prefix = '(記錄|記録|记录|文書|文书|添附|資料|资料|圖版|圖|图|寫眞|寫真|現場|人物|기록|문서|첨부|자료|도판|증빙|record|doc|exhibit)';
  const num = '(\\d{1,2}|[一二三四五六七八九十壹貳贰參叁肆伍陸陆柒捌玖]{1,3}|I{1,3}|IV|V|VI{0,3}|IX|X)';
  const markerRe = new RegExp(`${prefix}\\s*[·.]?\\s*${num}(?!\\s*(?:월|일|년|시|분|명|개|%|원)|[.\\d])`, 'gi');
  const textRe = />([^<>]+)</g;
  const families = new Map();
  const snippets = [];
  let textMatch;
  while ((textMatch = textRe.exec(ctx.cleanHtml))) {
    const text = textMatch[1];
    markerRe.lastIndex = 0;
    let marker;
    while ((marker = markerRe.exec(text))) {
      const index = textMatch.index + 1 + marker.index;
      if (indexInRanges(index, ranges)) continue;
      const parsed = parseMarkerNumber(marker[2]);
      if (parsed == null || parsed <= 0) continue;
      const key = markerFamilyKey(marker[1]);
      if (!families.has(key)) families.set(key, []);
      families.get(key).push({ prefix: marker[1], raw: marker[2], num: parsed, index });
      snippets.push(snippet(ctx.cleanHtml.slice(Math.max(0, index - 80), index + 120), 180));
    }
  }

  const rows = [];
  for (const [key, items] of families.entries()) {
    if (items.length < 3) continue;
    const ordered = items.slice().sort((a, b) => a.index - b.index);
    const sequence = ordered.map((item) => item.num);
    if (!hasSequentialRun(sequence, 3)) continue;
    rows.push({
      family: key,
      prefix: ordered[0].prefix,
      sequence,
      raw: ordered.map((item) => item.raw),
    });
  }

  if (!rows.length) return null;
  return {
    tell: 'multiscript-numbering',
    severity: 'medium',
    evidence: {
      families: rows,
      count: rows.reduce((sum, row) => sum + row.sequence.length, 0),
      scripts: [...new Set(rows.flatMap((row) => row.raw.map((value) => /[一二三四五六七八九十壹貳贰參叁肆伍陸陆柒捌玖]/.test(value) ? 'hanja' : (/^[IVX]+$/i.test(value) ? 'roman' : 'arabic'))))],
      snippets: snippets.slice(0, 5),
      source: sourceTell(ctx, ['numbered pseudo-editorial', 'numbering']),
    },
  };
}

function elementBody(ctx, el) {
  if (!el || VOID_TAGS.has(el.tag)) return '';
  const close = findClosingTag(ctx.cleanHtml, el.tag, el.index);
  if (!close) return '';
  return ctx.cleanHtml.slice(el.index + el.open.length, close.start);
}

function detectJustifyDisplay(ctx) {
  const hits = [];
  for (const el of ctx.elements) {
    if (!el.classList.length && !el.style) continue;
    const style = styleFor(el.classList, el.style, ctx.css);
    if (!/\btext-align\s*:\s*justify\b/i.test(style)) continue;
    const fontSizePx = stylePx(style, 'font-size');
    const containsHeading = /^h[1-3]$/.test(el.tag) || /<h[1-3]\b/i.test(elementBody(ctx, el));
    if (!(fontSizePx >= 24 || containsHeading)) continue;
    const cls = el.classList.find((c) => {
      const classStyle = ctx.css.classes.get(c) || '';
      return /\btext-align\s*:\s*justify\b/i.test(resolveVars(classStyle, ctx.css.vars));
    }) || el.classList[0] || '(inline)';
    hits.push({
      class: cls,
      fontSizePx: fontSizePx == null ? null : Math.round(fontSizePx * 10) / 10,
      snippet: snippet(el.open + compactSpace(stripTags(elementBody(ctx, el))).slice(0, 160), 220),
    });
  }

  if (!hits.length) return null;
  const top = hits[0];
  return {
    tell: 'justified-display',
    severity: 'medium',
    evidence: {
      class: top.class,
      fontSizePx: top.fontSizePx,
      snippets: hits.slice(0, 4).map((hit) => hit.snippet),
      source: sourceTell(ctx, ['justified', 'hyphenation']),
    },
  };
}

function cssColorTokens(value) {
  const out = [];
  const re = /rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-f]{3,8}\b|\bwhite\b/gi;
  let m;
  while ((m = re.exec(String(value || '')))) out.push(m[0]);
  return out;
}

function parseCssAlpha(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  const s = String(raw).trim();
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return fallback;
  return s.endsWith('%') ? n / 100 : n;
}

function parseRgbLoose(token) {
  const m = String(token || '').match(/rgba?\(([^)]+)\)/i);
  if (!m) return null;
  const body = m[1].trim();
  const slash = body.split('/');
  const parts = slash[0].replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 3) return null;
  const channel = (raw) => {
    const s = String(raw || '').trim();
    const n = Number.parseFloat(s);
    if (!Number.isFinite(n)) return null;
    return s.endsWith('%') ? n * 2.55 : n;
  };
  const r = channel(parts[0]);
  const g = channel(parts[1]);
  const b = channel(parts[2]);
  if ([r, g, b].some((n) => n == null)) return null;
  const alphaRaw = slash.length > 1 ? slash.slice(1).join('/').trim() : parts[3];
  return { r, g, b, alpha: parseCssAlpha(alphaRaw, 1), raw: compactSpace(token).toLowerCase() };
}

function parseHslLoose(token) {
  const m = String(token || '').match(/hsla?\(([^)]+)\)/i);
  if (!m) return null;
  const body = m[1].trim();
  const slash = body.split('/');
  const parts = slash[0].replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 3) return null;
  const s = Number.parseFloat(parts[1]);
  const l = Number.parseFloat(parts[2]);
  if (![s, l].every(Number.isFinite)) return null;
  const alphaRaw = slash.length > 1 ? slash.slice(1).join('/').trim() : parts[3];
  return { saturation: s, lightness: l, alpha: parseCssAlpha(alphaRaw, 1), raw: compactSpace(token).toLowerCase() };
}

function parseHexLoose(token) {
  const m = String(token || '').match(/#([0-9a-f]{3,8})\b/i);
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3 || hex.length === 4) hex = hex.split('').map((ch) => ch + ch).join('');
  if (hex.length < 6) return null;
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  if (![r, g, b].every(Number.isFinite)) return null;
  const alpha = hex.length >= 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, alpha, raw: `#${m[1].toLowerCase()}` };
}

function isNearWhiteToken(token, options) {
  const opts = options || {};
  const minAlpha = opts.minAlpha == null ? 0 : opts.minAlpha;
  const maxAlpha = opts.maxAlpha == null ? 1 : opts.maxAlpha;
  const rgb = parseRgbLoose(token) || parseHexLoose(token);
  if (rgb) {
    return rgb.r >= 235 && rgb.g >= 235 && rgb.b >= 235 && rgb.alpha >= minAlpha && rgb.alpha <= maxAlpha;
  }
  const hsl = parseHslLoose(token);
  if (hsl) {
    return hsl.saturation <= 12 && hsl.lightness >= 92 && hsl.alpha >= minAlpha && hsl.alpha <= maxAlpha;
  }
  return /\bwhite\b/i.test(String(token || '')) && minAlpha <= 1 && maxAlpha >= 1;
}

function hasTranslucentWhiteBackground(style, classList) {
  const bg = [
    propValue(style, 'background-color'),
    propValue(style, 'background'),
    propValue(style, 'background-image'),
  ].join(' ');
  if (cssColorTokens(bg).some((token) => isNearWhiteToken(token, { minAlpha: 0.05, maxAlpha: 0.72 }))) return true;
  return (classList || []).some((cls) => /^bg-white\/(?:[1-6]?\d|70)$/.test(cls));
}

function hasTailwindBorderWidth(classList) {
  return (classList || []).some((cls) => /^border(?:-[trblxy])?(?:-\d+)?$/.test(cls));
}

function hasNearWhiteBorder(style, classList) {
  const borderValues = [
    propValue(style, 'border-color'),
    propValue(style, 'border'),
    propValue(style, 'border-top'),
    propValue(style, 'border-right'),
    propValue(style, 'border-bottom'),
    propValue(style, 'border-left'),
  ].join(' ');
  const hasVisibleWidth = (borderWidthPx(style) || 0) > 0 || hasTailwindBorderWidth(classList);
  const hasStyleSignal = /\b(?:solid|dashed|dotted|double)\b/i.test(borderValues);
  const white = cssColorTokens(borderValues).some((token) => isNearWhiteToken(token, { minAlpha: 0.12, maxAlpha: 1 }));
  if (white && (hasVisibleWidth || hasStyleSignal)) return true;
  return hasTailwindBorderWidth(classList) && (classList || []).some((cls) => /^border-white(?:\/(?:[1-9]\d?|100))?$/.test(cls));
}

function hasBackdropBlur(style, classList) {
  const backdrop = `${propValue(style, 'backdrop-filter')} ${propValue(style, '-webkit-backdrop-filter')}`;
  return /\bblur\s*\(/i.test(backdrop) || (classList || []).some((cls) => /^backdrop-blur(?:-|$)/.test(cls));
}

function isFrostedChromeElement(el) {
  const cls = (el.classList || []).join(' ');
  const role = String(el.attrs && el.attrs.role || '').toLowerCase();
  if (['nav', 'header', 'footer'].includes(el.tag)) return true;
  if (['navigation', 'banner', 'contentinfo'].includes(role)) return true;
  return /\b(?:nav|navbar|gnb|lnb|menubar|appbar|topbar|toolbar|breadcrumb|masthead|site-header|hero-nav)\b/i.test(cls);
}

function detectGlassmorphismStack(ctx) {
  const hits = [];
  for (const el of ctx.elements) {
    if (isFrostedChromeElement(el)) continue;
    const style = styleFor(el.classList, el.style, ctx.css);
    if (!hasBackdropBlur(style, el.classList)) continue;
    if (!hasTranslucentWhiteBackground(style, el.classList)) continue;
    if (!hasNearWhiteBorder(style, el.classList)) continue;
    hits.push({
      tag: el.tag,
      className: el.classList.slice(0, 6).join(' '),
      snippet: snippet(el.open + (el.text || ''), 220),
    });
  }

  if (hits.length < 2) return null;
  return {
    tell: 'glassmorphism-stack',
    severity: 'high',
    evidence: {
      count: hits.length,
      requiredSignals: ['backdrop-blur', 'translucent-white-background', 'near-white-border'],
      guard: 'single frosted navigation/header chrome over photography is skipped; repeated glass content panels are scored',
      snippets: hits.slice(0, 5).map((hit) => hit.snippet),
      source: sourceTell(ctx, ['glassmorphism', 'glass']),
    },
  };
}

function tailwindFontPx(classList) {
  const scale = {
    'text-4xl': 36,
    'text-5xl': 48,
    'text-6xl': 60,
    'text-7xl': 72,
    'text-8xl': 96,
    'text-9xl': 128,
  };
  for (const cls of classList || []) {
    if (Object.prototype.hasOwnProperty.call(scale, cls)) return scale[cls];
    const m = cls.match(/^text-\[(\d+(?:\.\d+)?)px\]$/);
    if (m) return Number(m[1]);
  }
  return null;
}

function hasGradientBackground(style, classList) {
  const bg = `${propValue(style, 'background')} ${propValue(style, 'background-image')}`;
  if (/\b(?:linear|radial|conic)-gradient\s*\(/i.test(bg)) return true;
  const classes = classList || [];
  return classes.some((cls) => /^bg-gradient-to-/.test(cls)) &&
    classes.some((cls) => /^(?:from|via|to)-/.test(cls));
}

function hasTextClip(style, classList) {
  const clip = `${propValue(style, 'background-clip')} ${propValue(style, '-webkit-background-clip')}`;
  return /\btext\b/i.test(clip) || (classList || []).includes('bg-clip-text');
}

function hasTransparentTextFill(style, classList) {
  const fill = `${propValue(style, '-webkit-text-fill-color')} ${propValue(style, 'color')}`;
  return /\btransparent\b/i.test(fill) || (classList || []).includes('text-transparent');
}

function gradientNumeralText(ctx, el) {
  const direct = compactSpace(el.text);
  if (direct) return direct;
  if (!/^(?:h[1-4]|span|strong|em|b|div|p)$/.test(el.tag)) return '';
  return compactSpace(decodeEntities(stripTags(elementBody(ctx, el))));
}

function detectGradientNumeral(ctx) {
  const hits = [];
  const seen = new Set();
  for (const el of ctx.elements) {
    const text = gradientNumeralText(ctx, el);
    if (!/^[+\-]?\d{1,4}(?:[.,]\d{3})?(?:%|x)?$/i.test(text)) continue;
    const style = styleFor(el.classList, el.style, ctx.css);
    const fontSizePx = stylePx(style, 'font-size') || tailwindFontPx(el.classList) || 0;
    if (fontSizePx < 48) continue;
    if (!hasTextClip(style, el.classList) || !hasTransparentTextFill(style, el.classList) || !hasGradientBackground(style, el.classList)) continue;
    const snip = snippet(el.open + text, 220);
    if (seen.has(snip)) continue;
    seen.add(snip);
    hits.push({ value: text, fontSizePx, snippet: snip });
  }

  if (!hits.length) return null;
  return {
    tell: 'gradient-numeral',
    severity: 'medium',
    evidence: {
      count: hits.length,
      numerals: hits.map((hit) => hit.value),
      minFontSizePx: 48,
      snippets: hits.slice(0, 5).map((hit) => hit.snippet),
      source: sourceTell(ctx, ['gradient numeral', 'gradient text', 'numeral']),
    },
  };
}

const STRUCTURAL_EMOJI_RE = /[⌚-⌛☀-➿⬅-⬇⬛⬜⭐⭕️\u{1F000}-\u{1FAFF}]/u;

function leadingHeadingEmoji(text) {
  const s = compactSpace(decodeEntities(stripTags(text)));
  const m = s.match(STRUCTURAL_EMOJI_RE);
  if (!m || m.index !== 0) return null;
  const rest = compactSpace(s.slice(m.index + m[0].length));
  if (!/[A-Za-z0-9가-힣]/.test(rest)) return null;
  return { emoji: m[0], text: rest };
}

function detectEmojiFeatureIcon(ctx) {
  // Plain emoji presence is already scored by brand-lint's `emoji` rule. This detector only scores
  // structural icon placement: a heading-leading emoji or an emoji embedded in an accessible label.
  const headingHits = [];
  const headingRe = /<h([2-4])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = headingRe.exec(ctx.cleanHtml))) {
    const lead = leadingHeadingEmoji(m[3]);
    if (!lead) continue;
    headingHits.push({
      tag: `h${m[1]}`,
      emoji: lead.emoji,
      text: lead.text,
      snippet: snippet(m[0], 180),
    });
  }

  const ariaHits = [];
  for (const el of ctx.elements) {
    const raw = el.attrs && el.attrs['aria-label'];
    if (typeof raw !== 'string') continue;
    const label = compactSpace(decodeEntities(raw));
    const hit = label.match(STRUCTURAL_EMOJI_RE);
    if (!hit) continue;
    ariaHits.push({
      tag: el.tag,
      emoji: hit[0],
      label,
      snippet: snippet(el.open, 180),
    });
  }

  if (!headingHits.length && !ariaHits.length) return null;
  return {
    tell: 'emoji-feature-icon',
    severity: 'medium',
    evidence: {
      headingLeadingCount: headingHits.length,
      ariaLabelCount: ariaHits.length,
      headings: headingHits.slice(0, 6),
      ariaLabels: ariaHits.slice(0, 6),
      source: sourceTell(ctx, ['emoji', 'icon']),
    },
  };
}

function roleFor(tag, classList, topology) {
  void classList;
  return (topology || topologyForHtml('', tag)).key;
}

function sectionSignature(section) {
  const body = stripDataUris(stripScriptsAndStyles(stripComments(section.body)));
  const roles = [];
  const features = new Set();
  const sectionTopology = topologyForHtml(body, section.open.match(/^<([a-z][\w:-]*)/i)?.[1].toLowerCase() || 'section');
  features.add(`section:${sectionTopology.key}`);
  const countBucket = (name, count) => features.add(`${name}:${countBucketValue(count)}`);
  countBucket('headings', countMatches(body, /<h[1-3]\b/gi));
  countBucket('media', countMatches(body, /<(?:img|picture|video|svg|canvas)\b/gi));
  countBucket('repeats', countMatches(body, /<(?:li|tr)\b/gi) + repeatedCardCount(body));
  features.add(`text:${sectionTopology.text}`);

  const re = /<([a-z][\w:-]*)\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(body))) {
    const tag = m[1].toLowerCase();
    if (IGNORE_STRUCTURE_TAGS.has(tag)) continue;
    const attrs = parseAttrs(m[2]);
    const cls = classListFromAttrs(attrs);
    const topology = topologyForElement(body, tag, m.index, re.lastIndex);
    const role = roleFor(tag, cls, topology);
    roles.push(role);
    features.add(`tag:${tagGroup(tag)}`);
    features.add(`role:${role}`);
    if (roles.length >= 24) break;
  }
  roles.slice(0, 8).forEach((r, i) => features.add(`pos${i}:${r}`));
  const key = roles.slice(0, 4).join('>');
  const hasPadEyebrowHeading = sectionTopology.heading === '1' &&
    sectionTopology.text !== '0' &&
    (sectionTopology.media !== '0' || sectionTopology.repeat !== '0' || roles.length >= 5);
  return { key, roles, features, hasPadEyebrowHeading };
}

function jaccard(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

function computeMonotony(ctx) {
  const sections = ctx.contentSections;
  if (sections.length < 4) {
    return { score: 0, contentSections: sections.length, dominantRhythm: null, dominantCount: 0, commonRhythmCount: 0, pairwiseAverage: 0 };
  }
  const sigs = sections.map(sectionSignature).filter((s) => s.roles.length >= 3);
  if (sigs.length < 4) {
    return { score: 0, contentSections: sections.length, dominantRhythm: null, dominantCount: 0, commonRhythmCount: 0, pairwiseAverage: 0 };
  }
  const counts = {};
  for (const s of sigs) counts[s.key] = (counts[s.key] || 0) + 1;
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || ['', 0];
  const dominantRatio = dominant[1] / sigs.length;
  const commonRhythmCount = sigs.filter((s) => s.hasPadEyebrowHeading).length;
  const commonRhythmRatio = commonRhythmCount / sigs.length;
  let pairs = 0;
  let total = 0;
  for (let i = 0; i < sigs.length; i++) {
    for (let j = i + 1; j < sigs.length; j++) {
      total += jaccard(sigs[i].features, sigs[j].features);
      pairs++;
    }
  }
  const pairwiseAverage = pairs ? total / pairs : 0;
  const rhythmScore = (0.72 * commonRhythmRatio) + (0.28 * pairwiseAverage);
  const dominantScore = (0.68 * dominantRatio) + (0.32 * pairwiseAverage);
  const score = Math.max(rhythmScore, dominantScore);
  return {
    score: Number(Math.max(0, Math.min(1, score)).toFixed(2)),
    contentSections: sigs.length,
    dominantRhythm: dominant[0] || null,
    dominantCount: dominant[1],
    commonRhythmCount,
    pairwiseAverage: Number(pairwiseAverage.toFixed(2)),
  };
}

function detectStructuralMonotony(ctx, monotony) {
  if (monotony.score < 0.58 || monotony.contentSections < 5) return null;
  return {
    tell: 'structural-monotony',
    severity: monotony.score >= 0.72 ? 'high' : 'medium',
    evidence: {
      score: monotony.score,
      contentSections: monotony.contentSections,
      dominantRhythm: monotony.dominantRhythm,
      dominantCount: monotony.dominantCount,
      commonRhythmCount: monotony.commonRhythmCount,
      pairwiseAverage: monotony.pairwiseAverage,
      source: sourceTell(ctx, ['structural monotony', 'identical section rhythm']),
    },
  };
}

function normalizeKeyword(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[`"'{}()[\]]/g, ' ')
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function compactKeyword(s) {
  return normalizeKeyword(s).replace(/\s+/g, '');
}

function keywordVariants(keyword) {
  const norm = normalizeKeyword(keyword);
  const compact = compactKeyword(keyword);
  const kebab = norm.replace(/\s+/g, '-');
  return [...new Set([String(keyword || '').toLowerCase(), norm, compact, kebab].filter((v) => v && v.length >= 2))];
}

function addExpected(list, seen, section, keyword) {
  const k = compactSpace(keyword);
  if (!k || k.length < 2) return;
  const sec = compactSpace(section || 'page') || 'page';
  const id = `${sec.toLowerCase()}|${k.toLowerCase()}`;
  if (seen.has(id)) return;
  seen.add(id);
  list.push({ section: sec, keyword: k });
}

function extractTermKeyword(value) {
  if (typeof value === 'string') return [value];
  if (!value || typeof value !== 'object') return [];
  const out = [];
  for (const key of ['keyword', 'term', 'id', 'en', 'ko', 'name', 'label']) {
    if (typeof value[key] === 'string') out.push(value[key]);
  }
  return out;
}

function collectExpectedFromManifest(manifest) {
  const expected = [];
  const seen = new Set();
  const keywordKeys = new Set(['keywords', 'selectedKeywords', 'designKeywords', 'terms', 'picked', 'chosen', 'positiveKeywords']);
  const namedContainerKeys = new Set(['slots', 'sections', 'items']);

  function walk(node, section) {
    if (!node) return;
    if (typeof node === 'string') {
      addExpected(expected, seen, section, node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item, section);
      return;
    }
    if (typeof node !== 'object') return;

    const nextSection = node.section || node.sectionKey || node.slot || node.arc || node.key || section;
    for (const key of Object.keys(node)) {
      const value = node[key];
      if (namedContainerKeys.has(key) && value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [sectionKey, sectionValue] of Object.entries(value)) walk(sectionValue, sectionKey);
        continue;
      }
      if (keywordKeys.has(key)) {
        if (Array.isArray(value)) {
          for (const item of value) for (const kw of extractTermKeyword(item)) addExpected(expected, seen, nextSection, kw);
        } else {
          for (const kw of extractTermKeyword(value)) addExpected(expected, seen, nextSection, kw);
        }
        continue;
      }
      if (namedContainerKeys.has(key)) walk(value, nextSection);
    }
  }

  walk(manifest, 'page');
  return expected;
}

function buildPresenceHaystacks(html) {
  const dataAttrs = [];
  let m;
  const dataAttrRe = /\bdata-[\w:-]+\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
  while ((m = dataAttrRe.exec(html))) dataAttrs.push(m[2] || m[3] || m[4] || '');

  const dataRaw = dataAttrs.join('\n').toLowerCase();
  const dataNormalized = normalizeKeyword(dataAttrs.join(' '));
  const dataCompact = dataNormalized.replace(/\s+/g, '');
  const visibleText = decodeEntities(stripTags(stripScriptsAndStyles(stripComments(html))));
  const visibleRaw = visibleText.toLowerCase();
  const visibleNormalized = normalizeKeyword(visibleText);
  const visibleCompact = visibleNormalized.replace(/\s+/g, '');
  const allHtml = html.toLowerCase();
  const allCompact = normalizeKeyword(html).replace(/\s+/g, '');
  return { dataRaw, dataNormalized, dataCompact, visibleRaw, visibleNormalized, visibleCompact, allHtml, allCompact };
}

function matchVariants(hay, rawKey, normKey, compactKey, variants, compactVars) {
  return variants.some((v) => hay[rawKey].includes(v) || hay[normKey].includes(v)) ||
    compactVars.some((v) => hay[compactKey].includes(v));
}

function findPresenceEvidence(html, keyword, trace) {
  const variants = keywordVariants(keyword);
  const source = trace === 'visible-text' ? decodeEntities(stripTags(stripScriptsAndStyles(stripComments(html)))) : html;
  const lower = source.toLowerCase();
  for (const v of variants) {
    if (v.length < 2) continue;
    const idx = lower.indexOf(v);
    if (idx !== -1) return snippet(source.slice(Math.max(0, idx - 70), idx + 150), 180);
  }
  return null;
}

function checkPresence(html, manifestPath) {
  if (!manifestPath) return { expected: [], found: [], missing: [], weakOnlyCount: 0 };
  const manifest = readJson(path.resolve(manifestPath), 'manifest');
  const expected = collectExpectedFromManifest(manifest);
  const hay = buildPresenceHaystacks(html);
  const found = [];
  const missing = [];
  let weakOnlyCount = 0;

  for (const item of expected) {
    const vars = keywordVariants(item.keyword);
    const compactVars = vars.map((v) => v.replace(/[^a-z0-9가-힣]+/g, '')).filter((v) => v.length >= 2);
    let trace = null;
    if (matchVariants(hay, 'dataRaw', 'dataNormalized', 'dataCompact', vars, compactVars)) trace = 'data-attr';
    else if (matchVariants(hay, 'visibleRaw', 'visibleNormalized', 'visibleCompact', vars, compactVars)) trace = 'visible-text';
    else if (vars.some((v) => hay.allHtml.includes(v)) || compactVars.some((v) => hay.allCompact.includes(v))) trace = 'html-weak';

    if (trace) {
      if (trace === 'html-weak') weakOnlyCount++;
      found.push({
        section: item.section,
        keyword: item.keyword,
        trace,
        evidence: findPresenceEvidence(html, item.keyword, trace) || trace,
      });
    } else {
      missing.push(item);
    }
  }
  const presence = { expected, found, missing, weakOnlyCount };
  if (manifestPath && expected.length === 0) presence.schemaWarning = 'manifest contained no extractable keywords';
  return presence;
}

function computeVerdict(tells, monotonyScore, presence) {
  const weights = { low: 1, medium: 2, high: 3 };
  const severityScore = tells.reduce((sum, t) => sum + (weights[t.severity] || 0), 0);
  const highCount = tells.filter((t) => t.severity === 'high').length;
  const presencePenalty = presence && presence.expected.length && presence.missing.length / presence.expected.length > 0.5 ? 1 : 0;
  const score = severityScore + presencePenalty;
  if (score >= 8 || highCount >= 3 || (monotonyScore >= 0.72 && score >= 5)) return 'ai-likely';
  if (score >= 3 || highCount >= 1 || monotonyScore >= 0.58) return 'suspect';
  return 'clean';
}

function computeS2Pass(verdict, tells) {
  const highCount = tells.filter((t) => t.severity === 'high').length;
  const escapeTells = new Set([
    'repeated-decorative-label',
    'multiscript-numbering',
    'letter-code-badge',
    'palette-monotony',
    'mono-label',
    'marker-sequence-broken',
    'uniform-frame-loop',
    'letter-square-avatar',
    'outline-chip',
  ]);
  const escapeTellCount = tells.filter((t) => escapeTells.has(t.tell)).length;
  if (escapeTellCount > 0) return false;
  return verdict === 'clean' || (verdict === 'suspect' && highCount === 0);
}

function validateOptionalInputs(args) {
  optionalReadJson(args.run, 'shoot run.json');
  if (args.tiles) {
    const dir = path.resolve(args.tiles);
    let st;
    try {
      st = fs.statSync(dir);
    } catch (e) {
      fail(`cannot read tiles dir: ${dir} (${e.code || e.message})`);
    }
    if (!st.isDirectory()) fail(`--tiles is not a directory: ${dir}`);
  }
}

function optionalFlagValue(args, name) {
  if (!Object.prototype.hasOwnProperty.call(args, name)) return null;
  const value = args[name];
  if (typeof value !== 'string' || !value.trim()) fail(`--${name} requires a value`, 2);
  return value;
}

function groundingContext(file) {
  const absolute = path.resolve(file);
  const markdown = readText(absolute, 'librarian grounding');
  const exemplar = markdown.match(/Retrieved exemplar(?: cited)?:\s*`([^`]+)`/iu);
  const category = markdown.match(/(?:^|\n)Category:\s*`([^`]+)`/u);
  return {
    file: absolute,
    exemplar: exemplar ? exemplar[1] : null,
    category: category ? category[1] : null,
  };
}

function checkConformance(args, page) {
  const recipe = optionalFlagValue(args, 'recipe');
  const category = optionalFlagValue(args, 'category');
  const grounding = optionalFlagValue(args, 'grounding');
  if (!recipe && !category && !grounding) return null;

  const conformance = {};
  if (recipe) {
    try {
      const { checkBuildHonesty, REFUSAL_MESSAGE } = require('./build-honesty-check.js');
      const result = checkBuildHonesty(page, recipe);
      conformance.buildHonesty = result.status === 'clean' ? result : { ...result, message: REFUSAL_MESSAGE };
    } catch (error) {
      fail(`recipe conformance refused: ${error.message}`, 2);
    }
  }
  if (category) {
    try {
      const { reportForPage } = require('../../../scripts/anti-pattern-check.js');
      conformance.antiPatterns = reportForPage(page, category);
    } catch (error) {
      fail(`category conformance refused: ${error.message}`, 2);
    }
    if (conformance.antiPatterns.status === 'MISS') {
      fail(`category conformance refused: ${conformance.antiPatterns.message}`, 2);
    }
  }
  if (grounding) conformance.grounding = groundingContext(grounding);
  return conformance;
}

function conformanceFindings(conformance) {
  const findings = [];
  if (!conformance) return findings;
  if (conformance.buildHonesty && conformance.buildHonesty.status !== 'clean') {
    findings.push({
      tell: 'unsupported-fabricated-content',
      evidence: {
        recipe: conformance.buildHonesty.recipe,
        violations: conformance.buildHonesty.violations,
      },
      severity: 'high',
    });
  }
  if (conformance.antiPatterns) {
    for (const hit of conformance.antiPatterns.hits.filter((entry) => entry.severity === 'HIGH')) {
      findings.push({ tell: `anti-pattern:${hit.id}`, evidence: hit, severity: 'high' });
    }
  }
  return findings;
}

function printConformanceSummary(conformance) {
  if (!conformance) return;
  if (conformance.buildHonesty) {
    console.log(`buildHonesty: ${conformance.buildHonesty.status}`);
    for (const violation of conformance.buildHonesty.violations) {
      const location = violation.location;
      console.log(`UNSUPPORTED ${violation.kind} ${JSON.stringify(violation.value)} at ${conformance.buildHonesty.page}:${location.line}:${location.column}`);
    }
  }
  if (conformance.antiPatterns) {
    const counts = conformance.antiPatterns.counts;
    console.log(`antiPatterns: ${conformance.antiPatterns.status} (HIGH=${counts.HIGH} MEDIUM=${counts.MEDIUM} LOW=${counts.LOW})`);
    for (const row of conformance.antiPatterns.unchecked) {
      console.log(`UNCHECKED ${row.severity} ${row.id}: ${row.title}`);
    }
  }
  if (conformance.grounding) {
    console.log(`grounding: exemplar=${conformance.grounding.exemplar || 'not claimed'} category=${conformance.grounding.category || 'not claimed'}`);
  }
}

function printSummary(report, reportPath) {
  const tells = report.tellsDetected.map((t) => `${t.tell}:${t.severity}`).join(', ') || 'none';
  const presenceTotal = report.presence.expected.length;
  const presenceLine = presenceTotal ? `${report.presence.found.length}/${presenceTotal} found` : 'not provided';
  console.log(`anti-ai-eval verdict: ${report.verdict}`);
  console.log(`s2Pass: ${report.s2Pass}`);
  console.log(`page: ${report.page}`);
  console.log(`tellsDetected: ${report.tellsDetected.length} (${tells})`);
  console.log(`monotonyScore: ${report.monotonyScore}`);
  console.log(`sectionDetection: ${report.sectionDetection}`);
  console.log(`externalCssSkipped: ${report.externalCssSkipped.length}`);
  console.log(`presence: ${presenceLine}`);
  printConformanceSummary(report.conformance);
  console.log(`report: ${reportPath}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const input = args._[0];
  if (!input) fail(usage(), 2);

  validateOptionalInputs(args);
  const page = path.resolve(input);
  const html = readText(page, 'page HTML');
  const sources = loadSources();
  const ctx = buildContext(html, page, args, sources);
  const conformance = checkConformance(args, page);

  const tells = [];
  for (const detector of [detectMonoLabels, detectRepeatedDecorativeLabels, detectEnDisplayLabels, detectBrowserMockups, detectGhostNumerals, detectOutlineChips, detectUniformFrameLoop, detectLetterSquareAvatars, detectLetterCodeBadges, detectMarkerSequence, detectMultiscriptNumbering, detectJustifyDisplay, detectPaletteMonotony]) {
    const hit = detector(ctx);
    if (hit) pushTell(tells, hit.tell, hit.evidence, hit.severity);
  }
  const appendedHits = [];
  for (const detector of [detectPlaceholderShipped, detectEmDashFlood, detectScrollCue, detectDuplicateCtaIntent, detectGenericCta, detectGlassmorphismStack, detectGradientNumeral, detectEmojiFeatureIcon]) {
    const hit = detector(ctx);
    if (hit) appendedHits.push(hit);
  }
  appendedHits.push(...conformanceFindings(conformance));
  for (const hit of appendedHits) pushTell(tells, hit.tell, hit.evidence, hit.severity);

  const monotony = computeMonotony(ctx);
  const structural = detectStructuralMonotony(ctx, monotony);
  if (structural) pushTell(tells, structural.tell, structural.evidence, structural.severity);

  const presence = checkPresence(html, args.manifest);
  const verdict = computeVerdict(tells, monotony.score, presence);
  const brandLint = readBrandLintReport(args['brand-lint']);
  const report = {
    harnessVersion: HARNESS_VERSION,
    s2PassSemantics: 'structural-tell-absence-only; NOT ship-approval',
    page,
    sectionDetection: ctx.sectionDetection,
    externalCssSkipped: ctx.externalCssSkipped,
    tellsDetected: tells,
    monotonyScore: monotony.score,
    presence,
    verdict,
    s2Pass: computeS2Pass(verdict, tells),
    mechanicalScore: mechanicalScore({ tellsDetected: tells, monotonyScore: monotony.score, contentSections: monotony.contentSections, presence }, brandLint),
  };
  if (conformance) report.conformance = conformance;

  const reportPath = path.join(process.cwd(), REPORT_NAME);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  printSummary(report, reportPath);
}

main();
