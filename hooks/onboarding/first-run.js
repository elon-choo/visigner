#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { detectBrowserAvailability } = require('../browser-availability.js');
const { guidedProvisioning } = require('../browser-provision.js');
const {
  ENABLE_COMMANDS,
  detectImageCredentialsInProcess,
} = require('../cred-detect.js');
const { runDesignDoctor } = require('../design-doctor.js');
const { resolvePipelineDefaults } = require('./defaults.js');

const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');
const HTML_EXTENSIONS = new Set(['.html', '.htm']);
const IGNORED_DIRECTORIES = new Set([
  '.git', '.hg', '.svn', '.bzr',
  'node_modules', 'dist', 'build', 'coverage',
  'cache', '.cache', '.next', '.nuxt', '.turbo',
]);
const MAX_TRAVERSED_ENTRIES = 50000;
const BRAND_DEFAULT = 'Visigner brand-default tokens';

function clean(value, fallback = 'unavailable') {
  return String(value || fallback).replace(/\s+/g, ' ').trim().slice(0, 1600);
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === ''
    || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function eventTarget(event) {
  if (!event || event.hook_event_name !== 'PostToolUse') return null;
  if (event.tool_name !== 'Write' && event.tool_name !== 'Edit') return null;
  if (!event.tool_input || typeof event.tool_input.file_path !== 'string') return null;
  if (typeof event.cwd !== 'string' || !event.cwd.trim()) return null;
  const target = path.resolve(event.cwd, event.tool_input.file_path);
  return HTML_EXTENSIONS.has(path.extname(target).toLowerCase()) ? target : null;
}

function notFirst(reason, extra = {}) {
  return {
    firstRun: false,
    novelty: false,
    readOnly: true,
    reason,
    ...extra,
  };
}

function detectFirstRun(event, {
  fsApi = fs,
  pluginRoot = PLUGIN_ROOT,
  maxEntries = MAX_TRAVERSED_ENTRIES,
} = {}) {
  try {
    const targetPath = eventTarget(event);
    if (!targetPath) return notFirst('unsupported-or-incomplete-event', { uncertain: true });
    const workspacePath = path.resolve(event.cwd);
    const workspace = fsApi.realpathSync(workspacePath);
    const target = fsApi.realpathSync(targetPath);
    const plugin = fsApi.realpathSync(pluginRoot);

    if (!fsApi.statSync(workspace).isDirectory() || !fsApi.statSync(target).isFile()) {
      return notFirst('workspace-or-target-is-not-readable', { uncertain: true });
    }
    if (!isWithin(workspace, target)) return notFirst('target-outside-workspace', { uncertain: true });
    if (isWithin(plugin, target)) return notFirst('plugin-owned-target');

    const relativeTarget = path.relative(workspace, targetPath);
    if (relativeTarget.split(path.sep).some((part) => IGNORED_DIRECTORIES.has(part.toLowerCase()))) {
      return notFirst('ignored-generated-target');
    }

    const stack = [workspace];
    let traversedEntries = 0;
    while (stack.length) {
      const directory = stack.pop();
      const entries = fsApi.readdirSync(directory, { withFileTypes: true });
      for (const entry of entries) {
        traversedEntries += 1;
        if (traversedEntries > maxEntries) {
          return notFirst('workspace-scan-limit-reached', { uncertain: true, traversedEntries });
        }
        if (IGNORED_DIRECTORIES.has(entry.name.toLowerCase())) continue;
        const candidatePath = path.join(directory, entry.name);
        let candidateReal;
        try {
          candidateReal = fsApi.realpathSync(candidatePath);
        } catch (_) {
          return notFirst('workspace-entry-unreadable', { uncertain: true, traversedEntries });
        }
        if (isWithin(plugin, candidateReal)) continue;

        if (entry.isDirectory()) {
          stack.push(candidateReal);
          continue;
        }
        if (entry.isSymbolicLink()) {
          let linkedStat;
          try {
            linkedStat = fsApi.statSync(candidateReal);
          } catch (_) {
            return notFirst('workspace-symlink-unreadable', { uncertain: true, traversedEntries });
          }
          if (linkedStat.isDirectory()) {
            return notFirst('workspace-symlink-directory-ambiguous', { uncertain: true, traversedEntries });
          }
        }
        if (!HTML_EXTENSIONS.has(path.extname(candidatePath).toLowerCase())) continue;
        if (candidateReal === target) continue;
        return notFirst('prior-design-artifact-found', {
          priorArtifact: candidateReal,
          priorArtifactCount: 1,
          traversedEntries,
        });
      }
    }

    return {
      firstRun: true,
      novelty: true,
      readOnly: true,
      reason: 'no-prior-design-artifact',
      workspace,
      target,
      priorArtifactCount: 0,
      traversedEntries,
    };
  } catch (error) {
    return notFirst('novelty-check-failed-safe', {
      uncertain: true,
      error: clean(error && error.message),
    });
  }
}

function inProcessInterpreterProbe() {
  return {
    resolvable: Boolean(process.execPath && path.isAbsolute(process.execPath)),
    status: 'present-in-process',
    interpreterPath: process.execPath || null,
    fix: null,
  };
}

async function safeDoctor({
  env,
  browserProbe,
  browserCacheProbe,
  credentialProbe,
  doctorRunner,
}) {
  try {
    return await doctorRunner({
      env,
      browserProbe,
      browserCacheProbe,
      credentialProbe: ({ env: doctorEnv }) => credentialProbe({ env: doctorEnv }),
      interpreterProbe: inProcessInterpreterProbe,
    });
  } catch (error) {
    let guide;
    let credentials;
    try {
      guide = guidedProvisioning();
    } catch (_) {
      guide = { installCommand: 'run /design-setup' };
    }
    try {
      credentials = credentialProbe({ env });
    } catch (_) {
      credentials = {
        credentials: Object.fromEntries(Object.entries(ENABLE_COMMANDS).map(([key, enableCommand]) => [
          key, { present: null, status: 'unknown', enableCommand },
        ])),
        present: [],
        imageGenerationBlocked: false,
      };
    }
    return {
      zeroNetwork: true,
      browser: { status: 'unknown', available: null, fix: guide.installCommand },
      credentials,
      hook: { active: null },
      error: clean(error && error.message),
    };
  }
}

function credentialRecords(doctor) {
  return doctor && doctor.credentials && doctor.credentials.credentials
    ? doctor.credentials.credentials
    : {};
}

function setupStepsFromDoctor(doctor) {
  const steps = [];
  if (!doctor || !doctor.browser || doctor.browser.status !== 'present') {
    steps.push({
      gap: 'pixel-review-browser',
      label: 'Enable full pixel review',
      command: doctor && doctor.browser && doctor.browser.fix || 'run /design-setup',
    });
  }

  const records = credentialRecords(doctor);
  const hasCredential = Object.values(records).some((item) => item && item.present === true);
  if (!hasCredential) {
    for (const key of ['codexOAuth', 'openaiApiKey', 'geminiApiKey']) {
      const item = records[key] || {};
      steps.push({
        gap: 'image-credential',
        label: key === 'codexOAuth' ? 'Enable free image generation' : `Enable ${item.label || key}`,
        command: item.enableCommand || ENABLE_COMMANDS[key],
        alternative: true,
      });
    }
  }
  return { steps, hasCredential };
}

function formatOnboarding(doctor, steps, hasCredential) {
  const browserReady = doctor && doctor.browser && doctor.browser.status === 'present';
  const lines = [
    'WELCOME TO VISIGNER — your first design check is ready.',
    'What just happened: Visigner recognized the first HTML design in this workspace and checked which design tools are ready. This matters because every draft can get a static quality grade, while browser and image setup unlock pixel review and real image generation.',
    'What you will see next: the normal design flow shows the grade, any human-must-do checklist, and—when a browser is ready—captured page tiles for visual critique.',
  ];
  if (!steps.length) {
    lines.push("YOU'RE SET — just describe the page you want.");
  } else {
    lines.push('ONE-TAP NEXT STEPS (optional; nothing runs without your action):');
    for (const step of steps) lines.push(`- ${step.label}: ${step.command}`);
  }
  lines.push('ZERO-KNOWLEDGE DEFAULTS:');
  lines.push(`- Images: ${hasCredential ? 'image generation is available; on-brand SVG placeholders remain the safe fallback' : 'no image credential is required; on-brand SVG placeholders keep the page renderable'}.`);
  lines.push(`- Brand: ${BRAND_DEFAULT} supply a coherent starting palette, type, spacing, and component style until you provide a brand.`);
  lines.push(`- Pixel review: ${browserReady ? 'the browser is ready now' : 'a guided browser install is available, requires your consent, and is never auto-run'}.`);
  lines.push('This onboarding is advice only and never blocks your page.');
  return lines.join('\n');
}

async function buildFirstRunOnboarding(event, {
  fsApi = fs,
  pluginRoot = PLUGIN_ROOT,
  env = process.env,
  browserProbe = detectBrowserAvailability,
  browserCacheProbe,
  credentialProbe = detectImageCredentialsInProcess,
  doctorRunner = runDesignDoctor,
} = {}) {
  const novelty = detectFirstRun(event, { fsApi, pluginRoot });
  if (!novelty.firstRun) {
    return {
      status: 'not-first-run',
      emit: false,
      firstRun: false,
      readOnly: true,
      zeroNetwork: true,
      message: '',
      novelty,
    };
  }

  const doctor = await safeDoctor({
    env,
    browserProbe,
    browserCacheProbe,
    credentialProbe,
    doctorRunner,
  });
  const { steps, hasCredential } = setupStepsFromDoctor(doctor);
  const baseMessage = formatOnboarding(doctor, steps, hasCredential);
  // Source the zero-knowledge pipeline defaults from the single shared resolver (G4.4), injecting the
  // already-known browser state so this stays spawn-free on the onboarding hot path.
  let pipelineDefaults = null;
  try {
    pipelineDefaults = await resolvePipelineDefaults({}, { env, pluginRoot, browserProbe });
  } catch (_) {
    pipelineDefaults = null;
  }
  // Genuinely CONSUME the resolved defaults: surface them to the novice in one plain line (a real reader,
  // not a discarded value) — so the user is told exactly which starter defaults are in effect and that
  // nothing is blocked. If the resolver failed, fall back to the base message unchanged.
  const message = pipelineDefaults
    ? `${baseMessage}\nStarter defaults in effect (all overridable, nothing is blocked): image = ${pipelineDefaults.provider}; tokens = ${BRAND_DEFAULT}; aspect = ${pipelineDefaults.aspect}.`
    : baseMessage;
  return {
    status: 'emitted',
    emit: true,
    firstRun: true,
    advisory: true,
    readOnly: true,
    zeroNetwork: true,
    imageGenerationBlocked: false,
    novelty,
    doctor,
    setupSteps: steps,
    defaults: {
      image: hasCredential ? 'image generation with SVG fallback' : 'on-brand SVG placeholder',
      brand: BRAND_DEFAULT,
      browser: doctor && doctor.browser && doctor.browser.status === 'present'
        ? 'ready'
        : 'guided install available; consent required',
    },
    pipelineDefaults, // sourced from + surfaced from the shared G4.4 resolver (defaults.js)
    message,
    systemMessage: message,
    additionalContext: message,
  };
}

module.exports = {
  BRAND_DEFAULT,
  IGNORED_DIRECTORIES,
  buildFirstRunOnboarding,
  detectFirstRun,
  formatOnboarding,
  setupStepsFromDoctor,
};
