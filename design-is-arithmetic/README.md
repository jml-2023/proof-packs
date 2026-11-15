# Design is arithmetic until it isn't: the instrument pack

This pack measures how far three simple pieces of arithmetic on the pixels get at predicting people's ratings of white space. It runs on 400 rated banner and poster designs from a public set of 700, the part the set's authors use to test white space, and compares each measure with people's ratings in three ways: within one design whose text was enlarged, across all 400 designs, and across the 100 untouched originals. It also asks whether a measure follows people as closely as one more person would, works out how high any measure could score given how much the raters disagree, and gives you a before-and-after check to run on your own page.

## What's in it

- `measure.py`: downloads the designs, checks them against a pinned hash and computes three measures for each.
  - **White space**: the share of the canvas where nothing is drawn. A flat block of colour counts as space; a textured photograph, such as wood grain, doesn't.
  - **Colourfulness**: Hasler and Süsstrunk's published formula, which Reinecke and colleagues used for websites.
  - **Complexity**: the image is cut into smaller and smaller squares until each square is plain; the score is the number of those plain squares per 10,000 square pixels of canvas (`measure.py`, `quadtree` and the `complexity` field).
- `analyse.py`: compares each measure with people's ratings and with GPT-4o's, finds the designs the white-space measure misses worst and writes `out/summary.json`. It also writes `film-data.json` for the film made from this piece; you can ignore that file.
- `agreement.py`: sets one rating of each design aside as "one more person" and asks whether each measure follows the other raters' average as closely as that person does, with intervals; it also works out the highest correlation any measure could reach in each view. Writes `out/agreement.json`.
- `compare.py`: the check to use on your own work. Give it two screenshots of the same page, before and after a change, and it tells you whether the page lost white space.
- `data/`: people's white-space ratings for the 400 designs (1 to 10, five per design, except 25 originals with four) and GPT-4o's, as published by the dataset's authors, with their licence.
- `screens/`: eight images of the three designs the essay discusses: the four versions of "Black Friday Sale", and the original and the missed version of the other two (the wood-grain headline and "Gift ideas for Woman's Day"). The dataset's licence is beside them.
- `results-29-october.json`: my results, the `summary.json` the essay quotes.
- `results-agreement-30-october.json`: my `agreement.json`, for comparing with yours.
- `results-template.md`: an empty table for your own run.

## Run it

You need Python 3 with numpy, scipy, Pillow and OpenCV:

```
pip install numpy scipy pillow opencv-python
python3 measure.py
python3 analyse.py
python3 agreement.py
```

`measure.py` downloads the designs (75 MB) from the authors' repository at a fixed commit and stops if the file's hash doesn't match. It keeps them in `/tmp/e15-gde-cache`; set `E15_CACHE` to keep them somewhere else. On 30 October I ran the whole pack again from a fresh copy with an empty download folder: the four scripts took about 20 seconds together, download included, and `out/summary.json` matched `results-29-october.json` byte for byte. A busy machine takes longer: a second run that afternoon, while the laptop was rendering video, took just over three minutes. Nothing in the pack calls a model, so it costs nothing to run.

If your `summary.json` doesn't match, a library version is the likely cause: I used Python 3.14, numpy 2.4, scipy 1.17, OpenCV 4.13 and Pillow 12.1. `agreement.py` is the slowest step (9 of those 20 seconds), because it resamples the templates 1,000 times with a fixed seed; its `out/agreement.json` should match `results-agreement-30-october.json`, with the figures in the table below and ceilings of 0.87 within a design, 0.89 across all 400 and 0.38 among the originals (the last two as in `summary.json`).

## What it found

| Correlation with people's white-space rating | Same design, text enlarged | All 400 designs | The 100 originals |
|---|---|---|---|
| White-space measure | 0.67 | 0.19 | 0.21 |
| GPT-4o (the authors' ratings) | 0.71 | 0.65 | 0.17 |
| One more person: one rating against the average of the others | 0.56 | 0.59 | 0.11 |

Within one design, the white-space measure follows people: it can tell the airy version of a design from its crowded versions, and against the same average of the other raters it does better than one more person (0.65 against 0.56; the gap's 95% interval is 0.02 to 0.17). Across different designs it barely follows people (0.18 against 0.59), while GPT-4o comes level with one more person (0.64). Complexity behaves much like white space in every view, a little stronger; colourfulness is weaker except among the originals. Among the originals, people barely agreed with each other, so nothing could score well; no measure could correlate above about 0.38 with their averages. The measure's worst misses were a headline on a wood-grain photograph, which it counted as almost entirely drawn (0.002 of the canvas empty), and two designs whose text was enlarged until it overlapped other text, which still had about half their canvas empty (0.489 and 0.464).

## Try it on your own measure

Add a column to `out/metrics.csv` from your own measure, add its name to `METRICS` at the top of `analyse.py` and to `MEASURES` at the top of `agreement.py`, and run both again. If bigger numbers on your measure mean more crowded, add it to `FLIPPED` in `agreement.py` too. Read three numbers:

- **Within a design**: does your measure order a design's four versions the way people did? This is the easy test. The white-space measure got 0.67 here, and one more person 0.56.
- **Across all 400**: does it rank different designs the way people did? This is the hard one. The white-space measure got 0.19, and one more person 0.59.
- **Among the originals**: people barely agreed with each other on these, so no measure can score above about 0.38. A measure near that ceiling is doing as well as the ratings allow.

The numbers are correlations, `r` in `summary.json`. If bigger numbers on your measure mean more crowded, they come out negative; read the size, not the sign.

## Try it on your own page

Take a screenshot of a page before a change and another after it, at the same width, and run:

```
python3 compare.py before.png after.png
```

It scales both images so the longest side is 360 pixels, the size of the rated designs, measures them and prints the change in white space and complexity, with the size of change the rated designs showed for scale. Add `--json` to get the same figures for a script or an agent. Try it on the pack's own screens first:

```
python3 compare.py screens/org__5bd9cec29259f9ba54ad4084.png screens/size_large__5bd9cec29259f9ba54ad4084.png
```

That's the "Black Friday Sale" design before and after its text was enlarged the most. White space falls from 0.671 to 0.489, and people's rating fell from 7.8 to 1.8.

Use it on two versions of one page, never to rank two different pages, because that's the only view in which the measure followed people. Even there, the only change it was tested on is text a machine enlarged, so a drop means someone should look at the page. It can't say whether the page got worse, and it can't see text that runs into other text or off the edge. Those are facts for a check on the page's element boxes, such as comparing each text box with its neighbours and with the edge of the page.

## Limits

These are banners and posters, rated for one property, white space, by four or five people each. The crowded versions were made by a machine enlarging the text, so most of what changes within a design is one kind of fault. The three measures are simple on purpose and are not the published models. The data has no rater identities, so "one more person" is another rating of the same design rather than the same person each time, and the ceiling within a design assumes different people rated each version. The raters were a crowd, rating against the authors' description of good white space. A result here says how far arithmetic gets on this set, not on your screens.

## Licence

The designs and ratings are from *GraphicDesignEvaluation* (Haraguchi, Inoue, Shimoda, Mitani, Uchida and Yamaguchi, SIGGRAPH Asia 2024), Apache-2.0; see `data/LICENSE-GDE.txt`. The designs themselves are templates the authors sampled from VistaCreate; the licence is the authors' grant. The scripts are mine.
