---
name: detail-page
description: Build, CAPTURE/VIEW, and benchmark high-converting landing pages and Korean product detail pages (상세페이지) / crowdfunding campaign pages (와디즈 Wadiz, 텀블벅 Tumblbug) at a quality that does NOT read as AI-generated — and generate the page's image assets. Trigger this skill whenever the task touches detail/landing pages in ANY of these ways, not only when "building". (a) DESIGN/BUILD/IMPROVE — landing page, 랜딩페이지, 상세페이지, detail page, product page, 제품 소개 페이지, sales page, 세일즈페이지, 펀딩 상세, AI/디지털 상품 상세페이지 (강의·클래스·프롬프트팩·템플릿·VOD·전자책·자동화), hero section, or "make a design less generic / less AI-looking". (b) CAPTURE/VIEW/ANALYZE an existing live page — "와디즈 페이지 보여줘/열어줘/캡처해줘/분석해줘/뜯어봐", screenshot/scrape/open/view/inspect a real, competitor, or reference detail page, look at a 레퍼런스/벤치마크 page, or when a Wadiz/Akamai page returns 403 / "Access Denied" / won't open to normal fetch or headless (this skill has a Patchright headed-Chrome capture that gets past the bot wall, a one-click stitched viewer, and saved real captures of Wadiz 400620 + 403454 under references/captures/). (c) GENERATE IMAGE ASSETS — covers, product/scene mockups, deliverables walls, banners, 상세페이지 이미지 — via image models (gpt-image / Gemini gemini-3-pro-image). Combines Anthropic's frontend aesthetic discipline (plan-before-code tokens, banned defaults) + Korean conversion-copy structure (PASONA / 후킹→공감→해결→증명→CTA) + a screenshot-based visual self-critique loop + API-driven image generation.
---

# Detail Page — anti-slop page design system

A page is good when a skeptical human cannot tell it was AI-generated AND it moves the reader toward one action. Two halves, both required:
- **Aesthetic half** (looks intentional, not templated) — from Anthropic's `frontend-design` discipline.
- **Conversion half** (structured persuasion, not a feature dump) — from Korean 상세페이지 / Wadiz practice.

This skill is the orchestrator. Depth lives in `references/` (load on demand). Scripts in `scripts/` render and screenshot pages so you critique pixels, not just code.

> **Paths:** every `scripts/…` and `references/…` reference below is relative to this skill's own folder. When this is installed as part of the **visigner** plugin, that folder is `${CLAUDE_PLUGIN_ROOT}/skills/detail-page` — run scripts from there (`cd "${CLAUDE_PLUGIN_ROOT}/skills/detail-page"`). The screenshot/capture/asset scripts need a one-time `npm install` of their deps; run **`/design-setup`** once (it installs Patchright + the Chromium browser into this skill folder). Pure design guidance (steps 1–4, 6) needs no install.

## The loop (never skip a step)

**This loop is the DEFAULT contract, not opt-in.** Writing an `*.html` page auto-fires the anti-slop grade — the plugin's `PostToolUse` hook (`hooks/auto-critique-hook.js` → `anti-ai-eval`) runs by default, with no manual call and no way to silently skip it. So you are never choosing *whether* to grade; you are iterating steps 4→5→6 to the ship gate. If a browser is installed the hook renders, captures, and hands tiles off to design-critic; you run steps 5→6 as the bounded iterate-to-gate loop. If it is NOT, the static grade still runs and you MUST say *pixel critique is OFF — run `/design-setup`* rather than pass off an unshot page as verified (the static-only caveat in §Setup tiers still applies — name what wasn't shot). And machine-clean is necessary, not sufficient: a page can clear every mechanical gate and still read as AI (that is exactly what §"Positive vocabulary" and the taste jury exist to catch) — carry the taste read, never stop at the machine pass.

```
1 BRIEF      → pin subject, audience, the ONE message, mode, platform/width
2 PLAN       → token system (color/type/layout/signature) — reject defaults BEFORE coding
3 STRUCTURE  → choose section arc for the mode (landing vs 상세/Wadiz) + benchmark modules
4 BUILD      → write code from the plan; pull components/palette/fonts via references/tooling.md
5 SHOOT      → render + screenshot the result (scripts/shoot.js); LOOK at the tiles
6 SCORE      → grade against references/review-rubric.md; if < gate, fix the lowest dims, go to 4
```
Do steps 1–3 mostly in your head/thinking; only show the user output once you have confidence it will delight them. Iterate 4→5→6 at least once before declaring done — "I reviewed the code and it looks right" is not allowed; a screenshot is.

