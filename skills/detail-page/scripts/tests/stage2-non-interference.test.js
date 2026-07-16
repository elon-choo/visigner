'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const HOOK = path.join(ROOT, 'hooks', 'auto-critique-hook.js');
const PRELOAD = path.join(__dirname, 'fixtures', 'non-design-sentinel-preload.js');

test('Stage 2 spine and provisioning remain inert for every non-design event class', () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-stage2-no-fire-'));
  const sentinel = path.join(fixtureDir, 'provisioning-events.jsonl');
  const markdown = path.join(fixtureDir, 'notes.md');
  const html = path.join(fixtureDir, 'read-only.html');
  fs.writeFileSync(markdown, '# Ordinary non-design note\n');
  fs.writeFileSync(html, '<!doctype html><html><body><p>Read only.</p></body></html>');

  const cases = [
    {
      name: 'non-html-write',
      event: {
        hook_event_name: 'PostToolUse',
        tool_name: 'Write',
        cwd: ROOT,
        tool_input: { file_path: markdown },
        tool_response: { success: true },
      },
    },
    {
      name: 'html-read',
      event: {
        hook_event_name: 'PostToolUse',
        tool_name: 'Read',
        cwd: ROOT,
        tool_input: { file_path: html },
        tool_response: { success: true },
      },
    },
    {
      name: 'plain-turn',
      event: {
        hook_event_name: 'UserPromptSubmit',
        tool_name: 'UserPromptSubmit',
        cwd: ROOT,
        user_prompt: 'Explain a general programming concept without creating a design.',
      },
    },
  ];

  try {
    for (const item of cases) {
      const child = spawnSync(process.execPath, [HOOK], {
        cwd: ROOT,
        input: JSON.stringify(item.event),
        encoding: 'utf8',
        timeout: 10_000,
        maxBuffer: 2 * 1024 * 1024,
        env: {
          ...process.env,
          NODE_OPTIONS: '--require=' + PRELOAD,
          VISIGNER_NON_DESIGN_SENTINEL: sentinel,
        },
      });
      assert.strictEqual(child.status, 0, item.name + ': ' + child.stderr);
      assert.strictEqual(child.stdout, '', item.name + ' unexpectedly emitted grade/provisioning output');
      assert.strictEqual(child.stderr, '', item.name + ' unexpectedly emitted an error');
      console.log('NON-DESIGN NO-FIRE ' + item.name + ': stdoutBytes=0; stderrBytes=0; grade=0; provisioning=0; PASS');
    }

    const events = fs.existsSync(sentinel)
      ? fs.readFileSync(sentinel, 'utf8').trim().split(/\n/).filter(Boolean).map(JSON.parse)
      : [];
    const moduleLoads = events.filter((event) => event.kind === 'provisioning-module-load');
    const childSpawns = events.filter((event) => event.kind === 'child-spawn');
    assert.deepStrictEqual(events, []);
    assert.strictEqual(moduleLoads.length, 0);
    assert.strictEqual(childSpawns.length, 0);
    console.log('PROVISIONING NON-TRIGGER: browser-provision=0; cred-detect=0; design-doctor=0; child-spawn=0; PASS');
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});
