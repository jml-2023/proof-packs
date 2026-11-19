# Proof Packs — Proof & Judgement

[![Verify Proof Packs](https://github.com/jml-2023/proof-packs/actions/workflows/ci.yml/badge.svg)](https://github.com/jml-2023/proof-packs/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-5EC297.svg)](./LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-EBD3A2.svg)](./package.json)

Open, runnable instruments, evaluation gates, and synthetic benchmarks behind **[Proof & Judgement](https://jerrylieveld.substack.com)** by Jerry Lieveld — paired with the public **[Forecast Ledger](https://github.com/jml-2023/forecast-ledger)**.

Every empirical or architectural essay ships with the code that measured or tested its mechanism. Run `npm test` at the root to verify all 34 packs in under 3 seconds with zero external dependencies and no API keys, or pass your own files to each pack's CLI.

---

## 1 · Frontier Packs (Architectures & Interfaces That Don't Exist Yet)

| Pack | Essay & Core Result | Reproduce Essay | Run on Your Own Stack |
|---|---|---|---|
| [`frontier-world-model-answerability`](./frontier-world-model-answerability) | [*The interface you never render*](https://jerrylieveld.substack.com/p/the-interface-you-never-render) — `0.0007 ms` compiled schema answerability (`8/8` paused/unheld abstentions vs `0/8` naive RAG) & 3 surfaces (`x402` `0 px`, `26`-word voice, visual matrix) | `node frontier-world-model-answerability/run.mjs` | `node frontier-world-model-answerability/run.mjs --schema model.json --require capA,capB` |
| [`frontier-loop-proximity-dissent`](./frontier-loop-proximity-dissent) | *In, near, and out of the loop* — 3-band jurisdiction cuts real-time pages `88.6%`, surfaces `33.8%` of decisions hidden by a 3-item cap, and catches `8/9` flaws via cross-family dissent (vs `3/9` same-family) | `node frontier-loop-proximity-dissent/run.mjs` | `node frontier-loop-proximity-dissent/run.mjs --alerts alerts.jsonl --streak-bar 8` |
| [`frontier-clarity-physics-canon`](./frontier-clarity-physics-canon) | *Clarity over taste* — `$0` 2D PCA silhouette physics (`0.047` collapsed snake rejected vs `0.390` wide flock), `2/2` single-frame hitches caught, `176` chart-zone intrusions blocked | `node frontier-clarity-physics-canon/run.mjs` | `node frontier-clarity-physics-canon/run.mjs --svg diagram.svg` or `--points xy.json` |
| [`frontier-contract-moat`](./frontier-contract-moat) | *When models read the machine backwards* — `8` probes recover stateless SaaS pricing (`98.5%` exact, `100%` within `$0.01`), while snapshot cloners misroute `17/24` (`70.8%`) canary/59-streak transitions | `node frontier-contract-moat/run.mjs` | `node frontier-contract-moat/run.mjs --streak-bound 0.05` |
| [`frontier-stigmergic-vsm-coord`](./frontier-stigmergic-vsm-coord) | *Stigmergy and cybernetics for agent teams* — `O(N²)` 5-agent group chat burns `26.9×` context tokens (`2.19×` empirical pair cost) vs stigmergic ledger + Stafford Beer's Viable System Model (`Systems 1–5 & 3*`) | `node frontier-stigmergic-vsm-coord/run.mjs` | `node frontier-stigmergic-vsm-coord/run.mjs --agents 8` |

---

## 2 · Wave-3 Packs (Agentic UX, Arithmetic Design, Voice Cadence & Routing Cliffs)

| Pack | Essay & Core Result | Reproduce Essay | Run on Your Own Stack |
|---|---|---|---|
| [`wave3-distraction-and-compaction-fence`](./wave3-distraction-and-compaction-fence) | *The squirrel in the codebase* — stale notes (`199` excluded) + focused-session scope creep (`502` vs `30` median steps = `16.7×`) + post-compaction state grounding (`29` compactions/1k calls) | `node wave3-distraction-and-compaction-fence/run.mjs` | `node wave3-distraction-and-compaction-fence/run.mjs --audit-doc AGENTS.md --root .` |
| [`wave3-voice-register-and-agreeableness`](./wave3-voice-register-and-agreeableness) | *Agreeableness 4* — frozen-judge RL collapses `125/128` (`97.7%`) outputs; pooling spoken (`23`/1k) & written (`11`/1k) registers ruins cadence (`17/18` spoken blind wins); Agreeableness `4` vs `7–8` | `node wave3-voice-register-and-agreeableness/run.mjs` | `node wave3-voice-register-and-agreeableness/run.mjs --file essay.md` |
| [`wave3-max-tokens-routing-cliff`](./wave3-max-tokens-routing-cliff) | *Same model name, 2.2× slower* — requesting `max_tokens: 65536` (`99.75%` of `19,395` turns `<=32,768`) disqualifies `97.9%`-cached `32k` endpoints + sliding `24`-screenshot cap | `node wave3-max-tokens-routing-cliff/run.mjs` | `node wave3-max-tokens-routing-cliff/run.mjs --audit-requests calls.jsonl` |
| [`wave3-spatial-agentic-ux`](./wave3-spatial-agentic-ux) | *Agent responses don't belong in the chat box* — 4 computable spatial UX laws: surface-first replies, `1:1` rising clearance, `0.00 px` downward hover skirts, and sheet-aware left-rail docking | `node wave3-spatial-agentic-ux/run.mjs` | `node wave3-spatial-agentic-ux/run.mjs --frames geometry.json` |
| [`wave3-arithmetic-design-linter`](./wave3-arithmetic-design-linter) | *Arithmetic design* — Wertheimer's Proximity Ratio (`d_intra / d_inter <= 0.60`), `0.00 px` neighbour hover reflow, and `<=16 ms` (`13.4 ms` phone `p95`) motion frame budgets | `node wave3-arithmetic-design-linter/run.mjs` | `node wave3-arithmetic-design-linter/run.mjs --layout dom-boxes.json` |
| [`wave3-decision-map-and-coupling-gate`](./wave3-decision-map-and-coupling-gate) | *Stop reading 10-page prose plans* — human-only lockable decision contracts + UX-research provenance gate blocking unbadged synthetic quotes ("authority laundering") | `node wave3-decision-map-and-coupling-gate/run.mjs` | `node wave3-decision-map-and-coupling-gate/run.mjs --audit-uxr uxr-deck.md` |
| [`wave4-agentic-reversibility-matrix`](./wave4-agentic-reversibility-matrix) | *Why "Are you sure?" modals fail agents* — 4-quadrant Reversibility × Confidence router cuts modal noise `92.0%` (`50 → 4`), stages `14` speculative ghost diffs, and gates `4/4` external blasts | `node wave4-agentic-reversibility-matrix/run.mjs` | `node wave4-agentic-reversibility-matrix/run.mjs --actions tools.json` |
| [`wave4-felt-time-choreography`](./wave4-felt-time-choreography) | *Twelve seconds that feel like two* — perceived-wait physics (`14.59 s` naive felt wait & `0.42` CLS → `3.90 s` choreographed felt wait, `3.74×` calmer, `0` scroll hijacks) | `node wave4-felt-time-choreography/run.mjs` | `node wave4-felt-time-choreography/run.mjs --trace stream.json` |
| [`wave4-optical-and-spring-arithmetic`](./wave4-optical-and-spring-arithmetic) | *Why geometric centres look wrong* — Björn Ottosson's OKLab/OKLCH (`12.85×` HSL50 luminance illusion), `+4.00 px` play-triangle centroid shift, and critically damped springs (`0.0%` overshoot vs `25.0%`) | `node wave4-optical-and-spring-arithmetic/run.mjs` | `node wave4-optical-and-spring-arithmetic/run.mjs --tokens theme-motion.json` |
| [`wave4-inspectable-belief-ux`](./wave4-inspectable-belief-ux) | *Show me what you think is true* — editable 4-slot Belief Cards cut assumption-repair turns `76.8%` (`4.31 → 1.00`) and catch `5/5` sycophantic data contradictions | `node wave4-inspectable-belief-ux/run.mjs` | `node wave4-inspectable-belief-ux/run.mjs --transcript session.json` |

---

## 3 · Wave-2 Packs (Agent Economics, Self-Improvement Gates & Stage Craft)

| Pack | Essay & Core Result | Reproduce Essay | Run on Your Own Stack |
|---|---|---|---|
| [`wave2-effort-inversion`](./wave2-effort-inversion) | *Raising reasoning effort broke the winner* — `20/20` bakeoff tie vs `0.17–0.72` pairwise spread; `high` effort drops grounded synthesis `12/12 → 6/12`; `4,096` cap truncates JSON `1/5` (`5/5` at `16,384`); `1 fps` misses `28/28` sub-second glitches | `node wave2-effort-inversion/run.mjs` | `node wave2-effort-inversion/run.mjs --jsonl responses.jsonl` |
| [`wave2-wake-sleep-gate`](./wave2-wake-sleep-gate) | *The machine built to learn from my mistakes threw away all five of its own ideas* — 4-bar promotion gate rejects `5/5` vague prose skills (`falsifiability 0.45–0.54 < 0.75`), blocks holdout leak, & flags drifted classifier vocabularies (`95.92%` / `93.36%` OOF retrained) | `node wave2-wake-sleep-gate/run.mjs` | `node wave2-wake-sleep-gate/run.mjs --skill path/to/SKILL.md` |
| [`wave2-prefix-cache-drift`](./wave2-prefix-cache-drift) | *The tokens I paid for twice because one file path moved* — one flickering skill path at token `36,000` drops 30-turn cache-read share `95.50% → 63.49%`, burning `1,749,600` extra miss tokens (`3.38×` billed input) | `node wave2-prefix-cache-drift/run.mjs` | `node wave2-prefix-cache-drift/run.mjs --diff req-turn1.json req-turn2.json` |
| [`wave2-zero-experience-trap`](./wave2-zero-experience-trap) | *Passed 81 of 81 tests — and had zero experience* — `81/81` CI-green form build fails stage choreography (`0/4` acts, `18` poll entrance blinks) vs `104/104` 4-act stage build (`0` blinks) | `node wave2-zero-experience-trap/run.mjs` | `node wave2-zero-experience-trap/run.mjs --html path/to/App.tsx` |
| [`wave2-eight-leadership-tensions`](./wave2-eight-leadership-tensions) | *Eight arguments I keep having with myself* — 8 design-leadership tensions paired with their deciding variables + 5 agentic UX laws auditor (`0/5` on static canons vs `5/5` upgraded) | `node wave2-eight-leadership-tensions/run.mjs` | `node wave2-eight-leadership-tensions/run.mjs path/to/PRINCIPLES.md` |

---

## 3 · Empirical Measurement & Craft Packs

| Pack | Essay |
|---|---|
| [`did-the-model-look`](./did-the-model-look) | [Did the model even look at the picture?](https://jerrylieveld.substack.com/p/did-the-model-even-look) |
| [`count-the-entry-roles`](./count-the-entry-roles) | [The design organisation in 2028](https://jerrylieveld.substack.com/p/the-design-organisation-in-2028) & *Who trains the next judge?* |
| [`can-your-gate-fire`](./can-your-gate-fire) | [A gate that cannot fire reads as green](https://jerrylieveld.substack.com/p/a-gate-that-cannot-fire) |
| [`ask-twice`](./ask-twice) | *Ask the same question twice* |
| [`design-is-arithmetic`](./design-is-arithmetic) | *Design is arithmetic until it isn't* |
| [`type-and-colour-laws`](./type-and-colour-laws) | *Type and colour have laws you can compute* |
| [`what-the-meter-counts`](./what-the-meter-counts) | *From seats to outcomes* |
| [`two-films-one-script`](./two-films-one-script) | *Two films, one script* |
| [`cost-by-design`](./cost-by-design) | *Cost is a design material* |
| [`retire-a-model`](./retire-a-model) | *When to retire a model* |
| [`hash-receipt`](./hash-receipt) | *Trust is a receipt* |
| [`decision-ledger`](./decision-ledger) | *Who answers for a model's decision?* |
| [`accepted-output-ledger`](./accepted-output-ledger) | *What an accepted output costs* |
| [`local-or-cloud`](./local-or-cloud) | *Local AI on my own desk* |

## Verify everything locally

```bash
git clone https://github.com/jml-2023/proof-packs.git
cd proof-packs
npm test
```
