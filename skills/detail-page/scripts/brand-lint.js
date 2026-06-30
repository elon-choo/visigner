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
//   (Inter/Roboto/Arial/Open Sans/Lato/system-ui) · ai-purple (a color at OKLCH hue 255-310 AND
//   chroma>0.04 — floor lowered from 270 to 255 to catch the convergent indigo 255-270, incl. the 266
//   "generic SaaS" accent; the chroma floor is REQUIRED so the starter's gray neutrals at hue ~275 /
//   chroma ~0.012 do NOT flag, and ALLOW_PURPLE=1 opts a legitimately-purple brand out). In component source (.tsx/.jsx/.ts/.js/.vue/.svelte/.astro) and .css/.scss the
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
// ALLOW_PURPLE=1 — "earned purple" override / justification escape: a brand whose identity is legitimately
// purple opts out of the ai-purple gate (the OKLCH hue 255-310 / chroma>0.04 ban). Off by default.
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

// sRGB (0-1 each) → OKLab → {L,C,H} so #hex / rgb() brand roles can be diffed in the same space as oklch().
// Björn Ottosson's reference matrices. Lets flattenBrandColors accept a literal hex/rgb $value.
function srgbToLCH(r, g, b) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const R = lin(r), G = lin(g), B = lin(b);
  const l = 0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B;
  const m = 0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B;
  const s = 0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  let H = (Math.atan2(bb, a) * 180) / Math.PI; if (H < 0) H += 360;
  return { L, C: Math.hypot(a, bb), H };
}

