// Counts the design roles in one day's sample, sorts them by level from the title alone, and reports how many are open
// to beginners (intern, graduate or entry level, junior, associate, level I). No network, no model calls.
//
// Usage:
//   node count.mjs runs/2027-10-12                       # a folder written by fetch.mjs
//   node count.mjs --csv my-titles.csv --date 2027-10-12 # titles you copied by hand from any job board
//   node count.mjs runs/2027-10-12 --where "Dubai|Abu Dhabi|UAE|United Arab Emirates"   # only roles in these places
//   node count.mjs runs/2027-10-12 --compare example-2026-10-12/results.json            # against an earlier day
//   --method "<text>" replaces the one-line description of where the roles came from; --out <folder> writes elsewhere.
//
// Writes results.json, results.md, design-roles.csv and excluded-titles.csv into the run folder (or --out <folder>).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { classify, EARLY_LEVELS, FAMILIES, LEVELS, SENIOR_LEVELS, level as levelOf } from "./rules.mjs";

// ---- arguments
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const csvPath = opt("--csv");
const runDir = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
if (!csvPath && !runDir) { console.error("Give a run folder (from fetch.mjs) or --csv <file>. See README.md."); process.exit(2); }
const where = opt("--where") ? new RegExp(opt("--where"), "i") : null;
const outDir = resolve(opt("--out") ?? (runDir ? runDir : dirname(resolve(csvPath))));
mkdirSync(outDir, { recursive: true });

// ---- read the sample: one entry per board (company), each with its roles
function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ""));
  const k = head.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(k.map((h, i) => [h, (r[i] ?? "").trim()])));
}

let boards, fetchedOn, failed = [], method;
if (csvPath) {
  const recs = parseCsv(readFileSync(resolve(csvPath), "utf8"));
  const byCo = new Map();
  for (const r of recs) {
    if (!r.title) continue;
    const co = r.company || "(no company given)";
    if (!byCo.has(co)) byCo.set(co, []);
    const y = r.years_asked === "" || r.years_asked == null ? null : Number(r.years_asked);
    byCo.get(co).push({ title: r.title, location: r.location ?? "", years_asked: Number.isFinite(y) ? y : null });
  }
  boards = [...byCo].map(([company, jobs]) => ({ company, jobs, n_jobs: jobs.length }));
  fetchedOn = opt("--date") ?? "(date not given: add --date YYYY-MM-DD)";
  method = `titles copied by hand into ${csvPath}`;
} else {
  const RAW = join(resolve(runDir), "raw");
  boards = readdirSync(RAW).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(RAW, f), "utf8")));
  const logPath = join(resolve(runDir), "fetch-log.json");
  const log = existsSync(logPath) ? JSON.parse(readFileSync(logPath, "utf8")) : null;
  fetchedOn = opt("--date") ?? log?.fetched_on ?? "(date unknown)";
  failed = boards.filter((b) => b.error || (b.status && b.status !== 200)).map((b) => ({ company: b.company, error: b.error ?? `HTTP ${b.status}` }));
  boards = boards.filter((b) => !(b.error || (b.status && b.status !== 200)));
  const platforms = [...new Set(boards.map((b) => b.platform).filter(Boolean))].sort().join(", ");
  method = `public job-board APIs (${platforms}), fetched by fetch.mjs`;
}

if (opt("--method")) method = opt("--method");

// ---- classify
const roles = [], excluded = [], unplaced = [], byCompany = {};
let totalJobs = 0;
for (const b of boards) {
  const jobs = where ? b.jobs.filter((j) => where.test(j.location ?? "")) : b.jobs;
  totalJobs += jobs.length;
  byCompany[b.company] = { all: jobs.length, design: 0, early: 0 };
  for (const j of jobs) {
    const c = classify(j.title);
    if (!c) continue;
    if (c.excluded) { excluded.push({ company: b.company, title: c.title, location: j.location, rule: c.excluded, level: c.level }); continue; }
    if (c.unplaced) { unplaced.push({ company: b.company, title: c.title, location: j.location }); continue; }
    roles.push({ company: b.company, title: c.title, location: j.location, family: c.family, level: c.level, early: c.early, years_asked: j.years_asked ?? null });
    byCompany[b.company].design++;
    if (c.early) byCompany[b.company].early++;
  }
}

