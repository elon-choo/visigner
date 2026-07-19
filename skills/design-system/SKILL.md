---
name: design-system
description: >-
  Build and govern a design-token system — the single source of truth that keeps every page, app, and component visually consistent and lets ONE brand re-theme everything by swapping a mapping. Auto-invoke when the task is about tokens, theming, or system-level consistency in EITHER language: "design system", "디자인 시스템", "design tokens", "디자인 토큰", "tokenize this", "토큰화", theming / re-theme / "리브랜딩" / "테마 입히기", dark mode / "다크모드", multi-brand / "멀티브랜드" / white-label, "make these colors consistent / stop hardcoding hex", semantic tokens (--color-surface/ink/accent), OKLCH color ramp / "컬러 램프", spacing & type scale, elevation/shadow tokens, radius scale, motion tokens, component API / variant design ("variant vs prop", size scale, slots), DTCG / tokens.json / Style-Dictionary-style build, a Tailwind v4 @theme block, design-token spec sheet, dev handoff / "개발자 핸드오프", token versioning & changelog, or brand-consistency governance for a CEO. Owns the artifacts: tokens.json (DTCG), the @theme block, brand-<name>.tokens.json overrides, the spec.html swatch sheet, the brand-lint gate. NOT for: building a single landing/상세페이지 (→ detail-page), app/component UI screens (→ ui-design), or design→code build-out (→ frontend-build) — those CONSUME the system you author here.
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

