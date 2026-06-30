// icon-set.js — emit a COHERENT, first-party SVG icon family from a small spec, plus a verification sheet.
// The suite previously delegated icons to Phosphor/Lucide and shipped none; this draws a tasteful core set
// (~12 common UI icons) by hand on ONE shared grid so every icon is license-clear (our own SVG), deterministic,
// and visually consistent: same viewBox, same stroke-width, same round caps/joins, same corner radius, and a
// small per-icon optical-size correction so marks that read large (+ / × / hamburger) are nudged to match the
// optical weight of the rest. Built-in modules only (fs + path), no external deps, no network.
//
// Spec (all optional, defaults shown):
//   { grid: 24, stroke: 1.75, radius: 2, icons: ["search","settings",...] }
// Usage:
//   node icon-set.js [spec.json] [out-dir]      // a positional ending in .json is the spec; else it's the out-dir
//   node icon-set.js [out-dir]                   // default spec
//   flags: --spec=path.json --grid=N --stroke=N --radius=N --icons=a,b,c  (flags override spec-file values)
// Writes: <out>/<icon>.svg (one per icon) + <out>/icon-grid.html (16/24/32px on light + dark; shootable by shoot.js).

const fs = require('fs');
const path = require('path');

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// round to 3 decimals, normalize -0 → 0 so emitted geometry is stable/deterministic.
const r3 = (n) => { const v = Math.round(Number(n) * 1000) / 1000; return Object.is(v, -0) ? 0 : v; };
const numOr = (v, dflt) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : dflt; };

