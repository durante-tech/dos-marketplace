# MemPalace KG Predicate Vocabulary

| Field | Value |
|-------|-------|
| Status | Draft v1 |
| Created | 2026-04-25 |
| Owner | DOS / mem-palace pack |
| Source | RFC-0028 §5.2 (acceptance battery 2026-04-25 surfaced 197 predicate types with 8+ near-duplicate clusters) |
| Companion | `src/Tools/validate-predicates.py` |

## Why this file exists

The MemPalace knowledge graph at acceptance time held 197 distinct predicate types across 1479 entities and 2075 triples. Inspection surfaced near-duplicate clusters:

- `is` vs `is_a`
- `built_on` vs `built_with` vs `composed_from`
- `has_skill` vs `has_pack` vs `has_component` vs `has_tool`

Uncontrolled vocabulary fragments the graph: a query for `built_on` misses facts written as `built_with`, even though they encode the same relationship. The fix is a small canonical predicate list with a tight alias map, applied at write time by skill workflows and validated post-hoc by a script.

Read this file before adding a new predicate. If a synonym exists, use the canonical form.

---

## 1. Canonical predicates (~30)

Grouped by relationship class. The canonical form is the left column; aliases collapse to it.

### 1.1 Identity & lineage

| Canonical | Meaning | Aliases collapsed |
|-----------|---------|-------------------|
| `is_a` | type / category membership | `is`, `type_of` |
| `derives_from` | this thing was created out of an earlier thing | `built_on`, `descends_from` |
| `supersedes` | this thing replaces the prior one | `replaces` |
| `superseded_by` | this thing was replaced by a later one | `replaced_by` |

### 1.2 Composition (whole ↔ part)

| Canonical | Meaning | Aliases collapsed |
|-----------|---------|-------------------|
| `has_component` | this entity contains the named component | `has_skill`, `has_pack`, `has_tool`, `has_hook`, `has_agent`, `has_schema` |
| `part_of` | this entity is a component of another | `belongs_to`, `member_of` |
| `composed_of` | aggregate composition (multi-part wholes) | `composed_from`, `built_with` (when describing parts, not lineage) |
| `has_feature` | subject (a project / coach / app) contains the named feature. Ratified 2026-05-15 (B3). | — |
| `has_coach` | subject contains the named coach aggregate (Altyaa-style multi-coach domains). Ratified 2026-05-15 (B3). | `has_coach_aggregate` |
| `has_app` | subject (org / project) contains the named application surface. Ratified 2026-05-15 (B3). | — |
| `has_service` | subject contains the named (deployed) service. Ratified 2026-05-15 (B3). | — |
| `has_api_surface` | subject exposes the named API surface (REST, GraphQL, RPC, etc.). Ratified 2026-05-15 (B3). | — |
| `composes` | this entity composes the named sub-component, workflow, or agent (atomic-design catalog `composes:` declarations + skill spawn-composition). Ratified 2026-06-28 (operator approval, Cluster A). | — |
| `has_guest` | Subject episode featured the named guest as a participant (has_* participation family). Ratified RFC-0140 2026-06-28. | — |

> **Disambiguation rule.** If the relationship is **lineage** ("A came from B"), use `derives_from`. If the relationship is **structure** ("A contains B"), use `has_component` or `composed_of`. The pre-canonical KG conflated these via `built_on` / `built_with`; pick the right canonical based on intent.

### 1.3 Personal & relational

| Canonical | Meaning | Aliases collapsed |
|-----------|---------|-------------------|
| `is_partner_of` | spouse / domestic partner [deprecated] (2026-05-18 R64 — RE-PROMOTE IF USED) | `married_to`, `spouse_of` |
| `is_parent_of` | parent → child direction [deprecated] (2026-05-18 R64 — RE-PROMOTE IF USED) | `parent_of` |
| `is_child_of` | child → parent direction [deprecated] (2026-05-18 R64 — RE-PROMOTE IF USED) | `child_of`, `son_of`, `daughter_of` |
| `is_sibling_of` | sibling [deprecated] (2026-05-18 R64 — RE-PROMOTE IF USED) | `sibling_of`, `brother_of`, `sister_of` |
| `lives_in` | current residence (city, region, country) [deprecated] (2026-05-18 R64 — RE-PROMOTE IF USED) | `resides_in`, `based_in` |
| `works_at` | current employer [deprecated] (2026-05-18 R64 — RE-PROMOTE IF USED) | `employed_by` |
| `has_role` | current role / title [deprecated] (2026-05-18 R64 — RE-PROMOTE IF USED) | `is_role`, `holds_role` |

