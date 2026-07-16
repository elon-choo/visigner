#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { detectBrowserAvailability } = require('./browser-availability.js');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const SETUP_DOC = path.join(PLUGIN_ROOT, 'commands', 'design-setup.md');
const SETUP_SOURCE = 'commands/design-setup.md:22-24';

function cleanDetail(value, fallback = 'unknown install error') {
  return String(value || fallback).replace(/\s+/g, ' ').trim().slice(0, 1600);
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function extractInstallTemplate(markdown = fs.readFileSync(SETUP_DOC, 'utf8')) {
  const blocks = [...String(markdown).matchAll(/```bash\s*\n([\s\S]*?)```/g)];
  for (const block of blocks) {
    if (!/npx\s+patchright\s+install\s+chromium/.test(block[1])) continue;
    const steps = block[1]
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+#.*$/, '').trim())
      .filter(Boolean);
    const installEnd = steps.findIndex((line) => /npx\s+patchright\s+install\s+chromium/.test(line));
    const installSteps = steps.slice(0, installEnd + 1);
    if (!installSteps.some((line) => /^npm\s+install\b/.test(line))) continue;
    return installSteps.join(' && ');
  }
  throw new Error(`browser install command not found in ${SETUP_SOURCE}`);
}

function guidedProvisioning(pluginRoot = PLUGIN_ROOT) {
  const installTemplate = extractInstallTemplate();
  const documentedSkillPath = '"${CLAUDE_PLUGIN_ROOT}/skills/detail-page"';
  const resolvedSkillPath = shellQuote(path.join(pluginRoot, 'skills', 'detail-page'));
  if (!installTemplate.includes(documentedSkillPath)) {
    throw new Error(`documented plugin-root path not found in ${SETUP_SOURCE}`);
  }
  const installCommand = installTemplate.replace(documentedSkillPath, resolvedSkillPath);
  return {
    status: 'guided-install-available',
    installCommand,
    installTemplate,
    source: SETUP_SOURCE,
    consentRequired: true,
    installExecuted: false,
    manualFallbackCommand: installCommand,
  };
}

function dependencyRestoreCommand(pluginRoot = PLUGIN_ROOT) {
  const guide = guidedProvisioning(pluginRoot);
  const browserInstallStep = ' && npx patchright install chromium';
  if (!guide.installCommand.endsWith(browserInstallStep)) {
    throw new Error(`browser install step not found in ${SETUP_SOURCE}`);
  }
  return guide.installCommand.slice(0, -browserInstallStep.length);
}

function cacheRoots(env = process.env, homedir = os.homedir()) {
  const roots = [];
  if (env.PLAYWRIGHT_BROWSERS_PATH && env.PLAYWRIGHT_BROWSERS_PATH !== '0') {
    roots.push(path.resolve(env.PLAYWRIGHT_BROWSERS_PATH.replace(/^~(?=$|\/)/, homedir)));
  }
  roots.push(
    path.join(homedir, 'Library', 'Caches', 'ms-playwright'),
    path.join(homedir, '.cache', 'ms-playwright'),
  );
  return [...new Set(roots)];
}

function findChromiumBinary(root, fsApi = fs, depth = 0) {
  if (depth > 7) return null;
  let entries;
  try {
    entries = fsApi.readdirSync(root, { withFileTypes: true });
  } catch (_) {
    return null;
  }
  for (const entry of entries) {
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const found = findChromiumBinary(candidate, fsApi, depth + 1);
      if (found) return found;
      continue;
    }
    if (!entry.isFile()) continue;
    const name = entry.name.toLowerCase();
    const chromiumTree = /(?:chromium|chrome-(?:mac|linux)|chrome-headless-shell)/i.test(candidate);
    const binaryName = /^(?:chrome|chromium|headless_shell|chrome-headless-shell)(?:\.exe)?$/.test(name);
    if (chromiumTree && binaryName) return candidate;
  }
  return null;
}

function detectCachedChromium({ env = process.env, fsApi = fs, homedir = os.homedir() } = {}) {
  const rootsChecked = cacheRoots(env, homedir);
  for (const root of rootsChecked) {
    const executablePath = findChromiumBinary(root, fsApi);
    if (executablePath) return { present: true, executablePath, cacheRoot: root, rootsChecked };
  }
  return { present: false, executablePath: null, cacheRoot: null, rootsChecked };
}

function cacheIsPresent(result) {
  return result === true || Boolean(result && result.present === true);
}

