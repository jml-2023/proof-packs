// What the meter counts: re-read each vendor's public pricing pages, check that the
// lines showing what it charges for are still there, count the pricing words on each
// page, and run the forecast ledger's checks. Node 18+, no dependencies, no key.
//
//   node watch.mjs                         all vendors in vendors.json
//   node watch.mjs --only intercom,zendesk some of them
//   node watch.mjs --vendors my-tools.json your own list, same shape
//   node watch.mjs --keep-pages            also save each page's text in the run folder
//   node watch.mjs --no-archive            never fall back to the Wayback Machine
//   node watch.mjs --out runs/<name>       where to write (default runs/<today>)
//   node watch.mjs --ledger none           skip the forecast ledger's checks

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import https from 'node:https';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i === -1 ? dflt : args[i + 1];
};
const flag = (name) => args.includes(name);

const today = new Date().toISOString().slice(0, 10);
const vendorsFile = opt('--vendors', join(here, 'vendors.json'));
const ledgerFile = opt('--ledger', join(here, 'ledger.json'));
const outDir = opt('--out', join(here, 'runs', today));
const only = opt('--only', '')?.split(',').filter(Boolean) ?? [];
const keepPages = flag('--keep-pages');
const useArchive = !flag('--no-archive');
const PAUSE_MS = 1500;
// Five reads miss a design served half the time about once in 32 runs; three missed it once on 30 October 2026.
const MAX_READS = 5;
const UA = 'Mozilla/5.0 (compatible; what-the-meter-counts/1.0; a reader checking public pricing pages, one request at a time)';

// Words that suggest each way of charging. They flag where to look; a person decides.
const UNIT_WORDS = {
  seat: [
    /\bper[- ](user|seat|person|member|licen[cs]e)\b/gi,
    /\/\s*(user|seat)\s*\/\s*(month|mo)\b/gi,
    /\bseat (price|fee|charge|minimum)s?\b/gi,
    /\b(user|seat)s? per month\b/gi,
  ],
  usage: [
    /\b(credits?|tokens?)\b/gi,
    /\bpay[- ]as[- ]you[- ]go\b/gi,
    /\bper (request|action|conversation|session|message|task|call|minute)s?\b/gi,
    /\busage[- ]based\b/gi,
    /\bAPI (pricing|rates|prices)\b/gi,
    /\bmetered\b/gi,
    /\bcompute units?\b/gi,
  ],
  outcome: [
    /\bper (resolution|outcome|resolved|successful|qualified lead|qualification)s?\b/gi,
    /\boutcome[- ]based\b/gi,
    /\bautomated resolutions?\b/gi,
  ],
  'accepted-output': [
    /\bper (accepted|approved)\b/gi,
    /\bonly pay for (accepted|approved)\b/gi,
    /\bpay (only )?(when|if) you (accept|approve)\b/gi,
  ],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '\u2019', lsquo: '\u2018',
  ldquo: '\u201c', rdquo: '\u201d', ndash: '\u2013', mdash: '\u2014', hellip: '\u2026',
  trade: '\u2122', reg: '\u00ae', copy: '\u00a9', euro: '\u20ac', pound: '\u00a3', times: '\u00d7',
};
function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

// A template with a shadowrootmode attribute is a shadow root the browser shows (Gorgias draws its price cards in
// one), so it's kept as text; any other template is hidden and dropped.
function htmlToText(html) {
  return decode(
    html
      .replace(/<template\b([^>]*\bshadowroot(?:mode)?\s*=[^>]*)>/gi, '<div$1>')
      .replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, '\n'),
  )
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

// Compare without case, curly quotes or any whitespace, so a line split across tags still matches.
function norm(s) {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201b\u2032]/g, "'")
    .replace(/[\u201c\u201d\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, '');
}

async function fetchText(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(45000),
    });
    let buf = Buffer.from(await res.arrayBuffer());
    if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
    return { status: res.status, html: buf.toString('utf8') };
  } catch (e) {
    // The Wayback Machine sends response headers larger than fetch accepts.
    if (e?.cause?.code === 'UND_ERR_HEADERS_OVERFLOW') return getWithBigHeaders(url);
    throw e;
  }
}

