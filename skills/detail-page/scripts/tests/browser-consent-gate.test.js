'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const HOOK = path.join(ROOT, 'hooks', 'auto-critique-hook.js');
const {
  guidedProvisioning,
  runConsentedInstall,
} = require(path.join(ROOT, 'hooks', 'browser-provision.js'));

const PIXEL_OFF = 'PIXEL CRITIQUE IS OFF — run /design-setup to enable full visual critique.';

function invokeNoBrowserHook(artifact) {
  return spawnSync(process.execPath, [HOOK], {
    cwd: ROOT,
    input: JSON.stringify({
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      cwd: ROOT,
      tool_input: { file_path: artifact },
      tool_response: { success: true },
    }),
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, VISIGNER_FORCE_BROWSER_MISSING: '1' },
  });
}

test('explicit consent invokes the mock installer and reports installed cleanly', () => {
  const machineState = { status: 'pristine', writes: 0 };
  let installerCalls = 0;
  const expectedCommand = guidedProvisioning(ROOT).installCommand;
  const result = runConsentedInstall({
    consent: true,
    pluginRoot: ROOT,
    installer: (command) => {
      installerCalls += 1;
      assert.strictEqual(command, expectedCommand);
      machineState.status = 'installed-by-mock';
      machineState.writes += 1;
      return { status: 0, stdout: 'mock install complete' };
    },
  });

  assert.strictEqual(result.status, 'installed');
  assert.strictEqual(result.installExecuted, true);
  assert.strictEqual(result.consentRequired, true);
  assert.strictEqual(installerCalls, 1);
  assert.deepStrictEqual(machineState, { status: 'installed-by-mock', writes: 1 });
  console.log('CONSENTED PATH: status=' + result.status + '; consent=true; installer-calls=' + installerCalls + '; installExecuted=' + result.installExecuted + '; installer=mock');
});

test('absent or declined consent invokes no installer, remains loud/static, then consents cleanly', () => {
  const machineState = { status: 'pristine', writes: 0 };
  let installerCalls = 0;
  const installer = () => {
    installerCalls += 1;
    machineState.status = 'installed-by-mock';
    machineState.writes += 1;
    return { status: 0, stdout: 'mock install complete' };
  };

  const absent = runConsentedInstall({ pluginRoot: ROOT, installer });
  const declined = runConsentedInstall({ consent: false, pluginRoot: ROOT, installer });
  assert.strictEqual(absent.status, 'consent-required');
  assert.strictEqual(declined.status, 'consent-required');
  assert.strictEqual(absent.installExecuted, false);
  assert.strictEqual(declined.installExecuted, false);
  assert.strictEqual(installerCalls, 0);
  assert.deepStrictEqual(machineState, { status: 'pristine', writes: 0 });

  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-consent-declined-'));
  const artifact = path.join(fixtureDir, 'declined-design.html');
  fs.writeFileSync(artifact, '<!doctype html><html><body><main><h1>Declined setup</h1><p>Static grading must continue without browser installation.</p></main></body></html>');
  let reportDir;
  try {
    const child = invokeNoBrowserHook(artifact);
    assert.strictEqual(child.status, 0, child.stderr);
    assert.strictEqual(child.stderr, '');
    assert.ok(child.stdout.length > 0);
    const payload = JSON.parse(child.stdout);
    const context = payload.hookSpecificOutput.additionalContext;
    const guide = guidedProvisioning(ROOT);
    assert.ok(payload.systemMessage.includes(PIXEL_OFF));
    assert.match(payload.systemMessage, /ONE-TAP GUIDED BROWSER SETUP \(consent required; not auto-run\):/);
    assert.ok(payload.systemMessage.includes(guide.installCommand));
    assert.match(context, /^guidedInstallConsentRequired:\s*true$/mi);
    assert.match(context, /^guidedInstallExecuted:\s*false$/mi);
    assert.match(context, /^staticGradeStatus:\s*emitted$/mi);
    assert.match(context, /^verdict:\s*(clean|suspect|ai-likely)$/mi);
    assert.match(context, /^render:\s*skipped-no-browser/mi);
    const verdict = context.match(/^verdict:\s*(clean|suspect|ai-likely)$/mi)[1];
    const reportPath = context.match(/^staticReport:\s*(.+)$/mi)[1].trim();
    reportDir = path.dirname(reportPath);
    assert.ok(fs.existsSync(reportPath));
    assert.strictEqual(JSON.parse(fs.readFileSync(reportPath, 'utf8')).verdict, verdict);

    assert.strictEqual(installerCalls, 0);
    assert.deepStrictEqual(machineState, { status: 'pristine', writes: 0 });
    console.log('DECLINED PATH: status=' + declined.status + '; installer-calls=' + installerCalls + '; machineState=' + machineState.status + '; writes=' + machineState.writes);
    console.log('DECLINED LOUD-DEGRADE: ' + PIXEL_OFF);
    console.log('DECLINED ONE-TAP AFFORDANCE: ' + guide.installCommand);
    console.log('DECLINED STATIC GRADE STILL RUNS: verdict=' + verdict + '; reportExists=' + fs.existsSync(reportPath));
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    if (reportDir) fs.rmSync(reportDir, { recursive: true, force: true });
  }

  const subsequentConsent = runConsentedInstall({ consent: true, pluginRoot: ROOT, installer });
  assert.strictEqual(subsequentConsent.status, 'installed');
  assert.strictEqual(installerCalls, 1);
  assert.deepStrictEqual(machineState, { status: 'installed-by-mock', writes: 1 });
  console.log('NO-PARTIAL-STATE RETRY: subsequent-consent=' + subsequentConsent.status + '; installer-calls=' + installerCalls + '; writes=' + machineState.writes);
});

