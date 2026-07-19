# Build-Recipe — Linear-class hero + first section (dark product-UI landing)

> **What this is.** A self-contained, execute-directly recipe. You (the builder) have NEVER seen the
> original page and will NOT get its screenshots, URL, or DOM. Everything you need to reproduce the
> design is in this file. Build the SAME page from the SAME content below — this isolates "did the
> recipe transfer the *design logic*" from "did the content differ."
> **Every value below is measured**, not invented: `[styles]` = `captures/app-ui/linear/styles.json`
> (real computed CSS), `[tile_NN]` = inferred from screenshot tile NN, `[body]` = `bodytext.txt`.
> Where a number has no citation it is derived arithmetically from a cited one (shown inline).

Target: a near-black, DOM-authored SaaS landing whose hero centerpiece is a **render of the actual
product UI**, followed by a logo strip, a two-tone statement line, a three-up illustrated feature row,
and the first numbered product "chapter." Desktop-first at 1280px; must collapse cleanly to 390px.

---

## 1 · TOKEN BLOCK (use these literal values — do not round, do not "improve")

### 1.1 Color — roles + 60-30-10 (all `[styles]`)
This is a **dark-authored** palette: the 60% is a near-black GROUND that floods the viewport with type
reversed out of it. That committed dark field IS the color decision (see §3 for why this is a legit
restraint-mode, not the timid-monochrome trap).

| Role | Hex | Where it comes from | Job |
|------|-----|---------------------|-----|
| **60 — ground** | `#08090a` | `--color-bg-level-0` / `--color-bg-primary`; **84.2% of page area** | page background, floods everything |
| **60 — deep ground** | `#010102` | `--color-bg-marketing` | full-bleed marketing bands slightly deeper than base |
| **30 — panel** | `#0f1011` | `--color-bg-level-1` / `--color-bg-panel`; 7.8% area | product-render panel, cards, elevated surfaces |
| elevation step 2 | `#141516` | `--color-bg-level-2` / `--color-bg-tint` | nested surface inside a panel |
| elevation step 3 | `#191a1b` | `--color-bg-level-3` | deepest nested surface |
| micro-steps | `#090a0b`, `#101112`, `#121314` | `[styles]` backgrounds | barely-there banding (1–3 RGB pts apart) |
| translucent surface | `rgba(255,255,255,0.02)` (`#ffffff05`) | `[styles]` | glass overlay fill (chat card) |
| **10 — accent (interactive)** | `#5e6ad2` | `--color-brand-bg` / `--color-indigo` | flat indigo on interactive controls (send button, focus) |
| accent (link/hover) | `#7170ff` → `#828fff` | `--color-accent` → `--color-accent-hover` | accent text/links, hover |
| **10 — primary CTA** | `#e5e5e6` → `#fff` bg, `#08090a` text | `--color-button-invert-bg` → `-hover` | the "Sign up" pill is INVERTED (near-white on dark), not indigo |

**Text (all `[styles]`):**
| Role | Hex | Token |
|------|-----|-------|
| primary | `#f7f8f8` | `--color-text-primary` (97.4% of text area) |
| secondary | `#d0d6e0` | `--color-text-secondary` |
| tertiary (muted) | `#8a8f98` | `--color-text-tertiary` — subhead + feature descriptions |
| quaternary (dimmest) | `#62666d` | `--color-text-quaternary` — the faded half of the two-tone statement |
| pure white (rare) | `#ffffff` | `--color-white` |

**Borders / hairlines (all `[styles]`):** `--border-hairline: 1px`. Elevation is done with 1px borders,
not shadows: `--color-border-primary: #23252a`, `--color-border-secondary: #34343a`,
`--color-border-translucent: rgba(255,255,255,0.05)` (`#ffffff0d`),
`--color-border-translucent-strong: rgba(255,255,255,0.08)` (`#ffffff14`),
`--color-line-primary: #37393a`.
Do NOT reach for the yellow-green `#e4f222` — it is a 0.4%-area highlight only, never a fill (§6).

