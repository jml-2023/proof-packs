# Migration trial, 2026-10-30

Step `steps/transcribe.py`, 6 cases (7.68 minutes of audio), 4 sends of each case to each model. The first model is the one in use now.

| Model | Sends | Answered | Cut off | Refused | Empty | Errors | Word error rate (pooled) | Worst send | Sends at 2% or less | Cost per audio minute | Median seconds |
|---|---|---|---|---|---|---|---|---|---|---|---|
| google/gemini-3.8-flash | 24 | 24 | 0 | 0 | 0 | 0 | 1.3% | 4.6% | 79.2% | $0.00515 | 12.26 |
| google/gemini-3.8-flash@google-ai-studio | 24 | 24 | 0 | 0 | 0 | 0 | 1.2% | 4.6% | 83.3% | $0.00558 | 11.96 |
| google/gemini-3.8-flash@google-vertex | 24 | 24 | 0 | 0 | 0 | 0 | 1.2% | 4.6% | 79.2% | $0.00484 | 10.64 |
| google/gemini-3.7-flash | 24 | 24 | 0 | 0 | 0 | 0 | 1.4% | 4.6% | 70.8% | $0.00422 | 9.61 |
| openai/gpt-audio-mini | 24 | 24 | 0 | 0 | 0 | 0 | 3.6% | 7.3% | 16.7% | $0.00087 | 4.17 |
| mistralai/voxtral-small-24b-2507 | 24 | 24 | 0 | 0 | 0 | 0 | 2.3% | 5.1% | 50.0% | $0.00601 | 3.76 |
| google/gemini-3.5-flash-lite | 24 | 24 | 0 | 0 | 0 | 0 | 2.7% | 6.1% | 54.2% | $0.00096 | 3.44 |

| Model | Same transcript on every send | Transcripts identical to the incumbent's | Cases whose verdict changes | Outcomes by host | Calls retried |
|---|---|---|---|---|---|
| google/gemini-3.8-flash | 0 of 6 | 24 of 24 | – | Google AI Studio: ok 24 | 0 |
| google/gemini-3.8-flash@google-ai-studio | 0 of 6 | 0 of 24 | none | Google AI Studio: ok 24 | 0 |
| google/gemini-3.8-flash@google-vertex | 0 of 6 | 0 of 24 | none | Google: ok 24 | 0 |
| google/gemini-3.7-flash | 0 of 6 | 0 of 24 | ls-7127-75947 | Google: ok 24 | 0 |
| openai/gpt-audio-mini | 2 of 6 | 0 of 24 | ls-1089-134686, ls-5142-36377, ls-61-70968, ls-7127-75947 | OpenAI: ok 24 | 1 |
| mistralai/voxtral-small-24b-2507 | 4 of 6 | 0 of 24 | ls-1089-134686, ls-5142-36377 | Mistral: ok 24 | 0 |
| google/gemini-3.5-flash-lite | 0 of 6 | 0 of 24 | ls-7127-75947 | Google: ok 24 | 0 |

Answered means a whole reply. Cut off means the safety filter stopped the reply after a few words, which a pipeline that only checks for text would take as the transcript. Refused means a safety stop with nothing, or a request blocked for safety. The word error rate counts only answered sends. A model written as model@host was sent to that host only. Every call, with its transcript, finish reasons, host, tokens and cost, is in `results.json`.
