#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_TABLES_DIR = path.join(
  ROOT,
  'skills',
  'detail-page',
  'references',
  'corpus',
  'anti-patterns',
);
const DEFAULT_REASONING_DIR = path.join(
  ROOT,
  'skills',
  'detail-page',
  'references',
  'corpus',
  'reasoning',
);
const SEVERITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const DETECT_TYPES = new Set(['css-gradient', 'css-pattern', 'dom-pattern', 'manual']);
const CATEGORY_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function usage() {
  return [
    'Usage:',
    '  node scripts/anti-pattern-check.js --page <built.html> --category <category>',
    '  node scripts/anti-pattern-check.js --validate-tables',
    '',
    'Normal check mode requires both --page and --category; there is no category default.',
  ].join('\n');
}

function parseArgs(argv) {
  const result = {
    page: null,
    category: null,
    tablesDir: DEFAULT_TABLES_DIR,
    reasoningDir: DEFAULT_REASONING_DIR,
    validateTables: false,
    help: false,
  };
  const flagMap = new Map([
    ['--page', 'page'],
    ['--category', 'category'],
    ['--tables-dir', 'tablesDir'],
    ['--reasoning-dir', 'reasoningDir'],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--validate-tables') {
      result.validateTables = true;
      continue;
    }
    if (argument === '--help' || argument === '-h') {
      result.help = true;
      continue;
    }
    if (!flagMap.has(argument)) {
      throw new Error(`unknown argument: ${argument}`);
    }
    const key = flagMap.get(argument);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`${argument} requires a value`);
    }
    if (result[key] !== null && result[key] !== DEFAULT_TABLES_DIR && result[key] !== DEFAULT_REASONING_DIR) {
      throw new Error(`${argument} may only be supplied once`);
    }
    result[key] = value;
    index += 1;
  }
  return result;
}

