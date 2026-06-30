// gen-assets.js — PRODUCTION engine: turn an asset plan into real image files via
// the latest image-generation APIs. No external deps (Node 20 built-in fetch).
// Keys from env: OPENAI_API_KEY (gpt-image-*), GEMINI_API_KEY (gemini-*-image / imagen-*).
//
// Usage:
//   NODE_PATH=$(npm root -g) node gen-assets.js <asset-plan.json> [outDir]
// Env:
//   IMG_PROVIDER=openai|gemini|openai-responses   default: openai-responses if a ChatGPT login exists, else openai
//   OPENAI_IMAGE_MODEL=gpt-image-1.5  (the /v1/images path; NOTE: there is no "gpt-image-2" on /v1/images)
//   GEMINI_IMAGE_MODEL=gemini-3-pro-image
//   OPENAI_RESPONSES_AUTH=chatgpt-oauth|apikey    (openai-responses path; default chatgpt-oauth when ~/.codex/auth.json exists)
//   OPENAI_RESPONSES_MODEL=gpt-5.4-mini           (reasoning model that drives the image_generation tool)
//   IMG_CONCURRENCY=2
//   JUDGE=1                                        score every asset with a vision model (manifest.slots[].score)
//   BEST_OF_N=3                                    for "tier":"hero" slots, generate N candidates and keep the best-judged
//
// Providers:
//   openai            -> legacy /v1/images (gpt-image-1.5), API key only (no reference input)
//   gemini            -> Gemini generateContent (best Korean text-in-image); accepts reference images (identity/brand lock)
//   openai-responses  -> Responses API + image_generation tool (higher-end; FREE via ChatGPT OAuth, or API key); accepts references
//
// Quality engine (all OFF/no-op unless set, so existing plans behave identically):
//   - styleDNA            (plan-level) frozen text block prepended verbatim to every slot prompt -> set consistency
//   - canonicalReference  (plan-level) image path(s) attached to every reference-capable slot -> product/identity lock
//   - "references":[...]  (per-slot) extra reference image paths for image-to-image
//   - "tier":"hero"       (per-slot) marks key slots for best-of-N when BEST_OF_N is set
//   - "n":N               (per-slot) force N candidates for this slot
//   - judge:true          (plan-level) same as JUDGE=1
//
// asset-plan.json:
//   { "style": "shared style preamble prepended to every slot prompt",
//     "styleDNA": "exact hex + materials + lens + finish, frozen for the whole set",   // optional
//     "canonicalReference": "/abs/product.png",   // optional; attached to every ref-capable slot
//     "judge": true,                              // optional
//     "outDir": "/tmp/dp-ai/assets",              // optional; CLI arg overrides
//     "defaults": { "provider":"openai", "aspect":"1:1", "quality":"high" },
//     "slots": [ { "id":"hero-book", "prompt":"...", "aspect":"3:4", "tier":"hero",
//                  "provider":"gemini", "model":"...", "size":"...", "references":["/abs/x.png"] } ] }
// Output: <outDir>/<id>.png for each slot + <outDir>/manifest.json (per-slot score/candidates when judged)

const fs = require('fs');
const path = require('path');
const { generateImageViaResponses, scoreImageViaResponses, hasChatGPTAuth } = require('./lib-openai-responses.js');

const planPath = process.argv[2];
if (!planPath) { console.error('usage: node gen-assets.js <asset-plan.json> [outDir]'); process.exit(1); }
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const outDir = process.argv[3] || plan.outDir || '/tmp/detail-page-assets';
fs.mkdirSync(outDir, { recursive: true });

const defaults = plan.defaults || {};
const STYLE = plan.style ? plan.style.trim() + '\n\n' : '';
const CONCURRENCY = Number(process.env.IMG_CONCURRENCY || 2);
const OPENAI_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5';
const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image';
// 'openai-responses' = Responses API + image_generation tool (higher-end; supports free ChatGPT OAuth).
// If no provider is set and a ChatGPT login exists, prefer the OAuth path (free, bypasses key image-access gate).
const DEFAULT_PROVIDER = process.env.IMG_PROVIDER || defaults.provider
  || (hasChatGPTAuth() ? 'openai-responses' : 'openai');

