"""How much do people agree with each other, and does a measure agree with them as well as one more person would?

Run after measure.py (it reads out/metrics.csv):  python3 agreement.py
Out: out/agreement.json

The bar. A measure is good enough to trust as a judge when it follows people's ratings about as closely as people
follow each other. So for each design, one of its ratings is set aside as "one more person" and compared with the
average of the design's other ratings; the measures are compared with that same average. This is repeated with each
rating set aside in turn and averaged. The data has no rater identities, so "one more person" is simply another rating
of the same design. Gaps between a measure and one more person get a 95% interval from resampling whole templates.

The ceiling. No measure can follow the average of four or five ratings perfectly, because part of that average is
rater noise. The ceiling is the square root of the share of the spread that isn't noise. analyse.py works it out
across all 400 and among the originals; this script also works it out within one design (each template's four
versions minus that template's mean), treating the people who rated a template's versions as independent. If they
overlapped, the true ceiling within a design is higher.

Three views, as in analyse.py: within one design, all 400 designs, and the 100 originals.
"""
import csv, importlib.util, json, os
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("analyse", os.path.join(HERE, "analyse.py"))
analyse = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(analyse)  # for its icc1(), so the two ceilings analyse.py reports come out identical here
MEASURES = ["white_space", "complexity", "colourfulness"]
# More squares or more colour came with lower white-space ratings in every view of summary.json, so these two enter
# with their sign flipped: every r below is then positive when a measure agrees with people, and every gap reads the same way.
FLIPPED = ["complexity", "colourfulness"]
DRAWS = 1000
SEED = 30


def load():
    human = {(r["id"], r["perturbation"]): r for r in csv.DictReader(open(os.path.join(HERE, "data", "human_abs_whitespace.csv")))}
    gpt = {(r["id"], r["perturbation"]): float(r["avg"]) for r in csv.DictReader(open(os.path.join(HERE, "data", "gpt_abs_whitespace.csv")))}
    met = {(r["id"], r["perturbation"]): r for r in csv.DictReader(open(os.path.join(HERE, "out", "metrics.csv")))}
    keys = sorted(human)
    assert set(keys) == set(gpt) == set(met), "the three files must cover the same 400 designs"
    ratings = np.array([[float(human[k][str(i)]) if human[k][str(i)] != "" else np.nan for i in range(5)] for k in keys])
    preds = {m: np.array([float(met[k][m]) for k in keys]) * (-1 if m in FLIPPED else 1) for m in MEASURES}
    preds["gpt4o"] = np.array([gpt[k] for k in keys])
    return keys, ratings, preds


def noise_of_means(ratings):
    """Variance that rater noise adds to each design's mean rating, from the pooled spread of the designs' own ratings."""
    k = (~np.isnan(ratings)).sum(1)
    means = np.nanmean(ratings, 1)
    msw = np.nansum((ratings - means[:, None]) ** 2) / (k.sum() - len(ratings))
    return means, msw / k


def ceilings(ratings, template, original):
    # All 400 and the originals: analyse.py's one-way ICC of the mean rating, so the figures match summary.json.
    out = {"all_400": analyse.icc1(ratings)[1], "originals_100": analyse.icc1(ratings[original])[1]}
    # Within one design there is no standard ICC, so split the spread of each version around its template's mean
    # into rater noise and the rest. Across all 400 the same split gives 0.792 against the ICC's 0.793.
    means, noise = noise_of_means(ratings)
    within = np.empty_like(means)
    noise_within = np.empty_like(means)
    for t in np.unique(template):
        s = template == t
        n = s.sum()
        within[s] = means[s] - means[s].mean()
        # removing a template's mean also removes part of the noise: Var(e_i)(1 - 2/n) + sum_j Var(e_j) / n^2
        noise_within[s] = noise[s] * (1 - 2 / n) + noise[s].sum() / n ** 2
    v_within = (within ** 2).mean()
    out["within_design"] = (v_within - noise_within.mean()) / v_within
    return {view: {"reliability": round(float(r), 3), "ceiling_r": round(float(np.sqrt(max(r, 0))), 3)} for view, r in out.items()}


def one_more_person(rows, ratings, others, preds, template, original, view):
    """Mean over the held-out rating j of r(one rating, rest) and r(measure, rest)."""
    res = {"one_more_person": []}
    res.update({m: [] for m in preds})
    for j in range(5):
        single = ratings[rows, j]
        rest = others[rows, j]
        has = ~np.isnan(single)
        group = template[rows]
        vals = {"one_more_person": single.copy(), **{m: preds[m][rows].copy() for m in preds}}
        if view == "within_design":
            # only templates whose four versions all have a j-th rating, each demeaned within its template
            keep = np.array([has[group == t].all() for t in group])
            rest = rest.copy()
            for t in np.unique(group[keep]):
                q = (group == t) & keep
                rest[q] -= rest[q].mean()
                for v in vals.values():
                    v[q] -= v[q].mean()
        elif view == "all_400":
            keep = has
        else:
            keep = has & original[rows]
        for name, v in vals.items():
            res[name].append(float(np.corrcoef(v[keep], rest[keep])[0, 1]))
    return {name: float(np.mean(v)) for name, v in res.items()}


def main():
    keys, ratings, preds = load()
    template = np.array([k[0] for k in keys])
    original = np.array([k[1] == "none" for k in keys])
    templates = np.unique(template)
    index = {t: np.where(template == t)[0] for t in templates}
    # others[i, j]: the average of design i's ratings with rating j left out
    others = np.array([[np.nanmean(np.delete(ratings[i], j)) for j in range(5)] for i in range(len(keys))])
    rng = np.random.default_rng(SEED)
    out = {"source": "data/ (GraphicDesignEvaluation, Haraguchi et al. 2024, commit 8666cb6) and out/metrics.csv",
           "ceilings": ceilings(ratings, template, original),
           "ceilings_note": "all_400 and originals_100 should match analyse.py's ceiling_r_all (0.89) and ceiling_r_originals (0.38)",
           "one_more_person": {}}
    for view in ("within_design", "all_400", "originals_100"):
        all_rows = np.arange(len(keys))
        point = one_more_person(all_rows, ratings, others, preds, template, original, view)
        gaps = {m: [] for m in preds}
        for _ in range(DRAWS):
            rows = np.concatenate([index[t] for t in rng.choice(templates, len(templates))])
            b = one_more_person(rows, ratings, others, preds, template, original, view)
            for m in preds:
                gaps[m].append(b[m] - b["one_more_person"])
        out["one_more_person"][view] = {
            "one_more_person_r": round(point["one_more_person"], 4),
            **{m: {"r_against_the_others": round(point[m], 4),
                   "minus_one_more_person": round(point[m] - point["one_more_person"], 4),
                   "minus_one_more_person_ci95": [round(float(x), 4) for x in np.percentile(gaps[m], [2.5, 97.5])]}
               for m in preds},
        }
    out["one_more_person_note"] = (f"r of one rating, or of a measure, against the average of the design's other ratings, averaged over which "
                                   f"rating is held out; {' and '.join(FLIPPED)} enter with their sign flipped, so a positive r means agreement; "
                                   f"95% intervals on the gaps from {DRAWS} resamples of whole templates, seed {SEED}.")
    os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
    json.dump(out, open(os.path.join(HERE, "out", "agreement.json"), "w"), indent=1)
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
