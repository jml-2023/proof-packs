// Scores the runs made by run.mjs: how often each design agreed with the readers, what it cost, how long its calls
// took, and which is the cheapest design within the noise of the best. Makes no calls and costs nothing.
//
//   node compare.mjs                 the latest day in runs/
//   DAY=2026-10-30 node compare.mjs  one day
//
// Writes results-<day>.json and results-<day>.md beside this file.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(join(HERE, 'runs')).filter((f) => /-\d{4}-\d{2}-\d{2}\.json$/.test(f));
const DAY = process.env.DAY || files.map((f) => f.slice(-15, -5)).sort().at(-1);
const runs = files.filter((f) => f.endsWith(`-${DAY}.json`)).map((f) => JSON.parse(readFileSync(join(HERE, 'runs', f), 'utf8')));
if (!runs.length) { console.error(`no runs for ${DAY}`); process.exit(1); }
const order = JSON.parse(readFileSync(join(HERE, 'designs.json'), 'utf8')).designs.map((d) => d.id);
runs.sort((a, b) => order.indexOf(a.design.id) - order.indexOf(b.design.id));

// Seeded, so the intervals come out the same every time on the same runs.
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const B = 2000;
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); if (!s.length) return null; const i = (s.length - 1) * p; const lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
const round = (x, d = 3) => (x == null ? null : Number(x.toFixed(d)));
const key = (j) => `${j.set}:${j.k}`;

// Per design: each pair's answered judgements (0 to 2, one per order), so a bootstrap can resample pairs.
const designs = runs.map((r) => {
  const js = r.calls.flatMap((c) => c.judgements);
  const answered = js.filter((j) => j.picked);
  const byPair = new Map();
  for (const j of answered) { if (!byPair.has(key(j))) byPair.set(key(j), []); byPair.get(key(j)).push(j); }
  const usd = r.calls.reduce((s, c) => s + (c.cost_usd || 0), 0);
  const tok = (f) => r.calls.reduce((s, c) => s + (Number(f(c.usage || {})) || 0), 0);
  const okCalls = r.calls.filter((c) => c.ok);
  return { r, id: r.design.id, js, answered, byPair, usd,
    tokens: { prompt: tok((u) => u.prompt_tokens), completion: tok((u) => u.completion_tokens), reasoning: tok((u) => u.completion_tokens_details?.reasoning_tokens) },
    costSource: [...new Set(r.calls.map((c) => c.cost_source))].join('+'),
    callMs: okCalls.map((c) => c.ms), callUsd: okCalls.map((c) => c.cost_usd) };
});

const PAIRS = [...new Set(designs.flatMap((d) => [...d.byPair.keys()]))];
const SETS = { clear: PAIRS.filter((p) => p.startsWith('clear:')), close: PAIRS.filter((p) => p.startsWith('close:')), all: PAIRS };
const acc = (d, pairs) => { let n = 0, right = 0; for (const p of pairs) for (const j of d.byPair.get(p) || []) { n++; right += j.picked_winner ? 1 : 0; } return n ? right / n : null; };
const count = (d, pairs) => { let n = 0, right = 0; for (const p of pairs) for (const j of d.byPair.get(p) || []) { n++; right += j.picked_winner ? 1 : 0; } return [right, n]; };
// Resample pairs within each set, so every resample keeps the clear/close mix.
function resample(r, set) {
  if (set !== 'all') return SETS[set].map(() => SETS[set][Math.floor(r() * SETS[set].length)]);
  return [...resample(r, 'clear'), ...resample(r, 'close')];
}
function interval(f, set, seed) { const r = rng(seed); const xs = []; for (let b = 0; b < B; b++) { const v = f(resample(r, set)); if (v != null) xs.push(v); } return [round(pct(xs, 0.025)), round(pct(xs, 0.975))]; }

// The answer changed with the order: right in one order and wrong in the other.
function flips(d, set) {
  let n = 0, f = 0;
  for (const p of SETS[set]) { const js = d.byPair.get(p) || []; if (js.length === 2) { n++; f += js[0].picked_winner !== js[1].picked_winner ? 1 : 0; } }
  return [f, n];
}

