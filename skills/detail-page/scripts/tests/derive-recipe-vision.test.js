'use strict';

const assert = require('assert');
const path = require('path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const LINEAR = path.join(ROOT, 'references', 'captures', 'app-ui', 'linear');
const { deriveRecipeFromCapture, VISION_SLOT } = require(path.join(ROOT, 'scripts', 'derive-recipe.js'));
const { validateRecipeText } = require(path.join(ROOT, 'scripts', 'recipe-validate.js'));
const {
  VISION_UNAVAILABLE_MESSAGE,
  deriveVisionRecipe,
  visionUnavailableError,
} = require(path.join(ROOT, 'scripts', 'derive-recipe-vision.js'));

function verifiedMock(context) {
  return {
    verifications: context.candidates.map((candidate) => ({
      slot: candidate.slot,
      tile: candidate.tile,
      confirmed: true,
      visibleEvidence: `Independent mock confirmed the cited ${candidate.tile}.`,
    })),
  };
}

test('vision derivation writes only independently verified tile-cited slots and validates', async () => {
  const skeleton = deriveRecipeFromCapture(LINEAR).markdown;
  const result = await deriveVisionRecipe({
    captureDir: LINEAR,
    skeleton,
    proposeFn: (context) => ({
      proposals: context.slots.map((slot) => ({
        slot,
        tile: 'tile_00',
        value: slot === 'signature.name' ? 'Product-UI-render hero' : `Visible ${slot} arrangement`,
        visibleEvidence: `The requested arrangement is visible in tile_00 for ${slot}.`,
      })),
    }),
    signatureProposeFn: () => ({
      signatures: [
        {
          value: 'The oversized product-interface render framed as the hero visual',
          tile: 'tile_00',
          why: 'Its large hero scale makes it the page’s most prominent visual treatment',
          visibleEvidence: 'The large product-interface render occupies the hero in tile_00.',
        },
        {
          value: 'The high-contrast interface cards repeated through the product sequence',
          tile: 'tile_01',
          why: 'The same interface-card treatment recurs in the next visible product panel',
          visibleEvidence: 'The interface-card treatment is plainly visible in tile_01.',
        },
      ],
    }),
    verifyFn: verifiedMock,
  });

  assert.strictEqual(result.accepted.length, 12);
  assert.match(result.markdown, /\*\*Name:\*\* Product-UI-render hero \[tile_00\]/u);
  assert.strictEqual(result.signatures.length, 2);
  assert.match(result.markdown, /## 0 · SIGNATURE-SALIENCE — REPRODUCE THESE FIRST \(ranked\)/u);
  assert.match(result.markdown, /1\. \*\*The oversized product-interface render framed as the hero visual\*\* \[tile_00\]/u);
  assert.match(result.markdown, /2\. \*\*The high-contrast interface cards repeated through the product sequence\*\* \[tile_01\]/u);
  assert.match(result.markdown, /Why it's a signature: Its large hero scale makes it the page’s most prominent visual treatment\./u);
  assert.match(result.markdown, /BUILD PRIORITY: reproduce ALL listed signatures faithfully, starting with #1/u);
  assert.match(result.markdown, /NOTE: only 2 tile-grounded signatures survived independent verification; do not pad/u);
  assert.doesNotMatch(result.markdown, new RegExp(VISION_SLOT.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  const validation = validateRecipeText(result.markdown, 'linear.vision.recipe.md');
  assert.deepStrictEqual(validation.errors, [], validation.errors.map((error) => error.message).join('\n'));
});

test('anti-drift cross-check drops a planted FIG mono-eyebrow claim offline', async () => {
  const skeleton = deriveRecipeFromCapture(LINEAR).markdown;
  const result = await deriveVisionRecipe({
    captureDir: LINEAR,
    skeleton,
    proposeFn: () => ({
      proposals: [{
        slot: 'signature.name',
        tile: 'tile_00',
        value: 'FIG 0.2 mono eyebrow',
        visibleEvidence: 'A FIG 0.2 mono eyebrow appears above the hero.',
      }],
    }),
    signatureProposeFn: () => ({
      signatures: [{
        value: 'FIG 0.2 mono eyebrow',
        tile: 'tile_00',
        why: 'Its small text treatment is visually distinctive',
        visibleEvidence: 'A FIG 0.2 mono eyebrow appears above the hero.',
      }],
    }),
    verifyFn: () => ({
      verifications: [{
        slot: 'signature.name',
        tile: 'tile_00',
        confirmed: false,
        visibleEvidence: '',
      }],
    }),
  });

  assert.strictEqual(result.accepted.length, 0);
  assert.ok(result.dropped.some((item) => item.slot === 'signature.name' && item.reason === 'verification-rejected'));
  assert.ok(result.dropped.some((item) => item.slot === 'signature.salience.1' && item.reason === 'verification-rejected'));
  assert.doesNotMatch(result.markdown, /FIG 0\.2 mono eyebrow/u);
  assert.match(result.markdown, /No dominant signature — no tile-grounded candidate survived independent verification\./u);
  assert.match(result.markdown, /\*\*Name:\*\* _EMPTY — \[tile — TODO vision \(G2\.4\)\]/u);
});

test('signature salience emits only the three independently grounded ranked signatures and never pads', async () => {
  const skeleton = deriveRecipeFromCapture(LINEAR).markdown;
  const result = await deriveVisionRecipe({
    captureDir: LINEAR,
    skeleton,
    proposeFn: () => ({ proposals: [] }),
    signatureProposeFn: () => ({
      signatures: [
        { value: 'Rank one gold mark', tile: 'tile_00', why: 'Its large scale is prominent', visibleEvidence: 'A gold mark is visible in tile_00.' },
        { value: 'Rank two crown', tile: 'tile_01', why: 'Its distinctive silhouette is visible', visibleEvidence: 'A crown is visible in tile_01.' },
        { value: 'Rank three campaign boxes', tile: 'tile_02', why: 'Their repeated box treatment is visible', visibleEvidence: 'Campaign boxes are visible in tile_02.' },
        { value: 'Rejected fourth motif', tile: 'tile_03', why: 'Its size is prominent', visibleEvidence: 'A fourth motif is visible in tile_03.' },
        { value: 'Rejected fifth motif', tile: 'tile_04', why: 'Its distinctiveness is visible', visibleEvidence: 'A fifth motif is visible in tile_04.' },
      ],
    }),
    verifyFn: (context) => ({
      verifications: context.candidates.map((candidate, index) => ({
        slot: candidate.slot,
        tile: candidate.tile,
        confirmed: index < 3,
        visibleEvidence: index < 3 ? `Independent mock confirmed ${candidate.value}.` : '',
      })),
    }),
  });

  assert.strictEqual(result.signatures.length, 3);
  assert.deepStrictEqual(result.signatures.map((signature) => signature.tile), ['tile_00', 'tile_01', 'tile_02']);
  assert.match(result.markdown, /1\. \*\*Rank one gold mark\*\* \[tile_00\]/u);
  assert.match(result.markdown, /2\. \*\*Rank two crown\*\* \[tile_01\]/u);
  assert.match(result.markdown, /3\. \*\*Rank three campaign boxes\*\* \[tile_02\]/u);
  assert.doesNotMatch(result.markdown, /Rejected (?:fourth|fifth) motif/u);
  assert.ok(result.dropped.filter((item) => item.reason === 'exceeds-ranked-top-3').length === 2);
});

test('vision derivation fails loud before a live proposal when no auth is available', async () => {
  let called = false;
  await assert.rejects(
    () => deriveVisionRecipe({
      captureDir: LINEAR,
      skeleton: deriveRecipeFromCapture(LINEAR).markdown,
      authResolver: () => { throw visionUnavailableError(); },
      fetchFn: async () => {
        called = true;
        throw new Error('must not call vision');
      },
    }),
    (error) => error && error.code === 'VISION_RECIPE_UNAVAILABLE' && error.message.startsWith(VISION_UNAVAILABLE_MESSAGE),
  );
  assert.strictEqual(called, false);
});
