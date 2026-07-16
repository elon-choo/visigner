#!/usr/bin/env node
'use strict';

const path = require('path');
const { createRequire } = require('module');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const SKILL_PACKAGE = path.join(PLUGIN_ROOT, 'skills', 'detail-page', 'package.json');
const skillRequire = createRequire(SKILL_PACKAGE);

function cleanError(error) {
  return String(error && error.message ? error.message : error || 'unknown error')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200);
}

function forcedMissing() {
  return /^(1|true|yes)$/i.test(String(
    process.env.VISIGNER_FORCE_BROWSER_MISSING
      || process.env.VISIGNER_FORCE_NO_BROWSER
      || '',
  ));
}

function resolveChromium() {
  const resolutionErrors = [];
  for (const provider of ['patchright', 'playwright']) {
    try {
      const entry = skillRequire.resolve(provider);
      const runtime = skillRequire(provider);
      if (!runtime || !runtime.chromium || typeof runtime.chromium.launch !== 'function') {
        throw new Error(`${provider} resolved without a chromium launcher`);
      }
      return { provider, entry, chromium: runtime.chromium, resolutionErrors };
    } catch (error) {
      resolutionErrors.push({ provider, error: cleanError(error) });
    }
  }
  return { provider: null, entry: null, chromium: null, resolutionErrors };
}

async function detectBrowserAvailability() {
  if (forcedMissing()) {
    return {
      available: false,
      reasonCode: 'forced-missing',
      reason: 'browser absence forced by VISIGNER_FORCE_BROWSER_MISSING',
      attemptedLaunch: false,
    };
  }

  const resolved = resolveChromium();
  if (!resolved.chromium) {
    return {
      available: false,
      reasonCode: 'runtime-unresolvable',
      reason: 'neither patchright nor playwright could be resolved from the detail-page skill',
      attemptedLaunch: false,
      resolutionErrors: resolved.resolutionErrors,
    };
  }

  const attempts = [
    { candidate: 'bundled-chromium', options: { headless: true } },
    { candidate: 'system-chrome', options: { channel: 'chrome', headless: true } },
  ];
  const launchErrors = [];
  for (const attempt of attempts) {
    let browser;
    try {
      browser = await resolved.chromium.launch(attempt.options);
      const version = typeof browser.version === 'function' ? browser.version() : null;
      await browser.close();
      return {
        available: true,
        provider: resolved.provider,
        providerEntry: resolved.entry,
        candidate: attempt.candidate,
        version,
        attemptedLaunch: true,
      };
    } catch (error) {
      launchErrors.push({ candidate: attempt.candidate, error: cleanError(error) });
      if (browser) {
        try { await browser.close(); } catch (_) {}
      }
    }
  }

  return {
    available: false,
    provider: resolved.provider,
    providerEntry: resolved.entry,
    reasonCode: 'chromium-launch-failed',
    reason: 'browser runtime resolved, but neither bundled Chromium nor system Chrome launched',
    attemptedLaunch: true,
    launchErrors,
  };
}

async function main() {
  const result = await detectBrowserAvailability();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stdout.write(`${JSON.stringify({
      available: false,
      reasonCode: 'probe-error',
      reason: cleanError(error),
      attemptedLaunch: false,
    })}\n`);
  });
}

module.exports = { detectBrowserAvailability, forcedMissing, resolveChromium };
