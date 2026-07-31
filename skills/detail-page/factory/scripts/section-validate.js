#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const REQUIRED_FILES = ['module.json', 'template.html', 'MODULE.md'];
const MODULE_TYPES = new Set([
  'hero', 'proof', 'comparison', 'process', 'pricing',
  'faq', 'cta', 'gallery', 'feature', 'footer-band'
]);
const VARIANT_ENUMS = {
  layoutArchetype: new Set(['centered', 'split', 'stack', 'grid', 'rail', 'timeline', 'comparison-table', 'media-led']),
  density: new Set(['airy', 'standard', 'compact']),
  backgroundBleed: new Set(['surface-contained', 'surface-bleed', 'card-contained', 'contrast-bleed', 'media-bleed']),
  motion: new Set(['none', 'reveal', 'stagger', 'scroll-linked']),
  artDirection: new Set(['typographic', 'editorial', 'product-ui', 'documentary', 'data-led', 'photographic'])
};
const GATE_PROFILES = new Set(['section-baseline-v1', 'section-media-v1', 'section-motion-v1']);
const TYPE_REQUIRED_SLOTS = {
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

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function displayPath(target) {
  const relative = path.relative(process.cwd(), target);
  return relative && !relative.startsWith('..') ? relative : target;
}

function addViolation(violations, file, rule, detail) {
  violations.push({ file, rule, detail });
}

function validateSlotDefinition(slotName, definition, requiredByType, moduleFile, violations) {
  const contract = SLOT_CONTRACT[slotName];
  if (!contract) {
    addViolation(violations, moduleFile, 'slot-unknown', `slots.${slotName} is not in the SECTION-SCHEMA slot contract`);
    return;
  }
  if (!isPlainObject(definition)) {
    addViolation(violations, moduleFile, 'slot-shape', `slots.${slotName} must be an object`);
    return;
  }
  if (definition.type !== contract.type) {
    addViolation(violations, moduleFile, 'slot-type', `slots.${slotName}.type must be ${contract.type}`);
  }
  if (typeof definition.required !== 'boolean') {
    addViolation(violations, moduleFile, 'slot-required-flag', `slots.${slotName}.required must be boolean`);
  } else if (requiredByType && definition.required !== true) {
    addViolation(violations, moduleFile, 'slot-required', `slots.${slotName} is required for this module type`);
  }

  if (contract.type === 'asset') return;
  const minKey = contract.type === 'collection' ? 'minItems' : 'minChars';
  const maxKey = contract.type === 'collection' ? 'maxItems' : 'maxChars';
  const declaredMin = definition[minKey];
  const declaredMax = definition[maxKey];
  if (!Number.isInteger(declaredMin) || !Number.isInteger(declaredMax) || declaredMin > declaredMax) {
    addViolation(violations, moduleFile, 'slot-range-shape', `slots.${slotName} needs integer ${minKey}/${maxKey} with min <= max`);
    return;
  }
  if (declaredMin < contract[minKey] || declaredMax > contract[maxKey]) {
    addViolation(
      violations,
      moduleFile,
      'slot-range',
      `slots.${slotName} must stay within ${contract[minKey]}–${contract[maxKey]} ${contract.type === 'collection' ? 'items' : 'chars'}`
    );
  }
}

function validateTmi(tmi, moduleFile, violations) {
  if (!isPlainObject(tmi)) {
    addViolation(violations, moduleFile, 'tmi-shape', 'tmi must be an object');
    return;
  }
  const keys = ['status', 'why', 'dependencies', 'changeImpact', 'coachComment', 'perfectScoreExampleLink'];
  for (const key of keys) {
    if (!(key in tmi)) addViolation(violations, moduleFile, 'tmi-field', `tmi.${key} is required as a G1.6 placeholder`);
  }
  if (tmi.status !== 'pending-g1.6') addViolation(violations, moduleFile, 'tmi-status', 'tmi.status must be pending-g1.6');
  if (!Array.isArray(tmi.dependencies)) addViolation(violations, moduleFile, 'tmi-dependencies', 'tmi.dependencies must be an array');
  if (!Array.isArray(tmi.changeImpact)) addViolation(violations, moduleFile, 'tmi-change-impact', 'tmi.changeImpact must be an array');
  for (const key of ['why', 'coachComment', 'perfectScoreExampleLink']) {
    if (tmi[key] !== null) addViolation(violations, moduleFile, 'tmi-reserved-content', `tmi.${key} must remain null until G1.6`);
  }
}

function collectTemplateSlots(template) {
  const slots = new Set();
  const matcher = /\bdata-slot(?:-href)?\s*=\s*(["'])([A-Za-z][A-Za-z0-9]*)\1/g;
  let match;
  while ((match = matcher.exec(template)) !== null) slots.add(match[2]);
  return slots;
}

function validateTemplate(template, templateFile, declaredSlots, violations) {
  const rawHex = template.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  for (const literal of rawHex) addViolation(violations, templateFile, 'raw-hex', `${literal} is a raw color literal`);

  const rawColorFunctions = template.match(/\b(?:rgb|rgba|hsl|hsla|hwb|oklch|oklab)\s*\(/gi) || [];
  for (const literal of rawColorFunctions) addViolation(violations, templateFile, 'raw-color-function', `${literal.trim()} is a raw color function`);

  const rawPx = template.match(/\b\d+(?:\.\d+)?px\b/gi) || [];
  for (const literal of rawPx) addViolation(violations, templateFile, 'raw-px', `${literal} must use a spacing/type/size token`);

  const primitiveRefs = template.match(/var\(\s*--brand-[A-Za-z0-9-]+\s*\)/g) || [];
  for (const literal of primitiveRefs) addViolation(violations, templateFile, 'primitive-token-ref', `${literal} bypasses semantic tokens`);

  const templateSlots = collectTemplateSlots(template);
  for (const slotName of Object.keys(declaredSlots)) {
    if (!templateSlots.has(slotName)) {
      addViolation(violations, templateFile, 'slot-missing-in-template', `declared slot ${slotName} has no data-slot anchor`);
    }
  }
  for (const slotName of templateSlots) {
    if (!Object.prototype.hasOwnProperty.call(declaredSlots, slotName)) {
      addViolation(violations, templateFile, 'slot-undeclared-in-template', `data-slot ${slotName} is not declared in module.json`);
    }
  }
}

function validateModule(moduleDir) {
  const violations = [];
  const resolvedDir = path.resolve(moduleDir);
  const shownDir = displayPath(resolvedDir);
  if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
    addViolation(violations, shownDir, 'module-directory', 'module directory does not exist');
    return { shownDir, violations };
  }

  for (const fileName of REQUIRED_FILES) {
    const filePath = path.join(resolvedDir, fileName);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      addViolation(violations, displayPath(filePath), 'required-file', `${fileName} is required`);
    }
  }

  const moduleFile = path.join(resolvedDir, 'module.json');
  const templateFile = path.join(resolvedDir, 'template.html');
  let module;
  if (fs.existsSync(moduleFile)) {
    try {
      module = JSON.parse(fs.readFileSync(moduleFile, 'utf8'));
    } catch (error) {
      addViolation(violations, displayPath(moduleFile), 'json-parse', error.message);
    }
  }

  if (!isPlainObject(module)) return { shownDir, violations };
  const shownModuleFile = displayPath(moduleFile);
  if (module.schemaVersion !== '1.0.0') addViolation(violations, shownModuleFile, 'schema-version', 'schemaVersion must be 1.0.0');
  if (typeof module.name !== 'string' || !/^[a-z][a-z0-9-]*$/.test(module.name)) {
    addViolation(violations, shownModuleFile, 'module-name', 'name must be a lowercase kebab-case string');
  }
  if (!MODULE_TYPES.has(module.type)) addViolation(violations, shownModuleFile, 'module-type', `type must be one of: ${[...MODULE_TYPES].join(', ')}`);

  const slots = module.slots;
  if (!isPlainObject(slots) || Object.keys(slots).length === 0) {
    addViolation(violations, shownModuleFile, 'slots-shape', 'slots must be a non-empty object');
  } else {
    const requiredSlots = TYPE_REQUIRED_SLOTS[module.type] || [];
    for (const requiredSlot of requiredSlots) {
      if (!Object.prototype.hasOwnProperty.call(slots, requiredSlot)) {
        addViolation(violations, shownModuleFile, 'type-required-slot', `${requiredSlot} is required for type ${module.type}`);
      }
    }
    for (const [slotName, definition] of Object.entries(slots)) {
      validateSlotDefinition(slotName, definition, requiredSlots.includes(slotName), shownModuleFile, violations);
    }
  }

  if (!isPlainObject(module.variants)) {
    addViolation(violations, shownModuleFile, 'variants-shape', 'variants must be an object');
  } else {
    for (const [axis, values] of Object.entries(VARIANT_ENUMS)) {
      if (!Object.prototype.hasOwnProperty.call(module.variants, axis)) {
        addViolation(violations, shownModuleFile, 'variant-axis', `variants.${axis} is required`);
      } else if (!values.has(module.variants[axis])) {
        addViolation(violations, shownModuleFile, 'variant-value', `variants.${axis} must be one of: ${[...values].join(', ')}`);
      }
    }
    for (const axis of Object.keys(module.variants)) {
      if (!Object.prototype.hasOwnProperty.call(VARIANT_ENUMS, axis)) {
        addViolation(violations, shownModuleFile, 'variant-axis-unknown', `variants.${axis} is not a defined axis`);
      }
    }
  }

  if (!isPlainObject(module.corpusSource) || typeof module.corpusSource.recordId !== 'string' || module.corpusSource.recordId.length === 0 || typeof module.corpusSource.sectionSpan !== 'string' || module.corpusSource.sectionSpan.length === 0) {
    addViolation(violations, shownModuleFile, 'corpus-source', 'corpusSource requires non-empty recordId and sectionSpan');
  }
  if (!GATE_PROFILES.has(module.gateProfile)) addViolation(violations, shownModuleFile, 'gate-profile', `gateProfile must be one of: ${[...GATE_PROFILES].join(', ')}`);
  validateTmi(module.tmi, shownModuleFile, violations);

  if (fs.existsSync(templateFile) && isPlainObject(slots)) {
    validateTemplate(fs.readFileSync(templateFile, 'utf8'), displayPath(templateFile), slots, violations);
  }
  return { shownDir, violations };
}

function main(args) {
  if (args.length === 0) {
    console.error('Usage: node v3/scripts/section-validate.js <moduleDir>...');
    return 1;
  }
  let violationCount = 0;
  for (const moduleDir of args) {
    const result = validateModule(moduleDir);
    if (result.violations.length === 0) {
      console.log(`PASS ${result.shownDir}`);
      continue;
    }
    violationCount += result.violations.length;
    console.log(`FAIL ${result.shownDir}`);
    for (const violation of result.violations) {
      console.log(`  [${violation.rule}] ${violation.file}: ${violation.detail}`);
    }
  }
  if (violationCount > 0) console.log(`RESULT: ${violationCount} violation(s)`);
  else console.log('RESULT: all modules pass');
  return violationCount > 0 ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
