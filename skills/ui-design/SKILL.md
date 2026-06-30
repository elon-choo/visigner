---
name: ui-design
description: Design and build PRODUCT UI that does NOT read as AI-generated — web apps, dashboards, SaaS, admin/internal tools, settings, data tables, forms, marketing sites, and individual components, plus their interaction/motion design. Auto-invoke whenever the task is app/product UI rather than a long-scroll sales page. Triggers (EN): "design a dashboard / admin panel / settings page / data table / form / modal / nav / sidebar / command palette", "build a SaaS UI", "design this component", "app screen", "empty state / loading / error state", "micro-interaction / motion / animation / transition", "make this UI less generic / less AI-looking", "design system component", "dark mode for this app". Triggers (KO): "대시보드/관리자 화면/어드민/설정 페이지/표(테이블)/폼/모달/네비게이션/사이드바/커맨드 팔레트 디자인", "SaaS UI 만들어줘", "이 컴포넌트 디자인", "앱 화면", "빈 상태/로딩/에러 상태", "마이크로 인터랙션/모션/애니메이션/전환", "이 UI 덜 뻔하게/AI 티 안 나게", "다크모드". Owns app chrome, component anatomy & states, interaction/motion, and the screenshot self-critique loop applied to product UI. NOT for long-scroll 상세페이지/Wadiz/landing sales pages → route to detail-page. For tokens/theming mechanics → design-system; for shipping the React/Tailwind code → frontend-build.
---

# UI Design — product UI that looks chosen, not generated

The job: app & component UI a skeptical senior designer cannot tell was AI-made. Same enemy as every skill in this suite — **distributional convergence**: with no negative constraints a model emits the generic center (the 4-stat-card + line-chart dashboard, every card same radius+shadow, Inter everywhere). You beat it the same way: plan a token system, critique it against the generic default, then build and grade from real pixels.

**Scope boundary (decide this first):**
- Long vertical scroll, image-dominant, one conversion action, PASONA/Wadiz arc → **NOT this skill. Use `detail-page`.**
- App chrome, returning users, dense data, many states, keyboard-driven → **this skill.**
- A marketing/home site for a product (hero + features + pricing, but interactive product UI feel) → this skill for the app-like sections; borrow `detail-page` only for a true sales scroll.

The aesthetic spine (token two-pass) and the screenshot loop are SHARED across the suite — invoke them, don't re-derive. Aesthetics: `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/references/aesthetics.md`. Loop: `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/shoot.js`. The loop needs a browser: run **`/design-setup`** once to install the headed-Chrome toolchain (pure design — steps 1–4 — needs no install), and always invoke shoot.js as `NODE_PATH=$(npm root -g) node …/shoot.js` so the global Playwright + the axe/visual-regression comparators resolve.

## The loop (never skip 5–6)

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

## 3 · Layout systems for app UI

**Navigation pattern — pick by IA depth, don't default to a sidebar:**

| Pattern | Use when | Spec |
|---|---|---|
| **Top bar only** | ≤5 destinations, content is the star (consumer, marketing-app) | 56–64px tall; logo left, nav center/left, account+actions right |
| **Left sidebar** | 6–20 destinations, tool-like, returning users | 240–280px expanded; collapsible to a **64px icon rail** below `lg` (1024px); active item = accent bar + filled icon, not just bold text |
| **Sidebar + sub-nav** | Deep IA (settings, consoles) | primary rail (64px) + contextual panel (220px); avoid 3 permanent columns of chrome |
| **Command palette (cmdk)** | Power tools — ALWAYS add as an accelerator, not the only nav | `⌘K` / `Ctrl+K`; the `cmdk` library (ships in shadcn `Command`); searchable actions + nav + recent |

**Responsive breakpoints (named px — Tailwind v4 defaults, plus app rules):** `sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536`. App-specific behavior: sidebar → icon rail or drawer below **1024 (lg)**; data tables → card list or horizontal-scroll-with-pinned-first-column below **768 (md)**; multi-pane → stacked below **md**; cap reading/content width at **`max-w-screen-xl` (1280) or a 1440 app frame** so a dashboard doesn't sprawl on a 27" monitor. Verify **zero horizontal overflow at 390px** (`shoot.js` reports `mobileOverflowPx`; fix the culprit, never `overflow-x:hidden`).

