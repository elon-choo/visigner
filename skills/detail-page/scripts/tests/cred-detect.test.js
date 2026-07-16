'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const IMAGE_SERVICE = path.join(ROOT, 'skills', 'design-core', 'scripts', 'image-service.js');
const {
  ENABLE_COMMANDS,
  detectImageCredentials,
} = require(path.join(ROOT, 'hooks', 'cred-detect.js'));

function isolatedEnv(codexHome, values = {}) {
  const env = { ...process.env, CODEX_HOME: codexHome, ...values };
  for (const key of ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'IMG_PROVIDER', 'OPENAI_RESPONSES_AUTH']) {
    if (!Object.hasOwn(values, key)) delete env[key];
  }
  return env;
}

function writeOAuth(codexHome) {
  fs.mkdirSync(codexHome, { recursive: true });
  fs.writeFileSync(path.join(codexHome, 'auth.json'), JSON.stringify({
    tokens: { access_token: 'fixture-access-token', account_id: 'fixture-account' },
  }));
}

test('doctor-backed detector reports no-cred, OAuth, OpenAI, Gemini, and all-present states', () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-cred-states-'));
  try {
    const emptyHome = path.join(fixtureDir, 'empty-codex');
    const oauthHome = path.join(fixtureDir, 'oauth-codex');
    writeOAuth(oauthHome);
    const cases = [
      ['none', isolatedEnv(emptyHome), { codexOAuth: false, openaiApiKey: false, geminiApiKey: false }],
      ['oauth-only', isolatedEnv(oauthHome), { codexOAuth: true, openaiApiKey: false, geminiApiKey: false }],
      ['openai-only', isolatedEnv(emptyHome, { OPENAI_API_KEY: 'fixture-openai-key' }), { codexOAuth: false, openaiApiKey: true, geminiApiKey: false }],
      ['gemini-only', isolatedEnv(emptyHome, { GEMINI_API_KEY: 'fixture-gemini-key' }), { codexOAuth: false, openaiApiKey: false, geminiApiKey: true }],
      ['all-present', isolatedEnv(oauthHome, { OPENAI_API_KEY: 'fixture-openai-key', GEMINI_API_KEY: 'fixture-gemini-key' }), { codexOAuth: true, openaiApiKey: true, geminiApiKey: true }],
    ];

    for (const [name, env, expected] of cases) {
      const result = detectImageCredentials({ env });
      assert.strictEqual(result.doctorStatus, 'detected', name);
      assert.strictEqual(result.zeroNetwork, true, name);
      assert.strictEqual(result.imageGenerationBlocked, false, name);
      for (const [key, present] of Object.entries(expected)) {
        assert.strictEqual(result.credentials[key].present, present, `${name}:${key}`);
        if (present) {
          assert.ok(!Object.hasOwn(result.missingFixes, key), `${name}:${key} unexpectedly missing`);
        } else {
          assert.strictEqual(result.missingFixes[key], ENABLE_COMMANDS[key], `${name}:${key} fix`);
          assert.ok(result.additionalContext.includes(`${key}Enable: ${ENABLE_COMMANDS[key]}`), `${name}:${key} guidance`);
        }
      }
      assert.ok(!result.doctorOutput.includes('fixture-openai-key'), `${name}: OpenAI secret leaked`);
      assert.ok(!result.doctorOutput.includes('fixture-gemini-key'), `${name}: Gemini secret leaked`);
    }
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('doctor failure is crash-proof and keeps placeholder generation non-blocking', () => {
  const result = detectImageCredentials({
    runner: () => { throw new Error('synthetic doctor launch failure'); },
  });
  assert.strictEqual(result.doctorStatus, 'unavailable-safe-fallback');
  assert.match(result.error, /synthetic doctor launch failure/);
  assert.strictEqual(result.credentials.codexOAuth.status, 'unknown');
  assert.strictEqual(result.credentials.openaiApiKey.status, 'unknown');
  assert.strictEqual(result.credentials.geminiApiKey.status, 'unknown');
  assert.strictEqual(result.imageGenerationBlocked, false);
  assert.strictEqual(result.placeholderFallback.available, true);
  assert.strictEqual(result.placeholderFallback.active, true);
  assert.strictEqual(result.placeholderFallback.pageRemainsRenderable, true);
  assert.deepStrictEqual(result.missingFixes, ENABLE_COMMANDS);
});

test('no credentials still produce a non-empty on-brand SVG and renderable page shell', () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-placeholder-flow-'));
  const codexHome = path.join(fixtureDir, 'empty-codex');
  const outDir = path.join(fixtureDir, 'output');
  try {
    const child = spawnSync(process.execPath, [
      IMAGE_SERVICE,
      '--image',
      'Editorial ceramic dripper on warm paper with a restrained cobalt accent',
      outDir,
      '--aspect',
      '4:3',
    ], {
      cwd: ROOT,
      env: isolatedEnv(codexHome),
      encoding: 'utf8',
      timeout: 30_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    assert.strictEqual(child.status, 0, child.stderr);
    assert.match(child.stderr, /IMAGE AUTH CHECK — no credential detected/);
    assert.match(child.stderr, /codexOAuthEnable: codex login/);
    assert.match(child.stderr, /openaiApiKeyEnable: export OPENAI_API_KEY=sk-\.\.\./);
    assert.match(child.stderr, /geminiApiKeyEnable: export GEMINI_API_KEY=\.\.\./);
    assert.match(child.stderr, /imageGenerationBlocked: false/);
    assert.match(child.stderr, /placeholderFallback: active/);
    assert.match(child.stderr, /placeholder\.svg \(no provider credentials/);

    const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8'));
    assert.strictEqual(manifest.ok, 1);
    assert.strictEqual(manifest.placeholders, 1);
    assert.strictEqual(manifest.slots[0].placeholder, true);
    const svgPath = manifest.slots[0].file;
    const svg = fs.readFileSync(svgPath, 'utf8');
    assert.ok(svg.length > 1000);
    assert.match(svg, /^<svg\b/);
    assert.match(svg, /placeholder/i);

    const pagePath = path.join(outDir, 'index.html');
    fs.writeFileSync(pagePath, `<!doctype html><html><body><img src="./${path.basename(svgPath)}" alt="Generated on-brand placeholder"></body></html>`);
    assert.ok(fs.statSync(pagePath).size > 0);
    assert.ok(fs.existsSync(svgPath));
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});
