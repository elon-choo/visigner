#!/usr/bin/env node
'use strict';

/*
 * G2.5 fixed-holdout reference classifier.
 *
 * This runner intentionally has no browser, proxy, user-agent, or retry
 * alternative.  It invokes the established capture-styles collector as-is,
 * then compares only its emitted style inventories with the merged 42-record
 * librarian-overlay corpus.  Scores are deterministic arithmetic over the
 * captured inventories; the JSON result preserves the inputs and every axis
 * score so a reviewer can recalculate them.
 */

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CAPTURE_SCRIPT = path.join(ROOT, 'skills', 'detail-page', 'scripts', 'capture-styles.js');
const CORE_INDEX_PATH = path.join(ROOT, 'skills', 'detail-page', 'references', 'corpus', 'corpus-index.json');
const OVERLAY_INDEX_PATH = path.join(ROOT, 'v3', 'corpus-overlay', 'overlay-index.json');
const CORPUS_CAPTURE_BASE = path.join(ROOT, 'skills', 'detail-page', 'references');
const SEGMENTS_DIR = path.join(ROOT, 'v3', 'segments');
const CAPTURE_ROOT = path.join(ROOT, 'references', 'captures', 'v3-holdout');
const EVIDENCE_DIR = path.join(ROOT, 'docs', 'goals', 'evidence', 'v3', 'G2.5');
const LOG_PATH = path.join(EVIDENCE_DIR, 'reference-classifier.log');
const RESULT_PATH = path.join(EVIDENCE_DIR, 'classifications.json');
const MARKDOWN_PATH = path.join(EVIDENCE_DIR, 'classifications.md');
const TARGET_TIMEOUT_MS = 240_000;
const DEFAULT_PACE_MS = 10_000;

// This list is intentionally closed.  --url and --only can select only a
// member of it, so an execution cannot silently substitute a target.
const HOLDOUTS = Object.freeze([
  { id: 'slack', url: 'https://slack.com/' },
  { id: 'notion', url: 'https://www.notion.so/' },
  { id: 'ableton', url: 'https://www.ableton.com/en/' },
  { id: 'headspace', url: 'https://www.headspace.com/' },
  { id: 'allbirds', url: 'https://www.allbirds.com/' },
]);

const AXIS_NAMES = Object.freeze(['type_scale', 'palette_structure', 'spacing_rhythm', 'rounding', 'motion_density']);

function usage() {
  return [
    'Usage: node v3/scripts/reference-classifier.js [--only <holdout-id> | --url <fixed-holdout-url>] [--pace <seconds>] [--dry-run]',
    'The fixed holdouts are: ' + HOLDOUTS.map((target) => target.id).join(', ') + '.',
    'The pace must be at least 10 seconds; default: 10 seconds.',
  ].join('\n');
}

function parseArgs(argv) {
  const options = { only: null, url: null, paceMs: DEFAULT_PACE_MS, dryRun: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--only') {
      const value = argv[index + 1];
      if (!value || value.startsWith('-')) throw new Error('--only requires a fixed holdout id');
      if (options.only || options.url) throw new Error('supply only one of --only or --url');
      options.only = value;
      index += 1;
    } else if (argument === '--url') {
      const value = argv[index + 1];
      if (!value || value.startsWith('-')) throw new Error('--url requires one fixed holdout URL');
      if (options.only || options.url) throw new Error('supply only one of --only or --url');
      options.url = value;
      index += 1;
    } else if (argument === '--pace') {
      const seconds = Number(argv[index + 1]);
      if (!Number.isFinite(seconds) || seconds < 10) throw new Error('--pace must be at least 10 seconds');
      options.paceMs = Math.round(seconds * 1000);
      index += 1;
    } else if (argument === '--dry-run') {
      options.dryRun = true;
    } else if (argument === '--help' || argument === '-h') {
      options.help = true;
    } else {
      throw new Error('unknown argument: ' + argument);
    }
  }
  return options;
}

function readJson(filePath, label) {
  let source;
  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`${label || filePath} cannot be read: ${error.message}`);
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`${label || filePath} is not JSON: ${error.message}`);
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function shellEscape(value) {
  if (/^[A-Za-z0-9_./:=+-]+$/u.test(value)) return value;
  return "'" + String(value).replace(/'/gu, "'\\\"'\\\"'") + "'";
}

function printableCommand(command) {
  return [command.command, ...command.args].map(shellEscape).join(' ');
}

