#!/usr/bin/env node
// The whole experiment from "Trust is a receipt", end to end, on public material.
//
// 1. Two public inputs: a public-domain picture (Hokusai's Great Wave, from Wikimedia Commons) and a ten-second test
//    film that ffmpeg draws itself, so nothing personal or private goes in.
// 2. Each is signed with a Content Credential (the C2PA standard's embedded receipt) using a throwaway test
//    certificate, and given a receipt beside it (receipt.mjs).
// 3. Each signed file goes through the ordinary things that happen to files on their way to a reader: copied, moved,
//    a metadata field edited, metadata stripped, re-encoded, resized, converted, trimmed, one byte appended. After
//    each, both receipts are checked against the result.
// 4. The drift case: a receipt for a 10-second film, the film rebuilt at 11.27 seconds under the same name, the
//    receipt checked, acceptance attempted, and the old bytes found again by their hash.
//
//   node run.mjs --python .venv/bin/python [--out runs/<name>] [--picture <file>]
//
// Needs Node 18+, ffmpeg and ffprobe, exiftool, openssl, and a Python with c2pa-python installed. Writes everything to
// runs/<date>/ (results.md, results.json, transcript.txt), except the test keys: a temporary folder, deleted at exit.
import { spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks"; import { tmpdir } from "node:os";
import { sha256, readReceipt, verify } from "./receipt.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (f, d = null) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : d);
const PY = opt("--python", "python3");
const today = new Date().toISOString().slice(0, 10);
let RUN = resolve(opt("--out", join(HERE, "runs", today)));
for (let n = 2; existsSync(RUN) && !opt("--out"); n++) RUN = join(HERE, "runs", `${today}-${n}`);
mkdirSync(RUN, { recursive: true }); const KEYS = mkdtempSync(join(tmpdir(), "hash-receipt-keys-")); process.on("exit", () => rmSync(KEYS, { recursive: true, force: true })); process.on("SIGINT", () => process.exit(130));
const T = join(RUN, "transcript.txt");
writeFileSync(T, `# hash-receipt run, started ${new Date().toISOString()}\n`);
const rel = (p) => relative(RUN, p) || ".";
const log = (s) => { appendFileSync(T, s + "\n"); console.log(s); };

/** Run a command; record it and its output in the transcript with paths shown relative to the run folder. */
function sh(cmd, args, { ok = [0], quiet = false } = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 << 20 });
  const shown = [cmd === PY ? "python3" : basename(cmd), ...args.map((a) => (a.startsWith(KEYS) ? "<keys>" + a.slice(KEYS.length) : a.startsWith(RUN) ? rel(a) : a.startsWith(HERE) ? relative(HERE, a) : a))].join(" ");
  appendFileSync(T, `\n$ ${shown}\n${quiet ? "" : (r.stdout ?? "") + (r.stderr ?? "")}`.replaceAll(RUN + "/", "").replaceAll(KEYS, "<keys>"));
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`);
  if (!ok.includes(r.status)) throw new Error(`${shown} exited ${r.status}: ${(r.stderr || r.stdout).slice(0, 400)}`);
  return r;
}
const version = (cmd, args, pick = (s) => s.split("\n")[0]) => { try { return pick(sh(cmd, args, { quiet: true }).stdout.trim()); } catch (e) { return null; } };

// ---------- tools ----------
const tools = {
  node: process.version,
  ffmpeg: version("ffmpeg", ["-version"], (s) => s.match(/ffmpeg version (\S+)/)?.[1] ?? null),
  exiftool: version("exiftool", ["-ver"]),
  openssl: version("openssl", ["version"], (s) => s.split(" ").slice(0, 2).join(" ")),
  c2pa: version(PY, ["-I", "-c", "import c2pa; from importlib.metadata import version; print(version('c2pa-python'), '(library', c2pa.sdk_version() + ')')"]),
};
log(`tools: ${JSON.stringify(tools)}`);
for (const [k, v] of Object.entries(tools)) if (!v) throw new Error(`${k} is missing; see README.md for what to install`);
const webp = sh("ffmpeg", ["-hide_banner", "-encoders"], { quiet: true }).stdout.includes("libwebp");

// ---------- 1. public inputs, each downloaded into its own new folder ----------
const PICTURE_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Tsunami_by_hokusai_19th_century.jpg/1280px-Tsunami_by_hokusai_19th_century.jpg";
const inputs = join(RUN, "inputs");
mkdirSync(join(inputs, "picture"), { recursive: true });
mkdirSync(join(inputs, "film"), { recursive: true });
const picture = join(inputs, "picture", "great-wave.jpg");
if (opt("--picture")) copyFileSync(resolve(opt("--picture")), picture);
else sh("curl", ["-sS", "-L", "--fail", "-A", "hash-receipt-pack/1 (one download per run)", "-o", picture, PICTURE_URL]);
const film = join(inputs, "film", "test-film.mp4");
const makeFilm = (out, seconds) => sh("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", `testsrc2=size=640x360:rate=30:duration=${seconds}`,
  "-f", "lavfi", "-i", `sine=frequency=440:duration=${seconds}`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", out]);
makeFilm(film, 10);
const source = {
  picture: { file: rel(picture), url: opt("--picture") ? null : PICTURE_URL, sha256: await sha256(picture), bytes: statSync(picture).size,
    note: "Katsushika Hokusai, The Great Wave off Kanagawa (about 1830 to 1832), public domain; Wikimedia Commons' 1280-pixel copy" },
  film: { file: rel(film), sha256: await sha256(film), bytes: statSync(film).size, note: "ffmpeg testsrc2 and a 440 Hz tone, 10 s, drawn on this machine" },
};
log(`inputs: picture ${source.picture.sha256.slice(0, 12)} (${source.picture.bytes} bytes), film ${source.film.sha256.slice(0, 12)} (${source.film.bytes} bytes)`);

// ---------- 2. a throwaway certificate (the run keeps its public parts; the keys stay in KEYS), then sign and write a receipt beside each ----------
const cert = join(RUN, "cert"); mkdirSync(cert, { recursive: true });
sh("sh", [join(HERE, "make-test-cert.sh"), KEYS]); for (const f of ["root.pem", "chain.pem", "signer.pem"]) copyFileSync(join(KEYS, f), join(cert, f));
const CRED = join(HERE, "credential.py");
const RECEIPT = join(HERE, "receipt.mjs");
const credential = (file) => JSON.parse(sh(PY, ["-I", CRED, "check", file, "--trust", join(cert, "root.pem"), "--json"], { ok: [0, 1] }).stdout)[0];
const credentialUntrusted = (file) => JSON.parse(sh(PY, ["-I", CRED, "check", file, "--json"], { ok: [0, 1] }).stdout)[0];

const kinds = {};
for (const [kind, src, ext] of [["picture", picture, "jpg"], ["film", film, "mp4"]]) {
  const dir = join(RUN, "work", kind);
  mkdirSync(join(dir, "ops"), { recursive: true });
  const signed = join(dir, `signed.${ext}`);
  sh(PY, ["-I", CRED, "sign", src, signed, "--cert", join(cert, "chain.pem"), "--key", join(KEYS, "signer.key")]);
  const c = credential(signed);
  sh("node", [RECEIPT, "write", signed, "--check", `credential=${c.hash === "match" ? "pass" : "fail"}=${c.state}`, "--check", "decodes=pass", "--require", "credential", "--require", "decodes"]);
  kinds[kind] = { dir, signed, ext, receipt: `${signed}.receipt.json`, original_bytes: statSync(src).size, signed_bytes: statSync(signed).size,
    signed_untrusted_state: credentialUntrusted(signed).state, signed_trusted_state: c.state };
}

// ---------- 3. the ordinary things that happen to a file ----------
const ffmpeg = (...a) => sh("ffmpeg", ["-loglevel", "error", "-y", ...a]);
const exif = (file, ...a) => sh("exiftool", ["-q", "-q", "-overwrite_original", ...a, file], { ok: [0, 1] });
const appendByte = (file) => appendFileSync(file, Buffer.from([0]));
const copyTo = (from, to) => { copyFileSync(from, to); return to; };

const OPS = {
  picture: [
    ["copy", "a byte-for-byte copy", (s, o) => copyTo(s, o("jpg"))],
    ["move", "moved to another folder", null],
    ["edit-metadata", "one metadata field changed (the artist's name), with exiftool", (s, o) => { const f = copyTo(s, o("jpg")); exif(f, "-Artist=A. N. Other"); return f; }],
    ["strip-metadata", "all metadata removed, with exiftool", (s, o) => { const f = copyTo(s, o("jpg")); exif(f, "-all="); return f; }],
    ["re-encode", "decoded and saved again as JPEG at the same size, with ffmpeg", (s, o) => { const f = o("jpg"); ffmpeg("-i", s, "-q:v", "2", f); return f; }],
    ["resize", "resized to 800 pixels wide, with ffmpeg", (s, o) => { const f = o("jpg"); ffmpeg("-i", s, "-vf", "scale=800:-2", "-q:v", "2", f); return f; }],
    ["to-png", "converted to PNG, with ffmpeg", (s, o) => { const f = o("png"); ffmpeg("-i", s, f); return f; }],
    ...(webp ? [["to-webp", "converted to WebP, with ffmpeg", (s, o) => { const f = o("webp"); ffmpeg("-i", s, "-c:v", "libwebp", "-quality", "90", f); return f; }]] : []),
    ["append-byte", "one byte added to the end of the file", (s, o) => { const f = copyTo(s, o("jpg")); appendByte(f); return f; }],
    ["resize-and-re-sign", "resized, then signed again naming the original as its parent", (s, o) => {
      const tmp = o("tmp.jpg"); ffmpeg("-i", s, "-vf", "scale=800:-2", "-q:v", "2", tmp);
      const f = o("jpg"); sh(PY, ["-I", CRED, "sign", tmp, f, "--cert", join(cert, "chain.pem"), "--key", join(KEYS, "signer.key"), "--parent", s]); return f; }],
  ],
  film: [
    ["copy", "a byte-for-byte copy", (s, o) => copyTo(s, o("mp4"))],
    ["move", "moved to another folder", null],
    ["edit-metadata", "one metadata field changed (the title), with exiftool", (s, o) => { const f = copyTo(s, o("mp4")); exif(f, "-Title=Another title"); return f; }],
    ["strip-metadata", "metadata removed while copying the streams, with ffmpeg", (s, o) => { const f = o("mp4"); ffmpeg("-i", s, "-map", "0", "-map_metadata", "-1", "-c", "copy", f); return f; }],
    ["remux", "the same video and sound copied into a new MP4 file, with ffmpeg", (s, o) => { const f = o("mp4"); ffmpeg("-i", s, "-map", "0", "-c", "copy", f); return f; }],
    ["faststart", "reordered for streaming on the web (faststart), with ffmpeg", (s, o) => { const f = o("mp4"); ffmpeg("-i", s, "-map", "0", "-c", "copy", "-movflags", "+faststart", f); return f; }],
    ["re-encode", "encoded again (H.264 and AAC), with ffmpeg", (s, o) => { const f = o("mp4"); ffmpeg("-i", s, "-c:v", "libx264", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", f); return f; }],
    ["trim", "the first second cut off, with ffmpeg", (s, o) => { const f = o("mp4"); ffmpeg("-ss", "1", "-i", s, "-c:v", "libx264", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", f); return f; }],
    ["append-byte", "one byte added to the end of the file", (s, o) => { const f = copyTo(s, o("mp4")); appendByte(f); return f; }],
    ["re-encode-and-re-sign", "encoded again, then signed again naming the original as its parent", (s, o) => {
      const tmp = o("tmp.mp4"); ffmpeg("-i", s, "-c:v", "libx264", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", tmp);
      const f = o("mp4"); sh(PY, ["-I", CRED, "sign", tmp, f, "--cert", join(cert, "chain.pem"), "--key", join(KEYS, "signer.key"), "--parent", s]); return f; }],
  ],
};

const rows = [];
for (const [kind, k] of Object.entries(kinds)) {
  for (const [op, what, fn] of OPS[kind]) {
    const o = (ext) => join(k.dir, "ops", `${op}.${ext}`);
    let file, sidecar;
    if (op === "move") {
      // A file of its own with its own receipt, so moving it leaves the other cases alone.
      const home = join(k.dir, "move-from"); mkdirSync(home, { recursive: true });
      const f0 = copyTo(k.signed, join(home, `signed.${k.ext}`));
      sh("node", [RECEIPT, "write", f0, "--check", "decodes=pass", "--require", "decodes"]);
      const away = join(k.dir, "moved-to"); mkdirSync(away, { recursive: true });
      file = join(away, `signed.${k.ext}`); renameSync(f0, file);
      const rcpt = `${f0}.receipt.json`;
      const byPath = await verify(readReceipt(rcpt));
      const found = sh("node", [RECEIPT, "find", rcpt, "--in", k.dir], { ok: [0, 1] }).stdout.trim();
      sh("node", [RECEIPT, "relink", rcpt, file]);
      const after = await verify(readReceipt(rcpt));
      sidecar = { ok: byPath.ok, reason: byPath.reasons[0]?.replaceAll(RUN + "/", "") ?? null, found: found.startsWith("found"), after_relink: after.ok };
    } else {
      file = fn(k.signed, o);
      const v = await verify(readReceipt(k.receipt), file);
      sidecar = { ok: v.ok, reason: v.reasons[0]?.replaceAll(RUN + "/", "") ?? null };
    }
    const c = credential(file);
    const embedded = c.credential !== "present" ? "stripped" : c.hash === "match" ? (c.state === "Trusted" ? "intact" : `intact, ${c.state}`) : "broken";
    const fileSha = await sha256(file);
    // A tool that refused and left the bytes alone must not read as a credential that survived the change.
    const unchanged = !["copy", "move"].includes(op) && fileSha === (await sha256(k.signed));
    if (unchanged) log(`  note: ${op} left the file byte-for-byte unchanged, so it tests nothing`);
    rows.push({ kind, op, what, file: rel(file), sha256: fileSha.slice(0, 12), bytes: statSync(file).size, unchanged,
      embedded, credential: c, sidecar });
    log(`${kind.padEnd(7)} ${op.padEnd(22)} embedded ${embedded.padEnd(9)} receipt ${sidecar.ok ? "matches" : "does not match"}${op === "move" ? ` (by path; found by hash: ${sidecar.found}, after relink: ${sidecar.after_relink ? "matches" : "no"})` : ""}`);
  }
}

// ---------- 4. the drift case: a receipt for one film, the film rebuilt under the same name ----------
const drift = join(RUN, "work", "drift");
mkdirSync(join(drift, "archive"), { recursive: true });
const cut = join(drift, "film.mp4");
makeFilm(cut, 10);
const lufs = (f) => { const r = sh("ffmpeg", ["-hide_banner", "-nostats", "-i", f, "-af", "ebur128", "-f", "null", "-"], { quiet: true }); const m = [...r.stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop(); return m ? m[1] : null; };
const steps = [];
const step = (label, cmd, args, okCodes = [0, 1]) => { const r = sh(cmd, args, { ok: okCodes }); steps.push({ label, command: [basename(cmd), ...args.map((a) => a.startsWith(RUN) ? rel(a) : a.startsWith(HERE) ? relative(HERE, a) : a)].join(" "), exit: r.status, output: (r.stdout + r.stderr).replaceAll(RUN + "/", "").trim() }); return r; };
step("write a receipt for the 10-second film, with its loudness measured", "node", [RECEIPT, "write", cut, "--check", "duration=pass=10.00", "--check", `loudness=pass=${lufs(cut)} LUFS`, "--require", "duration", "--require", "loudness"]);
step("verify it", "node", [RECEIPT, "verify", `${cut}.receipt.json`]);
copyFileSync(cut, join(drift, "archive", "film-v1.mp4"));
makeFilm(cut, 11.27);
step("the film is rebuilt at 11.27 s under the same name; verify the old receipt", "node", [RECEIPT, "verify", `${cut}.receipt.json`]);
step("try to accept it", "node", [RECEIPT, "accept", `${cut}.receipt.json`, "--name", "A reader", "--at", today]);
step("look for the receipt's bytes by their hash", "node", [RECEIPT, "find", `${cut}.receipt.json`, "--in", drift]);
step("point the receipt at the bytes it describes", "node", [RECEIPT, "relink", `${cut}.receipt.json`, join(drift, "archive", "film-v1.mp4")]);
step("accept those bytes", "node", [RECEIPT, "accept", `${cut}.receipt.json`, "--name", "A reader", "--at", today]);
step("index every receipt in the drift folder", "node", [RECEIPT, "index", drift]);
for (const s of steps) log(`\n# ${s.label}\n$ ${s.command}\n${s.output}\n(exit ${s.exit})`);

