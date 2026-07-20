<!--
Sub-doc lifted from upstream PAI ALGORITHM v6.3.0 / v6.2.0 (W-2.27/28/32/34 per MASTER_LIFT_MANIFEST.md §2.6).
Translated through DOS Anti-Corruption Layer 2026-05-04: PAI paths → DOS paths, {{DA_NAME}} → Durante, {{PRINCIPAL_NAME}} → Lucas, KNOWLEDGE/ → MemPalace/, Pulse → Studio, Forge/Anvil/Cato → Engineer-GPT/Engineer-Kimi/Auditor-GPT, ISA → PRD, IsaFormat → PRDFormat.
Loaded on demand by Algorithm v0.0.7.md.
-->

# Algorithm Capabilities Reference

Loaded by OBSERVE on demand during capability selection.

**Vocabulary truth (ADR gen-080, operator-signed 2026-07-11):** rows tagged `(DORMANT)` have
zero invocation evidence across the PRD corpus and invocation ledgers (~91 days); rows tagged
`(UNVERIFIED-ON-HOST)` are upstream-lifted commands whose existence on this host is unverified;
`(INLINE-STEP — tracking-exempt)` marks doctrine steps structurally invisible to invocation
tracking. Tags are evidence labels, not removals — selecting a tagged capability remains valid
and clears the tag once evidence accrues. Census: `tailor/tools/weave-census.ts`.

## Thinking & Analysis Capabilities

Use these to enrich understanding BEFORE or DURING ISC writing. Select in the pre-ISC capability scan.

**Typical Cost column** (renamed from "Tier Fit" in Algorithm v5.0.0): the lowest effort tier at which this capability typically fits the budget. Pure information — not a restriction. The model decides per-task whether the capability is worth its cost given the tier time budget. At E1/E2, capabilities marked E3+ usually blow the budget; at E5 anything fits.

