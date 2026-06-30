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
//     flow-error-path  every flow names an error / edge / unhappy path (or a decision w/ >=2 labeled outcomes)
//     event-spec-table an actual markdown table exists in the event-spec section
//     ac-gwt           acceptance-criteria are written as Given/When/Then scenarios (not vague mentions)
//     metric-shape     every success-metric line carries a number/target AND a named instrument
//   Structural floors (WARN — never fail the gate):
//     no-inventory     no screen/state inventory section to cross-check acceptance criteria against
//   Semantic heuristics (ERROR by default — they DO participate in the exit-1 gate; --lenient -> WARN):
//     actor-quality    an actor reads as fictional persona theatre ("Sarah, 32, loves lattes") with no
//                      job-to-be-done / goal / "needs to" / "trying to" clause tying it to a real task
//     flow-decision    a flow that claims error handling but contains no real decision/branch node
//                      (if/when/otherwise/실패/성공/조건/분기 or a >=2-outcome arrow branch list)
//
// Sections are detected from markdown headings (#..######) OR bold labels at line start (**Problem:**),
// so a plan written either way passes. Exit: 1 if any required section or structural ERROR is missing;
// 0 if the floor is met; 2 on fatal (bad args / unreadable file).
//
// FLAGS
//   (default)  the semantic heuristics (actor-quality, flow-decision) are ERROR and participate in the
//              exit-1 gate, so /plan gets the semantic teeth without needing an extra flag.
//   --lenient  downgrade those two heuristics back to WARN (the legacy behavior) so they never fail the
//              gate on their own — use when you want structure-only gating.
//   --strict   accepted for backward compatibility; it is now the default (a no-op), kept so existing
//              `--strict` invocations do not break.

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

function findSection(sections, re, opts) {
  // opts.last: prefer the LAST matching heading instead of the first. Required-section bodies
  // (e.g. acceptance-criteria) use this so an earlier flow heading that merely happens to match
  // the matcher does not shadow the real section's body.
  if (opts && opts.last) {
    for (let i = sections.length - 1; i >= 0; i--) {
      if (re.test(sections[i].title)) return sections[i];
    }
    return null;
  }
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
  { key: 'scope-out',           label: 'Scope — out',            re: /out[-\s]?of[-\s]?scope|out[-\s]?scope|scope[\s—:–-]+out\b|범위\s*제외|제외\s*범위/i, body: /out[-\s]?of[-\s]?scope|out[-\s]?scope|scope[\s—:–-]+out\b/i },
  { key: 'flows',               label: 'Flows',                  re: /\bflows?\b|user\s*journeys?|journeys?|시나리오/i },
  { key: 'acceptance-criteria', label: 'Acceptance criteria',    re: /acceptance|criteria|완료\s*기준|수용\s*기준/i },
  { key: 'event-spec',          label: 'Event spec',             re: /event[-\s]*spec|event\s*tracking|analytics\s*events?|tracking\s*plan|이벤트\s*스펙/i },
  { key: 'open-questions',      label: 'Open questions',         re: /open\s*questions?|risks?\s*(?:&|and)?\s*open|unknowns|미해결|열린\s*질문/i },
];

// ---------- structural extractors ----------
const ERROR_PATH = /\b(error|edge|edge[-\s]?case|unhappy|fail(?:ure|ed|s)?|invalid|empty|fallback|timeout|timed\s*out|offline|retry|denied|unauthorized|forbidden|not\s*found|expire[ds]?|revoke[ds]?|conflict|lock(?:ed)?|duplicate|cancel(?:l?ed|s)?|예외|에러|오류|실패|만료|취소|중복|충돌)\b/i;

