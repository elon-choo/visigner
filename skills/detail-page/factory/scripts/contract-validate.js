#!/usr/bin/env node
'use strict';

/*
 * Validate the Stage 4 catalog-consumption view without modifying modules.
 * The source files intentionally contain a small amount of legacy provenance
 * omission; normalization is read-only and is specified in CATALOG-CONTRACT.md.
 */

const fs = require('fs');
const path = require('path');

const V3_ROOT = path.resolve(__dirname, '..');
const MODULES_ROOT = path.join(V3_ROOT, 'modules');
const EXPECTED_MODULE_COUNT = 40;

const TYPES = [
  'hero', 'proof', 'comparison', 'process', 'pricing', 'faq', 'cta',
  'gallery', 'feature', 'footer-band'
];

const REQUIRED_SLOTS = {
  hero: ['headline', 'body', 'primaryCtaLabel', 'primaryCtaHref', 'media'],
  proof: ['headline', 'proofItems'],
  comparison: ['headline', 'comparisonItems'],
  process: ['headline', 'processSteps'],
  pricing: ['headline', 'pricePlans'],
  faq: ['headline', 'faqItems'],
  cta: ['headline', 'body', 'primaryCtaLabel', 'primaryCtaHref'],
  gallery: ['headline', 'galleryItems'],
  feature: ['headline', 'featureItems'],
  'footer-band': ['navItems', 'legalText']
};

const SLOT_CONTRACT = {
  eyebrow: { type: 'text', minChars: 0, maxChars: 32 },
  sectionLabel: { type: 'text', minChars: 0, maxChars: 32 },
  badge: { type: 'text', minChars: 0, maxChars: 24 },
  headline: { type: 'text', minChars: 8, maxChars: 72 },
  subheadline: { type: 'text', minChars: 0, maxChars: 120 },
  body: { type: 'rich-text', minChars: 24, maxChars: 360 },
  primaryCtaLabel: { type: 'text', minChars: 2, maxChars: 32 },
  primaryCtaHref: { type: 'url', minChars: 1, maxChars: 2048 },
  secondaryCtaLabel: { type: 'text', minChars: 2, maxChars: 32 },
  secondaryCtaHref: { type: 'url', minChars: 1, maxChars: 2048 },
  media: { type: 'asset' },
  mediaAlt: { type: 'text', minChars: 0, maxChars: 160 },
  proofItems: { type: 'collection', minItems: 2, maxItems: 6 },
  comparisonItems: { type: 'collection', minItems: 2, maxItems: 8 },
  processSteps: { type: 'collection', minItems: 2, maxItems: 7 },
  pricePlans: { type: 'collection', minItems: 1, maxItems: 4 },
  faqItems: { type: 'collection', minItems: 3, maxItems: 10 },
  galleryItems: { type: 'collection', minItems: 2, maxItems: 12 },
  featureItems: { type: 'collection', minItems: 2, maxItems: 8 },
  navItems: { type: 'collection', minItems: 1, maxItems: 8 },
  legalText: { type: 'rich-text', minChars: 1, maxChars: 240 },
  contactLabel: { type: 'text', minChars: 2, maxChars: 48 },
  sourceNote: { type: 'text', minChars: 0, maxChars: 180 },
  footnote: { type: 'rich-text', minChars: 0, maxChars: 240 }
};

const VARIANT_ENUMS = {
  layoutArchetype: new Set([
    'centered', 'split', 'stack', 'grid', 'rail', 'timeline',
    'comparison-table', 'media-led'
  ]),
  density: new Set(['airy', 'standard', 'compact']),
  backgroundBleed: new Set([
    'surface-contained', 'surface-bleed', 'card-contained', 'contrast-bleed',
    'media-bleed'
  ]),
  motion: new Set(['none', 'reveal', 'stagger', 'scroll-linked']),
  artDirection: new Set([
    'typographic', 'editorial', 'product-ui', 'documentary', 'data-led',
    'photographic'
  ])
};

