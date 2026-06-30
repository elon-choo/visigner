---
name: brand-identity
description: Turn a business or product into a coherent brand — strategy first (positioning, audience/JTBD, archetype, values, a one-line brand idea), then a verbal identity (voice & tone, messaging hierarchy, naming, tagline, lexicon) and a visual identity (logo direction, strategy-grounded color, type system, imagery/illustration art direction, iconography, motion & sonic signature), packaged as brand tokens + a guidelines doc that every other design skill applies. Auto-invoke when the task is about a BRAND as a system, not a single screen: "make a brand / brand identity / branding", "brand strategy", "positioning", "naming / name my company / product name", "tagline / slogan", "brand voice / tone of voice", "logo direction / brand mark / wordmark", "brand guidelines / brand book / 브랜드 가이드라인", "brand values / mission / personality / archetype", "rebrand / refresh our brand", "make this feel like a real brand, not generic"; Korean: "브랜드 만들어줘", "브랜딩", "포지셔닝", "네이밍 / 이름 지어줘", "슬로건 / 태그라인", "브랜드 보이스 / 톤앤매너", "로고 컨셉 / 로고 방향", "브랜드 아이덴티티", "브랜드 무드", "리브랜딩". Owns the source-of-truth brand system; hands tokens to design-system, and on-brand application to ui-design, detail-page, frontend-build, and marketing-conversion. NOT for building a specific page or app screen (use detail-page / ui-design) — this defines the rules those skills obey.
---

# Brand Identity — strategy → verbal & visual system

A brand is not a logo. It is the **smallest set of decisions** that makes every future artifact predictable: a stranger who has seen three of your touchpoints can guess the fourth. The deliverable here is that decision set — strategy at the core, verbal and visual systems wrapped around it, compiled into **tokens + a guidelines doc** the rest of the suite consumes. The failure mode to beat is the same one detail-page fights — **distributional convergence**: asked for "a brand", a model emits the high-probability center (swoosh mark, purple gradient, "we're passionate about innovation", a thesaurus-mashup name). Every step below pushes *away* from that center with named choices and negative constraints.

Build strategy → verbal → visual in that order. Visual decisions you make before strategy are decoration; you will redo them. Do steps 1–3 mostly in thinking; only surface the strategy to the user once it is provably specific to *this* business.

## The brand-build loop (never skip a step)

```
1 INTAKE    → the business reality: what's sold, to whom, against whom, the founder's conviction, constraints (name? legacy assets? markets/languages?)
2 STRATEGY  → positioning (5 fields) + audience & JTBD + archetype (1 primary + 1 secondary) + 3–5 values + a positioning statement + the ONE-LINE brand idea
3 VERBAL    → voice (3–4 traits, each with do/don't) + messaging hierarchy (one-liner→elevator→boilerplate) + naming/tagline + lexicon (words we own / ban)
4 VISUAL    → DIRECT the logo + a strategy-grounded color system + type system + imagery/illustration art direction + iconography + motion & sonic signature
5 SYSTEM    → compile to brand.tokens.json (DTCG) + write the guidelines doc (brand book structure below)
6 APPLY+VERIFY → flow tokens into design-system → ui-design/detail-page/frontend-build; run the coherence checklist + the competitor side-by-side; gate with design-critic
```
Iterate: if VERIFY (step 6) fails the "covers the logo, still us?" test, the gap is almost always upstream in STRATEGY, not in the hex values — go back to 2, not 4.

---

## 1 · Intake — extract the business reality

Before any creative move, pin these in one tight paragraph (ask only if genuinely unknowable; otherwise state your read and proceed):
- **What is actually sold** and the unit of value (a subscription? a 9-week cohort? a roasted-coffee bag?).
- **Who buys** and who *influences* the buy (specify a person, never "everyone" or "B2B SaaS companies").
- **Against whom** — the 2–3 real alternatives, including "do nothing" and the spreadsheet.
- **The founder's conviction** — the one belief about the world that made them start. This is the seed of the brand idea; mine it hard.
- **Constraints** — existing name/legacy equity to keep, required markets/languages (Korean + English changes naming and type), regulated category, channel mix (retail shelf vs app store vs Wadiz).

Ground everything that follows in this world's real materials, vocabulary, and artifacts — that is where non-generic choices come from (same principle as detail-page's "ground the hero in the subject"). Check memory for any prior brand work for this user before starting.

---

## 2 · Strategy — the load-bearing layer

### Positioning — fill all five, each in one sentence
| Field | The question | Test it must pass |
|---|---|---|
| **Frame of reference** | What category does the customer file you under? | If the category is crowded, *reframe* to a category you can lead (Liquid Death = "entertainment", not "water"). |
| **Target** | The one person, specifically. | A real human you could name; "everyone" = no one. |
| **Point of difference** | The single thing you are/do that they aren't. | True · Relevant to the JTBD · Defensible (hard to copy) — all three. |
| **Reason to believe** | Why the difference is credible. | A proof artifact: a mechanism, a metric, an origin, a guarantee — not an adjective. |
| **Customer's JTBD** | The job they "hire" you for (functional + emotional + social). | Phrase as "When I ___, I want to ___, so I can ___." |

