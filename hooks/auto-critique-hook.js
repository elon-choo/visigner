#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const MAX_EVENT_BYTES = 32 * 1024 * 1024;
const RUNNER = path.resolve(__dirname, 'auto-grade-runner.js');
const PIXEL_OFF_NOTICE = 'PIXEL CRITIQUE IS OFF — run /design-setup to enable full visual critique.';

let input = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
  if (Buffer.byteLength(input, 'utf8') > MAX_EVENT_BYTES) process.exit(0);
});
process.stdin.on('end', run);
process.stdin.resume();

function emitContext(message, userMessage) {
  process.stdout.write(JSON.stringify({
    systemMessage: userMessage || message,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: message,
    },
  }));
}

function targetFrom(event) {
  if (!event || event.hook_event_name !== 'PostToolUse') return null;
  if (event.tool_name !== 'Write' && event.tool_name !== 'Edit') return null;

  const raw = event.tool_input && event.tool_input.file_path;
  if (typeof raw !== 'string' || raw.length === 0) return null;

  let target = path.resolve(
    typeof event.cwd === 'string' && event.cwd.length > 0 ? event.cwd : process.cwd(),
    raw,
  );

  try {
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) target = fs.realpathSync(target);
    if (!fs.statSync(target).isFile()) return null;
  } catch (_) {
    return null;
  }
  if (!['.html', '.htm'].includes(path.extname(target).toLowerCase())) return null;
  return target;
}

function resolveAssetManifest(target) {
  const candidate = path.join(path.dirname(target), 'assets', 'manifest.json');
  try {
    return fs.statSync(candidate).isFile() ? candidate : null;
  } catch (_) {
    return null;
  }
}

function buildHumanGate(target, result) {
  const manifestPath = resolveAssetManifest(target);
  try {
    // Keep detector/provisioning modules out of non-design turns by loading only after targetFrom accepts HTML.
    const { buildHumanGateReport } = require('./human-gate/human-gate-report.js');
    return {
      manifestPath,
      referencedSvgScan: true,
      report: buildHumanGateReport(target, {
        manifestPath,
        gradeResult: result,
        env: process.env,
      }),
    };
  } catch (error) {
    const header = 'STOP — this draft is not ready to ship until you resolve 1 human-must-do item';
    return {
      manifestPath,
      referencedSvgScan: true,
      report: {
        stop: true,
        itemCount: 1,
        plainText: `${header}\n1. What needs attention: The automatic human checklist could not finish. Where: the whole page. What to do: Review every image, unfinished text, and factual claim before shipping, then run the check again.`,
      },
      error: error.message,
    };
  }
}

function compactGrade(result, event, humanGate) {
  const grade = result.staticGrade || {};
  const verdict = typeof grade.verdict === 'string' && grade.verdict.length
    ? grade.verdict
    : 'blocked-static-grade-error';
  const s2Pass = grade.s2Pass === true;
  const tells = Array.isArray(grade.tellsDetected) ? grade.tellsDetected : [];
  const tellSummary = tells.length
    ? tells.map((item) => `${item.tell}:${item.severity}`).join(', ')
    : 'none';
  const mechanical = grade.mechanicalScore && typeof grade.mechanicalScore === 'object'
    ? `${grade.mechanicalScore.score}/${grade.mechanicalScore.letter}`
    : 'unavailable';
  const render = result.render || { status: 'skipped', reason: 'render result unavailable' };
  const pixelOff = render.status !== 'fired';
  const guidedInstall = render.setupRequired && render.provisioning
    && typeof render.provisioning.installCommand === 'string'
    ? render.provisioning
    : null;
  const tasteSuspect = result.tasteSuspect === true;
  const tasteCaveat = result.tasteCaveat || 'Taste honesty signal unavailable.';
  const humanGateRequired = result.humanGateRequired === true;
  const gateReport = humanGate && humanGate.report;
  const emitChecklist = Boolean(gateReport
    && (gateReport.stop === true || humanGateRequired || tasteSuspect));
  const checklistText = emitChecklist && typeof gateReport.plainText === 'string'
    ? gateReport.plainText
    : null;

  const userMessage = [
    pixelOff ? PIXEL_OFF_NOTICE : null,
    guidedInstall ? `ONE-TAP GUIDED BROWSER SETUP (consent required; not auto-run): ${guidedInstall.installCommand}` : null,
    `STATIC GRADE EMITTED — verdict: ${verdict}; s2Pass: ${s2Pass}; tellsDetected: ${tells.length}; mechanicalScore: ${mechanical}; render: ${render.status}.`,
    `tasteSuspect: ${tasteSuspect}.`,
    tasteSuspect ? `HUMAN TASTE REVIEW REQUIRED — ${tasteCaveat}` : null,
    checklistText,
  ].filter(Boolean).join(' ');

  const lines = [
    pixelOff ? PIXEL_OFF_NOTICE : null,
    guidedInstall ? 'guidedInstallStatus: available' : null,
    guidedInstall ? `guidedInstallCommand: ${guidedInstall.installCommand}` : null,
    guidedInstall ? `guidedInstallSource: ${guidedInstall.source}` : null,
    guidedInstall ? `guidedInstallConsentRequired: ${guidedInstall.consentRequired === true}` : null,
    guidedInstall ? `guidedInstallExecuted: ${guidedInstall.installExecuted === true}` : null,
    `Visigner auto-grade fired automatically after ${event.tool_name} of ${result.target}.`,
    `staticGradeStatus: ${grade.status || 'emitted-fallback'}`,
    `verdict: ${verdict}`,
    `s2Pass: ${s2Pass}`,
    `tellsDetected: ${tells.length} (${tellSummary})`,
    `mechanicalScore: ${mechanical}`,
    `tasteSuspect: ${tasteSuspect}`,
    `humanGateRequired: ${humanGateRequired}`,
    `tasteSignals: ${Array.isArray(result.tasteSignals) && result.tasteSignals.length ? result.tasteSignals.join(', ') : 'none'}`,
    `tasteCaveat: ${tasteCaveat}`,
    `staticReport: ${grade.reportPath || 'unavailable'}`,
    `render: ${render.status}${render.reason ? ` (${render.reason})` : ''}`,
  ].filter(Boolean);

  if (render.status === 'fired') {
    lines.push(`shotsDir: ${render.shotsDir}`);
    lines.push(`runJson: ${render.runJson}`);
    lines.push(`captureTiles: ${render.tiles.join(', ')}`);
    lines.push(`designCriticHandoff: ready; artifact=${result.target}; runJson=${render.runJson}; tiles=${render.tiles.join(', ')}`);
  } else {
    lines.push('designCriticHandoff: static-only; capture tiles unavailable');
  }

  if (emitChecklist) {
    lines.push('humanGateStatus: STOP');
    lines.push(`humanGateItems: ${Number(gateReport.itemCount || 0)}`);
    lines.push(`humanGateManifest: ${humanGate.manifestPath || 'none'}`);
    lines.push(`humanGateReferencedSvgScan: ${humanGate.referencedSvgScan ? 'active' : 'inactive'}`);
    if (humanGate.error) lines.push(`humanGateError: ${humanGate.error}`);
    lines.push('HUMAN-GATE CHECKLIST');
    lines.push(checklistText);
  }
  return { modelMessage: lines.join('\n'), userMessage };
}

