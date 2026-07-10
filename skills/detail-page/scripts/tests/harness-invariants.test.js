#!/usr/bin/env node
'use strict';

// The non-weakenable invariant, as a committed, versioned test.
//
// This file was a throwaway script under /tmp while the ui-craft absorption track ran. A red-team
// pass pointed out that it had become load-bearing — it is the ONLY check that catches a gutted
// computeVerdict — while living outside version control and outside CI. So it lives here now.
//
// W1-W8 are the operational definition of "weakening" from /tmp/anti-ai/uc/UC1.1/track-contract.json.
// W9 is new: computeVerdict's BEHAVIOUR, not just its source text. W6 pins the threshold literals by
// regex, which a semantically-equivalent rewrite would slip past; W9 pins what the function returns.
//
// The mutation W9 exists to catch: replace both `return` guards in computeVerdict with `if (false)`,
// so every page is judged 'clean'. Every other committed test stays green — s2pass-escape-anyof,
// s2pass-branch-coverage (it injects verdict directly) and mechanical-score (every slop fixture's
// s2Pass=false comes from the escape gate, not from the verdict).

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const harnessPath = path.resolve(__dirname, '..', 'anti-ai-eval.js');
const src = fs.readFileSync(harnessPath, 'utf8');

function load() {
  const noMain = src.replace(/\nmain\(\);\s*$/, '\n');
  const sandbox = {
    __dirname: path.dirname(harnessPath),
    __filename: harnessPath,
    console,
    module: { exports: {} },
    process,
    require,
  };
  vm.runInNewContext(`${noMain}\nmodule.exports = { computeS2Pass, computeVerdict };`, sandbox, {
    filename: harnessPath,
  });
  return sandbox.module.exports;
}

const { computeS2Pass, computeVerdict } = load();

const ESCAPE9 = [
  'repeated-decorative-label',
  'multiscript-numbering',
  'letter-code-badge',
  'palette-monotony',
  'mono-label',
  'marker-sequence-broken',
  'uniform-frame-loop',
  'letter-square-avatar',
  'outline-chip',
];

// W1 — any single escape tell forces s2Pass=false, even in the best case (verdict clean, severity low).
for (const t of ESCAPE9) {
  assert.strictEqual(computeS2Pass('clean', [{ tell: t, severity: 'low' }]), false, `W1 ${t}`);
}
console.log('PASS W1 all 9 escape tells force s2Pass=false at verdict=clean/severity=low');

// W1b — the gate keys on the tell NAME, so downgrading severity does not help.
assert.strictEqual(computeS2Pass('clean', [{ tell: 'mono-label', severity: 'low' }]), false, 'W1b');
console.log('PASS W1b escape gate is severity-independent');

// W2 — the escape-tell Set still contains all 9 members. Adding members is allowed (strengthening).
const setBody = src.match(/const escapeTells = new Set\(\[([\s\S]*?)\]\);/)[1];
const members = [...setBody.matchAll(/'([^']+)'/g)].map((m) => m[1]);
for (const t of ESCAPE9) assert.ok(members.includes(t), `W2 missing ${t}`);
console.log(`PASS W2 escape-tell Set retains all 9 members (count=${members.length}, superset allowed)`);

// W3 — computeS2Pass stays a pure 2-arg function with no graded identifier in its body.
assert.strictEqual(computeS2Pass.length, 2, 'W3 arity');
const s2Body = src.match(/function computeS2Pass\([\s\S]*?\n\}/)[0];
assert.ok(!/mechanical|graded|\bscore\b/i.test(s2Body), 'W3 graded identifier leaked into body');
console.log('PASS W3 computeS2Pass arity=2, body pure over (verdict, tells)');

// W5 — the report literal carries no ship-verdict key, and keeps the s2PassSemantics guard.
const reportLit = src.match(/const report = \{([\s\S]*?)\n {2}\};/)[1];
const reportKeys = [...reportLit.matchAll(/^\s*([A-Za-z0-9_]+):/gm)].map((m) => m[1]);
const banned = reportKeys.filter(
  (k) => /would_ship|shipApproved|readyToShip|approved|^ship$|^pass$/i.test(k) && k !== 's2Pass',
);
assert.strictEqual(banned.length, 0, `W5 banned keys: ${banned}`);
assert.ok(reportKeys.includes('s2PassSemantics'), 'W5 semantics guard missing');
console.log(`PASS W5 report has no ship-verdict key (keys=${reportKeys.length}), s2PassSemantics present`);

