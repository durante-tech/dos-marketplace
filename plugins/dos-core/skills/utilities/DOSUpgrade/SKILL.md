---
disable-model-invocation: true
name: DOSUpgrade
description: Extract system improvements from content AND monitor external sources (Anthropic ecosystem, YouTube). USE WHEN upgrade, improve system, system upgrade, analyze for improvements, check Anthropic, Anthropic changes, new Claude features, check YouTube, new videos, algorithm upgrade, mine reflections, find sources, research upgrade, DOS upgrade.
role: analyzer
accepts:
  - text
roots:
  - INSTALL
visibility: public
capabilities:
  - customization.cascade
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/DOSUpgrade/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

## Preflight Check — Hook Pipeline Availability (NEW 2026-05-15, D23)

DOSUpgrade workflows depend on the full hook pipeline (LoadContext, IntelFirstGuard, MemoryHarvest). Operators in enterprise-managed installs may have `disableAllHooks` or `allowManagedHooksOnly` set. Without the pipeline, the workflow runs but produces degraded output and may hang on a missing context-injection step.

**Before running any workflow, the skill reads `~/.claude/settings.json` and warns when:**

```jsonc
{
  "disableAllHooks": true                // BLOCKS — workflow cannot run; abort with clear error
  // OR
  "allowManagedHooksOnly": true          // WARN — partial functionality; surface to operator
}
```

**Mechanical surface:** Claude Code v2.1.140 ships a clear error in the platform for this case; the skill mirrors it so DOSUpgrade-specific failure modes (no INTEL-FIRST, no MEMORY RECALL, no reflection mining) are surfaced *before* the parallel agent fan-out starts, not after.

**Skip silently** when settings.json is unreachable (already a precondition failure surfaced elsewhere) or both keys are unset/false.

# DOSUpgrade Skill

**Primary Purpose:** Generate prioritized upgrade recommendations for the user's existing DOS setup by understanding their context and discovering what's new in the ecosystem.

The skill runs **three parallel agent threads** that converge into personalized recommendations:

```
Thread 1: USER CONTEXT     Thread 2: SOURCE COLLECTION    Thread 3: INTERNAL REFLECTIONS
┌───────────────────┐     ┌───────────────────────┐      ┌───────────────────────┐
│ TELOS Analysis    │     │ Anthropic Sources     │      │ Algorithm Reflections │
│ Project Analysis  │     │ YouTube Channels      │      │ Q2: Algorithm fixes   │
│ Recent Work       │     │ Custom USER Sources   │      │ Q1: Execution errors  │
│ DOS System State  │     │ GitHub Trending       │      │ Sentiment weighting   │
│                   │     │ Community Updates     │      │                       │
└───────────────────┘     └───────────────────────┘      └───────────────────────┘
           │                         │                              │
           └─────────────┬───────────┴──────────────────────────────┘
                         ▼
           ┌─────────────────────────────┐
           │  PRIORITIZED RECOMMENDATIONS │
           │  (external + internal)       │
           └─────────────────────────────┘
```

---

## Sibling pattern — track-bootstrap (NEW 2026-05-15)

DOSUpgrade is the **doctrine-evolution** instance of a recurring meta-pattern: *external-surface enumeration → structured decomposition → parallel delivery*. Its sibling is **track-bootstrap** — the **API-integration** instance of the same shape.

| Instance | "Outside" phase | Catalog/enumerate | Decompose to units |
|---|---|---|---|
| **DOSUpgrade** (this) | YouTube + sources.json mining + reflections | D-items report | D-tickets per ISC |
| **Algorithm ratification** (v0.0.8, v0.0.9, v0.0.10) | Reflection mining | RFC ratification list | Per-ISC RFCs |
| **Track-bootstrap** | 4 parallel research workstreams | API catalog | Sub-track PRDs |

Canonical reference: `MEMORY/CANONICAL/track-bootstrap-pattern.md`. Scaffold: `~/.claude/DOS/Scaffolds/track-bootstrap/`.

When an operator says "we need to integrate ${PROVIDER}" with multi-resource scope, route them to track-bootstrap rather than running this skill — these are not interchangeable, they are siblings in the family.

