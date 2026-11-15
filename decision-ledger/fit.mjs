// Fit an error rate from a decision ledger, instead of assuming one.
//
//   node fit.mjs ledger.csv                               # one file: decisions, with outcome columns filled in later
//   node fit.mjs decisions.jsonl outcomes.jsonl           # two files, joined on the decision id
//   node fit.mjs runs/2026-10-30/decisions.jsonl runs/2026-10-30/outcomes.jsonl \
//        --group decided_by,condition --by-outcome --out results.md --json results.json
//   node fit.mjs --selftest
//
// A decision row needs an `id` and an `answer`. Everything else is optional: `at` (when it was decided),
// `point` (the recurring decision it belongs to), `decided_by`, `confidence` (0-1 or 0-100, as the decider
// stated it), and any other column you want to group by. An outcome is either in the same row (`outcome`,
// `outcome_source`, `outcome_at`) or in its own file (`decision_id`, `outcome`, `source`, `recorded_at`, and
// `withdrawn` to void a row); the latest row for a decision wins. A `right` column (yes/no) overrides the
// comparison of answer and outcome, for decisions whose outcome is a verdict rather than an answer.
//
// What it reports, for each group (default: point and decided_by):
// - coverage: how many decisions have an outcome, and which are older than --stale-days without one;
// - the error rate among graded decisions, with an exact 95% interval (Clopper-Pearson);
// - what that rate has earned: "act" if the one-sided 95% upper bound on the error rate is within the act
//   budget (--act, default 0.05), "act and tell" if within the tell budget (--tell, default 0.20), else "ask";
//   and how many more outcomes in a row without an error it would take to reach the act budget;
// - stated confidence against what happened: the mean stated confidence beside the share that was right,
//   by confidence band, and whether higher confidence picked out the right answers at all (AUROC).
//
// Outcomes whose source is "applied" (the label records the option that was then carried out) are counted
// for coverage but not graded, because a label that copies the answer it labels can't show the answer was
// wrong. --count-applied grades them anyway.
//
// No packages; Node 18 or later.
import { readFileSync, writeFileSync } from "node:fs";

// ---------- exact binomial bounds ----------
const logFact = [0];
const lf = (n) => { for (let i = logFact.length; i <= n; i++) logFact[i] = logFact[i - 1] + Math.log(i); return logFact[n]; };
const logChoose = (n, k) => lf(n) - lf(k) - lf(n - k);
/** P(X <= k) for X ~ Binomial(n, p). */
export function binomCdf(k, n, p) {
  if (k < 0) return 0;
  if (k >= n) return 1;
  if (p <= 0) return 1;
  if (p >= 1) return 0;
  const lp = Math.log(p), lq = Math.log1p(-p);
  let max = -Infinity;
  const terms = [];
  for (let i = 0; i <= k; i++) { const t = logChoose(n, i) + i * lp + (n - i) * lq; terms.push(t); if (t > max) max = t; }
  return Math.min(1, Math.exp(max) * terms.reduce((s, t) => s + Math.exp(t - max), 0));
}
const bisect = (f, lo, hi) => { for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (f(mid)) hi = mid; else lo = mid; } return (lo + hi) / 2; };
/** One-sided upper bound at level alpha: the p at which seeing k or fewer errors in n has probability alpha. */
export function upper(k, n, alpha = 0.05) {
  if (n === 0) return 1;
  if (k >= n) return 1;
  return bisect((p) => binomCdf(k, n, p) <= alpha, k / n, 1);
}
/** One-sided lower bound at level alpha. */
export function lower(k, n, alpha = 0.05) {
  if (n === 0 || k === 0) return 0;
  return bisect((p) => 1 - binomCdf(k - 1, n, p) >= alpha, 0, k / n);
}
/** Exact (Clopper-Pearson) two-sided interval. */
export const exact95 = (k, n) => [lower(k, n, 0.025), upper(k, n, 0.025)];
/** Outcomes still needed, all without an error, before the one-sided 95% upper bound is within the budget. */
export function cleanNeeded(k, n, budget, cap = 1_000_000) {
  if (upper(k, n) <= budget) return 0;
  let hi = 1;
  while (upper(k, n + hi) > budget) { hi *= 2; if (hi > cap) return Infinity; }
  let lo = Math.floor(hi / 2);
  while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (upper(k, n + mid) <= budget) hi = mid; else lo = mid; }
  return hi;
}