// Style-DNA: a frozen per-project block (exact hex, materials, lens, finish) prepended VERBATIM to every
// slot so a 10-16 image set reads as one art-directed shoot (set-consistency, not per-image variance).
const STYLE_DNA = plan.styleDNA ? plan.styleDNA.trim() + '\n\n' : '';
const PREAMBLE = STYLE + STYLE_DNA;
// Canonical reference image(s) attached to EVERY slot for product/identity consistency (path or array of paths).
const CANON_REFS = plan.canonicalReference
  ? (Array.isArray(plan.canonicalReference) ? plan.canonicalReference : [plan.canonicalReference])
  : [];
// Per-asset vision judge (#1) + best-of-N (#6). Backward-compatible: OFF unless requested.
//   JUDGE=1 (or plan.judge:true) -> score every asset, record subscores in manifest (non-fatal).
//   BEST_OF_N=N -> for slots tagged "tier":"hero" (or any slot with "n":N), generate N candidates and keep
//   the highest-judged. n=1 everywhere by default = exact prior behavior.
const JUDGE = plan.judge === true || process.env.JUDGE === '1';
const BEST_OF_N = Math.max(1, Number(process.env.BEST_OF_N) || 0);

// gpt-image accepts a fixed set of sizes; map aspect -> nearest supported.
function openaiSize(aspect) {
  switch (aspect) {
    case '3:4': case '2:3': case '4:5': case '9:16': return '1024x1536';
    case '4:3': case '3:2': case '5:4': case '16:9': return '1536x1024';
    default: return '1024x1024';
  }
}

async function openaiImage({ prompt, aspect, size, model, quality }) {
  const body = { model: model || OPENAI_MODEL, prompt, n: 1,
    size: size || openaiSize(aspect), quality: quality || defaults.quality || 'high' };
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error('openai ' + r.status + ': ' + (j.error?.message || JSON.stringify(j).slice(0, 200)));
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) throw new Error('openai: no image in response');
  return Buffer.from(b64, 'base64');
}

