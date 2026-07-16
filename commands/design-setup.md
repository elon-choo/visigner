---
name: design-setup
description: Manual browser setup fallback for Visigner power features — installs Patchright and Chromium for the screenshot self-critique loop, reference capture, and image-asset placement. First design use now auto-provisions this in the background; use this command for offline/CI setup or to force a reinstall after a plugin update.
allowed-tools:
  - Bash
  - Read
---

# /design-setup — install the browser tooling for the screenshot loop

On first design use, Visigner now auto-provisions Patchright + Chromium in the background, so most users never need this command. `/design-setup` remains the manual/offline/CI fallback and the way to force a reinstall after a plugin update. Most of Visigner is pure guidance and needs **no install**; only these power features touch a real browser:

- the **screenshot self-critique loop** (`detail-page` skill: `scripts/shoot.js`) — render your own page and grade the pixels,
- **reference capture** (`scripts/capture-reference.js`, `scripts/capture-reference-patchright.js`) — screenshot a live competitor/exemplar page (incl. Wadiz/Akamai bot-walled pages),
- the **ultracode design workflow** (`scripts/ultracode-workflow.js`), which calls the above.

## Steps

Run these (the skill lives inside the installed plugin, so use `${CLAUDE_PLUGIN_ROOT}`):

```bash
cd "${CLAUDE_PLUGIN_ROOT}/skills/detail-page"
npm install            # installs patchright (declared in package.json)
npx patchright install chromium   # downloads the Chromium build patchright drives
```

Notes:
- The Chromium download is cached at the OS level (`~/Library/Caches/ms-playwright` on macOS, `~/.cache/ms-playwright` on Linux) and **survives plugin updates**. Only `node_modules` lives in the plugin install dir, so re-run `npm install` (step 1) after a plugin update — the browser step usually does not need repeating.
- If `npm install` reports a permission error, you do not have write access to the plugin install directory; tell the user, do not sudo.
- Image-asset **generation** (`scripts/gen-assets.js`) additionally needs an API key (`OPENAI_API_KEY` or `GEMINI_API_KEY` in the environment), or a ChatGPT login via `codex login` for the free path. It needs no npm install (built-in `fetch`).

## Image generation (`/design-image`) — auth, no browser needed

The global image service (`skills/design-core/scripts/image-service.js`, behind **`/design-image`**) uses only Node built-ins — **no `npm install`**. It just needs one credential path. Check what's live with the doctor (zero network, never charges):

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/design-core/scripts/image-service.js" --doctor
```

Enable real image generation with ONE of (in the service's own preference order):
1. **Free, recommended:** `codex login`  → uses the ChatGPT/codex OAuth path (`~/.codex/auth.json`), no API key.
2. **OpenAI key (paid):** `export OPENAI_API_KEY=sk-...` (or add it to `~/.env`).
3. **Google Gemini key (paid):** `export GEMINI_API_KEY=...` (best for Korean text-in-image and exact aspect ratios).

With none of these, generation still runs but fills every slot with a tasteful on-brand SVG placeholder. Latest model defaults (`gpt-image-2`, `gemini-3-pro-image`, `imagen-4.0-*`) are applied automatically; override per-run via env.

## Claude Design publishing (`/design-publish`) — authorization

To publish a component library to a **claude.ai/design** design-system project (behind **`/design-publish`**), the `DesignSync` tool needs design-system access on your claude.ai login. If a read (`list_projects`) fails with an authorization error, run **`/design-login`** (or make sure you're signed in to claude.ai) once — no install, no key.

## Verify

After installing, confirm it works by rendering the bundled non-slop starter and reading the screenshot:

```bash
cd "${CLAUDE_PLUGIN_ROOT}/skills/detail-page"
node scripts/shoot.js assets/starter/index.html /tmp/design-setup-check
```

If a full-page PNG and tiles appear under `/tmp/design-setup-check` with no error, setup succeeded. Report success (or the exact error) to the user. Do not claim success without seeing the screenshot output.