**Step 2 (PLAN) is invalid without loading `references/planning-and-build.md`** — the plan must satisfy its mandatory gates (the Plan-completeness gate: an explicit COLOR COMMITMENT + PRODUCT-VISUAL LANGUAGE declaration) before step 4 (BUILD) may start. A build whose plan skipped them is ungated, not fast.

### Positive vocabulary — the "passes every gate but still looks AI" layer
A page can clear every gate in this skill and still read as AI, because **"be bold" has a generic answer**: in 2026 the highest-probability "bold" is mono-label eyebrows + acid-green-on-black + a ghost numeral + browser-chrome mockups — the skill's own bans just relocate the model to that *second* convergent look. The banned-defaults list is negatives; the cure is to steer with **nouns, per section**. Three additions carry the positive half:
- `references/anti-ai-tells.md` — the 21 current AI tells + the *positive counter* for each. Use it in the crit to check the **presence** of the specific technique you chose, not only the **absence** of banned defaults (that absence-only check is exactly what lets a rule-passing page still look AI).
- `references/design-lexicon.md` + `scripts/keyword-picker.js` — a 229-term cross-discipline keyword library (type/color/layout/motion/film/photo/branding/UI/KR-commerce/texture) and a picker that, given a section + target feeling, emits the concrete techniques to reach for and the AI-centre moves to avoid: `node scripts/keyword-picker.js plan --mode detail --moods "hook:awe; empathy:quiet; proof:credible,forensic; cta:urgent"` (or `pick --section proof --mood credible,forensic` for one slot).
- `references/design-process.md` — the interpret → direction → feeling → effect → detail reasoning pipeline that runs *inside* steps 1–4, assigning each section a **different** concrete keyword set (uniformity across sections is itself the strongest tell). Reach for it when a page "looks AI" despite passing, or on any high-stakes build.

**Setup tiers:** the lint + token gates (`brand-lint.js`, `build-tokens.js`, `STATIC=1` source pass) are **ZERO-SETUP** — pure Node, no install. The screenshot/axe loop (`shoot.js`) needs a one-time **`/design-setup`** (installs the browser), and the image-asset path (asset generation — `references/planning-and-build.md` step 4.5) needs that or a free `codex login`. So a **STATIC-only run** (no browser, no asset-gen) leaves these **UNVERIFIED**: rendered pixels/hierarchy/rhythm, 390px mobile overflow, axe a11y (contrast/labels), broken-asset gate, the motion/reduced-motion proofs, and any generated images — don't report a static pass as "looks right"; name what wasn't shot.

> **Load on demand:** For steps 1–4.5 (brief, token plan, structure, build, and asset generation), read `references/planning-and-build.md` when you reach those steps rather than loading it every time.

> **Load on demand:** For the complete screenshot, filmstrip, reduced-motion, and interaction-motion command reference, read `references/shoot-and-motion.md` when you reach step 5 rather than loading it every time.

## 6 · Score & iterate

Grade the page on the 10-dimension rubric in `references/review-rubric.md` (hook, structure, benefit-vs-feature, empathy, proof, one-message, visual craft, urgency/CTA, trust/risk-reversal, and — detail mode — story & rewards) **AND on the taste jury in `references/taste-jury.md`** (color-confidence, typographic sophistication, trend-currency, aesthetic ambition, composition, mood, finish). **Ship only when BOTH gates pass:** anti-slop (≥ 8/10 overall, no dim < 7, Aesthetic distinctiveness ≥ 8 with its color-confidence floor) AND taste (≥ 7.5 overall with color-confidence ≥ 7 and ambition ≥ 7). A page that passes anti-slop but reads as safe/colorless (the baseline users reject) does NOT ship — the taste gate exists precisely to catch it. Route MECHANICAL fails (390px overflow, faded scroll-reveal, broken asset) to fix-and-reshoot, not a terminal reject. If below either gate, fix the lowest-scoring dimensions across both panels and return to step 4. Before finishing, "remove one accessory" — cut the weakest decorative element.

