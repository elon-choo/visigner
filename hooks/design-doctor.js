#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { detectBrowserAvailability } = require('./browser-availability.js');
const {
  detectCachedChromium,
  planBrowserProvisioning,
} = require('./browser-provision.js');
const {
  ENABLE_COMMANDS,
  detectImageCredentials,
} = require('./cred-detect.js');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const HOOK_CONFIG = path.join(__dirname, 'hooks.json');
const NODE_LAUNCHER = path.join(__dirname, 'run-node.sh');
const HOOK_CONFIG_FIX = 'reinstall/update the Visigner plugin to restore hooks/hooks.json';
const NODE_FIX = 'install Node or run /design-setup';
const LIVE_DISPATCH_NOTE = 'NOT PROVEN — configuration + interpreter only; owner live-fire is G2.1b';

function detail(value, fallback = 'probe failed without detail') {
  return String(value || fallback).replace(/\s+/g, ' ').trim().slice(0, 1600);
}

function forcedFalse(env, key) {
  return /^(1|true|yes)$/i.test(String(env[key] || ''));
}

function unknownCredentials(error) {
  const credentials = {};
  for (const [key, enableCommand] of Object.entries(ENABLE_COMMANDS)) {
    credentials[key] = {
      label: key,
      present: null,
      status: 'unknown',
      enableCommand,
    };
  }
  return {
    doctorStatus: 'unavailable-safe-fallback',
    zeroNetwork: true,
    credentials,
    missingFixes: { ...ENABLE_COMMANDS },
    error: detail(error),
  };
}

function inspectHookConfig({ readFile = fs.readFileSync } = {}) {
  try {
    const config = JSON.parse(readFile(HOOK_CONFIG, 'utf8'));
    const event = config && config.hooks && config.hooks.PostToolUse;
    const registration = Array.isArray(event)
      ? event.find((entry) => entry && entry.matcher === 'Write|Edit')
      : null;
    const commandHook = registration && Array.isArray(registration.hooks)
      ? registration.hooks.find((entry) => entry && entry.type === 'command')
      : null;
    const configured = Boolean(
      commandHook
      && commandHook.command === '${CLAUDE_PLUGIN_ROOT}/hooks/run-node.sh'
      && Array.isArray(commandHook.args)
      && commandHook.args.length === 1
      && commandHook.args[0] === '${CLAUDE_PLUGIN_ROOT}/hooks/auto-critique-hook.js',
    );
    return {
      configured,
      status: configured ? 'configured' : 'misconfigured',
      configPath: HOOK_CONFIG,
      matcher: registration && registration.matcher || null,
      command: commandHook && commandHook.command || null,
      args: commandHook && commandHook.args || null,
      fix: configured ? null : HOOK_CONFIG_FIX,
    };
  } catch (error) {
    return {
      configured: false,
      status: 'unknown',
      configPath: HOOK_CONFIG,
      error: detail(error),
      fix: HOOK_CONFIG_FIX,
    };
  }
}

function interpreterEnvironment(env) {
  if (!forcedFalse(env, 'VISIGNER_DOCTOR_FORCE_NODE_MISSING')) return { ...env };
  const nowhere = path.join('/__visigner_doctor_no_node__', String(process.pid));
  return {
    ...env,
    HOME: nowhere,
    NVM_DIR: path.join(nowhere, '.nvm'),
    PATH: '',
    VISIGNER_NODE_SYSTEM_PATHS: path.join(nowhere, 'node'),
  };
}

function probeHookInterpreter({ env = process.env, runner = spawnSync } = {}) {
  let result;
  try {
    result = runner(NODE_LAUNCHER, ['-p', 'process.execPath'], {
      cwd: PLUGIN_ROOT,
      env: interpreterEnvironment(env),
      encoding: 'utf8',
      timeout: 20_000,
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    });
  } catch (error) {
    return {
      resolvable: false,
      status: 'unknown',
      interpreterPath: null,
      error: detail(error),
      fix: NODE_FIX,
    };
  }
  if (!result || result.error || result.status !== 0) {
    return {
      resolvable: false,
      status: result && result.status === 127 ? 'absent' : 'unknown',
      interpreterPath: null,
      error: detail(
        result && result.error && result.error.message
          ? result.error.message
          : result && (result.stderr || result.stdout)
            ? result.stderr || result.stdout
            : 'run-node.sh returned no result',
      ),
      exitCode: result ? result.status : null,
      fix: NODE_FIX,
    };
  }
  const interpreterPath = String(result.stdout || '').trim();
  if (!path.isAbsolute(interpreterPath)) {
    return {
      resolvable: false,
      status: 'unknown',
      interpreterPath: null,
      error: 'run-node.sh did not report an absolute interpreter path',
      fix: NODE_FIX,
    };
  }
  return {
    resolvable: true,
    status: 'present',
    interpreterPath,
    exitCode: result.status,
    fix: null,
  };
}

async function safeBrowserProbe(browserProbe) {
  try {
    const result = await browserProbe();
    if (result && typeof result.available === 'boolean') return result;
    return { available: null, reasonCode: 'probe-invalid', reason: 'browser probe returned no boolean availability' };
  } catch (error) {
    return { available: null, reasonCode: 'probe-error', reason: detail(error) };
  }
}

