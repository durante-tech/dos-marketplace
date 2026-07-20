---
name: DeliverFeature
description: "Full 8-phase, 13-agent delivery pipeline (discovery through ship) that takes a feature from PRD to PR with operator gates at each artifact boundary."
status: STABLE
bestPath:
  - title: "Discovery & Design"
    description: "PM scopes the PRD; API DX, Schema, and Architect co-design the feature in parallel."
  - title: "Schema"
    description: "Database Engineer always weighs in with a model diff, migration plan, or an explicit no-changes memo."
  - title: "Implementation"
    description: "Agent Engineer and Backend build in parallel, gated inline by /code-review and the spec-verify check."
  - title: "Hardening & Verification"
    description: "Security and QA harden and plan tests; Unit and Integration phases enforce the ships-with-tests gate."
  - title: "Ship & Wrap"
    description: "DevOps and Writer prepare the deploy plan and docs, the PR opens, and SM wraps with a delivery summary."
---

# DeliverFeature Workflow

Full 8-phase pipeline that runs all 13 agents to ship a feature into the dos-fastapi-starter framework.

**Sibling:** `MakerkitTeam/Workflows/DeliverFeature.md` (TS/Next.js/Prisma equivalent). Same gate structure; reflavored phases for Python/FastAPI/Pydantic AI.

## When to Use

- Trigger phrases: "deliver feature in starter", "ship feature to fastapi starter", "build feature in starter".
- Fits when shipping a new feature end-to-end through the full 13-agent pipeline, from PRD through PR.
- NOT for a ≤2-file surgical fix — the workflow itself auto-classifies and suggests `QuickFix` instead.

**V13.3c PRD-scaffolding routing (RFC-0083 §5.5 split, Sprout pattern):** For vNext-format PRDs (`format_version: 3`), invoke `Skill("prd", "scaffold")` BEFORE the workflow's native PRD-creation step below (Phase 1 G1 — PRD draft after Discovery). The Skill produces the vNext frontmatter + skeleton; the workflow then continues editing PRD sections directly. The legacy "create PRD stub with frontmatter only" prose remains as fallback until v0.0.14 V14.6 retires it after a 30-day Sprout adoption soak.

## Operator Gates (v0.5.0 policy)

This pipeline pauses at the **artifact gates** below — not at every phase boundary. Routine ceremony (scope classification, agent spawning per the contract) is automatic. Operator only sees:
- **G1** PRD draft after Phase 1 (Discovery)
- **G2** Design package after Phase 2 (API DX + Schema + Architect)
- **G3** Schema diff after Phase 3 (Database)
- **G4** Code diff after Phase 4 (Implementation + /code-review)
- **G5** Threat model + Test Pyramid Plan after Phase 5 (Hardening)
- **G6** ISC verification matrix after Phase 6 (E2E + Unit)
- **G7** Deploy plan + docs after Phase 7 (Ship)

Phase 8 (Wrap) requires no gate — its output is informational.

## Pre-flight (Phase 0)

1. Voice notify: `bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running DeliverFeature workflow in fastapi-starter-team skill to ship feature"`
2. Read `Data/Roster.json` and verify all 13 saved compositions exist at `~/.claude/custom-agents/`

### MCP Touchpoints (Phase 0)

- **`mcp__dos_fastapi__check_prerequisites`** — verify uv, Docker, .env.local, slot claimed BEFORE spawning agents
- **`mcp__dos_fastapi__fork_status`** — verify slot_match=true; halt if cwd ≠ recorded slot
- **`mcp__dos_fastapi__list_routes`** — snapshot existing route inventory; surface in PRD `### Pre-flight Snapshot`

### Track-Bootstrap routing (NEW 2026-05-15)

**Before auto-classification, check track-bootstrap pattern fit** per `MEMORY/CANONICAL/track-bootstrap-pattern.md`:

