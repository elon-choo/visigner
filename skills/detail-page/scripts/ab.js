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

// ---------- math: log-gamma, incomplete beta/gamma, Student-t & chi-square ----------

// ln Γ(x) — Lanczos approximation (abs error ~1e-10 for x>0).
function gammaln(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) { y++; ser += c[j] / y; }
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

// Continued fraction for the incomplete beta (Numerical Recipes betacf).
function betacf(a, b, x) {
  const MAXIT = 300, EPS = 3e-14, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
// I_x(a,b): regularized incomplete beta = CDF of Beta(a,b) at x.
function betai(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(gammaln(a + b) - gammaln(a) - gammaln(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
  return 1 - bt * betacf(b, a, 1 - x) / b;
}

// Regularized lower incomplete gamma P(a,x) via series, and upper Q(a,x) via CF.
function gser(a, x) {
  const ITMAX = 400, EPS = 3e-14;
  if (x <= 0) return 0;
  const gln = gammaln(a);
  let ap = a, sum = 1 / a, del = sum;
  for (let n = 0; n < ITMAX; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * EPS) break; }
  return sum * Math.exp(-x + a * Math.log(x) - gln);
}
function gcf(a, x) {
  const ITMAX = 400, EPS = 3e-14, FPMIN = 1e-300;
  const gln = gammaln(a);
  let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
  for (let i = 1; i <= ITMAX; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return Math.exp(-x + a * Math.log(x) - gln) * h;
}
function gammp(a, x) { if (x < 0 || a <= 0) return NaN; return x < a + 1 ? gser(a, x) : 1 - gcf(a, x); }
function gammq(a, x) { return 1 - gammp(a, x); }

// Two-sided p-value for Student-t: P(|T| > |t|) with df degrees of freedom.
function tTwoSidedP(t, df) { return betai(df / 2, 0.5, df / (df + t * t)); }
// Two-sided critical t* such that P(|T| > t*) = alpha (bisection; tTwoSidedP is monotone↓ in t).
function tCrit(alpha, df) {
  let lo = 0, hi = 1e5;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (tTwoSidedP(mid, df) > alpha) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
// Upper-tail chi-square p-value: P(X² > x) with df degrees of freedom.
function chisqUpperP(x, df) { return gammq(df / 2, x / 2); }

// Beta(a,b) density at x.
function betaPdf(x, a, b) {
  if (x <= 0 || x >= 1) return 0;
  return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - (gammaln(a) + gammaln(b) - gammaln(a + b)));
}
// Composite Simpson's rule on [lo,hi] with N (forced even) intervals.
function simpson(f, lo, hi, N) {
  if (N % 2) N++;
  const h = (hi - lo) / N;
  let s = f(lo) + f(hi);
  for (let i = 1; i < N; i++) s += (i % 2 ? 4 : 2) * f(lo + i * h);
  return s * h / 3;
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

// "52.1,18.3,1200" → { mean:52.1, sd:18.3, n:1200 }  (for continuous-metric Welch test)
function parseTriple(v, name) {
  const parts = String(v).split(',').map(s => s.trim());
  if (parts.length !== 3) { console.error(`error: --${name} must be "mean,sd,n", e.g. 52.1,18.3,1200 (got ${JSON.stringify(v)})`); process.exit(1); }
  const mean = Number(parts[0]), sd = Number(parts[1]), n = Number(parts[2]);
  if (![mean, sd, n].every(Number.isFinite)) { console.error(`error: --${name} must be three numbers "mean,sd,n" (got ${JSON.stringify(v)})`); process.exit(1); }
  if (sd < 0 || n < 2) { console.error(`error: --${name}=${v} invalid (need sd ≥ 0 and n ≥ 2)`); process.exit(1); }
  return { mean, sd, n };
}

// Multiple-comparison note: m = variants−1 tests vs control → corrected per-comparison α.
function printMultipleComparison(variants, alpha) {
  const m = variants - 1;
  const bonf = alpha / m;
  const sidak = 1 - Math.pow(1 - alpha, 1 / m);
  console.log('');
  console.log(`  ⚠ MULTIPLE COMPARISONS: ${variants} variants ⇒ ${m} test(s) vs control. A single α=${alpha} inflates the`);
  console.log(`    family-wise false-positive rate to ~${(1 - Math.pow(1 - alpha, m)).toFixed(4)}. Use a stricter per-comparison α:`);
  console.log(`      Bonferroni  α' = α/${m}            = ${bonf.toFixed(4)}`);
  console.log(`      Šidák       α' = 1−(1−α)^(1/${m})  = ${sidak.toFixed(4)}   (slightly less conservative)`);
}

// ---------- subcommand: plan (required sample size per variant) ----------

function cmdPlan(args) {
  if (args.metric === 'mean') return cmdPlanMean(args);
  if (args.metric !== undefined && args.metric !== 'proportion' && args.metric !== true) {
    console.error(`error: --metric must be "proportion" (default) or "mean" (got ${JSON.stringify(args.metric)})`); process.exit(1);
  }
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

  if (variants > 2) printMultipleComparison(variants, alpha);
}

// ---------- subcommand: plan --metric mean (sample size for a continuous metric) ----------

function cmdPlanMean(args) {
  const mu = num(args.mu, 'mu');                 // baseline mean (revenue/AOV/etc.)
  const sd = num(args.sd, 'sd');                 // baseline standard deviation
  const mdeRel = num(args.mde, 'mde');           // RELATIVE lift, e.g. 0.10 = +10%
  const power = args.power !== undefined ? num(args.power, 'power') : 0.8;
  const alpha = args.alpha !== undefined ? num(args.alpha, 'alpha') : 0.05;
  const variants = args.variants !== undefined ? Math.max(2, Math.round(num(args.variants, 'variants'))) : 2;

  if (sd <= 0) { console.error('error: --sd must be > 0'); process.exit(1); }
  if (mu === 0) { console.error('error: --mu must be non-zero (δ = μ·mde)'); process.exit(1); }
  const delta = Math.abs(mu * mdeRel);           // absolute effect size to detect
  if (delta === 0) { console.error('error: implied effect δ = μ·mde is 0; raise --mde'); process.exit(1); }

  const zA = normInv(1 - alpha / 2);             // two-sided
  const zB = normInv(power);
  // n = 2·(z_{1-α/2} + z_{1-β})²·σ² / δ²   (per variant, equal-variance normal approx)
  const nPer = Math.ceil(2 * Math.pow(zA + zB, 2) * sd * sd / (delta * delta));

  console.log('A/B sample-size plan (two-sample means, normal approx — continuous metric: revenue/AOV/etc.)');
  console.log('  formula:  n = 2·(z_{1-α/2} + z_{1-β})²·σ² / δ²   per variant   (δ = μ·mde)');
  console.log('');
  console.log(`  baseline mean (μ)    ${mu}`);
  console.log(`  std dev (σ)          ${sd}`);
  console.log(`  MDE (relative)       +${pct(mdeRel)}  →  abs effect δ = ${delta}`);
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

  if (variants > 2) printMultipleComparison(variants, alpha);
}

// ---------- subcommand: test (significance of an observed result) ----------

function cmdTest(args) {
  if (args.metric === 'mean') return cmdTestMean(args);
  if (args.metric !== undefined && args.metric !== 'proportion' && args.metric !== true) {
    console.error(`error: --metric must be "proportion" (default) or "mean" (got ${JSON.stringify(args.metric)})`); process.exit(1);
  }
  const A = parseFrac(args.a, 'a');               // control
  const B = parseFrac(args.b, 'b');               // treatment
  const alpha = args.alpha !== undefined ? num(args.alpha, 'alpha') : 0.05;
  const variants = args.variants !== undefined ? Math.max(2, Math.round(num(args.variants, 'variants'))) : 2;

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

  if (variants > 2) printMultipleComparison(variants, alpha);
}

// ---------- subcommand: test --metric mean (Welch t-test for a continuous metric) ----------

function cmdTestMean(args) {
  const A = parseTriple(args.a, 'a');             // control:   mean,sd,n
  const B = parseTriple(args.b, 'b');             // treatment: mean,sd,n
  const alpha = args.alpha !== undefined ? num(args.alpha, 'alpha') : 0.05;
  const variants = args.variants !== undefined ? Math.max(2, Math.round(num(args.variants, 'variants'))) : 2;

  const diff = B.mean - A.mean;                    // B − A
  const vA = A.sd * A.sd / A.n, vB = B.sd * B.sd / B.n;
  const se = Math.sqrt(vA + vB);                   // Welch standard error of the difference
  const t = se > 0 ? diff / se : 0;
  // Welch–Satterthwaite degrees of freedom
  const df = se > 0 ? Math.pow(vA + vB, 2) / (vA * vA / (A.n - 1) + vB * vB / (B.n - 1)) : (A.n + B.n - 2);
  const pValue = se > 0 ? tTwoSidedP(t, df) : 1;   // two-sided
  const tc = tCrit(alpha, df);
  const ciLo = diff - tc * se, ciHi = diff + tc * se;
  const relLift = A.mean !== 0 ? diff / A.mean : Infinity;
  const sig = pValue < alpha;

  console.log('A/B result (Welch two-sample t-test, continuous metric — revenue/AOV/etc.)');
  console.log('  formulas:  t = (x̄_B − x̄_A) / √(s²_A/n_A + s²_B/n_B)');
  console.log('             df = (s²_A/n_A + s²_B/n_B)² / [ (s²_A/n_A)²/(n_A−1) + (s²_B/n_B)²/(n_B−1) ]   (Welch–Satterthwaite)');
  console.log('             p = 2·P(T_df > |t|);   CI = (x̄_B − x̄_A) ± t_{1-α/2, df}·√(s²_A/n_A + s²_B/n_B)');
  console.log('');
  console.log(`  A (control)    mean ${A.mean}  sd ${A.sd}  n ${A.n}`);
  console.log(`  B (treatment)  mean ${B.mean}  sd ${B.sd}  n ${B.n}`);
  console.log('');
  console.log(`  mean diff      ${diff >= 0 ? '+' : ''}${diff.toFixed(4)}  (B − A)`);
  console.log(`  relative lift  ${relLift >= 0 ? '+' : ''}${(relLift * 100).toFixed(1)}%`);
  console.log(`  Welch t        ${t.toFixed(4)}`);
  console.log(`  df             ${df.toFixed(2)}`);
  console.log(`  p-value        ${pValue < 0.0001 ? '< 0.0001' : pValue.toFixed(4)}  (two-sided)`);
  console.log(`  t_{1-α/2, df}  ${tc.toFixed(4)}`);
  console.log(`  ${pct(1 - alpha, 0)} CI on mean diff  [${ciLo.toFixed(4)}, ${ciHi.toFixed(4)}]`);
  console.log('');
  if (sig) {
    console.log(`  ✅ SIGNIFICANT at α=${alpha}: B ${diff >= 0 ? 'beats' : 'loses to'} A (p=${pValue < 0.0001 ? '<0.0001' : pValue.toFixed(4)}). The CI excludes 0.`);
  } else {
    console.log(`  ⏳ NOT YET significant at α=${alpha} (p=${pValue.toFixed(4)}). The ${pct(1 - alpha, 0)} CI includes 0 — could be noise.`);
  }
  console.log('  ⚠ Welch assumes roughly normal means (CLT covers large n) and does NOT assume equal variances.');
  console.log('    For heavy-tailed revenue, also sanity-check with medians/trimmed means.');

  if (variants > 2) printMultipleComparison(variants, alpha);
}

// ---------- subcommand: srm (Sample-Ratio-Mismatch chi-square guardrail) ----------

function cmdSrm(args) {
  if (args.observed === undefined || args.observed === true) {
    console.error('error: srm needs --observed "a:4001,b:3999" (label:count pairs, comma-separated)'); process.exit(1);
  }
  const obs = String(args.observed).split(',').map(s => s.trim()).filter(Boolean).map(pair => {
    const m = pair.match(/^([^:]+):\s*(\d+(?:\.\d+)?)$/);
    if (!m) { console.error(`error: --observed entry ${JSON.stringify(pair)} must be label:count, e.g. a:4001`); process.exit(1); }
    return { label: m[1].trim(), count: Number(m[2]) };
  });
  if (obs.length < 2) { console.error('error: srm needs at least 2 buckets in --observed'); process.exit(1); }

  let ratios;
  if (args.expected !== undefined && args.expected !== true) {
    ratios = String(args.expected).split(':').map(s => Number(s.trim()));
    if (ratios.length !== obs.length || !ratios.every(r => Number.isFinite(r) && r > 0)) {
      console.error(`error: --expected must be ${obs.length} positive numbers like ${obs.map(() => '1').join(':')} (got ${JSON.stringify(args.expected)})`); process.exit(1);
    }
  } else {
    ratios = obs.map(() => 1);                     // default: equal split
  }

  const total = obs.reduce((s, o) => s + o.count, 0);
  const ratioSum = ratios.reduce((s, r) => s + r, 0);
  const df = obs.length - 1;
  let chi2 = 0;
  const rows = obs.map((o, i) => {
    const exp = total * ratios[i] / ratioSum;
    const contrib = (o.count - exp) * (o.count - exp) / exp;
    chi2 += contrib;
    return { label: o.label, obs: o.count, exp, share: o.count / total, expShare: ratios[i] / ratioSum };
  });
  const p = chisqUpperP(chi2, df);

  console.log('Sample-Ratio-Mismatch (SRM) guardrail — Pearson chi-square goodness-of-fit');
  console.log('  formula:  χ² = Σ (Oᵢ − Eᵢ)² / Eᵢ ,  Eᵢ = N·rᵢ/Σr ,  df = k−1 ,  p = P(χ²_df > χ²_obs)');
  console.log('');
  console.log(`  total assigned   ${total.toLocaleString()}   (k=${obs.length} buckets, df=${df})`);
  for (const r of rows) {
    console.log(`  ${r.label.padEnd(6)} observed ${String(r.obs).padStart(8)} (${pct(r.share, 2)})   expected ${r.exp.toFixed(1).padStart(10)} (${pct(r.expShare, 2)})`);
  }
  console.log('');
  console.log(`  χ²             ${chi2.toFixed(4)}`);
  console.log(`  p-value        ${p < 0.0001 ? '< 0.0001' : p.toFixed(4)}`);
  console.log('');
  if (p < 0.001) {
    console.log(`  🚨 SRM DETECTED (p=${p < 0.0001 ? '<0.0001' : p.toFixed(4)} < 0.001): the split deviates from expected far more than chance.`);
    console.log('     Your randomization/assignment is almost certainly BROKEN (bot filtering, redirect bug, caching,');
    console.log('     uneven bucketing). DO NOT TRUST the conversion results — fix the pipeline and re-run.');
  } else {
    console.log(`  ✅ No SRM (p=${p.toFixed(4)} ≥ 0.001): the bucket counts are consistent with the expected split.`);
  }
}

// ---------- subcommand: bayes (beta-binomial Bayesian readout, no RNG) ----------

function cmdBayes(args) {
  const A = parseFrac(args.a, 'a');               // control:   conversions/visitors
  const B = parseFrac(args.b, 'b');               // treatment: conversions/visitors
  let prior = { a: 1, b: 1 };                      // uniform Beta(1,1) by default
  if (args.prior !== undefined && args.prior !== true) {
    const pp = String(args.prior).split(',').map(s => Number(s.trim()));
    if (pp.length !== 2 || !pp.every(v => Number.isFinite(v) && v > 0)) { console.error('error: --prior must be "a,b" with a,b > 0, e.g. 1,1'); process.exit(1); }
    prior = { a: pp[0], b: pp[1] };
  }

  // Posterior Beta params
  const aA = prior.a + A.x, bA = prior.b + (A.n - A.x);
  const aB = prior.a + B.x, bB = prior.b + (B.n - B.x);
  const meanA = aA / (aA + bA), meanB = aB / (aB + bB);
  const sdA = Math.sqrt(aA * bA / ((aA + bA) * (aA + bA) * (aA + bA + 1)));
  const sdB = Math.sqrt(aB * bB / ((aB + bB) * (aB + bB) * (aB + bB + 1)));

  // Integration window covering both posteriors (±10 sd, clamped).
  const lo = Math.max(0, Math.min(meanA - 10 * sdA, meanB - 10 * sdB));
  const hi = Math.min(1, Math.max(meanA + 10 * sdA, meanB + 10 * sdB));
  const N = 4000;

  // P(pB > pA) = ∫ pdf_B(p)·CDF_A(p) dp  (CDF_A = I_p(aA,bA)). Deterministic Simpson grid, no RNG.
  const pBwins = simpson(p => betaPdf(p, aB, bB) * betai(aA, bA, p), lo, hi, N);
  const pAwins = 1 - pBwins;

  // Expected loss of shipping B = E[max(pA − pB, 0)] over A's support:
  //   ∫ pdf_A(a)·[ a·I_a(aB,bB) − meanB·I_a(aB+1,bB) ] da
  const loA = Math.max(0, meanA - 10 * sdA), hiA = Math.min(1, meanA + 10 * sdA);
  const lossShipB = simpson(a => betaPdf(a, aA, bA) * (a * betai(aB, bB, a) - meanB * betai(aB + 1, bB, a)), loA, hiA, N);
  // Expected loss of shipping A = E[max(pB − pA, 0)] over B's support.
  const loB = Math.max(0, meanB - 10 * sdB), hiB = Math.min(1, meanB + 10 * sdB);
  const lossShipA = simpson(b => betaPdf(b, aB, bB) * (b * betai(aA, bA, b) - meanA * betai(aA + 1, bA, b)), loB, hiB, N);

  console.log('Bayesian A/B readout (beta-binomial conjugate, deterministic numeric integration — no RNG)');
  console.log(`  prior Beta(${prior.a},${prior.b})  →  posteriors:  A ~ Beta(${aA},${bA})   B ~ Beta(${aB},${bB})`);
  console.log('  P(B>A) = ∫₀¹ f_B(p)·F_A(p) dp ;  expected loss(ship B) = E[max(p_A−p_B, 0)]   (Simpson grid)');
  console.log('');
  console.log(`  A (control)    ${A.x}/${A.n}   posterior mean ${pct(meanA, 3)}  (±${pct(sdA, 3)})`);
  console.log(`  B (treatment)  ${B.x}/${B.n}   posterior mean ${pct(meanB, 3)}  (±${pct(sdB, 3)})`);
  console.log('');
  console.log(`  P(B > A)             ${(pBwins * 100).toFixed(2)}%`);
  console.log(`  P(A > B)             ${(pAwins * 100).toFixed(2)}%`);
  console.log(`  E[loss | ship B]     ${pct(lossShipB, 4)}  (abs CVR points you forgo if B is actually worse)`);
  console.log(`  E[loss | ship A]     ${pct(lossShipA, 4)}  (abs CVR points you forgo if A is actually worse)`);
  console.log('');
  const winner = pBwins >= 0.5 ? 'B' : 'A';
  const conf = Math.max(pBwins, pAwins);
  if (conf >= 0.95) {
    console.log(`  ✅ ${winner} wins with ${(conf * 100).toFixed(1)}% probability and tiny remaining risk (E[loss | ship ${winner}] = ${pct(winner === 'B' ? lossShipB : lossShipA, 4)}).`);
  } else {
    console.log(`  ⏳ ${winner} leads (${(conf * 100).toFixed(1)}%) but not decisively. Keep running until P(winner) ≥ ~95% AND E[loss] is below your threshold.`);
  }
  console.log('  Note: Bayesian readouts have no fixed-horizon peeking penalty, but the decision rule (P / E[loss]');
  console.log('  thresholds) must be pre-committed — chasing the metric still inflates wrong calls.');
}

// ---------- subcommand: snippet (client-side variant split) ----------

function cmdSnippet(args) {
  const name = (args.name && args.name !== true) ? String(args.name) : 'experiment';
  const split = args.split !== undefined ? num(args.split, 'split') : 50;
  if (split < 0 || split > 100) { console.error('error: --split must be 0–100 (percent allocated to variant A)'); process.exit(1); }
  const storage = args.storage === 'cookie' ? 'cookie' : 'local';
  const key = name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
  const buckets = args.buckets !== undefined ? Math.round(num(args.buckets, 'buckets')) : 2;
  if (buckets < 2 || buckets > 26) { console.error('error: --buckets must be 2–26 (A..Z)'); process.exit(1); }
  if (buckets > 2) return snippetNBuckets(key, buckets, storage);

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

// N equal-weight buckets (A..) — carries the variant assignment so an SRM check has data.
function snippetNBuckets(key, n, storage) {
  const labels = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i)); // A,B,C,...
  const snippet = `<!-- A/B/n split: "${key}" — ${n} equal buckets [${labels.join(',')}], dependency-free, deterministic per visitor. Inline before </body>. -->
<script>
(function () {
  var EXP = ${JSON.stringify(key)};            // experiment key
  var BUCKETS = ${JSON.stringify(labels)};  // ${n} equal-weight buckets
  var STORE = ${JSON.stringify(storage)};      // "local" | "cookie"

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
  // hash → one of N equal buckets (uniform → expected equal split → SRM-checkable)
  var bucket = BUCKETS[cyrb53(EXP+':'+id, 0) % BUCKETS.length];

  // --- apply: set data-variant on <html>, expose a global, fire exposure --
  document.documentElement.setAttribute('data-variant', bucket);
  document.documentElement.setAttribute('data-exp-'+EXP, bucket);
  window.__ab = window.__ab || {}; window.__ab[EXP] = bucket;

  var payload = { experiment: EXP, variant: bucket };
  // dataLayer (GTM/GA4) — carries the bucket so you can COUNT assignments and run \`ab.js srm\`
  try { window.dataLayer = window.dataLayer || []; window.dataLayer.push(Object.assign({ event: 'experiment_exposure' }, payload)); } catch(e){}
  // PostHog
  try { if (window.posthog && posthog.capture) posthog.capture('$experiment_started', { '$feature_flag': EXP, '$feature_flag_response': bucket }); } catch(e){}
})();
</script>
<!-- Style each variant with attribute selectors, e.g. html[data-variant="C"] .hero-cta { ... }.
     Feed the per-bucket exposure counts into:  node ab.js srm --observed "${labels.map(l => l.toLowerCase() + ':<count>').join(',')}" -->`;
  console.log(snippet);
}

// ---------- help ----------

function help() {
  console.log(`ab.js — A/B test calculator + snippet generator (no external service)

USAGE
  node ab.js plan    --baseline <rate> --mde <relLift> [--power 0.8] [--alpha 0.05] [--daily N] [--variants 2]
  node ab.js plan    --metric mean --mu <baseline> --sd <stddev> --mde <relLift> [--power 0.8] [--alpha 0.05] [--daily N] [--variants 2]
  node ab.js test    --a <conv/visitors> --b <conv/visitors> [--alpha 0.05] [--variants 2]
  node ab.js test    --metric mean --a "mean,sd,n" --b "mean,sd,n" [--alpha 0.05] [--variants 2]
  node ab.js srm     --observed "a:4001,b:3999" [--expected 50:50]
  node ab.js bayes   --a <conv/visitors> --b <conv/visitors> [--prior 1,1]
  node ab.js snippet --name <key> [--split 50] [--storage local|cookie] [--buckets 2]

PLAN — required sample size per variant
  n = ( z_{1-α/2}·√(2·p̄·q̄) + z_{1-β}·√(p₁q₁+p₂q₂) )² / (p₂−p₁)²
  where p₁=baseline, p₂=p₁·(1+mde), p̄=(p₁+p₂)/2, q=1−p.
  --mde is a RELATIVE lift: 0.10 means "detect a +10% improvement" (p₂ = 1.10·p₁).
  With --daily (TOTAL visitors/day, split across variants): days = ⌈ n / (daily/variants) ⌉.
  e.g.  node ab.js plan --baseline 0.04 --mde 0.10 --daily 1200

PLAN --metric mean — sample size for a continuous metric (revenue/AOV), two-sample means
  n = 2·(z_{1-α/2} + z_{1-β})²·σ² / δ²   per variant,  where δ = μ·mde (abs effect from the relative MDE).
  --mu is the baseline mean, --sd its standard deviation, --mde the RELATIVE lift to detect.
  Same --daily duration logic and >4-week warning as the proportion plan.
  e.g.  node ab.js plan --metric mean --mu 42 --sd 18 --mde 0.10 --daily 1200

TEST — significance of an observed result (two-proportion z-test)
  z = (p̂_B − p̂_A) / √(p̂(1−p̂)(1/n_A + 1/n_B))        [p̂ = pooled rate]
  p-value = 2·(1 − Φ(|z|))  (two-sided)
  95% CI on the difference (unpooled SE):
  (p̂_B − p̂_A) ± z_{1-α/2}·√(p̂_A q̂_A/n_A + p̂_B q̂_B/n_B)
  e.g.  node ab.js test --a 120/4000 --b 156/4100
  With --variants >2, prints a Bonferroni/Šidák-corrected per-comparison α note.

TEST --metric mean — continuous metric (revenue/AOV), Welch two-sample t-test
  t  = (x̄_B − x̄_A) / √(s²_A/n_A + s²_B/n_B)
  df = (s²_A/n_A + s²_B/n_B)² / [ (s²_A/n_A)²/(n_A−1) + (s²_B/n_B)²/(n_B−1) ]   (Welch–Satterthwaite)
  p  = 2·P(T_df > |t|);   CI = (x̄_B − x̄_A) ± t_{1-α/2, df}·√(s²_A/n_A + s²_B/n_B)
  --a / --b take "mean,sd,n" (sample mean, sample SD, n). Does NOT assume equal variances.
  e.g.  node ab.js test --metric mean --a "52.1,18.3,1200" --b "55.4,19.1,1180"

SRM — Sample-Ratio-Mismatch guardrail (Pearson chi-square goodness-of-fit)
  χ² = Σ (Oᵢ − Eᵢ)²/Eᵢ ,  Eᵢ = N·rᵢ/Σr ,  df = k−1 ,  p = P(χ²_df > χ²_obs)
  Warns (🚨) if p < 0.001 — the split is broken and the conversion results are untrustworthy.
  --expected takes a ratio like 50:50 or 1:1:1 (default: equal). e.g.  node ab.js srm --observed "a:4001,b:3999"

BAYES — beta-binomial Bayesian readout (deterministic, NO RNG)
  Posterior_X = Beta(prior_a + conv, prior_b + (visitors−conv)).
  P(B>A) = ∫₀¹ f_B(p)·F_A(p) dp ;  expected loss(ship B) = E[max(p_A−p_B, 0)]  (Simpson grid).
  e.g.  node ab.js bayes --a 120/4000 --b 156/4100

SNIPPET — dependency-free client-side variant split
  Stable visitor id (localStorage/cookie) → cyrb53 hash → bucket by --split% (2-bucket),
  or N equal buckets A.. with --buckets N (the bucket is sent on every exposure event,
  so you can count assignments and run 'ab.js srm').
  Sets html[data-variant], exposes window.__ab[name], fires an exposure event
  to dataLayer (GTM/GA4) and posthog if present.
  e.g.  node ab.js snippet --name hero-cta --split 50
        node ab.js snippet --name hero-cta --buckets 3

Numerics are self-contained (Acklam inverse-normal, A&S erf, Lanczos log-Γ,
incomplete-beta/gamma continued fractions for Student-t & chi-square). No npm deps.`);
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
    case 'srm': return cmdSrm(args);
    case 'bayes': return cmdBayes(args);
    case 'snippet': return cmdSnippet(args);
    default:
      console.error(`unknown subcommand "${cmd}". Try: plan | test | srm | bayes | snippet  (or --help)`);
      process.exit(1);
  }
}
main();
