// ultracode-workflow.js — run the detail-page skill as an ultracode (multi-agent) workflow.
// Invoke from the main loop when ultracode is ON (or the user asks for a workflow):
//   Workflow({ scriptPath: '${CLAUDE_PLUGIN_ROOT}/skills/detail-page/scripts/ultracode-workflow.js',
//              args: { skillRoot: '${CLAUDE_PLUGIN_ROOT}/skills/detail-page',
//                      subject, brief, mode, platform, category, outFile, shotsDir, rounds } })
// skillRoot is REQUIRED for portability: the Workflow sandbox has no __dirname/require/process.env, so
// it cannot resolve its own path — the model fills skillRoot from this skill's install dir. On the
// original dev machine it defaults to ~/.claude/skills/detail-page.
// It fans the skill's loop across subagents (which do NOT auto-load the skill, so every
// agent prompt points at the skill's absolute file paths) and gates on REAL screenshot pixels,
// not code. Plan candidates run as a judge panel; build->shoot->score iterates to the ship gate.
// Defaults write to /tmp; copy the final file into your project afterward.

export const meta = {
  name: 'detail-page-ultra',
  description: 'Ultracode workflow for the detail-page skill: plan (judge panel) -> build -> shoot -> score, iterating to the ship gate by grading real screenshot tiles.',
  phases: [
    { title: 'Plan', detail: '3 divergent token-system plans + a design-director synthesis' },
    { title: 'Assets', detail: 'optional: plan + generate real image assets (gpt-image-1.5 / gemini-3-pro-image)' },
    { title: 'Build', detail: 'write the page from the locked plan (revise on later rounds)' },
    { title: 'Shoot', detail: 'render + screenshot with scripts/shoot.js (AXE + 390px overflow gate)' },
    { title: 'Score', detail: 'INDEPENDENT evaluator: grade tiles vs review-rubric.md, calibrated against the real Wadiz captures' },
  ],
}

// The Workflow runtime may hand `args` over as a JSON STRING (this harness does) or as a parsed object.
// Parse the string form so { subject, brief, ... } actually reaches the planner instead of silently
// falling through to the generic default (which made the page ignore the requested subject).
const a = typeof args === 'string'
  ? (() => { try { return JSON.parse(args) } catch (_) { return {} } })()
  : (args && typeof args === 'object' ? args : {})
// Skill root: the caller passes it (the model knows this skill's install dir). Installed as a plugin it
// is "${CLAUDE_PLUGIN_ROOT}/skills/detail-page"; falls back to the dev path. MUST arrive via args.skillRoot
// because the Workflow sandbox cannot resolve its own filesystem path.
const SKILL = a.skillRoot || '/Users/elon/.claude/skills/detail-page'
const subject = a.subject || a.brief || 'a product detail page'
const brief = a.brief || subject
const mode = a.mode || 'detail' // 'detail' (상세/Wadiz) | 'landing'
const platform = a.platform || 'wadiz'
const category = a.category || 'auto' // 'ai-digital' | 'physical' | 'auto'
const outFile = a.outFile || '/tmp/detail-page/index.html'
const shotsRoot = a.shotsDir || '/tmp/detail-page/shots'
const rounds = a.rounds || 3
// Optional image-asset generation: a.assets = false | true | 'openai' | 'gemini' (provider for non-Korean-text slots)
const genAssets = a.assets || false
const assetsDir = a.assetsDir || '/tmp/detail-page/assets'
const imgProvider = typeof genAssets === 'string' ? genAssets : 'gemini'

const isAiDigital =
  category === 'ai-digital' ||
  (category === 'auto' &&
    /\b(ai|gpt|claude|automation)\b|프롬프트|템플릿|강의|클래스|자동화|전자책|디지털|노션|figma|피그마|vod|구독|키트|패키지/i.test(brief))

const refs = [`${SKILL}/SKILL.md`, `${SKILL}/references/aesthetics.md`]
if (mode === 'detail') refs.push(`${SKILL}/references/korean-detailpage.md`)
if (isAiDigital) refs.push(`${SKILL}/references/wadiz-ai-digital-benchmark.md`)
refs.push(`${SKILL}/references/tooling.md`, `${SKILL}/references/review-rubric.md`)
const refList = refs.map((r) => `- ${r}`).join('\n')

