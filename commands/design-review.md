---
name: design-review
description: Independently review a built page, UI, or component and return a SHIP / NO-SHIP verdict — anti-AI-slop visual audit, the 10-dimension conversion+craft rubric, accessibility, and brand consistency, graded from real screenshots. Use for "is this good enough to ship", "review my design", "design QA", design sign-off, executive design check.
---

# /design-review — SHIP / NO-SHIP design gate

Target to review: **$ARGUMENTS** (a file path, URL, or the thing just built)

Run an INDEPENDENT review — the evaluator must not be whoever built it. Grade from pixels, not claims.

1. **Render & capture** — screenshot the target with `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/shoot.js` at desktop + 390px mobile, `AXE=1` (run `/design-setup` once if needed). Read the tiles and `run.json`.
2. **design-critic agent** — anti-slop visual audit (pass/fail) + the 10-dimension rubric (hook, structure, benefit-vs-feature, empathy, proof, one-message, visual craft, urgency/CTA, trust, aesthetic distinctiveness). Calibrate beside the real Wadiz captures in the detail-page skill. Name the specific tell behind every deduction.
3. **a11y-auditor agent** — WCAG 2.2 AA: contrast, keyboard, focus, names/roles, reduced-motion. Serious/critical = fail.
4. **Brand consistency** — if a brand/token system exists, run `brand-lint.js` (raw-hex / banned-font / AI-purple gate).

**Output an executive-readable verdict** (a CEO should understand it): a one-line SHIP / CONDITIONAL / NO-SHIP call, the overall score, the 2–3 lowest dimensions, and the specific fix each implies — ranked by leverage. Ship only at overall ≥8/10 with no dimension <7, aesthetic distinctiveness ≥8, and zero anti-slop or serious-a11y fails. Do not soften a NO-SHIP; state it plainly with the evidence.
