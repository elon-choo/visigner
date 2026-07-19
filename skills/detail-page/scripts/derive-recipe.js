'use strict';

// Deterministic capture -> build-recipe skeleton derivation. This script only
// reads bodytext.txt and styles.json; it deliberately leaves tile-dependent
// composition, signature, and implementation decisions empty for G2.4.

const fs = require('fs');
const path = require('path');

const BODY_FIELDS = 7;
const TOKEN_FIELDS = 9;
const VISION_SLOT = '_EMPTY — [tile — TODO vision (G2.4)]; no visual claim is made._';
const TILE_SENTINEL = '<!-- Structural sentinel for recipe-validate.js: [tile] is not tile evidence and does not fill any empty slot. -->';
const STYLES_SENTINEL = '<!-- Structural sentinel for recipe-validate.js: [styles] is not a token claim while the token source is unavailable. -->';
const MISS_MESSAGE = 'MISS — no matching capture value found — this is a database miss, not an empty value; do not invent one.';
const OVERWRITE_MESSAGE = (file) => `REFUSING — output already exists: ${file}; skipped without --force (non-destructive overwrite guard).`;

function readText(file, required) {
  if (!fs.existsSync(file)) {
    if (required) throw new Error(`required capture artifact is missing: ${file}`);
    return null;
  }
  return fs.readFileSync(file, 'utf8');
}

function readJson(file, required) {
  const text = readText(file, required);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`cannot parse JSON ${file}: ${error.message}`);
  }
}

function requiredObject(value, file) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${file} must contain a JSON object`);
  }
  return value;
}

function escapeTable(value) {
  return String(value).replaceAll('|', '\\|');
}

function percent(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${(value * 100).toFixed(3)}%`
    : 'unavailable';
}

function inline(value) {
  return `\`${String(value).replaceAll('`', '\\`')}\``;
}