**Density modes** — offer where the persona lives in the tool (Linear/Gmail do): `comfortable` (row 48px, control 40px, body 14–16px) / `compact` (row 40px, control 36px, body 14px) / `condensed` (row 32px, control 32px, body 13px, tabular-nums). Drive with one `data-density` attribute over the token scale. Default consumer = comfortable; B2B console = compact.

**Content vs chrome:** chrome (nav, toolbars, side panels) must recede — lower contrast, neutral, quiet. The user's *data* is the highest-contrast thing on screen. If your chrome is more colorful than the content, invert it. Reserve the accent for action + current location only; an accent that appears 15 times marks nothing.

**Grid:** a 12-col fluid grid with a fixed gutter (16 or 24px); dashboards use a **bento/asymmetric tile grid** (varied tile spans encoding importance), NOT a uniform N×N of identical cards. One primary KPI tile may span 2× — earn it.

### Screen archetypes (pick the skeleton, then fill it)
| Archetype | Skeleton that isn't generic | First-thing-the-eye-hits |
|---|---|---|
| **Dashboard** | bento tiles by importance, one hero metric + its trend; supporting metrics smaller; max 1 large chart above the fold | the one number this persona opens the app to check |
| **List ↔ detail (master-detail)** | left list (virtualized), right detail pane; on `<md` push detail as a route/sheet | the selected item, not the list chrome |
| **Settings** | left sub-nav of sections + right form column ≤640px; section headers + helper text; sticky save bar only when dirty | the section the user came to change |
| **Onboarding / wizard** | one step per screen, visible progress, one primary action, escape hatch; never a 12-field wall | the single next action |
| **Auth** | the ONE place centering is right; single card, one field group, one CTA, no nav chrome | the form |
| **Data-table workspace** | toolbar (search + filters + bulk actions) above a TanStack table; row → sheet for detail | the rows; toolbar recedes |
| **Pricing / plan comparison** | 3 tier cards with ONE highlighted "Most popular" default (the decoy/center-stage default, see marketing-conversion §7) + a billing **segmented toggle** (monthly↔annual) that runs the **discount math** live (annual shown as monthly-equiv + "save N%") + a **comparison matrix** with a **sticky header row** so tier names stay pinned while scrolling features; cover every state — loading skeleton, current-plan badge, unavailable/`—`/"coming soon" cell, enterprise "contact us" | the recommended tier + its price, value stacked before the number |

**Ready-made seeds for two of these archetypes** — `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/assets/starter/` ships `pricing.html` (the **Pricing / plan comparison** archetype: 3 tiers + recommended decoy, monthly↔annual toggle with live discount math, sticky-header comparison matrix, every cell state) and `settings.html` (the **Settings** archetype: left section sub-nav with scroll-spy, ≤640px form column, dirty-only floating save bar, every field state incl. disabled/read-only/error). Both carry all 8 token axes, one orchestrated entrance + scroll reveals, and the reduced-motion / no-JS fallback — start from them when the screen IS a pricing or settings page rather than re-deriving the skeleton.

### Build scaffold (real commands — frontend-build owns the deeper code work)
```bash
npx shadcn@latest init                    # Tailwind v4 + RSC; choose a NON-default base color, then overwrite it with your @theme
npx shadcn@latest add button input select dialog sheet drawer dropdown-menu \
    command popover tooltip table form sonner skeleton tabs badge switch
npm i motion @tanstack/react-table @tanstack/react-virtual react-hook-form zod
npm i recharts            # or: npm i @tremor/react   (KPI dashboards)
npm i @phosphor-icons/react   # icons — never emoji
```
Then REPLACE shadcn's default tokens with your Step-2 `@theme` block — the stock zinc/neutral + default radius is exactly the generic center you're avoiding. Minimal app `@theme` shape (tint the neutrals, commit motion + semantic tints):
```css
@theme {
  --color-surface: oklch(.99 .004 250); --color-surface-2: oklch(.97 .006 250);
  --color-ink: oklch(.22 .02 260);      --color-muted: oklch(.55 .02 260);
  --color-accent: oklch(.58 .17 255);   --color-accent-fg: oklch(.99 0 0);
  --color-success: oklch(.62 .15 150);  --color-success-bg: oklch(.96 .03 150);
  --color-danger:  oklch(.58 .19 25);   --color-danger-bg:  oklch(.96 .04 25);
  --radius-input: 8px; --radius-card: 12px;
  --shadow-e1: 0 1px 2px oklch(.2 .02 260/.06); --shadow-e2: 0 4px 12px oklch(.2 .02 260/.10);
  --ease-out: cubic-bezier(0,0,.2,1); --dur-fast: 150ms; --dur-base: 250ms;
  --font-ui: "General Sans", system-ui; --font-num: "IBM Plex Mono", monospace;
}
```

