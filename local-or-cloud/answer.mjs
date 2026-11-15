// The answering job: puts the 140 public exam questions to one model on one route, scores the answers and records
// the time, tokens, money and (for a cloud route) the company that served each call.
//
//   node answer.mjs --route local --model gpt-oss:20b                        (Ollama on this machine, port 11434)
//   node answer.mjs --route local --base-url http://<that machine>:11434/v1 --model gpt-oss:20b   (Ollama on another machine)
//   OPENROUTER_API_KEY=... node answer.mjs --route cloud --model openai/gpt-oss-20b
//
// Any server that speaks the OpenAI chat format works for --route local (Ollama, LM Studio, llama.cpp's server).
// Options: --limit N (first N questions, for a trial), --concurrency 1, --reasoning medium, --temperature 1,
// --max-tokens 8000, --tasks tasks/answering.jsonl, --out <file>. Writes results/answering-<route>-<model>-<date>.json
// and a .md summary beside it. Node 18 or later; nothing to install.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LETTERS, extract, summarise, markdown } from "./score-answers.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith("--") ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const ROUTE = args.route;
if (!["local", "cloud"].includes(ROUTE) || !args.model) {
  console.error("usage: node answer.mjs --route local|cloud --model <model> [--base-url <url>] [--limit N] [--concurrency 1]");
  process.exit(2);
}
const BASE = (args["base-url"] ?? (ROUTE === "cloud" ? "https://openrouter.ai/api/v1" : "http://127.0.0.1:11434/v1")).replace(/\/$/, "");
const OPENROUTER = BASE.includes("openrouter.ai");
const KEY = process.env[args["key-env"] ?? "OPENROUTER_API_KEY"];
if (ROUTE === "cloud" && !KEY) { console.error("set OPENROUTER_API_KEY (or name another variable with --key-env)"); process.exit(2); }
const S = {
  model: args.model, reasoning: args.reasoning ?? "medium", temperature: Number(args.temperature ?? 1),
  max_tokens: Number(args["max-tokens"] ?? 8000), concurrency: Number(args.concurrency ?? 1), timeout_s: Number(args["timeout-s"] ?? 900),
};
const tasks = readFileSync(args.tasks ?? join(HERE, "tasks", "answering.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
  .slice(0, args.limit ? Number(args.limit) : undefined);

// MMLU-Pro's own zero-shot chain-of-thought instruction.
const prompt = (t) => [
  `The following is a multiple choice question about ${t.category}. Think step by step and then finish your answer with "The answer is (X)" where X is the correct letter choice.`,
  "", `Question: ${t.question}`, "Options:", ...t.options.map((o, i) => `${LETTERS[i]}. ${o}`), "",
].join("\n");

async function call(t) {
  const body = {
    model: S.model, temperature: S.temperature, max_tokens: S.max_tokens,
    messages: [{ role: "user", content: prompt(t) }],
    ...(OPENROUTER ? { reasoning: { effort: S.reasoning }, usage: { include: true } } : { reasoning_effort: S.reasoning }),
  };
  const attempts = [];
  for (let a = 1; a <= 3; a++) {
    const started = new Date();
    try {
      const r = await fetch(`${BASE}/chat/completions`, {
        method: "POST", body: JSON.stringify(body), signal: AbortSignal.timeout(S.timeout_s * 1000),
        headers: { "Content-Type": "application/json", ...(KEY && ROUTE === "cloud" ? { Authorization: `Bearer ${KEY}` } : {}) },
      });
      const text = await r.text();
      const ended = new Date();
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`);
      const j = JSON.parse(text);
      if (j.error) throw new Error(`error: ${JSON.stringify(j.error).slice(0, 200)}`);
      const c = j.choices?.[0] ?? {};
      const content = c.message?.content ?? "";
      const got = extract(content, t.options.length);
      return {
        question_id: t.question_id, category: t.category, answer: t.answer, got, correct: got === t.answer,
        finish_reason: c.finish_reason ?? null, started_at: started.toISOString(), ended_at: ended.toISOString(),
        wall_ms: ended - started, prompt_tokens: j.usage?.prompt_tokens ?? null, completion_tokens: j.usage?.completion_tokens ?? null,
        reasoning_tokens: j.usage?.completion_tokens_details?.reasoning_tokens ?? null, cost_usd: j.usage?.cost ?? null,
        provider: j.provider ?? null, served_model: j.model ?? null, attempts: [...attempts, { at: started.toISOString(), ok: true }],
        tail: content.slice(-300),
      };
    } catch (e) {
      attempts.push({ at: started.toISOString(), ok: false, error: String(e.message ?? e).slice(0, 300) });
      await new Promise((res) => setTimeout(res, 3000 * a));
    }
  }
  return { question_id: t.question_id, category: t.category, answer: t.answer, got: null, correct: false, failed: true, attempts };
}

const started = new Date();
const items = new Array(tasks.length);
let next = 0, done = 0;
await Promise.all(Array.from({ length: S.concurrency }, async () => {
  while (next < tasks.length) {
    const k = next++;
    items[k] = await call(tasks[k]);
    done++;
    if (done % 10 === 0 || done === tasks.length) console.error(`${done}/${tasks.length} ${items.filter((x) => x?.correct).length} right`);
  }
}));
const ended = new Date();

const summary = summarise(items, (ended - started) / 1000);
const day = started.toISOString().slice(0, 10);
const tag = `${ROUTE}-${S.model.replace(/[^a-z0-9.]+/gi, "-")}-${day}`;
const out = args.out ?? join(HERE, "results", `answering-${tag}.json`);
mkdirSync(dirname(out), { recursive: true });
const run = {
  job: "answering", route: ROUTE, server: new URL(BASE).host, settings: S, started_at: started.toISOString(), ended_at: ended.toISOString(),
  node: process.version, summary, items,
};
writeFileSync(out, JSON.stringify(run, null, 2) + "\n");
writeFileSync(out.replace(/\.json$/, ".md"), markdown(run));
console.log(`${tag}: ${summary.right}/${items.length} right; ${(summary.wall_seconds / 60).toFixed(1)} min; ${out}`);