> **Load on demand:** For the complete steps 1–7 token architecture, compiler, theming, component-API, and handoff playbook, read `references/token-system-playbook.md` when you reach those steps rather than loading it every time.

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
   ERROR (block ship): `raw-hex` / `raw-rgb` / `raw-hsl` color **outside `@theme`** · `banned-font` (Inter/Roboto/Arial/Open Sans/Lato/system-ui in any font-family or font CDN href) · `ai-purple` (an OKLCH color at **hue 255–310 AND chroma > 0.04** — floor lowered from 270 to **255** to also catch the convergent SaaS indigo at hue 255–270; the chroma floor still lets the brand's tinted grays at hue ~275/chroma ~0.012 pass, and **`ALLOW_PURPLE=1`** is the documented justification escape for a legitimately purple brand). WARN (review): emoji-as-icon, Tailwind arbitrary-bracket class. `tokenCoverage.rawColorsOutsideTheme` must read **0**. (Opt-in `BRAND_LINT_PX=1` adds an off-8pt-grid spacing warning.)

   **CI / source-tree governance** — point `brand-lint` at a **directory** to govern a whole component tree, not just one HTML page. It recurses `**/*.{html,htm,tsx,jsx,ts,js,css,scss,vue,svelte,astro}` (skips `node_modules`/`.git`/`dist`/`build`), catches **CSS-in-JS / quoted hex** (a hardcoded `#1a7f5a` in a className, inline `style`, styled-components template, JS string, or a `.css`/`.scss` value), and aggregates one report — the `@theme`/`:root` raw-color allowance applies **only inside an actual `@theme{}`/`:root{}` block**, so component source has zero hardcoded-color escape hatch. Exits 1 on any error-severity violation, so it drops straight into CI:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/brand-lint.js ./src [out.json]
   # DIR report: { pass, errorCount, warnCount, files:[{file,errorCount,warnCount,violations,tokenCoverage}], totals }
   # totals.rawColorsOutsideTheme must read 0; totals.filesWithErrors must read 0
   ```

   **Governance error rules (source/dir mode — promote the system's hard contracts to CI failures).** Beyond raw color, dir-mode now blocks the drift vectors §4/§BANNED only *described*: an **off-8pt-grid arbitrary spacing bracket** (`mt-[13px]`, `p-[7px]`, `gap-[7px]`) → `spacing-arbitrary-off-grid` ERROR; an **off-type-scale arbitrary font size** (`text-[15px]`, where the scale is 12/14/16/18/20/24/30/36/48/64) → `type-scale-arbitrary` ERROR; a component **referencing a `--brand-*` PRIMITIVE directly** via `var(--brand-*)` outside a `:root`/`@theme` block → `brand-primitive-ref` ERROR (the §1 "components read SEMANTIC only" rule, now enforced). Other arbitrary brackets stay `tailwind-arbitrary` WARN. Dir-mode ignore list also skips `.next`/`coverage`. An **`undefined-token-ref` ERROR** now enforces the §7 "token rename = API break" story: a `var(--color-*)` / `var(--font-*)` / `var(--shadow-*)` / `var(--brand-*)` whose name resolves to **no defined token** (renamed or deleted out from under it) fails CI instead of silently compiling to nothing. It builds the DEFINED token set from every `@theme{}`/`:root{}` declaration across the WHOLE tree first (so a token defined in one file and used in another still resolves), plus an additive allowlist-widening pass over the optional `--brand` DTCG file, then flags any reference outside that set as an ERROR carrying the offending name (snippet) + `file:line` (`where`). **SOURCE/DIR mode only** — single-file HTML (e.g. the starter `index.html`) is deliberately excluded, so that run is byte-for-byte unchanged; only those four design-token namespaces are checked (an arbitrary `--x` var is never flagged) and references inside comments are ignored. **Two coverage widenings in source mode:** (a) `banned-font` now catches a **quoted** `font-family` value (`font-family:"Inter", "Open Sans"`) — the dominant real CSS syntax for multi-word names, previously dropped; (b) the off-grid spacing / off-type-scale / arbitrary-bracket checks now also scan the **string-literal args of class-builder calls** (`cva`/`tv`/`cn`/`clsx`/`twMerge` — frontend-build §4's prescribed pattern) and **strings assigned to `*className`/`*Variants` identifiers**, not just `class`/`className` attributes — so an off-grid `p-[7px]` or banned font hidden inside a `cva({...})` no longer slips the gate (new violation `where` labels: `class-builder call`, `className identifier`). HTML single-file behavior is byte-unchanged. **`ALLOW_PURPLE=1`** is the "earned purple" override — it exempts a legitimately purple brand (a Magician strategy, per brand-identity) from the `ai-purple` gate in both linters; set it only with a stated reason.

   **Semantic on-brand mode (`--brand`) — data-driven, not eyeballed.** Point the single-file/page run at the brand's DTCG and (optionally) its voice lexicon to assert the page actually *uses* the declared brand:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/brand-lint.js <page.html> [out.json] \
     --brand brand.tokens.json [--lexicon voice.json]
   # → prints one line BEFORE the JSON: `on-brand: yes|no — <evidence>`
   ```
   It statically extracts the page's DECLARED token colors (the `--brand-*`/`--color-*` `oklch()` literals inside `:root{}`/`@theme{}`), maps each by name to the matching DTCG semantic role (`primary-700`, `surface`, …), and diffs with an **OKLab ΔE** (tolerance 0.02, override `BRAND_LINT_DELTAE`). A color past tolerance is an `off-brand-color` ERROR. If `brand.tokens.json` carries `logo:{minWidth,minHeight}`, any `<img>`/`<svg>` whose tag contains "logo" is checked against its declared width/height → undersized/no-dimensions is a `logo-undersize` WARN. With `--lexicon` (`{banned:[],owned:[]}`): a banned term in visible copy is a `banned-term` ERROR, a missing owned term a `missing-owned-term` WARN. Off-brand/banned violations count toward `errorCount` and the exit gate; the single-file report gains an additive `brand:{onBrand,evidence}` key. (`--brand` is positional-order-independent with `[out.json]`; in DIR mode it's ignored with a stderr note.)
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