const GATE_PROFILES = new Set([
  'section-baseline-v1', 'section-media-v1', 'section-motion-v1'
]);
const SOURCE_PROVENANCE = new Set(['mined', 'schema-authored']);
const VARIANT_PROVENANCE = new Set([
  'structure-mined', 'structure-mined; axis-composed', 'schema-authored'
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function sortedFiles() {
  if (!fs.existsSync(MODULES_ROOT)) return [];
  const files = [];
  for (const type of fs.readdirSync(MODULES_ROOT).sort()) {
    const typeRoot = path.join(MODULES_ROOT, type);
    if (!fs.statSync(typeRoot).isDirectory()) continue;
    for (const name of fs.readdirSync(typeRoot).sort()) {
      const file = path.join(typeRoot, name, 'module.json');
      if (fs.existsSync(file) && fs.statSync(file).isFile()) files.push(file);
    }
  }
  return files;
}

function exactKeys(value, expected, label, errors) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.join('\u0000') !== wanted.join('\u0000')) {
    errors.push(`${label} keys must be ${wanted.join(',')}`);
  }
}

function validateSlots(module, errors) {
  if (!isObject(module.slots) || Object.keys(module.slots).length === 0) {
    errors.push('slots must be a non-empty object');
    return;
  }

  for (const [slotName, slot] of Object.entries(module.slots)) {
    const contract = SLOT_CONTRACT[slotName];
    if (!contract) {
      errors.push(`unknown slot ${slotName}`);
      continue;
    }
    if (!isObject(slot)) {
      errors.push(`slots.${slotName} must be an object`);
      continue;
    }
    if (typeof slot.required !== 'boolean') {
      errors.push(`slots.${slotName}.required must be boolean`);
    }
    if (slot.type !== contract.type) {
      errors.push(`slots.${slotName}.type must be ${contract.type}`);
      continue;
    }

    if (contract.type === 'asset') {
      exactKeys(slot, ['type', 'required'], `slots.${slotName}`, errors);
      continue;
    }

    const rangeKeys = contract.type === 'collection'
      ? ['minItems', 'maxItems']
      : ['minChars', 'maxChars'];
    exactKeys(slot, ['type', 'required', ...rangeKeys], `slots.${slotName}`, errors);
    for (const rangeKey of rangeKeys) {
      if (!Number.isInteger(slot[rangeKey])) {
        errors.push(`slots.${slotName}.${rangeKey} must be an integer`);
      }
    }
    if (Number.isInteger(slot[rangeKeys[0]]) && Number.isInteger(slot[rangeKeys[1]])) {
      if (slot[rangeKeys[0]] !== contract[rangeKeys[0]] || slot[rangeKeys[1]] !== contract[rangeKeys[1]]) {
        errors.push(`slots.${slotName} range must be ${contract[rangeKeys[0]]}-${contract[rangeKeys[1]]}`);
      }
      if (slot[rangeKeys[0]] > slot[rangeKeys[1]]) {
        errors.push(`slots.${slotName} minimum exceeds maximum`);
      }
    }
  }

  for (const slotName of REQUIRED_SLOTS[module.type] || []) {
    if (!hasOwn(module.slots, slotName)) {
      errors.push(`missing required slot ${slotName}`);
    } else if (module.slots[slotName].required !== true) {
      errors.push(`required slot ${slotName} must set required=true`);
    }
  }
}

function validateVariants(module, errors) {
  if (!isObject(module.variants)) {
    errors.push('variants must be an object');
    return;
  }
  exactKeys(module.variants, Object.keys(VARIANT_ENUMS), 'variants', errors);
  for (const [axis, allowed] of Object.entries(VARIANT_ENUMS)) {
    if (!allowed.has(module.variants[axis])) {
      errors.push(`variants.${axis} has invalid value ${String(module.variants[axis])}`);
    }
  }
}

function normalizeProvenance(module, errors) {
  const directSource = module.provenance;
  const directVariant = module.variantProvenance;
  if (directSource !== undefined && !SOURCE_PROVENANCE.has(directSource)) {
    errors.push(`provenance has invalid value ${String(directSource)}`);
  }
  if (directVariant !== undefined && !VARIANT_PROVENANCE.has(directVariant)) {
    errors.push(`variantProvenance has invalid value ${String(directVariant)}`);
  }

  const source = SOURCE_PROVENANCE.has(directSource)
    ? directSource
    : (module.corpusSource && module.corpusSource.recordId === 'schema'
      ? 'schema-authored'
      : 'mined');
  const variant = VARIANT_PROVENANCE.has(directVariant)
    ? directVariant
    : (source === 'schema-authored' ? 'schema-authored' : 'structure-mined');

  if (source === 'schema-authored' && variant !== 'schema-authored') {
    errors.push('schema-authored source must use schema-authored variant provenance');
  }
  if (source === 'mined' && variant === 'schema-authored') {
    errors.push('mined source cannot use schema-authored variant provenance');
  }
  return { source, variant };
}

