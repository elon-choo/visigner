# Design process — interpret → direction → feeling → effect → detail

The skill's core loop (SKILL.md "The loop") tells you WHAT to produce (a token plan, a section arc, a scored page). This file is the **reasoning pipeline** that runs *inside* steps 1–4 — the sequence a human art director actually follows to get from a request to a page that reads as *authored*, not sampled.

**Why it exists.** A model told "design a landing page, be bold, commit color" samples the high-probability centre of "bold web design" — which in 2025–2026 *is* the AI look (mono-label garnish, acid-green flood, ghost numerals, browser-chrome mockups, one uniform house style for every section). The page passes every banned-defaults check and still reads AI, because **"be bold" has a generic answer.** The cure is to force a *specific* decision at each stage, and above all to give **each section a different concrete keyword set** (`scripts/keyword-picker.js` + `references/design-lexicon.md`) instead of one blanket style. Uniformity across sections is itself the tell — see `references/anti-ai-tells.md`.

> Run stages 1–6 in thinking; only show output once you're confident it will delight. The artifact each stage must produce is what stops you from skipping ahead to code, where boldness silently dies.

---

## The nine stages

Each stage lists its **goal**, the **artifact** it must produce before you proceed, and where **concrete keywords** enter. Do not advance with a stage's artifact missing — a missing artifact is where the page reverts to the generic centre.

### 1 · Interpret the request (해석)
- **Goal:** extract the real job, not the literal one. What must the reader DO, FEEL, and BELIEVE by the end? What is the subject's own world — its materials, vocabulary, artifacts, proof?
- **Artifact:** one line each — *the one action*, *the one feeling*, *the one belief to install*; plus the two Schwartz fields (awareness, sophistication → `korean-detailpage.md`) that decide where the page STARTS.
- **Keywords enter:** none yet — but note the subject's concrete nouns (a webinar → "라이브 현장", "출연자", "리허설", "방송 큐시트"). These are where non-generic imagery/type choices will later come from. Placeholder vocabulary → placeholder design.

