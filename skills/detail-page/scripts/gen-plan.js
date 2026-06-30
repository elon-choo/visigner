// gen-plan.js — PLANNING engine: expand a page brief into a cohesive image asset plan
// (the "기획" step) via a text LLM, ready to feed into gen-assets.js. No external deps.
// Keys from env: OPENAI_API_KEY or GEMINI_API_KEY.
//
// Usage:
//   NODE_PATH=$(npm root -g) node gen-plan.js <brief.json> [out-asset-plan.json]
//   echo '{...brief...}' | node gen-plan.js - [out]
// Env:
//   PLAN_PROVIDER=openai|gemini       default: openai
//   OPENAI_PLAN_MODEL=gpt-5.2
//   GEMINI_PLAN_MODEL=gemini-3.1-pro-preview
//   IMG_PROVIDER=openai|gemini        default provider assigned to slots (gemini wins for Korean-text slots)
//
// brief.json: { "subject", "mode":"detail|landing", "category":"ai-digital|physical",
//               "palette":"deep ink charcoal / cream / marigold amber", "oneMessage":"...",
//               "sections":["hero","authority",...], "notes":"..." }
// Output asset-plan.json: { style, styleDNA, slots:[{ id, prompt, aspect, provider, tier, target, textFree?, overlayText? }] }
//   styleDNA = frozen spec (exact product/hex/materials/camera) prepended to every slot for set consistency.
//   tier:"hero" = a key slot eligible for best-of-N in gen-assets.js (run with BEST_OF_N=N).
//   target = where the image goes in the page (CSS selector or human description) for the 배치 step.
//   textFree:true + overlayText:[{kr,role}] = generate a CLEAN backdrop (no baked text) and overlay the
//     Korean copy as crisp HTML/Tailwind at build — zero glyph risk for text-heavy slots.

const fs = require('fs');

const inPath = process.argv[2];
if (!inPath) { console.error('usage: node gen-plan.js <brief.json|-> [out.json]'); process.exit(1); }
const outPath = process.argv[3] || '/tmp/detail-page-assets/asset-plan.json';
const brief = inPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(inPath, 'utf8');

const PROVIDER = process.env.PLAN_PROVIDER || 'openai';
const OPENAI_PLAN_MODEL = process.env.OPENAI_PLAN_MODEL || 'gpt-5.2';
const GEMINI_PLAN_MODEL = process.env.GEMINI_PLAN_MODEL || 'gemini-3.1-pro-preview';
const IMG_PROVIDER = process.env.IMG_PROVIDER || 'openai';

const SYSTEM = `You are the art director for a Korean crowdfunding (Wadiz) / 상세페이지 detail page.
Given a page brief, design a COHESIVE set of image assets to generate. Output STRICT JSON only.

Rules:
- Extract the brief's palette + subject into ONE shared "style" preamble (lighting, palette, finish, "no watermark, no gibberish text") that will be prepended to every slot so the set looks like one art-directed shoot.
- Also emit a "styleDNA" block: a FROZEN, reusable spec prepended verbatim to every slot for SET CONSISTENCY — the exact product description, exact hex codes (e.g. #2B2B2B), key materials/finish, and a default camera (focal length + aperture). Keep it tight and concrete; it is the glue that makes a 10-16 image set look like one shoot.
- Cover the Wadiz asset grammar with 8-16 slots: hero product/scene shot, product/cover mockups, a before/after or bad-example contrast pair, a mechanism/diagram visual, deliverable thumbnails (covers/devices/sheets), review portraits, maker photo, an event/CTA background band. Skip slots that are better as live UI/CSS (e.g. a real logo row) — note that in "target".
- Each slot: { "id" (kebab-case, unique), "prompt", "aspect" (one of "1:1","3:4","4:3","16:9","9:16","4:5","5:4"), "provider" ("gemini" for ANY slot with baked-in Korean text — it renders Hangul accurately; otherwise "${IMG_PROVIDER}"), "tier" ("hero" for the 2-3 most important slots — hero/cover/key money shot — so they can be best-of-N selected; omit for the rest), "target" (CSS selector or short description of where it is placed in the page) }.
- TEXT-FREE BACKGROUND + HTML OVERLAY (preferred for text-heavy slots — eliminates glyph risk): when a slot's value is mostly a Korean headline/typographic banner/CTA over a backdrop, do NOT bake the words into the image. Instead set "textFree": true, write the "prompt" for a CLEAN backdrop with deliberate empty/negative space where the text will sit (state the safe area, e.g. "lower-left third kept clean and slightly darkened for legible overlay text"), and list "overlayText": [{ "kr": "정확한 한글 문구", "role": "headline|sub|cta" }] — the build step renders these as crisp HTML/Tailwind text on top. Reserve baked-in text only for slots where the typography must physically interact with the scene (foil stamping, signage, packaging).
- PROMPT CRAFT (high-end, per slot): write each "prompt" as labeled blocks — Subject / Style / Lighting / Camera / Palette — and ALWAYS include a Camera block with concrete cinematography: focal length + aperture + framing + light direction (e.g. "85mm f/1.4, three-quarter framing, soft window light from camera-left"). For multi-object scenes, give each object its own line to avoid attribute bleed. Describe what should be ABSENT in positive terms (e.g. "clean uncluttered background" not "no clutter"); put any junk-exclusions ("no watermark, no gibberish text, no fake logos") at the very end. If Korean text MUST be baked ON the image (not text-free), state the EXACT Korean string in quotes.
- Do NOT invent fake brand logos or real people's faces. Maker/review portraits must be generic, non-identifiable.
- Output shape EXACTLY: { "style": "...", "styleDNA": "...", "slots": [ ... ] }  — no prose, no markdown fences. (Slots may additionally carry the optional "textFree"/"overlayText" fields described above.)`;

async function viaOpenAI(userText) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OPENAI_PLAN_MODEL,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userText }],
      response_format: { type: 'json_object' },
      max_completion_tokens: 8000,
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error('openai ' + r.status + ': ' + (j.error?.message || JSON.stringify(j).slice(0, 200)));
  return j.choices?.[0]?.message?.content;
}

async function viaGemini(userText) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_PLAN_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ parts: [{ text: userText }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error('gemini ' + r.status + ': ' + (j.error?.message || JSON.stringify(j).slice(0, 200)));
  return j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
}

(async () => {
  const userText = 'PAGE BRIEF (JSON or text):\n' + brief;
  const raw = PROVIDER === 'gemini' ? await viaGemini(userText) : await viaOpenAI(userText);
  let planObj;
  try { planObj = JSON.parse(raw); }
  catch (_) {
    const m = raw && raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('planner did not return JSON: ' + String(raw).slice(0, 200));
    planObj = JSON.parse(m[0]);
  }
  if (!planObj.slots || !planObj.slots.length) throw new Error('plan has no slots');
  require('fs').mkdirSync(require('path').dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(planObj, null, 2));
  console.log(JSON.stringify({ outPath, provider: PROVIDER, model: PROVIDER === 'gemini' ? GEMINI_PLAN_MODEL : OPENAI_PLAN_MODEL, slots: planObj.slots.length, ids: planObj.slots.map((s) => s.id) }, null, 2));
})().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
