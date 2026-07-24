---
name: MakerkitTeamSpawn
status: STABLE
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Team-spawn substrate maps orchestration primitives and sync-check requirements, not CLI mode flags"
---

# Algorithm + Team Spawn (binding)

Shared substrate for every multi-agent MakerkitTeam workflow phase. Defines a DEGRADATION LADDER: pick the strongest parallel-execution rung the running harness actually supports, probe first, never hard-depend on primitives that may not exist.

**Source of truth:**
- `~/.claude/DOS/Algorithm/LATEST` resolves to the active doctrine (currently `v0.0.10.md`). §6.3 PARALLELISM PRE-CHECK and §6.4 Pre-Delegation Contract apply at every rung.
- `~/.claude/DOS/Algorithm/sub-docs/dag-playbook.md` (8-step canonical pattern)
- **The harness capability manifest wins over doctrine prose.** Doctrine describes team primitives; the manifest says whether this harness has them.

This partial is the kit-native adaptation. The 8-step playbook is canonical; everything below is the delta for MakerkitTeam's composed-agent roster.

## Phase 0 — Capability probe (run at every workflow start)

Before any spawn decision, obtain the capability manifest:

```bash
bun Tools/MakerkitCli.ts preflight
```

The manifest reports which orchestration primitives the running harness exposes (team primitives, Agent/Task fan-out, background execution). Cache it for the session; re-probe only if the tool surface changes. If `preflight` is unavailable, probe directly: does the tool surface include `TeamCreate` and team-addressed `SendMessage`? **Current harness ground truth: NO — there is no `TeamCreate`, and `Agent`'s `team_name` parameter is documented deprecated/ignored.**

## Intent-to-Flag Mapping

This partial's only CLI invocation is fixed by design — every workflow that composes `_algorithm-team-spawn.md` fires the identical capability-probe command at Phase 0, before any spawn decision; there is no operator-phrasing-driven variant.

| Command | Input Contract | When It Fires |
|---------|-----------------|----------------|
| `bun Tools/MakerkitCli.ts preflight` | flags: `[--kit-repo <p>] [--roster <p>] [--skills-dir <p>] [--doctrine <p>]` (no stdin) | Phase 0 of every composing workflow — obtains the capability manifest (team primitives, roster health, doctrine pointer) before selecting a degradation-ladder rung; cached for the session |

## The degradation ladder

| Rung | Mode | Precondition | Rendezvous |
|---|---|---|---|
| L1 | Team-parallel choreography | Manifest confirms team primitives (`TeamCreate` + team-addressed `SendMessage`) | Teammate `SendMessage` reports |
| L2 (DEFAULT) | Task/Agent fan-out | `Agent` tool available (always, today) | Structured returns or report files at `MEMORY/WORK/{slug}/reports/<role>.md` |
| L3 | Serial solo | Escape clause fires, or no fan-out primitive | Inline; document clause in PRD `## Decisions` |

Select the highest rung whose precondition holds. Never write a workflow step that only works on L1.

## When to parallelize (decision tree)

Apply at every multi-agent phase entry:

1. **Single agent for the phase?** → L3 solo. Document the single agent + brief inline. (Examples: PM solo Phase 1 of DeliverFeature; Architect solo Phase 2 of BugFix; QuickFix Phase 1.)
2. **Two-or-more parallel agents AND ≥2 independent file-zones?** → Parallel rung: L1 if the manifest confirms team primitives, else L2 fan-out. (Examples: DeliverFeature Phase 2/4/5/7; BugFix Phase 4; Refactor Phase 4; ReviewSinglePR Phase 2; ReviewOpenPRs Phase 4.)
3. **Sequential per-batch execution requiring isolation?** → L3 solo agents per batch. (Example: ExecuteOpenTodos batches — serial-by-design per its anti-goal "NEVER run batches in parallel".)
4. **Kit escape clause fires?** → L3 solo with reason in PRD `## Decisions`. The four canonical escape clauses from the playbook:
   - ≤3 files AND ≤6 ISCs
   - Shared mutable state precludes file-zone partition
   - Narrative coherence required across all edits
   - Single-file work with no logical sub-zones

## L2 (DEFAULT) — Agent fan-out template (kit-native)

