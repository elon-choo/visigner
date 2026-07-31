#!/usr/bin/env node
'use strict';

/*
 * G4.2 deterministic assembly boundary
 *
 * Input is a completed selection.json. This file imports no model client, makes
 * no network request, and reads neither clock nor random state. Rendering is a
 * pure function of selection.json plus immutable catalog templates, so replaying
 * one selection produces byte-identical HTML.
 */

const fs = require('fs');
const path = require('path');

// The tree this script belongs to is the one it sits in — not a directory that happens to be
// called v3 two levels up. Deriving it from __dirname is what lets the whole machinery be
// copied into the shipped plugin and still run.
const V3_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(V3_ROOT, '..');
const MODULES_ROOT = path.join(V3_ROOT, 'modules');
const COMPOSER_ROOT = path.join(V3_ROOT, 'composer');
// G5.3: the motion repertoire and the self-hosted face set are both immutable inputs, so
// inlining them keeps assembly a pure function of selection.json plus files on disk.
const MOTIONS_ROOT = path.join(V3_ROOT, 'motions');
const FONT_SOURCE_FILE = path.join(V3_ROOT, 'site-build', 'fonts', 'fonts.css');
// G5.1 carry-forward: the module layer (v3/site-build/tokens-module.css) is the canonical theme
// plus the measure layer.  Drift against theme.generated.css is 0 across 84 tokens
// (v3/site-build/drift-report.md), and it is the only sheet that declares --prose-max-width, which
// three hero templates reference.  Linking the old sheet renders hero copy at max-inline-size:none.
const TOKEN_SOURCE_FILE = path.join(V3_ROOT, 'site-build', 'tokens-module.css');
const VARIANT_AXES = ['layoutArchetype', 'density', 'backgroundBleed', 'motion', 'artDirection'];
const VARIANT_ENUMS = {
  layoutArchetype: new Set(['centered', 'split', 'stack', 'grid', 'rail', 'timeline', 'comparison-table', 'media-led']),
  density: new Set(['airy', 'standard', 'compact']),
  backgroundBleed: new Set(['surface-contained', 'surface-bleed', 'card-contained', 'contrast-bleed', 'media-bleed']),
  motion: new Set(['none', 'reveal', 'stagger', 'scroll-linked']),
  artDirection: new Set(['typographic', 'editorial', 'product-ui', 'documentary', 'data-led', 'photographic'])
};

// The disclosure summary is chrome, not copy: it names the apparatus and states no figure, so
// it can never become an uncited claim on a page whose whole promise is about cited figures.
// Chrome that quotes copy inherits the copy's obligations, so this label states no figure either
// — not even "22 footnotes", which would itself need a footnote.
//
// G5.4h: the label used to end in " · <module.name>", which put the catalog's INTERNAL module
// slug (framed-stack-hero, proof-railway-matrix, …) on the reader's screen ten times over. A
// visitor has no use for the name of the template a section was cut from. The slug was there to
// solve a real problem — ten identical accessible names in a row tell a screen-reader user
// nothing — so it is replaced rather than deleted: a section may name its own band in the
// manifest, which is authored copy about the evidence, not a build identifier. Sections that
// name nothing fall back to the constant.
//
// Collecting every band into one block at the end of the document was measured and rejected:
// the footnote bands are the only headingless <section> elements on the page, so folding seven
// of them into one took anti-ai-eval's structural monotony from 0.45 to 0.72 (verdict suspect,
// two-tier exit 1). Evidence next to the claim it supports is also what makes a dangling chip
// visible to a reader. Both runs: docs/goals/evidence/v3/G5.4h/impl/gate/monotony-tradeoff.log.
const LEDGER_DISCLOSURE_LABEL = { ko: '이 섹션 수치의 출처 파일과 재현 명령', en: 'Source files and reproduce commands for this section' };

function ledgerDisclosureLabel(entry) {
  const declared = entry.ledger && entry.ledger.disclosureLabel;
  if (declared == null) return LEDGER_DISCLOSURE_LABEL;
  if (isBilingual(declared)) return { ko: declared.ko.trim(), en: declared.en.trim() };
  if (typeof declared !== 'string' || declared.trim() === '') {
    fail('ledger.disclosureLabel must be a non-empty string when present');
  }
  return declared.trim();
}

function fail(message) {
  throw new Error(`composer-assemble: ${message}`);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function displayPath(filePath) {
  const relative = path.relative(process.cwd(), filePath);
  return relative && !relative.startsWith('..') ? toPosix(relative) : toPosix(filePath);
}

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function assertRunArtifact(filePath, label) {
  if (!isWithin(COMPOSER_ROOT, filePath)) fail(`${label} must stay inside the composer run directory`);
  const relative = path.relative(COMPOSER_ROOT, filePath);
  if (relative.split(path.sep).length !== 2) fail(`${label} must be a direct artifact of <composer>/<run>`);
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`cannot read ${label}: ${displayPath(filePath)} (${error.message})`);
  }
}

function readText(filePath, label) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    fail(`cannot read ${label}: ${displayPath(filePath)} (${error.message})`);
  }
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function dataValue(value) {
  return escapeHtml(String(value == null ? '' : value));
}

function assertVariants(variants, label) {
  if (!isPlainObject(variants)) fail(`${label} must be an object with five variation axes`);
  for (const axis of VARIANT_AXES) {
    if (!VARIANT_ENUMS[axis].has(variants[axis])) {
      fail(`${label}.${axis} must use the SECTION-SCHEMA enum`);
    }
  }
  for (const axis of Object.keys(variants)) {
    if (!Object.prototype.hasOwnProperty.call(VARIANT_ENUMS, axis)) {
      fail(`${label}.${axis} is not a SECTION-SCHEMA variation axis`);
    }
  }
  return Object.fromEntries(VARIANT_AXES.map((axis) => [axis, variants[axis]]));
}

function normalizeCore(core) {
  if (!isPlainObject(core)) fail('selection.core must be an object');
  if (typeof core.tokenSet !== 'string' || core.tokenSet.trim() === '') fail('selection.core.tokenSet must be non-empty');
  if (!isPlainObject(core.typographyVoices)) fail('selection.core.typographyVoices must be an object');
  for (const voice of ['display', 'body', 'latin']) {
    if (typeof core.typographyVoices[voice] !== 'string' || core.typographyVoices[voice].trim() === '') {
      fail(`selection.core.typographyVoices.${voice} must be non-empty`);
    }
  }
  if (typeof core.signatureMotif !== 'string' || core.signatureMotif.trim() === '') {
    fail('selection.core.signatureMotif must be non-empty');
  }
  return core;
}

/*
 * G5.3 governed motion
 *
 * A section may name one entry of the v3/motions repertoire. The reference is checked, not
 * trusted: the repertoire entry's own motionVariant has to equal the section's motion axis,
 * its sectionTypeHints have to cover the section's catalog type, and the page-wide count of
 * motion-bearing sections stays under the composition grammar's ceil(sections/3) ceiling.
 * A section whose motion axis is `none` may not carry a reference at all.
 */
function normalizeMotionReference(value, label) {
  if (value == null) return null;
  if (!isPlainObject(value)) fail(`${label}.motion must be an object with id and target`);
  if (typeof value.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(value.id)) {
    fail(`${label}.motion.id must be a v3/motions repertoire directory name`);
  }
  if (typeof value.target !== 'string' || !/^(root|slot:[A-Za-z][A-Za-z0-9]*)$/.test(value.target)) {
    fail(`${label}.motion.target must be "root" or "slot:<declaredSlot>"`);
  }
  for (const key of Object.keys(value)) {
    if (key !== 'id' && key !== 'target') fail(`${label}.motion.${key} is not part of a motion reference`);
  }
  return { id: value.id, target: value.target };
}

function loadMotion(reference, entry, module, label) {
  const directory = path.join(MOTIONS_ROOT, reference.id);
  const metaFile = path.join(directory, 'motion.json');
  if (!isWithin(MOTIONS_ROOT, metaFile)) fail(`${label}.motion.id is outside the repertoire: ${reference.id}`);
  const meta = readJson(metaFile, 'motion metadata');
  if (!isPlainObject(meta) || meta.name !== reference.id) {
    fail(`${label}.motion.id does not match the repertoire entry: ${displayPath(metaFile)}`);
  }
  if (meta.motionVariant !== entry.variants.motion) {
    fail(`${label}.motion ${reference.id} is a ${meta.motionVariant} motion but the section declares motion=${entry.variants.motion}`);
  }
  const hints = Array.isArray(meta.sectionTypeHints) ? meta.sectionTypeHints : [];
  if (!hints.includes(module.type)) {
    fail(`${label}.motion ${reference.id} is not governed for ${module.type} sections (hints: ${hints.join(', ') || 'none'})`);
  }
  return {
    id: reference.id,
    target: reference.target,
    css: readText(path.join(directory, 'motion.css'), 'motion stylesheet').trim()
  };
}

function applyMotionMarker(html, motion, module, label) {
  if (!motion) return html;
  if (motion.target === 'root') {
    const scanner = openTagScanner();
    const match = scanner.exec(html);
    if (!match || match.index !== 0) fail(`${label}.motion targets the module root, but ${module.name} has no root element`);
    return setAttribute(match[0], 'data-motion', motion.id) + html.slice(match[0].length);
  }
  const slotName = motion.target.slice('slot:'.length);
  const target = findSlotElement(html, 'data-slot', slotName);
  if (!target) fail(`${label}.motion targets slot ${slotName}, which ${module.name} does not mark`);
  return html.slice(0, target.start) +
    setAttribute(target.openTag, 'data-motion', motion.id) +
    html.slice(target.start + target.openTag.length);
}

/*
 * G5.4d persistent action bar
 *
 * A page whose only install affordance sat in the fold gave a reader who scrolled past it no
 * way back and no way to take the command with them: the measured page carried zero sticky or
 * fixed elements and zero copy controls (docs/goals/evidence/v3/G5.4d/critic/affordance-before.json).
 * The bar is declared in the manifest like everything else on this page — the composer owns the
 * markup, the selection owns the strings — so it stays a pure function of selection.json.
 */