async function planBrowserProvisioning({
  pluginRoot = PLUGIN_ROOT,
  availabilityProbe = detectBrowserAvailability,
  browserCacheProbe = detectCachedChromium,
} = {}) {
  let availability;
  try {
    availability = await availabilityProbe();
  } catch (error) {
    availability = { available: false, reasonCode: 'probe-error', reason: cleanDetail(error && error.message) };
  }
  if (availability && availability.available === true) {
    return {
      status: 'already-provisioned',
      action: 'none',
      message: 'already-provisioned, nothing to do',
      availability,
      nodeModulesRestoreNeeded: false,
      chromiumDownloadNeeded: false,
      installCommand: null,
      installExecuted: false,
    };
  }

  let cache;
  try {
    cache = await browserCacheProbe();
  } catch (error) {
    cache = { present: false, error: cleanDetail(error && error.message) };
  }
  const guide = guidedProvisioning(pluginRoot);
  if (cacheIsPresent(cache)) {
    return {
      ...guide,
      status: 'runtime-restore-required',
      action: 'restore-node-modules',
      availability,
      browserCache: cache,
      nodeModulesRestoreNeeded: true,
      chromiumDownloadNeeded: false,
      installCommand: dependencyRestoreCommand(pluginRoot),
      installExecuted: false,
    };
  }
  return {
    ...guide,
    status: 'full-guided-install-required',
    action: 'restore-node-modules-and-download-chromium',
    availability,
    browserCache: cache,
    nodeModulesRestoreNeeded: true,
    chromiumDownloadNeeded: true,
    installExecuted: false,
  };
}

function defaultInstaller(command) {
  return spawnSync('/bin/sh', ['-lc', command], {
    cwd: PLUGIN_ROOT,
    encoding: 'utf8',
    timeout: 10 * 60 * 1000,
    maxBuffer: 8 * 1024 * 1024,
  });
}

function failedInstall(guide, detail) {
  const error = cleanDetail(detail);
  const loudMessage = `BROWSER SETUP FAILED — ${error}. Do not use sudo. Manual fallback: ${guide.manualFallbackCommand}`;
  return {
    ...guide,
    status: 'install-failed',
    installExecuted: true,
    error,
    loudMessage,
    systemMessage: loudMessage,
    additionalContext: [
      'guidedInstallStatus: install-failed',
      `guidedInstallError: ${error}`,
      `guidedInstallManualFallback: ${guide.manualFallbackCommand}`,
    ].join('\n'),
  };
}

function runConsentedInstall({ consent = false, installer = defaultInstaller, pluginRoot = PLUGIN_ROOT } = {}) {
  const guide = guidedProvisioning(pluginRoot);
  if (consent !== true) return { ...guide, status: 'consent-required' };

  let result;
  try {
    result = installer(guide.installCommand, { cwd: pluginRoot });
  } catch (error) {
    return failedInstall(guide, error && error.message);
  }
  if (!result || result.error || result.status !== 0) {
    return failedInstall(
      guide,
      result && result.error && result.error.message
        ? result.error.message
        : result && (result.stderr || result.stdout)
          ? result.stderr || result.stdout
          : `installer exited ${result ? result.status : 'without a result'}`,
    );
  }
  return {
    ...guide,
    status: 'installed',
    installExecuted: true,
    stdout: cleanDetail(result.stdout, ''),
  };
}

async function runIdempotentProvisioning({
  consent = false,
  installer = defaultInstaller,
  pluginRoot = PLUGIN_ROOT,
  availabilityProbe = detectBrowserAvailability,
  browserCacheProbe = detectCachedChromium,
} = {}) {
  const plan = await planBrowserProvisioning({ pluginRoot, availabilityProbe, browserCacheProbe });
  if (plan.status === 'already-provisioned') return plan;
  if (consent !== true) return { ...plan, status: 'consent-required' };

  let result;
  try {
    result = installer(plan.installCommand, { cwd: pluginRoot, plan });
  } catch (error) {
    return { ...failedInstall(plan, error && error.message), chromiumDownloadNeeded: plan.chromiumDownloadNeeded };
  }
  if (!result || result.error || result.status !== 0) {
    return {
      ...failedInstall(
        plan,
        result && result.error && result.error.message
          ? result.error.message
          : result && (result.stderr || result.stdout)
            ? result.stderr || result.stdout
            : `installer exited ${result ? result.status : 'without a result'}`,
      ),
      chromiumDownloadNeeded: plan.chromiumDownloadNeeded,
    };
  }

  let availabilityAfter;
  try {
    availabilityAfter = await availabilityProbe();
  } catch (error) {
    availabilityAfter = { available: false, reasonCode: 'probe-error', reason: cleanDetail(error && error.message) };
  }
  if (!availabilityAfter || availabilityAfter.available !== true) {
    return {
      ...failedInstall(plan, availabilityAfter && availabilityAfter.reason || 'browser unavailable after provisioning'),
      status: 'install-verification-failed',
      chromiumDownloadNeeded: plan.chromiumDownloadNeeded,
      availabilityAfter,
    };
  }
  return {
    ...plan,
    status: plan.chromiumDownloadNeeded ? 'installed-full' : 'restored-from-browser-cache',
    installExecuted: true,
    nodeModulesRestoreExecuted: true,
    chromiumDownloadExecuted: plan.chromiumDownloadNeeded,
    availabilityAfter,
    stdout: cleanDetail(result.stdout, ''),
  };
}

module.exports = {
  SETUP_DOC,
  SETUP_SOURCE,
  cacheRoots,
  dependencyRestoreCommand,
  detectCachedChromium,
  extractInstallTemplate,
  guidedProvisioning,
  planBrowserProvisioning,
  runConsentedInstall,
  runIdempotentProvisioning,
};
