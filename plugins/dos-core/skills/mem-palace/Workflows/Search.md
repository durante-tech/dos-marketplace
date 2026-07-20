---
name: Search
description: Runs semantic vector search across palace drawers by meaning rather than keywords, with wing/room scoping and similarity-band grading.
status: STABLE
bestPath:
  - title: "Parse the Query"
    description: "Extract content-noun search terms and optional wing/room scope from the request."
  - title: "Run Semantic Search"
    description: "Call the MCP search tool or bridge search action."
  - title: "Enrich and Grade Results"
    description: "Grade each result's similarity into HIGH/MEDIUM/LOW bands and add source context."
  - title: "Present Results and Offer Traversal"
    description: "Lead with a verdict, then offer graph traversal or a refined search on follow-up."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "MemPalace workflow uses custom Bridge-action vocabulary (mempalace_search/traverse + JSON Argument Shape sub-table); canonical Mode/Output two-table shape doesn't fit"
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "MemPalace workflow has bespoke Output Format section"
---

# Semantic Search Across MemPalace

Search DOS's memory by meaning, not just keywords. Returns the most semantically similar memories to your query.

## When to Use

- Trigger phrases: "search", "find", "literal lookup", "keyword search", "grep memory", "past decisions", "what was decided".
- Situation: finding memories by meaning across palace drawers, scoped to a wing/room if known.
- NOT for "recall X" or KG-fused queries — use Recall (Search owns literal/keyword-only phrasing; Recall fuses semantic search with KG facts).

## Project-Aware Search

When in a mapped project directory, default to searching within the project's wing first. Use PROJECTS.md to detect the wing:

- **Project search**: `mempalace_search(query, wing="durante")` — search within project
- **Global search**: `mempalace_search(query)` — search across all wings
- **Cross-project**: `mempalace_search(query, wing="altyaa")` — search another project

Detect current project wing from PROJECTS.md before searching.

## Your Task

Use MemPalace's semantic search to find relevant memories, then present results clearly.

## Step 1: Parse the Query

Extract from the user's request:
- **query**: What they're looking for (strip "search memory for", "recall", "what did we decide about", etc.)
- **wing** (optional): If they specify a domain — "in learnings", "from work", "in telos". If no wing is specified and the user is in a mapped project directory, detect the wing from PROJECTS.md and default to that project's wing.
- **room** (optional): If they specify a subtopic — "algorithm learnings", "project X"
- **limit**: Default 5, or as specified

**Query-construction contract (R7, 2026-07-08):**
1. Query with **content nouns** — the topic's own words (proper nouns, project names, component names) — never meta-words describing the act of working ("discussed", "session", "yesterday", "that thing"). Meta-words embed to nothing useful.
2. **Never search a pasted passage.** If the topic arrives as a document or long prose, extract 2–4 distinctive keywords; the passage itself is never the query.
3. **Too vague to keyword → ask** ("that thing we decided" carries no content nouns).
4. **One broadening retry** before declaring no-hit — and never report "nothing in memory" unless the search actually ran (§R.1 recall floor).

## Step 2: Search via MCP or Bridge

**Preferred: Use MCP tool if available:**
```
mempalace_search(query="...", limit=5, wing="...", room="...")
```

**Fallback: Use bridge:**
```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py search '{"query":"USER_QUERY","limit":5}'
```

With wing/room filtering:
```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py search '{"query":"USER_QUERY","limit":5,"wing":"learnings","room":"algorithm"}'
```

If the MCP tool errors or the bridge/daemon (`$DOS_DIR/MEMORY/STATE/.mempalace.sock`) is unreachable, do NOT present empty results as "no matches" — render the DEGRADED banner and stop:

```text
🔴 MEMPALACE DEGRADED — the memory bridge is unreachable.
   Reads/writes this session are NOT landing; do not assume anything persisted.
   Recover: run the Doctor workflow (`/MemPalace Doctor`) for the guided repair ladder.
```

## Step 3: Enrich Results

For each result, check if the source file still exists and add context:
- If `source_file` points to a DOS file, note the category (learning, work, telos, etc.)
- Grade each result's `similarity` against the shared band table:

| Band   | similarity   | Label         |
|--------|--------------|---------------|
| HIGH   | >= 0.70      | strong match  |
| MEDIUM | 0.40 – 0.69  | partial match |
| LOW    | < 0.40       | loose match   |

