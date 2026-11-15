#!/usr/bin/env node
// wave2-prefix-cache-drift — Runnable prompt-cache invalidation & canonicaliser benchmark behind W3:
// "The 4.5 million tokens I paid for twice (because one file path moved)."
// Models exact prefix-based KV-cache billing (read = 0.10x, write = 1.25x, uncached input = 1.00x)
// across a 30-turn agent session with a 180,000-token system+skills+tools prefix, showing how one
// non-deterministic skill directory path at token 36,000 silently busts 144,000 cached tokens every turn.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function rng(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Build 45 skill blocks + 120k-token tool/repo context = ~180k base prompt
function buildTurnBlocks(turn, { canonical = false, rand }) {
  const blocks = [{ id: "system-core", tokens: 18000, text: "core-constitution-v1" }];
  const skills = Array.from({ length: 45 }, (_, i) => {
    const id = `skill-${String(i + 1).padStart(2, "0")}`;
    // Without canonicalisation, skill #10 resolves randomly from plugin-cache vs ~/.skills on each turn
    const flip = !canonical && i === 9 && rand() < 0.5;
    const loc = flip ? `/cache/plugins/v2/${id}/SKILL.md` : `/home/user/.skills/${id}/SKILL.md`;
    return { id, tokens: 1800, text: `${id}@${loc}` };
  });
  if (canonical) skills.sort((a, b) => a.id.localeCompare(b.id));
  blocks.push(...skills);
  blocks.push({ id: "tool-schemas", tokens: 81000, text: "mcp-and-resident-tool-schemas-v1" });
  blocks.push({ id: `conversation-turn-${turn}`, tokens: 2200, text: `turn-${turn}-delta` });
  return blocks;
}

// Prefix KV-cache accounting: matches exact identical prefix from token 0 up to first differing block
export function simulateSession({ canonical }) {
  const rand = rng(20260825);
  let prevBlocks = null;
  let rawInputTokens = 0;
  let cachedReadTokens = 0;
  let cacheWriteTokens = 0;
  let uncachedTokens = 0;
  let effectiveBilledUnits = 0; // 1.0 = uncached token equivalent (read=0.10, write=1.25, uncached=1.0)

  for (let turn = 1; turn <= 30; turn++) {
    const cur = buildTurnBlocks(turn, { canonical, rand });
    const turnTotal = cur.reduce((s, b) => s + b.tokens, 0);
    rawInputTokens += turnTotal;

    if (!prevBlocks) {
      // Turn 1 writes the static prefix into cache
      const staticTok = turnTotal - 2200;
      cacheWriteTokens += staticTok;
      uncachedTokens += 2200;
      effectiveBilledUnits += staticTok * 1.25 + 2200 * 1.0;
    } else {
      let matched = 0;
      for (let i = 0; i < Math.min(prevBlocks.length, cur.length); i++) {
        if (prevBlocks[i].text !== cur[i].text) break;
        matched += cur[i].tokens;
      }
      const miss = turnTotal - matched;
      cachedReadTokens += matched;
      // Missed static prefix gets re-written/billed
      const reWrite = Math.max(0, miss - turn * 2200);
      const tail = miss - reWrite;
      cacheWriteTokens += reWrite;
      uncachedTokens += tail;
      effectiveBilledUnits += matched * 0.10 + reWrite * 1.25 + tail * 1.0;
    }
    prevBlocks = cur;
  }

  return {
    canonical,
    turns: 30,
    rawInputTokens,
    cachedReadTokens,
    cacheReadSharePct: +((cachedReadTokens / rawInputTokens) * 100).toFixed(2),
    wastedMissTokens: rawInputTokens - cachedReadTokens,
    effectiveBilledTokenEquiv: Math.round(effectiveBilledUnits),
  };
}

const drifting = simulateSession({ canonical: false });
const fixed = simulateSession({ canonical: true });
const results = {
  generatedAt: "2026-11-15T12:30:00Z",
  pricingWeights: { cacheRead: 0.10, uncached: 1.0, cacheWrite: 1.25 },
  driftingSkillPaths: drifting,
  canonicalisedPaths: fixed,
  extraTokensPaidAtFullRate: drifting.wastedMissTokens - fixed.wastedMissTokens,
  costMultiplierDriftingVsFixed: +(drifting.effectiveBilledTokenEquiv / fixed.effectiveBilledTokenEquiv).toFixed(2),
};

fs.writeFileSync(path.join(HERE, "results-2026-11-15.json"), JSON.stringify(results, null, 2) + "\n");
console.log(JSON.stringify({
  driftingCacheSharePct: drifting.cacheReadSharePct,
  fixedCacheSharePct: fixed.cacheReadSharePct,
  extraMissTokens: results.extraTokensPaidAtFullRate,
  costMultiplier: results.costMultiplierDriftingVsFixed,
}));
