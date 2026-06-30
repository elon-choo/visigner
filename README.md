# Claude Design Suite

**Everything design, in one install.** Add this one repo to Claude Code and you get the whole design toolchain — landing pages, Korean 상세페이지/Wadiz pages, app & web UI, design tokens & systems, brand identity, UX flows & wireframes, design-to-code, and conversion/marketing — plus independent design-critic and accessibility-audit agents and a set of friendly slash commands. **No other installable design skill, plugin, or npm package needed for design work in Claude Code.**

It's built on Anthropic's `frontend-design` aesthetic discipline (plan a token system, reject the generic defaults) and a **screenshot self-critique loop** — so the output does not read as AI-generated.

### What this replaces vs. what it feeds

- **Replaces** — other installable design *skills / plugins / packages* for Claude Code. The suite produces the actual artifacts: page/component **code**, **SVG**, design **tokens**, handoff **specs**, **diagrams/wireframes**, conversion **copy**, ESP-ready **email HTML**, the **experiment stats** (A/B sizing, Welch t / SRM / Bayesian readouts, funnel drop-off), and the **test math** (contrast, touch targets, overflow) — all as zero-dependency Node scripts.
- **Feeds, does not replace** — it hands off to the tools downstream of design, it does not become them: live-canvas GUIs (**Figma / FigJam**), raster editors (**Photoshop**), and runtime infrastructure (**web hosting**, **ESP send**, the **analytics warehouse**). You still ship through those.
- **Real photo/illustration generation** needs an image API key (`OPENAI_API_KEY` / `GEMINI_API_KEY`) or a ChatGPT login; without one, each image slot **renders as an intentional lo-fi comp** — a deterministic, on-brand SVG (classified into one of five comp archetypes, full palette, slot tag) that marks the slot's intent, *not* a finished asset. The operator still replaces these comps with real art before shipping. The **screenshot browser** is installed once by **`/design-setup`**.

---

## Install (two commands)

In Claude Code:

```
/plugin marketplace add elon-choo/claude-design-suite
/plugin install design-suite@design-suite
```

That's it — all skills, agents, and commands are now available. Requires Claude Code **v2.1.100+** (`claude --version`).

> **One-time setup for the power features (optional):** the screenshot self-critique loop, live reference capture, and image-asset placement use a headless browser. Run **`/design-setup`** once to install it. Everything else — planning, designing, writing code, reviewing — works immediately with no setup.

### Team install (auto-enable for everyone)

Commit this to your project's `.claude/settings.json` and teammates get it automatically on trust:

```json
{
  "extraKnownMarketplaces": {
    "design-suite": { "source": { "source": "github", "repo": "elon-choo/claude-design-suite" } }
  },
  "enabledPlugins": { "design-suite@design-suite": true }
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
- **ui-design** — app / web / product UI, dashboards, SaaS, forms, and components — every interactive state, motion discipline, the anti-slop bar applied to product UI.
- **design-system** — design tokens (DTCG + Tailwind v4 `@theme`), OKLCH ramps, semantic theming, multi-brand & dark mode, and dev handoff spec sheets.
- **brand-identity** — brand strategy (positioning, archetypes), verbal identity (voice, naming, messaging), and visual identity (logo direction, color, type, imagery).
- **ux-flows** — the planner's home: idea → user flows → information architecture → wireframes → acceptance spec.
- **frontend-build** — design → working code: React/Next + Tailwind v4 + shadcn/ui, accessibility, responsive, screenshot/Figma → code, verify-by-screenshot.
- **marketing-conversion** — funnel mapping, CRO, conversion copy frameworks, A/B hypotheses, channel copy, and the metrics that matter.

### Agents (independent reviewers — the generator never grades itself)
- **design-critic** — anti-slop visual + conversion critique with a 10-dimension rubric and a SHIP/NO-SHIP gate, graded from real screenshots.
- **a11y-auditor** — WCAG 2.2 AA audit (contrast, keyboard, focus, names/roles, reduced-motion).
- **design-director** — sets strong, non-generic art direction (token system + signature element) before building.

### Commands
`/design` (router) · `/landing` · `/ui` · `/brand` · `/design-tokens` · `/design-review` · `/design-setup`

---

## The quality bar (why output doesn't look AI-generated)

Left alone, a model emits the high-probability **generic center** — the "AI slop" look (Inter font, purple-on-white gradient, four equal stat cards, everything centered). Every skill here fights that with the same spine:

1. **Plan a token system before coding** — color / type / layout / a named *signature* element — and critique it against what you'd produce for *any* similar brief; change whatever matches the default.
2. **Banned defaults** — explicit lists of the generic tells to avoid.
3. **Verify from pixels** — render and screenshot your own output (`shoot.js`), then grade what you SEE against a rubric, with an independent critic. "I reviewed the code and it looks right" is not allowed.

---

## Bundled zero-dep scripts (no npm install, built-in Node only)

Beyond the screenshot loop (`shoot.js`), the suite ships runnable helpers you invoke directly:
- **`ab.js`** — A/B sizing + readouts: proportion z-test, Welch t-test for revenue/AOV, SRM guardrail (chi-square), Bayesian P(B>A) + expected loss, multi-variant Bonferroni/Šidák, and an N-bucket exposure snippet.
- **`pull-funnel.js`** — read-only PostHog/GA4 funnel: ordered step counts + drop-off %, segmented by source × device (no key → prints the event/UTM schema to instrument).
- **`email.js` / `email-lint.js`** — emit an ESP-pasteable responsive HTML email (600px table layout, inlined CSS, Outlook VML CTA) and a deterministic copy linter (spam/subject/CTA/lexicon) that's the machine floor under the LLM copy critique.
- **`serve-shoot.js`** — build/serve → shoot → teardown in one call (static dir or a spawned app), exiting with `shoot.js`'s code so it drops into **CI**.
- **CI gate** — `.github/workflows/design-gate.yml` + `npm run lint:brand` / `lint:tokens` / `gate` + a `.husky/pre-commit` hook make brand-lint, the @theme↔DTCG drift check, and the screenshot+axe gate a merge requirement.

## Notes

- **Image generation & live capture** need a one-time `/design-setup` (Patchright + Chromium). Image *generation* additionally needs an API key (`OPENAI_API_KEY` / `GEMINI_API_KEY`) or a ChatGPT login; without one, image slots render as **intentional lo-fi comps** (deterministic on-brand SVG) the operator replaces with real art.
- **Compliance** (ad/labeling law, claim substantiation) is intentionally left to you — the suite optimizes for design and conversion quality, not legal review.
- License: MIT.
