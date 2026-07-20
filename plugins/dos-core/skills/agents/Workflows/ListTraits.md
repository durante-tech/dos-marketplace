---
name: List Traits
description: Lists all available agent traits (expertise, personality, approach) from ComposeAgent's live catalog, explains the composition system, and supports natural-language trait discovery.
status: STABLE
bestPath:
  - title: "Run ComposeAgent --list"
    description: "Read the live trait catalog from Data/Traits.yaml (base + user overrides)."
  - title: "Present the Live Output Verbatim"
    description: "Show the tool's output exactly as printed, never re-typed or summarized from memory."
  - title: "Explain the Composition System"
    description: "Describe how expertise + personality + approach combine into a custom agent."
  - title: "Discover Traits From Intent"
    description: "Use --search to map a plain-language need to a ready-to-paste trait composition."
---

# ListTraits Workflow

**Shows all available traits that can be composed into custom agents.**

<!-- partial: _workflow-voice.md skill_name=Agents workflow_name=ListTraits action_phrase=" to show traits" -->

## When to Use

User says:
- "What agent personalities can you create?"
- "Show me available traits"
- "List agent types"
- "What expertise areas do you have?"

## The Workflow

### Step 1: Run ComposeAgent with --list Flag

```bash
bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts --list
```

### Step 2: Present the Live Output Verbatim

Show the user exactly what `--list` printed. **Do not re-type, summarize, or
reorder the catalog from memory** — the tool reads the single source of truth
(`Data/Traits.yaml`, base + any user overrides) at runtime, so its output is
always current. Re-typing the list is how it drifts.

> **`--list` output is load-bearing UI.** This workflow's presentation
> *follows the tool's format* — the tool is the catalog, this doc is not.
> Traits.yaml defines **31 traits** today (12 expertise + 9 personality +
> 10 approach); `--list` surfaces whatever the file contains. The count and
> the renderer are pinned by `compose/traits-list-parity.test.ts`, so if you
> ever see a number other than 31, the SoT changed and the test caught it —
> trust the tool over any number written here.

### Step 3: Explain the Composition System

Add context for the user:

```
You can combine these traits to create custom agents:

EXPERTISE + PERSONALITY + APPROACH = Custom Agent

Examples:
- "Create a security expert who's skeptical and thorough"
  → security + skeptical + thorough

- "I need someone with legal knowledge who's really careful"
  → legal + cautious + meticulous

- "Get me a creative thinker who works fast"
  → creative + enthusiastic + rapid

Just describe what you need naturally, and I'll compose the right agent.
```

### Step 4: Discover Traits From Intent — `--search`

When the user describes a *need* in plain language instead of naming traits,
don't make them read the whole catalog. Run the discovery flag — same job
(find the right traits), but it starts from intent:

```bash
bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts --search "review a vendor contract for risk"
```

`--search` scores the phrase against every trait across all three dimensions
and prints a ready-to-paste `--traits "..."` composition. Reach for it whenever
the request is a goal ("I need to stress-test this launch plan") rather than a
trait name; fall back to `--list` (Step 1) only when the user explicitly wants
the full catalog.

## Enhanced Presentation (Optional)

If the user wants more detail, also explain voice assignment. `--list` already
prints the full voice registry under `VOICES AVAILABLE`; this grouping is just
an at-a-glance map of the personalities those voices pair with:

```
Each trait combination maps to a unique voice:

ENERGETIC VOICES (enthusiastic, bold, exploratory):
- Jeremy (excited Irish-American male)
- Arnold (commanding announcer)
- Freya (vibrant Nordic-American female)
- Jessica (expressive upbeat female)

INTELLECTUAL VOICES (analytical, skeptical, meticulous):
- {PRINCIPAL.NAME} (BBC anchor authority)
- Matthew (measured audiobook narrator)
- Drew (clear neutral American)
- Alice (confident British professional)

AUTHORITATIVE VOICES (sales, product, finance):
- Marcus (authoritative professional)
- Brian (deep smooth narrator)
- Liam (articulate young American)
- Arnold (commanding announcer)

WARM VOICES (empathetic, consultative, cautious):
- Matilda (friendly approachable female)
- Emily (calm soothing American)
- Dorothy (pleasant warm British)
- Rachel (calm supportive)

EDGY VOICES (adversarial, contrarian, security):
- Clyde (gravelly war veteran)
- Fin (rugged Irish sailor)
- Sam (raspy distinctive)
- Callum (intense transatlantic)
```

## Related Workflows

- **CreateCustomAgent** - Actually create agents with these traits
- **SpawnParallelAgents** - Launch generic agents (no trait customization)

## References

- Full trait definitions (SoT): `~/.claude/skills/agents/Data/Traits.yaml`
- Voice mappings: the `voice_mappings` section of Traits.yaml
- ComposeAgent tool: `~/.claude/skills/agents/Tools/ComposeAgent.ts`
- Discovery flag: `--search "<intent>"` (NL → suggested `--traits`)
- Catalog parity test: `compose/traits-list-parity.test.ts` (pins the count + renderer to the SoT)
