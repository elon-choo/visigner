#!/usr/bin/env node
'use strict';

/*
 * G5.1 — single-source token build (staging only).
 *
 * Two layers come out of this script, both into v3/site-build/:
 *
 *   1. tokens-module.css  — the load chain for v3 section modules.
 *      Compiled from the canonical DTCG source
 *      (skills/detail-page/tokens/brand-default.tokens.json) by invoking the
 *      SHIPPED compiler read-only, plus the v3 measure layer
 *      (v3/tokens/measure.css, which is where --prose-max-width lives).
 *      A page that links this one file resolves every token a module template
 *      references, including --prose-max-width. Without it, the hero
 *      max-inline-size falls back to `none` (unbounded) — see the G5.1
 *      render-check evidence.
 *
 *   2. tokens-landing.css / tokens-manual.css — the site layer, compiled from
 *      v3/tokens/site.tokens.json (one source for the three docs/ pages, which
 *      today hand-declare their tokens 2x per page and 2x across files).
 *
 * It also writes drift-report.json / drift-report.md comparing every compiled
 * token value against what the shipped files actually declare today.
 *
 * Nothing shipped is written. Output is staging only.
 *
 * Usage:
 *   node v3/scripts/build-tokens.js            # build + report (exit 1 on module-layer drift)
 *   node v3/scripts/build-tokens.js --check    # report only, no files written
 */

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SITE_TOKENS = path.join(ROOT, 'v3', 'tokens', 'site.tokens.json');
const MEASURE_CSS = path.join(ROOT, 'v3', 'tokens', 'measure.css');
const BRAND_TOKENS = path.join(ROOT, 'skills', 'detail-page', 'tokens', 'brand-default.tokens.json');
const SHIPPED_COMPILER = path.join(ROOT, 'skills', 'detail-page', 'scripts', 'build-tokens.js');
const CANONICAL_THEME = path.join(ROOT, 'skills', 'detail-page', 'examples', 'vite-tailwind', 'src', 'theme.generated.css');
const OUT_DIR = path.join(ROOT, 'v3', 'site-build');
const DOCS_DIR = path.join(ROOT, 'docs');

const CHECK_ONLY = process.argv.includes('--check');

function fail(message) {
  console.error(`build-tokens: ${message}`);
  process.exit(2);
}

function rel(p) {
  return path.relative(ROOT, p);
}

/* ---------- CSS block parsing (shared by the compiler and the drift check) ---------- */

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function parseDeclarations(body) {
  const decls = {};
  for (const match of body.matchAll(/(--[A-Za-z0-9-]+)\s*:\s*([^;]+);/g)) {
    decls[match[1]] = match[2].replace(/\s+/g, ' ').trim();
  }
  return decls;
}

// Collect every top-level `@theme {` / `:root {` block plus the @media context it sits in.
function collectBlocks(css) {
  const source = stripComments(css);
  const blocks = [];
  const matcher = /(@theme|:root)\s*\{/g;
  let match;
  while ((match = matcher.exec(source)) !== null) {
    let depth = 1;
    let index = matcher.lastIndex;
    while (index < source.length && depth > 0) {
      if (source[index] === '{') depth += 1;
      else if (source[index] === '}') depth -= 1;
      index += 1;
    }
    const body = source.slice(matcher.lastIndex, index - 1);
    const before = source.slice(0, match.index);
    let context = 'top-level';
    const lastMedia = before.lastIndexOf('@media');
    if (lastMedia !== -1) {
      let depthAtMatch = 0;
      let opened = false;
      for (let i = lastMedia; i < match.index; i += 1) {
        if (source[i] === '{') { depthAtMatch += 1; opened = true; }
        else if (source[i] === '}') depthAtMatch -= 1;
      }
      if (opened && depthAtMatch > 0) context = before.slice(lastMedia, before.indexOf('{', lastMedia)).trim();
    }
    blocks.push({ selector: match[1], context, decls: parseDeclarations(body) });
  }
  return blocks;
}

/* ---------- source loading ---------- */

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return fail(`cannot read ${rel(file)}: ${error.message}`);
  }
}