---

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Upgrade** | "check for upgrades", "check sources", "any updates", "check Anthropic", "check YouTube", "upgrade", "dos upgrade" | `Workflows/Upgrade.md` |
| **MineReflections** | "mine reflections", "check reflections", "what have we learned", "internal improvements", "reflection insights" | `Workflows/MineReflections.md` |
| **AlgorithmUpgrade** | "algorithm upgrade", "upgrade algorithm", "improve the algorithm", "algorithm improvements", "fix the algorithm" | `Workflows/AlgorithmUpgrade.md` |
| **AlgorithmFlip** | "flip algorithm", "switch algorithm version", "activate algorithm vX.Y.Z", "point to algorithm vX.Y.Z", "cut over algorithm" | `Workflows/AlgorithmFlip.md` |
| **ResearchUpgrade** | "research this upgrade", "deep dive on [feature]", "further research" | `Workflows/ResearchUpgrade.md` |
| **FindSources** | "find upgrade sources", "find new sources", "discover channels" | `Workflows/FindSources.md` |
| **dos-upgrade-scan (native)** | "run the upgrade scan", "dos upgrade scan", "deterministic upgrade scan" | `Workflows/dos-upgrade-scan.workflow.js` — invoke via `Workflow({ name: "dos-upgrade-scan", args: { date: "YYYY-MM-DD" } })` |

**Default workflow:** If user says "upgrade" or "check for upgrades" without specifics, run the **Upgrade** workflow. The Upgrade workflow automatically includes internal reflection mining as Thread 3.

---

## Primary Output Format

**Discoveries first. Recommendations second. Technique details third.**

The output has THREE major sections:
1. **Discoveries** — Everything found, ranked by interestingness, showing source and DOS relevance at a glance
2. **Recommendations** — What to actually integrate, organized by priority tier
3. **Technique Details** — Full extraction with code examples and implementation steps

```markdown
# DOS Upgrade Report
**Generated:** [timestamp]
**Sources Processed:** [N] release notes parsed | [N] videos checked | [N] docs analyzed | [N] GitHub queries run
**Findings:** [N] techniques extracted | [N] content items skipped

---

## ✨ Discoveries

Everything interesting we found, ranked by how compelling it is for DOS. This is the "what's out there" overview.

| # | Discovery | Source | Why It's Interesting | DOS Relevance |
|---|-----------|--------|---------------------|---------------|
| 1 | [Name of thing found] | [GitHub release / YouTube video / Docs / Blog] | [1-2 sentences: what makes this cool or notable] | [1 sentence: how it maps to DOS] |
| 2 | ... | ... | ... | ... |
| ... | ... | ... | ... | ... |

**Ranking rule:** Sort by interestingness — the most "whoa, that's cool" discoveries go at the top. This is NOT the same as implementation priority (that's the Recommendations section below). A LOW-priority awareness item can still be the most interesting discovery.

---

## 🔥 Recommendations

What to actually DO with these discoveries, organized by urgency and impact.

### 🔴 CRITICAL — Integrate immediately

These fix gaps, security issues, or unlock capabilities that DOS should already have.

| # | Recommendation | DOS Relevance | Effort | Files Affected |
|---|---------------|---------------|--------|----------------|
| 1 | [Short action name] | [Why this matters for DOS — what gap it fills or what breaks without it] | [Low/Med/High] | `[file1]`, `[file2]` |

### 🟠 HIGH — Integrate this week

These significantly improve DOS's capabilities or efficiency.

| # | Recommendation | DOS Relevance | Effort | Files Affected |
|---|---------------|---------------|--------|----------------|
| 2 | [Short action name] | [Which DOS component improves and how] | [Low/Med/High] | `[file1]` |

### 🟡 MEDIUM — Integrate when convenient

These add useful capabilities or align DOS with ecosystem best practices.

| # | Recommendation | DOS Relevance | Effort | Files Affected |
|---|---------------|---------------|--------|----------------|
| 3 | [Short action name] | [What becomes possible for DOS] | [Low/Med/High] | `[file1]` |

### 🟢 LOW — Awareness / future reference

These are nice-to-know or will become relevant later.

| # | Recommendation | DOS Relevance | Effort | Files Affected |
|---|---------------|---------------|--------|----------------|
| 4 | [Short action name] | [Why to keep this on the radar] | [Low/Med/High] | `[file1]` |

---

## 🎯 Technique Details

Full extracted techniques for reference. Each recommendation above maps to one or more techniques below.

### From Release Notes

#### [N]. [Feature/Change Name]
**Source:** GitHub claude-code v2.1.16, commit abc123
**Priority:** 🔴 CRITICAL | 🟠 HIGH | 🟡 MEDIUM | 🟢 LOW

**What It Is (16-32 words):**
[Describe the technique itself - what it does, how it works, what capability it provides. Must be 16-32 words, concrete and specific.]

**How It Helps DOS (16-32 words):**
[Describe the specific benefit to our DOS system - which component improves, what gap it fills, what becomes possible. Must be 16-32 words.]

**The Technique:**
> [Exact code pattern, configuration, or approach - quoted or code-blocked]

**Applies To:** `hooks/SecurityValidator.hook.ts`, ISC verification
**Implementation:**
```typescript
// Before (what you have now)
[current pattern]

