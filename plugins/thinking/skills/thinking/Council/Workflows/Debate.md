---
name: Debate
description: 
status: STABLE
---

# Debate Workflow

Full structured multi-agent debate with 3 rounds and visible transcript.

## Tool-Use Budget (v0.0.4)

Council agents spawned by this workflow run the **Subagent Algorithm Profile** (`~/.claude/DOS/PARTIALS/_algorithm-lite.md`). Tool invocations do NOT count toward per-round word caps — prose only. When the topic references files on disk, RFC numbers, or verifiable facts, each agent MUST invoke ≥1 tool per round and ground load-bearing claims with file:line, quote, or tool output.

## Prerequisites

- Topic or question to debate
- Optional: Custom council members or trait overrides

## Member Recruitment — Persistent Specialists + Trait Composition

Council members come from TWO peer factories (see
`MEMORY/CANONICAL/specialist-directory.md` for the canonical list):

1. **Persistent specialists** (`~/.claude/agents/<Name>.md`) — spawn via
   `Task(subagent_type: <Name>)`. The agent file owns persona, voice prosody,
   permissions, Subagent Algorithm Profile. No prompt composition needed.
2. **Composed dynamic agents** — spawn via
   `Task(subagent_type: "general-purpose")` with the JSON prompt returned by
   `ComposeAgent.ts`. Used for ad-hoc roles where no persistent specialist
   captures the desired stance.

The single-command recruitment path is:

```bash
bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts --council <type> --task "..."
```

This reads `~/.claude/skills/agents/Tools/compose/councils.yaml` and returns a JSON array where each
member has a discriminator field:

- `"kind": "specialist"` + `"subagent_type": "<Name>"` → spawn via `Task(subagent_type: <Name>)`. The persistent agent file injects persona at spawn.
- `"kind": "composed"` + full `prompt`/`voice`/`voice_settings` → spawn via `Task(subagent_type: "general-purpose")` with the composed prompt.

**Council defaults (per `councils.yaml`):**

For **technical/architecture** topics (`--council technical`):
| Role | Source | Why |
|------|--------|-----|
| architect | persistent — `~/.claude/agents/Architect.md` (Serena Blackwood) | System design, distributed systems, long-term tradeoffs |
| engineer | persistent — `~/.claude/agents/Engineer.md` (Marcus Webb) | Implementation reality, tech debt, ship-pressure |
| Critic | composed — `[security, contrarian, investigative]` | Adversarial role; no persistent specialist captures the stance |
| Researcher | persistent — `~/.claude/agents/PerplexityResearcher.md` (Ava Chen) | Evidence chains, journalistic rigor |

For **product/strategy** topics:
| Role | Traits |
|------|--------|
| Strategist | `product,analytical,thorough` |
| Builder | `technical,pragmatic,rapid` |
| Challenger | `sales,contrarian,investigative` |
| Creative | `creative,enthusiastic,parallel` |

For **brand/content** topics:
| Role | Traits |
|------|--------|
| brand | `brand,analytical,thorough` |
| Creative | `creative,enthusiastic,parallel` |
| Critic | `product,contrarian,investigative` |
| Pragmatist | `sales,pragmatic,rapid` |

**Adapt to the topic.** A council debating sales strategy needs different expertise than one debating database schema. Choose traits that create genuine intellectual friction on the specific topic.

## Specialist Seat Composition (native subagent_type)

When the user names channeled specialists (Fowler, UncleBob, KentBeck, SandiMetz, EricEvans, GregYoung, Cockburn, Feathers, Pragmatic) as council members, recruit them as **native subagents** — each specialist has a first-class agent definition at `~/.claude/agents/{Specialist}.md` with full voice/persona/permissions wiring. See `CouncilMembers.md` § Specialist Seats for the full roster.

**MANDATORY pre-spawn gate (Tailor Gen 68 — recruitment names were previously fuzzy-matched
prose that could hand a hallucinated `subagent_type` straight to Task()):** validate EVERY
named seat before any spawn —

```bash
bun ~/.claude/skills/thinking/Council/Tools/ValidateSeatRecruitment.ts <Name> [<Name> ...] --json
```

Exit 0 = all names resolve against the live agent roster (derived from `~/.claude/agents/`,
never a hand-typed list) — use the returned canonical casings as the `subagent_type` values.
Exit 1 = at least one UNKNOWN: surface the tool's did-you-mean suggestion to the user and get
the corrected name; NEVER spawn an unvalidated name and never silently substitute a default.

**Per-seat spawn pattern (no parent-side prompt assembly):**

