'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const Module = require('module');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const HOOK = path.join(ROOT, 'hooks', 'auto-critique-hook.js');
const FIXTURES = path.join(__dirname, 'fixtures');
const MACHINE_PASS = {
  s2Pass: true,
  mechanicalScore: { score: 100, letter: 'A', incomplete: false },
  tasteSuspect: false,
  humanGateRequired: false,
  tasteSignals: [],
};

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function stateSnapshot(report) {
  return {
    states: Object.fromEntries(Object.entries(report.credentials).map(([key, value]) => [key, value.present])),
    present: report.present,
    absent: report.absent,
    missingFixes: report.missingFixes,
    preferredCredential: report.preferredCredential,
    imageGenerationBlocked: report.imageGenerationBlocked,
    placeholderFallback: report.placeholderFallback,
  };
}

function noCredentialEnv(home) {
  const env = { ...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex') };
  for (const key of ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'IMG_PROVIDER', 'OPENAI_RESPONSES_AUTH']) delete env[key];
  return env;
}

function cleanupGradeReport(context) {
  const match = String(context || '').match(/^staticReport:\s*(.+)$/mi);
  if (!match || match[1].trim() === 'unavailable') return;
  const reportDir = path.dirname(match[1].trim());
  if (path.basename(reportDir).startsWith('visigner-auto-grade-')) {
    fs.rmSync(reportDir, { recursive: true, force: true });
  }
}

function invokeHook(page, env) {
  return childProcess.spawnSync(process.execPath, [HOOK], {
    cwd: ROOT,
    input: JSON.stringify({
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      cwd: ROOT,
      tool_input: { file_path: page },
      tool_response: { success: true },
    }),
    encoding: 'utf8',
    timeout: 45_000,
    maxBuffer: 12 * 1024 * 1024,
    env: {
      ...env,
      VISIGNER_FORCE_BROWSER_MISSING: '1',
      VISIGNER_NO_AUTO_BROWSER: '1',
    },
  });
}

function runMachineSentinel(page, env) {
  const counts = { spawns: 0, fsWrites: 0, envWrites: 0 };
  const moduleLoads = { credDetect: 0 };
  const restores = [];
  const originalEnv = process.env;

  for (const name of ['spawn', 'spawnSync', 'exec', 'execSync']) {
    const original = childProcess[name];
    restores.push(() => { childProcess[name] = original; });
    childProcess[name] = function monitoredChildProcess(...args) {
      counts.spawns += 1;
      return original.apply(this, args);
    };
  }

  const writeMethods = [
    'writeFileSync', 'appendFileSync', 'writeFile', 'appendFile', 'createWriteStream',
    'mkdirSync', 'mkdir', 'renameSync', 'rename', 'rmSync', 'rm', 'unlinkSync',
    'unlink', 'copyFileSync', 'copyFile', 'truncateSync', 'truncate',
  ];
  for (const name of writeMethods) {
    const original = fs[name];
    if (typeof original !== 'function') continue;
    restores.push(() => { fs[name] = original; });
    fs[name] = function monitoredFsWrite(...args) {
      counts.fsWrites += 1;
      return original.apply(this, args);
    };
  }
  const promiseWrites = ['writeFile', 'appendFile', 'mkdir', 'rename', 'rm', 'unlink', 'copyFile', 'truncate'];
  for (const name of promiseWrites) {
    const original = fs.promises[name];
    if (typeof original !== 'function') continue;
    restores.push(() => { fs.promises[name] = original; });
    fs.promises[name] = function monitoredPromiseWrite(...args) {
      counts.fsWrites += 1;
      return original.apply(this, args);
    };
  }

  const originalLoad = Module._load;
  Module._load = function monitoredLoad(request, parent, isMain) {
    if (/(?:^|\/)cred-detect(?:\.js)?$/.test(String(request))) moduleLoads.credDetect += 1;
    return originalLoad.call(this, request, parent, isMain);
  };
  restores.push(() => { Module._load = originalLoad; });

  const backing = { ...env };
  const monitoredEnv = new Proxy(backing, {
    set(target, key, value) {
      counts.envWrites += 1;
      target[key] = value;
      return true;
    },
    deleteProperty(target, key) {
      counts.envWrites += 1;
      return delete target[key];
    },
    defineProperty(target, key, descriptor) {
      counts.envWrites += 1;
      return Reflect.defineProperty(target, key, descriptor);
    },
  });

  let report;
  process.env = monitoredEnv;
  try {
    const modulePath = path.join(ROOT, 'hooks', 'human-gate', 'human-gate-report.js');
    const { buildHumanGateReport } = require(modulePath);
    report = buildHumanGateReport(page, { env: monitoredEnv, gradeResult: MACHINE_PASS });
  } finally {
    if (process.env !== monitoredEnv) counts.envWrites += 1;
    process.env = originalEnv;
    while (restores.length) restores.pop()();
  }
  return { counts, moduleLoads, report };
}