// After (with this technique)
[new pattern]
```

---

### From YouTube Videos

#### [N]. [Specific Technique Name]
**Source:** R Amjad - "Video Title" @ 12:34
**Priority:** 🔴 CRITICAL | 🟠 HIGH | 🟡 MEDIUM | 🟢 LOW

**What It Is (16-32 words):**
[Describe the technique itself]

**How It Helps DOS (16-32 words):**
[Describe the specific benefit]

**The Technique:**
> "[Exact quote or paraphrased technique from transcript]"

**Applies To:** Browser skill, delegation system
**Implementation:**
[Specific steps to apply this technique]

---

### From Documentation / Other Sources

#### [N]. [Specific Capability/Pattern]
**Source:** Claude Docs - Tool Use section, updated 2026-01-20
**Priority:** 🔴 CRITICAL | 🟠 HIGH | 🟡 MEDIUM | 🟢 LOW

**What It Is (16-32 words):**
[Describe the technique itself]

**How It Helps DOS (16-32 words):**
[Describe the specific benefit]

**The Technique:**
> [Exact documentation excerpt showing the capability]

**Applies To:** `DOS/SKILL.md`, agent spawning
**Implementation:**
[Specific changes needed]

---

## 📊 Summary

| # | Technique | Source | Priority | DOS Component | Effort |
|---|-----------|--------|----------|---------------|--------|
| 1 | [name] | [source] | 🔴/🟠/🟡/🟢 | [component] | Low/Med/High |

**Totals:** [N] Critical | [N] High | [N] Medium | [N] Low | [N] Skipped

---

## ⏭️ Skipped Content

| Content | Source | Why Skipped |
|---------|--------|-------------|
| [video/doc title] | [source] | [No extractable technique / Not relevant to DOS / Covers basics already implemented] |

---

## 🔍 Sources Processed

**Release Notes Parsed:**
- claude-code v2.1.14, v2.1.15, v2.1.16 → [N] techniques extracted
- MCP 2025-11-25 → [N] techniques extracted

**Videos Checked:**
- R Amjad: "Title" (23:45) → [N] techniques extracted
- AI Jason: "Title" (15:20) → 0 techniques (skipped: Gemini focus)

**Docs Analyzed:**
- Claude Tool Use docs → [N] techniques extracted
```

---

## Extraction Rules

**CRITICAL: Extract, don't summarize. Techniques, not recommendations.**

1. **Every output item must be a TECHNIQUE** - A specific pattern, code snippet, configuration, or approach
2. **Quote or code-block the actual content** - Show exactly what was said/written
3. **Map to DOS components** - Every technique must connect to a specific file, skill, workflow, or system component
4. **Two mandatory description fields (16-32 words each):**
   - **What It Is:** Describe the technique itself - what it does, how it works, what capability it provides
   - **How It Helps DOS:** Describe the specific benefit - which component improves, what gap it fills, what becomes possible
5. **Provide implementation** - Show before/after code or specific steps
6. **Skip, don't dilute** - If content has no extractable technique, put it in Skipped Content with reason

**Anti-patterns to AVOID:**
- ❌ "Check out this video for more"
- ❌ "This release has improvements"
- ❌ "Consider looking into this"
- ❌ Vague summaries without specific techniques
- ❌ Links without extracted content

**Source Type Labels:**
| Label | Meaning |
|-------|---------|
| `GitHub: claude-code vX.Y.Z` | Specific version release notes |
| `YouTube: Creator @ MM:SS` | Video with timestamp |
| `Docs: Section Name` | Documentation section |
| `Blog: Post Title` | Blog post |

---

## The Two-Thread Architecture

### Thread 1: User Context Analysis

**Purpose:** Deeply understand the user to personalize recommendations.

Launch **parallel agents** to analyze:

| Agent | Focus | Sources |
|-------|-------|---------|
| **TELOS Agent** | User's goals, challenges, current focus | `~/.durante/user/TELOS/*.md` (11 files: core-5 + extensions-6 per PRD-3a) |
| **Project Agent** | Active projects, tech stacks, dependencies | `~/.durante/user/TELOS/projects.md`, recent work context |
| **History Agent** | Recent work patterns, what's been done | `MEMORY/WORK/`, `MEMORY/STATE/current-work.json` |
| **DOS State Agent** | System capabilities, installed skills, gaps | `skills/`, `hooks/`, `settings.json` |

