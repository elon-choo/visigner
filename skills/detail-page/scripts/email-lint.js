// email-lint.js — deterministic email-copy linter for ONE email spec/HTML or a sequence directory.
// No deps (Node fs + regex only). This is the deterministic FLOOR under the design-critic MODE=copy LLM
// judgment: machine-checkable spam-tells, length limits, and CTA/preheader presence — so the gate doesn't
// depend on a grader's mood. Off-by-default (nothing imports it yet).
//
// Usage:   node email-lint.js <spec.json|email.html>            # single
//          node email-lint.js <dir/>                            # sequence: lint every *.json/*.html
//          node email-lint.js <target> --lexicon voice.json     # + owned/banned brand-lexicon check
//          node email-lint.js <target> [out.json]               # also write the JSON report
//          node email-lint.js --help
//
// voice.json (optional): { "owned": ["word", ...], "banned": ["phrase", ...] }
//   owned  -> WARN if NONE of the owned terms appear (brand voice not expressed)
//   banned -> ERROR for each banned term that appears (off-brand / forbidden phrasing)
//
// Checks (ERROR fails the gate, exit 1):
//   subject-too-long   ERROR  subject > 50 chars
//   subject-missing    ERROR  no subject
//   preheader-too-long WARN   preheader > 90 chars
//   preheader-missing  WARN   no preheader (inbox shows body text)
//   cta-missing        ERROR  zero CTAs (no clear action)
//   cta-multiple       WARN   >1 CTA (diluted single clear action)
//   spam-allcaps       ERROR  an ALL-CAPS word run (>=4 letters) in subject/preheader
//   spam-bang          ERROR  "!!!" (or more) anywhere in subject/preheader
//   spam-words         ERROR  hard spam tells (free money, act now, cash bonus, 100% free, winner, ...)
//   spam-words-soft    WARN   borderline-but-legit launch phrases (guarantee, order now, buy now, limited time, urgent)
//   spam-emoji         WARN   excessive emoji (>2) in subject/preheader
//   lexicon-banned     ERROR  a banned brand-lexicon term appears
//   lexicon-no-owned   WARN   none of the owned brand-lexicon terms appear
//
// Exit: non-zero ONLY when an error-severity finding exists (warnings never fail the gate). 2 on fatal.

const fs = require('fs');
const path = require('path');

const SUBJECT_MAX = 50;
const PREHEADER_MAX = 90;

// Split severity so the linter doesn't over-block legitimate launch copy. True spam tells
// (phishing / get-rich tells) stay ERROR; common-but-legit commerce phrases (a money-back
// guarantee, "Order now", a "limited time" promo) are real-world launch language → WARN, not a
// gate failure. Match the design-critic intent: flag, don't forbid, the borderline ones.
const SPAM_WORDS_ERROR = [
  'free money', 'act now', 'risk-free', 'risk free', 'click here', 'cash bonus',
  'no cost', '100% free', 'winner', 'congratulations you', 'this is not spam', 'extra income',
];
const SPAM_WORDS_WARN = [
  'guarantee', 'order now', 'buy now', 'limited time', 'urgent',
];
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu;
// an ALL-CAPS run of >=4 letters (whole "word"); excludes things like "I" or "OK".
const ALLCAPS = /\b[A-Z]{4,}\b/g;

// ---- AI-slop banned verbs / phrases (auto-fail, the SAME list copy-lint.js uses; design-critic §8b) ----
// Scanned over subject + preheader + body so a sequence full of Empower/Unlock/Transform can't pass clean.
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

// ---------- spec/HTML -> normalized { subject, preheader, ctas[], bodyText, source } ----------
function fromSpec(spec) {
  const blocks = Array.isArray(spec.blocks) ? spec.blocks : [];
  const ctas = blocks.filter((b) => b && b.type === 'cta');
  const bodyText = blocks
    .filter((b) => b && (b.type === 'h1' || b.type === 'p' || b.type === 'cta'))
    .map((b) => b.text || '')
    .join('\n');
  return {
    subject: typeof spec.subject === 'string' ? spec.subject : '',
    preheader: typeof spec.preheader === 'string' ? spec.preheader : '',
    ctas: ctas.map((c) => c.text || ''),
    bodyText,
  };
}

