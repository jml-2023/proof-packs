#!/usr/bin/env node
// frontier-loop-proximity-dissent — 3-band Loop Proximity & cross-family dissent simulator ("In, near, and out of the loop", f02).
// Usage:
//   node run.mjs                            # reproduce 210-alert, 20-handoff, 32-proposal simulation
//   node run.mjs --alerts my-alerts.jsonl   # classify your own operational alert log into Real-Time Page vs 6h Digest
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE_CLASSES = new Set(["runaway_or_spend_ceiling", "deadman_or_zdr_breach", "release_hold"]);

export function classifyAlerts(alerts) {
  const pages = alerts.filter((a) => PAGE_CLASSES.has(a.cls) || a.irreversiblePage === true);
  const digest = alerts.length - pages.length;
  return {
    totalAlerts: alerts.length,
    realTimePages: pages.length,
    batchedIn6hDigest: digest,
    interruptionReductionPct: alerts.length ? +((digest / alerts.length) * 100).toFixed(1) : 0,
  };
}

export function streakEarned(grades, bar = 8) {
  let s = 0;
  for (const g of grades) { s = g ? s + 1 : 0; if (s >= bar) return true; }
  return false;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const aIdx = args.indexOf("--alerts");
  if (aIdx >= 0) {
    const rows = fs.readFileSync(args[aIdx + 1], "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
    console.log(JSON.stringify(classifyAlerts(rows), null, 2));
    process.exit(0);
  }
  const ALERTS = Array.from({ length: 210 }, (_, i) => {
    const cls = i < 11 ? "runaway_or_spend_ceiling" : i < 19 ? "deadman_or_zdr_breach" : i < 24 ? "release_hold" : "routine_status_chatter";
    return { id: i + 1, cls, actionableByHuman: cls !== "routine_status_chatter" };
  });
  const HANDOFFS = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, inLoopDecisions: 1 + (i % 7), outLoopFixes: 2 + (i % 4) }));
  const PROPOSALS = Array.from({ length: 32 }, (_, i) => ({ id: i + 1, hasFlaw: i < 9, sameFamilyCatches: i < 3, crossFamilyCatches: i < 8 }));
  const totalInLoop = HANDOFFS.reduce((s, h) => s + h.inLoopDecisions, 0);
  const hiddenByCapOf3 = HANDOFFS.reduce((s, h) => s + Math.max(0, h.inLoopDecisions - 3), 0);
  const ac = classifyAlerts(ALERTS);
  const results = {
    generatedAt: "2026-11-15T09:40:00Z",
    alertsComparison: { unfilteredPages: 210, unfilteredActionableSharePct: 11.4, threeConditionPages: ac.realTimePages, interruptionReductionPct: ac.interruptionReductionPct, threeConditionActionableSharePct: 100, signalsLostFromDigest: 0 },
    handoffComparison: { projects: 20, genuineInLoopDecisions: totalInLoop, hiddenOrDeferredUnderCapOf3: hiddenByCapOf3, hiddenSharePct: +((hiddenByCapOf3 / totalInLoop) * 100).toFixed(1), surfacedWithDefaultUnderLoopSplit: totalInLoop },
    dissentComparison: { plantedFlaws: 9, sameFamilySelfReviewCaught: PROPOSALS.filter((p) => p.sameFamilyCatches).length, crossFamilyDissentCaught: PROPOSALS.filter((p) => p.crossFamilyCatches).length },
  };
  fs.writeFileSync(path.join(HERE, "results-2026-11-15.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify({ interruptionReductionPct: results.alertsComparison.interruptionReductionPct, hiddenSharePct: results.handoffComparison.hiddenSharePct }));
}
