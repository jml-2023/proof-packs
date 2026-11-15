#!/usr/bin/env node
// A film check you can run with only ffmpeg: fail the film when nothing moves for longer than a limit.
//
// It measures motion the way my film pipeline's motion check does: shrink each frame to 320 px wide in grey, take
// the largest change of any one pixel from the frame before, and call the frame "moving" when that change is at
// least 0.006 of full scale (between one and two grey levels). The film fails when the longest run of frames that
// are not moving is over the limit (3 s by default). It is a stand-alone copy of that check for this pack, so you
// can see on your own films what it can and can't catch.
//
//   node still-check.mjs <film> [--limit 3] [--floor 0.006]
// Exit 0 = pass, 1 = fail (the check fired), 2 = could not run.
import { spawnSync } from "node:child_process";

const a = process.argv.slice(2);
const opt = (k, d) => (a.includes(k) ? Number(a[a.indexOf(k) + 1]) : d);
const file = a.find((x, i) => !x.startsWith("--") && !["--limit", "--floor"].includes(a[i - 1]));
const limit = opt("--limit", 3), floor = opt("--floor", 0.006);
if (!file) { console.error("usage: node still-check.mjs <film> [--limit 3] [--floor 0.006]"); process.exit(2); }

const probe = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,avg_frame_rate",
  "-of", "csv=p=0", file], { encoding: "utf8" });
if (probe.status !== 0 || !probe.stdout.trim()) { console.error(`ffprobe could not read ${file}`); process.exit(2); }
const [w, h, rate] = probe.stdout.trim().split(",");
const [num, den] = rate.split("/").map(Number);
const fps = den ? num / den : 30;
const W = 320, H = Math.max(2, Math.round((W * Number(h)) / Number(w) / 2) * 2), size = W * H;

const r = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-vf", `scale=${W}:${H}:flags=area,format=gray`, "-f", "rawvideo", "-"],
  { maxBuffer: 1 << 30 });
if (r.status !== 0) { console.error(`ffmpeg could not decode ${file}`); process.exit(2); }
const buf = r.stdout, n = Math.floor(buf.length / size);
if (n < 2) { console.error("fewer than two frames decoded"); process.exit(2); }

let run = 0, longest = 0, at = 0, moving = 0;
for (let i = 1; i < n; i++) {
  let worst = 0;
  for (let k = 0, p = i * size, q = (i - 1) * size; k < size; k++) {
    const d = buf[p + k] - buf[q + k];
    if (d > worst) worst = d; else if (-d > worst) worst = -d;
  }
  if (worst / 255 >= floor) { moving++; run = 0; }
  else { run++; if (run > longest) { longest = run; at = i - run + 1; } }
}
const longestS = longest / fps;
const ok = longestS <= limit;
console.log(JSON.stringify({ check: "still-check", file, ok, longest_still_s: +longestS.toFixed(2), starts_at_s: +(at / fps).toFixed(2),
  limit_s: limit, floor, frames: n, moving_share: +(moving / (n - 1)).toFixed(3) }));
process.exit(ok ? 0 : 1);
