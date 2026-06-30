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
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);

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
    if (hue >= 270 && hue <= 310 && chroma > 0.04) add('ai-purple', 'oklch color', `${m[0]}) hue${hue} c${chroma}`, 'error');
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
    if (hue >= 270 && hue <= 310 && chroma > 0.04) add('ai-purple', 'oklch color', `${m[0]}) hue${hue} c${chroma}`, 'error');
  }

  // (d) emoji-as-icon — WARN
  if (EMOJI.test(stripped)) {
    const hit = stripped.match(EMOJI);
    add('emoji', 'document', `emoji present (${hit && hit[0]}) — confirm it is copy, not an icon/bullet (banned as icon)`, 'warn');
  }

  // (e) Tailwind arbitrary-value brackets in class/className — WARN
  for (const m of masked.matchAll(/\sclass(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/gi)) {
    const cls = m[1] || m[2] || m[3] || '';
    const bm = cls.match(/[a-z0-9]+-\[[^\]]+\]/i);
    if (bm) add('tailwind-arbitrary', 'class attribute', bm[0], 'warn');
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

try {
  const target = process.argv[2];
  if (!target) { console.error('usage: node brand-lint.js <page.html|dir> [out.json]'); process.exit(1); }
  const st = fs.statSync(target);

  if (st.isDirectory()) {
    // ---------- DIR / source-tree mode ----------
    const root = path.resolve(target);
    const outPath = process.argv[3] || path.join(root, 'brand-lint.json');
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
  const outPath = process.argv[3] || path.join(path.dirname(path.resolve(target)), 'brand-lint.json');
  const { violations, tokenCoverage } = lintByExt(raw, target);
  const errorCount = violations.filter((v) => v.severity === 'error').length;
  const warnCount = violations.filter((v) => v.severity === 'warn').length;
  const report = {
    pass: errorCount === 0,
    errorCount,
    warnCount,
    violations,
    tokenCoverage,
    file: path.resolve(target),
  };
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pass: report.pass, errorCount, warnCount, outPath }, null, 2));
  process.exit(errorCount === 0 ? 0 : 1);
} catch (e) {
  console.error('FATAL', e.message);
  process.exit(2);
}
