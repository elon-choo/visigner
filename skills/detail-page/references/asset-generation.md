# Image asset generation — 기획 → 제작 → 배치 (API-driven)

This is the layer that closes the last gap: real Wadiz pages are image-dominant, so the page's slots are filled with **generated image assets** (covers, product/scene shots, deliverables walls, before/after, banners) instead of (or on top of) CSS mockups. Two scripts drive it; both use Node's built-in `fetch` — **no npm install** (keeps supply-chain rules intact). Keys come from `~/.env`: `OPENAI_API_KEY`, `GEMINI_API_KEY`.

## Models (verified live 2026-06-22 against the user's keys — override via env)
| Role | Default | Alts on this key | Notes |
|---|---|---|---|
| Image (제작) | `gpt-image-1.5` (OpenAI) | `gpt-image-1`, `gpt-image-1-mini` | **There is no `gpt-image-2`** — 1.5 is the newest. Returns b64; fixed sizes. |
| Image (제작) | `gemini-3-pro-image` (Google) | `gemini-3.1-flash-image`, `imagen-4.0-ultra-generate-001` | **Best at Korean text-in-image** + native aspect-ratio control. Use for ANY asset with baked-in Hangul. |
| Plan (기획) | `gpt-5.2` (OpenAI) | `gpt-5.5-pro`, `gemini-3.1-pro-preview` | text LLM that expands a brief into the slot plan. |

Env knobs: `IMG_PROVIDER` (openai|gemini|**openai-responses**), `OPENAI_IMAGE_MODEL`, `GEMINI_IMAGE_MODEL`, `OPENAI_RESPONSES_AUTH`, `OPENAI_RESPONSES_MODEL`, `PLAN_PROVIDER`, `OPENAI_PLAN_MODEL`, `GEMINI_PLAN_MODEL`, `IMG_CONCURRENCY`.

**Provider rule of thumb:** Korean text on the image → **`openai-responses`** or **Gemini** (both render Hangul accurately; see the OAuth path below — verified pixel-perfect Korean). Clean isolated product/cover mockups → any; `gpt-image-1.5` and the responses path are both crisp. Photoreal scenes/lifestyle → any. Mixed set → keep one `style` preamble so they look art-directed as a group. **Pixel-exact aspect ratio needed?** prefer `gemini` or `openai` — the `openai-responses` path treats `size`/`aspect` as a *hint* (the reasoning model may pick its own dimensions).

### High-end path — `openai-responses` (Responses API + image_generation tool)
This is the highest-quality and (via ChatGPT OAuth) **free** path. Instead of the legacy `/v1/images` endpoint, it calls the **Responses API** with the built-in `image_generation` tool, letting a `gpt-5.x` reasoning model handle prompt fidelity, typography accuracy, and reference grounding before it paints. Two auth modes (env `OPENAI_RESPONSES_AUTH`, auto-detected):
- **`chatgpt-oauth`** (default when `~/.codex/auth.json` exists) — reads the Codex/ChatGPT login token, posts to `chatgpt.com/backend-api/codex/responses`. **No API key, and it bypasses the `gpt-image-*` model-access gate on the project key.** Free under the ChatGPT subscription. Run `codex login` once if it's missing.
- **`apikey`** — `Authorization: Bearer $OPENAI_API_KEY` → `api.openai.com/v1/responses` (paid).

Per-slot extras: `"references": ["/abs/path.png", ...]` feeds reference images for product-consistent image-to-image. `"model"` overrides `OPENAI_RESPONSES_MODEL` (default `gpt-5.4-mini`).

Verified 2026-06-23 on this machine: a Korean gold-foil cover (`"7일 만에 작가되기"`) rendered with every glyph correct and sharp, plus a clean product flat-lay — both at genuine Wadiz finish, generated free via the OAuth path in ~30–60s each.

