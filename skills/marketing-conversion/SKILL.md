---
name: marketing-conversion
description: Make web pages, funnels, and copy CONVERT — the growth/CRO/copywriting half of the Claude Design Suite. Auto-invoke for conversion-rate optimization, funnel design, landing-page copy, and experimentation work, in English or Korean. Trigger phrases include CRO, conversion rate, "improve conversions / 전환율 높여줘", landing page copy, "이 페이지 전환 안 돼 / 왜 전환이 안 나오지", hero headline, value proposition / 가치 제안, CTA copy, A/B test / AB 테스트 / 실험 설계, "어떤 걸 테스트해야 해", funnel / 퍼널 / 깔때기, funnel drop-off / 이탈, activation, retention, lead gen, signup flow, email subject line / 이메일 제목, ad copy / 광고 카피 / 후킹 / 훅, paid ad angle, push copy, pricing page / 가격표 / 요금제, offer design / 오퍼, anchoring, "value before price", UTM / 이벤트 설계 / 트래킹, CAC, LTV, CTR, CVR, "make this convert / 전환되게 고쳐줘", PASONA/AIDA/PAS/FAB copy frameworks, Schwartz awareness & sophistication. This skill owns the broad WEB funnel + copy + testing + measurement; it routes Korean 상세페이지/Wadiz/Tumblbug depth and the screenshot self-critique loop to the detail-page skill, app/SaaS UI to ui-design, and design→code to frontend-build.
---

# Marketing-Conversion — design that moves a number

You are not decorating a page; you are moving **one metric per surface**. A conversion page is good when (1) a skeptical buyer can't tell it was AI-written, and (2) the path from arrival to the one action is the lowest-friction, highest-motivation route available. This skill is the growth/CRO/copy half of the suite. The aesthetic half (token system, anti-slop visual craft) and the screenshot loop are shared — **don't re-derive them**: invoke `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/references/aesthetics.md` for the two-pass token method, and shoot every page with `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/shoot.js`.

## The loop (never skip a step)

```
0 STAGE     → which funnel stage is this surface, and the ONE metric it moves
1 PRE-FLIGHT→ Schwartz awareness × sophistication (sets where copy STARTS + claim style)
2 MESSAGE   → the ONE thing; pick a copy framework (PASONA / AIDA / PAS / FAB) to skeleton it
3 ANATOMY   → lay out the section arc for the stage (hero thesis → proof → value → objection → CTA)
4 FRICTION  → audit friction vs motivation; one primary action; trust + risk-reversal placed
5 BUILD     → write copy + page (invoke detail-page/ui-design/frontend-build for the craft)
6 INSTRUMENT→ events + UTM + funnel; define success metric and its current baseline
7 VERIFY    → pre-launch conversion checklist + rubric conversion dims (gate: ship or fix)
8 EXPERIMENT→ form ONE hypothesis on the highest-leverage element; size it; ship the test
```
Do 0–4 in thinking; only show output once the message is sharp. You are the **generator**; for an independent grade invoke the **design-critic** agent (conversion + anti-slop critique) — the builder must not grade itself.

## 0 · The funnel map (every surface has a job and a number)

| Stage | Reader's state | The job | Primary metric | Design/copy lever that moves it |
|---|---|---|---|---|
| **Awareness** | doesn't know you exist | earn the click/scroll-stop | CTR, hook rate, thumb-stop ratio | ad hook angle, scroll-stopping hero thesis, headline specificity |
| **Consideration** | comparing options | prove it's for them | scroll depth, time-to-proof, micro-conversion (lead) | proof density, objection handling, comparison vs status-quo |
| **Conversion** | ready, but hesitant | remove the last friction | CVR (page→action), form completion, add-to-cart | one primary CTA, risk-reversal, value-before-price, sticky CTA |
| **Retention** | bought once | make the 2nd value moment | activation rate, D7/D30 return, repeat purchase | onboarding copy, empty states, lifecycle email (route to ux-flows for the flow) |
| **Referral** | got value | turn into a channel | K-factor, share rate, NPS→referral | post-purchase ask timing, shareable artifact, incentive copy |

