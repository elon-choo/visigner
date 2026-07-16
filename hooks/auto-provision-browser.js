#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { runIdempotentProvisioning } = require('./browser-provision.js');

const LOCK_MAX_AGE_MS = 15 * 60 * 1000;
const DEFAULT_STATE_DIR = path.join(os.tmpdir(), 'visigner-autoprovision');

function provisioningPaths(stateDir = DEFAULT_STATE_DIR) {
  return {
    stateDir,
    lockFile: path.join(stateDir, 'lock'),
    lastRunFile: path.join(stateDir, 'last-run.json'),
  };
}

function lockIsFresh(lockFile, {
  fsApi = fs,
  now = Date.now(),
  maxAgeMs = LOCK_MAX_AGE_MS,
} = {}) {
  try {
    return now - fsApi.statSync(lockFile).mtimeMs < maxAgeMs;
  } catch (_) {
    return false;
  }
}

function readLastRun(lastRunFile, fsApi = fs) {
  try {
    return JSON.parse(fsApi.readFileSync(lastRunFile, 'utf8'));
  } catch (_) {
    return null;
  }
}

function lastRunFailed(record) {
  const result = record && record.result;
  const status = result && typeof result.status === 'string' ? result.status : '';
  return /(?:failed|error)/i.test(status);
}

async function acquireLock(paths, {
  fsApi = fs,
  now = Date.now(),
  maxAgeMs = LOCK_MAX_AGE_MS,
} = {}) {
  await fsApi.promises.mkdir(paths.stateDir, { recursive: true });
  const token = `${process.pid}-${now}-${crypto.randomBytes(8).toString('hex')}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let handle;
    try {
      handle = await fsApi.promises.open(paths.lockFile, 'wx');
      await handle.writeFile(JSON.stringify({
        state: 'running',
        pid: process.pid,
        token,
        startedAt: new Date(now).toISOString(),
      }));
      await handle.close();
      return { acquired: true, token };
    } catch (error) {
      if (handle) {
        try { await handle.close(); } catch (_) {}
      }
      if (!error || error.code !== 'EEXIST') throw error;
      if (lockIsFresh(paths.lockFile, { fsApi, now, maxAgeMs })) {
        return { acquired: false, reason: 'fresh-lock' };
      }
      try {
        await fsApi.promises.unlink(paths.lockFile);
      } catch (unlinkError) {
        if (!unlinkError || unlinkError.code !== 'ENOENT') {
          return { acquired: false, reason: 'lock-takeover-lost' };
        }
      }
    }
  }
  return { acquired: false, reason: 'lock-takeover-lost' };
}

async function writeJson(file, value, fsApi = fs) {
  try {
    await fsApi.promises.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
    return true;
  } catch (_) {
    return false;
  }
}

async function updateOwnedLock(paths, token, result, {
  fsApi = fs,
  now = Date.now(),
} = {}) {
  try {
    const current = JSON.parse(await fsApi.promises.readFile(paths.lockFile, 'utf8'));
    if (!current || current.token !== token) return;
    await fsApi.promises.writeFile(paths.lockFile, JSON.stringify({
      state: 'completed',
      pid: process.pid,
      token,
      completedAt: new Date(now).toISOString(),
      status: result && result.status || 'unknown',
    }));
  } catch (_) {
    // The lock is advisory. Losing it must never make provisioning fail outward.
  }
}

async function runAutoProvisioning({
  stateDir = DEFAULT_STATE_DIR,
  fsApi = fs,
  now = Date.now,
  provision = runIdempotentProvisioning,
  provisioningOptions = {},
} = {}) {
  const paths = provisioningPaths(stateDir);
  let ownership = null;
  let result = null;

  try {
    ownership = await acquireLock(paths, { fsApi, now: now() });
    if (!ownership.acquired) return { status: ownership.reason || 'in-flight' };

    try {
      result = await provision({ ...provisioningOptions, consent: true });
    } catch (error) {
      result = {
        status: 'auto-provision-error',
        error: String(error && error.message || error || 'unknown provisioning error'),
      };
    }

    await writeJson(paths.lastRunFile, {
      timestamp: new Date(now()).toISOString(),
      result,
    }, fsApi);
    await updateOwnedLock(paths, ownership.token, result, { fsApi, now: now() });
    return result;
  } catch (error) {
    result = {
      status: 'auto-provision-error',
      error: String(error && error.message || error || 'unknown auto-provision error'),
    };
    try {
      await fsApi.promises.mkdir(paths.stateDir, { recursive: true });
      await writeJson(paths.lastRunFile, {
        timestamp: new Date(now()).toISOString(),
        result,
      }, fsApi);
    } catch (_) {}
    if (ownership && ownership.acquired) {
      await updateOwnedLock(paths, ownership.token, result, { fsApi, now: now() });
    }
    return result;
  }
}

async function main(options) {
  try {
    await runAutoProvisioning(options);
  } catch (_) {}
  return 0;
}

if (require.main === module) {
  main().then(
    (code) => { process.exitCode = code; },
    () => { process.exitCode = 0; },
  );
}

module.exports = {
  DEFAULT_STATE_DIR,
  LOCK_MAX_AGE_MS,
  lastRunFailed,
  lockIsFresh,
  main,
  provisioningPaths,
  readLastRun,
  runAutoProvisioning,
};
