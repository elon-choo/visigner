// brand-book.js — assemble ONE self-contained brand guidelines.html from existing outputs.
// Given a DTCG brand.tokens.json (the same shape emit-tokens.js / build-tokens.js use), optionally a
// voice.json and a logo (svg file or a dir containing one), it emits a single guidelines.html that shows:
//   • the palette as swatches (reuses the emit-tokens spec.html swatch approach — oklch css, no hex),
//   • type specimens (font families + the fontSize/lineHeight ramp),
//   • the logo on full-color / 1-color mono / knockout-on-dark tiles (mono+knockout are derived from the
//     SAME mark via CSS filters — deterministic, no recolor guesswork), and
//   • a voice do/don't grid + lexicon when voice.json is supplied.
// Deterministic, built-in modules only (fs+path), no external deps, no network. Shootable by shoot.js.
//
// Usage:  node brand-book.js <brand.tokens.json> [out-dir] [--voice <voice.json>] [--logo <mark.svg|dir>] [--name <Brand>]
// Writes: <out>/guidelines.html   (default out-dir = the tokens file's directory)

const fs = require('fs');
const path = require('path');

// ---- args ----
const rawArgs = process.argv.slice(2);
let voicePath = null, logoPath = null, brandName = null;
const positional = [];
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (a === '--voice') { voicePath = rawArgs[++i]; continue; }
  if (a.startsWith('--voice=')) { voicePath = a.slice(8); continue; }
  if (a === '--logo') { logoPath = rawArgs[++i]; continue; }
  if (a.startsWith('--logo=')) { logoPath = a.slice(7); continue; }
  if (a === '--name') { brandName = rawArgs[++i]; continue; }
  if (a.startsWith('--name=')) { brandName = a.slice(7); continue; }
  positional.push(a);
}
const tokensFile = positional[0];
if (!tokensFile) { console.error('usage: node brand-book.js <brand.tokens.json> [out-dir] [--voice <voice.json>] [--logo <mark.svg|dir>] [--name <Brand>]'); process.exit(1); }
const outDir = positional[1] || path.dirname(path.resolve(tokensFile));

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

