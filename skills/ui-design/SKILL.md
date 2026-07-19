---
name: ui-design
description: >-
  Design and build PRODUCT UI that does NOT read as AI-generated — web apps, dashboards, SaaS, admin/internal tools, settings, data tables, forms, marketing sites, and individual components, plus their interaction/motion design. Auto-invoke whenever the task is app/product UI rather than a long-scroll sales page. Triggers (EN): "design a dashboard / admin panel / settings page / data table / form / modal / nav / sidebar / command palette", "build a SaaS UI", "design this component", "app screen", "empty state / loading / error state", "micro-interaction / motion / animation / transition", "make this UI less generic / less AI-looking", "design system component", "dark mode for this app". Triggers (KO): "대시보드/관리자 화면/어드민/설정 페이지/표(테이블)/폼/모달/네비게이션/사이드바/커맨드 팔레트 디자인", "SaaS UI 만들어줘", "이 컴포넌트 디자인", "앱 화면", "빈 상태/로딩/에러 상태", "마이크로 인터랙션/모션/애니메이션/전환", "이 UI 덜 뻔하게/AI 티 안 나게", "다크모드". Owns app chrome, component anatomy & states, interaction/motion, and the screenshot self-critique loop applied to product UI. NOT for long-scroll 상세페이지/Wadiz/landing sales pages → route to detail-page. For tokens/theming mechanics → design-system; for shipping the React/Tailwind code → frontend-build.
---

# UI Design — product UI that looks chosen, not generated

The job: app & component UI a skeptical senior designer cannot tell was AI-made. Same enemy as every skill in this suite — **distributional convergence**: with no negative constraints a model emits the generic center (the 4-stat-card + line-chart dashboard, every card same radius+shadow, Inter everywhere). You beat it the same way: plan a token system, critique it against the generic default, then build and grade from real pixels.

**Scope boundary (decide this first):**
- Long vertical scroll, image-dominant, one conversion action, PASONA/Wadiz arc → **NOT this skill. Use `detail-page`.**
- App chrome, returning users, dense data, many states, keyboard-driven → **this skill.**
- A marketing/home site for a product (hero + features + pricing, but interactive product UI feel) → this skill for the app-like sections; borrow `detail-page` only for a true sales scroll.

The aesthetic spine (token two-pass) and the screenshot loop are SHARED across the suite — invoke them, don't re-derive. Aesthetics: `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/references/aesthetics.md`. Loop: `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/shoot.js`. The loop needs a browser: run **`/design-setup`** once to install the headed-Chrome toolchain (pure design — steps 1–4 — needs no install), and always invoke shoot.js as `NODE_PATH=$(npm root -g) node …/shoot.js` so the global Playwright + the axe/visual-regression comparators resolve.

## The loop (never skip 5–6)

**This loop is the DEFAULT contract, not opt-in.** Writing an `*.html` screen auto-fires the anti-slop grade — the plugin's `PostToolUse` hook (`hooks/auto-critique-hook.js` → `anti-ai-eval`) runs by default, with no manual call and no way to silently skip it. You are never deciding *whether* to grade; you are iterating 4→5→6 to the ship gate, shooting every state. If a browser is installed the hook renders, captures, and hands tiles off to design-critic; you run steps 5→6 as the bounded iterate-to-gate loop. If it is NOT, the static grade still runs and you MUST say *pixel critique is OFF — run `/design-setup`* rather than report an unshot screen as verified. Machine-clean is necessary, not sufficient — a screen can pass the tell-count cap and still look generic, so grade the tiles and the states, never stop at the machine pass.

