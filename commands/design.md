---
name: design
description: The front door to the Visigner. Describe what you want in plain language ("a landing page for my coffee subscription", "a dashboard for a logistics app", "a brand for a kids' dental clinic", "make this look less AI-generated") and this routes you to the right capability, pins the brief, and runs it to a quality gate. Use when you are not sure which design skill you need.
---

# /design — describe it, get expert design

The user's request: **$ARGUMENTS**

You are the router for the Visigner. Do NOT ask a wall of questions. Infer intent, pin the brief in one short confirmation, then route to the matching skill and run its loop to the ship gate.

## 1 · Route by intent

Match the request to the capability that owns it (each is a bundled Skill — invoke it):

| If the request is about… | Route to | 
|---|---|
| Landing page, sales page, 상세페이지, Wadiz/펀딩, product detail, "make a page convert / look less AI-generated" | **detail-page** skill |
| App / web app / dashboard / SaaS UI / admin / a component / "design this screen" | **ui-design** skill (+ **frontend-build** to implement) |
| Design tokens, theming, multi-brand, a design system, dev handoff spec | **design-system** skill |
| A brand, identity, logo direction, voice, naming, positioning | **brand-identity** skill |
| "Plan this", requirements → flow, wireframe, IA, sitemap, what screens do we need | **ux-flows** skill (the planner's home) |
| "Build it / code it", screenshot→code, React/Tailwind/shadcn implementation | **frontend-build** skill |
| Funnel, conversion, CRO, copy, A/B, ads/email, "why isn't this converting" | **marketing-conversion** skill |
| Generate an image / visual asset for ANY design (hero, product/scene, cover, backdrop, OG card, icon/illustration exploration) | run **/design-image** |
| Publish / sync a component library or design system to Claude Design (claude.ai/design) | run **/design-publish** |
| "Is this good enough to ship / review my design" | run **/design-review** |

If it spans several (e.g. "build me a branded landing page"), sequence them: brand-identity → design-system (tokens) → detail-page/ui-design (design) → frontend-build (code) → design-critic (gate). Tell the user the short plan, then execute — don't stop to ask permission for an obvious sequence.

All of these disciplines stand on one shared engine — the **design-core** skill — which owns the tokens, the anti-slop aesthetics method, the global image service (behind `/design-image`), the ship gate, and DesignSync publishing (behind `/design-publish`). Keep ONE token set + ONE style DNA across a multi-discipline job so the output reads as one system.

## 2 · Pin the brief (one pass, mostly in your head)

Before producing anything, lock: the one **subject**, its **audience**, and the **single job** (the one action or outcome). If the request is thin, choose sensible specifics yourself and state them in one line ("Building X for Y so they Z — going with a [direction] feel; say the word to change it"). Ground every choice in the subject's real materials/vocabulary — that's where non-generic design comes from.

**Infer the brief in one line — four things, sensible defaults, never a blocker.** State it back covering: **who** it's for, **what** it is, the **one action** it must drive, and the **tone/feel** — for anything the user didn't give, fill it with a sensible starter default and *name* the default so they can correct it. This one-line restatement is a courtesy for a vague or first-time request; it does **not** block — you proceed with the defaults and invite a correction ("say the word to change it"), you don't wait. When the brief is already precise (an expert who spelled out subject/audience/action), skip the confirmation ceremony entirely and just build.

## 3 · Run the loop & gate

Follow the routed skill's own loop (plan a token system → build → **screenshot** → score → iterate). **The critique runs by default, not on request:** writing an `*.html` artifact auto-fires the anti-slop grade (the plugin's `PostToolUse` hook → `anti-ai-eval`), so you never choose whether to grade — you iterate to the gate. Never declare done on code review alone — render and read the pixels (`/design-setup` enables the full pixel loop once). If no browser is installed, the static grade still runs and you MUST tell the user *pixel critique is OFF — run `/design-setup`* instead of reporting an unshot page as verified. Gate before handing over: ship only when it clears the anti-slop audit and scores ≥8/10 with no dimension <7 (run **design-critic** for an independent read on anything visual) — and remember machine-clean is necessary, not sufficient, so carry the taste read.

**First time in a workspace? Narrate in plain language — once.** On a user's *first* design in a workspace (the plugin detects this read-only via `hooks/onboarding/first-run.js` — no prior produced HTML artifact, not "some setup is missing"), surface a one-time plain-language welcome: what just happened, why it matters, what they'll see next, and the exact one-tap next steps (the setup one-liners when a tool is missing, else "just describe the page you want"). Keep every line novice-readable — say what each step *does* and *why* it matters, in plain words, the same voice as the human-gate checklist. This is scoped to the first run / a novice: do **not** re-narrate on an established workspace or for an expert who clearly knows the tool (that would be noise). Once past the first run, go straight to the outcome.

Deliver the outcome first, then a one-line note on what to tweak next.