### 1.2 Type — `Inter Variable` across weights (all `[styles]`)
> **Explicit override:** `aesthetics.md` bans Inter as a default. Here Inter Variable is the reference's
> GROUND TRUTH, so it is required — but the anti-slop discipline moves to the **weight + tracking**, not
> the family. Load `Inter Variable` (weights 100–900) + `Berkeley Mono` (fallback `ui-monospace, "SF Mono", Menlo, monospace`).
> Turn on Inter stylistic sets: `font-feature-settings: "cv01", "ss03";` (`--font-settings` `[styles]`).

Weights available (`--font-weight-*` `[styles]`): light **300**, normal **400**, medium **510**, semibold **590**, bold **680**.

| Role | Family | Weight | Size | Line-height | Letter-spacing | Source |
|------|--------|--------|------|-------------|----------------|--------|
| **Hero H1 (display)** | Inter Variable | **510** | **64px** | **64px** (1.0) | **-1.408px** (= -0.022em) | `[styles]` type/display |
| Section headline | Inter Variable | 590 | 48px (`--title-6` 3rem) | 48px (1.0) | -0.022em (= -1.056px) | `[styles]` `--title-6` |
| Feature title | Inter Variable | 590 | 17px (`--title-1` 1.0625rem) | 1.4 | -0.012em | `[styles]` `--title-1` |
| **Body** | Inter Variable | 400 | 15px (0.9375rem) | 24px (1.6) | -0.165px (= -0.011em) | `[styles]` type/body |
| Large body / statement | Inter Variable | 400 | 17px (`--text-large` 1.0625rem) | 1.6 | 0 | `[styles]` `--text-large` |
| **Mono (numbers/labels)** | Berkeley Mono | 400 | 14px | 21px (1.5) | -0.182px | `[styles]` type/mono |

The **medium (510) not bold** display weight + the **tight -0.022em tracking** are the signature — see §3.

### 1.3 Spacing — 4px base scale (all `[styles]` spacing + vars)
Steps actually used (by count): `4 / 8 / 12 / 16 / 24 / 32`, extending to `48 / 64 / 96 / 128` for band
rhythm. Base unit = **4px**. No arbitrary px.
Layout constants: `--header-height: 72px`, `--page-inset: 32px` (band side padding, `--homepage-padding-inset`),
`--page-padding-block: 64px`, `--homepage-max-width: ~1364px` (`calc(1344px + 10px*2)`),
`--page-max-width: 1024px`, `--prose-max-width: 624px`, grid = **12 columns** (`--grid-columns`).
Vertical rhythm between bands: **96–128px** (`[tile_00]`/`[tile_01]` band gaps read ≈ the 96/128 steps).

### 1.4 Radius (all `[styles]`)
Default control radius = **6px** (`--radius-6`, most-used non-zero, 38×). Scale: `4 / 6 / 8 / 12 / 16 / 24`
(`--radius-*`), pill = **9999px** (`--radius-rounded`, the nav "Sign up" + changelog chip), circle = `50%`.
The product-render panel: **12–16px** top radius (`--radius-12`/`--radius-16`; `12px 12px 0px 0px` seen `[styles]`).
Sharp `0px` dominates (2183×) — most inner UI rows are square; rounding is reserved for outer panels/pills.

### 1.5 Elevation — 1px inset borders, NOT drop shadows (all `[styles]`)
The near-black ground has **barely-there** depth. Elevate a surface by (a) a 1px inset hairline border and
(b) a faint dark shadow — never a bright card shadow:
- inner hairline: `box-shadow: inset 0 0 0 1px #23252a;` (`rgb(35,37,42) 0px 0px 0px 1px inset` `[styles]`)
- panel glow: `box-shadow: 0 4px 32px rgba(8,9,10,0.6);` (`[styles]` elevation) — dark-on-dark, invisible-but-felt
- named tokens: `--shadow-low: 0 2px 4px #0000001a`, `--shadow-medium: 0 4px 24px #0003`, `--shadow-high: 0 7px 32px #00000059`
- `--shadow-stack-low` = a 5-layer micro-stack of `rgba(0,0,0,.01–.08)` at 1–8px — use for the floating chat card.

