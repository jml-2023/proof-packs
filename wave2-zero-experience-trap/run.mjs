#!/usr/bin/env node
// wave2-zero-experience-trap — Stage experience & poll-redraw blink auditor ("Passed 81 of 81 tests — and had zero experience", w04).
// Usage:
//   node run.mjs                           # reproduce Build A (81/81 form, 18 blinks) vs Build B (104/104 stage, 0 blinks)
//   node run.mjs --html path/to/App.tsx    # audit frontend source for unguarded innerHTML/root poll redraws & missing stage acts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function auditFrontendSource(srcText) {
  const hasPollLoop = /setInterval\s*\(|usePolling|refetchInterval/i.test(srcText);
  const wipesContainerDom = /\.innerHTML\s*=/.test(srcText) && !/data-live|alreadyMounted/i.test(srcText);
  const unstableRandomKey = /key=\{(?:Math\.random|Date\.now)\(\)/.test(srcText);
  const pollBlinkRisk = hasPollLoop && (wipesContainerDom || unstableRandomKey);
  const actsDetected = ["attract", "lock", "reveal", "podium"].filter((k) => new RegExp(k, "i").test(srcText));
  return {
    hasPollLoop,
    pollBlinkRisk,
    actsDetected,
    actsCoverage: `${actsDetected.length}/4`,
    passesStaticExperienceCheck: !pollBlinkRisk && actsDetected.length >= 3,
  };
}

export function auditStageExperience(build, { durationSec = 180, pollEverySec = 10 } = {}) {
  const polls = Math.floor(durationSec / pollEverySec);
  const entranceBlinks = build.rerendersFullDomOnPoll ? polls : 0;
  const requiredActs = ["hasPrePlayAttractLoop", "hasLockInTensionBeat", "hasRevealPodiumAct", "separatesStageFromPhone"];
  const actsPresent = requiredActs.filter((k) => build[k]).length;
  const standardGatePass = build.functionalTestsPassed === build.functionalTestsTotal && build.tokenViolations === 0;
  const experienceGatePass = standardGatePass && entranceBlinks === 0 && actsPresent === requiredActs.length;
  return {
    name: build.name,
    functionalTestsPassed: build.functionalTestsPassed,
    functionalTestsTotal: build.functionalTestsTotal,
    tokenViolations: build.tokenViolations,
    standardCiAndTokenGate: standardGatePass ? "PASS" : "FAIL",
    pollsIn3Min: polls,
    visibleScreenBlinksOnPoll: entranceBlinks,
    dramaticActsPresent: `${actsPresent}/${requiredActs.length}`,
    experienceGate: experienceGatePass ? "PASS" : "FAIL",
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const hIdx = args.indexOf("--html");
  if (hIdx >= 0) {
    const r = auditFrontendSource(fs.readFileSync(args[hIdx + 1], "utf8"));
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.passesStaticExperienceCheck ? 0 : 2);
  }
  const BUILD_A = { name: "Build A — Token-Compliant Admin Form", functionalTestsPassed: 81, functionalTestsTotal: 81, tokenViolations: 0, rerendersFullDomOnPoll: true, separatesStageFromPhone: false, hasPrePlayAttractLoop: false, hasLockInTensionBeat: false, hasRevealPodiumAct: false };
  const BUILD_B = { name: "Build B — 4-Act Choreographed Stage", functionalTestsPassed: 104, functionalTestsTotal: 104, tokenViolations: 0, rerendersFullDomOnPoll: false, separatesStageFromPhone: true, hasPrePlayAttractLoop: true, hasLockInTensionBeat: true, hasRevealPodiumAct: true };
  const results = { generatedAt: "2026-11-15T12:30:00Z", buildA: auditStageExperience(BUILD_A), buildB: auditStageExperience(BUILD_B) };
  fs.writeFileSync(path.join(HERE, "results-2026-11-15.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify({ buildA: results.buildA, buildB: results.buildB }));
}