Pick the stage FIRST. A page that tries to do awareness + conversion at once does neither — an unaware reader bounces off a pricing table, a most-aware reader is bored by a 6-section education arc. The stage decides where the copy starts (next step).

## 1 · Pre-flight — Schwartz awareness × sophistication (decide BEFORE the framework)

This is the planning lens that kills superlative slop, and it is shared with detail-page. Set two fields before writing a word — full method + the Korean mapping in `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/references/korean-detailpage.md` (don't duplicate it):

- **Awareness** (unaware → problem-aware → solution-aware → product-aware → most-aware) sets where the page **starts**. Cold traffic (unaware) opens on story/symptom; retargeted/most-aware opens on the offer/deadline. Matching ad awareness to landing-page opening is the single biggest message-match win — mismatched, it reads as a different company.
- **Sophistication** (1–5: how many competitors have made the same claim) sets the **claim style**. At 1–2 a direct claim works ("lose weight"). At 4–5 a bare "best/fastest/most powerful" is dead on arrival — pivot to **mechanism** ("why this works when others didn't") or a **new identity/category** framing. This is the structural reason the BANNED superlatives below fail in saturated markets.

## 2 · The message + a copy framework

Write the **ONE sentence** the reader must remember, then pick a skeleton. Don't free-write — frameworks prevent the feature-dump and the premature sell.

**PASONA** (best for long pages / 상세페이지 / problem-aware → unaware): Problem → Agitation → **Solution (mechanism, NOT the product)** → Offer → Narrowing (scarcity) → Action. The #1 mistake is collapsing Solution into Offer — selling before the reader accepts the mechanism triggers defensiveness.

**AIDA** (short pages, ads): Attention → Interest → Desire → Action. Fast, top-of-funnel.

**PAS** (the workhorse for ads/emails/short sections): Problem → Agitate → Solve. Three lines, brutal, high-converting for problem-aware traffic.

**FAB** (feature → benefit translation, for every spec you list): Feature → Advantage → **Benefit**. Run every feature through it so the page leads with the benefit and demotes the spec.
```
Feature:   "256-bit AES encryption"
Advantage: "so files can't be read even if intercepted"
Benefit:   "your client contracts stay private — no breach disclosure call"   ← lead with THIS
```

**Headline templates** (specific beats clever — fill the slots with the subject's real nouns):
- `[Achieve outcome] without [the dreaded cost/effort]` — "Ship the redesign without a 3-week handoff"
- `[Specific number/result] in [timeframe]` — only if true and provable; otherwise it reads as a claim
- `The [adjective] way to [job-to-be-done]` — works at sophistication 1–2, dies at 4–5
- `[Audience], stop [painful status-quo behavior]` — for problem-aware
- Mechanism hook (sophistication 4–5): `Why [outcome] finally works: [the named mechanism]`

**CTA verb patterns** — name the value, not the mechanic. "Get my free audit" > "Submit". "Start saving 4 hrs/week" > "Sign up". "See plans" (low commitment) > "Buy now" (high commitment) for a cold visitor. First-person ("Start my trial") often lifts CTR; worth a test, not a law.

**Microcopy** that removes the last doubt, placed *under* the CTA: "No card required · 2-min setup · Cancel anytime". Each phrase deletes one objection at the exact moment of hesitation.

## 3 · Web page conversion anatomy

For the broad WEB funnel (SaaS, app, lead-gen, brand). For Korean long-scroll **상세페이지 / Wadiz / 텀블벅** depth (PASONA arc, reward ladder, platform widths, mobile sticky purchase bar), **route to detail-page** — it owns that. For app/dashboard/product UI route to **ui-design**; for design→React/Tailwind route to **frontend-build**.

```
HERO          thesis headline (subject-grounded) + subhead (who it's for + the outcome)
              + ONE primary CTA + ONE proof chip (logo row / rating / "12,400 teams")
PROOF BAND    logos, a hard number, or one strong testimonial — within the first scroll
VALUE         3 outcomes (not features), each FAB-translated; one repeated layout primitive
HOW IT WORKS  the mechanism — 3 real steps (only if it's genuinely sequential)
OBJECTIONS    the 3–5 reasons they won't buy, answered: price, trust, effort, switching cost, risk
DEEP PROOF    case study / before-after / data viz — the heaviest evidence, mid-page
PRICING       value-before-price; anchored tiers (see §7)
FAQ           the literal sales objections, in the customer's words
FINAL CTA     restate the ONE outcome + risk-reversal + the CTA, repeated
```
- **Above-the-fold job**: in ~5 seconds answer *what is it, who's it for, why care, what do I do next*. If the fold needs a scroll to answer "what is it", the hero failed.
- **One primary action per page.** Secondary links (docs, login) are visually demoted — never two equal-weight buttons competing. The primary CTA gets the 10% accent color (the 60-30-10 rule from aesthetics.md) and is repeated at every decision point, not just the bottom.
- **Trust/risk-reversal** sits *adjacent to* each CTA: guarantee, free trial, "no card", security badge, refund policy. Risk-reversal converts because it transfers the risk from buyer to seller at the decision moment.
- **Social proof placement**: one proof element in the first viewport (cheap credibility), the heaviest proof (case study/numbers) mid-page right before the pricing ask. Specific proof ("cut onboarding from 6 days to 1") beats vanity ("trusted by thousands").
- **Urgency/scarcity — honest only.** Real deadline, real stock, real cohort cap. A countdown that resets on refresh, or "only 3 left" that's always 3, is the fastest way to torch trust (and it's BANNED below).

## 4 · CRO core — friction vs motivation

Conversion happens when **motivation > friction + anxiety** at the moment of action (the Fogg-model lens, applied). You move the number by raising motivation or lowering friction — and **friction is usually the cheaper, higher-leverage lever.**

- **Cut friction**: fewer form fields (every field drops completion ~ measurably — ask only what you'll use), no forced account before value, autofill, defer hard questions to after the micro-yes, kill the carousel (people don't swipe), one column on mobile.
- **Raise motivation**: sharper outcome in the headline, stronger proof near the ask, a deadline/scarcity that's real, value framed before price.
- **Lower anxiety**: risk-reversal, security/privacy cues at the field, social proof at the decision point, transparent pricing (no "contact us" if you can avoid it for self-serve).
- **One decision at a time.** Each section asks for exactly one micro-yes that earns the next scroll.

## 5 · Build

Write the real copy first (placeholder copy makes a page feel as templated as placeholder visuals), then build the page through the suite's craft skills — don't reinvent their work:
- **Visual token system + anti-slop**: `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/references/aesthetics.md` (two-pass method, banned default fonts/colors, 60-30-10, 8pt grid).
- **Korean long-scroll sales page**: hand to **detail-page** (it also generates image assets and benchmarks against real Wadiz captures).
- **App/SaaS UI, forms, states**: **ui-design**. **Design→code (React/Next + Tailwind v4 + shadcn/ui)**: **frontend-build**.
- **Tokens/theming/handoff**: **design-system**. **Flows/IA/wireframes/acceptance criteria**: **ux-flows**. **Brand voice/identity**: **brand-identity**.

## 6 · Instrument before you launch (no measurement = no CRO)

You cannot optimize what you don't measure. Wire this in at build time, not after.

- **Events** — track the funnel, not clicks-for-clicks' sake. Name them `object_action`, lowercase snake_case, consistent: `page_view`, `cta_click`, `signup_started`, `signup_completed`, `checkout_started`, `purchase`. Put the *primary metric* event on every conversion surface. Tools: **PostHog** (events + funnels + session replay + flags, self-serve), **GA4** (free, reach), **Plausible** (privacy-light pageview). For this user, the data-analytics skill wires PostHog + Aurora directly.
- **UTM hygiene** — one schema, lowercase, no spaces: `utm_source` (facebook/google/newsletter), `utm_medium` (cpc/email/social/referral), `utm_campaign` (launch_2026q1), `utm_content` (variant_a / hero_v2), `utm_term` (keyword). Inconsistent casing (`Facebook` vs `facebook`) splits your data into garbage — lock a convention and a builder.
- **Funnel** — define the ordered steps in PostHog/GA4 and read the **drop-off between steps**, not absolute counts. The biggest %-drop step is your highest-leverage fix. Segment the drop by source/device — a funnel that converts on desktop and dies on mobile is a mobile-friction bug, not a copy bug.

## 7 · Pricing & offer presentation

- **Value before price.** Never show the number before the reader has accepted the value — price shown too early is just a cost. Stack the value (what's included, the outcome, the proof) immediately above the price.
- **Anchor.** Show the high tier or the "what it's worth / what it replaces" first, so the real price reads as a relief. An enterprise tier makes the middle tier look reasonable even if nobody buys enterprise.
- **Tier with a decoy.** Three tiers, with the **middle one marked "Most popular"** as the intended default (center-stage / decoy effect). Order high→low or low→high deliberately; most SaaS leads with the recommended middle highlighted.
- **Reduce the number's pain**: annual billing shown as monthly-equivalent ("$16/mo billed annually"), charm pricing ($49 not $50) where it fits the brand — but charm pricing on a premium brand cheapens it; override for luxury positioning.
- **Frame against the alternative**: "less than one freelancer day", "the cost of 2 coffees a week". Concrete comparison > abstract dollars.
- For Korean reward/tier ladders and the 72h funding-window scarcity, route to **detail-page**.

## Channel copy — short, concrete templates

The page is the destination; the channel earns the click and must **match the page's awareness level and promise** (mismatch = bounce). Hard limits matter — write to them.

**Email** (subject ≤ ~50 chars / preview ≤ ~90 chars / body PAS, one CTA):
```
Subject : {curiosity or specific outcome — no "Newsletter #14"}    e.g. "Your form is losing 6 of 10 signups"
Preview : {the payoff the subject implies — NOT "View in browser"}  e.g. "A 3-field fix we tested last week →"
Body    : [P] one-line pain the reader feels today
          [A] the cost of leaving it (1 line)
          [S] your fix + the proof + ONE link (button, not 5 links)
P.S.    : the offer/deadline restated (P.S. is the 2nd-most-read line)
```
Avoid the spam-filter tells (ALL CAPS subjects, "FREE!!!", excessive `!`). Personalize on behavior, not just `{first_name}`.

**Paid ad** (hook in the first ~125 chars / 1 angle per ad — test angles, not adjectives):
```
Hook  : pattern-interrupt or named pain      "Still exporting to CSV by hand?"
Angle : ONE of {pain · outcome · objection · curiosity · social-proof · us-vs-status-quo}
Body  : agitate → mechanism → CTA matching the landing fold (message match!)
CTA   : low-commitment for cold ("See how it works"), direct for warm/retargeting
```
The **angle** is the test variable. Six ads = six angles, not six color swaps.

**Social (organic)**: lead with the hook line (the feed truncates ~2 lines before "more"); one idea per post; a concrete number or specific story beats a generic tip; CTA is soft (comment/save/DM), the hard sell lives on the page.

**Push / SMS** (≤ ~10 words, one job, real reason to open now): `{benefit/event} + {action}`. "Your draft expires in 2h — finish it →". Never push without a genuine reason; it's the fastest channel to get muted.

## A/B & experimentation

**Form one hypothesis — fill every slot, no blanks:**
> Because **[insight/evidence: e.g. session replay shows 60% abandon at the 8-field form]**, changing **[X: cut form to 3 fields + defer the rest]** will **[move metric: lift signup-completion]** by **[estimate: ~15–25%]**, measured by **[event: signup_completed / signup_started]**.

**Test in this order (highest leverage first):**
1. **The offer / value proposition** (what you're selling and the deal) — biggest swings.
2. **The hero** (headline + subhead + primary CTA) — first thing everyone sees.
3. **Proof & objection handling** (which proof, where).
4. **Form / checkout friction** (fields, steps).
5. **CTA copy** (verb, first-person).
6. *Only then* layout/visual details. **Button color is near the bottom — testing it before the offer is the BANNED rookie move.**

**Sample-size sanity (don't peek, don't ship noise):**
- Quick rule of thumb per variant: `n ≈ 16 · p(1−p) / δ²` where `p` = baseline CVR, `δ` = absolute lift you want to detect (MDE), at ~80% power / 95% confidence. Example: baseline 5% (`p=.05`), detect +1pt (`δ=.01`) → `n ≈ 16·.0475/.0001 ≈ 7,600` per variant. Use **Evan Miller's calculator** or a stats tool to confirm — don't eyeball it.
- **Pre-compute the runtime**: required n ÷ daily traffic per variant = days. If it's > ~4 weeks, your traffic can't support that small an MDE — test a **bigger swing** (new offer/hero), not a tweak.
- **Don't peek and stop on the first "significant" blip** (inflates false positives). Fix the duration/sample up front, or use a tool with sequential testing built in: **GrowthBook** or **Statsig** (free tiers, feature-flag + experiment), **VWO**/**Optimizely** (visual editor). Run full weeks to absorb day-of-week effects.
- **Don't test trivia.** Button color, a comma, one icon — the effect is smaller than the noise; you'll "win" on randomness. Reserve tests for things big enough to matter.

## Analytics — the few numbers that matter

Per stage, watch the **one or two** numbers that move money; ignore the rest:
- **Awareness**: CTR, hook/thumb-stop rate, CPC. (Impressions alone = vanity.)
- **Consideration**: scroll depth, time-to-proof, micro-conversion (lead/email) rate.
- **Conversion**: **CVR** (the headline number), form-completion %, cart-abandon %.
- **Retention**: activation rate, D7/D30 return, repeat-purchase.
- **Unit economics** (CEO lens, high-level): **CAC** (spend ÷ new customers), **LTV** (avg revenue × gross margin × lifetime). Rule of thumb: **LTV:CAC ≥ 3:1** and CAC payback < ~12 months for a healthy funnel. A page that lifts CVR lowers CAC directly.
- **Read a drop-off**: find the step with the biggest %-fall, segment it (source × device), form a hypothesis on *why*, test the fix. A 70% drop at checkout-start is a friction/trust problem; a 70% drop at the hero is a message-match problem.

## BANNED — the generic conversion tells (override only with a real reason)

- ❌ **Empty-vessel verbs**: "Build the future", "Empower", "Unlock", "Transform", "Supercharge", "Seamless", "Revolutionary", "Game-changing", "Next-level". They claim nothing and convert nothing — replace with the specific outcome.
- ❌ **Feature-dump with no benefit** — a spec list with no FAB translation, no "so what for me".
- ❌ **One CTA at the bottom only** — the reader decides at many points; give them the action at each.
- ❌ **Two equal-weight primary CTAs** competing in the hero — one primary, everything else demoted.
- ❌ **Vanity metrics** as proof ("1M+ impressions", "thousands of users") — use specific, verifiable outcomes.
- ❌ **Fake scarcity / fake urgency** — resetting countdowns, perma-"only 3 left", invented "ends tonight". Torches trust and is a dark pattern. Real deadlines only.
- ❌ **Superlative claims in a saturated market** ("the best/fastest/#1") at sophistication 4–5 — pivot to mechanism or new-category framing (§1).
- ❌ **Testing button color / micro-copy before testing the offer or hero** — optimizing noise.
- ❌ **Price before value** — the number shown before the value stack reads as pure cost.
- ❌ **Message mismatch** — ad promise ≠ landing-page headline; the reader feels bait-and-switched and bounces.
- ❌ **Carousels for primary content** — most users never advance past slide 1; put the message in the static fold.
- ❌ **Honorifics of AI design**: emoji bullets, 3 mismatched-icon equal cards, centered-everything, the big-number-hero+stats+gradient template (these are visual slop — see aesthetics.md's banned list).

## VERIFY — pre-launch conversion checklist (gates ship)

Render and screenshot the built page FIRST — grade the pixels you SEE, not the code (the shared loop's SHOOT step). Run the suite's screenshotter, then read its JSON gate:
```bash
NODE_PATH=$(npm root -g) AXE=1 GATE_EXIT=1 \
  node ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/shoot.js <file.html|url> /tmp/mc-shots
# read /tmp/mc-shots/run.json →
#   mobileOverflowPx   > 1                       = hard fail (read overflowCulprits[]; never mask with overflow-x:hidden)
#   axe.gatingCount    > 0 at serious/critical   = hard fail (CTA contrast, button names, form labels)
#   gate.report.overall === false                = a block check failed (GATE_EXIT=1 makes the process exit 1 for CI)
```
Then walk the checklist against the tiles. Any **NO** blocks ship until fixed.
- [ ] **Stage + metric named** — this surface has one funnel stage and one primary metric, and the page is built for it.
- [ ] **5-second test** — fold answers what/who/why/next without scrolling (screenshot the fold; cover the body; can you tell what it is?).
- [ ] **Message match** — the hero headline matches the awareness level and the upstream ad/email promise.
- [ ] **One primary action** — exactly one primary CTA weight; it's the focal accent; repeated at each decision point, not bottom-only.
- [ ] **Benefit-led** — every feature is FAB-translated; no naked spec list; lead copy is the customer's outcome.
- [ ] **Proof present & specific** — one proof in the first viewport, heaviest proof before the pricing ask; numbers are concrete, not vanity.
- [ ] **Objections answered** — the top 3–5 reasons-not-to-buy each have a block or FAQ line, in the customer's words.
- [ ] **Risk-reversal adjacent to CTA** — guarantee / free trial / no-card / refund visible at the ask.
- [ ] **Value before price**; tiers anchored; intended default highlighted (§7).
- [ ] **Urgency is honest** — every deadline/scarcity claim is real.
- [ ] **No BANNED verbs/claims** — grep the copy for "future/empower/unlock/transform/seamless/revolutionary"; zero hits.
- [ ] **Instrumented** — primary-metric event fires; UTM convention locked; funnel steps defined; baseline known.
- [ ] **Mobile** — single column, ≥48px touch CTA, zero 390px horizontal overflow (`shoot.js` `mobileOverflowPx ≤ 1`), sticky CTA where appropriate.
- [ ] **Independent grade** — the **design-critic** agent (not the builder) scored it; **a11y-auditor** cleared WCAG (CTA contrast/labels).

Then score on `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/references/review-rubric.md` — the conversion dimensions are **Hook, Structure, Benefit-vs-feature, Empathy (customer-voice, not "we're great"), Proof, One-message, Urgency/CTA, Trust/risk-reversal**. **Ship gate: overall ≥ 8/10 with no single dimension < 7.** If below, fix the 2–3 lowest dimensions, re-shoot, re-score — and record what changed so a later pass doesn't repeat a rejected idea.

## Sources
- Eugene Schwartz, *Breakthrough Advertising* (awareness × sophistication) · PASONA (Kotaro Kanda) · AIDA / PAS / FAB classics.
- Fogg Behavior Model (B = MAP: motivation, ability, trigger) — the friction/motivation lens.
- CXL / Baymard Institute (checkout & form friction research) · Refactoring UI (proof/hierarchy).
- Evan Miller's A/B sample-size calculator · GrowthBook / Statsig docs (sequential testing).
- Shared suite spine: `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/references/{aesthetics,korean-detailpage,review-rubric}.md` + `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/shoot.js`. Sibling skills: detail-page · ui-design · frontend-build · design-system · ux-flows · brand-identity. Independent graders: **design-critic** + **a11y-auditor** agents.
