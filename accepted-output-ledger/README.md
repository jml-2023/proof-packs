# The accepted-output ledger: the instrument pack

A ledger for what an accepted piece of work really cost: every round an agent ran, every generation it paid for and every minute you spent looking, up to the round you said yes to. It goes with my essay *What an accepted output costs*, and its worked example is the first film I accepted for this publication.

A receipt prices the build you kept. This ledger prices the acceptance, which includes everything you sent back on the way.

## What's in it

- `template.csv`: an empty ledger, one row per round of work.
- `ledger.mjs`: reads a ledger and a price file and reports, for each output, what it cost to the first acceptance, what the kept round cost on its own, the share spent on rounds you didn't keep, your review minutes, and the hourly rate at which your minutes would cost as much as the machines. It makes no calls.
- `prices.mjs`: reads today's public list prices from OpenRouter for the models in your ledger and writes a dated price file. No key is needed.
- `prices-2026-10-30.json`: the prices used in the essay, read on 30 October 2026. `snapshots/2026-10-30/` holds the two public model lists they were read from.
- `examples/look-film-2026-10-30.csv`: the worked example, with `examples/HOW-COUNTED.md` saying where every number came from.
- `runs/2026-10-30/`: `results.md` and `results.json` for the worked example, and `prices-live-check.md`, a live read of the prices the same day.

## Run it

You need Node 18 or later. Nothing is installed.

```
node ledger.mjs examples/look-film-2026-10-30.csv                      # the worked example
node ledger.mjs my-ledger.csv --rate 90 --out runs/mine                # yours, with your time at $90 an hour
node prices.mjs                                                        # today's prices for the same models
node prices.mjs --models anthropic/claude-opus-5.5,elevenlabs/eleven-v4  # or for the models you name
```

`ledger.mjs` uses the newest `prices-*.json` beside it unless you name one with `--prices`. It stops and lists every problem if a row is incomplete: a decision it doesn't know, a model with no price, a negative count, or an acceptance with no name or date.

## Fill in your ledger

One row per round. A round starts when you give the agent an instruction and ends when it hands something back. If a round used two models, give it two rows with the same round number; they add up.

| Column | What goes in it |
|---|---|
| `output` | The thing you were making. Rounds of one output share the name. |
| `round`, `started`, `ended` | The round number from 1, and its start and end times. |
| `what` | What the round produced, in a few words. |
| `decision` | `accepted`, `sent-back`, `rejected` or `open` (still waiting). |
| `decided_by`, `decided_at` | Who decided, and when. An acceptance needs both. |
| `model` | The agent's model, as it is named in the price file. |
| `uncached_in`, `cache_read`, `cache_write`, `out_tokens` | The agent's tokens in the round. `uncached_in` is input that was neither read from nor written to the prompt cache. Some logs count cached tokens inside the input figure; if yours does, subtract them first. |
| `gen_model`, `gen_units`, `takes` | A generator priced per unit, such as a voice model priced per character or per second, the units it used, and how many takes it made. |
| `other_usd` | Any other cost already recorded in dollars. |
| `review_min_low`, `review_min_high` | Your minutes looking at what came back. If you didn't time yourself, the gap between the delivery and your reply is the high figure. |
| `source` | Where the counts came from. |

The counts are usually already on your machine. Agent tools and model APIs report tokens with every call, and voice and image services report characters, seconds or images. If they don't keep a log, start one today: the template is the log.

## Read the result

- **To the first acceptance.** Every round up to and including the one you said yes to, at list price.
- **Times the round you kept.** That total divided by the cost of the accepted round alone. It is how far a receipt for the kept build understates the cost.
- **Share on rounds before it.** What you paid for the rounds you didn't keep.
- **The agent's share by kind of token.** How much went on re-reading cached context, writing to the cache, output and uncached input. An agent that re-reads a long conversation at every step pays for it on every step.
- **Review minutes and the break-even rate.** The hourly rate at which your minutes would cost as much as everything else. Give `--rate` and it adds your time in dollars as well.
- **After the acceptance.** Rounds that come after a yes, because the bar moved or the work had to be redone. An output in this state shows as reopened.
- **All outputs.** Everything spent, divided by the outputs accepted at least once. Outputs never accepted still count in the spending.

## The worked example

On 29 October 2026 I accepted the eleventh build of a 106-second film, after four rounds I sent back. At list prices it cost $56.37 to that yes, against $4.51 for the round I accepted: 12.5 times as much, with 92% spent on the rounds before it. The agent was $52.93 of it, the voice $3.29, and 15 cents went on model calls whose cost was already recorded: the experiment's own, and two models that listened to the voice. My review was at most 14.4 minutes, so my time is the larger cost only above about $235 an hour. The next day I raised the bar, and the remake has cost $45.01 more so far without a yes. The full table is in `runs/2026-10-30/results.md`.

## Limits

- List prices, not a bill. A subscription, a discount or a free allowance changes what anyone actually pays, and the ledger says nothing about that.
- The ledger prices only what you count. In the example, the checks on each build, my own hardware and the earlier films are left out, and `examples/HOW-COUNTED.md` lists them.
- Review minutes are bounds unless you time yourself. The gap between a delivery and a reply also holds whatever else you did in it.
- An acceptance holds until the bar moves. Rounds after it are reported apart, so the first figure doesn't change when you redo the work.
- One accepted output is an example, not a rate. Fill in ten and the spread starts to mean something.
- Prices move. On 30 October the DeepSeek price moved 29% within an hour (`runs/2026-10-30/prices-live-check.md`). Re-price an old ledger with `prices.mjs` before comparing it with a new one.
