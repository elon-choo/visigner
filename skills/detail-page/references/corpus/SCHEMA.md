# Corpus capture schema — one exemplar `record.json`

What ONE exemplar record contains, so that Stage 3 (librarian: brief → top-K exemplars) can retrieve it and Stage 4 (conformance gate: does the output EMPLOY the retrieved technique?) can read it.

This file is the contract for `corpus-validate.js`. It is written to be implementable from this doc alone: every field below has a type, a concrete example, a `fillable-from` source, and — where nothing can populate it — a named gap.

Closed-set tag **values** are **not defined here**. Fields typed `<TAXONOMY.x>` draw their legal values from `TAXONOMY.md` (sibling file, authored separately). This schema references the taxonomy; it never enumerates it. `corpus-validate.js` resolves `<TAXONOMY.x>` by loading `TAXONOMY.md`; if that file is absent, taxonomy-typed fields validate for *shape only* and are reported `taxonomy-unresolved`, never silently passed.

Seven `<TAXONOMY.x>` keys this schema references are **unowned, Stage-2 vocabulary decisions** — `sector`, `recurrence`, `hue_family`, `temperature`, `weight_contrast`, `tile_format`, `color_fidelity`. Their local field definitions below say what they describe, but neither this schema nor `TAXONOMY.md` owns a closed set yet (`TAXONOMY.md` §11 records the same from the value side). Until an owner closes each vocabulary, they validate shape-only per the rule above; they are **not closed sets today**.

---

## 1 · The honesty rule (the core of this schema)

> **A field that cannot be extracted is `null` plus a named gap. Never a guess, never a plausible-looking default.**

A corpus full of fields that nothing can populate is the failure mode this schema exists to prevent. So:

1. Every extracted field is wrapped in a **provenance envelope** (§3). The envelope, not the value, is what makes a record trustworthy.
2. `value: null` is **legal and expected**. It is only legal **with** a `gap` pointing at a gap ID from §9.
3. `value: null` **without** a `gap` ref is a **hard validation failure** — that is the shape of a silently-fabricated blank.
4. A non-null value with `provenance: "hand"` **must** carry `evidence`. An analyst judgement with no pointer to the pixels or text that produced it is indistinguishable from invention.
5. The librarian (§7) and the gate (§8) **must both read provenance**. A `null` field never contributes to a match score and never produces a mechanical fail.

Rule 5 is load-bearing. Without it the librarian silently prefers under-annotated records (fewer fields to mismatch on), and the gate fails pages against evidence that was never captured.

---

## 2 · Ground truth — what the pipeline actually captures

Verified first-party against the real captures on disk (2026-07-17), not assumed. **Two roadmap claims are false and the schema is built on the corrected picture.**

### 2.1 What is on disk

| Capture | Files | Tiles | Tile format | `capture.json`? |
|---|---|---|---|---|
| `captures/400620/` (Wadiz) | `data.json`, `bodytext.txt`, `index.html`, `tile_00..73.jpg` | **74** | **720×900 JPEG**, baseline, 3-component | ❌ no |
| `captures/403454/` (Wadiz) | same shape | **85** | 720×900 JPEG | ❌ no |
| `captures/app-ui/linear/` | `data.json`, `capture.json`, `bodytext.txt`, `tile_00..06.png` | 7 | **1280×1600 PNG**, lossless RGB | ✅ yes |
| `captures/app-ui/{raycast,stripe,vercel}/` | same shape | 10 / 10 / 4 | 1280×1600 PNG | ✅ yes |

`data.json` is **the same shape in both families** — `url, status, title, headings[], imageCount, bigImages[], pageHeight, bodyTextLen`. Wadiz adds one key, `expanded` (`"더보기"` — the capture clicked the expand control). app-ui adds a **separate** `capture.json` carrying the tiling metadata `tiles, coveredHeight, maxTiles, outDir`.

### 2.2 Correction 1 — no capture has a DOM, and none ever did. `index.html` is a viewer.

The roadmap holds that the Wadiz captures carry `index.html` = full DOM, enabling CSS/computed-font extraction. **They do not.** `400620/index.html` is a **generated stitching viewer**, built by `scripts/view-capture.js` (its own header: *"build a one-click HTML viewer that stitches a capture's tiles into the full page … writes `<captureDir>/index.html`"*). 87 lines, 5,801 bytes, whose entire `<style>` is the viewer's own chrome —

```css
body{margin:0;background:#222;font-family:-apple-system,sans-serif}
.page{max-width:720px;margin:0 auto;background:#fff}
```

— followed by 74 `<img src="tile_NN.jpg">` tags. **Zero** original Wadiz markup, zero campaign CSS, zero `@font-face`, zero computed styles. Its `#222` and `-apple-system` belong to the *viewer*; an extractor pointed at it would attribute them to the exemplar.

**This is not a gap in the archive — it is a gap at the source.** Verified by reading both capture scripts:

