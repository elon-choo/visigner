---
name: design-review
description: Independently review a built page, UI, plan/flow, copy, or animation and return a SHIP / NO-SHIP verdict — anti-AI-slop visual audit, the 10-dimension conversion+craft rubric, accessibility, motion, and semantic brand-fidelity, graded from real evidence. Use for "is this good enough to ship", "review my design", "design QA", design sign-off, executive design check.
---

# /design-review — SHIP / NO-SHIP design gate

Target to review: **$ARGUMENTS** (a file path, URL, plan/flow doc, copy, or the thing just built)

Run an INDEPENDENT review — the evaluator must not be whoever built it. Grade from evidence (pixels, frames, the actual words), not from the builder's claims.

## 1 · Classify the artifact, then fan out design-critic in the RIGHT mode
Don't force everything through the visual rubric — match the evaluator to what's actually being reviewed. Spawn one or more in parallel:

- **A built page / UI / component** → `design-critic` default (visual + conversion): screenshot with `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/shoot.js` at desktop + 390px mobile, `AXE=1` (run `/design-setup` once if needed); it reads the tiles + `run.json`. **PLUS** `a11y-auditor` (step 3).
- **A plan / flow / IA / wireframe** (no built pixels yet) → `design-critic MODE=plan` — grade the structure, the message arc, and the conversion logic before anyone builds.
- **Copy / headline / email or a sequence** → `design-critic MODE=copy` — grade the words against the empathy→proof→CTA arc and brand voice, not layout.
- **An animated page** → do the built-page pass above **AND** `design-critic MODE=motion` on the FILMSTRIP: re-shoot with `FILMSTRIP=1` set so `shoot.js` emits the per-frame strip, then hand that strip to motion mode (timing, easing, restraint, `prefers-reduced-motion` honored). If `FILMSTRIP=1` produced no strip, say so and grade motion as advisory rather than inventing frames.

The visual `design-critic` runs the 10-dimension rubric (hook, structure, benefit-vs-feature, empathy, proof, one-message, visual craft, urgency/CTA, trust, aesthetic distinctiveness) and names the specific slop tell behind every deduction, calibrated beside the real Wadiz captures in the detail-page skill.

## 2 · a11y-auditor (for any built page)
WCAG 2.2 AA: contrast, keyboard, focus, names/roles, reduced-motion. Serious/critical = fail.

## 3 · Brand fidelity — raw gate AND a semantic answer
- **Raw gate** — if a brand/token system exists, run `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/brand-lint.js <file>` (raw-hex / banned-font / AI-purple). Cite the reported violation.
- **Semantic BRAND-FIDELITY** — `brand-lint` only proves "no raw hex / no banned font / no ungrounded purple"; it does not prove the page is *on this brand*. So, **only if `brand.tokens.json` + brand guidelines exist in the project**, additionally check and report:
  - **Exact-palette match** — the page's actual colors equal the brand's *semantic* tokens (primary/accent/surface roles), not merely "tokenized at all". A page can pass brand-lint while using off-brand-but-tokenized colors.
  - **Logo usage** — clear space, minimum size, and approved variant (per the guidelines) — flag wrong-variant / cramped / undersized lockups.
  - **Voice spot-check** — sample the copy against the brand's owned vs banned lexicon; flag banned terms and missing voice markers.
  - Emit one line: **`on-brand: yes / no — <evidence>`**.
- **No brand system provided** → state `on-brand: N/A — no brand.tokens.json + guidelines in project` and skip. Do **not** fabricate an on-brand pass.

## 4 · Executive verdict (keep it concise, CEO-readable)
Emit, in order:
1. One-line call: **SHIP / CONDITIONAL / NO-SHIP**.
2. **Overall score** (/10).
3. The **2–3 lowest dimensions** and the specific fix each implies — ranked by leverage.
4. The **`on-brand:`** line from step 3.

Ship only at overall ≥8/10 with no dimension <7, aesthetic distinctiveness ≥8, zero anti-slop or serious-a11y fails, motion clean (when applicable), and `on-brand: yes` (when a brand system exists). Do not soften a NO-SHIP — state it plainly with the evidence.
