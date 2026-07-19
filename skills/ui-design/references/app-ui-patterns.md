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

