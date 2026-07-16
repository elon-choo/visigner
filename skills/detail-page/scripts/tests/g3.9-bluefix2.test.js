'use strict';

const assert = require('assert');
const path = require('path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const FIXTURES = path.join(__dirname, 'fixtures');
const {
  detectCopyTokenGaps,
} = require(path.join(ROOT, 'hooks', 'human-gate', 'copy-token-detector.js'));
const {
  detectMetricClaims,
} = require(path.join(ROOT, 'hooks', 'human-gate', 'metric-claim-detector.js'));
const {
  detectPlaceholderImages,
} = require(path.join(ROOT, 'hooks', 'human-gate', 'placeholder-image-detector.js'));
const {
  buildHumanGateReport,
} = require(path.join(ROOT, 'hooks', 'human-gate', 'human-gate-report.js'));

test('M-01 Korean offer amounts stay clear while performance and ranking claims still flag', () => {
  const dir = path.join(FIXTURES, 'g39-korean-offers');
  const offerPage = path.join(dir, 'legit-offers.html');
  const offerClaims = detectMetricClaims(offerPage);
  const offerGate = buildHumanGateReport(offerPage, {});
  const performance = detectMetricClaims(path.join(dir, 'unsourced-performance.html'));

  assert.strictEqual(offerClaims.flagCount, 0, JSON.stringify(offerClaims.items));
  assert.strictEqual(offerGate.stop, false, offerGate.plainText);
  assert.strictEqual(offerGate.itemCount, 0);
  assert.strictEqual(performance.flagCount, 2);
  assert.deepStrictEqual(performance.items.map((item) => item.claim), [
    '월 30% 비용 절감',
    '고객 만족도 1위',
  ]);
  console.log('G3.9 ROUND2 M-01 CLOSED: discount/benefit/special-price flags=0; humanGateStop=false; performance/ranking true positives=2');
});

test('round-1 and Stage-3 named preservation contracts remain unchanged', () => {
  for (const relative of ['docs/index.html', 'docs/guide.html', 'docs/how-to.html']) {
    const report = buildHumanGateReport(path.join(ROOT, relative), {});
    assert.strictEqual(report.stop, false, `${relative}: ${report.plainText}`);
    assert.strictEqual(report.itemCount, 0, relative);
  }

  const marketing = path.join(FIXTURES, 'g3-marketing-substantiated', 'index.html');
  assert.strictEqual(detectMetricClaims(marketing).flagCount, 0);
  assert.strictEqual(buildHumanGateReport(marketing, {}).stop, false);
  assert.strictEqual(detectPlaceholderImages(path.join(FIXTURES, 'g3-f1-external-svg', 'index.html')).placeholderCount, 5);

  const ctaClaims = detectMetricClaims(path.join(FIXTURES, 'g39-metric-cta-sup', 'index.html'));
  assert.deepStrictEqual(ctaClaims.items.map((item) => item.claim), ['99.9% uptime', 'Rated 4.9/5']);
  assert.strictEqual(detectCopyTokenGaps(path.join(FIXTURES, 'g39-copy-marker-context', 'legit.html')).gapCount, 0);
  console.log('G3.9 ROUND2 PRESERVED: docs=3 clear; marketing flags=0; F1 placeholders=5; CTA-adjacent uncited=2; TODO-app gaps=0');
});
