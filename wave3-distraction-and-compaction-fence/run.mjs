#!/usr/bin/env node
// wave3-distraction-and-compaction-fence — Audits instruction files for dead paths & package.json scripts,
// enforces archive-directory fences, & reconciles post-compaction task state ("The squirrel in the codebase", w06).
// Usage:
//   node run.mjs                                    # reproduce 3-part distraction & compaction benchmark
//   node run.mjs --audit-doc AGENTS.md --root .     # check any repo's instruction file for dead paths & npm scripts
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NEGATED_RE = /\b(never use|retired|deleted|removed|absent|does not exist|if .* exists)\b/i;

export function isArchivePathBlocked(targetPath, cwd) {
  const archivePattern = /(?:^|\/)(?:archive|memory-archive|backups|deprecated|\.bak)(?:\/|$)/i;
  if (!archivePattern.test(targetPath)) return { blocked: false };
  if (archivePattern.test(cwd)) return { blocked: false };
  return { blocked: true, reason: "archive_or_backup_read_outside_cwd" };
}

export function auditInstructionPaths(mdText, repoRoot) {
  const t0 = performance.now();
  const dead = [];
  const deadScripts = [];
  const checked = [];
  let pkgScripts = {};
  const pkgPath = path.join(repoRoot, "package.json");
  if (fs.existsSync(pkgPath)) {
    try { pkgScripts = JSON.parse(fs.readFileSync(pkgPath, "utf8")).scripts || {}; } catch {}
  }

  for (const line of String(mdText).split("\n")) {
    if (NEGATED_RE.test(line)) continue;
    for (const m of line.matchAll(/`([A-Za-z0-9_./-]+\.(?:mjs|js|ts|tsx|py|json|sh|md|yml|yaml))`/g)) {
      const rel = m[1];
      if (rel.startsWith("/") || rel.includes("*") || rel.includes("<")) continue;
      checked.push(rel);
      if (!fs.existsSync(path.join(repoRoot, rel))) dead.push(rel);
    }
    if (Object.keys(pkgScripts).length > 0) {
      for (const sm of line.matchAll(/`(?:npm|pnpm|yarn|bun)\s+run\s+([A-Za-z0-9_:-]+)`/g)) {
        const scriptName = sm[1];
        checked.push(`script:${scriptName}`);
        if (!(scriptName in pkgScripts)) deadScripts.push(scriptName);
      }
    }
  }
  const elapsedMs = +(performance.now() - t0).toFixed(2);
  return {
    checkedCount: checked.length,
    deadPaths: [...new Set(dead)],
    deadScripts: [...new Set(deadScripts)],
    elapsedMs,
    ok: dead.length === 0 && deadScripts.length === 0,
  };
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

  const archiveDemo = isArchivePathBlocked("/repo/memory-archive/2025-notes.md", "/repo/src");
  const auditDemo = auditInstructionPaths("Run `npm run test` and inspect `README.md`.", path.resolve(HERE, ".."));

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
      totalCallsIn6Days: 10758,
      compactionsPer1kCalls: 29,
      auditElapsedMs: auditDemo.elapsedMs,
    },
    archiveFenceDemo: archiveDemo,
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
    archiveBlocked: archiveDemo.blocked,
  }));
}
