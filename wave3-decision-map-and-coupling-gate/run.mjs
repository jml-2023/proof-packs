#!/usr/bin/env node
// wave3-decision-map-and-coupling-gate — Compiles structured agent plans into lockable decision receipts
// AND blocks "authority laundering" (unbadged synthetic persona quotes/stats) in UX research docs (w12).
// Usage:
//   node run.mjs                                # reproduce prose-plan burial vs decision-lock + UXR laundering audit
//   node run.mjs --audit-uxr research-deck.md   # fail any UXR markdown carrying unbadged synthetic quotes
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function verifyPlanLock(planObj) {
  const open = (planObj.decisions || []).filter((d) => !d.selectedOption);
  const missingDefaults = (planObj.decisions || []).filter((d) => !d.recommendedDefault);
  const canLock = open.length === 0 && missingDefaults.length === 0 && Boolean(planObj.lockedByHuman);
  const lockHash = canLock ? createHash("sha256").update(JSON.stringify(planObj.decisions)).digest("hex").slice(0, 16) : null;
  return { totalDecisions: (planObj.decisions || []).length, openCount: open.length, missingDefaultsCount: missingDefaults.length, locked: canLock, contractHash: lockHash };
}

export function auditUxrAuthorityLaundering(mdText) {
  const lines = String(mdText).split("\n");
  const laundered = [];
  const isSyntheticDoc = /synthetic|persona-panel|simulated|llm respondent/i.test(mdText);
  lines.forEach((l, idx) => {
    // Flag realistic participant-attributed quotes ("...", P04 / Participant 3 / age 34) in a synthetic doc without [SYNTHETIC-HYPOTHESIS] badge
    if (isSyntheticDoc && /[""][^""]{15,}[""]\s*(?:—|-|–)\s*(?:P\d+|Participant|User|Customer|\w+,\s*\d{2})/i.test(l) && !/\[SYNTHETIC/i.test(l)) {
      laundered.push({ line: idx + 1, excerpt: l.trim().slice(0, 90), reason: "synthetic_output_formatted_as_human_quote" });
    }
  });
  return { isSyntheticDoc, launderedQuotesCount: laundered.length, ok: laundered.length === 0, findings: laundered };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const uIdx = args.indexOf("--audit-uxr");
  if (uIdx >= 0) {
    const res = auditUxrAuthorityLaundering(fs.readFileSync(args[uIdx + 1], "utf8"));
    console.log(JSON.stringify(res, null, 2));
    process.exit(res.ok ? 0 : 2);
  }

  const badDeck = `# Q4 Synthetic Persona Discovery
We ran 50 LLM respondents through onboarding.
"I would definitely pay $49 a month for this dashboard" — P12, Finance Lead, 38
"The setup flow felt intuitive and trustworthy" — Participant 7`;

  const cleanDeck = `# Q4 Pre-Test Clarity Crash-Test + 34-Room Human Breakout Index
- [SYNTHETIC-CLARITY-PRECHECK]: 2 of 3 low-prior models misread the 'Pause' label as permanent deletion.
- Verified human session quote (Room 14, 18:42): "Where did my saved filter go?" — verified participant recording.`;

  const unlockedPlan = verifyPlanLock({
    lockedByHuman: false,
    decisions: [
      { id: "D1", recommendedDefault: "sqlite-wal", selectedOption: "sqlite-wal" },
      { id: "D2", recommendedDefault: "keep-free-tier", selectedOption: null },
    ],
  });
  const lockedPlan = verifyPlanLock({
    lockedByHuman: "Jerry Lieveld",
    decisions: [
      { id: "D1", recommendedDefault: "sqlite-wal", selectedOption: "sqlite-wal" },
      { id: "D2", recommendedDefault: "keep-free-tier", selectedOption: "keep-free-tier" },
    ],
  });

  const results = {
    generatedAt: "2026-11-19T15:00:00Z",
    launderedSyntheticDeck: auditUxrAuthorityLaundering(badDeck),
    coupledCleanDeck: auditUxrAuthorityLaundering(cleanDeck),
    unlockedPlanCheck: unlockedPlan,
    humanLockedContract: lockedPlan,
    syntheticSurveyDistortionRange: "2x-4x segment gap inflation (Nielsen / Bakhshi Nov 2026)",
  };
  fs.writeFileSync(path.join(HERE, "results-2026-11-19.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify({
    launderedCaught: results.launderedSyntheticDeck.launderedQuotesCount,
    cleanViolations: results.coupledCleanDeck.launderedQuotesCount,
    lockedContract: lockedPlan.locked,
  }));
}
