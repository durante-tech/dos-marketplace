---
name: Algorithm Upgrade
description: Analyze reflections and specs to propose contents for a new Algorithm version.
status: STABLE
---

# AlgorithmUpgrade Workflow

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the Algorithm Upgrade workflow to analyze and propose improvements to the DOS Algorithm"
```

Running the **AlgorithmUpgrade** workflow in the **DOSUpgrade** skill to propose Algorithm improvements...

**Dedicated self-improvement workflow for the DOS Algorithm.** Combines internal reflection mining with Algorithm spec analysis to produce concrete, section-targeted upgrade proposals.

**Trigger:** "algorithm upgrade", "upgrade algorithm", "improve the algorithm", "algorithm improvements", "what should we fix in the algorithm"

---

## Overview

This workflow closes the ultimate feedback loop: the Algorithm reflects on its own performance after every run, and this workflow mines those reflections to propose upgrades to the Algorithm itself.

```
Algorithm Reflections (JSONL)     Current Algorithm Spec
┌──────────────────────────┐     ┌──────────────────────────┐
│ Q1: Execution mistakes   │     │ Version + Changelog      │
│ Q2: Algorithm fixes      │     │ Phase definitions        │
│ Q3: Fundamental gaps     │     │ ISC requirements         │
│ Sentiment + budget data  │     │ Capability matrix        │
└──────────────────────────┘     │ Quality gates            │
           │                     │ PRD integration          │
           └──────────┬──────────┘
                      ▼
        ┌─────────────────────────────┐
        │  SECTION-TARGETED UPGRADES  │
        │  (specific diffs proposed)   │
        └─────────────────────────────┘
```

---

## Algorithm Section Map

Reflections map to Algorithm sections. This is the routing table for where fixes land:

| Theme Pattern | Algorithm Section | File Location |
|---------------|-------------------|---------------|
| ISC quality, criteria vague, wrong count | ISC decomposition, count, atomicity | `## §3 — ISC Decomposition`, `### §3.3 — ISC Count Gate`, `### §7.6 — Atomic Criteria Only` |
| Phase timing, budget, over-budget | Modes and effort selection | `## §1 — Modes & Profiles`, `### §1.1 — Effort Override Syntax`, `#### i. EFFORT LEVEL` |
| Capability selection, wrong tools | Capability invocation contract | `## §4 — Capability Invocation Contract`, `#### k. CAPABILITY SELECTION` |
| Agent overhead, wrong parallelization | Orchestration and platform capabilities | `### §4.2 — Orchestration Trigger Check`, `### §4.3 — Platform Capabilities` |
| Context recovery, prior work missed | OBSERVE phase | `━━━ OBSERVE ━━━`, `**CONTEXT RECOVERY**` |
| Verification gaps, claims without proof | VERIFY phase | `━━━ VERIFY ━━━` |
| Plan mode, exploration depth | PLAN phase | `### §6.3 — PLAN  ━ 3/7` |
| PRD issues, sync problems | PRD as system of record | `## §2 — PRD as System of Record`, `### §2.2 — PRD Format` |
| Phase merging, discrete violations | Seven-phase discipline | `## §6 — The 7 Phases`, `### §7.7 — Context Compaction at Phase Transitions` |
| Voice, notifications | Voice curls rule | `### §7.5 — Voice Curls — Primary Agent Only` |
| Loop mode, iteration | Learn and advancement flow | `### §6.7 — LEARN  ━ 7/7`, `## §10 — Rollback / Advancement` |
| Silent stalls, hanging | No Silent Stalls | `## No Silent Stalls` |

---

## Execution

### Step 1: Read Current Algorithm State

```
Read the current Algorithm state:

1. Read DOS/Algorithm/LATEST to get the active Algorithm version
2. Read DOS/Algorithm/v{VERSION}.md (the full spec) for the active Algorithm policy
3. Read agents/Algorithm.md for the Algorithm agent profile
4. Read DOS/SKILL.md for the active DOS-wide policy
5. Extract section headers and key rules into a structured map

Report: "Current Algorithm: v{VERSION} — {N} sections, {M} rules"
```

### Step 2: Mine Reflections with Algorithm Focus

**Source:** Studio-first with local fallback. Invoke the `FetchReflections` CLI to pull cross-session, cross-device reflections from Studio merged with the local JSONL. Studio is the canonical post-sync record; local `algorithm-reflections.jsonl` captures the current session's pre-sync trail. `--merge-local` dedupes by `prd_id` with Studio winning on conflict. If Studio env is unset or unreachable the tool degrades silently to local-only (exit 0), so the workflow runs in every environment.

Feed the tool's stdout to the agent as the reflection corpus instead of asking it to read the JSONL directly:

```bash
bun ~/.claude/skills/utilities/DOSUpgrade/Tools/FetchReflections.ts --merge-local > /tmp/reflections.jsonl
```

Spawn 1 agent:

