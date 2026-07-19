---
name: marketing-conversion
description: Make web pages, funnels, and copy CONVERT — the growth/CRO/copywriting half of the Visigner. Auto-invoke for conversion-rate optimization, funnel design, landing-page copy, and experimentation work, in English or Korean. Trigger phrases include CRO, conversion rate, "improve conversions / 전환율 높여줘", landing page copy, "이 페이지 전환 안 돼 / 왜 전환이 안 나오지", hero headline, value proposition / 가치 제안, CTA copy, A/B test / AB 테스트 / 실험 설계, "어떤 걸 테스트해야 해", funnel / 퍼널 / 깔때기, funnel drop-off / 이탈, activation, retention, lead gen, signup flow, email subject line / 이메일 제목, ad copy / 광고 카피 / 후킹 / 훅, paid ad angle, push copy, pricing page / 가격표 / 요금제, offer design / 오퍼, anchoring, "value before price", UTM / 이벤트 설계 / 트래킹, CAC, LTV, CTR, CVR, "make this convert / 전환되게 고쳐줘", PASONA/AIDA/PAS/FAB copy frameworks, Schwartz awareness & sophistication. This skill owns the broad WEB funnel + copy + testing + measurement; it routes Korean 상세페이지/Wadiz/Tumblbug depth and the screenshot self-critique loop to the detail-page skill, app/SaaS UI to ui-design, and design→code to frontend-build.
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

> **Load on demand:** For the complete funnel, copy, CRO, instrumentation, pricing, lifecycle, experimentation, channel-lint, and analytics playbook, read `references/conversion-playbook.md` when you reach steps 0–8 rather than loading it every time.

## BANNED — the generic conversion tells (override only with a real reason)

- ❌ **Empty-vessel verbs**: "Build the future", "Empower", "Unlock", "Transform", "Supercharge", "Seamless", "Revolutionary", "Game-changing", "Next-level". They claim nothing and convert nothing — replace with the specific outcome.
- ❌ **Feature-dump with no benefit** — a spec list with no FAB translation, no "so what for me".
- ❌ **One CTA at the bottom only** — the reader decides at many points; give them the action at each.
- ❌ **Two equal-weight primary CTAs** competing in the hero — one primary, everything else demoted.
- ❌ **Vanity metrics** as proof ("1M+ impressions", "thousands of users") — use specific, verifiable outcomes.
- ❌ **Fake scarcity / fake urgency** — resetting countdowns, perma-"only 3 left", invented "ends tonight". Torches trust and is a dark pattern. Real deadlines only.
- ❌ **Superlative claims in a saturated market** ("the best/fastest/#1") at sophistication 4–5 — pivot to mechanism or new-category framing (`references/conversion-playbook.md` §1).
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
