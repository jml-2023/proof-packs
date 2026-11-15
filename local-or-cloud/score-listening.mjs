// Scores a listening run against the narrations' reference texts with wer.mjs, the same way for every route.
//
//   node score-listening.mjs <raw run JSON from listen_local.py> [out.json]
//
// listen-cloud.mjs calls scoreListening itself. A raw run has { route, settings, items: [{ id, text, ... }] }.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { wer } from "./wer.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

export function scoreListening(run, set, out) {
  const refs = new Map(set.narrations.map((n) => [n.id, n]));
  const sum = (xs) => xs.reduce((s, x) => s + (Number(x) || 0), 0);
  let errors = 0, refWords = 0;
  for (const it of run.items) {
    const s = wer(refs.get(it.id).reference, it.text ?? "");
    Object.assign(it, { ref_words: s.ref_words, errors: s.errors, sub: s.sub, del: s.del, ins: s.ins, wer: s.wer, departures: s.departures });
    errors += s.errors; refWords += s.ref_words;
  }
  const ok = run.items.filter((x) => !x.failed);
  const audio = sum(run.items.map((x) => x.audio_seconds ?? refs.get(x.id).seconds));
  const busy = sum(ok.map((x) => x.wall_ms)) / 1000;
  const providers = {};
  for (const x of ok) if (x.provider) providers[x.provider] = (providers[x.provider] ?? 0) + 1;
  const walls = ok.map((x) => x.wall_ms / 1000).sort((a, b) => a - b);
  run.summary = {
    narrations: run.items.length, failed_calls: run.items.filter((x) => x.failed).length,
    retried_calls: run.items.filter((x) => (x.attempts?.length ?? 1) > 1).length,
    reference_words: refWords, word_errors: errors, wer: refWords ? errors / refWords : null,
    audio_minutes: audio / 60, seconds_per_narration: { median: walls[Math.floor(walls.length / 2)] ?? null, max: walls.at(-1) ?? null },
    busy_seconds: busy, wall_seconds: (new Date(run.ended_at) - new Date(run.started_at)) / 1000,
    audio_seconds_per_busy_second: busy ? audio / busy : null,
    cost_usd: ok.some((x) => x.cost_usd != null) ? sum(ok.map((x) => x.cost_usd)) : null, providers,
    ...(run.load_seconds != null ? { model_load_seconds: run.load_seconds } : {}),
  };
  writeFileSync(out, JSON.stringify(run, null, 2) + "\n");
  const s = run.summary;
  writeFileSync(out.replace(/\.json$/, ".md"), [
    `# Listening: ${run.settings.model} on the ${run.route} route (${run.server}), ${run.started_at.slice(0, 10)}`, "",
    `- Word errors: ${s.word_errors} in ${s.reference_words} reference words, a word error rate of ${(100 * s.wer).toFixed(2)}%`,
    `- Audio: ${s.audio_minutes.toFixed(1)} minutes in ${s.narrations} narrations; failed calls: ${s.failed_calls}; calls that needed a retry: ${s.retried_calls}`,
    `- Seconds per two-minute narration: median ${s.seconds_per_narration.median?.toFixed(1)}, slowest ${s.seconds_per_narration.max?.toFixed(1)}; ${s.audio_seconds_per_busy_second?.toFixed(0)} seconds of audio per second of work`,
    ...(s.model_load_seconds != null ? [`- Loading the model took ${s.model_load_seconds.toFixed(1)} seconds before the first narration`] : []),
    `- Money reported by the endpoint: ${s.cost_usd == null ? "none (a local run reports no cost; see the energy step)" : `$${s.cost_usd.toFixed(4)}`}`,
    `- Served by: ${Object.keys(s.providers).length ? Object.entries(s.providers).map(([p, n]) => `${p} (${n})`).join(", ") : "the machine named above"}`, "",
    "Per narration (word error rate):", "",
    ...run.items.map((x) => `- ${x.id}: ${(100 * x.wer).toFixed(2)}% (${x.errors} of ${x.ref_words})${x.failed ? ", call failed" : ""}`), "",
  ].join("\n"));
  console.log(`${run.route} ${run.settings.model}: WER ${(100 * s.wer).toFixed(2)}% (${s.word_errors}/${s.reference_words}); ${out}`);
  return run;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [raw, outArg] = process.argv.slice(2);
  if (!raw) { console.error("usage: node score-listening.mjs <raw run JSON> [out.json]"); process.exit(2); }
  const run = JSON.parse(readFileSync(raw, "utf8"));
  const set = JSON.parse(readFileSync(join(HERE, "tasks", "listening", "narrations.json"), "utf8"));
  scoreListening(run, set, outArg ?? raw.replace(/-raw\.json$/, ".json"));
}
