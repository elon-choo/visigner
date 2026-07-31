#!/usr/bin/env node
'use strict';

/*
 * G4.3 simultaneous proof
 *
 * A composition is only accepted when the existing grammar gate proves the
 * diversity floor AND the assembled page proves the single-token consistency
 * ceiling.  The linked token stylesheet is inlined into a disposable probe so
 * brand-lint can make a real ΔE comparison instead of silently reporting 0/0
 * for an external stylesheet.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// The tree this script belongs to is the one it sits in — not a directory that happens to be
// called v3 two levels up. Deriving it from __dirname is what lets the whole machinery be
// copied into the shipped plugin and still run.
const V3_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(V3_ROOT, '..');
const COMPOSER_ROOT = path.join(V3_ROOT, 'composer');
const GRAMMAR_LINT = path.join(__dirname, 'grammar-lint.js');
const BRAND_LINT = path.join(REPO_ROOT, 'skills', 'detail-page', 'scripts', 'brand-lint.js');
const DEFAULT_BRAND = path.join(REPO_ROOT, 'skills', 'detail-page', 'tokens', 'brand-default.tokens.json');
const VARIANT_AXES = ['layoutArchetype', 'density', 'backgroundBleed', 'motion', 'artDirection'];
const VARIANT_ENUMS = {
  layoutArchetype: new Set(['centered', 'split', 'stack', 'grid', 'rail', 'timeline', 'comparison-table', 'media-led']),
  density: new Set(['airy', 'standard', 'compact']),
  backgroundBleed: new Set(['surface-contained', 'surface-bleed', 'card-contained', 'contrast-bleed', 'media-bleed']),
  motion: new Set(['none', 'reveal', 'stagger', 'scroll-linked']),
  artDirection: new Set(['typographic', 'editorial', 'product-ui', 'documentary', 'data-led', 'photographic'])
};

function fail(message) {
  throw new Error(`diversity-consistency-report: ${message}`);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function assertComposerRunDirectory(directory, label) {
  const relative = path.relative(COMPOSER_ROOT, directory);
  if (
    relative === '' ||
    relative.startsWith(`..${path.sep}`) ||
    relative === '..' ||
    path.isAbsolute(relative) ||
    relative.split(path.sep).length !== 1
  ) {
    fail(`${label} must be a direct v3/composer/<run> directory`);
  }
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    fail(`${label} does not exist or is not a directory: ${displayPath(directory)}`);
  }
}

function readText(filePath, label) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    fail(`cannot read ${label}: ${displayPath(filePath)} (${error.message})`);
  }
}

function readJson(filePath, label) {
  try {
    return JSON.parse(readText(filePath, label));
  } catch (error) {
    fail(`cannot parse ${label}: ${displayPath(filePath)} (${error.message})`);
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
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
    'Usage: node v3/scripts/diversity-consistency-report.js <selection-or-composition.json> <page.html>',
    '       [--brand skills/detail-page/tokens/brand-default.tokens.json]',
    '       [--workdir v3/composer/<run>] [--out docs/goals/evidence/.../report.json]'
  ].join('\n');
}

function runNode(script, args, cwd, env) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...(env || {}) }
  });
  const exitCode = typeof result.status === 'number' ? result.status : 1;
  return {
    command: `node ${displayPath(script)} ${args.map((arg) => JSON.stringify(arg)).join(' ')}`,
    exitCode,
    signal: result.signal || null,
    error: result.error ? result.error.message : null,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function getAttribute(tag, attribute) {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = tag.match(matcher);
  return match ? (match[1] || match[2] || match[3] || '') : null;
}

function getAllAttributeValues(html, attribute) {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(`\\s${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'gi');
  const values = [];
  let match;
  while ((match = matcher.exec(html)) !== null) values.push(match[1] || match[2] || match[3] || '');
  return values;
}

function resolveModuleFile(manifestFile, moduleRef) {
  const resolved = path.resolve(path.dirname(manifestFile), moduleRef);
  return path.basename(resolved) === 'module.json' ? resolved : path.join(resolved, 'module.json');
}

function validVariants(variants) {
  if (!isPlainObject(variants)) return false;
  if (Object.keys(variants).length !== VARIANT_AXES.length) return false;
  return VARIANT_AXES.every((axis) => VARIANT_ENUMS[axis].has(variants[axis]));
}

function inspectManifest(manifestFile) {
  const manifest = readJson(manifestFile, 'selection/composition manifest');
  const errors = [];
  const entries = Array.isArray(manifest.sections) ? manifest.sections : [];
  if (!Array.isArray(manifest.sections)) errors.push('sections must be an ordered array');
  const sections = entries.map((entry, index) => {
    const section = { index, entry, moduleFile: null, moduleDir: null, module: null, variants: null, error: null };
    if (!isPlainObject(entry) || typeof entry.module !== 'string' || entry.module.trim() === '') {
      section.error = `sections[${index}].module is not a non-empty path`;
      errors.push(section.error);
      return section;
    }
    const moduleFile = resolveModuleFile(manifestFile, entry.module);
    section.moduleFile = moduleFile;
    section.moduleDir = path.dirname(moduleFile);
    try {
      section.module = readJson(moduleFile, `sections[${index}] module metadata`);
    } catch (error) {
      section.error = error.message;
      errors.push(section.error);
      return section;
    }
    const variants = Object.prototype.hasOwnProperty.call(entry, 'variants') ? entry.variants : section.module.variants;
    if (!validVariants(variants)) {
      section.error = `sections[${index}] has no valid five-axis variant vector`;
      errors.push(section.error);
      return section;
    }
    section.variants = Object.fromEntries(VARIANT_AXES.map((axis) => [axis, variants[axis]]));
    return section;
  });
  return {
    file: manifestFile,
    manifest,
    core: isPlainObject(manifest.core) ? manifest.core : null,
    sections,
    declaredSections: entries.length,
    resolvedSections: sections.filter((section) => section.variants !== null).length,
    errors
  };
}

function collectDiversity(model) {
  const totalPairs = Math.max(0, model.declaredSections - 1);
  let evaluatedPairs = 0;
  const rows = [];
  for (let index = 1; index < model.sections.length; index += 1) {
    const left = model.sections[index - 1];
    const right = model.sections[index];
    if (!left.variants || !right.variants) {
      rows.push({
        pair: `${index}→${index + 1}`,
        differentAxes: [],
        count: null,
        layoutDifferent: null,
        pass: false,
        reason: 'not evaluable because one section has no valid variant vector'
      });
      continue;
    }
    const differentAxes = VARIANT_AXES.filter((axis) => left.variants[axis] !== right.variants[axis]);
    const layoutDifferent = left.variants.layoutArchetype !== right.variants.layoutArchetype;
    evaluatedPairs += 1;
    rows.push({
      pair: `${index}→${index + 1}`,
      differentAxes,
      count: differentAxes.length,
      layoutDifferent,
      pass: differentAxes.length >= 2 && layoutDifferent,
      reason: null
    });
  }
  const coverageComplete = evaluatedPairs === totalPairs;
  return {
    rows,
    totalPairs,
    evaluatedPairs,
    coverageComplete,
    pass: coverageComplete && rows.every((row) => row.pass)
  };
}

function runGrammarLint(manifestFile, cwd) {
  const result = runNode(GRAMMAR_LINT, [manifestFile], cwd);
  const rules = [];
  for (const match of result.stdout.matchAll(/^\s+\[([^\]]+)\]\s+(.+)$/gm)) {
    rules.push({ rule: match[1], detail: match[2] });
  }
  const countMatch = result.stdout.match(/RESULT:\s+(\d+) violation\(s\)/);
  const violationCount = countMatch ? Number(countMatch[1]) : (result.exitCode === 0 ? 0 : null);
  return {
    ...result,
    violations: rules,
    violationCount,
    pass: result.exitCode === 0 && violationCount === 0
  };
}

function tokenSourceTopology(pageHtml, pageFile) {
  const tags = pageHtml.match(/<link\b[^>]*>/gi) || [];
  const linkRecords = [];
  for (const tag of tags) {
    const declared = getAttribute(tag, 'data-token-source');
    const href = getAttribute(tag, 'href');
    const rel = getAttribute(tag, 'rel') || '';
    const as = getAttribute(tag, 'as') || '';
    const type = getAttribute(tag, 'type') || '';
    const stylesheet = String(rel).toLowerCase().split(/\s+/).includes('stylesheet');
    const styleLike = stylesheet || String(as).toLowerCase() === 'style' || String(type).toLowerCase() === 'text/css';
    if (declared === null && !styleLike) continue;
    const sourceFile = href && !/^[a-z][a-z0-9+.-]*:/i.test(href)
      ? path.resolve(path.dirname(pageFile), href)
      : null;
    linkRecords.push({ tag, declared, href, rel, as, type, stylesheet, styleLike, sourceFile, exists: Boolean(sourceFile && fs.existsSync(sourceFile)) });
  }
  const tokenSources = linkRecords.filter((link) => link.declared !== null);
  const stylesheets = linkRecords.filter((link) => link.styleLike);
  const inlineImports = pageHtml.match(/@import\s+(?:url\s*\()?[^;]+;/gi) || [];
  const selected = tokenSources.length === 1 && stylesheets.length === 1 && tokenSources[0].tag === stylesheets[0].tag
    ? tokenSources[0]
    : null;
  return {
    tokenSources,
    stylesheets,
    inlineImports,
    selected,
    pass: Boolean(selected && selected.href === selected.declared && selected.exists && inlineImports.length === 0)
  };
}

function attributeNameForAxis(axis) {
  return `data-variant-${axis.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

function pageAssemblyEntries(pageHtml) {
  const tags = pageHtml.match(/<article\b[^>]*>/gi) || [];
  return tags
    .filter((tag) => String(getAttribute(tag, 'class') || '').split(/\s+/).includes('composition-entry'))
    .map((tag) => ({
      sectionIndex: getAttribute(tag, 'data-section-index'),
      moduleId: getAttribute(tag, 'data-module-id'),
      moduleType: getAttribute(tag, 'data-module-type'),
      variants: Object.fromEntries(VARIANT_AXES.map((axis) => [axis, getAttribute(tag, attributeNameForAxis(axis))]))
    }));
}

function checkPageAssembly(model, pageHtml) {
  const actualEntries = pageAssemblyEntries(pageHtml);
  const total = model.declaredSections;
  const rows = [];
  const max = Math.max(total, actualEntries.length);
  for (let index = 0; index < max; index += 1) {
    const section = model.sections[index] || null;
    const actual = actualEntries[index] || null;
    const expected = section && section.module && section.variants ? {
      sectionIndex: String(index + 1),
      moduleId: section.module.name,
      moduleType: section.module.type,
      variants: section.variants
    } : null;
    const differences = [];
    if (!expected) differences.push('missing valid manifest section');
    if (!actual) differences.push('missing composition-entry');
    if (expected && actual) {
      if (actual.sectionIndex !== expected.sectionIndex) differences.push(`section index ${actual.sectionIndex || 'missing'} != ${expected.sectionIndex}`);
      if (actual.moduleId !== expected.moduleId) differences.push(`module id ${actual.moduleId || 'missing'} != ${expected.moduleId}`);
      if (actual.moduleType !== expected.moduleType) differences.push(`module type ${actual.moduleType || 'missing'} != ${expected.moduleType}`);
      for (const axis of VARIANT_AXES) {
        if (actual.variants[axis] !== expected.variants[axis]) {
          differences.push(`${axis} ${actual.variants[axis] || 'missing'} != ${expected.variants[axis]}`);
        }
      }
    }
    rows.push({ index: index + 1, expected, actual, differences, pass: differences.length === 0 });
  }
  return {
    expectedEntries: total,
    actualEntries: actualEntries.length,
    matchedEntries: rows.filter((row) => row.pass).length,
    rows,
    pass: actualEntries.length === total && rows.length === total && rows.every((row) => row.pass)
  };
}

function normalizeCssValue(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function withoutComments(text) {
  return String(text)
    .replace(/<!--[\s\S]*?-->/g, (match) => ' '.repeat(match.length))
    .replace(/\/\*[\s\S]*?\*\//g, (match) => ' '.repeat(match.length));
}

function tokenDeclarationMap(css) {
  const declarations = new Map();
  for (const match of withoutComments(css).matchAll(/(--[^\s:;{}()]+)\s*:\s*([^;}]+)/g)) {
    const name = match[1];
    if (!declarations.has(name)) declarations.set(name, normalizeCssValue(match[2]));
  }
  return declarations;
}

function tokenReferences(text) {
  const refs = [];
  for (const match of withoutComments(text).matchAll(/var\(\s*(--[^,\s)]+)/g)) refs.push(match[1]);
  return refs;
}

function bridgeStyleContents(pageHtml) {
  const blocks = [];
  for (const match of String(pageHtml).matchAll(/<style\b[^>]*\bdata-token-bridge\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    blocks.push({ full: match[0], content: match[1] });
  }
  return blocks;
}

function checkTokenProvenance(pageHtml, tokenSourceFile) {
  const sourceText = readText(tokenSourceFile, 'linked token stylesheet');
  const sourceDeclarations = tokenDeclarationMap(sourceText);
  const sourceImports = sourceText.match(/@import\s+(?:url\s*\()?[^;]+;/gi) || [];
  const bridges = bridgeStyleContents(pageHtml);
  const bridgeText = bridges.map((block) => block.content).join('\n');
  let outsideBridge = pageHtml;
  for (const block of bridges) outsideBridge = outsideBridge.replace(block.full, ' '.repeat(block.full.length));
  const bridgeDeclarations = tokenDeclarationMap(bridgeText);
  const outsideDeclarations = [...tokenDeclarationMap(outsideBridge).keys()];
  const references = tokenReferences(pageHtml);
  const unknownReferences = [...new Set(references.filter((name) => !sourceDeclarations.has(name)))];
  const bridgeDrift = [];
  for (const [name, value] of bridgeDeclarations) {
    const sourceValue = sourceDeclarations.get(name);
    if (sourceValue == null) bridgeDrift.push(`${name} is not defined by the linked token source`);
    else if (sourceValue !== value) bridgeDrift.push(`${name} differs from linked token source`);
  }
  return {
    sourceDefinitions: sourceDeclarations.size,
    sourceImports,
    references: references.length,
    bridgeDeclarations: bridgeDeclarations.size,
    outsideDeclarations,
    unknownReferences,
    bridgeDrift,
    pass: sourceDeclarations.size > 0 && sourceImports.length === 0 && references.length > 0 && outsideDeclarations.length === 0 &&
      unknownReferences.length === 0 && bridgeDrift.length === 0
  };
}

function countRawLiterals(pageHtml) {
  const stripBridge = pageHtml.replace(/<style\b[^>]*\bdata-token-bridge\b[^>]*>[\s\S]*?<\/style>/gi, (match) => ' '.repeat(match.length));
  return {
    rawHex: pageHtml.match(/#[0-9a-fA-F]{3,8}\b/g) || [],
    rawPx: pageHtml.match(/\b\d+(?:\.\d+)?px\b/gi) || [],
    primitiveRefsOutsideBridge: stripBridge.match(/var\(\s*--brand-[A-Za-z0-9-]+\s*\)/g) || []
  };
}

function makeBrandProjection(brandFile, outputFile) {
  const projection = readJson(brandFile, 'brand token source');
  if (!isPlainObject(projection.color) || !isPlainObject(projection.color.primary) || !isPlainObject(projection.color.accent)) {
    fail('brand token source must expose color.primary and color.accent to resolve the generated semantic aliases');
  }
  if (!isPlainObject(projection.color.primary['700']) || !isPlainObject(projection.color.accent['500'])) {
    fail('brand token source must expose color.primary.700 and color.accent.500 for the generated semantic aliases');
  }
  if (projection.brand != null && !isPlainObject(projection.brand)) {
    fail('brand token source has a non-object top-level brand key, so alias comparison cannot be projected safely');
  }
  projection.brand = {
    ...(projection.brand || {}),
    primary: { $type: 'color', $value: '{color.primary.700}' },
    accent: { $type: 'color', $value: '{color.accent.500}' }
  };
  writeJson(outputFile, projection);
  return outputFile;
}

function inlineTokenSource(pageHtml, source) {
  const css = readText(source.sourceFile, 'linked token stylesheet');
  const inline = `<style data-token-source-inline>\n${css}\n</style>`;
  const probe = pageHtml.replace(source.tag, inline);
  if (probe === pageHtml) fail('could not inline the page token source for strict brand-lint');
  return probe;
}

function readBrandResult(result, reportPath) {
  let report = null;
  let parseError = null;
  try {
    report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch (error) {
    parseError = error.message;
  }
  return { ...result, reportPath, report, parseError };
}

function strictBrandMetrics(report) {
  const evidence = report && report.brand && typeof report.brand.evidence === 'string' ? report.brand.evidence : '';
  const match = evidence.match(/(\d+)\/(\d+) declared colors within ΔE\s*([0-9.]+)/u);
  const coverage = evidence.match(/COVERAGE:\s*(\d+) declared color\(s\).*coverage\s*(\d+)%/u);
  const violations = Array.isArray(report && report.violations) ? report.violations : [];
  return {
    evidence,
    onBrand: Boolean(report && report.brand && report.brand.onBrand),
    pass: Boolean(report && report.pass),
    errorCount: Number.isInteger(report && report.errorCount) ? report.errorCount : null,
    checkedPass: match ? Number(match[1]) : null,
    checkedTotal: match ? Number(match[2]) : null,
    deltaThreshold: match ? Number(match[3]) : null,
    unmatched: coverage ? Number(coverage[1]) : null,
    coveragePercent: coverage ? Number(coverage[2]) : null,
    offBrandCount: violations.filter((violation) => violation && violation.rule === 'off-brand-color').length
  };
}

function runConsistencyChecks(model, pageFile, workdir, brandFile) {
  const pageHtml = readText(pageFile, 'assembled page');
  const assembly = checkPageAssembly(model, pageHtml);
  const rootTag = pageHtml.match(/<html\b[^>]*>/i);
  const rootTokenSet = rootTag ? getAttribute(rootTag[0], 'data-token-set') : null;
  const allTokenSets = getAllAttributeValues(pageHtml, 'data-token-set');
  const expectedTokenSet = model.core && typeof model.core.tokenSet === 'string' ? model.core.tokenSet : null;
  const topology = tokenSourceTopology(pageHtml, pageFile);
  const literals = countRawLiterals(pageHtml);
  const tokenSetPass = Boolean(expectedTokenSet) && rootTokenSet === expectedTokenSet && allTokenSets.length === 1;
  const sourcePass = topology.pass;
  const provenance = sourcePass
    ? checkTokenProvenance(pageHtml, topology.selected.sourceFile)
    : {
      sourceDefinitions: 0,
      sourceImports: [],
      references: 0,
      bridgeDeclarations: 0,
      outsideDeclarations: [],
      unknownReferences: [],
      bridgeDrift: ['linked token source was not singular and readable'],
      pass: false
    };

  const pageBrandPath = path.join(workdir, '.g4.3-page-brand-lint.json');
  const pageBrandRun = runNode(BRAND_LINT, [pageFile, pageBrandPath, '--brand', brandFile], workdir);
  const pageBrand = readBrandResult(pageBrandRun, pageBrandPath);
  const pageBrandPass = pageBrand.exitCode === 0 && pageBrand.report && pageBrand.report.pass === true &&
    pageBrand.report.errorCount === 0 && pageBrand.report.brand && pageBrand.report.brand.onBrand === true;

  let strictBrand = {
    exitCode: 1,
    report: null,
    parseError: 'linked token source was not singular and readable',
    reportPath: null
  };
  let strictMetrics = strictBrandMetrics(null);
  if (sourcePass) {
    const projectionPath = path.join(workdir, '.g4.3-brand-alias-projection.json');
    const probePath = path.join(workdir, '.g4.3-linked-token-probe.html');
    makeBrandProjection(brandFile, projectionPath);
    fs.writeFileSync(probePath, inlineTokenSource(pageHtml, topology.selected));
    const strictBrandPath = path.join(workdir, '.g4.3-linked-token-brand-lint.json');
    const strictRun = runNode(
      BRAND_LINT,
      [probePath, strictBrandPath, '--brand', projectionPath],
      workdir,
      { BRAND_LINT_DELTAE: '0' }
    );
    strictBrand = readBrandResult(strictRun, strictBrandPath);
    strictBrand.projectionPath = projectionPath;
    strictBrand.probePath = probePath;
    strictMetrics = strictBrandMetrics(strictBrand.report);
  }
  const strictBrandPass = strictBrand.exitCode === 0 && strictBrand.report && strictBrand.report.pass === true &&
    strictMetrics.onBrand && strictMetrics.errorCount === 0 && strictMetrics.checkedTotal > 0 &&
    strictMetrics.checkedPass === strictMetrics.checkedTotal && strictMetrics.deltaThreshold === 0 &&
    strictMetrics.unmatched === 0 && strictMetrics.coveragePercent === 100 && strictMetrics.offBrandCount === 0;

  const rawPass = literals.rawHex.length === 0 && literals.rawPx.length === 0;
  const primitivePass = literals.primitiveRefsOutsideBridge.length === 0;
  return {
    pass: assembly.pass && tokenSetPass && sourcePass && provenance.pass && rawPass && primitivePass && pageBrandPass && strictBrandPass,
    assembly,
    expectedTokenSet,
    rootTokenSet,
    allTokenSets,
    tokenSetPass,
    tokenSources: topology.tokenSources,
    stylesheetLinks: topology.stylesheets,
    inlineImports: topology.inlineImports,
    sourcePass,
    provenance,
    literals,
    rawPass,
    primitivePass,
    brand: {
      page: pageBrand,
      pagePass: pageBrandPass,
      strict: strictBrand,
      strictMetrics,
      strictPass: strictBrandPass
    }
  };
}

function buildProof(manifestFile, pageFile, workdir, brandFile) {
  const model = inspectManifest(manifestFile);
  const diversity = collectDiversity(model);
  const grammar = runGrammarLint(manifestFile, workdir);
  const consistency = runConsistencyChecks(model, pageFile, workdir, brandFile);
  const diversityPass = diversity.pass && grammar.pass && grammar.violationCount === 0 && model.resolvedSections === model.declaredSections && consistency.assembly.pass;
  const pass = diversityPass && consistency.pass;
  return {
    schemaVersion: 'g4.3.0',
    manifest: displayPath(manifestFile),
    page: displayPath(pageFile),
    workdir: displayPath(workdir),
    diversity: {
      pass: diversityPass,
      sectionCoverage: { checked: model.resolvedSections, total: model.declaredSections },
      adjacentCoverage: { checked: diversity.evaluatedPairs, total: diversity.totalPairs },
      rows: diversity.rows,
      assembly: consistency.assembly,
      manifestErrors: model.errors,
      grammar
    },
    consistency,
    verdict: pass ? 'PASS' : 'FAIL',
    exitCode: pass ? 0 : 1
  };
}

function state(value) {
  return value ? 'PASS' : 'FAIL';
}

function displayCount(count) {
  return count == null ? 'n/a' : String(count);
}

function formatProof(proof) {
  const lines = [];
  lines.push('G4.3 DIVERSITY + CONSISTENCY REPORT');
  lines.push(`manifest: ${proof.manifest}`);
  lines.push(`page: ${proof.page}`);
  lines.push('');
  lines.push('DIVERSITY FLOOR');
  lines.push('adjacent pair | different axes | layout | result');
  for (const row of proof.diversity.rows) {
    const axes = row.count == null ? 'n/a' : `${row.count}/5 [${row.differentAxes.join(', ') || 'none'}]`;
    const layout = row.layoutDifferent == null ? 'n/a' : row.layoutDifferent ? 'different' : 'same';
    lines.push(`${row.pair.padEnd(13)} | ${axes.padEnd(56)} | ${layout.padEnd(9)} | ${state(row.pass)}`);
  }
  lines.push(`grammar-lint coverage: sections ${proof.diversity.sectionCoverage.checked}/${proof.diversity.sectionCoverage.total}; adjacent pairs ${proof.diversity.adjacentCoverage.checked}/${proof.diversity.adjacentCoverage.total}`);
  lines.push(`grammar-lint: ${state(proof.diversity.grammar.pass)} (exit ${proof.diversity.grammar.exitCode}; violations ${displayCount(proof.diversity.grammar.violationCount)})`);
  lines.push(`assembled-page binding: ${proof.diversity.assembly.matchedEntries}/${proof.diversity.assembly.expectedEntries} exact entries → ${state(proof.diversity.assembly.pass)}`);
  for (const row of proof.diversity.assembly.rows.filter((row) => !row.pass)) {
    lines.push(`  [assembly section ${row.index}] ${row.differences.join('; ')}`);
  }
  for (const violation of proof.diversity.grammar.violations) lines.push(`  [${violation.rule}] ${violation.detail}`);
  for (const error of proof.diversity.manifestErrors) lines.push(`  [manifest] ${error}`);
  lines.push(`diversity floor: ${state(proof.diversity.pass)}`);
  lines.push('');
  lines.push('CONSISTENCY CEILING');
  lines.push('check | measured | result');
  const consistency = proof.consistency;
  lines.push(`single token set | core=${consistency.expectedTokenSet || 'missing'}; page=${consistency.rootTokenSet || 'missing'}; declarations=${consistency.allTokenSets.length} | ${state(consistency.tokenSetPass)}`);
  const sources = consistency.tokenSources.map((source) => source.href || 'missing').join(', ') || 'none';
  lines.push(`token source | marked=${consistency.tokenSources.length}; stylesheets=${consistency.stylesheetLinks.length}; imports=${consistency.inlineImports.length}; ${sources} | ${state(consistency.sourcePass)}`);
  lines.push(`token provenance | refs=${consistency.provenance.references}; source-defined=${consistency.provenance.sourceDefinitions}; source imports=${consistency.provenance.sourceImports.length}; bridge=${consistency.provenance.bridgeDeclarations}; outside declarations=${consistency.provenance.outsideDeclarations.length}; unknown refs=${consistency.provenance.unknownReferences.length}; bridge drift=${consistency.provenance.bridgeDrift.length} | ${state(consistency.provenance.pass)}`);
  lines.push(`raw literals | hex=${consistency.literals.rawHex.length}; px=${consistency.literals.rawPx.length} | ${state(consistency.rawPass)}`);
  lines.push(`primitive refs | --brand outside token bridge=${consistency.literals.primitiveRefsOutsideBridge.length} | ${state(consistency.primitivePass)}`);
  const pageBrand = consistency.brand.page;
  lines.push(`brand-lint page | exit=${pageBrand.exitCode}; pass=${Boolean(pageBrand.report && pageBrand.report.pass)}; errors=${pageBrand.report ? pageBrand.report.errorCount : 'n/a'} | ${state(consistency.brand.pagePass)}`);
  const strict = consistency.brand.strictMetrics;
  lines.push(`brand-lint linked token ΔE=0 | ${strict.checkedPass == null ? 'n/a' : `${strict.checkedPass}/${strict.checkedTotal}`}; unmatched=${displayCount(strict.unmatched)}; off-brand=${strict.offBrandCount}; coverage=${displayCount(strict.coveragePercent)}% | ${state(consistency.brand.strictPass)}`);
  lines.push(`consistency ceiling: ${state(consistency.pass)}`);
  lines.push('');
  lines.push(`VERDICT: ${proof.verdict} (diversity floor AND consistency ceiling; exit ${proof.exitCode})`);
  return lines.join('\n');
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
  const proof = buildProof(manifestFile, pageFile, workdir, brandFile);
  if (flags.out) writeJson(path.resolve(flags.out), proof);
  process.stdout.write(`${formatProof(proof)}\n`);
  return proof.exitCode;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  REPO_ROOT,
  V3_ROOT,
  COMPOSER_ROOT,
  VARIANT_AXES,
  DEFAULT_BRAND,
  assertComposerRunDirectory,
  inspectManifest,
  collectDiversity,
  checkPageAssembly,
  checkTokenProvenance,
  tokenSourceTopology,
  runGrammarLint,
  runConsistencyChecks,
  buildProof,
  formatProof,
  runNode,
  displayPath
};
