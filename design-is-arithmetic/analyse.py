"""Correlate the computed metrics with people's white-space ratings, and find the designs the metric misses worst.

Run after measure.py:  python3 analyse.py
Out: out/summary.json (every figure quoted in RESULTS.md and the essay), film-data.json

Ratings: data/human_abs_whitespace.csv (five crowd ratings per design, four for 25 originals, 1-10; "avg" is their mean) and
data/gpt_abs_whitespace.csv (GPT-4o, five runs at temperature 1, published by the dataset's authors).
"""
import csv, json, os
import numpy as np
from scipy import stats

HERE = os.path.dirname(os.path.abspath(__file__))
RNG = np.random.default_rng(15)
METRICS = ["white_space", "colourfulness", "complexity"]
DIRS = {"none": "org", "small": "size_small", "medium": "size_medium", "large": "size_large"}


def read(name):
    return list(csv.DictReader(open(os.path.join(HERE, name))))


def key(r):
    return (r["id"], r["perturbation"])


def icc1(scores):
    """One-way random-effects ICC: each design rated by raters drawn from a pool (raters differ by design).
    Unbalanced form, because 25 originals have four ratings instead of five (missing values are NaN)."""
    rows = [np.asarray([v for v in r if not np.isnan(v)]) for r in scores]
    n = len(rows)
    ks = np.array([len(r) for r in rows])
    N = ks.sum()
    grand = np.concatenate(rows).mean()
    means = np.array([r.mean() for r in rows])
    msb = (ks * (means - grand) ** 2).sum() / (n - 1)
    msw = sum(((r - r.mean()) ** 2).sum() for r in rows) / (N - n)
    k0 = (N - (ks ** 2).sum() / N) / (n - 1)
    return (msb - msw) / (msb + (k0 - 1) * msw), (msb - msw) / msb


def corr(x, y, groups, n_boot=4000):
    """Pearson r and Spearman rho, with a 95% interval from resampling whole templates."""
    x, y, groups = np.asarray(x, float), np.asarray(y, float), np.asarray(groups)
    r = stats.pearsonr(x, y)[0]
    rho = stats.spearmanr(x, y)[0]
    ug = np.unique(groups)
    idx = {g: np.where(groups == g)[0] for g in ug}
    boots = []
    for _ in range(n_boot):
        pick = np.concatenate([idx[g] for g in RNG.choice(ug, len(ug))])
        if np.std(x[pick]) > 0 and np.std(y[pick]) > 0:
            boots.append(stats.pearsonr(x[pick], y[pick])[0])
    lo, hi = np.percentile(boots, [2.5, 97.5])
    return {"r": round(float(r), 3), "r_ci95": [round(float(lo), 3), round(float(hi), 3)], "rho": round(float(rho), 3),
            "r2": round(float(r) ** 2, 3), "n": int(len(x))}


def ols(X, y):
    X1 = np.column_stack([np.ones(len(X)), X])
    beta, *_ = np.linalg.lstsq(X1, y, rcond=None)
    return beta


def cv_r2(X, y, groups):
    """Leave one template out: fit on the other templates, predict the held-out one."""
    X, y, groups = np.asarray(X, float), np.asarray(y, float), np.asarray(groups)
    pred = np.empty_like(y)
    for g in np.unique(groups):
        te = groups == g
        mu, sd = X[~te].mean(0), X[~te].std(0)
        b = ols((X[~te] - mu) / sd, y[~te])
        pred[te] = np.column_stack([np.ones(te.sum()), (X[te] - mu) / sd]) @ b
    return 1 - ((y - pred) ** 2).sum() / ((y - y.mean()) ** 2).sum()


def in_r2(X, y):
    X, y = np.asarray(X, float), np.asarray(y, float)
    b = ols(X, y)
    pred = np.column_stack([np.ones(len(X)), X]) @ b
    return 1 - ((y - pred) ** 2).sum() / ((y - y.mean()) ** 2).sum()


BASE = "experiments/e15-arithmetic-on-public-screens"
LIVE = "5bd9cec29259f9ba54ad4084"  # the design measured live in the film: four versions, people and measure in the same order


def live(template, keys, M, H, G, met, raters):
    out = []
    for p, d in DIRS.items():
        i = keys.index((template, p))
        out.append({"version": p, "screen": f"{BASE}/screens/{d}__{template}.png", "mask": f"{BASE}/out/mask-{d}-{template}.png",
                    "quadtree": f"{BASE}/out/quadtree-{d}-{template}.json", "white_space": round(float(M["white_space"][i]), 3),
                    "complexity": round(float(M["complexity"][i]), 1), "colourfulness": round(float(M["colourfulness"][i]), 1),
                    "people": round(float(H[i]), 2), "people_raw": [int(v) for v in raters[i] if not np.isnan(v)],
                    "gpt4o": round(float(G[i]), 2)})
    return {"template": template, "versions": out}


