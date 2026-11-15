// The gradient check on a stylesheet. Finds every CSS gradient, works out which colour space the browser will mix it in,
// and computes the colour in the middle of each pair of neighbouring stops in that space.
// Usage: node check-css.mjs <file.css> [--keep 0.5]
// Exit code 1 when a middle keeps less than --keep of its weaker end's chroma, so it can stop a build.
//
// The space follows CSS Color 4 (§13.2): a gradient that names one ("to right in oklab") uses it; one that doesn't is
// mixed in Oklab, except that legacy sRGB colours (hex, named colours, rgb(), hsl(), hwb()) are mixed in gamma-encoded
// sRGB, for compatibility. Colours this script can read: hex, rgb()/rgba(), hsl()/hsla(), oklab() and oklch().
import fs from 'node:fs';
import { hexToRgb, rgbToOklab, lch, hueGap } from './lib/colour.mjs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--keep');
if (!file) { console.error('usage: node check-css.mjs <file.css> [--keep 0.5]'); process.exit(2); }
const KEEP = args.includes('--keep') ? +args[args.indexOf('--keep') + 1] : 0.5;
const GREY = 0.02; // an end with less chroma than this (one just-noticeable difference) is grey; the gate does not apply
const css = fs.readFileSync(file, 'utf8');
const r = (x, d = 4) => +x.toFixed(d);

// Split a string on commas that are not inside parentheses.
const splitTop = (s) => {
  const out = []; let depth = 0, cur = '';
  for (const c of s) {
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
};
const num = (t, pctOf = 1) => (t.endsWith('%') ? (parseFloat(t) / 100) * pctOf : parseFloat(t));
const angle = (t) => (t.endsWith('turn') ? parseFloat(t) * 360 : t.endsWith('rad') ? (parseFloat(t) * 180) / Math.PI : parseFloat(t));
const hslToRgb = (h, s, l) => {
  const f = (n) => { const k = (n + h / 30) % 12; const a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)];
};

// Reads the colour at the start of a stop. Returns { lab, legacy, text } or null.
const parseColour = (stop) => {
  const m = stop.match(/^(#[0-9a-f]{3,8}\b|[a-z-]+\([^)]*\))/i);
  if (!m) return null;
  const text = m[1];
  if (text.startsWith('#')) {
    let h = text.slice(1);
    if (h.length === 4 || h.length === 8) h = h.slice(0, h.length === 4 ? 3 : 6); // alpha is ignored
    if (h.length !== 3 && h.length !== 6) return null;
    return { lab: rgbToOklab(hexToRgb(h)), legacy: true, text };
  }
  const fn = text.slice(0, text.indexOf('(')).toLowerCase();
  const parts = text.slice(text.indexOf('(') + 1, -1).split('/')[0].replace(/,/g, ' ').trim().split(/\s+/);
  if (fn === 'rgb' || fn === 'rgba') return { lab: rgbToOklab(parts.slice(0, 3).map((t) => num(t, 255) / 255)), legacy: true, text };
  if (fn === 'hsl' || fn === 'hsla') return { lab: rgbToOklab(hslToRgb(angle(parts[0]), num(parts[1], 1) / (parts[1].endsWith('%') ? 1 : 100), num(parts[2], 1) / (parts[2].endsWith('%') ? 1 : 100))), legacy: true, text };
  if (fn === 'oklab') return { lab: [num(parts[0]), num(parts[1], 0.4), num(parts[2], 0.4)], legacy: false, text };
  if (fn === 'oklch') {
    const L = num(parts[0]), C = num(parts[1], 0.4), h = (angle(parts[2]) * Math.PI) / 180;
    return { lab: [L, C * Math.cos(h), C * Math.sin(h)], legacy: false, text };
  }
  return null;
};

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.sign(c) * Math.abs(c) ** (1 / 2.4) - 0.055);
const labToLinear = ([L, a, b]) => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
};
const clip = (v) => Math.min(1, Math.max(0, v));

