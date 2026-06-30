// name-check.js — deterministic brand-naming conflict helper. No deps (Node 20 global fetch only).
// Given a candidate name, it checks DOMAIN availability authoritatively via RDAP, makes a best-effort
// attempt at handle/package conflicts, and ALWAYS leaves a documented manual-check list for the things
// that have no reliable free API (trademarks). It never crashes on a network failure — an unreachable
// check degrades to result "unknown" (or "manual") so the report is still complete and exit 0.
//
// Usage:   node name-check.js <name>                  # check .com/.co/.io + handles + manual list
//          node name-check.js <name> [out.json]       # also write conflicts.json here (default /tmp/name-check/conflicts.json)
//          node name-check.js <name> --tlds com,io,app # override the domain TLD set
//          node name-check.js <name> --domains-only    # skip handle/package/trademark probes
//          node name-check.js --help
// <name> may be bare ("acme") or include a TLD ("acme.com") — the TLD is stripped to the base label.
//
// conflicts.json shape: { name, checkedAt, conflicts: [ { name, check, result, source } ] }
//   check  : "domain:.com" | "domain:.co" | "domain:.io" | "handle:github" | "package:npm" | "trademark:uspto" | ...
//   result : "taken" | "available" | "unknown" | "manual"
//   source : the exact URL queried (or to query manually)
//
// RDAP semantics: HTTP 200 => registered (taken). HTTP 404 is only "available" when it comes from a real
// RDAP server (content-type application/rdap+json or application/json) — rdap.org follows a 302 to the
// authoritative registry which answers 404 "no such domain". A 404 served as text/html directly by
// rdap.org means the TLD is NOT in its bootstrap (e.g. some ccTLDs) — that is "unknown", NOT "available",
// so we never falsely greenlight a name. Anything else / network error => unknown. Exit 0 always
// (this is a report helper, not a gate); 2 only on a usage error.

const fs = require('fs');
const path = require('path');

const DEFAULT_TLDS = ['com', 'co', 'io'];
const TIMEOUT_MS = 8000;
const UA = 'name-check/1.0 (+detail-page skill brand-naming helper)';

function timed() { try { return AbortSignal.timeout(TIMEOUT_MS); } catch (_) { return undefined; } }

// status: 'taken' | 'available' | 'unknown' + the http status / error for logging
async function probe(url, { takenOn200 = true } = {}) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, redirect: 'follow', signal: timed() });
    if (res.status === 200 && takenOn200) return { result: 'taken', http: 200 };
    if (res.status === 404) {
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      // an authoritative RDAP/JSON 404 = genuinely not registered; an html 404 = no endpoint coverage.
      if (ct.includes('json')) return { result: 'available', http: 404 };
      return { result: 'unknown', http: 404, note: 'no RDAP coverage for this TLD (rdap.org bootstrap) — check manually' };
    }
    if (res.status === 429) return { result: 'unknown', http: 429, note: 'rate-limited' };
    return { result: 'unknown', http: res.status };
  } catch (e) {
    return { result: 'unknown', error: e && e.name === 'TimeoutError' ? 'timeout' : (e && e.message) || 'fetch failed' };
  }
}

async function checkDomain(base, tld) {
  const source = `https://rdap.org/domain/${base}.${tld}`;
  const r = await probe(source);
  return { name: `${base}.${tld}`, check: `domain:.${tld}`, result: r.result, source, http: r.http, error: r.error, note: r.note };
}

async function checkGithubHandle(base) {
  // api.github.com/users/<name>: 404 => handle free, 200 => taken. Public, unauthenticated (rate-limited 60/hr).
  const source = `https://api.github.com/users/${encodeURIComponent(base)}`;
  const r = await probe(source);
  return { name: base, check: 'handle:github', result: r.result, source, http: r.http, error: r.error, note: r.note };
}

async function checkNpmPackage(base) {
  // registry.npmjs.org/<name>: 404 => package name free, 200 => taken. Public.
  const source = `https://registry.npmjs.org/${encodeURIComponent(base.toLowerCase())}`;
  const r = await probe(source);
  return { name: base, check: 'package:npm', result: r.result, source, http: r.http, error: r.error, note: r.note };
}

