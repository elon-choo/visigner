#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const REQUIRED_FILES = ['motion.json', 'motion.css'];
const SECTION_TYPES = new Set([
  'hero', 'proof', 'comparison', 'process', 'pricing',
  'faq', 'cta', 'gallery', 'feature', 'footer-band'
]);
const MOTION_VARIANTS = new Set(['none', 'reveal', 'stagger', 'scroll-linked']);
const CWV_GRADES = new Set(['low', 'medium', 'high']);
const ALLOWED_DURATION_TOKENS = new Set(['--dur-1', '--dur-2', '--dur-3']);
const ALLOWED_EASING_TOKENS = new Set(['--ease-out', '--ease-spring']);
const ALLOWED_SPACE_TOKENS = new Set([
  '--space-4', '--space-8', '--space-12', '--space-16', '--space-24',
  '--space-32', '--space-48', '--space-64', '--space-96'
]);
const MOTION_PROPERTIES = new Set(['opacity', 'transform']);
const LAYOUT_PROPERTY = /^(?:width|height|min-width|max-width|min-height|max-height|inline-size|block-size|min-inline-size|max-inline-size|min-block-size|max-block-size|top|right|bottom|left|inset(?:-.+)?|margin(?:-.+)?|padding(?:-.+)?|gap|row-gap|column-gap|flex(?:-basis)?|grid-template(?:-.+)?|grid(?:-.+)?|font-size|line-height)$/i;
const REQUIRED_CWV_COMMENTS = [
  '/* CWV-TRIPWIRE: layout-safe */',
  '/* CWV-TRIPWIRE: duration-cap */'
];

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

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function findMatchingBrace(source, openingIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = openingIndex; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function findReducedMotionBlocks(source) {
  const blocks = [];
  const matcher = /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{/gi;
  let match;
  while ((match = matcher.exec(source)) !== null) {
    const openingIndex = match.index + match[0].lastIndexOf('{');
    const closingIndex = findMatchingBrace(source, openingIndex);
    if (closingIndex === -1) {
      blocks.push({ start: match.index, end: source.length, content: source.slice(openingIndex + 1), malformed: true });
      break;
    }
    blocks.push({ start: match.index, end: closingIndex + 1, content: source.slice(openingIndex + 1, closingIndex), malformed: false });
    matcher.lastIndex = closingIndex + 1;
  }
  return blocks;
}

function removeRanges(source, ranges) {
  let result = source;
  for (const range of [...ranges].sort((left, right) => right.start - left.start)) {
    result = result.slice(0, range.start) + result.slice(range.end);
  }
  return result;
}

function collectDeclarations(source) {
  const declarations = [];
  const matcher = /(?:^|[;{}])\s*([A-Za-z-]+)\s*:\s*([^;{}]+?)\s*(?:;|(?=}))/g;
  let match;
  while ((match = matcher.exec(source)) !== null) {
    declarations.push({ property: match[1].toLowerCase(), value: match[2].trim() });
  }
  return declarations;
}

function collectCssVariables(value) {
  const variables = [];
  const matcher = /var\(\s*(--[A-Za-z0-9-]+)/g;
  let match;
  while ((match = matcher.exec(value)) !== null) variables.push(match[1]);
  return variables;
}

function findKeyframeBlocks(source) {
  const blocks = [];
  const matcher = /@(?:-[a-z]+-)?keyframes\s+[^\s{]+\s*\{/gi;
  let match;
  while ((match = matcher.exec(source)) !== null) {
    const openingIndex = match.index + match[0].lastIndexOf('{');
    const closingIndex = findMatchingBrace(source, openingIndex);
    if (closingIndex === -1) {
      blocks.push({ start: match.index, end: source.length, content: source.slice(openingIndex + 1), malformed: true });
      break;
    }
    blocks.push({ start: match.index, end: closingIndex + 1, content: source.slice(openingIndex + 1, closingIndex), malformed: false });
    matcher.lastIndex = closingIndex + 1;
  }
  return blocks;
}

function validateMetadata(metadata, directoryName, file, violations) {
  if (!isPlainObject(metadata)) {
    addViolation(violations, file, 'metadata-shape', 'motion.json must contain an object');
    return;
  }
  if (metadata.name !== directoryName) {
    addViolation(violations, file, 'name', `name must match directory name ${directoryName}`);
  }
  if (typeof metadata.purpose !== 'string' || metadata.purpose.trim().length === 0) {
    addViolation(violations, file, 'purpose', 'purpose must be a non-empty string');
  }
  if (!Array.isArray(metadata.sectionTypeHints) || metadata.sectionTypeHints.length === 0 || metadata.sectionTypeHints.some((type) => !SECTION_TYPES.has(type))) {
    addViolation(violations, file, 'section-type-hints', `sectionTypeHints must be a non-empty array using: ${[...SECTION_TYPES].join(', ')}`);
  }
  if (!MOTION_VARIANTS.has(metadata.motionVariant)) {
    addViolation(violations, file, 'motion-variant', `motionVariant must be one of: ${[...MOTION_VARIANTS].join(', ')}`);
  }
  if (!isPlainObject(metadata.cwvImpact) || !CWV_GRADES.has(metadata.cwvImpact.grade) || typeof metadata.cwvImpact.rationale !== 'string' || metadata.cwvImpact.rationale.trim().length === 0) {
    addViolation(violations, file, 'cwv-impact', 'cwvImpact requires a low|medium|high grade and non-empty rationale');
  }
  if (!isPlainObject(metadata.accessibility) || typeof metadata.accessibility.reducedMotionFallback !== 'string' || metadata.accessibility.reducedMotionFallback.trim().length === 0) {
    addViolation(violations, file, 'reduced-motion-metadata', 'accessibility.reducedMotionFallback must be a non-empty string');
  }
  if (!isPlainObject(metadata.cwvTripwire) || typeof metadata.cwvTripwire.layoutShift !== 'string' || metadata.cwvTripwire.layoutShift.trim().length === 0 || typeof metadata.cwvTripwire.longAnimation !== 'string' || metadata.cwvTripwire.longAnimation.trim().length === 0) {
    addViolation(violations, file, 'cwv-tripwire-metadata', 'cwvTripwire requires non-empty layoutShift and longAnimation strings');
  }
}

function validateReducedMotion(source, file, violations) {
  const blocks = findReducedMotionBlocks(source);
  if (blocks.length === 0) {
    addViolation(violations, file, 'reduced-motion-block', '@media (prefers-reduced-motion: reduce) is required');
    return { blocks, fallback: '' };
  }
  if (blocks.some((block) => block.malformed)) {
    addViolation(violations, file, 'reduced-motion-block', 'reduced-motion media block has an unmatched brace');
  }
  const fallback = blocks.map((block) => block.content).join('\n');
  if (!/\banimation\s*:\s*none\s*(?:!important\s*)?;/i.test(fallback)) {
    addViolation(violations, file, 'reduced-motion-animation', 'reduced-motion fallback must set animation: none');
  }
  if (!/\btransition\s*:\s*none\s*(?:!important\s*)?;/i.test(fallback)) {
    addViolation(violations, file, 'reduced-motion-transition', 'reduced-motion fallback must set transition: none');
  }
  return { blocks, fallback };
}

function validateReducedMotionEndState(activeSource, fallback, file, violations) {
  const activeDeclarations = collectDeclarations(activeSource);
  if (activeDeclarations.some((declaration) => declaration.property === 'transform') && !/\btransform\s*:\s*none\s*(?:!important\s*)?;/i.test(fallback)) {
    addViolation(violations, file, 'reduced-motion-transform', 'reduced-motion fallback must reset transform to none');
  }
  if (activeDeclarations.some((declaration) => declaration.property === 'opacity') && !/\bopacity\s*:\s*1(?:\.0+)?\s*(?:!important\s*)?;/i.test(fallback)) {
    addViolation(violations, file, 'reduced-motion-opacity', 'reduced-motion fallback must leave opacity at 1');
  }
}

function validateCwvComments(source, file, violations) {
  for (const comment of REQUIRED_CWV_COMMENTS) {
    if (!source.includes(comment)) addViolation(violations, file, 'cwv-tripwire-comment', `${comment} is required`);
  }
}

function validateTransitionProperties(activeSource, file, violations) {
  for (const declaration of collectDeclarations(activeSource)) {
    if (declaration.property !== 'transition' && declaration.property !== 'transition-property') continue;
    const value = declaration.value.toLowerCase();
    if (value === 'none') continue;
    if (/\ball\b/.test(value)) {
      addViolation(violations, file, 'cwv-transition-all', `${declaration.property}: all is not allowed`);
    }
    const segments = value.split(',');
    for (const segment of segments) {
      const propertyName = declaration.property === 'transition-property'
        ? segment.trim()
        : segment.trim().split(/\s+/)[0];
      if (!MOTION_PROPERTIES.has(propertyName)) {
        if (LAYOUT_PROPERTY.test(propertyName)) {
          addViolation(violations, file, 'cwv-layout-transition', `${propertyName} may not appear in ${declaration.property}`);
        } else {
          addViolation(violations, file, 'cwv-animated-property', `${propertyName || 'an implicit property'} is not allowed; only opacity and transform may transition`);
        }
      }
    }
  }
}

function validateKeyframes(activeSource, file, violations) {
  for (const block of findKeyframeBlocks(activeSource)) {
    if (block.malformed) {
      addViolation(violations, file, 'cwv-keyframes', 'keyframes block has an unmatched brace');
      continue;
    }
    for (const declaration of collectDeclarations(block.content)) {
      if (!MOTION_PROPERTIES.has(declaration.property)) {
        if (LAYOUT_PROPERTY.test(declaration.property)) {
          addViolation(violations, file, 'cwv-layout-keyframe', `${declaration.property} may not be animated in keyframes`);
        } else {
          addViolation(violations, file, 'cwv-animated-property', `${declaration.property} is not allowed in keyframes; only opacity and transform may animate`);
        }
      }
    }
  }
}

function validateTransformTokens(activeSource, file, violations) {
  for (const declaration of collectDeclarations(activeSource)) {
    if (declaration.property !== 'transform') continue;
    if (/\b\d+(?:\.\d+)?(?:px|rem|em|vh|vw|vmin|vmax|%|ch|ex|cm|mm|in|pt|pc)\b/i.test(declaration.value)) {
      addViolation(violations, file, 'motion-raw-offset', 'transform offsets must use an allowed --space-* token rather than a raw length');
    }
    for (const variable of collectCssVariables(declaration.value)) {
      if (!ALLOWED_SPACE_TOKENS.has(variable)) {
        addViolation(violations, file, 'motion-offset-token', `${variable} is not an allowed semantic space token for transform offsets`);
      }
    }
  }
}

function validateTiming(activeSource, file, violations) {
  const durationProperties = new Set([
    'transition', 'transition-duration', 'transition-delay',
    'animation', 'animation-duration', 'animation-delay'
  ]);
  const easingProperties = new Set([
    'transition', 'transition-timing-function',
    'animation', 'animation-timing-function'
  ]);
  const declarations = collectDeclarations(activeSource);

  for (const declaration of declarations) {
    const value = declaration.value;
    if (durationProperties.has(declaration.property)) {
      if (/\b\d+(?:\.\d+)?(?:ms|s)\b/i.test(value)) {
        addViolation(violations, file, 'cwv-raw-duration', `${declaration.property} must use --dur-1, --dur-2, or --dur-3`);
      }
      if (/\bcalc\s*\(/i.test(value)) {
        addViolation(violations, file, 'cwv-duration-expression', `${declaration.property} may not derive a longer duration with calc()`);
      }
      const durationTokens = collectCssVariables(value).filter((variable) => variable.startsWith('--dur-'));
      for (const durationToken of durationTokens) {
        if (!ALLOWED_DURATION_TOKENS.has(durationToken)) {
          addViolation(violations, file, 'cwv-duration-token', `${durationToken} exceeds the allowed duration-token set`);
        }
      }
      const noOp = (declaration.property === 'animation' || declaration.property === 'transition') && value.trim().toLowerCase() === 'none';
      if (!noOp && durationTokens.length === 0) {
        addViolation(violations, file, 'cwv-duration-token', `${declaration.property} must include an allowed duration token`);
      }
      if (/\binfinite\b/i.test(value)) {
        addViolation(violations, file, 'cwv-infinite-animation', `${declaration.property} may not repeat infinitely`);
      }
      if (declaration.property === 'animation') {
        const withoutVariables = value.replace(/var\([^)]*\)/g, '');
        if (/(?:^|[\s,])(?:[2-9]\d*|1\.\d+)(?=[\s,]|$)/.test(withoutVariables)) {
          addViolation(violations, file, 'cwv-repeated-animation', 'animation shorthand may not repeat more than once');
        }
      }
    }
    if (!easingProperties.has(declaration.property)) continue;
    const easingTokens = collectCssVariables(value).filter((variable) => variable.startsWith('--ease-'));
    for (const easingToken of easingTokens) {
      if (!ALLOWED_EASING_TOKENS.has(easingToken)) {
        addViolation(violations, file, 'motion-easing-token', `${easingToken} is not an allowed semantic easing token`);
      }
    }
    const noOp = (declaration.property === 'animation' || declaration.property === 'transition') && value.trim().toLowerCase() === 'none';
    if (!noOp && easingTokens.length === 0) {
      addViolation(violations, file, 'motion-easing-token', `${declaration.property} must include --ease-out or --ease-spring`);
    }
    const withoutVariables = value.replace(/var\([^)]*\)/g, '');
    if (/\b(?:linear|ease(?:-(?:in|out|in-out))?|cubic-bezier|steps|step-start|step-end)\b/i.test(withoutVariables)) {
      addViolation(violations, file, 'motion-raw-easing', `${declaration.property} may not use a raw easing value`);
    }
  }

  for (const declaration of declarations) {
    if (declaration.property !== 'animation-iteration-count') continue;
    const value = declaration.value.trim().toLowerCase();
    if (value === 'infinite' || /(?:^|\s)(?:[2-9]\d*|1\.\d+)(?:\s|$)/.test(value)) {
      addViolation(violations, file, 'cwv-repeated-animation', 'animation-iteration-count may not exceed 1 or be infinite');
    }
  }
}

function validateCss(source, file, violations) {
  validateCwvComments(source, file, violations);
  const withoutComments = stripComments(source);
  const reducedMotion = validateReducedMotion(withoutComments, file, violations);
  const activeSource = removeRanges(withoutComments, reducedMotion.blocks);
  validateReducedMotionEndState(activeSource, reducedMotion.fallback, file, violations);
  validateTransitionProperties(activeSource, file, violations);
  validateKeyframes(activeSource, file, violations);
  validateTransformTokens(activeSource, file, violations);
  validateTiming(activeSource, file, violations);
}

function validateMotion(motionDir) {
  const violations = [];
  const resolvedDir = path.resolve(motionDir);
  const shownDir = displayPath(resolvedDir);
  if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
    addViolation(violations, shownDir, 'motion-directory', 'motion directory does not exist');
    return { shownDir, violations };
  }

  for (const fileName of REQUIRED_FILES) {
    const file = path.join(resolvedDir, fileName);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      addViolation(violations, displayPath(file), 'required-file', `${fileName} is required`);
    }
  }

  const metadataFile = path.join(resolvedDir, 'motion.json');
  if (fs.existsSync(metadataFile)) {
    try {
      validateMetadata(JSON.parse(fs.readFileSync(metadataFile, 'utf8')), path.basename(resolvedDir), displayPath(metadataFile), violations);
    } catch (error) {
      addViolation(violations, displayPath(metadataFile), 'json-parse', error.message);
    }
  }

  const cssFile = path.join(resolvedDir, 'motion.css');
  if (fs.existsSync(cssFile)) {
    validateCss(fs.readFileSync(cssFile, 'utf8'), displayPath(cssFile), violations);
  }

  return { shownDir, violations };
}

function main(args) {
  if (args.length === 0) {
    console.error('Usage: node v3/scripts/motion-validate.js <motionDir>...');
    return 1;
  }

  let violationCount = 0;
  for (const motionDir of args) {
    const result = validateMotion(motionDir);
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
  else console.log('RESULT: all motions pass');
  return violationCount > 0 ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
