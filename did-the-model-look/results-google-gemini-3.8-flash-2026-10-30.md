# google/gemini-3.8-flash, 2026-10-30

Mean probability of yes over 3 calls, and how many answers were right. An answer of 0.5 or more counts as yes.

| | green_book | deposit_48 | red_cancel | time_2030 | Right |
|---|---|---|---|---|---|
| screen A attached | 1 | 1 | 0 | 0 | 12 of 12 |
| screen B attached (every answer flips) | 0 | 0 | 1 | 1 | 12 of 12 |
| no image attached | 0.5 | 0.83 | 0.5 | 0.83 | 6 of 12 |

The answers followed the picture: every answer was right on both screens. A model that saw neither screen would pass by luck at most 1 time in 64.

With no image: 6 of 12 answers matched screen A; 2 of 3 calls gave at least one answer of 0.9 or more, or 0.1 or less, about a picture it didn't have.

Cost reported by the endpoint: $0.0379 for 9 calls.