// parse ANY literal color $value string → {L,C,H}: oklch(...), #hex (3/4/6/8), or rgb()/rgba(). null otherwise.
function parseColorString(str) {
  const ok = parseOklch(str); if (ok) return ok;
  const s = String(str).trim();
  let hm = s.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hm) {
    let h = hm[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join(''); // expand shorthand
    if (h.length >= 6) {
      const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
      return srgbToLCH(r, g, b);
    }
    return null;
  }
  const rm = s.match(/rgba?\(\s*([\d.]+%?)\s*[,\s]\s*([\d.]+%?)\s*[,\s]\s*([\d.]+%?)/i);
  if (rm) {
    const chan = (t) => (t.endsWith('%') ? parseFloat(t) / 100 : parseFloat(t) / 255);
    return srgbToLCH(chan(rm[1]), chan(rm[2]), chan(rm[3]));
  }
  return null;
}

// OKLab ΔE between two OKLCH colors (hue→a/b so a 30° teal shift reads as a real distance).
function deltaE(a, b) {
  const ar = (a.H * Math.PI) / 180, brad = (b.H * Math.PI) / 180;
  const aa = a.C * Math.cos(ar), ab = a.C * Math.sin(ar);
  const ba = b.C * Math.cos(brad), bb = b.C * Math.sin(brad);
  return Math.sqrt((a.L - b.L) ** 2 + (aa - ba) ** 2 + (ab - bb) ** 2);
}

// flatten a DTCG brand.tokens.json color tree → { "primary-700": {L,C,H}, "surface": {...}, ... }.
// Accepts every brand.tokens.json shape the system emits, not just the structured-components default:
//   • structured oklch  ($value:{colorSpace:"oklch",components:[L,C,H]}) and the $extensions css round-trip;
//   • a LITERAL string $value  ("oklch(...)", "#hex", or "rgb()/rgba()") — the shape the brand-identity SKILL documents;
//   • a top-level "brand" (and/or "color") WRAPPER  ({ "brand": { "color": { ... } } });
//   • {alias} refs ($value:"{color.primary.700}") — resolved against the resolved color of their target, like build-tokens.js.
// A color leaf is `$type:"color"` OR a leaf (has $value/$type) with no $type and a color-looking string value;
// leaves of any other $type (shadow/fontFamily/dimension/cubicBezier…) are skipped so e.g. a shadow's inner oklch() is never misread.
function flattenBrandColors(tokens) {
  const byPath = {};   // full dot-path → {L,C,H}
  const aliasOf = {};  // full dot-path → target dot-path (unresolved ref)
  const isLeaf = (v) => v && typeof v === 'object' && ('$value' in v || '$type' in v);
  const aliasRef = (val) => (typeof val === 'string' && /^\{.+\}$/.test(val) ? val.slice(1, -1) : null);
  const colorOf = (v) => {
    const css = v.$extensions && v.$extensions['com.detail-page'] && v.$extensions['com.detail-page'].css;
    if (css) { const ok = parseColorString(css); if (ok) return ok; }
    const val = v.$value;
    if (val && val.colorSpace === 'oklch' && Array.isArray(val.components)) {
      const c = val.components; return { L: c[0], C: c[1], H: c[2] };
    }
    if (typeof val === 'string') return parseColorString(val); // literal oklch()/#hex/rgb()
    return null;
  };
  const walk = (obj, segs) => {
    for (const [k, v] of Object.entries(obj || {})) {
      if (k.startsWith('$') || v == null || typeof v !== 'object') continue;
      const p = [...segs, k];
      if (isLeaf(v)) {
        if (v.$type && v.$type !== 'color') continue;       // non-color token — skip
        const ref = aliasRef(v.$value);
        if (ref) { aliasOf[p.join('.')] = ref; continue; }   // resolve in pass 2
        const col = colorOf(v);
        if (col) byPath[p.join('.')] = col;
      } else {
        walk(v, p); // group node (wrapper, ramp, etc.) — recurse
      }
    }
  };
  walk(tokens, []);
  // resolve {alias} chains against resolved leaf colors (bounded; ignore cycles/unresolvable).
  for (const from of Object.keys(aliasOf)) {
    let cur = aliasOf[from]; const seen = new Set([from]);
    while (cur && !byPath[cur] && aliasOf[cur] && !seen.has(cur)) { seen.add(cur); cur = aliasOf[cur]; }
    if (cur && byPath[cur]) byPath[from] = byPath[cur];
  }
  // role names: strip leading "brand"/"color" wrapper segment(s), join the rest with '-' (matches the page's --brand-*/--color-* names).
  const roles = {};
  for (const [p, col] of Object.entries(byPath)) {
    const segs = p.split('.');
    while (segs.length > 1 && (segs[0] === 'brand' || segs[0] === 'color')) segs.shift();
    const name = segs.join('-').toLowerCase();
    if (!(name in roles)) roles[name] = col;
  }
  return roles;
}

// build a map of EVERY custom property defined in :root{}/@theme{} → its raw value string (first-wins on the
// primitive :root layer). Used to resolve var() chains back to a painted color before the ΔE diff.
function rootPropMap(stripped) {
  const props = {};
  for (const [s, e] of braceBlocks(stripped, /(?:@theme|:root)[^{]*\{/g)) {
    for (const m of stripped.slice(s, e).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)/gi)) {
      const name = m[1].toLowerCase();
      if (!(name in props)) props[name] = m[2].trim(); // first definition wins (the --brand-* primitive layer)
    }
  }
  return props;
}

// resolve a CSS value to {L,C,H}: a value that STARTS with a literal oklch(), or a var(--x[, fallback]) chain
// looked up in `props` (cycle-guarded). Returns null for non-color values (color-mix, fonts, a shadow's inner
// oklch, etc.) — the oklch must lead the value, so "0 1px 2px oklch(...)" is NOT misread as a color.
function resolveCssColor(value, props, seen) {
  const v = String(value).trim();
  const vm = v.match(/^var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([^)]+))?\)/i);
  if (vm) {
    seen = seen || new Set();
    const ref = vm[1].toLowerCase();
    if (props[ref] != null && !seen.has(ref)) {
      seen.add(ref);
      const r = resolveCssColor(props[ref], props, seen);
      if (r) return r;
    }
    if (vm[2]) return resolveCssColor(vm[2].trim(), props, seen); // var() fallback value
    return null;
  }
  if (/^oklch\(/i.test(v)) return parseOklch(v);
  return null;
}

