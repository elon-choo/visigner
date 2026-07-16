'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const RUNNER = path.join(ROOT, 'hooks', 'run-node.sh');
const HOOK = path.join(ROOT, 'hooks', 'auto-critique-hook.js');
const HOOKS_CONFIG = path.join(ROOT, 'hooks', 'hooks.json');
const PLUGIN_MANIFEST = path.join(ROOT, '.claude-plugin', 'plugin.json');
const ARTIFACT = path.join(ROOT, 'skills', 'detail-page', 'scripts', 'tests', 'fixtures', 'orthogonality', 'empty-placeholder-panels', 'index.html');

function syntheticEvent() {
  return JSON.stringify({
    hook_event_name: 'PostToolUse',
    tool_name: 'Write',
    cwd: ROOT,
    tool_input: { file_path: ARTIFACT },
    tool_response: { success: true },
  });
}

test('launcher finds nvm node and runs the grade hook when node is off launch PATH', () => {
  const launchEnv = {
    ...process.env,
    PATH: '/usr/bin:/bin',
    NVM_DIR: path.join(os.tmpdir(), `visigner-missing-nvm-${process.pid}-${Date.now()}`),
    VISIGNER_FORCE_BROWSER_MISSING: '1',
  };
  const ambientNode = spawnSync('/bin/sh', ['-c', 'command -v node'], {
    env: launchEnv,
    encoding: 'utf8',
  });
  assert.notStrictEqual(ambientNode.status, 0, `test precondition failed: node is on stripped PATH at ${ambientNode.stdout.trim()}`);

  const child = spawnSync(RUNNER, [HOOK], {
    cwd: ROOT,
    env: launchEnv,
    input: syntheticEvent(),
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.strictEqual(child.status, 0, child.stderr);
  assert.strictEqual(child.stderr, '');
  const payload = JSON.parse(child.stdout);
  const context = payload.hookSpecificOutput.additionalContext;
  assert.match(context, /^verdict:\s*clean$/mi);
  assert.match(context, /^mechanicalScore:\s*100\/A$/mi);
  assert.match(context, /^staticGradeStatus:\s*emitted$/mi);

  const reportPath = context.match(/^staticReport:\s*(.+)$/mi)?.[1].trim();
  if (reportPath) fs.rmSync(path.dirname(reportPath), { recursive: true, force: true });
});

test('launcher fails loud and non-zero when every node fallback misses', () => {
  const emptyHome = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-no-node-'));
  try {
    const child = spawnSync(RUNNER, [HOOK], {
      cwd: ROOT,
      env: {
        HOME: emptyHome,
        NVM_DIR: path.join(emptyHome, '.nvm'),
        PATH: '',
        VISIGNER_NODE_SYSTEM_PATHS: `${emptyHome}/opt/node ${emptyHome}/usr/node`,
      },
      input: syntheticEvent(),
      encoding: 'utf8',
      timeout: 10_000,
    });
    assert.notStrictEqual(child.status, 0);
    assert.strictEqual(child.stdout, '');
    assert.match(child.stderr, /^Visigner hook: no node interpreter found — install Node or run \/design-setup\n$/);
  } finally {
    fs.rmSync(emptyHome, { recursive: true, force: true });
  }
});

test('plugin hook config uses the launcher + manifest explicitly points at hooks.json', () => {
  const config = JSON.parse(fs.readFileSync(HOOKS_CONFIG, 'utf8'));
  const commandHook = config.hooks.PostToolUse[0].hooks[0];
  assert.strictEqual(config.hooks.PostToolUse[0].matcher, 'Write|Edit');
  assert.strictEqual(commandHook.command, '${CLAUDE_PLUGIN_ROOT}/hooks/run-node.sh');
  assert.deepStrictEqual(commandHook.args, ['${CLAUDE_PLUGIN_ROOT}/hooks/auto-critique-hook.js']);
  assert.strictEqual(commandHook.timeout, 120);
  assert.strictEqual(commandHook.statusMessage, 'Running Visigner auto-grade and optional capture');

  // The manifest now explicitly points at hooks/hooks.json (added during live-fire debugging). Convention
  // auto-discovery alone counts the hook in `plugin details` but the explicit pointer is the schema-correct
  // registration; both point at the same single hooks.json (no double-registration — it's one file reference).
  const manifest = JSON.parse(fs.readFileSync(PLUGIN_MANIFEST, 'utf8'));
  assert.strictEqual(manifest.hooks, './hooks/hooks.json');
});