### 1.6 Motion (all `[styles]` motion)
Workhorse transition: **0.16s `cubic-bezier(0.25,0.46,0.45,0.94)`** (ease-out-quad) on filter/transform/color/border.
Color-only: `0.1s`. Background: `0.4s ease-out`. Tokens: `--speed-quickTransition: .1s`, `--speed-regularTransition: .25s`.
**One orchestrated entrance:** hero elements stagger in — `0.4s cubic-bezier(0.165,0.84,0.44,1) backwards`
with `animation-delay` stepping **0.1s → 0.2s → 0.3s → 0.4s** (the real `staggerIn`, ease-out-quart) `[styles]`.
`prefersReducedMotion: true` is honored `[styles]` — under `prefers-reduced-motion: reduce`, collapse every
transition/animation to ~0 and show final state. Animate `transform`/`opacity` only.

---

## 2 · LAYOUT CONCEPT + STRUCTURE

**Concept (one sentence):** a vertical **band-stack** on one near-black ground, where each band centers
its content in a ~1152px column, the hero is **left-aligned and asymmetric** (headline left, changelog
link far-right), and the emotional peak is a **high-fidelity render of the real product UI** floated on
the ground with only a 1px hairline + a dark glow separating it from the page.

Section arc (hero → what follows), top to bottom:
1. **Sticky nav** (72px) — logo left · center links · inverted "Sign up" pill right.
2. **Hero** — left H1 (2 lines) + muted subhead; a "New · Coding Sessions →" changelog chip on the right.
3. **Product-UI render** — the signature: a wide rounded panel showing Linear's issue view + agent chat.
4. **Logo strip** — 8 customer wordmarks, grayscaled to near-white, evenly spaced.
5. **Two-tone statement** — one large sentence, bright lead clause fading to muted continuation.
6. **Three-up feature row** — 3 columns, each an isometric line-illustration + title + muted description.
7. **First chapter — "1.0 Intake"** — split: display headline left, body-right, mono chapter label, then a
   second product-UI render (triage board + a Slack `#feedback` thread card).

Grid: 12 cols, ~1152px content max, 32px side inset, bands full-bleed on `#08090a` (marketing bands `#010102`).
Split sections put the headline on cols 1–6 and the body on cols 7–12 (`[tile_01]`).

```
┌──────────────────────────────────────────────────────────────┐  ← nav 72px, sticky, translucent #0b0b0bcc + blur 20px
│ ◈ Linear      Product Resources Customers Pricing Now  [Sign up]│
├──────────────────────────────────────────────────────────────┤
│                                                                │  ← generous top space (~7–8 spacing steps)
│  The product development                                       │  H1 64px / w510 / -1.408px, left, #f7f8f8
│  system for teams and agents                                   │
│                                                                │
│  Purpose-built for planning and     [New · Coding Sessions →]  │  subhead #8a8f98 left · changelog chip right
│  building products. …AI era.                                   │
│                                                                │
│   ┌──────────────────────────────────────────────────────┐    │  ← PRODUCT-UI RENDER (signature)
│   │ sidebar │  issue: "Faster app launch"   │ properties  │    │  panel #0f1011, radius 12–16, inset 1px #23252a,
│   │ Inbox   │  Activity feed…               │ ┌─ agent ─┐ │    │  glow 0 4px 32px rgba(8,9,10,.6)
│   │ Issues  │                               │ │chat card│ │    │  chat card floats: rgba(255,255,255,.02) + stack shadow
│   └──────────────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────────────┤  ← band on #010102
│   Vercel   Cursor   Oscar   OpenAI   Coinbase   Cash App  …    │  logo strip, grayscale→white, ~40–50% opacity
├──────────────────────────────────────────────────────────────┤
│  A new species of product tool. Purpose-built for modern teams │  statement: lead #f7f8f8, rest #62666d,
│  with AI workflows at its core, Linear sets a new standard…    │  ~48px, one paragraph, two tones
├──────────────────────────────────────────────────────────────┤
│   ▱ iso-art        ▱ iso-art          ▱ iso-art               │  three-up: thin line/isometric drawings
│   Built for        Powered by         Designed for            │  title 590/17px
│   purpose          AI agents          speed                   │
│   world-class…     humans+agents…     reduces noise…          │  desc #8a8f98 15px
├──────────────────────────────────────────────────────────────┤
│  Make product              Turn conversations and customer     │  ← chapter: headline left (48px/590),
│  operations self-driving   feedback into actionable issues…    │     body right (#d0d6e0/8a8f98)
│                            1.0  Intake →                       │  mono chapter label (Berkeley Mono 14px)
│   ┌── triage board: Backlog · Todo · In Progress · Done ──┐    │  second product render
│   │ ┌ Slack #feedback thread ┐  rows of ENG-#### issues   │    │  slack card floats over board (like hero)
│   └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## 3 · THE SIGNATURE — what makes it feel like *this* (name each technique)

Execute these as nouns; they are what separate a real reproduction from a generic dark SaaS page.

1. **Product-UI hero render.** The hero's centerpiece is not a gradient blob or a stock dashboard — it is a
   faithful mock of the *actual* application (left sidebar of nav items → center issue-detail with an
   activity feed → right properties rail → a floating agent-chat card). Build it as real DOM: panel
   `#0f1011`, radius 12–16px, `inset 0 0 0 1px #23252a`, glow `0 4px 32px rgba(8,9,10,.6)`. This is the
   record's `signature-move: product-ui-hero-render` `[tile_00]`.
