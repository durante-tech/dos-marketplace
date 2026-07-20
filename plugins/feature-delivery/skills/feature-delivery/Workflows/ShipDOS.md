---
name: ShipDOS
description: DOS-aware ship step — verifies four-copy sync and runs atomic submodule-first/parent-second commit flow before the normal Ship step.
status: STABLE
audience: dos-author-only
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "FeatureDelivery ShipDOS workflow uses workflow-specific intent-to-flag vocabulary; canonical Mode/Output two-table shape doesn't fit"
bestPath:
  - title: "Sync Gate"
    description: "Run sync-check.ts and block on drift before proceeding."
  - title: "Submodule-First Commit"
    description: "Commit and push submodule changes via ship-submodule.ts if the submodule has pending changes."
  - title: "Parent Commit & Push"
    description: "Commit and push the parent repo changes with the submodule ref staged."
  - title: "Verification"
    description: "Confirm sync-check is clean, git status is empty, and nothing is unpushed."
---

# ShipDOS

> **Audience:** DOS pack authors working in the DOS source checkout. Operators installing `@durante-tech/dos` via npm skip this workflow entirely — it only applies when the DOS repo itself exists on disk.

**Purpose:** The sanctioned ship path for changes to DOS itself (edits inside the DOS source checkout). Wraps the normal Ship workflow with two DOS-specific gates:

1. `bun Tools/sync-check.ts` must pass (live ↔ submodule ↔ packs content-identical per manifest)
2. Submodule bumps go through `bun Tools/ship-submodule.ts` (atomic submodule-first/parent-second)

## When to Use

- You edited files inside `~/Durante/` that participate in the four-copy layout (skills, hooks, DOS/, top-level config)
- Any commit to the Durante root that involves a submodule bump
- DOS's own feature work per the council finding "DOS must eat its own dogfood"

## When NOT to Use

- Editing files in a consumer project unrelated to DOS — use plain `Ship` instead
- Edits inside `MEMORY/WORK/` only (session PRDs) — no four-copy participation; plain `Ship`
- Pure documentation edits in `Plans/Specs/` — plain `Ship` (pre-commit hook still runs)

## Prerequisites

- P0 installed: `Tools/sync-check.ts`, `.dos-sync-manifest.json`, `.git/hooks/pre-commit` symlinked from `Tools/hooks/pre-commit`
- P1 installed: `Tools/ship-submodule.ts`, `SyncDriftReport.hook.ts`
- Changes staged and ready to commit

## Steps

### Step 1: Sync gate (BLOCKING)

```bash
cd ~/Durante
bun Tools/sync-check.ts --summary
```

- Exit 0 → proceed to Step 2
- Exit non-zero → drift must be resolved before ship. Run:
  ```bash
  bun Tools/sync-check.ts --full      # see per-file drift
  bun Tools/sync-check.ts --fix       # auto-propagate live → submodule
  ```
- Do NOT use `git commit --no-verify` to bypass. Escape hatch exists for emergencies only; bypassing defeats the system.

### Step 2: Submodule-first commit (if submodule has changes)

```bash
cd ~/Durante
bun Tools/ship-submodule.ts "<commit message>"
```

This tool handles:
- Pre-flight sync-check (again — cheap and catches race conditions)
- `cd Releases/v0.0.3/.claude && git add -A && git commit && git push origin main`
- Verifies submodule HEAD pushed to origin/main before returning
- Stages the submodule ref in the parent (but does NOT commit parent — Step 3 does that)

If the submodule had no pending changes, ship-submodule.ts is a no-op and you can skip it.

### Step 3: Parent commit + push

```bash
cd ~/Durante
git add <your-changed-files>
git commit -m "<message>"
git push origin main
```

The pre-commit hook runs `sync-check.ts --summary` one more time here. With Step 1 done and no edits since, this should pass trivially.

### Step 4: Verify

```bash
bun Tools/sync-check.ts --summary            # should still be CLEAN
git status --short                            # should be empty
git log origin/main..HEAD --oneline           # should be empty (all pushed)
```

## Evidence requirement for verification

Per `DOS/Prompts/Phases/verify.md` rule 4: any claim like "shipped DOS feature X, all copies in sync" MUST attach the `sync-check` output as evidence. Example:

```
ISC-N: DOS feature X shipped with four-copy parity — PASS
  evidence: `bun Tools/sync-check.ts --summary`
  Total: 1420 identical, 0 drift, 0 missing
  exit: 0
```

Claims without attached tool output FAIL the criterion.

## Intent-to-Flag Mapping

This workflow shells out to `Tools/sync-check.ts` and `Tools/ship-submodule.ts` per CreateSkill workflow Step 6 + CliFirstArchitecture.md. Translate operator phrasing into deterministic flag selection.

### Mode / Action — sync-check.ts

| User Says | Flag | Effect |
|-----------|------|--------|
| "is dos in sync?" / "quick sync check" | `--summary` (default) | Counts only — fast pre-ship gate |
| "show me which files drifted" | `--full` | Per-file status table |
| "give me machine output" | `--json` | JSON for programmatic consumption |
| "fix the drift" | `--fix` | Resolve drift live → submodule |
| "preview what fix would do" | `--fix --dry-run` | Print the fix plan without writing |

### Mode / Action — ship-submodule.ts

| User Says | Argument / Flag | Effect |
|-----------|-----------------|--------|
| "ship the dos submodule with message X" | positional commit message | Pre-flight sync-check, commit + push inside submodule, stage parent ref |
| "(no submodule changes)" | (skip Step 2 entirely) | ship-submodule is a no-op when submodule is clean |

### Mode / Action — git (final parent commit)

| User Says | Command Pattern | Effect |
|-----------|-----------------|--------|
| "commit the parent + push" | `git commit -m "<msg>" && git push origin main` | Closes the atomic submodule-first/parent-second cycle |
| "verify everything cleared" | `sync-check --summary` + `git status --short` + `git log origin/main..HEAD --oneline` | Three-way post-condition check |

### Anti-patterns (DO NOT MAP)

| User Says | Refused Flag | Reason |
|-----------|--------------|--------|
| "skip the gate, just ship" | `git commit --no-verify` | Bypasses the sync gate; defeats the system per Step 1 note |
| "auto-fix without asking" | `--fix` invoked silently | Operator must see drift before propagation |

## Failure modes and recovery

| Symptom | Cause | Recovery |
|---------|-------|----------|
| sync-check blocks Step 1 | Drift between live ↔ submodule | `bun Tools/sync-check.ts --fix`, re-run Step 1 |
| ship-submodule refuses Step 2 | Submodule push failed silently | Check SSH / network, rerun |
| pre-commit hook blocks Step 3 | New drift introduced between Steps 1-3 | Run `sync-check --full`, fix, retry |
| parent push rejected by remote | Concurrent commit | `git pull --rebase origin main`, retry |

## Integration with the rest of FeatureDelivery

- `Classify` → `Spec` → `CouncilGate` → build → `Review` → **ShipDOS** (for DOS work) or **Ship** (for everything else)
- ShipDOS does NOT replace Review — it replaces only the final commit/push step for DOS-layer changes
