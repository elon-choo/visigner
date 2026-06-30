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
const { generateImageViaResponses, scoreImageViaResponses, hasChatGPTAuth, codexAuthPath } = require('./lib-openai-responses.js');

// ---- provider availability (shared by --doctor and the no-key placeholder path) ----
// Pure inspection of env + ~/.codex/auth.json. Never throws, never makes a network call.
function availability() {
  let chatgptOAuth = false;
  try { chatgptOAuth = hasChatGPTAuth(); } catch { chatgptOAuth = false; }
  return {
    chatgptOAuth,
    openaiKey: !!process.env.OPENAI_API_KEY,
    geminiKey: !!process.env.GEMINI_API_KEY,
  };
}
function anyProvider() { const a = availability(); return a.chatgptOAuth || a.openaiKey || a.geminiKey; }
// Which provider the engine auto-selects when nothing is set (mirrors DEFAULT_PROVIDER's fallback).
function autoProvider() {
  return process.env.IMG_PROVIDER || (availability().chatgptOAuth ? 'openai-responses' : 'openai');
}
// Can the resolved provider for a slot actually run with the current credentials?
function providerCanRun(provider) {
  const a = availability();
  if (provider === 'gemini') return a.geminiKey;
  if (provider === 'openai-responses' || provider === 'gpt-oauth') {
    const mode = process.env.OPENAI_RESPONSES_AUTH;
    if (mode === 'apikey') return a.openaiKey;
    if (mode === 'chatgpt-oauth') return a.chatgptOAuth;
    return a.chatgptOAuth || a.openaiKey; // default: prefer OAuth, fall back to key
  }
  return a.openaiKey; // legacy /v1/images
}

// ---- --doctor preflight: plain-language report of what's configured. NEVER crashes. ----
function runDoctor() {
  try {
    const a = availability();
    const oaModel = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5';
    const gemModel = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image';
    const respOAuthModel = process.env.OPENAI_RESPONSES_MODEL || 'gpt-5.4-mini';
    const respKeyModel = process.env.OPENAI_RESPONSES_MODEL || 'gpt-5.2';
    let authPath = '~/.codex/auth.json';
    try { authPath = codexAuthPath(); } catch {}
    const yn = (b) => (b ? 'PRESENT' : 'absent');
    const sel = autoProvider();
    const selRuns = providerCanRun(sel);
    const lines = [];
    lines.push('Detail-page asset generator — provider doctor');
    lines.push('=============================================');
    lines.push('');
    lines.push('Providers detected:');
    lines.push(`  - ChatGPT login (OAuth, FREE image gen): ${yn(a.chatgptOAuth)}   (${authPath})`);
    lines.push(`  - OPENAI_API_KEY (paid):                 ${a.openaiKey ? 'set' : 'not set'}`);
    lines.push(`  - GEMINI_API_KEY (paid):                 ${a.geminiKey ? 'set' : 'not set'}`);
    lines.push('');
    lines.push('Model each path would use:');
    lines.push(`  - openai-responses + ChatGPT OAuth -> ${respOAuthModel}   (free, no API key needed)`);
    lines.push(`  - openai-responses + API key       -> ${respKeyModel}`);
    lines.push(`  - openai (legacy /v1/images)       -> ${oaModel}`);
    lines.push(`  - gemini                           -> ${gemModel}`);
    lines.push('');
    const selLabel = sel === 'openai-responses'
      ? (a.chatgptOAuth && process.env.OPENAI_RESPONSES_AUTH !== 'apikey' ? 'openai-responses (ChatGPT OAuth)' : 'openai-responses (API key)')
      : sel;
    lines.push(`Auto-selected provider for this run: ${selLabel}`);
    if (anyProvider() && selRuns) {
      lines.push('Real photo generation: ENABLED.');
    } else {
      lines.push('Real photo generation: DISABLED — every slot will be filled with a');
      lines.push('license-clear SVG placeholder (tasteful labeled tile) instead of a real photo.');
      lines.push('');
      lines.push('To enable real photos, do ONE of these, then re-run your generate command:');
      lines.push('  1) Free, recommended:   codex login');
      lines.push('  2) Or with an API key:  export OPENAI_API_KEY=sk-...     (paid)');
      lines.push('  3) Or Google Gemini:    export GEMINI_API_KEY=...        (paid)');
    }
    console.log(lines.join('\n'));
  } catch (e) {
    // Doctor must never crash — degrade to a one-liner.
    console.log('provider doctor: unable to fully probe (' + (e && e.message) + '). No provider confirmed; the generator will use SVG placeholders. Enable real photos with: codex login');
  }
}

