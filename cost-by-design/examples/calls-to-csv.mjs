// One row per call from a day's cost-test runs, so plan.mjs can show the tail of what a single call costs and how long
// it takes when the model decides for itself how long to reason.
//
//   node examples/calls-to-csv.mjs 2026-10-30 > examples/call-costs-2026-10-30.csv
//   node plan.mjs examples/call-costs-2026-10-30.csv --column cost_usd --group design
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RUNS = join(dirname(fileURLToPath(import.meta.url)), '..', 'runs');
const DAY = process.argv[2];
if (!DAY) { console.error('usage: node examples/calls-to-csv.mjs <day, e.g. 2026-10-30>'); process.exit(2); }
console.log('design,call,judgements,seconds,cost_usd,prompt_tokens,completion_tokens,reasoning_tokens');
for (const f of readdirSync(RUNS).filter((f) => f.endsWith(`-${DAY}.json`)).sort()) {
  const run = JSON.parse(readFileSync(join(RUNS, f), 'utf8'));
  for (const c of run.calls.filter((c) => c.ok)) {
    const u = c.usage || {};
    console.log([run.design.id, c.n, c.judgements.length, (c.ms / 1000).toFixed(2), c.cost_usd, u.prompt_tokens ?? '', u.completion_tokens ?? '',
      u.completion_tokens_details?.reasoning_tokens ?? ''].join(','));
  }
}
