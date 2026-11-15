# Local or cloud: summary

## Answering (exam questions)

| Route | Model | Right | Median s | Run min | Cloud $ per 1,000 | Local extra Wh per 1,000 | Break-even $/kWh | Served by |
|---|---|---|---|---|---|---|---|---|
| local | gpt-oss:20b | 103/140 (73.6%; 66%–80%) | 3.7 | 15.3 | – | 561 | – | this machine |
| local | qwen3.8:27b | 122/140 (87.1%; 81%–92%) | 8.8 | 27.6 | – | 1271 | – | this machine |
| cloud | openai/gpt-oss-20b | 105/140 (75.0%; 67%–81%) | 6.9 | 27.9 | $0.143 | – | $0.26 | Darkbloom 43, AkashML 29, DekaLLM 19, Parasail 16, DeepInfra 13, CoreWeave 12, SiliconFlow 5, Groq 2, Amazon Bedrock 1 |
| cloud | qwen/qwen3.8-27b | 123/140 (87.9%; 81%–92%) | 8.7 | 35.1 | $2.987 | – | $2.35 | ModelRun 43, Modal 33, DekaLLM 22, Phala 16, DeepInfra 10, AkashML 9, Ionstream 4, CoreWeave 1, Cloudflare 1, Mancer 2 1 |
| cloud | google/gemini-3.8-flash | 128/140 (91.4%; 86%–95%) | 5.4 | 19.1 | $3.085 | – | – | Google 131, Google AI Studio 9 |

## Listening (transcribing narration)

| Route | Model | Word errors | Median s per 2-min narration | Cloud $ per audio hour | Local extra Wh per audio hour | Break-even $/kWh | Served by |
|---|---|---|---|---|---|---|---|
| local | faster-whisper large-v3 | 42/3383 (1.24%) | 4.6 | – | 6.4 | – | this machine |
| cloud | google/gemini-3.8-flash | 31/3379 (0.92%) | 18.0 | $0.268 | – | $42.22 | Google 7, Google AI Studio 3 |

Break-even compares an answering run in the cloud with the local run of the same model, and the cloud listening run with the local one. Local energy is the GPU board plus the processor package, above the idle draw measured in the minute before each run.
- gpt-oss:20b: 920 s at a mean 303 W on the GPU (peak 323 W) and 107 W on the processor; idle before it 102 W; extra 78.60 Wh, 104.74 Wh measured in all.
- qwen3.8:27b: 1657 s at a mean 411 W on the GPU (peak 435 W) and 70 W on the processor; idle before it 95 W; extra 177.97 Wh, 221.50 Wh measured in all.
- faster-whisper large-v3: 50 s at a mean 154 W on the GPU (peak 179 W) and 107 W on the processor; idle before it 103 W; extra 2.19 Wh, 3.62 Wh measured in all.