const planPath = process.argv[2];
if (process.argv.includes('--doctor')) { runDoctor(); process.exit(0); }
if (!planPath) { console.error('usage: node gen-assets.js <asset-plan.json> [outDir]  (or --doctor)'); process.exit(1); }
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const outDir = process.argv[3] || plan.outDir || '/tmp/detail-page-assets';
fs.mkdirSync(outDir, { recursive: true });

// ---- NO-KEY graceful placeholder: a self-contained, license-clear SVG stand-in per slot. ----
// Deterministic (no randomness), on-brand (uses plan brand surface/ink if provided), and clearly
// labeled so the page renders as intentional and the operator knows which slots still need real art.
function svgEscape(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function aspectDims(aspect) {
  const m = /^\s*(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)\s*$/.exec(String(aspect || '1:1'));
  let w = 1, h = 1;
  if (m) { w = parseFloat(m[1]) || 1; h = parseFloat(m[2]) || 1; }
  const base = 1280;
  if (w >= h) return { width: base, height: Math.max(1, Math.round(base * h / w)) };
  return { width: Math.max(1, Math.round(base * w / h)), height: base };
}

// ---- placeholder helpers: deterministic color math + role classification ----
// (Used ONLY by the no-key SVG placeholder path; real-provider paths are untouched.)
function _clamp255(n) { return Math.max(0, Math.min(255, Math.round(n))); }
function hexToRgb(hex) {
  let h = String(hex == null ? '' : hex).trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
function rgbToHex(o) { return '#' + [o.r, o.g, o.b].map((v) => _clamp255(v).toString(16).padStart(2, '0')).join(''); }
// linear blend a->b by t in [0,1]; tolerant of bad input (falls back to black/white).
function mix(a, b, t) {
  const ca = hexToRgb(a) || { r: 0, g: 0, b: 0 };
  const cb = hexToRgb(b) || { r: 255, g: 255, b: 255 };
  return rgbToHex({ r: ca.r + (cb.r - ca.r) * t, g: ca.g + (cb.g - ca.g) * t, b: ca.b + (cb.b - ca.b) * t });
}
function relLum(hex) { const c = hexToRgb(hex) || { r: 0, g: 0, b: 0 }; return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255; }
function hashStr(s) {
  let h = 2166136261; const str = String(s == null ? '' : s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}
function safeId(s) { return String(s == null ? 'x' : s).replace(/[^a-zA-Z0-9_-]/g, '_') || 'x'; }

// Resolve the FULL token palette the plan passed in: surface, ink, accent, and a primary ramp.
// Accepts brand.* or top-level plan.*; ramp may be an array or an object of stops (e.g. {50:..,500:..}).
// When accent/ramp are absent, derive a tasteful set from accent<->surface/ink so comps stay on-brand.
function buildPalette(plan, slot) {
  const brand = plan.brand || {};
  let surface = brand.surface || plan.surface || '#F1EEE8';
  let ink = brand.ink || plan.ink || '#23201B';
  let accent = brand.accent || plan.accent || (slot && slot.accent);
  const rawRamp = brand.primary || brand.ramp || brand.primaryRamp || plan.primary || plan.ramp;
  let ramps = [];
  if (Array.isArray(rawRamp)) ramps = rawRamp.filter((x) => typeof x === 'string' && hexToRgb(x));
  else if (rawRamp && typeof rawRamp === 'object') {
    ramps = Object.keys(rawRamp).sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0))
      .map((k) => rawRamp[k]).filter((x) => typeof x === 'string' && hexToRgb(x));
  }
  if (!accent || !hexToRgb(accent)) accent = ramps.length ? ramps[Math.floor(ramps.length / 2)] : '#B4654A';
  if (!hexToRgb(accent)) accent = '#B4654A';
  if (!hexToRgb(surface)) surface = '#F1EEE8';
  if (!hexToRgb(ink)) ink = '#23201B';
  if (!ramps.length) {
    ramps = [mix(accent, surface, 0.72), mix(accent, surface, 0.42), accent, mix(accent, ink, 0.22), mix(accent, ink, 0.46)];
  }
  return { surface, ink, accent, ramps };
}

// Map a slot to ONE of five comp archetypes from its role/label/id + aspect, so each slot
// gets a visibly different lo-fi composition. Deterministic, keyword-first then aspect fallback.
function classifyRole(slot, aspect) {
  const text = String(slot.role || slot.label || slot.id || '').toLowerCase();
  const { width, height } = aspectDims(aspect);
  const ratio = width / (height || 1);
  if (/before|after|compare|comparison|versus|\bvs\b|b\/a/.test(text)) return 'beforeafter';
  if (/wall|grid|deliverable|gallery|bundle|contents|lineup|curriculum|모음|구성|grid/.test(text)) return 'grid';
  if (/banner|strip|ribbon|cta|배너/.test(text) || ratio >= 2.4) return 'banner';
  if (/cover|hero|title|main|thumb|thumbnail|key.?visual|\bkv\b|표지|메인|히어로/.test(text)) return 'cover';
  if (/scene|product|shot|mockup|lifestyle|detail|close.?up|photo|장면|제품|컷/.test(text)) return 'scene';
  if (ratio >= 2.2) return 'banner';
  if (ratio <= 0.85) return 'cover';
  return 'scene';
}

// ---- five distinct lo-fi comp motifs (each returns inner SVG markup, no <svg> root) ----
function motifCover(ctx) {
  const { width: W, height: H, min, pal } = ctx;
  const { surface, ink, accent } = pal;
  const m = Math.round(min * 0.09);
  const sw = Math.max(1, Math.round(min * 0.004));
  const bandW = Math.round(min * 0.10);
  const ex = m + bandW + Math.round(min * 0.08);
  const ey = Math.round(H * 0.30);
  const tbh = Math.round(min * 0.075);
  const gap = Math.round(tbh * 0.55);
  const ty = ey + Math.round(min * 0.09);
  const colW = Math.max(1, W - ex - m);
  return [
    `<rect width="${W}" height="${H}" fill="${surface}"/>`,
    `<rect x="${m}" y="${m}" width="${W - 2 * m}" height="${H - 2 * m}" fill="none" stroke="${ink}" stroke-opacity="0.18" stroke-width="${sw}"/>`,
    `<rect x="${m}" y="${m}" width="${bandW}" height="${H - 2 * m}" fill="${accent}"/>`,
    `<rect x="${ex}" y="${ey}" width="${Math.round(min * 0.26)}" height="${Math.round(min * 0.035)}" rx="${Math.round(min * 0.018)}" fill="${accent}"/>`,
    `<rect x="${ex}" y="${ty}" width="${Math.round(colW * 0.82)}" height="${tbh}" rx="${Math.round(tbh * 0.16)}" fill="${ink}" fill-opacity="0.82"/>`,
    `<rect x="${ex}" y="${ty + tbh + gap}" width="${Math.round(colW * 0.55)}" height="${tbh}" rx="${Math.round(tbh * 0.16)}" fill="${ink}" fill-opacity="0.82"/>`,
    `<rect x="${ex}" y="${ty + 2 * (tbh + gap)}" width="${Math.round(colW * 0.40)}" height="${Math.round(min * 0.028)}" rx="${Math.round(min * 0.014)}" fill="${ink}" fill-opacity="0.32"/>`,
  ].join('');
}
function motifScene(ctx) {
  const { width: W, height: H, min, pal, id } = ctx;
  const { surface, ink, accent } = pal;
  const g = `g_${id}`;
  return [
    `<defs>`,
    `<linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0" stop-color="${mix(surface, accent, 0.12)}"/>`,
    `<stop offset="1" stop-color="${mix(accent, ink, 0.18)}"/>`,
    `</linearGradient>`,
    `<radialGradient id="${g}_f" cx="0.62" cy="0.40" r="0.55">`,
    `<stop offset="0" stop-color="${mix(accent, surface, 0.18)}" stop-opacity="0.95"/>`,
    `<stop offset="1" stop-color="${accent}" stop-opacity="0"/>`,
    `</radialGradient>`,
    `</defs>`,
    `<rect width="${W}" height="${H}" fill="url(#${g})"/>`,
    `<path d="M ${Math.round(W * 0.10)} ${Math.round(H * 0.78)} Q ${Math.round(W * 0.40)} ${Math.round(H * 0.55)} ${Math.round(W * 0.92)} ${Math.round(H * 0.82)} L ${W} ${H} L 0 ${H} Z" fill="${mix(accent, ink, 0.30)}" fill-opacity="0.55"/>`,
    `<circle cx="${Math.round(W * 0.62)}" cy="${Math.round(H * 0.42)}" r="${Math.round(min * 0.34)}" fill="url(#${g}_f)"/>`,
    `<circle cx="${Math.round(W * 0.30)}" cy="${Math.round(H * 0.30)}" r="${Math.round(min * 0.05)}" fill="${surface}" fill-opacity="0.70"/>`,
  ].join('');
}
function motifGrid(ctx) {
  const { width: W, height: H, min, pal, id } = ctx;
  const { surface, ink, accent, ramps } = pal;
  const m = Math.round(min * 0.07);
  const ratio = W / (H || 1);
  const cols = ratio >= 1.6 ? 4 : ratio >= 0.9 ? 3 : 2;
  const rows = Math.max(2, Math.round(cols / ratio));
  const gp = Math.round(min * 0.035);
  const gw = (W - 2 * m - (cols - 1) * gp) / cols;
  const gh = (H - 2 * m - (rows - 1) * gp) / rows;
  const palette = [mix(accent, surface, 0.70), mix(accent, surface, 0.45), accent, mix(ink, surface, 0.30), ...ramps];
  const h = hashStr(id);
  let out = `<rect width="${W}" height="${H}" fill="${surface}"/>`;
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = Math.round(m + c * (gw + gp));
      const y = Math.round(m + r * (gh + gp));
      const fill = palette[(h + i * 7 + r * 3 + c) % palette.length];
      out += `<rect x="${x}" y="${y}" width="${Math.round(gw)}" height="${Math.round(gh)}" rx="${Math.round(min * 0.02)}" fill="${fill}" fill-opacity="0.92"/>`;
      if ((h >> (i % 24)) & 1) {
        out += `<rect x="${x + Math.round(gw * 0.18)}" y="${y + Math.round(gh * 0.62)}" width="${Math.round(gw * 0.50)}" height="${Math.round(gh * 0.10)}" rx="${Math.round(gh * 0.05)}" fill="${ink}" fill-opacity="0.22"/>`;
      }
      i++;
    }
  }
  return out;
}
function motifBanner(ctx) {
  const { width: W, height: H, min, pal } = ctx;
  const { surface, ink, accent } = pal;
  const splitX = Math.round(W * 0.38);
  const seamW = Math.round(min * 0.18);
  const lx = splitX + Math.round(min * 0.12);
  const ly = Math.round(H * 0.40);
  const bh = Math.round(min * 0.12);
  const colW = Math.max(1, W - lx - Math.round(min * 0.06));
  return [
    `<rect width="${W}" height="${H}" fill="${surface}"/>`,
    `<rect x="0" y="0" width="${splitX}" height="${H}" fill="${accent}"/>`,
    `<path d="M ${splitX} 0 L ${splitX + seamW} 0 L ${splitX} ${H} L ${splitX - seamW} ${H} Z" fill="${mix(accent, ink, 0.20)}" fill-opacity="0.50"/>`,
    `<circle cx="${Math.round(splitX * 0.5)}" cy="${Math.round(H * 0.5)}" r="${Math.round(min * 0.12)}" fill="none" stroke="${surface}" stroke-opacity="0.70" stroke-width="${Math.max(1, Math.round(min * 0.012))}"/>`,
    `<rect x="${lx}" y="${ly}" width="${Math.round(colW * 0.60)}" height="${bh}" rx="${Math.round(bh * 0.16)}" fill="${ink}" fill-opacity="0.80"/>`,
    `<rect x="${lx}" y="${ly + bh + Math.round(bh * 0.5)}" width="${Math.round(colW * 0.38)}" height="${Math.round(bh * 0.5)}" rx="${Math.round(bh * 0.10)}" fill="${ink}" fill-opacity="0.34"/>`,
  ].join('');
}
function motifBeforeAfter(ctx) {
  const { width: W, height: H, min, pal } = ctx;
  const { surface, ink, accent } = pal;
  const mid = Math.round(W / 2);
  const lx = Math.round(W * 0.10);
  const ly = Math.round(H * 0.30);
  const lw = Math.round(mid - W * 0.20);
  const bh = Math.round(min * 0.05);
  const bg = Math.round(bh * 0.7);
  const widths = [1, 0.7, 0.85, 0.5];
  let wire = '';
  for (let i = 0; i < 4; i++) {
    wire += `<rect x="${lx}" y="${ly + i * (bh + bg)}" width="${Math.round(lw * widths[i])}" height="${bh}" rx="${Math.round(bh * 0.2)}" fill="${ink}" fill-opacity="0.20"/>`;
  }
  return [
    `<rect width="${W}" height="${H}" fill="${surface}"/>`,
    `<rect x="${mid}" y="0" width="${W - mid}" height="${H}" fill="${mix(accent, surface, 0.30)}"/>`,
    wire,
    `<rect x="${mid + Math.round(W * 0.08)}" y="${Math.round(H * 0.30)}" width="${Math.round((W - mid) * 0.70)}" height="${Math.round(H * 0.40)}" rx="${Math.round(min * 0.02)}" fill="${accent}" fill-opacity="0.85"/>`,
    `<rect x="${mid - Math.round(min * 0.006)}" y="0" width="${Math.max(2, Math.round(min * 0.012))}" height="${H}" fill="${ink}" fill-opacity="0.50"/>`,
  ].join('');
}
// Bottom-left role/aspect tag so the operator always knows which slot a comp stands in for.
function placeholderFooter(ctx) {
  const { width: W, height: H, min, pal, role, aspect } = ctx;
  const { ink, surface, accent } = pal;
  const fz = Math.round(min * 0.036);
  const dotR = Math.round(fz * 0.42);
  const x = Math.round(min * 0.06);
  const txt = svgEscape(`${role}  ·  ${aspect}  ·  placeholder`);
  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
  const padX = Math.round(fz * 0.7);
  const pillH = Math.round(fz * 1.9);
  const pillW = Math.round(txt.length * fz * 0.54) + padX * 2 + dotR * 3;
  const pillY = H - Math.round(min * 0.06) - pillH;
  const pillFill = relLum(surface) < 0.5 ? mix(surface, '#000000', 0.20) : '#FFFFFF';
  return [
    `<g>`,
    `<rect x="${x}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${Math.round(pillH * 0.5)}" fill="${pillFill}" fill-opacity="0.82"/>`,
    `<circle cx="${x + padX + dotR}" cy="${pillY + Math.round(pillH / 2)}" r="${dotR}" fill="${accent}"/>`,
    `<text x="${x + padX + dotR * 2 + Math.round(fz * 0.4)}" y="${pillY + Math.round(pillH / 2)}" dominant-baseline="middle" font-family='${font}' font-size="${fz}" font-weight="600" fill="${ink}" fill-opacity="0.85" letter-spacing="0.4">${txt}</text>`,
    `</g>`,
  ].join('');
}

