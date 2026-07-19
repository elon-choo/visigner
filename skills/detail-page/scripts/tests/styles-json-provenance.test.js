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

function envelope(value, evidence) {
  return { value, provenance: 'styles-json', confidence: null, evidence, gap: null };
}

test('styles-json values are exact collector reads behind the authored-region gate', () => {
  const linear = extract('dom-authored');
  const wadiz = extract('likely-platform-chrome');

  assert.deepStrictEqual(linear.type.display.family, envelope(
    'Inter Variable',
    'styles.json#/type/display/resolvedFamily',
  ));
  assert.deepStrictEqual(linear.palette.computed_backgrounds, envelope(
    [{ value: '#08090a', areaShare: 0.84 }],
    'styles.json#/color/backgrounds',
  ));
  assert.deepStrictEqual(validateRecord(linear).errors, []);

  assert.strictEqual(wadiz.type.display.family.value, null);
  assert.strictEqual(wadiz.type.display.family.gap, 'GAP-07');
  assert.strictEqual(wadiz.palette.computed_backgrounds.value, null);
  assert.strictEqual(wadiz.palette.computed_backgrounds.gap, 'GAP-07');
  assert.doesNotMatch(JSON.stringify(wadiz.palette), /#f2f5f8/u);
  assert.deepStrictEqual(validateRecord(wadiz).errors, []);
});

test('invariant 5 rejects styles-json values from likely platform chrome', () => {
  const record = extract('likely-platform-chrome');
  record.type.display.family = envelope('Pretendard', 'styles.json#/type/display/resolvedFamily');
  const result = validateRecord(record);
  assert.deepStrictEqual(result.errors.map((error) => error.invariant), [5]);
});

test('invariant 10 rejects a non-resolving styles-json pointer', () => {
  const record = extract('dom-authored');
  record.type.display.family = envelope('Inter Variable', 'styles.json#/type/display/not-there');
  const result = validateRecord(record);
  assert.deepStrictEqual(result.errors.map((error) => error.invariant), [10]);
});

test('M-1 ignores an enumerable __stylesJsonPath after JSON.parse', () => {
  const parsedDiskRecord = JSON.parse(JSON.stringify({
    capture_dir: 'captures/app-ui/linear',
    __stylesJsonPath: path.join(FIXTURES, 'attack-styles.json'),
    type: { display: { family: envelope('Wadiz Sans', 'styles.json#/type/display/resolvedFamily') } },
    palette: {
      computed_backgrounds: envelope(
        [{ value: '#f2f5f8', areaShare: 0.71 }],
        'styles.json#/color/backgrounds',
      ),
    },
  }));

  const result = validateRecord(parsedDiskRecord, path.join(FIXTURES, 'record.json'));
  assert.deepStrictEqual(result.errors.map((error) => error.invariant), [10, 10]);
});

test('M-2 rejects a sibling styles.json when capture_dir has none', () => {
  const record = {
    capture_dir: 'captures/400620',
    type: { display: { family: envelope('Inter Variable', 'styles.json#/type/display/resolvedFamily') } },
  };
  // This record path has a matching sibling styles.json. The cited artifact
  // must still be references/captures/400620/styles.json, which does not exist.
  const result = validateRecord(record, path.join(FIXTURES, 'dom-authored', 'tokens.json'));
  assert.deepStrictEqual(result.errors.map((error) => error.invariant), [5, 10]);
});
