#!/usr/bin/env node
// wave4-felt-time-choreography — Audits perceived wait time (feltSeconds), 400ms Doherty ack,
// streaming layout shift (CLS), scroll hijacks, and partial-completion honesty on AI turns (w14).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const PHASE_WEIGHTS = {
  dead_silence: 1.35,      // >400ms with zero visual acknowledgement or frozen UI
  generic_spinner: 1.15,   // "Thinking..." spinner with no concrete object/verb
  fake_skeleton_lie: 1.25, // placeholder bars that vanish & jump layout on arrival
  named_tool_verb: 0.50,   // "Reading contract.pdf (14 pages)..." with elapsed timer + Stop
  progressive_canvas: 0.25 // pre-reserved geometry filling live results without layout shift
};

export function auditStreamExperience(trace) {
  let rawSeconds = 0;
  let feltSeconds = 0;
  for (const seg of trace.segments || []) {
    const w = PHASE_WEIGHTS[seg.kind] ?? 1.0;
    rawSeconds += seg.durationSec;
    feltSeconds += seg.durationSec * w;
  }

  let scrollHijacks = 0;
  let unreservedShiftsPx = 0;
  for (const ev of trace.streamEvents || []) {
    if (ev.userScrolledUp && ev.autoScrolledToBottom) scrollHijacks++;
    if ((ev.unexpectedHeightDeltaPx ?? 0) > 0) unreservedShiftsPx += ev.unexpectedHeightDeltaPx;
  }

  const viewportH = trace.viewportHeightPx || 900;
  const estimatedCls = +(unreservedShiftsPx / (viewportH * 4)).toFixed(3);
  const falseSuccessBanner = Boolean(trace.partialRun && trace.partialRun.succeeded < trace.partialRun.total && trace.partialRun.bannerKind === "generic_success");

  const passes =
    (trace.firstAckMs ?? 9999) <= 400 &&
    scrollHijacks === 0 &&
    estimatedCls <= 0.02 &&
    !falseSuccessBanner;

  return {
    rawSeconds: +rawSeconds.toFixed(2),
    feltSeconds: +feltSeconds.toFixed(2),
    feltToRawRatio: +(feltSeconds / Math.max(0.01, rawSeconds)).toFixed(2),
    firstAckMs: trace.firstAckMs,
    dohertyAckPass: (trace.firstAckMs ?? 9999) <= 400,
    scrollHijacks,
    unreservedShiftsPx,
    estimatedCls,
    falseSuccessBanner,
    passesExperienceBar: passes,
  };
}

const NAIVE_12S_TURN = {
  firstAckMs: 1450,
  viewportHeightPx: 900,
  segments: [
    { kind: "dead_silence", durationSec: 1.45 },
    { kind: "generic_spinner", durationSec: 5.55 },
    { kind: "fake_skeleton_lie", durationSec: 5.00 },
  ],
  streamEvents: [
    { t: 7.2, userScrolledUp: true, autoScrolledToBottom: true, unexpectedHeightDeltaPx: 240 },
    { t: 8.4, userScrolledUp: true, autoScrolledToBottom: true, unexpectedHeightDeltaPx: 380 },
    { t: 9.6, userScrolledUp: true, autoScrolledToBottom: true, unexpectedHeightDeltaPx: 460 },
    { t: 10.8, userScrolledUp: true, autoScrolledToBottom: true, unexpectedHeightDeltaPx: 432 },
  ],
  partialRun: { succeeded: 42, total: 48, bannerKind: "generic_success" },
};

const CHOREOGRAPHED_12S_TURN = {
  firstAckMs: 110,
  viewportHeightPx: 900,
  segments: [
    { kind: "named_tool_verb", durationSec: 3.60 },
    { kind: "progressive_canvas", durationSec: 8.40 },
  ],
  streamEvents: [
    { t: 3.7, userScrolledUp: true, autoScrolledToBottom: false, unexpectedHeightDeltaPx: 0 },
    { t: 6.5, userScrolledUp: true, autoScrolledToBottom: false, unexpectedHeightDeltaPx: 0 },
    { t: 9.8, userScrolledUp: false, autoScrolledToBottom: true, unexpectedHeightDeltaPx: 0 },
  ],
  partialRun: { succeeded: 42, total: 48, bannerKind: "itemised_partial_with_retry_6" },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--trace");
  if (idx >= 0) {
    const res = auditStreamExperience(JSON.parse(fs.readFileSync(args[idx + 1], "utf8")));
    console.log(JSON.stringify(res, null, 2));
    process.exit(res.passesExperienceBar ? 0 : 2);
  }
  const naive = auditStreamExperience(NAIVE_12S_TURN);
  const choreo = auditStreamExperience(CHOREOGRAPHED_12S_TURN);
  const improvementRatio = +(naive.feltSeconds / choreo.feltSeconds).toFixed(2);
  const results = { generatedAt: "2026-11-19T16:30:00Z", sameWallClockSeconds: 12.0, naive12sTurn: naive, choreographed12sTurn: choreo, feltTimeImprovementMultiplier: improvementRatio };
  fs.writeFileSync(path.join(HERE, "results-2026-11-19.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify({
    wallClockSec: 12.0,
    naiveFeltSec: naive.feltSeconds,
    choreoFeltSec: choreo.feltSeconds,
    feltSpeedup: improvementRatio,
    naiveCls: naive.estimatedCls,
    choreoCls: choreo.estimatedCls,
  }));
}
