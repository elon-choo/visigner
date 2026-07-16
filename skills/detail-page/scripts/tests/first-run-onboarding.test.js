'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const {
  buildFirstRunOnboarding,
  detectFirstRun,
} = require(path.join(ROOT, 'hooks', 'onboarding', 'first-run.js'));
const { guidedProvisioning } = require(path.join(ROOT, 'hooks', 'browser-provision.js'));
const { ENABLE_COMMANDS } = require(path.join(ROOT, 'hooks', 'cred-detect.js'));

function workspace(name, prior = false) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `visigner-g41-${name}-`));
  const target = path.join(dir, 'current.html');
  fs.writeFileSync(target, '<!doctype html><html><body><main><h1>Current design</h1></main></body></html>');
  if (prior) fs.writeFileSync(path.join(dir, 'prior.htm'), '<!doctype html><title>Prior design</title>');
  return { dir, target };
}

function eventFor(dir) {
  return {
    hook_event_name: 'PostToolUse',
    tool_name: 'Write',
    cwd: dir,
    tool_input: { file_path: 'current.html' },
    tool_response: { success: true },
  };
}

function noCredentialEnv(dir) {
  return {
    HOME: path.join(dir, 'empty-home'),
    CODEX_HOME: path.join(dir, 'empty-codex'),
    OPENAI_API_KEY: '',
    GEMINI_API_KEY: '',
  };
}

const noBrowser = async () => ({
  available: false,
  reasonCode: 'forced-missing',
  reason: 'test browser absent',
});
const noCache = async () => ({ present: false, rootsChecked: ['/mock/empty-browser-cache'] });

test('bare first-run emits plain onboarding, exact doctor fixes, and safe defaults', async () => {
  const fixture = workspace('bare');
  try {
    const result = await buildFirstRunOnboarding(eventFor(fixture.dir), {
      env: noCredentialEnv(fixture.dir),
      browserProbe: noBrowser,
      browserCacheProbe: noCache,
    });
    const expectedBrowserCommand = guidedProvisioning(ROOT).installCommand;
    assert.strictEqual(result.emit, true);
    assert.strictEqual(result.firstRun, true);
    assert.strictEqual(result.novelty.priorArtifactCount, 0);
    assert.match(result.message, /What just happened:/);
    assert.match(result.message, /What you will see next:/);
    assert.match(result.message, /ONE-TAP NEXT STEPS/);
    assert.ok(result.message.includes(expectedBrowserCommand));
    for (const command of Object.values(ENABLE_COMMANDS)) assert.ok(result.message.includes(command), command);
    assert.match(result.message, /on-brand SVG placeholders keep the page renderable/);
    assert.match(result.message, /Visigner brand-default tokens/);
    assert.match(result.message, /guided browser install is available, requires your consent, and is never auto-run/);
    assert.strictEqual(result.imageGenerationBlocked, false);
    console.log('G4.1 BARE FIRST-RUN ONBOARDING OUTPUT:\n' + result.message);
  } finally {
    fs.rmSync(fixture.dir, { recursive: true, force: true });
  }
});

