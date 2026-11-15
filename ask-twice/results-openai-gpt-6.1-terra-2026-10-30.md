# openai/gpt-6.1-terra, 2026-10-30

Every question asked 10 times, word for word, with default settings. 90 of 90 calls gave a readable answer.

Chance that two runs of the same question disagree:

| Set | Per field | Facts | Judgements | Whole answer |
|---|---|---|---|---|
| decisions | 5.0% | 0.0% | 24.8% | 24.8% |
| screens | 7.2% | 0.0% | 9.6% | 22.2% |
| all | 5.6% | 0.0% | 15.7% | 24.0% |

Per question:

| Question | Answers | Whole answer | What changed |
|---|---|---|---|
| decisions/act-01 | 10 | 0.0% | nothing changed |
| decisions/tell-06 | 10 | 35.6% | decision TELL 8, ACT 2 |
| decisions/ask-05 | 10 | 20.0% | decision ASK 9, TELL 1 |
| decisions/ask-11 | 10 | 46.7% | decision TELL 3, ASK 7 |
| decisions/tell-02 | 10 | 46.7% | decision ACT 7, TELL 3 |
| decisions/ask-07 | 10 | 0.0% | nothing changed |
| screens/a | 10 | 20.0% | biggest_problem missing_information 9, none 1; ready_to_ship no 9, yes 1 |
| screens/a-submit | 10 | 46.7% | main_action_clear yes 3, no 7 |
| screens/b | 10 | 0.0% | nothing changed |

6 of 9 questions changed. Had you asked each of them only twice, you'd have seen the change 35.9% of the time on average; three times, 53.9%; five times, 75.5%.

The same answer every time, but not the one the label gives (a label can be a wording choice, so read the question before you call the model wrong):

- decisions/tell-02, can_be_undone: "no" 10 times out of 10; the label says "yes"
- decisions/ask-07, decision: "ACT" 10 times out of 10; the label says "ASK"
- decisions/ask-07, can_be_undone: "no" 10 times out of 10; the label says "yes"

Screen ratings:

| Screen | Mean | Range | All ratings |
|---|---|---|---|
| a | 7.20 | 7 to 9 | 7, 7, 9, 7, 7, 7, 7, 7, 7, 7 |
| a-submit | 6.00 | 6 to 6 | 6, 6, 6, 6, 6, 6, 6, 6, 6, 6 |
| b | 5.00 | 5 to 5 | 5, 5, 5, 5, 5, 5, 5, 5, 5, 5 |

Change from a-submit to a: 1.20. With one rating of each, a came out higher in 100.0% of pairings, the same in 0.0% and lower in 0.0%.

Cost reported by the endpoint: $0.0851 for 90 calls.
