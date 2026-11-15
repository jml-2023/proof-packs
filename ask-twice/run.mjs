// Ask the same question twice. Sends every question in questions.json REPEATS times, word for word, and reports how
// often two runs disagree: per field, per whole answer, facts apart from judgements, and per question. It also reports
// how often asking fewer times would have caught a question that changed, and every answer that came back the same
// each time but differs from the label the question carries. For the screens it reports the spread of the 1-10
// rating and whether a one-word fix shows up above that spread.
//
//   API_KEY=... node run.mjs <model>                      OpenRouter by default
//   BASE_URL=https://api.openai.com/v1 API_KEY=... node run.mjs gpt-4o
//   REPEATS=10  SETS=decisions  PINNED=1  QUESTIONS=mine.json  CONCURRENCY=4
//
// SETS=decisions skips the screens, for a model that doesn't read images. PINNED=1 sends temperature 0 and seed 1.
// Writes results-<model>-<date>.json and .md next to the questions file. Needs Node 18 or later; no packages.
// To compare models, run it once per model and then: node compare.mjs results-a.json results-b.json
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODEL = process.argv[2];
const KEY = process.env.API_KEY || process.env.OPENROUTER_API_KEY;
const BASE = (process.env.BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
const REPEATS = Number(process.env.REPEATS || 5);
const PINNED = process.env.PINNED === '1';
if (!MODEL || !KEY) { console.error('usage: API_KEY=... node run.mjs <model>   (BASE_URL defaults to OpenRouter)'); process.exit(2); }
const QFILE = resolve(process.env.QUESTIONS || join(HERE, 'questions.json'));
const Q = JSON.parse(readFileSync(QFILE, 'utf8'));
const SETS = (process.env.SETS || Object.keys(Q.sets).join(',')).split(',').filter((s) => Q.sets[s]);

// ---- Asking -------------------------------------------------------------------------------------------------------
const hint = (f) => f.kind === 'yesno' ? ' Answer "yes" or "no".' : f.kind === 'rating' ? ' Answer with a whole number from 1 to 10.'
  : ` Answer with one of: ${Object.entries(f.options).map(([k, v]) => `"${k}" (${v})`).join(', ')}.`;
const shape = (f) => f.kind === 'yesno' ? '"yes" | "no"' : f.kind === 'rating' ? '1-10' : Object.keys(f.options).map((k) => `"${k}"`).join(' | ');
const prompt = (set, item) => `${set.kind === 'text' ? `${item.text}\n\n${set.intro}` : set.intro}\n\n` +
  `${set.fields.map((f) => `${f.key}: ${f.text}${hint(f)}`).join('\n')}\n\nReply with JSON only, in this shape: {${set.fields.map((f) => `"${f.key}": ${shape(f)}`).join(', ')}}`;
const fileData = (f) => readFileSync(resolve(dirname(QFILE), f)).toString('base64');

function normalise(f, v) {
  if (v === undefined || v === null) return null;
  if (f.kind === 'yesno') { if (typeof v === 'boolean') return v ? 'yes' : 'no'; const s = String(v).trim().toLowerCase(); return s.startsWith('yes') ? 'yes' : s.startsWith('no') ? 'no' : null; }
  if (f.kind === 'rating') { const n = Number(v); return Number.isFinite(n) && n >= 1 && n <= 10 ? n : null; }
  const s = String(v).trim().replace(/^£/, '').toLowerCase();
  return Object.keys(f.options).find((k) => k.toLowerCase() === s || f.options[k].toLowerCase() === s) ?? null;
}

async function ask(set, item) {
  const content = [{ type: 'text', text: prompt(set, item) }];
  if (set.kind === 'image') content.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${fileData(item.file)}` } });
  if (set.kind === 'video') content.push({ type: 'video_url', video_url: { url: `data:video/mp4;base64,${fileData(item.file)}` } });
  const messages = [...(set.system ? [{ role: 'system', content: set.system }] : []), { role: 'user', content }];
  const body = { model: MODEL, messages, max_tokens: 4000, ...(PINNED ? { temperature: 0, seed: 1 } : {}) };
  for (let attempt = 1; attempt <= 3; attempt++) {
    const t = Date.now();
    try {
      const res = await fetch(`${BASE}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(240_000) });
      const json = await res.json().catch(() => ({}));
      if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 3000 * attempt)); continue; }
      if (!res.ok) return { ok: false, status: res.status, error: JSON.stringify(json).slice(0, 300) };
      // A reply that can't be read is kept as a non-answer and not asked again: asking again would swap one sample for another.
      const text = String(json.choices?.[0]?.message?.content ?? '').replace(/```(?:json)?/gi, '');
      let answer = null;
      try { const j = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); answer = Object.fromEntries(set.fields.map((f) => [f.key, normalise(f, j[f.key])])); } catch { /* prose */ }
      if (answer && Object.values(answer).some((v) => v === null)) answer = null;
      return { ok: Boolean(answer), status: res.status, ms: Date.now() - t, answer, text: answer ? undefined : text.slice(0, 400), usage: json.usage, provider: json.provider };
    } catch (e) { if (attempt === 3) return { ok: false, error: String(e).slice(0, 300) }; }
  }
  return { ok: false, error: 'server kept failing' };
}

const plan = [];
for (const s of SETS) for (const item of Q.sets[s].items) for (let r = 1; r <= REPEATS; r++) plan.push({ set: s, item: item.id, repeat: r });
// Shuffle, so the repeats of one question are spread through the run rather than sent back to back.
for (let i = plan.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [plan[i], plan[j]] = [plan[j], plan[i]]; }
console.log(`${MODEL}: ${plan.length} calls (${REPEATS} per question${PINNED ? ', temperature 0 and seed 1' : ', default settings'})`);
const runs = [];
const todo = [...plan];
await Promise.all(Array.from({ length: Number(process.env.CONCURRENCY || 4) }, async () => {
  while (todo.length) {
    const p = todo.shift();
    const set = Q.sets[p.set];
    const out = await ask(set, set.items.find((x) => x.id === p.item));
    runs.push({ ...p, at: new Date().toISOString(), ...out });
    if (!out.ok) console.log(`  no answer: ${p.set}/${p.item} ${out.status ?? ''} ${(out.error ?? out.text ?? '').slice(0, 120)}`);
  }
}));

// ---- Counting -----------------------------------------------------------------------------------------------------
// For each question, every pair of its answers; a pair "differs" on a field if the two answers differ there, and on the
// whole answer if any labelled field differs. Pooled rates add up pairs, so each question weighs the same.
const pairs = (a) => a.flatMap((x, i) => a.slice(i + 1).map((y) => [x, y]));
const pct = (d, n) => (n ? `${((100 * d) / n).toFixed(1)}%` : '–');
const C = (n, k) => { if (k > n) return 0; let c = 1; for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1); return c; };
const rows = [], perQuestion = [], steadyAgainstLabel = [];
const tot = { field: [0, 0], fact: [0, 0], judgement: [0, 0], whole: [0, 0] };
for (const s of SETS) {
  const set = Q.sets[s];
  const labelled = set.fields.filter((f) => f.role !== 'score');
  const t = { field: [0, 0], fact: [0, 0], judgement: [0, 0], whole: [0, 0] };
  for (const item of set.items) {
    const answers = runs.filter((r) => r.set === s && r.item === item.id && r.ok).map((r) => r.answer);
    const ps = pairs(answers);
    const changed = [];
    for (const f of labelled) {
      const d = ps.filter(([x, y]) => x[f.key] !== y[f.key]).length;
      for (const k of ['field', f.role]) { t[k][0] += d; t[k][1] += ps.length; }
      if (d) { const mix = {}; for (const a of answers) mix[a[f.key]] = (mix[a[f.key]] ?? 0) + 1; changed.push(`${f.key} ${Object.entries(mix).map(([k, v]) => `${k} ${v}`).join(', ')}`); }
      // The same answer every time, and not the one the question's label gives: steady is not the same as right.
      const label = f.key === 'decision' ? item.rule : item.truth?.[f.key];
      if (label !== undefined && answers.length > 1 && answers.every((a) => a[f.key] === answers[0][f.key]) && String(answers[0][f.key]) !== String(label)) {
        steadyAgainstLabel.push({ set: s, item: item.id, field: f.key, answer: answers[0][f.key], label, times: answers.length });
      }
    }
    const w = ps.filter(([x, y]) => labelled.some((f) => x[f.key] !== y[f.key])).length;
    t.whole[0] += w; t.whole[1] += ps.length;
    // If the whole answer changed, how often would asking only k times (k of these answers, picked at random) have shown it?
    const counts = {}; for (const a of answers) { const key = labelled.map((f) => a[f.key]).join('|'); counts[key] = (counts[key] ?? 0) + 1; }
    const catchK = (k) => answers.length >= k ? 1 - Object.values(counts).reduce((sum, c) => sum + C(c, k), 0) / C(answers.length, k) : null;
    perQuestion.push({ set: s, item: item.id, answered: answers.length, whole: pct(w, ps.length), changes: w > 0,
      catch: Object.fromEntries([2, 3, 5].map((k) => [k, catchK(k)])), changed: changed.join('; ') || 'nothing changed' });
  }
  rows.push({ set: s, ...Object.fromEntries(Object.entries(t).map(([k, [d, n]]) => [k, pct(d, n)])) });
  for (const k of Object.keys(tot)) { tot[k][0] += t[k][0]; tot[k][1] += t[k][1]; }
}
rows.push({ set: 'all', ...Object.fromEntries(Object.entries(tot).map(([k, [d, n]]) => [k, pct(d, n)])) });

// Asking fewer times: the average, over the questions that changed, of the chance that k answers would have shown it.
const changing = perQuestion.filter((p) => p.changes);
const catchMean = (k) => { const v = changing.map((p) => p.catch[k]).filter((x) => x !== null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const catchLine = changing.length
  ? `${changing.length} of ${perQuestion.length} questions changed. Had you asked each of them only twice, you'd have seen the change ${pct(catchMean(2), 1)} of the time on average; three times, ${catchMean(3) === null ? '–' : pct(catchMean(3), 1)}; five times, ${catchMean(5) === null ? '–' : pct(catchMean(5), 1)}.`
  : `None of the ${perQuestion.length} questions changed in ${REPEATS} runs.`;

// Scores: spread per item, and the one-word fix against that spread.
const scoreLines = [];
const imp = Q.improvement;
if (imp && SETS.includes(imp.set)) {
  const vals = (id) => runs.filter((r) => r.set === imp.set && r.item === id && r.ok).map((r) => r.answer[imp.field]);
  const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
  for (const item of Q.sets[imp.set].items) { const v = vals(item.id); if (v.length) scoreLines.push(`| ${item.id} | ${mean(v).toFixed(2)} | ${Math.min(...v)} to ${Math.max(...v)} | ${v.join(', ')} |`); }
  const b = vals(imp.better), w = vals(imp.worse);
  if (b.length && w.length) {
    const ps = b.flatMap((x) => w.map((y) => [x, y]));
    const up = ps.filter(([x, y]) => x > y).length, same = ps.filter(([x, y]) => x === y).length;
    scoreLines.push('', `Change from ${imp.worse} to ${imp.better}: ${(mean(b) - mean(w)).toFixed(2)}. With one rating of each, ${imp.better} came out higher in ${pct(up, ps.length)} of pairings, the same in ${pct(same, ps.length)} and lower in ${pct(ps.length - up - same, ps.length)}.`);
  }
}

const cost = runs.reduce((s, r) => s + (Number(r.usage?.cost) || 0), 0);
const date = new Date().toISOString().slice(0, 10);
const slug = `${MODEL.replace(/[^a-z0-9.-]+/gi, '-')}-${date}`;
const md = [
  `# ${MODEL}, ${date}`, '',
  `Every question asked ${REPEATS} times, word for word, ${PINNED ? 'with temperature 0 and seed 1' : 'with default settings'}. ${runs.filter((r) => r.ok).length} of ${runs.length} calls gave a readable answer.`, '',
  'Chance that two runs of the same question disagree:', '',
  '| Set | Per field | Facts | Judgements | Whole answer |', '|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.set} | ${r.field} | ${r.fact} | ${r.judgement} | ${r.whole} |`), '',
  'Per question:', '', '| Question | Answers | Whole answer | What changed |', '|---|---|---|---|',
  ...perQuestion.map((p) => `| ${p.set}/${p.item} | ${p.answered} | ${p.whole} | ${p.changed} |`), '',
  catchLine, '',
  'The same answer every time, but not the one the label gives (a label can be a wording choice, so read the question before you call the model wrong):', '',
  ...(steadyAgainstLabel.length ? steadyAgainstLabel.map((x) => `- ${x.set}/${x.item}, ${x.field}: "${x.answer}" ${x.times} times out of ${x.times}; the label says "${x.label}"`) : ['- none']), '',
  ...(scoreLines.length ? ['Screen ratings:', '', '| Screen | Mean | Range | All ratings |', '|---|---|---|---|', ...scoreLines, ''] : []),
  cost > 0 ? `Cost reported by the endpoint: $${cost.toFixed(4)} for ${runs.length} calls.` : 'The endpoint reported no cost.', '',
].join('\n');
const OUT = dirname(QFILE);
writeFileSync(join(OUT, `results-${slug}.json`), JSON.stringify({ model: MODEL, base_url: BASE, at: new Date().toISOString(), repeats: REPEATS, pinned: PINNED, sets: SETS, questions: basename(QFILE), rows, perQuestion, catch: { changing: changing.length, of: perQuestion.length, k2: catchMean(2), k3: catchMean(3), k5: catchMean(5) }, steadyAgainstLabel, cost_usd: Number(cost.toFixed(6)), runs }, null, 2));
writeFileSync(join(OUT, `results-${slug}.md`), md);
console.log('\n' + md);
console.log(`Wrote results-${slug}.json and .md in ${OUT}`);