test('G3.7 full human-gate is byte-preserving, zero-mutation, and never fabricates claims', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-g37-'));
  const env = noCredentialEnv(home);
  const pages = [
    ['F1', path.join(FIXTURES, 'g3-f1-external-svg', 'index.html')],
    ['copy-token-gaps', path.join(FIXTURES, 'g3-copy-token-gaps', 'index.html')],
    ['metric-claims-mixed', path.join(FIXTURES, 'g3-metric-claims-mixed', 'index.html')],
    ['multi-gap', path.join(FIXTURES, 'g3-human-gate-multi', 'index.html')],
  ];

  try {
    const sentinel = runMachineSentinel(pages[3][1], env);
    assert.ok(sentinel.moduleLoads.credDetect >= 1, 'sentinel must observe the production cred-detect module load');
    assert.strictEqual(sentinel.report.stop, true);
    assert.deepStrictEqual(sentinel.counts, { spawns: 0, fsWrites: 0, envWrites: 0 });
    console.log(`G3.7 SENTINEL: spawns=${sentinel.counts.spawns}; fs-writes=${sentinel.counts.fsWrites}; env-writes=${sentinel.counts.envWrites}; cred-detect-loads=${sentinel.moduleLoads.credDetect}; PASS`);

    const {
      detectImageCredentials,
      detectImageCredentialsInProcess,
    } = require(path.join(ROOT, 'hooks', 'cred-detect.js'));
    const currentDoctor = detectImageCredentials({ env: process.env });
    const currentInProcess = detectImageCredentialsInProcess({ env: process.env });
    assert.deepStrictEqual(stateSnapshot(currentInProcess), stateSnapshot(currentDoctor));
    assert.strictEqual(currentInProcess.detectionMode, 'in-process');
    console.log(`G3.7 PARITY current: doctor=${JSON.stringify(stateSnapshot(currentDoctor).states)}; in-process=${JSON.stringify(stateSnapshot(currentInProcess).states)}; equal=true`);

    const emptyDoctor = detectImageCredentials({ env });
    const emptyInProcess = detectImageCredentialsInProcess({ env });
    assert.deepStrictEqual(stateSnapshot(emptyInProcess), stateSnapshot(emptyDoctor));
    assert.deepStrictEqual(stateSnapshot(emptyInProcess).states, {
      codexOAuth: false,
      openaiApiKey: false,
      geminiApiKey: false,
    });
    assert.strictEqual(emptyInProcess.imageGenerationBlocked, false);
    assert.strictEqual(emptyInProcess.placeholderFallback.active, true);
    assert.strictEqual(emptyInProcess.placeholderFallback.pageRemainsRenderable, true);
    console.log(`G3.7 PARITY no-cred: doctor=${JSON.stringify(stateSnapshot(emptyDoctor).states)}; in-process=${JSON.stringify(stateSnapshot(emptyInProcess).states)}; equal=true; imageGenerationBlocked=false; placeholderRenderable=true`);

    const { buildHumanGateReport } = require(path.join(ROOT, 'hooks', 'human-gate', 'human-gate-report.js'));
    const hashRows = [];
    for (const [name, page] of pages) {
      const before = sha256(page);
      const direct = buildHumanGateReport(page, { env, gradeResult: MACHINE_PASS });
      const afterBuild = sha256(page);
      assert.strictEqual(afterBuild, before, `${name}: direct human-gate mutated page bytes`);
      assert.strictEqual(direct.stop, true, `${name}: expected planted gap to stop`);

      const child = invokeHook(page, env);
      assert.strictEqual(child.status, 0, `${name}: ${child.stderr}`);
      assert.strictEqual(child.stderr, '', name);
      const output = JSON.parse(child.stdout);
      const context = output.hookSpecificOutput.additionalContext;
      assert.match(context, /HUMAN-GATE CHECKLIST/);
      assert.match(context, /STOP — this draft is not ready to ship/i);
      const afterHook = sha256(page);
      assert.strictEqual(afterHook, before, `${name}: live hook mutated page bytes`);
      cleanupGradeReport(context);

      hashRows.push({ fixture: name, before, afterBuild, afterHook });
      console.log(`G3.7 SHA256 ${name}: before=${before}; after-build=${afterBuild}; after-hook=${afterHook}; byte-identical=true`);
    }

    assert.strictEqual(hashRows.length, 4);
    const {
      REVIEW_NOTE,
      detectMetricClaims,
    } = require(path.join(ROOT, 'hooks', 'human-gate', 'metric-claim-detector.js'));
    const metricPage = pages[2][1];
    const metricSource = fs.readFileSync(metricPage, 'utf8');
    const metricReport = detectMetricClaims(metricPage);
    assert.ok(metricReport.items.length > 0);
    for (const item of metricReport.items) {
      assert.ok(metricSource.includes(item.claim), `claim was not quoted from page: ${item.claim}`);
      assert.strictEqual(item.note, REVIEW_NOTE);
      assert.deepStrictEqual(Object.keys(item).sort(), ['claim', 'kind', 'location', 'note']);
      assert.doesNotMatch(item.note, /https?:\/\/|www\.|\b\d+(?:\.\d+)?%?\b/);
    }
    assert.strictEqual(REVIEW_NOTE, 'you must verify/substantiate or remove this claim — provide a source or delete it');
    console.log(`G3.7 METRIC DETECT-ONLY: flagged=${metricReport.flagCount}; every claim quoted from page=true; fabricated values=0; fabricated sources=0; generic-note-only=true`);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
