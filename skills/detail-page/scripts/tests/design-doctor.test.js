'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const {
  LIVE_DISPATCH_NOTE,
  formatDoctor,
  runDesignDoctor,
} = require(path.join(ROOT, 'hooks', 'design-doctor.js'));

function bareEnv(codexHome) {
  const env = {
    ...process.env,
    CODEX_HOME: codexHome,
    VISIGNER_FORCE_BROWSER_MISSING: '1',
    VISIGNER_DOCTOR_FORCE_BROWSER_CACHE_MISSING: '1',
    VISIGNER_DOCTOR_FORCE_NODE_MISSING: '1',
  };
  delete env.OPENAI_API_KEY;
  delete env.GEMINI_API_KEY;
  delete env.OPENAI_RESPONSES_AUTH;
  return env;
}

test('bare rollup enumerates browser, three credentials, and hook gaps without throwing', async () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-doctor-bare-'));
  try {
    const report = await runDesignDoctor({
      env: bareEnv(path.join(fixtureDir, 'empty-codex-home')),
      browserProbe: async () => ({
        available: false,
        reasonCode: 'forced-missing',
        reason: 'browser absence forced for bare doctor test',
      }),
    });
    const output = formatDoctor(report);

    assert.strictEqual(report.zeroNetwork, true);
    assert.strictEqual(report.browser.status, 'absent');
    assert.strictEqual(report.browser.chromiumDownloadNeeded, true);
    assert.match(report.browser.fix, /npm install && npx patchright install chromium/);
    for (const [key, command] of Object.entries({
      codexOAuth: 'codex login',
      openaiApiKey: 'export OPENAI_API_KEY=sk-...',
      geminiApiKey: 'export GEMINI_API_KEY=...',
    })) {
      assert.strictEqual(report.credentials.credentials[key].status, 'absent', key);
      assert.strictEqual(report.credentials.credentials[key].enableCommand, command, key);
      assert.ok(output.includes('credential.' + key + '.fix: ' + command), key);
    }
    assert.strictEqual(report.hook.configured, true);
    assert.strictEqual(report.hook.interpreterResolvable, false);
    assert.strictEqual(report.hook.interpreterStatus, 'absent');
    assert.strictEqual(report.hook.active, false);
    assert.strictEqual(report.hook.liveDispatch, LIVE_DISPATCH_NOTE);
    assert.match(output, /hook\.interpreterFix: install Node or run \/design-setup/);
    assert.match(output, /hook\.liveDispatch: NOT PROVEN/);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('every doctor probe failure becomes unknown guidance rather than a throw', async () => {
  const failure = () => { throw new Error('synthetic probe failure'); };
  const report = await runDesignDoctor({
    env: {},
    browserProbe: failure,
    browserCacheProbe: failure,
    credentialProbe: failure,
    hookConfigProbe: failure,
    interpreterProbe: failure,
  });
  const output = formatDoctor(report);

  assert.strictEqual(report.zeroNetwork, true);
  assert.strictEqual(report.browser.status, 'unknown');
  assert.ok(report.browser.fix);
  assert.strictEqual(report.credentials.credentials.codexOAuth.status, 'unknown');
  assert.strictEqual(report.credentials.credentials.openaiApiKey.status, 'unknown');
  assert.strictEqual(report.credentials.credentials.geminiApiKey.status, 'unknown');
  assert.strictEqual(report.hook.configurationStatus, 'unknown');
  assert.strictEqual(report.hook.interpreterStatus, 'unknown');
  assert.strictEqual(report.hook.active, false);
  assert.match(output, /credential\.codexOAuth\.fix: codex login/);
  assert.match(output, /hook\.configurationFix:/);
  assert.match(output, /hook\.interpreterFix: install Node or run \/design-setup/);
});