- `capture-reference-patchright.js` `page.evaluate()` returns **exactly** `{title, headings[], imageCount, bigImages[], pageHeight, bodyTextLen, bodyText}` and nothing else. It writes `data.json`, `bodytext.txt`, `tile_NN.png`, `capture.json`.
- `capture-reference.js` collects the same set and writes the same artefacts.
- Neither script — nor `view-capture.js` — contains a single `getComputedStyle`, `document.fonts`, `styleSheets`, `cssRules`, or `getPropertyValue` call. (The only `--…` match anywhere in the capture paths is Chrome's `--lang=ko-KR` launch arg.)

**Consequence:** the DOM-vs-tiles asymmetry the brief asks me to confront **does not exist in any direction**. It is a **uniform absence**. Re-capturing the same URLs today with the current scripts would produce *no* CSS either. Font families, weights, numeric type scale, spacing tokens, radius, and motion timing are not extractable from any capture in the corpus, and **cannot be made extractable by re-running the pipeline as written** — only by extending it (§9, GAP-01, class **C**).

The roadmap's G1.4 premise — *"palette via CSS-var parse, type-pairing via computed font-family"* — is therefore **unachievable for the existing 6 captures and for every future capture** until the evaluate block is extended.

### 2.3 Correction 2 — the real asymmetry runs the other way, and it is about fidelity

There is a real asymmetry, but it **disfavours the Wadiz captures**:

- **Tile fidelity.** Wadiz tiles are **720×900 JPEG**, downscaled by exactly 0.5625 from the 1280×1600 capture viewport (`720/1280 = 900/1600 = 0.5625`), confirmed by `captures/README.md` ("이 폴더의 JPEG는 축소본"). Baseline JPEG with 3 components means **chroma subsampling** — colour is the *first* thing this format degrades. app-ui tiles are **1280×1600 lossless PNG**. → **GAP-04**
  **Note:** both capture scripts write `tile_NN.png` (`page.screenshot({path: …png})`). The committed Wadiz JPEGs are therefore **post-hoc downscales**, not what the pipeline emits. A re-capture today yields lossless PNG for Wadiz too — **no script change needed**, which makes GAP-04 much cheaper than it looks.
- **Tiling metadata.** app-ui records `coveredHeight`; Wadiz records nothing. The skill's own capture-validity rule (`coveredHeight >= pageHeight`, SKILL.md §5) is therefore **derived, not captured**, for the two flagship exemplars. → **GAP-05**
  **Note:** the derivation is on firmer ground than "app-ui convention" — `const tileHeight = 1600` is a **hard-coded literal** in `capture-reference-patchright.js`, the script that produced these tiles. `74 × 1600` is reading the source, not guessing.

So on the two axes that matter for a design corpus — colour fidelity and provable coverage — **app-ui is the richer family**. The Wadiz captures are richer only in *conversion* material (`bodytext.txt` carries the full PASONA copy; `expanded` proves the story was unfolded).

### 2.4 Correction 3 — the numeric chroma floor is not recoverable from any exemplar

`references/color-forward-palettes.md` states the rule directly:

> the ≥0.12 chroma is a PLAN / `@theme`-source target — verify it from the OKLCH token values, **NOT by eyeballing a JPEG/PNG tile (chroma is not recoverable from a screenshot)**. The grader judges color *commitment* visually from the tiles; the numeric chroma is confirmed from source.

An exemplar is a third-party page. **We have no source tokens for it and never will.** Therefore an exemplar's `oklch` ramp can only ever be a *measurement of rendered pixels* — a different kind of number from the `@theme` value the plan gate checks. This is not a tooling gap that better code closes; it is a category distinction the schema must carry so the gate never compares the two as equals. → **GAP-02**

What the tiles *do* support is exactly what the skill already says they support: a **visual judgement of colour commitment** (does a saturated field own a band?) and role assignment. That is why §5.3 splits `palette.roles` (fillable now) from `palette.ramp[].oklch` (not fillable at gate grade).

### 2.5 There is no image decoder in the pipeline

`skills/detail-page/package.json` declares exactly one dependency: `patchright`. No `sharp`, `jimp`, `canvas`, or `pngjs`; no `node_modules` present. **Every numeric pixel measurement is therefore currently unimplementable** — not merely unwritten. Any field marked `tile-px` below is `null` until a decoder is added. → **GAP-03**

Today the only way to get design tokens out of a tile is a **vision model reading the image** (`tile-vision`) — which yields confident *categorical* reads (hue family, role, archetype, signature) and unreliable *numeric* ones.

---

## 3 · Fillability classes (A / B / C / D) — read this before the field tables

Every field in §4–§5 carries a **fillability class**. It answers one question: *what would it actually cost to populate this?* This is the column that decides Stage 1's architecture, so it is first-class, not commentary.

The complete signal available per exemplar today is `tile_NN.{png,jpg}` (pixels) · `bodytext.txt` (copy) · `data.json` (`url, status, [expanded,] title, headings[], imageCount, bigImages[], pageHeight, bodyTextLen`) · `capture.json` (`url, status, title, pageHeight, bodyTextLen, imageCount, tiles, coveredHeight, maxTiles, outDir`) · and, when `capture-styles.js` ran, `styles.json` (computed style samples plus an authored-region verdict). Every class below is defined against that list.

| Class | Definition | Cost | Owner decision? |
|---|---|---|---|
| **A** | **Extractable now** by deterministic Node code over the existing artefacts, **stdlib only**. Parses of `data.json`/`capture.json`/`bodytext.txt`, regex counts, arithmetic, file-header reads. | Write the code. | no |
| **A⁺** | **Signal is on disk, tooling is not.** Deterministic Node over tile **pixels** (e.g. palette by quantisation) — but the skill has **no image decoder** (§2.5). Needs one dep (`sharp`/`jimp`/`pngjs`), no re-capture. | One dep + code. | small (dep adds install weight; SKILL.md promises a zero-setup lint tier) |
| **B** | **Extractable now only with a vision/LLM read** of tiles or bodytext. No deterministic algorithm exists for it (layout archetype, "what is the signature move", colour *roles*). | Vision read per record, per re-index — **free today**: `scripts/lib-openai-responses.js` already ships vision input (`input_image`, L231/L325) and a vision judge (L306), and design-core SKILL.md §1 routes auth through the **free ChatGPT/codex OAuth** (`~/.codex/auth.json`, present on this machine) before any paid key. | no — only if OAuth throttling appears at ≥120-record scale (unmeasured); the paid-key fallback is the sole remaining spend decision |
| **C** | **Collector-sourced.** Fillable only when the capture has a `styles.json` produced by `capture-styles.js` **and** `styles.json#/authoredRegion/verdict` is exactly `"dom-authored"`. Otherwise it stays `null` with its named gap; a platform's computed DOM must never be attributed to the exemplar. | Run the collector at capture time. | no |
| **D** | **Human/curated only.** Interpretive or curatorial; no extraction closes it at any budget. | Analyst time. | no |

**A/B/C/D and `provenance` (§3.1) are the same axis seen twice** — class = *what it costs to fill*, provenance = *where the value came from*. They map 1:1:

`A → capture-json | bodytext | derived` · `A⁺ → tile-px` · `B → tile-vision` · `C → styles-json | dom` · `D → hand`

**Two consequences worth stating plainly:**

1. **Class B is reachable today at no marginal cost — the spend decision this schema originally staged for the owner is resolved.** Every B field means a vision/LLM call per record, repeated whenever the corpus is re-indexed — but the module for it is already shipped: `scripts/lib-openai-responses.js` sends `input_image` content (L231, L325) and implements a per-image vision judge (L306), and design-core SKILL.md §1 gives auth precedence to the **free ChatGPT/codex OAuth** (`~/.codex/auth.json` — present and current on this machine), falling back to a paid key only if it is absent. `palette.roles`, `layout.archetype`, and all of `signature.*` are B — i.e. **the entire "what does this page teach" layer is B** — and it is fillable now, for free. **One honest caveat:** the free path's rate limits at ≥120-record scale are unmeasured; if throttling appears, the fallback is a paid key — that, and only that, would be a spend decision. (The A-only degraded mode — conversion arc, densities, capture metadata; *structure*, not *design* — remains the documented fallback if both paths are ever unavailable.)
2. **C is the collector-backed class and it is where the whole `type` block lives.** Its values are trustworthy only behind the authored-region gate: a `dom-authored` page may contribute them, while a Wadiz-style image-story page must remain blank even when its platform chrome has computed CSS.

**Class distribution across this schema** — counted from the §4–§5 tables, **85 classified field rows**:

| Class | Count | Share | Meaning |
|---|--:|--:|---|
| **A** | 35 | 41% | free today (3 of these inherit a **B** dependency and are marked inline) |
| **B** | 23 | 27% | needs a vision/LLM read — free today via the shipped OAuth path (see the class table above); paid only if throttled |
| **D** | 13 | 15% | analyst time |
| **C** | 11 | 13% | blocked on a capture-pipeline change **+ re-capture** |
| **A⁺** | 3 | 4% | one decode dep away |

Read that as: **41% of the schema is free**, **27% needs a vision read that is itself free today** (OAuth path above; a paid key only if throttled), and **13% cannot be filled for any existing capture without re-crossing the Akamai wall**. The A block alone (capture metadata + densities + urgency counts + arc coverage) is enough to build a working librarian — §7 Pass 2 reads it at a combined weight of 0.40, equal to the B (vision) share, with hand judgements capped at 0.20.

### 3.1 The provenance envelope

Because the two capture families differ and most design tokens are unextractable, **every field in the token block is an envelope, not a bare value**:

```jsonc
{ "value": <T> | null, "provenance": "<enum>", "confidence": 0.0–1.0 | null, "evidence": "<pointer>" | null, "gap": "GAP-NN" | null }
```

| `provenance` | Meaning | Gate-grade? | Available today |
|---|---|---|---|
| `capture-json` | Parsed from `data.json` / `capture.json` | ✅ yes | ✅ |
| `bodytext` | Parsed from `bodytext.txt` | ✅ yes | ✅ |
| `derived` | Computed from other captured fields; `evidence` states the formula | ⚠️ formula disclosed, not mechanically recomputed | ✅ |
| `tile-vision` | A vision model read the tile images | ⚠️ advisory only | ✅ |
| `tile-px` | Numeric measurement of decoded tile pixels | ⚠️ advisory only | ❌ **GAP-03** |
| `styles-json` | Value read from a `styles.json` produced by `capture-styles.js` at capture time | ✅ only with invariant 5's authored-region gate | ✅ for qualifying captures |
| `dom` | Computed CSS from the real page DOM | ✅ would be | ❌ **GAP-01** (no capture has one) |
| `hand` | Analyst/model judgement; `evidence` **required** | ❌ never | ✅ |

**Main integrity limit before Stage 2.** Of 167 non-null values, only **45 (27%)** are mechanically resolved: `bodytext` and `capture-json` by invariant 8, plus `styles-json` by invariant 10. The other **122 (73%)** — `derived` (90), `tile-vision` (20), and `hand` (12) — populate the retrieval surface from stated formulas and human judgement that the current validator cannot falsify. Invariant 4 only requires formula-bearing text; it does not recompute `derived` values. That disclosure is deliberate: a derived-recomputation engine is a Stage-2 task, not a property this schema currently has.

`null` is **not** a provenance — it is a *value* state. A blank (`value: null`) still declares the provenance that *would* fill it (the worked record does this throughout: `chroma_max_measured` is `null` with `provenance: "tile-px"`), and invariant 2 requires its `gap`.

**Envelope invariants** — `corpus-validate.js` asserts all ten:

1. `provenance` ∈ the enum above.
2. **`value === null` ⟹ `gap !== null`** — one direction only. A blank must always be explained. **The converse does NOT hold:** a *populated* field may also carry a `gap`, and often should. Two distinct gap semantics:
   - **Blocking gap** (`value === null`) — nothing can fill this field. e.g. `type.display.family` + GAP-01.
   - **Caveat gap** (`value !== null`) — the field IS filled, but its derivation or quality is limited and the reader must know. e.g. `capture.covered_height_px: 118400` + GAP-05 (derived from a script literal, not captured); `capture.color_fidelity: "degraded"` + GAP-04; `commerce.awareness: "solution-aware"` + GAP-06 (a judgement, not an extraction).

   The worked record in §6 carries **20 caveat gaps against non-null values**. Treating those as errors would force the schema to choose between *lying by omission* (drop the caveat) and *lying by blanking* (null a field that is genuinely known). Both are the failure mode this schema exists to prevent, so the invariant is one-directional by design.
3. `provenance === "hand"` ⟹ `evidence !== null && evidence.length > 0`.
4. `provenance === "derived"` ⟹ `evidence` contains the formula that produced it.
5. `provenance ∈ {"dom","tile-px"}` ⟹ `value === null` **for every record in this corpus** (nothing can populate them today). A non-null `dom` or `tile-px` value is a **hard fail**: it means someone fabricated or mis-sourced it. `provenance === "styles-json"` may be non-null **only** when the cited `styles.json` exists and `styles.json#/authoredRegion/verdict === "dom-authored"`; if that verdict is `"likely-platform-chrome"` or `"unknown"`, the value **must** be `null` plus a named gap. *This check is the schema's tripwire against the failure mode.*
6. `confidence` required (non-null) for `tile-vision` and `hand` **when `value !== null`**; must be `null` for `capture-json` / `bodytext` / `derived` / `styles-json` (those are reads, not estimates). **A `null` value carries `confidence: null`** whatever its provenance — there is nothing to be confident *about* in a blank, and a confidence score on an absent value is exactly the kind of decorative number this schema exists to prevent.
7. **Class ⟹ provenance (the §3 map, enforced).** A field's fillability class implies its allowed provenance set: **A** → `capture-json | bodytext | derived` · **A⁺** → `tile-px` · **B** → `tile-vision` · **C** → `styles-json | dom` · **D** → `hand`. `corpus-validate.js` MUST reject a class/provenance mismatch. Invariants 1–6 all pass on a bodytext-derived value stamped `tile-vision`; this one fails it.
8. **Gate-grade evidence must mechanically resolve.** `provenance ∈ {"bodytext","capture-json"}` && `value !== null` ⟹ `corpus-validate.js` opens the cited artefact (file, plus line range / JSON pointer when given) and confirms the value is present — whitespace/line-break tolerant within the cited range (`bodytext.txt` renders `1,610` and `명 참여` on adjacent lines L448-449; the composite `"1,610명 참여"` still resolves). A pointer that does not resolve is a **hard fail**. This is the check that catches a *real* value carrying a *false* evidence story.
9. **`value !== null` ⟹ `provenance !== null && evidence !== null`.** A populated field must say where it came from and point at the artefact that shows it. Without this, `{value, provenance: null, confidence: null, evidence: null, gap: null}` routes cleanly around invariants 3–8 (each is conditioned on a specific provenance and never fires on `null`).
10. **`provenance === "styles-json"` && `value !== null` ⟹ the evidence pointer mechanically resolves against that record's `styles.json`, and the value exactly matches the pointed JSON value.** The pointer uses the form `styles.json#/type/display/resolvedFamily`. A pointer that does not resolve is a **hard fail**.

`evidence` is a free-text pointer that must name a real artefact: `"tile_00.jpg"`, `"data.json#/headings/1"`, `"bodytext.txt:L37"`, `"74 tiles × 1600px viewport"`.

---

## 4 · Record identity & provenance

| Field | Type | Example | **Class** | Fillable-from | Gap |
|---|---|---|:--:|---|---|
| `schema_version` | `string` (semver) | `"1.0.0"` | **A** | literal | — |
| `id` | `string` (slug, unique, = capture dir name) | `"400620"` | **A** | dir name | — |
| `capture_dir` | `string` (path rel. to `references/`) | `"captures/400620"` | **A** | filesystem | — |
| `url` | `string` (URL) | `"https://www.wadiz.kr/web/campaign/detail/400620"` | **A** | `data.json#/url` | — |
| `title` | `string` | `"[3.7억] 4년 갈고 닦은 AI 자동화 시스템 - 블로그·스레드·전자책 by 블로리즘"` | **A** | `data.json#/title` | — |
| `status` | `integer` (HTTP) | `200` | **A** | `data.json#/status` | — |
| `captured_at` | `string` (ISO date) | `"2026-06-22"` | **A** | file mtime / `wadiz-ai-digital-benchmark.md` | — |
| `family` | `<TAXONOMY.family>` | `"wadiz"` | **A** | dir layout | — |
| `mode` | `<TAXONOMY.mode>` | `"detail"` | **D** | analyst | — |
| `category` | `<TAXONOMY.category>` | `"kr-crowdfunding"` | **D** | analyst — **artifact type**, values owned by `TAXONOMY.md` §1 ("one axis: artifact type. Not sector") | — |
| `exemplar_role` | `"positive" \| "negative" \| "neutral"` | `"negative"` | **D** | curator (`hand`); record the concrete rationale in `notes` | — |
| `sector` | `<TAXONOMY.sector>` | `"ai-digital"` | **D** | analyst — **industry axis**, orthogonal to `category` (a real query needs both: a Wadiz 상세페이지 × for an AI course). Vocabulary unowned, Stage-2 decision | — |
| `locale` | `string` (BCP-47) | `"ko-KR"` | **A** | `bodytext.txt` script detection | — |
| `expanded` | `string \| null` | `"더보기"` | **A** | `data.json#/expanded` (Wadiz only; `null` for app-ui) | — |
| `notes` | `string \| null` | `"Reward sidebar is Wadiz platform chrome, not campaign design — see GAP-07."` | **D** | analyst | — |

`mode`, `category`, `exemplar_role`, `sector`, `family` are **bare** (not enveloped): they are corpus-curation decisions made when the record is created, not extractions. `exemplar_role` is a class **D** `hand` decision; its evidence is the record's concrete `notes` rationale, rather than an invented envelope shape. Its closed set is exactly `positive` (design to imitate), `negative` (cautionary anti-pattern), and `neutral` (structural/reference-only). Stage 3 **must retrieve only `positive` (and optionally `neutral`) for imitation; it may serve `negative` only as a “do not do this” contrast, never as a model to copy.** (`category` was previously overloaded to carry the industry value `"ai-digital"`; that collided with `TAXONOMY.md` §1, which owns `category` as **artifact type** — the industry axis now lives in `sector`. Ruling: TAXONOMY wins — C-3.)

### 4.1 `capture` — what is actually on disk

Enveloped. This block is what lets the librarian rank by evidence quality and lets the gate know what it may trust.

**Every field in this block is class A** — pure stdlib Node over what is already on disk. This block costs nothing to populate and is the corpus's most trustworthy layer.

| Field | Type | Example (400620) | **Class** | Fillable-from | Gap |
|---|---|---|:--:|---|---|
| `capture.page_height_px` | `integer` | `117039` | **A** | `data.json#/pageHeight` | — |
| `capture.body_text_len` | `integer` | `5894` | **A** | `data.json#/bodyTextLen` | — |
| `capture.image_count` | `integer` | `39` | **A** | `data.json#/imageCount` (script filter: `naturalWidth > 200`) | — |
| `capture.big_images` | `string[]` (URLs) | 26 entries, 25 unique, 2 `.gif` | **A** | `data.json#/bigImages` (script filter: `naturalHeight > 350`, `slice(0,80)`) | GAP-09 (remote; link-rot) |
| `capture.tile_count` | `integer` | `74` | **A** | `capture.json#/tiles` (app-ui) · **`derived`**: count `tile_*` on disk (Wadiz) | — |
| `capture.tile_w_px` / `tile_h_px` | `integer` | `720` / `900` | **A** | file header | — |
| `capture.tile_format` | `<TAXONOMY.tile_format>` | `"jpeg"` | **A** | file header | — |
| `capture.tile_scale` | `float` (stored ÷ capture viewport) | `0.5625` | **A** | `derived`: `720/1280` | — |
| `capture.covered_height_px` | `integer` | `118400` | **A** | `capture.json#/coveredHeight` (app-ui) · **`derived`**: `74 × 1600` (Wadiz; `1600` is the `tileHeight` literal in `capture-reference-patchright.js`) | GAP-05 |
| `capture.coverage_ok` | `boolean` | `true` | **A** | `derived`: `covered_height_px >= page_height_px` (118400 ≥ 117039) | GAP-05 |
| `capture.color_fidelity` | `<TAXONOMY.color_fidelity>` | `"degraded"` (JPEG + 0.5625 downscale) · app-ui: `"lossless"` | **A** | `derived` from format+scale | GAP-04 |
| `capture.has_dom` | `boolean` | `false` — **`false` for every record; `index.html` is a viewer (§2.2)** | **A** | `derived` | GAP-01 |

---

## 5 · The extracted token block

Everything in §5 is enveloped per §3.

### 5.1 `palette`

Split deliberately: **roles are fillable today, the numeric ramp is not** (§2.4).

| Field | Type | Example (400620) | **Class** | Fillable-from | Gap |
|---|---|---|:--:|---|---|
| `palette.roles.dominant_60` | `{hue_family: <TAXONOMY.hue_family>, role_note: string}` | `{hue_family:"achromatic", role_note:"black/charcoal ground floods the campaign bands"}` | **B** | `tile-vision` | — |
| `palette.roles.secondary_30` | same | `{hue_family:"yellow", role_note:"warm yellow in claim strips and highlight boxes"}` | **B** | `tile-vision` | — |
| `palette.roles.accent_10` | same | `{hue_family:"lime-green", role_note:"acid-lime reserved for the focal claim + the ∞ glyph"}` | **B** | `tile-vision` | — |
| `palette.roles.field_committed` | `boolean` | `true` | **B** | `tile-vision` | — |
| `palette.roles.field_evidence` | `string` | `"tile_00.jpg — full-bleed black hero band, acid-lime display type reversed out"` | **B** | `tile-vision` | — |
| `palette.roles.field_sections` | `integer` (bands the field owns) | `null` | **B** | `tile-vision` (needs a full 74-tile pass) | GAP-09 (no section→tile offset map) |
| `palette.temperature` | `<TAXONOMY.temperature>` | `"cool-ground-warm-accent"` | **B** | `tile-vision` | — |
| `palette.computed_backgrounds` | `{value:string, cssRgb?:string, areaShare:number}[] \| null` | `[{value:"#08090a", areaShare:0.842}]` | **C** | `styles.json#/color/backgrounds` only when `authoredRegion.verdict === "dom-authored"`; these are raw computed backgrounds, **not** a 60/30/10 role judgement | **GAP-01** / **GAP-07** |
| `palette.ramp` | `{name, oklch:{l,c,h}\|null, hex_approx, role}[]` | `[{name:"ground", oklch:null, hex_approx:"#0B0B0C", role:"dominant_60"}, {name:"acid-lime", oklch:null, hex_approx:"#C9FF3D", role:"accent_10"}]` | **A⁺** | `tile-px` (quantise decoded tiles) | **GAP-03** (decoder) + **GAP-04** (JPEG bias) |
| `palette.ramp[].oklch` | `{l:0–1, c:0–1, h:0–360} \| null` | `null` | **A⁺** | `tile-px` (approximate, **rendered**) — **never `dom`/source** | **GAP-02** (rendered ≠ source; permanent) |
| `palette.ramp[].hex_approx` | `string` (hex) | `"#C9FF3D"` | **B** | `tile-vision` — **eyeball approximation, `confidence` required, NOT a measurement** | GAP-03 (A⁺ would replace this with a real measurement) |
| `palette.chroma_max_measured` | `float \| null` | `null` | **A⁺** | `tile-px` | **GAP-02, GAP-03, GAP-04** |
| `palette.chrome_excluded` | `boolean` | `false` | **D** | analyst | **GAP-07** — nothing separates Wadiz platform UI (teal CTA, nav, reward rail) from campaign-authored bands |

**The palette block is the schema's sharpest cost lesson.** Colour is the one design token whose signal genuinely *is* on disk — tiles are pixels. So palette is **A⁺, not C**: one decoder dep away, no re-capture. But the *roles* (which colour is the 60, which is the reserved 10, does a field own a band) are **B** — quantisation returns a histogram, not an intent. And `oklch` is permanently capped by **GAP-02**: a rendered measurement is not the `@theme` source value the plan gate checks, no matter how good the decoder.

**Units contract.** Where an OKLCH value *is* eventually populated, it uses `anti-ai-eval.js`'s exact units so a future positive dimension can read the record with no conversion: `c` on 0–1 (the grader's chromatic floor is `c >= 0.02`; its accent floor is `c >= 0.12`), `h` in degrees 0–360 (grader hue buckets: size 24 general, 18 accent; warm band `h ∈ [20,105]`), `l` on 0–1.

