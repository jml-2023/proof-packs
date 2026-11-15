# openai/gpt-6-luna, 2026-10-29

Every question asked 5 times, word for word, with default settings. 45 of 45 calls gave a readable answer.

Chance that two runs of the same question disagree:

| Set | Per field | Facts | Judgements | Whole answer |
|---|---|---|---|---|
| decisions | 4.0% | 0.0% | 20.0% | 20.0% |
| screens | 15.0% | 0.0% | 20.0% | 40.0% |
| all | 7.1% | 0.0% | 20.0% | 26.7% |

Per question:

| Question | Answers | Whole answer | What changed |
|---|---|---|---|
| decisions/act-01 | 5 | 0.0% | nothing changed |
| decisions/tell-06 | 5 | 0.0% | nothing changed |
| decisions/ask-05 | 5 | 0.0% | nothing changed |
| decisions/ask-11 | 5 | 40.0% | decision TELL 4, ACT 1 |
| decisions/tell-02 | 5 | 40.0% | decision TELL 4, ACT 1 |
| decisions/ask-07 | 5 | 40.0% | decision TELL 1, ACT 4 |
| screens/a | 5 | 60.0% | biggest_problem missing_information 2, none 3; ready_to_ship no 2, yes 3 |
| screens/a-submit | 5 | 0.0% | nothing changed |
| screens/b | 5 | 60.0% | main_action_clear yes 2, no 3 |

Screen ratings:

| Screen | Mean | Range | All ratings |
|---|---|---|---|
| a | 8.60 | 8 to 9 | 8, 9, 9, 8, 9 |
| a-submit | 6.80 | 6 to 7 | 7, 6, 7, 7, 7 |
| b | 5.40 | 4 to 6 | 6, 4, 6, 5, 6 |

Change from a-submit to a: 1.80. With one rating of each, a came out higher in 100.0% of pairings, the same in 0.0% and lower in 0.0%.

Cost reported by the endpoint: $0.0063 for 45 calls.
