#!/usr/bin/env node
'use strict';

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
    process: { argv: ['node', harnessPath], cwd: process.cwd, exit: process.exit, stderr: process.stderr },
    require,
  };

  vm.runInNewContext(`${withoutMain}\nmodule.exports = { computeS2Pass };`, sandbox, { filename: harnessPath });
  return sandbox.module.exports.computeS2Pass;
}

function runCase(name, verdict, tells, expected) {
  const computeS2Pass = loadComputeS2Pass();
  const actual = computeS2Pass(verdict, tells);
  assert.strictEqual(actual, expected, `${name}: expected s2Pass=${expected}, got ${actual}`);
  console.log(`PASS ${name}: s2Pass=${actual}`);
}

runCase(
  'single escape tell synthetic page remains blocked',
  'suspect',
  [{ tell: 'repeated-decorative-label', severity: 'medium' }],
  false,
);

runCase(
  'four S2 escape tell synthetic page remains blocked',
  'suspect',
  [
    { tell: 'repeated-decorative-label', severity: 'medium' },
    { tell: 'letter-code-badge', severity: 'medium' },
    { tell: 'multiscript-numbering', severity: 'medium' },
    { tell: 'palette-monotony', severity: 'medium' },
  ],
  false,
);

console.log('s2pass-escape-anyof regression fixture complete');
