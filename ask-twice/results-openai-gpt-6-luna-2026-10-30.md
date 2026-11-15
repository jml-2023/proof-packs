# openai/gpt-6-luna, 2026-10-30

Every question asked 10 times, word for word, with default settings. 90 of 90 calls gave a readable answer.

Chance that two runs of the same question disagree:

| Set | Per field | Facts | Judgements | Whole answer |
|---|---|---|---|---|
| decisions | 3.6% | 0.0% | 17.8% | 17.8% |
| screens | 8.0% | 0.0% | 10.6% | 23.7% |
| all | 4.8% | 0.0% | 13.5% | 19.8% |

Per question:

| Question | Answers | Whole answer | What changed |
|---|---|---|---|
| decisions/act-01 | 10 | 0.0% | nothing changed |
| decisions/tell-06 | 10 | 0.0% | nothing changed |
| decisions/ask-05 | 10 | 0.0% | nothing changed |
| decisions/ask-11 | 10 | 20.0% | decision ASK 1, TELL 9 |
| decisions/tell-02 | 10 | 35.6% | decision ACT 8, TELL 2 |
| decisions/ask-07 | 10 | 51.1% | decision TELL 2, ACT 7, ASK 1 |
| screens/a | 10 | 20.0% | biggest_problem none 9, missing_information 1; ready_to_ship yes 9, no 1 |
| screens/a-submit | 10 | 0.0% | nothing changed |
| screens/b | 10 | 51.1% | main_action_clear no 2, yes 8; biggest_problem conflicting_actions 9, button_label 1 |

5 of 9 questions changed. Had you asked each of them only twice, you'd have seen the change 35.6% of the time on average; three times, 51.0%; five times, 72.2%.

The same answer every time, but not the one the label gives (a label can be a wording choice, so read the question before you call the model wrong):

- decisions/tell-02, can_be_undone: "no" 10 times out of 10; the label says "yes"
- decisions/ask-07, can_be_undone: "no" 10 times out of 10; the label says "yes"

Screen ratings:

| Screen | Mean | Range | All ratings |
|---|---|---|---|
| a | 8.70 | 7 to 9 | 9, 9, 9, 9, 9, 8, 9, 7, 9, 9 |
| a-submit | 6.90 | 6 to 7 | 6, 7, 7, 7, 7, 7, 7, 7, 7, 7 |
| b | 5.80 | 5 to 6 | 5, 6, 6, 5, 6, 6, 6, 6, 6, 6 |

Change from a-submit to a: 1.80. With one rating of each, a came out higher in 91.0% of pairings, the same in 9.0% and lower in 0.0%.

Cost reported by the endpoint: $0.0127 for 90 calls.