const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    concept: { type: 'string', description: 'one-sentence design concept grounded in the subject' },
    colors: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { name: { type: 'string' }, hex: { type: 'string' }, role: { type: 'string' } },
        required: ['name', 'hex', 'role'],
      },
    },
    type_system: {
      type: 'object',
      additionalProperties: false,
      properties: {
        display: { type: 'string' },
        body: { type: 'string' },
        accent: { type: 'string' },
        kr_note: { type: 'string', description: 'Korean webfont choice (Pretendard + KR display) if mode=detail' },
      },
      required: ['display', 'body'],
    },
    layout: { type: 'string', description: 'layout concept, not centered-everything' },
    signature: { type: 'string', description: 'the one element the page is remembered by' },
    sections: { type: 'array', items: { type: 'string' } },
    rationale: { type: 'string', description: 'why this beats the generic default for THIS subject' },
  },
  required: ['concept', 'colors', 'type_system', 'layout', 'signature', 'sections'],
}

const BUILD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    outFile: { type: 'string' },
    wrote: { type: 'boolean', description: 'true only if the file was actually written/edited and verified to exist' },
    sections_built: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['outFile', 'wrote', 'summary'],
}

const SHOOT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ran: { type: 'boolean', description: 'true only if PNG tiles were actually produced' },
    shotsDir: { type: 'string' },
    pageHeight: { type: 'number' },
    coveredHeight: { type: 'number' },
    desktopTiles: { type: 'number' },
    fullyCovered: { type: 'boolean', description: 'coveredHeight >= pageHeight' },
    mobileOverflowPx: { type: 'number', description: 'run.json.mobileOverflowPx — horizontal overflow at 390px; >1 is a hard fail' },
    axeGatingCount: { type: 'number', description: 'run.json.axe.gatingCount — serious/critical a11y violations; >0 is a fail' },
    assetsOk: { type: 'boolean', description: 'run.json.gate.assetsOk — false if any request failed or an <img> loaded to 0px' },
    gateReportOverall: { type: 'boolean', description: 'run.json.gate.report.overall — false if any block-severity check failed' },
    note: { type: 'string' },
  },
  required: ['ran', 'shotsDir'],
}

const SCORE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    overall: { type: 'number' },
    dims: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          dim: { type: 'string' },
          score: { type: 'number' },
          evidence: { type: 'string', description: 'the specific tell you SEE in a named tile' },
        },
        required: ['dim', 'score', 'evidence'],
      },
    },
    section_a_fails: { type: 'array', items: { type: 'string' } },
    lowest: {
      type: 'array',
      description: '2-3 lowest dimensions, each with the specific fix it implies',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { dim: { type: 'string' }, fix: { type: 'string' } },
        required: ['dim', 'fix'],
      },
    },
    gate_pass: { type: 'boolean' },
    notes: { type: 'string' },
  },
  required: ['overall', 'dims', 'section_a_fails', 'lowest', 'gate_pass'],
}

const planContext =
  `You are designing a ${mode === 'detail' ? 'Korean 상세페이지 / crowdfunding (Wadiz-style) page' : 'landing page'}.\n` +
  `Subject / brief: ${brief}\nPlatform: ${platform}  ·  AI/digital product: ${isAiDigital}\n\n` +
  `First Read these skill files IN FULL (you do not have the skill pre-loaded):\n${refList}\n\n` +
  `Follow the skill's Step-2 token-planning discipline and obey the banned-defaults list exactly. ` +
  `Ground every choice in the subject's own materials, vocabulary, and artifacts — that is where non-generic choices come from.`

