"""Compute three published-style layout metrics on the GraphicDesignEvaluation (GDE) designs.

Data: Haraguchi et al., "Can GPTs Evaluate Graphic Design Based on Design Principles?" (SIGGRAPH Asia 2024 TC),
https://github.com/CyberAgentAILab/Graphic-design-evaluation, Apache-2.0, pinned at commit 8666cb6.
The 400 designs with white-space ratings are the 100 originals ("org") and their three font-size perturbations
("size_small", "size_medium", "size_large").

Run:  python3 measure.py            (downloads the image zip to $E15_CACHE, default /tmp/e15-gde-cache)
Out:  out/metrics.csv; for the designs listed in out/film-ids.json, out/quadtree-<dir>-<id>.json and out/mask-<dir>-<id>.png

Metrics, all computed on the pixels as rendered (no vector data):
  white_space    share of the canvas where nothing is drawn: pixels with no brightness change of more than 12 levels
                 within 2 px, after growing every drawn pixel by 2 px so letters count as filled. A flat colour block
                 counts as space; a photograph does not.
  colourfulness  Hasler and Suesstrunk (2003), M = sigma_rgyb + 0.3 * mu_rgyb, the metric Reinecke et al. (2013)
                 found correlated r = .71 with perceived colourfulness of websites.
  complexity     quadtree leaves per 10,000 px^2: a square splits while the brightness range inside it is above 24
                 levels and it is larger than 4 px (after Zheng et al. 2009, used by Reinecke et al. 2013).
"""
import csv, hashlib, json, os, sys, urllib.request, zipfile
import numpy as np
from PIL import Image
import cv2

SHA = "8666cb62986ccf026956275f70ad6855d1f7a01a"
ZIP_URL = f"https://raw.githubusercontent.com/CyberAgentAILab/Graphic-design-evaluation/{SHA}/GPT_eval_data/images.zip"
ZIP_SHA256 = "8aa6d8dacdd50a0f50a903072c3419ff7adc79f2c2920981bd1b57f28c9e3e52"
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.environ.get("E15_CACHE", "/tmp/e15-gde-cache")
DIRS = {"none": "org", "small": "size_small", "medium": "size_medium", "large": "size_large"}

EDGE_T = 12      # brightness levels (0-255) that count as a drawn change
GROW = 2         # px a drawn pixel is grown by
QT_T = 24        # quadtree split threshold (brightness range)
QT_MIN = 4       # smallest quadtree square, px


def fetch():
    os.makedirs(CACHE, exist_ok=True)
    z = os.path.join(CACHE, "images.zip")
    if not os.path.exists(z):
        print("downloading", ZIP_URL, file=sys.stderr)
        urllib.request.urlretrieve(ZIP_URL, z)
    h = hashlib.sha256(open(z, "rb").read()).hexdigest()
    if h != ZIP_SHA256:
        sys.exit(f"images.zip sha256 {h} does not match the pinned {ZIP_SHA256}")
    if not os.path.isdir(os.path.join(CACHE, "images", "org")):
        with zipfile.ZipFile(z) as zf:
            zf.extractall(CACHE, [n for n in zf.namelist() if n.startswith("images/") and not n.endswith(".DS_Store")])
    return os.path.join(CACHE, "images")


def load(path):
    im = Image.open(path).convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    bg.alpha_composite(im)
    return np.asarray(bg.convert("RGB")).astype(np.float64)


def luminance(rgb):
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def white_space(L):
    k = np.ones((5, 5), np.uint8)
    L8 = L.astype(np.uint8)
    rng = cv2.dilate(L8, k).astype(int) - cv2.erode(L8, k).astype(int)
    drawn = (rng > EDGE_T).astype(np.uint8)
    drawn = cv2.dilate(drawn, np.ones((2 * GROW + 1, 2 * GROW + 1), np.uint8))
    return float(1 - drawn.mean()), drawn


def colourfulness(rgb):
    R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    rg = R - G
    yb = 0.5 * (R + G) - B
    return float(np.hypot(rg.std(), yb.std()) + 0.3 * np.hypot(rg.mean(), yb.mean()))


def quadtree(L):
    h, w = L.shape
    leaves = []
    # Tile the canvas with squares of the largest power of two that fits the short side, then split each.
    s = 1 << int(np.floor(np.log2(min(h, w))))
    stack = [(x, y, s) for y in range(0, h, s) for x in range(0, w, s)]
    while stack:
        x, y, s = stack.pop()
        block = L[y:y + s, x:x + s]
        if block.size == 0:
            continue
        if s > QT_MIN and block.max() - block.min() > QT_T:
            half = s // 2
            stack += [(x, y, half), (x + half, y, half), (x, y + half, half), (x + half, y + half, half)]
        else:
            leaves.append((x, y, min(s, w - x), min(s, h - y)))
    return leaves


def main():
    root = fetch()
    rows = list(csv.DictReader(open(os.path.join(HERE, "data", "human_abs_whitespace.csv"))))
    film_ids = set(json.load(open(os.path.join(HERE, "out", "film-ids.json")))) if os.path.exists(os.path.join(HERE, "out", "film-ids.json")) else set()
    out = []
    for r in rows:
        d = DIRS[r["perturbation"]]
        path = os.path.join(root, d, r["id"] + ".png")
        rgb = load(path)
        L = luminance(rgb)
        ws, drawn = white_space(L)
        leaves = quadtree(L)
        h, w = L.shape
        out.append({
            "id": r["id"], "perturbation": r["perturbation"], "file": f"{d}/{r['id']}.png", "w": w, "h": h,
            "white_space": round(ws, 4), "colourfulness": round(colourfulness(rgb), 3),
            "complexity": round(len(leaves) / (w * h) * 10000, 3), "leaves": len(leaves),
        })
        key = f"{d}/{r['id']}"
        if key in film_ids:
            # For the film: the quadtree's squares, and the white-space mask (white = nothing drawn), at the design's size.
            json.dump({"file": f"{d}/{r['id']}.png", "w": w, "h": h, "leaves": leaves},
                      open(os.path.join(HERE, "out", f"quadtree-{d}-{r['id']}.json"), "w"))
            Image.fromarray(((1 - drawn) * 255).astype(np.uint8)).save(os.path.join(HERE, "out", f"mask-{d}-{r['id']}.png"))
    with open(os.path.join(HERE, "out", "metrics.csv"), "w", newline="") as f:
        wr = csv.DictWriter(f, fieldnames=list(out[0].keys()))
        wr.writeheader()
        wr.writerows(out)
    print(f"measured {len(out)} designs -> out/metrics.csv")


if __name__ == "__main__":
    main()
