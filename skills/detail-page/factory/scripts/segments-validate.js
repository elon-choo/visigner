#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const TYPES = new Set([
  'hero', 'proof', 'comparison', 'process', 'pricing', 'faq', 'cta',
  'gallery', 'feature', 'footer-band', 'unknown'
]);
const CONFIDENCES = new Set(['high', 'med', 'low']);

function usage() {
  process.stderr.write('usage: node v3/scripts/segments-validate.js <segments.json|directory> [...]\n');
}

function filesFromArgument(argument) {
  if (!fs.existsSync(argument)) return [`!missing:${argument}`];
  const stat = fs.statSync(argument);
  if (stat.isDirectory()) {
    return fs.readdirSync(argument)
      .filter((file) => file.endsWith('.json'))
      .sort()
      .map((file) => path.join(argument, file));
  }
  return [argument];
}

function addError(errors, prefix, message) {
  errors.push(`${prefix}: ${message}`);
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function validateFile(filePath) {
  const errors = [];
  if (filePath.startsWith('!missing:')) return [`${filePath.slice(9)}: file does not exist`];
  let document;
  try {
    document = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return [`${filePath}: invalid JSON (${error.message})`];
  }
  const prefix = filePath;
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return [`${prefix}: root must be an object`];
  }
  if (typeof document.record_id !== 'string' || !document.record_id.trim()) addError(errors, prefix, 'record_id must be a non-empty string');
  if (!['px', 'tile-index'].includes(document.coordinate_unit)) addError(errors, prefix, 'coordinate_unit must be px or tile-index');
  const bound = document.coordinate_unit === 'tile-index' ? document.tile_count : document.page_height_px;
  const boundName = document.coordinate_unit === 'tile-index' ? 'tile_count' : 'page_height_px';
  if (!isPositiveInteger(bound)) addError(errors, prefix, `${boundName} must be a positive integer`);
  if (!Array.isArray(document.spans) || document.spans.length === 0) {
    addError(errors, prefix, 'spans must be a non-empty array');
    return errors;
  }

  let previousEnd = null;
  document.spans.forEach((span, index) => {
    const item = `${prefix} span[${index}]`;
    if (!span || typeof span !== 'object' || Array.isArray(span)) {
      addError(errors, item, 'must be an object');
      return;
    }
    if (span.order !== index + 1) addError(errors, item, `order must be ${index + 1}`);
    if (!TYPES.has(span.type)) addError(errors, item, `type must be a SECTION-SCHEMA enum or unknown (got ${JSON.stringify(span.type)})`);
    if (!Number.isInteger(span.y_start) || !Number.isInteger(span.y_end)) addError(errors, item, 'y_start and y_end must be integers');
    else if (!isPositiveInteger(bound) || span.y_start < 0 || span.y_end > bound || span.y_start >= span.y_end) {
      addError(errors, item, `y range must satisfy 0 <= y_start < y_end <= ${boundName}`);
    }
    if (span.heading_text !== null && typeof span.heading_text !== 'string') addError(errors, item, 'heading_text must be a string or null');
    if (!CONFIDENCES.has(span.confidence)) addError(errors, item, 'confidence must be high, med, or low');
    if (typeof span.evidence !== 'string' || !span.evidence.trim()) addError(errors, item, 'evidence must be a non-empty string');
    if (previousEnd !== null && Number.isInteger(span.y_start) && span.y_start < previousEnd) {
      addError(errors, item, `overlaps previous span (previous y_end=${previousEnd}, y_start=${span.y_start})`);
    }
    if (Number.isInteger(span.y_end)) previousEnd = span.y_end;
  });
  return errors;
}

function main() {
  const arguments_ = process.argv.slice(2);
  if (!arguments_.length) {
    usage();
    process.exit(1);
  }
  const files = arguments_.flatMap(filesFromArgument);
  if (!files.length) {
    process.stderr.write('segments-validate: no JSON files found\n');
    process.exit(1);
  }
  let hasErrors = false;
  for (const filePath of files) {
    const errors = validateFile(filePath);
    if (errors.length) {
      hasErrors = true;
      errors.forEach((error) => process.stderr.write(`FAIL ${error}\n`));
    } else {
      process.stdout.write(`PASS ${filePath}\n`);
    }
  }
  process.exit(hasErrors ? 1 : 0);
}

main();