### 2 · Decide the direction that matches the intent (방향성)
- **Goal:** pick ONE creative direction — a concept the whole page expresses — that fits the intent. Not "modern and clean" (that's the centre); a *stance* ("a broadcast control-room the reader is invited into", "a field notebook of one maker's 22 years", "a trading terminal for attention").
- **Artifact:** a **one-sentence concept statement** + a 3-word mood triple (e.g. `urgent · editorial · insider`). The mood triple is the controlled vocabulary the picker reads (`node scripts/keyword-picker.js moods`).
- **Keywords enter:** the mood triple is your first concrete commitment. Reject the first direction you think of — it is usually the average. Name what a *different* brief would get, and diverge.

### 3 · Big-picture plan (큰 그림 기획)
- **Goal:** commit the page-level system BEFORE sections: the COLOR COMMITMENT (one saturated field + where it recurs — `color-forward-palettes.md`), the PRODUCT-VISUAL LANGUAGE (real material image vs one illustration system — `aesthetics.md`), the type pairing, and the single **signature** the page is remembered by.
- **Artifact:** the Step-2 token plan from SKILL.md, with COLOR COMMITMENT and PRODUCT-VISUAL LANGUAGE explicitly declared (the plan-completeness gate).
- **Keywords enter:** pull color/type keywords from the lexicon's `color` and `typography` domains, chosen to serve the concept — not the safe-distinctive default (acid-green, Space Grotesk). If your palette/type could belong to any brief in this category, it is a default; change it.

### 4 · Divide into sections (섹션 구분)
- **Goal:** lay out the section arc for the mode (detail = `korean-detailpage.md` 14-part arc / collapsed 5-block; landing = SKILL.md §3). Map each section to its conversion job (hook / empathy / mechanism / proof / product / story / offer / CTA / faq).
- **Artifact:** the ordered section list with each section's one-line job, entry point set by the Schwartz awareness field.
- **Keywords enter:** this is the spine `keyword-picker.js plan --mode detail` walks. Each section key here becomes a slot that gets its OWN keyword set in stages 5–6.

### 5 · Decide the feeling each section must produce (섹션별 느낌)
- **Goal:** assign each section a **target feeling** — the emotional register it must hit for its job. The hook and the CTA do NOT feel the same; proof feels different from story. This is the step most builds skip, which is why every section ends up looking identical.
- **Artifact:** a per-section feeling map: `hook → urgent+visceral`, `empathy → intimate+uneasy`, `mechanism → clear+confident`, `proof → credible+concrete`, `offer → generous+decisive`, `cta → urgent+reassuring`, etc. Use the mood vocabulary so the picker can read it.
- **Keywords enter:** feelings are the query. `keyword-picker.js pick --section proof --mood credible,concrete` returns the concrete effects that PRODUCE that feeling.

### 6 · Choose the effects that create each feeling (효과 선택)
- **Goal:** for each (section, feeling), pick the **named techniques** that produce it — from type, color, layout, motion, film-grammar, photography, material-texture. This is the heart: *a feeling is abstract; an effect is buildable.* "Urgent" is a wish; "condensed grotesque at 12rem + a scrub-linked count-up + a duotone-red photographic ground" is a build order.
- **Artifact:** an **effect manifest** — for every section, 3–6 concrete keywords + the ONE signature move + the explicit "avoid" list (the AI-centre moves for that slot). Generate the skeleton with:
  ```bash
  node scripts/keyword-picker.js plan --mode detail \
    --moods "hook:urgent,visceral; empathy:intimate; proof:credible,concrete; offer:generous; cta:urgent,reassuring"
  ```
  Then curate: keep what serves the concept, cut the rest, and make sure **no two sections share the same effect set** (that uniformity is the house-style tell).
- **Keywords enter:** fully — this stage's output IS the concrete vocabulary the build consumes. Cross-check every pick against `references/anti-ai-tells.md`: if a chosen effect is on the tell list (mono-label garnish, ghost numeral, browser-chrome mockup, uniform outline chip), replace it with the positive counter.

### 7 · Plan it for real (실제 기획)
- **Goal:** turn the effect manifest into a concrete build spec — the ASCII wireframe per section, the `@theme` tokens, the asset slots (which need real generated images vs CSS), the copy skeleton (PASONA / hook→proof→CTA).
- **Artifact:** the buildable plan: wireframes + `@theme` + asset-plan (`gen-plan.js` if generating images) + copy outline. Every section's spec carries its effect keywords from stage 6, so the build can't drift back to neutral.
- **Asset anchor block (PR-02 · 팔레트 락):** every generated-image prompt starts with the same shared anchor block: (1) palette lock — name ground/ink/accent as exact color names + hex values and forbid dominant colors outside that set; (2) material lock — repeat the page material system verbatim, e.g. `uncoated paper + 3–6% grain`; (3) world anchor — one sentence from the Brand world describing era/place/props; (4) prop sheet — recurring objects such as booklets, stamps, folders, tickets are defined once by color/material/shape and copied unchanged into every prompt. Do not re-describe the same object differently per asset.
- **Page silhouette precheck (PR-05):** before building, make a full-page thumbnail strip from the wireframes and squint it. Section heights and density must visibly differ; any viewport with ~40% empty area must name the job of that emptiness (`margin drama`, `whitespace-as-asset`, or isolating one focal element) before code starts.
- **Keywords enter:** as annotations on the wireframe — each block labelled with the effect it executes, so the build is a transcription, not a fresh invention.

### 8 · Evaluate the plan (평가) — before building
- **Goal:** critique the PLAN against the brief (aesthetics.md Pass 2) and against the tells. Re-derive what you'd produce for any similar brief; wherever the plan matches that generic answer, it's a default — change it. Check: does each section have a *distinct* feeling+effect set? Is the color commitment structural, not quarantined? Is the product actually SHOWN?
- **Artifact:** a short pass/revise note per section; the plan only proceeds to build when it is provably specific to *this* brief and *no two sections are stylistically interchangeable*.
- **Presence measurement rule (contract ③):** chosen effects count as present only when their visual existence can be pointed to in tiles, crops, or interaction frames. `data-kw` comments, hidden keyword spans, class names, filenames, or manifest text are **not evidence** (`data-kw 주석 불인정`). For each signature keyword, write the tile number, viewport, and visible pixels that prove it. If an evaluator cannot circle the effect in the rendered output, mark it ABSENT before scoring.
- **Offer-fact repetition budget (PR-03 · plan level):** fields such as date, time, format, seat cap, price, cost, and deadline may appear as a full set (3+ fields together) at most twice per page — usually once in the offer ledger and once in the final CTA. Sticky bars are allowed outside the count only as a compressed 1–2 field reminder. Any other recurrence must become a single field or a different device (`folio line`, sentence, table); repeated `label:value` stacks are a revise trigger.
- **Keywords enter:** as the audit lens — "this section's keywords are the category default" is a revise trigger.

### 9 · Detailed design & the pixel loop (세부 디자인)
- **Goal:** build from the plan (SKILL.md §4), then SHOOT (`scripts/shoot.js`) and SCORE against BOTH gates (`review-rubric.md` anti-slop + `taste-jury.md` taste). Iterate build→shoot→score.
- **Artifact:** the rendered page + tile screenshots + the two gate scores; ship only when both pass.
- **Manifest-vs-build gate (PR-01 · 조항별 대조):** immediately after SHOOT, before rubric scoring, compare every Effect Manifest row against the rendered tiles. For each clause, tag it as REQUIRED, QUALIFIER, or BANNED; write the expected tile number + tile coordinate first. A REQUIRED clause with no tile coordinate is automatically ABSENT. Score each clause as PRESENT-AS-SPECIFIED, DEGRADED, or VIOLATED/ABSENT. Numeric and material qualifiers must be measured on pixels: `asymmetric diptych 70/30` means container widths must stay clearly beyond a 60/40 minimum; `real scanned hand annotation` must show wobbly stroke quality and non-typeset baseline drift; `vermilion stamp impression` must show ink spread/pressure variation in a 200% crop, not a uniform vector ring. Motion clauses require presence plus at least two intermediate scroll/interaction frames. Source annotations are never enough: `data-kw`/class names prove intent only, not implementation. Gate rule: any VIOLATED clause blocks; DEGRADED clauses enter the fix list and must be re-shot.
- **Cross-asset continuity pass (PR-02 · 세계관/팔레트):** before final composition, place all generated/shot assets on one contact sheet. Check: (1) dominant colors stay inside the declared ground/ink/accent families; any palette-outsider dominant hue fails that asset; (2) recurring props read as the same object across assets; (3) signature materials such as stamp ink keep the same texture in desktop and mobile; (4) lighting temperament is consistently hard or soft across the set. A reviewer must be able to answer from the contact sheet alone: "were these assets excerpted from one world?" If no, name the failed axis and regenerate.
- **Offer-fact repetition budget (PR-03 · tile count):** make a tile-wide table with columns `field set`, `tile`, `style signature`, and `value string`. Full offer-fact sets appearing 3+ times fail when they share the same typography/label structure/alignment. All repeated values must use one notation system; `저녁 8:30-10:30` and `20:30-22:30` mixed on the same page fails even if the times are equivalent.
- **Caption-frame alignment crit (PR-04 · 캡션-프레임 정합):** for every image caption, label, and credit, inspect a 200% crop. PASS when the text box does not cross the photo frame, mat, or border. If it crosses, the overlap must be declared in the manifest as `cross-gutter overlap` and every character must remain fully legible; undeclared boundary crossing or a single clipped/low-contrast character fails. Caption style and placement rule must be consistent page-wide: inside the mat or outside the mat, not both by accident.
- **Whitespace-intent crit (PR-05 · 스퀸트):** judge each viewport/tile after a standardized squint (Gaussian blur around σ≈8px, or shrink to 10% and scale back). In one second, a single #1 focal element must remain obvious and visibly heavier than #2. If two foci compete or nothing remains, fail. If the largest continuous empty area exceeds roughly 40% of the viewport, it must either isolate the #1 focal element or be declared in the manifest as `margin drama`/`whitespace-as-asset`; otherwise it is unfinished space. Rails/meta lists also fail when item gaps exceed 3× item height without a joining device such as a rule, folio line, or dot leader.
- **Keywords enter:** as the fix language — when a dimension scores low, the picker + lexicon give the concrete move to raise it ("Aesthetic distinctiveness 6 → proof section is flat equal cards; swap for `layered evidence objects + cast-shadow still-life`"). Before declaring done, "remove one accessory" — cut the weakest decorative element.

---

## Worked micro-example — one webinar landing, section by section

The failure this process prevents: every section built as `green header band + mono label + letter-square + flat content`. The fix is a **different concrete register per section**:

| Section | Feeling | Concrete effects (from the lexicon) | Avoid (AI centre) |
|---|---|---|---|
| **Hook / hero** | urgent · insider | oversized condensed display headline; a real broadcast/desk photograph as duotone ground; one hot accent on the deadline | ghost outline numeral, mono eyebrow, acid-green flood |
| **Empathy / 공감** | intimate · uneasy | tight editorial measure, first-person pull-quotes set as marginalia; low-key muted ground; hand-set em-dashes | boxed persona chips in a row, mono tags |
| **Mechanism / 해결** | clear · confident | a single explanatory diagram with real hierarchy; asymmetric split (text left / diagram right); 200ms mask-reveal | three equal cards, browser-chrome mockup |
| **Proof / 증명** | credible · concrete | attributed reviews as layered evidence objects with cast shadow; real screenshots at an angle, not flat framed | flat framed Notion screenshot repeated, stat-trio |
| **Offer / 가격** | generous · decisive | value-anchoring layout, one bold price figure at display scale, reward ladder with real weight contrast | rainbow discount badges, strikethrough theatre |
| **CTA** | urgent · reassuring | sticky thumb-zone bar, one deadline micro-line, focal accent fill, risk-reversal adjacent | repeated identical button on every band |

Each row pulls from a *different* domain of the lexicon, so the page has internal variation — the single strongest signal that a human, not a template, made decisions.

---

## Where this sits in the skill
- Runs inside SKILL.md steps **1–4**; stage 9 is the existing shoot/score loop (steps 5–6).
- Feelings & effects are chosen from `references/design-lexicon.md` via `scripts/keyword-picker.js`.
- The AI-centre moves each stage must avoid are catalogued in `references/anti-ai-tells.md`.
- After SHOOT and before scoring, stage 9 now runs the PR-01 manifest-vs-build gate, PR-02 continuity pass, PR-03 repetition budget, PR-04 caption-frame check, and PR-05 whitespace-intent crit.
- Color commitment → `references/color-forward-palettes.md`; grading → `references/review-rubric.md` + `references/taste-jury.md`.
