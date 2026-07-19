# Corpus tagging taxonomy — the controlled vocabulary

The closed-set **values** a corpus exemplar is tagged with. `SCHEMA.md` (sibling) owns the **fields**; this file owns what may go *in* them. A field typed `<TAXONOMY.category>` there resolves to §1 here.

**Scope line:** this taxonomy defines *value sets*, not *arity*. Whether a field takes one value or three is `SCHEMA.md`'s call. Where a dimension is inherently multi-valued (`mood`) it is marked so.

**What this is for:** Stage 2 tags ≥120 exemplars. A tagger who cannot decide a value in ~5 seconds produces noise, and noise at 120 records is worse than a smaller vocabulary. Every value below therefore carries a **recognition test** — a thing you can point at in a tile — not a definition.

---

## 0 · Tagging rules

1. **Closed set, no free text.** Every value below is enumerated. If nothing fits, tag the dimension `unresolved` and say why in the record's `notes`. Never invent a value in a record. (`unresolved` is legal in every single-select dimension and is not listed again per-dimension. In `mood` — the one multi-select — `unresolved` is also legal, but only as the **sole** entry, never alongside real moods; a mood cell is never left blank.)
2. **Ordered decision list.** Dimensions marked **[ordered]** are read top-down: the **first** value whose test passes is the tag. This is what makes overlapping values mutually exclusive without pretending real pages are tidy. (`signature-move` is **not** [ordered] — a single ordered list of 100+ values is untaggable in 5 seconds; its exclusivity procedure is **§6.0**.)
3. **Tag the authored region, not the platform chrome.** Wadiz/Naver/Coupang wrap a maker's page in platform UI (reward rail, funding header, nav). That chrome is not the exemplar's design. Tag the region the maker authored. (`SCHEMA.md` GAP-07 records the same rule from the field side.) **Corollary:** `bodytext.txt` on a Wadiz capture is **chrome-contaminated** — it concatenates platform boilerplate, platform FAQ/policy lines, the authored story column, and (below the `스토리 접기` fold) a cross-campaign recommendation rail of *other makers' projects*. Whole-file token counts are therefore inadmissible as arc-beat evidence: a beat must be **pixel-read from a tile**, or quoted with its position inside the authored story region.
4. **Arity is the schema's.** See the scope line above.
5. **`unresolved` beats a guess.** If the tiles on disk cannot settle a dimension, the honest tag is `unresolved` + a note. A confidently wrong tag is unrecoverable at retrieval time; a blank is not.

## 0.1 · Dimension index

| Machine key | Values | Select | Section |
|---|---|---|---|
| `category` | 14 | single **[ordered]** | §1 |
| `layout-archetype` | 16 | single **[ordered]** | §2 |
| `mood` | 33 | **multi** (2–3) | §3 |
| `palette-family` | 20 | single **[ordered]** | §4 |
| `type-personality` | 25 | single | §5 |
| `signature-move` | 109 (6 shelves) | single primary (**§6.0** procedure) | §6 |
| `platform-width` | 5 | single | §7.1 |
| `pasona-arc` | 8 | single **[ordered]** | §7.2 |
| `pasona-stage` | 6 | single (per arc entry) | §7.3 |
| `awareness` | 5 | single | §7.4 |
| `sophistication` | 3 | single | §7.5 |

---

## 1 · `category` — what artifact this is **[ordered]**

**One axis: artifact type.** Not sector, not medium, not quality.

> **Changes from the brief's seed list, and why.** The seed mixed three axes, which is the overlap failure this dimension must avoid.
> - **`fintech` dropped.** It is a *sector*, not an artifact. Stripe is fintech **and** a SaaS marketing site — it would take two values in a single-select dimension. Sector is a real thing to record but it is a **different dimension**, and one nobody currently owns (see §10, C-3).
> - **`SaaS/dashboard` split** into `saas-marketing-site` + `app-ui-surface`. A marketing homepage and a dashboard share no structure. Collapsed, the corpus's largest cluster (4 of 6 captures) would be unclassifiable — Linear's *page* is marketing, the *render inside it* is app-UI.
> - **`Korean 상세페이지/Wadiz/Tumblbug` split** into `kr-detail-page` + `kr-crowdfunding`. Grounded, not stylistic: `scripts/design-lexicon.json#/sectionArcs` already distinguishes `detail` (9 slots) from `wadiz` (14 slots — adds `funding-goal`, `reward-stack`, `funding-schedule`, `risk-notice`, `supporter-comments`). Different arcs are different artifacts.
> - **`motion` → `motion-reel`**, to name the medium rather than the property.
> - **Added** `landing-page`, `campaign-microsite` to cover conversion artifacts the seed left homeless.

| # | Slug | Gloss | Recognition test (first pass wins) |
|---|---|---|---|
| 1 | `app-ui-surface` | The product itself: a working web/desktop app screen. | Persistent app chrome (nav rail, account menu) and the content is *the user's own data*, not marketing copy. |
| 2 | `mobile-app-screen` | Native mobile app UI. | Same as above but a phone viewport with native status bar / tab bar. |
| 3 | `email` | An HTML email or newsletter. | Table-width column (~600px), an unsubscribe footer, no site nav. |
| 4 | `motion-reel` | A motion/animation artifact. | The deliverable is a video/prototype; stills are frames, not a page. |
| 5 | `kr-crowdfunding` | Wadiz / Tumblbug campaign page. | A **funding progress figure** (`달성`, `%`, 서포터 count) or a **reward-tier list**. Both are platform-gated and absent from ordinary commerce. |
| 6 | `kr-detail-page` | Korean 상세페이지 on a store/marketplace. | Long image-band scroll inside a fixed ~780–860px column, KR conversion copy, but **no funding figure**. |
| 7 | `ecommerce-pdp` | Western product detail page. | A buy box (price, variant picker, add-to-cart) beside a gallery; spec table below. |
| 8 | `pricing-page` | The plans / compare-tiers page. | ≥2 priced tiers side by side, usually a feature matrix. |
| 9 | `portfolio-site` | An individual's or studio's work index. | The content *is* a list of past work; the subject is the author. |
| 10 | `editorial-publication` | An article, feature, or magazine piece. | A byline and/or a dateline; the page's job is to be read, not to convert. |
| 11 | `brand-site` | A company/brand site whose job is world, not conversion. | No single dominant CTA; the page sells the *company*, not one offer. |
| 12 | `campaign-microsite` | A single-purpose launch/event/drop site. | One event or drop, a date, thin or absent nav. |
| 13 | `saas-marketing-site` | The marketing home of a software product. | Full product nav (Product/Pricing/Docs/Customers) + a logo wall; a multi-destination site, not one offer. |
| 14 | `landing-page` | Single-offer conversion landing (course, webinar, lead-gen). | **One** offer, **one** CTA repeated, nav thin or absent. Fallback for Latin-first conversion pages. |

**Disambiguators**
- `landing-page` not `saas-marketing-site` when there is no multi-destination nav and exactly one offer is on sale.
- `kr-crowdfunding` not `kr-detail-page` when a funding % or reward ladder is present — that is the platform gate, not a style.
- `app-ui-surface` not `saas-marketing-site` when the screen shows the user's data rather than a pitch. A product *render inside* a marketing page does not make the page app-UI (rule 3).
- `campaign-microsite` not `brand-site` when the page has an expiry date.

---

## 2 · `layout-archetype` — the page's spine **[ordered]**

**Scope: the spine** — how content is organised down the *whole* scroll, i.e. what you would draw in a 5-second wireframe. **Hero composition is deliberately NOT here** (it lives in `signature-move`: `asymmetric-hero`, `magazine-cover-logic`, `full-bleed-hero`, `bleed-crop`). Putting both in one dimension is what makes layout taxonomies collapse — nearly every page is "a band stack with an interesting hero", and that sentence contains two axes.

| # | Slug | Gloss | Recognition test (first pass wins) |
|---|---|---|---|
| 1 | `sidebar-shell` | App chrome: persistent rail + content pane. | A nav rail that does not scroll away. |
| 2 | `gallery-index` | The spine is a grid/index of works. | Thumbnails *are* the content; each links out. |
| 3 | `table-matrix` | The spine is a comparison/spec table. | The largest structure on the page is a table with a sticky header. |
| 4 | `sticky-rail-detail` | Scrolling content column beside a pinned buy/meta rail. | A rail stays fixed while the main column scrolls **and the rail is part of the authored design** (rule 3). |
| 5 | `image-band-scroll` | Stacked full-width **images** with text rasterised into them. | Right-click a headline: it is inside a JPEG/PNG. The KR commerce default. |
| 6 | `magazine-cover` | The artifact *is* a cover. | Masthead + coverline cluster + a cover subject, all in one screen. |
| 7 | `editorial-spread` | Prose with a dominant image, cross-column headline, pull-quotes. | Multi-column body text with a picture that crosses columns. |
| 8 | `manuscript-page` | One long text measure, generous margins, no bands. | One column of prose from top to bottom; margins are the only structure. |
| 9 | `timeline-scroll` | The spine is a sequential/dated/numbered progression. | Sections are steps or dates and their **order is the meaning**. |
| 10 | `scroll-scene` | The spine is a pinned/scrubbed sequence, not stacked sections. | Scrolling advances *one* scene rather than revealing the next. |
| 11 | `bento-grid` | One packed grid of **unequal** cells. | Cells differ in span; the grid is the page's main event. |
| 12 | `card-grid` | Repeated **equal-weight** cards in N columns. | Every cell is the same size; swapping two changes nothing. |
| 13 | `feature-strip-alternating` | Alternating left/right image+text rows. | The zig-zag. Image left, then image right, then left. |
| 14 | `split-screen` | Two persistent vertical halves. | A vertical seam runs the height of the section/page. |
| 15 | `full-bleed-canvas` | One edge-to-edge field/image is the whole artifact. | ≤1 screen; nothing stacks below it. |
| 16 | `band-stack` | **Fallback:** stacked full-width live-DOM bands. | Nothing above fits. Sections are horizontal bands you could reorder. |

**Disambiguators**
- `image-band-scroll` not `band-stack` when the text is *inside the image*. This is the single most useful distinction in the KR set: it decides whether type/colour are even inspectable.
- `bento-grid` not `card-grid` when cells are unequal — equal cells are `card-grid` no matter how they are styled.
- `sticky-rail-detail` not `band-stack` only if the rail is the **maker's**; a platform reward rail is chrome (rule 3).
- `full-bleed-canvas` not `band-stack` only when nothing follows it.
- `manuscript-page` not `editorial-spread` when there is a single column and no dominant image.

> **Known weakness (§10, C-1):** `band-stack` is a residue bucket and it takes 3 of the 6 current captures. That is *true* — most Western marketing pages are band stacks — but it means this dimension carries little discriminating power on its own. Discrimination comes from `signature-move` + `palette-family` + `type-personality`.

---

## 3 · `mood` — **multi-select (2–3)**

