// The accepted-output ledger. Give it one row per round of work on an output (what the agent and the generators used,
// what you decided at the end of the round, and how long you spent looking) and a file of list prices. It gives back
// what each accepted output cost: every round up to the yes, not only the round you kept.
//
//   node ledger.mjs examples/look-film-2026-10-30.csv
//   node ledger.mjs my-ledger.csv --prices prices-2026-10-30.json --rate 90 --out runs/my-name
//
// One row per round and model; rows with the same output and round add up, so a round that used two models has two
// rows. `decision` is accepted, sent-back, rejected or open: the three words of the film receipt schema this came from,
// plus open for a round that is still waiting. An accepted row needs `decided_by` and `decided_at`, because acceptance
// is a person's name and a date or it is absent. --rate is what an hour of the reviewer's time is worth to you; without
// it the ledger reports the hourly rate at which the review would cost as much as the machines. Needs Node 18 or later;
// no packages, no key, no network.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const file = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!file) { console.error('usage: node ledger.mjs <ledger.csv> [--prices prices-YYYY-MM-DD.json] [--rate usd-per-hour] [--out dir]'); process.exit(2); }

// The newest prices-*.json beside this script, unless one is named.
const newestPrices = () => readdirSync(HERE).filter((f) => /^prices-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().pop();
const pricesFile = resolve(opt('prices', join(HERE, newestPrices() ?? 'prices.json')));
const PRICES = JSON.parse(readFileSync(pricesFile, 'utf8'));
const RATE = opt('rate', null) === null ? null : Number(opt('rate'));
if (RATE !== null && !(RATE >= 0)) { console.error('--rate must be a number of dollars per hour'); process.exit(2); }

// A small CSV reader: commas, double quotes, a header row.
function csv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some((c) => c !== '')) rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  row.push(cell); if (row.some((c) => c !== '')) rows.push(row);
  const [head, ...body] = rows;
  return body.map((r, n) => ({ _line: n + 2, ...Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])) }));
}

const DECISIONS = ['accepted', 'sent-back', 'rejected', 'open'];
const NUMBERS = ['uncached_in', 'cache_read', 'cache_write', 'out_tokens', 'gen_units', 'takes', 'other_usd', 'review_min_low', 'review_min_high'];
const rows = csv(readFileSync(file, 'utf8'));
const faults = new Set();
faults.push = faults.add;
// A blank cell, or a column the ledger leaves out, counts as zero.
const num = (r, k) => {
  if (r[k] === '' || r[k] === undefined) return 0;
  const v = Number(r[k]);
  if (!Number.isFinite(v) || v < 0) faults.push(`line ${r._line}: ${k} "${r[k]}" is not a number of zero or more`);
  return Number.isFinite(v) && v >= 0 ? v : 0;
};

// What one row cost at the list prices: the agent's tokens, the generator's units and any cost recorded as dollars.
function price(r) {
  const out = { agent: 0, generation: 0, other: num(r, 'other_usd') };
  for (const k of NUMBERS) num(r, k);
  if (r.model) {
    const p = PRICES.models[r.model];
    if (!p) faults.push(`line ${r._line}: no price for model "${r.model}" in ${basename(pricesFile)}`);
    else if (p.kind !== 'tokens') faults.push(`line ${r._line}: "${r.model}" is priced per ${p.unit}; put it in gen_model`);
    else out.agent = num(r, 'uncached_in') * p.input + num(r, 'cache_read') * (p.cache_read ?? p.input)
      + num(r, 'cache_write') * (p.cache_write ?? p.input) + num(r, 'out_tokens') * p.output;
  }
  if (r.gen_model) {
    const p = PRICES.models[r.gen_model];
    if (!p) faults.push(`line ${r._line}: no price for generator "${r.gen_model}" in ${basename(pricesFile)}`);
    else if (p.kind !== 'per-unit') faults.push(`line ${r._line}: "${r.gen_model}" is priced in tokens; put it in model`);
    else out.generation = num(r, 'gen_units') * p.per_unit;
  }
  return out;
}

