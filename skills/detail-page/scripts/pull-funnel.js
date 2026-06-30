// pull-funnel.js — read-only funnel pull. No npm deps (built-in Node + global fetch).
// Returns ordered step counts + drop-off %, segmented by source × device when the provider supports it.
// Without an API key it prints the EXACT event/UTM spec you need instrumented, plus a copy-paste event
// schema, and exits 0 (graceful — never crashes, so it's useful offline as a planning artifact).
//
//   node pull-funnel.js --provider posthog --steps "view,scroll50,cta_click,purchase" [--days 14] [--segment source,device]
//
// Env (PostHog):  POSTHOG_API_KEY  POSTHOG_PROJECT_ID  [POSTHOG_HOST=https://us.posthog.com]
// Env (GA4):      GA4_PROPERTY_ID  GA4_ACCESS_TOKEN     (Data API v1beta; access token = OAuth bearer)
//
// This is READ-ONLY (it only issues query/report reads). Off-by-default — nothing imports it.

'use strict';

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const provider = (args.provider && args.provider !== true ? String(args.provider) : 'posthog').toLowerCase();
const steps = (args.steps && args.steps !== true ? String(args.steps) : '')
  .split(',').map(s => s.trim()).filter(Boolean);
const days = args.days !== undefined && args.days !== true ? Math.max(1, Number(args.days) || 14) : 14;
const segment = (args.segment && args.segment !== true ? String(args.segment) : 'source,device')
  .split(',').map(s => s.trim()).filter(Boolean);
// --segment is "given" when the flag is present at all (bare flag => default source,device dims).
const segmentGiven = args.segment !== undefined;
// --dry-run prints the constructed provider query body (works WITHOUT a key) and exits 0.
const dryRun = args['dry-run'] === true || args.dryRun === true;

// segment dimension -> PostHog event property used for the funnel breakdown.
const SEG_PROP = {
  source: '$utm_source', utm_source: '$utm_source', '$utm_source': '$utm_source',
  device: '$device_type', device_type: '$device_type', '$device_type': '$device_type'
};

if (args.help || args['-h']) { printOfflineGuidance('help'); process.exit(0); }
if (steps.length < 2) {
  console.error('error: need at least 2 --steps, e.g. --steps "view,scroll50,cta_click,purchase"');
  process.exit(1);
}

// ---------- offline guidance + recommended schema (printed when no key) ----------

function printOfflineGuidance(reason) {
  const ENVNAME = provider === 'ga4' ? 'GA4_ACCESS_TOKEN (+ GA4_PROPERTY_ID)' : 'POSTHOG_API_KEY (+ POSTHOG_PROJECT_ID)';
  console.log(`# Funnel pull — OFFLINE (no live data)`);
  if (reason !== 'help') console.log(`# Reason: ${reason}`);
  console.log(`# Set ${ENVNAME} to enable the live pull. Provider requested: ${provider}.`);
  console.log('');
  console.log(`Requested funnel (${steps.length} steps): ${steps.join('  →  ')}`);
  console.log(`Window: last ${days} days · Segment by: ${segment.join(' × ')}`);
  console.log('');
  console.log('## To enable the live pull');
  if (provider === 'ga4') {
    console.log('  export GA4_PROPERTY_ID=123456789');
    console.log('  export GA4_ACCESS_TOKEN=ya29....   # OAuth2 bearer with analytics.readonly scope');
    console.log('  # (uses the GA4 Data API v1beta runReport — read-only)');
  } else {
    console.log('  export POSTHOG_PROJECT_ID=12345');
    console.log('  export POSTHOG_API_KEY=phx_...      # a PERSONAL API key (read scope), NOT the public phc_ web key');
    console.log('  export POSTHOG_HOST=https://us.posthog.com   # or https://eu.posthog.com / self-host');
    console.log('  # (uses POST /api/projects/:id/query/ with a FunnelsQuery — read-only)');
  }
  console.log('');
  console.log('## Preview the query without a key');
  console.log('  Add --dry-run to print the exact provider query body (incl. the source × device breakdown');
  console.log('  when --segment is set) without issuing any request.');
  console.log('');
  console.log('## Exact events you must have instrumented (these step names → these events)');
  console.log('   Name events object_action, lowercase snake_case. Map your --steps to:');
  const suggested = {
    view: 'page_view', pageview: 'page_view', scroll50: 'scroll_50', scroll: 'scroll_50',
    cta: 'cta_click', cta_click: 'cta_click', click: 'cta_click', lead: 'lead_submitted',
    signup: 'signup_completed', checkout: 'checkout_started', buy: 'purchase', purchase: 'purchase'
  };
  for (const s of steps) {
    const ev = suggested[s.toLowerCase()] || s.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    console.log(`     "${s}"  →  event:  ${ev}`);
  }
  console.log('');
  console.log('## Recommended event schema (instrument once, reuse everywhere)');
  console.log(JSON.stringify({
    events: [
      { event: 'page_view', when: 'every page load' },
      { event: 'scroll_50', when: 'reader passes 50% scroll depth' },
      { event: 'cta_click', when: 'primary CTA clicked', properties: { cta_id: 'string' } },
      { event: 'checkout_started', when: 'checkout/lead form opened' },
      { event: 'purchase', when: 'order confirmed', properties: { value: 'number', currency: 'string' } }
    ],
    // Attach these properties to EVERY event so the funnel can segment source × device:
    common_properties: {
      utm_source: 'utm_source (e.g. google, naver, instagram)',
      utm_medium: 'utm_medium (cpc, email, social, organic)',
      utm_campaign: 'utm_campaign (campaign slug)',
      device_type: 'mobile | tablet | desktop',
      $current_url: 'full URL incl. query (PostHog autocaptures this)'
    },
    utm_convention: 'lowercase, hyphen-free values; lock a fixed vocabulary so source/medium don\'t fragment'
  }, null, 2));
  console.log('');
  console.log('## Why segment by source × device');
  console.log('   Read the DROP-OFF between steps, not absolute counts. The biggest %-fall step is your');
  console.log('   highest-leverage fix. A funnel that converts on desktop but dies on mobile is a mobile-');
  console.log('   friction bug, not a copy bug — only the source × device split reveals it.');
}

