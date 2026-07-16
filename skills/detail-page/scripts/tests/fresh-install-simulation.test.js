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
  planBrowserProvisioning,
} = require(path.join(ROOT, 'hooks', 'browser-provision.js'));

const PIXEL_OFF = 'PIXEL CRITIQUE IS OFF — run /design-setup to enable full visual critique.';

test('fresh checkout first HTML write is loud, guided, and statically graded', async () => {
  let nodeModulesProbeCalls = 0;
  const nodeModulesPresentProbe = async () => {
    nodeModulesProbeCalls += 1;
    return false;
  };
  const nodeModulesPresent = await nodeModulesPresentProbe();
  const provisioningPlan = await planBrowserProvisioning({
    pluginRoot: ROOT,
    availabilityProbe: async () => ({
      available: false,
      reasonCode: 'runtime-unresolvable',
      reason: 'mocked clean checkout has no browser runtime in node_modules',
    }),
    browserCacheProbe: async () => ({
      present: false,
      rootsChecked: ['/mock/empty-os-browser-cache'],
    }),
  });

  assert.strictEqual(nodeModulesPresent, false);
  assert.strictEqual(nodeModulesProbeCalls, 1);
  assert.strictEqual(provisioningPlan.status, 'full-guided-install-required');
  assert.strictEqual(provisioningPlan.nodeModulesRestoreNeeded, true);
  assert.strictEqual(provisioningPlan.chromiumDownloadNeeded, true);
  assert.strictEqual(provisioningPlan.installExecuted, false);

  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-fresh-install-'));
  const artifact = path.join(fixtureDir, 'first-design.html');
  fs.writeFileSync(artifact, '<!doctype html><html><body><main><h1>First design</h1><p>A clean-checkout static-grade fixture.</p></main></body></html>');
  let reportDir;
  try {
    const child = spawnSync(process.execPath, [HOOK], {
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
        VISIGNER_SIMULATE_NODE_MODULES_ABSENT: '1',
      },
    });

    assert.strictEqual(child.status, 0, child.stderr);
    assert.strictEqual(child.stderr, '');
    assert.ok(child.stdout.length > 0, 'fresh-install hook output must never be silent');
    const payload = JSON.parse(child.stdout);
    const context = payload.hookSpecificOutput.additionalContext;
    const guide = guidedProvisioning(ROOT);

    assert.ok(payload.systemMessage.includes(PIXEL_OFF));
    assert.match(payload.systemMessage, /ONE-TAP GUIDED BROWSER SETUP \(consent required; not auto-run\):/);
    assert.ok(payload.systemMessage.includes(guide.installCommand));
    assert.match(payload.systemMessage, /STATIC GRADE EMITTED — verdict: (clean|suspect|ai-likely)/);
    assert.ok(context.includes(PIXEL_OFF));
    assert.match(context, /^guidedInstallStatus:\s*available$/mi);
    assert.ok(context.includes(`guidedInstallCommand: ${guide.installCommand}`));
    assert.match(context, /^guidedInstallConsentRequired:\s*true$/mi);
    assert.match(context, /^guidedInstallExecuted:\s*false$/mi);
    assert.match(context, /^staticGradeStatus:\s*emitted$/mi);
    assert.match(context, /^verdict:\s*(clean|suspect|ai-likely)$/mi);
    assert.match(context, /^mechanicalScore:\s*\d+\/(?:A|B|C|D|F)$/mi);
    assert.match(context, /^render:\s*skipped-no-browser/mi);

    const verdict = context.match(/^verdict:\s*(clean|suspect|ai-likely)$/mi)[1];
    const reportPath = context.match(/^staticReport:\s*(.+)$/mi)[1].trim();
    reportDir = path.dirname(reportPath);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.strictEqual(report.verdict, verdict);

    console.log('FRESH-INSTALL SIMULATION (not owner live-fire): nodeModulesPresent=false; browserAvailable=false; browserCachePresent=false');
    console.log(`FRESH-INSTALL PLAN: ${provisioningPlan.status}; chromiumDownloadNeeded=${provisioningPlan.chromiumDownloadNeeded}; installExecuted=${provisioningPlan.installExecuted}`);
    console.log(`LOUD PIXEL-OFF: ${PIXEL_OFF}`);
    console.log(`GUIDED INSTALL AFFORDANCE: ONE-TAP GUIDED BROWSER SETUP (consent required; not auto-run): ${guide.installCommand}`);
    console.log(`STATIC GRADE STILL EMITTED: verdict=${verdict}; reportExists=${fs.existsSync(reportPath)}`);
    console.log('HARNESS SCOPE: simulation with mocks/env only; this does not claim Claude Code live hook-runner dispatch (G2.1b owner live-fire)');
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    if (reportDir) fs.rmSync(reportDir, { recursive: true, force: true });
  }
});
