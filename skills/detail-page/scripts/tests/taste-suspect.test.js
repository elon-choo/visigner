'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const HOOK = path.join(ROOT, 'hooks', 'auto-critique-hook.js');
const { assessTaste } = require(path.join(ROOT, 'hooks', 'taste-suspect.js'));
const EMPTY = path.join(ROOT, 'skills', 'detail-page', 'scripts', 'tests', 'fixtures', 'orthogonality', 'empty-placeholder-panels', 'index.html');
const RICH = path.join(ROOT, 'skills', 'detail-page', 'scripts', 'tests', 'fixtures', 'invariant', 'mobile-quality-floor', 'index.html');
const MACHINE_PASS = { s2Pass: true, mechanicalScore: { score: 100, letter: 'A', incomplete: false } };
const HIDDEN_BULK = '<p>This visually hidden paragraph is deliberately long enough to count as substantive evidence.</p>'.repeat(8);

function invokeHook(artifact) {
  return spawnSync(process.execPath, [HOOK], {
    cwd: ROOT,
    input: JSON.stringify({
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      cwd: ROOT,
      tool_input: { file_path: artifact },
      tool_response: { success: true },
    }),
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
    env: {
      ...process.env,
      VISIGNER_FORCE_BROWSER_MISSING: '1',
      VISIGNER_NO_AUTO_BROWSER: '1',
    },
  });
}

function hookGrade(artifact) {
  const child = invokeHook(artifact);
  assert.strictEqual(child.status, 0, child.stderr);
  assert.strictEqual(child.stderr, '');
  const payload = JSON.parse(child.stdout);
  const context = payload.hookSpecificOutput.additionalContext;
  const reportPath = context.match(/^staticReport:\s*(.+)$/mi)[1].trim();
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  fs.rmSync(path.dirname(reportPath), { recursive: true, force: true });
  return { payload, context, report };
}

function hiddenVectorSource({ inlineStyle = '', className = '', classRule = '' }) {
  const css = classRule ? `<style>${classRule}</style>` : '';
  const wrapper = `<div${className ? ` class="${className}"` : ''}${inlineStyle ? ` style="${inlineStyle}"` : ''}>${HIDDEN_BULK}</div>`;
  return fs.readFileSync(EMPTY, 'utf8')
    .replace('</head>', `${css}</head>`)
    .replace('</body>', `${wrapper}</body>`);
}

function registerHiddenVectorTest(name, vector) {
  test(`${name} bulk cannot evade tasteSuspect`, () => {
    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), `visigner-${name.replace(/[^a-z0-9]+/gi, '-')}-`));
    const artifact = path.join(fixtureDir, 'hidden-vector.html');
    const source = hiddenVectorSource(vector);
    fs.writeFileSync(artifact, source);
    try {
      const direct = assessTaste(source, MACHINE_PASS);
      assert.strictEqual(direct.tasteMetrics.substantiveBlocks, 0);
      assert.strictEqual(direct.tasteSuspect, true);

      const { context, report } = hookGrade(artifact);
      assert.strictEqual(report.verdict, 'clean');
      assert.strictEqual(report.s2Pass, true);
      assert.strictEqual(report.mechanicalScore.score, 100);
      assert.match(context, /^tasteSuspect:\s*true$/mi);
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });
}

test('machine-clean empty placeholder fixture surfaces tasteSuspect true', () => {
  const { payload, context, report } = hookGrade(EMPTY);
  assert.strictEqual(report.verdict, 'clean');
  assert.strictEqual(report.s2Pass, true);
  assert.strictEqual(report.mechanicalScore.score, 100);
  assert.strictEqual(report.mechanicalScore.letter, 'A');
  assert.match(payload.systemMessage, /tasteSuspect:\s*true/i);
  assert.match(payload.systemMessage, /human taste review required/i);
  assert.match(context, /^tasteSuspect:\s*true$/mi);
  assert.match(context, /^humanGateRequired:\s*true$/mi);
  assert.match(context, /machine-passed-but-taste-suspect/i);
});

test('genuinely rich clean fixture surfaces tasteSuspect false', () => {
  const { payload, context, report } = hookGrade(RICH);
  assert.strictEqual(report.verdict, 'clean');
  assert.strictEqual(report.s2Pass, true);
  assert.strictEqual(report.mechanicalScore.score, 100);
  assert.strictEqual(report.mechanicalScore.letter, 'A');
  assert.match(payload.systemMessage, /tasteSuspect:\s*false/i);
  assert.match(context, /^tasteSuspect:\s*false$/mi);
  assert.match(context, /^humanGateRequired:\s*false$/mi);
});

