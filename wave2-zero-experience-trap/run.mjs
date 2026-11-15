#!/usr/bin/env node
// wave2-zero-experience-trap — Synthetic stage-experience gate behind W4:
// "Passed 81 of 81 tests, scored 8.9 on the panel — and had zero experience."
// Compares a functionally compliant AI-built multiplayer quiz screen ("Form-on-a-Projector") against
// an experience-gated stage build, catching the 10-second polling entrance-blink bug and missing act choreography.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const BUILD_A_FORM_ON_PROJECTOR = {
  name: "Build A — Token-Compliant Admin Form",
  functionalTestsPassed: 81,
  functionalTestsTotal: 81,
  tokenViolations: 0,
  stagesImplemented: ["question_form", "leaderboard_table"],
  rerendersFullDomOnPoll: true, // replays @keyframes fadeIn every 10s poll!
  separatesStageFromPhone: false,
  hasPrePlayAttractLoop: false,
  hasLockInTensionBeat: false,
  hasRevealPodiumAct: false,
};

const BUILD_B_STAGE_EXPERIENCE = {
  name: "Build B — 4-Act Choreographed Stage",
  functionalTestsPassed: 104,
  functionalTestsTotal: 104,
  tokenViolations: 0,
  stagesImplemented: ["attract_title_loop", "wager_lock_in", "synchronized_reveal", "podium_finale"],
  rerendersFullDomOnPoll: false, // skips entrance animation when [data-live="1"] is already mounted
  separatesStageFromPhone: true,
  hasPrePlayAttractLoop: true,
  hasLockInTensionBeat: true,
  hasRevealPodiumAct: true,
};

export function auditStageExperience(build, { durationSec = 180, pollEverySec = 10 } = {}) {
  const polls = Math.floor(durationSec / pollEverySec);
  const entranceBlinks = build.rerendersFullDomOnPoll ? polls : 0;
  const requiredActs = ["hasPrePlayAttractLoop", "hasLockInTensionBeat", "hasRevealPodiumAct", "separatesStageFromPhone"];
  const actsPresent = requiredActs.filter((k) => build[k]).length;
  const standardGatePass = build.functionalTestsPassed === build.functionalTestsTotal && build.tokenViolations === 0;
  const experienceGatePass = standardGatePass && entranceBlinks === 0 && actsPresent === requiredActs.length;
  return {
    name: build.name,
    standardCiAndTokenGate: standardGatePass ? "PASS" : "FAIL",
    pollsIn3Min: polls,
    visibleScreenBlinksOnPoll: entranceBlinks,
    dramaticActsPresent: `${actsPresent}/${requiredActs.length}`,
    experienceGate: experienceGatePass ? "PASS" : "FAIL",
  };
}

const results = {
  generatedAt: "2026-11-15T12:30:00Z",
  buildA: auditStageExperience(BUILD_A_FORM_ON_PROJECTOR),
  buildB: auditStageExperience(BUILD_B_STAGE_EXPERIENCE),
};

fs.writeFileSync(path.join(HERE, "results-2026-11-15.json"), JSON.stringify(results, null, 2) + "\n");
console.log(JSON.stringify({ buildA: results.buildA, buildB: results.buildB }));
