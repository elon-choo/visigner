---
name: frontend-build
description: >-
  Turn a design into real, accessible, responsive front-end code — and convert a screenshot, description, or Figma frame into working code. Use this skill whenever the task is to IMPLEMENT or SHIP UI, not just design it. Trigger phrases (English): "build this", "implement this design", "turn this screenshot/Figma/mockup into code", "code this up", "make it responsive", "make it accessible", "wire up shadcn", "convert this design to React", "build the component", "make a single-file HTML artifact of this". Korean: "코드로 만들어줘", "이 디자인 구현해줘", "이거 개발해줘", "피그마/스크린샷을 코드로", "리액트로 짜줘", "반응형으로 만들어줘", "접근성 맞춰줘", "shadcn으로 붙여줘", "퍼블리싱". Owns: design→code handoff, screenshot/Figma→working code, React/Next + Tailwind v4 + shadcn/ui apps, self-contained HTML+Tailwind artifacts, component variants/state coverage, semantic+keyboard accessibility, responsive/mobile implementation, and the verify-by-screenshot gate. The design→code half of the Visigner. For long-scroll sales/상세페이지 use detail-page; for component/app design exploration use ui-design; for the token system itself use design-system; for conversion copy, CTAs, and funnels use marketing-conversion.
---

# Frontend Build — design intent → a shippable, accessible artifact