- **Pattern fits when** the request describes a **NEW external integration provider** with ≥5 sub-APIs/surfaces, its own OAuth-scope domain, rate-limit regime, and resource model. Examples: "build a Google Merchant FastAPI adapter package" (9 sub-tracks), "wire up Resend with templates + webhooks + audiences as a Pydantic AI tool set" (3-5 sub-tracks).
- **If pattern fits:** this is NOT a DeliverFeature run — it's a track-bootstrap run. Route to `Skill("utilities", "track-bootstrap: ${TRACK_NAME}")` OR manually run `bun ~/Durante/Tools/scaffold-track.ts --track ${TRACK_ID} --stack ${STACK_NAME} --provider ${PROVIDER_KEBAB} --sub-tracks ${N}` plus the 4 parallel research workstreams from the scaffold's parallelism contract. The scaffold produces a parent research PRD + ${SUB_TRACK_COUNT} sub-track PRD stubs; each sub-track PRD then re-enters this `DeliverFeature` workflow individually after operator G1 approval.
- **If pattern does NOT fit:** continue with step 3 (auto-classify) below — this is a normal DeliverFeature run.

**Why this routing exists:** validated against 3 historical runs in the Makerkit sibling (social-stack B1/B2/B3, B4 GBP, commerce-stack GM). For FastAPI-flavored providers, the same shape applies (one Pydantic schema family + one `src/app/<domain>/` package + N sub-route modules). Scaffold lives at `~/.claude/DOS/Scaffolds/track-bootstrap/`.

3. **Auto-classify feature scope** (no operator confirmation step):
   - Small: ≤2 files OR described as "fix" / "tweak" / "patch" → suggest `QuickFix` and exit
   - Medium: 3-10 files, single feature surface
   - Large: 11+ files OR touches auth / rate-limit / Pydantic AI agents / migrations
   - Classification logged in PRD `## Decisions` with reasoning. Operator overrides at G1.
4. Create PRD stub at `MEMORY/WORK/{slug}/PRD.md` with frontmatter only.
5. Show roster summary so operator knows which voices will speak.

<!-- partial: _intent-to-flag-table.md skill_name=FastAPIStarterTeam workflow_name=DeliverFeature -->
## Intent-to-Flag Mapping

Operator-facing intent → workflow routing/scope decisions. The pipeline auto-classifies based on these signals (Phase 0 step 3); operator overrides at G1.

### Scope Classification

