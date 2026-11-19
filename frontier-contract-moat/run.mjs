#!/usr/bin/env node
// frontier-contract-moat — Stateless surface reconstruction vs governed streak/canary moat ("When models read the machine backwards", f04).
// Usage:
//   node run.mjs                          # reproduce 8-probe SaaS pricing clone vs 24-transition governed moat
//   node run.mjs --streak-bound 0.05      # compute exact 95%-confidence error-free streak required for max error rate p
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function requiredErrorFreeStreak(maxErrorRate = 0.05, confidence = 0.95) {
  const n = Math.ceil(Math.log(1 - confidence) / Math.log(1 - maxErrorRate));
  const ruleOfThreeApprox = Math.ceil(3 / maxErrorRate);
  return { maxErrorRate, confidence, exactStreakRequired: n, ruleOfThreeApprox };
}

export function staticPricingEngine({ seats, annual, nonProfit }) {
  const base = seats <= 10 ? 29 : seats <= 50 ? 24 : 19;
  const disc = (annual ? 0.85 : 1.0) * (nonProfit ? 0.7 : 1.0);
  return +(seats * base * disc).toFixed(2);
}

export function reconstructStaticEngine(oracle) {
  const unitAt = (s, a, np) => oracle({ seats: s, annual: a, nonProfit: np }) / s;
  const tiers = {};
  for (const s of [1, 10, 11, 50, 51, 100]) tiers[s] = +unitAt(s, false, false).toFixed(4);
  const annualMult = +(unitAt(5, true, false) / unitAt(5, false, false)).toFixed(4);
  const npMult = +(unitAt(5, false, true) / unitAt(5, false, false)).toFixed(4);
  let exact = 0, withinOneCent = 0;
  for (let s = 1; s <= 100; s += 2) {
    for (const [a, np] of [[false, false], [true, false], [false, true], [true, true]]) {
      const b = s <= 10 ? tiers[10] : s <= 50 ? tiers[50] : tiers[51];
      const pred = +(s * b * (a ? annualMult : 1) * (np ? npMult : 1)).toFixed(2);
      const truth = oracle({ seats: s, annual: a, nonProfit: np });
      if (pred === truth) exact++;
      if (Math.abs(pred - truth) <= 0.01) withinOneCent++;
    }
  }
  return { probesSent: 8, unseenCases: 200, exactMatches: exact, recoveryPct: +((exact / 200) * 100).toFixed(1), withinOneCentMatches: withinOneCent, withinOneCentPct: +((withinOneCent / 200) * 100).toFixed(1) };
}

export function probeGovernedMoat() {
  const domains = [{ id: "billing_refund", initialStreak: 64 }, { id: "contract_clause", initialStreak: 12 }, { id: "custom_sla", initialStreak: 3 }, { id: "tier_upgrade", initialStreak: 61 }];
  const transitions = [
    { canaryOk: true, streakReset: false }, { canaryOk: false, streakReset: false },
    { canaryOk: true, streakReset: true }, { canaryOk: false, streakReset: true },
    { canaryOk: true, streakPromote: true }, { canaryOk: false, streakPromote: true },
  ];
  const snapshotClone = Object.fromEntries(domains.map((d) => [d.id, d.initialStreak >= 59 ? "autonomous_act" : d.initialStreak >= 10 ? "propose_near_loop" : "escalate_in_loop"]));
  let total = 0, cloneMisroutes = 0;
  for (const d of domains) {
    for (const tr of transitions) {
      total++;
      const liveStreak = tr.streakReset ? 0 : tr.streakPromote ? 60 : d.initialStreak;
      const truth = !tr.canaryOk ? "abstain_provider_canary_red" : liveStreak >= 59 ? "autonomous_act" : liveStreak >= 10 ? "propose_near_loop" : "escalate_in_loop";
      if (snapshotClone[d.id] !== truth) cloneMisroutes++;
    }
  }
  return { transitionsTested: total, cloneMisroutes, cloneMisroutePct: +((cloneMisroutes / total) * 100).toFixed(1) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes("--streak-bound")) {
    const p = Number(args[args.indexOf("--streak-bound") + 1] || 0.05);
    console.log(JSON.stringify(requiredErrorFreeStreak(p), null, 2));
    process.exit(0);
  }
  const staticAudit = reconstructStaticEngine(staticPricingEngine);
  const governedAudit = probeGovernedMoat();
  const results = { generatedAt: "2026-11-15T09:55:00Z", staticSurfaceLogic: staticAudit, governedOffSurfaceRouting: governedAudit, binomialStreakBound5Pct: requiredErrorFreeStreak(0.05) };
  fs.writeFileSync(path.join(HERE, "results-2026-11-15.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify({ static: staticAudit, governed: governedAudit }));
}