// W6 — computeVerdict's weights and thresholds are pinned as source literals.
const vBody = src.match(/function computeVerdict\([\s\S]*?\n\}/)[0];
assert.ok(/const weights = \{ low: 1, medium: 2, high: 3 \};/.test(vBody), 'W6 weights');
assert.ok(/score >= 8 \|\| highCount >= 3 \|\| \(monotonyScore >= 0\.72 && score >= 5\)/.test(vBody), 'W6 ai-likely');
assert.ok(/score >= 3 \|\| highCount >= 1 \|\| monotonyScore >= 0\.58/.test(vBody), 'W6 suspect');
console.log('PASS W6 computeVerdict weights {1,2,3} and thresholds pinned in source');

// W7 — the call site assigns exactly computeS2Pass(verdict, tells), with no soft override.
assert.ok(/s2Pass: computeS2Pass\(verdict, tells\),/.test(src), 'W7 call-site');
assert.ok(!/s2Pass:[^\n]*(\|\||&&|>=|<=|\?)/.test(src), 'W7 soft-override operator on s2Pass line');
console.log('PASS W7 report.s2Pass = computeS2Pass(verdict, tells), no override');

// W8 — the detector registry still contains every producer of an escape tell.
const detReg = src.match(/for \(const detector of \[([^\]]*)\]\)/)[1];
const producers = [
  'detectMonoLabels',
  'detectRepeatedDecorativeLabels',
  'detectOutlineChips',
  'detectUniformFrameLoop',
  'detectLetterSquareAvatars',
  'detectLetterCodeBadges',
  'detectMarkerSequence',
  'detectMultiscriptNumbering',
  'detectPaletteMonotony',
];
for (const d of producers) assert.ok(detReg.includes(d), `W8 missing ${d}`);
console.log(`PASS W8 detector registry retains all escape-tell producers (${detReg.split(',').length} detectors)`);

// W9 — computeVerdict's BEHAVIOUR. Each case names the branch it pins.
const H = (n) => Array.from({ length: n }, () => ({ tell: 'browser-mockup', severity: 'high' }));
const M = (n) => Array.from({ length: n }, () => ({ tell: 'browser-mockup', severity: 'medium' }));
const ALL_MISSING = { expected: ['a', 'b'], found: [], missing: ['a', 'b'] };

const verdictCases = [
  ['no tells, no monotony -> clean', [], 0, null, 'clean'],
  ['one low tell (score 1) -> clean', [{ tell: 'x', severity: 'low' }], 0, null, 'clean'],
  ['one high tell (highCount >= 1) -> suspect', H(1), 0, null, 'suspect'],
  ['three high tells (score 9 >= 8) -> ai-likely', H(3), 0, null, 'ai-likely'],
  ['one medium tell + monotony 0.60 (>= 0.58) -> suspect', M(1), 0.6, null, 'suspect'],
  ['score 5 + monotony 0.72 -> ai-likely', [...M(2), { tell: 'x', severity: 'low' }], 0.72, null, 'ai-likely'],
  ['one medium tell + all-presence-missing penalty (score 3) -> suspect', M(1), 0, ALL_MISSING, 'suspect'],
];

for (const [name, tells, mono, presence, expected] of verdictCases) {
  const actual = computeVerdict(tells, mono, presence);
  assert.strictEqual(actual, expected, `W9 ${name}: expected ${expected}, got ${actual}`);
}
// The presence penalty must be what moved that last case off 'clean'.
assert.strictEqual(computeVerdict(M(1), 0, null), 'clean', 'W9 presence penalty is not load-bearing');
console.log(`PASS W9 computeVerdict behaviour pinned across ${verdictCases.length} branches + presence penalty`);

console.log('harness invariants complete');
