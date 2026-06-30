// tell-count.js — DETERMINISTIC slop-tell counter for the design-critic's distinctiveness gate.
// Renders a built page (local file OR url) in a real browser and reports, from computed styles
// (not regex guesses, not vibes), three measurable AI-slop tells plus a distinctiveness-score CAP:
//   1. equal-radius+equal-shadow sibling cards  — uniform card-grid tell (the #1 "could-be-any-AI-page" smell)
//   2. centered text blocks                     — centered-everything tell (excludes headings: a centered h1/h2 is normal)
//   3. accent-color occurrences                 — single-accent monotony tell
// High counts CAP the distinctiveness dimension (the critic must not score above the cap from vibe alone).
// This is a MEASUREMENT, reported alongside the critic's calibrated LLM judgment — never a replacement for it.
//
// Usage: NODE_PATH=$(npm root -g) node tell-count.js <file-or-url> [--json]
//        NODE_PATH=/path/to/detail-page/node_modules node tell-count.js page.html
// Output: JSON to stdout (always parseable). Exit 0 on success, 1 on bad args, 2 on render failure.

const fs = require('fs');
const path = require('path');

const { chromium } = (() => {
  try { return require('playwright'); } catch (_) { return require('patchright'); }
})();

const arg = process.argv[2];
const jsonOnly = process.argv.includes('--json'); // reserved: output is always JSON; flag kept for parity with siblings
if (!arg) {
  console.error('usage: node tell-count.js <file-or-url> [--json]');
  process.exit(1);
}

