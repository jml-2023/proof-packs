# The film example

My film pipeline fails a film when nothing on screen moves for more than three seconds. `still-check.mjs` is a stand-alone copy of that check: it shrinks each frame to 320 px wide in grey, takes the largest change of any pixel from the frame before, calls the frame moving when that change is at least 0.006 of full scale, and fails the film when the longest still run is over 3 seconds. On the 12 files I tested, it reported the same longest still run as the pipeline's own check, to the hundredth of a second.

## What I ran

The film is my 106-second replay for "Did the model even look at the picture?" (1920 × 1080, 30 fps). Published at https://jerrylieveld.substack.com/p/a-gate-that-cannot-fire From it I made five planted copies, three of them with `plant.sh`:

From the pack's folder:

```
sh film/plant.sh freeze look.mp4 25 6 freeze-6s.mp4           # the picture held for 6 s from 25 s
sh film/plant.sh still  look.mp4 25 one-frame-106s.mp4        # the frame at 25 s for the whole film
sh film/plant.sh noisy  look.mp4 25 6 freeze-6s-noise-moving.mp4
```

The two grain copies (`freeze-6s-grain-moving.mp4`, `one-frame-106s-grain-moving.mp4`) lay my film kit's own grain texture over the held frames at 8%, moving every two frames, as the kit does on every frame of every film. `plant.sh noisy` is the general version for your films: fine moving noise over the hold.

Then:

```
node can-it-fire.mjs --check "node film/still-check.mjs {input}" --clean look.mp4 \
  --planted freeze-6s.mp4 --planted one-frame-106s.mp4 \
  --planted freeze-6s-grain-moving.mp4 --planted one-frame-106s-grain-moving.mp4 \
  --planted freeze-6s-noise-moving.mp4 --out film/results-look
```

## What came back

| Input | Check said | What it means |
|---|---|---|
| the film, untouched | pass | passes the clean input, as it should |
| 6 s hold | fail | fires |
| one frame for 106 s | fail | fires |
| 6 s hold, grain still moving | pass | silent |
| one frame for 106 s, grain still moving | pass | silent |
| 6 s hold, fine noise moving | pass | silent |

The check fires on a picture that stops completely, and stays green when anything as fine as grain keeps moving over a stuck picture. On the untouched film it reports the longest still stretch as 0.03 s, one frame, because the grain moves every two frames. ffmpeg's freeze detector finds 12 held stretches longer than 3 s in the same film, up to 8.4 s. They are authored holds, a screen held while the narration explains it, but the check can't tell them from grain, so it can't see a stuck picture either. The full run, with the two freeze checks from my video lane, is in `experiments/e14-gate-can-fire/RESULTS.md`.

## On your own film

1. Make the planted copies with `plant.sh`. Use a start time where your film is busy, and one where it's quiet.
2. If your film has grain, a texture, a moving background or a logo animation, use `noisy` as well as `freeze`, so the fault sits under what is always moving.
3. Run `can-it-fire.mjs` with your own check in `--check`, or with `still-check.mjs` to see what this one catches on your film.
4. `plant.sh stall` stops the picture for a few frames and then resumes; `plant.sh shake` shakes the whole frame. Use them for checks that claim to catch stutter or camera shake.
