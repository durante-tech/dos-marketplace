---
name: Create Custom Agent
description: Composes multiple custom agents with unique trait combinations, personalities, voices, and colors via ComposeAgent, then launches them in parallel with parent-side voice announcements.
status: STABLE
bestPath:
  - title: "Determine Agent Count & Requirements"
    description: "Extract how many agents, the task, and any specific traits from the request."
  - title: "Compose Traits per Agent"
    description: "Run ComposeAgent with a different trait combination for each agent to get unique voices."
  - title: "Launch Parallel Agents"
    description: "Send all Task calls in a single message using subagent_type general-purpose."
  - title: "Voice Each Agent's Completion"
    description: "Parent extracts each agent's COMPLETED line and voices it with the agent's voice_id."
  - title: "Persist a Winning Composition"
    description: "Save a proven trait blend for reuse, on the on-ramp toward PromoteAgent."
---

# CreateCustomAgent Workflow

**Creates custom agents with unique personalities, colors, and voices using ComposeAgent.**

<!-- partial: _workflow-voice.md skill_name=Agents workflow_name=CreateCustomAgent action_phrase=" to create agents" -->

## When to Use

{PRINCIPAL.NAME} says:
- "Create custom agents to do X"
- "Spin up custom agents for Y"
- "I need specialized agents with Z expertise"
- "Generate N custom agents to analyze..."

**KEY TRIGGER: The word "custom" means truly unique agents - NOT static types (Architect, Engineer, etc.) — always use `general-purpose` with ComposeAgent prompts.**

## The Workflow

### Step 1: Determine Agent Count & Requirements

Extract from {PRINCIPAL.NAME}'s request:
- How many agents? (Default: 1 if not specified)
- What's the task?
- Are specific traits mentioned? (security, legal, skeptical, thorough, etc.)

### Step 2: For EACH Agent, Run ComposeAgent with DIFFERENT Traits

**CRITICAL: Each agent MUST have different trait combinations to get unique voices and colors.**

```bash
# Example for 3 custom research agents:

# Agent 1 - Enthusiastic Explorer
bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts \
  --traits "research,enthusiastic,exploratory" \
  --task "Research quantum computing applications" \
  --output json

# Agent 2 - Skeptical Analyst
bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts \
  --traits "research,skeptical,systematic" \
  --task "Research quantum computing applications" \
  --output json

# Agent 3 - Thorough Synthesizer
bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts \
  --traits "research,analytical,synthesizing" \
  --task "Research quantum computing applications" \
  --output json
```

### Step 3: Extract Prompt, Voice ID, and Color from Each

ComposeAgent returns JSON with:
```json
{
  "name": "Research Enthusiastic Explorer",
  "voice": "Jeremy",
  "voice_id": "bVMeCyTHy58xNoL34h3p",
  "color": "#FF6B35",
  "traits": ["research", "enthusiastic", "exploratory"],
  "prompt": "# Dynamic Agent: Research Enthusiastic Explorer\n\nYou are a specialized agent..."
}
```

**Each agent gets a unique color** - use this in the description for visual distinction in the terminal.

### Step 4: Launch Agents with Task Tool

**Use a SINGLE message with MULTIPLE Task calls for parallel execution.**

**CRITICAL: Use `subagent_type: "general-purpose"` - NEVER use static types like "Architect" or "Engineer" for custom agents.**

```typescript
// Send all in ONE message:
Task({
  description: "Research agent 1 - enthusiastic",
  prompt: <agent1_full_prompt>,
  subagent_type: "general-purpose",
  model: "sonnet"  // or "haiku" for speed
})
Task({
  description: "Research agent 2 - skeptical",
  prompt: <agent2_full_prompt>,
  subagent_type: "general-purpose",
  model: "sonnet"
})
Task({
  description: "Research agent 3 - analytical",
  prompt: <agent3_full_prompt>,
  subagent_type: "general-purpose",
  model: "sonnet"
})
```

**Note:** Store the voice_id from ComposeAgent output - you'll need it to voice the agent's results.

### Step 5: Voice Each Agent's Completion (Parent-Voices Model)

**The PARENT voices every subagent's completion — subagents never call the voice server themselves.**

Each subagent ends its response with a `🎯 COMPLETED: <summary>` line (12 words max). After an agent returns, the parent:

