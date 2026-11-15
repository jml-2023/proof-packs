// Scoring for the answering job, shared by answer.mjs and by re-scoring a saved run:
//
//   node score-answers.mjs results/answering-<route>-<model>-<date>.json [...]
//
// Re-scoring reads the end of each reply that the run kept (its last 300 characters), applies extract() below and
// rewrites the run's summary and .md. Each item keeps its first reading as got_first_pass, and the summary says how
// many readings changed, so nothing is lost.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const LETTERS = "ABCDEFGHIJ";

// The reply's last "The answer is (X)", or failing that its last "Answer: X", read with Markdown emphasis removed, so
// "The answer is **(E)**" and "**Answer:** (E)" count as E. The letter must be a capital and one of the options. A
// reply with neither phrase has no answer and counts as wrong.
export function extract(text, n) {
  const ok = new Set(LETTERS.slice(0, n));
  const plain = String(text ?? "").replace(/[*_`]/g, "");
  for (const re of [/[Aa]nswer is:?\s*\(?([A-J])\b/g, /[Aa]nswer:\s*(?:[Oo]ption\s+)?\(?([A-J])\b/g]) {
    const hits = [...plain.matchAll(re)].map((m) => m[1]).filter((l) => ok.has(l));
    if (hits.length) return hits.at(-1);
  }
  return null;
}

const sorted = (xs) => [...xs].sort((a, b) => a - b);
const q = (xs, p) => (xs.length ? sorted(xs)[Math.min(xs.length - 1, Math.floor(p * xs.length))] : null);
const sum = (xs) => xs.reduce((s, x) => s + (Number(x) || 0), 0);
export function wilson(k, n, z = 1.96) {
  if (!n) return [null, null];
  const p = k / n, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(c - h) / d, (c + h) / d];
}

export function summarise(items, wallSeconds) {
  const ok = items.filter((x) => !x.failed);
  const right = items.filter((x) => x.correct).length;
  const providers = {};
  for (const x of ok) if (x.provider) providers[x.provider] = (providers[x.provider] ?? 0) + 1;
  const summary = {
    questions: items.length, right, accuracy: right / items.length, ci95: wilson(right, items.length),
    no_answer_found: ok.filter((x) => !x.got).length, cut_off_at_max_tokens: ok.filter((x) => x.finish_reason === "length").length,
    failed_calls: items.filter((x) => x.failed).length, retried_calls: items.filter((x) => x.attempts.length > 1).length,
    seconds_per_question: { median: q(ok.map((x) => x.wall_ms), 0.5) / 1000, p90: q(ok.map((x) => x.wall_ms), 0.9) / 1000 },
    wall_seconds: wallSeconds,
    tokens: { prompt: sum(ok.map((x) => x.prompt_tokens)), completion: sum(ok.map((x) => x.completion_tokens)), reasoning: sum(ok.map((x) => x.reasoning_tokens)) },
    cost_usd: ok.some((x) => x.cost_usd != null) ? sum(ok.map((x) => x.cost_usd)) : null, providers,
  };
  summary.completion_tokens_per_second = summary.tokens.completion / (sum(ok.map((x) => x.wall_ms)) / 1000);
  return summary;
}

export function markdown(run) {
  const { summary: s, settings: S, route } = run, day = run.started_at.slice(0, 10);
  const pct = (x) => (x == null ? "n/a" : `${(100 * x).toFixed(1)}%`);
  const sc = s.scoring;
  return [
    `# Answering: ${S.model} on the ${route} route (${run.server}), ${day}`, "",
    `- Right: ${s.right} of ${s.questions} (${pct(s.accuracy)}; 95% interval ${pct(s.ci95[0])} to ${pct(s.ci95[1])})`,
    `- No answer found: ${s.no_answer_found}; cut off at ${S.max_tokens} tokens: ${s.cut_off_at_max_tokens}; failed calls: ${s.failed_calls}; calls that needed a retry: ${s.retried_calls}`,
    ...(sc ? [`- Re-scored ${sc.rescored_at.slice(0, 10)} with the current extract(): first pass ${sc.first_pass.right} right and ${sc.first_pass.no_answer_found} with no answer; ${sc.recovered} answers found that the first pass missed, ${sc.changed} read differently, ${sc.kept} kept from the first pass`] : []),
    `- Seconds per question: median ${s.seconds_per_question.median?.toFixed(1)}, slowest tenth from ${s.seconds_per_question.p90?.toFixed(1)}; whole run ${(s.wall_seconds / 60).toFixed(1)} minutes at ${S.concurrency} at a time`,
    `- Tokens: ${s.tokens.prompt} in, ${s.tokens.completion} out (${s.completion_tokens_per_second.toFixed(0)} out per second of waiting)`,
    `- Money reported by the endpoint: ${s.cost_usd == null ? "none (a local server reports no cost; see the energy step)" : `$${s.cost_usd.toFixed(4)}`}`,
    `- Served by: ${Object.keys(s.providers).length ? Object.entries(s.providers).map(([p, n]) => `${p} (${n})`).join(", ") : "the server named above"}`, "",
  ].join("\n");
}

// Re-scores saved runs from the reply ends they kept.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = new Map(readFileSync(new URL("tasks/answering.jsonl", import.meta.url), "utf8").split("\n").filter(Boolean)
    .map((l) => JSON.parse(l)).map((t) => [t.question_id, t.options.length]));
  for (const f of process.argv.slice(2)) {
    const run = JSON.parse(readFileSync(f, "utf8"));
    const first = run.summary.scoring?.first_pass ?? { right: run.summary.right, no_answer_found: run.summary.no_answer_found };
    let recovered = 0, changed = 0, kept = 0;
    for (const x of run.items) {
      if (x.failed) continue;
      const before = x.got_first_pass !== undefined ? x.got_first_pass : x.got;
      const now = extract(x.tail, options.get(x.question_id));
      x.got_first_pass = before;
      if (now == null && before != null) kept++;
      else if (now != null && before == null) recovered++;
      else if (now != null && now !== before) changed++;
      x.got = now ?? before;
      x.correct = x.got === x.answer;
    }
    run.summary = { ...summarise(run.items, run.summary.wall_seconds), scoring: { rescored_at: new Date().toISOString(), first_pass: first, recovered, changed, kept } };
    writeFileSync(f, JSON.stringify(run, null, 2) + "\n");
    writeFileSync(f.replace(/\.json$/, ".md"), markdown(run));
    console.log(`${f}: ${first.right} -> ${run.summary.right} right; no answer ${first.no_answer_found} -> ${run.summary.no_answer_found}; recovered ${recovered}, changed ${changed}, kept ${kept}`);
  }
}
