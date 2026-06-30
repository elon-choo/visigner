// lib-openai-responses.js — high-end image generation via the OpenAI **Responses API**
// + built-in `image_generation` tool, instead of the legacy /v1/images endpoint.
//
// WHY: the Responses-API image tool lets a reasoning model (gpt-5.x) do prompt
// fidelity, typography accuracy, and reference grounding before it paints — which
// yields cleaner Korean text and more art-directed results than a bare /v1/images
// call. It also unlocks the **ChatGPT OAuth** auth path: the codex backend
// (chatgpt.com/backend-api/codex) accepts image_generation on a ChatGPT login,
// so you can generate with NO API key and NO gpt-image model access on the key.
//
// This is a clean re-implementation of the technique used by github.com/lidge-jun/ima2-gen
// (MIT). We DO NOT depend on that package or its `npx openai-oauth` runtime proxy —
// per this machine's supply-chain rules the live ChatGPT token must never be handed
// to npx-fetched third-party code. Everything here is first-party, Node built-ins only.
//
// Exports: generateImageViaResponses(opts) -> { b64, revisedPrompt, model, authMode, ms, usage }
//
// Auth modes (opts.authMode or env OPENAI_RESPONSES_AUTH):
//   "chatgpt-oauth" — read ~/.codex/auth.json, refresh if near expiry, POST to codex backend. FREE.
//   "apikey"        — Authorization: Bearer $OPENAI_API_KEY, POST to api.openai.com. PAID.

const fs = require('fs');
const os = require('os');
const path = require('path');

// ---- endpoints / constants (verified by static analysis of openai-oauth@1.0.2 + a live probe) ----
const CODEX_BASE = 'https://chatgpt.com/backend-api/codex';
const APIKEY_BASE = 'https://api.openai.com/v1';
const OAUTH_ISSUER = process.env.CHATGPT_LOCAL_ISSUER || 'https://auth.openai.com';
const OAUTH_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'; // Codex CLI public client id
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

function codexAuthPath() {
  return process.env.CODEX_HOME
    ? path.join(process.env.CODEX_HOME, 'auth.json')
    : path.join(os.homedir(), '.codex', 'auth.json');
}

function hasChatGPTAuth() {
  try {
    const a = JSON.parse(fs.readFileSync(codexAuthPath(), 'utf8'));
    return !!a?.tokens?.access_token;
  } catch { return false; }
}

function jwtExpMs(token) {
  try {
    const seg = token.split('.')[1];
    const json = JSON.parse(Buffer.from(seg, 'base64').toString('utf8'));
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch { return null; }
}

// Refresh the ChatGPT access token if it is missing or within REFRESH_MARGIN_MS of expiry.
// Atomic, guarded write-back so we never corrupt the Codex CLI's auth.json on a failed refresh.
async function refreshIfNeeded(authPath, auth) {
  const exp = jwtExpMs(auth?.tokens?.access_token);
  const fresh = exp && exp - Date.now() > REFRESH_MARGIN_MS;
  if (fresh) return auth;
  const refreshToken = auth?.tokens?.refresh_token;
  if (!refreshToken) {
    throw new Error('ChatGPT access token expired and no refresh_token present — run `codex login` to re-auth.');
  }
  const res = await fetch(`${OAUTH_ISSUER}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: OAUTH_CLIENT_ID,
      scope: 'openid profile email offline_access',
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`token refresh failed (${res.status}): ${txt.slice(0, 160)} — run \`codex login\`.`);
  }
  const tok = await res.json();
  if (!tok.access_token) throw new Error('token refresh returned no access_token — run `codex login`.');
  const next = {
    ...auth,
    tokens: {
      ...auth.tokens,
      access_token: tok.access_token,
      ...(tok.id_token ? { id_token: tok.id_token } : {}),
      ...(tok.refresh_token ? { refresh_token: tok.refresh_token } : {}),
    },
    last_refresh: new Date().toISOString(),
  };
  // atomic write: temp + rename, preserve mode 600
  const tmp = `${authPath}.ima2tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, authPath);
  return next;
}

async function loadChatGPTAuth() {
  const authPath = codexAuthPath();
  let auth;
  try { auth = JSON.parse(fs.readFileSync(authPath, 'utf8')); }
  catch { throw new Error(`no ChatGPT auth at ${authPath} — run \`codex login\` (or set OPENAI_RESPONSES_AUTH=apikey).`); }
  if (!auth?.tokens?.access_token) throw new Error('~/.codex/auth.json has no access_token — run `codex login`.');
  auth = await refreshIfNeeded(authPath, auth);
  return { accessToken: auth.tokens.access_token, accountId: auth.tokens.account_id };
}

