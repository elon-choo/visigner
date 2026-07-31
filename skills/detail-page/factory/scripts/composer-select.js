#!/usr/bin/env node
'use strict';

/*
 * G4.2 selection boundary
 *
 * A human or an LLM may provide an ordered plan in brief.sections and a concrete
 * module decision in brief.sections[].decision. This is the only composer stage
 * that accepts that kind of choice. This reference selector uses deterministic
 * intent and catalog ranking when no decision is supplied, then records both the
 * candidate order and the selected module in selection.json.
 */

const fs = require('fs');
const path = require('path');

const V3_ROOT = path.resolve(__dirname, '..');
const MODULES_ROOT = path.join(V3_ROOT, 'modules');
const COMPOSER_ROOT = path.join(V3_ROOT, 'composer');
const GOLD_ROOT = path.join(V3_ROOT, 'gold-gallery');
const VARIANT_AXES = ['layoutArchetype', 'density', 'backgroundBleed', 'motion', 'artDirection'];
const VARIANT_ENUMS = {
  layoutArchetype: new Set(['centered', 'split', 'stack', 'grid', 'rail', 'timeline', 'comparison-table', 'media-led']),
  density: new Set(['airy', 'standard', 'compact']),
  backgroundBleed: new Set(['surface-contained', 'surface-bleed', 'card-contained', 'contrast-bleed', 'media-bleed']),
  motion: new Set(['none', 'reveal', 'stagger', 'scroll-linked']),
  artDirection: new Set(['typographic', 'editorial', 'product-ui', 'documentary', 'data-led', 'photographic'])
};
const FULL_BLEED = new Set(['surface-bleed', 'contrast-bleed', 'media-bleed']);
const TYPE_PAGE_LIMITS = Object.freeze({
  hero: 1,
  cta: 2,
  'footer-band': 1
});
const SOURCE_PROVENANCE = new Set(['mined', 'schema-authored']);
const VARIANT_PROVENANCE = new Set(['structure-mined', 'structure-mined; axis-composed', 'schema-authored']);
const DEFAULT_CORE = {
  tokenSet: 'semantic-v3',
  typographyVoices: {
    display: '--font-display',
    body: '--font-body',
    latin: '--font-latin'
  },
  signatureMotif: '절제된 표면 전환과 검토 가능한 카드 리듬'
};
const INTENT_BLUEPRINTS = {
  conversion: [
    { type: 'hero', purpose: '첫 화면에서 제품의 다음 행동을 선명하게 제시한다.', preferences: { layoutArchetype: 'split', density: 'airy', backgroundBleed: 'contrast-bleed', motion: 'none', artDirection: 'editorial' } },
    { type: 'feature', purpose: '핵심 역량을 제품 표면으로 묶어 설명한다.', preferences: { layoutArchetype: 'grid', density: 'compact', backgroundBleed: 'card-contained', motion: 'none', artDirection: 'product-ui' } },
    { type: 'cta', purpose: '마지막 행동을 짧고 분명하게 요청한다.', preferences: { layoutArchetype: 'rail', density: 'compact', backgroundBleed: 'surface-bleed', motion: 'reveal', artDirection: 'editorial' } },
    { type: 'footer-band', purpose: '탐색 경로와 법적 정보를 정리해 닫는다.', preferences: { layoutArchetype: 'split', density: 'airy', backgroundBleed: 'surface-contained', motion: 'none', artDirection: 'typographic' } }
  ]
};

function fail(message) {
  throw new Error(`composer-select: ${message}`);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function displayPath(filePath) {
  const relative = path.relative(process.cwd(), filePath);
  return relative && !relative.startsWith('..') ? toPosix(relative) : toPosix(filePath);
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`cannot read ${label}: ${displayPath(filePath)} (${error.message})`);
  }
}

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function assertRunArtifact(filePath, label) {
  if (!isWithin(COMPOSER_ROOT, filePath)) {
    fail(`${label} must stay inside v3/composer/<run>`);
  }
  const relative = path.relative(COMPOSER_ROOT, filePath);
  if (relative.split(path.sep).length !== 2) {
    fail(`${label} must be a direct artifact of v3/composer/<run>`);
  }
}