for (const r of rows) {
  if (!r.output) faults.push(`line ${r._line}: no output named`);
  if (!Number.isInteger(Number(r.round)) || Number(r.round) < 1) faults.push(`line ${r._line}: round "${r.round}" is not a whole number from 1`);
  if (!DECISIONS.includes(r.decision)) faults.push(`line ${r._line}: decision "${r.decision}" is not one of ${DECISIONS.join(', ')}`);
  if (r.decision === 'accepted' && !(r.decided_by && r.decided_at)) faults.push(`line ${r._line}: an acceptance needs decided_by and decided_at (a person's name and a date)`);
  if (num(r, 'review_min_high') < num(r, 'review_min_low')) faults.push(`line ${r._line}: review_min_high is below review_min_low`);
  r._cost = price(r);
}
// Every row of one round must record the same decision.
const roundKey = (r) => `${r.output}\u0000${Number(r.round)}`;
const decisionOf = new Map();
for (const r of rows) {
  const k = roundKey(r), d = decisionOf.get(k);
  if (d && d !== r.decision) faults.push(`line ${r._line}: round ${r.round} of "${r.output}" has two decisions (${d} and ${r.decision})`);
  decisionOf.set(k, d ?? r.decision);
}
if (faults.size) { console.error(`${faults.size} problem(s) in ${file}:\n  ${[...faults].join('\n  ')}`); process.exit(1); }

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const round6 = (x) => Math.round(x * 1e6) / 1e6;
// Where the agent's money went, by kind of token, over a set of rows priced in tokens.
function tokenSplit(rs) {
  const s = { uncached_in: 0, cache_read: 0, cache_write: 0, out: 0 };
  for (const r of rs) {
    const p = r.model && PRICES.models[r.model];
    if (!p) continue;
    s.uncached_in += num(r, 'uncached_in') * p.input; s.cache_read += num(r, 'cache_read') * (p.cache_read ?? p.input);
    s.cache_write += num(r, 'cache_write') * (p.cache_write ?? p.input); s.out += num(r, 'out_tokens') * p.output;
  }
  return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, round6(v)]));
}
const outputs = [...new Set(rows.map((r) => r.output))].map((name) => {
  const mine = rows.filter((r) => r.output === name);
  const rounds = [...new Set(mine.map((r) => Number(r.round)))].sort((a, b) => a - b).map((n) => {
    const rs = mine.filter((r) => Number(r.round) === n);
    const agent = sum(rs.map((r) => r._cost.agent)), generation = sum(rs.map((r) => r._cost.generation)), other = sum(rs.map((r) => r._cost.other));
    const first = rs[0];
    return {
      round: n, started: first.started, ended: rs.map((r) => r.ended).filter(Boolean).sort().pop() ?? '', what: rs.map((r) => r.what).filter(Boolean).join('; '),
      decision: first.decision, decided_by: rs.find((r) => r.decided_by)?.decided_by ?? '', decided_at: rs.find((r) => r.decided_at)?.decided_at ?? '',
      models: rs.map((r) => r.model).filter(Boolean), generators: rs.map((r) => r.gen_model).filter(Boolean),
      tokens: { uncached_in: sum(rs.map((r) => num(r, 'uncached_in'))), cache_read: sum(rs.map((r) => num(r, 'cache_read'))),
        cache_write: sum(rs.map((r) => num(r, 'cache_write'))), out: sum(rs.map((r) => num(r, 'out_tokens'))) },
      takes: sum(rs.map((r) => num(r, 'takes'))),
      usd: { agent: round6(agent), generation: round6(generation), other: round6(other), total: round6(agent + generation + other) },
      review_min: { low: sum(rs.map((r) => num(r, 'review_min_low'))), high: sum(rs.map((r) => num(r, 'review_min_high'))) },
    };
  });
  const k = rounds.findIndex((r) => r.decision === 'accepted');
  const total = sum(rounds.map((r) => r.usd.total));
  const last = rounds[rounds.length - 1];
  const status = k < 0 ? (last.decision === 'rejected' ? 'rejected' : 'not accepted yet')
    : last.decision === 'accepted' ? 'accepted' : `accepted in round ${rounds[k].round}, then reopened (round ${last.round} is ${last.decision})`;
  const o = { output: name, status, rounds: rounds.length, spent_usd: round6(total), review_min: { low: sum(rounds.map((r) => r.review_min.low)), high: sum(rounds.map((r) => r.review_min.high)) } };
  if (k >= 0) {
    const upTo = rounds.slice(0, k + 1), kept = rounds[k];
    const cost = sum(upTo.map((r) => r.usd.total));
    const low = sum(upTo.map((r) => r.review_min.low)), high = sum(upTo.map((r) => r.review_min.high));
    o.first_acceptance = {
      round: kept.round, by: kept.decided_by, at: kept.decided_at,
      cost_usd: round6(cost), kept_round_usd: kept.usd.total,
      times_the_kept_round: kept.usd.total > 0 ? Math.round((cost / kept.usd.total) * 10) / 10 : null,
      share_on_rounds_not_kept: cost > 0 ? Math.round(((cost - kept.usd.total) / cost) * 1000) / 1000 : 0,
      rounds_sent_back: upTo.filter((r) => r.decision === 'sent-back').length,
      by_kind_usd: { agent: round6(sum(upTo.map((r) => r.usd.agent))), generation: round6(sum(upTo.map((r) => r.usd.generation))), other: round6(sum(upTo.map((r) => r.usd.other))) },
      agent_usd_by_token: tokenSplit(mine.filter((r) => Number(r.round) <= kept.round)),
      review_min: { low: Math.round(low * 100) / 100, high: Math.round(high * 100) / 100 },
      // The hourly rate at which the reviewer's minutes would cost as much as everything else.
      breakeven_usd_per_hour: { at_high_minutes: high > 0 ? Math.round(cost / (high / 60)) : null, at_low_minutes: low > 0 ? Math.round(cost / (low / 60)) : null },
      ...(RATE !== null ? { with_review_usd: { low: round6(cost + (low / 60) * RATE), high: round6(cost + (high / 60) * RATE) } } : {}),
    };
    const after = rounds.slice(k + 1);
    if (after.length) o.after_acceptance = { rounds: after.length, cost_usd: round6(sum(after.map((r) => r.usd.total))), last_decision: last.decision };
  }
  o.round_detail = rounds;
  return o;
});