// The colour halfway between two stops, mixed in the given space, as OKLab chroma.
const middle = (A, B, space) => {
  if (space === 'oklab') return lch(A.map((v, i) => (v + B[i]) / 2)).C;
  if (space === 'oklch') return (lch(A).C + lch(B).C) / 2; // chroma is mixed directly; the hue travels round the wheel
  if (space === 'srgb') {
    const [a, b] = [A, B].map((x) => labToLinear(x).map((v) => toGamma(clip(v))));
    return lch(rgbToOklab(a.map((v, i) => (v + b[i]) / 2))).C;
  }
  if (space === 'srgb-linear') {
    const [a, b] = [A, B].map((x) => labToLinear(x).map(clip));
    return lch(rgbToOklab(a.map((v, i) => toGamma((v + b[i]) / 2)))).C;
  }
  return null;
};

const results = [];
const re = /(?:repeating-)?(?:linear|radial|conic)-gradient\(/gi;
let m;
while ((m = re.exec(css))) {
  let depth = 1, i = m.index + m[0].length;
  for (; i < css.length && depth; i++) { if (css[i] === '(') depth++; if (css[i] === ')') depth--; }
  const body = css.slice(m.index + m[0].length, i - 1);
  const line = css.slice(0, m.index).split('\n').length;
  const selector = (css.slice(0, m.index).match(/([^{}]*)\{[^{}]*$/)?.[1] ?? '').trim().split('\n').pop().trim();
  const parts = splitTop(body);
  const head = parseColour(parts[0]) ? '' : parts.shift();
  const stated = head.match(/\bin\s+([a-z0-9-]+)/i)?.[1]?.toLowerCase() ?? null;
  const stops = parts.map((p) => ({ p, c: parseColour(p) })).filter((x) => x.c || !/^[-0-9.]+[a-z%]*$/i.test(x.p)); // drop bare hints
  const unreadable = stops.filter((x) => !x.c).map((x) => x.p);
  const colours = stops.filter((x) => x.c).map((x) => x.c);
  const space = stated ?? (!colours.length ? 'unknown (no colour it could read)' : colours.every((c) => c.legacy) ? 'srgb' : 'oklab');
  const pairs = [];
  for (let k = 0; k + 1 < colours.length; k++) {
    const [A, B] = [colours[k], colours[k + 1]];
    const [a, b] = [lch(A.lab), lch(B.lab)];
    const mid = middle(A.lab, B.lab, space);
    const weaker = Math.min(a.C, b.C);
    const judged = mid != null && weaker >= GREY;
    pairs.push({
      from: A.text, to: B.text, hue_gap: r(hueGap(a.h, b.h), 1), chroma: [r(a.C), r(b.C)],
      middle: mid == null ? null : r(mid), keeps: judged ? r(mid / weaker, 3) : null,
      verdict: mid == null ? `not computed (space ${space})` : !judged ? 'an end is grey; not judged' : mid / weaker >= KEEP ? 'pass' : 'fail',
    });
  }
  results.push({
    line, selector, gradient: m[0] + body + ')', space, space_stated: stated !== null,
    warning: stated === null && space === 'srgb' ? 'no space stated, and every colour is a legacy sRGB colour, so the browser mixes it in sRGB; add "in oklab" to get the middle the law predicts' : null,
    unreadable, pairs,
  });
}

const fails = results.flatMap((g) => g.pairs).filter((p) => p.verdict === 'fail').length;
console.log(`${file}: ${results.length} gradients, ${results.reduce((s, g) => s + g.pairs.length, 0)} pairs of neighbouring stops; gate: the middle keeps at least ${KEEP} of the weaker end's chroma`);
for (const g of results) {
  console.log(`\n  line ${g.line} ${g.selector || '(no selector)'}: mixed in ${g.space}${g.space_stated ? '' : ' (not stated)'}`);
  if (g.warning) console.log(`    warning: ${g.warning}`);
  for (const p of g.pairs) console.log(`    ${p.from} → ${p.to}: hue gap ${p.hue_gap}°, ends ${p.chroma.join(' / ')}, middle ${p.middle ?? '–'}${p.keeps != null ? ` (keeps ${p.keeps})` : ''}: ${p.verdict}`);
  if (g.unreadable.length) console.log(`    not read: ${g.unreadable.join('; ')}`);
}
console.log(`\n${fails} pair${fails === 1 ? '' : 's'} fail the gate; ${results.filter((g) => g.warning).length} gradient${results.filter((g) => g.warning).length === 1 ? '' : 's'} with no space stated`);
if (process.env.OUT_JSON) fs.writeFileSync(process.env.OUT_JSON, JSON.stringify({ file, keep: KEEP, gradients: results }, null, 2) + '\n');
process.exit(fails ? 1 : 0);
