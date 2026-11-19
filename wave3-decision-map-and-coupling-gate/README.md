# Wave-3 Pack — Lockable Decision Maps & Anti-Authority-Laundering Gate (`wave3-decision-map-and-coupling-gate`)

Decision-lock contract verifier and UX-research provenance linter behind **Stop reading 10-page prose plans: lockable decision maps and empirical coupling in agentic UX**.

## What it tests & proves
1. **Human-only plan locking:** Refuses locking an architecture plan while any irreversible choice lacks a recommended default or explicit human selection, minting a SHA-256 contract hash once locked.
2. **Blocking "authority laundering" in UX research (`--audit-uxr`):** Catches synthetic persona outputs dressed up as attributed human interview quotes (`"..." — P12, 38`), enforcing a hard visual boundary between zero-prior clarity crash-tests and recorded human evidence.

## Quick start
```bash
node run.mjs
node run.mjs --audit-uxr path/to/uxr-report.md
```

## Scope & limits
Lexical provenance linting stops accidental authority laundering in decks and PRDs; teams still need held-out real participant sessions to measure behavioural outcomes.
