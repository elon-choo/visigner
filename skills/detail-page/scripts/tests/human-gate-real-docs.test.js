'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const {
  CLEAR_HEADER,
  buildHumanGateReport,
} = require(path.join(ROOT, 'hooks', 'human-gate', 'human-gate-report.js'));

test('all three shipped docs pages produce no false human-gate STOP', () => {
  for (const relative of ['docs/index.html', 'docs/guide.html', 'docs/how-to.html']) {
    const page = path.join(ROOT, relative);
    const before = fs.readFileSync(page);
    const report = buildHumanGateReport(page, {});
    const after = fs.readFileSync(page);

    assert.strictEqual(report.stop, false, `${relative}: ${report.plainText}`);
    assert.strictEqual(report.itemCount, 0, relative);
    assert.strictEqual(report.header, CLEAR_HEADER, relative);
    assert.strictEqual(report.plainText, CLEAR_HEADER, relative);
    assert.deepStrictEqual(report.checklist, [], relative);
    assert.ok(before.equals(after), `${relative} was mutated`);
    assert.deepStrictEqual(report.errors, [], relative);
  }
});

