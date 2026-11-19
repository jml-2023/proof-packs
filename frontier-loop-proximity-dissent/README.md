# Frontier Pack — In, Near, and Out of the Loop (`frontier-loop-proximity-dissent`)

Runnable jurisdiction simulator and alert triage classifier behind **In, near, and out of the loop** on *Proof & Judgement*.

## What it tests & proves
1. **Three-condition paging (`88.6%` fewer real-time interruptions):** Routes only runaway/spend ceilings, dead-man/data-boundary breaches, and blocking release holds to real-time pages (`24` of `210` operational alerts, `100%` actionable) while batching routine chatter into a 6-hour digest (`0` signals lost).
2. **Uncapped defaulted handoffs:** Lifting an artificial 3-decision summary cap surfaces the `33.8%` (`26` of `77`) of genuine human calls previously buried, while executing reversible fixes out-of-the-loop.
3. **8-streak near-the-loop autonomy & cross-family dissent:** Requires `8` consecutive error-free blind human grades before promotion, and contrasts same-family review (`3/9` premise flaws caught) against cross-family dissent (`8/9`).

## Quick start
```bash
node run.mjs
node run.mjs --alerts path/to/alerts.jsonl
```

## Scope & limits
Reproducible synthetic simulation of the operational routing rules; real defect-catch rates depend on prompt independence and model-family diversity.
