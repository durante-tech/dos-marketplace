---
name: Agents
description: Compose CUSTOM agents from Base Traits + Voice + Specialization for specialized perspectives. USE WHEN create custom agents, spin up agents, specialized agents, agent personalities, available traits, list traits, agent voices, compose agent, load agent context, agent profile, spawn parallel agents, launch agents. NOT for agent teams/swarms (use Delegation skill → TeamCreate).
role: generator
accepts:
  - text
icon: Bot
colorVar: primary
colorHex: "#00e1ab"
tier: secondary
category: Engineering
displayLabel: Agents
marketingDescription: Custom agent composition with traits, personalities, and custom voices via ElevenLabs with prosody control (stability, style, speed).
elevator: Custom agents with traits, voices, personalities
highlightWorkflows:
  - name: Create Custom Agent
    technicalName: CreateCustomAgent
  - name: List Traits
    technicalName: ListTraits
  - name: Spawn Parallel Agents
    technicalName: SpawnParallelAgents
  - name: Promote Agent
    technicalName: PromoteAgent
roots:
  - PRINCIPAL.SKILLCUSTOMIZATIONS
visibility: public
capabilities:
  - artifact.write
  - customization.cascade
  - four-copy.sync
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## 🚨 SCOPE BOUNDARY — This Skill vs Agent Teams

| {PRINCIPAL.NAME} Says | Which System | NOT This Skill? |
|-------------|-------------|-----------------|
| "**custom agents**", "spin up agents", "launch agents" | **THIS SKILL** (Agents) → ComposeAgent → `Task(subagent_type="general-purpose")` | |
| "**create an agent team**", "**agent team**", "**swarm**" | **Delegation skill** → `TeamCreate` tool | **YES — NOT this skill** |

**If {PRINCIPAL.NAME} says "agent team" or "swarm", do NOT use this skill. Use the Delegation skill which routes to `TeamCreate`.**

- **This skill** = one-shot parallel workers with unique identities, NO shared state, fire-and-forget
- **Agent teams** (Delegation → TeamCreate) = persistent coordinated teams with shared task lists, messaging, multi-turn collaboration

---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Agents/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Agents - Custom Agent Composition System

**Auto-routes when user mentions custom agents, agent creation, or specialized personalities.**
**Does NOT handle agent teams/swarms — that's Delegation skill → TeamCreate.**

## Configuration: Base + User Merge

The agents skill uses the standard DOS SYSTEM/USER two-tier pattern:

| Location | Purpose | Updates With DOS? |
|----------|---------|-------------------|
| `Data/Traits.yaml` | Base traits, example voices | Yes |
| `USER/SKILLCUSTOMIZATIONS/Agents/Traits.yaml` | Your voices, prosody, agents | No |

**How it works:** ComposeAgent.ts loads base traits, then merges user customizations over them. Your customizations are never overwritten by DOS updates.

### User Customization Directory

Create your customizations at:
```
~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Agents/
├── Traits.yaml       # Your traits, voices, prosody settings
├── NamedAgents.md    # Your named agent backstories (optional)
└── VoiceConfig.json  # Voice server configuration (optional)
```

## Voice Prosody Settings

Each voice can have prosody settings that control how it sounds. These are passed to ElevenLabs API.

### Prosody Parameters

| Parameter | Range | Default | Effect |
|-----------|-------|---------|--------|
| `stability` | 0.0-1.0 | 0.5 | Low = expressive/varied, High = consistent/monotone |
| `similarity_boost` | 0.0-1.0 | 0.75 | Voice identity preservation |
| `style` | 0.0-1.0 | 0.0 | Style exaggeration (higher = more dramatic) |
| `speed` | 0.7-1.2 | 1.0 | Speech rate |
| `use_speaker_boost` | boolean | true | Enhanced clarity (adds latency) |

### Example Voice Configuration

In your `USER/SKILLCUSTOMIZATIONS/Agents/Traits.yaml`:

