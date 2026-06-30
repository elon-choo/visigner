// capture-reference-patchright.js — capture a real reference page with Patchright.
// Use this when the normal Playwright capture hits bot walls such as Wadiz/Akamai.
// Usage: node scripts/capture-reference-patchright.js <url> [outDir]
const { chromium } = require('patchright');
const fs = require('fs');
const path = require('path');

const url = process.argv[2];
const outDir = process.argv[3] || '/tmp/reference-capture-patchright';
const maxTiles = Number(process.env.MAX_TILES || 90);
if (!url) {
  console.error('usage: node scripts/capture-reference-patchright.js <url> [outDir]');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const profile = path.join(outDir, `.profile_${Date.now()}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function gentleScroll(page) {
  for (let pass = 0; pass < 2; pass++) {
    const height = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < height + 1200; y += 480) {
      await page.mouse.wheel(0, 480);
      await sleep(220 + Math.floor(Math.random() * 120));
    }
    await sleep(1000);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(700);
}

async function clickExpandableText(page) {
  const labels = ['상세보기', '프로젝트 더보기', '자세히 보기', 'Read more', 'Show more'];
  for (const label of labels) {
    try {
      const button = page.getByText(label, { exact: false }).first();
      if (await button.count()) {
        await button.scrollIntoViewIfNeeded();
        await sleep(500);
        await button.click({ timeout: 1800 });
        await sleep(1400);
        return label;
      }
    } catch (_) {
      // Continue trying other common labels.
    }
  }
  const moreButton = await page.evaluateHandle(() => {
    const candidates = [...document.querySelectorAll('button,a,[role="button"]')];
    return candidates.find((element) => {
      const text = (element.innerText || element.textContent || '').trim();
      const rect = element.getBoundingClientRect();
      const inHeader = Boolean(element.closest('header,nav'));
      return text.includes('더보기') && rect.top > 700 && !inHeader;
    }) || null;
  });
  const moreElement = moreButton.asElement();
  if (moreElement) {
    await moreElement.scrollIntoViewIfNeeded();
    await sleep(500);
    await moreElement.click({ timeout: 1800 });
    await sleep(1400);
    return '더보기';
  }
  return null;
}

(async () => {
  const ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chrome',
    headless: false,
    viewport: null,
    locale: 'ko-KR',
  });

  try {
    const page = ctx.pages()[0] || await ctx.newPage();

    // Warm up the origin before the exact target. This mimics a normal browsing path.
    try {
      const origin = new URL(url).origin;
      await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await sleep(3500);
    } catch (_) {}

    let status = 'unknown';
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 70000 });
      status = response ? response.status() : 'no-resp';
    } catch (error) {
      status = `err:${error.message}`;
    }

    await sleep(8000);
    const title = await page.title();
    if (/Access Denied|Forbidden|Denied/i.test(title) || status === 403) {
      console.log(JSON.stringify({
        url,
        status,
        title,
        blocked: true,
        hint: 'Still blocked. Wait for IP cooldown or open the page manually in Chrome before trying CDP attach capture.',
      }));
      return;
    }

    await page.setViewportSize({ width: 1280, height: 1600 });
    await sleep(800);
    const expanded = await clickExpandableText(page);
    await page.keyboard.press('Escape').catch(() => {});
    await gentleScroll(page);

    const data = await page.evaluate(() => {
      const headings = [...document.querySelectorAll('h1,h2,h3,h4')]
        .map((element) => `${element.tagName}: ${element.innerText.trim()}`)
        .filter((text) => text.length > 2 && text.length < 160)
        .slice(0, 150);
      const images = [...document.querySelectorAll('img')]
        .map((image) => ({
          src: image.currentSrc || image.src,
          w: image.naturalWidth,
          h: image.naturalHeight,
        }))
        .filter((image) => image.w > 200);
      const bodyText = document.body.innerText.replace(/\n{3,}/g, '\n\n').trim();
      return {
        title: document.title,
        headings,
        imageCount: images.length,
        bigImages: images.filter((image) => image.h > 350).map((image) => image.src).slice(0, 80),
        pageHeight: document.body.scrollHeight,
        bodyTextLen: bodyText.length,
        bodyText: bodyText.slice(0, 60000),
      };
    });

    fs.writeFileSync(
      path.join(outDir, 'data.json'),
      JSON.stringify({ url, status, expanded, ...data, bodyText: undefined }, null, 2)
    );
    fs.writeFileSync(path.join(outDir, 'bodytext.txt'), data.bodyText);

    const tileHeight = 1600;
    const tiles = Math.min(Math.ceil(data.pageHeight / tileHeight), maxTiles);
    for (let i = 0; i < tiles; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), i * tileHeight);
      await sleep(550);
      await page.screenshot({ path: path.join(outDir, `tile_${String(i).padStart(2, '0')}.png`) });
    }

    const summary = {
      url,
      status,
      title: data.title,
      pageHeight: data.pageHeight,
      bodyTextLen: data.bodyTextLen,
      imageCount: data.imageCount,
      expanded,
      tiles,
      coveredHeight: tiles * tileHeight,
      maxTiles,
      outDir,
    };
    fs.writeFileSync(path.join(outDir, 'capture.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary));
  } finally {
    await ctx.close();
  }
})().catch((error) => {
  console.error('FATAL', error.message);
  process.exit(2);
});
