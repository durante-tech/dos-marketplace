---
name: DocsRefresh
description: Tech Writer solo pass that audits docs, AGENTS.md, and changelog content against the live kit code, citing file:line for every drift finding, and applies operator-approved refreshes.
status: STABLE
bestPath:
  - title: "Pre-flight & Digest Currency"
    description: "Run the capability probe and regenerate/verify the FrameworkDigest pins against the live kit before any doc work."
  - title: "Audit & Refresh"
    description: "Tech Writer reads each in-scope doc against the underlying code, reports drift, and proposes a per-file refresh plan."
  - title: "Operator Approval"
    description: "Operator reviews and approves, edits, or rejects each proposed doc diff."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Fixed-subcommand / native-tool invocations - no intent-variant flags exist to map; the section deliberately documents the fixed invocation table instead of the canonical Mode Selection shape"
    rationale_link: null
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "MakerkitTeam workflows have bespoke per-pipeline Output sections (artifact paths + redline reports); canonical shape doesn't fit"
---

# DocsRefresh Workflow

<!-- partial: _workflow-voice.md skill_name=MakerkitTeam workflow_name=DocsRefresh action_phrase=" to refresh documentation" -->

Tech Writer agent solo to refresh `docs/`, `AGENTS.md`, `CHANGELOG`, or in-app help content.

## When to Use

- Doc drift detected (code reality differs from doc claims)
- New convention adopted, AGENTS.md needs note
- Released feature missing changelog entry
- In-app help content stale

## Pipeline

### Phase 0 — Pre-flight
1. Preflight: `bun Tools/MakerkitCli.ts preflight` — emit the capability manifest for this run (repo, roster health, scripts, doctrine). Exit 1 = unresolvable repo or invalid roster: STOP and remediate before proceeding.
2. Operator provides: scope (specific doc path, domain folder, or "audit all and propose")
3. **Digest currency gate** (two steps, in order):
   1. `bun Tools/BuildDigest.ts --repo <resolved>` — regenerates the digest pin block in `FrameworkDigest.md` from the live kit (repo resolved per the `Tools/ResolveRepo.ts` ladder: explicit > `$KIT_REPO` > git toplevel). Cite this command as the contract.
   2. `bun Tools/VerifyDigest.ts` — exit semantics:
      - **0** — N>0 pins verified against the live kit; proceed.
      - **1** — drift; fix the flagged pins in `FrameworkDigest.md` before any doc work — the digest is sliced into all 13 agent briefs by `BuildBrief.ts`, so stale pins propagate into every brief.
      - **2** — VACUOUS (0 pins extractable from the repo); STOP and surface "digest unverifiable against this repo" to the operator.

### Phase 1 — Audit + Refresh (Tech Writer solo)

**Agent:** `writer`
**Brief:**
- Scope: <operator-provided>
- For each in-scope file: read it, read the underlying code/AGENTS.md, identify drift
- Required outputs:
  - Drift report: doc claim vs current code reality, line by line
  - Refresh plan: per file, what changes
  - Apply changes (with operator approval per file)

**Constraint:** Writer never invents claims — every change must cite the underlying source (file:line in repo).

### Skill Composition (Phase 1, per `Workflows/_skill-composition.md`)

- Writer → `Skill("dispatch", "Enhance")` runs Tier 1 polish on the refreshed mdoc bundle once per-file edits are queued (1 call per refresh; same pipeline that polishes blog posts)
- Writer → `Skill("research", "DocsLookup")` when refreshed docs cite an external framework/SDK version (≤2 lookups per refresh; citation-grounding)
- Failure → unpolished draft ships with `### docs-enhance-deferred` flag; unverified citations marked `⚠️ check-on-revisit`. Skip path: operator-internal-only refresh with no published mdoc surface.

### Phase 2 — Operator Approval

Per-file diff review. Operator approves, edits, or rejects each.

## Intent-to-Flag Mapping

DocsRefresh's Phase 0 fires three fixed CLI invocations in sequence — none of them vary by operator phrasing; each fires unconditionally at the pipeline step named below.

| Command | Input Contract | When It Fires |
|---------|-----------------|----------------|
| `bun Tools/MakerkitCli.ts preflight` | flags: `[--kit-repo <p>] [--roster <p>] [--skills-dir <p>] [--doctrine <p>]` (no stdin) | Phase 0 step 1 — capability manifest gate before any doc work; exit 1 STOPs the run |
| `bun Tools/BuildDigest.ts --repo <resolved>` | flags: `[--repo <p>] [--digest <p>] [--json]` (no stdin) | Phase 0 step 3.1 — regenerates the `<!-- generated:pins -->` block in `FrameworkDigest.md` from the live kit before digest verification |
| `bun Tools/VerifyDigest.ts` | flags: `[--kit-repo <p>] [--digest <p>] [--json]` (no stdin) | Phase 0 step 3.2 — verifies the regenerated pins against the live kit's `AGENTS.md`; exit 0 proceed, exit 1 fix drift, exit 2 VACUOUS-STOP |

## Output

- Updated mdoc files
- `MEMORY/ARTIFACTS/docs-refresh-<date>.md` with drift report
