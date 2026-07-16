#!/usr/bin/env node
// image-service.js — Visigner **design-core** GLOBAL image service.
//
// A thin, skill-agnostic entry point over the proven detail-page image engine
// (gen-plan.js -> gen-assets.js + lib-openai-responses.js). It does NOT reimplement
// generation; it (1) injects LATEST-model env defaults, (2) reports/selects auth
// (ChatGPT OAuth first — FREE — then API keys), and (3) dispatches single-image /
// brief-set / existing-plan requests to the existing engine. Node built-ins only
// (Node 20 built-in fetch) — no npm install, same supply-chain posture as the engine.
//
// WHY a wrapper (and not moving the engine): every discipline skill — ui-design,
// brand-identity, marketing-conversion, detail-page — needs imagery, but the engine
// historically lived only inside detail-page. This exposes ONE stable command any
// skill/command (e.g. /design-image) can call, without relocating or rewriting the
// verified engine (its relative requires and the shipped plugin stay intact).
//
// Usage:
//   node image-service.js --doctor
//   node image-service.js "<one-line description>" [outDir] [--aspect 3:4] [--provider gemini]
//   node image-service.js --image "<prompt>"       [outDir] [--aspect 3:4] [--provider ...]
//   node image-service.js --brief <brief.json>     [outDir]   # plan a whole asset set, then render
//   node image-service.js --plan  <asset-plan.json> [outDir]  # render an existing plan
//
// Model selection (an explicit env always wins):
//   - OpenAI, latest quality: the DEFAULT high-end path is `openai-responses` (a reasoning model
//     driving the image_generation tool), auto-selected under a ChatGPT/codex login — this is how
//     gpt-image-2-class output (shipped 2026-04) is reached. We deliberately do NOT force
//     OPENAI_IMAGE_MODEL (the LEGACY /v1/images knob) to gpt-image-2; see withLatestDefaults() for
//     why (it would silently downgrade a key-only user to a placeholder). Opt in per-run with
//     `OPENAI_IMAGE_MODEL=gpt-image-2` if that model is enabled on your key.
//   - Gemini, latest: GEMINI_IMAGE_MODEL defaults to `gemini-3-pro-image` (Nano Banana Pro);
//     Imagen via `GEMINI_IMAGE_MODEL=imagen-4.0-ultra-generate-001`.
//
// Auth precedence (mirrors the engine's autoProvider): ChatGPT OAuth (~/.codex/auth.json,
// FREE, no key) is preferred; else OPENAI_API_KEY / GEMINI_API_KEY (paid); else a
// graceful SVG-placeholder run so a page still renders.

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// ---- locate the proven engine (kept in place under detail-page) ----
const ENGINE_DIR = path.resolve(__dirname, '..', '..', 'detail-page', 'scripts');
const GEN_PLAN = path.join(ENGINE_DIR, 'gen-plan.js');
const GEN_ASSETS = path.join(ENGINE_DIR, 'gen-assets.js');
const LIB = path.join(ENGINE_DIR, 'lib-openai-responses.js');

function fail(msg, code = 1) { console.error('[image-service] ' + msg); process.exit(code); }

// Latest-model env defaults — set only if the caller has not (an explicit env always wins).
//
// We intentionally do NOT force OPENAI_IMAGE_MODEL. That variable only controls the LEGACY
// /v1/images provider, which the delegated engine (gen-assets.js) pins to a known-good default
// (gpt-image-1.5) and documents as NOT carrying gpt-image-2. Forcing gpt-image-2 there would, for
// a key-only (no-OAuth) user whose key lacks /v1/images gpt-image-2 access, make the call error and
// silently degrade to an SVG placeholder (the engine catches and placeholders, exiting 0). The
// latest OpenAI quality is delivered by the DEFAULT high-end path instead — openai-responses, which
// the engine auto-selects under a ChatGPT/codex login. Opt gpt-image-2 into the legacy path
// per-run with OPENAI_IMAGE_MODEL=gpt-image-2 (needs that access on the key).
function withLatestDefaults() {
  const env = { ...process.env };
  // Nano Banana Pro — already the engine's own latest default; set explicitly for clarity/pinning.
  if (!env.GEMINI_IMAGE_MODEL) env.GEMINI_IMAGE_MODEL = 'gemini-3-pro-image';
  return env;
}

// Slug for a filename from a free-text prompt (deterministic; ASCII + CJK-safe).
function slug(s, fallback) {
  const base = String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || fallback || 'image';
}

