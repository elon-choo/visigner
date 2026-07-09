#!/usr/bin/env node
'use strict';

// Adapted from ui-craft (MIT), (c) 2026 Eduardo Calvo — github.com/educlopez/ui-craft
//   The in-band fixture loop + class-separation assertion method are adapted from
//   evals/quality/score.test.mjs. No ui-craft code is copied; fixtures, bands, the
//   orthogonality/invariant classes and the s2Pass locks are visigner's own.

const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const scriptsDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const manifestPath = path.join(__dirname, 'fixtures', 'manifest.json');
const brandLintPath = path.join(scriptsDir, 'brand-lint.js');
const harnessPath = path.join(scriptsDir, 'anti-ai-eval.js');
const { SHIP_VERDICT_KEYS } = require(path.join(scriptsDir, 'mechanical-score.js'));

const S2_ESCAPE_TELLS = new Set([
  'repeated-decorative-label',
  'multiscript-numbering',
  'letter-code-badge',
  'palette-monotony',
  'mono-label',
  'marker-sequence-broken',
  'uniform-frame-loop',
  'letter-square-avatar',
  'outline-chip',
]);

function parseArgs(argv) {
  const args = { json: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') {
      assert.ok(argv[i + 1], '--json requires an output path');
      args.json = argv[++i];
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return args;
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`cannot read ${label || file}: ${e.message}`);
  }
}

function runNode(script, args, cwd, label) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
  });
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result;
}

