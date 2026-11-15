// The three type checks: size (one ratio), line box (the band law) and tracking (em, tightening with size).
// Each takes plain numbers in px and returns what it measured, so it runs on any scale written as JSON.

const r = (x, d = 4) => +x.toFixed(d);

// Least-squares line y = a + b·x.
export const linfit = (xs, ys) => {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const b = sxy / sxx;
  return { a: my - b * mx, b };
};

// 1. Size. Fit S(n) = base·ratio^n to the distinct sizes in order (n = 0, 1, 2 …) and report each step's distance
// from the fitted ladder, as a share of the step. It describes the scale and passes no verdict: a scale built another
// way (Carbon adds pixels) isn't wrong for missing one ratio, so `fits_one_ratio` says only whether every step is
// within `tol` of it.
export const sizeCheck = (sizesPx, { tol = 0.1 } = {}) => {
  const sizes = [...new Set(sizesPx.map((s) => r(s, 3)))].sort((a, b) => a - b);
  const n = sizes.map((_, i) => i);
  const { a, b } = linfit(n, sizes.map(Math.log));
  const base = Math.exp(a), ratio = Math.exp(b);
  const steps = sizes.map((s, i) => {
    const fitted = base * ratio ** i;
    return { size: s, fitted: r(fitted, 2), off: r((s - fitted) / s, 4), ratio_to_previous: i ? r(s / sizes[i - 1], 3) : null };
  });
  const worst = steps.reduce((w, s) => (Math.abs(s.off) > Math.abs(w.off) ? s : w));
  return {
    law: 'S(n) = base × ratio^n',
    fitted: { base: r(base, 3), ratio: r(ratio, 4) },
    steps,
    worst: { size: worst.size, off: worst.off },
    within_tol: steps.filter((s) => Math.abs(s.off) <= tol).length,
    of: steps.length,
    tol,
    fits_one_ratio: steps.every((s) => Math.abs(s.off) <= tol),
  };
};

// 2. Line box. Two tests.
// (a) The line box grows with the size: of any two styles, the larger size never gets the same or a smaller line box.
// (b) The band law: the gap between lines (line box minus size) is the size minus k, up to a cap:
//     gap(S) = min(S − k, cap). k and cap are fitted to the ladder by search over whole pixels, choosing the pair that
//     leaves the fewest steps more than `tolPx` away, then the smallest total distance.
// A scale may state its band ({ k, cap }) instead of having one fitted, which a scale with few line boxes needs.
// Styles with no line height of their own (line_px null) are left out of both tests.
export const lineBoxCheck = (allStyles, ladder, { tolPx = 0.5, same = 0.5, band = null } = {}) => {
  const set = allStyles.filter((s) => s.line_px != null);
  const shared = [];
  for (const x of set) for (const y of set) {
    if (x.size_px < y.size_px && y.line_px <= x.line_px + same) {
      shared.push({ smaller: `${x.name} ${x.size_px}/${r(x.line_px, 2)}`, larger: `${y.name} ${y.size_px}/${r(y.line_px, 2)}`, kind: Math.abs(y.line_px - x.line_px) <= same ? 'shared line box' : 'smaller line box' });
    }
  }
  const pts = ladder.filter((s) => s.line_px != null).map((s) => ({ name: s.name, size: s.size_px, line: s.line_px, gap: s.line_px - s.size_px }));
  let best = band ? { k: band.k, cap: band.cap } : null;
  if (!band) for (let k = 0; k <= 16; k++) for (let cap = 0; cap <= 24; cap++) {
    const res = pts.map((p) => p.gap - Math.min(p.size - k, cap));
    const misses = res.filter((d) => Math.abs(d) > tolPx).length;
    const total = res.reduce((s, d) => s + Math.abs(d), 0);
    if (!best || misses < best.misses || (misses === best.misses && total < best.total - 1e-9)) best = { k, cap, misses, total };
  }
  const steps = pts.map((p) => {
    const want = Math.min(p.size - best.k, best.cap);
    return { name: p.name, size: p.size, line: r(p.line, 2), gap: r(p.gap, 2), band_gap: want, band_line: p.size + want, off_px: r(p.gap - want, 2), in_band: Math.abs(p.gap - want) <= tolPx };
  });
  // Every style with a line box, against the same band.
  const every = set.map((s) => {
    const want = Math.min(s.size_px - best.k, best.cap);
    return { name: s.name, size: s.size_px, line: r(s.line_px, 2), off_px: r(s.line_px - s.size_px - want, 2) };
  });
  return {
    law: 'gap = min(size − k, cap); line box = size + gap',
    fitted: { k: best.k, cap: best.cap },
    band_from: band ? 'stated by the scale file' : 'fitted to this scale',
    steps,
    in_band: steps.filter((s) => s.in_band).length,
    of: steps.length,
    every_style: { in_band: every.filter((s) => Math.abs(s.off_px) <= tolPx).length, of: every.length, off: every.filter((s) => Math.abs(s.off_px) > tolPx) },
    shared_or_shrinking: shared,
    pass: shared.length === 0,
  };
};

