#!/usr/bin/env node
'use strict';

// G4.4 — zero-knowledge PIPELINE defaults (complementary to G4.2's content/brief defaults).
// Resolves the pipeline knobs a novice omits (tokens / aspect / image provider / browser),
// each of which: engages when unspecified, is OVERRIDDEN when supplied, and NEVER blocks.
// The no-cred / no-browser paths still degrade LOUD (G1.5 / G2.2 preserved) — defaults do not silence the degrade.
// Zero-network + never-throws. NOTE: the browser default calls detectBrowserAvailability(), which MAY launch a
// short-lived Chromium probe to confirm usability UNLESS VISIGNER_FORCE_BROWSER_MISSING is set OR a caller injects
// a browserProbe. Callers on a hot path (e.g. the onboarding hook) inject the already-known browser state to keep
// this spawn-free; the standalone module does not claim to be spawn-free on the un-injected path.

const path = require('path');
const { detectImageCredentialsInProcess, ENABLE_COMMANDS } = require('../cred-detect.js');
const { guidedProvisioning } = require('../browser-provision.js');
const { detectBrowserAvailability } = require('../browser-availability.js');

const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');
const BRAND_DEFAULT_TOKENS = path.join(PLUGIN_ROOT, 'skills', 'detail-page', 'tokens', 'brand-default.tokens.json');
const DEFAULT_ASPECT = '4:3';

function enableList(missingFixes) {
  const vals = Object.values(missingFixes || {});
  return vals.length ? vals.join(' | ') : Object.values(ENABLE_COMMANDS).join(' | ');
}

// input = what the user explicitly specified (any of tokens/aspect/provider); env = credential env.
// browserProbe (optional) lets a hot-path caller inject already-known browser state to stay spawn-free.
async function resolvePipelineDefaults(
  input = {},
  { env = process.env, pluginRoot = PLUGIN_ROOT, browserProbe = detectBrowserAvailability } = {},
) {
  const result = {
    status: 'defaults-resolved',
    zeroNetwork: true,
    neverBlocks: true,
    imageGenerationBlocked: false, // hard invariant — defaults never block image output
    defaultsApplied: [],
    overrides: [],
    loudDegrade: {},
  };

  // --- tokens ---
  if (input.tokens) {
    result.tokens = input.tokens;
    result.overrides.push('tokens');
  } else {
    result.tokens = BRAND_DEFAULT_TOKENS;
    result.defaultsApplied.push('tokens=brand-default');
  }

  // --- aspect ---
  if (input.aspect) {
    result.aspect = input.aspect;
    result.overrides.push('aspect');
  } else {
    result.aspect = DEFAULT_ASPECT;
    result.defaultsApplied.push(`aspect=${DEFAULT_ASPECT}`);
  }

  // --- image provider / credential -> on-brand SVG placeholder when no cred (never blocks) ---
  let cred;
  try {
    cred = detectImageCredentialsInProcess({ env });
  } catch (_) {
    cred = { imageGenerationBlocked: false, present: [], missingFixes: {}, preferredCredential: null };
  }
  // invariant: image output is never blocked, regardless of cred state
  result.imageGenerationBlocked = false;
  if (input.provider) {
    result.provider = input.provider;
    result.overrides.push('provider');
  } else if (Array.isArray(cred.present) && cred.present.length > 0) {
    result.provider = cred.preferredCredential || 'auto';
    result.defaultsApplied.push(`provider=${result.provider}`);
  } else {
    result.provider = 'on-brand-svg-placeholder';
    result.defaultsApplied.push('provider=on-brand-svg-placeholder');
    // LOUD degrade preserved (G2.3): page still renders via placeholder, exact enable surfaced.
    result.loudDegrade.image =
      `No image credential — using on-brand SVG placeholders so the page still renders. Enable real images with: ${enableList(cred.missingFixes)}`;
  }

  // --- browser -> guided-install affordance available when absent (never auto-run) ---
  let browser;
  try {
    browser = await browserProbe();
  } catch (_) {
    browser = { available: false };
  }
  if (browser && browser.available) {
    result.browser = 'available';
    result.defaultsApplied.push('browser=available');
  } else {
    result.browser = 'guided-install-available';
    result.defaultsApplied.push('browser=guided-install-available');
    let guide = null;
    try {
      guide = guidedProvisioning(pluginRoot);
    } catch (_) {
      guide = null;
    }
    // LOUD degrade preserved (G1.5 / G2.2): pixel critique OFF is announced, one-tap surfaced (consent required).
    result.loudDegrade.browser =
      `PIXEL CRITIQUE IS OFF — pixel review needs a browser. ${guide ? `One-tap (consent required, never auto-run): ${guide.installCommand}` : 'Run /design-setup.'}`;
  }

  return result;
}

module.exports = { resolvePipelineDefaults, BRAND_DEFAULT_TOKENS, DEFAULT_ASPECT };

if (require.main === module) {
  resolvePipelineDefaults({}, {}).then((r) => process.stdout.write(`${JSON.stringify(r, null, 2)}\n`));
}
