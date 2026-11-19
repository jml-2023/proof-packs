# Wave-2 Pack — Stage Choreography & Poll-Blink Auditor (`wave2-zero-experience-trap`)

Multiplayer stage-experience gate and static frontend poll-blink detector behind **Passed 81 of 81 tests — and had zero experience** on *Proof & Judgement*.

## What it tests & proves
1. **CI green != room experience:** Contrasts Build A (`81/81` functional tests green, `0` token violations, `0/4` stage acts, `18` full-screen CSS entrance blinks over `3` minutes) against Build B (`104/104` checks, `4/4` acts, wall-vs-phone split, `0` blinks).
2. **Audit your own UI component (`--html`):** Checks HTML/TSX files for unguarded poll-loop DOM replacement / random React keys and stage-act state coverage.

## Quick start
```bash
node run.mjs
node run.mjs --html path/to/StageScreen.tsx
```

## Scope & limits
Static `--html` inspection catches common poll-remount traps; real frame-by-frame video capture remains the authoritative check for subtle sub-second redraws.
