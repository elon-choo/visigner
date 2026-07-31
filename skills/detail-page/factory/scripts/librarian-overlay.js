#!/usr/bin/env node
'use strict';

/*
 * Read-only extension of skills/detail-page/scripts/librarian.js.
 *
 * The established librarian owns brief normalisation, eligibility and
 * evidence-backed ranking.  This wrapper leaves it untouched, gives it a
 * temporary merged index (the 12-record corpus plus the 30-record overlay),
 * then joins returned records to the independently generated segment files.
 * A section-type filter is therefore a filter over captured span evidence,
 * never a guessed record tag.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CORE_INDEX_PATH = path.join(ROOT, 'skills', 'detail-page', 'references', 'corpus', 'corpus-index.json');
const OVERLAY_INDEX_PATH = path.join(ROOT, 'v3', 'corpus-overlay', 'overlay-index.json');
const SEGMENTS_DIR = path.join(ROOT, 'v3', 'segments');
const LIBRARIAN_PATH = path.join(ROOT, 'skills', 'detail-page', 'scripts', 'librarian.js');
const librarian = require(LIBRARIAN_PATH);

const SECTION_TYPES = new Set([
  'hero', 'proof', 'comparison', 'process', 'pricing', 'faq', 'cta',
  'gallery', 'feature', 'footer-band', 'unknown'
]);

function fail(message) {
  throw new Error(message);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`cannot read ${path.relative(ROOT, filePath)}: ${error.message}`);
  }
}

function readIndex(filePath) {
  const index = readJson(filePath);
  if (!index || !Array.isArray(index.records)) fail(`invalid index: ${path.relative(ROOT, filePath)}`);
  return index;
}

function loadMergedIndex() {
  const core = readIndex(CORE_INDEX_PATH);
  const overlay = readIndex(OVERLAY_INDEX_PATH);
  const sources = new Map();
  const records = [];
  for (const [source, index] of [['core', core], ['overlay', overlay]]) {
    for (const record of index.records) {
      if (!record || typeof record.id !== 'string' || !record.id.trim()) fail(`invalid ${source} record id`);
      if (sources.has(record.id)) fail(`duplicate record id across indexes: ${record.id}`);
      sources.set(record.id, source);
      records.push(record);
    }
  }
  records.sort((left, right) => left.id.localeCompare(right.id));
  return {
    index: {
      index_version: '1.0.0',
      schema_version: '1.0.0',
      generated_at: new Date().toISOString(),
      source: 'skills/detail-page/references/corpus/corpus-index.json + v3/corpus-overlay/overlay-index.json',
      record_count: records.length,
      records,
    },
    sources,
    counts: { core: core.records.length, overlay: overlay.records.length },
  };
}

function loadSegments() {
  if (!fs.existsSync(SEGMENTS_DIR)) fail(`missing segments directory: ${path.relative(ROOT, SEGMENTS_DIR)}`);
  const segments = new Map();
  for (const file of fs.readdirSync(SEGMENTS_DIR).filter((entry) => entry.endsWith('.json')).sort()) {
    const filePath = path.join(SEGMENTS_DIR, file);
    const document = readJson(filePath);
    if (!document || typeof document.record_id !== 'string' || !Array.isArray(document.spans)) {
      fail(`invalid segment document: ${path.relative(ROOT, filePath)}`);
    }
    if (segments.has(document.record_id)) fail(`duplicate segment record id: ${document.record_id}`);
    segments.set(document.record_id, { document, filePath });
  }
  return segments;
}

function parseK(value) {
  const k = Number(value);
  if (!Number.isInteger(k) || k < 1) fail('--k must be a positive integer');
  return k;
}

function usage() {
  return "Usage: node v3/scripts/librarian-overlay.js query '<brief-json>' [--section-type <type>] [--k <n>]";
}

function parseArguments(argv) {
  if (argv[0] !== 'query' || !argv[1]) fail(usage());
  let brief;
  try {
    brief = JSON.parse(argv[1]);
  } catch (error) {
    fail(`brief must be valid JSON: ${error.message}`);
  }
  let sectionType = null;
  let k = 3;
  for (let index = 2; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--section-type' && argv[index + 1] && sectionType === null) {
      sectionType = argv[index + 1];
      index += 1;
    } else if (flag === '--k' && argv[index + 1]) {
      k = parseK(argv[index + 1]);
      index += 1;
    } else {
      fail(usage());
    }
  }
  if (sectionType !== null && !SECTION_TYPES.has(sectionType)) {
    fail(`--section-type must be a SECTION-SCHEMA enum (got ${JSON.stringify(sectionType)})`);
  }
  return { brief, sectionType, k };
}

function withTemporaryIndex(index, callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-librarian-overlay-'));
  const indexPath = path.join(directory, 'merged-index.json');
  try {
    fs.writeFileSync(indexPath, `${JSON.stringify(index)}\n`, 'utf8');
    return callback(indexPath);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function makeMatch(candidate, source, segment, sectionType) {
  const matchedSpans = segment.document.spans
    .filter((span) => sectionType === null || span.type === sectionType)
    .map((span) => ({
      order: span.order,
      type: span.type,
      y_start: span.y_start,
      y_end: span.y_end,
      heading_text: span.heading_text,
      confidence: span.confidence,
    }));
  return {
    id: candidate.id,
    title: candidate.title || null,
    source,
    score: candidate.score,
    record_path: source === 'core'
      ? `skills/detail-page/references/corpus/records/${candidate.id}/record.json`
      : `v3/corpus-overlay/records/${candidate.id}/record.json`,
    segment_path: path.posix.join('v3', 'segments', path.basename(segment.filePath)),
    matching_span_count: matchedSpans.length,
    matching_spans: matchedSpans,
  };
}

function query(brief, options = {}) {
  const sectionType = options.sectionType || null;
  const k = options.k || 3;
  if (sectionType !== null && !SECTION_TYPES.has(sectionType)) fail(`unknown section type: ${sectionType}`);
  const merged = loadMergedIndex();
  const segments = loadSegments();
  const upstream = withTemporaryIndex(merged.index, (indexPath) =>
    // Ask the unmodified librarian for every eligible candidate before the
    // span-evidence filter; only the wrapper applies the optional type query.
    librarian.retrieve(brief, { indexPath, k: merged.index.record_count })
  );
  const applicable = upstream.matches
    .map((candidate) => ({ candidate, segment: segments.get(candidate.id) }))
    .filter(({ segment }) => segment && (sectionType === null || segment.document.spans.some((span) => span.type === sectionType)));
  const matchingSpanCount = applicable.reduce((total, { segment }) => total + segment.document.spans
    .filter((span) => sectionType === null || span.type === sectionType).length, 0);
  const matches = applicable
    .slice(0, k)
    .map(({ candidate, segment }) => makeMatch(candidate, merged.sources.get(candidate.id), segment, sectionType));
  return {
    librarian_source: path.relative(ROOT, LIBRARIAN_PATH),
    indexes: {
      core_records: merged.counts.core,
      overlay_records: merged.counts.overlay,
      merged_records: merged.index.record_count,
      segment_records: segments.size,
    },
    query: { brief, section_type: sectionType, k },
    upstream_retrieval_mode: upstream.retrievalMode,
    upstream_candidate_count: upstream.matches.length,
    matching_record_count: applicable.length,
    matching_span_count: matchingSpanCount,
    matches,
    note: matches.length ? null : (upstream.note || 'No matching captured spans found.'),
  };
}

function runCli(argv = process.argv.slice(2)) {
  try {
    const parsed = parseArguments(argv);
    console.log(JSON.stringify(query(parsed.brief, { sectionType: parsed.sectionType, k: parsed.k }), null, 2));
  } catch (error) {
    console.error(`FAIL — ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) runCli();

module.exports = {
  CORE_INDEX_PATH,
  OVERLAY_INDEX_PATH,
  SEGMENTS_DIR,
  SECTION_TYPES,
  loadMergedIndex,
  loadSegments,
  query,
};
