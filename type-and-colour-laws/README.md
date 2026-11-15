# Type and colour have laws you can compute: the instrument pack

This pack checks a type scale against three laws (size, line box and letter spacing) and a palette against one (the colour in the middle of a gradient). It runs on public material: the default text sizes of Tailwind CSS 4.2.2, the type styles of IBM's Carbon design system (`@carbon/type` 11.70.0), the default palette of Tailwind CSS 3.4.17, Inter 3's published tracking formula and seven typefaces under the SIL Open Font Licence. It also runs on my own figure kit, the type styles that draw the figures in my essays. Point it at your own scale, palette or stylesheet and it does the same for them.

Nothing in it calls a model, so it costs nothing to run.

## What's in it

- `run.sh`: runs everything. It downloads the three npm packages the data comes from, stops unless each matches the hash the npm registry publishes, extracts the data again and stops unless it matches `data/`, runs every check, and compares each result file with mine in `results-30-october/`.
- `extract-public.mjs`: reads the three npm packages as text (it never runs their code) and writes `data/tailwind-4.2.2-type.json`, `data/tailwind-3.4.17-palette.json` and `data/carbon-type-11.70.0.json`. Each value carries the file and line it came from.
- `check-type.mjs`: the three type checks, on any scale written as JSON. With no arguments it checks Tailwind, Carbon and my figure kit. Writes `out/type.json`.
  - **Size**: fits one ratio to the scale (each size a fixed multiple of the one before) and reports how far each step sits from it, and whether every style uses a size from the scale's own list. It gives no pass or fail, because a scale built another way isn't wrong for missing one ratio; `fits_one_ratio` says only whether every step is within 10% of it.
  - **Line box**: finds any pair of styles where the larger text gets the same or a smaller line box, and fits the band `gap = min(size − k, cap)`, where the gap is the line box minus the size. The band is fitted by trying every whole-pixel `k` from 0 to 16 and `cap` from 0 to 24 and keeping the pair that leaves the fewest line boxes more than half a pixel away. A scale file can state its band instead, which a scale with few line boxes needs.
  - **Letter spacing (tracking)**: converts every value to em, a share of the type size, and reports the unit it was written in and every pair of styles where the larger size is spaced looser. A style marked `"case": "upper"` is set in capitals, so it's compared only with other capitals; the pairs that marking removed are still listed.
  - It also fits a log curve, `t(S) = −k·ln(S/S0)`, to Inter 3's published tracking formula over 12–32px and 12–72px.