**`hex_approx` vs `oklch` is not redundancy.** `hex_approx` is a vision model naming a colour it can see (reliable enough to say "acid-lime, not purple"); `oklch` is a measurement (currently impossible). They carry different provenance, and §8.1's ladder holds both below fail grade (`tile-vision` warns, `tile-px` would be advisory too); neither is ever compared numerically against a plan value (GAP-02; §8.2 check 2).

### 5.2 `type`

**This is the block the roadmap's G1.4 premise assumed and the original pipeline could not deliver.** Existing records without a qualifying `styles.json` remain `null`; a collector read is legal only through `styles-json` and invariant 5's authored-region gate. The block remains specified so `corpus-validate.js` rejects a non-null legacy `dom` value as fabrication.

**Class C, precisely.** To move the six `dom` fields to fillable, `page.evaluate()` in `capture-reference-patchright.js` / `capture-reference.js` would have to start returning:

```js
// none of this exists in the current evaluate block — verified §2.2
fonts:   [...document.fonts].map(f => ({family:f.family, weight:f.weight, style:f.style})),
computed: sampleNodes.map(el => {                       // e.g. h1,h2,h3,p,button — a sampled set
  const s = getComputedStyle(el);
  return { sel: cssPath(el), fontFamily: s.fontFamily, fontWeight: s.fontWeight,
           fontSize: s.fontSize, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing,
           margin: s.margin, padding: s.padding, borderRadius: s.borderRadius,
           transitionDuration: s.transitionDuration, transitionTimingFunction: s.transitionTimingFunction };
}),
cssVars: (() => { const r = getComputedStyle(document.documentElement); /* enumerate --* */ })(),
```

