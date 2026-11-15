#!/usr/bin/env node
// frontier-clarity-physics-canon — Deterministic $0 geometry & motion canon check behind "Clarity over taste" (f03).
// Computes 2D PCA eigen-axis silhouette aspect ratio (separating thin snakes <0.25 from wide flocks),
// frame-to-frame hitch freeze detection, and chart-zone ornament collision checks.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function rng(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function measureSilhouetteRatio(points) {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let cxx = 0, cyy = 0, cxy = 0;
  for (const p of points) {
    const dx = p.x - mx, dy = p.y - my;
    cxx += dx * dx;
    cyy += dy * dy;
    cxy += dx * dy;
  }
  cxx /= n;
  cyy /= n;
  cxy /= n;
  const trace = cxx + cyy;
  const det = cxx * cyy - cxy * cxy;
  const disc = Math.sqrt(Math.max(0, (trace * trace) / 4 - det));
  const l1 = trace / 2 + disc;
  const l2 = Math.max(0, trace / 2 - disc);
  const major = Math.sqrt(l1) * 4;
  const minor = Math.sqrt(l2) * 4;
  return { majorPx: +major.toFixed(1), minorPx: +minor.toFixed(1), ratio: +(minor / (major || 1)).toFixed(3) };
}

export function detectHitches(frameDeltas, minMotion = 0.4) {
  const hitches = [];
  for (let i = 1; i < frameDeltas.length - 1; i++) {
    if (frameDeltas[i] < 0.02 && frameDeltas[i - 1] >= minMotion && frameDeltas[i + 1] >= minMotion) {
      hitches.push(i);
    }
  }
  return hitches;
}

export function checkDataZoneClean(particles, chartBox, phase) {
  if (phase === "transit") return { ok: true, intruding: 0, rule: "allowed_in_transit" };
  const intruding = particles.filter((p) => p.x >= chartBox.x0 && p.x <= chartBox.x1 && p.y >= chartBox.y0 && p.y <= chartBox.y1).length;
  return { ok: intruding === 0, intruding, rule: "no_ornament_where_misread_as_quantity" };
}

const r = rng(42);
const snakeCloud = Array.from({ length: 180 }, (_, i) => {
  const t = (i / 180) * 600;
  return { x: 120 + t, y: 300 + Math.sin(t / 90) * 14 + (r() - 0.5) * 16 };
});
const wideFlockCloud = Array.from({ length: 180 }, (_, i) => {
  const t = (i / 180) * 460;
  return { x: 180 + t + (r() - 0.5) * 60, y: 300 + Math.sin(t / 110) * 45 + (r() - 0.5) * 175 };
});

const chartBox = { x0: 200, y0: 180, x1: 760, y1: 520 };
const smoothDeltas = Array.from({ length: 60 }, () => 1.25);
const hitchedDeltas = smoothDeltas.map((v, idx) => (idx === 18 || idx === 41 ? 0.0 : v));

const sRes = measureSilhouetteRatio(snakeCloud);
const fRes = measureSilhouetteRatio(wideFlockCloud);
const canonResults = {
  generatedAt: "2026-11-15T09:40:00Z",
  costUsd: 0,
  canonRules: { minFlockRatio: 0.25, minMinorPx: 22, forbidRestingParticlesInDataZone: true },
  cases: {
    rejectedThinSnake: { ...sRes, passesCanon: sRes.ratio >= 0.25 && sRes.minorPx >= 22 },
    acceptedWideFlock: { ...fRes, passesCanon: fRes.ratio >= 0.25 && fRes.minorPx >= 22 },
    smoothSequenceHitches: detectHitches(smoothDeltas).length,
    planted2HitchSequenceCaught: detectHitches(hitchedDeltas).length,
    restingChartContaminated: checkDataZoneClean(wideFlockCloud, chartBox, "resting"),
    transitAcrossCanvas: checkDataZoneClean(wideFlockCloud, chartBox, "transit"),
  },
};

fs.writeFileSync(path.join(HERE, "results-2026-11-15.json"), JSON.stringify(canonResults, null, 2) + "\n");
console.log(JSON.stringify({ snake: sRes.ratio, flock: fRes.ratio, hitchesCaught: canonResults.cases.planted2HitchSequenceCaught }));
