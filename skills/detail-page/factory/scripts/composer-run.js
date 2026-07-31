#!/usr/bin/env node
'use strict';

/* G4.2 orchestration: invokes the explicit selection stage, then the pure assembly stage. */

const path = require('path');
const { spawnSync } = require('child_process');

const V3_ROOT = path.resolve(__dirname, '..');
const COMPOSER_ROOT = path.join(V3_ROOT, 'composer');

function fail(message) {
  throw new Error(`composer-run: ${message}`);
}

function isDirectRunDirectory(runDirectory) {
  const relative = path.relative(COMPOSER_ROOT, runDirectory);
  return relative !== ''
    && !relative.startsWith(`..${path.sep}`)
    && relative !== '..'
    && !path.isAbsolute(relative)
    && relative.split(path.sep).length === 1;
}

function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' });
  if (result.error) fail(`cannot run ${path.basename(script)}: ${result.error.message}`);
  if (result.status !== 0) process.exitCode = result.status || 1;
  return result.status === 0;
}

function main(args) {
  if (args.length !== 2) {
    fail('usage: node v3/scripts/composer-run.js <brief.json> <v3/composer/<run>>');
  }
  const briefFile = path.resolve(args[0]);
  const runDirectory = path.resolve(args[1]);
  if (!isDirectRunDirectory(runDirectory)) fail('run directory must be v3/composer/<run>');
  const selectionFile = path.join(runDirectory, 'selection.json');
  const pageFile = path.join(runDirectory, 'page.html');
  if (!run(path.join(__dirname, 'composer-select.js'), [briefFile, selectionFile])) return;
  run(path.join(__dirname, 'composer-assemble.js'), [selectionFile, pageFile]);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
