# Round Structure

How council debates progress through rounds.

## Pre-Round Brief (NEW 2026-05-15 — D22 inline-context bundle adoption)

Per Algorithm v0.0.8 §6.4 Pre-Delegation Contract item #6 + v0.0.10 reinforcement: every Council specialist spawn prompt MUST include an **inline context bundle** before Round 1 dispatches. The bundle eliminates the re-discovery tax where each specialist reads the same files separately, and ensures specialist quotes anchor to the same primary source the operator pointed at.

**Inline context bundle (per spawn prompt):**

1. **Subject / decision** — verbatim text from the operator's prompt (no paraphrase). 1-3 sentences.
2. **Primary sources** — absolute paths to the files most-load-bearing for this debate, with 1-line "this file establishes X" annotations. EXAMPLES: `~/Durante/Plans/Specs/RFC-XXXX.md (the contested spec)`, `~/Durante/CLAUDE.md §<section> (the canonical pattern this debate touches)`, `~/.claude/DOS/Algorithm/v0.0.10.md §<n> (the doctrine surface affected)`.
3. **Specialist scope guard** — 1 sentence reminding the specialist of when to step aside per their pack's stance (Cockburn step-aside, Fowler step-aside, etc. — each pack already declares this).
4. **Round task** — exactly what this specialist is being asked to produce in this round.

Skip silently when the council is convened on a topic with no file primary sources (e.g., pure strategic deliberation with no codebase anchor).

[D22-inline-context-bundle-2026-05-15 — 28D sprint audit; MakerkitTeam + FastAPIStarterTeam already adopt the pattern; Council did not.]

## Three-Round Debate Structure

### Round 1 - Initial Positions

Each agent gives their take from their specialized perspective. No interaction yet - just establishing positions. Round 1 spawn prompts include the **Pre-Round Brief inline context bundle** (above).

**Goal:** Surface diverse viewpoints before interaction.

### Round 2 - Responses & Challenges

Each agent reads Round 1 transcript and responds to specific points:
- "I disagree with Architect's point about X because..."
- "Building on Designer's concern about Y..."

**Goal:** Genuine intellectual friction through direct engagement.

### Round 3 - Synthesis & Convergence

Each agent identifies:
- Where the council agrees
- Where they still disagree
- Their final recommendation given the full discussion

**Goal:** Surface convergence and remaining tensions honestly.

## The Value Is In Interaction

Not just collecting opinions - genuine challenges where:
- Architect challenges designer's assumption
- Engineer points out implementation cost
- Researcher cites precedent that changes framing
- Designer defends with user impact data

## Timing

| Phase | Duration | Parallelism |
|-------|----------|-------------|
| Round 1 | 10-20 sec | All agents parallel |
| Round 2 | 10-20 sec | All agents parallel |
| Round 3 | 10-20 sec | All agents parallel |
| Synthesis | 5 sec | Sequential |

**Total: 30-90 seconds for full debate**
