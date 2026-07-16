#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { assessTasteFile } = require('./taste-suspect.js');
const { guidedProvisioning } = require('./browser-provision.js');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const EVALUATOR = path.join(PLUGIN_ROOT, 'skills', 'detail-page', 'scripts', 'anti-ai-eval.js');
const BRAND_LINT = path.join(PLUGIN_ROOT, 'skills', 'detail-page', 'scripts', 'brand-lint.js');
const SHOOT = path.join(PLUGIN_ROOT, 'skills', 'detail-page', 'scripts', 'shoot.js');
const BROWSER_PROBE = path.join(__dirname, 'browser-availability.js');
const REPORT_NAME = 'anti-ai-report.json';

function cleanDetail(value, fallback) {
  const text = String(value || fallback || '').replace(/\s+/g, ' ').trim();
  return text.slice(0, 800);
}

function failClosedStaticGrade(error) {
  return {
    status: 'emitted-fallback',
    source: 'fail-closed-static-fallback',
    verdict: 'blocked-static-grade-error',
    s2Pass: false,
    tellsDetected: [],
    mechanicalScore: null,
    reportPath: null,
    error: cleanDetail(error, 'anti-ai-eval did not emit a readable report'),
  };
}

// G6.5 (owner decision): fold token-discipline (banned-font Inter/system-ui, unearned ai-purple) into the
// auto-fire grade via brand-lint. mechanical-score scores ONLY the AI_TELL_RULES (ai-purple/banned-font/
// banned-term) from the brand-lint report — raw-hex/rgb/off-grid HYGIENE rules are reported but never summed
// into the score, so hand-written pages with raw hex do NOT cry-wolf. Fails open: if brand-lint can't run,
// the grade proceeds without it (token_discipline stays UNWIRED, the prior behavior).
function brandLintArgsFor(target, workDir) {
  try {
    const report = path.join(workDir, 'brand-lint.json');
    const bl = spawnSync(process.execPath, [BRAND_LINT, target, report], {
      cwd: workDir,
      encoding: 'utf8',
      timeout: 20_000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    });
    if (!bl.error && fs.existsSync(report)) return ['--brand-lint', report];
  } catch (_) { /* fail open */ }
  return [];
}