function assertVariantValue(axis, value, label) {
  if (!VARIANT_ENUMS[axis].has(value)) {
    fail(`${label}.${axis} must use the SECTION-SCHEMA enum`);
  }
}

function assertFullVariants(variants, label) {
  if (!isPlainObject(variants)) fail(`${label} must be an object with five variation axes`);
  for (const axis of VARIANT_AXES) {
    assertVariantValue(axis, variants[axis], label);
  }
  for (const axis of Object.keys(variants)) {
    if (!Object.prototype.hasOwnProperty.call(VARIANT_ENUMS, axis)) {
      fail(`${label}.${axis} is not a SECTION-SCHEMA variation axis`);
    }
  }
  return Object.fromEntries(VARIANT_AXES.map((axis) => [axis, variants[axis]]));
}

function normalizePreferences(value, label) {
  if (value == null) return {};
  if (!isPlainObject(value)) fail(`${label} must be an object`);
  const preferences = {};
  for (const [axis, axisValue] of Object.entries(value)) {
    if (!Object.prototype.hasOwnProperty.call(VARIANT_ENUMS, axis)) {
      fail(`${label}.${axis} is not a SECTION-SCHEMA variation axis`);
    }
    assertVariantValue(axis, axisValue, label);
    preferences[axis] = axisValue;
  }
  return preferences;
}

function normalizeDecision(value, label) {
  if (value == null) return null;
  if (!isPlainObject(value)) fail(`${label} must be an object when provided`);
  if (typeof value.moduleId !== 'string' || value.moduleId.trim() === '') {
    fail(`${label}.moduleId must name one catalog module`);
  }
  const source = typeof value.source === 'string' && value.source.trim()
    ? value.source.trim()
    : 'external-selection';
  const reason = typeof value.reason === 'string' && value.reason.trim()
    ? value.reason.trim()
    : 'External selection supplied with the brief.';
  return {
    moduleId: value.moduleId.trim(),
    source,
    reason,
    variants: value.variants == null ? {} : assertFullVariants(value.variants, `${label}.variants`)
  };
}

/*
 * G5.4k: a brief may carry the section's own copy, not only its module choice.
 *
 * Before this, brief.sections[].content had nowhere to go: composer-select.js never read it and
 * selection.json never carried it, so composer-assemble.js reached `injectSlots(template, null,
 * ...)` and returned the module template untouched. Every page the factory built from a brief
 * therefore rendered the catalog's placeholder sentences, and four gallery tiles built from four
 * different runs printed the same headline. The selector is the stage that accepts external
 * choice, and copy IS an external choice, so it passes through here.
 *
 * Validation stays thin on purpose. The slot contract — which names exist, required vs optional,
 * char bounds, collection arity, asset refusal — is the ASSEMBLER's, and it already enforces all
 * of it against the module.json of the module that was actually selected (composer-assemble.js
 * injectSlots). Re-checking it here would need the selector to resolve the module first and would
 * put the same rule in two places. So this only asserts the shape the selector itself can see.
 */
function normalizeContent(value, label) {
  if (value == null) return null;
  if (!isPlainObject(value)) fail(`${label} must be an object of slot values when provided`);
  if (Object.keys(value).length === 0) fail(`${label} is empty; omit it rather than declaring no slots`);
  return value;
}

function normalizeCore(value) {
  const core = value == null ? DEFAULT_CORE : value;
  if (!isPlainObject(core)) fail('brief.core must be an object');
  if (typeof core.tokenSet !== 'string' || core.tokenSet.trim() === '') {
    fail('brief.core.tokenSet must be a non-empty semantic token-set reference');
  }
  if (!isPlainObject(core.typographyVoices)) fail('brief.core.typographyVoices must be an object');
  const typographyVoices = {};
  for (const voice of ['display', 'body', 'latin']) {
    if (typeof core.typographyVoices[voice] !== 'string' || core.typographyVoices[voice].trim() === '') {
      fail(`brief.core.typographyVoices.${voice} must be a non-empty font token`);
    }
    typographyVoices[voice] = core.typographyVoices[voice];
  }
  if (typeof core.signatureMotif !== 'string' || core.signatureMotif.trim() === '') {
    fail('brief.core.signatureMotif must be a non-empty page-wide motif');
  }
  return {
    tokenSet: core.tokenSet,
    typographyVoices,
    signatureMotif: core.signatureMotif
  };
}

