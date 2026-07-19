// capture-styles.js — collect live, computed style evidence with Patchright.
// Usage: node scripts/capture-styles.js <url> [outDir] [--force]
// patchright is lazy-required inside the launch path (shoot.js convention) so
// pure-function consumers (tests importing separatePlatformStyles) load
// without the browser dependency installed.
function requireChromium() {
  try { return require('patchright').chromium; }
  catch (e) {
    throw new Error('patchright is not installed — run /design-setup (npm install + npx patchright install chromium). (' + e.message + ')');
  }
}
const fs = require('fs');
const path = require('path');
const {
  MAKER_REGION_SELECTORS,
  classifyAuthoredRegion,
  resolveMakerRegion,
} = require('./authored-region.js');

const DEFAULT_OUT_DIR = '/tmp/style-capture-patchright';

// Strict argv parsing: url [outDir] [--force]. Unknown flags and extra
// positionals are recorded as an error (reported inside runCapture so that
// requiring this module for its exports stays side-effect free).
function parseCaptureArgs(argv) {
  const parsed = { url: null, outDir: DEFAULT_OUT_DIR, force: false, error: null };
  const positionals = [];
  for (const argument of argv) {
    if (argument === '--force') {
      parsed.force = true;
    } else if (argument.startsWith('-')) {
      parsed.error = `unknown argument: ${argument}`;
      return parsed;
    } else {
      positionals.push(argument);
    }
  }
  if (positionals.length > 2) {
    parsed.error = `unexpected extra argument: ${positionals[2]}`;
    return parsed;
  }
  parsed.url = positionals[0] || null;
  if (positionals[1]) parsed.outDir = positionals[1];
  return parsed;
}

const parsedArgs = parseCaptureArgs(process.argv.slice(2));
const requestedUrl = parsedArgs.url;
const outDir = parsedArgs.outDir;
const force = parsedArgs.force;
const viewport = { width: 1280, height: 1600 };
const OVERWRITE_MESSAGE = (file) => `REFUSING — output already exists: ${file}; skipped without --force (non-destructive overwrite guard).`;
const EXPLICIT_REGION_MESSAGE = 'REFUSING — authored region is unresolved; provide an explicit region classification; no region default will be assumed.';

const profile = path.join(outDir, `.profile_${Date.now()}`);
const stylesPath = path.join(outDir, 'styles.json');
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
      // Continue trying the other capture-reference-patchright.js labels.
    }
  }
  const moreButton = await page.evaluateHandle(() => {
    const candidates = [...document.querySelectorAll('button,a,[role="button"]')];
    return candidates.find((element) => {
      const text = (element.innerText || element.textContent || '').trim();
      const rect = element.getBoundingClientRect();
      return text.includes('더보기') && rect.top > 700 && !element.closest('header,nav');
    }) || null;
  });
  const moreElement = moreButton.asElement();
  if (!moreElement) return null;
  await moreElement.scrollIntoViewIfNeeded();
  await sleep(500);
  await moreElement.click({ timeout: 1800 });
  await sleep(1400);
  return '더보기';
}

function emptyResult() {
  return {
    meta: {
      url: requestedUrl,
      status: null,
      title: null,
      viewport: null,
      capturedAt: new Date().toISOString(),
      collectorVersion: '1.0.0',
    },
    type: {
      display: null,
      body: null,
      mono: null,
      documentFonts: null,
    },
    color: {
      backgrounds: null,
      text: null,
    },
    cssVariables: null,
    spacing: null,
    radius: null,
    elevation: null,
    motion: {
      transitions: null,
      animations: null,
      prefersReducedMotion: null,
    },
    // On a chrome-hosted page these are the only token buckets. Bare fields
    // stay empty so no consumer can mistake a mixed page-wide tally for maker
    // evidence.
    makerStyles: null,
    chromeStyles: null,
    authoredRegion: {
      verdict: 'unknown',
      signals: {
        cssVarCount: null,
        pageHeightPx: null,
        bodyTextLen: null,
        bigImageCount: null,
        textToHeightRatio: null,
        largestHeadingPx: null,
      },
      note: null,
    },
    gaps: [],
  };
}

function reason(error) {
  return error && error.message ? error.message : String(error);
}

function addGap(result, field, why) {
  result.gaps.push({ field, reason: why });
}

