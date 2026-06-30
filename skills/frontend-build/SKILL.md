---
name: frontend-build
description: Turn a design into real, accessible, responsive front-end code — and convert a screenshot, description, or Figma frame into working code. Use this skill whenever the task is to IMPLEMENT or SHIP UI, not just design it. Trigger phrases (English): "build this", "implement this design", "turn this screenshot/Figma/mockup into code", "code this up", "make it responsive", "make it accessible", "wire up shadcn", "convert this design to React", "build the component", "make a single-file HTML artifact of this". Korean: "코드로 만들어줘", "이 디자인 구현해줘", "이거 개발해줘", "피그마/스크린샷을 코드로", "리액트로 짜줘", "반응형으로 만들어줘", "접근성 맞춰줘", "shadcn으로 붙여줘", "퍼블리싱". Owns: design→code handoff, screenshot/Figma→working code, React/Next + Tailwind v4 + shadcn/ui apps, self-contained HTML+Tailwind artifacts, component variants/state coverage, semantic+keyboard accessibility, responsive/mobile implementation, and the verify-by-screenshot gate. The design→code half of the Claude Design Suite. For long-scroll sales/상세페이지 use detail-page; for component/app design exploration use ui-design; for the token system itself use design-system; for conversion copy, CTAs, and funnels use marketing-conversion.
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

## 2 · Stack — pick deliberately

| Signal | Stack | Why |
|---|---|---|
| One page, must open by double-click, you'll hand a file to a non-dev, a Wadiz/상세 mockup | **HTML + Tailwind v4 (Play CDN)**, single `index.html` | Zero install, zero build, portable. Scaffold = the suite starter (below). |
| Real app, routing, data, forms, auth, reused components | **React/Next (App Router) + Tailwind v4 + shadcn/ui** | Composable primitives you OWN (copied in, not a black-box dep), Server Components, real state. |
| Existing repo | **Match what's there.** | Don't introduce a second styling system. Read `package.json` first; respect the repo's conventions (run `fable-seed` if no AGENTS.md). |

**Scaffold the HTML artifact from the non-slop starter — never from a blank file:**
```bash
cp "${CLAUDE_PLUGIN_ROOT}/skills/detail-page/assets/starter/index.html" /tmp/build/index.html
```
It already wires `@tailwindcss/browser@4` + a `@theme` OKLCH token layer + Pretendard/Fontshare fonts (not Inter) + `:focus-visible` + `prefers-reduced-motion` + a 390px-safe media reset + an optional mobile sticky thumb-zone bar. Replace tokens and content; do not strip the discipline.

**Scaffold the React app:**
```bash
npx create-next-app@latest app --ts --tailwind --eslint --app --src-dir --import-alias "@/*"
cd app && npx shadcn@latest init        # Tailwind v4, CSS variables: yes, base color: neutral (recolor in @theme)
```

## 3 · Consume tokens AS CODE — one `@theme` block, no exceptions

The Step-2/`design-system` plan is the single source of truth. Express **every** color/font/shadow ONCE inside a Tailwind v4 `@theme` block; v4 emits BOTH a CSS variable AND a utility for each token, so there is no parallel `tailwind.config` colors object or second `:root` hex list to drift. For React this lives in `app/globals.css`:

```css
/* app/globals.css */
@import "tailwindcss";
:root {                                   /* raw OKLCH primitives — the only place hex/oklch literals exist */
  --brand-surface: oklch(0.985 0.008 95);
  --brand-ink:     oklch(0.205 0.012 275);
  --brand-accent:  oklch(0.720 0.160 58); /* the 10% — reserved for the primary CTA */
}
@theme {                                  /* maps each token → a Tailwind utility + var */
  --color-surface: var(--brand-surface);  /* → bg-surface / text-surface */
  --color-ink:     var(--brand-ink);      /* → text-ink */
  --color-accent:  var(--brand-accent);   /* → bg-accent */
  --font-display:  "Clash Display", sans-serif;  /* → font-display ; NEVER Inter/Roboto */
  --shadow-e2:     0 6px 16px oklch(0.20 0.02 270 / 0.10);  /* → shadow-e2 */
}
```
Then in markup write `class="bg-surface text-ink shadow-e2 font-display"` and reach for `var(--color-accent)` only inside one-off inline styles. **Rules:** ramps step Lightness in near-even moves at near-fixed Hue (OKLCH, never naive lighten/darken); override `--brand-*` under `[data-brand="alt"]` to re-theme the whole tree (multi-brand). Never reintroduce a `tailwind.config` `colors:{}` next to a `:root` list. A raw `#hex` in markup = a token leak = fix it. (Lint it with `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/brand-lint.js`.)

## 4 · Component architecture