### Brand personality via archetype — pick **1 primary + 1 secondary**
Archetype-less mood-boarding is the #1 cause of incoherent brands. Choose from the 12 (Jung / Mark & Pearson). Primary sets the default voice and color temperature; secondary adds tension so you're not a cliché of the primary.

| Archetype | Core desire | Voice cue | Color lean | Exemplar |
|---|---|---|---|---|
| **Innocent** | safety, simple goodness | optimistic, plain, wholesome | soft, light, airy | Dove, Coca-Cola |
| **Everyman** | belonging | friendly, down-to-earth, inclusive | denim, earth, neutral | IKEA, Target |
| **Hero** | mastery, prove worth | bold, direct, motivational | strong primary, high contrast | Nike, Duracell |
| **Outlaw** | liberation, disruption | provocative, irreverent | black + a violent accent | Harley-Davidson, Liquid Death |
| **Explorer** | freedom, discovery | rugged, authentic, restless | earth + sky | Patagonia, Jeep |
| **Creator** | make something of value | imaginative, expressive | a vivid, owned palette | LEGO, Adobe, Apple |
| **Ruler** | control, order, status | authoritative, polished, exclusive | deep tone + metal | Rolex, Mercedes, Amex |
| **Magician** | transformation | visionary, charismatic, a little mystical | indigo/violet (earn it) | Disney, Tesla |
| **Lover** | intimacy, connection | sensual, warm, intimate | red, blush, gold | Chanel, Aēsop |
| **Caregiver** | care, protect | nurturing, reassuring | soft blue/green | Volvo, Johnson's, TOMS |
| **Jester** | enjoyment, lightness | playful, witty, surprising | bright clash | Old Spice, Mailchimp |
| **Sage** | truth, understanding | measured, credible, precise | navy + neutral | Google, BBC, McKinsey |

State *why* this pair fits the strategy in one line (e.g. "Sage primary for trust in a fintech, Outlaw secondary so we don't sound like every other bank"). The pair constrains voice (step 3) and color temperature (step 4) — don't re-decide those from scratch.

### Brand values — 3 to 5, each falsifiable
A value is only real if it forces a trade-off you'd actually make. "Quality" and "Innovation" are not values (no one chooses the opposite). Write each as "We choose **X** over **Y**" — e.g. "We choose *fewer, slower releases* over feature parity." If the inverse is absurd, cut it.

### Two outputs that lock the strategy
**Positioning statement** (internal, Geoffrey Moore's template — fill the brackets):
> For **[target]** who **[JTBD / need]**, **[Brand]** is the **[frame of reference]** that **[point of difference]**. Unlike **[primary alternative]**, **[Brand]** **[reason to believe]**.

**The one-line brand idea** (the internal north star — *not* the tagline). 2–5 words capturing the strategic intent that every decision serves: Volvo = "safety", Disney = "fun family magic", Nike = "authentic athletic performance". The whole identity is this idea made visible and audible. If you can't write it, the strategy isn't done.

---

## 3 · Verbal identity

### Voice & tone — 3–4 traits, each with do/don't
Voice is the constant personality; tone flexes by context (a 404 vs a pricing page). Derive the traits from the archetype pair, then make each operational with a do/don't pair — a trait you can't show in a sentence is decoration. Use NN/g's four dials to place the voice: *funny↔serious, formal↔casual, respectful↔irreverent, enthusiastic↔matter-of-fact*.

| Trait | DO write | DON'T write |
|---|---|---|
| e.g. *Plainspoken* | "Your card is charged today. You can cancel anytime." | "We're thrilled to facilitate your seamless onboarding journey." |
| e.g. *Confident, not loud* | "This removes the step entirely." | "The most revolutionary, game-changing solution ever!" |
| e.g. *On the user's side* | "We'll remind you before it renews." | "Failure to cancel will result in charges." |

### Messaging hierarchy — three lengths, one truth
| Layer | Length | Job | Where it lives |
|---|---|---|---|
| **One-liner** | ≤ 10 words | what + for whom, instantly | site hero, app store subtitle, "what do you do?" |
| **Elevator** | ~ 30 words / 15 sec | one-liner + the differentiator + a proof | sales intro, about page, investor cold-open |
| **Boilerplate** | ~ 80 words | the canonical paragraph, reusable verbatim | press kit, footer, partner decks |

Each layer expands the one above with zero contradiction. Hands directly to **marketing-conversion** for funnel/CRO copy and to **detail-page** for the hero thesis.

### Naming (when naming is in scope)
Pick a name **type** deliberately, then validate before falling in love:

| Type | Example | Best when |
|---|---|---|
| Descriptive | General Motors | category clarity matters more than distinctiveness |
| Suggestive / evocative | Nike, Amazon | you want meaning + room to grow |
| Coined / abstract | Kodak, Häagen-Dazs | you'll spend to build meaning and own the trademark |
| Founder / origin | Disney, Ferragamo | provenance is the value |
| Compound | Facebook, Netflix | two plain words snap into a new idea |

**Validation gate (all must clear before you recommend a name):** exact + similar **trademark** in your classes — KIPRIS `kipris.or.kr` (Korea, KR + EN search) / USPTO TESS `tmsearch.uspto.gov` (US) / WIPO Global Brand DB `branddb.wipo.int` (international); domain via RDAP/`whois <name>.com` (or the category-credible TLD) obtainable; social handle on the 2 channels you'll actually use (check the live profile URLs, e.g. `instagram.com/<handle>`); a **linguistic check across every required market** (the name can't mean something dumb or offensive in KR/EN/etc.); say-it-out-loud and spell-it-on-the-phone test. These are read-only lookups — surface conflicts to the user; trademark *clearance* is counsel's call, not yours.

