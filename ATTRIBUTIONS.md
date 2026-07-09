# ATTRIBUTIONS

Visigner is MIT-licensed. This file records third-party work that Visigner
learns from, adapts, or ports, and preserves the upstream license text where
the license requires it.

> **Status of this file (UC1.1 draft).** As of 2026-07-09 **nothing below has
> been ported yet** — every row is **PLANNED**. `grep` for `mechanicalScore`,
> `graded`, and the ui-craft rule ids in `skills/detail-page/scripts/` returns
> nothing; the anti-ai harness is unchanged. When a roadmap goal actually lands
> a port, flip that row's **Status** to `PORTED` and fill the **Ported-in
> (goal · commit)** cell with the goal id and commit hash. Do not mark a row
> PORTED before the code exists.

## ui-craft (`ui-craft-detect`)

- **Upstream:** https://github.com/educlopez/ui-craft
- **npm package:** `ui-craft-detect` v0.11.0 (note: the `evals/quality/score.mjs`
  submodule carries its own `EVAL_VERSION = '0.30.0'` — the distribution
  identifier used here is the npm package version 0.11.0, not the eval version)
- **Author:** Eduardo Calvo
- **License:** MIT — Copyright (c) 2026 Eduardo Calvo
- **Local snapshot used while porting:** `/tmp/ui-craft/` (reference only, not redistributed)

Visigner's `detail-page` skill absorbs patterns from ui-craft — and, where
noted, ports code — as part of the "ui-craft 흡수 업그레이드" roadmap
(`docs/goals/uicraft-upgrade-roadmap.md`). Both projects are MIT-licensed, so
the licenses are compatible. The MIT permission notice below is preserved in
full to satisfy the MIT condition that it "be included in all copies or
substantial portions of the Software."

> **Compatibility caveat:** Visigner declares MIT in `.claude-plugin/plugin.json`
> and `README.md`, but there is **no root `LICENSE` file yet**. Adding a root
> `LICENSE` (MIT) is recommended so the "both projects MIT → compatible"
> premise is materialized as a file, not just a declaration. That edit is a
> separate additive goal / HUMAN_GATE item, not done here.

### What is ported / adapted

Legend — **Status:** `PLANNED` (not yet in tree) / `PORTED` (code landed).
Fill **Ported-in** when Status flips to PORTED.

| # | Item (roadmap goal) | Upstream source | Nature | Attribution required | Status | Ported-in (goal · commit) |
|---|---|---|---|---|---|---|
| 1 | Separation / in-band regression-test pattern (UC1.5) | `evals/quality/score.test.mjs` L343–392 | **Reimplemented — idea.** The class-separation assertion (`designerMin > slopMax`) plus in-band fixture loop is an unprotectable test method. Visigner's port uses KR fixtures, a CommonJS runner, and the `mechanicalScore` field → independent expression. | Courtesy header (recommended) + this entry | PLANNED | _(UC1.5 · —)_ |
| 2 | Exported `WEIGHTS` + `GRADE_BANDS` scoring seam (UC1.4) | `evals/quality/score.mjs` L38–54 | **Reimplemented — architecture only.** The "exported weights table + letter bands, never averaged" seam is an idea. Visigner keeps its own weights (low/med/high = 1/2/3), not ui-craft's `anti_slop 8/4/1`; A–F thresholds (90/80/70/60/0) are conventional grading (scènes à faire). No constants copied. The `token_discipline` axis mirrors ui-craft's *idea* (`WEIGHTS.token_discipline.per_finding = 2`) but is fed by Visigner's own `brand-lint.js` findings — **not** by ui-craft's `mcp/src/tokens-rules.mjs` (no source ported). | Courtesy header at the seam (recommended) + this entry | PLANNED | _(UC1.4 · —)_ |
| 3 | Anti-slop regex rule bodies (U2) | `scripts/detect/rules.mjs` (38 rules total) | **Mixed — highest copyright risk.** Rule *ideas* (what to detect) are free; a lifted regex body, `description`/`fix` string, or `fix_apply` replacement is protected expression. Roadmap absorbs only the **11 non-overlapping "genuine-gap" rules** (`uicraft-analysis.json` → `detector.genuine_gaps_absorb`), each rewritten with KR/Wadiz false-positive guards; overlapping rules (transition-all, purple-cyan-gradient, uppercase, etc.) are already covered by brand-lint/shoot and are **not** copied. | **REQUIRED** header on any file carrying verbatim regex/fix bodies + this entry | PLANNED | _(U2 · —)_ |
| 4 | Agent edit-time PostToolUse hook (U2) | `scripts/detect/hooks.mjs` L1–53 | **Reimplemented — interface-dictated.** The PostToolUse matcher `Edit\|Write\|MultiEdit`, exit-2-feeds-stderr, and fail-open behavior are dictated by the Claude Code hook API (scènes à faire). Manifest-writer body and help text are rewritten for Visigner's own harness. | Courtesy header (recommended) + this entry | PLANNED | _(U2 · —)_ |
| 5 | Config discovery + ignore comments + SARIF output (U2) | `scripts/detect/engine.mjs` (config L12–113, ignore L115–192, SARIF L347–398) | **Reimplemented — convention + external standard.** An rc-file with per-rule `off\|warn\|error` and inline `-ignore` comments is a standard linter convention (ESLint `.eslintrc` + `eslint-disable`); the SARIF shape is fixed by the SARIF 2.1.0 external schema. Markers renamed to `anti-ai-ignore` / `.anti-ai-rc.json`. | Courtesy header (recommended) + this entry | PLANNED | _(U2 · —)_ |
| 6 | Publish / CI deploy scaffold (U4) | `.npmrc`, `.githooks/pre-commit`, `package.json` | **Config + adapted.** `.npmrc` release-hold (`minimum-release-age=2880`) and `package.json` `bin`/`files` allow-lists are functional configuration (not copyrightable). The CalVer `sed`-bump pre-commit technique is adapted into Visigner's existing `.husky/pre-commit`. | Header on the pre-commit only if its bash is substantially lifted; config files need no header + this entry | PLANNED | _(U4 · —)_ |

### Copyrightability principle applied

Ideas, patterns, architectures, method/algorithm (deterministic-vs-judged
separation, exported-weights seam, severity→exit gating, rc-file conventions),
interface-dictated glue, and external-standard output shapes (SARIF) are **not**
copyrightable and are absorbed freely. **Verbatim code** — regex rule bodies,
fix strings, hook payloads, test scaffolding, `toSarif` renderer — is a
protected work; porting it triggers the attribution rules below.

### Rules for contributors

- **Reimplemented** (idea / architecture / convention / interface-dictated):
  a courtesy header comment is **recommended but not required**.
- **Verbatim or near-verbatim** (regex bodies, fix strings, hook payloads, test
  scaffolding copied as-is): **REQUIRED** — add a header comment to the ported
  file:

  ```
  // Ported/adapted from ui-craft (MIT), (c) 2026 Eduardo Calvo — github.com/educlopez/ui-craft
  ```

  plus an entry in this file (flip Status → PORTED, fill goal · commit), plus
  the MIT notice below preserved.
- **Distribution (U4):** any npm / MCP package that ships ported ui-craft code
  MUST include this `ATTRIBUTIONS.md` in its `files` allow-list.

### MIT License (ui-craft) — preserved in full

```
MIT License

Copyright (c) 2026 Eduardo Calvo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
