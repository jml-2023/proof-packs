# Gate card

One card per check. Keep it beside the check, and fill in a new result row whenever the check, its threshold or the work it looks at changes.

## The check

- **Name:**
- **What it must catch** (one sentence a person could test):
- **What a fail does** (blocks, warns, only reports):
- **Command** (exit 0 = pass, 1 = fail):

## What it needs before it can fire

- **Condition:**
- **How often real work meets it** (measured on what, when):

## Planted cases

| Planted input | The one fault in it | Made from (clean control) | Where the fault is |
|---|---|---|---|
| | | | |

## Results

| Date | Clean input | Planted input | Fired? | Run by |
|---|---|---|---|---|
| | pass / fail / not measured | pass / fail / not measured | fires / silent / false alarm / not measured | |

## Example: my film pipeline's motion check, 29 October 2026

- **What it must catch:** nothing moving on screen for more than 3 seconds.
- **What a fail does:** blocks the film.
- **Condition:** a frame counts as moving when any pixel changes by at least 0.006 of full scale at 320 px wide.
- **How often real work meets it:** on my 106-second replay film, 83% of frames count as moving, because the film's grain moves every two frames.

| Planted input | Fired? |
|---|---|
| a 6-second hold | fires |
| a single frame for 106 seconds | fires |
| the same 6-second hold, grain still moving | silent |
| the same single frame, grain still moving | silent |
