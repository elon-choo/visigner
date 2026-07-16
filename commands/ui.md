---
name: ui
description: Design and build an app / web UI, dashboard, SaaS screen, or a single component — at a non-AI-generated quality bar. Use for product UI, app screens, dashboards, forms, components, design systems applied to a screen, or "design this screen / make this UI look professional".
---

# /ui — design & build product UI

Brief: **$ARGUMENTS**

This is product/app UI (not a long-scroll sales page — for those use **/landing**). Use the **ui-design** skill to design and **frontend-build** to implement. **The grade runs by default:** writing an `*.html` screen auto-fires the anti-slop critique (the plugin's `PostToolUse` hook → `anti-ai-eval`), so step 4's verify is not optional — you iterate to the ship gate, shooting every state. If no browser is installed, the static grade still runs and you MUST say *pixel critique is OFF — run `/design-setup`* rather than report an unshot screen as verified; machine-clean is necessary, not sufficient — carry the taste read.

1. **Brief & tokens** — pin what the screen is for and the one primary action. Plan a token system (color/type/layout/signature) via the two-pass method before coding; reject the banned defaults (generic dashboard with 4 stat cards + a line chart, every card same radius+shadow, centered everything, emoji icons, Inter/Roboto, unearned purple).
2. **Layout & components** — choose the navigation/grid pattern; design each interactive component with ALL its states (default / hover / focus-visible / active / disabled / loading / empty / error). One orchestrated motion moment, `prefers-reduced-motion` honored.
3. **Build** — React + Tailwind v4 `@theme` + shadcn/ui (or HTML+Tailwind for a self-contained artifact), tokens as the single source. Mobile-first; visible focus; semantic HTML.
4. **Verify** — render and screenshot via `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/shoot.js` (`AXE=1`), read the tiles, fix overflow / a11y / slop tells. Run **design-critic** for an independent grade and **a11y-auditor** for WCAG.

If tokens/theming or multi-brand is in scope, pull in **design-system**. Deliver the result, then one note on the next improvement.
