---
name: Reconcile
description: Apply council/operator decisions to an existing PRD — updates ## Decisions + cross-section references
bestPath:
  - title: "PRD Read"
    description: "Read the raw PRD content for the target slug."
  - title: "Decision Recording"
    description: "Call appendDecision() to stamp a timestamped, idempotent entry into ## Decisions."
  - title: "ISC Cross-Check"
    description: "Verify any affects ISC IDs exist in ## Criteria, warning on unknowns."
  - title: "Frontmatter Update"
    description: "Write back and update updated, with a fail-soft direct-Edit fallback."
---

# Reconcile Workflow

## When to Use

- Trigger phrases: "reconcile PRD ...", "record the decision", "apply council verdict"
- Situation: applying a council or operator decision to an existing PRD's Decisions section, optionally cross-checked against ISC IDs
- NOT for recording Verification entries (ISC evidence) — use `Append` (kind: verification)

## Inputs

- `slug` — PRD to update
- `decision` — text of the decision to record (council verdict, operator ratification, /code-review finding, etc.)
- `affects` (optional) — list of ISC IDs the decision modifies

## Procedure

1. Read the PRD file content (the raw string at `MEMORY/WORK/active/{slug}/PRD.md`)
2. Record the decision via the now-real library writer: `const next = appendDecision(content, decision)` from `@durante/prd/Writer`. It stamps a timestamped line into `## Decisions`, is **idempotent** (the same decision is never double-recorded), and preserves frontmatter + every other section verbatim.
3. Write `next` back via Edit (skip when `next === content`)
4. If `affects` provided: cross-check that each ISC ID exists in `## Criteria`; surface a warning for unknown IDs
5. Update frontmatter `updated` to the current timestamp

### Fail-soft fallback (ISC-29 / ISC-30)

If the `@durante/prd/Writer` import throws, **do not surface the raw error** — fall back to an AI-direct Edit that appends `- {ISO timestamp}: {decision}` to `## Decisions` (creating the section before `## Verification` when absent). The operator never sees an Error or a "not yet wired" message.

## Notes

V12.4: `appendDecision()` is implemented in `@durante/prd/Writer` (RFC-0083 PG3, ISC-27). The fail-soft direct-Edit fallback keeps Reconcile resilient when the library is unreachable, honoring the v0.0.8 §2 sole-writer principle as the degraded path.
