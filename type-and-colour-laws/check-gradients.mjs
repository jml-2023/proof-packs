// The gradient check, computed: for every pair of colours in a palette, the law's prediction for the chroma in the
// middle of an OKLab gradient, what an 8-bit mixer actually produces there, and whether the middle keeps enough colour.
// Usage: node check-gradients.mjs [palette.json] [--shade 500] [--keep 0.5]
// A palette file needs "families": [{ "name", "shades": { "<shade>": "#rrggbb" } }]; "greys": [names] are skipped.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hexToLch, hueGap, midpointChroma, mixHex, mixHexSrgb } from './lib/colour.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT_DIR ?? path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const file = args.find((a) => a.endsWith('.json')) ?? path.join(HERE, 'data', 'tailwind-3.4.17-palette.json');
const SHADE = opt('--shade', '500');
const KEEP = +opt('--keep', '0.5'); // the middle must keep this share of the weaker end's chroma

const P = JSON.parse(fs.readFileSync(file, 'utf8'));
const colours = P.families.filter((f) => !(P.greys ?? []).includes(f.name) && f.shades[SHADE]).map((f) => ({ name: f.name, hex: f.shades[SHADE], ...hexToLch(f.shades[SHADE]) }));
const r = (x, d = 4) => +x.toFixed(d);

const pairs = [];
for (let i = 0; i < colours.length; i++) for (let j = i + 1; j < colours.length; j++) {
  const A = colours[i], B = colours[j];
  const dh = hueGap(A.h, B.h);
  const predicted = midpointChroma(A.C, B.C, dh);
  const mix = mixHex(A.hex, B.hex);
  const mixed = hexToLch(mix.hex);
  const srgb = hexToLch(mixHexSrgb(A.hex, B.hex));
  const keeps = predicted / Math.min(A.C, B.C);
  pairs.push({
    a: A.name, b: B.name, hex: [A.hex, B.hex],
    neighbours: j === i + 1 || (i === 0 && j === colours.length - 1),
    hue_gap: r(dh, 1), chroma: [r(A.C), r(B.C)],
    predicted: r(predicted), mixed_8bit: r(mixed.C), mixed_hex: mix.hex, middle_in_srgb_gamut: mix.inGamut,
    error: r(Math.abs(mixed.C - predicted)),
    keeps: r(keeps, 3), pass: keeps >= KEEP,
    equal_chroma_rule: r(Math.cos((dh * Math.PI) / 360), 3),
    srgb_default_middle: { chroma: r(srgb.C), lightness: r(srgb.L), vs_oklab_lightness: r(srgb.L - mix.lab[0]) },
  });
}
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const inGamut = pairs.filter((p) => p.middle_in_srgb_gamut);
const summary = {
  palette: P.name, shade: SHADE, colours: colours.length, pairs: pairs.length, keep: KEEP,
  max_error_all: r(Math.max(...pairs.map((p) => p.error))),
  max_error_in_gamut: r(Math.max(...inGamut.map((p) => p.error))),
  median_error: r(med(pairs.map((p) => p.error)), 5),
  middles_outside_srgb: pairs.length - inGamut.length,
  fail: pairs.filter((p) => !p.pass).length,
  neighbours: { pairs: pairs.filter((p) => p.neighbours).length, fail: pairs.filter((p) => p.neighbours && !p.pass).length, max_error: r(Math.max(...pairs.filter((p) => p.neighbours).map((p) => p.error))) },
  fails_at_other_bars: Object.fromEntries([0.4, 0.5, 0.6].map((k) => [k, pairs.filter((p) => p.predicted / Math.min(p.chroma[0], p.chroma[1]) < k).length])),
  first_fail_hue_gap: r(Math.min(...pairs.filter((p) => !p.pass).map((p) => p.hue_gap)), 1),
  last_pass_hue_gap: r(Math.max(...pairs.filter((p) => p.pass).map((p) => p.hue_gap)), 1),
};
fs.writeFileSync(path.join(OUT, 'gradients.json'), JSON.stringify({ summary, colours: colours.map((c) => ({ name: c.name, hex: c.hex, L: r(c.L), C: r(c.C), h: r(c.h, 2) })), pairs }, null, 2) + '\n');

console.log(`${P.name}, shade ${SHADE}: ${colours.length} colours, ${pairs.length} pairs`);
console.log(`  law vs 8-bit mix at the middle: worst ${summary.max_error_all} (${summary.max_error_in_gamut} where the middle is inside sRGB), median ${summary.median_error}; middles outside sRGB: ${summary.middles_outside_srgb}`);
console.log(`  neighbours round the wheel: ${summary.neighbours.pairs} pairs, worst error ${summary.neighbours.max_error}, fail the gate ${summary.neighbours.fail}`);
console.log(`  gate (middle keeps ≥ ${KEEP} of the weaker end's chroma): ${summary.fail} of ${pairs.length} pairs fail; smallest failing hue gap ${summary.first_fail_hue_gap}°, largest passing ${summary.last_pass_hue_gap}°`);
console.log(`  pairs failing at a bar of 0.4 / 0.5 / 0.6: ${Object.values(summary.fails_at_other_bars).join(' / ')}`);
const worst = [...pairs].sort((a, b) => a.keeps - b.keeps).slice(0, 6);
for (const p of worst) console.log(`    ${(p.a + '+' + p.b).padEnd(16)} gap ${String(p.hue_gap).padStart(5)}°  ends ${p.chroma.join('/')}  middle ${p.predicted} (keeps ${p.keeps})  mixed ${p.mixed_8bit} ${p.mixed_hex}`);
console.log(`wrote ${path.join(OUT, 'gradients.json')}`);
