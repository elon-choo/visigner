'use strict';

const assert = require('node:assert');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const CHECKER = path.join(REPO, 'scripts', 'anti-pattern-check.js');
const FIXTURES = path.join(__dirname, 'fixtures', 'anti-pattern-check');
const TABLES_DIR = path.join(REPO, 'skills', 'detail-page', 'references', 'corpus', 'anti-patterns');
const REASONING_DIR = path.join(REPO, 'skills', 'detail-page', 'references', 'corpus', 'reasoning');

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

test('slop fixture reports a named HIGH anti-pattern and exits non-zero', () => {
  const result = run(
    '--page', path.join(FIXTURES, 'slop.html'),
    '--category', 'portfolio-site',
  );
  assert.strictEqual(result.status, 1, result.stderr);
  const output = report(result);
  assert.strictEqual(output.status, 'FAIL');
  const hit = output.hits.find((entry) => entry.id === 'portfolio-site-ai-indigo-gradient-hero');
  assert.ok(hit, JSON.stringify(output, null, 2));
  assert.strictEqual(hit.severity, 'HIGH');
  assert.strictEqual(hit.title, 'AI-indigo/purple 135deg gradient hero');
  assert.match(result.stderr, /HIGH HIT portfolio-site-ai-indigo-gradient-hero/u);
});

test('clean fixture exits zero and leaves judgment-only rows explicitly unchecked', () => {
  const result = run(
    '--page', path.join(FIXTURES, 'clean.html'),
    '--category', 'portfolio-site',
  );
  assert.strictEqual(result.status, 0, result.stderr);
  const output = report(result);
  assert.strictEqual(output.status, 'PASS');
  assert.strictEqual(output.counts.HIGH, 0);
  assert.ok(output.unchecked.length > 0);
  assert.ok(output.unchecked.every((entry) => entry.state === 'UNCHECKED'));
});

test('unknown category is an explicit MISS and exits non-zero', () => {
  const result = run(
    '--page', path.join(FIXTURES, 'clean.html'),
    '--category', 'not-a-real-category',
  );
  assert.notStrictEqual(result.status, 0);
  const output = report(result);
  assert.strictEqual(output.status, 'MISS');
  assert.match(output.message, /This is a MISS, not an empty pass/u);
  assert.match(result.stderr, /^MISS:/mu);
});

test('anti-pattern tables validate and exactly cover the reasoning categories', () => {
  const result = run('--validate-tables');
  assert.strictEqual(result.status, 0, result.stderr);
  const output = report(result);
  assert.strictEqual(output.status, 'VALID');
  assert.ok(output.category_count >= 12);

  const tableCategories = fs.readdirSync(TABLES_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(fs.readFileSync(path.join(TABLES_DIR, file), 'utf8')).category)
    .sort();
  const reasoningCategories = fs.readdirSync(REASONING_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(fs.readFileSync(path.join(REASONING_DIR, file), 'utf8')).category)
    .sort();
  assert.deepStrictEqual(tableCategories, reasoningCategories);
  assert.deepStrictEqual(output.categories, reasoningCategories);
});