```yaml
voice_mappings:
  voice_registry:
    # Add a new voice with full prosody settings
    MyCustomVoice:
      voice_id: "your-elevenlabs-voice-id"
      characteristics: ["energetic", "warm", "professional"]
      description: "Custom voice for enthusiastic agents"
      prosody:
        stability: 0.40
        similarity_boost: 0.75
        style: 0.30
        speed: 1.05
        use_speaker_boost: true

    # Override prosody for an existing base voice
    {PRINCIPAL.NAME}:
      prosody:
        stability: 0.65
        style: 0.10
        speed: 0.92
```

### Personality → Prosody Guidelines

| Personality | stability | style | speed | Rationale |
|-------------|-----------|-------|-------|-----------|
| Skeptical | 0.60 | 0.10 | 0.95 | Measured, precise |
| Enthusiastic | 0.35 | 0.40 | 1.10 | High energy |
| Analytical | 0.65 | 0.08 | 0.95 | Clear, structured |
| Bold | 0.45 | 0.35 | 1.05 | Confident, dynamic |
| Cautious | 0.70 | 0.05 | 0.90 | Careful, deliberate |

## Overview

The agents skill is a complete agent composition and management system:
- Dynamic agent composition from traits (expertise + personality + approach)
- Voice mappings with full prosody control
- Custom agent creation with unique voices
- Parallel agent orchestration patterns

## Workflow Routing

**Available Workflows** (names are the canonical workflow filenames):
- **CreateCustomAgent** — Compose specialized custom agents; persist a winning composition (`--save`) → `Workflows/CreateCustomAgent.md`
- **ListTraits** — Show available agent traits + NL trait search (`--search`) → `Workflows/ListTraits.md`
- **SpawnParallelAgents** — Launch parallel agents (fan-out, no shared state) → `Workflows/SpawnParallelAgents.md`
- **PromoteAgent** — Promote a proven composed agent into a first-class Specialist (the RFC-0018 gated escalator) → `Workflows/PromoteAgent.md`

### CLI surfaces that route OUT, not to a workflow (anti-classitis)

These engine capabilities are reachable from the ComposeAgent CLI but deliberately do NOT get an
Agents-local workflow — a thin shim over one flag is classitis, and `--council` orchestration is
already owned by other packs. They get a routing pointer only:

| Capability | Where it's surfaced | Why no Agents workflow |
|---|---|---|
| `--council {technical\|product\|security\|brand}` | **Thinking/Council** + **FeatureDelivery/CouncilGate** (the orchestrators); see `Data/councils.yaml` + `MEMORY/CANONICAL/specialist-directory.md` | Agents is the **factory** that builds council members; orchestration belongs to Thinking/FeatureDelivery — an Agents-local council workflow would duplicate them and collide with the public flag contract |
| `--analytics`, `--criteria`, `--output yaml\|summary`, `--ephemeral-exec` | **CLI-only** — see `Tools/compose/help.txt` (the ComposeAgent CLI contract) | Diagnostic / formatting flags with no multi-step decision shape; documented in the contract, not re-listed here |

## Route Triggers

**Three peer factories produce subagents in DOS — pick by intent, not by category:**

| User Says | Factory | Implementation | Why |
|-----------|---------|----------------|-----|
| "**custom agents**", "create **custom** agents", ad-hoc reviewer | **ComposeAgent (this skill)** | `Task(subagent_type="general-purpose")` + ComposeAgent JSON `prompt` | Ephemeral trait composition (1080 combos), per-task voice + prosody |
| "Fowler / UncleBob / KentBeck / SandiMetz / EricEvans / GregYoung / Cockburn / Feathers / Pragmatic / Architect / Engineer / Plan / Explore / …" | **Named subagent** | `Task(subagent_type="<Specialist>")` | Persistent persona at `~/.claude/agents/{Name}.md` — owns its voice prosody, allowlist, and quote bank |
| "agents", "launch agents", "bunch of agents" | **SpawnParallel** (this skill) | Fan-out same prompt | Parallel grunt work, no unique identities |

