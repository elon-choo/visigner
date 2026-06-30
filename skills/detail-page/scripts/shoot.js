// shoot.js — render your OWN generated page and screenshot it for visual self-critique.
// Usage: NODE_PATH=$(npm root -g) node shoot.js <file.html|url> [outDir]
// Outputs: full-page desktop PNG, desktop viewport tiles, and a 390px mobile full-page PNG.
//
// Assertion gates (additive; existing output unchanged):
//   - Horizontal-overflow check at 390px ALWAYS runs → run.json.mobileOverflowPx + overflowCulprits[]
//     (the silent killer of Korean detail pages; rubric §A treats >1px as a hard fail).
//   - axe-core a11y scan runs when env AXE=1 → run.json.axe (a11y only — NOT a Lighthouse perf budget).
//     Scans BOTH the desktop AND the 390px-mobile context, so mobile-only UI (e.g. the sticky purchase
//     bar that is display:none on desktop) is actually covered; violations are unioned by rule id.
//   - Broken-asset gate ALWAYS runs (set ASSETS=0 to opt out) → run.json.assets{badResponses,brokenImages}
//     + gate.assetsOk: catches failed requests (4xx/failed) for document/image/font/css/js/media and <img> that
//     loaded to 0px — the #1 silent defect once real generated PNGs are placed by path.
//   - run.json.gate summarizes pass/fail so a workflow can hard-gate on real pixels, not code.
//     gate.axeClean is true/false when axe ran, or null when axe could not load (CDN down) — i.e.
//     a network failure reads as "unknown", never as a silent a11y pass.
//   - run.json.gate.report = { overall, checks:[{name,pass,detail,severity}] } — one machine-readable rollup
//     a workflow/CI/enterprise-report can consume. overall is false ONLY if a block check is === false;
//     a null (unknown/skipped) check never silently blocks. GATE_EXIT=1 makes the process exit 1 when
//     overall===false (default stays exit 0 so the existing workflow is unaffected).
//   - BRANDS=default,alt (opt-in) → re-applies each [data-brand], re-runs axe+overflow, and records
//     run.json.brands[] per brand; the TOP-LEVEL gate stays the default brand (catches a brand that
//     quietly breaks contrast/overflow). - VR=1 (opt-in) → visual-regression diff of desktop+mobile vs an
//     approved baseline (VR_BASELINE=1 writes the baseline) → run.json.visualRegression + gate.visualClean
//     (null if the comparator can't load — never a silent pass). - PERF=1 (opt-in) → synthetic CWV tripwire
//     (LCP/CLS/blocking/bytes) → run.json.perf + gate.perfBudget; the byte budget no-ops on file:// (a tripwire,
//     not a CrUX guarantee).
// Env: MAX_TILES (default 90), AXE=1, AXE_IMPACT=serious|critical (default serious), ASSETS=0 (skip asset gate),
//      GATE_EXIT=1 (exit 1 when gate.report.overall===false), BRANDS=a,b, VR=1 / VR_BASELINE=1 / VR_RATIO (default 0.02),
//      PERF=1 / LCP_BUDGET_MS (2500) / CLS_BUDGET (0.1) / BYTE_BUDGET_KB (2500),
//      FILMSTRIP=1 / MOTION=1, REDUCED_MOTION=1, MOTION_TRIGGER='sel:event' (see notes below).
//      STATIC=1 — NO-BROWSER lint mode: parse the HTML as text (no Chromium needed, works BEFORE /design-setup) and
//        emit a partial gate to run.json. BLOCK checks: banned fonts (Inter/Roboto/Arial/Open Sans/Lato/system-ui);
//        raw hex/rgb colors used OUTSIDE a @theme/:root/<style> token block (now matched only as valid 3/6/8-digit hex
//        inside inline style attrs / Tailwind [#…] arbitrary values, so visible text like an order no. "#1042" no longer
//        false-positives); aiDefaultColors (the AI-default hex families #7c3aed/#6366f1/#8b5cf6/#a855f7/#4f46e5 plus
//        oklch/hsl purples in hue 270–310 with real chroma); naive fixed-width mobile-overflow risk (width:NNNpx /
//        w-[NNNpx] over 390); <img> without alt. WARN checks: lowContrast (naive WCAG ratio on inline color+bg pairs)
//        and structuralSlop (text-align:center on many blocks / >=3 sibling-equal cards / big-number hero). Never launches a browser.
//      FILMSTRIP=1 (or MOTION=1) — capture ~6 frames over the first ~1500ms into <outDir>/filmstrip-*.png (desktop)
//        AND <outDir>/filmstrip-mobile-*.png (390px entrance) and read getComputedStyle on animated/transitioned
//        elements → run.json.motion {frames, mobileFrames, durations, layoutAnimated[]}: warns on durations >600ms or
//        off-token, and FLAGS any element animating a layout property (width/height/top/left/right/bottom/margin) as a
//        jank/banned-motion violation (prefer transform/opacity).
//      REDUCED_MOTION=1 (implied by FILMSTRIP/MOTION) — re-render the desktop page under emulateMedia reducedMotion:reduce
//        and assert every active transition/animation duration collapses to ~0 → run.json.motion.reducedMotionHonored
//        (+ reducedMotionOffenders[]) as a BLOCK gate. A no-op duplicate @media (reduce) block that does not actually
//        disable motion FAILS this gate; honored=null (eval threw) reads as unknown and never silently passes.
//      MOTION_TRIGGER='selector:event' (opt-in; pipe-separate several, e.g. 'a:click|.menu:hover') — dispatch the
//        interaction (event = trailing click/hover/focus/…; otherwise treated as part of the selector), film a pre frame
//        + a ~600ms window (interact-*.png), and run the SAME duration/layout-property audit → run.json.motion.interactions[].
//
// Browser launch: tries the patchright/playwright BUNDLED Chromium first (what /design-setup installs), then falls
//   back to system Google Chrome (channel:'chrome'); on total failure it throws a plain-language fix message.
// Resolve chromium LAZILY (only when a browser is actually launched) so STATIC=1 can text-lint with no browser
// package installed at all — the pre-/design-setup signal path. The default browser path is unchanged.
let _chromium = null;
function loadChromium() {
  if (_chromium) return _chromium;
  // package.json declares patchright (and the skill's node_modules bundles patchright/-core), so resolve it FIRST
  // to match what /design-setup installs; fall back to a local playwright install if present. require() resolves
  // the local node_modules (NODE_PATH=$(npm root -g)). The launch fallback chain below is unchanged.
  try { _chromium = require('patchright').chromium; }
  catch (_) {
    try { _chromium = require('playwright').chromium; }
    catch (e) {
      throw new Error('Neither patchright nor playwright is installed. Run /design-setup (npm install + ' +
        'npx patchright install chromium), or re-run with STATIC=1 for a no-browser text lint. (' + e.message + ')');
    }
  }
  return _chromium;
}
const fs = require('fs');
const path = require('path');

const target = process.argv[2];
const outDir = process.argv[3] || '/tmp/detail-page-shots';
const maxTiles = Number(process.env.MAX_TILES || 90);
if (!target) { console.error('usage: node shoot.js <file.html|url> [outDir]'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });
const url = /^https?:\/\//.test(target) ? target : 'file://' + path.resolve(target);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// axe-core helper — inject the PINNED axe bundle with Subresource Integrity (Playwright's addScriptTag has no
// integrity option, so inject the element manually + await load). A hash mismatch / CDN failure rejects → the
// caller's try/catch sets axeClean=null (unknown), never a silent pass. Read-only; returns [{id,impact,help,nodes}].
const AXE_RANK = { minor: 1, moderate: 2, serious: 3, critical: 4 };
const AXE_CDN = { url: 'https://cdn.jsdelivr.net/npm/axe-core@4.12.1/axe.min.js', integrity: 'sha384-JQegRXq6EhTiWoGPFDmqbJNsDow5BoSsGhnaeDzGp+qyOFCuMZZ24qY2fz3FxZF5' };

