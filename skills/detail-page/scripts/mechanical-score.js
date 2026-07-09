'use strict';
// mechanical-score.js — graded, DETERMINISTIC companion to the boolean s2Pass gate.
//
// Architecture adapted from ui-craft (MIT), (c) 2026 Eduardo Calvo — github.com/educlopez/ui-craft
//   Borrowed IDEAS ONLY (no code copied): an exported weights table + letter bands as a public,
//   checkable contract, and the "mechanical output is never averaged with a judged score" seam.
//   Weights, dimensions and bands below are visigner's own. See ATTRIBUTIONS.md.
//
// NON-WEAKENABLE CONTRACT (UC1.1 track-contract.json, criteria W1-W8):
//   - This module never computes, reads, or influences s2Pass. It is strictly additive.
//   - Its output MUST NOT carry a ship-verdict key (see SHIP_VERDICT_KEYS). The judged axis
//     (taste-jury / review-rubric) lives in a different actor and is never blended in here.
//   - It is an exported module boundary: callers (tests, MCP, npm detector) may pass anything,
//     so every numeric input is coerced and every optional shape is guarded. It never throws.

const fs = require('fs');
const path = require('path');

const WEIGHTS = {
  tell_severity: { low: 1, medium: 2, high: 3 },
  per_severity_pt: 5,
  presence: 5,
  monotony: { floor: 0.58, per_unit: 100 },
  token_discipline: { per_finding: 2 },
};

const GRADE_BANDS = [
  { grade: 'A', min: 90 },
  { grade: 'B', min: 80 },
  { grade: 'C', min: 70 },
  { grade: 'D', min: 60 },
  { grade: 'F', min: 0 },
];

// Keys a mechanical result must never carry. Asserted by tests/mechanical-score.test.js.
const SHIP_VERDICT_KEYS = ['would_ship', 'shipApproved', 'approved', 'pass', 's2Pass', 'verdict'];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
// Every penalty is non-negative: a penalty term must never become a score BONUS.
// Without this, a crafted brand-lint sidecar with errorCount:-100 lifts a slop page to 100/A.
const penalty = (v) => Math.max(0, num(v));
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const toGrade = (s) => (GRADE_BANDS.find((b) => s >= b.min) || { grade: 'F' }).grade;
const len = (a) => (Array.isArray(a) ? a.length : 0);

// Fails OPEN and LOUD: an unreadable sidecar must never stop the boolean gate from being computed.
// The omission is recorded as dimensions.token_discipline.wired === false, so a caller that
// requires the dimension asserts on it rather than trusting a silently higher score.
function readBrandLintReport(file) {
  if (!file || typeof file !== 'string') return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not a brand-lint report object');
    }
    return parsed;
  } catch (e) {
    process.stderr.write(
      `mechanical-score: brand-lint report unusable (${e.message}) — token_discipline left UNWIRED\n`,
    );
    return null;
  }
}

function mechanicalScore(input, brandLint) {
  const src = input && typeof input === 'object' ? input : {};
  const tells = Array.isArray(src.tellsDetected) ? src.tellsDetected : [];

  // Mirrors computeVerdict's weighting exactly: an unknown severity contributes 0.
  const severityScore = tells.reduce(
    (sum, t) => sum + (WEIGHTS.tell_severity[t && t.severity] || 0),
    0,
  );

  const p = src.presence;
  const expected = p ? len(p.expected) : 0;
  const missing = p ? len(p.missing) : 0;
  const presencePenalty = expected && missing / expected > 0.5 ? WEIGHTS.presence : 0;

  const monotonyScore = num(src.monotonyScore);
  const monotonyPenalty =
    monotonyScore > WEIGHTS.monotony.floor
      ? (monotonyScore - WEIGHTS.monotony.floor) * WEIGHTS.monotony.per_unit
      : 0;

  const wired = brandLint != null && typeof brandLint === 'object' && !Array.isArray(brandLint);
  const findings = wired ? penalty(brandLint.errorCount) + penalty(brandLint.warnCount) : 0;
  const tokenPenalty = findings * WEIGHTS.token_discipline.per_finding;

  const severityPenalty = WEIGHTS.per_severity_pt * severityScore;
  const score = clamp(100 - severityPenalty - presencePenalty - monotonyPenalty - tokenPenalty);

  return {
    score,
    letter: toGrade(score),
    dimensions: {
      structural_tells: {
        score: clamp(100 - severityPenalty - presencePenalty),
        severityScore,
        presencePenalty,
      },
      monotony: {
        score: clamp(100 - monotonyPenalty),
        monotonyScore,
        penalty: Math.round(monotonyPenalty),
      },
      token_discipline: {
        score: clamp(100 - tokenPenalty),
        findings,
        wired,
      },
    },
  };
}

module.exports = { WEIGHTS, GRADE_BANDS, SHIP_VERDICT_KEYS, mechanicalScore, readBrandLintReport };
