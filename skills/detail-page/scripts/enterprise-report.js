// enterprise-report.js — one aggregated SHIP / NO-SHIP artifact for a page. No deps (fs+path only).
// Pure glue: it detects nothing itself, it ROLLS UP the sidecar gates the other tools wrote, so a stakeholder
// reads one verdict instead of cross-referencing run.json + brand-lint.json + score.json + tokens.json.
//
// Usage:  node enterprise-report.js <dir>            # reads run.json / brand-lint.json / tokens.json / score.json in <dir>
//         node enterprise-report.js <dir> [out-dir]  # writes the report elsewhere
// Writes: <out>/enterprise-report.json { shipReady, gates:{quality,brand,score,tokens} } + enterprise-report.html.
// Discipline: a MISSING sidecar makes that gate "unknown" AND forces shipReady=false — never a silent pass
//   (mirrors shoot.js: unknown != ok). shipReady requires quality+brand+score all "pass" (tokens is informational).

const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir) { console.error('usage: node enterprise-report.js <dir> [out-dir]'); process.exit(1); }
const outDir = process.argv[3] || dir;

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; } }

try {
  fs.mkdirSync(outDir, { recursive: true });
  const run = readJson(path.join(dir, 'run.json'));
  const brandLint = readJson(path.join(dir, 'brand-lint.json'));
  const tokens = readJson(path.join(dir, 'tokens.json'));
  const score = readJson(path.join(dir, 'score.json'));

  // each gate: 'pass' | 'fail' | 'unknown' (unknown = the sidecar was absent/unreadable)
  const qualityGate = !run || !run.gate ? 'unknown'
    : (run.gate.noOverflow === true && run.gate.axeClean !== false && run.gate.assetsOk !== false) ? 'pass' : 'fail';
  const brandGate = !brandLint ? 'unknown' : (brandLint.pass === true ? 'pass' : 'fail');
  const scoreGate = !score ? 'unknown' : (score.gate_pass === true ? 'pass' : 'fail');
  const tokensGate = !tokens ? 'unknown' : 'pass'; // provenance only — present & parseable

  const gates = {
    quality: { status: qualityGate, evidence: run && run.gate ? `noOverflow=${run.gate.noOverflow} axeClean=${run.gate.axeClean} assetsOk=${run.gate.assetsOk}` : 'run.json missing' },
    brand: { status: brandGate, evidence: brandLint ? `errors=${brandLint.errorCount} warns=${brandLint.warnCount}` : 'brand-lint.json missing' },
    score: { status: scoreGate, evidence: score ? `gate_pass=${score.gate_pass} overall=${score.overall != null ? score.overall : 'n/a'}` : 'score.json missing' },
    tokens: { status: tokensGate, evidence: tokens ? 'tokens.json present' : 'tokens.json missing' },
  };
  // shipReady requires the three blocking gates to be PASS; any unknown/fail blocks (no silent pass).
  const shipReady = qualityGate === 'pass' && brandGate === 'pass' && scoreGate === 'pass';

  const report = { shipReady, gates, dir: path.resolve(dir) };
  fs.writeFileSync(path.join(outDir, 'enterprise-report.json'), JSON.stringify(report, null, 2));

  const color = (s) => (s === 'pass' ? '#1a7f37' : s === 'fail' ? '#b3261e' : '#8a6d00');
  const rows = Object.entries(gates).map(([k, v]) =>
    `<tr><td style="padding:8px 16px;font-weight:600">${k}</td><td style="padding:8px 16px;color:${color(v.status)};font-weight:700;text-transform:uppercase">${v.status}</td><td style="padding:8px 16px;color:#555;font-family:monospace;font-size:13px">${v.evidence}</td></tr>`
  ).join('\n');
  const banner = shipReady ? { t: 'SHIP', bg: '#1a7f37' } : { t: 'NO-SHIP', bg: '#b3261e' };
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Enterprise report</title>
<style>body{font-family:Pretendard,system-ui,sans-serif;margin:0;background:#fafafa;color:#16161a}
.banner{background:${banner.bg};color:#fff;padding:28px 24px;font-size:40px;font-weight:800;letter-spacing:.02em}
table{border-collapse:collapse;margin:24px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.1);border-radius:10px;overflow:hidden}
th{text-align:left;padding:10px 16px;background:#f0f0f0;font-size:13px;text-transform:uppercase;letter-spacing:.04em}
.note{margin:0 24px 24px;color:#666;font-size:13px}</style></head>
<body><div class="banner">${banner.t}</div>
<table><thead><tr><th>Gate</th><th>Status</th><th>Evidence</th></tr></thead><tbody>${rows}</tbody></table>
<p class="note">shipReady = quality + brand + score all PASS. "unknown" = the gate's sidecar was absent (run the missing tool) and blocks ship — never a silent pass. tokens is informational (handoff provenance). Source dir: ${path.resolve(dir)}</p>
</body></html>`;
  fs.writeFileSync(path.join(outDir, 'enterprise-report.html'), html);

  console.log(JSON.stringify({ shipReady, gates: Object.fromEntries(Object.entries(gates).map(([k, v]) => [k, v.status])), outDir: path.resolve(outDir) }, null, 2));
} catch (e) {
  console.error('FATAL', e.message);
  process.exit(2);
}