const rows = designs.map((d) => {
  const [right, n] = count(d, SETS.all);
  const failedCalls = d.r.calls.filter((c) => !c.ok).length;
  return { id: d.id, label: d.r.design.label, family: d.r.design.family, band: d.r.design.band, model: d.r.design.model,
    per_call: d.r.design.per_call, prompt: d.r.design.prompt, reasoning: d.r.design.reasoning || null, rerun_of: d.r.design.rerun_of || null,
    calls: d.r.calls.length, failed_calls: failedCalls, judgements: d.js.length, answered: n, right,
    clear: { right_of: count(d, SETS.clear), accuracy: round(acc(d, SETS.clear)), ci95: interval((s) => acc(d, s), 'clear', 11) },
    close: { right_of: count(d, SETS.close), accuracy: round(acc(d, SETS.close)), ci95: interval((s) => acc(d, s), 'close', 12) },
    all: { right_of: [right, n], accuracy: round(right / n), ci95: interval((s) => acc(d, s), 'all', 13) },
    by_order: Object.fromEntries(['winner-first', 'loser-first'].map((o) => { const js = d.answered.filter((j) => j.order === o); return [o, { right_of: [js.filter((j) => j.picked_winner).length, js.length], accuracy: round(js.filter((j) => j.picked_winner).length / js.length) }]; })),
    picked_A_share: round(d.answered.filter((j) => j.picked === 'A').length / n),
    order_flips: { clear: flips(d, 'clear'), close: flips(d, 'close') },
    cost_usd: round(d.usd, 5), cost_source: d.costSource, cost_per_1000_judgements: round((1000 * d.usd) / n, 4),
    tokens_per_judgement: { prompt: round(d.tokens.prompt / n, 1), completion: round(d.tokens.completion / n, 1), reasoning: round(d.tokens.reasoning / n, 1) },
    call_seconds: { p50: round(pct(d.callMs, 0.5) / 1000, 1), p80: round(pct(d.callMs, 0.8) / 1000, 1), p99: round(pct(d.callMs, 0.99) / 1000, 1), max: round(Math.max(...d.callMs) / 1000, 1) },
    call_usd: { p50: round(pct(d.callUsd, 0.5), 6), p80: round(pct(d.callUsd, 0.8), 6), max: round(Math.max(...d.callUsd), 6) },
    wall_seconds: round(d.r.wall_ms / 1000, 0), served_by: [...new Set(d.r.calls.map((c) => c.provider).filter(Boolean))] };
});

// The best design on all pairs, and each design's gap to it with a paired bootstrap over pairs: a design is within the
// noise of the best when the 95% interval of its gap includes zero. A rerun of a design is left out of the choice.
const choosable = rows.filter((r) => !r.rerun_of);
const best = choosable.reduce((a, b) => (b.all.accuracy > a.all.accuracy ? b : a));
const bestD = designs.find((d) => d.id === best.id);
for (const row of rows) {
  const d = designs.find((x) => x.id === row.id);
  row.gap_to_best = { points: round(100 * (row.all.accuracy - best.all.accuracy), 1),
    ci95_points: interval((s) => { const a = acc(d, s), b = acc(bestD, s); return a == null || b == null ? null : 100 * (a - b); }, 'all', 21).map((x) => round(x, 1)) };
  row.within_noise_of_best = row.id === best.id || (row.gap_to_best.ci95_points[0] <= 0 && row.gap_to_best.ci95_points[1] >= 0);
}
const cheapest = choosable.filter((r) => r.within_noise_of_best).reduce((a, b) => (b.cost_per_1000_judgements < a.cost_per_1000_judgements ? b : a));
for (const row of rows) row.times_cheapest_within_noise = round(row.cost_per_1000_judgements / cheapest.cost_per_1000_judgements, 1);

// The noise floor: the same design run twice, judgement by judgement.
const reruns = rows.filter((r) => r.rerun_of).map((r) => {
  const a = designs.find((d) => d.id === r.rerun_of), b = designs.find((d) => d.id === r.id);
  const first = new Map(a.answered.map((j) => [`${key(j)}:${j.order}`, j.picked]));
  const both = b.answered.filter((j) => first.has(`${key(j)}:${j.order}`));
  const same = both.filter((j) => first.get(`${key(j)}:${j.order}`) === j.picked).length;
  return { design: r.rerun_of, rerun: r.id, judgements_in_both: both.length, same_pick: same, share_same: round(same / both.length),
    accuracy_first: rows.find((x) => x.id === r.rerun_of).all.accuracy, accuracy_rerun: r.all.accuracy };
});

