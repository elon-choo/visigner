'use strict';

const assert = require('node:assert');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'librarian-inject.js');
const BRIEF = fs.readFileSync(path.join(__dirname, 'fixtures', 'design-dials', 'brief.json'), 'utf8').trim();
const FIXTURE_INDEX = path.join(__dirname, 'fixtures', 'design-dials', 'corpus-index.json');
const { inject, retrieveWithDesignDials } = require(SCRIPT);

function runInjector(extraArgs = []) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-design-dials-'));
  const out = path.join(outDir, 'grounding.md');
  const result = childProcess.spawnSync(process.execPath, [SCRIPT, BRIEF, ...extraArgs, '--out', out], {
    encoding: 'utf8',
  });
  return { ...result, out, output: fs.existsSync(out) ? fs.readFileSync(out) : null };
}

test('all default design dials are byte-identical to an omitted-dial fixture run', () => {
  const omitted = runInjector();
  const defaults = runInjector(['--variance', '5', '--motion', '5', '--density', '5']);

  assert.strictEqual(omitted.status, 0, omitted.stderr);
  assert.strictEqual(defaults.status, 0, defaults.stderr);
  assert.deepStrictEqual(defaults.output, omitted.output);
  assert.deepStrictEqual(Buffer.from(defaults.stdout), Buffer.from(omitted.stdout));
});

test('density dial emits a concrete airy-to-compact spacing-scale override', () => {
  const brief = JSON.parse(BRIEF);
  const airy = inject(brief, { density: 2 }).groundingBlock;
  const compact = inject(brief, { density: 9 }).groundingBlock;

  assert.match(airy, /Spacing-scale override \(2\/10, airy \/ large gaps\)/u);
  assert.match(airy, /--space-5: 76px;/u);
  assert.match(compact, /Spacing-scale override \(9\/10, compact \/ tight gaps\)/u);
  assert.match(compact, /--space-5: 44px;/u);
  assert.notStrictEqual(airy, compact);
});

test('motion dial emits reduced-motion-safe high-motion guidance', () => {
  const guidance = inject(JSON.parse(BRIEF), { motion: 9 }).groundingBlock;
  assert.match(guidance, /\*\*Motion guidance \(9\/10\):\*\* high-motion/u);
  assert.match(guidance, /prefers-reduced-motion: reduce/u);
});

test('high variance reranks only Librarian-eligible candidates toward a divergent style query', () => {
  const brief = { category: 'dial-fixture', awareness: 'solution-aware', text_density: 20 };
  const result = retrieveWithDesignDials(brief, {
    k: 1,
    indexPath: FIXTURE_INDEX,
    dials: { variance: 10, motion: 5, density: 5 },
  });

  assert.strictEqual(result.matches[0].id, 'divergent');
  assert.strictEqual(result.dialQuery.text, 'style-divergence^6 alternative-signature^6 non-neighbor^6');
});

for (const [flag, value] of [['--density', '0'], ['--variance', '11'], ['--motion', 'foo']]) {
  test(`${flag} ${value} is rejected with a non-zero exit`, () => {
    const result = childProcess.spawnSync(process.execPath, [SCRIPT, BRIEF, flag, value], { encoding: 'utf8' });
    assert.notStrictEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(`${flag} must be an integer from 1 to 10\\.`, 'u'));
  });
}