// ---------- 5. what a receipt costs: time to hash and verify ----------
const timeIt = async (f) => { const t0 = performance.now(); await sha256(f); return +(performance.now() - t0).toFixed(1); };
const costs = [];
for (const f of [kinds.picture.signed, kinds.film.signed]) costs.push({ file: rel(f), bytes: statSync(f).size, hash_ms: await timeIt(f) });

// ---------- results ----------
const count = (kind, pred) => rows.filter((r) => r.kind === kind && pred(r)).length;
const summary = Object.fromEntries(Object.keys(kinds).map((kind) => [kind, {
  operations: count(kind, () => true),
  embedded_intact: count(kind, (r) => r.embedded.startsWith("intact")),
  embedded_stripped: count(kind, (r) => r.embedded === "stripped"),
  embedded_broken: count(kind, (r) => r.embedded === "broken"),
  receipt_matches: count(kind, (r) => r.sidecar.ok),
  bytes_added_by_signing: kinds[kind].signed_bytes - kinds[kind].original_bytes,
  signed_state_default_trust: kinds[kind].signed_untrusted_state,
  signed_state_test_root_trusted: kinds[kind].signed_trusted_state,
}]));
// No private key may be left in the run folder, which travels with the pack: stop before writing results if one is.
const keyFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => { const p = join(dir, e.name);
  return e.isDirectory() ? keyFiles(p) : /\.(key|ec|p8|p12|pfx)$/i.test(e.name) || (statSync(p).size < 1 << 16 && /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(readFileSync(p, "latin1"))) ? [p] : []; });
