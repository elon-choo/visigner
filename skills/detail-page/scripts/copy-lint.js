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
//   message-match        WARN        (with --idea) hero shares no STEMS/owned-terms with the idea (advisory;
//                                     an in-voice paraphrase that shares stems/owned-terms is NOT drift)
//   verbatim-lock        ERROR       (with --strict) a surface-declared verbatim tagline/claim lock string is absent
//   voice-fingerprint    WARN        (with --voice-fingerprint) register outlier vs the rest of the campaign
//   lexicon-banned       ERROR       a banned brand-lexicon term appears
//   lexicon-no-owned     WARN        none of the owned brand-lexicon terms appear
//
// Exit: non-zero ONLY when an error-severity finding exists (warnings never fail the gate). 2 on fatal.

const fs = require('fs');
const path = require('path');
const { fingerprintText, flagOutliers } = require('./lib-voice-fingerprint');

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

// ---- locale-pluggable lexicon (KO floor) ----------------------------------------------------------
// Default behavior = the English lists above. `--locale ko` swaps in the built-in Korean pack and
// `--voice voice.json` ({ locale, slopWords, spamWords, ctaVerbs, subjectMax, previewMax }) overrides
// individual fields. A non-English locale also turns on grapheme-aware length counting so a Korean
// syllable counts as 1 character (not its UTF-16 length). Korean has no word boundaries, so KO slop /
// CTA entries are plain strings matched as substrings (English entries stay RegExp).
const KO_SLOP = [
  '최고', '최상', '최강', '혁신', '완벽', '무조건', '궁극', '압도적', '차세대',
  '게임체인저', '단언컨대', '진정한', '신세계', '대박', '강력한', '획기적', '믿을 수 없는',
];
const KO_CTA = [
  '지금 구매', '구매하기', '신청하기', '시작하기', '자세히', '알아보기', '더 알아보기',
  '다운로드', '구독', '가입', '살펴보기', '둘러보기', '예약', '사전예약', '주문', '받기',
  '신청', '구매', '바로가기', '지금 시작', '지금 신청',
];

const LOCALES = {
  en: { locale: 'en', slop: SLOP, ctaVerbs: CTA_PHRASES, graphemeLen: false },
  ko: { locale: 'ko', slop: KO_SLOP, ctaVerbs: KO_CTA, graphemeLen: true },
};

// grapheme-aware length (Korean syllable = 1); falls back to code-point count if no Intl.Segmenter.
function graphemeLen(s) {
  s = String(s);
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    try { let n = 0; for (const _ of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)) n++; return n; } catch (_) { /* fall through */ }
  }
  return Array.from(s).length;
}
function clen(s, loc) { return loc && loc.graphemeLen ? graphemeLen(s) : String(s).length; }

// resolve the active locale config from --locale and/or a --voice voice.json (voice overrides fields).
function resolveLocale(localeArg, voice) {
  const base = (voice && voice.locale) || localeArg || 'en';
  const cfg = Object.assign({}, LOCALES[base] || LOCALES.en);
  cfg.locale = base;
  if (base !== 'en' && !LOCALES[base]) cfg.graphemeLen = true; // unknown non-en locale: assume CJK-aware
  if (voice) {
    if (Array.isArray(voice.slopWords)) cfg.slop = voice.slopWords;
    if (Array.isArray(voice.ctaVerbs)) cfg.ctaVerbs = voice.ctaVerbs;
    if (typeof voice.graphemeLen === 'boolean') cfg.graphemeLen = voice.graphemeLen;
  }
  return cfg;
}

// slop matcher tolerant of both RegExp (English) and plain-substring (Korean / JSON) entries.
function findSlop(corpus, list) {
  const hits = [];
  const lc = String(corpus).toLowerCase();
  for (const entry of (list || [])) {
    if (entry instanceof RegExp) { const m = String(corpus).match(entry); if (m) hits.push(m[0]); }
    else { const s = String(entry).trim(); if (s && lc.includes(s.toLowerCase())) hits.push(s); }
  }
  return hits;
}

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

