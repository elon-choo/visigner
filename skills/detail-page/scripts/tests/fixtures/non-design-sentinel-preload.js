'use strict';

const fs = require('fs');
const Module = require('module');
const childProcess = require('child_process');

const sentinel = process.env.VISIGNER_NON_DESIGN_SENTINEL;

function record(kind, value) {
  if (!sentinel) return;
  fs.appendFileSync(sentinel, JSON.stringify({ kind, value: String(value) }) + '\n');
}

const originalLoad = Module._load;
Module._load = function monitoredLoad(request, parent, isMain) {
  if (/(?:browser-provision|cred-detect|design-doctor)(?:\.js)?$/.test(String(request))) {
    record('provisioning-module-load', request);
  }
  return originalLoad.call(this, request, parent, isMain);
};

const originalSpawnSync = childProcess.spawnSync;
childProcess.spawnSync = function monitoredSpawnSync(command, args, options) {
  record('child-spawn', [command, ...(Array.isArray(args) ? args : [])].join(' '));
  return originalSpawnSync.call(this, command, args, options);
};
