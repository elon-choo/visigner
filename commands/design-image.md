---
name: design-image
description: Generate real images for ANY design — hero shots, product/scene photos, cover art, backdrops, icon/illustration exploration, OG cards — through Visigner's global image service (latest OpenAI/Gemini models). Works from any skill, not just 상세페이지. Free via ChatGPT/codex OAuth when available, else an API key; falls back to on-brand placeholders with no credentials.
---

# /design-image — generate imagery for any design

The user's request: **$ARGUMENTS**

You drive the design-core **global image service** (`${CLAUDE_PLUGIN_ROOT}/skills/design-core/scripts/image-service.js`), a thin façade over the verified engine with the **latest models** wired in. Do not hand-roll API calls; use the script.

## 1 · Preflight (first time / on any auth doubt)

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/design-core/scripts/image-service.js --doctor
```

This is zero-network and reports which path is live:
- **ChatGPT/codex OAuth** (`~/.codex/auth.json`) — FREE, preferred. If absent, tell the user to run `codex login` (one time).
- **`OPENAI_API_KEY`** / **`GEMINI_API_KEY`** — paid fallback. If the user wants these, ask them to `export` the key (or add it to `~/.env`), then re-run.
- **Neither** — the run still completes with tasteful on-brand SVG placeholders; say so plainly so the user knows which slots need real art.

If the user explicitly asked to use their API key (not OAuth), set `OPENAI_RESPONSES_AUTH=apikey` (or pick `--provider gemini`/`--provider openai`) for that run.

## 2 · Generate

**One image** (default; autoselects the free OAuth path when present):
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/design-core/scripts/image-service.js "<vivid, specific description>" <outDir> --aspect 3:4
```

**A whole art-directed set** from a brief (planning → production with the quality engine — best for a page's full slate of assets):
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/design-core/scripts/image-service.js --brief <brief.json> <outDir>
```
`brief.json`: `{ "subject", "mode":"detail|landing", "category":"ai-digital|physical", "palette", "oneMessage", "sections":[...] }` (see `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/references/asset-generation.md`).

**Render an existing plan:** `--plan <asset-plan.json> <outDir>`.

### Choosing a provider
- **Korean or any text baked into the image** → let it use the Responses/OAuth path or add `--provider gemini` (both render Hangul accurately). Better still for text-heavy slots: generate a clean backdrop and overlay the exact copy as HTML at build time (the engine's `textFree`+`overlayText` — see asset-generation.md). This is the biggest glyph-risk killer.
- **Pixel-exact aspect ratio** → `--provider gemini` or `--provider openai` (the OAuth Responses path treats `--aspect` as a hint and may pick its own dimensions).
- **Photoreal / clean product / editorial** → the default path is crisp; no flag needed.

### Latest models (defaults; override via env)
**OpenAI:** the default high-end route is `openai-responses` (`gpt-5.4-mini` via OAuth / `gpt-5.2` via key) — the reasoning-driven path where gpt-image-2-class quality lands. `gpt-image-2` on the legacy `/v1/images` path is **opt-in** (`OPENAI_IMAGE_MODEL=gpt-image-2`, needs that access on the key); the service keeps that path on the known-good `gpt-image-1.5` by default so a key-only user is never silently downgraded to a placeholder. **Google:** `gemini-3-pro-image` / Nano Banana (default) · `imagen-4.0-ultra-generate-001` (set `GEMINI_IMAGE_MODEL`). Availability depends on the account/key tier — if a path is gated, switch with `--provider`.

## 3 · Verify before handing over
- Confirm the output files exist and are non-zero (the engine prints a per-slot manifest; `placeholders: 0` means every slot is a real image).
- **Look at the pixels.** Open a key output and check it matches the brief and has no garbled text / extra limbs / artifacts. For a set, turn on the vision judge (`JUDGE=1`) so each asset is scored and weak ones flagged.
- If an asset is placed into a page component, run the anti-slop gate on that component (`brand-lint.js`, `tell-count.js`) before calling it done.

Deliver the outcome first (what was generated + where the files are), then one line on any slot that still needs attention.
