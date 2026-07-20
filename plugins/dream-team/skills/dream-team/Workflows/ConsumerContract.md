---
name: Consumer Contract
description: Defines the four-requirement contract (mutable page source, copy surface, verify command, revertable tree) that DreamTeam's implementing workflows assert read-only via the VERIFY-PROBE before mutating a consumer repo, with a --delegate fallback to review-only when unmet.
status: STABLE
bestPath:
  - title: "Contract Requirements"
    description: "Define C1-C4: mutable page source, copy surface, verify command, revertable tree."
  - title: "VERIFY-PROBE"
    description: "Resolve C1/C2 paths, run C3 once for a GREEN baseline, confirm C4 clean tree."
  - title: "Delegate Seam"
    description: "Fall back to a review-only, unapplied change-set bundle when the contract is unmet."
---

# DreamTeam Consumer-Repo Contract

## When to Use

- Consulted internally by `Evolve` and `Trim` as their Step 0, before any consumer-repo mutation — not a directly user-triggered workflow itself
- Read when auditing whether a new consumer repo is safe to point DreamTeam's implementing workflows at
- NOT for review-only workflows (`Review`, `QuickReview`, `SectionReview` critique phase, `VisualBrief`) — those never mutate consumer source, so this contract doesn't gate them

The DreamTeam *implementing* workflows -- **SectionReview**, **Evolve**, **Trim** -- do not just critique; they MUTATE the target ("consumer") repository: Edit/Write on `page.tsx`, translation/locale JSON, and component files, then run a verify command. This is declared honestly in `extension.yaml` (`runtime_effects: consumer_source_mutation`, `shell_exec_verify_command`).

A repo is only safe to mutate if it exposes the four things below. The **VERIFY-PROBE** (Step 0 of Evolve/Trim) asserts this contract read-only BEFORE the first mutation. If any requirement is unmet, the workflow STOPS or falls through to the `--delegate` seam (review-only) -- it never half-mutates a repo whose contract it could not assert.

## The Contract

| # | Requirement | Default assumption | Why DreamTeam needs it |
|---|-------------|--------------------|------------------------|
| **C1** | **Mutable page source** -- a resolvable page/source file to edit | `page.tsx` | Structural + component changes target this file |
| **C2** | **Copy surface** -- translation/locale files for copy edits | i18n JSON (`t('...')` keys) | Copy changes are applied here first (lowest blast radius); if copy is inline JSX, declare that |
| **C3** | **Verify command** -- a non-destructive command that exits non-zero on breakage | `pnpm healthcheck` (lint + format + typecheck) | Every implementing workflow re-verifies after each change |
| **C4** | **Revertable working tree** -- clean git tree, or operator-acknowledged | `git status` clean | Mutations must be reversible if the council is wrong |

Defaults are the historical hard-coded assumptions baked into the workflows. The operator MAY override C1/C2/C3 with explicit paths/commands at invocation; the probe resolves the override before asserting. Repos that already match the defaults see no behavior change -- only an added gate.

## The VERIFY-PROBE (run BEFORE any mutation)

1. Resolve C1 (page path) and C2 (copy surface). Missing and no override supplied -> contract unmet.
2. Run the C3 verify command ONCE on the untouched tree to establish a GREEN baseline. Already RED -> STOP: later breakage can't be attributed to the council's edits.
3. Confirm C4 (clean or operator-acknowledged working tree).
4. All four green -> proceed to mutate. Any unmet -> STOP and report, or take the `--delegate` seam.

The probe writes nothing -- it only resolves paths and runs the read-only verify command.

## The `--delegate` seam

`--delegate` (or any contract failure) switches an implementing workflow to **review-only / dry-run**:

- Run the review (council perspectives + unanimous extraction).
- Do NOT Edit/Write consumer source. Do NOT run the verify command.
- Emit the unanimous change-set as an applyable bundle: per file, the section/key, the before, and the proposed after.
- Hand the bundle to the operator or a downstream executor to apply against the contract on their side.

This makes DreamTeam safe to point at ANY repo: it either asserts the contract and mutates, or it delegates the change-set and mutates nothing.
