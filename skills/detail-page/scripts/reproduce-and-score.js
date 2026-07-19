#!/usr/bin/env node
'use strict';

// Scores an already-built reproduction against captured reference tiles.
// This deliberately does not know about, read, or send a design recipe: its
// vision request contains only the reference/reproduction image sets and a
// general visual-fidelity rubric.

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// This tracked module owns the established free ChatGPT/Codex auth location.
// Its two exported helpers are intentionally the only things reused here;
// the two-image Responses comparator below is independent of its one-image
// asset-QA scorer.
const { hasChatGPTAuth, codexAuthPath } = require('./lib-openai-responses');

const CODEX_BASE = 'https://chatgpt.com/backend-api/codex';
const APIKEY_BASE = 'https://api.openai.com/v1';
const VISION_UNAVAILABLE_MESSAGE =
  'vision scoring unavailable — set up codex login or OPENAI_API_KEY';
const MISS_MESSAGE = 'MISS — no matching reference/reproduction tile found — this is a database miss, not an empty value; do not invent one.';

function visionUnavailableError(reason) {
  const error = new Error(reason ? `${VISION_UNAVAILABLE_MESSAGE} (${reason})` : VISION_UNAVAILABLE_MESSAGE);
  error.code = 'VISION_SCORING_UNAVAILABLE';
  return error;
}

function parseArgs(argv) {
  const args = { repro: null, reference: null, runs: 3 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--repro' || arg === '--reference' || arg === '--runs') {
      const value = argv[++i];
      if (!value) throw new Error(`${arg} requires a value`);
      if (arg === '--runs') args.runs = Number(value);
      else args[arg.slice(2)] = value;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (!args.repro || !args.reference) {
    throw new Error('usage: node scripts/reproduce-and-score.js --repro <builtDirOrHtml> --reference <captureDir> [--runs N]');
  }
  if (!Number.isInteger(args.runs) || args.runs < 1) throw new Error('--runs must be a positive integer');
  return args;
}

function rounded(value) {
  return Math.round(value * 100) / 100;
}

function numberInRange(value, label) {
  const result = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(result) || result < 0 || result > 100) {
    throw new Error(`vision judge returned invalid ${label}; expected a number from 0 to 100`);
  }
  return result;
}

function parseJudgeJson(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    const match = String(text || '').match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`vision judge returned non-JSON: ${String(text).slice(0, 180)}`);
    try {
      return JSON.parse(match[0]);
    } catch (error) {
      throw new Error(`vision judge returned invalid JSON: ${error.message}`);
    }
  }
}

