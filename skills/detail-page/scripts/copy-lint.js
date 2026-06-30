// copy-lint.js — deterministic per-CHANNEL copy linter for paid-ad / social / push surfaces.
// No deps (Node fs + regex only). This is the machine FLOOR under the design-critic MODE=copy LLM
// judgment for the NON-email surfaces (email-lint.js already owns the email floor): channel length
// budgets, the AI-slop banned-verb list, a required CTA, optional cross-surface message-match against
// the ONE campaign idea, and an optional owned/banned brand lexicon — so the gate doesn't depend on a
// grader's mood. Off-by-default (nothing imports it yet); /campaign drives it.
//
// Usage:   node copy-lint.js <spec.json|dir/>                       lint one surface, a campaign, or a dir
//          node copy-lint.js <target> --idea "<one idea>"           + cross-surface message-match
//          node copy-lint.js <target> --lexicon voice.json          + owned/banned brand-lexicon check
//          node copy-lint.js <target> [out.json]                    also write the JSON report
//          node copy-lint.js --help
//
// SPEC (JSON) — one surface, an array of surfaces, or { surfaces: [...] } (a whole campaign):
//   { "channel": "ad",     "platform": "meta", "headline": "...", "primaryText": "...", "cta": "Shop now" }
//   { "channel": "social", "platform": "ig",   "text": "first line\n…more", "cta": "Learn more" }
//   { "channel": "push",   "title": "...", "body": "...", "cta": "Open" }
//   any other channel (e.g. "landing", "email") is checked for slop / CTA / idea / lexicon only —
//   no length budget — so a full campaign ladder can pass through one linter.
//
// voice.json (optional): { "owned": ["word", ...], "banned": ["phrase", ...] }
//   owned  -> WARN if NONE of the owned terms appear (brand voice not expressed)
//   banned -> ERROR for each banned term that appears (off-brand / forbidden phrasing)
//
// CHECKS (ERROR fails the gate, exit 1; WARN never fails):
//   ad-primary-long      WARN/ERROR  paid-ad primary text > 125 chars (WARN) / > 175 (ERROR, gets truncated)
//   ad-headline-long     WARN        ad headline > 40 chars
//   social-firstline-long WARN/ERROR social first line > 125 (WARN, past the "…more" fold) / > 280 (ERROR)
//   push-too-many-words  ERROR       push body > 10 words
//   push-too-long        WARN/ERROR  push body > 90 chars (WARN) / > 120 (ERROR)
//   slop-verb            ERROR       AI-slop banned verb/phrase (Empower / Unlock / Transform / Build the future / …)
//   cta-missing          ERROR       no CTA field and no CTA phrase in the copy
//   message-match        WARN        (with --idea) hero/subject does not restate the single campaign idea
//   lexicon-banned       ERROR       a banned brand-lexicon term appears
//   lexicon-no-owned     WARN        none of the owned brand-lexicon terms appear
//
// Exit: non-zero ONLY when an error-severity finding exists (warnings never fail the gate). 2 on fatal.

const fs = require('fs');
const path = require('path');

// ---- channel length budgets ----
const AD_PRIMARY_WARN = 125;      // Meta primary text truncates ~125 chars
const AD_PRIMARY_ERROR = 175;     // clearly past the fold — gets cut mid-thought
const AD_HEADLINE_WARN = 40;
const SOCIAL_FIRSTLINE_WARN = 125; // the "…see more" fold on FB/IG
const SOCIAL_FIRSTLINE_ERROR = 280;
const PUSH_MAX_WORDS = 10;
const PUSH_CHARS_WARN = 90;
const PUSH_CHARS_ERROR = 120;

// ---- AI-slop banned verbs / phrases (auto-fail, matches design-critic §8b slop list) ----
const SLOP = [
  /\bempower(s|ing|ed)?\b/i,
  /\bunlock(s|ing|ed)?\b/i,
  /\btransform(s|ing)?\b/i,
  /\bbuild the future\b/i,
  /\brevolutioniz(e|es|ing|ed)\b/i,
  /\bsupercharg(e|es|ing|ed)\b/i,
  /\bunleash(es|ing|ed)?\b/i,
  /\breimagin(e|es|ing|ed)\b/i,
  /\belevat(e|es|ing|ed)\b/i,
  /\bdisrupt(s|ing|ed)?\b/i,
  /\bgame[- ]changer\b/i,
  /\bnext[- ]level\b/i,
  /\bcutting[- ]edge\b/i,
];

// ---- CTA detection: an explicit `cta` field, OR a recognized action phrase in the copy ----
const CTA_PHRASES = [
  'shop now', 'buy now', 'order now', 'learn more', 'get started', 'sign up', 'signup',
  'join now', 'join the', 'try free', 'try it', 'try now', 'start free', 'start now',
  'get yours', 'claim', 'reserve', 'pre-order', 'preorder', 'download', 'subscribe',
  'see more', 'discover', 'explore', 'find out', 'book now', 'add to cart', 'unlock', // 'unlock' is slop, but as a CTA verb it still counts as "a CTA exists"
  'get the', 'grab', 'tap to', 'open',
];

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'your', 'you', 'our', 'are', 'that', 'this', 'from',
  'now', 'get', 'new', 'all', 'into', 'over', 'more', 'less', 'than', 'then', 'have',
  'has', 'will', 'can', 'but', 'not', 'out', 'how', 'why', 'who', 'what', 'when',
]);

