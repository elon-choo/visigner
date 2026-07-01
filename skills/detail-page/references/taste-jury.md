# Taste jury — the contemporary-aesthetics panel (runs ALONGSIDE the anti-slop rubric)

`review-rubric.md` answers **"could a skeptic tell this is AI, and does it convert?"** It is necessary but it has a blind spot: a page can pass every anti-slop check and still be **timid, colorless, and forgettable** — safe warm-monochrome, alternating dark/cream bands, competent-but-boring. The anti-slop gate *rewards* that page. A person with contemporary taste calls it ugly.

This panel closes that gap. It grades a **second, orthogonal axis: aesthetic ambition.** Not "is it not-slop" but **"would a designer with taste stop, save it, and want the product?"** A page ships only when it clears BOTH gates (see **Co-gate** below).

> Run this AFTER `scripts/shoot.js`. Grade the **tiles**, not the code. The evaluator must not be the builder (generator/evaluator split, same as the anti-slop rubric).

## The panel (six contemporary-taste voices — each grades from its own lens, then you aggregate)

Each juror is a *lens*, not a separate score sheet — read the tiles through all six, then fill the 7-axis rubric below. Where jurors conflict, name the conflict (that tension is signal for the system).

1. **Editorial Art Director** (Kinfolk / Cereal / It's Nice That / Bloomberg Businessweek school). Optimizes: typographic sophistication, editorial rhythm, whitespace-as-luxury, restraint that still commits. Tell they hate: type that's all one weight and size; decoration with no structural meaning; grids that never break.
2. **Awwwards / FWA juror**. Optimizes: design ambition, a memorable signature, "would this win Site of the Day." Tell they hate: template heroes, safe symmetry, zero risk, nothing you'd screenshot.
3. **DTC brand / fashion-beauty designer** (Aesop / Glossier / Jacquemus / Order-of-magnitude premium e-comm). Optimizes: mood, desirability, color-and-texture confidence, "does this make me want it." Tell they hate: a product page with no emotional temperature; stock-photo energy; palette that hedges.
4. **Gen-Z trend curator** (Pinterest saves, editorial TikTok, current visual language: bento, chunky/condensed display, kinetic type, tactile grain, considered maximalism, expressive color). Optimizes: trend-currency, shareability, "does this feel *now*." Tell they hate: 2018 startup-template energy, thin-Inter minimalism, corporate gradient.
5. **Colorist / color director**. Optimizes: palette commitment and emotional work — does color *do* something, or is it a neutral hedge with one timid accent. Tell they hate: all-neutral + single desaturated accent; brown-on-brown; "no color" (the exact complaint that spawned this panel).
6. **Type designer / typographer**. Optimizes: pairing intelligence, weight/scale contrast (100/200 vs 800/900, ≥3× jumps), hierarchy craft, and — for Korean — genuine KR-display + Latin harmony (not Pretendard-for-everything). Tell they hate: one webfont doing all jobs; display face used at body size; KR and Latin that clash in weight/rhythm.

## The 7-axis aesthetic-ambition rubric (score each 1–10 from the pixels)

| Axis | 3/10 (kill) | 6/10 (competent-but-safe — the trap) | 9/10 (would be featured) |
|---|---|---|---|
| **Color confidence** | One hue + tints; reads monochrome/"no color" | Neutral base + one desaturated accent, hedged | A committed palette that does emotional work — real chroma, an unexpected-but-right pairing, color used structurally not just on the CTA |
| **Typographic sophistication** | One font, one weight, flat scale | Distinct display+body, but tame contrast | Extreme weight/scale contrast, a display face with real character, KR+Latin in deliberate harmony, type *is* the design |
| **Trend-currency** | Reads 2016–2019 template (thin Inter, centered hero, soft-shadow cards) | Neutral/timeless but a bit dated | Feels 2025–2026: considered maximalism, bento/editorial grid, tactile texture, expressive type — current without being a fad cliché |
| **Aesthetic ambition / memorability** | Nothing you'd screenshot | One nice touch, otherwise expected | A bold committed signature you'd save; the page takes a real visual risk and lands it |
| **Compositional craft** | Everything stacked/centered, even rhythm | Some asymmetry, mostly a safe column | Real layout tension — asymmetry with purpose, overlap, scale jumps, a broken grid that's intentional; whitespace as composition |
| **Mood & desirability** | No emotional temperature; spec sheet | Pleasant, forgettable | Makes you *want* the product — sensory, atmospheric, a clear emotional register that matches the subject |
| **Finish & detail** | Flat fills, default radii, no texture | Clean but plasticky | Considered micro-detail — texture/grain/gradient-with-intent, edge treatment, optical alignment, the "expensive" feel |

**Weighting:** `Color confidence` and `Aesthetic ambition` are the highest-leverage axes (they are exactly what the anti-slop gate misses). Never let a page pass the taste gate with either below 7.

## Calibration — pin "9" to real taste, not an averaged idea of "nice"

Before scoring, anchor "excellent" to the contemporary (2025–2026) high-taste canon so you don't grade against a bland prior. These references are cross-sourced from Awwwards, Typewolf's live Site-of-the-Day data, the 29CM/Baemin design-system teardowns, and the Sandoll foundry — not a model's averaged idea of "nice":
- **Editorial/luxury e-comm:** Aesop, Cereal magazine, Kinfolk, Off-White/Jacquemus lookbooks, Studio Feixen, Bloomberg Businessweek feature spreads, Godly.website's curated "sites that feel like fashion magazines, not corporate pages."
- **Award-tier interactive:** Awwwards Sites of the Day + the FWA. The current award-tier color principle is explicit — **"impact, not harmony"**: strikingly risky pairings, non-adjacent solid blocks, one decisive bold gesture. Grade toward that, not toward safe complementary harmony.
- **Current Korean commercial (Korea has its OWN high-taste bar — a KR page graded only against western refs misses it):**
  - **29CM** is the KR reference for editorial restraint done *right*: near-mono #fff/#000, no shadow system, 0px radius, ONE reserved accent used only where it must be, photo-first hierarchy (image → EN category label at display size → KR name → price last), whitespace treated as the most expensive material. It proves monochrome *can* be premium — but only because it earns it through editorial layout and photography, not by swapping white for cream.
  - **오이뮤/OIMU** (heritage-meets-present, retro-hardware), **프릳츠/Fritz** (illustrative retro-Korean brand world), **W Concept** (designer-fashion editorial), **배달의민족/Baemin** (signboard-heritage type + wit), **토스/Toss** (systematized restraint).
  - **KR display faces that signal taste** (brand voice in hero/promo; keep UI/body on Pretendard): **Jalnan/잘난체**, **을지로체 / 한나체** (Baemin signboard-heritage), **Gmarket Sans**, **여기어때 잘난체**, plus editorial serifs (Song Myung, Gowun Batang) and Gothic display (Black Han Sans) used with real weight/scale drama.
  - The tell that separates premium KR from a generic 스마트스토어 template: editorial EN category labels at display size over KR body, oversized/full-bleed photography carrying the page, one confident reserved accent (not a swatch palette), and the *removal* of urgency theatre (no red timers, no rainbow discount badges, no drop-shadow product-card grids).

A tile earns **9** only if it would hold up *placed beside* those — same density of intent, same color courage, same "made by someone with a point of view." If it looks like a safe template next to them, it is a **6 at best** — name the specific timid choice.

**Beige is a palette, not a point of view.** The single most important calibration for this panel: restraint reads as *taste* only when it is a decision, not a default. "Sad beige" / cream-monochrome with competent type but no decisive accent, no texture, and no editorial tension is now explicitly read as flat and soulless — it is the same generic template wearing a warmer coat. Do not reward a warm-neutral page for "sophistication" unless it earns it the way 29CM does (editorial layout + one committed move). Absence of color is not restraint; it is usually fear.

## Dated tells (score DOWN) — the opposite of a banned-defaults list

These aren't "AI tells" — they're **taste tells**, the marks of a page that's competent but 5+ years behind (cross-sourced, 2025–2026 vantage):
- Warm-monochrome hedge (brown/beige/cream only, or any single-hue page) presented as "sophisticated restraint" — "sad beige" now reads flat/soulless.
- Thin-weight Inter/Helvetica-Light neutral-sans minimalism as the whole identity — this is now the *AI-slop baseline*, not clean design.
- Soft-shadow rounded cards in an even grid; uniform radius everywhere. Centered hero + 3 soft-shadow cards + alternating full-width bands = the homogenized Figma-template look.
- Alternating dark-band / light-band scroll with no compositional variation between bands.
- One desaturated accent color doing all the "color," only on buttons; pure-harmony palettes that avoid all tension ("brand blue" + grey).
- Corporate Memphis / Alegria flat pastel illustrations; multicolor retro / duotone "Instagram" gradients (2018–2021).
- Generic bento grid used as the *only* idea (mainstream now, competent not ambitious).
- 스마트스토어 urgency theatre: red countdown timers, rainbow discount badges, drop-shadow product cards, randomly mixed fonts.
- Gradient-on-white corporate hero; big-number + stat trio. Decoration with no structural meaning (hairlines/dots/eyebrows as garnish).
- Type that never leaves the 400–700 weight band; no size drama.

## Current moves (score UP) — evidence of a contemporary point of view

- Expressive saturated color or an unexpected non-harmonious pairing; **one decisive bold gesture** ("impact, not harmony").
- Jewel tones / acid brights for luxury or energy — OR rich "colorful quiet luxury" (warmth *with* real depth + one confident accent, not the absence of color).
- Serif revival, mid-century/condensed grotesque, or a heritage KR display face as an *authored* voice (the post-AI warmth backlash).
- Kinetic / variable type — weight-shift on scroll, hover/load reaction; oversized display type as the primary visual anchor, not a label.
- Editorial / broken grid, asymmetry, deliberate overlap over centered symmetry.
- Tactile texture — grain, paper, ink-bleed, film-noise over an otherwise clean layout (analog imperfection = human warmth).
- Editorial/curatorial commerce (the 29CM / OIMU / Baemin model): photo-first hierarchy, one reserved accent, whitespace as an asset, no urgency theatre.
- A single committed signature the page is remembered by — a real visual risk that lands.

## Co-gate — how this composes with `review-rubric.md`

The two gates are **AND**, not a blend:

- **Anti-slop gate** (`review-rubric.md`): `overall ≥ 8`, no dim < 7, Aesthetic distinctiveness ≥ 8, zero §A fails.
- **Taste gate** (this file): `taste overall ≥ 7.5`, with `Color confidence ≥ 7` AND `Aesthetic ambition ≥ 7`.
- **Ship only if BOTH pass.** The handdrip baseline that triggered this panel passes anti-slop and fails taste (Color confidence ≈ 3, Trend-currency ≈ 4) — that is the intended behavior: the system should stop calling safe-boring "shippable."

**Resolving the apparent conflict with banned-defaults.** The anti-slop list bans *lazy/default* boldness (AI-purple-because-nothing-else, cream+serif+terracotta cliché). This panel demands *committed, grounded* boldness. They are not in tension: the answer to both is **color and type chosen deliberately from the subject's own world, then pushed further than felt safe.** "Grounded but timid" fails taste; "bold but ungrounded/default" fails anti-slop; the ship zone is **grounded AND bold.**

## Legibility precondition (grade the SAME pixels the anti-slop panel does)

Before scoring intent, check that each scored section actually **renders legibly in the captured tiles.** If a section is faded, ghosted, or near-illegible in the pixels (e.g. a scroll-reveal whose opacity never settled), you are looking at a mechanical render bug, not a design — **cap Finish & Compositional-craft at 4 and set `would_feature=false` until it is re-shot.** Never feature-flag a page on design *intent* while ~sections render as ghost text; that is a false-positive that lets a broken capture pass. Both panels must read the same pixels.

## Output (what the taste evaluator returns)

For each page: the 7 axis scores with the specific tile-anchored tell for each, a `taste_overall`, the single most timid choice holding it back + the concrete fix, a `dated_tells[]` list of any you saw, a `would_feature` boolean (would you actually put this in front of the Awwwards/editorial panel), and `taste_gate_pass` (≥7.5 overall AND color-confidence ≥7 AND ambition ≥7). If you can't point to a tile for a score, lower it and say so.
