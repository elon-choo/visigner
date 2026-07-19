---
name: brand-identity
description: >-
  Turn a business or product into a coherent brand — strategy first (positioning, audience/JTBD, archetype, values, a one-line brand idea), then a verbal identity (voice & tone, messaging hierarchy, naming, tagline, lexicon) and a visual identity (logo direction, strategy-grounded color, type system, imagery/illustration art direction, iconography, motion & sonic signature), packaged as brand tokens + a guidelines doc that every other design skill applies. Auto-invoke when the task is about a BRAND as a system, not a single screen: "make a brand / brand identity / branding", "brand strategy", "positioning", "naming / name my company / product name", "tagline / slogan", "brand voice / tone of voice", "logo direction / brand mark / wordmark", "brand guidelines / brand book / 브랜드 가이드라인", "brand values / mission / personality / archetype", "rebrand / refresh our brand", "make this feel like a real brand, not generic"; Korean: "브랜드 만들어줘", "브랜딩", "포지셔닝", "네이밍 / 이름 지어줘", "슬로건 / 태그라인", "브랜드 보이스 / 톤앤매너", "로고 컨셉 / 로고 방향", "브랜드 아이덴티티", "브랜드 무드", "리브랜딩". Owns the source-of-truth brand system; hands tokens to design-system, and on-brand application to ui-design, detail-page, frontend-build, and marketing-conversion. NOT for building a specific page or app screen (use detail-page / ui-design) — this defines the rules those skills obey.
---

# Brand Identity — strategy → verbal & visual system

A brand is not a logo. It is the **smallest set of decisions** that makes every future artifact predictable: a stranger who has seen three of your touchpoints can guess the fourth. The deliverable here is that decision set — strategy at the core, verbal and visual systems wrapped around it, compiled into **tokens + a guidelines doc** the rest of the suite consumes. The failure mode to beat is the same one detail-page fights — **distributional convergence**: asked for "a brand", a model emits the high-probability center (swoosh mark, purple gradient, "we're passionate about innovation", a thesaurus-mashup name). Every step below pushes *away* from that center with named choices and negative constraints.

Build strategy → verbal → visual in that order. Visual decisions you make before strategy are decoration; you will redo them. Do steps 1–3 mostly in thinking; only surface the strategy to the user once it is provably specific to *this* business.

## The brand-build loop (never skip a step)

```
1 INTAKE    → the business reality: what's sold, to whom, against whom, the founder's conviction, constraints (name? legacy assets? markets/languages?)
2 STRATEGY  → positioning (5 fields) + audience & JTBD + archetype (1 primary + 1 secondary) + 3–5 values + a positioning statement + the ONE-LINE brand idea
3 VERBAL    → voice (3–4 traits, each with do/don't) + messaging hierarchy (one-liner→elevator→boilerplate) + naming/tagline + lexicon (words we own / ban)
4 VISUAL    → DIRECT the logo + a strategy-grounded color system + type system + imagery/illustration art direction + iconography + motion & sonic signature
5 SYSTEM    → compile to brand.tokens.json (DTCG) + write the guidelines doc (brand book structure below)
6 APPLY+VERIFY → flow tokens into design-system → ui-design/detail-page/frontend-build; run the coherence checklist + the competitor side-by-side; gate with design-critic
```
Iterate: if VERIFY (step 6) fails the "covers the logo, still us?" test, the gap is almost always upstream in STRATEGY, not in the hex values — go back to 2, not 4.

---

> **Load on demand:** For the complete steps 1–5 brand-building playbook, read `references/brand-building-playbook.md` when you reach those steps rather than loading it every time.

## 6 · Apply + Verify

### Apply — one source flows everywhere
```
brand.tokens.json  →  design-system  (compiles primitives→semantic, themes, dark mode, dev handoff)
        │                    │
        │                    ├─→  ui-design        (app/web UI obeys brand tokens & voice)
        │                    ├─→  detail-page       (hero thesis from messaging hierarchy; palette/type from tokens)
        │                    └─→  frontend-build     (Tailwind v4 @theme reads the SAME tokens; motion tokens)
        └─────────────────────→  marketing-conversion (copy obeys voice, lexicon, messaging hierarchy)
```
Never hand a downstream skill a loose hex or a vibe — hand it the tokens + the guidelines section it needs. If a page needs a color/voice not in the system, that's a **strategy gap**, fixed here, not patched downstream.

### BANNED — the generic-brand tells (override only with an explicit, stated reason)
- ❌ The **meaningless swoosh / generic abstract mark** that says nothing about the business — a mark must encode an idea, not "motion/connectivity in general".
- ❌ **"We're passionate about innovation / empowering people / world-class solutions"** voice — passes the swap test for any company = says nothing.
- ❌ The **AI-purple→blue gradient** as the brand color (the convergence default; aesthetics.md). Purple is earned only by a Magician strategy + concrete proof, not by reflex.
- ❌ **Archetype-less mood-boarding** — pretty tiles with no strategic spine; the board must serve the chosen archetype pair.
- ❌ A **palette with no dominant** (5 equal pastels) — no focal color, nothing owned.
- ❌ **Stock-photo handshake / laughing-laptop-team / lens-flare** imagery.
- ❌ **Thesaurus-mashup / dropped-vowel / two-noun-glue** naming.
- ❌ **Values that aren't trade-offs** ("Quality", "Integrity") and a **tagline that survives the swap test**.
- ❌ Treating the **logo as the brand** — shipping a mark with no voice, no system, no application rules.
- ❌ **Auto-traced raster shipped as the final logo** — `@neplex/vectorizer`/`potrace` output is a draft to redraw on the grid, never the deliverable (jagged anchors, no optical correction).
- ❌ A **logo that fails mono or knockout** — if it needs its colors/gradient to be readable, or breaks reversed on the brand surface, it isn't a logo yet.

