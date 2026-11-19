# Wave-3 Pack — Spatial Choreography for Agentic Interfaces (`wave3-spatial-agentic-ux`)

Bounding-box geometry verifier behind **Agent responses don't belong in the chat box: spatial choreography for agentic interfaces**.

## What it tests & proves
1. **Surface-first separation:** Input pills compose intent and filters; responses belong on the canvas or an independent backdrop sheet.
2. **`1:1` rising clearance & `0.00 px` hover skirts:** Verifies zero occluded message pixels when composers grow taller, zero upward button jump on hover (downward skirt tray), and automatic left-rail docking when right-hand drawers open (`0` violations vs `7` on standard floating chat widgets).

## Quick start
```bash
node run.mjs
node run.mjs --frames my-bounding-boxes.json
```

## Scope & limits
Verifies deterministic layout and collision invariants from Playwright `getBoundingClientRect()` dumps across viewport states.
