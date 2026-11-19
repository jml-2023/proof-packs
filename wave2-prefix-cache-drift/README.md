# Wave-2 Pack — Prompt Prefix Cache Fracture Detector (`wave2-prefix-cache-drift`)

Byte-level outbound prompt diff tool and 30-turn KV-cache cost simulator behind **The tokens I paid for twice because one file path moved** on *Proof & Judgement*.

## What it tests & proves
1. **30-turn accounting (`180,000`-token prefix):** One skill path flipping between `~/.skills` and `/cache/plugins/v2` at token `36,000` drops cache-read share from `95.50%` to `63.49%` (`3,470,400` cached of `5,466,000` raw tokens), burning `1,749,600` extra cache-miss tokens (`1,995,600` vs `246,000`) and multiplying uncached-equivalent billed input `3.38×` (`2,748,590` vs `813,000`).
2. **Diff your own harness payloads (`--diff`):** Locates the exact character offset, line number, and estimated token where two consecutive outbound LLM requests diverge.

## Quick start
```bash
node run.mjs
node run.mjs --diff outbound-turn1.json outbound-turn2.json
```

## Scope & limits
Models standard prefix-matched KV-cache billing (`0.10×` read, `1.00×` uncached, `1.25×` write); exact provider token counts vary slightly by BPE tokenizer (`--diff` defaults to `4` chars/token).