async function buildOnboarding(event, result) {
  // First-run onboarding is a one-time CREATION welcome (G4.1/G4.6): fire only on Write of a NEW artifact,
  // NOT on Edit iterations of the sole page (M1 — "narrate once" for the common single-page novice loop).
  if (!event || event.tool_name !== 'Write') return null;
  try {
    // Load only after targetFrom accepted HTML, so non-design turns never touch the onboarding module.
    const { buildFirstRunOnboarding } = require('./onboarding/first-run.js');
    // Reuse the grade's already-known browser state — never launch Chromium from the onboarding path.
    const browserReady = Boolean(result && result.render && result.render.status === 'fired');
    const onboarding = await buildFirstRunOnboarding(event, {
      env: process.env,
      browserProbe: async () => ({ available: browserReady }),
    });
    return onboarding && onboarding.emit === true ? onboarding : null;
  } catch (_) {
    // Onboarding is advisory — a failure here must never break the grade/human-gate emit.
    return null;
  }
}

function emitFailClosedGrade(target, detail) {
  const verdict = 'blocked-static-grade-error';
  emitContext(
    [
      PIXEL_OFF_NOTICE,
      `Visigner auto-grade fired for ${target}.`,
      'staticGradeStatus: emitted-fallback',
      `verdict: ${verdict}`,
      's2Pass: false',
      'mechanicalScore: unavailable',
      'tasteSuspect: false',
      'humanGateRequired: false',
      'tasteCaveat: static grade failed closed before a machine pass could be assessed',
      `gradeError: ${detail}`,
      'designCriticHandoff: static-only; capture tiles unavailable',
    ].join('\n'),
    `${PIXEL_OFF_NOTICE} STATIC GRADE EMITTED — verdict: ${verdict}; s2Pass: false; mechanicalScore: unavailable; tasteSuspect: false.`,
  );
}

// Dedup guard: this hook can be registered BOTH as a plugin hook (hooks/hooks.json) and, on a machine where
// plugin-hook dispatch is unreliable, in the user's settings.json — belt-and-suspenders so the grade actually
// fires. This prevents grading the same tool_use_id twice within a short window. Never blocks on error.
function alreadyGraded(event) {
  const id = event && event.tool_use_id;
  if (typeof id !== 'string' || id.length === 0) return false;
  try {
    const marker = path.join(os.tmpdir(), `visigner-graded-${id.replace(/[^\w-]/g, '').slice(0, 80)}`);
    const now = Date.now();
    try {
      if (now - fs.statSync(marker).mtimeMs < 60_000) return true;
    } catch (_) { /* no prior marker */ }
    fs.writeFileSync(marker, String(now));
    return false;
  } catch (_) {
    return false;
  }
}

async function run() {
  let event;
  try {
    event = JSON.parse(input);
  } catch (_) {
    return;
  }

  const target = targetFrom(event);
  if (!target) return;
  if (alreadyGraded(event)) return; // skip a duplicate dispatch of the same tool_use_id

  try {
    const child = spawnSync(process.execPath, [RUNNER, target], {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
      timeout: 110_000,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });

    if (child.error || child.status !== 0) {
      const detail = child.error
        ? child.error.message
        : String(child.stderr || `auto-grade runner exited ${child.status}`).trim();
      emitFailClosedGrade(target, `runner failed safely: ${detail}`);
      return;
    }

    const result = JSON.parse(child.stdout);
    const humanGate = buildHumanGate(target, result);
    const messages = compactGrade(result, event, humanGate);
    // Additive: prepend the one-time first-run onboarding when this is a genuine first/cold run (read-only novelty).
    const onboarding = await buildOnboarding(event, result);
    if (onboarding && typeof onboarding.message === 'string' && onboarding.message.length) {
      const modelMessage = `${onboarding.message}\nonboardingStatus: first-run-emitted\n\n${messages.modelMessage}`;
      emitContext(modelMessage, `${onboarding.message} ${messages.userMessage}`);
    } else {
      emitContext(messages.modelMessage, messages.userMessage);
    }
  } catch (error) {
    emitFailClosedGrade(target, `hook failed safely: ${error.message}`);
  }
}
