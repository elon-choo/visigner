# tokens/ — the single source of truth for the design system

DTCG (Design Tokens Community Group) JSON is the **one place** brand values live. `scripts/build-tokens.js`
compiles it into the CSS the starter uses — edit the JSON, regenerate, no hand-edit drift across pages.

- `brand-default.tokens.json` — the starter's palette/type/elevation in DTCG shape. OKLCH-native (no hex).
  Each color keeps the exact CSS string in `$extensions["com.detail-page"].css` for 1:1 round-trip; the
  structured `$value.components` are there for tooling interop. Semantic tokens are aliases, e.g.
  `color.primary.DEFAULT → {color.primary.700}`, `color.on-accent → {color.ink}`.

## Compile

```bash
# the :root{--brand-*} source layer the starter's <style> uses (paste into a page's :root)
node ../scripts/build-tokens.js brand-default.tokens.json

# the @theme{ --color-*: var(--brand-*) } mapping for a fresh page
node ../scripts/build-tokens.js brand-default.tokens.json --emit=theme

# a second brand -> appended as a [data-brand="alt"] override block (only what it redefines)
node ../scripts/build-tokens.js brand-default.tokens.json brand-alt.tokens.json
```

CSS prints to **stdout** (pipe/paste it); a one-line JSON summary goes to **stderr**. The compiler resolves
`{alias}` references and **FATALs (exit 2) on a missing reference or an alias cycle** — it never emits broken CSS.

## Naming

A token path maps to a CSS var by dropping `DEFAULT` and prefixing:
`color.surface → --brand-surface`, `color.primary.500 → --brand-primary-500`, `color.primary.DEFAULT → --brand-primary`,
`font.display → --brand-font-display`, `shadow.e1 → --brand-shadow-e1`. The `@theme` map uses the same path with the
Tailwind namespace kept: `--color-primary-500`, `--font-display`, `--shadow-e1` — each pointing at its `--brand-*`.

## Adding a brand

Author a `brand-<name>.tokens.json` with **only the tokens that differ** (it inherits the rest at runtime via the
`--brand-*` cascade), then compile with the default file first so `[data-brand="<name>"]` overrides resolve. Only add
brand files when there is a real second-brand use case — don't author speculative brands (the OKLCH ramps are
hand-tuned with a deliberate chroma arc, not auto-generated). See `references/aesthetics.md` for the @theme/OKLCH method.
