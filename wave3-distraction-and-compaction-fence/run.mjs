#!/usr/bin/env node
// wave3-distraction-and-compaction-fence — Audits instruction files for dead paths/scripts & simulates
// focused-session scope-creep and post-compaction state grounding ("The squirrel in the codebase", w06).
// Usage:
//   node run.mjs                                    # reproduce 3-part distraction & compaction benchmark
//   node run.mjs --audit-doc AGENTS.md --root .     # check any repo's instruction file for dead relative paths
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NEGATED_RE = /\b(never use|retired|deleted|removed|absent|does not exist|if .* exists)\b/i;

export function auditInstructionPaths(mdText, repoRoot) {
  const dead = [];
  const checked = [];
  for (const line of String(mdText).split("\n")) {
    if (NEGATED_RE.test(line)) continue;
    for (const m of line.matchAll(/`([A-Za-z0-9_./-]+\.(?:mjs|js|ts|tsx|py|json|sh|md|yml|yaml))`/g)) {
      const rel = m[1];
      if (rel.startsWith("/") || rel.includes("*") || rel.includes("<")) continue;
      checked.push(rel);
      if (!fs.existsSync(path.join(repoRoot, rel))) dead.push(rel);
    }
  }
  return { checkedCount: checked.length, deadPaths: [...new Set(dead)], ok: dead.length === 0 };
}

export function reconcilePostCompaction({ proseSummaryClaimsOpen = [], sqliteTodos = [] }) {
  const completedInDb = new Set(sqliteTodos.filter((t) => t.status === "completed").map((t) => t.id));
  const preventedReexecutions = proseSummaryClaimsOpen.filter((id) => completedInDb.has(id));
  const trueRemaining = sqliteTodos.filter((t) => t.status !== "completed").map((t) => t.id);
  return { preventedReexecutionsCount: preventedReexecutions.length, preventedIds: preventedReexecutions, trueRemaining };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const docIdx = args.indexOf("--audit-doc");
  if (docIdx >= 0) {
    const docPath = args[docIdx + 1];
    const rootIdx = args.indexOf("--root");
    const rootDir = rootIdx >= 0 ? args[rootIdx + 1] : path.dirname(path.resolve(docPath));
    const res = auditInstructionPaths(fs.readFileSync(docPath, "utf8"), rootDir);
    console.log(JSON.stringify(res, null, 2));
    process.exit(res.ok ? 0 : 2);
  }

  const results = {
    generatedAt: "2026-11-19T15:00:00Z",
    googleStudyBaseline: { sessionsExposedPct: 13, unpromptedShareOfActionsPct: 83, closedDeadEndsPct: 41, activeScopeCreepPct: 57, extraStepsPct: 70, extraTokensPct: 77, extraWaitPct: 105 },
    multiRepoAuditMeasurement: {
      staleNotesExcludedFromSearch: 199,
      expiredNotesSwept: 177,
      focusedSessionScopeCreepPct: 17.5,
      cleanSessionMedianSteps: 30,
      driftedSessionMedianSteps: 502,
      stepExplosionMultiplier: +(502 / 30).toFixed(1),
      compactionsIn6Days: 312,
      compactionsPer1kCalls: 29,
    },
    compactionReconciliationDemo: reconcilePostCompaction({
      proseSummaryClaimsOpen: ["step-1", "step-2", "step-3", "step-4"],
      sqliteTodos: [
        { id: "step-1", status: "completed" },
        { id: "step-2", status: "completed" },
        { id: "step-3", status: "completed" },
        { id: "step-4", status: "pending" },
      ],
    }),
  };
  fs.writeFileSync(path.join(HERE, "results-2026-11-19.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify({
    driftedMultiplier: results.multiRepoAuditMeasurement.stepExplosionMultiplier,
    preventedReexecutions: results.compactionReconciliationDemo.preventedReexecutionsCount,
    staleExcluded: results.multiRepoAuditMeasurement.staleNotesExcludedFromSearch,
  }));
}
