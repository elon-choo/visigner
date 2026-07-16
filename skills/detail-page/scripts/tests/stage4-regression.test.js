'use strict';

// G4.6 — Stage 4 regression + non-interference guard.
// Load-bearing: the onboarding fires ONLY on the read-only-novelty first-run signal (T1),
// NOT on "gaps present" — so a RETURNING/EXPERT workspace with persistent cred/browser gaps
// gets 0 onboarding lines while the human-gate + guided-install still surface (T2). Plus:
// docs pages stay clean + no false human-gate STOP; non-design no-fire; machine-quiet.

const assert = require('assert');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const HOOK = path.join(ROOT, 'hooks', 'auto-critique-hook.js');
const { buildFirstRunOnboarding } = require(path.join(ROOT, 'hooks', 'onboarding', 'first-run.js'));
const { buildHumanGateReport } = require(path.join(ROOT, 'hooks', 'human-gate', 'human-gate-report.js'));

const DOCS = ['index.html', 'guide.html', 'how-to.html'].map((f) => path.join(ROOT, 'docs', f));
function noCredEnv() {
  return { PATH: process.env.PATH, HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'g46-nc-')) };
}
function ev(cwd, target) {
  return { hook_event_name: 'PostToolUse', tool_name: 'Write', cwd, tool_input: { file_path: target } };
}

// T2: a RETURNING/EXPERT workspace (a prior produced *.html already exists) WITH persistent gaps
// (no cred, no browser) → onboarding emits NOTHING; the human-gate + guided-install still surface.
test('T2 returning/expert workspace with persistent gaps → 0 onboarding lines, gate/guided still fire', async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'g46-returning-'));
  // a PRIOR artifact makes this NOT a first run
  fs.writeFileSync(path.join(ws, 'earlier-page.html'), '<!doctype html><html><body><h1>Earlier</h1></body></html>');
  const target = path.join(ws, 'new-page.html');
  fs.writeFileSync(target, '<!doctype html><html><body><h1>New</h1><img src="x.svg"></body></html>');

  const onboarding = await buildFirstRunOnboarding(ev(ws, target), { env: noCredEnv() });
  assert.strictEqual(onboarding.emit, false, 'onboarding must NOT fire on a returning workspace with gaps');
  assert.strictEqual(onboarding.firstRun, false);

  // the hook still surfaces the guided-install affordance (persistent browser gap) — not silenced
  const child = spawnSync(process.execPath, [HOOK], {
    cwd: ws,
    env: {
      ...process.env,
      HOME: noCredEnv().HOME,
      VISIGNER_FORCE_BROWSER_MISSING: '1',
      VISIGNER_NO_AUTO_BROWSER: '1',
    },
    input: JSON.stringify(ev(ws, target)),
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.strictEqual(child.status, 0, child.stderr);
  const ctx = JSON.parse(child.stdout).hookSpecificOutput.additionalContext;
  assert.match(ctx, /staticGradeStatus:\s*emitted/); // grade still fires
  assert.match(ctx, /PIXEL CRITIQUE IS OFF/); // guided/degrade still surfaces
  assert.doesNotMatch(ctx, /WELCOME TO VISIGNER/); // NO onboarding narration in the returning hook path
  fs.rmSync(ws, { recursive: true, force: true });
});

// Positive control THROUGH THE HOOK — proves the T2 doesNotMatch(WELCOME) above is NOT vacuous:
// the hook genuinely has a live onboarding branch that DOES fire on a first-run Write.
test('first-run Write through the hook DOES emit onboarding (positive control, non-vacuous T2)', () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'g46-first-'));
  const target = path.join(ws, 'index.html'); // sole HTML in a bare workspace = first-run
  fs.writeFileSync(target, '<!doctype html><html><body><h1>First</h1></body></html>');
  const child = spawnSync(process.execPath, [HOOK], {
    cwd: ws,
    env: {
      ...process.env,
      HOME: noCredEnv().HOME,
      VISIGNER_FORCE_BROWSER_MISSING: '1',
      VISIGNER_NO_AUTO_BROWSER: '1',
    },
    input: JSON.stringify(ev(ws, target)),
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.strictEqual(child.status, 0, child.stderr);
  const ctx = JSON.parse(child.stdout).hookSpecificOutput.additionalContext;
  assert.match(ctx, /WELCOME TO VISIGNER/); // the hook onboarding branch is live
  assert.match(ctx, /onboardingStatus:\s*first-run-emitted/);
  // module-level check too
  return buildFirstRunOnboarding(ev(ws, target), { env: noCredEnv() }).then((o) => {
    assert.strictEqual(o.emit, true);
    assert.strictEqual(o.firstRun, true);
    fs.rmSync(ws, { recursive: true, force: true });
  });
});

// docs pages stay clean: NO false human-gate STOP on the complete real shipped pages
test('shipped docs pages produce no false human-gate STOP', () => {
  for (const page of DOCS) {
    const report = buildHumanGateReport(page, {});
    assert.strictEqual(report.stop, false, `${path.basename(page)} should not STOP: ${report.plainText || ''}`);
    assert.strictEqual(report.itemCount, 0, path.basename(page));
  }
});

// non-design no-fire preserved: a .md write through the hook emits nothing
test('non-design .md write → hook emits nothing (no-fire preserved)', () => {
  const md = path.join(os.tmpdir(), `g46-note-${process.pid}.md`);
  fs.writeFileSync(md, '# note');
  const child = spawnSync(process.execPath, [HOOK], {
    cwd: ROOT,
    env: { ...process.env, VISIGNER_FORCE_BROWSER_MISSING: '1' },
    input: JSON.stringify(ev(ROOT, md)),
    encoding: 'utf8',
    timeout: 15000,
  });
  assert.strictEqual(child.status, 0);
  assert.strictEqual(child.stdout, '');
  fs.rmSync(md, { force: true });
});

// machine-quiet: a full onboarding + human-gate run over a page performs 0 fs-writes
test('machine-quiet: onboarding + human-gate perform 0 fs-writes', async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'g46-quiet-'));
  const target = path.join(ws, 'index.html');
  fs.writeFileSync(target, '<!doctype html><html><body><h1>Q</h1><img src="a.svg"></body></html>');
  let writes = 0;
  const orig = {};
  for (const m of ['writeFileSync', 'appendFileSync', 'writeFile', 'createWriteStream']) {
    orig[m] = fs[m];
    fs[m] = function (...a) { writes += 1; return orig[m].apply(this, a); };
  }
  try {
    await buildFirstRunOnboarding(ev(ws, target), { env: noCredEnv() });
    buildHumanGateReport(target, {});
  } finally {
    for (const m of Object.keys(orig)) fs[m] = orig[m];
  }
  assert.strictEqual(writes, 0, 'onboarding + human-gate must not write to disk');
  fs.rmSync(ws, { recursive: true, force: true });
});
