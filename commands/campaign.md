---
name: campaign
description: Run ONE campaign idea consistently across every channel — landing, paid ad, social, and an email sequence — with cross-surface message-match enforced, not hoped for. Use for "campaign", "launch campaign", "런치 캠페인 짜줘", "캠페인 만들어줘", "one idea across channels", "메시지 일관성", "메시지 매치", "채널별 카피 일관되게", multi-channel launch copy, or a go-to-market message ladder.
---

# /campaign — one idea, every channel, message-match enforced

Brief: **$ARGUMENTS**

The job is message DISCIPLINE: a launch fails when each channel invents its own angle. Pin a single idea first, ladder it down to each surface, then prove consistency with the deterministic floor **and** an independent grade — never declare it consistent on your own say-so.

## 1 · Pin the ONE idea
State the single campaign idea in one line — a specific promise, not a category label (e.g. "slow coffee, fast mornings", not "premium coffee"). Everything below must restate THIS. If you cannot write it in one line, you do not have a campaign yet. Write it down; it is the `--idea` string in step 3.

## 2 · Build the per-surface ladder
For each surface, lock four things — **message** (the line, restating the one idea in that channel's voice), **awareness** (unaware → most-aware stage the surface meets), **angle** (the specific hook), **metric** (the one number you'd move). Keep the message a restatement of the pinned idea, not a new claim.

- **Landing** — hero headline + subhead; the full empathy → proof → CTA arc lives here.
- **Paid ad** — `headline` (≤40 chars) + `primaryText` (≤125 chars, the hook in the first line) + `cta`.
- **Social** — `text` whose FIRST line is the hook (it is all most people see before "…more") + `cta`.
- **Email sequence** — 3–5 emails that ARC (hook → value → proof → offer → urgency), each with subject + preheader + a single CTA. Do not write N interchangeable blasts.

Emit the surfaces as one spec for the linter — `{ "surfaces": [ {channel, …}, … ] }` — and the email sequence as a directory of specs for the email floor.

## 3 · Run the deterministic floor (machine-checkable, before any grading)
- **Cross-surface copy floor** — `node ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/copy-lint.js <surfaces.json> --idea "<the one idea>"` (add `--lexicon voice.json` if a brand lexicon exists). It enforces per-channel length budgets, the AI-slop banned-verb list (Empower / Unlock / Transform / Build the future / …), a required CTA, and — via `--idea` — flags any surface whose hero does not restate the pinned idea (message-match). Exit 1 = an error-severity finding; fix it, don't ship around it.
- **Email floor** — `node ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/email-lint.js <email-sequence-dir/>` for the subject/preheader/CTA/spam floor across the sequence (it dedupes a spec+HTML pair so each email counts once).

## 4 · Independent grade (the builder must not be the sole judge)
Hand the copy to **`design-critic` with `MODE=copy`** for the conversion + voice read the linter can't make: subject/angle strength, awareness×sophistication fit, benefit-vs-feature, voice consistency ACROSS the sequence, claim substantiation, and the sequence arc. Fold its findings back in.

## 5 · Verdict
Ship only when the copy floor passes (zero errors), the email floor passes, message-match holds on every surface, and `design-critic MODE=copy` returns PASS. Emit: the pinned idea, the per-surface ladder table, the two linter results, and the MODE=copy grade — then the single highest-leverage fix if anything is short of ship.
