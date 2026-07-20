---
name: CheckCompleteness
description: Run the 13-gate PRD completeness contract via the check-completeness CLI; the verdict is COMPUTED, never asserted
bestPath:
  - title: "Path Resolution"
    description: "Resolve the target PRD path from a slug or an explicit path."
  - title: "Gate Harness Run"
    description: "Execute check-completeness.ts, parsing via parsePRDFile and running all 13 gates."
  - title: "Verdict Read"
    description: "Read the computed verdict line and exit code — never hand-derive it."
  - title: "Failure Triage"
    description: "Distinguish not-found/unparseable (exit 2) from fail-closed inconclusive gates."
---

# CheckCompleteness Workflow

## When to Use

- Trigger phrases: "check completeness {slug}", "is this PRD complete", "lint PRD ..."
- Situation: ad-hoc audits or pre-handoff verification of a PRD's full 13-gate completeness contract
- NOT for continuous enforcement — `PRDConformanceGate.hook.ts` already automates a subset of this on every PRD Write/Edit; this workflow is the on-demand full-gate audit

Validate a PRD against the **full 13-gate completeness contract** (`@durante/prd/Doctrine`).
The verdict is **computed** from the gates by an executable harness — NOT eyeballed. This
closes the PG1 false-complete bug: the old prose procedure graded only 4 of 13 gates and
silently passed PRDs that the progress-denominator (R65), ISC count-floor (R18), and the four
required Algorithm sections would reject downstream.

## Inputs

- `slug` (or `path`) — PRD to check.

## Intent-to-Flag Mapping

| User Says | Tool | Flag | When to Use |
|-----------|------|------|-------------|
| "check completeness {slug}" / "is this PRD complete" | check-completeness.ts | `MEMORY/WORK/active/{slug}/PRD.md` | Human-readable verdict + per-gate report |
| "check completeness json" / pipeline/CI use | check-completeness.ts | `<path> --json` | Discriminated report for scripting |

## Procedure

1. Resolve the path: `MEMORY/WORK/active/{slug}/PRD.md` (or use the supplied `path`).
2. Run the harness — it parses via the real `parsePRDFile` and runs all 13 gates:

```bash
bun Packs/prd/src/Tools/check-completeness.ts MEMORY/WORK/active/{slug}/PRD.md
```

3. **Read the verdict line and exit code — do NOT re-derive it by hand.** The CLI exits `1`
   on any non-`COMPLETE` verdict (a failed block gate OR a fail-closed inconclusive gate),
   `0` only when every gate is `pass` or `not_applicable`.

The report is verdict-first (`🟢 COMPLETE` / `🔴 INCOMPLETE` / `🔴 PARTIAL-CHECK`) with an
`X/Y gates pass (N fail · N inconclusive · N n/a)` line, a `contract: prd-doctrine@<ver>`
provenance line, and — for every `✗`/`⚠` gate — the got-vs-expected evidence, a one-line fix,
and the downstream authority (e.g. `Sentinel R65`) that will also reject it.

## The 13 gates

G1 format_version · G2 required frontmatter (R17) · G3 parent_rfc (R44) · G4 AC⊂OoS (R45) ·
G5 anti-criteria form (R46) · G6 section order · G7 progress shape · **G8 progress denominator
== ISC count (R65)** · **G9 ISC count-floor (R18 TIER_FLOORS)** · G10 📊 BRIEF INTEGRITY ·
G11 📐 PARALLELISM · G12 📚 MEMORY HEALTH (R38) · G13 ### Schema Pre-Flight. The denominator
and floor gates no-op while `phase: observe` (ISCs may not be authored yet) and bind once ISC exist.

## Failure modes

- PRD not found / unparseable → the CLI exits `2` with an explicit error; do not silently proceed.
- A gate that cannot run (parser throws) → `⚠ INCONCLUSIVE`, which is **fail-closed**: it BLOCKS
  `COMPLETE` (absence of a finding is inconclusive, not a pass).

## Notes

`PRDConformanceGate.hook.ts` automates a subset of this on every PRD Write/Edit; running this
workflow is for ad-hoc audits or pre-handoff verification. The harness IS the forcing function
the old prose procedure lacked — the firing-3 denominator bug (`progress: 0/66` against 67 ISC)
is now caught mechanically, pinned by the `index.test.ts` dogfood regression fixture.
