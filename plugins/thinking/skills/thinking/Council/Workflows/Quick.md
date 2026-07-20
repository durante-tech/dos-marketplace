---
name: Quick
description: 
status: STABLE
---

# Quick Workflow

Fast single-round perspective check. Use for sanity checks and quick feedback.

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the Quick workflow in the Council skill to get fast perspectives"
```

Running the **Quick** workflow in the **Council** skill to get fast perspectives...

## Tool-Use Budget (v0.0.4)

Council agents spawned by this workflow run the **Subagent Algorithm Profile** (`~/.claude/DOS/PARTIALS/_algorithm-lite.md`). Tool invocations do NOT count toward per-agent word caps — prose only. When the topic references files on disk, RFC numbers, or verifiable facts, each agent MUST invoke ≥1 tool and ground load-bearing claims with file:line, quote, or tool output.

## Prerequisites

- Topic or question to evaluate
- Optional: Custom council members (trait-composed and/or specialist seats — see below)

## Specialist Seat Composition (native subagent_type)

When the user names channeled specialists (Fowler, UncleBob, KentBeck, SandiMetz, EricEvans, GregYoung, Cockburn, Feathers, Pragmatic), recruit them as **native subagents**. Each has a first-class agent at `~/.claude/agents/{Specialist}.md`. See `Workflows/Debate.md` § Specialist Seat Composition for the full pattern.

For Quick mode (single round, no transcript loop), the spawn pattern simplifies to:

```ts
Task({
  subagent_type: "Fowler",   // or any of the 9 specialists
  prompt: QUICK_COUNCIL_INSTRUCTIONS
})
```

The agent's startup-load handles persona files. No parent-side prompt assembly. Mixed councils (trait + specialist seats) work in Quick the same way as Debate.

## Execution

### Step 1: Announce Quick Council

```markdown
## Quick Council: [Topic]

**Council Members:** [List agents]
**Mode:** Single round (fast perspectives)
```

### Step 2: Parallel Perspective Gathering

Launch all council members in parallel (single Task call batch). Spawn type per seat:

- **Trait-composed seat:** `subagent_type: "general-purpose"` with the `prompt` field from `ComposeAgent` JSON output as the system prompt
- **Specialist seat:** `subagent_type: "<Specialist>"` (e.g. `Fowler`, `UncleBob`) — the agent's startup loads its own persona files

**Each spawned agent receives the quick-council instructions in its prompt:**
```
You are [Agent Name], [brief role description].

QUICK COUNCIL CHECK

Topic: [The topic]

Give your immediate take from your specialized perspective:
- Key concern, insight, or recommendation
- 150-300 words max (prose only — tool output is free)
- Be direct and specific

This is a quick sanity check, not a full debate.
```

### Step 3: Output Perspectives

```markdown
### Perspectives

**🏛️ Architect (Serena):**
[Brief take]

**🎨 Designer (Aditi):**
[Brief take]

**⚙️ Engineer (Marcus):**
[Brief take]

**🔍 Researcher (Ava):**
[Brief take]

### Quick Summary

**Consensus:** [Do they generally agree? On what?]
**Concerns:** [Any red flags raised?]
**Recommendation:** [Proceed / Reconsider / Need full debate]
```

## When to Escalate

If the quick check reveals significant disagreement or complex trade-offs, recommend:

```
⚠️ This topic has enough complexity for a full council debate.
Run: "Council: [topic]" for 3-round structured discussion.
```

## Timing

- Total: 10-20 seconds

## Done

Quick perspectives gathered. Use for fast validation; escalate to DEBATE for complex decisions.