// ---------- live pull: PostHog ----------

function buildPosthogQuery() {
  const suggested = { view: 'page_view', pageview: 'page_view', scroll50: 'scroll_50', cta: 'cta_click', cta_click: 'cta_click', buy: 'purchase', purchase: 'purchase', checkout: 'checkout_started', signup: 'signup_completed' };
  const series = steps.map(s => ({ kind: 'EventsNode', event: suggested[s.toLowerCase()] || s.toLowerCase().replace(/[^a-z0-9]+/g, '_') }));
  const query = {
    query: {
      kind: 'FunnelsQuery',
      series,
      dateRange: { date_from: `-${days}d` },
      funnelsFilter: { funnelVizType: 'steps' }
    }
  };
  // When --segment is given, break the funnel down by source × device so the per-segment
  // drop-off matrix is computed server-side (highest-leverage diagnostic the tool used to punt).
  const breakdowns = [];
  if (segmentGiven) {
    const seen = new Set();
    for (const d of segment) {
      const prop = SEG_PROP[d.toLowerCase()];
      if (prop && !seen.has(prop)) { seen.add(prop); breakdowns.push({ type: 'event', property: prop }); }
    }
    if (breakdowns.length) {
      query.query.breakdownFilter = { breakdown_type: 'event', breakdowns };
    }
  }
  return { query, series, breakdowns };
}

async function pullPosthog() {
  const { query, series, breakdowns } = buildPosthogQuery();
  if (dryRun) {
    console.log(`# DRY-RUN — PostHog FunnelsQuery body (no request issued)`);
    console.log(`# Segment breakdown: ${breakdowns.length ? breakdowns.map(b => b.property).join(' × ') : '(none — pass --segment to enable)'}`);
    console.log(JSON.stringify(query, null, 2));
    return 0;
  }

  const key = process.env.POSTHOG_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  const host = (process.env.POSTHOG_HOST || 'https://us.posthog.com').replace(/\/+$/, '');
  if (!key) { printOfflineGuidance('POSTHOG_API_KEY not set'); return 0; }
  if (!projectId) { printOfflineGuidance('POSTHOG_PROJECT_ID not set'); return 0; }

  try {
    const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(query)
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      printOfflineGuidance(`PostHog API ${res.status} ${res.statusText} — ${body.slice(0, 200)}`);
      return 0;
    }
    const data = await res.json();
    const results = data.results || (data.result) || [];
    if (!Array.isArray(results) || results.length === 0) {
      printOfflineGuidance('PostHog returned no funnel rows (check event names / date window)');
      return 0;
    }
    const header = `PostHog · last ${days}d · project ${projectId}`;
    // With a breakdownFilter, PostHog returns one funnel (array of steps) PER segment value,
    // i.e. results is an array-of-arrays. Render the per-segment drop-off matrix in that case.
    const isBreakdown = breakdowns.length > 0 && Array.isArray(results[0]);
    if (isBreakdown) {
      printFunnelMatrix(results, header, series);
      return 0;
    }
    printFunnel(results.map((r, i) => ({
      step: steps[i] || (r.name || `step ${i + 1}`),
      event: (series[i] && series[i].event) || '',
      count: r.count != null ? r.count : (r.aggregated_value != null ? r.aggregated_value : 0)
    })), header);
    console.log('');
    if (segmentGiven) {
      console.log('Note: PostHog returned a single (un-broken-down) funnel — your project may lack the');
      console.log('breakdown properties (' + segment.join(' × ') + ') on these events. Instrument them to get the matrix.');
    } else {
      console.log('Note: pass --segment source,device to break this funnel into the per-segment drop-off matrix');
      console.log('(breaks down on $utm_source × $device_type) — the highest-leverage diagnostic.');
    }
    return 0;
  } catch (e) {
    printOfflineGuidance(`PostHog request failed: ${e && e.message ? e.message : e}`);
    return 0;
  }
}