function normalizeActionBar(value) {
  if (value == null) return null;
  if (!isPlainObject(value)) fail('brief.page.affordances.actionBar must be an object');
  const commands = Array.isArray(value.commands) ? value.commands : [];
  if (commands.length === 0) fail('brief.page.affordances.actionBar.commands must be a non-empty array');
  for (const command of commands) {
    if (typeof command !== 'string' || command.trim() === '') {
      fail('brief.page.affordances.actionBar.commands must be non-empty strings');
    }
  }
  const strings = {};
  // ctaHref is an address, so it stays one string; every label the bar renders may be a pair.
  for (const key of ['label', 'copyLabel', 'copiedLabel', 'ctaLabel']) {
    strings[key] = normalizeBarText(value[key], key);
    if (strings[key] == null) fail(`brief.page.affordances.actionBar.${key} must be a non-empty string or a {ko,en} pair`);
  }
  if (typeof value.ctaHref !== 'string' || value.ctaHref.trim() === '') {
    fail('brief.page.affordances.actionBar.ctaHref must be a non-empty string');
  }
  strings.ctaHref = value.ctaHref;
  /*
   * G5.4i: in-page section navigation, restored.
   *
   * docs/index.html carries four in-page anchors in its header; the composed candidate carried
   * one (the hero's own call to action) and had no way for a reader to reach the ledger or the
   * refusal table without scrolling the whole page. The bar already owns the sticky offset the
   * anchor runtime writes onto jump targets, so this is where the anchors belong.
   */
  const sections = normalizeBarSections(value.sections);
  const skipLink = normalizeBarText(value.skipLink, 'skipLink');
  const langToggle = normalizeBarText(value.langToggle, 'langToggle');
  const navLabel = normalizeBarText(value.navLabel, 'navLabel');
  const optional = { sections, skipLink, langToggle, navLabel };
  for (const key of Object.keys(value)) {
    if (key === 'commands') continue;
    if (Object.prototype.hasOwnProperty.call(strings, key)) continue;
    if (Object.prototype.hasOwnProperty.call(optional, key)) continue;
    fail(`brief.page.affordances.actionBar.${key} is not part of an action bar`);
  }
  return { commands: commands.map((command) => command.trim()), ...strings, ...optional };
}

function normalizeBarText(value, key) {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (isBilingual(value)) return { ko: value.ko.trim(), en: value.en.trim() };
  fail(`brief.page.affordances.actionBar.${key} must be a non-empty string or a {ko,en} pair`);
}

function normalizeBarSections(value) {
  if (value == null) return null;
  if (!Array.isArray(value) || value.length === 0) {
    fail('brief.page.affordances.actionBar.sections must be a non-empty array');
  }
  return value.map((item, index) => {
    if (!isPlainObject(item)) fail(`actionBar.sections[${index}] must be an object`);
    if (typeof item.href !== 'string' || !item.href.startsWith('#')) {
      fail(`actionBar.sections[${index}].href must be an in-page anchor starting with #`);
    }
    return { href: item.href, label: normalizeBarText(item.label, `sections[${index}].label`) };
  });
}

function renderActionBar(bar) {
  if (!bar) return '';
  const commands = bar.commands.map((command, index) => {
    const id = `page-actionbar-command-${index + 1}`;
    return [
      '      <li class="page-actionbar__command">',
      `        <code class="page-actionbar__code" id="${id}">${escapeHtml(command)}</code>`,
      `        ${copyButton('page-actionbar__copy', id, command, bar)}`,
      '      </li>'
    ].join('\n');
  }).join('\n');
  const nav = bar.sections
    ? [
      `    <nav class="page-actionbar__nav" aria-label="${dataValue(plainOf(bar.navLabel) || 'Sections')}">`,
      '      <ul class="page-actionbar__navlist">',
      ...bar.sections.map((section) => `        <li><a class="page-actionbar__navlink" href="${escapeHtml(section.href)}">${stringPart(section.label)}</a></li>`),
      '      </ul>',
      '    </nav>'
    ].join('\n')
    : null;
  const lang = bar.langToggle
    ? `    <button class="page-actionbar__lang" type="button" data-lang-toggle`
      + ` aria-label="${dataValue(`${plainOf(bar.langToggle)} / Switch language`)}">${stringPart(bar.langToggle)}</button>`
    : null;
  return [
    // A banner landmark, not a bare div: an independent axe run flagged the bar's own content
    // as living outside every landmark (docs/goals/evidence/v3/G5.4d/a11y/axe-region-before.json).
    '  <header class="page-actionbar" data-page-actionbar>',
    `    <p class="page-actionbar__label">${stringPart(bar.label)}</p>`,
    ...(nav ? [nav] : []),
    '    <ul class="page-actionbar__commands">',
    commands,
    '    </ul>',
    ...(lang ? [lang] : []),
    `    <a class="page-actionbar__cta" href="${escapeHtml(bar.ctaHref)}">${stringPart(bar.ctaLabel)}</a>`,
    '    <p class="page-actionbar__status" id="page-actionbar-status" role="status" aria-live="polite"></p>',
    '  </header>'
  ].join('\n');
}

function plainOf(value) {
  if (value == null) return null;
  return isBilingual(value) ? value.ko : String(value);
}

function langOf(value, lang) {
  return isBilingual(value) ? value[lang] : String(value);
}

/*
 * G5.4i: the copy control's own label is copy, so it is translated too.
 *
 * docs/index.html translates it (<span class="ko">복사</span><span class="en">copy</span>), and a
 * button that stays Korean on an English page is the same regression this round is undoing. The
 * rendered label is a pair of spans so it is right with scripting off; the per-language strings
 * also ride on data attributes, because the copy runtime has to REPLACE the label with a single
 * string while the confirmation is showing, and it needs to know which language to write.
 */
function copyButton(className, sourceId, command, bar) {
  const attr = (state, lang) => ` data-copy-${state}-${lang}="${dataValue(langOf(state === 'idle' ? bar.copyLabel : bar.copiedLabel, lang))}"`;
  return `<button class="${className}" type="button" data-copy-source="${sourceId}"`
    + attr('idle', 'ko') + attr('idle', 'en') + attr('done', 'ko') + attr('done', 'en')
    + ` data-copy-subject="${dataValue(command)}"`
    + ` aria-label="${dataValue(`${plainOf(bar.copyLabel)}: ${command}`)}">${stringPart(bar.copyLabel)}</button>`;
}

function normalizeSelection(selection) {
  if (!isPlainObject(selection)) fail('selection must be a JSON object');
  if (selection.selectionVersion !== '1.0.0') fail('selectionVersion must be 1.0.0');
  if (selection.compositionVersion !== '1.0.0') fail('compositionVersion must be 1.0.0');
  if (!Array.isArray(selection.sections) || selection.sections.length === 0) {
    fail('selection.sections must be a non-empty ordered array');
  }
  const page = isPlainObject(selection.brief) && isPlainObject(selection.brief.page) ? selection.brief.page : {};
  const title = typeof page.title === 'string' && page.title.trim() ? page.title.trim() : 'Neutral catalog assembly';
  const language = typeof page.language === 'string' && page.language.trim() ? page.language.trim() : 'en';
  const affordances = isPlainObject(page.affordances) ? page.affordances : null;
  return {
    core: normalizeCore(selection.core),
    page: { title, language, actionBar: normalizeActionBar(affordances ? affordances.actionBar : null) },
    sections: selection.sections.map((section, index) => {
      if (!isPlainObject(section)) fail(`selection.sections[${index}] must be an object`);
      if (typeof section.module !== 'string' || section.module.trim() === '') {
        fail(`selection.sections[${index}].module must be a non-empty catalog path`);
      }
      if (typeof section.moduleId !== 'string' || section.moduleId.trim() === '') {
        fail(`selection.sections[${index}].moduleId must be a catalog module name`);
      }
      if (typeof section.type !== 'string' || section.type.trim() === '') {
        fail(`selection.sections[${index}].type must be a catalog type`);
      }
      return {
        module: section.module,
        moduleId: section.moduleId,
        type: section.type,
        variants: assertVariants(section.variants, `selection.sections[${index}].variants`),
        motion: normalizeMotionReference(section.motion, `selection.sections[${index}]`),
        content: isPlainObject(section.content) ? section.content : null,
        ledger: isPlainObject(section.ledger) ? section.ledger : null
      };
    })
  };
}

/*
 * G5.2b slot injection
 *
 * The catalog templates carry `data-slot` / `data-slot-href` / `data-slot-aria-label` markers.
 * Everything below rewrites those markers from selection.json only: no clock, no network, no
 * random state, and no per-run branching, so replaying one selection still produces byte-identical
 * HTML.  Templates stay immutable on disk; nothing here writes back into v3/modules.
 */

// Fresh instance per call: these scanners recurse, so a shared /g regex would share lastIndex.
function openTagScanner() {
  return /<([a-z][\w:-]*)\b([^>]*?)(\/?)>/gi;
}

function attributeValue(openTag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = openTag.match(new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return match ? (match[1] != null ? match[1] : match[2]) : null;
}

function setAttribute(openTag, name, value) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(`(\\s${escaped}\\s*=\\s*)(?:"[^"]*"|'[^']*')`, 'i');
  if (matcher.test(openTag)) return openTag.replace(matcher, `$1"${escapeHtml(value)}"`);
  return openTag.replace(/\s*(\/?)>$/, ` ${name}="${escapeHtml(value)}"$1>`);
}

function removeAttribute(openTag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return openTag.replace(new RegExp(`\\s${escaped}\\s*=\\s*(?:"[^"]*"|'[^']*')`, 'i'), '');
}

// Depth-counted match for `tag`, starting at the opening tag that begins at `openStart`.
function findElementRange(html, tag, openStart) {
  const opener = new RegExp(`<${tag}\\b[^>]*?(\\/?)>`, 'gi');
  const closer = new RegExp(`</${tag}\\s*>`, 'gi');
  opener.lastIndex = openStart;
  const first = opener.exec(html);
  if (!first || first.index !== openStart) return null;
  const innerStart = opener.lastIndex;
  if (first[1] === '/') return { openTag: first[0], innerStart, innerEnd: innerStart, end: innerStart };
  let depth = 1;
  let cursor = innerStart;
  while (depth > 0) {
    opener.lastIndex = cursor;
    closer.lastIndex = cursor;
    const nextOpen = opener.exec(html);
    const nextClose = closer.exec(html);
    if (!nextClose) return null;
    if (nextOpen && nextOpen.index < nextClose.index) {
      if (nextOpen[1] !== '/') depth += 1;
      cursor = nextOpen.index + nextOpen[0].length;
      continue;
    }
    depth -= 1;
    cursor = nextClose.index + nextClose[0].length;
    if (depth === 0) return { openTag: first[0], innerStart, innerEnd: nextClose.index, end: cursor };
  }
  return null;
}

