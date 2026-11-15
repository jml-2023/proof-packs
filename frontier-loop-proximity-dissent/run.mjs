#!/usr/bin/env node
// frontier-loop-proximity-dissent — Synthetic replay for "In, near, and out of the loop" (f02).
// Compares binary HITL + artificial 3-decision handoff caps + single-family self-review against
// 3-tier Loop Proximity (Out / Near / In), 3-condition paging, 8-streak autonomy, and cross-family dissent.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function rng(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261115);

const ALERTS = Array.from({ length: 210 }, (_, i) => {
  const cls = i < 11 ? "runaway_or_spend_ceiling" : i < 19 ? "deadman_or_zdr_breach" : i < 24 ? "release_hold" : "routine_status_chatter";
  return { id: i + 1, cls, actionableByHuman: cls !== "routine_status_chatter" };
});

const HANDOFFS = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  inLoopDecisions: 1 + (i % 7),
  outLoopFixes: 2 + (i % 4),
}));

const PROPOSALS = Array.from({ length: 32 }, (_, i) => {
  const hasFlaw = i < 9;
  return { id: i + 1, hasFlaw, sameFamilyCatches: hasFlaw && i < 3, crossFamilyCatches: hasFlaw && i < 8 };
});

const LANE_GRADES = {
  lane_a_clean: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  lane_b_flaky_at_6: [1, 1, 1, 1, 1, 0, 1, 1, 1, 1],
  lane_c_drifted: [1, 0, 1, 1, 0, 1, 1, 1, 0, 1],
  lane_d_improving: [0, 0, 1, 1, 1, 1, 1, 1, 1, 1],
};
function streakEarned(grades, bar = 8) {
  let s = 0;
  for (const g of grades) {
    s = g ? s + 1 : 0;
    if (s >= bar) return true;
  }
  return false;
}

const totalInLoop = HANDOFFS.reduce((s, h) => s + h.inLoopDecisions, 0);
const hiddenByCapOf3 = HANDOFFS.reduce((s, h) => s + Math.max(0, h.inLoopDecisions - 3), 0);
const outLoopParkedOnHuman = HANDOFFS.reduce((s) => s + (rand() < 0.35 ? 1 : 0), 0);

const pagedAll = ALERTS.length;
const actionableCount = ALERTS.filter((a) => a.actionableByHuman).length;
const paged3Condition = ALERTS.filter((a) => a.cls !== "routine_status_chatter").length;

const results = {
  generatedAt: "2026-11-15T09:40:00Z",
  alertsComparison: {
    unfilteredPages: pagedAll,
    unfilteredActionableSharePct: +((actionableCount / pagedAll) * 100).toFixed(1),
    threeConditionPages: paged3Condition,
    interruptionReductionPct: +(((pagedAll - paged3Condition) / pagedAll) * 100).toFixed(1),
    threeConditionActionableSharePct: +((actionableCount / paged3Condition) * 100).toFixed(1),
    signalsLostFromDigest: 0,
  },
  handoffComparison: {
    projects: HANDOFFS.length,
    genuineInLoopDecisions: totalInLoop,
    hiddenOrDeferredUnderCapOf3: hiddenByCapOf3,
    hiddenSharePct: +((hiddenByCapOf3 / totalInLoop) * 100).toFixed(1),
    surfacedWithDefaultUnderLoopSplit: totalInLoop,
    reversibleFixesExecutedOutOfLoop: HANDOFFS.reduce((s, h) => s + h.outLoopFixes, 0),
    oldHabitParkedAsOffers: outLoopParkedOnHuman,
  },
  dissentComparison: {
    plantedFlaws: 9,
    sameFamilySelfReviewCaught: PROPOSALS.filter((p) => p.sameFamilyCatches).length,
    crossFamilyDissentCaught: PROPOSALS.filter((p) => p.crossFamilyCatches).length,
  },
  autonomyStreaksBar8: Object.fromEntries(Object.entries(LANE_GRADES).map(([k, v]) => [k, { grades: v, earnedAutonomy: streakEarned(v, 8) }])),
};

fs.writeFileSync(path.join(HERE, "results-2026-11-15.json"), JSON.stringify(results, null, 2) + "\n");
console.log(JSON.stringify({ interruptionReductionPct: results.alertsComparison.interruptionReductionPct, hiddenSharePct: results.handoffComparison.hiddenSharePct }));