// The headline ratio, only ever printed with its three labels: what it is measured against, what the bill includes and
// the period. Without them nobody can check it.
const dearest = choosable.reduce((a, b) => (b.cost_per_1000_judgements > a.cost_per_1000_judgements ? b : a));
const days = [...new Set(runs.map((r) => String(r.at).slice(0, 10)))].sort();
const headline = { ratio: round(dearest.cost_per_1000_judgements / cheapest.cost_per_1000_judgements, 1), baseline: dearest.id, cheapest_within_noise: cheapest.id,
  bill: `what the endpoint charged for these calls, reasoning tokens included${rows.some((r) => r.cost_source.includes('list')) ? ' (list price where marked)' : ''}, and nothing else: no subscriptions, tools or people's time`,
  period: days.length === 1 ? `one run of each design on ${days[0]}` : `runs from ${days[0]} to ${days.at(-1)}` };

const out = { day: DAY, pairs: { clear: SETS.clear.length, close: SETS.close.length }, bootstrap: { resamples: B, method: 'percentile; pairs resampled within each set' },
  best: best.id, cheapest_within_noise: cheapest.id, headline, designs: rows, reruns };
writeFileSync(join(HERE, `results-${DAY}.json`), JSON.stringify(out, null, 1));

const pctS = (x) => `${Math.round(100 * x)}%`;
const money = (x) => (x >= 1 ? `$${x.toFixed(2)}` : x >= 0.01 ? `$${x.toFixed(3)}` : `$${x.toFixed(4)}`);
const md = [`# Cost by design: results for ${DAY}`, '',
  `${SETS.clear.length} clear and ${SETS.close.length} close headline tests from the Upworthy Research Archive, each judged in both orders. A judgement is right when it picks the headline more readers clicked. Cost is what the endpoint charged${rows.some((r) => r.cost_source.includes('list')) ? ' (or, where marked, the tokens at list price)' : ''}, including any reasoning tokens. Intervals are 95% bootstrap intervals over pairs.`, '',
  '| Design | Clear | Close | All (95% interval) | Order flips, clear / close | Cost per 1,000 judgements | Times the cheapest within the noise | Within the noise of the best |',
  '|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.label} | ${r.clear.right_of[0]}/${r.clear.right_of[1]} (${pctS(r.clear.accuracy)}) | ${r.close.right_of[0]}/${r.close.right_of[1]} (${pctS(r.close.accuracy)}) | ${pctS(r.all.accuracy)} (${pctS(r.all.ci95[0])}–${pctS(r.all.ci95[1])}) | ${r.order_flips.clear.join('/')}, ${r.order_flips.close.join('/')} | ${money(r.cost_per_1000_judgements)} | ${r.times_cheapest_within_noise}× | ${r.rerun_of ? `rerun of ${r.rerun_of}` : r.within_noise_of_best ? 'yes' : 'no'} |`),
  '',
  `Best on all pairs: ${best.label}, ${pctS(best.all.accuracy)}. Cheapest design within the noise of the best: ${cheapest.label}, ${money(cheapest.cost_per_1000_judgements)} per 1,000 judgements.`, '',
  `Headline, with its labels: ${dearest.label} cost ${headline.ratio} times as much per judgement as ${cheapest.label}. Baseline: ${dearest.label}, the dearest design, on the same pairs. Bill: ${headline.bill}. Period: ${headline.period}.`, '',
  ...reruns.map((x) => `Noise: run twice with identical settings, ${x.design} gave the same pick on ${x.same_pick} of ${x.judgements_in_both} judgements (${pctS(x.share_same)}); accuracy ${pctS(x.accuracy_first)} the first time and ${pctS(x.accuracy_rerun)} the second.`),
  '', '## Time and cost per call', '',
  '| Design | Calls (failed) | Seconds per call, P50 / P80 / P99 | Cost per call, P50 / P80 / max | Reasoning tokens per judgement | Wall time |', '|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.label} | ${r.calls} (${r.failed_calls}) | ${r.call_seconds.p50} / ${r.call_seconds.p80} / ${r.call_seconds.p99} | ${money(r.call_usd.p50)} / ${money(r.call_usd.p80)} / ${money(r.call_usd.max)} | ${r.tokens_per_judgement.reasoning} | ${r.wall_seconds} s |`),
  '', `Total charged for these runs: ${money(rows.reduce((s, r) => s + r.cost_usd, 0))}.`, ''].join('\n');
writeFileSync(join(HERE, `results-${DAY}.md`), md);
console.log(md);
