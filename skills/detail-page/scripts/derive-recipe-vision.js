#!/usr/bin/env node
'use strict';

// Vision-only completion for G2.2 build-recipe skeletons.  This script is
// deliberately conservative: a proposal is never inserted merely because it
// sounds plausible.  The proposal and a separate verifier must both identify
// the same supplied tile before the skeleton's empty slot can change.

const fs = require('fs');
const path = require('path');

// Keep the established free Codex/ChatGPT OAuth location, but own the
// Responses text request here just as reproduce-and-score.js does.
const { hasChatGPTAuth, codexAuthPath } = require('./lib-openai-responses');

const CODEX_BASE = 'https://chatgpt.com/backend-api/codex';
const APIKEY_BASE = 'https://api.openai.com/v1';
const VISION_SLOT = '_EMPTY — [tile — TODO vision (G2.4)]; no visual claim is made._';
const SIGNATURE_SALIENCE_SLOT = 'signature.salience';
const MAX_SIGNATURE_SALIENCE = 3;
const PRODUCT_PHOTO_HEADING = '## 0.5 · PRODUCT-PHOTO CARRYING — CROP, DO NOT DESCRIBE';
const PRODUCT_PHOTO_SCHEMA = 'visigner.product-photo-carrying/v1';
const PRODUCT_PHOTO_MISS_MESSAGE = 'MISS — no confidently verified product-photo region found; do not invent a crop or replace it with a description.';
const PRODUCT_PHOTO_MIN_CONFIDENCE = 0.8;
const PRODUCT_PHOTO_MIN_SIDE_PX = 64;
const MAX_PRODUCT_PHOTO_REGIONS = 8;
const SIGNATURE_SALIENCE_HEADING =
  '## 0 · SIGNATURE-SALIENCE — REPRODUCE THESE FIRST (ranked)';
const VISION_UNAVAILABLE_MESSAGE =
  'vision recipe derivation unavailable — set up codex login or OPENAI_API_KEY';
const MISS_MESSAGE = 'MISS — no vision-grounded match found — this is a database miss, not an empty value; do not invent one.';
const EXPLICIT_REGION_MESSAGE = 'REFUSING — no explicit recipe region slot was supplied; provide a visible region slot instead of assuming one.';
const OVERWRITE_MESSAGE = (file) => `REFUSING — output already exists: ${file}; skipped without --force (non-destructive overwrite guard).`;

const SLOT_DESCRIPTIONS = Object.freeze({
  'tokens.color_system': 'visible palette, colour roles, and any clearly visible colour application',
  'tokens.typography_system': 'visibly observable type roles, weight/scale contrast, and text treatment',
  'tokens.spacing_scale': 'visibly observable spacing rhythm or section gaps (do not invent exact pixels)',
  'tokens.radius_scale': 'visibly observable corner treatment (do not invent a radius value)',
  'tokens.elevation_system': 'visibly observable borders, shadows, or flat/elevated treatment',
  'tokens.motion_tokens': 'only visible static motion restraint; never claim an unseen animation',
  'layout.concept': 'one-sentence visible composition thesis',
  'layout.section_arc': 'visible ordered bands or sections in the cited tile only',
  'layout.grid': 'visible column, inset, full-bleed, or container rule',
  'layout.alignment_and_splits': 'visible alignment, asymmetry, or split-column rule',
  'layout.render_decomposition': 'visible region-by-region render decomposition',
  'signature.name': 'a concise descriptive name for a visible, distinctive arrangement; never invent labels',
  'signature.visual_decomposition': 'the visible arrangement that makes the signature identifiable',
  'signature.execution_constraint': 'a concrete reproduction constraint based only on the visible arrangement',
  'build.component_sequence': 'a component sequence limited to visible regions already evidenced',
  'build.responsive_a11y_steps': 'a conservative responsive/a11y instruction derived from the visible layout only',
  'anti_slop.forbidden_substitutions': 'a concrete visible substitution to avoid',
  'anti_slop.motion_restraint': 'a motion-restraint instruction that introduces no unseen animation claim',
});

function visionUnavailableError(reason) {
  const error = new Error(reason ? `${VISION_UNAVAILABLE_MESSAGE} (${reason})` : VISION_UNAVAILABLE_MESSAGE);
  error.code = 'VISION_RECIPE_UNAVAILABLE';
  return error;
}

function usage() {
  return 'Usage: node scripts/derive-recipe-vision.js <captureDir> --skeleton <G2.2-recipe.md> [--out <path>] [--vision-fixture <recorded-responses.json>] [--force]';
}

function parseArgs(argv) {
  if (!argv.length || argv[0].startsWith('-')) throw new Error(usage());
  const args = { captureDir: argv[0], skeleton: null, out: null, visionFixture: null, force: false };
  for (let index = 1; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--force' && !args.force) {
      args.force = true;
      continue;
    }
    if ((flag !== '--skeleton' && flag !== '--out' && flag !== '--vision-fixture') || !argv[index + 1]) throw new Error(usage());
    const key = flag === '--vision-fixture' ? 'visionFixture' : flag.slice(2);
    if (args[key] !== null) throw new Error(usage());
    args[key] = argv[index + 1];
    index += 1;
  }
  if (!args.skeleton) throw new Error(usage());
  return args;
}

function normalText(value, maxLength = 700) {
  if (typeof value !== 'string') return null;
  const result = value.replace(/\s+/gu, ' ').trim();
  return result && result.length <= maxLength ? result : null;
}

