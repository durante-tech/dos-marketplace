---
name: Ingest
description: Read one immutable source, extract durable claims, write/update interlinked vault pages with citations.
status: STABLE
bestPath:
  - title: "Vault Resolution"
    description: "Find the existing vault (or trigger Init) and load its SCHEMA.md constitution."
  - title: "Source Intake & Gate"
    description: "Read the source read-only, extract durable claims, and apply the page-worthiness gate."
  - title: "Page Authoring"
    description: "Map claims to existing or new vault pages, writing cited, interlinked content."
  - title: "Journal & Tracking"
    description: "Update index.md navigation, append the log.md entry, and log the artifact."
divergence_from_canonical:
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "Bespoke output contract — pages created/updated, citation counts, fixture updates"
---

# Wiki Ingest

The write path. One source in, a set of cited, interlinked pages out — or an honest "not page-worthy" and nothing but a log line.

<!-- partial: _workflow-voice.md skill_name=Wiki workflow_name=Ingest action_phrase="" -->

## When to Use

- "ingest <source>", "add <doc> to the wiki", "wiki this"
- After a discussion produces durable conclusions worth compiling

## Steps

### Step 1: Resolve the vault

Find an **existing** vault — a vault exists where `SCHEMA.md` does (never bind to a bare directory):

```bash
# Resolve an EXISTING vault (project → cwd → global; SCHEMA.md is the marker)
if [ -f "${CLAUDE_PROJECT_DIR}/MEMORY/WIKI/SCHEMA.md" ]; then
  VAULT="${CLAUDE_PROJECT_DIR}/MEMORY/WIKI"
elif [ -f "$(pwd)/MEMORY/WIKI/SCHEMA.md" ]; then
  VAULT="$(pwd)/MEMORY/WIKI"
elif [ -f "$HOME/.claude/MEMORY/WIKI/SCHEMA.md" ]; then
  VAULT="$HOME/.claude/MEMORY/WIKI"
else
  VAULT=""
fi
```

If `$VAULT` is empty (no vault anywhere), run the **Init** workflow first, then **adopt the path Init reports as `$VAULT`** — do not keep a previously assumed location. Init's create target is project-first, so the two chains converge on the same vault.

### Step 2: Load the constitution

Read `$VAULT/SCHEMA.md` in full. It may have co-evolved past the pack template — the vault's own copy always wins.

### Step 3: Read the source — read-only

Read the source completely (file, URL content, PRD, RFC, transcript). **Never edit, move, or delete a source.** If the source is a conversation rather than a file, restate the claims to the operator before writing.

### Step 4: Page-worthiness gate

Apply the SCHEMA.md gate: does this source add **durable claims** — something that would change a Query answer six months from now? 

- **No** → output `⛔ NOT PAGE-WORTHY: <one-line reason>`, optionally append a one-line `log.md` entry, and STOP. Writing junk pages is the failure mode this pack exists to prevent.
- **Yes** → list the durable claims explicitly before touching any page. In interactive sessions, surface the claim list to the operator as takeaways.

### Step 5: Map claims to pages

Read `$VAULT/index.md`. For each claim, decide: does it belong on an **existing** page (update — one concept, one file, path is identity) or a **new** page (entity / concept / synthesis / decision per SCHEMA.md)? Prefer updating existing pages over creating near-duplicates.

### Step 6: Write pages

For each touched page:

- OKF v0.1 frontmatter — `type` required; `title`, `description`, `tags`, `timestamp` (set to now — substantive revision), `resource` when a canonical URL exists.
- **Citation rule:** every load-bearing factual claim carries a `citations:` entry — `source:` path always; additionally `kg:` when MemPalace is available and the fact exists there (verify via `kg_query` before citing — never fabricate a `kg:` reference).
- **Links:** standard markdown links relative to the vault root, to every related page touched or referenced. Update inbound links on pages that now relate to the new content.

### Step 7: Update navigation

Update `$VAULT/index.md` so every new page is reachable within two hops.

### Step 8: Append the journal

Append to `$VAULT/log.md`:

```markdown
## [YYYY-MM-DD HH:MM] ingest | <source title>
- Pages created: <list or none>
- Pages updated: <list or none>
- Claims: <N> durable claims compiled
```

### Step 9: Artifact tracking

Log the ingest to `MEMORY/ARTIFACTS/artifacts.jsonl` (pack `wiki`, workflow `Ingest`, type `wiki-pages`, path = vault path).

## Output

```
📥 INGESTED: <source>
📄 Created: <n> pages | Updated: <m> pages
🔗 Citations: <k> (kg: <x>, source-path: <y>)
🗂️ index.md + log.md updated
```

List each page with its vault-relative path so the operator can open it directly.