// Color helpers — turn axe's color-contrast finding into a concrete one-line fix: name the offending text color and
// suggest a passing OKLCH (keep hue+chroma, move lightness) so a non-designer knows exactly what to set the token to.
// Compact Björn-Ottosson sRGB<->OKLab transforms; WCAG luminance is read off the linear-RGB intermediate.
function _parseRgb(s) {
  s = String(s || '').trim();
  let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) { let h = m[1]; if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (m) return [+m[1], +m[2], +m[3]];
  return null;
}
const _lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const _lumLin = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b; // r,g,b already linear (0..1)
function _rgbToOklch([r, g, b]) {
  const lr = _lin(r), lg = _lin(g), lb = _lin(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return { L, C: Math.hypot(A, B), H: (Math.atan2(B, A) * 180 / Math.PI + 360) % 360 };
}
function _oklchToLin({ L, C, H }) {
  const a = C * Math.cos(H * Math.PI / 180), b = C * Math.sin(H * Math.PI / 180);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const clamp = (v) => Math.min(1, Math.max(0, v));
  return [
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
  ];
}
// Keep the failing FG's hue+chroma, step its lightness toward the bg until WCAG ratio >= required. Returns an
// `oklch(L C H)` string, or null if no in-gamut lightness at that hue/chroma reaches the target.
function suggestPassingOklch(fg, bg, required) {
  const fgRgb = _parseRgb(fg), bgRgb = _parseRgb(bg);
  if (!fgRgb || !bgRgb) return null;
  // axe delivers `required` as a STRING ("3:1" / "4.5:1"); a numeric `>=` against that string is always false, so the
  // loop used to clamp lightness all the way to oklch(0 …) = pure black. Parse to a number so the loop stops at the
  // minimal lightness that actually clears the ratio.
  const req = parseFloat(String(required)) || 4.5;
  const bgY = _lumLin(_lin(bgRgb[0]), _lin(bgRgb[1]), _lin(bgRgb[2]));
  const base = _rgbToOklch(fgRgb);
  const contrastAt = (L) => { const [r, g, b] = _oklchToLin({ L, C: base.C, H: base.H }); const y = _lumLin(r, g, b); const hi = Math.max(y, bgY) + 0.05, lo = Math.min(y, bgY) + 0.05; return hi / lo; };
  const dir = bgY > 0.18 ? -1 : 1; // light bg → darken the text; dark bg → lighten it
  let L = base.L;
  for (let i = 0; i < 60; i++) { if (contrastAt(L) >= req) break; L += dir * 0.02; if (L < 0 || L > 1) { L = Math.min(1, Math.max(0, L)); break; } }
  if (contrastAt(L) < req) return null;
  return `oklch(${L.toFixed(3)} ${base.C.toFixed(3)} ${base.H.toFixed(1)})`;
}
// Resolve a rendered rgb() color back to the --color-* design token that produced it (collected from :root), so the
// contrast fix names the actual token to edit (e.g. "--color-text") instead of an anonymous "text" word.
function _findColorToken(targetRgb, customProps) {
  const t = _parseRgb(targetRgb);
  if (!t) return null;
  for (const [name, val] of Object.entries(customProps || {})) {
    const c = _parseRgb(val);
    if (c && Math.abs(c[0] - t[0]) <= 2 && Math.abs(c[1] - t[1]) <= 2 && Math.abs(c[2] - t[2]) <= 2) return name;
  }
  return null;
}

async function runAxe(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(({ url, integrity }) => new Promise((resolve, reject) => {
    if (window.axe) return resolve(); // already injected (e.g. second context pass)
    const s = document.createElement('script');
    s.src = url; s.integrity = integrity; s.crossOrigin = 'anonymous';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('axe-core failed to load (SRI mismatch or network)'));
    document.head.appendChild(s);
  }), AXE_CDN);
  const violations = await page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] });
    return r.violations.map((v) => {
      const o = { id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length };
      if (v.id === 'color-contrast') { // carry axe's computed fg/bg + ratio out to node for a concrete OKLCH fix
        const node = (v.nodes || []).find((n) => (n.any || []).some((c) => c.data && c.data.fgColor));
        const chk = node && (node.any || []).find((c) => c.data && c.data.fgColor);
        if (chk) o.contrastData = { fg: chk.data.fgColor, bg: chk.data.bgColor, ratio: chk.data.contrastRatio, required: chk.data.expectedContrastRatio, target: (node.target || [])[0] };
      }
      return o;
    });
  });
  // Collect the page's :root --color-* tokens resolved to rgb() (only when a contrast fix actually needs one), so the
  // suggestion can name the token to edit rather than a generic "text".
  let customProps = {};
  if (violations.some((v) => v.id === 'color-contrast' && v.contrastData)) {
    customProps = await page.evaluate(() => {
      const out = {};
      const rs = getComputedStyle(document.documentElement);
      const probe = document.createElement('span');
      probe.style.display = 'none';
      document.body.appendChild(probe);
      for (let i = 0; i < rs.length; i++) {
        const p = rs[i];
        if (!/^--color-/i.test(p)) continue;
        probe.style.color = '';
        probe.style.color = `var(${p})`;
        const resolved = getComputedStyle(probe).color;
        if (/^rgb/i.test(resolved)) out[p] = resolved;
      }
      probe.remove();
      return out;
    }).catch(() => ({}));
  }
  // Enrich color-contrast in node (the OKLCH math lives here): name the offending text color and suggest a fix.
  for (const v of violations) {
    if (v.id === 'color-contrast' && v.contrastData) {
      const cd = v.contrastData;
      const sugg = suggestPassingOklch(cd.fg, cd.bg, cd.required);
      const req = parseFloat(String(cd.required)) || 4.5; // axe gives "4.5:1" — parse so the message reads "needs 4.5:1", not "4.5:1:1"
      const token = _findColorToken(cd.fg, customProps);
      v.contrast = { fg: cd.fg, bg: cd.bg, ratio: cd.ratio, required: cd.required, target: cd.target };
      v.suggestion = `text ${cd.fg} on ${cd.bg} is ${cd.ratio}:1 (needs ${req}:1) — ` +
        (sugg ? `set the ${token || 'text'} token to ${sugg} (same hue/chroma, raised lightness/contrast)` : 'darken the text or lighten the background; no in-gamut OKLCH at this hue/chroma reaches the target');
      delete v.contrastData;
    }
  }
  return violations;
}

// Broken-asset gate (always-on; ASSETS=0 opts out). watchAssets must be wired BEFORE goto().
const ASSETS_ON = process.env.ASSETS !== '0';
const GATEABLE = new Set(['document', 'image', 'font', 'stylesheet', 'script', 'media']); // skip xhr/fetch/beacons
function watchAssets(page) {
  const bad = [];
  page.on('response', (r) => { try { if (r.status() >= 400 && GATEABLE.has(r.request().resourceType())) bad.push({ url: r.url(), status: r.status(), type: r.request().resourceType() }); } catch (_) {} });
  page.on('requestfailed', (r) => { try { if (GATEABLE.has(r.resourceType())) bad.push({ url: r.url(), status: 'failed', type: r.resourceType(), err: r.failure() && r.failure().errorText }); } catch (_) {} });
  return bad;
}
async function brokenImages(page) {
  return page.evaluate(() => Array.from(document.images).filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src)).catch(() => []);
}

// Visual-regression comparator — resolve Playwright's bundled image comparator from the GLOBAL playwright
// (NODE_PATH=$(npm root -g)). Returns null if unavailable (the skill bundles patchright-core, which compiles
// the comparator into coreBundle.js and does NOT expose this path) → VR then reports gate.visualClean=null.
function loadComparator() {
  const roots = [];
  try { roots.push(path.dirname(require.resolve('playwright-core'))); } catch (_) {}
  try { roots.push(path.join(path.dirname(require.resolve('playwright')), 'node_modules', 'playwright-core')); } catch (_) {}
  const rels = ['lib/server/utils/comparators.js', 'lib/utils/comparators.js'];
  for (const root of roots) for (const rel of rels) {
    try { const m = require(path.join(root, rel)); const g = m.getComparator || (m.default && m.default.getComparator); if (g) return g; } catch (_) {}
  }
  return null;
}