**Automate the conflict sweep with `name-check.js`** (built-in Node, no install, no key — a *report helper*, not a gate; always exits 0 except on usage error):
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/name-check.js <name> [out.json]   # name may be bare or include a TLD
#   --tlds com,io,app   pick the TLDs to probe (default .com/.co/.io)   |   --domains-only   skip handle/package probes
```
It writes `{ name, input, checkedAt, summary, conflicts:[{name, check, result, source, …}] }` (default `/tmp/name-check/conflicts.json`) where `result` is `taken | available | unknown | manual`: **domain** availability is authoritative via RDAP (`rdap.org/domain/<name>.<tld>` → 200 taken / JSON-404 available); **handle/package** probes (GitHub users, npm registry) are best-effort and degrade to `unknown` on 403/429/timeout; **trademark** has no reliable free API, so it always emits **4** `manual` rows with prefilled search URLs — USPTO/WIPO/EUIPO plus a `trademark:kipris` row (`kipris.or.kr`, the KR IP authority this skill's validation gate already names) for Korean clearance. **CAVEAT:** rdap.org's IANA bootstrap does **not** cover `.co`/`.io` (returns an html-404), so those report `unknown` ("no RDAP coverage for this TLD — check manually") — only `.com` resolves authoritatively today. Use it to triage; the manual trademark + linguistic checks above still gate the recommendation. Banned naming moves: thesaurus mashups, dropped-vowel startup spelling (`Tractr`, `Snptch`), `-ly`/`-ify`/`-able` suffix spam, random Latin, and any name that's just two industry nouns glued together.

### Tagline (external — distinct from the brand idea)
Patterns: **imperative** ("Just Do It") · **declarative value** ("Save money. Live better.") · **evocative fragment** ("Think different.") · **the reframe** ("Reassuringly expensive."). **The swap test gates it:** put a competitor's name in front of your tagline — if it's still true, it's generic; rewrite until it's true *only* of you.

### Lexicon — the words you own and ban
A one-page list, because consistency at the word level is what makes copy feel like one author: words we **own** (proprietary feature/tier names, the verbs we use for core actions), words we **ban** ("revolutionary", "seamless", "passionate", "world-class", "synergy", competitor product names as verbs), capitalization rules (is it "the App" or "the app"?), and how we say *yes/no/sorry*. Errors never apologize-and-vague; empty states invite action (same copy discipline as aesthetics.md).

---

## 4 · Visual identity

Apply the **two-pass token method** from `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/references/aesthetics.md` at the *brand* altitude: **Pass 1** plan a compact color/type/signature system derived from the archetype + brand idea; **Pass 2** re-derive what you'd produce for *any* brand in this category, and wherever yours matches that default, change it and say why. Don't re-explain OKLCH or the banned-fonts list — link aesthetics.md.

### Logo — DIRECT it, don't auto-emit one
Claude must **art-direct** the mark, not reflexively hand back an SVG swoosh. Process:
1. **Choose the form factor** from the strategy:

   | Form | What it is | Choose when | Example |
   |---|---|---|---|
   | **Logotype / wordmark** | the name, custom-set | the name is short & must be learned | Google, FedEx |
   | **Lettermark / monogram** | initials | the full name is long | HBO, IBM |
   | **Pictorial mark** | a literal symbol | a concrete thing represents you | Apple, Twitter bird |
   | **Abstract mark** | a non-literal symbol | you need a flexible, ownable glyph | Nike swoosh, Pepsi |
   | **Combination** | wordmark + mark, separable | you want both lockup and a standalone icon | Adidas, Burger King |
   | **Emblem** | text inside a contained shape | heritage/badge feel | Starbucks, Harley |

2. **Write a logo brief** (concept, the one idea it must encode, form factor, 3 adjectives from the archetype, what to avoid) and explore candidates — sketch directions in words, and/or generate visual options via the image pipeline in `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/references/asset-generation.md` (use it for *exploration*, then rebuild the chosen direction cleanly as vector). **No-key scaffold:** `gen-assets.js` has a deterministic, no-API `logo` archetype (it classifies any slot whose label/id matches `logo`/`wordmark`/`monogram`/`brandmark`/로고/심볼/워드마크 into it) that emits a real **on-grid construction SCAFFOLD** — an explicit 6×6 grid + center cross + bounding circle, optical-overshoot guides (solid cap/baseline + dashed overshoot lines), a one-module clear-space frame, a min-size+clear-space label, and a SELECTABLE starter mark: `monogram | wordmark | abstract`, chosen via the slot's `logoKind`/`logoStyle`/`variant` field, else a keyword in the label, else a deterministic hash. Optional slot fields: `word` (wordmark/monogram source — also falls back to `plan.brand.name`/`plan.brandName`) and `minSize` (px, default 24). **CJK / non-Latin names now scaffold correctly:** the no-key monogram takes the first *grapheme* via `Intl.Segmenter` (fallback `Array.from`) when no Latin letter/digit exists — so 고요 → 고 instead of the old literal "A" fallback (Latin brands are unchanged: first Latin char, uppercased). It is a starting *scaffold to redraw on the grid* (step §"Producing the logo as SVG"), never the shipped mark. To diverge hard before converging, spawn the **design-director** agent on the logo brief — it returns competing locked directions you pick from rather than a single convergent guess. A negative-space or dual-meaning idea (FedEx arrow) beats a literal icon.

   **Curated adapt-on-grid starters (higher-fidelity than the no-key scaffold):** `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/assets/logo-archetypes/` ships four hand-built on-grid marks to ADAPT (not ship as-is) — `monogram.svg` (geometric letterform 'A', even-odd counter + crossbar, apex/feet carry optical overshoot), `badge.svg` (enclosed ring + centred peak chevron, all-solid so it survives mono/knockout), `abstract.svg` (vesica/lens from two arcs with a knocked-out centre, minimal anchors), and `ligature-wordmark.svg` (geometric 'VA' ligature joined by a shared crossbar on a monoline wordmark frame with sidebearing ticks). All four share one construction grid (16×16 units, unit=32px; `viewBox 0 0 512 512`; intrinsic 512×512, so they slot into `logo-grid.html` as `<img>`; 2-unit/64px clear space → live area 64..448; cap line y=96 / baseline y=416 / x-height y=240; dashed overshoot guides y=90/422). **CRITICAL:** each wraps its guides in a `<g id="construction-grid">` (plus a dashed clear-space rect) — **DELETE that group for the shipped/production mark** (design-critic `MODE=logo` auto-FAILs if guides leak through). License: CC0 / public domain (noted in each `<desc>`); repo is MIT.
3. **Specify the system around it** so it survives the real world — these are the parts AI logos skip: **construction grid** (geometry, optical corrections — circles overshoot, so they're drawn slightly larger), **clear space** (= the cap-height or the mark's x-unit on all sides), **minimum size** (≈ 24px / 16mm so the mark stays legible), **color variants** (full, 1-color, knockout/reversed, mono for fax/engrave), and **misuse rules** (don't stretch, recolor, rotate, add shadow/gradient/outline, re-space, or place on a busy/low-contrast background). **Make min-size machine-checkable:** record it as a top-level `logo:{minWidth,minHeight}` (px) in `brand.tokens.json` — `brand-lint --brand` then checks any `<img>`/`<svg>` whose tag contains "logo" against those dimensions and flags an undersized or dimensionless logo (`logo-undersize` WARN), so the clear-space/min-size rule is enforced on built pages, not just stated in the brand book.
4. Verify the mark in ONE shoot with the **shipped verification sheet** — don't hand-author nine variants. `${CLAUDE_PLUGIN_ROOT}/skills/brand-identity/assets/logo-grid.html` is self-contained (no build step) and renders the full robustness matrix: **3 SIZE rows (24 / 64 / min px) × 3 COLOR rows (full-color / 1-color mono / knockout-on-dark) = 9 cells**, so the mono/knockout/small-size test is a single `shoot.js` pass. Color treatments are CSS-filter based (mono = grayscale+brightness(0); knockout = +invert(1) on a dark cell) so they work on **any** slotted SVG without re-authoring fills. Slot a candidate two ways: `?svg=/abs/mark.svg` (rendered as `<img>` — the mark SVG must carry intrinsic `width`/`height`; gen-assets logo SVGs do), OR inline (paste your `<svg>…</svg>` between the BEGIN/END SLOT markers in `<template id="mark">`; a default sample renders when no `?svg=` is given, so the sheet is never empty). Optional query params: `&min=16` (min-row px, default 16), `&name=Acme` (sheet title). Shoot it (write `CLAUDE_PLUGIN_ROOT` verbatim — the suite docs convention, no shell expansion):
   ```bash
   NODE_PATH=${CLAUDE_PLUGIN_ROOT}/skills/detail-page/node_modules \
     node ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/shoot.js "logo-grid.html?svg=/tmp/brand/mark.svg" /tmp/brand/shots
   # or just: bin/shoot "logo-grid.html?svg=/tmp/brand/mark.svg" /tmp/brand/shots   (wrapper resolves NODE_PATH)
   # read the tiles: legible at 24px? holds in 1-color? survives reversed on the dominant color?
   ```
   **Honest caveat:** a gen-assets logo SCAFFOLD (next bullet) includes a full surface-background rect, so its mono/knockout silhouette reads as a filled square — that is *correct* (a construction sheet is not a transparent final mark). A real transparent mark (like the sheet's built-in inline sample) shows its true silhouette.

### Producing the logo as SVG (not just directing it)
A Claude Code session **can author the chosen mark as clean, editable SVG by hand** — do it here; don't punt to "rebuild in Illustrator". Image-pipeline output is for *exploration only*; the shipped logo is hand-built vector.
1. **Construct on a unit grid.** Declare a `viewBox` you'll keep (e.g. `0 0 64 64`), lay the mark on a visible unit grid, and place every anchor on grid (or a stated half-unit). Apply the **optical corrections** from the direction: circles/triangles overshoot the cap line by ~1–2 %, the crossbar sits slightly above center, junctions are notched so ink doesn't pool. Keep **stroke contrast consistent** — pick one thick/thin ratio (e.g. 100/70) and hold it across every stem. Build with the fewest anchors that hold the curve; **`id`/`<title>` every path** (`mark-stem`, `mark-bowl`) and group `full` / `mark` / `logotype` so the file is editable, not a flattened blob.
2. **Author the logotype as outlined paths.** Set the name in the chosen display face, tune **tracking** for the lockup, then **convert to outline and hand-edit**: cut a custom ligature, square or clip a terminal, correct the optical sidebearings the font got wrong at logo scale. Keep the live-text version in a comment so the wordmark is re-settable. Mark + logotype stay **separable groups** for the combination lockup.
3. **Run the vector-native logo test (a raster gen can't pass this — SVG can).** Build one HTML sheet that `<img>`/inlines the SVG at **24px and 64px**, a **1-color (mono)** row via `fill:currentColor` on a single token, and a **knockout** row (white mark on the dominant brand surface). Assert each holds — anchors don't merge at 24px, the mark reads with all color removed, the knockout has no hairline gaps — then shoot it:
   ```bash
   NODE_PATH=$(npm root -g) node ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/shoot.js /tmp/brand/svg-test.html /tmp/brand/shots
   # mono row legible with zero color cues? knockout clean on the brand color? 24px not a smudge?
   ```
4. **Ship the logo package — crops, not just the master. One command does it: `logo-handoff.js`.** From the one `mark.svg`, `scripts/logo-handoff.js` emits the whole artboard SET — `full-color.svg`, `mono.svg` (1-color), `knockout.svg` (white-on-dark), `favicon.svg` (32px), `app-icon.svg` (512px, rounded/padded), `social-avatar.svg` (512px circle crop) — plus an `index.html` that inlines all six (it feeds the logo-grid sheet). Every board **nests the SAME source mark** (scaled via `preserveAspectRatio`, never redrawn) with clear-space + min-size baked in; mono/knockout are derived deterministically with an SVG `feColorMatrix` (any input color → a single-color silhouette preserving alpha), so they hold on any mark without re-authoring fills:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/logo-handoff.js /tmp/brand/mark.svg [out-dir]
   # default out-dir = <mark dir>/handoff ; output passes shoot.js (overall=true) + STATIC lint
   ```
   Re-shoot the emitted `index.html` to verify the set. (For a hand-built bespoke crop, the manual targets remain: favicon 16/32/48 `.ico`, app-icon 1024px with maskable padding, circular social-avatar — each min-size-tested in the sheet above.)
