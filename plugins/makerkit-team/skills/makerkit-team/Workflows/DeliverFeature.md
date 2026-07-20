---
name: DeliverFeature
description: Full 8-phase, 13-agent delivery pipeline that ships a feature into the makerkit framework end-to-end — PM discovery through design, schema, implementation, hardening, verification, and ship — gated at seven operator checkpoints.
status: STABLE
bestPath:
  - title: "Discovery & Design"
    description: "PM drafts the PRD and decomposed ISCs, then UX, UI, and Architect produce parallel design artifacts."
  - title: "Schema"
    description: "Database Engineer always weighs in with a schema diff or an explicit no-changes-needed memo."
  - title: "Implementation"
    description: "Frontend and Backend build in parallel, reviewed by /code-review and a spec-anchored verifier before the code-diff gate."
  - title: "Hardening & Verification"
    description: "Security and QA harden the surface, then unit and E2E tests close the ships-with-tests pyramid gate."
  - title: "Ship & Wrap"
    description: "DevOps and Writer prepare the deploy plan and docs, the PR opens, and the Scrum Master wraps with a delivery summary."
divergence_from_canonical:
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "MakerkitTeam workflows have bespoke per-pipeline Output sections (artifact paths + redline reports); canonical shape doesn't fit"
---

# DeliverFeature Workflow

<!-- partial: _workflow-voice.md skill_name=MakerkitTeam workflow_name=DeliverFeature action_phrase=" to ship feature" -->

Full 8-phase pipeline that runs all 13 agents to ship a feature into the makerkit framework.

**V13.3c PRD-scaffolding routing (RFC-0083 §5.5 split, Sprout pattern):** For vNext-format PRDs (`format_version: 3`), invoke `Skill("prd", "scaffold")` BEFORE the workflow's native PRD-creation step below (Phase 1 G1 — PRD draft after Discovery). The Skill produces the vNext frontmatter + skeleton; the workflow then continues editing PRD sections directly. The legacy "create PRD stub with frontmatter only" prose remains as fallback until v0.0.14 V14.6 retires it after a 30-day Sprout adoption soak.

## When to Use

- "deliver feature", "ship feature", "build feature"
- Shipping a full feature end-to-end through the 13-agent pipeline, from PM discovery through ship and wrap
- NOT for ≤2-file surgical fixes or trivial changes — those auto-classify to `small` and route to QuickFix instead

## Operator Gates (v0.1.0 policy)

This pipeline pauses at the **artifact gates** below — not at every phase boundary. Routine ceremony (scope classification, agent spawning per the contract) is automatic. Operator only sees:
- **G1** PRD draft after Phase 1 (Discovery)
- **G2** Design package after Phase 2 (UX + UI + Architect)
- **G3** Schema diff after Phase 3 (Database)
- **G4** Code diff after Phase 4 (Implementation + /code-review)
- **G5** Threat model + test plan after Phase 5 (Hardening)
- **G6** ISC verification matrix after Phase 6 (E2E)
- **G7** Deploy plan + docs after Phase 7 (Ship)

Phase 8 (Wrap) requires no gate — its output is informational.

**Gate mechanics (all of G1-G7):** every gate fires an explicit `AskUserQuestion` with approve / revise / reject options. The operator's verdict (and any feedback) is recorded verbatim in PRD `## Decisions → ### Gate log` as `G<N>: <verdict> — <one-line rationale>` BEFORE the pipeline advances or re-spawns.

## Pre-flight (Phase 0)

1. Capability probe (per `Workflows/_algorithm-team-spawn.md` Phase 0): `bun ~/.claude/skills/makerkit-team/Tools/MakerkitCli.ts preflight` — resolves the kit repo (and its real toolchain: `lintTool` in the manifest, oxlint on current kit — do NOT assume eslint), checks roster health + cited scripts + doctrine pointer, and emits the capability manifest every spawn decision consumes. Exit 1 = unresolvable repo or invalid roster: STOP and remediate.
2. Read `Data/Roster.json` and verify all 13 saved compositions exist at `~/.claude/custom-agents/` (preflight reports missing ones; see `RosterBootstrap.md` for recovery)

### MCP Touchpoints (Phase 0)

- **`mcp__makerkit__kit_prerequisites`** — verify the kit's tooling prerequisites are met BEFORE spawning agents (saves cascading failure cost)
- **`mcp__makerkit__kit_status`** — snapshot the kit project state (DB up? dev server status? installed packages?). Surface the result in PRD `## Decisions → ### Pre-flight Snapshot`
- **`mcp__makerkit__get_improvement_suggestions`** — feed framework-aware ideas into PM's ISC seed list

### Track-Bootstrap routing (NEW 2026-05-15)

**Before auto-classification, check track-bootstrap pattern fit** per `MEMORY/CANONICAL/track-bootstrap-pattern.md`:

