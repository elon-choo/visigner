# Tooling — palette, fonts, components

Ordering principle: **identity → structure → flesh → accent → audit.** Lock the things that fight the AI-look (palette, font, real-world structure) before generating markup; they're hardest to retrofit.

## 0 · Palette + font FIRST — Realtime Colors + Fontshare

**Realtime Colors** (realtimecolors.com) — paints colors AND fonts onto a live website mockup so you judge contrast/hierarchy in context. Five slots map to 60-30-10: Background (60), Text, Primary (30, CTAs), Secondary, Accent (10, pop). Exports **CSS / Tailwind config / shadcn variables / OKLCH** in one click → make it the *only* theme so no default `indigo` leaks. Spacebar randomizes; 8 type-scale ratios. This is the single highest-leverage anti-"AI-purple" move.

**Fontshare** (fontshare.com) — free for commercial use (ITF). Go-to swaps for Inter: **Satoshi**, **General Sans**, **Clash Display/Grotesk**, Cabinet Grotesk, Switzer, Sentient (serif). Embed:
```html
<link href="https://api.fontshare.com/v2/css?f[]=clash-display@600,700&f[]=general-sans@400,500,600&display=swap" rel="stylesheet" />
```
```css
:root { --font-display: "Clash Display", sans-serif; --font-body: "General Sans", sans-serif; }
```
Or self-host the WOFF2 kit via `@font-face` for performance/privacy. Pair unexpected faces (display serif + different body, or display + mono). Set fonts before generating any markup.

## 1 · Structure (Mobbin)
**Mobbin** (mobbin.com) — 300k+ screens from 1,000+ real apps, by pattern/industry/flow. Not crawlable (account-gated); use it (or its encoded lessons) to decide the **section list and order** from real production patterns — realistic density, asymmetric layouts, real copy tone — before choosing components. Reference flows worth studying: Linear, Stripe, Notion, Airbnb (pricing/detail pages).

## 2 · Skeleton / bulk layout (HyperUI)
**HyperUI** (hyperui.dev) — 226+ pure **Tailwind v4** components, **no JS, no install, MIT**. Marketing (hero, pricing, FAQ, stats, CTA), Application (accordion, modal, tabs, tables), Ecommerce (product cards, product detail, cart), Neobrutalism. Copy markup → `class`→`className` for React → apply your Step-0 palette/font tokens. **Default for page structure and the bulk of a detail page** (spec table, FAQ accordion, gallery, footer) — opinion-free surface to inject a custom palette.

## 3 · Polish accents (Magic UI)
**Magic UI** (magicui.design) — 150+ free **MIT** animated components, shadcn-native install. Best for proof/social sections: logo **Marquee**, **Number Ticker** (stat counters), **Bento Grid**, device frames (iPhone/Safari) around product shots, animated testimonial list, Border/Shine Beam.
```bash
npx shadcn@latest init                       # one-time
npx shadcn@latest add @magicui/marquee @magicui/number-ticker @magicui/bento-grid
```
Has an MCP server for natural-language pulls: `pnpm dlx @magicuidesign/cli@latest install claude`.

## 4 · One hero/scroll "moment" (Aceternity UI)
**Aceternity UI** (ui.aceternity.com) — heavily-animated React + Tailwind + Framer Motion, shadcn-compatible. Use **at most one or two**: Aurora Background / Background Beams hero, Container Scroll Animation / Macbook Scroll product reveal, Hero Parallax, 3D Card, Text Generate Effect. One cinematic moment reads premium; five read as a demo.
```bash
npx shadcn@latest add https://ui.aceternity.com/registry/{component-name}.json
```
License: free components usable in unlimited end products; can't resell the components themselves as templates.

## Shared toolchain
All three libs share **shadcn CLI + Tailwind + motion(framer-motion) + cn**. Init once, register `@aceternity` and `@magicui` namespaces in `components.json`, then `add`. HyperUI needs nothing. Icons: **Phosphor / Radix / Lucide** — never emoji.

## End-to-end orchestration
0. Realtime Colors → non-default 60-30-10 palette; export Tailwind/shadcn tokens. Fontshare/Pretendard/KR display → display+body. Make them the only theme.
1. Mobbin (encoded) → section list & order; asymmetric, real density.
2. HyperUI → structural majority (pricing, FAQ, spec, gallery, footer).
3. Magic UI → marquee, number-ticker stats, bento, device frames, animated list.
4. Aceternity → one hero/scroll moment, max.
5. Anti-AI audit (see review-rubric.md): no unearned AI-purple default, non-Inter/KR fonts loaded, not every card rounded+shadow, ≥1 asymmetric layout, concrete copy, real section order.