2. **Near-black authored ground with barely-there elevation steps.** `#08090a` owns 84% of the page; every
   surface is 1–3 RGB points brighter (`#0f1011` → `#141516` → `#191a1b`), and depth comes from **1px inset
   hairlines** (`#23252a` / `rgba(255,255,255,.05)`) plus near-invisible dark shadows — never a bright card.
   The eye reads structure without any surface shouting `[styles]` elevation + backgrounds.
3. **Tight negative tracking on a large medium-weight display.** 64px Inter at **weight 510 (medium, not
   bold)** with **-1.408px (-0.022em)** letter-spacing. The restraint (medium, not black) + the engineered
   tightness is the "precise / nocturnal / premium" mood `[styles]` type/display.
4. **Two-tone statement line.** One sentence carries two emphasis levels in the same size: the lead clause
   in `#f7f8f8`, the continuation dropping to `#62666d`/`#8a8f98`. Emphasis via **color, not weight or size**
   `[tile_00]`.
5. **Mono chapter numbering that encodes a real sequence.** Berkeley-Mono labels — `1.0 Intake →`,
   `2.0 Plan →`, `FIG 0.2`, `02 / 145` — mark an actual product pipeline (Intake→Plan→Build→Diffs→Monitor),
   so the numbering is *information*, not decoration `[body]` / `[tile_01]`.
6. **Isometric line-art for abstract features.** Digital/abstract concepts are drawn as thin white/gray
   **isometric wireframe** diagrams on the black ground (a stacked-slab cube, floating cubes, a fanned
   stack) — one committed illustration language, no photos, no emoji `[tile_01]`.

**Why the near-monochrome is allowed here (do not "fix" it by adding a saturated band):** `aesthetics.md`
bans timid monochrome-with-one-CTA-accent — BUT it explicitly permits restraint-mode "when it earns it
through editorial layout + photography." This page earns it: the committed dark field is the identity, and
it is carried by the product-UI renders + isometric illustrations + asymmetric editorial layout. The indigo
`#5e6ad2`/`#7170ff` accent stays **flat on interactive controls only** (send button, links, focus ring) and
the primary CTA is an **inverted near-white pill**. Keep it that way.

---

## 4 · THE CONTENT (build the SAME page — use this copy verbatim, `[body]`)

**Nav:** `Product` · `Resources` · `Customers` · `Pricing` · `Now` · `Contact` · `Log in` · **`Sign up`** (pill).

**Hero H1:** `The product development system for teams and agents`
**Subhead:** `Purpose-built for planning and building products. Designed for the AI era.`
**Changelog chip (right):** `New` · `Coding Sessions →`

**Product render (hero) — label it with this real content so it reads as the app:**
- Sidebar: `Inbox` · `My issues` · `Reviews` · `Pulse` · `Workspace` · `Initiatives` · `Projects` · `More` · Favorites: `Faster app launch` · `Agent tasks` · `UI Refresh` · `Agents Insights`
- Issue title: `Faster app launch` — counter `02 / 145`
- Issue body: `Render UI before vehicle_state sync when minimum required state is present, instead of blocking on full refresh during iOS startup.`
- Activity (a few rows): `Linear created the issue via Slack on behalf of karri · 2min ago` · `karri · 4 min ago — Right now we show a spinner forever, which makes it look like the car disappeared…` · `jori · just now — @Linear can you take a stab at this?`
- Properties rail: `ENG-2703` · `In Progress` · `High` · assignee `jori` · Labels `Performance` `iOS` · `Cycle 144` · Project `Core Performance`
- Floating agent-chat card (indigo send button): `Linear · Opus 4.8` — `jori connected Linear to ENG-2703` · `Pushed and opened a draft PR. Changes:` · `useRideHistory.ts` · `RideHistoryPage.tsx` · `Changed 2 files +4 -4` · input placeholder `Tell Linear what to do next…`