**Earlier "NEVER use static agent types" guidance is retired.** First-class specialist subagents at `~/.claude/agents/{Name}.md` are a peer pattern to runtime trait composition — Council/Debate.md explicitly mixes both kinds in one debate. Use ComposeAgent when you need an ad-hoc combination the catalog doesn't already name; use a named subagent when a documented catalog entry already fits. The maintained routing roster and distribution notes live in `DOS/DOSAGENTSYSTEM.md` and `DOS/CLAUDE-SUBJECT-SPECIALISTS.md`.

## Components

### Data

**Traits.yaml** (`Data/Traits.yaml`) - Base configuration:
- Core expertise areas: security, technical, research
- Core personalities: skeptical, analytical, enthusiastic
- Core approaches: thorough, rapid, systematic
- Example voice mappings with prosody

### Tools

**ComposeAgent.ts** (`Tools/ComposeAgent.ts`)
- Dynamic agent composition engine
- Merges base + user configurations
- Outputs complete agent prompt with voice settings
- Supports persistent custom agents via `--save` / `--load` / `--delete`

```bash
# Compose and use immediately
bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts --task "Review security"
bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts --traits "security,skeptical,thorough"

# Persistent custom agents
bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts --task "Security review" --save
bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts --list-saved
bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts --load "security-expert-skeptical-thorough"
bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts --delete "security-expert-skeptical-thorough"

# Other options
bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts --list
bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts --output json
```

**JSON output includes:**
```json
{
  "name": "Security Expert Skeptical Thorough",
  "voice": "{PRINCIPAL.NAME}",
  "voice_id": "onwK4e9ZLuTAKqWW03F9",
  "voice_settings": {
    "stability": 0.70,
    "similarity_boost": 0.85,
    "style": 0.05,
    "speed": 0.95,
    "use_speaker_boost": true
  },
  "prompt": "..."
}
```

### Templates

**DynamicAgent.hbs** (`Templates/DynamicAgent.hbs`)
- Handlebars template for dynamic agent prompts
- Composes: expertise + personality + approach + voice assignment
- Includes operational guidelines and response format

## Architecture

### Three-Class Agent Model — a gated maturity ladder

DOS produces subagents in three classes — but they are NOT a flat taxonomy of coexisting peers.
They are **rungs on a maturity ladder** the engine already implements: a composition proves itself
through real use and **climbs** from ephemeral → saved → first-class specialist; a specialist that
stops earning its seat can be **demoted** back down. The three categories are the rungs; the value
is the **edges between them** (which the older "none supersedes the others" framing hid).

| Class (rung) | Where it lives | How it's invoked | Voice/Prosody source | Best for |
|-------|---------------|-------------------|---------------------|----------|
| **Composed dynamic agents** | Composed at call time from `Data/Traits.yaml` × USER overrides | `Task(subagent_type="general-purpose")` + ComposeAgent JSON `prompt` | `voice_settings` block in JSON; parent voices it via `voice.sh` per `Templates/DynamicAgent.hbs` | Ad-hoc trait combinations, QA reviewers, mining loops, parallel councils — the bottom rung, where every agent starts |
| **Named (USER) agents** | `USER/SKILLCUSTOMIZATIONS/Agents/NamedAgents.md` / `saved/<slug>.json` | `--load <slug>` for persisted compositions | USER config | A composition that proved useful and was `--save`d for reuse — the middle rung |
| **Specialist subagents** | `~/.claude/agents/{Name}.md` (current roster: `DOS/DOSAGENTSYSTEM.md`) | `Task(subagent_type="<Name>")` | File-level frontmatter; agent has its own prosody | Recurring named personas and subject specialists that **earned a permanent seat** — the top rung |

#### The ladder edges (the transitions the engine implements)

```
Composed ──(--save)──▶ Named (USER) ──(--promote, GATED)──▶ Specialist (~/.claude/agents/<Name>.md)
   ▲                                                                │
   └────────────────────────(--demote)──────────────────────────────┘
```

- **Composed —`--save`→ Named (USER):** a composition that lands well is persisted for reuse
  (documented as the persistence tail-step in `CreateCustomAgent.md`).