…plus a re-capture of all 6 exemplars. **For the two Wadiz records that means re-crossing the Akamai wall** (`captures/README.md`: *"Akamai 차단 시 `{"blocked":true}` → 몇 분 쿨다운 후 재시도"`), which may fail outright. That cost is why the honest answer for type-pairing today is **"not fillable"**, and why §7 does not retrieve on it.

| Field | Type | Example | **Class** | Fillable-from | Gap |
|---|---|---|:--:|---|---|
| `type.display.family` | `string \| null` | `null` | **C** | `dom` → needs `getComputedStyle().fontFamily` | **GAP-01** |
| `type.display.weights` | `integer[] \| null` | `null` | **C** | `dom` → needs `getComputedStyle().fontWeight` | **GAP-01** |
| `type.body.family` | `string \| null` | `null` | **C** | `dom` → `fontFamily` | **GAP-01** |
| `type.body.weights` | `integer[] \| null` | `null` | **C** | `dom` → `fontWeight` | **GAP-01** |
| `type.mono.family` | `string \| null` | `null` | **C** | `dom` → `fontFamily` + `document.fonts` | **GAP-01** |
| `type.scale_px` | `number[] \| null` | `null` | **C** | `dom` → `fontSize` over a sampled node set | **GAP-01** |
| `type.pairing_note` | `string` | `"Heavy KR display (Black Han Sans-class geometric sans) vs light KR body; Latin numerals set tabular in the authority row."` | **B** | `tile-vision` — **describes what is visible; must NOT name a family as fact** | GAP-01 |
| `type.weight_contrast_observed` | `<TAXONOMY.weight_contrast>` | `"extreme"` | **B** | `tile-vision` | — |
| `type.kr_display_present` | `boolean` | `true` | **B** | `tile-vision` | — |

**Rule.** `type.pairing_note` may say *"a heavy geometric KR sans in the Black Han Sans class"*. It may **not** set `type.display.family = "Black Han Sans"`. Identifying a font from a 0.5625-downscaled JPEG is a guess, and a guess written into a `dom`-typed field is exactly the fabrication invariant 5 catches. Font identification stays in prose, hedged, with `confidence`.

### 5.3 `layout` & `rhythm`

| Field | Type | Example (400620) | **Class** | Fillable-from | Gap |
|---|---|---|:--:|---|---|
| `layout.archetype` | `<TAXONOMY.layout_archetype>` | `"image-band-scroll"` | **B** | `tile-vision` | — |
| `layout.content_width_px` | `integer \| null` | `860` | **B** | `tile-vision` (matched against known platform widths) | GAP-03 (exact px → A⁺ with a decoder) |
| `layout.column_system` | `string` | `"single column body + persistent right reward rail (desktop) — the rail is platform chrome"` | **B** | `tile-vision` | GAP-07 |
| `layout.primitive_repeated` | `string` | `"full-bleed claim band → evidence object → interpretation line"` | **B** | `tile-vision` | — |
| `rhythm.band_count` | `integer \| null` | `null` | **B** | `tile-vision` (full 74-tile pass) | GAP-09 |
| `rhythm.median_band_height_px` | `integer \| null` | `null` | **A** (inherits **B** via `band_count`) | `derived` from `rhythm.band_count` | GAP-09 |
| `rhythm.viewports` | `float` | `73.1` | **A** | `derived`: `117039 / 1600` | — |
| `rhythm.text_density` | `float` (chars per viewport) | `80.6` | **A** | `derived`: `5894 / 73.1` | — |
| `rhythm.image_density` | `float` (images per viewport) | `0.53` | **A** | `derived`: `39 / 73.1` | — |
| `rhythm.spacing_scale_px` | `number[] \| null` | `null` | **C** | `dom` → needs `getComputedStyle()` `margin`/`padding`/`gap` over a sampled node set | **GAP-01** |
| `rhythm.radius_scale_px` | `number[] \| null` | `null` | **C** | `dom` → needs `getComputedStyle().borderRadius` | **GAP-01** |

`rhythm.text_density` and `image_density` are the honest, fully-captured substitute for a spacing scale on an image-dominant page. `80.6` chars/viewport vs Linear's `8244/6.6 = 1249` is a **real, gate-grade, zero-inference discriminator** between an image-band detail page and a text-led app-UI landing page — computed entirely from `data.json`. §7 Pass 2 reads these at weight 0.15 precisely because they need no vision and no decoder.

### 5.4 `signature` — the named move

The single element the page is remembered by (SKILL.md §2). One per record.

| Field | Type | Example (400620) | **Class** | Fillable-from | Gap |
|---|---|---|:--:|---|---|
| `signature.name` | `string` (short, nameable) | `"Neon-lime infinity loop on black"` | **B** | `tile-vision` | — |
| `signature.family` | `<TAXONOMY.signature_family>` | `"none"` | **B** | `tile-vision`; use the coarse TAXONOMY shelf key, not a specific signature move | — |
| `signature.description` | `string` | `"A glowing acid-lime ∞ rendered as 3D tubing on a pure-black field, sitting under the display headline — the 'runs forever' claim made into a single object rather than stated."` | **B** | `tile-vision` | — |
| `signature.evidence_tiles` | `string[]` | `["tile_00.jpg"]` | **B** | `tile-vision` | GAP-09 (no offset map → cannot prove recurrence across all 74 without a full pass) |
| `signature.embodies_brief` | `string` | `"Automation = a loop that never stops; the glyph IS the product's promise."` | **D** | `hand` | — |
| `signature.tell_risk` | `string[]` (exact `anti-ai-eval.js` tell ids) | `[]` | **D** | `hand`, cross-checked vs §8.3 | — |
| `signature.recurrence` | `<TAXONOMY.recurrence>` | `"hero-anchored"` | **B** | `tile-vision` | GAP-09 |

**The signature block is entirely B/D — there is no A path to it, at any budget.** "What is this page remembered by" is not a histogram or a regex; it is a read. `signature.*` is the most valuable thing a design corpus can hold, and it is *only* reachable by a vision model or a human — which is why it matters that the vision path is already shipped and free today (§3: `lib-openai-responses.js` + codex OAuth). It is most of what SKILL.md §2 asks the librarian for.

**`signature.tell_risk` is mandatory and may be `[]` — but `[]` must be a decision, not a default.** An exemplar's signature can itself be a machine tell (a corpus record whose signature is a ghost numeral would teach `ghost-numeral`). Values are drawn from the 18 ids `anti-ai-eval.js` actually emits (§8.3). The gate uses this to refuse to reward a retrieved technique the grader independently penalises.

### 5.5 `motion`

Tiles are stills. **The corpus captures no motion.**

| Field | Type | Example (400620) | **Class** | Fillable-from | Gap |
|---|---|---|:--:|---|---|
| `motion.gif_asset_count` | `integer` | `2` | **A** | `derived`: `bigImages[]` entries ending `.gif` | — |
| `motion.gif_evidence` | `string[]` (URLs) | `[".../13431b67-…gif", ".../1a0836cb-…gif"]` | **A** | `data.json#/bigImages` | GAP-09 (remote; link-rot) |
| `motion.dynamic_demo_present` | `boolean` | `true` | **A** | `derived`: `gif_asset_count > 0` | — |
| `motion.notes` | `string` | `"Two GIF assets in the story body — the skill's 'demonstrate dynamic features with GIF/video' rule (korean-detailpage.md) is observed. Frame content unknown: not archived, not tiled."` | **D** | `hand` | GAP-08 |
| `motion.durations_ms` | `number[] \| null` | `null` | **C** | `dom` → needs `getComputedStyle().transitionDuration`/`animationDuration` + `document.getAnimations()` | **GAP-08 / GAP-01** |
| `motion.easings` | `string[] \| null` | `null` | **C** | `dom` → needs `transitionTimingFunction`/`animationTimingFunction` | **GAP-08 / GAP-01** |
| `motion.reduced_motion_honored` | `boolean \| null` | `null` | **C** | `dom` → needs a second capture pass under `prefers-reduced-motion: reduce` | **GAP-08 / GAP-01** |

`gif_asset_count` is the **only** real motion signal in the corpus (`derived`, zero inference) — but it has **no §7/§8 consumer today**: `anti-ai-eval.js`'s motion vocabulary (`durations[]`, `easings[]`, `jsAnimations[]`) has no exemplar counterpart, so the gate cannot compare an output's motion against a corpus exemplar's. Forward-compat only, exactly like `type.*` (§5.2), until GAP-08 closes. → **GAP-08**

### 5.6 `commerce` — conversion arc + Schwartz

Present when `mode = "detail"` or `"landing"`; `null` for pure app-UI reference records.

| Field | Type | Example (400620) | **Class** | Fillable-from | Gap |
|---|---|---|:--:|---|---|
| `commerce.awareness` | `<TAXONOMY.awareness>` (unaware→most-aware) | `"solution-aware"` | **D** | `hand` — **judgement** | **GAP-06** |
| `commerce.awareness_evidence` | `string` | `"Hero opens on mechanism + credential ('4년 노하우 압축', '30분이면 자동 수익 세팅') with no pain-agitation block — korean-detailpage.md maps that opening to solution-aware."` | **D** | `hand` | GAP-06 |
| `commerce.sophistication` | `integer` 1–5 | `4` | **D** | `hand` — **judgement** | **GAP-06** |
| `commerce.sophistication_evidence` | `string` | `"Claim leads with a proprietary mechanism + 4-year provenance rather than a bare superlative — the stage-4 'claims exhausted' pivot in korean-detailpage.md."` | **D** | `hand` | GAP-06 |
| `commerce.arc` | `{stage:<TAXONOMY.pasona_stage>, present:boolean, evidence:string}[]` | see §6 | **B** | `bodytext` + `data.json#/headings` — the text is on disk, but **labelling a passage as a PASONA stage is a semantic read** | — |
| `commerce.arc_coverage` | `float` 0–1 | `1.0` | **A** (inherits **B** via `arc`) | `derived`: (# `present === true`) ÷ `arc_resolved` — **resolved stages only**, per §7's null rule (a `null` stage joins neither numerator nor denominator) | — |
| `commerce.arc_resolved` | `integer` 0–6 | `5` | **A** (inherits **B** via `arc`) | `derived`: count of `arc[]` stages with `present !== null` — the explicit denominator | — |
| `commerce.arc_total` | `integer` | `6` | **A** | `derived`: PASONA stage count (constant) — so a reader can see how many stages went unresolved | — |
| `commerce.authority_numbers` | `string[]` | `["1,610명 참여","182,492,000원 달성","36,498% 달성","2,500명이 팔로우"]` | **A** | `bodytext` — `bodytext.txt:L448-455,L465` (figures **with units** in the funding-header block; the file's *head* carries `1,610`/`1,790` as bare nav counters, but `document.body.innerText` covers the whole body and the unit-bearing lines are at L448+) | — |
| `commerce.reward_ladder` | `{label, discount_pct, price_krw}[]` | `[{label:"울트라 얼리버드 70% 혜택", discount_pct:70, price_krw:790000}, {label:"얼리버드 66% 혜택", discount_pct:66, price_krw:890000}]` | **B** | `tile-vision` + `bodytext` | GAP-07 (rail is platform chrome) |
| `commerce.urgency_device` | `string` | `"⏰오늘 23:59 완전 종료‼️잠시후 진짜 마지막입니다."` | **A** | `bodytext` — regex over the urgency lexicon in `korean-detailpage.md` §Vocabulary (마감임박·한정수량·선착순·오늘까지·종료) | — |
| `commerce.urgency_repetition` | `integer` | `19` (`얼리버드` occurrences) | **A** | `derived`: regex count over `bodytext.txt` | — |
| `commerce.one_message` | `string` | `"4년치 AI 자동화 노하우를 30분 세팅으로 압축해 판다."` | **D** | `hand` | — |

**`commerce` is the corpus's cheapest block.** `urgency_device`, `urgency_repetition`, `arc_coverage`, and `authority_numbers` are A; the arc itself is B but reads *text*, not pixels — the cheapest possible vision/LLM call, and one that could plausibly run on a local model. Nothing here is C. §7 Pass 2 reads `urgency_device`, `urgency_repetition`, and `arc_coverage` (combined weight 0.25); `one_message` and `authority_numbers` have **no §7/§8 consumer today — forward-compat, like `type.*` (§5.2)**.

---

## 6 · Worked `record.json` — 400620, real values

Every non-null value below is traceable to `captures/400620/` on disk. Values that are not fillable are `null` with a gap ref — including several a plausible-looking record would have invented.

```jsonc
{
  "schema_version": "1.0.0",
  "id": "400620",
  "capture_dir": "captures/400620",
  "url": "https://www.wadiz.kr/web/campaign/detail/400620",
  "title": "[3.7억] 4년 갈고 닦은 AI 자동화 시스템 - 블로그·스레드·전자책 by 블로리즘",
  "status": 200,
  "captured_at": "2026-06-22",
  "family": "wadiz",
  "mode": "detail",
  "category": "kr-crowdfunding",
  "exemplar_role": "negative",
  "sector": "ai-digital",
  "locale": "ko-KR",
  "expanded": "더보기",
  "notes": "The right reward rail and the teal 재오픈 요청하기 button are Wadiz PLATFORM chrome, not 블로리즘's design. Palette fields describe the campaign-authored bands only — the boundary is unmarked in the capture (GAP-07).",

  "capture": {
    "page_height_px":   { "value": 117039, "provenance": "capture-json", "confidence": null, "evidence": "data.json#/pageHeight", "gap": null },
    "body_text_len":    { "value": 5894,   "provenance": "capture-json", "confidence": null, "evidence": "data.json#/bodyTextLen", "gap": null },
    "image_count":      { "value": 39,     "provenance": "capture-json", "confidence": null, "evidence": "data.json#/imageCount", "gap": null },
    "big_images":       { "value": ["https://cdn3.wadiz.kr/studio/images/2026/04/21/2078a2e4-a30a-4aa1-859d-b03010961dbc.png/wadiz/resize/800/format/jpg/quality/85/", "…24 more…"], "provenance": "capture-json", "confidence": null, "evidence": "data.json#/bigImages — 26 entries, 25 unique, vs imageCount 39", "gap": "GAP-09" },
    "tile_count":       { "value": 74,     "provenance": "derived", "confidence": null, "evidence": "count of tile_*.jpg on disk (tile_00..tile_73); Wadiz has no capture.json", "gap": null },
    "tile_w_px":        { "value": 720,    "provenance": "derived", "confidence": null, "evidence": "JPEG header, tile_00.jpg", "gap": null },
    "tile_h_px":        { "value": 900,    "provenance": "derived", "confidence": null, "evidence": "JPEG header, tile_00.jpg", "gap": null },
    "tile_format":      { "value": "jpeg", "provenance": "derived", "confidence": null, "evidence": "JFIF baseline, precision 8, 3 components", "gap": null },
    "tile_scale":       { "value": 0.5625, "provenance": "derived", "confidence": null, "evidence": "720/1280 = 900/1600 = 0.5625; captures/README.md notes the JPEGs are 축소본", "gap": null },
    "covered_height_px":{ "value": 118400, "provenance": "derived", "confidence": null, "evidence": "74 tiles × 1600px viewport height; 1600 is read off app-ui capture.json (11200/7), NOT recorded by this capture", "gap": "GAP-05" },
    "coverage_ok":      { "value": true,   "provenance": "derived", "confidence": null, "evidence": "118400 >= 117039", "gap": "GAP-05" },
    "color_fidelity":   { "value": "degraded", "provenance": "derived", "confidence": null, "evidence": "baseline JPEG (chroma-subsampled) + 0.5625 downscale", "gap": "GAP-04" },
    "has_dom":          { "value": false,  "provenance": "derived", "confidence": null, "evidence": "index.html is a generated view-capture.js viewer: its <style> is body{background:#222}/.page{max-width:720px} + 74 <img> tags. Zero campaign markup.", "gap": "GAP-01" }
  },

  "palette": {
    "roles": {
      "dominant_60":     { "value": { "hue_family": "achromatic", "role_note": "black/charcoal ground floods the campaign image bands" }, "provenance": "tile-vision", "confidence": 0.9, "evidence": "tile_00.jpg hero band; tile_13.jpg story band", "gap": null },
      "secondary_30":    { "value": { "hue_family": "yellow", "role_note": "warm yellow in claim strips and highlight boxes" }, "provenance": "tile-vision", "confidence": 0.75, "evidence": "tile_00.jpg '4년 노하우 압축!' strip", "gap": null },
      "accent_10":       { "value": { "hue_family": "lime-green", "role_note": "acid-lime reserved for the focal claim and the ∞ glyph" }, "provenance": "tile-vision", "confidence": 0.9, "evidence": "tile_00.jpg '30분이면 자동 수익 세팅' + infinity glyph", "gap": null },
      "field_committed": { "value": true, "provenance": "tile-vision", "confidence": 0.9, "evidence": "tile_00.jpg — full-bleed black hero band with acid-lime display type reversed out", "gap": null },
      "field_sections":  { "value": null, "provenance": "tile-vision", "confidence": null, "evidence": null, "gap": "GAP-09" }
    },
    "temperature":          { "value": "cool-ground-warm-accent", "provenance": "tile-vision", "confidence": 0.7, "evidence": "tile_00.jpg", "gap": null },
    "ramp": [
      { "name": "ground",    "oklch": null, "hex_approx": { "value": "#0B0B0C", "provenance": "tile-vision", "confidence": 0.6, "evidence": "tile_00.jpg hero ground — eyeball approximation, NOT a measurement", "gap": "GAP-03" }, "role": "dominant_60" },
      { "name": "acid-lime", "oklch": null, "hex_approx": { "value": "#C9FF3D", "provenance": "tile-vision", "confidence": 0.5, "evidence": "tile_00.jpg display type — JPEG chroma-subsampled + downscaled, so this reads LOW-biased (GAP-04)", "gap": "GAP-03" }, "role": "accent_10" }
    ],
    "chroma_max_measured":  { "value": null, "provenance": "tile-px", "confidence": null, "evidence": null, "gap": "GAP-02" },
    "chrome_excluded":      { "value": false, "provenance": "hand", "confidence": 1.0, "evidence": "Wadiz nav + teal CTA + reward rail are inside every tile and are unmarked; see notes.", "gap": "GAP-07" }
  },

  "type": {
    "display": { "family": { "value": null, "provenance": "dom", "confidence": null, "evidence": null, "gap": "GAP-01" },
                 "weights": { "value": null, "provenance": "dom", "confidence": null, "evidence": null, "gap": "GAP-01" } },
    "body":    { "family": { "value": null, "provenance": "dom", "confidence": null, "evidence": null, "gap": "GAP-01" },
                 "weights": { "value": null, "provenance": "dom", "confidence": null, "evidence": null, "gap": "GAP-01" } },
    "mono":    { "family": { "value": null, "provenance": "dom", "confidence": null, "evidence": null, "gap": "GAP-01" } },
    "scale_px":{ "value": null, "provenance": "dom", "confidence": null, "evidence": null, "gap": "GAP-01" },
    "pairing_note": { "value": "Heavy geometric KR display sans (Black Han Sans class) against a light KR body; Latin numerals carry the authority row. Families NOT identified — no DOM, and a 0.5625 JPEG will not support an ID.", "provenance": "tile-vision", "confidence": 0.55, "evidence": "tile_00.jpg", "gap": "GAP-01" },
    "weight_contrast_observed": { "value": "extreme", "provenance": "tile-vision", "confidence": 0.85, "evidence": "tile_00.jpg — display headline vs WAi summary body", "gap": null },
    "kr_display_present": { "value": true, "provenance": "tile-vision", "confidence": 0.95, "evidence": "tile_00.jpg", "gap": null }
  },

  "layout": {
    "archetype":          { "value": "image-band-scroll", "provenance": "tile-vision", "confidence": 0.95, "evidence": "tile_00.jpg + pageHeight 117039 over 74 tiles", "gap": null },
    "content_width_px":   { "value": 860, "provenance": "tile-vision", "confidence": 0.6, "evidence": "story column measured against the Wadiz 860px platform default (korean-detailpage.md); not px-measured", "gap": "GAP-03" },
    "column_system":      { "value": "single-column story body + persistent right reward rail on desktop (rail = platform chrome)", "provenance": "tile-vision", "confidence": 0.9, "evidence": "tile_00.jpg", "gap": "GAP-07" },
    "primitive_repeated": { "value": "full-bleed claim band → evidence object → interpretation line", "provenance": "tile-vision", "confidence": 0.7, "evidence": "tile_00.jpg; matches the page-rhythm grammar in wadiz-ai-digital-benchmark.md", "gap": null }
  },

  "rhythm": {
    "band_count":            { "value": null, "provenance": "tile-vision", "confidence": null, "evidence": null, "gap": "GAP-09" },
    "median_band_height_px": { "value": null, "provenance": "derived", "confidence": null, "evidence": null, "gap": "GAP-09" },
    "viewports":             { "value": 73.1, "provenance": "derived", "confidence": null, "evidence": "117039 / 1600", "gap": null },
    "text_density":          { "value": 80.6, "provenance": "derived", "confidence": null, "evidence": "5894 chars / 73.1 viewports", "gap": null },
    "image_density":         { "value": 0.53, "provenance": "derived", "confidence": null, "evidence": "39 images / 73.1 viewports", "gap": null },
    "spacing_scale_px":      { "value": null, "provenance": "dom", "confidence": null, "evidence": null, "gap": "GAP-01" },
    "radius_scale_px":       { "value": null, "provenance": "dom", "confidence": null, "evidence": null, "gap": "GAP-01" }
  },

  "signature": {
    "name":            { "value": "Neon-lime infinity loop on black", "provenance": "tile-vision", "confidence": 0.85, "evidence": "tile_00.jpg", "gap": null },
    "family":          { "value": "none", "provenance": "tile-vision", "confidence": 0.8, "evidence": "tile_00.jpg", "gap": null },
    "description":     { "value": "A glowing acid-lime ∞ rendered as 3D tubing on a pure-black field, seated under the display headline — the 'runs forever' automation claim made into a single object instead of stated.", "provenance": "tile-vision", "confidence": 0.85, "evidence": "tile_00.jpg", "gap": null },
    "evidence_tiles":  { "value": ["tile_00.jpg"], "provenance": "tile-vision", "confidence": 0.85, "evidence": "hero tile only — recurrence across the other 73 tiles not swept", "gap": "GAP-09" },
    "embodies_brief":  { "value": "Automation = a loop that never stops. The glyph IS the promise, not decoration next to it.", "provenance": "hand", "confidence": 0.8, "evidence": "tile_00.jpg glyph + title 'AI 자동화 시스템'", "gap": null },
    "tell_risk":       { "value": [], "provenance": "hand", "confidence": 0.7, "evidence": "Checked against the 18 anti-ai-eval tell ids. Nearest neighbour is 'ghost-numeral' (huge focal graphic) but the ∞ is filled/dimensional and carries the page's actual claim, not an outlined numeral counting nothing. NOTE: the black + acid-lime pairing is adjacent to anti-ai-tells.md tell #2 (acid-green flood + near-black) — this exemplar teaches conversion grammar, and its palette must NOT be retrieved as a colour model. See §8.3.", "gap": null },
    "recurrence":      { "value": "hero-anchored", "provenance": "tile-vision", "confidence": 0.5, "evidence": "tile_00.jpg", "gap": "GAP-09" }
  },

  "motion": {
    "gif_asset_count":        { "value": 2, "provenance": "derived", "confidence": null, "evidence": "bigImages[] entries ending .gif (indices 5, 15)", "gap": null },
    "gif_evidence":           { "value": ["https://cdn3.wadiz.kr/studio/images/2026/04/22/13431b67-e075-4d0b-af47-70b44bd15e4d.gif", "https://cdn3.wadiz.kr/studio/images/2026/04/16/1a0836cb-187e-4f02-a2fd-f375547b225c.gif"], "provenance": "capture-json", "confidence": null, "evidence": "data.json#/bigImages", "gap": "GAP-09" },
    "dynamic_demo_present":   { "value": true, "provenance": "derived", "confidence": null, "evidence": "gif_asset_count > 0", "gap": null },
    "notes":                  { "value": "Two GIF assets in the story body — korean-detailpage.md's 'demonstrate dynamic features with GIF/video' rule is observed. Frame content unknown: GIFs are remote, not archived, not tiled.", "provenance": "hand", "confidence": 0.9, "evidence": "data.json#/bigImages", "gap": "GAP-08" },
    "durations_ms":           { "value": null, "provenance": "dom", "confidence": null, "evidence": null, "gap": "GAP-08" },
    "easings":                { "value": null, "provenance": "dom", "confidence": null, "evidence": null, "gap": "GAP-08" },
    "reduced_motion_honored": { "value": null, "provenance": "dom", "confidence": null, "evidence": null, "gap": "GAP-08" }
  },

  "commerce": {
    "awareness":                 { "value": "solution-aware", "provenance": "hand", "confidence": 0.65, "evidence": "Hero opens on mechanism + credential ('4년 노하우 압축', '30분이면 자동 수익 세팅') with no pain-agitation block; korean-detailpage.md maps that opening to solution-aware.", "gap": "GAP-06" },
    "sophistication":            { "value": 4, "provenance": "hand", "confidence": 0.6, "evidence": "Leads with proprietary mechanism + 4-year provenance rather than a bare superlative — korean-detailpage.md's stage-4 'claims exhausted' pivot.", "gap": "GAP-06" },
    "arc": [
      { "stage": "problem",  "present": true,  "evidence": "bodytext.txt — '혼자 하다가 막히면 어쩌죠?' (Maker Story opens on the reader's objection)" },
      { "stage": "affinity", "present": true,  "evidence": "bodytext.txt — '이 질문을 가장 많이 받습니다. 걱정하지 마세요.'" },
      { "stage": "solution", "present": true,  "evidence": "data.json#/headings 'H3: 프로젝트 스토리'; tile_00.jpg WAi summary '30일 완성 AI 자동화 — 4년 노하우를 30일로 압축한 체계적 오더 가이드'" },
      { "stage": "offer",    "present": true,  "evidence": "tile_00.jpg reward rail — 63%/449,000원 · 70%/790,000원 · 66%/890,000원 · 54%/199,000원" },
      { "stage": "narrow",   "present": null,  "evidence": null },
      { "stage": "action",   "present": true,  "evidence": "bodytext.txt — '⏰오늘 23:59 완전 종료‼️잠시후 진짜 마지막입니다.'" }
    ],
    "arc_resolved":              { "value": 5, "provenance": "derived", "confidence": null, "evidence": "count of arc[] stages with present !== null — 'narrow' is null (GAP-09)", "gap": "GAP-09" },
    "arc_total":                 { "value": 6, "provenance": "derived", "confidence": null, "evidence": "PASONA stage count", "gap": null },
    "arc_coverage":              { "value": 1.0, "provenance": "derived", "confidence": null, "evidence": "5 present ÷ 5 resolved; 'narrow' is null, not false (a full 74-tile sweep was not run — GAP-09) and per §7's null rule joins neither numerator nor denominator", "gap": "GAP-09" },
    "authority_numbers":         { "value": ["1,610명 참여", "182,492,000원 달성", "36,498% 달성", "2,500명이 팔로우"], "provenance": "bodytext", "confidence": null, "evidence": "bodytext.txt:L448-455,L465", "gap": null },
    "reward_ladder":             { "value": [ { "label": "울트라 얼리버드 70% 혜택", "discount_pct": 70, "price_krw": 790000 }, { "label": "얼리버드 66% 혜택", "discount_pct": 66, "price_krw": 890000 }, { "label": "추천 얼리버드 63% 혜택", "discount_pct": 63, "price_krw": 449000 }, { "label": "울트라 얼리버드 54% 혜택", "discount_pct": 54, "price_krw": 199000 } ], "provenance": "tile-vision", "confidence": 0.8, "evidence": "tile_00.jpg reward rail; prices 790,000/890,000 corroborated in bodytext.txt", "gap": "GAP-07" },
    "urgency_device":            { "value": "⏰오늘 23:59 완전 종료‼️잠시후 진짜 마지막입니다.", "provenance": "bodytext", "confidence": null, "evidence": "bodytext.txt", "gap": null },
    "urgency_repetition":        { "value": 19, "provenance": "derived", "confidence": null, "evidence": "regex count of '얼리버드' over bodytext.txt", "gap": null },
    "one_message":               { "value": "4년치 AI 자동화 노하우를 30분 세팅으로 압축해 판다.", "provenance": "hand", "confidence": 0.8, "evidence": "title + tile_00.jpg hero claim", "gap": null }
  }
}
```

**What this record deliberately does not claim.** No font family. No OKLCH ramp. No measured chroma. No band count. No PASONA `narrow` verdict (`null`, not `false` — absence of evidence is not evidence of absence). Those are the fields a fabricated record would have filled most confidently.

---

## 7 · Forward-compat: how the librarian queries this (Stage 3)

**Query:** a brief → top-K exemplars. Brief shape (from SKILL.md §1–2, plus `sector` — the industry axis C-3 split out of the previously overloaded `category`): `{ mode, category, sector, awareness, sophistication, subject, moods[] }`.

**Retrieval runs in three passes.**

**Pass 1 — hard filters** (bare fields; no envelope, no provenance concern):
```
family?  mode == brief.mode          # a landing brief must not retrieve a 상세페이지 arc
         category == brief.category  # artifact type — <TAXONOMY.category>, values owned by TAXONOMY.md §1; else fall back to sibling categories
         sector == brief.sector      # industry axis (e.g. "ai-digital") — orthogonal to category; a real query needs both
         exemplar_role == "positive" || (includeNeutral && exemplar_role == "neutral")
```

For imitation, `negative` is excluded from this pass: retrieve only `positive` records, with `neutral` opt-in for structural/reference use. A `negative` record may be returned solely as an explicitly labelled “do not do this” contrast and must never enter the model-to-copy candidate set.

**Pass 2 — weighted similarity.** Only fields with **non-null `value`** contribute. A `null` field contributes **0 to both numerator and denominator** — it does not score as a mismatch. (Scoring a null as a mismatch would rank a well-annotated record *below* an empty one, which is the exact inversion the honesty rule exists to prevent.) For `tile-vision` and `hand` fields, the contribution is **weight × `confidence`** (gate-grade reads carry `confidence: null` — invariant 6 — and count at ×1.0), so an under-confident annotation self-penalises. This multiplier is one of `confidence`'s two consumers; the other is §8.1's floor.

| Signal | Field | Class | Weight | Why |
|---|---|:--:|--:|---|
| Awareness distance | `commerce.awareness` | D | 0.10 | Sets where the hero starts (SKILL.md §1) — a `hand` judgement, so capped and confidence-multiplied |
| Sophistication distance | `commerce.sophistication` | D | 0.10 | Sets claim style; \|Δ\| ≥ 2 should rank far apart |
| Layout archetype | `layout.archetype` | B | 0.15 | The structural answer being retrieved |
| Arc coverage distance | `commerce.arc_coverage` | A | 0.15 | Free and discriminating: how much of the PASONA arc the exemplar actually runs (resolved-stage basis — §5.6) |
| Text/image density | `rhythm.text_density`, `rhythm.image_density` | A | 0.15 | **Gate-grade, `derived`, no vision needed** — cleanly separates image-band detail pages (400620: 80.6 chars/vp) from text-led app-UI landings (linear: ~1249 chars/vp) |
| Urgency device present | `commerce.urgency_device` | A | 0.05 | Free `bodytext` read: does the exemplar run a deadline device at all |
| Urgency repetition distance | `commerce.urgency_repetition` | A | 0.05 | Free `derived` count: intensity of the scarcity drumbeat |
| Signature family | `signature.family` | B | 0.15 | Match the *kind* of memorable move |
| Colour commitment | `palette.roles.field_committed` | B | 0.10 | Retrieve pages that actually commit a field |

**The real class distribution of these weights: A = 0.40, B = 0.40, D = 0.20** (they sum to 1.00). Pass 2 is weighted toward *machine-extractable evidence* (A + B = 0.80), **not** toward the A block alone; hand judgements are capped at 0.20 and confidence-multiplied. (§8.1's "`hand` → never a score" rule binds the **gate** — failing a build — not the librarian: ranking on a hand field is not failing anything, and the cap + multiplier keep hand fields from dominating retrieval.)

**Pass 3 — evidence-quality tiebreak.** Rank by, in order: `capture.coverage_ok == true` → `capture.color_fidelity == "lossless"` → count of non-null gate-grade fields (`capture-json` / `bodytext` / `derived`). **A record never outranks another by having more `hand` fields.**

**Returned to Stage 4** per exemplar: `id`, `signature.*`, `palette.roles.*`, `layout.archetype`, `commerce.arc`, and — mandatory — **the gap list of every field the match relied on**, so the gate knows which retrieved claims are unverified.

Fields not read by Pass 1–3, the tiebreak, this returned payload, or §8.2 have **no consumer today** — they are forward-compat, held to the same explicit discipline as `type.*` (§5.2 discloses that pattern): kept because a record is written once and read many times, never described as if something reads them now.

**Two retrieval rules that fall out of the ground truth:**

1. **Never retrieve a Wadiz record as a colour model.** Its `capture.color_fidelity` is `"degraded"` (GAP-04) and its `palette.ramp[].oklch` is `null` (GAP-02). Wadiz records teach **conversion grammar** (`commerce.*`, `layout.archetype`, `signature.*`). For palette, prefer `color_fidelity == "lossless"` records — and even those only advisorily.
2. **Cross-check `signature.tell_risk` before returning.** If a retrieved exemplar's signature carries a tell id, the librarian must pass that forward, not silently recommend the move.

---

## 8 · Forward-compat: how the conformance gate reads this (Stage 4)

The gate asks one question: **does the built page EMPLOY the technique the retrieved exemplar teaches?** — a **presence** check, which is exactly the half `anti-ai-eval.js` does not do today (it detects the *absence* of banned defaults; SKILL.md §"Positive vocabulary" names this as the reason a rule-passing page still looks AI).

### 8.1 The provenance ladder — what the gate may do with a field

| Field provenance | Gate may |
|---|---|
| `capture-json`, `bodytext`, `derived` | **Fail** the build (mechanical, deterministic) |
| `tile-vision` | **Warn** only — advisory, must name the exemplar + `confidence`, **and only when `confidence >= 0.6`**: below that floor the dimension reports `unverified` instead of warning (an under-confident annotation must not generate advisory noise). This floor is `confidence`'s second consumer; §7 Pass 2's weight × confidence multiplier is the first |
| `hand` | **Prompt** only — surfaces as a question in the crit, never a score |
| `null` (blocking gap) | **Nothing.** The dimension reports `unverified` and is excluded from the score denominator |

**The last row is the whole point.** A gate that fails a page against a `null` field is inventing a standard. `unverified` must be *visible in the report* (never silently coerced to a pass) — the same discipline SKILL.md §5 already applies to `STATIC=1` runs and `reducedMotionHonored=null`.

**Caveat gaps do not demote a field** (§3.1 invariant 2): a class-A field with a caveat gap stays gate-grade — the gate just reports the caveat alongside the result. `capture.coverage_ok: true` + GAP-05 still blocks a bad capture; the report simply notes that the coverage was derived from the script's `tileHeight` literal rather than recorded at capture time.

### 8.2 The three checks the gate can actually run today

1. **Signature presence** — the retrieved exemplar has `signature.family` (e.g. `color-material`). Does the output declare and build a named signature at all? Reads: `signature.family`, `signature.description`. Severity: **warn** (`tile-vision`).
2. **Colour commitment** — exemplar has `palette.roles.field_committed == true`. Does the output flood a saturated field owning a band? The **output** side is measurable from its own `@theme` source (`c >= 0.12`, per `color-forward-palettes.md`); the **exemplar** side is `tile-vision`. So the gate checks *"the retrieved exemplar commits a field; does yours?"* — **never** *"is your chroma within X of the exemplar's?"* (that comparison is impossible; GAP-02). Severity: **warn**.
3. **Arc coverage** — exemplar 400620's `commerce.arc` marks **5 of 5 resolved** PASONA stages present (`arc_coverage: 1.0`, `arc_resolved: 5`; `narrow` is unresolved and per the null rule joins neither side). Does the output's section arc cover the same stages? This is the **only** check with a **fail**-grade path, because both sides are text. Severity: **block** when the output's arc misses **≥ 2 of the stages the exemplar marks `present`** — a stage-count threshold over the exemplar's resolved-present set, so the trip point cannot drift with the denominator. (An earlier draft stated the threshold as a ratio, "coverage lower by > 0.34", calibrated against an `arc_coverage` of `0.83` = 5/6 — a figure the null rule itself forbids; that understated the exemplar by 1/6 and silently moved the trip point from <0.66 to <0.49, fail-open.)

Checks 1 and 2 are warn-only **by construction**, not by timidity: their exemplar side is `tile-vision`, and §8.1 forbids failing a build on an advisory read.

### 8.3 Tell cross-reference (the guard against teaching a tell)

`signature.tell_risk[]` uses the **exact** ids `anti-ai-eval.js` emits, so a future positive dimension in that file can join on them with no mapping table. The 18 ids it currently emits:

```
browser-mockup · emoji-feature-icon · en-label-overration · ghost-numeral · glassmorphism-stack ·
gradient-numeral · justified-display · letter-code-badge · letter-square-avatar · marker-sequence-broken ·
mono-label · multiscript-numbering · outline-chip · palette-monotony · repeated-decorative-label ·
structural-monotony · uniform-frame-loop · uppercase-heading
```

**Rule:** if a retrieved exemplar's `signature.tell_risk` is non-empty, the gate must **not** reward employing that move — the negative grader would penalise it in the same run. Retrieval and grading must not disagree about the same pixels.

400620 is the live case. Its `tell_risk` is `[]`, but its recorded note flags that **black + acid-lime is adjacent to `anti-ai-tells.md` tell #2** ("acid/kelly-green flood + near-black display"). The exemplar is a legitimate teacher of *conversion grammar* and a **banned** model of *palette*. A schema without `tell_risk` + `notes` would let the corpus quietly recommend the skill's own #2 banned default back to the builder — with a real Wadiz page as its authority.

### 8.4 Units the gate speaks

Where numeric colour ever lands in a record, it is stored in `anti-ai-eval.js`'s units so no conversion layer is needed: `c` on 0–1 (chromatic `>= 0.02`; accent `>= 0.12`), `h` 0–360° (hue buckets 24 general / 18 accent; warm band `[20,105]`), `l` 0–1. Densities are per **1600px viewport** (the capture tile height), matching `capture.json#/coveredHeight`.

---

## 9 · Gap list

Every gap a field in §4–§5 points at. **This list is the schema's primary output** — it is what tells the pipeline what to build next, and it is why the record above is honest rather than plausible.

| ID | Gap | Blocks | Class | Sev | **What specifically closes it** |
|---|---|---|:--:|:--:|---|
| **GAP-01** | **No capture has a DOM, and none can.** `index.html` is a generated `view-capture.js` viewer (its `<style>` is the viewer's own `body{background:#222}` + 74 `<img>` tags), NOT a DOM dump. Verified at source: neither capture script's `page.evaluate()` contains `getComputedStyle`, `document.fonts`, `styleSheets`, `cssRules`, or `getPropertyValue`. The roadmap's "Wadiz has full DOM → CSS/font extraction" premise is **false**, and re-running the pipeline as written would not fix it. | `type.display/body/mono.family`, `type.*.weights`, `type.scale_px`, `rhythm.spacing_scale_px`, `rhythm.radius_scale_px`, `motion.durations_ms/easings/reduced_motion_honored`, source-grade `palette.ramp[].oklch` | **C** | **high** | Add to `page.evaluate()` in `capture-reference-patchright.js` + `capture-reference.js`: (1) `[...document.fonts]` → `{family, weight, style}`; (2) `getComputedStyle(el)` over a sampled node set (`h1,h2,h3,p,button,section`) → `fontFamily, fontWeight, fontSize, lineHeight, letterSpacing, margin, padding, gap, borderRadius, transitionDuration, transitionTimingFunction`; (3) enumerate `--*` custom props off `document.documentElement`. Persist as `styles.json`. **Then re-capture all 6 exemplars — Akamai-walled for the 2 Wadiz records; may fail.** |
| **GAP-02** | **Numeric OKLCH chroma is not recoverable from an exemplar, ever.** `color-forward-palettes.md` rules the ≥0.12 floor a PLAN/`@theme`-**source** target, explicitly *not* screenshot-derivable. A third-party exemplar has no source tokens and never will — a decoded pixel is a *rendered composite* (opacity, overlays, image content), a categorically different number from a `@theme` value. | `palette.ramp[].oklch`, `palette.chroma_max_measured`, any exemplar-vs-plan chroma comparison | **A⁺** (measurable) / **permanent** (as *source*) | **high** | **Nothing.** Category distinction, not tooling. Even GAP-01+GAP-03 closed, a third-party page's `@theme` does not exist. **Mitigation is contractual:** keep `palette.roles.field_committed` (visual commitment — what the skill says the grader actually judges), and **forbid** numeric exemplar-vs-plan chroma comparison in the gate (§8.2, check 2). |
| **GAP-03** | **No image decoder in the pipeline.** `package.json` deps = `patchright` only; no `sharp`/`jimp`/`canvas`/`pngjs`, no `node_modules` present. Every `tile-px` field is unimplementable, not merely unwritten. **The signal is on disk — only the tooling is missing.** | all `tile-px` fields (`palette.ramp`, `palette.ramp[].oklch`, `palette.chroma_max_measured`); keeps `palette.ramp[].hex_approx` an eyeball read and `layout.content_width_px` inferred | **A⁺** | **medium** | Add **one** decode dep (`sharp` or `pngjs`+`jpeg-js`) + a k-means/median-cut quantiser + an sRGB→OKLCH convert. **No re-capture needed.** Trade-off to weigh: SKILL.md §"Setup tiers" promises the lint/token tier is **zero-install** — put the decoder behind the existing `/design-setup` tier so that promise holds. |
| **GAP-04** | **Wadiz tile fidelity is degraded.** 720×900 baseline JPEG (3-component → chroma-subsampled), downscaled 0.5625 from the 1280×1600 capture viewport. app-ui is 1280×1600 lossless PNG. **The real asymmetry favours app-ui — the inverse of the roadmap's claim.** Even with GAP-03 closed, Wadiz chroma reads **low-biased**. | all Wadiz `palette.*` numerics; drives retrieval rule §7.1 | **A⁺** | **medium** | **Cheaper than it looks: no script change.** Both capture scripts already `page.screenshot({path: …png})` at 1280×1600 — the committed `.jpg` are **post-hoc downscales**, not pipeline output. Just re-run `MAX_TILES=120 node scripts/capture-reference-patchright.js <url>` and keep the PNGs. Only cost = re-crossing Akamai (`captures/README.md`: cooldown + retry). |
| **GAP-05** | **Wadiz captures record no tiling metadata.** No `capture.json` → no `tiles`/`coveredHeight`/`maxTiles`. So the skill's own validity rule (`coveredHeight >= pageHeight`, SKILL.md §5) is **derived, not captured**, for both flagship exemplars. | `capture.covered_height_px`, `capture.coverage_ok` | **A** | **low** | **Weakest gap in the list — arguably already closed.** `const tileHeight = 1600` is a **hard-coded literal** in `capture-reference-patchright.js`, so `74 × 1600 = 118,400 ≥ 117,039 ✓` is reading the source, not guessing a convention. To make it captured rather than derived: the Wadiz path already writes `capture.json` today (line 165) — the 2 committed Wadiz dirs simply predate it. A re-capture (GAP-04) emits it for free. |
| **GAP-06** | **Schwartz awareness/sophistication and PASONA stage labels are judgements, not extractions.** Nothing in any capture encodes them; no algorithm decides them. `corpus-validate.js` can check enum-membership + `evidence` presence; it can **never** check correctness. | `commerce.awareness`, `commerce.sophistication`, `commerce.arc[].stage` | **D** (`awareness`/`sophistication`) · **B** (`arc[].stage`) | **medium** | **Nothing, inherently** — interpretation is interpretation. Mitigation: `hand`/`tile-vision` + **mandatory** `evidence` + `confidence`; two-annotator agreement if the corpus grows past ~20 records. Note `arc[].stage` is the **cheapest B in the schema** — it reads `bodytext.txt`, not pixels, so a local/small model may suffice. |
| **GAP-07** | **Platform chrome is not separated from campaign-authored design.** Every Wadiz tile mixes Wadiz's own UI (nav, teal 재오픈 요청하기 CTA, right reward rail) with 블로리즘's authored bands. Nothing marks the boundary. **Naive quantisation would attribute Wadiz's teal to the campaign's palette.** This gap does not blank a field — it fills it *wrongly*, which is worse. | all Wadiz `palette.*`, `layout.column_system`, `commerce.reward_ladder` | **D** now → **A⁺** once mechanised | **high** | Two options: (a) **curated** — add `chrome_regions: [{tile, x, y, w, h}]` bbox exclusions to the record, authored once per platform (Wadiz chrome is identical across campaigns, so it is ~1 annotation for the whole family); or (b) **captured** — crop to the story-column selector at capture time. (a) is available today at class **D**; (b) needs GAP-01's script change. Enforcing either mechanically needs GAP-03. |
| **GAP-08** | **Motion is not captured.** Tiles are stills. The only proxy is the `.gif` count in `bigImages[]` (400620: 2). `anti-ai-eval.js`'s motion vocabulary (`durations[]`, `easings[]`, `jsAnimations[]`) has **no exemplar counterpart** — the gate cannot compare an output's motion to a corpus exemplar's. | `motion.durations_ms`, `motion.easings`, `motion.reduced_motion_honored` | **C** | **medium** | `shoot.js` already implements exactly this (`FILMSTRIP=1`, `MOTION=1`, `REDUCED_MOTION=1` → `run.json.motion.{durations,easings,jsAnimations,reducedMotionHonored}`). **The reference-capture path has no equivalent.** Closing it = port that motion-audit block into `capture-reference-patchright.js` + re-capture. Also archive the 2 GIFs locally (GAP-09). |
| **GAP-09** | **No section→tile offset map; `bigImages[]` is remote.** Nothing records which tile a heading/band starts at, so any per-section field needs a full vision sweep (74 tiles) and cannot be verified cheaply. `bigImages` URLs are remote CDN links, not archived → link rot, not reproducible. | `rhythm.band_count`, `palette.roles.field_sections`, `signature.recurrence`, `signature.evidence_tiles` completeness, `commerce.arc` exhaustiveness, `motion.gif_evidence` durability | **C** (offset map) · **A** (archiving) | **medium** | (a) Offset map: in `page.evaluate()`, emit `[...document.querySelectorAll('h1,h2,h3,h4')].map(el => ({text, y: el.getBoundingClientRect().top + scrollY, tile: Math.floor(y/1600)}))` → re-capture. (b) Archiving: download `bigImages[]` to `captures/<id>/assets/` — **class A, no re-capture, closeable today.** **Correction:** the `imageCount 39` vs `bigImages 26` delta is **not truncation** — the script applies two different filters (`imageCount` = `naturalWidth > 200`; `bigImages` = `naturalHeight > 350`, `slice(0,80)` never reached). Not a gap; documented in §4.1. |

### 9.1 Reading the gap list

**Which gaps actually matter.** GAP-01 (nulls the entire `type` block + every source-grade colour value), GAP-02 (permanent; shapes the gate contract in §8.2), and GAP-07 (silent corruption — fills fields *wrongly* rather than blanking them). The rest are cost, not correctness.

**Two gaps are not closeable at any budget.** GAP-02 (no source tokens exist for a third-party page) and GAP-06 (interpretation is interpretation) are properties of the problem, not of the tooling. The schema's job is to keep them visible rather than let them harden into confident-looking numbers.

**Ordered by value per unit of effort:**

| Do this | Closes | Cost | Payoff |
|---|---|---|---|
| 1. Archive `bigImages[]` locally | GAP-09(b) | class **A**, no re-capture | ends link-rot; makes records reproducible |
| 2. Re-capture Wadiz, keep the PNGs | GAP-04, GAP-05 | **no script change** — just re-run + Akamai cooldown | lossless colour + `capture.json` for free |
| 3. Add a decode dep + quantiser | GAP-03 | 1 dep, no re-capture | unlocks all of **A⁺** (real palette measurement) |
| 4. Extend `evaluate()` with fonts/computed/CSS-vars | GAP-01, GAP-08, GAP-09(a) | script change **+ Akamai-walled re-capture** | the whole `type` block, spacing, motion, offset map |
| 5. Author `chrome_regions` once per platform | GAP-07 | class **D**, ~1 annotation for all Wadiz | stops teal-chrome poisoning campaign palettes |

Items 1–3 are cheap and unblock most of the numeric layer. **Item 4 is the expensive one and it is the only path to `type.*`** — worth doing once, on a re-capture that is already being run for item 2.

**The honest state of the corpus.** It is far stronger on **conversion** than on **design tokens**:

- **Well-sourced (class A):** `commerce.urgency_*`, `commerce.authority_numbers`, `rhythm.text_density`/`image_density`, all of `capture.*`, `motion.gif_asset_count`.
- **Reachable via a vision read — free today (class B, §3):** `layout.archetype`, all of `signature.*`, `palette.roles.*`, `commerce.arc`.
- **Empty (class C):** the entire `type` block, spacing/radius scales, motion timing.

**So a librarian built today should retrieve on conversion grammar and structure, and treat colour as inspiration and type as absent — not as specification.** That is what is actually on disk. It is the opposite of what a schema written from the roadmap's G1.4 premise ("palette via CSS-var parse, type-pairing via computed font-family") would have assumed, and building Stage 3 on that premise would have produced a librarian querying fields that are `null` in every record.

**The class-B decision this file originally staged for the owner is resolved — and it is free.** Class **B** is 27% of this schema — including *all* of `signature.*`, the single most valuable thing a design corpus holds. The vision module it needs is already shipped (`scripts/lib-openai-responses.js`: `input_image` at L231/L325, a vision judge at L306), and design-core SKILL.md §1 routes it through the **free ChatGPT/codex OAuth** (`~/.codex/auth.json`, present and current on this machine) before any paid key. So the corpus **can** teach signature moves and colour roles today, at no marginal cost. The one open question is empirical, not budgetary: the free path's **rate limits at ≥120-record scale are unmeasured** — if throttling appears, the fallback is a paid key, and that (and only that) would be a spend decision.