5. **Raster→SVG fallback (documented, never the final logo).** If you only have a raster exploration: **trace it** — vendored option `@neplex/vectorizer` (or `potrace`) to a draft, then **redraw on the grid** in step 1 (auto-trace output is a reference, not a deliverable — it carries jagged anchors and no optical correction). If the handoff must go to a GUI, produce the **Illustrator/Figma handoff file here** — artboards `full · mono · knockout · favicon`, each with the **clear-space frame and min-size label** baked in — so even the GUI handoff is authored in-suite, not improvised by the recipient.

### Color — grounded in strategy + emotion, not vibes
Start from the archetype's temperature and the brand idea, then commit to **one dominant brand color with a defensible reason** ("we own forest green because the product is the only carbon-negative one"), one sharp accent, and a neutral spine. Color psychology is a *starting heuristic, not law* (it's culture-bound — white = purity in the West, mourning in parts of Asia): use it to generate, then justify against strategy. A palette with **no dominant** (five timid equal pastels) reads generic — enforce 60-30-10, the 10% accent reserved for the primary action. Generate ramps in **OKLCH** (method in aesthetics.md). **Token mechanics live in the design-system skill** — produce primitives (the raw ramp) → semantic tokens (`brand/primary`, `brand/accent`, `text/default`) and hand those off; don't invent a parallel color config here.

