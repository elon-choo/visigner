'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_INDEX_PATH = path.join(ROOT, 'references', 'corpus', 'corpus-index.json');
const DEFAULT_K = 3;
const MISS_MESSAGE = 'MISS — no corpus match found — this is a database miss, not an empty value; do not invent one.';
const AWARENESS_ORDER = ['unaware', 'problem-aware', 'solution-aware', 'product-aware', 'most-aware'];

// These add up only within their respective dimensions. The evidence-backed
// signal weights are the values specified by SCHEMA.md §7; bare corpus tags
// get small weights so a partial brief can still be ranked deterministically.
const TAG_WEIGHTS = Object.freeze({
  mode: 0.20,
  category: 0.40,
  sector: 0.20,
  mood: 0.10,
  awareness: 0.10,
  sophistication: 0.10,
  layoutArchetype: 0.15,
  arcCoverage: 0.15,
  textDensity: 0.075,
  imageDensity: 0.075,
  urgencyDevice: 0.05,
  urgencyRepetition: 0.05,
  signatureFamily: 0.15,
  fieldCommitted: 0.10,
});

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function optionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function optionalNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function optionalBoolean(value) {
  return typeof value === 'boolean' ? value : null;
}

function normalizeMoods(brief) {
  const raw = Array.isArray(brief.moods) ? brief.moods : brief.mood;
  if (!Array.isArray(raw)) return [];
  return Array.from(new Set(raw.map(optionalString).filter(Boolean)));
}

function normalizeBrief(brief) {
  if (!isPlainObject(brief)) throw new TypeError('Brief must be a JSON object.');

  const intent = optionalString(brief.intent);
  const wantsAvoid = brief.whatToAvoid === true
    || intent === 'avoid'
    || intent === 'what-to-avoid';

  return {
    mode: optionalString(brief.mode),
    category: optionalString(brief.category),
    sector: optionalString(brief.sector),
    moods: normalizeMoods(brief),
    awareness: optionalString(brief.awareness),
    sophistication: optionalNumber(brief.sophistication),
    layoutArchetype: optionalString(brief.layout_archetype || brief.layoutArchetype),
    arcCoverage: optionalNumber(brief.arc_coverage ?? brief.arcCoverage),
    textDensity: optionalNumber(brief.text_density ?? brief.textDensity),
    imageDensity: optionalNumber(brief.image_density ?? brief.imageDensity),
    urgencyDevice: optionalBoolean(brief.urgency_device ?? brief.urgencyDevice),
    urgencyRepetition: optionalNumber(brief.urgency_repetition ?? brief.urgencyRepetition),
    signatureFamily: optionalString(brief.signature_family || brief.signatureFamily),
    fieldCommitted: optionalBoolean(brief.field_committed ?? brief.fieldCommitted),
    includeNeutral: brief.includeNeutral === true,
    wantsAvoid,
  };
}

function envelopeValue(envelope) {
  return envelope && envelope.value !== null && envelope.value !== undefined
    ? envelope.value
    : null;
}

function confidenceMultiplier(envelope) {
  if (!envelope || !['hand', 'tile-vision'].includes(envelope.provenance)) return 1;
  return typeof envelope.confidence === 'number' ? envelope.confidence : 1;
}

function numericSimilarity(left, right) {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return 0;
  const scale = Math.max(Math.abs(left), Math.abs(right), 1);
  return Math.max(0, 1 - Math.abs(left - right) / scale);
}

function awarenessSimilarity(left, right) {
  const leftIndex = AWARENESS_ORDER.indexOf(left);
  const rightIndex = AWARENESS_ORDER.indexOf(right);
  if (leftIndex < 0 || rightIndex < 0) return left === right ? 1 : 0;
  const distance = Math.abs(leftIndex - rightIndex);
  return distance === 0 ? 1 : distance === 1 ? 0.5 : 0;
}

function sophisticationSimilarity(left, right) {
  const distance = Math.abs(left - right);
  return distance === 0 ? 1 : distance === 1 ? 0.5 : 0;
}

function directRecordMoods(record) {
  const moods = record.moods || record.mood;
  return Array.isArray(moods) ? moods.filter((mood) => typeof mood === 'string') : [];
}

function passesHardTags(record, brief) {
  if (brief.mode && record.mode !== brief.mode) return false;
  if (brief.category && record.category !== brief.category) return false;

  // Sector is still an unresolved vocabulary for much of the corpus. A known
  // contradictory sector is excluded; a null sector is honestly unknown and
  // therefore cannot be treated as a mismatch.
  if (brief.sector && record.sector !== null && record.sector !== brief.sector) return false;
  return true;
}

function roleIsEligible(record, brief) {
  if (brief.wantsAvoid) return record.exemplar_role === 'negative';
  return record.exemplar_role === 'positive'
    || (brief.includeNeutral && record.exemplar_role === 'neutral');
}