function recipeText(value) {
  // Model-supplied citations are not trusted.  The writer below appends the
  // one citation that survived the verifier, so the rendered recipe cannot
  // accidentally claim support from a different tile.
  return normalText(value, 700)
    ?.replace(/\[(?:tile(?:_[A-Za-z0-9-]+)?|styles|body)\]/giu, '')
    .replace(/`/gu, "'")
    .replace(/<!--.*?-->/gu, '')
    .replace(/\s+/gu, ' ')
    .trim() || null;
}

function signatureSalienceSlot(rank) {
  return `${SIGNATURE_SALIENCE_SLOT}.${rank + 1}`;
}

function isSignatureSalienceSlot(slot) {
  return typeof slot === 'string' && new RegExp(`^${SIGNATURE_SALIENCE_SLOT.replace('.', '\\.')}(?:\\.\\d+)?$`, 'u').test(slot);
}

function findNextSlotAfter(lines, heading) {
  const start = lines.findIndex((line) => heading.test(line));
  if (start === -1) return -1;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (index > start + 1 && /^###\s+/u.test(lines[index])) break;
    if (lines[index].includes(VISION_SLOT)) return index;
  }
  return -1;
}

function findSlotLine(lines, marker) {
  return lines.findIndex((line) => line.includes(marker) && line.includes(VISION_SLOT));
}

const SLOT_LOCATORS = Object.freeze({
  'tokens.color_system': (lines) => findNextSlotAfter(lines, /^###\s+1\.1\s+Color\b/iu),
  'tokens.typography_system': (lines) => findNextSlotAfter(lines, /^###\s+1\.2\s+Type\b/iu),
  'tokens.spacing_scale': (lines) => findNextSlotAfter(lines, /^###\s+1\.3\s+Spacing\b/iu),
  'tokens.radius_scale': (lines) => findNextSlotAfter(lines, /^###\s+1\.4\s+Radius\b/iu),
  'tokens.elevation_system': (lines) => findNextSlotAfter(lines, /^###\s+1\.5\s+Elevation\b/iu),
  'tokens.motion_tokens': (lines) => findNextSlotAfter(lines, /^###\s+1\.6\s+Motion\b/iu),
  'layout.concept': (lines) => findSlotLine(lines, '**Concept (one sentence):**'),
  'layout.section_arc': (lines) => findSlotLine(lines, '**Section arc:**'),
  'layout.grid': (lines) => findSlotLine(lines, '**Grid:**'),
  'layout.alignment_and_splits': (lines) => findSlotLine(lines, '**Alignment and splits:**'),
  'layout.render_decomposition': (lines) => findSlotLine(lines, '**Render decomposition:**'),
  'signature.name': (lines) => findSlotLine(lines, '**Name:**'),
  'signature.visual_decomposition': (lines) => findSlotLine(lines, '**Visual decomposition:**'),
  'signature.execution_constraint': (lines) => findSlotLine(lines, '**Execution constraint:**'),
  'build.component_sequence': (lines) => findSlotLine(lines, '**Component sequence.**'),
  'build.responsive_a11y_steps': (lines) => findSlotLine(lines, '**Responsive + a11y.**'),
  'anti_slop.forbidden_substitutions': (lines) => findSlotLine(lines, '**Forbidden substitutions:**'),
  'anti_slop.motion_restraint': (lines) => findSlotLine(lines, '**Motion restraint:**'),
});

function pendingSlots(markdown) {
  const lines = String(markdown).replace(/\r\n?/gu, '\n').split('\n');
  return Object.keys(SLOT_LOCATORS).filter((slot) => SLOT_LOCATORS[slot](lines) !== -1);
}

function tileMime(file) {
  const extension = path.extname(file).toLowerCase();
  return extension === '.png' ? 'image/png' : 'image/jpeg';
}

function readImageDimensions(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error(`unsupported capture tile image ${file}; expected PNG or JPEG`);
  }
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return { height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  throw new Error(`could not read dimensions from JPEG capture tile ${file}`);
}

function readCaptureTiles(captureDir, { maxTiles = Number(process.env.RECIPE_VISION_MAX_TILES || 12) } = {}) {
  if (!Number.isInteger(maxTiles) || maxTiles < 1) {
    throw new Error('RECIPE_VISION_MAX_TILES must be a positive integer');
  }
  const absolute = path.resolve(captureDir);
  let entries;
  try {
    entries = fs.readdirSync(absolute, { withFileTypes: true });
  } catch (error) {
    throw new Error(`cannot read capture directory ${absolute}: ${error.message}`);
  }
  const tiles = [];
  const ids = new Set();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(/^(?:desktop-)?tile_(\d+)\.(png|jpe?g)$/iu);
    if (!match) continue;
    const id = `tile_${match[1]}`;
    if (ids.has(id)) throw new Error(`ambiguous capture tiles: more than one file maps to ${id}`);
    ids.add(id);
    tiles.push({ id, number: Number(match[1]), file: path.join(absolute, entry.name) });
  }
  tiles.sort((left, right) => left.number - right.number || left.id.localeCompare(right.id));
  if (!tiles.length) {
    throw new Error(`${MISS_MESSAGE} no tile_*.png/.jpg or desktop-tile_*.png/.jpg files found in ${absolute}`);
  }
  return { all: tiles, selected: tiles.slice(0, maxTiles) };
}

function imageInput(tile) {
  return {
    type: 'input_image',
    image_url: `data:${tileMime(tile.file)};base64,${fs.readFileSync(tile.file).toString('base64')}`,
  };
}

function readTextResponsesStream(res) {
  return (async () => {
    if (!res.body || typeof res.body.getReader !== 'function') {
      throw new Error('vision Responses API returned no readable stream');
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let output = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        let data = '';
        for (const line of block.split('\n')) if (line.startsWith('data: ')) data += line.slice(6);
        if (!data || data === '[DONE]') continue;
        let event;
        try {
          event = JSON.parse(data);
        } catch (_) {
          continue;
        }
        if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') output += event.delta;
        if (event.type === 'response.completed' && !output && Array.isArray(event.response?.output)) {
          for (const item of event.response.output) {
            for (const content of item.content || []) {
              if ((content.type === 'output_text' || content.type === 'text') && typeof content.text === 'string') {
                output += content.text;
              }
            }
          }
        }
        if (event.type === 'error' || event.type === 'response.failed') {
          const message = event.error?.message || event.response?.error?.message || JSON.stringify(event).slice(0, 200);
          throw new Error(`vision recipe stream error: ${message}`);
        }
      }
    }
    return output;
  })();
}

function parseJsonObject(value, label) {
  if (value && typeof value === 'object') return value;
  const text = String(value || '');
  try {
    return JSON.parse(text);
  } catch (_) {
    const match = text.match(/\{[\s\S]*\}/u);
    if (!match) throw new Error(`${label} returned non-JSON: ${text.slice(0, 180)}`);
    try {
      return JSON.parse(match[0]);
    } catch (error) {
      throw new Error(`${label} returned invalid JSON: ${error.message}`);
    }
  }
}

function resolveVisionAuth({ hasChatGPTAuthFn = hasChatGPTAuth, codexAuthPathFn = codexAuthPath } = {}) {
  const requestedMode = process.env.OPENAI_RESPONSES_AUTH;
  const hasOAuth = hasChatGPTAuthFn();
  const hasApiKey = Boolean(process.env.OPENAI_API_KEY);
  const authMode = requestedMode || (hasOAuth ? 'chatgpt-oauth' : 'apikey');

  if (authMode === 'chatgpt-oauth') {
    if (!hasOAuth) throw visionUnavailableError('no ChatGPT/Codex auth found');
    let auth;
    try {
      auth = JSON.parse(fs.readFileSync(codexAuthPathFn(), 'utf8'));
    } catch (_) {
      throw visionUnavailableError('could not read ChatGPT/Codex auth');
    }
    const accessToken = auth?.tokens?.access_token;
    if (!accessToken) throw visionUnavailableError('ChatGPT/Codex auth has no access token');
    return {
      authMode,
      base: CODEX_BASE,
      model: process.env.RECIPE_VISION_MODEL || process.env.ORACLE_VISION_MODEL || process.env.OPENAI_RESPONSES_MODEL || 'gpt-5.4-mini',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${accessToken}`,
        ...(auth?.tokens?.account_id ? { 'chatgpt-account-id': auth.tokens.account_id } : {}),
        'OpenAI-Beta': 'responses=experimental',
        originator: 'codex_cli_rs',
        'User-Agent': 'visigner-recipe-vision/1.0',
      },
    };
  }

  if (authMode === 'apikey') {
    if (!hasApiKey) throw visionUnavailableError('OPENAI_API_KEY is unset');
    return {
      authMode,
      base: APIKEY_BASE,
      model: process.env.RECIPE_VISION_MODEL || process.env.ORACLE_VISION_MODEL || process.env.OPENAI_RESPONSES_MODEL || 'gpt-5.2',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    };
  }

  throw visionUnavailableError(`unsupported OPENAI_RESPONSES_AUTH=${authMode}`);
}