```ts
Task({
  subagent_type: "Fowler",   // or UncleBob / KentBeck / SandiMetz / EricEvans / GregYoung / Cockburn / Feathers / Pragmatic
  prompt: COUNCIL_DEBATE_ROUND_<N>_INSTRUCTIONS + transcript_so_far
})
```

The agent's startup-load pulls `SKILL.md` + `QuoteBank.md` + `Principles.md` + `StepAsideTable.md` from the specialist's pack automatically. Council passes only the debate context — no need to read persona files in the orchestrator. This is cleaner than the previous `general-purpose` + stuffed-prompt pattern and gives each specialist:

- **Voice prosody** (ElevenLabs voice ID matched to persona)
- **Persona archetype** (in YAML frontmatter for runtime introspection)
- **Permissions allowlist** (Bash, Read, Edit, mcp__*, etc. — full subagent stack)
- **Subagent Algorithm Profile** boilerplate (OBSERVE-lite, INVOCATION OBLIGATION)
- **Return Format labels** (load-bearing for `SubagentReturn.hook.ts` C1 conformance)

**StepAside check (optional, recommended):** Before recruiting a specialist, scan the topic against their `StepAsideTable.md` if you have local context. If the topic falls in their step-aside zone (e.g., asking GregYoung about CRUD MVPs), surface a one-line note (`⚠️ <Specialist> may step aside on this topic — recruit anyway? Y/proceed`) rather than spawning a forced seat. The spawned agent will also surface its step-aside in Round 1 if appropriate.

**Mixed councils:** Trait-composed seats (`subagent_type: "general-purpose"` + `ComposeAgent` JSON output as prompt) and specialist seats (`subagent_type: "<Specialist>"`) can coexist in the same debate. Round 2/3 transcript-passing concatenates output from both kinds verbatim — the specialist sees trait-agent positions and vice versa.

## Execution

### Step 1: Compose Agents and Announce the Council

