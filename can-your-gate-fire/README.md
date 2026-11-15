# Can your gate fire? The instrument pack

A check that has never failed may be unable to. This pack tests whether a check can fail at all. You give it the check, a clean input you know is good, and one or more inputs where you planted a fault on purpose. It runs the check on each and records whether it fired. A check counts as evidence for a fault only after it has failed an input you know has that fault and passed one you know is clean.

It works with any check you can run from a command line: a test, a linter, a script that scores a file, a quality gate in a build. The film folder has the example from the essay: a stand-alone copy of my film pipeline's motion check, which passed a single frame shown for 106 seconds as long as the film's grain kept moving.

## What's in it

- `can-it-fire.mjs`: the runner. It needs Node 18 or later and nothing else.
- `checklist.md`: the one-page checklist from the essay.
- `gate-card.md`: a template for keeping each check's planted case beside it.
- `film/plant.sh`: makes a copy of any film with one known fault in it: a frozen stretch, the same stretch with moving noise over it, a single frame for the whole film, a short stall, or a shake. Needs ffmpeg.
- `film/still-check.mjs`: a film check you can run with only ffmpeg. It fails a film when nothing moves for more than 3 seconds, measured as my film pipeline's motion check measures it.
- `film/results-look.md` and `.json`: what the runner recorded on my film.
- `film/README.md`: the film example, step by step.

## Run it

Your check has to be a command that exits with 0 when the input passes and 1 when it fails. Put `{input}` where the file name goes:

```
node can-it-fire.mjs --check "python3 my_check.py {input}" --clean good.csv --planted missing-column.csv --planted wrong-dates.csv
```

If your check uses other exit codes, say which ones mean pass and which mean fail:

```
node can-it-fire.mjs --check "./lint {input}" --pass-codes 0 --fail-codes 1,2 --clean ok.json --planted broken.json
```

Any other exit code, a crash, a missing file or a run that takes longer than `--timeout` seconds (600 by default) is recorded as "could not run", never as a pass. The runner writes `can-it-fire-results.md` and `.json` (change the name with `--out`), and exits 0 only when the check passed the clean input and failed every planted one.

## Read the result

- **Fires**: the check failed the planted input and passed the clean one. Its passes now mean something for that fault.
- **Silent**: the check passed an input you know is bad. For that fault, a pass from this check isn't evidence. Find out what it needs before it can fire (see the checklist), or plant the fault somewhere else to see where its blind spot ends.
- **Fails the clean input as well**: a false alarm. Fix that first; a fail proves nothing while it also fails good inputs.
- **Not measured**: the check didn't run. That is a separate result from a pass, and the runner keeps it separate.

## Make a planted input

Start from a real input, not a made-up one, and change one thing whose effect you know. Keep the original as the clean control. Plant the fault where it is easiest to see and where it is hardest: inside and outside the conditions the check needs, and under anything that is always present in your work, such as grain, a watermark, a header row or a background job. For films, `film/plant.sh` does this; see `film/README.md`.

## Limits

The runner tells you whether a check fired on the inputs you gave it. It can't tell you whether those inputs are the faults that matter, or how often your real work meets the conditions a check needs. That needs the questions in `checklist.md`. One planted case per fault shows a check can fire; it doesn't measure how reliably it does.