// ---------- reading ledgers ----------
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((x) => x !== "")) rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}
function readRows(path) {
  const text = readFileSync(path, "utf8");
  if (path.endsWith(".csv")) return parseCsv(text);
  if (path.endsWith(".jsonl")) return text.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
  const v = JSON.parse(text);
  return Array.isArray(v) ? v : v.decisions ?? v.rows ?? [];
}
const blank = (v) => v === undefined || v === null || String(v).trim() === "";
const norm = (v) => String(v ?? "").trim().toLowerCase();
const truthy = (v) => ["1", "true", "yes", "right", "correct"].includes(norm(v));
const falsy = (v) => ["0", "false", "no", "wrong", "incorrect"].includes(norm(v));
function confidenceOf(v) {
  if (blank(v)) return null;
  const c = Number(String(v).replace("%", ""));
  if (!Number.isFinite(c) || c < 0) return null;
  return c > 1 ? Math.min(c, 100) / 100 : c;
}

export function join(decisionRows, outcomeRows = []) {
  const latest = new Map();
  for (const o of outcomeRows) {
    const id = o.decision_id ?? o.id;
    if (blank(id)) continue;
    const at = o.recorded_at ?? o.outcome_at ?? o.at ?? "";
    const prev = latest.get(id);
    if (!prev || String(at) >= String(prev.at)) latest.set(id, { outcome: o.outcome, source: o.source ?? o.outcome_source ?? "", at, withdrawn: truthy(o.withdrawn) || truthy(o.void), right: o.right });
  }
  return decisionRows.map((d) => {
    const o = latest.get(d.id);
    const inRow = !blank(d.outcome) || !blank(d.right);
    const out = o && !o.withdrawn ? o : inRow ? { outcome: d.outcome, source: d.outcome_source ?? "", at: d.outcome_at ?? "", right: d.right } : null;
    return { ...d, _confidence: confidenceOf(d.confidence), _outcome: out };
  });
}

// ---------- fitting ----------
function grade(d, countApplied) {
  const o = d._outcome;
  if (!o) return { state: "no outcome" };
  if (norm(o.source) === "applied" && !countApplied) return { state: "applied, not graded" };
  if (!blank(o.right)) return truthy(o.right) ? { state: "graded", right: true } : falsy(o.right) ? { state: "graded", right: false } : { state: "ungradable" };
  if (blank(d.answer) || blank(o.outcome)) return { state: "ungradable" };
  return { state: "graded", right: norm(d.answer) === norm(o.outcome) };
}
const pct = (x, digits = 1) => (x === null || x === undefined || Number.isNaN(x) ? "—" : `${(100 * x).toFixed(digits)}%`);
const round = (x, d = 4) => (x === null || x === undefined || !Number.isFinite(x) ? x : +x.toFixed(d));

function auroc(rows) {
  const r = rows.filter((x) => x.right && x.c !== null).map((x) => x.c);
  const w = rows.filter((x) => !x.right && x.c !== null).map((x) => x.c);
  if (!r.length || !w.length) return null;
  let s = 0;
  for (const a of r) for (const b of w) s += a > b ? 1 : a === b ? 0.5 : 0;
  return s / (r.length * w.length);
}