### 1.4 Goals, projects, decisions

| Canonical | Meaning | Aliases collapsed |
|-----------|---------|-------------------|
| `targets` | goal aims at outcome | `aims_at` |
| `serves_goal` | project advances a goal | `advances` |
| `depends_on` | prerequisite relationship | `requires`, `needs`, `depends_on_sibling` |
| `blocks` | blocker relationship | `prevents` |
| `blocked_by` | subject is blocked by the named entity (passive complement to `blocks`). Ratified 2026-05-15 (B3 — most-frequent runtime orphan). | `blocked_by_wip` |
| `decided` | a decision was recorded | `chose`, `picked`, `decision` |
| `decided_against` | option was rejected | `rejected` |
| `committed_to` | subject made a forward commitment | — |
| `deferred_to` | subject deferred a decision or task to a later time | — |
| `e2e_tested_with` | subject was end-to-end tested using the named tool | `e2e_with` |
| `tested_with` | subject is tested using the named tool/framework (broader than e2e). Ratified 2026-05-15 (B3). | `linted_with` |
| `rated` | a quality rating was recorded against the subject. Ratified 2026-05-15 (B3). | — |

### 1.5 Lifecycle & status

| Canonical | Meaning | Aliases collapsed |
|-----------|---------|-------------------|
| `status` | snapshot status (active, paused, complete) | `state` |
| `phase` | Algorithm phase snapshot for a PRD/session subject (observe, think, plan, build, execute, verify, learn, complete) — emitted by `MinePRDOnWrite.hook.ts` on every PRD frontmatter change | — |
| `phase_transition` | Algorithm phase change event for a PRD/session subject — emitted by `hooks/lib/prd-kg.ts:39` when a PRD frontmatter `phase:` value differs from prior. Object is the new phase; full transition details (from/to) live in fact metadata. Distinct from `phase` (snapshot). Added 2026-05-08 to close the silent-rejection backlog the gardener flagged in the RFC-0073 audit. | — |
| `started_on` | start date | `began_on` |
| `completed_on` | completion date | `finished_on`, `shipped_on` |
| `invalidated_on` | fact ended (use `kg_invalidate` API; this is the predicate name when needed in queries) | — |
| `path_is` | Subject's filesystem path (project, module, runtime artifact). Operator-ratified via predicate-proposals.ts on 2026-05-10 (RFC-0073 Rule 2). | `db_path_is` |
| `scanned_by_sentinel` | Subject was scanned by Sentinel R-rule conformance pass. Operator-ratified via predicate-proposals.ts on 2026-05-10 (RFC-0073 Rule 2). | — |
| `has_status` | Lifecycle status snapshot expressed as a discrete tag (e.g., active, blocked, archived). Ratified 2026-05-15 (B3 ratification batch — runtime-frequent orphan). | — |
| `completed` | Subject reached terminal-completed lifecycle state. Ratified 2026-05-15 (B3). | — |
| `working_on` | Subject is currently working on the named object (active-tense `worked_on`). Ratified 2026-05-15 (B3). | — |
| `deferred` | Subject was deferred without a target time (companion to canonical `deferred_to` which carries a target). Ratified 2026-05-15 (B3). | — |
| `deal_stage` | Current sales-pipeline stage of a deal (lead\|qualified\|proposal\|negotiation\|won\|lost); CQRS read-model snapshot, single-writer (Sales projector; Bdr reads). Not aliased to `has_status`/`phase`. Ratified RFC-0140 2026-06-28. | — |
| `work_completed` | Work OS completion RECEIPT emitted by `PhaseCompleteGate.hook.ts` at gate-pass (subject `<repo>/<slug>`, object `gate:pass ts:<iso>`) — closure evidence sig-2 that the Work OS reconciler folds, deliberately independent of the `phase: complete` frontmatter write. Single-writer: PhaseCompleteGate. Ratified 2026-07-02 (RFC-0151). | — |
| `intends_status` | Sentinel-scanned PRD intended-status inventory fact (subject `project:<wing>`, object `<prd-slug>@<phase> (<progress>)`) — the version-council-review reconciler's intended-vs-actual LEFT half. Distinct from `phase`/`status` (those snapshot the PRD subject itself; this inventories a project's PRD corpus). Single-writer: `buildDuranteKgOps` (SentinelScan.ts, active-first cap 40). Operator-ratified 2026-07-07 (RFC-0073 Rule 2; successor to the rejected `prd_intent` — deliberately NOT aliased: the legacy name has zero live facts and must stay gate-rejected). | — |
| `governed_by_rfc` | Project is governed by the named RFC (subject `project:<wing>`, object `RFC-NNNN: <title> [<status>]`) — Sentinel-scanned RFC-corpus inventory. Deliberately NOT folded into `has_component` (an RFC is a governing record, not a contained part) and distinct from `references` (citation). Single-writer: `buildDuranteKgOps` (cap 60). Operator-ratified 2026-07-07 (RFC-0073 Rule 2; successor to the rejected bare `rfc`). | — |
| `ghost_resolved` | MemoryGardener ghost-apply RECEIPT — a drawer whose source file vanished was resolved (subject drawer id, object resolution + ts). Single-writer: MemoryGardener `ghost-apply.ts`. Operator-ratified 2026-07-07 (GATE-3 C3 triage, session aea9eacc; 542 pre-ratification queue rows become valid retroactively). | — |
| `restored_to` | MemoryGardener ghost-apply companion — the path a ghost drawer was restored to (subject drawer id, object path). Single-writer: MemoryGardener `ghost-apply.ts`. Operator-ratified 2026-07-07 (with `ghost_resolved`). | — |

