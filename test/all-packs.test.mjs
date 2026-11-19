import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ALL_23_PACKS = [
  "accepted-output-ledger", "ask-twice", "can-your-gate-fire", "cost-by-design",
  "count-the-entry-roles", "decision-ledger", "design-is-arithmetic", "did-the-model-look",
  "frontier-clarity-physics-canon", "frontier-contract-moat", "frontier-loop-proximity-dissent",
  "frontier-world-model-answerability", "hash-receipt", "local-or-cloud", "retire-a-model",
  "two-films-one-script", "type-and-colour-laws", "wave2-effort-inversion",
  "wave2-eight-leadership-tensions", "wave2-prefix-cache-drift", "wave2-wake-sleep-gate",
  "wave2-zero-experience-trap", "what-the-meter-counts",
];

test("all 23 Proof Packs exist with substantial README documentation (>800 bytes) and MIT LICENSE", () => {
  assert.ok(fs.existsSync(path.join(ROOT, "LICENSE")), "missing MIT LICENSE");
  assert.ok(fs.existsSync(path.join(ROOT, "CITATION.cff")), "missing CITATION.cff");
  for (const p of ALL_23_PACKS) {
    const rm = path.join(ROOT, p, "README.md");
    assert.ok(fs.existsSync(rm), `missing README in ${p}`);
    const sz = fs.statSync(rm).size;
    assert.ok(sz >= 800, `README in ${p} is too thin (${sz} bytes < 800)`);
  }
});

test("all 9 Frontier and Wave-2 packs reproduce exact published essay metrics", () => {
  const runJson = (dir) => JSON.parse(execFileSync(process.execPath, [path.join(ROOT, dir, "run.mjs")], { encoding: "utf8" }).trim());

  const f01 = runJson("frontier-world-model-answerability");
  assert.equal(f01.correctOnLive, 16);
  assert.equal(f01.correctAbstentions, 8);
  assert.equal(f01.falseConfidentAnswers, 0);

  const f02 = runJson("frontier-loop-proximity-dissent");
  assert.equal(f02.interruptionReductionPct, 88.6);
  assert.equal(f02.hiddenSharePct, 33.8);

  const f03 = runJson("frontier-clarity-physics-canon");
  assert.equal(f03.snake, 0.047);
  assert.equal(f03.flock, 0.39);
  assert.equal(f03.hitchesCaught, 2);

  const f04 = runJson("frontier-contract-moat");
  assert.equal(f04.static.recoveryPct, 98.5);
  assert.equal(f04.static.withinOneCentPct, 100);
  assert.equal(f04.governed.cloneMisroutes, 17);

  const w01 = runJson("wave2-effort-inversion");
  assert.equal(w01.lowFinished, 12);
  assert.equal(w01.highFinished, 6);
  assert.equal(w01.carbon4kJson, 1);
  assert.equal(w01.carbon16kJson, 5);
  assert.equal(w01.glitchesAt1Fps, 0);

  const w02 = runJson("wave2-wake-sleep-gate");
  assert.equal(w02.proposalsChecked, 5);
  assert.equal(w02.promoted, 0);
  assert.equal(w02.leakControlBlocked, true);
  assert.equal(w02.validControlPromoted, true);

  const w03 = runJson("wave2-prefix-cache-drift");
  assert.equal(w03.driftingCacheSharePct, 63.49);
  assert.equal(w03.fixedCacheSharePct, 95.5);
  assert.equal(w03.extraMissTokens, 1749600);
  assert.equal(w03.costMultiplier, 3.38);

  const w04 = runJson("wave2-zero-experience-trap");
  assert.equal(w04.buildA.visibleScreenBlinksOnPoll, 18);
  assert.equal(w04.buildB.visibleScreenBlinksOnPoll, 0);
  assert.equal(w04.buildB.experienceGate, "PASS");

  const w05 = runJson("wave2-eight-leadership-tensions");
  assert.equal(w05.conventionalCovered, 0);
  assert.equal(w05.upgradedCovered, 5);
  assert.equal(w05.tensionsCount, 8);
});

test("BYO-stack CLI modes (--diff, --svg, --skill, --jsonl, --streak-bound) work on real user inputs", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "proof-packs-cli-"));

  // 1. --diff on two prompt payloads
  const p1 = path.join(tmp, "t1.json"), p2 = path.join(tmp, "t2.json");
  fs.writeFileSync(p1, "A".repeat(400) + "/home/user/.skills/s10" + "B".repeat(1200));
  fs.writeFileSync(p2, "A".repeat(400) + "/cache/plugins/v2/s10" + "B".repeat(1200));
  const diff = JSON.parse(execFileSync(process.execPath, [path.join(ROOT, "wave2-prefix-cache-drift/run.mjs"), "--diff", p1, p2], { encoding: "utf8" }));
  assert.equal(diff.identical, false);
  assert.equal(diff.estimatedFractureToken, 100);
  assert.ok(diff.invalidatedDownstreamTokens >= 300);

  // 2. --svg on wide 2D flock SVG
  const svg = path.join(tmp, "flock.svg");
  const circles = Array.from({ length: 40 }, (_, i) => `<circle cx="${(i % 8) * 50}" cy="${Math.floor(i / 8) * 45}" r="4"/>`).join("");
  fs.writeFileSync(svg, `<svg>${circles}</svg>`);
  const pca = JSON.parse(execFileSync(process.execPath, [path.join(ROOT, "frontier-clarity-physics-canon/run.mjs"), "--svg", svg], { encoding: "utf8" }));
  assert.equal(pca.passesCanon, true);

  // 3. --skill on executable vs platitude SKILL.md
  const goodSkill = path.join(tmp, "GOOD_SKILL.md");
  fs.writeFileSync(goodSkill, "Run `node check.mjs --strict` and assert `ratio >= 0.25` and `latency <= 10 ms` on `schema.json` before `finish.py`.");
  const sk = JSON.parse(execFileSync(process.execPath, [path.join(ROOT, "wave2-wake-sleep-gate/run.mjs"), "--skill", goodSkill], { encoding: "utf8" }));
  assert.equal(sk.passesStaticGate, true);

  // 4. --jsonl separating length truncation from true schema error
  const jl = path.join(tmp, "resp.jsonl");
  fs.writeFileSync(jl, [
    JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "{\"ok\":true}" } }] }),
    JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "{\"cut\":" } }] }),
    JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "not json" } }] }),
  ].join("\n"));
  const cl = JSON.parse(execFileSync(process.execPath, [path.join(ROOT, "wave2-effort-inversion/run.mjs"), "--jsonl", jl], { encoding: "utf8" }));
  assert.deepEqual(cl, { totalCalls: 3, validJson: 1, truncatedByCap: 1, trueSchemaError: 1 });

  // 5. --streak-bound 0.05 -> 59
  const sb = JSON.parse(execFileSync(process.execPath, [path.join(ROOT, "frontier-contract-moat/run.mjs"), "--streak-bound", "0.05"], { encoding: "utf8" }));
  assert.equal(sb.exactStreakRequired, 59);

  fs.rmSync(tmp, { recursive: true, force: true });
});
