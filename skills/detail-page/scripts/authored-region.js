'use strict';

// Platform pages can still expose a maker-authored story column. These are
// deliberately narrow, platform-story selectors: a generic "story" class is
// not enough evidence to attribute a platform surface to the maker.
const MAKER_REGION_SELECTORS = Object.freeze([
  '[data-authored-region="maker"]',
  '[data-testid*="funding-story"]',
  '[data-testid*="project-story"]',
  '[class*="FundingStory"]',
  '[class*="ProjectStory"]',
  '[class*="campaign-story"]',
  '[class*="project-story"]',
  '[class*="story-content"]',
  '[id*="campaign-story"]',
  '[id*="project-story"]',
]);

// Calibration is n=5: DOM-authored Linear (398 vars / 64px / 10,526px /
// 0.7776 chars-per-px / 3 images), Resend (484 / 96px / 12,251px / 1.4222 /
// 3), and Supabase (679 / 46px / 7,683px / 1.0417 / 10); must-reject Wadiz
// 400620 (5 / 24px / 130,712px / 0.04466 / 33) and H-1 (400 / 64px /
// 117,039px / 0.0500 / 26). DOM admission requires all image-story signals
// to be absent: <100000px, >0.06 chars-per-px, and <20 large images.
function looksLikePlatformChrome(signals) {
  return signals.cssVarCount <= 10
    && signals.pageHeightPx !== null
    && signals.pageHeightPx >= 100000
    && signals.textToHeightRatio !== null
    && signals.textToHeightRatio <= 0.06
    && signals.bigImageCount >= 20
    && signals.largestHeadingPx !== null
    && signals.largestHeadingPx <= 32;
}

function looksDomAuthored(signals) {
  return signals.largestHeadingPx !== null
    && signals.pageHeightPx !== null
    && signals.pageHeightPx < 100000
    && signals.textToHeightRatio !== null
    && signals.textToHeightRatio > 0.06
    && signals.bigImageCount < 20
    && (
      (signals.cssVarCount >= 300 && signals.largestHeadingPx >= 48)
      || (signals.cssVarCount >= 500 && signals.largestHeadingPx >= 40)
    );
}

function resolveMakerRegion(candidates) {
  const resolved = (Array.isArray(candidates) ? candidates : [])
    .filter((candidate) => candidate && typeof candidate === 'object')
    .filter((candidate) => Number.isFinite(candidate.width) && candidate.width >= 280)
    .filter((candidate) => Number.isFinite(candidate.height) && candidate.height >= 480)
    .filter((candidate) => Number.isFinite(candidate.descendantCount) && candidate.descendantCount >= 3)
    .filter((candidate) => (Number.isFinite(candidate.imageCount) && candidate.imageCount >= 1)
      || (Number.isFinite(candidate.textLength) && candidate.textLength >= 120))
    .sort((left, right) => (right.width * right.height) - (left.width * left.height)
      || right.height - left.height
      || String(left.selector).localeCompare(String(right.selector)));

  if (!resolved.length) {
    return {
      status: 'MISS',
      selector: null,
      reason: 'MISS — no resolvable maker-authored story region met the conservative size/content evidence threshold; no maker token will be inferred.',
    };
  }

  const candidate = resolved[0];
  return {
    status: 'resolved',
    selector: candidate.selector,
    sourceSelector: candidate.sourceSelector || null,
    width: candidate.width,
    height: candidate.height,
    descendantCount: candidate.descendantCount,
    imageCount: candidate.imageCount,
    textLength: candidate.textLength,
  };
}

function classifyAuthoredRegion(signals) {
  if (looksLikePlatformChrome(signals)) {
    return {
      verdict: 'likely-platform-chrome',
      signals,
      note: 'Tall, text-poor, image-dominant content with minimal CSS variables likely leaves the exemplar inside images rather than the DOM.',
    };
  }
  if (looksDomAuthored(signals)) {
    return {
      verdict: 'dom-authored',
      signals,
      note: 'A large rendered heading and plentiful resolved CSS variables indicate a DOM-authored design surface.',
    };
  }
  return {
    verdict: 'unknown',
    signals,
    note: 'REFUSING — authored region is unresolved; provide an explicit region classification; no region default will be assumed. Signals do not satisfy either conservative authored-region profile.',
  };
}

module.exports = {
  MAKER_REGION_SELECTORS,
  classifyAuthoredRegion,
  looksDomAuthored,
  looksLikePlatformChrome,
  resolveMakerRegion,
};
