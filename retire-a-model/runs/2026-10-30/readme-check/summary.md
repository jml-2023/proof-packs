# Migration trial, 2026-10-30

Step `steps/transcribe.py`, 6 cases (7.68 minutes of audio), 1 sends of each case to each model. The first model is the one in use now.

| Model | Sends | Answered | Cut off | Refused | Empty | Errors | Word error rate (pooled) | Worst send | Sends at 2% or less | Cost per audio minute | Median seconds |
|---|---|---|---|---|---|---|---|---|---|---|---|
| google/gemini-3.8-flash@google-ai-studio | 6 | 6 | 0 | 0 | 0 | 0 | 1.1% | 4.1% | 83.3% | $0.00511 | 12.82 |
| openai/gpt-audio-mini | 6 | 6 | 0 | 0 | 0 | 0 | 3.4% | 6.1% | 16.7% | $0.00087 | 4.61 |

| Model | Same transcript on every send | Transcripts identical to the incumbent's | Cases whose verdict changes | Outcomes by host | Calls retried |
|---|---|---|---|---|---|
| google/gemini-3.8-flash@google-ai-studio | – | 6 of 6 | – | Google AI Studio: ok 6 | 0 |
| openai/gpt-audio-mini | – | 0 of 6 | ls-1089-134686, ls-5142-36377, ls-61-70968, ls-7127-75947 | OpenAI: ok 6 | 0 |

Answered means a whole reply. Cut off means the safety filter stopped the reply after a few words, which a pipeline that only checks for text would take as the transcript. Refused means a safety stop with nothing, or a request blocked for safety. The word error rate counts only answered sends. A model written as model@host was sent to that host only. Every call, with its transcript, finish reasons, host, tokens and cost, is in `results.json`.
