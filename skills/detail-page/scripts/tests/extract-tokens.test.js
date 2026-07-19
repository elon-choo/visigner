'use strict';

const assert = require('assert');
const path = require('path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(__dirname, 'fixtures', 'extract-tokens');
const { extractTokensFromCapture } = require(path.join(ROOT, 'scripts', 'extract-tokens.js'));
const { validateRecord } = require(path.join(ROOT, 'scripts', 'corpus-validate.js'));

function extract(name) {
  const dir = path.join(FIXTURES, name);
  return extractTokensFromCapture(dir, path.join(dir, 'styles.json'));
}

test('extract-tokens is deterministic and preserves the authored-region guard', () => {
  const linear = extract('dom-authored');
  const linearAgain = extract('dom-authored');
  const wadiz = extract('likely-platform-chrome');

  assert.deepStrictEqual(linearAgain, linear);
  assert.strictEqual(linear.rhythm.viewports.value, 2);
  assert.strictEqual(linear.rhythm.text_density.value, 400);
  assert.strictEqual(linear.rhythm.image_density.value, 1.5);
  assert.strictEqual(linear.motion.gif_asset_count.value, 0);

  assert.strictEqual(linear.type.display.family.value, 'Inter Variable');
  assert.strictEqual(linear.type.display.family.provenance, 'styles-json');
  assert.strictEqual(linear.type.display.family.confidence, null);
  assert.strictEqual(linear.type.display.family.evidence, 'styles.json#/type/display/resolvedFamily');
  assert.deepStrictEqual(linear.palette.computed_backgrounds.value, [{ value: '#08090a', areaShare: 0.84 }]);
  assert.strictEqual(linear.palette.computed_backgrounds.provenance, 'styles-json');
  assert.strictEqual(linear.palette.computed_backgrounds.evidence, 'styles.json#/color/backgrounds');
  assert.strictEqual(linear.palette.roles.dominant_60.value, null);

  assert.strictEqual(wadiz.rhythm.viewports.value, 3);
  assert.strictEqual(wadiz.rhythm.text_density.value, 200);
  assert.strictEqual(wadiz.palette.roles.dominant_60.value, null);
  assert.strictEqual(wadiz.type.display.family.value, null);
  assert.strictEqual(wadiz.type.display.family.gap, 'GAP-07');
  assert.match(wadiz.palette.roles.dominant_60.evidence, /likely-platform-chrome/u);
  assert.doesNotMatch(JSON.stringify(wadiz.palette), /#f2f5f8/u);

  for (const tokens of [linear, wadiz]) {
    const result = validateRecord(tokens);
    assert.deepStrictEqual(result.errors, [], result.errors.map((item) => item.message).join('\n'));
  }
});