function findSlotElement(html, attribute, slotName) {
  const scanner = openTagScanner();
  let match;
  while ((match = scanner.exec(html)) !== null) {
    if (attributeValue(match[0], attribute) !== slotName) continue;
    const range = findElementRange(html, match[1].toLowerCase(), match.index);
    if (!range) fail(`template slot "${slotName}" has no matching close tag`);
    return { start: match.index, tag: match[1].toLowerCase(), ...range };
  }
  return null;
}

function directChildElements(inner) {
  const children = [];
  const scanner = openTagScanner();
  let match;
  while ((match = scanner.exec(inner)) !== null) {
    const tag = match[1].toLowerCase();
    const range = findElementRange(inner, tag, match.index);
    if (!range) continue;
    children.push({
      tag,
      openTag: range.openTag,
      inner: inner.slice(range.innerStart, range.innerEnd),
      full: inner.slice(match.index, range.end)
    });
    scanner.lastIndex = range.end;
  }
  return children;
}

// Text-bearing leaves of one collection-item pattern, in document order.
// aria-hidden subtrees are decoration, so they never consume a content field.
function fillableLeaves(node) {
  if (attributeValue(node.openTag, 'aria-hidden') === 'true') return [];
  const children = directChildElements(node.inner);
  if (children.length === 0) return [node];
  return children.flatMap(fillableLeaves);
}

/*
 * G5.4i: a string slot may be written in two languages.
 *
 * The page this composer replaced shipped a KO/EN toggle (docs/index.html carries 100 paired
 * .ko/.en spans); the composed candidate shipped one language, which is a capability the
 * rebuild lost rather than a simplification it chose. A bilingual slot is a two-key object,
 * so it is a leaf like any other string: it renders as two sibling spans, and the shell hides
 * the one the document is not currently set to. Both strings live in selection.json, so the
 * assembly stays a pure function of the selection and nothing is fetched or generated.
 *
 * The unselected span is display:none, i.e. genuinely unrendered, which is what keeps the
 * citation audit's scope honest: the audit reads whichever language the document declares.
 */
function isBilingual(value) {
  return isPlainObject(value)
    && typeof value.ko === 'string' && typeof value.en === 'string'
    && Object.keys(value).length === 2;
}

function bilingualHtml(value) {
  return `<span data-lang="ko">${escapeHtml(value.ko)}</span><span data-lang="en">${escapeHtml(value.en)}</span>`;
}

// Length limits bind on the LONGER language: a slot that fits in Korean and overruns in English
// has still overrun.
function bilingualPlain(value) {
  return value.ko.length >= value.en.length ? value.ko : value.en;
}

function stringPart(value) {
  if (typeof value === 'string') return escapeHtml(value);
  if (isBilingual(value)) return bilingualHtml(value);
  return null;
}

function stringPlain(value) {
  if (typeof value === 'string') return value;
  if (isBilingual(value)) return bilingualPlain(value);
  return null;
}

/*
 * G5.4i: a media placeholder handed a file on disk is a picture again.
 *
 * G5.4d retyped a placeholder that was given LINES into a transcript, because shell commands are
 * not a picture. The converse case had no path at all: v3 declared "no asset pipeline" and the
 * assembler refused asset slots, so the one thing a visitor could not see anywhere on the page
 * was a page this composer had assembled. An image field names a file that already exists in the
 * repository; the assembler does not create, fetch or generate one, and it fails if the file is
 * missing, so a tile can never show something that was not shot from a real render.
 */
function isImageField(value) {
  return isPlainObject(value) && typeof value.src === 'string';
}

function renderImage(value, label, outputDir) {
  for (const key of ['src', 'alt']) {
    if (typeof value[key] !== 'string' || value[key].trim() === '') {
      fail(`${label} image field needs a non-empty ${key}`);
    }
  }
  if (!Number.isInteger(value.width) || !Number.isInteger(value.height)) {
    fail(`${label} image field needs integer width and height, so the box is reserved before the file arrives`);
  }
  const resolved = path.resolve(outputDir, value.src);
  if (!isWithin(V3_ROOT, resolved) || !fs.existsSync(resolved)) {
    fail(`${label} image src does not resolve to a file inside v3/: ${value.src}`);
  }
  const img = `<img class="shot__image" src="${escapeHtml(value.src)}" alt="${escapeHtml(value.alt)}"`
    + ` width="${value.width}" height="${value.height}" loading="lazy" decoding="async">`;
  /*
   * G5.4j: a tile the reader cannot open is not evidence.
   *
   * The four-up grid gives a tile roughly 296 CSS pixels, and the file behind it is 640 wide, so
   * the reader was looking at a 46% downscale of a whole page and had no way to get closer
   * (measured in docs/goals/evidence/v3/G5.4j/evidence/PLAN.md §4). `zoom: true` wraps the picture
   * in a link to its own file. The link's accessible name is the picture's alt text, because an
   * anchor whose only content is an image takes that image's alternative text as its name — no
   * second, monolingual aria-label is invented for a page that renders two languages. It opens in
   * the same tab: a new window is an unannounced context change, and the back button already
   * returns the reader to the row.
   */
  if (value.zoom === true) {
    return `<a class="shot__zoom" href="${escapeHtml(value.src)}">${img}</a>`;
  }
  if (value.zoom !== undefined) fail(`${label} image field zoom must be true or absent`);
  return img;
}

// An image frame is not a labelled box: role="img" plus aria-label would name the frame and
// suppress the picture's own alternative text.
function asImageFrame(openTag) {
  let tag = removeAttribute(removeAttribute(openTag, 'role'), 'aria-label');
  tag = removeAttribute(tag, 'data-slot-aria-label');
  return setAttribute(tag, 'data-shot', 'page');
}

function renderFieldInner(value, label) {
  const simple = stringPart(value);
  if (simple !== null) return simple;
  if (isPlainObject(value)) {
    if (Array.isArray(value.lines)) {
      return value.lines.map((line) => {
        const part = stringPart(line);
        return part === null ? escapeHtml(String(line)) : part;
      }).join('<br>');
    }
    const text = stringPart(value.text);
    if (text !== null) return text;
    if (typeof value.ariaLabel === 'string') return '';
  }
  fail(`${label} must be a string, {ko,en}, {text}, {lines}, {ariaLabel} or {src,alt,width,height}`);
}

function fieldPlainText(value) {
  const simple = stringPlain(value);
  if (simple !== null) return simple;
  if (isPlainObject(value)) {
    if (Array.isArray(value.lines)) {
      return value.lines.map((line) => { const p = stringPlain(line); return p === null ? String(line) : p; }).join(' ');
    }
    const text = stringPlain(value.text);
    if (text !== null) return text;
    if (typeof value.alt === 'string') return value.alt;
    if (typeof value.ariaLabel === 'string') return value.ariaLabel;
  }
  return '';
}

function applyFieldToElement(openTag, value) {
  let tag = openTag;
  if (isPlainObject(value)) {
    if (typeof value.href === 'string') tag = setAttribute(tag, 'href', value.href);
    if (typeof value.ariaLabel === 'string') tag = setAttribute(tag, 'aria-label', value.ariaLabel);
  }
  return tag;
}

function fillNodeWithField(node, value, label, outputDir) {
  if (isImageField(value)) {
    return `${asImageFrame(node.openTag)}${renderImage(value, label, outputDir)}</${node.tag}>`;
  }
  return `${applyFieldToElement(node.openTag, value)}${renderFieldInner(value, label)}</${node.tag}>`;
}

function fillPattern(pattern, fields, label, outputDir) {
  const leaves = fillableLeaves(pattern);
  if (leaves.length !== fields.length) {
    fail(`${label} supplies ${fields.length} field(s) but the module pattern has ${leaves.length} fillable leaf/leaves`);
  }
  let out = '';
  let cursor = 0;
  const source = pattern.full;
  // Leaves are located inside the pattern's own markup, so splice them back in order.
  for (let index = 0; index < leaves.length; index += 1) {
    const leaf = leaves[index];
    const at = source.indexOf(leaf.full, cursor);
    if (at === -1) fail(`${label} could not locate leaf ${index + 1} inside the module pattern`);
    out += source.slice(cursor, at) + fillNodeWithField(leaf, fields[index], `${label} field ${index + 1}`, outputDir);
    cursor = at + leaf.full.length;
  }
  return out + source.slice(cursor);
}

