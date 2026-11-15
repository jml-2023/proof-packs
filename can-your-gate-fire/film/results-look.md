# Can it fire? still-check: nothing still for more than 3 s

2026-10-29 · `node film/still-check.mjs {input}`

| Input | Kind | Check said | Exit code | What it means |
|---|---|---|---|---|
| look-clean.mp4 | clean | pass | 0 | passes the clean input, as it should |
| freeze-6s.mp4 | planted | fail | 1 | fires |
| one-frame-106s.mp4 | planted | fail | 1 | fires |
| freeze-6s-grain-moving.mp4 | planted | pass | 0 | silent: it passed an input you know is bad |
| one-frame-106s-grain-moving.mp4 | planted | pass | 0 | silent: it passed an input you know is bad |
| freeze-6s-noise-moving.mp4 | planted | pass | 0 | silent: it passed an input you know is bad |

The check stayed green on at least one input you know is bad. Its passes on that kind of defect are not evidence.