// Vendored INLINE (nothing fetched at runtime) — the Anthropic frontend-design "pick one and commit" directions.
const CLAUDE_SEED_DIRECTIONS = `Five high-conviction art directions — pick exactly ONE and commit fully (do NOT blend), then ground it in THIS subject:
1. Editorial — magazine typography, strong serif display, generous columns, rules/eyebrows that encode real structure.
2. Brutalist/structural — raw grid, monospace accents, hard borders, high-contrast blocks, function-forward.
3. Retro-futurist — a period-specific palette + display face (70s/80s/Y2K), tasteful grain/chrome, not pastiche.
4. Refined/luxury — restraint, deep neutrals + one metallic-or-jewel accent, big whitespace, slow rhythm.
5. Playful/maximalist — bold color, oversized type, motion-implied layout, disciplined to ONE signature (not noise).`

phase('Plan')
const planTasks = [0, 1, 2].map((i) => () =>
  agent(
    `${planContext}\n\nYou are plan candidate #${i + 1} of 3. Deliberately pursue a DIFFERENT visual direction from the other two: vary the dominant color family, the display typeface, and the layout concept. Do not converge on a benchmark template — produce a direction specific to THIS subject. Return your full token system + section arc.`,
    { label: `plan#${i + 1}`, phase: 'Plan', schema: PLAN_SCHEMA },
  ),
)
// Opt-in (a.claudeSeed): one extra Anthropic-frontend-design-seeded candidate that enters the SAME synth + gates.
// Its risk (some directions overlap banned clusters, e.g. retro cream+serif+terracotta) is a FEATURE — §A kills those.
if (a.claudeSeed) planTasks.push(() =>
  agent(
    `${planContext}\n\n${CLAUDE_SEED_DIRECTIONS}\n\nYou are the frontend-design-seeded candidate: pick ONE of the five and commit, BUT then obey the skill's banned-defaults list exactly (the §A bans + the three AI clichés — if your chosen direction lands on one, push it off it) and ground every choice in THIS subject. Return your full token system + section arc.`,
    { label: 'plan#seed', phase: 'Plan', schema: PLAN_SCHEMA },
  ),
)
const candidates = (await parallel(planTasks)).filter(Boolean)

const plan = await agent(
  `${planContext}\n\nAct as the design director. Here are ${candidates.length} candidate plans:\n${JSON.stringify(candidates, null, 2)}\n\nPick the strongest, most subject-grounded, least AI-sloppy direction. You may graft the best ideas from the runners-up. Reject anything that matches a banned default (Inter/Roboto, unearned AI-purple gradient, everything-centered, 3 equal icon cards, the three AI clichés). Return ONE final, buildable plan.`,
  { label: 'plan:synth', phase: 'Plan', schema: PLAN_SCHEMA },
)
log(`Plan locked — ${plan.concept}`)

// Optional: 기획→제작 real image assets, then feed their paths to the build agent (배치).
let assetNote = ''
if (genAssets) {
  phase('Assets')
  const ASSETS_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
      ran: { type: 'boolean' },
      assetsDir: { type: 'string' },
      ok: { type: 'number', description: 'count of successfully generated images' },
      total: { type: 'number' },
      slots: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: { id: { type: 'string' }, file: { type: 'string' }, target: { type: 'string' } },
          required: ['id', 'file'],
        },
      },
      note: { type: 'string' },
    },
    required: ['ran', 'assetsDir', 'ok', 'slots'],
  }
  const assetAgent = await agent(
    `Generate the page's real image assets, then report where each one goes. Read ${SKILL}/references/asset-generation.md first.\n` +
      `Steps (run with Bash):\n` +
      `1) Write a brief JSON for this page to /tmp/dp-brief.json from: subject=${JSON.stringify(brief)}, mode=${mode}, category=${isAiDigital ? 'ai-digital' : 'physical'}, palette from the locked plan colors ${JSON.stringify((plan.colors || []).map((c) => c.hex))}, oneMessage=${JSON.stringify(plan.concept)}.\n` +
      `2) Plan: IMG_PROVIDER=${imgProvider} NODE_PATH=$(npm root -g) node ${SKILL}/scripts/gen-plan.js /tmp/dp-brief.json ${assetsDir}/asset-plan.json\n` +
      `3) Make: IMG_PROVIDER=${imgProvider} NODE_PATH=$(npm root -g) node ${SKILL}/scripts/gen-assets.js ${assetsDir}/asset-plan.json ${assetsDir}\n` +
      `4) Read ${assetsDir}/manifest.json AND ${assetsDir}/asset-plan.json, and VISUALLY open each generated PNG. Drop any asset with misspelled Korean or junk text from the slot list (do not place broken assets).\n` +
      `Return ran (true if PNGs exist), assetsDir, ok/total counts, and slots[] of the GOOD assets as {id, file (absolute png path), target (the asset-plan target selector)}.`,
    { label: 'assets:gen', phase: 'Assets', schema: ASSETS_SCHEMA },
  )
  if (assetAgent && assetAgent.ran && assetAgent.ok > 0) {
    log(`Assets — ${assetAgent.ok}/${assetAgent.total} generated in ${assetAgent.assetsDir}`)
    assetNote =
      `\n- USE THESE REAL GENERATED IMAGES (배치): place each as <img src="FILE" alt="meaningful Korean alt"> at its target, replacing the CSS placeholder there. Give each image panel a min-height so mobile doesn't collapse it. Use the absolute file paths.\n` +
      JSON.stringify(assetAgent.slots, null, 2) + '\n'
  } else {
    log('Assets — generation skipped/failed; building with CSS mockups instead.')
  }
}