// A decision node that enumerates >=2 labeled outcomes covers an edge/error branch even without the
// literal word "error" — this matches the skill's own "→" branch notation. We only count it when an
// explicit decision marker (?, if/else, 분기/조건, an outcome pair) is present, so a plain linear
// "A → B → C" chain is NOT mistaken for a branch.
const DECISION_MARK = /\?|\bif\b|\belse\b|otherwise|분기|조건/i;
const OUTCOME_PAIR = /(성공\s*\/\s*실패|실패\s*\/\s*성공|yes\s*\/\s*no|pass\s*\/\s*fail|success\s*\/\s*(?:fail(?:ure)?|error))/i;
function hasBranchOutcomes(text) {
  if (!text) return false;
  if (OUTCOME_PAIR.test(text)) return true;            // two labeled outcomes spelled out
  const arrows = (text.match(/→|->|=>/g) || []).length;
  return DECISION_MARK.test(text) && arrows >= 2;       // a decision with >=2 arrow-labeled outcomes
}

// A "real" decision/branch node inside a SINGLE flow. Broader than hasBranchOutcomes (which gates the
// section-level error-path floor): a flow that names a decision marker (if/when/else/otherwise/unless/
// 분기/조건/실패/성공), spells out an explicit outcome pair, OR lists >=2 arrow-labeled branch items
// ("- unauthorized → …" on >=2 lines) has a genuine branch. A flow that merely asserts "errors are
// handled" — one error keyword, zero branch structure — does NOT, and is what flow-decision flags.
const DECISION_NODE_MARK = /\bif\b|\bwhen\b|\belse\b|otherwise|\bunless\b|\bdepending\b|분기|조건|실패|성공/i;
function hasDecisionNode(text) {
  if (!text) return false;
  if (DECISION_NODE_MARK.test(text)) return true;
  if (OUTCOME_PAIR.test(text)) return true;
  // branch list: >=2 list items that each carry an outcome arrow (distinct from a single linear chain)
  const arrowItems = text.split(/\r?\n/).filter((l) => /^\s*(?:[-*]|\d+[.)]).*(?:→|->|=>)/.test(l)).length;
  if (arrowItems >= 2) return true;
  return false;
}

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