The suite's `brand-lint` gate machine-checks the convergence default: it FLAGS any color at **OKLCH hue 255–310 with chroma > 0.04** as unearned `ai-purple` (the floor sits at 255, not 270, so the convergent SaaS indigo is caught too). That is on purpose — the only legitimate way past it is a **Magician** strategy with a stated reason, which you then record as an explicit override (`ALLOW_PURPLE=1`, or the inverse archetype rows in §2 produce hues that clear it cleanly). Verify your committed brand color isn't a reflex purple before you compile:
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/brand-lint.js /tmp/brand/swatch.html   # exits 1 on ai-purple / banned-font
```

### Type — the brand's voice made visible
Pick a **display** face (used with restraint for headlines/the wordmark feel) + a **body** face (+ a mono if technical), high contrast between them. The banned-fonts rule from aesthetics.md is **absolute at brand altitude**: never Inter/Roboto/Arial/Open Sans/Lato/system — a default font means you have no typographic identity. A brand typeface is an *asset*: confirm the **license** covers desktop + web + app + the markets you ship (and that a Korean face — e.g. Pretendard for body — exists if you sell in KR). Variable fonts let one family carry the whole weight range.

### Imagery & illustration art direction
Write rules concrete enough that a stranger could shoot/commission on-brand: photography **subject** (what's always/never in frame), **framing** (tight & human vs wide & architectural), **lighting** (hard editorial vs soft natural), **color grade** (warm/cool, contrast), and **post** (grain? duotone tied to the brand color?). For illustration, define the system: geometric vs organic, line weight, fill style, how it uses the palette. **Banned imagery (the stock tells):** the handshake, the diverse-team-laughing-at-a-laptop, the lens-flare hero, the isolated-on-white product with a fake reflection, generic gradient blobs. Give 3 "yes" and 3 "no" reference descriptions.

### Iconography
**One** set, consistent stroke weight and corner radius **matched to the brand's geometry** (a soft brand → rounded joins; a precise brand → sharp). Phosphor / Lucide / Radix as a base, or a custom set for flagship icons. Never mix sets; never use emoji as icons.

### Motion signature
Motion is brand: define one **signature easing curve** (a named `cubic-bezier`, not the default ease), a **duration scale** (e.g. 120/200/320ms), and one **signature transition** the product is remembered by (how the logo resolves, how a page enters). One orchestrated moment beats scattered micro-animations; always honor `prefers-reduced-motion`. frontend-build implements these as motion tokens.

### Sound & other touchpoints (when relevant)
If the brand lives in audio/physical space, specify a **sonic logo** (Netflix "ta-dum", Intel bong — 1–2 sec, derived from the brand idea), key UI sounds, and material/packaging/spatial cues. Skip if purely digital-screen.

---

## 5 · System — compile tokens + write the guidelines

**Tokens are the single source of truth.** Emit `brand.tokens.json` in **DTCG** format — the strategy-view handoff the **design-system** skill consumes: it carries your *decided* values (one dominant hue, one accent, the display/body faces, the signature easing, plus the idea/voice as text tokens). design-system then expands the single hue into the OKLCH ramp, adds the neutral spine and semantic layer, and runs the canonical compile. This file — not a PDF — is what makes "one source → everything on-brand" real.

```jsonc
// brand.tokens.json (DTCG) — strategy made machine-readable
{
  "brand": {
    "color":  { "primary": {"$value":"oklch(0.52 0.13 152)","$type":"color"},
                "accent":  {"$value":"oklch(0.74 0.17 65)", "$type":"color"} },
    "font":   { "display": {"$value":"Fraunces","$type":"fontFamily"},
                "body":    {"$value":"General Sans","$type":"fontFamily"} },
    "motion": { "ease-signature": {"$value":"cubic-bezier(.2,.8,.2,1)","$type":"cubicBezier"} },
    "idea":   {"$value":"reassuringly slow","$type":"text"},
    "voice":  {"$value":"plainspoken · confident-not-loud · on-your-side","$type":"text"}
  }
}
```
This is the **strategy view** with **bare** role names (`primary`, `accent`) — `brand-lint --brand` reads it (literal `oklch()`/`#hex` `$value`, a top-level `brand`/`color` wrapper, and `{alias}` refs all parse), but it is the *handoff to* design-system, **not** the file you point a built-page on-brand check at. design-system expands this single hue into the numbered OKLCH ramp (`primary-700`, `accent-500`, …) the page actually declares as `--brand-*`; the on-brand `--brand` check name-matches against **that compiled file** (§6 VERIFY). Use the strategy file to *feed* design-system; use the compiled file to *verify* the page.

