// ab.js — A/B test calculator + variant-split snippet generator. No external service, no npm deps.
// Built-in Node only. Three subcommands: plan | test | snippet. Run `node ab.js --help` for formulas.
//
//   node ab.js plan    --baseline 0.04 --mde 0.10 [--power 0.8 --alpha 0.05 --daily 1200 --variants 2]
//   node ab.js test    --a 120/4000 --b 156/4100 [--alpha 0.05]
//   node ab.js snippet --name hero-cta [--split 50 --storage local|cookie]
//
// Numerics are self-contained: inverse-normal (Acklam, ~1e-9) for z-quantiles, and a normal CDF
// (Abramowitz–Stegun 7.1.26 erf, ~1.5e-7) for p-values. Off-by-default tooling — nothing imports it.

'use strict';

// ---------- math: standard-normal CDF (via erf) and inverse-CDF (probit) ----------

// erf(x) — A&S 7.1.26, max abs error ~1.5e-7. Enough for p-values reported to 4 dp.
function erf(x) {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return sign * y;
}
// Φ(x): standard-normal CDF.
function normCdf(x) { return 0.5 * (1 + erf(x / Math.SQRT2)); }

// Φ⁻¹(p): inverse standard-normal CDF — Peter Acklam's rational approximation (~1e-9 abs error).
function normInv(p) {
  if (p <= 0 || p >= 1) throw new RangeError('normInv: p must be in (0,1)');
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const pLow = 0.02425, pHigh = 1 - pLow;
  let q, r;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
}

// ---------- arg parsing ----------

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) { out[key] = true; }
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}
function num(v, name) {
  const n = Number(v);
  if (!Number.isFinite(n)) { console.error(`error: --${name} must be a number (got ${JSON.stringify(v)})`); process.exit(1); }
  return n;
}
// "120/4000" → { x:120, n:4000 }
function parseFrac(v, name) {
  const m = String(v).match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (!m) { console.error(`error: --${name} must be conversions/visitors, e.g. 120/4000 (got ${JSON.stringify(v)})`); process.exit(1); }
  const x = Number(m[1]), n = Number(m[2]);
  if (n <= 0 || x < 0 || x > n) { console.error(`error: --${name}=${v} invalid (need 0 ≤ conversions ≤ visitors, visitors > 0)`); process.exit(1); }
  return { x, n };
}
const pct = (x, d = 2) => (x * 100).toFixed(d) + '%';

// ---------- subcommand: plan (required sample size per variant) ----------

function cmdPlan(args) {
  const baseline = num(args.baseline, 'baseline');
  const mdeRel = num(args.mde, 'mde');           // RELATIVE lift, e.g. 0.10 = +10%
  const power = args.power !== undefined ? num(args.power, 'power') : 0.8;
  const alpha = args.alpha !== undefined ? num(args.alpha, 'alpha') : 0.05;
  const variants = args.variants !== undefined ? Math.max(2, Math.round(num(args.variants, 'variants'))) : 2;

  if (baseline <= 0 || baseline >= 1) { console.error('error: --baseline must be a rate in (0,1), e.g. 0.04'); process.exit(1); }
  const p1 = baseline;
  const p2 = baseline * (1 + mdeRel);
  if (p2 <= 0 || p2 >= 1) { console.error(`error: implied treatment rate ${p2} out of (0,1); lower --mde`); process.exit(1); }
  const delta = p2 - p1;

  const zA = normInv(1 - alpha / 2);             // two-sided
  const zB = normInv(power);
  const pBar = (p1 + p2) / 2;
  // n = ( zα·√(2·p̄·q̄) + zβ·√(p1q1 + p2q2) )² / δ²   (per variant)
  const nPer = Math.ceil(Math.pow(zA * Math.sqrt(2 * pBar * (1 - pBar)) + zB * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)), 2) / (delta * delta));

  console.log('A/B sample-size plan (two-proportion, normal approx)');
  console.log('  formula:  n = ( z_{1-α/2}·√(2·p̄·q̄) + z_{1-β}·√(p₁q₁+p₂q₂) )² / (p₂−p₁)²   per variant');
  console.log('');
  console.log(`  baseline (p₁)        ${pct(p1, 3)}`);
  console.log(`  MDE (relative)       +${pct(mdeRel)}  →  treatment (p₂) ${pct(p2, 3)}  (abs δ = ${pct(delta, 3)})`);
  console.log(`  power (1−β)          ${pct(power)}   (z_{1-β} = ${zB.toFixed(4)})`);
  console.log(`  alpha (two-sided)    ${pct(alpha)}   (z_{1-α/2} = ${zA.toFixed(4)})`);
  console.log('');
  console.log(`  → required n PER VARIANT:  ${nPer.toLocaleString()}`);
  console.log(`  → total across ${variants} variants:   ${(nPer * variants).toLocaleString()}`);

  if (args.daily !== undefined) {
    const daily = num(args.daily, 'daily');       // TOTAL daily visitors entering the test
    if (daily <= 0) { console.error('error: --daily must be > 0'); process.exit(1); }
    const perVariantPerDay = daily / variants;
    const days = Math.ceil(nPer / perVariantPerDay);
    console.log('');
    console.log(`  traffic: ${daily.toLocaleString()}/day total, split ${variants} ways = ${Math.round(perVariantPerDay).toLocaleString()}/variant/day`);
    console.log(`  → est. duration: ${days} day(s)  (~${(days / 7).toFixed(1)} weeks — round UP to whole weeks to absorb day-of-week effects)`);
    if (days > 28) console.log('  ⚠ > 4 weeks: your traffic can\'t resolve an MDE this small. Test a BIGGER swing (offer/hero), not a tweak.');
  } else {
    console.log('');
    console.log('  (pass --daily <total visitors/day> to also get the test duration in days)');
  }
}

