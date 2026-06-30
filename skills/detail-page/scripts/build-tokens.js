// build-tokens.js — compile DTCG token files into the starter's CSS token layers. No deps (fs+path only).
// The first-party answer to "single source of truth": edit tokens/*.tokens.json, regenerate, no hand-edit drift.
// This is Style Dictionary's role reimplemented in ~150 lines — no npm/eval/network (supply-chain clean).
//
// Usage:
//   node build-tokens.js tokens/brand-default.tokens.json [brand-alt.tokens.json ...]   # prints :root{--brand-*} (+ [data-brand] per extra file)
//   node build-tokens.js tokens/brand-default.tokens.json --emit=theme                  # prints the @theme{ --color-*: var(--brand-*) } block
// CSS goes to STDOUT (pipe/paste it). A one-line JSON summary goes to STDERR. FATAL (exit 2) on alias cycle / missing ref.

const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const flags = [];
const files = [];
let fromTool = null; // --from tokens-studio|style-dictionary : normalize a foreign export into the internal DTCG model
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--from') { fromTool = argv[++i]; continue; }
  if (a.startsWith('--from=')) { fromTool = a.slice('--from='.length); continue; }
  if (a.startsWith('--')) { flags.push(a); continue; }
  files.push(a);
}
const emitTheme = flags.includes('--emit=theme');
const FROM_TOOLS = new Set(['tokens-studio', 'style-dictionary']);
if (fromTool && !FROM_TOOLS.has(fromTool)) { console.error(`usage: --from must be one of ${[...FROM_TOOLS].join('|')} (got "${fromTool}")`); process.exit(1); }
if (!files.length) { console.error('usage: node build-tokens.js <default.tokens.json> [brand-*.tokens.json ...] [--emit=theme] [--from tokens-studio|style-dictionary]'); process.exit(1); }

