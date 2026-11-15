# Decision ledger: the instrument pack

A way to know how often an automated decision is right, instead of taking the model's word for it. Every decision
gets a row with an id when it's made; its outcome is added later, by whoever holds the fact that settles it; a
script fits the error rate from the two and says what that record has earned: act alone, act and tell, or ask.

It comes with a test that fills a ledger for you: 48 everyday admin situations with known answers, put to four
models with and without a short written rule, each answer stating how sure the model is. Run it to see the ledger
work end to end, then point the fit at your own decisions.

Everything runs on Node 18 or later with no packages to install. Only `run.mjs` makes model calls.

## What's in it

- `fit.mjs`: fits an error rate from a ledger. For each kind of decision it reports how many have an outcome, the
  error rate with an exact (Clopper-Pearson) 95% interval, the one-sided 95% upper bound, what that bound has earned
  against your budgets, how many clean outcomes in a row it would still take to act alone, and the confidence the
  decider stated against what happened. `node fit.mjs --selftest` checks its arithmetic (13 checks).
- `ledger-template.csv`: the ledger, one row per decision, with five example rows that show each kind of outcome.
  Delete them before use.
- `act-and-tell-from-the-ledger.md`: a rule for an assistant that takes "how sure is it" from the ledger's record
  for that kind of decision, with the model's own confidence kept only as a note.
- `situations.json` and `rule.md`: the 48 situations and the written rule, unchanged from the experiment behind
  essay 9 (an invented design studio, Northlight, and its owner, Sam). Each situation states the facts the rule
  needs and carries the answer the rule gives.
- `run.mjs`: puts every situation to each model three times without the rule ("instinct") and three times with it
  ("rule"), and writes every answer to the ledger the moment it comes back, before its outcome is known.
- `label.mjs`: adds the outcomes, in their own file, from the rule applied to each situation's facts. It refuses to
  run if the rule worked out from the facts disagrees with a situation's stored answer.
- `runs/2026-10-30/`: my run. `decisions.jsonl` (1,152 rows), `outcomes.jsonl`, the run settings (`run-*.json`,
  with the exact prompts) and the fit: `results.md` and `results.json`.

## Run the test

```
API_KEY=your-openrouter-key node run.mjs --pilot   # 3 situations, 1 repeat, 24 calls, into runs/<today>-pilot/
API_KEY=your-openrouter-key node run.mjs           # all 48 situations, 4 models, 3 repeats each way: 1,152 calls
node label.mjs                                     # outcomes for the latest run, from rule.md and the facts
node fit.mjs runs/<day>/decisions.jsonl runs/<day>/outcomes.jsonl \
  --group decided_by,condition --by-outcome --out runs/<day>/results.md --json runs/<day>/results.json
```

`run.mjs` speaks the OpenAI chat format to OpenRouter unless you set `BASE_URL`. On OpenRouter it asks for
zero-data-retention providers only. A model with no such provider fails there; end its id with `@any` to let it use
any provider (`MODELS=google/gemini-3.8-flash@any`), or set `ZDR=0` for all models. `ANY_PROVIDER_BASE_URL`, if set,
is where `@any` models are sent instead. A run that stops part-way resumes from the ledger, and `COST_CAP` (dollars,
default 5) stops new calls. Choose models with `MODELS` (comma-separated OpenRouter ids).

My run, on 30 October 2026 from 13:47 to 13:56 UTC, cost $1.41:

```
MODELS=openai/gpt-6.1-sol,anthropic/claude-sonnet-5.5,google/gemini-3.8-flash@any,deepseek/deepseek-v4-pro-0813 node run.mjs
node label.mjs runs/2026-10-30
node fit.mjs runs/2026-10-30/decisions.jsonl runs/2026-10-30/outcomes.jsonl --group decided_by,condition --by-outcome \
  --title "Ask, tell or act: 48 situations, four models, 30 October 2026" --out runs/2026-10-30/results.md --json runs/2026-10-30/results.json
```

