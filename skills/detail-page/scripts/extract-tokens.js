'use strict';

// Deterministic capture -> token-block extraction. This module deliberately
// makes no network or model calls: class-B fields remain null until a separate
// tile-vision pass is supplied. Class-C collector reads are emitted only after
// the authored-region gate says the DOM belongs to the exemplar.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXPLICIT_REGION_MESSAGE = 'REFUSING — authored region is unresolved; provide an explicit region classification; no region default will be assumed.';
const OVERWRITE_MESSAGE = (file) => `REFUSING — output already exists: ${file}; skipped without --force (non-destructive overwrite guard).`;
const DEFAULT_JOBS = Object.freeze([
  {
    id: 'linear',
    captureDir: path.join(ROOT, 'references', 'captures', 'app-ui', 'linear'),
    stylesPath: '/tmp/stylecheck/linear/styles.json',
    outPath: '/tmp/extract-check/linear/tokens.json',
  },
  {
    id: '400620',
    captureDir: path.join(ROOT, 'references', 'captures', '400620'),
    stylesPath: '/tmp/stylecheck/400620/styles.json',
    outPath: '/tmp/extract-check/400620/tokens.json',
  },
]);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error('cannot read JSON ' + file + ': ' + error.message);
  }
}

function requireFile(file) {
  if (!fs.existsSync(file)) throw new Error('required capture artifact is missing: ' + file);
  return file;
}

function envelope(value, provenance, confidence, evidence, gap) {
  return { value, provenance, confidence, evidence, gap };
}

function empty(provenance, gap, evidence = null) {
  return envelope(null, provenance, null, evidence, gap);
}

function round(value, digits) {
  const multiplier = 10 ** digits;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function tileFiles(captureDir) {
  return fs.readdirSync(captureDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^tile_\d+\.(?:png|jpe?g)$/iu.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'en'));
}

function verdictFrom(styles) {
  const verdict = styles && styles.authoredRegion && styles.authoredRegion.verdict;
  return verdict === 'dom-authored' || verdict === 'likely-platform-chrome'
    ? verdict
    : 'unknown';
}

function isDomAuthored(verdict) {
  return verdict === 'dom-authored';
}

function authoredEvidence(verdict) {
  if (isDomAuthored(verdict)) {
    return 'styles.json#/authoredRegion/verdict = "dom-authored"; collector values are emitted only through their resolving styles.json pointers.';
  }
  return 'styles.json#/authoredRegion/verdict = "' + verdict + '"; the computed DOM describes platform chrome rather than the exemplar, so no DOM style is emitted.';
}

function collectorValue(value, pointer, verdict) {
  if (!isDomAuthored(verdict)) return empty('dom', authoredGap(verdict), authoredEvidence(verdict));
  if (value === null || value === undefined) {
    return empty('styles-json', 'GAP-01', 'styles.json#' + pointer + ' was unavailable from the qualifying collector read.');
  }
  return envelope(value, 'styles-json', null, 'styles.json#' + pointer, null);
}

function authoredGap(verdict) {
  // GAP-01 is the existing schema's capture-style/provenance gap. GAP-07 is
  // the stronger safety guard when the DOM is known or suspected to be chrome.
  return isDomAuthored(verdict) ? 'GAP-01' : 'GAP-07';
}

function semanticGap(verdict) {
  return isDomAuthored(verdict) ? 'GAP-09' : 'GAP-07';
}

function viewportInfo(capture, styles) {
  const tiles = capture && finiteNumber(capture.tiles);
  const covered = capture && finiteNumber(capture.coveredHeight);
  if (tiles && covered && tiles > 0) {
    const height = covered / tiles;
    return {
      height,
      evidence: 'capture.json#/coveredHeight ÷ capture.json#/tiles = ' + covered + ' ÷ ' + tiles + ' = ' + height,
    };
  }

  const height = styles && styles.meta && styles.meta.viewport && finiteNumber(styles.meta.viewport.height);
  if (height && height > 0) {
    return {
      height,
      evidence: 'styles.json#/meta/viewport/height = ' + height + ' (capture viewport metadata)',
    };
  }
  return null;
}