function addMatch(state, field, briefValue, recordValue, weight, similarity, multiplier = 1) {
  if (briefValue === null || briefValue === undefined || recordValue === null || recordValue === undefined) return;
  state.possible += weight;
  const contribution = weight * similarity * multiplier;
  state.earned += contribution;
  if (similarity > 0) {
    state.matchedTags.push({
      field,
      briefValue,
      recordValue,
      weight,
      similarity: Number(similarity.toFixed(6)),
      contribution: Number(contribution.toFixed(6)),
    });
  }
}

function scoreRecord(record, brief) {
  const state = { earned: 0, possible: 0, matchedTags: [] };

  addMatch(state, 'mode', brief.mode, record.mode, TAG_WEIGHTS.mode, brief.mode === record.mode ? 1 : 0);
  addMatch(state, 'category', brief.category, record.category, TAG_WEIGHTS.category,
    brief.category === record.category ? 1 : 0);
  addMatch(state, 'sector', brief.sector, record.sector, TAG_WEIGHTS.sector,
    brief.sector === record.sector ? 1 : 0);

  const recordMoods = directRecordMoods(record);
  if (brief.moods.length && recordMoods.length) {
    const overlap = brief.moods.filter((mood) => recordMoods.includes(mood));
    addMatch(state, 'moods', brief.moods, recordMoods, TAG_WEIGHTS.mood,
      overlap.length / brief.moods.length);
  }

  const signals = record.retrieval && record.retrieval.signals ? record.retrieval.signals : {};
  const signature = record.retrieval && record.retrieval.signature ? record.retrieval.signature : {};
  const paletteRoles = record.retrieval && record.retrieval.palette_roles ? record.retrieval.palette_roles : {};

  const awareness = signals.awareness;
  addMatch(state, 'awareness', brief.awareness, envelopeValue(awareness), TAG_WEIGHTS.awareness,
    awarenessSimilarity(brief.awareness, envelopeValue(awareness)), confidenceMultiplier(awareness));

  const sophistication = signals.sophistication;
  addMatch(state, 'sophistication', brief.sophistication, envelopeValue(sophistication), TAG_WEIGHTS.sophistication,
    sophisticationSimilarity(brief.sophistication, envelopeValue(sophistication)), confidenceMultiplier(sophistication));

  const layout = record.retrieval && record.retrieval.layout_archetype;
  addMatch(state, 'layout_archetype', brief.layoutArchetype, envelopeValue(layout), TAG_WEIGHTS.layoutArchetype,
    brief.layoutArchetype === envelopeValue(layout) ? 1 : 0, confidenceMultiplier(layout));

  const arcCoverage = signals.arc_coverage;
  addMatch(state, 'arc_coverage', brief.arcCoverage, envelopeValue(arcCoverage), TAG_WEIGHTS.arcCoverage,
    numericSimilarity(brief.arcCoverage, envelopeValue(arcCoverage)), confidenceMultiplier(arcCoverage));

  const textDensity = signals.text_density;
  addMatch(state, 'text_density', brief.textDensity, envelopeValue(textDensity), TAG_WEIGHTS.textDensity,
    numericSimilarity(brief.textDensity, envelopeValue(textDensity)), confidenceMultiplier(textDensity));

  const imageDensity = signals.image_density;
  addMatch(state, 'image_density', brief.imageDensity, envelopeValue(imageDensity), TAG_WEIGHTS.imageDensity,
    numericSimilarity(brief.imageDensity, envelopeValue(imageDensity)), confidenceMultiplier(imageDensity));

  const urgencyDevice = signals.urgency_device;
  const urgencyValue = envelopeValue(urgencyDevice);
  if (urgencyValue !== null) {
    const urgencyPresent = true;
    addMatch(state, 'urgency_device', brief.urgencyDevice, urgencyPresent, TAG_WEIGHTS.urgencyDevice,
      brief.urgencyDevice === urgencyPresent ? 1 : 0, confidenceMultiplier(urgencyDevice));
  }

  const urgencyRepetition = signals.urgency_repetition;
  addMatch(state, 'urgency_repetition', brief.urgencyRepetition, envelopeValue(urgencyRepetition), TAG_WEIGHTS.urgencyRepetition,
    numericSimilarity(brief.urgencyRepetition, envelopeValue(urgencyRepetition)), confidenceMultiplier(urgencyRepetition));

  const signatureFamily = envelopeValue(signature.family) !== null ? signature.family : signals.signature_family;
  addMatch(state, 'signature_family', brief.signatureFamily, envelopeValue(signatureFamily), TAG_WEIGHTS.signatureFamily,
    brief.signatureFamily === envelopeValue(signatureFamily) ? 1 : 0, confidenceMultiplier(signatureFamily));

  const fieldCommitted = envelopeValue(paletteRoles.field_committed) !== null
    ? paletteRoles.field_committed
    : signals.field_committed;
  addMatch(state, 'field_committed', brief.fieldCommitted, envelopeValue(fieldCommitted), TAG_WEIGHTS.fieldCommitted,
    brief.fieldCommitted === envelopeValue(fieldCommitted) ? 1 : 0, confidenceMultiplier(fieldCommitted));

  return {
    score: state.possible ? state.earned / state.possible : 0,
    matchedTags: state.matchedTags,
  };
}

