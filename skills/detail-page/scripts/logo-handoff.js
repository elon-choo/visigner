// logo-handoff.js — from ONE mark.svg, emit the artboard SET a developer/brand handoff needs, plus an
// index.html that previews them all (and feeds logo-grid). Every artboard re-uses the SAME source mark
// (nested as an inner <svg>, scaled with preserveAspectRatio) so nothing is redrawn or guessed; the mono
// and knockout variants are derived deterministically via an SVG feColorMatrix (any input color → a
// single-color silhouette that preserves alpha). Clear-space + min-size are baked into each board.
// Built-in modules only (fs+path), no external deps, no network.
//
// Usage:  node logo-handoff.js <mark.svg> [out-dir]
// Writes: <out>/{full-color,mono,knockout,favicon,app-icon,social-avatar}.svg + <out>/index.html

const fs = require('fs');
const path = require('path');

const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const markFile = positional[0];
if (!markFile) { console.error('usage: node logo-handoff.js <mark.svg> [out-dir]'); process.exit(1); }
const outDir = positional[1] || path.join(path.dirname(path.resolve(markFile)), 'handoff');

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- guide stripping (anti-contamination) ----
// The documented logo-archetypes ship with a <g id="construction-grid"> (and/or <g id="clear-space">)
// holding faint grid + dashed clear-space/overshoot guides. Nesting the source mark VERBATIM bakes those
// guide lines into every artboard. Before nesting we DELETE those guide groups + any data-guide elements,
// then re-scan; if any guide marker survives we hard-refuse (mirroring the MODE=logo auto-FAIL) so no
// artboard ever ships contaminated. A clean mark (no guides) is left byte-for-byte unchanged.
class GuideError extends Error {}

// Remove every <g id="<id>">…</g> with balanced <g>/</g> nesting. Throws GuideError if a group opens but
// never cleanly closes (so the caller refuses rather than shipping a half-stripped mark).
function stripGroupById(s, id) {
  const openRe = new RegExp('<g\\b[^>]*\\bid\\s*=\\s*["\\\']' + id + '["\\\'][^>]*>', 'i');
  let guard = 0;
  for (;;) {
    if (guard++ > 2000) throw new GuideError('strip loop guard tripped for id="' + id + '"');
    const m = openRe.exec(s);
    if (!m) break;
    const start = m.index;
    if (/\/\s*>$/.test(m[0])) { s = s.slice(0, start) + s.slice(start + m[0].length); continue; } // empty <g .../>
    const tagRe = /<\s*(\/?)g\b[^>]*?>/gi;
    tagRe.lastIndex = start + m[0].length;
    let depth = 1, t, end = -1;
    while ((t = tagRe.exec(s))) {
      if (t[1] === '/') depth--;
      else if (!/\/\s*>$/.test(t[0])) depth++; // ignore self-closing nested <g .../>
      if (depth === 0) { end = tagRe.lastIndex; break; }
    }
    if (end === -1) throw new GuideError('unbalanced <g id="' + id + '"> — cannot cleanly strip');
    s = s.slice(0, start) + s.slice(end);
  }
  return s;
}

