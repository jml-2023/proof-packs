// Puts the runs side by side: quality, time, money and energy, scaled to 1,000 questions and to one hour of audio,
// and the electricity price at which a local run costs the same as the cloud run of the same model.
//
//   node report.mjs --answer-local <run> --answer-local-energy <energy> [--answer-local <run> --answer-local-energy <energy> ...]
//                   --answer-cloud <run> [--answer-cloud <run> ...]
//                   --listen-local <run> --listen-local-energy <energy> --listen-cloud <run> [--out results/summary]
//
// Every input is a file the other scripts wrote; local runs and their energy files pair up in the order given. The
// break-even price uses the local run's extra energy (above the machine's idle draw), because the machine is on anyway;
// the idle draw is reported beside it. A local run on fewer questions than the others (a subset) also gets a row
// comparing every run on just those questions.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const many = (k) => argv.flatMap((x, i) => (x === `--${k}` ? [argv[i + 1]] : []));
const one = (k) => many(k)[0];
const load = (f) => (f ? JSON.parse(readFileSync(f, "utf8")) : null);
// "gpt-oss:20b" (Ollama) and "openai/gpt-oss-20b" (OpenRouter) are the same model.
const family = (m) => m.toLowerCase().replace(/^[^/]+\//, "").replace(/:/g, "-");

const rows = { answering: [], listening: [], subsets: [] };
const energyOf = (energy) => (energy ? { window_s: energy.window.seconds, gpu_mean_w: energy.gpu.mean_w, gpu_peak_w: energy.gpu.peak_w,
  cpu_mean_w: energy.cpu_package?.mean_w ?? null, idle_w: energy.idle_before.gpu_w + (energy.idle_before.cpu_w ?? 0),
  extra_wh: energy.extra_wh, measured_wh: energy.measured_wh } : null);
function addAnswering(run, energy) {
  const s = run.summary, n = s.questions;
  rows.answering.push({
    route: run.route, model: run.settings.model, family: family(run.settings.model), server: run.server, n,
    right: s.right, accuracy: s.accuracy, ci95: s.ci95, no_answer: s.no_answer_found, failed: s.failed_calls, retried: s.retried_calls,
    median_s: s.seconds_per_question.median, p90_s: s.seconds_per_question.p90, run_minutes: s.wall_seconds / 60,
    tokens_out: s.tokens.completion, tokens_out_per_s: s.completion_tokens_per_second,
    usd: s.cost_usd, usd_per_1000: s.cost_usd == null ? null : (s.cost_usd / n) * 1000,
    extra_wh_per_1000: energy ? (energy.extra_wh / n) * 1000 : null, measured_wh_per_1000: energy ? (energy.measured_wh / n) * 1000 : null,
    energy: energyOf(energy), providers: s.providers, items: run.items,
  });
}
function addListening(run, energy) {
  const s = run.summary, hours = s.audio_minutes / 60;
  rows.listening.push({
    route: run.route, model: run.settings.model, server: run.server, narrations: s.narrations, audio_minutes: s.audio_minutes,
    word_errors: s.word_errors, reference_words: s.reference_words, wer: s.wer, failed: s.failed_calls, retried: s.retried_calls,
    median_s: s.seconds_per_narration.median, max_s: s.seconds_per_narration.max, load_s: s.model_load_seconds ?? null,
    busy_minutes: s.busy_seconds / 60, run_minutes: s.wall_seconds / 60,
    usd: s.cost_usd, usd_per_audio_hour: s.cost_usd == null ? null : s.cost_usd / hours,
    extra_wh_per_audio_hour: energy ? energy.extra_wh / hours : null, measured_wh_per_audio_hour: energy ? energy.measured_wh / hours : null,
    energy: energyOf(energy), providers: s.providers,
  });
}
const localEnergy = many("answer-local-energy");
many("answer-local").forEach((f, i) => addAnswering(load(f), load(localEnergy[i])));
for (const f of many("answer-cloud")) addAnswering(load(f), null);
if (one("listen-local")) addListening(load(one("listen-local")), load(one("listen-local-energy")));
for (const f of many("listen-cloud")) addListening(load(f), null);

// The electricity price ($ per kWh) at which a local run's extra energy costs what the cloud charged for the same model.
const breakEven = (cloudUsd, localWh) => (cloudUsd == null || !localWh ? null : cloudUsd / (localWh / 1000));
for (const r of rows.answering.filter((x) => x.route === "cloud")) {
  const local = rows.answering.find((x) => x.route === "local" && x.family === r.family);
  r.break_even_usd_per_kwh = local ? breakEven(r.usd_per_1000, local.extra_wh_per_1000) : null;
}
const localL = rows.listening.find((r) => r.route === "local");
for (const r of rows.listening.filter((x) => x.route === "cloud")) r.break_even_usd_per_kwh = localL ? breakEven(r.usd_per_audio_hour, localL.extra_wh_per_audio_hour) : null;

// Every run scored on the questions of a smaller local run.
const most = Math.max(...rows.answering.map((r) => r.n));
for (const sub of rows.answering.filter((r) => r.route === "local" && r.n < most)) {
  const ids = new Set(sub.items.map((x) => x.question_id));
  rows.subsets.push({ questions: ids.size, of: `${sub.route} ${sub.model}`, runs: rows.answering.map((r) => ({
    route: r.route, model: r.model, right: r.items.filter((x) => ids.has(x.question_id) && x.correct).length,
    answered: r.items.filter((x) => ids.has(x.question_id)).length })) });
}

const out = one("out") ?? join(HERE, "results", "summary");
const strip = (r) => { const { items, ...rest } = r; return rest; };
writeFileSync(`${out}.json`, JSON.stringify({ made: new Date().toISOString(), inputs: argv.filter((x) => !x.startsWith("--")),
  answering: rows.answering.map(strip), listening: rows.listening, subsets: rows.subsets }, null, 2) + "\n");
const f = (x, d = 1) => (x == null ? "n/a" : x.toFixed(d));
const pct = (x, d = 1) => (x == null ? "n/a" : `${(100 * x).toFixed(d)}%`);
const prov = (p) => (Object.keys(p ?? {}).length ? Object.entries(p).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ") : "this machine");
writeFileSync(`${out}.md`, [
  "# Local or cloud: summary", "",
  "## Answering (exam questions)", "",
  "| Route | Model | Right | Median s | Run min | Cloud $ per 1,000 | Local extra Wh per 1,000 | Break-even $/kWh | Served by |",
  "|---|---|---|---|---|---|---|---|---|",
  ...rows.answering.map((r) => `| ${r.route} | ${r.model} | ${r.right}/${r.n} (${pct(r.accuracy)}; ${pct(r.ci95[0], 0)}–${pct(r.ci95[1], 0)}) | ${f(r.median_s)} | ${f(r.run_minutes)} | ${r.usd_per_1000 == null ? "–" : "$" + f(r.usd_per_1000, 3)} | ${r.extra_wh_per_1000 == null ? "–" : f(r.extra_wh_per_1000, 0)} | ${r.break_even_usd_per_kwh == null ? "–" : "$" + f(r.break_even_usd_per_kwh, 2)} | ${prov(r.providers)} |`),
  "",
  ...rows.subsets.flatMap((s) => [`On the ${s.questions} questions of the ${s.of} run: ` + s.runs.map((r) => `${r.route} ${r.model} ${r.right}/${r.answered}`).join("; ") + ".", ""]),
  "## Listening (transcribing narration)", "",
  "| Route | Model | Word errors | Median s per 2-min narration | Cloud $ per audio hour | Local extra Wh per audio hour | Break-even $/kWh | Served by |",
  "|---|---|---|---|---|---|---|---|",
  ...rows.listening.map((r) => `| ${r.route} | ${r.model} | ${r.word_errors}/${r.reference_words} (${pct(r.wer, 2)}) | ${f(r.median_s)} | ${r.usd_per_audio_hour == null ? "–" : "$" + f(r.usd_per_audio_hour, 3)} | ${r.extra_wh_per_audio_hour == null ? "–" : f(r.extra_wh_per_audio_hour, 1)} | ${r.break_even_usd_per_kwh == null ? "–" : "$" + f(r.break_even_usd_per_kwh, 2)} | ${prov(r.providers)} |`),
  "",
  "Break-even compares an answering run in the cloud with the local run of the same model, and the cloud listening run with the local one. Local energy is the GPU board plus the processor package, above the idle draw measured in the minute before each run.",
  ...[...rows.answering, ...rows.listening].filter((r) => r.energy).map((r) => `- ${r.model}: ${f(r.energy.window_s, 0)} s at a mean ${f(r.energy.gpu_mean_w, 0)} W on the GPU (peak ${f(r.energy.gpu_peak_w, 0)} W) and ${f(r.energy.cpu_mean_w, 0)} W on the processor; idle before it ${f(r.energy.idle_w, 0)} W; extra ${f(r.energy.extra_wh, 2)} Wh, ${f(r.energy.measured_wh, 2)} Wh measured in all.`),
  "",
].join("\n"));
console.log(readFileSync(`${out}.md`, "utf8"));