Run the standalone conformance gates before shipping:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/anti-pattern-check.js" --page <built> --category <cat>
node "${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/build-honesty-check.js" <built> --recipe <recipe>
node "${CLAUDE_PLUGIN_ROOT}/scripts/smoke.js"
```
No recipe for the honesty check? State `RECIPE: NONE` in the report **with the reason** (librarian never ran / retrieval miss) — a missing recipe is a declared gap, never a silent skip. Treat every HIGH hit or unsupported number/label as a build failure. Surface manual anti-pattern rows as UNCHECKED, never passed. Pass the same `--category`, `--recipe`, and optional librarian `--grounding` file to `anti-ai-eval.js` for one folded report.

> **Load on demand:** When ultracode or an explicitly requested multi-agent workflow applies, read `references/ultracode-workflow.md` rather than loading it every time.

## References (load when you reach that step)
- `references/aesthetics.md` — full frontend-design method, banned defaults, Top-22 anti-slop rules, font/color systems.
- `references/anti-ai-tells.md` — the 21 current "still looks AI" tells (mono-label garnish, acid-green flood, ghost numeral, browser mockups, structural monotony…) each with its POSITIVE counter; the meta-insight (noun-space not adjective-space steering). Load whenever a page reads AI despite passing.
- `references/design-lexicon.md` — the 229-term cross-discipline keyword library + the Section × Feeling × Effect map. The concrete nouns you steer with. Machine copy: `scripts/design-lexicon.json`.
- `references/design-process.md` — the interpret → direction → feeling → effect → detail reasoning pipeline (runs inside steps 1–4); forces a different concrete keyword set per section.
- `references/korean-detailpage.md` — 상세페이지/Wadiz anatomy, PASONA, copy formulas, reward design, platform sizes, checklist.
- `references/tooling.md` — the 6 sites + exact install/embed commands and when to reach for each.
- `references/review-rubric.md` — pre-publish checklist + 10-dim scoring rubric + the ship gate (now with the color-confidence floor + the taste co-gate + the mechanical-vs-taste split).
- `references/taste-jury.md` — the contemporary-aesthetics panel (6 taste personas + a 7-axis aesthetic-ambition rubric: color-confidence, typography, trend-currency, ambition, composition, mood, finish). Runs ALONGSIDE the anti-slop rubric as an AND co-gate; catches the "passes anti-slop but safe/colorless/ugly" page.
- `references/color-forward-palettes.md` — named "impact-not-harmony" palettes, each mandating one saturated color field owning a section; the plan step's COLOR COMMITMENT picks from here. Counters the default drift toward timid monochrome.
- `references/wadiz-ai-digital-benchmark.md` — pixel-derived benchmark from Wadiz AI/digital product pages 400620 + 403454.
- `references/asset-generation.md` — generate real image assets (covers, scenes, deliverables walls) via `openai-responses` (free ChatGPT-OAuth Responses path) / gemini-3-pro-image / gpt-image-1.5; the 기획→제작→배치 flow, plan schema, Korean prompt rules.
- V2 grounding/conformance — `scripts/librarian-inject.js`, `scripts/build-honesty-check.js`, and repo-root `scripts/anti-pattern-check.js`; load their emitted evidence at plan/score time.
- `scripts/` — `shoot.js` (screenshot own output + assertion gates: 390px-overflow always, broken-asset always [`ASSETS=0` opts out], `AXE=1` a11y on desktop+mobile, `gate.report` rollup, `GATE_EXIT=1`), `capture-reference.js` + `capture-reference-patchright.js` (capture a reference page; Patchright variant for Wadiz/Akamai walls), `gen-plan.js` (기획: brief → asset plan) + `gen-assets.js` (제작: plan → real PNGs) + `lib-openai-responses.js` (the free ChatGPT-OAuth Responses+image_generation engine `gen-assets.js` calls), `brand-lint.js` (deterministic brand-governance gate — raw-hex/banned-font/AI-purple as machine checks), `keyword-picker.js` (the positive-vocabulary selection engine over `design-lexicon.json` — `plan`/`pick`/`search` emit concrete per-section keywords + the AI-centre moves to avoid), `build-tokens.js` (compile `tokens/*.tokens.json` → the starter's `:root{--brand-*}` / `@theme` layers), `view-capture.js` (build a one-click stitched HTML viewer from any capture dir), `ultracode-workflow.js` (the multi-agent workflow in `references/ultracode-workflow.md`), `README.md`. Saved reference captures (Wadiz 400620/403454, viewable anywhere): `references/captures/`.
- `tokens/` — DTCG design-token source of truth (`brand-default.tokens.json`) + `README.md`. The starter's `@theme` reads a `:root{--brand-*}` layer so overriding `--brand-*` under `[data-brand="…"]` re-themes the whole page (multi-brand); regenerate the layer with `build-tokens.js`.