**Logo strip:** `Vercel` · `Cursor` · `Oscar` · `OpenAI` · `Coinbase` · `Cash App` · `BOOM` · `Ramp`

**Two-tone statement:** lead (bright) `A new species of product tool.` continuation (muted)
`Purpose-built for modern teams with AI workflows at its core, Linear sets a new standard for planning and building products.`

**Three-up features** (label · title · description):
- `FIG 0.2` — **Built for purpose** — `Linear is shaped by the practices and principles of world-class product teams.`
- `FIG 0.3` — **Powered by AI agents** — `Designed for workflows shared by humans and agents, from PRD to PR.`
- `FIG 0.4` — **Designed for speed** — `Reduces noise and restores momentum to help teams ship with high velocity and focus.`

**First chapter — "Intake":**
- Headline (left): `Make product operations self-driving`
- Body (right): `Turn conversations and customer feedback into actionable issues that are routed, labeled, and prioritized for the right team.`
- Mono chapter label: `1.0  Intake →`
- Second product render — a triage board with columns `Backlog 8` · `Todo 71` · `In Progress 3` · `Done 53`, each holding rows like `ENG-2085 Reduce UI flicker during autonomy…`, `ENG-926 Remove UI inconsistencies` (labels `Bug` `Design`), `ENG-924 Upgrade to Claude Opus 4.8` (`AI`), `ENG-1487 Remove contentData from GraphQL API`. Overlapping it bottom-left, a Slack `Thread in #feedback` card: `lena 5:41 PM — Anyone else noticing the iOS app feels slow to open…` · `didier 5:41 PM — …still blocking initial render on a full vehicle_state sync…` · `andreas 5:41 PM — Feels like we could render sooner and load the rest in the background.` · input `@Linear create urgent issues and assign to me` with an indigo send button.

(If reproducing every issue row is impractical, keep the column headers + 3–4 representative rows each; the
structure, not the exhaustive list, carries the design.)

---

## 5 · BUILD ORDER

1. **Scaffold + tokens.** One HTML file, Tailwind v4 `@theme` (or `:root` vars). Register every §1 value as
   a token ONCE (color/text/border/space/radius/shadow/motion). Load `Inter Variable` + `Berkeley Mono`;
   set `font-feature-settings: "cv01","ss03"`. Page background `#08090a`, default text `#f7f8f8`.
2. **Sticky nav (72px).** Translucent `#0b0b0bcc` + `backdrop-filter: blur(20px)`, bottom hairline
   `rgba(255,255,255,.08)`. Logo left, center links in `#8a8f98` (hover `#f7f8f8`), inverted pill CTA right
   (`#e5e5e6` bg → `#fff` hover, text `#08090a`, radius 9999).
3. **Hero text.** Left-aligned. H1 exactly 64px / 510 / lh 64px / -1.408px / `#f7f8f8`, on 2 lines.
   Subhead `#8a8f98`, 15px, below. On the same row, far-right, the pill changelog chip
   (`New` badge + `Coding Sessions →` link, radius 9999, 1px translucent border).
4. **Hero product render.** Build as real DOM (grid: sidebar | main | rail), panel `#0f1011`, radius 12–16,
   `inset 0 0 0 1px #23252a`, `0 4px 32px rgba(8,9,10,.6)`. Inner rows square (radius 0–6). Float the agent
   chat card with `rgba(255,255,255,.02)` fill + `--shadow-stack-low`. Indigo `#5e6ad2` only on its send button.
5. **Logo strip.** Band on `#010102`, 8 wordmarks in a row, `filter: grayscale(100%) brightness(4)` →
   near-white at ~40–50% opacity; collapse to 2–3 rows on mobile.
