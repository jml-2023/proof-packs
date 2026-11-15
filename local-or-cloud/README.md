# Local or cloud? The instrument pack

This pack compares running a model on your own computer with renting one in the cloud, on two jobs, and records four things for each route: quality, time, money (or energy) and who handled your data. It goes with the essay *Local AI on my own desk*.

- **Answering.** 140 exam questions from MMLU-Pro, ten from each of its 14 subjects, put to one model. You run an open model on your own machine, the same model through a cloud service, and any other cloud model you want to compare. Each answer is right or wrong.
- **Listening.** Ten narrations of about two minutes each (20.7 minutes in all) from LibriSpeech, an audiobook corpus with reference texts. You transcribe them on your own machine with Whisper and in the cloud with a model that takes audio, and count the word errors.

While the local routes run, a small sampler logs your GPU's power, and your processor's energy where Windows reports it, so the energy can be priced against your own electricity bill.

## What's in it

- `tasks/answering.jsonl`: the 140 questions, with their subject, options and answer. `make-tasks/sample-answering.mjs` picks them from MMLU-Pro's public test split (MIT licence; TIGER-Lab, 2024) with seed 20261030. `tasks/answering-42.jsonl` is the first three of each subject, for a shorter local run of a bigger model.
- `tasks/listening/`: the ten narrations (`n01.mp3` to `n10.mp3`, 16 kHz mono at 48 kb/s) and `narrations.json` with each reference text, reader and source sentences. `make-tasks/build-listening.mjs` makes them from LibriSpeech test-clean with seed 20261030: five women and five men, one chapter each, consecutive sentences until two minutes are reached, joined with 0.4 s of silence. LibriSpeech (Panayotov, Chen, Povey and Khudanpur, 2015) is published at openslr.org/12 under CC BY 4.0 and was read by LibriVox volunteers; the narrations here are adapted from it under that licence.
- `answer.mjs`: the answering job on one route. It works with anything that speaks the OpenAI chat format: Ollama, LM Studio, llama.cpp's server, OpenRouter. `score-answers.mjs` holds its scoring, and re-scores a saved run (see "Read the result").
- `listen_local.py`: the listening job on your own GPU, with faster-whisper.
- `listen-cloud.mjs`: the listening job on a cloud model that accepts audio.
- `wer.mjs` and `score-listening.mjs`: one word-error count for every route.
- `power/sample-windows.ps1` and `power/sample-linux.sh`: the power sampler. `energy.mjs` turns its log into watt-hours for a run.
- `report.mjs`: puts the runs side by side and works out the break-even electricity price. `merge-runs.mjs` joins a run made in parts, and their energy files. `compare-pairs.mjs` compares answering runs question by question (see "Read the result").
- `results/`: the author's runs of 30 October 2026, each a `.md` summary with the raw record in the `.json` beside it; `summary.md` puts them side by side, `RUN-2026-10-30.md` says exactly how they were made, and `power/` holds the power log and the clock readings the energy files were computed from.

## Run it