1. **Extracts** the agent's `🎯 COMPLETED:` line from its final response.
2. **Voices** it using the `voice_id` and `voice_settings` that ComposeAgent already returned in that agent's JSON (Step 3):

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" custom --voice-id <agent_voice_id> "<COMPLETED line content>"
```

This is exactly what the rendered `DynamicAgent.hbs` prompt tells every subagent: *"Your parent agent handles voice announcement of your completion on your behalf... Do NOT call the voice server yourself."* The template and this workflow describe the **same single flow** — parent-voices. There is no self-voicing path and no `--self-voice` flag anywhere.

**Reliability note:** Parent-voicing is a prompt-level CONVENTION, not enforced in `ComposeAgent.ts`. ComposeAgent hands back the `voice_id` + `voice_settings`; it never wires a voice call. So make the extract-and-voice step explicit in your own loop — for each returned agent, pull its `🎯 COMPLETED:` line and run `voice.sh` with that agent's `voice_id`. Skip it and the agent is silent; nothing downstream covers for you.

### Step 6: Spotcheck (Optional but Recommended)

After all agents complete, launch one more to verify consistency:

```typescript
Task({
  description: "Spotcheck custom agent results",
  prompt: "Review these results for consistency and completeness: [results]",
  subagent_type: "general-purpose",
  model: "haiku"
})
```

### Step 7: Persist a Winning Composition (On-Ramp to Promotion)

A trait blend that proves genuinely useful shouldn't be re-derived from scratch every run. ComposeAgent exposes a **persistence quartet** — `--save`, `--list-saved`, `--load`, `--delete` — that banks a proven composition (traits + resolved voice/color) as a reusable Named/USER agent under `~/.claude/custom-agents/`. See `help.txt` (the ComposeAgent CLI contract) for the exact flag arguments rather than re-listing them here; the lifecycle is: **save** a composition that earned its keep, **list-saved** to see what you've banked, **load** it for a new task, **delete** it when it stops paying off.

**Promotion path:** persistence is the on-ramp, not the destination. A saved composition that keeps proving durable across sessions earns promotion to a first-class **Specialist** via the **PromoteAgent** workflow (and its `--promote` bridge, which consults an N-session gate). The arc is:

> useful composition → `--save` (Named/USER agent) → proven durable → **PromoteAgent** → Specialist

Save first, let it prove value across real work, *then* promote — don't promote a composition you've run once.

## Trait Variation Strategies

When creating multiple custom agents, vary traits to ensure different voices:

**For Research Tasks:**
- Agent 1: research + enthusiastic + exploratory → Jeremy (energetic)
- Agent 2: research + skeptical + thorough → George (intellectual)
- Agent 3: research + analytical + systematic → Drew (professional)
- Agent 4: research + creative + bold → Fin (charismatic)
- Agent 5: research + empathetic + synthesizing → Thomas (gentle)

**For Security Analysis:**
- Agent 1: security + adversarial + bold → Callum (edgy hacker)
- Agent 2: security + skeptical + meticulous → Sam (gritty authentic)
- Agent 3: security + cautious + systematic → Bill (trustworthy)

**For Business Strategy:**
- Agent 1: product + bold + rapid → Arnold (assertive CEO)
- Agent 2: product + analytical + comparative → Drew (balanced news)
- Agent 3: product + pragmatic + consultative → Charlie (casual laid-back)

## Timing & Model Selection

**Timing flows from the Algorithm.** The main agent validates a timing tier (fast|standard|deep) and passes it to ComposeAgent via `--timing`:

```bash
# Pass timing to ComposeAgent for automatic scope in agent prompt:
bun run ComposeAgent.ts --traits "research,enthusiastic" --task "Quick status check" --timing fast --output json
bun run ComposeAgent.ts --traits "security,thorough" --task "Full security audit" --timing deep --output json
```

If `--timing` is omitted, agents get no scope section (backward compatible).

| Timing | Model | Agent Output |
|--------|-------|-------------|
| `fast` | `haiku` | Under 500 words, direct answer |
| `standard` | `sonnet` | Focused work, under 1500 words |
| `deep` | `opus` | Comprehensive analysis, no limit |

**Parallel custom agents benefit from `sonnet` or `haiku` for speed.**

## Example Execution

**{PRINCIPAL.NAME}:** "Create 5 custom science agents to analyze this climate data"

**{DAIDENTITY.NAME}'s Internal Execution:**
```bash
# Agent 1 - Climate Science Enthusiast
bun run ComposeAgent.ts --traits "research,enthusiastic,thorough" --task "Analyze climate data patterns" --output json
# Returns: voice="Jeremy", voice_id="bVMeCyTHy58xNoL34h3p"

