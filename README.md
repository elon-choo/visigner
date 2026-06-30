# Visigner

[**한국어 README →**](README.ko.md) · [**Landing page**](https://elon-choo.github.io/visigner/) · [**Guide**](https://elon-choo.github.io/visigner/guide.html)

**Everything design, in one install.** Add this one repo to Claude Code and you get the whole design toolchain — landing pages, Korean 상세페이지/Wadiz pages, app & web UI, design tokens & systems, brand identity, UX flows & wireframes, design-to-code, and conversion/marketing — plus independent design-critic and accessibility-audit agents and a set of friendly slash commands. It bundles **7 skills · 3 agents · 9 commands · 26 built-in Node scripts**, so you stitch together far fewer installable design skills, plugins, or npm packages.

> **Honest scope (the same care as the rest of the suite).** Visigner has **no external performance benchmark** — there are no conversion/speed numbers to quote, and it won't invent any. What's recountable is the inventory above (`ls skills/ agents/ commands/`), the design-critic's **10-dimension** rubric, the **WCAG 2.2 AA** target, and 2 real Wadiz captures. It **feeds** Figma/Photoshop/hosting/ESP rather than replacing them, image slots fall back to lo-fi SVG comps without an API key, and compliance is left to you. See **[the guide's boundaries table](https://elon-choo.github.io/visigner/guide.html#boundaries)**.

It's built on Anthropic's `frontend-design` aesthetic discipline (plan a token system, reject the generic defaults) and a **screenshot self-critique loop** — so the output does not read as AI-generated.

### What this replaces vs. what it feeds

- **Replaces** — other installable design *skills / plugins / packages* for Claude Code. The suite produces the actual artifacts: page/component **code**, **SVG**, design **tokens**, handoff **specs**, **diagrams/wireframes**, conversion **copy**, ESP-ready **email HTML**, the **experiment stats** (A/B sizing, Welch t / SRM / Bayesian readouts, funnel drop-off), and the **test math** (contrast, touch targets, overflow) — all as zero-dependency Node scripts.
- **Feeds, does not replace** — it hands off to the tools downstream of design, it does not become them: live-canvas GUIs (**Figma / FigJam**), raster editors (**Photoshop**), and runtime infrastructure (**web hosting**, **ESP send**, the **analytics warehouse**). You still ship through those.
- **Real photo/illustration generation** needs an image API key (`OPENAI_API_KEY` / `GEMINI_API_KEY`) or a ChatGPT login; without one, each image slot **renders as an intentional lo-fi comp** — a deterministic, on-brand SVG (classified into one of eight comp archetypes — incl. logo-scaffold, hero, and portrait — full palette, slot tag) that marks the slot's intent, *not* a finished asset. The operator still replaces these comps with real art before shipping. The **screenshot browser** is installed once by **`/design-setup`**.

---

## Install (two commands)

In Claude Code:

```
/plugin marketplace add elon-choo/visigner
/plugin install visigner@visigner
```

That's it — all skills, agents, and commands are now available. Requires Claude Code **v2.1.100+** (`claude --version`).

> **One-time setup for the power features (optional):** the screenshot self-critique loop, live reference capture, and image-asset placement use a headless browser. Run **`/design-setup`** once to install it. Everything else — planning, designing, writing code, reviewing — works immediately with no setup.

### Team install (auto-enable for everyone)

Commit this to your project's `.claude/settings.json` and teammates get it automatically on trust:

```json
{
  "extraKnownMarketplaces": {
    "visigner": { "source": { "source": "github", "repo": "elon-choo/visigner" } }
  },
  "enabledPlugins": { "visigner@visigner": true }
}
```

---

## Start here (by who you are)

| You are a… | Type this | You get |
|---|---|---|
| **Not sure / vibe-coder** | `/design <describe what you want>` | It routes you, pins the brief, and builds to a quality gate |
| **Marketer / founder** | `/landing <product>` | A converting landing or 상세페이지/Wadiz page that isn't slop |
| **Product designer** | `/ui <screen or app>` | App/web UI & components with full states, graded from pixels |
| **Brand designer / CEO** | `/brand <business>` | Strategy → voice → visual identity system |
| **Planner / PM (기획자)** | ask for a plan/wireframe | Flows, IA, wireframes, and a buildable spec (`ux-flows` skill) |
| **Developer** | `/ui` or describe the build | React/Tailwind v4/shadcn implementation, accessible & responsive |
| **Anyone shipping** | `/design-review <page>` | An independent SHIP / NO-SHIP verdict |

You usually don't need to name anything — just describe the task in plain language and the matching **skill auto-triggers**. The commands are shortcuts.

---

## What's inside

### Skills (auto-trigger on relevant work)
- **detail-page** — landing pages + Korean 상세페이지 / Wadiz·텀블벅 funding pages, image-asset generation, and the screenshot self-critique loop. Anti-AI-slop aesthetics + Korean conversion structure (PASONA, Schwartz awareness×sophistication). Ships with real Wadiz reference captures for calibration.
- **ui-design** — app / web / product UI, dashboards, SaaS, forms, and components — every interactive state, motion discipline, the anti-slop bar applied to product UI. Ships gate-passing HTML seeds incl. a `pricing.html` plan-comparison page and a `settings.html` account screen alongside the index/landing/app-shell scaffolds; **dark mode is turnkey** in both HTML starters (active `[data-theme=dark]` + a toggle), and `icon-set.js` generates a coherent first-party SVG icon family + verification sheet.
- **design-system** — design tokens (DTCG + Tailwind v4 `@theme`), OKLCH ramps, semantic theming, multi-brand (`brand-alt.tokens.json` ships as a worked cobalt+coral second brand) & dark mode (a compiled-from-DTCG `brand-dark.tokens.json` ships; an override can now target **any** selector via a `$selector` field), dev handoff spec sheets, and a `brand-lint` `undefined-token-ref` gate (a `var()` to a renamed token fails CI).
- **brand-identity** — brand strategy (positioning, archetypes), verbal identity (voice, naming, messaging), and visual identity (logo direction, color, type, imagery).
- **ux-flows** — the planner's home: idea → user flows → information architecture → wireframes → acceptance spec.
- **frontend-build** — design → working code: React/Next + Tailwind v4 + shadcn/ui, accessibility, responsive, screenshot/Figma → code, verify-by-screenshot. Ships a runnable **React + Vite + Tailwind v4** starter (`assets/starter-react/`, a cva `Button` + a stateful screen, now with **Framer `motion`** — a reduced-motion-gated shared-`layoutId` card→modal — and **dark mode**) and a flat-config `eslint.config.js` a11y preset.
- **marketing-conversion** — funnel mapping, CRO, conversion copy frameworks, A/B hypotheses, channel copy, and the metrics that matter.

### Agents (independent reviewers — the generator never grades itself)
- **design-critic** — anti-slop visual + conversion critique with a 10-dimension rubric and a SHIP/NO-SHIP gate, graded from real screenshots.
- **a11y-auditor** — WCAG 2.2 AA audit (contrast, keyboard, focus, names/roles, reduced-motion).
- **design-director** — sets strong, non-generic art direction (token system + signature element) before building.

### Commands
`/design` (router) · `/landing` · `/ui` · `/brand` · `/plan` · `/campaign` · `/design-tokens` · `/design-review` · `/design-setup`

`/campaign` pins ONE idea and ladders it across landing + paid ad + social + an email sequence, then checks cross-surface message-match presence with the deterministic copy floor (`copy-lint.js --idea`, `--strict` to gate) + the email floor + an independent `design-critic MODE=copy` semantic grade.

---

## The quality bar (why output doesn't look AI-generated)

Left alone, a model emits the high-probability **generic center** — the "AI slop" look (Inter font, purple-on-white gradient, four equal stat cards, everything centered). Every skill here fights that with the same spine:

1. **Plan a token system before coding** — color / type / layout / a named *signature* element — and critique it against what you'd produce for *any* similar brief; change whatever matches the default.
2. **Banned defaults** — explicit lists of the generic tells to avoid.
3. **Verify from pixels** — render and screenshot your own output (`shoot.js`), then grade what you SEE against a rubric, with an independent critic. "I reviewed the code and it looks right" is not allowed.

---

## Bundled zero-dep scripts (no npm install, built-in Node only)

Beyond the screenshot loop (`shoot.js`), the suite ships runnable helpers you invoke directly:
- **`ab.js`** — A/B sizing + readouts: proportion z-test, Welch t-test for revenue/AOV, SRM guardrail (chi-square), Bayesian P(B>A) + expected loss, a **peek-safe always-valid sequential** readout (`seq`, mixture SPRT — stop/continue at any time), a paid-channel **`roas`** sanity (CAC/ROAS/AOV + profit/breakeven verdict), multi-variant Bonferroni/Šidák, and an N-bucket exposure snippet.
- **`pull-funnel.js`** — read-only PostHog/GA4 funnel: ordered step counts + drop-off %, segmented by source × device (no key → prints the event/UTM schema to instrument).
- **`email.js` / `email-lint.js`** — emit an ESP-pasteable responsive HTML email (600px table layout, inlined CSS, Outlook VML CTA) and a deterministic copy linter (spam/subject/CTA/lexicon) that's the machine floor under the LLM copy critique. (Spam severity is split: true spam tells stay ERROR, borderline launch phrases like "limited time" are now WARN.) Korean-aware via `--locale ko` (or a `--voice voice.json` pack): KR slop/spam tells + grapheme-counted subject/preview budgets.
- **`copy-lint.js`** — the non-email companion floor: a deterministic per-CHANNEL gate for paid-ad / social / push copy (length budgets, AI-slop banned verbs, a required CTA) + an optional `--idea` cross-surface message-match (a **presence-only** floor over the **whole surface copy** — hero + primary + subhead/body — WARN by default; teach it paraphrases via `--synonyms`; *semantic* match stays `design-critic MODE=copy`). Same `--locale ko` Korean pack. Powers the **`/campaign`** command's one-idea ladder.
- **`plan-lint.js`** — the deterministic floor under `design-critic MODE=plan`: lints a ux-flows PRD/plan markdown for 11 required sections + 3 structural floors (event-spec table, per-flow error path, inventory↔acceptance-criteria coverage).
- **`name-check.js`** — brand-naming conflict sweep: authoritative `.com` domain availability via RDAP, best-effort GitHub/npm handle probes, and prefilled USPTO/WIPO/EUIPO trademark search URLs. (`.co`/`.io` report `unknown` — no RDAP coverage.)
- **`serve-shoot.js`** — build/serve → shoot → teardown in one call (static dir or a spawned app), exiting with `shoot.js`'s code so it drops into **CI**.
- **`bin/shoot` & `bin/brand-lint`** — thin wrappers that resolve the global `node_modules` + the shared script path, so the long `NODE_PATH=$(npm root -g) node …/scripts/shoot.js` incantation becomes `bin/shoot <file|url>` (and `bin/brand-lint <page>`). Same env knobs and exit codes pass through.
- **`icon-set.js`** — emits a coherent first-party SVG icon family from a small spec (shared grid/stroke/caps, per-icon optical correction) + a self-contained `icon-grid.html` verification sheet (every icon at 16/24/32px on light + dark). No spec → the **full 39-icon library** for a real product UI (`--icons=…` to narrow).
- **`brand-book.js`** — one command → ONE self-contained brand `guidelines.html`: palette swatches, type ramp, the logo on full / mono / knockout tiles, and a voice Do/Don't grid + lexicon (when a `voice.json` is given).
- **`logo-handoff.js`** — one `mark.svg` → the artboard SET (full-color / mono / knockout / favicon / app-icon / social-avatar SVGs + an `index.html` preview), every board nesting the SAME mark with clear-space + min-size baked in. Handles CJK/non-Latin brand names in the no-key lettermark scaffold (고요 → 고).
- **`skills/brand-identity/assets/logo-grid.html`** — a self-contained logo verification sheet: slots one mark (`?svg=/abs/mark.svg` or inline) and renders the 3-size × 3-color (full / mono / knockout) matrix, so the mono/knockout/small-size test is one `shoot.js` pass.
- **CI gate (templates)** — `.github/workflows/design-gate.yml`, the `npm run lint:brand` / `lint:tokens` / `gate` scripts (defined in `skills/detail-page/package.json`, so run them from that dir or copy the scripts into your own repo's `package.json`), and a `.husky/pre-commit` hook make brand-lint, the @theme↔DTCG drift check (target via env `TOKENS_TARGET`), and the screenshot+axe gate a merge requirement. These ship as templates inside the plugin — adapt them into your project's CI/`package.json`.
- **Inline editor governance** — frontend-build documents a **flat-config ESLint preset** (`eslint-plugin-jsx-a11y` + a Tailwind class rule) paired with a `bin/brand-lint ./src` editor hook, so static-a11y + token-leak feedback shows up as you type, not only at commit/CI time.

## Notes

- **Image generation & live capture** need a one-time `/design-setup` (Patchright + Chromium). Image *generation* additionally needs an API key (`OPENAI_API_KEY` / `GEMINI_API_KEY`) or a ChatGPT login; without one, image slots render as **intentional lo-fi comps** (deterministic on-brand SVG) the operator replaces with real art.
- **Compliance** (ad/labeling law, claim substantiation) is intentionally left to you — the suite optimizes for design and conversion quality, not legal review.
- License: MIT.