// Trademark: there is no reliable free programmatic availability API. We make a best-effort reachability
// attempt at the public USPTO trademark search UI, then ALWAYS record it as a manual-check item with the
// exact search URLs — so the report documents the conflict surface without ever fabricating a verdict.
async function checkTrademark(base) {
  const usptoSearch = `https://tmsearch.uspto.gov/search/search-information`;
  let reach = 'unknown';
  try {
    const res = await fetch(usptoSearch, { method: 'HEAD', headers: { 'User-Agent': UA }, signal: timed() });
    reach = res.ok || res.status < 500 ? 'reachable' : 'unreachable';
  } catch (_) { reach = 'unreachable'; }
  return [
    { name: base, check: 'trademark:uspto', result: 'manual', source: 'https://tmsearch.uspto.gov/', note: `USPTO TESS — search manually (probe: ${reach})` },
    { name: base, check: 'trademark:wipo',  result: 'manual', source: `https://branddb.wipo.int/en/quicksearch?q=${encodeURIComponent(base)}`, note: 'WIPO Global Brand DB — search manually' },
    { name: base, check: 'trademark:euipo', result: 'manual', source: 'https://www.tmdn.org/tmview/', note: 'EUIPO TMview — search manually' },
  ];
}

function parseArgs(argv) {
  const opt = { tlds: DEFAULT_TLDS.slice(), domainsOnly: false, out: null, name: null };
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tlds') {
      const v = argv[++i];
      if (!v) throw new Error('--tlds needs a comma-list');
      opt.tlds = v.split(',').map((s) => s.trim().replace(/^\./, '')).filter(Boolean);
    } else if (a === '--domains-only') {
      opt.domainsOnly = true;
    } else {
      pos.push(a);
    }
  }
  opt.name = pos[0];
  opt.out = pos[1] || '/tmp/name-check/conflicts.json';
  return opt;
}

const HELP = `name-check.js — brand-naming conflict helper (RDAP domains + best-effort handles + manual trademark list).

USAGE
  node name-check.js <name>                check .com/.co/.io domains + github/npm + trademark manual list
  node name-check.js <name> [out.json]     also write conflicts.json (default /tmp/name-check/conflicts.json)
  node name-check.js <name> --tlds com,io  override the domain TLD set
  node name-check.js <name> --domains-only skip handle/package/trademark probes
  node name-check.js --help

RESULT values: taken | available | unknown (unreachable) | manual (no free API — URL to check by hand).
Exit 0 always (report helper, not a gate); 2 on usage error.
`;

async function run(name, opt) {
  const base = String(name).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').split('.')[0].replace(/[^a-z0-9-]/g, '');
  if (!base) throw new Error(`could not derive a base name from "${name}"`);

  const conflicts = [];
  // domains (authoritative, run in parallel)
  const domainResults = await Promise.all(opt.tlds.map((tld) => checkDomain(base, tld)));
  conflicts.push(...domainResults);

  if (!opt.domainsOnly) {
    const [gh, npmPkg, tm] = await Promise.all([
      checkGithubHandle(base),
      checkNpmPackage(base),
      checkTrademark(base),
    ]);
    conflicts.push(gh, npmPkg, ...tm);
  }

  return {
    name: base,
    input: name,
    checkedAt: new Date().toISOString(),
    summary: {
      domainsTaken: conflicts.filter((c) => c.check.startsWith('domain') && c.result === 'taken').map((c) => c.name),
      domainsAvailable: conflicts.filter((c) => c.check.startsWith('domain') && c.result === 'available').map((c) => c.name),
      unknown: conflicts.filter((c) => c.result === 'unknown').map((c) => c.check),
      manual: conflicts.filter((c) => c.result === 'manual').map((c) => c.check),
    },
    // conflicts.json carries exactly the requested {name, check, result, source} (extra diag fields are additive)
    conflicts: conflicts.map((c) => ({ name: c.name, check: c.check, result: c.result, source: c.source, ...(c.http ? { http: c.http } : {}), ...(c.error ? { error: c.error } : {}), ...(c.note ? { note: c.note } : {}) })),
  };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(HELP);
    process.exit(argv.length === 0 ? 2 : 0);
  }
  const opt = parseArgs(argv);
  if (!opt.name) { console.error('FATAL no name given'); process.exit(2); }

  const report = await run(opt.name, opt);

  fs.mkdirSync(path.dirname(opt.out), { recursive: true });
  fs.writeFileSync(opt.out, JSON.stringify(report, null, 2));

  // human-readable summary
  console.log(`name-check  "${report.name}"  (${report.checkedAt})  -> ${opt.out}`);
  for (const c of report.conflicts) {
    const tag = c.result.toUpperCase().padEnd(9);
    console.log(`  [${tag}] ${c.check.padEnd(18)} ${c.name}${c.http ? '  (' + c.http + ')' : ''}${c.error ? '  (' + c.error + ')' : ''}`);
  }
  process.exit(0);
}

if (require.main === module) {
  main().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
}

module.exports = { run, checkDomain, checkGithubHandle, checkNpmPackage, checkTrademark, parseArgs };