const share = (n, d) => (d ? +(n / d).toFixed(3) : null);
const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : "n/a");
const num = (n) => Number(n).toLocaleString("en-GB");
const cos = (n) => `${n} ${n === 1 ? "company" : "companies"}`;
const distinct = [...new Map(roles.map((r) => [`${r.company}|${r.title.toLowerCase()}`, r])).values()];
const countBy = (arr) => Object.fromEntries(LEVELS.map((l) => [l, arr.filter((r) => r.level === l).length]));
const early = roles.filter((r) => r.early);
const earlyDistinct = distinct.filter((r) => r.early);
const earlyByCompany = Object.fromEntries([...new Set(early.map((r) => r.company))].sort().map((c) => [c, early.filter((r) => r.company === c).length]));
const stated = roles.filter((r) => r.years_asked != null);
const midStated = roles.filter((r) => r.level === "mid" && r.years_asked != null);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
const neighbours = excluded.filter((e) => /sensitivity/.test(e.rule));
const neighboursEarly = neighbours.filter((e) => EARLY_LEVELS.has(e.level ?? levelOf(e.title)));
const top = Object.entries(earlyByCompany).sort((a, b) => b[1] - a[1])[0];
const withoutTop = top ? roles.filter((r) => r.company !== top[0]) : roles;
const pd = roles.filter((r) => r.family === "product design and general" && /product design/i.test(r.title));
const senior = roles.filter((r) => SENIOR_LEVELS.has(r.level)).length;

const results = {
  label: "One day's sample. It shows no trend and can't show what caused the numbers.",
  fetched_on: fetchedOn,
  method,
  location_filter: where ? String(where) : null,
  companies: boards.length,
  boards_failed: failed,
  open_roles_all_kinds: totalJobs,
  design_postings: roles.length,
  design_postings_share_of_all: share(roles.length, totalJobs),
  companies_with_any_design_role: new Set(roles.map((r) => r.company)).size,
  distinct_design_titles: distinct.length,
  by_level: countBy(roles),
  by_level_distinct: countBy(distinct),
  by_family: Object.fromEntries(FAMILIES.map((f) => [f, { postings: roles.filter((r) => r.family === f).length, early: early.filter((r) => r.family === f).length }])),
  early_career: { postings: early.length, share: share(early.length, roles.length), distinct: earlyDistinct.length, companies: Object.keys(earlyByCompany).length, by_company: earlyByCompany,
    titles: [...new Set(early.map((r) => `${r.company}: ${r.title}`))] },
  senior_and_above: { postings: senior, share: share(senior, roles.length) },
  years_asked: {
    mid_title_five_plus: `${midStated.filter((r) => r.years_asked >= 5).length} of ${midStated.length}`,
    stated: stated.length, not_stated: roles.length - stated.length, median: median(stated.map((r) => r.years_asked)),
    bands: { "0 to 1": stated.filter((r) => r.years_asked <= 1).length, "2 to 4": stated.filter((r) => r.years_asked >= 2 && r.years_asked <= 4).length,
      "5 to 7": stated.filter((r) => r.years_asked >= 5 && r.years_asked <= 7).length, "8 or more": stated.filter((r) => r.years_asked >= 8).length },
    five_or_more: stated.filter((r) => r.years_asked >= 5).length,
  },
  open_to_under_two_years: (() => { const u = roles.filter((r) => r.early || (r.years_asked != null && r.years_asked < 2));
    return { postings: u.length, share: share(u.length, roles.length), by_title: early.length, by_text_only: u.length - early.length }; })(),
  excluded_titles: excluded.length,
  excluded_by_rule: Object.fromEntries([...new Set(excluded.map((e) => e.rule))].sort().map((r) => [r, excluded.filter((e) => e.rule === r).length])),
  unplaced_titles: unplaced.length,
  sensitivity: {
    as_counted: { postings: roles.length, early: early.length, share: share(early.length, roles.length) },
    with_game_industrial_learning_design: { postings: roles.length + neighbours.length, early: early.length + neighboursEarly.length,
      share: share(early.length + neighboursEarly.length, roles.length + neighbours.length) },
    distinct_titles_per_company: { roles: distinct.length, early: earlyDistinct.length, share: share(earlyDistinct.length, distinct.length) },
    without_largest_early_hirer: top ? { left_out: top[0], postings: withoutTop.length, early: withoutTop.filter((r) => r.early).length,
      share: share(withoutTop.filter((r) => r.early).length, withoutTop.length) } : null,
  },
  product_designer_titles_only: { postings: pd.length, early: pd.filter((r) => r.early).length, share: share(pd.filter((r) => r.early).length, pd.length),
    five_plus_years_of_stated: `${pd.filter((r) => r.years_asked >= 5).length} of ${pd.filter((r) => r.years_asked != null).length}` },
  by_company: byCompany,
  model_spend_usd: 0,
};

