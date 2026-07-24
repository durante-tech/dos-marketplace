---
name: MigrateSurface
description: Move a DOS surface between homes or versions without dropping state — registration inventory, expand/contract, strangler-fig
bestPath:
  - title: "Undead-State Inventory"
    description: "Enumerate untracked state in the outgoing tree; record an explicit fate per entry before any retarget."
  - title: "Expand/Contract"
    description: "Additive first, dual-carry window, switch reads, destructive step separate and last."
  - title: "Strangler-Fig Succession"
    description: "Successor wraps the incumbent; callers migrate to the wrapper; removal becomes a no-op."
  - title: "Both-Profile Verification"
    description: "Symlink-mode and customer-install paths verified (or the covered profile stated), rollback per step."
---

# MigrateSurface Workflow

## When to Use

- Live-tree version migrations (freeze retargets, `~/.claude` symlink moves)
- Replacing a tool or hook with a successor while dependents keep working
- Changing a shape consumed by more than one reader — settings keys, JSONL schemas, registry rows, manifest pairs
- NOT for removals with no successor — use `Retire`

## Rule 1 — Inventory the undead state first

A version migration carries tracked state only. Before any live-tree retarget, inventory what is
NOT tracked and give every entry an explicit fate:

- `git status --porcelain` in the outgoing live tree — every `??` entry is state that will NOT
  survive the retarget on its own
- Third-party registrations: installer-written skills directories, CLAUDE.md appends, plugin
  state files — re-register in the new tree, or adopt into a pack so they become tracked
- Runtime pollution (job dirs, caches, task state): untrack and leave behind — deliberately

Recorded fates: `migrate` / `re-register` / `drop (reason)`. **Field precedent:** the graphify
skill registration lived only as untracked state in the v0.0.22 live tree; the v0.0.23 migration
silently dropped it, and it was re-registered by hand a day later. The inventory turns that class
of loss from a surprise into a decision.

## Rule 2 — Expand/contract for shape changes

Never change a shared shape in place. Every intermediate step must leave ALL readers valid:

1. **EXPAND** — add the new key/path/field alongside the old; ship; nothing breaks
2. **DUAL-CARRY** — writers emit both shapes; backfill existing records
3. **SWITCH READS** — consumers move to the new shape; the old is still written
4. **CONTRACT** — stop writing the old shape; remove it in a separate, later change

Destructive steps ship alone, after a zero-reference grep for the old shape. The window where
old and new readers coexist is not an edge case — during any rollout it is the normal state.

## Rule 3 — Strangler-fig for tool succession

Wrap, don't rewrite-and-swap: the successor wraps the incumbent, callers migrate to the wrapper,
and the incumbent shrinks inside it until its removal is a no-op. Characterize the incumbent's
behavior before wrapping — the wrapper carries the verification burden. DOS precedent:
`dos-release-freeze.ts` wrapping `release.sh` (RFC-0116) — preflight and verification moved into
the wrapper while the incumbent kept executing the mutation it already did correctly.

## Rule 4 — Symlink-mode awareness

Under maintainer symlink mode, live install and submodule are one inode: a step that "updates
both" is a single write, and a migration tested only there has NOT tested the customer-install
path where they are two. State which profile the migration verified, or verify both.

## Verification

- [ ] Untracked-state inventory recorded with a fate per entry
- [ ] Every intermediate step leaves all readers valid — no window reads a removed shape
- [ ] Destructive step shipped separately, after the zero-reference grep
- [ ] `sync-check` exit 0 · no NEW test failures · rollback path verified per step