function validateCorpusSource(module, errors) {
  if (!isObject(module.corpusSource)) {
    errors.push('corpusSource must be an object');
    return;
  }
  exactKeys(module.corpusSource, ['recordId', 'sectionSpan'], 'corpusSource', errors);
  if (typeof module.corpusSource.recordId !== 'string' || module.corpusSource.recordId.length === 0) {
    errors.push('corpusSource.recordId must be a non-empty string');
  }
  if (typeof module.corpusSource.sectionSpan !== 'string' || module.corpusSource.sectionSpan.length === 0) {
    errors.push('corpusSource.sectionSpan must be a non-empty string');
    return;
  }
  const { recordId, sectionSpan } = module.corpusSource;
  if (recordId === 'schema') {
    if (!new RegExp(`^v3/SECTION-SCHEMA\\.md#${module.type}$`).test(sectionSpan)) {
      errors.push('schema corpusSource.sectionSpan must point to its SECTION-SCHEMA type anchor');
    }
  } else if (!/^captures\/.+\/tile_[^/]+\.png#[^#]+$/.test(sectionSpan)) {
    errors.push('corpusSource.sectionSpan must identify a capture tile and observed area');
  }
}

function validateModule(file) {
  const errors = [];
  const relative = path.relative(V3_ROOT, file).split(path.sep).join('/');
  const nameDirectory = path.basename(path.dirname(file));
  const typeDirectory = path.basename(path.dirname(path.dirname(file)));
  let module;
  try {
    module = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return { relative, errors: [`invalid JSON: ${error.message}`] };
  }
  if (!isObject(module)) {
    return { relative, errors: ['module.json must contain an object'] };
  }
  if (module.schemaVersion !== '1.0.0') errors.push('schemaVersion must be 1.0.0');
  if (typeof module.name !== 'string' || module.name.length === 0) errors.push('name must be a non-empty string');
  if (module.name !== nameDirectory) errors.push('name must match module directory');
  if (!TYPES.includes(module.type)) errors.push(`type has invalid value ${String(module.type)}`);
  if (module.type !== typeDirectory) errors.push('type must match its parent directory');

  if (TYPES.includes(module.type)) validateSlots(module, errors);
  validateVariants(module, errors);
  validateCorpusSource(module, errors);
  const provenance = normalizeProvenance(module, errors);
  if (!GATE_PROFILES.has(module.gateProfile)) errors.push(`gateProfile has invalid value ${String(module.gateProfile)}`);

  return {
    relative,
    errors,
    name: module.name || nameDirectory,
    type: module.type || typeDirectory,
    slotCount: isObject(module.slots) ? Object.keys(module.slots).length : 0,
    provenance
  };
}

const files = sortedFiles();
const results = files.map(validateModule);
if (files.length !== EXPECTED_MODULE_COUNT) {
  process.stderr.write(`contract-validate: expected ${EXPECTED_MODULE_COUNT} modules, found ${files.length}\n`);
}

for (let index = 0; index < results.length; index += 1) {
  const result = results[index];
  if (result.errors.length > 0) {
    process.stdout.write(`FAIL ${String(index + 1).padStart(2, '0')}/${EXPECTED_MODULE_COUNT} ${result.relative} :: ${result.errors.join('; ')}\n`);
    continue;
  }
  process.stdout.write(
    `PASS ${String(index + 1).padStart(2, '0')}/${EXPECTED_MODULE_COUNT} ${result.relative}` +
    ` slots=${result.slotCount} axes=5 provenance=${result.provenance.source}` +
    ` variantProvenance=${result.provenance.variant} gate=ok\n`
  );
}

const failed = files.length !== EXPECTED_MODULE_COUNT || results.some((result) => result.errors.length > 0);
process.exitCode = failed ? 1 : 0;
