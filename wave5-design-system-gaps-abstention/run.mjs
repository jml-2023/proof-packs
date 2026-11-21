#!/usr/bin/env node
// wave5-design-system-gaps-abstention — Audits the 24 real live multi-model HTML outputs in live-outputs/
// and provides --audit-html <component.html> --tokens <tokens.css> for CI design-system gap checking (w18).
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function extractDeclaredCssVars(cssText) {
  return new Set([...String(cssText).matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)].map((m) => m[1]));
}

export function auditComponentAgainstTokens(html, declaredVars, briefId = "") {
  const clean = String(html ?? "").trim();
  const usedVars = [...clean.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)].map((m) => m[1]);
  const undeclaredVars = [...new Set(usedVars.filter((v) => !declaredVars.has(v)))];

  const withoutRoot = clean.replace(/:root\s*\{[\s\S]*?\}/g, "");
  const rawHex = [...withoutRoot.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
  const rawColorFns = [...withoutRoot.matchAll(/\b(?:rgb|rgba|hsl|hsla|oklch|oklab)\s*\([^)]+\)/gi)].map((m) => m[0]);
  const shadowOnlyRaw = rawColorFns.length > 0 && rawHex.length === 0 && rawColorFns.every((fn) => {
    const idx = withoutRoot.indexOf(fn);
    const lineStart = withoutRoot.lastIndexOf("\n", idx);
    return /box-shadow/i.test(withoutRoot.slice(Math.max(0, lineStart), idx + fn.length + 10));
  });

  const hardcodedColourCount = rawHex.length + rawColorFns.length;
  const declaredGap = /data-ds-gap\s*=\s*["']([^"']+)["']/i.exec(clean)?.[1] ?? null;
  const usedWarning = usedVars.some((v) => v.includes("status-warning"));
  const usedBrandPrimary = usedVars.includes("--ds-brand-primary");

  const usedWarningForDanger = (briefId === "card-declined" || briefId === "delete-workspace") && usedWarning;
  const usedBrandBlueForDestructive = briefId === "delete-workspace" && /Delete forever/i.test(clean) && usedBrandPrimary && !declaredGap;
  const fakedDisabled = briefId === "locked-api-key" && !declaredGap && (/opacity\s*:\s*0\.[3456]/i.test(withoutRoot) || usedVars.includes("--ds-ink-secondary"));

  const passesTokenLinter = undeclaredVars.length === 0 && hardcodedColourCount === 0;
  const semanticSilentLie = !declaredGap && (usedWarningForDanger || usedBrandBlueForDestructive || fakedDisabled);
  const honestCleanAbstention = Boolean(declaredGap && passesTokenLinter && !usedWarningForDanger);

  return {
    passesTokenLinter,
    undeclaredVars,
    hardcodedColourCount,
    shadowOnlyRaw,
    declaredGap,
    usedWarningForDanger,
    usedBrandBlueForDestructive,
    semanticSilentLie,
    honestCleanAbstention,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const hIdx = args.indexOf("--audit-html");
  if (hIdx >= 0) {
    const htmlPath = args[hIdx + 1];
    const tIdx = args.indexOf("--tokens");
    const tokPath = tIdx >= 0 ? args[tIdx + 1] : path.join(HERE, "tokens.css");
    const res = auditComponentAgainstTokens(fs.readFileSync(htmlPath, "utf8"), extractDeclaredCssVars(fs.readFileSync(tokPath, "utf8")));
    console.log(JSON.stringify(res, null, 2));
    process.exit(res.passesTokenLinter && !res.semanticSilentLie ? 0 : 2);
  }

  const declared = extractDeclaredCssVars(fs.readFileSync(path.join(HERE, "tokens.css"), "utf8"));
  const outDir = path.join(HERE, "live-outputs");
  const files = fs.readdirSync(outDir).filter((f) => f.endsWith(".html")).sort();
  const rows = files.map((f) => {
    const [arm, briefId, vendor, modelName] = f.replace(/\.html$/, "").split("__");
    const html = fs.readFileSync(path.join(outDir, f), "utf8");
    const sha12 = createHash("sha256").update(html).digest("hex").slice(0, 12);
    return { file: f, arm, briefId, model: `${vendor}/${modelName}`, sha12, ...auditComponentAgainstTokens(html, declared, briefId) };
  });

  const armA = rows.filter((r) => r.arm === "strict_linter_only");
  const armB = rows.filter((r) => r.arm === "gaps_abstention_contract");
  const summary = {
    totalLiveBuilds: rows.length,
    armALinterPass: armA.filter((r) => r.passesTokenLinter).length,
    armASilentLies: armA.filter((r) => r.semanticSilentLie).length,
    armAWarnAmberOnDanger: armA.filter((r) => r.usedWarningForDanger).length,
    armBGapDeclared: armB.filter((r) => Boolean(r.declaredGap)).length,
    armBCleanAbstentions: armB.filter((r) => r.honestCleanAbstention).length,
    armBSilentLies: armB.filter((r) => r.semanticSilentLie).length,
    armBShadowLeakCount: armB.filter((r) => r.shadowOnlyRaw).length,
  };
  console.log(JSON.stringify(summary));
}