// ---------- live pull: GA4 (best-effort; graceful) ----------

function buildGa4Report() {
  // totalUsers (user-scoped) — NOT eventCount. eventCount sums independent, non-deduplicated
  // event totals, so a noisy step reads as a funnel "leak". totalUsers counts distinct users
  // reaching each step, the closest honest approximation of a funnel via the flat runReport API.
  return {
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'totalUsers' }],
    dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: steps.map(s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_')) } } }
  };
}

function ga4FunnelWarning() {
  console.error('WARN: GA4 runReport (v1beta) cannot compute a TRUE ordered funnel — it returns per-event');
  console.error('      distinct-user totals (totalUsers), unordered and not step-sequenced. A user counted at');
  console.error('      a later step need not have passed the earlier ones, so the drop-off below is an');
  console.error('      approximation. For ordered-funnel intent use PostHog (--provider posthog, real');
  console.error('      FunnelsQuery) or GA4\'s Funnel exploration / Data API v1alpha runFunnelReport.');
}

async function pullGa4() {
  const report = buildGa4Report();
  if (dryRun) {
    console.log(`# DRY-RUN — GA4 Data API v1beta runReport body (no request issued)`);
    console.log(JSON.stringify(report, null, 2));
    ga4FunnelWarning();
    return 0;
  }
  const token = process.env.GA4_ACCESS_TOKEN;
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!token) { printOfflineGuidance('GA4_ACCESS_TOKEN not set'); return 0; }
  if (!propertyId) { printOfflineGuidance('GA4_PROPERTY_ID not set'); return 0; }
  ga4FunnelWarning();
  try {
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(report)
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      printOfflineGuidance(`GA4 Data API ${res.status} ${res.statusText} — ${body.slice(0, 200)}`);
      return 0;
    }
    const data = await res.json();
    const counts = {};
    for (const row of (data.rows || [])) counts[row.dimensionValues[0].value] = Number(row.metricValues[0].value);
    printFunnel(steps.map(s => {
      const ev = s.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      return { step: s, event: ev, count: counts[ev] || 0 };
    }), `GA4 · last ${days}d · property ${propertyId}`);
    return 0;
  } catch (e) {
    printOfflineGuidance(`GA4 request failed: ${e && e.message ? e.message : e}`);
    return 0;
  }
}

// ---------- render ----------

function renderSteps(rows) {
  const top = rows.length && rows[0].count > 0 ? rows[0].count : 0;
  let prev = null;
  for (const r of rows) {
    const fromTop = top > 0 ? (r.count / top) : 0;
    const dropFromPrev = prev != null && prev > 0 ? (1 - r.count / prev) : 0;
    const drop = prev == null ? '   —   ' : `−${(dropFromPrev * 100).toFixed(1)}%`;
    console.log(
      `  ${String(r.step).padEnd(16)} ${String(r.event).padEnd(20)} ` +
      `${String(r.count).padStart(10)}   ${(fromTop * 100).toFixed(1).padStart(5)}% of top   drop ${drop}`
    );
    prev = r.count;
  }
}

function printFunnel(rows, header) {
  console.log(`# Funnel — ${header}`);
  console.log('');
  renderSteps(rows);
  console.log('');
  console.log('  → Biggest %-drop step = your highest-leverage fix. Segment it (source × device) before deciding why.');
}

// Per-segment drop-off matrix: one funnel block per breakdown value (source × device combo).
function printFunnelMatrix(funnels, header, series) {
  console.log(`# Funnel matrix (${segment.join(' × ')}) — ${header}`);
  for (const f of funnels) {
    if (!Array.isArray(f) || f.length === 0) continue;
    let bv = f[0].breakdown_value;
    bv = Array.isArray(bv) ? bv.join(' × ') : (bv == null || bv === '' ? '(unset)' : String(bv));
    console.log('');
    console.log(`## segment: ${bv}`);
    renderSteps(f.map((r, i) => ({
      step: steps[i] || r.name || `step ${i + 1}`,
      event: (series[i] && series[i].event) || r.name || '',
      count: r.count != null ? r.count : (r.aggregated_value != null ? r.aggregated_value : 0)
    })));
  }
  console.log('');
  console.log('  → Compare the SAME step across segments: the segment with the steepest %-drop is where to');
  console.log('    focus. A funnel that converts on desktop but dies on mobile is a friction bug, not copy.');
}

// ---------- dispatch ----------

(async () => {
  let code = 0;
  if (provider === 'posthog') code = await pullPosthog();
  else if (provider === 'ga4') code = await pullGa4();
  else { printOfflineGuidance(`unknown --provider "${provider}" (use posthog | ga4)`); code = 0; }
  process.exit(code || 0);
})();