function injectSlots(template, content, module, label, outputDir) {
  if (!content) return template;
  const slots = isPlainObject(module.slots) ? module.slots : {};
  let html = template;
  for (const [slotName, value] of Object.entries(content)) {
    const declared = slots[slotName];
    if (!declared) fail(`${label}.content.${slotName} is not a declared slot of ${module.name}`);
    if (declared.type === 'asset') fail(`${label}.content.${slotName} is an asset slot; v3 has no asset pipeline, so it cannot be injected`);

    if (declared.type === 'collection') {
      if (!Array.isArray(value) || value.length === 0) fail(`${label}.content.${slotName} must be a non-empty array`);
      const min = Number.isInteger(declared.minItems) ? declared.minItems : 0;
      const max = Number.isInteger(declared.maxItems) ? declared.maxItems : Infinity;
      if (value.length < min || value.length > max) {
        fail(`${label}.content.${slotName} has ${value.length} item(s); ${module.name} declares ${min}-${max}`);
      }
      const target = findSlotElement(html, 'data-slot', slotName);
      if (!target) fail(`${label}.content.${slotName} has no data-slot marker in ${module.name}`);
      const patterns = directChildElements(html.slice(target.innerStart, target.innerEnd));
      if (patterns.length === 0) fail(`${module.name} collection slot ${slotName} has no item pattern`);
      const rendered = value
        .map((item, index) => {
          const fields = Array.isArray(item) ? item : [item];
          const pattern = patterns[Math.min(index, patterns.length - 1)];
          return fillPattern(pattern, fields, `${label}.content.${slotName}[${index}]`, outputDir);
        })
        .join('');
      html = html.slice(0, target.innerStart) + rendered + html.slice(target.innerEnd);
      continue;
    }

    const plain = fieldPlainText(value);
    const min = Number.isInteger(declared.minChars) ? declared.minChars : 0;
    const max = Number.isInteger(declared.maxChars) ? declared.maxChars : Infinity;
    if (plain.length < min || plain.length > max) {
      fail(`${label}.content.${slotName} is ${plain.length} char(s); ${module.name} declares ${min}-${max}`);
    }
    const target = findSlotElement(html, 'data-slot', slotName);
    if (target) {
      let openTag = applyFieldToElement(target.openTag, value);
      let inner = renderFieldInner(value, `${label}.content.${slotName}`);
      if (isImageField(value)) {
        openTag = asImageFrame(target.openTag);
        inner = renderImage(value, `${label}.content.${slotName}`, outputDir);
      }
      /*
       * G5.4d: a media placeholder that was handed real lines is not an image.
       *
       * The catalog frames a missing asset as role="img" with the alt text mirrored onto
       * aria-label. When the composer fills that frame with shell commands, keeping role="img"
       * tells assistive technology the commands are a picture and gives the reader a single
       * opaque object instead of selectable lines. So a filled `{lines}` placeholder is
       * retyped as a transcript: the role and its label come off, each line becomes a line,
       * and the text is text. Templates on disk are untouched — this is an assembly decision,
       * so the same catalog module still renders as an image frame wherever it is given alt
       * text rather than content.
       */
      if (isPlainObject(value) && Array.isArray(value.lines) && attributeValue(openTag, 'role') === 'img') {
        openTag = removeAttribute(removeAttribute(openTag, 'role'), 'aria-label');
        openTag = removeAttribute(openTag, 'data-slot-aria-label');
        openTag = setAttribute(openTag, 'data-transcript', 'lines');
        inner = value.lines
          .map((line) => {
            const part = stringPart(line);
            return `<span class="transcript__line">${part === null ? escapeHtml(String(line)) : part}</span>`;
          })
          .join('');
      }
      html = html.slice(0, target.start) + openTag + inner + `</${target.tag}>` + html.slice(target.end);
    }

    // A slot may exist only as an attribute binding (framed-stack-hero binds primaryCtaHref that way).
    let boundCount = 0;
    for (const [attribute, htmlAttribute] of [['data-slot-href', 'href'], ['data-slot-aria-label', 'aria-label']]) {
      const bound = findSlotElement(html, attribute, slotName);
      if (!bound) continue;
      boundCount += 1;
      html = html.slice(0, bound.start) + setAttribute(bound.openTag, htmlAttribute, plain) + html.slice(bound.start + bound.openTag.length);
    }
    if (!target && boundCount === 0) fail(`${label}.content.${slotName} has no slot marker in ${module.name}`);
  }

  for (const [slotName, declared] of Object.entries(slots)) {
    if (declared.required !== true || declared.type === 'asset') continue;
    if (!content || !Object.prototype.hasOwnProperty.call(content, slotName)) {
      fail(`${label}.content is missing required slot ${slotName} of ${module.name}`);
    }
  }
  return html;
}

function ledgerStamp(entry, index, total) {
  const ledger = entry.ledger;
  const declared = ledger && typeof ledger.stamp === 'string' ? ledger.stamp.trim() : '';
  return declared || `STEP ${String(index + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}`;
}

// An HTML comment cannot carry `--` or `>`; the same text is also on a data attribute, which is
// the machine-readable copy, so the comment is the human-readable one and may be normalised.
function commentSafe(value) {
  return String(value).replace(/--+/g, '-').replace(/[<>]/g, ' ').trim();
}

/*
 * G5.4d: the footnote apparatus is disclosed, not deleted.
 *
 * Printed open under every section the bands took 3,844 of 9,980 desktop pixels and 4,840 of
 * 16,888 mobile pixels (docs/goals/evidence/v3/G5.4d/critic/affordance-before.json) — the
 * evidence outweighed the argument it was supporting. Wrapping each band in a disclosure keeps
 * every claim, path and command in the document and one keystroke away, while the reading
 * surface goes back to the copy. Collapsed, a band costs a measured 84 pixels.
 *
 * G5.4h: the same note may now be declared by more than one section, so a repeated id is
 * checked rather than silently deduplicated — two notes sharing a label while claiming
 * different things would make the label itself a lie, and the assembly refuses rather than
 * picking a winner. Document order within a band is first appearance, which is a pure function
 * of selection.json.
 */
function collectLedgerNotes(entries) {
  const byId = new Map();
  for (const entry of entries) {
    const ledger = entry.ledger;
    const notes = ledger && Array.isArray(ledger.notes) ? ledger.notes : [];
    for (const note of notes) {
      if (!isPlainObject(note) || typeof note.id !== 'string'
        || (typeof note.claim !== 'string' && !isBilingual(note.claim)) || typeof note.path !== 'string') {
        fail('ledger note needs id, claim and path');
      }
      const prior = byId.get(note.id);
      if (!prior) { byId.set(note.id, note); continue; }
      if (JSON.stringify(prior.claim) !== JSON.stringify(note.claim) || prior.path !== note.path
        || (prior.reproduce || '') !== (note.reproduce || '')) {
        fail(`ledger note ${note.id} is declared twice with different content`);
      }
    }
  }
  return byId;
}

function renderLedgerNotes(entry) {
  const byId = collectLedgerNotes([entry]);
  if (!byId.size) return '';
  const label = ledgerDisclosureLabel(entry);
  const labelPlain = isBilingual(label) ? label.ko : label;
  const lines = [
    `    <section class="ledger-notes" data-ledger-notes data-ledger-label="${dataValue(labelPlain)}">`,
    '      <details class="ledger-notes__disclosure">',
    `        <summary class="ledger-notes__summary">${stringPart(label)}</summary>`,
    '      <ol class="ledger-notes__list">'
  ];
  for (const note of byId.values()) {
    const parts = [
      `<span class="ledger-notes__ref">[${escapeHtml(note.id)}]</span>`,
      `<span class="ledger-notes__claim">${stringPart(note.claim) ?? escapeHtml(String(note.claim))}</span>`,
      `<span class="ledger-notes__path">${escapeHtml(note.path)}</span>`
    ];
    if (typeof note.reproduce === 'string' && note.reproduce.trim()) {
      parts.push(`<code class="ledger-notes__cmd">${escapeHtml(note.reproduce.trim())}</code>`);
    }
    lines.push(`        <li class="ledger-notes__note" data-note-id="${escapeHtml(note.id)}">${parts.join('')}</li>`);
  }
  lines.push('      </ol>');
  lines.push('      </details>');
  lines.push('    </section>');
  return lines.join('\n');
}

/*
 * G5.4h: adjacency was the only integrity check, and it was never a complete one.
 *
 * A chip in one section's copy whose note lives under a DIFFERENT section still reads as
 * footnoted while pointing at nothing nearby, and a chip whose note was deleted from the
 * manifest simply rendered as bare brackets. The check is now explicit and page-wide: every
 * [E-nn] marker rendered anywhere in the document has to resolve to a note the document also
 * prints. It is a string scan over output the assembler just produced — no clock, no
 * randomness, no second read of the disk.
 */
function assertChipsResolve(html, byId) {
  const cited = new Set(html.match(/\[E-\d+\]/g) || []);
  const dangling = [...cited].filter((chip) => !byId.has(chip.slice(1, -1)));
  if (dangling.length) fail(`footnote marker(s) with no note in the ledger block: ${dangling.sort().join(' ')}`);
}

function resolveModule(selectionFile, entry) {
  const resolved = path.resolve(path.dirname(selectionFile), entry.module);
  const moduleFile = path.basename(resolved) === 'module.json' ? resolved : path.join(resolved, 'module.json');
  if (!isWithin(MODULES_ROOT, moduleFile)) fail(`module is outside the catalog: ${entry.module}`);
  const module = readJson(moduleFile, 'module metadata');
  if (!isPlainObject(module) || module.name !== entry.moduleId || module.type !== entry.type) {
    fail(`selection does not match catalog metadata: ${displayPath(moduleFile)}`);
  }
  const templateFile = path.join(path.dirname(moduleFile), 'template.html');
  return { module, template: readText(templateFile, 'module template').trim() };
}

function moduleProvenance(module) {
  const source = module.corpusSource;
  return {
    provenance: module.provenance || (source.recordId === 'schema' ? 'schema-authored' : 'mined'),
    record: source.recordId,
    span: source.sectionSpan
  };
}

