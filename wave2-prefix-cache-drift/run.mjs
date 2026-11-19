#!/usr/bin/env node
// wave2-prefix-cache-drift — Prompt prefix KV-cache fracture detector & 30-turn cost simulator
// behind "The tokens I paid for twice because one file path moved" (w03).
// Usage:
//   node run.mjs                                        # reproduce 30-turn 180k-prefix accounting benchmark
//   node run.mjs --diff turn1-req.json turn2-req.json   # find exact first diverging byte & token between two outbound LLM payloads
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

export function diffPromptPrefixes(textA, textB, { charsPerToken = 4 } = {}) {
  const minLen = Math.min(textA.length, textB.length);
  let idx = 0;
  let line = 1;
  while (idx < minLen && textA.charCodeAt(idx) === textB.charCodeAt(idx)) {
    if (textA.charCodeAt(idx) === 10) line++;
    idx++;
  }
  if (idx === textA.length && idx === textB.length) {
    return { identical: true, prefixCharsMatched: idx, estimatedCachedTokens: Math.floor(idx / charsPerToken), invalidatedDownstreamTokens: 0 };
  }
  const estToken = Math.floor(idx / charsPerToken);
  const totalTokensB = Math.ceil(textB.length / charsPerToken);
  return {
    identical: false,
    firstDivergingCharOffset: idx,
    firstDivergingLine: line,
    estimatedFractureToken: estToken,
    invalidatedDownstreamTokens: Math.max(0, totalTokensB - estToken),
    cacheShareMaxPctOnTurn2: +((estToken / Math.max(1, totalTokensB)) * 100).toFixed(2),
    contextA: textA.slice(Math.max(0, idx - 30), idx + 50),
    contextB: textB.slice(Math.max(0, idx - 30), idx + 50),
  };
}

export function canonicaliseSkills(skills, logicalRoot = "$SKILLS") {
  return [...skills]
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((s) => ({ ...s, path: `${logicalRoot}/${s.id}/SKILL.md` }));
}

function buildTurnBlocks(turn, { canonical = false, rand }) {
  const blocks = [{ id: "system-core", tokens: 18000, text: "core-constitution-v1" }];
  const skills = Array.from({ length: 45 }, (_, i) => {
    const id = `skill-${String(i + 1).padStart(2, "0")}`;
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

export function simulateSession({ canonical }) {
  const rand = rng(20260825);
  let prevBlocks = null;
  let rawInputTokens = 0, cachedReadTokens = 0, cacheWriteTokens = 0, uncachedTokens = 0, effectiveBilledUnits = 0;

  for (let turn = 1; turn <= 30; turn++) {
    const cur = buildTurnBlocks(turn, { canonical, rand });
    const turnTotal = cur.reduce((s, b) => s + b.tokens, 0);
    rawInputTokens += turnTotal;
    if (!prevBlocks) {
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: node run.mjs [--diff request-turn1.json request-turn2.json]");
    process.exit(0);
  }
  const dIdx = args.indexOf("--diff");
  if (dIdx >= 0) {
    const a = fs.readFileSync(args[dIdx + 1], "utf8");
    const b = fs.readFileSync(args[dIdx + 2], "utf8");
    console.log(JSON.stringify(diffPromptPrefixes(a, b), null, 2));
    process.exit(0);
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
}