function fenceFor(content) {
  // A fence must be longer than the longest backtick run in the fenced content,
  // or the content would terminate the fence early. Minimum stays at 4.
  const longestRun = (String(content).match(/`+/gu) || [])
    .reduce((max, run) => Math.max(max, run.length), 0);
  return '`'.repeat(Math.max(4, longestRun + 1));
}

function verbatim(label, lines) {
  if (!Array.isArray(lines) || lines.length === 0 || lines.every((line) => line.trim() === '')) {
    return `**${label}:** _${MISS_MESSAGE} No matching verbatim bodytext.txt segment was mechanically located._`;
  }
  const fence = fenceFor(lines.join('\n'));
  return `**${label}:**\n\n${fence}text\n${lines.join('\n')}\n${fence}`;
}

function nonEmptyLines(text) {
  return String(text).replace(/\r\n?/gu, '\n').split('\n');
}

function headingText(data, level, occurrence = 0) {
  const prefix = `${level}:`;
  const headings = Array.isArray(data.headings) ? data.headings : [];
  const found = headings
    .filter((heading) => typeof heading === 'string' && heading.startsWith(prefix))
    .map((heading) => heading.slice(prefix.length).trim());
  return found[occurrence] || null;
}

function findLineSequence(lines, text, from = 0) {
  if (!text) return -1;
  const target = String(text).replace(/\r\n?/gu, '\n').split('\n');
  if (!target.length) return -1;
  outer: for (let index = from; index <= lines.length - target.length; index += 1) {
    for (let offset = 0; offset < target.length; offset += 1) {
      if (lines[index + offset] !== target[offset]) continue outer;
    }
    return index;
  }
  return -1;
}

function nextParagraph(lines, start) {
  let index = start;
  while (index < lines.length && lines[index].trim() === '') index += 1;
  const end = index;
  while (index < lines.length && lines[index].trim() !== '') index += 1;
  return { start: end, end: index, lines: lines.slice(end, index) };
}

function deriveBodyContent(bodytext, data) {
  const lines = nonEmptyLines(bodytext);
  const h1 = headingText(data, 'H1');
  const h2 = headingText(data, 'H2');
  const h2Next = headingText(data, 'H2', 1);
  const h1Start = findLineSequence(lines, h1);
  const h1Lines = h1 ? h1.split('\n') : [];
  const h1End = h1Start === -1 ? -1 : h1Start + h1Lines.length;
  const subhead = h1End === -1 ? { start: -1, end: -1, lines: [] } : nextParagraph(lines, h1End);
  const h2Start = findLineSequence(lines, h2, Math.max(0, subhead.end));
  const h2Lines = h2 ? h2.split('\n') : [];
  const h2End = h2Start === -1 ? -1 : h2Start + h2Lines.length;
  const h2NextStart = findLineSequence(lines, h2Next, Math.max(0, h2End));

  // The named content fields are filled only by direct bodytext segments.
  // Brand/wordmark classification has no body-only rule, so it stays explicit
  // rather than turning arbitrary copy into a fabricated logo strip.
  const content = {
    navigation: h1Start > 0 ? lines.slice(0, h1Start) : [],
    hero: h1Start !== -1 ? lines.slice(h1Start, subhead.end) : [],
    product: subhead.end > -1 && h2Start > subhead.end ? lines.slice(subhead.end, h2Start) : [],
    brands: [],
    statement: h2Start !== -1 ? lines.slice(h2Start, h2End) : [],
    features: h2End > -1 && h2NextStart > h2End ? lines.slice(h2End, h2NextStart) : [],
    chapter: h2NextStart !== -1 ? lines.slice(h2NextStart) : [],
    transcript: lines,
  };
  const filled = ['navigation', 'hero', 'product', 'brands', 'statement', 'features', 'chapter']
    .filter((key) => content[key].length > 0).length;
  return { content, filled };
}

function cssVariables(styles, matcher) {
  return Object.entries(styles.cssVariables || {}).filter(([name]) => matcher.test(name));
}

function cssVariableList(styles, matcher) {
  const entries = cssVariables(styles, matcher);
  if (!entries.length) return '_None collected._';
  return entries.map(([name, value]) => `- ${inline(name)} = ${inline(value)}`).join('\n');
}

function measuredList(entries, label) {
  if (!Array.isArray(entries) || !entries.length) return `_No ${label} measurements were collected._`;
  return entries.map((entry) => {
    const count = entry && Object.prototype.hasOwnProperty.call(entry, 'count') ? `; count ${entry.count}` : '';
    return `- ${inline(entry && entry.value)}${count}`;
  }).join('\n');
}

function typeLine(name, value) {
  if (!value || typeof value !== 'object') return `- **${name}:** _No computed sample was collected._`;
  const props = ['resolvedFamily', 'fontWeight', 'fontSize', 'lineHeight', 'letterSpacing']
    .filter((key) => value[key] !== undefined && value[key] !== null)
    .map((key) => `${key} ${inline(value[key])}`)
    .join('; ');
  return `- **${name}:** ${props || '_No computed type values were collected._'}`;
}

function colorRoles(backgrounds) {
  const ranks = ['60 — largest measured background share', '30 — second measured background share', '10 — third measured background share'];
  if (!Array.isArray(backgrounds) || !backgrounds.length) return '_No computed background measurements were collected._';
  return ranks.map((role, index) => {
    const color = backgrounds[index];
    if (!color) return `- **${role}:** _unavailable_`;
    return `- **${role}:** ${inline(color.value)} (${percent(color.areaShare)})`;
  }).join('\n');
}

function colorTable(entries) {
  if (!Array.isArray(entries) || !entries.length) return '_None collected._';
  return [
    '| Value | Computed CSS color | Area share |',
    '|---|---|---:|',
    ...entries.map((entry) => `| ${inline(entry.value)} | ${inline(entry.cssRgb)} | ${percent(entry.areaShare)} |`),
  ].join('\n');
}

function makerAccentEnvelope(styles) {
  const accent = styles && styles.makerStyles && styles.makerStyles.exactAccent;
  if (!accent || !/^#[0-9a-f]{6}$/iu.test(accent.value || '') || !accent.source
    || !accent.source.selector || !accent.source.property) return null;
  return {
    value: accent.value,
    provenance: 'styles-json',
    confidence: null,
    evidence: 'styles.json#/makerStyles/exactAccent/value',
    gap: null,
  };
}

function tokenBlock(styles, availability) {
  if (availability === 'maker-accent') {
    const accent = makerAccentEnvelope(styles);
    const makerColor = styles.makerStyles.color || {};
    return [
      '### 1.1 Color — maker-authored exact accent [styles]',
      'The platform chrome bucket is deliberately excluded. This is a direct computed-style read from the resolved maker story region, not a palette bucket.',
      '',
      '**Maker accent provenance envelope:**',
      '```json',
      JSON.stringify(accent, null, 2),
      '```',
      '',
      '**Measured maker backgrounds:**',
      colorTable(makerColor.backgrounds),
      '',
      '**Measured maker text colors:**',
      colorTable(makerColor.text),
      '',
      '### 1.2 Type',
      `${VISION_SLOT} Only the exact maker color token is source-qualified; no type token is inferred.`,
      '',
      '### 1.3 Spacing',
      `${VISION_SLOT} Only the exact maker color token is source-qualified; no spacing token is inferred.`,
      '',
      '### 1.4 Radius',
      `${VISION_SLOT} Only the exact maker color token is source-qualified; no radius token is inferred.`,
      '',
      '### 1.5 Elevation',
      `${VISION_SLOT} Only the exact maker color token is source-qualified; no elevation token is inferred.`,
      '',
      '### 1.6 Motion',
      `${VISION_SLOT} Only the exact maker color token is source-qualified; no motion token is inferred.`,
    ].join('\n');
  }

  if (!styles || availability !== 'dom-authored') {
    const note = !styles
      ? 'no styles.json collected for this capture; tokens must come from vision or a re-capture.'
      : (styles.authoredRegion && styles.authoredRegion.verdict === 'likely-platform-chrome'
        ? 'styles.json is likely-platform-chrome; tokens must come from vision.'
        : 'styles.json has no resolved exact maker accent; tokens must come from vision.');
    return [
      `> **Token source withheld:** ${note}`,
      STYLES_SENTINEL,
      '',
      '### 1.1 Color',
      `${VISION_SLOT} ${note}`,
      '',
      '### 1.2 Type',
      `${VISION_SLOT} ${note}`,
      '',
      '### 1.3 Spacing',
      `${VISION_SLOT} ${note}`,
      '',
      '### 1.4 Radius',
      `${VISION_SLOT} ${note}`,
      '',
      '### 1.5 Elevation',
      `${VISION_SLOT} ${note}`,
      '',
      '### 1.6 Motion',
      `${VISION_SLOT} ${note}`,
    ].join('\n');
  }

  const color = styles.color || {};
  const type = styles.type || {};
  const motion = styles.motion || {};
  return [
    '### 1.1 Color — computed roles and full measured inventory [styles]',
    'Area-share role labels are mechanical ranks only; they do not assert a visual usage beyond the measured DOM values.',
    '',
    colorRoles(color.backgrounds),
    '',
    '**Computed backgrounds:**',
    colorTable(color.backgrounds),
    '',
    '**Computed text colors:**',
    colorTable(color.text),
    '',
    '**Named computed color variables:**',
    cssVariableList(styles, /^--color-/u),
    '',
    '### 1.2 Type — display, body, mono computed samples [styles]',
    typeLine('Display', type.display),
    typeLine('Body', type.body),
    typeLine('Mono', type.mono),
    '',
    '**Document font inventory:**',
    measuredList((type.documentFonts || []).map((font) => ({ value: `${font.family} ${font.weight}` })), 'document font'),
    '',
    '### 1.3 Spacing — all computed measurements [styles]',
    measuredList(styles.spacing, 'spacing'),
    '',
    '**Related computed layout variables:**',
    cssVariableList(styles, /^(?:--(?:page|homepage|header|grid|prose)-|--space)/u),
    '',
    '### 1.4 Radius — all computed measurements [styles]',
    measuredList(styles.radius, 'radius'),
    '',
    '**Named radius variables:**',
    cssVariableList(styles, /^(?:--radius|--rounded)/u),
    '',
    '### 1.5 Elevation — all computed measurements [styles]',
    measuredList(styles.elevation, 'elevation'),
    '',
    '**Named shadow and border variables:**',
    cssVariableList(styles, /^(?:--shadow|--border)/u),
    '',
    '### 1.6 Motion — all computed measurements [styles]',
    '**Transitions:**',
    measuredList(motion.transitions, 'transition'),
    '',
    '**Animations:**',
    measuredList(motion.animations, 'animation'),
    '',
    `**prefersReducedMotion:** ${inline(motion.prefersReducedMotion)}`,
    '',
    '**Named speed and easing variables:**',
    cssVariableList(styles, /^(?:--speed|--ease)/u),
  ].join('\n');
}

function tokenAvailability(styles) {
  const verdict = styles && styles.authoredRegion && styles.authoredRegion.verdict;
  if (verdict === 'dom-authored') return 'dom-authored';
  if (verdict === 'likely-platform-chrome' && makerAccentEnvelope(styles)) return 'maker-accent';
  return 'unsafe';
}

function supportingTokenValues(styles, availability) {
  if (availability === 'maker-accent') {
    return `**Supporting token values (unassigned until vision):** ${inline(makerAccentEnvelope(styles).value)} [styles]. This exact maker accent is available, but G2.4 decides whether it supports a signature.`;
  }
  if (availability !== 'dom-authored') return `**Supporting token values:** ${VISION_SLOT} Token source is unavailable; G2.4 must not bind a token to an unseen signature.`;
  const display = styles.type && styles.type.display;
  const topBackground = styles.color && styles.color.backgrounds && styles.color.backgrounds[0];
  const values = [
    display && display.resolvedFamily,
    display && display.fontWeight,
    display && display.fontSize,
    display && display.letterSpacing,
    topBackground && topBackground.value,
  ].filter((value) => value !== undefined && value !== null).map(inline);
  return `**Supporting token values (unassigned until vision):** ${values.join(' · ')} [styles]. Exact §1 values are available, but G2.4 decides whether any support a signature.`;
}

function buildOrder(availability) {
  const literal = availability === 'dom-authored'
    ? 'Register and reuse the literal §1 values without rounding or replacement. [styles]'
    : availability === 'maker-accent'
      ? 'Register and reuse the exact maker accent in §1 without rounding or replacement; do not import platform chrome colors. [styles]'
    : `${VISION_SLOT} Token source is unavailable.`;
  return [
    `1. **Scaffold + tokens.** ${literal}`,
    `2. **Component sequence.** ${VISION_SLOT}`,
    `3. **Responsive + a11y.** ${VISION_SLOT}`,
  ].join('\n');
}

function antiSlop(availability) {
  const integrity = availability === 'dom-authored'
    ? 'Reuse the exact literal token values in §1; do not round or substitute them. [styles]'
    : availability === 'maker-accent'
      ? 'Reuse only the exact maker accent envelope in §1; do not round, substitute, or import platform chrome colors. [styles]'
    : `${VISION_SLOT} No exact literal token value is available without a qualifying styles.json.`;
  return [
    `- **Forbidden substitutions:** ${VISION_SLOT}`,
    `- **Token integrity:** ${integrity}`,
    `- **Motion restraint:** ${VISION_SLOT}`,
  ].join('\n');
}

function deriveRecipeFromCapture(captureDir) {
  const absoluteDir = path.resolve(captureDir);
  let stat;
  try {
    stat = fs.statSync(absoluteDir);
  } catch (error) {
    throw new Error(`capture directory does not exist: ${absoluteDir}`);
  }
  if (!stat.isDirectory()) throw new Error(`capture path is not a directory: ${absoluteDir}`);

  const bodytext = readText(path.join(absoluteDir, 'bodytext.txt'), true);
  const data = requiredObject(readJson(path.join(absoluteDir, 'data.json'), true), 'data.json');
  const capture = readJson(path.join(absoluteDir, 'capture.json'), false);
  if (capture !== null) requiredObject(capture, 'capture.json');
  const styles = readJson(path.join(absoluteDir, 'styles.json'), false);
  if (styles !== null) requiredObject(styles, 'styles.json');

  const body = deriveBodyContent(bodytext, data);
  const availability = tokenAvailability(styles);
  const tokensAvailable = availability === 'dom-authored' || availability === 'maker-accent';
  const tokenFieldsFilled = availability === 'dom-authored' ? TOKEN_FIELDS : (availability === 'maker-accent' ? 1 : 0);
  const captureName = path.basename(absoluteDir);
  const sourceMetrics = [
    `data.json pageHeight ${data.pageHeight === undefined ? 'unavailable' : inline(data.pageHeight)}`,
    `data.json bodyTextLen ${data.bodyTextLen === undefined ? 'unavailable' : inline(data.bodyTextLen)}`,
  ];
  if (capture) sourceMetrics.push('capture.json present');
  else sourceMetrics.push('capture.json absent (optional; data.json metrics used)');

  const markdown = [
    `# Build-Recipe Skeleton — ${captureName}`,
    '',
    '> Mechanical derivation only: `[body]` is verbatim copy from bodytext.txt; `[styles]` is emitted only for DOM-authored captures or a separated exact maker-accent envelope. Every visual or compositional decision remains an explicit G2.4 slot.',
    '',
    `Source metrics: ${sourceMetrics.join('; ')}.`,
    '',
    '## 1 · TOKEN BLOCK',
    '',
    tokenBlock(styles, availability),
    '',
    '## 2 · LAYOUT CONCEPT + STRUCTURE',
    '',
    TILE_SENTINEL,
    '',
    `**Concept (one sentence):** ${VISION_SLOT}`,
    '',
    `**Section arc:** ${VISION_SLOT}`,
    '',
    `**Grid:** ${VISION_SLOT}`,
    '',
    `**Alignment and splits:** ${VISION_SLOT}`,
    '',
    `**Render decomposition:** ${VISION_SLOT}`,
    '',
    '```text',
    'EMPTY — render decomposition awaits vision (G2.4); no regions are guessed.',
    '```',
    '',
    '## 3 · THE SIGNATURE',
    '',
    `1. **Name:** ${VISION_SLOT}`,
    `   **Visual decomposition:** ${VISION_SLOT}`,
    `   **Execution constraint:** ${VISION_SLOT}`,
    `   ${supportingTokenValues(styles, availability)}`,
    `   ${TILE_SENTINEL}`,
    '',
    '## 4 · THE CONTENT [body]',
    '',
    verbatim('Nav', body.content.navigation),
    '',
    verbatim('Hero H1', body.content.hero),
    '',
    verbatim('Subhead', body.content.hero.slice(-1)),
    '',
    verbatim('Product render (hero) — bodytext segment', body.content.product),
    '',
    '**Logo strip:** _EMPTY — bodytext.txt has no deterministic brand/wordmark field; do not infer logos from tiles in this mechanical pass._',
    '',
    verbatim('Two-tone statement', body.content.statement),
    '',
    verbatim('Three-up features', body.content.features).replace('**Three-up features:**', '**Three-up features** (verbatim):'),
    '',
    verbatim('First chapter', body.content.chapter),
    '',
    '**Verbatim bodytext.txt transcript (preserved without semantic rewording):**',
    '',
    `${fenceFor(bodytext)}text`,
    bodytext.replace(/\r\n?/gu, '\n').replace(/\n$/u, ''),
    fenceFor(bodytext),
    '',
    '## 5 · BUILD ORDER',
    '',
    buildOrder(availability),
    '',
    '## 6 · ANTI-SLOP GUARDRAILS',
    '',
    antiSlop(availability),
    '',
    '*G2.4 handoff: every `[tile — TODO vision (G2.4)]` slot is intentionally empty; the compatibility sentinels are not evidence claims.*',
    '',
  ].join('\n');

  return {
    markdown,
    stats: {
      layerA: { filled: body.filled, total: BODY_FIELDS },
      layerB: { filled: tokenFieldsFilled, total: TOKEN_FIELDS },
      tokenSource: styles
        ? (availability === 'dom-authored'
          ? 'dom-authored'
          : (availability === 'maker-accent' ? 'maker-authored-region' : 'likely-platform-chrome-or-unsafe'))
        : 'no-styles-json',
      captureJsonPresent: Boolean(capture),
    },
  };
}

function usage() {
  return 'Usage: node scripts/derive-recipe.js <captureDir> [--out <path>] [--force]';
}

function parseArgs(argv) {
  if (!argv.length) throw new Error(usage());
  const captureDir = argv[0];
  let out = null;
  let force = false;
  for (let index = 1; index < argv.length; index += 1) {
    if (argv[index] === '--force' && !force) {
      force = true;
      continue;
    }
    if (argv[index] !== '--out' || !argv[index + 1] || out !== null) throw new Error(usage());
    out = argv[index + 1];
    index += 1;
  }
  return { captureDir, out, force };
}

function runCli() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = deriveRecipeFromCapture(args.captureDir);
    const sourceDir = path.resolve(args.captureDir);
    const out = path.resolve(args.out || path.join(sourceDir, `${path.basename(sourceDir)}.recipe.md`));
    if (fs.existsSync(out) && !args.force) throw new Error(OVERWRITE_MESSAGE(out));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, result.markdown, 'utf8');
    console.log(`PASS derive-recipe ${sourceDir} -> ${out}`);
    console.log(`AUTO-FILLED layer-a: ${result.stats.layerA.filled}/${result.stats.layerA.total}; layer-b: ${result.stats.layerB.filled}/${result.stats.layerB.total} (${result.stats.tokenSource}).`);
  } catch (error) {
    console.error(`FAIL derive-recipe: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) runCli();

module.exports = {
  BODY_FIELDS,
  MISS_MESSAGE,
  OVERWRITE_MESSAGE,
  TOKEN_FIELDS,
  VISION_SLOT,
  deriveRecipeFromCapture,
  parseArgs,
};
