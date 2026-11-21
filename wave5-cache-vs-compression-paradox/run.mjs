#!/usr/bin/env node
// wave5-cache-vs-compression-paradox — Analyses the recorded 21 Nov 2026 12-turn 3-arm live canary
// (recorded-12turn-canary.json) + implements Cold-Turn-Only Tombstone gating & --audit-turns CLI (w17).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function summariseArm(rows) {
  const totalCost = +rows.reduce((s, r) => s + r.cost, 0).toFixed(6);
  const lateTurnsCost = +rows.slice(-3).reduce((s, r) => s + r.cost, 0).toFixed(6);
  const passed = rows.reduce((s, r) => s + (r.passed ?? 0), 0);
  const totalChecks = rows.reduce((s, r) => s + (r.total ?? 0), 0);
  const sortedMs = rows.map((r) => r.elapsedMs).sort((a, b) => a - b);
  const mid = Math.floor(sortedMs.length / 2);
  const p50Ms = sortedMs.length % 2 === 1 ? sortedMs[mid] : +((sortedMs[mid - 1] + sortedMs[mid]) / 2).toFixed(1);
  const warmRows = rows.slice(1);
  const meanWarmCachePct = +(warmRows.reduce((s, r) => s + (r.cachePct ?? 0), 0) / Math.max(1, warmRows.length)).toFixed(1);
  return { turns: rows.length, passed, totalChecks, totalCost, lateTurnsCost, p50Ms, meanWarmCachePct };
}

// Cold-turn-only invariant: NEVER mutate historical tool outputs while upstream prompt cache is warm!
export function shouldMintTombstones({ idleSeconds, providerCacheTtlSeconds = 180, payloadBytes = 0, hardPayloadCapBytes = 800_000 }) {
  if (idleSeconds > providerCacheTtlSeconds) return { compress: true, reason: "cache_already_cold_past_ttl" };
  if (payloadBytes > hardPayloadCapBytes) return { compress: true, reason: "payload_exceeded_safety_ceiling" };
  return { compress: false, reason: "preserve_warm_prefix_cache" };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const tIdx = args.indexOf("--audit-turns");
  if (tIdx >= 0) {
    const rows = fs.readFileSync(args[tIdx + 1], "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
    console.log(JSON.stringify(summariseArm(rows), null, 2));
    process.exit(0);
  }

  const canary = JSON.parse(fs.readFileSync(path.join(HERE, "recorded-12turn-canary.json"), "utf8"));
  const plain = summariseArm(canary.arms.plain);
  const pxpipe = summariseArm(canary.arms.pxpipe);
  const eager = summariseArm(canary.arms.eager_tombstone);

  const lateSavingPct = +(((pxpipe.lateTurnsCost - plain.lateTurnsCost) / plain.lateTurnsCost) * 100).toFixed(1);
  const totalCostDeltaPct = +(((pxpipe.totalCost - plain.totalCost) / plain.totalCost) * 100).toFixed(1);
  const p50SlowdownPct = +(((pxpipe.p50Ms - plain.p50Ms) / plain.p50Ms) * 100).toFixed(1);
  const eagerCostDeltaPct = +(((eager.totalCost - plain.totalCost) / plain.totalCost) * 100).toFixed(1);

  const warmGate = shouldMintTombstones({ idleSeconds: 12, providerCacheTtlSeconds: 180 });
  const coldGate = shouldMintTombstones({ idleSeconds: 240, providerCacheTtlSeconds: 180 });

  console.log(JSON.stringify({
    pxpipeScore: `${pxpipe.passed}/${pxpipe.totalChecks}`,
    lateSavingPct,
    totalCostDeltaPct,
    p50SlowdownPct,
    eagerCostDeltaPct,
    warmPreservesCache: !warmGate.compress,
    coldCompresses: coldGate.compress,
  }));
}
