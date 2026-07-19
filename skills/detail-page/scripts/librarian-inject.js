'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const { retrieve } = require('./librarian.js');

const DEFAULT_K = 1;
const DESIGN_DIAL_DEFAULT = 5;
const DESIGN_DIAL_MIN = 1;
const DESIGN_DIAL_MAX = 10;
// A unique per-run directory: a fixed shared /tmp path is race- and
// clobber-prone across concurrent runs (and a symlink-planting target).
function defaultLogPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'inject-g32-')), 'run.log');
}
const MISS_MESSAGE = 'MISS — no corpus match found — this is a database miss, not an empty value; do not invent one.';
const OVERWRITE_MESSAGE = (file) => `REFUSING — output already exists: ${file}; skipped without --force (non-destructive overwrite guard).`;
const REASONING_DIR = path.join(ROOT, 'references', 'corpus', 'reasoning');

function normalizeK(value) {
  if (value === undefined || value === null) return DEFAULT_K;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new RangeError('--k must be a positive integer.');
  return number;
}

function normalizeDesignDial(value, name) {
  if (value === undefined || value === null) return DESIGN_DIAL_DEFAULT;
  const number = Number(value);
  if (!Number.isInteger(number) || number < DESIGN_DIAL_MIN || number > DESIGN_DIAL_MAX) {
    throw new RangeError(`--${name} must be an integer from ${DESIGN_DIAL_MIN} to ${DESIGN_DIAL_MAX}.`);
  }
  return number;
}

function normalizeDesignDials(options = {}) {
  return {
    variance: normalizeDesignDial(options.variance, 'variance'),
    motion: normalizeDesignDial(options.motion, 'motion'),
    density: normalizeDesignDial(options.density, 'density'),
  };
}

function hasNonDefaultDesignDials(dials) {
  return dials.variance !== DESIGN_DIAL_DEFAULT
    || dials.motion !== DESIGN_DIAL_DEFAULT
    || dials.density !== DESIGN_DIAL_DEFAULT;
}

function varianceQuery(dials) {
  if (dials.variance > DESIGN_DIAL_DEFAULT) {
    const weight = dials.variance - DESIGN_DIAL_DEFAULT + 1;
    return {
      terms: ['style-divergence', 'alternative-signature', 'non-neighbor'],
      weight,
      text: `style-divergence^${weight} alternative-signature^${weight} non-neighbor^${weight}`,
    };
  }
  if (dials.variance < DESIGN_DIAL_DEFAULT) {
    const weight = DESIGN_DIAL_DEFAULT - dials.variance + 1;
    return {
      terms: ['exemplar-fidelity', 'nearest-neighbor'],
      weight,
      text: `exemplar-fidelity^${weight} nearest-neighbor^${weight}`,
    };
  }
  return null;
}

function retrieveWithDesignDials(brief, { k, indexPath, dials }) {
  const query = varianceQuery(dials);
  if (!query) return retrieve(brief, { k, indexPath });

  // Keep the Librarian's eligibility and evidence scoring authoritative. The
  // dial only reranks that safe candidate set; it never invents or substitutes
  // a record outside of normal retrieval.
  const candidateRetrieval = retrieve(brief, { k: Number.MAX_SAFE_INTEGER, indexPath });
  const strength = Math.abs(dials.variance - DESIGN_DIAL_DEFAULT) / DESIGN_DIAL_DEFAULT;
  const matches = candidateRetrieval.matches
    .map((match, index) => ({
      match,
      index,
      dialScore: dials.variance > DESIGN_DIAL_DEFAULT
        ? (1 - strength) * match.score + strength * (1 - match.score)
        : match.score * (1 + strength),
    }))
    .sort((left, right) => right.dialScore - left.dialScore || left.index - right.index)
    .slice(0, k)
    .map(({ match }) => match);

  return {
    ...candidateRetrieval,
    matches,
    dialQuery: query,
  };
}

function spacingScaleForDensity(density) {
  const compactness = (density - DESIGN_DIAL_MIN) / (DESIGN_DIAL_MAX - DESIGN_DIAL_MIN);
  const value = (airy, compact) => Math.round(airy - (airy - compact) * compactness);
  return {
    'space-1': value(16, 8),
    'space-2': value(24, 12),
    'space-3': value(36, 20),
    'space-4': value(52, 28),
    'space-5': value(80, 40),
  };
}