function writePlaceholder(slot, reason) {
  const aspect = slot.aspect || defaults.aspect || '1:1';
  const { width, height } = aspectDims(aspect);
  const min = Math.min(width, height);
  const pal = buildPalette(plan, slot);
  const role = String(slot.role || slot.label || slot.id);
  const kind = classifyRole(slot, aspect);
  const ctx = { width, height, min, pal, slot, role, aspect, id: safeId(slot.id), kind };
  let body;
  switch (kind) {
    case 'cover': body = motifCover(ctx); break;
    case 'grid': body = motifGrid(ctx); break;
    case 'banner': body = motifBanner(ctx); break;
    case 'beforeafter': body = motifBeforeAfter(ctx); break;
    case 'scene': default: body = motifScene(ctx); break;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${svgEscape(role)} placeholder (${kind})">
${body}
${placeholderFooter(ctx)}
</svg>`;
  const file = path.join(outDir, `${slot.id}.svg`);
  fs.writeFileSync(file, svg);
  return { id: slot.id, file, provider: slot.provider || DEFAULT_PROVIDER, aspect, role,
    bytes: Buffer.byteLength(svg), ok: true, placeholder: true, placeholderKind: kind, reason };
}

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
      // No credentials for this slot's provider -> write a license-clear placeholder instead of failing.
      const provider = s.provider || DEFAULT_PROVIDER;
      if (!providerCanRun(provider)) {
        const r = writePlaceholder(s, `no credentials for provider "${provider}"`);
        console.error(`  ⚠ ${r.id}: placeholder.svg (no provider credentials — run --doctor)`);
        return r;
      }
      try { const r = await makeOne(s); const sc = r.score && r.score.overall != null ? `, judge=${r.score.overall}${r.n ? '/best-of-' + r.n : ''}${r.score.verdict === 'regen' ? ' ⚠regen' : ''}` : ''; console.error(`  ✓ ${r.id} (${r.provider}${r.authMode ? ':' + r.authMode : ''}/${r.model}, ${(r.bytes / 1024 | 0)}KB${r.ms ? ', ' + (r.ms / 1000 | 0) + 's' : ''}${sc})`); return r; }
      catch (e) {
        // Generation failed for this slot -> fall back to a placeholder so the page stays renderable.
        const r = writePlaceholder(s, 'generation failed: ' + e.message);
        console.error(`  ✗ ${s.id}: ${e.message}  ->  wrote placeholder.svg`);
        return r;
      }
    }));
    results.push(...settled);
  }
  const placeholders = results.filter((r) => r.placeholder).length;
  const manifest = { outDir, provider: DEFAULT_PROVIDER, openaiModel: OPENAI_MODEL, geminiModel: GEMINI_MODEL,
    judge: JUDGE, bestOfN: BEST_OF_N || undefined, styleDNA: !!plan.styleDNA, canonicalRefs: CANON_REFS.length,
    total: results.length, ok: results.filter((r) => r.ok).length,
    placeholders: placeholders || undefined,
    note: placeholders
      ? 'Slots with "placeholder":true are license-clear SVG stand-ins, not real photos. To upgrade them: enable a provider (run `node gen-assets.js --doctor` to see how — `codex login` is free), then re-run this same command; real images overwrite the placeholders.'
      : undefined,
    slots: results };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ outDir, ok: manifest.ok, total: manifest.total, placeholders: placeholders || 0, files: results.filter((r) => r.ok).map((r) => r.file) }, null, 2));
  if (manifest.ok === 0) process.exit(2);
})().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