function decodeEntities(s) {
  return String(s)
    .replace(/&nbsp;|&zwnj;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim();
}

function fromHtml(raw) {
  const titleM = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const subject = titleM ? decodeEntities(titleM[1]) : '';
  // preheader = the hidden div (display:none ... mso-hide:all). Take the first such div's text.
  let preheader = '';
  const preM = raw.match(/<div[^>]*(?:display:\s*none|mso-hide:\s*all)[^>]*>([\s\S]*?)<\/div>/i);
  if (preM) preheader = decodeEntities(preM[1]);
  // CTAs: anchors whose style looks like a button (display:inline-block + background/bgcolor), OR mso roundrect.
  const ctas = [];
  for (const m of raw.matchAll(/<a\b[^>]*style="[^"]*display:\s*inline-block[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)) {
    ctas.push(decodeEntities(m[1]));
  }
  const bodyText = decodeEntities(raw.replace(/<[^>]+>/g, ' '));
  return { subject, preheader, ctas, bodyText };
}

// ---------- the checks ----------
function lintOne(model, file, lexicon) {
  const findings = [];
  const add = (rule, severity, message) => findings.push({ rule, severity, message });
  const head = `${model.subject}\n${model.preheader}`; // spam-tells scanned in the visible inbox surface

  // length / presence
  if (!model.subject.trim()) add('subject-missing', 'error', 'no subject line');
  else if (model.subject.length > SUBJECT_MAX)
    add('subject-too-long', 'error', `subject ${model.subject.length} chars > ${SUBJECT_MAX}`);

  if (!model.preheader.trim()) add('preheader-missing', 'warn', 'no preheader — inbox will show body text');
  else if (model.preheader.length > PREHEADER_MAX)
    add('preheader-too-long', 'warn', `preheader ${model.preheader.length} chars > ${PREHEADER_MAX}`);

  // single clear CTA
  if (model.ctas.length === 0) add('cta-missing', 'error', 'no CTA / no clear action');
  else if (model.ctas.length > 1) add('cta-multiple', 'warn', `${model.ctas.length} CTAs — dilutes the single clear action`);

  // spam-tells (subject + preheader)
  const caps = head.match(ALLCAPS);
  if (caps) add('spam-allcaps', 'error', `ALL-CAPS shouting: ${[...new Set(caps)].slice(0, 3).join(', ')}`);
  if (/!{3,}/.test(head)) add('spam-bang', 'error', 'excessive "!!!"');
  const lower = head.toLowerCase();
  for (const w of SPAM_WORDS_ERROR) {
    if (lower.includes(w)) add('spam-words', 'error', `spam phrase: "${w}"`);
  }
  for (const w of SPAM_WORDS_WARN) {
    if (lower.includes(w)) add('spam-words-soft', 'warn', `borderline phrase: "${w}" — fine for a real launch, but a spam-filter tell`);
  }
  const emo = head.match(EMOJI);
  if (emo && emo.length > 2) add('spam-emoji', 'warn', `${emo.length} emoji in subject/preheader (>2)`);

  // AI-slop banned verbs (subject + preheader + body) — same list/severity as copy-lint.js (ERROR).
  const slopCorpus = `${head}\n${model.bodyText}`;
  const slopSeen = new Set();
  for (const re of SLOP) {
    const m = slopCorpus.match(re);
    if (m && !slopSeen.has(m[0].toLowerCase())) {
      slopSeen.add(m[0].toLowerCase());
      add('slop-verb', 'error', `AI-slop verb/phrase: "${m[0]}"`);
    }
  }

  // brand lexicon (optional)
  if (lexicon) {
    const corpus = `${head}\n${model.bodyText}`.toLowerCase();
    const banned = Array.isArray(lexicon.banned) ? lexicon.banned : [];
    for (const term of banned) {
      if (term && corpus.includes(String(term).toLowerCase())) add('lexicon-banned', 'error', `banned brand term: "${term}"`);
    }
    const owned = Array.isArray(lexicon.owned) ? lexicon.owned : [];
    if (owned.length) {
      const hit = owned.some((term) => term && corpus.includes(String(term).toLowerCase()));
      if (!hit) add('lexicon-no-owned', 'warn', `none of the owned brand terms appear (${owned.slice(0, 4).join(', ')}…)`);
    }
  }

  const errorCount = findings.filter((f) => f.severity === 'error').length;
  const warnCount = findings.filter((f) => f.severity === 'warn').length;
  return {
    file,
    pass: errorCount === 0,
    errorCount,
    warnCount,
    subjectLen: model.subject.length,
    preheaderLen: model.preheader.length,
    ctaCount: model.ctas.length,
    findings,
  };
}

function modelFromFile(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const ext = path.extname(file).toLowerCase();
  if (ext === '.json') return fromSpec(JSON.parse(raw));
  return fromHtml(raw);
}

function collectTargets(dir, excludeAbs) {
  const skip = new Set((excludeAbs || []).map((p) => path.resolve(p)));
  const files = fs.readdirSync(dir)
    .filter((n) => /\.(json|html|htm)$/i.test(n) && !/email-lint\.json$/i.test(n))
    .map((n) => path.join(dir, n))
    .filter((p) => !skip.has(path.resolve(p)))
    .sort();
  // Dedupe a spec+render PAIR (welcome.json + welcome.html) so one email counts ONCE, not twice.
  // Prefer the .json spec (authoritative structured copy) when both exist; otherwise keep the HTML.
  const byBase = new Map();
  for (const p of files) {
    const base = path.basename(p, path.extname(p)).toLowerCase();
    const isJson = path.extname(p).toLowerCase() === '.json';
    const prev = byBase.get(base);
    if (!prev || (isJson && path.extname(prev).toLowerCase() !== '.json')) byBase.set(base, p);
  }
  return [...byBase.values()].sort();
}

const HELP = `email-lint.js — deterministic email-copy linter (the floor under design-critic MODE=copy).

USAGE
  node email-lint.js <spec.json|email.html>          single email
  node email-lint.js <dir/>                          sequence: every *.json/*.html in the dir
  node email-lint.js <target> --lexicon voice.json   + owned/banned brand-lexicon check
  node email-lint.js <target> [out.json]             also write the JSON report
  node email-lint.js --help

voice.json   { "owned": [...], "banned": [...] }
CHECKS (ERROR -> exit 1; WARN -> never fails)
  subject>50 ERROR · subject-missing ERROR · preheader>90 WARN · preheader-missing WARN ·
  cta-missing ERROR · cta-multiple WARN · ALL-CAPS ERROR · "!!!" ERROR · spam-words ERROR ·
  >2 emoji WARN · lexicon-banned ERROR · lexicon-no-owned WARN
`;

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(HELP);
    process.exit(argv.length === 0 ? 1 : 0);
  }
  // parse --lexicon and positionals
  let lexicon = null;
  let lexiconPath = null;
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--lexicon') {
      const lp = argv[++i];
      if (!lp) { console.error('FATAL --lexicon needs a path'); process.exit(2); }
      lexiconPath = lp;
      lexicon = JSON.parse(fs.readFileSync(lp, 'utf8'));
    } else {
      pos.push(argv[i]);
    }
  }
  const target = pos[0];
  const outArg = pos[1];
  if (!target) { console.error('FATAL no target'); process.exit(2); }

  const st = fs.statSync(target);
  let reports;
  if (st.isDirectory()) {
    const files = collectTargets(target, [outArg, lexiconPath].filter(Boolean));
    if (files.length === 0) { console.error('FATAL no *.json/*.html in dir'); process.exit(2); }
    reports = files.map((f) => lintOne(modelFromFile(f), path.resolve(f), lexicon));
  } else {
    reports = [lintOne(modelFromFile(target), path.resolve(target), lexicon)];
  }

  const errorCount = reports.reduce((a, r) => a + r.errorCount, 0);
  const warnCount = reports.reduce((a, r) => a + r.warnCount, 0);
  const summary = {
    pass: errorCount === 0,
    errorCount,
    warnCount,
    emails: reports.length,
    reports,
  };

  if (outArg) fs.writeFileSync(outArg, JSON.stringify(summary, null, 2));
  // compact console output
  console.log(JSON.stringify({
    pass: summary.pass,
    errorCount,
    warnCount,
    emails: reports.length,
    findings: reports.flatMap((r) => r.findings.map((f) => ({ file: path.basename(r.file), ...f }))),
  }, null, 2));
  process.exit(errorCount === 0 ? 0 : 1);
}

if (require.main === module) {
  try { main(); }
  catch (e) { console.error('FATAL', e.message); process.exit(2); }
}

module.exports = { lintOne, fromSpec, fromHtml };