export function fit(rows, opts = {}) {
  const groupBy = opts.group ?? ["point", "decided_by"];
  const act = opts.act ?? 0.05, tell = opts.tell ?? 0.2;
  const bands = opts.bands ?? [0, 0.7, 0.8, 0.9, 0.95, 1, 1.0001];
  const times = rows.flatMap((d) => [d.at, d._outcome?.at]).filter((t) => !blank(t) && !Number.isNaN(Date.parse(t)));
  const now = opts.now ? Date.parse(opts.now) : times.length ? Math.max(...times.map((t) => Date.parse(t))) : Date.now();
  const staleMs = (opts.staleDays ?? 30) * 86_400_000;

  const graded = rows.map((d) => ({ d, g: grade(d, opts.countApplied) }));
  const states = {};
  for (const { g } of graded) states[g.state] = (states[g.state] ?? 0) + 1;
  const sources = {};
  for (const d of rows) if (d._outcome) { const s = d._outcome.source || "(none)"; sources[s] = (sources[s] ?? 0) + 1; }
  const stale = rows.filter((d) => !d._outcome && !blank(d.at) && now - Date.parse(d.at) > staleMs).map((d) => ({ id: d.id, at: d.at, point: d.point ?? "" }));

  const keyOf = (d) => groupBy.map((g) => (blank(d[g]) ? "(none)" : String(d[g]))).join(" · ");
  const groups = new Map();
  for (const x of graded) { const k = keyOf(x.d); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); }
  const all = ["(all)", graded];

  const summarise = ([key, xs]) => {
    const decisions = xs.length;
    const withOutcome = xs.filter((x) => x.d._outcome).length;
    const g = xs.filter((x) => x.g.state === "graded");
    const n = g.length, k = g.filter((x) => !x.g.right).length;
    const [lo, hi] = exact95(k, n);
    const ub = upper(k, n);
    const handling = n === 0 ? "ask (no graded outcome yet)" : ub <= act ? "act" : ub <= tell ? "act and tell" : "ask";
    const need = cleanNeeded(k, n, act);
    const conf = g.map((x) => ({ c: x.d._confidence, right: x.g.right })).filter((x) => x.c !== null);
    const meanConf = conf.length ? conf.reduce((s, x) => s + x.c, 0) / conf.length : null;
    const shareRightWithConf = conf.length ? conf.filter((x) => x.right).length / conf.length : null;
    const brier = conf.length ? conf.reduce((s, x) => s + (x.c - (x.right ? 1 : 0)) ** 2, 0) / conf.length : null;
    const meanOn = (want) => { const z = conf.filter((x) => x.right === want); return z.length ? z.reduce((s, x) => s + x.c, 0) / z.length : null; };
    const byBand = [];
    for (let i = 0; i < bands.length - 1; i++) {
      const z = conf.filter((x) => x.c >= bands[i] && x.c < bands[i + 1]);
      if (!z.length) continue;
      const r = z.filter((x) => x.right).length;
      const [blo, bhi] = exact95(r, z.length);
      byBand.push({ band: bands[i + 1] > 1 ? `${Math.round(bands[i] * 100)}` : `${Math.round(bands[i] * 100)}-${Math.round(bands[i + 1] * 100) - 1}`, n: z.length, mean_stated: round(z.reduce((s, x) => s + x.c, 0) / z.length), right: r, share_right: round(r / z.length), ci95: [round(blo), round(bhi)] });
    }
    const byOutcome = {};
    if (opts.byOutcome) {
      for (const x of g) {
        const o = String(x.d._outcome.outcome ?? "(verdict)");
        byOutcome[o] ??= { n: 0, wrong: 0, answered: {} };
        byOutcome[o].n++;
        if (!x.g.right) byOutcome[o].wrong++;
        const a = String(x.d.answer);
        byOutcome[o].answered[a] = (byOutcome[o].answered[a] ?? 0) + 1;
      }
      for (const v of Object.values(byOutcome)) { const [a, b] = exact95(v.wrong, v.n); v.error_rate = round(v.wrong / v.n); v.ci95 = [round(a), round(b)]; }
    }
    return {
      group: key, decisions, with_outcome: withOutcome, coverage: round(decisions ? withOutcome / decisions : 0),
      graded: n, wrong: k, error_rate: n ? round(k / n) : null, ci95: [round(lo), round(hi)], upper95: round(ub),
      earned: handling, clean_outcomes_to_act: Number.isFinite(need) ? need : "more than 1,000,000",
      confidence: conf.length ? { n: conf.length, mean_stated: round(meanConf), share_right: round(shareRightWithConf), gap_points: round(100 * (meanConf - shareRightWithConf), 1), mean_stated_when_right: round(meanOn(true)), mean_stated_when_wrong: round(meanOn(false)), brier: round(brier), auroc: round(auroc(conf)), by_band: byBand } : null,
      ...(opts.byOutcome ? { by_outcome: byOutcome } : {}),
    };
  };

  return {
    settings: { group: groupBy, act_budget: act, tell_budget: tell, stale_days: opts.staleDays ?? 30, as_of: new Date(now).toISOString(), count_applied: !!opts.countApplied, interval: "exact (Clopper-Pearson) 95%; budgets use the one-sided 95% upper bound" },
    decisions: rows.length, states, outcome_sources: sources,
    no_outcome_after_stale_days: stale.length, stale_examples: stale.slice(0, 20),
    all: summarise(all),
    groups: [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(summarise),
  };
}

