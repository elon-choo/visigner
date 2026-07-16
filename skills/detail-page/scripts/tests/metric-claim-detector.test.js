'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const {
  KINDS,
  REVIEW_NOTE,
  detectMetricClaims,
} = require(path.join(ROOT, 'hooks', 'human-gate', 'metric-claim-detector.js'));

const FIXTURES = path.join(__dirname, 'fixtures');
const MIXED_PAGE = path.join(FIXTURES, 'g3-metric-claims-mixed', 'index.html');

test('unsourced metrics and claims are flagged while cited claims stay unflagged and bytes stay unchanged', () => {
  const before = fs.readFileSync(MIXED_PAGE);
  const report = detectMetricClaims(MIXED_PAGE);
  const after = fs.readFileSync(MIXED_PAGE);

  assert.strictEqual(report.status, 'human-verification-required');
  assert.strictEqual(report.zeroNetwork, true);
  assert.strictEqual(report.flagCount, 9);
  assert.strictEqual(report.items.filter((item) => item.kind === KINDS.UNSOURCED_METRIC).length, 5);
  assert.strictEqual(report.items.filter((item) => item.kind === KINDS.SUPERLATIVE).length, 2);
  assert.strictEqual(report.items.filter((item) => item.kind === KINDS.REGULATED_CLAIM).length, 2);
  assert.deepStrictEqual(report.items.map((item) => item.claim), [
    '99.9% uptime',
    '10,000+ users',
    '#1',
    '3x faster',
    'Rated 4.9/5',
    'the best',
    'guaranteed',
    'clinically proven',
    'FDA approved',
  ]);
  for (const item of report.items) {
    assert.strictEqual(item.note, REVIEW_NOTE);
    assert.ok(item.location.line > 0);
    assert.ok(item.location.context);
    assert.ok(!Object.hasOwn(item, 'source'));
    assert.ok(!Object.hasOwn(item, 'replacement'));
  }
  assert.ok(report.substantiatedClaims.some((item) => item.claim === '10,000+ users'));
  assert.ok(before.equals(after), 'detector must not mutate the produced page');
  assert.deepStrictEqual(report.errors, []);
});

test('identical 99.9% shapes split only by citation: uncited flags and cited does not', () => {
  const report = detectMetricClaims(MIXED_PAGE);
  const flagged = report.items.filter((item) => item.claim === '99.9% uptime');
  const cited = report.substantiatedClaims.filter((item) => item.claim === '99.9% uptime');

  assert.strictEqual(flagged.length, 1);
  assert.strictEqual(flagged[0].location.tag, 'p#uncited-uptime');
  assert.strictEqual(cited.length, 1);
  assert.strictEqual(cited[0].location.tag, 'p#cited-uptime');
  assert.match(cited[0].citationSignal, /data attribution|cite element|source link/);
});

test('legitimate specific marketing numbers with nearby substantiation have zero false stops', () => {
  const page = path.join(FIXTURES, 'g3-metric-claims-cited', 'index.html');
  const before = fs.readFileSync(page);
  const report = detectMetricClaims(page);
  const after = fs.readFileSync(page);

  assert.strictEqual(report.status, 'clean');
  assert.strictEqual(report.flagCount, 0);
  assert.deepStrictEqual(report.items, []);
  assert.strictEqual(report.substantiatedCount, 7);
  assert.ok(before.equals(after));

  const unavailable = detectMetricClaims(path.join(FIXTURES, 'missing-metric-page', 'index.html'));
  assert.strictEqual(unavailable.status, 'unavailable');
  assert.strictEqual(unavailable.flagCount, 0);
  assert.strictEqual(unavailable.errors.length, 1);
});

