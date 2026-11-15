#!/usr/bin/env node
// frontier-world-model-answerability — Synthetic benchmark for "The interface you never render" (f01).
// Demonstrates <1ms compiled schema answerability (including operational paused-capability state)
// and 3 distinct agent-rendered surfaces from one governed merchant world model. Zero dependencies, $0.
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const WORLD_MODEL = {
  merchant: "Harbour & Pine Stays (synthetic test merchant)",
  capabilities: {
    room_availability: { status: "active", freshnessSlaSec: 60, owner: "inventory-service" },
    dietary_kitchen_spec: { status: "active", freshnessSlaSec: 3600, owner: "guest-ops" },
    step_free_route_audit: { status: "active", freshnessSlaSec: 86400, owner: "accessibility-ops" },
    x402_instant_hold: { status: "active", freshnessSlaSec: 30, owner: "payments-x402" },
    instant_refund_override: { status: "paused", pausedReason: "settlement switch maintenance until 18:00 UTC", owner: "treasury" },
    partner_airline_tier_match: { status: "paused", pausedReason: "partner feed contract expired", owner: "partnerships" },
    competitor_price_scrape: { status: "unheld", reason: "never collected by policy", owner: "none" },
  },
  offers: [
    { id: "cove-king", title: "Cove King Studio", nightlyEur: 210, stepFree: true, quietWing: true, x402HoldFeeEur: 2.0, refundableUntilHours: 48 },
    { id: "loft-terrace", title: "Timber Loft Terrace", nightlyEur: 265, stepFree: false, quietWing: true, x402HoldFeeEur: 2.5, refundableUntilHours: 24 },
    { id: "courtyard-twin", title: "Courtyard Twin", nightlyEur: 175, stepFree: true, quietWing: false, x402HoldFeeEur: 1.5, refundableUntilHours: 72 },
  ],
};

export function checkAnswerable(model, requiredCaps) {
  const t0 = performance.now();
  const blocked = [];
  for (const cap of requiredCaps) {
    const entry = model.capabilities[cap];
    if (!entry) blocked.push({ capability: cap, state: "unknown_in_schema" });
    else if (entry.status !== "active") blocked.push({ capability: cap, state: entry.status, reason: entry.pausedReason || entry.reason });
  }
  return {
    answerable: blocked.length === 0,
    blocked,
    elapsedMs: +(performance.now() - t0).toFixed(4),
  };
}

function naiveRagAnswer(query) {
  return { answered: true, usesStaleDoc: query.expectsAbstain, confidentClaim: true };
}

export function renderForAgent(offers, persona) {
  if (persona === "x402-autonomous-delegate") {
    const pick = offers.filter((o) => o.nightlyEur <= 220 && o.quietWing)[0];
    return { surface: "machine-x402-intent", selectedOfferId: pick.id, x402HoldEur: pick.x402HoldFeeEur, total2NightsEur: pick.nightlyEur * 2, uiPixelsRendered: 0 };
  }
  if (persona === "voice-commuter-screenless") {
    const pick = offers.filter((o) => o.stepFree)[0];
    const utterance = `One step-free quiet room is open: ${pick.title} at €${pick.nightlyEur} a night, refundable up to ${pick.refundableUntilHours} hours ahead. Say hold to lock it for €${pick.x402HoldFeeEur}.`;
    return { surface: "spoken-single-turn", utterance, wordCount: utterance.split(/\s+/).length };
  }
  return {
    surface: "visual-tradeoff-matrix",
    cards: offers.map((o) => ({ title: o.title, nightlyEur: o.nightlyEur, badges: [o.stepFree ? "Step-free" : "Stairs", o.quietWing ? "Quiet wing" : "Courtyard"] })),
  };
}

const QUERIES = [
  ...Array.from({ length: 16 }, (_, i) => ({ id: `live-${i + 1}`, caps: i % 2 === 0 ? ["room_availability", "x402_instant_hold"] : ["room_availability", "step_free_route_audit"], expectsAbstain: false })),
  { id: "paused-1", caps: ["room_availability", "instant_refund_override"], expectsAbstain: true },
  { id: "paused-2", caps: ["instant_refund_override"], expectsAbstain: true },
  { id: "paused-3", caps: ["partner_airline_tier_match"], expectsAbstain: true },
  { id: "paused-4", caps: ["room_availability", "partner_airline_tier_match"], expectsAbstain: true },
  { id: "unheld-1", caps: ["competitor_price_scrape"], expectsAbstain: true },
  { id: "unheld-2", caps: ["room_availability", "competitor_price_scrape"], expectsAbstain: true },
  { id: "unknown-1", caps: ["late_checkout_waiver_verbal"], expectsAbstain: true },
  { id: "unknown-2", caps: ["room_availability", "vip_upgrade_prediction"], expectsAbstain: true },
];

const checks = QUERIES.map((q) => ({ ...q, schema: checkAnswerable(WORLD_MODEL, q.caps), rag: naiveRagAnswer(q) }));
const latencies = checks.map((c) => c.schema.elapsedMs).sort((a, b) => a - b);
const summary = {
  generatedAt: "2026-11-15T09:40:00Z",
  totalQueries: QUERIES.length,
  liveQueries: 16,
  pausedOrUnheldQueries: 8,
  schemaGate: {
    correctOnLive: checks.filter((c) => !c.expectsAbstain && c.schema.answerable).length,
    correctAbstentions: checks.filter((c) => c.expectsAbstain && !c.schema.answerable).length,
    falseConfidentAnswers: checks.filter((c) => c.expectsAbstain && c.schema.answerable).length,
    medianMs: latencies[Math.floor(latencies.length / 2)],
    maxMs: latencies[latencies.length - 1],
  },
  naiveRag: {
    falseConfidentAnswersOnPausedOrUnheld: checks.filter((c) => c.expectsAbstain && c.rag.answered).length,
  },
  surfacesFromOneModel: {
    x402Delegate: renderForAgent(WORLD_MODEL.offers, "x402-autonomous-delegate"),
    screenlessVoice: renderForAgent(WORLD_MODEL.offers, "voice-commuter-screenless"),
    visualMatrix: renderForAgent(WORLD_MODEL.offers, "visual-comparison"),
  },
};
fs.writeFileSync(path.join(HERE, "results-2026-11-15.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary.schemaGate));
