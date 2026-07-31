#!/usr/bin/env node
'use strict';

/*
 * G4.3 two-tier verification
 *
 * Tier 1 is authoritative and page-scoped.  Tier 2 is deliberately a
 * diagnostic-only fan-out: it runs section validation only after Tier 1 fails,
 * and it can never turn a failed page gate into a pass.
 */

const fs = require('fs');
const path = require('path');
const {
  REPO_ROOT,
  DEFAULT_BRAND,
  assertComposerRunDirectory,
  inspectManifest,
  collectDiversity,
  runGrammarLint,
  runConsistencyChecks,
  runNode,
  displayPath
} = require('./diversity-consistency-report.js');

const SECTION_VALIDATE = path.join(__dirname, 'section-validate.js');
const ANTI_AI_EVAL = path.join(REPO_ROOT, 'skills', 'detail-page', 'scripts', 'anti-ai-eval.js');

function fail(message) {
  throw new Error(`two-tier-gate: ${message}`);
}

function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--help' || value === '-h') {
      flags.help = true;
    } else if (value === '--brand' || value === '--workdir' || value === '--out') {
      const next = argv[++index];
      if (!next || next.startsWith('--')) fail(`${value} requires a value`);
      flags[value.slice(2)] = next;
    } else if (value.startsWith('--')) {
      fail(`unknown option: ${value}`);
    } else {
      positionals.push(value);
    }
  }
  return { positionals, flags };
}

function usage() {
  return [
    'Usage: node v3/scripts/two-tier-gate.js <selection-or-composition.json> <page.html>',
    '       [--brand skills/detail-page/tokens/brand-default.tokens.json]',
    '       [--workdir v3/composer/<run>] [--out docs/goals/evidence/.../gate.json]'
  ].join('\n');
}

function readJsonOrError(filePath) {
  try {
    return { report: JSON.parse(fs.readFileSync(filePath, 'utf8')), parseError: null };
  } catch (error) {
    return { report: null, parseError: error.message };
  }
}

function runAntiAi(pageFile, workdir, brandLintPath) {
  const reportPath = path.join(workdir, 'anti-ai-report.json');
  const args = [pageFile];
  if (brandLintPath) args.push('--brand-lint', brandLintPath);
  const result = runNode(ANTI_AI_EVAL, args, workdir);
  const parsed = readJsonOrError(reportPath);
  const pass = result.exitCode === 0 && parsed.report && parsed.report.verdict === 'clean' && parsed.report.s2Pass === true;
  return {
    ...result,
    reportPath,
    report: parsed.report,
    parseError: parsed.parseError,
    pass
  };
}

function failedCheck(reason) {
  return { pass: false, error: reason };
}

function runTier1(manifestFile, pageFile, workdir, brandFile) {
  let model = null;
  let modelError = null;
  try {
    model = inspectManifest(manifestFile);
  } catch (error) {
    modelError = error.message;
  }

  const grammar = runGrammarLint(manifestFile, workdir);
  let consistency = failedCheck('manifest could not be inspected');
  if (model) {
    try {
      consistency = runConsistencyChecks(model, pageFile, workdir, brandFile);
    } catch (error) {
      consistency = failedCheck(error.message);
    }
  }
  const antiAi = runAntiAi(
    pageFile,
    workdir,
    consistency.brand && consistency.brand.page ? consistency.brand.page.reportPath : null
  );
  const pass = !modelError && grammar.pass && consistency.pass && antiAi.pass;
  return { pass, model, modelError, grammar, consistency, antiAi };
}

