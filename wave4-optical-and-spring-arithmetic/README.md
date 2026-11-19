# wave4-optical-and-spring-arithmetic

 Companion Proof Pack for ***Why geometric centres look wrong: compiling OKLCH contrast, optical triangles, and critically damped springs*** (`w15`, *Proof & Judgement*).

 ## Three exact closed-form laws implemented in zero dependencies

 1. **Björn Ottosson's Oklab/OKLCH (`2020`) vs HSL Lightness Illusion:** Exposes how `hsl(60, 100%, 50%)` yellow (`Y = 0.928`, `Oklab L = 0.968`) and `hsl(240, 100%, 50%)` blue (`Y = 0.072`, `Oklab L = 0.452`) share an identical `50%` HSL lightness while differing **`12.85×` in relative luminance** (failing white-text contrast at `1.07:1` vs `8.59:1`), whereas an OKLCH constant-`L` ring holds perceptual lightness uniform across hues.
 2. **Centroid vs Bounding-Box Icon Alignment:** For a right-pointing triangle of width `W` inside a circular button, bounding-box centering places the ink centroid at `-W/6` (`-4.00 px` on a `24 px` play icon); applying `+W/6` aligns the optical centre of mass to `0.00 px`.
 3. **Damping Ratio Physics (`zeta = c / (2 * sqrt(k * m))`):** Rejects bouncy agent-copied springs (`k=300, c=14, m=1` -> `zeta = 0.404`, `24.9%` overshoot) on drawers/menus in favour of critically damped springs (`zeta in [0.95, 1.05]`, `0.0%` overshoot).

 ## Reproduce essay benchmark or audit your own theme & motion config

 ```bash
 node wave4-optical-and-spring-arithmetic/run.mjs
 node wave4-optical-and-spring-arithmetic/run.mjs --tokens theme-motion.json
 ```
