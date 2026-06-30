// plan-lint.js — deterministic linter for a ux-flows PLAN / PRD markdown.
// No deps (Node fs + regex only). The PLAN is the one in-scope deliverable that has no machine floor —
// every other artifact (page HTML, brand tokens, email, A/B) already has a deterministic gate, but a
// plan/PRD was only ever judged by an LLM. This promotes the structural skeleton of a plan into a machine
// check so the gate doesn't depend on a grader's mood. This is the deterministic FLOOR UNDER
// design-critic MODE=plan: pass here first, THEN let the LLM judge quality. Off-by-default (nothing imports it).
//
// Usage:   node plan-lint.js <plan.md>                 # lint one plan/PRD
//          node plan-lint.js <plan.md> [out.json]      # also write the JSON report
//          node plan-lint.js --help
//
// WHAT IT CHECKS
//   Required sections present (ERROR if missing — these fail the gate, exit 1):
//     problem · goals · non-goals · users · success-metrics · scope-in · scope-out ·
//     flows · acceptance-criteria · event-spec · open-questions
//   Structural floors (ERROR):
//     inventory-ac     every screen/state named in the inventory is referenced in acceptance-criteria
//     flow-error-path  every flow names an error / edge / unhappy path
//     event-spec-table an actual markdown table exists in the event-spec section
//   Structural floors (WARN — never fail the gate):
//     no-inventory     no screen/state inventory section to cross-check acceptance criteria against
//
// Sections are detected from markdown headings (#..######) OR bold labels at line start (**Problem:**),
// so a plan written either way passes. Exit: 1 if any required section or structural ERROR is missing;
// 0 if the floor is met; 2 on fatal (bad args / unreadable file).

const fs = require('fs');

// ---------- markdown -> sections ----------
// A "section" = a heading and the body lines up to the next heading of same-or-higher level.
function parseSections(md) {
  const lines = md.split(/\r?\n/);
  const heads = [];
  lines.forEach((line, i) => {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (m) heads.push({ level: m[1].length, title: m[2].trim(), line: i });
  });
  return heads.map((h, idx) => {
    let end = lines.length;
    for (let j = idx + 1; j < heads.length; j++) {
      if (heads[j].level <= h.level) { end = heads[j].line; break; }
    }
    return { level: h.level, title: h.title, line: h.line, end, body: lines.slice(h.line + 1, end).join('\n') };
  });
}

// Bold labels used as pseudo-headings: a line that is (mostly) a single **Bold** / __Bold__ label.
function boldLabels(md) {
  const out = [];
  for (const line of md.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:[-*]\s+)?(?:\*\*|__)([^*_]{2,60})(?:\*\*|__)\s*:?\s*$/);
    if (m) out.push(m[1].trim());
  }
  return out;
}

function findSection(sections, re) {
  return sections.find((s) => re.test(s.title)) || null;
}

// ---------- required-section matchers ----------
// Each: { key, label, re }. Presence is tested against the label corpus (headings + bold labels);
// scope-in / scope-out also fall back to body text since they are often inline ("In scope: …").
const REQUIRED = [
  { key: 'problem',             label: 'Problem / context',      re: /\bproblem\b|문제|background|context|motivation/i },
  { key: 'goals',               label: 'Goals',                  re: /\bgoals?\b|objectives?|목표/i },
  { key: 'non-goals',           label: 'Non-goals',              re: /non[-\s]?goals?|out of scope for now|범위\s*제외|비목표/i },
  { key: 'users',               label: 'Users / audience',       re: /\busers?\b|personas?|audience|사용자|대상/i },
  { key: 'success-metrics',     label: 'Success metrics',        re: /success\s*metrics?|\bmetrics?\b|\bKPIs?\b|north\s*star|성공\s*지표/i },
  { key: 'scope-in',            label: 'Scope — in',             re: /in[-\s]?scope|scope\b.*\bin\b|포함\s*범위/i, body: /in[-\s]?scope|scope\s*:?\s*\n?\s*(?:[-*]|in\b)/i },
  { key: 'scope-out',           label: 'Scope — out',            re: /out[-\s]?of[-\s]?scope|out[-\s]?scope|범위\s*제외|제외\s*범위/i, body: /out[-\s]?of[-\s]?scope|out[-\s]?scope/i },
  { key: 'flows',               label: 'Flows',                  re: /\bflows?\b|user\s*journeys?|journeys?|시나리오/i },
  { key: 'acceptance-criteria', label: 'Acceptance criteria',    re: /acceptance\s*criteria|accept(?:ance)?\b|완료\s*기준|수용\s*기준/i },
  { key: 'event-spec',          label: 'Event spec',             re: /event[-\s]*spec|event\s*tracking|analytics\s*events?|tracking\s*plan|이벤트\s*스펙/i },
  { key: 'open-questions',      label: 'Open questions',         re: /open\s*questions?|risks?\s*(?:&|and)?\s*open|unknowns|미해결|열린\s*질문/i },
];