function runChild(command) {
  return new Promise((resolve) => {
    let child;
    try {
      child = childProcess.spawn(command.command, command.args, {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolve({ code: null, signal: null, timedOut: false, error: error.message, stdout: '', stderr: '' });
      return;
    }
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const append = (current, chunk) => (current + chunk.toString()).slice(-64_000);
    child.stdout.on('data', (chunk) => { stdout = append(stdout, chunk); });
    child.stderr.on('data', (chunk) => { stderr = append(stderr, chunk); });
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5_000).unref();
    }, TARGET_TIMEOUT_MS);
    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ code: null, signal: null, timedOut, error: error.message, stdout, stderr });
    });
    child.once('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ code, signal, timedOut, error: null, stdout, stderr });
    });
  });
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/gu, ' ').trim();
}

function captureArtifact(outDir) {
  const stylesPath = path.join(outDir, 'styles.json');
  if (!fs.existsSync(stylesPath)) return { stylesPath, exists: false, styles: null, parseError: null };
  try {
    return { stylesPath, exists: true, styles: readJson(stylesPath, 'styles.json'), parseError: null };
  } catch (error) {
    return { stylesPath, exists: true, styles: null, parseError: error.message };
  }
}

function captureFailureReason(result, artifact) {
  if (result.timedOut) return 'timeout-240s';
  if (result.error) return 'spawn-error:' + normalizeWhitespace(result.error);
  if (artifact.parseError) return 'styles-json-unreadable';
  const status = artifact.styles && artifact.styles.meta && artifact.styles.meta.status;
  const transcript = (result.stdout + '\n' + result.stderr + '\n' + JSON.stringify(artifact.styles && artifact.styles.gaps || [])).toLowerCase();
  if (status === 403 || /\b403\b|forbidden|access denied/iu.test(transcript)) return 'blocked-403';
  if (status === 429 || /\b429\b|rate limit|too many requests/iu.test(transcript)) return 'blocked-429';
  if (/bot[ -]?wall|captcha|verify you are human/iu.test(transcript)) return 'bot-wall';
  if (!artifact.exists) return result.code === 0 ? 'capture-output-missing' : 'capture-exit-' + String(result.code);
  if (result.signal) return 'capture-signal-' + result.signal;
  if (result.code !== 0) return 'capture-exit-' + String(result.code);
  if (!Number.isInteger(status) || status < 200 || status >= 400) return 'http-status-' + String(status);
  return null;
}

function isRegionRefusalSuccess(result, artifact) {
  if (result.code !== 1 || !artifact.styles || artifact.parseError) return false;
  const status = artifact.styles.meta && artifact.styles.meta.status;
  if (!Number.isInteger(status) || status < 200 || status >= 300) return false;
  const transcript = (result.stdout + '\n' + result.stderr + '\n' + JSON.stringify(artifact.styles.gaps || []) + '\n' + JSON.stringify(artifact.styles.authoredRegion || {})).toLowerCase();
  return /authored region is unresolved|region.*unresolved|region-refused/iu.test(transcript);
}

async function captureTarget(target, log) {
  const outDir = path.join(CAPTURE_ROOT, target.id);
  const existing = captureArtifact(outDir);
  if (existing.exists && existing.styles && Number.isInteger(existing.styles.meta && existing.styles.meta.status)
    && existing.styles.meta.status >= 200 && existing.styles.meta.status < 300) {
    return {
      id: target.id,
      url: target.url,
      status: 'captured-existing',
      exit_code: null,
      reason: 'existing-styles-json-2xx',
      out_dir: path.relative(ROOT, outDir),
      styles_path: path.relative(ROOT, existing.stylesPath),
      collector_stdout: null,
      collector_stderr: null,
      styles: existing.styles,
    };
  }

  fs.mkdirSync(outDir, { recursive: true });
  const command = {
    command: process.execPath,
    args: [CAPTURE_SCRIPT, target.url, outDir, '--force'],
  };
  log.push(`[capture:start] ${target.id} ${printableCommand(command)}`);
  const result = await runChild(command);
  const artifact = captureArtifact(outDir);
  const regionRefusal = isRegionRefusalSuccess(result, artifact);
  const failure = regionRefusal ? null : captureFailureReason(result, artifact);
  const status = failure ? 'capture-failed' : regionRefusal ? 'captured-region-refusal' : 'captured';
  const reason = failure || (regionRefusal ? 'exit-1-with-styles-json-2xx-region-refusal' : null);
  log.push(`[capture:finish] ${target.id} status=${status} exit=${String(result.code)} signal=${String(result.signal)} reason=${reason || 'none'} styles=${path.relative(ROOT, artifact.stylesPath)}`);
  return {
    id: target.id,
    url: target.url,
    status,
    exit_code: result.code,
    signal: result.signal,
    timed_out: result.timedOut,
    reason,
    out_dir: path.relative(ROOT, outDir),
    styles_path: path.relative(ROOT, artifact.stylesPath),
    collector_stdout: normalizeWhitespace(result.stdout).slice(-8_000) || null,
    collector_stderr: normalizeWhitespace(result.stderr).slice(-8_000) || null,
    styles: failure ? null : artifact.styles,
  };
}

