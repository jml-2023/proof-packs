# Wave-3 Pack — The `max_tokens` Routing Cliff & Retry-Storm Guard (`wave3-max-tokens-routing-cliff`)

Provider-endpoint eligibility simulator and sliding screenshot-window trimmer behind **Same model name, 2.2× slower: how `max_tokens` and single-host pins silently kill prompt caching**.

## What it tests & proves
1. **Why `max_tokens: 65536` silently disqualifies cached endpoints:** Even when `99.75%` of `19,395` turns emit `<=32,768` tokens (median `496`, `p99` `11,607`), requesting `65,536` forces routers past healthy `32,768`-cap endpoints with `97.9%` prompt caching (`3.37 s` TTFT) onto congested `65k` hosts (`97.6 s` `p90` TTFT).
2. **Sliding screenshot budget (`MAX_IMAGES = 24`):** Replaces older screenshots with deterministic text placeholders so 200-turn UI sessions never resend `46+` uncompressed images on every uncached prefill.

## Quick start
```bash
node run.mjs
node run.mjs --audit-requests path/to/requests.jsonl
```

## Scope & limits
Models OpenRouter-style capability filtering across multi-endpoint model IDs; provider completion limits change over time and should be polled daily.