- **Pattern fits when** the request describes a **NEW external integration provider** with ≥5 sub-APIs/surfaces, its own OAuth-scope domain, rate-limit regime, and resource model. Examples: "build a Google Merchant API package" (9 sub-tracks), "add Stripe billing" (usually fits if multi-resource), "wire up Resend with templates + webhooks + audiences" (3-5 sub-tracks).
- **If pattern fits:** this is NOT a DeliverFeature run — it's a track-bootstrap run. Route to `Skill("utilities", "track-bootstrap: ${TRACK_NAME}")` OR manually run `bun ~/Durante/Tools/scaffold-track.ts --track ${TRACK_ID} --stack ${STACK_NAME} --provider ${PROVIDER_KEBAB} --sub-tracks ${N}` plus the 4 parallel research workstreams from the scaffold's parallelism contract. The scaffold produces a parent research PRD + ${SUB_TRACK_COUNT} sub-track PRD stubs; each sub-track PRD then re-enters this `DeliverFeature` workflow individually after operator G1 approval.
- **If pattern does NOT fit:** continue with step 3 (auto-classify) below — this is a normal DeliverFeature run.

**Why this routing exists:** 3 historical runs proved the pattern (social-stack B1/B2/B3 Meta/IG/TikTok; B4 Google Business Profile; commerce-stack GM Google Merchant). Without this callout, an operator delivering a 9-sub-track provider would force-fit it into the 8-phase pipeline and end up with one mega-PRD instead of a properly decomposed track. Scaffold lives at `~/.claude/DOS/Scaffolds/track-bootstrap/`.

3. **Auto-classify feature scope** (no operator confirmation step). The agent extracts the per-run SIGNALS — file count from the request, whether the request reads as a "fix"/"tweak"/"patch", whether it touches the auth/billing/RBAC/policies/multi-tenancy boundary — and `classifyFeatureScope()` in `Tools/MakerkitCli.ts` applies the deterministic rule (≤2 files OR fix-like → `small`+route-to-QuickFix; 11+ files OR sensitive boundary → `large`; else `medium`; boundary precedence: a sensitive-boundary touch is never small). Both file-count boundaries and the precedence rule are covered in `Tools/__tests__/MakerkitCli.test.ts`.
   ```bash
   # stdin: {fileCount: N, isFixLike: bool, touchesSensitiveBoundary: bool}
   # prints {scope, reasons, routeToQuickFix}; small -> suggest QuickFix and exit.
   echo "$SCOPE_SIGNALS_JSON" \
     | bun ~/.claude/skills/makerkit-team/Tools/MakerkitCli.ts classify-scope
   ```
   - On `scope: small` (`routeToQuickFix: true`) → suggest `QuickFix` workflow instead and exit.
   - `reasons` are logged in PRD `## Decisions`. Operator can override at G1.
4. Create PRD stub at `MEMORY/WORK/{slug}/PRD.md` with frontmatter only
5. Show roster summary so operator knows which roles will contribute

<!-- partial: _intent-to-flag-table.md skill_name=MakerkitTeam workflow_name=DeliverFeature -->
## Intent-to-Flag Mapping

Operator-facing intent → workflow routing/scope decisions. The pipeline auto-classifies based on these signals (Phase 0 step 3); operator overrides at G1.

### Scope Classification