function validateSectionPlanGrammar(sections) {
  const typeCounts = new Map();
  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];
    const previous = sections[index - 1];
    if (previous && previous.type === section.type) {
      fail(`brief.sections[${index - 1}] and brief.sections[${index}] both use ${section.type}; adjacent same-type sections are forbidden`);
    }
    if (section.type === 'hero' && index !== 0) {
      fail(`brief.sections[${index}].type hero must be the first section when present`);
    }
    if (section.type === 'footer-band' && index !== sections.length - 1) {
      fail(`brief.sections[${index}].type footer-band must be the final section when present`);
    }
    typeCounts.set(section.type, (typeCounts.get(section.type) || 0) + 1);
  }
  for (const [type, maximum] of Object.entries(TYPE_PAGE_LIMITS)) {
    const count = typeCounts.get(type) || 0;
    if (count > maximum) fail(`brief requests ${count} ${type} sections; maximum is ${maximum} per page`);
  }
}

function normalizeBrief(brief, briefFile) {
  if (!isPlainObject(brief)) fail('brief must be a JSON object');
  if (brief.briefVersion !== '1.0.0') fail('brief.briefVersion must be 1.0.0');
  let sectionInputs;
  let selectionPlanSource;
  if (Array.isArray(brief.sections) && brief.sections.length > 0) {
    sectionInputs = brief.sections;
    selectionPlanSource = 'brief.sections';
  } else if (typeof brief.intent === 'string' && INTENT_BLUEPRINTS[brief.intent]) {
    sectionInputs = INTENT_BLUEPRINTS[brief.intent];
    selectionPlanSource = `intent-blueprint:${brief.intent}`;
  } else {
    fail('brief must provide non-empty sections or a supported intent (conversion)');
  }
  const page = isPlainObject(brief.page) ? brief.page : {};
  const title = typeof page.title === 'string' && page.title.trim()
    ? page.title.trim()
    : 'Neutral catalog assembly';
  const language = typeof page.language === 'string' && page.language.trim()
    ? page.language.trim()
    : 'en';
  const sections = sectionInputs.map((section, index) => {
    const label = `brief.sections[${index}]`;
    if (!isPlainObject(section)) fail(`${label} must be an object`);
    if (typeof section.type !== 'string' || section.type.trim() === '') {
      fail(`${label}.type must name a catalog type`);
    }
    const purpose = typeof section.purpose === 'string' && section.purpose.trim()
      ? section.purpose.trim()
      : `Brief section ${index + 1}`;
    return {
      type: section.type.trim(),
      purpose,
      preferences: normalizePreferences(section.preferences, `${label}.preferences`),
      decision: normalizeDecision(section.decision, `${label}.decision`),
      content: normalizeContent(section.content, `${label}.content`)
    };
  });
  validateSectionPlanGrammar(sections);
  return {
    source: toPosix(path.relative(V3_ROOT, briefFile)),
    intent: typeof brief.intent === 'string' ? brief.intent : null,
    selectionPlanSource,
    page: { title, language },
    core: normalizeCore(brief.core),
    sections
  };
}

function normalizeProvenance(module, label) {
  if (!isPlainObject(module.corpusSource) || typeof module.corpusSource.recordId !== 'string' || module.corpusSource.recordId.trim() === '') {
    fail(`${label}.corpusSource.recordId must be a non-empty string`);
  }
  if (typeof module.corpusSource.sectionSpan !== 'string' || module.corpusSource.sectionSpan.trim() === '') {
    fail(`${label}.corpusSource.sectionSpan must be a non-empty string`);
  }
  const source = module.provenance || (module.corpusSource.recordId === 'schema' ? 'schema-authored' : 'mined');
  const variant = module.variantProvenance || (source === 'schema-authored' ? 'schema-authored' : 'structure-mined');
  if (!SOURCE_PROVENANCE.has(source)) fail(`${label}.provenance is not a catalog provenance value`);
  if (!VARIANT_PROVENANCE.has(variant)) fail(`${label}.variantProvenance is not a catalog provenance value`);
  if ((source === 'schema-authored') !== (variant === 'schema-authored')) {
    fail(`${label} has contradictory provenance and variantProvenance`);
  }
  return { source, variant };
}

