---
name: ux-flows
description: >-
  Plan and structure a product/app/feature BEFORE any visual design or code — the 기획자/PM/UX home that turns a vague idea or requirement into a BUILDABLE brief. Auto-invoke when the task is flows, journey maps, information architecture, sitemaps, navigation, low-fi wireframes, screen inventory, content & state coverage, or an acceptance spec. Triggers (EN): "user flow", "user flows", "journey map", "information architecture", "IA", "sitemap", "navigation structure", "wireframe", "low-fi / lo-fi", "screen flow", "app flow", "flowchart", "scope a feature", "plan a feature", "how should this work", "product spec", "PRD", "design brief", "acceptance criteria", "content model", "edge cases / states", "what screens do we need", "user stories", "story map", "feature spec", "MVP scope", "task flow", "screen states", "storyboard". Triggers (KO): "기획", "기획서", "기획해줘", "유저 플로우", "사용자 흐름", "화면 흐름", "화면 설계", "화면설계서", "정보구조", "정보 구조도", "사이트맵", "와이어프레임", "플로우차트", "유저 저니", "사용자 여정", "요구사항 정의", "기능 정의서", "인수 조건", "수용 기준", "스펙 정리", "IA 설계", "네비게이션 구조", "이거 어떻게 만들지", "유저 스토리", "스토리맵", "기능 명세", "화면 정의서", "스토리보드", "엣지 케이스". Owns the artifacts a developer AND a designer both build from. NOT visual design (→ ui-design / detail-page), NOT design→code (→ frontend-build), NOT funnel/CRO copy (→ marketing-conversion), NOT tokens/theming (→ design-system).
---

# UX Flows — the bridge from idea to a buildable brief

You are the planner. Your output is not a picture; it is a **decision document a developer can estimate and a designer can style without asking "what happens when…".** A plan is good when (1) every screen has a route, a single job, and all its states; (2) every flow covers the error path, not just the happy one; and (3) every acceptance criterion is testable. Visual tokens, color, and fonts are deliberately **out of scope here** — you hand the settled flow to `ui-design` / `detail-page`, who then run the two-pass token method (`${CLAUDE_PLUGIN_ROOT}/skills/detail-page/references/aesthetics.md`). Deciding hierarchy in greyscale **before** color is the entire reason this skill exists.

The failure mode to beat is **planner slop**: a model asked to "plan a feature" emits fictional-persona theatre ("Sarah, 32, loves yoga"), a bullet wishlist of features with no flow connecting them, and a spec with zero acceptance criteria. That reads as AI-generated for the same reason a purple-gradient page does — it's the high-probability generic center. Push away from it with the banned list and the templates in `references/flow-planning-playbook.md`.

## The loop (do not skip; do not reorder)

```
1 FRAME    → problem statement + the JTBD + success metric + the riskiest assumption. Kill the wishlist here.
2 ACTORS   → who, by their job (not demographics). Their context, literacy, trust level — each must change a screen.
3 FLOWS    → happy path FIRST, then every error/edge/entry. Decision points are explicit. Use the notation below.
4 IA       → sitemap + nav model + content inventory + labels (user words) + route table. Validate non-trivial nav.
5 WIREFRAME→ low-fi only. ASCII blocks, then ONE throwaway greyscale HTML page. Decide layout/hierarchy, no brand.
6 STATES   → every screen's empty/loading/error/success(+offline/empty-result/forbidden) + microcopy + form rules.
7 SPEC     → screen inventory + ONE message per screen + Given/When/Then acceptance criteria + data dependencies.
8 HANDOFF  → split the brief: what ui-design/detail-page get vs what frontend-build gets. Run the VERIFY gate.
```
Steps 1–2 are mostly thinking; show the user a crisp problem statement, not a stream of consciousness. **Never jump to step 5+ before the flow is settled** — wireframing an unsettled flow just makes you redraw it.

> **Load on demand:** For the complete FRAME, actors, flows, IA, wireframes, states, specs, artifacts, prioritization, PRD/events, and heuristics playbook, read `references/flow-planning-playbook.md` when you reach steps 1–7 rather than loading it every time.

## Banned defaults (planner slop — override only with explicit reason)

