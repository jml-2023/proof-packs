# wave4-agentic-reversibility-matrix

 Companion Proof Pack for ***Why "Are you sure?" modals fail agents: the reversibility matrix for speculative UI*** (`w13`, *Proof & Judgement*).

 ## What it computes

 Blanket confirmation dialogs on agent tool calls create **habituation blindness** (like cookie banners), while zero-gate execution risks irreversible external blasts. Extending Eric Horvitz's mixed-initiative utility calculus (*CHI 1999*) with **Undo Cost (`undoSeconds`)** and **Blast Radius (`local | workspace | external`)**, this pack routes every agent action into one of four UI patterns:

 1. **`act_and_log`** — `blastRadius === "local"`, `undoSeconds <= 1`, `confidence >= 0.85`: execute immediately with a 1-click undo receipt.
 2. **`speculative_ghost_diff`** — reversible workspace mutations (`blastRadius !== "external"`, `undoSeconds <= 15`, `0.55 <= confidence < 0.85` or medium-impact local/workspace edits): stage as a live ghost preview/branch so the user inspects the *result*, not a modal question.
 3. **`inline_slot_chip`** — `confidence < 0.55` on a reversible action: highlight only the 1–2 uncertain parameter chips (`[Thu 15:00 ?]`) inline.
 4. **`hard_commit_gate`** — `blastRadius === "external"` or `reversible === false` or `undoSeconds > 30`: reserve blocking confirmation exclusively for irreversible cross-boundary actions (sending emails, charging cards, deleting records).

 ## Reproduce essay benchmark or audit your own tool catalogue

 ```bash
 node wave4-agentic-reversibility-matrix/run.mjs
 node wave4-agentic-reversibility-matrix/run.mjs --actions my-agent-tools.json
 ```
