'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_REASONING_DIR = path.join(ROOT, 'references', 'corpus', 'reasoning');
const REQUIRED_FIELDS = Object.freeze([
  'category',
  'recommended_pattern',
  'decision_rules',
  'anti_patterns',
  'severity',
]);
const SEVERITIES = new Set(['LOW', 'MEDIUM', 'HIGH']);
const TAXONOMY_CATEGORIES = new Set([
  'app-ui-surface',
  'mobile-app-screen',
  'email',
  'motion-reel',
  'kr-crowdfunding',
  'kr-detail-page',
  'ecommerce-pdp',
  'pricing-page',
  'portfolio-site',
  'editorial-publication',
  'brand-site',
  'campaign-microsite',
  'saas-marketing-site',
  'landing-page',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function displayPath(filePath) {
  return path.relative(process.cwd(), filePath) || filePath;
}

// JSON.parse accepts duplicate object keys and keeps only the last value. This
// small raw parser runs after JSON.parse has confirmed syntax, preserving the
// original key stream solely to catch duplicates under decision_rules.
function findDuplicateDecisionRuleKeys(raw) {
  let index = 0;
  const duplicates = [];

  function fail(message) {
    throw new SyntaxError(`raw JSON scan failed at character ${index}: ${message}`);
  }

  function skipWhitespace() {
    while (/\s/u.test(raw[index] || '')) index += 1;
  }

  function expect(character) {
    skipWhitespace();
    if (raw[index] !== character) fail(`expected ${JSON.stringify(character)}`);
    index += 1;
  }

  function readString() {
    skipWhitespace();
    if (raw[index] !== '"') fail('expected a JSON string');
    const start = index;
    index += 1;
    while (index < raw.length) {
      const character = raw[index];
      if (character === '"') {
        index += 1;
        return JSON.parse(raw.slice(start, index));
      }
      if (character === '\\') {
        index += 2;
        continue;
      }
      index += 1;
    }
    fail('unterminated JSON string');
  }

  function readPrimitive() {
    skipWhitespace();
    const start = index;
    while (index < raw.length && !/[\s,\]}]/u.test(raw[index])) index += 1;
    if (start === index) fail('expected a JSON value');
  }

  function formatPath(parts) {
    return `$${parts.map((part) => `.${part}`).join('')}`;
  }

  function readArray(parts) {
    expect('[');
    skipWhitespace();
    if (raw[index] === ']') {
      index += 1;
      return;
    }
    let itemIndex = 0;
    while (true) {
      readValue(parts.concat(`[${itemIndex}]`));
      itemIndex += 1;
      skipWhitespace();
      if (raw[index] === ']') {
        index += 1;
        return;
      }
      expect(',');
    }
  }

  function readObject(parts) {
    expect('{');
    const keys = new Set();
    const inspectKeys = parts[0] === 'decision_rules';
    skipWhitespace();
    if (raw[index] === '}') {
      index += 1;
      return;
    }
    while (true) {
      const key = readString();
      if (inspectKeys && keys.has(key)) {
        duplicates.push({ key, path: formatPath(parts) });
      }
      keys.add(key);
      expect(':');
      readValue(parts.concat(key));
      skipWhitespace();
      if (raw[index] === '}') {
        index += 1;
        return;
      }
      expect(',');
    }
  }

  function readValue(parts) {
    skipWhitespace();
    if (raw[index] === '{') return readObject(parts);
    if (raw[index] === '[') return readArray(parts);
    if (raw[index] === '"') {
      readString();
      return;
    }
    readPrimitive();
  }

  readValue([]);
  skipWhitespace();
  if (index !== raw.length) fail('unexpected trailing data');
  return duplicates;
}

