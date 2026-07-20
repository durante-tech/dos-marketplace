---
name: FastAPITeamSpawn
status: STABLE
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Team-spawn substrate maps orchestration primitives and sync-check requirements, not CLI mode flags"
---

# Algorithm + Team Spawn (binding)

Shared substrate for every multi-agent FastAPIStarterTeam workflow phase. Codifies how starter-native composed agents map onto the DOS Algorithm's `TeamCreate` + `Agent(team_name: ...)` parallel-execution contract.

**Source of truth:**
- `~/.claude/DOS/Algorithm/v0.0.7-enhanced.md` §4.3 Platform Capabilities (Agent Teams) + §6.3 PARALLELISM PRE-CHECK + §6.4 Pre-Delegation Contract
- `~/.claude/DOS/Algorithm/sub-docs/dag-playbook.md` (8-step canonical pattern)

**Sibling:** `MakerkitTeam/Workflows/_algorithm-team-spawn.md` (kit-native equivalent). Same shape; this partial uses the `fst-` team_name prefix and the FastAPIStarterTeam roster IDs.

## Intent-to-Flag Mapping

| Operator intent | Command / flag pattern | Notes |
|---|---|---|
| "spawn the FastAPI starter team" | `TeamCreate({ team_name: "fst-<workflow>-<phase>-<slug-shortid>", ... })` | Creates one bounded team per parallel phase. |
| "spawn role streams" | `Agent({ team_name: "<team-name>", name: "<role-id>", run_in_background: true, ... })` | Fire all independent streams in one message. |
| "verify four-copy sync after edits" | `bun ~/Durante/Tools/sync-check.ts --summary` | Required after any multi-copy edit. |

## When to spawn a team (decision tree)

Apply at every multi-agent phase entry:

1. **Single agent for the phase?** → Solo. Skip TeamCreate. Document the single agent + brief inline. (Examples: PM solo Phase 1 of DeliverFeature; Architect solo Phase 2 of BugFix; QuickFix Phase 1.)
2. **Two-or-more parallel agents AND ≥2 independent file-zones?** → TeamCreate. Use the template below. (Examples: DeliverFeature Phase 2/4/5/7; BugFix Phase 4; Refactor Phase 4; ReviewSinglePR Phase 2; ReviewOpenPRs Phase 4.)
3. **Sequential per-batch execution requiring isolation?** → Solo agents per batch, NOT a team. (Example: ExecuteOpenTodos batches — serial-by-design per its anti-goal "NEVER run batches in parallel".)
4. **Starter escape clause fires?** → Solo with reason in PRD `## Decisions`. The four canonical escape clauses from the playbook:
   - ≤3 files AND ≤6 ISCs
   - Shared mutable state precludes file-zone partition (e.g., one Alembic migration touching multiple tables)
   - Narrative coherence required across all edits (e.g., one ADR + cross-cutting refactor)
   - Single-file work with no logical sub-zones

## TeamCreate template (starter-native)

```typescript
TeamCreate({
  team_name: "fst-<workflow>-<phase>-<slug-shortid>",
  description: "<N>-stream parallel <motion> for <feature/PR>",
  agent_type: "team-lead"
})
```

**`team_name` convention** (predictable + traceable):

| Workflow | Phase | Example team_name |
|---|---|---|
| DeliverFeature | 2 (Design) | `fst-deliver-phase2-webhook-receipts` |
| DeliverFeature | 4 (Implementation) | `fst-deliver-phase4-webhook-receipts` |
| DeliverFeature | 5 (Hardening) | `fst-deliver-phase5-webhook-receipts` |
| DeliverFeature | 7 (Ship) | `fst-deliver-phase7-webhook-receipts` |
| BugFix | 4 (TDD Verify) | `fst-bugfix-phase4-tz-arq` |
| Refactor | 4 (Verify) | `fst-refactor-phase4-extract-validators` |
| ReviewSinglePR | 2 (Full Team) | `fst-review-pr42` |
| ReviewOpenPRs | 4 (Per-PR) | `fst-fleet-pr42` (one per PR in the sweep) |

If a previous team is still leader: `TeamDelete()` first, then `TeamCreate`.

## Agent spawn template (starter-native)

In a **single message**, fire one `Agent` call per starter role. All in parallel; never sequential.

```typescript
[
  Agent({
    subagent_type: "general-purpose",
    team_name: "fst-deliver-phase2-webhook-receipts",
    name: "apidx",
    model: "sonnet",
    run_in_background: true,
    prompt: <composed prompt — see Per-Stream Prompt Template below>
  }),
  Agent({
    subagent_type: "general-purpose",
    team_name: "fst-deliver-phase2-webhook-receipts",
    name: "schema",
    model: "sonnet",
    run_in_background: true,
    prompt: <composed prompt>
  }),
  Agent({
    subagent_type: "general-purpose",
    team_name: "fst-deliver-phase2-webhook-receipts",
    name: "architect",
    model: "sonnet",
    run_in_background: true,
    prompt: <composed prompt>
  })
]
```

