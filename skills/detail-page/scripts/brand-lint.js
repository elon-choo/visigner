// brand-lint.js — deterministic brand-governance linter for a detail page OR a whole source tree.
// No deps (Node fs + regex only). Promotes review-rubric §A bans from "LLM self-graded" into a
// machine check so quality doesn't depend on the grader's mood. Off-by-default (nothing imports it yet).
//
// Usage:   node brand-lint.js <page.html>  [out.json]      # SINGLE-FILE mode (HTML; backward-compatible)
//          node brand-lint.js <dir/>       [out.json]      # DIR / SOURCE-TREE mode (recursive)
// Output:  SINGLE-FILE → { pass, errorCount, warnCount, violations:[{rule,where,snippet,severity}], tokenCoverage, file }
//          DIR         → { pass, errorCount, warnCount, files:[{file,errorCount,warnCount,violations,tokenCoverage}], totals }
//          (default out path: <file-dir>/brand-lint.json for a file, <dir>/brand-lint.json for a directory)
// Exit:    non-zero ONLY when an error-severity violation is found (warnings never fail the gate).
//
// DIR mode recursively scans **/*.{html,htm,tsx,jsx,ts,js,css,scss,vue,svelte,astro} (skips
// node_modules/.git/dist/build), runs the color/font checks per file, and aggregates one report.
//
// ERROR rules (unambiguous bans): raw-hex / raw-rgb / raw-hsl color OUTSIDE @theme/:root · banned-font
//   (Inter/Roboto/Arial/Open Sans/Lato/system-ui) · ai-purple (a color at OKLCH hue 270-310 AND
//   chroma>0.04 — the chroma floor is REQUIRED so the starter's gray neutrals at hue ~275 / chroma
//   ~0.012 do NOT flag). In component source (.tsx/.jsx/.ts/.js/.vue/.svelte/.astro) and .css/.scss the
//   @theme/:root allowance applies ONLY inside an actual @theme{}/:root{} block — any quoted/inline
//   hex/rgb/hsl in a className/style/styled-components template, JS string, or a CSS value OUTSIDE such a
//   block is a raw-color error.
// WARN rules (judgement calls a linter can't fully resolve): emoji-as-icon · tailwind-arbitrary-bracket.
// OFF by default (BRAND_LINT_PX=1 to enable): spacing-px-off-grid — the starter intentionally uses px in
//   clamp()/font-size/radius/min-height and a 10px buybar pad, so this is opt-in to avoid noise.

const fs = require('fs');
const path = require('path');