```
1 BRIEF      → app type, primary persona, the ONE job per screen, density target, platform widths
2 TOKENS     → token system via aesthetics.md two-pass (color/type/space/elevation/radius/motion); critique vs the generic dashboard BEFORE coding
3 LAYOUT     → nav pattern + grid + density + the screen's content/chrome split + component list with EVERY state enumerated
4 BUILD      → React + Tailwind v4 @theme + shadcn/ui (→ frontend-build owns the code mechanics); Radix/cmdk/sonner/TanStack as below
5 SHOOT      → NODE_PATH=$(npm root -g) node ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/shoot.js <url> ; LOOK at tiles at desktop AND 390px
6 SCORE      → grade vs §VERIFY + review-rubric.md anti-slop; capture EACH non-default state; if < gate, fix lowest, →4
```
Do 1–3 in thinking. Iterate 4→5→6 at least once. "The code looks right" is not allowed — a screenshot of every state is. For app UI you must shoot the **states**, not just the happy path: an empty table and a loading skeleton are where AI-slop hides.

## 1 · Brief

Pin yourself if thin, then state it: **app type** (analytics dashboard / CRUD admin / settings / onboarding / B2B console / consumer app), **primary persona** (does this person live in the tool 6h/day, or visit monthly? — that decides density), the **single job** of each screen (a screen with two equal jobs has none), **density target** (see §3), and **platform** (responsive web ≥360px / desktop-app fixed ≥1024 / tablet). Returning-power-user tools earn keyboard shortcuts, a command palette, and compact density; first-touch consumer screens earn whitespace and one obvious action. Ground choices in the product's real domain vocabulary and data shapes — the same anti-generic move as detail-page's "ground it in the subject."

## 2 · Token system (use the two-pass, don't re-derive it)

Run the **two-pass method** from `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/references/aesthetics.md`: plan a compact token system, then critique it — wherever your plan equals what you'd produce for *any* dashboard, change it and say why. Tokens you must commit before code (define ONCE in a Tailwind v4 `@theme` block → both CSS vars and utilities; for multi-brand/dark-mode mechanics defer to **design-system**):

| Token group | App-UI specifics (not the page-design defaults) |
|---|---|
| **Color** | A near-neutral surface ramp (the app is mostly chrome) + ONE accent reserved for primary action & active nav. App neutrals are rarely pure gray — tint them (cool slate, warm stone). Semantic set required: `success / warning / danger / info`, each with a low-chroma surface tint for backgrounds, not just the saturated text color. |
| **Type** | One characterful UI sans + a **tabular/mono** for numbers, IDs, code, timestamps (`font-variant-numeric: tabular-nums` on every column of figures). Smaller scale than marketing: 12/13/14/16/20/24/30 carries most apps; 14px is the workhorse body, 13px dense. |
| **Space** | 8pt grid, but apps need the 4px half-step for dense control internals. Control padding ≠ section padding. |
| **Radius** | Pick a radius *system*, 2–3 steps (e.g. `4 / 8 / 12`), and apply by element role (inputs share one, cards another) — NOT one radius on literally everything. |
| **Elevation** | 3–4 shadow tokens by role: `e1` resting card, `e2` dropdown/popover, `e3` modal/dialog. In dark mode, elevation is a lighter surface, not a bigger shadow. |
| **Motion** | Duration + easing tokens up front (see §Motion). Motion is a token group, not an afterthought. |

> **Load on demand:** For the complete app layout/archetype, component-state/icon, and motion/micro-interaction pattern library, read `references/app-ui-patterns.md` when you reach steps 3–5 rather than loading it every time.

## 6 · Dark mode & theming

Apps usually ship light + dark. Mechanics live in **design-system** — here, the discipline: dark mode is a **separate token set, never `filter: invert`**. Don't reuse light shadows (use lighter elevated surfaces); reduce saturation of accents in dark (vivid light-mode colors vibrate on dark); maintain the SAME contrast ratios. Drive via `class="dark"` / `[data-theme]` over the `@theme` tokens (Tailwind v4 `@variant dark`). Test EVERY component in both — a focus ring or disabled state invisible in dark is a real bug. Multi-brand/runtime theming → defer to **design-system**.