// ---------- report ----------
export function markdown(r, title = "Decision ledger fit") {
  const L = [];
  L.push(`# ${title}`, "");
  L.push(`As of ${r.settings.as_of}. Grouped by ${r.settings.group.join(" and ")}. Error budgets: act alone if the one-sided 95% upper bound on the error rate is at most ${pct(r.settings.act_budget, 0)}, act and tell if at most ${pct(r.settings.tell_budget, 0)}, otherwise ask. Intervals: ${r.settings.interval}.`, "");
  L.push("## Coverage", "");
  L.push(`${r.decisions} decisions. ${Object.entries(r.states).map(([s, n]) => `${n} ${s}`).join(", ")}.`);
  if (Object.keys(r.outcome_sources).length) L.push(`Outcome sources: ${Object.entries(r.outcome_sources).map(([s, n]) => `${s} ${n}`).join(", ")}.`);
  L.push(`${r.no_outcome_after_stale_days} ${r.no_outcome_after_stale_days === 1 ? "decision is" : "decisions are"} older than ${r.settings.stale_days} days and still ${r.no_outcome_after_stale_days === 1 ? "has" : "have"} no outcome.`, "");
  L.push("## Error rate and what it has earned", "");
  L.push("| Group | Decisions | With outcome | Graded | Wrong | Error rate (95% interval) | Upper bound | Earned | Clean outcomes still needed to act |");
  L.push("|---|---|---|---|---|---|---|---|---|");
  for (const s of [r.all, ...r.groups]) {
    L.push(`| ${s.group} | ${s.decisions} | ${s.with_outcome} | ${s.graded} | ${s.wrong} | ${s.graded ? `${pct(s.error_rate)} (${pct(s.ci95[0])}–${pct(s.ci95[1])})` : "—"} | ${s.graded ? pct(s.upper95) : "—"} | ${s.earned} | ${s.clean_outcomes_to_act} |`);
  }
  L.push("");
  const withConf = [r.all, ...r.groups].filter((s) => s.confidence);
  if (withConf.length) {
    L.push("## Stated confidence against what happened", "");
    L.push("| Group | Graded with a stated confidence | Mean stated | Right | Gap (points) | Mean stated when right | Mean stated when wrong | AUROC | Brier |");
    L.push("|---|---|---|---|---|---|---|---|---|");
    for (const s of withConf) {
      const c = s.confidence;
      L.push(`| ${s.group} | ${c.n} | ${pct(c.mean_stated)} | ${pct(c.share_right)} | ${c.gap_points} | ${pct(c.mean_stated_when_right)} | ${pct(c.mean_stated_when_wrong)} | ${c.auroc ?? "—"} | ${c.brier} |`);
    }
    L.push("", "AUROC: the chance that a right answer was stated with more confidence than a wrong one (0.5 means confidence didn't tell them apart).", "");
    const a = r.all.confidence;
    if (a?.by_band?.length) {
      L.push("### All groups, by stated confidence", "", "| Stated | Answers | Mean stated | Right | Share right (95% interval) |", "|---|---|---|---|---|");
      for (const b of a.by_band) L.push(`| ${b.band} | ${b.n} | ${pct(b.mean_stated)} | ${b.right} | ${pct(b.share_right)} (${pct(b.ci95[0])}–${pct(b.ci95[1])}) |`);
      L.push("");
    }
  }
  if (r.all.by_outcome) {
    L.push("## Errors by outcome", "", "For each outcome, how often the decision was something else.", "");
    L.push("| Group | Outcome | Graded | Wrong | Error rate (95% interval) | Answered |", "|---|---|---|---|---|---|");
    for (const s of [r.all, ...r.groups]) for (const [o, v] of Object.entries(s.by_outcome ?? {}).sort()) {
      L.push(`| ${s.group} | ${o} | ${v.n} | ${v.wrong} | ${pct(v.error_rate)} (${pct(v.ci95[0])}–${pct(v.ci95[1])}) | ${Object.entries(v.answered).map(([a, n]) => `${a} ${n}`).join(", ")} |`);
    }
    L.push("");
  }
  return L.join("\n");
}