// 3. Tracking. Converts every value to em (a share of the type size), then tests:
// (a) the unit it is written in: em holds its proportion when the size changes, px does not;
// (b) it never loosens as the size grows: for any two styles, the larger size has the same or tighter tracking.
// A style marked "case": "upper" is set in capitals, which are usually spaced out on purpose, so capitals are compared
// only with capitals. The pairs that comparing everything together would have flagged are kept, so the exemption shows.
export const trackingCheck = (styles) => {
  const withT = styles.filter((s) => s.tracking);
  if (!withT.length) return { pass: null, note: 'No tracking is tied to a size in this scale.' };
  const units = [...new Set(withT.filter((s) => s.tracking.value !== 0).map((s) => s.tracking.unit))];
  const em = withT.map((s) => ({ name: s.name, size: s.size_px, upper: s.case === 'upper', em: r(s.tracking.unit === 'px' ? s.tracking.value / s.size_px : s.tracking.value, 5) }));
  const pairs = (xs) => {
    const out = [];
    for (const x of xs) for (const y of xs) if (x.size < y.size && y.em > x.em + 1e-9) out.push({ smaller: `${x.name} ${x.size}px ${x.em}em${x.upper ? ' capitals' : ''}`, larger: `${y.name} ${y.size}px ${y.em}em${y.upper ? ' capitals' : ''}` });
    return out;
  };
  const loosens = [...pairs(em.filter((e) => !e.upper)), ...pairs(em.filter((e) => e.upper))];
  const before = pairs(em);
  const bySize = {};
  for (const e of em) (bySize[e.size] ??= new Set()).add(e.em);
  return {
    written_in: units.length ? units.join(' and ') : 'only zero',
    em_by_size: Object.fromEntries(Object.entries(bySize).map(([s, v]) => [s, [...v].sort((a, b) => b - a)])),
    capitals: em.filter((e) => e.upper).map((e) => `${e.name} ${e.size}px ${e.em}em`),
    loosens_as_size_grows: loosens,
    flagged_if_capitals_were_not_marked: before.length > loosens.length ? before : [],
    pass_unit: units.every((u) => u === 'em'),
    pass_direction: loosens.length === 0,
    pass: units.every((u) => u === 'em') && loosens.length === 0,
  };
};

// The log law, t(S) = a + c·ln S (so c < 0 tightens with size), fitted to any curve given as points.
export const logFit = (pts) => {
  const { a, b: c } = linfit(pts.map((p) => Math.log(p.size)), pts.map((p) => p.em));
  const res = pts.map((p) => ({ size: p.size, em: r(p.em, 5), fitted: r(a + c * Math.log(p.size), 5), off: r(p.em - (a + c * Math.log(p.size)), 5) }));
  return {
    law: 't(S) = −k·ln(S / S0) em',
    fitted: { k: r(-c, 5), S0: r(Math.exp(-a / c), 2) },
    max_off_em: r(Math.max(...res.map((x) => Math.abs(x.off))), 5),
    points: res,
  };
};
