// The forecast ledger: what's due for review, and how well calibrated the ledger is.
// Node 18+, no dependencies.
//
//   node ledger.mjs due 2027-03-31     open rows to review on that date, with their P50 and P80
//   node ledger.mjs score 2028-12-31   calibration on that date, from the rows marked hit or miss
//   node ledger.mjs table              the ledger as a Markdown table
//   add --ledger my-ledger.json to use your own ledger, same shape

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const li = args.indexOf('--ledger');
const file = li === -1 ? join(here, 'ledger.json') : args[li + 1];
const positional = li === -1 ? args : args.filter((_, i) => i !== li && i !== li + 1);
const [cmd = 'table', dateArg] = positional;
const ledger = JSON.parse(readFileSync(file, 'utf8'));
const asOf = dateArg ?? new Date().toISOString().slice(0, 10);

const isQuarterEnd = (d) => ['03-31', '06-30', '09-30', '12-31'].includes(d.slice(5));
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
  console.error(`Give a date as YYYY-MM-DD, not "${asOf}".`);
  process.exit(2);
}

if (cmd === 'due') {
  const due = ledger.rows.filter((r) => r.status === 'open' && r.first_review <= asOf);
  console.log(`${due.length} of ${ledger.rows.length} forecasts due for review on ${asOf}${isQuarterEnd(asOf) ? '' : ' (not a quarter end)'}:\n`);
  for (const r of due) {
    const p50 = days(asOf, r.p50);
    const p80 = days(asOf, r.p80);
    console.log(`${r.id}  ${r.forecast}`);
    console.log(`  P50 ${r.p50} (${p50 >= 0 ? `${p50} days away` : `passed ${-p50} days ago`}), P80 ${r.p80} (${p80 >= 0 ? `${p80} days away` : `passed ${-p80} days ago`})`);
    if (r.too_fast_before) console.log(`  A hit before ${r.too_fast_before} counts as a miss of "slowly".`);
    console.log(`  Wrong if: ${r.wrong_if}`);
    if (p80 < 0) console.log('  The P80 date has passed: mark it hit or miss at this review.');
    console.log('');
  }
  const notYet = ledger.rows.filter((r) => r.status === 'open' && r.first_review > asOf);
  if (notYet.length) console.log(`Not yet due: ${notYet.map((r) => `${r.id} (first review ${r.first_review})`).join(', ')}.`);
} else if (cmd === 'score') {
  // A row counts towards a quantile once its date has passed, or once it has resolved.
  const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : 'n/a');
  const byQuantile = (q) => {
    const rows = ledger.rows.filter((r) => r[q] <= asOf || r.status !== 'open');
    const hits = rows.filter((r) => r.status === 'hit' && r.hit_on && r.hit_on <= r[q] && !(r.too_fast_before && r.hit_on < r.too_fast_before));
    return { rows: rows.length, hits: hits.length };
  };
  const p50 = byQuantile('p50');
  const p80 = byQuantile('p80');
  console.log(`Calibration on ${asOf}, ${ledger.rows.length} forecasts in the ledger.`);
  console.log(`  By their P50 dates: ${p50.hits} of ${p50.rows} came true (${pct(p50.hits, p50.rows)}; a calibrated ledger is near 50%).`);
  console.log(`  By their P80 dates: ${p80.hits} of ${p80.rows} came true (${pct(p80.hits, p80.rows)}; a calibrated ledger is near 80%).`);
  const fast = ledger.rows.filter((r) => r.status === 'hit' && r.too_fast_before && r.hit_on < r.too_fast_before);
  if (fast.length) console.log(`  Too fast, so scored as misses: ${fast.map((r) => r.id).join(', ')}.`);
  if (!p50.rows && !p80.rows) {
    const next = ledger.rows.map((r) => r.p50).sort()[0];
    console.log(`  Nothing to score yet: the first P50 date is ${next}.`);
  }
} else if (cmd === 'table') {
  console.log('| ID | Made on | Forecast | P50 | P80 | First review | Wrong if | Status |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const r of ledger.rows) {
    const status = r.status === 'open' ? 'Open' : `${r.status === 'hit' ? 'Hit' : 'Miss'}${r.hit_on ? ` ${r.hit_on}` : ''}`;
    console.log(`| ${r.id} | ${r.made_on ?? 'on publication'} | ${r.forecast} | ${r.p50} | ${r.p80} | ${r.first_review} | ${r.wrong_if} | ${status} |`);
  }
} else {
  console.error(`Unknown command "${cmd}". Use due, score or table.`);
  process.exit(2);
}
