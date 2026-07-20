---
name: PromoteAgent
description: Promote a proven composed agent into a first-class Specialist (the RFC-0018 maturity-ladder escalator) — gated on N sessions of real use, demote/ephemeral too
bestPath:
  - title: "Earn It"
    description: "Confirm the composition is already a saved/Named agent used across multiple sessions."
  - title: "Check the Gate First"
    description: "Run --promote <slug> --dry-run and read each sub-gate's pass/fail evidence."
  - title: "Promote"
    description: "On a passing gate, write the Specialist file with --scope and --tools."
  - title: "Demote / Ephemeral"
    description: "Retire a Specialist back to Composed, or use a one-off composition without persisting."
---

# PromoteAgent Workflow

## When to Use

- User asks "is this agent ready to promote?" or "can X earn a seat?" — always dry-run the gate first
- User says "promote X to a specialist", "demote X" / "retire this specialist", or wants a one-off composition that shouldn't persist
- NOT for composing or saving an agent in the first place — use CreateCustomAgent; this workflow only handles the gated escalation of an already-saved composition

The **Composed → Specialist** edge of the Three-Class maturity ladder (RFC-0018). A composed
agent that has earned its keep across real use is **promoted** into a permanent Specialist file
(`~/.claude/agents/<Name>.md`) the Algorithm fan-out and Council seats can reuse by name — "earn
a permanent seat." Promotion is a near-irreversible mutation (it writes a specialist file and, on
force, a SECURITY audit row), so this workflow **leads with the gate, never the bypass.**

This workflow surfaces the already-shipped engine (`Tools/promotion/` — `gate.ts` / `lifecycle.ts`).
It adds NO new flags; it guides the operator through a multi-step, consequential decision the bare
CLI does not.

## Intent-to-Flag Mapping

| User Says | Tool | Flag | When to Use |
|-----------|------|------|-------------|
| "is this agent ready to promote?" / "can X earn a seat?" | ComposeAgent.ts | `--promote <slug> --dry-run` | Check the gate WITHOUT mutating — always run this first |
| "promote X to a specialist" | ComposeAgent.ts | `--promote <slug> --scope <user\|project> --tools <allowlist>` | Promote a gate-passing composition into `~/.claude/agents/<Name>.md` |
| "demote X" / "retire this specialist" | ComposeAgent.ts | `--demote <slug>` | Specialist → Composed (the reverse edge) |
| "one-off, don't persist" | ComposeAgent.ts | `--ephemeral` | Use without entering the ladder |
| "promote anyway / override the gate" | ComposeAgent.ts | `--force-promote <slug>` | **Audited exception only** — writes a SECURITY audit row |

## Procedure

### Step 1 — Earn it (the ladder on-ramp)

Promotion is not a CRUD verb — it is the payoff of repeated, proven use. Before promoting, the
composition should already be a saved/Named agent (`CreateCustomAgent` → `--save`) that has been
**actually used across multiple distinct sessions**. The gate measures this; you cannot shortcut it.

### Step 2 — Check the gate FIRST (`--dry-run`)

```bash
bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts --promote <slug> --dry-run
```

The empirical gate (`Tools/promotion/gate.ts`) passes only when the composition has been used across
**N distinct sessions** (default 3) **within a freshness window** (default 90 days), with optional
**day-spread** and **persisted-ratio** sub-gates. The dry-run reports each sub-gate's pass/fail and
the evidence — read it; do not promote a composition the gate rejects.

### Step 3 — Promote (only on a passing gate)

```bash
bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts --promote <slug> \
  --scope user \              # user (~/.claude/agents/) or project
  --tools "Read,Edit,Bash"    # the specialist's tool allowlist
```

This writes `~/.claude/agents/<Name>.md` (a first-class Specialist with its own voice prosody,
allowlist, and identity). It is now invocable by name via `Task(subagent_type="<Name>")` and
reusable as a Council specialist seat.

### Step 4 — Demote / ephemeral (the other edges)

- **Demote** (`--demote <slug>`): retire a Specialist back to a Composed agent when it has stopped
  earning its seat — the ladder runs both directions.
- **Ephemeral** (`--ephemeral`): use a composition once without it entering the ladder at all.

## Force-promote is an AUDITED exception — never the default

`--force-promote` bypasses the gate. It is for the rare, justified case (e.g. a known-good
composition on a fresh host with no session history yet) and it **writes a SECURITY audit row**
(`writePromotionOverrideAudit`). Lead with the gate; reach for force only with a recorded reason,
and expect the audit trail.

## Failure modes

- Gate fails → do NOT promote; surface the failing sub-gate(s) + the evidence; keep using the
  composition until it earns the seat (re-run the dry-run later).
- Unknown slug → surface the error; the slug must be a saved/Named composition.

## Related

- **`CreateCustomAgent.md`** — composes + `--save`s the agent (the Composed → Named edge; the on-ramp here).
- **Three-Class maturity ladder** (SKILL.md) — this workflow is the gated Composed → Specialist escalator.
- **`Tools/compose/help.txt`** — the ComposeAgent CLI contract (flag reference; do not re-list flags here).