try {
  fs.mkdirSync(outDir, { recursive: true });
  const tokens = JSON.parse(fs.readFileSync(tokensFile, 'utf8'));

  // ---- color flatten + resolve (handles nested ramps + "{color.x.y}" aliases) ----
  const colorLeaves = {}; // dotted name -> node
  (function walkColor(node, prefix) {
    if (!node || typeof node !== 'object') return;
    if (node.$type === 'color') { colorLeaves[prefix] = node; return; }
    for (const [k, v] of Object.entries(node)) { if (k.startsWith('$')) continue; walkColor(v, prefix ? prefix + '.' + k : k); }
  })(tokens.color || {}, '');
  function colorCss(node, seen) {
    if (!node) return null;
    const ext = node.$extensions && node.$extensions['com.detail-page'];
    if (ext && ext.css) return ext.css;
    const v = node.$value;
    if (typeof v === 'string') { // alias {color.path}
      const ref = v.replace(/[{}]/g, '').trim();
      if (seen && seen.has(ref)) return null;
      const s = new Set(seen); s.add(ref);
      return colorLeaves[ref] ? colorCss(colorLeaves[ref], s) : null;
    }
    if (v && Array.isArray(v.components) && v.components.length === 3) {
      const c = v.components;
      return `oklch(${c[0]} ${c[1]} ${c[2]}${v.alpha != null ? ` / ${v.alpha}` : ''})`;
    }
    return null;
  }
  const colorEntries = Object.entries(colorLeaves)
    .map(([name, node]) => [name, colorCss(node, new Set())])
    .filter(([, css]) => css);

  // pick a few key roles for the logo tiles / page chrome (with safe fallbacks)
  const pick = (name, fallback) => (colorEntries.find(([n]) => n === name) || [null, fallback])[1];
  const C = {
    surface: pick('surface', 'oklch(0.985 0.008 95)'),
    card: pick('card', 'oklch(1 0 0)'),
    ink: pick('ink', 'oklch(0.205 0.012 275)'),
    accent: pick('accent.DEFAULT', pick('accent.500', 'oklch(0.720 0.160 58)')),
  };

  // ---- type ----
  const dimCss = (node) => {
    if (!node) return null;
    const ext = node.$extensions && node.$extensions['com.detail-page'];
    if (ext && ext.css) return ext.css;
    const v = node.$value;
    if (v && typeof v === 'object' && v.value != null) return `${v.value}${v.unit || 'px'}`;
    return typeof v === 'string' ? v : null;
  };
  const fontFamilies = Object.entries(tokens.font || {}).map(([k, t]) => {
    const fams = (t.$value || []).map((f) => (/\s/.test(f) ? `"${f}"` : f));
    return { name: k, stack: fams.join(', '), raw: (t.$value || []).join(', ') };
  });
  const sizeKeys = Object.keys(tokens.fontSize || {}).filter((k) => !k.startsWith('$'));

  // ---- logo ----
  function loadLogo(p) {
    if (!p) return null;
    let f = p;
    try {
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        const cand = fs.readdirSync(p).filter((n) => /\.svg$/i.test(n)).sort();
        if (!cand.length) return null;
        f = path.join(p, cand[0]);
      }
    } catch (_) { return null; }
    try { return fs.readFileSync(f, 'utf8').trim(); } catch (_) { return null; }
  }
  let logoSvg = loadLogo(logoPath);
  const name = brandName || (tokens.$brand && tokens.$brand.name) || 'Brand';
  if (!logoSvg) {
    // deterministic placeholder monogram from the brand initial in the accent color
    const L = (String(name).match(/[A-Za-z0-9]/) || ['B'])[0].toUpperCase();
    logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="${esc(name)} mark">`
      + `<circle cx="50" cy="50" r="44" fill="${C.accent}"/>`
      + `<text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-family="Pretendard, sans-serif" font-weight="800" font-size="52" fill="${C.surface}">${esc(L)}</text>`
      + `</svg>`;
  }

  // ---- voice (optional, defensive about shape) ----
  let voice = null;
  if (voicePath) { try { voice = JSON.parse(fs.readFileSync(voicePath, 'utf8')); } catch (e) { console.error('warn: could not read voice.json:', e.message); } }
  const asList = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
  const voiceDo = voice ? asList(voice.do || voice.dos || (voice.voice && voice.voice.do)) : [];
  const voiceDont = voice ? asList(voice.dont || voice.donts || voice["don't"] || (voice.voice && voice.voice.dont)) : [];
  const lexRaw = voice ? (voice.lexicon || voice.words || voice.terms || []) : [];
  const lexicon = Array.isArray(lexRaw) ? lexRaw.map((e) => (typeof e === 'string' ? { prefer: e } : e)) : [];
  const voiceTone = voice ? (voice.tone || voice.voice && voice.voice.tone || '') : '';

  // ---------- HTML fragments ----------
  const swatches = colorEntries.map(([k, css]) =>
    `<div class="sw"><div class="chip" style="background:${css}"></div><div class="lbl"><b>${esc(k)}</b><code>${esc(css)}</code></div></div>`
  ).join('\n');

  const fams = fontFamilies.map((f) =>
    `<p class="specimen" style="font-family:${f.stack}"><b>${esc(f.name)}</b> 다람쥐 헌 쳇바퀴 AaBbGg 0123 <code>${esc(f.raw)}</code></p>`
  ).join('\n');
  const ramp = sizeKeys.map((k) => {
    const fsz = dimCss(tokens.fontSize[k]); const lh = tokens.lineHeight && dimCss(tokens.lineHeight[k]);
    return `<p class="ramp" style="font-size:${fsz};line-height:${lh || 'normal'}"><b>${esc(k)}</b> 다람쥐 헌 쳇바퀴 Aa <code>${esc(fsz)}${lh ? ' / ' + esc(lh) : ''}</code></p>`;
  }).join('\n');

  const logoTile = (label, bg, cls) =>
    `<figure class="frame ${cls}" style="background:${bg}"><div class="mark">${logoSvg}</div><figcaption>${esc(label)}</figcaption></figure>`;
  const logos = [
    logoTile('Full color', C.surface, 'full'),
    logoTile('1-color mono', C.card, 'mono'),
    logoTile('Knockout on dark', C.ink, 'knock'),
  ].join('\n');

  let voiceHtml = '';
  if (voice) {
    const col = (title, items, kind) => `<div class="vcol ${kind}"><h3>${title}</h3><ul>${items.length ? items.map((x) => `<li>${esc(x)}</li>`).join('') : '<li class="empty">—</li>'}</ul></div>`;
    const lex = lexicon.length ? `<h2>Lexicon</h2><table class="lex"><thead><tr><th>Prefer</th><th>Avoid</th><th>Note</th></tr></thead><tbody>${lexicon.map((e) => `<tr><td>${esc(e.prefer || e.term || e.use || '')}</td><td>${esc(e.avoid || e.instead || '')}</td><td>${esc(e.note || '')}</td></tr>`).join('')}</tbody></table>` : '';
    voiceHtml = `<section><h2>Voice ${voiceTone ? '— ' + esc(voiceTone) : ''}</h2><div class="vgrid">${col('Do', voiceDo, 'do')}${col("Don't", voiceDont, 'dont')}</div>${lex}</section>`;
  }

  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Brand guidelines — ${esc(name)}</title>
<style>
:root{--ink:${C.ink};--surface:${C.surface};--card:${C.card};--accent:${C.accent};--line:${pick('line', 'oklch(0.205 0.012 275 / 0.12)')}}
*{box-sizing:border-box}
body{font-family:Pretendard,sans-serif;margin:0;padding:24px;background:var(--surface);color:var(--ink);overflow-wrap:anywhere}
header{margin:0 0 8px}
h1{margin:0;font-size:30px;letter-spacing:-0.01em}
.sub{color:var(--ink);opacity:.6;margin:4px 0 0;font-size:14px}
h2{margin:32px 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;opacity:.6}
h3{margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.04em}
section{max-width:1100px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.sw{display:flex;gap:10px;align-items:center;background:var(--card);border-radius:10px;padding:8px;box-shadow:0 1px 2px var(--line)}
.chip{width:48px;height:48px;border-radius:8px;border:1px solid var(--line);flex:none}
.lbl b{display:block;font-size:13px}.lbl code{font-size:11px;opacity:.6}
.specimen{margin:6px 0;font-size:26px}
.specimen code,.ramp code{font-size:12px;opacity:.5;font-weight:400}
.ramp{margin:4px 0}
.logos{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
.frame{margin:0;border-radius:14px;padding:24px;border:1px solid var(--line);display:flex;flex-direction:column;align-items:center;gap:12px}
.frame .mark{width:120px;max-width:60%}
.frame svg{display:block;width:100%;height:auto}
.frame figcaption{font-size:12px;letter-spacing:.04em;opacity:.7}
.mono .mark svg{filter:grayscale(1) brightness(0)}
.knock{color:var(--surface)}
.knock .mark svg{filter:brightness(0) invert(1)}
.knock figcaption{color:var(--surface);opacity:.85}
.vgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
.vcol{background:var(--card);border-radius:12px;padding:16px;border:1px solid var(--line)}
.vcol ul{margin:0;padding-left:18px;line-height:1.7}
.vcol .empty{list-style:none;margin-left:-18px;opacity:.4}
.vcol.do h3{color:var(--accent)}
.lex{width:100%;border-collapse:collapse;font-size:14px}
.lex th,.lex td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line)}
.lex th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;opacity:.6}
img,svg{max-width:100%;height:auto}
</style></head>
<body>
<header><h1>${esc(name)} — Brand guidelines</h1><p class="sub">Generated by brand-book.js from ${esc(path.basename(tokensFile))}${voicePath ? ' + ' + esc(path.basename(voicePath)) : ''}. Self-contained handoff.</p></header>
<section><h2>Palette (${colorEntries.length})</h2><div class="grid">${swatches}</div></section>
<section><h2>Type — families (${fontFamilies.length})</h2>${fams}<h2>Type — scale (${sizeKeys.length})</h2>${ramp}</section>
<section><h2>Logo</h2><div class="logos">${logos}</div></section>
${voiceHtml}
</body></html>`;

  const outFile = path.join(outDir, 'guidelines.html');
  fs.writeFileSync(outFile, html);
  console.log(JSON.stringify({ ok: true, outFile: path.resolve(outFile), colors: colorEntries.length, fonts: fontFamilies.length, sizes: sizeKeys.length, voice: !!voice, logo: !!logoPath }, null, 2));
} catch (e) {
  console.error('FATAL', e.message);
  process.exit(2);
}
