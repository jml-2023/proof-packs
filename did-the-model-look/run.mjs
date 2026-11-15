// Did the model even look at the picture? Asks four yes/no questions about a screen three ways (with screen A, with
// screen B where every answer flips, and with no image) and scores whether the answers follow the picture.
//
//   API_KEY=... node run.mjs <model>                 any OpenAI-compatible endpoint; OpenRouter by default
//   BASE_URL=https://api.openai.com/v1 API_KEY=... node run.mjs gpt-4o
//   REPEATS=3  SCREEN_A=my-a.png SCREEN_B=my-b.png QUESTIONS=my-questions.json   to use your own screens
//
// Writes results-<model>-<date>.json and .md beside this file, so earlier runs are kept. Needs Node 18 or later; no packages.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODEL = process.argv[2];
const KEY = process.env.API_KEY || process.env.OPENROUTER_API_KEY;
const BASE = (process.env.BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
const REPEATS = Number(process.env.REPEATS || 3);
if (!MODEL || !KEY) { console.error('usage: API_KEY=... node run.mjs <model>   (BASE_URL defaults to OpenRouter)'); process.exit(2); }

const file = (env, def) => resolve(process.env[env] || join(HERE, def));
const QUESTIONS = JSON.parse(readFileSync(file('QUESTIONS', 'questions.json'), 'utf8')).questions;
const IMAGES = { a: readFileSync(file('SCREEN_A', 'screens/screen-a.png')).toString('base64'), b: readFileSync(file('SCREEN_B', 'screens/screen-b.png')).toString('base64') };
const CONDITIONS = [
  { id: 'a', image: 'a', label: 'screen A attached' },
  { id: 'b', image: 'b', label: 'screen B attached (every answer flips)' },
  { id: 'none', image: null, label: 'no image attached' },
];
const truth = (cond, q) => (cond.image === 'b' ? !QUESTIONS[q].screen_a : QUESTIONS[q].screen_a);

// The words are identical in every condition; only the attachment changes.
const ASK = 'You are checking a screenshot called shot-1. For each question, give the probability from 0 to 1 that the answer is yes. ' +
  `Reply with JSON only, for example {${Object.keys(QUESTIONS).map((k) => `"${k}": 0.5`).join(', ')}}.\n` +
  Object.entries(QUESTIONS).map(([k, q]) => `${k}: ${q.text}`).join('\n');

async function ask(cond) {
  const content = [{ type: 'text', text: ASK }, ...(cond.image ? [{ type: 'image_url', image_url: { url: `data:image/png;base64,${IMAGES[cond.image]}` } }] : [])];
  const t = Date.now();
  const res = await fetch(`${BASE}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, temperature: 0, messages: [{ role: 'user', content }] }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status, error: JSON.stringify(json).slice(0, 300), ms: Date.now() - t };
  // A refusal is an answer in words; a reply with nothing in it is a failed call, so it isn't mistaken for either.
  const text = String(json.choices?.[0]?.message?.content || json.choices?.[0]?.message?.refusal || '');
  if (!text.trim()) return { ok: false, status: res.status, error: `empty reply ${JSON.stringify(json).slice(0, 200)}`, ms: Date.now() - t };
  let p = null;
  try { p = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); } catch { /* answered in prose */ }
  return { ok: true, ms: Date.now() - t, usage: json.usage, p, text: p ? undefined : text.slice(0, 400) };
}

const runs = [];
for (const cond of CONDITIONS) {
  for (let i = 1; i <= REPEATS; i++) {
    const out = await ask(cond);
    runs.push({ condition: cond.id, repeat: i, ...out });
    console.log(`${cond.id.padEnd(5)} #${i} ${out.p ? Object.entries(out.p).map(([k, v]) => `${k}=${Number(v).toFixed(2)}`).join(' ') : (out.text ?? out.error)}`);
  }
}

const summary = {};
for (const cond of CONDITIONS) {
  const rs = runs.filter((r) => r.condition === cond.id && r.p);
  let right = 0, total = 0;
  const per = {};
  for (const q of Object.keys(QUESTIONS)) {
    const vals = rs.map((r) => Number(r.p[q])).filter(Number.isFinite);
    right += vals.filter((v) => (v >= 0.5) === truth(cond, q)).length; total += vals.length;
    per[q] = vals.length ? Number((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2)) : null;
  }
  summary[cond.id] = { label: cond.label, right, total, mean: per };
}
const n = Object.keys(QUESTIONS).length * REPEATS;
const followed = summary.a.right === n && summary.b.right === n;
// A model that never sees the picture can't make its answers depend on which screen is attached. In each round it can be
// right on every question for A or for B, not both, unless it guesses a whole screen; at best that is 1 in 4 a round.
const withScreen = runs.filter((r) => r.condition !== 'none');
const missing = withScreen.filter((r) => !r.p).length;
const verdict = followed
  ? `The answers followed the picture: every answer was right on both screens. A model that saw neither screen would pass by luck at most 1 time in ${4 ** REPEATS}.`
  : missing
    ? `Not settled: ${missing} of ${withScreen.length} calls with a screen attached gave no numbers, so run it again. Of the answers that came back, ${summary.a.right} of ${summary.a.total} were right on screen A and ${summary.b.right} of ${summary.b.total} on screen B.`
    : `Not shown that it read the picture: ${summary.a.right} of ${n} right on screen A and ${summary.b.right} of ${n} on screen B.`;
const noneRuns = runs.filter((r) => r.condition === 'none');
const sure = noneRuns.filter((r) => r.p && Object.values(r.p).some((v) => Number(v) >= 0.9 || Number(v) <= 0.1)).length;
const worded = noneRuns.filter((r) => r.ok && !r.p).length;
const none = `With no image: ${summary.none.total ? `${summary.none.right} of ${summary.none.total} answers matched screen A; ` : ''}` +
  `${sure} of ${REPEATS} calls gave at least one answer of 0.9 or more, or 0.1 or less, about a picture it didn't have` +
  `${worded ? `; ${worded} answered in words instead of numbers (read them in the .json: saying there is no picture is the right answer)` : ''}.`;
const failed = runs.filter((r) => !r.ok);
const failLine = failed.length ? `${failed.length} of ${runs.length} calls failed; the first said ${failed[0].status}: ${String(failed[0].error).slice(0, 160)}` : '';

const cost = runs.reduce((s, r) => s + (Number(r.usage?.cost) || 0), 0);
const costLine = cost > 0 ? `Cost reported by the endpoint: $${cost.toFixed(4)} for ${runs.length} calls.` : 'The endpoint reported no cost.';
const day = new Date().toISOString().slice(0, 10);
const slug = `${MODEL.replace(/[^a-z0-9.-]+/gi, '-')}-${day}`;
const row = (c) => `| ${summary[c].label} | ${Object.keys(QUESTIONS).map((q) => summary[c].mean[q] ?? '–').join(' | ')} | ${summary[c].right} of ${summary[c].total} |`;
const md = [`# ${MODEL}, ${day}`, '', `Mean probability of yes over ${REPEATS} calls, and how many answers were right. An answer of 0.5 or more counts as yes.`, '',
  `| | ${Object.keys(QUESTIONS).join(' | ')} | Right |`, `|---|${Object.keys(QUESTIONS).map(() => '---|').join('')}---|`, row('a'), row('b'), row('none'), '', verdict, '', none, '',
  ...(failLine ? [failLine, ''] : []), costLine, ''].join('\n');
writeFileSync(join(HERE, `results-${slug}.json`), JSON.stringify({ model: MODEL, base_url: BASE, at: new Date().toISOString(), repeats: REPEATS, questions: QUESTIONS, summary, runs }, null, 2));
writeFileSync(join(HERE, `results-${slug}.md`), md);
console.log('\n' + md);