function renderSection(entry, index, selectionFile, total, usedMotions, outputDir) {
  const { module, template: rawTemplate } = resolveModule(selectionFile, entry);
  const label = `selection.sections[${index}]`;
  const injected = injectSlots(rawTemplate, entry.content, module, label, outputDir);
  const declaresMotion = entry.variants.motion !== 'none';
  if (declaresMotion && !entry.motion) {
    fail(`${label} declares motion=${entry.variants.motion} but names no repertoire entry, so nothing would move`);
  }
  if (!declaresMotion && entry.motion) {
    fail(`${label} names motion ${entry.motion.id} while its motion axis is none`);
  }
  const motion = entry.motion ? loadMotion(entry.motion, entry, module, label) : null;
  if (motion) usedMotions.set(motion.id, motion.css);
  const template = applyMotionMarker(injected, motion, module, label);
  const notes = renderLedgerNotes(entry);
  const stamp = ledgerStamp(entry, index, total);
  const source = moduleProvenance(module);
  const attributes = [
    ['data-module-id', module.name],
    ['data-module-type', module.type],
    ['data-section-index', index + 1],
    ...VARIANT_AXES.map((axis) => [`data-variant-${axis.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, entry.variants[axis]]),
    // G5.4b B6: build telemetry moves off the reading surface but stays in the document, so the
    // provenance chain is still recoverable with grep instead of being deleted.
    ['data-ledger-stamp', stamp],
    ['data-module-provenance', source.provenance],
    ['data-module-record', source.record],
    ['data-module-span', source.span]
  ].map(([name, value]) => `${name}="${dataValue(value)}"`).join(' ');
  return [
    `  <article class="composition-entry" ${attributes}>`,
    `    <!-- ledger stamp: ${commentSafe(stamp)} -->`,
    `    <!-- module provenance: id ${commentSafe(module.name)}; provenance ${commentSafe(source.provenance)}; record ${commentSafe(source.record)}; span ${commentSafe(source.span)} -->`,
    template.split('\n').map((line) => `    ${line}`).join('\n'),
    ...(notes ? [notes] : []),
    '  </article>'
  ].join('\n');
}

function stylesheetHref(outputFile) {
  return toPosix(path.relative(path.dirname(outputFile), TOKEN_SOURCE_FILE));
}

/*
 * G5.3 motion runtime
 *
 * The repertoire stylesheets park an element in its pre-entry state (opacity 0, offset
 * transform, scaled-out rule) and release it on a state attribute. That is only safe when a
 * script is there to release it, so the class is attached at runtime and the markup ships
 * with a plain `data-motion` name: with scripting off nothing is ever hidden. The reduce
 * branch is deliberately not special-cased here — every repertoire sheet neutralises itself
 * under prefers-reduced-motion, and letting the same code run in both states is what makes
 * the two-state measurement in docs/goals/evidence/v3/G5.3 a comparison rather than a claim.
 */
const MOTION_RUNTIME = `    (function () {
      var nodes = document.querySelectorAll('[data-motion]');
      if (!nodes.length) return;
      var enter = function (node) {
        node.setAttribute('data-motion-active', 'true');
        node.setAttribute('data-motion-state', 'entered');
      };
      for (var i = 0; i < nodes.length; i += 1) {
        nodes[i].classList.add('motion-' + nodes[i].getAttribute('data-motion'));
      }
      if (typeof window.IntersectionObserver !== 'function') {
        for (var j = 0; j < nodes.length; j += 1) enter(nodes[j]);
        return;
      }
      var observer = new window.IntersectionObserver(function (entries) {
        for (var k = 0; k < entries.length; k += 1) {
          if (!entries[k].isIntersecting) continue;
          enter(entries[k].target);
          observer.unobserve(entries[k].target);
        }
      }, { threshold: 0 });
      for (var m = 0; m < nodes.length; m += 1) observer.observe(nodes[m]);
    }());`;

/*
 * G5.4d copy runtime
 *
 * The commands are real text in a real <code>, so a reader with no scripting can still select
 * and copy them by hand; this only removes the selection step. The button is a native button,
 * so keyboard reach, Enter and Space come from the platform rather than from this script.
 *
 * G5.4f: the confirmation state changed the visible label to 복사됨 while aria-label stayed 복사,
 * and because aria-label supersedes contents in the accessible name computation, the rendered
 * label stopped being part of the accessible name for the 2.4 seconds the confirmation lasts —
 * WCAG SC 2.5.3 Label in Name, measured in docs/goals/evidence/v3/G5.4e/a11y/
 * label-in-name-copy-button.json. The label and the name now move together.
 */
const COPY_RUNTIME = `    (function () {
      var buttons = document.querySelectorAll('[data-copy-source]');
      if (!buttons.length) return;
      var status = document.getElementById('page-actionbar-status');
      var write = function (text) {
        if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
        var area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', 'readonly');
        document.body.appendChild(area);
        area.select();
        try { document.execCommand('copy'); } finally { document.body.removeChild(area); }
        return null;
      };
      var relabel = function (button, state) {
        var lang = document.documentElement.getAttribute('data-page-lang') || 'ko';
        var label = button.getAttribute('data-copy-' + state + '-' + lang)
          || button.getAttribute('data-copy-' + state + '-ko');
        var subject = button.getAttribute('data-copy-subject');
        button.textContent = label;
        button.setAttribute('data-copy-state', state);
        if (subject) button.setAttribute('aria-label', label + ': ' + subject);
      };
      var settle = function (button) {
        relabel(button, 'done');
        /*
         * G5.4k: the live region announced nothing, on every copy button.
         *
         * It read data-copy-done, and no element carries that attribute — the labels are
         * language-suffixed (data-copy-done-ko / -en, 6 of each on the page), so
         * getAttribute returned null and role="status" stayed empty. Reproduced with a real
         * click rather than by reading the source: the visible label became 복사됨 while
         * #page-actionbar-status.textContent stayed length 0, so a sighted reader got the
         * confirmation and a screen-reader reader got silence. Read the same suffixed label
         * relabel() just resolved, with the same ko fallback.
         */
        var lang = document.documentElement.getAttribute('data-page-lang') || 'ko';
        var done = button.getAttribute('data-copy-done-' + lang)
          || button.getAttribute('data-copy-done-ko');
        if (status && done) status.textContent = done;
        window.setTimeout(function () {
          relabel(button, 'idle');
        }, 2400);
      };
      var attach = function (button) {
        button.addEventListener('click', function () {
          var source = document.getElementById(button.getAttribute('data-copy-source'));
          if (!source) return;
          var pending = write(source.textContent);
          if (pending && typeof pending.then === 'function') {
            pending.then(function () { settle(button); }, function () { settle(button); });
            return;
          }
          settle(button);
        });
      };
      for (var i = 0; i < buttons.length; i += 1) attach(buttons[i]);
    }());`;


/*
 * G5.4f anchor runtime
 *
 * The hero's call to action jumps to a heading. With a sticky bar above the scroll port the
 * browser lands the heading under the bar: measured at 390 the destination heading occupied
 * 0–88 and the bar 0–188, so the reader arrived at a heading they could not see, and focus
 * stayed on <body> so a keyboard reader arrived nowhere at all
 * (docs/goals/evidence/v3/G5.4e/a11y/anchor-jump-overlap.json).
 *
 * The bar's measured height is written onto every jump target as scroll-margin, so the offset
 * tracks the bar through wrapping, zoom and font loading rather than being guessed once. The
 * destination is then given focus, which is what moves a keyboard and screen-reader user with
 * the page.
 */
const ANCHOR_RUNTIME = `    (function () {
      var bar = document.querySelector('[data-page-actionbar]');
      var targets = document.querySelectorAll('[id]');
      var publish = function () {
        var offset = bar ? bar.getBoundingClientRect().height : 0;
        for (var i = 0; i < targets.length; i += 1) {
          targets[i].style.scrollMarginBlockStart = offset + 'px';
        }
      };
      publish();
      if (bar && window.ResizeObserver) new window.ResizeObserver(publish).observe(bar);
      window.addEventListener('resize', publish);
      var land = function (hash) {
        if (!hash || hash.length < 2) return;
        var target = null;
        try { target = document.getElementById(decodeURIComponent(hash.slice(1))); } catch (error) { target = null; }
        if (!target) return;
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      };
      document.addEventListener('click', function (event) {
        var node = event.target;
        while (node && node !== document && !(node.tagName === 'A' && node.getAttribute('href'))) node = node.parentNode;
        if (!node || node === document) return;
        var href = node.getAttribute('href');
        if (!href || href.charAt(0) !== '#') return;
        window.setTimeout(function () { land(href); }, 0);
      });
      window.addEventListener('hashchange', function () { land(window.location.hash); });
      if (window.location.hash) window.setTimeout(function () { land(window.location.hash); }, 0);
    }());`;

/*
 * G5.4i language runtime — the same two-state toggle docs/index.html ships.
 *
 * Both languages are in the document as sibling spans, so the switch is one attribute on the
 * root and nothing is fetched. `lang` moves with `data-page-lang` because the attribute a
 * screen reader and a hyphenation engine read is `lang`, not the styling hook. The choice is
 * persisted the way the live page persists it; a storage failure (private mode, disabled
 * storage) is swallowed, because losing the preference is not worth losing the toggle.
 */
const LANG_RUNTIME = `    (function () {
      var toggle = document.querySelector('[data-lang-toggle]');
      if (!toggle) return;
      var root = document.documentElement;
      var KEY = 'visigner-lang';
      /*
       * The copy runtime REPLACES a button's label with a single string while the confirmation
       * shows, which destroys the two spans that made it bilingual. So the language switch has
       * to rewrite any button that has already been written to; a button still carrying its
       * original spans is left alone, because CSS is already doing the right thing there.
       */
      var relabelCopies = function (next) {
        var buttons = document.querySelectorAll('[data-copy-source][data-copy-state]');
        for (var i = 0; i < buttons.length; i += 1) {
          var button = buttons[i];
          var state = button.getAttribute('data-copy-state');
          var label = button.getAttribute('data-copy-' + state + '-' + next);
          if (!label) continue;
          var subject = button.getAttribute('data-copy-subject');
          button.textContent = label;
          if (subject) button.setAttribute('aria-label', label + ': ' + subject);
        }
      };
      var apply = function (next) {
        root.setAttribute('data-page-lang', next);
        root.setAttribute('lang', next);
        toggle.setAttribute('aria-pressed', next === 'en' ? 'true' : 'false');
        relabelCopies(next);
      };
      var saved = null;
      try { saved = window.localStorage.getItem(KEY); } catch (error) { saved = null; }
      apply(saved === 'en' || saved === 'ko' ? saved : root.getAttribute('data-page-lang') || 'ko');
      toggle.addEventListener('click', function () {
        var next = root.getAttribute('data-page-lang') === 'ko' ? 'en' : 'ko';
        apply(next);
        try { window.localStorage.setItem(KEY, next); } catch (error) { /* preference is optional */ }
      });
    }());`;

function renderFontStyle() {
  const css = readText(FONT_SOURCE_FILE, 'self-hosted font stylesheet').trim();
  return `  <style data-font-source="v3/site-build/fonts/fonts.css">\n${css}\n  </style>\n`;
}

function renderMotionStyle(usedMotions) {
  if (usedMotions.size === 0) return '';
  const blocks = [...usedMotions.keys()].sort().map((id) => `/* v3/motions/${id}/motion.css */\n${usedMotions.get(id)}`);
  return `  <style data-motion-source>\n${blocks.join('\n')}\n  </style>\n`;
}


/*
 * G5.4f: the install commands set in the fold carry the page's copy control.
 *
 * The action bar drops its command list below 48em so that it stops standing 188 pixels tall on
 * a phone. That is only honest if the commands stay one tap away, so the transcript lines the
 * composer already wrote into the fold — which ARE the same command strings, character for
 * character — are retyped as a code element plus the same button the bar uses. The match is
 * exact-string, so a line that merely resembles a command is left as prose.
 */
function attachTranscriptCopies(html, bar) {
  if (!bar) return html;
  let counter = 0;
  for (const command of bar.commands) {
    const needle = `<span class="transcript__line">${escapeHtml(command)}</span>`;
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(escaped, 'g'), () => {
      counter += 1;
      const id = `page-transcript-command-${counter}`;
      return '<span class="transcript__line transcript__command">'
        + `<code class="transcript__code" id="${id}">${escapeHtml(command)}</code>`
        + copyButton('transcript__copy', id, command, bar)
        + '</span>';
    });
  }
  return html;
}

/*
 * G5.4i: a disclosure that does not look like one is not a disclosure.
 *
 * G5.4d folded the footnote bands and the FAQ answers into <details>, and G5.4h's summary rule
 * (display:flex for the 48-pixel target) suppressed the UA's ::marker triangle along with it.
 * The result read as a list of headings: eleven summaries, no visible sign that anything opens.
 * A chevron is put back as real markup rather than as a ::marker, because ::marker cannot be
 * rotated and a CSS ::after cannot be given a shape that survives a forced-colors mode. It is
 * aria-hidden — the control's role and state already come from <summary> inside <details>, and
 * an accessible name that says "chevron" would only get in the way.
 */
const DISCLOSURE_MARKER = '<svg class="disclosure-chevron" aria-hidden="true" focusable="false"'
  + ' viewBox="0 0 16 16" fill="none"><path d="M5 3l6 5-6 5" stroke="currentColor"'
  + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function addDisclosureMarkers(html) {
  return html.replace(/(<summary\b[^>]*>)/g, (open) => `${open}${DISCLOSURE_MARKER}`);
}

function renderDocument(selection, rendered, outputFile, usedMotions) {
  const tokenSource = stylesheetHref(outputFile);
  const actionBar = renderActionBar(selection.page.actionBar);
  /*
   * G5.4f: a footer-band section renders a real <footer>, and a <footer> inside <main> is not a
   * contentinfo landmark — an independent axe pass and a landmark read both found the page's
   * footer scoped to main instead (docs/goals/evidence/v3/G5.4e/a11y). The composition grammar
   * already puts footer-band last, so the trailing run of them is emitted as a sibling of main,
   * which is where a page footer belongs.
   */
  let cut = rendered.length;
  while (cut > 0 && rendered[cut - 1].type === 'footer-band') cut -= 1;
  const join = (list) => list.map((entry) => entry.html).join('\n');
  const mainSections = addDisclosureMarkers(attachTranscriptCopies(join(rendered.slice(0, cut)), selection.page.actionBar));
  /*
   * Two edits make the moved band a real landmark pair. The entry wrapper stays an <article>,
   * because the page gate reads the composition entries by tag; <article> is sectioning content,
   * so the implicit contentinfo of a <footer> inside it is suppressed and has to be declared.
   * (article is a document-structure role, not a landmark, so the declared contentinfo is still
   * top level.) The band's notes are a sibling of that footer and would sit outside every
   * landmark — the same finding in a different place — so they take the disclosure label as an
   * accessible name and become their own region.
   */
  const asContentinfo = (html) => html
    .replace(/<footer class="module-/g, '<footer role="contentinfo" class="module-')
    .replace(
      /<section class="ledger-notes" data-ledger-notes data-ledger-label="([^"]*)"/g,
      (whole, label) => `<section class="ledger-notes" data-ledger-notes data-ledger-label="${label}" aria-label="${label}"`
    );
  const trailingBands = cut < rendered.length
    ? `${addDisclosureMarkers(asContentinfo(attachTranscriptCopies(join(rendered.slice(cut)), selection.page.actionBar)))}\n`
    : '';
  /*
   * G5.4i: a skip link, restored. docs/index.html ships one; the composed candidate shipped
   * none and relied on landmarks alone. It is a real 48-pixel target parked off the inline
   * start of the viewport rather than a zero-size box, so the page's own target-size audit
   * measures the same element a keyboard user lands on.
   */
  const skip = selection.page.actionBar && selection.page.actionBar.skipLink;
  const skipLink = skip
    ? `  <a class="page-skiplink" href="#page-main">${stringPart(skip)}</a>\n`
    : '';
  return `<!doctype html>
<html lang="${escapeHtml(selection.page.language)}" data-page-lang="${escapeHtml(selection.page.language)}" data-composition-version="1.0.0" data-token-set="${escapeHtml(selection.core.tokenSet)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="A deterministic catalog page assembled from the Visigner v3 module catalog.">
  <title>${escapeHtml(selection.page.title)}</title>
  <link rel="stylesheet" href="${escapeHtml(tokenSource)}" data-token-source="${escapeHtml(tokenSource)}">
  <style data-token-bridge>
    :root {
      --color-surface: var(--brand-surface);
      --color-card: var(--brand-card);
      --color-ink: var(--brand-ink);
      --color-muted: var(--brand-muted);
      --color-line: var(--brand-line);
      --color-primary-50: var(--brand-primary-50);
      --color-primary-100: var(--brand-primary-100);
      --color-primary-300: var(--brand-primary-300);
      --color-primary-500: var(--brand-primary-500);
      --color-primary-700: var(--brand-primary-700);
      --color-primary-900: var(--brand-primary-900);
      --color-primary: var(--brand-primary);
      --color-accent-300: var(--brand-accent-300);
      --color-accent-500: var(--brand-accent-500);
      --color-accent-700: var(--brand-accent-700);
      --color-accent: var(--brand-accent);
      --color-on-accent: var(--brand-on-accent);
      --font-display: var(--brand-font-display);
      --font-body: var(--brand-font-body);
      --font-latin: var(--brand-font-latin);
      --shadow-e1: var(--brand-shadow-e1);
      --shadow-e2: var(--brand-shadow-e2);
      --shadow-e3: var(--brand-shadow-e3);
    }
  </style>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html { background: var(--color-surface); }
    body { margin: 0; background: var(--color-surface); color: var(--color-ink); font-family: var(--font-body); font-size: var(--text-16); line-height: var(--leading-16); }
    a { color: inherit; }
    /* G5.4b B2: the page shipped no focus style at all, so keyboard focus fell back to the UA ring,
       which the a11y pass measured at 2.99:1 on the ink band and 2.31:1 on the accent CTA fill —
       both under the 3:1 non-text floor (docs/goals/evidence/v3/G5.4/a11y/manual-checks.js).
       No single token clears 3:1 against BOTH the near-white surfaces and the ink band, so the
       indicator is two-tone: an ink ring with a surface halo inside it.  Measured on this token
       sheet (docs/goals/evidence/v3/G5.4b/token-contrast.json):
         ink ring     vs --color-card 17.92:1 · --color-surface 17.16:1 · --color-accent-500 6.91:1
                         · --color-accent-700 4.37:1 · --color-primary-100 13.94:1
         surface halo vs --color-ink 17.16:1 · --color-primary-700 8.52:1
       Every surface the ring can land on is cleared by at least one layer, and the two layers
       separate from each other at 17.16:1, so the indicator is never lost in its own background. */
    :focus-visible { outline: var(--space-4) solid var(--color-ink); outline-offset: var(--space-4); box-shadow: 0 0 0 var(--space-8) var(--color-surface); }
    /* Korean sets by eojeol, not by syllable: without keep-all the line breaker splits words
       mid-token, which the 390 measurement counted as fragments in four headlines and two
       bodies (docs/goals/evidence/v3/G5.3/pre-fix-viewports.json).  The overflow-wrap rule
       below still lets unbreakable literals — paths, hashes, commands — break anywhere. */
    .composition-entry { display: grid; min-inline-size: 0; word-break: keep-all; }
    /* Document-level overflow is the shell's job: injected content can carry unbreakable literals
       (file paths, commands, hashes) that no catalog template anticipates.  Headings are excluded
       on purpose — breaking a display headline mid-word to satisfy a narrow container is worse than
       letting it overflow, and it is the container that would be wrong. */
    .composition-entry :where(p, span, strong, em, small, li, dd, dt, code, summary, figcaption) { overflow-wrap: anywhere; }
    /* A media placeholder that was given text becomes a transcript frame; without this it inherits
       the section's on-dark text colour onto its own light surface.  G5.4b B7 widens this from
       [role="img"][data-slot] to every role="img" placeholder, because a collection item's visual
       is filled through the item pattern and therefore never carries a data-slot marker of its
       own — which is why the eight gallery cards rendered as empty gradients. */
    .composition-entry [role="img"]:not(:empty) { display: grid; align-content: center; gap: var(--space-4); padding: var(--space-16); color: var(--color-ink); font-family: var(--font-latin); font-size: var(--text-12); line-height: var(--leading-12); text-align: start; }
    /* G5.4b B6: the assembly stamp and the module provenance line are build telemetry, not reader
       copy.  Printed above every section they put "STEP 01/10 module framed-stack-hero …" in front
       of the first sentence a visitor reads and took 36.6% of the desktop fold
       (docs/goals/evidence/v3/G5.4/critic/cand-measure.json).  They now travel as data attributes
       and HTML comments on the composition entry, so a grep for data-ledger-stamp or for
       data-module-span still recovers every value.  What a reader is owed — the footnote
       chip, its claim, its file path and its reproduce command — stays on the page, after the
       section it belongs to. */
    .ledger-notes { display: grid; gap: var(--space-4); margin: 0; padding: var(--space-12) var(--space-24); border-block-start: var(--space-4) solid var(--color-line); background: var(--color-card); color: var(--color-muted); }
    .ledger-notes__list { display: grid; gap: var(--space-4); margin: 0; padding: 0; list-style: none; }
    .ledger-notes__note { display: grid; gap: var(--space-4); min-inline-size: 0; font-size: var(--text-12); line-height: var(--leading-12); overflow-wrap: anywhere; }
    .ledger-notes__ref { color: var(--color-primary-700); font-family: var(--font-latin); }
    .ledger-notes__claim { color: var(--color-ink); font-family: var(--font-body); font-size: var(--text-14); line-height: var(--leading-14); }
    .ledger-notes__path, .ledger-notes__cmd { color: var(--color-muted); font-family: var(--font-latin); }
    .ledger-notes__disclosure { display: grid; gap: var(--space-8); }
    .ledger-notes__summary { color: var(--color-ink); font-family: var(--font-body); font-size: var(--text-14); line-height: var(--leading-14); cursor: pointer; }
    .ledger-notes__disclosure[open] > .ledger-notes__summary { margin-block-end: var(--space-4); }
    /* A filled transcript frame: lines set as lines, selectable and readable as text.  The
       assembler strips role="img" from a placeholder it has given content (see injectSlots),
       so this is the only styling that block still needs.
       G5.4h: the frame also has to own its background. Catalog media placeholders paint a
       decorative gradient chosen against an image, and feature-frame-split's ends at
       --color-ink — the same token this rule sets the text to, i.e. ink on ink. The frame is
       given the card surface instead, which this token sheet documents at 17.92:1 against ink
       (docs/goals/evidence/v3/G5.4b/token-contrast.json). Specificity 0,2,0 beats the module's
       own 0,1,0 rule, so no template is edited to get it. */
    .composition-entry [data-transcript] { display: grid; align-content: center; gap: var(--space-4); padding: var(--space-16); background: var(--color-card); color: var(--color-ink); font-family: var(--font-latin); font-size: var(--text-12); line-height: var(--leading-12); text-align: start; }
    .composition-entry [data-transcript] .transcript__line { display: block; overflow-wrap: anywhere; }
    /* G5.4d: the install command follows the reader instead of staying in the fold. */
    /* G5.4f: the bar wrapped into four rows at 390 and stood 188 pixels tall — 22% of the
       viewport, against 7% for the page it replaces (docs/goals/evidence/v3/G5.4f/a11y/
       probe-before.json).  A persistent bar that eats a fifth of a phone screen is not a
       persistent offer, it is a persistent obstruction.  It is now one row that never wraps:
       the commands shrink and give up their track first, and below 48em they hand the job to
       the fold, where the same two commands are set as selectable text with the same copy
       control (see attachTranscriptCopies). */
    .page-actionbar { position: sticky; inset-block-start: 0; z-index: 20; display: flex; flex-wrap: nowrap; gap: var(--space-8) var(--space-16); align-items: center; padding: var(--space-8) var(--space-16); border-block-end: var(--space-4) solid var(--color-line); background: var(--color-card); color: var(--color-ink); }
    .page-actionbar__label { flex: 0 0 auto; margin: 0; font-family: var(--font-display); font-size: var(--text-16); line-height: var(--leading-16); }
    .page-actionbar__commands { display: flex; flex: 1 1 auto; flex-wrap: nowrap; gap: var(--space-8) var(--space-16); min-inline-size: 0; margin: 0; padding: 0; list-style: none; }
    .page-actionbar__command { display: flex; flex: 0 1 auto; gap: var(--space-8); align-items: center; min-inline-size: 0; }
    .page-actionbar__code { min-inline-size: 0; overflow: hidden; font-family: var(--font-latin); font-size: var(--text-12); line-height: var(--leading-12); white-space: nowrap; text-overflow: ellipsis; }
    /* --space-48 is the smallest spacing token that clears the 44 pixel pointer target; the
       bar's copy button measured 40 and its call to action 36 before this rule. */
    .page-actionbar__copy { display: inline-flex; flex: 0 0 auto; align-items: center; min-block-size: var(--space-48); padding: var(--space-8) var(--space-12); border: var(--space-4) solid var(--color-ink); border-radius: var(--radius-md); background: var(--color-ink); color: var(--color-surface); font-family: var(--font-body); font-size: var(--text-12); line-height: var(--leading-12); cursor: pointer; }
    .page-actionbar__cta { display: inline-flex; flex: 0 0 auto; align-items: center; margin-inline-start: auto; min-block-size: var(--space-48); padding: var(--space-8) var(--space-16); border-radius: var(--radius-md); background: var(--color-accent); color: var(--color-on-accent); font-family: var(--font-body); font-size: var(--text-14); line-height: var(--leading-14); text-decoration: none; white-space: nowrap; }
    .page-actionbar__status { position: absolute; inline-size: var(--space-4); block-size: var(--space-4); overflow: hidden; margin: 0; clip-path: inset(50%); }
    @media (max-width: 48em) { .page-actionbar__commands { display: none; } }
    /* An in-page jump has to land the reader on the heading it names, not underneath the bar.
       The offset is the bar's measured height, written onto the jump targets by ANCHOR_RUNTIME:
       the page gate forbids declaring a custom property outside the token bridge, and a static
       spacing token would be a guess at a height that changes with wrapping, zoom and font
       loading. Until the script runs the largest spacing token stands in. */
    body [id] { scroll-margin-block-start: var(--space-96); }
    /* A jump target is focused programmatically, so it needs to be focusable without joining
       the tab order. */
    [id][tabindex="-1"]:focus { outline: none; }
    [id][tabindex="-1"]:focus-visible { outline: var(--space-4) solid var(--color-ink); outline-offset: var(--space-4); }
    /* The install commands, set as text in the fold, carry the same copy control as the bar.
       This rule has to sit after the transcript's own display:block line rule below, so it is
       written against the same ancestor to keep the cascade honest rather than winning on a
       specificity trick. */
    .composition-entry [data-transcript] .transcript__command { display: flex; gap: var(--space-8); align-items: center; min-inline-size: 0; }
    .transcript__code { min-inline-size: 0; font-family: var(--font-latin); font-size: var(--text-12); line-height: var(--leading-12); overflow-wrap: anywhere; }
    .transcript__copy { display: inline-flex; flex: 0 0 auto; align-items: center; min-block-size: var(--space-48); padding: var(--space-8) var(--space-12); border: var(--space-4) solid var(--color-ink); border-radius: var(--radius-sm); background: var(--color-ink); color: var(--color-surface); font-family: var(--font-body); font-size: var(--text-12); line-height: var(--leading-12); cursor: pointer; }
    /* Every disclosure control on the page measured 20 to 28 pixels tall. */
    .composition-entry summary, .ledger-notes__summary { display: flex; gap: var(--space-8); align-items: center; min-block-size: var(--space-48); }
    /* G5.4i: display:flex on <summary> drops the UA ::marker, so the eleven disclosures on this
       page carried no sign that they open. The chevron is the sign; the hairline and the hover
       tint make the whole row read as a control rather than as a heading with an icon beside it. */
    .composition-entry summary::-webkit-details-marker, .ledger-notes__summary::-webkit-details-marker { display: none; }
    .composition-entry summary, .ledger-notes__summary { list-style: none; }
    .composition-entry summary::marker, .ledger-notes__summary::marker { content: ''; }
    .disclosure-chevron { flex: 0 0 auto; inline-size: var(--space-16); block-size: var(--space-16); color: var(--color-muted); transition: transform var(--dur-1) var(--ease-out); }
    details[open] > summary > .disclosure-chevron { transform: rotate(90deg); }
    .composition-entry summary:hover, .ledger-notes__summary:hover { color: var(--color-primary-700); }
    .composition-entry summary:hover > .disclosure-chevron, .ledger-notes__summary:hover > .disclosure-chevron { color: var(--color-primary-700); }
    @media (prefers-reduced-motion: reduce) { .disclosure-chevron { transition: none; } }
    /* G5.4i: a real screenshot of a page this composer assembled. The frame keeps a fixed ratio
       so the row of tiles reserves its height before the files arrive, and the file's own
       width/height attributes carry the intrinsic ratio, so nothing shifts on load. */
    /* G5.4j: the frame was a 5:7 portrait with object-fit:cover over a landscape tile, so the
       reader saw the top crop of a screenshot and never its second section — the very change of
       face the tile was shot to show. The ratio now matches the file (640x600 = 16:15) and the
       picture is contained rather than cropped, so what the manifest says was rendered is what
       the page displays. It also costs less height than the portrait frame did. */
    /* G5.4k: the shot grew from 640x600 to 640x800, because a 1200-tall clip stopped exactly
       where the third band starts and could not photograph a repeated section. The frame ratio
       follows the file, as before — object-fit:contain would letterbox it otherwise. */
    .composition-entry [data-shot] { overflow: hidden; aspect-ratio: 4 / 5; border-radius: var(--radius-sm); background: var(--color-card); box-shadow: var(--shadow-e1); }
    .composition-entry [data-shot] .shot__image { display: block; inline-size: 100%; block-size: 100%; object-fit: contain; object-position: top center; }
    .composition-entry [data-shot] .shot__zoom { display: block; block-size: 100%; border-radius: inherit; }
    /* The offset must be negative. .shot__zoom fills [data-shot] exactly and that parent is
       overflow:hidden, so an outward ring is clipped to nothing — axe cannot see paint-time
       clipping, so this only shows up by looking at the rendered pixels.
       G5.4k: turning the ring inward had also dropped the surface halo the page-wide rule pairs
       it with, and the halo is the half that survives a dark backdrop. A tile is a photograph of
       a whole page, so the pixels behind the ring are whatever that page happens to be: measured
       on the four current tiles, the ink ring landed on ink-coloured content in the cafe tile at
       1.00:1 (ring rgb 21,23,29 against adjacent content rgb 21,23,29) while reading fine on the
       other three. The inset shadow puts the halo back on the inside, so the indicator is the
       same two tones as everywhere else on the page, just mirrored inward: ink over the outer
       four pixels, surface over the next four.
       The halo is a pseudo-element, not the box-shadow the page-wide rule uses, because a shadow
       cannot be seen here: .shot__image fills .shot__zoom exactly, and a child paints above its
       parent's inset shadows. Measured, twice — an inset surface shadow two spacing steps wide
       sampled 21,23,29 straight through the ring on the dark tile, i.e. the picture rather than
       the halo. (The literal value is left out of this note on purpose: the token ceiling scans
       the whole stylesheet including its comments, and a raw px value here fails the gate — which
       is the gate working.) The outline survives the
       image because outlines paint after children, and ::after does too. */
    .composition-entry [data-shot] .shot__zoom { position: relative; }
    .composition-entry [data-shot] .shot__zoom:focus-visible { outline: var(--space-4) solid var(--color-ink); outline-offset: calc(-1 * var(--space-4)); }
    .composition-entry [data-shot] .shot__zoom:focus-visible::after { position: absolute; content: ""; inset: var(--space-4); border: var(--space-4) solid var(--color-surface); border-radius: inherit; pointer-events: none; }
    /* G5.4i: the skip link docs/index.html ships and the composed page had dropped. It keeps a
       real 48-pixel target and is parked outside the inline start of the viewport, not collapsed
       to a zero-size box, so a focus landing on it is a landing on something. */
    .page-skiplink { position: absolute; z-index: 30; inset-block-start: 0; inset-inline-start: -100vw; display: inline-flex; align-items: center; min-block-size: var(--space-48); padding: var(--space-8) var(--space-16); background: var(--color-ink); color: var(--color-surface); font-family: var(--font-body); font-size: var(--text-14); line-height: var(--leading-14); text-decoration: none; }
    .page-skiplink:focus { inset-inline-start: 0; }
    /* G5.4i: in-page section navigation and the language control, both restored from the live
       page. They give up their track before the install commands do, and below 48em they hand
       the job to the sections themselves, which are one scroll apart on a phone. */
    .page-actionbar__nav { flex: 0 1 auto; min-inline-size: 0; }
    .page-actionbar__navlist { display: flex; flex-wrap: nowrap; gap: var(--space-16); margin: 0; padding: 0; list-style: none; }
    /* A two-syllable Korean nav label is a 24-pixel-wide box; --space-48 on BOTH axes is what
       makes it the 44-pixel pointer target the rest of the page already clears. */
    .page-actionbar__navlink { display: inline-flex; justify-content: center; align-items: center; min-inline-size: var(--space-48); min-block-size: var(--space-48); font-family: var(--font-body); font-size: var(--text-14); line-height: var(--leading-14); white-space: nowrap; }
    .page-actionbar__lang { display: inline-flex; flex: 0 0 auto; align-items: center; min-block-size: var(--space-48); padding: var(--space-8) var(--space-12); border: var(--space-4) solid var(--color-line); border-radius: var(--radius-md); background: var(--color-card); color: var(--color-ink); font-family: var(--font-latin); font-size: var(--text-12); line-height: var(--leading-12); cursor: pointer; }
    [data-page-lang="ko"] [data-lang="en"] { display: none; }
    [data-page-lang="en"] [data-lang="ko"] { display: none; }
    @media (max-width: 48em) { .page-actionbar__nav { display: none; } }
    /* A stacked collection turns its links into full-width rows at every width, not only under
       30em: the footer's reference links measured 20 pixels tall on the desktop viewport. */
    .composition-entry [data-slot]:where(ul, ol, dl) a { display: flex; align-items: center; min-block-size: var(--space-48); }
    /* G5.4j: the collection item is the catalog's one shape, and this page uses it four times.
       Every mined collection item is padding var(--space-24) + a hairline border + var(--radius-lg),
       so tell-count.js measured 16 cards in four groups of four identical siblings and capped the
       distinctiveness score at 7 (docs/goals/evidence/v3/G5.4i/critic/tell-count-candidate.json).
       Four sections wearing the same rounded box is the uniform-grid tell — and it is the exact
       thing this page's hero says the grammar prevents, so the page was arguing against its own
       screenshot. The grammar varies layout archetype, density, bleed, motion and art direction;
       it has no axis for the SURFACE an item sits on, which is why every module inherited one
       surface. The shell gives a surface per section type, keyed on the data-module-type the
       composer already writes: no module template is edited, so every module keeps the mined
       provenance its module.json claims. A rule, a rail, a divider and a bare row are four
       different objects, and none of them is a card. */
    /* --color-muted, not --color-line: the line token is ink at 12% alpha, which is a hairline on
       the light surface and invisible on the dark one. Three of the four sections these rules
       touch paint --color-ink, so a divider drawn in --color-line would have removed the card and
       put nothing in its place. --color-muted sits between the two surfaces and is visible on
       both. */
    .composition-entry[data-module-type="comparison"] [class$="__item"] { padding-block: var(--space-16); padding-inline: 0; border: 0; border-block-end: var(--space-4) solid var(--color-muted); border-radius: 0; }
    .composition-entry[data-module-type="proof"] [class$="__item"] { padding-block: 0; padding-inline-start: var(--space-16); padding-inline-end: 0; border: 0; border-inline-start: var(--space-4) solid var(--color-primary-300); border-radius: 0; }
    .composition-entry[data-module-type="faq"] [class$="__item"] { padding-block: var(--space-12); padding-inline: 0; border: 0; border-block-start: var(--space-4) solid var(--color-muted); border-radius: 0; }
    /* The footer keeps its background. Dropping it as well removed a card on the light page and
       broke a dark one: demo-kr-detail's footer-band paints --color-ink, its list text is set for
       the card it sat on, and without that card axe measured the group headings at 1:1 — ink on
       ink, invisible — and the links at 2.01:1. Zeroing the border, the radius and the inset is
       enough to stop it reading as a card (tell-count.js needs a shadow or a radius of 6 or more
       to count one), and it leaves the surface the text was coloured against alone. */
    .composition-entry[data-module-type="footer-band"] [data-slot]:where(ul, ol, dl) > li { padding: 0; border: 0; border-radius: 0; }
    /* G5.4j: a reveal starts its items translated DOWN — var(--space-12) for stagger-reveal and
       fade-rise, var(--space-16) for image-clip — and the proof rail is a scroll container
       (overflow-x: auto forces the block axis to auto too). Until the reveal lands, the rail is
       measurably taller than its own padding box: scrollWidth 1216 = clientWidth 1216, but
       scrollHeight 172 against clientHeight 168. axe reports that as
       scrollable-region-focusable — a region a mouse can scroll and a keyboard cannot reach —
       and it is a transition frame, not a design. The rail reserves the offset it is about to
       animate away, sized to the largest one in v3/motions. */
    .composition-entry [data-slot]:where(ul, ol, dl)[class*="motion-"] { padding-block-end: var(--space-16); }
    @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
    /* The catalog lays out intrinsically and carries no width breakpoint of its own: every
       collection sizes its tracks from minmax(var(--space-96), 1fr) or from a column rail.
       At 30em and below that resolves to three-to-eight tracks under a hundred CSS pixels
       wide, which the 390 measurement caught as 28 to 56 pixels of readable text inside the
       gallery, feature, proof and footer collections.  The shell — not the modules — owns
       the viewport, so the stack happens here, keyed on the collection marker the composer
       itself emits.  The breakpoint is written in em because the page gate forbids a raw
       pixel literal and a media query cannot read a custom property. */
    @media (max-width: 30em) {
      /* grid-column is reset with the track list: an item that still spans two columns of a
         one-column grid opens an implicit second track, which is how the feature list's lead
         card squeezed its own paragraph to zero width. Decoration keeps its own layout. */
      .composition-entry [class^="module-"]:not([aria-hidden="true"]):not([role="img"]) {
        grid-template-columns: minmax(0, 1fr);
        grid-column: auto;
      }
      /* G5.4j: the catalog sets a section's block padding to var(--space-64), which is a desktop
         gutter. On a 390 viewport the eight sections spent 1,024 pixels on their own top and
         bottom margins, and the page measured 8,428 tall against 7,628 for the page it replaces
         (docs/goals/evidence/v3/G5.4j/impl/measure/probe-before.json,
         docs/goals/evidence/v3/G5.4h/critic/live-probe/probe.json). One step down the SAME
         spacing scale on the phone only; the inline gutter is left alone, because that one is
         holding the text off the edge of the screen. */
      .composition-entry > [class^="module-"] { padding-block: var(--space-32); }
      .composition-entry [data-slot]:where(ul, ol, dl) {
        grid-auto-flow: row;
        grid-auto-columns: auto;
        overflow-x: visible;
      }
      /* G5.4h: a media placeholder that was given TEXT is not a picture, so it must not keep a
         picture's aspect ratio once the grid it sat in has collapsed to one column. The gallery
         tile frame is a 1/1 square by catalog default; at 390 that square is as wide as the
         viewport, and four of them spent a measured 1,368 pixels framing five lines of the
         smallest type token. Desktop keeps the square — four tiles in a row makes them read as a
         set — and the phone sizes the frame from the lines it actually holds. Filled frames
         only: an empty role="img" placeholder is still a picture slot and keeps its ratio. */
      .composition-entry [role="img"]:not(:empty) { aspect-ratio: auto; }
      /* A stacked collection turns its links into full-width rows, so give them a real
         target height instead of a bare line box (measured at 20 pixels tall in the footer).
         --space-48 is the smallest spacing token that clears the 44 pixel pointer target. */
      .composition-entry [data-slot]:where(ul, ol, dl) a {
        display: flex;
        align-items: center;
        min-block-size: var(--space-48);
      }
      /* G5.4i: a collection of SCREENSHOTS is the one case the single-column stack gets wrong.
         Stacking four page shots at full phone width spends the height of four folds on four
         thumbnails, and a thumbnail does not become more legible by being 342 pixels wide
         instead of 163 — it is a picture of a whole page either way. Two up keeps the row
         reading as a set and, measured, costs LESS height than the four text tiles it replaced.
         Scoped by :has() to collections that actually hold a shot, so every other stacked
         collection keeps the one-column rule above. */
      .composition-entry [class^="module-"][data-slot]:has([data-shot]) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        grid-auto-flow: row;
      }
      /* The action bar gained a language control, and at 320 that pushed the call to action
         18 pixels past the viewport (measured). Nothing is dropped to get it back: the bar
         spends less on its own gutters instead, which is what a gutter is for. */
      .page-actionbar { gap: var(--space-8); padding-inline: var(--space-8); }
      /* And the bar now renders two languages, so its widest label is not a fixed quantity:
         the English call to action measured 23 pixels wider than the Korean one and overflowed
         320 again. Rather than tune the copy to one viewport, the label is allowed to give up
         width — it is the last item that can, so it only truncates when nothing else is left. */
      .page-actionbar__cta { flex: 0 1 auto; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; }
    }
  </style>
${renderFontStyle()}${renderMotionStyle(usedMotions)}</head>
<body>
${skipLink}${actionBar ? `${actionBar}\n` : ''}  <main id="page-main" tabindex="-1">
${mainSections}
  </main>
${trailingBands}${selection.page.actionBar && selection.page.actionBar.langToggle ? `  <script data-lang-runtime>\n${LANG_RUNTIME}\n  </script>\n` : ''}${actionBar ? `  <script data-copy-runtime>\n${COPY_RUNTIME}\n  </script>\n` : ''}${actionBar ? `  <script data-anchor-runtime>\n${ANCHOR_RUNTIME}\n  </script>\n` : ''}${usedMotions.size ? `  <script data-motion-runtime>\n${MOTION_RUNTIME}\n  </script>\n` : ''}</body>
</html>
`;
}

function main(args) {
  if (args.length !== 2) {
    fail('usage: node v3/scripts/composer-assemble.js <v3/composer/<run>/selection.json> <v3/composer/<run>/page.html>');
  }
  const selectionFile = path.resolve(args[0]);
  const outputFile = path.resolve(args[1]);
  assertRunArtifact(selectionFile, 'selection input');
  assertRunArtifact(outputFile, 'page output');
  if (path.dirname(selectionFile) !== path.dirname(outputFile)) {
    fail('selection input and page output must be in the same composer run directory');
  }
  const selection = normalizeSelection(readJson(selectionFile, 'selection'));
  const total = selection.sections.length;
  const movingSections = selection.sections.filter((entry) => entry.variants.motion !== 'none').length;
  const motionCeiling = Math.ceil(total / 3);
  if (movingSections > motionCeiling) {
    fail(`${movingSections} motion-bearing sections exceed the ${motionCeiling} the composition grammar allows for ${total} sections`);
  }
  const usedMotions = new Map();
  // Page-wide, so a note declared by two sections has to say the same thing in both.
  const ledgerNotes = collectLedgerNotes(selection.sections);
  const rendered = selection.sections
    .map((entry, index) => ({
      type: entry.type,
      html: renderSection(entry, index, selectionFile, total, usedMotions, path.dirname(outputFile))
    }));
  const document = renderDocument(selection, rendered, outputFile, usedMotions);
  assertChipsResolve(document, ledgerNotes);
  fs.writeFileSync(outputFile, document);
  process.stdout.write(`assembled ${total} section(s): ${displayPath(outputFile)}\n`);
  process.stdout.write(`motion: ${movingSections}/${total} section(s) move (ceiling ${motionCeiling}); repertoire applied: ${[...usedMotions.keys()].sort().join(', ') || 'none'}\n`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
