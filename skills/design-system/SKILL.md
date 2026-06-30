---
name: design-system
description: Build and govern a design-token system — the single source of truth that keeps every page, app, and component visually consistent and lets ONE brand re-theme everything by swapping a mapping. Auto-invoke when the task is about tokens, theming, or system-level consistency in EITHER language: "design system", "디자인 시스템", "design tokens", "디자인 토큰", "tokenize this", "토큰화", theming / re-theme / "리브랜딩" / "테마 입히기", dark mode / "다크모드", multi-brand / "멀티브랜드" / white-label, "make these colors consistent / stop hardcoding hex", semantic tokens (--color-surface/ink/accent), OKLCH color ramp / "컬러 램프", spacing & type scale, elevation/shadow tokens, radius scale, motion tokens, component API / variant design ("variant vs prop", size scale, slots), DTCG / tokens.json / Style-Dictionary-style build, a Tailwind v4 @theme block, design-token spec sheet, dev handoff / "개발자 핸드오프", token versioning & changelog, or brand-consistency governance for a CEO. Owns the artifacts: tokens.json (DTCG), the @theme block, brand-<name>.tokens.json overrides, the spec.html swatch sheet, the brand-lint gate. NOT for: building a single landing/상세페이지 (→ detail-page), app/component UI screens (→ ui-design), or design→code build-out (→ frontend-build) — those CONSUME the system you author here.
---

# Design System — tokens as the single source of truth

A design system is good when (1) **no page can drift** — there is exactly one place a color/font/shadow is defined, and (2) **one brand re-themes everything** by swapping a mapping, touching zero component code or markup. If a value is hardcoded twice, you don't have a system; you have a coincidence that will diverge.

This skill owns the **token layer** that every visual sibling consumes: `detail-page`, `ui-design`, and `frontend-build` all read the `@theme` you author here; `brand-identity` feeds the brand color/type INTO your primitive layer; `marketing-conversion` never touches tokens directly. The aesthetic decisions (which OKLCH ramp, which fonts, banned defaults) come from the shared two-pass method in `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/references/aesthetics.md` — invoke it, don't re-derive it.

## The token loop (never skip; do 1–4 in thinking before any code)

```
1 INVENTORY   → list ROLES first, not colors (surface, ink, muted, line, accent, on-accent, the elevation tiers)
2 PRIMITIVE   → build raw OKLCH ramps + raw numeric scales — the materials, role-blind
3 SEMANTIC    → map each role → a primitive  (--color-accent → --brand-primary-700). THIS is the re-theme seam
4 COMPONENT   → only where a component needs a decision semantic doesn't own; alias SEMANTIC, never primitive
5 ENCODE      → write it ONCE: DTCG JSON → build-tokens.js → :root{--brand-*} + @theme (no parallel config)
6 THEME       → add [data-brand]/[data-theme="dark"]/.dark overrides at the SEMANTIC layer only
7 HANDOFF     → emit-tokens.js → tokens.json + spec.html; semver + a rename-map changelog
8 VERIFY      → brand-lint.js gate + tokens-only-source diff + AA contrast in light AND dark
```
Iterate 5→8 until `brand-lint` exits 0 and the regenerated `@theme` diffs clean against the committed DTCG. "I defined the tokens" is not done; "the linter passes and the spec sheet regenerates byte-for-byte" is.

## 1 · Why three layers (the indirection IS the product)

```
PRIMITIVE          SEMANTIC (the swap seam)        COMPONENT (optional)
--brand-primary-700  →  --color-accent          →  --btn-bg: var(--color-accent)
oklch(0.40 0.08 157)    "the focal action color"    --btn-fg: var(--color-on-accent)
```
A button reads `--color-accent`. That maps to `--brand-primary-700`. To re-skin for a second brand you swap **one** mapping (or override `--brand-*` under `[data-brand]`) — every button, badge, focus ring, and CTA follows, with **zero** edits to components or markup. The names also stay true across rebrands: a "destructive" action stays destructive when the brand red changes hue; an "accent" CTA stays the focal action even if the brand color flips green→blue.