### VERIFY — brand coherence checklist (gates "done")
- [ ] **Cover-the-logo test:** hide the wordmark across 3 touchpoints (a screen, a social tile, an email) — can you still tell it's the same brand from color/type/voice/imagery alone? If no, the system is too thin.
- [ ] **Competitor side-by-side:** place your hero/mark beside the 2 real alternatives from intake — capture their live sites and view the stitched tiles next to yours:
  ```bash
  ROOT=${CLAUDE_PLUGIN_ROOT}/skills/detail-page
  NODE_PATH=$(npm root -g) node $ROOT/scripts/capture-reference.js https://competitor-a.com /tmp/brand/ref-a
  MAX_TILES=120 NODE_PATH=$(npm root -g) node $ROOT/scripts/capture-reference-patchright.js https://competitor-b.com /tmp/brand/ref-b   # for 403/Akamai walls
  ```
  Does yours read as a *deliberate, different* point of view, or as the same category template? Name the specific tell that distinguishes you — if you can't, it's not differentiated.
- [ ] **Swap test (verbal):** the tagline and the one-liner are false when a competitor's name is substituted.
- [ ] **One-author test:** read the one-liner, an error message, and the boilerplate back to back — same person talking? Voice traits visibly present, banned lexicon absent.
- [ ] **Strategy traceability:** every visual choice maps to a strategy line (color→archetype, type→voice, signature→brand idea). Decoration with no strategic parent is cut.
- [ ] **Token integrity:** `brand.tokens.json` exists, the chosen color/type reached the **design-system** primitive layer (that skill expands your single hue into the OKLCH ramp and runs the canonical `build-tokens.js` compile — you don't run it on this strategy-view file), and a downstream artifact (a detail-page hero or a ui-design screen) renders fully from those tokens with **no loose hex/font** — prove it on the built page:
  ```bash
  node ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/brand-lint.js <built-page.html>   # rawColorsOutsideTheme must read 0; exits 1 on raw-hex / banned-font / ai-purple
  ```
- [ ] **On-brand check is data-driven, not eyeballed:** run `brand-lint` in **`--brand` semantic mode** plus the **lexicon** — it maps the page's declared token colors to your DTCG roles **by literal role name**, diffs with an OKLab ΔE (off-tolerance color = `off-brand-color` ERROR), and reads the **voice.json** `{owned,banned}` against visible copy (banned term = ERROR, missing owned term = WARN), so "does it use OUR color and OUR words" is machine-verified, not a vibe. It prints one `on-brand: yes|no — <evidence>` line:
  ```bash
  node ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/brand-lint.js <built-page.html> --brand <compiled.tokens.json> --lexicon voice.json
  ```
  **Point `--brand` at the design-system-COMPILED token file, NOT the strategy-view `brand.tokens.json` from §5.** Matching is literal role-name (`primary-700` ↔ the page's `--brand-primary-700`); there is no `primary → primary-700` fuzzy expansion. The §5 strategy file carries **bare** roles (`primary`, `accent`) and is the *input* design-system expands — pass it to `--brand` and you get a truthful-but-useless `on-brand: yes — 0/0 declared colors` (zero page tokens named `primary` match the page's numbered ramp). Pass the **expanded numbered-ramp** file whose role names equal the page's `--brand-*`/`--color-*` declarations — e.g. `skills/detail-page/tokens/brand-default.tokens.json` (`color.primary.700`, `color.accent.500`, …) scores 14/14 against the compiled starter. (A zero-role brand file is now a LOUD `brand-unreadable` ERROR + nonzero exit, never a silent `0/0` pass — but a non-zero-role file that simply doesn't *name-match* the page is the 0/0 case this note prevents.) Export the lexicon (§3) as `voice.json {"owned":[…],"banned":[…]}` so this check and **marketing-conversion**'s `email-lint --lexicon` share one source of voice truth.
- [ ] **Accessibility floor:** primary/accent on their backgrounds clear WCAG AA (4.5:1 text) — run the suite's **a11y-auditor** agent (or `AXE=1 node $ROOT/scripts/shoot.js <page>`, `axe.gatingCount` must be 0 at serious/critical); logo legible at 24px mono.
- [ ] **Independent critique:** spawn the **design-critic** agent (generator/evaluator split — the agent that critiques must not be the one that built it) for an anti-slop + distinctiveness pass against the rubric before declaring the brand done. For the **logo mark specifically**, run **design-critic `MODE=logo`** — unlike its other non-pixel modes it DOES re-render (re-shoots the candidate through `logo-grid.html` for the 9-cell size×color matrix), then grades five craft dimensions 1–10 (anchor economy · optical overshoot · sidebearings/spacing · stroke-contrast consistency · survival at 24px/mono/knockout). It FAILs if `gate.report.overall !== true`, the mark collapses in the min/mono/knockout row, **construction-grid guides leaked into the shipped SVG**, or any craft dimension < 6 — elevating "usable" to verified "good". (Note `logo-grid.html` lives under `skills/brand-identity/assets/`, not detail-page.)

Before finishing, "remove one accessory" (aesthetics.md): cut the weakest brand element so the strongest carries the identity. A brand that tries to say five things says none.
