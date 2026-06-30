# Review rubric & ship gate

Run this AFTER screenshotting the page (`scripts/shoot.js`) — grade what you SEE in the tiles, not the code. Be adversarial: you are trying to catch the page looking AI-generated or failing to convert.

## A · Anti-slop visual audit (pass/fail — any fail blocks ship)
- [ ] No Inter/Roboto/Arial/Open Sans/Lato/system font; a distinctive display+body pairing is actually loading.
- [ ] No unearned purple/indigo/violet AI default; purple/blue is allowed only when the brief/category justifies it and the page uses concrete proof artifacts plus non-purple secondary accents.
- [ ] Not everything centered — at least one asymmetric / split / content+asset layout.
- [ ] Not 3–7 equal cards with mismatched icons; one repeated layout primitive instead. No emoji as icons/bullets.
- [ ] Not uniform border-radius + soft shadow on every surface; emphasis is concentrated, not spread.
- [ ] Hero is subject-grounded, not the big-number+stats+gradient template.
- [ ] Copy is specific — no "Build the future / Empower / Unlock / Transform", no two-noun feature titles.
- [ ] Not one of the three AI clichés (cream+serif+terracotta · near-black+acid-green · broadsheet hairline).
- [ ] Quality floor: responsive to mobile (shoot at 390px wide too), visible keyboard focus, `prefers-reduced-motion` respected.
- [ ] 8pt spacing rhythm holds; type scale steps are visibly distinct; line-heights aligned.
- [ ] **No horizontal overflow at 390px.** `shoot.js` reports `mobileOverflowPx` in `run.json`; **>1px is a hard fail** — read `overflowCulprits` and fix the offending element (a fixed-width child, an un-wrapped long token, a grid that didn't collapse). Do NOT mask it with `overflow-x:hidden`.
- [ ] **Mobile sticky thumb-zone CTA present** (detail mode) — a fixed bottom purchase/CTA bar appears at ≤680px in the natural thumb reach, recaps price/benefit + one action (≥48px target), honors `env(safe-area-inset-bottom)`, and the body reserves space so it never covers the last section.
- [ ] **a11y gate (when run):** `AXE=1 node shoot.js …` scans both the desktop and the 390px-mobile DOM (so the mobile-only sticky bar is covered) and reports `axe.gatingCount` in `run.json`; **a non-zero count at the serious/critical impact is a fail** (contrast, names, roles, labels). Fix the violation, don't suppress the rule. (`axeClean: null` = axe couldn't load, not a pass — re-run.)
- [ ] **No broken assets** (always-on; `ASSETS=0` opts out): `run.json.gate.assetsOk` must be `true`. Any failed request (4xx/failed) for a document/image/font/CSS/JS/media URL, or an `<img>` that loaded to 0px, is a **hard fail** — read `assets.badResponses` / `assets.brokenImages` and fix the path (the #1 silent defect once real generated PNGs are placed). Don't ship with a missing asset.
- [ ] **Read the rollup, not the scatter:** `run.json.gate.report = { overall, checks[] }` is the single machine verdict — `overall:false` means a block check failed; per-check `pass:null` = unknown/skipped (re-run, don't treat as pass). A workflow/CI can hard-gate with `GATE_EXIT=1` (exit 1 when `overall===false`).
- [ ] **Optional gates (when enabled, all opt-in):** `VR=1` visual-regression vs an approved baseline (`gate.visualClean`; `VR_BASELINE=1` to approve a new look; a `*-diff.png` is emitted on mismatch); `PERF=1` synthetic CWV tripwire (`gate.perfBudget` — CLS/LCP and a transfer-byte budget that **counts network resources**, so a CDN-loaded page reports real KB while a fully-local page reports 0 and no-ops; lab/load-only, not CrUX); `BRANDS=a,b` per-brand axe+overflow in `run.json.brands[]` (proves each `[data-brand]` stays accessible/non-overflowing). A `null` on any of these = not run / unknown, never a pass.

## B · 10-dimension score (1–10 each)
| Dim | 5/10 | 9/10 |
|---|---|---|
| **Hook** | Generic product title up top | Stops the scroll with one emotional/number hook + clear payoff |
| **Structure** | Feature dump, no narrative | Clear 후킹→공감→해결→증명→CTA (or hero→proof→value→CTA) arc; reader is pulled |
| **Benefit vs feature** | Lists specs | Every feature framed as a customer benefit first |
| **Empathy** | Brand-voice "we're great" | Customer-voice "this is my problem" |
| **Proof** | Self-praise, vague claims | Specific numbers, real reviews, Before/After, certs — repeated mid-scroll |
| **One message** | Many competing claims | One memorable takeaway |
| **Visual craft** | Tiny mobile type, walls of text, flat | Clean bands, mobile-legible, GIF/video demos, dividers, intentional hierarchy |
| **Urgency/CTA** | One bottom button, no reason to act now | Urgency above each CTA, repeated CTAs, focal accent, ≥48px target; mobile sticky thumb-zone bar carries a scarcity/deadline line |
| **Trust/risk-reversal** | No policy / hidden | Clear refund/exchange, certs, transparent shipping |
| **Aesthetic distinctiveness** | Could be any AI page | Reads as designed for *this* subject; one memorable signature element |
| **(detail mode) Story & rewards** | Reads like an open-market listing | Maker reason up front + tiered scarce rewards exploiting the 72h window |
| **(AI/digital Wadiz) Tangibility** | Digital offer is only described | Mockups, tool screens, deliverables wall, curriculum, package economics make the product feel concrete |

## Ship gate
**Ship only at overall ≥ 8/10 with no single dimension < 7, and zero fails in section A.**
If below: list the 2–3 lowest dimensions, make the specific fix each implies, return to build step 4, re-shoot, re-score. Record what you changed between passes (so later passes don't repeat a rejected idea). Before declaring done, "remove one accessory" — cut the weakest decorative element.

Extra gate for Wadiz AI/digital products: at least 8 benchmark modules from `wadiz-ai-digital-benchmark.md`, plus one bad-example/contrast block, one mechanism block, one deliverables wall, and one package-economics block. Reference captures used for benchmarking must cover the page (`coveredHeight >= pageHeight`) unless intentionally capped and documented.

## Capture-anchored calibration (grade against real pixels, not your prior)

Before scoring, open the two saved **real Wadiz** captures as few-shot anchors so "good" is pinned to pages that actually shipped and converted, not to a model's averaged idea of a nice page:
- `references/captures/400620/index.html` — AI/automation tone (dark + lime, automation product).
- `references/captures/403454/index.html` — template/digital tone (blue-purple + mint).

Use them as the calibration scale: a tile only earns a high **Aesthetic distinctiveness** / **Tangibility** score if it holds up *beside* these — same density of concrete artifacts, same intentional rhythm, same "made for this subject" specificity. If your page looks generic next to them, score it down and name the gap.

**Pairwise distinctiveness (do this BEFORE assigning the 1–10).** In-context pairwise comparison beats an absolute scale. Put the candidate hero + 3 representative tiles next to the matching tiles of one real capture (`400620` for AI/automation tone, `403454` for template/digital) and rank: does the candidate look **more / equally / less** convincingly hand-designed? Name the *specific* tell that decides it ("less hand-designed than `400620` tile_03 — flat equal cards vs its layered evidence objects"). Then map: **≥ the capture → 8+**, roughly equal → 7–8, **clearly less → < 7** (a hard block, since distinctiveness must reach 8 to ship). Anchor the number to the comparison, never to a free-floating vibe.

**Weighting:** when picking the 2–3 lowest dims to fix, treat **Aesthetic distinctiveness** as the highest-leverage dimension (it is what most separates a real page from AI slop) — never let a page ship at distinctiveness < 8 even if the average clears the gate.

**Independent evaluator rule (generator/evaluator split):** whoever (or whichever agent) *built* the page must not be the one that grades it. The evaluator reads only the rubric + the tiles + these anchors, and — for the strongest pass — re-renders the live file (`shoot.js`, or live navigation) instead of trusting hand-offs, so real overflow / focus / sticky-bar behavior is graded from pixels, not claims.

## How to grade honestly
- Read the actual screenshot tiles; name the specific tell you see ("hero uses centered big-number + gradient — template hero"), don't hand-wave "looks good".
- Compare against a real reference captured with `scripts/capture-reference.js` (or the saved captures above) when one exists.
- Check `run.json`: `mobileOverflowPx` (>1 = §A fail), `axe.gatingCount` (>0 at serious/critical = §A fail when AXE was run).
- If you can't point to evidence in a tile for a score, the score is unverified — say so.