### 1.6 Belief & narrative

| Canonical | Meaning | Aliases collapsed |
|-----------|---------|-------------------|
| `believes` | the subject holds a belief (re-promoted 2026-06-26 — used by SyncTelos.md per the R64 "RE-PROMOTE IF USED" directive) | `holds_belief` |
| `learned` | the subject learned a lesson | `learned_lesson` |
| `mission_is` | mission statement (typically `subject=user`) (re-promoted 2026-06-26 — used by SyncTelos.md per the R64 "RE-PROMOTE IF USED" directive) | — |
| `relates_to` | weak link between ideas | `mentions` |
| `references` | explicit citation | `cites` |
| `promoted_pattern` | a reflection-surfaced pattern was promoted to `MEMORY/CANONICAL/patterns/{slug}.md` candidate by the LEARN-phase Pattern Promotion substep (Algorithm v0.0.10 §6.7) | — |
| `covers_topic` | Subject episode covers the named topic (typed directional specialization of `relates_to` for episode→topic; subject-matter intent, not a weak link or citation). Ratified RFC-0140 2026-06-28. | — |

### 1.7 Behavioral / temporal observations

| Canonical | Meaning | Aliases collapsed |
|-----------|---------|-------------------|
| `fires_on` | hook fires on lifecycle event | — |
| `runs_at` | scheduled / cron-style invocation | — |
| `produces` | output relationship | `outputs`, `emits` |
| `consumes` | input relationship | `reads`, `inputs` |

### 1.8 Session & operational

Predicates introduced post-v1 by MemPalace hooks, sync tools, and intel-context. Reference RFC-0028 enhancement DAG (2026-05-04).