// extract the page's DECLARED token colors keyed by role (--brand-*/--color-* prefix stripped). Resolves
// var() chains to the painted :root value so a token defined as `var(--brand-primary-700)` — and an inline
// `var(--color-accent)` USE in component/inline CSS — is actually ΔE-checked, not silently skipped.
function extractDeclaredColors(stripped) {
  const props = rootPropMap(stripped);
  const decls = {};
  // (1) every --brand-*/--color-* token defined in :root/@theme, with var() chains resolved.
  for (const [name, raw] of Object.entries(props)) {
    const rm = name.match(/^--(?:brand|color)-([a-z0-9-]+)$/);
    if (!rm) continue;
    const role = rm[1];
    if (role in decls) continue; // first definition wins (the --brand-* primitive layer)
    const col = resolveCssColor(raw, props);
    if (col) decls[role] = col;
  }
  // (2) var(--brand-*/--color-*) USES in component/inline CSS (outside the token blocks) — resolve back to the
  //     painted :root value so an inline-referenced color is covered by the ΔE diff too.
  let masked = stripped;
  for (const [s, e] of braceBlocks(stripped, /(?:@theme|:root)[^{]*\{/g)) masked = masked.slice(0, s) + ' '.repeat(e - s) + masked.slice(e);
  for (const m of masked.matchAll(/var\(\s*(--(?:brand|color)-[a-z0-9-]+)/gi)) {
    const full = m[1].toLowerCase();
    const role = full.replace(/^--(?:brand|color)-/, '');
    if (role in decls || props[full] == null) continue;
    const col = resolveCssColor(props[full], props);
    if (col) decls[role] = col;
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
function brandCheck(raw, brandTokens, lexicon, brandFile) {
  const violations = [];
  const add = mkAdd(violations);
  const stripped = raw
    .replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));

  // (1) colors: declared vs semantic role within ΔE
  const roles = flattenBrandColors(brandTokens);
  const roleCount = Object.keys(roles).length;
  // LOUD FAILURE: a brand file we could not read ANY semantic color role from is an ERROR, never a silent
  // "0/0 — on-brand: yes". Empty {}, a garbage object, or a shape this parser can't read all land here.
  if (roleCount === 0) {
    add('brand-unreadable', 'brand tokens', `could not read any brand roles from ${brandFile || 'brand file'}`, 'error');
  }
  const declared = extractDeclaredColors(stripped);
  const declaredCount = Object.keys(declared).length;
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
  // COVERAGE: how many declared page colors had NO brand role to compare against (cannot be judged) — surfaced
  // so an unmatched off-brand token cannot hide behind a clean "0 off" ratio over the few that DID match.
  const unmatchedCount = declaredCount - checked;
  const coverage = declaredCount > 0 ? Math.round((checked / declaredCount) * 100) : 100;
  // LOUD FAILURE (like brand-unreadable): the brand file has roles, the page declares colors, yet NONE of them
  // name-match a role → we literally checked nothing, so we CANNOT assert on-brand. Without this, roleCount>0 &&
  // checked===0 reads a false-green "0 off → on-brand: yes".
  if (roleCount > 0 && declaredCount > 0 && checked === 0) {
    add('brand-unmatched', 'declared tokens', 'no page color matched any brand role -> cannot assert on-brand', 'error');
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

  // A zero-role brand file can NEVER be on-brand (would otherwise read off=0/banned=0 → silent "yes"); neither
  // can a page whose declared colors name-match ZERO brand roles (declaredCount>0 && checked===0 — nothing judged).
  const onBrand = roleCount > 0 && !(declaredCount > 0 && checked === 0) &&
    off.length === 0 && bannedHits.length === 0 && logoIssues.length === 0;
  const parts = [];
  if (roleCount === 0) {
    parts.push(`could not read any brand roles from ${brandFile || 'brand file'} — check brand.tokens.json shape`);
  } else if (declaredCount > 0 && checked === 0) {
    parts.push(`no page color matched any brand role — cannot assert on-brand (${declaredCount} declared color(s) vs ${roleCount} brand roles)`);
  } else {
    parts.push(`${checked - off.length}/${checked} declared colors within ΔE ${BRAND_DELTAE} of ${roleCount} brand roles`);
    if (off.length) parts.push(`OFF: ${off.map((o) => `--${o.name} ΔE${o.dE.toFixed(3)}`).join(', ')}`);
    parts.push(`COVERAGE: ${unmatchedCount} declared color(s) had no brand role to compare — coverage ${coverage}%`);
  }
  if (lexicon) parts.push(`${bannedHits.length} banned${bannedHits.length ? ` ("${bannedHits.join('", "')}")` : ''}; owned ${ownedPresent}/${ownedTotal}`);
  if (logoGuide) parts.push(logoChecked ? (logoIssues.length ? `logo ${logoIssues.join(', ')}` : 'logo ok') : 'no logo found');
  return { onBrand, evidence: parts.join('; '), violations, roleCount, declaredCount, checked, offCount: off.length, unmatchedCount, coverage };
}

// ============================================================================
// UNDEFINED-TOKEN-REF (source/dir mode) — enforce the "token rename = API break" story: a var(--color-typo)
// that resolves to NOTHING (because the token was renamed/removed) must fail CI, not compile to empty and pass.
// We build the DEFINED design-token set from @theme{}/:root{} (and optional DTCG) across the WHOLE tree, then
// flag any var(--color/font/shadow/brand-*) reference whose name is not in that set. Only the four design-token
// namespaces are checked (an arbitrary --x css var is never flagged). Definitions are collected tree-wide BEFORE
// refs are checked so a token defined in one file and used in another resolves correctly.
// ============================================================================

// strip HTML/CSS/JS comments to spaces (length- and newline-position-preserving, so a match index still maps to
// the original raw for accurate line numbers). The line-comment strip skips `://` so URLs in strings survive.
function stripCommentsToSpace(raw) {
  return raw
    .replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
}

// design-token namespaces that form the DEFINED allowlist (the names actually declared in @theme/:root).
const DEFINED_TOKEN_DEF = /(--(?:color|font|shadow|brand|space|radius|dur|ease)-[a-z0-9-]+)\s*:/gi;
// the four namespaces whose var() REFERENCES are checked against the defined set.
const REF_TOKEN = /var\(\s*(--(?:color|font|shadow|brand)-[a-z0-9-]+)/gi;

// collect design-token NAMES defined in @theme{}/:root{} blocks of one file into `into` (a Set, lowercased).
function collectDefinedTokens(stripped, into) {
  for (const [s, e] of braceBlocks(stripped, /(?:@theme|:root)[^{]*\{/g)) {
    for (const m of stripped.slice(s, e).matchAll(DEFINED_TOKEN_DEF)) into.add(m[1].toLowerCase());
  }
  return into;
}

// collect candidate css token NAMES from a DTCG brand.tokens.json so a var() ref to a token that lives only in
// the DTCG source (not yet in a built @theme) is not falsely flagged. Purely ADDITIVE — it only widens the
// allowlist, so over-collection can never cause a false positive. Adds the full dashed path plus a
// wrapper-stripped --color-/--brand- variant for every leaf.
function collectDtcgTokens(tokens, into) {
  const isLeaf = (v) => v && typeof v === 'object' && ('$value' in v || '$type' in v);
  const walk = (obj, segs) => {
    for (const [k, v] of Object.entries(obj || {})) {
      if (k.startsWith('$') || v == null || typeof v !== 'object') continue;
      const p = [...segs, k];
      if (isLeaf(v)) {
        into.add(`--${p.join('-').toLowerCase()}`);
        const rest = [...p];
        while (rest.length > 1 && (rest[0] === 'brand' || rest[0] === 'color')) rest.shift();
        const r = rest.join('-').toLowerCase();
        into.add(`--color-${r}`); into.add(`--brand-${r}`);
      } else walk(v, p);
    }
  };
  walk(tokens || {}, []);
  return into;
}

// check var(--color/font/shadow/brand-*) references in one file against the tree-wide DEFINED set; a ref to a
// name not in the set is an `undefined-token-ref` ERROR (offending name in snippet, file:line in `where`).
function checkTokenRefs(raw, defined, relFile, violations) {
  const add = mkAdd(violations);
  const stripped = stripCommentsToSpace(raw);
  for (const m of stripped.matchAll(REF_TOKEN)) {
    const name = m[1].toLowerCase();
    if (defined.has(name)) continue;
    const line = raw.slice(0, m.index).split('\n').length;
    add('undefined-token-ref', `${relFile}:${line}`, `${m[1]} — references no defined token (renamed/removed?)`, 'error');
  }
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

  // (c) AI-purple: any OKLCH color at hue 255-310 AND chroma>0.04 (chroma floor protects gray neutrals;
  //     floor lowered 270->255 to catch convergent indigo; ALLOW_PURPLE=1 is the documented justification escape)
  for (const m of stripped.matchAll(/oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/gi)) {
    const chroma = parseFloat(m[2]), hue = parseFloat(m[3]);
    if (!ALLOW_PURPLE && hue >= 255 && hue <= 310 && chroma > 0.04) add('ai-purple', 'oklch color', `${m[0]}) hue${hue} c${chroma}`, 'error');
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
  //     CSS multi-word families MUST be quoted (font-family:"Inter", "Open Sans"); capture the whole value
  //     (do NOT exclude quote chars, which dropped quoted families entirely) then strip quotes per family.
  const fontValues = [];
  for (const m of stripped.matchAll(/font-family\s*:\s*([^;}\n]+)/gi)) {
    for (const fam of m[1].split(',')) fontValues.push(fam.replace(/['"]/g, '').trim());
  }
  for (const m of stripped.matchAll(/fontFamily\s*:\s*([^,;}\n]+)/gi)) fontValues.push(m[1]);
  for (const m of stripped.matchAll(/--(?:brand-)?font-[a-z0-9-]+\s*:\s*([^;}]+)/gi)) fontValues.push(m[1]);
  for (const m of stripped.matchAll(/<link[^>]+href\s*=\s*"([^"]*(?:fonts\.googleapis|api\.fontshare|fonts)[^"]*)"/gi)) fontValues.push(m[1]);
  for (const v of fontValues) { const b = v.match(BANNED_FONT); if (b) add('banned-font', 'font declaration', `${b[1]} in "${v.trim().slice(0, 60)}"`, 'error'); }

  // (c) AI-purple: OKLCH at hue 255-310 AND chroma>0.04 (oklch() itself is the allowed token format;
  //     floor lowered 270->255 to catch convergent indigo; ALLOW_PURPLE=1 is the documented justification escape)
  for (const m of stripped.matchAll(/oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/gi)) {
    const chroma = parseFloat(m[2]), hue = parseFloat(m[3]);
    if (!ALLOW_PURPLE && hue >= 255 && hue <= 310 && chroma > 0.04) add('ai-purple', 'oklch color', `${m[0]}) hue${hue} c${chroma}`, 'error');
  }

  // (d) emoji-as-icon — WARN
  if (EMOJI.test(stripped)) {
    const hit = stripped.match(EMOJI);
    add('emoji', 'document', `emoji present (${hit && hit[0]}) — confirm it is copy, not an icon/bullet (banned as icon)`, 'warn');
  }

  // (e) Tailwind arbitrary-value brackets. GOVERNANCE promotion: an arbitrary SPACING bracket off the 4px
  //     grid (mt-[13px], p-[7px]) and an arbitrary font-size off the type scale (text-[15px]) are ERRORs;
  //     every other arbitrary bracket stays a WARN (one per scanned string, as before). The same logic runs
  //     over (e1) class/className attributes, (e2) string-literal args of class-builder calls
  //     (cva/tv/cn/clsx/twMerge — frontend-build §4's exact pattern, which would otherwise bypass the gate
  //     since attribute-only scanning never sees them), and (e3) strings assigned to a *className/*Variants
  //     identifier.
  const scanArbitrary = (cls, where) => {
    let warned = false;
    for (const bm of cls.matchAll(/(-?[a-z][a-z0-9]*(?:-[a-z]+)?)-\[([^\]]+)\]/gi)) {
      const prefix = bm[1].replace(/^-/, '');
      const pxm = bm[2].match(/^(\d+(?:\.\d+)?)px$/);
      if (SPACING_PREFIX.test(prefix) && pxm && Number(pxm[1]) % 4 !== 0) {
        add('spacing-arbitrary-off-grid', where, bm[0], 'error');
      } else if (prefix === 'text' && pxm && !TYPE_SCALE.has(Number(pxm[1]))) {
        add('type-scale-arbitrary', where, bm[0], 'error');
      } else if (!warned) {
        add('tailwind-arbitrary', where, bm[0], 'warn');
        warned = true;
      }
    }
  };
  const STR_LIT = /"([^"]*)"|'([^']*)'|`([^`]*)`/g;
  // (e1) class/className attributes
  for (const m of masked.matchAll(/\sclass(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/gi)) {
    scanArbitrary(m[1] || m[2] || m[3] || '', 'class attribute');
  }
  // (e2) class-builder call args: scan every string literal inside the call's (balanced) parens.
  for (const m of masked.matchAll(/\b(?:cva|tv|cn|clsx|twMerge)\s*\(/gi)) {
    const open = m.index + m[0].length - 1;
    let depth = 0, end = -1;
    for (let i = open; i < masked.length; i++) {
      if (masked[i] === '(') depth++;
      else if (masked[i] === ')') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) continue;
    for (const sm of masked.slice(open + 1, end).matchAll(STR_LIT)) {
      scanArbitrary(sm[1] || sm[2] || sm[3] || '', 'class-builder call');
    }
  }
  // (e3) strings assigned to a *className/*Variants identifier (e.g. const buttonVariants = "...").
  for (const m of masked.matchAll(/\b[a-z_$][\w$]*(?:className|Variants)\s*=\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/gi)) {
    scanArbitrary(m[1] || m[2] || m[3] || '', 'className identifier');
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
    // SEMANTIC BRAND mode now runs in DIR mode too: per-file ΔE rollup + one overall on-brand line.
    // The semantic color/logo/copy check is meaningful only for files that declare :root/@theme token
    // colors, so it runs on .html/.htm/.css/.scss; other source exts still get the raw-color/font/etc. lint.
    const BRAND_CHECK_EXTS = new Set(['.html', '.htm', '.css', '.scss']);
    // LOUD FAILURE up front: a brand file with zero readable roles fails the whole run (no silent per-file pass).
    if (flags.brand) {
      const roleN = Object.keys(flattenBrandColors(brandTokens)).length;
      if (roleN === 0) {
        console.error(`on-brand: no — could not read any brand roles from ${flags.brand} — check brand.tokens.json shape`);
        console.log(JSON.stringify({ pass: false, onBrand: false, errorCount: 1, brandError: `could not read any brand roles from ${flags.brand}`, outPath }, null, 2));
        process.exit(1);
      }
    }
    const files = collectFiles(root, []).sort();
    const fileReports = [];
    let errorCount = 0, warnCount = 0, rawColorsTotal = 0, definedTokensTotal = 0;
    let brandCheckedTotal = 0, brandOffTotal = 0, brandFilesOff = 0, brandFilesChecked = 0;

    // PASS 1 (undefined-token-ref): build the DEFINED token set from @theme/:root (+ DTCG) across the WHOLE
    // tree BEFORE checking any refs, so a token defined in one file and used in another resolves correctly.
    const definedTokens = new Set();
    const fileRaws = new Map();
    for (const f of files) {
      const raw = fs.readFileSync(f, 'utf8');
      fileRaws.set(f, raw);
      collectDefinedTokens(stripCommentsToSpace(raw), definedTokens);
    }
    if (flags.brand) collectDtcgTokens(brandTokens, definedTokens);

    for (const f of files) {
      const raw = fileRaws.get(f);
      const { violations, tokenCoverage } = lintByExt(raw, f);
      // PASS 2: flag var(--token) refs not in the tree-wide defined set (token rename = API break).
      checkTokenRefs(raw, definedTokens, path.relative(root, f), violations);
      // SEMANTIC BRAND check per file (color ΔE + logo + lexicon); its violations join the gate.
      let brand = null;
      if (flags.brand && BRAND_CHECK_EXTS.has(path.extname(f).toLowerCase())) {
        const r = brandCheck(raw, brandTokens, lexicon, flags.brand);
        for (const v of r.violations) violations.push(v);
        brand = { onBrand: r.onBrand, evidence: r.evidence };
        brandCheckedTotal += r.checked; brandOffTotal += r.offCount;
        // a file is brand-relevant if it declared ANY token color (even ones that name-match no role — those are
        // the brand-unmatched case, which must count as off-brand, not be skipped into a silent pass).
        if (r.declaredCount > 0) { brandFilesChecked++; if (!r.onBrand) brandFilesOff++; }
      }
      const fe = violations.filter((v) => v.severity === 'error').length;
      const fw = violations.filter((v) => v.severity === 'warn').length;
      errorCount += fe; warnCount += fw;
      rawColorsTotal += tokenCoverage.rawColorsOutsideTheme;
      definedTokensTotal += tokenCoverage.definedTokens;
      fileReports.push({ file: path.relative(root, f), errorCount: fe, warnCount: fw, violations, tokenCoverage, ...(brand ? { brand } : {}) });
    }

    const overallOnBrand = flags.brand ? brandFilesOff === 0 : undefined;
    const report = {
      pass: errorCount === 0,
      errorCount,
      warnCount,
      ...(flags.brand ? { onBrand: overallOnBrand } : {}),
      files: fileReports,
      totals: {
        filesScanned: files.length,
        filesWithErrors: fileReports.filter((r) => r.errorCount > 0).length,
        errorCount,
        warnCount,
        rawColorsOutsideTheme: rawColorsTotal,
        definedTokens: definedTokensTotal,
        ...(flags.brand ? { brandFilesChecked, brandDeclaredColors: brandCheckedTotal, brandOffBrandColors: brandOffTotal, brandFilesOff } : {}),
      },
      root,
    };
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    if (flags.brand) {
      console.log(`on-brand: ${overallOnBrand ? 'yes' : 'no'} — ${brandCheckedTotal - brandOffTotal}/${brandCheckedTotal} declared colors on-brand across ${brandFilesChecked} file(s); ${brandFilesOff} file(s) off-brand`);
    }
    console.log(JSON.stringify({
      pass: report.pass, errorCount, warnCount,
      ...(flags.brand ? { onBrand: overallOnBrand } : {}),
      filesScanned: files.length, filesWithErrors: report.totals.filesWithErrors, outPath,
    }, null, 2));
    process.exit(errorCount === 0 ? 0 : 1);
  }

  // ---------- SINGLE-FILE mode (backward-compatible) ----------
  const raw = fs.readFileSync(target, 'utf8');
  const outPath = positionals[1] || path.join(path.dirname(path.resolve(target)), 'brand-lint.json');
  const { violations, tokenCoverage } = lintByExt(raw, target);

  // UNDEFINED-TOKEN-REF (source mode only — NOT single-file HTML, which stays byte-for-byte unchanged):
  // build this file's defined token set (+ optional DTCG) and flag var() refs to renamed/removed tokens.
  const targetExt = path.extname(target).toLowerCase();
  if (targetExt !== '.html' && targetExt !== '.htm') {
    const defined = collectDefinedTokens(stripCommentsToSpace(raw), new Set());
    if (flags.brand) collectDtcgTokens(brandTokens, defined);
    checkTokenRefs(raw, defined, path.basename(target), violations);
  }

  // SEMANTIC BRAND mode (opt-in): diff declared colors vs brand roles, check logo + lexicon, emit one line.
  // Off-brand colors / banned terms are added to the SAME violations list so they count toward the gate.
  let brand = null;
  if (brandTokens) {
    const r = brandCheck(raw, brandTokens, lexicon, flags.brand);
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