function writeResult(result) {
  fs.writeFileSync(stylesPath, JSON.stringify(result, null, 2));
}

function summary(result) {
  return {
    url: result.meta.url,
    status: result.meta.status,
    title: result.meta.title,
    blocked: result.gaps.some((gap) => gap.reason.startsWith('botWall:')),
    stylesPath,
    makerStyles: result.makerStyles && result.makerStyles.status,
    chromeStyles: result.chromeStyles && result.chromeStyles.status,
    gaps: result.gaps.length,
  };
}

function computedColorRecord(cssValue) {
  const value = String(cssValue || '').trim();
  const match = value.match(/^rgba?\(\s*([\d.]+)[,\s]+\s*([\d.]+)[,\s]+\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/iu);
  if (!match) return { key: value, value, cssRgb: value, transparent: !value || value === 'transparent' };
  const red = Math.round(Number(match[1]));
  const green = Math.round(Number(match[2]));
  const blue = Math.round(Number(match[3]));
  const alpha = match[4] === undefined ? 1 : Number(match[4]);
  if (![red, green, blue, alpha].every(Number.isFinite)) return { key: value, value, cssRgb: value, transparent: false };
  const alphaByte = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
  const hex = [red, green, blue, alphaByte]
    .map((part) => Math.max(0, Math.min(255, part)).toString(16).padStart(2, '0'));
  const hexValue = alphaByte === 255 ? `#${hex.slice(0, 3).join('')}` : `#${hex.join('')}`;
  const cssRgb = alpha === 1 ? `rgb(${red}, ${green}, ${blue})` : `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  return { key: cssRgb, value: hexValue, cssRgb, transparent: alpha <= 0 };
}

function colorInventory(samples, property) {
  const counts = new Map();
  let totalArea = 0;
  for (const sample of samples || []) {
    const color = computedColorRecord(sample && sample[property]);
    const area = Number(sample && sample.area);
    if (color.transparent || !Number.isFinite(area) || area <= 0) continue;
    const entry = counts.get(color.key) || { value: color.value, cssRgb: color.cssRgb, area: 0 };
    entry.area += area;
    counts.set(color.key, entry);
    totalArea += area;
  }
  if (!totalArea) return null;
  return [...counts.values()]
    .map(({ value, cssRgb, area }) => ({ value, cssRgb, areaShare: area / totalArea }))
    .sort((left, right) => right.areaShare - left.areaShare || left.value.localeCompare(right.value))
    .slice(0, 8);
}

function exactMakerAccent(samples) {
  const semanticMarker = /(?:^|[\s_-])(?:accent|brand|primary|highlight|cta)(?:$|[\s_-])/iu;
  const candidates = [];
  for (const sample of samples || []) {
    if (!semanticMarker.test(String(sample && sample.semantic || ''))) continue;
    for (const property of ['color', 'backgroundColor']) {
      const color = computedColorRecord(sample && sample[property]);
      if (color.transparent || !/^#[0-9a-f]{6}$/iu.test(color.value)) continue;
      candidates.push({
        value: color.value,
        source: {
          selector: sample.selector || null,
          property,
          semanticSignal: String(sample.semantic || '').trim() || null,
        },
      });
    }
  }
  const values = [...new Set(candidates.map((candidate) => candidate.value))].sort();
  if (values.length !== 1) return null;
  return candidates
    .filter((candidate) => candidate.value === values[0])
    .sort((left, right) => `${left.source.selector}:${left.source.property}`.localeCompare(`${right.source.selector}:${right.source.property}`))[0];
}

function styleBucket(status, region, samples, scope) {
  const resolved = status === 'resolved';
  const exactAccent = resolved && scope === 'maker-authored-region' ? exactMakerAccent(samples) : null;
  return {
    status,
    region,
    scope,
    color: {
      backgrounds: resolved || scope === 'platform-chrome' ? colorInventory(samples, 'backgroundColor') : null,
      text: resolved || scope === 'platform-chrome' ? colorInventory(samples, 'color') : null,
    },
    exactAccent,
    gap: resolved
      ? (scope === 'maker-authored-region' && !exactAccent
        ? 'MISS — no unambiguous semantic maker accent was exposed by a computed color; no hex was inferred.'
        : null)
      : region.reason,
  };
}

// This is intentionally a two-input split, rather than a page-wide tally with
// labels attached afterwards. A node belongs to exactly one bucket.
function separatePlatformStyles({ makerRegion, makerSamples, chromeSamples }) {
  const region = makerRegion && typeof makerRegion === 'object'
    ? makerRegion
    : { status: 'MISS', selector: null, reason: 'MISS — maker region was not collected.' };
  return {
    makerStyles: styleBucket(region.status, region, makerSamples || [], 'maker-authored-region'),
    chromeStyles: styleBucket('resolved', { status: 'resolved', selector: null }, chromeSamples || [], 'platform-chrome'),
  };
}

function runCapture() {
  if (parsedArgs.error || !requestedUrl) {
    if (parsedArgs.error) console.error(parsedArgs.error);
    console.error('usage: node scripts/capture-styles.js <url> [outDir] [--force]');
    process.exit(1);
  }
  if (fs.existsSync(stylesPath) && !force) {
    console.error(OVERWRITE_MESSAGE(stylesPath));
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const result = emptyResult();
  let ctx;

  try {
    // Keep the persistent Chrome profile, locale, warm-up visit, and viewport used by
    // capture-reference-patchright.js. Patchright applies its browser evasions here.
    ctx = await requireChromium().launchPersistentContext(profile, {
      channel: 'chrome',
      headless: false,
      viewport: null,
      locale: 'ko-KR',
    });
    const page = ctx.pages()[0] || await ctx.newPage();

    try {
      const origin = new URL(requestedUrl).origin;
      await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await sleep(3500);
    } catch (_) {
      // The target navigation below is authoritative; warm-up is only best effort.
    }

    let response = null;
    try {
      response = await page.goto(requestedUrl, { waitUntil: 'domcontentloaded', timeout: 70000 });
    } catch (error) {
      addGap(result, 'capture', `navigation failed: ${reason(error)}`);
    }

    await sleep(8000);
    result.meta.url = page.url() || requestedUrl;
    result.meta.status = response ? response.status() : null;
    result.meta.title = await page.title().catch((error) => {
      addGap(result, 'meta.title', `unreadable: ${reason(error)}`);
      return null;
    });

    if (!response) addGap(result, 'meta.status', 'unreadable: navigation returned no response');

    const wall = await page.evaluate(() => ({
      title: document.title,
      body: (document.body && document.body.innerText || '').slice(0, 1600),
    })).catch((error) => {
      addGap(result, 'capture', `page content unreadable: ${reason(error)}`);
      return null;
    });
    const wallText = wall ? `${wall.title}\n${wall.body}` : '';
    const blocked = result.meta.status === 403
      || /Access Denied|Forbidden|Denied|Just a moment|Attention Required|security check|captcha/i.test(wallText);
    if (blocked) {
      addGap(result, 'capture', 'botWall: access was blocked before live style collection');
      addGap(result, 'authoredRegion', 'unreadable: no live page metrics were collected');
      writeResult(result);
      console.log(JSON.stringify(summary(result)));
      // A bot wall means no live style evidence was collected — that is a
      // failed capture, not a pass. The gaps/summary artifacts above remain.
      process.exitCode = 1;
      return;
    }

    try {
      await page.setViewportSize(viewport);
      result.meta.viewport = viewport;
    } catch (error) {
      addGap(result, 'meta.viewport', `unreadable: ${reason(error)}`);
    }
    await sleep(800);
    await clickExpandableText(page);
    await page.keyboard.press('Escape').catch(() => {});
    await gentleScroll(page);
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
    }).catch((error) => addGap(result, 'type.documentFonts', `font readiness unreadable: ${reason(error)}`));

    const live = await page.evaluate((makerSelectors) => {
      const gaps = [];
      const addGap = (field, reason) => gaps.push({ field, reason });
      const isVisible = (element, style = getComputedStyle(element)) => {
        const rect = element.getBoundingClientRect();
        return style.display !== 'none'
          && style.visibility !== 'hidden'
          && Number.parseFloat(style.opacity || '1') > 0
          && rect.width > 0
          && rect.height > 0;
      };
      const isInViewport = (element) => {
        const rect = element.getBoundingClientRect();
        return rect.bottom > 0
          && rect.right > 0
          && rect.top < window.innerHeight
          && rect.left < window.innerWidth;
      };
      const shortDomPath = (element) => {
        const parts = [];
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 4) {
          const tag = current.tagName.toLowerCase();
          const id = current.id ? '#' + current.id : '';
          const className = [...current.classList].find((name) => /^[a-zA-Z][\w-]{0,40}$/.test(name));
          parts.unshift(tag + (id || (className ? '.' + className : '')));
          if (current === document.body) break;
          current = current.parentElement;
        }
        return parts.join(' > ');
      };
      const firstFamily = (stack) => {
        let quote = null;
        let escaped = false;
        for (let index = 0; index < stack.length; index++) {
          const char = stack[index];
          if (escaped) {
            escaped = false;
            continue;
          }
          if (char === '\\') {
            escaped = true;
            continue;
          }
          if (quote) {
            if (char === quote) quote = null;
            continue;
          }
          if (char === '"' || char === "'") {
            quote = char;
            continue;
          }
          if (char === ',') {
            return stack.slice(0, index).trim().replace(/^['"]|['"]$/g, '');
          }
        }
        return stack.trim().replace(/^['"]|['"]$/g, '');
      };
      const fontSample = (element) => {
        if (!element) return null;
        const style = getComputedStyle(element);
        const rawStack = style.fontFamily || null;
        if (!rawStack) return null;
        return {
          resolvedFamily: firstFamily(rawStack),
          rawStack,
          fontWeight: style.fontWeight || null,
          fontSize: style.fontSize || null,
          lineHeight: style.lineHeight || null,
          letterSpacing: style.letterSpacing || null,
          element: element.tagName.toLowerCase(),
          selector: shortDomPath(element),
        };
      };
      const colorParts = (cssValue) => {
        const match = String(cssValue).trim().match(/^rgba?\(\s*([\d.]+)[,\s]+\s*([\d.]+)[,\s]+\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i);
        if (!match) return null;
        const red = Math.round(Number(match[1]));
        const green = Math.round(Number(match[2]));
        const blue = Math.round(Number(match[3]));
        const alpha = match[4] === undefined ? 1 : Number(match[4]);
        if (![red, green, blue, alpha].every(Number.isFinite)) return null;
        return { red, green, blue, alpha };
      };
      const colorRecord = (cssValue) => {
        const parsed = colorParts(cssValue);
        if (!parsed) return { key: String(cssValue).trim(), value: String(cssValue).trim(), cssRgb: String(cssValue).trim(), transparent: false };
        const { red, green, blue, alpha } = parsed;
        const alphaByte = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
        const hex = [red, green, blue, alphaByte]
          .map((part) => Math.max(0, Math.min(255, part)).toString(16).padStart(2, '0'));
        const value = alphaByte === 255 ? `#${hex.slice(0, 3).join('')}` : `#${hex.join('')}`;
        const cssRgb = alpha === 1
          ? `rgb(${red}, ${green}, ${blue})`
          : `rgba(${red}, ${green}, ${blue}, ${alpha})`;
        return { key: cssRgb, value, cssRgb, transparent: alpha <= 0 };
      };
      const sortedCounts = (counts) => [...counts.values()]
        .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
      const addCount = (counts, value) => {
        const entry = counts.get(value) || { value, count: 0 };
        entry.count++;
        counts.set(value, entry);
      };
      const spacingValue = (value) => {
        const match = String(value).trim().match(/^-?(?:\d+|\d*\.\d+)px$/);
        if (!match) return null;
        const numeric = Number.parseFloat(value);
        if (!Number.isFinite(numeric)) return null;
        return `${Number(numeric.toFixed(4))}px`;
      };

      const allElements = [...document.querySelectorAll('*')];
      const rendered = [];
      for (const element of allElements) {
        const style = getComputedStyle(element);
        if (isVisible(element, style)) rendered.push({ element, style, rect: element.getBoundingClientRect() });
      }

      const headingCandidates = rendered
        .filter(({ element }) => /^(H1|H2)$/.test(element.tagName))
        .filter(({ element }) => (element.innerText || element.textContent || '').trim().length > 0);
      const inViewportHeadings = headingCandidates.filter(({ element }) => isInViewport(element));
      const displayCandidates = (inViewportHeadings.some(({ element }) => !element.closest('nav,header,footer'))
        ? inViewportHeadings.filter(({ element }) => !element.closest('nav,header,footer'))
        : inViewportHeadings)
        .sort((left, right) => {
          const sizeDelta = Number.parseFloat(right.style.fontSize) - Number.parseFloat(left.style.fontSize);
          if (sizeDelta) return sizeDelta;
          return (right.rect.width * right.rect.height) - (left.rect.width * left.rect.height);
        });
      const display = fontSample(displayCandidates[0] && displayCandidates[0].element);
      if (!display) addGap('type.display', 'no rendered in-viewport h1 or h2 was found');

      const excludedProseAncestor = 'textarea,input,select,option,button,label,code,pre,kbd,samp,[contenteditable],[role="textbox"]';
      const proseCandidates = [...document.querySelectorAll('p,li,blockquote,article,dd,figcaption,div,span')]
        .filter((element) => {
          const tag = element.tagName.toLowerCase();
          return !['div', 'span'].includes(tag) || element.children.length === 0;
        })
        .filter((element) => !element.closest(excludedProseAncestor))
        .map((element) => ({ element, style: getComputedStyle(element), text: (element.innerText || element.textContent || '').trim() }))
        .filter(({ element, style, text }) => text.length > 0 && isVisible(element, style));
      const bodyPool = proseCandidates.some(({ element }) => !element.closest('nav,header,footer'))
        ? proseCandidates.filter(({ element }) => !element.closest('nav,header,footer'))
        : proseCandidates;
      const bodyCandidate = bodyPool
        .sort((left, right) => right.text.length - left.text.length
          || (right.element.getBoundingClientRect().width * right.element.getBoundingClientRect().height)
            - (left.element.getBoundingClientRect().width * left.element.getBoundingClientRect().height))[0];
      const body = fontSample(bodyCandidate && bodyCandidate.element);
      if (!body) addGap('type.body', 'no rendered prose candidate remained after form-control, code, landmark, and visibility filtering');

      const monoCandidate = rendered.find(({ style }) => /mono|code|courier/i.test(style.fontFamily || ''));
      const mono = fontSample(monoCandidate && monoCandidate.element);
      if (!mono) addGap('type.mono', 'no rendered element used a mono/code/courier computed font family');

      let documentFonts = null;
      if ('fonts' in document && document.fonts) {
        try {
          documentFonts = [...document.fonts]
            .filter((font) => font.status === 'loaded')
            .map((font) => ({ family: font.family || null, weight: font.weight || null }));
        } catch (error) {
          addGap('type.documentFonts', `unreadable: ${error.message || String(error)}`);
        }
      } else {
        addGap('type.documentFonts', 'document.fonts is unavailable');
      }

      const backgrounds = new Map();
      const textColors = new Map();
      let backgroundArea = 0;
      let textArea = 0;
      for (const { style, rect } of rendered) {
        const area = rect.width * rect.height;
        const background = colorRecord(style.backgroundColor);
        if (!background.transparent) {
          const entry = backgrounds.get(background.key) || { value: background.value, cssRgb: background.cssRgb, area: 0 };
          entry.area += area;
          backgrounds.set(background.key, entry);
          backgroundArea += area;
        }
        const text = colorRecord(style.color);
        if (!text.transparent) {
          const entry = textColors.get(text.key) || { value: text.value, cssRgb: text.cssRgb, area: 0 };
          entry.area += area;
          textColors.set(text.key, entry);
          textArea += area;
        }
      }
      const colorList = (counts, totalArea, limit) => [...counts.values()]
        .map(({ value, cssRgb, area }) => ({ value, cssRgb, areaShare: totalArea ? area / totalArea : null }))
        .sort((left, right) => right.areaShare - left.areaShare || left.value.localeCompare(right.value))
        .slice(0, limit);
      const backgroundList = backgroundArea ? colorList(backgrounds, backgroundArea, 8) : null;
      const textColorList = textArea ? colorList(textColors, textArea, 6) : null;
      if (!backgroundList) addGap('color.backgrounds', 'no non-transparent computed background colors were found on visible elements');
      if (!textColorList) addGap('color.text', 'no non-transparent computed text colors were found on visible elements');

      const root = document.documentElement;
      const rootStyle = getComputedStyle(root);
      const customProperties = new Set();
      const skippedSheets = new Set();
      let prefersReducedMotion = false;
      const rememberSkippedSheet = (href, error) => {
        const sheetHref = href || '(inline stylesheet with unreadable cssRules)';
        const key = `${sheetHref}::${error && (error.name || error.message)}`;
        if (skippedSheets.has(key)) return;
        skippedSheets.add(key);
        addGap('cssVariables', `externalCssSkipped: ${sheetHref} (${error && (error.name || error.message) || 'cssRules unreadable'})`);
      };
      const visitRules = (rules, href) => {
        for (const rule of rules) {
          if (rule.type === CSSRule.STYLE_RULE && /(^|,)\s*:root\b/.test(rule.selectorText || '')) {
            for (const name of rule.style) if (name.startsWith('--')) customProperties.add(name);
          }
          if (rule.type === CSSRule.MEDIA_RULE && /prefers-reduced-motion/i.test(rule.conditionText || '')) {
            prefersReducedMotion = true;
          }
          if ('cssRules' in rule) {
            try {
              visitRules(rule.cssRules, href);
            } catch (error) {
              rememberSkippedSheet(href, error);
            }
          }
        }
      };
      for (const sheet of document.styleSheets) {
        try {
          visitRules(sheet.cssRules, sheet.href);
        } catch (error) {
          rememberSkippedSheet(sheet.href, error);
        }
      }
      for (const name of root.style) if (name.startsWith('--')) customProperties.add(name);
      for (const name of rootStyle) if (name.startsWith('--')) customProperties.add(name);
      const cssVariables = {};
      for (const name of [...customProperties].sort()) {
        const value = rootStyle.getPropertyValue(name).trim();
        if (value) cssVariables[name] = value;
        else addGap('cssVariables', `unreadable: ${name} has no resolved computed value on :root`);
      }

      const pageHeightPx = Math.max(
        document.documentElement ? document.documentElement.scrollHeight : 0,
        document.body ? document.body.scrollHeight : 0,
      );
      const bodyTextLen = document.body ? (document.body.innerText || '').length : null;
      const bigImageCount = rendered.filter(({ element, rect }) => element.tagName === 'IMG' && rect.height > 350).length;
      const largestHeadingPx = headingCandidates
        .map(({ style }) => Number.parseFloat(style.fontSize))
        .filter(Number.isFinite)
        .sort((left, right) => right - left)[0] || null;
      const textToHeightRatio = bodyTextLen !== null && pageHeightPx > 0
        ? bodyTextLen / pageHeightPx
        : null;
      const authoredRegionSignals = {
        cssVarCount: Object.keys(cssVariables).length,
        pageHeightPx: pageHeightPx || null,
        bodyTextLen,
        bigImageCount,
        textToHeightRatio,
        largestHeadingPx,
      };

      const candidateElements = [];
      const seenCandidates = new Set();
      for (const sourceSelector of makerSelectors) {
        let matched = [];
        try {
          matched = [...document.querySelectorAll(sourceSelector)];
        } catch (_) {
          // Selector configuration is shipped code; an unsupported selector is
          // not evidence for a fallback region.
          continue;
        }
        for (const element of matched) {
          if (seenCandidates.has(element)) continue;
          seenCandidates.add(element);
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          if (!isVisible(element, style)) continue;
          candidateElements.push({
            element,
            selector: shortDomPath(element),
            sourceSelector,
            width: rect.width,
            height: rect.height,
            descendantCount: element.querySelectorAll('*').length,
            imageCount: element.querySelectorAll('img').length,
            textLength: (element.innerText || element.textContent || '').trim().length,
          });
        }
      }
      const viableCandidates = candidateElements
        .filter((candidate) => candidate.width >= 280 && candidate.height >= 480)
        .filter((candidate) => candidate.descendantCount >= 3)
        .filter((candidate) => candidate.imageCount >= 1 || candidate.textLength >= 120)
        .sort((left, right) => (right.width * right.height) - (left.width * left.height)
          || right.height - left.height
          || left.selector.localeCompare(right.selector));
      const makerCandidate = viableCandidates[0] || null;
      const makerRegion = makerCandidate
        ? {
          status: 'resolved',
          selector: makerCandidate.selector,
          sourceSelector: makerCandidate.sourceSelector,
          width: makerCandidate.width,
          height: makerCandidate.height,
          descendantCount: makerCandidate.descendantCount,
          imageCount: makerCandidate.imageCount,
          textLength: makerCandidate.textLength,
        }
        : {
          status: 'MISS',
          selector: null,
          reason: 'MISS — no resolvable maker-authored story region met the conservative size/content evidence threshold; no maker token will be inferred.',
        };
      const regionSample = ({ element, style, rect }) => {
        const className = typeof element.className === 'string'
          ? element.className
          : (element.getAttribute('class') || '');
        return {
          selector: shortDomPath(element),
          semantic: [
            element.id,
            className,
            element.getAttribute('data-testid'),
            element.getAttribute('aria-label'),
            element.getAttribute('role'),
          ].filter(Boolean).join(' '),
          area: rect.width * rect.height,
          color: style.color,
          backgroundColor: style.backgroundColor,
        };
      };
      const makerSamples = makerCandidate
        ? rendered.filter(({ element }) => makerCandidate.element.contains(element)).map(regionSample)
        : [];
      const chromeSamples = makerCandidate
        ? rendered.filter(({ element }) => !makerCandidate.element.contains(element)).map(regionSample)
        : rendered.map(regionSample);

      const spacing = new Map();
      for (const { element, style } of rendered) {
        if (!/^(SECTION|DIV)$/.test(element.tagName) || !element.children.length) continue;
        for (const property of [
          'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
          'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
          'rowGap', 'columnGap',
        ]) {
          const value = spacingValue(style[property]);
          if (value !== null) addCount(spacing, value);
        }
      }

      const radii = new Map();
      const elevations = new Map();
      const transitions = new Map();
      const animations = new Map();
      for (const { style } of rendered) {
        addCount(radii, style.borderRadius || '');
        addCount(elevations, style.boxShadow || '');
        addCount(transitions, style.transition || '');
        addCount(animations, style.animation || '');
      }

      return {
        type: { display, body, mono, documentFonts },
        color: { backgrounds: backgroundList, text: textColorList },
        cssVariables,
        spacing: sortedCounts(spacing),
        radius: sortedCounts(radii),
        elevation: sortedCounts(elevations),
        motion: {
          transitions: sortedCounts(transitions),
          animations: sortedCounts(animations),
          prefersReducedMotion,
        },
        authoredRegionSignals,
        platformStyleSamples: { makerRegion, makerSamples, chromeSamples },
        gaps,
      };
    }, MAKER_REGION_SELECTORS);

    live.authoredRegion = classifyAuthoredRegion(live.authoredRegionSignals);
    if (live.authoredRegion.verdict === 'likely-platform-chrome') {
      const expectedRegion = resolveMakerRegion(live.platformStyleSamples.makerRegion.status === 'resolved'
        ? [live.platformStyleSamples.makerRegion]
        : []);
      live.platformStyleSamples.makerRegion = expectedRegion;
      Object.assign(live, separatePlatformStyles(live.platformStyleSamples));
    }
    if (live.authoredRegion.verdict === 'unknown') {
      console.error(EXPLICIT_REGION_MESSAGE);
      process.exitCode = 1;
      live.gaps.push({
        field: 'authoredRegion',
        reason: 'unknown: conservative platform-chrome and DOM-authored thresholds were not both satisfied',
      });
    }

    if (live.authoredRegion.verdict === 'likely-platform-chrome') {
      result.makerStyles = live.makerStyles;
      result.chromeStyles = live.chromeStyles;
      if (result.makerStyles.status === 'MISS') addGap(result, 'makerStyles', result.makerStyles.gap);
    } else {
      result.type = live.type;
      result.color = live.color;
      result.cssVariables = live.cssVariables;
      result.spacing = live.spacing;
      result.radius = live.radius;
      result.elevation = live.elevation;
      result.motion = live.motion;
    }
    result.authoredRegion = live.authoredRegion;
    result.gaps.push(...live.gaps);
  } catch (error) {
    addGap(result, 'capture', `unreadable: ${reason(error)}`);
    addGap(result, 'authoredRegion', 'unreadable: live page evaluation did not complete');
  } finally {
    if (ctx) await ctx.close().catch((error) => addGap(result, 'capture', `browser close failed: ${reason(error)}`));
  }

  writeResult(result);
  console.log(JSON.stringify(summary(result)));
})().catch((error) => {
  // This is only reachable if serializing or writing the evidence itself fails.
  console.error('FATAL', reason(error));
  process.exit(2);
});
}

if (require.main === module) runCapture();

module.exports = {
  computedColorRecord,
  separatePlatformStyles,
};