def main():
    human = {key(r): r for r in read("data/human_abs_whitespace.csv")}
    gpt = {key(r): r for r in read("data/gpt_abs_whitespace.csv")}
    met = {key(r): r for r in read("out/metrics.csv")}
    keys = sorted(met)
    assert set(keys) == set(human) == set(gpt), "the three files must cover the same 400 designs"

    def col(rows, name):
        return np.array([float(rows[k][name]) for k in keys])

    H = col(human, "avg")
    G = col(gpt, "avg")
    M = {m: col(met, m) for m in METRICS}
    groups = np.array([k[0] for k in keys])
    pert = np.array([k[1] for k in keys])
    orig = pert == "none"
    raters = np.array([[float(human[k][str(i)]) if human[k][str(i)] != "" else np.nan for i in range(5)] for k in keys])
    assert np.allclose(np.nanmean(raters, 1), H, atol=0.01), "the published avg must be the mean of the ratings present"

    def demean(v):
        out = v.copy()
        for g in np.unique(groups):
            out[groups == g] -= v[groups == g].mean()
        return out

    s = {"source": "GraphicDesignEvaluation (Haraguchi et al. 2024), commit 8666cb6, white-space ratings", "n_designs": len(keys),
         "n_templates": int(len(np.unique(groups)))}
    i1, ik = icc1(raters)
    i1o, iko = icc1(raters[orig])
    s["human_agreement"] = {
        "icc1_single_rater_all": round(i1, 3), "icc1_mean_of_5_all": round(ik, 3),
        "icc1_single_rater_originals": round(i1o, 3), "icc1_mean_of_5_originals": round(iko, 3),
        "designs_with_4_ratings": int(np.isnan(raters).any(1).sum()),
        "note": "ICC(1): one-way random effects, because each design's ratings came from different people (five each, four for 25 originals). sqrt(ICC of the mean of 5) is the highest correlation any measure could reach against these averages.",
        "ceiling_r_all": round(float(np.sqrt(ik)), 3), "ceiling_r_originals": round(float(np.sqrt(max(iko, 0))), 3),
    }
    s["rating_means"] = {p: round(float(H[pert == p].mean()), 2) for p in DIRS}
    s["metric_means"] = {m: {p: round(float(M[m][pert == p].mean()), 3) for p in DIRS} for m in METRICS}

    s["pooled_400"] = {m: corr(M[m], H, groups) for m in METRICS}
    s["pooled_400"]["gpt4o"] = corr(G, H, groups)
    s["originals_100"] = {m: corr(M[m][orig], H[orig], groups[orig]) for m in METRICS}
    s["originals_100"]["gpt4o"] = corr(G[orig], H[orig], groups[orig])
    s["within_template"] = {m: corr(demean(M[m]), demean(H), groups) for m in METRICS}
    s["within_template"]["gpt4o"] = corr(demean(G), demean(H), groups)
    s["within_template"]["note"] = "Each template's four versions minus that template's mean: can the measure rank the airy version of a design above its crowded version?"

    X = np.column_stack([M[m] for m in METRICS])
    s["three_metrics_together"] = {
        "pooled_in_sample_r2": round(float(in_r2(X, H)), 3),
        "pooled_cv_r2_leave_one_template_out": round(float(cv_r2(X, H, groups)), 3),
        "originals_in_sample_r2": round(float(in_r2(X[orig], H[orig])), 3),
        "originals_cv_r2_leave_one_out": round(float(cv_r2(X[orig], H[orig], groups[orig])), 3),
    }
    Xg = np.column_stack([X, G])
    s["three_metrics_plus_gpt4o"] = {
        "pooled_cv_r2_leave_one_template_out": round(float(cv_r2(Xg, H, groups)), 3),
        "originals_cv_r2_leave_one_out": round(float(cv_r2(Xg[orig], H[orig], groups[orig])), 3),
    }

    # How often does each measure order a template's four versions the way people did?
    def agree_order(v):
        taus = []
        for g in np.unique(groups):
            sel = groups == g
            t = stats.kendalltau(v[sel], H[sel])[0]
            if not np.isnan(t):
                taus.append(t)
        taus = np.array(taus)
        # same_direction: Kendall tau > 0, i.e. more pairs of versions ordered as people ordered them than against;
        # exact_order: tau = 1, all four versions in people's order.
        return {"templates": int(len(taus)), "mean_kendall_tau": round(float(taus.mean()), 3),
                "same_direction": int((taus > 0).sum()), "opposite_direction": int((taus < 0).sum()),
                "tied": int((taus == 0).sum()), "exact_order": int(np.isclose(taus, 1).sum())}
    s["order_within_template"] = {m: agree_order(M[m]) for m in METRICS}
    s["order_within_template"]["gpt4o"] = agree_order(G)
    P = list(DIRS)
    s["order_within_template"]["people_fall_steadily"] = int(sum(
        all(H[keys.index((g, P[j]))] >= H[keys.index((g, P[j + 1]))] for j in range(3)) for g in np.unique(groups)))

    # The film's scatter: white space against people's rating, all 400. A straight-line fit turns the measure into a
    # predicted rating; the misses are the designs furthest from it.
    b = ols(M["white_space"][:, None], H)
    pred = b[0] + b[1] * M["white_space"]
    resid = H - pred
    s["fit_white_space"] = {"intercept": round(float(b[0]), 3), "slope": round(float(b[1]), 3)}
    order = np.argsort(-np.abs(resid))
    misses = []
    for i in order:
        if len(misses) == 3:
            break
        if any(groups[i] == mm["template"] for mm in misses):
            continue  # one design per template, so the three misses are three different designs
        k = keys[i]
        misses.append({
            "template": k[0], "version": k[1], "file": met[k]["file"],
            "white_space": round(float(M["white_space"][i]), 3), "predicted_rating": round(float(pred[i]), 2),
            "people": round(float(H[i]), 2), "people_raw": [int(v) for v in raters[i] if not np.isnan(v)],
            "gpt4o": round(float(G[i]), 2), "error": round(float(resid[i]), 2),
            "colourfulness": round(float(M["colourfulness"][i]), 1), "complexity": round(float(M["complexity"][i]), 1),
        })
    s["misses"] = misses
    s["abs_error"] = {"median": round(float(np.median(np.abs(resid))), 2), "share_over_2_points": round(float((np.abs(resid) > 2).mean()), 3)}
    json.dump(s, open(os.path.join(HERE, "out", "summary.json"), "w"), indent=1)

    points = [{"file": met[k]["file"], "template": k[0], "version": k[1], "white_space": round(float(M["white_space"][i]), 3),
               "people": round(float(H[i]), 2), "gpt4o": round(float(G[i]), 2)} for i, k in enumerate(keys)]
    RNG2 = np.random.default_rng(29)
    film = {
        "source": "experiments/e15-arithmetic-on-public-screens (analyse.py, 29 Oct 2026)",
        "dataset": {"name": "GraphicDesignEvaluation", "authors": "Haraguchi, Inoue, Shimoda, Mitani, Uchida, Yamaguchi (2024)",
                    "url": "https://github.com/CyberAgentAILab/Graphic-design-evaluation", "commit": "8666cb6", "licence": "Apache-2.0",
                    "images": "VistaCreate banner templates, 100 originals and 300 versions with enlarged text; longest side 360 px"},
        "axes": {"x": "white space, share of the canvas with nothing drawn (0-1)", "y": "people's white-space rating, mean of 5 (1-10)"},
        "fit": s["fit_white_space"],
        "headline": {"pooled_r": s["pooled_400"]["white_space"]["r"], "originals_r": s["originals_100"]["white_space"]["r"],
                     "gpt4o_pooled_r": s["pooled_400"]["gpt4o"]["r"], "gpt4o_originals_r": s["originals_100"]["gpt4o"]["r"],
                     "human_ceiling_r": s["human_agreement"]["ceiling_r_all"]},
        "build_order": "originals first (100), then the enlarged-text versions (300), each set in a fixed shuffled order",
        "points": [points[i] for i in list(RNG2.permutation(np.where(orig)[0])) + list(RNG2.permutation(np.where(~orig)[0]))],
        "within_design": {"r": s["within_template"]["white_space"]["r"], "gpt4o_r": s["within_template"]["gpt4o"]["r"],
                          "templates_compared": s["order_within_template"]["white_space"]["templates"],
                          "ranking_agrees_more_than_disagrees": s["order_within_template"]["white_space"]["same_direction"],
                          "ranking_disagrees_more": s["order_within_template"]["white_space"]["opposite_direction"],
                          "exact_order": s["order_within_template"]["white_space"]["exact_order"],
                          "gpt4o_agrees_more_than_disagrees": s["order_within_template"]["gpt4o"]["same_direction"],
                          "gpt4o_exact_order": s["order_within_template"]["gpt4o"]["exact_order"],
                          "people_fall_steadily": s["order_within_template"]["people_fall_steadily"],
                          "note": "Agreement is Kendall's tau over a design's four versions: above 0 means more pairs of versions ordered as people ordered them than against."},
        "live": live(LIVE, keys, M, H, G, met, raters),
        "misses": [{**mm, "screen": f"{BASE}/screens/{mm['file'].replace('/', '__')}",
                    "original_screen": f"{BASE}/screens/org__{mm['template']}.png",
                    "original_people": round(float(H[keys.index((mm['template'], 'none'))]), 2),
                    "original_white_space": round(float(M['white_space'][keys.index((mm['template'], 'none'))]), 3)} for mm in misses],
    }
    json.dump(film, open(os.path.join(HERE, "film-data.json"), "w"), indent=1)
    print(json.dumps({k: s[k] for k in ["human_agreement", "rating_means", "pooled_400", "originals_100", "within_template", "three_metrics_together", "three_metrics_plus_gpt4o", "order_within_template", "abs_error"]}, indent=1))
    for mm in misses:
        print(mm)


if __name__ == "__main__":
    main()
