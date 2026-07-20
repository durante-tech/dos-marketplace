---
name: Lint
description: Sweep the vault for contradictions, orphans, stale claims, broken links; propose operator-gated fixes.
status: STABLE
bestPath:
  - title: "Vault Resolution"
    description: "Locate the existing vault; stop and report if none exists."
  - title: "Health Sweep"
    description: "Check structural validity, link integrity, orphans, staleness, and KG contradictions."
  - title: "Findings Report"
    description: "Emit severity-grouped findings, each with a one-line proposed fix."
  - title: "Operator-Gated Repair"
    description: "Present the fix checklist, wait for approval, and apply only the approved subset."
divergence_from_canonical:
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "Bespoke output contract — severity-grouped findings, approval-gated fix checklist"
---

# Wiki Lint

The health check. Lint keeps the vault honest — it detects rot and proposes repairs, but **never applies a fix without operator approval**.

<!-- partial: _workflow-voice.md skill_name=Wiki workflow_name=Lint action_phrase="" -->

## When to Use

- "wiki lint", "check the wiki", "is the vault healthy"
- Periodically after a run of ingests, or before trusting the vault for a big Query

## Steps

### Step 1: Resolve the vault

Use the standard resolution block (see `Workflows/Ingest.md` Step 1). No vault → report and stop.

### Step 2: Structural sweep (OKF validity)

Enumerate every `.md` page — excluding the fixtures `SCHEMA.md` and `log.md`, which are not pages (SCHEMA.md contains format *examples* that must not be linted as claims or links). For each page:

- YAML frontmatter parses.
- `type:` present and one of the SCHEMA.md page types.
- File lives in the directory matching its type.

### Step 3: Link integrity

Every markdown link between vault pages resolves to an existing file. Broken links list source page + dead target.

### Step 4: Orphan detection

Flag pages not reachable from `index.md` within two hops (the SCHEMA.md navigation invariant).

### Step 5: Staleness (advisory)

Flag pages whose `timestamp` predates their subject's likely volatility — e.g. an `entity` page untouched for 90+ days whose subject appears in recent sources. Advisory only; staleness is a prompt to re-ingest, not an error.

### Step 6: Contradiction sweep (the split-brain guard)

- **`kg:` citations** — when MemPalace is available, verify each cited fact via `kg_query`: still present, not invalidated. Invalidated fact under a live claim = contradiction. When no palace is present, skip silently (standalone degradation).
- **Claim vs KG** — for pages making factual claims about subjects the KG tracks, check for disagreement. Resolution direction per SCHEMA.md: **the KG wins for facts; the wiki wins for interpretation.**
- **Page vs page** — flag pages asserting incompatible claims about the same subject.

### Step 7: Report

Emit the findings report grouped by severity (contradiction > broken link > orphan > structural > stale), each finding with page path + one-line proposed fix. For substantial sweeps, also write the report to `MEMORY/ARTIFACTS/` and log it to `artifacts.jsonl` (pack `wiki`, workflow `Lint`, type `lint-report`).

### Step 8: Operator gate — then apply

**STOP.** Present the proposed fixes as a checklist and wait for operator approval. Apply only the approved subset, then:

- Update `index.md` if navigation changed.
- Append a `lint` entry to `log.md` (findings count, fixes applied count).

## Output

```
🩺 VAULT LINT: <n> pages swept
🔴 Contradictions: <n>  🔗 Broken links: <n>  🏝️ Orphans: <n>  📐 Structural: <n>  🕰️ Stale: <n>
Proposed fixes: <checklist>
Awaiting approval — nothing has been changed.
```
