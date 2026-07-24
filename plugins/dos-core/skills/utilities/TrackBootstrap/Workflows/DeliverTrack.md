---
name: DeliverTrack
status: STABLE
---

# DeliverTrack Workflow

Walk a track's sub-track PRDs in topological order, dispatch each to the kit team's `DeliverFeature` workflow, and update `ROADMAP.md` after each ship. Native DAG walker (not an Ensemble wrapper) — track-shape-aware out of the box.

**Companion to Bootstrap.md:** Bootstrap.md emits the parent research PRD + N sub-track stubs. DeliverTrack.md walks those stubs through delivery.

## When to use

- A track has been bootstrapped (parent PRD `phase: verify`, sub-track stubs exist at `MEMORY/WORK/active/`)
- Operator wants to ship multiple sub-tracks back-to-back without re-invoking DeliverFeature per stub
- Pattern fit: 5+ sub-track PRDs sharing a DAG; smaller sets are not worth the overhead

## When NOT to use

- Single sub-track delivery → use `makerkit-team`/`fastapi-starter-team` `DeliverFeature` directly
- Sub-tracks aren't authored yet → run `Bootstrap.md` first
- Cross-track delivery (e.g., GM + B4 together) → invoke DeliverTrack twice, sequentially

## Intent-to-Flag Mapping

This workflow shells out to `bun ~/Durante/Tools/track-dag-walker.ts`. Map operator intent → CLI flag:

| Operator says | Flag | Notes |
|---|---|---|
| "stack is X" / "deliver all of X-stack" | `--stack X` | required; e.g., commerce-stack |
| "track is X" / "deliver track X" | `--track X` | optional; filters to one track-id (e.g., GM) |
| "machine-readable" / "JSON" / piping to another tool | `--json` | emit structured JSON for downstream consumers |
| "out-root somewhere else" / "this other project" | `--out-root <path>` | defaults to $CLAUDE_PROJECT_DIR or cwd |
| "skip status column" / "compact view" | `--no-status` | omit `[status]` from plan output |

If a flag's value cannot be inferred from operator prompt, surface as decision artifact + AskUserQuestion at G-PLAN (Phase 2).

## Pipeline

### Phase 0 — PRE-FLIGHT

1. Voice notify (above)
2. Parse operator prompt for `${STACK_NAME}` (and optional `${TRACK_ID}`)
3. Verify artifacts exist:
   - `MEMORY/ARTIFACTS/${STACK_NAME}/MILESTONES.md`
   - `MEMORY/ARTIFACTS/${STACK_NAME}/dag-deps.md`
   - `MEMORY/ARTIFACTS/${STACK_NAME}/ROADMAP.md`
   - If any missing → abort with "run Bootstrap.md first" message
