#!/usr/bin/env node
'use strict';

/*
 * Render-oriented preflight for v3 section modules.
 *
 * A v3 module is intentionally neutral and therefore is not a pixel
 * reproduction of a branded capture.  The established detail-page
 * reproduce-and-score.js compares branded reference tiles and is not a valid
 * score for these generic modules.  This wrapper instead proves that every
 * supplied template renders in a semantic-token host, while preserving the
 * normal section validator and a stricter token-reference audit.
 *
 * Usage:
 *   node v3/scripts/module-reproduce.js v3/modules/hero/centered-signal-hero
 */

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const VALIDATOR = path.join(ROOT, 'v3', 'scripts', 'section-validate.js');
const SHOOT = path.join(ROOT, 'skills', 'detail-page', 'scripts', 'shoot.js');
const THEME = path.join(ROOT, 'skills', 'detail-page', 'examples', 'vite-tailwind', 'src', 'theme.generated.css');

function fail(message) {
  throw new Error(`module-reproduce: ${message}`);
}

function usage() {
  return 'usage: node v3/scripts/module-reproduce.js <moduleDir>... [--keep]\n';
}

function parseArgs(argv) {
  const moduleDirs = [];
  let keep = false;
  for (const argument of argv) {
    if (argument === '--keep') keep = true;
    else if (argument === '--help' || argument === '-h') return { help: true, keep, moduleDirs };
    else if (argument.startsWith('-')) fail(`unknown argument ${argument}`);
    else moduleDirs.push(path.resolve(ROOT, argument));
  }
  if (!moduleDirs.length) fail('at least one module directory is required');
  return { keep, moduleDirs };
}

function run(command, args, label, env) {
  const result = childProcess.spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...env }
  });
  if (result.error) fail(`${label} could not start: ${result.error.message}`);
  return result;
}

function semanticTokenNames(theme) {
  const match = theme.match(/@theme\s*\{([\s\S]*?)\n\}/u);
  if (!match) fail('canonical theme has no @theme block');
  return new Set([...match[1].matchAll(/^\s*(--[A-Za-z0-9-]+)\s*:/gmu)].map((entry) => entry[1]));
}

