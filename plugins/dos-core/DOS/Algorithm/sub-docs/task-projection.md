<!--
  Algorithm v0.0.10 sub-doc — PRD/ISC → Task-List Projection
  Status: ACTIVE (canonical, 2026-07-02)
  Source: RFC-0149 (decision record) — council wf_661abb60-565 + RedTeam pass
  Loaded on demand when the projection trigger fires (see "When this fires").
  dag-playbook.md §3 is the teammate-mode specialization of the granularity rule below.
-->

# PRD/ISC → Task-List Projection — The Operative Rule

The PRD is the system of record. The Claude Code task list (TaskCreate / TaskUpdate / TaskList / TaskGet) is a disposable, session-scoped execution projection of it. This sub-doc is the single home of the projection rule; RFC-0149 records why.

## When this fires

- ALGORITHM-mode run at effort ≥ Extended (E2), OR any run spawning teammates.
- Standard full-ceremony runs MAY project. Fast-path (§1.3), NATIVE, MINIMAL, and read-only/audit profiles never project.

## The rule

1. **Granularity — keyed on the PARALLELISM PRE-CHECK Q2 verdict (bind to the evaluated output, never re-derive):**
   - Q2=yes (teammate/DAG mode): one task per ISC — assignment units teammates claim via `owner`. This is dag-playbook §3, unchanged.
   - Q2=no (solo): one task per work-slice/phase-cluster, ≤7 tasks. Above ~25 ISCs, key one task per phase instead (uncapped count).
2. **Timing:** project ONCE at the PLAN→EXECUTE boundary, after the §3.3 recount. All TaskCreates in ONE assistant message (they run concurrently — §6.3 Q4). Record the Q2 verdict + mode in PRD `## Decisions` at the same moment.
3. **Metadata (pointers only):** `{prd: "<slug>", iscs: "ISC-a..ISC-b", phase: "<PHASE>"}` (+ `stream` in teammate mode, `prd_path` optional). FORBIDDEN in tasks: evidence, decisions, progress counts, criterion text as authority. Descriptions may quote ISC text for handoff readability but must cite the PRD path as authority.
4. **Dependencies:** `addBlockedBy` mirrors the PRD's phase/DAG order.
5. **Status discipline:** `in_progress` when work on the range begins (claim before working). `completed` ONLY after the PRD already shows every ISC in the range `- [x]` with evidence — PRD write first, task flip second, always. Teammate mode: the primary is the sole PRD checkbox/evidence writer; teammates return evidence.
6. **Re-scope (G.1 recount):** PRD first (`📐 RECONCILED:` line), then derive the task delta from the Reconciliation Log — diff-based, idempotent, matched on `prd`+`iscs`: create net-new only, extend ranges via metadata merge, never delete-all-and-recreate. An ISC-text edit refreshes descriptions of open tasks covering it. ISC IDs are append-only (splits mint new IDs; no renumbering).
7. **Resume/compaction re-anchor:** re-read the PRD BEFORE any TaskUpdate. The projection is never the recovery surface.
8. **Session end:** no closeout write. Tasks die; the PRD carries continuity; the next session re-projects from unchecked ISCs.

## Worked example (solo mode, real tool calls)

```json
// TaskCreate — one of 6 cluster tasks projected for a 75-ISC xhigh PRD
{
  "subject": "Author projection-contract RFC",
  "description": "Mint next-free RFC number, author Plans/Specs/RFC-0149 defining the projection contract. Authority: MEMORY/WORK/active/20260702-023827_prd-isc-task-projection/PRD.md — read it first.",
  "activeForm": "Authoring projection RFC",
  "metadata": { "prd": "20260702-023827_prd-isc-task-projection", "iscs": "ISC-14..ISC-25", "phase": "EXECUTE" }
}
// TaskUpdate — dependency wiring (implement blocked by council)
{ "taskId": "2", "addBlockedBy": ["1"] }
// TaskUpdate — completion, AFTER the PRD shows ISC-14..25 checked with evidence
{ "taskId": "2", "status": "completed" }
```

## Verification surface

- Audit trail: `TaskEventCapture.hook.ts` (PostToolUse on `TaskCreate|TaskUpdate`) appends real payloads incl. metadata to `~/.claude/MEMORY/STATE/task-events.jsonl`. The legacy `TaskCreated` event carries an empty payload — do not build on it.
- Advisory parity lint (read-only, never a gate): `bun ~/Durante/Tools/task-projection-check.ts [--session <id>] [--prd <slug>] [--json]` — flags completed-but-unverified tasks, malformed ranges, uncovered checked ISCs, unknown ISC refs, fat tasks, same-breath flips, and (with `--prd`) zero-projection sessions. Run it at VERIFY with `--prd <this-run's-slug>`. Its can/cannot table is in RFC-0149 §5 — no session may cite it as enforcement.

## Cross-references

- RFC-0149 (decision record; D1–D11, RedTeam dispositions)
- `dag-playbook.md` §3 — teammate-mode specialization (one TaskCreate per ISC) + the 8-step teammate pattern
- Doctrine §6.5 EXECUTE (checkbox-immediately rule), Amendment G (G.1 recount), §6.3 PARALLELISM Q2/Q4