// ---------- self-test ----------
function selftest() {
  const near = (a, b, tol = 5e-4) => Math.abs(a - b) <= tol;
  const checks = [
    ["0 errors in 59: upper bound 4.95%, inside a 5% budget", near(upper(0, 59), 1 - 0.05 ** (1 / 59), 1e-9) && upper(0, 59) <= 0.05],
    ["0 errors in 58: upper bound above 5%", upper(0, 58) > 0.05],
    ["59 clean outcomes needed from nothing", cleanNeeded(0, 0, 0.05) === 59],
    ["299 clean outcomes needed for a 1% budget", cleanNeeded(0, 0, 0.01) === 299],
    ["exact interval for 5 of 10 is 18.7%-81.3%", near(exact95(5, 10)[0], 0.1871) && near(exact95(5, 10)[1], 0.8129)],
    ["exact interval for 0 of 10 is 0%-30.8%", exact95(0, 10)[0] === 0 && near(exact95(0, 10)[1], 0.3085)],
    ["one error after 59 clean ones leaves the bound above 5%", upper(1, 60) > 0.05],
    ["an applied label is counted but not graded", grade({ answer: "a", _outcome: { outcome: "a", source: "applied" } }).state === "applied, not graded"],
    ["a verdict column overrides the answer comparison", grade({ answer: "a", _outcome: { outcome: "b", right: "yes" } }).right === true],
    ["the latest outcome row wins, a withdrawn one voids", (() => { const j = join([{ id: "x", answer: "A" }], [{ decision_id: "x", outcome: "B", recorded_at: "2026-01-01" }, { decision_id: "x", outcome: "A", recorded_at: "2026-02-01" }]); const w = join([{ id: "y", answer: "A" }], [{ decision_id: "y", outcome: "A", recorded_at: "2026-01-01", withdrawn: "yes" }]); return j[0]._outcome.outcome === "A" && w[0]._outcome === null; })()],
    ["CSV with quoted commas and quotes", (() => { const r = parseCsv('id,answer,note\n1,ACT,"a, ""b"""\n'); return r[0].note === 'a, "b"' && r[0].answer === "ACT"; })()],
    ["confidence 0-100 and 0-1 both read", confidenceOf("95") === 0.95 && confidenceOf(0.8) === 0.8 && confidenceOf("") === null],
    ["AUROC 1 when confidence separates right from wrong", auroc([{ c: 0.9, right: true }, { c: 0.5, right: false }]) === 1],
  ];
  let failed = 0;
  for (const [name, ok] of checks) { if (!ok) failed++; console.log(`${ok ? "ok  " : "FAIL"}  ${name}`); }
  console.log(`\nselftest: ${checks.length - failed} pass, ${failed} fail`);
  return failed ? 1 : 0;
}

// ---------- command line ----------
if (import.meta.url === new URL(process.argv[1], "file://").href || process.argv[1]?.endsWith("fit.mjs")) {
  const argv = process.argv.slice(2);
  if (argv.includes("--selftest")) process.exit(selftest());
  const files = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => argv[++i];
    if (a === "--group") opt.group = val().split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--act") opt.act = Number(val());
    else if (a === "--tell") opt.tell = Number(val());
    else if (a === "--stale-days") opt.staleDays = Number(val());
    else if (a === "--now") opt.now = val();
    else if (a === "--by-outcome") opt.byOutcome = true;
    else if (a === "--count-applied") opt.countApplied = true;
    else if (a === "--title") opt.title = val();
    else if (a === "--out") opt.out = val();
    else if (a === "--json") opt.json = val();
    else if (a.startsWith("--")) { console.error(`unknown option ${a}`); process.exit(2); }
    else files.push(a);
  }
  if (!files.length) { console.error("usage: node fit.mjs <ledger.csv | decisions.jsonl> [outcomes.jsonl|.csv] [--group a,b] [--by-outcome] [--act 0.05] [--tell 0.2] [--stale-days 30] [--now ISO] [--count-applied] [--out report.md] [--json report.json]"); process.exit(2); }
  const rows = join(readRows(files[0]), files[1] ? readRows(files[1]) : []);
  const missing = rows.filter((d) => blank(d.id)).length;
  if (missing) { console.error(`${missing} decision rows have no id; give every decision an id when it is made.`); process.exit(1); }
  const result = fit(rows, opt);
  const md = markdown(result, opt.title);
  if (opt.out) writeFileSync(opt.out, md + "\n"); else console.log(md);
  if (opt.json) writeFileSync(opt.json, JSON.stringify(result, null, 1) + "\n");
  if (opt.out || opt.json) console.log(`wrote ${[opt.out, opt.json].filter(Boolean).join(" and ")}`);
}
