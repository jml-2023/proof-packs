# Wave-2 Pack — Raising Reasoning Effort Broke the Winner (`wave2-effort-inversion`)

Four-part frontier evaluation harness and API response log classifier behind **Raising reasoning effort broke the winner** on *Proof & Judgement*.

## What it tests & proves
1. **Bakeoff saturation vs pairwise spread:** Four models tying `20/20` (`7.20–7.67` rubric mean) spread `2.9×` in latency, `6.0×` in cost, and `0.17–0.72` on blind pairwise preference.
2. **Effort inversion under real timeouts:** Turning reasoning effort from `low` to `high` on grounded synthesis (`180 s` timeout, `16,384` cap) drops finished cases from `12/12` to `6/12` via over-citation and thinking-token bloat.
3. **Output-cap JSON cliff (`--jsonl`):** Separates `finish_reason === "length"` ceiling truncations (`1/5` valid JSON at `4,096` vs `5/5` at `16,384`) from true schema errors.
4. **1-fps video blind spot:** `1 fps` sampling decodes `0/28` sub-second (`0.20 s`) visual glitches falling between integer seconds.

## Quick start
```bash
node run.mjs
node run.mjs --jsonl path/to/openrouter-or-anthropic-responses.jsonl
```

## Scope & limits
The 4-part harness models measured failure modes deterministically; pass `--jsonl` to classify real API response logs on your own stack.
