#!/usr/bin/env node
'use strict';

/*
 * G4.4 bounded composer fallback.
 *
 * The input selection is kept immutable. Each retry gets a selection snapshot,
 * a diagnostic assembly, and a grammar gate result. Only a gate-passing retry
 * may become the requested final page; a failed run writes a report and exits
 * non-zero without writing that final page.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// The tree this script belongs to is the one it sits in — not a directory that happens to be
// called v3 two levels up. Deriving it from __dirname is what lets the whole machinery be
// copied into the shipped plugin and still run.
const V3_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(V3_ROOT, '..');
const MODULES_ROOT = path.join(V3_ROOT, 'modules');
const COMPOSER_ROOT = path.join(V3_ROOT, 'composer');
const ASSEMBLER = path.join(__dirname, 'composer-assemble.js');
const GRAMMAR_LINT = path.join(__dirname, 'grammar-lint.js');
const MAX_RETRIES = 2;
const VARIANT_AXES = ['layoutArchetype', 'density', 'backgroundBleed', 'motion', 'artDirection'];
const VARIANT_ENUMS = {
  layoutArchetype: new Set(['centered', 'split', 'stack', 'grid', 'rail', 'timeline', 'comparison-table', 'media-led']),
  density: new Set(['airy', 'standard', 'compact']),
  backgroundBleed: new Set(['surface-contained', 'surface-bleed', 'card-contained', 'contrast-bleed', 'media-bleed']),
  motion: new Set(['none', 'reveal', 'stagger', 'scroll-linked']),
  artDirection: new Set(['typographic', 'editorial', 'product-ui', 'documentary', 'data-led', 'photographic'])
};

function fail(message) {
  throw new Error(`composer-fallback: ${message}`);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function displayPath(filePath) {
  const relative = path.relative(process.cwd(), filePath);
  return relative && !relative.startsWith('..') ? toPosix(relative) : toPosix(filePath);
}

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative === ''
    || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function assertRunArtifact(filePath, label) {
  if (!isWithin(COMPOSER_ROOT, filePath)) fail(`${label} must stay inside the composer run directory`);
  const relative = path.relative(COMPOSER_ROOT, filePath);
  if (relative.split(path.sep).length !== 2) {
    fail(`${label} must be a direct artifact of <composer>/<run>`);
  }
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`cannot read ${label}: ${displayPath(filePath)} (${error.message})`);
  }
}

function writeJson(filePath, value) {
  assertRunArtifact(filePath, 'fallback output');
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeVariants(value) {
  if (!isPlainObject(value)) return null;
  const variants = {};
  for (const axis of VARIANT_AXES) {
    if (!VARIANT_ENUMS[axis].has(value[axis])) return null;
    variants[axis] = value[axis];
  }
  return variants;
}

function variantKey(moduleId, variants) {
  return `${moduleId}|${JSON.stringify(VARIANT_AXES.map((axis) => variants[axis]))}`;
}

function resolveModuleFile(selectionFile, moduleRef) {
  if (typeof moduleRef !== 'string' || moduleRef.trim() === '') return null;
  const resolvedRef = path.resolve(path.dirname(selectionFile), moduleRef);
  const moduleFile = path.basename(resolvedRef) === 'module.json'
    ? resolvedRef
    : path.join(resolvedRef, 'module.json');
  if (!isWithin(MODULES_ROOT, moduleFile)) return null;
  return moduleFile;
}

function loadModule(selectionFile, moduleRef) {
  const moduleFile = resolveModuleFile(selectionFile, moduleRef);
  if (!moduleFile || !fs.existsSync(moduleFile)) return null;
  const module = readJson(moduleFile, 'catalog module');
  if (!isPlainObject(module)) return null;
  return { moduleFile, module };
}

function selectionSection(selection, index) {
  if (!Array.isArray(selection.sections) || !isPlainObject(selection.sections[index])) return null;
  return selection.sections[index];
}

function sectionSnapshot(selection, index) {
  const section = selectionSection(selection, index);
  if (!section) return null;
  return {
    index,
    order: section.order == null ? index + 1 : section.order,
    type: section.type || null,
    moduleId: section.moduleId || null,
    module: section.module || null,
    variants: normalizeVariants(section.variants) || section.variants || null
  };
}

function parseViolations(output) {
  const violations = [];
  for (const line of String(output || '').split(/\r?\n/)) {
    const match = line.match(/^\s*\[([^\]]+)\]\s+(.+)$/);
    if (match) violations.push({ rule: match[1], detail: match[2].trim() });
  }
  if (violations.length === 0 && String(output || '').trim()) {
    violations.push({ rule: 'gate-result', detail: String(output).trim() });
  }
  return violations;
}

function inferSectionIndex(selection, violations) {
  for (const violation of violations) {
    const pair = violation.detail.match(/sections\[(\d+)\]\s+and\s+sections\[(\d+)\]/);
    if (pair) return Number(pair[2]);
    const single = violation.detail.match(/sections\[(\d+)\]/);
    if (single) return Number(single[1]);
  }
  for (const violation of violations) {
    for (let index = 0; index < (selection.sections || []).length; index += 1) {
      const section = selection.sections[index];
      if (violation.detail.includes(section.moduleId || '') || violation.detail.includes(section.module || '')) {
        return index;
      }
    }
  }
  return null;
}

function runNode(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const output = [result.stdout, result.stderr]
    .filter((part) => typeof part === 'string' && part.length > 0)
    .join('');
  return {
    exitCode: Number.isInteger(result.status) ? result.status : 1,
    output: output.trimEnd(),
    error: result.error ? result.error.message : null
  };
}

function commandLabel(script, args) {
  return [process.execPath, script, ...args].map(displayPath).join(' ');
}

function candidateVariants(candidate, module) {
  return normalizeVariants(candidate.resolvedVariants)
    || normalizeVariants(candidate.variants)
    || normalizeVariants(candidate.defaultVariants)
    || normalizeVariants(module.variants);
}

function candidateList(selectionFile, selection, index, tried) {
  const section = selectionSection(selection, index);
  if (!section || !Array.isArray(section.candidateRanking)) return [];
  const candidates = [];
  for (const candidate of section.candidateRanking) {
    if (!isPlainObject(candidate)) continue;
    const moduleRef = typeof candidate.module === 'string'
      ? candidate.module
      : `../../modules/${section.type}/${candidate.moduleId || ''}`;
    const loaded = loadModule(selectionFile, moduleRef);
    if (!loaded || loaded.module.type !== section.type) continue;
    const variants = candidateVariants(candidate, loaded.module);
    if (!variants) continue;
    const key = variantKey(loaded.module.name, variants);
    if (tried.has(key)) continue;
    candidates.push({
      rank: Number.isFinite(candidate.rank) ? candidate.rank : Number.MAX_SAFE_INTEGER,
      moduleRef,
      module: loaded.module,
      variants,
      key
    });
  }
  return candidates.sort((left, right) => (
    left.rank - right.rank || left.module.name.localeCompare(right.module.name)
  ));
}

function catalogProvenance(module) {
  const source = module.provenance || (module.corpusSource && module.corpusSource.recordId === 'schema'
    ? 'schema-authored'
    : 'mined');
  const variant = module.variantProvenance || (source === 'schema-authored'
    ? 'schema-authored'
    : 'structure-mined');
  return {
    source,
    variant,
    recordId: module.corpusSource && module.corpusSource.recordId,
    sectionSpan: module.corpusSource && module.corpusSource.sectionSpan,
    gateProfile: module.gateProfile
  };
}

function replaceSection(selection, index, candidate, retry, reason) {
  const next = clone(selection);
  const section = next.sections[index];
  const from = sectionSnapshot(selection, index);
  section.module = candidate.moduleRef;
  section.moduleId = candidate.module.name;
  section.type = candidate.module.type;
  section.variants = candidate.variants;
  section.catalogProvenance = catalogProvenance(candidate.module);
  section.selectionReason = `${section.selectionReason || 'selection'}; fallback retry ${retry}: ${reason}`;
  return {
    selection: next,
    replacement: {
      status: 'replaced',
      candidateRank: candidate.rank,
      reason,
      from,
      to: sectionSnapshot(next, index)
    }
  };
}

function unavailableReplacement(selection, index, reason) {
  return {
    selection,
    replacement: {
      status: 'unavailable',
      candidateRank: null,
      reason,
      from: sectionSnapshot(selection, index),
      to: null
    }
  };
}

function summarizeRecord(record) {
  return {
    attempt: record.attempt,
    kind: record.kind,
    selectionFile: record.selectionFile,
    pageFile: record.pageFile,
    gateLog: record.gateLog,
    passed: record.passed,
    gate: {
      assembleExit: record.gate.assembleExit,
      grammarExit: record.gate.grammarExit,
      exitCode: record.gate.exitCode,
      result: record.gate.result,
      violations: record.gate.violations
    },
    failedSection: record.failedSection,
    replacement: record.replacement
  };
}

function buildGateLog(attempt, selectionFile, pageFile, assembly, lint, gate) {
  const lines = [
    `attempt: ${attempt}`,
    `selection: ${displayPath(selectionFile)}`,
    `diagnostic-page: ${displayPath(pageFile)}`,
    `assemble-command: ${commandLabel(ASSEMBLER, [selectionFile, pageFile])}`,
    `assemble-exit: ${assembly.exitCode}`,
    '--- composer-assemble output ---',
    assembly.output || '(no output)'
  ];
  if (lint) {
    lines.push(
      `grammar-command: ${commandLabel(GRAMMAR_LINT, [selectionFile])}`,
      `grammar-exit: ${lint.exitCode}`,
      '--- grammar-lint output ---',
      lint.output || '(no output)'
    );
  } else {
    lines.push('grammar-exit: not-run');
  }
  lines.push(`gate-result: ${gate.result}`, `gate-exit: ${gate.exitCode}`);
  return `${lines.join('\n')}\n`;
}

function evaluateAttempt({
  selection,
  attempt,
  kind,
  trigger,
  replacement,
  history,
  runDirectory,
  selectionFile,
  explicitSectionIndex
}) {
  const snapshotFile = path.join(runDirectory, `selection-attempt-${attempt}.json`);
  const pageFile = path.join(runDirectory, `page-attempt-${attempt}.html`);
  const gateLog = path.join(runDirectory, `gate-attempt-${attempt}.log`);
  const snapshot = clone(selection);
  snapshot.fallbackAttempt = {
    attempt,
    kind,
    trigger,
    replacement,
    gate: null
  };
  snapshot.fallbackHistory = history.map(summarizeRecord);
  writeJson(snapshotFile, snapshot);

  const assembly = runNode(ASSEMBLER, [snapshotFile, pageFile]);
  const lint = assembly.exitCode === 0
    ? runNode(GRAMMAR_LINT, [snapshotFile])
    : null;
  const gateOutput = lint ? lint.output : assembly.output;
  const violations = lint
    ? lint.exitCode === 0 ? [] : parseViolations(lint.output)
    : [{ rule: 'assembly', detail: assembly.output || 'composer-assemble did not complete' }];
  const gateExit = lint ? lint.exitCode : assembly.exitCode;
  const gate = {
    result: assembly.exitCode === 0 && lint && lint.exitCode === 0 ? 'PASS' : 'FAIL',
    assembleExit: assembly.exitCode,
    grammarExit: lint ? lint.exitCode : null,
    exitCode: gateExit,
    violations,
    output: gateOutput
  };
  const failedSectionIndex = gate.result === 'PASS'
    ? null
    : explicitSectionIndex != null
      ? explicitSectionIndex
      : inferSectionIndex(selection, violations);
  const record = {
    attempt,
    kind,
    selectionFile: displayPath(snapshotFile),
    pageFile: displayPath(pageFile),
    gateLog: displayPath(gateLog),
    passed: gate.result === 'PASS',
    gate,
    failedSection: sectionSnapshot(selection, failedSectionIndex),
    replacement,
    trigger
  };
  fs.writeFileSync(gateLog, buildGateLog(attempt, snapshotFile, pageFile, assembly, lint, gate));
  snapshot.fallbackAttempt.gate = {
    result: gate.result,
    assembleExit: gate.assembleExit,
    grammarExit: gate.grammarExit,
    exitCode: gate.exitCode,
    violations: gate.violations,
    log: displayPath(gateLog)
  };
  snapshot.fallbackAttempt.failedSection = record.failedSection;
  writeJson(snapshotFile, snapshot);
  return record;
}

function validateSelectionInput(selection, selectionFile) {
  if (!isPlainObject(selection)) fail('selection must be a JSON object');
  if (!Array.isArray(selection.sections) || selection.sections.length === 0) {
    fail('selection.sections must be a non-empty array');
  }
  selection.sections.forEach((section, index) => {
    if (!isPlainObject(section)) fail(`selection.sections[${index}] must be an object`);
    if (typeof section.module !== 'string' || typeof section.moduleId !== 'string' || typeof section.type !== 'string') {
      fail(`selection.sections[${index}] must provide module, moduleId, and type`);
    }
    if (!resolveModuleFile(selectionFile, section.module)) {
      fail(`selection.sections[${index}].module must resolve inside v3/modules`);
    }
    if (!normalizeVariants(section.variants)) {
      fail(`selection.sections[${index}].variants must contain the five SECTION-SCHEMA axes`);
    }
  });
}

function parseArgs(args) {
  if (args.length !== 2 && args.length !== 4) {
    fail('usage: node v3/scripts/composer-fallback.js <selection.json> <page.html> [--section-index N]');
  }
  const selectionFile = path.resolve(args[0]);
  const outputFile = path.resolve(args[1]);
  let explicitSectionIndex = null;
  if (args.length === 4) {
    if (args[2] !== '--section-index' || !/^\d+$/.test(args[3])) {
      fail('optional section selector must be --section-index N');
    }
    explicitSectionIndex = Number(args[3]);
  }
  assertRunArtifact(selectionFile, 'selection input');
  assertRunArtifact(outputFile, 'page output');
  if (path.dirname(selectionFile) !== path.dirname(outputFile)) {
    fail('selection input and page output must be in the same composer run directory');
  }
  if (fs.existsSync(outputFile)) {
    fail(`refusing to overwrite existing final page: ${displayPath(outputFile)}`);
  }
  return {
    selectionFile,
    outputFile,
    runDirectory: path.dirname(selectionFile),
    explicitSectionIndex
  };
}

function failureReport(outputFile, history, finalRecord) {
  return {
    failureReportVersion: '1.0.0',
    status: 'FAIL_CLOSED',
    exitCode: 1,
    maxRetries: MAX_RETRIES,
    retriesUsed: Math.max(0, history.length - 1),
    finalOutput: {
      file: displayPath(outputFile),
      written: false,
      exists: fs.existsSync(outputFile)
    },
    failedSection: finalRecord.failedSection,
    violations: finalRecord.gate.violations,
    attemptHistory: history.map(summarizeRecord)
  };
}

function main(args) {
  const options = parseArgs(args);
  const selection = readJson(options.selectionFile, 'selection');
  validateSelectionInput(selection, options.selectionFile);
  if (options.explicitSectionIndex != null && options.explicitSectionIndex >= selection.sections.length) {
    fail(`--section-index ${options.explicitSectionIndex} is outside selection.sections`);
  }

  let currentSelection = clone(selection);
  const history = [];
  const triedBySection = new Map();
  const initial = evaluateAttempt({
    selection: currentSelection,
    attempt: 0,
    kind: 'initial',
    trigger: null,
    replacement: null,
    history,
    runDirectory: options.runDirectory,
    selectionFile: options.selectionFile,
    explicitSectionIndex: options.explicitSectionIndex
  });
  history.push(initial);
  process.stdout.write(`attempt 0: grammar gate exit ${initial.gate.exitCode}\n`);
  if (initial.passed) {
    const finalSelection = clone(currentSelection);
    finalSelection.fallbackSummary = {
      result: 'RECOVERED_OR_INITIAL_PASS',
      retriesUsed: 0,
      maxRetries: MAX_RETRIES,
      finalAttempt: 0,
      finalGateExit: 0,
      finalPage: displayPath(options.outputFile)
    };
    finalSelection.fallbackHistory = history.map(summarizeRecord);
    const finalSelectionFile = path.join(options.runDirectory, 'selection.final.json');
    writeJson(finalSelectionFile, finalSelection);
    fs.copyFileSync(path.join(options.runDirectory, 'page-attempt-0.html'), options.outputFile);
    process.stdout.write(`PASS: final page ${displayPath(options.outputFile)}\n`);
    return 0;
  }

  let previous = initial;
  for (let retry = 1; retry <= MAX_RETRIES; retry += 1) {
    const sectionIndex = options.explicitSectionIndex != null
      ? options.explicitSectionIndex
      : previous.failedSection
        ? previous.failedSection.index
        : null;
    let replacementResult;
    if (sectionIndex == null || !selectionSection(currentSelection, sectionIndex)) {
      replacementResult = unavailableReplacement(
        currentSelection,
        sectionIndex,
        'The gate did not identify a replaceable section; retry remains fail-closed.'
      );
    } else {
      const section = currentSelection.sections[sectionIndex];
      if (!triedBySection.has(sectionIndex)) {
        triedBySection.set(sectionIndex, new Set([variantKey(section.moduleId, section.variants)]));
      }
      const tried = triedBySection.get(sectionIndex);
      const candidates = candidateList(options.selectionFile, currentSelection, sectionIndex, tried);
      if (candidates.length === 0) {
        replacementResult = unavailableReplacement(
          currentSelection,
          sectionIndex,
          `No unused ${section.type} candidate with a different valid variant is available; retry remains fail-closed.`
        );
      } else {
        const candidate = candidates[0];
        tried.add(candidate.key);
        const reason = `grammar-lint rejected section ${sectionIndex}; selected the next ranked ${section.type} variant (${candidate.module.name})`;
        replacementResult = replaceSection(currentSelection, sectionIndex, candidate, retry, reason);
        currentSelection = replacementResult.selection;
      }
    }

    const trigger = {
      failedSection: previous.failedSection,
      violations: previous.gate.violations,
      gateExit: previous.gate.exitCode,
      gateLog: previous.gateLog
    };
    const attempt = evaluateAttempt({
      selection: currentSelection,
      attempt: retry,
      kind: 'retry',
      trigger,
      replacement: replacementResult.replacement,
      history,
      runDirectory: options.runDirectory,
      selectionFile: options.selectionFile,
      explicitSectionIndex: options.explicitSectionIndex
    });
    history.push(attempt);
    process.stdout.write(
      `retry ${retry}: ${replacementResult.replacement.status}; grammar gate exit ${attempt.gate.exitCode}\n`
    );
    if (attempt.passed) {
      const finalSelection = clone(currentSelection);
      finalSelection.fallbackSummary = {
        result: 'RECOVERED',
        retriesUsed: retry,
        maxRetries: MAX_RETRIES,
        finalAttempt: retry,
        finalGateExit: 0,
        finalPage: displayPath(options.outputFile)
      };
      finalSelection.fallbackHistory = history.map(summarizeRecord);
      const finalSelectionFile = path.join(options.runDirectory, 'selection.final.json');
      writeJson(finalSelectionFile, finalSelection);
      fs.copyFileSync(path.join(options.runDirectory, `page-attempt-${retry}.html`), options.outputFile);
      process.stdout.write(`PASS: recovered after ${retry} retry; final page ${displayPath(options.outputFile)}\n`);
      return 0;
    }
    previous = attempt;
  }

  const reportFile = path.join(options.runDirectory, 'failure-report.json');
  writeJson(reportFile, failureReport(options.outputFile, history, previous));
  process.stderr.write(
    `FAIL_CLOSED: ${MAX_RETRIES} retries exhausted; final page was not written; report ${displayPath(reportFile)}\n`
  );
  return 1;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
