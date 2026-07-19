'use strict';

const assert = require('node:assert');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const CHECKER = path.join(REPO, 'scripts', 'anti-pattern-check.js');
const FIXTURES = path.join(__dirname, 'fixtures', 'gc2-enrichment');
const TABLES_DIR = path.join(REPO, 'skills', 'detail-page', 'references', 'corpus', 'anti-patterns');
const EXECUTABLE_TYPES = new Set(['css-gradient', 'css-pattern', 'dom-pattern']);
const CATEGORIES = [
  {
    category: 'kr-detail-page',
    expectedHit: 'kr-detail-page-ai-purple-pink-gradient-hero',
  },
  {
    category: 'ecommerce-pdp',
    expectedHit: 'ecommerce-pdp-detached-buy-control-marker',
  },
  {
    category: 'mobile-app-screen',
    expectedHit: 'mobile-app-screen-undersized-touch-control',
  },
  {
    category: 'pricing-page',
    expectedHit: 'pricing-page-feature-without-limit-marker',
  },
];

function run(...args) {
  const result = childProcess.spawnSync(process.execPath, [CHECKER, ...args], {
    cwd: REPO,
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.ifError(result.error);
  return result;
}

function report(result) {
  return JSON.parse(result.stdout);
}

test('GC.2 formerly manual-only tables validate with at least three executable rows each', () => {
  const { validateTable } = require(CHECKER);
  for (const { category } of CATEGORIES) {
    const filePath = path.join(TABLES_DIR, `${category}.json`);
    const table = validateTable(JSON.parse(fs.readFileSync(filePath, 'utf8')), filePath);
    const executableRows = table.anti_patterns.filter((row) => EXECUTABLE_TYPES.has(row.detect.type));
    assert.ok(executableRows.length >= 3, `${category} has ${executableRows.length} executable rows`);
  }
});

test('GC.2 firing fixtures produce a named HIGH machine hit and non-zero exit per category', () => {
  for (const { category, expectedHit } of CATEGORIES) {
    const result = run(
      '--page', path.join(FIXTURES, `${category}-firing.html`),
      '--category', category,
    );
    assert.strictEqual(result.status, 1, `${category}\n${result.stderr}`);
    const output = report(result);
    assert.strictEqual(output.status, 'FAIL', category);
    const hit = output.hits.find((entry) => entry.id === expectedHit);
    assert.ok(hit, `${category} missing ${expectedHit}\n${result.stdout}`);
    assert.strictEqual(hit.severity, 'HIGH');
    assert.ok(EXECUTABLE_TYPES.has(hit.detect.type), `${expectedHit} is not executable`);
  }
});

test('GC.2 clean fixtures exit zero per category', () => {
  for (const { category } of CATEGORIES) {
    const result = run(
      '--page', path.join(FIXTURES, `${category}-clean.html`),
      '--category', category,
    );
    assert.strictEqual(result.status, 0, `${category}\n${result.stderr}`);
    const output = report(result);
    assert.strictEqual(output.status, 'PASS', category);
    assert.strictEqual(output.counts.HIGH, 0, category);
  }
});

test('GC.2 table validation remains exactly 12 of 12 categories', () => {
  const result = run('--validate-tables');
  assert.strictEqual(result.status, 0, result.stderr);
  const output = report(result);
  assert.strictEqual(output.status, 'VALID');
  assert.strictEqual(output.table_count, 12);
  assert.strictEqual(output.category_count, 12);
  assert.strictEqual(output.reasoning_category_count, 12);
});
