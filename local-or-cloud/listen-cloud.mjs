// The listening job on a cloud route: sends each of the ten narrations to a hosted model that accepts audio and asks
// for a verbatim transcript, then scores it. The request is the one the author's film word check sends
// (videos/build/asr2.py): temperature 0, the same instruction, the audio as 16 kHz mono mp3.
//
//   OPENROUTER_API_KEY=... node listen-cloud.mjs --model google/gemini-3.8-flash [--limit N] [--out <file>]
//
// Writes results/listening-cloud-<model>-<date>.json and a .md summary, scored by score-listening.mjs.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scoreListening } from "./score-listening.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith("--") ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const MODEL = args.model ?? "google/gemini-3.8-flash";
const BASE = (args["base-url"] ?? "https://openrouter.ai/api/v1").replace(/\/$/, "");
const KEY = process.env[args["key-env"] ?? "OPENROUTER_API_KEY"];
if (!KEY) { console.error("set OPENROUTER_API_KEY (or name another variable with --key-env)"); process.exit(2); }
const DIR = args.tasks ?? join(HERE, "tasks", "listening");
const set = JSON.parse(readFileSync(join(DIR, "narrations.json"), "utf8"));
const narrations = set.narrations.slice(0, args.limit ? Number(args.limit) : undefined);
const INSTRUCTION = "Transcribe the narration in this audio verbatim, word for word, exactly as spoken. Do not correct, complete or "
  + "tidy anything: if a word is slurred, cut off or wrong, write what you hear. Ignore music and sung lyrics. Output only the transcript.";

async function call(n) {
  const body = {
    model: MODEL, temperature: 0, usage: { include: true },
    messages: [{ role: "user", content: [
      { type: "text", text: INSTRUCTION },
      { type: "input_audio", input_audio: { data: readFileSync(join(DIR, n.file)).toString("base64"), format: "mp3" } },
    ] }],
  };
  const attempts = [];
  for (let a = 1; a <= 3; a++) {
    const started = new Date();
    try {
      const r = await fetch(`${BASE}/chat/completions`, {
        method: "POST", body: JSON.stringify(body), signal: AbortSignal.timeout(300_000),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      });
      const text = await r.text();
      const ended = new Date();
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`);
      const j = JSON.parse(text);
      if (j.error) throw new Error(`error: ${JSON.stringify(j.error).slice(0, 200)}`);
      const transcript = j.choices?.[0]?.message?.content ?? "";
      if (!transcript.trim()) throw new Error("empty transcript");
      return {
        id: n.id, text: transcript, started_at: started.toISOString(), ended_at: ended.toISOString(), wall_ms: ended - started,
        audio_seconds: n.seconds, prompt_tokens: j.usage?.prompt_tokens ?? null, completion_tokens: j.usage?.completion_tokens ?? null,
        cost_usd: j.usage?.cost ?? null, provider: j.provider ?? null, served_model: j.model ?? null,
        attempts: [...attempts, { at: started.toISOString(), ok: true }],
      };
    } catch (e) {
      attempts.push({ at: started.toISOString(), ok: false, error: String(e.message ?? e).slice(0, 300) });
      await new Promise((res) => setTimeout(res, 3000 * a));
    }
  }
  return { id: n.id, text: "", failed: true, audio_seconds: n.seconds, attempts };
}

const started = new Date();
const items = [];
for (const n of narrations) {
  items.push(await call(n));
  console.error(`${items.length}/${narrations.length} ${n.id} ${items.at(-1).failed ? "failed" : `${(items.at(-1).wall_ms / 1000).toFixed(1)} s`}`);
}
const ended = new Date();
const day = started.toISOString().slice(0, 10);
const out = args.out ?? join(HERE, "results", `listening-cloud-${MODEL.replace(/[^a-z0-9.]+/gi, "-")}-${day}.json`);
mkdirSync(dirname(out), { recursive: true });
scoreListening({
  job: "listening", route: "cloud", server: new URL(BASE).host,
  settings: { model: MODEL, temperature: 0, instruction: INSTRUCTION, audio: set.format },
  started_at: started.toISOString(), ended_at: ended.toISOString(), node: process.version, items,
}, set, out);
