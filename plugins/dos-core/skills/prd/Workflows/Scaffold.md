---
name: Scaffold
description: Generate a new vNext-format PRD stub at MEMORY/WORK/active/{slug}/PRD.md
bestPath:
  - title: "Datetime & Slug"
    description: "Capture ground-truth datetime once and derive the YYYYMMDD-HHMMSS_kebab-task slug."
  - title: "Stub Creation"
    description: "Create the MEMORY/WORK/active/{slug} directory and write vNext frontmatter."
  - title: "OBSERVE Authoring"
    description: "AI edits ## Goal and ## Criteria directly — no scaffold body, keeping phase: observe clean."
  - title: "Denominator Reconcile"
    description: "Before leaving OBSERVE, set the progress denominator to the live ISC checkbox count."
---

# Scaffold Workflow

## When to Use

- Trigger phrases: "scaffold PRD ...", "new PRD ..."
- Situation: starting a brand-new task that needs a vNext-format PRD stub with proper frontmatter
- NOT for scoping an ambiguous ask first — use `Interview` for structured Q&A when scope isn't yet clear, then Scaffold from the answers

## Inputs

- `task` — 8-word task description (becomes frontmatter `task` field)
- `effort` — one of standard / extended / advanced / deep / xhigh / comprehensive
- `parent_rfc` — Artifact ID (e.g. `RFC-0080`) or `none` for orphan PRDs

## Procedure

1. Capture datetime via `date -u +"%Y-%m-%dT%H:%M:%SZ"` ONCE (per v0.0.8 §6.1.g DATETIME GROUND TRUTH)
2. Derive slug: `YYYYMMDD-HHMMSS_kebab-task-description`
3. Create directory: `mkdir -p MEMORY/WORK/active/{slug}`
4. Write PRD.md with vNext frontmatter:
   ```yaml
   ---
   task: <task>
   slug: <slug>
   effort: <effort>
   phase: observe
   progress: 0/0
   mode: interactive
   started: <datetime>
   updated: <datetime>
   format_version: 3
   parent_rfc: <parent_rfc>
   ---
   ```
5. AI continues with OBSERVE phase per v0.0.8 §6.1; sections are Edited directly (no scaffold body — keeps `phase: observe` clean for the count gate)
6. **Denominator-reconcile BEFORE leaving OBSERVE (ISC-34).** The stub is born `progress: 0/0`. Before the phase transitions out of `observe`, count the ISC checkbox lines the author wrote into `## Criteria` — `grep -cE '^- \[[ xX]\] ISC-' <PRD>` — and set `progress: 0/<that count>`. The denominator is body-derived (same rule as Seed.md ISC-33), never hardcoded. A PRD must not exit OBSERVE with `0/0` once it has criteria, or the count gate has nothing to gate.

## Closed loop: Scaffold → author → CheckCompleteness (ISC-35)

These three workflows form a closed loop that passes its own denominator gate (G8):

1. **Scaffold** writes the vNext stub (`progress: 0/0`, `phase: observe`).
2. **Author** Edits `## Criteria` with `- [ ] ISC-N:` lines, then runs the step-6 reconcile so `progress` denominator equals the body ISC count.
3. **CheckCompleteness** parses the PRD and asserts G8: the `progress: done/total` denominator equals the live `- [ ] ISC-N:` checkbox count in `## Criteria`. Because step 2 derived the denominator from that same body count, the loop closes green on its own output — Scaffold never emits a PRD that fails its successor's gate.

## Orphan PRDs

When `parent_rfc: none`, the AI MUST surface Strategic Intent inline in `## Goal` using the line-prefix marker per RFC-0080 §6.1 Named-Smell Policy:

```markdown
## Goal

🪶 ORPHAN STRATEGIC INTENT: <1-3 sentences of kite-level "why this matters">

<sea-level user-goal for this PRD>
```

## Notes

V12.4-α: workflow documented; AI executes the procedure via direct Edit (no separate skill harness yet — the workflow IS the harness). V12.4-β migrates to programmatic writer via `@durante/prd/Writer` when the library Writer surface ships full implementations.
