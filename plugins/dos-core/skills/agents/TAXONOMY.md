# Agents Pack — Entity Taxonomy

**Canonical reference for the six distinct "agent" entity types in DOS.**
**Published:** 2026-04-22 (RFC-0016 Phase 0)
**Scope:** Routing — when to use each agent type.

---

## The Six Entity Types

| # | Name | Home | Invocation | Lifecycle | Status |
|---|---|---|---|---|---|
| 1 | **Claude Code `subagent_type` registry** | `~/.claude/agents/*.md` | `Agent({subagent_type: "engineer"})` | Persistent, system-registered | ✅ Authoritative |
| 2 | **Composed dynamic agents** | Rendered at call time from `Data/Traits.yaml` via `Tools/ComposeAgent.ts` + `Templates/DynamicAgent.hbs` | `Agent({subagent_type: "general-purpose", prompt: composed})` | Ephemeral — one response, dies | ✅ Live |
| 3 | **Saved custom agents** | `~/.claude/custom-agents/*.md` | `ComposeAgent --save / --load / --delete` | Designed-persistent | ✅ Live (RFC-0016 Phase 1) |
| 4 | **Profile-context agents (v2)** | ~~`*Context.md` + `LoadAgentContext.ts` + `SpawnAgentWithProfile.ts`~~ | — | — | ❌ Retired 2026-04-22 (RFC-0016 Phase 0) |
| 5 | **Named character archive** | `ARCHIVE/AgentPersonalities.md` | Historical reference only | N/A | 🗄️ Archived 2026-04-22 |
| 6 | **Executable TypeScript agent packs** | `Packs/agents/{DailyBrief,IncidentResponder,PalaceMaintenance,WeeklyDigest}/` + `_runtime/gateway-client.ts` | `bun Packs/agents/{Pack}/src/index.ts` | Scheduled cron jobs | ✅ Live — separate pattern |

---

## Routing — when to use each

### Type 1 — Claude Code subagent_types (`~/.claude/agents/*.md`)

Use when you want a **persistent, named agent** invocable from anywhere by `subagent_type`. These are first-class Claude Code citizens with full frontmatter schema support (`name`, `description`, `tools`, `disallowedTools`, `model`, `color`, `isolation`, `background`, etc.).

**Invocation:**
```typescript
Agent({ subagent_type: "engineer", prompt: "Implement the widget" })
```

**Hot-reload:** not supported. Adding a new file requires `/agents` slash command (in-session reload) or `claude` restart. See `Docs/Research/composed-agent-gateway-routing.md` for the feasibility-research context.

### Type 2 — Composed dynamic agents

Use when you want a **task-specific specialist** composed on-the-fly from traits. Ephemeral by design — each composition produces a fresh prompt, fresh voice, fresh color.

**Invocation:**
```bash
# Compose
bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts \
  --traits "security,skeptical,thorough" \
  --task "Review this auth flow" \
  --output json

# Then pass composed prompt to Agent tool
Agent({ subagent_type: "general-purpose", prompt: composed.prompt })
```

Use the CreateCustomAgent or SpawnParallelAgents workflow in `Workflows/` for orchestration patterns.

### Type 3 — Saved custom agents (`~/.claude/custom-agents/*.md`)

Use when a **composed agent has proven its value** and you want to reuse it without recomposing from traits every time.

**Invocation:**
```bash
bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts \
  --traits "security,skeptical,thorough" --task "Audit" --save
# → writes ~/.claude/custom-agents/security-skeptical-thorough.md

bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts \
  --load "security-skeptical-thorough" --task "Different audit"
# → returns the stored prompt, re-templated with new task
```

Saved custom agents are **NOT** the same as Claude Code subagent_types — they're Type-2 agents with persistence. For promotion to a real subagent_type (Type 1), see **future RFC-0018 `--promote` bridge** (stubbed below).

### Type 4 — Profile-context agents (RETIRED)

The v2 profile-context subsystem (`*Context.md` files + `LoadAgentContext.ts` + `SpawnAgentWithProfile.ts`) was retired by RFC-0016 Phase 0 (2026-04-22) after a grep audit confirmed zero external callers. Do not reintroduce this pattern.

### Type 5 — Named character archive