const accepted = outputs.filter((o) => o.first_acceptance).length;
const spent = sum(outputs.map((o) => o.spent_usd));
const result = {
  ledger: file, prices: basename(pricesFile), prices_read_on: PRICES.read_on, rate_usd_per_hour: RATE,
  rule: 'Every round counts, up to and including the round a person accepted. Counts are priced at list prices, and costs already recorded in dollars are added as they are.',
  outputs, set: { outputs: outputs.length, accepted_at_least_once: accepted, spent_usd: round6(spent),
    spent_per_output_accepted_usd: accepted ? round6(spent / accepted) : null, agent_usd_by_token: tokenSplit(rows) },
};

// The report.
const money = (x) => (x === 0 ? '–' : x >= 1 ? `$${x.toFixed(2)}` : x >= 0.01 ? `$${x.toFixed(3)}` : `$${x.toFixed(4)}`);
const one = (x) => (Math.round(x * 10) / 10).toFixed(1);
const mins = (lo, hi) => (lo === hi ? one(hi) : `${one(lo)}–${one(hi)}`);
const short = (t) => (t ? t.replace('T', ' ').replace(/:\d\d(\.\d+)?Z$/, 'Z') : '');
const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const split = (t) => { const tt = sum(Object.values(t)); return tt > 0 ? `re-reading cached context ${Math.round((100 * t.cache_read) / tt)}%, writing to the cache ${Math.round((100 * t.cache_write) / tt)}%, output ${Math.round((100 * t.out) / tt)}%, uncached input ${Math.round((100 * t.uncached_in) / tt)}%` : ''; };
const lines = [`# What each accepted output cost`, '',
  `Ledger: \`${file}\`. Prices: \`${basename(pricesFile)}\`, read ${PRICES.read_on} from ${PRICES.source}. ${result.rule}`, ''];