If the button instead hardcoded `oklch(0.40 0.08 157)` (a primitive value inlined into markup), re-theming = find-and-replace across N files = guaranteed drift. The three layers buy exactly three things: **one swap re-themes all** · **dark mode is a semantic remap, not a second palette** · **roles survive rebrands**.

Rules that keep the layers honest:
- **Markup/components reference SEMANTIC only.** Never `var(--brand-primary-700)` in a component; never a raw `oklch()`/hex in markup.
- **Component tokens alias SEMANTIC, never PRIMITIVE, never a raw value.** `--btn-bg: var(--color-accent)` ✓ · `--btn-bg: var(--brand-primary-700)` ✗.
- **Mint a component token only for a decision the semantic layer can't name** — e.g. `--btn-height: 44px` (a touch-target contract). Don't pre-mint a token per CSS property; that's bloat. A value used once is a value, not a token.

## 2 · Single runtime source — DTCG JSON → @theme (one definition, two outputs)

Author tokens **once** in DTCG (Design Tokens Community Group) JSON, OKLCH-native, then compile. The source of truth lives at `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/tokens/brand-default.tokens.json`:

```jsonc
{
  "color": {
    "surface": { "$type":"color", "$value":{ "colorSpace":"oklch", "components":[0.985,0.008,95] },
                 "$extensions":{ "com.detail-page":{ "css":"oklch(0.985 0.008 95)" } } },
    "ink":     { "$type":"color", "$value":{ "colorSpace":"oklch", "components":[0.205,0.012,275] }, "...": "" },
    "primary": {
      "500": { "$type":"color", "$value":{ "colorSpace":"oklch", "components":[0.560,0.095,156] }, "...": "" },
      "700": { "$type":"color", "$value":{ "colorSpace":"oklch", "components":[0.400,0.080,157] }, "...": "" },
      "DEFAULT": { "$type":"color", "$value":"{color.primary.700}" }   // ← SEMANTIC alias, not a copy
    },
    "on-accent": { "$type":"color", "$value":"{color.ink}" }            // bright accent fails white text @AA → dark ink
  },
  "font":   { "display":{ "$type":"fontFamily", "$value":["Black Han Sans","Pretendard","sans-serif"] }, "...":"" },
  "shadow": { "e2":{ "$type":"shadow", "$value":"0 6px 16px oklch(0.20 0.02 270 / 0.10)" }, "...":"" }
}
```
`$value` carries machine-readable components for interop; the exact CSS string round-trips in `$extensions["com.detail-page"].css`; semantic tokens are **aliases** (`"{color.primary.700}"`), not duplicated values. Compile (no npm/eval/network — Style Dictionary's job in ~150 lines):

```bash
ROOT=${CLAUDE_PLUGIN_ROOT}/skills/detail-page
# (a) the :root{--brand-*} PRIMITIVE+SEMANTIC source layer  → stdout (paste into a page's :root)
node $ROOT/scripts/build-tokens.js $ROOT/tokens/brand-default.tokens.json
# (b) the @theme{ --color-*: var(--brand-*) } mapping that emits Tailwind utilities
node $ROOT/scripts/build-tokens.js $ROOT/tokens/brand-default.tokens.json --emit=theme
# (c) a second brand: FIRST author tokens/brand-alt.tokens.json with ONLY the tokens that differ
#     (it ships only once you create it — see §5; the default file is the sole token source out of the box),
#     THEN append it as a [data-brand="alt"] block (or skip the file and override --brand-* inline, §5):
node $ROOT/scripts/build-tokens.js $ROOT/tokens/brand-default.tokens.json $ROOT/tokens/brand-alt.tokens.json
```
The compiler resolves `{alias}` chains and **FATALs (exit 2) on a missing reference or an alias cycle** — it never emits broken CSS. CSS → stdout; a one-line JSON summary → stderr.

### The runtime: two CSS layers, one definition each
Tailwind v4's `@theme` turns every token into **BOTH** a CSS variable (`var(--color-ink)`) **AND** a utility (`bg-ink` / `text-ink` / `shadow-e2` / `rounded-lg`). So there is no second config object to drift. Don't hand-type the two layers below — `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/assets/starter/index.html` already ships this exact structure (`@tailwindcss/browser@4.3.1`, the full `--brand-*` source + `@theme` map, a `[data-brand="alt"]` override); copy it and re-skin only via the DTCG file above. The shape, verified against the real CDN:

```html
<style type="text/tailwindcss">
  :root {                                    /* LAYER 1 — raw --brand-* primitives + semantic aliases */
    --brand-surface: oklch(0.985 0.008 95);  /* 60% dominant page bg */
    --brand-ink:     oklch(0.205 0.012 275); /* body text */
    --brand-muted:   oklch(0.520 0.015 270);
    --brand-line:    oklch(0.205 0.012 275 / 0.12);
    --brand-primary-500: oklch(0.560 0.095 156);
    --brand-primary-700: oklch(0.400 0.080 157);
    --brand-primary: var(--brand-primary-700);
    --brand-accent-500:  oklch(0.720 0.160 58);
    --brand-accent: var(--brand-accent-500);
    --brand-on-accent: var(--brand-ink);     /* bright accent can't carry white text (AA) → dark ink */
    --brand-font-display: "Black Han Sans","Pretendard",sans-serif;
    --brand-font-body:    "Pretendard",sans-serif;
    --brand-shadow-e1: 0 1px 2px oklch(0.20 0.02 270 / 0.06);
    --brand-shadow-e2: 0 6px 16px oklch(0.20 0.02 270 / 0.10);
    --brand-shadow-e3: 0 20px 48px oklch(0.20 0.02 270 / 0.16);
  }
  [data-brand="alt"] {                       /* re-theme = override the SEMANTIC primitive only */
    --brand-primary-700: oklch(0.42 0.13 255); --brand-primary: var(--brand-primary-700);
    --brand-accent-500:  oklch(0.74 0.15 35);  --brand-accent:  var(--brand-accent-500);
  }
  @theme {                                   /* LAYER 2 — map each Tailwind token to its --brand-* primitive */
    --color-surface: var(--brand-surface);
    --color-ink:     var(--brand-ink);
    --color-accent:  var(--brand-accent);
    --color-on-accent: var(--brand-on-accent);
    --font-display:  var(--brand-font-display);
    --shadow-e2:     var(--brand-shadow-e2);
    /* v4 default --spacing:0.25rem already gives the 8pt rhythm: p-1=4px … p-24=96px */
  }
</style>
```
**FOOTGUN — use plain `@theme`, NOT `@theme inline`.** `@theme inline` does *not* emit the `--color-*` variables; it only generates utilities. The moment any inline style does `style="color:var(--color-on-accent)"`, `inline` breaks it. Plain `@theme` over `var(--brand-*)` gives you both the vars and the utilities, so overriding `--brand-*` under `[data-brand]` re-themes the utilities AND every inline `var()` ref at once. This is the multi-brand pivot.

## 3 · OKLCH color ramps (the only correct way to build a scale)

Never lighten/darken one hex — that drifts hue and collapses chroma. Build in OKLCH: **near-even L steps, near-fixed H, chroma may ARC** (peaks mid-ramp where the color is most vivid, falls at the tint and shade ends). Real `primary` ramp from `brand-default`:

| step | L (near-even) | C (arcs, peaks at 500) | H (small warm drift) |
|---|---|---|---|
| 50  | 0.965 | 0.020 | 155 |
| 100 | 0.910 | 0.040 | 155 |
| 300 | 0.760 | 0.075 | 156 |
| **500** | 0.560 | **0.095** | 156 |
| 700 | 0.400 | 0.080 | 157 |
| 900 | 0.270 | 0.050 | 158 |

L lands on near-even rungs (.96/.91/.76/.56/.40/.27); H drifts only ~3° toward warmth as it darkens (matches how pigment behaves); C arcs up to the 500 and tapers — that arc is what makes the mid-tones read saturated without the ends going muddy. Neutrals are the same ramp at near-zero chroma sharing the ink hue (`oklch(0.205 0.012 275)`), which keeps grays subtly tinted to the brand instead of dead `#808080`. Tune live in Realtime Colors, transcribe to OKLCH — never paste a default Tailwind palette. Full method + banned palettes: `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/references/aesthetics.md`.

## 4 · The numeric scales (use these numbers; override only with a stated reason)

| Scale | Tokens | Notes |
|---|---|---|
| **Spacing (8pt)** | `4 8 12 16 24 32 48 64 96` | v4 `--spacing:0.25rem` → `p-1=4 … p-24=96`. Zero arbitrary px. Inner gap < outer gap (proximity = grouping). |
| **Type (hand-picked)** | `12 14 16 18 20 24 30 36 48 64` | Not a pure ratio. Adjacent steps visibly distinct; **≥3× jump for hierarchy**, not 1.5×. Line-heights snap to a 4pt rhythm. |
| **Elevation** | `e1 e2 e3` (`+e4` only for modals/overlays) | `e1: 0 1px 2px /.06` · `e2: 0 6px 16px /.10` · `e3: 0 20px 48px /.16` — all OKLCH-tinted, NEVER one-off `box-shadow`. |
| **Radius** | `sm 6 · md 10 · lg 16 · pill 9999` | Pick ONE family. A uniform radius on *every* surface is a slop tell — concentrate the soft corner where it means something. |
| **Motion** | `--dur-1 120ms · --dur-2 200ms · --dur-3 320ms` · `--ease-out cubic-bezier(.2,0,0,1)` · `--ease-spring cubic-bezier(.2,.8,.2,1)` | One orchestrated entrance, not scattered micro-interactions. Always honor `prefers-reduced-motion`. |

Hierarchy comes from **weight + color first, size second** — de-emphasize by lowering contrast (ink→muted), not by shrinking. Extreme weight contrast (100/200 vs 800/900), never 400-vs-600.

## 5 · Multi-brand & dark mode (override SEMANTIC, never re-author primitives)

Dark mode is **not** an inversion and **not** a second palette — it is a remap of the *semantic* tokens. Override the `--brand-*` primitives under a scope; the `@theme` map and every utility follow automatically:

```css
[data-theme="dark"], .dark {           /* or [data-brand="alt"] for white-label */
  --brand-surface: oklch(0.18 0.012 275);   /* not #000 — a tinted near-black */
  --brand-card:    oklch(0.22 0.012 275);
  --brand-ink:     oklch(0.96 0.010 275);
  --brand-muted:   oklch(0.70 0.014 270);
  --brand-line:    oklch(0.96 0.010 275 / 0.14);
  /* accents usually need +L and a touch +C in dark for perceived parity with light */
  --brand-accent-500: oklch(0.78 0.165 58); --brand-accent: var(--brand-accent-500);
  --brand-on-accent:  oklch(0.20 0.012 275);
}
```
Author each extra brand as `brand-<name>.tokens.json` containing **only the tokens that differ** (it inherits the rest through the `--brand-*` cascade), then compile with the default file FIRST so the `[data-brand]` block resolves. Only add a brand file for a real second-brand use case — don't author speculative brands; the ramps are hand-tuned, not auto-generated. Toggle at runtime with `document.documentElement.dataset.brand = 'alt'` / `.theme = 'dark'`. To prove each scope stays accessible, shoot with `BRANDS=alt,default node ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/shoot.js <page>` (per-brand axe + overflow land in `run.json.brands[]`; the top-level gate stays the default brand, catching a brand that breaks only when applied).

## 6 · Component API & variant design

- **Variant vs prop — the dividing line:** if it changes *which tokens* the component reads (its visual identity), it's a **variant** — finite, named, themeable. If it changes content or behavior, it's a **prop**. `variant="primary|secondary|ghost|destructive"` ✓ · `disabled`, `loading`, `href` are props. `size` is a variant when it maps to a token set (height/padding/type), a prop when it's free-form.
- **Name variants by ROLE, never by appearance.** `primary/secondary/ghost/destructive`, not `blue/green/outline`. This is the semantic rule one level up: a `destructive` button survives the brand red changing hue; a `red` button is a lie waiting to happen.
- **Size scale maps to tokens, never magic numbers:** `sm→{h:36, px:12, text:14}` · `md→{h:44, px:16, text:16}` · `lg→{h:52, px:20, text:18}`. `md=44px` honors the ≥44px touch target — make it the default.
- **Component tokens are the API contract:** expose `--btn-bg / --btn-fg / --btn-radius / --btn-height`, each aliasing a semantic token. A consumer re-skins one component by overriding its component tokens, without forking the component. Default the radius to `var(--radius-md)`, the bg to `var(--color-accent)`, the fg to `var(--color-on-accent)`.
- **Slots by role, not position:** `leading` / `trailing` / `children`, not `left`/`right` (survives RTL and reflow). Keep the same name through the flow: button label "Publish" → toast "Published" → state "Published" (see aesthetics.md "Copy is design material"). For the full component-state matrix (hover/focus/active/disabled/loading/empty/error) reach for sibling **ui-design**; this skill owns the *tokens* those states consume.

## 7 · Dev handoff — a spec that CANNOT drift

The deliverable is **not** a Figma export (stale the moment code ships) — it is a spec regenerated *from* the shipped `@theme`, so it is the code by construction:

```bash
ROOT=${CLAUDE_PLUGIN_ROOT}/skills/detail-page
node $ROOT/scripts/emit-tokens.js <page.html> [out-dir]
#  → out/tokens.json  (DTCG, OKLCH-native, var() chains resolved to literals)
#  → out/spec.html    (live swatch sheet: every color chip + the type families + the e1/e2/e3 elevation samples)
```
`emit-tokens.js` reads the page's `@theme`, resolves the `--color-* → var(--brand-*) → oklch()` chain, and emits a self-contained `spec.html` an engineer opens with zero tooling. Hand off **`tokens.json` + `spec.html`**, both regenerable, never a screenshot.

**Naming conventions (lock these):** `color.primary.500 → --brand-primary-500 → --color-primary-500 → bg-primary-500`. Drop `DEFAULT` in the var name (`color.primary.DEFAULT → --brand-primary`). Roles are nouns of intent (`surface/ink/muted/line/accent/on-accent`), ramps are numeric (`50…900`), never appearance words.

**Versioning (semver the token package):**
- **patch** — a value tweak that keeps the role's meaning (nudge accent L for contrast).
- **minor** — add a new token; nothing existing changes.
- **major (breaking)** — rename, remove, or change the *meaning* of a token. Ship a **rename map** (`old → new`) in the CHANGELOG so consumers can codemod in one pass. Treat a token rename like an API break, because it is.

## BANNED by default (each is a drift vector or a slop tell)

- ❌ **Hex/rgb/hsl literals in markup or components** — `style="color:#1a7f5a"`, `border:1px solid #eee`. Every color is a `var(--color-*)` / utility. (Raw color is only allowed *inside* the `@theme`/`:root` source.)
- ❌ **A `tailwind.config` `colors` object living next to a separate `:root` hex list** — two sources guarantee drift. v4 `@theme` is the ONE source; delete the parallel config.
- ❌ **`@theme inline`** when any inline `var(--color-*)` ref exists — it silently stops emitting the variables.
- ❌ **One-off `box-shadow`** — `box-shadow: 0 4px 12px rgba(0,0,0,.1)` inline. Use `shadow-e1/e2/e3`.
- ❌ **Arbitrary px** — `mt-[13px]`, `w-[317px]`, `text-[15px]`. Off the 8pt grid and the type scale = off the system.
- ❌ **Ad-hoc color names** — `blue2`, `lightblue`, `gray-ish`, `primary-dark-2`, `brandColorNew`. Name by role + numeric step.
- ❌ **Component token aliasing a primitive or a raw value** — `--btn-bg: var(--brand-primary-700)` / `--btn-bg:#1a7f5a`. Must route through a semantic token.
- ❌ **Minting a token used exactly once** (and its opposite, scattering raw values) — both defeat the system. A token earns its name by being referenced ≥2× or by encoding a contract.
- ❌ **Uniform radius + soft shadow on every surface, or unearned AI-purple** — defer to `aesthetics.md`'s banned-defaults list; the linter enforces the purple/font bans below.

## VERIFY (gate "done" on real checks, not "I defined the tokens")

1. **Deterministic brand-lint gate** — promotes the bans above from self-graded to machine-checked:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/brand-lint.js <page.html> [out.json]
   # exits 1 on ANY error-severity violation; writes brand-lint.json
   ```
   ERROR (block ship): `raw-hex` / `raw-rgb` / `raw-hsl` color **outside `@theme`** · `banned-font` (Inter/Roboto/Arial/Open Sans/Lato/system-ui in any font-family or font CDN href) · `ai-purple` (an OKLCH color at **hue 270–310 AND chroma > 0.04** — the chroma floor lets the brand's tinted grays at hue ~275/chroma ~0.012 pass). WARN (review): emoji-as-icon, Tailwind arbitrary-bracket class. `tokenCoverage.rawColorsOutsideTheme` must read **0**. (Opt-in `BRAND_LINT_PX=1` adds an off-8pt-grid spacing warning.)

   **CI / source-tree governance** — point `brand-lint` at a **directory** to govern a whole component tree, not just one HTML page. It recurses `**/*.{html,htm,tsx,jsx,ts,js,css,scss,vue,svelte,astro}` (skips `node_modules`/`.git`/`dist`/`build`), catches **CSS-in-JS / quoted hex** (a hardcoded `#1a7f5a` in a className, inline `style`, styled-components template, JS string, or a `.css`/`.scss` value), and aggregates one report — the `@theme`/`:root` raw-color allowance applies **only inside an actual `@theme{}`/`:root{}` block**, so component source has zero hardcoded-color escape hatch. Exits 1 on any error-severity violation, so it drops straight into CI:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/brand-lint.js ./src [out.json]
   # DIR report: { pass, errorCount, warnCount, files:[{file,errorCount,warnCount,violations,tokenCoverage}], totals }
   # totals.rawColorsOutsideTheme must read 0; totals.filesWithErrors must read 0
   ```
2. **Tokens-only-source diff** — prove the runtime `@theme` still equals the committed DTCG (no hand-edit drift):
   ```bash
   ROOT=${CLAUDE_PLUGIN_ROOT}/skills/detail-page
   diff <(node $ROOT/scripts/build-tokens.js $ROOT/tokens/brand-default.tokens.json --emit=theme) \
        <(sed -n '/@theme {/,/^}/p' <page.html>)        # must be empty
   ```
   Then `emit-tokens.js <page.html>` and confirm `rawColorsOutsideTheme:0` and that every color in `tokens.json` carries an `oklch` colorSpace (a `srgb`/`note:"review"` entry means a raw color leaked in).
3. **Contrast in BOTH themes** — every semantic fg/bg pair (ink-on-surface, muted-on-surface, on-accent-on-accent) must clear WCAG AA (4.5:1 text / 3:1 large+UI) under light AND `[data-theme="dark"]`. Run `AXE=1 node $ROOT/scripts/shoot.js <page>` (scans desktop + 390px DOM; `axe.gatingCount > 0` at serious/critical = fail), and for per-brand parity `BRANDS=default,dark,…`. For a full WCAG pass hand to the **a11y-auditor** agent; for an independent anti-slop read hand to **design-critic**.
4. **Re-theme smoke test** — set `data-brand="alt"` (or `data-theme="dark"`) and re-shoot: the WHOLE page must shift with zero component/markup edits. If anything stays the old color, a value was hardcoded — trace it with `brand-lint` and route it through a semantic token.

Ship only when: `brand-lint` exits 0 · the `@theme`↔DTCG diff is empty · AA holds in light + dark · the re-theme smoke test shifts every surface. Anything `null`/unknown in a report is "not verified," never a pass — re-run.

## Hand-off to siblings
- **detail-page / ui-design / frontend-build** consume this `@theme` directly — point them at the compiled block, don't let them re-declare colors. `frontend-build` compiles the SAME `@theme` with the Tailwind CLI for production (swap the browser CDN, identical block).
- **brand-identity** feeds the chosen brand color/type INTO your primitive layer (it decides the hue; you build the ramp).
- The reusable screenshot loop (`scripts/shoot.js`) and the two-pass aesthetic method (`references/aesthetics.md`) are shared — invoke them via `${CLAUDE_PLUGIN_ROOT}`, never reinvent.
