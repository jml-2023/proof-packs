# How the worked example was counted

`look-film-2026-10-30.csv` is the ledger of one film: the 106-second replay that goes with my essay *Did the model even look at the picture?*. It covers my go-ahead on 29 October 2026 at 08:16 UTC, my yes at 13:08 UTC the same day, and the remake the next day after I raised the bar. Every count comes from a record my own tools keep. No count comes from a bill. Every dollar is a count times a public list price (`../prices-2026-10-30.json`), except the experiment's own $0.027987, which it added up from the cost OpenRouter reported for each of its calls.

## The rounds

A round starts when I send the agent an instruction and ends when it hands something back: the moment its message with the film began to appear. Its messages and mine are in the same local log, timed to the millisecond, so the gap between a delivery and my reply is measured on one clock.

| Round | What came back | What I typed next (UTC) | Decision |
|---|---|---|---|
| 1 | the experiment; a 110-second draft shown at 09:04:10, which I didn't answer; three whole voice reads; thirteen build runs; build 7 shown at 11:07:28 | 11:10:24 "I dont like that it is moving left and right all the time, like drifting. why do we do that?" | sent back |
| 2 | build 8, at 11:21:08 | 11:25:08 "There is still a jitter on the screen … The underline is too thick and could be more elegant" | sent back |
| 3 | build 9, at 11:50:10 | 11:52:24 "Did you actually listen to the audio??? there are a lot of defects in it and this is not podcast quality" | sent back |
| 4 | listening checks and build 10, still in progress | 12:34:36 "use another model then to listen?? like gemini 3.8??", typed while the agent was working | sent back |
| 5 | build 11, at 13:03:22 | 13:08:36 "yes, lets keep this. what is next?" | accepted |
| 6 | the remake to the new floor and its 53-second cut, 30 October | none yet | open |

The build numbers come from the build logs, whose times fall inside the rounds: build 7 finished at 11:05, 8 at 11:17, 9 at 11:44, 10 at 12:04 and 11 at 13:01 UTC. In round 1 the agent started a full build of the film thirteen times: three renders straight from the film kit (08:40, 08:47 and 08:54 UTC) and ten runs of the pipeline, one of them stopped part-way. The first pipeline runs all wrote to one log, which each overwrote; builds 5, 6 and 7 have logs of their own. The agent's commands, in the same local log as its token counts, show every start. The register of films I've been shown lists build 11 as "accepted 29 Oct".

## The columns

- **Agent tokens.** The coding agent I use logs every model call, with its tokens, to a local database. I summed the calls in each round's turn: 642 calls in rounds 1 to 5, all to Claude Opus 5.5. That log's input count already includes the tokens read from and written to the prompt cache (true for all 642 calls), so `uncached_in` is the input count minus both cache counts. The shape of the query, in SQLite:

  ```sql
  select turn_id, sum(input_tokens - cache_read_input_tokens - cache_creation_input_tokens) as uncached_in,
         sum(cache_read_input_tokens) as cache_read, sum(cache_creation_input_tokens) as cache_write,
         sum(output_tokens) as out_tokens
  from model_usage where session_id = ? and started_at between ? and ? group by turn_id;
  ```

  The log doesn't say whether a cache write was billed at the five-minute or the one-hour rate. The ledger uses the five-minute rate, $5 per million. At the one-hour rate, $8 per million, rounds 1 to 5 would cost $9.47 more.
- **Voice.** The voice helper writes one line per request to its own ledger: the words, the takes it made and the take it chose. It records no money. Seed Audio 1.0 made three takes of every chunk and is priced per second of audio it generates, so the generated seconds are three times the length of the kept audio: three whole reads of 105.6, 110.4 and 107.8 seconds in round 1, and 17 single-line requests totalling 115.2 seconds in round 5. That slightly undercounts, because the kept audio has long pauses cut to 1.5 seconds. Two requests in round 1 failed before any audio was made, so at a price per second of generated audio they cost nothing. In round 6 the voice was ElevenLabs v4, priced per character: five reads of the film's 1,675-character script and five of the cut's 708 characters.
- **Other.** The experiment the film shows made 18 model calls of its own, and its results file records their cost: $0.027987, the sum of the cost OpenRouter reported for each call. In round 5 the agent asked two hosted models, Gemini 3.8 Flash and Gemini 4 Argon, to listen to four mixes of the voice, twice each, and saved every response with the cost OpenRouter reported: 16 calls, $0.118224 in all. These two are the only figures in the ledger that weren't priced from a count.
- **Review minutes.** The high figure is the gap from the moment the agent's message with the film began to appear to my reply: 2.944, 4.005, 2.234 and 5.230 minutes in rounds 1, 2, 3 and 5. It holds whatever else I did in those minutes, so it is an upper bound. The low figure is zero for a round I sent back, because I could reject a film in its first seconds, and one viewing (106 seconds) for the round I accepted. In round 4 my message came while the agent was still working, so there is no gap to measure. In round 1 the agent also showed me a draft at 09:04:10, two hours before build 7, and carried on by itself. I didn't answer it, and if I watched it, that time is not counted. I didn't time myself.
- **Decision.** From my messages and the register above.

## What is not counted

- The hosted transcription run on each build, and the hosted transcription that checked the line boundaries when the agent split the reads into lines. The build check runs on Gemini 3.8 Flash, listed at $0.825 per million input tokens, and neither records its token counts.
- Rendering on my own Mac, and the voice conversion in round 3 on my own PC. Both are my own hardware, and they're not priced.
- The music, a track I made before this film.
- The two earlier sets of films agents made for this publication: ten from 10 October and thirteen redesigned ones from 13 October (last re-rendered on 24 October). I retired both sets on 30 October. Counted in, they would make the first accepted film dearer still.
- My time outside the rounds: deciding to make the film, and writing the essay it belongs to.
