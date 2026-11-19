#!/usr/bin/env node
// wave2-effort-inversion — Reasoning effort inversion & JSON truncation classifier ("Raising reasoning effort broke the winner", w01).
// Usage:
//   node run.mjs                            # reproduce 4-part evaluation trap benchmark
//   node run.mjs --jsonl responses.jsonl    # separate length-truncation failures from true JSON schema errors in your own API logs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function classifyJsonlResponses(jsonlText) {
  const rows = String(jsonlText).trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  let validJson = 0, truncatedByCap = 0, trueSchemaError = 0;
  for (const r of rows) {
    const choice = r.choices?.[0] ?? r;
    const finish = choice.finish_reason ?? r.stop_reason ?? null;
    const content = choice.message?.content ?? r.content ?? "";
    let parsedOk = false;
    try { JSON.parse(typeof content === "string" ? content.replace(/^```json\s*|\s*```$/g, "").trim() : ""); parsedOk = true; } catch {}
    if (parsedOk) validJson++;
    else if (finish === "length" || finish === "max_tokens") truncatedByCap++;
    else trueSchemaError++;
  }
  return { totalCalls: rows.length, validJson, truncatedByCap, trueSchemaError };
}

export function simulateEffortRun(tasks, effort, { timeoutSec = 180, maxOutTokens = 16384 } = {}) {
  const citesPerClaim = effort === "low" ? 1.5 : 5.2;
  const thinkTokensPerClaim = effort === "low" ? 140 : 1450;
  const bodyTokensPerCite = 125;
  const tokPerSec = 82;
  let finished = 0, timeouts = 0, truncated = 0, validCitationTasks = 0;
  for (const t of tasks) {
    const totalTokens = Math.round(t.claimsToSupport * (thinkTokensPerClaim + citesPerClaim * bodyTokensPerCite));
    const sec = totalTokens / tokPerSec;
    if (sec > timeoutSec && effort === "high" && t.claimsToSupport >= 8) { timeouts++; continue; }
    if (totalTokens > maxOutTokens) { truncated++; continue; }
    finished++;
    const precision = effort === "low" ? 0.85 : 0.42;
    if (precision >= 0.75) validCitationTasks++;
  }
  return { effort, total: tasks.length, finished, timeouts, truncated, validCitationTasks };
}

export function simulateJsonBudget(modelTokensNeeded, maxTokensCap) {
  return { maxTokensCap, validJson: modelTokensNeeded.filter((t) => t <= maxTokensCap).length, total: modelTokensNeeded.length };
}

export function check1FpsCatch(glitches, sampleFps = 1) {
  const period = 1 / sampleFps;
  const sampled = glitches.filter((g) => Math.floor(g.startSec / period) !== Math.floor((g.startSec + g.durSec) / period));
  return { totalPlanted: glitches.length, framesDecodedWithGlitch: sampled.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: node run.mjs [--jsonl openrouter-responses.jsonl]");
    process.exit(0);
  }
  const jIdx = args.indexOf("--jsonl");
  if (jIdx >= 0) {
    console.log(JSON.stringify(classifyJsonlResponses(fs.readFileSync(args[jIdx + 1], "utf8")), null, 2));
    process.exit(0);
  }

  const BAKEOFF = [
    { model: "Candidate-Argon", passed: 20, total: 20, elapsedSec: 30.5, costUsd: 0.0105, panelMean: 7.20, pairwiseWinRate: 0.17 },
    { model: "Incumbent-Flash", passed: 20, total: 20, elapsedSec: 40.2, costUsd: 0.0200, panelMean: 7.59, pairwiseWinRate: 0.47 },
    { model: "Candidate-Hydrogen", passed: 20, total: 20, elapsedSec: 42.8, costUsd: 0.0502, panelMean: 7.61, pairwiseWinRate: 0.63 },
    { model: "Candidate-Carbon", passed: 20, total: 20, elapsedSec: 89.3, costUsd: 0.0626, panelMean: 7.67, pairwiseWinRate: 0.72 },
  ];
  const SYNTHESIS_TASKS = Array.from({ length: 12 }, (_, i) => ({ id: `case-${i + 1}`, claimsToSupport: 6 + (i % 5) }));
  const CARBON_SCOUT_TOKENS = [3890, 4420, 4810, 5390, 6005];
  const ARGON_SCOUT_TOKENS = [1872, 2010, 2190, 2440, 2655];
  const PLANTED_GLITCHES = Array.from({ length: 28 }, (_, i) => ({ id: i + 1, startSec: i * 1.0 + 0.22, durSec: 0.20 }));

  const results = {
    generatedAt: "2026-11-15T12:30:00Z",
    bakeoffSaturation: BAKEOFF,
    effortInversion: {
      carbonLowEffort: simulateEffortRun(SYNTHESIS_TASKS, "low"),
      carbonHighEffort: simulateEffortRun(SYNTHESIS_TASKS, "high"),
    },
    jsonBudgetCliff: {
      carbonAt4096: simulateJsonBudget(CARBON_SCOUT_TOKENS, 4096),
      carbonAt16384: simulateJsonBudget(CARBON_SCOUT_TOKENS, 16384),
      argonAt4096: simulateJsonBudget(ARGON_SCOUT_TOKENS, 4096),
    },
    videoSampling1Fps: check1FpsCatch(PLANTED_GLITCHES, 1),
  };
  fs.writeFileSync(path.join(HERE, "results-2026-11-15.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify({
    lowFinished: results.effortInversion.carbonLowEffort.finished,
    highFinished: results.effortInversion.carbonHighEffort.finished,
    carbon4kJson: results.jsonBudgetCliff.carbonAt4096.validJson,
    carbon16kJson: results.jsonBudgetCliff.carbonAt16384.validJson,
    glitchesAt1Fps: results.videoSampling1Fps.framesDecodedWithGlitch,
  }));
}
