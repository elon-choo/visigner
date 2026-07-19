# Build-recipe schema — v2 G2.1

This is the contract for a `*.recipe.md` build recipe and for
`scripts/recipe-validate.js`. It is a sibling of `../SCHEMA.md`: record schema
describes a captured exemplar; this schema describes the executable plan made
from that exemplar. It is grounded in the proven
[`linear.recipe.md`](linear.recipe.md) structure and deliberately adds no
metadata block that the proven recipe does not have.

## 1. Source and provenance contract

A recipe is Markdown with the six ordered `##` blocks in §2–§7. A field is
written in prose, a list, a table, or a diagram as appropriate to the block;
the field registry below, rather than a new serialization format, is the
schema. A recipe must retain the source marker next to the first claim it
introduces. A later Build Order or Anti-Slop instruction may reuse a cited
field without repeating its marker.

| Layer | Source | Recipe marker | Production rule |
|---|---|---|---|
| **(a)** | `bodytext.txt` | `[body]` | Deterministic extraction. Copy is verbatim; do not paraphrase it into a new claim. |
| **(b)** | `styles.json` | `[styles]` | Deterministic extraction. Values are exact computed tokens; preserve their units and precision. |
| **(c)** | `tile_NN.{png,jpg}` | `[tile]` or `[tile_NN]` | A vision pass infers render decomposition, signature names, and layout logic. It is not mechanically extractable. |

### The never-fabricate rule

> A layer-(c) field without tile evidence is an explicit empty slot, never a
> plausible guess.

Write an unavailable vision field as, for example,
`**Layout concept:** _EMPTY — no tile evidence_`. Do not attach a `[tile]`
marker to that empty slot: a marker says that a real tile supports the claim.
The later derivation tool must preserve the empty slot until a vision pass can
fill it. This is the recipe equivalent of `SCHEMA.md`'s provenance-envelope
discipline.

`[tile]` is shorthand for one or more tile files when a particular tile number
is not useful; `[tile_00]` is preferred when the evidence is localisable. The
validator recognises both forms. `[styles]` and `[body]` are block-level
bindings in the Linear pilot, so the validator permits one marker to bind the
required fields in those blocks.

## 2. Block 1 — TOKEN BLOCK

Heading: `## 1 · TOKEN BLOCK` (trailing explanatory text is allowed).

| Required field | Type | Layer | Citation rule |
|---|---|:--:|---|
| `tokens.color_system` | role-labelled colour values and usage notes | b | `[styles]` |
| `tokens.typography_system` | family, weight, size, leading, tracking roles | b | `[styles]` |
| `tokens.spacing_scale` | ordered length scale plus layout constants | b | `[styles]` |
| `tokens.radius_scale` | ordered radius values and usage roles | b | `[styles]` |
| `tokens.elevation_system` | border/shadow values and elevation rule | b | `[styles]` |
| `tokens.motion_tokens` | duration, easing, property, and reduced-motion rules | b | `[styles]` |

Use literal values. A derived arithmetic value may appear beside its cited
input, but it must be visibly described as derived; it is not a new token.

## 3. Block 2 — LAYOUT CONCEPT + STRUCTURE

Heading: `## 2 · LAYOUT CONCEPT + STRUCTURE`.

| Required field | Type | Layer | Citation rule |
|---|---|:--:|---|
| `layout.concept` | one-sentence layout thesis | c | `[tile]` |
| `layout.section_arc` | ordered list of bands/sections | c | `[tile]` |
| `layout.grid` | columns, width/inset, and full-bleed/container rule | c | `[tile]` |
| `layout.alignment_and_splits` | alignment, asymmetry, and split-column logic | c | `[tile]` |
| `layout.render_decomposition` | labelled wireframe, ASCII diagram, or equivalent region-by-region breakdown | c | `[tile]` |

Exact token values embedded in this block are references to Block 1 and do
not change these layout fields' layer: the composition itself is the
vision-derived claim.

## 4. Block 3 — THE SIGNATURE

Heading: `## 3 · THE SIGNATURE` (a trailing explanatory subtitle is allowed).

| Required field | Type | Layer | Citation rule |
|---|---|:--:|---|
| `signature.moves[].name` | concise named technique | c | `[tile]`; `[styles]` may support a token-led move |
| `signature.moves[].visual_decomposition` | prose describing the visible arrangement or repeated language | c | `[tile]` |
| `signature.moves[].execution_constraint` | imperative reproduction constraint | c | `[tile]` |
| `signature.moves[].supporting_token_values` | exact values that make a move faithful | b | `[styles]` |

