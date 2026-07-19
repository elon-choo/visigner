#!/usr/bin/env node
'use strict';

// Capture a public SPA project/product detail page with Patchright.
// Usage: node scripts/capture-spa.js <project-or-product-url> <new-out-dir> [--headed] [--max-tiles N]
// The command deliberately rejects known listing routes and non-empty output
// directories so a failed target cannot be mistaken for a detail-page capture.

const fs = require('fs');
const os = require('os');
const path = require('path');
// Lazy patchright (shoot.js convention): a missing browser dep gives install
// guidance instead of a raw MODULE_NOT_FOUND at load time.
function requireChromium() {
  try { return require('patchright').chromium; }
  catch (e) {
    throw new Error('patchright is not installed — run /design-setup (npm install + npx patchright install chromium). (' + e.message + ')');
  }
}

const VIEWPORT = Object.freeze({ width: 1280, height: 1600 });
const DEFAULT_MAX_TILES = 90;
const WAIT_AFTER_NAVIGATION_MS = 2500;

function usage() {
  return 'Usage: node scripts/capture-spa.js <project-or-product-url> <new-out-dir> [--headed] [--max-tiles N]';
}

function fail(message, code = 1) {
  console.error('FAIL — ' + message);
  process.exitCode = code;
}

function parseArgs(argv) {
  const positional = [];
  const options = { headless: true, maxTiles: DEFAULT_MAX_TILES };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--headed') {
      options.headless = false;
    } else if (arg === '--max-tiles') {
      const candidate = Number(argv[index + 1]);
      if (!Number.isInteger(candidate) || candidate < 1 || candidate > DEFAULT_MAX_TILES) {
        throw new Error('--max-tiles must be an integer from 1 to ' + DEFAULT_MAX_TILES);
      }
      options.maxTiles = candidate;
      index += 1;
    } else if (arg.startsWith('--')) {
      throw new Error('unknown flag ' + arg);
    } else {
      positional.push(arg);
    }
  }
  if (positional.length !== 2) throw new Error(usage());
  const requestedUrl = new URL(positional[0]);
  if (!/^https?:$/u.test(requestedUrl.protocol)) throw new Error('only public http(s) URLs are supported');
  return { ...options, requestedUrl: requestedUrl.href, outDir: path.resolve(positional[1]) };
}

function isListingUrl(rawUrl) {
  const url = new URL(rawUrl);
  return /\/(?:discover|category|categories|home|main|search|search-result|collections?|ranking)(?:\/|$)/iu.test(url.pathname);
}

function knownDetailUrl(rawUrl) {
  const url = new URL(rawUrl);
  const host = url.hostname.replace(/^www\./u, '').toLowerCase();
  if (host === 'tumblbug.com') return /^\/projects\/\d+(?:\/|$)/u.test(url.pathname);
  if (host === 'wadiz.kr') return /^\/web\/campaign\/detail\/\d+(?:\/|$)/u.test(url.pathname);
  if (host === '29cm.co.kr') {
    return /^\/product\/catalog\/\d+(?:\/|$)/u.test(url.pathname)
      || /^\/products\/\d+(?:\/|$)/u.test(url.pathname)
      || (/^\/product\/(?:product_detail\.html|\d+)(?:\/|$)/u.test(url.pathname)
        && (/^\/product\/\d+(?:\/|$)/u.test(url.pathname) || url.searchParams.has('no')));
  }
  if (host === 'musinsa.com') return /^\/products\/\d+(?:\/|$)/u.test(url.pathname);
  return null;
}

function assertDetailUrl(rawUrl, stage) {
  if (isListingUrl(rawUrl)) throw new Error(stage + ' URL is a known listing route: ' + rawUrl);
  const known = knownDetailUrl(rawUrl);
  if (known === false) throw new Error(stage + ' URL is not a project/product route for this platform: ' + rawUrl);
  if (known === null) {
    const url = new URL(rawUrl);
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length < 2) throw new Error(stage + ' URL is too shallow to prove it is a project/product detail page: ' + rawUrl);
  }
}

function ensureNewOutputDir(outDir) {
  if (fs.existsSync(outDir)) {
    const contents = fs.readdirSync(outDir);
    if (contents.length) throw new Error('output directory already contains files; refusing to overwrite: ' + outDir);
  }
  fs.mkdirSync(outDir, { recursive: true });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHydration(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 30_000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForFunction(() => {
    const text = (document.body && document.body.innerText) || '';
    return text.trim().length >= 240
      || document.querySelectorAll('h1,h2,h3,img').length >= 4;
  }, { timeout: 30_000 }).catch(() => {});
  await sleep(WAIT_AFTER_NAVIGATION_MS);
}

async function dismissTransientUi(page) {
  await page.keyboard.press('Escape').catch(() => {});
  const labels = ['프로젝트 더보기', '상세보기', '자세히 보기', '더보기', 'Read more', 'Show more'];
  for (const label of labels) {
    const button = page.getByText(label, { exact: false }).first();
    try {
      if (await button.count()) {
        await button.scrollIntoViewIfNeeded({ timeout: 2_000 });
        await button.click({ timeout: 2_000 });
        await sleep(1_200);
        return label;
      }
    } catch (_) {
      // A similarly named navigation item is not a story-expansion failure.
    }
  }
  return null;
}

async function hydrateLazyContent(page) {
  const initialHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < initialHeight + VIEWPORT.height; y += 640) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await sleep(160);
  }
  await sleep(700);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);
}

