// Compare result files from run.mjs: two models, or the same model on two dates. For every question both files
// answered, it counts how often two runs inside one file disagree, and how often an answer from one file and an answer
// from the other disagree, per whole answer and per field, facts apart from judgements. It also lists the questions
// where each file gave the same answer every time and the two files still disagreed.
//
//   node compare.mjs results-a.json results-b.json [results-c.json …]
//   QUESTIONS=mine.json node compare.mjs …            if the runs used your own questions
//
// Writes compare-<a>-vs-<b>….md and .json next to the questions file. Needs Node 18 or later; no packages.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILES = process.argv.slice(2).map((f) => resolve(f));
if (FILES.length < 2) { console.error('usage: node compare.mjs results-a.json results-b.json [more…]'); process.exit(2); }
const QFILE = resolve(process.env.QUESTIONS || join(HERE, 'questions.json'));
const Q = JSON.parse(readFileSync(QFILE, 'utf8'));

// Each file becomes one side: a name, and its readable answers by question.
const sides = FILES.map((f) => {
  const j = JSON.parse(readFileSync(f, 'utf8'));
  const date = String(j.at ?? '').slice(0, 10);
  const byQ = {};
  for (const r of j.runs.filter((r) => r.ok)) (byQ[`${r.set}/${r.item}`] ??= []).push(r.answer);
  return { file: basename(f), name: `${j.model}${date ? ` (${date}${j.pinned ? ', pinned' : ''})` : ''}`, slug: basename(f).replace(/^results-|\.json$/g, ''), byQ };
});
const questions = [];
for (const [s, set] of Object.entries(Q.sets)) for (const item of set.items) {
  const id = `${s}/${item.id}`;
  if (sides.every((x) => (x.byQ[id] ?? []).length >= 2)) questions.push({ id, set: s, fields: set.fields.filter((f) => f.role !== 'score') });
}
if (!questions.length) { console.error('No question has at least two answers in every file. Did the runs use the same questions file?'); process.exit(1); }

const blank = () => ({ whole: [0, 0], field: [0, 0], fact: [0, 0], judgement: [0, 0] });
function count(ps, fields, acc) {
  for (const [x, y] of ps) {
    acc.whole[1] += 1; if (fields.some((f) => x[f.key] !== y[f.key])) acc.whole[0] += 1;
    for (const f of fields) { const d = x[f.key] !== y[f.key] ? 1 : 0; acc.field[0] += d; acc.field[1] += 1; acc[f.role][0] += d; acc[f.role][1] += 1; }
  }
  return acc;
}
const within = (a) => a.flatMap((x, i) => a.slice(i + 1).map((y) => [x, y]));
const across = (a, b) => a.flatMap((x) => b.map((y) => [x, y]));
const rate = ([d, n]) => (n ? d / n : null);
const pct = (x) => (x === null ? '–' : `${(100 * x).toFixed(1)}%`);

const own = sides.map((s) => { const acc = blank(); for (const q of questions) count(within(s.byQ[q.id]), q.fields, acc); return acc; });
const couples = [];
for (let i = 0; i < sides.length; i++) for (let j = i + 1; j < sides.length; j++) {
  const acc = blank(); for (const q of questions) count(across(sides[i].byQ[q.id], sides[j].byQ[q.id]), q.fields, acc);
  couples.push({ a: i, b: j, acc });
}

// Per question: whole-answer disagreement inside each file and between each couple, and the steady disagreements.
const perQuestion = questions.map((q) => ({
  id: q.id,
  own: sides.map((s) => rate(count(within(s.byQ[q.id]), q.fields, blank()).whole)),
  between: couples.map((c) => rate(count(across(sides[c.a].byQ[q.id], sides[c.b].byQ[q.id]), q.fields, blank()).whole)),
}));
const steady = [];
for (const q of questions) for (const f of q.fields) {
  const vals = sides.map((s) => { const v = s.byQ[q.id].map((a) => a[f.key]); return v.every((x) => x === v[0]) ? v[0] : undefined; });
  if (vals.every((v) => v !== undefined) && new Set(vals.map(String)).size > 1) steady.push({ question: q.id, field: f.key, answers: Object.fromEntries(sides.map((s, k) => [s.name, `${vals[k]} ×${s.byQ[q.id].length}`])) });
}

const verdicts = couples.map((c) => {
  const b = rate(c.acc.whole), x = rate(own[c.a].whole), y = rate(own[c.b].whole);
  return `${sides[c.a].name} and ${sides[c.b].name}: an answer from each disagreed on ${pct(b)} of whole answers, against ${pct(x)} and ${pct(y)} between two runs of the same file. ${b > Math.max(x, y) ? 'They disagreed with each other more often than either did with itself.' : 'They did not disagree with each other more often than both did with themselves.'}`;
});
const row = (label, acc) => `| ${label} | ${pct(rate(acc.whole))} | ${pct(rate(acc.field))} | ${pct(rate(acc.fact))} | ${pct(rate(acc.judgement))} | ${acc.whole[1]} |`;
const md = [
  `# Comparing ${sides.map((s) => s.name).join(', ')}`, '',
  `${questions.length} questions answered at least twice in every file (${sides.map((s) => s.file).join(', ')}). A pair of answers differs on the whole answer if any yes/no or choice field differs; ratings are left out.`, '',
  '| Pairs of answers | Whole answer | Per field | Facts | Judgements | Pairs |', '|---|---|---|---|---|---|',
  ...sides.map((s, k) => row(`Two runs of ${s.name}`, own[k])),
  ...couples.map((c) => row(`${sides[c.a].name} against ${sides[c.b].name}`, c.acc)), '',
  ...verdicts, '',
  'Per question, whole answer:', '',
  `| Question | ${[...sides.map((s) => `Two runs of ${s.name}`), ...couples.map((c) => `${sides[c.a].name} against ${sides[c.b].name}`)].join(' | ')} |`,
  `|---|${[...sides, ...couples].map(() => '---').join('|')}|`,
  ...perQuestion.map((p) => `| ${p.id} | ${[...p.own, ...p.between].map(pct).join(' | ')} |`), '',
  'The same answer every time in each file, and still different between files:', '',
  ...(steady.length ? steady.map((x) => `- ${x.question}, ${x.field}: ${Object.entries(x.answers).map(([n, v]) => `${n} "${v}"`).join('; ')}`) : ['- none']), '',
].join('\n');
const slug = `compare-${sides.map((s) => s.slug).join('-vs-')}`;
const OUT = dirname(QFILE);
writeFileSync(join(OUT, `${slug}.json`), JSON.stringify({ files: sides.map((s) => s.file), names: sides.map((s) => s.name), questions: questions.map((q) => q.id),
  own: Object.fromEntries(sides.map((s, k) => [s.name, Object.fromEntries(Object.entries(own[k]).map(([key, v]) => [key, { differ: v[0], pairs: v[1], rate: rate(v) }]))])),
  between: couples.map((c) => ({ a: sides[c.a].name, b: sides[c.b].name, ...Object.fromEntries(Object.entries(c.acc).map(([key, v]) => [key, { differ: v[0], pairs: v[1], rate: rate(v) }])) })),
  perQuestion, steady }, null, 2));
writeFileSync(join(OUT, `${slug}.md`), md);
console.log(md);
console.log(`Wrote ${slug}.json and .md in ${OUT}`);
