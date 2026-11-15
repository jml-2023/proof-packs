#!/usr/bin/env node
// A receipt for one file, bound to its bytes.
//
// A receipt records the file's SHA-256 (a 64-character fingerprint computed from every byte, so changing one byte
// changes it), its size, what it measured (duration and frames for a film, width and height for a picture), every
// check that ran, and who accepted it and when. Four rules, each enforced rather than written down:
//
//   1. `verify` hashes the file again and refuses a receipt whose file has changed since it was written.
//   2. A required check that is missing or did not run is not a pass. There is no default "ok".
//   3. Acceptance is a person's name and a date, recorded against the hash, or it is absent.
//   4. A receipt follows bytes, not paths: `find` looks for the bytes by hash, and `relink` moves a receipt to a new
//      path only when the file there has the same hash.
//
//   node receipt.mjs write  <file> [--check id=status[=value]]… [--block id]… [--require id]… [--out receipt.json]
//   node receipt.mjs verify <receipt.json>… [--file path] [--json]
//   node receipt.mjs accept <receipt.json> --name "Your Name" [--at 2026-10-30]
//   node receipt.mjs find   <receipt.json> --in <folder>
//   node receipt.mjs relink <receipt.json> <new path>
//   node receipt.mjs index  <folder>
//
// Needs Node 18 or later. Uses ffprobe for media facts when it is installed, and works without it.
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, dirname, join, relative, resolve } from "node:path";

export const VERSION = 1;
const STATUSES = new Set(["pass", "fail", "warn", "not-run"]);

export function sha256(path) {
  return new Promise((ok, fail) => {
    const h = createHash("sha256");
    createReadStream(path).on("data", (d) => h.update(d)).on("end", () => ok(h.digest("hex"))).on("error", fail);
  });
}

/** Duration, frames and size from ffprobe, or null when ffprobe is missing or the file is not media. */
export function mediaFacts(path) {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,nb_frames,avg_frame_rate",
    "-of", "json", path], { encoding: "utf8" });
  if (r.error || r.status !== 0) return null;
  let j; try { j = JSON.parse(r.stdout); } catch { return null; }
  const v = (j.streams ?? []).find((s) => s.codec_type === "video");
  if (!v) return null;
  const duration = Number(j.format?.duration);
  const frames = Number(v.nb_frames);
  const still = !Number.isFinite(duration) || (Number.isFinite(frames) && frames <= 1);
  return still ? { width: v.width, height: v.height }
    : { width: v.width, height: v.height, duration_s: +duration.toFixed(2), frames: Number.isFinite(frames) ? frames : null };
}

const describe = (m) => !m ? null : m.duration_s != null
  ? `${m.duration_s.toFixed(2)} s, ${m.frames ?? "?"} frames, ${m.width}×${m.height}` : `${m.width}×${m.height}`;

export async function writeReceipt(file, { checks = [], required = [], out = null } = {}) {
  const path = resolve(file);
  if (!existsSync(path)) throw new Error(`no such file: ${file}`);
  for (const c of checks) if (!STATUSES.has(c.status)) throw new Error(`check ${c.id}: status must be pass, fail, warn or not-run`);
  const receipt = {
    receipt: VERSION,
    file: { path, name: basename(path), sha256: await sha256(path), bytes: statSync(path).size, media: mediaFacts(path) },
    written_at: new Date().toISOString(),
    checks,
    required: [...new Set(required)],
    verdict: checks.some((c) => c.blocking && c.status === "fail") ? "blocked"
      : checks.some((c) => c.status === "not-run") || required.some((id) => !checks.find((c) => c.id === id)) ? "incomplete" : "pass",
    acceptance: null,
  };
  const target = out ?? `${path}.receipt.json`;
  save(receipt, target);
  return { receipt, path: target };
}

