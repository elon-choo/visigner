#!/usr/bin/env node
'use strict';

// Read-only build gate: a rendered page may not introduce a concrete number,
// metric label, or measurement unit that its recipe (or supplied brief) does
// not contain. It deliberately reports evidence rather than suggesting a
// replacement, because a plausible replacement would itself be fabricated.

const fs = require('fs');
const path = require('path');

const REFUSAL_MESSAGE = 'REFUSING — build contains concrete metric content that does not trace to its recipe or brief; do not ship or invent support for it.';
const METRIC_LABELS = Object.freeze([
  'click-through rate',
  'average order value',
  'monthly active users',
  'activation rate',
  'conversion rate',
  'response time',
  'customer satisfaction',
  'loyalty score',
  'retention',
  'activation',
  'adoption',
  'availability',
  'completion',
  'conversion',
  'engagement',
  'growth',
  'latency',
  'loyalty',
  'nps',
  'orders',
  'rating',
  'revenue',
  'reviews',
  'roi',
  'satisfaction',
  'score',
  'signups',
  'uptime',
  'users',
  '고객',
  '매출',
  '전환율',
  '재방문',
  '만족도',
]);
const UNIT_PATTERNS = Object.freeze([
  { value: '%', expression: /^\s*%/u, source: /%|\bpercent(?:age)?\b|퍼센트/iu },
  { value: 'x', expression: /^\s*x\b/iu, source: /\b\d+(?:\.\d+)?\s*x\b|\btimes\b|배/iu },
  { value: 'ms', expression: /^\s*ms\b/iu, source: /\bms\b|밀리초/iu },
  { value: 'seconds', expression: /^\s*(?:seconds?|sec)\b/iu, source: /\b(?:seconds?|sec)\b|초/iu },
  { value: 'minutes', expression: /^\s*(?:minutes?|mins?)\b/iu, source: /\b(?:minutes?|mins?)\b|분/iu },
  { value: 'hours', expression: /^\s*(?:hours?|hrs?)\b/iu, source: /\b(?:hours?|hrs?)\b|시간/iu },
  { value: 'days', expression: /^\s*days?\b/iu, source: /\bdays?\b|일/iu },
  { value: 'weeks', expression: /^\s*weeks?\b/iu, source: /\bweeks?\b|주/iu },
  { value: 'months', expression: /^\s*months?\b/iu, source: /\bmonths?\b|개월|달/iu },
  { value: 'years', expression: /^\s*years?\b/iu, source: /\byears?\b|년/iu },
  { value: 'users', expression: /^\s*users?\b/iu, source: /\busers?\b|사용자|명/iu },
  { value: 'customers', expression: /^\s*customers?\b/iu, source: /\bcustomers?\b|고객|명/iu },
  { value: 'orders', expression: /^\s*orders?\b/iu, source: /\borders?\b|건/iu },
  { value: 'requests', expression: /^\s*requests?\b/iu, source: /\brequests?\b|건/iu },
  { value: '원', expression: /^\s*원/u, source: /원/u },
  { value: '명', expression: /^\s*명/u, source: /명/u },
  { value: '건', expression: /^\s*건/u, source: /건/u },
]);
const NUMBER = /(?<![\p{L}\p{N}_])(?:[$€£₩]\s*)?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?/gu;

// A number counts when it ends at a word boundary OR runs directly into a
// unit that UNIT_PATTERNS recognises: "9,999,999원" and "630명" are displayed
// metrics, not word fragments, and must be scanned (and whitelisted, when the
// recipe shows the same figure — both sides share this matcher). The leading
// ,\d tail rejection keeps comma-group truncation impossible ("89,019,000원"
// can never shrink to a "89,019" the page does not display); other letter- or
// digit-run adjacency (87px, 2.9억) stays unscanned as before.
function numberMatches(text) {
  const source = String(text);
  const matches = [];
  for (const match of source.matchAll(NUMBER)) {
    const tail = source.slice(match.index + match[0].length);
    if (/^,\d/u.test(tail)) continue;
    if (/^[\p{L}\p{N}_]/u.test(tail) && !UNIT_PATTERNS.some((unit) => unit.expression.test(tail))) continue;
    matches.push(match);
  }
  return matches;
}

function usage() {
  return 'Usage: node scripts/build-honesty-check.js <built-page.html> --recipe <source-recipe.md> [--brief <source-brief.md>]';
}

function parseArgs(argv) {
  if (!argv.length || argv[0].startsWith('-')) throw new Error(usage());
  const args = { page: argv[0], recipe: null, brief: null };
  for (let index = 1; index < argv.length; index += 1) {
    const flag = argv[index];
    if ((flag !== '--recipe' && flag !== '--brief') || !argv[index + 1]) throw new Error(usage());
    const key = flag.slice(2);
    if (args[key] !== null) throw new Error(usage());
    args[key] = argv[index + 1];
    index += 1;
  }
  if (!args.recipe) throw new Error(usage());
  return args;
}