function designDialGuidance(dials) {
  if (!hasNonDefaultDesignDials(dials)) return null;
  const lines = ['## Design dial guidance', ''];
  const query = varianceQuery(dials);

  if (query) {
    const direction = dials.variance > DESIGN_DIAL_DEFAULT
      ? 'push away from the nearest-neighbor look with a deliberately different composition or signature treatment, while retaining the retrieved evidence as the source of truth.'
      : 'tighten to the retrieved exemplar; preserve its composition, signature treatment, and literal evidence with minimal stylistic drift.';
    lines.push(`**Retrieval query bias:** prepend \`${query.text}\` (weight ${query.weight}). ${direction}`, '');
  }

  if (dials.motion !== DESIGN_DIAL_DEFAULT) {
    const reduced = dials.motion < DESIGN_DIAL_DEFAULT;
    const direction = reduced
      ? 'reduced/static — use no decorative autoplay; prefer instant state changes or a single subtle transition when essential.'
      : 'high-motion — use purposeful layered reveals, richer state transitions, and stronger effect choreography without obscuring content.';
    lines.push(`**Motion guidance (${dials.motion}/10):** ${direction}`, '**Accessibility guard:** always honor `prefers-reduced-motion: reduce` by removing non-essential motion and effects.', '');
  }

  if (dials.density !== DESIGN_DIAL_DEFAULT) {
    const scale = spacingScaleForDensity(dials.density);
    const direction = dials.density < DESIGN_DIAL_DEFAULT ? 'airy / large gaps' : 'compact / tight gaps';
    const tokens = Object.entries(scale).map(([name, pixels]) => `--${name}: ${pixels}px;`).join(' ');
    lines.push(`**Spacing-scale override (${dials.density}/10, ${direction}):** ${tokens}`, 'This overrides emitted generic spacing guidance; preserve literal captured spacing evidence where the recipe names it.', '');
  }

  return lines.slice(0, -1).join('\n');
}

function readRecipe(recipePath) {
  return fs.readFileSync(path.join(ROOT, recipePath), 'utf8').trim();
}

function recordFallback(recordPath) {
  const record = JSON.parse(fs.readFileSync(path.join(ROOT, recordPath), 'utf8'));
  const tags = {
    mode: record.mode,
    category: record.category,
    sector: record.sector,
    locale: record.locale,
    moods: record.moods || record.mood || null,
    notes: record.notes || null,
    retrieval: record.retrieval || null,
  };
  const tokens = {
    computed_backgrounds: record.palette && record.palette.computed_backgrounds || null,
    display_type: record.type && record.type.display || null,
    body_type: record.type && record.type.body || null,
    mono_type: record.type && record.type.mono || null,
  };

  return `${JSON.stringify({ tags, tokens }, null, 2)}`;
}

function planPreamble(match) {
  if (!match) {
    return [
      '## Plan preamble — retrieval grounding',
      '',
      'no on-brief exemplar to imitate — do NOT inject a negative exemplar.',
      'Proceed without exemplar imitation; the Librarian returned no safe positive model.',
    ].join('\n');
  }

  const recipeCitation = match.recipePath
    ? `Recipe cited: \`${match.recipePath}\``
    : 'Recipe cited: none (a full recipe has not been derived yet).';
  return [
    '## Plan preamble — retrieval grounding',
    '',
    `Retrieved exemplar cited: \`${match.id}\` (role: \`${match.exemplar_role}\`, score: ${match.score}).`,
    recipeCitation,
    `Build directive: imitate THIS exemplar's technique — \`${match.id}\` — using the attached grounding; do not replace it with a generic design guideline.`,
  ].join('\n');
}

function reasoningForCategory(category) {
  if (typeof category !== 'string' || category.trim() === '') return null;
  const filePath = path.resolve(REASONING_DIR, `${category}.json`);
  if (!filePath.startsWith(`${REASONING_DIR}${path.sep}`) || !fs.existsSync(filePath)) return null;
  const reasoning = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return reasoning.category === category ? reasoning : null;
}

function formatReasoningSidecar(reasoning) {
  if (!reasoning) return null;
  const decisionRules = Object.entries(reasoning.decision_rules)
    .map(([condition, directive]) => `- \`${condition}\` → ${directive}`);
  const antiPatterns = reasoning.anti_patterns.map((antiPattern) => `- ${antiPattern}`);
  return [
    '## Category reasoning sidecar',
    '',
    `Category: \`${reasoning.category}\``,
    `Recommended pattern: ${reasoning.recommended_pattern}`,
    '',
    '### Decision rules (if/then)',
    ...decisionRules,
    '',
    '### Anti-patterns',
    ...antiPatterns,
    '',
    `Severity: \`${reasoning.severity}\``,
  ].join('\n');
}

function appendReasoningSidecar(lines, category) {
  const sidecar = formatReasoningSidecar(reasoningForCategory(category));
  return sidecar ? lines.concat('', '---', '', sidecar) : lines;
}

function appendDesignDialGuidance(lines, dials) {
  const guidance = designDialGuidance(dials);
  return guidance ? lines.concat('', '---', '', guidance) : lines;
}

function finalizeGrounding(lines, category, dials) {
  return appendDesignDialGuidance(appendReasoningSidecar(lines, category), dials).join('\n');
}