function tileContent(tiles) {
  const content = [];
  for (const tile of tiles) {
    content.push({ type: 'input_text', text: `Tile identifier: ${tile.id}. Use this exact identifier when citing this image.` });
    content.push(imageInput(tile));
  }
  return content;
}

function proposalRequest({ slots, tiles, model }) {
  const slotList = slots.map((slot) => `- ${slot}: ${SLOT_DESCRIPTIONS[slot]}`).join('\n');
  return {
    model,
    input: [
      {
        role: 'developer',
        content: 'You are a conservative visual evidence extractor. Work only from the supplied capture tiles. ' +
          'Do not use product knowledge, webpage conventions, or likely hidden content. A plausible claim is not evidence. ' +
          'Never invent labels, figure numbers, eyebrow copy, or signature names that are not visibly present. Reply with JSON only.',
      },
      {
        role: 'user',
        content: [
          ...tileContent(tiles),
          {
            type: 'input_text',
            text: 'Propose values only for the listed empty recipe slots. Return exactly one JSON object: ' +
              '{"proposals":[{"slot":"one listed slot","value":"concise recipe text","tile":"tile_NN","visibleEvidence":"what is plainly visible in that exact tile"}]}. ' +
              'Omit any slot that is not plainly visible. Each proposal must cite exactly one supplied tile. ' +
              'For colour/type/spacing/radius, describe only what can actually be seen; do not claim sampled precision or an unseen interaction. ' +
              'A signature name must be a descriptive name for a visible arrangement, never an invented on-page label.\n\nPending slots:\n' + slotList,
          },
        ],
      },
    ],
    stream: true,
    store: false,
  };
}

function signatureSalienceRequest({ tiles, model }) {
  return {
    model,
    input: [
      {
        role: 'developer',
        content: 'You are a conservative visual-salience extractor. Work only from the supplied capture tiles. ' +
          'Identify up to three visible, load-bearing signature elements that make this page memorable and least interchangeable. ' +
          'Rank them using the objective salience cues visible in the tiles: recurrence across tiles, size/prominence, and visual distinctiveness. ' +
          'Weight motifs supported by more than one of those cues above motifs supported by only one; recurrence alone must not elevate a generic testimonial/text container or small support icon over a larger distinctive page-specific emblem or repeated achievement/metric-panel motif. ' +
          'Prefer clearly visible repeated motifs or large page-specific treatments over small, one-off badges, incidental icons, platform chrome, generic layout, generic typography, or copy alone. ' +
          'A plausible or likely signature is not evidence. ' +
          'The signature description must name a concrete, renderable visual object or motif and its visible treatment; broad poster style, colour palette, typography, or composition alone is not a signature. ' +
          'For each signature, state one short why-it-is-a-signature line grounded in visible recurrence, size/prominence, or distinctiveness. ' +
          'If no element is clearly dominant and plainly visible in one supplied tile, return none. Never invent labels, figure numbers, or unseen repetition. Reply with JSON only.',
      },
      {
        role: 'user',
        content: [
          ...tileContent(tiles),
          {
            type: 'input_text',
            text: 'Choose the TOP-3 (or fewer) identity-bearing visual signatures, in ranked order. Each may be a repeated motif, a distinctive graphic treatment, or a photo treatment, but it must be plainly visible in its cited tile. ' +
              'Rank by the aggregate visible objective cues of recurrence across tiles, size/prominence, and distinctiveness; do not let repetition alone outrank a larger distinct emblem or repeated achievement/metric-panel treatment. ' +
              'Return exactly one JSON object: ' +
              '{"signatures":[{"value":"concise concrete visible description","tile":"tile_NN","why":"one short line citing visible repetition, size/prominence, or distinctiveness","visibleEvidence":"what is plainly visible in that exact tile"}]}. ' +
              'Return no more than three entries, or {"signatures":[]} when there is no dominant signature. ' +
              'Each value must describe only one concrete, renderable visible motif (not generic poster style, colour, type, or layout) and must not include a citation.',
          },
        ],
      },
    ],
    stream: true,
    store: false,
  };
}