6. **Two-tone statement.** ~48px, weight 400–510; wrap the lead clause in `#f7f8f8` and the rest in `#62666d`.
7. **Three-up feature row.** 12-col → three 4-col cells (stack to 1 col ≤720px). Each: an inline-SVG
   isometric line drawing (1px `#37393a`/white strokes on transparent), then title (590/17px/`#f7f8f8`),
   then description (`#8a8f98`/15px/lh 1.6). Small `FIG 0.x` mono eyebrow above each.
8. **Chapter "Intake".** Split: headline cols 1–6 (48px/590/-0.022em/`#f7f8f8`), body cols 7–12
   (`#d0d6e0`→`#8a8f98`/17px). Mono chapter label `1.0 Intake →` under the body. Below, the triage-board
   render (4 columns of issue rows) with the Slack `#feedback` card overlapping bottom-left.
9. **Motion.** One hero entrance: stagger H1 → subhead → chip → render with `animation-delay` 0.1/0.2/0.3/0.4s,
   `0.4s cubic-bezier(0.165,0.84,0.44,1) backwards`, translate+fade only. Below-fold bands reveal once on
   scroll-in (IntersectionObserver). Hover/press transitions `0.16s cubic-bezier(.25,.46,.45,.94)`.
   Add `@media (prefers-reduced-motion: reduce){ *{animation:none!important;transition:none!important} }`
   and show final state.
10. **Responsive + a11y floor.** Zero horizontal overflow at 390px (sidebar/render scroll or restack, do not
    `overflow-x:hidden` the culprit). Visible keyboard focus ring `1px solid #5e69d1` offset 2px. Min tap 44px.

---

## 6 · ANTI-SLOP GUARDRAILS (what NOT to do — these betray the design)

- ❌ **Faking the product with a gradient/glossy 3D "app-icon" blob.** The product must be a real DOM UI render
  (sidebar+list+detail+chat). This is the #1 fake-render tell `aesthetics.md`.
- ❌ **Brightening the ground.** No generic `#111`/`#1a1a1a`/`#121212`, no pure `#000` fields. Use the exact
  `#08090a` base (marketing bands `#010102`) with 1–3 RGB-point steps. The precise near-black IS the identity.
- ❌ **Drop-shadow cards.** Depth is 1px inset hairlines + faint dark shadows, never a bright/blurred card glow.
- ❌ **Wrong Inter weight/tracking.** Do not set the H1 to 700/`normal` spacing. It is **510 + -0.022em** — the
  restraint and the tightness are the whole tell. (Inter is used here only because it is the reference's
  ground truth; keep the discipline in weight+tracking.)
- ❌ **Centering everything.** Hero is left-aligned; chapters are split (headline left / body right). Center
  only if a specific short block calls for it.
- ❌ **AI-purple gradient wash.** The indigo `#5e6ad2`/`#7170ff` is a FLAT accent on interactive controls +
  focus only — never a background gradient, never a hero glow. The primary CTA is an inverted near-white pill.
- ❌ **Acid-green field.** `#e4f222` is a <0.5%-area highlight at most; never a band/section background. Avoid
  the near-black + acid-green cliché `aesthetics.md`.
- ❌ **Decorative numbering.** `1.0 / 2.0 / FIG 0.x` may only mark the real product sequence
  (Intake→Plan→Build→Diffs→Monitor). Don't paste numbers on non-sequential content.
- ❌ **Emoji icons / mismatched card icons.** Use one committed isometric line-illustration language for the
  three-up; no emoji, no clip-art icon set.
- ❌ **Over-animation.** One staggered hero entrance + one scroll-reveal per band. No AOS-style
  fade-everything, no parallax, no mouse-follow. Always honor `prefers-reduced-motion`.
- ❌ **Rounding tokens to "nice" numbers.** Ship the literal values (`#08090a`, `-1.408px`, `weight 510`,
  4px base). Rounding drifts the reproduction toward the AI average — the exact thing this recipe prevents.

---

*Provenance recap:* colors/type/spacing/radius/elevation/motion = `captures/app-ui/linear/styles.json`
(398 CSS vars, DOM-authored); copy = `bodytext.txt`; layout arc, split alignment, product-render framing,
two-tone statement, and isometric illustrations = inferred from `tile_00`/`tile_01`. No value here requires
seeing the original — a builder with only this file can reproduce the page.