In a **single message**, fire one `Agent` call per kit role. All in parallel; never sequential.

```typescript
[
  Agent({
    subagent_type: "general-purpose",
    name: "ux",
    model: "sonnet",
    run_in_background: true,
    prompt: <composed prompt — see Per-Stream Prompt Template below>
  }),
  Agent({
    subagent_type: "general-purpose",
    name: "ui",
    model: "sonnet",
    run_in_background: true,
    prompt: <composed prompt>
  }),
  Agent({
    subagent_type: "general-purpose",
    name: "architect",
    model: "sonnet",
    run_in_background: true,
    prompt: <composed prompt>
  })
]
```

**Why `subagent_type: "general-purpose"`:** MakerkitTeam roles are composed agents — system prompts loaded from `~/.claude/custom-agents/<slug>.md` (the saved compositions per `Data/Roster.json`). `general-purpose` accepts the composed prompt verbatim.

**Why `name`:** the role id from `Data/Roster.json` (`pm`, `sm`, `ux`, `ui`, `architect`, `frontend`, `backend`, `database`, `security`, `qa`, `e2e`, `devops`, `writer`). Names spawns and report files predictably.

**Why `model: "sonnet"`:** default per dag-playbook. Promote to `"opus"` only for the most strategic stream when the operator names it.

**Why `run_in_background: true`:** non-blocking where streams are parallel. Blocking spawns serialize the team and break parallelism. Serial-by-design steps omit it.

**Rendezvous:** each stream ends with EITHER a structured return (preferred when the harness surfaces subagent results to the orchestrator) OR a report file at `MEMORY/WORK/{slug}/reports/<role>.md`. The orchestrator collects all reports, then verifies (below).

## L1 (conditional) — Team choreography

Only when the manifest confirms team primitives. Same roster, same prompts; deltas:

- `TeamCreate({ team_name: "mkt-<workflow>-<phase>-<slug-shortid>", ... })` per parallel phase; add `team_name` to each `Agent` call.
- Rendezvous via teammate `SendMessage` reports instead of report files.
- After gate-pass, shut down: `SendMessage({ to: <role>, body: { type: "shutdown_request", reason: <one line> } })` per teammate in one message; wait for termination notifications; team dissolves at last exit.

Do NOT document workflow steps in L1 terms alone — every L1 step must state its L2 equivalent or defer to this partial.

## Per-stream prompt template (kit-native)

Each `Agent.prompt` is composed at spawn time from three sources:

1. **System prompt** — load from `~/.claude/custom-agents/<slug>.md` for the role id (e.g., `creative-content-expert-empathetic-explo` for `ux`). Brings the trait-composed voice + identity.
2. **Pre-Delegation Contract slice** — the agent's own row from the workflow's contract table (the agent owns these files; cannot touch others).
3. **MakerkitTeam stream wrapper** — see template below.

```markdown
You are kit role `<role-id>` (<role-name>) on the MakerkitTeam delivery team.
Phase: <phase-number> of <workflow-name>.

CONTEXT
<one paragraph on what this feature/PR is, why it exists, what phase you're contributing>

DELIVERY PRD: `<absolute-path-to-PRD>` — READ IT FIRST.
FRAMEWORK DIGEST: `~/.claude/skills/makerkit-team/FrameworkDigest.md` §<sections-relevant-to-your-role>
TEST PYRAMID GATE (binding for change-producing phases): `~/.claude/skills/makerkit-team/Workflows/_test-pyramid-gate.md`

YOUR ISCs (<count> total)
- ISC-<id>: <subject>
- ...

LOCKED DECISIONS
<any operator-locked or THINK-locked decisions that constrain your work>

FILE OWNERSHIP (yours — from Pre-Delegation Contract)
- <absolute path>
- ...

FORBIDDEN (other streams' zones)
- <other agents' zones>

AUTHORIZED MCP TOOLS
<rendered by Tools/BuildBrief.ts from Roster.json mcp_tools + Data/McpToolMap.json>

REFERENCE READING (mandatory before BUILD)
- <absolute paths to ground-truth files relevant to your contribution>

EXECUTION
1. Read the PRD + reference files
2. Apply your role's contribution per Pre-Delegation Contract
3. Mark each ISC complete in the PRD via Edit (one [ ] → [x] per ISC, update progress counter)
4. Report back: write `MEMORY/WORK/{slug}/reports/<role-id>.md` (or return the same content structured, if instructed) with per-ISC evidence (file:line citations), sample output, sync-check exit code, MCP tool calls made

CRITICAL
- chmod 755 on every new *.hook.ts and *.daemon.ts (per dag-playbook anti-pattern catalog)
- Run `bun ~/Durante/Tools/sync-check.ts --summary` after every multi-copy edit
- Voice notifications FORBIDDEN (subagent rule per active Algorithm doctrine §7.5)
- Stay in your file ownership zone — touching another stream's zone is a contract violation, not optimization

START NOW.
```

