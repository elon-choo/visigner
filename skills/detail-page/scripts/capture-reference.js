// capture-reference.js — capture a real reference page (competitor / exemplar) as tiled
// screenshots + extracted text, to ground a design in reality (PixelRAG-style visual grounding).
// Drives REAL headed Chrome with a fresh profile, which gets past most bot walls (e.g. Wadiz/Akamai)
// that block headless and plain fetch. Be gentle: a few captures, not a crawl, or the IP gets flagged.
// Usage: NODE_PATH=$(npm root -g) node capture-reference.js <url> [outDir]
const { chromium } = (() => {
  try { return require('playwright'); } catch (_) { return require('patchright'); }
})();
const fs = require('fs');
const path = require('path');

const url = process.argv[2];
const outDir = process.argv[3] || '/tmp/reference-capture';
const maxTiles = Number(process.env.MAX_TILES || 90);
if (!url) { console.error('usage: node capture-reference.js <url> [outDir]'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });
const profile = path.join(outDir, `.profile_${Date.now()}`);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chrome', headless: false,
    viewport: { width: 1280, height: 1600 }, locale: 'ko-KR',
    args: ['--disable-blink-features=AutomationControlled', '--lang=ko-KR'],
  });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  // Warm up on the site origin first (human-like), then the target.
  try { const o = new URL(url).origin; await page.goto(o, { waitUntil: 'domcontentloaded', timeout: 45000 }); await sleep(4000); } catch (_) {}
  let status = 'unknown';
  try { const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); status = r ? r.status() : 'no-resp'; } catch (e) { status = 'err:' + e.message; }
  await sleep(7000);
  const title = await page.title();
  if (/Access Denied|Forbidden/i.test(title) || status === 403) {
    console.log(JSON.stringify({ url, status, title, blocked: true, hint: 'WAF flagged the IP — wait a few minutes and retry; do not hammer.' }));
    await ctx.close(); return;
  }
  // Expand any "더보기 / 상세보기 / 자세히 보기" then gentle slow scroll for lazy images.
  for (const t of ['상세보기', '프로젝트 더보기', '더보기', '자세히 보기', 'Read more', 'Show more']) {
    try { const b = page.getByText(t, { exact: false }).first(); if (await b.count()) { await b.scrollIntoViewIfNeeded(); await b.click({ timeout: 1500 }); await sleep(1200); break; } } catch (_) {}
  }
  for (let pass = 0; pass < 2; pass++) {
    const h = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < h + 1200; y += 500) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await sleep(200); }
    await sleep(1000);
  }
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(600);

  const data = await page.evaluate(() => {
    const h = [...document.querySelectorAll('h1,h2,h3,h4')].map(e => e.tagName + ': ' + e.innerText.trim()).filter(s => s.length > 2 && s.length < 160).slice(0, 150);
    const imgs = [...document.querySelectorAll('img')].map(i => ({ src: i.currentSrc || i.src, w: i.naturalWidth, h: i.naturalHeight })).filter(i => i.w > 200);
    const body = document.body.innerText.replace(/\n{3,}/g, '\n\n').trim();
    return { title: document.title, headings: h, imageCount: imgs.length, bigImages: imgs.filter(i => i.h > 350).map(i => i.src).slice(0, 80), pageHeight: document.body.scrollHeight, bodyTextLen: body.length, bodyText: body.slice(0, 60000) };
  });
  fs.writeFileSync(path.join(outDir, 'data.json'), JSON.stringify({ url, status, ...data, bodyText: undefined }, null, 2));
  fs.writeFileSync(path.join(outDir, 'bodytext.txt'), data.bodyText);

  const tileH = 1600, tiles = Math.min(Math.ceil(data.pageHeight / tileH), maxTiles);
  for (let i = 0; i < tiles; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * tileH);
    await sleep(450);
    await page.screenshot({ path: path.join(outDir, `tile_${String(i).padStart(2, '0')}.png`) });
  }
  const summary = { url, status, title: data.title, pageHeight: data.pageHeight, bodyTextLen: data.bodyTextLen, imageCount: data.imageCount, tiles, coveredHeight: tiles * tileH, maxTiles, outDir };
  fs.writeFileSync(path.join(outDir, 'capture.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
  await ctx.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(2); });