// Flatten a DTCG set into ordered [cssVar, cssLiteral] pairs using the explicit
// com.visigner.cssVar mapping (so compiled names match the pages exactly).
function flattenSet(set, setName) {
  const pairs = [];
  for (const [group, members] of Object.entries(set)) {
    for (const [name, token] of Object.entries(members)) {
      const ext = token.$extensions && token.$extensions['com.visigner'];
      if (!ext || !ext.cssVar) fail(`${setName}.${group}.${name} has no $extensions["com.visigner"].cssVar`);
      const css = ext.css !== undefined ? ext.css : token.$value;
      if (typeof css !== 'string') fail(`${setName}.${group}.${name} has no literal CSS value`);
      pairs.push([ext.cssVar, css]);
    }
  }
  return pairs;
}

function declBlock(pairs, indent = '  ') {
  return pairs.map(([name, value]) => `${indent}${name}: ${value};`).join('\n');
}

/* ---------- layer 1: module tokens (brand DTCG + measure) ---------- */

function runShippedCompiler(args) {
  const result = childProcess.spawnSync(process.execPath, [SHIPPED_COMPILER, ...args], {
    cwd: path.join(ROOT, 'skills', 'detail-page'),
    encoding: 'utf8',
  });
  if (result.status !== 0) fail(`shipped build-tokens.js ${args.join(' ')} exited ${result.status}: ${result.stderr}`);
  return result.stdout;
}