// ---------- structural extractors ----------
const ERROR_PATH = /\b(error|edge|edge[-\s]?case|unhappy|fail(?:ure|ed|s)?|invalid|empty|fallback|timeout|offline|retry|denied|not\s*found|예외|에러|오류|실패)\b/i;

// Pull the discrete flows out of the flows section: prefer child headings, else top-level list items.
function extractFlows(sections, flowsSection) {
  if (!flowsSection) return [];
  const children = sections.filter((s) => s.line > flowsSection.line && s.line < flowsSection.end && s.level === flowsSection.level + 1);
  if (children.length) return children.map((c) => ({ name: c.title, text: c.body }));
  // else: top-level list items (- / * / 1.) — each item + its indented continuation lines is one flow.
  const lines = flowsSection.body.split(/\r?\n/);
  const flows = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^\s*(?:[-*]|\d+[.)])\s+(.*)$/);
    const indented = /^\s{2,}\S/.test(line) || /^\t+\S/.test(line);
    if (m && !indented) {
      if (cur) flows.push(cur);
      cur = { name: m[1].trim().slice(0, 80), text: line };
    } else if (cur) {
      cur.text += '\n' + line;
    }
  }
  if (cur) flows.push(cur);
  return flows;
}

// Pull screen/state names out of the inventory section: list items or table rows; first cell/token = name.
function extractInventory(sections) {
  const inv = findSection(sections, /\binventory\b|screen[\s/&,-]*state|state[\s/&,-]*inventory|screen\s*list|surface\s*inventory|화면\s*목록/i);
  if (!inv) return { found: false, items: [] };
  const items = [];
  for (const raw of inv.body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // markdown table row (skip the |---| separator and the header row heuristically)
    if (/^\|/.test(line)) {
      if (/^\|[\s:|-]+\|?$/.test(line)) continue;
      const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
      if (cells.length && !/^(screen|state|name|view|화면|상태)$/i.test(cells[0])) items.push(cells[0]);
      continue;
    }
    const li = line.match(/^(?:[-*]|\d+[.)])\s+(.*)$/);
    if (li) {
      // name = text before a colon/dash/parenthesis (e.g. "Checkout — empty state" -> "Checkout")
      const name = li[1].replace(/^\*\*|\*\*$/g, '').split(/\s[—–:-]\s|\s*\(/)[0].trim();
      if (name) items.push(name);
    }
  }
  return { found: true, items: [...new Set(items)].filter((n) => n.length >= 2) };
}

function hasMarkdownTable(body) {
  if (!body) return false;
  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length - 1; i++) {
    if (/\|.*\|/.test(lines[i]) && /^\s*\|?[\s:|-]*-{2,}[\s:|-]*\|/.test(lines[i + 1])) return true;
  }
  return false;
}

