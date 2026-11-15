// Colour arithmetic for the gradient check: sRGB hex <-> OKLab <-> OKLCH, and the midpoint law.
// OKLab matrices are Björn Ottosson's, as published at https://bottosson.github.io/posts/oklab/ (2020).

export const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
};

export const rgbToHex = (rgb) =>
  '#' + rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('');

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.sign(c) * Math.abs(c) ** (1 / 2.4) - 0.055);

// Encoded sRGB (0..1 per channel) to OKLab [L, a, b].
export const rgbToOklab = ([r, g, b]) => {
  const [lr, lg, lb] = [r, g, b].map(toLinear);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

// OKLab to linear sRGB, unclipped, so a caller can see whether a colour is outside the sRGB gamut.
export const oklabToLinear = ([L, a, b]) => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
};

export const oklabToRgb = (lab) => oklabToLinear(lab).map(toGamma);

export const inGamut = (lab, eps = 1e-4) => oklabToLinear(lab).every((c) => c >= -eps && c <= 1 + eps);

export const lch = ([L, a, b]) => {
  const C = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C, h };
};

export const hexToLch = (hex) => lch(rgbToOklab(hexToRgb(hex)));

// Smallest angle between two hues, in degrees (0..180).
export const hueGap = (h1, h2) => {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
};

// The law. A gradient drawn as a straight line in OKLab passes through the average of its two ends, and the chroma of
// that average is the length of the sum of two vectors of length Ca and Cb at an angle dh, halved:
//   C_mid = ½·√(Ca² + Cb² + 2·Ca·Cb·cos dh)
// With equal chroma C this is C·cos(dh/2).
export const midpointChroma = (Ca, Cb, dhDegrees) => {
  const dh = (dhDegrees * Math.PI) / 180;
  return 0.5 * Math.sqrt(Math.max(0, Ca * Ca + Cb * Cb + 2 * Ca * Cb * Math.cos(dh)));
};

// The midpoint as a mixer in code would produce it: average in OKLab, convert, clip and round to 8-bit hex.
export const mixHex = (hexA, hexB, t = 0.5) => {
  const A = rgbToOklab(hexToRgb(hexA));
  const B = rgbToOklab(hexToRgb(hexB));
  const M = A.map((v, i) => v + (B[i] - v) * t);
  return { lab: M, hex: rgbToHex(oklabToRgb(M)), inGamut: inGamut(M) };
};

// The midpoint of the browser's legacy default for hex colours: an average of the encoded sRGB values.
export const mixHexSrgb = (hexA, hexB, t = 0.5) => {
  const A = hexToRgb(hexA);
  const B = hexToRgb(hexB);
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t));
};