// ---------- subcommand: test (significance of an observed result) ----------

function cmdTest(args) {
  const A = parseFrac(args.a, 'a');               // control
  const B = parseFrac(args.b, 'b');               // treatment
  const alpha = args.alpha !== undefined ? num(args.alpha, 'alpha') : 0.05;

  const pA = A.x / A.n, pB = B.x / B.n;
  const absLift = pB - pA;
  const relLift = pA > 0 ? absLift / pA : Infinity;

  // pooled-SE z-test for the verdict
  const pPool = (A.x + B.x) / (A.n + B.n);
  const sePool = Math.sqrt(pPool * (1 - pPool) * (1 / A.n + 1 / B.n));
  const z = sePool > 0 ? absLift / sePool : 0;
  const pValue = 2 * (1 - normCdf(Math.abs(z)));   // two-sided

  // unpooled SE for the CI on the difference
  const seDiff = Math.sqrt(pA * (1 - pA) / A.n + pB * (1 - pB) / B.n);
  const zCrit = normInv(1 - alpha / 2);
  const ciLo = absLift - zCrit * seDiff;
  const ciHi = absLift + zCrit * seDiff;

  const sig = pValue < alpha;

  console.log('A/B result (two-proportion z-test)');
  console.log('  formulas:  z = (p̂_B − p̂_A) / √(p̂(1−p̂)(1/n_A + 1/n_B))   [p̂ pooled]');
  console.log(`             CI = (p̂_B − p̂_A) ± z_{1-α/2}·√(p̂_A q̂_A/n_A + p̂_B q̂_B/n_B)`);
  console.log('');
  console.log(`  A (control)    ${A.x}/${A.n}  =  ${pct(pA, 3)}`);
  console.log(`  B (treatment)  ${B.x}/${B.n}  =  ${pct(pB, 3)}`);
  console.log('');
  console.log(`  absolute lift  ${absLift >= 0 ? '+' : ''}${pct(absLift, 3)}  (B − A)`);
  console.log(`  relative lift  ${relLift >= 0 ? '+' : ''}${(relLift * 100).toFixed(1)}%`);
  console.log(`  z-statistic    ${z.toFixed(4)}`);
  console.log(`  p-value        ${pValue < 0.0001 ? '< 0.0001' : pValue.toFixed(4)}  (two-sided)`);
  console.log(`  ${pct(1 - alpha, 0)} CI on abs diff   [${pct(ciLo, 3)}, ${pct(ciHi, 3)}]`);
  console.log('');
  if (sig) {
    console.log(`  ✅ SIGNIFICANT at α=${alpha}: B ${absLift >= 0 ? 'beats' : 'loses to'} A (p=${pValue < 0.0001 ? '<0.0001' : pValue.toFixed(4)}). The CI excludes 0.`);
  } else {
    console.log(`  ⏳ NOT YET significant at α=${alpha} (p=${pValue.toFixed(4)}). The ${pct(1 - alpha, 0)} CI includes 0 — could be noise.`);
  }
  console.log('  ⚠ PEEKING WARNING: this is a fixed-horizon test. Stopping the moment it crosses significance');
  console.log('    inflates false positives. Only call it at the PRE-COMMITTED sample size (see `ab.js plan`),');
  console.log('    run full weeks, and don\'t revert-and-restart on a blip.');
}

// ---------- subcommand: snippet (client-side variant split) ----------

