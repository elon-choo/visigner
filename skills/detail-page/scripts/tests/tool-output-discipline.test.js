'use strict';

const assert = require('node:assert');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const LIBRARIAN = path.join(ROOT, 'scripts', 'librarian.js');
const DERIVE_RECIPE = path.join(ROOT, 'scripts', 'derive-recipe.js');
const EXTRACT_TOKENS = path.join(ROOT, 'scripts', 'extract-tokens.js');
const LINEAR_CAPTURE = path.join(ROOT, 'references', 'captures', 'app-ui', 'linear');

function run(script, args) {
  return childProcess.spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30_000,
  });
}

test('empty corpus lookup exits with an explicit database MISS', () => {
  const result = run(LIBRARIAN, ['query', JSON.stringify({ category: 'ga4-no-such-category' })]);

  assert.strictEqual(result.status, 1, result.stdout);
  assert.match(result.stderr, /MISS — no corpus match found — this is a database miss, not an empty value; do not invent one\./u);
});

test('overwrite without --force refuses and preserves the existing artifact', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-ga4-discipline-'));
  const output = path.join(tempDir, 'existing.recipe.md');
  const original = 'keep this artifact\n';
  fs.writeFileSync(output, original);

  try {
    const result = run(DERIVE_RECIPE, [LINEAR_CAPTURE, '--out', output]);

    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stderr, /REFUSING — output already exists: .*; skipped without --force \(non-destructive overwrite guard\)\./u);
    assert.strictEqual(fs.readFileSync(output, 'utf8'), original);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('the extractor refuses its former implicit default capture region', () => {
  const result = run(EXTRACT_TOKENS, []);

  assert.strictEqual(result.status, 1, result.stdout);
  assert.match(result.stderr, /REFUSING — authored region is unresolved; provide an explicit region classification; no region default will be assumed\./u);
  assert.match(result.stderr, /no default capture region will be assumed/u);
});
