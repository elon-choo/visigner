---
name: design-setup
description: One-time setup for the visigner power features — installs the Patchright (headed Chrome) dependency and the Chromium browser used by the screenshot self-critique loop, reference capture, and image-asset placement. Run this once after installing the plugin (and again after a plugin UPDATE, since node_modules lives in the install dir). Pure design guidance works WITHOUT this step; only the render/screenshot/capture scripts need it.
allowed-tools:
  - Bash
  - Read
---

# /design-setup — install the browser tooling for the screenshot loop

Most of the Visigner is pure guidance and needs **no install** — you can plan, design, write code, and review immediately. Only these power features touch a real browser and therefore need a one-time dependency install:

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

## Verify

After installing, confirm it works by rendering the bundled non-slop starter and reading the screenshot:

```bash
cd "${CLAUDE_PLUGIN_ROOT}/skills/detail-page"
node scripts/shoot.js assets/starter/index.html /tmp/design-setup-check
```

If a full-page PNG and tiles appear under `/tmp/design-setup-check` with no error, setup succeeded. Report success (or the exact error) to the user. Do not claim success without seeing the screenshot output.
