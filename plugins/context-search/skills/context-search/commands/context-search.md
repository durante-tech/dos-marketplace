---
name: Context Search
description: Search prior work to add context to a request, or browse previous sessions on a topic. Use before/after a request to ground it in past work, or standalone to recall and familiarize before asking.
argument-hint: [topic]
---

# Context Search

Search all prior work for: **$ARGUMENTS**

## Your Task

You are searching prior work on the topic "$ARGUMENTS". Search across ALL available sources, synthesize what you find, and present a context summary.

**Two usage modes:**

1. **Standalone (no accompanying request):** Search, present findings, familiarize yourself with the context, then wait for a request. Say: "I've loaded context on [topic]. What would you like to do?"

2. **Paired with a request (context search used before or after a task request):** Search first, load the context, then execute the accompanying request informed by that context. Do NOT start the request until context search is complete.

## Step 0: Construct the Query

Before searching, shape "$ARGUMENTS" into terms that will actually match (query-construction contract, Amendment R companion):

1. **Content nouns only.** Query with the topic's own words — proper nouns, project names, component names ("trigger registry", "MemPalace closets") — never meta-words describing the act of working ("discussed", "session", "yesterday", "that thing"). Meta-words match nothing useful.
2. **Never search a pasted passage.** If the topic arrives as a document, code block, or long prose, extract 2–4 distinctive keywords from it; the passage itself is never the query.
3. **Too vague to keyword → ask.** "That thing we decided" carries no content nouns; ask which thing rather than guessing.
4. **One broadening retry.** If the grep sources return nothing, retry once with broader or fewer terms before declaring no-hit — and never report "no prior work found" unless the searches actually ran (§R.1 recall floor).

## Step 1: Detect Environment

Check which data sources exist. This determines whether you're on a vanilla Claude Code install or a DOS-enhanced one.

```
DOS detected if: ~/.claude/MEMORY/WORK/ or MEMORY/WORK/ directory exists
```

## Step 2: Search (execute available searches in parallel)

### Always Available (any Claude Code install)

**A. Conversation History**
Search `~/.claude/history.jsonl` for lines where the `display` field matches "$ARGUMENTS" (case-insensitive, partial match). Each line is JSON with fields: `display`, `timestamp`, `project`, `sessionId`. Extract the most recent 10 matching entries with their timestamps and project paths.

**B. Current Project Git History**
Run: `git log --oneline --all --grep="$ARGUMENTS" -i -20` to find commits in the current project mentioning this topic.

**C. Project Memory Files**
Use Glob to find `~/.claude/projects/*/memory/*.md` files, then Grep across them for "$ARGUMENTS" to find any saved context from prior projects.

### DOS-Enhanced (only if MEMORY/WORK/ or ~/.claude/MEMORY/WORK/ exists)

**D. Session Registry**
Read `~/.claude/MEMORY/STATE/work.json` and find all sessions where the `task` field, slug key, or `sessionName` field matches "$ARGUMENTS" (case-insensitive, partial match). Extract: task, phase, progress, effort, started, criteria summary.

**E. Work Directories**
Search BOTH locations for matching directory names (case-insensitive, partial match). For each match, read the PRD.md frontmatter and `## Context` section.
```bash
# Project-level PRDs (travel with the repo)
find MEMORY/WORK -maxdepth 1 -type d 2>/dev/null
# Global PRDs
find ~/.claude/MEMORY/WORK -maxdepth 1 -type d 2>/dev/null
```

**F. DOS Git History**
Run: `git -C ~/.claude log --oneline --all --grep="$ARGUMENTS" -i -20` to find commits in the DOS repo mentioning this topic.

**G. Session Names**
Read `~/.claude/MEMORY/STATE/session-names.json` and find entries where the session name matches "$ARGUMENTS" (case-insensitive, partial match).

**H. PRD Content Search**
Search BOTH locations for PRD content matches:
```bash
# Project-level PRDs first
find MEMORY/WORK -name "PRD.md" 2>/dev/null
# Then global PRDs
find ~/.claude/MEMORY/WORK -name "PRD.md" 2>/dev/null
```
Use Grep to search for "$ARGUMENTS" across all found PRD files for deeper context matches. Deduplicate results across both locations.

### Opt-in: Semantic Search Branch (DOS-enhanced only)

**Default behavior is grep-only** (sources A–H above): literal substring matching across history, git, PRDs, session names. Grep is fast, deterministic, and good when the operator already knows the exact term.

**When to add a semantic branch:** invoke the semantic-search branch when the operator wants **conceptually related** work, not just textual matches. Trigger heuristics:

1. The query is conceptual/thematic, not a literal string (e.g., "things related to auth burnout", "prior decisions about coupling vs cohesion", "places where we changed our mind about X")
2. The operator passes `--semantic` or says "search semantically" / "find conceptually similar" / "what was that thing about…"
3. Grep returned <3 results and the query is multi-word (textual match too narrow for the concept)