**Supply-chain note:** this is a clean first-party re-implementation of the technique from [`lidge-jun/ima2-gen`](https://github.com/lidge-jun/ima2-gen) (MIT). We deliberately **do not** depend on that package or its `npx openai-oauth` runtime proxy — the live ChatGPT token must never be handed to npx-fetched third-party code. All logic lives in `scripts/lib-openai-responses.js`, Node built-ins only, no npm install. Token refresh writes back to `~/.codex/auth.json` atomically and only on success, so it can't corrupt the Codex CLI login.

## Quality engine (the four levers that raise output beyond a single naive call)
All four are **off by default / backward-compatible** — an old plan behaves identically. Turn them on for high-end output:

1. **Per-asset vision judge** (`JUDGE=1` or plan `"judge": true`). After each asset is written, a vision model scores it reference-free on `semantic` (matches the brief), `quality` (focus/lighting/artifacts), `glyph` (every Korean character correct & sharp — `null` when no text expected), and `slop` (10 = bespoke, 0 = generic AI slop), plus an `overall` and a `keep`/`regen` verdict + concrete `issues`. Subscores land in `manifest.json` per slot. This closes our worst gap: nothing else catches garbled Hangul or wrong subject automatically. Verified: it scored a correct gold-foil Korean cover `glyph:10, overall:9`.
2. **Best-of-N + auto-select** (`BEST_OF_N=3` env, applied to slots tagged `"tier":"hero"`; or per-slot `"n":N`). Generates N candidates for key slots and keeps the highest-judged — single-call output is high-variance, so over-generate-then-cull is the biggest realized-quality lever on an API stack. Honest cost is N×, so gate it to hero/cover/money shots, not thumbnails. `manifest` records each candidate's `overall` and the chosen one.
3. **Style-DNA** (plan-level `"styleDNA"`). A frozen block — exact product description, exact hex, materials, finish, default lens — prepended verbatim to **every** slot prompt. This is what makes a 10–16 image set read as one art-directed shoot instead of N unrelated images. `gen-plan.js` now emits it automatically.
4. **Canonical reference** (plan-level `"canonicalReference": "/abs/product.png"`, plus per-slot `"references": [...]`). The same product image is attached to **every** reference-capable slot (`gemini` and `openai-responses`) for identity/brand lock. Verified: a Gemini cutout and an `openai-responses` lifestyle hero both reproduced the same matte-black ridged dripper from one canonical reference. (Legacy `openai` `/v1/images` has no reference input.)

## Text quality — overlay crisp HTML text, don't bake it (the biggest glyph-risk killer)

Even Gemini and the `openai-responses` path occasionally misspell long Korean strings, and the `glyph` judge then forces a costly regen. The high-end fix is to **stop asking the model to draw words at all** for most text-heavy slots:

1. **Plan it text-free.** `gen-plan.js` can mark a slot `"textFree": true` with `"overlayText": [{ "kr": "정확한 한글 문구", "role": "headline|sub|cta" }]`. The image prompt then describes only a **clean backdrop with a deliberate safe area** ("lower-left third kept clean and slightly darkened for legible overlay text") — no baked glyphs.
2. **Overlay at 배치.** Place the image, then position the exact Korean copy as real HTML/Tailwind text over the safe area (absolute positioning inside a `position:relative` wrapper; use the page's display font + tokens). The text is now pixel-perfect, selectable, translatable, and editable without regenerating the image — and it inherits the same typography as the rest of the page.
3. **Keep baked-in text only** where the type must physically interact with the scene (foil stamping, packaging, on-screen UI). For those, Gemini / `openai-responses` + the `glyph` judge still govern.

This makes the text quality a function of your CSS, not of an image model's spelling — the single most reliable upgrade for Korean text slots.

### Flat export via Satori + resvg (optional — when a platform needs ONE flat image)

Some upload flows (certain Wadiz/Naver/Coupang image-only modules, ad creatives) want a single flat PNG, not live HTML+overlay. To flatten an overlay slot deterministically, render the HTML overlay with **[Satori](https://github.com/vercel/satori)** (HTML/JSX → SVG, perfect text since it uses real font files) and rasterize with **`@resvg/resvg-js`** (SVG → PNG).

**Supply-chain discipline — vendor, never `npx`.** Pin and vendor these into the skill so no code is fetched-and-run at use time:
```bash
# one-time, reviewed install into the skill's own node_modules (NOT a global npx).
# Versions below are EXAMPLES — replace with the exact versions you reviewed; npm pack writes
# <name>-<version>.tgz (scoped names flatten: @resvg/resvg-js → resvg-resvg-js-<version>.tgz).
cd ~/.claude/skills/detail-page
npm pack satori@0.12.1 @resvg/resvg-js@2.6.2          # writes satori-0.12.1.tgz, resvg-resvg-js-2.6.2.tgz — inspect both first
npm install --save-exact --ignore-scripts ./satori-0.12.1.tgz ./resvg-resvg-js-2.6.2.tgz
```
`--ignore-scripts` blocks install-time `postinstall` exfiltration; `--save-exact` pins the version; `npm pack` lets you read the code before it ever runs. Satori needs the **font file** (Pretendard/Black Han Sans `.ttf/.otf`) passed explicitly and **explicit flexbox styles** (it supports a CSS subset — no `position:absolute` cascade magic, so build the overlay as a flex tree). resvg renders that SVG to PNG at any scale.

> This flat-export path is a **documented, vendored procedure, not a shipped script** — verify the pinned versions and the rendered output yourself before relying on it. The live HTML+overlay above is the default and needs no dependencies.

## The three steps

### 1 · 기획 — plan the asset set
Either let the LLM design it from a brief:
```bash
NODE_PATH=$(npm root -g) node scripts/gen-plan.js brief.json asset-plan.json
```
`brief.json` = `{ subject, mode, category, palette, oneMessage, sections:[...], notes }`. The planner returns 8–16 cohesive slots covering the Wadiz module grammar, auto-assigns Gemini to Korean-text slots, sets aspect ratios, and writes a `target` (where each image goes) for the placement step.

…or hand-author `asset-plan.json` yourself (the agent often knows the page better):
```json
{
  "style": "shared preamble: palette, lighting, finish, 'no watermark, no gibberish text'",
  "slots": [
    { "id": "hero-book", "prompt": "photoreal 3D ebook mockup, gold-foil Korean title \"나는 7일 만에 작가가 되었다\", charcoal surface, studio light", "aspect": "3:4", "provider": "gemini", "target": "#hero .bookwrap" }
  ]
}
```
Aspect values: `1:1 3:4 4:3 16:9 9:16 4:5 5:4`. gpt-image maps these to its nearest fixed size; Gemini honors them natively.

### 2 · 제작 — generate the images
```bash
NODE_PATH=$(npm root -g) node scripts/gen-assets.js asset-plan.json /tmp/<page>/assets       # baseline
JUDGE=1 BEST_OF_N=3 NODE_PATH=$(npm root -g) node scripts/gen-assets.js asset-plan.json /tmp/<page>/assets   # high-end: judge every asset, best-of-3 on hero slots
```
Writes `<id>.png` per slot + `manifest.json` (provider, model, bytes, ok/error, and — when judging — per-slot `score` + best-of-N `candidates`). Runs `IMG_CONCURRENCY` at a time. A failed slot is logged, not fatal — regenerate just that slot by re-running a one-slot plan. See **Quality engine** above for `JUDGE` / `BEST_OF_N` / `styleDNA` / `canonicalReference`.

### 3 · 배치 — place into the page, then re-shoot
Replace the CSS placeholder at each slot's `target` with `<img src="assets/<id>.png" alt="…">` (keep meaningful Korean alt text; give image panels a `min-height` so mobile doesn't collapse them). Then **re-run `scripts/shoot.js` and re-score** — generated images change spacing, contrast, and mobile legibility, so the pixel loop still governs. CSS mockups stay as the zero-cost fallback for any slot you don't generate.

## Prompt-craft rules for Korean Wadiz assets
- **Write each prompt as labeled blocks** — `Subject / Style / Lighting / Camera / Palette` — and ALWAYS include a `Camera` block with concrete cinematography: focal length + aperture + framing + light direction (e.g. `85mm f/1.4, three-quarter framing, soft window light from camera-left`). EXIF-learned lens priors are real — `85mm f/1.4` actually yields bokeh. `gen-plan.js` now emits prompts in this shape automatically.
- For **multi-object scenes give each object its own line** (reduces attribute bleed between subjects).
- **Describe absence positively** ("clean uncluttered background", not "no clutter"); these models have no negative-prompt field. Put junk-exclusions at the very end: "no watermark, no gibberish/lorem text, no fake brand logos".
- Put the **exact Korean string in quotes** when text must appear on the image; prefer Gemini or `openai-responses` (both verified pixel-perfect Hangul). The judge's `glyph` subscore catches misspellings — regen any slot with low `glyph`.
- **No real or identifiable people** — maker/review portraits must be generic and non-identifiable. Don't generate real logos; use a live CSS/logo row for real brands.
- A shared `style` + `styleDNA` for the whole set = cohesion; vary only the subject per slot. Match `aspect` to the slot (hero scene 16:9, cover 3:4, deliverable tiles 1:1/4:3, banner 16:9, portrait 4:5).
- Generated text can still misspell and aspect on `openai-responses` is only a hint — **read every asset in the pixel loop** (and trust the judge subscores), regenerate weak ones; never ship an asset you haven't looked at.

> **Scope note — compliance is intentionally OUT.** This skill plans for **quality only**. It does NOT add 표시·광고법 / 추천·보증 claim-substantiation gates — the type and degree of compliance vary per platform and per project, so the user owns that step. Don't bake compliance checks into the planner, prompts, or rubric.

## Cost & etiquette
Each image is a paid API call. Plan once, generate once, regenerate only failed/weak slots. A full page is ~10–16 images. Keep keys out of logs (the scripts never print them). This layer is **optional**: the skill produces a complete page with CSS mockups alone; asset generation upgrades it toward photographic Wadiz finish.