**Output:** A context object that includes:
- User's current focus areas and priorities
- Active projects and their tech stacks
- Recent work patterns and themes
- DOS system state and existing capabilities

### Thread 2: Source Collection

**Purpose:** Discover what's new in the ecosystem.

Launch **parallel agents** to check:

| Agent | Focus | Sources |
|-------|-------|---------|
| **Anthropic Agent** | Official Anthropic updates | `Tools/Anthropic.ts` (24 sources) |
| **YouTube Agent** | Configured channels for new videos | USER customization channels |
| **Custom Source Agent** | Any USER-defined additional sources | USER/SKILLCUSTOMIZATIONS/DOSUpgrade/ |
| **GitHub Trending Agent** | Trending projects for DOS inspiration | `gh api search/repositories` via user-sources.json queries |

**Output:** A collection of discoveries:
- New features, releases, changes from Anthropic
- New videos with transcripts and key insights
- Updates from custom sources

---

## Process Flow

### Step 1: Launch Both Threads in Parallel

Using BACKGROUNDDELEGATION, spawn both analysis threads simultaneously:

```markdown
## Thread 1: User Context (4 parallel agents)

### Agent 1: TELOS Analysis
Read and analyze:
Core-5 (PRD-3a G1 — STATUS→updates 2026-05-27):
- ~/.durante/user/TELOS/telos.md
- ~/.durante/user/TELOS/goals.md
- ~/.durante/user/TELOS/projects.md
- ~/.durante/user/TELOS/challenges.md
- ~/.durante/user/TELOS/updates.md

Extensions-6 (PRD-3a G2 2026-05-27):
- ~/.durante/user/TELOS/mission.md
- ~/.durante/user/TELOS/beliefs.md
- ~/.durante/user/TELOS/frames.md
- ~/.durante/user/TELOS/narratives.md
- ~/.durante/user/TELOS/visions.md
- ~/.durante/user/TELOS/wisdom.md

Extract: Current focus, priorities, active goals, project themes

### Agent 2: Recent Work Analysis
Read and analyze:
- ~/.claude/MEMORY/STATE/current-work.json
- Recent MEMORY/WORK/ directories

Extract: What user has been working on, patterns, open tasks

### Agent 3: DOS System State
Analyze:
- ~/.claude/skills/ (installed skills)
- ~/.claude/hooks/ (active hooks)
- ~/.claude/settings.json (configuration)

Extract: Current capabilities, potential gaps, system health

### Agent 4: Tech Stack Context
From PROJECTS and recent work, identify:
- Languages and frameworks in use
- Deployment targets
- Integration points

---

## Thread 2: Source Collection (4 parallel agents)

### Agent 1: Anthropic Sources
Run: bun ~/.claude/skills/utilities/DOSUpgrade/Tools/Anthropic.ts
Check all 24 official sources for updates

### Agent 2: YouTube Channels
Check configured channels for new videos
Extract transcripts from new content

### Agent 3: Custom Sources
Check any USER-defined additional sources

### Agent 4: GitHub Trending
Check trending GitHub projects for DOS inspiration (`gh api search/repositories` via user-sources.json queries)
Track seen repos in State/github-trending.json
```

### Step 2: Synthesize Results

Once both threads complete:

1. **Merge context:** Combine user analysis into unified context object
2. **Filter discoveries:** Remove items that don't apply to user's stack/focus
3. **Score relevance:** Rate each discovery against user's TELOS and projects
4. **Prioritize:** Sort by (relevance to user × impact × ease)

### Step 3: Generate Recommendations

For each discovery that passes relevance filtering:

1. **Personalize:** Explain why this matters for THIS user specifically
2. **Contextualize:** Map to their projects, goals, and challenges
3. **Actionize:** Provide concrete implementation steps
4. **Estimate:** Rate effort relative to their experience level

### Step 4: Output Report

Generate the prioritized recommendations report (see format above).

---

## Configuration

**Skill Files:**
- `sources.json` - Anthropic sources config (24 sources)
- `youtube-channels.json` - Base YouTube channels (ships 6 pre-configured channels; extend via USER customization)
- `State/last-check.json` - Anthropic state
- `State/youtube-videos.json` - YouTube state
- `State/github-trending.json` - GitHub trending state (seen repos; runtime-created)