// Strip known guide groups + self-closing data-guide elements, then return { inner, residual }.
// residual lists any guide marker still present (caller refuses if non-empty).
function stripGuides(inner) {
  let s = inner;
  // Drop construction-template metadata that must never ride into a shipped artboard: XML comments
  // (e.g. "<!-- construction-grid: DELETE ... -->") and the source <title>/<desc> (they carry the
  // "delete #construction-grid before shipping" instruction text). Non-painting; the artboards supply
  // their own role/aria-label. Removing them also keeps the output free of the guide marker strings.
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '');
  s = s.replace(/<desc\b[^>]*>[\s\S]*?<\/desc>/gi, '');
  s = stripGroupById(s, 'construction-grid');
  s = stripGroupById(s, 'clear-space');
  // self-closing elements explicitly tagged as guides
  s = s.replace(/<[a-zA-Z][\w:.-]*\b[^>]*\bdata-guide\b[^>]*\/\s*>/gi, '');
  const residual = [];
  if (/\bid\s*=\s*["'](?:construction-grid|clear-space)["']/i.test(s)) residual.push('id="construction-grid|clear-space"');
  if (/\bdata-guide\b/i.test(s)) residual.push('data-guide');
  if (/stroke-dasharray/i.test(s)) residual.push('stroke-dasharray (dashed guide)');
  return { inner: s, residual };
}

try {
  fs.mkdirSync(outDir, { recursive: true });
  const raw = fs.readFileSync(markFile, 'utf8');

  // ---- parse the source mark: viewBox + inner content (so we can nest + scale it) ----
  const open = raw.match(/<svg\b[^>]*>/i);
  if (!open) { console.error('FATAL: no <svg> element found in', markFile); process.exit(2); }
  const openTag = open[0];
  let vb = (openTag.match(/viewBox\s*=\s*["']([^"']+)["']/i) || [])[1];
  if (!vb) {
    const w = parseFloat((openTag.match(/\bwidth\s*=\s*["']?([\d.]+)/i) || [])[1]);
    const h = parseFloat((openTag.match(/\bheight\s*=\s*["']?([\d.]+)/i) || [])[1]);
    vb = (w && h) ? `0 0 ${w} ${h}` : '0 0 100 100';
  }
  const openEnd = open.index + openTag.length;
  const closeIdx = raw.lastIndexOf('</svg>');
  const rawInner = raw.slice(openEnd, closeIdx === -1 ? undefined : closeIdx).trim();

  // ---- strip construction/guide layers BEFORE nesting, or hard-refuse if they can't be cleaned ----
  let inner;
  try {
    const stripped = stripGuides(rawInner);
    if (stripped.residual.length) {
      console.error('GUIDE-FAIL: guides present — strip before handoff. ' + markFile +
        ' still contains guide markers after auto-strip [' + stripped.residual.join(', ') +
        ']; remove the construction-grid / clear-space / dashed-guide layers from the source mark first.');
      process.exit(3);
    }
    inner = stripped.inner.trim();
  } catch (e) {
    if (e instanceof GuideError) {
      console.error('GUIDE-FAIL: guides present — strip before handoff. ' + markFile + ': ' + e.message +
        '. Remove the construction-grid / clear-space layers from the source mark first.');
      process.exit(3);
    }
    throw e;
  }

  // place the mark as a nested svg inside a square box [x,y,size]
  const placeMark = (x, y, size) =>
    `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" overflow="visible">${inner}</svg>`;

  // neutral artboard palette (kept independent of brand tokens — this tool only transforms the mark)
  const INK = '#16161a', SURFACE = '#ffffff', GUIDE = '#16161a';
  const FILTERS = {
    mono: '<filter id="mono" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/></filter>',
    ko: '<filter id="ko" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"/></filter>',
  };

  // generic board builder
  function board({ size, pad, bg, bgRadius = 0, filter = null, defs = '', guides = false, minPx = null, label = '', clip = null, ink = INK }) {
    const inset = Math.round(size * pad);
    const box = size - inset * 2;
    const labelGap = (guides || label) ? Math.round(size * 0.085) : 0;
    const markBox = box - labelGap;            // leave room for the caption strip
    const mx = inset, my = inset;
    const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(label || 'logo')}">`];
    const allDefs = (defs || '') + (clip === 'circle' ? `<clipPath id="rc"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - inset}"/></clipPath>` : '');
    if (allDefs) parts.push(`<defs>${allDefs}</defs>`);
    if (bg) parts.push(bgRadius ? `<rect width="${size}" height="${size}" rx="${bgRadius}" fill="${bg}"/>` : `<rect width="${size}" height="${size}" fill="${bg}"/>`);
    const clipAttr = clip === 'circle' ? ` clip-path="url(#rc)"` : '';
    const filterAttr = filter ? ` filter="url(#${filter})"` : '';
    parts.push(`<g${clipAttr}${filterAttr}>${placeMark(mx, my, markBox)}</g>`);
    if (guides) {
      const sw = Math.max(1, Math.round(size * 0.004));
      const dash = `stroke-dasharray="${Math.round(size * 0.03)} ${Math.round(size * 0.022)}"`;
      parts.push(`<rect x="${mx}" y="${my}" width="${markBox}" height="${markBox}" fill="none" stroke="${ink}" stroke-opacity="0.28" stroke-width="${sw}" ${dash}/>`);
    }
    if (label || minPx) {
      const tz = Math.round(size * 0.045);
      const ty = size - inset - Math.round(tz * 0.4);
      const txt = [label, minPx ? `MIN ${minPx}px · CLEAR-SPACE ${Math.round(pad * 100)}%` : '']. filter(Boolean).join('  ·  ');
      parts.push(`<text x="${size / 2}" y="${ty}" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="${tz}" font-weight="600" letter-spacing="0.5" fill="${ink}" fill-opacity="0.6">${esc(txt)}</text>`);
    }
    parts.push('</svg>');
    return parts.join('');
  }

  // ---- the artboard set ----
  const boards = {
    'full-color': { title: 'Full color', svg: board({ size: 320, pad: 0.16, bg: SURFACE, guides: true, minPx: 24, label: 'FULL COLOR' }) },
    'mono': { title: '1-color mono', svg: board({ size: 320, pad: 0.16, bg: SURFACE, defs: FILTERS.mono, filter: 'mono', guides: true, minPx: 24, label: 'MONO' }) },
    'knockout': { title: 'Knockout on dark', svg: board({ size: 320, pad: 0.16, bg: INK, defs: FILTERS.ko, filter: 'ko', guides: true, minPx: 24, label: 'KNOCKOUT', ink: SURFACE }) },
    'favicon': { title: 'Favicon (32px)', svg: board({ size: 32, pad: 0.08, bg: SURFACE }) },
    'app-icon': { title: 'App icon (512px, padded)', svg: board({ size: 512, pad: 0.20, bg: SURFACE, bgRadius: Math.round(512 * 0.22) }) },
    'social-avatar': { title: 'Social avatar (circle crop)', svg: board({ size: 512, pad: 0.14, bg: SURFACE, clip: 'circle' }) },
  };

  const written = [];
  for (const [key, b] of Object.entries(boards)) {
    const f = path.join(outDir, key + '.svg');
    fs.writeFileSync(f, '<?xml version="1.0" encoding="UTF-8"?>\n' + b.svg + '\n');
    written.push(key + '.svg');
  }

  // ---- preview index.html (self-contained: SVGs inlined; feeds logo-grid) ----
  const cards = Object.entries(boards).map(([key, b]) =>
    `<figure class="cell" data-board="${key}"><div class="art ${key === 'knockout' ? 'on-dark' : ''}">${b.svg}</div><figcaption><b>${esc(b.title)}</b><code>${esc(key)}.svg</code></figcaption></figure>`
  ).join('\n');
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Logo handoff — artboards</title>
<style>
*{box-sizing:border-box}
body{font-family:Pretendard,sans-serif;margin:0;padding:24px;background:oklch(0.985 0.008 95);color:oklch(0.205 0.012 275);overflow-wrap:anywhere}
h1{margin:0 0 4px;font-size:24px}
.sub{margin:0 0 20px;font-size:13px;opacity:.6}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px}
.cell{margin:0;background:oklch(1 0 0);border:1px solid oklch(0.205 0.012 275 / 0.12);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px}
.art{display:flex;align-items:center;justify-content:center;border-radius:10px;padding:8px;min-height:120px}
.art.on-dark{background:oklch(0.205 0.012 275)}
.art svg{display:block;width:100%;max-width:160px;height:auto}
figcaption b{display:block;font-size:13px}
figcaption code{font-size:11px;opacity:.55}
img,svg{max-width:100%;height:auto}
</style></head>
<body>
<h1>Logo handoff — artboards</h1>
<p class="sub">Generated by logo-handoff.js from ${esc(path.basename(markFile))}. Clear-space &amp; min-size baked in. Each artboard is also written as a standalone .svg in this folder.</p>
<div class="grid">${cards}</div>
</body></html>`;
  const indexFile = path.join(outDir, 'index.html');
  fs.writeFileSync(indexFile, html);
  written.push('index.html');

  console.log(JSON.stringify({ ok: true, outDir: path.resolve(outDir), viewBox: vb, files: written }, null, 2));
} catch (e) {
  console.error('FATAL', e.message);
  process.exit(2);
}