test('consented EACCES failure is loud, leaves no partial state, and remains recoverable', () => {
  const machineState = { status: 'pristine', writes: 0 };
  let failingInstallerCalls = 0;
  const failingInstaller = () => {
    failingInstallerCalls += 1;
    throw new Error('EACCES: permission denied writing node_modules');
  };
  const failed = runConsentedInstall({ consent: true, pluginRoot: ROOT, installer: failingInstaller });

  assert.strictEqual(failed.status, 'install-failed');
  assert.strictEqual(failed.installExecuted, true);
  assert.strictEqual(failingInstallerCalls, 1);
  assert.match(failed.systemMessage, /^BROWSER SETUP FAILED —/);
  assert.match(failed.systemMessage, /EACCES: permission denied/);
  assert.match(failed.systemMessage, /Manual fallback:/);
  assert.ok(failed.systemMessage.includes(failed.manualFallbackCommand));
  assert.deepStrictEqual(machineState, { status: 'pristine', writes: 0 });

  const declinedAfterFailure = runConsentedInstall({
    consent: false,
    pluginRoot: ROOT,
    installer: failingInstaller,
  });
  assert.strictEqual(declinedAfterFailure.status, 'consent-required');
  assert.strictEqual(declinedAfterFailure.installExecuted, false);
  assert.strictEqual(failingInstallerCalls, 1);
  assert.ok(!Object.hasOwn(declinedAfterFailure, 'error'));
  assert.deepStrictEqual(machineState, { status: 'pristine', writes: 0 });

  let recoveryInstallerCalls = 0;
  const recovered = runConsentedInstall({
    consent: true,
    pluginRoot: ROOT,
    installer: () => {
      recoveryInstallerCalls += 1;
      machineState.status = 'installed-by-mock';
      machineState.writes = 1;
      return { status: 0, stdout: 'mock recovery install complete' };
    },
  });
  assert.strictEqual(recovered.status, 'installed');
  assert.strictEqual(recoveryInstallerCalls, 1);
  assert.deepStrictEqual(machineState, { status: 'installed-by-mock', writes: 1 });
  console.log('CONSENTED-FAILED PATH: status=' + failed.status + '; failing-installer-calls=' + failingInstallerCalls + '; loud="' + failed.systemMessage + '"');
  console.log('FAILED-THEN-DECLINED: status=' + declinedAfterFailure.status + '; failing-installer-calls=' + failingInstallerCalls + '; noPartialState=true');
  console.log('FAILED PATH RECOVERABLE: retry-status=' + recovered.status + '; recovery-installer-calls=' + recoveryInstallerCalls);
  console.log('⏸ HUMAN_GATE: real machine-touching install remains an owner runtime consent action; this test uses mocks only');
});