// CWV tripwire (PERF=1). LCP/CLS/longtask entries are ONLY delivered via a buffered PerformanceObserver —
// getEntriesByType() does NOT return them — so register observers via addInitScript BEFORE navigation and
// read them back later. (resource entries, used for the byte budget, DO survive getEntriesByType.)
const PERF_ON = !!process.env.PERF;
function initCwv() {
  window.__cwv = { cls: 0, lcp: null, blocking: 0 };
  const obs = (type, cb) => { try { new PerformanceObserver((l) => cb(l.getEntries())).observe({ type, buffered: true }); } catch (_) {} };
  obs('layout-shift', (es) => { for (const e of es) if (!e.hadRecentInput) window.__cwv.cls += e.value; });
  obs('largest-contentful-paint', (es) => { window.__cwv.lcp = es[es.length - 1].startTime; });
  obs('longtask', (es) => { for (const e of es) window.__cwv.blocking += Math.max(0, e.duration - 50); });
}

// Browser launch with fallback chain. /design-setup installs the patchright/playwright BUNDLED Chromium, so try
// that FIRST; fall back to system Google Chrome (channel:'chrome'); on total failure throw a plain-language fix.
async function launchBrowser() {
  const chromium = loadChromium();
  let bundledErr = null, chromeErr = null;
  try { return await chromium.launch({ headless: true }); } // PRIMARY: bundled chromium (/design-setup installs this)
  catch (e) { bundledErr = e; }
  try { return await chromium.launch({ channel: 'chrome', headless: true }); } // fallback: system Google Chrome
  catch (e) { chromeErr = e; }
  throw new Error(
    'Could not launch a browser. The bundled Chromium failed to launch (' + (bundledErr && bundledErr.message) +
    ') and system Google Chrome was also unavailable (' + (chromeErr && chromeErr.message) + '). ' +
    'Fix: run /design-setup — it runs `npm install` then `npx patchright install chromium` to install the bundled ' +
    'browser this script expects — or install Google Chrome (https://www.google.com/chrome/). ' +
    'If you only need a quick text-level lint without a browser, re-run with STATIC=1.'
  );
}