function normalizeJudgeScore(text) {
  const parsed = parseJudgeJson(text);
  const dimensions = parsed && parsed.dimensions;
  if (!dimensions || typeof dimensions !== 'object') {
    throw new Error('vision judge response is missing dimensions');
  }
  const upgradeList = Array.isArray(parsed.upgradeList)
    ? parsed.upgradeList.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()).slice(0, 10)
    : [];
  return {
    overallFidelity: numberInRange(parsed.overallFidelity, 'overallFidelity'),
    dimensions: {
      token: numberInRange(dimensions.token, 'dimensions.token'),
      structural: numberInRange(dimensions.structural, 'dimensions.structural'),
      signature: numberInRange(dimensions.signature, 'dimensions.signature'),
      craft: numberInRange(dimensions.craft, 'dimensions.craft'),
    },
    upgradeList,
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
        if (event.type === 'response.completed' && !output && event.response && Array.isArray(event.response.output)) {
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
          throw new Error(`vision judge stream error: ${message}`);
        }
      }
    }
    return output;
  })();
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
      model: process.env.ORACLE_VISION_MODEL || process.env.OPENAI_RESPONSES_MODEL || 'gpt-5.4-mini',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${accessToken}`,
        ...(auth?.tokens?.account_id ? { 'chatgpt-account-id': auth.tokens.account_id } : {}),
        'OpenAI-Beta': 'responses=experimental',
        originator: 'codex_cli_rs',
        'User-Agent': 'visigner-reproduction-oracle/1.0',
      },
    };
  }

  if (authMode === 'apikey') {
    if (!hasApiKey) throw visionUnavailableError('OPENAI_API_KEY is unset');
    return {
      authMode,
      base: APIKEY_BASE,
      model: process.env.ORACLE_VISION_MODEL || process.env.OPENAI_RESPONSES_MODEL || 'gpt-5.2',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    };
  }

  throw visionUnavailableError(`unsupported OPENAI_RESPONSES_AUTH=${authMode}`);
}

function imageMime(file) {
  return /\.png$/iu.test(file) ? 'image/png' : 'image/jpeg';
}

function imageInput(file) {
  return {
    type: 'input_image',
    image_url: `data:${imageMime(file)};base64,${fs.readFileSync(file).toString('base64')}`,
  };
}

function buildComparisonRequest({ referenceTiles, reproductionTiles, model }) {
  if (!Array.isArray(referenceTiles) || !referenceTiles.length || referenceTiles.length !== reproductionTiles.length) {
    throw new Error('comparison requires an equal, non-empty number of reference and reproduction tiles');
  }
  const content = [
    {
      type: 'input_text',
      text: 'The following images are the REFERENCE set, in top-to-bottom tile order.',
    },
    ...referenceTiles.map(imageInput),
    {
      type: 'input_text',
      text: 'The following images are the REPRODUCTION set, in the same top-to-bottom tile order.',
    },
    ...reproductionTiles.map(imageInput),
    {
      type: 'input_text',
      text: 'Compare the reproduction set against the reference set using only what is visible in these images. ' +
        'Return ONLY one JSON object with exactly this shape: ' +
        '{"overallFidelity":0-100,"dimensions":{"token":0-100,"structural":0-100,"signature":0-100,"craft":0-100},"upgradeList":["most important concrete visual fix", "..."]}. ' +
        'Score token for color, typography, spacing, radii, and other repeated visual-system values; ' +
        'structural for hierarchy, layout, proportions, and information grouping; ' +
        'signature for distinctive composition, imagery, and recognizable visual motifs; ' +
        'craft for alignment, legibility, polish, and pixel-level finish. ' +
        'Calibrate the overall scale consistently: 0 = unrelated; 25 = only a loose theme match; ' +
        '50 = shared subject and palette but major hierarchy or component mismatch; ' +
        '70 = same brand, page hierarchy, and primary components with material layout, asset, or typography differences; ' +
        '85 = close reproduction with only limited polish or detail gaps; 100 = no visually discernible difference. ' +
        'Be strict, use every score from 0 to 100, and list up to five specific highest-leverage visual upgrades.',
    },
  ];
  return {
    model,
    input: [
      {
        role: 'developer',
        content: 'You are an independent visual-fidelity judge. Evaluate the second image set only by how faithfully it reproduces the first image set. Reply with JSON only.',
      },
      { role: 'user', content },
    ],
    stream: true,
    store: false,
  };
}

async function compareTileSets({ referenceTiles, reproductionTiles, fetchFn = fetch, authResolver = resolveVisionAuth }) {
  const auth = authResolver();
  const body = buildComparisonRequest({ referenceTiles, reproductionTiles, model: auth.model });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const res = await fetchFn(`${auth.base}/responses`, {
      method: 'POST',
      headers: auth.headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`vision judge ${res.status} (${auth.authMode}/${auth.model}): ${detail.slice(0, 240)}`);
    }
    return normalizeJudgeScore(await readTextResponsesStream(res));
  } finally {
    clearTimeout(timer);
  }
}

function aggregateRuns(runs) {
  if (!Array.isArray(runs) || runs.length === 0) throw new Error('cannot aggregate zero scoring runs');
  const scores = runs.map((run, index) => numberInRange(run.overallFidelity, `runs[${index}].overallFidelity`));
  const mean = scores.reduce((total, score) => total + score, 0) / scores.length;
  const variance = scores.reduce((total, score) => total + ((score - mean) ** 2), 0) / scores.length;
  const averageDimension = (key) => rounded(runs.reduce((total, run, index) => (
    total + numberInRange(run.dimensions?.[key], `runs[${index}].dimensions.${key}`)
  ), 0) / runs.length);

  const upgrades = new Map();
  let order = 0;
  for (const run of runs) {
    for (const item of run.upgradeList || []) {
      if (typeof item !== 'string' || !item.trim()) continue;
      const label = item.trim();
      const key = label.toLocaleLowerCase();
      const previous = upgrades.get(key) || { label, count: 0, order: order++ };
      previous.count += 1;
      upgrades.set(key, previous);
    }
  }
  const upgradeList = [...upgrades.values()]
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .slice(0, 10)
    .map((entry) => entry.label);

  return {
    meanFidelity: rounded(mean),
    sd: rounded(Math.sqrt(variance)),
    dimensions: {
      token: averageDimension('token'),
      structural: averageDimension('structural'),
      signature: averageDimension('signature'),
      craft: averageDimension('craft'),
    },
    upgradeList,
    runs: runs.map((run) => ({
      overallFidelity: rounded(run.overallFidelity),
      dimensions: {
        token: rounded(run.dimensions.token),
        structural: rounded(run.dimensions.structural),
        signature: rounded(run.dimensions.signature),
        craft: rounded(run.dimensions.craft),
      },
      upgradeList: [...run.upgradeList],
    })),
  };
}

async function scoreRepeated({
  referenceTiles,
  reproductionTiles,
  runs = 3,
  scoreFn = compareTileSets,
  authAvailable = hasChatGPTAuth,
  apiKeyAvailable = () => Boolean(process.env.OPENAI_API_KEY),
}) {
  // Check before any image is read or request is built. This makes the no-auth
  // path loud and lets offline tests prove it cannot manufacture a score.
  if (!authAvailable() && !apiKeyAvailable()) throw visionUnavailableError();
  const results = [];
  for (let run = 0; run < runs; run += 1) {
    results.push(await scoreFn({ referenceTiles, reproductionTiles }));
  }
  return aggregateRuns(results);
}

function matchingTiles(dir, pattern, label) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    throw new Error(`cannot read ${label} directory ${dir}: ${error.message}`);
  }
  const found = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(pattern);
    if (match) found.push({ number: Number(match[1]), file: path.join(dir, entry.name) });
  }
  return found.sort((a, b) => a.number - b.number);
}

function resolveTilePairs(reproDir, referenceDir) {
  // The captured Wadiz corpus is intentionally stored as 720×900 JPEG tiles,
  // while newer app-ui captures are PNG.  Both are first-party capture tiles
  // and must reach the same image comparator without a lossy conversion.
  const reference = matchingTiles(referenceDir, /^tile_(\d+)\.(?:png|jpe?g)$/i, 'reference');
  const reproduction = matchingTiles(reproDir, /^desktop-tile_(\d+)\.png$/i, 'reproduction');
  if (!reference.length) throw new Error(`${MISS_MESSAGE} no reference tile_XX.png/.jpg files found in ${referenceDir}`);
  if (!reproduction.length) throw new Error(`${MISS_MESSAGE} no reproduction desktop-tile_XX.png files found in ${reproDir}`);
  const referenceByNumber = new Map(reference.map((tile) => [tile.number, tile.file]));
  const shared = reproduction
    .filter((tile) => referenceByNumber.has(tile.number))
    .map((tile) => ({ number: tile.number, reference: referenceByNumber.get(tile.number), reproduction: tile.file }));
  if (!shared.length) throw new Error(`${MISS_MESSAGE} reference and reproduction have no matching tile numbers`);
  // Three 1280×1600 tiles cover the above-the-fold/hero area while keeping one
  // multi-image judge call within a practical request size. Override only when
  // a different capture convention deliberately defines more hero tiles.
  const maxTiles = Number(process.env.ORACLE_MAX_TILES || 3);
  if (!Number.isInteger(maxTiles) || maxTiles < 1) throw new Error('ORACLE_MAX_TILES must be a positive integer');
  return shared.slice(0, maxTiles);
}

function isHtmlFile(file) {
  return /\.html?$/i.test(file);
}

function shootReproduction(htmlFile) {
  const shotDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-oracle-shots-'));
  const shootScript = path.join(__dirname, 'shoot.js');
  const result = childProcess.spawnSync(process.execPath, [shootScript, htmlFile, shotDir], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 180000,
  });
  if (result.error) throw new Error(`failed to shoot reproduction: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`shoot.js failed (${result.status}): ${(result.stderr || result.stdout || '').trim().slice(-600)}`);
  }
  return shotDir;
}

