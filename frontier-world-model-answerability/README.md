# Frontier Pack — The Interface You Never Render (`frontier-world-model-answerability`)

Runnable synthetic instrument behind *The interface you never render* on [Proof & Judgement](https://jerrylieveld.substack.com).

## What it tests
1. **Answerability as a compiled schema property (<1 ms):** compares a governed capability graph (carrying `active`, `paused`, and `unheld` operational states) against naive document retrieval across 24 synthetic queries (16 live, 8 targeting paused or uncollected capabilities).
2. **Three interfaces from one merchant world model:** compiles the same typed offer graph into an `x402` machine-payment hold (`0` pixels rendered), a screenless spoken turn, and a visual comparison matrix.

## Run
```bash
node run.mjs
```
Calls no external API, needs no key, and runs in under 50 ms.

## Limits
Deterministic synthetic model demonstrating the architectural mechanism, not an empirical study of third-party retail sites.