function commandTail(result) {
  return [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
}

function fixturePagePath(fixture) {
  return path.resolve(repoRoot, fixture.path);
}

function rulesFromBrandLint(report) {
  return (Array.isArray(report.violations) ? report.violations : [])
    .map((v) => v && v.rule)
    .filter(Boolean);
}

function measureFixture(fixture) {
  const page = fixturePagePath(fixture);
  assert.ok(fs.existsSync(page), `${fixture.name}: missing fixture page ${page}`);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-mechanical-score-'));
  try {
    const brandLintOut = path.join(tempDir, 'brand-lint.json');
    const brandLint = runNode(brandLintPath, [page, brandLintOut], tempDir, `${fixture.name} brand-lint`);
    if (![0, 1].includes(brandLint.status) || !fs.existsSync(brandLintOut)) {
      throw new Error(`${fixture.name}: brand-lint failed to produce sidecar (${commandTail(brandLint)})`);
    }
    const brandLintReport = readJson(brandLintOut, `${fixture.name} brand-lint report`);

    const harness = runNode(
      harnessPath,
      [page, '--brand-lint', brandLintOut],
      tempDir,
      `${fixture.name} anti-ai-eval`,
    );
    if (harness.status !== 0) {
      throw new Error(`${fixture.name}: anti-ai-eval failed (${commandTail(harness)})`);
    }

    const reportPath = path.join(tempDir, 'anti-ai-report.json');
    const report = readJson(reportPath, `${fixture.name} anti-ai report`);
    const mechanicalScore = report.mechanicalScore && report.mechanicalScore.score;
    assert.strictEqual(typeof mechanicalScore, 'number', `${fixture.name}: missing numeric mechanicalScore.score`);

    return {
      name: fixture.name,
      class: fixture.class,
      path: fixture.path,
      expectedBand: fixture.expected_band,
      s2passExpected: fixture.s2pass_expected,
      mechanicalScore,
      letter: report.mechanicalScore.letter,
      s2Pass: report.s2Pass,
      verdict: report.verdict,
      monotonyScore: report.monotonyScore,
      tellsDetected: Array.isArray(report.tellsDetected) ? report.tellsDetected : [],
      report,
      brandLint: {
        errorCount: brandLintReport.errorCount,
        warnCount: brandLintReport.warnCount,
        rules: rulesFromBrandLint(brandLintReport),
        report: brandLintReport,
      },
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function inBand(score, band) {
  return score >= band.scoreMin && score <= band.scoreMax;
}

function assertNoShipVerdictKeys(value, where, failures) {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (SHIP_VERDICT_KEYS.includes(key)) failures.push(`${where}.${key}`);
  }
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === 'object') assertNoShipVerdictKeys(child, `${where}.${key}`, failures);
  }
}

function byName(measurements, name) {
  const found = measurements.find((m) => m.name === name);
  assert.ok(found, `missing measured fixture ${name}`);
  return found;
}

function writeJson(outPath, measurements, separation) {
  if (!outPath) return;
  const resolved = path.resolve(process.cwd(), outPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(
    resolved,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      measurements,
      separation,
    }, null, 2),
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = readJson(manifestPath, 'fixture manifest');
  const fixtures = Array.isArray(manifest.fixtures) ? manifest.fixtures : [];
  const measurements = fixtures.map(measureFixture);

  for (const m of measurements) {
    assert.ok(
      inBand(m.mechanicalScore, m.expectedBand),
      `${m.name}: mechanicalScore=${m.mechanicalScore} outside band [${m.expectedBand.scoreMin}, ${m.expectedBand.scoreMax}]`,
    );
    console.log(
      `PASS IN-BAND ${m.name}: mechanicalScore=${m.mechanicalScore} band=[${m.expectedBand.scoreMin},${m.expectedBand.scoreMax}]`,
    );
  }

  const mechanicalSet = new Set(manifest.separation && manifest.separation.mechanical_set);
  const setMeasurements = measurements.filter((m) => mechanicalSet.has(m.name));
  const highScores = setMeasurements
    .filter((m) => m.class === 'designer' || m.class === 'invariant')
    .map((m) => m.mechanicalScore);
  const slopScores = setMeasurements.filter((m) => m.class === 'slop').map((m) => m.mechanicalScore);
  assert.ok(highScores.length > 0, 'mechanical separation set has no designer/invariant fixtures');
  assert.ok(slopScores.length > 0, 'mechanical separation set has no slop fixtures');
  const designerMin = Math.min(...highScores);
  const slopMax = Math.max(...slopScores);
  const gap = designerMin - slopMax;
  const separation = { designerMin, slopMax, gap };
  assert.ok(gap >= 10, `MECH-SEPARATION failed: designerMin=${designerMin} slopMax=${slopMax} gap=${gap}`);
  console.log(`PASS MECH-SEPARATION designerMin=${designerMin} slopMax=${slopMax} gap=${gap}`);

  const sadBeige = byName(measurements, 'orthogonality/sad-beige-monochrome');
  const designerFixtureMin = Math.min(
    ...measurements.filter((m) => m.class === 'designer').map((m) => m.mechanicalScore),
  );
  // Today's margin is exactly 0 (85 vs 85): if any designer fixture drifts up by 1 point,
  // this lock breaks by design.
  assert.strictEqual(sadBeige.s2Pass, true, `${sadBeige.name}: expected s2Pass=true`);
  assert.ok(
    sadBeige.mechanicalScore >= designerFixtureMin,
    `${sadBeige.name}: mechanicalScore=${sadBeige.mechanicalScore} below designerMin=${designerFixtureMin}`,
  );
  console.log(
    `PASS ORTHO-A sad-beige is deceptively high: s2Pass=${sadBeige.s2Pass} mech=${sadBeige.mechanicalScore} designerMin=${designerFixtureMin}`,
  );

  const escapeSwap = byName(measurements, 'orthogonality/escape-tell-swap');
  const escapeTellCount = escapeSwap.tellsDetected.filter((t) => S2_ESCAPE_TELLS.has(t.tell)).length;
  // This locks the boolean S2 escape gate; it is intentionally not a score-band assertion.
  assert.ok(escapeTellCount > 0, `${escapeSwap.name}: expected at least one S2 escape tell`);
  assert.strictEqual(escapeSwap.s2Pass, false, `${escapeSwap.name}: expected s2Pass=false`);
  console.log(`PASS ESCAPE-LOCK s2Pass=${escapeSwap.s2Pass} escapeTellCount=${escapeTellCount}`);

  assert.ok(
    escapeSwap.mechanicalScore > slopMax,
    `${escapeSwap.name}: mechanicalScore=${escapeSwap.mechanicalScore} must exceed slopMax=${slopMax}`,
  );
  console.log(`PASS ESCAPE-NONREDUNDANT escapeMech=${escapeSwap.mechanicalScore} slopMax=${slopMax}`);

  for (const m of measurements) {
    assert.strictEqual(m.s2Pass, m.s2passExpected, `${m.name}: expected s2Pass=${m.s2passExpected}, got ${m.s2Pass}`);
  }
  console.log(`PASS S2PASS-MATCHES-MANIFEST ${measurements.length}/${measurements.length} fixtures`);

  const shipKeyFailures = [];
  for (const m of measurements) {
    assertNoShipVerdictKeys(m.report.mechanicalScore, `${m.name}.mechanicalScore`, shipKeyFailures);
    assertNoShipVerdictKeys(
      m.report.mechanicalScore && m.report.mechanicalScore.dimensions,
      `${m.name}.mechanicalScore.dimensions`,
      shipKeyFailures,
    );
  }
  assert.deepStrictEqual(shipKeyFailures, [], `ship verdict keys leaked into mechanicalScore: ${shipKeyFailures.join(', ')}`);
  console.log(`PASS NO-SHIP-VERDICT-KEY checked=${measurements.length}`);

  for (const m of measurements) {
    assert.strictEqual(
      m.report.mechanicalScore.dimensions.token_discipline.wired,
      true,
      `${m.name}: token_discipline.wired must be true`,
    );
  }
  console.log(`PASS TOKEN-WIRED checked=${measurements.length}`);

  for (const m of measurements) {
    assert.ok(!m.brandLint.rules.includes('raw-hex'), `${m.name}: raw-hex brand-lint finding present`);
  }
  console.log(`PASS NO-RAW-HEX checked=${measurements.length}`);

  const tamperTarget = measurements[0];
  const tamperedBand = {
    scoreMin: tamperTarget.expectedBand.scoreMin + 20,
    scoreMax: tamperTarget.expectedBand.scoreMax - 20,
  };
  assert.strictEqual(
    inBand(tamperTarget.mechanicalScore, tamperedBand),
    false,
    `${tamperTarget.name}: tampered band unexpectedly accepted mechanicalScore=${tamperTarget.mechanicalScore}`,
  );
  console.log('PASS BAND-TAMPER-DETECTS (drift is caught)');

  writeJson(args.json, measurements, separation);
  console.log('mechanical-score regression complete');
}

try {
  main();
} catch (e) {
  console.error(`FAIL ${e.message}`);
  process.exit(1);
}