This skill is where a design becomes code a real user can operate. Two failure modes to beat at once: (1) **AI-slop visuals** — div soup, no token system, generic fonts (handled by inheriting the suite's aesthetic spine); (2) **non-shippable code** — components that only render the happy path, break at 390px, or are unusable by keyboard/screen-reader. You are graded on pixels AND on the DOM. "I reviewed the code and it looks right" is banned; a screenshot + an axe pass is required.

You do NOT re-derive aesthetics here. The token system, banned defaults, and two-pass method live in `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/references/aesthetics.md` — plan the tokens there (or consume a `design-system` handoff), then implement them with the discipline below.

## The build loop (never skip 5–6)

```
1 INTAKE    → what is the source? (a) Step-2 token plan / design-system handoff, (b) screenshot/Figma, (c) prose brief
2 STACK     → pick HTML-artifact vs React-app from the matrix; scaffold from the non-slop starter
3 TOKENS    → wire ONE @theme block as the single source; no ad-hoc colors/fonts/spacing anywhere
4 BUILD     → semantic structure → variants (cva) → ALL states (loading/empty/error/disabled) → pull components
5 SHOOT     → render + screenshot via shoot.js with AXE=1 (desktop + 390px); read run.json.gate
6 VERIFY    → fix every §A fail (overflow >1px, axe serious/critical, broken asset); re-shoot until gate.overall=true
```
Iterate 4→5→6 at least once. Steps 1–3 are mostly thinking; show the user output once it will pass the gate, not before.

> **Load on demand:** For the stack matrix, token-consumption code, and component/state architecture examples, read `references/implementation-patterns.md` when you reach steps 2–4 rather than loading it every time.

## 5 · Tooling chain — exact commands

Full rationale + when-to-reach-for-each: `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/references/tooling.md`. The short version, in build order:

**Fonts (load BEFORE markup — banned: Inter/Roboto/system).** Latin via Fontshare, Korean via Pretendard:
```html
<link rel="preconnect" href="https://api.fontshare.com" crossorigin>
<link href="https://api.fontshare.com/v2/css?f[]=clash-display@600,700&f[]=general-sans@400,500,600&display=swap" rel="stylesheet">
<link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">
```
In Next, prefer `next/font/local` (self-host the WOFF2) so there's no render-blocking request and the font is subset.

**Structural bulk — HyperUI** (hyperui.dev): 226+ pure Tailwind v4 components, MIT, no install. Copy markup, run `class`→`className` for React, then strip its palette and apply YOUR `@theme` utilities. Default for pricing tables, FAQ accordions, spec tables, footers, galleries.

**Polish + one moment — Magic UI / Aceternity via the shadcn CLI** (after `shadcn init`):
```bash
npx shadcn@latest add @magicui/marquee @magicui/number-ticker @magicui/bento-grid
npx shadcn@latest add https://ui.aceternity.com/registry/{component-name}.json   # at most 1–2 cinematic moments
```

**Icons — one real set, never emoji:**
```bash
npm i @phosphor-icons/react        # or: lucide-react   |   @radix-ui/react-icons
```
Pick ONE family for the whole UI (mixing sets is a slop tell). `import { ArrowRight } from "@phosphor-icons/react"` — give meaningful icons `aria-label`, decorative ones `aria-hidden`.

(See sibling `ui-design` for the interaction/motion design of these states, and `marketing-conversion` for CTA/funnel copy.)

## 6 · Responsive — mobile-first, utilities not inline grids

- **Mobile-first**: write the base (no prefix) for 390px, add `sm:`/`md:`/`lg:` for wider. Tailwind v4 breakpoints: `sm`=40rem, `md`=48rem, `lg`=64rem, `xl`=80rem, `2xl`=96rem.
- **Multi-column = responsive utilities, NEVER inline `grid-template-columns`.** Use `grid grid-cols-1 md:grid-cols-3 gap-4`. A bare `style="grid-template-columns:repeat(3,1fr)"` that can't collapse is the #1 cause of mobile overflow.
- **Container queries when the component is reused at different widths** (a card in a wide main vs a narrow sidebar) — responsiveness should follow the component's box, not the viewport:
  ```html
  <div class="@container"><div class="grid @md:grid-cols-2 gap-4"> … </div></div>
  ```
- **The 390px no-horizontal-overflow rule is hard.** `img,svg,video{max-width:100%;height:auto}` (the starter sets this); wrap long unbroken tokens with `overflow-wrap:anywhere`; let grids collapse. `shoot.js` reports `mobileOverflowPx` + `overflowCulprits[]`; **>1px is a fail** — fix the offending element. **Never `overflow-x:hidden` to mask it** (that hides the bug and clips real content).
- Touch targets ≥44px (`min-h-11`); detail/sales pages get the mobile sticky thumb-zone CTA from the starter.

## 7 · Accessibility in code (the half that screenshots can't see)

Semantic HTML is the cheapest a11y win — get it right before reaching for ARIA:
- **Real elements**: `<button>` for actions, `<a href>` for navigation, `<nav>/<main>/<header>/<footer>` landmarks, one `<h1>` then a non-skipping heading order. A clickable `<div>` is a defect.
- **Names**: every input has a `<label htmlFor>` (or `aria-label`); every icon-only button has `aria-label`; images have real `alt` (`alt=""` only if decorative).
- **Keyboard**: everything operable without a mouse; logical tab order; modals trap focus and restore it on close (`Esc` closes); no positive `tabindex`. shadcn/Radix primitives give you this — don't rebuild a `<Dialog>` from a `<div>`.
- **Visible focus**: `:focus-visible` ring on every interactive element (the starter sets a 2px accent outline). Never `outline:none` without a replacement.
- **Motion**: gate every animation behind `motion-reduce:` / `@media (prefers-reduced-motion: reduce)`.
- **Contrast**: body text ≥ 4.5:1, large text / UI ≥ 3:1. If the bright accent can't carry white text at AA, use dark ink on it (the starter's `--color-on-accent` does this).
- **Forms**: associate errors with `aria-describedby`; mark invalid with `aria-invalid`; group radios/checkboxes in `<fieldset><legend>`.

The screenshot gate runs `axe-core` (below); for a full WCAG 2.2 AA audit (focus-appearance, target-size, reflow at 320px, reduced-motion paths) hand off to the **a11y-auditor** agent.

> **Load on demand:** For per-component axe tests, Storybook state scaffolds, and editor-governance setup, read `references/accessibility-tooling.md` when implementing the step-7 toolchain rather than loading it every time.

## 8 · Verify by screenshot — the gate that makes it real

Render YOUR output, screenshot it, and read both pixels and the a11y/overflow/asset gates. This is non-negotiable. One-time, install the headless browser via the **`/design-setup`** slash command (a Claude command, not a shell line — it runs `npm install` + `npx patchright install chromium` inside the plugin). Then, each iteration:
```bash
# HTML artifact — render the file directly:
AXE=1 GATE_EXIT=1 NODE_PATH=$(npm root -g) \
  node "${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/shoot.js" /tmp/build/index.html /tmp/build/shots
# React/Next (App Router) — build, serve on :3000 (create-next-app has no `preview`), then shoot the URL:
npm run build && npx next start -p 3000 &
AXE=1 GATE_EXIT=1 NODE_PATH=$(npm root -g) \
  node "${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/shoot.js" http://localhost:3000 /tmp/build/shots
# (Vite app instead: `npm run build && npm run preview &` → shoot http://localhost:4173)
```

