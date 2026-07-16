'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const HOOK = path.join(ROOT, 'hooks', 'auto-critique-hook.js');

function invokeHook(event, extraEnv = {}) {
  return spawnSync(process.execPath, [HOOK], {
    cwd: ROOT,
    input: JSON.stringify(event),
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
    env: {
      ...process.env,
      VISIGNER_NO_AUTO_BROWSER: '1',
      ...extraEnv,
    },
  });
}

test('forced no-browser design event emits a real static grade and loud setup notice', () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-no-browser-test-'));
  const artifact = path.join(fixtureDir, 'produced-design.html');
  fs.writeFileSync(artifact, '<!doctype html><html><body><main><h1>Design artifact</h1></main></body></html>');

  let reportDir;
  try {
    const child = invokeHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      cwd: ROOT,
      tool_input: { file_path: artifact },
      tool_response: { success: true },
    }, { VISIGNER_FORCE_BROWSER_MISSING: '1' });

    assert.strictEqual(child.status, 0, child.stderr);
    assert.strictEqual(child.stderr, '');
    const output = JSON.parse(child.stdout);
    assert.strictEqual(output.hookSpecificOutput.hookEventName, 'PostToolUse');

    const systemMessage = output.systemMessage;
    const context = output.hookSpecificOutput.additionalContext;
    for (const channel of [systemMessage, context]) {
      assert.match(channel, /pixel critique is off/i);
      assert.match(channel, /\/design-setup/i);
      assert.match(channel, /verdict:\s*(clean|suspect|ai-likely)/i);
    }
    assert.match(context, /staticGradeStatus: emitted/i);
    assert.match(context, /render: skipped-no-browser/i);
    assert.match(context, /designCriticHandoff: static-only/i);
    assert.doesNotMatch(context, /captureTiles:/i);
    assert.doesNotMatch(context, /designCriticHandoff: ready/i);

    const verdict = context.match(/verdict:\s*(clean|suspect|ai-likely)/i)[1].toLowerCase();
    const reportPath = context.match(/^staticReport:\s*(.+)$/mi)[1].trim();
    reportDir = path.dirname(reportPath);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.strictEqual(report.verdict, verdict);
    assert.strictEqual(typeof report.s2Pass, 'boolean');
    assert.ok(Number.isFinite(Number(report.mechanicalScore.score)));
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    if (reportDir) fs.rmSync(reportDir, { recursive: true, force: true });
  }
});

test('non-HTML Write, HTML Read, and plain-turn controls remain silent', () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-no-browser-control-'));
  const textArtifact = path.join(fixtureDir, 'notes.txt');
  fs.writeFileSync(textArtifact, 'plain notes');
  try {
    const nonHtml = invokeHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      cwd: ROOT,
      tool_input: { file_path: textArtifact },
      tool_response: { success: true },
    }, { VISIGNER_FORCE_BROWSER_MISSING: '1' });
    assert.strictEqual(nonHtml.status, 0, nonHtml.stderr);
    assert.strictEqual(nonHtml.stdout, '');
    assert.strictEqual(nonHtml.stderr, '');

    const htmlRead = invokeHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Read',
      cwd: ROOT,
      tool_input: { file_path: path.join(ROOT, 'docs', 'index.html') },
      tool_response: { success: true },
    }, { VISIGNER_FORCE_BROWSER_MISSING: '1' });
    assert.strictEqual(htmlRead.status, 0, htmlRead.stderr);
    assert.strictEqual(htmlRead.stdout, '');
    assert.strictEqual(htmlRead.stderr, '');

    const plainTurn = invokeHook({
      hook_event_name: 'UserPromptSubmit',
      cwd: ROOT,
      prompt: 'Explain a non-design concept.',
    }, { VISIGNER_FORCE_BROWSER_MISSING: '1' });
    assert.strictEqual(plainTurn.status, 0, plainTurn.stderr);
    assert.strictEqual(plainTurn.stdout, '');
    assert.strictEqual(plainTurn.stderr, '');
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});