function getWithBigHeaders(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': UA }, maxHeaderSize: 1 << 20, timeout: 45000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        resolve(getWithBigHeaders(new URL(res.headers.location, url).href, redirects - 1));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        let buf = Buffer.concat(chunks);
        if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
        resolve({ status: res.statusCode, html: buf.toString('utf8') });
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

function looksBlocked(status, text) {
  return status !== 200 || text.length < 400 || /your request has been blocked|access denied|enable javascript and cookies/i.test(text.slice(0, 600));
}

// The lookup service sometimes answers with an error page instead of JSON, so ask up to three
// times, waiting longer each time.
async function latestCapture(url) {
  const api = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(api, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(45000) });
      const j = JSON.parse(await res.text());
      const c = j?.archived_snapshots?.closest;
      if (!c?.available) return null;
      return { timestamp: c.timestamp, url: c.url.replace(/\/web\/(\d+)\//, '/web/$1id_/') };
    } catch (e) {
      lastError = e;
      await sleep(PAUSE_MS * 2 * attempt);
    }
  }
  throw lastError;
}

// Only the counts are kept. Snippets around each word copied whatever sat next to it, other companies' customer
// stories included, into results.json; to see where the words fall, read the page text from --keep-pages.
function unitHits(text) {
  const out = {};
  for (const [unit, patterns] of Object.entries(UNIT_WORDS)) {
    let count = 0;
    for (const re of patterns) count += [...text.matchAll(re)].length;
    out[unit] = { count };
  }
  return out;
}