### Wire the gate into CI (so drift can't merge)
The same four checks run unattended. The detail-page skill ships the scaffold — `npm` scripts, a GitHub Actions workflow, and a Husky pre-commit hook — so a team adopts governance without re-authoring it:
- **`npm` scripts** (`skills/detail-page/package.json`): `lint:brand` → `brand-lint.js ./src` (dir mode, non-zero on any error-severity finding) · **`lint:tokens`** → the **@theme↔DTCG drift self-test**, now **dual-layer**: it regenerates BOTH layers from the DTCG (`build-tokens.js --emit=theme` for `@theme`, and a no-`--emit` run brace-extracted for the `:root` primitives) and diffs the committed page's `@theme` AND its `:root --brand-*` keys (generated scale vars are excluded so they don't false-positive), printing `@theme<->DTCG + :root --brand-* in sync (…, 0 drift)` or exiting 1 with the drifted token list. The added `:root` diff catches a **hand-edited committed `--brand-*` VALUE** even when the `@theme` map is untouched (the prior single-layer check missed it). A stronger, paste-proof superset of the §VERIFY-2 diff. **The drift target is parameterized by env `TOKENS_TARGET`** (default `assets/starter/index.html`) so the same gate can assert a *production* build's `@theme` stays in sync with the DTCG source — e.g. `TOKENS_TARGET=examples/vite-tailwind/src/theme.generated.css npm run lint:tokens`. **Known gap (an override block can still drift):** `lint:tokens` only diffs the `:root --brand-*` and `@theme` blocks — it does **not** diff the override blocks (`[data-brand=…]`, `[data-theme="dark"]`), so a compiled override can silently diverge from its `.tokens.json` source. The committed dark block currently byte-matches the generator, but nothing guards it — extend `lint:tokens` to also diff each compiled override block against its source file. · `shoot` → `shoot.js` · `gate` → `AXE=1 GATE_EXIT=1 serve-shoot.js`.
- **Production proof — `examples/vite-tailwind/`** (`index.html` + `src/main.js` + `src/main.css` + `src/theme.generated.css` + `vite.config.js` + `package.json`): a minimal **Vite + Tailwind v4** app (`@tailwindcss/vite` plugin, no `tailwind.config`) whose entry imports the compiled `@theme` that `build-tokens.js` emits from `tokens/brand-default.tokens.json`. `theme.generated.css` is **generated** (its regen command is in the file's header comment) and held in-sync by the `TOKENS_TARGET` drift gate above — so the "one DTCG source → a real bundler build" claim is verified, not asserted. (Caveat: the example is validated structurally + via the `lint:tokens` drift gate; `npm install`/`vite build` were not run in-suite — supply-chain hygiene + out of the smoke set.)
- **`.github/workflows/design-gate.yml`** — copy-paste GitHub Actions, every step commented; all repo-specific paths live in one top `env:` block (`SRC_DIR=./src`, `SERVE_DIR=…/assets/starter`, `SERVE_FILE=index.html`, plus a `BRAND_TOKENS` knob for the ΔE gate). Job `lint`: `npm install` → brand-lint over `$SRC_DIR` → `npm run lint:tokens` (the dual-layer drift assertion) → **`Brand ΔE on-brand (per page, gates merges)`** — runs `brand-lint --brand $BRAND_TOKENS` over `$SRC_DIR` (dir/per-page) when it exists, else the committed entry page, so an **off-brand ΔE error now gates merges** (guarded: a missing `BRAND_TOKENS` emits a notice instead of failing the template). Job `gate`: `npx patchright install --with-deps chromium` → `serve-shoot.js --dir` with `AXE=1 GATE_EXIT=1` → uploads the screenshot artifact.
- **`.husky/pre-commit`** (Husky v9, POSIX sh, inert until a team installs husky) — lints only STAGED design files in single-file mode; any error-severity finding aborts the commit. No-op guards: `HUSKY=0` or a missing `brand-lint.js`.

## Hand-off to siblings
- **detail-page / ui-design / frontend-build** consume this `@theme` directly — point them at the compiled block, don't let them re-declare colors. `frontend-build` compiles the SAME `@theme` with the Tailwind CLI for production (swap the browser CDN, identical block).
- **brand-identity** feeds the chosen brand color/type INTO your primitive layer (it decides the hue; you build the ramp).
- The reusable screenshot loop (`scripts/shoot.js`) and the two-pass aesthetic method (`references/aesthetics.md`) are shared — invoke them via `${CLAUDE_PLUGIN_ROOT}`, never reinvent.