function groundingForMatch(match, category, dials) {
  const heading = [
    '# GROUNDING BLOCK — retrieved exemplar',
    '',
    `Retrieved exemplar: \`${match.id}\` (role: \`${match.exemplar_role}\`, score: ${match.score}).`,
    `Record: \`${match.recordPath}\`.`,
    '',
    `**Build directive:** imitate THIS exemplar's technique — \`${match.id}\` — rather than inventing a generic design.`,
  ];

  if (!match.recipePath) {
    return finalizeGrounding([
      ...heading,
      '',
      '## Recipe availability',
      '',
      'No recipe is derived for this retrieved exemplar yet. Do not fabricate a recipe. The record-backed tags and tokens below are the only grounding available.',
      '',
      '## Record-backed tags and tokens',
      '',
      recordFallback(match.recordPath),
    ], category, dials);
  }

  return finalizeGrounding([
    ...heading,
    '',
    `Recipe: \`${match.recipePath}\`.`,
    '',
    'The following recipe is the evidence-backed grounding to imitate. It carries the literal token values, layout arc, named signature techniques, build order, and anti-slop guardrails; preserve them rather than substituting generic equivalents.',
    '',
    '---',
    '',
    readRecipe(match.recipePath),
  ], category, dials);
}

function groundingForMiss(retrieval, category, dials) {
  return finalizeGrounding([
    '# GROUNDING BLOCK — no safe exemplar',
    '',
    MISS_MESSAGE,
    'no on-brief exemplar to imitate — do NOT inject a negative exemplar.',
    `Librarian note: ${retrieval.note || 'No on-brief exemplar found; nothing to imitate.'}`,
    'No recipe, record, or negative exemplar is injected as a model.',
  ], category, dials);
}

function inject(brief, options = {}) {
  const k = normalizeK(options.k);
  const dials = normalizeDesignDials(options);
  const retrieval = retrieveWithDesignDials(brief, { k, indexPath: options.indexPath, dials });
  const match = retrieval.matches[0] || null;

  if (!match) {
    return {
      retrieval,
      groundingBlock: groundingForMiss(retrieval, brief.category, dials),
      planPreamble: planPreamble(null),
    };
  }

  return {
    retrieval,
    groundingBlock: groundingForMatch(match, brief.category, dials),
    planPreamble: planPreamble(match),
  };
}

function usage() {
  return "Usage: node scripts/librarian-inject.js '<brief-json>' [--k 1] [--variance 1-10] [--motion 1-10] [--density 1-10] [--out <path>] [--force]";
}

function runCli(argv = process.argv.slice(2), options = {}) {
  if (!argv[0]) {
    console.error(usage());
    process.exitCode = 1;
    return null;
  }

  let brief;
  try {
    brief = JSON.parse(argv[0]);
  } catch (error) {
    console.error(`FAIL — brief must be valid JSON: ${error.message}`);
    process.exitCode = 1;
    return null;
  }

  let k = DEFAULT_K;
  let out = null;
  let force = Boolean(options.force);
  const dials = {};
  for (let index = 1; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--k' || flag === '--out') {
      const value = argv[index + 1];
      if (!value || (flag === '--k' && k !== DEFAULT_K) || (flag === '--out' && out !== null)) {
        console.error(usage());
        process.exitCode = 1;
        return null;
      }
      if (flag === '--k') k = value;
      else out = value;
      index += 1;
    } else if (flag === '--variance' || flag === '--motion' || flag === '--density') {
      const name = flag.slice(2);
      const value = argv[index + 1];
      if (value === undefined || Object.prototype.hasOwnProperty.call(dials, name)) {
        console.error(`FAIL — ${flag} requires one integer from ${DESIGN_DIAL_MIN} to ${DESIGN_DIAL_MAX}.`);
        process.exitCode = 1;
        return null;
      }
      try {
        dials[name] = normalizeDesignDial(value, name);
      } catch (error) {
        console.error(`FAIL — ${error.message}`);
        process.exitCode = 1;
        return null;
      }
      index += 1;
    } else if (flag === '--force' && !force) {
      force = true;
    } else {
      console.error(usage());
      process.exitCode = 1;
      return null;
    }
  }

  try {
    const result = inject(brief, { k, ...dials });
    const output = `${result.groundingBlock}\n\n${result.planPreamble}\n`;
    const logPath = options.logPath || out || defaultLogPath();
    if (fs.existsSync(logPath) && !force) {
      console.error(OVERWRITE_MESSAGE(logPath));
      process.exitCode = 1;
      return null;
    }
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.writeFileSync(logPath, output);
    console.log(output);
    if (!result.retrieval.matches.length) {
      console.error(MISS_MESSAGE);
      process.exitCode = 1;
    }
    return result;
  } catch (error) {
    console.error(`FAIL — ${error.message}`);
    process.exitCode = 1;
    return null;
  }
}

if (require.main === module) runCli();

module.exports = {
  DESIGN_DIAL_DEFAULT,
  DESIGN_DIAL_MAX,
  DESIGN_DIAL_MIN,
  DEFAULT_K,
  MISS_MESSAGE,
  OVERWRITE_MESSAGE,
  REASONING_DIR,
  appendReasoningSidecar,
  appendDesignDialGuidance,
  defaultLogPath,
  designDialGuidance,
  formatReasoningSidecar,
  hasNonDefaultDesignDials,
  inject,
  normalizeDesignDial,
  normalizeDesignDials,
  planPreamble,
  reasoningForCategory,
  retrieveWithDesignDials,
  runCli,
  spacingScaleForDensity,
  varianceQuery,
};
