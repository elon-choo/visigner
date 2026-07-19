'use strict';

const fs = require('fs');
const path = require('path');
const {
  DEFAULT_RECORDS_DIR,
  ROOT,
  collectEnvelopes,
  findRecordFiles,
  validateRecordFile,
} = require('./corpus-validate.js');

const OUTPUT_PATH = path.join(ROOT, 'references', 'corpus', 'corpus-index.json');
const MISS_MESSAGE = 'MISS — no corpus records found — this is a database miss, not an empty value; do not invent one.';
const OVERWRITE_MESSAGE = (file) => `REFUSING — output already exists: ${file}; skipped without --force (non-destructive overwrite guard).`;

function readPath(object, dottedPath) {
  return dottedPath.split('.').reduce((current, key) => (current ? current[key] : undefined), object);
}

function compactEnvelope(envelope) {
  if (!envelope) return null;
  return {
    value: envelope.value,
    provenance: envelope.provenance,
    confidence: envelope.confidence,
    evidence: envelope.evidence,
    gap: envelope.gap,
  };
}

function collectGapIds(record) {
  return Array.from(new Set(collectEnvelopes(record)
    .map((item) => item.envelope.gap)
    .filter((gap) => typeof gap === 'string' && /^GAP-\d+$/u.test(gap))))
    .sort();
}

function gateGradeFieldCount(record) {
  return collectEnvelopes(record).filter((item) => item.envelope.value !== null
    && ['capture-json', 'bodytext', 'derived'].includes(item.envelope.provenance)).length;
}

function indexRecord(record) {
  const signalPaths = {
    awareness: 'commerce.awareness',
    sophistication: 'commerce.sophistication',
    layout_archetype: 'layout.archetype',
    arc_coverage: 'commerce.arc_coverage',
    text_density: 'rhythm.text_density',
    image_density: 'rhythm.image_density',
    urgency_device: 'commerce.urgency_device',
    urgency_repetition: 'commerce.urgency_repetition',
    signature_family: 'signature.family',
    field_committed: 'palette.roles.field_committed',
  };
  const signals = Object.fromEntries(Object.entries(signalPaths)
    .map(([key, source]) => [key, compactEnvelope(readPath(record, source))]));

  return {
    id: record.id,
    schema_version: record.schema_version,
    capture_dir: record.capture_dir,
    url: record.url,
    title: record.title,
    family: record.family,
    mode: record.mode,
    category: record.category,
    exemplar_role: record.exemplar_role,
    sector: record.sector,
    locale: record.locale,
    capture: {
      coverage_ok: compactEnvelope(readPath(record, 'capture.coverage_ok')),
      color_fidelity: compactEnvelope(readPath(record, 'capture.color_fidelity')),
      page_height_px: compactEnvelope(readPath(record, 'capture.page_height_px')),
      tile_count: compactEnvelope(readPath(record, 'capture.tile_count')),
    },
    retrieval: {
      signals,
      signature: {
        name: compactEnvelope(readPath(record, 'signature.name')),
        family: compactEnvelope(readPath(record, 'signature.family')),
        description: compactEnvelope(readPath(record, 'signature.description')),
        evidence_tiles: compactEnvelope(readPath(record, 'signature.evidence_tiles')),
        tell_risk: compactEnvelope(readPath(record, 'signature.tell_risk')),
        recurrence: compactEnvelope(readPath(record, 'signature.recurrence')),
      },
      palette_roles: {
        dominant_60: compactEnvelope(readPath(record, 'palette.roles.dominant_60')),
        secondary_30: compactEnvelope(readPath(record, 'palette.roles.secondary_30')),
        accent_10: compactEnvelope(readPath(record, 'palette.roles.accent_10')),
        field_committed: compactEnvelope(readPath(record, 'palette.roles.field_committed')),
      },
      layout_archetype: compactEnvelope(readPath(record, 'layout.archetype')),
      commerce_arc: record.commerce && record.commerce.arc ? record.commerce.arc : [],
    },
    evidence: {
      gate_grade_field_count: gateGradeFieldCount(record),
      gap_ids: collectGapIds(record),
    },
  };
}

function buildIndex(recordsDir = DEFAULT_RECORDS_DIR) {
  const files = findRecordFiles(recordsDir);
  if (!files.length) throw new Error(`${MISS_MESSAGE} No record.json files found in ${recordsDir}`);
  const records = files.map((file) => {
    const validation = validateRecordFile(file);
    if (validation.errors.length) {
      throw new Error('Refusing to index invalid record ' + path.relative(ROOT, file) + '\n'
        + validation.errors.map((error) => error.message).join('\n'));
    }
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }).sort((left, right) => left.id.localeCompare(right.id));

  const versions = Array.from(new Set(records.map((record) => record.schema_version)));
  return {
    index_version: '1.0.0',
    schema_version: versions.length === 1 ? versions[0] : null,
    generated_at: new Date().toISOString(),
    source: path.relative(ROOT, recordsDir),
    record_count: records.length,
    records: records.map(indexRecord),
  };
}

function writeIndex(recordsDir = DEFAULT_RECORDS_DIR, outputPath = OUTPUT_PATH, options = {}) {
  const index = buildIndex(recordsDir);
  if (fs.existsSync(outputPath) && options.force !== true) {
    return { index, outputPath, skipped: true, message: OVERWRITE_MESSAGE(outputPath) };
  }
  fs.writeFileSync(outputPath, JSON.stringify(index, null, 2) + '\n');
  return { index, outputPath, skipped: false };
}

function runCli() {
  if (process.argv[2] !== 'build') {
    console.error('Usage: node scripts/corpus-index.js build [--out <path>] [--force]');
    process.exitCode = 1;
    return;
  }
  let outputPath = OUTPUT_PATH;
  let force = false;
  for (let index = 3; index < process.argv.length; index += 1) {
    const flag = process.argv[index];
    if (flag === '--force' && !force) {
      force = true;
      continue;
    }
    if (flag === '--out' && process.argv[index + 1] && outputPath === OUTPUT_PATH) {
      outputPath = path.resolve(process.argv[index + 1]);
      index += 1;
      continue;
    }
    console.error('Usage: node scripts/corpus-index.js build [--out <path>] [--force]');
    process.exitCode = 1;
    return;
  }
  try {
    const result = writeIndex(DEFAULT_RECORDS_DIR, outputPath, { force });
    if (result.skipped) console.error(result.message);
    console.log('Built ' + path.relative(ROOT, result.outputPath)
      + ' from ' + result.index.record_count + ' record(s).');
  } catch (error) {
    console.error('FAIL — ' + error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) runCli();

module.exports = {
  MISS_MESSAGE,
  OUTPUT_PATH,
  OVERWRITE_MESSAGE,
  buildIndex,
  indexRecord,
  writeIndex,
};
