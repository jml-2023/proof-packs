// Compares answering runs question by question. For each pair of runs it counts the questions one got right and the
// other missed, and gives the chance of a split at least that uneven if the two were equally good (McNemar's exact
// test: a two-sided sign test on the questions where they disagree). Two scores a few questions apart can hide a
// one-sided split, or a split that is even.
//
//   node compare-pairs.mjs <run> <run> [...] > results/paired-<date>.md
import { readFileSync } from "node:fs";

const files = process.argv.slice(2);
if (files.length < 2) { console.error("usage: node compare-pairs.mjs <run> <run> [...]"); process.exit(2); }
const runs = files.map((f) => {
  const run = JSON.parse(readFileSync(f, "utf8"));
  return { file: f, label: `${run.settings.model} (${run.route})`, right: new Map(run.items.map((x) => [x.question_id, Boolean(x.correct)])) };
});

// P(X <= k) * 2 for X ~ Binomial(n, 1/2), capped at 1.
function signTest(b, c) {
  const n = b + c, k = Math.min(b, c);
  if (n === 0) return 1;
  let term = Math.pow(0.5, n), sum = 0;
  for (let i = 0; i <= k; i++) { sum += term; term = (term * (n - i)) / (i + 1); }
  return Math.min(1, 2 * sum);
}

console.log("| Run A | Run B | Questions in both | A right, B wrong | B right, A wrong | Chance of a split this uneven |");
console.log("|---|---|---|---|---|---|");
for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
  const [a, b] = [runs[i], runs[j]];
  const both = [...a.right.keys()].filter((q) => b.right.has(q));
  const ab = both.filter((q) => a.right.get(q) && !b.right.get(q)).length;
  const ba = both.filter((q) => b.right.get(q) && !a.right.get(q)).length;
  const p = signTest(ab, ba);
  console.log(`| ${a.label} | ${b.label} | ${both.length} | ${ab} | ${ba} | ${p < 0.001 ? "below 0.001" : p.toFixed(3)} |`);
}
console.log(`\nRuns: ${runs.map((r) => r.file).join(", ")}`);
