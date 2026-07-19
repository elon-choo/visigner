'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const { classifyAuthoredRegion, looksDomAuthored } = require(path.join(ROOT, 'scripts', 'authored-region.js'));

function signalsFrom(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8')).authoredRegion.signals;
}

test('n=5 calibration admits all DOM-authored captures and rejects image-story profiles', () => {
  const linear = signalsFrom(path.join(ROOT, 'references', 'captures', 'app-ui', 'linear', 'styles.json'));
  const resend = signalsFrom(path.join(ROOT, 'references', 'captures', 'stage2', 'resend', 'styles.json'));
  const supabase = signalsFrom(path.join(ROOT, 'references', 'captures', 'stage2', 'supabase', 'styles.json'));
  const wadiz400620 = {
    cssVarCount: 5,
    pageHeightPx: 130712,
    bodyTextLen: 5838,
    bigImageCount: 33,
    textToHeightRatio: 0.04466307607564723,
    largestHeadingPx: 24,
  };
  const adversarial = {
    cssVarCount: 400,
    pageHeightPx: 117039,
    bodyTextLen: 5894,
    bigImageCount: 26,
    textToHeightRatio: 0.0503,
    largestHeadingPx: 64,
  };

  assert.deepStrictEqual([
    classifyAuthoredRegion(linear).verdict,
    classifyAuthoredRegion(resend).verdict,
    classifyAuthoredRegion(supabase).verdict,
    classifyAuthoredRegion(wadiz400620).verdict,
    classifyAuthoredRegion(adversarial).verdict,
  ], [
    'dom-authored',
    'dom-authored',
    'dom-authored',
    'likely-platform-chrome',
    'unknown',
  ]);
  assert.strictEqual(looksDomAuthored(adversarial), false);
});