registerHiddenVectorTest('off-screen left -9999px', { inlineStyle: 'position:absolute;left:-9999px' });
registerHiddenVectorTest('off-screen right -9999px', { inlineStyle: 'position:absolute;right:-9999px' });
registerHiddenVectorTest('off-screen left -9999em', { inlineStyle: 'position:absolute;left:-9999em' });
registerHiddenVectorTest('text-indent -9999px', { inlineStyle: 'text-indent:-9999px' });
registerHiddenVectorTest('text-indent unitless -9999', { inlineStyle: 'text-indent:-9999' });
registerHiddenVectorTest('opacity zero', { inlineStyle: 'opacity:0' });
registerHiddenVectorTest('clip rect zero-area', { inlineStyle: 'position:absolute;clip:rect(0,0,0,0)' });
registerHiddenVectorTest('clip-path zero-area', { inlineStyle: 'position:absolute;clip-path:inset(100%)' });
registerHiddenVectorTest('font-size zero', { inlineStyle: 'font-size:0' });
registerHiddenVectorTest('height zero with hidden overflow', { inlineStyle: 'height:0;overflow:hidden' });
registerHiddenVectorTest('sr-only class', {
  className: 'sr-only',
  classRule: '.sr-only{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);clip-path:inset(50%)}',
});

function registerTabPanelGuard(name, selector) {
  test(`${name} does not hide every state-qualified panel`, () => {
    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), `visigner-${name.replace(/[^a-z0-9]+/gi, '-')}-`));
    const artifact = path.join(fixtureDir, 'tab-panels.html');
    const copy = [
      'The active overview explains the verified material specification, measured dimensions, repair options, and practical use cases in concrete detail.',
      'The construction panel documents reinforced seams, replaceable hardware, coating tests, and the maintenance routine customers can follow at home.',
      'The capacity panel records the measured interior layout for a notebook, charger, bottle, and daily tools without relying on decorative filler.',
      'The service panel describes the warranty boundary, repair turnaround, replacement parts, and support process with clear customer expectations.',
    ];
    const panels = copy.map((paragraph, index) => `
      <section class="panel${index === 0 ? ' active' : ''}">
        <h2>Product detail ${index + 1}</h2>
        <p>${paragraph}</p>
      </section>`).join('');
    const source = `<!doctype html><html><head><style>
      ${selector}{display:none}
      .panel{padding:24px;border:1px solid #bbb}
    </style></head><body><main class="tabs">${panels}</main></body></html>`;
    fs.writeFileSync(artifact, source);

    try {
      const direct = assessTaste(source, MACHINE_PASS);
      assert.ok(direct.tasteMetrics.visibleChars > 500);
      assert.strictEqual(direct.tasteMetrics.substantiveBlocks, 4);
      assert.strictEqual(direct.tasteSuspect, false);

      const { context } = hookGrade(artifact);
      assert.match(context, /^tasteSuspect:\s*false$/mi);
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });
}

registerTabPanelGuard('tab-dominant panel subject', '.panel:not(.active)');
registerTabPanelGuard('tabs descendant panel subject', '.tabs .panel:not(.active)');

