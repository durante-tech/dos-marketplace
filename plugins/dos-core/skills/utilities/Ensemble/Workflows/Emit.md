---
name: Emit
description: Render session-prompt.md + rollout-state.md from an approved DELIVERY-PLAN.md; refuses to proceed while any Gap is unchecked
status: STABLE
---

# Emit Workflow

Consumes an operator-approved `DELIVERY-PLAN.md` (plus its machine-side `PLAN-META.json`) and renders the two artifacts a Conductor pastes into a fresh Claude Code session to ship the work:

1. `session-prompt.md` — the Conductor's full mission brief (entry gates, ground-truth reads, teammate briefs, wave handoff table, verification protocol, shipping protocol, receipt format)
2. `rollout-state.md` — DAG-structured queue with wave pointers + iteration log, survives compaction

**Strict Gaps policy:** If any `- [ ]` item remains unchecked in the plan's `## Gaps` section, Emit exits non-zero and writes nothing. No warnings, no soft mode.

## CLI Invocation

```bash
bun ~/Durante/Packs/utilities/src/Ensemble/Tools/RunEmit.ts \
  --plan <path-to-DELIVERY-PLAN.md> \
  [--out <dir>] \
  [--dry-run]
```

### Flag reference

| Flag | Meaning |
|------|---------|
| `--plan` | **Required.** Path to the approved `DELIVERY-PLAN.md`. |
| `--out` | Override output directory. Defaults to the plan's own directory. |
| `--dry-run` | Emit to stdout only; no file write. |

## Steps

1. **Read the plan** — parse `DELIVERY-PLAN.md` + load co-located `PLAN-META.json`.
2. **Gaps gate** — scan `## Gaps` section for unchecked `- [ ]` items. If ≥ 1, print the blocking gaps to stderr and exit code 2. **No writes.**
3. **Render session-prompt** — compose the Conductor brief from the plan:
   - Priority + sprint metadata
   - **Conductor role** — orchestrates, verifies, never writes production code
   - **Entry gates** — parallel verifications tied to discovered rails (clean tree, typecheck, tests, any project-specific hooks)
   - **Ground-truth reads** — artifact + sibling specs + codebase anchors + skill catalog + rejected-options list (if artifact includes them)
   - **Ensemble structure** — one brief per inferred role with: inputs (artifact sections), outputs (file zones), done-when (acceptance criteria + gates), use-skills (from verified L2 available-skills list)
   - **Wave handoff table** — date-free; `Wave N activates when <dep set green>`
   - **Acceptance criteria** — flattened from the artifact + role-specific done-whens
   - **Verification protocol** — ordered gates, stop-on-fail
   - **Shipping protocol** — commit convention + pathspec hygiene + submodule order (only if discovered)
   - **Receipt format** — final YAML declaration block
   - **Anti-patterns** — generic + artifact-specific
4. **Render rollout-state** — DAG-structured queue with:
   - YAML frontmatter (scope, created, updated, current_wave, current_unit, status, failure_count, last_failed_unit)
   - **Wave 0 / Wave 1 / …** sections — each with `- [ ]` checkbox per work unit + teammate
   - Iteration log table (starts empty)
   - Termination conditions (all waves closed, `abort: true`, or `failure_count >= 3`)
   - Safety rails (from discovered project rails: explicit pathspec, no `--no-verify`, submodule-first if applicable)
5. **Write** both files to `<out>/session-prompt.md` and `<out>/rollout-state.md`.

## Conductor responsibilities — rendered into the emitted prompt

- Spawn teammates via `Agent` calls with `name:` (the session has a single implicit team)
- Never write production code; only verification + coordination
- Advance `rollout-state.md` wave pointer when all units in current wave have green Done-gates
- Tick `- [x]` per unit as teammates sign off
- Append iteration log row per wave close
- Run the verification protocol end-to-end before declaring shipped
- Emit the final YAML receipt block on success

## Teammate responsibilities — rendered into per-teammate briefs

- Read the assigned artifact sections + file-zone
- Implement against the acceptance criteria
- Invoke `Skill("code-review", "high")` on own diff before Done-gate (if `simplify_mandate: true` in rails)
- Commit with explicit pathspec per project commit convention
- `SendMessage` back to Conductor with receipt block

## Emitted artifacts

- `<out>/session-prompt.md` — paste-ready Conductor mission brief
- `<out>/rollout-state.md` — DAG-structured queue (lead reads on every wake)

Both artifacts reference each other. `session-prompt.md` instructs the Conductor to read `rollout-state.md` as first action.

## Artifact Tracking

On non-dry-run, appends TWO JSONL entries to `MEMORY/ARTIFACTS/artifacts.jsonl` (one per file).

## Next step

Open a fresh Claude Code session. Paste the contents of `session-prompt.md`. Conductor takes over from there.
