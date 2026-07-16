#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { runAutoIterate } = require('./auto-iterate-loop.js');

const ROOT = path.resolve(__dirname, '..');
const SCRIPTS = path.join(ROOT, 'skills', 'detail-page', 'scripts');
const BRAND_LINT = path.join(SCRIPTS, 'brand-lint.js');
const EVALUATOR = path.join(SCRIPTS, 'anti-ai-eval.js');
const FIXTURE_PROGRESSION = [
  'skills/detail-page/scripts/tests/fixtures/slop/ai-purple-template-hero/index.html',
  'skills/detail-page/scripts/tests/fixtures/slop/smartstore-urgency-theatre/index.html',
  'skills/detail-page/scripts/tests/fixtures/designer/proof-dense-material/index.html',
];

function runNode(script, args, cwd) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return result;
}

function gradeFixture(artifact) {
  const page = path.resolve(ROOT, artifact);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-auto-iterate-poc-'));
  try {
    const brandReport = path.join(tempDir, 'brand-lint.json');
    const brand = runNode(BRAND_LINT, [page, brandReport], tempDir);
    if (![0, 1].includes(brand.status) || !fs.existsSync(brandReport)) {
      throw new Error(`brand-lint failed for ${artifact}: ${brand.stderr || brand.stdout}`);
    }

    const evaluated = runNode(EVALUATOR, [page, '--brand-lint', brandReport], tempDir);
    if (evaluated.status !== 0) {
      throw new Error(`anti-ai-eval failed for ${artifact}: ${evaluated.stderr || evaluated.stdout}`);
    }
    const report = JSON.parse(fs.readFileSync(path.join(tempDir, 'anti-ai-report.json'), 'utf8'));
    return {
      score: report.mechanicalScore.score,
      letter: report.mechanicalScore.letter,
      verdict: report.verdict,
      s2Pass: report.s2Pass,
      tellsDetected: report.tellsDetected.map((item) => `${item.tell}:${item.severity}`),
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  const result = await runAutoIterate({
    initialArtifact: FIXTURE_PROGRESSION[0],
    maxRounds: 4,
    visualCriticAvailable: false,
    grade: ({ artifact }) => gradeFixture(artifact),
    improve: ({ round }) => FIXTURE_PROGRESSION[Math.min(round, FIXTURE_PROGRESSION.length - 1)],
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
