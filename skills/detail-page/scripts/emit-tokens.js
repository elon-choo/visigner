// emit-tokens.js — serialize an EXISTING page's design tokens into DTCG tokens.json + a spec.html visualizer.
// No deps (fs+path only). This is the dev/designer HANDOFF artifact, regenerated FROM the page's @theme so it
// can never become a drifting alternate config. OKLCH-native (no hex key; the literal oklch string is kept in
// $extensions). It RESOLVES var() chains (the starter's @theme maps --color-* -> var(--brand-*) -> oklch).
//
// Usage:  node emit-tokens.js <page.html> [out-dir]   (default out-dir = the page's directory)
// Writes: <out>/tokens.json (DTCG) + <out>/spec.html (swatches + type ramp + elevation).

const fs = require('fs');
const path = require('path');

// args: <page.html> [out-dir] [--theme <selector>]   (--theme emits ONE themed handoff; default = :root only, no leak)
const rawArgs = process.argv.slice(2);
let theme = null;
const positional = [];
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (a === '--theme') { theme = rawArgs[++i]; continue; }
  if (a.startsWith('--theme=')) { theme = a.slice('--theme='.length); continue; }
  positional.push(a);
}
const file = positional[0];
if (!file) { console.error('usage: node emit-tokens.js <page.html> [out-dir] [--theme <selector>]'); process.exit(1); }
const outDir = positional[1] || path.dirname(path.resolve(file));
const themeSlug = theme ? theme.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() : null;
const normSel = (s) => String(s).replace(/['"]/g, '').replace(/\s+/g, '').toLowerCase();

try {
  fs.mkdirSync(outDir, { recursive: true });
  const raw = fs.readFileSync(file, 'utf8');
  const css = raw.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');

  // --- parse CSS into selector-scoped blocks so a theme override ([data-theme]/[data-brand]) can't LEAK its
  //     value into the default handoff. The old code flattened every --prop last-wins across all blocks. ---
  function parseBlocks(src) {
    const blocks = [];
    (function walk(start, end) {
      let j = start, buf = '';
      while (j < end) {
        const ch = src[j];
        if (ch === '{') {
          const sel = buf.trim(); buf = '';
          let d = 1, k = j + 1;
          for (; k < end; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) break; } }
          if (/^@(media|supports|layer|container|scope)\b/i.test(sel)) {
            walk(j + 1, k); // at-rule wrapper — descend to its inner selector blocks (e.g. prefers-color-scheme)
          } else {
            const decls = new Map();
            for (const m of src.slice(j + 1, k).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;{}]+);/gi)) decls.set(m[1], m[2].trim());
            blocks.push({ selector: sel, decls });
          }
          j = k + 1; buf = '';
        } else { buf += ch; j++; }
      }
    })(0, src.length);
    return blocks;
  }
  // Parse ONLY <style> contents — <script> JS braces would otherwise desync the CSS block matcher.
  // (Fall back to the whole document when a bare .css file is passed, i.e. no <style> tags.)
  const styleSrc = [...css.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  const blocks = parseBlocks(styleSrc || css);
  // BASE = the always-applied cascade (:root + @theme). Theme-scoped blocks are NOT merged in unless --theme asks.
  const BASE = new Set([':root', '@theme', 'html', ':where(:root)']);
  const defs = new Map();
  for (const b of blocks) if (BASE.has(normSel(b.selector))) for (const [n, v] of b.decls) defs.set(n, v);
  // --theme <selector>: overlay the requested block on top of BASE so var(--brand-*) chains resolve to the THEMED value.
  if (theme) {
    const match = blocks.filter((b) => normSel(b.selector) === normSel(theme));
    if (!match.length) {
      const avail = [...new Set(blocks.map((b) => b.selector))].filter((s) => !BASE.has(normSel(s)) && /\S/.test(s));
      console.error(`FATAL no CSS rule matches selector "${theme}". Available theme selectors: ${avail.join(' | ') || '(none)'}`);
      process.exit(2);
    }
    for (const b of match) for (const [n, v] of b.decls) defs.set(n, v);
  }

  // resolve a value's var(--x[, fallback]) chain to a literal (single-var tokens; guards cycles)
  function resolve(val, seen = new Set()) {
    const m = val && val.match(/^var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([^)]+))?\)$/i);
    if (!m) return val;
    if (seen.has(m[1])) return val; // cycle guard
    seen.add(m[1]);
    if (defs.has(m[1])) return resolve(defs.get(m[1]).trim(), seen);
    return (m[2] || val).trim(); // fallback if the var isn't defined
  }

  const oklchRe = /oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/i;
  function colorToken(rawVal) {
    const v = resolve(rawVal);
    const ok = v.match(oklchRe);
    if (ok) {
      const comp = [parseFloat(ok[1]), parseFloat(ok[2]), parseFloat(ok[3])];
      const tok = { $type: 'color', $value: { colorSpace: 'oklch', components: comp }, $extensions: { 'com.detail-page': { css: v } } };
      if (ok[4] != null) tok.$value.alpha = parseFloat(ok[4]);
      return tok;
    }
    // non-oklch (shouldn't happen in our starter) — keep the literal, mark it for review, NO hex key
    return { $type: 'color', $value: { colorSpace: 'srgb', components: [] }, $extensions: { 'com.detail-page': { css: v, note: 'non-oklch source — review' } } };
  }
  function fontToken(rawVal) {
    const fams = resolve(rawVal).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    return { $type: 'fontFamily', $value: fams };
  }
  function shadowToken(rawVal) { return { $type: 'shadow', $value: resolve(rawVal) }; }
  // scale tokens: keep the literal CSS string in $extensions (round-trip), parse a structured $value for interop
  function dimToken(rawVal) {
    const v = resolve(rawVal).trim();
    const m = v.match(/^(-?[\d.]+)(px|rem|em|%)?$/);
    return { $type: 'dimension', $value: m ? { value: parseFloat(m[1]), unit: m[2] || 'px' } : v, $extensions: { 'com.detail-page': { css: v } } };
  }
  function durToken(rawVal) {
    const v = resolve(rawVal).trim();
    const m = v.match(/^([\d.]+)(ms|s)$/i);
    return { $type: 'duration', $value: m ? { value: parseFloat(m[1]), unit: m[2].toLowerCase() } : v, $extensions: { 'com.detail-page': { css: v } } };
  }
  function easeToken(rawVal) {
    const v = resolve(rawVal).trim();
    const m = v.match(/cubic-bezier\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/i);
    return { $type: 'cubicBezier', $value: m ? [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4])] : v, $extensions: { 'com.detail-page': { css: v } } };
  }

  // enumerate the Tailwind design tokens the page actually exposes (the @theme namespace)
  const tokens = { $description: 'DTCG design tokens serialized from ' + path.basename(file) + (theme ? ` (theme "${theme}")` : ' (:root)') + ' by emit-tokens.js. OKLCH-native; literal CSS in $extensions["com.detail-page"].css. Regenerated from @theme — never hand-edit.', color: {}, font: {}, shadow: {}, space: {}, fontSize: {}, lineHeight: {}, radius: {}, motion: { duration: {}, easing: {} } };
  let nColor = 0, nFont = 0, nShadow = 0, nSpace = 0, nText = 0, nLeading = 0, nRadius = 0, nDur = 0, nEase = 0;
  for (const [name, val] of defs) {
    if (/^--color-/.test(name)) { tokens.color[name.replace('--color-', '')] = colorToken(val); nColor++; }
    else if (/^--font-/.test(name)) { tokens.font[name.replace('--font-', '')] = fontToken(val); nFont++; }
    else if (/^--shadow-/.test(name)) { tokens.shadow[name.replace('--shadow-', '')] = shadowToken(val); nShadow++; }
    else if (/^--space-/.test(name)) { tokens.space[name.replace('--space-', '')] = dimToken(val); nSpace++; }
    else if (/^--text-/.test(name)) { tokens.fontSize[name.replace('--text-', '')] = dimToken(val); nText++; }
    else if (/^--leading-/.test(name)) { tokens.lineHeight[name.replace('--leading-', '')] = dimToken(val); nLeading++; }
    else if (/^--radius-/.test(name)) { tokens.radius[name.replace('--radius-', '')] = dimToken(val); nRadius++; }
    else if (/^--dur-/.test(name)) { tokens.motion.duration[name.replace('--dur-', '')] = durToken(val); nDur++; }
    else if (/^--ease-/.test(name)) { tokens.motion.easing[name.replace('--ease-', '')] = easeToken(val); nEase++; }
  }
  // --theme writes a per-theme filename so multiple themes can land in one out-dir without clobbering the default
  const tokensName = themeSlug ? `tokens.${themeSlug}.json` : 'tokens.json';
  const specName = themeSlug ? `spec.${themeSlug}.html` : 'spec.html';
  fs.writeFileSync(path.join(outDir, tokensName), JSON.stringify(tokens, null, 2));

  // spec.html — one swatch per color, the type families, and the elevation samples
  const sw = Object.entries(tokens.color).map(([k, t]) => {
    const c = t.$extensions['com.detail-page'].css;
    return `<div class="sw"><div class="chip" style="background:${c}"></div><div class="lbl"><b>${k}</b><code>${c}</code></div></div>`;
  }).join('\n');
  const fonts = Object.entries(tokens.font).map(([k, t]) =>
    `<p style="font-family:${t.$value.map((f) => (/[\s]/.test(f) ? `"${f}"` : f)).join(',')};font-size:28px;margin:6px 0"><b>${k}</b> — 다람쥐 헌 쳇바퀴 AaBbGg 0123 <code style="font-size:13px;color:#888">${t.$value.join(', ')}</code></p>`
  ).join('\n');
  const elev = Object.entries(tokens.shadow).map(([k, t]) =>
    `<div style="display:inline-block;width:120px;height:80px;margin:16px;background:#fff;border-radius:10px;box-shadow:${t.$value}"></div><span style="vertical-align:bottom"><b>${k}</b></span>`
  ).join('\n');
  const cssOf = (t) => t.$extensions['com.detail-page'].css;
  const spacing = Object.entries(tokens.space).map(([k, t]) =>
    `<div class="sw"><div style="height:16px;background:#16161a;border-radius:3px;flex:none;width:${cssOf(t)}"></div><div class="lbl"><b>${k}</b><code>${cssOf(t)}</code></div></div>`
  ).join('\n');
  const typeRamp = Object.entries(tokens.fontSize).map(([k, t]) => {
    const fs = cssOf(t); const lhTok = tokens.lineHeight[k]; const lh = lhTok ? cssOf(lhTok) : null;
    return `<p style="margin:4px 0;font-size:${fs};line-height:${lh || 'normal'}"><b>${k}</b> 다람쥐 헌 쳇바퀴 AaBbGg <code style="font-size:12px;color:#888">${fs}${lh ? ` / ${lh}` : ''}</code></p>`;
  }).join('\n');
  const radii = Object.entries(tokens.radius).map(([k, t]) =>
    `<div class="sw"><div style="width:48px;height:48px;background:#e8e8ee;border:1px solid #ccc;flex:none;border-radius:${cssOf(t)}"></div><div class="lbl"><b>${k}</b><code>${cssOf(t)}</code></div></div>`
  ).join('\n');
  const motion = [
    ...Object.entries(tokens.motion.duration).map(([k, t]) => `<li><b>--dur-${k}</b> <code>${cssOf(t)}</code></li>`),
    ...Object.entries(tokens.motion.easing).map(([k, t]) => `<li><b>--ease-${k}</b> <code>${cssOf(t)}</code></li>`),
  ].join('\n');
  const nMotion = nDur + nEase;
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Token spec — ${path.basename(file)}</title>
<style>body{font-family:Pretendard,system-ui,sans-serif;margin:0;padding:24px;background:#fafafa;color:#16161a}
h2{margin:28px 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#666}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.sw{display:flex;gap:10px;align-items:center;background:#fff;border-radius:10px;padding:8px;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.chip{width:48px;height:48px;border-radius:8px;border:1px solid rgba(0,0,0,.1);flex:none}
.lbl b{display:block;font-size:13px}.lbl code{font-size:11px;color:#777}</style></head>
<body><h1 style="margin:0">Design tokens — ${path.basename(file)}</h1>
<h2>Color (${nColor})</h2><div class="grid">${sw}</div>
<h2>Type — families (${nFont})</h2>${fonts}
<h2>Elevation (${nShadow})</h2>${elev}
<h2>Spacing (${nSpace})</h2><div class="grid">${spacing}</div>
<h2>Type — scale (${nText} size · ${nLeading} line-height)</h2>${typeRamp}
<h2>Radius (${nRadius})</h2><div class="grid">${radii}</div>
<h2>Motion (${nMotion})</h2><ul style="line-height:1.9;list-style:none;padding:0">${motion}</ul>
</body></html>`;
  fs.writeFileSync(path.join(outDir, specName), html);

  console.log(JSON.stringify({ ok: true, outDir: path.resolve(outDir), theme: theme || null, outFiles: [tokensName, specName], color: nColor, font: nFont, shadow: nShadow, space: nSpace, fontSize: nText, lineHeight: nLeading, radius: nRadius, motion: nMotion }, null, 2));
} catch (e) {
  console.error('FATAL', e.message);
  process.exit(2);
}