function save(receipt, target) {
  const tmp = `${target}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(receipt, null, 1) + "\n");
  renameSync(tmp, target);
}

export const readReceipt = (p) => JSON.parse(readFileSync(p, "utf8"));

/** Every reason this receipt does not describe the file. Empty means it does. */
export async function verify(receipt, file = null) {
  const reasons = [];
  if (receipt?.receipt !== VERSION || !receipt.file?.sha256) return { ok: false, reasons: ["not a receipt this tool wrote, so it cannot be checked"] };
  const target = file ? resolve(file) : receipt.file.path;
  if (!existsSync(target)) {
    return { ok: false, missing: true, target, reasons: [`no file at ${target}: it was moved, renamed or deleted (try: find --in <folder>)`] };
  }
  const actual = await sha256(target);
  if (actual !== receipt.file.sha256) {
    const now = mediaFacts(target), then = receipt.file.media;
    const facts = then && now && describe(then) !== describe(now) ? `; the receipt says ${describe(then)}, the file is ${describe(now)}` : "";
    reasons.push(`the file changed after its receipt: sha256 ${actual.slice(0, 12)} on disk, ${receipt.file.sha256.slice(0, 12)} in the receipt${facts}`);
  }
  for (const id of receipt.required ?? []) {
    const row = receipt.checks.find((c) => c.id === id);
    if (!row) reasons.push(`required check "${id}" is missing: not run is not passed`);
    else if (row.status === "not-run") reasons.push(`required check "${id}" did not run`);
  }
  const blocked = receipt.checks.filter((c) => c.blocking && c.status === "fail").map((c) => c.id);
  if (blocked.length) reasons.push(`blocking check failed: ${blocked.join(", ")}`);
  const a = receipt.acceptance;
  if (a && !(a.name && a.at && a.sha256 === receipt.file.sha256)) reasons.push("acceptance is recorded without a name, a date and this file's hash");
  return { ok: reasons.length === 0, target, sha256: actual, reasons };
}

export async function accept(receiptPath, { name, at = new Date().toISOString().slice(0, 10) }) {
  if (!name) return { ok: false, reasons: ["acceptance needs a person's name"] };
  const r = readReceipt(receiptPath);
  const v = await verify(r);
  const reasons = [...v.reasons];
  if (r.verdict !== "pass") reasons.push(`the receipt's verdict is ${r.verdict}, not pass`);
  if (reasons.length) return { ok: false, reasons };
  r.acceptance = { name, at, sha256: r.file.sha256 };
  save(r, receiptPath);
  return { ok: true, reasons: [] };
}

/** Every file under `dir` with the receipt's bytes. Files of a different size are skipped without hashing. */
export async function find(receipt, dir) {
  const hits = [];
  const walk = async (d) => {
    let entries = [];
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) { if (!/^(node_modules|\.git|\.venv)$/.test(e.name)) await walk(p); }
      else if (e.isFile() && statSync(p).size === receipt.file.bytes && (await sha256(p)) === receipt.file.sha256) hits.push(p);
    }
  };
  await walk(resolve(dir));
  return hits;
}

export async function relink(receiptPath, newPath) {
  const r = readReceipt(receiptPath);
  const p = resolve(newPath);
  if (!existsSync(p)) return { ok: false, reasons: [`no file at ${p}`] };
  const actual = await sha256(p);
  if (actual !== r.file.sha256) return { ok: false, reasons: [`refused: the file at ${p} has sha256 ${actual.slice(0, 12)}, the receipt is for ${r.file.sha256.slice(0, 12)}`] };
  r.file.path = p;
  r.file.name = basename(p);
  save(r, receiptPath);
  return { ok: true, reasons: [] };
}

export async function index(dir) {
  const found = [];
  const walk = (d) => {
    let entries = [];
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) { if (!/^(node_modules|\.git|\.venv)$/.test(e.name)) walk(p); }
      else if (/(^|\.)receipt\.json$/.test(e.name)) found.push(p);
    }
  };
  walk(resolve(dir));
  const rows = [];
  for (const p of found.sort()) {
    let r; try { r = readReceipt(p); } catch { rows.push({ receipt: p, ok: false, reasons: ["not readable JSON"] }); continue; }
    const v = await verify(r);
    rows.push({ receipt: p, ok: v.ok, reasons: v.reasons, accepted: r.acceptance?.name ?? null, verdict: r.verdict ?? null });
  }
  return rows;
}

