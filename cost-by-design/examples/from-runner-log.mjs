// Turns the log of the runner that drives my publication's agents into a CSV that plan.mjs reads: one row per task, from
// the moment the runner started it to the moment it logged the task done or a review verdict. A task stopped and
// resumed counts as one task, start to finish.
//
//   node examples/from-runner-log.mjs <runner.log> [--at <ISO time>] > tasks.csv
//
// --at reads the log as it stood at that time (default: now). A task that had finished by then is "finished"; one that
// was still going is "running", with the minutes it had run so far. A task whose end the runner never logged is
// "unknown", with no minutes, and plan.mjs skips it: that happens when the runner starts the same lane again before
// logging an end (a failed launch, or an end it didn't record), or when the task's process has gone with no end logged.
//
// The log lines it reads look like:
//   2026-10-30T08:42:48.137Z s09: started pid 19487
//   2026-10-30T09:08:02.497Z s09: done
//   2026-10-30T09:35:19.398Z s09-review: s09 failed 2 Evidence; back to the writer for round 3
//   2026-10-30T10:56:22.919Z s09-review: s09 passes every axis
import { readFileSync } from 'node:fs';

const [file] = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--at');
const atArg = process.argv.indexOf('--at');
const AT = atArg > 0 ? new Date(process.argv[atArg + 1]) : new Date();
// Whether a task is still running is read from its process now, so a time in the future would mislabel tasks.
if (!(AT <= new Date())) { console.error(`--at ${process.argv[atArg + 1]} is in the future or not a time`); process.exit(2); }
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const kind = (lane) => (lane.endsWith('-film-review') ? 'film review' : lane.endsWith('-review') ? 'piece review' : lane.includes('-film') || lane.includes('-full') ? 'film' : 'piece');

// Every task in the whole log, with its end if one was logged.
const tasks = [];
const open = new Map(); // lane -> task
for (const line of readFileSync(file, 'utf8').split('\n')) {
  const m = line.match(/^(\S+Z) ([a-z0-9-]+): (.*)$/i);
  if (!m) continue;
  const [, ts, lane, msg] = m;
  const t = new Date(ts);
  let s;
  if ((s = msg.match(/^started pid (\d+)/))) {
    if (open.has(lane)) open.get(lane).superseded = true;
    const task = { lane, started: t, pid: Number(s[1]), ended: null };
    tasks.push(task);
    open.set(lane, task);
  } else if ((s = msg.match(/^resumed \(attempt \d+\) pid (\d+)/))) {
    if (open.has(lane)) open.get(lane).pid = Number(s[1]);
  } else if (/^done\b/.test(msg) || /passes every axis|failed .*back to the writer/.test(msg)) {
    if (!open.has(lane)) continue;
    open.get(lane).ended = t;
    open.delete(lane);
  }
}

console.log('task,kind,started,ended,minutes,status');
for (const k of tasks.filter((x) => x.started <= AT).sort((a, b) => a.started - b.started)) {
  const row = { task: `${k.lane} ${k.started.toISOString().slice(11, 16)}`, kind: kind(k.lane), started: k.started.toISOString(), ended: '', minutes: '', status: 'unknown' };
  if (k.ended && k.ended <= AT) Object.assign(row, { ended: k.ended.toISOString(), minutes: ((k.ended - k.started) / 60000).toFixed(1), status: 'finished' });
  else if (!k.superseded && (k.ended || alive(k.pid))) Object.assign(row, { minutes: ((AT - k.started) / 60000).toFixed(1), status: 'running' });
  console.log([row.task, row.kind, row.started, row.ended, row.minutes, row.status].join(','));
}
