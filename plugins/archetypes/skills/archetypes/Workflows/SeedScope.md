---
name: SeedScope
description: At PLAN/spec time, seed a feature PRD with archetype scope ISCs and an explicit deferral ledger.
divergence_from_canonical:
  _workflow-voice.md:
    partial_version: 1.0.0
    reason: "hand-authored v0.0.1; canonical-partials adoption queued for next enhancement pass"
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "hand-authored v0.0.1; canonical-partials adoption queued for next enhancement pass"
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "hand-authored v0.0.1; canonical-partials adoption queued for next enhancement pass"
status: STABLE
---

# SeedScope Workflow

The load-bearing workflow: turns "we missed delete" into "we deferred delete, here's the row." Runs BEFORE implementation ISCs are finalized — at Algorithm PLAN, /forge spec, or a kit-team spec stage.

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the SeedScope workflow in the Archetypes skill"
```

Running the **SeedScope** workflow in the **Archetypes** skill...

## Steps

### Step 1 — Match the feature to an archetype

```bash
cd ~/.claude/skills/archetypes && bun Tools/RenderArchetype.ts --list
```

No match → write a `Declined: <reason>` line in the PRD's Decisions section (RFC-0164 D-A.2 — the mandatory-or-declined predicate; the same line records an explicit operator decline, and silence is a lint finding, never a valid state) and stop; the absence is itself signal — consider AuthorArchetype after delivery. Partial match → proceed with the closest archetype and record the mismatch.

### Step 2 — Resolve applicable rows

- All rows WITHOUT a `contextRider` apply.
- Rows WITH a `contextRider` apply only when the deployment shape matches (`saas-multitenant`, `metered`, `generation`, ...). State which riders are active and why.

### Step 3 — Emit the scope block into the PRD

For every applicable row, exactly one line in the PRD Criteria section:

```markdown
## Criteria (scope layer — seeded from archetype <name> v<version>)
- [ ] ISC-S1 [T1 single-delete]: User can delete an asset; DB row and storage bytes both removed
- [ ] ISC-S2 [T1 text-search]: DEFERRED — v1.1, reason: launch scope is generation-only
- [ ] ISC-S3 [T3 trash-restore]: WAIVED — delighter, revisit after delete ships
```

**The obligation table:**

| Tier | Allowed states | Rule |
|---|---|---|
| T1 | build \| DEFERRED with target + reason | NEVER silently absent — every T1 row appears in the PRD |
| T2 | build \| DEFERRED with one-line reason | Absence without a line is a lint finding |
| T3 | build \| WAIVED (bare) | Optional; note if built while T1s are deferred |

Anti-criteria rows (`a-` prefixed) become ISC-A entries for every capability actually being built this delivery.

### Step 4 — Splitting

Scope ISCs marked "build" then decompose into implementation ISCs per the Algorithm's §3 Splitting Test — the scope line stays as the parent claim; its children are the atomic criteria. (Ratified doctrine — RFC-0164 D-C: the scope parent `ISC-S<n>` carries the `[T<tier> <row-id>]` bracket as its normative archetype-row provenance; children take dotted ids `ISC-S<n>.<m>`, each individually subject to the Splitting Test; parents never split at scope altitude — they build, defer, or waive. At VERIFY a `build` parent passes iff every child passes and its own seeded claim text is evidenced; a `build` parent with zero children is a finding — the silent decomposition gap.)

### Step 5 — Close the loop at VERIFY

At delivery VERIFY, the seeded block is the completeness check — run it mechanically (never by
recall; the obligation table silently dropped its own row once, kit PR #15):

```bash
bun run ~/.claude/skills/archetypes/Tools/ValidateScopeBlock.ts \
  --prd <PRD.md path> --archetype <name>
# exit 0 clean · 1 findings (T1 silent absence / bare DEFERRED / misuse of WAIVED) · 2 load error
```

The deferral lines are the input for the next version's scoping.

## Intent-to-Flag Mapping

### Matrix retrieval (Tools/RenderArchetype.ts)

| User Says | Flag | When to Use |
|-----------|------|-------------|
| "which archetypes exist", "is there one for X" | `--list` | Step 1 matching |
| "show the rows", "what does the archetype demand" | `<name>` (stdout) | Reviewing rows before seeding |
| "save the matrix next to the PRD" | `<name> --out <path>` | Attaching the projection to the work folder |

### Corpus integrity (Tools/ValidateArchetype.ts)

| User Says | Flag | When to Use |
|-----------|------|-------------|
| "is the archetype valid before I seed" | `--only <name>` | Pre-seed sanity check |
| "machine-readable findings" | `--json` | Piping into tooling |

## Output

- A `## Criteria (scope layer ...)` block written into the target PRD, every applicable row present.
- Active context riders + archetype version recorded in PRD Context.
- Deferral lines greppable via `rg "DEFERRED" <PRD>` for next-version planning.
