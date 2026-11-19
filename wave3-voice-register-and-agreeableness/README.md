# Wave-3 Pack — Voice Registers, Agreeableness 4 & Fact-Locked Editing (`wave3-voice-register-and-agreeableness`)

Zero-API 10-band cadence profiler and register-pooling benchmark behind **Agreeableness 4: why "100% Human" rewriters invent facts and flatten your voice**.

## What it tests & proves
1. **Never pool spoken and written registers:** Averaging written essays (`11` contractions/1k, `19%` `>=25w` sentences) with spoken video scripts (`23` contractions/1k, `0%` `>=25w` sentences) produces a synthetic midpoint (`17`/1k, `9.5%`) matching neither — whereas keeping registers separate won `17/18` blind spoken pairwise votes.
2. **Bimodal rhythm & Agreeableness stance (`--file`):** Measures short (`<=8w`) + long (`>=25w`) sentence burstiness and flags high-Agreeableness (`7–8`) LLM hedging against direct operator prose (`~4`).

## Quick start
```bash
node run.mjs
node run.mjs --file path/to/essay.md
```

## Scope & limits
Surface rhythm and tell checks verify cadence and absence of boilerplate; crossing from competent (`8.5`) to memorable (`9.5+`) prose still requires real baselines, named trade-offs, and fact-locked editing.
