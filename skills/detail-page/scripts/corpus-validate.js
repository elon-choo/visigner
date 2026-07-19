'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_RECORDS_DIR = path.join(ROOT, 'references', 'corpus', 'records');
const TAXONOMY_PATH = path.join(ROOT, 'references', 'corpus', 'TAXONOMY.md');
const MISS_MESSAGE = 'MISS — no corpus records found — this is a database miss, not an empty value; do not invent one.';
const PROVENANCES = new Set([
  'capture-json',
  'bodytext',
  'derived',
  'tile-vision',
  'tile-px',
  'styles-json',
  'dom',
  'hand',
]);
const CLASS_PROVENANCE = Object.freeze({
  A: new Set(['capture-json', 'bodytext', 'derived']),
  'A+': new Set(['tile-px']),
  B: new Set(['tile-vision']),
  C: new Set(['styles-json', 'dom']),
  D: new Set(['hand']),
});
const EXEMPLAR_ROLES = new Set(['positive', 'negative', 'neutral']);

// This is the field/class contract from SCHEMA.md §§4–5. Taxonomy values
// are deliberately not listed here; TAXONOMY.md is read at runtime instead.
const FIELD_CLASSES = Object.freeze({
  'capture.page_height_px': 'A',
  'capture.body_text_len': 'A',
  'capture.image_count': 'A',
  'capture.big_images': 'A',
  'capture.tile_count': 'A',
  'capture.tile_w_px': 'A',
  'capture.tile_h_px': 'A',
  'capture.tile_format': 'A',
  'capture.tile_scale': 'A',
  'capture.covered_height_px': 'A',
  'capture.coverage_ok': 'A',
  'capture.color_fidelity': 'A',
  'capture.has_dom': 'A',
  'palette.roles.dominant_60': 'B',
  'palette.roles.secondary_30': 'B',
  'palette.roles.accent_10': 'B',
  'palette.roles.field_committed': 'B',
  'palette.roles.field_evidence': 'B',
  'palette.roles.field_sections': 'B',
  'palette.temperature': 'B',
  'palette.computed_backgrounds': 'C',
  'palette.ramp[].hex_approx': 'B',
  'palette.chroma_max_measured': 'A+',
  'palette.chrome_excluded': 'D',
  'type.display.family': 'C',
  'type.display.weights': 'C',
  'type.body.family': 'C',
  'type.body.weights': 'C',
  'type.mono.family': 'C',
  'type.scale_px': 'C',
  'type.pairing_note': 'B',
  'type.weight_contrast_observed': 'B',
  'type.kr_display_present': 'B',
  'layout.archetype': 'B',
  'layout.content_width_px': 'B',
  'layout.column_system': 'B',
  'layout.primitive_repeated': 'B',
  'rhythm.band_count': 'B',
  'rhythm.median_band_height_px': 'A',
  'rhythm.viewports': 'A',
  'rhythm.text_density': 'A',
  'rhythm.image_density': 'A',
  'rhythm.spacing_scale_px': 'C',
  'rhythm.radius_scale_px': 'C',
  'signature.name': 'B',
  'signature.family': 'B',
  'signature.description': 'B',
  'signature.evidence_tiles': 'B',
  'signature.embodies_brief': 'D',
  'signature.tell_risk': 'D',
  'signature.recurrence': 'B',
  'motion.gif_asset_count': 'A',
  'motion.gif_evidence': 'A',
  'motion.dynamic_demo_present': 'A',
  'motion.notes': 'D',
  'motion.durations_ms': 'C',
  'motion.easings': 'C',
  'motion.reduced_motion_honored': 'C',
  'commerce.awareness': 'D',
  'commerce.sophistication': 'D',
  'commerce.arc_resolved': 'A',
  'commerce.arc_total': 'A',
  'commerce.arc_coverage': 'A',
  'commerce.authority_numbers': 'A',
  'commerce.reward_ladder': 'B',
  'commerce.urgency_device': 'A',
  'commerce.urgency_repetition': 'A',
  'commerce.one_message': 'D',
});

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normaliseEnvelopePath(parts) {
  return parts.map((part) => (typeof part === 'number' ? '[]' : part)).join('.')
    .replace(/\.\[\]/gu, '[]');
}

function collectEnvelopes(value, parts = [], found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectEnvelopes(item, parts.concat(index), found));
    return found;
  }
  if (!isObject(value)) return found;

  const envelopeKeys = ['value', 'provenance', 'confidence', 'evidence', 'gap'];
  if (Object.prototype.hasOwnProperty.call(value, 'value')
      && envelopeKeys.some((key) => Object.prototype.hasOwnProperty.call(value, key))) {
    found.push({ path: normaliseEnvelopePath(parts), envelope: value });
    return found;
  }

  Object.entries(value).forEach(([key, child]) => collectEnvelopes(child, parts.concat(key), found));
  return found;
}