// ---- geometry helpers (built on the canonical 24-unit design grid) ----
// Flat-topped cog: each tooth contributes outer-top edge + sloped sides + a valley floor. Round joins soften it.
function gearPath(cx, cy, rOuter, rInner, teeth) {
  const per = (2 * Math.PI) / teeth, tw = per * 0.20, gw = per * 0.30, polar = [];
  for (let i = 0; i < teeth; i++) {
    const c = -Math.PI / 2 + i * per;
    polar.push([rOuter, c - tw], [rOuter, c + tw], [rInner, c + gw], [rInner, c + per - gw]);
  }
  const xy = polar.map(([r, a]) => [cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  return 'M' + xy.map((p) => p.map(r3).join(' ')).join(' L ') + ' Z';
}
// N-point star outline, first point at top (-90deg).
function starPath(cx, cy, rOuter, rInner, points) {
  const a = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const ang = -Math.PI / 2 + (i * Math.PI) / points;
    a.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
  }
  return 'M' + a.map((p) => p.map(r3).join(' ')).join(' L ') + ' Z';
}

// ---- the hand-drawn library (geometry only; root <svg> + stroke attrs are added by iconSvg) ----
// Each entry is (radius) => inner-markup string, drawn for stroke-width ~1.75 on the 24-grid with ~3u optical margin.
const LIBRARY = {
  search: () => `<circle cx="11" cy="11" r="6"/><line x1="15.4" y1="15.4" x2="20" y2="20"/>`,
  settings: () => `<path d="${gearPath(12, 12, 9.5, 7.2, 7)}"/><circle cx="12" cy="12" r="3.1"/>`,
  check: () => `<polyline points="5 12.5 10 17 19 7.5"/>`,
  'arrow-right': () => `<line x1="4" y1="12" x2="19.5" y2="12"/><polyline points="13 5.5 19.5 12 13 18.5"/>`,
  user: () => `<circle cx="12" cy="8" r="3.75"/><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0"/>`,
  bell: () => `<path d="M17.5 16.5c0-1-1.5-2-1.5-6a4 4 0 0 0-8 0c0 4-1.5 5-1.5 6Z"/><path d="M10.5 20a1.5 1.5 0 0 0 3 0"/>`,
  heart: () => `<path d="M12 20s-7-4.4-7-9.4a3.9 3.9 0 0 1 7-2.4 3.9 3.9 0 0 1 7 2.4c0 5-7 9.4-7 9.4Z"/>`,
  star: () => `<path d="${starPath(12, 12.4, 8, 3.2, 5)}"/>`,
  plus: () => `<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`,
  x: () => `<line x1="6.5" y1="6.5" x2="17.5" y2="17.5"/><line x1="17.5" y1="6.5" x2="6.5" y2="17.5"/>`,
  menu: () => `<line x1="5" y1="7" x2="19" y2="7"/><line x1="5" y1="12" x2="19" y2="12"/><line x1="5" y1="17" x2="19" y2="17"/>`,
  'chevron-right': () => `<polyline points="9.5 5.5 16 12 9.5 18.5"/>`,
  // extras (not in the default set, but first-party + on the same grid, so a spec may request them):
  home: () => `<polyline points="4 11.5 12 5 20 11.5"/><path d="M6.5 10V20h11V10"/>`,
  mail: (rx) => `<rect x="4" y="6.5" width="16" height="11" rx="${r3(rx)}"/><path d="M4.5 8 12 13 19.5 8"/>`,
  lock: (rx) => `<rect x="5.5" y="11" width="13" height="8.5" rx="${r3(rx)}"/><path d="M8 11V8.5a4 4 0 0 1 8 0V11"/>`,
};
// optical-size correction (scale about the 24-grid center) — keep heavy/edge-spanning marks from reading oversized.
const OPTICAL = { plus: 0.95, x: 0.92, menu: 0.96 };
// the curated default core set (~12), used when the spec names no icons.
const DEFAULT_ICONS = ['search', 'settings', 'check', 'arrow-right', 'user', 'bell', 'heart', 'star', 'plus', 'x', 'menu', 'chevron-right'];

function iconSvg(name, { grid, stroke, radius }) {
  const draw = LIBRARY[name];
  if (!draw) return null;
  const k = grid / 24;                       // map the 24-unit design grid onto the requested grid
  let inner = draw(radius);
  const s = OPTICAL[name] || 1;
  if (s !== 1) inner = `<g transform="translate(12 12) scale(${r3(s)}) translate(-12 -12)">${inner}</g>`;
  // scale(k) also scales the inherited stroke visually to stroke*k → relative weight stays stroke/24 for any grid,
  // while the emitted stroke-width attribute stays === spec.stroke (identical across every icon in the run).
  const content = k === 1 ? inner : `<g transform="scale(${r3(k)})">${inner}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r3(grid)} ${r3(grid)}" width="${r3(grid)}" height="${r3(grid)}" `
    + `fill="none" stroke="currentColor" stroke-width="${r3(stroke)}" stroke-linecap="round" stroke-linejoin="round" `
    + `role="img" aria-label="${esc(name)} icon">${content}</svg>`;
}

// ---- argument / spec parsing ----
const argv = process.argv.slice(2);
const flags = {};
for (const a of argv) { const m = a.match(/^--([^=]+)=(.*)$/); if (m) flags[m[1]] = m[2]; }
const positional = argv.filter((a) => !a.startsWith('--'));
const specFile = flags.spec || positional.find((p) => /\.json$/i.test(p));
const outDir = positional.find((p) => !/\.json$/i.test(p)) || path.join(process.cwd(), 'icon-set');

try {
  let spec = {};
  if (specFile) {
    if (!fs.existsSync(specFile)) { console.error('FATAL: spec file not found:', specFile); process.exit(1); }
    try { spec = JSON.parse(fs.readFileSync(specFile, 'utf8')); }
    catch (e) { console.error('FATAL: spec is not valid JSON:', e.message); process.exit(1); }
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) { console.error('FATAL: spec must be a JSON object'); process.exit(1); }
  }

  const grid = numOr(flags.grid, numOr(spec.grid, 24));
  const stroke = numOr(flags.stroke, numOr(spec.stroke, 1.75));
  const radius = Number.isFinite(Number(flags.radius)) ? Number(flags.radius)
    : (Number.isFinite(Number(spec.radius)) ? Number(spec.radius) : 2);

  let requested = flags.icons ? flags.icons.split(',') : (Array.isArray(spec.icons) ? spec.icons : null);
  requested = (requested && requested.length ? requested : DEFAULT_ICONS)
    .map((s) => String(s).trim()).filter(Boolean);
  // de-dupe, preserve order
  requested = requested.filter((n, i) => requested.indexOf(n) === i);

  const cfg = { grid, stroke, radius };
  const made = [], skipped = [];
  fs.mkdirSync(outDir, { recursive: true });

  for (const name of requested) {
    const svg = iconSvg(name, cfg);
    if (!svg) { skipped.push(name); continue; }
    fs.writeFileSync(path.join(outDir, name + '.svg'), '<?xml version="1.0" encoding="UTF-8"?>\n' + svg + '\n');
    made.push(name);
  }
  if (skipped.length) console.error('WARN: not in library, skipped:', skipped.join(', '),
    '\n      available:', Object.keys(LIBRARY).join(', '));
  if (!made.length) { console.error('FATAL: no valid icons to emit'); process.exit(2); }

  // ---- verification sheet: every icon at 16/24/32 on light + dark, self-contained (inline SVG, no external assets) ----
  const SIZES = [16, 24, 32];
  const cell = (name) => {
    const svg = iconSvg(name, cfg); // width/height attrs are overridden by the .s16/.s24/.s32 CSS below
    const row = SIZES.map((px) => `<span class="ic s${px}" title="${esc(name)} @ ${px}px">${svg}</span>`).join('');
    return `<figure class="cell"><div class="row">${row}</div><figcaption><code>${esc(name)}.svg</code></figcaption></figure>`;
  };
  const grids = made.map(cell).join('\n');
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Icon set — verification sheet</title>
<style>
*{box-sizing:border-box}
body{font-family:Pretendard,sans-serif;margin:0;padding:24px;background:oklch(0.985 0.008 95);color:oklch(0.205 0.012 275);overflow-wrap:anywhere}
h1{margin:0 0 4px;font-size:22px}
.sub{margin:0 0 18px;font-size:13px;opacity:.6}
.panel{border-radius:16px;padding:18px;margin-bottom:20px}
.panel h2{margin:0 0 12px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.55;font-weight:600}
.panel.light{background:oklch(1 0 0);border:1px solid oklch(0.205 0.012 275 / 0.12)}
.panel.dark{background:oklch(0.205 0.012 275);color:oklch(0.97 0 0)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:14px}
.cell{margin:0;display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 8px;border-radius:12px}
.panel.light .cell{background:oklch(0.985 0.006 95)}
.panel.dark .cell{background:oklch(0.255 0.014 275)}
.row{display:flex;align-items:flex-end;justify-content:center;gap:12px;min-height:36px}
.ic svg{display:block}
.ic.s16 svg{width:16px;height:16px}
.ic.s24 svg{width:24px;height:24px}
.ic.s32 svg{width:32px;height:32px}
figcaption code{font-size:11px;opacity:.6}
</style></head>
<body>
<h1>Icon set — verification sheet</h1>
<p class="sub">${made.length} first-party icons · grid ${r3(grid)} · stroke ${r3(stroke)} · radius ${r3(radius)} · shared viewBox 0 0 ${r3(grid)} ${r3(grid)}. Each shown at 16 / 24 / 32 px on light &amp; dark. Generated by icon-set.js.</p>
<section class="panel light"><h2>Light</h2><div class="grid">${grids}</div></section>
<section class="panel dark"><h2>Dark</h2><div class="grid">${grids}</div></section>
</body></html>`;
  fs.writeFileSync(path.join(outDir, 'icon-grid.html'), html);

  console.log(JSON.stringify({
    ok: true, outDir: path.resolve(outDir),
    grid: r3(grid), stroke: r3(stroke), radius: r3(radius), viewBox: `0 0 ${r3(grid)} ${r3(grid)}`,
    count: made.length, icons: made, skipped,
    files: made.map((n) => n + '.svg').concat(['icon-grid.html']),
  }, null, 2));
} catch (e) {
  console.error('FATAL', e.message);
  process.exit(2);
}