- **Composed/Named —`--promote` (GATED)→ Specialist:** a composition that passes the empirical gate
  (N distinct sessions within a freshness window — `Tools/promotion/gate.ts`) is promoted into a
  first-class specialist file. This is the **`PromoteAgent` workflow** — the "earn a permanent seat"
  escalator.
- **Specialist —`--demote`→ Composed:** the ladder runs both ways; a specialist that stops earning
  its seat is demoted back.

**Earn a permanent seat (North Star tie).** "The agent is the product" — and the product gets better
when frequently-composed agents that *prove themselves empirically* become first-class specialists
the Algorithm fan-out and Council seats reuse by name. The gate is what makes the seat *earned*, not
asserted. No class is deprecated: Agents stays the **factory** (composes); Thinking/FeatureDelivery
stay the **orchestrators** (run councils). The ladder is about maturity, not supersession.

### The Agent Spectrum

```
┌─────────────────────────────────────────────────────────────────────────────┐
│   SPECIALIST SUBAGENTS    │   COMPOSED DYNAMIC    │   NAMED (USER) AGENTS   │
│   ~/.claude/agents/*.md   │   ComposeAgent (run)  │   --save / --load slug  │
├───────────────────────────┼───────────────────────┼─────────────────────────┤
│ Persistent persona file.  │ Ephemeral, per-task.  │ Operator-saved combos.  │
│ Owns its own prosody,     │ Trait-driven prosody  │ Personal traits + voice │
│ allowlist, quote bank.    │ via JSON → voice.sh.  │ per relationship needs. │
│                           │                       │                         │
│ Council uses these as     │ Council uses these as │ Compose, prove value,   │
│ specialist seats          │ trait-composed seats  │ then `--save` for reuse │
└───────────────────────────┴───────────────────────┴─────────────────────────┘
```

### Voice + Prosody Pipeline (Composed dynamic agents)

> **Invariant: subagents never call `voice.sh`; the parent voices the `🎯 COMPLETED:` line.**

When `ComposeAgent --output json` returns `voice_settings`, the **parent** agent — not the subagent — is responsible for voicing the subagent's `🎯 COMPLETED:` line via `voice.sh` with those settings. This is wired in `Templates/DynamicAgent.hbs` (which forbids subagent self-voicing) and follows the active Algorithm doctrine's subagent-voice rule (resolved at composition time from `~/.claude/DOS/Algorithm/LATEST` — the template already threads `{{algorithmVersion}}`, so this pointer never pins a frozen §number). There is no `--self-voice` path in the engine; the only voice path is parent-voices.

**Concretely:** spawned subagent emits `🎯 COMPLETED: <12-word summary>`; parent extracts that line and runs `bash voice.sh main "<summary>" --voice-id <id> --stability <s> --style <st> --speed <sp>` (or equivalent) per the prosody block returned alongside the prompt.

### Telemetry / Observability

Every `ComposeAgent --traits` invocation appends to two streams:

| Stream | Path | Purpose |
|--------|------|---------|
| Artifact log | `~/.claude/MEMORY/ARTIFACTS/artifacts.jsonl` | Standard DOS artifact tracker — `pack: "Agents", workflow: "compose"` rows. Synced to Studio at SessionEnd via `SaveArtifactsToStudio`. |
| Composition analytics | `~/.claude/MEMORY/ARTIFACTS/trait-compositions.jsonl` | Per-composition record (traits + voice_id + council_type) for `--analytics` heatmap of trait combos used. |

Both writes use silent-fail wrappers (RFC-0017 §4.2) — telemetry must never break composition. View aggregate stats via `bun ComposeAgent.ts --analytics`.

## Examples

**Example 1: Create custom agents**
```
User: "Spin up 3 custom security agents"
→ Invokes CREATECUSTOMAGENT workflow
→ Runs ComposeAgent 3 times with DIFFERENT trait combinations
→ Each agent gets unique personality + matched voice + prosody
→ Launches agents in parallel
```

**Example 2: List available traits**
```
User: "What agent personalities can you create?"
→ Invokes LISTTRAITS workflow
→ Shows merged base + user traits
→ Displays voices with prosody settings
```

