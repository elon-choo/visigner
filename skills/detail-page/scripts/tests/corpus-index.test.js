'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const INDEXER = path.join(ROOT, 'scripts', 'corpus-index.js');
const VALIDATOR = path.join(ROOT, 'scripts', 'corpus-validate.js');
const INDEX_PATH = path.join(ROOT, 'references', 'corpus', 'corpus-index.json');
const REAL_RECORD = path.join(ROOT, 'references', 'corpus', 'records', '400620', 'record.json');
const FIXTURES = path.join(__dirname, 'fixtures');

function run(script, argument) {
  return childProcess.spawnSync(process.execPath, [script, argument], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 10_000,
  });
}

test('corpus index has the librarian shape and each envelope tripwire bites', () => {
  // The corpus is designed to grow (Stage 2 targets >=120 exemplars), so assert the index's SHAPE
  // against the records actually on disk rather than a frozen count. A literal count here fails the
  // moment a real record is added -- which is the corpus working, not a regression.
  const recordsDir = path.join(ROOT, 'references', 'corpus', 'records');
  const onDisk = fs
    .readdirSync(recordsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(recordsDir, e.name, 'record.json'))).length;

  const build = run(INDEXER, 'build');
  assert.strictEqual(build.status, 0, build.stderr);
  assert.match(build.stdout, new RegExp(`Built references/corpus/corpus-index\\.json from ${onDisk} record\\(s\\)\\.`, 'u'));

  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  assert.deepStrictEqual(Object.keys(index).sort(), [
    'generated_at',
    'index_version',
    'record_count',
    'records',
    'schema_version',
    'source',
  ]);
  assert.strictEqual(index.index_version, '1.0.0');
  assert.strictEqual(index.schema_version, '1.0.0');
  assert.strictEqual(index.source, 'references/corpus/records');
  assert.strictEqual(index.record_count, onDisk);
  assert.strictEqual(index.records.length, onDisk);

  // 400620 is the hand-validated reference record; assert it is PRESENT rather than assuming a position.
  const record = index.records.find((r) => r.id === '400620');
  assert.ok(record, 'the 400620 reference record must be present in the index');
  assert.strictEqual(record.exemplar_role, 'negative');
  assert.ok(JSON.stringify(index).includes('exemplar_role'), 'index must project exemplar_role for librarian filtering');
  assert.deepStrictEqual(Object.keys(record.retrieval).sort(), [
    'commerce_arc',
    'layout_archetype',
    'palette_roles',
    'signals',
    'signature',
  ]);
  assert.strictEqual(record.retrieval.signals.urgency_device.value, '⏰오늘 23:59 완전 종료‼️잠시후 진짜 마지막입니다.');
  assert.strictEqual(record.retrieval.signals.signature_family.provenance, 'tile-vision');
  assert.strictEqual(record.capture.coverage_ok.value, true);
  assert.ok(record.evidence.gate_grade_field_count > 0);
  assert.ok(record.evidence.gap_ids.includes('GAP-01'));

  const real = run(VALIDATOR, path.relative(ROOT, REAL_RECORD));
  assert.strictEqual(real.status, 0, real.stderr);
  assert.match(real.stdout, /all nine invariants/u);

  const cases = [
    ['corpus-invalid-class.json', [7]],
    ['corpus-invalid-evidence.json', [8]],
    ['corpus-invalid-provenance.json', [1, 9]],
    ['corpus-invalid-dom.json', [5]],
  ];
  for (const [fixture, expectedInvariants] of cases) {
    const result = run(VALIDATOR, path.relative(ROOT, path.join(FIXTURES, fixture)));
    assert.strictEqual(result.status, 1, fixture);
    for (const invariant of expectedInvariants) {
      assert.match(result.stderr, new RegExp('\\[invariant ' + invariant + '\\]'));
    }
    const found = Array.from(result.stderr.matchAll(/\[invariant (\d+)\]/gu), (match) => Number(match[1]));
    assert.deepStrictEqual(found, expectedInvariants, fixture);
  }

  const invalidRole = run(VALIDATOR, path.relative(ROOT, path.join(FIXTURES, 'corpus-invalid-exemplar-role.json')));
  assert.strictEqual(invalidRole.status, 1, invalidRole.stderr);
  assert.match(invalidRole.stderr, /\[schema\] exemplar_role — must be one of positive, negative, neutral/u);
});