async function extractPageData(page) {
  return page.evaluate(() => {
    const headings = [...document.querySelectorAll('h1,h2,h3,h4')]
      .map((element) => `${element.tagName}: ${(element.innerText || '').trim()}`)
      .filter((text) => text.length > 2 && text.length < 160)
      .slice(0, 150);
    const images = [...document.querySelectorAll('img')]
      .map((image) => ({ src: image.currentSrc || image.src, w: image.naturalWidth, h: image.naturalHeight }))
      .filter((image) => image.w > 200);
    const bodyText = document.body.innerText.replace(/\n{3,}/gu, '\n\n').trim();
    return {
      title: document.title,
      headings,
      imageCount: images.length,
      bigImages: images.filter((image) => image.h > 350).map((image) => image.src).slice(0, 80),
      pageHeight: document.documentElement.scrollHeight,
      bodyTextLen: bodyText.length,
      bodyText: bodyText.slice(0, 60_000),
    };
  });
}

async function capture(options) {
  assertDetailUrl(options.requestedUrl, 'requested');
  ensureNewOutputDir(options.outDir);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'detail-page-spa-patchright-'));
  let browser = null;
  let context = null;
  // The bundled Chromium is reliable in headless CI. For the optional headed
  // route, retain the existing Wadiz approach: a persistent installed-Chrome
  // profile with Patchright's browser evasions.
  const chromium = requireChromium();
  if (options.headless) {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ viewport: VIEWPORT, locale: 'ko-KR' });
  } else {
    context = await chromium.launchPersistentContext(profile, {
      channel: 'chrome',
      headless: false,
      viewport: VIEWPORT,
      locale: 'ko-KR',
      args: ['--disable-blink-features=AutomationControlled', '--lang=ko-KR'],
    });
  }
  try {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    const page = context.pages()[0] || await context.newPage();
    try {
      const origin = new URL(options.requestedUrl).origin;
      await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await sleep(1_200);
    } catch (_) {
      // Navigation to the target is still authoritative.
    }
    const response = await page.goto(options.requestedUrl, { waitUntil: 'domcontentloaded', timeout: 70_000 });
    const status = response ? response.status() : 'no-response';
    await waitForHydration(page);
    const resolvedUrl = page.url();
    const title = await page.title();
    if (status === 401 || status === 403 || /access denied|forbidden|captcha|verify you are human/iu.test(title)) {
      throw new Error('public capture blocked before hydration (status=' + status + ', title=' + JSON.stringify(title) + ')');
    }
    assertDetailUrl(resolvedUrl, 'resolved');
    const expanded = await dismissTransientUi(page);
    await hydrateLazyContent(page);
    const data = await extractPageData(page);
    if (data.bodyTextLen < 120) throw new Error('hydration produced too little public page content (' + data.bodyTextLen + ' chars)');
    const tileCount = Math.min(Math.ceil(data.pageHeight / VIEWPORT.height), options.maxTiles);
    for (let tile = 0; tile < tileCount; tile += 1) {
      await page.evaluate((scrollY) => window.scrollTo(0, scrollY), tile * VIEWPORT.height);
      await sleep(380);
      await page.screenshot({ path: path.join(options.outDir, `tile_${String(tile).padStart(2, '0')}.png`) });
    }
    const artifactData = {
      url: resolvedUrl,
      status,
      title: data.title,
      headings: data.headings,
      imageCount: data.imageCount,
      bigImages: data.bigImages,
      pageHeight: data.pageHeight,
      bodyTextLen: data.bodyTextLen,
      requestedUrl: options.requestedUrl,
      expanded,
    };
    const capture = {
      url: resolvedUrl,
      status,
      title: data.title,
      pageHeight: data.pageHeight,
      bodyTextLen: data.bodyTextLen,
      imageCount: data.imageCount,
      tiles: tileCount,
      coveredHeight: tileCount * VIEWPORT.height,
      maxTiles: options.maxTiles,
      outDir: options.outDir,
      requestedUrl: options.requestedUrl,
      capturedAt: new Date().toISOString(),
      renderer: 'patchright-chromium-' + (options.headless ? 'headless' : 'headed'),
      hydrated: true,
      expanded,
    };
    fs.writeFileSync(path.join(options.outDir, 'data.json'), JSON.stringify(artifactData, null, 2) + '\n');
    fs.writeFileSync(path.join(options.outDir, 'bodytext.txt'), data.bodyText + '\n');
    fs.writeFileSync(path.join(options.outDir, 'capture.json'), JSON.stringify(capture, null, 2) + '\n');
    console.log(JSON.stringify(capture));
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  fail(error.message);
}
if (options) {
  capture(options).catch((error) => fail(error.message, 2));
}