let lastScore = null
let shipped = false
let bestRound = { overall: -1 } // best-so-far across rounds (the loop may peak then regress)
const triedNoEffect = [] // fixes applied in a round whose overall did NOT rise — don't repeat them
const history = []

for (let round = 1; round <= rounds; round++) {
  const shotsDir = `${shotsRoot}/round-${round}`

  phase('Build')
  const buildPrompt =
    round === 1
      ? `Build the ${mode} page as a SINGLE self-contained HTML file and write it to ${outFile} (create parent directories first).\n\n` +
        `Use THIS plan as the single source of truth (CSS variables for every token; no ad-hoc colors/fonts):\n${JSON.stringify(plan, null, 2)}\n\n` +
        `Read for structure/rules as needed:\n${refList}\n` +
        `Rules that are NOT optional:\n` +
        `- HTML + Tailwind (CDN) or inline CSS. ${mode === 'detail' ? 'Korean page: load Pretendard (jsdelivr CDN) as body + a KR display face; never rely on system fonts for 한글.' : ''}\n` +
        `- 8pt spacing scale, visible keyboard focus, prefers-reduced-motion respected.\n` +
        `- Multi-column grids MUST collapse to one column at <=680px (responsive utilities, or a media query with !important to beat inline grid-template-columns). Give empty image panels a min-height so they don't collapse to 0 on mobile.\n` +
        (mode === 'detail'
          ? `- Conversion arc (PASONA / 후킹→공감→해결→증명→CTA), benefit-before-feature, urgency above each CTA, real-looking proof repeated mid-scroll.\n`
          : '') +
        (isAiDigital
          ? `- AI/digital Wadiz product: include >=8 modules from wadiz-ai-digital-benchmark.md, PLUS at least one bad-example/contrast block, one mechanism block (before pricing), one deliverables wall, one package-economics block. Turn the digital product into concrete visible artifacts (mockups, tool screens, Figma/PDF/VOD/spreadsheet thumbnails) — not abstract bullets.\n`
          : '') +
        assetNote +
        `After writing, verify the file exists (ls/stat). Set wrote=true only if it does.`
      : `Revise the existing page at ${outFile} IN PLACE. The latest screenshot review scored ${lastScore.overall}/10. Fix exactly these, without regressing anything that already scored well:\n` +
        `Lowest dimensions + their required fixes:\n${JSON.stringify(lastScore.lowest, null, 2)}\n` +
        `Section-A hard fails to eliminate:\n${JSON.stringify(lastScore.section_a_fails, null, 2)}\n` +
        `Already tried in earlier rounds (do NOT repeat a rejected idea):\n${JSON.stringify(history, null, 2)}\n` +
        (triedNoEffect.length ? `Fixes already attempted that did NOT raise the score — try a DIFFERENT approach, don't repeat these:\n${JSON.stringify(triedNoEffect, null, 2)}\n` : '') +
        `Edit ${outFile} and verify it still exists; set wrote=true only if it does.`

  const built = await agent(buildPrompt, { label: `build:r${round}`, phase: 'Build', schema: BUILD_SCHEMA })
  if (!built || !built.wrote) {
    log(`Round ${round}: build did not produce a file — stopping.`)
    break
  }

  phase('Shoot')
  const shot = await agent(
    `Render and screenshot the page WITH the assertion gates on. Run this EXACT command (it auto-falls back to Patchright if Playwright is absent):\n` +
      `  AXE=1 MAX_TILES=120 NODE_PATH=$(npm root -g) node ${SKILL}/scripts/shoot.js ${outFile} ${shotsDir}\n` +
      `Then read ${shotsDir}/run.json and report pageHeight, coveredHeight, desktopTiles, shotsDir, ` +
      `mobileOverflowPx (run.json.mobileOverflowPx), axeGatingCount (run.json.axe.gatingCount; 0 if axe failed to load — say so in note), ` +
      `assetsOk (run.json.gate.assetsOk — false means a request failed or an <img> loaded to 0px), and gateReportOverall (run.json.gate.report.overall). ` +
      `Set ran=true only if PNG tiles were actually written to ${shotsDir}. fullyCovered = (coveredHeight >= pageHeight).`,
    { label: `shoot:r${round}`, phase: 'Shoot', schema: SHOOT_SCHEMA },
  )
  if (!shot || !shot.ran) {
    log(`Round ${round}: shoot failed — stopping.`)
    break
  }

  phase('Score')
  const score = await agent(
    `You are the INDEPENDENT evaluator — you did NOT build this page, and you grade only the rubric + the pixels + the real-Wadiz anchors, never the builder's claims. Your job is to PROVE the page looks AI-generated or fails to convert.\n` +
      `1) Read ${SKILL}/references/review-rubric.md in full, including the "Capture-anchored calibration" section.\n` +
      `2) CALIBRATE first: visually open the two real-Wadiz anchors ${SKILL}/references/captures/400620/index.html and ${SKILL}/references/captures/403454/index.html (or their tiles). These pin what a shipped page looks like — grade the candidate BESIDE them.\n` +
      `3) VISUALLY open and read the screenshot tiles in ${shot.shotsDir}: desktop-full.png, every desktop-tile_*.png, and mobile-full.png. Grade what you SEE in the pixels, never the code.\n` +
      `4) Re-check the hard gates from run.json: mobileOverflowPx=${shot.mobileOverflowPx} (>1 → add a Section-A fail), axeGatingCount=${shot.axeGatingCount} (>0 → add a Section-A fail), assetsOk=${shot.assetsOk} (false → a request failed or an <img> is broken → add a Section-A fail). For the strongest pass, re-render ${outFile} live (run shoot.js yourself or navigate it) rather than trusting these numbers.\n` +
      `5) Run the Section-A pass/fail audit, then score all 10 (+detail/AI-digital) dimensions 1-10, each with the specific tell you see in a NAMED tile. For **Aesthetic distinctiveness** do a PAIRWISE rank FIRST: put the candidate hero + 3 tiles beside the matching capture tiles and decide more/equal/less convincingly hand-designed, naming the specific tell, THEN map (>=capture → 8+, clearly less → <7). It is weighted highest and must reach >=8 to ship, regardless of the average.\n` +
      (isAiDigital
        ? `6) Apply the AI/digital Wadiz extra gate: >=8 benchmark modules, plus a bad-example/contrast block, a mechanism block, a deliverables wall, and a package-economics block must all be visibly present.\n`
        : '') +
      `Return overall, the dimension scores with evidence, section_a_fails, the 2-3 lowest dims each with the concrete fix it implies, and gate_pass. ` +
      `gate_pass is true ONLY if overall>=8 AND no single dimension<7 AND Aesthetic distinctiveness>=8 AND zero section-A fails (incl. mobileOverflowPx<=1, axeGatingCount==0, assetsOk!==false)${isAiDigital ? ' AND the AI/digital module gate is met' : ''}. Be honest; if you cannot point to a tile for a score, lower it.`,
    { label: `score:r${round}`, phase: 'Score', schema: SCORE_SCHEMA },
  )

  // --- cross-model vision jury (opt-in via a.jury='advisory'|'strict') — a non-Claude second opinion on
  // "looks AI-generated", over the FREE ChatGPT-OAuth Responses path already shipped in lib-openai-responses.js.
  // A single-Claude evaluator shares Claude's blind spots on the exact thing this skill optimizes. ---
  if (a.jury) {
    const JURY_SCHEMA = {
      type: 'object', additionalProperties: false,
      properties: {
        ran: { type: 'boolean' },
        crossDistinct: { type: 'number', description: '1-10 aggregate (avg across images); omit if it could not run' },
        perImage: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { img: { type: 'string' }, slop: { type: 'number' }, overall: { type: 'number' } }, required: ['img'] } },
        note: { type: 'string' },
      },
      required: ['ran'],
    }
    const jury = await agent(
      `Run a FREE cross-model vision jury — a non-Claude second opinion to break single-model bias on "looks AI-generated". Use Bash only; do NOT route through any MCP/codex tool.\n` +
        `The judge is ${SKILL}/scripts/lib-openai-responses.js (exports scoreImageViaResponses); it judges ONE image at a time over the free ChatGPT-OAuth Responses path (falls back to OPENAI_API_KEY, else cannot run).\n` +
        `1) If neither ~/.codex/auth.json NOR $OPENAI_API_KEY exists, return {ran:false, note:"no auth"} — do NOT error.\n` +
        `2) Else, for ${shot.shotsDir}/desktop-full.png and ${shot.shotsDir}/mobile-full.png (read each to base64), call scoreImageViaResponses({imageB64, brief}) with brief = the review-rubric §A anti-slop checklist + the pairwise instruction (compare against a real Wadiz capture). Collect each image's slop + overall.\n` +
        `3) crossDistinct = the average (on a 1-10 scale) across the judged images. Return {ran:true, crossDistinct, perImage:[{img,slop,overall}], note}.`,
      { label: `jury:r${round}`, phase: 'Score', schema: JURY_SCHEMA },
    )
    if (jury && jury.ran && typeof jury.crossDistinct === 'number') {
      const claudeDistinct = ((score.dims || []).find((d) => /distinct/i.test(d.dim)) || {}).score
      score.crossDistinct = jury.crossDistinct
      score.crossModelGap = claudeDistinct != null ? Math.round((claudeDistinct - jury.crossDistinct) * 10) / 10 : null
      log(`Round ${round}: cross-model distinctiveness ${jury.crossDistinct}/10 (Claude ${claudeDistinct != null ? claudeDistinct : 'n/a'}, gap ${score.crossModelGap})`)
      if (a.jury === 'strict' && jury.crossDistinct < 8 && score.gate_pass) {
        score.gate_pass = false
        score.section_a_fails = [...(score.section_a_fails || []), `cross-model jury distinctiveness ${jury.crossDistinct}<8 (strict)`]
      }
    } else {
      log(`Round ${round}: cross-model jury skipped (${jury && jury.note ? jury.note : 'no result'}) — Claude still gates.`)
    }
  }

  // --- convergence tracking (R3): best-so-far + stall detection, computed against the PREVIOUS round ---
  if (score.overall > bestRound.overall) bestRound = { ...score, round }
  const topDim = score.lowest && score.lowest[0] ? score.lowest[0].dim : null
  const prevTopDim = lastScore && lastScore.lowest && lastScore.lowest[0] ? lastScore.lowest[0].dim : null
  const noGain = lastScore !== null && score.overall <= lastScore.overall
  // a no-gain round whose top-blocking dim is unchanged from the previous round => the loop is spinning on it
  const stuck = noGain && topDim && topDim === prevTopDim
  if (noGain) triedNoEffect.push(...((lastScore && lastScore.lowest) || []).map((l) => l.fix)) // this round's fixes didn't help

  lastScore = score
  history.push({ round, overall: score.overall, lowest: score.lowest, fails: score.section_a_fails, ...(score.crossDistinct != null ? { crossDistinct: score.crossDistinct, crossModelGap: score.crossModelGap } : {}) })
  log(`Round ${round}: ${score.overall}/10 · gate_pass=${score.gate_pass} · best=${bestRound.overall}/10`)
  if (score.gate_pass) {
    shipped = true
    break
  }
  if (stuck && !a.noEarlyStop) {
    log(`Round ${round}: stalled on "${topDim}" with no gain for two rounds — stopping early (best ${bestRound.overall}/10; set noEarlyStop:true to run all rounds).`)
    break
  }
}

