#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const V3_ROOT = path.resolve(__dirname, '..');
const MOCK_PAGE_ROOT = path.join(V3_ROOT, 'mock-page');
const MODULES_ROOT = path.join(V3_ROOT, 'modules');
const TOKEN_SOURCE = '../../skills/detail-page/examples/vite-tailwind/src/theme.generated.css';
const VARIANT_AXES = ['layoutArchetype', 'density', 'backgroundBleed', 'motion', 'artDirection'];

function fail(message) {
  throw new Error(`assemble-page: ${message}`);
}

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`cannot read ${label}: ${filePath} (${error.message})`);
  }
}

function readText(filePath, label) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    fail(`cannot read ${label}: ${filePath} (${error.message})`);
  }
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function dataValue(value) {
  return escapeHtml(String(value == null ? '' : value));
}

function resolveModule(compositionFile, moduleRef) {
  const resolved = path.resolve(path.dirname(compositionFile), moduleRef);
  const moduleFile = path.basename(resolved) === 'module.json'
    ? resolved
    : path.join(resolved, 'module.json');
  if (!isWithin(MODULES_ROOT, moduleFile)) {
    fail(`module is outside the catalog: ${moduleRef}`);
  }
  const module = readJson(moduleFile, 'module metadata');
  const templateFile = path.join(path.dirname(moduleFile), 'template.html');
  const template = readText(templateFile, 'module template').trim();
  if (!module.name || !module.type || !module.corpusSource) {
    fail(`module metadata is incomplete: ${moduleFile}`);
  }
  return { module, moduleFile, template };
}

function resolveVariants(entry, module) {
  const variants = entry.variants || module.variants;
  if (!variants || typeof variants !== 'object') {
    fail(`missing variants for module ${module.name}`);
  }
  for (const axis of VARIANT_AXES) {
    if (typeof variants[axis] !== 'string' || variants[axis] === '') {
      fail(`missing ${axis} for module ${module.name}`);
    }
  }
  return variants;
}

function renderProvenance(module) {
  const source = module.corpusSource;
  const provenance = module.provenance || module.variantProvenance || 'missing';
  return [
    '    <footer class="ledger-footnote" data-ledger-footnote>',
    `      <span>Module id: ${escapeHtml(module.name)}; provenance: ${escapeHtml(provenance)}; record: ${escapeHtml(source.recordId)}; span: ${escapeHtml(source.sectionSpan)}</span>`,
    '    </footer>'
  ].join('\n');
}

function renderSection(entry, index, compositionFile) {
  const { module, template } = resolveModule(compositionFile, entry.module);
  const variants = resolveVariants(entry, module);
  const attributes = [
    ['data-module-id', module.name],
    ['data-module-type', module.type],
    ['data-section-index', index + 1],
    ...VARIANT_AXES.map((axis) => [`data-variant-${axis.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, variants[axis]])
  ].map(([name, value]) => `${name}="${dataValue(value)}"`).join(' ');

  return [
    `  <article class="composition-entry" ${attributes}>`,
    template.split('\n').map((line) => `    ${line}`).join('\n'),
    renderProvenance(module),
    '  </article>'
  ].join('\n');
}

function renderDocument(composition, sections) {
  const title = 'Neutral catalog assembly';
  return `<!doctype html>
<html lang="en" data-composition-version="${escapeHtml(composition.compositionVersion)}" data-token-set="${escapeHtml(composition.core.tokenSet)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="A deterministic neutral page assembled from the Visigner v3 module catalog.">
  <title>${title}</title>
  <link rel="stylesheet" href="${TOKEN_SOURCE}" data-token-source="${TOKEN_SOURCE}">
  <style data-token-bridge>
    :root {
      --color-surface: var(--brand-surface);
      --color-card: var(--brand-card);
      --color-ink: var(--brand-ink);
      --color-muted: var(--brand-muted);
      --color-line: var(--brand-line);
      --color-primary-50: var(--brand-primary-50);
      --color-primary-100: var(--brand-primary-100);
      --color-primary-300: var(--brand-primary-300);
      --color-primary-500: var(--brand-primary-500);
      --color-primary-700: var(--brand-primary-700);
      --color-primary-900: var(--brand-primary-900);
      --color-primary: var(--brand-primary);
      --color-accent-300: var(--brand-accent-300);
      --color-accent-500: var(--brand-accent-500);
      --color-accent-700: var(--brand-accent-700);
      --color-accent: var(--brand-accent);
      --color-on-accent: var(--brand-on-accent);
      --font-display: var(--brand-font-display);
      --font-body: var(--brand-font-body);
      --font-latin: var(--brand-font-latin);
      --shadow-e1: var(--brand-shadow-e1);
      --shadow-e2: var(--brand-shadow-e2);
      --shadow-e3: var(--brand-shadow-e3);
    }
  </style>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html { background: var(--color-surface); }
    body { margin: 0; background: var(--color-surface); color: var(--color-ink); font-family: var(--font-body); font-size: var(--text-16); line-height: var(--leading-16); }
    a { color: inherit; }
    .composition-entry { display: grid; min-inline-size: 0; }
    .ledger-footnote { margin: 0; padding: var(--space-12) var(--space-24); border-block-start: var(--space-4) solid var(--color-line); background: var(--color-card); color: var(--color-muted); font-family: var(--font-body); font-size: var(--text-16); line-height: var(--leading-16); overflow-wrap: anywhere; }
    @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
  </style>
</head>
<body>
  <main aria-label="Neutral catalog assembly">
${sections}
  </main>
</body>
</html>
`;
}

function main() {
  const compositionFile = path.resolve(process.argv[2] || path.join(MOCK_PAGE_ROOT, 'composition.json'));
  const outputFile = path.resolve(process.argv[3] || path.join(MOCK_PAGE_ROOT, 'index.html'));
  if (!isWithin(MOCK_PAGE_ROOT, compositionFile) || !isWithin(MOCK_PAGE_ROOT, outputFile)) {
    fail('composition and output must stay inside v3/mock-page');
  }

  const composition = readJson(compositionFile, 'composition');
  if (!composition || !Array.isArray(composition.sections) || composition.sections.length === 0 || !composition.core) {
    fail('composition must provide core and a non-empty sections array');
  }

  const sections = composition.sections
    .map((entry, index) => renderSection(entry, index, compositionFile))
    .join('\n');
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, renderDocument(composition, sections));
  process.stdout.write(`assembled ${composition.sections.length} section(s): ${path.relative(process.cwd(), outputFile) || outputFile}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