function hasCta(model, loc) {
  if (model.cta.trim()) return true;
  const lc = model.copy.toLowerCase();
  const verbs = (loc && loc.ctaVerbs) || CTA_PHRASES;
  return verbs.some((p) => lc.includes(String(p).toLowerCase()));
}

function ideaTokens(idea, loc) {
  const lc = String(idea).toLowerCase();
  if (loc && loc.graphemeLen) {
    // CJK/Korean: split on whitespace + ASCII punctuation, keep tokens of length >= 2 (Latin path
    // requires >= 4, but a 2-char Korean token carries content).
    return lc.split(/[\s,./|·–—:;!?()[\]{}"'`]+/).map((t) => t.trim()).filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  }
  return lc.split(/[^a-z0-9]+/).filter((t) => t.length >= 4 && !STOPWORDS.has(t));
}

// light inflectional stemmer (lowercase + strip a common plural/verb ending). Latin tokens only; CJK
// tokens have no inflection to strip and are returned unchanged. Deterministic — longest ending first.
function stem(tok) {
  const t = String(tok).toLowerCase().trim();
  if (!/[a-z]/.test(t) || t.length <= 3) return t;
  for (const suf of ['ingly', 'edly', 'ing', 'ied', 'ies', 'ed', 'es', 'ly', 's']) {
    if (t.endsWith(suf) && t.length - suf.length >= 3) {
      let base = t.slice(0, -suf.length);
      if (suf === 'ied' || suf === 'ies') base += 'y';
      return base;
    }
  }
  return t;
}

// two stems "share content" if equal, or one is a >=4-char prefix of the other — tolerant of over- or
// under-stemming (morn/morning). Short stems must match exactly to avoid car/card-style false hits.
function stemShare(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  return s.length >= 4 && l.startsWith(s);
}

// build the idea's content STEMS from the one-line idea PLUS any owned brand-lexicon terms. A paraphrase
// in the brand's OWN voice legitimately restates the idea via owned terms / inflected forms, so those
// must count as "restated", not drift — this is the fix for --idea being too literal.
function ideaStemSet(idea, loc, owned) {
  const set = new Set(ideaTokens(idea, loc).map(stem));
  for (const term of (owned || [])) {
    for (const t of ideaTokens(String(term), loc)) set.add(stem(t));
  }
  return [...set].filter(Boolean);
}

function matchesIdea(text, ideaStems, loc) {
  const heroStems = ideaTokens(String(text), loc).map(stem);
  return ideaStems.some((s) => heroStems.some((h) => stemShare(s, h)));
}

// normalize declared verbatim-lock fields (string or array) off a surface spec into a clean string list.
function lockList(surface) {
  const out = [];
  for (const v of [surface.locks, surface.verbatimLocks, surface.verbatim]) {
    if (!v) continue;
    if (Array.isArray(v)) out.push(...v);
    else out.push(v);
  }
  return out.map((x) => String(x).trim()).filter(Boolean);
}

// ---------- the checks ----------
function lintOne(surface, file, opts) {
  const model = normalize(surface);
  const findings = [];
  const add = (rule, severity, message) => findings.push({ rule, severity, message });
  const { idea, ideaStems, lexicon } = opts;
  const loc = opts.loc || LOCALES.en;
  const strict = !!opts.strict;
  const locks = lockList(surface);

  // channel length budgets (grapheme-aware for CJK locales)
  if (model.channel === 'ad') {
    const n = clen(model.primary, loc);
    if (n > AD_PRIMARY_ERROR) add('ad-primary-long', 'error', `ad primary text ${n} chars > ${AD_PRIMARY_ERROR} — truncated mid-thought`);
    else if (n > AD_PRIMARY_WARN) add('ad-primary-long', 'warn', `ad primary text ${n} chars > ${AD_PRIMARY_WARN} — past the fold`);
    const hn = clen(model.hero, loc);
    if (hn > AD_HEADLINE_WARN) add('ad-headline-long', 'warn', `ad headline ${hn} chars > ${AD_HEADLINE_WARN}`);
  } else if (model.channel === 'social') {
    const n = clen(model.firstLine, loc);
    if (n > SOCIAL_FIRSTLINE_ERROR) add('social-firstline-long', 'error', `social first line ${n} chars > ${SOCIAL_FIRSTLINE_ERROR}`);
    else if (n > SOCIAL_FIRSTLINE_WARN) add('social-firstline-long', 'warn', `social first line ${n} chars > ${SOCIAL_FIRSTLINE_WARN} — past the "…more" fold`);
  } else if (model.channel === 'push') {
    const words = model.primary.trim() ? model.primary.trim().split(/\s+/).length : 0;
    const n = clen(model.primary, loc);
    if (words > PUSH_MAX_WORDS) add('push-too-many-words', 'error', `push body ${words} words > ${PUSH_MAX_WORDS}`);
    if (n > PUSH_CHARS_ERROR) add('push-too-long', 'error', `push body ${n} chars > ${PUSH_CHARS_ERROR}`);
    else if (n > PUSH_CHARS_WARN) add('push-too-long', 'warn', `push body ${n} chars > ${PUSH_CHARS_WARN}`);
  }

  // AI-slop banned verbs / superlatives (all channels)
  for (const hit of findSlop(model.copy, loc.slop)) {
    add('slop-verb', 'error', `AI-slop verb/phrase: "${hit}"`);
  }

  // required CTA
  if (!hasCta(model, loc)) add('cta-missing', 'error', 'no CTA — neither a cta field nor a recognized action phrase');

  // cross-surface message-match (only with --idea) — ADVISORY. A paraphrase in the channel's OWN voice
  // that shares STEMS or owned brand-terms with the idea is a correct restatement, NOT drift; only a hero
  // that shares no idea content at all gets a WARN. --strict no longer ERRORs on paraphrase — it enforces
  // verbatim tagline/claim locks instead (below).
  if (idea && ideaStems.length) {
    if (!matchesIdea(model.hero || model.firstLine || model.primary, ideaStems, loc)) {
      add('message-match', 'warn', `hero does not restate the campaign idea ("${idea}") — message-match drift (shares no stems/owned-terms with the idea)`);
    }
  }

  // verbatim tagline/claim LOCKS — the only thing --strict enforces as an ERROR. A surface may DECLARE
  // exact strings that must appear verbatim (spec field `locks` / `verbatimLocks` / `verbatim`). Under
  // --strict each declared lock that is absent from the copy fails the gate. With no declared locks,
  // --strict adds no errors (a paraphrase is allowed to stand).
  if (strict) {
    const corpus = model.copy.toLowerCase();
    for (const lock of locks) {
      if (!corpus.includes(lock.toLowerCase())) {
        add('verbatim-lock', 'error', `declared verbatim lock missing from copy: "${lock}" (--strict)`);
      }
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
    text: model.copy,
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
  node copy-lint.js <target> --idea "<one idea>"     + message-match (advisory: paraphrase OK)
  node copy-lint.js <target> --idea "<x>" --strict   enforce verbatim tagline/claim LOCKS only (ERROR)
  node copy-lint.js <target> --voice-fingerprint     advisory voice-drift outlier pass (owned/grade/rhythm)
  node copy-lint.js <target> --locale ko             use the built-in Korean slop/CTA + char budgets
  node copy-lint.js <target> --voice voice.json      custom locale pack (slopWords/ctaVerbs/...)
  node copy-lint.js <target> --lexicon voice.json    + owned/banned brand-lexicon check (owned -> idea-tokens)
  node copy-lint.js <target> [out.json]              also write the JSON report
  node copy-lint.js --help

SPEC   one surface, an array, or { "surfaces": [...] }. channel ∈ ad | social | push (others: slop/CTA only).
       a surface may declare verbatim LOCKS via "locks"/"verbatimLocks"/"verbatim" (string or array).
LOCALE --locale ko or --voice voice.json ({ locale, slopWords, spamWords, ctaVerbs, subjectMax, previewMax }).
       Non-English locales count length in graphemes (a Korean syllable = 1). Default stays English.
MATCH  --idea restates as STEMS + owned brand-terms, so an in-voice paraphrase (shared stems/owned-terms)
       is NOT drift. --strict enforces verbatim tagline/claim locks only — NOT message-match.
CHECKS (ERROR -> exit 1; WARN -> never fails)
  ad-primary >125 WARN / >175 ERROR · ad-headline >40 WARN · social-firstline >125 WARN / >280 ERROR ·
  push >10 words ERROR · push >90 chars WARN / >120 ERROR · slop-verb ERROR · cta-missing ERROR ·
  message-match WARN (with --idea, advisory) · verbatim-lock ERROR (with --strict, declared lock absent) ·
  voice-fingerprint WARN (with --voice-fingerprint, register outlier) · lexicon-banned ERROR · lexicon-no-owned WARN
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
  let localeArg = null;
  let voiceCfg = null;
  let voicePath = null;
  let strict = false;
  let fingerprint = false;
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--idea') {
      idea = argv[++i];
      if (idea == null) { console.error('FATAL --idea needs a string'); process.exit(2); }
    } else if (argv[i] === '--lexicon') {
      lexiconPath = argv[++i];
      if (!lexiconPath) { console.error('FATAL --lexicon needs a path'); process.exit(2); }
      lexicon = JSON.parse(fs.readFileSync(lexiconPath, 'utf8'));
    } else if (argv[i] === '--locale') {
      localeArg = argv[++i];
      if (!localeArg) { console.error('FATAL --locale needs a code (e.g. ko)'); process.exit(2); }
    } else if (argv[i] === '--voice') {
      voicePath = argv[++i];
      if (!voicePath) { console.error('FATAL --voice needs a path'); process.exit(2); }
      voiceCfg = JSON.parse(fs.readFileSync(voicePath, 'utf8'));
    } else if (argv[i] === '--strict') {
      strict = true;
    } else if (argv[i] === '--voice-fingerprint' || argv[i] === '--fingerprint') {
      fingerprint = true;
    } else {
      pos.push(argv[i]);
    }
  }
  const target = pos[0];
  const outArg = pos[1];
  if (!target) { console.error('FATAL no target'); process.exit(2); }

  const loc = resolveLocale(localeArg, voiceCfg);
  const ownedTerms = lexicon && Array.isArray(lexicon.owned) ? lexicon.owned : null;
  const opts = { idea, ideaStems: idea ? ideaStemSet(idea, loc, ownedTerms) : [], lexicon, loc, strict };
  const st = fs.statSync(target);
  let reports = [];
  if (st.isDirectory()) {
    const files = collectTargets(target, [outArg, lexiconPath, voicePath].filter(Boolean));
    if (files.length === 0) { console.error('FATAL no *.json specs in dir'); process.exit(2); }
    for (const f of files) {
      const surfaces = surfacesFromSpec(JSON.parse(fs.readFileSync(f, 'utf8')));
      surfaces.forEach((s, i) => reports.push(lintOne(s, `${path.resolve(f)}#${i}`, opts)));
    }
  } else {
    const surfaces = surfacesFromSpec(JSON.parse(fs.readFileSync(target, 'utf8')));
    surfaces.forEach((s, i) => reports.push(lintOne(s, `${path.resolve(target)}#${i}`, opts)));
  }

  // optional deterministic voice-fingerprint pass (advisory): flags surfaces whose register (owned-term
  // coverage / sentence-length variance / reading-grade) is an outlier vs the rest of the campaign.
  if (fingerprint) {
    const recs = reports.map((r) => ({ id: r.file, metrics: fingerprintText(r.text, ownedTerms) }));
    const flagged = flagOutliers(recs);
    const byId = new Map(flagged.map((f) => [f.id, f]));
    for (const r of reports) {
      const f = byId.get(r.file);
      r.fingerprint = f ? f.metrics : null;
      if (f && f.outlier) {
        r.findings.push({ rule: 'voice-fingerprint', severity: 'warn', message: `voice-drift outlier: ${f.reasons.join('; ')}` });
        r.warnCount += 1;
      }
    }
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