// ---------- command line ----------
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const [cmd, ...a] = process.argv.slice(2);
  const TAKES_VALUE = new Set(["--check", "--block", "--require", "--out", "--file", "--name", "--at", "--in"]);
  const flags = [], positional = [];
  for (let i = 0; i < a.length; i++) {
    if (TAKES_VALUE.has(a[i])) { flags.push([a[i], a[i + 1]]); i++; }
    else if (a[i].startsWith("--")) flags.push([a[i], true]);
    else positional.push(a[i]);
  }
  const opt = (f) => flags.find(([k]) => k === f)?.[1] ?? null;
  const many = (f) => flags.filter(([k, v]) => k === f && typeof v === "string").map(([, v]) => v);
  const usage = () => { console.error(readFileSync(new URL(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//   node")).map((l) => l.slice(5)).join("\n")); process.exit(2); };
  if (cmd === "write") {
    if (!positional[0]) usage();
    const blocking = new Set(many("--block"));
    const checks = many("--check").map((s) => {
      const [id, status, ...rest] = s.split("=");
      return { id, status, value: rest.length ? rest.join("=") : null, blocking: blocking.has(id) };
    });
    const { receipt, path } = await writeReceipt(positional[0], { checks, required: many("--require"), out: opt("--out") });
    console.log(`wrote ${path}\n  ${receipt.file.name} sha256 ${receipt.file.sha256.slice(0, 12)} ${describe(receipt.file.media) ?? ""} verdict ${receipt.verdict}`);
  } else if (cmd === "verify") {
    if (!positional.length) usage();
    let bad = 0; const out = [];
    for (const p of positional) {
      const v = await verify(readReceipt(p), opt("--file"));
      out.push({ receipt: p, ...v });
      if (!a.includes("--json")) { console.log(`${v.ok ? "OK   " : "STALE"} ${p}`); for (const x of v.reasons) console.log(`        ${x}`); }
      if (!v.ok) bad++;
    }
    if (a.includes("--json")) console.log(JSON.stringify(out, null, 1));
    process.exit(bad ? 1 : 0);
  } else if (cmd === "accept") {
    if (!positional[0]) usage();
    const r = await accept(positional[0], { name: opt("--name"), at: opt("--at") ?? undefined });
    console.log(r.ok ? `accepted: ${positional[0]}` : `refused: ${r.reasons.join("; ")}`);
    process.exit(r.ok ? 0 : 1);
  } else if (cmd === "find") {
    if (!positional[0] || !opt("--in")) usage();
    const r = readReceipt(positional[0]);
    const hits = await find(r, opt("--in"));
    console.log(hits.length ? hits.map((h) => `found ${r.file.sha256.slice(0, 12)} at ${h}`).join("\n") : `no file under ${opt("--in")} has sha256 ${r.file.sha256.slice(0, 12)}`);
    process.exit(hits.length ? 0 : 1);
  } else if (cmd === "relink") {
    if (positional.length < 2) usage();
    const r = await relink(positional[0], positional[1]);
    console.log(r.ok ? `relinked ${positional[0]} to ${resolve(positional[1])}` : r.reasons.join("; "));
    process.exit(r.ok ? 0 : 1);
  } else if (cmd === "index") {
    if (!positional[0]) usage();
    const rows = await index(positional[0]);
    for (const r of rows) console.log(`${r.ok ? "OK   " : "STALE"} ${relative(positional[0], r.receipt)}  ${r.accepted ? `accepted by ${r.accepted}` : "no acceptance"}${r.ok ? "" : `  — ${r.reasons.join("; ")}`}`);
    console.log(`\n${rows.filter((r) => r.ok).length} of ${rows.length} receipts match the file on disk; ${rows.filter((r) => r.accepted).length} carry an acceptance`);
    process.exit(rows.every((r) => r.ok) ? 0 : 1);
  } else usage();
}
