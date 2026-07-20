---
name: Append
description: Add a Decision or Verification entry to a PRD via library writer
bestPath:
  - title: "PRD Read"
    description: "Read the raw PRD content at MEMORY/WORK/active/{slug}/PRD.md."
  - title: "Writer Dispatch"
    description: "Call appendDecision or appendVerification from @durante/prd/Writer based on kind."
  - title: "Idempotent Write-Back"
    description: "Edit the file only if content changed, then update frontmatter updated."
  - title: "Fail-Soft Fallback"
    description: "Direct-Edit append if the library writer is unreachable, with no visible error."
---

# Append Workflow

## When to Use

- Trigger phrases: "append decision ...", "append verification ...", "log evidence for ISC-N"
- Situation: recording a single Decision or Verification entry onto an existing PRD, decision-kind or verification-kind
- NOT for recording a council/operator verdict specifically — use `Reconcile` (same underlying writer, scoped to decision-recording with an ISC cross-check)

## Inputs

- `slug` — target PRD
- `kind` — `decision` | `verification`
- `payload` — for decision: text string; for verification: `{ isc: 'ISC-N', evidence: '...' }`

## Procedure

1. Read the PRD file content (the raw string at `MEMORY/WORK/active/{slug}/PRD.md`)
2. Branch on `kind`, calling the now-real library writer in `@durante/prd/Writer`:
   - `decision` → `const next = appendDecision(content, payload)`
   - `verification` → `const next = appendVerification(content, payload.isc, payload.evidence)`
   Both are string-in / string-out, **idempotent** (re-adding the same entry is a no-op), and byte-surgical (only the target section moves; frontmatter + sibling sections are preserved verbatim).
3. Write `next` back via Edit (skip the write when `next === content` — idempotent no-op)
4. Update frontmatter `updated`

### Fail-soft fallback (ISC-29 / ISC-30)

The library call is the happy path. If the `@durante/prd/Writer` import throws for any reason (resolution failure, sandbox without the workspace, etc.), **do not surface the raw error** — fall back to an AI-direct Edit that produces the same result:

- For Decisions: append `- {ISO timestamp}: {decision text}` to `## Decisions` (create the section before `## Verification` if absent)
- For Verification: append `- ISC-N: {evidence} — {ISO timestamp}` to `## Verification` (create at end if absent)

The operator never sees an Error or a "not yet wired" message — either the library writes the line or the direct Edit does.

## Notes

V12.4: `appendDecision()` and `appendVerification()` are implemented in `@durante/prd/Writer` (RFC-0083 PG3, ISC-27/ISC-28). The fail-soft direct-Edit fallback above keeps the workflow resilient when the library is unreachable, honoring the v0.0.8 §2 sole-writer principle as the degraded path.