function runTier2(tier1, workdir) {
  const diagnostics = {
    invoked: true,
    reason: 'Tier 1 failed',
    grammarViolations: tier1.grammar.violations,
    assembly: tier1.consistency.assembly || null,
    adjacent: [],
    sectionChecks: [],
    pass: false
  };
  if (!tier1.model) {
    diagnostics.modelError = tier1.modelError || 'manifest was unavailable for section diagnostics';
    return diagnostics;
  }
  const diversity = collectDiversity(tier1.model);
  diagnostics.adjacent = diversity.rows;
  for (const section of tier1.model.sections) {
    if (!section.moduleDir) {
      diagnostics.sectionChecks.push({
        index: section.index + 1,
        module: section.entry && section.entry.module ? section.entry.module : null,
        exitCode: 1,
        pass: false,
        stdout: '',
        stderr: section.error || 'module could not be resolved'
      });
      continue;
    }
    const result = runNode(SECTION_VALIDATE, [section.moduleDir], workdir);
    diagnostics.sectionChecks.push({
      index: section.index + 1,
      module: section.entry.module,
      moduleDir: displayPath(section.moduleDir),
      ...result,
      pass: result.exitCode === 0
    });
  }
  diagnostics.pass = diversity.pass && diagnostics.sectionChecks.length === tier1.model.declaredSections &&
    diagnostics.sectionChecks.every((check) => check.pass);
  return diagnostics;
}

function checkState(value) {
  return value ? 'PASS' : 'FAIL';
}

function formatTier1(tier1) {
  const lines = [];
  lines.push('TIER 1 — PAGE GATE');
  lines.push(`grammar-lint: ${checkState(tier1.grammar.pass)} (exit ${tier1.grammar.exitCode}; violations ${tier1.grammar.violationCount == null ? 'n/a' : tier1.grammar.violationCount})`);
  if (tier1.consistency.error) {
    lines.push(`brand-lint / consistency: FAIL (${tier1.consistency.error})`);
  } else {
    const pageBrand = tier1.consistency.brand.page;
    const strict = tier1.consistency.brand.strictMetrics;
    const assembly = tier1.consistency.assembly;
    const provenance = tier1.consistency.provenance;
    lines.push(`assembled-page binding: ${checkState(assembly.pass)} (${assembly.matchedEntries}/${assembly.expectedEntries} exact entries)`);
    lines.push(`brand-lint page: ${checkState(tier1.consistency.brand.pagePass)} (exit ${pageBrand.exitCode}; errors ${pageBrand.report ? pageBrand.report.errorCount : 'n/a'})`);
    lines.push(`brand-lint linked token ΔE=0: ${checkState(tier1.consistency.brand.strictPass)} (${strict.checkedPass == null ? 'n/a' : `${strict.checkedPass}/${strict.checkedTotal}`}; unmatched ${strict.unmatched == null ? 'n/a' : strict.unmatched}; off-brand ${strict.offBrandCount})`);
    lines.push(`token ceiling: ${checkState(tier1.consistency.pass)} (token set=${checkState(tier1.consistency.tokenSetPass)}; source=${checkState(tier1.consistency.sourcePass)}; raw hex/px=${checkState(tier1.consistency.rawPass)})`);
    lines.push(`token provenance: ${checkState(provenance.pass)} (refs=${provenance.references}; source imports=${provenance.sourceImports.length}; outside declarations=${provenance.outsideDeclarations.length}; unknown refs=${provenance.unknownReferences.length}; bridge drift=${provenance.bridgeDrift.length})`);
  }
  const anti = tier1.antiAi;
  lines.push(`anti-ai-eval: ${checkState(anti.pass)} (exit ${anti.exitCode}; verdict=${anti.report ? anti.report.verdict : 'unreadable'}; s2Pass=${anti.report ? anti.report.s2Pass : 'unreadable'})`);
  if (tier1.modelError) lines.push(`manifest inspection: FAIL (${tier1.modelError})`);
  lines.push(`TIER 1 RESULT: ${checkState(tier1.pass)}`);
  return lines;
}

