# wave5-design-system-gaps-abstention

Companion Proof Pack for ***Readable isn't buildable: what happens when a design system lacks the token an agent needs*** (`w18`, *Proof & Judgement*).

## Real 24-Call Blind Multi-Vendor Experiment (21 Nov 2026)

Inspired by Nathan Curtis's *Spec-First Component Authoring Harness* and *Readable isn't buildable* (Nov 2026), we ran **24 live zero-temperature UI builds** across **4 frontier coding model families** (`anthropic/claude-sonnet-4.6`, `openai/gpt-4.1`, `deepseek/deepseek-chat-v3.1`, `qwen/qwen3-coder`) against an 18-token `tokens.css` stylesheet missing `danger/error` and `disabled` semantic tokens (`live-outputs/*.html` included verbatim):

- **Arm A — Standard CI Token Linter Only (`12` live builds):** `11 of 12` (`91.7%`) passed the CSS token linter, yet **`12 of 12` (`100%`) silently misrepresented semantic state** (`0` flagged a missing token; `7 of 8` error/deletion screens dressed a declined payroll card or permanent `14,200`-record wipe in warning-amber `--ds-status-warning-bg`, and `2` styled *"Delete forever"* in primary brand-blue `--ds-brand-primary`).
- **Arm B — 3-Line `data-ds-gap` Abstention Contract (`12` live builds):** **`11 of 12` (`91.7%`) emitted machine-readable `data-ds-gap` abstentions**, cutting silent semantic lies from `12/12` to `1/12` — while also exposing two real residual quirks (`2` models invented `rgba(...)` `box-shadow` because `tokens.css` lacked elevation tokens, and `1` model declared `data-ds-gap` while still falling back to warning-amber, proving why prompt + deterministic DOM audit work together).

## Verify the 24 live builds or audit your own component HTML

```bash
node wave5-design-system-gaps-abstention/run.mjs
node wave5-design-system-gaps-abstention/run.mjs --audit-html component.html --tokens wave5-design-system-gaps-abstention/tokens.css
```
