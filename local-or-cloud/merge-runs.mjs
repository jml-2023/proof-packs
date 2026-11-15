// Joins answering runs made in parts (same route, model and settings) into one run, and their energy files into one.
//
//   node merge-runs.mjs --out results/answering-<route>-<model>-<date>.json <part> <part> [...]
//   node merge-runs.mjs --energy --out results/answering-<route>-<model>-<date>-energy.json <energy> <energy> [...]
//
// Items come back in the order of tasks/answering.jsonl. The run's time is the sum of the parts' times, not the span
// from the first start to the last end, and each part is listed under "parts". Energy adds up watt-hours and seconds;
// the idle draw is each part's own, weighted by its length.
import { readFileSync, writeFileSync } from "node:fs";
import { summarise, markdown } from "./score-answers.mjs";

const argv = process.argv.slice(2);
const out = argv[argv.indexOf("--out") + 1];
const files = argv.filter((x, i) => !x.startsWith("--") && argv[i - 1] !== "--out");
const parts = files.map((f) => JSON.parse(readFileSync(f, "utf8")));
if (!out || parts.length < 2) { console.error("usage: node merge-runs.mjs [--energy] --out <file> <part> <part> [...]"); process.exit(2); }

if (argv.includes("--energy")) {
  const sum = (k) => parts.reduce((s, p) => s + k(p), 0);
  const seconds = sum((p) => p.window.seconds);
  const weighted = (k) => sum((p) => k(p) * p.window.seconds) / seconds;
  const merged = {
    parts: files, window: { seconds },
    gpu: { wh: sum((p) => p.gpu.wh), mean_w: weighted((p) => p.gpu.mean_w), peak_w: Math.max(...parts.map((p) => p.gpu.peak_w)),
      mean_util: weighted((p) => p.gpu.mean_util), peak_mem_mib: Math.max(...parts.map((p) => p.gpu.peak_mem_mib)) },
    cpu_package: { wh: sum((p) => p.cpu_package.wh), mean_w: weighted((p) => p.cpu_package.mean_w) },
    idle_before: { gpu_w: weighted((p) => p.idle_before.gpu_w), cpu_w: weighted((p) => p.idle_before.cpu_w), seconds: parts[0].idle_before.seconds },
    measured_wh: sum((p) => p.measured_wh), idle_wh_over_window: sum((p) => p.idle_wh_over_window), extra_wh: sum((p) => p.extra_wh),
    note: parts[0].note,
  };
  writeFileSync(out, JSON.stringify(merged, null, 2) + "\n");
  console.log(`${out}: ${seconds.toFixed(0)} s, extra ${merged.extra_wh.toFixed(2)} Wh, measured ${merged.measured_wh.toFixed(2)} Wh`);
} else {
  const same = (k) => new Set(parts.map((p) => JSON.stringify(k(p)))).size === 1;
  if (!same((p) => [p.route, p.server, p.settings])) { console.error("the parts differ in route, server or settings"); process.exit(1); }
  const order = new Map(readFileSync(new URL("tasks/answering.jsonl", import.meta.url), "utf8").split("\n").filter(Boolean)
    .map((l, i) => [JSON.parse(l).question_id, i]));
  const items = parts.flatMap((p) => p.items).sort((a, b) => order.get(a.question_id) - order.get(b.question_id));
  if (new Set(items.map((x) => x.question_id)).size !== items.length) { console.error("a question appears in more than one part"); process.exit(1); }
  const run = {
    job: "answering", route: parts[0].route, server: parts[0].server, settings: parts[0].settings,
    started_at: parts[0].started_at, ended_at: parts.at(-1).ended_at, node: parts[0].node,
    parts: parts.map((p, i) => ({ file: files[i], questions: p.items.length, started_at: p.started_at, ended_at: p.ended_at, wall_seconds: p.summary.wall_seconds })),
    summary: summarise(items, parts.reduce((s, p) => s + p.summary.wall_seconds, 0)), items,
  };
  writeFileSync(out, JSON.stringify(run, null, 2) + "\n");
  writeFileSync(out.replace(/\.json$/, ".md"), markdown(run) + `- Made from ${parts.length} parts: ${run.parts.map((p) => `${p.questions} questions ${p.started_at} to ${p.ended_at}`).join("; ")}\n`);
  console.log(`${out}: ${run.summary.right}/${items.length} right`);
}