function formatTier2(tier2) {
  const lines = [];
  lines.push('TIER 2 — SECTION DIAGNOSTICS (invoked only after Tier 1 failure)');
  if (tier2.modelError) {
    lines.push(`manifest diagnostics unavailable: ${tier2.modelError}`);
  } else {
    if (tier2.assembly && !tier2.assembly.pass) {
      lines.push('assembled-page binding detail:');
      for (const row of tier2.assembly.rows.filter((row) => !row.pass)) {
        lines.push(`  section ${row.index}: ${row.differences.join('; ')}`);
      }
    }
    if (tier2.grammarViolations && tier2.grammarViolations.length) {
      lines.push('grammar-lint detail:');
      for (const violation of tier2.grammarViolations) lines.push(`  [${violation.rule}] ${violation.detail}`);
    }
    lines.push('adjacent detail:');
    for (const row of tier2.adjacent) {
      const axes = row.count == null ? 'n/a' : `${row.count}/5 [${row.differentAxes.join(', ') || 'none'}]`;
      lines.push(`  ${row.pair}: ${axes}; layout=${row.layoutDifferent == null ? 'n/a' : row.layoutDifferent ? 'different' : 'same'} → ${checkState(row.pass)}`);
    }
    lines.push('section-validate detail:');
    for (const check of tier2.sectionChecks) {
      lines.push(`  section ${check.index}: ${checkState(check.pass)} (exit ${check.exitCode}) ${check.module || 'unresolved module'}`);
      const failures = (check.stdout || '').split('\n').filter((line) => /^\s*\[/.test(line));
      for (const failure of failures) lines.push(`    ${failure.trim()}`);
      if (check.error) lines.push(`    ${check.error}`);
      if (check.stderr) lines.push(`    ${String(check.stderr).trim()}`);
    }
  }
  lines.push(`TIER 2 DIAGNOSTIC RESULT: ${checkState(tier2.pass)} (does not override Tier 1)`);
  return lines;
}

function formatGate(gate) {
  const lines = ['G4.3 TWO-TIER GATE', `manifest: ${gate.manifest}`, `page: ${gate.page}`, ''];
  lines.push(...formatTier1(gate.tier1));
  lines.push('');
  if (gate.tier2.invoked) {
    lines.push(...formatTier2(gate.tier2));
  } else {
    lines.push('TIER 2: NOT INVOKED (Tier 1 passed; section validation fan-out avoided)');
  }
  lines.push('');
  lines.push(`FINAL RESULT: ${gate.verdict} (exit ${gate.exitCode})`);
  return lines.join('\n');
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function main(argv) {
  const { positionals, flags } = parseArgs(argv);
  if (flags.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  if (positionals.length !== 2) fail(usage());
  const manifestFile = path.resolve(positionals[0]);
  const pageFile = path.resolve(positionals[1]);
  if (!fs.existsSync(manifestFile) || !fs.statSync(manifestFile).isFile()) fail(`manifest is not a file: ${displayPath(manifestFile)}`);
  if (!fs.existsSync(pageFile) || !fs.statSync(pageFile).isFile()) fail(`page is not a file: ${displayPath(pageFile)}`);
  const workdir = path.resolve(flags.workdir || path.dirname(pageFile));
  const brandFile = path.resolve(flags.brand || DEFAULT_BRAND);
  assertComposerRunDirectory(workdir, 'workdir');
  if (!fs.existsSync(brandFile) || !fs.statSync(brandFile).isFile()) fail(`brand token source is not a file: ${displayPath(brandFile)}`);

  const tier1 = runTier1(manifestFile, pageFile, workdir, brandFile);
  const tier2 = tier1.pass
    ? { invoked: false, reason: 'Tier 1 passed', sectionChecks: [], adjacent: [], pass: null }
    : runTier2(tier1, workdir);
  const pass = tier1.pass;
  const gate = {
    schemaVersion: 'g4.3.0',
    manifest: displayPath(manifestFile),
    page: displayPath(pageFile),
    workdir: displayPath(workdir),
    tier1,
    tier2,
    verdict: pass ? 'PASS' : 'FAIL',
    exitCode: pass ? 0 : 1
  };
  if (flags.out) writeJson(path.resolve(flags.out), gate);
  process.stdout.write(`${formatGate(gate)}\n`);
  return gate.exitCode;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
