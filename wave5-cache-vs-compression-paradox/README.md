# wave5-cache-vs-compression-paradox

Companion Proof Pack for ***Passed 19 of 19 tests — and made production 56% slower*** (`w17`, *Proof & Judgement*).

## Real 12-Turn 3-Arm Live Canary Telemetry (21 Nov 2026)

Contains the recorded turn-by-turn OpenRouter telemetry (`recorded-12turn-canary.json`, `36` live turns across `3` arms, `19` exact hex/sum recall checks) testing mid-session context compression against implicit prompt caching:

1. **`plain` (append-only history, zero compression):** `18/19` recall, **`$0.1846` total cost**, **`5,386.5 ms` (`5.39 s`) `p50` latency**, **`86.2%` mean cache hit** (Turns 2–12).
2. **`pxpipe` (mid-session context collapse):** Scored **`19/19` (`100%` recall)** and cut late-turn cost (Turns 10–12) by **`-37.1%` (`$0.0374 → $0.0235`)** — yet mutating mid-session history dropped mean cache hit to **`74.3%`**, **increased total 12-turn cost `+6.2%` (`$0.1846 → $0.1960`)**, and **slowed `p50` latency `+55.6%` (`5.39 s → 8.38 s`)**!
3. **`eager_tombstone` (rewriting old tool outputs on warm turns):** Dropped cache hit to **`62.3%`** and pushed total cost up **`+52.6%` (`$0.1846 → $0.2818`)** (`14/19` recall) — cured by **Cold-Turn-Only Tombstoning** (`shouldTombstoneTurn`: compress *only* when `idleSeconds > cacheTtlSeconds`, preserving `100%` byte-identical prefixes on every warm turn).

## Verify the recorded canary or audit your own multi-turn session logs

```bash
node wave5-cache-vs-compression-paradox/run.mjs
node wave5-cache-vs-compression-paradox/run.mjs --audit-turns session-turns.jsonl
```
