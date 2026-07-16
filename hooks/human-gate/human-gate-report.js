#!/usr/bin/env node
'use strict';

const path = require('path');
const { assessTasteFile } = require('../taste-suspect.js');
const { detectPlaceholderImages } = require('./placeholder-image-detector.js');
const { detectCopyTokenGaps } = require('./copy-token-detector.js');
const { detectMetricClaims } = require('./metric-claim-detector.js');
const { surfaceAssetGaps } = require('./asset-gap-surfacer.js');

const CLEAR_HEADER = 'No human-must-do items — this draft has no detected gaps';
const TASTE_SIGNAL_TEXT = Object.freeze({
  'mechanical-measurement-incomplete': 'the machine check was incomplete',
  'near-empty-visible-content': 'very little useful content is visible',
  'thin-content-density': 'the page has too little useful content for its length',
  'placeholder-dominant-shell': 'too many areas still look like empty stand-ins',
  'empty-visual-shells': 'large visual areas are still empty',
  'taste-analysis-unavailable': 'the visual-quality check could not finish',
});

function cleanDetail(value, fallback = 'check unavailable') {
  return String(value || fallback).replace(/\s+/g, ' ').trim().slice(0, 1200);
}

function sentenceCase(value) {
  const text = cleanDetail(value, '');
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

function endSentence(value) {
  const text = cleanDetail(value, '');
  return /[.!?](?:["”’])?$/.test(text) ? text : text + '.';
}

function safeRun(name, fallback, run) {
  try {
    const report = run();
    if (!report || typeof report !== 'object') throw new Error(`${name} returned no report`);
    return report;
  } catch (error) {
    return { ...fallback, errors: [{ source: name, error: cleanDetail(error && error.message) }] };
  }
}

function plainLocation(location) {
  if (!location) return 'the page';
  const line = Number.isInteger(location.line) ? `around line ${location.line}` : 'on the page';
  const tag = String(location.tag || 'text').split('#')[0].split('[')[0];
  const area = tag === 'title'
    ? 'in the page title'
    : /^h[1-6]$/.test(tag)
      ? 'in a heading'
      : tag === 'p'
        ? 'in a paragraph'
        : tag === 'img'
          ? 'in an image label'
          : 'in the page text';
  const context = cleanDetail(location.snippet || location.context || '', '');
  return `${line}, ${area}${context ? `: “${context}”` : ''}`;
}

function imageChecklistItem(placeholders, assetGaps) {
  if (!placeholders.placeholderCount) return null;
  const names = (placeholders.items || [])
    .map((item) => item.slot || item.role || item.id)
    .filter(Boolean);
  const uniqueNames = [...new Set(names)];
  const credentialGap = assetGaps.items && assetGaps.items[0];
  const commands = Array.isArray(credentialGap && credentialGap.fix) ? credentialGap.fix : [];
  const commandHelp = commands.length
    ? ` To generate replacements, run one of these commands: ${commands.map((command) => `“${command}”`).join(' or ')}.`
    : '';
  return {
    category: 'images',
    whatIsMissing: `${placeholders.placeholderCount} image ${placeholders.placeholderCount === 1 ? 'spot still shows a stand-in' : 'spots still show stand-ins'} instead of real images`,
    where: uniqueNames.length ? `Image spots: ${uniqueNames.join(', ')}` : 'the image spots on this page',
    concreteSuggestion: `Add a real image for each listed spot.${commandHelp} Or knowingly keep the temporary image stand-ins.`,
    mergedFrom: {
      placeholderImageFindings: placeholders.placeholderCount,
      assetCredentialFindings: Number(assetGaps.gapCount || 0),
    },
  };
}

function copyChecklistItem(item) {
  const missing = item.kind === 'empty-heading'
    ? 'A section heading is empty'
    : item.kind === 'duplicate-heading'
      ? `The heading “${item.value}” is repeated`
      : item.kind === 'template-token'
        ? `The fill-in label “${item.value}” was not replaced`
        : item.kind === 'brand-token-default'
          ? `The default name “${item.value}” is still on the page`
          : `Temporary copy “${item.value}” is still on the page`;
  return {
    category: 'copy',
    whatIsMissing: missing,
    where: plainLocation(item.location),
    concreteSuggestion: sentenceCase(item.suggestion || 'Replace it with the final words you want visitors to read.'),
  };
}

function claimChecklistItem(item) {
  return {
    category: 'claims',
    whatIsMissing: `The claim “${item.claim}” has no nearby source`,
    where: plainLocation(item.location),
    concreteSuggestion: 'Check that this claim is true and add a trustworthy source, or remove the claim.',
  };
}

function tasteChecklistItem(taste) {
  const signals = [...new Set(Array.isArray(taste.tasteSignals) ? taste.tasteSignals : [])];
  const plainSignals = signals.map((signal) => TASTE_SIGNAL_TEXT[signal] || cleanDetail(signal).replace(/-/g, ' '));
  return {
    category: 'visual review',
    whatIsMissing: 'A person still needs to judge the page’s visual quality; a 100/A machine score is not taste approval',
    where: plainSignals.length ? `The whole page: ${plainSignals.join('; ')}` : 'the whole page',
    concreteSuggestion: 'Open the rendered page, check its visual quality and completeness, then approve it or revise it before shipping.',
  };
}

function resolveTaste(page, options, detector) {
  if (options.tasteResult && typeof options.tasteResult === 'object') return options.tasteResult;
  if (options.gradeResult && typeof options.gradeResult === 'object'
      && (typeof options.gradeResult.tasteSuspect === 'boolean' || typeof options.gradeResult.humanGateRequired === 'boolean')) {
    return options.gradeResult;
  }
  if (typeof options.tasteSuspect === 'boolean' || typeof options.humanGateRequired === 'boolean') {
    return {
      tasteSuspect: options.tasteSuspect === true,
      humanGateRequired: options.humanGateRequired === true,
      tasteSignals: Array.isArray(options.tasteSignals) ? options.tasteSignals : [],
    };
  }
  if (options.gradeResult && typeof options.gradeResult === 'object') {
    return detector(page, options.gradeResult.staticGrade || options.gradeResult);
  }
  return { tasteSuspect: false, humanGateRequired: false, tasteSignals: [] };
}

function formatChecklist(header, items) {
  if (!items.length) return header;
  return [header, ...items.map((item) => (
    `${item.number}. What needs attention: ${endSentence(item.whatIsMissing)} Where: ${endSentence(item.where)} What to do: ${endSentence(item.concreteSuggestion)}`
  ))].join('\n');
}

function buildHumanGateReport(pagePath, options = {}) {
  const page = path.resolve(pagePath || '');
  const placeholderDetector = options.placeholderDetector || detectPlaceholderImages;
  const copyDetector = options.copyDetector || detectCopyTokenGaps;
  const claimDetector = options.claimDetector || detectMetricClaims;
  const assetDetector = options.assetDetector || surfaceAssetGaps;
  const tasteDetector = options.tasteDetector || assessTasteFile;

  const placeholders = safeRun('placeholder image check', {
    status: 'unavailable', placeholderCount: 0, items: [],
  }, () => placeholderDetector(page, { manifestPath: options.manifestPath || null }));
  const copy = safeRun('copy check', {
    status: 'unavailable', gapCount: 0, items: [],
  }, () => copyDetector(page));
  const claims = safeRun('claim check', {
    status: 'unavailable', flagCount: 0, items: [], substantiatedCount: 0, substantiatedClaims: [],
  }, () => claimDetector(page));
  const assets = safeRun('image access check', {
    status: 'unavailable-safe-fallback', gapCount: 0, items: [], imageGenerationBlocked: false,
  }, () => assetDetector(page, {
    env: options.env || process.env,
    manifestPath: options.manifestPath || null,
    placeholderDetector,
  }));
  const taste = safeRun('visual quality check', {
    tasteSuspect: false, humanGateRequired: false, tasteSignals: ['taste-analysis-unavailable'],
  }, () => resolveTaste(page, options, tasteDetector));

  const rawItems = [];
  const imageItem = imageChecklistItem(placeholders, assets);
  if (imageItem) rawItems.push(imageItem);
  for (const item of copy.items || []) rawItems.push(copyChecklistItem(item));
  for (const item of claims.items || []) rawItems.push(claimChecklistItem(item));
  if (taste.tasteSuspect === true || taste.humanGateRequired === true) rawItems.push(tasteChecklistItem(taste));

  const checklist = rawItems.map((item, index) => ({ number: index + 1, ...item }));
  const itemCount = checklist.length;
  const header = itemCount
    ? `STOP — this draft is not ready to ship until you resolve ${itemCount} human-must-do ${itemCount === 1 ? 'item' : 'items'}`
    : CLEAR_HEADER;
  const errors = [placeholders, copy, claims, assets, taste]
    .flatMap((report) => report.errors || [])
    .map((entry) => ({ source: entry.source || 'check', error: cleanDetail(entry.error) }));

  return {
    status: itemCount ? 'stop' : 'clear',
    zeroNetwork: true,
    readOnly: true,
    page,
    stop: itemCount > 0,
    itemCount,
    header,
    checklist,
    plainText: formatChecklist(header, checklist),
    detectorSummary: {
      placeholderImages: Number(placeholders.placeholderCount || 0),
      copyGaps: Number(copy.gapCount || 0),
      claimGaps: Number(claims.flagCount || 0),
      assetCredentialGaps: Number(assets.gapCount || 0),
      substantiatedClaims: Number(claims.substantiatedCount || 0),
      tasteSuspect: taste.tasteSuspect === true,
      humanGateRequired: taste.humanGateRequired === true,
      tasteSignals: Array.isArray(taste.tasteSignals) ? taste.tasteSignals : [],
      consolidatedImageItems: imageItem ? 1 : 0,
    },
    deduplication: {
      imageOverlapMerged: Boolean(imageItem && Number(assets.gapCount || 0) > 0),
      rawPlaceholderFindings: Number(placeholders.placeholderCount || 0),
      rawAssetCredentialFindings: Number(assets.gapCount || 0),
      consolidatedImageItems: imageItem ? 1 : 0,
    },
    imageGenerationBlocked: false,
    errors,
  };
}

function main() {
  try {
    const jsonArg = process.argv.slice(3).find((arg) => arg.trim().startsWith('{'));
    const options = jsonArg ? JSON.parse(jsonArg) : {};
    const report = buildHumanGateReport(process.argv[2], options);
    process.stdout.write(process.argv.includes('--text') ? report.plainText + '\n' : JSON.stringify(report, null, 2) + '\n');
  } catch (error) {
    const header = 'STOP — this draft is not ready to ship until you resolve 1 human-must-do item';
    process.stdout.write(JSON.stringify({
      status: 'stop', zeroNetwork: true, readOnly: true,
      page: process.argv[2] ? path.resolve(process.argv[2]) : null,
      stop: true, itemCount: 1, header,
      checklist: [{
        number: 1,
        category: 'manual review',
        whatIsMissing: 'The automatic checklist could not finish',
        where: 'the whole page',
        concreteSuggestion: 'Review every image, unfinished text, and factual claim before shipping, then run this check again.',
      }],
      plainText: `${header}\n1. What needs attention: The automatic checklist could not finish. Where: the whole page. What to do: Review every image, unfinished text, and factual claim before shipping, then run this check again.`,
      detectorSummary: {}, deduplication: {}, imageGenerationBlocked: false,
      errors: [{ source: 'human-gate-report', error: cleanDetail(error && error.message) }],
    }, null, 2) + '\n');
  }
}

if (require.main === module) main();

module.exports = { CLEAR_HEADER, buildHumanGateReport };