function numberFromPx(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const match = String(value || '').trim().match(/^(-?(?:\d+\.?\d*|\.\d+))px$/iu);
  return match ? Number(match[1]) : null;
}

function cleanFamily(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function roundedKey(value) {
  return String(Math.round(value * 4) / 4);
}

function numberHistogram(entries) {
  const bins = {};
  if (!Array.isArray(entries)) return bins;
  for (const entry of entries) {
    const number = numberFromPx(entry && entry.value);
    const count = Number(entry && entry.count);
    // Ignore the universal reset and browser "fully rounded" sentinel.  The
    // remaining bounded px values are the observed rhythm/radius inventory.
    if (!Number.isFinite(number) || !Number.isFinite(count) || count <= 0 || Math.abs(number) < 0.5 || Math.abs(number) > 256) continue;
    const key = roundedKey(Math.abs(number));
    bins[key] = (bins[key] || 0) + count;
  }
  return bins;
}

function histogramEntries(histogram, limit) {
  return Object.entries(histogram)
    .map(([value, count]) => ({ value: Number(value), count }))
    .sort((left, right) => right.count - left.count || left.value - right.value)
    .slice(0, limit);
}

function parseHexColor(value) {
  const text = String(value || '').trim();
  const match = text.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/iu);
  if (!match) return null;
  let digits = match[1];
  if (digits.length === 3 || digits.length === 4) digits = [...digits].map((char) => char + char).join('');
  const red = Number.parseInt(digits.slice(0, 2), 16);
  const green = Number.parseInt(digits.slice(2, 4), 16);
  const blue = Number.parseInt(digits.slice(4, 6), 16);
  const alpha = digits.length === 8 ? Number.parseInt(digits.slice(6, 8), 16) / 255 : 1;
  if (![red, green, blue, alpha].every(Number.isFinite)) return null;
  return { red, green, blue, alpha };
}