function findRecordFiles(target) {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return target.endsWith('.json') ? [target] : [];
  return fs.readdirSync(target, { withFileTypes: true })
    .flatMap((entry) => findRecordFiles(path.join(target, entry.name)))
    .filter((file) => path.basename(file) === 'record.json')
    .sort();
}

function safeCaptureArtifact(record, name) {
  if (!record || typeof record.capture_dir !== 'string') return null;
  const captureRoot = path.resolve(ROOT, 'references', record.capture_dir);
  const artifact = path.resolve(captureRoot, name);
  if (artifact !== captureRoot && !artifact.startsWith(captureRoot + path.sep)) return null;
  return artifact;
}

function stylesArtifact(record) {
  const override = record && Object.getOwnPropertyDescriptor(record, '__stylesJsonPath');
  if (override && override.enumerable === false && typeof override.value === 'string') {
    return override.value;
  }
  return safeCaptureArtifact(record, 'styles.json');
}

function unescapeJsonPointerSegment(segment) {
  return segment.replace(/~1/gu, '/').replace(/~0/gu, '~');
}

function resolveJsonPointer(value, pointer) {
  if (pointer === '') return { found: true, value };
  if (!pointer.startsWith('/')) return { found: false };
  let cursor = value;
  for (const rawSegment of pointer.slice(1).split('/')) {
    const segment = unescapeJsonPointerSegment(rawSegment);
    if (Array.isArray(cursor) && /^(0|[1-9]\d*)$/u.test(segment)) {
      cursor = cursor[Number(segment)];
    } else if (isObject(cursor) && Object.prototype.hasOwnProperty.call(cursor, segment)) {
      cursor = cursor[segment];
    } else {
      return { found: false };
    }
  }
  return { found: true, value: cursor };
}

function normaliseText(value) {
  return String(value).replace(/\s+/gu, '');
}

function isEllipsisSummary(value) {
  return typeof value === 'string' && /^…\d+\smore…$/u.test(value);
}

function sameScalar(left, right) {
  if (typeof left === 'string' && typeof right === 'string') {
    return normaliseText(left) === normaliseText(right);
  }
  return left === right;
}

function containsRecordedValue(source, expected) {
  if (Array.isArray(expected)) {
    const concrete = expected.filter((item) => !isEllipsisSummary(item));
    return concrete.length > 0
      && concrete.every((item) => containsRecordedValue(source, item));
  }
  if (Array.isArray(source)) return source.some((item) => containsRecordedValue(item, expected));
  if (isObject(source)) return Object.values(source).some((item) => containsRecordedValue(item, expected));
  return sameScalar(source, expected);
}

function bodytextHasValue(text, expected) {
  if (Array.isArray(expected)) return expected.every((item) => bodytextHasValue(text, item));
  if (typeof expected !== 'string') return false;
  return normaliseText(text).includes(normaliseText(expected));
}

function parseLineRanges(spec) {
  const ranges = [];
  for (const item of spec.split(',')) {
    const match = item.match(/^L(\d+)(?:-L?(\d+))?$/u);
    if (!match) return null;
    const first = Number(match[1]);
    const last = Number(match[2] || match[1]);
    if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first < 1 || last < first) return null;
    ranges.push([first, last]);
  }
  return ranges;
}

function citedBodytext(record, filename, rangeSpec) {
  if (filename !== 'bodytext.txt') return { ok: false, detail: 'bodytext evidence must cite bodytext.txt' };
  const artifact = safeCaptureArtifact(record, filename);
  if (!artifact || !fs.existsSync(artifact)) return { ok: false, detail: 'cited bodytext artifact does not exist' };
  const lines = fs.readFileSync(artifact, 'utf8').split(/\r?\n/u);
  if (!rangeSpec) return { ok: true, text: lines.join('\n') };
  const ranges = parseLineRanges(rangeSpec);
  if (!ranges) return { ok: false, detail: 'invalid bodytext line range' };
  const selected = [];
  for (const [first, last] of ranges) {
    if (last > lines.length) return { ok: false, detail: 'bodytext line range exceeds file length' };
    selected.push(...lines.slice(first - 1, last));
  }
  return { ok: true, text: selected.join('\n') };
}

