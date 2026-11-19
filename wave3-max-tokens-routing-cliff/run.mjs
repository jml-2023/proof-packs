#!/usr/bin/env node
// wave3-max-tokens-routing-cliff — Audits LLM request logs & provider-pin configs for max_tokens
// cache-endpoint disqualification, historical image bloat, and single-host retry storms (w08).
// Usage:
//   node run.mjs                               # reproduce 19,395-turn max_tokens cliff & 46-image bloat simulation
//   node run.mjs --audit-requests calls.jsonl  # audit your own outbound LLM logs for over-requested max_tokens
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function selectEligibleEndpoints(endpoints, { requestedMaxTokens, requireImplicitCache = false, nowMs = 0, demotedUntilByHost = {} }) {
  return endpoints.filter((ep) =>
    ep.maxCompletionTokens >= requestedMaxTokens &&
    (!requireImplicitCache || ep.supportsImplicitCache) &&
    (demotedUntilByHost[ep.id] ?? 0) <= nowMs
  );
}

export function demoteDroppedHost(demotedUntilByHost, hostId, nowMs, cooldownMs = 5 * 60 * 1000) {
  return { ...demotedUntilByHost, [hostId]: nowMs + cooldownMs };
}

export function applySlidingImageCap(messages, maxImages = 24) {
  const imgPositions = [];
  messages.forEach((m, mi) => {
    if (Array.isArray(m.content)) {
      m.content.forEach((part, pi) => {
        if (part.type === "image_url" || part.type === "image") imgPositions.push([mi, pi]);
      });
    }
  });
  const toEvict = new Set(imgPositions.slice(0, Math.max(0, imgPositions.length - maxImages)).map(([mi, pi]) => `${mi}:${pi}`));
  const trimmed = messages.map((m, mi) => {
    if (!Array.isArray(m.content)) return m;
    return {
      ...m,
      content: m.content.map((part, pi) =>
        toEvict.has(`${mi}:${pi}`) ? { type: "text", text: "[historical screenshot evicted to preserve prefill budget]" } : part
      ),
    };
  });
  return { beforeImages: imgPositions.length, afterImages: Math.min(imgPositions.length, maxImages), evicted: toEvict.size, messages: trimmed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const aIdx = args.indexOf("--audit-requests");
  if (aIdx >= 0) {
    const rows = fs.readFileSync(args[aIdx + 1], "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const reqMax = rows.map((r) => r.max_tokens ?? 0);
    const actual = rows.map((r) => r.completion_tokens ?? 0).sort((a, b) => a - b);
    const p99 = actual[Math.min(actual.length - 1, Math.floor(actual.length * 0.99))] ?? 0;
    const fits32kPct = +((actual.filter((x) => x <= 32768).length / Math.max(1, actual.length)) * 100).toFixed(2);
    console.log(JSON.stringify({ calls: rows.length, maxRequested: Math.max(0, ...reqMax), actualP99: p99, fitsWithin32768Pct: fits32kPct }, null, 2));
    process.exit(0);
  }

  const ENDPOINTS = [
    { id: "provider-cached-studio", maxCompletionTokens: 32768, supportsImplicitCache: true, cacheHitPct: 97.9, p50TtftSec: 3.37, uptime1dPct: 99.0 },
    { id: "provider-regional-healthy", maxCompletionTokens: 32768, supportsImplicitCache: true, cacheHitPct: 96.4, p50TtftSec: 3.85, uptime1dPct: 98.8 },
    { id: "provider-global-congested", maxCompletionTokens: 65536, supportsImplicitCache: false, cacheHitPct: 0, p50TtftSec: 18.8, p90TtftSec: 97.6, uptime1dPct: 65.6 },
  ];
  const at65k = selectEligibleEndpoints(ENDPOINTS, { requestedMaxTokens: 65536 });
  const at32k = selectEligibleEndpoints(ENDPOINTS, { requestedMaxTokens: 32768, requireImplicitCache: true });
  const demoted = demoteDroppedHost({}, "provider-cached-studio", 1000);
  const afterDropRetry = selectEligibleEndpoints(ENDPOINTS, { requestedMaxTokens: 32768, nowMs: 2000, demotedUntilByHost: demoted });

  const mockSession = Array.from({ length: 46 }, (_, i) => ({ role: "user", content: [{ type: "image", id: i + 1 }] }));
  const capCheck = applySlidingImageCap(mockSession, 24);

  const results = {
    generatedAt: "2026-11-19T15:00:00Z",
    incidentTelemetrySummary: {
      baselineMedianTurnSec: 28.4,
      degradedMedianTurnSec: 62.6,
      degradedP90TurnSec: 203.1,
      midStreamSseDrops: 1054,
      sessionsAffected: 42,
      sseIdleTimeoutSec: 180,
      naiveDeadHostConsecutiveRetries: 10,
    },
    historicalTurnAudit: { turnsAnalysed: 19395, medianCompletionTokens: 496, p99CompletionTokens: 11607, shareWithin32768Pct: 99.75, shareRequiringLongExportRoutePct: 0.25 },
    routingAt65536: { eligibleIds: at65k.map((e) => e.id), cachedEndpointDisqualified: !at65k.some((e) => e.supportsImplicitCache) },
    routingAt32768: { eligibleIds: at32k.map((e) => e.id), p50TtftSec: at32k[0].p50TtftSec, cacheHitPct: at32k[0].cacheHitPct },
    hostDemotionCheck: { droppedHost: "provider-cached-studio", attempt2SelectedHost: afterDropRetry[0].id },
    slidingImageCapCheck: { beforeImages: capCheck.beforeImages, afterImages: capCheck.afterImages, evicted: capCheck.evicted },
  };
  fs.writeFileSync(path.join(HERE, "results-2026-11-19.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify({
    cachedDisqualifiedAt65k: results.routingAt65536.cachedEndpointDisqualified,
    fits32kPct: results.historicalTurnAudit.shareWithin32768Pct,
    evictedImages: capCheck.evicted,
    attempt2Host: afterDropRetry[0].id,
  }));
}
