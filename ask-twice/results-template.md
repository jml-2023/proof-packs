# [model], [date]

Every question asked [n] times, word for word, with [default settings / temperature 0 and seed 1]. [answered] of [calls] calls gave a readable answer.

For each question, take every pair of its answers and count the pairs that differ. A pair differs on the whole answer if any yes/no or choice field differs. With five answers there are 10 pairs per question; with ten, 45.

Chance that two runs of the same question disagree:

| Set | Per field | Facts | Judgements | Whole answer |
|---|---|---|---|---|
| decisions | | | | |
| screens | | | | |
| all | | | | |

Per question:

| Question | Answers | Whole answer | What changed |
|---|---|---|---|
| decisions/act-01 (clear-cut) | | | |
| decisions/tell-06 (clear-cut) | | | |
| decisions/ask-05 | | | |
| decisions/ask-11 | | | |
| decisions/tell-02 | | | |
| decisions/ask-07 | | | |
| screens/a | | | |
| screens/a-submit | | | |
| screens/b | | | |

Asking fewer times: for each question that changed, how often would two of its answers, picked at random, have differed? Three? Five? [ ]

The same answer every time, but not the one the label gives (`truth` for facts, `rule` for the decision):

- [question, field: answer, times; label]

Screen ratings:

| Screen | Mean | Range | All ratings |
|---|---|---|---|
| a ("Book this table") | | | |
| a-submit ("Submit") | | | |
| b | | | |

Change from "Submit" to "Book this table": [ ]. With one rating of each, how often was "Book this table" higher? [ ]

Comparing two files (two models, or one model on two dates):

| Pairs of answers | Whole answer | Per field | Facts | Judgements |
|---|---|---|---|---|
| Two runs of [first] | | | | |
| Two runs of [second] | | | | |
| [first] against [second] | | | | |

Which questions changed, and were they the ones you'd call close?

Did any fact change?

Is the rating change bigger than the spread of ratings for one unchanged screen?

Did the two files disagree with each other more often than each disagreed with itself?