You need Node 18 or later, an OpenRouter key for the cloud routes, and for the local routes a machine with an Nvidia GPU running Ollama (or LM Studio, or llama.cpp's server) and Python with `faster-whisper`. Everything else is in the pack.

1. **Start the power sampler** on the machine with the GPU, and leave it running from a minute before the first local job until the last one ends. Keep the machine otherwise idle in the minute before each local job: it is the idle baseline.

   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File power\sample-windows.ps1 > power.csv      (Windows)
   bash power/sample-linux.sh > power.csv                                                         (Linux)
   ```

2. **Answering, local.** Pull the model (`ollama pull gpt-oss:20b`, about 14 GB), then:

   ```
   node answer.mjs --route local --model gpt-oss:20b
   ```

   If the model runs on another machine, add `--base-url http://<that machine>:11434/v1`. For a bigger model, give it the shorter set: `--tasks tasks/answering-42.jsonl --out results/answering-local-<model>-42q-<date>.json`.

3. **Answering, cloud.** The same model, then any others you want to compare:

   ```
   OPENROUTER_API_KEY=... node answer.mjs --route cloud --model openai/gpt-oss-20b
   OPENROUTER_API_KEY=... node answer.mjs --route cloud --model google/gemini-3.8-flash
   ```

4. **Listening, local**, on the machine with the GPU:

   ```
   pip install faster-whisper
   python listen_local.py tasks/listening results/listening-local-raw.json
   node score-listening.mjs results/listening-local-raw.json
   ```

   This runs Whisper large-v3 without conditioning each stretch on the text before it, which is how the author's own word check runs it. Add `--condition-on-previous-text` for the library's default; in the author's run, that default made up passages in two narrations (below).

5. **Listening, cloud:**

   ```
   OPENROUTER_API_KEY=... node listen-cloud.mjs --model google/gemini-3.8-flash
   ```

6. **Energy and the side-by-side**, once the sampler is stopped. If the sampler ran on a different machine from the job, give the sampler's clock minus the job machine's clock in milliseconds with `--offset-ms`.

   ```
   node energy.mjs --log power.csv --run results/answering-local-gpt-oss-20b-<date>.json
   node energy.mjs --log power.csv --run results/listening-local-raw.json
   node report.mjs --answer-local results/answering-local-gpt-oss-20b-<date>.json \
                   --answer-local-energy results/answering-local-gpt-oss-20b-<date>-energy.json \
                   --answer-cloud results/answering-cloud-openai-gpt-oss-20b-<date>.json \
                   --answer-cloud results/answering-cloud-google-gemini-3.8-flash-<date>.json \
                   --listen-local results/listening-local.json --listen-local-energy results/listening-local-raw-energy.json \
                   --listen-cloud results/listening-cloud-google-gemini-3.8-flash-<date>.json
   ```

Add `--limit 3` to any job for a trial run first. The author's full cloud runs cost $0.96 in all (gpt-oss-20b $0.020, Gemini 3.8 Flash $0.432 for answering and $0.092 for listening, Qwen3.8-27B $0.418), plus $0.025 for trials. A local run costs only electricity.

## Read the result

- **Quality.** Answering is the share of questions right, with a 95% interval: with 140 questions, two routes a few points apart may not differ at all. The answer is the reply's last "The answer is (X)", or failing that its last "Answer: X", read with Markdown emphasis removed, so "The answer is **(E)**" counts as E. A reply with neither counts as wrong, and the summary says how many there were. The first version of the reader missed the bold forms; `node score-answers.mjs <run>` re-scores a saved run from the reply ends it keeps, records the first reading of every answer as `got_first_pass`, and says what changed. Because every route answers the same questions, `node compare-pairs.mjs <run> <run> [...]` also counts, for each pair of runs, the questions one got right and the other missed, with the chance of a split at least that uneven if the two were equally good. Listening is the word error rate: substitutions, deletions and insertions against the reference, divided by its words. Every transcript goes through the same normaliser first: lower case, numbers as spoken words, punctuation dropped, some British and old spellings mapped to the reference's, and a compound split on one side and joined on the other ("checker board", "checkerboard") counted as one word. It doesn't expand abbreviations, so "Mr" for the reference's "Mister" counts as an error on every route. The departures are listed in each `.json`, so you can read every error.
- **Time.** Seconds per question or per narration, as you would wait for them, one at a time. A cloud route can run many at once and a single GPU can't, so for a large batch the cloud is faster than these numbers suggest.
- **Money and energy.** A cloud route reports what it charged. A local route reports watt-hours: the GPU board and the processor package above their idle draw in the minute before the run. Divide a cloud route's cost by the local route's kilowatt-hours to get the break-even price: if your electricity costs less than that per kWh, the local route is cheaper to run. `report.mjs` does this for runs of the same model, and for the listening routes. This leaves out memory, drives, fans, other cards and the power supply's own losses, which all add to the local bill, and it leaves out the price of the GPU.
- **Who handled your data.** Each cloud reply names the company that served it; the summary counts them. On OpenRouter the same model name can be served by several companies, at different precisions, unless you pin one. A local route sends nothing off your machine.

## What the author's run showed

On 30 October 2026, on an RTX 4090 (see `results/summary.md`): gpt-oss-20b got 103 of 140 on the desk and 105 in the cloud, where nine companies served it; the desk's median wait was 3.7 s against 6.9 s. The desk used 0.56 kWh above idle per 1,000 answers, against $0.14 in the cloud, so the two cost the same at about $0.26 per kWh. Qwen3.8-27B, a newer open model, got 122 on the desk (4-bit, run in two parts of 42 and 98 questions and joined with `merge-runs.mjs`) and 123 in the cloud; the desk used 1.27 kWh per 1,000 answers against $2.99 in the cloud, so the desk is cheaper below $2.35 per kWh. Gemini 3.8 Flash got 128 in the cloud for $3.08 per 1,000 answers. Question by question (`results/paired-2026-10-30.md`), the two copies of each model split their disagreements evenly (gpt-oss-20b 5 to 7, Qwen3.8-27B 4 to 5); Flash against the desk's Qwen3.8-27B split 10 to 4, which happens by chance 18% of the time; the desk's Qwen3.8-27B against its gpt-oss-20b split 22 to 3, which chance almost never gives. Whisper large-v3 on the desk got 1.24% of words wrong, at a median 4.6 s per narration and about 6 Wh per audio hour; Gemini 3.8 Flash got 0.92%, at 18.0 s and $0.27 per audio hour. With the library's default setting, Whisper's first desk run got 5.59% wrong: it made up 106 words in two narrations.

## Limits

- One run of each route, on one day. Cloud speed and the choice of company change by the hour. Quality differs between runs of the same model too, so differences of a few questions are noise.
- The local energy is a floor, not the whole bill: see "Money and energy".
- The questions are multiple choice and the narrations are clear studio reading. Your own work may be harder or easier for each route.
- The tasks are public, so a model may have seen them in training. That affects every route, so the comparison between routes still holds, but the absolute scores may be flattering.
