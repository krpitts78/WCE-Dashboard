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
console.log(bad ? `\n${bad} FAILED` : '\nall passed');
process.exit(bad ? 1 : 0);