function resolveReproductionTiles(reproInput) {
  const absolute = path.resolve(reproInput);
  let stat;
  try {
    stat = fs.statSync(absolute);
  } catch (error) {
    throw new Error(`cannot read --repro ${absolute}: ${error.message}`);
  }
  if (stat.isFile()) {
    if (!isHtmlFile(absolute)) throw new Error('--repro file must be an .html or .htm file');
    return { tileDir: shootReproduction(absolute), shot: true };
  }
  if (!stat.isDirectory()) throw new Error('--repro must be an HTML file or a tile directory');
  const tiles = matchingTiles(absolute, /^desktop-tile_(\d+)\.png$/i, 'reproduction');
  if (tiles.length) return { tileDir: absolute, shot: false };
  for (const filename of ['index.html', 'index.htm']) {
    const index = path.join(absolute, filename);
    if (fs.existsSync(index)) return { tileDir: shootReproduction(index), shot: true };
  }
  throw new Error(`--repro directory has neither desktop-tile_XX.png files nor index.html: ${absolute}`);
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const repro = resolveReproductionTiles(args.repro);
  const referenceDir = path.resolve(args.reference);
  const pairs = resolveTilePairs(repro.tileDir, referenceDir);
  const summary = await scoreRepeated({
    referenceTiles: pairs.map((pair) => pair.reference),
    reproductionTiles: pairs.map((pair) => pair.reproduction),
    runs: args.runs,
  });
  return {
    ...summary,
    comparedTiles: pairs.map((pair) => pair.number),
    reproductionShot: repro.shot,
  };
}

if (require.main === module) {
  main().then(
    (result) => console.log(JSON.stringify(result, null, 2)),
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    },
  );
}

module.exports = {
  MISS_MESSAGE,
  VISION_UNAVAILABLE_MESSAGE,
  aggregateRuns,
  buildComparisonRequest,
  compareTileSets,
  imageMime,
  main,
  normalizeJudgeScore,
  parseArgs,
  resolveTilePairs,
  scoreRepeated,
  visionUnavailableError,
};
