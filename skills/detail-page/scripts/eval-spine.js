#!/usr/bin/env node
'use strict';

// G5.1 + G5.2 — Stage-5 proof-eval harness + metrics.
// For each labeled corpus fixture: WITHOUT-spine = the page ships as-is (nothing surfaced);
// WITH-spine = the REAL deployed spine (auto-grade-runner grade + tasteSuspect, then human-gate-report),
// exactly the pair the live hook combines. Deterministic (VISIGNER_FORCE_BROWSER_MISSING, no network/model).
// Each fixture runs in its OWN dir as cwd so anti-ai-eval's cwd report never collides (G4.9.5 T7).
// Recall is computed ONLY over in-scope issues; out-of-spine issues are reported as expected-MISS, never dropped.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..', '..');
const RUNNER = path.join(REPO, 'hooks', 'auto-grade-runner.js');
const { buildHumanGateReport } = require(path.join(REPO, 'hooks', 'human-gate', 'human-gate-report.js'));
const CORPUS = path.join(REPO, 'skills', 'detail-page', 'scripts', 'tests', 'fixtures', 'stage5-eval');

function runGrade(target) {
  // Mirror the hook: spawn the grade runner with the fixture's dir as cwd (isolated report location).
  const child = spawnSync(process.execPath, [RUNNER, target], {
    cwd: path.dirname(target),
    env: { ...process.env, VISIGNER_FORCE_BROWSER_MISSING: '1', HOME: fs.mkdtempSync(path.join(require('os').tmpdir(), 'g5-')) },
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (child.status !== 0) throw new Error(`grade runner failed: ${child.stderr}`);
  return JSON.parse(child.stdout);
}

// What the deployed spine surfaces for one page (the WITH-spine observation).
function withSpine(target) {
  const grade = runGrade(target);
  const report = buildHumanGateReport(target, { gradeResult: grade, env: process.env });
  const g = grade.staticGrade || {};
  const categories = new Set((report.checklist || []).map((i) => i.category));
  const td = g.mechanicalScore && g.mechanicalScore.dimensions && g.mechanicalScore.dimensions.token_discipline;
  return {
    verdict: g.verdict,
    s2Pass: g.s2Pass === true,
    mechanical: g.mechanicalScore && g.mechanicalScore.score,
    tokenFindings: (td && Number(td.findings)) || 0, // brand-lint AI-tell rules folded into the grade (G6.5)
    tells: Array.isArray(g.tellsDetected) ? g.tellsDetected.length : 0,
    tasteSuspect: grade.tasteSuspect === true || grade.humanGateRequired === true,
    humanGateStop: report.stop === true,
    categories,
    // A page is "flagged by the spine" if any surface fires.
    flagged: report.stop === true || g.s2Pass !== true || grade.tasteSuspect === true,
  };
}

// Map a ground-truth issue's expectedComponent → is it present in the surfaced signals?
function issueCaught(issue, s) {
  switch (issue.expectedComponent) {
    case 'human-gate:images': return s.categories.has('images');
    case 'human-gate:copy': return s.categories.has('copy');
    case 'human-gate:claims': return s.categories.has('claims');
    case 'taste-suspect': return s.tasteSuspect === true;
    case 'anti-ai-eval:monotony': return s.s2Pass === false || s.verdict === 'ai' || s.verdict === 'ai-likely' || s.verdict === 'suspect';
    case 'brand-lint:token': return s.tokenFindings > 0; // banned-font/ai-purple folded into the grade (G6.5)
    default: return false; // out-of-spine (e.g. hex-only ai-purple) — never counted as caught
  }
}

function run() {
  const gt = JSON.parse(fs.readFileSync(path.join(CORPUS, 'ground-truth.json'), 'utf8'));
  const perFixture = [];
  let inScopeTotal = 0; let inScopeCaught = 0;
  const perClass = {}; // expectedComponent -> {total, caught}
  const outOfScope = [];
  let cleanTotal = 0; let cleanFalseFlag = 0;

  for (const fx of gt.fixtures) {
    const target = path.join(CORPUS, fx.dir, 'index.html');
    const s = withSpine(target);
    const withoutFlagged = false; // WITHOUT the spine nothing is surfaced, by definition
    const issueResults = [];
    if (fx.clean) {
      cleanTotal += 1;
      if (s.humanGateStop || s.s2Pass === false || s.tasteSuspect) cleanFalseFlag += 1;
    }
    for (const issue of (fx.issues || [])) {
      const caught = issueCaught(issue, s);
      issueResults.push({ ...issue, caught });
      if (issue.inScope) {
        inScopeTotal += 1;
        if (caught) inScopeCaught += 1;
        const k = issue.expectedComponent;
        perClass[k] = perClass[k] || { total: 0, caught: 0 };
        perClass[k].total += 1;
        if (caught) perClass[k].caught += 1;
      } else {
        outOfScope.push({ dir: fx.dir, ...issue, caught });
      }
    }
    perFixture.push({
      dir: fx.dir, clean: !!fx.clean, freshUntuned: !!fx.freshUntuned,
      withoutSpineFlagged: withoutFlagged, withSpineFlagged: s.flagged,
      surfaced: { verdict: s.verdict, s2Pass: s.s2Pass, tasteSuspect: s.tasteSuspect, humanGateStop: s.humanGateStop, categories: [...s.categories] },
      issues: issueResults,
    });
  }

  // Cross-check precision on reused-clean pages (already tuned; regression cross-check only).
  const reusedClean = [];
  for (const rel of (gt.reusedCleanPages || [])) {
    const target = path.join(REPO, rel);
    if (!fs.existsSync(target)) continue;
    const s = withSpine(target);
    const falseFlag = s.humanGateStop || s.s2Pass === false || s.tasteSuspect;
    reusedClean.push({ page: rel, falseFlag });
    cleanTotal += 1;
    if (falseFlag) cleanFalseFlag += 1;
  }

  const recall = inScopeTotal ? inScopeCaught / inScopeTotal : 0;
  const precision = cleanTotal ? (cleanTotal - cleanFalseFlag) / cleanTotal : 1;
  // BEFORE/AFTER delta = naive fixtures the spine flags that would ship un-flagged without it.
  const naive = perFixture.filter((f) => !f.clean);
  const deltaFlagged = naive.filter((f) => f.withSpineFlagged && !f.withoutSpineFlagged).length;

  return {
    thresholds: { recallMin: 0.90, precisionExact: 1.00 },
    recall, inScopeCaught, inScopeTotal,
    perClass,
    precision, cleanTotal, cleanFalseFlag,
    outOfScope,
    delta: { naiveTotal: naive.length, flaggedWithSpine: deltaFlagged, flaggedWithoutSpine: 0 },
    recallMet: recall >= 0.90,
    precisionMet: precision >= 1.00,
    perFixture,
    reusedClean,
  };
}

module.exports = { run, withSpine };

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(run(), null, 2)}\n`);
}
