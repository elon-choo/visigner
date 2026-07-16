'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const HOOK = path.join(ROOT, 'hooks', 'auto-critique-hook.js');
const RECORDER = path.join(__dirname, 'fixtures', 'auto-provision-recorder.js');
const {
  main: runAutoProvisionMain,
  provisioningPaths,
} = require(path.join(ROOT, 'hooks', 'auto-provision-browser.js'));

const PIXEL_OFF = 'PIXEL CRITIQUE IS OFF — run /design-setup to enable full visual critique.';
const AUTO_NOTICE = '픽셀 비평용 브라우저를 백그라운드에서 1회 자동 준비 중입니다 — 약 150MB 다운로드, 끝나면 다음 저장부터 픽셀 루프가 자동으로 켜집니다.';

function hookEvent(artifact, toolName = 'Edit') {
  return {
    hook_event_name: 'PostToolUse',
    tool_name: toolName,
    tool_use_id: `auto-provision-${process.pid}-${Date.now()}-${Math.random()}`,
    cwd: ROOT,
    tool_input: { file_path: artifact },
    tool_response: { success: true },
  };
}

function invokeHook(artifact, env) {
  return spawnSync(process.execPath, [HOOK], {
    cwd: ROOT,
    input: JSON.stringify(hookEvent(artifact)),
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
    env,
  });
}

function cleanupGradeReport(context) {
  const match = String(context || '').match(/^staticReport:\s*(.+)$/mi);
  if (!match || match[1].trim() === 'unavailable') return;
  fs.rmSync(path.dirname(match[1].trim()), { recursive: true, force: true });
}

