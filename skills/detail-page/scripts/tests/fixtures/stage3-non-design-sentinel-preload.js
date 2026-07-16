'use strict';

const fs = require('fs');
const Module = require('module');
const childProcess = require('child_process');

const sentinel = process.env.VISIGNER_STAGE3_NON_DESIGN_SENTINEL;
const append = fs.appendFileSync.bind(fs);

function record(kind, value) {
  if (!sentinel) return;
  append(sentinel, JSON.stringify({ kind, value: String(value) }) + '\n');
}

const originalLoad = Module._load;
Module._load = function monitoredLoad(request, parent, isMain) {
  if (/(?:human-gate|cred-detect|asset-gap-surfacer)(?:\/|\.js|$)/.test(String(request))) {
    record('stage3-module-load', request);
  }
  return originalLoad.call(this, request, parent, isMain);
};

for (const name of ['spawn', 'spawnSync', 'exec', 'execSync']) {
  const original = childProcess[name];
  childProcess[name] = function monitoredChildProcess(command, args, options) {
    record('child-process', [command, ...(Array.isArray(args) ? args : [])].join(' '));
    return original.call(this, command, args, options);
  };
}
