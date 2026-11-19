# Wave-3 Pack — Agent Distraction & Post-Compaction Grounding (`wave3-distraction-and-compaction-fence`)

Runnable instruction-path auditor and post-compaction state reconciler behind **The squirrel in the codebase: how stale notes and compaction amnesia hijack coding agents**.

## What it tests & proves
1. **Dead instruction paths (`--audit-doc`):** Checks `AGENTS.md` / `CLAUDE.md` files against live repository files while skipping negated warnings (*"never use retired X"*), stopping dead references before an agent wastes 20 tool calls searching for deleted scripts.
2. **Scope-creep step explosion & compaction amnesia:** Contrasts clean focused sessions (`30` median steps) against scope-drifted sessions (`502` median steps — `16.7×`), and shows how injecting SQLite-verified `COMPLETED` vs `PENDING` state prevents post-compaction re-execution across `29` compactions per `1,000` calls.

## Quick start
```bash
node run.mjs
node run.mjs --audit-doc path/to/AGENTS.md --root path/to/repo
```

## Scope & limits
Static path auditing catches deleted files and scripts; pair with runtime `PreToolUse` directory fences on `archive/` and `backups/` folders.
