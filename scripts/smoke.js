'use strict';

// Regression smoke gate for the shipped Visigner skill set and documentation preview.
// The two counts below are intentionally pinned. A quiet deletion is a CI failure.
const EXPECTED_SKILL_COUNT = 8;
const EXPECTED_CORPUS_RECORD_COUNT = 12;
const EXPECTED_REASONING_RECORD_COUNT = 12;
const EXPECTED_ANTI_PATTERN_TABLE_COUNT = 12;

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO_ROOT = path.resolve(__dirname, '..');
const SKILLS_ROOT = path.join(REPO_ROOT, 'skills');
const DEFAULT_CORPUS_DIR = path.join(SKILLS_ROOT, 'detail-page', 'references', 'corpus');
const DEFAULT_PAGE_PATH = path.join(REPO_ROOT, 'docs', 'index.html');
const CORPUS_VALIDATE_PATH = path.join(SKILLS_ROOT, 'detail-page', 'scripts', 'corpus-validate.js');
const CORPUS_INDEX_PATH = path.join(SKILLS_ROOT, 'detail-page', 'scripts', 'corpus-index.js');
const REASONING_VALIDATE_PATH = path.join(SKILLS_ROOT, 'detail-page', 'scripts', 'reasoning-validate.js');
const ANTI_PATTERN_CHECK_PATH = path.join(__dirname, 'anti-pattern-check.js');
const BRAND_LINT_BIN = path.join(REPO_ROOT, 'bin', 'brand-lint');
const BRAND_LINT_SCRIPT = path.join(SKILLS_ROOT, 'detail-page', 'scripts', 'brand-lint.js');
const BRAND_LINT_FIXTURE = path.join(SKILLS_ROOT, 'detail-page', 'assets', 'starter', 'index.html');
const PATCHRIGHT_PATH = path.join(SKILLS_ROOT, 'detail-page', 'node_modules', 'patchright');

function smokeFailure(code, detail) {
  const error = new Error(code + ' — ' + detail);
  error.code = code;
  return error;
}

function requireFile(filePath, code, label) {
  if (!fs.existsSync(filePath)) throw smokeFailure(code, label + ' is missing: ' + filePath);
}

function parseArgs(argv) {
  const options = { corpusDir: DEFAULT_CORPUS_DIR, pagePath: DEFAULT_PAGE_PATH };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/smoke.js [--corpus-dir <corpus-or-records-dir>] [--page-path <page.html>]');
      process.exit(0);
    }
    if (arg === '--corpus-dir' || arg === '--page-path') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw smokeFailure('ARGUMENT_ERROR', arg + ' requires a path value');
      }
      options[arg === '--corpus-dir' ? 'corpusDir' : 'pagePath'] = path.resolve(process.cwd(), value);
      index += 1;
      continue;
    }
    throw smokeFailure('ARGUMENT_ERROR', 'unknown argument: ' + arg);
  }
  return options;
}

function firstPartySkillFiles(directory = SKILLS_ROOT) {
  const files = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        visit(entryPath);
      } else if (entry.isFile() && entry.name === 'SKILL.md') {
        files.push(entryPath);
      }
    }
  };
  visit(directory);
  return files.sort();
}