function readUtf8(file, label) {
  const absolute = path.resolve(file);
  try {
    return { absolute, text: fs.readFileSync(absolute, 'utf8') };
  } catch (error) {
    throw new Error(`cannot read ${label} ${absolute}: ${error.message}`);
  }
}

function preserveNewlines(value) {
  return value.replace(/[^\n]/gu, ' ');
}

function decodeNumericEntities(value) {
  // Decoded first, so a double-escaped literal like &amp;#57; stays literal.
  return value.replace(/&#(x[0-9a-f]+|\d+);/giu, (match, body) => {
    const code = body[0] === 'x' || body[0] === 'X'
      ? Number.parseInt(body.slice(1), 16)
      : Number.parseInt(body, 10);
    if (!Number.isInteger(code) || code < 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return match;
    return String.fromCodePoint(code);
  });
}

function decodeEntities(value) {
  return decodeNumericEntities(value)
    .replace(/&nbsp;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>');
}

function visiblePageLines(html) {
  const withoutNonVisible = String(html)
    .replace(/<!--[^]*?-->/gu, preserveNewlines)
    .replace(/<(script|style|template|noscript)\b[^>]*>[^]*?<\/\1\s*>/giu, preserveNewlines)
    .replace(/<[^>]*>/gu, (tag) => ' '.repeat(tag.length));
  return withoutNonVisible.replace(/\r\n?/gu, '\n').split('\n').map((raw, index) => {
    // Match on the entity-decoded rendering: &#56;&#55; renders as 87 and must
    // be checked as 87, not as its escape-sequence digits (or not at all).
    const decoded = decodeEntities(raw);
    return {
      line: index + 1,
      raw,
      decoded,
      text: decoded.replace(/\s+/gu, ' ').trim(),
    };
  }).filter((line) => line.text);
}

function canonicalNumber(value) {
  return String(value).replace(/[,$€£₩\s]/gu, '').toLocaleLowerCase('en-US');
}

function sourceNumbers(text) {
  return new Set(numberMatches(text).map((match) => canonicalNumber(match[0])));
}

// Only recipe/brief numbers that state CONTENT facts may support page copy.
// Content fences (info string "text") carry verbatim captured page copy from
// derive-recipe.js §4 and STAY whitelisted. Style-token surfaces do not:
// css/code/json fences, the §1 TOKEN BLOCK section, `--…:` CSS declaration
// lines, colorRoles rank lines (60/30/10 — largest/second/third), and
// markdown table rows (measured color inventories).
const TOKEN_BLOCK_HEADING = /^##\s*1\s*·\s*TOKEN BLOCK/u;
const COLOR_ROLE_RANK_LINE = /(?<!\d)(?:60|30|10)\s+—\s+(?:largest|second|third)\b/u;

function proseSourceText(text) {
  const kept = [];
  let fence = null;
  let fenceIsContent = false;
  let inTokenBlock = false;
  for (const line of String(text).replace(/\r\n?/gu, '\n').split('\n')) {
    const marker = line.match(/^\s*(`{3,}|~{3,})\s*([^\s`~]*)/u);
    if (marker && fence === null) {
      fence = marker[1];
      fenceIsContent = marker[2].toLocaleLowerCase('en-US') === 'text';
      continue;
    }
    if (marker && fence !== null && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2]) {
      fence = null;
      fenceIsContent = false;
      continue;
    }
    if (fence !== null) {
      if (fenceIsContent && !inTokenBlock) kept.push(line);
      continue;
    }
    if (/^##\s/u.test(line)) inTokenBlock = TOKEN_BLOCK_HEADING.test(line);
    if (inTokenBlock) continue;
    if (/^\s*--[A-Za-z_][\w-]*\s*:/u.test(line)) continue;
    if (COLOR_ROLE_RANK_LINE.test(line)) continue;
    if (/^\s*\|.*\|\s*$/u.test(line)) continue;
    kept.push(line);
  }
  return kept.join('\n');
}

function normalizedText(value) {
  return String(value).normalize('NFKC').toLocaleLowerCase('en-US').replace(/\s+/gu, ' ').trim();
}

function textContainsPhrase(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&').replace(/\s+/gu, '\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'iu').test(text);
}

function columnFor(raw, index) {
  const prefix = raw.slice(0, index);
  return prefix.length + 1;
}

function tagAt(raw, index) {
  const prefix = raw.slice(0, index);
  const tags = [...prefix.matchAll(/<([A-Za-z][\w:-]*)(?:\s[^>]*)?>/gu)];
  return tags.length ? tags[tags.length - 1][1].toLowerCase() : null;
}