// ---------- the lint ----------
function lintPlan(md, file) {
  const sections = parseSections(md);
  const labelCorpus = [...sections.map((s) => s.title), ...boldLabels(md)].join('\n');
  const checks = []; // { key, label, severity, pass, detail }
  const add = (key, label, severity, pass, detail) => checks.push({ key, label, severity, pass, detail: detail || '' });

  // 1) required sections
  for (const r of REQUIRED) {
    const inLabels = r.re.test(labelCorpus);
    const inBody = r.body ? r.body.test(md) : false;
    add(r.key, r.label, 'error', inLabels || inBody, (inLabels || inBody) ? '' : 'section not found');
  }

  // 2) event-spec table
  const evSection = findSection(sections, REQUIRED.find((r) => r.key === 'event-spec').re);
  const evTable = evSection ? hasMarkdownTable(evSection.body) : hasMarkdownTable(md) && /event|track/i.test(md);
  add('event-spec-table', 'Event-spec table exists', 'error', !!evTable, evTable ? '' : 'no markdown table in the event-spec section');

  // 3) flows each name an error / edge path
  const flowsSection = findSection(sections, REQUIRED.find((r) => r.key === 'flows').re);
  const flows = extractFlows(sections, flowsSection);
  const flowsMissingError = flows.filter((f) => !ERROR_PATH.test(f.text));
  if (flows.length === 0) {
    add('flow-error-path', 'Every flow names an error/edge path', 'error', false, 'no discrete flows found to check');
  } else {
    add('flow-error-path', 'Every flow names an error/edge path', 'error', flowsMissingError.length === 0,
      flowsMissingError.length ? `${flowsMissingError.length} flow(s) lack an error/edge path: ${flowsMissingError.map((f) => `"${f.name}"`).slice(0, 5).join(', ')}` : '');
  }

  // 4) inventory -> acceptance criteria cross-check
  const inv = extractInventory(sections);
  const acSection = findSection(sections, REQUIRED.find((r) => r.key === 'acceptance-criteria').re);
  const acText = (acSection ? acSection.body : md).toLowerCase();
  if (!inv.found) {
    add('no-inventory', 'Screen/state inventory present', 'warn', false, 'no inventory section — cannot cross-check acceptance criteria coverage');
  } else if (inv.items.length === 0) {
    add('no-inventory', 'Screen/state inventory present', 'warn', false, 'inventory section found but no screens/states parsed');
  } else {
    const missing = inv.items.filter((name) => !acText.includes(name.toLowerCase()));
    add('inventory-ac', 'Every inventory screen/state has acceptance criteria', 'error', missing.length === 0,
      missing.length ? `${missing.length}/${inv.items.length} screen(s)/state(s) absent from acceptance criteria: ${missing.slice(0, 6).map((n) => `"${n}"`).join(', ')}` : `${inv.items.length} screen(s)/state(s) all referenced`);
  }

  const errorFails = checks.filter((c) => c.severity === 'error' && !c.pass);
  const warnFails = checks.filter((c) => c.severity === 'warn' && !c.pass);
  return {
    file,
    pass: errorFails.length === 0,
    errorCount: errorFails.length,
    warnCount: warnFails.length,
    sectionCount: sections.length,
    flowCount: flows.length,
    inventoryItems: inv.items,
    checks,
  };
}

// ---------- cli ----------
const HELP = `plan-lint.js — deterministic floor under design-critic MODE=plan (lints a ux-flows PLAN/PRD .md).

USAGE
  node plan-lint.js <plan.md>            lint one plan/PRD
  node plan-lint.js <plan.md> [out.json] also write the JSON report
  node plan-lint.js --help

REQUIRED SECTIONS (ERROR -> exit 1)
  problem · goals · non-goals · users · success-metrics · scope-in · scope-out ·
  flows · acceptance-criteria · event-spec · open-questions
STRUCTURAL FLOORS
  event-spec-table ERROR · flow-error-path ERROR · inventory-ac ERROR · no-inventory WARN
Exit 1 if any required section / structural ERROR is missing; 0 if the floor is met; 2 on fatal.
`;

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(HELP);
    process.exit(argv.length === 0 ? 1 : 0);
  }
  const target = argv[0];
  const outArg = argv[1];
  const md = fs.readFileSync(target, 'utf8');
  const report = lintPlan(md, require('path').resolve(target));

  if (outArg) fs.writeFileSync(outArg, JSON.stringify(report, null, 2));

  // human-readable checklist
  const mark = (c) => (c.pass ? 'PASS' : (c.severity === 'error' ? 'FAIL' : 'WARN'));
  console.log(`plan-lint  ${report.pass ? 'PASS' : 'FAIL'}  (${report.errorCount} error, ${report.warnCount} warn)  ${report.file}`);
  for (const c of report.checks) {
    console.log(`  [${mark(c).padEnd(4)}] ${c.label}${c.detail ? ' — ' + c.detail : ''}`);
  }
  process.exit(report.errorCount === 0 ? 0 : 1);
}

if (require.main === module) {
  try { main(); }
  catch (e) { console.error('FATAL', e.message); process.exit(2); }
}

module.exports = { lintPlan, parseSections, extractFlows, extractInventory, hasMarkdownTable };
