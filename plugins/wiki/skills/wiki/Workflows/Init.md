---
name: Init
description: Bootstrap a new OKF vault — directory structure, SCHEMA.md, index.md, log.md.
status: STABLE
bestPath:
  - title: "Target Resolution"
    description: "Choose the vault creation path and guard against re-initializing an existing vault."
  - title: "Scaffold Structure"
    description: "Create the directory tree and seed SCHEMA.md from the pack template."
  - title: "Fixture Authoring"
    description: "Write index.md and log.md to establish navigation and the audit trail."
  - title: "KG Registration & Tracking"
    description: "Register the vault in the knowledge graph (graceful degrade) and log the artifact."
divergence_from_canonical:
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "Bespoke output contract — vault path, fixtures list, next-step hint"
---

# Wiki Init

Create a new vault. Run once per vault; every other workflow checks for the vault and routes here when it is missing.

<!-- partial: _workflow-voice.md skill_name=Wiki workflow_name=Init action_phrase="" -->

## When to Use

- "init vault", "create wiki", "set up a knowledge vault"
- Automatically from **Ingest** when no vault exists anywhere; **Query** and **Lint** suggest it instead (read paths never silently create state)

## Steps

### Step 1: Choose the create target

Honor an operator-specified path first. Otherwise pick the default target — **this chain MUST stay in lockstep with the find-time chain in Ingest.md Step 1** (project → cwd → global), so the vault Init creates is the vault the other workflows find:

```bash
# Choose the create target (mirrors the find-time chain, project-first)
if [ -n "${CLAUDE_PROJECT_DIR}" ]; then
  VAULT="${CLAUDE_PROJECT_DIR}/MEMORY/WIKI"
elif [ -d "$(pwd)/MEMORY" ]; then
  VAULT="$(pwd)/MEMORY/WIKI"
else
  VAULT="$HOME/.claude/MEMORY/WIKI"
fi
```

If the operator's intent is ambiguous (multiple candidate projects, or a personal vs project vault), ask before creating.

### Step 2: Idempotency guard

If `$VAULT/SCHEMA.md` already exists, STOP — report the existing vault and do not overwrite anything. Init never re-runs over a populated vault.

### Step 3: Create the structure

```bash
mkdir -p "$VAULT"/{entities,concepts,syntheses,decisions,assets}
```

### Step 4: Seed SCHEMA.md

Copy the conventions template from the installed skill:

```bash
cp ~/.claude/skills/wiki/Templates/Schema.md "$VAULT/SCHEMA.md"
```

SCHEMA.md is the vault's constitution — page types, OKF frontmatter spec, link rules, citation rule, page-worthiness gate. It co-evolves with the operator from here; the template is only the seed.

### Step 5: Write index.md

Author `$VAULT/index.md` with frontmatter `type: index` and a skeleton navigation section per directory (entities / concepts / syntheses / decisions), each initially empty. Every future page must be reachable from here within two hops.

### Step 6: Write log.md

Author `$VAULT/log.md` with a single entry:

```markdown
## [YYYY-MM-DD HH:MM] init | vault created
- Structure: entities/ concepts/ syntheses/ decisions/ assets/
- SCHEMA.md seeded from wiki pack v0.0.1 template
```

### Step 7: Register in the knowledge graph (graceful)

If MemPalace is available, record the vault: subject `project:{wing}`, predicate `has_wiki_vault`, object `$VAULT`. Degrade gracefully on **any** bridge failure — including a predicate-gate rejection (`has_wiki_vault` is unratified until an operator adds it to PREDICATES.md per RFC-0073; the bridge's default gate mode blocks unknown predicates on `add_kg_fact`). On rejection: skip the fact, file a drawer in `{wing}/skills` noting the vault path instead, and mention the pending predicate ratification in the Output. If no palace is present at all, skip silently — the vault is fully functional standalone.

### Step 8: Artifact tracking

Log the vault creation to `MEMORY/ARTIFACTS/artifacts.jsonl` per the pack artifact-tracking convention (pack `wiki`, workflow `Init`, type `vault`).

## Output

```
🏛️ VAULT INITIALIZED: <path>
📄 Fixtures: SCHEMA.md, index.md, log.md
📁 Sections: entities/ concepts/ syntheses/ decisions/ assets/
Next: "ingest <source>" to write the first pages.
```
