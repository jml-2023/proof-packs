# What each accepted output cost

Ledger: `examples/look-film-2026-10-30.csv`. Prices: `prices-2026-10-30.json`, read 2026-10-30 from https://openrouter.ai/api/v1/models and https://openrouter.ai/api/v1/models?output_modalities=speech (public, no key). Every round counts, up to and including the round a person accepted. Counts are priced at list prices, and costs already recorded in dollars are added as they are.

## look film

Status: accepted in round 5, then reopened (round 6 is open).

| Round | Started | Ended | What | Decision | Agent | Generation | Other | Round total | Review minutes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2026-10-29 08:16Z | 2026-10-29 11:07Z | the experiment, a draft at 09:04, three whole voice reads, thirteen build runs; build 7 shown | sent-back (Jerry, 2026-10-29 11:10Z) | $31.00 | $2.43 | $0.028 | $33.46 | 0.0–2.9 |
| 2 | 2026-10-29 11:10Z | 2026-10-29 11:21Z | build 8, the sideways drift taken out | sent-back (Jerry, 2026-10-29 11:25Z) | $4.02 | – | – | $4.02 | 0.0–4.0 |
| 3 | 2026-10-29 11:25Z | 2026-10-29 11:50Z | build 9, the voice converted through a voice model on my own PC, a thinner underline | sent-back (Jerry, 2026-10-29 11:52Z) | $7.55 | – | – | $7.55 | 0.0–2.2 |
| 4 | 2026-10-29 11:52Z | 2026-10-29 12:34Z | listening checks, build 10 back on the first voice; stopped by a new instruction | sent-back (Jerry, 2026-10-29 12:34Z) | $6.82 | – | – | $6.82 | 0.0 |
| 5 | 2026-10-29 12:34Z | 2026-10-29 13:03Z | a model listener tried, 17 single-line retakes, build 11 | accepted (Jerry, 2026-10-29 13:08Z) | $3.53 | $0.864 | $0.118 | $4.51 | 1.8–5.2 |
| 6 | 2026-10-30 07:30Z | 2026-10-30 12:50Z | remade to the new floor with its 53-second cut, in the v4 voice; review of the remake by another model family; the review's helper | open | $44.05 | $0.953 | – | $45.01 | 0.0 |

- **To the first acceptance** (round 5, Jerry, 2026-10-29 13:08Z): $56.37 at list price, over 5 rounds, 4 of them sent back.
- **The round that was kept** cost $4.51 on its own, so the accepted output cost **12.5 times** the round you kept, and **92%** went on rounds before it.
- **By kind:** agent $52.93, generation $3.29, other recorded costs $0.146.
- **The agent's share by kind of token:** re-reading cached context 48%, writing to the cache 30%, output 22%, uncached input 0%.
- **Review:** 1.8–14.4 minutes. At 14.4 minutes, the review costs more than the machines only above **$235 an hour** (at 1.8 minutes, above $1,913).
- **After the acceptance:** 1 more round, $45.01; the last is open.

## All outputs

- 1 output, 1 accepted at least once, $101.37 spent in all: $101.37 per output accepted.
- The agent's share by kind of token, every round: re-reading cached context 47%, writing to the cache 25%, output 24%, uncached input 4%.

Read the ledger with its limits: list prices are not what any plan charges, the review minutes are bounds unless you timed yourself, and an acceptance holds only until the bar moves.
