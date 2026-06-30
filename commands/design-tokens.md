---
name: design-tokens
description: Create, extract, or hand off a design-token system — the single source of truth (colors, type, spacing, elevation, motion) that keeps every page and app consistent and lets one brand re-theme everything. Use for design tokens, theming, dark mode, multi-brand, "extract tokens from this page", design-to-dev handoff spec.
---

# /design-tokens — token system & handoff

Brief: **$ARGUMENTS**

Invoke the **design-system** skill.

- **Create** a token system: primitive → semantic (role-named: `--color-surface/-ink/-accent`, `--shadow-e2`) → component tokens, expressed ONCE in a Tailwind v4 `@theme` block (v4 emits both the CSS var and the utility — no parallel config to drift). Colors as OKLCH ramps; 8pt spacing; hand-picked type scale; 3–4 elevation tokens; radius + motion tokens.
- **Extract** tokens from an existing built page: `node "${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/emit-tokens.js" <page.html>` → a DTCG `tokens.json` + a self-contained `spec.html` swatch/type/elevation sheet that can't drift from what shipped.
- **Compile / multi-brand**: edit the DTCG source, then `node "${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/build-tokens.js"` to regenerate the `:root{--brand-*}` / `@theme` layers; override under `[data-brand]` / `.dark` to re-theme everything from one source.
- **Govern**: `node "${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/brand-lint.js" <page.html>` flags raw hex, banned fonts, and the AI-purple default.

(Run `/design-setup` once before the scripts.) Deliver the `@theme` block + the handoff spec sheet, and state how to apply it across the suite (detail-page / ui-design / frontend-build).