// STATIC=1 — no-browser text lint. Parses the HTML file as a string and emits a partial gate so users get SOME
// signal before /design-setup installs a browser. Heuristic by design (regex over source, not a rendered DOM).
const BANNED_FONTS = ['Inter', 'Roboto', 'Arial', 'Open Sans', 'Lato', 'system-ui'];
function runStaticLint() {
  if (!fs.existsSync(target)) {
    console.error('STATIC lint: file not found:', target);
    process.exit(1);
  }
  const htmlRaw = fs.readFileSync(target, 'utf8');
  // Strip HTML comments FIRST so commented-out markup never trips a gate — a commented <img> example, a "NOT
  // Inter/Roboto…" usage note, or a sample purple hex inside <!-- … --> are documentation, not shipped pixels.
  // Every text heuristic below runs on this comment-free source.
  const html = htmlRaw.replace(/<!--[\s\S]*?-->/g, ' ');
  // (1) banned fonts — collect the ACTUAL font-family declaration VALUES and the family= params of font-CDN <link>s,
  // then match each banned name on WORD BOUNDARIES. Bounding the declaration value with ;}{"'<> stops the old bug
  // where `font-family[^;}{]*` bled past `font-family:var(--x)">…the entire interface` and matched "Inter" inside
  // "interface"; the \b…\b anchors stop other substring hits ("Roboto"/"Lato" inside prose).
  const fontScopes = [];
  let fdm; const FONT_DECL = /font-family\s*:\s*([^;}{"'<>]*)/gi;
  while ((fdm = FONT_DECL.exec(html))) fontScopes.push(fdm[1]);
  let hrf; const HREF_VAL = /href\s*=\s*("([^"]*)"|'([^']*)')/gi;
  const FONT_CDN = /fonts\.googleapis|fonts\.gstatic|api\.fontshare|fonts\.bunny|use\.typekit/i;
  while ((hrf = HREF_VAL.exec(html))) {
    const href = hrf[2] || hrf[3] || '';
    if (!FONT_CDN.test(href)) continue;
    let fam; const FAMILY = /family=([^&]*)/gi;
    while ((fam = FAMILY.exec(href))) { try { fontScopes.push(decodeURIComponent(fam[1]).replace(/\+/g, ' ')); } catch (_) { fontScopes.push(fam[1].replace(/\+/g, ' ')); } }
  }
  const fontScope = fontScopes.join('\n');
  const bannedFonts = [];
  for (const f of BANNED_FONTS) {
    const re = new RegExp('\\b' + f.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\s+/g, '[\\s+]+') + '\\b', 'i');
    if (re.test(fontScope)) bannedFonts.push(f);
  }
  // (2) raw hex / rgb() color used OUTSIDE a token block (@theme {...}, :root {...}, or any <style>...</style>).
  // Blank out token/style regions, then look ONLY inside inline style="..." attrs and Tailwind arbitrary values
  // ([#...]) of the remaining markup — this is where a *color* legitimately lives. Restricting to those zones (plus
  // valid 3/6/8-digit hex on a word boundary) stops the old false-positive on visible text like an order no. "#1042"
  // (4 digits → not valid hex; and it sits in a text node, not a style attr).
  let scrubbed = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/@theme[\s\S]*?\{[\s\S]*?\}/gi, ' ')
    .replace(/:root[\s\S]*?\{[\s\S]*?\}/gi, ' ');
  // valid hex = exactly 3, 6, or 8 hex digits, terminated by a word boundary (rejects #1042, #abcde, etc.)
  const HEX = '#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\\b';
  const colorZones = [];
  let zm;
  const STYLE_ATTR = /style\s*=\s*("([^"]*)"|'([^']*)')/gi;       // inline style attribute values
  while ((zm = STYLE_ATTR.exec(scrubbed))) colorZones.push(zm[2] || zm[3] || '');
  const ARBITRARY = /\[([^\]]*#[^\]]*)\]/g;                       // Tailwind arbitrary value e.g. bg-[#7c3aed]
  while ((zm = ARBITRARY.exec(scrubbed))) colorZones.push(zm[1]);
  const RAW_COLOR = new RegExp(HEX + '|rgba?\\(\\s*\\d', 'g');
  const rawColors = [...new Set(colorZones.join(' ').match(RAW_COLOR) || [])].slice(0, 24);
  // (2b) AI-default color families (scan the WHOLE source incl. tokens — shipping AI-purple is the cardinal slop).
  // Known hex defaults + oklch/hsl in the purple hue band 270–310 (oklch needs real chroma so neutral hue-275 grays
  // — e.g. the scaffold's --brand-ink oklch(0.205 0.012 275) — are NOT flagged).
  const AI_HEX = ['#7c3aed', '#6366f1', '#8b5cf6', '#a855f7', '#4f46e5'];
  const aiDefaultColors = [];
  for (const h of AI_HEX) if (new RegExp(h.replace('#', '#') + '\\b', 'i').test(html)) aiDefaultColors.push(h);
  let cm;
  const OKLCH = /oklch\(\s*[\d.]+%?\s+([\d.]+)\s+([\d.]+)/gi; // oklch(L C H ...)
  while ((cm = OKLCH.exec(html))) { const C = parseFloat(cm[1]), H = parseFloat(cm[2]); if (C >= 0.04 && H >= 270 && H <= 310) aiDefaultColors.push(`oklch(h=${H})`); }
  const HSL = /hsl[a]?\(\s*([\d.]+)/gi; // hsl(H ...)
  while ((cm = HSL.exec(html))) { const H = parseFloat(cm[1]); if (H >= 270 && H <= 310) aiDefaultColors.push(`hsl(h=${H})`); }
  const aiDefaults = [...new Set(aiDefaultColors)].slice(0, 24);
  // (3) naive fixed-width overflow risk — inline width:NNNpx or w-[NNNpx] over the 390px mobile viewport.
  const widthHits = [];
  // Bare `width:NNNpx` or Tailwind `w-[NNNpx]` only — exclude max-width/min-width (constraints, never overflow).
  const WIDTH_RE = /(?:(?<![a-z-])width\s*:\s*|\bw-\[)(\d{3,})px/gi;
  let m;
  while ((m = WIDTH_RE.exec(html)) && widthHits.length < 24) {
    const px = Number(m[1]);
    if (px > 390) widthHits.push(px);
  }
  // (4) <img> with no alt attribute.
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  const imgNoAlt = imgs.filter((t) => !/\balt\s*=/i.test(t)).length;
  // (5) naive low-contrast text/bg — within a single inline style="..." that sets BOTH a 6-digit hex color and a
  // 6-digit hex background, compute the WCAG ratio; <4.5 is flagged. Naive by design (no resolved cascade/vars).
  const lum = (hex) => { const n = parseInt(hex.slice(1), 16); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
  const lowContrast = [];
  let sm; const STYLE_FOR_CONTRAST = /style\s*=\s*("([^"]*)"|'([^']*)')/gi;
  while ((sm = STYLE_FOR_CONTRAST.exec(html)) && lowContrast.length < 12) {
    const s = sm[2] || sm[3] || '';
    const fg = (s.match(/(?:^|[;{\s])color\s*:\s*(#[0-9a-fA-F]{6})\b/) || [])[1];
    const bg = (s.match(/background(?:-color)?\s*:\s*(#[0-9a-fA-F]{6})\b/) || [])[1];
    if (fg && bg) { const L1 = lum(fg) + 0.05, L2 = lum(bg) + 0.05; const ratio = Math.max(L1, L2) / Math.min(L1, L2); if (ratio < 4.5) lowContrast.push(`${fg} on ${bg} (${ratio.toFixed(2)}:1)`); }
  }
  // (6) STRUCTURAL slop smells (warnings only) — cheap regex approximations of the real visual gate:
  //   - text-align:center / Tailwind text-center on MANY blocks (centered-everything is an AI tell)
  //   - >=3 sibling-equal cards (same class signature repeated 3+ times) - a uniform card grid
  //   - big-number hero (a huge font-size whose text is mostly a number/percent near the top)
  const structuralSlop = [];
  // Centered-everything tell — count ELEMENTS that center themselves but EXCLUDE headings (a centered h1/h2 is normal
  // hierarchy, not the "center everything" smell). Scanning opening tags means a single centered <h2> no longer
  // inflates the count the way the old whole-document `text-align:center` substring tally did.
  let centerCount = 0; let tg; const TAG_RE = /<([a-z][a-z0-9]*)\b([^>]*)>/gi;
  while ((tg = TAG_RE.exec(html))) {
    const tag = tg[1].toLowerCase(); const attrs = tg[2];
    if (/^h[1-6]$/.test(tag)) continue;
    if (/text-align\s*:\s*center/i.test(attrs) || /(?:^|["'\s])text-center(?:["'\s]|$)/.test(attrs)) centerCount++;
  }
  if (centerCount >= 5) structuralSlop.push(`text-align:center on ${centerCount} blocks`);
  // Sibling-equal CARD grid — count repeats ONLY of card-like class signatures (a `card`/`tile` token), so a utility
  // class repeated across the page (every `<p class="text-muted">`, every `<a class="nav-item">`) is no longer
  // miscounted as a uniform card grid (the old bug counted ANY identical class string 3+ times).
  const classSig = {};
  for (const cm2 of html.matchAll(/class\s*=\s*"([^"]{8,})"/gi)) {
    const k = cm2[1].trim().replace(/\s+/g, ' ');
    // Only COMPOUND card/tile signatures (feature-card, product-card, tile…) count as a uniform-card-grid tell.
    // Reuse of the ONE documented base primitive `card` (the suite's prescribed class, e.g. class="card reveal")
    // is intended structure, not slop — so exclude a signature whose only card/tile token is the bare base `card`.
    const cardTokens = k.split(' ').filter((t) => /(?:^|-)(?:card|tile)(?:-|$)/i.test(t));
    if (cardTokens.length === 0) continue;
    if (cardTokens.length === 1 && /^card$/i.test(cardTokens[0])) continue;
    classSig[k] = (classSig[k] || 0) + 1;
  }
  const maxRepeat = Object.entries(classSig).sort((a, b) => b[1] - a[1])[0];
  if (maxRepeat && maxRepeat[1] >= 3) structuralSlop.push(`${maxRepeat[1]} sibling-equal cards (class "${maxRepeat[0].slice(0, 40)}")`);
  const heroZone = html.slice(0, 3500);
  if (/font-size\s*:\s*(?:clamp\([^)]*?(\d{2,})px[^)]*\)|(\d{2,})px)/i.test(heroZone)) {
    const fsMatch = heroZone.match(/font-size\s*:\s*(?:clamp\([^)]*?(\d{2,})px[^)]*\)|(\d{2,})px)/i);
    const big = Number(fsMatch[1] || fsMatch[2]);
    if (big >= 56 && />[^<]*?\d[\d,.%]*\b[^<]*</.test(heroZone) && /<(h1|h2|div|p|span)[^>]*font-size[^>]*>[\s\d,.%원$₩+\-]+</i.test(heroZone)) structuralSlop.push(`big-number hero (~${big}px)`);
  }

  const checks = [
    { name: 'bannedFonts', pass: bannedFonts.length === 0, detail: bannedFonts.length ? bannedFonts.join(',') : 'none', severity: 'block' },
    { name: 'rawColorOutsideTokens', pass: rawColors.length === 0, detail: rawColors.length ? rawColors.join(' ') : 'none', severity: 'block' },
    { name: 'aiDefaultColors', pass: aiDefaults.length === 0, detail: aiDefaults.length ? aiDefaults.join(' ') : 'none', severity: 'block' },
    { name: 'fixedWidthOverflowRisk', pass: widthHits.length === 0, detail: widthHits.length ? widthHits.join(',') + 'px > 390' : 'none', severity: 'block' },
    { name: 'imgMissingAlt', pass: imgNoAlt === 0, detail: imgNoAlt ? imgNoAlt + ' <img> without alt' : 'none', severity: 'block' },
    { name: 'lowContrast', pass: lowContrast.length === 0, detail: lowContrast.length ? lowContrast.join('; ') : 'none', severity: 'warn' },
    { name: 'structuralSlop', pass: structuralSlop.length === 0, detail: structuralSlop.length ? structuralSlop.join('; ') : 'none', severity: 'warn' },
  ];
  const overall = checks.filter((c) => c.severity === 'block').every((c) => c.pass !== false);
  const summary = {
    mode: 'static', url, outDir, file: target,
    // STATIC mode renders NO pixels — flag it so a static pass is never mistaken for a verified, pixel-gated ship.
    rendered: false,
    note: 'advisory - static lint only, run /design-setup for the full pixel gate',
    static: { bannedFonts, rawColors, aiDefaults, fixedWidthOverPx: widthHits, imgMissingAlt: imgNoAlt, lowContrast, structuralSlop },
    gate: { report: { overall, checks } },
    files: [],
  };
  fs.writeFileSync(path.join(outDir, 'run.json'), JSON.stringify(summary, null, 2));
  console.log('STATIC lint ' + (overall ? 'PASS' : 'FAIL') + ':');
  // warn-severity checks (lowContrast, structuralSlop) are advisory — label them [WARN], not [FAIL].
  for (const c of checks) console.log('  [' + (c.pass ? 'PASS' : (c.severity === 'warn' ? 'WARN' : 'FAIL')) + '] ' + c.name + ' — ' + c.detail);
  console.log(JSON.stringify(summary));
  if (process.env.GATE_EXIT && overall === false) process.exit(1); // same opt-in hard exit as the browser path
}

// FILMSTRIP=1 / MOTION=1 — capture frames across the entrance window, then audit motion via getComputedStyle.
const MOTION_ON = !!process.env.FILMSTRIP || !!process.env.MOTION;
// REDUCED_MOTION=1 (or any FILMSTRIP/MOTION pass) → also run the reduced-motion capture gate (A).
const REDUCED_MOTION_ON = MOTION_ON || !!process.env.REDUCED_MOTION;
// MOTION_TRIGGER='sel:event' (B) — opt-in interaction filming. Pipe-separate ('a:click|.menu:hover') for several.
// Also supports 'scroll:<selector>' (C) — scroll the element into view and film the reveal window.
const MOTION_TRIGGER = process.env.MOTION_TRIGGER || '';
// prefix lets the mobile entrance filmstrip (C) write distinct files so it never overwrites the desktop strip.
async function captureFilmstrip(page, prefix = 'filmstrip') {
  const stamps = [0, 120, 250, 400, 700, 1100, 1500];
  const frames = [];
  const start = Date.now();
  for (const t of stamps) {
    const wait = t - (Date.now() - start);
    if (wait > 0) await sleep(wait);
    const f = `${prefix}-${String(t).padStart(4, '0')}.png`;
    try { await page.screenshot({ path: path.join(outDir, f) }); frames.push(f); } catch (_) {}
  }
  return frames;
}

// (A) REDUCED-MOTION capture gate. Emulate prefers-reduced-motion:reduce, let media queries re-resolve, SHOOT a
// filmstrip (so the floor is proven from pixels, not just style reads), then assert every element's ACTIVE
// transition/animation duration collapses to ~0 AND that document.getAnimations() holds no still-running WAAPI/Framer
// animation (JS motion ignores @media reduce unless the page's own code honors it). A page whose @media (reduce) block
// is a no-op duplicate — or that animates purely via JS — leaves real motion alive → honored=false (BLOCK).
// honored=null only if the eval itself throws (unknown, never a silent pass). Emulation is restored before returning.
async function auditReducedMotion(page) {
  let res;
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await sleep(150);
    const filmstrip = await captureFilmstrip(page, 'reduced-motion'); // prove the reduced-motion state from pixels
    res = await page.evaluate(() => {
      const parseDur = (s) => String(s || '').split(',').map((x) => {
        x = x.trim();
        if (x.endsWith('ms')) return parseFloat(x);
        if (x.endsWith('s')) return parseFloat(x) * 1000;
        return parseFloat(x) || 0;
      });
      const offenders = []; let scanned = 0;
      for (const el of document.querySelectorAll('body *')) {
        if (scanned > 4000) break; scanned++;
        const cs = getComputedStyle(el);
        const tProp = cs.transitionProperty || 'none';
        const tDur = parseDur(cs.transitionDuration).filter((d) => d > 1); // >1ms = NOT collapsed
        const aName = cs.animationName || 'none';
        const aDur = parseDur(cs.animationDuration).filter((d) => d > 1);
        const activeTrans = tProp !== 'none' && tDur.length > 0;
        const activeAnim = aName !== 'none' && aName !== '' && aDur.length > 0;
        if (activeTrans || activeAnim) {
          const sel = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
          offenders.push({ sel, transitionMs: activeTrans ? Math.round(Math.max(...tDur)) : 0, animationMs: activeAnim ? Math.round(Math.max(...aDur)) : 0 });
          if (offenders.length >= 20) break;
        }
      }
      // WAAPI / Web Animations (Framer Motion, element.animate(...)) do NOT respond to @media reduce on their own — a
      // running animation here means the served/React reduced-motion floor is NOT actually honored. Assert empty/paused.
      try {
        for (const anim of ((typeof document.getAnimations === 'function') ? document.getAnimations() : [])) {
          if (offenders.length >= 20) break;
          const cn = anim.constructor && anim.constructor.name;
          if (cn === 'CSSAnimation' || cn === 'CSSTransition') continue; // CSS motion already caught by the computed-style scan above
          const eff = anim.effect;
          const tm = (eff && typeof eff.getTiming === 'function') ? eff.getTiming() : null;
          const dur = tm && typeof tm.duration === 'number' ? tm.duration : 0;
          if (anim.playState === 'running' && dur > 1) {
            const t = eff.target;
            const sel = (t && t.tagName) ? t.tagName.toLowerCase() : '(waapi)';
            offenders.push({ sel, transitionMs: 0, animationMs: Math.round(dur), source: 'waapi' });
          }
        }
      } catch (_) {}
      return { honored: offenders.length === 0, offenders };
    });
    res.filmstrip = filmstrip;
  } catch (e) { res = { honored: null, offenders: [], error: e.message }; }
  try { await page.emulateMedia({ reducedMotion: 'no-preference' }); } catch (_) {}
  return res;
}

// (B) INTERACTION filming. Parse 'selector:event' (event = trailing token only if it's a known event name, so CSS
// pseudo-classes like button:first-child stay part of the selector). Screenshot a pre frame, dispatch the event,
// film a ~600ms window, then run the SAME analyzeMotion property/duration audit so state→state motion is pixel-proven.
const TRIGGER_EVENTS = new Set(['click', 'hover', 'focus', 'mouseenter', 'mouseover', 'mousedown', 'press', 'tap']);
function parseTrigger(spec) {
  const idx = spec.lastIndexOf(':');
  if (idx > 0) {
    const maybe = spec.slice(idx + 1).toLowerCase();
    if (TRIGGER_EVENTS.has(maybe)) return { selector: spec.slice(0, idx).trim(), event: maybe };
  }
  return { selector: spec.trim(), event: 'click' };
}
async function filmOneInteraction(page, spec) {
  // 'scroll:<selector>' (C) — scroll-into-view reveal mode: film the element OFF-screen, scroll it into view to fire
  // scroll/IntersectionObserver entrance animations, film the reveal window, then run the SAME duration/easing/layout
  // audit. Otherwise parse 'selector:event' as before (event = trailing click/hover/focus/…).
  const isScroll = /^scroll\s*:/i.test(spec);
  const { selector, event } = isScroll ? { selector: spec.replace(/^scroll\s*:/i, '').trim(), event: 'scroll' } : parseTrigger(spec);
  const result = { trigger: spec, selector, event, frames: [], durations: [], layoutAnimated: [], warnings: [], easings: [] };
  const safe = (isScroll ? 'scroll_' : '') + selector.replace(/[^a-z0-9_-]/gi, '_').slice(0, 24);
  const shot = async (tag) => { const f = `interact-${safe}-${tag}.png`; try { await page.screenshot({ path: path.join(outDir, f) }); result.frames.push(f); } catch (_) {} };
  let el;
  try { el = page.locator(selector).first(); await el.waitFor({ state: 'attached', timeout: 2500 }); }
  catch (e) { result.error = 'selector not found: ' + selector; return result; }
  if (isScroll) await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {}); // start above the reveal so the pre frame is the un-revealed state
  await shot('pre');
  try {
    if (event === 'scroll') await el.scrollIntoViewIfNeeded({ timeout: 2500 });
    else if (event === 'hover' || event === 'mouseenter' || event === 'mouseover') await el.hover({ timeout: 2500, force: true });
    else if (event === 'focus') await el.focus({ timeout: 2500 });
    else await el.click({ timeout: 2500, force: true }); // force: bypass actionability so a covered/anchored CTA still fires
  } catch (e) { result.error = 'dispatch failed: ' + e.message; }
  const stamps = [60, 160, 300, 450, 600];
  const start = Date.now();
  for (const t of stamps) { const w = t - (Date.now() - start); if (w > 0) await sleep(w); await shot(String(t)); }
  const audit = await analyzeMotion(page, selector); // scope the post-trigger read to the triggered subtree
  result.durations = audit.durations; result.layoutAnimated = audit.layoutAnimated; result.warnings = audit.warnings; result.easings = audit.easings; result.jsAnimations = audit.jsAnimations || [];
  if (audit.error) result.error = (result.error ? result.error + '; ' : '') + audit.error;
  return result;
}
async function filmInteractions(page, spec) {
  const specs = spec.split('|').map((s) => s.trim()).filter(Boolean); // pipe-separated → commas stay inside selectors
  const out = [];
  for (const s of specs) out.push(await filmOneInteraction(page, s));
  return out;
}
async function analyzeMotion(page, scopeSelector = null) {
  return page.evaluate((scopeSelector) => {
    // Fallback band when the page declares no --dur tokens. Includes 150 (a common committed token) so a 150ms
    // duration is never flagged off-token on a page that didn't expose its band as a custom property.
    const FALLBACK_BAND = [120, 150, 200, 250, 320, 400, 700];
    const LAYOUT = ['width', 'height', 'top', 'left', 'right', 'bottom', 'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left'];
    const parseDur = (s) => String(s || '').split(',').map((x) => {
      x = x.trim();
      if (x.endsWith('ms')) return parseFloat(x);
      if (x.endsWith('s')) return parseFloat(x) * 1000;
      return parseFloat(x) || 0;
    });
    const parseMs = (v) => { v = String(v || '').trim(); if (v.endsWith('ms')) return parseFloat(v); if (v.endsWith('s')) return parseFloat(v) * 1000; const n = parseFloat(v); return isNaN(n) ? null : n; };
    // Split a CSS value-list on TOP-LEVEL commas only, so a timing function's own commas (cubic-bezier(0, 0, .2, 1))
    // are not mistaken for the separator between two transitions. Returns the trimmed, non-empty segments.
    const splitTop = (s) => { const out = []; let depth = 0, cur = ''; for (const ch of String(s || '')) { if (ch === '(') depth++; else if (ch === ')') depth = Math.max(0, depth - 1); if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map((x) => x.trim()).filter(Boolean); };
    // Map @keyframes name -> { animated props, enter easing (0%/from), exit easing (100%/to) } AND harvest the page's
    // --dur-*/--duration-* design tokens, so the off-token audit accepts THIS page's committed motion band (e.g. a
    // 150ms token) instead of only a hardcoded list, and so per-keyframe easing is available to the easing audit.
    const kf = {}, kfEase = {}, tokenDurs = [];
    const collectTokens = (style) => { if (!style) return; for (let i = 0; i < style.length; i++) { const p = style[i]; if (/^--(dur|duration)/i.test(p)) { const ms = parseMs(style.getPropertyValue(p)); if (ms != null && ms > 0) tokenDurs.push(ms); } } };
    for (const ss of document.styleSheets) {
      let rules; try { rules = ss.cssRules; } catch (_) { continue; }
      if (!rules) continue;
      for (const r of rules) {
        if (r.style) collectTokens(r.style); // :root / * custom-property declarations carry the --dur-* tokens
        const isKf = (typeof CSSRule !== 'undefined' && r.type === CSSRule.KEYFRAMES_RULE) || (r.constructor && r.constructor.name === 'CSSKeyframesRule');
        if (!isKf) continue;
        const props = new Set(); let enterEase = null, exitEase = null;
        for (const k of (r.cssRules || [])) {
          for (let i = 0; i < k.style.length; i++) props.add(k.style[i]);
          const ease = k.style.animationTimingFunction || k.style.getPropertyValue('animation-timing-function');
          const key = (k.keyText || '').trim();
          if (ease) { if (/(^|[\s,])(0%|from)([\s,]|$)/.test(key)) enterEase = ease; if (/(^|[\s,])(100%|to)([\s,]|$)/.test(key)) exitEase = ease; }
        }
        kf[r.name] = [...props];
        kfEase[r.name] = { enter: enterEase, exit: exitEase };
      }
    }
    const band = [...new Set([...FALLBACK_BAND, ...tokenDurs])];
    // CSS `ease` resolves to this cubic-bezier; treat it + `linear` as the "default/flat" entrance the critic dings.
    const DEFAULT_EASE = (e) => { e = String(e || '').trim().toLowerCase(); return e === '' || e === 'linear' || e === 'ease' || e === 'initial' || e === 'cubic-bezier(0.25, 0.1, 0.25, 1)'; };
    const durations = [], layoutAnimated = [], warnings = [], easings = [];
    // When invoked after an interaction trigger, scope the audit to the triggered subtree (the element + its
    // descendants) instead of the whole page, so the post-trigger motion read reflects what the trigger actually moved.
    const scopeRoot = scopeSelector ? document.querySelector(scopeSelector) : null;
    const scanList = scopeSelector
      ? (scopeRoot ? [scopeRoot, ...scopeRoot.querySelectorAll('*')] : [])
      : document.querySelectorAll('body *');
    let scanned = 0;
    for (const el of scanList) {
      if (scanned > 4000) break; scanned++;
      const cs = getComputedStyle(el);
      const transProp = cs.transitionProperty || 'none';
      const transDurs = parseDur(cs.transitionDuration).filter((d) => d > 0);
      // The computed transition-property defaults to 'all' on EVERY element; only a non-zero duration means a real
      // transition is actually defined — otherwise we'd flag the whole DOM (incl. <script>) as animated.
      const hasTrans = transProp !== 'none' && transDurs.length > 0;
      const animName = cs.animationName || 'none';
      const animDurs = parseDur(cs.animationDuration).filter((d) => d > 0);
      const hasAnim = animName !== 'none' && animName !== '' && animDurs.length > 0;
      if (!hasTrans && !hasAnim) continue;
      const sel = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
      // Read animation-iteration-count (index-aligned, cycling, with the CSS modulo rule) so an INFINITE/looping
      // animation — e.g. a skeleton pulse — is EXEMPT from the >600ms too-long rule (a loop is meant to be slow).
      // Transitions run once and never loop, so they always face the full too-long rule.
      const iterList = splitTop(cs.animationIterationCount || '');
      const isInfinite = (s) => /infinite/i.test(String(s || ''));
      const durEntries = [];
      if (hasTrans) for (const d of transDurs) durEntries.push({ ms: d, looping: false });
      if (hasAnim) animDurs.forEach((d, i) => durEntries.push({ ms: d, looping: isInfinite(iterList.length ? iterList[i % iterList.length] : '') }));
      for (const { ms, looping } of durEntries) {
        durations.push(Math.round(ms));
        const onToken = band.some((s) => Math.abs(s - ms) <= 40);
        const tooLong = ms > 600 && !looping;
        if (tooLong || !onToken) warnings.push({ sel, durationMs: Math.round(ms), reason: tooLong ? 'too-long' : 'off-token' });
      }
      // Easing audit (the critic grades easing). enter vs exit easing + the raw timing function: for a transition the
      // computed transition-timing-function is the symmetric ease; for an animation, prefer the per-keyframe 0%/100%
      // easing when present, else the element animation-timing-function. WARN on a linear/default-ease entrance, else
      // on a symmetric enter===exit (no asymmetry — flat, robotic motion).
      let enter, exit, fn;
      if (hasAnim) {
        const firstName = (animName.split(',')[0] || '').trim();
        const atf = splitTop(cs.animationTimingFunction)[0] || '';
        const ke = kfEase[firstName] || {};
        enter = ke.enter || atf; exit = ke.exit || atf; fn = atf;
      } else {
        fn = splitTop(cs.transitionTimingFunction)[0] || '';
        enter = fn; exit = fn;
      }
      if (easings.length < 60) easings.push({ sel, enter, exit, fn });
      if (DEFAULT_EASE(enter)) warnings.push({ sel, reason: 'linear-or-default-entrance', easing: enter });
      else if (enter && exit && enter === exit) warnings.push({ sel, reason: 'no-enter-exit-asymmetry', easing: enter });
      // layout-property animation (jank/banned motion) — from transition-property and/or keyframe props.
      const layoutHit = new Set();
      if (hasTrans) for (const p of transProp.split(',').map((s) => s.trim())) { if (p === 'all' || LAYOUT.includes(p)) layoutHit.add(p); }
      if (hasAnim) for (const name of animName.split(',').map((s) => s.trim())) { for (const p of (kf[name] || [])) if (LAYOUT.includes(p)) layoutHit.add(p); }
      if (layoutHit.size) layoutAnimated.push({ sel, props: [...layoutHit] });
    }
    // WAAPI / Web Animations (Framer Motion, element.animate(...)) — invisible to getComputedStyle, so the CSS scan
    // above misses them entirely. Read them from document.getAnimations(): duration + easing via effect.getTiming(),
    // animated properties via effect.getKeyframes(), and the effect target for a selector. Fold into the SAME
    // duration/layout audit (infinite/looping animations stay exempt from the too-long rule).
    const jsAnimations = [];
    try {
      const anims = (typeof document.getAnimations === 'function') ? document.getAnimations() : [];
      for (const anim of anims) {
        const eff = anim.effect;
        if (!eff || typeof eff.getTiming !== 'function') continue;
        const cn = anim.constructor && anim.constructor.name;
        if (cn === 'CSSAnimation' || cn === 'CSSTransition') continue; // CSS-declared motion is already covered by the computed-style scan above
        const target = eff.target || null;
        if (scopeRoot && target && !scopeRoot.contains(target) && target !== scopeRoot) continue; // scope to triggered subtree
        const tm = eff.getTiming();
        const ms = typeof tm.duration === 'number' ? tm.duration : 0;
        const looping = tm.iterations === Infinity;
        const easing = tm.easing || '';
        const sel = target && target.tagName
          ? target.tagName.toLowerCase() + (target.className && typeof target.className === 'string' ? '.' + target.className.trim().split(/\s+/).slice(0, 2).join('.') : '')
          : '(waapi)';
        const props = new Set();
        try { for (const k of eff.getKeyframes()) for (const key of Object.keys(k)) { if (key === 'offset' || key === 'computedOffset' || key === 'easing' || key === 'composite') continue; props.add(key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())); } } catch (_) {}
        const propList = [...props];
        jsAnimations.push({ sel, durationMs: Math.round(ms), easing, props: propList, iterations: looping ? 'infinite' : tm.iterations, playState: anim.playState });
        if (ms > 0) {
          durations.push(Math.round(ms));
          const onToken = band.some((s) => Math.abs(s - ms) <= 40);
          const tooLong = ms > 600 && !looping;
          if (tooLong || !onToken) warnings.push({ sel, durationMs: Math.round(ms), reason: tooLong ? 'too-long' : 'off-token', source: 'waapi' });
        }
        const layoutHit = propList.filter((p) => LAYOUT.includes(p));
        if (layoutHit.length) layoutAnimated.push({ sel, props: layoutHit, source: 'waapi' });
      }
    } catch (_) {}
    return { durations, layoutAnimated, warnings, easings, band, jsAnimations };
  }, scopeSelector).catch(() => ({ durations: [], layoutAnimated: [], warnings: [], easings: [], jsAnimations: [], error: 'motion eval failed' }));
}

(async () => {
  if (process.env.STATIC === '1') { runStaticLint(); return; } // no-browser text lint; never launches Chromium
  const browser = await launchBrowser();
  // Desktop
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 1600 }, deviceScaleFactor: 1 });
  const dp = await dctx.newPage();
  const badDesktop = ASSETS_ON ? watchAssets(dp) : null;
  if (PERF_ON) await dp.addInitScript(initCwv); // register CWV observers BEFORE the page loads
  await dp.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  // FILMSTRIP/MOTION (opt-in) — capture the entrance window FIRST (before the long settle below), then audit motion.
  // Also runs the opt-in interaction filming (B) and the reduced-motion capture gate (A) on this desktop page.
  let motion = null;
  if (MOTION_ON || REDUCED_MOTION_ON || MOTION_TRIGGER) {
    motion = {};
    if (MOTION_ON) {
      const frames = await captureFilmstrip(dp, 'filmstrip');
      const audit = await analyzeMotion(dp);
      Object.assign(motion, { frames, durations: audit.durations, easings: audit.easings, layoutAnimated: audit.layoutAnimated, warnings: audit.warnings, jsAnimations: audit.jsAnimations || [], ...(audit.band ? { band: audit.band } : {}), ...(audit.error ? { error: audit.error } : {}) });
    }
    if (MOTION_TRIGGER) {
      motion.interactions = await filmInteractions(dp, MOTION_TRIGGER); // (B) state→state transitions, screenshot-proven
    }
    if (REDUCED_MOTION_ON) {
      const rm = await auditReducedMotion(dp); // (A) emulate reduce, assert durations collapse to ~0
      motion.reducedMotionHonored = rm.honored;
      motion.reducedMotionOffenders = rm.offenders;
      if (rm.filmstrip) motion.reducedMotionFilmstrip = rm.filmstrip;
      if (rm.error) motion.reducedMotionError = rm.error;
    }
  }
  await sleep(800);
  // scroll to trigger lazy content + entrance animations, then back to top
  await dp.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 80)); } window.scrollTo(0, 0); });
  await sleep(600);
  const height = await dp.evaluate(() => document.body.scrollHeight);
  // CWV tripwire (opt-in via PERF=1) — read the buffered observer data (window.__cwv) + resource entries. Lab/load-only;
  // byte budget counts network resources (no-ops only when totalKB===0, i.e. a fully local page), a tripwire not CrUX.
  let perf = null, perfBudget = null;
  if (PERF_ON) {
    perf = await dp.evaluate(() => {
      const c = window.__cwv || { cls: 0, lcp: null, blocking: 0 };
      const res = performance.getEntriesByType('resource');
      const totalKB = Math.round(res.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024);
      const largestKB = Math.round(res.reduce((m, r) => Math.max(m, r.transferSize || 0), 0) / 1024);
      return { lcpMs: c.lcp != null ? Math.round(c.lcp) : null, cls: Math.round(c.cls * 1000) / 1000, blockingMs: Math.round(c.blocking), totalKB, largestKB };
    }).catch(() => null);
    if (perf) {
      const lcpOk = perf.lcpMs == null || perf.lcpMs <= Number(process.env.LCP_BUDGET_MS || 2500);
      const clsOk = perf.cls <= Number(process.env.CLS_BUDGET || 0.1);
      const byteOk = perf.totalKB === 0 || perf.totalKB <= Number(process.env.BYTE_BUDGET_KB || 2500); // file:// => 0 => no-op
      perfBudget = lcpOk && clsOk && byteOk;
    }
  }
  await dp.screenshot({ path: path.join(outDir, 'desktop-full.png'), fullPage: true });
  // tiles for close reading
  const tileH = 1600, tiles = Math.min(Math.ceil(height / tileH), maxTiles);
  for (let i = 0; i < tiles; i++) {
    await dp.evaluate((y) => window.scrollTo(0, y), i * tileH);
    await sleep(250);
    await dp.screenshot({ path: path.join(outDir, `desktop-tile_${String(i).padStart(2, '0')}.png`) });
  }
  // axe-core a11y scan (opt-in via AXE=1) — read-only, injected from CDN. Desktop pass here; mobile pass below.
  const AXE_ON = !!process.env.AXE;
  let axeDesktop = null, axeMobile = null, axeError = null;
  if (AXE_ON) {
    try { axeDesktop = await runAxe(dp); } catch (e) { axeError = e.message; }
  }
  const brokenD = ASSETS_ON ? await brokenImages(dp) : [];
  await dctx.close();
  // Mobile (the legibility check that catches Korean detail-page failures)
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const mp = await mctx.newPage();
  const badMobile = ASSETS_ON ? watchAssets(mp) : null;
  await mp.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  // (C) MOBILE entrance filmstrip — capture the load-entrance at the 390px context too, not only desktop.
  if (MOTION_ON) {
    const mframes = await captureFilmstrip(mp, 'filmstrip-mobile');
    if (motion) motion.mobileFrames = mframes; else motion = { mobileFrames: mframes };
  }
  await sleep(600);
  await mp.screenshot({ path: path.join(outDir, 'mobile-full.png'), fullPage: true });
  // Horizontal-overflow check at 390px — the silent killer of Korean detail pages. Detect, name culprits.
  const overflow = await mp.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const docW = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
    const culprits = [];
    if (docW > vw + 1) {
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        // element pushes past the right edge but isn't itself a full-bleed wrapper
        if (r.right > vw + 1 && r.width <= vw + 240 && r.height > 0) {
          culprits.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 48), right: Math.round(r.right) });
          if (culprits.length >= 12) break;
        }
      }
    }
    return { vw, docW, overflowPx: Math.max(0, docW - vw), culprits };
  }).catch(() => ({ vw: 390, docW: 390, overflowPx: 0, culprits: [] }));
  // Mobile a11y pass — scans the 390px DOM where the sticky purchase bar (desktop-hidden) is visible.
  if (AXE_ON && axeError === null) {
    try { axeMobile = await runAxe(mp); } catch (e) { axeError = e.message; }
  }
  const brokenM = ASSETS_ON ? await brokenImages(mp) : [];
  // Per-brand gate (opt-in via BRANDS=a,b) — prove each [data-brand] applies AND stays accessible/non-overflowing.
  // Reuses the SAME runAxe + overflow checks; records run.json.brands[]; the top-level gate stays the default brand.
  const BRANDS = (process.env.BRANDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  let brands = null;
  if (BRANDS.length) {
    brands = [];
    const minImpact = process.env.AXE_IMPACT || 'serious';
    for (const b of BRANDS) {
      await mp.evaluate((brand) => { if (brand === 'default') delete document.documentElement.dataset.brand; else document.documentElement.dataset.brand = brand; }, b);
      await sleep(150);
      const ov = await mp.evaluate(() => { const vw = document.documentElement.clientWidth; const docW = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0); return Math.max(0, docW - vw); }).catch(() => 0);
      let bAxeClean = null;
      if (AXE_ON) { try { const r = await runAxe(mp); bAxeClean = r.filter((v) => (AXE_RANK[v.impact] || 0) >= (AXE_RANK[minImpact] || 0)).length === 0; } catch (_) { bAxeClean = null; } }
      brands.push({ brand: b, mobileOverflowPx: ov, axeClean: bAxeClean, noOverflow: ov <= 1 });
    }
  }
  await mctx.close();
  const noOverflow = overflow.overflowPx <= 1;
  // Merge desktop + mobile violations by rule id (keep the higher impact); compute the gate over the union.
  let axe = null;
  if (AXE_ON) {
    const minImpact = process.env.AXE_IMPACT || 'serious';
    if (axeDesktop === null && axeMobile === null) {
      axe = { error: axeError || 'axe did not run' };
    } else {
      const byId = new Map();
      for (const v of [...(axeDesktop || []), ...(axeMobile || [])]) {
        const prev = byId.get(v.id);
        if (!prev || (AXE_RANK[v.impact] || 0) > (AXE_RANK[prev.impact] || 0)) byId.set(v.id, v);
      }
      const violations = [...byId.values()];
      const gating = violations.filter((v) => (AXE_RANK[v.impact] || 0) >= (AXE_RANK[minImpact] || 0));
      const contexts = [axeDesktop ? 'desktop' : null, axeMobile ? 'mobile' : null].filter(Boolean);
      axe = { violations, gatingCount: gating.length, gating, minImpact, contexts };
      if (axeError !== null) axe.partialError = axeError; // one context scanned, the other failed
    }
  }
  // true/false only when axe actually ran; null when it could not load (CDN down) — never a silent pass.
  const axeClean = !axe ? null : axe.error ? null : axe.gatingCount === 0;
  // Broken-asset rollup — merge both contexts, dedup by type|status|url.
  let assets = null, assetsOk = null;
  if (ASSETS_ON) {
    const seen = new Set();
    const badResponses = [...(badDesktop || []), ...(badMobile || [])].filter((b) => {
      const k = b.type + '|' + b.status + '|' + b.url; if (seen.has(k)) return false; seen.add(k); return true;
    });
    const brokenImagesList = [...new Set([...(brokenD || []), ...(brokenM || [])])];
    assets = { badResponses, brokenImages: brokenImagesList };
    assetsOk = badResponses.length === 0 && brokenImagesList.length === 0;
  }
  // Visual regression (opt-in via VR=1 / VR_BASELINE=1) — diff desktop+mobile vs an approved baseline.
  const VR_ON = !!process.env.VR || !!process.env.VR_BASELINE;
  let visualRegression = null, visualClean = null;
  if (VR_ON) {
    const getComparator = loadComparator();
    if (!getComparator) {
      visualRegression = { error: 'image comparator unavailable — run under global playwright (NODE_PATH=$(npm root -g))' };
      visualClean = null; // unknown, never a silent pass
    } else {
      const pageId = (process.env.VR_ID || path.basename(target)).replace(/[^a-z0-9._-]/gi, '_');
      const baseDir = path.join(__dirname, '..', 'baselines', pageId);
      const views = [['desktop', 'desktop-full.png'], ['mobile', 'mobile-full.png']];
      if (process.env.VR_BASELINE) {
        fs.mkdirSync(baseDir, { recursive: true });
        for (const [, f] of views) fs.copyFileSync(path.join(outDir, f), path.join(baseDir, f));
        visualRegression = { baseline: baseDir, wrote: views.map((v) => v[1]) };
        visualClean = null; // a baseline-write run makes no assertion
      } else {
        const cmp = getComparator('image/png');
        const ratio = Number(process.env.VR_RATIO || 0.02);
        const results = [];
        for (const [v, f] of views) {
          const basePath = path.join(baseDir, f);
          if (!fs.existsSync(basePath)) { results.push({ view: v, status: 'no-baseline' }); continue; }
          const res = cmp(fs.readFileSync(path.join(outDir, f)), fs.readFileSync(basePath), { maxDiffPixelRatio: ratio });
          if (res === null) results.push({ view: v, pass: true });
          else { if (res.diff) fs.writeFileSync(path.join(outDir, v + '-diff.png'), res.diff); results.push({ view: v, pass: false, diff: v + '-diff.png' }); }
        }
        const compared = results.filter((r) => r.pass !== undefined);
        visualRegression = { baseline: baseDir, ratio, results };
        visualClean = compared.length === 0 ? null : compared.every((r) => r.pass);
      }
    }
  }
  // Machine-readable gate rollup — one structured verdict for the workflow / CI / enterprise report.
  // overall fails ONLY when a block-severity check is === false; null (unknown/skipped) never blocks.
  const checks = [{ name: 'overflow', pass: noOverflow, detail: `mobileOverflowPx=${overflow.overflowPx}`, severity: 'block' }];
  if (AXE_ON) checks.push({ name: 'axe', pass: axeClean, detail: axe && axe.error ? axe.error : `gatingCount=${axe ? axe.gatingCount : 0}`, severity: 'block' });
  if (ASSETS_ON) checks.push({ name: 'assets', pass: assetsOk, detail: `badResponses=${assets.badResponses.length} brokenImages=${assets.brokenImages.length}`, severity: 'block' });
  if (PERF_ON) checks.push({ name: 'perf', pass: perfBudget, detail: perf ? `lcp=${perf.lcpMs} cls=${perf.cls} totalKB=${perf.totalKB}` : 'perf unavailable', severity: 'block' });
  if (VR_ON) checks.push({ name: 'visual', pass: visualClean, detail: visualRegression && visualRegression.error ? visualRegression.error : 'see visualRegression', severity: 'block' });
  // Motion audit (opt-in) — layout-animated elements are a jank/banned-motion violation; surfaced as warn (never
  // hard-blocks the default build), with the offenders listed under run.json.motion.layoutAnimated.
  if (MOTION_ON && motion) checks.push({ name: 'motion', pass: (motion.layoutAnimated || []).length === 0, detail: `layoutAnimated=${(motion.layoutAnimated || []).length} warnings=${(motion.warnings || []).length}`, severity: 'warn' });
  // (A) reduced-motion is the real motion-craft gate → BLOCK. honored=null (eval failed) reads as unknown, never blocks.
  if (motion && motion.reducedMotionHonored !== undefined) checks.push({ name: 'reducedMotion', pass: motion.reducedMotionHonored, detail: `honored=${motion.reducedMotionHonored} offenders=${(motion.reducedMotionOffenders || []).length}`, severity: 'block' });
  // (B) interaction filming — flag layout-property animation in the triggered state as a warn (the films are the proof).
  if (motion && motion.interactions) {
    const li = motion.interactions.reduce((n, i) => n + (i.layoutAnimated || []).length, 0);
    const er = motion.interactions.filter((i) => i.error).length;
    // A trigger whose selector was NOT found (error set) or that captured NO frames proved nothing — it must NOT read
    // as pass:true. FAIL the check whenever any interaction errored or produced an empty filmstrip.
    const unproven = motion.interactions.filter((i) => i.error || (i.frames || []).length === 0).length;
    checks.push({ name: 'motionInteraction', pass: unproven > 0 ? false : li === 0, detail: `interactions=${motion.interactions.length} layoutAnimated=${li} errors=${er} unproven=${unproven}`, severity: 'warn' });
  }
  const reportOverall = checks.filter((c) => c.severity === 'block').every((c) => c.pass !== false);
  const summary = {
    url, outDir, pageHeight: height, desktopTiles: tiles, coveredHeight: tiles * tileH, maxTiles,
    mobileOverflowPx: overflow.overflowPx, overflowCulprits: overflow.culprits,
    axe,
    ...(ASSETS_ON ? { assets } : {}),
    ...(PERF_ON ? { perf } : {}),
    ...(VR_ON ? { visualRegression } : {}),
    ...(motion ? { motion } : {}),
    ...(brands ? { brands } : {}),
    gate: {
      noOverflow, axeClean,
      ...(ASSETS_ON ? { assetsOk } : {}),
      ...(PERF_ON ? { perfBudget } : {}),
      ...(VR_ON ? { visualClean } : {}),
      report: { overall: reportOverall, checks },
    },
    files: ['desktop-full.png', 'mobile-full.png', `desktop-tile_00..${String(tiles - 1).padStart(2, '0')}.png`],
  };
  fs.writeFileSync(path.join(outDir, 'run.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
  await browser.close();
  if (process.env.GATE_EXIT && reportOverall === false) process.exit(1); // opt-in hard exit; default stays 0
})().catch(e => { console.error('FATAL', e.message); process.exit(2); });
