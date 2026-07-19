# Capture-target matrix — what Stage 2 captures, and why

The concrete Stage-2 plan: **which real pages we capture, how many per category, and what makes each one worth imitating**. `TAXONOMY.md` owns the tag values; `SCHEMA.md` owns the record fields; this file owns the **shopping list**.

**Funded total: 134 exemplars across 13 funded categories** (14th deferred, §3.14). Sized above the 120 floor deliberately — §5 shows a measured attrition risk that 120 pinned targets would not survive.

---

## 0 · How this file binds to the other two

| Key | Source | Note |
|---|---|---|
| `category` | **`TAXONOMY.md` §1** — the 14 closed-set **artifact-type** slugs. | Used verbatim below. No parallel list is invented here. |
| `sector` | Not used in this file. | `TAXONOMY.md` §10 C-3 records the `category` key collision with `SCHEMA.md` (which types `category` as *industry*). The orchestrator resolved it in TAXONOMY's favour. Where a sector axis is implied below (e.g. "KR beauty"), it is **prose, not a tag**. |
| tile arithmetic | `capture-reference-patchright.js` (`tileHeight = 1600`, hard-coded) + the 6 captures' `data.json`. | `tiles = ceil(pageHeight / 1600)`, verified against all 6 on disk (§6). |

**Rule 3 inheritance.** `TAXONOMY.md` rule 3 ("tag the authored region, not the platform chrome") is a *tagging* rule, but it is also a **targeting** rule: a target is only worth a slot if the maker authored enough of it to teach something. This is why the KR marketplace seeds below resolve to *maker* 상세페이지 regions, not to platform category pages.

---

## 1 · The quality bar — read this before the matrix

### 1.1 The finding that shapes this whole file

G1.2 tagged **both** Wadiz exemplars on disk `signature-move: none-authored`. Their memorable elements are two of `SKILL.md` §2's **named banned defaults** — acid-lime-on-black (`400620`) and AI-purple + glossy 3D blob (`403454`). Both are real top-sellers (3.7억 / 2.9억). Both are, for Visigner's purposes, **weak teachers**: what they are remembered by is exactly what the skill forbids.

**So the corpus's job is not to be representative. It is to be exemplary.**

> **A matrix that fills 134 slots with popular-but-average pages actively harms v2.** A model retrieving top-K from such a corpus imitates the *average* of it — and the average commercial page in 2026 is a monochrome-timid band-stack with a purple gradient. That is the precise failure v2 exists to fix. **Filling the quota with mediocre pages is worse than under-filling it**, because a thin corpus of authored pages still teaches authorship, while a fat corpus of defaults teaches the default *and* lends it the authority of having been curated.

### 1.2 The selection test (applies to every category)

A candidate earns a slot only if a tagger could, in 5 seconds, answer **"what is this page remembered by?"** with a `TAXONOMY.md` §6 value **other than `none-authored`**.

That is the whole bar, and it is deliberately the same test `TAXONOMY.md` §6 already defines — no second vocabulary. Operationally, three screens:

