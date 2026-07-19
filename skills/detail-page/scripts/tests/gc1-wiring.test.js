'use strict';

const assert = require('node:assert');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const EVALUATOR = path.join(REPO, 'skills', 'detail-page', 'scripts', 'anti-ai-eval.js');
const FIXTURES = path.join(__dirname, 'fixtures');
const CLEAN_PAGE = path.join(FIXTURES, 'anti-pattern-check', 'clean.html');
const SLOP_PAGE = path.join(FIXTURES, 'anti-pattern-check', 'slop.html');
const FABRICATED_PAGE = path.join(FIXTURES, 'gb2-honesty', 'fabricated.build.html');
const FABRICATED_RECIPE = path.join(FIXTURES, 'gb2-honesty', 'fabricated.recipe.md');

function run(page, ...args) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-gc1-'));
  const result = childProcess.spawnSync(process.execPath, [EVALUATOR, page, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.ifError(result.error);
  const reportPath = path.join(fs.realpathSync(cwd), 'anti-ai-report.json');
  return {
    ...result,
    cwd,
    reportPath,
    report: fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : null,
  };
}

test('GC.1 no-flag output remains byte-identical to the pre-wiring fixture output', () => {
  const result = run(CLEAN_PAGE);
  assert.strictEqual(result.status, 0, result.stderr);
  const expected = [
    'anti-ai-eval verdict: clean',
    's2Pass: true',
    `page: ${CLEAN_PAGE}`,
    'tellsDetected: 0 (none)',
    'monotonyScore: 0',
    'sectionDetection: main-article-blocks',
    'externalCssSkipped: 0',
    'presence: not provided',
    `report: ${result.reportPath}`,
    '',
  ].join('\n');
  assert.strictEqual(result.stdout, expected);
  assert.ok(!Object.prototype.hasOwnProperty.call(result.report, 'conformance'));
});

test('GC.1 --recipe folds fabricated metric evidence into the page verdict', () => {
  const result = run(FABRICATED_PAGE, '--recipe', FABRICATED_RECIPE);
  assert.strictEqual(result.status, 0, result.stderr);
  assert.match(result.stdout, /buildHonesty: refused/u);
  assert.match(result.stdout, /UNSUPPORTED number "87"/u);
  assert.match(result.stdout, /UNSUPPORTED label "loyalty score"/u);
  assert.strictEqual(result.report.s2Pass, false);
  assert.notStrictEqual(result.report.verdict, 'clean');
  assert.strictEqual(result.report.conformance.buildHonesty.status, 'refused');
});

test('GC.1 --category folds a HIGH anti-pattern into the verdict and surfaces UNCHECKED rows', () => {
  const result = run(SLOP_PAGE, '--category', 'portfolio-site');
  assert.strictEqual(result.status, 0, result.stderr);
  assert.match(result.stdout, /antiPatterns: FAIL \(HIGH=1 MEDIUM=0 LOW=0\)/u);
  assert.match(result.stdout, /^UNCHECKED /mu);
  assert.strictEqual(result.report.s2Pass, false);
  assert.notStrictEqual(result.report.verdict, 'clean');
  assert.ok(result.report.conformance.antiPatterns.unchecked.every((row) => row.state === 'UNCHECKED'));
});

test('GC.1 malformed or unresolved recipe/category inputs refuse explicitly', () => {
  const unknownCategory = run(CLEAN_PAGE, '--category', 'not-a-real-category');
  assert.strictEqual(unknownCategory.status, 2);
  assert.match(unknownCategory.stderr, /category conformance refused:.*MISS, not an empty pass/u);

  const missingCategoryValue = run(CLEAN_PAGE, '--category');
  assert.strictEqual(missingCategoryValue.status, 2);
  assert.match(missingCategoryValue.stderr, /--category requires a value/u);

  const missingRecipe = run(CLEAN_PAGE, '--recipe', path.join(FIXTURES, 'missing-gc1.recipe.md'));
  assert.strictEqual(missingRecipe.status, 2);
  assert.match(missingRecipe.stderr, /recipe conformance refused: cannot read recipe/u);

  const missingRecipeValue = run(CLEAN_PAGE, '--recipe');
  assert.strictEqual(missingRecipeValue.status, 2);
  assert.match(missingRecipeValue.stderr, /--recipe requires a value/u);
});

test('GC.1 --grounding records claimed context without changing scoring', () => {
  const grounding = path.join(FIXTURES, 'gc1-grounding.md');
  const result = run(CLEAN_PAGE, '--grounding', grounding);
  assert.strictEqual(result.status, 0, result.stderr);
  assert.match(result.stdout, /grounding: exemplar=portfolio-folio-2026 category=portfolio-site/u);
  assert.strictEqual(result.report.verdict, 'clean');
  assert.strictEqual(result.report.s2Pass, true);
  assert.deepStrictEqual(result.report.conformance.grounding, {
    file: grounding,
    exemplar: 'portfolio-folio-2026',
    category: 'portfolio-site',
  });
});
