# Design Core — architecture (the layered model)

Visigner is **one core, many disciplines**. This note is the map: what is shared, what is per-discipline, and the direction dependencies flow. Read it when you need to reason about the system as a whole (or extend it).

## The stack

```
                       ┌─────────────────────────────────────────────┐
   DISCIPLINES         │ detail-page · ui-design · design-system ·    │  build a specific artifact
   (7 skills)          │ brand-identity · ux-flows · frontend-build · │
                       │ marketing-conversion                         │
                       └───────────────┬─────────────────────────────┘
                                       │ consume ↓ (never re-derive)
   CORE (this skill)  ┌────────────────┴────────────────────────────────────────────┐
                      │ Tokens   OKLCH 3-layer (primitive→semantic→component)          │
                      │ Aesthetics  two-pass anti-slop method + screenshot critique     │
                      │ Image    global generation (gpt-image-2 / gemini-3-pro / imagen)│
                      │ Gate     brand-lint · tell-count · shoot                         │
                      │ Publish  designsync-bundle + DesignSync tool → claude.ai/design  │
                      └─────────────────────────────────────────────────────────────────┘
```

## Dependency rules (keep the layers honest)
- **Disciplines depend on the core, never the reverse.** A discipline reads tokens, calls the image service, runs the gate. The core knows nothing about any one artifact.
- **One artifact = one token set + one style DNA.** When a job spans disciplines (brand → system → page → code), thread the SAME tokens and the SAME frozen style DNA through all of them, or the output fragments into N unrelated looks.
- **The core wraps, it does not fork.** `image-service.js` shells to the verified `gen-*` engine and injects latest-model defaults; it never copies generation logic. If the engine improves, the core inherits it for free. Same for the gate scripts.
- **Markup references semantic tokens only** (see the `design-system` skill for the three-layer contract). The core's image + publish layers never bake raw hex/fonts either.

## Why the engine physically lives under `detail-page` (not moved)
The proven image + token + gate scripts historically live in `skills/detail-page/scripts/` and `skills/detail-page/references/`. They are **not relocated**, on purpose:
- Their relative `require()`s and the shipped plugin layout stay intact (no regression risk to a deployed tool).
- The core adds a **thin, stable façade** (`image-service.js`, `designsync-bundle.js`) so callers depend on `design-core/…`, not on a detail-page internal path. If the physical home ever changes, only the façade moves.

## Where to make a change
- New shared capability every discipline needs → add a façade script here + document it in `SKILL.md`.
- Change to how images are generated → the engine in `detail-page/scripts/` (`gen-assets.js` / `lib-openai-responses.js`); the core picks it up automatically.
- New model default → prefer setting it in `image-service.js` `withLatestDefaults()` (an explicit env still wins) rather than editing the engine.
- A per-artifact concern (a new landing section, a new component variant) → the owning discipline skill, not here.