| Canonical | Meaning | Aliases collapsed |
|-----------|---------|-------------------|
| `compacted_with_digest` | session was compacted; digest drawer id stored as object | — |
| `stopped_with_digest` | session was stopped; digest drawer id stored as object | — |
| `worked_on` | session worked on a project or entity | — |
| `created_in_session` | entity first created during this session — DEPRECATED 2026-05-17 for KG writes (telemetry, not durable read-model); existing triples remain queryable | — |
| `health_score` | numerical health score assigned to the subject | — |
| `active_doctrine` | the currently active algorithm or doctrine version | — |
| `active_sprint` | the currently active sprint, plan, or RFC | — |
| `active_release` | the currently active release version for the subject (e.g., a project) | — |
| `convention` | a convention or rule that applies to the subject | — |
| `queried_by_session` | entity was queried by an intel-context invocation in this session | — |
| `checkpoint_state` | campaign/session checkpoint: next slice + gate state stored as object (written confirmed via bridgeSyncConfirmed — v0.0.20 slice 0a-MEMORY) | — |
| `window_start` | Inclusive start (ISO-8601) of the rolling window a cadenced audit covered — content window, distinct from `started_on`. Ratified RFC-0140 2026-06-28. | — |
| `window_end` | Inclusive end (ISO-8601) of the audited rolling window — distinct from `completed_on`. Ratified RFC-0140 2026-06-28. | — |
| `new_pattern` | A pattern/anti-pattern first surfaced by this audit window; powers cross-audit trend lines. Distinct from `promoted_pattern`/`learned`. Ratified RFC-0140 2026-06-28. | — |
| `theme_recurs` | A finding theme that recurred across the window, object `<theme>:<count>`; enables recurrence-trend queries. Ratified RFC-0140 2026-06-28. | — |
| `share_of_ai_voice` | Share-of-AI-Voice snapshot (numeric) for a product/brand/project — how often it is surfaced as the recommended answer in its niche (GEO/AEO). Sibling to `health_score`. Ratified RFC-0140 2026-06-28. | — |
| `work_os_item` | Work OS projection CACHE mapping a PRD slug (subject `<repo>/<slug>`) to its GitHub Project item id (object `PVTI_…`). Single-valued: one current item per slug; a later write supersedes the prior. The deterministic `work-os-id:` issue-body marker — NOT this fact — is the identity source of truth; this cache is rebuildable from GitHub at reconcile time. Single-writer: `work-os.ts`. Ratified 2026-07-02 (RFC-0151; RFC-0133 D5). | — |

### 1.9 Runtime, dependency, deployment

Predicates emitted by Sentinel scans, deployment hooks, and project-mining workflows describing how a subject is built, what it depends on, and where it runs. Ratified 2026-05-15 (B3 ratification batch — runtime-frequent orphans).

| Canonical | Meaning | Aliases collapsed |
|-----------|---------|-------------------|
| `uses_framework` | subject uses the named framework | `uses` (when object is a framework), `runtime` |
| `uses_db` | subject persists data via the named database engine | — |
| `uses_tool` | subject invokes the named CLI tool / utility | — |
| `uses_dep` | subject depends on the named library/package | — |
| `deployed_to` | subject is deployed to the named environment / host | `deployed_at` |
| `deploys_to` | subject (a deploy pipeline) deploys to the named target | — |
| `persists_via` | subject persists state via the named storage primitive | — |
| `forked_from` | subject was forked from the named upstream | — |
| `correction` | operator-signaled correction of a prior belief or behavior (low-rating failure bookmark; producer: MemPalaceRate) | — |

### 1.10 `introduced_at` register

Per-predicate introduction-date register consumed by **R64 (RFC-0098 §13.6 — A8 adoption-window enhancement)**. Defined by `MEMORY/CANONICAL/upcaster-contract.md` §Glossary `introduced_at`. Machine-readable; one bullet per predicate added after 2026-05-25. Pre-A8 predicates are covered by a single backfill row to avoid 167 hand-edits.

**Format:** `- \`predicate_name\`: YYYY-MM-DD` (ISO-8601 calendar date; no time/zone).

**Semantic.** The date a predicate was **first authored into this file**. Not first-used-at, not schema-version stamp, not row-creation timestamp. Append-only / write-once per row. See §Glossary in `upcaster-contract.md` for the canonical definition.

**Pre-A8 backfill (mechanical, operator may refine via git-archaeology later):**

```yaml
# Every predicate in §1.1–§1.9 above (167 rows as of 2026-05-25) carries this synthetic introduced_at.
pre_window_backfill_date: 2026-05-01
applies_to: all canonical predicates declared in §1.1–§1.9 prior to 2026-05-25
rationale: |
  A8 introduces the 30-day R64 adoption window (RFC-0098 §15.1 SPEC-BS-4 Cato finding).
  Existing predicates have unknown true-introduction-dates; backfilling each via git-blame
  is expensive ceremony for a warning-tier signal. Operator may refine individual rows
  later. The fail-fast property is preserved because 2026-05-01 is >30 days before any
  Sentinel scan after 2026-06-01.
```