**Why `subagent_type: "general-purpose"`:** FastAPIStarterTeam roles are composed agents — system prompts loaded from `~/.claude/custom-agents/<slug>.md` (the saved compositions per `Data/Roster.json`). Claude Code's canonical specialized subagents don't carry the starter-native voice/trait composition. `general-purpose` accepts the composed prompt verbatim.

**Why `name`:** the role id from `Data/Roster.json` (`pm`, `sm`, `apidx`, `schema`, `architect`, `agent`, `backend`, `database`, `security`, `qa`, `e2e`, `devops`, `writer`). The orchestrator addresses teammates by `name` via `SendMessage`.

**Why `model: "sonnet"`:** default per dag-playbook. Promote to `"opus"` only for the most strategic stream when the operator names it.

**Why `run_in_background: true`:** non-blocking. The orchestrator gathers `SendMessage` reports as streams complete, then proceeds to the gate. Blocking spawns serialize the team and break parallelism.

## Per-stream prompt template (starter-native)

Each `Agent.prompt` is composed at spawn time from three sources:

1. **System prompt** — load from `~/.claude/custom-agents/<slug>.md` for the role id (e.g., `creative-content-expert-empathetic-explo` for `apidx`). Brings the trait-composed voice + identity.
2. **Pre-Delegation Contract slice** — the agent's own row from the workflow's contract table (the agent owns these files; cannot touch others).
3. **FastAPIStarterTeam stream wrapper** — see template below.

```markdown
You are starter role `<role-id>` (<role-name>) on the FastAPIStarterTeam delivery team.
Team name: <team-name>.
Phase: <phase-number> of <workflow-name>.

CONTEXT
<one paragraph on what this feature/PR is, why it exists, what phase you're contributing>

DELIVERY PRD: `<absolute-path-to-PRD>` — READ IT FIRST.
FRAMEWORK DIGEST: `~/.claude/skills/fastapi-starter-team/FrameworkDigest.md` §<sections-relevant-to-your-role>
TEST PYRAMID GATE (binding for change-producing phases): `~/.claude/skills/fastapi-starter-team/Workflows/_test-pyramid-gate.md`
HARD RULES: `~/Developer/dos-fastapi-starter/AGENTS.md` (10 rules — particularly #2 never return ORM models, #4 async-everywhere, #6 soft-import optional deps, #8 no emojis)

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
4. SendMessage <team-lead> with: per-ISC evidence (file:line citations), sample output, sync-check exit code, MCP tool calls made

CRITICAL
- Async-everywhere — no sync I/O in async route handlers (Hard Rule 4)
- Never return ORM models — always Pydantic DTOs with from_attributes=True (Hard Rule 2)
- Soft-import optional deps (Logfire, CRUDAdmin) (Hard Rule 6)
- Run `bun ~/Durante/Tools/sync-check.ts --summary` after every multi-copy edit
- Voice notifications FORBIDDEN (subagent rule per Algorithm v0.0.7-enhanced §7.5)
- Stay in your file ownership zone — touching another stream's zone is a contract violation, not optimization

START NOW.
```

The orchestrator (you) composes this prompt per-role from the workflow's Pre-Delegation Contract table + the role's `mcp_tools` from `Data/Roster.json` + the role's saved composition. `Tools/BuildBrief.ts` already does most of this rendering — extend it when needed rather than inlining brief composition into the workflow.

## Acknowledgment + integration

As streams complete, each fires `SendMessage(<team-lead>, <report>)` with:

- Per-ISC evidence (file:line citations + before/after summary)
- **Absence-claim manifest (binding):** any negative/absence claim in the report ("no X found", "not implemented", "zero usages", "does not exist") MUST carry the mechanical check that produced it — tool + pattern + scope + match count (count-before-emit). An absence claim without its manifest is unverified by definition.
- Sample output / build artifacts
- `bun ~/Durante/Tools/sync-check.ts --summary` exit code
- MCP tool calls made (transcript-equivalent)

Orchestrator (you):

1. Wait for all teammate `SendMessage` reports (notifications fire automatically when each finishes).
2. Verify each report's claims via direct tool call (`Read` / `Bash`) per Algorithm §6.6 Critical Claim Cross-Check. **Reports containing absence claims WITHOUT a search manifest are REJECTED — re-spawn the worker quoting the absence-claim contract; never accept an unmanifested negative on trust** (Archer H14: prose 24/38 violations → contract 0/31).
3. Mark verified ISCs `[ ] → [x]` in the PRD.
4. Run the gate (e.g., G6 pyramid-complete check from `_test-pyramid-gate.md`).
5. On gate pass: proceed to next phase. On gate fail: route via the v0.5.0 ISC-failure remediation policy (re-spawn original implementer with surgical-fix constraint + 3-strike escalation).