| Capability | Phases | Trigger Signal | Invoke | Typical Cost |
|------------|--------|----------------|--------|----------|
| IterativeDepth | OBSERVE | **Default at Extended+** when time budget allows deeper understanding; any important task where exploring the full problem space before ISC improves outcome; understanding what's actually being asked vs what was literally said; exploring different approach angles before committing; ambiguous scope, multi-faceted problems, hidden assumptions | `Skill("IterativeDepth")` | E2+ |
| ApertureOscillation (DORMANT) | OBSERVE, THINK | Building something specific within a larger system; architecture decisions where scope framing changes the answer; feature design where tactical and strategic views may diverge; system coherence checks; scope negotiation. Complementary to IterativeDepth — ID rotates lenses, AO oscillates scope. Use AO when two distinct zoom levels (tactical target + strategic context) exist. | `Skill("ApertureOscillation")` | E3+ |
| FeedbackMemoryConsult (DORMANT) | PLAN | **First step of PLAN at Extended+.** Before committing to approach, grep `~/.claude/projects/${HARNESS_USER_DIR}/memory/feedback_*.md` by task keywords. Prevents repeating mistakes already documented. Turns the memory system from write-only diary into active guardrail. | `Bash('rg -l "KEYWORDS" ~/.claude/projects/${HARNESS_USER_DIR}/memory/feedback_*.md')` | E2+ |
| Advisor | VERIFY | **When genuinely STUCK at a commitment boundary — two+ approaches tried or an irreconcilable trade-off — on multi-step PRDs.** (Retuned per ADR gen-080(c): every routine commitment-boundary proposal in the tracked ledger was declined; XHigh/Comprehensive tiers already AUTO-include per TierConfig, so this row governs discretionary selection only.) If empirical results contradict advisor, re-call surfacing the conflict — do NOT silently switch. | `bun ~/.claude/DOS/TOOLS/Inference.ts --mode advisor <task> <state> <question>` | E3+ |
| ReReadCheck (INLINE-STEP — tracking-exempt) | VERIFY→LEARN boundary | **Final gate before emitting response (v3.29 RR1).** Re-read user's last message verbatim; enumerate every explicit ask against what shipped; block `phase: complete` on any `✗`. Targets the 82% "missed ask" complaint cluster. MANDATORY at every tier — at E1 single-part it's a one-line block. No fast-path exemption. | *(inline doctrine step — no external tool)* | E1+ |
| FirstPrinciples | THINK | Architecture decisions, inherited assumptions, stuck on approach | `Skill("FirstPrinciples")` | E2+ |
| SystemsThinking | OBSERVE, THINK | Recurring problems, structural causes, feedback loops, unintended consequences, "why does this keep happening?" Iceberg model, causal loop diagrams, Senge archetypes, Meadows' 12 leverage points | `Skill("SystemsThinking")` | E3+ |
| RootCauseAnalysis (DORMANT) | THINK, VERIFY | Incident postmortems, defect investigation, "why did this happen?" 5 Whys, Fishbone, Fault Tree, Kepner-Tregoe IS/IS-NOT, blameless postmortems. Produces contributing factors (plural), not single root. | `Skill("RootCauseAnalysis")` | E3+ |
| Council | THINK, PLAN | Multi-perspective decision, trade-offs, controversial direction | `Skill("Council")` | E4+ |
| RedTeam | THINK, VERIFY | Strategy validation, stress-test plan, attack assumptions | `Skill("RedTeam")` | E4+ |
| Science (DORMANT) | THINK→EXECUTE | Debugging hypothesis, systematic investigation, optimization | `Skill("Science")` | E3+ |
| BeCreative (DORMANT) | OBSERVE, BUILD | Novel approaches needed, brainstorming, divergent thinking | `Skill("BeCreative")` | E2+ |
| Ideate (DORMANT) | BUILD, EXECUTE | Multi-cycle idea generation, evolutionary ideation | `Skill("Ideate")` | E4+ |
| BitterPillEngineering (DORMANT) | VERIFY | Audit for over-engineering, dead weight, fragile scaffolding | `Skill("BitterPillEngineering")` | E3+ |
| Evals (DORMANT) | VERIFY | Objective measurement, prompt comparison, quality scoring | `Skill("Evals")` | E4+ |
| WorldThreatModel (DORMANT) | THINK | Long-term strategy stress-test, future-proofing | `Skill("WorldThreatModel")` | E5 |
| Fabric patterns (DORMANT) | any | Targeted transform via a specific Fabric pattern (extract_wisdom, summarize, etc.) | `Skill("Fabric")` | E1+ |
| context-search | OBSERVE | Prior PAI work, session recovery, cold-start | `Skill("context-search")` | E1+ |
| **PRD Skill** | **OBSERVE, PLAN, EXECUTE, VERIFY, LEARN** | **MANDATORY at E2+ for PRD scaffolding (`Skill("prd", "scaffold from prompt at tier T")`), tier completeness checks (`Skill("prd", "check completeness")`), ephemeral feature extraction at PLAN, canonical Decisions/Changelog/Verification entries via Append at any phase, and Reconcile after ephemeral feature work at LEARN. E1 may inline-write the minimal Goal+Criteria PRD to preserve <90s budget. The skill owns the canonical twelve-section template and refuses to write partial Deutsch C/R/L Changelog entries.** | `Skill("prd", "<verb> <args>")` | E1+ |

## Code Quality Capabilities

Use after code changes or before PR creation.

