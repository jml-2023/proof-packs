"""Measure any font file: cap height, x-height, width, and the spacing its designer drew at each optical size.

Usage: python3 -I faces.py <faces.json> [out.json]
faces.json lists the fonts: [{"name", "file", "location": {"wght": 400, ...}, "opsz": [sizes] (optional)}].
Needs fontTools (pip install fonttools). Kerning is not applied: every figure is from glyph advances and outlines.
"""
import hashlib
import json
import math
import os
import sys

from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont

# The opening of Alice's Adventures in Wonderland (Lewis Carroll, 1865; public domain), as a sample of running English.
SAMPLE = ("Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: "
          "once or twice she had peeped into the book her sister was reading, but it had no pictures or "
          "conversations in it, 'and what is the use of a book,' thought Alice 'without pictures or conversations?'")
COLUMN_PX, TEXT_PX = 600, 16


def measure(font, location):
    upm = font["head"].unitsPerEm
    gs = font.getGlyphSet(location=location or None)
    cmap = font.getBestCmap()

    def bounds(ch):
        g = cmap[ord(ch)]
        pen = BoundsPen(gs)
        gs[g].draw(pen)
        return gs[g].width, pen.bounds

    advances, spacing = [], []
    for ch in SAMPLE:
        width, b = bounds(ch)
        advances.append(width)
        if b is not None and ch.isalpha():
            spacing.append(b[0] + (width - b[2]))  # left side bearing plus right side bearing
    adv = sum(advances) / len(advances) / upm
    return {
        "cap_height_em": round(bounds("H")[1][3] / upm, 4),
        "x_height_em": round(bounds("x")[1][3] / upm, 4),
        "advance_per_char_em": round(adv, 4),
        "letter_spacing_drawn_em": round(sum(spacing) / len(spacing) / upm, 4),
        "chars_per_line": round(COLUMN_PX / (adv * TEXT_PX), 1),
    }


def main():
    spec_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "out", "faces.json")
    base = os.path.dirname(os.path.abspath(spec_path))
    spec = json.load(open(spec_path))
    results = []
    for f in spec:
        path = os.path.join(base, f["file"])
        font = TTFont(path)
        name = font["name"]
        row = {
            "name": f["name"],
            "file": f["file"],
            "sha256": hashlib.sha256(open(path, "rb").read()).hexdigest(),
            "version": name.getDebugName(5),
            "licence": (name.getDebugName(13) or "")[:60],
            "axes": {a.axisTag: [a.minValue, a.defaultValue, a.maxValue] for a in font["fvar"].axes} if "fvar" in font else {},
            "at_text_size": measure(font, f.get("location", {})),
        }
        if f.get("opsz"):
            sizes = []
            for z in f["opsz"]:
                m = measure(font, {**f.get("location", {}), "opsz": z})
                sizes.append({"opsz": z, **m})
            first, last = sizes[0], sizes[-1]
            doublings = math.log2(last["opsz"] / first["opsz"])
            change = last["letter_spacing_drawn_em"] - first["letter_spacing_drawn_em"]
            row["optical_sizes"] = sizes
            row["spacing_change_em"] = round(change, 4)
            row["spacing_change_per_doubling_em"] = round(change / doublings, 4)
            row["advance_change_em"] = round(last["advance_per_char_em"] - first["advance_per_char_em"], 4)
        results.append(row)
        t = row["at_text_size"]
        print(f"{row['name']:<34} cap {t['cap_height_em']:.3f}  x {t['x_height_em']:.3f}  advance {t['advance_per_char_em']:.3f}em  "
              f"{t['chars_per_line']:>5} chars in {COLUMN_PX}px at {TEXT_PX}px  spacing {t['letter_spacing_drawn_em']:.4f}em")
        for s in row.get("optical_sizes", []):
            print(f"    opsz {s['opsz']:>5}: spacing {s['letter_spacing_drawn_em']:.4f}em  advance {s['advance_per_char_em']:.4f}em  x {s['x_height_em']:.3f}")
        if "spacing_change_em" in row:
            print(f"    smallest to largest size: spacing {row['spacing_change_em']:+.4f}em ({row['spacing_change_per_doubling_em']:+.4f}em per doubling of size)")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    json.dump({"sample": SAMPLE, "column_px": COLUMN_PX, "text_px": TEXT_PX, "fonts": results}, open(out_path, "w"), indent=2)
    print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