function auditTemplate(template, allowedTokens) {
  const violations = [];
  const add = (rule, detail) => violations.push({ rule, detail });
  for (const literal of template.match(/#[0-9a-fA-F]{3,8}\b/g) || []) add('raw-hex', literal);
  for (const literal of template.match(/\b(?:rgb|rgba|hsl|hsla|hwb|oklch|oklab)\s*\(/gi) || []) add('raw-color', literal.trim());
  for (const literal of template.match(/\b\d+(?:\.\d+)?px\b/gi) || []) add('raw-px', literal);
  if (/:root\s*\{|@theme\s*\{/iu.test(template)) add('token-definition', 'modules must consume, not define, tokens');
  const references = [...template.matchAll(/var\(\s*(--[A-Za-z0-9-]+)\s*\)/gu)].map((match) => match[1]);
  for (const reference of references) {
    if (reference.startsWith('--brand-')) add('primitive-token', reference);
    else if (!allowedTokens.has(reference)) add('unknown-semantic-token', reference);
  }
  return { references: [...new Set(references)], violations };
}

function auditMediaDelivery(template, manifest) {
  if (manifest.gateProfile !== 'section-media-v1') return [];
  const violations = [];
  if (!/\bdata-slot\s*=\s*(["'])media\1/iu.test(template)) {
    violations.push('media slot is not anchored');
  }
  const altTag = template.match(/<[A-Za-z][A-Za-z0-9-]*\b[^>]*\bdata-slot\s*=\s*(["'])mediaAlt\1[^>]*>/iu);
  if (!altTag) {
    violations.push('mediaAlt slot is not anchored on an element');
    return violations;
  }
  const tag = altTag[0];
  const hasBinding = /\bdata-slot-aria-label\s*=\s*(["'])mediaAlt\1/iu.test(tag);
  const hasAccessibleName = /(?:^|\s)aria-label\s*=\s*(["'])[^"']+\1/iu.test(tag);
  const legacyStaticAlt = !Object.prototype.hasOwnProperty.call(manifest, 'variantProvenance') && hasAccessibleName;
  if (!/\brole\s*=\s*(["'])img\1/iu.test(tag)) violations.push('mediaAlt anchor is not an image role');
  if (!hasBinding && !legacyStaticAlt) violations.push('mediaAlt has no renderer aria-label binding marker');
  // Do not use a word-boundary here: `data-slot-aria-label` contains the
  // substring `aria-label`, so it would falsely satisfy the real attribute
  // check when the actual accessible name was absent.
  if (!hasAccessibleName) violations.push('mediaAlt placeholder has no accessible name');
  return violations;
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/gu, '&amp;')
    .replace(/"/gu, '&quot;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
}

function renderTemplateSlots(template, manifest) {
  if (manifest.gateProfile !== 'section-media-v1') {
    return { template, mediaAlt: null, mediaAltBindings: 0, mediaAltSelector: null, mediaDelivery: 'not-required' };
  }

  const altTag = template.match(/<[A-Za-z][A-Za-z0-9-]*\b[^>]*\bdata-slot\s*=\s*(["'])mediaAlt\1[^>]*>/iu);
  const altTagText = altTag && altTag[0];
  const hasBinding = altTagText && /(?:^|\s)data-slot-aria-label\s*=\s*(["'])mediaAlt\1/iu.test(altTagText);
  const staticAlt = altTagText && altTagText.match(/(?:^|\s)aria-label\s*=\s*(["'])([^"']+)\1/iu);
  const legacyStaticAlt = !Object.prototype.hasOwnProperty.call(manifest, 'variantProvenance') && staticAlt;
  if (!hasBinding && legacyStaticAlt) {
    return {
      template,
      mediaAlt: staticAlt[2],
      mediaAltBindings: 0,
      mediaAltSelector: '[data-slot="mediaAlt"]',
      mediaDelivery: 'static-alt-legacy'
    };
  }

  // This is deliberately a minimal renderer rather than a string-marker
  // audit: it supplies a neutral mediaAlt value into the actual aria-label
  // attribute that a browser will parse.  Keeping the visual placeholder
  // intact lets structural media variants remain visible in the render.
  const mediaAlt = 'Rendered neutral media description';
  const encodedAlt = escapeAttribute(mediaAlt);
  let mediaAltBindings = 0;
  const rendered = template.replace(/<[A-Za-z][A-Za-z0-9-]*\b[^>]*>/gu, (tag) => {
    const hasMediaAltSlot = /(?:^|\s)data-slot\s*=\s*(["'])mediaAlt\1/iu.test(tag);
    const hasBinding = /(?:^|\s)data-slot-aria-label\s*=\s*(["'])mediaAlt\1/iu.test(tag);
    if (!hasMediaAltSlot || !hasBinding) return tag;
    const next = tag.replace(/(?:^|\s)aria-label\s*=\s*(["'])[^"']*\1/iu, ` aria-label="${encodedAlt}"`);
    if (next === tag) fail('mediaAlt renderer found no real aria-label attribute to inject');
    mediaAltBindings += 1;
    return next;
  });
  if (mediaAltBindings !== 1) fail(`mediaAlt renderer expected one binding, found ${mediaAltBindings}`);
  return {
    template: rendered,
    mediaAlt,
    mediaAltBindings,
    mediaAltSelector: '[data-slot="mediaAlt"][data-slot-aria-label="mediaAlt"]',
    mediaDelivery: 'rendered-alt'
  };
}

function buildHarness(theme, template, renderedSlots) {
  // @theme is a Tailwind build directive, not a browser custom-property
  // container.  In this temporary browser-only harness it becomes :root;
  // the module itself stays untouched and contains no primitive token values.
  const browserTheme = theme.replace(/@theme\s*\{/u, ':root {');
  const mediaAssertion = renderedSlots.mediaAlt
    ? `<style>html:not([data-module-media-alt-delivered="true"]) body { min-inline-size: 200vw; }</style>`
    : '';
  const mediaAssertionScript = renderedSlots.mediaAlt
    ? `<script>
(() => {
  const expected = ${JSON.stringify(renderedSlots.mediaAlt)};
  const media = document.querySelector(${JSON.stringify(renderedSlots.mediaAltSelector)});
  if (media && media.getAttribute('aria-label') === expected) {
    document.documentElement.dataset.moduleMediaAltDelivered = 'true';
  }
})();
</script>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Module reproduction harness</title>
  <style>${browserTheme}</style>
  <style>
    html { background: var(--color-surface); }
    body { margin: 0; background: var(--color-surface); color: var(--color-ink); font-family: var(--font-body); }
    * { box-sizing: border-box; }
  </style>
  ${mediaAssertion}
</head>
<body>
${template}
${mediaAssertionScript}
</body>
</html>
`;
}

function validateModule(moduleDir) {
  const result = run(process.execPath, [VALIDATOR, moduleDir], 'section-validate');
  if (result.status !== 0) fail(`section-validate failed for ${path.relative(ROOT, moduleDir)}\n${result.stdout}${result.stderr}`);
  return result.stdout.trim().split('\n')[0] || 'PASS';
}

function renderModule(moduleDir, theme, allowedTokens, keep) {
  const templatePath = path.join(moduleDir, 'template.html');
  const manifestPath = path.join(moduleDir, 'module.json');
  if (!fs.existsSync(templatePath)) fail(`${path.relative(ROOT, templatePath)} is missing`);
  if (!fs.existsSync(manifestPath)) fail(`${path.relative(ROOT, manifestPath)} is missing`);
  const template = fs.readFileSync(templatePath, 'utf8');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const tokenAudit = auditTemplate(template, allowedTokens);
  if (tokenAudit.violations.length) {
    const rendered = tokenAudit.violations.map((item) => `${item.rule}:${item.detail}`).join(', ');
    fail(`token audit failed for ${path.relative(ROOT, moduleDir)} (${rendered})`);
  }
  const mediaViolations = auditMediaDelivery(template, manifest);
  if (mediaViolations.length) fail(`media delivery audit failed for ${path.relative(ROOT, moduleDir)} (${mediaViolations.join(', ')})`);
  const renderedSlots = renderTemplateSlots(template, manifest);

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-module-reproduce-'));
  const harnessPath = path.join(tempRoot, 'harness.html');
  const shotDir = path.join(tempRoot, 'shots');
  fs.writeFileSync(harnessPath, buildHarness(theme, renderedSlots.template, renderedSlots), 'utf8');
  let runJson;
  try {
    const result = run(process.execPath, [SHOOT, harnessPath, shotDir], 'shoot', {
      ASSETS: '0',
      GATE_EXIT: '1',
      MAX_TILES: '1'
    });
    if (result.status !== 0) fail(`render failed for ${path.relative(ROOT, moduleDir)}\n${result.stdout}${result.stderr}`);
    const runPath = path.join(shotDir, 'run.json');
    const tilePath = path.join(shotDir, 'desktop-tile_00.png');
    if (!fs.existsSync(runPath)) fail(`render produced no run.json for ${path.relative(ROOT, moduleDir)}`);
    if (!fs.existsSync(tilePath) || fs.statSync(tilePath).size === 0) fail(`render produced no desktop tile for ${path.relative(ROOT, moduleDir)}`);
    runJson = JSON.parse(fs.readFileSync(runPath, 'utf8'));
    if (runJson?.gate?.report?.overall !== true) {
      fail(`render gate did not pass for ${path.relative(ROOT, moduleDir)}`);
    }
    return {
      tokenReferences: tokenAudit.references.length,
      mediaDelivery: renderedSlots.mediaDelivery,
      tileBytes: fs.statSync(tilePath).size,
      shotDir: keep ? shotDir : null
    };
  } finally {
    if (!keep) fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (!fs.existsSync(THEME)) fail('canonical semantic theme is missing');
  if (!fs.existsSync(SHOOT)) fail('detail-page shoot.js is missing');
  const theme = fs.readFileSync(THEME, 'utf8');
  const allowedTokens = semanticTokenNames(theme);
  let passed = 0;
  for (const moduleDir of args.moduleDirs) {
    try {
      const validation = validateModule(moduleDir);
      const rendered = renderModule(moduleDir, theme, allowedTokens, args.keep);
      process.stdout.write(`PASS ${path.relative(ROOT, moduleDir)} validate="${validation}" semanticRefs=${rendered.tokenReferences} mediaDelivery=${rendered.mediaDelivery} desktopTileBytes=${rendered.tileBytes}${rendered.shotDir ? ` shots=${rendered.shotDir}` : ''}\n`);
      passed += 1;
    } catch (error) {
      process.stdout.write(`FAIL ${path.relative(ROOT, moduleDir)} ${error.message}\n`);
    }
  }
  process.stdout.write(`RESULT: ${passed}/${args.moduleDirs.length} modules render, validate, and consume canonical semantic tokens\n`);
  return passed === args.moduleDirs.length ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
