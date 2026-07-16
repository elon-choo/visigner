'use strict';

// G4.5 — end-to-end NOVICE smoke: a naive one-line brief's produced page goes through the WHOLE
// novice flow (first-run onboarding → real auto-critique hook → grade → human-gate plain-language
// checklist) WITHOUT any expert input. Uses the real handler via a synthetic PostToolUse event —
// this proves handler execution end-to-end, NOT Claude Code's live hook-runner dispatch (G2.1b, owner-only).

const assert = require('assert');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const HOOK = path.join(ROOT, 'hooks', 'auto-critique-hook.js');

// A gen-assets-style placeholder SVG (self-marker inside the file: role=img + aria-label "... placeholder" + "· placeholder" footer).
function placeholderSvg(role) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900" role="img" aria-label="${role} placeholder (photo)">`
    + `<rect width="1200" height="900" fill="#e8e4dc"/>`
    + `<text x="600" y="450" text-anchor="middle" font-size="28">${role}  ·  4:3  ·  placeholder</text></svg>`;
}

// What a novice's first attempt looks like: a real page referencing placeholder images (no cred) + an unsourced claim.
function novicePage() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Bloom Coffee</title>`
    + `<style>body{font-family:'Fraunces',Georgia,serif;margin:0}.hero{padding:6rem 2rem}.card{padding:2rem}</style></head>`
    + `<body><header class="hero"><h1>Bloom Coffee — slow-roasted mornings</h1>`
    + `<p>Fresh beans delivered to 50,000+ happy homes.</p>`
    + `<img src="assets/hero.svg" alt="hero" width="1200" height="900"></header>`
    + `<section class="card"><h2>Why Bloom</h2><img src="assets/beans.svg" alt="beans" width="600" height="450">`
    + `<p>Single-origin, ethically sourced.</p></section></body></html>`;
}

function hookEvent(cwd, target) {
  return JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'Write', cwd, tool_input: { file_path: target } });
}

test('novice first-run smoke: onboarding + grade + human-gate ALL fire through the REAL hook, one invocation, no expert input', () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'g45-novice-'));
  const assetsDir = path.join(ws, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(path.join(assetsDir, 'hero.svg'), placeholderSvg('hero'));
  fs.writeFileSync(path.join(assetsDir, 'beans.svg'), placeholderSvg('beans'));
  const target = path.join(ws, 'index.html');
  fs.writeFileSync(target, novicePage());

  // ---- (1) page is produced ----
  assert.ok(fs.existsSync(target), 'novice page should be produced');

  // ---- (2..4) ONE real-hook invocation delivers the WHOLE novice flow (onboarding is now WIRED into the hook) ----
  const noCredHome = fs.mkdtempSync(path.join(os.tmpdir(), 'g45-nc-'));
  const child = spawnSync(process.execPath, [HOOK], {
    cwd: ws,
    env: { ...process.env, HOME: noCredHome, VISIGNER_FORCE_BROWSER_MISSING: '1' },
    input: hookEvent(ws, target), // Write of the sole HTML in a bare workspace = first-run
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.strictEqual(child.status, 0, child.stderr);
  const payload = JSON.parse(child.stdout);
  const ctx = payload.hookSpecificOutput.additionalContext;

  // first-run onboarding emitted THROUGH the hook (not out-of-band) — this is the integration proof
  assert.match(ctx, /WELCOME TO VISIGNER/);
  assert.match(ctx, /onboardingStatus:\s*first-run-emitted/);
  assert.match(ctx, /What just happened:/);
  assert.match(ctx, /ONE-TAP NEXT STEPS/);

  // grade emitted (loud-degrade static grade, no browser)
  assert.match(ctx, /staticGradeStatus:\s*emitted/);
  assert.match(ctx, /PIXEL CRITIQUE IS OFF/); // loud degrade, not silent

  // human-gate surfaced the novice gaps (placeholder images) in a plain-language STOP checklist
  assert.match(ctx, /humanGateStatus:\s*STOP/);
  assert.match(payload.systemMessage + ctx, /STOP —/);
  assert.match(ctx, /image spots? still show(s)? (a )?stand-in|stand-ins instead of real images/i);

  // ---- whole flow ran with NO expert input (a bare workspace + a naive page, single hook call) ----
  fs.rmSync(ws, { recursive: true, force: true });
  fs.rmSync(noCredHome, { recursive: true, force: true });
});