const leaked = keyFiles(RUN);
if (leaked.length) throw new Error(`a private key is in the run folder, which must hold none: ${leaked.map(rel).join(", ")}`);
const result = { run: rel(RUN), finished_at: new Date().toISOString(), tools, source, summary, rows, drift: steps, costs };
writeFileSync(join(RUN, "results.json"), JSON.stringify(result, null, 1) + "\n");

const table = (kind) => [
  "| What happened to the file | Credential inside the file | Receipt beside the file |", "|---|---|---|",
  ...rows.filter((r) => r.kind === kind).map((r) => `| ${r.what} | ${r.embedded} | ${r.op === "move" ? `no file at its path; found again by hash${r.sidecar.after_relink ? ", matches after relink" : ""}` : r.sidecar.ok ? "matches" : "does not match"} |`),
].join("\n");
const md = `# hash-receipt results, ${today}

Run folder: \`${relative(HERE, RUN)}\`. Tools: ${Object.entries(tools).map(([k, v]) => `${k} ${v}`).join(", ")}.

Inputs: ${source.picture.note} (sha256 ${source.picture.sha256.slice(0, 12)}, ${source.picture.bytes} bytes${source.picture.url ? `, from ${source.picture.url}` : ""}); ${source.film.note} (sha256 ${source.film.sha256.slice(0, 12)}).

Each was signed with a Content Credential from a throwaway test certificate and given a receipt beside it. "Intact" means the credential is there, the hash inside it matches the file, and the signature checks out with the test root trusted. "Broken" means the credential is there but its hash no longer matches the file. "Stripped" means no credential is left. The receipt column says whether the receipt beside the original describes the bytes of the result.

## Picture

${table("picture")}

## Film

${table("film")}

## Summary

${Object.entries(summary).map(([k, s]) => `- ${k}: of ${s.operations} things that happened to the file, the credential stayed intact in ${s.embedded_intact}, was stripped in ${s.embedded_stripped} and was left broken in ${s.embedded_broken}. The receipt beside the original matched the result in ${s.receipt_matches}. Signing added ${s.bytes_added_by_signing} bytes. With no trust settings the signed file reads "${s.signed_state_default_trust}"; with the test root trusted, "${s.signed_state_test_root_trusted}".`).join("\n")}

## The drift case

${steps.map((s) => `**${s.label}** (exit ${s.exit})\n\n\`\`\`\n$ ${s.command}\n${s.output}\n\`\`\``).join("\n\n")}

## What a receipt costs

${costs.map((c) => `- ${c.file}: ${c.bytes} bytes hashed in ${c.hash_ms} ms`).join("\n")}

Every command and its output is in \`transcript.txt\`.
`;
writeFileSync(join(RUN, "results.md"), md);
log(`\nwrote ${rel(join(RUN, "results.md"))} and results.json`);
log(JSON.stringify(summary));
