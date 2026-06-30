// brand-lint.js — deterministic brand-governance linter for a single-file detail page.
// No deps (Node fs + regex only). Promotes review-rubric §A bans from "LLM self-graded" into a
// machine check so quality doesn't depend on the grader's mood. Off-by-default (nothing imports it yet).
//
// Usage:   node brand-lint.js <page.html> [out.json]
// Output:  <dir>/brand-lint.json (or [out.json]) = { pass, errorCount, warnCount, violations:[{rule,where,snippet,severity}], tokenCoverage }
// Exit:    non-zero ONLY when an error-severity violation is found (warnings never fail the gate).
//
// ERROR rules (unambiguous bans): raw-hex / raw-rgb / raw-hsl color OUTSIDE @theme · banned-font
//   (Inter/Roboto/Arial/Open Sans/Lato/system-ui) · ai-purple (a color at OKLCH hue 270-310 AND
//   chroma>0.04 — the chroma floor is REQUIRED so the starter's gray neutrals at hue ~275 / chroma
//   ~0.012 do NOT flag).
// WARN rules (judgement calls a linter can't fully resolve): emoji-as-icon · tailwind-arbitrary-bracket.
// OFF by default (BRAND_LINT_PX=1 to enable): spacing-px-off-grid — the starter intentionally uses px in
//   clamp()/font-size/radius/min-height and a 10px buybar pad, so this is opt-in to avoid noise.

const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) { console.error('usage: node brand-lint.js <page.html> [out.json]'); process.exit(1); }

try {
  const raw = fs.readFileSync(file, 'utf8');
  const outPath = process.argv[3] || path.join(path.dirname(path.resolve(file)), 'brand-lint.json');

  // Strip HTML *and* CSS comments first — comments (the "NOT Inter" warning, example hexes, and prose that
  // mentions "@theme") must never be linted. Critically, a CSS comment containing the word "@theme" would
  // otherwise make the @theme-block locator below mis-match and mask the wrong region (e.g. all of :root).
  const stripped = raw
    .replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));

  const violations = [];
  const add = (rule, where, snippet, severity) =>
    violations.push({ rule, where, snippet: String(snippet).replace(/\s+/g, ' ').trim().slice(0, 90), severity });

  // --- locate @theme { ... } blocks (brace-matched) so raw-color scan can exclude them ---
  const themeBlocks = [];
  for (const m of stripped.matchAll(/@theme[^{]*\{/g)) {
    const open = m.index + m[0].length - 1;
    let depth = 0;
    for (let i = open; i < stripped.length; i++) {
      if (stripped[i] === '{') depth++;
      else if (stripped[i] === '}') { depth--; if (depth === 0) { themeBlocks.push([m.index, i + 1]); break; } }
    }
  }
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
  const BANNED_FONT = /\b(Inter|Roboto|Arial|Open\s+Sans|Lato|system-ui)\b/i;
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
    if (hue >= 270 && hue <= 310 && chroma > 0.04) add('ai-purple', 'oklch color', `${m[0]}) hue${hue} c${chroma}`, 'error');
  }

  // (d) emoji used as content — WARN (a linter can't reliably tell icon-use from copy-use)
  const EMOJI = /[⌚-⌛☀-➿⬅-⬇⬛⬜⭐⭕️\u{1F000}-\u{1FAFF}]/u;
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

  const errorCount = violations.filter((v) => v.severity === 'error').length;
  const warnCount = violations.filter((v) => v.severity === 'warn').length;
  const report = {
    pass: errorCount === 0,
    errorCount,
    warnCount,
    violations,
    tokenCoverage: { definedTokens: tokenNames.size, rawColorsOutsideTheme: rawColorCount },
    file: path.resolve(file),
  };
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pass: report.pass, errorCount, warnCount, outPath }, null, 2));
  process.exit(errorCount === 0 ? 0 : 1);
} catch (e) {
  console.error('FATAL', e.message);
  process.exit(2);
}
