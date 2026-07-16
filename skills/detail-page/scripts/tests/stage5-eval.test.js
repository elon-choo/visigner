'use strict';

// G5.4 — Stage-5 proof-eval: thresholds + determinism + honesty guard, wired into the suite.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const { run } = require(path.join(ROOT, 'skills', 'detail-page', 'scripts', 'eval-spine.js'));
const REPORT = path.join(ROOT, 'docs', 'autopilot', 'evidence', 'stage5-delta.md');

test('pre-registered thresholds: in-scope recall >= 0.90 AND clean precision = 1.00', () => {
  const r = run();
  assert.ok(r.recall >= 0.90, `recall ${r.recall} < 0.90 (${r.inScopeCaught}/${r.inScopeTotal})`);
  assert.strictEqual(r.precision, 1.0, `precision ${r.precision} != 1.0 (false-flags: ${r.cleanFalseFlag})`);
  // every in-scope class has non-zero recall (a high aggregate cannot mask a fully-missed class)
  for (const [k, v] of Object.entries(r.perClass)) {
    assert.ok(v.caught > 0, `class ${k} fully missed (${v.caught}/${v.total})`);
  }
});

test('before/after delta is real: naive pages flagged WITH spine, un-flagged WITHOUT', () => {
  const r = run();
  assert.strictEqual(r.delta.flaggedWithoutSpine, 0, 'without the spine nothing is surfaced');
  assert.ok(r.delta.flaggedWithSpine >= 1, 'the spine must flag at least one naive page');
  assert.strictEqual(r.delta.flaggedWithSpine, r.delta.naiveTotal, 'every naive page is flagged with the spine');
});

test('out-of-spine issues are reported as expected-MISS, never counted as caught', () => {
  const r = run();
  // the brand-lint tells (font/color) must be present in the out-of-spine list and NOT counted as caught
  assert.ok(r.outOfScope.length >= 1, 'out-of-spine issues must be enumerated, not dropped');
  for (const o of r.outOfScope) assert.strictEqual(o.caught, false, `out-of-spine ${o.type} must not be counted caught`);
});

test('determinism: two runs on the same corpus yield identical metrics', () => {
  const a = run();
  const b = run();
  assert.strictEqual(a.recall, b.recall);
  assert.strictEqual(a.precision, b.precision);
  assert.strictEqual(a.delta.flaggedWithSpine, b.delta.flaggedWithSpine);
  assert.deepStrictEqual(a.perClass, b.perClass);
});

test('honesty guard: the delta report states the machine-score blind spot + the brand-lint spine status', () => {
  const md = fs.readFileSync(REPORT, 'utf8');
  assert.match(md, /100\/A is NOT taste approval|machine score != taste|Machine mechanicalScore 100\/A is NOT taste/i);
  assert.match(md, /brand-lint.*FOLDED INTO the auto-grade|--brand-lint/); // brand-lint now folded in (G6.5)
  assert.match(md, /NARROW lexicon/); // the claim-coverage limit is disclosed
  assert.match(md, /does NOT prove that live model-generated pages improve/); // the proxy limit (T6)
});
