## Running under ultracode (multi-agent workflow)

The loop above is single-agent. Under **ultracode** (the multi-agent Workflow runtime) — or whenever the user asks to "use a workflow" / fan this out — run the loop as a deterministic workflow instead, so plan candidates compete and every round still gates on **real screenshot pixels**:

```
Workflow({
  scriptPath: '${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/ultracode-workflow.js',
  args: { skillRoot: '${CLAUDE_PLUGIN_ROOT}/skills/detail-page',  // REQUIRED for portability (see note below)
          subject, brief, mode: 'detail'|'landing', platform: 'wadiz',
          category: 'ai-digital'|'physical'|'auto',
          outFile: '/tmp/detail-page/index.html',
          shotsDir: '/tmp/detail-page/shots', rounds: 3,
          // optional, all off by default:
          jury: 'advisory'|'strict',  // add a FREE cross-model (GPT/Gemini) vision second-opinion in Score
          claudeSeed: true,           // add 1 extra plan candidate seeded with the frontend-design directions
          govern: true,               // after the loop, enforce brand-lint + emit a SHIP/NO-SHIP enterprise report
          noEarlyStop: true }         // run all rounds even if a round stalls
})
```
(`args` may arrive as a JSON string via the Workflow tool — the script parses it; pass a real object regardless. **`skillRoot` is required:** the Workflow sandbox cannot resolve its own filesystem path, so the script points every subagent at the skill's scripts/references via the `skillRoot` you pass — set it to this skill's install dir, `${CLAUDE_PLUGIN_ROOT}/skills/detail-page`.)

It runs Plan (3 divergent token-system plans, +1 if `claudeSeed` → a design-director synthesis) → Build → Shoot (`scripts/shoot.js`, with `AXE=1` + the broken-asset/overflow gates) → Score (INDEPENDENT adversarial grade vs `review-rubric.md`, calibrated against the real captures; +cross-model jury if `jury`), iterating Build→Shoot→Score until the ship gate passes. It returns the **best** round (not merely the last) when the gate isn't met, and stops early on a genuine stall (unless `noEarlyStop`). With `govern`, a brand-lint failure blocks ship and the return adds `report` (enterprise-report path) + `brandClean`. Workflow subagents do **not** auto-load this skill, so the script points every agent at absolute paths built from the `skillRoot` you pass (above) — that is what makes it portable across machines. `category:'auto'` infers AI/digital from the brief and loads `wadiz-ai-digital-benchmark.md` + its extra gate. The workflow writes to `/tmp` by default; copy the final file into your project afterward. Workflow is gated on explicit opt-in — only launch it when ultracode is on or the user asked for orchestration; otherwise run the single-agent loop above.

