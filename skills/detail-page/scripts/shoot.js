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
//      PERF=1 / LCP_BUDGET_MS (2500) / CLS_BUDGET (0.1) / BYTE_BUDGET_KB (2500).
//      STATIC=1 — NO-BROWSER lint mode: parse the HTML as text (no Chromium needed, works BEFORE /design-setup) and
//        emit a partial gate to run.json — banned fonts (Inter/Roboto/Arial/Open Sans/Lato/system-ui), raw hex/rgb
//        colors used OUTSIDE a @theme/:root/<style> token block, naive fixed-width mobile-overflow risk
//        (width:NNNpx / w-[NNNpx] over 390), and <img> without alt. Prints a PASS/FAIL summary; never launches a browser.
//      FILMSTRIP=1 (or MOTION=1) — capture ~6 frames over the first ~1500ms into <outDir>/filmstrip-*.png and read
//        getComputedStyle on animated/transitioned elements → run.json.motion {frames, durations, layoutAnimated[]}:
//        warns on durations >600ms or off-token, and FLAGS any element animating a layout property
//        (width/height/top/left/right/bottom/margin) as a jank/banned-motion violation (prefer transform/opacity).
//        The page itself still gates on prefers-reduced-motion; this only audits the motion that is defined.
//
// Browser launch: tries the patchright/playwright BUNDLED Chromium first (what /design-setup installs), then falls
//   back to system Google Chrome (channel:'chrome'); on total failure it throws a plain-language fix message.
// Resolve chromium LAZILY (only when a browser is actually launched) so STATIC=1 can text-lint with no browser
// package installed at all — the pre-/design-setup signal path. The default browser path is unchanged.
let _chromium = null;
function loadChromium() {
  if (_chromium) return _chromium;
  try { _chromium = require('playwright').chromium; }
  catch (_) {
    try { _chromium = require('patchright').chromium; }
    catch (e) {
      throw new Error('Neither playwright nor patchright is installed. Run /design-setup (npm install + ' +
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
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length }));
  });
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
  const html = fs.readFileSync(target, 'utf8');
  // (1) banned fonts — in any font-family declaration or a font-CDN href (Google Fonts / Fontshare / etc.).
  const bannedFonts = [];
  for (const f of BANNED_FONTS) {
    const re = new RegExp('(font-family[^;}{]*|href\\s*=\\s*["\'][^"\']*(?:fonts\\.googleapis|fonts\\.gstatic|api\\.fontshare|fonts\\.bunny|use\\.typekit)[^"\']*)' + f.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\s+/g, '[\\s+]+'), 'i');
    if (re.test(html)) bannedFonts.push(f);
  }
  // (2) raw hex / rgb() color used OUTSIDE a token block (@theme {...}, :root {...}, or any <style>...</style>).
  // Blank out token/style regions, then any remaining hex/rgb in inline style attrs / class arbitrary values is raw.
  let scrubbed = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/@theme[\s\S]*?\{[\s\S]*?\}/gi, ' ')
    .replace(/:root[\s\S]*?\{[\s\S]*?\}/gi, ' ');
  const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/g;
  const rawColors = [...new Set((scrubbed.match(RAW_COLOR) || []))].slice(0, 24);
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

  const checks = [
    { name: 'bannedFonts', pass: bannedFonts.length === 0, detail: bannedFonts.length ? bannedFonts.join(',') : 'none', severity: 'block' },
    { name: 'rawColorOutsideTokens', pass: rawColors.length === 0, detail: rawColors.length ? rawColors.join(' ') : 'none', severity: 'block' },
    { name: 'fixedWidthOverflowRisk', pass: widthHits.length === 0, detail: widthHits.length ? widthHits.join(',') + 'px > 390' : 'none', severity: 'block' },
    { name: 'imgMissingAlt', pass: imgNoAlt === 0, detail: imgNoAlt ? imgNoAlt + ' <img> without alt' : 'none', severity: 'block' },
  ];
  const overall = checks.filter((c) => c.severity === 'block').every((c) => c.pass !== false);
  const summary = {
    mode: 'static', url, outDir, file: target,
    static: { bannedFonts, rawColors, fixedWidthOverPx: widthHits, imgMissingAlt: imgNoAlt },
    gate: { report: { overall, checks } },
    files: [],
  };
  fs.writeFileSync(path.join(outDir, 'run.json'), JSON.stringify(summary, null, 2));
  console.log('STATIC lint ' + (overall ? 'PASS' : 'FAIL') + ':');
  for (const c of checks) console.log('  [' + (c.pass ? 'PASS' : 'FAIL') + '] ' + c.name + ' — ' + c.detail);
  console.log(JSON.stringify(summary));
  if (process.env.GATE_EXIT && overall === false) process.exit(1); // same opt-in hard exit as the browser path
}

