---
name: SentinelEvolve
description: Update conventions when patterns intentionally change — invalidates old KG facts, adds new ones, updates CLAUDE.md and cache.
status: STABLE
bestPath:
  - title: "Identify the Change"
    description: "Parse what convention is changing, the new pattern, and why."
  - title: "Confirm with User"
    description: "Use AskUserQuestion to confirm the old-to-new convention swap before writing."
  - title: "Update Knowledge Graph"
    description: "Invalidate the old convention fact and add the new one in a single batch."
  - title: "Update CLAUDE.md"
    description: "Swap the old convention text for the new one in the Sentinel Conventions section."
  - title: "Regenerate Convention Cache"
    description: "Rebuild .sentinel/conventions.json from current KG state for Guard."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Sentinel Evolve workflow uses workflow-specific intent-to-flag vocabulary; canonical Mode/Output two-table shape doesn't fit"
---

# Sentinel Evolve — Convention Evolution

<!-- kg-writer: Evolve -->

Updates conventions when patterns intentionally change. Keeps the knowledge graph, CLAUDE.md, and convention cache in sync.

<!-- partial: _workflow-voice.md skill_name=Sentinel workflow_name=Evolve action_phrase=" to update conventions" -->

## When to Use

- After `sentinel guard` reports a "Potential Evolution"
- When the team intentionally adopts a new pattern
- When a convention is no longer relevant
- Examples: "We're switching from barrel exports to direct imports", "We're moving to Hono from Express"

## Workflow

### Step 1: Identify the Change

Parse the user's request to understand:
- **What convention is changing** (category + old pattern)
- **What the new convention is** (new pattern)
- **Why** (optional, for documentation)

If invoked from Guard output, the evolution details are already structured.

### Step 2: Confirm with User

Use AskUserQuestion to confirm:

```
Sentinel wants to update a convention:

**Category:** {category}
**Old:** {old pattern}
**New:** {new pattern}

This will:
1. Mark the old convention as expired in the Knowledge Graph
2. Add the new convention as a current fact
3. Update CLAUDE.md Sentinel Conventions section
4. Regenerate the convention cache

Proceed?
```

### Step 3: Update Knowledge Graph

<!-- partial: _robust-kg-write.md -->

Do the invalidate + add as ONE batch per the robust-write contract above — both
ops share a single WAL transaction so the expire and the replacement can never
land half-applied. `convention` is already canonical
(`Packs/mem-palace/PREDICATES.md` §1.8), so it is emitted unchanged:

```bash
# Replace {wing} / {old_pattern} / {new_pattern} with the confirmed values.
cat > /tmp/sentinel-evolve-batch.json <<'EOF'
{
  "operations": [
    {"action": "invalidate",  "args": {"subject": "project:{wing}", "predicate": "convention", "object": "{old_pattern}", "ended": "TODAY"}},
    {"action": "add_kg_fact", "args": {"subject": "project:{wing}", "predicate": "convention", "object": "{new_pattern}", "valid_from": "TODAY"}}
  ]
}
EOF

# Submit — ONE process, ONE SQLite connection, ONE WAL transaction
RESPONSE=$(uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py batch "$(cat /tmp/sentinel-evolve-batch.json)")

# Parse the status — NOT the exit code or tail -1 (the bridge always exits 0)
bun ~/.claude/skills/sentinel/Tools/SentinelScan.ts parse-batch "$RESPONSE" \
  || { echo 'Evolve Step 3 batch FAILED — abort, do not claim success'; exit 1; }

# MANDATORY direct-SQLite verification — the new convention fact must be present
sqlite3 ~/.mempalace/knowledge_graph.sqlite3 \
  "SELECT COUNT(*) FROM triples WHERE subject='project:{wing}' AND predicate='convention' AND object='{new_pattern}'"
# Expected: >= 1 (the replacement convention persisted)
```

### Step 4: Update CLAUDE.md

Replace the `## Sentinel Conventions` section so the old convention text is swapped for
the new one. The find-and-replace of the named section is a single tested transform —
`updateClaudeMdSection(content, newSection)` in `SentinelScan.ts` — shared with Scan.md
Phase 4b so the two sites can never drift apart. It locates the `## Sentinel Conventions`
heading, replaces its body up to the next same-or-higher heading (create-or-replace if
absent), and preserves everything outside the section byte-for-byte:

```bash
# Read CLAUDE.md, build the updated ## Sentinel Conventions block (swap old → new
# convention), and write it back through the tested section-replace helper via a
# portable subcommand (no hardcoded home path).
bun ~/.claude/skills/sentinel/Tools/SentinelScan.ts update-claude-md CLAUDE.md "$NEW_SENTINEL_CONVENTIONS_SECTION"
```

Where `$NEW_SENTINEL_CONVENTIONS_SECTION` is the full `## Sentinel Conventions` block
with the old convention line swapped for the new one. The Edit tool remains acceptable
for a one-line in-place swap, but the helper is preferred because it is the same
byte-exact transform Scan.md uses.

### Step 5: Regenerate Convention Cache

Re-run the convention cache generation:

```bash
bun ~/.claude/skills/sentinel/Tools/ConventionCache.ts
```

This reads the current KG state and regenerates `.sentinel/conventions.json`.

## Intent-to-Flag Mapping

This workflow shells out to the MemPalace bridge and `Tools/ConventionCache.ts`. Translate operator phrasing into deterministic flag selection per CreateSkill workflow Step 6 + CliFirstArchitecture.md.

### Step Selection (which tool to invoke)

| Evolve Stage | Tool | Effect |
|--------------|------|--------|
| Mark old convention expired (Step 3) | MemPalace bridge `<invalidate>` | Closes the validity window of the old convention fact |
| Add new convention as current (Step 3) | MemPalace bridge `<add_kg_fact>` | Files the new convention with `valid_from` set to today |
| Regenerate convention cache (Step 5) | `ConventionCache.ts` | Reads current KG state and rewrites `.sentinel/conventions.json` |

### MemPalace Bridge Payload Fields

| User Says | Field | Effect |
|-----------|-------|--------|
| "for this project / wing" | `subject: "project:<wing>"` | Scopes the convention to the active project wing |
| "convention category" | `predicate: "convention"` | All convention facts use this predicate |
| "old pattern", "current convention" | `object: "<old_pattern>"` (invalidate) | Identifies the convention fact to expire |
| "new pattern" | `object: "<new_pattern>"` (add_kg_fact) | The replacement convention text |
| "as of today" | `valid_from` / `ended` | Today's date in ISO format |

### ConventionCache.ts Inputs

| User Says | Argument | Effect |
|-----------|----------|--------|
| "regenerate the cache" (default) | (none) | Reads current KG state, writes `.sentinel/conventions.json` |
| "show usage", "help" | `--help, -h` | Prints help text and exits |

### Step 6: Output

```markdown
## Convention Evolved

**Category:** {category}
**Was:** {old pattern}
**Now:** {new pattern}

### Updated:
- KG: Old fact expired, new fact added
- CLAUDE.md: Convention section updated
- Cache: `.sentinel/conventions.json` regenerated

The new convention will be enforced by `sentinel guard` going forward.
```
