// Fetches the open roles on a fixed list of public job boards (Greenhouse, Lever and Ashby; none needs a login or a key),
// one request at a time with a pause between requests. For each role it keeps only the title, the location and the
// years of experience the posting text asks for (a rough number, see rules.mjs). Posting text is read in memory and
// not saved. No names, recruiter details, salaries or applicant data are kept.
//
// Usage:
//   node fetch.mjs                          # the 80 boards in boards.json, into runs/<today>/
//   node fetch.mjs my-boards.json           # your own list
//   node fetch.mjs my-boards.json runs/x    # your own list, your own folder
// Then: node count.mjs runs/<today>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { yearsAsked } from "./rules.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const listPath = resolve(process.argv[2] ?? join(here, "boards.json"));
const today = new Date().toISOString().slice(0, 10);
const outDir = resolve(process.argv[3] ?? join(here, "runs", today));
const RAW = join(outDir, "raw");
mkdirSync(RAW, { recursive: true });

const list = JSON.parse(readFileSync(listPath, "utf8"));
const BOARDS = Array.isArray(list) ? list : list.boards;
const PAUSE_MS = Number(process.env.PAUSE_MS ?? 1500);
const UA = process.env.USER_AGENT ?? "count-the-entry-roles (personal research, one request at a time)";

const url = (p, t) => p === "greenhouse" ? `https://boards-api.greenhouse.io/v1/boards/${t}/jobs?content=true`
  : p === "lever" ? `https://api.lever.co/v0/postings/${t}?mode=json`
  : p === "ashby" ? `https://api.ashbyhq.com/posting-api/job-board/${t}`
  : null;

const decode = (s) => String(s ?? "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const plain = (html) => decode(decode(html)).replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();

function rows(platform, d) {
  if (platform === "greenhouse") return (d.jobs ?? []).map((j) => ({ title: j.title, location: j.location?.name ?? "", text: plain(j.content) }));
  if (platform === "lever") return (Array.isArray(d) ? d : []).map((j) => ({ title: j.text, location: j.categories?.location ?? "",
    text: [j.descriptionPlain, ...(j.lists ?? []).map((l) => `${l.text}: ${plain(l.content)}`), j.additionalPlain].join(" ") }));
  return (d.jobs ?? []).map((j) => ({ title: j.title, location: j.location ?? "", text: j.descriptionPlain ?? plain(j.descriptionHtml) }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];
for (const { company, platform, token } of BOARDS) {
  const started = new Date().toISOString();
  let status = 0, error = null, jobs = [];
  const u = url(platform, token);
  if (!u) error = `unknown platform "${platform}"`;
  else {
    try {
      const r = await fetch(u, { headers: { "User-Agent": UA, Accept: "application/json" } });
      status = r.status;
      if (r.ok) jobs = rows(platform, await r.json());
      else error = `HTTP ${r.status}`;
    } catch (e) { error = String(e.message).slice(0, 120); }
  }
  const kept = jobs.map(({ title, location, text }) => ({ title: String(title ?? "").trim(), location: String(location ?? "").trim(), years_asked: yearsAsked(text) }));
  writeFileSync(join(RAW, `${company.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}.json`),
    JSON.stringify({ company, platform, token, fetched_utc: started, status, error, n_jobs: kept.length, jobs: kept }, null, 1));
  log.push({ company, platform, token, fetched_utc: started, status, error, n_jobs: kept.length });
  console.log(`${company.padEnd(16)} ${platform.padEnd(10)} ${status} ${kept.length}${error ? " " + error : ""}`);
  await sleep(PAUSE_MS);
}
writeFileSync(join(outDir, "fetch-log.json"), JSON.stringify({ fetched_on: today, list: listPath, pause_ms: PAUSE_MS, user_agent: UA, boards: log }, null, 1));
const failed = log.filter((b) => b.error || b.status !== 200);
console.log(`\n${log.length - failed.length} of ${log.length} boards answered. Written to ${outDir}`);
if (failed.length) console.log("Failed: " + failed.map((b) => `${b.company} (${b.error})`).join(", "));