function readJson(filePath) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${filePath}: ${error.message}`);
  }
  return parsed;
}

function makeRegex(pattern, flags = '') {
  if (typeof pattern !== 'string' || !pattern) {
    throw new Error('detect.regex must be a non-empty string');
  }
  if (typeof flags !== 'string' || /[^dgimsuvy]/u.test(flags)) {
    throw new Error('detect.flags may contain only JavaScript RegExp flags');
  }
  try {
    return new RegExp(pattern, flags.replace(/g/gu, '') + 'g');
  } catch (error) {
    throw new Error(`invalid detect.regex: ${error.message}`);
  }
}

function validateDetect(detect, label) {
  if (!detect || typeof detect !== 'object' || Array.isArray(detect)) {
    throw new Error(`${label}.detect must be an object`);
  }
  if (!DETECT_TYPES.has(detect.type)) {
    throw new Error(`${label}.detect.type must be css-gradient, css-pattern, dom-pattern, or manual`);
  }
  if (detect.type === 'css-gradient') {
    if (!Array.isArray(detect.hues) || detect.hues.length < 2 || !detect.hues.every((hue) => typeof hue === 'string')) {
      throw new Error(`${label}.detect.hues must name at least two hues`);
    }
    if (detect.angle !== undefined && typeof detect.angle !== 'number') {
      throw new Error(`${label}.detect.angle must be a number when supplied`);
    }
    if (detect.maxAngleTolerance !== undefined && typeof detect.maxAngleTolerance !== 'number') {
      throw new Error(`${label}.detect.maxAngleTolerance must be a number when supplied`);
    }
    if (detect.angle !== undefined && detect.maxAngleTolerance === undefined) {
      throw new Error(`${label}.detect.maxAngleTolerance is required when detect.angle is supplied`);
    }
    return;
  }
  if (detect.type === 'css-pattern' || detect.type === 'dom-pattern') {
    makeRegex(detect.regex, detect.flags || '');
    if (detect.minMatches !== undefined && (!Number.isInteger(detect.minMatches) || detect.minMatches < 1)) {
      throw new Error(`${label}.detect.minMatches must be a positive integer when supplied`);
    }
  }
}

function validateTable(table, sourcePath = 'table') {
  if (!table || typeof table !== 'object' || Array.isArray(table)) {
    throw new Error(`${sourcePath}: table must be an object`);
  }
  if (typeof table.category !== 'string' || !CATEGORY_RE.test(table.category)) {
    throw new Error(`${sourcePath}: category must be a lowercase hyphenated identifier`);
  }
  if (!Array.isArray(table.anti_patterns) || table.anti_patterns.length === 0) {
    throw new Error(`${sourcePath}: anti_patterns must be a non-empty array`);
  }
  const ids = new Set();
  for (const [index, row] of table.anti_patterns.entries()) {
    const label = `${sourcePath}.anti_patterns[${index}]`;
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`${label} must be an object`);
    }
    if (typeof row.id !== 'string' || !CATEGORY_RE.test(row.id)) {
      throw new Error(`${label}.id must be a lowercase hyphenated identifier`);
    }
    if (ids.has(row.id)) {
      throw new Error(`${sourcePath}: duplicate anti-pattern id ${row.id}`);
    }
    ids.add(row.id);
    if (typeof row.title !== 'string' || !row.title.trim()) {
      throw new Error(`${label}.title must be non-empty`);
    }
    if (!Object.hasOwn(SEVERITY_RANK, row.severity)) {
      throw new Error(`${label}.severity must be HIGH, MEDIUM, or LOW`);
    }
    if (typeof row.do_not !== 'string' || !row.do_not.trim()) {
      throw new Error(`${label}.do_not must be non-empty prose`);
    }
    validateDetect(row.detect, label);
    if (row.good_bad !== undefined) {
      if (!row.good_bad || typeof row.good_bad !== 'object' || Array.isArray(row.good_bad)
        || typeof row.good_bad.good !== 'string' || typeof row.good_bad.bad !== 'string') {
        throw new Error(`${label}.good_bad must contain string good and bad examples`);
      }
    }
  }
  return table;
}

function jsonFiles(directory) {
  try {
    return fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => path.join(directory, entry.name))
      .sort();
  } catch (error) {
    throw new Error(`cannot read ${directory}: ${error.message}`);
  }
}

function validateTables(tablesDir = DEFAULT_TABLES_DIR, reasoningDir = DEFAULT_REASONING_DIR) {
  const tableFiles = jsonFiles(tablesDir);
  const tables = tableFiles.map((filePath) => validateTable(readJson(filePath), filePath));
  const categories = new Set();
  for (const table of tables) {
    if (categories.has(table.category)) {
      throw new Error(`duplicate category table: ${table.category}`);
    }
    categories.add(table.category);
  }
  if (categories.size < 12) {
    throw new Error(`expected at least 12 anti-pattern category tables, found ${categories.size}`);
  }

  const reasoningFiles = jsonFiles(reasoningDir);
  const reasoningCategories = new Set();
  for (const filePath of reasoningFiles) {
    const record = readJson(filePath);
    if (typeof record.category !== 'string' || !CATEGORY_RE.test(record.category)) {
      throw new Error(`${filePath}: reasoning category must be a lowercase hyphenated identifier`);
    }
    reasoningCategories.add(record.category);
  }
  if (reasoningCategories.size < 12) {
    throw new Error(`expected at least 12 reasoning categories, found ${reasoningCategories.size}`);
  }
  const missing = [...reasoningCategories].filter((category) => !categories.has(category)).sort();
  const extra = [...categories].filter((category) => !reasoningCategories.has(category)).sort();
  if (missing.length || extra.length) {
    throw new Error(`category coverage mismatch: missing=[${missing.join(', ')}] extra=[${extra.join(', ')}]`);
  }

  return {
    table_count: tableFiles.length,
    category_count: categories.size,
    categories: [...categories].sort(),
    reasoning_category_count: reasoningCategories.size,
  };
}

function countMatches(source, regex) {
  const matches = [];
  for (const match of source.matchAll(regex)) {
    matches.push({
      index: match.index,
      text: match[0],
    });
  }
  return matches;
}

function snippet(source, index, length = 220) {
  return source.slice(index, index + length).replace(/\s+/gu, ' ').trim();
}

function readPage(pagePath) {
  const absolutePage = path.resolve(pagePath);
  let html;
  try {
    html = fs.readFileSync(absolutePage, 'utf8');
  } catch (error) {
    throw new Error(`cannot read page ${absolutePage}: ${error.message}`);
  }
  const cssParts = [html];
  const linkedStylesheets = [];
  const linkMatcher = /<link\b[^>]*\brel\s*=\s*["']?stylesheet["']?[^>]*>/giu;
  for (const link of html.matchAll(linkMatcher)) {
    const hrefMatch = /\bhref\s*=\s*["']([^"']+)["']/iu.exec(link[0]);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    if (/^(?:https?:|data:|\/\/|#)/iu.test(href)) continue;
    const localPath = path.resolve(path.dirname(absolutePage), href.split(/[?#]/u, 1)[0]);
    if (!fs.existsSync(localPath) || !fs.statSync(localPath).isFile()) continue;
    cssParts.push(fs.readFileSync(localPath, 'utf8'));
    linkedStylesheets.push(localPath);
  }
  return {
    absolutePage,
    html,
    cssSource: cssParts.join('\n'),
    linkedStylesheets,
  };
}

function rgbFromHex(value) {
  let hex = value.slice(1);
  if (hex.length === 3 || hex.length === 4) {
    hex = hex.slice(0, 3).split('').map((character) => character + character).join('');
  } else {
    hex = hex.slice(0, 6);
  }
  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function hueName(color) {
  const named = {
    blue: 'blue',
    indigo: 'purple',
    violet: 'purple',
    purple: 'purple',
    fuchsia: 'pink',
    magenta: 'pink',
    pink: 'pink',
  };
  if (named[color.toLowerCase()]) return named[color.toLowerCase()];
  const { red, green, blue } = rgbFromHex(color);
  const redUnit = red / 255;
  const greenUnit = green / 255;
  const blueUnit = blue / 255;
  const maximum = Math.max(redUnit, greenUnit, blueUnit);
  const minimum = Math.min(redUnit, greenUnit, blueUnit);
  const delta = maximum - minimum;
  if (delta === 0) return 'neutral';
  let hue;
  if (maximum === redUnit) hue = 60 * (((greenUnit - blueUnit) / delta) % 6);
  else if (maximum === greenUnit) hue = 60 * ((blueUnit - redUnit) / delta + 2);
  else hue = 60 * ((redUnit - greenUnit) / delta + 4);
  if (hue < 0) hue += 360;
  if (hue >= 190 && hue < 250) return 'blue';
  if (hue >= 250 && hue < 325) return 'purple';
  if (hue >= 325 || hue < 15) return 'pink';
  return 'other';
}

function angularDistance(first, second) {
  const difference = Math.abs(first - second) % 360;
  return Math.min(difference, 360 - difference);
}

function findGradientHits(cssSource, detect) {
  const matches = [];
  const gradientMatcher = /linear-gradient\(\s*([^;{}]*?)\)/giu;
  for (const match of cssSource.matchAll(gradientMatcher)) {
    const content = match[1];
    const angleMatch = /^\s*(-?(?:\d+(?:\.\d+)?)?)deg\s*,/iu.exec(content);
    const angle = angleMatch ? Number(angleMatch[1]) : null;
    if (detect.angle !== undefined && (angle === null || angularDistance(angle, detect.angle) > detect.maxAngleTolerance)) {
      continue;
    }
    const colors = [];
    for (const colorMatch of content.matchAll(/#[0-9a-f]{3,8}\b|\b(?:blue|indigo|violet|purple|fuchsia|magenta|pink)\b/giu)) {
      colors.push({ value: colorMatch[0], hue: hueName(colorMatch[0]) });
    }
    const presentHues = new Set(colors.map((color) => color.hue));
    if (!detect.hues.every((hue) => presentHues.has(hue.toLowerCase()))) continue;
    matches.push({
      index: match.index,
      gradient: match[0],
      angle,
      hues: [...presentHues].sort(),
    });
  }
  return matches;
}

function executeDetect(detect, page) {
  if (detect.type === 'manual') return null;
  if (detect.type === 'css-gradient') {
    const matches = findGradientHits(page.cssSource, detect);
    if (!matches.length) return null;
    return {
      match_count: matches.length,
      evidence: matches.slice(0, 3).map((match) => ({
        angle: match.angle,
        hues: match.hues,
        snippet: snippet(page.cssSource, match.index),
      })),
    };
  }
  const source = detect.type === 'css-pattern' ? page.cssSource : page.html;
  const matches = countMatches(source, makeRegex(detect.regex, detect.flags || ''));
  const requiredMatches = detect.minMatches || 1;
  if (matches.length < requiredMatches) return null;
  return {
    match_count: matches.length,
    evidence: matches.slice(0, 3).map((match) => ({ snippet: snippet(source, match.index) })),
  };
}

function loadCategoryTable(category, tablesDir) {
  if (!CATEGORY_RE.test(category)) return null;
  const filePath = path.join(tablesDir, `${category}.json`);
  if (!fs.existsSync(filePath)) return null;
  const table = validateTable(readJson(filePath), filePath);
  if (table.category !== category) {
    throw new Error(`${filePath}: file category ${table.category} does not match requested category ${category}`);
  }
  return table;
}

function ranked(rows) {
  return rows.sort((first, second) => SEVERITY_RANK[first.severity] - SEVERITY_RANK[second.severity]
    || first.id.localeCompare(second.id));
}

function reportForPage(pagePath, category, tablesDir = DEFAULT_TABLES_DIR) {
  const table = loadCategoryTable(category, tablesDir);
  if (!table) {
    return {
      status: 'MISS',
      category,
      message: `No anti-pattern table exists for category "${category}". This is a MISS, not an empty pass.`,
    };
  }
  const page = readPage(pagePath);
  const hits = [];
  const unchecked = [];
  for (const row of table.anti_patterns) {
    if (row.detect.type === 'manual') {
      unchecked.push({
        id: row.id,
        title: row.title,
        severity: row.severity,
        do_not: row.do_not,
        state: 'UNCHECKED',
      });
      continue;
    }
    const result = executeDetect(row.detect, page);
    if (!result) continue;
    hits.push({
      id: row.id,
      title: row.title,
      severity: row.severity,
      do_not: row.do_not,
      detect: row.detect,
      state: 'HIT',
      ...result,
    });
  }
  ranked(hits);
  ranked(unchecked);
  const counts = { HIGH: 0, MEDIUM: 0, LOW: 0, UNCHECKED: unchecked.length };
  for (const hit of hits) counts[hit.severity] += 1;
  return {
    status: hits.some((hit) => hit.severity === 'HIGH') ? 'FAIL' : 'PASS',
    category,
    page: page.absolutePage,
    analysis: {
      mode: 'static-html-and-local-css',
      linked_stylesheets: page.linkedStylesheets,
    },
    hits,
    unchecked,
    counts,
  };
}

function writeSummary(report) {
  if (report.status === 'MISS') {
    process.stderr.write(`MISS: ${report.message}\n`);
    return;
  }
  const lines = [
    `ANTI-PATTERN CHECK: ${report.category}`,
    `HITS: HIGH=${report.counts.HIGH} MEDIUM=${report.counts.MEDIUM} LOW=${report.counts.LOW}`,
  ];
  for (const hit of report.hits) lines.push(`${hit.severity} HIT ${hit.id}: ${hit.title}`);
  for (const row of report.unchecked) lines.push(`UNCHECKED ${row.severity} ${row.id}: ${row.title}`);
  lines.push(report.status === 'FAIL'
    ? 'RESULT: FAIL (one or more HIGH anti-pattern hits fired)'
    : 'RESULT: PASS (no HIGH anti-pattern hits; manual rows remain UNCHECKED)');
  process.stderr.write(`${lines.join('\n')}\n`);
}

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    writeJson({ status: 'MISS', message: error.message });
    process.stderr.write(`MISS: ${error.message}\n${usage()}\n`);
    return 2;
  }
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  try {
    if (options.validateTables) {
      if (options.page || options.category) {
        throw new Error('--validate-tables is a separate mode and cannot be combined with --page or --category');
      }
      const validation = validateTables(options.tablesDir, options.reasoningDir);
      writeJson({ status: 'VALID', ...validation });
      process.stderr.write(`VALID: ${validation.category_count} anti-pattern categories exactly cover ${validation.reasoning_category_count} reasoning categories.\n`);
      return 0;
    }
    if (!options.page || !options.category) {
      throw new Error('--page and --category are both required; no category default is available');
    }
    const report = reportForPage(options.page, options.category, options.tablesDir);
    writeJson(report);
    writeSummary(report);
    return report.status === 'MISS' ? 2 : report.status === 'FAIL' ? 1 : 0;
  } catch (error) {
    writeJson({ status: 'MISS', category: options.category, message: error.message });
    process.stderr.write(`MISS: ${error.message}\n`);
    return 2;
  }
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  DEFAULT_REASONING_DIR,
  DEFAULT_TABLES_DIR,
  main,
  reportForPage,
  validateTable,
  validateTables,
};
