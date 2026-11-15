// Builds the listening set: ten narrations of about two minutes, each a run of consecutive sentences from one
// chapter of LibriSpeech test-clean, read by five women and five men, chosen by a fixed seed.
//
//   node make-tasks/build-listening.mjs <path to LibriSpeech folder, the one holding SPEAKERS.TXT and test-clean/>
//
// LibriSpeech is public under CC BY 4.0 (Panayotov et al., 2015, openslr.org/12), read by LibriVox volunteers.
// Each narration is joined with 0.4 s of silence between sentences and saved as 16 kHz mono mp3 at 48 kb/s, the
// format the author's own film word check sends to a hosted model. Needs ffmpeg and ffprobe.
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [root, seedArg = "20261030", targetArg = "120"] = process.argv.slice(2);
if (!root) { console.error("usage: node make-tasks/build-listening.mjs <LibriSpeech dir> [seed] [seconds per narration]"); process.exit(2); }
const SEED = Number(seedArg), TARGET = Number(targetArg), GAP = 0.4;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "tasks", "listening");

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(SEED);
const shuffle = (xs) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const seconds = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).trim());

const speakers = readFileSync(join(root, "SPEAKERS.TXT"), "utf8").split("\n")
  .filter((l) => l && !l.startsWith(";")).map((l) => l.split("|").map((s) => s.trim()))
  .filter(([, , subset]) => subset === "test-clean").map(([id, sex]) => ({ id, sex }))
  .sort((a, b) => Number(a.id) - Number(b.id));
const chosen = [...shuffle(speakers.filter((s) => s.sex === "F")).slice(0, 5), ...shuffle(speakers.filter((s) => s.sex === "M")).slice(0, 5)];

const work = mkdtempSync(join(tmpdir(), "listening-"));
const silence = join(work, "gap.flac");
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `anullsrc=r=16000:cl=mono`, "-t", String(GAP), "-c:a", "flac", silence]);
const narrations = [];
chosen.forEach((sp, k) => {
  const chapters = readdirSync(join(root, "test-clean", sp.id)).sort((a, b) => Number(a) - Number(b));
  const chapter = shuffle(chapters)[0];
  const dir = join(root, "test-clean", sp.id, chapter);
  const lines = readFileSync(join(dir, `${sp.id}-${chapter}.trans.txt`), "utf8").split("\n").filter(Boolean)
    .map((l) => ({ id: l.slice(0, l.indexOf(" ")), text: l.slice(l.indexOf(" ") + 1) }))
    .sort((a, b) => Number(a.id.split("-")[2]) - Number(b.id.split("-")[2]));
  const take = [];
  let total = 0;
  for (const l of lines) {
    if (total >= TARGET) break;
    const s = seconds(join(dir, `${l.id}.flac`));
    take.push({ ...l, seconds: s });
    total += s + (take.length > 1 ? GAP : 0);
  }
  const list = join(work, `n${k + 1}.txt`);
  writeFileSync(list, take.flatMap((l, i) => [...(i ? [`file '${silence}'`] : []), `file '${join(dir, `${l.id}.flac`)}'`]).join("\n") + "\n");
  const id = `n${String(k + 1).padStart(2, "0")}`;
  const mp3 = join(OUT, `${id}.mp3`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-ac", "1", "-ar", "16000", "-b:a", "48k", mp3]);
  const reference = take.map((l) => l.text).join(" ");
  narrations.push({
    id, file: `${id}.mp3`, speaker: sp.id, sex: sp.sex, chapter, utterances: take.map((l) => l.id),
    seconds: Math.round(seconds(mp3) * 100) / 100, words: reference.split(/\s+/).length,
    sha256: createHash("sha256").update(readFileSync(mp3)).digest("hex"), reference,
  });
});
rmSync(work, { recursive: true, force: true });
writeFileSync(join(OUT, "narrations.json"), JSON.stringify({
  source: "LibriSpeech test-clean (Panayotov, Chen, Povey and Khudanpur, 2015), https://www.openslr.org/12, CC BY 4.0; read by LibriVox volunteers",
  seed: SEED, target_seconds: TARGET, gap_seconds: GAP, format: "mp3, 16 kHz mono, 48 kb/s", narrations,
}, null, 2) + "\n");
const mins = narrations.reduce((s, n) => s + n.seconds, 0) / 60;
console.log(`${narrations.length} narrations, ${mins.toFixed(1)} minutes, ${narrations.reduce((s, n) => s + n.words, 0)} words -> ${OUT}`);
