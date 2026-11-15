# Can your gate fire? A checklist

Use it for any automatic check whose pass you rely on: a test, a quality gate, a monitor, a review rule. A check you have never seen fail may be unable to.

1. **Say what it must catch**, in one sentence a person could test: "a picture that stops for more than three seconds", not "motion quality".
2. **Write down what has to be true before it can fire.** A minimum length, a field that must be present, a threshold the input has to cross, a window it looks inside, a time limit, a fallback when it can't measure.
3. **Measure how often your real work meets that condition.** If the honest answer is "almost never", the check is decoration, however green it looks.
4. **Make a planted case.** Copy a real input and put in one fault whose effect you know. Keep the untouched original as the clean control.
5. **Run the check on both.** It must pass the clean input and fail the planted one. If it fails the clean one too, it's a false alarm. If it passes the planted one, its passes say nothing about that fault.
6. **Plant the fault where it's hard to see**, as well as where it's easy: outside the conditions in step 2, and under anything that is always there in your work, such as grain, a logo, a default value or a background process.
7. **Keep "not measured" apart from "pass".** A check that can't run, times out or has nothing to look at should say so, not report a pass.
8. **Keep the planted case next to the check**, and run it again whenever the check, its threshold or the work it looks at changes.
9. **Read a long run of passes as a question.** If a check has never failed, find out whether it can.
