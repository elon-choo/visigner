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

```
1 BRIEF      → pin subject, audience, the ONE message, mode, platform/width
2 PLAN       → token system (color/type/layout/signature) — reject defaults BEFORE coding
3 STRUCTURE  → choose section arc for the mode (landing vs 상세/Wadiz) + benchmark modules
4 BUILD      → write code from the plan; pull components/palette/fonts via references/tooling.md
5 SHOOT      → render + screenshot the result (scripts/shoot.js); LOOK at the tiles
6 SCORE      → grade against references/review-rubric.md; if < gate, fix the lowest dims, go to 4
```
Do steps 1–3 mostly in your head/thinking; only show the user output once you have confidence it will delight them. Iterate 4→5→6 at least once before declaring done — "I reviewed the code and it looks right" is not allowed; a screenshot is.

**Setup tiers:** the lint + token gates (`brand-lint.js`, `build-tokens.js`, `STATIC=1` source pass) are **ZERO-SETUP** — pure Node, no install. The screenshot/axe loop (`shoot.js`) needs a one-time **`/design-setup`** (installs the browser), and the image-asset path (§4.5) needs that or a free `codex login`. So a **STATIC-only run** (no browser, no asset-gen) leaves these **UNVERIFIED**: rendered pixels/hierarchy/rhythm, 390px mobile overflow, axe a11y (contrast/labels), broken-asset gate, the motion/reduced-motion proofs, and any generated images — don't report a static pass as "looks right"; name what wasn't shot.

## 1 · Brief

If the brief is thin, pin it yourself and state your choice: one concrete **subject**, its **audience**, and the page's **single job** (the one action). Decide the **mode**:
- **Landing / web** — SaaS, app, portfolio, brand site. Western single-screen-first.
- **상세페이지 / Wadiz (detail mode)** — long vertical scroll, image-dominant, mobile-first, conversion-copy arc. Pick platform width: Wadiz/Naver **860px**, Coupang **780px**. → load `references/korean-detailpage.md`.