async function geminiImage({ prompt, aspect, model, references }) {
  const m = model || GEMINI_MODEL;
  // multi-reference identity/brand lock — Gemini accepts reference images as inlineData parts.
  const refParts = (references || [])
    .map((p) => { try { return { inlineData: { mimeType: 'image/png', data: fs.readFileSync(p).toString('base64') } }; } catch { return null; } })
    .filter(Boolean);
  const body = {
    contents: [{ parts: [...refParts, { text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect || '1:1' } },
  };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error('gemini ' + r.status + ': ' + (j.error?.message || JSON.stringify(j).slice(0, 200)));
  const parts = j.candidates?.[0]?.content?.parts || [];
  const data = parts.find((p) => p.inlineData || p.inline_data);
  const b64 = data?.inlineData?.data || data?.inline_data?.data;
  if (!b64) throw new Error('gemini: no image part (finishReason=' + (j.candidates?.[0]?.finishReason || '?') + ')');
  return Buffer.from(b64, 'base64');
}

// Responses-API path (Responses + image_generation tool). Reads any slot.references
// (array of image file paths) as base64 for product-consistent image-to-image.
async function responsesImage({ prompt, aspect, size, model, quality, references }) {
  const refB64 = (references || [])
    .map((p) => { try { return fs.readFileSync(p).toString('base64'); } catch { return null; } })
    .filter(Boolean);
  const out = await generateImageViaResponses({
    prompt, aspect, size, model,
    quality: quality || defaults.quality || 'high',
    references: refB64,
  });
  return { buf: Buffer.from(out.b64, 'base64'), meta: { authMode: out.authMode, model: out.model, revisedPrompt: out.revisedPrompt, ms: out.ms } };
}

// Merge per-slot references with the project canonical reference (only for providers that accept refs).
function slotRefs(slot, isResponses, isGemini) {
  if (!isResponses && !isGemini) return undefined; // legacy /v1/images has no reference input
  const refs = [...(slot.references || []), ...CANON_REFS];
  return refs.length ? refs : undefined;
}

// Generate ONE candidate image for a slot. Returns { provider, model, buf, meta }.
async function genCandidate(slot) {
  const provider = slot.provider || DEFAULT_PROVIDER;
  const aspect = slot.aspect || defaults.aspect || '1:1';
  const prompt = PREAMBLE + slot.prompt;
  const isResponses = provider === 'openai-responses' || provider === 'gpt-oauth';
  const isGemini = provider === 'gemini';
  const model = slot.model || (isGemini ? GEMINI_MODEL : isResponses ? undefined : OPENAI_MODEL);
  const refs = slotRefs(slot, isResponses, isGemini);
  if (isGemini) {
    return { provider, model, buf: await geminiImage({ prompt, aspect, model, references: refs }), meta: {} };
  } else if (isResponses) {
    const r = await responsesImage({ prompt, aspect, size: slot.size, model: slot.model, quality: slot.quality, references: refs });
    return { provider, model: r.meta.model || model, buf: r.buf, meta: r.meta };
  }
  return { provider, model, buf: await openaiImage({ prompt, aspect, size: slot.size, model, quality: slot.quality }), meta: {} };
}

// Vision-judge a buffer; never throws (judge failure must not lose a generated asset).
async function scoreBuf(buf, brief) {
  try { return await scoreImageViaResponses({ imageB64: buf.toString('base64'), brief }); }
  catch (e) { return { error: e.message }; }
}

async function makeOne(slot) {
  const aspect = slot.aspect || defaults.aspect || '1:1';
  // best-of-N: explicit slot.n, or BEST_OF_N for hero-tier slots; default 1 = exact prior behavior.
  const n = Math.max(1, slot.n || ((slot.tier === 'hero' && BEST_OF_N) ? BEST_OF_N : 1));
  const judgeOn = JUDGE || n > 1; // need scores to pick among candidates
  const brief = slot.prompt;

  let chosen, score = null, candidates = [];
  if (n === 1) {
    chosen = await genCandidate(slot);
    if (judgeOn) score = await scoreBuf(chosen.buf, brief);
  } else {
    const cs = [];
    for (let k = 0; k < n; k++) { try { cs.push(await genCandidate(slot)); } catch (e) { cs.push({ error: e.message }); } }
    const ok = cs.filter((c) => c && c.buf);
    if (!ok.length) throw new Error(`all ${n} candidates failed: ${cs.find((c) => c.error)?.error || '?'}`);
    const scored = await Promise.all(ok.map(async (c) => ({ c, s: await scoreBuf(c.buf, brief) })));
    scored.sort((a, b) => (b.s?.overall || 0) - (a.s?.overall || 0));
    chosen = scored[0].c; score = scored[0].s;
    candidates = scored.map((x) => ({ overall: x.s?.overall ?? null }));
  }
  const file = path.join(outDir, `${slot.id}.png`);
  fs.writeFileSync(file, chosen.buf);
  const out = { id: slot.id, file, provider: chosen.provider, model: chosen.model, aspect, bytes: chosen.buf.length, ok: true, ...chosen.meta };
  if (score) out.score = score;
  if (candidates.length) { out.n = n; out.candidates = candidates; }
  return out;
}

(async () => {
  const slots = plan.slots || [];
  if (!slots.length) { console.error('asset-plan has no slots'); process.exit(1); }
  const results = [];
  for (let i = 0; i < slots.length; i += CONCURRENCY) {
    const batch = slots.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(batch.map(async (s) => {
      try { const r = await makeOne(s); const sc = r.score && r.score.overall != null ? `, judge=${r.score.overall}${r.n ? '/best-of-' + r.n : ''}${r.score.verdict === 'regen' ? ' ⚠regen' : ''}` : ''; console.error(`  ✓ ${r.id} (${r.provider}${r.authMode ? ':' + r.authMode : ''}/${r.model}, ${(r.bytes / 1024 | 0)}KB${r.ms ? ', ' + (r.ms / 1000 | 0) + 's' : ''}${sc})`); return r; }
      catch (e) { console.error(`  ✗ ${s.id}: ${e.message}`); return { id: s.id, ok: false, error: e.message, provider: s.provider || DEFAULT_PROVIDER }; }
    }));
    results.push(...settled);
  }
  const manifest = { outDir, provider: DEFAULT_PROVIDER, openaiModel: OPENAI_MODEL, geminiModel: GEMINI_MODEL,
    judge: JUDGE, bestOfN: BEST_OF_N || undefined, styleDNA: !!plan.styleDNA, canonicalRefs: CANON_REFS.length,
    total: results.length, ok: results.filter((r) => r.ok).length, slots: results };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ outDir, ok: manifest.ok, total: manifest.total, files: results.filter((r) => r.ok).map((r) => r.file) }, null, 2));
  if (manifest.ok === 0) process.exit(2);
})().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