1. Determine which seats best fit the debate topic — trait-composed, specialist, or mixed
2. For trait-composed seats: run `ComposeAgent` for each (parse JSON output)
3. For specialist seats: no parent-side prompt assembly needed — spawn directly via `subagent_type: "<Specialist>"` per § Specialist Seat Composition (the agent's startup loads its own persona files)
4. Output the debate header:

> **Operator nudge — reuse via `--save`:** If a trait composition lands well on this debate (clear verdict, useful angle, voice fits), pass `--save` on the next ComposeAgent call with the same `--traits` so the composition persists to `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Agents/saved/<slug>.json`. Reuse via `--load <slug>` instead of re-rolling next time. This converts one-off compositions into a personal NamedAgent over time.

```markdown
## Council Debate: [Topic]

**Council Members:** [List agents with their trait combos]
**Rounds:** 3 (Positions → Responses → Synthesis)
```

### Step 1b: Round 0 — Evidence Gathering (Conditional)

**Trigger:** Run this step ONLY when the motion contains at least one *external verifiable claim*. Skip silently when the debate is purely about internal codebase architecture / opinion / strategy with no external referents.

External verifiable claims include:

- **Named library / framework / SDK / API / CLI / cloud service** ("should we migrate from Prisma to Drizzle", "is Aurora DSQL viable for X") → Research's `DocsLookup` workflow (delegates to ref skill — credit-metered, 1 credit flat)
- **Statistics, dates, recent events** ("the AI compliance market is $10B by 2028", "Vercel raised $250M in 2024") → Research's `QuickResearch` workflow (1 Perplexity agent, ~10-15s)
- **Proper nouns outside the repo** (companies, products, people, published papers, public RFCs) → Research's `StandardResearch` workflow if multi-perspective needed

**Why:** Council specialists ship with **static QuoteBanks** (verified at pack-build time, not at debate-time). Their training-data recall on external facts can drift, and forced consensus on stale facts is worse than acknowledged uncertainty. Round 0 establishes a shared factual baseline that all seats see in Round 1.

**Execution:**

1. Decompose the motion into 1-N external verifiable sub-claims. For each, pick the matching Research workflow.
2. Spawn Research calls in parallel via the Task tool:

```ts
// Example — claim names a library
Task({
  subagent_type: "general-purpose",
  description: "Round 0 evidence — Prisma vs Drizzle docs",
  prompt: "Invoke the research skill, DocsLookup workflow. Query: 'Prisma transaction timeout option vs Drizzle equivalent'. Return: 1-3 verbatim doc excerpts with canonical URLs. Under 200 words."
})

// Example — claim names a statistic / market
Task({
  subagent_type: "general-purpose",
  description: "Round 0 evidence — AI compliance market sizing",
  prompt: "Invoke the research skill, QuickResearch workflow. Query: 'AI compliance market size 2028 forecast'. Return: top finding with citation + 2 alternative estimates with citations. Under 200 words."
})
```

3. Assemble returned evidence into an **Evidence Pack** rendered as part of the visible transcript:

```markdown
### Round 0: Evidence Pack

**Claim:** [verbatim sub-claim from the motion]
- **Finding:** [1-2 sentence factual answer from Research]
- **Source:** [canonical URL] ([library@version | publisher | date])
- **Caveats:** [version-specific, recently changed, contested — if applicable]

**Claim:** [next sub-claim]
- ...
```

4. **Cost guard:** Round 0 typically costs 1-3 Research calls. If the motion has >5 external sub-claims, ask the operator before fanning out further — `AskUserQuestion` with the decomposed list and a "research all / research top 3 / skip Round 0" choice.

5. **Failure handling:** If Research returns empty or errors for a claim, flag it as `⚠️ unverified` in the Evidence Pack and let the council debate it as such. Do NOT block the debate on missing evidence.

**When to skip Round 0 entirely:** motions like "should we extract this helper", "is this API design clean", "what's the right abstraction here" — pure internal taste/architecture calls with no external referents. Specialist QuoteBanks already cover these via doctrine.

### Step 2: Round 1 - Initial Positions

Launch parallel Agent calls (one per council member). Spawn type per seat:

- **Trait-composed seat:** `subagent_type: "general-purpose"` with the `prompt` field from `ComposeAgent` JSON output as the system prompt
- **Specialist seat:** `subagent_type: "<Specialist>"` (e.g. `Fowler`, `UncleBob`) — the agent's startup loads its own persona files

**Each spawned agent receives the debate instructions in its prompt:**
```
[ComposeAgent prompt field here]

COUNCIL DEBATE - ROUND 1: INITIAL POSITIONS

Topic: [The topic being debated]

Evidence Pack from Round 0 (if produced — verbatim Research findings the entire council shares as a factual baseline):
[Insert Round 0 Evidence Pack here, or "None — debate is on internal/taste matter with no external verifiable claims" if Round 0 was skipped]

Give your initial position on this topic from your specialized perspective.
- Speak in first person
- Be specific and substantive (150-250 words (prose only; tool output is free))
- Ground claims that touch the Evidence Pack against its findings; flag any disagreement with the evidence rather than restating training-data recall
- State your key concern, recommendation, or insight
- You'll respond to other council members in Round 2
```

**Output each response as it completes:**
```markdown
### Round 1: Initial Positions

**🏛️ Architect (Serena):**
[Response]

**🎨 Designer (Aditi):**
[Response]

**⚙️ Engineer (Marcus):**
[Response]

**🔍 Researcher (Ava):**
[Response]
```

### Step 3: Round 2 - Responses & Challenges

Launch 4 parallel Task calls with Round 1 transcript included. Spawn type per seat: SAME as
Round 1 (trait-composed → `general-purpose`; specialist → `subagent_type: "<Specialist>"`).

**Each agent prompt includes:**
```
[Persona anchor — same mechanism as Round 1: for a trait-composed seat, re-prepend the
IDENTICAL ComposeAgent `prompt` field used in Round 1 (each round is a fresh stateless spawn —
without it the composed persona is lost); for a specialist seat, omit this block entirely —
the agent's startup-load owns its persona.]

COUNCIL DEBATE - ROUND 2: RESPONSES & CHALLENGES

Topic: [The topic being debated]

Evidence Pack from Round 0 (factual baseline — same as Round 1):
[Insert Round 0 Evidence Pack here, or "None" if skipped]

Here's what the council said in Round 1:
[Full Round 1 transcript]

Now respond to the other council members:
- Reference specific points they made ("I disagree with [Name]'s point about X...")
- Challenge assumptions or add nuance
- Build on points you agree with
- Maintain your specialized perspective
- 150-250 words (prose only; tool output is free)

The value is in genuine intellectual friction—engage with their actual arguments.
```

**Output:**
```markdown
### Round 2: Responses & Challenges

**🏛️ Architect (Serena):**
[Response referencing others' points]

**🎨 Designer (Aditi):**
[Response referencing others' points]

**⚙️ Engineer (Marcus):**
[Response referencing others' points]

**🔍 Researcher (Ava):**
[Response referencing others' points]
```

### Step 4: Round 3 - Synthesis

Launch 4 parallel Task calls with Round 1 + Round 2 transcripts. Spawn type per seat: SAME as
Round 1 (trait-composed → `general-purpose`; specialist → `subagent_type: "<Specialist>"`).

**Each agent prompt includes:**
```
[Persona anchor — same mechanism as Round 1: trait-composed seat re-prepends the IDENTICAL
ComposeAgent `prompt` field; specialist seat omits this block (startup-load owns its persona).]

COUNCIL DEBATE - ROUND 3: SYNTHESIS

Topic: [The topic being debated]

Evidence Pack from Round 0 (factual baseline — same as Rounds 1 & 2):
[Insert Round 0 Evidence Pack here, or "None" if skipped]

Full debate transcript so far:
[Round 1 + Round 2 transcripts]

Final synthesis from your perspective:
- Where does the council agree?
- Where do you still disagree with others?
- What's your final recommendation given the full discussion?
- 150-250 words (prose only; tool output is free)

Be honest about remaining disagreements—forced consensus is worse than acknowledged tension.
```

**Output:**
```markdown
### Round 3: Synthesis

**🏛️ Architect (Serena):**
[Final synthesis]

**🎨 Designer (Aditi):**
[Final synthesis]

**⚙️ Engineer (Marcus):**
[Final synthesis]

**🔍 Researcher (Ava):**
[Final synthesis]
```

### Step 5: Council Synthesis (typed verdict + MANDATORY persistence — Tailor Gen 69)

After all rounds complete, produce the verdict as a **fenced JSON block with exactly this
shape** (mirrors the version-review council's CONVERGE_SCHEMA so downstream readers parse one
family of council verdicts), followed by the prose synthesis for the human reader:

```json
{
  "schema": 1,
  "topic": "<the debated question, one line>",
  "verdict": "converged | split | needs-evidence",
  "recommendation": "<the recommended path, 1-3 sentences>",
  "convergence": ["<point where 3+ seats agreed>"],
  "disagreements": [{"point": "<still contested>", "seats": ["<who>", "<vs whom>"]}],
  "evidence_cited": [{"claim": "<load-bearing Round-0 finding>", "url": "<canonical URL>", "verified": true}],
  "unverified_relied_upon": ["<claim the council leaned on without verification — empty when none>"],
  "dissents": [{"seat": "<name>", "dissent": "<one paragraph>"}],
  "seats": ["<every seat that participated, canonical names>"]
}
```

Rules: `verdict` and every seat name are load-bearing (seat names must match the validated
recruitment list from the pre-spawn gate); `unverified_relied_upon` empty-but-present keeps the
epistemic status honest; a seat's structured DISSENT block (Skeptic/Analyst/Hooks-Native seats
emit one) is copied into `dissents` verbatim, never summarized away.

