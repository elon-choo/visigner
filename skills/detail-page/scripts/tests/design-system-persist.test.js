'use strict';

const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const { persistDesignSystem, validateSegment } = require(path.join(ROOT, 'scripts', 'design-system-persist.js'));

function config(overrides = {}) {
  return {
    slug: 'golden-system',
    master: {
      palette: 'ink, cream, and electric blue',
      typePairing: 'Manrope + IBM Plex Mono',
      spacingScale: '4, 8, 16, 24, 40, 64',
      signatureElement: 'offset cobalt rule',
    },
    page: {
      name: 'pricing',
      overrides: { palette: 'midnight, mist, and lime', ...overrides },
    },
  };
}

test('design-system persistence is non-destructive until force and writes an exact override header', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-design-system-persist-'));
  const first = persistDesignSystem(config(), directory);
  const masterPath = path.join(directory, 'golden-system', 'MASTER.md');
  const pagePath = path.join(directory, 'golden-system', 'pages', 'pricing.md');

  assert.strictEqual(first.status, 'written');
  assert.match(first.message, /^CREATED MASTER:/mu);
  assert.ok(fs.existsSync(masterPath));
  assert.ok(fs.existsSync(pagePath));
  assert.match(fs.readFileSync(pagePath, 'utf8'), /master_overrides:\n  - palette\n---/u);

  const before = fs.readFileSync(masterPath);
  const second = persistDesignSystem(config({ 'signature-element': 'lime corner notch' }), directory);
  assert.strictEqual(second.status, 'skipped');
  assert.match(second.message, /^SKIP: MASTER already exists .*--force/u);
  assert.deepStrictEqual(fs.readFileSync(masterPath), before, 'a non-forced run must leave MASTER byte-identical');

  const forceConfig = config();
  forceConfig.master.palette = 'warm graphite, fog, and orange';
  const forced = persistDesignSystem({ ...forceConfig, force: true }, directory);
  assert.strictEqual(forced.status, 'written');
  assert.match(forced.message, /^OVERWROTE MASTER:/mu);
  assert.match(fs.readFileSync(masterPath, 'utf8'), /warm graphite, fog, and orange/u);
});

test('page-only persist keeps an existing MASTER byte-identical and only adds the new page', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-design-system-persist-'));
  const first = persistDesignSystem(config(), directory);
  assert.strictEqual(first.status, 'written');
  const masterPath = path.join(directory, 'golden-system', 'MASTER.md');
  const masterShaBefore = crypto.createHash('sha256').update(fs.readFileSync(masterPath)).digest('hex');

  // No master values supplied: MASTER exists, so this is a page-only persist.
  const pageOnly = persistDesignSystem({
    slug: 'golden-system',
    page: { name: 'checkout', overrides: { 'signature-element': 'dotted coral rail' } },
  }, directory);
  assert.strictEqual(pageOnly.status, 'written');
  assert.match(pageOnly.message, /^KEPT MASTER:/mu);
  assert.match(pageOnly.message, /^CREATED PAGE:/mu);
  const checkoutPath = path.join(directory, 'golden-system', 'pages', 'checkout.md');
  assert.ok(fs.existsSync(checkoutPath));
  assert.match(fs.readFileSync(checkoutPath, 'utf8'), /master_overrides:\n  - signature-element\n---/u);
  const masterShaAfter = crypto.createHash('sha256').update(fs.readFileSync(masterPath)).digest('hex');
  assert.strictEqual(masterShaAfter, masterShaBefore, 'page-only persist must leave MASTER byte-identical');

  // Without an existing MASTER, page-only input is an explicit error, not a silent creation.
  const emptyDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-design-system-persist-'));
  assert.throws(() => persistDesignSystem({
    slug: 'golden-system',
    page: { name: 'checkout', overrides: { palette: 'x' } },
  }, emptyDirectory), /page-only persist requires an existing MASTER/u);
});

test('slug and page names reject traversal, absolute paths, backslashes, null bytes, and controls', () => {
  for (const unsafe of ['../evil', '/tmp/evil', 'C:\\evil', 'safe\\evil', 'bad\u0000name', 'bad\nname', '']) {
    assert.throws(() => validateSegment(unsafe, 'slug'), /Invalid slug/u, unsafe);
  }
  assert.throws(() => persistDesignSystem({ ...config(), page: { name: '../evil', overrides: { palette: 'x' } } }, os.tmpdir()), /Invalid page name/u);
});
