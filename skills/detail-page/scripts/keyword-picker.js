// keyword-picker.js — the design-keyword SELECTION engine.
// No deps (Node fs + regex only). Reads scripts/design-lexicon.json and, given a section +
// a target FEELING/mood (+ optional domains), emits the concrete, named design keywords a
// designer would reach for — plus a paste-ready "design directive" and the AI-center moves to
// AVOID for that slot. This is the positive-vocabulary counterpart to brand-lint.js: brand-lint
// says what is banned; this says what to reach for INSTEAD, per section, so the build is forced
// to be specific rather than reverting to the generic ("bold" == mono-label + acid-green) center.
//
// WHY THIS EXISTS: without an explicit keyword per section, a model samples the high-probability
// centre of "bold design", which is itself now an AI tell. Naming a concrete technique
// (e.g. "duotone photographic ground", "condensed grotesque at 12rem", "scrub-linked reveal")
// pushes the output off that centre. See references/anti-ai-tells.md and references/design-process.md.
//
// Usage:
//   node keyword-picker.js sections                         # list section keys + purposes
//   node keyword-picker.js moods                            # list the controlled mood vocabulary
//   node keyword-picker.js domains                          # list lexicon domains + term counts
//   node keyword-picker.js search <query>                   # grep the lexicon (en/ko/def/effect)
//   node keyword-picker.js pick  --section hero --mood urgent,editorial [--domain type,color] [--n 8] [--json]
//   node keyword-picker.js plan  --mode detail|landing [--moods "hero:urgent,editorial; proof:credible"] [--json]
//
// `pick` returns the ranked keyword set + a directive for ONE slot.
// `plan` walks the whole section arc for a mode and emits a per-section directive block — the
//   "section x feeling x effect" plan skeleton the design process (step 4-6) is built around.
//
// Output is human-readable by default; add --json for a machine object (for the ultracode workflow).
// Off-by-default: nothing imports it; it is a planning aid, run by hand or by the workflow.

const fs = require('fs');
const path = require('path');

const DATA_PATH = process.env.LEXICON_PATH || path.join(__dirname, 'design-lexicon.json');