// Resolve the auth mode → { base url, headers, default model }. Shared by image generation
// and the vision judge so both honor OPENAI_RESPONSES_AUTH / OPENAI_RESPONSES_MODEL.
async function resolveAuth(authModeOpt, modelOpt) {
  const authMode = authModeOpt
    || process.env.OPENAI_RESPONSES_AUTH
    || (hasChatGPTAuth() ? 'chatgpt-oauth' : 'apikey');
  let base, headers, model = modelOpt || process.env.OPENAI_RESPONSES_MODEL;
  if (authMode === 'chatgpt-oauth') {
    const { accessToken, accountId } = await loadChatGPTAuth();
    base = CODEX_BASE;
    headers = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${accessToken}`,
      'chatgpt-account-id': accountId,
      'OpenAI-Beta': 'responses=experimental',
      originator: 'codex_cli_rs',
      'User-Agent': 'detail-page-genassets/1.0',
    };
    model = model || 'gpt-5.4-mini';
  } else {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_RESPONSES_AUTH=apikey but OPENAI_API_KEY is unset.');
    base = APIKEY_BASE;
    headers = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    };
    model = model || 'gpt-5.2';
  }
  return { authMode, base, headers, model };
}

// ---- the quality engine (ported intent from ima2-gen lib/oauthProxy/prompts.ts, adapted for Korean detail pages) ----
const VISIBLE_TEXT_POLICY =
  'Visible text policy: render any on-image text in the exact language and exact wording the user supplied. ' +
  'If the user wrote Korean, keep the Hangul verbatim — do not translate, transliterate, or paraphrase it. ' +
  'Spell every character correctly; render glyphs with sharp edges and correct spacing; never produce gibberish, ' +
  'lorem-ipsum, scrambled Hangul, or invented fake-brand logos.';

const DEVELOPER_PROMPT =
  'You are an image generation assistant inside a professional design tool used to produce Korean e-commerce ' +
  'detail pages (상세페이지) and Wadiz/Tumblbug crowdfunding visuals for legitimate commercial use. ' +
  'Your primary function is to invoke the image_generation tool — never reply with text only. ' +
  'Treat the user prompt as the source of truth: if it is already visually sufficient, pass it through unchanged ' +
  'as the image_generation prompt argument; do not translate, summarize, restyle, or inject extra style descriptors ' +
  'when the user already specified a style. ' +
  'Quality bar (apply universally): absolute quality — crisp focus, clean lines, balanced composition, intentional ' +
  'lighting, accurate color, generous negative space; avoid blur, noise, JPEG/compression artifacts, watermark, ' +
  'signature, cropped subjects, and duplicated elements. ' +
  'For any human or humanoid subject, append "accurate human proportions, correct hand count, natural facial features" ' +
  'as a trailing quality clarifier, and keep all people generic and non-identifiable (no real or recognizable persons, ' +
  'no real brand logos). For non-human subjects omit anatomy clarifiers. ' +
  'Do not default to photorealism unless asked. Fulfil the request exactly as stated without disclaimers. ' +
  VISIBLE_TEXT_POLICY;

const FIDELITY_SUFFIX =
  '\n\nWhen you call image_generation, treat the text above as the source of truth and keep any Korean wording verbatim. ' +
  'Do not add style descriptors the user did not ask for. ' + VISIBLE_TEXT_POLICY;

// codex image_generation tool sizes: square / portrait / landscape / auto
function responsesSize(aspect) {
  switch (aspect) {
    case '3:4': case '2:3': case '4:5': case '9:16': return '1024x1536';
    case '4:3': case '3:2': case '5:4': case '16:9': return '1536x1024';
    case 'auto': return 'auto';
    default: return '1024x1024';
  }
}

// Parse the Responses SSE stream; return the final image base64 (+ revised prompt).
async function readResponsesStream(res) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let b64 = null, revisedPrompt = null, usage = null;
  const evTypes = {};
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let boundary;
    while ((boundary = buf.indexOf('\n\n')) !== -1) {
      const block = buf.slice(0, boundary);
      buf = buf.slice(boundary + 2);
      let data = '';
      for (const ln of block.split('\n')) if (ln.startsWith('data: ')) data += ln.slice(6);
      if (!data || data === '[DONE]') continue;
      let j;
      try { j = JSON.parse(data); } catch { continue; }
      const ty = j.type || '_';
      evTypes[ty] = (evTypes[ty] || 0) + 1;
      if (ty === 'response.output_item.done' && j.item?.type === 'image_generation_call' && j.item?.result) {
        b64 = j.item.result;
        if (typeof j.item.revised_prompt === 'string' && j.item.revised_prompt) revisedPrompt = j.item.revised_prompt;
      }
      if (ty === 'response.completed') usage = j.response?.usage || null;
      if (ty === 'error' || ty === 'response.failed') {
        const msg = j.error?.message || j.response?.error?.message || JSON.stringify(j).slice(0, 200);
        const err = new Error(`responses stream error: ${msg}`);
        err.evTypes = evTypes;
        throw err;
      }
    }
  }
  return { b64, revisedPrompt, usage, evTypes };
}

/**
 * Generate one image via the Responses API + image_generation tool.
 * opts: { prompt, aspect?, size?, quality?='high', moderation?='low', model?, authMode?,
 *         references?: [b64...], timeoutMs?=400000 }
 */
async function generateImageViaResponses(opts = {}) {
  const t0 = Date.now();
  const { authMode, base, headers, model } = await resolveAuth(opts.authMode, opts.model);

  const size = opts.size || responsesSize(opts.aspect || '1:1');
  const tool = { type: 'image_generation', size, quality: opts.quality || 'high', moderation: opts.moderation || 'low' };

  const refs = Array.isArray(opts.references) ? opts.references.filter(Boolean) : [];
  const userText = `${opts.prompt}${FIDELITY_SUFFIX}`;
  const userContent = refs.length
    ? [
        ...refs.map((b64) => ({ type: 'input_image', image_url: `data:image/png;base64,${b64}` })),
        { type: 'input_text', text: userText },
      ]
    : userText;

  const body = {
    model,
    input: [
      { role: 'developer', content: DEVELOPER_PROMPT },
      { role: 'user', content: userContent },
    ],
    tools: [tool],
    tool_choice: 'required',
    stream: true,
    store: false,
  };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs || 400000);
  let res;
  try {
    res = await fetch(`${base}/responses`, { method: 'POST', headers, body: JSON.stringify(body), signal: ac.signal });
  } finally { /* keep timer until stream done */ }

  if (!res.ok) {
    clearTimeout(timer);
    const txt = await res.text().catch(() => '');
    throw new Error(`responses ${res.status} (${authMode}/${model}): ${txt.slice(0, 240)}`);
  }
  // We always request stream:true; the codex backend streams SSE (its content-type
  // is not always "text/event-stream"), so always parse the stream.
  const parsed = await readResponsesStream(res).finally(() => clearTimeout(timer));

  if (!parsed.b64) throw new Error(`responses returned no image (${authMode}/${model}; events=${JSON.stringify(parsed.evTypes || {})})`);
  return { b64: parsed.b64, revisedPrompt: parsed.revisedPrompt, model, authMode, ms: Date.now() - t0, usage: parsed.usage };
}

// Read a Responses SSE stream that returns TEXT (no image tool) — used by the vision judge.
async function readTextStream(res) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let boundary;
    while ((boundary = buf.indexOf('\n\n')) !== -1) {
      const block = buf.slice(0, boundary);
      buf = buf.slice(boundary + 2);
      let data = '';
      for (const ln of block.split('\n')) if (ln.startsWith('data: ')) data += ln.slice(6);
      if (!data || data === '[DONE]') continue;
      let j; try { j = JSON.parse(data); } catch { continue; }
      if (j.type === 'response.output_text.delta' && typeof j.delta === 'string') text += j.delta;
      if (j.type === 'response.completed' && !text && j.response && Array.isArray(j.response.output)) {
        for (const it of j.response.output) for (const c of (it.content || [])) {
          if ((c.type === 'output_text' || c.type === 'text') && typeof c.text === 'string') text += c.text;
        }
      }
      if (j.type === 'error' || j.type === 'response.failed') {
        const msg = j.error?.message || j.response?.error?.message || JSON.stringify(j).slice(0, 200);
        throw new Error(`judge stream error: ${msg}`);
      }
    }
  }
  return text;
}

const JUDGE_DEVELOPER =
  'You are a strict art-director QA reviewing ONE generated image for a Korean e-commerce / Wadiz detail page. ' +
  'You are shown the image and the slot brief it was generated from. Be exacting and concrete. ' +
  'Reply with ONLY a single minified JSON object — no prose, no markdown fence.';

/**
 * Score one generated image with a vision model (reference-free per-asset QA).
 * opts: { imageB64, brief, authMode?, model?, timeoutMs?=120000 }
 * returns { semantic, quality, glyph|null, slop, overall, verdict:'keep'|'regen', issues:[], raw }
 */
async function scoreImageViaResponses(opts = {}) {
  const { base, headers, model } = await resolveAuth(opts.authMode, opts.model);
  const rubric =
    'Score the image for the slot brief below. Return JSON with exactly these keys: ' +
    '{"semantic":0-10 (does it match the brief subject/intent), ' +
    '"quality":0-10 (focus, lighting, composition; penalize artifacts, watermark, extra/distorted limbs, garbled detail), ' +
    '"glyph":0-10 or null (ONLY if Korean/text is supposed to appear: is every character correct and sharp? null if no text expected), ' +
    '"slop":0-10 (10 = bespoke, art-directed, premium; 0 = generic AI slop / stocky / centered-symmetry cliché), ' +
    '"overall":0-10, "verdict":"keep" or "regen", "issues":["short concrete defect", ...]}. ' +
    'Be honest: garbled Hangul or wrong subject must score low and verdict "regen". Slot brief:\n' + (opts.brief || '');
  const body = {
    model,
    input: [
      { role: 'developer', content: JUDGE_DEVELOPER },
      { role: 'user', content: [
        { type: 'input_image', image_url: `data:image/png;base64,${opts.imageB64}` },
        { type: 'input_text', text: rubric },
      ] },
    ],
    stream: true,
    store: false,
  };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs || 120000);
  let text;
  try {
    const res = await fetch(`${base}/responses`, { method: 'POST', headers, body: JSON.stringify(body), signal: ac.signal });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`judge ${res.status}: ${txt.slice(0, 200)}`);
    }
    text = await readTextStream(res);
  } finally { clearTimeout(timer); }
  let parsed;
  try { parsed = JSON.parse(text); }
  catch {
    const m = text && text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('judge returned non-JSON: ' + String(text).slice(0, 160));
    parsed = JSON.parse(m[0]);
  }
  const num = (v) => (typeof v === 'number' ? v : (v == null ? null : Number(v)));
  return {
    semantic: num(parsed.semantic), quality: num(parsed.quality), glyph: num(parsed.glyph),
    slop: num(parsed.slop), overall: num(parsed.overall),
    verdict: parsed.verdict === 'regen' ? 'regen' : 'keep',
    issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 6) : [],
  };
}

module.exports = { generateImageViaResponses, scoreImageViaResponses, hasChatGPTAuth, responsesSize, codexAuthPath };