**Adopted verbatim (all 33) from `scripts/design-lexicon.json#/moods`.** This is a deliberate non-invention: `keyword-picker.js` scores terms by mood intersection (`scoreTerm`, `+3` per hit), so a corpus record's moods can be handed straight to `keyword-picker.js plan --moods "hook:awe; proof:credible"` with **zero translation**. Inventing a parallel mood vocabulary would fork the one thing already shared between corpus and planner.

**Collision check: none.** The set is identical, so no value can contradict what the script accepts.

**Why multi-select, and why that does not break the non-overlap rule.** The lexicon assigns 2–4 moods per term; a page is legitimately `nocturnal` *and* `premium`. Mutual exclusivity is asserted here at the level of **meaning** — no two values mean the same thing — not co-occurrence. Forcing single-select would break round-tripping into the picker. Cap at 3: beyond that the tag stops discriminating.

| Slug | Gloss | Recognition test |
|---|---|---|
| `awe` | Scale beyond the reader. | You feel small looking at it. |
| `authority` | Institutional right-to-speak. | It reads like a body of record. |
| `arresting` | Stops the eye by force. | One element you cannot look past. |
| `quiet` | Deliberately withheld volume. | Emptiness is the loudest thing. |
| `intimate` | One person speaking to one person. | Close crop or close voice. |
| `nocturnal` | Night as the setting. | Darks are the subject, not the background. |
| `clarity` | Nothing in the way of the meaning. | You understand before you admire. |
| `relief` | Tension released. | The "oh, finally" beat. |
| `order` | Everything in its place. | Alignment is the message. |
| `credible` | Believable because shown. | Claims arrive with receipts. |
| `forensic` | Evidence-grade specificity. | Dates, n's, sources, timestamps. |
| `volume` | Sheer amount as argument. | Abundance you could not fake. |
| `material` | The thing has a surface. | You can guess how it feels. |
| `precise` | Tolerances are tight. | Nothing is off by a pixel. |
| `abundance` | Generous, plentiful. | More than you expected to get. |
| `sincere` | No performance. | It would be embarrassing if false. |
| `heritage` | Inherited, not invented. | It claims a past. |
| `human` | A body was present. | Hands, handwriting, imperfection. |
| `value` | Worth for money. | The maths is being shown. |
| `honest` | Concedes something. | It admits a limit. |
| `weight` | Consequence, mass. | It sits heavily. |
| `urgent` | Now or not at all. | A clock is running. |
| `inviting` | Come in. | An open hand, not a shout. |
| `aspirational` | Become this. | A future self is pictured. |
| `reassuring` | It will be fine. | Answers the worry before it's asked. |
| `closure` | The end, properly. | It signs off. |
| `editorial` | Published, not posted. | A magazine's hand. |
| `tactile` | Grain, tooth, ink. | Texture you'd touch. |
| `premium` | Costly restraint. | What's *absent* signals money. |
| `warm` | Human temperature. | Colour leans to the sun. |
| `energetic` | Kinetic, fast. | It looks like it's moving. |
| `calm` | Rate slowed. | Nothing competes. |
| `bold` | Committed loudness. | It refuses to hedge. |

**Disambiguators for the confusable pairs** (these are tagger tests only; the values themselves belong to `design-lexicon.json`):
- `warm` not `inviting` when the temperature is *colour*, not *address*. Warm is a palette fact; inviting is a posture.
- `bold` not `arresting` when the loudness is *sustained*; arresting is one interruption, bold is a whole page's stance.
- `quiet` not `calm` when the silence is *deliberate compression* (something is being withheld); calm is merely unhurried.
- `premium` not `aspirational` when the appeal is to *taste already held*; aspirational addresses a self not yet reached.
- `credible` not `honest` when the page *proves*; honest is when it *concedes*.
- `forensic` not `precise` when the specificity is *evidentiary* (a date, an n); precise is craft tolerance.
- `volume` not `abundance` when the amount is *proof of scale*; abundance is proof of *generosity*.
- `material` not `tactile` when the point is *what it's made of*; tactile is *how the surface feels*.

---

## 4 · `palette-family` — how colour is deployed **[ordered]**

**One axis: deployment + character**, taken from `references/color-forward-palettes.md`, which is exactly that axis. **Hue-wheel relationships (analogous / split-complementary / tetradic) are deliberately NOT values here** — they are an orthogonal axis (a hue *relationship*, not a deployment), a page can be `saturated-field` *and* split-complementary at once, and a tagger cannot read wheel relationships off a chroma-subsampled JPEG in 5 seconds. See §9 drops.

This dimension enumerates **two of SKILL.md §2's three named clichés alongside sanctioned palettes** (`ai-purple-gradient`, `acid-on-black`) — a corpus stores negative exemplars too, and both Wadiz captures on disk are real top-sellers built on banned defaults (§8). The third named cliché (cream + serif + terracotta) has **no value of its own**: it folds into `earth-clay` as a palette *fact*, with no cliché marker — whether a given earth palette is that cliché is a tell judgement, and tells are `anti-ai-tells.md`'s vocabulary, not this file's (same division of labour as §10, C-5). A vocabulary that can only describe good pages cannot describe this corpus.

