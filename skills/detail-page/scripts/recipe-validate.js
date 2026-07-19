'use strict';

const fs = require('fs');
const path = require('path');

const BLOCKS = Object.freeze([
  {
    id: 'token',
    name: 'TOKEN BLOCK',
    heading: /^##\s+1\s*(?:·|[-–—])\s*TOKEN BLOCK\b/iu,
    fields: [
      ['tokens.color_system', /^###\s+1\.1\s+Color\b/imu],
      ['tokens.typography_system', /^###\s+1\.2\s+Type\b/imu],
      ['tokens.spacing_scale', /^###\s+1\.3\s+Spacing\b/imu],
      ['tokens.radius_scale', /^###\s+1\.4\s+Radius\b/imu],
      ['tokens.elevation_system', /^###\s+1\.5\s+Elevation\b/imu],
      ['tokens.motion_tokens', /^###\s+1\.6\s+Motion\b/imu],
    ],
  },
  {
    id: 'layout',
    name: 'LAYOUT CONCEPT + STRUCTURE',
    heading: /^##\s+2\s*(?:·|[-–—])\s*LAYOUT CONCEPT\s*\+\s*STRUCTURE\b/iu,
    fields: [
      ['layout.concept', /\bConcept\s*\(one sentence\)\s*:/iu],
      ['layout.section_arc', /\bSection arc\b/iu],
      ['layout.grid', /\bGrid\s*:/iu],
      ['layout.alignment_and_splits', /\b(?:Split sections|left-aligned|alignment)\b/iu],
      ['layout.render_decomposition', /```[\s\S]+?```/u],
    ],
  },
  {
    id: 'signature',
    name: 'THE SIGNATURE',
    heading: /^##\s+3\s*(?:·|[-–—])\s*THE SIGNATURE\b/iu,
    fields: [],
  },
  {
    id: 'content',
    name: 'THE CONTENT',
    heading: /^##\s+4\s*(?:·|[-–—])\s*THE CONTENT\b/iu,
    fields: [
      ['content.navigation', /\*\*Nav:\*\*/u],
      ['content.hero', /\*\*Hero H1:\*\*/u],
      ['content.hero_subhead', /\*\*Subhead:\*\*/u],
      ['content.primary_product_render', /\*\*Product render\s*\(hero\)/iu],
      ['content.supporting_brands', /\*\*Logo strip:\*\*/u],
      ['content.statement', /\*\*Two-tone statement:\*\*/u],
      ['content.features', /\*\*Three-up features\*\*/u],
      ['content.chapter', /\*\*First chapter/iu],
    ],
  },
  {
    id: 'build',
    name: 'BUILD ORDER',
    heading: /^##\s+5\s*(?:·|[-–—])\s*BUILD ORDER\b/iu,
    fields: [
      ['build.literal_token_application', /^1\.\s+\*\*Scaffold\s*\+\s*tokens\.\*\*/imu],
      ['build.responsive_a11y_steps', /\bResponsive\s*\+\s*a11y\b/iu],
    ],
  },
  {
    id: 'anti_slop',
    name: 'ANTI-SLOP GUARDRAILS',
    heading: /^##\s+6\s*(?:·|[-–—])\s*ANTI-SLOP GUARDRAILS\b/iu,
    fields: [
      ['anti_slop.token_integrity_constraints', /\b(?:rounding|literal|exact)[^\n]*\b(?:token|value)|\b(?:token|value)[^\n]*\b(?:rounding|literal|exact)/iu],
      ['anti_slop.motion_restraint', /\b(?:motion|animation)\b/iu],
    ],
  },
]);

const STYLES_MARKER = /\[styles\]/u;
const BODY_MARKER = /\[body\]/u;
const TILE_MARKER = /\[tile(?:_[A-Za-z0-9-]+)?\]/u;
const SIGNATURE_MARKER = /\[(?:styles|tile(?:_[A-Za-z0-9-]+)?)\]/u;

function makeError(code, message) {
  return { code, message };
}

function findHeadings(lines, block) {
  const matches = [];
  lines.forEach((line, index) => {
    if (block.heading.test(line)) matches.push(index);
  });
  return matches;
}

function sectionText(lines, start, end) {
  // A provenance binding can live in the block heading itself (the proven
  // Content block uses `[body]` that way), so include the heading line.
  return lines.slice(start, end).join('\n');
}

function numberedSignatureMoves(text) {
  const lines = text.split('\n');
  const starts = [];
  lines.forEach((line, index) => {
    if (/^\d+\.\s+\*\*.+?\*\*/u.test(line)) starts.push(index);
  });
  return starts.map((start, index) => lines.slice(start, starts[index + 1] || lines.length).join('\n'));
}

function markerSummary(text) {
  return {
    styles: STYLES_MARKER.test(text),
    body: BODY_MARKER.test(text),
    tile: TILE_MARKER.test(text),
  };
}

function validateRecipeText(text, source = '<recipe>') {
  const lines = String(text).replace(/\r\n?/gu, '\n').split('\n');
  const errors = [];
  const located = new Map();

  for (const block of BLOCKS) {
    const matches = findHeadings(lines, block);
    if (matches.length === 0) {
      errors.push(makeError('missing-block', `Missing required block: ${block.name}.`));
      continue;
    }
    if (matches.length > 1) {
      errors.push(makeError('duplicate-block', `Block appears more than once: ${block.name}.`));
    }
    located.set(block.id, matches[0]);
  }

  const positions = BLOCKS.map((block) => located.get(block.id)).filter((position) => position !== undefined);
  for (let index = 1; index < positions.length; index += 1) {
    if (positions[index] <= positions[index - 1]) {
      errors.push(makeError('block-order', 'Required blocks must appear in order from 1 through 6.'));
      break;
    }
  }

  const sections = new Map();
  for (const block of BLOCKS) {
    const start = located.get(block.id);
    if (start === undefined) continue;
    const end = lines.findIndex((line, index) => index > start && /^##\s+/u.test(line));
    sections.set(block.id, sectionText(lines, start, end === -1 ? lines.length : end));
  }

  for (const block of BLOCKS) {
    const content = sections.get(block.id);
    if (content === undefined) continue;
    for (const [field, matcher] of block.fields) {
      if (!matcher.test(content)) {
        errors.push(makeError('missing-field', `Missing required field ${field} in ${block.name}.`));
      }
    }
  }

  const token = sections.get('token');
  if (token !== undefined && !STYLES_MARKER.test(token)) {
    errors.push(makeError('missing-provenance', 'TOKEN BLOCK requires a [styles] provenance marker.'));
  }

  const layout = sections.get('layout');
  if (layout !== undefined && !TILE_MARKER.test(layout)) {
    errors.push(makeError('missing-provenance', 'LAYOUT CONCEPT + STRUCTURE requires a [tile] or [tile_NN] provenance marker.'));
  }

  const signature = sections.get('signature');
  if (signature !== undefined) {
    const moves = numberedSignatureMoves(signature);
    if (moves.length === 0) {
      errors.push(makeError('missing-field', 'Missing required field signature.moves[] in THE SIGNATURE.'));
    }
    moves.forEach((move, index) => {
      if (!SIGNATURE_MARKER.test(move)) {
        errors.push(makeError('missing-provenance', `Signature technique ${index + 1} requires a [tile] or [styles] provenance marker.`));
      }
    });
  }

  const content = sections.get('content');
  if (content !== undefined && !BODY_MARKER.test(content)) {
    errors.push(makeError('missing-provenance', 'THE CONTENT requires a [body] provenance marker.'));
  }

  const build = sections.get('build');
  if (build !== undefined) {
    const stepCount = build.split('\n').filter((line) => /^\d+\.\s+/u.test(line)).length;
    if (stepCount === 0) {
      errors.push(makeError('missing-field', 'Missing required field build.component_sequence in BUILD ORDER.'));
    }
  }

  const antiSlop = sections.get('anti_slop');
  if (antiSlop !== undefined && !antiSlop.split('\n').some((line) => /^-\s+/u.test(line))) {
    errors.push(makeError('missing-field', 'Missing required field anti_slop.forbidden_substitutions in ANTI-SLOP GUARDRAILS.'));
  }

  return {
    source,
    errors,
    markers: markerSummary(text),
    valid: errors.length === 0,
  };
}

function validateRecipeFile(file) {
  if (typeof file !== 'string' || file.trim() === '') {
    return {
      source: String(file),
      errors: [makeError('usage', 'A *.recipe.md file path is required.')],
      markers: { styles: false, body: false, tile: false },
      valid: false,
    };
  }
  if (!file.endsWith('.recipe.md')) {
    return {
      source: file,
      errors: [makeError('extension', 'Recipe path must end with .recipe.md.')],
      markers: { styles: false, body: false, tile: false },
      valid: false,
    };
  }
  try {
    return validateRecipeText(fs.readFileSync(file, 'utf8'), file);
  } catch (error) {
    return {
      source: file,
      errors: [makeError('read', `Cannot read recipe: ${error.message}`)],
      markers: { styles: false, body: false, tile: false },
      valid: false,
    };
  }
}

function formatResult(result) {
  if (result.valid) {
    const markerNames = Object.entries(result.markers)
      .filter(([, present]) => present)
      .map(([name]) => name)
      .join(', ');
    return `PASS ${result.source} — 6 required blocks and provenance markers (${markerNames}).`;
  }
  return [
    `FAIL ${result.source}`,
    ...result.errors.map((error) => `- ${error.message}`),
  ].join('\n');
}

if (require.main === module) {
  const result = validateRecipeFile(process.argv[2]);
  const output = formatResult(result);
  const destination = result.valid ? process.stdout : process.stderr;
  destination.write(`${output}\n`);
  process.exitCode = result.valid ? 0 : 1;
}

module.exports = {
  BLOCKS,
  formatResult,
  validateRecipeFile,
  validateRecipeText,
};