Gemini 3.8 Flash had no zero-data-retention provider that day, so it ran through any provider; I set
`ANY_PROVIDER_BASE_URL` to a local proxy holding a key that is allowed to use them. All 1,152 answers could be read
at the first attempt. "Right" in this test means the call the written rule makes from the stated facts; there is no
other right answer.

### What it showed

| Model | Rule | Said it was sure (mean) | Was right | Went ahead without a needed yes (of 48) | Upper bound on the error rate | Earned |
|---|---|---|---|---|---|---|
| GPT-6.1 Sol | without | 94.9% | 71.5% | 6 | 35.3% | ask |
| Claude Sonnet 5.5 | without | 78.0% | 77.8% | 14 | 28.7% | ask |
| Gemini 3.8 Flash | without | 91.7% | 69.4% | 21 | 37.5% | ask |
| DeepSeek V4 Pro | without | 90.7% | 66.7% | 15 | 40.4% | ask |
| GPT-6.1 Sol | with | 99.9% | 100% | 0 | 2.1% | act |
| Claude Sonnet 5.5 | with | 89.2% | 99.3% | 0 | 3.3% | act |
| Gemini 3.8 Flash | with | 98.8% | 100% | 0 | 2.1% | act |
| DeepSeek V4 Pro | with | 94.4% | 89.6% | 3 | 15.6% | act and tell |

Without the rule the four models were right 71.4% of the time and said 89% on average; when wrong they said 87%,
and in the 56 must-ask cases where they went ahead anyway, 85%. Of their 373 answers stated at 90 or more, 285
were right. The rule took them to 97.2% right. Essay 9's run of the same test on 10 October, without stated
confidence, gave 72.2% and 98.4%.

## Use it on your own decisions

Copy `ledger-template.csv`, or write JSON lines. A decision needs an `id` and an `answer`; add `at`, `point` (the
kind of decision), `decided_by`, `confidence` (0 to 1 or 0 to 100) and any column you want to group by. An outcome
goes either in the same row (`outcome`, `outcome_source`, `outcome_at`) or in a file of its own (`decision_id`,
`outcome`, `source`, `recorded_at`), joined on the id. A `right` column (yes or no) is for outcomes that are a
verdict rather than an answer.

```
node fit.mjs my-ledger.csv --group point                    # one file
node fit.mjs decisions.jsonl outcomes.jsonl --group point   # two files
```

Options: `--act 0.05` and `--tell 0.2` set the budgets on the upper bound; `--stale-days 30` sets when a decision
without an outcome counts as stale; `--count-applied` grades `applied` outcomes too; `--by-outcome` breaks errors
down by the right answer; `--out` and `--json` write the report.

Four habits make the number mean something:

1. Write the row when the decision is made, before anyone knows how it turned out.
2. Get the outcome from whoever holds the fact: a person's yes or no, a test result, a payment that went through.
   Never another model's opinion of the answer.
3. Mark the agent's own record of what it carried out as `applied`. It counts toward coverage and is not graded,
   because a label that copies the answer it labels can't show that answer was wrong.
4. Never edit an outcome. To correct one, add a newer row for the same decision; to void one, add a row with
   `withdrawn` set to yes. The latest row wins.

With no errors at all, a kind of decision needs 59 graded outcomes in a row before its upper bound is under 5%,
and 299 before it is under 1% (the rule of three: Hanley and Lippman-Hand, "If nothing goes wrong, is everything all
right?", JAMA 1983).

## Limits

- The 48 situations are invented, and their outcomes come from a rule, so they are cleaner than real outcomes.
  Real ones arrive late, get disputed or never come; that is what the stale count is for.
- One run on one day, four models, temperature 0.7, and confidence asked for one way: a number in the same reply.
  Sampling a model several times and measuring how far it agrees with itself can track being right better.
- The fit describes a kind of decision over the outcomes you have. It says how often, never which time, and it
  assumes the decisions you grade are like the ones you don't.
- The budgets (5% to act alone, 20% to act and tell) are a choice. Set your own, and set them before you look.