test('fully configured first-run emits the ready path without setup commands', async () => {
  const fixture = workspace('configured');
  try {
    const result = await buildFirstRunOnboarding(eventFor(fixture.dir), {
      env: { ...noCredentialEnv(fixture.dir), OPENAI_API_KEY: 'test-present' },
      browserProbe: async () => ({ available: true, provider: 'mock', candidate: 'mock-chromium' }),
      browserCacheProbe: noCache,
    });
    assert.strictEqual(result.emit, true);
    assert.strictEqual(result.setupSteps.length, 0);
    assert.match(result.message, /YOU'RE SET — just describe the page you want/);
    assert.doesNotMatch(result.message, /npm install|codex login|export OPENAI_API_KEY|export GEMINI_API_KEY/);
    console.log("G4.1 CONFIGURED FIRST-RUN: emit=true; setupSteps=0; path=YOU'RE SET — just describe the page you want");
  } finally {
    fs.rmSync(fixture.dir, { recursive: true, force: true });
  }
});

test('returning workspace with another HTML artifact emits nothing and skips doctor', async () => {
  const fixture = workspace('returning', true);
  let doctorCalls = 0;
  try {
    const novelty = detectFirstRun(eventFor(fixture.dir));
    const result = await buildFirstRunOnboarding(eventFor(fixture.dir), {
      doctorRunner: async () => {
        doctorCalls += 1;
        throw new Error('doctor must not run for a returning workspace');
      },
    });
    assert.strictEqual(novelty.firstRun, false);
    assert.strictEqual(novelty.reason, 'prior-design-artifact-found');
    assert.strictEqual(result.emit, false);
    assert.strictEqual(result.message, '');
    assert.strictEqual(doctorCalls, 0);
    console.log('G4.1 RETURNING WORKSPACE: novelty=false; onboarding emit=false; outputBytes=0; doctorCalls=0');
  } finally {
    fs.rmSync(fixture.dir, { recursive: true, force: true });
  }
});

test('novelty scan ignores excluded/plugin-owned files and fails conservative when unreadable', () => {
  const fixture = workspace('scan-guards');
  try {
    for (const directory of ['node_modules', '.git', 'dist', 'cache']) {
      const ignored = path.join(fixture.dir, directory);
      fs.mkdirSync(ignored);
      fs.writeFileSync(path.join(ignored, 'old.html'), '<!doctype html><title>Ignored artifact</title>');
    }
    fs.symlinkSync(path.join(ROOT, 'docs', 'index.html'), path.join(fixture.dir, 'plugin-doc.html'));
    const ignored = detectFirstRun(eventFor(fixture.dir));
    assert.strictEqual(ignored.firstRun, true);
    assert.strictEqual(ignored.priorArtifactCount, 0);

    const unreadableFs = new Proxy(fs, {
      get(target, property) {
        if (property === 'readdirSync') return () => { throw new Error('mock unreadable workspace'); };
        return target[property];
      },
    });
    const uncertain = detectFirstRun(eventFor(fixture.dir), { fsApi: unreadableFs });
    assert.strictEqual(uncertain.firstRun, false);
    assert.strictEqual(uncertain.uncertain, true);
    assert.strictEqual(uncertain.reason, 'novelty-check-failed-safe');
    console.log('G4.1 NOVELTY GUARDS: ignored dirs + plugin-owned HTML excluded; unreadable workspace => firstRun=false');
  } finally {
    fs.rmSync(fixture.dir, { recursive: true, force: true });
  }
});

test('first-run helper remains read-only and spawn-free with in-process doctor probes', async () => {
  const fixture = workspace('sentinel');
  const writeNames = [
    'writeFileSync', 'appendFileSync', 'writeFile', 'appendFile', 'createWriteStream',
    'rmSync', 'unlinkSync', 'renameSync', 'mkdirSync',
  ];
  const spawnNames = ['spawn', 'spawnSync', 'exec', 'execSync'];
  const originals = [];
  let writes = 0;
  let spawns = 0;
  try {
    for (const name of writeNames) {
      if (typeof fs[name] !== 'function') continue;
      const original = fs[name];
      originals.push(() => { fs[name] = original; });
      fs[name] = function countedWrite(...args) {
        writes += 1;
        return original.apply(this, args);
      };
    }
    for (const name of spawnNames) {
      if (typeof childProcess[name] !== 'function') continue;
      const original = childProcess[name];
      originals.push(() => { childProcess[name] = original; });
      childProcess[name] = function countedSpawn(...args) {
        spawns += 1;
        return original.apply(this, args);
      };
    }

    const before = fs.readFileSync(fixture.target);
    const result = await buildFirstRunOnboarding(eventFor(fixture.dir), {
      env: noCredentialEnv(fixture.dir),
      browserProbe: noBrowser,
      browserCacheProbe: noCache,
    });
    const after = fs.readFileSync(fixture.target);
    assert.strictEqual(result.emit, true);
    assert.deepStrictEqual(after, before);
    assert.strictEqual(writes, 0);
    assert.strictEqual(spawns, 0);
    console.log('G4.1 READ-ONLY SENTINEL: fs-writes=0; child-spawns=0; page-byte-identical=true; marker-writes=0');
  } finally {
    while (originals.length) originals.pop()();
    fs.rmSync(fixture.dir, { recursive: true, force: true });
  }
});
