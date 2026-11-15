#!/usr/bin/env node
// Can your gate fire? Run a check on a clean input and on inputs where you planted a known defect, and record
// whether it fired.
//
// A check here is any command that ends with exit code 0 when the input passes and 1 when it fails. Put {input}
// where the file name goes. Any other exit code, or a command that can't start, is recorded as "could not run",
// never as a pass.
//
//   node can-it-fire.mjs --check "python3 my_check.py {input}" --clean good.mp4 \
//        --planted frozen-6s.mp4 --planted shaky.mp4 [--name "freeze check"] [--out results]
//
// Options:
//   --check "<command>"   the check, with {input} where the file goes (quote it)
//   --clean <file>        an input you know is good; the check should pass it
//   --planted <file>      an input with one defect you planted on purpose; repeat for more
//   --name <text>         what to call the check in the results (default: the command)
//   --pass-codes 0        exit codes that mean pass (comma-separated; default 0)
//   --fail-codes 1        exit codes that mean the check fired (default 1)
//   --timeout 600         seconds before a run is stopped and recorded as "could not run" (default 600)
//   --out <name>          write <name>.json and <name>.md (default: can-it-fire-results)
//
// Exit code: 0 when the check passed the clean input and fired on every planted input, 1 otherwise, 2 for usage.
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const argv = process.argv.slice(2);
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const all = (k) => argv.flatMap((a, i) => (a === k && argv[i + 1] ? [argv[i + 1]] : []));
const codes = (s) => s.split(",").map((x) => Number(x.trim())).filter(Number.isInteger);

const check = opt("--check");
const clean = opt("--clean");
const planted = all("--planted");
if (!check || !check.includes("{input}") || !clean || !planted.length) {
  console.error('usage: node can-it-fire.mjs --check "<command with {input}>" --clean <good file> --planted <bad file> [--planted …]');
  process.exit(2);
}
const name = opt("--name", check);
const passCodes = codes(opt("--pass-codes", "0"));
const failCodes = codes(opt("--fail-codes", "1"));
const timeoutS = Number(opt("--timeout", "600"));
const out = opt("--out", "can-it-fire-results");

// The file name is quoted for the shell, so a path with spaces or quotes stays one argument.
const quote = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

function run(file) {
  if (!existsSync(file)) return { file, outcome: "could not run", code: null, seconds: 0, note: "file not found" };
  const cmd = check.split("{input}").join(quote(file));
  const t0 = Date.now();
  const r = spawnSync(cmd, { shell: true, encoding: "utf8", timeout: timeoutS * 1000, maxBuffer: 1 << 26 });
  const seconds = +((Date.now() - t0) / 1000).toFixed(1);
  const tail = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split("\n").slice(-3).join(" | ").slice(0, 300);
  if (r.error || r.status === null) return { file, outcome: "could not run", code: r.status, seconds, note: r.error?.message ?? `stopped (${r.signal ?? "timeout"})` };
  if (passCodes.includes(r.status)) return { file, outcome: "pass", code: r.status, seconds, note: tail };
  if (failCodes.includes(r.status)) return { file, outcome: "fail", code: r.status, seconds, note: tail };
  return { file, outcome: "could not run", code: r.status, seconds, note: `exit ${r.status} is neither a pass nor a fail code; ${tail}` };
}

const c = run(clean);
const cleanVerdict = c.outcome === "pass" ? "passes the clean input, as it should"
  : c.outcome === "fail" ? "fails the clean input: a false alarm, so a fail on a planted input proves nothing yet"
  : "could not run on the clean input";
const rows = planted.map((file) => {
  const p = run(file);
  const verdict = p.outcome === "could not run" ? "not measured"
    : p.outcome === "fail" && c.outcome === "pass" ? "fires"
    : p.outcome === "fail" ? "fails, but it also fails the clean input"
    : "silent: it passed an input you know is bad";
  return { ...p, verdict };
});
const ok = c.outcome === "pass" && rows.every((r) => r.verdict === "fires");

const result = { check: name, command: check, date: new Date().toISOString().slice(0, 10), pass_codes: passCodes, fail_codes: failCodes,
  clean: { ...c, verdict: cleanVerdict }, planted: rows,
  summary: ok ? "The check can fire: it passed the clean input and failed every planted one."
    : rows.some((r) => r.verdict.startsWith("silent")) ? "The check stayed green on at least one input you know is bad. Its passes on that kind of defect are not evidence."
    : "The check could not be shown to fire. See the rows." };

const md = [
  `# Can it fire? ${name}`, "",
  `${result.date} · \`${check}\``, "",
  "| Input | Kind | Check said | Exit code | What it means |", "|---|---|---|---|---|",
  `| ${basename(clean)} | clean | ${c.outcome} | ${c.code ?? "-"} | ${cleanVerdict} |`,
  ...rows.map((r) => `| ${basename(r.file)} | planted | ${r.outcome} | ${r.code ?? "-"} | ${r.verdict} |`), "",
  result.summary, "",
].join("\n");

writeFileSync(`${out}.json`, JSON.stringify(result, null, 1) + "\n");
writeFileSync(`${out}.md`, md);
console.log(md);
process.exit(ok ? 0 : 1);