The field is an ordered list of one or more named moves. In the pilot, each
numbered move carries its own `[tile]` or `[styles]` marker; the validator
requires that same per-move binding. A token-led move may be evidenced by
`[styles]` alone, but a visual decomposition must not be fabricated when no
tile supports it.

## 5. Block 4 — THE CONTENT

Heading: `## 4 · THE CONTENT`.

| Required field | Type | Layer | Citation rule |
|---|---|:--:|---|
| `content.navigation` | ordered navigation labels and CTA label | a | `[body]` |
| `content.hero` | H1, supporting copy, and hero ancillary copy | a | `[body]` |
| `content.primary_product_render` | labels and representative in-product copy | a | `[body]` |
| `content.supporting_brands` | logo/wordmark labels where present | a | `[body]` |
| `content.statement` | emphasis-labelled statement copy | a | `[body]` |
| `content.features` | repeated feature label, title, and description copy | a | `[body]` |
| `content.chapter` | chapter label, headline, body, and representative render copy | a | `[body]` |

Copy can be grouped into bullets as in the pilot. Preserve wording, labels,
capitalisation, numbers, and punctuation from `bodytext.txt`; an explicit
practical-shortening note is allowed only when it describes omitted repetition
rather than inventing replacement copy.

## 6. Block 5 — BUILD ORDER

Heading: `## 5 · BUILD ORDER`.

| Required field | Type | Layer | Citation rule |
|---|---|:--:|---|
| `build.component_sequence` | ordered implementation steps, minimum one | c | inherits the cited layout/signature evidence |
| `build.literal_token_application` | instruction to register/reuse literal Block-1 values | b | inherits Block-1 `[styles]` |
| `build.responsive_a11y_steps` | concrete responsive and accessibility floor | c | inherits layout evidence; cite a new visual claim if introduced |

Build Order is a synthesis layer: it sequences already-cited observations.
It must not introduce a new visual fact without adding that fact's source
marker at the point of introduction.

## 7. Block 6 — ANTI-SLOP GUARDRAILS

Heading: `## 6 · ANTI-SLOP GUARDRAILS`.

| Required field | Type | Layer | Citation rule |
|---|---|:--:|---|
| `anti_slop.forbidden_substitutions` | bulleted substitutions that would break the visible design | c | inherits signature/layout evidence |
| `anti_slop.token_integrity_constraints` | exact-value/no-rounding or equivalent token-fidelity rule | b | inherits Block-1 `[styles]` |
| `anti_slop.motion_restraint` | prohibited excess motion plus reduced-motion protection | c | inherits signature/layout evidence |

Guardrails translate the source-backed identity into failure modes. They may
quote literal tokens from Block 1 but may not use a generic style preference as
evidence for a reference-specific rule.

## 8. Validator surface

`recipe-validate.js` validates only Markdown structure and provenance syntax;
it cannot decide whether a tile actually proves a visual claim. It requires:

1. the six required blocks, in order;
2. the required field labels/structures represented by the Linear pilot;
3. `[styles]` in the Token block, `[tile]`/`[tile_NN]` in the Layout block,
   `[body]` in the Content block, and a `[tile]` or `[styles]` marker on every
   numbered Signature move; and
4. an ordered Build Order and bulleted Anti-Slop constraints, including the
   token-integrity and motion-restraint fields.

This deliberately does not require repeated markers in Blocks 5–6: the proven
recipe has none there, and forcing them would reject a valid source-binding
strategy rather than catch fabrication.

## 9. Field distribution

The following counts are field-definition counts, not counts of prose
occurrences. An array-item field such as `signature.moves[].name` counts once.

| Layer | Fields | Share | Meaning for derivation |
|---|---:|---:|---|
| a | 7 | 25.0% | verbatim copy that Stage 2 can fill mechanically |
| b | 9 | 32.1% | exact computed-token material that Stage 2 can fill mechanically |
| c | 12 | 42.9% | vision-dependent layout, signature, sequence, and guardrail material |
| **Total** | **28** | **100%** | **16/28 (57.1%) auto-extractable; 12/28 (42.9%) vision-dependent** |