> **Use `similarity` (0..1, higher is better).** As of lib v3.3.4 (A1 fix),
> `similarity` is graded properly across the full range — rank and confidence-gate
> on it directly. The `distance` field is still emitted for ranking by
> nearest-neighbour distance if preferred. See SKILL.md "Acceptance-Discovered
> Workarounds" §W-4 for the pre-fix history (workaround `[RETIRED]`).

> **`created_at` may read as `"unknown"`.** That's a display-side bug — the
> drawer metadata holds `filed_at`. If a temporal filter is needed, fetch the
> drawer with `mempalace_get_drawer(drawer_id=...)` and read `filed_at` from
> the returned object. See §W-5.

> **`list_drawers` previews truncate at ~200 chars by default.** Two options:
> 1. **One-shot full content (A3 in v3.3.4):**
>    `mempalace_list_drawers(wing="...", preview_chars=2000)` returns
>    enumerated drawers with up to 2000 characters of body — no second
>    round-trip per drawer.
> 2. **Two-step:** call `mempalace_list_drawers(...)` then
>    `mempalace_get_drawer(drawer_id=...)` for each match needing the
>    full body.
>
> Use option 1 when you'll likely read most of the listed drawers; option 2
> when you'll filter heavily and only fetch a few. See §W-2.

## Intent-to-Flag Mapping

This workflow shells out to the MemPalace bridge per CreateSkill workflow Step 6 + CliFirstArchitecture.md. Translate operator phrasing into deterministic action selection and JSON-arg shape.

> **Scope note — Search vs Recall.** Search owns literal/keyword/semantic-search-only phrasing. The **"recall X"** trigger is NOT handled here — it routes to the **Recall** workflow, which deterministically owns "recall X" (semantic search fused with knowledge-graph recall). Send "recall …" requests to Recall.

### Mode / Action

| User Says | Bridge Action | Effect |
|-----------|---------------|--------|
| "search memory for <topic>" / "what did we decide about <topic>?" | `search` | Vector search across drawers, returns top-N matches |
| "in <wing> wing, search for <topic>" | `search` (wing filter) | Same search scoped to a single wing |
| "list drawers in <wing>/<room>" (when full bodies needed before filtering) | `list_drawers` (MCP-side pre-fetch) | One-shot enumerate-with-body alternative to two-step search |
| "explore connections from <result-room>" (follow-up traversal) | `traverse` | Graph traversal from a search-result room |

### JSON Argument Shape

| Action | Required JSON Args | Optional JSON Args |
|--------|--------------------|--------------------|
| `search` | `query` (string) | `limit` (int, default 5), `wing` (string), `room` (string) |
| `traverse` | `start_room` (string) | `max_hops` (int, default 2) |

## Step 4: Present Results

The FIRST line is a verdict (result count + echoed query). The SECOND line NAMES the executed surface and wing scope.

```
N results found across M wings · query: "USER_QUERY"
Memory Search — semantic (ChromaDB) [wing: WING]

  1. [wing/room] (confidence: HIGH|MEDIUM|LOW)
     Content preview (first 200 chars)...
     Source: path/to/source.md

  2. [wing/room] (confidence: ...)
     ...
```

If no results found:
```
No memories matching "USER_QUERY"

The palace may need more data. Try:
  - "mine my DOS memory" to bootstrap from existing files
  - A broader search query
  - Removing wing/room filters
```

## Step 5: Explore Connections (Graph Traversal)

After presenting search results, check if any results have interesting room metadata.
If so, offer graph traversal to discover related ideas:

```
mempalace_traverse(start_room="RESULT_ROOM", max_hops=2)
```

Or via bridge:
```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py traverse '{"start_room":"RESULT_ROOM","max_hops":2}'
```

If traversal finds connected rooms in other wings, present them:
```
  Connected ideas:
    "auth" also appears in: security/recon, work/project-x
    → These might have related context
```

## Step 6: Offer Follow-up

After presenting results, suggest:
- "Want to see the full content of any result?"
- "Explore connections from [room]?" — graph traversal
- "Search with different terms?"
- "Browse the [wing] wing for more?"
- "Show timeline for [entity]?" — KG timeline