// ---- write
const csvCell = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCsv = (rows, cols) => [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n") + "\n";
writeFileSync(join(outDir, "results.json"), JSON.stringify(results, null, 1) + "\n");
writeFileSync(join(outDir, "design-roles.csv"), toCsv(roles, ["company", "title", "location", "family", "level", "early", "years_asked"]));
writeFileSync(join(outDir, "excluded-titles.csv"), toCsv([...excluded, ...unplaced.map((u) => ({ ...u, rule: "unplaced (no family matched)" }))], ["company", "title", "location", "rule"]));

const R = results, Y = R.years_asked, S = R.sensitivity;
const md = [
  `# Design roles open to beginners: one day's sample, ${R.fetched_on}`, "",
  `**What this is.** A count of the open roles on ${R.companies} job boards on ${R.fetched_on}, from ${R.method}${where ? `, keeping only roles whose location matches ${where}` : ""}. Levels come from the job title alone. It is one day's sample: it shows no trend, and it can't show what caused any of these numbers.`, "",
  "## Headline", "",
  "| | Count |", "|---|---|",
  `| Boards counted | ${R.companies}${failed.length ? ` (${failed.length} more failed: ${failed.map((f) => f.company).join(", ")})` : ""} |`,
  `| Open roles of every kind | ${num(R.open_roles_all_kinds)} |`,
  `| Design postings | ${R.design_postings} (${pct(R.design_postings, R.open_roles_all_kinds)} of all roles), at ${cos(R.companies_with_any_design_role)} |`,
  `| **Open to beginners** (intern, graduate or entry level, junior, associate, level I) | **${R.early_career.postings} of ${R.design_postings} (${pct(R.early_career.postings, R.design_postings)})**, at ${cos(R.early_career.companies)} |`,
  `| Senior and above (senior, lead, staff, principal, manager or director) | ${R.senior_and_above.postings} (${pct(R.senior_and_above.postings, R.design_postings)}) |`,
  `| Postings that name the years of experience they want | ${Y.stated}; of those, ${Y.five_or_more} ask for five or more (median ${Y.median ?? "n/a"}) |`, "",
  "## By level", "",
  "| Level | Postings | Distinct titles per company |", "|---|---|---|",
  ...LEVELS.map((l) => `| ${l === "mid" ? "no level in the title" : l} | ${R.by_level[l]} | ${R.by_level_distinct[l]} |`), "",
  "## Where the beginner roles are", "",
  Object.keys(R.early_career.by_company).length ? "By company: " + Object.entries(R.early_career.by_company).map(([c, n]) => `${c} ${n}`).join(", ") + "." : "None.", "",
  ...R.early_career.titles.map((t) => `- ${t}`), "",
  "## Same count, counted differently", "",
  "| Variant | Design postings | Open to beginners | Share |", "|---|---|---|---|",
  `| As counted | ${S.as_counted.postings} | ${S.as_counted.early} | ${pct(S.as_counted.early, S.as_counted.postings)} |`,
  `| With game, industrial and learning design | ${S.with_game_industrial_learning_design.postings} | ${S.with_game_industrial_learning_design.early} | ${pct(S.with_game_industrial_learning_design.early, S.with_game_industrial_learning_design.postings)} |`,
  `| Distinct titles per company | ${S.distinct_titles_per_company.roles} | ${S.distinct_titles_per_company.early} | ${pct(S.distinct_titles_per_company.early, S.distinct_titles_per_company.roles)} |`,
  S.without_largest_early_hirer ? `| Without the largest beginner hirer (${S.without_largest_early_hirer.left_out}) | ${S.without_largest_early_hirer.postings} | ${S.without_largest_early_hirer.early} | ${pct(S.without_largest_early_hirer.early, S.without_largest_early_hirer.postings)} |` : "| Without the largest beginner hirer | n/a | n/a | n/a |",
  `| Product-designer titles only | ${R.product_designer_titles_only.postings} | ${R.product_designer_titles_only.early} | ${pct(R.product_designer_titles_only.early, R.product_designer_titles_only.postings)} |`, "",
  "## Check the sorting", "",
  `${R.excluded_titles} titles were caught by the wide net and left out, each with a named rule (excluded-titles.csv). ${R.unplaced_titles} titles matched no family${R.unplaced_titles ? " and need a look" : ""}. Read design-roles.csv before you trust the level counts.`, "",
  "## What this can't show", "",
  "- A trend. It is one day. Count again on the same boards, in the same month of the year, before you say anything moved.",
  "- Hires. One posting can hire several people, one role can be posted in several cities, and some postings stay open all year.",
  "- Roles that never reach a public board. Many beginners arrive through referrals and internships.",
  "- Cause. A thin bottom rung fits several explanations, and a count of postings can't tell them apart.", "",
  "*Written by count.mjs (packs/count-the-entry-roles). No model was called.*",
].join("\n");
writeFileSync(join(outDir, "results.md"), md + "\n");
console.log(md);

// ---- compare with an earlier day, on the boards counted both times
// Reports the share open to beginners as counted, and with each day's largest beginner hirer left out, because on
// 12 October 2026 one company posting the same roles in several cities moved the share from 4.9% to 8.3%.
// The forecast in "Who trains the next judge?" needs both shares to be at least a quarter lower than on 12 October.
const cmp = opt("--compare");
if (cmp) {
  const before = JSON.parse(readFileSync(resolve(cmp), "utf8"));
  const common = Object.keys(before.by_company ?? {}).filter((c) => R.by_company[c]);
  const day = (bc) => {
    const design = common.reduce((a, c) => a + bc[c].design, 0), early = common.reduce((a, c) => a + bc[c].early, 0);
    const top = common.filter((c) => bc[c].early > 0).sort((x, y) => bc[y].early - bc[x].early)[0];
    const d2 = top ? design - bc[top].design : design, e2 = top ? early - bc[top].early : early;
    return { design, early, share: share(early, design), largest_beginner_hirer: top ?? null, without_largest: { design: d2, early: e2, share: share(e2, d2) } };
  };
  const b = day(before.by_company), a = day(R.by_company);
  const fall = (x, y) => (x ? +(1 - y / x).toFixed(3) : null);
  const f1 = fall(b.share, a.share), f2 = fall(b.without_largest.share, a.without_largest.share);
  const says = (f) => (f == null ? "not computable (the earlier share is zero)" : f === 0 ? "no change" : f > 0 ? `${(f * 100).toFixed(0)}% lower` : `${(-f * 100).toFixed(0)}% higher`);
  const quarter = f1 != null && f2 != null && f1 >= 0.25 && f2 >= 0.25;
  const lines = [
    "", `## Compared with ${before.fetched_on}, on the ${common.length} boards counted both times`, "",
    "| Day | Design postings | Open to beginners | Share | Without the largest beginner hirer | Share |", "|---|---|---|---|---|---|",
    `| ${before.fetched_on} | ${b.design} | ${b.early} | ${pct(b.early, b.design)} | ${b.without_largest.early} of ${b.without_largest.design} (${b.largest_beginner_hirer ?? "none"} left out) | ${pct(b.without_largest.early, b.without_largest.design)} |`,
    `| ${R.fetched_on} | ${a.design} | ${a.early} | ${pct(a.early, a.design)} | ${a.without_largest.early} of ${a.without_largest.design} (${a.largest_beginner_hirer ?? "none"} left out) | ${pct(a.without_largest.early, a.without_largest.design)} |`, "",
    `Change in the share: ${says(f1)} as counted, and ${says(f2)} without the largest beginner hirer. Both at least a quarter lower: ${quarter ? "yes" : "no"}.`, "",
    "Two days are two samples. A difference between them doesn't show a trend on its own, and it can't show why.",
  ].join("\n");
  writeFileSync(join(outDir, "results.md"), md + "\n" + lines + "\n");
  writeFileSync(join(outDir, "results.json"), JSON.stringify({ ...results, compared_with: { file: cmp, fetched_on: before.fetched_on, common_boards: common.length, before: b, now: a,
    share_fall: { as_counted: f1, without_largest_beginner_hirer: f2, both_at_least_a_quarter: quarter } } }, null, 1) + "\n");
  console.log(lines);
}
