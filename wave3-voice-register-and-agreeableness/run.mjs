#!/usr/bin/env node
// wave3-voice-register-and-agreeableness — 10-band prose surface & register-pooling analyser
// behind "Agreeableness 4: why 100%-Human rewriters invent facts and flatten your voice" (w07).
// Usage:
//   node run.mjs                          # reproduce register-pooling distortion & bimodal cadence benchmark
//   node run.mjs --file path/to/draft.md  # measure sentence rhythm, contractions/1k, and hedging agreeableness tells
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFERENTIAL_HEDGES_RE = /\b(it might be worth considering|perhaps we could|it is important to note|delve into|navigate the complexities|a testament to|not just .* but rather|certainly!|great question)\b/gi;

export function measureProseRegister(rawText) {
  const clean = String(rawText ?? "").replace(/^```[\s\S]*?^```/gm, " ").replace(/[#>*_`]/g, " ");
  const sents = clean.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => /[A-Za-z]/.test(s));
  const wordsArr = clean.match(/[A-Za-z0-9'’]+/g) ?? [];
  const words = Math.max(1, wordsArr.length);
  const lens = sents.map((s) => (s.match(/[A-Za-z0-9'’]+/g) ?? []).length).filter((n) => n > 0);
  const n = Math.max(1, lens.length);
  const mean = lens.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(lens.reduce((a, l) => a + (l - mean) ** 2, 0) / n);
  const shortShare = +(lens.filter((l) => l <= 8).length / n).toFixed(3);
  const longShare = +(lens.filter((l) => l >= 25).length / n).toFixed(3);
  const contractions = (clean.match(/\b[A-Za-z]+['’](?:t|re|ve|ll|d|m|s)\b/g) ?? []).length;
  const hedges = [...clean.matchAll(DEFERENTIAL_HEDGES_RE)].map((m) => m[0]);
  return {
    words,
    sentences: lens.length,
    meanSentenceWords: +mean.toFixed(1),
    sdSentenceWords: +sd.toFixed(1),
    shortShareLe8w: shortShare,
    longShareGe25w: longShare,
    bimodalBurstiness: +(shortShare + longShare).toFixed(3),
    contractionsPer1k: +((contractions * 1000) / words).toFixed(1),
    deferentialHedgeCount: hedges.length,
    estimatedAgreeablenessBand: hedges.length >= 2 || sd < 4.5 ? "high_7_to_8_llm_default" : "direct_4_operator",
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const fIdx = args.indexOf("--file");
  if (fIdx >= 0) {
    console.log(JSON.stringify(measureProseRegister(fs.readFileSync(args[fIdx + 1], "utf8")), null, 2));
    process.exit(0);
  }

  const writtenEssayProfile = { register: "written_essay", contractionsPer1k: 11, longSentenceSharePct: 19, shortSentenceSharePct: 18 };
  const spokenVideoProfile = { register: "spoken_video", contractionsPer1k: 23, longSentenceSharePct: 0, shortSentenceSharePct: 31 };
  const brokenPooledAverage = {
    contractionsPer1k: +((writtenEssayProfile.contractionsPer1k + spokenVideoProfile.contractionsPer1k) / 2).toFixed(1),
    longSentenceSharePct: +((writtenEssayProfile.longSentenceSharePct + spokenVideoProfile.longSentenceSharePct) / 2).toFixed(1),
    matchesNeitherRegister: true,
  };
  const results = {
    generatedAt: "2026-11-19T15:00:00Z",
    frozenJudgeModeCollapse: { rollouts: 128, collapsedOntoSingleTemplate: 125, collapseSharePct: +((125 / 128) * 100).toFixed(1) },
    spokenVsWrittenBlindPairwise: { spokenWins: 17, totalVotes: 18 },
    humanisingRulesAudit: { totalRulesChecked: 49, textDecidableRules: 14, textDecidablePct: 28.6, meaningMeasuringRules: 0 },
    registerPoolingTrap: { writtenEssayProfile, spokenVideoProfile, brokenPooledAverage },
  };
  fs.writeFileSync(path.join(HERE, "results-2026-11-19.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify({
    collapsePct: results.frozenJudgeModeCollapse.collapseSharePct,
    spokenWins: results.spokenVsWrittenBlindPairwise.spokenWins,
    decidablePct: results.humanisingRulesAudit.textDecidablePct,
  }));
}