function loadLexicon() {
  let raw;
  try {
    raw = fs.readFileSync(DATA_PATH, 'utf8');
  } catch (e) {
    fail(`cannot read lexicon at ${DATA_PATH} (${e.code}). Expected scripts/design-lexicon.json.`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    fail(`design-lexicon.json is not valid JSON: ${e.message}`);
  }
  data.terms = Array.isArray(data.terms) ? data.terms : [];
  data.sectionFeelings = data.sectionFeelings || {};
  data.moods = Array.isArray(data.moods) ? data.moods : [];
  data.antiTells = Array.isArray(data.antiTells) ? data.antiTells : [];
  data.sectionArcs = data.sectionArcs || {};
  // index terms by id for fast lookup
  data._byId = new Map(data.terms.map((t) => [t.id, t]));
  return data;
}

function fail(msg) {
  process.stderr.write(`keyword-picker: ${msg}\n`);
  process.exit(1);
}

// --- arg parsing (tiny; supports `--flag value` and `--flag=value` and bare words) ---
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        out[a.slice(2, eq)] = a.slice(eq + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        out[a.slice(2)] = argv[++i];
      } else {
        out[a.slice(2)] = true;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

const csv = (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : []);
const ANTI_RANK = { HIGH: 3, MED: 2, LOW: 1 };

// --- scoring: how well a term fits a (section, moods, domains) request ---
function scoreTerm(term, { section, moods, domains }) {
  let s = 0;
  const tSections = (term.sections || []).map((x) => String(x).toLowerCase());
  const tMoods = (term.moods || []).map((x) => String(x).toLowerCase());
  const tDomain = String(term.domain || '').toLowerCase();

  if (section) {
    if (tSections.includes(section)) s += 4;
    else if (tSections.includes('any') || tSections.length === 0) s += 1; // general-purpose term
    else return -1; // explicitly scoped to other sections → exclude
  }
  if (moods && moods.length) {
    const hits = moods.filter((m) => tMoods.includes(m)).length;
    if (hits === 0 && tMoods.length) s -= 1; // has moods but none match → gentle penalty, not exclusion
    s += hits * 3;
  }
  if (domains && domains.length) {
    if (domains.includes(tDomain)) s += 2;
    else return -1; // domain filter is exclusive when given
  }
  s += ANTI_RANK[String(term.anti_ai || 'MED').toUpperCase()] || 2; // prefer high anti-AI value
  return s;
}

function rankTerms(lex, req, n) {
  return lex.terms
    .map((t) => ({ t, score: scoreTerm(t, req) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score || (ANTI_RANK[b.t.anti_ai] || 2) - (ANTI_RANK[a.t.anti_ai] || 2))
    .slice(0, n)
    .map((x) => x.t);
}

// --- the AI-center moves to avoid for a slot (from antiTells, filtered to the section) ---
function avoidFor(lex, section) {
  const rel = lex.antiTells.filter((a) => !a.sections || a.sections.includes(section) || a.sections.includes('any'));
  const pool = rel.length ? rel : lex.antiTells;
  return pool.slice(0, 4).map((a) => a.tell);
}

// --- render one slot directive (human string) ---
function directive(lex, section, moods, terms) {
  const meta = lex.sectionFeelings[section] || {};
  const label = (meta.label || section).toUpperCase();
  const feelWord = moods.length ? moods.join(' + ') : (meta.feelings || []).map((f) => f.feeling).slice(0, 2).join(' + ') || '—';
  const reach = terms.map((t) => `{${t.en}${t.ko ? ' / ' + t.ko : ''}}`).join(', ') || '(no match — widen mood/domain)';
  const avoid = avoidFor(lex, section).map((a) => `{${a}}`).join(', ');
  const sig = terms.find((t) => (t.anti_ai || '').toUpperCase() === 'HIGH');
  const lines = [];
  lines.push(`[${label} · feeling: ${feelWord}]`);
  if (meta.purpose) lines.push(`  purpose: ${meta.purpose}`);
  lines.push(`  REACH FOR: ${reach}`);
  if (avoid) lines.push(`  AVOID (AI centre): ${avoid}`);
  if (sig) lines.push(`  signature candidate: ${sig.en} — ${sig.effect || ''}`.trim());
  return lines.join('\n');
}

// --- commands ---
function cmdSections(lex) {
  const keys = Object.keys(lex.sectionFeelings);
  if (!keys.length) return console.log('(no sectionFeelings in lexicon)');
  for (const k of keys) {
    const m = lex.sectionFeelings[k];
    console.log(`${k.padEnd(16)} ${m.label || ''} — ${m.purpose || ''}`);
  }
}
function cmdMoods(lex) {
  console.log(lex.moods.length ? lex.moods.join(', ') : '(no moods vocabulary in lexicon)');
}
function cmdDomains(lex) {
  const counts = {};
  for (const t of lex.terms) counts[t.domain] = (counts[t.domain] || 0) + 1;
  for (const d of Object.keys(counts).sort()) console.log(`${d.padEnd(20)} ${counts[d]}`);
  console.log(`\ntotal terms: ${lex.terms.length}`);
}
function cmdSearch(lex, q) {
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const hits = lex.terms.filter((t) => rx.test([t.en, t.ko, t.def, t.effect, t.use_when].filter(Boolean).join(' ')));
  if (!hits.length) return console.log(`no match for "${q}"`);
  for (const t of hits) console.log(`• ${t.en}${t.ko ? ' / ' + t.ko : ''} [${t.domain}, anti-AI:${t.anti_ai}] — ${t.effect || t.def}`);
}
function cmdPick(lex, args) {
  const section = (args.section || '').toLowerCase();
  const moods = csv(args.mood || args.moods);
  const domains = csv(args.domain || args.domains);
  const n = parseInt(args.n, 10) || 8;
  if (!section) fail('pick needs --section <key> (see `sections`)');
  if (!lex.sectionFeelings[section]) process.stderr.write(`keyword-picker: warning — "${section}" not in sectionFeelings; matching by term tags only.\n`);
  const terms = rankTerms(lex, { section, moods, domains }, n);
  if (args.json) {
    console.log(JSON.stringify({ section, moods, domains, avoid: avoidFor(lex, section), terms: terms.map((t) => ({ id: t.id, en: t.en, ko: t.ko, domain: t.domain, effect: t.effect, use_when: t.use_when, anti_ai: t.anti_ai })) }, null, 2));
  } else {
    console.log(directive(lex, section, moods, terms));
    console.log('');
    for (const t of terms) console.log(`  - ${t.en}${t.ko ? ' / ' + t.ko : ''} [${t.domain}] :: ${t.effect || t.def}  (when: ${t.use_when || '—'})`);
  }
}
// parse `--moods "hero:urgent,editorial; proof:credible"` into { hero:[...], proof:[...] }
function parseSlotMoods(str) {
  const map = {};
  if (typeof str !== 'string') return map;
  for (const chunk of str.split(';')) {
    const [sec, ms] = chunk.split(':');
    if (sec && ms) map[sec.trim().toLowerCase()] = csv(ms);
  }
  return map;
}
function cmdPlan(lex, args) {
  const mode = (args.mode || 'detail').toLowerCase();
  const arc = lex.sectionArcs[mode];
  if (!arc) fail(`no sectionArc for mode "${mode}" (have: ${Object.keys(lex.sectionArcs).join(', ') || 'none'})`);
  const slotMoods = parseSlotMoods(args.moods);
  const n = parseInt(args.n, 10) || 5;
  const out = [];
  for (const section of arc) {
    const moods = slotMoods[section] || [];
    const terms = rankTerms(lex, { section, moods, domains: [] }, n);
    out.push({ section, moods, terms });
  }
  if (args.json) {
    console.log(JSON.stringify({ mode, slots: out.map((o) => ({ section: o.section, moods: o.moods, avoid: avoidFor(lex, o.section), terms: o.terms.map((t) => ({ id: t.id, en: t.en, ko: t.ko, domain: t.domain, effect: t.effect, anti_ai: t.anti_ai })) })) }, null, 2));
  } else {
    console.log(`# Section × Feeling × Effect plan — mode: ${mode}\n`);
    console.log('Give EACH section a DIFFERENT concrete keyword set. Uniformity across sections is the house-style tell.\n');
    for (const o of out) {
      console.log(directive(lex, o.section, o.moods, o.terms));
      console.log('');
    }
  }
}

function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').filter((l) => l.startsWith('//')).slice(0, 28).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    return;
  }
  const lex = loadLexicon();
  const args = parseArgs(argv.slice(1));
  switch (cmd) {
    case 'sections': return cmdSections(lex);
    case 'moods': return cmdMoods(lex);
    case 'domains': return cmdDomains(lex);
    case 'search': return cmdSearch(lex, argv.slice(1).join(' '));
    case 'pick': return cmdPick(lex, args);
    case 'plan': return cmdPlan(lex, args);
    default: fail(`unknown command "${cmd}" (try: sections | moods | domains | search | pick | plan)`);
  }
}

main();
