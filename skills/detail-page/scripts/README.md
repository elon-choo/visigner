# Scripts — render & screenshot (the "look at the pixels" loop)

The normal scripts drive the real installed Google Chrome via Playwright, and automatically fall back to the local Patchright dependency when Playwright is not resolvable. `capture-reference-patchright.js` uses Patchright directly for harder bot walls.

Prereqs (already true on this machine): Patchright (`npm i patchright` in this skill folder) and Google Chrome (`/Applications/Google Chrome.app`). Playwright is optional. The scripts use `channel: 'chrome'`, so bundled browsers are not required.

## shoot.js — screenshot your OWN output (step 5 of the skill loop)
```bash
NODE_PATH=$(npm root -g) node shoot.js ./index.html              # local file
NODE_PATH=$(npm root -g) node shoot.js http://localhost:3000      # dev server
NODE_PATH=$(npm root -g) node shoot.js ./index.html /tmp/shots-v2 # custom out dir
MAX_TILES=120 NODE_PATH=$(npm root -g) node shoot.js ./index.html /tmp/shots-long
```
Writes to `/tmp/detail-page-shots/` (or your outDir): `desktop-full.png`, `desktop-tile_00..NN.png` (close-reading slices), `mobile-full.png` (390px — the legibility check), and `run.json` with `pageHeight` / `coveredHeight`. **Then Read the tiles** and grade against `../references/review-rubric.md`. Re-run after each fix to compare passes.

**Assertion gates in `run.json`** (additive, off-by-default where noted): `mobileOverflowPx` + `overflowCulprits` (always; >1px is a hard fail); `assets` + `gate.assetsOk` (always, `ASSETS=0` to skip — failed requests / 0px `<img>`); `axe` + `gate.axeClean` (`AXE=1`; scans desktop **and** 390px mobile; `null`=CDN-down, not a pass); and `gate.report = { overall, checks[] }`, one machine-readable rollup. `GATE_EXIT=1` makes the process exit 1 when `gate.report.overall===false` (default exit stays 0 so the workflow is unaffected).
```bash
AXE=1 GATE_EXIT=1 NODE_PATH=$(npm root -g) node shoot.js ./index.html /tmp/shots   # full gate, hard exit on fail
ASSETS=0 NODE_PATH=$(npm root -g) node shoot.js ./index.html                        # skip the broken-asset gate
```

## brand-lint.js — deterministic brand-governance gate (no deps)
```bash
node brand-lint.js ./index.html [out.json]        # exits non-zero ONLY on an error-severity violation
```
Promotes review-rubric §A bans from LLM-self-graded into a machine check: **error** = raw hex/rgb/hsl color outside `@theme`, banned font (Inter/Roboto/Arial/Open Sans/Lato/system-ui), or AI-purple (OKLCH hue 270–310 **and** chroma > 0.04 — the chroma floor lets gray neutrals through). **warn** = emoji-as-icon, Tailwind arbitrary-value brackets. `BRAND_LINT_PX=1` adds an opt-in spacing-px-off-grid warn. Writes `brand-lint.json {pass, errorCount, warnCount, violations[], tokenCoverage}`. The canonical `assets/starter/index.html` passes clean (0 errors, 0 warns).

## build-tokens.js — compile DTCG tokens → CSS (single source of truth, no deps)
```bash
node build-tokens.js ../tokens/brand-default.tokens.json                       # prints :root{--brand-*}
node build-tokens.js ../tokens/brand-default.tokens.json --emit=theme          # prints @theme{ --color-*: var(--brand-*) }
node build-tokens.js ../tokens/brand-default.tokens.json ../tokens/brand-X.tokens.json   # + [data-brand="X"] block
```
First-party Style-Dictionary-in-~150-lines (fs+path only). Edit the JSON, regenerate the starter's token layers — no hand-edit drift. CSS → stdout; JSON summary → stderr. Resolves `{alias}` refs; **FATAL (exit 2) on a missing ref or an alias cycle** (never emits broken CSS). Round-trips the starter's `--brand-*` block 1:1. See `../tokens/README.md`.

## capture-reference.js — capture a real reference page (grounding)
```bash
NODE_PATH=$(npm root -g) node capture-reference.js https://www.wadiz.kr/web/campaign/detail/400620 /tmp/ref-400620
MAX_TILES=120 NODE_PATH=$(npm root -g) node capture-reference.js https://www.wadiz.kr/web/campaign/detail/400620 /tmp/ref-400620-full
```
Headed Chrome with a fresh profile gets past bot walls that block headless/plain-fetch (Wadiz uses Akamai "Access Denied"). Writes tiled screenshots + `bodytext.txt` + `data.json` (headings, image URLs, page height) + `capture.json` (tile coverage summary).

## capture-reference-patchright.js — retry harder bot walls
```bash
cd ${CLAUDE_PLUGIN_ROOT}/skills/detail-page
node scripts/capture-reference-patchright.js https://www.wadiz.kr/web/campaign/detail/400620 /tmp/ref-400620-patchright
```
This uses Patchright instead of Playwright, headed Chrome, a fresh persistent profile, no custom user agent, and no injected stealth JS. It is the first retry path when Wadiz/Akamai blocks normal Playwright.

Very long Wadiz pages can exceed 100,000px. The Patchright script captures up to 90 viewport tiles by default; override when needed:
```bash
MAX_TILES=120 node scripts/capture-reference-patchright.js https://www.wadiz.kr/web/campaign/detail/403454 /tmp/ref-403454-full
```
Treat a reference capture as complete only when the JSON output has `coveredHeight >= pageHeight`.

**Etiquette:** capture a handful of pages, not a crawl. Repeated rapid hits flag the IP (`{"blocked":true}` in the output) — if that happens, wait a few minutes before retrying; do not hammer (it can rate-limit the user's normal browsing too). Reuse of the same profile after a flag stays blocked — a fresh profile (new outDir) plus a cooldown is the fix.
