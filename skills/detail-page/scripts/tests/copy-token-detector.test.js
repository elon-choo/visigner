'use strict';

const assert = require('assert');
const path = require('path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const {
  KINDS,
  detectCopyTokenGaps,
} = require(path.join(ROOT, 'hooks', 'human-gate', 'copy-token-detector.js'));

const FIXTURES = path.join(__dirname, 'fixtures');

test('planted copy fixture enumerates lorem, TODO, template token, and empty heading once each', () => {
  const page = path.join(FIXTURES, 'g3-copy-token-gaps', 'index.html');
  const report = detectCopyTokenGaps(page);

  assert.strictEqual(report.status, 'gaps-detected');
  assert.strictEqual(report.zeroNetwork, true);
  assert.strictEqual(report.gapCount, 4);
  assert.deepStrictEqual(
    report.items.map((item) => item.kind).sort(),
    [KINDS.EMPTY_HEADING, KINDS.LOREM, KINDS.STAND_IN, KINDS.TEMPLATE_TOKEN].sort(),
  );
  assert.deepStrictEqual(report.items.map((item) => item.value), [
    'Lorem ipsum',
    'TODO',
    '{{customer_name}}',
    '(empty)',
  ]);
  for (const item of report.items) {
    assert.ok(Number.isInteger(item.location.line) && item.location.line > 0);
    assert.ok(item.location.tag);
    assert.ok(item.location.snippet);
    assert.match(item.suggestion, /^replace .+ with your real /);
  }
  assert.deepStrictEqual(report.errors, []);
});

test('complete real-copy fixture has zero false positives, including boundary traps and code', () => {
  const page = path.join(FIXTURES, 'g3-copy-token-clean', 'index.html');
  const report = detectCopyTokenGaps(page);

  assert.strictEqual(report.status, 'clean');
  assert.strictEqual(report.zeroNetwork, true);
  assert.strictEqual(report.gapCount, 0);
  assert.deepStrictEqual(report.items, []);
  assert.deepStrictEqual(report.errors, []);
});

test('specified marker variants, brand defaults, token forms, and duplicate headings stay covered', () => {
  const page = path.join(FIXTURES, 'g3-copy-token-variants', 'index.html');
  const report = detectCopyTokenGaps(page);
  const count = (kind) => report.items.filter((item) => item.kind === kind).length;

  assert.strictEqual(report.status, 'gaps-detected');
  assert.strictEqual(report.gapCount, 13);
  assert.strictEqual(count(KINDS.BRAND_DEFAULT), 4);
  assert.strictEqual(count(KINDS.STAND_IN), 5);
  assert.strictEqual(count(KINDS.TEMPLATE_TOKEN), 3);
  assert.strictEqual(count(KINDS.DUPLICATE_HEADING), 1);
  assert.deepStrictEqual(
    report.items.filter((item) => item.kind === KINDS.TEMPLATE_TOKEN).map((item) => item.value),
    ['{product_name}', '${price}', '%CTA_LABEL%'],
  );

  const unavailable = detectCopyTokenGaps(path.join(FIXTURES, 'does-not-exist', 'index.html'));
  assert.strictEqual(unavailable.status, 'unavailable');
  assert.strictEqual(unavailable.gapCount, 0);
  assert.strictEqual(unavailable.errors.length, 1);
});