function hueLightnessBin(color) {
  const red = color.red / 255;
  const green = color.green / 255;
  const blue = color.blue / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  const lightBin = lightness < 1 / 3 ? 'dark' : lightness < 2 / 3 ? 'mid' : 'light';
  if (delta < 0.05) return `neutral:${lightBin}`;
  let hue;
  if (maximum === red) hue = ((green - blue) / delta) % 6;
  else if (maximum === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  return `h${Math.floor(hue / 45)}:${lightBin}`;
}

function colorHistogram(color) {
  const bins = {};
  const add = (entries, roleWeight) => {
    if (!Array.isArray(entries)) return;
    for (const entry of entries) {
      const parsed = parseHexColor(entry && entry.value);
      const share = Number(entry && entry.areaShare);
      if (!parsed || !Number.isFinite(share) || share <= 0) continue;
      const key = hueLightnessBin(parsed);
      bins[key] = (bins[key] || 0) + share * parsed.alpha * roleWeight;
    }
  };
  // Background and text inventories occupy distinct palette roles, while the
  // weighting keeps a text-heavy DOM from erasing the page field structure.
  add(color && color.backgrounds, 0.7);
  add(color && color.text, 0.3);
  return bins;
}

function colorEntries(entries, limit) {
  if (!Array.isArray(entries)) return [];
  return entries.slice(0, limit).map((entry) => ({ value: entry.value, area_share: Number(entry.areaShare) }));
}

function sumCounts(entries, isActive) {
  if (!Array.isArray(entries)) return null;
  return entries.reduce((sum, entry) => {
    const count = Number(entry && entry.count);
    if (!Number.isFinite(count) || count < 0) return sum;
    return sum + (isActive(entry && entry.value) ? count : 0);
  }, 0);
}

function motionInventory(motion) {
  const transitions = motion && motion.transitions;
  const animations = motion && motion.animations;
  const transitionTotal = sumCounts(transitions, () => true);
  const animationTotal = sumCounts(animations, () => true);
  if (transitionTotal === null || animationTotal === null || transitionTotal <= 0 || animationTotal <= 0) return null;
  const active = (value) => !/^(?:none|normal|all 0s ease 0s)$/iu.test(String(value || '').trim());
  const transitionActive = sumCounts(transitions, active);
  const animationActive = sumCounts(animations, active);
  return {
    transition_density: transitionActive / transitionTotal,
    animation_density: animationActive / animationTotal,
    transition_active_count: transitionActive,
    transition_total_count: transitionTotal,
    animation_active_count: animationActive,
    animation_total_count: animationTotal,
    prefers_reduced_motion: typeof motion.prefersReducedMotion === 'boolean' ? motion.prefersReducedMotion : null,
  };
}

function typeInventory(type) {
  const display = type && type.display;
  const body = type && type.body;
  if (!display || !body) return null;
  const values = {
    display_font_size_px: numberFromPx(display.fontSize),
    display_line_height_px: numberFromPx(display.lineHeight),
    body_font_size_px: numberFromPx(body.fontSize),
    body_line_height_px: numberFromPx(body.lineHeight),
  };
  const numericCount = Object.values(values).filter((value) => Number.isFinite(value) && value > 0).length;
  if (numericCount < 2) return null;
  return {
    display_family: cleanFamily(display.resolvedFamily),
    body_family: cleanFamily(body.resolvedFamily),
    ...values,
  };
}

function inventoryFromStyles(styles) {
  if (!styles || !styles.meta || !Number.isInteger(styles.meta.status) || styles.meta.status < 200 || styles.meta.status >= 300) return null;
  const spacingHistogram = numberHistogram(styles.spacing);
  const radiusHistogram = numberHistogram(styles.radius);
  return {
    source_status: styles.meta.status,
    authored_region: styles.authoredRegion && styles.authoredRegion.verdict || null,
    type: typeInventory(styles.type),
    palette: {
      bins: colorHistogram(styles.color),
      backgrounds: colorEntries(styles.color && styles.color.backgrounds, 5),
      text: colorEntries(styles.color && styles.color.text, 5),
    },
    spacing: {
      histogram: spacingHistogram,
      top_values_px: histogramEntries(spacingHistogram, 8),
    },
    radius: {
      histogram: radiusHistogram,
      top_values_px: histogramEntries(radiusHistogram, 8),
    },
    motion: motionInventory(styles.motion),
  };
}

function normalizedHistogram(histogram) {
  const total = Object.values(histogram || {}).reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  return Object.fromEntries(Object.entries(histogram).map(([key, value]) => [key, value / total]));
}

function weightedJaccard(left, right) {
  const normalizedLeft = normalizedHistogram(left);
  const normalizedRight = normalizedHistogram(right);
  if (!normalizedLeft || !normalizedRight) return null;
  const keys = new Set([...Object.keys(normalizedLeft), ...Object.keys(normalizedRight)]);
  let intersection = 0;
  let union = 0;
  for (const key of keys) {
    const a = normalizedLeft[key] || 0;
    const b = normalizedRight[key] || 0;
    intersection += Math.min(a, b);
    union += Math.max(a, b);
  }
  return union > 0 ? intersection / union : null;
}

function cosineSimilarity(left, right) {
  const normalizedLeft = normalizedHistogram(left);
  const normalizedRight = normalizedHistogram(right);
  if (!normalizedLeft || !normalizedRight) return null;
  const keys = new Set([...Object.keys(normalizedLeft), ...Object.keys(normalizedRight)]);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (const key of keys) {
    const a = normalizedLeft[key] || 0;
    const b = normalizedRight[key] || 0;
    dot += a * b;
    leftMagnitude += a * a;
    rightMagnitude += b * b;
  }
  return leftMagnitude > 0 && rightMagnitude > 0 ? dot / Math.sqrt(leftMagnitude * rightMagnitude) : null;
}

function typeScaleSimilarity(left, right) {
  if (!left || !right) return null;
  const fields = ['display_font_size_px', 'display_line_height_px', 'body_font_size_px', 'body_line_height_px'];
  const similarities = [];
  for (const field of fields) {
    const a = left[field];
    const b = right[field];
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) continue;
    // A one-octave difference scores zero; smaller proportional differences
    // decrease linearly in log2 space.
    similarities.push(Math.max(0, 1 - Math.min(1, Math.abs(Math.log2(a / b)))));
  }
  if (similarities.length < 2) return null;
  return similarities.reduce((sum, value) => sum + value, 0) / similarities.length;
}

