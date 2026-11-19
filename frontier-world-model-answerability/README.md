# Frontier Pack — The Interface You Never Render (`frontier-world-model-answerability`)

Runnable schema-answerability gate and multi-surface compiler behind **[The interface you never render](https://jerrylieveld.substack.com/p/the-interface-you-never-render)** on *Proof & Judgement*.

## What it tests & proves
1. **Compiled schema answerability in `<1 ms`:** Every capability in a merchant's world model carries its live operational status (`active`, `paused` with a maintenance/expiry reason, or `unheld` by policy) plus an optional freshness SLA. Across `24` queries (`16` live, `8` touching paused, unheld, or unknown capabilities), naive document RAG answers all `8` non-active queries with stale confidence, whereas `checkAnswerable()` blocks `8/8` cleanly with `0` false blocks in `~0.0005–0.0007 ms` median.
2. **One world model → three receiver surfaces:** Compiles the exact same three-room inventory into a `0`-pixel `x402` autonomous payment hold, a `26`-word screenless voice turn, and a 3-card visual trade-off matrix.

## Quick start
```bash
# Reproduce the 24-query Harbour & Pine benchmark
node run.mjs

# Gate your own capability manifest JSON in <1ms
node run.mjs --schema my-world-model.json --require room_availability,x402_instant_hold --surface x402-autonomous-delegate
```

## Scope & limits
Deterministic zero-dependency reference architecture demonstrating pre-generation capability gating; it does not measure how quickly commercial retailers will adopt headless `x402` checkouts (tracked publicly in [Forecast `F-003`](https://github.com/jml-2023/forecast-ledger)).