try {
  // --- flatten a DTCG tree into leaf tokens {path:[...], token} ---
  function flatten(obj, prefix, out) {
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('$')) continue;
      if (v && typeof v === 'object' && '$value' in v) out.push({ path: [...prefix, k], token: v });
      else if (v && typeof v === 'object') flatten(v, [...prefix, k], out);
    }
    return out;
  }
  const isAlias = (tok) => typeof tok.$value === 'string' && /^\{.+\}$/.test(tok.$value);
  const refOf = (tok) => tok.$value.slice(1, -1).split('.'); // "{color.primary.700}" -> ['color','primary','700']
  const key = (p) => p.join('.');
  // --brand-* var name: drop the DEFAULT segment; 'color' group has no infix, others keep the group word
  const brandVar = (p) => '--' + [p[0] === 'color' ? 'brand' : `brand-${p[0]}`, ...p.slice(1).filter((s) => s !== 'DEFAULT')].join('-');
  // tailwind @theme token name: keep the group word (color/font/shadow), drop DEFAULT
  const themeVar = (p) => '--' + [p[0], ...p.slice(1).filter((s) => s !== 'DEFAULT')].join('-');

  // STRUCTURAL SCALE groups (spacing/type/radius/motion) are NOT brand-themeable primitives, so they don't get a
  // --brand-* indirection — they compile to a literal-valued utility var emitted into BOTH the :root and @theme layers.
  // Map a token's group-path PREFIX -> the css var prefix; the leaf key(s) tail along. Longest prefix wins (so
  // motion.duration -> --dur-N, motion.easing -> --ease-X). Add a group here, not a branch per token.
  const SCALE_PREFIX = { 'space': 'space', 'fontSize': 'text', 'lineHeight': 'leading', 'radius': 'radius', 'motion.duration': 'dur', 'motion.easing': 'ease' };
  const scaleSegs = (p) => {
    let best = null;
    for (const g of Object.keys(SCALE_PREFIX)) {
      const segs = g.split('.');
      if (segs.length <= p.length && segs.every((s, i) => p[i] === s) && (!best || segs.length > best.length)) best = segs;
    }
    return best; // matched group segments, or null if p is not a scale token
  };
  const isScale = (p) => scaleSegs(p) !== null;
  const scaleVar = (p) => {
    const segs = scaleSegs(p);
    return '--' + [SCALE_PREFIX[segs.join('.')], ...p.slice(segs.length).filter((s) => s !== 'DEFAULT')].join('-');
  };
  // :root primitive var name for ANY token: scale tokens -> --<prefix>-*, everything else -> --brand-*
  const rootVar = (p) => (isScale(p) ? scaleVar(p) : brandVar(p));

  // --- sRGB-hex / rgb() / DTCG {colorSpace:srgb} → oklch() normalizer (no deps) ---
  // Real-world Tokens Studio / Style Dictionary exports ship hex/sRGB $values; convert them so the OKLCH-only
  // CSS layer compiles. Math: sRGB → linear → OKLab (Björn Ottosson) → OKLCH. L,C kept ~4dp, H ~2dp.
  const round = (x, n) => { const f = 10 ** n; return Math.round(x * f) / f; };
  function rgbToOklchCss(r, g, b, a) {
    const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const R = lin(r), G = lin(g), B = lin(b);
    const l = 0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B;
    const m = 0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B;
    const s = 0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B;
    const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
    const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
    const A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
    const Bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
    let C = Math.sqrt(A * A + Bb * Bb);
    let H = (Math.atan2(Bb, A) * 180) / Math.PI; if (H < 0) H += 360;
    if (C < 1e-4) { C = 0; H = 0; } // achromatic → drop noisy hue
    return `oklch(${round(L, 4)} ${round(C, 4)} ${round(H, 2)}${a != null && a !== 1 ? ` / ${round(a, 4)}` : ''})`;
  }
  function srgbToOklchCss(v) {
    let r, g, b, a = null, mm;
    if (typeof v === 'string') {
      const s = v.trim();
      if ((mm = s.match(/^#([0-9a-f]{3,8})$/i))) {
        let h = mm[1];
        if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
        if (h.length !== 6 && h.length !== 8) return null;
        r = parseInt(h.slice(0, 2), 16) / 255; g = parseInt(h.slice(2, 4), 16) / 255; b = parseInt(h.slice(4, 6), 16) / 255;
        if (h.length === 8) a = parseInt(h.slice(6, 8), 16) / 255;
      } else if ((mm = s.match(/^rgba?\(\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i))) {
        const chan = (x) => (x.endsWith('%') ? parseFloat(x) / 100 : parseFloat(x) / 255);
        r = chan(mm[1]); g = chan(mm[2]); b = chan(mm[3]);
        if (mm[4] != null) a = mm[4].endsWith('%') ? parseFloat(mm[4]) / 100 : parseFloat(mm[4]);
      } else return null;
    } else if (v && typeof v === 'object' && (v.colorSpace === 'srgb' || v.colorSpace === 'rgb') && Array.isArray(v.components) && v.components.length === 3) {
      [r, g, b] = v.components; // DTCG sRGB components are 0..1
      if (v.alpha != null) a = v.alpha;
    } else return null;
    return rgbToOklchCss(r, g, b, a);
  }

  // --- --from adapter: normalize a Tokens Studio / Style Dictionary export into our internal DTCG model ---
  // Both tools commonly emit `value`/`type` (no `$`); Style Dictionary refs end in `.value` ({a.b.value}). Map them
  // to `$value`/`$type` and strip the trailing `.value` so flatten()/alias-resolution see the native shape unchanged.
  function adaptFrom(node) {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) return node;
    const hasVal = '$value' in node || 'value' in node;
    if (hasVal) {
      const tok = {};
      let val = '$value' in node ? node.$value : node.value;
      if (typeof val === 'string') val = val.replace(/\{([^}]+)\}/g, (_m, ref) => '{' + ref.replace(/\.value$/, '') + '}');
      tok.$value = val;
      const t = node.$type != null ? node.$type : node.type;
      if (t != null) tok.$type = t;
      // Style Dictionary often omits type — infer `color` from a hex/rgb/oklch/hsl literal so colorCss can normalize it
      else if (typeof tok.$value === 'string' && /^#[0-9a-f]{3,8}$|^rgba?\(|^oklch\(|^hsla?\(/i.test(tok.$value)) tok.$type = 'color';
      if (node.$extensions) tok.$extensions = node.$extensions;
      const d = node.$description != null ? node.$description : node.description;
      if (d != null) tok.$description = d;
      return tok;
    }
    const out = {};
    for (const [k, val] of Object.entries(node)) {
      if (k === 'type' || k === 'value' || k === 'description') continue; // group-level metadata of foreign shape
      out[k] = k.startsWith('$') ? val : adaptFrom(val);
    }
    return out;
  }
  const readTokens = (f) => { const raw = JSON.parse(fs.readFileSync(f, 'utf8')); return fromTool ? adaptFrom(raw) : raw; };

  function colorCss(tok) {
    const ext = tok.$extensions && tok.$extensions['com.detail-page'];
    if (ext && ext.css) return ext.css; // exact round-trip string
    const v = tok.$value;
    if (v && v.colorSpace === 'oklch') {
      const c = v.components.join(' ');
      return `oklch(${c}${v.alpha != null ? ` / ${v.alpha}` : ''})`;
    }
    // sRGB hex / rgb() / {colorSpace:srgb} (Tokens Studio / Style Dictionary exports) → normalize to oklch()
    const norm = srgbToOklchCss(v);
    if (norm) return norm;
    throw new Error(`color token has neither a css extension nor oklch/sRGB-hex components`);
  }
  function fontCss(arr) {
    const generic = new Set(['sans-serif', 'serif', 'monospace', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'cursive']);
    return arr.map((f) => (generic.has(f) ? f : `"${f}"`)).join(', ');
  }
  function leafValue(tok) {
    if (tok.$type === 'color') return colorCss(tok);
    if (tok.$type === 'fontFamily') return fontCss(tok.$value);
    // dimension/duration/cubicBezier (and any future type) carry the exact CSS string in the extension for round-trip
    const ext = tok.$extensions && tok.$extensions['com.detail-page'];
    if (ext && ext.css) return ext.css;
    if (tok.$type === 'shadow') return String(tok.$value); // raw composite string
    return String(tok.$value);
  }

  // --- validate aliases across the DEFAULT (first) file: resolvable + acyclic ---
  const base = flatten(readTokens(files[0]), [], []);
  const byPath = new Map(base.map((t) => [key(t.path), t]));
  for (const t of base) {
    if (!isAlias(t.token)) continue;
    const seen = new Set([key(t.path)]);
    let cur = t.token;
    while (isAlias(cur)) {
      const rp = key(refOf(cur));
      if (!byPath.has(rp)) throw new Error(`unresolved token reference {${rp}} from {${key(t.path)}}`);
      if (seen.has(rp)) throw new Error(`alias cycle detected at {${rp}}`);
      seen.add(rp);
      cur = byPath.get(rp).token;
    }
  }

  // --- emit ---
  const lines = [];
  const decl = (name, val) => `  ${name}: ${val};`;
  let emittedCount = 0;

  if (emitTheme) {
    lines.push('@theme {');
    lines.push('  /* generated by build-tokens.js — maps each Tailwind token to its --brand-* primitive */');
    for (const t of base) {
      if (isScale(t.path)) {
        // scale tokens have no --brand-* primitive — emit the literal value straight into @theme (Tailwind-native namespace)
        lines.push(decl(scaleVar(t.path), leafValue(t.token)));
      } else {
        // :root defines --brand-<path> for every themed token (alias or not), so the @theme map always points there
        lines.push(decl(themeVar(t.path), `var(${brandVar(t.path)})`));
      }
      emittedCount++;
    }
    lines.push('}');
  } else {
    // :root from the DEFAULT file
    lines.push(':root {');
    lines.push('  /* generated by build-tokens.js from ' + path.basename(files[0]) + ' — do not hand-edit; edit the .tokens.json */');
    for (const t of base) {
      const val = isAlias(t.token) ? `var(${rootVar(refOf(t.token))})` : leafValue(t.token);
      lines.push(decl(rootVar(t.path), val));
      emittedCount++;
    }
    lines.push('}');
    // each EXTRA file -> a [data-brand="<name>"] override block (only the tokens it defines)
    for (const f of files.slice(1)) {
      const obj = readTokens(f);
      const brand = obj.$brand || path.basename(f).replace(/\.tokens\.json$/, '').replace(/^brand-/, '');
      const leaves = flatten(obj, [], []);
      lines.push(`[data-brand="${brand}"] {`);
      for (const t of leaves) {
        const val = isAlias(t.token) ? `var(${rootVar(refOf(t.token))})` : leafValue(t.token);
        lines.push(decl(rootVar(t.path), val));
        emittedCount++;
      }
      lines.push('}');
    }
  }

  process.stdout.write(lines.join('\n') + '\n');
  console.error(JSON.stringify({ ok: true, mode: emitTheme ? 'theme' : 'root', files, declarations: emittedCount }));
} catch (e) {
  console.error('FATAL', e.message);
  process.exit(2);
}
