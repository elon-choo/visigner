'use strict';

const assert = require('assert');
const path = require('path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const {
  CHANNELS,
  detectPlaceholderImages,
} = require(path.join(ROOT, 'hooks', 'human-gate', 'placeholder-image-detector.js'));

const FIXTURES = path.join(__dirname, 'fixtures');

test('G3.0 F1 external SVG fixture flags exactly five via referenced-file markers', () => {
  const page = path.join(FIXTURES, 'g3-f1-external-svg', 'index.html');
  const report = detectPlaceholderImages(page);

  assert.strictEqual(report.status, 'detected');
  assert.strictEqual(report.zeroNetwork, true);
  assert.strictEqual(report.placeholderCount, 5);
  assert.strictEqual(report.items.length, 5);
  assert.deepStrictEqual(
    report.items.map((item) => item.id).sort(),
    ['hero-product', 'kitchen-scene', 'lab-detail', 'material-closeup', 'package-detail'],
  );
  for (const item of report.items) {
    assert.strictEqual(item.sourceChannel, CHANNELS.REFERENCED_SVG);
    assert.strictEqual(item['source-channel'], CHANNELS.REFERENCED_SVG);
    assert.ok(item.sourceChannels.includes(CHANNELS.REFERENCED_SVG));
    assert.ok(item.sourceChannels.includes(CHANNELS.MANIFEST));
    assert.match(item.fix, /^supply a real image for .+; or run: codex login$/);
    assert.strictEqual(item.enableCommand, 'codex login');
  }
  assert.strictEqual(report.unknownReferences.length, 0);
  assert.strictEqual(report.errors.length, 0);
});

test('mixed fixture flags exactly four placeholders across all channels and no real SVGs', () => {
  const page = path.join(FIXTURES, 'g3-placeholder-mixed', 'index.html');
  const report = detectPlaceholderImages(page);
  const byId = Object.fromEntries(report.items.map((item) => [item.id, item]));

  assert.strictEqual(report.status, 'partial');
  assert.strictEqual(report.placeholderCount, 4);
  assert.deepStrictEqual(Object.keys(byId).sort(), ['inline-reference-standin', 'inline-standin', 'manifest-standin', 'marker-standin']);
  assert.strictEqual(byId['marker-standin'].sourceChannel, CHANNELS.REFERENCED_SVG);
  assert.strictEqual(byId['inline-reference-standin'].sourceChannel, CHANNELS.REFERENCED_SVG);
  assert.strictEqual(byId['inline-standin'].sourceChannel, CHANNELS.HTML);
  assert.strictEqual(byId['manifest-standin'].sourceChannel, CHANNELS.MANIFEST);
  assert.ok(!Object.hasOwn(byId, 'real-photo'));
  assert.ok(!Object.hasOwn(byId, 'real-icon'));
  assert.strictEqual(report.unknownReferences.length, 1);
  assert.match(report.unknownReferences[0].src, /unreadable-missing\.svg$/);
  assert.strictEqual(report.unknownReferences[0].status, 'unknown');
  assert.strictEqual(report.errors.length, 0);
});

test('src-referenced SVG marker is detected without any co-located manifest', () => {
  const page = path.join(FIXTURES, 'g3-placeholder-no-manifest', 'index.html');
  const report = detectPlaceholderImages(page);

  assert.strictEqual(report.status, 'detected');
  assert.strictEqual(report.placeholderCount, 1);
  assert.strictEqual(report.manifestsScanned.length, 0);
  assert.strictEqual(report.items[0].id, 'no-manifest-standin');
  assert.strictEqual(report.items[0].sourceChannel, CHANNELS.REFERENCED_SVG);
  assert.deepStrictEqual(report.items[0].sourceChannels, [CHANNELS.REFERENCED_SVG]);
  assert.strictEqual(report.items[0].enableCommand, 'codex login');
  assert.strictEqual(report.unknownReferences.length, 0);
  assert.strictEqual(report.errors.length, 0);
});
