# Frontier Pack — Stigmergy & Stafford Beer's VSM for Agent Teams (`frontier-stigmergic-vsm-coord`)

Coordination scaling simulator behind **Stigmergy for agent teams: why termites and Stafford Beer beat multi-agent group chats**.

## What it tests & proves
1. **Why multi-agent group chats scale as `O(N²)` noise:** Five roleplaying bots reading each other's growing chat transcript burn `5–10×` the context tokens (and `2.19×` measured trial cost on small pairs) while amplifying early framing mistakes.
2. **Stigmergy + Viable System Model (`Systems 1–5 & 3*`):** Coordinating asynchronously through hash-bound traces, file leases (`System 2`), planted-fault sporadic audits (`System 3*`), external radar (`System 4`), and one integration owner (`System 5`) keeps coordination overhead `O(1)` per task with `verify_by` trace evaporation.

## Quick start
```bash
node run.mjs
node run.mjs --agents 8
```

## Scope & limits
Models token and coordination scaling laws; real quality gains also depend on cross-family reviewer independence in `System 3*`.
