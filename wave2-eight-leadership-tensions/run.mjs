#!/usr/bin/env node
// wave2-eight-leadership-tensions — De-identified Design Leadership Deciding-Factor Matrix & Principles Auditor behind W5:
// "Eight arguments I keep having with myself (and the five product rules I never wrote down)."
// Audits a team's design-principles markdown file against the 8 classic exploration-vs-rigour tensions
// and the 5 unwritten agentic UX laws. Zero internal company quotes; 100% generalisable checklist.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const EIGHT_TENSIONS = [
  { id: "T1", poleA: "Explore loosely without premature rules", poleB: "Enforce strict zero-defect gates", decidingFactor: "Stage of work: making stays free; the release gate holds the veto." },
  { id: "T2", poleA: "Ship fast to learn", poleB: "Slow down because rework costs more", decidingFactor: "Where the shortcut lands: never shortcut a shared token, foundation component, or data contract." },
  { id: "T3", poleA: "Encode design rules in scripts", poleB: "Keep human aesthetic judgement", decidingFactor: "Computability: consistency and geometry go to code; meaning and emotional resonance stay with the eye." },
  { id: "T4", poleA: "One recommended path by default", poleB: "Full expert controls and transparency", decidingFactor: "Progressive disclosure: lead with one ranked recommendation (within at most three); reveal controls on demand." },
  { id: "T5", poleA: "Mock synthetic data to show the vision", poleB: "Only trust real production volume", decidingFactor: "Purpose of the artefact: vision prototypes may mock the wider world; validation gates require real distributions." },
  { id: "T6", poleA: "Share messy work early", poleB: "Wait until the experience is 10/10", decidingFactor: "Audience: show fellow builders early; show decision committees only once the experience holds together." },
  { id: "T7", poleA: "Agents run ahead autonomously", poleB: "Humans approve before action", decidingFactor: "Reversibility: reversible in-scope work runs first and reports; irreversible, external, or spend actions wait." },
  { id: "T8", poleA: "Pause immediately on anomaly", poleB: "Keep the service running smoothly", decidingFactor: "Fallback safety: reroute to a verified sibling if within error budget; hard-stop when safety or data boundaries trip." },
];

export const FIVE_UNWRITTEN_AGENTIC_RULES = [
  { id: "U1", name: "Confirmation over blank-slate onboarding", checkRe: /onboarding.*confirm|infer.*confirm/i, prompt: "Onboarding confirms what the system can already responsibly infer, clearly separating given facts from guesses." },
  { id: "U2", name: "One ranked recommendation (max three)", checkRe: /one recommend|at most three|ranked/i, prompt: "Surface one recommended next move with its reason, bounded within at most three options." },
  { id: "U3", name: "Run reversible work ahead, validate at the boundary", checkRe: /reversible.*ahead|out of the loop/i, prompt: "Agents execute reversible preparation before asking, and pause at the irreversible boundary." },
  { id: "U4", name: "Agent transport failures belong to the system", checkRe: /failed.*system|never blame.*user|retry/i, prompt: "A failed model or tool call is absorbed or clearly owned by the system, never dumped on the user as raw jargon." },
  { id: "U5", name: "Collapsed threads preserve an honest trace", checkRe: /collapsed.*summary|trace|what happened/i, prompt: "Collapsing background agent work keeps a plain one-line record of what changed and why." },
];

// Sample conventional pre-AI design principles doc (passes visual platitudes, misses all 5 agentic UX laws)
const SAMPLE_CONVENTIONAL_DOC = `
# Product Design Principles
1. Keep interfaces clean, consistent, and accessible.
2. Put the user first in every workflow.
3. Use tokens from the shared design system.
4. Strive for delightful craft and smooth motion.
`;

export function auditPrinciplesDoc(markdownText) {
  const missingRules = FIVE_UNWRITTEN_AGENTIC_RULES.filter((r) => !r.checkRe.test(markdownText)).map((r) => r.id);
  const tensionsWithExplicitDecider = EIGHT_TENSIONS.filter((t) =>
    markdownText.toLowerCase().includes(t.decidingFactor.split(":")[0].toLowerCase())
  ).map((t) => t.id);
  return {
    unwrittenAgenticRulesCovered: FIVE_UNWRITTEN_AGENTIC_RULES.length - missingRules.length,
    unwrittenAgenticRulesTotal: FIVE_UNWRITTEN_AGENTIC_RULES.length,
    missingRuleIds: missingRules,
    tensionsResolvedByCondition: tensionsWithExplicitDecider.length,
    tensionsTotal: EIGHT_TENSIONS.length,
  };
}

const fullDoc = [
  SAMPLE_CONVENTIONAL_DOC,
  ...EIGHT_TENSIONS.map((t) => `- ${t.decidingFactor}`),
  ...FIVE_UNWRITTEN_AGENTIC_RULES.map((u) => `- ${u.prompt}`),
].join("\n");

const results = {
  generatedAt: "2026-11-15T12:30:00Z",
  conventionalDesignDocAudit: auditPrinciplesDoc(SAMPLE_CONVENTIONAL_DOC),
  upgradedAgenticCanonAudit: auditPrinciplesDoc(fullDoc),
  eightTensions: EIGHT_TENSIONS,
  fiveUnwrittenRules: FIVE_UNWRITTEN_AGENTIC_RULES.map(({ id, name, prompt }) => ({ id, name, prompt })),
};

const cliFile = process.argv[2];
if (cliFile && fs.existsSync(cliFile)) {
  console.log(JSON.stringify(auditPrinciplesDoc(fs.readFileSync(cliFile, "utf8")), null, 2));
} else {
  fs.writeFileSync(path.join(HERE, "results-2026-11-15.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify({
    conventionalCovered: results.conventionalDesignDocAudit.unwrittenAgenticRulesCovered,
    upgradedCovered: results.upgradedAgenticCanonAudit.unwrittenAgenticRulesCovered,
    tensionsCount: EIGHT_TENSIONS.length,
  }));
}
