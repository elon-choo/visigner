#!/usr/bin/env node
// designsync-bundle.js — Visigner **design-core** DesignSync publish bundler.
//
// Turns Visigner design outputs (component preview HTML + an optional token spec) into
// a LOCAL staging directory laid out exactly like the target claude.ai/design
// design-system project, with each preview HTML's FIRST LINE carrying the card marker
//   <!-- @dsCard group="..." -->
// The Design System pane builds its card index from that first-line comment, so no
// explicit register step is required. This script does ZERO network I/O — the actual
// push is performed by the DesignSync tool, driven by the /design-publish command,
// which reads this bundle's manifest (finalize_plan writes-globs + localDir, then
// write_files with localPath). Node built-ins only; no npm install.
//
// Usage:
//   node designsync-bundle.js <component.html> [more.html ...] [options]
//   node designsync-bundle.js <manifest.json> [options]
// Options:
//   --out <dir>       staging directory (default /tmp/visigner-designsync). Cleared per run.
//   --group <label>   default card group for inputs without their own group (default "Components")
//   --tokens <file>   a token spec HTML to publish under tokens/ with group "Tokens"
//
// manifest.json shape (alternative to positional files):
//   { "components": [ { "file": "/abs/button.html", "group": "Buttons", "name": "Primary Button" }, ... ],
//     "tokens": "/abs/spec.html" }
//
// Output (printed + written to <staging>/_bundle-manifest.json):
//   { localDir, writes:[globs], components:[{ path, localPath, group, name }] }
//   `path`     = project-relative path to write in claude.ai/design (e.g. components/primary-button/preview.html)
//   `localPath`= path relative to localDir the DesignSync tool reads from (same tree)

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function die(msg, code = 1) { console.error('[designsync-bundle] ' + msg); process.exit(code); }

// Guard the destructive staging wipe: refuse an --out that is (or contains) a place we must never
// recursively delete. The bundle owns its staging dir, so we only clear a dir we plausibly created
// (empty, or carrying our own _bundle-manifest.json) — never the fs root / home / cwd / a real
// project directory. This runs BEFORE any rm and BEFORE input validation is even reached.
function assertSafeOutDir(dir) {
  const abs = path.resolve(dir);
  const root = path.parse(abs).root;
  const home = os.homedir();
  const cwd = process.cwd();
  if (abs === root) die('refusing --out at the filesystem root: ' + abs);
  if (abs === home) die('refusing --out at your home directory: ' + abs);
  if (abs === cwd || cwd === abs || cwd.startsWith(abs + path.sep)) {
    die('refusing --out ' + abs + ' — it is or contains the current working directory. Pick a fresh staging path.');
  }
  if (fs.existsSync(abs)) {
    if (!fs.statSync(abs).isDirectory()) die('--out ' + abs + ' exists and is not a directory.');
    const entries = fs.readdirSync(abs);
    if (entries.length && !entries.includes('_bundle-manifest.json')) {
      die('--out ' + abs + ' is a non-empty directory not created by this bundler (no _bundle-manifest.json). Refusing to delete it — choose an empty or new path.');
    }
  }
  return abs;
}

// ---- arg parsing ----
const argv = process.argv.slice(2);
function takeFlag(name, def) {
  const i = argv.indexOf(name);
  if (i === -1) return def;
  const v = argv[i + 1];
  const has = v !== undefined && !v.startsWith('--');
  argv.splice(i, has ? 2 : 1);
  return has ? v : true;
}
const outDir = String(takeFlag('--out', '/tmp/visigner-designsync'));
const defaultGroup = String(takeFlag('--group', 'Components'));
const tokensFile = takeFlag('--tokens', null);
const inputs = argv.filter((a) => !a.startsWith('--'));

if (!inputs.length && !tokensFile) {
  die('usage: node designsync-bundle.js <component.html ...>|<manifest.json> [--out dir] [--group label] [--tokens spec.html]');
}

// ---- html-comment-safe sanitizer (comments cannot contain "--" or unbalanced quotes) ----
function safeAttr(s) {
  return String(s == null ? '' : s).replace(/-{2,}/g, '-').replace(/"/g, "'").replace(/[\r\n]+/g, ' ').trim();
}
// filename/name -> path slug (ASCII + CJK preserved, spaces/punct -> '-')
function slug(s, fallback) {
  const base = String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || fallback || 'component';
}

// Extract a human name from HTML: data-ds-name attr, else <title>, else null.
function nameFromHtml(html) {
  const dn = html.match(/data-ds-name\s*=\s*["']([^"']+)["']/i);
  if (dn) return dn[1].trim();
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t) return t[1].replace(/\s+/g, ' ').trim() || null;
  return null;
}
// Extract a group from HTML: data-ds-group attr, else null.
function groupFromHtml(html) {
  const g = html.match(/data-ds-group\s*=\s*["']([^"']+)["']/i);
  return g ? g[1].trim() : null;
}