function buildRhythm(data, capture, styles, verdict) {
  const pageHeight = finiteNumber(data.pageHeight);
  const bodyTextLen = finiteNumber(data.bodyTextLen);
  const imageCount = finiteNumber(data.imageCount);
  const viewport = viewportInfo(capture, styles);
  const rhythm = {
    band_count: empty('tile-vision', semanticGap(verdict), 'No tile-vision pass is part of this pure extractor.'),
    median_band_height_px: empty('derived', 'GAP-09'),
    viewports: empty('derived', 'GAP-05'),
    text_density: empty('derived', 'GAP-05'),
    image_density: empty('derived', 'GAP-05'),
    spacing_scale_px: empty('dom', authoredGap(verdict), authoredEvidence(verdict)),
    radius_scale_px: empty('dom', authoredGap(verdict), authoredEvidence(verdict)),
  };

  if (pageHeight === null || !viewport) return rhythm;

  const viewports = round(pageHeight / viewport.height, 1);
  rhythm.viewports = envelope(
    viewports,
    'derived',
    null,
    'data.json#/pageHeight ÷ viewport height; ' + pageHeight + ' ÷ ' + viewport.height + ' = ' + viewports + ' viewports (' + viewport.evidence + ')',
    null,
  );

  if (bodyTextLen !== null && viewports > 0) {
    const density = round(bodyTextLen / viewports, 1);
    rhythm.text_density = envelope(
      density,
      'derived',
      null,
      'data.json#/bodyTextLen ÷ derived viewports; ' + bodyTextLen + ' ÷ ' + viewports + ' = ' + density + ' chars/viewport',
      null,
    );
  }

  if (imageCount !== null && viewports > 0) {
    const density = round(imageCount / viewports, 2);
    rhythm.image_density = envelope(
      density,
      'derived',
      null,
      'data.json#/imageCount ÷ derived viewports; ' + imageCount + ' ÷ ' + viewports + ' = ' + density + ' images/viewport',
      null,
    );
  }
  return rhythm;
}

function buildPalette(styles, verdict) {
  const styleEvidence = authoredEvidence(verdict);
  const styleGap = authoredGap(verdict);
  const readGap = semanticGap(verdict);
  return {
    roles: {
      dominant_60: empty('tile-vision', isDomAuthored(verdict) ? styleGap : readGap, styleEvidence),
      secondary_30: empty('tile-vision', isDomAuthored(verdict) ? styleGap : readGap, styleEvidence),
      accent_10: empty('tile-vision', isDomAuthored(verdict) ? styleGap : readGap, styleEvidence),
      field_committed: empty('tile-vision', isDomAuthored(verdict) ? styleGap : readGap, styleEvidence),
      field_evidence: empty('tile-vision', isDomAuthored(verdict) ? styleGap : readGap, styleEvidence),
      field_sections: empty('tile-vision', 'GAP-09', 'No section-to-tile map or tile-vision sweep is available.'),
    },
    temperature: empty('tile-vision', isDomAuthored(verdict) ? styleGap : readGap, styleEvidence),
    computed_backgrounds: collectorValue(styles && styles.color && styles.color.backgrounds, '/color/backgrounds', verdict),
    ramp: [],
    chroma_max_measured: empty('tile-px', 'GAP-03'),
    chrome_excluded: empty('hand', 'GAP-07', isDomAuthored(verdict)
      ? 'No human chrome-region annotation is present.'
      : styleEvidence),
  };
}

function buildType(styles, verdict) {
  const evidence = authoredEvidence(verdict);
  const gap = authoredGap(verdict);
  const semantic = semanticGap(verdict);
  return {
    display: {
      family: collectorValue(styles && styles.type && styles.type.display && styles.type.display.resolvedFamily, '/type/display/resolvedFamily', verdict),
      weights: empty('dom', gap, evidence),
    },
    body: {
      family: collectorValue(styles && styles.type && styles.type.body && styles.type.body.resolvedFamily, '/type/body/resolvedFamily', verdict),
      weights: empty('dom', gap, evidence),
    },
    mono: { family: collectorValue(styles && styles.type && styles.type.mono && styles.type.mono.resolvedFamily, '/type/mono/resolvedFamily', verdict) },
    scale_px: empty('dom', gap, evidence),
    pairing_note: empty('tile-vision', semantic, 'No tile-vision pass is part of this pure extractor.'),
    weight_contrast_observed: empty('tile-vision', semantic, 'No tile-vision pass is part of this pure extractor.'),
    kr_display_present: empty('tile-vision', semantic, 'No tile-vision pass is part of this pure extractor.'),
  };
}

function buildLayout(verdict) {
  const gap = semanticGap(verdict);
  const evidence = isDomAuthored(verdict)
    ? 'No tile-vision pass is part of this pure extractor.'
    : authoredEvidence(verdict);
  return {
    archetype: empty('tile-vision', gap, evidence),
    content_width_px: empty('tile-vision', isDomAuthored(verdict) ? 'GAP-03' : gap, evidence),
    column_system: empty('tile-vision', gap, evidence),
    primitive_repeated: empty('tile-vision', gap, evidence),
  };
}