function productPhotoProposalRequest({ tiles, model }) {
  const dimensions = tiles.map((tile) => ({ tile: tile.id, ...readImageDimensions(tile.file) }));
  return {
    model,
    input: [
      {
        role: 'developer',
        content: 'You are a conservative product-photo crop extractor. Work only from the supplied capture tiles. ' +
          'A product-photo region is a visible, real product-specific visual: a template/product screenshot, a product mockup, or a photographed proof scene. ' +
          'It is NOT text, platform chrome, a decorative 3D icon, a badge, a generic gradient, or a section whose image identity is uncertain. ' +
          'When uncertain, omit it. Never infer hidden pixels or extend a crop outside the visible tile. Reply with JSON only.',
      },
      {
        role: 'user',
        content: [
          ...tileContent(tiles),
          {
            type: 'input_text',
            text: 'Identify up to ' + MAX_PRODUCT_PHOTO_REGIONS + ' confidently visible product-photo regions. Tile dimensions (origin is top-left, all crop coordinates are visible rendered pixels): ' +
              JSON.stringify(dimensions) + '. Return exactly one JSON object: ' +
              '{"regions":[{"tile":"tile_NN","crop":{"x":integer,"y":integer,"width":integer,"height":integer},"role":"concise placement role","confidence":0.0-1.0,"visibleEvidence":"what real product visual is plainly inside this exact crop"}]}. ' +
              'Only include confidence >= ' + PRODUCT_PHOTO_MIN_CONFIDENCE + '. A crop must be at least ' + PRODUCT_PHOTO_MIN_SIDE_PX + ' px wide and high, lie fully inside its tile, and exclude unrelated platform chrome when possible. ' +
              'Return {"regions":[]} if no region is confidently classifiable; absence is an explicit MISS, never an invented crop.',
          },
        ],
      },
    ],
    stream: true,
    store: false,
  };
}

function productPhotoVerificationRequest({ candidates, tiles, model }) {
  return {
    model,
    input: [
      {
        role: 'developer',
        content: 'You are an independent strict verifier for product-photo crops. Inspect the supplied tiles yourself. ' +
          'Confirm only a candidate whose exact crop box visibly contains the stated real product-specific visual. ' +
          'Reject text, platform chrome, decorative icons, generic gradients, uncertain crops, or any candidate you cannot independently confirm. ' +
          'Do not repair or move the proposed box: when it is wrong, reject it. Reply with JSON only.',
      },
      {
        role: 'user',
        content: [
          ...tileContent(tiles),
          {
            type: 'input_text',
            text: 'Independently verify every candidate below. Return exactly one JSON object: ' +
              '{"verifications":[{"id":"photo_N","tile":"tile_NN","crop":{"x":integer,"y":integer,"width":integer,"height":integer},"confirmed":true|false,"confidence":0.0-1.0,"visibleEvidence":"specific observed product visual when true; empty when false"}]}. ' +
              'Keep id, tile, and crop exactly as supplied. Confirm only at confidence >= ' + PRODUCT_PHOTO_MIN_CONFIDENCE + '. Candidates: ' + JSON.stringify(candidates),
          },
        ],
      },
    ],
    stream: true,
    store: false,
  };
}

function verificationRequest({ candidates, tiles, model }) {
  const candidateList = candidates.map((candidate) => ({
    slot: candidate.slot,
    value: candidate.value,
    tile: candidate.tile,
    ...(candidate.why ? { signatureWhy: candidate.why } : {}),
    proposerEvidence: candidate.visibleEvidence,
  }));
  return {
    model,
    input: [
      {
        role: 'developer',
        content: 'You are an independent, strict visual verifier. Inspect the supplied images yourself. ' +
          'A candidate is confirmed only when its named element/arrangement is plainly visible in its exact cited tile. ' +
          'For a candidate whose slot begins signature.salience, also confirm that it is a dominant, identity-bearing page treatment and that its stated signature reason is supported by visible repetition, size/prominence, or distinctiveness, rather than a small one-off badge, incidental icon, platform chrome, generic layout, or copy alone. ' +
          'Reject a signature.salience description that names only broad poster style, colour, typography, or composition instead of a concrete, renderable motif. ' +
          'Reject plausible extrapolations, hidden-content assumptions, and invented labels (including FIG-style labels) as false. ' +
          'When uncertain, reject. Reply with JSON only.',
      },
      {
        role: 'user',
        content: [
          ...tileContent(tiles),
          {
            type: 'input_text',
            text: 'Verify these candidate recipe values independently. Return exactly one JSON object: ' +
              '{"verifications":[{"slot":"...","tile":"tile_NN","confirmed":true|false,"visibleEvidence":"specific observed feature when true; empty when false"}]}. ' +
              'Keep the slot and tile exactly as supplied; include every candidate. Candidates:\n' + JSON.stringify(candidateList),
          },
        ],
      },
    ],
    stream: true,
    store: false,
  };
}

async function callVisionJson({ auth, request, fetchFn = fetch, label }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const res = await fetchFn(`${auth.base}/responses`, {
      method: 'POST',
      headers: auth.headers,
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`${label} ${res.status} (${auth.authMode}/${auth.model}): ${detail.slice(0, 240)}`);
    }
    return parseJsonObject(await readTextResponsesStream(res), label);
  } finally {
    clearTimeout(timer);
  }
}

function normalizeProposals(response, slots, selectedTiles) {
  const parsed = parseJsonObject(response, 'vision proposal');
  const allowedSlots = new Set(slots);
  const allowedTiles = new Set(selectedTiles.map((tile) => tile.id));
  const proposals = Array.isArray(parsed.proposals) ? parsed.proposals : [];
  const accepted = [];
  const dropped = [];
  const seenSlots = new Set();

  for (const proposal of proposals) {
    const slot = proposal && proposal.slot;
    const tile = proposal && proposal.tile;
    const value = recipeText(proposal && proposal.value);
    const visibleEvidence = normalText(proposal && proposal.visibleEvidence, 500);
    if (!allowedSlots.has(slot)) {
      dropped.push({ slot: typeof slot === 'string' ? slot : '<unknown>', reason: 'unknown-or-already-filled-slot' });
    } else if (seenSlots.has(slot)) {
      dropped.push({ slot, reason: 'duplicate-slot-proposal' });
    } else if (!allowedTiles.has(tile)) {
      dropped.push({ slot, reason: 'missing-or-unselected-tile-citation' });
    } else if (!value || value.includes(VISION_SLOT)) {
      dropped.push({ slot, reason: 'missing-safe-value' });
    } else if (!visibleEvidence) {
      dropped.push({ slot, reason: 'missing-visible-evidence' });
    } else {
      seenSlots.add(slot);
      accepted.push({ slot, tile, value, visibleEvidence });
    }
  }
  return { candidates: accepted, dropped };
}

