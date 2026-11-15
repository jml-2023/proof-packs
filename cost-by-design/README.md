# Cost by design: the instrument pack

Two tools for pricing agent work before you build it.

1. **The known-answer cost test** (`run.mjs`, `compare.mjs`). One job with a known right answer, done under several designs, so you can see what each design costs and how often it gets the answer right. The job here: say which of two headlines more readers clicked, on 119 real A/B tests. Change one thing per design (the model, how hard it reasons, what you ask it for, how many cases go in one request) and the test shows which changes cost accuracy and which only cost money.
2. **The P50/P80 planner** (`plan.mjs`). Give it how long your past tasks took, or what they cost, and it returns the P50, which half of your tasks beat, and the P80, which four in five beat. Plan with the first and promise the second. A task that is still running counts as at least as long as it has run so far, so the slow ones aren't left out.

Both run on Node 18 or later with no packages to install.

## What's in it

- `pairs.json`: 119 headline tests from the [Upworthy Research Archive](https://osf.io/jd64p/) (exploratory set), by J. Nathan Matias, Kevin Munger, Marianne Aubin Le Quere and Charles Ebersole, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). In each test, readers saw one of two headlines at random and the site counted the clicks; the two versions differ only in the headline. 60 are clear (at least 30% more clicks for the winner, at least 2,000 views per headline, z of 3 or more) and 59 are close (under 30% more clicks, at least 1,000 views per headline, significant at the 5% level). Each pair comes from a different test. They are the pairs selected for my earlier headline experiments, copied unchanged apart from leaving out fields the test doesn't use.
- `designs.json`: the ten designs run on 30 October 2026, with the list prices read from OpenRouter that day.
- `run.mjs`: runs each design on every pair, twice (once with the more-clicked headline as A, once as B), and keeps every call: the picks read from it, its tokens, cost and time, and the reply's text whenever no usable pick could be read from it.
- `compare.mjs`: scores the runs. It makes no calls.
- `plan.mjs`: the planner.
- `runs/`: the 30 October runs, one file per design.
- `results-2026-10-30.md` and `.json`: the comparison for those runs.
- `examples/`: the planner run on two kinds of record (see "The planner" below).

## Run the cost test

```
API_KEY=your-openrouter-key node run.mjs            # every design in designs.json
API_KEY=your-openrouter-key node run.mjs luna sol   # only these designs
node compare.mjs                                    # scores the latest day in runs/
```

`run.mjs` uses OpenRouter unless you set `BASE_URL`, and works with any endpoint that speaks the OpenAI chat format:

```
BASE_URL=https://api.openai.com/v1 API_KEY=your-openai-key DESIGNS=my-designs.json node run.mjs
```

On OpenRouter it asks for zero-data-retention providers only and for the charged cost of each call; set `ZDR=0` to allow any provider. Where an endpoint reports no cost, the cost is the tokens at the list prices in your designs file, and the results say so. A design already run that day is skipped, so an interrupted run can be resumed; `FORCE=1` runs it again. `CONCURRENCY` sets the number of parallel calls (default 8).

To test your own job, replace `pairs.json` (or point `PAIRS` at another file) with your own cases in the same shape (`clear` and `close` lists of `{ "winner": "...", "loser": "..." }`) and keep the prompts in `run.mjs`, or change them for your task. Fifty cases with a known answer is a sensible start: past A/B tests, decisions that played out, reviews you trust.

### The designs

| Id | What changes |
|---|---|
| `astra`, `sol`, `luna` | OpenAI's flagship, mid-priced and cheap models, one pair per request, with the scored prompt below |
| `opus`, `sonnet`, `haiku` | The same for Anthropic |
| `sol-low` | GPT-6.1 Sol told to use low reasoning effort |
| `luna-lean` | GPT-6 Luna asked only for its pick, without the scores |
| `luna-batch` | The same pick-only question, with 20 pairs in one request |
| `luna-again` | GPT-6 Luna run a second time, unchanged, to measure how much a rerun moves |

The scored prompt asks for a score from 1 to 10 for each headline and then for the pick. Only the pick is scored; the scores are there because my first headline experiment asked for them, and every token of them is paid for. The pick-only prompt asks for the pick alone. The batch prompt lists 20 pairs and asks for one pick per pair; the two orders of one pair always go in separate requests. All calls use temperature 0 and up to 4,000 output tokens (8,000 for a batch).

### Read the result

- **Right.** A judgement is right when it picks the headline more readers clicked. Each design makes 238 judgements: 119 pairs in two orders.
- **95% interval.** How far the accuracy could move if the same design met a different sample of tests like these: 2,000 resamples of the pairs, clear and close resampled separately.
- **Within the noise of the best.** The best design is the one with the highest accuracy on all 238 judgements. For every other design, `compare.mjs` resamples the pairs 2,000 times and takes the design's accuracy minus the best one's each time. If the 95% interval of that gap includes zero, the test can't tell the design from the best. The rerun of a design is left out of this choice.
- **Times the cheapest within the noise.** Each design's cost per 1,000 judgements divided by that of the cheapest design within the noise of the best.
- **Order flips.** Pairs where the answer changed when the two headlines swapped places: right in one order, wrong in the other. A model that always picks A flips on every pair.
- **The rerun.** `luna-again` against `luna`, judgement by judgement: how often the same design, run twice, gave the same pick. The gaps you can trust between designs are bigger than the gap between these two runs.
- **Time and cost per call.** The P50, P80 and the largest call, so you can see how long the tail is when a model decides for itself how long to reason.
- **The headline, with its labels.** The dearest design's cost per judgement divided by that of the cheapest design within the noise of the best. `compare.mjs` prints this ratio only with what it is measured against, what the bill includes and the period, because a cost ratio without those three can't be checked.

On 30 October 2026 the ten designs cost $2.96 in total. GPT-6.1 Sol was the best at 76%, and the cheapest design within its noise was GPT-6.1 Sol at low reasoning effort, at a sixth of GPT-6 Astra's cost per judgement. The full table is in `results-2026-10-30.md`.

## The planner

```
node plan.mjs tasks.csv                                       # the first numeric column
node plan.mjs tasks.csv --column minutes --group kind --tasks 5 --out plan.md --json plan.json
```

The CSV needs a header row. Put one task per row with a number: minutes, hours or dollars. A task still going gets `running` in a `status` column (or a value starting with `>`), with the time it has run so far as its number. The planner reports, for all tasks and for each group:

- **P50 and P80**, computed with a Kaplan–Meier estimate, which counts a running task as unfinished up to its current time and unknown after that. When too many tasks are still running for the estimate to reach four in five, it says "more than" the longest time seen instead of making a number up.
- **A 95% interval on the P80**, from 2,000 resamples of the tasks.
- **P80 ÷ P50**, a quick measure of how long the tail is.
- **The share of all finished time in the slowest fifth of tasks.**
- **A label**: "observation only" under 10 tasks, "provisional" from 10, "calibrated" from 30. The label never hides the number; it tells you how far to trust it.
- With `--tasks N`, a plan for N such tasks done one after another, from 10,000 random draws of your finished tasks. Adding up N P80s promises far more than you need, and adding up N P50s promises too little; the draws give the honest pair.

### Examples

- `examples/agent-tasks-2026-10-30.csv`: the tasks of the agents that prepare, review and film pieces for my publication, from 07:30 to 11:30 UTC on 30 October 2026, from the log of the runner that starts them, read as it stood at 11:30 UTC (`--at 2026-10-30T11:30:00Z`). Each task has a kind: `piece`, `piece review`, `film` or `film review`. `examples/from-runner-log.mjs` made it; it reads that runner's log format, so treat it as an example of turning a log into the CSV. A task the runner started again before logging its end is marked `unknown` and left out. The plan, made with `--group kind --tasks 4`, is in `examples/agent-tasks-2026-10-30-plan.md`.
- `examples/call-costs-2026-10-30.csv`: the cost of every call in the 30 October cost test, one row per call, grouped by design, with its plan in `examples/call-costs-2026-10-30-plan.md`. Even one kind of call has a tail when the model decides how long to reason.

## Limits

- One job: guessing which of two headlines readers clicked. A task with an answer you can work out, such as maths or code, may reward the expensive models; run the test on your own job before you trust a result from mine.
- One day of runs, two model families, and the batch and pick-only changes tested on one cheap model. Prices and models change; the run files record the model each call was served by.
- In the 30 October runs, 12 single-pair replies were valid JSON without a usable A or B (four from `luna-lean`, seven from `haiku`, one from `luna-again`), and one batch request came back as a refusal line. `run.mjs` kept a reply's text then only when it wasn't JSON at all, so the text of those 12 is lost; it now keeps the text whenever a pick is missing.
- 119 pairs give intervals several points wide. A difference smaller than the interval, or smaller than the gap between the two runs of the same design, is not a finding.
- The planner's numbers describe the past tasks you give it. If your work changes, so does the tail. Under 10 tasks it reports an observation, not a plan.
