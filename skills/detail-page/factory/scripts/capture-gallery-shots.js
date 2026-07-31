#!/usr/bin/env node
'use strict';

/*
 * G5.4j: shoot gallery tiles from pages this repository can assemble RIGHT NOW.
 *
 * What changed from G5.4i, and why.
 *
 * G5.4i shot page.html files that were already sitting in v3/composer/<run>/. Three of the four
 * tiles it produced could not be rebuilt: re-running composer-assemble.js on the same selection
 * exits 1, because the assembler grew a governed-motion contract (a section whose motion axis is
 * not `none` has to name a v3/motions repertoire entry) that those selections predate. A tile
 * whose page cannot be rebuilt is a photograph of a build, not evidence about this composer.
 *
 * So this script no longer photographs files. For every target it
 *   1. assembles the page from the selection with today's composer-assemble.js,
 *   2. REFUSES to emit a tile if that assembly exits non-zero,
 *   3. records the grammar-lint exit code for the same selection,
 *   4. renders the assembled page and writes the tile,
 *   5. deletes the scratch build directory, so no run directory is mutated.
 * The manifest carries the selection sha256, the assembled-page sha256 and both exit codes, so a
 * reader can re-run one command and get the same bytes.
 *
 * G5.4j second pass: PENDING_SELECTION_FIXES is gone. The migration it applied in memory is now
 * in the run's own selection.json (v3/scripts/g54j-land-motion-refs.js), so every tile below is
 * built from the file on disk and `node v3/scripts/capture-gallery-shots.js` reproduces it with no
 * hidden step. One target is still refused, and that is the point of the rule, not a gap in it:
 * g4.3-ledger-violation declares a stagger motion on a cta, and v3/motions has no stagger entry
 * hinted for cta, so it cannot be made to assemble without changing what that run IS.
 *
 * The driver is patchright, required (CJS) by absolute path because it is installed under the
 * detail-page skill rather than at the repository root; an ESM import does not follow NODE_PATH.
 *
 * usage: node v3/scripts/capture-gallery-shots.js [--only slug,slug] [--out-dir <dir>]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync, execFileSync } = require('child_process');

// patchright is installed under the detail-page skill, not at the repo root, and an ESM import
// does not follow NODE_PATH. Resolve it from this file so a clone works wherever it sits.
const PATCHRIGHT = path.resolve(__dirname, '..', '..', 'node_modules', 'patchright');
const V3_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(V3_ROOT, '..');
const COMPOSER_ROOT = path.join(V3_ROOT, 'composer');
/*
 * A new directory, not the old one. v3/composer/landing-v3/selection.json still names the four
 * G5.4i files by path, and composer-assemble.js refuses to build a page whose image src does not
 * resolve to a file — so overwriting or deleting them breaks the candidate's own build. The G5.4i
 * tiles stay where they are until the selection points at these.
 */
const DEFAULT_OUT_DIR = path.join(V3_ROOT, 'site-build', 'shots', 'g54j');

/*
 * The tile shows the desktop fold, not a phone crop: at 390 the top crops of seven of the ten
 * runs were the same 30,495 bytes, because every run carries the catalog's placeholder
 * sentences. What separates one run from another is the layout — hero archetype, bleed, density —
 * and 1280 shows that. 1280x1200 reaches past the hero into the second section, so a tile shows
 * a change of face rather than one band.
 */
/*
 * G5.4k: 1200 was not tall enough to photograph a violation.
 *
 * Measured on the four current targets, the second section starts at 532-604 and the third at
 * 1200-1492 (patchright, 1280 wide). A 1200-tall clip therefore ends exactly where the third band
 * begins — which is why the refusal case, whose whole point is a repeated section, came out with
 * the same md5 as the page it was derived from (e529af451b8608e2d55b8a3601f9ee34, twice).
 * 1600 reaches into the third band on every target, so a tile shows the change of face the tile
 * was shot to show, and the repeated one shows the repetition.
 */
const WIDTH = 1280;
const CLIP_HEIGHT = 1600;
const TILE_WIDTH = 640;      // 2x the 296 CSS px the 4-up grid gives a tile, and the zoom target
const SCALE = 1;

/*
 * G5.4k: the targets are now pages with copy in them.
 *
 * Every target above this rewrite was a structure test — a run made to exercise the assembler,
 * with no content block in its brief, so it rendered the catalog's placeholder sentences. Four
 * such tiles went into the gallery and all four printed the same headline, under a section
 * claiming the grammar stops neighbouring sections wearing the same face. The defect was one
 * layer up: composer-select.js dropped brief.sections[].content, so no brief could carry copy
 * at all. With that repaired, these four targets are the first pages this factory has built from
 * briefs that had something to say.
 *
 * Three passed the gate. The fourth is case-saas-release with section 1's variation axes copied
 * onto section 2 (v3/scripts/g54k-make-refusal-case.js): it assembles, because the assembler does
 * not enforce the composition grammar, and the gate returns 1 — which is what the manifest's
 * grammarLintExit column is for.
 */
