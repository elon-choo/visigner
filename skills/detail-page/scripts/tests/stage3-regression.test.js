'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const EVALUATOR = path.join(ROOT, 'skills', 'detail-page', 'scripts', 'anti-ai-eval.js');
const HOOK = path.join(ROOT, 'hooks', 'auto-critique-hook.js');
const PRELOAD = path.join(__dirname, 'fixtures', 'stage3-non-design-sentinel-preload.js');
const MARKETING_PAGE = path.join(__dirname, 'fixtures', 'g3-marketing-substantiated', 'index.html');
const DOCS = ['docs/index.html', 'docs/guide.html', 'docs/how-to.html'];

const {
  CLEAR_HEADER,
  buildHumanGateReport,
} = require(path.join(ROOT, 'hooks', 'human-gate', 'human-gate-report.js'));
const {
  detectMetricClaims,
} = require(path.join(ROOT, 'hooks', 'human-gate', 'metric-claim-detector.js'));

function noCredentialEnv(home) {
  const env = { ...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex') };
  for (const key of ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'IMG_PROVIDER', 'OPENAI_RESPONSES_AUTH']) delete env[key];
  return env;
}

function gradePage(page) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-g38-grade-'));
  const child = childProcess.spawnSync(process.execPath, [EVALUATOR, page], {
    cwd: workDir,
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.strictEqual(child.status, 0, child.stderr);
  assert.strictEqual(child.stderr, '');
  const reportPath = path.join(workDir, 'anti-ai-report.json');
  return {
    child,
    report: JSON.parse(fs.readFileSync(reportPath, 'utf8')),
    workDir,
  };
}

function runMachineQuietSentinel(run, env) {
  const counts = { spawns: 0, fsWrites: 0, envWrites: 0 };
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

  const syncAndCallbackWrites = [
    'writeFileSync', 'appendFileSync', 'writeFile', 'appendFile', 'createWriteStream',
    'mkdirSync', 'mkdir', 'renameSync', 'rename', 'rmSync', 'rm', 'unlinkSync',
    'unlink', 'copyFileSync', 'copyFile', 'truncateSync', 'truncate',
  ];
  for (const name of syncAndCallbackWrites) {
    const original = fs[name];
    if (typeof original !== 'function') continue;
    restores.push(() => { fs[name] = original; });
    fs[name] = function monitoredFsWrite(...args) {
      counts.fsWrites += 1;
      return original.apply(this, args);
    };
  }
  for (const name of ['writeFile', 'appendFile', 'mkdir', 'rename', 'rm', 'unlink', 'copyFile', 'truncate']) {
    const original = fs.promises[name];
    if (typeof original !== 'function') continue;
    restores.push(() => { fs.promises[name] = original; });
    fs.promises[name] = function monitoredPromiseWrite(...args) {
      counts.fsWrites += 1;
      return original.apply(this, args);
    };
  }

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

  let value;
  process.env = monitoredEnv;
  try {
    value = run(monitoredEnv);
  } finally {
    if (process.env !== monitoredEnv) counts.envWrites += 1;
    process.env = originalEnv;
    while (restores.length) restores.pop()();
  }
  return { counts, value };
}

test('three shipped docs pages remain clean 100/A and human-gate clear', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-g38-docs-'));
  try {
    for (const relative of DOCS) {
      const page = path.join(ROOT, relative);
      const grade = gradePage(page);
      try {
        assert.strictEqual(grade.report.verdict, 'clean', relative);
        assert.strictEqual(grade.report.s2Pass, true, relative);
        assert.strictEqual(grade.report.mechanicalScore.score, 100, relative);
        assert.strictEqual(grade.report.mechanicalScore.letter, 'A', relative);

        const gate = buildHumanGateReport(page, {
          env: noCredentialEnv(home),
          gradeResult: grade.report,
        });
        assert.strictEqual(gate.stop, false, `${relative}: ${gate.plainText}`);
        assert.strictEqual(gate.itemCount, 0, relative);
        assert.strictEqual(gate.header, CLEAR_HEADER, relative);
        assert.deepStrictEqual(gate.errors, [], relative);
        console.log(`G3.8 DOC ${relative}: verdict=clean; mechanicalScore=100/A; s2Pass=true; humanGateStop=false; items=0; PASS`);
      } finally {
        fs.rmSync(grade.workDir, { recursive: true, force: true });
      }
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('complete substantiated Korean marketing page has no false human-gate STOP', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-g38-marketing-'));
  const grade = gradePage(MARKETING_PAGE);
  try {
    const claims = detectMetricClaims(MARKETING_PAGE);
    assert.strictEqual(claims.flagCount, 0, JSON.stringify(claims.items));
    assert.strictEqual(claims.substantiatedCount, 5);
    assert.deepStrictEqual(claims.substantiatedClaims.map((item) => item.claim), [
      '#1',
      '99.9% satisfaction',
      'Rated 4.9/5',
      '후기 184건',
      'the best',
    ]);

    const gate = buildHumanGateReport(MARKETING_PAGE, {
      env: noCredentialEnv(home),
      gradeResult: grade.report,
    });
    assert.strictEqual(gate.stop, false, gate.plainText);
    assert.strictEqual(gate.itemCount, 0);
    assert.strictEqual(gate.detectorSummary.claimGaps, 0);
    assert.strictEqual(gate.detectorSummary.substantiatedClaims, 5);
    assert.strictEqual(gate.header, CLEAR_HEADER);
    console.log(`G3.8 MARKETING: substantiatedClaims=5 (#1, 99.9% satisfaction, Rated 4.9/5, 후기 184건, the best); claimGaps=0; humanGateStop=false; items=0; PASS`);
  } finally {
    fs.rmSync(grade.workDir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('non-design matrix emits no grade, human-gate, provisioning, or output', () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-g38-no-fire-'));
  const sentinel = path.join(fixtureDir, 'events.jsonl');
  const markdown = path.join(fixtureDir, 'notes.md');
  fs.writeFileSync(markdown, '# Ordinary project notes\n');
  const cases = [
    {
      name: 'non-html-write',
      event: {
        hook_event_name: 'PostToolUse', tool_name: 'Write', cwd: ROOT,
        tool_input: { file_path: markdown }, tool_response: { success: true },
      },
    },
    {
      name: 'html-read',
      event: {
        hook_event_name: 'PostToolUse', tool_name: 'Read', cwd: ROOT,
        tool_input: { file_path: path.join(ROOT, 'docs', 'index.html') }, tool_response: { success: true },
      },
    },
    {
      name: 'plain-turn',
      event: {
        hook_event_name: 'UserPromptSubmit', tool_name: 'UserPromptSubmit', cwd: ROOT,
        user_prompt: 'Explain a general programming concept without creating a design.',
      },
    },
  ];

  try {
    for (const item of cases) {
      const child = childProcess.spawnSync(process.execPath, [HOOK], {
        cwd: ROOT,
        input: JSON.stringify(item.event),
        encoding: 'utf8',
        timeout: 10_000,
        maxBuffer: 2 * 1024 * 1024,
        env: {
          ...process.env,
          NODE_OPTIONS: `--require=${PRELOAD}`,
          VISIGNER_STAGE3_NON_DESIGN_SENTINEL: sentinel,
        },
      });
      assert.strictEqual(child.status, 0, `${item.name}: ${child.stderr}`);
      assert.strictEqual(child.stdout, '', `${item.name}: emitted hook output`);
      assert.strictEqual(child.stderr, '', `${item.name}: emitted hook error`);
      console.log(`G3.8 NON-DESIGN ${item.name}: stdoutBytes=0; stderrBytes=0; grade=0; humanGate=0; provisioning=0; PASS`);
    }
    const events = fs.existsSync(sentinel)
      ? fs.readFileSync(sentinel, 'utf8').trim().split(/\n/).filter(Boolean).map(JSON.parse)
      : [];
    assert.deepStrictEqual(events, []);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('normal graded-page human-gate stage is machine-quiet', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-g38-quiet-'));
  const page = path.join(ROOT, 'docs', 'index.html');
  const grade = gradePage(page);
  try {
    const sentinel = runMachineQuietSentinel((monitoredEnv) => buildHumanGateReport(page, {
      env: monitoredEnv,
      gradeResult: grade.report,
    }), noCredentialEnv(home));
    assert.strictEqual(sentinel.value.stop, false);
    assert.strictEqual(sentinel.value.itemCount, 0);
    assert.deepStrictEqual(sentinel.counts, { spawns: 0, fsWrites: 0, envWrites: 0 });
    console.log(`G3.8 MACHINE-QUIET graded-human-gate: spawns=0; fs-writes=0; env-writes=0; stop=false; items=0; PASS`);
  } finally {
    fs.rmSync(grade.workDir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});