function validateRecord(record, filePath) {
  const errors = [];
  if (!isPlainObject(record)) return ['record must be a JSON object'];

  for (const field of REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) {
      errors.push(`missing required field ${field}`);
    }
  }

  if (typeof record.category !== 'string' || record.category.trim() === '') {
    errors.push('category must be a non-empty string');
  } else if (!TAXONOMY_CATEGORIES.has(record.category)) {
    errors.push(`category ${JSON.stringify(record.category)} is not in TAXONOMY.md §1`);
  }

  if (typeof record.recommended_pattern !== 'string' || record.recommended_pattern.trim() === '') {
    errors.push('recommended_pattern must be a non-empty string');
  }

  if (!isPlainObject(record.decision_rules)) {
    errors.push('decision_rules must be a JSON object');
  } else {
    for (const [condition, directive] of Object.entries(record.decision_rules)) {
      if (!condition.trim()) errors.push('decision_rules cannot contain an empty condition key');
      if (typeof directive !== 'string' || directive.trim() === '') {
        errors.push(`decision_rules.${condition} must be a non-empty string`);
      }
    }
  }

  if (!Array.isArray(record.anti_patterns) || record.anti_patterns.length === 0) {
    errors.push('anti_patterns must be a non-empty array');
  } else if (record.anti_patterns.some((item) => typeof item !== 'string' || item.trim() === '')) {
    errors.push('anti_patterns must contain only non-empty strings');
  }

  if (!SEVERITIES.has(record.severity)) {
    errors.push(`severity must be one of ${Array.from(SEVERITIES).join(', ')}`);
  }

  if (filePath && path.basename(filePath, '.json') !== record.category) {
    errors.push(`file name must equal category (${record.category}.json)`);
  }
  return errors;
}

function collectRecordFiles(target = DEFAULT_REASONING_DIR) {
  const resolved = path.resolve(target);
  if (!fs.existsSync(resolved)) throw new Error(`reasoning path does not exist: ${displayPath(resolved)}`);
  const stat = fs.statSync(resolved);
  if (stat.isFile()) {
    if (path.extname(resolved) !== '.json') throw new Error(`reasoning record must be a .json file: ${displayPath(resolved)}`);
    return [resolved];
  }
  if (!stat.isDirectory()) throw new Error(`reasoning path is neither a file nor directory: ${displayPath(resolved)}`);

  return fs.readdirSync(resolved, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(resolved, entry.name))
    .sort();
}

function validateFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  let record;
  try {
    record = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${displayPath(filePath)}: invalid JSON: ${error.message}`);
  }

  const duplicates = findDuplicateDecisionRuleKeys(raw);
  if (duplicates.length) {
    const first = duplicates[0];
    throw new Error(`${displayPath(filePath)}: duplicate JSON key ${JSON.stringify(first.key)} inside decision_rules at ${first.path}`);
  }

  const errors = validateRecord(record, filePath);
  if (errors.length) throw new Error(`${displayPath(filePath)}: ${errors.join('; ')}`);
  return record;
}

function validateTarget(target = DEFAULT_REASONING_DIR) {
  const files = collectRecordFiles(target);
  if (!files.length) throw new Error('no reasoning records found — this is a database miss, not an empty value; do not invent one.');
  const records = files.map((filePath) => ({ filePath, record: validateFile(filePath) }));
  return { files, records };
}

function runCli(argv = process.argv.slice(2)) {
  if (argv.length > 1 || argv[0] === '--help' || argv[0] === '-h') {
    const stream = argv[0] === '--help' || argv[0] === '-h' ? process.stdout : process.stderr;
    stream.write('Usage: node scripts/reasoning-validate.js [reasoning-dir-or-record.json]\n');
    return argv[0] === '--help' || argv[0] === '-h' ? 0 : 1;
  }
  try {
    const result = validateTarget(argv[0] || DEFAULT_REASONING_DIR);
    const categories = result.records.map(({ record }) => record.category).join(', ');
    console.log(`PASS — ${result.records.length} reasoning record(s) valid across ${result.records.length} categories: ${categories}`);
    return 0;
  } catch (error) {
    console.error(`FAIL — ${error.message}`);
    return 1;
  }
}

if (require.main === module) process.exitCode = runCli();

module.exports = {
  DEFAULT_REASONING_DIR,
  REQUIRED_FIELDS,
  SEVERITIES,
  TAXONOMY_CATEGORIES,
  collectRecordFiles,
  findDuplicateDecisionRuleKeys,
  runCli,
  validateFile,
  validateRecord,
  validateTarget,
};