function normalizeSignatureSalience(response, selectedTiles) {
  const parsed = parseJsonObject(response, 'signature-salience proposal');
  const signatures = Array.isArray(parsed.signatures) ? parsed.signatures : [];
  const allowedTiles = new Set(selectedTiles.map((tile) => tile.id));
  const candidates = [];
  const dropped = [];

  for (const [index, signature] of signatures.entries()) {
    if (index >= MAX_SIGNATURE_SALIENCE) {
      dropped.push({ slot: SIGNATURE_SALIENCE_SLOT, reason: 'exceeds-ranked-top-3' });
      continue;
    }
    const tile = signature && signature.tile;
    const value = recipeText(signature && signature.value);
    const why = recipeText(signature && signature.why);
    const visibleEvidence = normalText(signature && signature.visibleEvidence, 500);
    if (!allowedTiles.has(tile)) {
      dropped.push({ slot: SIGNATURE_SALIENCE_SLOT, reason: 'missing-or-unselected-tile-citation' });
    } else if (!value || value.includes(VISION_SLOT)) {
      dropped.push({ slot: SIGNATURE_SALIENCE_SLOT, reason: 'missing-safe-value' });
    } else if (!why) {
      dropped.push({ slot: SIGNATURE_SALIENCE_SLOT, reason: 'missing-signature-salience-reason' });
    } else if (!visibleEvidence) {
      dropped.push({ slot: SIGNATURE_SALIENCE_SLOT, reason: 'missing-visible-evidence' });
    } else {
      // A rank-specific slot preserves the verifier's existing (slot, tile)
      // binding when two independently visible signatures share one tile.
      candidates.push({ slot: signatureSalienceSlot(index), tile, value, why, visibleEvidence });
    }
  }
  return { candidates, dropped };
}

function normalCropBox(value, dimensions) {
  if (!value || typeof value !== 'object') return null;
  const crop = {
    x: Number(value.x),
    y: Number(value.y),
    width: Number(value.width),
    height: Number(value.height),
  };
  if (!Object.values(crop).every(Number.isInteger)) return null;
  if (crop.x < 0 || crop.y < 0 || crop.width < PRODUCT_PHOTO_MIN_SIDE_PX || crop.height < PRODUCT_PHOTO_MIN_SIDE_PX) return null;
  if (crop.x + crop.width > dimensions.width || crop.y + crop.height > dimensions.height) return null;
  return crop;
}

function photoCandidateOrder(left, right) {
  return left.tile.localeCompare(right.tile, 'en-US')
    || left.crop.y - right.crop.y
    || left.crop.x - right.crop.x
    || left.crop.height - right.crop.height
    || left.crop.width - right.crop.width
    || left.role.localeCompare(right.role, 'en-US');
}

function normalizeProductPhotoRegions(response, selectedTiles) {
  const parsed = parseJsonObject(response, 'product-photo proposal');
  const tilesById = new Map(selectedTiles.map((tile) => [tile.id, tile]));
  const regions = Array.isArray(parsed.regions) ? parsed.regions : [];
  const accepted = [];
  const dropped = [];
  const seen = new Set();

  for (const region of regions) {
    const tile = region && region.tile;
    const sourceTile = tilesById.get(tile);
    const dimensions = sourceTile ? readImageDimensions(sourceTile.file) : null;
    const role = normalText(region && region.role, 160);
    const confidence = Number(region && region.confidence);
    const visibleEvidence = normalText(region && region.visibleEvidence, 500);
    const crop = dimensions ? normalCropBox(region && region.crop, dimensions) : null;
    const key = crop && role ? `${tile}\u0000${crop.x}\u0000${crop.y}\u0000${crop.width}\u0000${crop.height}\u0000${role}` : null;
    if (!dimensions) {
      dropped.push({ slot: 'product-photo', reason: 'missing-or-unselected-tile-citation' });
    } else if (!role) {
      dropped.push({ slot: 'product-photo', reason: 'missing-product-photo-role' });
    } else if (!crop) {
      dropped.push({ slot: 'product-photo', reason: 'invalid-or-too-small-crop-box' });
    } else if (!Number.isFinite(confidence) || confidence < PRODUCT_PHOTO_MIN_CONFIDENCE || confidence > 1) {
      dropped.push({ slot: 'product-photo', reason: 'below-product-photo-confidence-threshold' });
    } else if (!visibleEvidence) {
      dropped.push({ slot: 'product-photo', reason: 'missing-product-photo-visible-evidence' });
    } else if (seen.has(key)) {
      dropped.push({ slot: 'product-photo', reason: 'duplicate-product-photo-region' });
    } else {
      seen.add(key);
      accepted.push({ tile, sourceTile: path.basename(sourceTile.file), crop, role, confidence, visibleEvidence });
    }
  }

  return {
    candidates: accepted
      .sort(photoCandidateOrder)
      .slice(0, MAX_PRODUCT_PHOTO_REGIONS)
      .map((candidate, index) => ({ ...candidate, id: `photo_${index + 1}` })),
    dropped,
  };
}

function sameCrop(left, right) {
  return Boolean(left && right)
    && left.x === right.x
    && left.y === right.y
    && left.width === right.width
    && left.height === right.height;
}

function confirmedProductPhotoRegions(candidates, response) {
  const parsed = parseJsonObject(response, 'product-photo verification');
  const verifications = Array.isArray(parsed.verifications) ? parsed.verifications : [];
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const approved = new Map();
  for (const verification of verifications) {
    const candidate = byId.get(verification && verification.id);
    if (!candidate || verification.confirmed !== true) continue;
    const confidence = Number(verification.confidence);
    const visibleEvidence = normalText(verification.visibleEvidence, 500);
    if (verification.tile !== candidate.tile || !sameCrop(verification.crop, candidate.crop)) continue;
    if (!Number.isFinite(confidence) || confidence < PRODUCT_PHOTO_MIN_CONFIDENCE || confidence > 1 || !visibleEvidence) continue;
    approved.set(candidate.id, { confidence, visibleEvidence });
  }
  const accepted = [];
  const dropped = [];
  for (const candidate of candidates) {
    const verification = approved.get(candidate.id);
    if (!verification) {
      dropped.push({ slot: 'product-photo', reason: 'product-photo-verification-rejected' });
      continue;
    }
    accepted.push({
      ...candidate,
      provenance: 'tile-vision',
      verificationConfidence: verification.confidence,
      verificationEvidence: verification.visibleEvidence,
    });
  }
  return { accepted, dropped };
}

function signatureSalienceKey(candidate) {
  return `${candidate.value.normalize('NFKC').toLocaleLowerCase('en-US')}\u0000${candidate.tile}`;
}