```
Use Task tool with subagent_type=general-purpose:

"Mine algorithm reflections specifically for Algorithm improvement patterns.

Read /tmp/reflections.jsonl (pre-populated by FetchReflections — Studio + local merged, deduped).
Parse each line as JSON.

For EACH entry, analyze Q2 (algorithm improvements) and classify the theme using this routing table:

SECTION ROUTING:
- ISC quality/criteria issues → 'ISC'
- Phase timing/budget issues → 'EFFORT_LEVELS'
- Capability selection issues → 'CAPABILITIES'
- Agent/parallelization issues → 'AGENTS'
- Context recovery issues → 'OBSERVE'
- Verification gaps → 'VERIFY'
- Plan mode issues → 'PLAN'
- PRD/sync issues → 'PRD'
- Phase discipline issues → 'PHASE_DISCIPLINE'
- Voice/notification issues → 'VOICE'
- Loop/iteration issues → 'LOOP'
- Silent stall issues → 'NO_STALLS'
- Other → 'OTHER'

Weight by signal:
- implied_sentiment <= 5 → HIGH signal
- within_budget: false → BOOST
- criteria_failed > 0 → BOOST

Return format:
{
  'entries_analyzed': N,
  'date_range': '[earliest] to [latest]',
  'section_hits': {
    'ISC': { 'count': N, 'quotes': ['...'], 'signal': 'HIGH/MED/LOW' },
    'CAPABILITIES': { 'count': N, 'quotes': ['...'], 'signal': '...' },
    ...
  },
  'top_themes': [
    {
      'section': 'ISC',
      'theme': '[specific issue]',
      'frequency': N,
      'signal': 'HIGH',
      'root_cause': '[why this keeps happening]',
      'quotes': ['[Q2 excerpts with timestamps]']
    }
  ],
  'q3_insights': ['[fundamental improvement ideas from Q3]']
}

If file doesn't exist or is empty, return { 'entries_analyzed': 0 }

EFFORT LEVEL: Return within 60 seconds."
```

### Step 3: Cross-Reference Reflections Against Spec

For each theme from Step 2:

1. **Locate the section** in the Algorithm spec using the routing table
2. **Read the current text** of that section
3. **Identify the gap** between what the spec says and what reflections say goes wrong
4. **Draft the fix** — specific text changes to the Algorithm spec

### Step 4: Generate Upgrade Proposals

For each theme with 2+ occurrences (or 1 if HIGH signal):

```
ALGORITHM UPGRADE PROPOSAL #{N}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Section: [Algorithm section name]
Priority: [CRITICAL / HIGH / MEDIUM / LOW]
Signal: [N reflections, {HIGH/MED/LOW} average signal]

Problem: [What keeps going wrong, in 1-2 sentences]

Current spec says:
> [Quote the relevant current Algorithm text]

Proposed change:
> [New text that would fix the issue]

Why this helps:
[1-2 sentences explaining how this change prevents the recurring issue]

Evidence:
- [{timestamp}] {task} — "{Q2 quote}"
- [{timestamp}] {task} — "{Q2 quote}"
```

### Step 5: Version Bump Assessment

Based on upgrade proposals:

| Change Type | Version Bump | Threshold |
|-------------|-------------|-----------|
| New phase rules, new sections | Minor (0.X.0) | 3+ CRITICAL proposals |
| Clarifications, guardrails, wording | Patch (0.X.Y) | Any proposals |
| No actionable proposals | None | Reflections too few or all positive |

---

## Output Format

```markdown
# Algorithm Self-Upgrade Report

**Current Version:** v{VERSION}
**Reflections Analyzed:** {N} entries spanning {date range}
**High-Signal Entries:** {N}
**Upgrade Proposals:** {N} ({N} critical, {N} high, {N} medium, {N} low)
**Recommended Version Bump:** v{NEW_VERSION} ({patch/minor/none})

---

## Section Heat Map

Which Algorithm sections have the most recurring issues:

| Section | Hits | Signal | Top Theme |
|---------|------|--------|-----------|
| [Section] | [N] | [HIGH/MED/LOW] | [Theme] |

---

## Upgrade Proposals

[Proposals from Step 4, sorted by priority then frequency]

---

## Aspirational Insights (from Q3)

Ideas that require fundamental changes, not just spec edits:
- [Q3 pattern with frequency]

---

## Next Steps

- [ ] Review proposals
- [ ] Apply approved changes to Algorithm spec
- [ ] Bump version if warranted
- [ ] Run `bun ~/Durante/Tools/dos-build.ts` to rebuild
```

---

## Integration Notes

- **Standalone:** User says "algorithm upgrade" or "improve the algorithm"
- **From MineReflections:** If MineReflections finds Algorithm-related themes, it can suggest running this workflow for deeper analysis
- **From Upgrade:** The main Upgrade workflow's Thread 3 provides a summary; this workflow goes deeper with section-level mapping