function evidenceTieBreak(left, right) {
  const bool = (record, field) => envelopeValue(record.capture && record.capture[field]) === true ? 1 : 0;
  const color = (record) => envelopeValue(record.capture && record.capture.color_fidelity) === 'lossless' ? 1 : 0;
  const gradeFields = (record) => Number(record.evidence && record.evidence.gate_grade_field_count) || 0;

  return bool(right.record, 'coverage_ok') - bool(left.record, 'coverage_ok')
    || color(right.record) - color(left.record)
    || gradeFields(right.record) - gradeFields(left.record)
    || left.record.id.localeCompare(right.record.id);
}

function recipePathFor(record) {
  const relativePath = path.posix.join('references', 'corpus', 'recipes', `${record.id}.recipe.md`);
  return fs.existsSync(path.join(ROOT, relativePath)) ? relativePath : null;
}

function resultFor(record, ranking) {
  return {
    id: record.id,
    score: Number(ranking.score.toFixed(6)),
    matchedTags: ranking.matchedTags,
    exemplar_role: record.exemplar_role,
    recordPath: path.posix.join('references', 'corpus', 'records', record.id, 'record.json'),
    recipePath: recipePathFor(record),
  };
}

function hasHardCandidate(records, brief, rolePredicate) {
  return records.some((record) => rolePredicate(record) && passesHardTags(record, brief));
}

function hasQueryTag(brief) {
  return Boolean(brief.mode || brief.category || brief.sector || brief.moods.length || brief.awareness
    || brief.sophistication !== null || brief.layoutArchetype || brief.arcCoverage !== null
    || brief.textDensity !== null || brief.imageDensity !== null || brief.urgencyDevice !== null
    || brief.urgencyRepetition !== null || brief.signatureFamily || brief.fieldCommitted !== null);
}

function noMatchNote(records, brief) {
  const safeHardMatch = hasHardCandidate(records, brief, (record) => record.exemplar_role === 'positive'
    || (brief.includeNeutral && record.exemplar_role === 'neutral'));
  const negativeHardMatch = hasHardCandidate(records, brief, (record) => record.exemplar_role === 'negative');

  if (!brief.wantsAvoid && !safeHardMatch && negativeHardMatch) {
    return 'Only negative exemplars match this brief; nothing to imitate.';
  }
  if (!hasQueryTag(brief)) return 'No matchable indexed tags were provided; nothing to retrieve.';
  return brief.wantsAvoid
    ? 'No negative exemplar matches this brief; nothing to return as an avoid contrast.'
    : 'No on-brief exemplar found; nothing to imitate.';
}

function readIndex(indexPath) {
  const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  if (!parsed || !Array.isArray(parsed.records)) {
    throw new Error(`Invalid corpus index: ${path.relative(ROOT, indexPath)}`);
  }
  return parsed;
}

function normalizeK(value) {
  if (value === undefined || value === null) return DEFAULT_K;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new RangeError('--k must be a positive integer.');
  return number;
}

function retrieve(briefInput, options = {}) {
  const brief = normalizeBrief(briefInput);
  const k = normalizeK(options.k);
  const indexPath = options.indexPath || DEFAULT_INDEX_PATH;
  const index = readIndex(indexPath);

  const ranked = index.records
    .filter((record) => roleIsEligible(record, brief) && passesHardTags(record, brief))
    .map((record) => ({ record, ...scoreRecord(record, brief) }))
    // An all-null comparison has no evidence of relevance and must not pad K.
    .filter((candidate) => candidate.matchedTags.length > 0)
    .sort((left, right) => right.score - left.score || evidenceTieBreak(left, right));

  const matches = ranked.slice(0, k).map((candidate) => resultFor(candidate.record, candidate));
  return {
    retrievalMode: brief.wantsAvoid ? 'avoid' : 'imitate',
    matches,
    note: matches.length ? null : noMatchNote(index.records, brief),
  };
}

function usage() {
  return "Usage: node scripts/librarian.js query '<brief-json>' [--k 3]";
}

function runCli(argv = process.argv.slice(2)) {
  if (argv[0] !== 'query' || !argv[1]) {
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  let brief;
  try {
    brief = JSON.parse(argv[1]);
  } catch (error) {
    console.error(`FAIL — brief must be valid JSON: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  let k;
  if (argv.length === 2) {
    k = DEFAULT_K;
  } else if (argv.length === 4 && argv[2] === '--k') {
    k = argv[3];
  } else {
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  try {
    const result = retrieve(brief, { k });
    console.log(JSON.stringify(result, null, 2));
    if (!result.matches.length) {
      console.error(MISS_MESSAGE);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`FAIL — ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) runCli();

module.exports = {
  DEFAULT_INDEX_PATH,
  MISS_MESSAGE,
  TAG_WEIGHTS,
  retrieve,
};
