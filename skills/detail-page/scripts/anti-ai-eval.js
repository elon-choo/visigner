#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const REPORT_NAME = 'anti-ai-report.json';
const HARNESS_VERSION = '1.1.0';
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

  const tells = [];
  for (const detector of [detectMonoLabels, detectBrowserMockups, detectGhostNumerals, detectOutlineChips, detectUniformFrameLoop, detectLetterSquareAvatars]) {
    const hit = detector(ctx);
    if (hit) pushTell(tells, hit.tell, hit.evidence, hit.severity);
  }

  const monotony = computeMonotony(ctx);
  const structural = detectStructuralMonotony(ctx, monotony);
  if (structural) pushTell(tells, structural.tell, structural.evidence, structural.severity);

  const presence = checkPresence(html, args.manifest);
  const verdict = computeVerdict(tells, monotony.score, presence);
  const report = {
    harnessVersion: HARNESS_VERSION,
    page,
    sectionDetection: ctx.sectionDetection,
    externalCssSkipped: ctx.externalCssSkipped,
    tellsDetected: tells,
    monotonyScore: monotony.score,
    presence,
    verdict,
    s2Pass: computeS2Pass(verdict, tells),
  };

  const reportPath = path.join(process.cwd(), REPORT_NAME);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  printSummary(report, reportPath);
}

main();
