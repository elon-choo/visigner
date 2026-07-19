'use strict';

const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(__dirname, 'fixtures');
const LINEAR = path.join(ROOT, 'references', 'captures', 'app-ui', 'linear');
const { deriveRecipeFromCapture } = require(path.join(ROOT, 'scripts', 'derive-recipe.js'));
const { deriveVisionRecipe } = require(path.join(ROOT, 'scripts', 'derive-recipe-vision.js'));
const { REFUSAL_MESSAGE } = require(path.join(ROOT, 'scripts', 'build-honesty-check.js'));

const SALIENCE_FIXTURE = path.join(FIXTURES, 'gb2-salience', 'vision-fixture.json');
const HONESTY_FIXTURES = path.join(FIXTURES, 'gb2-honesty');
const HONESTY_SCRIPT = path.join(ROOT, 'scripts', 'build-honesty-check.js');

async function deriveFixtureSalience() {
  return deriveVisionRecipe({
    captureDir: LINEAR,
    skeleton: deriveRecipeFromCapture(LINEAR).markdown,
    visionFixture: SALIENCE_FIXTURE,
  });
}

function runHonesty(name) {
  return spawnSync(process.execPath, [
    HONESTY_SCRIPT,
    path.join(HONESTY_FIXTURES, `${name}.build.html`),
    '--recipe',
    path.join(HONESTY_FIXTURES, `${name}.recipe.md`),
  ], { encoding: 'utf8' });
}

test('GB.2 fixture salience consensus is byte-stable across two hermetic runs', async () => {
  const first = await deriveFixtureSalience();
  const second = await deriveFixtureSalience();
  const firstRanking = Buffer.from(JSON.stringify(first.signatures));
  const secondRanking = Buffer.from(JSON.stringify(second.signatures));

  assert.ok(firstRanking.equals(secondRanking), 'ranked signature JSON must be byte-identical');
  assert.deepStrictEqual(first.signatures.map((signature) => signature.value), [
    'Alpha framed product render',
    'Beta product-grid emblem',
  ]);
  assert.deepStrictEqual(first.signatures.map((signature) => signature.slot), [
    'signature.salience.1',
    'signature.salience.2',
  ]);
});

test('GB.2 honesty gate refuses a fabricated number and metric label with a location', () => {
  const result = runHonesty('fabricated');
  assert.strictEqual(result.status, 1, result.stderr);
  assert.match(result.stderr, new RegExp(REFUSAL_MESSAGE.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  assert.match(result.stderr, /UNSUPPORTED number "87" at .+:3:\d+/u);
  assert.match(result.stderr, /UNSUPPORTED label "loyalty score" at .+:3:\d+/u);
});

test('GB.2 honesty gate passes a clean build/recipe fixture pair', () => {
  const result = runHonesty('clean');
  assert.strictEqual(result.status, 0, result.stderr);
  assert.match(result.stdout, /^PASS build-honesty-check/mu);
});

test('GB.2 honesty gate decodes numeric entities so escaped digits cannot smuggle fabricated numbers', () => {
  const result = runHonesty('entity');
  assert.strictEqual(result.status, 1, result.stderr);
  assert.match(result.stderr, /UNSUPPORTED number "87"/u, 'decimal entities (&#56;&#55;) must be checked as the rendered 87');
  assert.match(result.stderr, /UNSUPPORTED number "98"/u, 'hex entities (&#x39;&#x38;) must be checked as the rendered 98');
});

test('GB.2 honesty gate refuses page numbers that only trace to recipe code fences or CSS token lines', () => {
  const result = runHonesty('css-laundered');
  assert.strictEqual(result.status, 1, result.stderr);
  assert.match(result.stderr, /UNSUPPORTED number "87"/u, 'a spacing-scale token inside a fenced block must not whitelist prose copy');
});

test('GB.2 honesty gate keeps §4 text-fence content numbers whitelisted (honest 17,803 build passes)', () => {
  const result = spawnSync(process.execPath, [
    HONESTY_SCRIPT,
    path.join(HONESTY_FIXTURES, 'content-fence.build.html'),
    '--recipe',
    path.join(HONESTY_FIXTURES, 'content-fence.recipe.md'),
  ], { encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stderr);
  assert.match(result.stdout, /^PASS build-honesty-check/mu);
});

test('GB.2 honesty gate scans CJK-unit-adjacent numbers instead of going blind on them', () => {
  const result = spawnSync(process.execPath, [
    HONESTY_SCRIPT,
    path.join(HONESTY_FIXTURES, 'cjk-adjacent.build.html'),
    '--recipe',
    path.join(HONESTY_FIXTURES, 'content-fence.recipe.md'),
  ], { encoding: 'utf8' });
  assert.strictEqual(result.status, 1, result.stderr);
  assert.match(result.stderr, /UNSUPPORTED number "9,999,999"/u, 'a comma-grouped figure directly followed by 원 must be scanned and refused');
  assert.match(result.stderr, /UNSUPPORTED number "999"/u, 'a plain figure directly followed by 명 must be scanned and refused');
});

test('GB.2 honesty gate passes CJK-unit-adjacent figures when the recipe shows the same figures', () => {
  const result = runHonesty('cjk-honest');
  assert.strictEqual(result.status, 0, result.stderr);
  assert.match(result.stdout, /^PASS build-honesty-check — 2 number\(s\), 2 unit\(s\)/mu, 'both unit-adjacent figures must be scanned and trace symmetrically');
});

test('GB.2 honesty gate refuses numbers laundered from colorRoles rank lines or color table rows', () => {
  const result = spawnSync(process.execPath, [
    HONESTY_SCRIPT,
    path.join(HONESTY_FIXTURES, 'rank-laundered.build.html'),
    '--recipe',
    path.join(HONESTY_FIXTURES, 'content-fence.recipe.md'),
  ], { encoding: 'utf8' });
  assert.strictEqual(result.status, 1, result.stderr);
  assert.match(result.stderr, /UNSUPPORTED number "30"/u, 'the 30 in "30 — second measured background share" must not whitelist promo copy');
  assert.match(result.stderr, /UNSUPPORTED number "242"/u, 'an rgb() component inside a markdown color table row must not whitelist prose copy');
});