function signatureRank(candidate) {
  const match = String(candidate.slot || '').match(/\.(\d+)$/u);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function compareSignatureRepresentations(left, right) {
  return left.value.localeCompare(right.value, 'en-US')
    || left.tile.localeCompare(right.tile, 'en-US')
    || left.why.localeCompare(right.why, 'en-US')
    || left.visibleEvidence.localeCompare(right.visibleEvidence, 'en-US');
}

// Vision samples are intrinsically variable. Aggregate their ranked evidence
// before verification: votes dominate, then Borda-style rank score, then a
// canonical key. Choosing the textual representative with the same stable
// ordering keeps the rendered recipe byte-stable for identical sample input.
function rankSignatureSalience(samples) {
  const grouped = new Map();
  for (const sample of samples) {
    const seen = new Set();
    for (const candidate of sample) {
      const key = signatureSalienceKey(candidate);
      if (seen.has(key)) continue;
      seen.add(key);
      const rank = signatureRank(candidate);
      if (!Number.isInteger(rank) || rank < 1 || rank > MAX_SIGNATURE_SALIENCE) continue;
      const entry = grouped.get(key) || { key, votes: 0, score: 0, representations: [] };
      entry.votes += 1;
      entry.score += MAX_SIGNATURE_SALIENCE - rank + 1;
      entry.representations.push(candidate);
      grouped.set(key, entry);
    }
  }

  return [...grouped.values()]
    .map((entry) => ({
      ...entry,
      representative: entry.representations.slice().sort(compareSignatureRepresentations)[0],
    }))
    .sort((left, right) => right.votes - left.votes
      || right.score - left.score
      || left.key.localeCompare(right.key, 'en-US'))
    .map((entry, index) => ({
      ...entry.representative,
      slot: signatureSalienceSlot(index),
      votes: entry.votes,
      salienceScore: entry.score,
      salienceKey: entry.key,
    }));
}

function loadVisionFixture(input) {
  let fixture = input;
  if (typeof input === 'string') {
    const file = path.resolve(input);
    try {
      fixture = fs.readFileSync(file, 'utf8');
    } catch (error) {
      throw new Error(`cannot read --vision-fixture ${file}: ${error.message}`);
    }
  }
  const parsed = parseJsonObject(fixture, 'vision fixture');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('vision fixture must be a JSON object');
  }
  if (!Object.hasOwn(parsed, 'proposals') || !Array.isArray(parsed.signatureSamples) || !Object.hasOwn(parsed, 'verifications')) {
    throw new Error('vision fixture must contain proposals, signatureSamples, and verifications');
  }
  if (!parsed.signatureSamples.length) throw new Error('vision fixture signatureSamples must not be empty');
  return parsed;
}

function resolveSignatureSampleCount(value, fallback) {
  const count = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('signatureSamples must be a positive integer');
  }
  return count;
}

function confirmedCandidates(candidates, response) {
  const parsed = parseJsonObject(response, 'vision verification');
  const verifications = Array.isArray(parsed.verifications) ? parsed.verifications : [];
  const approved = new Map();
  for (const verification of verifications) {
    if (!verification || verification.confirmed !== true) continue;
    const slot = verification.slot;
    const tile = verification.tile;
    const visibleEvidence = normalText(verification.visibleEvidence, 500);
    if (!visibleEvidence) continue;
    approved.set(`${slot}\u0000${tile}`, visibleEvidence);
  }
  const kept = [];
  const dropped = [];
  for (const candidate of candidates) {
    const verificationEvidence = approved.get(`${candidate.slot}\u0000${candidate.tile}`);
    if (!verificationEvidence) {
      dropped.push({ slot: candidate.slot, reason: 'verification-rejected' });
      continue;
    }
    kept.push({ ...candidate, verificationEvidence });
  }
  return { accepted: kept, dropped };
}

function applyVerifiedValues(skeleton, values) {
  const bySlot = new Map(values.map((value) => [value.slot, value]));
  const lines = String(skeleton).replace(/\r\n?/gu, '\n').split('\n');
  const applied = [];
  for (const [slot, locate] of Object.entries(SLOT_LOCATORS)) {
    const value = bySlot.get(slot);
    if (!value) continue;
    const index = locate(lines);
    if (index === -1 || !lines[index].includes(VISION_SLOT)) continue;
    const cited = `${value.value} [${value.tile}]`;
    lines[index] = lines[index].replace(VISION_SLOT, cited);
    if (slot === 'layout.render_decomposition') {
      const diagramLine = lines.findIndex((line, position) => (
        position > index && line === 'EMPTY — render decomposition awaits vision (G2.4); no regions are guessed.'
      ));
      if (diagramLine !== -1) lines[diagramLine] = value.value;
    }
    applied.push(value);
  }
  return { markdown: lines.join('\n'), applied };
}