function buildModuleLayer() {
  const brandRel = path.relative(path.join(ROOT, 'skills', 'detail-page'), BRAND_TOKENS);
  const rootCss = runShippedCompiler([brandRel]);
  const themeCss = runShippedCompiler([brandRel, '--emit=theme']);

  const rootDecls = collectBlocks(rootCss).find((b) => b.selector === ':root');
  const themeDecls = collectBlocks(themeCss).find((b) => b.selector === '@theme');
  if (!rootDecls) fail('shipped compiler produced no :root block');
  if (!themeDecls) fail('shipped compiler produced no @theme block');

  // The browser-native semantic layer is the @theme mapping minus the scale tokens,
  // which the :root layer already emits literally.
  const semantic = Object.entries(themeDecls.decls).filter(([, value]) => /^var\(/.test(value));

  const measureBlocks = collectBlocks(fs.readFileSync(MEASURE_CSS, 'utf8'));
  const measure = measureBlocks.find((b) => b.selector === ':root');
  if (!measure || !Object.keys(measure.decls).length) fail(`${rel(MEASURE_CSS)} declares no :root tokens`);

  const css = [
    '/* v3/site-build/tokens-module.css — GENERATED by v3/scripts/build-tokens.js. Do not hand-edit.',
    ` * primitives + scale: compiled from ${rel(BRAND_TOKENS)} via ${rel(SHIPPED_COMPILER)}`,
    ` * measure:            compiled from ${rel(MEASURE_CSS)}`,
    ' *',
    ' * A host page that links this file resolves every token a v3 module template',
    ' * references. --prose-max-width is part of this layer: a page that omits it',
    ' * renders hero copy with max-inline-size:none (unbounded line length).',
    ' */',
    ':root {',
    declBlock(Object.entries(rootDecls.decls)),
    '',
    '  /* semantic bridge (browser-native form of the Tailwind @theme mapping) */',
    declBlock(semantic),
    '',
    '  /* measure layer */',
    declBlock(Object.entries(measure.decls)),
    '}',
    '',
  ].join('\n');

  return { css, rootDecls: rootDecls.decls, semantic: Object.fromEntries(semantic), measure: measure.decls };
}

/* ---------- layer 2: site tokens ---------- */

function buildSiteLayers(source) {
  const landing = flattenSet(source.landing, 'landing');
  const manual = flattenSet(source.manual, 'manual');
  const manualDark = flattenSet(source['manual-dark'], 'manual-dark');

  const landingCss = [
    '/* v3/site-build/tokens-landing.css — GENERATED by v3/scripts/build-tokens.js from v3/tokens/site.tokens.json.',
    ' * Do not hand-edit. Replaces the hand-duplicated @theme + :root pair in docs/index.html:',
    ' * both blocks are emitted from ONE source, so they cannot drift apart by hand.',
    ' */',
    '@theme{',
    declBlock(landing),
    '}',
    ':root{',
    declBlock(landing),
    '}',
    '',
  ].join('\n');

  const manualCss = [
    '/* v3/site-build/tokens-manual.css — GENERATED by v3/scripts/build-tokens.js from v3/tokens/site.tokens.json.',
    ' * Do not hand-edit. One source for docs/guide.html and docs/how-to.html, which today',
    ' * carry byte-identical copies of these declarations in two separate files.',
    ' * --maxw is emitted once at its effective cascade value (the shipped pages declare it',
    ' * twice in the same file: 940px, then 1180px later in the sheet).',
    ' */',
    ':root{',
    declBlock(manual),
    '}',
    '@media (prefers-color-scheme: dark){',
    '  :root{',
    declBlock(manualDark, '    '),
    '  }',
    '}',
    '',
  ].join('\n');

  return {
    landingCss,
    manualCss,
    landing: Object.fromEntries(landing),
    manual: Object.fromEntries(manual),
    manualDark: Object.fromEntries(manualDark),
  };
}

/* ---------- drift comparison ---------- */

function diffMaps(compiled, declared) {
  const keys = [...new Set([...Object.keys(compiled), ...Object.keys(declared)])].sort();
  const items = [];
  for (const key of keys) {
    if (compiled[key] !== declared[key]) {
      items.push({ token: key, compiled: compiled[key] ?? '(missing)', declared: declared[key] ?? '(missing)' });
    }
  }
  return { compared: keys.length, drift: items };
}

function moduleDrift(moduleLayer) {
  const canonical = collectBlocks(fs.readFileSync(CANONICAL_THEME, 'utf8'));
  const canonicalRoot = canonical.find((b) => b.selector === ':root');
  const canonicalTheme = canonical.find((b) => b.selector === '@theme');
  if (!canonicalRoot || !canonicalTheme) fail(`${rel(CANONICAL_THEME)} is missing a :root or @theme block`);
  const canonicalSemantic = Object.fromEntries(
    Object.entries(canonicalTheme.decls).filter(([, value]) => /^var\(/.test(value))
  );
  return {
    primitives: diffMaps(moduleLayer.rootDecls, canonicalRoot.decls),
    semantic: diffMaps(moduleLayer.semantic, canonicalSemantic),
  };
}

function siteDrift(site) {
  const readPage = (name) => collectBlocks(fs.readFileSync(path.join(DOCS_DIR, name), 'utf8'));

  const index = readPage('index.html');
  const indexTheme = index.find((b) => b.selector === '@theme');
  const indexRoot = index.find((b) => b.selector === ':root');

  const flattenPage = (blocks, context) => {
    const merged = {};
    for (const block of blocks) {
      if (block.context !== context) continue;
      Object.assign(merged, block.decls); // later declarations win, mirroring the cascade
    }
    return merged;
  };

  const guide = readPage('guide.html');
  const howTo = readPage('how-to.html');

  return {
    'docs/index.html @theme': diffMaps(site.landing, indexTheme ? indexTheme.decls : {}),
    'docs/index.html :root': diffMaps(site.landing, indexRoot ? indexRoot.decls : {}),
    'docs/guide.html :root (effective)': diffMaps(site.manual, flattenPage(guide, 'top-level')),
    'docs/guide.html :root (dark)': diffMaps(site.manualDark, flattenPage(guide, '@media (prefers-color-scheme: dark)')),
    'docs/how-to.html :root (effective)': diffMaps(site.manual, flattenPage(howTo, 'top-level')),
    'docs/how-to.html :root (dark)': diffMaps(site.manualDark, flattenPage(howTo, '@media (prefers-color-scheme: dark)')),
  };
}

/* ---------- report ---------- */

function renderReport(report) {
  const lines = [];
  lines.push('# G5.1 token drift report');
  lines.push('');
  lines.push(`Generated by \`node v3/scripts/build-tokens.js\` on ${report.generatedAt}.`);
  lines.push('');
  lines.push('Compiled token values vs. what the shipped files declare today. No shipped file is modified.');
  lines.push('');
  lines.push('## Module layer (hard gate — must be 0)');
  lines.push('');
  lines.push('`v3/site-build/tokens-module.css` vs `skills/detail-page/examples/vite-tailwind/src/theme.generated.css`.');
  lines.push('');
  lines.push('| layer | tokens compared | drift |');
  lines.push('| --- | ---: | ---: |');
  for (const [name, result] of Object.entries(report.moduleLayer)) {
    lines.push(`| ${name} | ${result.compared} | ${result.drift.length} |`);
  }
  for (const [name, result] of Object.entries(report.moduleLayer)) {
    for (const item of result.drift) {
      lines.push(`- \`${name}\` \`${item.token}\`: compiled \`${item.compiled}\` vs canonical \`${item.declared}\``);
    }
  }
  lines.push('');
  lines.push(`Additive (present in the compiled layer, absent from the canonical theme): ${report.additive.join(', ') || '(none)'}.`);
  lines.push('');
  lines.push('## Site layer (informational — the S5 landing-replacement argument)');
  lines.push('');
  lines.push('`v3/site-build/tokens-landing.css` and `tokens-manual.css` vs the three shipped pages.');
  lines.push('');
  lines.push('| shipped block | tokens compared | drift |');
  lines.push('| --- | ---: | ---: |');
  for (const [name, result] of Object.entries(report.siteLayer)) {
    lines.push(`| ${name} | ${result.compared} | ${result.drift.length} |`);
  }
  const siteDriftItems = Object.entries(report.siteLayer).flatMap(([name, result]) =>
    result.drift.map((item) => `- \`${name}\` \`${item.token}\`: compiled \`${item.compiled}\` vs declared \`${item.declared}\``)
  );
  if (siteDriftItems.length) {
    lines.push('');
    lines.push(...siteDriftItems);
  }
  lines.push('');
  lines.push('## Structural findings (measured, not inferred)');
  lines.push('');
  for (const finding of report.findings) lines.push(`- ${finding}`);
  lines.push('');
  return lines.join('\n');
}

/* ---------- main ---------- */

function main() {
  const source = readJson(SITE_TOKENS);
  const moduleLayer = buildModuleLayer();
  const site = buildSiteLayers(source);

  const moduleLayerDrift = moduleDrift(moduleLayer);
  const siteLayerDrift = siteDrift(site);

  const canonicalBlocks = collectBlocks(fs.readFileSync(CANONICAL_THEME, 'utf8'));
  const canonicalNames = new Set(canonicalBlocks.flatMap((b) => Object.keys(b.decls)));
  const additive = Object.keys(moduleLayer.measure).filter((name) => !canonicalNames.has(name));

  const index = collectBlocks(fs.readFileSync(path.join(DOCS_DIR, 'index.html'), 'utf8'));
  const guide = collectBlocks(fs.readFileSync(path.join(DOCS_DIR, 'guide.html'), 'utf8'));
  const howTo = collectBlocks(fs.readFileSync(path.join(DOCS_DIR, 'how-to.html'), 'utf8'));
  const indexTheme = index.find((b) => b.selector === '@theme');
  const indexRoot = index.find((b) => b.selector === ':root');
  const themeVsRoot = diffMaps(indexTheme.decls, indexRoot.decls);
  const guideLight = guide.find((b) => b.context === 'top-level');
  const howToLight = howTo.find((b) => b.context === 'top-level');
  const guideVsHowTo = diffMaps(guideLight.decls, howToLight.decls);
  const landingNames = new Set(Object.keys(indexTheme.decls));
  const manualNames = new Set(guide.flatMap((b) => Object.keys(b.decls)));
  const sharedNames = [...landingNames].filter((name) => manualNames.has(name));
  const collidingNames = sharedNames.filter((name) => {
    const manualValue = guide.map((b) => b.decls[name]).find(Boolean);
    return indexTheme.decls[name] !== manualValue;
  });
  const maxwDecls = guide.filter((b) => b.decls['--maxw'] !== undefined).map((b) => b.decls['--maxw']);

  const findings = [
    `docs/index.html declares its token block twice (\`@theme\` ${Object.keys(indexTheme.decls).length} tokens + \`:root\` ${Object.keys(indexRoot.decls).length} tokens); value drift between the two copies is ${themeVsRoot.drift.length}. The duplication is the hand-edit hazard, not the values.`,
    `docs/guide.html and docs/how-to.html carry the same declarations in two files; value drift between them is ${guideVsHowTo.drift.length} across ${guideVsHowTo.compared} tokens.`,
    `The landing and manual vocabularies are disjoint apart from ${sharedNames.length} shared name(s) — ${sharedNames.map((n) => `\`${n}\``).join(', ') || '(none)'} — of which ${collidingNames.length} carry different values in the two designs (a name collision, not a shared token).`,
    `\`--maxw\` is declared ${maxwDecls.length}x in the same sheet (${maxwDecls.join(' then ')}); the compiled source keeps only the effective cascade value.`,
    `The module layer adds ${additive.length} token(s) the canonical theme does not carry: ${additive.map((n) => `\`${n}\``).join(', ') || '(none)'}. Hero templates reference \`--prose-max-width\`, so a host page must link \`v3/site-build/tokens-module.css\` (or otherwise provide the measure layer) or the hero copy width falls back to \`none\`.`,
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    moduleLayer: moduleLayerDrift,
    siteLayer: siteLayerDrift,
    additive,
    findings,
  };

  if (!CHECK_ONLY) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'tokens-module.css'), moduleLayer.css);
    fs.writeFileSync(path.join(OUT_DIR, 'tokens-landing.css'), site.landingCss);
    fs.writeFileSync(path.join(OUT_DIR, 'tokens-manual.css'), site.manualCss);
    fs.writeFileSync(path.join(OUT_DIR, 'drift-report.json'), `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(path.join(OUT_DIR, 'drift-report.md'), renderReport(report));
  }

  const moduleDriftCount = Object.values(moduleLayerDrift).reduce((n, r) => n + r.drift.length, 0);
  const siteDriftCount = Object.values(siteLayerDrift).reduce((n, r) => n + r.drift.length, 0);

  console.log(`module layer: ${Object.values(moduleLayerDrift).reduce((n, r) => n + r.compared, 0)} tokens compared, ${moduleDriftCount} drift (gate: must be 0)`);
  console.log(`site layer:   ${Object.values(siteLayerDrift).reduce((n, r) => n + r.compared, 0)} tokens compared, ${siteDriftCount} drift`);
  console.log(`additive module tokens: ${additive.join(', ') || '(none)'}`);
  if (!CHECK_ONLY) console.log(`wrote ${rel(OUT_DIR)}/: tokens-module.css, tokens-landing.css, tokens-manual.css, drift-report.json, drift-report.md`);

  if (moduleDriftCount > 0) {
    console.error('FAIL: module layer drifted from the canonical theme');
    process.exit(1);
  }
  console.log('OK');
}

main();