// --- optional --govern hard-gate (a.govern): promote brand-lint from a sidecar nobody runs into an
// enforced gate, and emit one SHIP/NO-SHIP enterprise report. Off by default => return shape unchanged. ---
let report = null, brandClean = null
if (a.govern && history.length) {
  const finalScoreObj = shipped ? lastScore : bestRound
  const lastShotsDir = `${shotsRoot}/round-${history.length}`
  const GOVERN_SCHEMA = {
    type: 'object', additionalProperties: false,
    properties: { ran: { type: 'boolean' }, brandPass: { type: 'boolean' }, brandErrors: { type: 'number' }, shipReady: { type: 'boolean' }, reportPath: { type: 'string' }, note: { type: 'string' } },
    required: ['ran'],
  }
  const gov = await agent(
    `Run brand-governance + the enterprise rollup on the FINAL artifact. Use Bash:\n` +
      `0) Write ${lastShotsDir}/score.json containing exactly: ${JSON.stringify({ gate_pass: !!shipped, overall: finalScoreObj && finalScoreObj.overall })}\n` +
      `1) node ${SKILL}/scripts/brand-lint.js ${outFile} ${lastShotsDir}/brand-lint.json — read .pass (brandPass) and .errorCount (brandErrors).\n` +
      `2) node ${SKILL}/scripts/enterprise-report.js ${lastShotsDir} — it rolls up run.json + brand-lint.json + score.json into ${lastShotsDir}/enterprise-report.json (+ .html); read .shipReady and use ${lastShotsDir}/enterprise-report.json as reportPath.\n` +
      `Return {ran:true, brandPass, brandErrors, shipReady, reportPath, note}. If a step genuinely errors, set ran=false and explain — do NOT invent values.`,
    { label: 'govern', phase: 'Score', schema: GOVERN_SCHEMA },
  )
  if (gov && gov.ran) {
    brandClean = gov.brandPass === true
    report = gov.reportPath || null
    if (brandClean === false && shipped) { shipped = false } // banned-default/raw-hex blocks ship under --govern
    log(`Govern: brandPass=${gov.brandPass} (errors=${gov.brandErrors}) · enterprise shipReady=${gov.shipReady} · report=${report}`)
  } else {
    brandClean = null // unknown — govern step couldn't run; never a silent pass
    log(`Govern: step did not run (${gov && gov.note ? gov.note : 'no result'}) — brandClean=unknown.`)
  }
}

return {
  shipped,
  outFile,
  plan: plan.concept,
  finalScore: shipped ? lastScore : bestRound, // when not shipped, return the BEST round, not merely the last
  rounds: history,
  bestRound: bestRound.round,
  ...(a.govern ? { report, brandClean } : {}),
  note: shipped
    ? 'Ship gate met. Deliver the file (docbroker cp-in if the destination is under Documents/Desktop/Downloads).'
    : `Ship gate NOT met after ${history.length} round(s). Best was round ${bestRound.round} at ${bestRound.overall}/10; its lowest dims: ${JSON.stringify(bestRound.lowest)}.${a.govern && brandClean === false ? ' (blocked by brand-lint under --govern)' : ''} Increase rounds, set noEarlyStop, or intervene manually.`,
}