// Pull screen/state names out of the inventory section: list items or table rows.
// For a markdown table the screen name is NOT always the first cell — the skill's own §7 inventory
// template leads with a "#" index column ("| # | Screen | Route | … |"), so reading cell 0 yields the
// index ("1", "2"), which the length>=2 filter then drops, collapsing the table to ZERO screens and
// silently downgrading the inventory↔AC ERROR check to a no-inventory WARN. So we choose the NAME
// column deterministically: (1) the header cell matching /screen|view|화면|상태|state|name|surface|page/;
// else (2) if every data row's first cell is a pure integer or "#", advance past that index column;
// else (3) the first cell (original behavior).
const INV_NAME_HEADER = /screen|view|화면|상태|state|name|surface|page/i;
const INV_INDEX_CELL = /^(?:#|\d+)$/;                                  // an index/number cell, not a name
const INV_HEADER_CELL = /^(?:#|no\.?|idx|index|번호|screen|state|name|view|화면|상태)$/i; // a header row's name cell

function extractInventory(sections) {
  const inv = findSection(sections, /\binventory\b|screen[\s/&,-]*state|state[\s/&,-]*inventory|screen\s*list|surface\s*inventory|화면\s*목록/i);
  if (!inv) return { found: false, items: [] };
  const rows = inv.body.split(/\r?\n/);

  // Decide the name column from the FIRST markdown table in the inventory body.
  const tableRows = rows
    .map((l) => l.trim())
    .filter((l) => /^\|/.test(l) && !/^\|[\s:|-]+\|?$/.test(l))
    .map((l) => l.split('|').map((c) => c.trim()).filter(Boolean))
    .filter((cells) => cells.length);
  let nameCol = 0;
  if (tableRows.length) {
    const byHeader = tableRows[0].findIndex((c) => INV_NAME_HEADER.test(c));
    if (byHeader >= 0) {
      nameCol = byHeader;
    } else if (tableRows.length > 1 && tableRows.slice(1).every((cells) => INV_INDEX_CELL.test(cells[0]))) {
      nameCol = 1; // no name header, but every data row leads with an index → name is the next cell
    }
  }

  const items = [];
  for (const raw of rows) {
    const line = raw.trim();
    if (!line) continue;
    // markdown table row (skip the |---| separator and the header row heuristically)
    if (/^\|/.test(line)) {
      if (/^\|[\s:|-]+\|?$/.test(line)) continue;
      const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
      if (!cells.length) continue;
      let cell = cells[nameCol];
      // ragged row, or an index leaked into the chosen column → fall back to the next non-index cell.
      if (!cell || INV_INDEX_CELL.test(cell)) {
        cell = cells.find((c, i) => i >= nameCol && c && !INV_INDEX_CELL.test(c)) || cells[0];
      }
      if (!cell || INV_HEADER_CELL.test(cell)) continue; // header row
      items.push(cell);
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

// Given/When/Then floor: AC must be expressed as behavioural scenarios, not vague mentions.
const GWT = /\bgiven\b[\s\S]{0,600}?\bwhen\b[\s\S]{0,600}?\bthen\b/i;

// What a success-metric line must carry to be measurable: a number/target AND a named instrument.
const METRIC_INSTRUMENT = /posthog|mixpanel|amplitude|google\s*analytics|\bga4?\b|\banalytics\b|dashboard|funnel|\bevent\b|tracking|\bquery\b|\bsql\b|metabase|looker|tableau|survey|cohort|\breport\b|측정|대시보드|이벤트|지표\s*출처|쿼리|설문/i;

// A prose line reads as a success-metric line when it carries one of the canonical metric framings.
// The suite's own FRAME / PRD skeletons write the success metric as a prose sentence
// ("North-star: … target … measured by …") rather than a list item or table row.
const PROSE_METRIC = /north[\s-]?star|guardrail|measured[\s-]?by|\btarget\b|목표|지표|\bKPI\b/i;

// Pull metric lines out of a success-metrics section body: list items OR table data rows.
// Prose fallback: if no list/table metric lines are present, the skeletons often write the metric as a
// plain prose sentence — extract any such line so a template-style PRD is judged on its content, not its
// formatting. When the fallback fires, the returned array is tagged `.prose = true` so callers can say so.
function metricLines(body) {
  if (!body) return [];
  const out = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^\|/.test(line)) {
      if (/^\|[\s:|-]+\|?$/.test(line)) continue; // separator row
      const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
      if (!cells.length) continue;
      if (/^(metric|kpi|measure|지표|목표|target|source|instrument|출처)$/i.test(cells[0])) continue; // header
      out.push(cells.join(' '));
      continue;
    }
    const li = line.match(/^(?:[-*]|\d+[.)])\s+(.*\S)/);
    if (li) out.push(li[1]);
  }
  if (out.length === 0) {
    for (const raw of body.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      if (PROSE_METRIC.test(line)) out.push(line.replace(/^(?:\*\*|__)?/, '').trim());
    }
    if (out.length) out.prose = true;
  }
  return out;
}

function hasMarkdownTable(body) {
  if (!body) return false;
  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length - 1; i++) {
    if (/\|.*\|/.test(lines[i]) && /^\s*\|?[\s:|-]*-{2,}[\s:|-]*\|/.test(lines[i + 1])) return true;
  }
  return false;
}

// ---------- actor-quality (semantic) ----------
// Persona theatre = a "Capitalized first name, age" stage character ("Sarah, 32") or demographic fluff
// (loves/lives in/married/coffee/years old …). A REAL actor instead states a job-to-be-done — what it
// is trying to accomplish ("needs to cancel before shipping", "trying to …", "goal: …", 목표/필요/하려).
const PERSONA_THEATRE = /\b[A-Z][a-z]+,\s*\d{1,2}\b/;            // "Sarah, 32"
const ACTOR_FLUFF = /\bloves?\b|\benjoys?\b|\bmarried\b|\bsingle\b|\blives?\s+in\b|\bfavou?rite\b|\bhobby\b|\bhobbies\b|\blatt[eé]s?\b|\bcoffee\b|\byears?\s*old\b|\bborn\s+in\b/i;
const ACTOR_JTBD = /\bneeds?\s+to\b|\btrying\s+to\b|\bwants?\s+to\b|\bwould\s+like\s+to\b|\bin\s+order\s+to\b|\bso\s+(?:that|they|he|she|i|we)\b|job[\s-]*to[\s-]*be[\s-]*done|\bjtbd\b|\bgoals?\b|\bin\s+order\b|하려|하고\s*싶|필요|목표/i;

// Pull discrete actor entries out of the users section: child sub-headings (their title+body), else
// list items, else the whole body as a single entry. Each entry is judged on its own text so one real
// actor's job clause cannot launder a sibling persona-theatre entry.
function extractActors(sections, usersSection) {
  if (!usersSection) return [];
  const children = sections.filter((s) => s.line > usersSection.line && s.line < usersSection.end && s.level === usersSection.level + 1);
  if (children.length) return children.map((c) => ({ name: c.title, text: `${c.title}\n${c.body}` }));
  const entries = [];
  for (const raw of usersSection.body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const li = line.match(/^(?:[-*]|\d+[.)])\s+(.*\S)/);
    if (li) entries.push({ name: li[1].slice(0, 60), text: li[1] });
  }
  if (entries.length === 0 && usersSection.body.trim()) entries.push({ name: '(users section)', text: usersSection.body });
  return entries;
}