**Then PERSIST the debate (mandatory — councils were previously vapor: no artifact, no
queryable record):** write the verdict JSON + the full transcript to
`MEMORY/ARTIFACTS/council/<YYYYMMDD>-<topic-slug>.md` (project-first via the standard MEMORY
resolution; the same caller convention the version-review council already uses on disk). Then
prose-summarize for the user as usual. ArtifactAutoLogger captures the write; no manual
artifacts.jsonl append needed.

## Custom Council Members

If user specifies custom members, adjust accordingly:

- "Council with security" → Add pentester agent
- "Council with intern" → Add intern agent (fresh perspective)
- "Council with writer" → Add writer agent (communication focus)
- "Council with Fowler, UncleBob, KentBeck on event sourcing" → Recruit each as a Specialist Seat (see § Specialist Seat Composition)
- Mixed: "Council with Architect, Engineer, and Fowler" → 2 trait-composed + 1 specialist seat
- Omit agents: "Just architect and engineer" → Only those two

## Agent Type Mapping

All council agents use `subagent_type: "general-purpose"` with trait-composed prompts. Legacy static types are still available as fallbacks.

| Council Role | Default Traits | Fallback subagent_type |
|--------------|---------------|----------------------|
| architect | `technical,analytical,thorough` | architect |
| designer | `creative,pragmatic,systematic` | designer |
| engineer | `technical,pragmatic,rapid` | engineer |
| Researcher | `research,investigative,systematic` | PerplexityResearcher |
| Critic | `security,contrarian,investigative` | Pentester |
| Writer | `creative,enthusiastic,thorough` | general-purpose |

## Timing

- Round 0 (Evidence — conditional): ~5-30 seconds (parallel Research calls; skip when no external claims)
- Round 1: ~10-20 seconds (parallel)
- Round 2: ~10-20 seconds (parallel)
- Round 3: ~10-20 seconds (parallel)
- Synthesis: ~5 seconds

**Total: 30-120 seconds for full debate (35-150s with Round 0)**

## Done

Debate complete. The transcript shows the full intellectual journey from initial positions through challenges to synthesis.