for (const o of outputs) {
  lines.push(`## ${o.output}`, '', `Status: ${o.status}.`, '',
    '| Round | Started | Ended | What | Decision | Agent | Generation | Other | Round total | Review minutes |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const r of o.round_detail) lines.push(`| ${r.round} | ${short(r.started)} | ${short(r.ended)} | ${r.what} | ${r.decision}${r.decided_at ? ` (${r.decided_by}, ${short(r.decided_at)})` : ''} | ${money(r.usd.agent)} | ${money(r.usd.generation)} | ${money(r.usd.other)} | ${money(r.usd.total)} | ${mins(r.review_min.low, r.review_min.high)} |`);
  lines.push('');
  const f = o.first_acceptance;
  if (f) {
    const rate = (x) => `$${x.toLocaleString('en-GB')}`;
    lines.push(`- **To the first acceptance** (round ${f.round}, ${f.by}, ${short(f.at)}): ${money(f.cost_usd)} at list price, over ${count(f.round, 'round')}, ${f.rounds_sent_back} of them sent back.`,
      `- **The round that was kept** cost ${money(f.kept_round_usd)} on its own, so the accepted output cost **${f.times_the_kept_round} times** the round you kept, and **${Math.round(f.share_on_rounds_not_kept * 100)}%** went on rounds before it.`,
      `- **By kind:** agent ${money(f.by_kind_usd.agent)}, generation ${money(f.by_kind_usd.generation)}, other recorded costs ${money(f.by_kind_usd.other)}.`,
      split(f.agent_usd_by_token) ? `- **The agent's share by kind of token:** ${split(f.agent_usd_by_token)}.` : '',
      `- **Review:** ${mins(f.review_min.low, f.review_min.high)} minutes. At ${one(f.review_min.high)} minutes, the review costs more than the machines only above **${rate(f.breakeven_usd_per_hour.at_high_minutes)} an hour**${f.breakeven_usd_per_hour.at_low_minutes ? ` (at ${one(f.review_min.low)} minutes, above ${rate(f.breakeven_usd_per_hour.at_low_minutes)})` : ''}.`);
    if (f.with_review_usd) lines.push(`- **With your time at $${RATE} an hour:** ${money(f.with_review_usd.low)} to ${money(f.with_review_usd.high)}.`);
    if (o.after_acceptance) lines.push(`- **After the acceptance:** ${count(o.after_acceptance.rounds, 'more round')}, ${money(o.after_acceptance.cost_usd)}; the last is ${o.after_acceptance.last_decision}.`);
  } else lines.push(`- **No acceptance yet.** ${money(o.spent_usd)} spent over ${count(o.rounds, 'round')}; the cost per accepted output is undefined until a person says yes.`);
  lines.push('');
}
lines.push('## All outputs', '',
  `- ${count(result.set.outputs, 'output')}, ${accepted} accepted at least once, ${money(spent)} spent in all${accepted ? `: ${money(result.set.spent_per_output_accepted_usd)} per output accepted` : ''}.`,
  split(result.set.agent_usd_by_token) ? `- The agent's share by kind of token, every round: ${split(result.set.agent_usd_by_token)}.` : '',
  '', 'Read the ledger with its limits: list prices are not what any plan charges, the review minutes are bounds unless you timed yourself, and an acceptance holds only until the bar moves.', '');
const report = lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
console.log(report);
const outDir = opt('out', null);
if (outDir) {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'results.md'), report);
  writeFileSync(join(outDir, 'results.json'), JSON.stringify(result, null, 1) + '\n');
  console.error(`wrote ${join(outDir, 'results.md')} and results.json`);
}