## 4 · Component anatomy & states

**The rule that kills the most slop: every interactive component is a STATE MACHINE, not a picture.** AI output ships the default state and forgets the other seven. Enumerate and build all of:

`default · hover · focus-visible · active/pressed · disabled · loading · empty · error · (selected · read-only where relevant)`

### Per-component state checklist (build + screenshot each)
- [ ] **Button** — default / hover / focus-visible (visible ring, `:focus-visible` only, never `outline:none` alone) / active / disabled (not just opacity-50 — also `cursor-not-allowed`, no hover) / **loading** (spinner replaces label, width held so layout doesn't jump, `aria-busy`)
- [ ] **Input / Select / Textarea** — default / focus (accent ring) / filled / disabled / read-only / **error** (danger border + message + `aria-invalid`) / with helper text. Label is always present (placeholder ≠ label).
- [ ] **Form** — inline validation on blur (not on every keystroke, not only on submit); errors summarized + focus moved to first invalid; submit shows loading + disables to block double-post; success is an explicit confirmation. Use **react-hook-form + zod** + shadcn `Form`.
- [ ] **Table** — header (sortable affordance + active sort indicator) / sticky header on scroll / zebra OR row-hover (pick one) / row selection (checkbox + selected style + bulk action bar) / **empty** / **loading skeleton rows** (not a centered spinner over blank) / error / pagination OR infinite scroll (not both) / responsive (pin first column or collapse to cards <768). Logic via **@tanstack/react-table** (headless); never hand-roll sort/filter/virtualize. Virtualize beyond ~100 rows (`@tanstack/react-virtual`).
- [ ] **Modal / Dialog / Sheet** — focus trap, return focus to trigger on close, `Esc` + backdrop close, scroll lock, `role="dialog"` + `aria-labelledby`. Use **Radix Dialog** (shadcn). Right-side **Sheet** for edit/detail flows; center **Dialog** for confirm/short tasks; **Drawer** (Vaul) for mobile bottom sheets. Destructive confirms name the consequence ("Delete 3 projects"), never "Are you sure?".
- [ ] **Toast** — **sonner**; success/info auto-dismiss ~4s, errors persist with a manual close + retry action. Toasts are for *async results out of view* — NOT for validation (inline), NOT for primary content, NOT one per field.
- [ ] **Empty state** — an invitation, not a void: one line of what-this-is, one primary action, optional illustration. Distinguish "no data yet" (onboarding tone) from "no results" (clear-filter tone). This is the highest-leverage non-slop surface in any app.
- [ ] **Loading** — skeletons that match final layout for content; inline spinners for actions; **optimistic UI** for fast mutations (apply immediately, roll back on error). Never a full-screen spinner for a partial update.
- [ ] **Dropdown / Popover / Tooltip / Combobox** — Radix primitives; keyboard nav, typeahead, controlled open. Tooltips never carry essential info (not keyboard/touch reachable).
- [ ] **Data viz** — **Recharts** default, **Tremor** for quick KPI dashboards, **visx/D3** when bespoke. Rules: max ~5 series before switching encoding; color encodes a categorical/semantic meaning (not decoration); always axis labels + units; a chart has its OWN empty + loading + no-data states; never a pie chart for >5 slices or for precise comparison.

### Generate a coherent first-party icon set (no icon dependency)
When the brief wants an *owned* icon family instead of Phosphor/Lucide, generate one from a small spec — deterministic, license-clear, all glyphs sharing one grid / stroke / caps:
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/icon-set.js [spec.json] [out-dir]
# no spec → the WHOLE 39-icon library (real product-UI set: nav arrows/chevrons, minus/close, trash, download/upload,
#   share/copy/edit, external-link/link, filter, eye, play, info, warning, clock, calendar, cart, + the original core)
# narrow it: --icons=a,b,c  (or spec.icons:[…]) emits just those
# spec (all optional): { grid:24, stroke:1.75, radius:2, icons:[…] }  ·  flags --grid= --stroke= --radius= --icons=a,b,c override spec values
```
It emits one `<icon>.svg` per icon (shared `viewBox 0 0 <grid> <grid>`, identical stroke-width, round caps/joins, per-icon optical-size correction) plus **`icon-grid.html`** — a self-contained verification sheet showing every icon at 16/24/32px on light + dark that `shoot.js` renders with `gate.report.overall:true`. The library grew from 15 to **39** hand-drawn glyphs on the same 24-grid / stroke-1.75 / radius-2 system, and `DEFAULT_ICONS` now defaults to the whole library — so a bare `node icon-set.js <out>` emits all 39 for a real product UI rather than a curated dozen; pass `--icons=…` to scope it. Unknown names are skipped with a WARN (the run still succeeds if ≥1 icon is valid). Extend the family by adding a `(radius)=>inner-SVG` entry to `LIBRARY` drawn on the 24-unit grid (an in-file "HOW TO ADD A LIBRARY ENTRY" recipe documents the 5 steps); register new glyphs in `DEFAULT_ICONS` so the bare command emits them. Still **one** family per UI — don't mix the generated set with Phosphor.

## 5 · Motion & micro-interaction

Motion is interaction feedback and spatial continuity — not decoration. **One orchestrated moment beats ten scattered micro-animations** (scattered animation is itself an AI tell). Library: **`motion`** (Framer Motion) for React; CSS transitions for simple hover/focus. The canonical motion discipline (tokens, enter≠exit, transform/opacity-only, banned defaults) is shared via `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/references/aesthetics.md §Motion`; this section carries the React/app-state depth on top of it.

**Duration + easing tokens (commit these, reuse everywhere):**
```
--ease-out:      cubic-bezier(0.0, 0.0, 0.2, 1)   /* enters, most UI */
--ease-in:       cubic-bezier(0.4, 0.0, 1.0, 1)   /* exits */
--ease-standard: cubic-bezier(0.4, 0.0, 0.2, 1)   /* move/resize on screen */
--ease-emphasized: cubic-bezier(0.2, 0.0, 0, 1)   /* one signature moment */
--dur-instant: 100ms   /* hover, press, color */
--dur-fast:    150ms   /* most state changes — the workhorse */
--dur-base:    250ms   /* enter: dropdown, popover, toast */
--dur-slow:    400ms   /* large surfaces: modal, sheet, route */
```
Heuristics: small/near elements move faster, large/far surfaces slower. **Enter `ease-out` (decelerate in), exit `ease-in` (accelerate out)**, and exits are ~30% faster than enters. Anything over 400ms in an app feels broken — reserve >400ms for exactly one signature/empty-state moment.

**Patterns that earn their place:**
- **Layout animation** for list reorder / add / remove — Framer `layout` + `AnimatePresence`. This is the one motion that meaningfully reduces cognitive load; spend budget here.
```jsx
import { motion, AnimatePresence } from "motion/react"
<AnimatePresence mode="popLayout">
  {items.map(i => (
    <motion.li key={i.id} layout
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }} />
  ))}