The orchestrator (you) composes this prompt per-role from the workflow's Pre-Delegation Contract table + the role's `mcp_tools` from `Data/Roster.json` + the role's saved composition. `Tools/BuildBrief.ts` already does most of this rendering — extend it when needed rather than inlining brief composition into the workflow.

## Rendezvous + integration

Each completed stream yields a report (structured return or `MEMORY/WORK/{slug}/reports/<role>.md`; `SendMessage` on L1) containing:

- Per-ISC evidence (file:line citations + before/after summary)
- **Absence-claim manifest (binding):** any negative/absence claim in the report ("no X found", "not implemented", "zero usages", "does not exist") MUST carry the mechanical check that produced it — tool + pattern + scope + match count (count-before-emit). An absence claim without its manifest is unverified by definition.
- Sample output / build artifacts
- `bun ~/Durante/Tools/sync-check.ts --summary` exit code
- MCP tool calls made (transcript-equivalent)

Orchestrator (you):

1. Collect stream reports as they land (background completions notify; poll report files for long tails).
2. Verify each report's claims via direct tool call (`Read` / `Bash`) per Algorithm §6.6 Critical Claim Cross-Check. **Reports containing absence claims WITHOUT a search manifest are REJECTED — re-spawn the worker quoting the absence-claim contract; never accept an unmanifested negative on trust** (Archer H14: prose 24/38 violations → contract 0/31).
3. Mark verified ISCs `[ ] → [x]` in the PRD.
4. Run the gate (e.g., G6 pyramid-complete check from `_test-pyramid-gate.md`).
5. On gate pass: proceed to next phase. On gate fail: route via the v0.1.0 ISC-failure remediation policy (re-spawn original implementer with surgical-fix constraint + 3-strike escalation).

## Non-response policy (binding)

A spawn that never reports must not stall the phase:

1. **Timeout per spawn:** set an expectation at spawn time — 10 min for read/analyze streams, 30 min for change-producing streams (scale up for large ISC counts; write the chosen budget in the phase log). A stream is NON-RESPONSIVE when its budget elapses with no structured return and no report file.
2. **Quorum rule (N-of-M):** classify each role at spawn as BLOCKING (its ISCs gate the phase) or ADVISORY. Proceed to verification when ALL BLOCKING roles have reported AND ≥ half of ADVISORY roles have. Missing advisory input is logged as a gap in the PRD, not a stall.
3. **Exactly one re-spawn:** a non-responsive BLOCKING role gets one re-spawn with the identical prompt plus "prior attempt did not report; produce the report file first, then continue". Never more than one.
4. **Operator escalation:** if the re-spawn also fails to report, STOP and raise `AskUserQuestion` with: which role, which ISCs are blocked, and the options (retry once more / reassign ISCs to another role / drop to L3 solo / abort phase). Do not silently absorb a blocking stream's work.

## Solo phases (escape-clause table)

Solo execution is correct — and required — for these phase shapes:

