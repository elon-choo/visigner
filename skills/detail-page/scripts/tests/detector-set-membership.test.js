#!/usr/bin/env node
'use strict';

// Locks the detector registry against silent growth.
//
// The line-edit HUMAN_GATE keys on `git diff --numstat` showing a deletion, so appending a detector
// with `detectors.concat([...])` — or a second loop, or `.push`, or `Array.of`, or a plain call —
// adds lines, deletes none, and slips through. This test is the pair to that gate.
//
// An earlier version parsed only `for (const detector of [...])` and `detectors.concat([...])`.
// A red-team pass walked straight past it with seven other idioms. So the snapshot is now over every
// `detect*` identifier that appears anywhere in the harness source: whichever idiom you use to wire a
// new detector, you must name it, and naming it fails this assertion until the snapshot is updated in
// the same change.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const harnessPath = path.resolve(__dirname, '..', 'anti-ai-eval.js');
const src = fs.readFileSync(harnessPath, 'utf8');

// Every detector function and helper the harness references, by name. Sorted.
const EXPECTED_DETECTOR_IDENTIFIERS = [
  'detectBrowserMockups',
  'detectEnDisplayLabels',
  'detectGhostNumerals',
  'detectHtmlLetterCodeBadges',
  'detectJustifyDisplay',
  'detectLetterCodeBadges',
  'detectLetterSquareAvatars',
  'detectMarkerSequence',
  'detectMonoLabels',
  'detectMultiscriptNumbering',
  'detectOutlineChips',
  'detectPaletteMonotony',
  'detectPlaceholderShipped',
  'detectRepeatedDecorativeLabels',
  'detectStructuralMonotony',
  'detectSvgLetterCodeBadges',
  'detectUniformFrameLoop',
];

// The 13 detectors driven by the original inline registry loop, in source order.
const EXPECTED_INLINE_REGISTRY = [
  'detectMonoLabels',
  'detectRepeatedDecorativeLabels',
  'detectEnDisplayLabels',
  'detectBrowserMockups',
  'detectGhostNumerals',
  'detectOutlineChips',
  'detectUniformFrameLoop',
  'detectLetterSquareAvatars',
  'detectLetterCodeBadges',
  'detectMarkerSequence',
  'detectMultiscriptNumbering',
  'detectJustifyDisplay',
  'detectPaletteMonotony',
];

function stripJsComments(s) {
  return String(s || '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ');
}

const stripped = stripJsComments(src);

const identifiers = [...new Set([...stripped.matchAll(/\bdetect[A-Z][A-Za-z0-9_]*\b/g)].map((m) => m[0]))].sort();
assert.deepStrictEqual(
  identifiers,
  EXPECTED_DETECTOR_IDENTIFIERS,
  'detector identifier set changed — add the new detector to EXPECTED_DETECTOR_IDENTIFIERS in the SAME change',
);
console.log(`PASS detector identifier snapshot (${identifiers.length} names — every wiring idiom is covered)`);

const inline = [...stripped.matchAll(/for\s*\(\s*const\s+detector\s+of\s+\[([\s\S]*?)\]\s*\)/g)]
  .map((m) => [...m[1].matchAll(/\bdetect[A-Z][A-Za-z0-9_]*\b/g)].map((x) => x[0]))
  .filter((ids) => ids.length > 1);
assert.strictEqual(inline.length, 1, `expected exactly one multi-detector registry loop, found ${inline.length}`);
assert.deepStrictEqual(inline[0], EXPECTED_INLINE_REGISTRY, 'the original 13-detector registry loop changed');
console.log(`PASS original registry loop unchanged (${EXPECTED_INLINE_REGISTRY.length} detectors, source order)`);

// The identifier snapshot above only binds functions NAMED detect*. A red-team pass walked past it
// with `placeholderProbe`, an object property, and an arrow assigned into a registry object.
// Whatever it is called, a detector has to get its finding into `tells` — and there are exactly two
// ways to do that. Pin both counts, and a differently-named detector still trips this file.
const EXPECTED_PUSHTELL_CALLS = 3; // the registry loop, the structural-monotony call, the appended loop
const EXPECTED_TELLS_PUSH = 0; // every tell goes through pushTell(); nothing writes `tells` directly

const pushTellCalls = [...stripped.matchAll(/\bpushTell\s*\(/g)].length - 1; // minus the declaration
assert.strictEqual(
  pushTellCalls,
  EXPECTED_PUSHTELL_CALLS,
  `pushTell() call sites changed (${pushTellCalls}) — a tell-emitting path was added or removed`,
);
const tellsPush = [...stripped.matchAll(/\btells\s*\.\s*push\s*\(/g)].length;
assert.strictEqual(
  tellsPush,
  EXPECTED_TELLS_PUSH,
  `a detector wrote to tells directly (${tellsPush} sites), bypassing pushTell()`,
);
console.log(`PASS tell-emission sites pinned (pushTell x${pushTellCalls}, direct tells.push x${tellsPush})`);

// A snapshot over source text is worthless if the harness can build a detector at runtime.
assert.ok(!/\beval\s*\(/.test(stripped), 'eval() found in harness');
assert.ok(!/\bnew\s+Function\s*\(/.test(stripped), 'new Function() found in harness');
// Only two literal forms are allowed: require('x') and require(path.join(__dirname, 'x')).
const SAFE_REQUIRE = /\brequire\s*\(\s*(?:'[^']+'|"[^"]+"|path\.join\s*\(\s*__dirname\s*,\s*(?:'[^']+'|"[^"]+")\s*\))\s*\)/g;
const allRequires = [...stripped.matchAll(/\brequire\s*\(/g)].length;
const safeRequires = [...stripped.matchAll(SAFE_REQUIRE)].length;
assert.strictEqual(
  allRequires,
  safeRequires,
  `non-literal require() in harness (${allRequires} total, ${safeRequires} literal) — a detector could be loaded at runtime`,
);
console.log(`PASS no eval / new Function / dynamic require (${safeRequires} literal requires)`);

console.log('detector set membership complete');