function parseSkillManifest(filePath) {
  const source = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, '');
  const frontMatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
  if (!frontMatter) throw smokeFailure('SKILL_PARSE_FAILURE', path.relative(REPO_ROOT, filePath) + ' has no YAML front matter');

  const header = frontMatter[1];
  const name = header.match(/^name:\s*([^\s#][^\r\n#]*)\s*$/mu);
  const description = header.match(/^description:\s*(.*)$/mu);
  if (!name || !name[1].trim()) {
    throw smokeFailure('SKILL_PARSE_FAILURE', path.relative(REPO_ROOT, filePath) + ' has no parseable name');
  }
  if (!description) {
    throw smokeFailure('SKILL_PARSE_FAILURE', path.relative(REPO_ROOT, filePath) + ' has no parseable description');
  }
  const descriptionValue = description[1].trim();
  const hasFoldedDescription = /^(?:>|\|)[+-]?$/u.test(descriptionValue)
    && /^\s{2,}\S/mu.test(header.slice(header.indexOf(description[0]) + description[0].length));
  if (!descriptionValue || (/^(?:>|\|)[+-]?$/u.test(descriptionValue) && !hasFoldedDescription)) {
    throw smokeFailure('SKILL_PARSE_FAILURE', path.relative(REPO_ROOT, filePath) + ' has an empty description');
  }
  return { filePath, name: name[1].trim() };
}

function smokeSkills() {
  requireFile(SKILLS_ROOT, 'SKILL_ROOT_MISSING', 'skills directory');
  const files = firstPartySkillFiles();
  if (files.length !== EXPECTED_SKILL_COUNT) {
    throw smokeFailure('SKILL_COUNT_MISMATCH', 'expected ' + EXPECTED_SKILL_COUNT + ' first-party SKILL.md files, found ' + files.length);
  }
  const manifests = files.map(parseSkillManifest);
  const names = new Set(manifests.map((manifest) => manifest.name));
  if (names.size !== manifests.length) {
    throw smokeFailure('SKILL_PARSE_FAILURE', 'skill manifest names must be unique');
  }
  console.log('PASS skills — ' + manifests.length + ' first-party SKILL.md files loaded (EXPECTED_SKILL_COUNT=' + EXPECTED_SKILL_COUNT + ').');
}

function resolveRecordsDir(corpusDir) {
  const resolved = path.resolve(corpusDir);
  requireFile(resolved, 'CORPUS_DIR_MISSING', 'corpus directory');
  const childRecords = path.join(resolved, 'records');
  return fs.existsSync(childRecords) ? childRecords : resolved;
}

function smokeCorpus(corpusDir) {
  requireFile(CORPUS_VALIDATE_PATH, 'CORPUS_VALIDATE_MISSING', 'corpus-validate.js');
  requireFile(CORPUS_INDEX_PATH, 'CORPUS_INDEX_MISSING', 'corpus-index.js');

  // Invoke the existing corpus scripts through their exported public functions so an
  // overridden corpus is validated/indexed without writing to the source corpus index.
  const corpusValidate = require(CORPUS_VALIDATE_PATH);
  const corpusIndex = require(CORPUS_INDEX_PATH);
  const recordsDir = resolveRecordsDir(corpusDir);
  const recordFiles = corpusValidate.findRecordFiles(recordsDir);
  if (recordFiles.length !== EXPECTED_CORPUS_RECORD_COUNT) {
    throw smokeFailure('CORPUS_RECORD_COUNT_MISMATCH', 'expected ' + EXPECTED_CORPUS_RECORD_COUNT + ' record.json files, found ' + recordFiles.length + ' in ' + recordsDir);
  }

  const validationFailures = [];
  let envelopeCount = 0;
  for (const recordFile of recordFiles) {
    const result = corpusValidate.validateRecordFile(recordFile);
    envelopeCount += result.envelopes.length;
    validationFailures.push(...result.errors.map((error) => error.message));
  }
  if (validationFailures.length) {
    throw smokeFailure('CORPUS_VALIDATE_FAILURE', validationFailures.length + ' validation error(s):\n' + validationFailures.join('\n'));
  }

  let index;
  try {
    index = corpusIndex.buildIndex(recordsDir);
  } catch (error) {
    throw smokeFailure('CORPUS_INDEX_FAILURE', error.message);
  }
  if (index.record_count !== EXPECTED_CORPUS_RECORD_COUNT) {
    throw smokeFailure('CORPUS_INDEX_COUNT_MISMATCH', 'expected ' + EXPECTED_CORPUS_RECORD_COUNT + ' indexed record(s), found ' + index.record_count);
  }
  console.log('PASS corpus — invoked corpus-validate.js and corpus-index.js against ' + recordsDir + '; ' + recordFiles.length + ' record(s), ' + envelopeCount + ' envelope(s).');
}

function smokeReasoningAndAntiPatterns() {
  requireFile(REASONING_VALIDATE_PATH, 'REASONING_VALIDATE_MISSING', 'reasoning-validate.js');
  requireFile(ANTI_PATTERN_CHECK_PATH, 'ANTI_PATTERN_CHECK_MISSING', 'anti-pattern-check.js');

  let reasoning;
  try {
    reasoning = require(REASONING_VALIDATE_PATH).validateTarget();
  } catch (error) {
    throw smokeFailure('REASONING_VALIDATE_FAILURE', error.message);
  }
  if (reasoning.records.length !== EXPECTED_REASONING_RECORD_COUNT) {
    throw smokeFailure('REASONING_RECORD_COUNT_MISMATCH', 'expected ' + EXPECTED_REASONING_RECORD_COUNT + ' reasoning record(s), found ' + reasoning.records.length);
  }

  let tables;
  try {
    tables = require(ANTI_PATTERN_CHECK_PATH).validateTables();
  } catch (error) {
    throw smokeFailure('ANTI_PATTERN_TABLE_FAILURE', error.message);
  }
  if (tables.category_count !== EXPECTED_ANTI_PATTERN_TABLE_COUNT) {
    throw smokeFailure('ANTI_PATTERN_TABLE_COUNT_MISMATCH', 'expected ' + EXPECTED_ANTI_PATTERN_TABLE_COUNT + ' anti-pattern category table(s), found ' + tables.category_count);
  }
  console.log('PASS reasoning/anti-patterns — ' + reasoning.records.length + '/' + EXPECTED_REASONING_RECORD_COUNT + ' reasoning record(s) and ' + tables.category_count + '/' + EXPECTED_ANTI_PATTERN_TABLE_COUNT + ' anti-pattern table(s) validated.');
}

function printChildOutput(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

function smokeBrandLint() {
  const candidates = [];
  if (fs.existsSync(BRAND_LINT_BIN)) candidates.push({ command: BRAND_LINT_BIN, args: [], label: path.relative(REPO_ROOT, BRAND_LINT_BIN) });
  if (fs.existsSync(BRAND_LINT_SCRIPT)) candidates.push({ command: process.execPath, args: [BRAND_LINT_SCRIPT], label: path.relative(REPO_ROOT, BRAND_LINT_SCRIPT) });
  if (!fs.existsSync(BRAND_LINT_FIXTURE) || !candidates.length) {
    throw smokeFailure('BRAND_LINT_UNAVAILABLE', 'no runnable brand-lint entry point or known-clean fixture; the brand-lint guard may not be silently skipped.');
  }

  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-smoke-brand-lint-'));
  const outputPath = path.join(outputDir, 'brand-lint.json');
  for (const candidate of candidates) {
    const result = childProcess.spawnSync(candidate.command, candidate.args.concat([BRAND_LINT_FIXTURE, outputPath]), {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    if (result.error && (result.error.code === 'ENOENT' || result.error.code === 'EACCES')) continue;
    printChildOutput(result);
    if (result.error) throw smokeFailure('BRAND_LINT_UNAVAILABLE', candidate.label + ' could not run: ' + result.error.message);
    if (result.status !== 0) throw smokeFailure('BRAND_LINT_FAILURE', candidate.label + ' rejected known-clean fixture ' + BRAND_LINT_FIXTURE);
    console.log('PASS brand-lint — ' + candidate.label + ' accepted known-clean fixture.');
    return;
  }
  throw smokeFailure('BRAND_LINT_UNAVAILABLE', 'brand-lint entry points were not executable; the brand-lint guard may not be silently skipped.');
}

function loadChromium() {
  try {
    return require(PATCHRIGHT_PATH).chromium;
  } catch (error) {
    throw smokeFailure('RENDER_BROWSER_UNAVAILABLE', 'Patchright could not load from ' + PATCHRIGHT_PATH + ': ' + error.message);
  }
}

async function launchBrowser(chromium) {
  let bundledError = null;
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    bundledError = error;
  }
  try {
    return await chromium.launch({ channel: 'chrome', headless: true });
  } catch (channelError) {
    throw smokeFailure('RENDER_BROWSER_UNAVAILABLE', 'bundled Chromium failed (' + bundledError.message + ') and Chrome channel failed (' + channelError.message + ')');
  }
}

async function smokeRender(pagePath) {
  const resolvedPagePath = path.resolve(pagePath);
  requireFile(resolvedPagePath, 'RENDER_PAGE_MISSING', 'render page');
  const chromium = loadChromium();
  const browser = await launchBrowser(chromium);
  const consoleErrors = [];
  try {
    const page = await browser.newPage();
    // Patchright intentionally suppresses Playwright's page.on('console') surface
    // for stealth. Subscribe to Chromium's Runtime domain as well, before loading
    // the document, so shipped-page console.error calls remain a real render gate.
    const runtime = await page.context().newCDPSession(page);
    runtime.on('Runtime.consoleAPICalled', (event) => {
      if (event.type !== 'error') return;
      const detail = event.args.map((argument) => {
        if (Object.prototype.hasOwnProperty.call(argument, 'value')) return String(argument.value);
        return argument.description || argument.type;
      }).join(' ');
      consoleErrors.push('console.error: ' + detail);
    });
    runtime.on('Runtime.exceptionThrown', (event) => {
      const detail = event.exceptionDetails.exception && event.exceptionDetails.exception.description;
      consoleErrors.push('pageerror: ' + (detail || event.exceptionDetails.text));
    });
    await runtime.send('Runtime.enable');
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push('console.error: ' + message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push('pageerror: ' + error.message));
    await page.goto(pathToFileURL(resolvedPagePath).href, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(900);
  } catch (error) {
    if (error && error.code) throw error;
    throw smokeFailure('RENDER_LOAD_FAILURE', resolvedPagePath + ' could not load: ' + error.message);
  } finally {
    await browser.close();
  }
  if (consoleErrors.length) {
    throw smokeFailure('RENDER_CONSOLE_ERRORS', consoleErrors.length + ' console error(s) while rendering ' + resolvedPagePath + ':\n' + consoleErrors.join('\n'));
  }
  console.log('PASS render — ' + resolvedPagePath + ' loaded with 0 console errors.');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  console.log('Visigner smoke gate — skill count ' + EXPECTED_SKILL_COUNT + ', corpus record count ' + EXPECTED_CORPUS_RECORD_COUNT + '.');
  smokeSkills();
  smokeCorpus(options.corpusDir);
  smokeReasoningAndAntiPatterns();
  smokeBrandLint();
  if (process.env.RENDER === '0') {
    // Explicit opt-out for environments without a browser (e.g. fresh-install CI).
    // Named as UNVERIFIED, never silently skipped; all other guards still gate the exit.
    console.log('render UNVERIFIED (RENDER=0) — page-render guard skipped by explicit opt-out.');
  } else {
    await smokeRender(options.pagePath);
  }
  console.log('SMOKE PASS — all enabled guards passed.');
}

main().catch((error) => {
  console.error('SMOKE FAIL — ' + (error.code || 'UNEXPECTED_FAILURE') + ': ' + error.message);
  process.exitCode = 1;
});