test('hover-overlay descendant rule hides only the overlay, not four real cards', () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-hover-overlay-'));
  const artifact = path.join(fixtureDir, 'hover-overlay.html');
  const benefits = [
    'Durable woven material keeps its shape through daily commuting while the reinforced seam protects every packed item.',
    'A documented water-resistance test shows exactly how the coating behaves after repeated exposure and careful drying.',
    'Repairable hardware uses standard fasteners so owners can replace a worn component instead of discarding the product.',
    'The measured interior layout fits a notebook, charger, and bottle without hiding capacity behind decorative empty space.',
  ];
  const cards = benefits.map((benefit, index) => `
    <article class="card">
      <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Crect width='320' height='180' fill='%23ddd'/%3E%3C/svg%3E" alt="Documented product view ${index + 1}">
      <p>${benefit}</p>
      <div class="overlay">Quick view ${index + 1}</div>
    </article>`).join('');
  const source = `<!doctype html><html><head><style>
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
    .card{position:relative;padding:20px;border:1px solid #bbb}
    .card:not(:hover) .overlay{display:none}
    .overlay{position:absolute;inset:12px;background:white}
  </style></head><body><main class="grid">${cards}</main></body></html>`;
  fs.writeFileSync(artifact, source);

  try {
    const direct = assessTaste(source, MACHINE_PASS);
    assert.strictEqual(direct.tasteMetrics.substantiveBlocks, 4);
    assert.strictEqual(direct.tasteMetrics.meaningfulMedia, 4);
    assert.strictEqual(direct.tasteMetrics.evidenceUnits, 8);
    assert.strictEqual(direct.tasteSuspect, false);

    const { context } = hookGrade(artifact);
    assert.match(context, /^tasteSuspect:\s*false$/mi);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('hidden paragraphs and hidden inputs cannot inflate visible evidence', () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-hidden-inflation-'));
  const artifact = path.join(fixtureDir, 'hidden-inflation.html');
  const hiddenParagraphs = `<div style="display:none">${'<p>This hidden paragraph is deliberately long enough to look substantive to a source-only counter.</p>'.repeat(5)}<img src="hidden-proof.png" alt="hidden proof"></div>`;
  const hiddenInputs = '<input type="hidden" value="one"><input type="hidden" value="two"><input type="hidden" value="three">';
  const source = fs.readFileSync(EMPTY, 'utf8').replace('</body>', `${hiddenParagraphs}${hiddenInputs}</body>`);
  fs.writeFileSync(artifact, source);

  try {
    const direct = assessTaste(source, MACHINE_PASS);
    assert.strictEqual(direct.tasteMetrics.substantiveBlocks, 0);
    assert.strictEqual(direct.tasteMetrics.meaningfulMedia, 0);
    assert.strictEqual(direct.tasteMetrics.interactiveEvidence, 0);
    assert.strictEqual(direct.tasteMetrics.evidenceUnits, 0);
    assert.strictEqual(direct.tasteSuspect, true);

    const { payload, context, report } = hookGrade(artifact);
    assert.strictEqual(report.verdict, 'clean');
    assert.strictEqual(report.s2Pass, true);
    assert.strictEqual(report.mechanicalScore.score, 100);
    assert.match(payload.systemMessage, /tasteSuspect:\s*true/i);
    assert.match(context, /^tasteSuspect:\s*true$/mi);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('.htm and symlinked HTML artifacts both reach the grade hook', () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visigner-html-routing-'));
  const source = fs.readFileSync(RICH, 'utf8');
  const htmArtifact = path.join(fixtureDir, 'artifact.htm');
  const realArtifact = path.join(fixtureDir, 'real-target.html');
  const symlinkArtifact = path.join(fixtureDir, 'symlink-artifact.html');
  fs.writeFileSync(htmArtifact, source);
  fs.writeFileSync(realArtifact, source);
  fs.symlinkSync(realArtifact, symlinkArtifact);

  try {
    const htm = hookGrade(htmArtifact);
    assert.match(htm.context, /^verdict:\s*clean$/mi);
    assert.match(htm.context, /^mechanicalScore:\s*100\/A$/mi);

    const symlink = hookGrade(symlinkArtifact);
    assert.match(symlink.context, /^verdict:\s*clean$/mi);
    assert.match(symlink.context, /^mechanicalScore:\s*100\/A$/mi);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('renamed, split-style, inline, and fake-media empty shells cannot evade the heuristic', () => {
  const cases = [
    `<!doctype html><style>.a{min-height:140px}.b{background:#ddd}</style><body>${'<section><div class="a b"></div></section>'.repeat(4)}</body>`,
    `<!doctype html><body>${'<section><div role="img" aria-label="finished artwork" style="height:140px;background:#ddd"></div></section>'.repeat(4)}</body>`,
    `<!doctype html><body><svg width="1" height="1" aria-hidden="true"><rect width="1" height="1"/></svg>${'<section><div style="aspect-ratio:1;background:#ddd"></div></section>'.repeat(4)}</body>`,
    `<!doctype html><body><div style="display:none">${'hidden filler '.repeat(80)}</div><svg viewBox="0 0 100 100"><rect width="100" height="100"/><path d="M0 0h1"/></svg>${'<section><div style="height:140px;background:#ddd"></div></section>'.repeat(4)}</body>`,
    `<!doctype html><style>.gone{display:none}.invisible{visibility:hidden}</style><body><div class="gone"><p>${'hidden evidence '.repeat(20)}</p><img src="fake.png"><button>Hidden</button></div><div class="invisible"><p>${'hidden evidence '.repeat(20)}</p></div><div hidden><input value="not rendered"></div>${'<section><div style="height:140px;background:#ddd"></div></section>'.repeat(4)}</body>`,
  ];
  for (const source of cases) {
    const result = assessTaste(source, MACHINE_PASS);
    assert.strictEqual(result.machinePassed, true);
    assert.strictEqual(result.tasteSuspect, true, JSON.stringify(result.tasteMetrics));
    assert.ok(result.tasteSignals.length > 0);
  }
});
