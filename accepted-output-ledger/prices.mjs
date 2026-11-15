// Reads today's public list prices from OpenRouter for the models a ledger uses, and writes them to a dated price file
// beside this script, so a ledger can be re-priced and the change seen. No key is needed: the model lists are public.
//
//   node prices.mjs                                   re-reads the models in the newest prices-*.json here
//   node prices.mjs --models anthropic/claude-opus-5.5,elevenlabs/eleven-v4
//   node prices.mjs --snapshot snapshots/2026-10-30 --date 2026-10-30     the saved lists instead of the network
//   node prices.mjs --out runs/today/prices.json                          write elsewhere, compared with the newest here
//
// Text models are priced per token: input, output, and reading from and writing to the prompt cache. Speech models
// are priced by OpenRouter "per character of input text", except a few such as Seed Audio 1.0, priced "per second of
// generated audio" with the rate under pricing.completion (openrouter.ai/docs/features/multimodal/tts, read 30 October
// 2026). Long-prompt and time-of-day surcharges are listed by OpenRouter as overrides; this keeps the base price and
// notes that an override exists. Needs Node 18 or later; no packages.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const today = opt('date', new Date().toISOString().slice(0, 10));
const LISTS = { text: 'https://openrouter.ai/api/v1/models', speech: 'https://openrouter.ai/api/v1/models?output_modalities=speech' };
const outFile = resolve(opt('out', join(HERE, `prices-${today}.json`)));

// Compare with the newest price file here that this run does not overwrite.
const previous = readdirSync(HERE).filter((f) => /^prices-\d{4}-\d{2}-\d{2}\.json$/.test(f) && join(HERE, f) !== outFile).sort().pop();
const before = previous ? JSON.parse(readFileSync(join(HERE, previous), 'utf8')) : null;
const wanted = opt('models', null)?.split(',').map((s) => s.trim()).filter(Boolean) ?? Object.keys(before?.models ?? {});
if (!wanted.length) { console.error('no models: give --models a,b,c or keep a prices-YYYY-MM-DD.json here'); process.exit(2); }

async function list(kind) {
  const snap = opt('snapshot', null);
  if (snap) {
    const f = join(snap, `openrouter-${kind}-models.json`);
    if (!existsSync(f)) throw new Error(`no snapshot ${f}`);
    return JSON.parse(readFileSync(f, 'utf8')).data;
  }
  const res = await fetch(LISTS[kind], { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${LISTS[kind]} answered ${res.status}`);
  return (await res.json()).data;
}

const [text, speech] = await Promise.all([list('text'), list('speech')]);
const byId = new Map([...text, ...speech].map((m) => [m.id, m]));
const n = (x) => (x === undefined || x === null || x === '' ? null : Number(x));
const models = {}, missing = [];
for (const id of wanted) {
  const m = byId.get(id);
  if (!m) { missing.push(id); if (before?.models?.[id]) models[id] = { ...before.models[id], note: `not listed on ${today}; price kept from ${previous}` }; continue; }
  const p = m.pricing ?? {};
  const isSpeech = (m.architecture?.output_modalities ?? []).includes('speech');
  if (isSpeech) {
    const perSecond = n(p.completion) > 0 && !(n(p.prompt) > 0);
    models[id] = { kind: 'per-unit', unit: perSecond ? 'second of generated audio' : 'character of input text', per_unit: perSecond ? n(p.completion) : n(p.prompt) };
  } else {
    models[id] = { kind: 'tokens', unit: 'token', input: n(p.prompt), output: n(p.completion),
      ...(n(p.input_cache_read) !== null ? { cache_read: n(p.input_cache_read) } : {}),
      ...(n(p.input_cache_write) !== null ? { cache_write: n(p.input_cache_write) } : {}),
      ...(n(p.input_cache_write_1h) !== null ? { cache_write_1h: n(p.input_cache_write_1h) } : {}) };
  }
  if (p.overrides?.length) models[id].overrides = 'OpenRouter lists surcharges for long prompts or times of day; the base price is used';
}

const out = { read_on: today, source: `${LISTS.text} and ${LISTS.speech} (public, no key)`,
  units: 'tokens: dollars per token; per-unit: dollars per unit named', models };
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(out, null, 1) + '\n');

// What changed since the last price file.
const rows = [];
for (const [id, p] of Object.entries(models)) {
  const b = before?.models?.[id];
  for (const k of ['input', 'output', 'cache_read', 'cache_write', 'per_unit']) {
    if (p[k] === undefined && b?.[k] === undefined) continue;
    const was = b?.[k] ?? null, now = p[k] ?? null;
    rows.push(`| ${id} | ${k} | ${was ?? '–'} | ${now ?? '–'} | ${was === now ? 'same' : was === null ? 'new' : now === null ? 'gone' : `${now > was ? '+' : ''}${Math.round(((now - was) / was) * 100)}%`} |`);
  }
}
console.log([`Prices read ${today}${previous ? `, compared with ${previous}` : ''}.`, '', '| Model | Price | Before | Now | Change |', '|---|---|---|---|---|', ...rows,
  ...(missing.length ? ['', `Not listed today: ${missing.join(', ')}.`] : [])].join('\n'));
console.error(`wrote ${basename(outFile)}`);
