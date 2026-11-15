// The P50/P80 planner. Give it how long your past tasks took (or what they cost) and it gives back two numbers to plan
// with: the P50, which half your tasks beat, and the P80, which four in five beat. Plan with the first; promise the second.
//
//   node plan.mjs tasks.csv                        the first numeric column
//   node plan.mjs tasks.csv --column minutes --group kind --tasks 5
//
// A CSV needs a header row. A row whose value is blank and whose "status" column says "running" (or whose value starts
// with ">") is a task still going: it counts as at least as long as it has run so far, because leaving the slow ones
// out makes the P80 look better than it is. --tasks N also plans N such tasks done one after another. --out writes the
// report to a file as well. Needs Node 18 or later; no packages.
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const file = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!file) { console.error('usage: node plan.mjs <file.csv> [--column name] [--group name] [--tasks N] [--out report.md]'); process.exit(2); }

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
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

const rows = csv(readFileSync(file, 'utf8'));
const numeric = (v) => v !== '' && Number.isFinite(Number(v));
const column = opt('column', Object.keys(rows[0] || {}).find((k) => rows.some((r) => numeric(r[k]))));
if (!column) { console.error('no numeric column found'); process.exit(2); }
const group = opt('group', null);
const TASKS = Number(opt('tasks', 0));

// Each row becomes { t, done }: done is false for a task still running, whose t is a lower bound.
const items = rows.map((r) => {
  const v = String(r[column] ?? '');
  const running = /^running$/i.test(r.status || '') || v.startsWith('>');
  const t = Number(v.replace(/^>\s*/, ''));
  return Number.isFinite(t) && v !== '' ? { t, done: !running, g: group ? r[group] : 'all' } : null;
}).filter(Boolean);

// Kaplan–Meier: the share of tasks still unfinished after time t, counting a running task as unfinished up to its
// current time and unknown after it. Pq is the first time at which at most (1 − q) of tasks are unfinished. If the
// estimate never falls that far, the honest answer is "more than" the longest time seen.
function quantile(xs, q) {
  const s = [...xs].sort((a, b) => a.t - b.t || (a.done ? -1 : 1));
  let atRisk = s.length, surv = 1;
  for (let i = 0; i < s.length;) {
    const t = s[i].t; let d = 0, c = 0;
    while (i < s.length && s[i].t === t) { s[i].done ? d++ : c++; i++; }
    if (d) { surv *= 1 - d / atRisk; if (surv <= 1 - q + 1e-12) return { value: t, more_than: false }; }
    atRisk -= d + c;
  }
  return { value: s.length ? s[s.length - 1].t : null, more_than: true };
}

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (s, p) => { const i = Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1)); return s[i]; };

