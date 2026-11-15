# Ask the same question twice: the instrument pack

This pack measures how often a model gives a different answer to the same question, asked word for word. It sends each question several times and counts how often two runs disagree, per field and per whole answer, with facts kept apart from judgements and every question shown on its own. It reports how often asking fewer times would have caught a question that changed, and every answer that came back the same each time but differs from the question's label. It also checks whether a 1–10 rating is steady enough to show a one-word fix to a screen. A second script compares two result files: two models, or one model on two dates.

## What's in it

- `questions.json`: two sets of questions. Every item is made up for these tests: Northlight Studio, its owner Sam and the booking app Lantern are invented.
  - **decisions**: six admin situations at Northlight Studio. For each, the model decides whether to just do the job, do it and tell Sam the same day, or ask Sam first, and answers four facts the situation states: can it be undone, would it be a first contact outside the business, does it spend more than £200, and will Sam or a customer notice. Each situation also carries two labels from the experiment it came from: `truth`, the four facts as that experiment's rule reads them, and `rule`, what the rule says the assistant should do. In that experiment, two situations were clear-cut: 23 of the 24 answers its four models gave matched the rule. The other four were harder: between 2 and 12 of the 12 answers to each went against the rule.
  - **screens**: three screens from Lantern. Screen A shows a table for two, a £48 deposit and one green button labelled "Book this table". The second is screen A with one change: the button says "Submit". Screen B shows a table for four, a £36 deposit, a blue "Reserve now" button and a red "Cancel booking" button. Each screen gets a 1–10 rating, the deposit it shows (a fact, with its answer in `truth`) and three design judgements: is the main action obvious, what is the single biggest problem, and would you ship it.
- `screens/`: the three screens, made for these tests.
- `run.mjs`: asks every question a set number of times, counts the disagreements and writes the results.
- `compare.mjs`: compares two or more result files from `run.mjs`.
- `results-template.md`: the empty tables, if you'd rather fill them in by hand.
- Example runs, all through OpenRouter:
  - `results-openai-gpt-6-luna-2026-10-30.md` and `.json`, and `results-openai-gpt-6.1-terra-2026-10-30.md` and `.json`: ten repeats each with default settings, on 30 October 2026. All 90 calls on each model gave a readable answer. OpenRouter reported $0.0127 for GPT-6 Luna and $0.0851 for GPT-6.1 Terra.
  - `compare-openai-gpt-6-luna-2026-10-30-vs-openai-gpt-6.1-terra-2026-10-30.md` and `.json`: those two runs compared.
  - `results-openai-gpt-6-luna.md` and `.json`: the first test run, on 29 October 2026, five repeats, 45 calls, $0.0063. It was made with the earlier version of `run.mjs`, so it has no lines for asking fewer times or for labels.

## Run it

You need Node 18 or later and an API key. Nothing else is installed.

```
API_KEY=your-openrouter-key node run.mjs openai/gpt-6-luna
```

The script uses OpenRouter unless you set `BASE_URL`, and works with any OpenAI-compatible chat connection:

```
BASE_URL=https://api.openai.com/v1 API_KEY=your-openai-key node run.mjs <model name>
```

Settings, all optional:

- `REPEATS=10` asks each question ten times (the default is 5). More repeats find more of the rare changes.
- `SETS=decisions` skips the screens, for a model that doesn't read images.
- `PINNED=1` sends temperature 0 and seed 1. Run once with it and once without to see whether your model repeats itself when told to. OpenRouter lists no temperature setting for some models, GPT-6 Luna and GPT-6.1 Terra among them, so for those the seed may be the only change.
- `QUESTIONS=mine.json` uses your own questions. Copy the shape of `questions.json`: each field has a `role` (`fact`, `judgement` or `score`) and a `kind` (`yesno`, `choice` or `rating`), and an image or video item names its file, next to the questions file. `truth` and `rule` are optional.
- `CONCURRENCY=4` is how many calls run at once (the default is 4).

It writes `results-<model>-<date>.md` and `results-<model>-<date>.json` next to the questions file. The JSON keeps every call, with its answer, the provider that served it and the cost the endpoint reported. The pack sends no provider preferences, so your account's own settings decide where each request goes.

To compare files, run `run.mjs` once per model, or on one model on two dates, then:

```
node compare.mjs results-openai-gpt-6-luna-2026-10-30.json results-openai-gpt-6.1-terra-2026-10-30.json
```

Add `QUESTIONS=mine.json` in front if the runs used your own questions. It writes `compare-<first>-vs-<second>.md` and `.json` next to the questions file.

## Read the result

- **Facts against judgements.** Facts should almost never change. If one does, check whether the model is misreading the material.
- **Per question.** Look for the questions that change. A question that changes is one where the model's answer isn't settled, so don't let a single run of it decide anything. Which questions change depends on the model: in the example runs, GPT-6.1 Terra changed its answer on one of the clear-cut situations (`tell-06`) and GPT-6 Luna didn't.
- **The whole answer.** One field changing is enough for an agent to act differently, so this is the rate that matters if your agent acts on the answer as a whole.
- **Asking fewer times.** For every question that changed, the script works out how often you'd have seen the change if you'd asked only two, three or five times: it picks that many of your answers at random, without replacement, and counts exactly. In the example runs, asking twice would have shown the change about a third of the time (35.6% on GPT-6 Luna, 35.9% on GPT-6.1 Terra), and asking five times 72.2% and 75.5% of the time.
- **Steady isn't right.** A question that gives the same answer every time can still be wrong. The script lists every field that came back the same each time and differs from the question's label. A label can be a wording choice: the rule behind these labels counts a routine email as something that can be undone, because a follow-up can correct it, and every model in the example runs said it can't. Read the question before you call the model wrong.
- **Screen ratings.** Compare the change from "Submit" to "Book this table" with the spread of each screen's ratings. A judge whose ratings of one unchanged screen spread wider than the change can't show you the change.
- **Comparing files.** `compare.mjs` reports how often two runs inside one file disagree and how often an answer from one file and an answer from the other disagree. Between two models, the second number is the disagreement you'd miss by asking only one of them: in the example, an answer from GPT-6 Luna and one from GPT-6.1 Terra disagreed on 44.0% of whole answers, against 19.8% and 24.0% for two runs of the same model. Between two dates on one model, a second number no higher than the first means the answers haven't moved beyond their usual wobble. It also lists questions where each file gave the same answer every time and the files still disagreed.

## Limits

Six situations, three screens and ten repeats are enough to see the method work on one model. They are not enough to rank models, and the rates depend on how many hard questions are in the set: this one has four on purpose. Run your own questions before relying on a number, and run them again later, because model versions change. The essay's own run also used Jev 1.14, a model that answers typed questions with probabilities, through OpenRouter's separate decisions endpoint; this pack calls only the chat endpoint.
