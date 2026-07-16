#!/usr/bin/env node
'use strict';

// G5.0 — deterministic builder for the Stage-5 eval corpus + ground-truth labels.
// Planted issues are phrased INDEPENDENTLY of the detectors' example literals (G4.9.5 T1); each issue is
// labeled with the spine component expected to catch it, or marked out-of-spine expected-MISS (T2/T3).
// Run: node build-corpus.js   (writes fixtures next to this file). Idempotent.

const fs = require('fs');
const path = require('path');

const DIR = __dirname;

// A real gen-assets-style placeholder SVG (the actual ship artifact — self-marker inside the file, non-circular).
function placeholderSvg(role) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900" role="img" aria-label="${role} placeholder (photo)">`
    + `<rect width="1200" height="900" fill="#efece6"/>`
    + `<text x="600" y="450" text-anchor="middle" font-size="30" fill="#8a8378">${role}  ·  4:3  ·  placeholder</text></svg>`;
}
function page(title, style, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>\n<style>${style}</style></head>\n<body>\n${body}\n</body></html>\n`;
}
function write(rel, content) {
  const p = path.join(DIR, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  return path.relative(DIR, p);
}

// ---------------- NAIVE fixtures (planted, independently phrased) ----------------

// 1) placeholder images shipped (no cred) + a naturally-phrased unsourced money claim.
write('naive-placeholder/assets/hero.svg', placeholderSvg('hero'));
write('naive-placeholder/assets/product.svg', placeholderSvg('product'));
write('naive-placeholder/index.html', page(
  'Hearth & Kettle',
  "body{font-family:'Fraunces',Georgia,serif;max-width:1100px;margin:0 auto;line-height:1.6}h1{font-size:2.6rem}.hero,.detail{padding:3rem 1.5rem}",
  `<header class="hero"><h1>Hearth &amp; Kettle — the slow-brew ritual</h1>
<p>Loved by over 5,000 customers, and members never run out of beans.</p>
<img src="assets/hero.svg" alt="hero" width="1200" height="900"></header>
<section class="detail"><h2>Why the ritual works</h2>
<p>Single-origin beans, roasted the week they ship, ground the morning you brew them.</p>
<img src="assets/product.svg" alt="product" width="1200" height="900"></section>`,
));

// 2) real stand-in copy a novice forgot to replace (genuine lorem + an empty section heading).
write('naive-standin/index.html', page(
  'Northfield Studio',
  "body{font-family:'Newsreader',Georgia,serif;max-width:900px;margin:0 auto;padding:2rem;line-height:1.7}",
  `<header><h1>Northfield Studio — considered interiors</h1></header>
<section><h2>Our approach</h2>
<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p></section>
<section><h2></h2>
<p>We shape rooms around how a family actually lives, not how a catalog wants them to.</p></section>`,
));

// 3) empty/placeholder-dominant shell (thin content — taste-suspect empty-shell class).
write('naive-empty/index.html', page(
  'Untitled Launch',
  "body{font-family:'Spectral',Georgia,serif;margin:0}.panel{min-height:40vh;display:flex;align-items:center;justify-content:center}",
  `<div class="panel"><h1>Coming soon</h1></div>
<div class="panel"></div>
<div class="panel"></div>
<div class="panel"></div>`,
));

// 4) brand-token tells (Inter + unearned purple + uniform cards). OUT-OF-SPINE: brand-lint is NOT wired into
//    the auto-grade spine (auto-grade-runner.js:36 has no --brand-lint). The structural monotony of 6 identical
//    cards MAY be caught by anti-ai-eval's monotony detector — labeled as the one in-scope hope, font/color out.
write('naive-brandtells/index.html', page(
  'FlowMetrics',
  "body{font-family:Inter,system-ui,sans-serif;margin:0;background:#faf5ff}h1{color:#7c3aed}"
  + ".grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;padding:2rem}"
  + ".card{background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.1);padding:1.5rem;border-top:3px solid #7c3aed}",
  `<h1>FlowMetrics dashboard</h1>
<div class="grid">
<div class="card"><h3>Users</h3><p>1,204</p></div>
<div class="card"><h3>Sessions</h3><p>3,910</p></div>
<div class="card"><h3>Revenue</h3><p>$21k</p></div>
<div class="card"><h3>Churn</h3><p>2.1%</p></div>
<div class="card"><h3>NPS</h3><p>48</p></div>
<div class="card"><h3>Uptime</h3><p>99%</p></div>
</div>`,
));

// ---------------- CLEAN fixtures ----------------
// A FRESH, complete, real page NOT used for any prior precision-tuning (G4.9.5 T5).
write('clean-fresh/index.html', page(
  'Marlow & Finch — Field Notebooks',
  "body{font-family:'Fraunces',Georgia,serif;margin:0;color:#1c1a17;background:#f7f4ee}"
  + "header{padding:6rem 2rem 3rem;max-width:70ch;margin:0 auto}h1{font-size:clamp(2.4rem,5vw,4rem);line-height:1.05;letter-spacing:-.02em;margin:0 0 1rem}"
  + ".lede{font-size:1.3rem;color:#4a463f;max-width:55ch}main{max-width:66ch;margin:0 auto;padding:0 2rem 6rem;line-height:1.7}"
  + "h2{font-size:1.6rem;margin:3rem 0 .6rem;border-bottom:1px solid #d8d2c6;padding-bottom:.4rem}"
  + "blockquote{border-left:3px solid #a8683a;margin:2rem 0;padding:.4rem 0 .4rem 1.4rem;font-style:italic;color:#3a352d}"
  + ".spec{display:flex;gap:2rem;flex-wrap:wrap;margin:2rem 0}.spec div{flex:1 1 12rem}.spec dt{font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:#8a8071}.spec dd{margin:.2rem 0 0;font-size:1.1rem}",
  `<header><h1>Field notebooks that survive the field.</h1>
<p class="lede">Sewn in Bristol from 120gsm rain-resistant stock, sized for a jacket pocket, and flat-opening so the page never fights the pen.</p></header>
<main>
<section><h2>Made for the weather you actually work in</h2>
<p>Most notebooks are designed for a desk. Ours are designed for a hedge in November — the cover is waxed, the corners are rounded so they don't fray, and the elastic holds a pencil, not just the covers shut.</p>
<blockquote>"Three seasons of survey work and the spine still hasn't cracked."</blockquote></section>
<section><h2>The details that earn their keep</h2>
<div class="spec">
<div><dt>Paper</dt><dd>120gsm, rain-resistant, 5mm dot grid</dd></div>
<div><dt>Binding</dt><dd>Section-sewn, flat-opening</dd></div>
<div><dt>Cover</dt><dd>Waxed cotton over 2mm board</dd></div>
</div>
<p>We don't restock quickly — each run is dyed in a single small batch, so the colour you see is the colour we have until it's gone.</p></section>
<section><h2>How the binding is made</h2>
<p>Each block is folded into sixteen-page signatures, then hand-sewn through the fold with waxed linen thread. There is no glue in the spine, which is why it opens flat and stays open — a glued perfect-bound notebook fights your hand on every page.</p>
<p>The thread is the same one bookbinders have used for two centuries, because nothing synthetic has beaten it for a binding that flexes ten thousand times without loosening.</p></section>
<section><h2>What survey crews told us to change</h2>
<p>The first run had square corners; three surveyors sent them back frayed within a month, so we rounded them. The elastic used to sit at the edge; a hydrologist pointed out it should hold a pencil against the spine, so we moved it. This is the fourth revision, and every change came from someone who works outdoors for a living.</p></section>
<section><h2>Guarantee</h2>
<p>If the spine cracks or the cover delaminates within two years of ordinary field use, we replace it and pay the postage both ways. We have replaced four notebooks in three years.</p></section>
</main>`,
));

// ground-truth: each planted issue labeled with the expected spine component + whether it is in the spine's scope.
const groundTruth = {
  note: 'Planted issues phrased independently of detector example literals (T1). inScope=false items are expected-MISS (T2/T3) and are excluded from the recall denominator.',
  fixtures: [
    {
      dir: 'naive-placeholder', clean: false,
      issues: [
        { type: 'placeholder-image', expectedComponent: 'human-gate:images', inScope: true },
        { type: 'unsourced-metric-claim', expectedComponent: 'human-gate:claims', inScope: true },
      ],
    },
    {
      dir: 'naive-standin', clean: false,
      issues: [
        { type: 'lorem-standin-copy', expectedComponent: 'human-gate:copy', inScope: true },
        { type: 'empty-heading', expectedComponent: 'human-gate:copy', inScope: true },
      ],
    },
    {
      dir: 'naive-empty', clean: false,
      issues: [
        { type: 'empty-shell', expectedComponent: 'taste-suspect', inScope: true },
      ],
    },
    {
      dir: 'naive-brandtells', clean: false,
      issues: [
        // G6.5 (owner decision): brand-lint's AI-tell rules are now folded into the auto-grade, so a banned
        // font is caught automatically (token_discipline.findings on the grade). banned-font is now IN-SCOPE.
        { type: 'banned-font-inter', expectedComponent: 'brand-lint:token', inScope: true },
        // ai-purple only scores OKLCH-format purple; this fixture's hex purple (#7c3aed) is flagged as
        // unscored raw-hex hygiene, so it stays out-of-spine-for-scoring (honest sub-limitation).
        { type: 'unearned-purple-hex', expectedComponent: 'brand-lint:ai-purple(oklch-only)', inScope: false },
        { type: 'uniform-card-monotony', expectedComponent: 'anti-ai-eval:monotony', inScope: true },
      ],
    },
    { dir: 'clean-fresh', clean: true, freshUntuned: true, issues: [] },
  ],
  // clean fixtures reused from prior stages (already proven clean at G3.8/G4.6) — precision cross-check only.
  reusedCleanPages: ['docs/index.html', 'docs/guide.html', 'docs/how-to.html'],
};
write('ground-truth.json', `${JSON.stringify(groundTruth, null, 2)}\n`);

process.stdout.write('stage5 corpus built\n');
