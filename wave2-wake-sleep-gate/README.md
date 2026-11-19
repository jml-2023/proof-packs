# Wave-2 Pack — Wake/Sleep Skill Gate & Drift Detector (`wave2-wake-sleep-gate`)

Four-bar promotion gate for overnight agent skill distillation plus a static `SKILL.md` falsifiability linter behind **The machine built to learn from my mistakes threw away all five of its own ideas** on *Proof & Judgement*.

## What it tests & proves
1. **Why `0/5` promoted is a win:** All five prose rules distilled from `3,900` session errors fail falsifiability (`0.45–0.54 < 0.75`), a contaminated holdout control (`fh-14`) is blocked before eval, and an executable schema check (`+0.18` baseline uplift, `9%` overhead) passes.
2. **Lint your own `SKILL.md` (`--skill`):** Flags fortune-cookie adverbs (*"carefully"*, *"make sure"*, *"always verify"*) against executable signals (CLI flags, file paths, numeric thresholds).

## Quick start
```bash
node run.mjs
node run.mjs --skill path/to/SKILL.md
```

## Scope & limits
Static `--skill` scoring catches vague prose before spending evaluation tokens; full promotion still requires paired `{baseline, frontier} × {without, with}` holdout runs.