**Don't hand-manage the serve/teardown — `serve-shoot.js` does build→serve→shoot→teardown in one call** (built-in Node modules only; no deps). It exits with `shoot.js`'s own code, so `GATE_EXIT=1` propagates straight to CI. Two modes:
```bash
ROOT=${CLAUDE_PLUGIN_ROOT}/skills/detail-page
# (a) STATIC dir — built-in static server on an EPHEMERAL port (no collisions), path-scoped to the dir:
AXE=1 GATE_EXIT=1 node $ROOT/scripts/serve-shoot.js --dir ./out --file index.html --out /tmp/shots
# (b) SERVE a real app — spawns your cmd, exports the chosen $PORT to it, TCP-polls until it accepts
#     (SERVE_TIMEOUT_MS default 30000), then shoots the URL and tears the server down:
AXE=1 GATE_EXIT=1 node $ROOT/scripts/serve-shoot.js --serve "npx next start -p \$PORT" --port 3000 --out /tmp/shots
# All shoot.js env knobs (AXE, GATE_EXIT, MAX_TILES…) pass through; anything after `--` is forwarded to shoot.js.
```
This is the React/Next gate wired for **CI**: the suite ships `.github/workflows/design-gate.yml` (a `gate` job that runs `npx patchright install --with-deps chromium` then `serve-shoot.js` with `AXE=1 GATE_EXIT=1` and uploads the screenshots) plus the `npm run gate` / `npm run lint:brand` scripts in the detail-page `package.json` and a `.husky/pre-commit` that brand-lints staged files. Drop them in to make "screenshot + axe pass" a merge requirement, not a manual step. (design-system owns the full CI-scaffold doc.)

**Gate the shipped React starter the same way** — after `npm i && npm run build` in `assets/starter-react/`, shoot its build with `serve-shoot.js` in either mode:
```bash
ROOT=${CLAUDE_PLUGIN_ROOT}/skills/detail-page
# (a) static dist:
AXE=1 GATE_EXIT=1 NODE_PATH=$(npm root -g) node $ROOT/scripts/serve-shoot.js --dir $ROOT/assets/starter-react/dist --file index.html
# (b) the pinned preview server (npm run preview → :4173):
AXE=1 GATE_EXIT=1 NODE_PATH=$(npm root -g) node $ROOT/scripts/serve-shoot.js --serve "npm --prefix $ROOT/assets/starter-react run preview" --url http://127.0.0.1:4173/
```
The local `NODE_PATH` prefix lets patchright's Chromium resolve (CI uses `npx patchright install --with-deps chromium`). Extend the token-drift gate to this app with `TOKENS_TARGET=skills/detail-page/assets/starter-react/src/index.css npm run lint:tokens`, and point a `brand-lint` step at `assets/starter-react`.

It writes a full-page desktop PNG, viewport tiles, a 390px mobile PNG, and `run.json`. **Read the tiles** (hierarchy, rhythm, the banned-default tells) AND **read `run.json.gate`:**