**Composition over configuration.** Prefer small composable parts (`<Card><Card.Header/><Card.Body/></Card>`) over a 20-prop mega-component. shadcn/ui primitives are composable by design — extend them, don't wrap them in config soup.

**Variants via `cva` (class-variance-authority) or `tailwind-variants`** — the variant axes are part of the design system, not ad-hoc `className` strings:
```bash
npm i class-variance-authority clsx tailwind-merge   # cn() = twMerge(clsx(...))
```
```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center font-display rounded-xl min-h-11 transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:opacity-50 disabled:pointer-events-none motion-reduce:transition-none",
  {
    variants: {
      intent: { primary: "bg-accent text-on-accent", quiet: "bg-transparent text-ink hover:bg-ink/5" },
      size:   { md: "px-6 text-base", lg: "px-8 text-lg" },
    },
    defaultVariants: { intent: "primary", size: "md" },
  }
);
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button> & { loading?: boolean };
export function Button({ intent, size, loading, disabled, children, className, ...rest }: Props) {
  return (
    <button className={cn(button({ intent, size }), className)} disabled={disabled || loading} aria-busy={loading} {...rest}>
      {loading ? <Spinner aria-hidden /> : null}{children}
    </button>
  );
}
```

**State coverage is part of "done" — render ALL of these, not just the happy path.** A component that only handles success is a bug:

| State | Must show | Common miss |
|---|---|---|
| **loading** | skeleton or spinner with `aria-busy`; reserve the final height (no CLS) | spinner that collapses layout |
| **empty** | an invitation to act, not a blank box ("No projects yet — Create one") | rendering `0 results` with no next step |
| **error** | what happened + a retry, never "Something went wrong" alone | swallowing the error, infinite spinner |
| **disabled** | `disabled` attr (not just greyed CSS) so it's truly inert + non-focusable trigger | a `<div>` that looks disabled but still clicks |
| **success/idle** | the real content with real copy | placeholder lorem that ships |

**Controlled vs uncontrolled — default to uncontrolled, lift only when needed.** Start inputs uncontrolled (`defaultValue`, read on submit / via `ref`); promote to controlled (`value` + `onChange`) ONLY when a parent must react to every keystroke (live validation, dependent fields, formatting). State lives at the **lowest common ancestor** of the components that read it — colocate first, lift only on demand. **Server data is not `useState`** — use TanStack Query or SWR (cache, revalidate, dedupe); URL/filter state belongs in the URL (`searchParams`), not component state. Form state: React Hook Form + Zod resolver for anything past two fields.

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

### 7b · Per-component a11y tests + a stories scaffold (catch the regression in CI, not in review)
The §8 shoot is a page-level smoke gate; a **component** a11y test fails the build the moment a `<Dialog>` loses its label or a button its name. Two equivalent recipes — pick by what the repo already runs:

**Vitest + jest-axe** (unit/jsdom — fast, no browser; best for a Vite/RHF component repo):
```bash
npm i -D vitest jsdom @testing-library/react @testing-library/jest-dom jest-axe @types/jest-axe
```
```tsx
// Button.test.tsx
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { Button } from "./Button";
expect.extend(toHaveNoViolations);
it("has no a11y violations in each state", async () => {
  for (const props of [{}, { disabled: true }, { loading: true }]) {     // test the STATE MACHINE, not just default
    const { container } = render(<Button {...props}>Save</Button>);
    expect(await axe(container)).toHaveNoViolations();
  }
});
```
**@axe-core/playwright** (real-browser — catches focus-visible/contrast that jsdom can't; use when you already run Playwright):
```bash
npm i -D @playwright/test @axe-core/playwright
```
```ts
import AxeBuilder from "@axe-core/playwright";
test("component story is axe-clean", async ({ page }) => {
  await page.goto("/iframe.html?id=button--loading");                    // a Storybook story URL, or any mounted route
  const r = await new AxeBuilder({ page }).withTags(["wcag2a","wcag2aa"]).analyze();
  expect(r.violations).toEqual([]);
});
```
Gate on `serious`/`critical` (mirror the §8 `axe.gatingCount` floor) so a component test fails the same class of defect the page gate does.

**Minimal Storybook stories scaffold** — one `*.stories.tsx` per component renders **every state as a named story**, which (a) is the visual catalogue a designer reviews and (b) gives the Playwright recipe above its per-state URLs. Don't over-invest; one story per state is the floor:
```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";
const meta: Meta<typeof Button> = { component: Button, args: { children: "Save changes" } };
export default meta;
export const Default: StoryObj<typeof Button> = {};
export const Loading: StoryObj<typeof Button> = { args: { loading: true } };
export const Disabled: StoryObj<typeof Button> = { args: { disabled: true } };
```
Scaffold with `npx storybook@latest init` only if the team wants the catalogue; the stories file is useful on its own as the state inventory even without running Storybook.

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
