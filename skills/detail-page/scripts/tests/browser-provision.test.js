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
  SETUP_SOURCE,
  extractInstallTemplate,
  guidedProvisioning,
  runConsentedInstall,
} = require(path.join(ROOT, 'hooks', 'browser-provision.js'));

const EXPECTED_TEMPLATE = 'cd "${CLAUDE_PLUGIN_ROOT}/skills/detail-page" && npm install && npx patchright install chromium';
const EXPECTED_COMMAND = `cd '${path.join(ROOT, 'skills', 'detail-page')}' && npm install && npx patchright install chromium`;

function invokeHook(artifact) {
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
    env: {
      ...process.env,
      VISIGNER_FORCE_BROWSER_MISSING: '1',
      VISIGNER_NO_AUTO_BROWSER: '1',
    },
  });
}

test('guided install command is derived from design-setup.md without executing it', () => {
  let installerCalled = false;
  const guide = guidedProvisioning(ROOT);
  const consentGuard = runConsentedInstall({
    consent: false,
    pluginRoot: ROOT,
    installer: () => {
      installerCalled = true;
      throw new Error('must not run without consent');
    },
  });

  assert.strictEqual(extractInstallTemplate(), EXPECTED_TEMPLATE);
  assert.strictEqual(guide.installTemplate, EXPECTED_TEMPLATE);
  assert.strictEqual(guide.installCommand, EXPECTED_COMMAND);
  assert.strictEqual(guide.source, SETUP_SOURCE);
  assert.strictEqual(guide.consentRequired, true);
  assert.strictEqual(guide.installExecuted, false);
  assert.strictEqual(consentGuard.status, 'consent-required');
  assert.strictEqual(consentGuard.installExecuted, false);
  assert.strictEqual(installerCalled, false);
});

test('forced no-browser hook surfaces one-tap setup while static grade still runs', () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-guided-browser-'));
  const artifact = path.join(fixtureDir, 'guided-design.html');
  fs.writeFileSync(artifact, '<!doctype html><html><body><main><h1>Guided design artifact</h1></main></body></html>');
  let reportDir;
  try {
    const child = invokeHook(artifact);
    assert.strictEqual(child.status, 0, child.stderr);
    assert.strictEqual(child.stderr, '');
    const payload = JSON.parse(child.stdout);
    const context = payload.hookSpecificOutput.additionalContext;

    assert.match(payload.systemMessage, /ONE-TAP GUIDED BROWSER SETUP \(consent required; not auto-run\)/);
    assert.ok(payload.systemMessage.includes(EXPECTED_COMMAND));
    assert.match(context, /^guidedInstallStatus:\s*available$/mi);
    assert.ok(context.includes(`guidedInstallCommand: ${EXPECTED_COMMAND}`));
    assert.match(context, /^guidedInstallSource:\s*commands\/design-setup\.md:22-24$/mi);
    assert.match(context, /^guidedInstallConsentRequired:\s*true$/mi);
    assert.match(context, /^guidedInstallExecuted:\s*false$/mi);
    assert.match(context, /^staticGradeStatus:\s*emitted$/mi);
    assert.match(context, /^verdict:\s*(clean|suspect|ai-likely)$/mi);
    assert.match(context, /^render:\s*skipped-no-browser/mi);

    const reportPath = context.match(/^staticReport:\s*(.+)$/mi)[1].trim();
    reportDir = path.dirname(reportPath);
    assert.ok(fs.existsSync(reportPath));
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    if (reportDir) fs.rmSync(reportDir, { recursive: true, force: true });
  }
});

test('mocked permission failure is loud and preserves the manual fallback command', () => {
  const result = runConsentedInstall({
    consent: true,
    pluginRoot: ROOT,
    installer: () => ({
      status: 13,
      stdout: '',
      stderr: 'EACCES: permission denied writing node_modules',
    }),
  });

  assert.strictEqual(result.status, 'install-failed');
  assert.strictEqual(result.installExecuted, true);
  assert.match(result.error, /EACCES: permission denied/);
  assert.match(result.loudMessage, /^BROWSER SETUP FAILED —/);
  assert.match(result.loudMessage, /Do not use sudo/);
  assert.ok(result.loudMessage.includes(`Manual fallback: ${EXPECTED_COMMAND}`));
  assert.strictEqual(result.systemMessage, result.loudMessage);
  assert.match(result.additionalContext, /^guidedInstallStatus:\s*install-failed$/mi);
  assert.match(result.additionalContext, /^guidedInstallError:\s*EACCES: permission denied/mi);
  assert.ok(result.additionalContext.includes(`guidedInstallManualFallback: ${EXPECTED_COMMAND}`));
  assert.strictEqual(result.manualFallbackCommand, EXPECTED_COMMAND);
});