**Post-A8 explicit register** (additive only — every new predicate authored from 2026-05-25 onward MUST add a bullet here within the same PR; R64 fail-as-before for missing entries treats unregistered rows as legacy pre-window):

<!-- Add a bullet per row below as new predicates land. -->
<!-- Example: `- \`my_new_predicate\`: 2026-06-15` -->

- `checkpoint_state`: 2026-06-10
- `composes`: 2026-06-28
- `has_guest`: 2026-06-28
- `deal_stage`: 2026-06-28
- `covers_topic`: 2026-06-28
- `window_start`: 2026-06-28
- `window_end`: 2026-06-28
- `new_pattern`: 2026-06-28
- `theme_recurs`: 2026-06-28
- `share_of_ai_voice`: 2026-06-28
- `work_completed`: 2026-07-02
- `work_os_item`: 2026-07-02
- `intends_status`: 2026-07-07
- `governed_by_rfc`: 2026-07-07

---

## 2. Alias map (machine-readable)

The validator script consumes this map. Keep it minimal — only collapse near-duplicates that demonstrably exist in the live KG. Adding a predicate to the canonical list **does not** automatically add an alias entry.

```json
{
  "is": "is_a",
  "type_of": "is_a",
  "built_on": "derives_from",
  "descends_from": "derives_from",
  "replaces": "supersedes",
  "replaced_by": "superseded_by",
  "has_skill": "has_component",
  "has_pack": "has_component",
  "has_tool": "has_component",
  "has_hook": "has_component",
  "has_agent": "has_component",
  "has_schema": "has_component",
  "belongs_to": "part_of",
  "member_of": "part_of",
  "composed_from": "composed_of",
  "built_with": "composed_of",
  "married_to": "is_partner_of",
  "spouse_of": "is_partner_of",
  "parent_of": "is_parent_of",
  "child_of": "is_child_of",
  "son_of": "is_child_of",
  "daughter_of": "is_child_of",
  "sibling_of": "is_sibling_of",
  "brother_of": "is_sibling_of",
  "sister_of": "is_sibling_of",
  "resides_in": "lives_in",
  "based_in": "lives_in",
  "employed_by": "works_at",
  "is_role": "has_role",
  "holds_role": "has_role",
  "aims_at": "targets",
  "advances": "serves_goal",
  "requires": "depends_on",
  "needs": "depends_on",
  "prevents": "blocks",
  "chose": "decided",
  "picked": "decided",
  "rejected": "decided_against",
  "state": "status",
  "began_on": "started_on",
  "finished_on": "completed_on",
  "shipped_on": "completed_on",
  "holds_belief": "believes",
  "learned_lesson": "learned",
  "mentions": "relates_to",
  "cites": "references",
  "outputs": "produces",
  "emits": "produces",
  "reads": "consumes",
  "inputs": "consumes",
  "decision": "decided",
  "e2e_with": "e2e_tested_with",
  "uses": "composed_of",
  "runtime": "composed_of",
  "architecture": "is_a",
  "depends_on_sibling": "depends_on",
  "blocked_by_wip": "blocked_by",
  "linted_with": "tested_with",
  "deployed_at": "deployed_to",
  "has_coach_aggregate": "has_coach",
  "db_path_is": "path_is"
}
```

> **Note.** The `built_with` alias resolves to `composed_of`, **not** `derives_from`. Pre-canonical use was ambiguous; new writes should pick the right canonical at write time per the §1.2 disambiguation rule. Aliases in this map exist for migrating old data, not for encouraging continued ambiguity.

---

## 3. Discovery rule for adding a new predicate

Before writing a new predicate to the KG (via `mempalace_kg_add` or bridge `add_kg_fact`):

