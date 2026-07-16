'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const HOOK = path.join(ROOT, 'hooks', 'auto-critique-hook.js');
const FIXTURES = path.join(__dirname, 'fixtures');

function isolatedEnv(home) {
  const env = {
    ...process.env,
    HOME: home,
    CODEX_HOME: path.join(home, '.codex'),
    VISIGNER_FORCE_BROWSER_MISSING: '1',
  };
  for (const key of ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'IMG_PROVIDER', 'OPENAI_RESPONSES_AUTH']) delete env[key];
  return env;
}

function invokeHook(event, env) {
  return spawnSync(process.execPath, [HOOK], {
    cwd: ROOT,
    input: JSON.stringify(event),
    encoding: 'utf8',
    timeout: 45_000,
    maxBuffer: 12 * 1024 * 1024,
    env,
  });
}

function writeEvent(page) {
  return {
    hook_event_name: 'PostToolUse',
    tool_name: 'Write',
    cwd: ROOT,
    tool_input: { file_path: page },
    tool_response: { success: true },
  };
}

function cleanupGradeReport(context) {
  const match = String(context || '').match(/^staticReport:\s*(.+)$/mi);
  if (!match || match[1].trim() === 'unavailable') return;
  const reportDir = path.dirname(match[1].trim());
  if (path.basename(reportDir).startsWith('visigner-auto-grade-')) {
    fs.rmSync(reportDir, { recursive: true, force: true });
  }
}

test('real hook emits the human-gate STOP for manifest and manifest-free referenced-SVG gaps', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-g36-gap-'));
  const cases = [
    {
      page: path.join(FIXTURES, 'g3-f1-external-svg', 'index.html'),
      imageText: /5 image spots still show stand-ins/i,
      manifest: path.join(FIXTURES, 'g3-f1-external-svg', 'assets', 'manifest.json'),
    },
    {
      page: path.join(FIXTURES, 'g3-placeholder-no-manifest', 'index.html'),
      imageText: /1 image spot still shows a stand-in/i,
      manifest: null,
    },
  ];

  try {
    for (const item of cases) {
      const child = invokeHook(writeEvent(item.page), isolatedEnv(home));
      assert.strictEqual(child.status, 0, child.stderr);
      assert.strictEqual(child.stderr, '');
      const output = JSON.parse(child.stdout);
      const systemMessage = output.systemMessage;
      const context = output.hookSpecificOutput.additionalContext;

      for (const channel of [systemMessage, context]) {
        assert.match(channel, /STOP — this draft is not ready to ship/i);
        assert.match(channel, item.imageText);
      }
      assert.match(context, /HUMAN-GATE CHECKLIST/);
      assert.match(context, /humanGateStatus: STOP/);
      assert.match(context, /humanGateReferencedSvgScan: active/);
      assert.match(context, /verdict:\s*(clean|suspect|ai-likely)/i);
      if (item.manifest) {
        assert.ok(context.includes(`humanGateManifest: ${item.manifest}`));
      } else {
        assert.match(context, /^humanGateManifest: none$/m);
      }
      cleanupGradeReport(context);
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('real hook grades a clean complete draft without emitting a human-gate checklist', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-g36-clean-'));
  try {
    const page = path.join(ROOT, 'docs', 'index.html');
    const child = invokeHook(writeEvent(page), isolatedEnv(home));
    assert.strictEqual(child.status, 0, child.stderr);
    assert.strictEqual(child.stderr, '');
    const output = JSON.parse(child.stdout);
    const systemMessage = output.systemMessage;
    const context = output.hookSpecificOutput.additionalContext;

    assert.match(systemMessage, /STATIC GRADE EMITTED/i);
    assert.match(context, /staticGradeStatus: emitted/i);
    assert.match(context, /verdict:\s*clean/i);
    assert.doesNotMatch(systemMessage, /STOP — this draft|HUMAN-GATE CHECKLIST/i);
    assert.doesNotMatch(context, /STOP — this draft|HUMAN-GATE CHECKLIST|humanGateStatus:/i);
    cleanupGradeReport(context);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('non-design Write and Read events still produce zero hook output', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-g36-control-'));
  const markdown = path.join(home, 'notes.md');
  fs.writeFileSync(markdown, '# Notes\n');
  const events = [
    writeEvent(markdown),
    {
      hook_event_name: 'PostToolUse',
      tool_name: 'Read',
      cwd: ROOT,
      tool_input: { file_path: path.join(ROOT, 'docs', 'index.html') },
      tool_response: { success: true },
    },
  ];

  try {
    for (const event of events) {
      const child = invokeHook(event, isolatedEnv(home));
      assert.strictEqual(child.status, 0, child.stderr);
      assert.strictEqual(child.stdout, '');
      assert.strictEqual(child.stderr, '');
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
