// The gradient check, rendered: draws every pair as a CSS gradient in headless Chromium, twice (once asking for OKLab,
// once with the browser's default), reads the pixels back and compares them with the law.
// Usage: node render-gradients.mjs [palette.json] [--shade 500]
// Needs Playwright with Chromium: npm install playwright && npx playwright install chromium
// (or set PLAYWRIGHT_FROM to any package.json whose node_modules already has playwright).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { hexToLch, hexToRgb, rgbToOklab, lch } from './lib/colour.mjs';
import { readPng } from './lib/png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT_DIR ?? path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });
const require = createRequire(process.env.PLAYWRIGHT_FROM ?? import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const file = args.find((a) => a.endsWith('.json')) ?? path.join(HERE, 'data', 'tailwind-3.4.17-palette.json');
const SHADE = opt('--shade', '500');

const P = JSON.parse(fs.readFileSync(file, 'utf8'));
const colours = P.families.filter((f) => !(P.greys ?? []).includes(f.name) && f.shades[SHADE]).map((f) => ({ name: f.name, hex: f.shades[SHADE] }));
const pairs = [];
for (let i = 0; i < colours.length; i++) for (let j = i + 1; j < colours.length; j++) pairs.push([colours[i], colours[j]]);

// Each band is W pixels wide. Chromium colours pixel column x at its centre, t = (x + 0.5) / W, so with W = 1001
// column 500 is exactly the middle. Each band is H rows tall; the rows in the middle are averaged to cancel any dither.
const W = 1001, H = 24, COLS = [250, 500, 750];
const MODES = [['oklab', 'to right in oklab'], ['default', 'to right']];
const rows = [];
for (const [a, b] of pairs) for (const [mode, dir] of MODES) rows.push({ a, b, mode, css: `linear-gradient(${dir}, ${a.hex}, ${b.hex})` });
const html = `<!doctype html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0}body{width:${W}px;background:#fff}div{width:${W}px;height:${H}px}</style></head><body>${rows.map((r) => `<div style="background:${r.css}"></div>`).join('')}</body></html>`;

const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
const page = await (await browser.newContext({ deviceScaleFactor: 1, viewport: { width: W, height: 800 } })).newPage();
await page.setContent(html);
const png = readPng(await page.screenshot({ fullPage: true, type: 'png' }));
const version = browser.version();
await browser.close();

const ab = (hex) => rgbToOklab(hexToRgb(hex));
const lawAt = (A, B, t) => { const a = ab(A), b = ab(B); return lch(a.map((v, i) => v + (b[i] - v) * t)).C; }; // a straight line in OKLab
const srgbAt = (A, B, t) => { const a = hexToRgb(A), b = hexToRgb(B); return lch(rgbToOklab(a.map((v, i) => v + (b[i] - v) * t))).C; }; // a straight line in encoded sRGB
const r = (x, d = 4) => +x.toFixed(d);

const results = rows.map((row, k) => {
  const top = k * H;
  const samples = COLS.map((x) => {
    let sum = [0, 0, 0], n = 0;
    for (let y = top + 4; y < top + H - 4; y++) { const p = png.pixel(x, y); sum = sum.map((s, i) => s + p[i]); n++; }
    const rgb = sum.map((s) => s / n / 255);
    const t = (x + 0.5) / W;
    const measured = lch(rgbToOklab(rgb)).C;
    return { t: r(t, 5), rgb: rgb.map((v) => r(v * 255, 2)), measured: r(measured), law: r(lawAt(row.a.hex, row.b.hex, t)), srgb_mix: r(srgbAt(row.a.hex, row.b.hex, t)) };
  });
  return { a: row.a.name, b: row.b.name, mode: row.mode, css: row.css, samples };
});

const summarise = (mode) => {
  const rs = results.filter((x) => x.mode === mode);
  const mid = rs.map((x) => x.samples[1]);
  const all = rs.flatMap((x) => x.samples);
  const maxOff = (xs, key) => r(Math.max(...xs.map((s) => Math.abs(s.measured - s[key]))));
  return {
    pairs: rs.length,
    middle: { worst_vs_law: maxOff(mid, 'law'), worst_vs_srgb_mix: maxOff(mid, 'srgb_mix') },
    quarter_points_too: { worst_vs_law: maxOff(all, 'law'), worst_vs_srgb_mix: maxOff(all, 'srgb_mix') },
  };
};
// Lightness of the rendered middle, default against OKLab, pair by pair.
const midL = (x) => rgbToOklab(x.samples[1].rgb.map((v) => v / 255))[0];
const okRows = results.filter((x) => x.mode === 'oklab');
const lightness = okRows.map((o) => {
  const d = results.find((x) => x.mode === 'default' && x.a === o.a && x.b === o.b);
  return { a: o.a, b: o.b, oklab: r(midL(o)), default: r(midL(d)), diff: r(midL(d) - midL(o)) };
});
const summary = {
  browser: `Chromium ${version}`, band_px: W, palette: P.name, shade: SHADE, oklab: summarise('oklab'), default: summarise('default'),
  default_middle_darker: { pairs: lightness.filter((x) => x.diff < -0.005).length, of: lightness.length, most: lightness.reduce((m, x) => (x.diff < m.diff ? x : m)) },
};
fs.writeFileSync(path.join(OUT, 'rendered.json'), JSON.stringify({ summary, results }, null, 2) + '\n');
console.log(`${summary.browser}: ${pairs.length} pairs, each drawn ${W}px wide in two ways`);
for (const m of ['oklab', 'default']) {
  const s = summary[m];
  console.log(`  ${m.padEnd(8)} middle: law off by at most ${s.middle.worst_vs_law}, an sRGB mix off by at most ${s.middle.worst_vs_srgb_mix}; at the quarter points too: ${s.quarter_points_too.worst_vs_law} / ${s.quarter_points_too.worst_vs_srgb_mix}`);
}
const dk = summary.default_middle_darker;
console.log(`  the default's middle is darker than the OKLab middle (by more than 0.005 L) in ${dk.pairs} of ${dk.of} pairs; most: ${dk.most.a}+${dk.most.b}, L ${dk.most.default} against ${dk.most.oklab}`);
console.log(`wrote ${path.join(OUT, 'rendered.json')}`);
