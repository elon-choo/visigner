#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

try {
  const stateDir = path.join(os.tmpdir(), 'visigner-autoprovision');
  const lockFile = path.join(stateDir, 'lock');
  fs.mkdirSync(stateDir, { recursive: true });
  const handle = fs.openSync(lockFile, 'wx');
  fs.writeFileSync(handle, JSON.stringify({
    state: 'running',
    pid: process.pid,
    startedAt: new Date().toISOString(),
  }));
  fs.closeSync(handle);
  if (process.env.VISIGNER_AUTO_PROVISION_RECORD) {
    fs.appendFileSync(process.env.VISIGNER_AUTO_PROVISION_RECORD, `${process.pid}\n`);
  }
} catch (_) {}

process.exitCode = 0;
