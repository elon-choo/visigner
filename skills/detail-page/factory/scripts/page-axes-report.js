#!/usr/bin/env node
'use strict';

/*
 * Page-level axis report.
 *
 * The composition grammar states its rules; this prints what one assembled page actually scored
 * against them.  It reads only the data-* attributes composer-assemble.js writes onto each
 * composition entry, so it needs no manifest and cannot drift from the shipped bytes.
 *
 * It exists because a page that prints its own measurements owes the reader a command that
 * emits those measurements.  G5.4's honesty audit found five such numbers cited to a rules
 * document that does not contain them (docs/goals/evidence/v3/G5.4/honesty/20-reproduce-command-test.txt).
 *
 * usage: node v3/scripts/page-axes-report.js <page.html>
 */

const fs = require('fs');
const path = require('path');

const AXES = ['layout-archetype', 'density', 'background-bleed', 'motion', 'art-direction'];
const FULL_BLEED = new Set(['surface-bleed', 'contrast-bleed', 'media-bleed']);

function fail(message) {
  throw new Error(`page-axes-report: ${message}`);
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`, 'u'));
  return match ? match[1] : null;
}

function readEntries(html) {
  const entries = [];
  const scanner = /<article\b[^>]*class="composition-entry"[^>]*>/gu;
  let match;
  while ((match = scanner.exec(html)) !== null) {
    const tag = match[0];
    entries.push({
      index: attribute(tag, 'data-section-index'),
      moduleId: attribute(tag, 'data-module-id'),
      type: attribute(tag, 'data-module-type'),
      axes: Object.fromEntries(AXES.map((axis) => [axis, attribute(tag, `data-variant-${axis}`)]))
    });
  }
  return entries;
}

function main(argv) {
  if (argv.length !== 1) fail('usage: node v3/scripts/page-axes-report.js <page.html>');
  const pageFile = path.resolve(argv[0]);
  const html = fs.readFileSync(pageFile, 'utf8');
  const entries = readEntries(html);
  if (!entries.length) fail(`no composition-entry found in ${argv[0]}`);

  const sections = entries.length;
  const types = [...new Set(entries.map((entry) => entry.type))];
  const fullBleed = entries.filter((entry) => FULL_BLEED.has(entry.axes['background-bleed']));
  const moving = entries.filter((entry) => entry.axes.motion !== 'none');
  const ctas = entries.filter((entry) => entry.type === 'cta');

  const seams = [];
  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1];
    const current = entries[index];
    const differing = AXES.filter((axis) => previous.axes[axis] !== current.axes[axis]);
    seams.push({ seam: index, from: previous.index, to: current.index, differing });
  }
  const seamCounts = seams.map((seam) => seam.differing.length);

  const out = [];
  out.push(`page: ${path.relative(process.cwd(), pageFile)}`);
  out.push(`sections: ${sections}`);
  out.push(`distinct section types: ${types.length} (${types.join(', ')})`);
  out.push(`seams: ${seams.length}; axes differing per seam: min ${Math.min(...seamCounts)} max ${Math.max(...seamCounts)}`);
  for (const seam of seams) {
    out.push(`  seam ${seam.seam} (${seam.from}->${seam.to}): ${seam.differing.length} axes [${seam.differing.join(',')}]`);
  }
  out.push(`full-bleed sections: ${fullBleed.length}; cap floor(sections/2) = ${Math.floor(sections / 2)}`);
  out.push(`motion sections: ${moving.length}; cap ceil(sections/3) = ${Math.ceil(sections / 3)}`);
  out.push(`cta-type sections: ${ctas.length}`);
  process.stdout.write(`${out.join('\n')}\n`);
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