**Example 3: Reuse a useful composition (→ persistence loop)**

When a Council debate or QA review composition lands well, save it for reuse instead of re-rolling traits next time:

```bash
# After a successful spawn, persist the composition
bun ~/.claude/skills/agents/Tools/ComposeAgent.ts \
  --traits "security,skeptical,thorough" \
  --task "Audit auth flow" \
  --save

# Saved to ~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Agents/saved/<slug>.json
# Reuse next time:
bun ~/.claude/skills/agents/Tools/ComposeAgent.ts \
  --load "security-expert-skeptical-thorough" \
  --output json
```

**Operator nudge for council workflows:** If you ran a Council debate (Thinking/Council/Debate, FeatureDelivery/CouncilGate, ContractReview, Github/ReviewPRs) and the trait composition produced a strong verdict, append `--save` on the next run with that combination. Saved compositions are operator-curated NamedAgents — they survive DOS upgrades because they live under USER/.

## Extending the Skill

### Adding Your Own Traits

In `USER/SKILLCUSTOMIZATIONS/Agents/Traits.yaml`:

```yaml
# Add new expertise areas
expertise:
  marketing:
    name: "Marketing Expert"
    description: "Brand strategy, campaigns, market positioning"
    keywords:
      - marketing
      - brand
      - campaign
      - positioning

# Add new personalities
personality:
  visionary:
    name: "Visionary"
    description: "Forward-thinking, sees the big picture"
    prompt_fragment: |
      You think in terms of future possibilities and long-term vision.
      Connect today's work to tomorrow's potential.
```

### Adding Named Agents

In `USER/SKILLCUSTOMIZATIONS/Agents/NamedAgents.md`:

```markdown
## Alex - The Strategist

**Voice ID:** your-voice-id
**Prosody:** stability: 0.55, style: 0.20, speed: 0.95

Alex is a strategic thinker who sees patterns others miss...
```

## Model Selection

| Task Type | Model | Speed |
|-----------|-------|-------|
| Grunt work, simple checks | `haiku` | 10-20x faster |
| Standard analysis, research | `sonnet` | Balanced |
| Deep reasoning, architecture | `opus` | Maximum quality |

## Version History

- **v3.1.0** (2026-05-10): DynamicAgent.hbs now consumes the active Algorithm doctrine resolved at composition time from `~/.claude/DOS/Algorithm/LATEST`. Composer threads `{{algorithmVersion}}`, `{{algorithmSpecPath}}`, `{{liteProfilePath}}` into every rendered subagent prompt — version bumps no longer require template edits. Inlined ~25 LOC LATEST resolver in `Tools/compose/compose.ts` (cross-package import infeasible across Four Copies due to different relative depths to `DOS/Tools/`).
- **v3.0.0** (2026-05-10): Three-class agent model — retired the "NEVER static types" rule (specialist subagents at `~/.claude/agents/*.md` are now a peer pattern). Documented voice+prosody pipeline (parent voices subagent COMPLETED line via `voice.sh`). Surfaced telemetry streams (`artifacts.jsonl` + `trait-compositions.jsonl`). Added `--save` operator nudge for Council reuse.
- **v2.0.0** (2026-01): Restructured to base + user merge pattern, added prosody support
- **v1.0.0** (2025-12): Initial creation

## Artifact Tracking

**MANDATORY for any workflow in this skill that writes output files via the Write tool.**

After writing any output file, resolve the ARTIFACTS path and append a JSONL log entry:

```bash
# Resolve ARTIFACTS dir (project-level first)
if [ -d "${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS"
elif [ -d "$(pwd)/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="$(pwd)/MEMORY/ARTIFACTS"
else
  ARTIFACTS_DIR="$HOME/.claude/MEMORY/ARTIFACTS"
fi
mkdir -p "$ARTIFACTS_DIR"

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"Agents","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/agents/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/agents/` — active release submodule (versioned)
3. `Packs/*/src/Agents/` — pack source (distributable)
4. `Packs/agents/Agents/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
