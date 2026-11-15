// Cost by design: the known-answer cost test. One job, which of two headlines more readers clicked, on 119 real A/B
// tests from the Upworthy Research Archive (pairs.json), done under each design in designs.json. Every pair is judged
// twice, once in each order. Each call's picks, tokens, cost and time are kept, so compare.mjs can score the designs,
// and so is the reply's text whenever a pick couldn't be read from it.
//
//   API_KEY=... node run.mjs                  every design in designs.json
//   API_KEY=... node run.mjs luna luna-lean   only these designs
//   BASE_URL=https://api.openai.com/v1 API_KEY=... DESIGNS=my-designs.json node run.mjs
//
// OpenRouter by default. Writes runs/<design>-<date>.json beside this file and skips a design already run that day
// (FORCE=1 runs it again). CONCURRENCY sets parallel calls (default 8). Needs Node 18 or later; no packages.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const KEY = process.env.API_KEY || process.env.OPENROUTER_API_KEY;
const BASE = (process.env.BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
const OPENROUTER = BASE.includes('openrouter.ai');
const CONCURRENCY = Number(process.env.CONCURRENCY || 8);
const DAY = process.env.DAY || new Date().toISOString().slice(0, 10);
if (!KEY) { console.error('usage: API_KEY=... node run.mjs [design ...]   (BASE_URL defaults to OpenRouter)'); process.exit(2); }

const read = (env, def) => JSON.parse(readFileSync(resolve(process.env[env] || join(HERE, def)), 'utf8'));
const PAIRS = read('PAIRS', 'pairs.json');
const ALL = read('DESIGNS', 'designs.json').designs;
const pick = process.argv.slice(2);
const DESIGNS = pick.length ? ALL.filter((d) => pick.includes(d.id)) : ALL;
if (pick.length && DESIGNS.length !== pick.length) { console.error(`unknown design: ${pick.filter((p) => !ALL.some((d) => d.id === p)).join(', ')}`); process.exit(2); }

// The scored prompt is essay 3's, word for word; the scores are asked for and never used. The pick prompt asks only
// for what is scored. The batch prompt is the pick prompt for many pairs at once.
const INTRO = 'Here are two headlines a news website tested for the same article. Readers saw one or the other at random.';
const PROMPTS = {
  scored: (a, b) => `${INTRO}\n\nHeadline A: ${a}\nHeadline B: ${b}\n\nScore each headline from 1 to 10 for how good a headline it is. Then say which one more readers clicked.\nReply with JSON only: {"score_A": <1-10>, "score_B": <1-10>, "more_clicks": "A" or "B"}`,
  pick: (a, b) => `${INTRO}\n\nHeadline A: ${a}\nHeadline B: ${b}\n\nWhich one did more readers click?\nReply with JSON only: {"more_clicks": "A" or "B"}`,
  batch: (items) => 'A news website tested two headlines for each of the articles below. For each article, readers saw one headline or the other at random.\n\n' +
    items.map((j, i) => `Pair ${i + 1}\nHeadline A: ${j.first}\nHeadline B: ${j.second}`).join('\n\n') +
    `\n\nFor each pair, say which headline more readers clicked.\nReply with JSON only, one entry per pair: {${items.map((_, i) => `"${i + 1}": "A" or "B"`).join(', ')}}`,
};

// Every pair in both orders. In "winner-first" the headline readers clicked more is A.
const JUDGEMENTS = [];
for (const set of ['clear', 'close']) {
  PAIRS[set].forEach((p, k) => {
    JUDGEMENTS.push({ set, k, test: p.test, order: 'winner-first', first: p.winner, second: p.loser });
    JUDGEMENTS.push({ set, k, test: p.test, order: 'loser-first', first: p.loser, second: p.winner });
  });
}

async function call(design, content) {
  const body = { model: design.model, messages: [{ role: 'user', content }], temperature: 0, max_tokens: design.per_call > 1 ? 8000 : 4000 };
  if (OPENROUTER) {
    body.usage = { include: true };
    if (process.env.ZDR !== '0') body.provider = { zdr: true, data_collection: 'deny' };
    if (design.reasoning) body.reasoning = design.reasoning;
  } else if (design.reasoning?.effort) body.reasoning_effort = design.reasoning.effort;
  // Up to five tries, waiting 3, 6, 12 and 24 seconds: providers refuse calls under peak load and then recover.
  let last = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const t = Date.now();
    try {
      const res = await fetch(`${BASE}/chat/completions`, { method: 'POST', signal: AbortSignal.timeout(300_000),
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      const ms = Date.now() - t;
      const text = String(json.choices?.[0]?.message?.content ?? '');
      if (res.ok && !json.error && text.trim()) return { ok: true, attempt, ms, text, usage: json.usage, served: json.model, provider: json.provider };
      last = { ok: false, attempt, ms, status: res.status, usage: json.usage, error: (json.error ? JSON.stringify(json.error) : text.trim() ? '' : 'empty reply').slice(0, 300) };
      if (res.status >= 400 && res.status < 500 && res.status !== 429 && res.status !== 408) break;
    } catch (e) {
      last = { ok: false, attempt, ms: Date.now() - t, error: String(e).slice(0, 300) };
    }
    if (attempt < 5) await new Promise((r) => setTimeout(r, 3000 * 2 ** (attempt - 1)));
  }
  return last;
}

const parse = (text) => { try { return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); } catch { return null; } };
const letter = (v) => (typeof v === 'string' && /^[AB]$/i.test(v.trim()) ? v.trim().toUpperCase() : null);

// A call's cost is what the endpoint charged when it says (OpenRouter's usage.cost includes reasoning tokens); otherwise
// the tokens at the list prices in designs.json, marked as such.
function cost(design, usage) {
  if (!usage) return { usd: 0, source: 'none' };
  if (Number.isFinite(Number(usage.cost))) return { usd: Number(usage.cost), source: 'charged' };
  const [pin, pout] = design.price_per_m || [0, 0];
  return { usd: ((usage.prompt_tokens || 0) * pin + (usage.completion_tokens || 0) * pout) / 1e6, source: 'list' };
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

// A batch never holds both orders of one pair: winner-first and loser-first judgements go in separate calls.
function packets(design) {
  if (design.per_call <= 1) return JUDGEMENTS.map((j) => [j]);
  const out = [];
  for (const order of ['winner-first', 'loser-first']) {
    const js = JUDGEMENTS.filter((j) => j.order === order);
    for (let i = 0; i < js.length; i += design.per_call) out.push(js.slice(i, i + design.per_call));
  }
  return out;
}

mkdirSync(join(HERE, 'runs'), { recursive: true });
for (const design of DESIGNS) {
  const file = join(HERE, 'runs', `${design.id}-${DAY}.json`);
  if (existsSync(file) && process.env.FORCE !== '1') { console.log(`${design.id}: already run on ${DAY}, skipped (FORCE=1 to run again)`); continue; }
  const started = Date.now();
  const calls = await pool(packets(design), CONCURRENCY, async (items, n) => {
    const content = design.per_call > 1 ? PROMPTS.batch(items) : PROMPTS[design.prompt](items[0].first, items[0].second);
    const r = await call(design, content);
    const c = cost(design, r.usage);
    const reply = r.ok ? parse(r.text) : null;
    const judgements = items.map((j, i) => {
      const raw = reply ? (design.per_call > 1 ? reply[String(i + 1)] : reply.more_clicks) : null;
      const pickd = letter(typeof raw === 'object' && raw ? raw.more_clicks : raw);
      return { set: j.set, k: j.k, test: j.test, order: j.order, picked: pickd,
        picked_winner: pickd ? (pickd === 'A') === (j.order === 'winner-first') : null };
    });
    process.stdout.write(r.ok ? (judgements.every((j) => j.picked) ? '.' : '?') : 'x');
    return { n, ok: r.ok, attempt: r.attempt, ms: r.ms, status: r.status, error: r.error, served: r.served, provider: r.provider,
      usage: r.usage, cost_usd: c.usd, cost_source: c.source,
      // The reply's text is kept whenever a pick couldn't be read from it, so a missing answer can be looked at later.
      text: r.ok && judgements.some((j) => !j.picked) ? String(r.text).slice(0, 2000) : undefined, judgements };
  });
  const wall = Date.now() - started;
  writeFileSync(file, JSON.stringify({ design, base_url: BASE, at: new Date(started).toISOString(), wall_ms: wall,
    prompt: design.per_call > 1 ? PROMPTS.batch([{ first: '<headline A>', second: '<headline B>' }]) : PROMPTS[design.prompt]('<headline A>', '<headline B>'),
    calls }, null, 1));
  const js = calls.flatMap((c) => c.judgements);
  const scored = js.filter((j) => j.picked);
  const usd = calls.reduce((s, c) => s + c.cost_usd, 0);
  console.log(`\n${design.id}: ${calls.length} calls, ${calls.filter((c) => !c.ok).length} failed, ${scored.length} of ${js.length} judgements answered, ` +
    `${scored.filter((j) => j.picked_winner).length} matched the readers, $${usd.toFixed(4)}, ${(wall / 1000).toFixed(0)} s`);
}