function closeDensity(left, right) {
  if (!left || !right) return null;
  const transition = 1 - Math.min(1, Math.abs(left.transition_density - right.transition_density));
  const animation = 1 - Math.min(1, Math.abs(left.animation_density - right.animation_density));
  const reduced = left.prefers_reduced_motion === null || right.prefers_reduced_motion === null
    ? null
    : left.prefers_reduced_motion === right.prefers_reduced_motion ? 1 : 0;
  const parts = [transition, animation];
  if (reduced !== null) parts.push(reduced);
  return parts.reduce((sum, value) => sum + value, 0) / parts.length;
}

function roundScore(score) {
  return score === null ? null : Number(score.toFixed(6));
}

function compareInventories(target, candidate) {
  const axes = {
    type_scale: typeScaleSimilarity(target.type, candidate.type),
    palette_structure: cosineSimilarity(target.palette.bins, candidate.palette.bins),
    spacing_rhythm: weightedJaccard(target.spacing.histogram, candidate.spacing.histogram),
    rounding: weightedJaccard(target.radius.histogram, candidate.radius.histogram),
    motion_density: closeDensity(target.motion, candidate.motion),
  };
  const available = Object.entries(axes).filter(([, score]) => score !== null);
  if (!available.length) return null;
  const total = available.reduce((sum, [, score]) => sum + score, 0) / available.length;
  const highest = Math.max(...available.map(([, score]) => score));
  return {
    overall_score: roundScore(total),
    available_axis_count: available.length,
    axis_scores: Object.fromEntries(Object.entries(axes).map(([axis, score]) => [axis, roundScore(score)])),
    decisive_axis_by_score: available
      .filter(([, score]) => Math.abs(score - highest) < 1e-12)
      .map(([axis]) => axis),
    decisive_axis_rule: 'axis score equal to the maximum individual available-axis score; axes are equally weighted in the aggregate',
  };
}

function loadSegments() {
  const byRecord = new Map();
  if (!fs.existsSync(SEGMENTS_DIR)) return byRecord;
  for (const filename of fs.readdirSync(SEGMENTS_DIR).filter((entry) => entry.endsWith('.json')).sort()) {
    const document = readJson(path.join(SEGMENTS_DIR, filename), filename);
    if (document && typeof document.record_id === 'string' && Array.isArray(document.spans)) byRecord.set(document.record_id, document.spans);
  }
  return byRecord;
}

function sectionComposition(spans) {
  if (!Array.isArray(spans) || !spans.length) return null;
  const groups = [];
  for (const span of spans) {
    const type = typeof span.type === 'string' ? span.type : 'unknown';
    const previous = groups[groups.length - 1];
    if (previous && previous.type === type) previous.count += 1;
    else groups.push({ type, count: 1 });
  }
  return {
    source: 'v3/segments',
    span_count: spans.length,
    sequence: groups.map((group) => `${group.type}${group.count > 1 ? ' ×' + group.count : ''}`).join(' → '),
    spans: spans.map((span) => ({
      order: span.order,
      type: span.type,
      y_start: span.y_start,
      y_end: span.y_end,
      heading_text: span.heading_text || null,
      confidence: span.confidence || null,
    })),
  };
}

function loadCorpus(log) {
  const core = readJson(CORE_INDEX_PATH, 'corpus-index.json');
  const overlay = readJson(OVERLAY_INDEX_PATH, 'overlay-index.json');
  if (!Array.isArray(core.records) || !Array.isArray(overlay.records)) throw new Error('merged librarian-overlay indexes must each contain records');
  const records = [];
  const ids = new Set();
  for (const [source, index] of [['core', core], ['overlay', overlay]]) {
    for (const record of index.records) {
      if (!record || typeof record.id !== 'string' || !record.id || ids.has(record.id)) throw new Error('merged corpus contains a missing or duplicate record id');
      ids.add(record.id);
      const stylesPath = path.resolve(CORPUS_CAPTURE_BASE, record.capture_dir, 'styles.json');
      let styles = null;
      let inventory = null;
      let unavailableReason = null;
      if (!fs.existsSync(stylesPath)) {
        unavailableReason = 'styles-json-missing';
      } else {
        try {
          styles = readJson(stylesPath, `styles for ${record.id}`);
          inventory = inventoryFromStyles(styles);
          if (!inventory) unavailableReason = 'styles-json-no-2xx-inventory';
        } catch (error) {
          unavailableReason = 'styles-json-unreadable';
        }
      }
      records.push({
        id: record.id,
        title: record.title || null,
        url: record.url || null,
        source,
        styles_path: path.relative(ROOT, stylesPath),
        inventory,
        unavailable_reason: unavailableReason,
      });
    }
  }
  records.sort((left, right) => left.id.localeCompare(right.id));
  if (records.length !== 42) throw new Error(`expected merged librarian-overlay corpus of 42 records; received ${records.length}`);
  const usable = records.filter((record) => record.inventory);
  log.push(`[corpus] merged=42 core=${core.records.length} overlay=${overlay.records.length} style-inventories=${usable.length} unavailable=${records.length - usable.length}`);
  return { records, usable, unavailable: records.filter((record) => !record.inventory) };
}