| Operator intent / signal | Scope flag | Pipeline behavior |
|---|---|---|
| "fix", "tweak", "patch", "small change" OR ≤2 files mentioned | `small` | Suggest `QuickFix` workflow and EXIT (don't run full pipeline) |
| Default (3-10 files OR single feature surface) | `medium` | Full pipeline; 13 agents, all 8 phases |
| "new feature with auth", "add billing", "rate-limit overhaul", "Pydantic AI agent" OR 11+ files OR migrations involved | `large` | Full pipeline + extra Council debate at G2 for design tradeoffs |

### Routing / Pattern Recognition

| Operator intent / signal | Routing decision | Where to go instead |
|---|---|---|
| "NEW external integration provider", ≥5 sub-APIs, distinct OAuth-scope domain, own rate-limit regime | `track-bootstrap` (NOT DeliverFeature) | `Skill("utilities", "track-bootstrap: ${NAME}")` — produces parent + sub-track PRDs; each sub-track re-enters DeliverFeature after G1 |
| "scaffold a vNext PRD" before feature begins | `prd-scaffold` (V13.3c RFC-0083 §5.5 Sprout) | `Skill("prd", "scaffold")` BEFORE Phase 1 G1 — produces vNext frontmatter + skeleton |
| Default | continue DeliverFeature | — |

### Phase Gate Behavior

| Operator intent / signal | Gate flag | Effect |
|---|---|---|
| Default | `gates: artifact-only` | Pause at G1-G7 (artifacts), not every phase boundary |
| "I want to see every phase" (rare — debugging the pipeline itself) | `gates: every-phase` | Operator confirmation between every Phase N → N+1 transition |
| Approval given at gate | `g{N}: approved` | Advance to Phase N+1 |
| Revisions requested at gate | `g{N}: revise` | Re-spawn the phase's agents with operator feedback added to brief |

### Skill Composition Triggers

| Operator intent / signal | Skill fired | When |
|---|---|---|
| ISC seed contains "competitive references", "market sizing", named SDK | `Skill("research")` | Phase 1 PM (≤3 calls cost guard) |
| Named library / SDK / framework-version API referenced (e.g. "SQLAlchemy 2.0 async", "Pydantic v2 validators", "FastAPI lifespan") | `Skill("research", "DocsLookup")` (via Ref) | Phase 1 PM + Phase 7 Writer (≤2 lookups; cite docs, never recall — failure → flag the API ref `⚠️ unverified`, never block) |
| UI Designer needs mockups / illustrations | `Skill("media")` | Phase 2 UI (≤2 calls; verify components_search first) |
| Design tradeoff with no clear winner | `Skill("thinking", "council on <X>")` | G2 escape, or Architect-initiated |
| Code-producing run reaches EXECUTE→VERIFY boundary | `Skill("code-review", "high")` | Mandatory per v0.0.8 §4.2 |

## Phase 1 — Discovery (PM solo)

**Agent:** `pm` (Product Manager)
**Brief includes:** user request verbatim, framework digest §1-2, scope classification
**Outputs:** PRD `## Context` + `## Criteria` (atomic ISCs), user story breakdown, anti-criteria

### SeedScope match (Phase 1, structural — RFC-0154 row `feature-scope-archetypes`, mandatory-or-declined at warn)

Before G1, run the archetype scope match — this step is structural, not opt-in (roadmap D1):

1. `Skill("archetypes", "seed scope ISCs for <feature>")` → SeedScope Step 1 matches the feature against the corpus (`bun ~/.claude/skills/archetypes/Tools/RenderArchetype.ts --list`).
2. **On match:** the seeded `## Criteria (scope layer — seeded from archetype <name> v<version>)` block lands in the PRD before G1; every T1 row is build-or-DEFERRED-with-reason, never silently absent. Phase 1.5 then decomposes the "build" scope rows into implementation ISCs.
2b. **On match, render the matrix into the work folder** — `bun ~/.claude/skills/archetypes/Tools/RenderArchetype.ts <name> --out MEMORY/WORK/{slug}/archetype-<name>.md` — and list that path in the PM brief's context files. Phase 2's architect brief includes the same path. Briefs cite the matrix by path (agents Read it); never inline the full table into prompt text.
3. **On no-match or decline:** exactly one line in PRD `## Decisions` — `Declined: Archetypes/SeedScope — <reason>` ("no archetype coverage for <domain>" is a valid reason and is itself signal: consider AuthorArchetype after delivery).

Warn-mode contract (RFC-0154 §8): an unaddressed match is reported at VERIFY, never failed on. Do not skip silently — invoke-or-decline is the whole contract.

**Operator gate G1:** Approve PRD before Phase 2.

## Phase 1.5 — Decompose ISCs (mandatory, between G1 and Phase 2)

**Why this exists:** prd-projector baseline 2026-05-17 found 9 of 28 altyaa-turbo PRDs and 9 of 40 dos-prisma-saas-kit PRDs (combined 27% of stack-team-workflow output) shipped with `## ISCs (placeholder; populate at G1)` — the workflow authored the PRD shape at Phase 1 end, operator approved at G1, then the workflow proceeded to Phase 2 without populating atomic ISCs. The placeholder pattern is isolated to kit-team workflows; Durante has zero. Council 2026-05-17 (Young + Evans + Metz) ratified this micro-step to close the gap at source.

**Mandate:** before Phase 2 agents spawn, the workflow MUST verify the PRD's `## ISCs` (or `## Criteria`) section is fully populated with atomic ISCs — no `placeholder`, no `populate at G1` strings, no category-count estimates without enumerated `- [ ] ISC-N:` lines.

**Procedure:**

1. Run `bun ~/Durante/Tools/prd-projector.ts characterize --root MEMORY/WORK/active --format jsonl | grep "<PRD-slug>"` (or pipe to a per-PRD filter).
2. Pipe the per-PRD record into the gate. `validateDecomposeGate()` + `renderDecomposeGate()` in `Tools/FastapiCli.ts` own the three-check verdict (no placeholder, `isc_count` within ±10% of the operator-approved G1 scope, `fat_isc_count: 0` OR every fat ISC carries a `pairing-exception:` line per R70) and the byte-preserved status line. Covered in `Packs/fastapi-starter-team/src/Tools/__tests__/FastapiCli.test.ts` (pack source — `*.test.ts` is deliberately excluded from live deploys).
   ```bash
   # stdin: {record: <prd-projector record>, expectedIscCount: <G1 scope>, slug: "<PRD-slug>"}
   # prints the DECOMPOSE-GATE line; exits nonzero on BLOCKED.
   jq -n --argjson rec "$PRD_RECORD" --argjson n "$APPROVED_ISC_COUNT" --arg slug "$PRD_SLUG" \
     '{record: $rec, expectedIscCount: $n, slug: $slug}' \
     | bun ~/.claude/skills/fastapi-starter-team/Tools/FastapiCli.ts decompose-gate
   ```
3. If the gate prints `BLOCKED` (nonzero exit) → PM agent must populate / decompose / fix BEFORE the Phase 2 parallel spawn fires.
4. **Operator override** (rare): add `Override decompose-gate: <reason>` line to PRD `## Decisions`. Surfaces in audit but does not block.

**Output (emitted by `renderDecomposeGate`):** `📋 DECOMPOSE-GATE: <PRD-slug> · isc_count=N · placeholder=false · fat=0 — OK` (or `BLOCKED: <reasons>`).

## Phase 2 — Design (parallel: API DX + Schema + Architect)

**Agents:** `apidx`, `schema`, `architect`

**Pre-Delegation Contract (mandatory):**

```
### Pre-Delegation Contract (agents: {apidx, schema, architect})
- API DX owns: error envelope shape (RFC 9457), pagination semantics, idempotency, OpenAPI examples, Swagger UI tag groupings
- Schema owns: Pydantic v2 DTOs (Read/Create/Update/Internal ladder), validators, response_model selection, ConfigDict(from_attributes=True)
- Architect owns: src/app/<domain>/ placement, async boundary, FastCRUD vs custom service, dependency-injection layout
- No overlap. Each agent writes to its own subsection in PRD `## Design`.
```

**Team spawn (per `_algorithm-team-spawn.md`):** `TeamCreate({ team_name: "fst-deliver-phase2-<slug>", description: "3-stream parallel design (API DX + Schema + Architect)", agent_type: "team-lead" })`. Single message, three parallel `Agent` calls — one per role; each `subagent_type: "general-purpose"`, `team_name`, `name: <role-id>`, `model: "sonnet"`, `run_in_background: true`. Wait for `SendMessage` reports; cross-check; mark ISCs `[ ]→[x]`; run G2 gate. After G2: send `shutdown_request`.

### MCP Touchpoints (Phase 2)

- **`mcp__dos_fastapi__list_routes`** — Architect MUST call before deciding placement (duplication-prevention)

**Operator gate G2:** Review the three artifacts.

## Phase 3 — Schema (DB Engineer mandatory)

**Always runs.** Per Coordination Policy #2, Database Engineer always weighs in.

**Agent:** `database` (Database Engineer)
**Brief includes:** PRD, Architect placement decision, framework digest §6-7, and — when Phase 1 recorded an archetype match — `MEMORY/WORK/{slug}/archetype-<name>.md`
**Required outputs:**
- If schema changes: SQLAlchemy model diff at `src/app/models/`, Alembic migration plan, backfill plan if NOT NULL on populated table, index strategy
- If no schema changes: written confirmation citing `mcp__dos_fastapi__alembic_check` clean output, with rationale for why existing models suffice

### MCP Touchpoints (Phase 3)

- **`mcp__dos_fastapi__alembic_check`** — Database role MUST run BEFORE authoring a migration
- **`mcp__dos_fastapi__alembic_current`** + **`alembic_history`** — verify chain consistency
- Migration generation via subprocess (`cd src && uv run alembic revision --autogenerate -m "<message>"`)
- **DEFERRED to Phase 7 (DevOps):** `alembic upgrade head` (production application)

**Operator gate G3:** Schema diff (or no-changes-needed memo) approved before any code is written.

## Phase 4 — Implementation (parallel: Agent Engineer + Backend)

**Agents:** `agent`, `backend`

**Pre-Delegation Contract (mandatory):**

```
### Pre-Delegation Contract (agents: {agent, backend})
- Naming:
  - agent endpoints in `src/app/agents/<feature>/router.py` + `src/app/agents/<feature>/service.py`
  - resource routes in `src/app/api/v1/<resource>.py`
  - CRUD instances in `src/app/crud/crud_<model>.py`
- Ownership:
  - agent: Pydantic AI Agent construction, @agent.tool registrations, system prompts, lazy-init via lru_cache, EventSourceResponse for streaming, logfire.instrument_pydantic_ai
  - backend: FastAPI route handlers, Depends(async_get_db), FastCRUD composition, JWT auth flows, ARQ enqueue, rate-limit dependencies
- Shared interfaces:
  - Pydantic schemas (from Phase 2) are THE contract; both import from `src/app/schemas/`
  - Async-everywhere — no sync I/O in handlers (Hard Rule 4)
- Output: each agent returns `{ files_written: string[], errors: string[], tests_added: string[] }`
```

**Team spawn (per `_algorithm-team-spawn.md`):** `TeamCreate({ team_name: "fst-deliver-phase4-<slug>", ... })`. Two parallel `Agent` calls — one per role. Wait for reports; cross-check; orchestrator runs `Skill("code-review", "high")` on the combined diff; route findings to original implementer per ISC-failure policy.

### MCP Touchpoints (Phase 4)

- **`mcp__dos_fastapi__list_routes`** — Backend AND Agent MUST call before authoring a new route (duplication-prevention)
- **`mcp__dos_fastapi__read_env_local`** — Backend reads env state before any handler depends on a new env var
- **`mcp__dos_fastapi__run_checks`** — orchestrator MUST invoke on combined diff after both return, BEFORE `Skill("code-review", "high")`. Failures route to original implementer.

**After both return (Phase 4 inline, not a separate gate):** Orchestrator runs `Skill("code-review", "high")` on the combined diff. The 3 code-review findings (reuse / quality / efficiency) appended to PRD `## Decisions → ### /code-review Findings`. If a finding requires a code change, the original implementer (agent or backend, by ownership) re-runs to address it BEFORE G4. /code-review is part of BUILD, not a gate of its own.

**Archetype completeness pass (only when Phase 1 recorded an archetype match):** run `Skill("archetypes", "audit this feature against <name>")` — AuditFeature diffs the combined implementation against the matched matrix; every T1 row neither implemented nor carrying a DEFERRED/WAIVED line in the PRD scope block is a finding, appended to `### /code-review Findings` with the row id cited. Route findings like any other review finding (owning implementer, BEFORE G4). Skip silently when Phase 1 recorded no-match or a `Declined:` line. (/code-review reads the diff; this pass reads the MARKET TABLE — missing capabilities are invisible to diff-readers by construction.)

**Spec-anchored verify (Phase 4 inline, after /code-review, BEFORE G4):** the orchestrator — PRIMARY only; this native workflow cannot be nested inside another workflow's subagent — runs the spec-gate: `Workflow({ name: "spec-verify-in-loop", args: { specPath: "MEMORY/WORK/active/<slug>/PRD.md", artifactRef: "git diff --staged", scope: "v1" } })`. The SpecVerifier RE-DERIVES the PRD's obligation set BEFORE reading the artifact (anti-priming) and returns a deterministic gate verdict `pass | drift | fail | inconclusive`. Routing: `drift`/`fail` → unmet obligations go to the owning implementer (agent or backend) and re-verify BEFORE G4; `inconclusive` → surface the unmet-obligation list to the operator AT G4. Complementary: /code-review reads the DIFF; spec-verify catches SPEC-drift the diff-reader structurally misses. Verdict + roll-up appended to PRD `## Decisions → ### Spec-Verify Verdict`.

**Operator gate G4:** Review code changes (with /code-review findings already addressed).

## Phase 5 — Hardening (parallel: Security + QA)

**Agents:** `security`, `qa`

**Pre-Delegation Contract:**
- Security owns: threat model, JWT claim review, refresh-token cookie attributes, rate-limit key namespacing, blacklist correctness, RFC 9457 PII scrubbing, env-var SecretStr discipline
- QA owns: **Test Pyramid Plan** with per-ISC layer mapping (per `_test-pyramid-gate.md`), edge case enumeration, regression risk list

**QA's Test Pyramid Plan structure:** the per-ISC layer mapping table from `_test-pyramid-gate.md` lives in PRD `## Decisions → ### Test Pyramid Plan`. Every ISC tagged `unit-covered` / `integration-covered` / `verification-only (justified)` / `documentation-only`. Phase 6 sub-agents cite this plan when authoring tests.

**Team spawn (per `_algorithm-team-spawn.md`):** `TeamCreate({ team_name: "fst-deliver-phase5-<slug>", ... })`. Two parallel `Agent` calls. Wait for reports; cross-check; mark ISCs `[ ]→[x]`; run G5 gate.

**Operator gate G5:** Approve threat model + Test Pyramid Plan before Phase 6.

## Phase 6 — Verification (split: 6a Unit + 6b Integration)

This phase enforces the **ships-with-tests gate** from `_test-pyramid-gate.md`. Both sub-phases must complete green before G6 closes.

### Phase 6a — Unit (QA solo)

**Agent:** `qa`
**Brief includes:** Test Pyramid Plan from Phase 5, FrameworkDigest §10, `_test-pyramid-gate.md`
**Required outputs:** pytest tests in `tests/unit/test_<module>.py` for every business-logic ISC. Each test green when run via `uv run pytest tests/unit/test_<module>.py`.
**Run:** `uv run pytest tests/unit -x --tb=short`. Capture output verbatim into PRD `## Verification → ### Unit-layer evidence`.

### Phase 6b — Integration (E2E Tester solo)

**Agent:** `e2e`
**Brief includes:** Test Pyramid Plan from Phase 5, FrameworkDigest §10, `_test-pyramid-gate.md`
**Required outputs:** `tests/integration/test_<feature>.py` for every user-facing ISC. Specs use `async_client`, `test_user`, `superuser` fixtures from conftest. Mailpit assertions via `mcp__dos_fastapi__list_mailbox` for email flows. ARQ polling for background jobs.
**Run:**

```bash
make compose-dev-up                                      # ensure stack
mcp__dos_fastapi__fork_status                            # verify slot
uv run pytest tests/integration -x --tb=short
```

Capture output into PRD `## Verification → ### Integration-layer evidence`.

#### MCP Touchpoints (Phase 6b)

- **`mcp__dos_fastapi__run_checks`** — invoke after integration suite green; failures invalidate Phase 6.
- **`mcp__dos_fastapi__list_mailbox`** — for email-flow integration tests.

**Operator gate G6 (pyramid-complete):** All six ships-with-tests checks green per `_test-pyramid-gate.md`. The agent judges each check's state per run; the OK/BLOCKED verdict over the six booleans is the deterministic AND-gate `validateShipsWithTestsGate()` + `renderShipsWithTestsGate()` in `Tools/FastapiCli.ts` (covered in `Packs/fastapi-starter-team/src/Tools/__tests__/FastapiCli.test.ts` — pack source; `*.test.ts` is excluded from live deploys) — it names every failed check in checklist order, so the gate decision is never hand-applied in prose.

1. Unit-layer green (`unitGreen`)
2. Integration-layer green (`integrationGreen`)
3. `mcp__dos_fastapi__run_checks` clean — ruff + mypy + pytest (`runChecksClean`)
4. Async discipline — `@pytest.mark.asyncio` on every async test (`asyncDiscipline`)
5. Bootstrap-fixture usage — no UI login round-trip unless testing login itself (`bootstrapFixtureUsage`)
6. Per-ISC layer mapping documented (`perIscLayerMapping`)

```bash
# stdin: {checks: {unitGreen, integrationGreen, runChecksClean, asyncDiscipline, bootstrapFixtureUsage, perIscLayerMapping}, slug: "<PRD-slug>"}
# prints the SHIPS-WITH-TESTS line; exits nonzero on BLOCKED.
jq -n --argjson c "$G6_CHECKS" --arg slug "$PRD_SLUG" '{checks: $c, slug: $slug}' \
  | bun ~/.claude/skills/fastapi-starter-team/Tools/FastapiCli.ts ships-with-tests-gate
```

**Output (emitted by `renderShipsWithTestsGate`):** `📋 SHIPS-WITH-TESTS: <PRD-slug> · 6/6 — OK` (or `N/6 — BLOCKED: <failed checks>`).

**ISC-failure remediation:** failed ISCs route back to original implementer (agent or backend, by code ownership) with surgical-fix constraint. Three consecutive failures → escalate to operator.

## Phase 7 — Ship (parallel: DevOps + Writer)

**Agents:** `devops`, `writer`

**Pre-Delegation Contract:**
- DevOps owns: env var manifest delta (`.env.example`), Dockerfile diff across the three deploy recipes, Alembic migrate-deploy plan, healthcheck route, Logfire instrumentation toggle, slot allocator hygiene, MCP server registration if scope adds new tools
- Writer owns: `docs/{section}/{feature}.md` (mkdocs), AGENTS.md notes if conventions added, `Plans/Specs/ADR-XXX-{topic}.md` if architecture decision crystallized, README.md updates, OpenAPI route docstrings

**Team spawn (per `_algorithm-team-spawn.md`):** `TeamCreate({ team_name: "fst-deliver-phase7-<slug>", ... })`. Two parallel `Agent` calls.

### MCP Touchpoints (Phase 7)

- **`mcp__dos_fastapi__read_env_local`** — DevOps verifies env-var hygiene
- **`mcp__dos_fastapi__alembic_history`** — DevOps inspects migration chain before declaring deploy readiness
- **`mcp__dos_fastapi__list_routes`** — Writer reads for OpenAPI tag inventory when refreshing docs
- **`mcp__dos_fastapi__run_checks`** — final pre-ship green check
- **DEFERRED to deploy pipeline:** Alembic `upgrade head` (document in deploy checklist, do NOT invoke at G7)

**PR creation (per `_commit-merge.md`):** open the feature PR via `gh pr create --title "feat(<scope>): <concise ≤70>" --body "$(cat <<'EOF'..."` with `## Summary` + `## Test plan` H2 sections + `Co-Authored-By: DuranteOS <tech@duranteos.com>` trailer. Branch convention: `feat/<feature-slug>`. NEVER push to `main`. Pre-commit hook failure → fix and NEW commit (no `--amend`).

**Operator gate G7:** Approve docs and deploy plan.

## Phase 8 — Wrap (Scrum Master)

**Agent:** `sm`
**Brief includes:** all phase outputs, PRD path, ISC verification matrix
**Required outputs:**
- Delivery summary (≤200 words)
- Blocker list
- Follow-on bucket (≤3 concrete tasks for next iteration)
- Retro notes

**No gate — informational only.** Update PRD frontmatter `phase: complete` and `progress: N/N`.

## Failure Modes & Remediation

| Failure | Remediation |
|---|---|
| Agent A's output contradicts agent B's | Spawn Council via Task tool (see "Council on Contradiction" below) |
| ISC fails at Phase 6 | Original implementer (agent or backend by ownership) re-spawned with surgical-fix constraint. After 3 consecutive failures, escalate to operator. |
| Phase 5 surfaces unfixable security issue | Halt pipeline, escalate to operator with risk options |
| `/code-review` flags major duplication | Architect spawned solo to design extraction, then Phase 4 re-runs with shared helper |
| Hard Rule violation surfaced (e.g., sync call in async handler) | Re-route to original implementer with explicit Hard Rule citation; not negotiable |

### Council on Contradiction (concrete spawn)

When two phase-agent outputs disagree on a load-bearing decision (schema shape, async boundary, auth/RBAC model, OpenAPI contract), invoke Thinking's Council/Debate workflow via a single Task spawn. Pass the conflicting positions as Round 0 context so the debate starts from the actual disagreement, not first principles:

```ts
Task({
  subagent_type: "general-purpose",
  description: "Council on contradiction",
  prompt: `Invoke the thinking skill, Council/Debate workflow (3 rounds, full debate).

ROUND 0 CONTEXT — conflicting positions to resolve:

Position A (from agent <A_role>, Phase <N>):
<verbatim A output excerpt>

Position B (from agent <B_role>, Phase <N>):
<verbatim B output excerpt>

The question for council: which position should the pipeline adopt, or is there a synthesis that supersedes both?

Compose council from technical/architecture traits (Architect, Engineer, Critic, Researcher) per Debate.md "technical/architecture topics" table. Return final synthesis and a single recommended position with reasoning.`
})
```

The synthesis returned by Council becomes the binding decision for the contradicting phase; both agents are re-spawned in the next iteration with the council's resolution as a constraint in their prompt.

## Artifact Tracking

Every phase output is logged to `MEMORY/ARTIFACTS/artifacts.jsonl`:
- `prd` — Phase 0 stub + Phase 1 fill-in
- `api_dx_memo`, `schema_diff`, `architecture_decision` — Phase 2
- `migration_plan` — Phase 3
- `threat_model` — Phase 5 (Security)
- `test_plan` — Phase 5 (QA)
- `delivery_summary` — Phase 8 (SM)
