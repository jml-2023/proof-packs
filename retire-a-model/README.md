# Retire a model: a migration trial and a retirement checklist

This pack goes with the essay "When to retire a model". It lets you take one step of your own pipeline that calls a
hosted model, run it on the model you use now and on the models you might move to, with the same request and the same
cases, and see what would change: whole answers, replies cut off by a safety filter, refusals, errors, word error
rate, the verdicts your step would reach, cost and time. Then the checklist helps you decide whether to keep the model,
pin it to one host or retire it, and the watch script tells you each week whether anything you depend on has moved.

Everything here runs on hosted models, through OpenRouter by default. Nothing runs a model on your own machine.

## What's in it

| File | What it does |
|---|---|
| `trial.py` | The harness. Sends every case to every model a number of times, sorts each reply as whole, cut off, refused, empty or error, scores it with the step's own scoring, and writes `results.json` (every call), `summary.md` (the tables) and `transcripts/`. `model@host` sends a model to one host only. `--summarise` rebuilds the tables from a saved run without sending anything. |
| `steps/transcribe.py` | The step I trialled: the transcription check from my film pipeline, with its instruction, audio format, settings and word counting copied from it line for line. A film passes when 2% or fewer of the script's words are heard wrong. |
| `steps/transcribe_line.py` | The same step with the shorter instruction my pipeline uses for single lines of narration. |
| `cases/librispeech/` | Six public recordings, 7.7 minutes of read speech in all, with the exact words read (`<id>.mp3` and `<id>.txt`) and `manifest.json` (source, licence, speakers, chapters, seconds and words). |
| `fetch_librispeech.py` | Rebuilds those six cases from LibriSpeech, if you want to check them or change the length. Needs `ffmpeg` and `ffprobe`. |
| `rescore.py` | Re-counts a saved run with a few extra word rules (accents dropped; St., Mr., Mrs. and Dr. read as the words spoken), applied to every model alike, so you can see how much of a gap is the scorer rather than the hearing. Prints a table and writes nothing. |
| `watch.py` and `models.json` | The weekly watch. For each model in `models.json` it reads OpenRouter's public model list and each model's hosts (no key needed), keeps a dated copy, and reports anything that changed since the last copy: listed or gone, expiry date, price, the model a name points at, hosts added or removed. It ends with each provider's own page to read by hand. |
| `CHECKLIST.md` | When to retire a model: how to write the dependency down, the signs that a model is on its way out, the trial, when to retire, and how to move. |
| `runs/2026-10-30/` | My runs on 30 October 2026, kept as they came out (see below). |

## What you need

