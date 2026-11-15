// Picks the answering set: 10 questions from each of MMLU-Pro's 14 subjects, by a fixed seed, so anyone with the
// public test split gets the same 140 questions.
//
//   node make-tasks/sample-answering.mjs <MMLU-Pro test split as JSONL> [per subject] [seed]
//
// The test split is public under the MIT licence (TIGER-Lab/MMLU-Pro on Hugging Face). Writes tasks/answering.jsonl.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [src, perArg = "10", seedArg = "20261030"] = process.argv.slice(2);
if (!src) { console.error("usage: node make-tasks/sample-answering.mjs <test.jsonl> [per subject] [seed]"); process.exit(2); }
const PER = Number(perArg), SEED = Number(seedArg);

// mulberry32: a small seeded generator, so the sample doesn't depend on the platform's Math.random.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rows = readFileSync(src, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const bySubject = new Map();
for (const r of rows.sort((a, b) => a.question_id - b.question_id)) {
  if (!bySubject.has(r.category)) bySubject.set(r.category, []);
  bySubject.get(r.category).push(r);
}
const rand = rng(SEED);
const picked = [];
for (const subject of [...bySubject.keys()].sort()) {
  const pool = [...bySubject.get(subject)];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  picked.push(...pool.slice(0, PER).sort((a, b) => a.question_id - b.question_id));
}
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "tasks", "answering.jsonl");
writeFileSync(out, picked.map((r) => JSON.stringify({
  question_id: r.question_id, category: r.category, question: r.question, options: r.options, answer: r.answer, src: r.src,
})).join("\n") + "\n");
console.log(`${picked.length} questions from ${bySubject.size} subjects (${rows.length} in the split), seed ${SEED} -> ${out}`);
