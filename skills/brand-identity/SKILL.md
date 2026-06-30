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

**Validation gate (all must clear before you recommend a name):** exact + similar **trademark** in your classes — KIPRIS `kipris.or.kr` (Korea, KR + EN search) / USPTO TESS `tmsearch.uspto.gov` (US) / WIPO Global Brand DB `branddb.wipo.int` (international); domain via RDAP/`whois <name>.com` (or the category-credible TLD) obtainable; social handle on the 2 channels you'll actually use (check the live profile URLs, e.g. `instagram.com/<handle>`); a **linguistic check across every required market** (the name can't mean something dumb or offensive in KR/EN/etc.); say-it-out-loud and spell-it-on-the-phone test. These are read-only lookups — surface conflicts to the user; trademark *clearance* is counsel's call, not yours. Banned naming moves: thesaurus mashups, dropped-vowel startup spelling (`Tractr`, `Snptch`), `-ly`/`-ify`/`-able` suffix spam, random Latin, and any name that's just two industry nouns glued together.

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

2. **Write a logo brief** (concept, the one idea it must encode, form factor, 3 adjectives from the archetype, what to avoid) and explore candidates — sketch directions in words, and/or generate visual options via the image pipeline in `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/references/asset-generation.md` (use it for *exploration*, then rebuild the chosen direction cleanly as vector). To diverge hard before converging, spawn the **design-director** agent on the logo brief — it returns competing locked directions you pick from rather than a single convergent guess. A negative-space or dual-meaning idea (FedEx arrow) beats a literal icon.
3. **Specify the system around it** so it survives the real world — these are the parts AI logos skip: **construction grid** (geometry, optical corrections — circles overshoot, so they're drawn slightly larger), **clear space** (= the cap-height or the mark's x-unit on all sides), **minimum size** (≈ 24px / 16mm so the mark stays legible), **color variants** (full, 1-color, knockout/reversed, mono for fax/engrave), and **misuse rules** (don't stretch, recolor, rotate, add shadow/gradient/outline, re-space, or place on a busy/low-contrast background).
4. Verify the mark with the shared screenshot loop — drop the candidates into one HTML test sheet (the mark at 24px, 64px, and full size; one row full-color, one row mono, one row knockout on the brand surface) and shoot it. A mark that smears at 24px or dies in mono is not done:
   ```bash
   NODE_PATH=$(npm root -g) node ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/shoot.js /tmp/brand/logo-grid.html /tmp/brand/shots
   # read the tiles: legible at 24px? holds in 1-color? survives reversed on the dominant color?
   ```

### Color — grounded in strategy + emotion, not vibes
Start from the archetype's temperature and the brand idea, then commit to **one dominant brand color with a defensible reason** ("we own forest green because the product is the only carbon-negative one"), one sharp accent, and a neutral spine. Color psychology is a *starting heuristic, not law* (it's culture-bound — white = purity in the West, mourning in parts of Asia): use it to generate, then justify against strategy. A palette with **no dominant** (five timid equal pastels) reads generic — enforce 60-30-10, the 10% accent reserved for the primary action. Generate ramps in **OKLCH** (method in aesthetics.md). **Token mechanics live in the design-system skill** — produce primitives (the raw ramp) → semantic tokens (`brand/primary`, `brand/accent`, `text/default`) and hand those off; don't invent a parallel color config here.

The suite's `brand-lint` gate machine-checks the convergence default: it FLAGS any color at **OKLCH hue 270–310 with chroma > 0.04** as unearned `ai-purple`. That is on purpose — the only legitimate way past it is a **Magician** strategy with a stated reason, which you then record as an explicit override (the inverse archetype rows in §2 produce hues that clear it cleanly). Verify your committed brand color isn't a reflex purple before you compile:
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

**Brand guidelines doc** — what a real brand book contains, in order:
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
- [ ] **Accessibility floor:** primary/accent on their backgrounds clear WCAG AA (4.5:1 text) — run the suite's **a11y-auditor** agent (or `AXE=1 node $ROOT/scripts/shoot.js <page>`, `axe.gatingCount` must be 0 at serious/critical); logo legible at 24px mono.
- [ ] **Independent critique:** spawn the **design-critic** agent (generator/evaluator split — the agent that critiques must not be the one that built it) for an anti-slop + distinctiveness pass against the rubric before declaring the brand done.

Before finishing, "remove one accessory" (aesthetics.md): cut the weakest brand element so the strongest carries the identity. A brand that tries to say five things says none.
