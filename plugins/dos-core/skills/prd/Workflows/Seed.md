---
name: Seed
description: Initialize PRD criteria from an RFC's ISC seeds section
bestPath:
  - title: "Source Load"
    description: "Load the target PRD and the source RFC at Plans/Specs/{rfc}.md."
  - title: "ISC Extraction"
    description: "Locate the RFC's ISC Seeds section and extract each - ISC-N: line."
  - title: "Criteria Insert"
    description: "Append extracted ISCs to ## Criteria as - [ ] ISC-N: checkbox lines."
  - title: "Denominator Derive"
    description: "Count live checkbox lines to set progress: <done>/<count>; link parent_rfc:."
---

# Seed Workflow

## When to Use

- Trigger phrases: "seed PRD from RFC ...", "pull ISCs from RFC-NNNN"
- Situation: initializing PRD criteria from an RFC's pre-defined ISC Seeds section, rather than deriving ISCs freehand from spec prose
- NOT for adding a single Decision or Verification entry — use `Append`

## Inputs

- `slug` — target PRD
- `rfc` — Artifact ID of source RFC (e.g., `RFC-0080`)

## Procedure

1. Load PRD via `parsePRDFile()`
2. Load RFC at `Plans/Specs/{rfc}.md`
3. Find RFC's "ISC Seeds" section (typically §7 by convention; grep for `## .* ISC Seeds` heading)
4. Extract each `- ISC-N: <description>` line
5. Append to PRD's `## Criteria` section as `- [ ] ISC-N: <description>` checkbox lines, preserving the RFC's numbering
6. **Derive the denominator FROM the body, not from a guess (ISC-33).** After the insert, count the actual ISC checkbox lines in `## Criteria` — `grep -cE '^- \[[ xX]\] ISC-' <PRD>` (or count `- [ ] ISC-N:` / `- [x] ISC-N:` lines). Set `progress: <done>/<that count>`, where `<done>` is the number of `- [x]` boxes (0 for a fresh seed). Never hardcode N or use the seed's own line count — the denominator must reflect what is physically in the body so it cannot drift from the criteria it gates.
7. Update `parent_rfc:` frontmatter to point at the source RFC if not already set

## Notes

V12.4: the progress denominator is body-derived (ISC-33) — counted from the `- [ ] ISC-N:` checkbox lines actually present in `## Criteria` after the seed insert, so the `progress: done/total` gate (G8) always matches the live criteria count. Useful for new task PRDs that derive from a specific RFC's design — saves re-deriving ISCs from spec text. AI executes via direct Edit today; programmatic harness is a future enhancement.