**Turnkey in both starters (zero markup edits to re-theme).** `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/assets/starter/index.html` now ships an active `[data-theme="dark"]` block (re-declares the neutral primitives + lifted primary/accent + heavier elevation, AA-safe — 0 axe contrast violations light or dark), a 44px `#themeToggle`, and a pre-paint restore script (`localStorage` key `page-theme`, stored choice only so the default render stays light); `app-shell.html` already shipped active dark + a toggle. Setting `document.documentElement.dataset.theme="dark"` re-themes the whole page. **Multi-brand is equally turnkey:** compile the shipped second brand `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/tokens/brand-alt.tokens.json` (a deliberately non-purple cobalt+coral DTCG override) into a `[data-brand="alt"]` block and set `data-brand="alt"` to reskin — mechanics in **design-system**.

## BANNED defaults for app UI (override only if the brief demands)
- ❌ The generic dashboard: 4 equal stat cards in a row above one line chart. Plan a real information hierarchy — what does this persona check first?
- ❌ Every card identical radius + identical soft shadow + identical padding → a wall of sameness. Vary by role; concentrate emphasis.
- ❌ Centered everything. App content is scannable left-aligned; center only genuinely short, standalone messages (empty states, auth cards).
- ❌ **Inter / Roboto / system-ui** as the type choice (it's the AI-default app font). Pick from `aesthetics.md` (Geist, General Sans, IBM Plex, Switzer…) + a tabular face for numbers.
- ❌ Emoji as icons/bullets. One real icon set: **Phosphor / Lucide / Radix Icons**, consistent weight/size.
- ❌ Unearned purple/indigo as the brand/accent; purple→blue gradient buttons; glowing gradient CTAs. One committed accent; solid or a *restrained* tint.
- ❌ Gradient on every button/badge/avatar. Reserve gradient for at most one focal surface.
- ❌ Toasts for everything (validation, confirmations, content). Inline validation; explicit confirmation; toast only for out-of-view async results.
- ❌ A spinner as the entire empty/loading experience. Skeletons + real empty states.
- ❌ Placeholder-as-label inputs; `outline:none` with no replacement focus style; disabled buttons with no reason shown.
- ❌ The three AI-design clichés (cream+serif+terracotta · near-black+acid-green · broadsheet hairline) — defaults, not choices.

## VERIFY — checklist + ship gate

Run AFTER shooting. Grade the **tiles**, not the code. Reuse the anti-slop audit in `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/references/review-rubric.md` §A; this is the app-UI adaptation. Any §A fail blocks ship.

**A · Anti-slop + craft (pass/fail):**
- [ ] No Inter/Roboto/system as the type choice; distinctive UI sans + tabular numerals actually loading.
- [ ] No unearned purple; accent appears only on action + active state; chrome recedes, data is highest-contrast.
- [ ] Not the 4-stat-card + line-chart template; real hierarchy / bento with earned spans.
- [ ] Cards/surfaces are NOT all one radius+shadow+padding; emphasis concentrated.
- [ ] One real icon set, no emoji; layout has ≥1 intentional asymmetry, not centered-everything.
- [ ] 8pt rhythm holds; type steps visibly distinct; tabular-nums on every numeric column.
- [ ] **Every interactive component shows all states** — screenshot proof of default/hover/focus-visible/active/disabled/loading + empty/error for containers. (The big one for app UI.)
- [ ] Motion: ONE orchestrated moment max; durations within tokens (≤400ms); enter ease-out / exit ease-in; no scroll-fade-everything, no parallax, no animating layout props.
- [ ] Both light and dark mode verified per component (focus + disabled visible in both).
- [ ] **Distinctiveness is capped by a deterministic tell-count, not vibe** — run `NODE_PATH=$(npm root -g) node ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/tell-count.js <file|url>`; it measures the uniform-grid / centered-everything / monotone-accent tells from computed styles and returns a `distinctivenessCap`. It now **reads OKLCH** (and `color()`/`lab()`/`hsl()`/named colors) — every CSS color serialization is normalized to RGBA via an offscreen canvas before bucketing, so the accent tells score correctly on an OKLCH starter instead of silently reading 0. The **centered-text tell counts centered PROSE only** (`centeredTextBlocks`, descriptions now say "centered prose blocks"): comparison-matrix `td`/`th` cells, button/link control labels, sub-24-char short labels/figures, and bounded numeric/value tokens are excluded, and the caps were raised (`>=6` soft-cap 7, `>=9` strong-cap 6) — so a legit centered data table no longer over-fires. The **monotone-accent tell requires `distinctAccents <= 1`** (was `<=2`), so the recommended primary + 1 reserved-accent 2-color palette isn't flagged as monotone. Net: the suite starters pass their own gate (per-starter `distinctivenessCap` — pricing 10, settings 10, app-shell 10, landing 7, where landing's 7 is the pre-existing 3-identical-card uniform-grid tell, not centered/accent); none are NO-SHIP'd (cap 6) anymore. The aesthetic-distinctiveness score — graded by **design-critic `MODE=ui`** against the app-UI captures in `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/references/captures/app-ui/{linear,stripe,vercel,raycast}/`, NOT the Wadiz pair — may not exceed that cap.