| Phase | Reason | Escape clause |
|---|---|---|
| DeliverFeature Phase 1 (PM scope) | Single-agent ISC authoring; narrative coherence | "Single-file work" |
| DeliverFeature Phase 3 (Database schema) | Always-runs by Coordination Policy #2; DB Engineer is the sole authority | "Single-file work" |
| DeliverFeature Phase 6a (QA Unit) | Per the Test Pyramid Gate; sequenced before 6b | "Single-zone within phase" |
| DeliverFeature Phase 6b (E2E) | Per the Test Pyramid Gate; sequenced after 6a | "Single-zone within phase" |
| DeliverFeature Phase 8 (SM Wrap) | Synthesis solo by design | "Single-file work" |
| BugFix Phase 1 (PM scope) | Single-agent scoping | "Single-file work" |
| BugFix Phase 2 (Architect diagnose) | Single-author root-cause analysis | "Narrative coherence" |
| BugFix Phase 3 (1 fix agent by ownership) | Surgical single-implementer | "Single-file work" |
| BugFix Phase 5 (SM postmortem) | Synthesis solo | "Single-file work" |
| QuickFix all phases | ≤2 files, ≤4 ISCs by definition | "≤3 files AND ≤6 ISCs" |
| Refactor Phase 1 (Architect plan) | Single-author plan | "Narrative coherence" |
| Refactor Phase 2 (QA test-first, conditional) | Single-author tests in invariant gaps | "Single-file work" |
| Refactor Phase 3 (1 implementer by ownership) | Surgical refactor | "Single-file work" |
| ExecuteOpenTodos all batches | "shared mutable state precludes partition" — one branch, one commit-stream | "Shared mutable state" |

Each solo phase logs the escape clause inline ("Solo execution per dag-playbook escape clause: <clause-name>") rather than reaching for fan-out ceremony.

## PARALLELISM PRE-CHECK at every workflow entry

Workflows MUST emit a `📐 PARALLELISM:` block at PLAN-equivalent entry per Algorithm §6.3:

1. **N≥3 mechanical-same?** → `/batch` for the mechanical phase (e.g., 3 components needing identical scaffolding)
2. **N≥2 independent workstreams?** → parallel rung per the ladder (L1 if manifest confirms team primitives, else L2 Agent fan-out)
3. **Concurrent with blocking I/O?** → batch reads, fan out MCP calls

Silence is unacceptable — explicit "no" with justification is required when the answer is no.

## Anti-patterns to catch (kit-flavored)

The dag-playbook anti-patterns apply, plus these kit-specific ones:

1. **Hard-depending on team primitives the harness may not expose** — never write `TeamCreate` / `team_name` into a workflow step without the manifest confirming L1. Default to L2 Agent fan-out.
2. **Forgetting to load the saved composition** — every kit role's identity lives in `~/.claude/custom-agents/<slug>.md`. Spawning a `general-purpose` agent without injecting the composition strips the role's voice + traits.
3. **Inlining the Pre-Delegation Contract per-stream** — the contract is one table in the PRD `## Context`; each stream gets a SLICE in its prompt, not the full table.
4. **Voice emission anywhere** — voice was retired platform-wide 2026-07-02. Neither orchestrator nor teammates emit voice; role identities are trait-derived prompts from `Data/Roster.json`.
5. **Skipping the stream report** — rendezvous closure is non-optional. Without a per-stream report (return, file, or L1 SendMessage), the orchestrator cannot verify ISCs and cannot run the gate.
6. **Stalling on a silent stream** — apply the Non-response policy (timeout → quorum → one re-spawn → AskUserQuestion). Waiting indefinitely is a contract violation.

## Cross-references

- **Active Algorithm doctrine §6.3** — PARALLELISM PRE-CHECK (the gate that triggers fan-out)
- **Active Algorithm doctrine §6.4** — Pre-Delegation Contract (5-field template)
- **dag-playbook.md** — 8-step canonical pattern (this partial is the kit-native delta)
- **`Tools/MakerkitCli.ts preflight`** — capability manifest consumed by Phase 0
- **`Data/Roster.json`** — role id → saved composition slug → traits → `mcp_tools` clusters
- **`Data/McpToolMap.json`** — cluster → tools (rendered into authorized-tools section by `Tools/BuildBrief.ts`)
- **`_test-pyramid-gate.md`** — the gate every change-producing workflow runs at G6 (Phase 6 of DeliverFeature; Phase 4 of BugFix/Refactor; Phase 2 of QuickFix)
- **`_pr-loop-shared.md`** — TODO checklist protocol used by ReviewOpenPRs / ReviewSinglePR / ExecuteOpenTodos