// FILMSTRIP=1 / MOTION=1 — capture frames across the entrance window, then audit motion via getComputedStyle.
const MOTION_ON = !!process.env.FILMSTRIP || !!process.env.MOTION;
async function captureFilmstrip(page) {
  const stamps = [0, 120, 250, 400, 700, 1100, 1500];
  const frames = [];
  const start = Date.now();
  for (const t of stamps) {
    const wait = t - (Date.now() - start);
    if (wait > 0) await sleep(wait);
    const f = `filmstrip-${String(t).padStart(4, '0')}.png`;
    try { await page.screenshot({ path: path.join(outDir, f) }); frames.push(f); } catch (_) {}
  }
  return frames;
}
async function analyzeMotion(page) {
  return page.evaluate(() => {
    const SANE = [120, 200, 250, 320, 400, 700];
    const LAYOUT = ['width', 'height', 'top', 'left', 'right', 'bottom', 'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left'];
    const parseDur = (s) => String(s || '').split(',').map((x) => {
      x = x.trim();
      if (x.endsWith('ms')) return parseFloat(x);
      if (x.endsWith('s')) return parseFloat(x) * 1000;
      return parseFloat(x) || 0;
    });
    // Map @keyframes name -> set of animated properties (so animation layout-jank is detectable too).
    const kf = {};
    for (const ss of document.styleSheets) {
      let rules; try { rules = ss.cssRules; } catch (_) { continue; }
      if (!rules) continue;
      for (const r of rules) {
        const isKf = (typeof CSSRule !== 'undefined' && r.type === CSSRule.KEYFRAMES_RULE) || (r.constructor && r.constructor.name === 'CSSKeyframesRule');
        if (!isKf) continue;
        const props = new Set();
        for (const k of (r.cssRules || [])) { for (let i = 0; i < k.style.length; i++) props.add(k.style[i]); }
        kf[r.name] = [...props];
      }
    }
    const durations = [], layoutAnimated = [], warnings = [];
    let scanned = 0;
    for (const el of document.querySelectorAll('body *')) {
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
      const durs = [...(hasTrans ? transDurs : []), ...(hasAnim ? animDurs : [])];
      for (const d of durs) {
        durations.push(Math.round(d));
        const sane = SANE.some((s) => Math.abs(s - d) <= 40);
        if (d > 600 || !sane) warnings.push({ sel, durationMs: Math.round(d), reason: d > 600 ? 'too-long' : 'off-token' });
      }
      // layout-property animation (jank/banned motion) — from transition-property and/or keyframe props.
      const layoutHit = new Set();
      if (hasTrans) for (const p of transProp.split(',').map((s) => s.trim())) { if (p === 'all' || LAYOUT.includes(p)) layoutHit.add(p); }
      if (hasAnim) for (const name of animName.split(',').map((s) => s.trim())) { for (const p of (kf[name] || [])) if (LAYOUT.includes(p)) layoutHit.add(p); }
      if (layoutHit.size) layoutAnimated.push({ sel, props: [...layoutHit] });
    }
    return { durations, layoutAnimated, warnings };
  }).catch(() => ({ durations: [], layoutAnimated: [], warnings: [], error: 'motion eval failed' }));
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
  let motion = null;
  if (MOTION_ON) {
    const frames = await captureFilmstrip(dp);
    const audit = await analyzeMotion(dp);
    motion = { frames, durations: audit.durations, layoutAnimated: audit.layoutAnimated, warnings: audit.warnings, ...(audit.error ? { error: audit.error } : {}) };
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