function readCatalog() {
  const modules = [];
  const typeEntries = fs.readdirSync(MODULES_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  for (const typeEntry of typeEntries) {
    const typeDir = path.join(MODULES_ROOT, typeEntry.name);
    const moduleEntries = fs.readdirSync(typeDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    for (const moduleEntry of moduleEntries) {
      const moduleFile = path.join(typeDir, moduleEntry.name, 'module.json');
      if (!fs.existsSync(moduleFile)) continue;
      const module = readJson(moduleFile, 'module metadata');
      const label = toPosix(path.relative(V3_ROOT, moduleFile));
      if (!isPlainObject(module) || module.schemaVersion !== '1.0.0') fail(`${label} must use schemaVersion 1.0.0`);
      if (module.type !== typeEntry.name || module.name !== moduleEntry.name) {
        fail(`${label} must agree with its catalog directory`);
      }
      if (!isPlainObject(module.slots)) fail(`${label}.slots must be an object`);
      if (typeof module.gateProfile !== 'string' || module.gateProfile.trim() === '') {
        fail(`${label}.gateProfile must be a non-empty catalog profile`);
      }
      modules.push({
        name: module.name,
        type: module.type,
        moduleFile,
        variants: assertFullVariants(module.variants, `${label}.variants`),
        corpusSource: {
          recordId: module.corpusSource.recordId,
          sectionSpan: module.corpusSource.sectionSpan
        },
        gateProfile: module.gateProfile,
        provenance: normalizeProvenance(module, label)
      });
    }
  }
  if (modules.length !== 40) fail(`catalog must contain 40 modules; found ${modules.length}`);
  return modules;
}

function readGoldExemplars(catalog) {
  const catalogByName = new Map(catalog.map((module) => [module.name, module]));
  const byModule = new Map();
  const byType = {};
  const sourceFiles = fs.readdirSync(GOLD_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();
  for (const sourceFile of sourceFiles) {
    const filePath = path.join(GOLD_ROOT, sourceFile);
    const document = readJson(filePath, 'gold exemplar manifest');
    if (!isPlainObject(document) || typeof document.type !== 'string' || !Array.isArray(document.promoted)) continue;
    const source = toPosix(path.relative(V3_ROOT, filePath));
    const promoted = document.promoted.slice().sort((left, right) => left.rank - right.rank);
    byType[document.type] = [];
    for (const entry of promoted) {
      if (!isPlainObject(entry) || typeof entry.moduleId !== 'string' || !Number.isFinite(entry.rank)) {
        fail(`${source} has an invalid promoted exemplar`);
      }
      const module = catalogByName.get(entry.moduleId);
      if (!module || module.type !== document.type) {
        fail(`${source} references a missing ${document.type} module: ${entry.moduleId}`);
      }
      const descriptor = {
        source,
        rank: entry.rank,
        moduleId: entry.moduleId,
        overall: typeof entry.overall === 'number' ? entry.overall : null,
        rationale: typeof entry.rationale === 'string' ? entry.rationale : ''
      };
      byModule.set(`${module.type}:${module.name}`, descriptor);
      byType[document.type].push(descriptor);
    }
  }
  return { byModule, byType };
}

function moduleRef(module) {
  return `../../modules/${module.type}/${module.name}`;
}

function compareCandidates(left, right) {
  if (left.score !== right.score) return right.score - left.score;
  return left.module.name < right.module.name ? -1 : left.module.name > right.module.name ? 1 : 0;
}

function rankCandidates(plan, catalog, exemplars) {
  const candidates = catalog
    .filter((module) => module.type === plan.type)
    .map((module) => {
      const exemplar = exemplars.byModule.get(`${module.type}:${module.name}`) || null;
      const matchedPreferenceAxes = VARIANT_AXES.filter((axis) => (
        Object.prototype.hasOwnProperty.call(plan.preferences, axis)
        && module.variants[axis] === plan.preferences[axis]
      ));
      const resolvedVariants = {
        ...module.variants,
        ...plan.preferences,
        ...(plan.decision ? plan.decision.variants : {})
      };
      const score = matchedPreferenceAxes.length * 100 + (exemplar ? 10000 - exemplar.rank : 0);
      return {
        module,
        moduleRef: moduleRef(module),
        exemplar,
        matchedPreferenceAxes,
        resolvedVariants,
        score
      };
    })
    .sort(compareCandidates)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
  if (candidates.length === 0) fail(`brief requests unknown catalog type: ${plan.type}`);
  if (plan.decision && !candidates.some((candidate) => candidate.module.name === plan.decision.moduleId)) {
    fail(`brief decision names ${plan.decision.moduleId}, which is not a ${plan.type} module`);
  }
  return candidates;
}

function differentAxes(left, right) {
  return VARIANT_AXES.filter((axis) => left[axis] !== right[axis]).length;
}

function canAppend(candidate, plan, selected, usedPairs, typeCounts, fullBleedCount, movingCount, totalSections) {
  const variants = candidate.resolvedVariants;
  const pair = `${plan.type}\u0000${variants.layoutArchetype}`;
  if (usedPairs.has(pair)) return false;
  const typeLimit = TYPE_PAGE_LIMITS[plan.type];
  if (typeLimit && (typeCounts.get(plan.type) || 0) >= typeLimit) return false;
  if (plan.type === 'hero' && selected.length !== 0) return false;
  if (plan.type === 'footer-band' && selected.length !== totalSections - 1) return false;
  const previous = selected[selected.length - 1];
  if (previous) {
    if (previous.plan.type === plan.type) return false;
    if (differentAxes(previous.candidate.resolvedVariants, variants) < 2) return false;
    if (previous.candidate.resolvedVariants.layoutArchetype === variants.layoutArchetype) return false;
    if (FULL_BLEED.has(previous.candidate.resolvedVariants.backgroundBleed) && FULL_BLEED.has(variants.backgroundBleed)) return false;
  }
  const nextFullBleed = fullBleedCount + (FULL_BLEED.has(variants.backgroundBleed) ? 1 : 0);
  const nextMoving = movingCount + (variants.motion !== 'none' ? 1 : 0);
  return nextFullBleed <= Math.ceil(totalSections / 2) && nextMoving <= Math.ceil(totalSections / 3);
}

function chooseGrammarCompatibleSequence(plans, rankedCandidates) {
  const allowedCandidates = rankedCandidates.map((candidates, index) => {
    const decision = plans[index].decision;
    return decision
      ? candidates.filter((candidate) => candidate.module.name === decision.moduleId)
      : candidates;
  });
  const totalSections = plans.length;
  function search(index, selected, usedPairs, typeCounts, fullBleedCount, movingCount) {
    if (index === totalSections) return selected;
    for (const candidate of allowedCandidates[index]) {
      const plan = plans[index];
      if (!canAppend(candidate, plan, selected, usedPairs, typeCounts, fullBleedCount, movingCount, totalSections)) continue;
      const variants = candidate.resolvedVariants;
      const nextPairs = new Set(usedPairs);
      nextPairs.add(`${plan.type}\u0000${variants.layoutArchetype}`);
      const nextTypeCounts = new Map(typeCounts);
      nextTypeCounts.set(plan.type, (nextTypeCounts.get(plan.type) || 0) + 1);
      const result = search(
        index + 1,
        selected.concat({ plan, candidate }),
        nextPairs,
        nextTypeCounts,
        fullBleedCount + (FULL_BLEED.has(variants.backgroundBleed) ? 1 : 0),
        movingCount + (variants.motion !== 'none' ? 1 : 0)
      );
      if (result) return result;
    }
    return null;
  }
  const selected = search(0, [], new Set(), new Map(), 0, 0);
  if (!selected) {
    fail('brief preferences and explicit decisions cannot satisfy the composition grammar');
  }
  return selected;
}

function candidateLog(candidate) {
  return {
    rank: candidate.rank,
    moduleId: candidate.module.name,
    module: candidate.moduleRef,
    score: candidate.score,
    defaultVariants: candidate.module.variants,
    matchedBriefPreferenceAxes: candidate.matchedPreferenceAxes,
    exemplar: candidate.exemplar ? {
      source: candidate.exemplar.source,
      rank: candidate.exemplar.rank,
      overall: candidate.exemplar.overall,
      rationale: candidate.exemplar.rationale
    } : null
  };
}

function selectionReason(selected, plan) {
  const candidate = selected.candidate;
  if (plan.decision) {
    return `${plan.decision.source} selected ${candidate.module.name}: ${plan.decision.reason}`;
  }
  const reasons = [`grammar-compatible catalog rank ${candidate.rank}`];
  if (candidate.exemplar) {
    reasons.push(`gold exemplar priority ${candidate.exemplar.source} rank ${candidate.exemplar.rank}`);
  }
  if (candidate.matchedPreferenceAxes.length > 0) {
    reasons.push(`default matches ${candidate.matchedPreferenceAxes.join(', ')}`);
  }
  return reasons.join('; ');
}

function buildSelection(brief, catalog, exemplars) {
  const rankedCandidates = brief.sections.map((plan) => rankCandidates(plan, catalog, exemplars));
  const selected = chooseGrammarCompatibleSequence(brief.sections, rankedCandidates);
  const requestedTypes = Array.from(new Set(brief.sections.map((section) => section.type))).sort();
  const exemplarCandidates = {};
  for (const type of requestedTypes) {
    if (exemplars.byType[type]) {
      exemplarCandidates[type] = exemplars.byType[type].map((entry) => ({
        source: entry.source,
        rank: entry.rank,
        moduleId: entry.moduleId,
        overall: entry.overall,
        rationale: entry.rationale
      }));
    }
  }
  const hasExternalDecision = brief.sections.some((section) => section.decision);
  return {
    selectionVersion: '1.0.0',
    selectionStage: {
      boundary: 'Only this stage may accept an externally supplied human or LLM choice; assembly consumes this immutable selection only.',
      method: hasExternalDecision ? 'external-decision-validated' : 'deterministic-catalog-ranking',
      externalDecisionPaths: brief.sections
        .map((section, index) => section.decision ? `brief.sections[${index}].decision` : null)
        .filter(Boolean),
      // Copy is an external choice too, so the boundary names where it came from.
      externalContentPaths: brief.sections
        .map((section, index) => section.content ? `brief.sections[${index}].content` : null)
        .filter(Boolean)
    },
    brief: {
      source: brief.source,
      briefVersion: '1.0.0',
      intent: brief.intent,
      selectionPlanSource: brief.selectionPlanSource,
      page: brief.page
    },
    exemplars: {
      policy: 'Promoted best-of-N exemplars are ranked ahead of non-gold candidates for their matching type.',
      candidatesByType: exemplarCandidates
    },
    compositionVersion: '1.0.0',
    core: brief.core,
    sections: selected.map((item, index) => ({
      order: index + 1,
      type: item.plan.type,
      purpose: item.plan.purpose,
      module: item.candidate.moduleRef,
      moduleId: item.candidate.module.name,
      variants: item.candidate.resolvedVariants,
      ...(item.plan.content ? { content: item.plan.content } : {}),
      selectionReason: selectionReason(item, item.plan),
      catalogProvenance: {
        source: item.candidate.module.provenance.source,
        variant: item.candidate.module.provenance.variant,
        recordId: item.candidate.module.corpusSource.recordId,
        sectionSpan: item.candidate.module.corpusSource.sectionSpan,
        gateProfile: item.candidate.module.gateProfile
      },
      candidateRanking: rankedCandidates[index].map(candidateLog)
    }))
  };
}

function main(args) {
  if (args.length !== 2) {
    fail('usage: node v3/scripts/composer-select.js <brief.json> <v3/composer/<run>/selection.json>');
  }
  const briefFile = path.resolve(args[0]);
  const selectionFile = path.resolve(args[1]);
  assertRunArtifact(selectionFile, 'selection output');
  const brief = normalizeBrief(readJson(briefFile, 'brief'), briefFile);
  const catalog = readCatalog();
  const selection = buildSelection(brief, catalog, readGoldExemplars(catalog));
  fs.mkdirSync(path.dirname(selectionFile), { recursive: true });
  fs.writeFileSync(selectionFile, `${JSON.stringify(selection, null, 2)}\n`);
  process.stdout.write(`selected ${selection.sections.length} section(s): ${displayPath(selectionFile)}\n`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
