// Runs the three type checks on one or more type scales, and fits the log law to Inter's published tracking curve.
// Usage: node check-type.mjs [scale.json …]   (no arguments: the two public scales and my figure kit, in data/)
// A scale file needs "steps": [{ "name", "size_px", "line_px" (or null), "tracking": { "value", "unit": "em" | "px" } | null,
// "case": "upper" (optional) }]. Optional: "ladder" (one style per size, for the band; default "steps"), "styles" (every
// style, for the pairwise tests; default "steps"), "scale": { "steps": [sizes] } and "band": { "k", "cap" }.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sizeCheck, lineBoxCheck, trackingCheck, logFit } from './lib/type.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT_DIR ?? path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['tailwind-4.2.2-type.json', 'carbon-type-11.70.0.json', 'my-figure-kit.json'].map((f) => path.join(HERE, 'data', f));

const report = { scales: [], inter: null };
for (const file of files) {
  const S = JSON.parse(fs.readFileSync(file, 'utf8'));
  const all = S.styles ?? S.steps;
  const ladder = S.ladder ?? S.steps;
  const sizes = S.scale?.steps ?? all.map((s) => s.size_px);
  const size = sizeCheck(sizes);
  const offScale = S.scale ? [...new Set(all.map((s) => s.size_px))].filter((s) => !S.scale.steps.includes(s)) : null;
  const line = lineBoxCheck(all, ladder, { band: S.band ?? null });
  const track = trackingCheck(all);
  report.scales.push({ name: S.name, file: path.basename(file), size, sizes_off_own_scale: offScale, line_box: line, tracking: track });

  console.log(`\n${S.name}`);
  console.log(`  1 size      one ratio ${size.fitted.ratio} from ${size.fitted.base}px: ${size.within_tol} of ${size.of} steps within ${size.tol * 100}%, worst ${size.worst.size}px at ${(size.worst.off * 100).toFixed(1)}%${offScale ? `; styles off its own scale: ${offScale.length ? offScale.join(', ') : 'none'}` : ''}`);
  console.log(`              step ratios ${size.steps.slice(1).map((s) => s.ratio_to_previous).join(' ')}`);
  console.log(`  2 line box  band gap = min(size − ${line.fitted.k}, ${line.fitted.cap}), ${line.band_from}: ${line.in_band} of ${line.of} line boxes in the band (within 0.5px)`);
  for (const s of line.steps) console.log(`              ${s.name.padEnd(14)} ${String(s.size).padStart(4)}/${String(s.line).padEnd(7)} gap ${String(s.gap).padEnd(6)} band ${String(s.band_gap).padEnd(3)} ${s.in_band ? '' : `off ${s.off_px}px`}`);
  if (S.styles) console.log(`              every style: ${line.every_style.in_band} of ${line.every_style.of} in the band; off: ${line.every_style.off.map((s) => `${s.name} ${s.size}/${s.line} (${s.off_px > 0 ? '+' : ''}${s.off_px}px)`).join(', ')}`);
  console.log(`              shared or shrinking line boxes: ${line.shared_or_shrinking.length ? line.shared_or_shrinking.map((x) => `${x.smaller} → ${x.larger} (${x.kind})`).join('; ') : 'none'}`);
  if (track.pass === null) console.log(`  3 tracking  ${track.note}`);
  else {
    console.log(`  3 tracking  written in ${track.written_in}; loosens as size grows: ${track.loosens_as_size_grows.length ? track.loosens_as_size_grows.length + ' pairs' : 'never'}; em by size ${JSON.stringify(track.em_by_size)}`);
    if (track.capitals.length) console.log(`              capitals, compared only with capitals: ${track.capitals.join(', ')}`);
    if (track.flagged_if_capitals_were_not_marked.length) console.log(`              would be flagged if the capitals were not marked: ${track.flagged_if_capitals_were_not_marked.map((x) => `${x.smaller} → ${x.larger}`).join('; ')}`);
  }
}

// Inter 3's published curve, sampled every pixel, against the log law.
const I = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'inter-3-dynamic-metrics.json'), 'utf8'));
const curve = (z) => I.a + I.b * Math.exp(I.c * z);
const sample = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => ({ size: lo + i, em: curve(lo + i) }));
const zero = Math.log(-I.b / I.a) / -I.c;
const never = sample(6, 144).every((p, i, arr) => i === 0 || p.em <= arr[i - 1].em);
report.inter = {
  name: I.name,
  formula: I.formula,
  constants: { a: I.a, b: I.b, c: I.c },
  at: Object.fromEntries([12, 14, 16, 20, 24, 32, 48, 72].map((z) => [z, +curve(z).toFixed(5)])),
  zero_at_px: +zero.toFixed(2),
  never_loosens_6_to_144: never,
  log_fit_12_32: logFit(sample(12, 32)),
  log_fit_12_72: logFit(sample(12, 72)),
};
console.log(`\n${I.name}: ${I.formula}`);
console.log(`  em at 12/16/24/48px: ${[12, 16, 24, 48].map((z) => curve(z).toFixed(4)).join(' / ')}; zero at ${zero.toFixed(1)}px; never loosens with size: ${never}`);
for (const k of ['log_fit_12_32', 'log_fit_12_72']) {
  const f = report.inter[k];
  console.log(`  log law over ${k.slice(8).replace('_', '–')}px: k ${f.fitted.k}, zero at ${f.fitted.S0}px, worst miss ${f.max_off_em}em`);
}

fs.writeFileSync(path.join(OUT, 'type.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`\nwrote ${path.join(OUT, 'type.json')}`);