const BANNED_FONT = /\b(Inter|Roboto|Arial|Open\s+Sans|Lato|system-ui)\b/i;
const EMOJI = /[⌚-⌛☀-➿⬅-⬇⬛⬜⭐⭕️\u{1F000}-\u{1FAFF}]/u;
const SOURCE_EXTS = new Set(['.html', '.htm', '.tsx', '.jsx', '.ts', '.js', '.css', '.scss', '.vue', '.svelte', '.astro']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage']);

// --- GOVERNANCE (source/dir mode) — spacing utilities that take an arbitrary px bracket and the hand-picked
// type scale. Arbitrary spacing off the 4px grid (mt-[13px]) and arbitrary font-size off the scale
// (text-[15px]) are promoted from warn → ERROR in component/source files.
const SPACING_PREFIX = /^(?:m[trblxy]?|p[trblxy]?|gap(?:-[xy])?|space-[xy])$/;
const TYPE_SCALE = new Set([12, 14, 16, 18, 20, 24, 30, 36, 48, 64]);
// ALLOW_PURPLE=1 — "earned purple" override: a brand whose identity is legitimately purple opts out of the
// ai-purple gate (the OKLCH hue 270-310 / chroma>0.04 ban). Off by default; default behavior unchanged.
const ALLOW_PURPLE = process.env.ALLOW_PURPLE === '1';
// SEMANTIC BRAND mode ΔE tolerance (OKLab distance). Override with BRAND_LINT_DELTAE.
const BRAND_DELTAE = parseFloat(process.env.BRAND_LINT_DELTAE || '0.02');

const mkAdd = (violations) => (rule, where, snippet, severity) =>
  violations.push({ rule, where, snippet: String(snippet).replace(/\s+/g, ' ').trim().slice(0, 90), severity });

// --- brace-matched block locator: returns [[start,end], ...] for each `headRe` match's { ... } ---
function braceBlocks(text, headRe) {
  const blocks = [];
  for (const m of text.matchAll(headRe)) {
    const open = m.index + m[0].length - 1;
    let depth = 0;
    for (let i = open; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') { depth--; if (depth === 0) { blocks.push([m.index, i + 1]); break; } }
    }
  }
  return blocks;
}

// ============================================================================
// SEMANTIC BRAND mode (opt-in via --brand) — statically diff the page's DECLARED token colors against the
// brand.tokens.json SEMANTIC roles in OKLCH/OKLab. Catches "tokenized-but-off-brand": a page can pass the
// raw-hex gate while declaring the WRONG teal in its own :root/@theme. Also: logo min-size + lexicon copy.
// ============================================================================

// parse an `oklch(L C H[ / a])` string → {L,C,H} (L normalized to 0-1 if given as %). null if not oklch.
function parseOklch(str) {
  const m = String(str).match(/oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/i);
  if (!m) return null;
  let L = parseFloat(m[1]); if (m[2] === '%') L /= 100;
  return { L, C: parseFloat(m[3]), H: parseFloat(m[4]) };
}

// OKLab ΔE between two OKLCH colors (hue→a/b so a 30° teal shift reads as a real distance).
function deltaE(a, b) {
  const ar = (a.H * Math.PI) / 180, brad = (b.H * Math.PI) / 180;
  const aa = a.C * Math.cos(ar), ab = a.C * Math.sin(ar);
  const ba = b.C * Math.cos(brad), bb = b.C * Math.sin(brad);
  return Math.sqrt((a.L - b.L) ** 2 + (aa - ba) ** 2 + (ab - bb) ** 2);
}

// flatten a DTCG brand.tokens.json `color` tree → { "primary-700": {L,C,H}, "surface": {...}, ... }.
// Aliases ($value is a "{ref}" string) and non-OKLCH values are skipped (can't be diffed numerically).
function flattenBrandColors(tokens) {
  const roles = {};
  const rec = (obj, prefix) => {
    for (const [k, v] of Object.entries(obj || {})) {
      if (k.startsWith('$') || v == null || typeof v !== 'object') continue;
      const name = (prefix ? `${prefix}-${k}` : k).toLowerCase();
      if (v.$type === 'color') {
        const css = v.$extensions && v.$extensions['com.detail-page'] && v.$extensions['com.detail-page'].css;
        let ok = css ? parseOklch(css) : null;
        if (!ok && v.$value && v.$value.colorSpace === 'oklch' && Array.isArray(v.$value.components)) {
          const c = v.$value.components; ok = { L: c[0], C: c[1], H: c[2] };
        }
        if (ok) roles[name] = ok;
      } else if (!v.$type) {
        rec(v, name);
      }
    }
  };
  rec(tokens.color, '');
  return roles;
}

// extract the page's DECLARED token colors: --brand-*/--color-* whose value is a literal oklch(),
// scanned ONLY inside :root{}/@theme{} blocks. Returns { name: {L,C,H} } keyed by role (prefix stripped).
function extractDeclaredColors(stripped) {
  const decls = {};
  const blocks = braceBlocks(stripped, /(?:@theme|:root)[^{]*\{/g);
  for (const [s, e] of blocks) {
    for (const m of stripped.slice(s, e).matchAll(/--(?:brand|color)-([a-z0-9-]+)\s*:\s*(oklch\([^;}]+)/gi)) {
      const name = m[1].toLowerCase();
      const ok = parseOklch(m[2]);
      if (ok && !decls[name]) decls[name] = ok; // first literal wins (the --brand-* primitive layer)
    }
  }
  return decls;
}

// strip tags/script/style/comments → visible copy (for lexicon grep).
function visibleText(raw) {
  return raw
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// pull a numeric px dimension (attr="NN" or style:width:NNpx) out of a tag string. null if absent.
function tagDim(tag, attr) {
  let m = tag.match(new RegExp(`\\b${attr}\\s*=\\s*["']?\\s*(\\d+(?:\\.\\d+)?)`, 'i'));
  if (m) return parseFloat(m[1]);
  m = tag.match(new RegExp(`${attr}\\s*:\\s*(\\d+(?:\\.\\d+)?)px`, 'i'));
  return m ? parseFloat(m[1]) : null;
}

// The on-brand check. brandTokens = parsed brand.tokens.json; lexicon = {banned:[],owned:[]} | null.
// Returns { onBrand, evidence, violations }. Off-brand color and banned term are ERROR (gate teeth);
// logo-undersize and missing-owned-term are WARN (judgement). Emits NO violations on a fully matching page.
function brandCheck(raw, brandTokens, lexicon) {
  const violations = [];
  const add = mkAdd(violations);
  const stripped = raw
    .replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));

  // (1) colors: declared vs semantic role within ΔE
  const roles = flattenBrandColors(brandTokens);
  const declared = extractDeclaredColors(stripped);
  let checked = 0;
  const off = [];
  for (const [name, col] of Object.entries(declared)) {
    const role = roles[name];
    if (!role) continue; // page var with no matching semantic role — can't judge
    checked++;
    const dE = deltaE(col, role);
    if (dE > BRAND_DELTAE) {
      off.push({ name, dE });
      add('off-brand-color', 'declared token', `--${name} ΔE${dE.toFixed(3)} > ${BRAND_DELTAE} vs role ${name}`, 'error');
    }
  }

  // (2) logo min-size guideline (optional). brandTokens.logo = { minWidth, minHeight } (px).
  const logoGuide = brandTokens.logo || (brandTokens.$extensions && brandTokens.$extensions['com.detail-page'] && brandTokens.$extensions['com.detail-page'].logo);
  const logoIssues = [];
  let logoChecked = false;
  if (logoGuide) {
    for (const m of raw.matchAll(/<(?:img|svg)\b[^>]*\blogo\b[^>]*>/gi)) {
      logoChecked = true;
      const tag = m[0];
      const w = tagDim(tag, 'width'), h = tagDim(tag, 'height');
      if (logoGuide.minWidth != null && w != null && w < logoGuide.minWidth) logoIssues.push(`w ${w}px<${logoGuide.minWidth}px`);
      if (logoGuide.minHeight != null && h != null && h < logoGuide.minHeight) logoIssues.push(`h ${h}px<${logoGuide.minHeight}px`);
      if (logoGuide.minWidth != null && w == null && h == null) logoIssues.push('no declared dimensions');
    }
    for (const iss of logoIssues) add('logo-undersize', 'logo element', iss, 'warn');
  }

  // (3) lexicon: banned terms present (ERROR) + owned terms missing (WARN)
  let bannedHits = [], ownedPresent = 0, ownedTotal = 0;
  if (lexicon) {
    const copy = visibleText(raw).toLowerCase();
    for (const term of (lexicon.banned || [])) {
      if (copy.includes(String(term).toLowerCase())) { bannedHits.push(term); add('banned-term', 'visible copy', `"${term}"`, 'error'); }
    }
    const owned = lexicon.owned || [];
    ownedTotal = owned.length;
    for (const term of owned) {
      if (copy.includes(String(term).toLowerCase())) ownedPresent++;
      else add('missing-owned-term', 'visible copy', `"${term}" not found`, 'warn');
    }
  }

  const onBrand = off.length === 0 && bannedHits.length === 0 && logoIssues.length === 0;
  const parts = [];
  parts.push(`${checked - off.length}/${checked} declared colors within ΔE ${BRAND_DELTAE} of brand roles`);
  if (off.length) parts.push(`OFF: ${off.map((o) => `--${o.name} ΔE${o.dE.toFixed(3)}`).join(', ')}`);
  if (lexicon) parts.push(`${bannedHits.length} banned${bannedHits.length ? ` ("${bannedHits.join('", "')}")` : ''}; owned ${ownedPresent}/${ownedTotal}`);
  if (logoGuide) parts.push(logoChecked ? (logoIssues.length ? `logo ${logoIssues.join(', ')}` : 'logo ok') : 'no logo found');
  return { onBrand, evidence: parts.join('; '), violations };
}

// ============================================================================
// HTML linter — preserves the original single-file behavior EXACTLY (byte-for-byte report).
// ============================================================================
function lintHtml(raw, file) {
  const violations = [];
  const add = mkAdd(violations);

  // Strip HTML *and* CSS comments first — comments (the "NOT Inter" warning, example hexes, and prose that
  // mentions "@theme") must never be linted. Critically, a CSS comment containing the word "@theme" would
  // otherwise make the @theme-block locator below mis-match and mask the wrong region (e.g. all of :root).
  const stripped = raw
    .replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));

  // --- locate @theme { ... } blocks (brace-matched) so raw-color scan can exclude them ---
  const themeBlocks = braceBlocks(stripped, /@theme[^{]*\{/g);
  // collect the token allowlist (--color-*/--font-*/--shadow-*) defined in @theme
  const tokenNames = new Set();
  for (const [s, e] of themeBlocks) {
    for (const tm of stripped.slice(s, e).matchAll(/(--(?:color|font|shadow)-[a-z0-9-]+)\s*:/gi)) tokenNames.add(tm[1]);
  }
  // masked copy with @theme spans blanked (same length) — used for the "outside @theme" raw-color scan
  let masked = stripped;
  for (const [s, e] of themeBlocks) masked = masked.slice(0, s) + ' '.repeat(e - s) + masked.slice(e);

  // gather CSS that lives OUTSIDE @theme: <style> block bodies (masked) + inline style="" attrs
  const cssChunks = [];
  for (const m of masked.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) cssChunks.push(m[1]);
  for (const m of masked.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)) cssChunks.push(m[1]);
  for (const m of masked.matchAll(/\sstyle\s*=\s*'([^']*)'/gi)) cssChunks.push(m[1]);
  const cssOutside = cssChunks.join('\n;\n');
  let rawColorCount = 0;

  // (a) raw hex / rgb / hsl OUTSIDE @theme — the single token source is violated
  for (const m of cssOutside.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) { add('raw-hex', 'css outside @theme', m[0], 'error'); rawColorCount++; }
  for (const m of cssOutside.matchAll(/\brgba?\(/gi)) { add('raw-rgb', 'css outside @theme', cssOutside.slice(m.index, m.index + 24), 'error'); rawColorCount++; }
  for (const m of cssOutside.matchAll(/\bhsla?\(/gi)) { add('raw-hsl', 'css outside @theme', cssOutside.slice(m.index, m.index + 24), 'error'); rawColorCount++; }

  // (b) banned font families — scan font-family / --font-* values + font CDN link hrefs (full HTML, incl @theme)
  const fontValues = [];
  for (const m of stripped.matchAll(/font-family\s*:\s*([^;}"']+)/gi)) fontValues.push(m[1]);
  // scan BOTH the Tailwind --font-* tokens AND the --brand-font-* primitives (post-@theme-inline refactor the
  // real font NAMES live in --brand-font-*; --font-* there is just var(--brand-font-*)).
  for (const m of stripped.matchAll(/--(?:brand-)?font-[a-z0-9-]+\s*:\s*([^;}]+)/gi)) fontValues.push(m[1]);
  for (const m of stripped.matchAll(/<link[^>]+href\s*=\s*"([^"]*(?:fonts\.googleapis|api\.fontshare|fonts)[^"]*)"/gi)) fontValues.push(m[1]);
  for (const v of fontValues) { const b = v.match(BANNED_FONT); if (b) add('banned-font', 'font declaration', `${b[1]} in "${v.trim().slice(0, 60)}"`, 'error'); }

  // (c) AI-purple: any OKLCH color at hue 270-310 AND chroma>0.04 (chroma floor protects gray neutrals)
  for (const m of stripped.matchAll(/oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/gi)) {
    const chroma = parseFloat(m[2]), hue = parseFloat(m[3]);
    if (!ALLOW_PURPLE && hue >= 270 && hue <= 310 && chroma > 0.04) add('ai-purple', 'oklch color', `${m[0]}) hue${hue} c${chroma}`, 'error');
  }

  // (d) emoji used as content — WARN (a linter can't reliably tell icon-use from copy-use)
  if (EMOJI.test(stripped)) {
    const hit = stripped.match(EMOJI);
    add('emoji', 'document', `emoji present (${hit && hit[0]}) — confirm it is copy, not an icon/bullet (banned as icon)`, 'warn');
  }

  // (e) Tailwind arbitrary-value brackets in class="" — bypass the token system — WARN
  for (const m of masked.matchAll(/\sclass\s*=\s*"([^"]*)"/gi)) {
    const bm = m[1].match(/[a-z0-9]+-\[[^\]]+\]/i);
    if (bm) add('tailwind-arbitrary', 'class attribute', bm[0], 'warn');
  }

  // (f) OPT-IN: spacing px off the 4px grid (margin/padding/gap only)
  if (process.env.BRAND_LINT_PX === '1') {
    for (const m of cssOutside.matchAll(/\b(margin|padding|gap)[a-z-]*\s*:\s*([^;}]+)/gi)) {
      for (const px of m[2].matchAll(/(\d+)px/g)) { const n = +px[1]; if (n % 4 !== 0) add('px-off-grid', m[1], `${n}px in ${m[1]}`, 'warn'); }
    }
  }

  return { violations, tokenCoverage: { definedTokens: tokenNames.size, rawColorsOutsideTheme: rawColorCount } };
}

// ============================================================================
// SOURCE linter — .css/.scss + component source (.tsx/.jsx/.ts/.js/.vue/.svelte/.astro).
// The @theme/:root token-block allowance applies ONLY inside a real @theme{}/:root{} block; any quoted or
// inline hex/rgb/hsl elsewhere (className, style object, styled-components template, JS string, CSS value)
// is a raw-color error.
// ============================================================================
function lintSource(raw, file) {
  const violations = [];
  const add = mkAdd(violations);

  // Strip comments that must never be linted: HTML comments, CSS/JS block comments, and JS/TS line comments.
  // The line-comment strip deliberately skips `://` so URLs (http://, https://) inside strings survive.
  const stripped = raw
    .replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));

  // Token-definition blocks: @theme { ... } AND :root { ... } (brace-matched) are the ONLY allowed homes for
  // raw color values. Everything else is component/markup territory.
  const tokenBlocks = braceBlocks(stripped, /(?:@theme|:root)[^{]*\{/g);
  const tokenNames = new Set();
  for (const [s, e] of tokenBlocks) {
    for (const tm of stripped.slice(s, e).matchAll(/(--(?:color|font|shadow)-[a-z0-9-]+)\s*:/gi)) tokenNames.add(tm[1]);
  }
  let masked = stripped;
  for (const [s, e] of tokenBlocks) masked = masked.slice(0, s) + ' '.repeat(e - s) + masked.slice(e);

  let rawColorCount = 0;
  // (a) raw hex / rgb / hsl anywhere OUTSIDE a @theme/:root token block — covers className/style props,
  //     styled-components templates, JS string literals, and plain CSS/SCSS values alike.
  for (const m of masked.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) { add('raw-hex', 'source outside @theme/:root', m[0], 'error'); rawColorCount++; }
  for (const m of masked.matchAll(/\brgba?\(/gi)) { add('raw-rgb', 'source outside @theme/:root', masked.slice(m.index, m.index + 24), 'error'); rawColorCount++; }
  for (const m of masked.matchAll(/\bhsla?\(/gi)) { add('raw-hsl', 'source outside @theme/:root', masked.slice(m.index, m.index + 24), 'error'); rawColorCount++; }

  // (b) banned font families — CSS font-family, JS/JSX fontFamily, --font-* tokens, font CDN hrefs.
  const fontValues = [];
  for (const m of stripped.matchAll(/font-family\s*:\s*([^;}"'\n]+)/gi)) fontValues.push(m[1]);
  for (const m of stripped.matchAll(/fontFamily\s*:\s*([^,;}\n]+)/gi)) fontValues.push(m[1]);
  for (const m of stripped.matchAll(/--(?:brand-)?font-[a-z0-9-]+\s*:\s*([^;}]+)/gi)) fontValues.push(m[1]);
  for (const m of stripped.matchAll(/<link[^>]+href\s*=\s*"([^"]*(?:fonts\.googleapis|api\.fontshare|fonts)[^"]*)"/gi)) fontValues.push(m[1]);
  for (const v of fontValues) { const b = v.match(BANNED_FONT); if (b) add('banned-font', 'font declaration', `${b[1]} in "${v.trim().slice(0, 60)}"`, 'error'); }

  // (c) AI-purple: OKLCH at hue 270-310 AND chroma>0.04 (oklch() itself is the allowed token format).
  for (const m of stripped.matchAll(/oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/gi)) {
    const chroma = parseFloat(m[2]), hue = parseFloat(m[3]);
    if (!ALLOW_PURPLE && hue >= 270 && hue <= 310 && chroma > 0.04) add('ai-purple', 'oklch color', `${m[0]}) hue${hue} c${chroma}`, 'error');
  }

  // (d) emoji-as-icon — WARN
  if (EMOJI.test(stripped)) {
    const hit = stripped.match(EMOJI);
    add('emoji', 'document', `emoji present (${hit && hit[0]}) — confirm it is copy, not an icon/bullet (banned as icon)`, 'warn');
  }

  // (e) Tailwind arbitrary-value brackets in class/className. GOVERNANCE promotion: an arbitrary SPACING
  //     bracket off the 4px grid (mt-[13px], p-[7px]) and an arbitrary font-size off the type scale
  //     (text-[15px]) are ERRORs; every other arbitrary bracket stays a WARN (one per class, as before).
  for (const m of masked.matchAll(/\sclass(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/gi)) {
    const cls = m[1] || m[2] || m[3] || '';
    let warned = false;
    for (const bm of cls.matchAll(/(-?[a-z][a-z0-9]*(?:-[a-z]+)?)-\[([^\]]+)\]/gi)) {
      const prefix = bm[1].replace(/^-/, '');
      const pxm = bm[2].match(/^(\d+(?:\.\d+)?)px$/);
      if (SPACING_PREFIX.test(prefix) && pxm && Number(pxm[1]) % 4 !== 0) {
        add('spacing-arbitrary-off-grid', 'class attribute', bm[0], 'error');
      } else if (prefix === 'text' && pxm && !TYPE_SCALE.has(Number(pxm[1]))) {
        add('type-scale-arbitrary', 'class attribute', bm[0], 'error');
      } else if (!warned) {
        add('tailwind-arbitrary', 'class attribute', bm[0], 'warn');
        warned = true;
      }
    }
  }

  // (f) GOVERNANCE: a component referencing a --brand-* PRIMITIVE directly (outside a :root/@theme block,
  //     which is masked above) — components must consume the SEMANTIC --color-* tokens, not raw primitives.
  for (const m of masked.matchAll(/var\(\s*(--brand-[a-z0-9-]+)/gi)) {
    add('brand-primitive-ref', 'source outside @theme/:root', `${m[1]} (use semantic --color-*)`, 'error');
  }

  return { violations, tokenCoverage: { definedTokens: tokenNames.size, rawColorsOutsideTheme: rawColorCount } };
}

// pick the right linter by extension
function lintByExt(raw, file) {
  const ext = path.extname(file).toLowerCase();
  return (ext === '.html' || ext === '.htm') ? lintHtml(raw, file) : lintSource(raw, file);
}

// recursively collect lintable source files (skip noise dirs)
function collectFiles(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectFiles(full, acc);
    } else if (entry.isFile() && SOURCE_EXTS.has(path.extname(entry.name).toLowerCase())) {
      acc.push(full);
    }
  }
  return acc;
}

// parse argv into positionals + flags so `[out.json]` stays positional and --brand/--lexicon are additive.
function parseArgs(argv) {
  const positionals = [], flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--brand') flags.brand = argv[++i];
    else if (a === '--lexicon') flags.lexicon = argv[++i];
    else positionals.push(a);
  }
  return { positionals, flags };
}

try {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  const target = positionals[0];
  if (!target) { console.error('usage: node brand-lint.js <page.html|dir> [out.json] [--brand brand.tokens.json] [--lexicon voice.json]'); process.exit(1); }
  // SEMANTIC BRAND mode is opt-in: load token/lexicon files only when --brand is passed.
  let brandTokens = null, lexicon = null;
  if (flags.brand) {
    brandTokens = JSON.parse(fs.readFileSync(flags.brand, 'utf8'));
    if (flags.lexicon) lexicon = JSON.parse(fs.readFileSync(flags.lexicon, 'utf8'));
  }
  const st = fs.statSync(target);

  if (st.isDirectory()) {
    // ---------- DIR / source-tree mode ----------
    const root = path.resolve(target);
    const outPath = positionals[1] || path.join(root, 'brand-lint.json');
    if (flags.brand) console.error('note: --brand (SEMANTIC BRAND mode) applies to a single page file; ignored in dir mode.');
    const files = collectFiles(root, []).sort();
    const fileReports = [];
    let errorCount = 0, warnCount = 0, rawColorsTotal = 0, definedTokensTotal = 0;

    for (const f of files) {
      const raw = fs.readFileSync(f, 'utf8');
      const { violations, tokenCoverage } = lintByExt(raw, f);
      const fe = violations.filter((v) => v.severity === 'error').length;
      const fw = violations.filter((v) => v.severity === 'warn').length;
      errorCount += fe; warnCount += fw;
      rawColorsTotal += tokenCoverage.rawColorsOutsideTheme;
      definedTokensTotal += tokenCoverage.definedTokens;
      fileReports.push({ file: path.relative(root, f), errorCount: fe, warnCount: fw, violations, tokenCoverage });
    }

    const report = {
      pass: errorCount === 0,
      errorCount,
      warnCount,
      files: fileReports,
      totals: {
        filesScanned: files.length,
        filesWithErrors: fileReports.filter((r) => r.errorCount > 0).length,
        errorCount,
        warnCount,
        rawColorsOutsideTheme: rawColorsTotal,
        definedTokens: definedTokensTotal,
      },
      root,
    };
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({
      pass: report.pass, errorCount, warnCount,
      filesScanned: files.length, filesWithErrors: report.totals.filesWithErrors, outPath,
    }, null, 2));
    process.exit(errorCount === 0 ? 0 : 1);
  }

  // ---------- SINGLE-FILE mode (backward-compatible) ----------
  const raw = fs.readFileSync(target, 'utf8');
  const outPath = positionals[1] || path.join(path.dirname(path.resolve(target)), 'brand-lint.json');
  const { violations, tokenCoverage } = lintByExt(raw, target);

  // SEMANTIC BRAND mode (opt-in): diff declared colors vs brand roles, check logo + lexicon, emit one line.
  // Off-brand colors / banned terms are added to the SAME violations list so they count toward the gate.
  let brand = null;
  if (brandTokens) {
    const r = brandCheck(raw, brandTokens, lexicon);
    for (const v of r.violations) violations.push(v);
    brand = { onBrand: r.onBrand, evidence: r.evidence };
  }

  const errorCount = violations.filter((v) => v.severity === 'error').length;
  const warnCount = violations.filter((v) => v.severity === 'warn').length;
  const report = {
    pass: errorCount === 0,
    errorCount,
    warnCount,
    violations,
    tokenCoverage,
    ...(brand ? { brand } : {}),
    file: path.resolve(target),
  };
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  if (brand) console.log(`on-brand: ${brand.onBrand ? 'yes' : 'no'} — ${brand.evidence}`);
  console.log(JSON.stringify({ pass: report.pass, errorCount, warnCount, outPath }, null, 2));
  process.exit(errorCount === 0 ? 0 : 1);
} catch (e) {
  console.error('FATAL', e.message);
  process.exit(2);
}
