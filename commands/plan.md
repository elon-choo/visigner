---
name: plan
description: Plan a product/app/feature into a buildable brief BEFORE any visual design or code — PRD, user flows, IA, wireframes, scope/prioritization, and shareable artifacts. Use to plan a feature, write a PRD/spec, define requirements, or draft wireframes/flows. Triggers (EN) "plan this", "plan a feature", "write a PRD", "spec this out". Triggers (KO) "기획", "PRD 만들어줘", "요구사항 정리", "와이어프레임/플로우 짜줘".
---

# /plan — turn a vague idea into a buildable, shareable brief

Brief: **$ARGUMENTS**

Invoke the **ux-flows** skill and run its loop (FRAME → ACTORS → FLOWS → IA → WIREFRAME → STATES → SPEC → HANDOFF) to its VERIFY gate — do not improvise a wishlist or persona theatre.

1. **Pin the brief in one line** — `<who>` can't `<do what>` because `<obstacle>`; fill the §1 FRAME block (problem, JTBD, scope IN/OUT, success metric, riskiest assumption). Kill the feature wishlist here.
2. **Run the loop** — job-named actor cards (not demographics), happy-path-first flows with every error/edge/entry, IA + route table, greyscale low-fi wireframe, full state coverage, and Given/When/Then acceptance criteria. Never jump to wireframes before the flow is settled.
3. **Emit the shareable artifacts** (§7b) — a **mermaid** flow (renders on GitHub/Notion/Linear; PNG it via `shoot.js` if asked), a paste-ready **JIRA/Linear ticket list** (one row per screen/state: title · acceptance criteria · route), and a **clickable greyscale HTML prototype** stakeholders can click through before visual design.
4. **Scope & sequence** (§7c) — slice the thinnest end-to-end MVP walking skeleton and prioritize the backlog with RICE (or MoSCoW). Decide the **event spec** (§7e) now so the success metric is measurable, not retrofitted.
5. **Generate the PRD** (§7d) from the FRAME block — problem, goals/non-goals, users, success metrics, scope in/out, flows, events, open questions — plus an optional one-page exec summary for sign-off.
6. **Clear the VERIFY gate** — every screen has a route + states with real copy; every flow has an error path and no dead ends; every metric maps to an event; the shareable artifacts exist. Fix any failing box before handoff.

Then get an **independent** read: run **`design-critic` with `MODE=plan`** (does the flow serve the JTBD, or is it feature theatre?) and **`a11y-auditor`**, and fold findings back into the artifacts. Hand the settled brief to `ui-design`/`detail-page` (visuals) and `frontend-build` (route table + spec). You stop before colors/fonts — that's deliberate.
