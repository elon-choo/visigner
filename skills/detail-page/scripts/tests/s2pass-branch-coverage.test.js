#!/usr/bin/env node
'use strict';

// Pins EVERY branch of computeS2Pass, not just the escape-tell any-of gate.
//
// Why this file exists: the escape-tell regression (s2pass-escape-anyof.test.js) and the W1-W8
// invariant verifier both pass while `computeS2Pass`'s OTHER guard is deleted. A red-team probe
// removed the `highCount === 0` conjunct from the suspect branch — every existing check stayed
// green, yet `computeS2Pass('suspect', [{tell:'browser-mockup', severity:'high'}])` flipped from
// false to true. The labeled fixture corpus misses it too: no fixture occupies the
// "verdict=suspect + a high-severity NON-escape tell" quadrant, because every slop fixture's
// s2Pass=false comes from the escape gate instead.
//
// Each case below names the branch it pins and the mutation it catches.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const harnessPath = path.resolve(__dirname, '..', 'anti-ai-eval.js');

function loadComputeS2Pass() {
  const source = fs.readFileSync(harnessPath, 'utf8');
  const withoutMain = source.replace(/\nmain\(\);\s*$/, '\n');
  const sandbox = {
    __dirname: path.dirname(harnessPath),
    __filename: harnessPath,
    console,
    module: { exports: {} },
    process,
    require,
  };
  vm.runInNewContext(`${withoutMain}\nmodule.exports = { computeS2Pass };`, sandbox, {
    filename: harnessPath,
  });
  return sandbox.module.exports.computeS2Pass;
}

const computeS2Pass = loadComputeS2Pass();

// A high-severity tell that is NOT one of the nine escape tells. If this name ever joins the escape
// set, pick another: the point is to reach the verdict branch without tripping the escape gate.
const HIGH_NON_ESCAPE = { tell: 'browser-mockup', severity: 'high' };
const MED_NON_ESCAPE = { tell: 'browser-mockup', severity: 'medium' };
const ESCAPE = { tell: 'repeated-decorative-label', severity: 'medium' };

const cases = [
  ['clean verdict, no tells -> ships', 'clean', [], true],
  ['suspect verdict, no high-severity tell -> ships', 'suspect', [MED_NON_ESCAPE], true],
  [
    'suspect verdict WITH a high-severity non-escape tell -> blocked',
    'suspect',
    [HIGH_NON_ESCAPE],
    false,
  ],
  ['ai-likely verdict -> blocked regardless of tells', 'ai-likely', [], false],
  ['ai-likely verdict with tells -> blocked', 'ai-likely', [MED_NON_ESCAPE], false],
  ['clean verdict but one escape tell -> blocked (any-of gate)', 'clean', [ESCAPE], false],
  [
    'clean verdict, escape tell at lowest severity -> blocked (gate is severity-independent)',
    'clean',
    [{ tell: 'palette-monotony', severity: 'low' }],
    false,
  ],
  [
    'suspect verdict, high non-escape AND escape tell -> blocked',
    'suspect',
    [HIGH_NON_ESCAPE, ESCAPE],
    false,
  ],
];

for (const [name, verdict, tells, expected] of cases) {
  const actual = computeS2Pass(verdict, tells);
  assert.strictEqual(actual, expected, `${name}: expected s2Pass=${expected}, got ${actual}`);
  console.log(`PASS ${name}`);
}

// The unknown-verdict default must be "do not ship". A verdict string the harness never emits today
// (say, a future 'borderline') must not fall through to true.
assert.strictEqual(
  computeS2Pass('borderline', []),
  false,
  'unknown verdict defaulted to shipping',
);
console.log('PASS unknown verdict -> blocked (fails closed)');

console.log('s2pass branch coverage complete');