function runStaticGrade(target, workDir) {
  const result = spawnSync(process.execPath, [EVALUATOR, target, ...brandLintArgsFor(target, workDir)], {
    cwd: workDir,
    encoding: 'utf8',
    timeout: 25_000,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    return failClosedStaticGrade(
      cleanDetail(result.error && result.error.message, result.stderr || `anti-ai-eval exited ${result.status}`),
    );
  }

  const reportPath = path.join(workDir, REPORT_NAME);
  try {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    if (!['clean', 'suspect', 'ai-likely'].includes(report.verdict)) {
      throw new Error('report verdict is missing or invalid');
    }
    if (typeof report.s2Pass !== 'boolean') throw new Error('report s2Pass is missing or invalid');
    if (!report.mechanicalScore || !Number.isFinite(Number(report.mechanicalScore.score))) {
      throw new Error('report mechanicalScore is missing or invalid');
    }
    return {
      status: 'emitted',
      verdict: report.verdict,
      s2Pass: report.s2Pass,
      tellsDetected: Array.isArray(report.tellsDetected) ? report.tellsDetected : [],
      mechanicalScore: report.mechanicalScore || null,
      reportPath,
    };
  } catch (error) {
    return failClosedStaticGrade(`anti-ai-eval report unreadable: ${error.message}`);
  }
}

function detectBrowser() {
  const result = spawnSync(process.execPath, [BROWSER_PROBE], {
    cwd: PLUGIN_ROOT,
    encoding: 'utf8',
    timeout: 20_000,
    maxBuffer: 2 * 1024 * 1024,
    windowsHide: true,
    env: process.env,
  });
  if (result.error || result.status !== 0) {
    return {
      available: false,
      reasonCode: 'probe-failed',
      reason: cleanDetail(result.error && result.error.message, result.stderr || `browser probe exited ${result.status}`),
    };
  }
  try {
    const probe = JSON.parse(result.stdout);
    if (probe.available === true) return probe;
    return {
      ...probe,
      available: false,
      reasonCode: probe.reasonCode || 'browser-unavailable',
      reason: cleanDetail(probe.reason, 'browser probe reported unavailable'),
    };
  } catch (error) {
    return { available: false, reasonCode: 'probe-invalid', reason: `browser probe output unreadable: ${error.message}` };
  }
}

function runRender(target, workDir) {
  if (!fs.existsSync(SHOOT)) return { status: 'skipped', reason: 'shoot.js is unavailable' };

  const browser = detectBrowser();
  if (!browser.available) {
    return {
      status: 'skipped-no-browser',
      browserAvailable: false,
      reasonCode: browser.reasonCode,
      reason: `${browser.reason}. Run /design-setup to install and enable Chromium.`,
      setupRequired: true,
      provisioning: guidedProvisioning(),
    };
  }

  const shotsDir = path.join(workDir, 'shots');
  const result = spawnSync(process.execPath, [SHOOT, target, shotsDir], {
    cwd: PLUGIN_ROOT,
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
    env: {
      ...process.env,
      ASSETS: '0',
      AXE: '',
      GATE_EXIT: '',
      MAX_TILES: '16',
    },
  });

  if (result.error || result.status !== 0) {
    const detail = cleanDetail(result.error && result.error.message, result.stderr || result.stdout || `shoot.js exited ${result.status}`);
    const noBrowser = /Neither patchright nor playwright is installed|Could not launch a browser|browserType\.launch: Executable doesn't exist/i.test(detail);
    try {
      fs.rmSync(shotsDir, { recursive: true, force: true });
    } catch (_) {}
    const render = {
      status: noBrowser ? 'skipped-no-browser' : 'failed-safely',
      browserAvailable: noBrowser ? false : true,
      reasonCode: noBrowser ? 'browser-launch-lost' : 'render-failed',
      reason: detail,
      setupRequired: noBrowser,
      exitCode: result.status,
    };
    if (noBrowser) render.provisioning = guidedProvisioning();
    return render;
  }

  const runJson = path.join(shotsDir, 'run.json');
  let run;
  let tiles;
  try {
    run = JSON.parse(fs.readFileSync(runJson, 'utf8'));
    tiles = fs.readdirSync(shotsDir)
      .filter((name) => /\.png$/i.test(name))
      .sort()
      .map((name) => path.join(shotsDir, name));
  } catch (error) {
    return { status: 'failed-safely', reason: `capture output unreadable: ${error.message}`, shotsDir };
  }
  if (!tiles.length) return { status: 'failed-safely', reason: 'shoot.js wrote no capture PNGs', shotsDir, runJson };

  return {
    status: 'fired',
    browserAvailable: true,
    browser: {
      provider: browser.provider,
      candidate: browser.candidate,
      version: browser.version,
    },
    shotsDir,
    runJson,
    tiles,
    pageHeight: run.pageHeight,
    desktopTiles: run.desktopTiles,
    mobileOverflowPx: run.mobileOverflowPx,
    gateOverall: run.gate && run.gate.report && run.gate.report.overall,
    designCriticHandoff: {
      artifact: target,
      runJson,
      tiles,
    },
  };
}

function main() {
  const target = path.resolve(process.argv[2] || '');
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-auto-grade-'));
  const staticGrade = runStaticGrade(target, workDir);
  const tasteHonesty = assessTasteFile(target, staticGrade);
  const render = staticGrade.status === 'emitted'
    ? runRender(target, workDir)
    : { status: 'skipped', reason: 'fail-closed static grade blocked optional render', browserAvailable: null };

  process.stdout.write(JSON.stringify({ target, workDir, staticGrade, ...tasteHonesty, render }));
}

try {
  main();
} catch (error) {
  process.stdout.write(JSON.stringify({
    target: process.argv[2] || null,
    staticGrade: failClosedStaticGrade(`auto-grade runner failed safely: ${error.message}`),
    machinePassed: false,
    tasteSuspect: false,
    humanGateRequired: false,
    tasteSignals: ['taste-analysis-unavailable'],
    tasteCaveat: `Taste analysis unavailable because the runner failed: ${error.message}`,
    tasteMetrics: null,
    render: { status: 'skipped', reason: 'runner failed before optional render' },
  }));
}
