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
const flags = argv.filter((a) => a.startsWith('--'));
const files = argv.filter((a) => !a.startsWith('--'));
const emitTheme = flags.includes('--emit=theme');
if (!files.length) { console.error('usage: node build-tokens.js <default.tokens.json> [brand-*.tokens.json ...] [--emit=theme]'); process.exit(1); }

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

  function colorCss(tok) {
    const ext = tok.$extensions && tok.$extensions['com.detail-page'];
    if (ext && ext.css) return ext.css; // exact round-trip string
    const v = tok.$value;
    if (v && v.colorSpace === 'oklch') {
      const c = v.components.join(' ');
      return `oklch(${c}${v.alpha != null ? ` / ${v.alpha}` : ''})`;
    }
    throw new Error(`color token has neither a css extension nor oklch components`);
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
  const base = flatten(JSON.parse(fs.readFileSync(files[0], 'utf8')), [], []);
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
      const obj = JSON.parse(fs.readFileSync(f, 'utf8'));
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