| Gate field | Hard fail when | Fix |
|---|---|---|
| `mobileOverflowPx` | `> 1` | read `overflowCulprits[]`; collapse the grid / wrap the token. NOT `overflow-x:hidden`. |
| `axe.gatingCount` (AXE=1) | `> 0` at serious/critical | fix the contrast/name/role/label; don't suppress the rule. `axeClean:null` = axe didn't load → re-run. |
| `gate.assetsOk` | `false` | `assets.badResponses` / `brokenImages` — fix the path (the #1 silent defect once real PNGs are placed). |
| `gate.report.overall` | `false` | a block check failed; `GATE_EXIT=1` makes CI exit 1. |

Ship only when `gate.report.overall === true` and the tiles read as designed-for-this-subject. Then run the suite's grade: score against `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/references/review-rubric.md` (gate ≥8/10, no dim <7, aesthetic distinctiveness ≥8). For an independent anti-slop + conversion + a11y critique, run the suite's turnkey gate — **`/design-review <file|url>`** — which fans the shots out to the **design-critic** + **a11y-auditor** agents and `brand-lint.js`, then returns one SHIP / CONDITIONAL / NO-SHIP verdict (the builder must not be the sole grader — generator/evaluator split).

## Screenshot / Figma → working code

A repeatable method (don't free-hand pixel-push):
1. **Identify the layout primitive** — is it a split hero? a 12-col grid? a centered stack? a bento? Name it before writing a `<div>`. One repeated primitive > 7 mismatched cards.
2. **Extract tokens, not pixels** — eyedrop the 4–6 real colors → transcribe to OKLCH in the `@theme` block; identify the display + body faces (match to a Fontshare/Google face, never assume Inter); read the spacing rhythm onto the 8pt scale. This is a `design-system` extraction — produce the token block first, then build to it. **When the source is a real Figma file, import the variables/styles instead of eyedropping:** the **Figma REST API** `GET /v1/files/:key/variables/local` (Dev Mode / Enterprise) or the **Figma MCP server** (Dev Mode "Get variables/code") returns Variables + styles as structured JSON — map that into the DTCG model and run it through `design-system`'s `build-tokens.js --from style-dictionary|tokens-studio` (which also normalizes Figma's sRGB hex/rgb to OKLCH), so the `@theme` is *derived* from the design source, not hand-transcribed. (The Figma-Tokens / Tokens Studio plugin exports the same shape for files without Dev Mode.)
3. **Build structure semantically** — landmarks + heading order from the visual hierarchy, not absolute positioning. From a Figma frame, read auto-layout → flex/grid + gap (Figma auto-layout maps almost 1:1 to flexbox).
4. **Add every state** the static comp doesn't show — loading/empty/error/disabled/focus/hover (§4). A screenshot is one state; ship five.
5. **Verify** with §8 — the rebuild must survive 390px + axe, and the tiles must match the source's intent (compare side-by-side).

For pixel-faithful matching, capture the source the same way reference pages are captured (`scripts/capture-reference.js`) and diff your output against it.

## Performance basics (cheap wins, do them by default)

- **Fonts**: `font-display:swap` + `preconnect`; self-host/subset in Next (`next/font`). Set `size-adjust`/fallback metrics or accept the swap — never a blank FOIT that shifts layout.
- **Images**: always set `width`/`height` or `aspect-ratio` so the box is reserved before load (prevents CLS); `loading="lazy" decoding="async"` for below-the-fold; `next/image` (or a `<picture>` with AVIF/WebP + correct `sizes`) in apps. Don't ship a 4000px hero scaled in CSS.
- **No layout shift**: reserve `min-height` on async/lazy panels (the starter gives `.artifact` a min-height); never insert content above what's in view.
- **JS discipline**: one orchestrated entrance animation, not scattered micro-interactions (also an aesthetic tell). Code-split heavy Aceternity moments (`next/dynamic`, client-only).

## Banned by default (override only if the brief explicitly demands it)
- ❌ **Emoji as icons/bullets.** One real icon set (Phosphor/Radix/Lucide).
- ❌ **Inter / Roboto / system fonts.** Load a distinctive display + body before markup.
- ❌ **Unearned purple→blue gradient on white** / generic "AI indigo" brand color.
- ❌ **`overflow-x:hidden` to mask 390px overflow.** Find the culprit; fix it.
- ❌ **Div soup** — clickable `<div>`s, no landmarks, no headings, `<div>` where `<button>`/`<a>`/`<nav>` belongs.
- ❌ **Pixel-pushing without a token system** — raw `#hex`/`px` scattered in markup instead of `@theme` utilities.
- ❌ **Ad-hoc variants** — conditional `className` ternaries instead of `cva`/`tailwind-variants`.
- ❌ **Happy-path-only components** — no loading/empty/error/disabled states.
- ❌ **Server data in `useState`** instead of TanStack Query/SWR; filter state in component state instead of the URL.
- ❌ **Inline `grid-template-columns`** that can't collapse; `outline:none` with no focus replacement; animations not gated by `prefers-reduced-motion`.
- ❌ **Shipping without a screenshot + axe pass.** "Looks right" is not a verification.