function number(value, digits) {
  return Number.isFinite(value) ? Number(value.toFixed(digits === undefined ? 3 : digits)) : null;
}

function typeEvidence(inventory) {
  if (!inventory || !inventory.type) return 'unavailable';
  const type = inventory.type;
  return [
    `display=${type.display_family || 'unknown'} ${number(type.display_font_size_px)}px/${number(type.display_line_height_px)}px`,
    `body=${type.body_family || 'unknown'} ${number(type.body_font_size_px)}px/${number(type.body_line_height_px)}px`,
  ].join('; ');
}

function paletteEvidence(inventory) {
  if (!inventory) return 'unavailable';
  const backgrounds = inventory.palette.backgrounds.map((entry) => `${entry.value}:${number(entry.area_share)}`).join(', ') || 'none';
  const text = inventory.palette.text.map((entry) => `${entry.value}:${number(entry.area_share)}`).join(', ') || 'none';
  return `backgrounds=[${backgrounds}]; text=[${text}]`;
}

function histogramEvidence(entries) {
  return entries.length ? entries.map((entry) => `${entry.value}px×${entry.count}`).join(', ') : 'unavailable';
}

function motionEvidence(inventory) {
  const motion = inventory && inventory.motion;
  if (!motion) return 'unavailable';
  return `transition=${number(motion.transition_density)} (${motion.transition_active_count}/${motion.transition_total_count}); animation=${number(motion.animation_density)} (${motion.animation_active_count}/${motion.animation_total_count}); reduced-motion=${String(motion.prefers_reduced_motion)}`;
}

function axisEvidence(target, candidate) {
  return {
    type_scale: { target: typeEvidence(target), candidate: typeEvidence(candidate) },
    palette_structure: { target: paletteEvidence(target), candidate: paletteEvidence(candidate) },
    spacing_rhythm: { target: histogramEvidence(target.spacing.top_values_px), candidate: histogramEvidence(candidate.spacing.top_values_px) },
    rounding: { target: histogramEvidence(target.radius.top_values_px), candidate: histogramEvidence(candidate.radius.top_values_px) },
    motion_density: { target: motionEvidence(target), candidate: motionEvidence(candidate) },
  };
}

function rankTarget(targetInventory, corpus, segments) {
  const rows = [];
  for (const record of corpus.usable) {
    const comparison = compareInventories(targetInventory, record.inventory);
    if (!comparison) continue;
    rows.push({
      id: record.id,
      title: record.title,
      url: record.url,
      corpus_source: record.source,
      styles_path: record.styles_path,
      ...comparison,
      evidence: axisEvidence(targetInventory, record.inventory),
      section_span_composition: sectionComposition(segments.get(record.id)),
    });
  }
  rows.sort((left, right) => right.overall_score - left.overall_score || left.id.localeCompare(right.id));
  return rows;
}

function markdownEscape(value) {
  return String(value === null || value === undefined ? '—' : value).replace(/\|/gu, '\\|').replace(/[\r\n]+/gu, ' ');
}

function markdownScore(value) {
  return value === null || value === undefined ? '—' : Number(value).toFixed(6);
}

