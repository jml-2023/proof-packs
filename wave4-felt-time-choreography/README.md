# wave4-felt-time-choreography

 Companion Proof Pack for ***Twelve seconds that feel like four: temporal choreography and zero-jank streaming for AI experiences*** (`w14`, *Proof & Judgement*).

 ## What it computes

 Reasoning and tool-using agents routinely need `8–15 s` per turn — thirty times longer than Walter Doherty's `400 ms` interactive threshold (1982). Combining Maister's psychology of waiting lines (1985) and CHI progress-bar perception weights with DOM streaming physics, this pack audits an AI turn trace across four laws:

 1. **Sub-400 ms Acknowledgement (`firstAckMs <= 400`):** Unexplained silence carries a `1.35×` anxiety multiplier; immediate submission lock + verb step drops it immediately.
 2. **Felt-Time Integral (`feltSeconds`):** Weights unexplained spinner time (`1.35×`), generic spinner (`1.10×`), named real tool verbs (`0.52×`), and progressive pre-sized stage preview (`0.28×`).
 3. **Zero Streaming Layout Thrash (`cls <= 0.02`) & Zero Scroll Hijack (`scrollHijacks === 0`):** Pre-allocating table/code aspect containers prevents height jumps, and `userScrolledUp === true` halts auto-scroll immediately.
 4. **Honest Partial Completion:** Multi-item runs (`42 of 48`) must report exact failed items with targeted retry rather than a generic green banner.

 ## Reproduce essay benchmark or audit your own streaming trace

 ```bash
 node wave4-felt-time-choreography/run.mjs
 node wave4-felt-time-choreography/run.mjs --trace stream-trace.json
 ```