// Run one engine script with inherited stdio and the latest-model env.
function runEngine(scriptPath, argv) {
  if (!fs.existsSync(scriptPath)) fail('engine script missing: ' + scriptPath + ' — is the Visigner plugin intact?');
  const r = spawnSync(process.execPath, [scriptPath, ...argv], {
    stdio: 'inherit',
    env: withLatestDefaults(),
  });
  if (r.error) fail('failed to launch ' + path.basename(scriptPath) + ': ' + r.error.message);
  return r.status == null ? 1 : r.status;
}

// ---- arg parsing (small, forgiving) ----
const argv = process.argv.slice(2);
function takeFlag(name) {
  const i = argv.indexOf(name);
  if (i === -1) return null;
  const v = argv[i + 1];
  argv.splice(i, v && !v.startsWith('--') ? 2 : 1);
  return v && !v.startsWith('--') ? v : true;
}

// --doctor: reuse the engine's own provider doctor so the report reflects our latest
// defaults (gpt-image-2 etc.). Zero network, never crashes.
if (argv.includes('--doctor')) {
  console.log('Visigner design-core — global image service');
  console.log('Delegating provider preflight to the shared engine (latest-model defaults applied):\n');
  process.exit(runEngine(GEN_ASSETS, ['--doctor']));
}

let credentialPreflightRan = false;
function surfaceCredentialPreflight() {
  if (credentialPreflightRan) return;
  credentialPreflightRan = true;
  try {
    const { detectImageCredentials } = require(path.resolve(__dirname, '..', '..', '..', 'hooks', 'cred-detect.js'));
    const report = detectImageCredentials({ env: withLatestDefaults() });
    console.error(`[image-service] ${report.systemMessage}`);
    console.error(report.additionalContext);
  } catch (error) {
    const reason = String(error && error.message || error || 'unknown error').replace(/\s+/g, ' ').trim().slice(0, 800);
    console.error(`[image-service] credential preflight unavailable (non-blocking): ${reason}`);
  }
}

const aspect = takeFlag('--aspect');
const provider = takeFlag('--provider');
const briefPath = takeFlag('--brief');
const planPath = takeFlag('--plan');
let imagePrompt = takeFlag('--image');
const promptFromFlag = typeof imagePrompt === 'string'; // did --image supply the prompt? (shifts positional outDir)
if (imagePrompt === true) imagePrompt = null;

// remaining positionals: [prompt?] [outDir?]
const positionals = argv.filter((a) => !a.startsWith('--'));

// ---- mode: existing plan ----
if (planPath && planPath !== true) {
  const outDir = positionals[0] || undefined;
  surfaceCredentialPreflight();
  process.exit(runEngine(GEN_ASSETS, outDir ? [planPath, outDir] : [planPath]));
}

// ---- mode: brief -> plan -> render ----
if (briefPath && briefPath !== true) {
  const outDir = positionals[0] || path.join('/tmp', 'visigner-assets');
  surfaceCredentialPreflight();
  fs.mkdirSync(outDir, { recursive: true });
  const genPlanOut = path.join(outDir, 'asset-plan.json');
  const s1 = runEngine(GEN_PLAN, [briefPath, genPlanOut]);
  if (s1 !== 0) fail('gen-plan.js failed (exit ' + s1 + ')', s1);
  process.exit(runEngine(GEN_ASSETS, [genPlanOut, outDir]));
}

// ---- mode: single image (default) ----
// Prompt from --image, else the first positional.
if (!imagePrompt) imagePrompt = positionals[0];
if (!imagePrompt) {
  console.error('usage: node image-service.js "<description>" [outDir] [--aspect 3:4] [--provider gemini|openai|openai-responses]');
  console.error('       node image-service.js --brief brief.json [outDir]   |   --plan plan.json [outDir]   |   --doctor');
  process.exit(1);
}
// When --image supplied the prompt, the outDir is the FIRST positional; otherwise the prompt is
// positional[0], so the outDir is positional[1]. (Fixes the `--image "x" outDir` silent-ignore.)
const outDir = (promptFromFlag ? positionals[0] : positionals[1]) || path.join('/tmp', 'visigner-image');
surfaceCredentialPreflight();
fs.mkdirSync(outDir, { recursive: true });

const id = slug(imagePrompt, 'image');
const oneSlot = { id, prompt: String(imagePrompt), tier: 'hero' };
if (aspect && aspect !== true) oneSlot.aspect = aspect;
if (provider && provider !== true) oneSlot.provider = provider; // else engine autoProvider picks (OAuth-first)

// Write the 1-slot plan INTO outDir (same convention as --brief; no temp-dir leak).
const plan = { style: '', outDir, slots: [oneSlot] };
const singlePlanPath = path.join(outDir, 'asset-plan.json');
fs.writeFileSync(singlePlanPath, JSON.stringify(plan, null, 2));

process.exit(runEngine(GEN_ASSETS, [singlePlanPath, outDir]));