# Agent 2 - Skeptical Data Analyst
bun run ComposeAgent.ts --traits "data,skeptical,systematic" --task "Analyze climate data patterns" --output json
# Returns: voice="{PRINCIPAL.NAME}", voice_id="onwK4e9ZLuTAKqWW03F9"

# Agent 3 - Creative Pattern Finder
bun run ComposeAgent.ts --traits "data,creative,exploratory" --task "Analyze climate data patterns" --output json
# Returns: voice="Freya", voice_id="jsCqWAovK2LkecY7zXl4"

# Agent 4 - Meticulous Validator
bun run ComposeAgent.ts --traits "research,meticulous,comparative" --task "Analyze climate data patterns" --output json
# Returns: voice="Charlotte", voice_id="XB0fDUnXU5powFXDhCwa"

# Agent 5 - Synthesizing Strategist
bun run ComposeAgent.ts --traits "research,analytical,synthesizing" --task "Analyze climate data patterns" --output json
# Returns: voice="Charlotte", voice_id="XB0fDUnXU5powFXDhCwa"

# Launch all 5 in parallel (single message, 5 Task calls)
# Each agent has unique personality and voice
```

**Result:** 5 distinct agents with different analytical approaches and unique voices analyzing the data from different perspectives.

## Common Mistakes to Avoid

**❌ WRONG: Using same traits for all agents**
```bash
# All agents get same voice!
bun run ComposeAgent.ts --traits "research,analytical" # Agent 1
bun run ComposeAgent.ts --traits "research,analytical" # Agent 2 (same voice!)
bun run ComposeAgent.ts --traits "research,analytical" # Agent 3 (same voice!)
```

**✅ RIGHT: Varying traits for unique voices**
```bash
# Each agent gets different voice
bun run ComposeAgent.ts --traits "research,enthusiastic,exploratory"  # Jeremy
bun run ComposeAgent.ts --traits "research,skeptical,systematic"      # George
bun run ComposeAgent.ts --traits "research,creative,synthesizing"     # Freya
```

**❌ WRONG: Launching agents sequentially**
```typescript
// Slow - waits for each to finish
await Task({ ... }); // Agent 1
await Task({ ... }); // Agent 2 (waits for 1)
await Task({ ... }); // Agent 3 (waits for 2)
```

**✅ RIGHT: Launching agents in parallel**
```typescript
// Fast - all run simultaneously (single message, multiple calls)
Task({ ... })  // Agent 1
Task({ ... })  // Agent 2
Task({ ... })  // Agent 3
```

## Voice Assignment Logic

ComposeAgent automatically maps trait combinations to voices:

1. **Exact combination matches** (highest priority)
   - `["contrarian", "security"]` → Clyde (gravelly veteran)
   - `["enthusiastic", "research"]` → Jeremy (high energy)
   - `["legal", "cautious"]` → Alice (British professional)

2. **Personality-level matches** (medium priority)
   - `skeptical` → {PRINCIPAL.NAME} (BBC anchor authority)
   - `enthusiastic` → Jeremy (excited)
   - `bold` → Arnold (commanding announcer)
   - `cautious` → Emily (calm soothing)
   - `meticulous` → Matthew (measured narrator)

3. **Expertise-level matches** (low priority)
   - `security` → James (calm authoritative)
   - `legal` → Alice (confident British)
   - `research` → Rachel (calm supportive)
   - `data` → Drew (clear neutral)
   - `finance` → Brian (deep smooth)

4. **Default** (no matches)
   - {PRINCIPAL.NAME} (BBC anchor authority)

## Related Workflows

- **ListTraits** - Show available traits for composition
- **SpawnParallelAgents** - Launch parallel agents for grunt work (same voice, no custom identity)

## References

- Trait definitions: `~/.claude/skills/agents/Data/Traits.yaml`
- Agent template: `~/.claude/skills/agents/Templates/DynamicAgent.hbs`
- ComposeAgent tool: `~/.claude/skills/agents/Tools/ComposeAgent.ts`
- Voice mappings: `~/.claude/skills/agents/Data/Traits.yaml` (`voice_mappings` section)