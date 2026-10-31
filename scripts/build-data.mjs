// Builds data.json for the dashboard from raw query results. Deterministic:
// the daily agent only SAVES what each source returned into an input folder;
// every sum and every rule lives here, so it can be tested and re-run.
//
//   node scripts/build-data.mjs <inputDir> [outFile=data.json]
//
// Inputs (JSON, in <inputDir>):
//   shopifyql.json    { rows: [[month, order_tags, orders, total_sales, cogs], ...] }
//                     ShopifyQL: FROM sales SHOW orders, total_sales, cost_of_goods_sold
//                     GROUP BY month, order_tags WHERE customer_tags NOT CONTAINS 'Offline_Customer'
//   sources.json      { rows: [{month, source, campaign, orders, revenue}, ...] }
//                     from attribution_orders (in scope), one row per month/source/campaign
//   customers.json    { rows: [{month, new_customers, returning_customers}, ...] }
//   ads.json          { rows: [{month, campaign, spend}, ...] }   Google Ads, via Windsor
// And, from the repo: openai-spend.json (manual / estimated, see that file).
//
// Existing months in the output file that are NOT in this run are kept, so
// history accumulates and a short refresh never erases an older month.
import fs from 'node:fs';
import path from 'node:path';

const [inDir, outFile = 'data.json'] = process.argv.slice(2);
if (!inDir) {
  console.error('usage: node scripts/build-data.mjs <inputDir> [outFile]');
  process.exit(2);
}

const read = (f, fallback) => {
  const p = path.join(inDir, f);
  if (!fs.existsSync(p)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing input ${p}`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};
const num = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[$,]/g, ''));
  if (Number.isNaN(n)) throw new Error(`not a number: ${JSON.stringify(v)}`);
  return n;
};
const monthKey = (v) => String(v).slice(0, 7); // '2026-08-01' or '2026-08' -> '2026-08'
const round2 = (n) => Math.round(n * 100) / 100;

const months = {};
const m = (k) => (months[k] ||= { orders: 0, revenue: 0, cogs: 0, newCustomers: 0, returningCustomers: 0, googleSpend: {}, bySource: {}, byCampaign: {} });

// 1. Orders / sales / COGS. Pop-up store orders are the groups whose tag list
//    carries a `store:<slug>` tag; they are left out, exactly as the Shopify AI
//    prompt did ("excluded orders from the stores"). Offline customers were
//    already filtered inside the query. Verified Aug 2026: orders 95, sales
//    $95,817.78, COGS $48,793.70 — to the cent the same as the sheet.
for (const [month, tags, orders, sales, cogs] of read('shopifyql.json').rows) {
  if (String(tags).split(',').some((t) => t.trim().toLowerCase().startsWith('store:'))) continue;
  const o = m(monthKey(month));
  o.shopifyqlOrders = (o.shopifyqlOrders || 0) + num(orders);
  o.revenue += num(sales);
  o.cogs += num(cogs);
}

// 2b (below) sets the order COUNT from our own in-scope orders: ShopifyQL counts
//    $0 draft orders in a way the sheet never did (96 vs the sheet's 95 for Aug
//    2026), while sales and COGS match to the cent. Sales and COGS stay Shopify's.
//
// 2. Where the orders came from (our own classifier; order totals, so these
//    do not sum to the Shopify sales figure above — they are shares, not ledger).
for (const r of read('sources.json').rows) {
  const o = m(monthKey(r.month));
  const s = (o.bySource[r.source] ||= { orders: 0, revenue: 0 });
  s.orders += num(r.orders);
  s.revenue += num(r.revenue);
  if (r.source === 'ads-google' && r.campaign) {
    const c = (o.byCampaign[r.campaign] ||= { orders: 0, revenue: 0 });
    c.orders += num(r.orders);
    c.revenue += num(r.revenue);
  }
}

for (const o of Object.values(months)) {
  const n = Object.values(o.bySource).reduce((a, s) => a + s.orders, 0);
  o.orders = n > 0 ? n : o.shopifyqlOrders || 0;
  delete o.shopifyqlOrders;
}

// 3. New vs returning customers, by Shopify's own order number for the customer.
for (const r of read('customers.json').rows) {
  const o = m(monthKey(r.month));
  o.newCustomers = num(r.new_customers);
  o.returningCustomers = num(r.returning_customers);
}

// 4. Google Ads spend per campaign. Windsor returns one row per campaign per
//    DAY ({campaign, date, spend}); a pre-aggregated {month} row is accepted too.
//    Windsor's campaign names are longer than the labels the sheet uses, so the
//    dashboard keeps one line per campaign by mapping them here.
const CAMPAIGN_LABELS = {
  'DGen | Hats | Remarketing #2': 'DGen',
  'DR | Display Dynamic Remarketing': 'DR | Remarketing',
};
for (const r of read('ads.json').rows) {
  const o = m(monthKey(r.month ?? r.date));
  const name = CAMPAIGN_LABELS[r.campaign] || r.campaign;
  o.googleSpend[name] = (o.googleSpend[name] || 0) + num(r.spend);
}
for (const o of Object.values(months)) for (const k of Object.keys(o.googleSpend)) o.googleSpend[k] = round2(o.googleSpend[k]);

// 5. OpenAI ads: no API yet. `actuals` wins; otherwise daily budget x days
//    run so far, flagged as an estimate.
const openai = JSON.parse(fs.readFileSync(new URL('../openai-spend.json', import.meta.url), 'utf8'));
const today = (process.env.BUILD_TODAY || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }));
function openAiFor(key) {
  if (openai.actuals && key in openai.actuals) return { spend: num(openai.actuals[key]), estimated: false };
  const start = new Date(openai.startDate + 'T00:00:00Z');
  const [y, mo] = key.split('-').map(Number);
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const last = new Date(Date.UTC(y, mo, 0));
  const end = new Date(today + 'T00:00:00Z');
  const from = start > first ? start : first;
  const to = end < last ? end : last;
  const days = Math.max(0, Math.round((to - from) / 86400000) + 1);
  return { spend: round2(days * num(openai.dailyBudget)), estimated: days > 0 };
}

// 6. Derived figures, using the same formulas the sheet's rows use.
for (const [key, o] of Object.entries(months)) {
  o.revenue = round2(o.revenue);
  o.cogs = round2(o.cogs);
  const oa = openAiFor(key);
  o.openAiSpend = oa.spend;
  o.openAiEstimated = oa.estimated;
  o.googleSpendTotal = round2(Object.values(o.googleSpend).reduce((a, b) => a + b, 0));
  o.totalAdSpend = round2(o.googleSpendTotal + o.openAiSpend);
}

// 7. Merge into the existing file; this run's months replace theirs.
let existing = { months: {} };
if (fs.existsSync(outFile)) {
  try {
    existing = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  } catch {
    /* a corrupt file is rebuilt from this run */
  }
}
const out = {
  generatedAt: new Date().toISOString(),
  note: 'Built by scripts/build-data.mjs. OpenAI spend is an estimate when openAiEstimated is true.',
  months: { ...(existing.months || {}), ...months },
};
out.months = Object.fromEntries(Object.entries(out.months).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${outFile}: ${Object.keys(months).join(', ')}`);