function markdownEvidence(targetResult, corpus) {
  const completed = targetResult.filter((result) => result.capture.status !== 'capture-failed');
  const lines = [
    '# G2.5 Reference Classifier Evidence',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Fixed holdouts attempted: ${targetResult.length}/5. Capture outputs used for scoring: ${completed.length}/5.`,
    `Merged librarian-overlay corpus: ${corpus.records.length} records (core ${corpus.records.filter((record) => record.source === 'core').length} + overlay ${corpus.records.filter((record) => record.source === 'overlay').length}); style inventories available: ${corpus.usable.length}; unavailable: ${corpus.unavailable.length}.`,
    '',
    '## Score arithmetic',
    '',
    '- `type_scale`: mean of the shared display/body font-size and numeric line-height similarities, where each value is `max(0, 1 - min(1, |log2(target / record)|))`.',
    '- `palette_structure`: cosine similarity of area-share-normalized hue/lightness bins from computed backgrounds (weight 0.7) and text (weight 0.3).',
    '- `spacing_rhythm` and `rounding`: weighted Jaccard similarity over normalized observed px-count inventories; `0px` and values above `256px` are omitted from these two axes.',
    '- `motion_density`: mean of transition-density similarity, animation-density similarity, and reduced-motion equality when both collectors state it. Density is active count / observed count.',
    '- `overall_score`: arithmetic mean of the available axis scores (equal weights; no unavailable axis is imputed). `decisive_axis_by_score` below means the maximum individual available-axis score under this stated rule.',
    '',
    'No self-assessment is included; the fields below are captured inputs and calculated comparisons.',
    '',
  ];
  for (const result of targetResult) {
    lines.push(`## ${result.id} — ${result.url}`, '');
    lines.push(`Capture: \`${result.capture.status}\`; exit: \`${String(result.capture.exit_code)}\`; reason: ${markdownEscape(result.capture.reason || '—')}; artifact: \`${result.capture.styles_path}\`.`, '');
    if (result.capture.status === 'capture-failed') {
      lines.push(`Excluded from scoring only for this fixed holdout: ${markdownEscape(result.capture.reason)}.`, '');
      continue;
    }
    lines.push('Target inventory:', '');
    lines.push(`- Type: ${typeEvidence(result.inventory)}`);
    lines.push(`- Palette: ${paletteEvidence(result.inventory)}`);
    lines.push(`- Spacing: ${histogramEvidence(result.inventory.spacing.top_values_px)}`);
    lines.push(`- Rounding: ${histogramEvidence(result.inventory.radius.top_values_px)}`);
    lines.push(`- Motion: ${motionEvidence(result.inventory)}`, '');
    lines.push('| Rank | Corpus record | Overall | Type | Palette | Spacing | Rounding | Motion | Highest individual axis |', '| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
    for (const [index, candidate] of result.top3.entries()) {
      const axis = candidate.decisive_axis_by_score.join(', ');
      lines.push(`| ${index + 1} | ${markdownEscape(candidate.id)} | ${markdownScore(candidate.overall_score)} | ${markdownScore(candidate.axis_scores.type_scale)} | ${markdownScore(candidate.axis_scores.palette_structure)} | ${markdownScore(candidate.axis_scores.spacing_rhythm)} | ${markdownScore(candidate.axis_scores.rounding)} | ${markdownScore(candidate.axis_scores.motion_density)} | ${markdownEscape(axis)} |`);
    }
    lines.push('');
    for (const [index, candidate] of result.top3.entries()) {
      lines.push(`### Rank ${index + 1}: ${candidate.id}`, '');
      lines.push(`- Highest-axis rule: ${markdownEscape(candidate.decisive_axis_rule)}. Result: ${markdownEscape(candidate.decisive_axis_by_score.join(', '))}.`);
      for (const axis of AXIS_NAMES) {
        const evidence = candidate.evidence[axis];
        lines.push(`- ${axis} (${markdownScore(candidate.axis_scores[axis])}): target ${markdownEscape(evidence.target)}; record ${markdownEscape(evidence.candidate)}.`);
      }
      if (index === 0) {
        const composition = candidate.section_span_composition;
        if (composition) {
          lines.push(`- Existing-option combination source: \`${candidate.id}\` spans from \`${composition.source}\`: ${markdownEscape(composition.sequence)}.`);
          lines.push(`- Span count: ${composition.span_count}; quoted spans: ${markdownEscape(composition.spans.map((span) => `${span.order}:${span.type} [${span.y_start},${span.y_end}]${span.heading_text ? ' ' + span.heading_text : ''}`).join(' → '))}.`);
        } else {
          lines.push(`- Existing-option combination source: \`${candidate.id}\`; no \`v3/segments/${candidate.id}.json\` span document is present.`);
        }
      }
      lines.push('');
    }
  }
  return lines.join('\n') + '\n';
}

function selectTargets(options) {
  if (options.only) {
    const target = HOLDOUTS.find((entry) => entry.id === options.only);
    if (!target) throw new Error('unknown fixed holdout id: ' + options.only);
    return [target];
  }
  if (options.url) {
    const target = HOLDOUTS.find((entry) => entry.url === options.url);
    if (!target) throw new Error('--url must exactly match one fixed holdout URL');
    return [target];
  }
  return HOLDOUTS;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const targets = selectTargets(options);
  if (options.dryRun) {
    for (const [index, target] of targets.entries()) {
      const outDir = path.join(CAPTURE_ROOT, target.id);
      const command = { command: process.execPath, args: [CAPTURE_SCRIPT, target.url, outDir, '--force'] };
      console.log(`[${index + 1}/${targets.length}] ${target.id} ${printableCommand(command)}`);
    }
    return;
  }

  const log = [
    `reference-classifier started=${new Date().toISOString()}`,
    `fixed_holdouts=${HOLDOUTS.map((target) => `${target.id}:${target.url}`).join(', ')}`,
    `selected=${targets.map((target) => target.id).join(', ')} pace_ms=${options.paceMs} timeout_ms=${TARGET_TIMEOUT_MS}`,
    'collector=capture-styles.js (unmodified); no bypass or replacement collector configured',
  ];
  const corpus = loadCorpus(log);
  const segments = loadSegments();
  const results = [];

  for (const [index, target] of targets.entries()) {
    const capture = await captureTarget(target, log);
    if (capture.status === 'capture-failed') {
      results.push({ id: target.id, url: target.url, capture, inventory: null, compared_record_count: 0, top3: [] });
      log.push(`[classify] ${target.id} skipped reason=${capture.reason}`);
    } else {
      const inventory = inventoryFromStyles(capture.styles);
      if (!inventory) {
        const failureCapture = { ...capture, status: 'capture-failed', reason: 'styles-json-no-2xx-inventory', styles: null };
        results.push({ id: target.id, url: target.url, capture: failureCapture, inventory: null, compared_record_count: 0, top3: [] });
        log.push(`[classify] ${target.id} skipped reason=styles-json-no-2xx-inventory`);
      } else {
        const ranked = rankTarget(inventory, corpus, segments);
        const top3 = ranked.slice(0, 3);
        results.push({
          id: target.id,
          url: target.url,
          capture: { ...capture, styles: undefined },
          inventory,
          compared_record_count: ranked.length,
          top3,
          all_candidate_scores: ranked,
        });
        log.push(`[classify] ${target.id} compared=${ranked.length} top3=${top3.map((candidate) => `${candidate.id}:${candidate.overall_score}`).join(',')}`);
      }
    }
    if (index < targets.length - 1) {
      log.push(`[pace] waiting=${options.paceMs}ms before next fixed holdout`);
      await sleep(options.paceMs);
    }
  }

  const report = {
    goal: 'G2.5 reference matching classifier demonstration',
    generated_at: new Date().toISOString(),
    holdout_contract: HOLDOUTS,
    invocation: { selected_ids: targets.map((target) => target.id), pace_ms: options.paceMs, target_timeout_ms: TARGET_TIMEOUT_MS },
    corpus: {
      merged_record_count: corpus.records.length,
      usable_style_inventory_count: corpus.usable.length,
      unavailable_style_inventories: corpus.unavailable.map((record) => ({ id: record.id, reason: record.unavailable_reason, styles_path: record.styles_path })),
    },
    score_method: {
      axes: AXIS_NAMES,
      type_scale: 'mean shared numeric display/body font-size and line-height log2 proximity',
      palette_structure: 'cosine similarity over area-share-normalized hue/lightness bins; backgrounds weight 0.7 and text weight 0.3',
      spacing_and_rounding: 'weighted Jaccard over normalized observed px-count histograms, excluding 0px and values above 256px',
      motion_density: 'mean transition-density proximity, animation-density proximity, and reduced-motion equality when known',
      aggregate: 'arithmetic mean of available axes; equal weight; unavailable axes are not imputed',
    },
    results,
  };
  log.push(`reference-classifier finished=${new Date().toISOString()} attempted=${results.length} scored=${results.filter((result) => result.top3.length).length}`);
  writeJson(RESULT_PATH, report);
  writeText(MARKDOWN_PATH, markdownEvidence(results, corpus));
  writeText(LOG_PATH, log.join('\n') + '\n');
  console.log(`reference-classifier: attempted ${results.length}/${HOLDOUTS.length}; scored ${results.filter((result) => result.top3.length).length}/${HOLDOUTS.length}; evidence ${path.relative(ROOT, EVIDENCE_DIR)}`);
}

main().catch((error) => {
  console.error('reference-classifier: ' + (error && error.message ? error.message : String(error)));
  process.exitCode = 1;
});