// ---- resolve the component list (positional files or a manifest.json) ----
let comps = []; // { file, group?, name? }
let tokensSpec = tokensFile && tokensFile !== true ? String(tokensFile) : null;

if (inputs.length === 1 && inputs[0].toLowerCase().endsWith('.json')) {
  let m;
  try { m = JSON.parse(fs.readFileSync(inputs[0], 'utf8')); }
  catch (e) { die('cannot read manifest json: ' + e.message); }
  if (!Array.isArray(m.components)) die('manifest.json must have a "components" array');
  comps = m.components.map((c) => (typeof c === 'string' ? { file: c } : c));
  if (m.tokens && !tokensSpec) tokensSpec = m.tokens;
} else {
  comps = inputs.map((f) => ({ file: f }));
}

// ---- pre-validate EVERY input exists BEFORE any destructive fs op ----
// (so a typo'd input can never wipe --out and then fail).
const preInputs = comps.map((c) => {
  if (!c || !c.file) die('every manifest component needs a "file"');
  return path.resolve(c.file);
});
if (tokensSpec) preInputs.push(path.resolve(tokensSpec));
for (const f of preInputs) if (!fs.existsSync(f)) die('input file not found: ' + f);

// ---- build the staging tree (guarded wipe, only after inputs are known-good) ----
assertSafeOutDir(outDir);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const usedSlugs = new Set();
function uniqueSlug(name, fallback) {
  let s = slug(name, fallback);
  let out = s, n = 2;
  while (usedSlugs.has(out)) out = s + '-' + n++;
  usedSlugs.add(out);
  return out;
}

// Write one preview HTML with a first-line @dsCard marker (idempotent). Returns manifest entry.
function emit(absFile, group, name, projDir) {
  if (!fs.existsSync(absFile)) die('input file not found: ' + absFile);
  let html = fs.readFileSync(absFile, 'utf8').replace(/^\uFEFF/, ''); // drop a leading BOM so the marker stays line 1
  const resolvedName = name || nameFromHtml(html) || path.basename(absFile).replace(/\.[^.]+$/, '');
  const resolvedGroup = group || groupFromHtml(html) || defaultGroup;
  const s = uniqueSlug(resolvedName, path.basename(absFile).replace(/\.[^.]+$/, ''));
  const marker = `<!-- @dsCard group="${safeAttr(resolvedGroup)}" -->`;

  // idempotent: replace an existing first-line @dsCard, else prepend.
  const firstNL = html.indexOf('\n');
  const firstLine = firstNL === -1 ? html : html.slice(0, firstNL);
  if (/^\s*<!--\s*@dsCard\b/.test(firstLine)) {
    html = marker + (firstNL === -1 ? '' : html.slice(firstNL));
  } else {
    html = marker + '\n' + html;
  }

  const rel = `${projDir}/${s}/preview.html`;
  const dest = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html);
  return { path: rel, localPath: rel, group: safeAttr(resolvedGroup), name: resolvedName };
}

const entries = [];
for (const c of comps) {
  if (!c || !c.file) die('every manifest component needs a "file"');
  entries.push(emit(path.resolve(c.file), c.group, c.name, 'components'));
}
if (tokensSpec) entries.push(emit(path.resolve(tokensSpec), 'Tokens', null, 'tokens'));

if (!entries.length) die('nothing to bundle');

// ---- writes globs for finalize_plan (project-relative). Broad glob + explicit paths. ----
const dirs = Array.from(new Set(entries.map((e) => e.path.split('/')[0])));
const writes = dirs.map((d) => `${d}/**/*.html`);

const manifest = { localDir: path.resolve(outDir), writes, components: entries };
fs.writeFileSync(path.join(outDir, '_bundle-manifest.json'), JSON.stringify(manifest, null, 2));

// ---- report (consumed by /design-publish) ----
console.log('DesignSync bundle staged at: ' + manifest.localDir);
console.log('Components: ' + entries.length + (tokensSpec ? ' (incl. token spec)' : ''));
for (const e of entries) console.log('  - ' + e.path + '   [group="' + e.group + '", name="' + e.name + '"]');
console.log('');
console.log('finalize_plan args ->  writes: ' + JSON.stringify(writes) + '   localDir: ' + manifest.localDir);
console.log('manifest: ' + path.join(manifest.localDir, '_bundle-manifest.json'));