**User Customizations** (`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/DOSUpgrade/`):
- `EXTEND.yaml` - Extension manifest
- `youtube-channels.json` - User's personal YouTube channels
- Additional source definitions

---

## Tool Reference

| Tool | Purpose |
|------|---------|
| `Tools/Anthropic.ts` | Check Anthropic sources for updates |
| `Tools/FetchReflections.ts` | Pull algorithm reflections from Studio for MineReflections/AlgorithmUpgrade |

---

## Key Principles

1. **Extract, Don't Summarize:** Pull specific techniques from content, never just link to sources
2. **Quote the Source:** Show actual code, documentation quotes, or transcript excerpts
3. **DOS-Contextualized:** Every technique maps to a specific DOS file, skill, or component
4. **Explain "Why You":** Use phrases like "This helps because your [X] currently [Y]"
5. **TELOS-Connected:** Reference user's goals and challenges when explaining relevance
6. **Skip Boldly:** If content has no extractable technique, skip it entirely
7. **Implementation-Ready:** Provide actual code changes, not vague recommendations

---

## Examples

**Example 1: Standard upgrade check**
```
User: "check for upgrades"
→ Launch Thread 1 (4 agents analyzing user context)
→ Launch Thread 2 (4 agents checking sources)
→ Wait for both threads
→ Synthesize into prioritized recommendations
→ Output personalized upgrade report
```

**Example 2: Quick Anthropic-only check**
```
User: "check Anthropic only"
→ Run Anthropic.ts tool directly
→ Use cached user context from recent session
→ Quick-match against user focus areas
→ Output filtered recommendations
```

---

## Workflows

- **Upgrade.md** - Primary workflow: full two-thread analysis with prioritized recommendations
- **ResearchUpgrade.md** - Deep dive on a specific upgrade opportunity
- **FindSources.md** - Discover and evaluate new sources to monitor
- **MineReflections.md** - Mine algorithm reflections for recurring upgrade patterns
- **AlgorithmUpgrade.md** - Propose contents for a new Algorithm version from reflections and specs
- **AlgorithmFlip.md** - Flip the active Algorithm version pointer across the four-copy universe
- **dos-upgrade-scan.workflow.js** - Native dynamic workflow (RFC-0121): gather fan-out → deterministic merge/score/tier → report. Deployed immutably to `~/.claude/workflows/dos-upgrade-scan.js`. This is the CANONICAL scoring implementation — Upgrade.md Steps 5-6 prose mirrors it.

---

---

## Anti-Patterns (What NOT to Output)

These output patterns are **FAILURES**. If you produce these, you have not completed the skill correctly:

| ❌ Bad Output | Why It's Wrong | ✅ Correct Output |
|---------------|----------------|-------------------|
| "Check out R Amjad's video on Claude Code" | Points to content instead of extracting it | "@ 5:42, R Amjad shows this technique: [quote]" |
| "v2.1.16 has task management improvements" | Vague summary, no technique | "v2.1.16 adds `addBlockedBy` parameter: [code example]" |
| "Consider looking into MCP updates" | Recommendation without extraction | "MCP now supports [specific feature]: [docs quote]" |
| "This could be useful for your workflows" | Vague relevance | "This improves your Browser skill because [specific gap it fills]" |
| "Several videos covered AI agents" | Count without content | "[N] videos skipped - no extractable techniques" |
| "This helps because it improves things" | Vague benefit, no word count | "How It Helps DOS (16-32 words): Our SecurityValidator currently only blocks commands. This technique enables injecting reasoning context before tool execution, making security decisions more nuanced." |
| "A new hook feature" | No description of what it IS | "What It Is (16-32 words): PreToolUse hooks can return additionalContext that gets injected into the model's context before execution, enabling reasoning-based decisions rather than binary blocks." |
| "Top 3 Actions" or flat recommendation list | No priority tiers — everything looks equally important | Recommendations section with 🔴 CRITICAL / 🟠 HIGH / 🟡 MEDIUM / 🟢 LOW tiers, each with DOS Relevance column |
| Recommendations at the bottom of the report | Actionable items buried after technique dump | 🔥 Recommendations section appears FIRST, technique details are reference material below |

**The test:** If you can say "show me the technique" and there's nothing to show, you've failed.

**Word count test:** Each "What It Is" and "How It Helps DOS" field MUST be 16-32 words. Count them. If under 16, add specificity. If over 32, condense.

---

**This skill embodies DOS's commitment to continuous, personalized improvement - understanding YOU first, then discovering what's new, then EXTRACTING the actual techniques that matter to your system.**