async function waitForFile(file, timeoutMs = 2000) {
  const started = Date.now();
  while (!fs.existsSync(file) && Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

test('VISIGNER_NO_AUTO_BROWSER keeps the manual fallback and does not spawn provisioning', async () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-auto-optout-'));
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-auto-tmp-'));
  const artifact = path.join(fixtureDir, 'opted-out.html');
  const record = path.join(fixtureDir, 'spawned.txt');
  fs.writeFileSync(artifact, '<!doctype html><html><body><main><h1>Opted out</h1></main></body></html>');

  try {
    const child = invokeHook(artifact, {
      ...process.env,
      TMPDIR: tempRoot,
      VISIGNER_FORCE_BROWSER_MISSING: '1',
      VISIGNER_NO_AUTO_BROWSER: 'yes',
      VISIGNER_AUTO_PROVISION_SCRIPT: RECORDER,
      VISIGNER_AUTO_PROVISION_RECORD: record,
    });
    assert.strictEqual(child.status, 0, child.stderr);
    assert.strictEqual(child.stderr, '');
    const payload = JSON.parse(child.stdout);
    const context = payload.hookSpecificOutput.additionalContext;
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.strictEqual(fs.existsSync(record), false);
    assert.ok(payload.systemMessage.includes(PIXEL_OFF));
    assert.match(payload.systemMessage, /ONE-TAP GUIDED BROWSER SETUP \(consent required; not auto-run\):/);
    assert.match(context, /^autoProvision:\s*disabled$/mi);
    assert.match(context, /^staticGradeStatus:\s*emitted$/mi);
    cleanupGradeReport(context);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('missing browser kicks one detached provisioner while the same run still emits the static grade', async () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-auto-kick-'));
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-auto-tmp-'));
  const artifact = path.join(fixtureDir, 'auto.html');
  const record = path.join(fixtureDir, 'spawned.txt');
  fs.writeFileSync(artifact, '<!doctype html><html><body><main><h1>Auto provision</h1></main></body></html>');
  const env = {
    ...process.env,
    TMPDIR: tempRoot,
    VISIGNER_FORCE_BROWSER_MISSING: '1',
    VISIGNER_AUTO_PROVISION_SCRIPT: RECORDER,
    VISIGNER_AUTO_PROVISION_RECORD: record,
  };
  delete env.VISIGNER_NO_AUTO_BROWSER;

  try {
    const first = invokeHook(artifact, env);
    assert.strictEqual(first.status, 0, first.stderr);
    assert.strictEqual(first.stderr, '');
    const firstPayload = JSON.parse(first.stdout);
    const firstContext = firstPayload.hookSpecificOutput.additionalContext;
    assert.ok(firstPayload.systemMessage.includes(AUTO_NOTICE));
    assert.ok(!firstPayload.systemMessage.includes(PIXEL_OFF));
    assert.match(firstContext, /^autoProvision:\s*kicked$/mi);
    assert.match(firstContext, /^staticGradeStatus:\s*emitted$/mi);
    assert.match(firstContext, /^render:\s*skipped-no-browser/mi);
    cleanupGradeReport(firstContext);

    await waitForFile(record);
    assert.strictEqual(fs.readFileSync(record, 'utf8').trim().split(/\n/).filter(Boolean).length, 1);

    const second = invokeHook(artifact, env);
    assert.strictEqual(second.status, 0, second.stderr);
    assert.strictEqual(second.stderr, '');
    const secondPayload = JSON.parse(second.stdout);
    const secondContext = secondPayload.hookSpecificOutput.additionalContext;
    assert.ok(secondPayload.systemMessage.includes(AUTO_NOTICE));
    assert.match(secondContext, /^autoProvision:\s*in-flight$/mi);
    assert.match(secondContext, /^staticGradeStatus:\s*emitted$/mi);
    cleanupGradeReport(secondContext);

    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.strictEqual(fs.readFileSync(record, 'utf8').trim().split(/\n/).filter(Boolean).length, 1);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('background entry records an installer failure under the lock and still returns exit code 0', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-auto-entry-'));
  const stateDir = path.join(tempRoot, 'visigner-autoprovision');
  const paths = provisioningPaths(stateDir);
  const artifact = path.join(tempRoot, 'failed.html');
  const record = path.join(tempRoot, 'unexpected-spawn.txt');
  let installerCalls = 0;
  let lockObservedDuringInstall = false;
  fs.writeFileSync(artifact, '<!doctype html><html><body><main><h1>Failed provision</h1></main></body></html>');

  try {
    const exitCode = await runAutoProvisionMain({
      stateDir,
      provisioningOptions: {
        pluginRoot: ROOT,
        availabilityProbe: async () => ({
          available: false,
          reasonCode: 'runtime-unresolvable',
          reason: 'mocked missing browser',
        }),
        browserCacheProbe: async () => ({ present: false }),
        installer: () => {
          installerCalls += 1;
          lockObservedDuringInstall = fs.existsSync(paths.lockFile);
          return { status: 1, stderr: 'mock installer failure' };
        },
      },
    });

    assert.strictEqual(exitCode, 0);
    assert.strictEqual(installerCalls, 1);
    assert.strictEqual(lockObservedDuringInstall, true);
    assert.strictEqual(fs.existsSync(paths.lockFile), true);
    const lastRun = JSON.parse(fs.readFileSync(paths.lastRunFile, 'utf8'));
    assert.match(lastRun.timestamp, /^\d{4}-\d{2}-\d{2}T/);
    assert.strictEqual(lastRun.result.status, 'install-failed');
    assert.match(lastRun.result.error, /mock installer failure/);

    const hookEnv = {
      ...process.env,
      TMPDIR: tempRoot,
      VISIGNER_FORCE_BROWSER_MISSING: '1',
      VISIGNER_AUTO_PROVISION_SCRIPT: RECORDER,
      VISIGNER_AUTO_PROVISION_RECORD: record,
    };
    delete hookEnv.VISIGNER_NO_AUTO_BROWSER;
    const hook = invokeHook(artifact, hookEnv);
    assert.strictEqual(hook.status, 0, hook.stderr);
    const payload = JSON.parse(hook.stdout);
    const context = payload.hookSpecificOutput.additionalContext;
    assert.strictEqual(fs.existsSync(record), false);
    assert.ok(payload.systemMessage.includes(PIXEL_OFF));
    assert.match(context, /^autoProvision:\s*failed$/mi);
    cleanupGradeReport(context);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

// The gate must fire ONLY on a genuinely-missing browser (render.setupRequired === true), not on any non-'fired'
// render. This closes M-01 (transient capture failure on a working browser → false "150MB download" notice) and
// H-01 (a fail-closed grade on a broken/full tmpdir → detached respawn on every save + hidden manual fallback).
test('maybeAutoProvision only triggers on setupRequired (browser genuinely missing), never on other non-fired renders', () => {
  const { maybeAutoProvision } = require(HOOK);
  const spawnCalls = [];
  const spawnFn = () => { spawnCalls.push(1); return { unref() {} }; };

  // render fired → never provision (invariant #5)
  assert.strictEqual(maybeAutoProvision({ render: { status: 'fired', browserAvailable: true } }, { env: {}, spawnFn }), null);
  // M-01: capture failed on a WORKING browser (setupRequired absent) → no provision, no false notice
  assert.strictEqual(maybeAutoProvision({ render: { status: 'failed-safely', browserAvailable: true } }, { env: {}, spawnFn }), null);
  // H-01: fail-closed grade on a broken tmpdir emits a 'skipped' render with no setupRequired → no respawn
  assert.strictEqual(maybeAutoProvision({ render: { status: 'skipped', browserAvailable: null } }, { env: {}, spawnFn }), null);
  // shoot.js unavailable is likewise not a missing-browser signal
  assert.strictEqual(maybeAutoProvision({ render: { status: 'skipped', reason: 'shoot.js is unavailable' } }, { env: {}, spawnFn }), null);
  assert.strictEqual(spawnCalls.length, 0, 'no provisioner may be spawned for non-setupRequired renders');

  // opt-out still short-circuits even when the browser IS genuinely missing, and does not spawn
  const optOut = maybeAutoProvision(
    { render: { status: 'skipped-no-browser', setupRequired: true } },
    { env: { VISIGNER_NO_AUTO_BROWSER: '1' }, spawnFn },
  );
  assert.deepStrictEqual(optOut, { status: 'disabled' });
  assert.strictEqual(spawnCalls.length, 0, 'opt-out must not spawn a provisioner');
});
