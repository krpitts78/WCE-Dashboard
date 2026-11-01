// Regression check: the fixture is the Aug 2026 ShopifyQL result that matched
// Kelly's hand-kept sheet to the cent (95 orders, $95,817.78 sales, $48,793.70
// COGS), so a change to the store/offline rules shows up here first.
//   node scripts/check-build-data.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-')), 'data.json');
execFileSync('node', ['scripts/build-data.mjs', 'scripts/fixture', out], { env: { ...process.env, BUILD_TODAY: '2026-10-31' }, stdio: 'pipe' });
const m = JSON.parse(fs.readFileSync(out, 'utf8')).months['2026-08'];
let bad = 0;
const eq = (name, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`}`); };
eq('order count = our in-scope orders (ShopifyQL says 96)', m.orders, 95);
eq('sales to the cent', m.revenue, 95817.78);
eq('COGS to the cent', m.cogs, 48793.7);
eq('daily Windsor rows roll up to the sheet label', m.googleSpend, { 'SH | Hats': 807.37, DGen: 20.48 });
eq('Google total', m.googleSpendTotal, 827.85);
eq('OpenAI not started in August', m.openAiSpend, 0);
eq('new / returning carried through', [m.newCustomers, m.returningCustomers], [65, 24]);
const st = JSON.parse(fs.readFileSync(out, 'utf8')).stores;
const ff = st.find((r) => r.slug === 'faithfulfridayshirts' && r.month === '2026-07');
eq('store COGS joins on the store: tag', [ff.cogs, ff.cogsSales], [1793.32, 4949.74]);
eq('pay-later store has no COGS, not zero', st.find((r) => r.slug === 'ncs-employee-store').cogs, null);
const off = JSON.parse(fs.readFileSync(out, 'utf8')).offline;
const oa = off.find((r) => r.month === '2026-08');
eq('offline sales leave the store: groups to the Pop-up Stores tab', [oa.sales, oa.cogs, oa.orders], [38661.02, 15061.59, 49]);
// A month that has ad spend but no orders yet (the 1st of a month) must not appear as a row of zeros.
{
  const dir0 = fs.mkdtempSync(path.join(os.tmpdir(), 'bd0-'));
  for (const f of fs.readdirSync('scripts/fixture')) fs.copyFileSync(path.join('scripts/fixture', f), path.join(dir0, f));
  const ads = JSON.parse(fs.readFileSync(path.join(dir0, 'ads.json'), 'utf8'));
  ads.rows.push({ month: '2026-11', campaign: 'SH | Hats', spend: 68.21 });
  fs.writeFileSync(path.join(dir0, 'ads.json'), JSON.stringify(ads));
  execFileSync('node', ['scripts/build-data.mjs', dir0, path.join(dir0, 'x.json')], { env: { ...process.env, BUILD_TODAY: '2026-11-01' }, stdio: 'pipe' });
  eq('a month with spend but no orders is left out', '2026-11' in JSON.parse(fs.readFileSync(path.join(dir0, 'x.json'), 'utf8')).months, false);
}
// A mistyped row must stop the build, not publish.
const broken = JSON.parse(fs.readFileSync('scripts/fixture/shopifyql.json','utf8'));
broken.rows[1][3] = '89120.99';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bd2-'));
for (const f of fs.readdirSync('scripts/fixture')) fs.copyFileSync(path.join('scripts/fixture', f), path.join(dir, f));
fs.writeFileSync(path.join(dir, 'shopifyql.json'), JSON.stringify(broken));
let stopped = false;
try { execFileSync('node', ['scripts/build-data.mjs', dir, path.join(dir, 'x.json')], { stdio: 'pipe' }); } catch { stopped = true; }
eq('a mistyped ShopifyQL row stops the build', stopped, true);
console.log(bad ? `\n${bad} FAILED` : '\nall passed');
process.exit(bad ? 1 : 0);