function resolveGateEvidence(record, envelope) {
  const evidence = envelope.evidence;
  if (typeof evidence !== 'string' || evidence.trim() === '') {
    return { ok: false, detail: 'evidence is missing' };
  }

  const jsonMatch = evidence.match(/(?:^|[\s(])([A-Za-z0-9_.-]+\.json)#(\/[^\s—]+)/u);
  if (jsonMatch) {
    const filename = jsonMatch[1];
    if (filename !== 'data.json' && filename !== 'capture.json') {
      return { ok: false, detail: 'capture-json evidence must cite data.json or capture.json' };
    }
    const artifact = safeCaptureArtifact(record, filename);
    if (!artifact || !fs.existsSync(artifact)) return { ok: false, detail: 'cited JSON artifact does not exist' };
    let json;
    try {
      json = JSON.parse(fs.readFileSync(artifact, 'utf8'));
    } catch (error) {
      return { ok: false, detail: 'cited JSON artifact cannot be parsed' };
    }
    const pointed = resolveJsonPointer(json, jsonMatch[2]);
    if (!pointed.found) return { ok: false, detail: 'JSON pointer does not resolve' };
    if (!containsRecordedValue(pointed.value, envelope.value)) {
      return { ok: false, detail: 'recorded value is absent from the cited JSON pointer' };
    }
    return { ok: true };
  }

  const textMatch = evidence.match(/(?:^|[\s(])([A-Za-z0-9_.-]+\.txt)(?::(L\d+(?:-L?\d+)?(?:,L\d+(?:-L?\d+)?)*))?/u);
  if (!textMatch) return { ok: false, detail: 'evidence names neither a JSON pointer nor a bodytext artifact' };
  const cited = citedBodytext(record, textMatch[1], textMatch[2]);
  if (!cited.ok) return cited;
  if (!bodytextHasValue(cited.text, envelope.value)) {
    return { ok: false, detail: 'recorded value is absent from the cited bodytext location' };
  }
  return { ok: true };
}

function stylesPointerFromEvidence(evidence) {
  if (typeof evidence !== 'string') return null;
  const match = evidence.match(/(?:^|[\s(])(styles\.json)#(\/[^\s—]+)/u);
  return match ? match[2] : null;
}

function readStyles(record) {
  const artifact = stylesArtifact(record);
  if (!artifact || !fs.existsSync(artifact)) {
    return { ok: false, detail: 'cited styles.json artifact does not exist' };
  }
  try {
    return { ok: true, json: JSON.parse(fs.readFileSync(artifact, 'utf8')) };
  } catch (error) {
    return { ok: false, detail: 'cited styles.json artifact cannot be parsed' };
  }
}

function sameJsonValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function resolveStylesEvidence(record, recordPath, envelope) {
  const pointer = stylesPointerFromEvidence(envelope.evidence);
  if (pointer === null) return { ok: false, detail: 'styles-json evidence must cite styles.json#/…' };
  const styles = readStyles(record);
  if (!styles.ok) return styles;
  const pointed = resolveJsonPointer(styles.json, pointer);
  if (!pointed.found) return { ok: false, detail: 'styles.json JSON pointer does not resolve' };
  if (!sameJsonValue(pointed.value, envelope.value)) {
    return { ok: false, detail: 'recorded value does not exactly match the cited styles.json pointer' };
  }
  return { ok: true, styles: styles.json };
}

function hasDerivedFormula(evidence) {
  if (typeof evidence !== 'string' || evidence.trim() === '') return false;
  return /(?:count|regex|header|jfif|entries|viewer|pasona|baseline|downscale|format|[=><÷×/+*])/iu.test(evidence);
}

function issue(errors, recordPath, invariant, fieldPath, detail) {
  errors.push({
    invariant,
    fieldPath,
    detail,
    message: recordPath + ': [invariant ' + invariant + '] ' + fieldPath + ' — ' + detail,
  });
}

function taxonomyStatus() {
  if (!fs.existsSync(TAXONOMY_PATH)) return { state: 'taxonomy-unresolved', dimensions: {} };
  const text = fs.readFileSync(TAXONOMY_PATH, 'utf8');
  const dimensions = {};
  const sections = [
    ['category', /^## 1 · .*$/mu],
    ['layout_archetype', /^## 2 · .*$/mu],
    ['pasona_stage', /^### 7\.3 .*$/mu],
    ['awareness', /^### 7\.4 .*$/mu],
  ];
  for (const [name, heading] of sections) {
    const match = text.match(heading);
    if (!match || match.index === undefined) continue;
    const after = text.slice(match.index + match[0].length);
    const next = after.search(/\n#{2,3} /u);
    const section = next < 0 ? after : after.slice(0, next);
    dimensions[name] = new Set(Array.from(section.matchAll(/\x60([a-z][a-z0-9-]*)\x60/gu), (entry) => entry[1]));
  }
  const shelfValues = new Set(Array.from(text.matchAll(/^### 6\.\d+ Shelf \x60([a-z-]+)\x60/gmu), (entry) => entry[1]));
  if (shelfValues.size) dimensions.signature_family = shelfValues;
  return { state: 'loaded', dimensions };
}

function validateTaxonomyShape(record) {
  const taxonomy = taxonomyStatus();
  const unresolved = [];
  if (taxonomy.state !== 'loaded') return { taxonomy, unresolved: ['all taxonomy fields'] };
  const checks = [
    ['category', record.category, 'category'],
    ['layout.archetype', record.layout && record.layout.archetype && record.layout.archetype.value, 'layout_archetype'],
    ['commerce.awareness', record.commerce && record.commerce.awareness && record.commerce.awareness.value, 'awareness'],
    ['signature.family', record.signature && record.signature.family && record.signature.family.value, 'signature_family'],
  ];
  for (const [field, value, dimension] of checks) {
    if (value === null || value === undefined) continue;
    if (typeof value !== 'string' || !taxonomy.dimensions[dimension]
        || !taxonomy.dimensions[dimension].has(value)) {
      unresolved.push(field);
    }
  }
  return { taxonomy, unresolved };
}

function requiresExemplarRole(recordPath) {
  const corpusRoot = path.resolve(DEFAULT_RECORDS_DIR);
  const candidate = path.resolve(ROOT, recordPath);
  return candidate.startsWith(corpusRoot + path.sep);
}

function validateExemplarRole(record, recordPath, errors) {
  // SCHEMA.md §4 keeps curation decisions bare rather than enveloped. This
  // class-D / hand decision is required on corpus records and always uses its closed set.
  const hasRole = Object.prototype.hasOwnProperty.call(record, 'exemplar_role');
  if (!hasRole && requiresExemplarRole(recordPath)) {
    errors.push({
      invariant: 'schema',
      fieldPath: 'exemplar_role',
      detail: 'required bare curation field is missing',
      message: recordPath + ': [schema] exemplar_role — required bare curation field is missing',
    });
  } else if (hasRole && !EXEMPLAR_ROLES.has(record.exemplar_role)) {
    errors.push({
      invariant: 'schema',
      fieldPath: 'exemplar_role',
      detail: 'must be one of positive, negative, neutral',
      message: recordPath + ': [schema] exemplar_role — must be one of positive, negative, neutral',
    });
  }
}

function validateRecord(record, recordPath = '<record>') {
  const errors = [];
  validateExemplarRole(record, recordPath, errors);
  const envelopes = collectEnvelopes(record);

  for (const item of envelopes) {
    const fieldPath = item.path;
    const envelope = item.envelope;
    const required = ['value', 'provenance', 'confidence', 'evidence', 'gap'];
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(envelope, key)) {
        errors.push({
          invariant: 'schema',
          fieldPath,
          detail: 'envelope is missing ' + key,
          message: recordPath + ': [schema] ' + fieldPath + ' — envelope is missing ' + key,
        });
      }
    }

    const provenance = envelope.provenance;
    const value = envelope.value;
    const confidence = envelope.confidence;
    const evidence = envelope.evidence;
    const gap = envelope.gap;
    const fieldClass = FIELD_CLASSES[fieldPath];

    if (!PROVENANCES.has(provenance)) {
      issue(errors, recordPath, 1, fieldPath, 'provenance is not in the allowed enum');
    }
    if (value === null && (gap === null || gap === undefined || gap === '')) {
      issue(errors, recordPath, 2, fieldPath, 'null value has no named gap');
    }
    if (provenance === 'hand' && (typeof evidence !== 'string' || evidence.trim() === '')) {
      issue(errors, recordPath, 3, fieldPath, 'hand provenance requires evidence');
    }
    if (provenance === 'derived' && value !== null && !hasDerivedFormula(evidence)) {
      issue(errors, recordPath, 4, fieldPath, 'derived provenance requires a formula-bearing evidence string');
    }
    if ((provenance === 'dom' || provenance === 'tile-px') && value !== null) {
      issue(errors, recordPath, 5, fieldPath, provenance + ' fields must be null for this corpus');
    }
    if (provenance === 'styles-json' && value !== null) {
      const pointer = stylesPointerFromEvidence(evidence);
      const styles = readStyles(record);
      if (pointer === null) {
        issue(errors, recordPath, 5, fieldPath, 'styles-json values must cite styles.json#/…');
      } else if (!styles.ok) {
        issue(errors, recordPath, 5, fieldPath, styles.detail);
      } else if (!styles.json.authoredRegion || styles.json.authoredRegion.verdict !== 'dom-authored') {
        issue(errors, recordPath, 5, fieldPath, 'styles-json values require authoredRegion.verdict === "dom-authored"');
      }
    }
    if (value === null && confidence !== null) {
      issue(errors, recordPath, 6, fieldPath, 'null value must carry null confidence');
    }
    if (value !== null && (provenance === 'tile-vision' || provenance === 'hand')
        && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
      issue(errors, recordPath, 6, fieldPath, provenance + ' requires confidence from 0 to 1');
    }
    if (value !== null && (provenance === 'capture-json' || provenance === 'bodytext' || provenance === 'derived' || provenance === 'styles-json')
        && confidence !== null) {
      issue(errors, recordPath, 6, fieldPath, provenance + ' must carry null confidence');
    }
    if (!fieldClass) {
      errors.push({
        invariant: 'schema',
        fieldPath,
        detail: 'envelope field is not mapped to a SCHEMA.md fillability class',
        message: recordPath + ': [schema] ' + fieldPath + ' — envelope field is not mapped to a SCHEMA.md fillability class',
      });
    } else if (provenance !== null && !CLASS_PROVENANCE[fieldClass].has(provenance)) {
      issue(errors, recordPath, 7, fieldPath, 'class ' + fieldClass + ' does not allow provenance ' + provenance);
    }
    if ((provenance === 'bodytext' || provenance === 'capture-json') && value !== null) {
      const resolved = resolveGateEvidence(record, envelope);
      if (!resolved.ok) issue(errors, recordPath, 8, fieldPath, resolved.detail);
    }
    if (value !== null && (provenance === null || provenance === undefined || evidence === null || evidence === undefined)) {
      issue(errors, recordPath, 9, fieldPath, 'non-null value requires non-null provenance and evidence');
    }
    if (provenance === 'styles-json' && value !== null) {
      const resolved = resolveStylesEvidence(record, recordPath, envelope);
      if (!resolved.ok) issue(errors, recordPath, 10, fieldPath, resolved.detail);
    }
  }

  return {
    errors,
    envelopes,
    taxonomy: validateTaxonomyShape(record),
  };
}

function readRecord(recordPath) {
  return JSON.parse(fs.readFileSync(recordPath, 'utf8'));
}

function validateRecordFile(recordPath) {
  try {
    return validateRecord(readRecord(recordPath), path.relative(ROOT, recordPath));
  } catch (error) {
    return {
      errors: [{
        invariant: 'schema',
        fieldPath: '<record>',
        detail: error.message,
        message: path.relative(ROOT, recordPath) + ': [schema] <record> — ' + error.message,
      }],
      envelopes: [],
      taxonomy: taxonomyStatus(),
    };
  }
}

function runCli() {
  const targets = process.argv.slice(2);
  const files = (targets.length ? targets : [DEFAULT_RECORDS_DIR])
    .flatMap((target) => findRecordFiles(path.resolve(process.cwd(), target)));
  if (!files.length) {
    console.error('FAIL — ' + MISS_MESSAGE + ' No record.json files found');
    process.exitCode = 1;
    return;
  }

  let failures = 0;
  let envelopeCount = 0;
  for (const file of files) {
    const result = validateRecordFile(file);
    envelopeCount += result.envelopes.length;
    const relative = path.relative(ROOT, file);
    if (result.errors.length) {
      failures += result.errors.length;
      console.error('FAIL ' + relative);
      result.errors.forEach((error) => console.error(error.message));
    } else {
      const unresolved = result.taxonomy.unresolved.length;
      console.log('PASS ' + relative + ' — ' + result.envelopes.length
        + ' envelopes; taxonomy=' + result.taxonomy.taxonomy.state
        + '; taxonomy-unresolved=' + unresolved);
    }
  }
  if (failures) {
    console.error('FAIL — ' + failures + ' validation error(s) across ' + files.length + ' record(s)');
    process.exitCode = 1;
  } else {
    console.log('PASS — ' + files.length + ' record(s), ' + envelopeCount + ' envelope(s), all ten invariants (all nine invariants preserved)');
  }
}

if (require.main === module) runCli();

module.exports = {
  CLASS_PROVENANCE,
  DEFAULT_RECORDS_DIR,
  EXEMPLAR_ROLES,
  FIELD_CLASSES,
  MISS_MESSAGE,
  ROOT,
  collectEnvelopes,
  findRecordFiles,
  resolveGateEvidence,
  resolveStylesEvidence,
  validateRecord,
  validateRecordFile,
};