// ---------- the lint ----------
function lintPlan(md, file, opts) {
  // Semantic heuristics (actor-quality, flow-decision) are ERROR by DEFAULT for BOTH the CLI and any
  // module consumer, so they participate in the exit-1 gate without a flag. opts.lenient (CLI --lenient)
  // downgrades them back to WARN (the legacy behavior). opts.strict is accepted for back-compat (no-op).
  const strict = !(opts && opts.lenient);
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

  // 3) the flows section names an error / edge path.
  // Coverage is evaluated across the WHOLE flows section, not per sub-flow: the suite's own template
  // splits a flow into happy-path and error-path SIBLING H3s, so penalizing the happy-path H3 for not
  // naming an error within itself is wrong. The section as a whole must name an error/edge/unhappy path
  // (or a decision with >=2 labeled outcomes). flowsSection.body already includes every child H3's body.
  const flowsSection = findSection(sections, REQUIRED.find((r) => r.key === 'flows').re);
  const flows = extractFlows(sections, flowsSection);
  if (flows.length === 0) {
    add('flow-error-path', 'Flows name an error/edge path', 'error', false, 'no discrete flows found to check');
  } else {
    const covered = ERROR_PATH.test(flowsSection.body) || hasBranchOutcomes(flowsSection.body);
    add('flow-error-path', 'Flows name an error/edge path', 'error', covered,
      covered ? '' : 'no error/edge/unhappy path named anywhere in the flows section');
  }

  // 4) inventory -> acceptance criteria cross-check
  const inv = extractInventory(sections);
  const acSection = findSection(sections, REQUIRED.find((r) => r.key === 'acceptance-criteria').re, { last: true });
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

  // 5) acceptance criteria must have real Given/When/Then structure (only when the section exists —
  // a missing AC section is already an error above; don't double-penalize).
  if (acSection) {
    add('ac-gwt', 'Acceptance criteria use Given/When/Then', 'error', GWT.test(acSection.body),
      GWT.test(acSection.body) ? '' : 'no Given/When/Then scenario found — acceptance criteria are vague, not testable');
  }

  // 6) each success-metric line must carry a number/target AND a named instrument (no vague "improve X").
  const smSection = findSection(sections, REQUIRED.find((r) => r.key === 'success-metrics').re);
  if (smSection) {
    const mlines = metricLines(smSection.body);
    const bad = mlines.filter((l) => !/\d/.test(l) || !METRIC_INSTRUMENT.test(l));
    const where = mlines.prose ? 'metrics found but not in a list/table; ' : '';
    if (mlines.length === 0) {
      add('metric-shape', 'Success metrics carry a number + instrument', 'error', false,
        'no metric lines parsed — success metrics need a number/target and a measurement instrument');
    } else {
      add('metric-shape', 'Success metrics carry a number + instrument', 'error', bad.length === 0,
        bad.length ? `${where}${bad.length}/${mlines.length} metric line(s) lack a number/target or instrument: ${bad.slice(0, 4).map((l) => `"${l.slice(0, 50)}"`).join(', ')}` : `${mlines.length} metric line(s) all measurable`);
    }
  }

  // 7) actor-quality (semantic): flag persona-theatre actors with no job-to-be-done clause.
  const usersSection = findSection(sections, REQUIRED.find((r) => r.key === 'users').re);
  const actors = extractActors(sections, usersSection);
  if (actors.length) {
    const theatre = actors.filter((a) => (PERSONA_THEATRE.test(a.text) || ACTOR_FLUFF.test(a.text)) && !ACTOR_JTBD.test(a.text));
    add('actor-quality', 'Actors state a job-to-be-done (not persona theatre)', strict ? 'error' : 'warn', theatre.length === 0,
      theatre.length ? `${theatre.length}/${actors.length} actor(s) read as persona theatre without a job/goal ("needs to"/"trying to"/goal): ${theatre.slice(0, 4).map((a) => `"${a.name.slice(0, 40)}"`).join(', ')}` : `${actors.length} actor(s) tie to a job/goal`);
  }

  // 8) flow-decision (semantic): a flow that CLAIMS error handling must carry a real decision/branch
  // node, not merely one error keyword ("errors are handled").
  if (flows.length) {
    const noBranch = flows.filter((f) => ERROR_PATH.test(f.text) && !hasDecisionNode(f.text));
    add('flow-decision', 'Flows that claim error handling have a real decision/branch node', strict ? 'error' : 'warn', noBranch.length === 0,
      noBranch.length ? `${noBranch.length}/${flows.length} flow(s) name an error but have no branch structure (if/when/otherwise/실패/성공/조건/분기 or a >=2-outcome arrow list): ${noBranch.slice(0, 4).map((f) => `"${f.name.slice(0, 40)}"`).join(', ')}` : `${flows.length} flow(s) with error handling carry a decision node`);
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
  node plan-lint.js <plan.md> --lenient  downgrade semantic heuristics (actor/flow) back to WARN
  node plan-lint.js --help

REQUIRED SECTIONS (ERROR -> exit 1)
  problem · goals · non-goals · users · success-metrics · scope-in · scope-out ·
  flows · acceptance-criteria · event-spec · open-questions
STRUCTURAL FLOORS
  event-spec-table ERROR · flow-error-path ERROR · inventory-ac ERROR ·
  ac-gwt ERROR (Given/When/Then) · metric-shape ERROR (number + instrument) · no-inventory WARN
SEMANTIC HEURISTICS (ERROR by default — participate in the gate; --lenient -> WARN)
  actor-quality (persona theatre w/o a job-to-be-done) · flow-decision (error claim w/o a branch node)
Exit 1 if any required section / structural ERROR is missing; 0 if the floor is met; 2 on fatal.
`;

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(HELP);
    process.exit(argv.length === 0 ? 1 : 0);
  }
  // Semantic heuristics are ERROR by DEFAULT (they participate in the exit-1 gate). --lenient
  // restores the legacy WARN-only behavior; --strict is still accepted (now the default) for back-compat.
  const lenient = argv.includes('--lenient');
  const positional = argv.filter((a) => !a.startsWith('-'));
  const target = positional[0];
  const outArg = positional[1];
  if (!target) { console.error('FATAL no plan file given'); process.exit(2); }
  const md = fs.readFileSync(target, 'utf8');
  const report = lintPlan(md, require('path').resolve(target), { lenient });

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

module.exports = { lintPlan, parseSections, extractFlows, extractInventory, extractActors, hasMarkdownTable, hasDecisionNode };
