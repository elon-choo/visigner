'use strict';

// G4.4 — zero-knowledge PIPELINE defaults: each engages when unspecified, is overridden when
// supplied, and NEVER blocks (no-cred + no-browser still degrade loud, image never blocked).

const assert = require('assert');
const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const { resolvePipelineDefaults, BRAND_DEFAULT_TOKENS, DEFAULT_ASPECT } =
  require(path.join(ROOT, 'hooks', 'onboarding', 'defaults.js'));

function noCredEnv() {
  return { PATH: process.env.PATH, HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'g44-nocred-')) };
}

test('unspecified inputs → every pipeline default engages (no-cred + no-browser)', async () => {
  process.env.VISIGNER_FORCE_BROWSER_MISSING = '1';
  try {
    const r = await resolvePipelineDefaults({}, { env: noCredEnv() });
    // tokens default
    assert.strictEqual(r.tokens, BRAND_DEFAULT_TOKENS);
    assert.ok(r.defaultsApplied.includes('tokens=brand-default'));
    // aspect default
    assert.strictEqual(r.aspect, DEFAULT_ASPECT);
    assert.ok(r.defaultsApplied.includes(`aspect=${DEFAULT_ASPECT}`));
    // no cred → on-brand SVG placeholder, image NOT blocked
    assert.strictEqual(r.provider, 'on-brand-svg-placeholder');
    assert.strictEqual(r.imageGenerationBlocked, false);
    assert.match(r.loudDegrade.image, /on-brand SVG placeholders so the page still renders/);
    assert.match(r.loudDegrade.image, /codex login/); // exact enable surfaced
    // no browser → guided affordance + loud PIXEL-OFF
    assert.strictEqual(r.browser, 'guided-install-available');
    assert.match(r.loudDegrade.browser, /PIXEL CRITIQUE IS OFF/);
    assert.match(r.loudDegrade.browser, /consent required, never auto-run/);
    assert.strictEqual(r.neverBlocks, true);
  } finally {
    delete process.env.VISIGNER_FORCE_BROWSER_MISSING;
  }
});

test('supplied inputs OVERRIDE the defaults (not double-applied)', async () => {
  const r = await resolvePipelineDefaults(
    { tokens: '/my/tokens.json', aspect: '16:9', provider: 'gemini' },
    { env: process.env },
  );
  assert.strictEqual(r.tokens, '/my/tokens.json');
  assert.strictEqual(r.aspect, '16:9');
  assert.strictEqual(r.provider, 'gemini');
  assert.ok(r.overrides.includes('tokens'));
  assert.ok(r.overrides.includes('aspect'));
  assert.ok(r.overrides.includes('provider'));
  // supplied values are NOT re-added as defaults
  assert.ok(!r.defaultsApplied.some((d) => d.startsWith('tokens=')));
  assert.ok(!r.defaultsApplied.some((d) => d.startsWith('aspect=')));
  assert.ok(!r.defaultsApplied.some((d) => d.startsWith('provider=')));
  // never-block invariant holds on the CRED-PRESENT path too (not only the no-cred branch)
  assert.strictEqual(r.imageGenerationBlocked, false);
});

test('never-block: no-cred + no-browser still renders + degrades loud (G1.5/G2.2 not silenced)', async () => {
  process.env.VISIGNER_FORCE_BROWSER_MISSING = '1';
  try {
    const r = await resolvePipelineDefaults({}, { env: noCredEnv() });
    // image output is never blocked by defaults
    assert.strictEqual(r.imageGenerationBlocked, false);
    // BOTH degrade channels are loud (defaults did not silence them)
    assert.ok(r.loudDegrade.image && r.loudDegrade.image.length > 0);
    assert.ok(r.loudDegrade.browser && r.loudDegrade.browser.length > 0);
    assert.strictEqual(r.neverBlocks, true);
    assert.strictEqual(r.status, 'defaults-resolved');
  } finally {
    delete process.env.VISIGNER_FORCE_BROWSER_MISSING;
  }
});

test('configured env (browser present) → browser default = available, no PIXEL-OFF', async () => {
  // this machine resolves a browser when not force-missing
  const r = await resolvePipelineDefaults({}, { env: process.env });
  if (r.browser === 'available') {
    assert.ok(r.defaultsApplied.includes('browser=available'));
    assert.ok(!r.loudDegrade.browser);
  } else {
    // environment genuinely has no browser — must still be the guided (loud) path, never silent
    assert.match(r.loudDegrade.browser, /PIXEL CRITIQUE IS OFF/);
  }
});
