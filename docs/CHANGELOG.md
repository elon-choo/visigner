# Changelog

## 1.5.0 — Install-only: the pixel browser auto-provisions (2026-07-16)

v1.4 made the **grade** the default. v1.5 makes the **pixel self-critique loop** install-only too, so a beginner who never runs a single command still gets the full loop.

### Added
- **Background browser auto-provisioning** — the first time you save a design `*.html` on a machine that lacks the Patchright/Chromium browser, Visigner kicks off the ~150MB install **in the background** (`hooks/auto-provision-browser.js`, spawned detached + `unref`'d from the auto-grade hook). The first save grades static-only while it downloads; from the next save the pixel loop is on. No command required. Single-flight (a lock file prevents duplicate installers), fail-open (any error never breaks the grade/human-gate emit), and opt-out via `VISIGNER_NO_AUTO_BROWSER=1`. `/design-setup` remains the manual/offline/CI fallback and the way to force a reinstall after a plugin update.

### Changed
- **Docs site rebuilt for craft + correctness** — `docs/{index,guide,how-to}.html`. Fixed a real desktop layout bug where the guide/how-to left index rail (viewport-`fixed`, positioned by `calc(50% - …)`) collided with the separately-centered content column and clipped the H1 in the ~1120–1440px range; the rail is now a real CSS-grid track (`.doc`) that shares one coordinate system with the content and cannot overlap, collapsing to a sticky chapter-chip rail below 1120px and a compact strip on mobile. Removed a lone raised middle-card (a `box-shadow` surviving a flat-card override) and restored three distinct **flat** card materials so a card row is never a uniform-frame AI tell. Dark editorial bands became contained content-width panels (no more rail floating over them mid-scroll). All copy reframed to the install-only model, and the install-only story is now the **visual centerpiece** rather than a grey meta line: an "auto band" right after the hero on all three pages states it at display size ("설치 두 줄. 그다음은 전부 자동입니다.") and lays the whole thing out as one glanceable contrast — 당신이 하는 것 **2** (install, save) versus 그 순간 자동으로 **4** (anti-AI grade · STOP checklist · the pixel browser auto-installing in the background · the pixel loop) — closing on "예전엔 `/design-setup`을 알아야 켜졌습니다. 이제 몰라도 됩니다." All three pages still self-grade `verdict=clean · s2Pass=true · 100/A` with 0 mobile overflow.

## 1.4.0 — Auto-activation spine (2026-07-14)

The anti-slop grade is now **default, not something you remember to run.** Producing an `*.html` design artifact auto-fires the check, and the honest gaps a machine can't fix are surfaced in plain language.

### Added
- **Auto-grade on write** — a `PostToolUse` hook (`hooks/hooks.json` → `hooks/run-node.sh` → `hooks/auto-critique-hook.js`) grades every `*.html` design artifact the moment it's written, with no manual call and no silent skip. When a browser is present it renders + captures for pixel critique; when not, it loudly says *pixel critique is OFF — run `/design-setup`* and still runs the static grade (fail-closed).
- **Human-gate STOP checklist** — after the grade, a plain-language, numbered checklist enumerates the human-must-do gaps (placeholder images still lo-fi comps, unfinished/stand-in copy, unsourced numeric claims, missing image credentials) with a concrete fix each. It only detects + suggests — it never fabricates the missing data (verified byte-identical + 0-spawn/0-write).
- **First-run onboarding** — the first time you produce a design in a workspace (detected read-only, no marker written), a one-time plain-language welcome explains what happened, why it matters, the exact one-tap next steps, and the starter defaults in effect. It does not re-narrate on an established workspace or for an expert.
- **Zero-config provisioning** — first-design-task browser auto-detect → a one-tap guided/consented install (never silent, never auto-run without consent), image-credential auto-detect with the exact one-line enable per gap, idempotency + re-run-after-update, and a `design-doctor` rollup (browser + credentials + hook-active status + per-gap fix, zero-network, never crashes).

### Fixed
- **Frontmatter hotfix** — 9 skill/agent `description:` frontmatters were YAML-invalid (unquoted plain scalars containing `: ` colon-space), which made them load with EMPTY metadata; converted to folded block scalars so `claude plugin validate --strict` passes and their auto-invoke triggers register. Description text byte-identical.

### Also added (owner decision)
- **Font/colour token check folded into the auto-fire** — the auto-grade now runs brand-lint and folds its AI-tell rules into the score, so a **banned font (Inter/system-ui) is now scored** in the grade's `token_discipline` dimension (−2 per finding), instead of being silently ignored. This is an *advisory* dock, not a hard ship-gate: a banned font alone does not flip `s2Pass` (an otherwise-clean Inter page still scores ~93/A) — it surfaces the tell in the grade. Unearned purple is scored in OKLCH/token form; hex purple is flagged as build-hygiene (reported, not scored). Only the *AI-tell* rules score; build-hygiene rules (raw hex, off-grid) are reported but never demote a hand-written page (verified: raw-hex-using clean pages stay 100/A). `/design-review` still produces the full brand-lint report on demand. Fails open — if brand-lint can't run, the grade proceeds without it.

### Known scope (honest)
- **Machine-clean is necessary, not sufficient** — a page can score 100/A and still read as AI, so the taste-suspect flag + a human eye are carried, never replaced by the machine score.
- The live auto-fire depends on the plugin being **enabled** in your Claude Code session; confirm it fires once in your own session after install.