`ARCHIVE/AgentPersonalities.md` retains the character backstories of 12 named agents (Jamie, Rook, Priya, Aditi, Ava Chen, Ava Sterling, Alex Rivera, Zoe, Marcus, Serena, Emma, Vera). These characters migrated to `~/.claude/agents/*.md` as Type-1 entities on 2026-02-12. The archived file is historical reference only — no runtime role.

### Type 6 — Executable TypeScript agent packs

**Out of scope for this pack.** `Packs/agents/{DailyBrief,IncidentResponder,PalaceMaintenance,WeeklyDigest}/` are standalone Bun executables that route inference through Studio Gateway (`_runtime/gateway-client.ts`) with Anthropic advisor support. They share the `Packs/agents/` directory name but are structurally different from Types 1-3.

**Invocation:**
```bash
bun Packs/agents/DailyBrief/src/index.ts
```

---

## Voice rule (RFC-0016 Phase 1, Option B)

**Composed agents do NOT voice.** The main DA voices on their behalf using the agent's `voice_id` + `voice_settings`. This resolves the contradiction between `DOS/Algorithm/v0.0.1.md` §35 ("subagents must NEVER make voice curl calls") and the pre-RFC-0016 Hbs template.

The voice machinery (`voice_id`, `voice_settings`, trait-based voice mapping, 15-color palette) remains useful — it's consumed by the parent, not by the subagent.

---

## `--promote` interface contract (STUB — future RFC-0018)

Reserved to prevent current work from painting into a corner. When RFC-0018 lands, `ComposeAgent --promote {slug}` will take a Type-3 saved custom agent and emit a Type-1 Claude Code subagent_type file.

### Durable lane (default)

Reads `~/.claude/custom-agents/{slug}.md` → writes `~/.claude/agents/{name}.md` with Claude Code-canonical frontmatter:

```yaml
---
# Required (Claude Code schema)
name: {name}                    # lowercase-hyphens; enforced by --promote
description: {from composition} # derived from expertise × personality × approach
model: {from effort tier}       # sonnet/opus/haiku/inherit

# Optional (Claude Code schema)
tools: Read, Grep, Glob, Bash   # comma-separated string
color: {named from palette}     # red/blue/green/yellow/purple/orange/pink/cyan
isolation: worktree             # if trait combo benefits from isolation

# DOS metadata (parser-ignores unknown fields)
voiceId: {agent.voiceId}
voice:                          # prosody block for DOS voice tooling
  stability: 0.65
  similarity_boost: 0.75
  style: 0.05
  speed: 0.95
  use_speaker_boost: true
color_hex: "#2ECC71"            # retained for DOS terminal rendering
traits: [technical, analytical, thorough]
custom_agent: true
source: ComposeAgent
created: "2026-04-22"
---

You are {name}, a specialist with:
- Technical Specialist — [description from Traits.yaml]
- Analytical — [prompt_fragment from Traits.yaml]
- Thorough — [prompt_fragment from Traits.yaml]

[Operational guidelines, output format, etc.]
```

**Activation:** user runs `/agents` in-session OR restarts `claude`. Neither is automatic; `--promote` emits the operator instruction.

### Ephemeral lane (`--ephemeral`)

Emits a JSON blob compatible with `claude --agents '{...}'` and optionally re-execs a fresh session with the agent injected. Never written to disk.

### Required companions (RFC-0018 acceptance criteria)

- `--demote {slug}` — inverse operation, removes `~/.claude/agents/{name}.md`, restores origin in `~/.claude/custom-agents/` if not present.
- **Observability gate** — a composed agent must have emitted artifacts (RFC-0017) over N≥3 sessions before `--promote` allows graduation. Prevents silent promotion of bypass configurations.

---

## References

- **RFC-0016** (`Plans/Specs/RFC-0016-agents-pack-unification.md`) — taxonomy cleanup + broken-feature repair that produced this document
- **RFC-0017** (pending) — composed-agent adapter integration (`artifacts.jsonl`, MemPalace KG, lineage)
- **RFC-0018** (pending) — the `--promote` bridge (this file stubs the contract)
- **Docs/Research/composed-agent-gateway-routing.md** — feasibility research for gateway routing (retired RFC-0019 slot)
- **`DOS/Algorithm/v0.0.1.md`** §35 — voice rule (subagents do not voice; main DA voices on their behalf per RFC-0016 Phase 1)
