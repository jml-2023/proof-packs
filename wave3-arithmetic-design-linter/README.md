# Wave-3 Pack — Arithmetic Design Linter (`wave3-arithmetic-design-linter`)

Rendered-DOM geometry and motion-budget verifier behind **Arithmetic design: compiling Gestalt proximity, zero-reflow hover, and motion budgets into numbers**.

## What it tests & proves
1. **Wertheimer's Law of Proximity as a pass/fail ratio (`d_intra / d_inter <= 0.60`):** Catches AI-generated cards where internal label spacing (`22 px`) nearly equals the gap between separate cards (`24 px`, ratio `0.917`) versus clear Gestalt grouping (`8 px / 28 px = 0.286`).
2. **Zero-reflow hover (`0.00 px` neighbour shift) & `<=16 ms` SoA frame budgets:** Verifies hover states never push sibling cards and particle fields hold `13.4–14.9 ms` `p95` with `0` long tasks.

## Quick start
```bash
node run.mjs
node run.mjs --layout path/to/dom-boxes.json
```

## Scope & limits
Arithmetic design verifies structural, perceptual, and frame-rate floors on the rendered DOM before visual judges or human critique run; it never replaces human judgement on meaning or brand direction.