// ---------- normalize one surface spec -> { channel, hero, primary, firstLine, cta, copy } ----------
function normalize(s) {
  const channel = String(s.channel || s.surface || '').toLowerCase();
  const str = (v) => (typeof v === 'string' ? v : '');
  let hero = '';
  let primary = '';
  let firstLine = '';
  if (channel === 'ad') {
    hero = str(s.headline) || str(s.hero);
    primary = str(s.primaryText) || str(s.primary) || str(s.body) || str(s.text);
  } else if (channel === 'social') {
    primary = str(s.text) || str(s.caption) || str(s.body) || str(s.primary);
    firstLine = primary.split('\n')[0];
    hero = str(s.hero) || firstLine;
  } else if (channel === 'push') {
    hero = str(s.title) || str(s.hero);
    primary = str(s.body) || str(s.text) || str(s.primary);
  } else {
    // generic surface (landing / email / other): no length budget, still slop/CTA/idea/lexicon checked
    hero = str(s.headline) || str(s.hero) || str(s.title) || str(s.subject);
    primary = str(s.primaryText) || str(s.primary) || str(s.body) || str(s.text) || str(s.subhead);
    firstLine = primary.split('\n')[0];
  }
  const cta = str(s.cta) || str(s.button) || str(s.action);
  const copy = [hero, primary, cta, str(s.subhead), str(s.subtitle)].filter(Boolean).join('\n');
  return { channel: channel || 'generic', hero, primary, firstLine, cta, copy };
}

function hasCta(model) {
  if (model.cta.trim()) return true;
  const lc = model.copy.toLowerCase();
  return CTA_PHRASES.some((p) => lc.includes(p));
}

function ideaTokens(idea) {
  return String(idea)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
}

function matchesIdea(hero, tokens) {
  const h = hero.toLowerCase();
  return tokens.some((t) => h.includes(t) || h.includes(t.slice(0, 5)));
}

// ---------- the checks ----------
function lintOne(surface, file, opts) {
  const model = normalize(surface);
  const findings = [];
  const add = (rule, severity, message) => findings.push({ rule, severity, message });
  const { idea, ideaToks, lexicon } = opts;

  // channel length budgets
  if (model.channel === 'ad') {
    const n = model.primary.length;
    if (n > AD_PRIMARY_ERROR) add('ad-primary-long', 'error', `ad primary text ${n} chars > ${AD_PRIMARY_ERROR} — truncated mid-thought`);
    else if (n > AD_PRIMARY_WARN) add('ad-primary-long', 'warn', `ad primary text ${n} chars > ${AD_PRIMARY_WARN} — past the fold`);
    if (model.hero.length > AD_HEADLINE_WARN) add('ad-headline-long', 'warn', `ad headline ${model.hero.length} chars > ${AD_HEADLINE_WARN}`);
  } else if (model.channel === 'social') {
    const n = model.firstLine.length;
    if (n > SOCIAL_FIRSTLINE_ERROR) add('social-firstline-long', 'error', `social first line ${n} chars > ${SOCIAL_FIRSTLINE_ERROR}`);
    else if (n > SOCIAL_FIRSTLINE_WARN) add('social-firstline-long', 'warn', `social first line ${n} chars > ${SOCIAL_FIRSTLINE_WARN} — past the "…more" fold`);
  } else if (model.channel === 'push') {
    const words = model.primary.trim() ? model.primary.trim().split(/\s+/).length : 0;
    const n = model.primary.length;
    if (words > PUSH_MAX_WORDS) add('push-too-many-words', 'error', `push body ${words} words > ${PUSH_MAX_WORDS}`);
    if (n > PUSH_CHARS_ERROR) add('push-too-long', 'error', `push body ${n} chars > ${PUSH_CHARS_ERROR}`);
    else if (n > PUSH_CHARS_WARN) add('push-too-long', 'warn', `push body ${n} chars > ${PUSH_CHARS_WARN}`);
  }

  // AI-slop banned verbs (all channels)
  for (const re of SLOP) {
    const m = model.copy.match(re);
    if (m) add('slop-verb', 'error', `AI-slop verb/phrase: "${m[0]}"`);
  }

  // required CTA
  if (!hasCta(model)) add('cta-missing', 'error', 'no CTA — neither a cta field nor a recognized action phrase');

  // cross-surface message-match (only with --idea)
  if (idea && ideaToks.length) {
    if (!matchesIdea(model.hero || model.firstLine || model.primary, ideaToks)) {
      add('message-match', 'warn', `hero does not restate the campaign idea ("${idea}") — message-match drift`);
    }
  }

  // brand lexicon (optional)
  if (lexicon) {
    const corpus = model.copy.toLowerCase();
    for (const term of (Array.isArray(lexicon.banned) ? lexicon.banned : [])) {
      if (term && corpus.includes(String(term).toLowerCase())) add('lexicon-banned', 'error', `banned brand term: "${term}"`);
    }
    const owned = Array.isArray(lexicon.owned) ? lexicon.owned : [];
    if (owned.length && !owned.some((t) => t && corpus.includes(String(t).toLowerCase()))) {
      add('lexicon-no-owned', 'warn', `none of the owned brand terms appear (${owned.slice(0, 4).join(', ')}…)`);
    }
  }

  const errorCount = findings.filter((f) => f.severity === 'error').length;
  const warnCount = findings.filter((f) => f.severity === 'warn').length;
  return {
    file,
    channel: model.channel,
    pass: errorCount === 0,
    errorCount,
    warnCount,
    findings,
  };
}

