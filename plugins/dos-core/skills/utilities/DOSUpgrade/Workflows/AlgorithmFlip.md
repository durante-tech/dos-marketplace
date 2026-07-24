---
name: Algorithm Flip
description: Flip the active DOS Algorithm version pointer across the four-copy universe.
status: STABLE
---

# AlgorithmFlip Workflow

## Overview

After `AlgorithmUpgrade` proposes a new version and the principal has drafted the new `vX.Y.Z.md` file, this workflow handles the cross-cutting pointer flip so every consumer (CLAUDE.md, native agents, hooks, DynamicAgent.hbs, Delegation SKILL, Ensemble prompt renderer, etc.) loads the new version.

```
NEW ALGORITHM FILE DRAFTED                 →   AlgorithmFlip
~/.claude/DOS/Algorithm/<to>.md                (this workflow)
$RELEASE_PATH/DOS/Algorithm/<to>.md

                                               ↓

┌─ CLAUDE.md live + submodule ────────────────────────────┐
│  MANDATORY FIRST ACTION: load DOS/Algorithm/<to>.md     │
├─ 15× native agents × 2 copies ──────────────────────────┤
│  Subagent Algorithm Profile reference → <to>.md         │
├─ _algorithm-lite.md × 2 ────────────────────────────────┤
├─ 4 hook files (SubagentReturn, IntentRetrieval) × 2 ────┤
├─ DynamicAgent.hbs × 3 (live + submodule + pack source) ─┤
├─ Delegation SKILL.md/partials × 4 ──────────────────────┤
└─ Ensemble RenderSessionPrompt.ts × 3 ───────────────────┘
```

---

## Prerequisites

Before running this workflow, the new Algorithm file **must exist** in both live and submodule:

```bash
RELEASE_PATH=$(jq -r '.dos.releasePath' ~/.claude/settings.json)  # resolves to the ACTIVE release, e.g. Releases/v0.0.21/.claude
ls -la ~/.claude/DOS/Algorithm/<to>.md \
       ~/Durante/"$RELEASE_PATH"/DOS/Algorithm/<to>.md
```

If either is missing, the tool refuses to flip (exit code 2). Draft the new version first — this workflow only flips pointers, it does not create the Algorithm file itself.

---

## Process

### Step 1: Preview the flip

Always dry-run first to see the blast radius:

```bash
bun ~/Durante/Tools/algorithm-flip.ts <from> <to> --dry-run
```

Output reports every file that would be touched, grouped by which pattern fired:

- **`section-anchor`** — `DOS/Algorithm/<from>.md` Subagent Algorithm Profile anchor → `DOS/Algorithm/<to>.md` Subagent Algorithm Profile anchor (drops the versioned suffix)
- **`bare-path`** — plain `DOS/Algorithm/<from>.md` path references

Expected file count for a typical flip: 80-100 files across live + submodule + Packs/. If the count is radically different, stop and investigate before writing.

### Step 2: Execute the flip

```bash
bun ~/Durante/Tools/algorithm-flip.ts <from> <to>
```

The tool:
1. Applies both patterns to every matched file
2. Re-scans for stale `<from>` references in active scope (must be 0)
3. Runs `sync-check` to confirm four-copy parity
4. Exits 0 only if both checks pass

### Step 3: Verify

```bash
bun ~/Durante/Tools/sync-check.ts --summary
RELEASE_PATH=$(jq -r '.dos.releasePath' ~/.claude/settings.json)  # resolves to the ACTIVE release, e.g. Releases/v0.0.21/.claude
grep -rn "DOS/Algorithm/<from>\.md" ~/.claude ~/Durante/"$RELEASE_PATH" ~/Durante/Packs \
  | grep -v "/MEMORY/\|/projects/-Users-\|/file-history/\|/history.jsonl\|/DOS/Algorithm/v"
```

Expected: `sync-check` passes with 0 drift; grep returns no matches.

### Step 4: Ship

If verification is clean, commit with `ship-submodule` to preserve atomic submodule-first/parent-second ordering:

```bash
bun ~/Durante/Tools/ship-submodule.ts "feat(algorithm): flip active pointer <from> → <to>"
```

---

## What the tool protects

The following references are **never** rewritten, even when they mention `<from>`:

- `DOS/Algorithm/v0.0.1.md §35` historical citations (stable anchor for the "subagents never voice" rule across all versions)
- `DOS/Algorithm/v*.md` files themselves (they contain their own version string)
- `MEMORY/` session artifacts (PRDs, reflections, ratings)
- `projects/-Users-*` conversation history
- `file-history/` Claude Code snapshot storage
- `history.jsonl` session transcripts
- `.git/` and `node_modules/`

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Flip succeeded (or dry-run previewed cleanly) |
| 1 | Post-flip stale references remain OR sync-check failed |
| 2 | Pre-flight: target file missing, bad args, or versions identical |
| 3 | IO error |

---

## CLI Reference

```
bun ~/Durante/Tools/algorithm-flip.ts <from> <to> [--dry-run] [--json] [--help]
```

| Flag | Purpose |
|------|---------|
| `--dry-run` | Preview changes without writing; skips sync-check |
| `--json` | Machine-readable output for scripting |
| `--help` | Print usage and exit 0 |

Version arguments must match `vN.N.N` (e.g., `v0.0.5`, `v1.2.3`). `<from>` and `<to>` must differ.

---

## Relation to AlgorithmUpgrade

| Workflow | Responsibility |
|----------|----------------|
| **AlgorithmUpgrade** | Mines reflections + spec analysis → *proposes* what a new Algorithm version should contain (content) |
| **AlgorithmFlip** (this) | Once the new version file exists → *activates* it by flipping all cross-cutting pointers |

Typical lifecycle: `AlgorithmUpgrade` → principal drafts `vX.Y.Z.md` with the proposals applied → `AlgorithmFlip` cuts the pointer over.
