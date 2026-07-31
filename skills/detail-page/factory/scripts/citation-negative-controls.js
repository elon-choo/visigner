#!/usr/bin/env node
'use strict';
/*
 * G5.4f negative-control matrix for v3/scripts/citation-audit.js.
 *
 * A gate is only worth its exit code if something is known to make it fail. The third
 * independent audit built seven mutations of the landing page and found that three of them
 * passed: a figure replaced by a bare digit the repository's own paths contain, a line-count
 * claim inflated inside an item carrying five different citations, and a line-count claim
 * inflated to a number that appears in the same output as an array index. This file replays all
 * seven against the hardened gate and writes the matrix, so the claim "the gate refuses this"
 * is a measurement rather than an assertion.
 *
 * Mutants are written to a mirror directory beside the page, so relative asset paths resolve and
 * the mutant renders exactly as the page does; the page itself is never modified.
 *
 * usage: node v3/scripts/citation-negative-controls.js [mirror-dir] [evidence-dir]
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const PAGE = path.join(REPO, 'v3/composer/landing-v3/page.html');
const MIRROR = process.argv[2] || path.join(REPO, 'v3/composer/landing-v3/.g5.4f-nc');
const EVID = process.argv[3] || path.join(REPO, 'docs/goals/evidence/v3/G5.4f/honesty');

const source = fs.readFileSync(PAGE, 'utf8');
const colophonSha = (source.match(/page\.pre-colophon\.html\(sha256 ([0-9a-f]{64})\)/) || [])[1];
if (!colophonSha) throw new Error('colophon sha not found in page');
const bumped = `${colophonSha.slice(0, 63)}${colophonSha.slice(63) === '0' ? '1' : '0'}`;

const CASES = [
  { id: 'orig', why: 'unmodified copy of the shipped page, audited from the mirror path', edits: [] },
  {
    id: 'nc1',
    why: 'a cited figure changed to another plausible figure (E-07 monotony 0.53 -> 0.91)',
    edits: [['monotony 0.53', 'monotony 0.91']]
  },
  {
    id: 'nc2',
    why: 'a fresh external figure dropped into a footer item that carries no chip',
    edits: [['>v3/COMPOSITION-GRAMMAR.md<', '>v3/COMPOSITION-GRAMMAR.md +47<']]
  },
  {
    id: 'nc3',
    why: 'a cited figure changed to a bare digit that the repository root path also contains (0.53 -> 3)',
    edits: [['monotony 0.53', 'monotony 3']]
  },
  {
    id: 'nc4',
    why: 'a line-count claim inflated inside an item that carries five chips (두 줄 -> 일곱 줄)',
    edits: [['폴드의 두 줄', '폴드의 일곱 줄']]
  },
  {
    id: 'nc5',
    why: 'a line-count claim inflated to a number that appears elsewhere in the same output as an index (세 줄 -> 여덟 줄)',
    edits: [['각 카드의 세 줄', '각 카드의 여덟 줄']]
  },
  {
    id: 'nc6',
    why: 'a rendered-group count inflated at every render site (여섯 단계 -> 일곱 단계)',
    edits: [['여섯 단계와 사람 컨펌', '일곱 단계와 사람 컨펌']]
  },
  {
    id: 'nc7',
    why: 'one hex digit of the colophon sha changed inside the claim span',
    edits: [[`page.pre-colophon.html(sha256 ${colophonSha})`, `page.pre-colophon.html(sha256 ${bumped})`]]
  }
];

fs.mkdirSync(MIRROR, { recursive: true });
fs.mkdirSync(EVID, { recursive: true });

const rows = [];
for (const testCase of CASES) {
  let html = source;
  let applied = 0;
  for (const [from, to] of testCase.edits) {
    const count = html.split(from).length - 1;
    if (count === 0) throw new Error(`${testCase.id}: mutation anchor not found: ${from.slice(0, 60)}`);
    html = html.split(from).join(to);
    applied += count;
  }
  const file = path.join(MIRROR, `${testCase.id}.html`);
  fs.writeFileSync(file, html);
  const run = spawnSync(process.execPath, [
    path.join(REPO, 'v3/scripts/citation-audit.js'), file,
    '--out', path.join(EVID, `nc-${testCase.id}.json`)
  ], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  fs.writeFileSync(path.join(EVID, `nc-${testCase.id}.log`), run.stdout || '');
  const failLines = (run.stdout || '').split('\n').filter((line) => line.trim().startsWith('FAIL '));
  rows.push({
    id: testCase.id,
    why: testCase.why,
    sites: applied,
    exit: run.status,
    reason: failLines.length ? failLines[0].trim().replace(/\s+/g, ' ') : '—'
  });
  process.stderr.write(`${testCase.id} exit=${run.status}\n`);
}

const width = (key, header) => Math.max(header.length, ...rows.map((row) => String(row[key]).length));
const wId = width('id', 'id');
const wWhy = width('why', 'mutation');
const lines = [];
lines.push('# G5.4f — citation-audit.js negative control matrix (hardened gate)');
lines.push(`# tool: v3/scripts/citation-audit.js   page under test: v3/composer/landing-v3/page.html`);
lines.push(`# page sha256: ${spawnSync('shasum', ['-a', '256', PAGE], { encoding: 'utf8' }).stdout.trim().split(/\s+/)[0]}`);
lines.push('# mutants are written to a mirror directory; the page under test is never modified.');
lines.push('');
lines.push(`${'id'.padEnd(wId)}  ${'mutation'.padEnd(wWhy)}  sites  expected  exit  verdict`);
for (const row of rows) {
  const expected = row.id === 'orig' ? 0 : 1;
  lines.push(
    `${row.id.padEnd(wId)}  ${row.why.padEnd(wWhy)}  ${String(row.sites).padEnd(5)}  `
    + `exit ${expected}    ${row.exit}     ${row.exit === expected ? 'AS EXPECTED' : 'MISMATCH'}`
  );
}
lines.push('');
lines.push('first failure reported for each mutant');
for (const row of rows) lines.push(`  ${row.id}: ${row.reason}`);
lines.push('');
const bad = rows.filter((row) => row.exit !== (row.id === 'orig' ? 0 : 1));
lines.push(bad.length ? `MATRIX RESULT: ${bad.length} MISMATCH (${bad.map((r) => r.id).join(', ')})` : 'MATRIX RESULT: all 8 as expected');
fs.writeFileSync(path.join(EVID, 'negative-control-matrix.txt'), `${lines.join('\n')}\n`);
process.stdout.write(`${lines.join('\n')}\n`);
process.exitCode = bad.length ? 1 : 0;