</AnimatePresence>
```
- **Spring for anything the user drags/moves** (`stiffness: 400, damping: 30`); **tween/duration** for fades and discrete state.
- **Shared-element / `layoutId`** for expand-from-card → modal continuity (one premium moment).
- **Micro-feedback**: press scales to `0.97` over 100ms; toggles/checkboxes animate the mark, not the whole row.

**ALWAYS honor reduced motion** (non-negotiable accessibility floor):
```css
@media (prefers-reduced-motion: reduce){ *,::before,::after{ animation-duration:.01ms!important; transition-duration:.01ms!important } }
```
In React: `const reduce = useReducedMotion()` then drop transforms, keep opacity-only. Reduced motion means *no large transforms/parallax*, not *no feedback* — keep the state change instant and visible.

**Prove the motion from pixels, don't just assert it** — `shoot.js` now *verifies* this section instead of taking your word for it:
```bash
ROOT=${CLAUDE_PLUGIN_ROOT}/skills/detail-page
# REDUCED_MOTION=1 → emulates prefers-reduced-motion:reduce, re-resolves @media, and FAILS the run if any active
# transition/animation doesn't collapse to ~0 (a no-op @media(reduce) block is the common bug) — it now ALSO fails
# on a still-running WAAPI/Framer animation under reduce (offender carries source:'waapi'), and SHOOTS
# reduced-motion-*.png frames as pixel proof (run.json.motion.reducedMotionFilmstrip[]). Gate check reducedMotion
# (block); offenders land in run.json.motion.reducedMotionOffenders[].
REDUCED_MOTION=1 NODE_PATH=$(npm root -g) node $ROOT/scripts/shoot.js <url> [out]
# MOTION_TRIGGER='selector:event' → films a ~600ms window around a triggered state (hover/click/focus), SCOPES the
# audit to the triggered subtree, and warns if a triggered element animates a LAYOUT property (the jank ban above),
# not transform/opacity. The motionInteraction gate now reports pass:false (was vacuously true) when the trigger
# selector isn't found or films no frames (detail adds `unproven=N`) — a quietly-missing trigger no longer passes.
MOTION_TRIGGER='button:click|[data-row]:hover' NODE_PATH=$(npm root -g) node $ROOT/scripts/shoot.js <url> [out]
# MOTION_TRIGGER='scroll:<selector>' → scrolls the element into view and films pre + a ~600ms reveal window
# (interact-scroll_<sel>-*.png), running the same duration/easing/layout audit — for scroll-revealed sections.
MOTION_TRIGGER='scroll:.reveal|button:click' NODE_PATH=$(npm root -g) node $ROOT/scripts/shoot.js <url> [out]
# FILMSTRIP=1 captures the orchestrated entrance at desktop AND 390px (filmstrip-mobile-*.png) so the "one moment" is screenshot-visible.
```
Run `REDUCED_MOTION=1` before ship so the reduced-motion floor is machine-proven; use `MOTION_TRIGGER` to catch a dropdown/toggle quietly animating `width`/`height`/`top` instead of `transform`. **Easing is now machine-graded** — `run.json.motion.easings[]` records `{sel, enter, exit, fn}` per animated element, and `motion.warnings[]` flags `linear-or-default-entrance` (a flat/default entrance ease) and `no-enter-exit-asymmetry` (`enter===exit`, a non-blocking `warn`). The off-token duration band derives from the page's own `--dur-*` tokens unioned with `[120,150,200,250,320,400,700]`, so your committed motion tokens read as in-band, and the >600ms too-long warning now EXEMPTS infinite/looping animations (a skeleton pulse no longer reads as off-token). **Script-driven motion is captured too** — `run.json.motion.jsAnimations[]` logs one `{sel,durationMs,easing,props,iterations,playState}` per `document.getAnimations()` entry (Framer/WAAPI, script-generated only), on the full-page audit and each interaction, so a `motion`/Framer animation is graded by the same band/easing/layout rules as a CSS transition. `design-critic MODE=motion` grades from these fields.

### Motion BANNED defaults
- ❌ Everything fades/slides in on scroll (whole-page `AOS`-style reveal) — it screams template.
- ❌ Bouncy spring on everything (overshoot on a dropdown reads as a toy, not a tool).
- ❌ Parallax backgrounds / mouse-follow gradients in a productivity app.
- ❌ Animating layout-affecting properties (`width`/`height`/`top`/`margin`) instead of `transform`/`opacity` → jank. Animate transform & opacity; use `layout` for size.
- ❌ Spinners for sub-200ms work (flash), or a full-page spinner for a partial update (use a skeleton/optimistic update).
- ❌ Staggered entrance on data rows the user re-sees every visit — delight on first paint becomes friction on the 50th.

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