function applySignatureSalience(markdown, signatures) {
  const lines = String(markdown).replace(/\r\n?/gu, '\n').split('\n');
  const tokenBlock = lines.findIndex((line) => /^##\s+1\s*(?:·|[-–—])\s*TOKEN BLOCK\b/iu.test(line));
  if (tokenBlock === -1) throw new Error('skeleton has no TOKEN BLOCK for signature-salience insertion');
  const ranked = Array.isArray(signatures) ? signatures.slice(0, MAX_SIGNATURE_SALIENCE) : [];
  const directive = ranked.length
    ? [
      SIGNATURE_SALIENCE_HEADING,
      '',
      ...ranked.flatMap((signature, index) => [
        `${index + 1}. **${signature.value}** [${signature.tile}]`,
        `   - Why it's a signature: ${signature.why}.`,
      ]),
      '',
      'BUILD PRIORITY: reproduce ALL listed signatures faithfully, starting with #1, BEFORE the generic layout — a build that drops any listed signature fails to capture the page\'s identity.',
      ...(ranked.length < MAX_SIGNATURE_SALIENCE
        ? ['', `NOTE: only ${ranked.length} tile-grounded signature${ranked.length === 1 ? '' : 's'} survived independent verification; do not pad this ranked list with unverified or invented signatures.`]
        : []),
    ]
    : [
      SIGNATURE_SALIENCE_HEADING,
      '',
      'No dominant signature — no tile-grounded candidate survived independent verification. Do not invent a page-signature directive.',
    ];
  lines.splice(tokenBlock, 0, ...directive, '');
  return lines.join('\n');
}

function applyProductPhotoRegions(markdown, regions) {
  const lines = String(markdown).replace(/\r\n?/gu, '\n').split('\n');
  const tokenBlock = lines.findIndex((line) => /^##\s+1\s*(?:·|[-–—])\s*TOKEN BLOCK\b/iu.test(line));
  if (tokenBlock === -1) throw new Error('recipe has no TOKEN BLOCK for product-photo insertion');
  const resolved = Array.isArray(regions) ? regions.slice().sort((left, right) => left.id.localeCompare(right.id, 'en-US')) : [];
  const payload = resolved.length
    ? {
      schema: PRODUCT_PHOTO_SCHEMA,
      status: 'resolved',
      regions: resolved.map((region) => ({
        id: region.id,
        role: region.role,
        source_tile: region.sourceTile || region.tile,
        tile: region.tile,
        crop: region.crop,
        provenance: region.provenance || 'tile-vision',
        confidence: region.confidence,
        evidence: region.visibleEvidence,
        verification: {
          provenance: 'tile-vision',
          confidence: region.verificationConfidence,
          evidence: region.verificationEvidence,
        },
        gap: null,
      })),
    }
    : {
      schema: PRODUCT_PHOTO_SCHEMA,
      status: 'miss',
      regions: [],
      message: PRODUCT_PHOTO_MISS_MESSAGE,
    };
  lines.splice(tokenBlock, 0, PRODUCT_PHOTO_HEADING, '', '```json', JSON.stringify(payload, null, 2), '```', '');
  return lines.join('\n');
}

async function deriveVisionRecipe({
  captureDir,
  skeleton,
  proposeFn,
  signatureProposeFn,
  verifyFn,
  productPhotoProposeFn,
  productPhotoVerifyFn,
  visionFixture,
  signatureSamples,
  authResolver = resolveVisionAuth,
  fetchFn = fetch,
  maxTiles,
} = {}) {
  if (typeof skeleton !== 'string') throw new Error('a G2.2 skeleton Markdown string is required');
  const slots = pendingSlots(skeleton);
  if (!slots.length) throw new Error(`${EXPLICIT_REGION_MESSAGE} skeleton has no [tile — TODO vision (G2.4)] slots to derive`);
  const tiles = readCaptureTiles(captureDir, maxTiles === undefined ? undefined : { maxTiles });
  const fixture = visionFixture === undefined || visionFixture === null ? null : loadVisionFixture(visionFixture);
  const fixtureSignatureSamples = fixture ? fixture.signatureSamples : null;
  const effectiveProposeFn = proposeFn || (fixture ? () => fixture.proposals : null);
  const effectiveSignatureProposeFn = signatureProposeFn || (fixture
    ? ({ sampleIndex }) => fixtureSignatureSamples[sampleIndex]
    : null);
  const effectiveVerifyFn = verifyFn || (fixture ? () => fixture.verifications : null);
  // Existing injected proposal/verifier tests deliberately model only the
  // old slots.  Treat that as an explicit offline product-photo MISS rather
  // than quietly attempting a credentialed live call from a hermetic test.
  const offlineVisionHarness = Boolean(proposeFn || signatureProposeFn || verifyFn || fixture);
  const effectiveProductPhotoProposeFn = productPhotoProposeFn || (fixture
    ? () => fixture.productPhotoProposals || { regions: [] }
    : (offlineVisionHarness ? () => ({ regions: [] }) : null));
  const effectiveProductPhotoVerifyFn = productPhotoVerifyFn || (fixture
    ? () => fixture.productPhotoVerifications || { verifications: [] }
    : (offlineVisionHarness ? () => ({ verifications: [] }) : null));
  const defaultSampleCount = fixtureSignatureSamples
    ? fixtureSignatureSamples.length
    : (signatureProposeFn ? 1 : Number(process.env.RECIPE_VISION_SIGNATURE_SAMPLES || 3));
  const signatureSampleCount = resolveSignatureSampleCount(signatureSamples, defaultSampleCount);
  if (fixtureSignatureSamples && signatureSampleCount !== fixtureSignatureSamples.length) {
    throw new Error(`vision fixture contains ${fixtureSignatureSamples.length} signature sample(s), not ${signatureSampleCount}`);
  }
  const needsLiveAuth = !effectiveProposeFn || !effectiveSignatureProposeFn || !effectiveVerifyFn || !effectiveProductPhotoProposeFn || !effectiveProductPhotoVerifyFn;
  const auth = needsLiveAuth ? authResolver() : null;
  const context = { slots, tiles: tiles.selected, allTiles: tiles.all, signatureSampleCount };
  const proposalResponse = effectiveProposeFn
    ? await effectiveProposeFn(context)
    : await callVisionJson({
      auth,
      request: proposalRequest({ slots, tiles: tiles.selected, model: auth.model }),
      fetchFn,
      label: 'vision proposal',
  });
  const normalized = normalizeProposals(proposalResponse, slots, tiles.selected);
  const productPhotoProposalResponse = effectiveProductPhotoProposeFn
    ? await effectiveProductPhotoProposeFn(context)
    : await callVisionJson({
      auth,
      request: productPhotoProposalRequest({ tiles: tiles.selected, model: auth.model }),
      fetchFn,
      label: 'product-photo proposal',
    });
  const normalizedProductPhotos = normalizeProductPhotoRegions(productPhotoProposalResponse, tiles.selected);
  const normalizedSignatureSamples = [];
  for (let sampleIndex = 0; sampleIndex < signatureSampleCount; sampleIndex += 1) {
    const sampleContext = { ...context, sampleIndex };
    const signatureProposalResponse = effectiveSignatureProposeFn
      ? await effectiveSignatureProposeFn(sampleContext)
      : await callVisionJson({
        auth,
        request: signatureSalienceRequest({ tiles: tiles.selected, model: auth.model }),
        fetchFn,
        label: `signature-salience proposal sample ${sampleIndex + 1}/${signatureSampleCount}`,
      });
    normalizedSignatureSamples.push(normalizeSignatureSalience(signatureProposalResponse, tiles.selected));
  }
  const rankedSignatureCandidates = rankSignatureSalience(normalizedSignatureSamples.map((sample) => sample.candidates));
  const selectedSignatureCandidates = rankedSignatureCandidates.slice(0, MAX_SIGNATURE_SALIENCE);
  const consensusDropped = rankedSignatureCandidates
    .slice(MAX_SIGNATURE_SALIENCE)
    .map((candidate) => ({ slot: candidate.slot, reason: 'exceeds-ranked-top-3-after-consensus' }));
  const candidates = [...normalized.candidates, ...selectedSignatureCandidates];
  const verificationResponse = effectiveVerifyFn
    ? await effectiveVerifyFn({ ...context, candidates })
    : await callVisionJson({
      auth,
      request: verificationRequest({ candidates, tiles: tiles.selected, model: auth.model }),
      fetchFn,
      label: 'vision verification',
  });
  const verified = confirmedCandidates(candidates, verificationResponse);
  const productPhotoVerificationResponse = normalizedProductPhotos.candidates.length === 0
    ? { verifications: [] }
    : (effectiveProductPhotoVerifyFn
      ? await effectiveProductPhotoVerifyFn({ ...context, candidates: normalizedProductPhotos.candidates })
      : await callVisionJson({
        auth,
        request: productPhotoVerificationRequest({ candidates: normalizedProductPhotos.candidates, tiles: tiles.selected, model: auth.model }),
        fetchFn,
        label: 'product-photo verification',
      }));
  const verifiedProductPhotos = confirmedProductPhotoRegions(normalizedProductPhotos.candidates, productPhotoVerificationResponse);
  const written = applyVerifiedValues(skeleton, verified.accepted);
  const verifiedSignatures = verified.accepted.filter((item) => isSignatureSalienceSlot(item.slot));
  const markdown = applyProductPhotoRegions(applySignatureSalience(written.markdown, verifiedSignatures), verifiedProductPhotos.accepted);
  const appliedSlots = new Set(written.applied.map((item) => item.slot));
  const unapplied = verified.accepted
    .filter((item) => !isSignatureSalienceSlot(item.slot) && !appliedSlots.has(item.slot))
    .map((item) => ({ slot: item.slot, reason: 'skeleton-slot-not-found-at-write-time' }));

  return {
    markdown,
    selectedTiles: tiles.selected.map((tile) => tile.id),
    totalTiles: tiles.all.length,
    accepted: written.applied,
    signature: verifiedSignatures[0] || null,
    signatures: verifiedSignatures,
    productPhotos: verifiedProductPhotos.accepted,
    productPhotoStatus: verifiedProductPhotos.accepted.length ? 'resolved' : 'miss',
    dropped: [
      ...normalized.dropped,
      ...normalizedSignatureSamples.flatMap((sample) => sample.dropped),
      ...consensusDropped,
      ...verified.dropped,
      ...normalizedProductPhotos.dropped,
      ...verifiedProductPhotos.dropped,
      ...unapplied,
    ],
  };
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const skeletonPath = path.resolve(args.skeleton);
  let skeleton;
  try {
    skeleton = fs.readFileSync(skeletonPath, 'utf8');
  } catch (error) {
    throw new Error(`cannot read --skeleton ${skeletonPath}: ${error.message}`);
  }
  const defaultOut = path.join(
    path.dirname(skeletonPath),
    `${path.basename(skeletonPath, '.recipe.md')}.vision.recipe.md`,
  );
  const out = path.resolve(args.out || defaultOut);
  if (fs.existsSync(out) && !args.force) throw new Error(OVERWRITE_MESSAGE(out));
  const result = await deriveVisionRecipe({
    captureDir: args.captureDir,
    skeleton,
    visionFixture: args.visionFixture,
  });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, result.markdown, 'utf8');
  console.log(`PASS derive-recipe-vision ${path.resolve(args.captureDir)} -> ${out}`);
  console.log(`VISION tiles: ${result.selectedTiles.join(', ')} (${result.selectedTiles.length}/${result.totalTiles} selected).`);
  if (result.signatures.length) {
    for (const [index, signature] of result.signatures.entries()) {
      console.log(`SIGNATURE-SALIENCE #${index + 1} ${signature.value} [${signature.tile}] — verified: ${signature.verificationEvidence}`);
    }
  } else {
    console.log('SIGNATURE-SALIENCE no dominant signature — no grounded candidate survived verification.');
  }
  if (result.productPhotos.length) {
    for (const photo of result.productPhotos) {
      const crop = photo.crop;
      console.log(`PRODUCT-PHOTO ${photo.id} [${photo.tile}] crop=${crop.x},${crop.y},${crop.width},${crop.height} role=${photo.role} provenance=${photo.provenance} confidence=${photo.confidence} — verified: ${photo.verificationEvidence}`);
    }
  } else {
    console.log(`PRODUCT-PHOTO ${PRODUCT_PHOTO_MISS_MESSAGE}`);
  }
  for (const value of result.accepted) {
    console.log(`FILLED ${value.slot} [${value.tile}] — verified: ${value.verificationEvidence}`);
  }
  for (const value of result.dropped) console.log(`DROPPED ${value.slot} (${value.reason}).`);
  if (!result.accepted.length) {
    console.log('NO VISION SLOTS FILLED — every proposed value was absent, uncited, or rejected by verification.');
    console.error(MISS_MESSAGE);
    // Sibling MISS contract (librarian.js, anti-pattern-check.js): a database
    // miss is a non-zero exit. The recipe artifact above is still written.
    process.exitCode = 1;
  }
  return result;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`FAIL derive-recipe-vision: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  VISION_SLOT,
  VISION_UNAVAILABLE_MESSAGE,
  MISS_MESSAGE,
  EXPLICIT_REGION_MESSAGE,
  OVERWRITE_MESSAGE,
  SIGNATURE_SALIENCE_HEADING,
  SIGNATURE_SALIENCE_SLOT,
  PRODUCT_PHOTO_HEADING,
  PRODUCT_PHOTO_SCHEMA,
  PRODUCT_PHOTO_MISS_MESSAGE,
  PRODUCT_PHOTO_MIN_CONFIDENCE,
  applyProductPhotoRegions,
  confirmedProductPhotoRegions,
  isSignatureSalienceSlot,
  loadVisionFixture,
  applySignatureSalience,
  applyVerifiedValues,
  confirmedCandidates,
  deriveVisionRecipe,
  normalizeProposals,
  normalizeProductPhotoRegions,
  normalizeSignatureSalience,
  rankSignatureSalience,
  parseArgs,
  pendingSlots,
  readCaptureTiles,
  readImageDimensions,
  tileMime,
  resolveVisionAuth,
  visionUnavailableError,
};