// Resolve a local path to a file:// URL; pass through http(s)/file URLs unchanged.
function toTarget(a) {
  if (/^(https?|file):\/\//i.test(a)) return a;
  const abs = path.resolve(a);
  if (!fs.existsSync(abs)) {
    console.error('not a url and file does not exist: ' + abs);
    process.exit(1);
  }
  return 'file://' + abs;
}
const target = toTarget(arg);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let browser;
  try {
    // Prefer system Chrome (always present here; the bundled headless shell often isn't installed).
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
  } catch (_) {
    try {
      browser = await chromium.launch({ headless: true }); // fall back to a bundled browser if present
    } catch (e) {
      console.error('FATAL could not launch chromium: ' + e.message);
      process.exit(2);
    }
  }
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    let status = 'unknown';
    try {
      const r = await page.goto(target, { waitUntil: 'load', timeout: 45000 });
      status = r ? r.status() : 'no-resp';
    } catch (e) {
      // networkidle/load can time out on a heavy page that still rendered; keep going and analyze what loaded.
      status = 'load-warn:' + e.message.split('\n')[0];
    }
    // Nudge lazy/reveal content into the rendered tree, then return to top so getComputedStyle is stable.
    try {
      const h = await page.evaluate(() => document.body ? document.body.scrollHeight : 0);
      for (let y = 0; y < h; y += 800) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await sleep(120); }
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(400);
    } catch (_) { /* analysis below is resilient to a partial scroll */ }

    const result = await page.evaluate(() => {
      const MAX_ELEMENTS = 8000; // hard cap so a pathological DOM can't hang the eval
      const all = Array.from(document.querySelectorAll('body *')).slice(0, MAX_ELEMENTS);

      // ---- helpers -------------------------------------------------------
      const cs = (el) => { try { return getComputedStyle(el); } catch (_) { return null; } };

      // Fast path: parse a literal "rgb(a)" / "rgba" serialization into {r,g,b,a}.
      // Returns an object, null (transparent/unparseable rgb), or undefined (NOT an rgb serialization
      // → caller should try the canvas normalizer). This preserves the original rgb behavior exactly.
      const parseColorRgb = (str) => {
        const m = str.match(/rgba?\(([^)]+)\)/i);
        if (!m) return undefined;
        const p = m[1].split(',').map((s) => parseFloat(s.trim()));
        if (p.length < 3 || p.some((n) => Number.isNaN(n))) return null;
        const a = p.length >= 4 ? p[3] : 1;
        if (a === 0) return null; // fully transparent contributes nothing
        return { r: p[0], g: p[1], b: p[2], a };
      };

      // Canvas normalizer: Chrome's getComputedStyle returns oklch()/color()/lab()/hsl() VERBATIM for
      // those token forms, which the rgb-only regex above cannot read — so accent tells used to see 0
      // colors on every OKLCH starter. We let the browser do the conversion: paint the string onto a
      // 1x1 offscreen canvas and read the rendered sRGB pixel back. An invalid string is rejected via
      // the two-sentinel trick (a rejected value leaves the prior fillStyle, so black vs white sentinels
      // serialize differently). Lazily created; degrades to null if 2d canvas is unavailable.
      let _cctx; // undefined=untried, null=unavailable, else CanvasRenderingContext2D
      const colorCtx = () => {
        if (_cctx !== undefined) return _cctx;
        try {
          const cv = document.createElement('canvas');
          cv.width = 1; cv.height = 1;
          _cctx = cv.getContext('2d', { willReadFrequently: true }) || null;
        } catch (_) { _cctx = null; }
        return _cctx;
      };
      const parseColorCanvas = (str) => {
        const ctx = colorCtx();
        if (!ctx) return null;
        try {
          ctx.fillStyle = '#000'; ctx.fillStyle = str; const v1 = ctx.fillStyle;
          ctx.fillStyle = '#fff'; ctx.fillStyle = str; const v2 = ctx.fillStyle;
          if (v1 !== v2) return null; // string rejected by the CSS color parser
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = str; ctx.fillRect(0, 0, 1, 1);
          const d = ctx.getImageData(0, 0, 1, 1).data;
          const a = d[3] / 255;
          if (a === 0) return null;
          return { r: d[0], g: d[1], b: d[2], a };
        } catch (_) { return null; }
      };

      // Normalize ANY color serialization to {r,g,b,a}; null for none/transparent/unparseable.
      // Memoized per string — the token palette has only a handful of distinct colors, so the canvas
      // path runs a few dozen times, not once per element.
      const colorCache = new Map();
      const parseColor = (str) => {
        if (!str) return null;
        if (colorCache.has(str)) return colorCache.get(str);
        let c = parseColorRgb(str);
        if (c === undefined) c = parseColorCanvas(str); // oklch()/color()/lab()/hsl()/named
        c = c || null;
        colorCache.set(str, c);
        return c;
      };
      // A color is "neutral" (not an accent) when it has almost no chroma OR is near pure white/black.
      const isNeutral = (c) => {
        if (!c) return true;
        const max = Math.max(c.r, c.g, c.b), min = Math.min(c.r, c.g, c.b);
        const chroma = max - min;            // saturation proxy in 0..255
        if (chroma < 28) return true;        // grayscale-ish
        if (max < 30) return true;           // near-black
        if (min > 235) return true;          // near-white tint
        return false;
      };
      const colorKey = (c) => {
        // Quantize to 24-step buckets so visually-identical accents collapse to one key.
        const q = (v) => Math.round(v / 24) * 24;
        return q(c.r) + ',' + q(c.g) + ',' + q(c.b);
      };

      // ---- (1) equal-radius + equal-shadow sibling cards -----------------
      // A "card" candidate: a sized block with a shadow OR a meaningful corner radius.
      // Group by (parent, radiusBucket|shadow). The largest sibling group that shares an
      // IDENTICAL radius+shadow is the uniform-grid tell.
      const groups = new Map(); // key -> count
      let cardCandidates = 0;
      for (const el of all) {
        const s = cs(el);
        if (!s) continue;
        const w = el.offsetWidth, h = el.offsetHeight;
        if (w < 80 || h < 60) continue; // too small to read as a card
        const radius = parseFloat(s.borderTopLeftRadius) || 0;
        const shadow = s.boxShadow && s.boxShadow !== 'none' ? s.boxShadow : '';
        if (!shadow && radius < 6) continue; // neither rounded nor shadowed → not a card surface
        cardCandidates++;
        const parent = el.parentElement;
        const pid = parent ? (parent.__tcid || (parent.__tcid = Math.random().toString(36).slice(2))) : 'root';
        const rb = Math.round(radius / 2) * 2; // 2px radius bucket
        const key = pid + '::' + rb + '|' + shadow;
        groups.set(key, (groups.get(key) || 0) + 1);
      }
      let maxEqualCards = 0;
      let uniformCardTotal = 0; // sum of cards living in any group of >=3 identical siblings
      for (const n of groups.values()) {
        if (n > maxEqualCards) maxEqualCards = n;
        if (n >= 3) uniformCardTotal += n;
      }

      // ---- (2) centered text blocks (centered-everything tell) ----------
      // The smell is centered flowing PROSE, not every centered token. The old count conflated three
      // genre-legitimate centered things and over-fired on the suite's own starters (pricing: 25):
      //   • comparison-matrix <td>/<th> cells (and their inner spans) — a centered compare table is correct
      //   • short UI labels: button/link CTAs, eyebrows, badges, stat figures, prices, percentages
      //   • single short words / numeric-value tokens
      // We now count a block only when it carries a real centered SENTENCE: direct text >= MIN_PROSE chars,
      // not inside a table cell, not an interactive control, and not a bounded numeric/value token.
      const MIN_PROSE = 24; // a centered word/label/figure is fine; centered body copy is the tell
      const NUMERIC_VALUE = /^[\s\d.,%$€£¥/+×x()·:–—-]+$/; // "$19", "99.9%", "11,400+", "2.1M"-ish → not prose
      let centeredTextBlocks = 0;
      for (const el of all) {
        const tag = el.tagName.toLowerCase();
        if (/^h[1-6]$/.test(tag)) continue;              // a centered heading is normal hierarchy
        const s = cs(el);
        if (!s || s.textAlign !== 'center') continue;
        if (el.closest('td, th')) continue;              // comparison-matrix cells (+ their spans) are fine
        if (el.closest('button, a')) continue;           // centered control/CTA labels are universal, not the smell
        // Aggregate this element's DIRECT text (own text nodes only), so wrappers that merely inherit
        // center don't inflate the count.
        let txt = '';
        for (const node of el.childNodes) {
          if (node.nodeType === 3) txt += node.textContent;
        }
        txt = txt.trim();
        if (txt.length < MIN_PROSE) continue;            // short labels / words / figures excluded
        if (NUMERIC_VALUE.test(txt)) continue;           // bounded numeric/value text excluded
        centeredTextBlocks++;
      }

      // ---- (3) accent-color occurrences ---------------------------------
      // Tally every non-neutral color used as text/background/border; the most-used one is the accent.
      const tally = new Map();
      for (const el of all) {
        const s = cs(el);
        if (!s) continue;
        for (const prop of [s.color, s.backgroundColor, s.borderTopColor]) {
          const c = parseColor(prop);
          if (!c || isNeutral(c)) continue;
          const k = colorKey(c);
          tally.set(k, (tally.get(k) || 0) + 1);
        }
      }
      let accentColor = null, accentOccurrences = 0, distinctAccents = 0;
      for (const [k, n] of tally.entries()) {
        distinctAccents++;
        if (n > accentOccurrences) { accentOccurrences = n; accentColor = k; }
      }

      return {
        elementsScanned: all.length,
        truncated: all.length >= MAX_ELEMENTS,
        cardCandidates,
        maxEqualCards,
        uniformCardTotal,
        centeredTextBlocks,
        accentColor: accentColor ? 'rgb(' + accentColor + ')' : null,
        accentOccurrences,
        distinctAccents,
      };
    });

    // ---- distinctiveness CAP (transparent, deterministic mapping) --------
    // Start uncapped (10). Each tell that crosses its documented threshold lowers the cap.
    // The critic reports raw counts AND this cap, and may NOT score distinctiveness above the cap.
    const tells = [];
    let cap = 10;
    const lower = (to, why) => { if (to < cap) cap = to; tells.push(why); };
    if (result.maxEqualCards >= 5) lower(6, `${result.maxEqualCards} identical-radius+shadow sibling cards (>=5 = strong uniform-grid tell)`);
    else if (result.maxEqualCards >= 3) lower(7, `${result.maxEqualCards} identical-radius+shadow sibling cards (>=3 = uniform-grid tell)`);
    if (result.centeredTextBlocks >= 9) lower(6, `${result.centeredTextBlocks} centered prose blocks (>=9 = strong centered-everything tell)`);
    else if (result.centeredTextBlocks >= 6) lower(7, `${result.centeredTextBlocks} centered prose blocks (>=6 = centered-everything tell)`);
    // Monotone-accent tell = literally ONE non-neutral color carrying the whole page (the "everything is
    // purple" smell). The recommended brand palette is "primary + 1 reserved accent" = 2 distinct accents,
    // so the bar must be distinctAccents <= 1 — otherwise a correct 2-color starter (e.g. pricing: green
    // primary + amber CTA) reads as monotone the moment parseColor can see oklch. (Before the oklch fix
    // this branch was unreachable on the OKLCH suite, which is why the <=2 mis-calibration went unnoticed.)
    if (result.accentOccurrences >= 40 && result.distinctAccents <= 1) lower(7, `single accent used ${result.accentOccurrences}x as the only non-neutral color (monotone-accent tell)`);

    const out = {
      target,
      ...result,
      distinctivenessCap: cap, // distinctiveness MUST NOT be scored above this number
      tellsTriggered: tells,
      note: 'Deterministic measurement of three slop tells. Caps the distinctiveness score; does not replace the critic\'s calibrated pairwise judgment vs the reference captures.',
    };
    console.log(JSON.stringify(out, null, 2));
    await browser.close();
    process.exit(0);
  } catch (e) {
    try { await browser.close(); } catch (_) {}
    console.error('FATAL ' + e.message);
    process.exit(2);
  }
})();