// ---------- spec file -> array of surfaces ----------
function surfacesFromSpec(spec) {
  if (Array.isArray(spec)) return spec;
  if (spec && Array.isArray(spec.surfaces)) return spec.surfaces;
  return [spec];
}

function collectTargets(dir, excludeAbs) {
  const skip = new Set((excludeAbs || []).map((p) => path.resolve(p)));
  return fs.readdirSync(dir)
    .filter((n) => /\.json$/i.test(n) && !/copy-lint\.json$/i.test(n))
    .map((n) => path.join(dir, n))
    .filter((p) => !skip.has(path.resolve(p)))
    .sort();
}

const HELP = `copy-lint.js — deterministic per-channel copy linter (the floor under design-critic MODE=copy).

USAGE
  node copy-lint.js <spec.json|dir/>                 one surface, a campaign, or a dir of specs
  node copy-lint.js <target> --idea "<one idea>"     + cross-surface message-match
  node copy-lint.js <target> --lexicon voice.json    + owned/banned brand-lexicon check
  node copy-lint.js <target> [out.json]              also write the JSON report
  node copy-lint.js --help

SPEC   one surface, an array, or { "surfaces": [...] }. channel ∈ ad | social | push (others: slop/CTA only).
CHECKS (ERROR -> exit 1; WARN -> never fails)
  ad-primary >125 WARN / >175 ERROR · ad-headline >40 WARN · social-firstline >125 WARN / >280 ERROR ·
  push >10 words ERROR · push >90 chars WARN / >120 ERROR · slop-verb ERROR · cta-missing ERROR ·
  message-match WARN (with --idea) · lexicon-banned ERROR · lexicon-no-owned WARN
`;

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(HELP);
    process.exit(argv.length === 0 ? 1 : 0);
  }
  let idea = null;
  let lexicon = null;
  let lexiconPath = null;
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--idea') {
      idea = argv[++i];
      if (idea == null) { console.error('FATAL --idea needs a string'); process.exit(2); }
    } else if (argv[i] === '--lexicon') {
      lexiconPath = argv[++i];
      if (!lexiconPath) { console.error('FATAL --lexicon needs a path'); process.exit(2); }
      lexicon = JSON.parse(fs.readFileSync(lexiconPath, 'utf8'));
    } else {
      pos.push(argv[i]);
    }
  }
  const target = pos[0];
  const outArg = pos[1];
  if (!target) { console.error('FATAL no target'); process.exit(2); }

  const opts = { idea, ideaToks: idea ? ideaTokens(idea) : [], lexicon };
  const st = fs.statSync(target);
  let reports = [];
  if (st.isDirectory()) {
    const files = collectTargets(target, [outArg, lexiconPath].filter(Boolean));
    if (files.length === 0) { console.error('FATAL no *.json specs in dir'); process.exit(2); }
    for (const f of files) {
      const surfaces = surfacesFromSpec(JSON.parse(fs.readFileSync(f, 'utf8')));
      surfaces.forEach((s, i) => reports.push(lintOne(s, `${path.resolve(f)}#${i}`, opts)));
    }
  } else {
    const surfaces = surfacesFromSpec(JSON.parse(fs.readFileSync(target, 'utf8')));
    surfaces.forEach((s, i) => reports.push(lintOne(s, `${path.resolve(target)}#${i}`, opts)));
  }

  const errorCount = reports.reduce((a, r) => a + r.errorCount, 0);
  const warnCount = reports.reduce((a, r) => a + r.warnCount, 0);
  const summary = {
    pass: errorCount === 0,
    errorCount,
    warnCount,
    surfaces: reports.length,
    idea: idea || null,
    reports,
  };

  if (outArg) fs.writeFileSync(outArg, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({
    pass: summary.pass,
    errorCount,
    warnCount,
    surfaces: reports.length,
    findings: reports.flatMap((r) => r.findings.map((f) => ({ surface: `${path.basename(r.file)} [${r.channel}]`, ...f }))),
  }, null, 2));
  process.exit(errorCount === 0 ? 0 : 1);
}

if (require.main === module) {
  try { main(); }
  catch (e) { console.error('FATAL', e.message); process.exit(2); }
}

module.exports = { lintOne, normalize, surfacesFromSpec };