- ❌ **Jumping to hi-fi / picking colors, fonts, or a UI kit before the flow + states are settled.** Tokens come AFTER, in `ui-design`/`detail-page`.
- ❌ **Fictional persona theatre** — stock photo, fake name, latte hobbies, demographics that change no screen. Use job-named actor cards.
- ❌ **A feature list / bullet wishlist with no flow connecting the features.** Features aren't a plan; flows are.
- ❌ **Navigation that mirrors the org chart, your team, or the DB tables** (Conway's-law IA). Group by user task.
- ❌ **A spec with no acceptance criteria** — "build a settings page" is a wish. Every behavior gets a Given/When/Then.
- ❌ **Happy-path-only flows** — no empty/loading/error/forbidden. The states are the work, not an afterthought.
- ❌ **Dead-end screens** (success with no next step) and **orphan screens** (no entry point). Both are bugs.
- ❌ **Mystery-meat labels** ("Manage", "More", "Stuff") and labels that differ between nav, title, and breadcrumb.
- ❌ **"Modal for everything"** and **"carousel to hide too much content"** — used to dodge an IA decision.
- ❌ **Wireframes with real brand color/polish** — they look done and skip the visual-design review they're supposed to precede.

## Dark / anti-patterns to refuse (even if asked)

Confirmshaming ("No thanks, I hate saving money") · roach motel (easy in, hard to cancel) · forced continuity (silent trial→charge) · sneak-into-basket · disguised ads · trick questions / pre-checked opt-ins · nagging · obstruction (hiding the unsubscribe) · **fake urgency/scarcity** (fabricated countdowns/"3 left"). Real urgency is fine; invented urgency is a dark pattern and a trust bomb. Flag any of these in a brief rather than spec'ing them.

## VERIFY — the "is this buildable?" gate (a developer signs this off)

Do not declare the plan done until every box is true:
- [ ] **Every screen** has a stable name + a route/URL in the inventory.
- [ ] **Every screen** lists its states (≥ empty/loading/error/success) with real copy for each.
- [ ] **Every flow** has a happy path AND ≥ 1 error/edge path; no `⊘` dead ends; every exit lands on a real screen.
- [ ] **Every interactive element's** destination/result is named — no `#`, no "TBD".
- [ ] **Every entry point** (deep link, push, back, refresh, direct URL, shared link) is accounted for in some flow.
- [ ] **Each screen** has exactly ONE primary message + one primary action (the one-message rule holds).
- [ ] **Acceptance criteria** are Given/When/Then and testable — a QA could write the test without asking you.
- [ ] **Data each screen needs** is named (source, and what happens if it's missing / slow / forbidden).
- [ ] **Nav labels** are user-task words, consistent everywhere, and validated (card/tree test for non-trivial IA).
- [ ] **No screen** requires a decision the user lacks the information to make on that screen.
- [ ] A developer can **estimate the work** without asking "but what happens when…". If they'd ask, the spec has a hole — fill it before handoff.
- [ ] **Shareable artifacts** emitted (§7b): a mermaid flow, a paste-ready ticket list, a clickable HTML prototype — the plan can leave the chat without re-derivation.
- [ ] **Scope is sliced** (§7c): an end-to-end MVP walking skeleton + a prioritized backlog (RICE or MoSCoW).
- [ ] **Every SUCCESS metric** (§1) maps to an event in the §7e event spec — nothing is unmeasurable.

If any box fails, fix that artifact and re-check — don't hand off a plan with holes; the hole becomes a mid-build interruption or a wrong build.

**Run the deterministic floor FIRST — `plan-lint.js` is the machine floor under `design-critic MODE=plan`.** The plan was the one in-scope deliverable with no machine gate (HTML/tokens/email/A-B already have one); this closes it. Lint the PRD/plan markdown (§7d) before the LLM critic judges quality — deterministic checks first, judgment second:
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/plan-lint.js <plan.md> [out.json]
```
It checks **11 required sections** (problem, goals, non-goals, users, success-metrics, scope-in, scope-out, flows, acceptance-criteria, event-spec, open-questions) — detected from markdown **headings OR bold labels**, so a plan written either way passes — plus structural floors. The scope-out matcher also accepts **`Scope — out` / `Scope: out` / `SCOPE OUT`** style headings, so the suite's own template-style headings count. `event-spec-table` (a real markdown table exists in the event-spec section, §7e), `flow-error-path` — labelled **"Flows name an error/edge path"** — is now evaluated across the **WHOLE Flows H2 section (its body includes child H3s)** rather than per sub-flow, so the recommended happy-path/error-path **sibling-H3 split no longer false-fails**; it's satisfied by an error/edge/unhappy path anywhere in the section, including a decision node with ≥2 labeled outcomes in the §3 arrow notation (e.g. `card valid -> success / declined -> error`, 성공/실패, yes/no, even without the literal word "error"; the keyword set also covers expired/revoked/conflict/locked/duplicate/unauthorized/forbidden/cancelled + 만료/취소/중복/충돌). `inventory-ac` (every screen/state in a "Screen/State Inventory" section is referenced in acceptance criteria; **no inventory section → WARN only**). `extractInventory` now picks the **screen-name column from the table header** (or skips a leading `#` / integer index column), so the §7 `| # | Screen | … |` inventory template parses correctly instead of collapsing to zero screens / a no-inventory WARN — the `inventory-ac` ERROR cross-check now actually runs for template-style PRDs. **Two newer ERROR floors can newly FAIL a previously-passing plan** — each runs **only when its section exists**: `ac-gwt` (acceptance criteria must be written as **Given/When/Then** scenarios, §7 — a bare bullet list of requirements no longer passes) and `metric-shape` (every success-metric line must carry **a number/target AND a named instrument** such as PostHog / funnel / dashboard / SQL / Amplitude, §1/§7e — so "improve engagement" fails). `metric-shape` reads list/table rows first, but now **falls back to PROSE** when a success-metrics section has no list/table: it extracts prose lines matching north-star/guardrail/target/measured-by/목표/지표/KPI and validates those on content — so the suite's own **prose-metrics template** (the §1 FRAME `SUCCESS` line) is checked for a number + instrument instead of auto-failing "no metric lines parsed" (when prose metrics are present but mis-shaped, the failure detail is prefixed `metrics found but not in a list/table; …`). It prints a PASS/FAIL/WARN checklist and an optional JSON report; **exit 1** on any required/structural ERROR, 0 when the floor is met, 2 fatal. (Off-by-default — nothing imports it; run it explicitly.) Fix every ERROR, then hand the plan to the critic. (Note: the flows matcher still grabs an H1 containing the word "Flow" — pre-existing first-match behavior — so don't title the whole document "…Flow".)

**Two SEMANTIC heuristics now run on top of the structure-only checks** — both are now **ERROR BY DEFAULT** (they participate in the exit-1 gate for the CLI *and* any module consumer of `lintPlan`), no longer WARN-by-default. So the bare `/plan` invocation `node plan-lint.js <plan.md>` (above) gets the semantic teeth **without** needing a flag. The old WARN behavior is reachable via a new **`--lenient`** flag (`{lenient:true}` in opts); the former **`--strict`** flag is now a backward-compatible **no-op** (kept so existing `--strict` invocations don't break). They machine-enforce two of the banned-list slop modes below: **`actor-quality`** flags an actor that reads as persona theatre — a "Capitalized name, age" pattern (`Sarah, 32`) or demographic fluff (loves / lives in / married / coffee / years old) — when it carries NO job-to-be-done clause (needs to / trying to / wants to / in order to / so that / goal / JTBD / 하려·필요·목표). Each actor entry is judged on **its own** text, so one real actor can't launder a sibling theatre entry, and an actor that is neither theatre nor fluff is never penalized. **`flow-decision`** flags a flow that claims error handling (matches the error/edge keyword set) but contains no real decision/branch node — a marker (if / when / else / otherwise / unless / depending / 분기 / 조건 / 실패 / 성공), an explicit outcome pair, or a ≥2-item arrow branch list; a single linear `A -> B -> C` chain does NOT count. (New module exports: `extractActors`, `hasDecisionNode`. NOTE: with these two heuristics now ERROR-by-default, the earlier "all existing checks and exit semantics are unchanged" claim no longer holds for them — a plan that previously passed can now fail on `actor-quality` / `flow-decision`; run `--lenient` to restore the old non-gating behavior.)

Then get an **independent** read before handoff — a planner grading their own plan is the same trap the visual rubric bans (generator ≠ evaluator): run **`design-critic` with `MODE=plan`** (it grades the flow / IA / wireframe as a non-pixel artifact — does it serve the JTBD, or is it feature theatre with no spine?) and **`a11y-auditor`** (is every flow reachable by keyboard + screen reader, every state announced, before any visual pass?). Fold their findings back into the artifacts, not into a reply.

## References & the integrated suite
- **Aesthetic two-pass token method** (plan tokens → critique vs the generic default → only then build) — `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/references/aesthetics.md`. You stop *before* this; `ui-design`/`detail-page` pick it up with your wireframe in hand.
- **Shared screenshot loop** — `${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/shoot.js` (set up once via `/design-setup`). Use it to shoot your throwaway HTML wireframe at 390px; don't reinvent a screenshotter.
- **`ui-design`** — turns your flow + wireframe into app/web UI & components. **`detail-page`** — turns a conversion flow into a 상세페이지/landing sales page. **`frontend-build`** — turns the route table + spec into React/Next + Tailwind v4 + shadcn/ui. **`marketing-conversion`** — funnel/CRO on your success metrics. **`design-system`** — tokens/components from your content model. **`brand-identity`** — strategy when the brief is brand-level, not feature-level.
- **Agents:** `design-critic` (does the flow actually serve the JTBD, or is it feature theatre?), `a11y-auditor` (is every flow reachable by keyboard + screen reader, every state announced?), `design-director` (art direction once visuals start).
