# Two films, one script: the method card

A one-change pair shows what a single change did to a generated film. Render the same script twice with exactly one thing different, cut the same seconds from each, match their loudness, and play them one after the other. The person who owns the film decides which one ships. Automatic checks and model judges point to places worth checking; they don't decide.

It works for any change to a generated film: a new voice or voice model, a different take, a camera move, a music bed, a caption style, a new renderer.

## Before you render

1. Write the one change as a sentence, for instance "the narration is converted through voice model X" or "the stage sway is removed".
2. Freeze everything else: script, picture, music, mix settings, and the seed if your tool has one.
3. Write down, before either version exists, what should be better if the change works and which measure you'll look at. Include "no worse than the version it replaces", line by line or scene by scene. A floor alone lets a worse version through.
4. If someone asked you to remove something, remove it. Putting something else in its place is a second change, and it needs its own pair.

## Render and cut

5. Render both versions through the same pipeline. Keep both files and their receipts or hashes.
6. List everything else that moved between the two renders: the length, the scene timing, the takes or reads, the music edit, the loudness. Some of it follows from the change: if each scene is timed to its line, a voice that speaks faster shortens the scenes, and a music edit that has to end on the track's last hit gets cut again. If anything moved, the pair now judges more than the one change. Compare the change on its own first, on the same lines with nothing else around them and within 0.5 LU, and then the whole films.
7. Pick the stretch where the change should matter most. Use per-line or per-scene measures to find it, and prefer a stretch where nothing else differs.
8. Cut 8–12 seconds from each, starting before the first word and ending after the last. If the change moved the timing, line the cuts up on the same words, not the same timestamps.
9. Measure each cut's loudness and turn the louder one down until they are within 0.5 LU. The louder version tends to sound better for that reason alone.
10. Join them with half a second of the film's ground colour between, and caption each one plainly: which version, and what is different about it.

```
# Loudness of each cut (integrated LUFS); START and LEN are each cut's start and length in seconds
ffmpeg -ss START_A -t LEN_A -i a.mp4 -vn -af ebur128 -f null - 2>&1 | grep -E '^ +I:'
ffmpeg -ss START_B -t LEN_B -i b.mp4 -vn -af ebur128 -f null - 2>&1 | grep -E '^ +I:'

# Join them with half a second of ground colour between, B turned down by the difference (here 0.1 dB).
# Set the colour, size, frame rate and sample rate to your film's; ffprobe shows them.
ffmpeg -ss START_A -t LEN_A -i a.mp4 -ss START_B -t LEN_B -i b.mp4 \
  -f lavfi -t 0.5 -i "color=c=0xE7EEEC:s=1920x1080:r=30" -f lavfi -t 0.5 -i "anullsrc=r=48000:cl=stereo" \
  -filter_complex "[1:a]volume=-0.1dB[b];[0:v][0:a][2:v][3:a][1:v][b]concat=n=3:v=1:a=1[v][a]" \
  -map "[v]" -map "[a]" -c:v libx264 -crf 18 -c:a aac pair.mp4
```

## Decide

11. Watch or listen to the pair yourself, at the level you'd publish at, as many times as you need. Decide: A, B or neither, and write one sentence on why.
12. Run whatever checks and model judges you like on both versions, and record what they say as leads. A lead counts once a measure or your own eye or ear confirms it. Before you rely on a model judge, give it a version you have already judged and a copy with faults planted at known times, and see whether it finds them.
13. If you change your mind later, add a new entry. Don't overwrite the old one.

## Results template

Copy this block for each pair.

```
Pair: [film], [date]
The one change:
Frozen:
What else moved (length, timing, takes, music edit, loudness):
Version without the change (file, build or hash):
Version with the change (file, build or hash):
Expected if the change works (written before rendering):
The change on its own (same lines, within 0.5 LU):
Cut: without from __ s, with from __ s, __ s each; lines or scene:
Why this stretch:
Loudness: without __ LUFS, with __ LUFS; matched to within __ LU

| Measure or judge | Without | With | Lead, confirmed or missed |
|------------------|---------|------|---------------------------|
|                  |         |      |                           |

Decision: without / with / neither
Why, in one sentence:
Decided by:
```

## Example: a new voice for my ask-twice film, 30 October 2026

This pair broke step 2, and step 6 comes from it.

- The one change: the narration voice, from a Seed Audio clone of my voice made from a 31-second clip to an ElevenLabs v4 clone made from a 2-minute sample.
- Frozen: the script (22 lines, 405 words), the code that draws the scenes, the mix settings (music held 12 LU under the voice) and the loudness (−16.1 LUFS).
- What else moved: the read, from one read with 6 lines swapped in from 4 other reads to one read of the whole script; the length, from 164.6 s to 142.4 s, because each scene is timed to its line and 21 of the 22 scenes got shorter; and the music edit, cut again to end on the track's last hit. The two edits match for the first 129.7 s. After that the first film plays 14.1 s of the track twice and the second skips 8.1 s.
- Without the change: the first film, sha256 `4296cf09…`, built 30 October at 03:02 UTC.
- With the change: the second film, sha256 `00c61c76…`, built at 06:23 UTC.
- Expected if the change works: not written down before rendering. My complaint about the first film stood in for it: "The last part my voice is different and of cracking. and the first part sounds a bit depressing."
- The change on its own: the same 22 lines read by six clones of my voice, voice only, on one listening page. The Seed clip measured −18.4 LUFS and the v4 clip −18.8, within 0.5 LU. A professional clone added later measured −22.3, 3.5 LU quieter than v4, because the script that cut its clips skipped the levelling.
- Cut: none before deciding. The change touched every line, so I listened to full reads on the page and then watched the whole new film.
- The commands above, tested on this pair afterwards: lines 19 and 20, the Seed voice's two worst, cut on the same words, 7.54 s from 135.216 s in the first film and 6.292 s from 118.329 s in the second. That is shorter than step 8 asks, to keep to the same two lines. The cuts measured −16.6 and −16.5 LUFS, so the second came down 0.1 dB, and in the joined clip, with half a second of ground colour between, both measure −16.6.

| Measure or judge | Without (Seed) | With (v4) | Lead, confirmed or missed |
|---|---|---|---|
| Likeness to my recordings, typical line (median of 22) | 0.583 | 0.575 | Measured; about the same |
| The same, worst line | 0.392 (line 19) | 0.503 (line 19) | Measured; the Seed voice's two worst lines are near the end, where I heard the crack |
| Pitch movement between low and high notes (my recordings: about 5.2 semitones) | 5.1 semitones | 9.9 on the page, 9.7 in the film | Lead, not confirmed: I don't know if it's what I liked |
| Film receipt, 14 checks | pass | pass | Missed: no check on likeness |
| My ear, voice only, on the page | – | "sounds the best" | Chose the voice |
| My eye and ear, the whole film | "cracking" in the last part | "much better" | Chose the film |

- Decision: with the change.
- Why: "The voice in the video is now much better."
- Decided by: me.
- What it can't say: how much of "much better" was the voice, and how much the pace, the single read or the music edit.

## Limits

A pair shows what one change did on one stretch of one film. If the change touches the whole film, cut more than one stretch, starting with the worst by your measures. When something besides the one change moved and you couldn't stop it, the pair tells you which film to keep, not which change made it better. The card records your decision; it doesn't make it for you.
