#!/usr/bin/env node
// wave4-optical-and-spring-arithmetic — Zero-dependency Oklab/OKLCH perceptual lightness & WCAG contrast,
// polygon centroid optical-alignment offset, and spring damping-ratio (zeta) verifier (w15).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

export function hslToRgb01(hDeg, sPct, lPct) {
  const h = ((hDeg % 360) + 360) % 360;
  const s = sPct / 100, l = lPct / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return [r1 + m, g1 + m, b1 + m];
}

// Björn Ottosson's (2020) exact linear-sRGB -> Oklab transform
export function rgb01ToOklab([r, g, b]) {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const b2 = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  const C = Math.hypot(a, b2);
  const h = ((Math.atan2(b2, a) * 180) / Math.PI + 360) % 360;
  const Y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  return { L: +L.toFixed(3), C: +C.toFixed(3), h: +h.toFixed(1), relLuminanceY: +Y.toFixed(4) };
}

export function wcagContrast(y1, y2) {
  const hi = Math.max(y1, y2), lo = Math.min(y1, y2);
  return +((hi + 0.05) / (lo + 0.05)).toFixed(2);
}


export function hexToRgb01(hex) {
  const h = hex.replace(/^#/, "");
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

// Demonstrates 21 Nov 2026 UI ramp bug: interpolating warm neutral stone (#EFEDE9, h~80.5deg) toward a
// slightly cool-warm darker stone (#DCD7D8, h~350deg) in polar OKLCH interpolates hue across red/pink (~35deg)
// and inflates red-green 'a' cast compared to straight-line Cartesian OKLab!
export function compareNeutralRampSpaces(hexA = "#EFEDE9", hexB = "#DCD7D8", t = 0.5) {
  const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const toLab = ([r, g, b]) => {
    const lr = srgbToLin(r), lg = srgbToLin(g), lb = srgbToLin(b);
    const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
    const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
    const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    const b2 = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    return { L, a, b: b2, C: Math.hypot(a, b2), h: ((Math.atan2(b2, a) * 180) / Math.PI + 360) % 360 };
  };
  const p1 = toLab(hexToRgb01(hexA));
  const p2 = toLab(hexToRgb01(hexB));
  // Cartesian OKLab midpoint: C shrinks cleanly toward neutral axis
  const oklabMidA = (1 - t) * p1.a + t * p2.a;
  const oklabMidB = (1 - t) * p1.b + t * p2.b;
  const oklabChroma = +Math.hypot(oklabMidA, oklabMidB).toFixed(5);
  // Polar OKLCH shorter-arc midpoint: holds C = mean(C1, C2) and swings h through pink/peach (~35deg)!
  let dh = p2.h - p1.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const oklchMidH = ((p1.h + t * dh) + 360) % 360;
  const oklchMidC = +(((1 - t) * p1.C + t * p2.C)).toFixed(5);
  const oklchMidA = +(oklchMidC * Math.cos((oklchMidH * Math.PI) / 180)).toFixed(5);
  return {
    endpointHuesDeg: [+p1.h.toFixed(1), +p2.h.toFixed(1)],
    oklabMidChroma: oklabChroma,
    oklchMidChroma: oklchMidC,
    oklchMidHueDeg: +oklchMidH.toFixed(1),
    redAxisInflationRatio: +(Math.abs(oklchMidA) / Math.max(0.00001, Math.abs(oklabMidA))).toFixed(2),
  };
}

// Optical centroid shift for a right-pointing play triangle of width W inside a circle
export function computePlayTriangleOpticalOffset(iconWidthPx) {
  // Vertices (0, -H/2), (0, +H/2), (W, 0): bounding-box center is W/2, area centroid is W/3 -> error = -W/6
  const bboxErrorPx = +(-iconWidthPx / 6).toFixed(2);
  const requiredShiftRightPx = +(iconWidthPx / 6).toFixed(2);
  return { iconWidthPx, bboxCentroidErrorPx: bboxErrorPx, opticalShiftRightPx: requiredShiftRightPx, residualCentroidErrorPx: 0 };
}

// Damped harmonic oscillator physics: zeta = c / (2 * sqrt(k * m))
export function auditSpringPhysics({ stiffness: k, damping: c, mass: m = 1, role = "chrome" }) {
  const zeta = +(c / (2 * Math.sqrt(k * m))).toFixed(3);
  const overshootPct = zeta < 1 ? +(Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta)) * 100).toFixed(1) : 0.0;
  const pass = role === "chrome" ? zeta >= 0.95 && zeta <= 1.15 && overshootPct <= 0.5 : zeta >= 0.65;
  return { stiffness: k, damping: c, mass: m, role, dampingRatioZeta: zeta, peakOvershootPct: overshootPct, pass };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--tokens");
  if (idx >= 0) {
    const cfg = JSON.parse(fs.readFileSync(args[idx + 1], "utf8"));
    const springs = (cfg.springs || []).map(auditSpringPhysics);
    const icons = (cfg.playIconsPx || [24]).map(computePlayTriangleOpticalOffset);
    const badges = (cfg.hslBadges || []).map((b) => {
      const ok = rgb01ToOklab(hslToRgb01(b.h, b.s, b.l));
      const contrastWhite = wcagContrast(1.0, ok.relLuminanceY);
      return { ...b, ...ok, contrastWhite, passAA: contrastWhite >= 4.5 };
    });
    const allPass = springs.every((s) => s.pass) && badges.every((b) => b.passAA);
    console.log(JSON.stringify({ springs, icons, badges, allPass }, null, 2));
    process.exit(allPass ? 0 : 2);
  }

  const hslYellow = rgb01ToOklab(hslToRgb01(60, 100, 50));
  const hslBlue = rgb01ToOklab(hslToRgb01(240, 100, 50));
  const luminanceRatio = +(hslYellow.relLuminanceY / hslBlue.relLuminanceY).toFixed(2);

  const play24 = computePlayTriangleOpticalOffset(24);
  const bouncyDrawer = auditSpringPhysics({ stiffness: 300, damping: 14, mass: 1, role: "chrome" });
  const criticalDrawer = auditSpringPhysics({ stiffness: 300, damping: 34.6, mass: 1, role: "chrome" });
  const stoneRamp = compareNeutralRampSpaces("#EFEDE9", "#DCD7D8", 0.5);

  const results = {
    generatedAt: "2026-11-19T16:30:00Z",
    hsl50LightnessIllusion: {
      yellowHsl50: { ...hslYellow, contrastWithWhiteText: wcagContrast(1.0, hslYellow.relLuminanceY) },
      blueHsl50: { ...hslBlue, contrastWithWhiteText: wcagContrast(1.0, hslBlue.relLuminanceY) },
      luminanceRatioYellowOverBlue: luminanceRatio,
    },
    opticalPlayIcon24px: play24,
    springComparison: { naiveBouncyDrawer: bouncyDrawer, criticallyDampedDrawer: criticalDrawer },
    neutralStoneRampOklabVsOklch: stoneRamp,
  };
  fs.writeFileSync(path.join(HERE, "results-2026-11-19.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify({
    luminanceRatio,
    yellowWhiteContrast: results.hsl50LightnessIllusion.yellowHsl50.contrastWithWhiteText,
    blueWhiteContrast: results.hsl50LightnessIllusion.blueHsl50.contrastWithWhiteText,
    playShift24Px: play24.opticalShiftRightPx,
    bouncyOvershootPct: bouncyDrawer.peakOvershootPct,
    criticalOvershootPct: criticalDrawer.peakOvershootPct,
    pinkRedInflationRatio: stoneRamp.redAxisInflationRatio,
  }));
}
