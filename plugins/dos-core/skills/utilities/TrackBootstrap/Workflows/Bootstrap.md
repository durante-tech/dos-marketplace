---
name: Bootstrap
status: STABLE
---

# Bootstrap Workflow

The 7-artifact track-bootstrap pattern for onboarding a new external integration provider. Distilled from 3 historical runs (social B1/B2/B3, B4 GBP, commerce GM).

## Intent-to-Flag Mapping

This workflow shells out to `bun ~/Durante/Tools/scaffold-track.ts`. Map operator intent → CLI flag:

| Operator says | Flag | Notes |
|---|---|---|
| "Track ID is X" / "use X as the 2-letter ID" | `--track X` | uppercase 2-letter, unique within stack |
| "Provider name is X" / "for X" | `--track-name "X"` | human-readable, quoted if has spaces |
| "under stack Y" / "in the Y family" | `--stack Y` | kebab; new stack = "{domain}-stack" |
| "provider kebab Z" / npm name leaks | `--provider Z` | lowercase kebab; defaults npm to @kit/Z |
| "decompose into N sub-tracks" / "~N PRDs" | `--sub-tracks N` | 5-12 typical; refined during EXECUTE |
| API host stated | `--api-base-host host` | e.g., merchantapi.googleapis.com |
| OAuth scope stated | `--oauth-scope url` | e.g., https://www.googleapis.com/auth/content |
| "mirror the X template" / sibling named | `--sibling-provider X --sibling-stack Y` | enables template-lift compression |
| target tier stated (T3/T4/T5) | `--tier-num T5` | default T5 for feature/provider packages |
| operator scope sentence (verbatim) | `--operator-scope "..."` | quoted single arg |
| "just preview" / "show me first" | `--dry-run` | no writes |
| "overwrite existing" / "I'm re-running" | `--force` | required after prior partial run |

If a flag's value cannot be inferred from operator prompt + `Skill("ref")` lookup, surface as decision artifact + AskUserQuestion at G1 (Phase 1).

## Pre-flight (Phase 0)

1. Voice notify: `bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running Bootstrap workflow in TrackBootstrap skill to scaffold a new integration provider"`
2. Read `MEMORY/CANONICAL/track-bootstrap-pattern.md` (canonical reference for the pattern)
3. Read `~/.claude/DOS/Scaffolds/track-bootstrap/README.md` + `_USAGE.md` (operator runbook)

## Phase 1 — OBSERVE

**Operator input parsing:**

Extract from the operator prompt:
- `${TRACK_NAME}` — human-readable provider name (e.g., "Google Merchant")
- `${TRACK_ID}` — 2-letter unique ID within stack (e.g., "GM"). Ask if not stated; default to the first 2 capitals of the name.
- `${STACK_NAME}` — stack family kebab (e.g., "commerce-stack"). Ask if not stated.
- `${API_BASE_HOST}` — provider's modern API host (e.g., "merchantapi.googleapis.com"). Look up via `Skill("ref")` if not stated.
- `${OAUTH_SCOPE}` — provider's OAuth scope string. Look up if not stated.
- `${SUB_TRACK_COUNT}` — rough decomposition (5-12 typical). Operator estimate; refined during EXECUTE.

**Sibling lookup (template-lift compression):**

Identify the closest sibling track for template re-use:
- Same stack, previous provider? — preferred
- Different stack, analogous run? — acceptable
- Fresh (no sibling)? — accept; expect ~6-8h vs ~1-2h for repeat runs

Read the sibling's 7 artifacts to internalize: status legend, frontmatter conventions, section ordering, table column headers, ISC-prefix conventions (R-/PKG-/CAT-/RM-/PRD-/A-).

**Pattern-fit verification:**

Confirm ALL inclusion criteria hold (from `MEMORY/CANONICAL/track-bootstrap-pattern.md`):
- ≥5 distinct API surfaces / sub-APIs / capability clusters
- Multi-PRD scope (one provider = N sub-tracks)
- Provider has its own OAuth-scope domain, rate-limit regime, resource model
- Work is parallelizable after G1

If any criterion fails, **abort** and route to MakerkitTeam/FastAPIStarterTeam DeliverFeature workflow instead.

**Operator gate G1:** present the inferred parameters as a decision artifact (table: parameter → inferred value → reasoning). AskUserQuestion if any inference is uncertain. Operator approves before Phase 2.

## Phase 2 — PLAN

**Emit 📐 PARALLELISM block** committing to the load-bearing 4-stream parallelism contract:

| Workstream | Tool | Scope |
|---|---|---|
| **Extensive research** | `Skill("research", "extensive")` or Agent | 10-bucket dossier (surface map, endpoints, schemas, auth, quota, errors, deprecation, async, notifications, compliance) |
| **Docs gateway lookup** | `Skill("ref")` | Authoritative vendor doc capture per sub-API |
| **Direct WebFetch** | WebFetch on N REST reference index URLs | Verbatim method enumeration |
| **Prior-art recall** | MemPalace + ContextSearch | Confirm greenfield / find adjacent learnings |

**Author the parent research PRD scaffold:** invoke `scaffold-track.ts` to emit the 7 artifacts + N sub-track stubs. The parent PRD lands first; sub-track stubs are AI-fillable placeholders.

```bash
bun ~/Durante/Tools/scaffold-track.ts \
  --track ${TRACK_ID} \
  --track-name "${TRACK_NAME}" \
  --stack ${STACK_NAME} \
  --provider ${PROVIDER_KEBAB} \
  --sub-tracks ${SUB_TRACK_COUNT} \
  --api-base-host ${API_BASE_HOST} \
  --oauth-scope ${OAUTH_SCOPE} \
  --sibling-provider ${SIBLING_PROVIDER:-none} \
  --sibling-stack ${SIBLING_STACK:-${STACK_NAME}}
```

