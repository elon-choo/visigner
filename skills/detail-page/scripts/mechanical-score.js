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

// Every exported constant is frozen. They are a public contract (tests, MCP, the npm detector all
// read them), and an unfrozen export is a mutation channel: `require(m).AI_TELL_RULES.push('x')`
// persists through the module cache for the rest of the process.
const WEIGHTS = Object.freeze({
  tell_severity: Object.freeze({ low: 1, medium: 2, high: 3 }),
  per_severity_pt: 5,
  presence: 5,
  monotony: Object.freeze({ floor: 0.58, per_unit: 100 }),
  token_discipline: Object.freeze({ per_finding: 2 }),
});

const GRADE_BANDS = Object.freeze([
  Object.freeze({ grade: 'A', min: 90 }),
  Object.freeze({ grade: 'B', min: 80 }),
  Object.freeze({ grade: 'C', min: 70 }),
  Object.freeze({ grade: 'D', min: 60 }),
  Object.freeze({ grade: 'F', min: 0 }),
]);

// Keys a mechanical result must never carry. Asserted by tests/mechanical-score.test.js.
const SHIP_VERDICT_KEYS = Object.freeze([
  'would_ship',
  'shipApproved',
  'approved',
  'pass',
  's2Pass',
  'verdict',
]);

// brand-lint has 18 rules. Only the ones that name an AI TELL are scored here. The rest measure
// BUILD HYGIENE — raw-hex/rgb/hsl, off-grid spacing, undefined token refs, arbitrary Tailwind
// values, brand-book conformance — which is orthogonal to how AI a page looks. Averaging the two
// demotes real human pages: a captured Wadiz page scored 100 -> 88 purely on six raw-hex values,
// dropping Spearman rho against the human ranking from 0.857 to 0.514. Hygiene findings are still
// reported, on their own unscored dimension.
const AI_TELL_RULES = Object.freeze(['ai-purple', 'banned-font', 'emoji', 'banned-term']);

// computeMonotony() returns score 0 when a page has fewer than 4 content sections — "too few to
// measure", not "perfectly varied". Read as a clean signal, that 0 pays a slop page to DELETE
// sections (fake-blob-render: 33/F -> 88/B for dropping two). Below this floor the monotony
// dimension reports null, and `score` is republished as an UPPER BOUND: the page cannot be better
// than this, but one dimension is unknown, so a high number is not evidence of a clean page.
//
// The score is NOT withheld, because a legitimately short clean page (the skill's own
// assets/starter, 0 content sections, 0 tells) must not be punished for being short — the
// no-false-positive-on-starter rule outranks the anti-gaming rule. What changes is that the result
// is now *marked* unmeasurable, and tests/mechanical-score.test.js asserts that (a) every labeled
// fixture is fully measurable and (b) a thinned slop page is detected as unmeasurable.
const MIN_SECTIONS_FOR_MONOTONY = 4;

// `findings` counts array members, so a penalty can no longer be driven negative by a crafted
// sidecar (errorCount:-100 once lifted a slop page to 100/A — Codex rebuttal R2).
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const toGrade = (s) => (GRADE_BANDS.find((b) => s >= b.min) || { grade: 'F' }).grade;
const len = (a) => (Array.isArray(a) ? a.length : 0);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const severityWeight = (s) => (typeof s === 'string' && has(WEIGHTS.tell_severity, s) ? WEIGHTS.tell_severity[s] : 0);

// brand-lint emits `violations` in single-file mode and `files[].violations` in directory mode.
function collectViolations(brandLint) {
  if (!brandLint || typeof brandLint !== 'object' || Array.isArray(brandLint)) return [];
  if (Array.isArray(brandLint.violations)) return brandLint.violations;
  if (Array.isArray(brandLint.files)) {
    return brandLint.files.flatMap((f) => (Array.isArray(f && f.violations) ? f.violations : []));
  }
  return [];
}

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

  // Same weights as computeVerdict {low:1, medium:2, high:3}, and an unknown severity contributes 0.
  // The own-property check is load-bearing here and NOT present in computeVerdict: a plain
  // `WEIGHTS.tell_severity[severity]` returns Object.prototype.constructor for severity:'constructor',
  // and `0 + function` is NaN. computeVerdict is fed only its own detectors' output, which emit
  // low|medium|high; this module is an exported boundary that will be published as an npm detector
  // and can be handed an arbitrary report, so it hardens where computeVerdict does not.
  const severityScore = tells.reduce((sum, t) => sum + severityWeight(t && t.severity), 0);

  const p = src.presence;
  const expected = p ? len(p.expected) : 0;
  const missing = p ? len(p.missing) : 0;
  const presencePenalty = expected && missing / expected > 0.5 ? WEIGHTS.presence : 0;

  const contentSections = num(src.contentSections);
  const monotonyMeasurable = contentSections >= MIN_SECTIONS_FOR_MONOTONY;
  const monotonyScore = num(src.monotonyScore);
  const monotonyPenalty =
    monotonyMeasurable && monotonyScore > WEIGHTS.monotony.floor
      ? (monotonyScore - WEIGHTS.monotony.floor) * WEIGHTS.monotony.per_unit
      : 0;

  const wired = brandLint != null && typeof brandLint === 'object' && !Array.isArray(brandLint);
  const violations = collectViolations(brandLint);
  const findings = violations.filter((v) => v && AI_TELL_RULES.includes(v.rule)).length;
  const hygieneFindings = violations.length - findings;
  const tokenPenalty = findings * WEIGHTS.token_discipline.per_finding;

  const severityPenalty = WEIGHTS.per_severity_pt * severityScore;
  const score = clamp(100 - severityPenalty - presencePenalty - monotonyPenalty - tokenPenalty);

  return {
    score,
    letter: toGrade(score),
    // A dimension could not be measured, so `score` is an upper bound on this page's quality:
    // it can only be worse. Callers must not read a high incomplete score as a clean signal.
    incomplete: !monotonyMeasurable,
    scoreIsUpperBound: !monotonyMeasurable,
    dimensions: {
      structural_tells: {
        score: clamp(100 - severityPenalty - presencePenalty),
        severityScore,
        presencePenalty,
      },
      monotony: monotonyMeasurable
        ? {
            score: clamp(100 - monotonyPenalty),
            monotonyScore,
            penalty: Math.round(monotonyPenalty),
            contentSections,
          }
        : {
            score: null,
            monotonyScore: null,
            penalty: 0,
            contentSections,
            incomplete: true,
            reason: `fewer than ${MIN_SECTIONS_FOR_MONOTONY} content sections — too few to measure`,
          },
      token_discipline: {
        score: clamp(100 - tokenPenalty),
        findings,
        wired,
        scoredRules: AI_TELL_RULES,
      },
      // Reported, never summed into `score`. brand-lint's remaining rules (raw-hex, off-grid
      // spacing, undefined token refs …) measure how the page was built, not how AI it looks.
      build_hygiene: {
        findings: hygieneFindings,
        wired,
        scored: false,
      },
    },
  };
}

module.exports = {
  WEIGHTS,
  GRADE_BANDS,
  SHIP_VERDICT_KEYS,
  AI_TELL_RULES,
  MIN_SECTIONS_FOR_MONOTONY,
  mechanicalScore,
  readBrandLintReport,
};
