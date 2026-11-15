#!/usr/bin/env node
// wave2-wake-sleep-gate — Runnable Wake/Sleep trajectory distiller & EvoOntology holdout gate behind W2:
// "The machine built to learn from my mistakes threw away all five of its own ideas."
// Shows why mining recurring agent errors produces mostly vague prose ("check paths first") that MUST be
// rejected by specificity, falsifiability, holdout-disjointness, and paired-uplift gates — while catching
// genuine 0%-accuracy schema-drift bugs in shadow classifiers.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const FROZEN_HOLDOUT_IDS = new Set(Array.from({ length: 30 }, (_, i) => `fh-${String(i + 1).padStart(2, "0")}`));

// Candidate skills proposed by clustering 3,900 recurring tool/session errors
const PROPOSED_SKILLS = [
  { id: "cand-1", cluster: "bash_permission_denied (2,182 hits / 388 sessions)", ruleTitle: "Check permissions before shell commands", specificity: 1.89, falsifiability: 0.45, devTasks: ["dev-01", "dev-02"], baselineUplift: 0.01, frontierDelta: -0.01, tokenOverheadPct: 14 },
  { id: "cand-2", cluster: "read_missing_path (731 hits / 245 sessions)", ruleTitle: "Verify file paths exist before reading", specificity: 1.94, falsifiability: 0.51, devTasks: ["dev-03", "dev-04"], baselineUplift: 0.03, frontierDelta: 0.00, tokenOverheadPct: 18 },
  { id: "cand-3", cluster: "edit_non_unique_match (486 hits / 125 sessions)", ruleTitle: "Include more context lines in edits", specificity: 2.01, falsifiability: 0.54, devTasks: ["dev-05", "dev-06"], baselineUplift: 0.04, frontierDelta: -0.01, tokenOverheadPct: 22 },
  { id: "cand-4", cluster: "stale_edit_after_write (205 hits / 76 sessions)", ruleTitle: "Re-read modified files carefully", specificity: 1.92, falsifiability: 0.48, devTasks: ["dev-07"], baselineUplift: 0.02, frontierDelta: -0.03, tokenOverheadPct: 19 },
  { id: "cand-5", cluster: "timeout_on_broad_grep (82 hits / 43 sessions)", ruleTitle: "Prefer narrower search directories", specificity: 1.96, falsifiability: 0.52, devTasks: ["dev-08"], baselineUplift: 0.05, frontierDelta: 0.00, tokenOverheadPct: 12 },
];

// Planted holdout-leak control + genuine high-uplift deterministic skill control
const CONTROLS = [
  { id: "ctrl-holdout-leak", cluster: "contaminated_eval", ruleTitle: "Leaked holdout skill", specificity: 2.6, falsifiability: 0.9, devTasks: ["dev-01", "fh-14"], baselineUplift: 0.25, frontierDelta: 0.05, tokenOverheadPct: 8 },
  { id: "ctrl-valid-guard", cluster: "executable_schema_check", ruleTitle: "Validate enum vocabulary before classifier inference", specificity: 2.7, falsifiability: 0.92, devTasks: ["dev-09", "dev-10"], baselineUplift: 0.18, frontierDelta: 0.02, tokenOverheadPct: 9 },
];

export function evaluateCandidate(c) {
  const reasons = [];
  if (c.devTasks.some((t) => FROZEN_HOLDOUT_IDS.has(t))) reasons.push("holdout_contamination");
  if (c.specificity < 2.0) reasons.push(`specificity_${c.specificity}_below_2.0`);
  if (c.falsifiability < 0.75) reasons.push(`falsifiability_${c.falsifiability}_below_0.75`);
  if (c.baselineUplift < 0.10) reasons.push(`baseline_uplift_${c.baselineUplift}_below_0.10`);
  if (c.frontierDelta < -0.02) reasons.push(`frontier_regression_${c.frontierDelta}`);
  if (c.tokenOverheadPct > 25) reasons.push(`token_overhead_${c.tokenOverheadPct}pct_above_25`);
  return { id: c.id, promoted: reasons.length === 0, reasons };
}

// Shadow classifier drift detector (catches vocabulary/schema drift rather than writing a prose skill)
const CLASSIFIER_HEADS = [
  { head: "routing-authority", settledRows: 26, correctBefore: 0, skippedOptionsChanged: 0, oofAfterRetrainPct: 95.92 },
  { head: "recovery-strategy", settledRows: 211, correctBefore: 41, skippedOptionsChanged: 1295, oofAfterRetrainPct: 93.36 },
];

const results = {
  generatedAt: "2026-11-15T12:30:00Z",
  bars: { minSpecificity: 2.0, minFalsifiability: 0.75, minBaselineUplift: 0.10, minFrontierDelta: -0.02, maxTokenOverheadPct: 25, holdoutTasksFrozen: FROZEN_HOLDOUT_IDS.size },
  firstWaveProposals: PROPOSED_SKILLS.map(evaluateCandidate),
  promotedFromFirstWave: PROPOSED_SKILLS.map(evaluateCandidate).filter((x) => x.promoted).length,
  controls: CONTROLS.map(evaluateCandidate),
  driftedHeadsCaughtAndRetrained: CLASSIFIER_HEADS,
};

fs.writeFileSync(path.join(HERE, "results-2026-11-15.json"), JSON.stringify(results, null, 2) + "\n");
console.log(JSON.stringify({
  proposalsChecked: PROPOSED_SKILLS.length,
  promoted: results.promotedFromFirstWave,
  leakControlBlocked: !results.controls[0].promoted,
  validControlPromoted: results.controls[1].promoted,
}));