async function runDesignDoctor({
  env = process.env,
  browserProbe = detectBrowserAvailability,
  browserCacheProbe,
  credentialProbe = detectImageCredentials,
  hookConfigProbe = inspectHookConfig,
  interpreterProbe = probeHookInterpreter,
} = {}) {
  const browser = await safeBrowserProbe(browserProbe);
  const cacheProbe = browserCacheProbe || (
    forcedFalse(env, 'VISIGNER_DOCTOR_FORCE_BROWSER_CACHE_MISSING')
      ? async () => ({ present: false, reason: 'browser cache absence forced for doctor simulation' })
      : async () => detectCachedChromium({ env })
  );
  let browserPlan;
  try {
    browserPlan = await planBrowserProvisioning({
      pluginRoot: PLUGIN_ROOT,
      availabilityProbe: async () => browser,
      browserCacheProbe: cacheProbe,
    });
  } catch (error) {
    browserPlan = {
      status: 'unknown',
      installCommand: 'run /design-setup',
      chromiumDownloadNeeded: null,
      error: detail(error),
    };
  }

  let credentials;
  try {
    credentials = credentialProbe({ env });
    if (!credentials || !credentials.credentials) throw new Error('credential probe returned no credential map');
  } catch (error) {
    credentials = unknownCredentials(error);
  }

  let hookConfig;
  try {
    hookConfig = hookConfigProbe();
    if (!hookConfig || typeof hookConfig.configured !== 'boolean') throw new Error('hook config probe returned no configured boolean');
  } catch (error) {
    hookConfig = {
      configured: false,
      status: 'unknown',
      configPath: HOOK_CONFIG,
      error: detail(error),
      fix: HOOK_CONFIG_FIX,
    };
  }

  let interpreter;
  try {
    interpreter = interpreterProbe({ env });
    if (!interpreter || typeof interpreter.resolvable !== 'boolean') throw new Error('interpreter probe returned no resolvable boolean');
  } catch (error) {
    interpreter = {
      resolvable: false,
      status: 'unknown',
      interpreterPath: null,
      error: detail(error),
      fix: NODE_FIX,
    };
  }

  return {
    command: 'node hooks/design-doctor.js',
    zeroNetwork: true,
    browser: {
      ...browser,
      status: browser.available === true ? 'present' : browser.available === false ? 'absent' : 'unknown',
      provisioningStatus: browserPlan.status,
      cachePresent: browserPlan.browserCache && typeof browserPlan.browserCache.present === 'boolean'
        ? browserPlan.browserCache.present
        : null,
      chromiumDownloadNeeded: browserPlan.chromiumDownloadNeeded,
      fix: browser.available === true ? null : browserPlan.installCommand || 'run /design-setup',
    },
    credentials,
    hook: {
      configured: hookConfig.configured,
      configurationStatus: hookConfig.status,
      configPath: hookConfig.configPath,
      configurationFix: hookConfig.fix || null,
      interpreterResolvable: interpreter.resolvable,
      interpreterStatus: interpreter.status,
      interpreterPath: interpreter.interpreterPath,
      interpreterError: interpreter.error || null,
      interpreterFix: interpreter.fix || null,
      active: hookConfig.configured && interpreter.resolvable,
      liveDispatch: LIVE_DISPATCH_NOTE,
    },
  };
}

function formatDoctor(report) {
  const lines = [
    'VISIGNER DESIGN DOCTOR',
    'zeroNetwork: true',
    '',
    '[browser]',
    'browser.status: ' + report.browser.status,
    'browser.provisioningStatus: ' + report.browser.provisioningStatus,
    'browser.cachePresent: ' + (report.browser.cachePresent === null ? 'not-probed' : String(report.browser.cachePresent)),
    'browser.chromiumDownloadNeeded: ' + String(report.browser.chromiumDownloadNeeded),
    report.browser.fix ? 'browser.fix: ' + report.browser.fix : 'browser.fix: none',
    '',
    '[credentials]',
  ];
  for (const key of ['codexOAuth', 'openaiApiKey', 'geminiApiKey']) {
    const item = report.credentials.credentials[key] || {};
    lines.push('credential.' + key + ': ' + (item.status || 'unknown'));
    lines.push('credential.' + key + '.fix: ' + (item.present === true ? 'none' : item.enableCommand || ENABLE_COMMANDS[key]));
  }
  lines.push(
    '',
    '[hook]',
    'hook.configured: ' + report.hook.configured,
    'hook.configurationStatus: ' + report.hook.configurationStatus,
    'hook.configurationFix: ' + (report.hook.configurationFix || 'none'),
    'hook.interpreterStatus: ' + report.hook.interpreterStatus,
    'hook.interpreterPath: ' + (report.hook.interpreterPath || 'unresolved'),
    'hook.interpreterFix: ' + (report.hook.interpreterFix || 'none'),
    'hook.active: ' + report.hook.active,
    'hook.liveDispatch: ' + report.hook.liveDispatch,
  );
  if (report.hook.interpreterError) lines.push('hook.interpreterDiagnostic: ' + report.hook.interpreterError);
  return lines.join('\n') + '\n';
}

async function main() {
  try {
    process.stdout.write(formatDoctor(await runDesignDoctor()));
  } catch (error) {
    const fallback = await runDesignDoctor({
      browserProbe: async () => { throw error; },
      credentialProbe: () => { throw error; },
      hookConfigProbe: () => { throw error; },
      interpreterProbe: () => { throw error; },
    });
    process.stdout.write(formatDoctor(fallback));
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stdout.write('VISIGNER DESIGN DOCTOR\nzeroNetwork: true\noverall.status: unknown\noverall.fix: run /design-setup\ndoctor.error: ' + detail(error) + '\n');
  });
}

module.exports = {
  HOOK_CONFIG,
  HOOK_CONFIG_FIX,
  LIVE_DISPATCH_NOTE,
  NODE_FIX,
  formatDoctor,
  inspectHookConfig,
  probeHookInterpreter,
  runDesignDoctor,
};
