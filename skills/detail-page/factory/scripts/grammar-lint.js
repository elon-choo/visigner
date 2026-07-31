#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const VARIANT_ENUMS = {
  layoutArchetype: new Set(['centered', 'split', 'stack', 'grid', 'rail', 'timeline', 'comparison-table', 'media-led']),
  density: new Set(['airy', 'standard', 'compact']),
  backgroundBleed: new Set(['surface-contained', 'surface-bleed', 'card-contained', 'contrast-bleed', 'media-bleed']),
  motion: new Set(['none', 'reveal', 'stagger', 'scroll-linked']),
  artDirection: new Set(['typographic', 'editorial', 'product-ui', 'documentary', 'data-led', 'photographic'])
};
const VARIANT_AXES = Object.keys(VARIANT_ENUMS);
const FULL_BLEED = new Set(['surface-bleed', 'contrast-bleed', 'media-bleed']);
const MAX_TYPE_ARCHETYPE_REPETITIONS = 1;
const TYPE_PAGE_LIMITS = Object.freeze({
  hero: 1,
  cta: 2,
  'footer-band': 1
});

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function displayPath(target) {
  const relative = path.relative(process.cwd(), target);
  return relative && !relative.startsWith('..') ? relative : target;
}

function addViolation(violations, rule, detail) {
  violations.push({ rule, detail });
}

function readJson(filePath, violations, rule) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    addViolation(violations, rule, `${displayPath(filePath)}: ${error.message}`);
    return null;
  }
}

function validateCore(core, violations) {
  if (!isPlainObject(core)) {
    addViolation(violations, 'core-shape', 'core must be an object with tokenSet, typographyVoices, and signatureMotif');
    return;
  }
  if (typeof core.tokenSet !== 'string' || core.tokenSet.trim() === '') {
    addViolation(violations, 'core-token-set', 'core.tokenSet must be one non-empty token-set reference');
  }
  if (!isPlainObject(core.typographyVoices)) {
    addViolation(violations, 'core-typography', 'core.typographyVoices must map display, body, and latin to shared font tokens');
  } else {
    for (const voice of ['display', 'body', 'latin']) {
      if (typeof core.typographyVoices[voice] !== 'string' || core.typographyVoices[voice].trim() === '') {
        addViolation(violations, 'core-typography', `core.typographyVoices.${voice} must be a non-empty shared font token`);
      }
    }
  }
  if (typeof core.signatureMotif !== 'string' || core.signatureMotif.trim() === '') {
    addViolation(violations, 'core-signature-motif', 'core.signatureMotif must describe the page-wide motif once');
  }
}

function resolveModuleFile(compositionFile, moduleRef) {
  const resolvedRef = path.resolve(path.dirname(compositionFile), moduleRef);
  return path.basename(resolvedRef) === 'module.json' ? resolvedRef : path.join(resolvedRef, 'module.json');
}

function validateVariants(variants, label, violations) {
  if (!isPlainObject(variants)) {
    addViolation(violations, 'variants-shape', `${label} must be an object with all five variation axes`);
    return null;
  }
  for (const axis of VARIANT_AXES) {
    if (!Object.prototype.hasOwnProperty.call(variants, axis)) {
      addViolation(violations, 'variant-axis', `${label}.${axis} is required`);
    } else if (!VARIANT_ENUMS[axis].has(variants[axis])) {
      addViolation(violations, 'variant-value', `${label}.${axis} must use the SECTION-SCHEMA enum`);
    }
  }
  for (const axis of Object.keys(variants)) {
    if (!Object.prototype.hasOwnProperty.call(VARIANT_ENUMS, axis)) {
      addViolation(violations, 'variant-axis-unknown', `${label}.${axis} is not a SECTION-SCHEMA variation axis`);
    }
  }
  return VARIANT_AXES.every((axis) => VARIANT_ENUMS[axis].has(variants[axis])) ? variants : null;
}

