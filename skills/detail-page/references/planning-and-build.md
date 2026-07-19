## 1 · Brief

If the brief is thin, pin it yourself and state your choice: one concrete **subject**, its **audience**, and the page's **single job** (the one action). Decide the **mode**:
- **Landing / web** — SaaS, app, portfolio, brand site. Western single-screen-first.
- **상세페이지 / Wadiz (detail mode)** — long vertical scroll, image-dominant, mobile-first, conversion-copy arc. Pick platform width: Wadiz/Naver **860px**, Coupang **780px**. → load `references/korean-detailpage.md`.

Also set two **Schwartz pre-flight** fields — they decide where the page *starts* (this is the planning lens PASONA alone lacks): **awareness** (unaware / problem-aware / solution-aware / product-aware / most-aware → sets the hero's opening block) and **sophistication** (1–5 → sets the claim style; at 4–5 a bare "best/strongest" is dead, pivot to mechanism or a new identity framing). Details + how they steer PASONA: `references/korean-detailpage.md`.

Ground every choice in the subject's own world — its materials, vocabulary, artifacts. That is where non-generic choices come from. Check memory for the user's prior preferences/brand.

**Scope:** plan for **quality only** — compliance (표시·광고법 / 추천·보증·뒷광고 claim substantiation) is intentionally the user's job, varying per platform/project. Don't add compliance gates to planning, prompts, or the rubric.

## 2 · Plan the token system (plan BEFORE code)

Ground the plan before building:
```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/librarian-inject.js" '<brief-json>' --out <path>
```
Treat the emitted top exemplar, recipe grounding, and category reasoning sidecar (decision rules + anti-patterns) as the build's design contract. Honor a retrieval miss; never fabricate an exemplar or recipe.

Produce a compact plan and challenge it before writing any markup:
- **Color** — 4–6 named hex values. One committed dominant + one sharp accent (60-30-10). The accent's 10% is reserved for the primary CTA / focal point.
- **COLOR COMMITMENT (mandatory)** — name the ANCHOR section that floods a *saturated color field* (a whole band owning the viewport, type reversed out) AND the positions that hold that color across the rest of the scroll — tinted section grounds, repeated band backgrounds, or a dominant colored surface in several sections (NOT hairlines, section-number chips, or numerals, which the ship gate reads as "quarantined" and caps at 7). Commit to a risky-but-grounded pairing — **impact, not harmony.** A near-neutral page with color only on the CTA is the timid "no color" default users reject as ugly; 60-30-10 governs the accent, it does NOT license monochrome. Pick from `references/color-forward-palettes.md` or derive a grounded equivalent (at least one field at OKLCH chroma ≥ 0.12).
- **PRODUCT-VISUAL LANGUAGE (mandatory, subject-conditional)** — **glossy gradient/3D "app-icon" product blobs are banned** (the #1 fake-render tell). For a **physical/material subject whose desirability is its surface** (metal, wood, leather, ceramic, fabric, food), at least ONE real **material image** is *required* (macro photography or §4.5 asset-gen showing the actual surface/texture/patina); a committed illustration/diagram language may complement it but must NOT fully replace it — showing only line-blueprints of a brass tool while never showing the brass is a hole. For **abstract/digital subjects**, one committed illustration/diagram/screenshot system alone is fine. Thin line-art on a gradient as the ONLY product visual reads as empty on non-geometric subjects.
- **Type** — a characterful **display** face + a complementary **body** face (+ a utility/mono face if data-heavy). High contrast pairing. Extreme weight contrast (100/200 vs 800/900), ≥3× size jumps.
- **Layout** — one-sentence concept + a quick ASCII wireframe. Not centered-everything.
- **Signature** — the single element this page is remembered by, embodying the brief. A committed saturated color field CAN be the signature.

Then **critique the plan**: re-derive what you'd produce for any similar brief; wherever your plan matches that generic default, change it and say why. Only build after the plan is provably specific to *this* brief. Full method + the banned-defaults list: `references/aesthetics.md`.

**Plan-completeness gate.** The two `(mandatory)` fields above — COLOR COMMITMENT and PRODUCT-VISUAL LANGUAGE — are required parts of the plan, not optional prompts. If the plan omits either one, the plan is incomplete: do NOT proceed to build until both are explicitly declared. (This is why they are decided in the plan, before code — a build left to its own gravity silently reverts to safe neutral bands and default gradient panels.)

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
- **Hold the color position.** The committed saturated field must appear as a **load-bearing element in several sections** (full-bleed grounds, repeated band backgrounds, or a dominant surface) — NOT one quarantined band surrounded by neutral. Surrounding sections keep the color's *position* primarily through tinted grounds / colored surfaces; colored rules or headers alone do NOT clear the bar (the ship gate reads color surviving only as hairlines/chips/numerals as quarantine). A single fenced-off band caps Aesthetic distinctiveness at 7 (see `review-rubric.md`), so one band is not "done."
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

