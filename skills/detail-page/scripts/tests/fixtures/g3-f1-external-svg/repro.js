#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const fixture = __dirname;
const root = path.resolve(fixture, '..', '..', '..', '..', '..', '..');
const page = path.join(fixture, 'index.html');
const hook = path.join(root, 'hooks', 'auto-critique-hook.js');
const runner = path.join(root, 'hooks', 'auto-grade-runner.js');
const html = fs.readFileSync(page, 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(fixture, 'assets', 'manifest.json'), 'utf8'));
const referenced = [...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+\.svg)["'][^>]*>/gi)]
  .map((match) => path.join(fixture, match[1]));
const markerCounts = referenced.map((file) => {
  const svg = fs.readFileSync(file, 'utf8');
  return {
    aria: /role="img"\s+aria-label="[^"]* placeholder/i.test(svg),
    footer: /·\s+placeholder/i.test(svg),
  };
});

console.log('F1 FIXTURE: fabricated metrics=97.4%,99.8%,12,480,4.9/5,2.8L,4,200L; referencedSvgCount=' + referenced.length);
console.log('F1 HTML TEXT SCAN placeholder hits: ' + (html.match(/placeholder/gi) || []).length);
console.log('F1 EXTERNAL SVG SELF-MARKERS: aria=' + markerCounts.filter((item) => item.aria).length + '/' + referenced.length + '; footer=' + markerCounts.filter((item) => item.footer).length + '/' + referenced.length);
console.log('F1 MANIFEST PLACEHOLDER FLAGS: ' + manifest.slots.filter((slot) => slot.placeholder === true).length + '/' + manifest.slots.length);

const env = { ...process.env, VISIGNER_FORCE_BROWSER_MISSING: '1' };
let runnerWorkDir;
let hookWorkDir;
try {
  const runnerChild = spawnSync(process.execPath, [runner, page], {
    cwd: root,
    env,
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (runnerChild.status !== 0) throw new Error(runnerChild.stderr || 'runner failed');
  const run = JSON.parse(runnerChild.stdout);
  runnerWorkDir = run.workDir;
  console.log('F1 REAL RUNNER STATIC: verdict=' + run.staticGrade.verdict + '; s2Pass=' + run.staticGrade.s2Pass + '; mechanicalScore=' + run.staticGrade.mechanicalScore.score + '/' + run.staticGrade.mechanicalScore.letter + '; tellsDetected=' + run.staticGrade.tellsDetected.length);
  console.log('F1 TASTE METRICS: sections=' + run.tasteMetrics.sections + '; substantiveBlocks=' + run.tasteMetrics.substantiveBlocks + '; meaningfulMedia=' + run.tasteMetrics.meaningfulMedia + '; evidenceUnits=' + run.tasteMetrics.evidenceUnits + '; placeholderHits=' + run.tasteMetrics.placeholderHits + '; emptyVisualShells=' + run.tasteMetrics.emptyVisualShells);
  console.log('F1 REAL RUNNER GATE: machinePassed=' + run.machinePassed + '; tasteSuspect=' + run.tasteSuspect + '; humanGateRequired=' + run.humanGateRequired + '; tasteSignals=' + (run.tasteSignals.length ? run.tasteSignals.join(',') : 'none'));

  const event = {
    hook_event_name: 'PostToolUse',
    tool_name: 'Write',
    cwd: root,
    tool_input: { file_path: page },
    tool_response: { success: true },
  };
  const hookChild = spawnSync(process.execPath, [hook], {
    cwd: root,
    env,
    input: JSON.stringify(event),
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (hookChild.status !== 0) throw new Error(hookChild.stderr || 'hook failed');
  const payload = JSON.parse(hookChild.stdout);
  const context = payload.hookSpecificOutput.additionalContext;
  const reportPath = context.match(/^staticReport:\s*(.+)$/mi)[1].trim();
  hookWorkDir = path.dirname(reportPath);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const checklistHits = (payload.systemMessage + '\n' + context)
    .match(/HUMAN TASTE REVIEW REQUIRED|human[- ]gate checklist|checklist:/gi) || [];
  console.log('F1 REAL HOOK SYSTEM MESSAGE: ' + payload.systemMessage);
  console.log('F1 REAL HOOK CONTEXT:\n' + context);
  console.log('F1 LIVE EVALUATOR PRESENCE: expected=' + report.presence.expected.length + '; found=' + report.presence.found.length + '; missing=' + report.presence.missing.length + '; weakOnlyCount=' + report.presence.weakOnlyCount);
  console.log('F1 CONSOLIDATED HUMAN-GATE CHECKLIST: ' + (checklistHits.length === 0 ? 'ABSENT' : 'PRESENT') + '; checklistHits=' + checklistHits.length);
  console.log('F1 SILENT PLACEHOLDER SHIP GAP: REPRODUCED');
} finally {
  if (runnerWorkDir) fs.rmSync(runnerWorkDir, { recursive: true, force: true });
  if (hookWorkDir) fs.rmSync(hookWorkDir, { recursive: true, force: true });
}