| Capability | When | Invoke |
|------------|------|--------|
| **Forge (code producer — DORMANT)** | **Available at E3/E4/E5 for coding tasks (implement, refactor, debug, build) — softened from MANDATORY per ADR gen-080 (zero invocations in the tracked window). Also invoke whenever the principal names "Forge" at any tier. OpenAI-family coder — GPT-5.4 via `codex exec` at `model_reasoning_effort=high`. Specialization: quality + completeness. Distinct from Engineer (Claude-family) and Cato (auditor, read-only). DO NOT invoke at E1/E2 — cost/latency prohibitive.** | `Agent(subagent_type="Forge", prompt="...")` |
| **Anvil (Kimi K2.6 code producer — DORMANT)** | **Sibling to Forge, Moonshot-family (same ADR gen-080 evidence label).** Runs `kimi-k2.6` (reasoning model, Moonshot enforces temperature=1) via `DOS/Tools/AnvilProgress.ts` with Moonshot's 256K context. Pick Anvil over Forge when the task benefits from whole-project context breadth — cross-file refactors, architecture-fitting changes, long-range reasoning. Always invoke when the principal names "Anvil" (name-match overrides tier gate). At E3/E4/E5, Forge remains the default producer; Anvil is chosen instead of or in parallel with Forge. Skip at E1/E2 unless the principal named him. | `Agent(subagent_type="Anvil", prompt="...")` |
| /batch | 3+ files with similar changes a deterministic tool (sed/regex/codemod) cannot express — mechanical substitutions are pre-declined (ADR gen-080(c)) | `Skill("batch", "instruction")` |
| /code-review | After code changes (renamed from /simplify, Claude Code v2.1.146) | `Skill("code-review", "high")` |
| /pr-review-toolkit:review-pr (UNVERIFIED-ON-HOST) | Targeted PR aspect review | `Skill("pr-review-toolkit:review-pr")` |
| /codex:review (UNVERIFIED-ON-HOST) | Complex code review needing second-model perspective | `Skill("codex:review")` |
| /codex:adversarial-review (UNVERIFIED-ON-HOST) | Challenge design decisions, question approach and tradeoffs | `Skill("codex:adversarial-review")` |
| **QATester** | **MANDATORY (Status: ACTIVE-gated) at VERIFY when BUILD/EXECUTE produced UI-surface changes — see v0.0.10 Amendment H §H.1 trigger surface (.tsx / page.tsx / layout.tsx / route.ts / actions/* / *Form.tsx / explicit URL). Browser-runtime validation via the browser-automation skill; evidence-based PASS/FAIL with screenshots. Spawn one Task per URL/flow (multi-URL pattern parallel). Subject to MAX_RECURSION:2 per Subagent Algorithm Profile.** | `Task(subagent_type="QATester", prompt="Validate <URL> for <flow list cited from PRD ISCs>")` |

### Forge auto-include binding (E3-E5 coding tasks)

**Status (ADR gen-080): SOFTENED — auto-include is available, not mandatory; explicit-name override unchanged.**

**Trigger:** PRD `effort` is `advanced`, `deep`, or `comprehensive` AND the task involves writing or modifying code (implementation, refactor, debug, build, migration, fix, feature).

**Behavior:** At PLAN phase, add Forge to `🏹 CAPABILITIES SELECTED` with target phase EXECUTE. At EXECUTE, spawn Forge via `Agent(subagent_type="Forge", ...)`. Forge's report becomes part of the VERIFY bundle.

**Explicit-name override:** If the principal mentions "Forge" in the request, invoke regardless of tier (even E1/E2). Name-match always wins over tier gate.

**Parallel with Engineer:** At E4/E5 where duplicate perspectives earn their cost, Forge and Engineer may both be spawned on the same task for cross-vendor code production. Each works in its own worktree; Durante merges or picks the stronger diff in VERIFY.

**What this gate prevents:** E3+ coding work silently routed through Claude-family only, repeating the same-family blind spot pattern that Cato addresses on the review side.

### Anvil invocation binding (E3-E5 long-context coding tasks)

**Status (ADR gen-080): SOFTENED — same as Forge; explicit-name override unchanged.**

**Trigger:** PRD `effort` is `advanced`, `deep`, or `comprehensive` AND the task involves whole-project or cross-file reasoning where context breadth materially affects correctness (architecture-fitting refactors, system-wide migrations, multi-module redesigns).

**Behavior:** At PLAN phase, add Anvil to `🏹 CAPABILITIES SELECTED` with target phase EXECUTE. At EXECUTE, spawn Anvil via `Agent(subagent_type="Anvil", ...)`. Anvil's report becomes part of the VERIFY bundle.

**Picking Forge vs Anvil (both Moonshot-family and OpenAI-family are non-Anthropic, which satisfies the cross-vendor goal):**

- **Forge (GPT-5.4, codex exec):** localized completion speed, quality/completeness focus. Default producer at E3/E4/E5. Pick when the change is bounded to a small surface and the verification bar is "every branch is real."
- **Anvil (Kimi K2.6, Moonshot API):** long-context breadth, project-shape focus. Pick when the correctness depends on the surrounding architecture more than the local code — "does this fit" is the dominant question.
- **Parallel both:** at E4/E5 on the hardest work, Durante may spawn Forge AND Anvil on the same task in isolated worktrees, then pick the stronger diff in VERIFY. Cross-vendor cross-coder diversity compounds.

**Explicit-name override:** If the principal mentions "Anvil" in the request, invoke regardless of tier (even E1/E2). Name-match always wins.

## Delegation & Infrastructure Capabilities

Use for parallel workstreams and non-blocking execution.

| Capability | When | Invoke |
|------------|------|--------|
| Agent Teams | **DEFAULT for parallel work.** 2+ agents on related work, task dependencies, coordination needed. Teammates persist, self-claim tasks, message peers. | `TeamCreate` + `Agent` with `team_name` |
| Custom Agents | **ONLY when the principal says "custom agents".** Unique personalities, voices, trait composition. One-shot parallel work. | `Skill("agents")` → ComposeAgent → `Agent` |
| Managed Agents | **Unattended/overnight work.** Hours-long tasks, survive disconnects, sandboxed cloud execution, CI triggers. $0.08/session-hour + tokens. | `Skill("claude-api")` to build workflows |
| Delegation | 3+ independent workstreams (routes to above) | `Skill("Delegation")` |
| Worktree Isolation | Parallel write-agents on overlapping files | `Agent` with `isolation: "worktree"` |
| Background Agents | Non-blocking research or verification | `Agent` with `run_in_background: true` |
| Observer Team | **ONLY when time is not a constraint AND auditability is the primary requirement.** 3-agent read-only swarm watches `tool-activity.jsonl` (ground-truth audit log), votes continue/halt/escalate every 30s. Deliberate speed-for-safety trade — not for interactive work. Fit: overnight autonomous runs, production deploys needing post-hoc review, credential rotation, security-hook edits. | `Skill("agents")` → `SPAWNOBSERVERS` workflow |
| Monitor | Event-driven waiting: logs, deploys, CI, file changes | `Monitor` tool — each stdout line wakes the agent |
| Mass Parallelism | Large migrations, bulk refactors across many files | `/batch` — interviews, then fans out to N worktree agents |
| Session Branching | Exploratory tangents, try alternative approaches | `/branch` — forks conversation, preserves original |
| /codex:rescue | Delegate bug investigation or fix to Codex (runs as background task) | `Skill("codex:rescue")` |

## Research & Intelligence Capabilities

Use when external information is needed.

| Capability | When | Invoke |
|------------|------|--------|
| research | External context, multi-source investigation | `Skill("research")` |
| context-search | Prior PAI work, session recovery | `Skill("context-search")` |
| Claude Code Guide | Claude Code internals, hooks, settings | `Agent(subagent_type="claude-code-guide")` |

## Agent Routing (Preference Order)

| Priority | User says | System | Invoke |
|----------|-----------|--------|--------|
| **1. DEFAULT** | "parallel work", "agents", "team", "swarm", or Algorithm selects delegation | **Agent Teams** — persistent teammates, shared task list, peer messaging | `TeamCreate` + `Agent` with `team_name` |
| **2. EXPLICIT** | "custom agents", "spin up custom agents" | **Custom Agents** — unique personalities, voices, trait composition | `Skill("agents")` → ComposeAgent |
| **3. UNATTENDED** | "run overnight", "long-running", "CI", or task exceeds session lifetime | **Managed Agents** — durable cloud sessions, sandboxed, vault credentials | `Skill("claude-api")` to build |
| **4. INTERNAL** | (Algorithm internal routing, user names a type) | **Built-in types** (Designer, Architect, Engineer, Explore, etc.) | `Agent(subagent_type="...")` |

## Binding Commitment

Selecting a capability = binding commitment to invoke it via tool. If you realize mid-execution it's unneeded, remove it from the list with a reason.

## Proactive Skill Scan

The tables above cover the most commonly applicable capabilities. For domain-specific tasks, also check the system prompt skill list for specialized skills (e.g., a blogging skill for blog work, a security-assessment skill for pentest work, Art for visual content). Match skill triggers to the current task domain.

## Codex Operations

Codex commands run GPT-5.3-Codex as a second model for review or delegation. Management commands:
- `/codex:status` — check progress of background Codex tasks
- `/codex:result` — retrieve completed Codex output
- `/codex:cancel` — terminate active Codex tasks

## Agent Composition Guidelines

When spawning agents: provide raw source material not summaries, parallelize independent threads, use background agents for non-blocking work, don't duplicate work agents are already doing.

## Output Format

```
🏹 CAPABILITIES SELECTED:
 🏹 [Each capability, target phase, 8-word reason, use as many appropriate Capabilities as possible given the amount of time you have]
🏹 [12-24 words on selection rationale]
```
