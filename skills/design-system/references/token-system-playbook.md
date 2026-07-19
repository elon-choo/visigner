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
# (c) a second brand: tokens/brand-alt.tokens.json NOW SHIPS — a real cobalt-blue+coral second brand (§5),
#     so this compiles a [data-brand="alt"] block out of the box; author your own brand-<name>.tokens.json
#     the same way (ONLY the tokens that differ), or skip the file and override --brand-* inline (§5):
node $ROOT/scripts/build-tokens.js $ROOT/tokens/brand-default.tokens.json $ROOT/tokens/brand-alt.tokens.json
```
The compiler resolves `{alias}` chains and **FATALs (exit 2) on a missing reference or an alias cycle** — it never emits broken CSS. CSS → stdout; a one-line JSON summary → stderr.

**Typed/data token export — `--emit=ts|js|json-flat`** (for a JS/TS app that wants the tokens as code, not CSS). Beyond `theme`, `--emit` now also produces a flat object keyed by dotted token path (`"color.primary.500"`, `"space.4"`, …) with **all aliases fully resolved to their leaf CSS value**, so a designer-owned DTCG source becomes a typed import with autocomplete and no parallel hand-maintained constants file:
```bash
ROOT=${CLAUDE_PLUGIN_ROOT}/skills/detail-page
node $ROOT/scripts/build-tokens.js $ROOT/tokens/brand-default.tokens.json --emit=ts          # export const tokens = {…} as const;
node $ROOT/scripts/build-tokens.js $ROOT/tokens/brand-default.tokens.json --emit=js          # export const tokens = {…};
node $ROOT/scripts/build-tokens.js $ROOT/tokens/brand-default.tokens.json --emit=json-flat   # a flat JSON object
```
These data emits read the **default file only** (extra brand files are ignored); the `css`/`:root`/`@theme` emits are unchanged. An **unknown `--emit` value now errors** (it previously fell through silently to `:root`).

**Non-OKLCH color inputs compile too (OKLCH-native output is unchanged).** `build-tokens.js` normalizes any of these DTCG color `$value`s to `oklch()` via a no-dep sRGB→OKLab→OKLCH converter (L, C ~4dp; H ~2dp; achromatic hue zeroed): **sRGB hex** (`#rgb`/`#rgba`/`#rrggbb`/`#rrggbbaa`), **`rgb()`/`rgba()`**, and `{ "colorSpace":"srgb" }` component values. The OKLCH-native path, the exact `$extensions['com.detail-page'].css` round-trip, and FATAL-exit-2-on-missing-ref are all untouched — so you can author or import non-OKLCH colors and still get a clean OKLCH ramp out. To **import a foreign token export**, pass `--from`:
```bash
ROOT=${CLAUDE_PLUGIN_ROOT}/skills/detail-page
# Adapt Tokens Studio / Style Dictionary export shapes into the internal DTCG model before compiling:
node $ROOT/scripts/build-tokens.js export.json --from tokens-studio        # or: --from style-dictionary
node $ROOT/scripts/build-tokens.js export.json --from style-dictionary --emit=theme
```
`--from tokens-studio|style-dictionary` maps `value`→`$value` and `type`→`$type`, strips Style Dictionary's trailing `.value` from `{a.b.value}` refs, and — when `type` is omitted (common in Style Dictionary) — **infers `color`** from a hex/rgb/oklch/hsl literal. Pair it with the hex→OKLCH normalization above and a Figma-Tokens/Style-Dictionary export becomes a first-class OKLCH source with no hand-editing.

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

