#!/usr/bin/env python3
"""Re-scores a saved trial with a few extra word rules, applied to every model alike, to show how much of a gap
between two models comes from the scorer rather than the hearing.

    python3 -I rescore.py runs/2026-10-30/public/results.json steps/transcribe.py cases/librispeech

The step's scorer was written around one model's habits. A model that writes "St." for "Saint", "Mr." for "Mister"
or keeps the accent in "Vallière" loses words it heard correctly. The rules here are the ones the 30 October public
run called for; add your own. It prints the pooled word error rate and the share of sends at 2% or less, before and
after, for each model, and writes nothing.
"""
import difflib
import importlib.util
import json
import sys
import unicodedata
from collections import defaultdict

ABBREVIATIONS = {"st": "saint", "mr": "mister", "mrs": "missus", "dr": "doctor"}


def load(path):
    spec = importlib.util.spec_from_file_location("step", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main():
    results, step = json.load(open(sys.argv[1])), load(sys.argv[2])
    cases = {}
    for c in step.cases(sys.argv[3]) if len(sys.argv) > 3 else []:
        cases[c["id"]] = c["text"]

    def extra(s):
        # Drop accents only ("Vallière" -> "Valliere"); apostrophes and dashes are left for the step's own rules.
        s = "".join(c for c in unicodedata.normalize("NFKD", s) if unicodedata.category(c) != "Mn")
        return [ABBREVIATIONS.get(w, w) for w in step.words(s)]

    def count(gold, heard, rules):
        a, b = (extra(gold), extra(heard)) if rules else (step.words(gold), step.words(heard))
        ops = difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes()
        return sum(max(i2 - i1, j2 - j1) for op, i1, i2, j1, j2 in ops if op != "equal"), len(a)

    gold = {c["id"]: None for c in results["meta"]["cases"]}
    table = defaultdict(lambda: {"before": [0, 0, 0, 0], "after": [0, 0, 0, 0]})
    for r in results["calls"]:
        if r["outcome"] != "ok":
            continue
        text = cases.get(r["case"]) or gold_text(results, r["case"])
        for label, rules in (("before", False), ("after", True)):
            e, n = count(text, r["text"], rules)
            t = table[r["model"]][label]
            t[0] += e; t[1] += n; t[2] += e / max(1, n) <= step.PASS_AT; t[3] += 1
    print("| Model | Word error rate, the step's scorer | With the extra rules | Sends at 2% or less, before | After |")
    print("|---|---|---|---|---|")
    for m in results["meta"]["models"]:
        b, a = table[m]["before"], table[m]["after"]
        print(f"| {m} | {100 * b[0] / b[1]:.1f}% | {100 * a[0] / a[1]:.1f}% | {b[2]} of {b[3]} | {a[2]} of {a[3]} |")


def gold_text(results, case_id):
    sys.exit(f"Pass the case folder as the third argument, so the script text for {case_id} can be read.")


if __name__ == "__main__":
    main()