| # | Slug | Gloss | Recognition test (first pass wins) |
|---|---|---|---|
| 1 | `ai-purple-gradient` | Violet→blue gradient + glossy 3D blobs. The named banned default (SKILL.md §2). | A violet/indigo field **and** at least one glossy gradient 3D "app-icon" object. |
| 2 | `acid-on-black` | Near-black + acid lime/chartreuse. The named cliché pole (SKILL.md §2). | Ground is near-black **and** the accent sits in the lime band (hue ~100–140). |
| 3 | `iridescent-wash` | Soft multi-hue gradient mesh/wave on a light ground. | ≥3 hues blending continuously, no hard edge, no 3D blob. |
| 4 | `kr-heritage-color` | 오방색 / 단청 / natural-dye hues. | Korean ceremonial or plant-dye palette. |
| 5 | `duotone-photographic` | The palette **is** an ink pair on photography. | Every photo shares two inks. |
| 6 | `jewel-luxe` | Deep near-black + one jewel hue structurally + metallic hairline. | Emerald/sapphire/amethyst owns a band, brass/gold hairlines finish it. |
| 7 | `saturated-field` | A high-chroma field owns whole bands, type reversed out. | ≥2 bands are flooded with the same saturated colour. (Ordered **above** `earth-clay`: a marigold/tomato field is built of pigment names too, so first-pass-wins must reach the flood test before the temperature test — otherwise `color-forward-palettes.md`'s own flagship "Saturated Field" palette would mis-tag `earth-clay`.) |
| 8 | `earth-clay` | Terracotta, ochre, umber, moss — and their gray-pulled kin: sage, clay, oatmeal, slate. | Anti-digital by temperature; pigment names, not screen names; every field stays low-chroma (a flooded saturated band already fired at #7). Absorbs the lexicon's `desaturated-palette` (a multi-hue base "pulled 30-60% toward gray"). |
| 9 | `colorful-quiet-luxury` | Warm earthy base + ONE saturated joy-colour. | A clay/cocoa base with one unexpected pop doing emotional work. |
| 10 | `acid-editorial` | High-key off-white + a near-clashing electric pair. | Off-white ground **and** two near-clashing saturated hues. |
| 11 | `muted-field-hot-accent` | Low-chroma **colour** field, one hot accent = information. | The ground is a muted colour (not black, not paper) and the accent means CTA/price. |
| 12 | `dark-field-hot-accent` | Near-black ground + one hot **non-lime** accent field. | The ground is flat near-black, an accent **field** is present, and the accent sits outside the lime band (lime-on-black already fired at #2). The Raycast / dev-tool dark family — graphic darks with a committed accent, which neither #16 (needs a *photographed* dark) nor #17 (forbids any accent field) can legally hold. |
| 13 | `flat-spot-color` | One ink + black + paper. | Letterpress economy: literally one colour. |
| 14 | `pastel-with-grit` | Soft hues carrying noise/texture attitude. | Pastels that are not sweet — grain over them. |
| 15 | `tone-on-tone` | One hue across a lightness/chroma ladder, hue drift, no black/white. | Every surface is the same hue at a different step. |
| 16 | `low-key-nocturnal` | Several different near-blacks; cinema-dark, **lit**. | Darks show falloff, gel or practical light — a photographed dark. |
| 17 | `dark-neutral-ui` | Near-black/greige UI ramp, no committed field. | Flat dark **surfaces**, not lit darks; no accent field anywhere. |
| 18 | `ink-vermilion` | Paper-white + true-black editorial + ONE reserved hot accent. | Near-mono **plus** editorial discipline (oversized photography / display-scale labels / whitespace as material) **plus** one hot mark. |
| 19 | `mono-ink` | Paper + near-black, ~zero chroma, **no** accent field. | Near-mono and no accent field anywhere — the palette **fact** only. Whether the restraint is *earned* is a rubric judgement, recorded outside this dimension (see the disambiguator note below and §10, C-2). |
| 20 | `high-key-airy` | Near-white, low-contrast, airy. | Everything is light; contrast is the scarcity. |

**Disambiguators**
- `ai-purple-gradient` not `iridescent-wash` when there is a glossy 3D object. Both are gradients; the 3D blob is the tell that separates the banned default from Stripe-class art direction. (This pair is why the dimension needs both — see §8.)
- `acid-on-black` not `low-key-nocturnal` when a lime/acid accent is present: the cliché is named by its *hue*, not its ground.
- `low-key-nocturnal` not `dark-neutral-ui` when the darks are **lit** (falloff, gel, practical source) rather than flat surfaces.
- `dark-field-hot-accent` not `acid-on-black` when the accent is outside the lime band (~100–140): the cliché is named by its **hue**.
- `dark-field-hot-accent` not `low-key-nocturnal` / `dark-neutral-ui` when the dark is a flat surface or graphic render **and** an accent field is present — it is the only legal home for that combination.
- `mono-ink` not `ink-vermilion` when there is **no** hot accent at all.
- **Removed value — `monochrome-timid`.** It was `mono-ink`'s logical complement gated on a tagger's *verdict* ("is the restraint earned?"): two pixel-identical pages could receive different tags. A taxonomy value must be a fact, not a verdict, so near-mono-no-accent pages all tag `mono-ink`, and the earned-vs-default judgement is a **rubric field for `SCHEMA.md` to place** (handoff noted for G1.8 — no `SCHEMA.md` change is made or implied here). See §10, C-2.
- `saturated-field` not `acid-editorial` when the ground is the saturated colour itself rather than off-white.
- `muted-field-hot-accent` not `ink-vermilion` when the ground is a muted **colour**, not paper.

---

## 5 · `type-personality`

**Scope: the face that carries the page's voice** — the display/headline face. Body faces are usually the neutral workhorse and would flatten this dimension to `neo-grotesque-neutral` for most of the corpus. If display and body are the same face, tag that face. (`SCHEMA.md` may reference this dimension from more than one field; arity is its call — see the scope line.)

| Slug | Gloss | Recognition test |
|---|---|---|
| `neo-grotesque-neutral` | Helvetica/Inter lineage: anonymous, systematic. | Closed apertures, even weight, no opinion. **This is the AI centre.** |
| `grotesque-workmanlike` | 19th-c. grotesque: industrial warmth. | Squared, slightly irregular; a printed object, not an app. |
| `geometric-sans-clean` | Circles and straight lines. | The `o` is a circle. |
| `humanist-warm` | Gill/Frutiger/Optima: a person wrote this. | Calligraphic skeleton under a sans. |
| `garalde-bookish` | Old-style serif: centuries-of-print authority. | Angled stress, small x-height, bookish. |
| `transitional-authority` | Baskerville/Times: newspaper-of-record. | Vertical stress, sharp, rational. |
| `didone-glamour` | Didot/Bodoni: fashion-magazine expense. | Hairline-to-fat contrast, flat serifs. |
| `slab-vernacular` | Slab/Egyptian/Clarendon: hand-bill sturdiness. | Block serifs, loud without neon. Clarendon folds here. |
| `fat-face-shout` | Circus-poster maximal drama. | One or two words fill the width. |
| `ink-trap-modern` | Craft-rooted modern with visible traps. | Notches at the joins at display size. |
| `engraved-institutional` | Copperplate caps: diploma-grade trust. | Engraved caps on a credential. |
| `stencil-utility` | Cargo/military crate physicality. | Broken strokes. |
| `blackletter-heraldic` | Fraktur/Textura: certificate weight. | Gothic blackletter, usually one word. |
| `script-hand` | Brush/hand script: speed, appetite. | A written, not drawn, letterform. |
| `mixed-face-ransom` | Cut-and-paste zine urgency. | Multiple faces inside one headline. |
| `custom-lettering` | Drawn for this page; unrepeatable. | Letterforms that exist in no font. |
| `mono-machine` | Monospace as the voice. | Even advance width. **As a decorative eyebrow this is the #1 AI tell** — record it, don't excuse it. |
| `myeongjo-literary` | 명조체: literary KR sincerity, premium warmth. | KR serif; the opposite of app-UI voice. |
| `kr-gothic-modern` | Pretendard / 스포카한산 class: the contemporary geometric-humanist KR sans — today's web default. | Even colour, open apertures, forms drawn for retina screens; no opinion. |
| `kr-gothic-classic` | 돋움/굴림-era classical KR gothic (the lexicon's `gothic-dodum`). | System-font-era rhythm: tighter apertures, squarer counters, a dated hinting-age look. |
| `kr-gothic-shout` | 견고딕 / Black Han Sans class: vernacular punch. | KR gothic at maximal weight, poster-loud. |
| `talnemo-experimental` | 탈네모꼴 (안상수체 lineage): design-literate KR modernism. | KR glyphs that escape the square. |
| `panbon-woodblock` | 판본체: hangul modeled on 15th-c. woodblock printing. | Blocky, even-weight, block-cut forms — **printed/carved, not written**. Founding-document authority. |
| `gungseo-court-brush` | 궁서체: formal brush-script hangul from Joseon court calligraphy. | Cursive **brush-written** hangul, regular and upright, with entry/exit strokes — written, not cut. |
| `signboard-vernacular` | 옛 간판체: mid-century hand-painted shop-sign hangul. | Thick, **uneven, hand-painted** strokes — 노포/장인 city warmth, neither court-formal nor print-blocky. |

*(25 values. The former `kr-gothic-neutral` and `kr-heritage-lettering` buckets were split — one bucket for the entire KR sans workhorse space and one for all KR heritage lettering was exactly the flattening this section's preamble says it designed around, and the three heritage sources are opposites on pointable axes: printed vs brush-written vs hand-painted.)*

**Disambiguators**
- `neo-grotesque-neutral` not `grotesque-workmanlike` when the face has *no* irregularity — neutrality is the point.
- `slab-vernacular` absorbs Clarendon: at 5 seconds a tagger cannot separate Victorian-Americana warmth from Rockwell sturdiness.
- `kr-gothic-shout` not `kr-gothic-modern`/`kr-gothic-classic` by **weight and role**: shout is display-weight carrying the argument; the neutrals are body-weight carrying text.
- `kr-gothic-modern` not `kr-gothic-classic`: does the face look drawn for retina screens (Pretendard-class) or for the system-font era (돋움-class)?
- `panbon-woodblock` not `gungseo-court-brush`: printed/carved vs written — look for brush entry/exit strokes.
- `gungseo-court-brush` not `script-hand` when the brush forms follow the formal court model (regular, upright, ceremonial); `script-hand` is contemporary speed and appetite.
- `signboard-vernacular` not `custom-lettering` when the forms claim a mid-century sign-painting *tradition* rather than being drawn one-off for this page.
- `custom-lettering` not `talnemo-experimental` when the forms are one-off; talnemo is a *tradition*.
- `mono-machine` only when mono is the **voice-carrying** face. Mono in a code sample is not a personality.

---

## 6 · `signature-move` — the library

**The single element the page is remembered by** (SKILL.md §2: "the single element this page is remembered by, embodying the brief"). 109 values in **6 shelves**; pick the shelf, then the value, then apply **§6.0**. Shelves are **not** disjoint and this dimension is not [ordered] — "single primary" is an arity, so §6.0 is the decision procedure that makes it one. The shelf key doubles as a coarse `signature-family` for consumers that want one (see §11).

This is the primary home for the design lexicon: **113 of its 235 terms land here** (§9).

### 6.0 Exclusivity procedure — how one move wins

1. **Candidate set.** A move is a candidate only at *remembered-element* strength (the bar above), not merely present somewhere on the page.
2. **Element beats placement.** Moves whose test names only **placement, emptiness, or size** — `margin-drama`, `scale-drama`, `full-bleed-hero`, `bleed-crop` — **yield** to any passing move whose test names the element's own construction. Emptiness and scale are how a page *presents* its element; they are the tag only when nothing more specific passes. (This is what picks `coverline-block` over the also-passing `margin-drama` on `vercel` — §8.)
3. **Pair disambiguators** for the known cross-shelf collisions:
   - `establishing-shot` not `full-bleed-hero` when the full-bleed opener is an **environmental photograph** — it says *where*. A non-environmental full-bleed (product, portrait, graphic) is `full-bleed-hero`.
   - `negative-space-photography` not `margin-drama` when the emptiness is **inside the photograph** (the photo's own composition). Live-DOM whitespace around an element is `margin-drama`.
   - `asymmetric-diptych` not `color-blocking` when there is exactly **one seam and each plane carries content** — the fold ratio is the opinion. ≥3 hard-edged solid planes, or planes carrying no distinct content, are `color-blocking`.
   - `type-as-container` not `scale-drama` when content is physically **clipped inside the letterform** — containment, not a size jump.
4. **Last resort.** Two element-level moves still tied → the lexicon's crop test: hide each candidate in turn; the one whose removal changes the page more is the primary. Undecidable in ~5 seconds → `unresolved` (rule 5). The runner-up goes in the record's `notes`, never in the tag.

### 6.1 Shelf `type` (18)
`type-as-container` · `negative-leading-block` · `rotated-spine-text` · `small-caps-label-system` · `vertical-setting` · `rubrication` · `hanja-garnish` · `mixed-script-typesetting` · `condensed-poster-display` · `brush-calligraphy-accent` · `reverse-contrast-header` · `run-in-head` · `justified-fineprint-block` · `ledger-figure-setting` · `type-on-a-path-seal` · `drop-cap` · `pull-quote-display` · `deck-standfirst`

| Slug | Recognition test |
|---|---|
| `type-as-container` | One huge glyph physically carries other content inside it. |
| `negative-leading-block` | Lines overlap; the headline is a solid mass. |
| `rotated-spine-text` | Running text along a viewport edge, 90°. |
| `small-caps-label-system` | Section labels in **real** small caps (not tracked all-caps mono). |
| `vertical-setting` | 세로쓰기: one vertical line acting as a seal/spine. |
| `rubrication` | A second (red) ink marks structure inside a document world. |
| `hanja-garnish` | 記錄 一 instead of 기록 01. |
| `mixed-script-typesetting` | 한글 owns emotion, EN owns data, one consistent secondary style. |
| `condensed-poster-display` | 장체 at poster scale. |
| `brush-calligraphy-accent` | Real 붓글씨 on the one emotional peak. |
| `reverse-contrast-header` | Horizontals heavier than verticals — deliberately "wrong". |
| `run-in-head` | Bold lead-in, body continues on the same line. |
| `justified-fineprint-block` | Justified text as a solid rectangle of document-ness. |
| `ledger-figure-setting` | Tabular lining figures locking a column of numbers. |
| `type-on-a-path-seal` | Text set around a circle as an emblem. |
| `drop-cap` | One initial spans 3+ lines. |
| `pull-quote-display` | A quote pulled to display scale with hung punctuation. |
| `deck-standfirst` | A written-through standfirst under the headline (not a grey blob). |

### 6.2 Shelf `layout-editorial` (25)
`asymmetric-hero` · `broken-grid-violation` · `margin-drama` · `scale-drama` · `cross-gutter-overlap` · `diagonal-axis` · `asymmetric-diptych` · `full-bleed-hero` · `bleed-crop` · `text-runaround` · `rabatment-placement` · `masthead` · `coverline-block` · `toc-device` · `marginalia` · `footnote-apparatus` · `caption-discipline` · `catalog-plate` · `contact-sheet` · `colophon` · `end-credits` · `interview-qa` · `cross-section-continuity` · `jump-cut-rhythm` · `match-cut`

| Slug | Recognition test |
|---|---|
| `asymmetric-hero` | Headline mass off-axis with a counterweight at the far edge. |
| `broken-grid-violation` | Exactly one element breaks a grid that is otherwise legible. |
| `margin-drama` | Deliberately extreme **or unequal** margins, or ~40% of a viewport empty around one element. Absorbs "whitespace as asset" without losing its own discriminator — the unequal-margin case still tags here. |
| `scale-drama` | A 10×+ size jump between two elements. |
| `cross-gutter-overlap` | Depth by occlusion — an element crosses a seam. |
| `diagonal-axis` | A sightline runs diagonally through the section. |
| `asymmetric-diptych` | A 70/30 fold where the ratio itself is the opinion. |
| `full-bleed-hero` | One edge-to-edge image opens the page (page continues below). |
| `bleed-crop` | The subject is cut by the page edge. |
| `text-runaround` | Type flows around a cut-out shape. |
| `rabatment-placement` | Subject placed on the square-off-the-short-side line. |
| `masthead` | The page has a title at title scale, like a publication. |
| `coverline-block` | 3–5 short meta lines clustered as one block in a trim-edge **zone** (magazine coverlines sit inset from the trim, not flush to it). |
| `toc-device` | Real anchors/folio numbers/dot leaders. Absorbs `folio`, `anchor-navigation`. |
| `marginalia` | Sidenotes in the margin, not footnotes. |
| `footnote-apparatus` | Superscripts resolving to sources at the section foot. |
| `caption-discipline` | Captions carry date/place/provenance specifics. |
| `catalog-plate` | Each object gets a plate number and a precise caption. |
| `contact-sheet` | A sheet of frames with one grease-pencilled select. |
| `colophon` | Who made this, with what, when — as the closing section. |
| `end-credits` | Small-caps role/name columns closing the page. |
| `interview-qa` | Claims restructured as asked-and-answered. |
| `cross-section-continuity` | An element begun in section N resolves in N+1. |
| `jump-cut-rhythm` | Adjacent sections change register violently. |
| `match-cut` | A form echoes, transformed, in the next section. |

### 6.3 Shelf `photo-film` (38)
`establishing-shot` · `chiaroscuro-portrait` · `rembrandt-portrait` · `rim-light-product` · `macro-material-crop` · `shallow-dof-portrait` · `flat-lay-knolling` · `overhead-process-table` · `in-situ-mockup` · `still-life-cast-shadow` · `seamless-sweep` · `hands-in-frame` · `prop-styling` · `reportage-proof` · `bw-reportage` · `direct-flash-snapshot` · `behind-the-scenes-candid` · `environmental-lifestyle` · `archival-ephemera-scan` · `dragged-shutter` · `montage-mosaic` · `insert-shot` · `letterbox-still` · `dutch-angle` · `silhouette-contre-jour` · `golden-hour-close` · `blue-hour-scene` · `practical-light` · `halation` · `negative-space-photography` · `double-exposure` · `mixed-media-collage` · `hand-drawn-annotation` · `filmic-color-grade` · `palette-from-photograph` · `selective-color` · `instant-film-frame` · `product-ui-hero-render`

| Slug | Recognition test |
|---|---|
| `establishing-shot` | A full-bleed environmental photo says *where* before anything says what. |
| `chiaroscuro-portrait` | One lit face emerging from deep shadow. |
| `rembrandt-portrait` | 45° key with the triangle on the shadow cheek. |
| `rim-light-product` | A bright silhouette line sculpts the product from darkness. |
| `macro-material-crop` | Material detail larger than life. Absorbs `hero-product-macro`, `extreme-close-up`. |
| `shallow-dof-portrait` | Bokeh — proof a camera was present. |
| `flat-lay-knolling` | 90° overhead of the actual kit, **every edge squared, no overlap** — order as professional rigor. Absorbs `knolling`. |
| `overhead-process-table` | 90° overhead with **natural overlap, crumbs, coffee rings** — in-progress candour, the opposite register of knolled order. (Split from `flat-lay-knolling`: "is there overlap?" is decidable well inside 5 seconds, and the two claim opposite things.) |
| `in-situ-mockup` | The design composited into a **real photographed** device. |
| `still-life-cast-shadow` | Hard directional light; the shadow proves 3D. |
| `seamless-sweep` | Cyclorama sweep in the brand colour. |
| `hands-in-frame` | A held object; skin and grip. |
| `prop-styling` | 3–5 named props encoding the customer's world. |
| `reportage-proof` | Photos **of the tool in use**, dated. |
| `bw-reportage` | B&W documentary grain as a truth-claim. |
| `direct-flash-snapshot` | On-camera flash; the imperfection is the credibility. |
| `behind-the-scenes-candid` | Unstaged process. |
| `environmental-lifestyle` | Real context of use, real mess. |
| `archival-ephemera-scan` | A **real captured** artifact — flatbed scan of a ticket/note/receipt. Absorbs `scanography`. Simulated-only pastiche is banned (tell #21). |
| `dragged-shutter` | Sharp subject, flowing motion — a real event. |
| `montage-mosaic` | 20+ small real images at once. |
| `insert-shot` | One small photographed detail as punctuation between text. |
| `letterbox-still` | A 2.39:1 still as a chapter divider. |
| `dutch-angle` | 2–5° off-axis against a strict grid. |
| `silhouette-contre-jour` | Backlit silhouette as the closing gesture. |
| `golden-hour-close` | Golden-hour warmth on the outcome image. |
| `blue-hour-scene` | Deep-blue ambient + warm artificial. |
| `practical-light` | The in-frame source explains the scene's light. |
| `halation` | Film highlight bleed. |
| `negative-space-photography` | The photo's emptiness is the composition. |
| `double-exposure` | Two frames superimposed. |
| `mixed-media-collage` | Photographic + drawn + scanned in one plane. |
| `hand-drawn-annotation` | **Real** marker circles/arrows on a screenshot. Never rotated type faking a hand (tell #23). |
| `filmic-color-grade` | One named grade across all photos. Absorbs `film-stock-color` (Portra), `teal-orange-grade`. |
| `palette-from-photograph` | The UI's colours are sampled from the hero image. |
| `selective-color` | One object keeps colour; the rest doesn't. |
| `instant-film-frame` | Polaroid-frame kept-snapshot warmth. |
| `product-ui-hero-render` | **Gap-fill (§10, C-4).** A high-fidelity render of the product's own UI as the hero subject. The lexicon names only its *ban* ("repeated browser-chrome mockups") and its *cure* (`in-situ-mockup`) — it has no neutral term for the move itself, which the corpus's strongest SaaS exemplars are built on. |

### 6.4 Shelf `color-material` (16)
`committed-saturated-field` · `color-blocking` · `ikb-immersion` · `signature-brand-color` · `overprint-multiply` · `equiluminant-vibration` · `color-gel-field` · `film-grain-field` · `halftone-treatment` · `uncoated-paper-overlay` · `risograph-misregistration` · `cmyk-misprint` · `grain-gradient` · `letterpress-impression` · `hard-offset-shadow` · `texture-close-up`

| Slug | Recognition test |
|---|---|
| `committed-saturated-field` | A saturated field owns a whole band, type reversed out. *(Source: SKILL.md §2 COLOR COMMITMENT — "a committed saturated color field CAN be the signature". No lexicon parent.)* |
| `color-blocking` | Large hard-edged solid planes at asymmetric proportions. |
| `ikb-immersion` | One immersive International Klein Blue pause section. |
| `signature-brand-color` | One exact ownable hue, neighbours forbidden. |
| `overprint-multiply` | Overlaps multiply — the overlap *means* something. |
| `equiluminant-vibration` | Op-art vibration in a tiny dose. |
| `color-gel-field` | Colour shot as **light**: depth, falloff, shadow. |
| `film-grain-field` | 3–6% grain over images **and** flat fields. |
| `halftone-treatment` | Coarse ~20 lpi dots. |
| `uncoated-paper-overlay` | ~8% multiply paper texture over the whole page. |
| `risograph-misregistration` | Fluoro spot inks, visible misregistration. |
| `cmyk-misprint` | One plate 3px off, deliberately. |
| `grain-gradient` | Heavy dithered noise — a sprayed, not ramped, blend. |
| `letterpress-impression` | 형압: a pressed, physical impression. |
| `hard-offset-shadow` | A hard offset shadow as a graphic device. |
| `texture-close-up` | A pure tactility interstitial. |

### 6.5 Shelf `brand-commerce` (11)
`graphic-motif` · `monogram-seal-system` · `illustration-language` · `icon-system` · `sticky-buy-bar` · `reward-tier-ladder` · `honest-comparison-table` · `trust-badge-row` · `calm-fact-deadline` · `nukki-cutout` · `rationed-en-label`

| Slug | Recognition test |
|---|---|
| `graphic-motif` | One ownable device, derived from the subject, doing 3+ jobs. |
| `monogram-seal-system` | Seals/도장 as identity marks; one ink, one impression texture. |
| `illustration-language` | A **named** illustration style, era, line weight. |
| `icon-system` | A consistent icon set carries the feature rows. *(Recorded, not endorsed — the lexicon's own note is that deletion is usually the higher-value move.)* |
| `sticky-buy-bar` | A quiet fixed price/CTA bar; **the maker's**, not platform chrome. |
| `reward-tier-ladder` | 2–4 tiers, one recommended, caps stated as facts. |
| `honest-comparison-table` | A comparison table that **concedes at least one cell**. |
| `trust-badge-row` | One monochrome row of real, dated badges. |
| `calm-fact-deadline` | Scarcity as a plain folio line with tabular figures — not countdown theatre. |
| `nukki-cutout` | 누끼 on a colour field with the real shadow kept. |
| `rationed-en-label` | 1–2 editorial EN labels per page, all else 한글. |

### 6.6 Shelf `none` (1)
| Slug | Recognition test |
|---|---|
| `none-authored` | **No single element carries the page.** Apply the lexicon's own crop test (`visual-identity`): hide the logo — could this be anyone's? If the most memorable element is a platform default, a stock 3D asset, or a named banned default, the honest tag is `none-authored`, **not** the nearest positive move. See §8 and §10, C-5. |

---

## 7 · Korean-commerce dimensions

> **Note on scope.** `awareness` and `sophistication` are grouped here because `references/korean-detailpage.md` defines them, but SKILL.md §1 sets them in the **Brief step, before the mode split** — they apply to landing pages too, and are tagged for all 6 captures in §8. Keeping them KR-only would leave two dead fields on two-thirds of the corpus.

### 7.1 `platform-width`
Source: `korean-detailpage.md` — "Naver/Wadiz **860px**, Coupang 780px, 11번가 831px — 860px is the safe default".

| Slug | Gloss | Recognition test |
|---|---|---|
| `wadiz-naver-860` | The 860px safe default. | Content column ≈860px. |
| `coupang-780` | Coupang's narrower column. | Content column ≈780px. |
| `eleven-st-831` | 11번가. | Content column ≈831px. |
| `self-hosted-free` | KR commerce page not bound to a marketplace column. | KR long-scroll, no fixed platform width. |
| `not-applicable` | Not a KR platform artifact. | Anything else. |

⚠️ Measured width is `SCHEMA.md`'s `layout.content_width_px` and is **GAP-03** there (no image decoder is installed — `package.json` declares only `patchright`). This tag is therefore assigned from the **known platform**, not from a pixel measurement. Do not treat it as measured.

### 7.2 `pasona-arc` — the arc's shape **[ordered]**
Source: `korean-detailpage.md` — **P**roblem → **A**ffinity → **S**olution(mechanism) → **O**ffer → **N**arrow → **A**ction.

> **Extension declared:** the brief named this a KR dimension. 4 of 6 corpus captures are non-KR, and a KR-only arc dimension would be `not-applicable` on the majority — a dead field. So the dimension is *the page's persuasion-arc shape, with PASONA as the reference frame*, and carries `landing-arc` (SKILL.md §3 landing mode) and `non-pasona-editorial` (29CM PT format). The machine key stays `pasona-arc` as the brief named it.

| # | Slug | Gloss | Recognition test (first pass wins) |
|---|---|---|---|
| 1 | `feature-dump` | No persuasion arc; a spec/feature list. | No problem is ever named. The thing PASONA exists to replace. |
| 2 | `non-pasona-editorial` | 29CM PT format: webzine world-building, specs late, buy module last. | Story is the spine; the offer arrives at the end. |
| 3 | `landing-arc` | Western landing arc (hero thesis → social proof → value → features → pricing → FAQ → CTA). | A logo wall right under the hero; no 공감 beat. |
| 4 | `pasona-solution-collapsed` | **S folded into O** — the doc's named #1 mistake. | The product is named *as* the mechanism; it sells before it explains. |
| 5 | `pasona-narrow-skipped` | All beats but **N** (대상 좁히기). | No "특히 ~한 분께" / "이런 분이라면" beat anywhere. |
| 6 | `pasona-truncated` | Enters mid-arc (per `awareness`) and runs the remainder in order. | Opens past P/A by design, e.g. straight at proof or offer. |
| 7 | `full-pasona` | All six beats, S distinct from O. | P, A, S, O, N and A are each locatable. |
| 8 | `not-applicable` | Not a persuasion artifact. | An app screen, a portfolio index. |

### 7.3 `pasona-stage`
The six stages as an enum, for per-stage presence records (`SCHEMA.md` §6 types `commerce.arc` as `{stage, present, evidence}[]`).

| Slug | Gloss | Recognition test |
|---|---|---|
| `problem` | 문제 — the pain named. | The reader's friction is stated. |
| `affinity` | 공감 — the pain in the customer's own words. | Verbatim customer phrasing; "내 얘기다". |
| `solution` | 해결 원리 — the mechanism, **product not yet named**. | *How* it works, before *what* it is. |
| `offer` | 제안 — the packaged product. | The thing you can buy, with its contents. |
| `narrow` | 대상 좁히기. | "특히 ~한 분께" / "이런 분이라면". |
| `action` | 긴급 CTA. | The ask, with urgency attached. |

### 7.4 `awareness`
Verbatim from `korean-detailpage.md` (Schwartz). Sets where the hero starts.

| Slug | Recognition test |
|---|---|
| `unaware` | Opens with story/symptom/identity; the problem is not yet named. |
| `problem-aware` | Opens by naming the pain vividly. |
| `solution-aware` | Opens with the mechanism / "왜 이게 다른가"; skips agitation. |
| `product-aware` | Opens with proof/differentiation/offer; they know you. |
| `most-aware` | Opens with offer/price/urgency; minimal warm-up. |

### 7.5 `sophistication`
Verbatim from `korean-detailpage.md`. Sets the claim style. Collapsed to the three bands the source itself uses.

| Slug | Recognition test |
|---|---|
| `stage-1-2-plain-claim` | A plain benefit / bigger-claim headline; superlatives still used ("최초", "1위", "역대 최고"). |
| `stage-3-mechanism` | Leads with a unique mechanism — the "how" no one else is saying. |
| `stage-4-5-new-identity` | Claims exhausted; pivots to identity/experience/sensory framing. No superlative. |

---

## 8 · Worked example — the 6 captures on disk

Required sanity check: tags that cannot classify the corpus's own exemplars are wrong. All 6 were opened (tiles read, `data.json`, `bodytext.txt`). **Every dimension filled for all 6** (`unresolved` is a legal fill — rule 5). All **[ordered]** cells were re-walked top-down against the full lists rather than assigned by impression; the re-walk changed three first-draft cells — `stripe`'s palette, `raycast`'s palette, `403454`'s arc — and the corrections are kept visible in the evidence below as proof the device is executed, not just declared. Findings from doing it are in §10.

| Dimension | `400620` | `403454` | `linear` | `raycast` | `stripe` | `vercel` |
|---|---|---|---|---|---|---|
| `category` | `kr-crowdfunding` | `kr-crowdfunding` | `saas-marketing-site` | `saas-marketing-site` | `saas-marketing-site` | `saas-marketing-site` |
| `layout-archetype` | `image-band-scroll` | `image-band-scroll` | `band-stack` | `band-stack` | `bento-grid` | `band-stack` |
| `mood` | `urgent`, `bold`, `energetic` | `bold`, `volume`, `urgent` | `precise`, `nocturnal`, `premium` | `nocturnal`, `energetic`, `precise` | `clarity`, `authority`, `premium` | `quiet`, `precise`, `clarity` |
| `palette-family` | `acid-on-black` | `ai-purple-gradient` | `dark-neutral-ui` | `dark-field-hot-accent` | `iridescent-wash` | `mono-ink` |
| `type-personality` | `kr-gothic-shout` | `kr-gothic-shout` | `neo-grotesque-neutral` | `neo-grotesque-neutral` | `neo-grotesque-neutral` | `neo-grotesque-neutral` |
| `signature-move` | `none-authored` | `none-authored` | `product-ui-hero-render` | `grain-gradient` | `graphic-motif` | `coverline-block` |
| `platform-width` | `wadiz-naver-860` | `wadiz-naver-860` | `not-applicable` | `not-applicable` | `not-applicable` | `not-applicable` |
| `pasona-arc` | `full-pasona` | `unresolved` | `landing-arc` | `landing-arc` | `landing-arc` | `landing-arc` |
| `awareness` | `problem-aware` | `product-aware` | `solution-aware` | `solution-aware` | `product-aware` | `product-aware` |
| `sophistication` | `stage-3-mechanism` | `stage-1-2-plain-claim` | `stage-3-mechanism` | `stage-4-5-new-identity` | `stage-3-mechanism` | `stage-4-5-new-identity` |

**Evidence for the non-obvious cells**

- **`400620` `acid-on-black`** — `tile_02.jpg`: near-black ground, acid-lime highlighter swipes under KR gothic on white rounded cards. This is SKILL.md §2's named cliché ("near-black + acid-green"), verbatim.
- **`400620` `full-pasona`** — hook `tile_00` ("30분이면 자동 수익 세팅"), 공감 `tile_02` ("답답하시죠?" — rasterised in the tile and absent from `bodytext.txt`, i.e. pixel-read). The remaining beats are quoted from **inside the authored story region** — the span of `bodytext.txt` above the `스토리 접기` fold marker, where this maker writes live-DOM copy between image bands (rule 3 corollary): **N** — "이런 분이라면 / 이 강의가 시간을 아껴드릴 수 있습니다"; **O** — the maker's own Q&A states the package contents ("1단계, 2단계: 12개월 수강 이용권 / 3단계, 4단계: 10년 수강 이용권") and prices the ladder ("울트라 얼리버드 → 얼리버드 → 정가"); **A** — the story column closes on "울트라 얼리버드 한정 수량. / 매진 시 가격이 올라갑니다." immediately before the fold. An earlier draft cited whole-file token counts (`리워드` ×4, `신청` ×8) as O/A evidence — **struck**: those counts sample platform chrome and the cross-campaign rail below the fold, the region rule 3 excludes. S-vs-O separation remains the weakest cell in this column.
- **`403454` `ai-purple-gradient`** — `tile_03.jpg`: violet field + glossy gradient 3D medal and speech-bubble objects. The 3D blob is exactly the discriminator in §4 that separates this from `iridescent-wash`; it is also SKILL.md §2's "#1 fake-render tell".
- **`403454` `stage-1-2-plain-claim`** — reads "역대 최고 매출", "최초 AI 디자인 템플릿", "와디즈 1위". A superlative stack, which `korean-detailpage.md` marks as dead at stage 4–5. Tagged as observed, not as recommended.
- **`403454` `pasona-arc: unresolved`** — downgraded from a first-draft `full-pasona` per rule 5. That tag rested entirely on whole-file token counts, and every one dissolves under rule 3: all four `대상` hits are a bio credential ("기업 대상 특강"), a homograph ("포브스코리아 대상 3관왕 수상" — 대상 = grand prize, a different word), and two FAQ logistics lines — none is the `특히 ~한 분께 / 이런 분이라면` N-beat test; `리워드` ×5 is 5/5 platform chrome; `신청` ×8 includes 4 hits from the cross-campaign rail (other makers' projects). With the N evidence void, the ordered walk would fire #5 `pasona-narrow-skipped` before #7 `full-pasona` — but no beat in this column has pixel evidence yet, so asserting #5 would repeat the same mistake with a different value. `unresolved` + this note until the tiles are read beat-by-beat.
- **`linear` `product-ui-hero-render`** — `tile_00`/`tile_02`: large dark high-fidelity renders of Linear's own UI are the page's subject. A real `toc-device` also passes (`2.0 Plan →`, `2.1 Projects`, `2.2 Documents` folio numbering in `tile_02`); the dimension is single-primary, so §6.0 step 4 decides — hiding the UI renders changes the page far more than hiding the folio numbering — and the toc goes to the record's `notes`, not the tag.
- **`raycast` `grain-gradient`** — `tile_00`: red diagonal slashes rendered as heavy dithered spray, not a smooth ramp. The lexicon's `grain-gradient` describes this precisely ("analog spray-paint blends instead of digital ramps").
- **`raycast` `dark-field-hot-accent`** — `tile_00`: flat near-black ground + a rendered red dithered accent field. Walking §4 top-down: #2 `acid-on-black` fails (the accent is red, not lime), #12 fires. A first draft tagged `low-key-nocturnal` by elimination — a stretch of that value's own test (the dark here is a graphic render, not a photographed dark, and `dark-neutral-ui` forbids the accent field), which is exactly the coverage hole #12 was added to close.
- **`raycast` `stage-4-5-new-identity`** — the H2 is literally `It's not about saving time.`, a reframe away from the tired claim.
- **`stripe` `iridescent-wash`** — `tile_00.png`: a continuous multi-hue wave (blue→lavender→pink→magenta→orange) blending with no hard edge and no 3D blob, on a white ground — #3's recognition test verbatim, and §4's own disambiguator names Stripe as this family's archetype ("Stripe-class art direction"). A first draft tagged `high-key-airy` by impression; walking the ordered list, #3 fires 16 positions earlier — and `high-key-airy` fails its own test here (the headline is dark navy on white and the wave carries saturated magenta/orange, so contrast is not the scarcity). Kept visible as the worked proof that [ordered] must be walked, not recalled.
- **`stripe` `bento-grid`** — `tile_00` shows unequal expandable cells; `data.json#/bigImages` names `bento-terminal.png`, `payment-bento-background.jpg`, `ConnectBentoBackground.jpg`.
- **`stripe` `saas-marketing-site`** — **the `fintech` collision made concrete.** Stripe is a fintech company; the artifact is a SaaS marketing site. Under the brief's seed list it would take two values in a single-select dimension. This capture is why `fintech` was removed from `category` (§1).
- **`vercel` `coverline-block`** — `tile_00`: three short mono meta lines (`FOR CODING AGENTS / TO SHIP APPS AND AGENTS / AUTOMATED BY AGENTS`) sharing a common **left** edge with a ragged right, clustered as one block in the hero's right-edge zone but set clearly **inside** the trim, not flush to it. (An earlier draft claimed "right-aligned … at the trim edge" — both specifics were wrong against the tile and are corrected here.) The near-empty hero also passes `margin-drama`; under §6.0 step 2 the emptiness move yields to the element move, so `coverline-block` is the primary. (Set in mono — i.e. an editorial move executed with the lexicon's #1 tell face.)
- **`vercel` `mono-ink`** — paper-white + true black, no accent field: the palette fact, tagged as such. **`color-forward-palettes.md`'s baseline-reject describes this page**, which is nonetheless reference-grade — whether the restraint is earned is a rubric judgement, not a tag. See §10, C-2.

---

## 9 · Design-lexicon reconciliation — all 235 terms

**Enumerated from `scripts/design-lexicon.json#/terms`, not from the prose.** 235 terms, 235 unique `id`s, zero duplicates (verified: `new Set(ids).size === 235`).

> **Count correction (§10, C-6).** The brief specifies a **229**-term lexicon. The machine copy holds **235**. The markdown holds **205** bolded table rows, because several rows bundle multiple terms (e.g. the row `Behind-the-scenes candid / overhead tabletop scene / instant-film frame / specular highlight / vignette` is 5 terms in 1 row). Reconciled against **235** per the brief's own instruction to enumerate from the JSON. None of 229/205/235 agree; 235 is the number a consumer actually loads.

### 9.1 Result

| | Count |
|---|---|
| **Mapped** into the taxonomy | **160** |
| **Consciously dropped** | **75** |
| **Total** | **235** ✅ |

**Mapped, by destination**

| Destination | Terms |
|---|---|
| `signature-move` | 113 |
| `type-personality` | 25 |
| `palette-family` | 14 |
| `layout-archetype` | 6 |
| `pasona-arc` | 2 |
| **Total** | **160** |

**Dropped, by reason**

| Code | Reason | Terms |
|---|---|---|
| **D1** | **Generative-only** — a build-side instruction ("write this before tokens", "verify the webfont painted"). Carries no distinction *between* exemplars, so it cannot be a tag on one. | 10 |
| **D2** | **Not observable in stills** — needs video/interaction. The corpus holds only still tiles: `capture.json` records `{url,status,title,pageHeight,bodyTextLen,imageCount,tiles,coveredHeight,maxTiles,outDir}` — **no motion trace of any kind**. Tagging these would be fabrication. | 24 |
| **D3** | **Subsumed** — a sub-token or craft detail a mapped dimension already implies, or too fine to decide in 5s. Each row below names where the distinction lives. | 32 |
| **D4** | **Negative knowledge** — a ban list, not a property an exemplar *has*. Owned by `references/anti-ai-tells.md`'s tell IDs; this taxonomy deliberately does not fork that vocabulary. | 1 |
| **D5** | **Hygiene-universal** — present in essentially every competent exemplar; zero discriminating power at retrieval. | 8 |
| | **Total** | **75** |

### 9.2 Typography (52 → 41 mapped / 11 dropped)

| Term id | Disposition |
|---|---|
| `grotesque-sans` | → `type-personality:grotesque-workmanlike` |
| `neo-grotesque` | → `type-personality:neo-grotesque-neutral` |
| `humanist-sans` | → `type-personality:humanist-warm` |
| `geometric-sans` | → `type-personality:geometric-sans-clean` |
| `old-style-serif` | → `type-personality:garalde-bookish` |
| `transitional-serif` | → `type-personality:transitional-authority` |
| `didone` | → `type-personality:didone-glamour` |
| `slab-serif` | → `type-personality:slab-vernacular` |
| `clarendon` | → `type-personality:slab-vernacular` *(merged — see §5 disambiguator)* |
| `fat-face` | → `type-personality:fat-face-shout` |
| `reverse-contrast` | → `signature-move:reverse-contrast-header` |
| `blackletter` | → `type-personality:blackletter-heraldic` |
| `brush-script` | → `type-personality:script-hand` |
| `stencil-face` | → `type-personality:stencil-utility` |
| `ink-trap` | → `type-personality:ink-trap-modern` |
| `engraved-caps` | → `type-personality:engraved-institutional` |
| `monospace` | → `type-personality:mono-machine` |
| `optical-sizing` | **D3** — typesetting craft *inside* a face; invisible at tag speed. Lives in `type-personality`. |
| `oldstyle-figures` | **D3** — figure style inside a face. Lives in `type-personality`. |
| `tabular-figures` | → `signature-move:ledger-figure-setting` |
| `small-caps` | → `signature-move:small-caps-label-system` |
| `hanging-punctuation` | **D3** — lives in `signature-move:pull-quote-display` (its recognition test). |
| `discretionary-ligatures` | **D3** — lives in `type-personality:custom-lettering`. |
| `swash-capitals` | **D3** — a glyph choice inside a face. Lives in `type-personality`. |
| `tight-not-touching` | **D3** — spacing craft. Lives in `type-personality`. |
| `negative-leading` | → `signature-move:negative-leading-block` |
| `narrow-editorial-measure` | → `layout-archetype:manuscript-page` *(it is that archetype's defining trait)* |
| `justified-block` | → `signature-move:justified-fineprint-block` |
| `rag-control` | **D3** — line-break craft; not decidable in 5s. Lives in `type-personality`. |
| `run-in-head` | → `signature-move:run-in-head` |
| `type-on-a-path` | → `signature-move:type-on-a-path-seal` |
| `rotated-spine-text` | → `signature-move:rotated-spine-text` |
| `mixed-face-ransom` | → `type-personality:mixed-face-ransom` |
| `variable-font-axis` | **D2** — an axis that *animates*; a still shows one instance. |
| `caps-rhythm` | **D3** — case rhythm. Lives in `type-personality`. |
| `custom-lettering` | → `type-personality:custom-lettering` |
| `myeongjo` | → `type-personality:myeongjo-literary` |
| `gothic-dodum` | → `type-personality:kr-gothic-classic` *(the modern Pretendard-class value, `kr-gothic-modern`, has no lexicon parent — §9.13)* |
| `gyeon-gothic` | → `type-personality:kr-gothic-shout` |
| `talnemo` | → `type-personality:talnemo-experimental` |
| `vertical-setting` | → `signature-move:vertical-setting` |
| `heritage-signboard` | → `type-personality:signboard-vernacular` |
| `gungseo` | → `type-personality:gungseo-court-brush` |
| `panbon` | → `type-personality:panbon-woodblock` *(the former three-way merge into one `kr-heritage-lettering` collapsed printed, brush-written and hand-painted forms — opposites on pointable axes; split per §5)* |
| `brush-calligraphy` | → `signature-move:brush-calligraphy-accent` |
| `hanja-garnish` | → `signature-move:hanja-garnish` |
| `mixed-script` | → `signature-move:mixed-script-typesetting` |
| `condensed-display` | → `signature-move:condensed-poster-display` |
| `type-as-container` | → `signature-move:type-as-container` |
| `kicker-done-right` | **D3** — lives in `signature-move:small-caps-label-system` (its correct form). |
| `rubrication` | → `signature-move:rubrication` |
| `named-face-stack` | **D1** — a production check ("verify the webfont painted"), not an exemplar property. |

### 9.3 Color (31 → 23 mapped / 8 dropped)

| Term id | Disposition |
|---|---|
| `analogous-palette` | **D3** — hue-wheel relationship; orthogonal to `palette-family`'s deployment axis (see §4 preamble). |
| `split-complementary` | **D3** — as above. |
| `tetradic` | **D3** — as above. |
| `duotone` | → `palette-family:duotone-photographic` |
| `tone-on-tone` | → `palette-family:tone-on-tone` |
| `jewel-tones` | → `palette-family:jewel-luxe` |
| `earth-clay-palette` | → `palette-family:earth-clay` |
| `acid-neon` | → `palette-family:acid-on-black` *(the term exists to fence this cliché; the family names it)* |
| `pastel-with-grit` | → `palette-family:pastel-with-grit` |
| `high-key-palette` | → `palette-family:high-key-airy` |
| `low-key-palette` | → `palette-family:low-key-nocturnal` |
| `color-blocking` | → `signature-move:color-blocking` |
| `flat-spot-color` | → `palette-family:flat-spot-color` |
| `international-klein-blue` | → `signature-move:ikb-immersion` |
| `signature-brand-color` | → `signature-move:signature-brand-color` |
| `overprint-multiply` | → `signature-move:overprint-multiply` |
| `muted-field-hot-accent` | → `palette-family:muted-field-hot-accent` |
| `chromatic-grays` | **D3** — a token-level discipline inside *any* family. Lives in `palette-family`. |
| `warm-paper-ground` | **D3** — a ground token shared by `ink-vermilion`/`earth-clay`/`high-key-airy`; the family already says it. |
| `warm-ink-black` | **D3** — every dark family implies tinted near-black. Lives in `palette-family`. |
| `obangsaek` | → `palette-family:kr-heritage-color` |
| `dancheong-palette` | → `palette-family:kr-heritage-color` *(merged)* |
| `natural-dye-hues` | → `palette-family:kr-heritage-color` *(merged)* |
| `desaturated-palette` | → `palette-family:earth-clay` *(the JSON def is a multi-hue base "pulled 30-60% toward gray, sage, clay, oatmeal, slate" — `tone-on-tone`'s test is single-hue, so an earlier mapping there was wrong by that value's own test; `earth-clay`'s test was widened to hold the gray-pulled kin. Source tension: §10, C-2)* |
| `palette-from-photograph` | → `signature-move:palette-from-photograph` |
| `oklch-ramp` | **D1** — a token-engineering method. `color-forward-palettes.md` states outright that chroma "is not recoverable from a screenshot"; an exemplar has no source tokens (`SCHEMA.md` GAP-02). |
| `simultaneous-contrast` | **D3** — a perceptual effect, not a deployment. Lives in `palette-family`. |
| `equiluminant-vibration` | → `signature-move:equiluminant-vibration` |
| `selective-color` | → `signature-move:selective-color` |
| `teal-orange-grade` | → `signature-move:filmic-color-grade` *(merged)* |
| `film-stock-color` | → `signature-move:filmic-color-grade` *(merged)* |

### 9.4 Layout (38 → 31 mapped / 7 dropped)

| Term id | Disposition |
|---|---|
| `manuscript-grid` | → `layout-archetype:manuscript-page` |
| `column-grid` | **D5** — every multi-section page has one. |
| `modular-grid` | **D5** — as above. |
| `baseline-grid` | **D5** — as above. |
| `broken-grid` | → `signature-move:broken-grid-violation` |
| `asymmetric-balance` | → `signature-move:asymmetric-hero` |
| `rule-of-odds` | **D3** — a grouping heuristic inside a section. Lives in `signature-move`. |
| `rabatment` | → `signature-move:rabatment-placement` |
| `golden-section` | **D3** — a ratio; not decidable by eye in 5s. Lives in `signature-move:asymmetric-diptych`. |
| `full-bleed` | → `signature-move:full-bleed-hero` *(when it is the whole artifact, `layout-archetype:full-bleed-canvas` applies instead)* |
| `margin-drama` | → `signature-move:margin-drama` |
| `cross-gutter-overlap` | → `signature-move:cross-gutter-overlap` |
| `diagonal-axis` | → `signature-move:diagonal-axis` |
| `scale-drama` | → `signature-move:scale-drama` |
| `bento-escape` | → `layout-archetype:bento-grid` |
| `z-pattern` | **D5** — hygiene; the lexicon rates it LOW itself. |
| `f-pattern` | **D5** — as above. |
| `whitespace-asset` | → `signature-move:margin-drama` *(merged — an ambiguous pair resolved: both name "deliberate emptiness as the statement")* |
| `text-runaround` | → `signature-move:text-runaround` |
| `magazine-cover-logic` | → `layout-archetype:magazine-cover` |
| `editorial-spread-layout` | → `layout-archetype:editorial-spread` |
| `editorial-spread-logic` | → `signature-move:cross-section-continuity` |
| `pull-quote` | → `signature-move:pull-quote-display` |
| `marginalia` | → `signature-move:marginalia` |
| `toc-device` | → `signature-move:toc-device` |
| `folio` | → `signature-move:toc-device` *(merged — folio numbering is the TOC device's page-side half)* |
| `masthead` | → `signature-move:masthead` |
| `deck-standfirst` | → `signature-move:deck-standfirst` |
| `drop-cap` | → `signature-move:drop-cap` |
| `interview-qa` | → `signature-move:interview-qa` |
| `contact-sheet-device` | → `signature-move:contact-sheet` |
| `catalog-plate` | → `signature-move:catalog-plate` |
| `footnote-apparatus` | → `signature-move:footnote-apparatus` |
| `caption-discipline` | → `signature-move:caption-discipline` |
| `colophon` | → `signature-move:colophon` |
| `bleed-crop` | → `signature-move:bleed-crop` |
| `asymmetric-diptych` | → `signature-move:asymmetric-diptych` *(when it is the page's spine, `layout-archetype:split-screen` applies instead)* |
| `coverline-block` | → `signature-move:coverline-block` |

### 9.5 Motion (22 → 1 mapped / 21 dropped)

**All D2 except one.** This is the single largest drop block and it is a corpus fact, not an opinion: nothing on disk records motion.

| Term id | Disposition |
|---|---|
| `sticky-element` | → `layout-archetype:sticky-rail-detail` *(a pinned rail **is** visible in a still)* |
| `ease-out-expo` · `spring-overshoot` · `anticipation` · `follow-through` · `stagger-cascade` · `mask-reveal` · `scroll-scrubbed` · `scrollytelling-pinned` · `marquee-ticker` · `count-up` · `restrained-parallax` · `hover-micro-state` · `morph-flip` · `kinetic-type` · `ken-burns` · `duration-hierarchy` · `linear-easing-mechanical` · `split-text-reveal` · `blur-up-load` · `scroll-choreography` · `dolly-in` | **D2** ×21 |

**Extension point (not built — the corpus cannot fill it).** If Stage 2 adds video capture or a motion trace, `motion-signature` is the dimension to add, and these 21 are its value set. A dimension no capture can populate would be exactly the "field nothing can populate" failure `SCHEMA.md` §1 exists to prevent.

### 9.6 Film (17 → 13 mapped / 4 dropped)

| Term id | Disposition |
|---|---|
| `establishing-shot` | → `signature-move:establishing-shot` |
| `extreme-close-up` | → `signature-move:macro-material-crop` *(merged)* |
| `insert-shot` | → `signature-move:insert-shot` |
| `rule-of-thirds` | **D3** — composition hygiene inside a photo. Lives in the photo moves. |
| `leading-lines` | **D3** — as above. |
| `shallow-dof` | → `signature-move:shallow-dof-portrait` |
| `rack-focus` | **D2** — a focal plane that *shifts*. |
| `chiaroscuro` | → `signature-move:chiaroscuro-portrait` |
| `jump-cut-rhythm` | → `signature-move:jump-cut-rhythm` |
| `match-cut` | → `signature-move:match-cut` |
| `montage-sequence` | → `signature-move:montage-mosaic` |
| `dutch-angle` | → `signature-move:dutch-angle` |
| `anamorphic-flare` | **D3** — a lens artifact inside a photo; subsumed by `filmic-color-grade`. |
| `practical-light` | → `signature-move:practical-light` |
| `halation` | → `signature-move:halation` |
| `letterbox` | → `signature-move:letterbox-still` |
| `end-credits` | → `signature-move:end-credits` |

### 9.7 Photography (33 → 28 mapped / 5 dropped)

| Term id | Disposition |
|---|---|
| `rembrandt-lighting` | → `signature-move:rembrandt-portrait` |
| `rim-light` | → `signature-move:rim-light-product` |
| `hard-soft-light` | **D1** — a set-wide consistency instruction ("set once so the set feels art-directed"), not a nameable element. |
| `golden-hour` | → `signature-move:golden-hour-close` |
| `blue-hour` | → `signature-move:blue-hour-scene` |
| `low-key-lighting` | **D3** — subsumed by `palette-family:low-key-nocturnal`. |
| `high-key-lighting` | **D3** — subsumed by `palette-family:high-key-airy`. |
| `flat-lay` | → `signature-move:flat-lay-knolling` |
| `knolling` | → `signature-move:flat-lay-knolling` *(merged)* |
| `hero-product-macro` | → `signature-move:macro-material-crop` *(merged)* |
| `environmental-lifestyle` | → `signature-move:environmental-lifestyle` |
| `in-situ-mockup` | → `signature-move:in-situ-mockup` |
| `still-life-tabletop` | → `signature-move:still-life-cast-shadow` |
| `direct-flash-snapshot` | → `signature-move:direct-flash-snapshot` |
| `negative-space-photography` | → `signature-move:negative-space-photography` |
| `reportage-photography` | → `signature-move:reportage-proof` |
| `bw-reportage` | → `signature-move:bw-reportage` |
| `instant-film-frame` | → `signature-move:instant-film-frame` |
| `scanography` | → `signature-move:archival-ephemera-scan` *(merged)* |
| `dragged-shutter` | → `signature-move:dragged-shutter` |
| `overhead-tabletop-scene` | → `signature-move:overhead-process-table` *(split back out of `flat-lay-knolling`: 90° overhead is the shared, non-discriminating axis — overlap/crumbs vs knolled order are opposite registers, and the JSON defs say so)* |
| `hands-in-frame` | → `signature-move:hands-in-frame` |
| `behind-the-scenes-candid` | → `signature-move:behind-the-scenes-candid` |
| `specular-highlight` | **D3** — a material finish inside a photo. Lives in `signature-move:still-life-cast-shadow` / `rim-light-product`. |
| `color-gel-lighting` | → `signature-move:color-gel-field` |
| `seamless-sweep` | → `signature-move:seamless-sweep` |
| `prop-styling` | → `signature-move:prop-styling` |
| `silhouette-contre-jour` | → `signature-move:silhouette-contre-jour` |
| `vignette` | **D3** — an optical finish. Lives in the photo moves. |
| `double-exposure` | → `signature-move:double-exposure` |
| `archival-ephemera` | → `signature-move:archival-ephemera-scan` |
| `mixed-media-collage` | → `signature-move:mixed-media-collage` |
| `hand-drawn-annotation` | → `signature-move:hand-drawn-annotation` |

### 9.8 Branding (11 → 4 mapped / 7 dropped)

| Term id | Disposition |
|---|---|
| `brand-world` | **D1** — "write 5 lines of the world" before building. A brief input. |
| `art-direction` | **D1** — "write '이 페이지는 ___처럼 보인다' before tokens". A brief input. |
| `visual-identity` | **D1** — an *audit test* ("hide the logo"). Used as the recognition test for `signature-move:none-authored`, but not itself a tag. |
| `graphic-motif` | → `signature-move:graphic-motif` |
| `tone-of-voice` | **D1** — a copy instruction. |
| `tagline-descriptor` | **D3** — lives in `signature-move:deck-standfirst` (hero lockup hierarchy). |
| `iconography-system` | → `signature-move:icon-system` |
| `illustration-language` | → `signature-move:illustration-language` |
| `texture-library` | **D1** — a brand-asset production practice ("assemble once per brand"). |
| `flexible-identity` | **D2** — needs the system across *many* artifacts; one record cannot show it. |
| `monogram-seal-system` | → `signature-move:monogram-seal-system` |

### 9.9 Web-UI (7 → 2 mapped / 5 dropped)

| Term id | Disposition |
|---|---|
| `hero-thesis` | **D1** — "write the sentence before visuals". A brief input. |
| `above-the-fold` | **D5** — the lexicon rates it LOW/hygiene itself. |
| `thumb-zone` | **D5** — as above. |
| `sticky-buy-bar` | → `signature-move:sticky-buy-bar` |
| `section-rhythm` | **D1** — "score section volumes **before building**". A planning practice; whether a page's rhythm is *good* is a rubric judgement (`review-rubric.md`), not a tag. |
| `focal-hierarchy` | **D5** — a per-viewport QA check. |
| `anchor-navigation` | → `signature-move:toc-device` *(merged)* |

### 9.10 Korean commerce (15 → 8 mapped / 7 dropped)

| Term id | Disposition |
|---|---|
| `pasona-framework` | → `pasona-arc` *(structural — the one term of the 160 that resolves to a **dimension**, not a value: it is the dimension's parent frame. Counted as mapped because the dimension is its landing site.)* |
| `hook-open` | **D3** — an arc *stage*. Lives in `pasona-stage:problem` / the lexicon's own `sectionArcs`. |
| `empathy-section` | **D3** — lives in `pasona-stage:affinity`. |
| `solution-reveal` | **D3** — lives in `pasona-stage:solution`. |
| `proof-stack` | **D3** — a section-level arc beat; lives in `sectionArcs#/detail`. |
| `cta-placement-rhythm` | **D3** — lives in `pasona-stage:action`. |
| `maker-story` | **D3** — an arc stage (Wadiz-mandated); lives in `sectionArcs#/wadiz`. |
| `trust-badges` | → `signature-move:trust-badge-row` |
| `reward-tiers` | → `signature-move:reward-tier-ladder` |
| `comparison-table` | → `signature-move:honest-comparison-table` |
| `smart-store-tells` | **D4** — an explicit ban list ("red timers, rainbow badges, 형광 강조, 100% 만족"). Owned by `anti-ai-tells.md`. |
| `rationed-en-label` | → `signature-move:rationed-en-label` |
| `29cm-pt-format` | → `pasona-arc:non-pasona-editorial` |
| `cut-out-nukki` | → `signature-move:nukki-cutout` |
| `calm-fact-deadline` | → `signature-move:calm-fact-deadline` |

### 9.11 Material-texture (9 → 9 mapped / 0 dropped)

| Term id | Disposition |
|---|---|
| `film-grain` | → `signature-move:film-grain-field` |
| `halftone` | → `signature-move:halftone-treatment` |
| `uncoated-paper` | → `signature-move:uncoated-paper-overlay` |
| `risograph` | → `signature-move:risograph-misregistration` |
| `cmyk-misprint` | → `signature-move:cmyk-misprint` |
| `grain-gradient` | → `signature-move:grain-gradient` |
| `letterpress-impression` | → `signature-move:letterpress-impression` |
| `hard-offset-shadow` | → `signature-move:hard-offset-shadow` |
| `texture-close-up` | → `signature-move:texture-close-up` |

### 9.12 Arithmetic check

| Domain | Total | Mapped | Dropped |
|---|---|---|---|
| typography | 52 | 41 | 11 |
| color | 31 | 23 | 8 |
| layout | 38 | 31 | 7 |
| motion | 22 | 1 | 21 |
| film | 17 | 13 | 4 |
| photography | 33 | 28 | 5 |
| branding | 11 | 4 | 7 |
| ui | 7 | 2 | 5 |
| korean-commerce | 15 | 8 | 7 |
| material-texture | 9 | 9 | 0 |
| **Total** | **235** | **160** | **75** |

Domain totals verified against `design-lexicon.json` (`keyword-picker.js domains` reports the same split). 160 + 75 = 235. Every term is accounted for exactly once.

### 9.13 Reverse reconciliation — taxonomy values with **no** lexicon parent

The reconciliation runs both ways; these are the lexicon's blind spots, not silent inventions.

| Value | Source | Why it exists |
|---|---|---|
| `signature-move:product-ui-hero-render` | **Gap-fill** | See §10, C-4. |
| `signature-move:committed-saturated-field` | SKILL.md §2 | "A committed saturated color field CAN be the signature." |
| `signature-move:none-authored` | This taxonomy | See §10, C-5. |
| `palette-family:ai-purple-gradient` · `acid-on-black` | SKILL.md §2 banned-defaults | Named clichés the corpus contains (§8). |
| `palette-family:iridescent-wash` · `dark-neutral-ui` · `mono-ink` · `dark-field-hot-accent` | color-forward-palettes.md + captures | Families the corpus contains that the lexicon's colour shelf does not name. `dark-field-hot-accent`: dark graphic ground + one hot non-lime accent field — the Raycast/dev-tool family that neither `low-key-nocturnal` (needs a photographed dark) nor `dark-neutral-ui` (forbids accent fields) could legally hold. *(The former `monochrome-timid` was removed — see §4 disambiguators and §10, C-2.)* |
| `type-personality:kr-gothic-modern` | captures + corpus target | Split from the 돋움 class: the KR web's current default display face (Pretendard / 스포카한산) is not the `gothic-dodum` the lexicon names, and the KR-majority corpus Stage 2 will build needs the two separable. |
| `category` · `layout-archetype` · `platform-width` · `awareness` · `sophistication` values | SKILL.md, korean-detailpage.md, captures | The lexicon is a *technique* vocabulary; it never described artifacts. |

---

## 10 · Findings

Things doing this work surfaced. **C-3 needs an owner decision — I did not resolve it.**

- **C-1 · `band-stack` is a residue bucket.** It takes 3 of 6 captures and will be the plurality at 120. It stays because it is *true*; discrimination is expected from `signature-move` + `palette-family` + `type-personality`, not from the spine. If Stage 2 finds `band-stack` over ~40% of the corpus, the fix is to split it by *rhythm* (uniform vs scored) — deliberately not done now, because "is the rhythm scored?" is a quality judgement and would inject noise at tag time.

- **C-2 · The tension between two references is narrow — an earlier draft of this finding overstated it, and the fix it produced was removed.** Verified against the files: the `anti_ai: HIGH` rating for `desaturated-palette` lives in `scripts/design-lexicon.json` (the markdown lexicon has **no** such row; its only desaturation-adjacent row is a different term, `muted-field-hot-accent`), and the JSON term is a whole-page desaturated **multi-hue base** ("pulled 30-60% toward gray, sage, clay, oatmeal, slate"), while `color-forward-palettes.md:54` rejects a desaturated **accent** (chroma < 0.06) presented as the identity — different claims, **not a contradiction**; CFP's own palette #3 ships a clay surface at chroma 0.03 beside a committed persimmon field, i.e. CFP permits what the lexicon recommends given one committed field. The residual, real tension: the lexicon recommends a whole-page desaturated base, while CFP:53 says single-hue/monochrome may be "ONE supporting band, never the whole page" — and even that is imperfect, because `desaturated-palette` is multi-hue. **No shipped-doc fix is owed to either reference.** This file's former answer — splitting *earned* near-mono (`mono-ink`) from *default* near-mono (`monochrome-timid`) — asked a tagger to judge intent, not see a fact, and was **removed**: near-mono is one value (`mono-ink`), and the earned-vs-default verdict is a rubric field for `SCHEMA.md` to place (G1.8 handoff; see §4 disambiguators). **`vercel` is the live case**: near-neutral, no saturated field, reference-grade — tagged `mono-ink` as a fact; its quality lives in the rubric.

- **C-3 · `category` collides with the already-written `SCHEMA.md`. Owner decision.** G1.1 landed first and types `category` as a **subject sector** (`"ai-digital"`), plus separate `family` (`"wadiz"`, dir layout) and `mode` (`"detail"`). This brief mandates `category` as an **artifact type** (landing / SaaS / e-commerce / …). Same key, two different dimensions. I own values, not fields, and I may not edit `SCHEMA.md` — so I have **not** resolved this. Two options, for whoever does:
  1. **Keep `category` = artifact type (this file)** and give SCHEMA's sector value a new key — `sector` — which *no goal currently owns*. Cleanest: `mode` and `family` then become largely derivable from `category`.
  2. **Rename this dimension** `artifact-type` and leave SCHEMA's `category` as sector. Costs a rename in both files.
  Recommendation: **option 1**. `mode`/`family` already carry the coarse split SCHEMA needs, and "ai-digital" is genuinely a sector, not an artifact.

- **C-4 · The lexicon has no positive term for a product-UI hero render.** It names only the *ban* ("repeated browser-chrome mockups", "flat vector mockups") and the *cure* (`in-situ-mockup`). Yet `linear` — the corpus's strongest SaaS exemplar — is built entirely on that move, executed superbly. One gap-fill value (`product-ui-hero-render`) was added and flagged rather than force-fitting `in-situ-mockup` (which is false: Linear's renders are not composited into real photographed devices).

- **C-5 · Both Wadiz captures tag `signature-move:none-authored`.** Their memorable elements are two of SKILL.md §2's *named banned defaults* — acid-lime-on-black (`400620`) and AI-purple + glossy 3D blob (`403454`). Both are real top-sellers (3.7억 / 2.9억). Two consequences: (a) a corpus must be able to store negative exemplars, which is why `palette-family` enumerates clichés; (b) naming the *tells* is `anti-ai-tells.md`'s job — the taxonomy points at it rather than forking a second tell vocabulary. If records should carry tell IDs, that is a `SCHEMA.md` field referencing `anti-ai-tells.md`, not a dimension here.

- **C-6 · The lexicon is 235 terms, not 229.** Machine copy: 235 terms, 235 unique ids. Markdown: 205 bolded rows (rows bundle terms). The brief says 229. No two of the three agree. Reconciled against 235 per the brief's own "use the JSON to enumerate exactly" instruction. **The 229 figure in the roadmap appears to be stale** — worth correcting upstream, since it is the number used to size this goal.

- **C-7 · 24 of 235 terms are untaggable today (D2).** Not a judgement call: `capture.json` records no motion field of any kind, and both capture scripts emit still tiles. The whole `motion` domain is dark. `motion-signature` is the named extension point (§9.5); the dimension was **not** added, because a dimension nothing can populate is the failure `SCHEMA.md` §1 is built to prevent.

- **C-8 · `mood` needs no reconciliation** — it *is* `design-lexicon.json#/moods`, adopted verbatim (33/33). Zero collision with `keyword-picker.js` by construction, and a record's moods feed `plan --moods` untranslated.

- **C-9 · Platform chrome nearly corrupted two tags.** At desktop, both Wadiz captures render as a scrolling story column beside a **sticky reward rail** — which would tag `layout-archetype:sticky-rail-detail`. That rail is Wadiz's, not the maker's. Hence rule 3. Without it, every Wadiz record in the corpus would have recorded the platform's design instead of the exemplar's. (`SCHEMA.md` reaches the same conclusion from the field side — its GAP-07 note reads "Reward sidebar is Wadiz platform chrome, not campaign design".)

---

## 11 · Interop notes for `SCHEMA.md`

Recorded because SCHEMA.md and this taxonomy must interoperate. This is a map: where it does not map, that is C-3.

| `SCHEMA.md` reference | Status here |
|---|---|
| `<TAXONOMY.category>` | ⚠️ **Collision — C-3.** Different dimension, same key. |
| `<TAXONOMY.layout_archetype>` | ✅ §2 `layout-archetype`. Case only (this file is kebab-case per the brief; SCHEMA is snake_case). Use `image-band-scroll`; the stale `"long-scroll-image-band"` example was corrected in SCHEMA. |
| `<TAXONOMY.awareness>` | ✅ §7.4, verbatim. |
| `sophistication` (§7 brief shape) | ✅ §7.5. |
| `moods[]` (§7 brief shape) | ✅ §3, verbatim from the lexicon. |
| `<TAXONOMY.pasona_stage>` | ✅ §7.3 `pasona-stage` — added for this consumer. |
| `<TAXONOMY.signature_family>` | ✅ Use the §6 **shelf keys**: `type` · `layout-editorial` · `photo-film` · `color-material` · `brand-commerce` · `none`. `none-authored` is a specific `signature-move` inside the `none` shelf, so SCHEMA's coarse-family example uses `"none"`. |
| `<TAXONOMY.recurrence>` | ❌ **Not owned here.** Not in this goal's brief; no value set defined. |
| `<TAXONOMY.hue_family>` · `<TAXONOMY.temperature>` · `<TAXONOMY.weight_contrast>` | ❌ **Not owned here.** Not in this goal's brief. |
| `<TAXONOMY.tile_format>` · `<TAXONOMY.color_fidelity>` | ❌ **Not owned here** — and arguably not design taxonomy at all: they are capture-ingest enums (`jpeg`/`png`, `degraded`/`lossless`) that `SCHEMA.md` derives itself. |
| `mode` · `family` | ❌ Not owned here. `mode` is SKILL.md §1's landing/detail split; `family` is a corpus dir fact. |

---

Sources, first-party, read 2026-07-17: `scripts/design-lexicon.json` (235 terms) · `scripts/keyword-picker.js` (moods, sectionArcs, scoring) · `references/design-lexicon.md` · `references/korean-detailpage.md` (PASONA, Schwartz, platform widths) · `references/color-forward-palettes.md` · `SKILL.md` §1–§3 · `references/captures/{400620,403454,app-ui/{linear,raycast,stripe,vercel}}` (tiles + `data.json` + `bodytext.txt` + `capture.json`) · sibling `corpus/SCHEMA.md`.