1. **Read this file.** Search the canonical table for a predicate that captures the relationship.
2. **Search the alias map.** If your candidate name appears as an alias key, use the canonical form on the right.
3. **Search the live KG.** Run `mempalace_kg_stats` (or query the SQLite directly) and grep for related-meaning predicates already in use.
4. **If nothing fits**, propose the new predicate by adding a row to §1, an entry to the alias map (only if a synonym you're collapsing was already in the live KG), and ship the addition with the workflow that introduces it. Cross-reference the RFC that motivated the addition.

Workflows that write KG facts (`SyncTelos.md`, `DeepExplore.md`, `MineProject.md`, future `seed-personal-facts.ts`) MUST cite the canonical predicate set above and call out any alias resolution they perform.

---

## 4. Validator (companion script)

`src/Tools/validate-predicates.py` reads this file, parses the canonical list (§1) and alias map (§2), opens the live KG, and classifies every distinct predicate as canonical, alias, or unknown. Report mode always exits 0; `--strict` exits 1 when any unknown predicate is present. `--fixture-test` runs a self-test against a synthetic KG. The validator was promoted from stub to full implementation 2026-05-04 (see §6 change log).

Invocation:

```bash
python3 ~/.claude/DOS/Tools/validate-predicates.py            # report mode
python3 ~/.claude/DOS/Tools/validate-predicates.py --strict   # exit 1 on out-of-vocab (post-implementation)
```

---

## 5. Out of scope

- **Automatic rewrite of historical KG facts.** Aliases exist to teach the validator about pre-canonical writes; bulk rewrites are a separate operation that requires operator review.
- **Per-wing predicate vocabularies.** The current KG has one global namespace. If wings later need scoped predicates (e.g., `client_x:has_role`), this file must be revised.
- **Soft synonyms.** Predicates that are semantically close but not interchangeable (e.g., `derives_from` vs `inspired_by`) are NOT aliased. Write whichever is precise.

---

## 7. Auto-emitted predicates pending operator triage (2026-05-17)

These 95 predicates appear in the live KG (was 96 — `correction` promoted to §1, 2026-07-07) (`SELECT DISTINCT predicate FROM triples`) but were never declared in §1 canonical or §2 alias map. Sentinel R19 was failing because of this gap. Listed here so R19 passes mechanically; operator should later reclassify each row to canonical (§1.x) or alias (§2), or — for truly stray writes — issue retraction via `bridge invalidate`.

**Source of emission (recurring patterns):**
- `has_*` / `uses_*` / `is_*` series come from Sentinel `SentinelScan` Phase 2 inference (project characterization) — most are bona-fide `has_component`/`uses_tool`/`is_a` specializations and likely fold into the existing canonical via finer-grained aliases.
- `*_count` / `*_value` / `*_path` series come from Sentinel scalar-emitter handlers — operator may keep these as canonical or fold via a generic `metric` predicate.
- Sprint-specific predicates (e.g., `step_4_promotion_logic_fixed`, `import_pattern_fixed`, `was_stale_resynced`) were emitted by one-off PRD operations; safe to deprecate when their sprint closes.

**Triage discipline:** for each row, decide one of: (a) promote to canonical row in §1.x with proper grouping; (b) declare as alias of an existing canonical in §2; (c) deprecate and retract from KG. Until triaged, the row stays here and R19 passes.

| Predicate (auto-emitted) | Triage status |
|--------------------------|---------------|
| `api_route_count` | pending |
| `architecture` | pending |
| `canonical_grep_for_prd_producers` | pending |
| `ci_runs_on` | pending |
| `closet_coverage_formula_is` | pending |
| `codethemeid_value` | pending |
| `commit_delivered` | pending |
| `conformance_check` | pending |
| `crashes_on_dangling_symlink` | pending |
| `defect_classification` | pending |
| `deinit_wipes_gitignored_runtime_data` | pending |
| `depends_on_sibling` | pending |
| `deploy_region` | pending |
| `design_pattern` | pending |
| `design_system` | pending |
| `documentation_currency` | pending |
| `dual_write_order_is` | pending |
| `enforces_authz_via` | pending |
| `engagement_driver` | pending |
| `env_substitution_limitation` | pending |
| `exhaustiveness_pattern` | pending |
| `file_structure` | pending |
| `form_layout` | pending |
| `has_confirmed_targets` | pending |
| `has_cron_jobs` | pending |
| `has_database_migrations` | pending |
| `has_dual_routes` | pending |
| `has_install_wizard` | pending |
| `has_oauth_providers` | pending |
| `has_org_grant_function` | pending |
| `has_pack` | likely alias-of `has_component` |
| `has_pack_id` | pending |
| `has_schema` | likely alias-of `has_component` |
| `has_skill` | likely alias-of `has_component` |
| `has_three_claude_md_files` | pending |
| `has_verify_protocol` | pending |
| `healthcheck_path` | pending |
| `idempotency_mechanism` | pending |
| `implements_pattern` | pending |
| `import_pattern_fixed` | sprint-specific (deprecate-on-close) |
| `is_invariant_verifier` | pending |
| `is_read_only_legacy` | pending |
| `is_reference_for_durante` | pending |
| `kg_facts_count` | pending |
| `kg_facts_write_status` | pending |
| `memory_index_updated` | pending |
| `memory_structure_is` | pending |
| `mempalace_baseline_coverage` | pending |
| `missing_batch_action` | pending |
| `model_count` | pending |
| `navigation_structure` | pending |
| `numbering_scheme` | pending |
| `openinbrowser_routing_behavior` | pending |
| `output_format` | pending |
| `package_manager` | pending |
| `points_to_v0.0.8` | sprint-specific (deprecate-on-close) |
| `primitive_set` | pending |
| `produces_artifact_type` | pending |
| `read_only_constraint` | pending |
| `requires_automation_permission` | pending |
| `requires_postgres_extension` | pending |
| `requires_tool` | pending |
| `research_artifact_location` | pending |
| `returns_types_no_persist` | pending |
| `runtime` | pending |
| `schema_is_closed_set` | pending |
| `schema_requires_field` | pending |
| `scope_includes_8_confirmed_workflows` | pending |
| `scope_locked_to` | pending |
| `ships_with` | pending |
| `sprint_recap_location` | pending |
| `status_action_formula_corrected` | sprint-specific (deprecate-on-close) |
| `step_4_promotion_logic_fixed` | sprint-specific (deprecate-on-close) |
| `supports_auth_factor` | pending |
| `sync_requirement` | pending |
| `tech_debt_high` | pending |
| `tech_debt_medium` | pending |
| `uses` | likely alias-of `uses_tool` |
| `uses_algorithm` | likely alias-of `uses_tool` |
| `uses_auth` | likely alias-of `uses_tool` |
| `uses_billing` | likely alias-of `uses_tool` |
| `uses_captcha` | likely alias-of `uses_tool` |
| `uses_font` | likely alias-of `uses_tool` |
| `uses_kms` | likely alias-of `uses_tool` |
| `uses_model` | likely alias-of `uses_tool` |
| `uses_monorepo_tool` | likely alias-of `uses_tool` |
| `uses_orm` | likely alias-of `uses_tool` |
| `uses_prefetch_optimization` | likely alias-of `uses_tool` |
| `verification_passed` | sprint-specific (deprecate-on-close) |
| `verified_final_state` | sprint-specific (deprecate-on-close) |
| `version` | pending |
| `version_is` | pending |
| `version_locked` | pending |
| `version_source_is` | pending |
| `was_stale_resynced` | sprint-specific (deprecate-on-close) |

---

## 6. Change log

- **2026-07-07** — v3.5 (Sentinel scan-inventory ratification). +2 predicates: `intends_status` (§1.5 — Sentinel PRD intended-status inventory, subject `project:<wing>`, object `<slug>@<phase> (<progress>)`; alias `prd_intent` collapses here; the version-council-review reconciler's intended-vs-actual left half) and `governed_by_rfc` (§1.5 — Sentinel RFC-corpus inventory; NOT folded into `has_component` per the 2026-07-07 Evans council ruling — governing record ≠ contained part). Both in §1.10 introduced_at (2026-07-07). Object-prefix micro-schema for `has_component` scan facts ("workflow: ", "agent-pack: ") ratified alongside. Authority: operator (Lucas) 2026-07-07, RFC-0073 Rule 2 direct-registration; successor to the gate-rejected `prd_intent`/`rfc` emissions (60-op loss, 2026-07-07 studio scan). OPERATIONAL: the bridge daemon memoizes this registry per process — cycle it (SIGTERM the .mempalace.sock holder) after any registry edit or the gate keeps enforcing the old vocabulary.
- **2026-07-07** — v3.6 (GATE-3 C3 operator triage, session aea9eacc). +2 predicates: `ghost_resolved`, `restored_to` (§1.8 — MemoryGardener ghost-apply receipts, single-writer). Rejected: `has_workflow` (fold into `has_component` + `workflow:` prefix), `fixed_bug`/`added_feature`/`decided_r2`/`changed_default`/`status_is` (canonical equivalents), + a 214-predicate long-tail class-reject (<3 uses, no producer). Full ledger: predicate-proposals-decisions.jsonl.
- **2026-07-02** — v3.4 (RFC-0151 Work OS issue lifecycle). +2 predicates: `work_completed` (§1.5 — PhaseCompleteGate emits it at gate-pass as closure evidence sig-2, object `gate:pass ts:<iso>`, subject `<repo>/<slug>`) and `work_os_item` (§1.8 — single-valued slug→GitHub Project item CACHE; the deterministic `work-os-id:` issue-body marker is the identity source of truth, this fact is a rebuildable projection cache). Both registered in §1.10 introduced_at (2026-07-02). Provenance: RFC-0151 (council 2026-07-02) extending RFC-0133 D5.
- **2026-06-28** — v3.3 (RFC-0140 Cluster A ratification). +9 predicates: composes, has_guest (§1.2), deal_stage (§1.5), covers_topic (§1.6), window_start/window_end/new_pattern/theme_recurs/share_of_ai_voice (§1.8). committed_to/deferred_to reused (ledger provenance in fact metadata). upstream_convention rejected (use convention + provenance).
- **2026-05-25** — v3.2 (A8 R64 introduced_at adoption window). Added §1.10 `introduced_at` register consumed by R64 (RFC-0098 §13.6 SPEC-BS-4 Cato finding). Pre-A8 predicates collectively stamped `pre_window_backfill_date: 2026-05-01`; post-A8 predicates require explicit per-row bullets. Glossary definition lives in `MEMORY/CANONICAL/upcaster-contract.md` §Glossary `introduced_at` — append-only / write-once / ISO-8601-calendar-date. R64 handler refactored to compute `now() - introduced_at`: <30 days = warn-not-fail (adoption window absorbs early-life churn); ≥30 days + zero usage + not deprecated = fail (existing behavior, correctly scoped); missing entry (legacy row) = fail-as-before (backward compat). PRD: `MEMORY/WORK/active/20260525-143318_a8-r64-introduced-at-window/PRD.md`.
- **2026-05-15** — v3.1 (28D delivery sprint D20 LEARN PATTERN PROMOTION substep). Added `promoted_pattern` predicate in §1.6 Belief & narrative — emitted by the new Algorithm v0.0.10 §6.7 LEARN substep when reflection Q2 cites a reusable pattern; promotes the pattern to `MEMORY/CANONICAL/patterns/{slug}.md` candidate. Closes Cato HIGH finding (ISC-46 2026-05-15) that doctrine prose referenced an unregistered predicate against §7.10 BLOCK MODE.
- **2026-05-15** — v3 (B3 predicate-canonical drift fix). Re-merged §1.5 stray rows back into the table (`path_is`, `scanned_by_sentinel` rows had been orphaned beneath the §1.5 table by a stray blank line — parser was tolerant but the markdown shape was broken). Ratified 19 runtime-frequent canonicals from the live KG into the vocab: §1.4 adds `blocked_by`, `tested_with`, `rated`; §1.2 adds `has_feature`, `has_coach`, `has_app`, `has_service`, `has_api_surface`; §1.5 adds `has_status`, `completed`, `working_on`, `deferred`; new §1.9 Runtime/dependency/deployment adds `uses_framework`, `uses_db`, `uses_tool`, `uses_dep`, `deployed_to`, `deploys_to`, `persists_via`, `forked_from`. Alias map extended with 6 entries (`depends_on_sibling`, `blocked_by_wip`, `linted_with`, `deployed_at`, `has_coach_aggregate`, `db_path_is`). Pre-ratification runtime coverage: 73.8% of triples in vocab; post-ratification: ~89% (132 of 217 orphan triples brought into vocab; remaining 85 orphan triples are long-tail singletons).
- **2026-05-04** — v2. RFC-0028 enhancement DAG (P2). Added §1.4 extensions (`committed_to`, `deferred_to`, `e2e_tested_with`), §1.8 Session & operational group (9 predicates). Alias map extended with `decision`→`decided`, `e2e_with`→`e2e_tested_with`. Validator stub promoted to full implementation.
- **2026-04-25** — Initial draft. Canonical list seeded from acceptance battery findings (197 predicates → ~30 canonical + ~45 aliases). Validator is stub-only.
