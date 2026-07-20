---
name: Query
description: Answer a question from the vault with page citations; file decision-grade answers back as synthesis pages.
status: STABLE
bestPath:
  - title: "Vault Resolution"
    description: "Locate the vault, or direct the operator to Init and Ingest if none exists."
  - title: "Graph Navigation"
    description: "Traverse index.md and linked pages to identify candidate content."
  - title: "Cited Synthesis"
    description: "Compose an answer from page citations, stating coverage gaps honestly."
  - title: "File-Back (Decision-Grade)"
    description: "Write decision-grade answers back as a synthesis page and update the log."
divergence_from_canonical:
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "Bespoke output contract — cited answer, coverage gaps, file-back path"
---

# Wiki Query

The read path. Answers come from pages, with citations; the vault's coverage limits are stated honestly. Decision-grade answers compound — they get filed back.

<!-- partial: _workflow-voice.md skill_name=Wiki workflow_name=Query action_phrase="" -->

## When to Use

- "ask the wiki", "what do we know about <topic>", "what did we conclude about <topic>"
- Before starting work in an area the vault covers

## Steps

### Step 1: Resolve the vault

Use the standard resolution block (see `Workflows/Ingest.md` Step 1). If no vault exists, say so and suggest Init + Ingest — do not silently answer from general knowledge as if it came from the vault.

### Step 2: Navigate

Read `$VAULT/index.md`, identify candidate pages, and traverse their markdown links (pages link to related pages — follow the graph, not just the index).

### Step 3: Synthesize with citations

Compose the answer from page content:

- Every factual claim in the answer cites the page it came from (vault-relative path).
- Where pages cite `kg:` facts or source paths, carry the deep citation through — the reader should be able to trace answer → page → source.
- **Honesty rule:** if the vault does not cover part of the question, state the gap explicitly. Knowledge added from outside the vault must be marked as such — never laundered through the wiki's authority.

### Step 4: File-back gate (decision-grade answers)

If the answer settles something durable — a cross-source synthesis that future queries will want — file it back:

1. Write a `syntheses/` page per SCHEMA.md (type `synthesis`, citations to the pages it drew from).
2. Update `index.md`; append a `query` entry to `log.md`.
3. Log to `MEMORY/ARTIFACTS/artifacts.jsonl` (pack `wiki`, workflow `Query`, type `synthesis`).

Skip the file-back for lookups and ephemeral questions — the page-worthiness gate applies to answers too.

## Output

```
📖 ANSWER (from <n> pages):
<the synthesized, cited answer>

🔍 Coverage gaps: <what the vault does not know, or none>
📝 Filed back: <syntheses/... path, or not decision-grade>
```