## Shutdown sequence

After the gate passes for the phase:

```typescript
// Per teammate (parallel, single message)
[
  SendMessage({ to: "apidx", body: { type: "shutdown_request", reason: "Phase 2 complete; thanks for the API DX memo." } }),
  SendMessage({ to: "schema", body: { type: "shutdown_request", reason: "Phase 2 complete; DTO ladder accepted." } }),
  SendMessage({ to: "architect", body: { type: "shutdown_request", reason: "Phase 2 complete; ADR landed." } })
]

// Wait for shutdown_approved + teammate_terminated notifications
// Team auto-dissolves at last teammate exit
```

## Solo phases (escape-clause table)

Solo execution is correct — and required — for these phase shapes:

| Phase | Reason | Escape clause |
|---|---|---|
| DeliverFeature Phase 1 (PM scope) | Single-agent ISC authoring; narrative coherence | "Single-file work" |
| DeliverFeature Phase 3 (Database schema) | Always-runs by Coordination Policy #2; DB Engineer is the sole authority | "Single-file work" |
| DeliverFeature Phase 6a (QA Unit) | Per the Test Pyramid Gate; sequenced before 6b | "Single-zone within phase" |
| DeliverFeature Phase 6b (E2E Integration) | Per the Test Pyramid Gate; sequenced after 6a | "Single-zone within phase" |
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

Each solo phase logs the escape clause inline ("Solo execution per dag-playbook escape clause: <clause-name>") rather than reaching for TeamCreate ceremony.

## PARALLELISM PRE-CHECK at every workflow entry

Workflows MUST emit a `📐 PARALLELISM:` block at PLAN-equivalent entry per Algorithm §6.3:

1. **N≥3 mechanical-same?** → `/batch` for the mechanical phase (e.g., 3 routers needing identical scaffolding)
2. **N≥2 independent workstreams?** → TeamCreate + Agent(team_name:...) per the template above
3. **Concurrent with blocking I/O?** → batch reads, fan out MCP calls

Silence is unacceptable — explicit "no" with justification is required when the answer is no.

## Anti-patterns to catch (starter-flavored)

The dag-playbook anti-patterns apply, plus these starter-specific ones:

1. **Spawning starter roles via `Task` instead of `Agent`** — `Task` doesn't accept `team_name`. Use `Agent` for team coordination.
2. **Forgetting to load the saved composition** — every starter role's identity lives in `~/.claude/custom-agents/<slug>.md`. Spawning a `general-purpose` agent without injecting the composition strips the role's voice + traits.
3. **Inlining the Pre-Delegation Contract per-stream** — the contract is one table in the PRD `## Context`; each stream gets a SLICE in its prompt, not the full table.
4. **Voice calls from teammates** — Algorithm §7.5 is explicit: subagents NEVER make voice curls. The starter's per-role `voice_id` is for the orchestrator to announce phase entry, not for teammates to emit.
5. **Skipping the SendMessage report** — ack closure is non-optional. Without per-stream `SendMessage`, the orchestrator cannot verify ISCs and cannot run the gate.
6. **Forgetting the shutdown sequence** — leaving teammates running after gate-pass leaks team-lead context. Always shut down before next phase.
7. **Sync calls in async streams** — Hard Rule 4 violation. Streams that author `requests.get(...)` or `time.sleep(...)` block the event loop. Use `httpx.AsyncClient` and `await asyncio.sleep(...)`.

## Cross-references

- **Algorithm v0.0.7-enhanced §4.3** — Platform Capabilities (Agent Teams entry)
- **Algorithm v0.0.7-enhanced §6.3** — PARALLELISM PRE-CHECK (the gate that triggers teaming)
- **Algorithm v0.0.7-enhanced §6.4** — Pre-Delegation Contract (5-field template)
- **dag-playbook.md** — 8-step canonical pattern (this partial is the starter-native delta)
- **`Data/Roster.json`** — role id → saved composition slug → voice_id → traits → `mcp_tools` clusters
- **`Data/McpToolMap.json`** — cluster → tools (rendered into authorized-tools section by `Tools/BuildBrief.ts`)
- **`_test-pyramid-gate.md`** — the gate every change-producing workflow runs at G6 (Phase 6 of DeliverFeature; Phase 4 of BugFix/Refactor; Phase 2 of QuickFix)
- **`_pr-loop-shared.md`** — TODO checklist protocol used by ReviewOpenPRs / ReviewSinglePR / ExecuteOpenTodos
