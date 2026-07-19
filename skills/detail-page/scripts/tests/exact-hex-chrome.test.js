'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const { resolveMakerRegion } = require(path.join(ROOT, 'scripts', 'authored-region.js'));
const { separatePlatformStyles } = require(path.join(ROOT, 'scripts', 'capture-styles.js'));
const { deriveRecipeFromCapture, VISION_SLOT } = require(path.join(ROOT, 'scripts', 'derive-recipe.js'));
const { validateRecipeText } = require(path.join(ROOT, 'scripts', 'recipe-validate.js'));

const KR_CHROME_CAPTURE = path.join(__dirname, 'fixtures', 'kr-chrome-capture');
const EXACT_HEX = path.join(__dirname, 'fixtures', 'kr-chrome-exact-hex');
const MAKER_MISS = path.join(__dirname, 'fixtures', 'kr-chrome-maker-miss');

function json(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function tokenBlock(markdown) {
  return markdown.split('## 2 · LAYOUT CONCEPT + STRUCTURE')[0];
}

test('KR chrome collection keeps maker and platform tokens in separate buckets with the exact maker accent', () => {
  const input = json(path.join(KR_CHROME_CAPTURE, 'capture-styles-input.json'));
  const expected = json(path.join(EXACT_HEX, 'styles.json'));
  const collected = separatePlatformStyles(input);

  assert.deepStrictEqual(collected.makerStyles, expected.makerStyles);
  assert.deepStrictEqual(collected.chromeStyles, expected.chromeStyles);
  assert.strictEqual(collected.makerStyles.exactAccent.value, '#c9ff3d');
  assert.strictEqual(collected.makerStyles.exactAccent.source.property, 'color');
  assert.ok(collected.chromeStyles.color.backgrounds.some((entry) => entry.value === '#00c4c4'));
  assert.ok(!collected.makerStyles.color.backgrounds.some((entry) => entry.value === '#00c4c4'));
});

test('KR chrome recipe carries only the exact maker hex in a styles-json provenance envelope', () => {
  const recipe = deriveRecipeFromCapture(EXACT_HEX);
  const validation = validateRecipeText(recipe.markdown, 'kr-chrome-exact-hex.recipe.md');

  assert.deepStrictEqual(validation.errors, [], validation.errors.map((item) => item.message).join('\n'));
  assert.strictEqual(recipe.stats.layerB.filled, 1);
  assert.strictEqual(recipe.stats.tokenSource, 'maker-authored-region');
  assert.match(recipe.markdown, /"value": "#c9ff3d"/u);
  assert.match(recipe.markdown, /"provenance": "styles-json"/u);
  assert.match(recipe.markdown, /"evidence": "styles\.json#\/makerStyles\/exactAccent\/value"/u);
  assert.doesNotMatch(tokenBlock(recipe.markdown), /#00c4c4|#f2f5f8/u);
});

test('a genuinely unresolvable maker region reports MISS and never promotes a chrome hex', () => {
  const separated = separatePlatformStyles({
    makerRegion: resolveMakerRegion([]),
    makerSamples: [{
      selector: '.unproven-maker-accent',
      semantic: 'maker-accent',
      area: 100,
      color: 'rgb(201, 255, 61)',
      backgroundColor: 'rgba(0, 0, 0, 0)',
    }],
    chromeSamples: [{
      selector: '.wadiz-primary-cta',
      semantic: 'wadiz-primary-cta',
      area: 100,
      color: 'rgb(255, 255, 255)',
      backgroundColor: 'rgb(0, 196, 196)',
    }],
  });
  const recipe = deriveRecipeFromCapture(MAKER_MISS);

  assert.strictEqual(separated.makerStyles.status, 'MISS');
  assert.strictEqual(separated.makerStyles.exactAccent, null);
  assert.match(separated.makerStyles.gap, /^MISS —/u);
  assert.strictEqual(recipe.stats.layerB.filled, 0);
  assert.strictEqual(recipe.stats.tokenSource, 'likely-platform-chrome-or-unsafe');
  assert.match(recipe.markdown, new RegExp(VISION_SLOT.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  assert.doesNotMatch(tokenBlock(recipe.markdown), /#00c4c4|#c9ff3d/u);
});