const TARGETS = [
  { slug: 'case-cafe-subscription', run: 'case-cafe-subscription', selection: 'selection.json' },
  { slug: 'case-pilates-studio', run: 'case-pilates-studio', selection: 'selection.json' },
  { slug: 'case-saas-release', run: 'case-saas-release', selection: 'selection.json' },
  { slug: 'case-saas-release-refused', run: 'case-saas-release-refused', selection: 'selection.json' },
  // Kept as a target on purpose: today's assembler exits 1 on it, so every run prints the REFUSED
  // line that shows the rule is doing something.
  { slug: 'g4.3-ledger-violation', run: 'g4.3-ledger-violation', selection: 'selection.json' }
];

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function runNode(args) {
  const result = spawnSync(process.execPath, args, { cwd: REPO_ROOT, encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout || ''}${result.stderr || ''}`.trim() };
}

async function main(argv) {
  const onlyArg = argv.indexOf('--only');
  const only = onlyArg === -1 ? null : new Set(argv[onlyArg + 1].split(','));
  const outArg = argv.indexOf('--out-dir');
  const outDir = outArg === -1 ? DEFAULT_OUT_DIR : path.resolve(argv[outArg + 1]);
  const targets = only ? TARGETS.filter((t) => only.has(t.slug)) : TARGETS;

  fs.mkdirSync(outDir, { recursive: true });
  const { chromium } = require(PATCHRIGHT);
  const browser = await chromium.launch({ headless: true });
  const manifest = [];
  const refused = [];

  for (const target of targets) {
    const selectionFile = path.join(COMPOSER_ROOT, target.run, target.selection);
    if (!fs.existsSync(selectionFile)) {
      refused.push({ slug: target.slug, reason: `missing ${path.relative(REPO_ROOT, selectionFile)}` });
      continue;
    }
    const selection = JSON.parse(fs.readFileSync(selectionFile, 'utf8'));

    // A sibling scratch run directory: same depth, so every `../../modules/...` reference in the
    // selection resolves exactly where it does from the real run directory.
    const scratch = path.join(COMPOSER_ROOT, `_shot-${target.slug}`);
    fs.rmSync(scratch, { recursive: true, force: true });
    fs.mkdirSync(scratch, { recursive: true });
    const buildSelection = path.join(scratch, 'selection.json');
    const buildPage = path.join(scratch, 'page.html');
    fs.writeFileSync(buildSelection, `${JSON.stringify(selection, null, 2)}\n`);

    const assemble = runNode(['v3/scripts/composer-assemble.js', path.relative(REPO_ROOT, buildSelection), path.relative(REPO_ROOT, buildPage)]);
    const lint = runNode(['v3/scripts/grammar-lint.js', path.relative(REPO_ROOT, buildSelection)]);

    if (assemble.status !== 0 || !fs.existsSync(buildPage)) {
      // The whole point: a run today's assembler refuses is not allowed to become a tile.
      refused.push({ slug: target.slug, reason: `composer-assemble exit ${assemble.status}: ${assemble.output.split('\n')[0]}` });
      fs.rmSync(scratch, { recursive: true, force: true });
      continue;
    }

    const context = await browser.newContext({
      viewport: { width: WIDTH, height: CLIP_HEIGHT },
      deviceScaleFactor: SCALE,
      reducedMotion: 'reduce'
    });
    const page = await context.newPage();
    await page.goto(`file://${buildPage}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.waitForTimeout(600);
    const out = path.join(outDir, `${target.slug}.png`);
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: WIDTH, height: CLIP_HEIGHT } });
    await context.close();
    execFileSync('/usr/bin/sips', ['--resampleWidth', String(TILE_WIDTH), out, '--out', out], { stdio: 'ignore' });

    const pageBytes = fs.statSync(buildPage).size;
    const pageSha = sha256File(buildPage);
    fs.rmSync(scratch, { recursive: true, force: true });

    manifest.push({
      slug: target.slug,
      run: `v3/composer/${target.run}`,
      selection: path.relative(REPO_ROOT, selectionFile),
      selectionSha256: sha256File(selectionFile),
      assembleExit: assemble.status,
      grammarLintExit: lint.status,
      grammarLintFirstLine: lint.output.split('\n')[0],
      assembledPageBytes: pageBytes,
      assembledPageSha256: pageSha,
      tile: path.relative(REPO_ROOT, out),
      tileBytes: fs.statSync(out).size,
      tileWidth: TILE_WIDTH,
      tileHeight: Math.round((CLIP_HEIGHT / WIDTH) * TILE_WIDTH)
    });
    process.stdout.write(`${target.slug}\tassemble=${assemble.status}\tlint=${lint.status}\ttile=${fs.statSync(out).size}B\n`);
  }

  await browser.close();
  for (const item of refused) process.stdout.write(`REFUSED ${item.slug}: ${item.reason}\n`);

  const manifestFile = path.join(outDir, 'manifest.json');
  fs.writeFileSync(manifestFile, `${JSON.stringify({
    generator: 'v3/scripts/capture-gallery-shots.js',
    renderWidth: WIDTH,
    renderClipHeight: CLIP_HEIGHT,
    deviceScaleFactor: SCALE,
    tileWidth: TILE_WIDTH,
    rule: 'a target becomes a tile only if composer-assemble.js exits 0 on its selection today',
    shots: manifest,
    refused
  }, null, 2)}\n`);
  process.stdout.write(`tiles: ${manifest.length}; refused: ${refused.length}\n`);
  process.stdout.write(`total tile bytes: ${manifest.reduce((a, b) => a + b.tileBytes, 0)}\n`);
  process.stdout.write(`manifest: ${path.relative(REPO_ROOT, manifestFile)}\n`);
  if (!manifest.length) process.exitCode = 1;
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
