'use strict';

const assert = require('assert');
const path = require('path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const {
  runIdempotentProvisioning,
} = require(path.join(ROOT, 'hooks', 'browser-provision.js'));

const DETAIL_PAGE = path.join(ROOT, 'skills', 'detail-page');
const RESTORE_COMMAND = `cd '${DETAIL_PAGE}' && npm install`;
const FULL_COMMAND = `${RESTORE_COMMAND} && npx patchright install chromium`;

test('already-usable browser makes repeat provisioning an idempotent no-op', async () => {
  let availabilityProbeCalls = 0;
  let cacheProbeCalls = 0;
  let installerCalls = 0;
  const options = {
    consent: true,
    pluginRoot: ROOT,
    availabilityProbe: async () => {
      availabilityProbeCalls += 1;
      return { available: true, provider: 'patchright', candidate: 'bundled-chromium' };
    },
    browserCacheProbe: async () => {
      cacheProbeCalls += 1;
      return { present: true };
    },
    installer: () => {
      installerCalls += 1;
      return { status: 0 };
    },
  };
  const first = await runIdempotentProvisioning(options);
  const result = await runIdempotentProvisioning(options);

  assert.strictEqual(first.status, 'already-provisioned');
  assert.strictEqual(result.status, 'already-provisioned');
  assert.strictEqual(result.message, 'already-provisioned, nothing to do');
  assert.strictEqual(result.action, 'none');
  assert.strictEqual(result.chromiumDownloadNeeded, false);
  assert.strictEqual(result.nodeModulesRestoreNeeded, false);
  assert.strictEqual(result.installExecuted, false);
  assert.strictEqual(availabilityProbeCalls, 2);
  assert.strictEqual(cacheProbeCalls, 0);
  assert.strictEqual(installerCalls, 0);
});

test('plugin update restores node_modules while retaining cached Chromium without download', async () => {
  const availabilityStates = [
    { available: false, reasonCode: 'runtime-unresolvable' },
    { available: true, provider: 'patchright', candidate: 'bundled-chromium' },
  ];
  const installerCommands = [];
  const result = await runIdempotentProvisioning({
    consent: true,
    pluginRoot: ROOT,
    availabilityProbe: async () => availabilityStates.shift(),
    browserCacheProbe: async () => ({
      present: true,
      cacheRoot: '/mock/os-cache/ms-playwright',
      executablePath: '/mock/os-cache/ms-playwright/chromium/chrome',
    }),
    installer: (command) => {
      installerCommands.push(command);
      return { status: 0, stdout: 'mock npm restore complete' };
    },
  });

  assert.strictEqual(result.status, 'restored-from-browser-cache');
  assert.strictEqual(result.action, 'restore-node-modules');
  assert.strictEqual(result.installCommand, RESTORE_COMMAND);
  assert.deepStrictEqual(installerCommands, [RESTORE_COMMAND]);
  assert.ok(!installerCommands[0].includes('patchright install chromium'));
  assert.strictEqual(result.nodeModulesRestoreNeeded, true);
  assert.strictEqual(result.nodeModulesRestoreExecuted, true);
  assert.strictEqual(result.chromiumDownloadNeeded, false);
  assert.strictEqual(result.chromiumDownloadExecuted, false);
  assert.strictEqual(result.availabilityAfter.available, true);
});

test('missing runtime and missing browser cache use the full consented guided install', async () => {
  const availabilityStates = [
    { available: false, reasonCode: 'runtime-unresolvable' },
    { available: true, provider: 'patchright', candidate: 'bundled-chromium' },
  ];
  const installerCommands = [];
  const result = await runIdempotentProvisioning({
    consent: true,
    pluginRoot: ROOT,
    availabilityProbe: async () => availabilityStates.shift(),
    browserCacheProbe: async () => ({ present: false, rootsChecked: ['/mock/os-cache/ms-playwright'] }),
    installer: (command) => {
      installerCommands.push(command);
      return { status: 0, stdout: 'mock npm restore and Chromium download complete' };
    },
  });

  assert.strictEqual(result.status, 'installed-full');
  assert.strictEqual(result.action, 'restore-node-modules-and-download-chromium');
  assert.strictEqual(result.installCommand, FULL_COMMAND);
  assert.deepStrictEqual(installerCommands, [FULL_COMMAND]);
  assert.strictEqual(result.nodeModulesRestoreNeeded, true);
  assert.strictEqual(result.chromiumDownloadNeeded, true);
  assert.strictEqual(result.chromiumDownloadExecuted, true);
  assert.strictEqual(result.availabilityAfter.available, true);
});
