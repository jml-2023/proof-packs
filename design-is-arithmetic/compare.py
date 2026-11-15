"""Did a page get more crowded? Compare two screenshots of the same page, before and after a change.

    python3 compare.py before.png after.png [--json]

It runs the pack's white-space and complexity measures on both images and prints the change. Each image is first
scaled so its longest side is 360 px, the size of the rated designs, so the measures behave as they did on them.

Use it on two versions of one page, never to rank two different pages. On the 400 rated designs, white space followed
people's ratings within one design (r = 0.67 when the text was enlarged) and barely across different designs
(r = 0.19). Within a design it followed the raters' average more closely than one more rater did (agreement.py), but
the only change in those versions was text a machine enlarged. So treat a drop as a reason for a person to look at the
page; it can't say whether the page got worse. It can't see text on top of text or text off the edge either: those
are facts for a check on the page's element boxes.
"""
import importlib.util, json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("measure", os.path.join(HERE, "measure.py"))
measure = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(measure)
LONG_SIDE = 360


def measures(path):
    im = Image.open(path).convert("RGBA")
    if max(im.size) != LONG_SIDE:
        s = LONG_SIDE / max(im.size)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.Resampling.LANCZOS)
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    bg.alpha_composite(im)
    L = measure.luminance(np.asarray(bg.convert("RGB")).astype(np.float64))
    ws, _ = measure.white_space(L)
    h, w = L.shape
    return {"file": path, "size": [w, h], "white_space": round(ws, 4),
            "complexity": round(len(measure.quadtree(L)) / (w * h) * 10000, 3)}


def main():
    args = [a for a in sys.argv[1:] if a != "--json"]
    if len(args) != 2:
        sys.exit(__doc__)
    before, after = measures(args[0]), measures(args[1])
    d_ws = round(after["white_space"] - before["white_space"], 4)
    d_cx = round(after["complexity"] - before["complexity"], 3)
    ref = json.load(open(os.path.join(HERE, "results-29-october.json")))
    scale = {"white_space_original": ref["metric_means"]["white_space"]["none"],
             "white_space_largest_text": ref["metric_means"]["white_space"]["large"],
             "people_original": ref["rating_means"]["none"], "people_largest_text": ref["rating_means"]["large"]}
    out = {"before": before, "after": after, "change": {"white_space": d_ws, "complexity": d_cx}, "scale": scale}
    if "--json" in sys.argv:
        print(json.dumps(out, indent=1))
        return
    for name, m in (("before", before), ("after", after)):
        print(f"{name:7} white space {m['white_space']:.3f}   complexity {m['complexity']:7.1f}   {m['file']}")
    word = "less than before" if d_ws < 0 else "more than before" if d_ws > 0 else "no change"
    print(f"change  white space {d_ws:+.3f} ({word})   complexity {d_cx:+.1f}")
    print(f"For scale: on the 100 rated designs, the largest text enlargement took white space from "
          f"{scale['white_space_original']:.3f} to {scale['white_space_largest_text']:.3f} on average, and people's "
          f"white-space rating from {scale['people_original']} to {scale['people_largest_text']} out of 10.")
    print("A drop means a person should look at the page. It can't say whether the page got worse.")


if __name__ == "__main__":
    main()