- `faces.py`: measures any font file with fontTools: cap height, x-height, average width per character, the space its designer built into the letters (the side bearings of each letter, averaged over the letters of the long opening sentence of *Alice's Adventures in Wonderland*) and how many characters fit a 600px line at 16px. For a typeface with an optical-size axis it measures that space at each size listed in `fonts/faces.json`. Kerning isn't applied. Writes `out/faces.json`.
- `check-gradients.mjs`: for every pair of colours in a palette, the law's prediction for the chroma (colourfulness) in the middle of a gradient drawn in OKLab, what an 8-bit mix actually gives there, and the gate: does the middle keep at least half the chroma of the weaker end? Writes `out/gradients.json`.
- `render-gradients.mjs`: draws every pair as a CSS gradient in headless Chromium, twice (once with `in oklab`, once with the browser's default), reads the middle pixel back and compares it with the law. Writes `out/rendered.json`.
- `check-css.mjs`: the gate on your own stylesheet. It finds every CSS gradient, works out which space the browser will mix it in, following CSS Color 4: the space the gradient names, or else sRGB when every colour is a legacy sRGB colour and OKLab when any isn't. It computes the middle of each pair of neighbouring stops in that space, and exits 1 if any fails. It reads hex, `rgb()`, `hsl()`, `oklab()` and `oklch()` colours, and computes middles in OKLab, OKLCh, sRGB and linear sRGB. It lists named colours, `hwb()` and `var()` as not read and leaves them out of the space decision, so check those gradients by hand.
- `examples/gradients.css`: seven gradients to try `check-css.mjs` on.
- `lib/`: the colour maths (`colour.mjs`, with Björn Ottosson's OKLab matrices), the three type checks (`type.mjs`) and a small PNG reader (`png.mjs`).
- `data/`: the extracted public data, Inter 3's formula (`inter-3-dynamic-metrics.json`) and my figure kit (`my-figure-kit.json`).
- `fonts/`: the seven typefaces, unmodified, with the licence (`OFL.txt`) and each one's copyright notice (`FONTS.md`).
- `results-30-october/`: my results, and `run.txt`, the full output of the run that made them.

## Run it

You need Node 20 or later, npm, Python 3 with fontTools (`pip install fonttools`) and, for the browser step, Playwright with Chromium (`npm install playwright && npx playwright install chromium`).

```
sh run.sh
```

If Playwright lives in another project, point to it with `PLAYWRIGHT_FROM=/path/to/that/package.json sh run.sh`. To skip the browser step, use `SKIP_RENDER=1 sh run.sh`. On my laptop on 30 October three runs from a fresh copy of this folder took between 10 and 31 seconds, downloads included, and in each every result file matched `results-30-october/` byte for byte; `results-30-october/run.txt` is the output of the first. Mine were made with Chromium 153.0.8010.12 (the build Playwright 1.63 installs), fontTools 4.62.0 on Python 3.14 and Node 24.4.0. The same day I tried other versions. With Node 20.20.2 every result file matched too. With Chromium 145.0.7632.6, `rendered.json` was reported as different only because it names the browser (`summary.browser`); every measurement in it matched. `faces.json` came out the same with fontTools 4.60.1 and 4.68.0. On Linux, under WSL2 on a Windows PC, with Node 22, `SKIP_RENDER=1 sh run.sh` matched all four of the files it makes. So if `rendered.json` differs on your machine, look at the browser's name first.

## What it found

**The middle of a gradient.** Shade 500 of Tailwind 3.4.17's 17 colours that aren't grey makes 136 pairs. The law, the middle's chroma as `½·√(Ca² + Cb² + 2·Ca·Cb·cos Δh)`, matched what Chromium drew with `in oklab` to within 0.0006 on all 136, at the quarter points as well as the middle. CSS Color 4 counts an OkLCh difference of 0.02 as just noticeable. Without `in oklab`, the browser mixes hex colours in sRGB: the law then missed by up to 0.054, and the middle came out darker (by more than 0.005 in OKLab lightness) in 112 of the 136 pairs. The gate (the middle keeps at least half the chroma of the weaker end) failed 40 of the 136 pairs and none of the 17 neighbours round the colour wheel. The first failure is red to green, 124° apart; teal to fuchsia still passes at 140°, because fuchsia is twice as strong as teal and holds the middle up. Set the bar at 0.4 and 24 pairs fail; at 0.6, 50.

**Size.** Neither public scale is one ratio. Tailwind writes each size out, and the step from one to the next runs from 1.11 to 1.33. Carbon computes its sizes with a short function (`getTypeSize`, `es/index.js:155`) that adds 2px four times, then 4px four times, then 6px, and so on, so its steps shrink from 1.17 to 1.08 as the sizes grow. Every Carbon style uses a size from its own list.

**Line box.** The same band fits both: `gap = min(size − 8, 8)`. It holds for Tailwind's text sizes from 12 to 24px except 18px, and for Carbon's ladder (label-01, body-01, body-02 and headings 03 to 07) from 12 to 42px. Tailwind's 18px and 20px both get a 28px line box, so the larger text has the smaller gap between lines. From 30px Tailwind narrows the gap (6px at 30px, 4px at 36px), and from 48px it sets the line box equal to the size. Of all 36 Carbon styles, 25 sit in the band; ten sit 2 to 2.5px tighter, all between 14 and 20px; and the 54px heading sits 2.75px looser. Carbon has no shared or shrinking line box. The band isn't the only rule in use: Inter 3's guidelines page works out the line height as well, and its code sets it at 1.4 times the size, rounded, so the gap grows with the size (6px at 16px, 19px at 48px), and the band doesn't describe that.

**Letter spacing.** Tailwind ties no letter spacing to a size. Carbon writes it in px: 0.32px at 12px and 0.16px or 0.32px at 14px, and zero from 16px up, so it never loosens as the size grows. Its sizes are in rem, which follow the page's root text size, and its letter spacing is in px, which doesn't, so if the root size changes, the spacing's share of each size changes too. Inter 3's formula is zero at 12.1px and tightens to −0.0223em; a log curve follows it to within 0.0044em from 12 to 32px and misses by 0.0113em over 12 to 72px. All four typefaces with an optical-size axis draw their letters closer together at their largest size than at their smallest, by between 0.0173em (Source Serif 4) and 0.0360em (Fraunces), each along its own curve. Source Serif 4 tightens up to its 20px size and holds level from there.

**My figure kit.** The tracking check flagged one pair, my 22px labels against my 19px notes: the labels are set in capitals and spaced out by 0.04em. Marked as capitals, they pass. Its two line boxes sit 0.55px and 0.64px off the band the public scales share.

## Run it on your own

- **A type scale**: write it as JSON, like `data/my-figure-kit.json`: a `steps` list with `name`, `size_px`, `line_px` (or `null`), `tracking` (`{ "value", "unit": "em" | "px" }`) and, for capitals, `"case": "upper"`. Then `node check-type.mjs your-scale.json`.
- **A palette**: write it like `data/tailwind-3.4.17-palette.json` (`families`, each with `name` and `shades`; list greys under `greys`), then `node check-gradients.mjs your-palette.json --shade 500 --keep 0.5` and `node render-gradients.mjs your-palette.json --shade 500`.
- **A stylesheet**: `node check-css.mjs your.css` (add `--keep 0.6` to raise the bar). Put it in your build; it exits 1 when a gradient's middle fails.
- **A typeface**: add it to `fonts/faces.json` and run `python3 -I faces.py fonts/faces.json`.

## What it doesn't show

None of this is a reading test. The checks say whether a scale or a palette follows a law, and nothing here shows that people read better, or like a gradient more, when it does. Two type scales, one palette at one shade, and one browser engine is a small sample. The half-chroma bar is my setting. The law covers gradients drawn as a straight line in OKLab; in OKLCh the hue travels round the wheel instead, so the middle's chroma stays between the two ends' and its hue passes through others.

## Sources and licences

- Tailwind CSS (MIT), npm `tailwindcss@4.2.2` and `tailwindcss@3.4.17`; IBM Carbon (Apache-2.0), npm `@carbon/type@11.70.0`.
- Inter 3's dynamic metrics, Rasmus Andersson, archived at https://d.rsms.me/inter-website/v3/dynmetrics/ (read 30 October 2026).
- OKLab: Björn Ottosson, "A perceptual color space for image processing", https://bottosson.github.io/posts/oklab/ (23 December 2020; code in the public domain).
- CSS Color Module Level 4, W3C Candidate Recommendation Draft, 29 October 2026, https://www.w3.org/TR/css-color-4/: §13.2 on the interpolation space and §14 on the just-noticeable difference.
- The typefaces: SIL Open Font Licence 1.1 (`fonts/OFL.txt`, `fonts/FONTS.md`).