Verify all 7 + N files landed via `ls MEMORY/WORK/active/${TS_UTC}_${STACK_NAME}-research-package-bootstrap/PRD.md MEMORY/ARTIFACTS/${STACK_NAME}/`.

## Phase 3 — EXECUTE (4 parallel research workstreams)

Spawn all 4 workstreams in **a single message** (parallel Agent calls). Each workstream returns to the orchestrator with its bucket of findings.

```ts
// Pseudo — actual invocation uses Agent / Task / Skill tools per the table above
const research_streams = [
  Agent({ description: "extensive research", subagent_type: "general-purpose", prompt: "..." }),
  Skill("ref", "docs for ${API_BASE_HOST} ${OAUTH_SCOPE}"),
  WebFetch(REST_REFERENCE_URLS),
  MemPalace.kg_query({ subject: "provider:${PROVIDER_KEBAB}" }),
];
// All in ONE assistant message — they run concurrently.
```

When all 4 return:

1. **Author api-catalog** (artifact 2) from research output. Every method × every resource enumerated, no hallucinated rows.
2. **Author package-design** (artifact 3) — tier ${TIER_NUM}, file layout, contracts, jobs, schema sketch.
3. **Author MILESTONES + ROADMAP** (artifacts 4-5) — sub-track DAG + point-in-time status.
4. **Author DAG-deps + matrix** (artifacts 6) — per-edge dependency rationale + provider × surface × method matrix.
5. **Refine sub-track PRD stubs** (artifact 7) — replace `pending-slug-N` placeholders with real slugs based on the api-catalog's capability clusters.
6. **Backfill parent PRD §Decisions** with: scope-in/out, anti-criteria, ISC catalog, group/phase columns.

## Phase 4 — /code-review audit (MANDATORY)

Per Algorithm v0.0.10 §4.2 CRITICAL gate, run `/code-review` on the produced artifacts before VERIFY:

```
Skill("code-review", "high")
```

Address HIGH + MEDIUM findings. Defer LOW with explicit rationale in PRD `## Decisions → ### /code-review Deferrals`.

## Phase 5 — VERIFY

- Flip all ISCs in parent PRD `[ ]→[x]` per criterion's verification evidence
- Populate `## Verification` section with per-group evidence
- Capability invocation check: every selected `Skill(...)` / Agent / Tool either INVOKED or DECLINED with reason (per Algorithm §4.2 Decline Protocol)
- Run `bun Tools/sentinel.ts --check R69` (when Tier 4 R69 lands) to verify 7-artifact invariant

## Phase 6 — LEARN

Append the reflection via the bridge (RFC-0148 — raw `echo >>` appends are withdrawn; on shape
rejection the gate returns `expected_shapes` to self-correct against):

```bash
python3 ~/.claude/DOS/Tools/mempalace_bridge.py append_reflection '{"entry":{
  "timestamp": "<ISO-8601 UTC>",
  "effort": "<tier>",
  "phase": "learn",
  "prd_id": "${TS_UTC}_${STACK_NAME}-research-package-bootstrap",
  "implied_sentiment": <1-10>,
  "session_id": "<sid>",
  "reflection": "worked: <what worked>; smarter: <what a smarter algorithm would have done>; remember: <what to remember>; change: <what to change>",
  "tags": ["track-bootstrap"]
}}'
```

Note **deltas-for-next-session** under PRD `## Decisions → ### Next-run hints` for the next track-bootstrap run.

## Phase 7 — Operator G1 review

The scaffold produced a `phase: verify` parent PRD; the sub-track PRDs are in `phase: observe`. Operator action:

1. Read parent PRD `## Decisions` + `## Verification` — confirm scope is correct
2. Read sub-track PRDs in DAG order (e.g., GM.0 → GM.1 → branched)
3. Approve each sub-track at its G1 gate to allow its OBSERVE → PLAN → EXECUTE work to start (each sub-track then re-enters MakerkitTeam/FastAPIStarterTeam DeliverFeature workflow individually)

## Failure modes (red flags)

| Symptom | Likely cause | Recovery |
|---|---|---|
| Research workstreams launched serially | PARALLELISM block was emitted but not executed in one message | Re-launch as parallel batch; flag in reflection |
| api-catalog written before research returns | AI hallucinated endpoint paths | Discard catalog; re-author from research output |
| Sub-track PRDs author themselves without referencing api-catalog | Decomposition done from operator prompt alone | Stop; re-decompose against actual API surface |
| /code-review audit skipped | Operator-pressure perceived | Run /code-review; this is CRITICAL per Algorithm §4.2 |
| Progress denominator wrong (e.g. 52/58 when actual is 58/58) | Miscount before stamping | Re-grep ISC checkboxes; fix denominator |
| Phantom capability (selected but never invoked, no decline) | AI missed §4.2 Decline Protocol | Add Declined line to PRD §Decisions; or invoke the capability |

## Artifact Tracking

Every workflow output is logged to `MEMORY/ARTIFACTS/artifacts.jsonl`:
- `research_prd` — parent research PRD (Phase 2 scaffold + Phase 3 fill-in)
- `api_catalog` — Phase 3 (research synthesis)
- `package_design` — Phase 3 (engineering spec)
- `milestones` — Phase 3 (sub-track DAG)
- `roadmap` — Phase 3 (point-in-time status)
- `dag_deps` — Phase 3 (edge rationale)
- `backend_integration_matrix` — Phase 3 (provider × surface × method)
- `sub_track_prd_stubs` — Phase 3 (N stubs, one per capability cluster)
- `reflection` — Phase 6 (reflection JSONL)