1. **Hide-the-logo test** (`TAXONOMY.md` §9.8, `visual-identity` → the recognition test for `none-authored`). Cover the wordmark. If the page could belong to any competitor, reject.
2. **Signature nameable?** If the honest tag would be `none-authored`, reject — **unless** the slot is an explicit negative-exemplar slot (§1.3).
3. **Not a banned default** (`SKILL.md` §2's list: AI-purple gradient, acid-on-black, monochrome-timid, cream+serif+terracotta, glossy 3D blob, uniform-radius card grids). Same carve-out as #2.

**Popularity is not a proxy for any of these.** Both Wadiz captures prove it: top-seller, zero authorship.

### 1.3 The negative-exemplar quota — small, capped, labelled

The corpus **does** need negative exemplars — `TAXONOMY.md` §4 enumerates clichés (`ai-purple-gradient`, `acid-on-black`, `monochrome-timid`) precisely so they are storable, and §10 C-5 says a corpus must be able to hold them.

But a negative exemplar is only safe if the retrieval layer can **never** return it as a thing to imitate.

- **Cap: ≤10% of any category, and ≤12 of 134 corpus-wide.**
- **The 2 Wadiz captures already on disk are 2 of those 12.** They are re-classified here as negative exemplars rather than re-captured or discarded.
- **Blocked on a `SCHEMA.md` field that does not exist.** There is no `polarity` / `exemplar_role` field today. Until one exists, a `none-authored` record is indistinguishable from a positive one at retrieval time. **Recommendation: do not capture a single new negative exemplar until that field lands.** The 10 remaining negative slots are therefore **unfunded and held**, and §3's per-category targets are all **positive-only**. → surfaced to the orchestrator as **N-1** (§8.2).

---

## 2 · The matrix

`category` values are `TAXONOMY.md` §1, verbatim and complete (all 14). "Have" = already on disk.

| # | `category` (TAXONOMY §1) | Have | **Target** | Tiles/ex. | Est. tiles | Capture risk | § |
|---|---|--:|--:|--:|--:|---|---|
| 13 | `saas-marketing-site` | 4 | **16** | 4–10 | 112 | 🟢 trivial | §3.1 |
| 11 | `brand-site` | 0 | **14** | 4–12 | 112 | 🟡 luxury/KR bot-walls | §3.2 |
| 6 | `kr-detail-page` | 0 | **12** | 40–90 | 780 | 🔴 Coupang walled; ID churn | §3.3 |
| 7 | `ecommerce-pdp` | 0 | **12** | 10–20 | 180 | 🟡 Shopify/Akamai walls | §3.4 |
| 9 | `portfolio-site` | 0 | **12** | 4–10 | 84 | 🟢 trivial | §3.5 |
| 10 | `editorial-publication` | 0 | **12** | 8–20 | 168 | 🟡 paywalls | §3.6 |
| 5 | `kr-crowdfunding` | 2 | **10** | 70–90 | 800 | 🔴 Akamai (proven passable) | §3.7 |
| 8 | `pricing-page` | 0 | **10** | 3–8 | 50 | 🟢 trivial | §3.8 |
| 14 | `landing-page` | 0 | **10** | 6–15 | 100 | 🟢 trivial | §3.9 |
| 12 | `campaign-microsite` | 0 | **8** | 3–10 | 48 | 🟡 expiry churn | §3.10 |
| 1 | `app-ui-surface` | 0 | **8** | 1–4 | 24 | 🟡 login walls | §3.11 |
| 2 | `mobile-app-screen` | 0 | **5** | 1–3 | 10 | 🔴 artifact mismatch | §3.12 |
| 3 | `email` | 0 | **5** | 2–6 | 20 | 🔴 all archives walled | §3.13 |
| 4 | `motion-reel` | 0 | **0** | — | 0 | ⛔ **not capturable** | §3.14 |
| | **Total** | **6** | **134** | | **≈2,488** | | |

**Where existing coverage is thin — i.e. everywhere except one cell.** The 6 captures on disk are 4 `saas-marketing-site` + 2 `kr-crowdfunding`. **12 of 14 categories are at zero.** And the one category with depth (`saas-marketing-site`, 4/4 dev-tool marketing sites) is the *least* representative sample imaginable: it is one sector, one visual tradition, and — per `TAXONOMY.md` §10 C-1 — 3 of those 4 tag `layout-archetype: band-stack`. The corpus today teaches "how a 2020s dev-tool markets itself" and nothing else.

---

## 3 · Per-category detail

Each table: **`pinned`** = capture this exact URL. **`seed`** = a stable index we resolve N exemplars *from* at capture time. Status = **observed** (§4) or explicitly `unverified`.

### 3.1 `saas-marketing-site` — target 16

**Worth imitating when:** the page has a **product-visual language that is not a browser-chrome mockup** — `TAXONOMY.md` §10 C-4 flags exactly this gap (the lexicon names only the *ban*, while `linear` executes the move superbly as `product-ui-hero-render`). Prefer pages carrying `illustration-language`, `graphic-motif`, or a `committed-saturated-field` over another dark-mode gradient hero. **Reject on sight:** purple→blue gradient + 3 equal feature cards (`SKILL.md` §2). This category has the corpus's worst mediocrity risk — it is where the AI centre *lives*, and its 4 existing captures already skew it.

| URL | Kind | Status | Why this one |
|---|---|---|---|
| `https://posthog.com` | pinned | **200** | Hand-drawn `illustration-language` + hedgehog `graphic-motif`. The strongest anti-AI-tell exemplar in the category. |
| `https://warp.dev` | pinned | **200** | `low-key-nocturnal` that is *lit*, not flat `dark-neutral-ui` — the §4 disambiguator made visible. |
| `https://val.town` | pinned | **200** | Deliberately unpolished; a real authored voice against category gravity. |
| `https://arc.net` | pinned | **200** | Committed colour field + `custom-lettering`. |
| `https://resend.com` | pinned | **200** | `mono-ink` **earned** (§4 disambiguator) — a live test case for TAXONOMY's weakest tag. |
| `https://liveblocks.io` | pinned | **200** | `committed-saturated-field`. |
| `https://cursor.com` | pinned | **200** | Candidate; signature unverified. |
| `https://railway.com` | pinned | **200** | Candidate; signature unverified. |
| `https://supabase.com` · `https://clerk.com` · `https://sentry.io` · `https://tailwindcss.com` · `https://www.framer.com` · `https://www.notion.com` | pinned ×6 | **200** ×6 | Depth pool; screen each against §1.2 before spending a slot. |

*Excluded — already on disk:* `linear.app`, `stripe.com`, `vercel.com`, `raycast.com`.

### 3.2 `brand-site` — target 14

**Worth imitating when:** the page sells a **world** with no dominant CTA and survives the hide-the-logo test on typography and art direction alone. This is the corpus's best source of `photo-film` and `color-material` shelf moves — the two shelves the dev-tool-heavy existing set has **zero** coverage of. Deliberately includes KR brand-sites: `gentlemonster` / `adererror` / `tamburins` are the KR tradition that is *design-literate*, the counterweight to the two 상세페이지 defaults on disk.

| URL | Kind | Status | Why this one |
|---|---|---|---|
| `https://teenage.engineering` | pinned | **200** | Product-as-identity; `flat-spot-color` + Swiss discipline. Category's best. |
| `https://www.oatly.com` | pinned | **200** | `mixed-face-ransom` / vernacular voice. Unmistakable with the logo hidden. |
| `https://mschf.com` | pinned | **200** | Anti-design as identity; deliberately breaks every hygiene rule. |
| `https://nothing.tech` | pinned | **200** | `dot-matrix` custom type system + `halftone-treatment`. |
| `https://adererror.com` | pinned | **200** | KR, `talnemo-experimental` lineage. |
| `https://www.gentlemonster.com` | pinned | **403 → 200 w/ UA** | **Bot-wall, not dead — proven** (§4.2). KR world-building at its strongest. |
| `https://www.aesop.com` | pinned | **403** | Bot-wall (§5.2). `mono-ink` earned via `caption-discipline`. |
| `https://www.rimowa.com` | pinned | **403** | Bot-wall (§5.2). `material` / `macro-material-crop`. |
| `https://www.apple.com` | pinned | **200** | Baseline; `scale-drama`. Risk: this *is* a trained-in default — may teach the average. |
| `https://www.bang-olufsen.com` · `https://www.arcteryx.com` | pinned ×2 | **200** ×2 | Depth pool. |
| `https://www.itsnicethat.com` | seed | **200** | Editorial index → resolve current brand-site work. |

### 3.3 `kr-detail-page` — target 12

**Worth imitating when:** the 상세페이지 is a `non-pasona-editorial` (29CM PT format) or a `full-pasona` with **S distinct from O** — `TAXONOMY.md` §7.2 names `pasona-solution-collapsed` as the doc's #1 mistake, and it is the KR default. Prefer 29CM / 오늘의집 / 컬리, whose house style is `myeongjo-literary` + `caption-discipline`, over Coupang/스마트스토어, whose gravity is `smart-store-tells` (red timers, rainbow badges, 형광 강조 — an explicit ban list owned by `anti-ai-tells.md`).

**Why seeds, not pinned product IDs.** KR marketplace product URLs churn — items delist, 기획전 rotate weekly. Pinning 12 product IDs today guarantees some 404 by Stage 2. Every URL below is a **stable index**; the 12 exemplars resolve from them at capture time against §1.2. This is a deliberate trade: **verifiable-now seeds beat aspirational-now product IDs.**

| URL | Kind | Status | Why this one |
|---|---|---|---|
| `https://www.29cm.co.kr/home` | seed | **200** | **Highest-yield seed in the category.** 29CM PT format = `non-pasona-editorial`, the one KR tradition that is reference-grade. Weight ≥4 of 12 slots here. |
| `https://ohou.se` | seed | **200** | 오늘의집; lifestyle 상세페이지, `environmental-lifestyle` photography. |
| `https://www.kurly.com/main` | seed | **200** | 컬리; disciplined KR commerce, `muted-field-hot-accent`. |
| `https://www.wconcept.co.kr` | seed | **200** | W Concept; fashion 상세페이지, editorial lean. |
| `https://www.musinsa.com` | seed | **200** | 무신사; high volume, mixed quality — screen hard. |
| `https://www.ssg.com` | seed | **200** | SSG; department-store register. |
| `https://smartstore.naver.com` | seed | **200** | **Negative-exemplar source only** (`smart-store-tells`). Held pending N-1 (§1.3) — capture **zero** from here for now. |
| `https://www.coupang.com` | seed | **403** | Bot-wall (§5.2). `platform-width: coupang-780`. Low priority: Coupang's gravity is the ban list. |

### 3.4 `ecommerce-pdp` — target 12

**Worth imitating when:** the buy box is **designed rather than templated** and the material is photographed, not rendered — `SKILL.md` §2 makes real material imagery *mandatory* for physical subjects and bans the glossy 3D blob. This category is the corpus's only source of `sticky-buy-bar`, `catalog-plate`, and `rim-light-product` against a real commercial constraint. Shopify-default PDPs teach nothing; screen them out.

| URL | Kind | Status | Why this one |
|---|---|---|---|
| `https://teenage.engineering` | seed | **200** | `/products/*` — `catalog-plate` discipline. Best in category. |
| `https://www.everlane.com` | seed | **200** | `caption-discipline` + honest-spec register. |
| `https://www.glossier.com` | seed | **200** | `flat-spot-color`; strong owned palette. |
| `https://www.allbirds.com` | seed | **200** | Material-first photography. *(Note: `us.allbirds.com` is **DNS-dead** — use the apex, §4.2.)* |
| `https://www.nike.com` | seed | **200** | `scale-drama`; high volume, screen hard. |
| `https://grovemade.com` | seed | **403** | Bot-wall (§5.2). `macro-material-crop` on wood/metal — exactly `SKILL.md` §2's material requirement. High value if patchright passes. |
| `https://www.aesop.com` | seed | **403** | Bot-wall. PDP register distinct from its brand-site (§3.2). |

> **Dropped: `patagonia.com`.** Returns **404** to both plain curl and a browser UA, at the apex *and* at `/shop/mens` (§4.2). Not listed as a live candidate. A real 404 in this matrix is wasted Stage-2 budget — recording the drop is the point.

### 3.5 `portfolio-site` — target 12

**Worth imitating when:** the index itself is authored — the work is the content, so the *frame* is the only thing the designer can sign. Richest source of `layout-archetype: gallery-index` (currently **0** on disk) and of `type` / `layout-editorial` shelf moves. Trivially capturable: no walls, no auth, no churn.

| URL | Kind | Status | Why this one |
|---|---|---|---|
| `https://www.pentagram.com` | pinned | **200** | The `gallery-index` reference implementation. |
| `https://www.wearecollins.com` | pinned | **200** | `committed-saturated-field` + `custom-lettering`. |
| `https://www.studiofeixen.ch` | pinned | **200** | Swiss `type` shelf; near-pure typographic authorship. |
| `https://rauno.me` | pinned | **200** | `margin-drama`; craft-precision `mono-ink` **earned**. |
| `https://paco.me` | pinned | **200** | Minimal, authored — a `mono-ink` vs `monochrome-timid` test case (§4 C-2). |
| `https://emilkowal.ski` | pinned | **200** | Motion-craft author; stills still teach. |
| `https://locomotive.ca` · `https://activetheory.net` · `https://resn.co.nz` | pinned ×3 | **200** ×3 | `scroll-scene` spines — a `layout-archetype` at 0 on disk. |
| `https://leerob.com` · `https://brittanychiang.com` | pinned ×2 | **200** ×2 | Depth pool. Both risk `monochrome-timid`; screen against §1.2. |
| `https://www.awwwards.com/websites/` | seed | **200** | Index → resolve current work. **Caveat:** Awwwards rewards spectacle; its average is *not* our bar. |

### 3.6 `editorial-publication` — target 12

**Worth imitating when:** the page's job is to be *read* and the typography carries it. Only real source of `editorial-spread`, `manuscript-page`, `drop-cap`, `pull-quote-display`, `footnote-apparatus`, `marginalia` — a whole `TAXONOMY.md` §6.1/§6.2 shelf region with **zero** coverage on disk. **Paywall discipline:** a metered page renders fully then overlays; a hard paywall does not. Only the former is capturable.

| URL | Kind | Status | Why this one |
|---|---|---|---|
| `https://pudding.cool` | seed | **200** | Data-editorial; `scroll-scene` + `timeline-scroll`. Best in category. |
| `https://restofworld.org` | seed | **200** | `ink-vermilion`; genuinely authored publication design. |
| `https://www.propublica.org` | seed | **200** | `forensic` register; data-editorial. |
| `https://www.newyorker.com` | seed | **200** | `didone-glamour` + `drop-cap` + `marginalia`. Metered — verify at capture. |
| `https://www.noemamag.com` | seed | **200** | Strong `editorial-spread`. |
| `https://longreads.com` | seed | **200** | `manuscript-page`. |
| `https://alistapart.com` | seed | **200** | `transitional-authority`; long-form web typography. |
| `https://ia.net/topics` | seed | **200** | iA; typographic discipline as the whole argument. |
| `https://www.works-in-progress.co` | seed | **200** | `garalde-bookish`. |
| `https://aeon.co` | seed | **429** | **Rate-limited, not dead** (§4.2). Retry with backoff. |
| `https://every.to` | seed | **200** | ⚠️ Partial paywall — capture free posts only. |
| `https://www.longblack.co` | — | **200** (root) | ❌ **Excluded.** Root resolves but content is login-walled; per the brief's constraint 4 it is not capturable. Listed *as an exclusion* so Stage 2 does not rediscover it. |

### 3.7 `kr-crowdfunding` — target 10

**Worth imitating when:** — and this is the category where §1.1 bites hardest. **Both exemplars we have are `none-authored`.** Wadiz's commercial gravity *is* the banned-default set, so "top-seller" actively anti-correlates with our bar. Target the `wadiz-ai-digital-benchmark.md` grammar only where a campaign shows a real authored signature: `reward-tier-ladder` executed with `ledger-figure-setting`, `honest-comparison-table`, `calm-fact-deadline` (the antidote to scarcity theatre), `maker-story` with `reportage-proof`. **Prefer Tumblbug over Wadiz**: its design/craft categories carry markedly more authored work, and it is not Akamai-walled (**200**, vs Wadiz **403**).

Distinct from `kr-detail-page` on a platform gate, not a style (`TAXONOMY.md` §1 disambiguator): a funding % or reward ladder is present. Both platforms wrap the maker's page in chrome → **rule 3 applies**; `TAXONOMY.md` §10 C-9 records that the sticky reward rail is Wadiz's, not the maker's.

| URL | Kind | Status | Why this one |
|---|---|---|---|
| `https://tumblbug.com/discover` | seed | **200** | **Primary seed.** Not bot-walled; highest authored-work density. Weight ≥6 of 10 here. |
| `https://tumblbug.com/category` | seed | **200** | Category drill-down for the same. |
| `https://tumblbug.com` | seed | **200** | Apex. |
| `https://www.wadiz.kr/web/wreward/main` | seed | **403** | **Akamai bot-wall — proven passable** (§4.2/§5.1). |
| `https://www.wadiz.kr/web/wreward/category` | seed | **403** | Same wall. `platform-width: wadiz-naver-860`. |
| `https://www.wadiz.kr` | seed | **403** | Same wall. |
| `https://www.wadiz.kr/web/campaign/detail/400620` | — | **403** | ❌ Already on disk. Listed **as the bot-wall proof**: this exact URL 403s to curl yet has 74 tiles captured — see §5.1. |

### 3.8 `pricing-page` — target 10

**Worth imitating when:** the tier comparison is **designed as an argument**, not emitted as a `table-matrix` — the whole category is one `layout-archetype`, so the signature has to come from `ledger-figure-setting`, `honest-comparison-table`, or a committed field. Highest signal-per-tile in the matrix (3–8 tiles) and the *only* category where `table-matrix` will ever be populated. Trivially capturable. **Not a re-capture** of the 4 on disk: `stripe.com/pricing` is a different artifact from `stripe.com` under `TAXONOMY.md` §1's ordered test.

| URL | Kind | Status | Why this one |
|---|---|---|---|
| `https://posthog.com/pricing` | pinned | **200** | Best in category: real usage calculator + `illustration-language`. An authored pricing page, which is rare. |
| `https://basecamp.com/pricing` | pinned | **200** | One-price polemic; the anti-`table-matrix`. |
| `https://stripe.com/pricing` | pinned | **200** | `ledger-figure-setting`. |
| `https://linear.app/pricing` | pinned | **200** | Restraint executed. |
| `https://vercel.com/pricing` | pinned | **200** | `table-matrix` reference. |
| `https://supabase.com/pricing` · `https://resend.com/pricing` · `https://clerk.com/pricing` · `https://sentry.io/pricing/` · `https://slack.com/pricing` · `https://www.figma.com/pricing/` | pinned ×6 | **200** ×6 | Depth pool; screen against §1.2 — most will be `none-authored`. |

### 3.9 `landing-page` — target 10

**Worth imitating when:** one offer, one CTA, and the page **earns** the sale with a `landing-arc` that isn't a logo-wall-under-hero. Independent course/book landings are the best source: single-author, so the design is *someone's*, not a committee's. Direct evidence for `SKILL.md` §3's landing mode, and the closest Latin-script analogue to a 상세페이지 arc — valuable for teaching the arc **without** the KR ban list attached.

| URL | Kind | Status | Why this one |
|---|---|---|---|
| `https://animations.dev` | pinned | **200** | Best in category. Authored, `committed-saturated-field`, craft-demonstrating. |
| `https://buildui.com` | pinned | **200** | Single-author voice. |
| `https://css-for-js.dev` | pinned | **200** | `illustration-language` + warm authored palette. |
| `https://totaltypescript.com` | pinned | **200** | Strong `landing-arc`. |
| `https://refactoringui.com` | pinned | **200** | Single-offer book landing; design-authored by design authors. |
| `https://basecamp.com/shapeup` | pinned | **200** | `manuscript-page` + single offer. |
| `https://www.epicreact.dev` · `https://www.epicweb.dev` · `https://testingjavascript.com` | pinned ×3 | **200** ×3 | Same house; take **at most one** — near-duplicates waste slots. |
| `https://tailwindcss.com/plus` | pinned | **200** | Single-offer split from a SaaS parent. |
| `https://www.smashingmagazine.com/printed-books/` | pinned | **200** | Depth pool. |
| `https://kentcdodds.com` | pinned | **200** | Depth pool. |

> **Dropped: `everylayout.dev`.** **DNS does not resolve** (`could not resolve host`, §4.2) — the domain is gone. This is exactly the failure mode the brief names: a well-known, confidently-recalled URL that is simply dead. Recorded, not listed.

### 3.10 `campaign-microsite` — target 8

**Worth imitating when:** the expiry date **licenses risk** — a microsite is the one artifact whose designer can be loud without owning the consequence, so it is where `scroll-scene`, `custom-lettering`, and `graphic-motif` actually ship. **Structural churn:** `TAXONOMY.md` §1's disambiguator ("has an expiry date") is also this category's capture risk — conference sites are rebuilt or redirected yearly. **Capture early; these URLs decay fastest in the matrix.**

| URL | Kind | Status | Why this one |
|---|---|---|---|
| `https://vercel.com/ship` | pinned | **200** | Authored microsite; committed field. |
| `https://nextjs.org/conf` | pinned | **200** | Strong `graphic-motif`. |
| `https://config.figma.com` | pinned | **200** | Best-in-category identity system. *(Note: `figma.com/config/` is **404** — use this subdomain, §4.2.)* |
| `https://cssday.nl` | pinned | **200** | Small-team authored; typographic. |
| `https://smashingconf.com` | pinned | **200** | `illustration-language`. |
| `https://www.apple.com/apple-events/` | pinned | **200** | Drop microsite w/ date. |
| `https://stripe.com/sessions` | pinned | **200** | Depth pool. |
| `https://openai.com/index/devday/` | pinned | **403** | Bot-wall (Cloudflare), not dead (§5.2). |

### 3.11 `app-ui-surface` — target 8

**Worth imitating when:** it teaches **density and state** — the one thing no marketing page can. Only source of `layout-archetype: sidebar-shell` (0 on disk).

> **The honest constraint.** `TAXONOMY.md` §1's recognition test requires *"the content is **the user's own data**"*. A no-login capture has **empty state**. So every target below is a **partial fit**: real app chrome, real density, but empty or demo data. Empty-state design is a genuine discipline and worth capturing — but a tagger must not pretend these show a populated product. **Recommendation: tag `notes` with `empty-state` on every record from this category**, and expect `unresolved` where population matters. Login-walled real dashboards (Linear, Notion, Figma editor) are **excluded** per constraint 4 — no aspirational URLs listed.

| URL | Kind | Status | Why this one |
|---|---|---|---|
| `https://www.tradingview.com/chart/` | pinned | **200** | **Best fit in category**: full app, extreme density, real market data (not empty). |
| `https://www.photopea.com` | pinned | **200** | Full desktop-class app, `sidebar-shell`, no login. |
| `https://excalidraw.com` | pinned | **200** | Opens into the app; authored empty state. |
| `https://www.tldraw.com` | pinned | **200** | Same; strong toolbar design. |
| `https://www.desmos.com/calculator` | pinned | **200** | `split-screen`; populated by default. |
| `https://regex101.com` | pinned | **200** | Dense, populated, no login. |
| `https://play.tailwindcss.com` | pinned | **200** | `split-screen` editor. |
| `https://squoosh.app` · `https://carbon.now.sh` · `https://ui.shadcn.com/examples/dashboard` | pinned ×3 | **200** ×3 | Depth pool. shadcn is a *demo render*, not a product — flag it. |

### 3.12 `mobile-app-screen` — target 5 ⚠️ artifact mismatch

**Worth imitating when:** thumb-zone constraint forces real hierarchy decisions. But this category has a problem the matrix must state rather than paper over.

> **The pipeline cannot capture what `TAXONOMY.md` §1 defines.** The recognition test is *"a phone viewport with **native status bar / tab bar**"*. Our pipeline is Chrome-via-patchright: **native app screens are not URLs.** The three honest options, none clean:
> 1. **Mobile-viewport web capture** (390×844) of mobile-web/PWA surfaces → real phone viewport + tab bar, but **no native status bar**. Partial fit. **Recommended.**
> 2. **Screenshot-gallery pages** (App Store listings, Screenlane) → capture yields *a page containing screenshots*, i.e. the wrong artifact. The tiles would show a marketing page, not the screen. **Rejected on those grounds.**
> 3. **Mobbin / Page Flows** — login/paywall-walled. **Excluded** per constraint 4.
>
> **This is an owner-shaped question, not mine:** does `mobile-app-screen` mean *native* (uncapturable → target 0) or *mobile-web* (capturable → target 5)? Target held at **5 via option 1**, flagged. → **N-2** (§8.2).

| URL | Kind | Status | Note |
|---|---|---|---|
| `https://ohou.se` | seed | **200** | Mobile-viewport re-capture; KR mobile-web, real tab bar. Reuses a §3.3 seed. |
| `https://www.musinsa.com` | seed | **200** | Mobile-viewport re-capture. |
| `https://www.kurly.com/main` | seed | **200** | Mobile-viewport re-capture. |
| `https://excalidraw.com` | pinned | **200** | Mobile-viewport; responsive app chrome. |
| `https://m.tumblbug.com` | seed | `unverified` | **Not spot-checked** — subdomain existence assumed, not confirmed. Verify before use. |
| `https://apps.apple.com/us/charts/iphone` | seed | **200** | ⚠️ Option-2 artifact mismatch — use **only** if N-2 resolves toward gallery capture. |
| `https://screenlane.com` | seed | **200** | ⚠️ Same mismatch caveat. |
| `https://mobbin.com` | — | **200** (root) | ❌ **Excluded** — browsing requires login. Root 200 is misleading; listed as an exclusion. |

### 3.13 `email` — target 5 ⚠️ weakest sourcing in the matrix

**Worth imitating when:** the 600px table constraint produces real typographic hierarchy — email is the last medium with genuine technical constraint, so it teaches `type` shelf moves under pressure.

> **The sourcing problem, stated plainly.** `TAXONOMY.md` §1's test is *"table-width column (~600px), an **unsubscribe footer**, **no site nav**"*. That rules out the easy sources: **a Substack/beehiiv web archive post is not the email artifact** — it has site nav, no unsubscribe footer, and fluid width. The true email-HTML archives are all **403 to curl** (§4.2). So: the sources that fit the definition are walled, and the sources that aren't walled don't fit the definition. **All 5 slots are at risk.** If patchright cannot pass the walls below, **recommendation: drop `email` to 0 and reallocate to `editorial-publication`** rather than capture 5 web-view proxies that a tagger would have to tag `unresolved`.

| URL | Kind | Status | Note |
|---|---|---|---|
| `https://reallygoodemails.com` | seed | **200** | Best fit — hosts real email HTML. ⚠️ `/emails` path is **404** (§4.2); the deep path must be resolved from the root's own nav at capture time. **Not** assumed. |
| `https://milled.com` | seed | **403** | Brand-email archive; correct artifact. Bot-wall, not dead (§5.2). |
| `https://emaillove.com` | seed | **403** | Same: correct artifact, bot-walled. |
| `https://tldr.tech/archives` | seed | **200** | ⚠️ Web-view **proxy** — partial fit only (no unsubscribe footer). |
| `https://www.lennysnewsletter.com/archive` | seed | **200** | ⚠️ Web-view proxy; partial fit. |
| `https://newsletter.pragmaticengineer.com/archive` | seed | **200** | ⚠️ Web-view proxy; partial fit. |

### 3.14 `motion-reel` — target **0** (deferred, seeds banked)

**Not a budget call — a capability fact.** Three independent confirmations:

1. `TAXONOMY.md` §1: *"the deliverable is a video/prototype; **stills are frames, not a page**."* A tile of a motion reel is not the artifact.
2. `TAXONOMY.md` §10 **C-7**: the entire `motion` domain is dark — **21 of 22 lexicon motion terms dropped D2**, because no capture records motion in any form.
3. `SCHEMA.md` §2: both capture scripts emit still tiles only; there is no motion field anywhere in `data.json` / `capture.json`.

Capturing here would produce records whose every design-bearing field is `null` — precisely the "field nothing can populate" failure `SCHEMA.md` §1 exists to prevent. **Target 0.** The unblocking prerequisite is `TAXONOMY.md` §9.5's named extension point (`motion-signature` + video capture), which is out of Stage-2 scope.

Seeds banked so the slot is recoverable without redoing this work: `https://vimeo.com/channels/motiongraphics` (**200**) · `https://motionographer.com` (**200**) · `https://www.awwwards.com/websites/animation/` (**200**) · `https://www.itsnicethat.com` (**200**) · `https://dribbble.com/shots/popular/animation` (**202**) · `https://www.behance.net/galleries/motion` (**400** plain / **403** UA — bot-wall).

---

## 4 · Spot-check results — observed, not assumed

### 4.1 Method and totals

```
curl -sS -o /dev/null -w "%{http_code}" -L --max-time 20 <url>
```

Run 2026-07-17. **142 unique URLs probed** against the brief's floor of 10 — the whole matrix was checked, not a sample, because a dead URL is the named failure mode and curl is nearly free relative to Stage-2 capture budget. Failures were **re-probed with a browser UA** to separate bot-wall from dead (§4.2).

**125 of the 126 URLs in §3 carry an observed status. The single exception is `m.tumblbug.com`, disclosed in §8.1 #3.** The other 16 probes were replacement candidates and diagnostics that did not earn a place in the matrix.

| Observed | URLs | Reading |
|---|--:|---|
| **200** | **117** | Live. |
| **202** | 1 | Live (`dribbble.com`). |
| **403** | **14** | **Bot-wall — retained** (§5.1). 14 URLs across **10 sites**: wadiz ×4, milled ×2, openai ×2, + aesop, coupang, gentlemonster, rimowa, grovemade, emaillove. **9 of the 10 sit in the funded matrix** (behance is motion-reel, deferred). |
| **400** | 1 | `behance.net` — **403 on UA retry**, i.e. a bot-wall too. Banked (§3.14). |
| **429** | 1 | Rate-limited, alive (`aeon.co`). |
| **404** | 5 | **2 path-corrected** (`figma.com/config` → `config.figma.com`; `reallygoodemails.com/emails` → root) · **2 dropped** (`patagonia.com` apex + `/shop/mens` — 1 site) · **1 never listed** (`buttondown.com/archive`). |
| **DNS fail** | 3 | **Dead.** 1 dropped outright (`everylayout.dev`) · 2 apex-corrected (`us.allbirds.com` → `www.allbirds.com`; `shop.grovemade.com` → `grovemade.com`). |
| **Total** | **142** | |

### 4.2 The non-200s in full — every one, with the judgement

This is the load-bearing table: **which are bot-walls (keep) vs actually dead (drop)**.

| URL | plain curl | + browser UA | Verdict | Action |
|---|---|---|---|---|
| `https://www.wadiz.kr` | **403** | — | **Bot-wall (Akamai)** | ✅ Keep — §5.1 proof |
| `https://www.wadiz.kr/web/campaign/detail/400620` | **403** | — | **Bot-wall — 74 tiles already on disk** | ✅ **The proof** (§5.1) |
| `https://www.wadiz.kr/web/wreward/main` | **403** | — | Bot-wall | ✅ Keep |
| `https://www.wadiz.kr/web/wreward/category` | **403** | **403** | Bot-wall | ✅ Keep |
| `https://www.gentlemonster.com` | **403** | **200** | **Bot-wall — proven by UA flip** | ✅ Keep |
| `https://www.coupang.com` | **403** | **403** | Bot-wall (known KR anti-bot) | ⚠️ Keep, low priority |
| `https://www.aesop.com` | **403** | **403** | Bot-wall (WAF) | ⚠️ Keep |
| `https://www.rimowa.com` | **403** | **403** | Bot-wall (WAF) | ⚠️ Keep |
| `https://grovemade.com` | **403** | **403** | Bot-wall (Shopify) | ⚠️ Keep |
| `https://milled.com` · `https://www.milled.com` | **403** | **403** | Bot-wall | ⚠️ Keep (§3.13) |
| `https://emaillove.com` | **403** | **403** | Bot-wall | ⚠️ Keep (§3.13) |
| `https://openai.com/index/devday/` | **403** | **403** | Bot-wall (Cloudflare) | ⚠️ Keep |
| `https://www.behance.net/galleries/motion` | **400** | **403** | Bot-wall | ⚠️ Banked (§3.14) |
| `https://aeon.co` | **429** | **429** | **Rate-limit, alive** | ✅ Keep + backoff |
| `https://everylayout.dev` | **DNS fail** | **DNS fail** | ❌ **DEAD** | 🗑️ **Dropped** (§3.9) |
| `https://us.allbirds.com` | **DNS fail** | **DNS fail** | ❌ **DEAD** (subdomain) | 🔧 → `https://www.allbirds.com` **200** |
| `https://shop.grovemade.com` | **DNS fail** | **DNS fail** | ❌ **DEAD** (subdomain) | 🔧 → `https://grovemade.com` (403 wall) |
| `https://www.patagonia.com` | **404** | **404** | ❌ **404 at apex** | 🗑️ **Dropped** (§3.4) |
| `https://www.patagonia.com/shop/mens` | **404** | **404** | ❌ 404 — confirms the drop | 🗑️ Dropped |
| `https://www.figma.com/config/` | **404** | **404** | ❌ 404 | 🔧 → `https://config.figma.com` **200** |
| `https://reallygoodemails.com/emails` | **404** | **404** | ❌ 404 (deep path wrong) | 🔧 → root **200**, resolve path at capture |
| `https://buttondown.com/archive` | **404** | **404** | ❌ 404 | 🗑️ Not listed |

**Four URLs I would have listed with confidence are dead or wrong** (`everylayout.dev`, `patagonia.com`, `figma.com/config/`, `us.allbirds.com`). That is a ~3% fabrication-by-recall rate caught only by actually running curl — and the reason §2's target is 134, not 120.

### 4.3 200-status confirmations (abridged)

All **200** unless noted. `saas-marketing-site`: posthog · resend · clerk · supabase · framer · cursor · arc.net · warp.dev · val.town · tailwindcss · liveblocks · railway · sentry · notion. `pricing-page`: stripe · linear · vercel · posthog · supabase · resend · basecamp · figma · slack · sentry · clerk (11/11). `landing-page`: epicreact · totaltypescript · css-for-js · animations.dev · buildui · epicweb · testingjavascript · refactoringui · basecamp/shapeup · tailwindcss/plus · kentcdodds · smashingmagazine (12/12). `portfolio-site`: rauno · paco · emilkowal.ski · leerob · brittanychiang · pentagram · wearecollins · studiofeixen · locomotive · activetheory · resn · awwwards (12/12). `editorial-publication`: pudding · restofworld · newyorker · longreads · alistapart · ia.net · noemamag · propublica · works-in-progress · every.to (10/12; aeon 429). `app-ui-surface`: excalidraw · tldraw · photopea · tradingview · regex101 · play.tailwindcss · desmos · squoosh · carbon.now.sh · shadcn (10/10). `kr-detail-page` seeds: 29cm/home · ohou · kurly/main · musinsa · wconcept · ssg · smartstore (7/8; coupang 403). `kr-crowdfunding`: tumblbug ×3 (3/3). `brand-site`: apple · teenage.engineering · oatly · nothing.tech · adererror · bang-olufsen · arcteryx · mschf · itsnicethat (9/12). `campaign-microsite`: vercel/ship · nextjs/conf · config.figma.com · cssday · smashingconf · apple-events · stripe/sessions (7/8).

---

## 5 · Feasibility — bot-walls and page-load budget

### 5.1 A 403 is not a 404, and we have proof on disk

The single most decision-relevant fact in this file:

> **`https://www.wadiz.kr/web/campaign/detail/400620` returns 403 to curl — and we have 74 tiles of it captured.**

Same for `403454` (85 tiles). **Curl's 403 is a UA/TLS-fingerprint rejection, not a statement about the page.** Patchright drives real Chrome and passes walls curl cannot. `https://www.gentlemonster.com` demonstrates the mechanism in miniature: **403 to plain curl, 200 with nothing but a browser UA string.**

**Therefore: no target in this matrix is discarded for a 403.** All **9 bot-walled sites in the funded matrix** are retained. Targets are discarded only for **404 or DNS failure** — and 2 sites were (`patagonia.com`, `everylayout.dev`), with 3 more URLs path- or apex-corrected (§4.2).

The cost of a 403 is **retry budget, not target loss**. `captures/README.md` records the operational reality: *"Akamai 차단 시 `{"blocked":true}` → 몇 분 쿨다운 후 재시도."*

### 5.2 Per-category feasibility

| Category | Wall risk | Basis | Mitigation |
|---|---|---|---|
| `saas-marketing-site` · `pricing-page` · `portfolio-site` · `landing-page` · `app-ui-surface` | 🟢 **Trivial** | 45/45 checked returned 200. Dev-tool marketing wants to be crawled. | None needed. **Capture these first** — they de-risk the pipeline before it meets a wall. |
| `campaign-microsite` | 🟡 Low | 7/8 200; openai 403. Real risk is **expiry churn**, not walls. | Capture early. |
| `editorial-publication` | 🟡 Low-med | 10/12 200; aeon 429; metered paywalls. | Backoff; free posts only; `every.to`/`longblack` flagged. |
| `brand-site` | 🟡 **Medium** | 3 of 12 403 (aesop, rimowa, gentlemonster). Luxury WAFs are aggressive. | gentlemonster proven UA-passable; expect patchright to clear all 3. |
| `ecommerce-pdp` | 🟡 **Medium** | grovemade 403 (Shopify), aesop 403. Plus **product-ID churn**. | Seed-resolve at capture time. |
| `kr-detail-page` | 🔴 **High** | coupang 403. **Naver/스마트스토어 are dynamic + anti-bot even where the apex 200s.** ID churn is weekly. | Seeds only, never pinned IDs. Prefer 29CM/오늘의집/컬리 (all 200). Deprioritise Coupang — its gravity is the ban list anyway. |
| `kr-crowdfunding` | 🔴 **High** | Wadiz 403 on all 4 paths. **But proven passable** (§5.1). | **Prefer Tumblbug (200) for 6+ of 10.** Wadiz needs `expanded` ("더보기") + cooldown retries. |
| `mobile-app-screen` | 🔴 **High** | Not a wall — an **artifact mismatch** (§3.12). | Owner call N-2. |
| `email` | 🔴 **High** | **All 3 correct-artifact archives 403.** Non-walled sources are the wrong artifact. | If patchright fails → drop to 0, reallocate (§3.13). |
| `motion-reel` | ⛔ **Not capturable** | Pipeline emits stills; §3.14. | Deferred. |

### 5.3 Page-load budget and the 2-load problem

**Capture cost is ~2 page-loads per exemplar** — tiles via `capture-reference-patchright.js`, then a separate style pass via `scripts/capture-styles.js`.

**134 exemplars × 2 = ~268 page loads.** For the 🟢 45 that is nothing. For Wadiz it is the central risk:

> **The second load is a second wall crossing.** Each exemplar must pass Akamai **twice**, and the style pass arrives at a session Akamai has already fingerprinted. A first-load success does **not** imply the style pass succeeds — it may be *more* likely to trip, arriving on a warmed, flagged session.

**Recommendation for the 🔴 categories: treat the two loads as independently failable and land the tile pass first.** A record with tiles and no styles is a usable (if degraded) exemplar; the reverse is worthless. Do **not** couple them into one all-or-nothing job for Wadiz/Coupang.

Worst case, **~536 wall crossings** if every 🔴 load retries once. Tumblbug-first (§3.7) is the cheapest lever available: it converts ~6 of the 10 highest-cost captures into unwalled ones.

### 5.4 Cross-origin CSS — noted, not blocking

`.cssRules` raises `SecurityError` on cross-origin stylesheets; `getComputedStyle` still resolves. So the style pass yields **computed values, not authored tokens**.

Materially, this changes nothing about the plan, because `SCHEMA.md` §2.4 already establishes the harder version of the same point: **an exemplar's OKLCH ramp is a measurement of rendered pixels, never a source token** (GAP-02) — the numeric chroma floor is not recoverable from a third-party page at all. Where it bites hardest is **`kr-detail-page` / `kr-crowdfunding`**: `layout-archetype: image-band-scroll` means the text is *inside a JPEG* (`TAXONOMY.md` §2 disambiguator), so there is no computed type to read regardless of origin policy. **For the KR categories the style pass has the least to offer — which strengthens §5.3's advice to sequence tiles first.**

---

## 6 · Capture weight → **H-2 / H-3** (posted, awaiting answer)

H-2/H-3 decide whether tiles ship **inside the public repo**, live in an **external store**, or the corpus is **metadata-only**. That is a weight question, so here is the weight — **measured from disk, not estimated.**

### 6.1 Measured ground truth (6 captures)

| Capture | `pageHeight` | Tiles | Check `ceil(h/1600)` | Total | **Avg/tile** |
|---|--:|--:|--:|--:|--:|
| `400620` (Wadiz) | 117,039 px | 74 | 74 ✅ | 7.6 MB | **101 KB** (JPEG 720×900) |
| `403454` (Wadiz) | 135,965 px | 85 | 85 ✅ | 9.2 MB | **106 KB** (JPEG 720×900) |
| `app-ui/linear` | 10,526 px | 7 | 7 ✅ | 1.4 MB | **194 KB** (PNG 1280×1600) |
| `app-ui/raycast` | 15,626 px | 10 | 10 ✅ | 3.1 MB | **311 KB** (PNG) |
| `app-ui/stripe` | 14,715 px | 10 | 10 ✅ | 6.7 MB | **662 KB** (PNG) |
| `app-ui/vercel` | 6,019 px | 4 | 4 ✅ | 0.6 MB | **143 KB** (PNG) |
| **6 captures** | | **190** | | **28 MB** | |

`tiles = ceil(pageHeight/1600)` verified **6/6** — `tileHeight = 1600` is a hard-coded literal in `capture-reference-patchright.js`, so this is arithmetic, not a guess.

**Two measured rates:**
- **Native PNG: ~381 KB/tile** (11,828 KB ÷ 31 app-ui tiles) ← what the pipeline **actually emits**
- **Downscaled JPEG: ~106 KB/tile** (16,820 KB ÷ 159 Wadiz tiles) ← post-hoc, **~3.6× smaller**

> **The trap in these numbers.** Per `SCHEMA.md` §2.3, **both scripts write `tile_NN.png`** — the committed Wadiz JPEGs are *post-hoc downscales*, not pipeline output. **Do not size H-2/H-3 off the 28 MB on disk.** A Stage-2 re-capture emits lossless PNG for everything, including the 74–85-tile KR pages.

### 6.2 Projected weight at 134 exemplars

| Category | Target | Tiles/ex. | **Est. tiles** | Native PNG @381 KB | JPEG @106 KB |
|---|--:|--:|--:|--:|--:|
| **`kr-crowdfunding`** | 10 | 70–90 | **800** | **~298 MB** | ~83 MB |
| **`kr-detail-page`** | 12 | 40–90 | **780** | **~290 MB** | ~81 MB |
| `ecommerce-pdp` | 12 | 10–20 | 180 | ~67 MB | ~19 MB |
| `editorial-publication` | 12 | 8–20 | 168 | ~62 MB | ~17 MB |
| `saas-marketing-site` | 16 | 4–10 | 112 | ~42 MB | ~12 MB |
| `brand-site` | 14 | 4–12 | 112 | ~42 MB | ~12 MB |
| `landing-page` | 10 | 6–15 | 100 | ~37 MB | ~10 MB |
| `portfolio-site` | 12 | 4–10 | 84 | ~31 MB | ~9 MB |
| `pricing-page` | 10 | 3–8 | 50 | ~19 MB | ~5 MB |
| `campaign-microsite` | 8 | 3–10 | 48 | ~18 MB | ~5 MB |
| `app-ui-surface` | 8 | 1–4 | 24 | ~9 MB | ~3 MB |
| `email` | 5 | 2–6 | 20 | ~7 MB | ~2 MB |
| `mobile-app-screen` | 5 | 1–3 | 10 | ~4 MB | ~1 MB |
| `motion-reel` | 0 | — | 0 | 0 | 0 |
| **Total** | **134** | | **≈2,488** | **≈0.93 GB** | **≈0.26 GB** |

### 6.3 The finding H-2/H-3 needs

> **Two categories — `kr-crowdfunding` + `kr-detail-page` — are 22 of 134 exemplars (16%) but 1,580 of 2,488 tiles (≈64%) and ≈588 MB of ≈930 MB (≈63%).**

A KR 상세페이지 is **117k–136k px tall (measured)** → 74–85 tiles. A landing page is **6k–16k px** → 4–10 tiles. **A single Wadiz capture outweighs all 4 app-UI captures combined** (85 tiles vs 31). The weight is not spread across the corpus; it sits in one artifact type.

**What this means for the three options:**
- **Ship-in-repo:** ~0.93 GB native PNG. For a `claude-code-plugin` users install, that is not viable as-is. JPEG downscale → **~0.26 GB** — still heavy, and it re-inflicts `SCHEMA.md` GAP-04 (chroma subsampling degrades *colour*, the one thing a design corpus most needs) on the whole corpus, to save weight created almost entirely by two categories.
- **External store:** the ~63% KR weight is exactly what an external store is *for*.
- **Metadata-only:** cheapest, but `SCHEMA.md` §3 class **B** ("what does this page teach" — `palette.roles`, `layout.archetype`, all of `signature.*`) is derived **from tiles**. Metadata-only means those fields are extracted once and the pixels are then unverifiable — no re-indexing, ever.

> **A hybrid falls out of the measurement and is worth putting in front of the owner:** ship the ~908 non-KR tiles (**~346 MB PNG / ~96 MB JPEG**) in-repo, and put the two KR categories (~588 MB) in the external store. That buys ~63% of the weight reduction while keeping 12 of 14 categories working offline at full fidelity. **Not decided here** — H-2/H-3 is the owner's, and this file only supplies the numbers.

---

## 7 · Vision spend → **H-1** (deferred, pending pilot evidence)

H-1 decides whether extraction may call a **paid vision model**. `SCHEMA.md` §3 is unambiguous about the stakes: `palette.roles`, `layout.archetype`, and **all of `signature.*` are class B** — *"the entire 'what does this page teach' layer is B."* Without H-1, the corpus retrieves on **structure, not design**.

`signature-move` is the field §1 says the entire matrix is selected on. **It is class B.** So H-1 and this matrix's quality bar are the same decision seen twice.

### 7.1 Vision cost scales with **tiles**, not exemplars

This is the per-category implication, and it is the same 64/16 skew as §6.3:

| Category | Target | Est. tiles | Share of vision spend | Vision-hunger |
|---|--:|--:|--:|---|
| `kr-crowdfunding` | 10 | 800 | **32%** | 🔴 **Highest.** 85 tiles/page, `image-band-scroll` → **type and colour exist only as pixels**; §5.4's style pass returns nothing readable. Vision is the *only* extractor. |
| `kr-detail-page` | 12 | 780 | **31%** | 🔴 **Highest**, same reason. |
| `ecommerce-pdp` | 12 | 180 | 7% | 🟡 Medium. |
| `editorial-publication` | 12 | 168 | 7% | 🟡 Medium. |
| `saas-marketing-site` | 16 | 112 | 5% | 🟢 Low — live DOM; the style pass carries much of it. |
| `brand-site` | 14 | 112 | 5% | 🟡 Medium — `photo-film` moves need vision. |
| others (7) | 48 | 336 | 13% | 🟢 Low. |

> **The two KR categories are ~63% of all vision spend** — 22 of 134 exemplars consuming nearly two-thirds of the budget, on **every re-index** (`SCHEMA.md` §3: B fields are re-paid whenever the corpus is re-indexed).
>
> **And they are the categories §1.1 says are our *weakest teachers*.** Both exemplars on disk are `none-authored` — banned defaults. So the H-1 spend is concentrated precisely where the design value is *least* proven.
>
> **Recommendation for the H-1 pilot (evidence, not a decision):** run it on **`kr-detail-page` 29CM-sourced pages**, not on the Wadiz set. It is the highest-cost, lowest-DOM, highest-uncertainty cell — the one where vision either proves its worth or doesn't — and 29CM's `non-pasona-editorial` is the one KR tradition §3.3 expects to clear the §1.2 bar. If vision cannot extract a `signature-move` from an `image-band-scroll` page, H-1 should be **no**, and the KR categories should be cut or captured for arc/copy only (class A, free). **This is the owner's call; the orchestrator routes it.**

---

## 8 · What is unverified, and what is not mine to decide

### 8.1 Unverified — stated plainly

1. **Every "why this one" quality claim is my judgement from prior familiarity, not from a capture.** Nothing in §1's bar has been *run* against these pages — no tiles exist for any of the 128 new targets. `signature-move` is class B (§7): **confirming these claims requires the H-1 decision this file is an input to.** Treat every quality rationale as a **hypothesis to test at capture time**, not a finding. Where I flagged "signature unverified" (e.g. cursor, railway), that is a stronger warning; where I did not, the claim is still only recall.
2. **Tiles/exemplar for 12 of 14 categories is an estimate**, extrapolated from 6 measured pages (§6.1). The two KR figures are anchored on **real measurements** (74/85 tiles at 117k/136k px). The rest are inference from 4 app-UI captures. **The ±range, not the midpoint, is the honest number**, and §6.2's totals inherit that uncertainty.
3. **`https://m.tumblbug.com` was NOT spot-checked** (§3.12) — the only URL in this file listed without an observed status. Marked `unverified` in place.
4. **`reallygoodemails.com` deep-path is unresolved.** Root is 200; `/emails` is 404. The path to actual email records must be found at capture time. I did not guess one.
5. **Bot-wall verdicts are inference, not proof — except two.** `wadiz.kr` (74 tiles on disk vs 403) and `gentlemonster.com` (403 → 200 on UA) are **proven**. The other 7 403s (coupang, aesop, rimowa, grovemade, milled, emaillove, openai) are *judged* bot-walls from the 403-with-UA pattern. **Not proven passable by patchright.** If several fail at Stage 2, `email` (§3.13) is the first category to fall.
6. **Naver/스마트스토어 apex 200 is misleading.** The apex is capturable; individual 상세페이지 are dynamic and anti-bot. I did not verify a single Naver product page, because pinning one would have meant inventing an ID (§3.3).
7. **No capture was run.** Per the brief's STOP condition, this file is a plan. Zero tiles were produced; no script was written or modified.
8. **Category targets are a judgement about corpus balance, not an optimum.** The 16/14/12… shape reflects §1's quality argument and §5's feasibility, and is a reasonable allocation — not a derived one.

### 8.2 Owner-shaped questions this work surfaced (**not posted — the orchestrator routes these**)

- **N-1 · The corpus cannot safely hold a negative exemplar today.** `SCHEMA.md` has no `polarity` / `exemplar_role` field, so a `none-authored` record is indistinguishable from a positive one at retrieval — meaning the librarian could return a **banned default as a thing to imitate**. This is not hypothetical: **the 2 Wadiz captures on disk are exactly that today.** All 10 remaining negative slots are held unfunded (§1.3). Cheap to fix (one field), but it is a `SCHEMA.md` change and this goal is additive-only.
- **N-2 · `mobile-app-screen` may be undefined for our pipeline.** Native = uncapturable (target 0); mobile-web = capturable but fails `TAXONOMY.md` §1's "native status bar" test (target 5, tagged partial). Held at 5 via mobile-viewport (§3.12).
- **N-3 · `email` may not survive contact with its own sources.** All 3 correct-artifact archives are 403; all non-walled alternatives are the wrong artifact (§3.13). Contingency — drop to 0, reallocate to `editorial-publication` — is stated but **not executed**.
- **H-2/H-3 input delivered:** ≈0.93 GB native PNG / ≈0.26 GB JPEG at 134 exemplars, **≈63% of it in 2 of 14 categories**; hybrid option costed in §6.3.
- **H-1 input delivered:** ≈63% of vision spend sits in the same 2 KR categories, on every re-index; pilot target recommended in §7.1.

---

Sources, first-party, read 2026-07-17: `corpus/TAXONOMY.md` (§1 categories, §2 archetypes, §4 palettes, §6 signature shelves, §7 KR dimensions, §9 lexicon reconciliation, §10 C-1/C-3/C-4/C-5/C-7/C-9) · `corpus/SCHEMA.md` (§2.3 PNG-not-JPEG, §2.4 GAP-02, §2.5 GAP-03, §3 fillability classes A/B/C/D) · `SKILL.md` §2 (banned defaults, colour commitment, product-visual language) · `references/captures/{400620,403454,app-ui/{linear,raycast,stripe,vercel}}` (`data.json` `pageHeight`/`imageCount`, tile counts, byte sizes) · `references/captures/README.md` (JPEG 축소본, Akamai cooldown) · `scripts/capture-reference-patchright.js` (`tileHeight = 1600`). URL statuses: 142 unique `curl` probes run 2026-07-17, tabulated §4.