4. Detect team via repo shape (consumer-project paths — runtime-created in the operator's repo, not this pack):
   - `apps/web/` present → `makerkit-team` (runtime-created in consumer repo)
   - `src/app/main.py` present → `fastapi-starter-team` (runtime-created in consumer repo)
   - Else → AskUserQuestion with options

### Phase 1 — DISCOVERY (DAG walker)

Run the walker to get the wave plan:

```bash
bun ~/Durante/Tools/track-dag-walker.ts \
  --stack ${STACK_NAME} \
  ${TRACK_ID:+--track ${TRACK_ID}} \
  --json > .dt-plan.json
```

Parse the JSON; capture: `total_sub_tracks`, `total_waves`, `waves[]` with per-wave `sub_tracks[]`.

If the walker exits non-zero:
- exit 2 → MILESTONES or dag-deps missing → abort (handled in Phase 0)
- exit 3 → cycle detected in dag-deps.md → halt; operator must fix dag-deps.md before retry

### Phase 2 — PLAN

Emit decision artifact in PRD `## Decisions → ### Rollout Plan`:

- Mermaid DAG diagram of waves (sub-tracks within a wave shown parallel)
- Per-wave summary table: `| Wave | Sub-tracks | Parallel? | Est. effort |`
- Total budget: `total_sub_tracks × per-sub-track-effort × tier-config`
- Selected `${MODE}` (sequential | parallel-where-safe | dry-run) and `${GATE_PROFILE}` (full | compressed | autonomous)

**Operator gate G-PLAN:** approve the rollout plan + mode + gate profile before any DeliverFeature dispatch.

Default mode = `sequential` (safest). Operator opts into `parallel-where-safe` explicitly.

Default gate profile = `full` (G1-G7 per sub-track). Operator opts into `compressed` (G1+G4+G6 only) or `autonomous` (no gates) explicitly with rationale logged in PRD.

### Phase 3 — ITERATE (per wave)

For each wave in topological order:

```
For wave W in waves:
  Mark all of wave W's sub-tracks ROADMAP status: ⏳ → 🟡 (in-progress)

  If MODE == sequential:
    For each sub-track ST in wave W:
      dispatch_deliver_feature(team, ST.prd_path, gate_profile)
      Wait for completion
      Update ROADMAP ST: 🟡 → ✅ (on success) | 🔴 (on failure)
      If 🔴 and policy is "halt-on-fail" (default): abort
  Else if MODE == parallel-where-safe:
    In a single assistant message, dispatch all sub-tracks of wave W in parallel:
      Agent({ description: ST.id, prompt: "DeliverFeature with PRD=" + ST.prd_path })  × N
    Wait for all to return
    For each: update ROADMAP per result

  Operator gate W-WAVE: after wave W ships, brief retro before wave W+1 dispatches.
  (Skip W-WAVE if GATE_PROFILE == autonomous AND no failures in wave W.)
```

The `dispatch_deliver_feature` step is shorthand for invoking `Skill("makerkit-team", "DeliverFeature")` or `Skill("fastapi-starter-team", "DeliverFeature")` with the PRD slug as input. The kit team's workflow runs its own G1-G7 internally; DeliverTrack does NOT bypass those gates unless `GATE_PROFILE == autonomous`.

### Phase 4 — ROADMAP RECONCILE

After each sub-track ships:

- Re-render `MEMORY/ARTIFACTS/${STACK_NAME}/ROADMAP.md` Track-to-PRD table with current status
- Append commit SHA + summary to a `## Delivery Log` section at the bottom of ROADMAP
- Update parent research PRD `## Verification` section: tick `Sub-track ${TRACK_ID}.${N} shipped` ISC

### Phase 5 — /code-review audit (mandatory per Algorithm v0.0.10 §4.2)

After all waves ship, before VERIFY:

```
Skill("code-review", "high")
```

Audit the COMBINED diff across all sub-tracks for cross-cluster duplication. The 4-research-stream contract in Bootstrap.md pre-decomposed scope; this catches drift introduced during execution (e.g., two parallel sub-tracks both authored similar helpers because they didn't see each other's diff).

Address HIGH + MEDIUM findings. Defer LOW with rationale logged in parent PRD `## Decisions → ### /code-review Deferrals`.

### Phase 6 — VERIFY

- `ROADMAP.md` shows `${total_sub_tracks}/${total_sub_tracks}` ✅
- `bun ~/Durante/Tools/rfc-witness.ts --full` clean
- `bun ~/Durante/Tools/sync-check.ts` 0 drift / 0 missing
- `bun test` on the new packages green
- Sentinel R69 (`presence.track-bootstrap-artifacts-complete`) passes for this stack
- All parent PRD ISCs flipped `[x]` with verification evidence

### Phase 7 — LEARN

Append the reflection via the bridge (RFC-0148 — raw `echo >>` appends are withdrawn; on shape
rejection the gate returns `expected_shapes` to self-correct against):

```bash
python3 ~/.claude/DOS/Tools/mempalace_bridge.py append_reflection '{"entry":{
  "timestamp": "<ISO-8601 UTC>",
  "effort": "<tier>",
  "phase": "learn",
  "prd_id": "<parent-prd-slug>",
  "implied_sentiment": <1-10>,
  "session_id": "<sid>",
  "reflection": "workflow: DeliverTrack ${STACK_NAME}/${TRACK_ID} (<N> sub-tracks, <M> waves); worked: <q1>; smarter: <q2>; remember: <q3>; change: <q4>; rework: <which sub-tracks needed re-runs>; parallel_payoff: <true/false vs sequential>",
  "tags": ["track-bootstrap", "deliver-track"]
}}'
```

## Failure modes

| Symptom | Recovery |
|---|---|
| Sub-track #K fails at G4 (3 implementer iterations exhausted per Algorithm §4.4) | Halt; ROADMAP marks 🔴 on K; operator decides resume from K vs rollback |
| Two parallel sub-tracks edit same file | DAG was wrong; halt; operator updates `dag-deps.md` to add the missing edge; restart from current wave |
| Sub-track ISC contradicts the api-catalog | Catalog drift detected during execution; halt; re-run Bootstrap.md research workstreams for affected resource only; resume |
| Budget overrun mid-track (`BUDGET_OVERRUN_TRIGGER` §0 fires) | Auto-pause; operator decides tier-up or split into a second DeliverTrack invocation |
| Walker exits 3 (cycle) | dag-deps.md has a cycle; operator must remove the offending edge before retry |

## Artifact Tracking

Every workflow output is logged to `MEMORY/ARTIFACTS/artifacts.jsonl`:
- `rollout_plan` — Phase 2 (decision artifact)
- `delivery_log_entry` — Phase 4 (per sub-track ship; SHA + ISC summary)
- `simplify_findings` — Phase 5 (combined-diff audit)
- `reflection` — Phase 7 (reflection JSONL)