| Operator intent / signal | Scope flag | Pipeline behavior |
|---|---|---|
| "fix", "tweak", "patch", "small change" OR ≤2 files mentioned | `small` | Suggest `QuickFix` workflow and EXIT (don't run full pipeline) |
| Default (3-10 files OR single feature surface) | `medium` | Full pipeline; 13 agents, all 8 phases |
| 11+ files OR touches auth/billing/RBAC/policies/multi-tenancy boundary | `large` | Full pipeline + extra Council debate at G2 for tradeoffs |

### Routing / Pattern Recognition

| Operator intent / signal | Routing decision | Where to go instead |
|---|---|---|
| "NEW external integration provider", ≥5 sub-APIs, distinct OAuth-scope domain, own rate-limit regime (e.g., "Google Merchant", "Stripe billing", "Resend templates+webhooks+audiences") | `track-bootstrap` (NOT DeliverFeature) | `Skill("utilities", "track-bootstrap: ${NAME}")` — produces parent + sub-track PRDs; each sub-track re-enters DeliverFeature after G1 |
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
| UI Designer needs mockups / illustrations / brand-aware icons | `Skill("media")` + `Skill("design-system", "apply")` | Phase 2 UI (≤2 calls each; verify components_search first) |
| New user-facing copy needed | `Skill("brand", "research")` | Phase 2 UX (1 call per feature) |
| Design tradeoff with no clear winner | `Skill("thinking", "council on <X>")` | G4 (M1a) wired; G2 escape |
| Code-producing run reaches EXECUTE→VERIFY boundary | `Skill("code-review", "high")` | Mandatory per the doctrine resolved via `~/.claude/DOS/Algorithm/LATEST` |

## Phase 1 — Discovery (PM solo)

**Agent:** `pm` (Product Manager)
**Brief includes:** user request verbatim, framework digest §1-2, scope classification
**Outputs:** PRD `## Context` + `## Criteria` (atomic ISCs), user story breakdown, anti-criteria

### MCP Touchpoints (Phase 1)

- **`mcp__makerkit__add_user_story`** — when the kit project independently uses Makerkit-native PRDs, mirror each user story from the DOS PRD
- **`mcp__makerkit__update_story_status`** — keep the kit-native story status in sync as phases advance (only if kit-native PRDs are in use)
- DOS PRD ledger remains canonical — `create_prd` is NOT used for the DOS PRD itself

### Skill Composition (Phase 1, per `Workflows/_skill-composition.md`)

- PM → `Skill("research")` fires when the ISC seed contains competitive references, market sizing claims, or named libraries/SDKs. Cost guard: ≤3 calls; beyond that, `AskUserQuestion` triage. Failure mode: claim flagged `⚠️ unverified` in PRD `## Context`. Skip path: internal-only features with no external referents.

### SeedScope match (Phase 1, structural — RFC-0154 row `feature-scope-archetypes`, mandatory-or-declined at warn)

Before G1, run the archetype scope match — this step is structural, not opt-in (roadmap D1; it was orchestrator-improvised in the media Step-0 receipt):

1. `Skill("archetypes", "seed scope ISCs for <feature>")` → SeedScope Step 1 matches the feature against the corpus (`bun ~/.claude/skills/archetypes/Tools/RenderArchetype.ts --list`).
2. **On match:** the seeded `## Criteria (scope layer — seeded from archetype <name> v<version>)` block lands in the PRD before G1; every T1 row is build-or-DEFERRED-with-reason, never silently absent. Phase 1.5 then decomposes the "build" scope rows into implementation ISCs.
2b. **On match, render the matrix into the work folder** — `bun ~/.claude/skills/archetypes/Tools/RenderArchetype.ts <name> --out MEMORY/WORK/{slug}/archetype-<name>.md` — and list that path in the PM brief's context files. Phase 2's architect brief includes the same path. Briefs cite the matrix by path (agents Read it); never inline the full table into prompt text.
3. **On no-match or decline:** exactly one line in PRD `## Decisions` — `Declined: Archetypes/SeedScope — <reason>` ("no archetype coverage for <domain>" is a valid reason and is itself signal: consider AuthorArchetype after delivery).

Warn-mode contract (RFC-0154 §8): an unaddressed match is reported at VERIFY, never failed on. Do not skip silently — invoke-or-decline is the whole contract.

**Operator gate G1:** Approve PRD (auto-classified scope is shown — operator can override) before Phase 2.

## Phase 1.5 — Decompose ISCs (mandatory, between G1 and Phase 2)

**Why this exists:** prd-projector baseline 2026-05-17 found 9 of 40 dos-prisma-saas-kit PRDs (and 9 of 28 altyaa) shipped with `## ISCs (placeholder; populate at G1)` — the MakerkitTeam.DeliverFeature workflow authored the PRD shape at Phase 1 end, operator approved at G1, then the workflow proceeded to Phase 2 without populating atomic ISCs. The placeholder pattern is isolated to kit-team workflows (Durante has zero such PRDs). Council 2026-05-17 (Young + Evans + Metz) ratified this micro-step to close the gap at source.

**Mandate:** before Phase 2 agents spawn, the workflow MUST verify the PRD's `## ISCs` (or `## Criteria`) section is fully populated with atomic ISCs — no `placeholder`, no `populate at G1` strings, no category-count estimates without enumerated `- [ ] ISC-N:` lines.

**Procedure:**

1. Run `bun ~/Durante/Tools/prd-projector.ts characterize --root MEMORY/WORK --format jsonl | grep "<PRD-slug>"` (or pipe to a per-PRD filter).
2. Pipe the per-PRD record into the gate. `validateDecomposeGate()` + `renderDecomposeGate()` in `Tools/MakerkitCli.ts` own the three-check verdict (no placeholder, `isc_count` within ±10% of the approved scope, `fat_isc_count: 0` OR every fat ISC carries a `pairing-exception:` line per R70) and the byte-preserved status line. Covered in `Tools/__tests__/MakerkitCli.test.ts`.
   ```bash
   # stdin: {record: <prd-projector record>, expectedIscCount: <G1 scope>, slug: "<PRD-slug>"}
   # prints the DECOMPOSE-GATE line; exits nonzero on BLOCKED.
   jq -n --argjson rec "$PRD_RECORD" --argjson n "$APPROVED_ISC_COUNT" --arg slug "$PRD_SLUG" \
     '{record: $rec, expectedIscCount: $n, slug: $slug}' \
     | bun ~/.claude/skills/makerkit-team/Tools/MakerkitCli.ts decompose-gate
   ```
3. If the gate prints `BLOCKED` (nonzero exit) → PM agent must populate / decompose / fix BEFORE the Phase 2 parallel spawn fires.
4. **Operator override** (rare): add `Override decompose-gate: <reason>` line to PRD `## Decisions`. Surfaces in audit but does not block.

**Output (emitted by `renderDecomposeGate`):** `📋 DECOMPOSE-GATE: <PRD-slug> · isc_count=N · placeholder=false · fat=0 — OK` (or `BLOCKED: <reasons>`).

## Phase 2 — Design (parallel: UX + UI + Architect)

**Agents:** `ux`, `ui`, `architect`
**Pre-Delegation Contract (mandatory):**
- UX owns: user flow doc, journey map, a11y notes, form UX patterns
- UI owns: component visual spec, Tailwind token decisions, render-prop composition plan
- Architect owns: package placement decision, server vs client boundary, RBAC/policy sketch
- No overlap. Each agent writes to its own subsection in PRD `## Design`

**Briefs include:** PRD slug, framework digest slice (§9 for UI, §1-2 for UX, §2-4 for Architect), and — when Phase 1 recorded an archetype match — `MEMORY/WORK/{slug}/archetype-<name>.md` (Architect brief)

**Team spawn (per `Workflows/_algorithm-team-spawn.md` degradation ladder):** default rung L2 Agent fan-out. Single message, three parallel `Agent` calls — one per role (`ux`, `ui`, `architect`); each `subagent_type: "general-purpose"`, `name: <role-id>`, `model: "sonnet"`, `run_in_background: true`, prompt composed via `Tools/BuildBrief.ts` + saved composition + Pre-Delegation Contract slice + the per-stream template from the partial. L1 team choreography ONLY if the Phase 0 capability manifest confirms team primitives. Rendezvous: structured returns or report files at `MEMORY/WORK/{slug}/reports/<role>.md`; cross-check claims per Algorithm §6.6; run `contract-check` on each returning stream (command in Phase 4); mark ISCs `[ ]→[x]` in PRD; run G2 gate.

### Skill Composition (Phase 2, per `Workflows/_skill-composition.md`)

- UI Designer → `Skill("media")` for mockups / illustrations / brand-aware icons (verify via `mcp__makerkit__components_search` first; cost guard ≤2 calls; failure → `mockup-pending` flag) + `Skill("design-system", "apply")` to render Tailwind tokens into shadcn-compatible component scaffolds
- UX Designer → `Skill("brand", "research")` for voice/microcopy/a11y when new user-facing copy lands (1 call per feature; failure → fall back to kit's existing copy patterns in `apps/web/content/`)
- Architect → `Skill("thinking", "council on <decision>")` already wired via G4 (M1a) for cross-cluster contradictions; this remains the operator-gate escape for Phase 2

**Operator gate G2:** Review the three artifacts. May request revisions or add a Council debate via `Skill("thinking", "council on <decision>")` before Phase 3.

## Phase 3 — Schema (DB Engineer mandatory)

**Always runs.** Per v0.1.0 policy, Database Engineer always weighs in — even when no schema changes are needed (output: explicit "no schema changes required, here's why" memo with citations to existing schema). Never skipped.

**Agent:** `database` (Database Engineer)
**Brief includes:** PRD, Architect placement decision, framework digest §7
**Required outputs:**
- If schema changes: schema.prisma diff, migration name, backfill plan if NOT NULL on populated table, index strategy with `organizationId` scoping
- If no schema changes: written confirmation citing the relevant schema sections, with rationale for why existing tables suffice
**Cross-skill:** the `database` role SHOULD invoke `Skill("prisma-expert")` (kit-local skill, shipped) for schema design, migration review, relations, and query patterns.

### MCP Touchpoints (Phase 3)

- **`mcp__makerkit__get_database_summary`** + **`mcp__makerkit__get_database_tables`** — Architect AND Database read these before deciding placement / new model
- **`mcp__makerkit__get_table_info`** for each candidate table — verifies existing columns before proposing additions
- **`mcp__makerkit__search_database_functions`** — discover existing helpers before authoring new functions
- **`mcp__makerkit__generate_migration`** — Database role's primary write tool (instead of hand-editing migration SQL)
- **`mcp__makerkit__kit_db_status`** — confirm DB up before generate_migration; the migration is staged not applied at this phase
- **`mcp__makerkit__apply_migrations`** is DEFERRED to Phase 7 (DevOps) — not run at G3

**Operator gate G3:** Schema diff (or no-changes-needed memo) must be approved before any code is written.

### Layer-map gate (named step — right after the schema/decompose phase, before Phase 4 spawns)

Every ISC must carry exactly one canonical test-layer label (`unit-covered` / `e2e-covered` / `verification-only (justified)` / `documentation-only`) — seeded during Phase 1.5 decomposition, finalized in the Phase 5 Test Pyramid Plan. `validateLayerMap()` in `Tools/MakerkitCli.ts` owns the check:

```bash
# stdin: {iscs: [{id: "ISC-1", label: "unit-covered"}, ...]}
# exit 0 prints "PASS ... layer-map-check: N/N ISC labeled"; nonzero exit prints BLOCK listing unlabeled/invalid ISCs
echo "$ISC_LAYER_JSON" | bun ~/.claude/skills/makerkit-team/Tools/MakerkitCli.ts layer-map-check
```

On BLOCK (nonzero exit): route the flagged ISCs to PM/QA for labeling BEFORE the Phase 4 spawns fire.

## Phase 4 — Implementation (parallel: Frontend + Backend)

**Agents:** `frontend`, `backend`
**Pre-Delegation Contract (mandatory):**

```
### Pre-Delegation Contract (agents: {frontend, backend})
- Naming:
  - actions in `apps/web/app/[locale]/(internal)/<feature>/_lib/actions/<feature>-server-actions.ts` (kit convention: `{feature}-server-actions.ts`)
  - schemas in `apps/web/app/[locale]/(internal)/<feature>/_lib/schemas/<feature>.schema.ts`
  - loaders in `_lib/loaders/<feature>-page.loader.ts`
  - components in `_components/`
- Ownership:
  - frontend: page.tsx, layout.tsx, _components/, loaders, i18n JSON deltas
  - backend: actions, schemas, policy registrations, Better Auth plugin code, webhook handlers
- Shared interfaces:
  - Zod schema in schemas/ is THE contract; frontend imports its inferred type
  - Server action return shape: `{ success: boolean; data?: T; error?: string }`
- Output: each agent returns `{ files_written: string[], errors: string[] }`
```

**Next.js docs first (mandatory, kit AGENTS.md):** before coding, each implementer reads the relevant Next.js doc under `apps/web/node_modules/next/dist/docs/` — training data is outdated; the shipped docs are the source of truth.

**Team spawn (per `Workflows/_algorithm-team-spawn.md` degradation ladder):** default rung L2 Agent fan-out. Single message, two parallel `Agent` calls — one per role (`frontend`, `backend`); each `subagent_type: "general-purpose"`, `name: <role-id>`, `model: "sonnet"`, `run_in_background: true`, prompt composed per the partial template + the contract slice above. L1 team choreography ONLY if the Phase 0 capability manifest confirms team primitives. Rendezvous: structured returns or report files at `MEMORY/WORK/{slug}/reports/<role>.md`; cross-check; orchestrator runs `Skill("code-review", "high")` on the combined diff; route /code-review findings to original implementer per v0.1.0 ISC-failure policy.

**Contract check (spawn-acknowledgment step):** as each stream's report lands, validate its writes against the roster ownership globs BEFORE accepting the report:

```bash
# stdin: {role: "<role-id>", files_written: [...]}
# exit 0 prints "PASS ... all writes in-glob"; nonzero exit prints BLOCK listing the out-of-glob files
echo "$STREAM_REPORT_JSON" | bun ~/.claude/skills/makerkit-team/Tools/MakerkitCli.ts contract-check
```

On BLOCK (nonzero exit): out-of-glob writes are a Pre-Delegation Contract violation — route back to the writing agent to revert or hand off before the gate. Applies at every parallel phase's rendezvous (2, 4, 5, 7).

**Cross-skill invocations agents should use:**
- Frontend: `Skill("frontend-design")` for component/design-system review when relevant; `Skill("react-form-builder")` (kit-local skill, shipped) for client-side forms (react-hook-form + @kit/ui/form + next-safe-action integration).
- Backend: `Skill("server-actions-expert")` (kit-local skill, shipped) for next-safe-action server actions with `@kit/action-middleware` protection.

### MCP Touchpoints (Phase 4)

- **`mcp__makerkit__components_search`** (Frontend MUST call before authoring a new component) — duplication-prevention; surface the candidate components in the implementer's response
- **`mcp__makerkit__get_component_content`** + **`mcp__makerkit__get_component_props`** for top candidates — read what's there before extending
- **`mcp__makerkit__kit_translations_update`** + **`mcp__makerkit__kit_translations_add_namespace`** — Frontend i18n key wiring (replaces hand-edits to namespace JSON)
- **`mcp__makerkit__kit_env_read`** — Backend reads env state before any action depends on a new env var (fail-fast on missing)
- **`mcp__makerkit__run_checks`** — orchestrator MUST invoke this on the combined diff after Frontend + Backend return, BEFORE `Skill("code-review", "high")`. Failures route to the original implementer per v0.1.0 ISC-failure policy. If mcp__makerkit__run_checks is unavailable (server not connected — check the capability manifest from `bun Tools/MakerkitCli.ts preflight`), fall back to the read-only ladder `pnpm lint && pnpm typecheck && pnpm test:unit`. NEVER run `pnpm healthcheck` in review/read-only contexts — it mutates files.

**After both return (Phase 4 inline, not a separate gate):** Orchestrator runs `Skill("code-review", "high")` on the combined diff, then the kit's adversarial reviewer — `Skill("reviewer")` — on the same diff (kit AGENTS.md verification step). All findings are appended to PRD `## Decisions → ### /code-review Findings`. If a finding requires a code change, the original implementer (frontend or backend, by ownership) re-runs to address it BEFORE G4. /code-review and /reviewer are part of BUILD, not gates of their own.

**Archetype completeness pass (only when Phase 1 recorded an archetype match):** run `Skill("archetypes", "audit this feature against <name>")` — AuditFeature diffs the combined implementation against the matched matrix; every T1 row neither implemented nor carrying a DEFERRED/WAIVED line in the PRD scope block is a finding, appended to `### /code-review Findings` with the row id cited. Route findings like any other review finding (owning implementer, BEFORE G4). Skip silently when Phase 1 recorded no-match or a `Declined:` line. (/code-review reads the diff; spec-verify reads the PRD; this pass reads the MARKET TABLE — missing capabilities are invisible to the other two by construction.)

**Spec-anchored verify (Phase 4 inline, after /code-review + /reviewer, BEFORE G4):** the orchestrator — PRIMARY only; this native workflow cannot be nested inside another workflow's subagent — runs the spec-gate: `Workflow({ name: "spec-verify-in-loop", args: { specPath: "MEMORY/WORK/active/<slug>/PRD.md", artifactRef: "git diff --staged", scope: "v1" } })`. The SpecVerifier RE-DERIVES the PRD's obligation set BEFORE reading the artifact (anti-priming), checks each obligation, and the script returns a deterministic gate verdict `pass | drift | fail | inconclusive`. Routing: `drift`/`fail` → unmet obligations go to the owning implementer (frontend or backend) and re-verify BEFORE G4; `inconclusive` → surface the unmet-obligation list to the operator AT G4. Complementary by design: /code-review reads the DIFF for correctness; spec-verify catches SPEC-drift the diff-reader structurally misses. Verdict + obligation roll-up are appended to PRD `## Decisions → ### Spec-Verify Verdict`.

**Operator gate G4:** Review code changes (with /code-review findings already addressed). Approve to proceed to hardening.

## Phase 5 — Hardening (parallel: Security + QA)

**Agents:** `security`, `qa`
**Pre-Delegation Contract:**
- Security owns: threat model, RBAC permission grants review, policy correctness review, rate-limit key namespacing, PII review
- QA owns: **Test Pyramid Plan** with per-ISC layer mapping (per `Workflows/_test-pyramid-gate.md`), edge case enumeration, regression risk list

**Briefs include:** PRD with all phases 1-4 outputs, framework digest §5 (Better Auth) + §4 (RBAC/policies) for security; full PRD + framework digest §10 (Testing) + `Workflows/_test-pyramid-gate.md` for QA.

**QA's Test Pyramid Plan structure:** the per-ISC layer mapping table from `_test-pyramid-gate.md` lives in PRD `## Decisions → ### Test Pyramid Plan`. Every ISC tagged `unit-covered` / `e2e-covered` / `verification-only (justified)` / `documentation-only`. Phase 6 sub-agents cite this plan when authoring tests.

**Team spawn (per `Workflows/_algorithm-team-spawn.md` degradation ladder):** default rung L2 Agent fan-out. Single message, two parallel `Agent` calls — one per role (`security`, `qa`); each `subagent_type: "general-purpose"`, `name: <role-id>`, `model: "sonnet"`, `run_in_background: true`, prompt composed per the partial template + Pre-Delegation Contract slice. L1 ONLY if the capability manifest confirms team primitives. Rendezvous: structured returns or report files at `MEMORY/WORK/{slug}/reports/<role>.md`; cross-check; run `contract-check` per stream; mark ISCs `[ ]→[x]` in PRD; run G5 gate.

### Skill Composition (Phase 5, per `Workflows/_skill-composition.md`)

- Security → `Skill("security", "web assessment")` when the feature exposes new HTTP surfaces (server actions, webhook endpoints, public routes); `Skill("security", "annual reports" | "news")` for third-party integrations (Stripe, Resend, Better Auth provider, Sentry). Cost guard: 1 web-assessment + ≤3 vendor lookups. Failure → static OWASP checklist fallback + `⚠️ recon-not-run` flag.
- Skip path: feature exposes no new HTTP surface AND touches no third-party integration.

**Operator gate G5:** Approve the threat model + Test Pyramid Plan before Phase 6.

## Phase 6 — Verification (split: 6a Unit + 6b E2E)

This phase enforces the **ships-with-tests gate** from `Workflows/_test-pyramid-gate.md`. Both sub-phases must complete green before G6 closes.

### Phase 6a — Unit (QA solo)

**Agent:** `qa`
**Brief includes:** Test Pyramid Plan from Phase 5, FrameworkDigest §10.1–10.5, `Workflows/_test-pyramid-gate.md`
**Required outputs:** Vitest tests in `__tests__/<name>.test.ts` adjacent to every business-logic ISC's implementation (per Test Pyramid Plan). Each test green when run via `pnpm --filter @kit/<pkg> test:unit`.
**Run:** `pnpm --filter @kit/<pkg> test:unit` per affected package, then `pnpm test:unit` aggregate. Capture output verbatim into PRD `## Verification → ### Unit-layer evidence`.

#### MCP Touchpoints (Phase 6a)

- **`mcp__makerkit__run_checks`** — invoke after unit suite green; runs typecheck + lint + format + package consistency (via the kit's real toolchain — oxlint + oxfmt, per the preflight manifest's `lintTool`). Failures here invalidate Phase 6a. If mcp__makerkit__run_checks is unavailable (server not connected — check the capability manifest from `bun Tools/MakerkitCli.ts preflight`), fall back to the read-only ladder `pnpm lint && pnpm typecheck && pnpm test:unit`. NEVER run `pnpm healthcheck` in review/read-only contexts — it mutates files.

### Phase 6b — E2E (E2E Tester solo)

**Agent:** `e2e`
**Brief includes:** Test Pyramid Plan from Phase 5, FrameworkDigest §10.1–10.6 (including bootstrap helpers + Page Object pattern), `Workflows/_test-pyramid-gate.md`
**Cross-skill:** the `e2e` role SHOULD invoke `Skill("playwright-e2e-expert")` (kit-local skill, shipped) for spec authoring — bootstrap helpers, page objects, polling assertions, mailpit assertions per FrameworkDigest §10.
**Required outputs:** `apps/e2e/tests/<feature>/<feature>.spec.ts` + paired `<feature>.po.ts` for every user-facing ISC (per Test Pyramid Plan). Specs use bootstrap helpers for auth setup (no UI login from scratch unless testing the login flow itself). New interactive elements have `data-testid` (kebab-case). Polling assertions for any async behavior.
**Run:**

```bash
pnpm --filter web build:test
pnpm --filter web start:test                                    # separate terminal
pnpm --filter web-e2e exec playwright test <feature> --workers=1
```

Capture output into PRD `## Verification → ### E2E-layer evidence`.

### Skill Composition (Phase 6, per `Workflows/_skill-composition.md`)

- QA → `Skill("prisma-expert")` (kit-local) for PgLite-backed Vitest patterns when tests touch the database layer
- E2E → `Skill("playwright-e2e-expert")` (kit-local) while authoring/debugging specs; the canonical `pnpm --filter web-e2e exec playwright test <feature> --workers=1` run is the evidence source for PRD `### E2E-layer evidence`. Cost guard: ONE feature at a time (kit dev server is single-tenant locally); pyramid gate G6 NOT relaxed.

**Operator gate G6 (pyramid-complete):** All six ships-with-tests checks green per `Workflows/_test-pyramid-gate.md`. The agent observes each of the six booleans (each from a deterministic command — `pnpm test:unit`, `playwright test`, `mcp__makerkit__run_checks`, plus the data-testid/bootstrap/PRD-mapping inspections); `validateTestPyramidGate()` in `Tools/MakerkitCli.ts` applies the AND over all six and lists which failed (it passes only when all six are true). Both sides of the pass boundary (all-true vs each-one-false) are covered in `Tools/__tests__/MakerkitCli.test.ts`:

1. Unit-layer green (`unitLayerGreen`)
2. E2E-layer green (`e2eLayerGreen`)
3. `mcp__makerkit__run_checks` clean (`runChecksClean`)
4. `data-testid` (kebab-case) on new interactive elements (`dataTestIdKebabCase`)
5. Bootstrap helpers used for e2e auth setup (`bootstrapHelpersUsed`)
6. Per-ISC layer mapping documented in PRD `### Test Pyramid Plan` (`perIscLayerMappingDocumented`)

```bash
# stdin: {unitLayerGreen, e2eLayerGreen, runChecksClean, dataTestIdKebabCase, bootstrapHelpersUsed, perIscLayerMappingDocumented}
# prints {ok, failed:[...]}; nonzero exit when any of the six is false.
echo "$PYRAMID_CHECKS_JSON" \
  | bun ~/.claude/skills/makerkit-team/Tools/MakerkitCli.ts pyramid-gate
```

**ISC-failure remediation policy (unchanged from v0.1.0):** failed ISCs route back to **original implementer** (frontend or backend, by code ownership) with failure context, file:line of failing assertion, expected-vs-actual behavior, and a constraint to make the smallest possible surgical fix. After the fix, the affected sub-phase (6a or 6b) re-runs the failing test only. Three consecutive failures from the same agent → escalate to operator.

**Strike ledger (binding):** consecutive failures live in `MEMORY/WORK/{slug}/strike-ledger.json`, shape `{"<isc-id>": {"<agent>": <n_consecutive_failures>}}`. Increment the agent's counter on each failed re-verification; reset it to 0 when the ISC passes. Escalation reads the file — any counter at 3 triggers the operator escalation above. Same ledger serves every workflow's 3-strike rule.

## Phase 7 — Ship (parallel: DevOps + Writer)

**Agents:** `devops`, `writer`
**Pre-Delegation Contract:**
- DevOps owns: env var manifest delta (`apps/dev-tool` registration), Docker layer impact, migrate-deploy plan, healthcheck wiring, Sentry/monitoring deltas, deploy checklist, rollback plan
- Writer owns: `docs/<domain>/<feature>.mdoc` content, AGENTS.md notes if conventions added, `apps/web/content/changelog/YYYY-MM-DD-<slug>.mdoc`, in-app help under `apps/web/content/documentation` if user-facing

**Team spawn (per `Workflows/_algorithm-team-spawn.md` degradation ladder):** default rung L2 Agent fan-out. Single message, two parallel `Agent` calls — one per role (`devops`, `writer`); each `subagent_type: "general-purpose"`, `name: <role-id>`, `model: "sonnet"`, `run_in_background: true`, prompt composed per the partial template + Pre-Delegation Contract slice. L1 ONLY if the capability manifest confirms team primitives. Rendezvous: structured returns or report files at `MEMORY/WORK/{slug}/reports/<role>.md`; cross-check; run `contract-check` per stream; mark ISCs `[ ]→[x]` in PRD; run G7 gate.

### MCP Touchpoints (Phase 7)

- **`mcp__makerkit__kit_env_schema`** + **`mcp__makerkit__kit_env_read`** — DevOps verifies env-var hygiene; cross-checks the new vars listed in the deploy checklist
- **`mcp__makerkit__kit_env_update`** — DevOps applies validated env updates locally to confirm schema acceptance (production update goes through the deploy pipeline, not this tool)
- **`mcp__makerkit__kit_dev_status`** — DevOps confirms healthy local state before declaring deploy readiness
- **`mcp__makerkit__deps_upgrade_advisor`** — DevOps optionally inspects dep risk for the changeset
- **`mcp__makerkit__kit_translations_stats`** — Writer surfaces i18n coverage before claiming "docs complete"
- **`mcp__makerkit__apply_migrations`** — DEFERRED to deploy pipeline; document the call in the deploy checklist, do NOT invoke at G7

### Skill Composition (Phase 7, per `Workflows/_skill-composition.md`)

- Writer → `Skill("dispatch", "Enhance")` runs Tier 1 polish (clarity, voice, link verification) on changelog mdoc + in-app help mdoc once first-draft text is in hand; same pipeline that polishes blog posts. 1 call per feature.
- Writer → `Skill("research", "DocsLookup")` when docs cite an external framework version or SDK API surface (citation-grounding). ≤2 lookups per docs bundle.
- Failure mode: Dispatch unavailable → ship unpolished draft + `### docs-enhance-deferred` flag. Research unavailable → unverified citations marked `⚠️ check-on-revisit`.
- Skip path: feature is operator-internal (no changelog/mdoc entry).

**Healthcheck before the batch commit (MUTATING — run it exactly here):** `pnpm healthcheck` runs `oxlint --fix && oxfmt && typecheck && manypkg fix` and WRITES to the working tree. The delivery pipeline runs it ONCE, immediately BEFORE the batch commit, and commits its mutations as part of that commit. Never run it in review/read-only contexts or exploratory checks — the read-only ladder there is `pnpm lint && pnpm typecheck && pnpm test:unit`.

**PR creation (per `Workflows/_commit-merge.md`):** the DevOps agent supplies the judgment content — the 1-3 `## Summary` bullets and the `## Test plan` checklist items. `renderPrBody()` in `Tools/MakerkitCli.ts` owns the deterministic body skeleton (headings, bullet/checkbox markers, blank-line spacing, and the `Co-Authored-By: DuranteOS <tech@duranteos.com>` trailer) — covered in `Tools/__tests__/MakerkitCli.test.ts`. Open the feature PR with the rendered body:

```bash
# stdin: {summary: [<1-3 bullets>], testPlan: [<checklist items>]}
BODY=$(jq -n --argjson s "$SUMMARY_BULLETS_JSON" --argjson t "$TEST_PLAN_JSON" \
  '{summary: $s, testPlan: $t}' \
  | bun ~/.claude/skills/makerkit-team/Tools/MakerkitCli.ts pr-body)
gh pr create --title "feat(<scope>): <concise ≤70>" --body "$BODY"
```

Branch convention: `feat/<feature-slug>`. NEVER push to `main`. Pre-commit hook failure → fix and NEW commit (no `--amend`).

**Operator gate G7:** Approve docs and deploy plan.

## Phase 8 — Wrap (Scrum Master)

**Agent:** `sm` (Scrum Master)
**Brief includes:** all phase outputs, PRD path, ISC verification matrix
**Required outputs:**
- Delivery summary (≤200 words)
- Blocker list (any unresolved issues)
- Follow-on bucket (≤3 concrete tasks for next iteration)
- Retro notes (what worked, what didn't — feeds next feature's coordination)

**No gate — informational only.** Update PRD frontmatter `phase: complete` and `progress: N/N` automatically.

## Failure Modes & Remediation

| Failure | Remediation |
|---|---|
| Agent A's output contradicts agent B's | Spawn Council via Task tool (see "Council on Contradiction" below) |
| ISC fails at Phase 6 | Original implementer (frontend/backend by ownership) re-spawned with surgical-fix constraint. After 3 consecutive failures from same agent (per `MEMORY/WORK/{slug}/strike-ledger.json`), escalate to operator. |
| Phase 5 surfaces unfixable security issue | Halt pipeline, escalate to operator with risk options |
| `/code-review` flags major duplication | Architect spawned solo to design extraction, then Phase 4 re-runs with shared helper |

### Council on Contradiction (concrete spawn)

When two phase-agent outputs disagree on a load-bearing decision (schema shape, auth model, library choice), invoke Thinking's Council/Debate workflow via a single Task spawn. Pass the conflicting positions as Round 0 context so the debate starts from the actual disagreement, not first principles:

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
- `design_spec` — Phase 2 (UX/UI/Architect)
- `architecture_decision` — Phase 2 (Architect specifically)
- `threat_model` — Phase 5 (Security)
- `test_plan` — Phase 5 (QA)
- `delivery_summary` — Phase 8 (SM)

## v0.0.1 Operator Notes

This workflow is a checklist, not automation. The orchestrator (you) is the load-bearing coordinator. As features are delivered:
1. Note where the operator gates added value vs slowed work
2. Note which Pre-Delegation Contract fields were violated → tighten template
3. Note which cross-skill invocations the agents skipped → make mandatory
4. Note where parallel batches collided → adjust ownership boundaries

Promote tuning insights into this workflow file directly. The skill version-bumps as the workflow tightens.
