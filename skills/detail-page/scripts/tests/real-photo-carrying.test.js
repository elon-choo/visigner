'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const LINEAR = path.join(ROOT, 'references', 'captures', 'app-ui', 'linear');
const FIXTURE = path.join(__dirname, 'fixtures', 'real-photo-carrying', 'product-photo.fixture.json');
const { deriveRecipeFromCapture } = require(path.join(ROOT, 'scripts', 'derive-recipe.js'));
const {
  PRODUCT_PHOTO_HEADING,
  PRODUCT_PHOTO_SCHEMA,
  deriveVisionRecipe,
} = require(path.join(ROOT, 'scripts', 'derive-recipe-vision.js'));
const {
  V4_ENHANCEMENT_SCHEMA,
  applyV4Enhancement,
  buildPhotoCarryingPage,
  parseProductPhotoRecipe,
} = require(path.join(ROOT, 'scripts', 'design-loop.js'));

function fixtureCapture() {
  const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-real-photo-carrying-'));
  const tile = Buffer.from(fixture.tile.base64, 'base64');
  fs.writeFileSync(path.join(dir, fixture.tile.filename), tile);
  return { dir, fixture, tile };
}

function noNormalVisionSlots() {
  return {
    proposeFn: () => ({ proposals: [] }),
    signatureProposeFn: () => ({ signatures: [] }),
    verifyFn: () => ({ verifications: [] }),
  };
}

test('verified product-photo regions carry a deterministic data URI from the cited fixture tile', async () => {
  const capture = fixtureCapture();
  const result = await deriveVisionRecipe({
    captureDir: capture.dir,
    skeleton: deriveRecipeFromCapture(LINEAR).markdown,
    ...noNormalVisionSlots(),
    productPhotoProposeFn: () => ({ regions: [capture.fixture.productRegion] }),
    productPhotoVerifyFn: ({ candidates }) => ({
      verifications: candidates.map((candidate) => ({
        id: candidate.id,
        tile: candidate.tile,
        crop: candidate.crop,
        confirmed: true,
        confidence: 0.97,
        visibleEvidence: 'Independent fixture verification sees the product template preview in the exact crop.',
      })),
    }),
  });

  assert.strictEqual(result.productPhotoStatus, 'resolved');
  assert.strictEqual(result.productPhotos.length, 1);
  assert.match(result.markdown, new RegExp(PRODUCT_PHOTO_HEADING.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  const manifest = parseProductPhotoRecipe(result.markdown);
  assert.strictEqual(manifest.status, 'resolved');
  assert.strictEqual(manifest.regions[0].tile, 'tile_00');
  assert.deepStrictEqual(manifest.regions[0].crop, { x: 0, y: 0, width: 96, height: 80 });

  const built = buildPhotoCarryingPage({ recipe: result.markdown, captureDir: capture.dir });
  assert.strictEqual(built.status, 'resolved');
  assert.strictEqual(built.unresolved.length, 0);
  assert.strictEqual(built.embedded.length, 1);
  assert.ok(built.embedded[0].bytes > 1000);
  assert.match(built.html, /data:image\/png;base64,[A-Za-z0-9+/=]{1000,}/u);
  assert.strictEqual((built.html.match(/data:image\//gu) || []).length, 1);
  assert.deepStrictEqual(
    Buffer.from(built.embedded[0].dataUri.split(',')[1], 'base64'),
    capture.tile,
    'the full-tile fixture crop must be carried byte-for-byte from the cited capture tile',
  );
});

test('a capture without a confident product-photo region records an explicit MISS and builds no invented crop', async () => {
  const capture = fixtureCapture();
  const lowConfidence = { ...capture.fixture.productRegion, confidence: 0.79 };
  const result = await deriveVisionRecipe({
    captureDir: capture.dir,
    skeleton: deriveRecipeFromCapture(LINEAR).markdown,
    ...noNormalVisionSlots(),
    productPhotoProposeFn: () => ({ regions: [lowConfidence] }),
    productPhotoVerifyFn: () => {
      throw new Error('verification must not run when no proposed crop meets the confidence threshold');
    },
  });

  assert.strictEqual(result.productPhotoStatus, 'miss');
  assert.strictEqual(result.productPhotos.length, 0);
  assert.ok(result.dropped.some((item) => item.reason === 'below-product-photo-confidence-threshold'));
  const manifest = parseProductPhotoRecipe(result.markdown);
  assert.deepStrictEqual(manifest, {
    status: 'miss',
    regions: [],
    message: manifest.message,
  });
  const built = buildPhotoCarryingPage({ recipe: result.markdown, captureDir: capture.dir });
  assert.strictEqual(built.status, 'miss');
  assert.strictEqual(built.embedded.length, 0);
  assert.strictEqual(built.html, '');
  assert.doesNotMatch(result.markdown, new RegExp(PRODUCT_PHOTO_SCHEMA + '"\\s*,\\s*"status"\\s*:\\s*"resolved"', 'u'));
});

test('v4 enhancement without proofSection copy/provenance is an explicit REFUSING, never a hardcoded band', () => {
  const enhancement = {
    schema: V4_ENHANCEMENT_SCHEMA,
    provenance: { tile: 'tile_10.jpg', bodytext: 'bodytext.txt#Q2 (fixture segment)' },
    empathy: { eyebrow: 'Fixture eyebrow', headline: 'Fixture headline', body: 'Fixture body copy.' },
    stickyCta: { recap: 'Fixture recap', scarcity: 'Fixture scarcity', action: 'Fixture action' },
  };
  const baseHtml = '<html><head></head><body><div class="purple-block"></div><section class="reward-list"></section></body></html>';

  assert.throws(
    () => applyV4Enhancement(baseHtml, enhancement),
    /REFUSING — v4 enhancement must supply proofSection/u,
    'missing proofSection must refuse instead of inserting invented copy or provenance',
  );

  const output = applyV4Enhancement(baseHtml, {
    ...enhancement,
    proofSection: {
      kicker: '실제 제품 사진 전후',
      headline: '스마트폰으로만 대충 찍고 있나요?',
      provenanceTiles: ['tile_20.jpg', 'tile_21.jpg', 'tile_22.jpg'],
    },
  });
  assert.match(output, /data-provenance="tile_20\.jpg,tile_21\.jpg,tile_22\.jpg"/u, 'supplied provenance tiles must drive the proof band');
  assert.match(output, /스마트폰으로만 대충 찍고 있나요\?/u, 'supplied copy must drive the proof band');
});