async function readPage(page) {
  let via = 'live';
  let fetchedUrl = page.url;
  let status = null;
  let html = '';
  let error = null;
  try {
    ({ status, html } = await fetchText(page.url));
  } catch (e) {
    error = String(e?.cause?.code ?? e?.name ?? e);
  }
  let text = html ? htmlToText(html) : '';
  if (useArchive && page.kind !== 'history' && (error || looksBlocked(status, text))) {
    await sleep(PAUSE_MS);
    try {
      const cap = await latestCapture(page.url);
      if (cap) {
        await sleep(PAUSE_MS);
        ({ status, html } = await fetchText(cap.url));
        text = htmlToText(html);
        via = `archive ${cap.timestamp.slice(0, 4)}-${cap.timestamp.slice(4, 6)}-${cap.timestamp.slice(6, 8)}`;
        fetchedUrl = cap.url;
        error = null;
      }
    } catch (e) {
      error = `${error ?? ''} archive: ${String(e?.cause?.code ?? e?.name ?? e)}`.trim();
    }
  }
  if (page.kind === 'history' && /web\.archive\.org\/web\/(\d{8})/.test(page.url)) {
    const ts = page.url.match(/web\.archive\.org\/web\/(\d{8})/)[1];
    via = `archive ${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
  }
  const lookFor = (t, h) => {
    const nText = norm(t);
    const nRaw = norm(decode(h.replace(/<[^>]+>/g, ' ')));
    return (page.quotes ?? []).map((q) => {
      const n = norm(q.text);
      return nText.includes(n) ? 'text' : nRaw.includes(n) ? 'page source' : null;
    });
  };
  // Some sites serve two designs of the same page at random. If a line is missing from a
  // live read, read again (up to MAX_READS reads) and count a line as found if any read shows it.
  const reads = [{ text, where: lookFor(text, html) }];
  const stillMissing = () => (page.quotes ?? []).some((_, i) => reads.every((r) => !r.where[i]));
  while (via === 'live' && !error && reads.length < MAX_READS && stillMissing()) {
    await sleep(PAUSE_MS);
    try {
      const again = await fetchText(page.url);
      const t = htmlToText(again.html);
      reads.push({ text: t, where: lookFor(t, again.html) });
    } catch {
      break;
    }
  }
  const quotes = (page.quotes ?? []).map((q, i) => {
    const seen = reads.filter((r) => r.where[i]).length;
    return { ...q, found: seen > 0, where: reads.find((r) => r.where[i])?.where[i] ?? null, found_in_reads: `${seen} of ${reads.length}` };
  });
  const allText = reads.map((r) => r.text).join('\n\n');
  return {
    id: page.id,
    url: page.url,
    kind: page.kind,
    fetched_url: fetchedUrl,
    via,
    status,
    error,
    reads: reads.length,
    chars: allText.length,
    text_sha256: createHash('sha256').update(allText).digest('hex'),
    quotes,
    words: unitHits(text),
    text: allText,
  };
}

function checkSignal(check, pageTexts) {
  const text = pageTexts.get(`${check.vendor}/${check.page}`);
  if (text == null) return { ...check, result: 'page not read' };
  // A page's text breaks lines at every tag, so a phrase with a link in it spans two lines.
  // Match on the text with all whitespace as single spaces.
  const flat = text.replace(/\s+/g, ' ');
  const re = new RegExp(check.look_for, 'gi');
  const hits = [...flat.matchAll(re)].slice(0, 3).map((m) => {
    const s = Math.max(0, m.index - 80);
    return flat.slice(s, m.index + m[0].length + 80).trim();
  });
  const seen = hits.length > 0;
  const asExpected = check.expect === 'present' ? seen : !seen;
  return { ...check, seen, result: asExpected ? 'as on the baseline' : 'changed: read the page', hits };
}

const vendorsDoc = JSON.parse(readFileSync(vendorsFile, 'utf8'));
const vendors = vendorsDoc.vendors.filter((v) => !only.length || only.includes(v.id));
mkdirSync(outDir, { recursive: true });
if (keepPages) mkdirSync(join(outDir, 'pages'), { recursive: true });

const pageTexts = new Map();
const results = [];
let first = true;
for (const v of vendors) {
  const pages = [];
  for (const p of v.pages) {
    if (!first) await sleep(PAUSE_MS);
    first = false;
    const r = await readPage(p);
    const missing = r.quotes.filter((q) => !q.found).length;
    console.log(`${v.id}/${p.id}: ${r.via}, HTTP ${r.status ?? '-'}${r.error ? ` (${r.error})` : ''}, ${r.quotes.length - missing}/${r.quotes.length} lines found${r.reads > 1 ? ` over ${r.reads} reads` : ''}`);
    pageTexts.set(`${v.id}/${p.id}`, r.text);
    if (keepPages) writeFileSync(join(outDir, 'pages', `${v.id}--${p.id}.txt`), `URL: ${r.fetched_url}\nRead: ${new Date().toISOString()} (${r.via})\n\n${r.text}`);
    const { text, ...rest } = r;
    pages.push(rest);
  }
  const unit_status = {};
  for (const u of v.charges_for) {
    const lines = pages.flatMap((p) => p.quotes.filter((q) => q.shows === u));
    unit_status[u] = lines.some((q) => q.found) ? 'confirmed' : lines.length ? 'not found today' : 'no line given';
  }
  const allQuotes = pages.flatMap((p) => p.quotes);
  results.push({
    id: v.id,
    vendor: v.vendor,
    product: v.product,
    group: v.group,
    charges_for: v.charges_for,
    summary: v.summary,
    unit_status,
    lines_found: allQuotes.filter((q) => q.found).length,
    lines_total: allQuotes.length,
    pages,
  });
}

let signals = [];
if (ledgerFile !== 'none') try {
  const ledger = JSON.parse(readFileSync(ledgerFile, 'utf8'));
  signals = ledger.rows.map((row) => ({
    id: row.id,
    forecast: row.forecast,
    checks: (row.checks ?? []).filter((c) => !only.length || only.includes(c.vendor)).map((c) => checkSignal(c, pageTexts)),
  }));
} catch (e) {
  console.log(`(no ledger checks: ${e.message})`);
}

const run = {
  run_at: new Date().toISOString(),
  vendors_file: basename(vendorsFile),
  archive_fallback: useArchive,
  vendors: results,
  signals,
};
writeFileSync(join(outDir, 'results.json'), JSON.stringify(run, null, 2));

// The table a reader looks at.
const UNIT_LABEL = { seat: 'a seat', usage: 'usage', outcome: 'outcomes', 'accepted-output': 'accepted outputs' };
const groups = vendorsDoc.groups ?? {};
let md = `# What the meter counts: run of ${run.run_at.slice(0, 10)}\n\n`;
md += `Each vendor's public pages, read one at a time on ${run.run_at.slice(0, 16).replace('T', ' ')} UTC. "Charges for" is a person's reading of the quoted lines; "Lines found" says how many of those lines are still on the pages today. A page that refused an automated read was read through its latest Wayback Machine copy, and the "Read" column says so.\n\n`;
for (const [g, label] of Object.entries(groups)) {
  const rows = results.filter((r) => r.group === g);
  if (!rows.length) continue;
  md += `## ${label}\n\n| Vendor | Product | Charges for | Confirmed today | Lines found | Read |\n|---|---|---|---|---|---|\n`;
  for (const r of rows) {
    const charges = r.charges_for.map((u) => UNIT_LABEL[u] ?? u).join(' + ');
    const confirmed = Object.entries(r.unit_status).map(([u, s]) => `${UNIT_LABEL[u] ?? u}: ${s}`).join('; ');
    const read = [...new Set(r.pages.map((p) => p.via))].join(', ');
    md += `| ${r.vendor} | ${r.product} | ${charges} | ${confirmed} | ${r.lines_found} of ${r.lines_total} | ${read} |\n`;
  }
  md += '\n';
}
const missing = results.flatMap((r) => r.pages.flatMap((p) => p.quotes.filter((q) => !q.found).map((q) => `- ${r.vendor}, ${p.id} (${p.via}${p.status ? `, HTTP ${p.status}` : ''}): "${q.text}"`)));
md += `## Lines not found today\n\n${missing.length ? missing.join('\n') : 'None: every quoted line is still on its page.'}\n\n`;
md += `Read each one on the page before concluding anything. A missing line means the page changed, the page refused the read, or the line moved behind a script; only the first is news.\n\n`;
md += `## Pricing words on each page\n\nCounts of words that suggest each way of charging. They show where to look, not what a vendor charges. A word count of zero for "accepted outputs" is the expected result.\n\n| Vendor | Page | Seat | Usage | Outcome | Accepted output |\n|---|---|---|---|---|---|\n`;
for (const r of results) for (const p of r.pages) md += `| ${r.vendor} | ${p.id} | ${p.words.seat.count} | ${p.words.usage.count} | ${p.words.outcome.count} | ${p.words['accepted-output'].count} |\n`;
writeFileSync(join(outDir, 'table.md'), md);

let sig = `# Forecast checks: run of ${run.run_at.slice(0, 10)}\n\nEach check looks for a phrase on a page read in this run and compares it with the baseline written into ledger.json. "As on the baseline" means nothing to read; "changed" means a person should read the page before the next review. No check scores a forecast by itself.\n\n`;
for (const s of signals) {
  sig += `## ${s.id}: ${s.forecast}\n\n`;
  if (!s.checks.length) sig += 'No automatic checks for this one.\n\n';
  for (const c of s.checks) {
    sig += `- **${c.vendor}/${c.page}**: looks for \`${c.look_for}\`, expected ${c.expect}. ${c.meaning} Result: **${c.result}**.\n`;
    for (const h of c.hits ?? []) sig += `  - "${h}"\n`;
  }
  sig += '\n';
}
writeFileSync(join(outDir, 'signals.md'), sig);

const lines = results.reduce((a, r) => a + r.lines_found, 0);
const total = results.reduce((a, r) => a + r.lines_total, 0);
const changed = signals.flatMap((s) => s.checks).filter((c) => c.result !== 'as on the baseline').length;
console.log(`\n${results.length} vendors, ${lines} of ${total} quoted lines found; ${changed} forecast checks to read. Wrote ${outDir}/table.md, signals.md and results.json.`);