function validateTemplateTokenGuard(templateFile, violations) {
  if (!fs.existsSync(templateFile) || !fs.statSync(templateFile).isFile()) {
    addViolation(violations, 'template-file', `${displayPath(templateFile)} is required for the composition token guard`);
    return;
  }
  const template = fs.readFileSync(templateFile, 'utf8');
  const checks = [
    ['token-raw-hex', /#[0-9a-fA-F]{3,8}\b/g, 'raw color literal'],
    ['token-raw-color-function', /\b(?:rgb|rgba|hsl|hsla|hwb|oklch|oklab)\s*\(/gi, 'raw color function'],
    ['token-raw-px', /\b\d+(?:\.\d+)?px\b/gi, 'raw px value'],
    ['token-primitive-ref', /var\(\s*--brand-[A-Za-z0-9-]+\s*\)/g, 'primitive --brand-* reference']
  ];
  for (const [rule, pattern, description] of checks) {
    const matches = template.match(pattern) || [];
    for (const match of matches) {
      addViolation(violations, rule, `${displayPath(templateFile)}: ${match.trim()} is a ${description}`);
    }
  }
}

function loadSection(compositionFile, entry, index, violations) {
  const label = `sections[${index}]`;
  if (!isPlainObject(entry)) {
    addViolation(violations, 'section-shape', `${label} must be an object`);
    return null;
  }
  for (const coreKey of ['tokenSet', 'typographyVoices', 'signatureMotif']) {
    if (Object.prototype.hasOwnProperty.call(entry, coreKey)) {
      addViolation(violations, 'section-core-override', `${label}.${coreKey} is a page-core value and cannot be overridden per section`);
    }
  }
  if (typeof entry.module !== 'string' || entry.module.trim() === '') {
    addViolation(violations, 'module-reference', `${label}.module must be a non-empty relative module path`);
    return null;
  }

  const moduleFile = resolveModuleFile(compositionFile, entry.module);
  if (!fs.existsSync(moduleFile) || !fs.statSync(moduleFile).isFile()) {
    addViolation(violations, 'module-file', `${label}.module does not resolve to ${displayPath(moduleFile)}`);
    return null;
  }
  const module = readJson(moduleFile, violations, 'module-json-parse');
  if (!isPlainObject(module)) return null;
  if (typeof module.type !== 'string' || module.type.trim() === '') {
    addViolation(violations, 'module-type', `${displayPath(moduleFile)} must provide a module type`);
    return null;
  }

  const defaultVariants = validateVariants(module.variants, `${displayPath(moduleFile)}.variants`, violations);
  const variants = Object.prototype.hasOwnProperty.call(entry, 'variants')
    ? validateVariants(entry.variants, `${label}.variants`, violations)
    : defaultVariants;
  validateTemplateTokenGuard(path.join(path.dirname(moduleFile), 'template.html'), violations);
  if (!variants) return null;

  return {
    index,
    type: module.type,
    variants
  };
}

function countDifferentAxes(left, right) {
  return VARIANT_AXES.filter((axis) => left.variants[axis] !== right.variants[axis]).length;
}

function validateCompositionRules(sections, violations) {
  const pairCounts = new Map();
  const typeCounts = new Map();
  for (const section of sections) {
    typeCounts.set(section.type, (typeCounts.get(section.type) || 0) + 1);
    const pair = `${section.type}|${section.variants.layoutArchetype}`;
    const nextCount = (pairCounts.get(pair) || 0) + 1;
    pairCounts.set(pair, nextCount);
    if (nextCount > MAX_TYPE_ARCHETYPE_REPETITIONS) {
      addViolation(violations, 'type-archetype-repeat', `sections[${section.index}] repeats (${section.type}, ${section.variants.layoutArchetype}); maximum is ${MAX_TYPE_ARCHETYPE_REPETITIONS}`);
    }
  }

  for (const [type, maximum] of Object.entries(TYPE_PAGE_LIMITS)) {
    const count = typeCounts.get(type) || 0;
    if (count > maximum) {
      addViolation(violations, 'type-page-limit', `${type} appears ${count} times; maximum is ${maximum} per page`);
    }
  }

  for (const section of sections) {
    if (section.type === 'hero' && section.index !== 0) {
      addViolation(violations, 'hero-position', `sections[${section.index}] is hero; hero may appear only as sections[0]`);
    }
    if (section.type === 'footer-band' && section.index !== sections.length - 1) {
      addViolation(violations, 'footer-band-position', `sections[${section.index}] is footer-band; footer-band may appear only as the final section`);
    }
  }

  for (let index = 1; index < sections.length; index += 1) {
    const previous = sections[index - 1];
    const current = sections[index];
    if (previous.type === current.type) {
      addViolation(violations, 'adjacent-same-type', `sections[${previous.index}] and sections[${current.index}] are both ${current.type}`);
    }
    const differentAxes = countDifferentAxes(previous, current);
    if (differentAxes < 2) {
      addViolation(violations, 'adjacent-variant-diversity', `sections[${previous.index}] and sections[${current.index}] differ on ${differentAxes} variation axis/axes; at least 2 are required`);
    }
    if (previous.variants.layoutArchetype === current.variants.layoutArchetype) {
      addViolation(violations, 'adjacent-layout-archetype', `sections[${previous.index}] and sections[${current.index}] both use ${current.variants.layoutArchetype}`);
    }
    if (FULL_BLEED.has(previous.variants.backgroundBleed) && FULL_BLEED.has(current.variants.backgroundBleed)) {
      addViolation(violations, 'full-bleed-consecutive', `sections[${previous.index}] and sections[${current.index}] are consecutive full-bleed sections`);
    }
  }

  const fullBleedCount = sections.filter((section) => FULL_BLEED.has(section.variants.backgroundBleed)).length;
  const maxFullBleed = Math.ceil(sections.length / 2);
  if (fullBleedCount > maxFullBleed) {
    addViolation(violations, 'full-bleed-frequency', `${fullBleedCount} full-bleed sections exceed the ${maxFullBleed} allowed for ${sections.length} sections`);
  }

  const movingCount = sections.filter((section) => section.variants.motion !== 'none').length;
  const maxMoving = Math.ceil(sections.length / 3);
  if (movingCount > maxMoving) {
    addViolation(violations, 'motion-density', `${movingCount} motion-bearing sections exceed the ${maxMoving} allowed for ${sections.length} sections`);
  }
}

function main(args) {
  if (args.length !== 1) {
    console.error('Usage: node v3/scripts/grammar-lint.js <composition.json>');
    return 1;
  }

  const compositionFile = path.resolve(args[0]);
  const violations = [];
  if (!fs.existsSync(compositionFile) || !fs.statSync(compositionFile).isFile()) {
    addViolation(violations, 'composition-file', `${displayPath(compositionFile)} does not exist or is not a file`);
  }
  const composition = violations.length === 0 ? readJson(compositionFile, violations, 'composition-json-parse') : null;
  if (!isPlainObject(composition)) {
    for (const violation of violations) console.log(`  [${violation.rule}] ${violation.detail}`);
    console.log(`RESULT: ${violations.length} violation(s)`);
    return 1;
  }

  if (composition.compositionVersion !== '1.0.0') {
    addViolation(violations, 'composition-version', 'compositionVersion must be 1.0.0');
  }
  validateCore(composition.core, violations);
  if (!Array.isArray(composition.sections) || composition.sections.length === 0) {
    addViolation(violations, 'sections-shape', 'sections must be a non-empty ordered array');
  } else {
    const sections = composition.sections
      .map((entry, index) => loadSection(compositionFile, entry, index, violations))
      .filter(Boolean);
    if (sections.length === composition.sections.length) validateCompositionRules(sections, violations);
  }

  if (violations.length === 0) {
    console.log(`PASS ${displayPath(compositionFile)}`);
    console.log(`RESULT: ${composition.sections.length} section(s) pass`);
    return 0;
  }
  console.log(`FAIL ${displayPath(compositionFile)}`);
  for (const violation of violations) console.log(`  [${violation.rule}] ${violation.detail}`);
  console.log(`RESULT: ${violations.length} violation(s)`);
  return 1;
}

process.exitCode = main(process.argv.slice(2));
