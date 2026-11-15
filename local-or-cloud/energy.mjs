// Turns a power log (from power/sample-windows.ps1 or power/sample-linux.sh) into the energy a local run used.
//
//   node energy.mjs --log power.csv --run results/answering-local-....json [--offset-ms 0] [--baseline-s 60] [--out <file>]
//
// The run's window is its started_at to ended_at. GPU energy is the area under the sampled board power; processor
// energy is the difference in the running RAPL total across the window. The idle draw is the average over the
// --baseline-s seconds just before the window (keep the machine idle then); the run's extra energy is the total minus
// that idle draw over the same time. --offset-ms is the logging machine's clock minus the run machine's clock, if they
// differ. Writes <run>-energy.json beside the run unless --out is given.
import { readFileSync, writeFileSync } from "node:fs";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith("--") ? [...a, [x.slice(2), all[i + 1]]] : a), []));
if (!args.log || !args.run) { console.error("usage: node energy.mjs --log power.csv --run <run JSON> [--offset-ms N] [--baseline-s 60]"); process.exit(2); }
const OFFSET = Number(args["offset-ms"] ?? 0), BASE_S = Number(args["baseline-s"] ?? 60);

const rows = readFileSync(args.log, "utf8").replace(/\0|\r/g, "").split("\n").filter((l) => /^\d{12,},/.test(l)).map((l) => {
  const [t, w, u, m, c] = l.split(",");
  return { t: Number(t) - OFFSET, w: Number(w), u: Number(u), m: Number(m), c: c === "" || c == null ? null : Number(c) };
}).filter((r) => Number.isFinite(r.t) && Number.isFinite(r.w)).sort((a, b) => a.t - b.t);
const run = JSON.parse(readFileSync(args.run, "utf8"));
const t0 = Date.parse(args.start ?? run.started_at), t1 = Date.parse(args.end ?? run.ended_at);
if (!rows.length || rows[0].t > t0 - BASE_S * 1000 || rows.at(-1).t < t1) {
  console.error(`the log must cover ${BASE_S} s before the run through its end: log ${new Date(rows[0]?.t).toISOString()} to ${new Date(rows.at(-1)?.t).toISOString()}, run ${run.started_at} to ${run.ended_at}`);
  process.exit(1);
}

// Linear interpolation of a column at time t.
function at(t, key) {
  let i = rows.findIndex((r) => r.t >= t);
  if (i <= 0) return rows[Math.max(0, i)][key];
  const a = rows[i - 1], b = rows[i];
  return a[key] + ((b[key] - a[key]) * (t - a.t)) / (b.t - a.t);
}
// Watt-hours under the GPU power curve between ta and tb (trapezoids).
function gpuWh(ta, tb) {
  const pts = [{ t: ta, w: at(ta, "w") }, ...rows.filter((r) => r.t > ta && r.t < tb), { t: tb, w: at(tb, "w") }];
  let j = 0;
  for (let k = 1; k < pts.length; k++) j += ((pts[k].w + pts[k - 1].w) / 2) * (pts[k].t - pts[k - 1].t) / 1000;
  return j / 3600;
}
const hasCpu = rows.every((r) => r.c != null);
const cpuWh = (ta, tb) => (hasCpu ? (at(tb, "c") - at(ta, "c")) * 1e-12 : null);

const secs = (t1 - t0) / 1000, b0 = t0 - BASE_S * 1000;
const idle = { gpu_w: (gpuWh(b0, t0) * 3600) / BASE_S, cpu_w: hasCpu ? (cpuWh(b0, t0) * 3600) / BASE_S : null, seconds: BASE_S };
const inWin = rows.filter((r) => r.t >= t0 && r.t <= t1);
const g = gpuWh(t0, t1), c = cpuWh(t0, t1);
const total = g + (c ?? 0);
const idleWh = ((idle.gpu_w + (idle.cpu_w ?? 0)) * secs) / 3600;
const out = {
  run: args.run, log: args.log, window: { start: new Date(t0).toISOString(), end: new Date(t1).toISOString(), seconds: secs },
  clock_offset_ms: OFFSET, samples: inWin.length,
  gpu: { wh: g, mean_w: (g * 3600) / secs, peak_w: Math.max(...inWin.map((r) => r.w)), mean_util: inWin.reduce((s, r) => s + r.u, 0) / inWin.length, peak_mem_mib: Math.max(...inWin.map((r) => r.m)) },
  cpu_package: hasCpu ? { wh: c, mean_w: (c * 3600) / secs } : null,
  idle_before: idle,
  measured_wh: total, idle_wh_over_window: idleWh, extra_wh: total - idleWh,
  note: "GPU board plus processor package only; memory, drives, fans, other cards and power-supply losses are not measured.",
};
const dest = args.out ?? args.run.replace(/\.json$/, "-energy.json");
writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");
console.log(`${secs.toFixed(0)} s: GPU ${g.toFixed(2)} Wh (mean ${out.gpu.mean_w.toFixed(0)} W), CPU package ${c == null ? "n/a" : c.toFixed(2) + " Wh"}; idle ${(idle.gpu_w + (idle.cpu_w ?? 0)).toFixed(0)} W; extra ${out.extra_wh.toFixed(2)} Wh -> ${dest}`);