- Python 3.9 or later, with nothing to install beyond the standard library.
- `ffmpeg` and `ffprobe` on your path (the step reads each recording's length with `ffprobe`).
- An OpenRouter key in `OPENROUTER_API_KEY` for `trial.py`. `watch.py` and `rescore.py` need no key. To use another
  OpenAI-compatible service, set `BASE_URL`; cost is only reported where the service returns it, as OpenRouter does.

## Run it

From this folder:

```sh
# 1. A first trial: two models, each public recording once (12 calls).
OPENROUTER_API_KEY=<your key> python3 -I trial.py --step steps/transcribe.py --cases cases/librispeech \
    --models google/gemini-3.8-flash@google-ai-studio,openai/gpt-audio-mini --sends 1 --out runs/my-first-trial

# 2. How much of the gap is the scorer?
python3 -I rescore.py runs/my-first-trial/results.json steps/transcribe.py cases/librispeech

# 3. The watch: run it weekly; it compares with the last copy in the folder.
python3 -I watch.py models.json runs/watch
```

On 30 October 2026, step 1 made 12 calls in under a minute and cost $0.046 (`runs/2026-10-30/readme-check/`,
log in `runs-2026-10-30-readme-check.log`). The full public trial below, 168 calls, took about five minutes and cost
$0.85.

The first model in `--models` is the one you use now; the others are compared with it. A model written as
`model@host` (for instance `google/gemini-3.8-flash@google-vertex`) goes to that OpenRouter host only, with no
fallback to other hosts, so you can see whether the same name behaves the same at each host. `--provider <host>` does
the same for every model in the run. `--workers` sets how many calls run at once (default 4). Only a dropped connection
or a busy server (HTTP 408, 429, 500, 502, 503 or 504) is tried again; a refusal or an empty reply is counted as what it is, because
that is what your pipeline would get.

## What the outcomes mean

- **Whole**: text came back, and the reply didn't stop on a safety filter.
- **Cut off**: text came back, but the reply stopped on a safety filter (`finish_reason` `content_filter`, or a native
  reason such as `SAFETY`) after a word or two. A step that only checks whether text came back would take it as the
  answer.
- **Refused**: a safety stop with no text, or a request blocked for safety before any answer.
- **Empty**: no text and no safety reason.
- **Error**: the call failed after its retries.

The word error rate counts whole replies only. "Sends at 2% or less" is the share of whole replies the step would
pass. "Cases whose verdict changes" lists the cases where a candidate's most common verdict differs from the model you
use now.

## Make it yours

A step is a Python file with four things in it, which `trial.py` loads:

- `cases(folder)`: returns a list of cases, each a dict with at least `id`, `audio` (a path), `text` (the answer you
  expect) and `seconds`;
- `request(model, case)`: returns the request body for one call, exactly as your pipeline builds it;
- `score(case, text)`: returns a dict with at least `words`, `errors`, `wer` and `verdict` (`pass` or `warn`), counted
  the way your pipeline counts;
- `words(text)`: the word list your scoring uses, for the case word counts.

Copy your pipeline's own request and scoring into it rather than rewriting them; the trial only means something if it
asks the question your step asks. Then add your own cases, starting with every input that has ever failed, and put
your models and their providers' pages in `models.json`.

## My runs, 30 October 2026

- `runs/2026-10-30/public/`: seven ways of running the transcription step (Gemini 3.8 Flash with the host left to
  OpenRouter and pinned to Google AI Studio and to Vertex AI; Gemini 3.7 Flash; OpenAI gpt-audio-mini; Mistral
  Voxtral Small; Gemini 3.5 Flash-Lite), six recordings, four sends each: 168 calls, $0.85. `summary.md` has the
  tables and `rescore.md` the same run with the extra word rules. To repeat it:
  `python3 -I trial.py --step steps/transcribe.py --cases cases/librispeech --models google/gemini-3.8-flash,google/gemini-3.8-flash@google-ai-studio,google/gemini-3.8-flash@google-vertex,google/gemini-3.7-flash,openai/gpt-audio-mini,mistralai/voxtral-small-24b-2507,google/gemini-3.5-flash-lite --sends 4 --workers 6 --out runs/2026-10-30/public`
  (log: `runs-2026-10-30-public.log`).
- `runs/2026-10-30/readme-check/`: step 1 above, run after the pack's last change to `trial.py`.
- `runs/2026-10-30/watch/`: two copies of the watch, 12:41 and 13:30 UTC; the second run's report is
  `runs-2026-10-30-watch.txt`.

What they showed: no model refused a public recording. Gemini 3.8 Flash got 1.2% to 1.3% of words wrong; OpenAI's
gpt-audio-mini, at about a sixth of the cost per minute of audio, got 3.6% wrong and would have changed the verdict on four of
the six recordings, much of it on names. The essay also reports trials on my own films and on one narration line that
Gemini's safety filter refused; those use my cloned voice, so they are not in this pack.

## Limits

- One afternoon. OpenRouter picks hosts by measures that change within minutes, so your calls may go
  elsewhere; pin the host to compare like with like.
- LibriSpeech is clean read English from public-domain books, with old names in it. It separates models that hear
  names well from those that don't; it won't tell you how a model does on your voice, your music or your subject.
- Costs are what OpenRouter reported for each call on the day, at its prices then.
- `watch.py` can't see a name that a provider has pointed at a newer model, because the router's list keeps the old
  name, date and price. Read the provider's page for each host you can reach; the same name can carry different dates
  at two hosts of the same company.

## Licence and credit

The six recordings and their texts are from the LibriSpeech ASR corpus (Vassil Panayotov, Guoguo Chen, Daniel Povey and
Sanjeev Khudanpur, "LibriSpeech: an ASR corpus based on public domain audio books", ICASSP 2015), published at
https://www.openslr.org/12 under CC BY 4.0, fetched from Hugging Face's copy (`openslr/librispeech_asr`). The clips
were cut and joined from the corpus's sentences by `fetch_librispeech.py`; `manifest.json` lists which ones.