**Semantic branch invocation** — call MemPalace's `search` bridge action (the canonical semantic-search shape; the bridge dispatches to ChromaDB). Use the canonical daemon-routed invocation `python3 ~/.claude/DOS/Tools/mempalace_bridge.py` (the CLAUDE.md bridge-surface contract) so the call benefits from the RFC-0075 V11.18 persistent daemon — not a fresh `uv run --with mempalace` environment spun up per call:

```bash
# Single bridge call — semantic search across all drawers
python3 ~/.claude/DOS/Tools/mempalace_bridge.py search "$(jq -nc \
  --arg q "$ARGUMENTS" \
  '{query: $q, limit: 10}')"
```

Parse the JSON response — it returns `{ status, results: [ {wing, room, content, score, source_file, ...} ] }`. Surface the top 10 results sorted by score (highest first), grouped by wing.

**Optional wing-scoped variant** (when the operator names a project context):

```bash
python3 ~/.claude/DOS/Tools/mempalace_bridge.py search "$(jq -nc \
  --arg q "$ARGUMENTS" --arg w "$WING" \
  '{query: $q, wing: $w, limit: 10}')"
```

**Display semantic results in a separate output section** (do not interleave with grep results — they have different epistemic shape):

```
🧠 SEMANTIC MATCHES (conceptually related, top 10 by similarity):
  • [wing/room] [score: 0.87] — [content preview]
    Source: [source_file]
```

**Fallback:** If the bridge is unavailable or returns `status: error`, skip the semantic section silently and proceed with grep-only output. Note the skip in a single line at the bottom: `(semantic search unavailable — bridge offline)`. The grep results are always SoT; semantic is additive.

**Cost:** One bridge subprocess call (~70-100ms cold, near-zero warm under the V11.18 persistent daemon). The canonical `python3 …mempalace_bridge.py` invocation above is what realizes that warm-daemon path. Negligible — but still keep it opt-in to avoid over-fetching when grep is sufficient.

> **Fleet coordination note (not a ContextSearch fix):** the `uv run --with mempalace python …` form is the fleet-wide convention (20+ call sites across MemPalace's own workflows + Sales), and it likely spins a fresh uv environment per call rather than hitting the RFC-0075 daemon. ContextSearch adopts the canonical `python3` daemon path locally; auditing/migrating the fleet-wide `uv run` convention (and confirming whether it bypasses the daemon) is a separate coordination item, tracked against RFC-0075 — not landed here.

## Source Schema Couplings (drift watch)

The grep sources above read structured fields by name; if those producers rename a field, the search silently under-matches. This pack is **deliberately prose-orchestrated** (the sources are agent-driven greps/finds — the value is the synthesis, not a deterministic transform, so it is not extracted into a tool), but the dependencies are explicit so a schema change is a known break, not a silent one:

| Source | File | Fields the search reads |
|---|---|---|
| A. Conversation history | `~/.claude/history.jsonl` | `display`, `timestamp`, `project`, `sessionId` |
| D. Session registry | `~/.claude/MEMORY/STATE/work.json` | `task`, `phase`, `progress`, `effort`, `started`, `sessionName` (+ slug key) |
| E/H. Work directories / PRDs | `MEMORY/WORK/**/PRD.md` (project + global) | frontmatter + the `## Context` section |
| G. Session names | `~/.claude/MEMORY/STATE/session-names.json` | the session-name value |
| Semantic | MemPalace `search` bridge action | response `{ status, results:[{wing, room, content, score, source_file}] }` |

If a producing pack changes one of these schemas, update the matching source step here in the same change.

## Output Format

Present your findings as:

```
═══ CONTEXT SEARCH: $ARGUMENTS ══════════════════

📋 MATCHING SESSIONS (sorted by most recent first):

  For each match:
  • [session slug or sessionId] — [task description or user prompt]
    Phase: [phase] | Progress: [progress] | Effort: [effort]
    Started: [date] | Last updated: [date]
    Key context: [1-2 sentence summary]
    Criteria status: [X passed / Y total] (if DOS PRD available)

🔗 RELATED COMMITS (last 20):
  • [commit hash] [message] ([date])

💬 CONVERSATION HISTORY (recent matching prompts):
  • [timestamp] [project] — [user prompt excerpt]

📂 WORK DIRECTORIES:
  • [list of matching directory names]

───────────────────────────────────────────────
```

Omit any section that has no results. Only show sections with actual matches.

## After Presenting Results

**Mode 1 — Standalone (no accompanying request):**
1. If matches found: Read the most recent matching PRD (if DOS) or summarize the most recent conversation context. Then say: "I've loaded context on [topic]. The most recent session was [X]. What would you like to do?"
2. If no matches found: Say: "No prior work found on [topic]. What would you like to do?"

**Mode 2 — Paired with a request:**
1. If matches found: Read the most recent matching PRD (if DOS) or summarize the most recent conversation context. Then proceed to execute the accompanying request, fully informed by the recovered context.
2. If no matches found: Proceed with the request anyway, noting that no prior context was found.

## Important

- Sort everything by recency (newest first)
- If DOS PRDs found, read the top 3 in full for context
- Be concise but thorough — the goal is instant context recovery
- If there are more than 10 matches in any section, show the 10 most recent and mention the total count
- The conversation history search (history.jsonl) can be large — limit to 10 most recent matches