> **All eight axes are now machine-emitted.** The `motion` (`--dur-*`/`--ease-*`) and contrast-bearing color tokens above are compiled from the DTCG source by `build-tokens.js --emit=theme` along with the other six axes — the starter `@theme` carries the full set byte-identical to that output (verify with the drift self-test in §VERIFY). Tune them in `tokens/*.tokens.json` and recompile; there is no separate motion or contrast file to hand-edit.

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
**Pick the override's selector with `$selector` (NEW).** An override `.tokens.json` may carry a top-level `$selector` string so it compiles to **any** CSS selector — `[data-theme="dark"]`, `.dark`, `[data-mode="hc"]` — not only `[data-brand="<name>"]`. Precedence: `$selector` > `$brand` / the filename's `[data-brand]`; it's non-empty-string-validated (FATAL exit 2 otherwise) and **composes with `data-brand`** (a brand sets the hue, a theme sets the neutrals). **`tokens/brand-dark.tokens.json` now ships** — the dark theme is compiled-from-DTCG rather than hand-written: `node scripts/build-tokens.js tokens/brand-default.tokens.json tokens/brand-dark.tokens.json` emits its `[data-theme="dark"]` block. (`starter-react` consumes this: it ships the compiled dark block plus a no-flash `data-theme` restore in `index.html` and a ☾/☀ toggle in `App.tsx`.)

Author each extra brand as `brand-<name>.tokens.json` containing **only the tokens that differ** (it inherits the rest through the `--brand-*` cascade), then compile with the default file FIRST so the `[data-brand]` block resolves. **`tokens/brand-alt.tokens.json` ships as the worked second brand** — a deliberately non-purple cobalt-blue primary (hue ~250–260) + coral accent (hue ~28) + cool surface; compile it (`build-tokens.js brand-default.tokens.json brand-alt.tokens.json`) to emit the `[data-brand="alt"]` block, paste it under the starter's existing example, and set `data-brand="alt"` to reskin. Only add a brand file for a real second-brand use case — don't author speculative brands; the ramps are hand-tuned, not auto-generated. Toggle at runtime with `document.documentElement.dataset.brand = 'alt'` / `.theme = 'dark'`. To prove each scope stays accessible, shoot with `BRANDS=alt,default node ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/shoot.js <page>` (per-brand axe + overflow land in `run.json.brands[]`; the top-level gate stays the default brand, catching a brand that breaks only when applied).

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
# Per-theme handoff (override block overlaid on :root+@theme), writes per-theme filenames so themes coexist:
node $ROOT/scripts/emit-tokens.js <page.html> [out-dir] --theme '[data-theme=dark]'
#  → out/tokens.data-theme-dark.json  +  out/spec.data-theme-dark.html   (JSON also carries `theme` + `outFiles`)
```
`emit-tokens.js` reads the page's `@theme`, resolves the `--color-* → var(--brand-*) → oklch()` chain, and emits a self-contained `spec.html` an engineer opens with zero tooling. **It now extracts custom properties by SELECTOR BLOCK, not flat last-wins** — so an active `[data-brand]`/`[data-theme]` override no longer leaks its value into the default handoff. **Default emit = `:root` + `@theme` only** (the always-applied cascade, no alt-brand/dark leak). Add **`--theme <selector>`** (loose match — ignores quotes/whitespace, e.g. `[data-theme=dark]`) to overlay that block on the base and write per-theme files `tokens.<slug>.json` / `spec.<slug>.html` (slug e.g. `data-theme-dark`), so multiple themes land in one out-dir without clobbering; an unknown selector → FATAL exit 2 listing the available theme selectors. (It parses `<style>` contents; a bare `.css` path falls back to the whole file.) Hand off **`tokens.json` + `spec.html`**, both regenerable, never a screenshot.

**Naming conventions (lock these):** `color.primary.500 → --brand-primary-500 → --color-primary-500 → bg-primary-500`. Drop `DEFAULT` in the var name (`color.primary.DEFAULT → --brand-primary`). Roles are nouns of intent (`surface/ink/muted/line/accent/on-accent`), ramps are numeric (`50…900`), never appearance words.

**Versioning (semver the token package):**
- **patch** — a value tweak that keeps the role's meaning (nudge accent L for contrast).
- **minor** — add a new token; nothing existing changes.
- **major (breaking)** — rename, remove, or change the *meaning* of a token. Ship a **rename map** (`old → new`) in the CHANGELOG so consumers can codemod in one pass. Treat a token rename like an API break, because it is — now machine-enforced: `brand-lint`'s `undefined-token-ref` ERROR (§VERIFY, source/dir mode) fails CI on a `var()` pointing at a renamed/removed token instead of letting it compile to nothing.