function gifUrls(data) {
  if (!Array.isArray(data.bigImages)) return [];
  return data.bigImages.filter((value) => typeof value === 'string' && /\.gif(?:[/?#]|$)/iu.test(value));
}

function buildMotion(data, verdict) {
  const gifs = gifUrls(data);
  const styleEvidence = authoredEvidence(verdict);
  const styleGap = authoredGap(verdict);
  return {
    gif_asset_count: envelope(
      gifs.length,
      'derived',
      null,
      'count of .gif URLs in data.json#/bigImages = ' + gifs.length,
      null,
    ),
    gif_evidence: gifs.length
      ? envelope(gifs, 'capture-json', null, 'data.json#/bigImages', 'GAP-09')
      : empty('capture-json', 'GAP-09'),
    dynamic_demo_present: envelope(
      gifs.length > 0,
      'derived',
      null,
      'gif_asset_count > 0 = ' + (gifs.length > 0),
      null,
    ),
    notes: empty(
      'hand',
      'GAP-08',
      'No hand-authored motion annotation is present; this pure extractor does not infer motion from still capture data.',
    ),
    durations_ms: empty('dom', styleGap, styleEvidence),
    easings: empty('dom', styleGap, styleEvidence),
    reduced_motion_honored: empty('dom', styleGap, styleEvidence),
  };
}

function extractTokenBlock(input) {
  const { data, capture, styles } = input;
  if (!data || typeof data !== 'object') throw new Error('data.json must contain an object');
  if (!styles || typeof styles !== 'object') throw new Error('styles.json must contain an object');

  const verdict = verdictFrom(styles);
  if (verdict === 'unknown') throw new Error(EXPLICIT_REGION_MESSAGE);
  return {
    palette: buildPalette(styles, verdict),
    type: buildType(styles, verdict),
    layout: buildLayout(verdict),
    rhythm: buildRhythm(data, capture, styles, verdict),
    motion: buildMotion(data, verdict),
  };
}

function extractTokensFromCapture(captureDir, stylesPath) {
  const absoluteCaptureDir = path.resolve(captureDir);
  const dataPath = requireFile(path.join(absoluteCaptureDir, 'data.json'));
  requireFile(path.join(absoluteCaptureDir, 'bodytext.txt'));
  const absoluteStylesPath = requireFile(path.resolve(stylesPath));
  const capturePath = path.join(absoluteCaptureDir, 'capture.json');

  // Read the tile directory as part of the capture contract even though this
  // zero-dependency extractor cannot decode pixels. Keeping this deterministic
  // inventory makes a missing capture directory fail loudly rather than imply
  // that tile-derived fields were inspected.
  tileFiles(absoluteCaptureDir);

  const tokens = extractTokenBlock({
    data: readJson(dataPath),
    capture: fs.existsSync(capturePath) ? readJson(capturePath) : null,
    styles: readJson(absoluteStylesPath),
  });
  Object.defineProperty(tokens, '__stylesJsonPath', { value: absoluteStylesPath, enumerable: false });
  return tokens;
}

function collectGaps(value, prefix = '', found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectGaps(item, prefix + '[' + index + ']', found));
    return found;
  }
  if (!value || typeof value !== 'object') return found;
  if (Object.prototype.hasOwnProperty.call(value, 'value')
      && Object.prototype.hasOwnProperty.call(value, 'gap')) {
    if (value.value === null && value.gap) found.push(prefix + '=' + value.gap);
    return found;
  }
  Object.entries(value).forEach(([key, child]) => {
    collectGaps(child, prefix ? prefix + '.' + key : key, found);
  });
  return found;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/extract-tokens.js --capture <dir> --styles <styles.json> --out <tokens.json> [--force]',
  ].join('\n');
}

function parseArgs(argv) {
  if (!argv.length) throw new Error(`${EXPLICIT_REGION_MESSAGE} An explicit --capture/--styles/--out job is required; no default capture region will be assumed.`);
  const values = {};
  let force = false;
  for (let index = 0; index < argv.length;) {
    const flag = argv[index];
    if (flag === '--force') {
      if (force) throw new Error(usage());
      force = true;
      index += 1;
      continue;
    }
    const value = argv[index + 1];
    if (!['--capture', '--styles', '--out'].includes(flag) || !value) {
      throw new Error(usage());
    }
    values[flag] = value;
    index += 2;
  }
  if (!values['--capture'] || !values['--styles'] || !values['--out']) throw new Error(usage());
  return {
    jobs: [{
      id: path.basename(path.resolve(values['--capture'])),
      captureDir: values['--capture'],
      stylesPath: values['--styles'],
      outPath: values['--out'],
    }],
    force,
  };
}

function runCli() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
    for (const job of parsed.jobs) {
      const tokens = extractTokensFromCapture(job.captureDir, job.stylesPath);
      if (fs.existsSync(job.outPath) && !parsed.force) throw new Error(OVERWRITE_MESSAGE(job.outPath));
      fs.mkdirSync(path.dirname(job.outPath), { recursive: true });
      fs.writeFileSync(job.outPath, JSON.stringify(tokens, null, 2) + '\n');
      const gaps = collectGaps(tokens);
      console.log('PASS ' + job.id + ' -> ' + job.outPath);
      console.log('GAPS ' + job.id + ': ' + gaps.join(', '));
    }
  } catch (error) {
    console.error('FAIL extract-tokens: ' + error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) runCli();

module.exports = {
  DEFAULT_JOBS,
  EXPLICIT_REGION_MESSAGE,
  OVERWRITE_MESSAGE,
  collectGaps,
  extractTokenBlock,
  extractTokensFromCapture,
  verdictFrom,
};
