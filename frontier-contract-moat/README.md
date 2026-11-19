# Frontier Pack — When Models Read the Machine Backwards (`frontier-contract-moat`)

Black-box stateless formula reconstructor and binomial calibration-streak calculator behind **When models read the machine backwards** on *Proof & Judgement*.

## What it tests & proves
1. **Layer A (Stateless surface logic):** `8` black-box API probes reconstruct a multi-tier SaaS pricing & discount engine across `200` unseen inputs (`98.5%` exact penny match, `100%` within `$0.01`).
2. **Layer B (Off-surface governed routing):** A snapshot cloner blind to live planted-fault provider canaries and `59`-outcome calibration streaks (the exact `95%` confidence bound for `<=5%` error: `ceil(ln(0.05)/ln(0.95)) = 59`) misroutes `17/24` (`70.8%`) runtime state transitions.

## Quick start
```bash
node run.mjs
node run.mjs --streak-bound 0.05   # -> exactStreakRequired: 59 (rule of three: 60)
node run.mjs --streak-bound 0.01   # -> exactStreakRequired: 299
```

## Scope & limits
Demonstrates why stateless client-exposed rules offer near-zero defensibility against reverse-engineering agents compared with live verification loops and proprietary human-graded outcome ledgers.
