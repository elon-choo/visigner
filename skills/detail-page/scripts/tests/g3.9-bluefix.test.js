'use strict';

const assert = require('assert');
const path = require('path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const FIXTURES = path.join(__dirname, 'fixtures');
const {
  KINDS: COPY_KINDS,
  detectCopyTokenGaps,
} = require(path.join(ROOT, 'hooks', 'human-gate', 'copy-token-detector.js'));
const {
  detectMetricClaims,
} = require(path.join(ROOT, 'hooks', 'human-gate', 'metric-claim-detector.js'));
const {
  CHANNELS,
  detectPlaceholderImages,
} = require(path.join(ROOT, 'hooks', 'human-gate', 'placeholder-image-detector.js'));
const {
  buildHumanGateReport,
} = require(path.join(ROOT, 'hooks', 'human-gate', 'human-gate-report.js'));

test('H1 marker context distinguishes product prose from real stand-ins', () => {
  const dir = path.join(FIXTURES, 'g39-copy-marker-context');
  const legit = detectCopyTokenGaps(path.join(dir, 'legit.html'));
  const standins = detectCopyTokenGaps(path.join(dir, 'standins.html'));

  assert.strictEqual(legit.gapCount, 0, JSON.stringify(legit.items));
  assert.strictEqual(standins.gapCount, 4);
  assert.deepStrictEqual(standins.items.map((item) => item.value), ['FIXME', 'TODO', 'TODO', 'PLACEHOLDER']);
  assert.ok(standins.items.every((item) => item.kind === COPY_KINDS.STAND_IN));
  console.log('G3.9 H1 CLOSED: flowing TODO/FIXME/TBD/PLACEHOLDER product prose gaps=0; whole/colon/bracket/comment stand-ins=4');
});

test('M1 CTA links and bare superscripts cannot substantiate nearby claims', () => {
  const page = path.join(FIXTURES, 'g39-metric-cta-sup', 'index.html');
  const report = detectMetricClaims(page);

  assert.deepStrictEqual(report.items.map((item) => item.claim), ['99.9% uptime', 'Rated 4.9/5']);
  assert.strictEqual(report.flagCount, 2);
  assert.strictEqual(report.substantiatedCount, 1);
  assert.strictEqual(report.substantiatedClaims[0].claim, '3x faster');
  assert.strictEqual(report.substantiatedClaims[0].citationSignal, 'resolved footnote reference');
  console.log('G3.9 M1 CLOSED: signup/pricing CTA + bare sup claims flagged=2; resolved footnote substantiated=1');
});

test('L2 Korean claims and stand-in copy are detected without crying wolf on real scarcity copy', () => {
  const dir = path.join(FIXTURES, 'g39-korean-claims');
  const unsourced = detectMetricClaims(path.join(dir, 'unsourced.html'));
  const substantiated = detectMetricClaims(path.join(dir, 'substantiated.html'));
  const cleanPage = path.join(dir, 'clean.html');
  const cleanMetrics = detectMetricClaims(cleanPage);
  const cleanCopy = detectCopyTokenGaps(cleanPage);
  const cleanGate = buildHumanGateReport(cleanPage, {});
  const copyStandins = detectCopyTokenGaps(path.join(dir, 'copy-standins.html'));

  assert.strictEqual(unsourced.flagCount, 6, JSON.stringify(unsourced.items));
  assert.deepStrictEqual(unsourced.items.map((item) => item.claim), [
    '재구매율 98%',
    '고객 만족도 1위',
    '고객 12,000명',
    '후기 8,400건',
    '국내 최초',
    '마감임박',
  ]);
  assert.strictEqual(substantiated.flagCount, 0, JSON.stringify(substantiated.items));
  assert.strictEqual(substantiated.substantiatedCount, 6);
  assert.strictEqual(cleanMetrics.flagCount, 0);
  assert.strictEqual(cleanCopy.gapCount, 0);
  assert.strictEqual(cleanGate.stop, false, cleanGate.plainText);
  assert.strictEqual(cleanGate.itemCount, 0);
  assert.strictEqual(copyStandins.gapCount, 4);
  assert.deepStrictEqual(copyStandins.items.map((item) => item.value), [
    '브랜드명',
    '여기에 텍스트 입력',
    '예시 텍스트',
    '임시',
  ]);
  console.log('G3.9 L2 CLOSED: Korean unsourced claims=6; cited claims flags=0/substantiated=6; Korean stand-ins=4; dated D-3/inventory clean STOP=false');
});

test('L1 non-img SVG references expose every manifest-free placeholder marker', () => {
  const page = path.join(FIXTURES, 'g39-placeholder-non-img', 'index.html');
  const report = detectPlaceholderImages(page);

  assert.strictEqual(report.placeholderCount, 3);
  assert.deepStrictEqual(report.items.map((item) => item.id).sort(), ['css-standin', 'object-slot', 'picture-slot']);
  assert.ok(report.items.every((item) => item.sourceChannel === CHANNELS.REFERENCED_SVG));
  assert.ok(report.items.every((item) => item.sourceChannels.includes(CHANNELS.REFERENCED_SVG)));
  assert.strictEqual(report.manifestsScanned.length, 0);
  assert.ok(!report.items.some((item) => item.id === 'real-art'));
  console.log('G3.9 L1 CLOSED: CSS background-image + object data + picture source placeholders=3; manifest=none; real SVG false positives=0');
});

test('L3 duplicate headings flag adjacent copy residue but allow separate repeated sections', () => {
  const dir = path.join(FIXTURES, 'g39-duplicate-heading');
  const legit = detectCopyTokenGaps(path.join(dir, 'legit.html'));
  const adjacent = detectCopyTokenGaps(path.join(dir, 'adjacent-copy.html'));

  assert.strictEqual(legit.gapCount, 0, JSON.stringify(legit.items));
  assert.strictEqual(adjacent.gapCount, 1);
  assert.strictEqual(adjacent.items[0].kind, COPY_KINDS.DUPLICATE_HEADING);
  assert.strictEqual(adjacent.items[0].value, '배송 안내');
  console.log('G3.9 L3 CLOSED: distinct-section repeated heading gaps=0; adjacent duplicate gaps=1');
});

test('all named Stage 3 preservation contracts remain intact', () => {
  for (const relative of ['docs/index.html', 'docs/guide.html', 'docs/how-to.html']) {
    const report = buildHumanGateReport(path.join(ROOT, relative), {});
    assert.strictEqual(report.stop, false, `${relative}: ${report.plainText}`);
    assert.strictEqual(report.itemCount, 0, relative);
  }

  const marketing = path.join(FIXTURES, 'g3-marketing-substantiated', 'index.html');
  const marketingClaims = detectMetricClaims(marketing);
  const marketingGate = buildHumanGateReport(marketing, {});
  assert.strictEqual(marketingClaims.flagCount, 0);
  assert.strictEqual(marketingClaims.substantiatedCount, 5);
  assert.strictEqual(marketingGate.stop, false, marketingGate.plainText);

  const f1 = detectPlaceholderImages(path.join(FIXTURES, 'g3-f1-external-svg', 'index.html'));
  assert.strictEqual(f1.placeholderCount, 5);

  const samePattern = detectMetricClaims(path.join(FIXTURES, 'g3-metric-claims-mixed', 'index.html'));
  assert.strictEqual(samePattern.items.filter((item) => item.claim === '99.9% uptime').length, 1);
  assert.strictEqual(samePattern.substantiatedClaims.filter((item) => item.claim === '99.9% uptime').length, 1);
  console.log('G3.9 REGRESSION PRESERVED: docs=3 clear; marketing flags=0/substantiated=5; F1 placeholders=5; same-page 99.9 cited=1/uncited=1');
});