function cmdSnippet(args) {
  const name = (args.name && args.name !== true) ? String(args.name) : 'experiment';
  const split = args.split !== undefined ? num(args.split, 'split') : 50;
  if (split < 0 || split > 100) { console.error('error: --split must be 0–100 (percent allocated to variant A)'); process.exit(1); }
  const storage = args.storage === 'cookie' ? 'cookie' : 'local';
  const key = name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();

  // Dependency-free: stable per-visitor id (localStorage or cookie) → cyrb53 hash → bucket A/B by split.
  const snippet = `<!-- A/B split: "${key}" — dependency-free, deterministic per visitor. Inline before </body>. -->
<script>
(function () {
  var EXP = ${JSON.stringify(key)};        // experiment key
  var SPLIT = ${split};               // % of traffic into variant "A"
  var STORE = ${JSON.stringify(storage)};  // "local" | "cookie"

  // --- stable visitor id -------------------------------------------------
  function readCookie(k){ var m=document.cookie.match('(?:^|; )'+k+'=([^;]*)'); return m?decodeURIComponent(m[1]):null; }
  function writeCookie(k,v){ document.cookie=k+'='+encodeURIComponent(v)+';path=/;max-age=31536000;SameSite=Lax'; }
  function getId(){
    var IDK='ab_uid', id=null;
    try { id = STORE==='cookie' ? readCookie(IDK) : localStorage.getItem(IDK); } catch(e){}
    if(!id){
      id = (Date.now().toString(36) + Math.random().toString(36).slice(2,10));
      try { STORE==='cookie' ? writeCookie(IDK,id) : localStorage.setItem(IDK,id); } catch(e){}
    }
    return id;
  }

  // --- cyrb53: fast 53-bit string hash (stable across loads) -------------
  function cyrb53(str, seed){
    var h1=0xdeadbeef^seed, h2=0x41c6ce57^seed;
    for(var i=0,ch;i<str.length;i++){ ch=str.charCodeAt(i); h1=Math.imul(h1^ch,2654435761); h2=Math.imul(h2^ch,1597334677); }
    h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
    h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
    return 4294967296*(2097151&h2)+(h1>>>0);
  }

  var id = getId();
  var bucket = (cyrb53(EXP+':'+id, 0) % 100) < SPLIT ? 'A' : 'B';

  // --- apply: set data-variant on <html>, expose a global, fire exposure --
  document.documentElement.setAttribute('data-variant', bucket);
  document.documentElement.setAttribute('data-exp-'+EXP, bucket);
  window.__ab = window.__ab || {}; window.__ab[EXP] = bucket;

  var payload = { experiment: EXP, variant: bucket };
  // dataLayer (GTM/GA4)
  try { window.dataLayer = window.dataLayer || []; window.dataLayer.push(Object.assign({ event: 'experiment_exposure' }, payload)); } catch(e){}
  // PostHog
  try { if (window.posthog && posthog.capture) posthog.capture('$experiment_started', { '$feature_flag': EXP, '$feature_flag_response': bucket }); } catch(e){}
})();
</script>
<!-- Style the variants with attribute selectors, e.g.:
     html[data-variant="B"] .hero-cta { background: var(--accent); }
     or read window.__ab[${JSON.stringify(key)}] in JS. Default (A) needs NO CSS. -->`;

  console.log(snippet);
}

// ---------- help ----------

function help() {
  console.log(`ab.js — A/B test calculator + snippet generator (no external service)

USAGE
  node ab.js plan    --baseline <rate> --mde <relLift> [--power 0.8] [--alpha 0.05] [--daily N] [--variants 2]
  node ab.js test    --a <conv/visitors> --b <conv/visitors> [--alpha 0.05]
  node ab.js snippet --name <key> [--split 50] [--storage local|cookie]

PLAN — required sample size per variant
  n = ( z_{1-α/2}·√(2·p̄·q̄) + z_{1-β}·√(p₁q₁+p₂q₂) )² / (p₂−p₁)²
  where p₁=baseline, p₂=p₁·(1+mde), p̄=(p₁+p₂)/2, q=1−p.
  --mde is a RELATIVE lift: 0.10 means "detect a +10% improvement" (p₂ = 1.10·p₁).
  With --daily (TOTAL visitors/day, split across variants): days = ⌈ n / (daily/variants) ⌉.
  e.g.  node ab.js plan --baseline 0.04 --mde 0.10 --daily 1200

TEST — significance of an observed result (two-proportion z-test)
  z = (p̂_B − p̂_A) / √(p̂(1−p̂)(1/n_A + 1/n_B))        [p̂ = pooled rate]
  p-value = 2·(1 − Φ(|z|))  (two-sided)
  95% CI on the difference (unpooled SE):
  (p̂_B − p̂_A) ± z_{1-α/2}·√(p̂_A q̂_A/n_A + p̂_B q̂_B/n_B)
  e.g.  node ab.js test --a 120/4000 --b 156/4100

SNIPPET — dependency-free client-side variant split
  Stable visitor id (localStorage/cookie) → cyrb53 hash → bucket by --split%.
  Sets html[data-variant], exposes window.__ab[name], fires an exposure event
  to dataLayer (GTM/GA4) and posthog if present.
  e.g.  node ab.js snippet --name hero-cta --split 50

Numerics are self-contained (Acklam inverse-normal + A&S erf). No npm deps.`);
}

// ---------- dispatch ----------

function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') { help(); return; }
  const args = parseArgs(argv.slice(1));
  switch (cmd) {
    case 'plan': return cmdPlan(args);
    case 'test': return cmdTest(args);
    case 'snippet': return cmdSnippet(args);
    default:
      console.error(`unknown subcommand "${cmd}". Try: plan | test | snippet  (or --help)`);
      process.exit(1);
  }
}
main();