function plan(xs) {
  const done = xs.filter((x) => x.done), running = xs.filter((x) => !x.done);
  const p50 = quantile(xs, 0.5), p80 = quantile(xs, 0.8), p90 = quantile(xs, 0.9);
  // A 95% interval on the P80 from 2,000 resamples of the tasks; a resample that cannot reach the P80 counts as above it.
  const r = rng(80), boots = [];
  for (let b = 0; b < 2000; b++) { const q = quantile(xs.map(() => xs[Math.floor(r() * xs.length)]), 0.8); boots.push(q.more_than ? Infinity : q.value); }
  boots.sort((a, b) => a - b);
  const label = xs.length >= 30 ? 'calibrated' : xs.length >= 10 ? 'provisional' : 'observation only';
  const sorted = done.map((x) => x.t).sort((a, b) => b - a), total = sorted.reduce((s, t) => s + t, 0);
  const top = Math.max(1, Math.round(sorted.length / 5));
  const out = { n: xs.length, finished: done.length, running: running.length, running_at_least: running.map((x) => x.t).sort((a, b) => b - a),
    label, p50, p80, p90, p80_interval: [pick(boots, 0.025), pick(boots, 0.975)],
    p80_over_p50: p50.more_than || p80.more_than ? null : Number((p80.value / p50.value).toFixed(2)),
    top_fifth_share_of_finished_total: sorted.length >= 5 ? Number((sorted.slice(0, top).reduce((s, t) => s + t, 0) / total).toFixed(2)) : null };
  // N tasks one after another: add N draws from the finished tasks, 10,000 times, and set that against N times the
  // P50 and the P80 of the same finished tasks. Running tasks are left out of this part, so it is optimistic when any
  // are still going; the report says so.
  if (TASKS > 0 && done.length) {
    const rr = rng(50), sums = [];
    for (let b = 0; b < 10000; b++) { let s = 0; for (let k = 0; k < TASKS; k++) s += done[Math.floor(rr() * done.length)].t; sums.push(s); }
    sums.sort((a, b) => a - b);
    const f50 = quantile(done, 0.5).value, f80 = quantile(done, 0.8).value;
    out.series = { tasks: TASKS, from: 'finished tasks only', p50: pick(sums, 0.5), p80: pick(sums, 0.8), finished_p50: f50, finished_p80: f80, sum_of_p50s: TASKS * f50, sum_of_p80s: TASKS * f80 };
  }
  return out;
}

const fmt = (x) => (x == null ? '–' : x === Infinity ? 'more than the longest' : Number.isInteger(x) ? String(x) : x >= 100 ? x.toFixed(0) : x >= 1 ? x.toFixed(1) : x.toPrecision(2));
const q = (v) => `${v.more_than ? 'more than ' : ''}${fmt(v.value)}`;
const groups = [...new Set(items.map((x) => x.g))];
const results = Object.fromEntries([['all', plan(items)], ...(group ? groups.map((g) => [g, plan(items.filter((x) => x.g === g))]) : [])]);
const lines = [`# P50/P80 plan for ${file.split('/').pop()}, column "${column}"`, '',
  '| Group | Tasks (still running) | P50 | P80 (95% interval) | P90 | P80 ÷ P50 | Share of the time in the slowest fifth | Label |', '|---|---|---|---|---|---|---|---|',
  ...Object.entries(results).map(([g, p]) => `| ${g} | ${p.n} (${p.running}) | ${q(p.p50)} | ${q(p.p80)} (${fmt(p.p80_interval[0])}–${fmt(p.p80_interval[1])}) | ${q(p.p90)} | ${p.p80_over_p50 ?? '–'} | ${p.top_fifth_share_of_finished_total == null ? '–' : `${Math.round(100 * p.top_fifth_share_of_finished_total)}%`} | ${p.label} |`), '',
  'Plan with the P50 and promise the P80. Under 10 tasks it is an observation, not a plan; from 10 it is provisional; from 30 it is calibrated.',
  ...(results.all.running ? [`${results.all.running} task(s) still running, at least ${results.all.running_at_least.map(fmt).join(', ')} so far: they count as unfinished up to that time, so the P80 is not flattered by leaving them out.`] : []),
  ...(results.all.series ? ['', `${TASKS} such tasks one after another, drawn from the ${results.all.finished} finished tasks (one task: P50 ${fmt(results.all.series.finished_p50)}, P80 ${fmt(results.all.series.finished_p80)}): P50 ${fmt(results.all.series.p50)}, P80 ${fmt(results.all.series.p80)}. Adding up ${TASKS} single-task P80s would promise ${fmt(results.all.series.sum_of_p80s)}; adding up ${TASKS} P50s would plan ${fmt(results.all.series.sum_of_p50s)}.${results.all.running ? ' Tasks still running are left out of this part, so it is optimistic.' : ''}`] : []), ''];
const md = lines.join('\n');
console.log(md);
if (opt('out')) writeFileSync(opt('out'), md);
if (opt('json')) writeFileSync(opt('json'), JSON.stringify({ file, column, group, tasks: TASKS, results }, null, 1));
