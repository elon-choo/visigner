'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const {
  ENABLE_COMMANDS,
} = require(path.join(ROOT, 'hooks', 'cred-detect.js'));
const {
  KEEP_NOTE,
  surfaceAssetGaps,
} = require(path.join(ROOT, 'hooks', 'human-gate', 'asset-gap-surfacer.js'));

const FIXTURES = path.join(__dirname, 'fixtures');
const F1_PAGE = path.join(FIXTURES, 'g3-f1-external-svg', 'index.html');

function isolatedEnv(home, values = {}) {
  const env = { ...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex'), ...values };
  for (const key of ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'IMG_PROVIDER', 'OPENAI_RESPONSES_AUTH']) {
    if (!Object.hasOwn(values, key)) delete env[key];
  }
  return env;
}

test('no credentials plus F1 placeholders surfaces exact enables without blocking SVG output', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-g34-no-cred-'));
  try {
    const report = surfaceAssetGaps(F1_PAGE, { env: isolatedEnv(home) });

    assert.strictEqual(report.status, 'human-action-recommended');
    assert.strictEqual(report.zeroNetwork, true);
    assert.strictEqual(report.advisoryOnly, true);
    assert.strictEqual(report.placeholderCount, 5);
    assert.strictEqual(report.gapCount, 1);
    assert.deepStrictEqual(report.items, [{
      gap: '5 images are placeholders because no image credential is configured',
      fix: [
        ENABLE_COMMANDS.codexOAuth,
        ENABLE_COMMANDS.openaiApiKey,
        ENABLE_COMMANDS.geminiApiKey,
      ],
      note: KEEP_NOTE,
    }]);
    assert.strictEqual(report.imageGenerationBlocked, false);
    assert.strictEqual(report.placeholderFallback.available, true);
    assert.strictEqual(report.placeholderFallback.active, true);
    assert.strictEqual(report.placeholderFallback.pageRemainsRenderable, true);
    for (const id of report.placeholderIds) {
      const svg = fs.readFileSync(path.join(path.dirname(F1_PAGE), 'assets', `${id}.svg`), 'utf8');
      assert.match(svg, /^<svg\b/);
      assert.ok(svg.length > 1000);
    }
    assert.deepStrictEqual(report.errors, []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('credential-present and all-real paths surface no credential gap or false stop', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-g34-controls-'));
  try {
    const credentialPresent = surfaceAssetGaps(F1_PAGE, {
      env: isolatedEnv(home, { OPENAI_API_KEY: 'fixture-openai-key' }),
    });
    assert.strictEqual(credentialPresent.status, 'no-credential-asset-gap');
    assert.strictEqual(credentialPresent.placeholderCount, 5);
    assert.strictEqual(credentialPresent.gapCount, 0);
    assert.deepStrictEqual(credentialPresent.items, []);
    assert.deepStrictEqual(credentialPresent.credentialState.present, ['openaiApiKey']);
    assert.strictEqual(credentialPresent.imageGenerationBlocked, false);

    const realPage = path.join(FIXTURES, 'g3-asset-gap-real', 'index.html');
    const allReal = surfaceAssetGaps(realPage, { env: isolatedEnv(home) });
    assert.strictEqual(allReal.status, 'no-credential-asset-gap');
    assert.strictEqual(allReal.placeholderCount, 0);
    assert.strictEqual(allReal.gapCount, 0);
    assert.deepStrictEqual(allReal.items, []);
    assert.strictEqual(allReal.imageGenerationBlocked, false);

    const safeFailure = surfaceAssetGaps(realPage, {
      env: isolatedEnv(home),
      credentialDetector: () => { throw new Error('synthetic credential probe failure'); },
      placeholderDetector: () => { throw new Error('synthetic placeholder probe failure'); },
    });
    assert.strictEqual(safeFailure.status, 'unavailable-safe-fallback');
    assert.strictEqual(safeFailure.imageGenerationBlocked, false);
    assert.strictEqual(safeFailure.placeholderFallback.pageRemainsRenderable, true);
    assert.strictEqual(safeFailure.errors.length, 2);

    const invalidReports = surfaceAssetGaps(realPage, {
      env: isolatedEnv(home),
      credentialDetector: () => null,
      placeholderDetector: () => undefined,
    });
    assert.strictEqual(invalidReports.status, 'unavailable-safe-fallback');
    assert.strictEqual(invalidReports.imageGenerationBlocked, false);
    assert.strictEqual(invalidReports.errors.length, 2);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
