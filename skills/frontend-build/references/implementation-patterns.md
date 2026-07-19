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

**Or start from the shipped runnable React scaffold** — `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/assets/starter-react/` is a **Vite + React 18 + Tailwind v4** (`@tailwindcss/vite`) + `class-variance-authority` app, the suite's first installable React/shadcn-style example. `src/index.css` holds `@import 'tailwindcss'` + the generated `:root`/`@theme` token blocks (single source = `tokens/brand-default.tokens.json`) plus a compiled **`[data-theme="dark"]`** block + a no-flash `data-theme` restore in `index.html` and a ☾/☀ toggle; `Button.tsx` is a cva recipe of semantic Tailwind tokens rendering every interaction state; `App.tsx` is one accessible, stateful screen that now includes a worked **shared-`layoutId` card→modal** built with the `motion` (Framer, `^11.11.0`) dependency, gated by `useReducedMotion()` (it drops the `layoutId`/hover/scale and zeroes tweens when reduced). Build it:
```bash
cd ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/assets/starter-react && npm i && npm run build   # → dist/  (npm run preview pins :4173)
```
**Film the two motion examples** (the card→modal here, and the token-driven slide-over **drawer** in `assets/starter/app-shell.html` — `transform`+`opacity` only, durations/easing from `--dur-*`/`--ease-*`, parked off-screen in a fixed overflow-clipped `.drawer-root` so it never widens the doc, with `role="dialog"`/`aria-modal`, Esc + scrim/close, and focus to/from the trigger):
```bash
ROOT=${CLAUDE_PLUGIN_ROOT}/skills/detail-page
MOTION_TRIGGER='[data-card]:click' NODE_PATH=$(npm root -g) node $ROOT/scripts/shoot.js http://127.0.0.1:4173/ /tmp/out   # starter-react card→modal
FILMSTRIP=1 MOTION_TRIGGER='#openDrawer:click' NODE_PATH=$(npm root -g) node $ROOT/scripts/shoot.js $ROOT/assets/starter/app-shell.html /tmp/out   # app-shell drawer
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

