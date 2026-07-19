'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const path = require('path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const VALIDATOR = path.join(ROOT, 'scripts', 'recipe-validate.js');
const LINEAR = path.join(ROOT, 'references', 'corpus', 'recipes', 'linear.recipe.md');
const FIXTURES = path.join(__dirname, 'fixtures');

function run(recipe) {
  return childProcess.spawnSync(process.execPath, [VALIDATOR, recipe], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 10_000,
  });
}

test('recipe validator accepts the proven Linear recipe and rejects structural/provenance gaps', () => {
  const linear = run(LINEAR);
  assert.strictEqual(linear.status, 0, linear.stderr);
  assert.match(linear.stdout, /^PASS .*linear\.recipe\.md — 6 required blocks/u);
  assert.match(linear.stdout, /styles, body, tile/u);

  const missingToken = run(path.join(FIXTURES, 'missing-token.recipe.md'));
  assert.strictEqual(missingToken.status, 1, missingToken.stdout);
  assert.match(missingToken.stderr, /^FAIL .*missing-token\.recipe\.md/mu);
  assert.match(missingToken.stderr, /Missing required block: TOKEN BLOCK\./u);

  const uncitedSignature = run(path.join(FIXTURES, 'missing-signature-provenance.recipe.md'));
  assert.strictEqual(uncitedSignature.status, 1, uncitedSignature.stdout);
  assert.match(uncitedSignature.stderr, /Signature technique 1 requires a \[tile\] or \[styles\] provenance marker\./u);
});