function location(line, index, length) {
  const contextStart = Math.max(0, index - 40);
  const contextEnd = Math.min(line.decoded.length, index + length + 80);
  return {
    line: line.line,
    column: columnFor(line.decoded, index),
    tag: tagAt(line.decoded, index),
    context: line.decoded.slice(contextStart, contextEnd).replace(/\s+/gu, ' ').trim(),
  };
}

function unitAfter(line, index) {
  const tail = line.decoded.slice(index);
  return UNIT_PATTERNS.find((unit) => unit.expression.test(tail)) || null;
}

function metricLabelsInLine(line) {
  const labels = [];
  const occupied = [];
  for (const label of METRIC_LABELS.slice().sort((left, right) => right.length - left.length || left.localeCompare(right, 'en-US'))) {
    const expression = new RegExp(`(?<![\\p{L}\\p{N}_])${label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&').replace(/\s+/gu, '\\s+')}(?![\\p{L}\\p{N}_])`, 'giu');
    for (const match of line.decoded.matchAll(expression)) {
      const start = match.index;
      const end = start + match[0].length;
      if (occupied.some((range) => start >= range.start && end <= range.end)) continue;
      occupied.push({ start, end });
      labels.push({ value: label, index: start, length: match[0].length });
    }
  }
  return labels;
}

function addViolation(violations, kind, value, line, index, length) {
  const item = { kind, value, location: location(line, index, length) };
  const key = `${kind}\u0000${value}\u0000${item.location.line}\u0000${item.location.column}`;
  if (!violations.some((violation) => violation.key === key)) violations.push({ ...item, key });
}

function checkBuildHonesty(pageFile, recipeFile, { briefFile } = {}) {
  const page = readUtf8(pageFile, 'built page');
  const recipe = readUtf8(recipeFile, 'recipe');
  const brief = briefFile ? readUtf8(briefFile, 'brief') : null;
  const facts = [recipe.text, brief && brief.text].filter(Boolean).join('\n');
  const factsNormalized = normalizedText(facts);
  const knownNumbers = sourceNumbers(proseSourceText(facts));
  const violations = [];
  let numberCount = 0;
  let unitCount = 0;
  let labelCount = 0;

  for (const line of visiblePageLines(page.text)) {
    for (const match of numberMatches(line.decoded)) {
      numberCount += 1;
      const value = canonicalNumber(match[0]);
      if (!knownNumbers.has(value)) addViolation(violations, 'number', match[0].trim(), line, match.index, match[0].length);
      const unit = unitAfter(line, match.index + match[0].length);
      if (unit) {
        unitCount += 1;
        if (!unit.source.test(facts)) addViolation(violations, 'unit', unit.value, line, match.index + match[0].length, unit.value.length);
      }
    }
    for (const label of metricLabelsInLine(line)) {
      labelCount += 1;
      if (!textContainsPhrase(factsNormalized, normalizedText(label.value))) {
        addViolation(violations, 'label', label.value, line, label.index, label.length);
      }
    }
  }

  const ordered = violations
    .map(({ key, ...violation }) => violation)
    .sort((left, right) => left.location.line - right.location.line
      || left.location.column - right.location.column
      || left.kind.localeCompare(right.kind, 'en-US')
      || left.value.localeCompare(right.value, 'en-US'));
  return {
    status: ordered.length ? 'refused' : 'clean',
    page: page.absolute,
    recipe: recipe.absolute,
    brief: brief && brief.absolute,
    checked: { numbers: numberCount, units: unitCount, labels: labelCount },
    violations: ordered,
  };
}

function formatViolation(violation, page) {
  const where = `${page}:${violation.location.line}:${violation.location.column}`;
  return `UNSUPPORTED ${violation.kind} ${JSON.stringify(violation.value)} at ${where}${violation.location.tag ? ` (${violation.location.tag})` : ''} — ${violation.location.context}`;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const report = checkBuildHonesty(args.page, args.recipe, { briefFile: args.brief });
  if (report.status !== 'clean') {
    console.error(REFUSAL_MESSAGE);
    for (const violation of report.violations) console.error(formatViolation(violation, report.page));
    process.exitCode = 1;
    return report;
  }
  console.log(`PASS build-honesty-check — ${report.checked.numbers} number(s), ${report.checked.units} unit(s), and ${report.checked.labels} metric label(s) trace to recipe/brief.`);
  return report;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`FAIL build-honesty-check: ${error.message}`);
    process.exitCode = 2;
  }
}

module.exports = {
  METRIC_LABELS,
  REFUSAL_MESSAGE,
  UNIT_PATTERNS,
  checkBuildHonesty,
  main,
  parseArgs,
  visiblePageLines,
};