Also set two **Schwartz pre-flight** fields — they decide where the page *starts* (this is the planning lens PASONA alone lacks): **awareness** (unaware / problem-aware / solution-aware / product-aware / most-aware → sets the hero's opening block) and **sophistication** (1–5 → sets the claim style; at 4–5 a bare "best/strongest" is dead, pivot to mechanism or a new identity framing). Details + how they steer PASONA: `references/korean-detailpage.md`.

Ground every choice in the subject's own world — its materials, vocabulary, artifacts. That is where non-generic choices come from. Check memory for the user's prior preferences/brand.

**Scope:** plan for **quality only** — compliance (표시·광고법 / 추천·보증·뒷광고 claim substantiation) is intentionally the user's job, varying per platform/project. Don't add compliance gates to planning, prompts, or the rubric.

## 2 · Plan the token system (plan BEFORE code)

Produce a compact plan and challenge it before writing any markup:
- **Color** — 4–6 named hex values. One committed dominant + one sharp accent (60-30-10). The accent's 10% is reserved for the primary CTA / focal point.
- **COLOR COMMITMENT (mandatory)** — name the ONE section that floods a *saturated color field* (a whole band owning the viewport, type reversed out) and the risky-but-grounded pairing it commits to — **impact, not harmony.** A near-neutral page with color only on the CTA is the timid "no color" default users reject as ugly; 60-30-10 governs the accent, it does NOT license monochrome. Pick from `references/color-forward-palettes.md` or derive a grounded equivalent (at least one field at OKLCH chroma ≥ 0.12).
- **PRODUCT-VISUAL LANGUAGE (mandatory)** — declare EITHER oversized real/macro photography OR one committed illustration/diagram system; **glossy gradient/3D "app-icon" product blobs are banned** (the #1 fake-render tell).
- **Type** — a characterful **display** face + a complementary **body** face (+ a utility/mono face if data-heavy). High contrast pairing. Extreme weight contrast (100/200 vs 800/900), ≥3× size jumps.
- **Layout** — one-sentence concept + a quick ASCII wireframe. Not centered-everything.
- **Signature** — the single element this page is remembered by, embodying the brief. A committed saturated color field CAN be the signature.

Then **critique the plan**: re-derive what you'd produce for any similar brief; wherever your plan matches that generic default, change it and say why. Only build after the plan is provably specific to *this* brief. Full method + the banned-defaults list: `references/aesthetics.md`.

### Banned by default (override only if the brief explicitly asks)
- ❌ Inter / Roboto / Arial / Open Sans / Lato / system fonts. → pick from `references/aesthetics.md` / Fontshare.
- ❌ Purple→blue gradient on white. ❌ generic "AI purple/indigo" as the brand color. For AI/digital Wadiz pages, purple/blue is allowed only when grounded by concrete proof artifacts and secondary accents; see `references/wadiz-ai-digital-benchmark.md`.
- ❌ Everything centered. ❌ 3 equal feature cards with mismatched icons. ❌ emoji as icons/bullets.
- ❌ Uniform border-radius + soft shadow on every card. ❌ scattered micro-animations.
- ❌ Big-number-hero + supporting stats + gradient accent as the default hero (it's the template answer).
- ❌ Vague copy ("Build the future", "Empower / Unlock / Transform", two-noun feature titles).
- ❌ The three current AI-design clichés: cream `#F4F1EA`+serif+terracotta · near-black + acid-green · broadsheet hairline-rule layout — these are defaults, not choices.
- ❌ **Monochrome-timid palette** — a single-hue / near-neutral page with committed color only on the CTA. "No color" reads as fear, not restraint; it is the safe-but-ugly baseline this skill now hard-fails (see the color-confidence floor in `review-rubric.md`). Commit one saturated field. Restraint-mode (29CM near-mono) is legitimate ONLY with editorial layout + photography earning it.
- ❌ **Glossy gradient / 3D "app-icon" product blob** standing in for the product. Use real/macro photography or one consistent illustration/diagram language.
- ❌ **Scarcity theatre** — stacked discount-% badges + strikethrough + 선착순-counter chips pasted on every section. One credible, varied scarcity moment instead.

## 3 · Structure (section arc)

- **Detail mode (상세/Wadiz):** 후킹(hook, win 3s) → 공감(pain, customer's voice) → 해결책/메커니즘 → 특장점(benefit headline, feature as evidence; GIF for dynamic) → 사용 시나리오 → 스펙/상세 → 신뢰(numbers/certs, repeated mid-scroll) → 비교표 → 혜택/가격(Wadiz: reward tiers) → 일정/배송 → 메이커 스토리(Wadiz: move to front) → FAQ → 환불·교환 → 최종 CTA. Backbone = **PASONA**. Full template, copy formulas, reward ladder, sizes → `references/korean-detailpage.md`.
- **Wadiz AI/digital product mode:** if the product is AI education, templates, VOD, prompt packs, automation, Figma/PDF files, or creator/business education, also load `references/wadiz-ai-digital-benchmark.md`. The page must turn the digital product into visible artifacts: mockups, tool screens, before/after, proof screenshots, deliverables wall, curriculum, package economics.
- **Landing mode:** hero(subject-grounded thesis) → social proof → core value → feature sections(one repeated primitive) → stats → testimonials → pricing → FAQ → final CTA → footer. Primary CTA above the fold and repeated at each decision point.

## 4 · Build

Default stack: **HTML + Tailwind** for a self-contained artifact, or **React + Tailwind + shadcn/ui** for an app. Consume the Step-2 tokens as the single source of truth — define every color/font/shadow ONCE in a **Tailwind v4 `@theme` block** (OKLCH color ramps), which yields both CSS variables and utility classes so there is no parallel config to drift; no ad-hoc colors/fonts/spacing. 8pt spacing scale (4/8/12/16/24/32/48/64), hand-picked type scale, 3–4 named elevation tokens.

**Carry the plan's boldness INTO the build — it is the step where color commitment silently dies.** The plan step now mandates a COLOR COMMITMENT and a PRODUCT-VISUAL LANGUAGE, but a build left to its own gravity reverts to safe warm/cool-neutral bands and flat placeholder panels (observed: a plan committing a verdigris field + macro photography built out as 14/15 warm-monochrome sections with one quarantined teal band and empty gradient panels — passing the letter of the color floor while failing its intent). Enforce carry-through:
- **Hold the color position.** The committed saturated field must appear as a **load-bearing element in several sections** (full-bleed grounds, repeated band backgrounds, or a dominant surface) — NOT one quarantined band surrounded by neutral. Surrounding sections keep the color's *position* (tinted grounds, colored rules/headers) rather than reverting to bare neutral. A single fenced-off band caps Aesthetic distinctiveness at 7 (see `review-rubric.md`), so one band is not "done."
- **Actually SHOW the product.** For the hero + key product slots, **prefer generating real assets** (§4.5 `gen-assets.js`, free ChatGPT-OAuth path) over CSS mockups — CSS mockups systematically under-deliver as flat gradient/solid panels that read as unfinished placeholders. If you do use CSS panels, each must read as *finished*: a duotone-tinted macro texture with an actual focal subject and depth, never a bare gradient rectangle with a corner label. An empty panel loads fine (`assetsOk=true`) yet shows nothing — the rubric now fails it on tangibility.

**Pick the starter by MODE** — `assets/starter/` ships five non-slop scaffolds, each fully wired (`@tailwindcss/browser@4` + a full 8-axis `@theme`, distinctive non-banned font pairings, no banned defaults):
- **`index.html`** — Korean **상세페이지 / Wadiz** detail mode: the mobile sticky thumb-zone buy-bar, Pretendard + Black Han Sans.
- **`landing.html`** — Latin-first **western marketing/SaaS landing**: nav → hero thesis → social proof → value → features (ONE repeated `.card`) → pricing → FAQ (`<details>`) → final CTA → footer, one IntersectionObserver entrance. No Korean buy-bar. Fraunces + General Sans + JetBrains Mono (deliberately NOT Space Grotesk). The above-fold hero now uses a `.sig` "signature entrance" (`@keyframes sig-enter`, asymmetric spring-in / ease-out-exit) instead of the symmetric `.reveal`; below-fold sections still reveal via the IntersectionObserver `.reveal` path, and the global `* { animation:none }` reduced-motion rule gates it.
- **`app-shell.html`** — **product app shell**: sidebar + sticky topbar + a data table with four switchable states (data / loading-skeleton / empty / error). Token-driven DARK MODE via a pre-paint inline script (`data-theme` from `localStorage`/`prefers-color-scheme`, only the `--brand-*` NEUTRAL primitives re-declared under `[data-theme="dark"]`). Cabinet Grotesk + General Sans + JetBrains Mono; sidebar collapses to a topbar `<details>` below 860px, the table scrolls inside an `overflow-x:auto` wrapper.
- **`pricing.html`** — **plans / compare-tiers page** ("Cadence"): 3 tiers (recommended middle with focal accent CTA + ribbon/ring; a high-anchor decoy), a monthly↔annual segmented toggle that runs the per-tier discount math (monthly default works JS-off), and a comparison matrix with `position:sticky` thead + every cell state (check / "—" not-included / value / tinted recommended column). Ships the literal `tokens/brand-default.tokens.json` palette (warm-paper + green primary + reserved amber, on-accent=ink), so it passes `brand-lint --brand`. Bricolage Grotesque + Switzer + JetBrains Mono.
- **`settings.html`** — **account / settings / preferences screen** ("Northwind"): left section sub-nav (sticky desktop / horizontal scroll-row mobile, IntersectionObserver scroll-spy), ≤640px form column, and a save bar that is inert-in-flow when clean but floats+sticks via `html.js body.is-dirty` on first edit (degrades to always-visible JS-off). Every field state present — default / focus / disabled (SSO-managed) / read-only / error (`aria-invalid`+message). Cool-paper + slate-blue primary (hue 250, clear of the AI-purple band) + reserved deep-teal accent. Sora + Hanken Grotesk + JetBrains Mono.

`pricing.html` / `settings.html` are app/product screens — **ui-design** owns that craft; reach for them from a 상세/landing build only when the page needs a real pricing block or settings surface.

**Regenerate the `@theme`, don't copy it as-is.** All three `@theme` blocks carry the full 8 token axes (color, font, shadow, space, text, leading, radius, motion), and the scale axes are byte-identical to `node scripts/build-tokens.js tokens/brand-default.tokens.json --emit=theme`. So the canonical workflow is: **edit `tokens/*.tokens.json` → run `build-tokens.js --emit=theme` → paste the emitted scale block into the page's `@theme` (replacing the prior scale block)**, so the page and the DTCG source never drift. `node scripts/emit-tokens.js <page.html>` round-trips all 8 axes back into `tokens.json` + `spec.html` for the engineering handoff. (All three scaffolds avoid `<img>` — inline SVG icons + CSS — so the broken-asset gate stays clean by construction.) Source palette/fonts/components via `references/tooling.md` (Realtime Colors, Fontshare, HyperUI, Magic UI, Aceternity). **Korean pages: load a Korean webfont (Pretendard body + a KR display) — Fontshare/the aesthetics list are Latin-only; see `korean-detailpage.md`.** Make multi-column grids collapse to one column on mobile (responsive utilities, not bare inline `grid-template-columns`), and verify **zero horizontal overflow at 390px** (`shoot.js` reports `mobileOverflowPx`; fix the culprit, never mask with `overflow-x:hidden`). For detail/Wadiz pages add a **mobile sticky thumb-zone CTA** — a fixed bottom purchase bar (≤680px) that recaps price/benefit + one scarcity/deadline micro-line (마감 D-N / 남은 수량) + one ≥48px action whose `href` jumps to the reward/offer section (not `#`), honors `env(safe-area-inset-bottom)`, and reserves body padding so it never covers the last section. Quality floor, non-negotiable: responsive to mobile, visible keyboard focus, `prefers-reduced-motion` respected.

## 4.5 · Generate image assets (optional — turns CSS mockups into real Wadiz-grade images)

Real 상세페이지/Wadiz pages are image-dominant. When the brief wants photographic finish (not just CSS mockups), generate the page's image slots via the image-gen APIs, then place them. Three steps — **plan (기획) → make (제작) → place (배치)** — fully covered in `references/asset-generation.md`:
```bash
NODE_PATH=$(npm root -g) node scripts/gen-plan.js  brief.json asset-plan.json   # 기획: brief → 8–16 cohesive slots (or hand-author the plan)
NODE_PATH=$(npm root -g) node scripts/gen-assets.js asset-plan.json /tmp/<page>/assets  # 제작: real <id>.png + manifest.json
# 배치: replace each slot's CSS placeholder with <img src="assets/<id>.png" alt="…">, give panels a min-height, then re-shoot
```
Providers (set per-slot `provider` or env `IMG_PROVIDER`; all env-overridable):
- **`openai-responses`** (alias `gpt-oauth`) — **highest-end + free.** Responses API + built-in `image_generation` tool (model `gpt-5.4-mini`), so a reasoning model handles prompt fidelity and Korean typography before painting. Auto-default when a ChatGPT login (`~/.codex/auth.json`) exists: it uses that login for **free** generation and **bypasses the project key's missing gpt-image access**. Verified pixel-perfect Korean (e.g. gold-foil "7일 만에 작가되기"). Caveat: treats `size`/`aspect` as a *hint* — for exact aspect use `gemini`/`openai`. Per-slot `references:["/abs.png"]` enables product-consistent image-to-image.
- **`gemini`** — `gemini-3-pro-image` (Google — great Korean text + native aspect control; paid API key).
- **`openai`** — legacy `/v1/images` `gpt-image-1.5` (no `gpt-image-2` on that endpoint; paid API key).
- planner **`gpt-5.2`**. Keys from `~/.env`; OAuth login via `codex login`. No npm install (built-in `fetch`). Plan once, regenerate only weak slots, and **read every generated asset in the pixel loop** (generated text can misspell). CSS mockups remain the zero-cost fallback for slots you don't generate. Full detail: `references/asset-generation.md`.

## 5 · Shoot (look at the pixels — the PixelRAG step)

Render and screenshot your own output, then actually read the images:
```bash
${CLAUDE_PLUGIN_ROOT}/bin/shoot <file-or-url> [outDir]   # the short wrapper — resolves the global node_modules (Playwright/axe) + the script path
# fallback (no wrapper on PATH): NODE_PATH=$(npm root -g) node scripts/shoot.js <file-or-url> [outDir]
```
It saves a full-page PNG + viewport tiles. Read the tiles and critique what you SEE: hierarchy, rhythm, alignment, the banned-default tells, mobile legibility. To ground the design in a real reference first (competitor / exemplar), capture it the same way: `node scripts/capture-reference.js <url> [outDir]` or, for harder Wadiz/Akamai pages, `MAX_TILES=120 node scripts/capture-reference-patchright.js <url> [outDir]`. Reference captures are valid only when the output reports `coveredHeight >= pageHeight` or the page is intentionally capped. See `scripts/README.md`.

**Prove the motion, don't assert it** (all additive, flag-guarded — the default shoot and every existing gate are unchanged):
```bash
# Entrance filmstrip — now also captured at the 390px mobile context (filmstrip-mobile-*.png + run.json.motion.mobileFrames[]);
# the desktop strip (filmstrip-*.png / run.json.motion.frames) is unchanged.
FILMSTRIP=1 ${CLAUDE_PLUGIN_ROOT}/bin/shoot <file-or-url> [outDir]
# Reduced-motion HONESTY gate (implied by FILMSTRIP=1/MOTION=1): emulates prefers-reduced-motion:reduce, lets @media
# re-resolve, and asserts EVERY active transition/animation collapses to ~0. A @media(reduce) block that's a no-op
# duplicate FAILS (run.json.motion.reducedMotionHonored=false; offenders in reducedMotionOffenders[]) — the gate now
# ALSO fails on a still-running WAAPI/Framer animation under reduce (offender carries source:'waapi'), and SHOOTS
# reduced-motion-*.png frames as pixel proof (run.json.motion.reducedMotionFilmstrip[]). Adds gate check
# reducedMotion (severity block); honored=null (eval threw) reads as unknown and never silently passes.
REDUCED_MOTION=1 ${CLAUDE_PLUGIN_ROOT}/bin/shoot <file-or-url> [outDir]
# Interaction motion — films a ~600ms window around a triggered state, then runs the same layout-property audit
# (warns if a triggered element animates a layout prop) SCOPED to the triggered subtree. Records
# run.json.motion.interactions[]; gate check motionInteraction (severity warn) now reports pass:false (was
# vacuously true) when the trigger selector isn't found or captures no frames — detail adds `unproven=N`.
# Pipe-separate several; default event is click.
MOTION_TRIGGER='a:click|.menu:hover' ${CLAUDE_PLUGIN_ROOT}/bin/shoot <file-or-url> [outDir]
# SCROLL-into-view mode — MOTION_TRIGGER='scroll:<selector>' films the element OFF-screen, scrolls it into view, and
# captures pre + a ~600ms reveal window into interact-scroll_<sel>-*.png, running the SAME duration/easing/layout audit
# as a scroll-reveal. Still pipe-separable and still supports the 'selector:event' form above.
MOTION_TRIGGER='scroll:.reveal|a:click' ${CLAUDE_PLUGIN_ROOT}/bin/shoot <file-or-url> [outDir]
```
**Easing is now graded from real data.** `run.json.motion` carries `easings[]` — one `{sel, enter, exit, fn}` per animated element (resolved entrance/exit timing functions + the raw computed `fn`) — alongside the existing `durations[]`. The motion audit emits two easing reasons in `motion.warnings[]`: `linear-or-default-entrance` (entrance ease is `linear` or the CSS-default `cubic-bezier(0.25,0.1,0.25,1)`) and `no-enter-exit-asymmetry` (`enter===exit`, severity `warn`, never blocks — transitions are inherently symmetric so it fires broadly; informational). The off-token **duration band** is derived from the page's own `--dur-*`/`--duration-*` tokens unioned with the fallback `[120,150,200,250,320,400,700]` (now includes **150**), so a committed 150ms motion token no longer reads as off-token. The off-token **>600ms too-long** warning now EXEMPTS infinite/looping animations (`animation-iteration-count:infinite`, e.g. a skeleton pulse) — off-token-duration warnings still apply. **Script-generated WAAPI/Framer animations are captured too:** `run.json.motion.jsAnimations[]` records one `{sel,durationMs,easing,props,iterations,playState}` per entry from `document.getAnimations()` (script-generated only), on both the full-page audit and each `interactions[]` entry, so a JS-driven animation is graded with the same band/easing/layout rules as a CSS one. `design-critic MODE=motion` reads these fields directly.
**`STATIC=1` lint refined** (the no-browser source pass): raw-color now matches only valid 3/6/8-digit hex inside inline `style="…"` and Tailwind `[#…]` values (so visible text like order no. `#1042` no longer false-positives), plus three new checks surfaced in `run.json.static` — **block** `aiDefaultColors` (the AI-default hex families `#7c3aed/#6366f1/#8b5cf6/#a855f7/#4f46e5` + oklch/hsl purples in hue 270–310 with chroma ≥ 0.04) and **warns** `lowContrast` (naive <4.5 WCAG on inline color+bg pairs) and `structuralSlop` (centered ≥5 blocks · ≥3 sibling-equal cards · big-number hero) — the two new warns are non-blocking. **Four false-positive fixes:** (1) it now **strips HTML comments before every heuristic**, so `NOT Inter` in a comment no longer trips the banned-font check and a commented-out `<img>` no longer trips `imgMissingAlt`; (2) **banned-font detection is scoped to actual `font-family` declaration VALUES + font-CDN `family=` params with word boundaries**, so `Inter` inside `interface` no longer false-fails; (3) the `structuralSlop` **card counter only counts card-like class signatures** (a class carrying a `card`/`tile` token), so repeated utility classes like `text-muted`/`nav-item` are no longer miscounted as a card grid; (4) the **centered-everything count excludes heading elements (h1–h6)** — a centered `<h2>` is normal hierarchy, not the "center everything" tell.

## 6 · Score & iterate

Grade the page on the 10-dimension rubric in `references/review-rubric.md` (hook, structure, benefit-vs-feature, empathy, proof, one-message, visual craft, urgency/CTA, trust/risk-reversal, and — detail mode — story & rewards) **AND on the taste jury in `references/taste-jury.md`** (color-confidence, typographic sophistication, trend-currency, aesthetic ambition, composition, mood, finish). **Ship only when BOTH gates pass:** anti-slop (≥ 8/10 overall, no dim < 7, Aesthetic distinctiveness ≥ 8 with its color-confidence floor) AND taste (≥ 7.5 overall with color-confidence ≥ 7 and ambition ≥ 7). A page that passes anti-slop but reads as safe/colorless (the baseline users reject) does NOT ship — the taste gate exists precisely to catch it. Route MECHANICAL fails (390px overflow, faded scroll-reveal, broken asset) to fix-and-reshoot, not a terminal reject. If below either gate, fix the lowest-scoring dimensions across both panels and return to step 4. Before finishing, "remove one accessory" — cut the weakest decorative element.

## Running under ultracode (multi-agent workflow)

The loop above is single-agent. Under **ultracode** (the multi-agent Workflow runtime) — or whenever the user asks to "use a workflow" / fan this out — run the loop as a deterministic workflow instead, so plan candidates compete and every round still gates on **real screenshot pixels**:

```
Workflow({
  scriptPath: '${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/ultracode-workflow.js',
  args: { skillRoot: '${CLAUDE_PLUGIN_ROOT}/skills/detail-page',  // REQUIRED for portability (see note below)
          subject, brief, mode: 'detail'|'landing', platform: 'wadiz',
          category: 'ai-digital'|'physical'|'auto',
          outFile: '/tmp/detail-page/index.html',
          shotsDir: '/tmp/detail-page/shots', rounds: 3,
          // optional, all off by default:
          jury: 'advisory'|'strict',  // add a FREE cross-model (GPT/Gemini) vision second-opinion in Score
          claudeSeed: true,           // add 1 extra plan candidate seeded with the frontend-design directions
          govern: true,               // after the loop, enforce brand-lint + emit a SHIP/NO-SHIP enterprise report
          noEarlyStop: true }         // run all rounds even if a round stalls
})
```
(`args` may arrive as a JSON string via the Workflow tool — the script parses it; pass a real object regardless. **`skillRoot` is required:** the Workflow sandbox cannot resolve its own filesystem path, so the script points every subagent at the skill's scripts/references via the `skillRoot` you pass — set it to this skill's install dir, `${CLAUDE_PLUGIN_ROOT}/skills/detail-page`.)

It runs Plan (3 divergent token-system plans, +1 if `claudeSeed` → a design-director synthesis) → Build → Shoot (`scripts/shoot.js`, with `AXE=1` + the broken-asset/overflow gates) → Score (INDEPENDENT adversarial grade vs `review-rubric.md`, calibrated against the real captures; +cross-model jury if `jury`), iterating Build→Shoot→Score until the ship gate passes. It returns the **best** round (not merely the last) when the gate isn't met, and stops early on a genuine stall (unless `noEarlyStop`). With `govern`, a brand-lint failure blocks ship and the return adds `report` (enterprise-report path) + `brandClean`. Workflow subagents do **not** auto-load this skill, so the script points every agent at absolute paths built from the `skillRoot` you pass (above) — that is what makes it portable across machines. `category:'auto'` infers AI/digital from the brief and loads `wadiz-ai-digital-benchmark.md` + its extra gate. The workflow writes to `/tmp` by default; copy the final file into your project afterward. Workflow is gated on explicit opt-in — only launch it when ultracode is on or the user asked for orchestration; otherwise run the single-agent loop above.

## References (load when you reach that step)
- `references/aesthetics.md` — full frontend-design method, banned defaults, Top-20 anti-slop rules, font/color systems.
- `references/korean-detailpage.md` — 상세페이지/Wadiz anatomy, PASONA, copy formulas, reward design, platform sizes, checklist.
- `references/tooling.md` — the 6 sites + exact install/embed commands and when to reach for each.
- `references/review-rubric.md` — pre-publish checklist + 10-dim scoring rubric + the ship gate (now with the color-confidence floor + the taste co-gate + the mechanical-vs-taste split).
- `references/taste-jury.md` — the contemporary-aesthetics panel (6 taste personas + a 7-axis aesthetic-ambition rubric: color-confidence, typography, trend-currency, ambition, composition, mood, finish). Runs ALONGSIDE the anti-slop rubric as an AND co-gate; catches the "passes anti-slop but safe/colorless/ugly" page.
- `references/color-forward-palettes.md` — named "impact-not-harmony" palettes, each mandating one saturated color field owning a section; the plan step's COLOR COMMITMENT picks from here. Counters the default drift toward timid monochrome.
- `references/wadiz-ai-digital-benchmark.md` — pixel-derived benchmark from Wadiz AI/digital product pages 400620 + 403454.
- `references/asset-generation.md` — generate real image assets (covers, scenes, deliverables walls) via `openai-responses` (free ChatGPT-OAuth Responses path) / gemini-3-pro-image / gpt-image-1.5; the 기획→제작→배치 flow, plan schema, Korean prompt rules.
- `scripts/` — `shoot.js` (screenshot own output + assertion gates: 390px-overflow always, broken-asset always [`ASSETS=0` opts out], `AXE=1` a11y on desktop+mobile, `gate.report` rollup, `GATE_EXIT=1`), `capture-reference.js` + `capture-reference-patchright.js` (capture a reference page; Patchright variant for Wadiz/Akamai walls), `gen-plan.js` (기획: brief → asset plan) + `gen-assets.js` (제작: plan → real PNGs) + `lib-openai-responses.js` (the free ChatGPT-OAuth Responses+image_generation engine `gen-assets.js` calls), `brand-lint.js` (deterministic brand-governance gate — raw-hex/banned-font/AI-purple as machine checks), `build-tokens.js` (compile `tokens/*.tokens.json` → the starter's `:root{--brand-*}` / `@theme` layers), `view-capture.js` (build a one-click stitched HTML viewer from any capture dir), `ultracode-workflow.js` (the multi-agent workflow above), `README.md`. Saved reference captures (Wadiz 400620/403454, viewable anywhere): `references/captures/`.
- `tokens/` — DTCG design-token source of truth (`brand-default.tokens.json`) + `README.md`. The starter's `@theme` reads a `:root{--brand-*}` layer so overriding `--brand-*` under `[data-brand="…"]` re-themes the whole page (multi-brand); regenerate the layer with `build-tokens.js`.