**B · Accessibility floor** (the real check belongs to **a11y-auditor** + `frontend-build`; this is the gate):
- [ ] **Visible focus** on every interactive element (`:focus-visible` ring, ≥2px, contrast ≥3:1 vs adjacent).
- [ ] **Contrast**: text ≥4.5:1 (≥3:1 for ≥24px/bold), UI/graphics ≥3:1. Run `AXE=1 NODE_PATH=$(npm root -g) node ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/shoot.js …` — `axe.gatingCount` >0 at serious/critical is a fail. (The color-contrast suggestion now reads "needs 4.5:1", names the resolved `--color-*` token when one matches the offending fg, and no longer proposes pure-black oklch.)
- [ ] **Keyboard**: full tab order, logical sequence, no traps; modal traps+restores focus; `⌘K`/menus/combobox keyboard-operable; visible skip-to-content for heavy chrome.
- [ ] **Semantics**: real `<button>`/`<a>`/`<nav>`/`<table>`; `aria-current` on active nav; `aria-invalid`+`aria-describedby` on errored fields; `aria-busy` on loading; live region for toasts.
- [ ] **Touch targets ≥44×44px** (WCAG 2.5.5); ≥24px is the AA floor.
- [ ] No horizontal overflow at 390px (`mobileOverflowPx` ≤1); no broken assets (`gate.assetsOk`).

**Ship gate:** zero §A/§B fails AND score ≥ 8/10 on review-rubric.md §B with no dimension < 7 — treating **Aesthetic distinctiveness** (does it look made for THIS product, with one memorable signature) as the highest-leverage dimension; never ship distinctiveness < 8. The **generator/evaluator split** applies: whoever built it must not be sole grader — for the strongest pass, re-render the live file and grade states from pixels. If below gate: fix the 2–3 lowest, re-shoot every affected state, re-score. Before done, "remove one accessory" — cut the loudest decorative element so the data wins.

## How this fits the suite
- **detail-page** — long-scroll sales/상세/Wadiz pages, conversion-copy arc, image-asset generation. Route there for selling; come here for the app.
- **design-system** — the token/theming/dark-mode mechanics, multi-brand, dev handoff. This skill *consumes* a token system; design-system *produces and governs* it.
- **frontend-build** — turns this design into production React/Next + Tailwind v4 + shadcn/ui, owns responsive/a11y implementation and the verify-by-screenshot wiring (run `/design-setup` once to install the headed-Chrome toolchain `shoot.js` drives).
- **ux-flows** — the flows/IA/wireframes/acceptance-criteria that should precede a screen design.
- **marketing-conversion** — funnel/CRO/copy for the app's growth surfaces.
- Agents: **design-critic** (independent anti-slop + conversion critique), **a11y-auditor** (WCAG audit), **design-director** (art direction). Use design-critic as the independent evaluator in step 6.