**Brand guidelines doc — assemble it in one command: `brand-book.js`.** Once the tokens (and optionally a `voice.json` + the chosen mark) exist, `scripts/brand-book.js` emits ONE self-contained `guidelines.html` — palette swatches (the emit-tokens spec-sheet approach, OKLCH css, no hex), the type families + fontSize/lineHeight ramp, the logo on full-color / 1-color-mono / knockout-on-dark tiles (mono + knockout derived from the SAME mark via CSS filters), and — when `voice.json` is supplied — a Do/Don't grid + lexicon table. Deterministic, built-in modules only, shootable:
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/brand-book.js <brand.tokens.json> [out-dir] \
  [--voice voice.json] [--logo mark.svg|dir] [--name Brand]
# default out-dir = the tokens file's dir; voice.json read defensively (do|dos / dont|donts / lexicon|words|terms);
# --logo takes an svg or a dir (first *.svg); with no logo it draws a deterministic accent-color monogram from --name
#   (the no-logo monogram now takes the first GRAPHEME via Intl.Segmenter — same path as gen-assets.motifLogo —
#    so a Korean-only brand renders 고요 → 고, not a literal "B")
```
**It now renders swatches from a strategy-style token file too**, not just a compiled ramp: a bare role leaf (e.g. `primary`, `accent` with a literal `oklch()`/`#hex` `$value`, an `{alias}`, or structured components) is collected and drawn instead of dropped, so the §5 strategy-view `brand.tokens.json` produces a usable color page. But that strategy file has **no numbered ramps** (`primary-700`, …) — when zero numbered ramps are present `brand-book.js` prints a LOUD stderr warning and sets an additive `strategyFileWarning` JSON flag: **compile the strategy file through design-system first** to get the full ramp before treating the book as final. (Caveat, unchanged: `{color.x}` *alias* roles still don't resolve in the book — feed literal values or the compiled file for a complete palette.) Same split as the on-brand check below — render/verify the **compiled** ramp, use the strategy file only as the design-system input.
This is the assembly step for the deliverable below — author the strategy/verbal sections (which `brand-book.js` doesn't write), then run it to compile the visual system into a single openable doc. What a real brand book contains, in order:
1. **Brand idea + positioning statement + values** (the strategy, one page each).
2. **Personality & archetype** (the pair + the voice it implies).
3. **Verbal:** voice traits with do/don't, messaging hierarchy, lexicon, tagline usage.
4. **Logo:** all variants, construction grid, clear space, min size, the misuse gallery.
5. **Color:** primary/accent/neutrals with values, 60-30-10 ratios, accessible pairings.
6. **Type:** families, the scale, weight/role mapping, KR fallback.
7. **Imagery & illustration:** the yes/no references, treatment rules.
8. **Iconography, motion, sound.**
9. **Application examples:** the mark on a card, a screen, a social tile, packaging — proof it holds.

---

## 6 · Apply + Verify

### Apply — one source flows everywhere
```
brand.tokens.json  →  design-system  (compiles primitives→semantic, themes, dark mode, dev handoff)
        │                    │
        │                    ├─→  ui-design        (app/web UI obeys brand tokens & voice)
        │                    ├─→  detail-page       (hero thesis from messaging hierarchy; palette/type from tokens)
        │                    └─→  frontend-build     (Tailwind v4 @theme reads the SAME tokens; motion tokens)
        └─────────────────────→  marketing-conversion (copy obeys voice, lexicon, messaging hierarchy)
```
Never hand a downstream skill a loose hex or a vibe — hand it the tokens + the guidelines section it needs. If a page needs a color/voice not in the system, that's a **strategy gap**, fixed here, not patched downstream.

### BANNED — the generic-brand tells (override only with an explicit, stated reason)
- ❌ The **meaningless swoosh / generic abstract mark** that says nothing about the business — a mark must encode an idea, not "motion/connectivity in general".
- ❌ **"We're passionate about innovation / empowering people / world-class solutions"** voice — passes the swap test for any company = says nothing.
- ❌ The **AI-purple→blue gradient** as the brand color (the convergence default; aesthetics.md). Purple is earned only by a Magician strategy + concrete proof, not by reflex.
- ❌ **Archetype-less mood-boarding** — pretty tiles with no strategic spine; the board must serve the chosen archetype pair.
- ❌ A **palette with no dominant** (5 equal pastels) — no focal color, nothing owned.
- ❌ **Stock-photo handshake / laughing-laptop-team / lens-flare** imagery.
- ❌ **Thesaurus-mashup / dropped-vowel / two-noun-glue** naming.
- ❌ **Values that aren't trade-offs** ("Quality", "Integrity") and a **tagline that survives the swap test**.
- ❌ Treating the **logo as the brand** — shipping a mark with no voice, no system, no application rules.
- ❌ **Auto-traced raster shipped as the final logo** — `@neplex/vectorizer`/`potrace` output is a draft to redraw on the grid, never the deliverable (jagged anchors, no optical correction).
- ❌ A **logo that fails mono or knockout** — if it needs its colors/gradient to be readable, or breaks reversed on the brand surface, it isn't a logo yet.

### VERIFY — brand coherence checklist (gates "done")
- [ ] **Cover-the-logo test:** hide the wordmark across 3 touchpoints (a screen, a social tile, an email) — can you still tell it's the same brand from color/type/voice/imagery alone? If no, the system is too thin.
- [ ] **Competitor side-by-side:** place your hero/mark beside the 2 real alternatives from intake — capture their live sites and view the stitched tiles next to yours:
  ```bash
  ROOT=${CLAUDE_PLUGIN_ROOT}/skills/detail-page
  NODE_PATH=$(npm root -g) node $ROOT/scripts/capture-reference.js https://competitor-a.com /tmp/brand/ref-a
  MAX_TILES=120 NODE_PATH=$(npm root -g) node $ROOT/scripts/capture-reference-patchright.js https://competitor-b.com /tmp/brand/ref-b   # for 403/Akamai walls
  ```
  Does yours read as a *deliberate, different* point of view, or as the same category template? Name the specific tell that distinguishes you — if you can't, it's not differentiated.
- [ ] **Swap test (verbal):** the tagline and the one-liner are false when a competitor's name is substituted.
- [ ] **One-author test:** read the one-liner, an error message, and the boilerplate back to back — same person talking? Voice traits visibly present, banned lexicon absent.
- [ ] **Strategy traceability:** every visual choice maps to a strategy line (color→archetype, type→voice, signature→brand idea). Decoration with no strategic parent is cut.
- [ ] **Token integrity:** `brand.tokens.json` exists, the chosen color/type reached the **design-system** primitive layer (that skill expands your single hue into the OKLCH ramp and runs the canonical `build-tokens.js` compile — you don't run it on this strategy-view file), and a downstream artifact (a detail-page hero or a ui-design screen) renders fully from those tokens with **no loose hex/font** — prove it on the built page:
  ```bash
  node ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/brand-lint.js <built-page.html>   # rawColorsOutsideTheme must read 0; exits 1 on raw-hex / banned-font / ai-purple
  ```
- [ ] **On-brand check is data-driven, not eyeballed:** run `brand-lint` in **`--brand` semantic mode** plus the **lexicon** — it maps the page's declared token colors to your DTCG roles **by literal role name**, diffs with an OKLab ΔE (off-tolerance color = `off-brand-color` ERROR), and reads the **voice.json** `{owned,banned}` against visible copy (banned term = ERROR, missing owned term = WARN), so "does it use OUR color and OUR words" is machine-verified, not a vibe. It prints one `on-brand: yes|no — <evidence>` line:
  ```bash
  node ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/brand-lint.js <built-page.html> --brand <compiled.tokens.json> --lexicon voice.json
  ```
  **Point `--brand` at the design-system-COMPILED token file, NOT the strategy-view `brand.tokens.json` from §5.** Matching is literal role-name (`primary-700` ↔ the page's `--brand-primary-700`); there is no `primary → primary-700` fuzzy expansion. The §5 strategy file carries **bare** roles (`primary`, `accent`) and is the *input* design-system expands — pass it to `--brand` and you get a truthful-but-useless `on-brand: yes — 0/0 declared colors` (zero page tokens named `primary` match the page's numbered ramp). Pass the **expanded numbered-ramp** file whose role names equal the page's `--brand-*`/`--color-*` declarations — e.g. `skills/detail-page/tokens/brand-default.tokens.json` (`color.primary.700`, `color.accent.500`, …) scores 14/14 against the compiled starter. (A zero-role brand file is now a LOUD `brand-unreadable` ERROR + nonzero exit, never a silent `0/0` pass — but a non-zero-role file that simply doesn't *name-match* the page is the 0/0 case this note prevents.) Export the lexicon (§3) as `voice.json {"owned":[…],"banned":[…]}` so this check and **marketing-conversion**'s `email-lint --lexicon` share one source of voice truth.
- [ ] **Accessibility floor:** primary/accent on their backgrounds clear WCAG AA (4.5:1 text) — run the suite's **a11y-auditor** agent (or `AXE=1 node $ROOT/scripts/shoot.js <page>`, `axe.gatingCount` must be 0 at serious/critical); logo legible at 24px mono.
- [ ] **Independent critique:** spawn the **design-critic** agent (generator/evaluator split — the agent that critiques must not be the one that built it) for an anti-slop + distinctiveness pass against the rubric before declaring the brand done. For the **logo mark specifically**, run **design-critic `MODE=logo`** — unlike its other non-pixel modes it DOES re-render (re-shoots the candidate through `logo-grid.html` for the 9-cell size×color matrix), then grades five craft dimensions 1–10 (anchor economy · optical overshoot · sidebearings/spacing · stroke-contrast consistency · survival at 24px/mono/knockout). It FAILs if `gate.report.overall !== true`, the mark collapses in the min/mono/knockout row, **construction-grid guides leaked into the shipped SVG**, or any craft dimension < 6 — elevating "usable" to verified "good". (Note `logo-grid.html` lives under `skills/brand-identity/assets/`, not detail-page.)

Before finishing, "remove one accessory" (aesthetics.md): cut the weakest brand element so the strongest carries the identity. A brand that tries to say five things says none.
