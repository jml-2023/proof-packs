# Did the model even look at the picture? The instrument pack

This pack tests whether a model that answers questions about a screenshot actually read the screenshot. It asks four yes or no questions three ways: with screen A attached, with screen B attached, where every answer flips, and with no image at all. If the answers follow the picture from A to B, the model read it. The no-image calls show how it behaves when the picture is missing.

## What's in it

- `screens/screen-a.png` and `screens/screen-b.png`: two states of a made-up restaurant booking app, made for this test.
- `questions.json`: the four questions, with the right answer for screen A. On screen B every answer is the opposite.
- `run.mjs`: asks the questions three times in each condition, scores the answers and writes the results.
- `results-template.md`: the empty table, if you'd rather fill it in by hand.
- Example runs, each a `.md` summary with the raw calls in the `.json` beside it:
  - `results-google-gemini-3.8-flash.md`, 29 October 2026
  - `results-google-gemini-3.8-flash-2026-10-30.md`, 30 October 2026
  - `results-openai-gpt-6.1-terra-2026-10-30.md`, 30 October 2026

## Run it

You need Node 18 or later and an API key. Nothing else is installed.

```
API_KEY=your-openrouter-key node run.mjs google/gemini-3.8-flash
```

The script uses OpenRouter unless you set `BASE_URL`, and it works with any model that reads images through an OpenAI-compatible connection:

```
BASE_URL=https://api.openai.com/v1 API_KEY=your-openai-key node run.mjs <an OpenAI model that reads images>
```

To test your own screens, make two states where every answer to your questions flips, write your questions in the same shape as `questions.json`, and point the script at them:

```
SCREEN_A=mine-a.png SCREEN_B=mine-b.png QUESTIONS=mine.json API_KEY=... node run.mjs <model>
```

It writes `results-<model>-<date>.md` and `results-<model>-<date>.json` next to the script, so earlier runs are kept (a second run of the same model on the same day replaces the first). The example runs cost $0.024 and $0.038 for nine calls on Gemini 3.8 Flash, and $0.0065 on GPT-6.1 Terra. Gemini spent most of that on the calls with no image.

## Read the result

- **Right answers.** An answer of 0.5 or more counts as yes, and it's right when that matches the screen. With no image there is no screen to match, so the answers are scored against screen A, and about half come out right by luck.
- **Screens A and B.** If every answer is right on both, the answers followed the picture, so the model read it. A model answering from the wording would give screen A's answers on screen B too. With three repeats, a model that saw neither screen would pass by luck at most 1 time in 64 (at best 1 in 4 for each pair of calls). The summary prints that bound.
- **Calls that come back empty.** A reply with nothing in it counts as a failed call. If any call with a screen gives no numbers, the summary says the run is not settled instead of giving a verdict, so run it again. On 30 October this happened once in 36 calls to GPT-6.1 Terra.
- **No image.** This shows how the model fails when the picture is missing. A careful model answers near 0.5 or says it can't tell. A model that still answers 0.9 or more, or 0.1 or less, is confident about a picture it didn't have; the script counts how many calls did that. If a model answers in words with no image, for instance by saying there is no picture, the script counts those calls separately. That is the right answer, so read them in the `.json`.
- **Tokens.** Each call's `usage` in the `.json` shows the input tokens. On these screens the picture was 1,092 to 2,670 input tokens, depending on the model. In your own checks, a sudden drop to a few hundred means the picture probably didn't arrive.
- A right answer on screen A alone shows nothing. That is the point of the pack.

## Limits

- Two screens, four questions and three repeats are enough to show the method on one model. They are not enough to rank models, and a model that passes on these screens can still fail on yours. Use your own screens for anything you rely on.
- On these two screens the button's colour and its label change together. A pass shows that the model read the picture. It doesn't show that it saw the colour, because a model that read only the words would pass too. To test one property, make a pair where only that property changes.
- The essay's numbers for Jev 1.14 came from a separate script, because Jev takes a different kind of request. This script runs models that use the chat format, such as Gemini or GPT.
