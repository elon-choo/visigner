'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const { ENABLE_COMMANDS } = require(path.join(ROOT, 'hooks', 'cred-detect.js'));
const {
  CLEAR_HEADER,
  buildHumanGateReport,
} = require(path.join(ROOT, 'hooks', 'human-gate', 'human-gate-report.js'));

const FIXTURES = path.join(__dirname, 'fixtures');
const MACHINE_PASS = { s2Pass: true, mechanicalScore: { score: 100, letter: 'A', incomplete: false } };

function isolatedEnv(home) {
  const env = { ...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex') };
  for (const key of ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'IMG_PROVIDER', 'OPENAI_RESPONSES_AUTH']) delete env[key];
  return env;
}

test('multi-gap page produces one plain checklist with merged image and credential overlap', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-g35-multi-'));
  const page = path.join(FIXTURES, 'g3-human-gate-multi', 'index.html');
  const before = fs.readFileSync(page);
  try {
    const report = buildHumanGateReport(page, {
      env: isolatedEnv(home),
      tasteResult: { tasteSuspect: false, humanGateRequired: false, tasteSignals: [] },
    });
    const after = fs.readFileSync(page);

    assert.strictEqual(report.status, 'stop');
    assert.strictEqual(report.stop, true);
    assert.strictEqual(report.itemCount, 3);
    assert.strictEqual(report.header, 'STOP — this draft is not ready to ship until you resolve 3 human-must-do items');
    assert.deepStrictEqual(report.checklist.map((item) => item.category), ['images', 'copy', 'claims']);
    assert.strictEqual(report.detectorSummary.placeholderImages, 5);
    assert.strictEqual(report.detectorSummary.copyGaps, 1);
    assert.strictEqual(report.detectorSummary.claimGaps, 1);
    assert.strictEqual(report.detectorSummary.assetCredentialGaps, 1);
    assert.strictEqual(report.deduplication.imageOverlapMerged, true);
    assert.strictEqual(report.deduplication.rawPlaceholderFindings, 5);
    assert.strictEqual(report.deduplication.rawAssetCredentialFindings, 1);
    assert.strictEqual(report.deduplication.consolidatedImageItems, 1);
    for (const command of Object.values(ENABLE_COMMANDS)) assert.ok(report.checklist[0].concreteSuggestion.includes(command));
    for (const item of report.checklist) {
      assert.ok(item.whatIsMissing);
      assert.ok(item.where);
      assert.ok(item.concreteSuggestion);
    }
    assert.doesNotMatch(report.plainText, /sourceChannel|s2Pass|mechanicalScore|credentialState|detectorSummary/);
    assert.strictEqual(report.imageGenerationBlocked, false);
    assert.ok(before.equals(after), 'assembler must never mutate the page');
    assert.deepStrictEqual(report.errors, []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('complete real page has no human-must-do items and no false STOP', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-g35-clean-'));
  const page = path.join(FIXTURES, 'designer', 'proof-dense-material', 'index.html');
  const before = fs.readFileSync(page);
  try {
    const report = buildHumanGateReport(page, { env: isolatedEnv(home), gradeResult: MACHINE_PASS });
    const after = fs.readFileSync(page);

    assert.strictEqual(report.status, 'clear');
    assert.strictEqual(report.stop, false);
    assert.strictEqual(report.itemCount, 0);
    assert.strictEqual(report.header, CLEAR_HEADER);
    assert.strictEqual(report.plainText, CLEAR_HEADER);
    assert.deepStrictEqual(report.checklist, []);
    assert.strictEqual(report.detectorSummary.tasteSuspect, false);
    assert.ok(before.equals(after));
    assert.deepStrictEqual(report.errors, []);

    const safeFailure = buildHumanGateReport(page, {
      env: isolatedEnv(home),
      gradeResult: MACHINE_PASS,
      placeholderDetector: () => { throw new Error('placeholder check failed'); },
      copyDetector: () => { throw new Error('copy check failed'); },
      claimDetector: () => { throw new Error('claim check failed'); },
      assetDetector: () => { throw new Error('asset check failed'); },
      tasteDetector: () => { throw new Error('taste check failed'); },
    });
    assert.strictEqual(safeFailure.zeroNetwork, true);
    assert.strictEqual(safeFailure.readOnly, true);
    assert.strictEqual(safeFailure.imageGenerationBlocked, false);
    assert.strictEqual(safeFailure.errors.length, 5);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('machine-clean but taste-suspect page still produces a taste-review STOP', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-g35-taste-'));
  const page = path.join(FIXTURES, 'g3-human-gate-taste-only', 'index.html');
  const before = fs.readFileSync(page);
  try {
    const report = buildHumanGateReport(page, { env: isolatedEnv(home), gradeResult: MACHINE_PASS });
    const after = fs.readFileSync(page);

    assert.strictEqual(report.detectorSummary.placeholderImages, 0);
    assert.strictEqual(report.detectorSummary.copyGaps, 0);
    assert.strictEqual(report.detectorSummary.claimGaps, 0);
    assert.strictEqual(report.detectorSummary.assetCredentialGaps, 0);
    assert.strictEqual(report.detectorSummary.tasteSuspect, true);
    assert.strictEqual(report.detectorSummary.humanGateRequired, true);
    assert.strictEqual(report.status, 'stop');
    assert.strictEqual(report.itemCount, 1);
    assert.strictEqual(report.header, 'STOP — this draft is not ready to ship until you resolve 1 human-must-do item');
    assert.strictEqual(report.checklist[0].category, 'visual review');
    assert.match(report.checklist[0].whatIsMissing, /100\/A machine score is not taste approval/);
    assert.ok(before.equals(after));
    assert.deepStrictEqual(report.errors, []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
