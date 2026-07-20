---
name: MemPalace
description: Semantic memory search, knowledge graph, content classification, and graph exploration for DOS. USE WHEN memory search, semantic search, find in memory, recall, remember, palace, mempalace, knowledge graph, mine memory, sync telos, palace status, search memories, memory status, browse palace, memory graph, past decisions, what was decided, explore connections, tunnels, classify, content type, decision, milestone, agent diary. NOT for finding prior sessions, PRDs, or git history by topic (use ContextSearch) — MemPalace answers from the semantic palace + knowledge graph.
role: researcher
accepts:
  - text
icon: Layers
colorVar: primary
colorHex: "#00e1ab"
tier: secondary
category: Engineering
displayLabel: MemPalace
marketingDescription: Semantic memory search, knowledge graph, and content classification
elevator: Semantic memory with knowledge graph
highlightWorkflows:
  - name: Memory Search
    technicalName: MemPalaceSearch
  - name: Knowledge Graph
    technicalName: KnowledgeGraph
roots:
  - PROJECT.WORK
  - PROTECTED_LOCAL
  - INSTALL
visibility: public
capabilities:
  - customization.cascade
  - four-copy.sync
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/MemPalace/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# MemPalace

Local-first AI memory system using the Method of Loci (spatial memory palace). Stores verbatim conversation content in a searchable, organized structure. Bridges DOS's file-based memory to MemPalace's semantic search and knowledge graph.

> **Boundary — MemPalace vs ContextSearch.** MemPalace is the semantic-memory + knowledge-graph substrate; to recall prior DOS work / sessions / PRDs use ContextSearch (which federates MemPalace as semantic source #9).

## Architecture

**Palace Hierarchy:** Wing → Hall → Room → Closet → Drawer

| Layer | Purpose | Example |
|-------|---------|---------|
| **Wing** | Project, person, or domain | `myproject`, `work`, `personal` |
| **Hall** | Memory type (constant across wings) | `hall_facts`, `hall_events`, `hall_discoveries`, `hall_preferences`, `hall_advice`, `hall_diary` |
| **Room** | Named idea (contextual) | `auth-migration`, `pricing-decision` |
| **Closet** | Summary pointer to original content | Auto-generated |
| **Drawer** | Verbatim original content (never summarized) | `drawer_{wing}_{room}_{hash}` |
| **Tunnel** | Cross-wing connection (same room name in multiple wings) | `auth-migration` in both `wing_team` and `wing_code` |

**Memory Layers (L0-L3):**

| Layer | Size | When Loaded | Content |
|-------|------|-------------|---------|
| **L0** | ~100 tokens | Always | Identity (per-collection embedder pin via `set_palace_embedder`; the legacy `~/.mempalace/identity.txt` file is retired) |
| **L1** | ~500-800 tokens | Always | Critical facts (top 15 drawers, auto-generated) |
| **L2** | ~200-500/room | On demand | Room-specific recall |
| **L3** | Unlimited | On demand | Full semantic search across all drawers |

**AAAK Dialect:** Experimental lossy abbreviation system for compression. Entity codes (3-letter uppercase), emotion markers, pipe-separated fields. Raw verbatim mode (no AAAK) is the production default (96.6% LongMemEval vs 84.2% with AAAK).

## v0.0.11 Sprint Capabilities (current)

The following load-bearing additions shipped in the v0.0.11 sprint. Together they shift the bridge from a single-file Python script to a multi-module facade with a persistent daemon, an audit-log spine, and a mechanized walking-skeleton operator pack.

**Bridge runtime (post-V11.13 split):**
- `mempalace_bridge.py` — facade, re-exports + dispatches
- `_bridge_drawers.py` — drawer ops (add / upsert / update / search / mine)
- `_bridge_kg.py` — KG ops (add_kg_fact / invalidate / kg_query / kg_stats)
- `_bridge_palace.py` — palace ops (status / wake_up / classify / traverse / reconcile / build_actions_table — also where `_ACTIONS_CACHE` literal lives post-split)
- `bridge_daemon.py` — persistent Unix-socket daemon (V11.18). 21x-183x speedup on warm calls. Activated via `DOS_USE_BRIDGE_DAEMON=1`.

**Audit + observability:**
- **V11.7 bridge audit log** at `~/.claude/MEMORY/STATE/bridge-actions.jsonl`. Every bridge invocation appends one record (op_kind, args_hash, status, duration). Writer lives in `~/.claude/hooks/lib/audit-log-collector.ts`, called by every `bridgeSync` / `bridgeFire` / `bridgeAsync` site in `mempalace.ts`.
- **V11.5 wing pre-flight** — `injection-observe.ts` warns at SessionStart when `.dos-projects.json` declares a wing whose path's CWD does not match any project root (catches PROJECTS.md drift early).
- **V11.6 injection circuit breaker** — degraded-mode fallback when the bridge daemon misses three heartbeats; surfaces as `mempalace.inject.degraded` in the Signals snapshot.
- **V11.23 SessionStart rfc-witness banner** — pre-commit Gate 18 + SessionStart banner driven by frontmatter `deliverables:` block parity (RFC-0079 corpus-drift detector).

**Recall surface:**
- **V11.16 RecallAdapter** consolidated across three consumers (`IntentRetrieval.hook.ts`, `Tools/recall.ts`, `Tools/pre-commit-recall.ts`). Sandi N≥3 trigger satisfied.
- **V11.20 shared `formatRecallResult`** lifted out of inline duplication into `skills/mem-palace/Recall/recallFormat.ts`.
- **V11.22 read-coverage triangulation** (gated by `DOS_RFC_0037_TRIANGULATE=1`) — `Recall/triangulate.ts` + `coverageMetric.ts`. Per-drawer `last_read_at` enables cold-decay archival without mtime imprecision.

**Garden cycle (walking skeleton):**
- **V11.2 + V11.3 MemoryGardener** at `Packs/agents/MemoryGardener/`. Daily 06:00 launchd plist `tech.durante.dos.memory-gardener-daily`. Reconciles palace integrity, audits 9 health signals, executes 3 destructive-op classes gated by 7-day soak and operator ratification (`--apply-ratified`).

**Predicate vocabulary:**
- **V11.4 predicate-gate proposal pipeline** at `MEMORY/STATE/predicate-proposals.jsonl` + operator-review CLI `Tools/predicate-proposals.ts`. Replaces silent KG predicate rejection (RFC-0073 Rule 2).

**Promotion-grade evidence:**
- **V11.15 `MEMORY/CANONICAL/`** scaffold (RFC-0037 Phase 0a) — operator-curated "what is true now" per primitive, scaffolded empty, populated by promotion only. `MEMORY/WORK/active/` and `MEMORY/WORK/archived/` placeholder structural split.

**Typed wrapper:**
- **V11.12 `mempalace-client.ts`** — typed wrapper around the bridge for hook code. Covers the bridge's full live action surface (`mempalace_bridge.py --version` is the authoritative list — never a count in prose), IDE-resolvable, replaces stringly-typed `bridgeSync("action", {...})`.

**Bridge action parity:**
- `mempalace-client.ts`, `plugin.json` `dos.bridgeSurface[]`, drift telemetry, and this reference mirror the `mempalace_bridge.py --version` surface. MCP-only tools remain documented below.

**Integrity safety net (Sentinel R39-R43, RFC-0005 §13.4 v3-resilience):**
- R39 PROJECTS.md ↔ `.dos-projects.json` parity, R40 declared-wing-provisioned, R41 statusline N×total math anti-pattern, R42 resolver source parity, R43 bridge-symbol co-location post-V11.13.

## Integration Modes

1. **Automatic** (via hooks, always running):
   - `MemPalaceWakeUp.hook.ts` — injects project-scoped L0+L1 context at SessionStart
   - `MemPalaceLearn.hook.ts` — files learnings into project wing on SessionEnd
   - `MemPalaceRate.hook.ts` — records ratings as KG facts on UserPromptSubmit
   - `MemoryHarvest.hook.ts` — extracts corrections, decisions, facts from transcript on SessionEnd
   - `CorrectionDetector.hook.ts` — queues user corrections in real-time on UserPromptSubmit
   - `MemPalaceStop.hook.ts` — auto-save checkpoint every 15 messages
   - `MemPalacePreCompact.hook.ts` — emergency save before context compaction

2. **On-demand** (via this skill):
   - Semantic search across all palace drawers
   - Deep explore — gap-aware scanning + targeted mining
   - Mine existing DOS memory into MemPalace
   - Sync TELOS docs to knowledge graph
   - Palace status overview

## Routing Checklist — memory-adjacent skills (stop at first match; R12, 2026-07-08)

Walk in order; stop at the first match:

1. Prior **sessions, PRDs, commits, git history** by topic ("what did we do about X") → **/context-search**. STOP.
2. **Semantic memories, KG facts, decisions, palace operations** (this skill's surface) → **MemPalace**. STOP.
3. Curated **prose synthesis over sources** ("what do we KNOW about X" as maintained knowledge) → **Wiki**. STOP.

Category match, not style preference: do not subdivide ("this recall feels wiki-shaped", "semantic search sounds nicer") to justify the tool you prefer — if the object is a session or PRD, it is ContextSearch even when a palace query would also return something.

## Project-Aware Routing

All hooks automatically detect the current project via `PROJECTS.md` (Wing column) and route memory to the correct MemPalace wing. When no project is detected, hooks fall back to global wings (learnings, ratings, etc.).

| Directory | Wing | Drawers |
|-----------|------|---------|
| ~/Projects/my-app | `myapp` | Architecture, skills, hooks, features |
| ~/Work/client-site | `client` | Schema, routes, services, integrations |
| ~/Personal/journal | `personal` | (run MineProject to populate) |
| (unmapped) | global fallback | learnings, ratings, work |

To add a project: add a row to `~/.claude/DOS/USER/PROJECTS/PROJECTS.md` with Path and Wing columns.

## Hook Strategy: Why DOS Doesn't Use `mempalace hook run`

Upstream ships a hook runner — `mempalace hook run --hook {session-start,stop,precompact} --harness claude-code` — that emits a hook decision (e.g. `STOP_BLOCK_REASON`, `PRECOMPACT_BLOCK_REASON`) telling the AI to invoke MCP save tools under time pressure. DOS deliberately does NOT adopt this surface. Our `MemPalaceStop.hook.ts` header (rewritten 2026-05-04) records why: the block-and-ask-AI pattern (a) interrupts flow, (b) relies on AI memory under stress, (c) loops if the AI fails to act. DOS hooks save autonomously via `bridgeSync.add_drawer` + `add_kg_fact` and ALLOW the stop to proceed — no AI cooperation required. If you ever consider switching to `mempalace hook run`, re-read the MemPalaceStop header before doing so.

## Memory Protocol ↔ INTEL-FIRST

Upstream MemPalace ships a *Memory Protocol* — a behavioral guide returned by `mempalace_status` that tells the AI: "Before responding about any person, project, or past event: search first, never guess." This is documentation; compliance depends on the model remembering to read and apply it.

DOS mechanizes the same rule. The **INTEL-FIRST guard** (Sentinel R14, implemented at `~/.claude/hooks/IntelFirstGuard.hook.ts`) is a PreToolUse hook that intercepts entity-subject Bash calls and blocks them until `bun ~/Durante/Tools/intel-context.ts <entity> --format json` has been invoked at least once in the session. The CLI fans out across 7 internal surfaces (MemPalace KG + drawer, Studio relationships/sessions, MEMORY/RESEARCH + RELATIONSHIP + ARTIFACTS grep) and stamps `🔍 INTEL PRE-FLIGHT:` in OBSERVE output. So upstream's "search first, never guess" doctrine becomes mechanical enforcement in DOS — model adherence is no longer load-bearing.

## MCP Tools Available

29 tools on the upstream PyPI MCP server (`python -m mempalace.mcp_server`). The bridge.py wrapper at `~/.claude/DOS/Tools/mempalace_bridge.py` adds one DOS-side action — `last_checkpoint` — as a clearer alias for `memories_filed_away` (same handler). AI clients that go through MCP must use the upstream tool name `mempalace_memories_filed_away`; DOS hooks calling the bridge directly may use either.

### Palace Read (8)

| Tool | Purpose |
|------|---------|
| `mempalace_list_wings` | All wings with drawer counts |
| `mempalace_list_rooms` | Rooms within a wing (or all rooms) |
| `mempalace_get_taxonomy` | Full wing → room → count hierarchy |
| `mempalace_search` | Semantic search with wing/room filtering |
| `mempalace_check_duplicate` | Check similarity before filing (threshold 0-1) |
| `mempalace_get_aaak_spec` | AAAK dialect specification reference |
| `mempalace_get_drawer` | Fetch full drawer body by ID |
| `mempalace_list_drawers` | Enumerate drawers (ISO-only `since`/`before` bounds on `filed_at` — upstream 3.6.0, relative forms like `24h` NOT accepted; `sort=recent` orders by coalesce(`authored_at`,`filed_at`,`timestamp`) — DOS P1r; recency keys live under `metadata`, no top-level `timestamp`; the MCP shape takes NO `preview_chars` — that argument is bridge-only, see W-2) |

### Palace Write (3)

| Tool | Purpose |
|------|---------|
| `mempalace_add_drawer` | File verbatim content with duplicate check |
| `mempalace_update_drawer` | Modify an existing drawer in place |
| `mempalace_delete_drawer` | Remove a drawer by ID (irreversible) |

### Status (3)

| Tool | Purpose |
|------|---------|
| `mempalace_status` | Palace overview — drawers, wings, AAAK + protocol prose (heavier; lean by default in v3.3.4) |
| `mempalace_kg_stats` | Graph overview (entities, triples, types) |
| `mempalace_memories_filed_away` | Check whether a recent SessionStop checkpoint was filed (upstream-canonical MCP name; bridge.py also exposes a `last_checkpoint` action — same handler, clearer DOS-side name) |

### Knowledge Graph (4)

| Tool | Purpose |
|------|---------|
| `mempalace_kg_query` | Entity relationships with temporal filtering |
| `mempalace_kg_add` | Add temporal facts (triples) |
| `mempalace_kg_invalidate` | Mark facts as no longer true |
| `mempalace_kg_timeline` | Chronological entity history |

### Tunnels (4)

| Tool | Purpose |
|------|---------|
| `mempalace_create_tunnel` | Create a cross-wing connection between rooms |
| `mempalace_list_tunnels` | List tunnels (filterable by wing/room) |
| `mempalace_delete_tunnel` | Remove a tunnel by ID |
| `mempalace_follow_tunnels` | Walk tunnel edges from a starting room |

### Navigation (3)

| Tool | Purpose |
|------|---------|
| `mempalace_traverse` | Walk graph from a room across wings (handler: `tool_traverse_graph`) |
| `mempalace_find_tunnels` | Find rooms bridging two wings |
| `mempalace_graph_stats` | Palace graph overview |

### Agent Diary (2)

| Tool | Purpose |
|------|---------|
| `mempalace_diary_write` | Write agent journal entry (lowercase `agent_name` recommended) |
| `mempalace_diary_read` | Read agent's recent diary entries (lowercase `agent_name` recommended) |

> **Convention: lowercase agent names.** The lib auto-folds case (v3.3.4+),
> so mixed-case writes still work, but lowercase (`fox`, `engineer`,
> `pentester`) is the canonical form for consistency across write and read
> sites. See SKILL.md "Acceptance-Discovered Workarounds" §W-1 for history.

### Operational (2)

| Tool | Purpose |
|------|---------|
| `mempalace_hook_settings` | Inspect/adjust hook execution flags |
| `mempalace_reconnect` | Re-bind the MCP server to the current palace |

### Bridge-Only Actions (DOS-side, not MCP-exposed)

| Action | Purpose |
|--------|---------|
| `append_reflection` | Atomic JSONL append for algorithm reflection lines — closes the POSIX `O_APPEND` PIPE_BUF gap (>4096-byte writes can interleave under concurrent writers, breaking PhaseCompleteGate's per-line `JSON.parse`). DOS hooks call the bridge directly; not surfaced through the MCP server. |

### Naming: `memories_filed_away` (MCP) vs `last_checkpoint` (bridge)

Upstream PyPI mempalace 3.3.4 exposes only `mempalace_memories_filed_away` on
its MCP server. The fork (`durante-tech/dos-mempalace`) renamed the canonical
to `mempalace_last_checkpoint` and kept the legacy as alias, but DOS no longer
pins to that fork (see `Hooks/lib/mempalace.ts`). DOS bridge.py preserves a
`last_checkpoint` action as a clearer DOS-side alias for the same handler so
hooks can read more naturally; AI clients that go through the MCP server only
see `mempalace_memories_filed_away`.

```
// MCP path (AI clients): mempalace_memories_filed_away()  // upstream canonical
// Bridge path (DOS hooks): bridge('last_checkpoint') or bridge('memories_filed_away')
// All three resolve to the same checkpoint-inspection handler.
```

## CLI Commands

```bash
mempalace init <dir>              # Guided setup, entity detection
mempalace mine <dir>              # Mine project files into palace
mempalace search "query"          # Semantic search (--wing, --room filters)
mempalace wake-up                 # Load L0+L1 context (~170 tokens)
mempalace status                  # Palace overview
mempalace split <dir>             # Split concatenated transcripts
mempalace compress --wing <name>  # AAAK compression
mempalace repair                  # Rebuild vector index
```

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Search** | search, find, literal lookup, keyword search, grep memory, past decisions, what was decided | `Workflows/Search.md` |
| **Recall** | recall, recall X, retrieve, remember, what do we know about, query memory, semantic recall, semantic+KG fanout | `Workflows/Recall.md` |
| **Save** | save, file this, store this, remember this, write to memory, file a drawer | `Workflows/Save.md` |
| **Pin** | pin, always-load, L1 pin, force into context, sticky memory | `Workflows/Pin.md` |
| **Compact** | last compaction, last checkpoint, precompact save, show compaction record | `Workflows/Compact.md` |
| **MineProject** | mine this project, mine project, bootstrap project, populate wing, scan project | `Workflows/MineProject.md` |
| **MineDir** | mine directory, bulk index, index this folder, backfill files into palace | `Workflows/MineDir.md` |
| **Mine** | mine DOS memory, mine learnings, mine conversations, bootstrap mempalace | `Workflows/Mine.md` |
| **SyncTelos** | sync telos, knowledge graph, map goals, map beliefs | `Workflows/SyncTelos.md` |
| **Status** | status, overview, palace info, wings, rooms | `Workflows/Status.md` |
| **DeepExplore** | deep explore, explore project, update memory, mine gaps, refresh palace, what's missing in memory | `Workflows/DeepExplore.md` |
| **Explore** | explore, traverse, tunnels, connections, bridges, graph walk | `Workflows/Explore.md` |
| **Classify** | classify, content type, memory type, decision or preference | `Workflows/Classify.md` |
| **Garden** | garden, run gardener, hygiene pass, audit palace, prune drawers, MemoryGardener | `Workflows/Garden.md` |
| **MergeEntities** | review entity merges, KG entity duplicates, apply merge proposals | `Workflows/MergeEntities.md` |
| **MergePredicates** | merge predicates, collapse predicate aliases, canonical predicate form | `Workflows/MergePredicates.md` |
| **MergeReconcile** | reconcile findings, KG reconcile, fix orphans, invalid triples cleanup | `Workflows/MergeReconcile.md` |
| **Diary** | agent diary, diary write, diary read | `Workflows/Diary.md` |
| **Closets** | closets, build closets, rebuild closets, suggest parent | `Workflows/Closets.md` |
| **Doctor** | doctor, repair memory, bridge down, degraded, recover palace | `Workflows/Doctor.md` |

**Tie-break:** `'recall X' -> Recall; literal keyword lookups -> Search`.

### Mining quartet (disambiguate by SOURCE)

The four ingest workflows differ only by what they read FROM — pick by source, never by overlapping trigger words:

| Workflow | SOURCE (reads from) |
|----------|---------------------|
| **Mine** | DOS `MEMORY/` trees (`LEARNING/`, `WORK/`, `RESEARCH/`) |
| **MineDir** | an arbitrary directory you point it at |
| **MineProject** | a project repo (project root → wing) |
| **SyncTelos** | TELOS markdown (`~/.durante/user/TELOS/`) |

### Workflow intent buckets (every workflow maps to exactly ONE)

```text
RETRIEVE  → Search · Recall · Explore · DeepExplore
RECORD    → Save · Pin
INGEST    → Mine · MineDir · MineProject · SyncTelos
CURATE    → Classify · MergeEntities · MergePredicates · MergeReconcile · Compact · Diary · Closets
DIAGNOSE  → Status · Garden · Doctor
```

## Integration

- **Feeds into:** ContextSearch (semantic source #9), LoadContext (deep retrieval)
- **Uses:** DOS MEMORY system, TELOS documents, ratings.jsonl
- **Bridge:** `~/.claude/DOS/Tools/mempalace_bridge.py`
- **Source:** upstream `mempalace` package on PyPI (Python, MIT; version pinned by install-mempalace.sh — installed via `~/Durante/Tools/install-mempalace.sh`, which also re-applies the local WAL-bounding PRAGMA patch pending upstream PR MemPalace/mempalace#1365)

## Examples

**Example 1: Search past decisions**
```
User: "What did we decide about the auth middleware?"
→ Invokes Search workflow
→ Semantic search across all wings for "auth middleware decision"
→ Returns verbatim drawer content with wing/room context
```

**Example 2: Mine existing memory into palace**
```
User: "Mine my DOS memory into MemPalace"
→ Invokes Mine workflow
→ Ingests MEMORY/LEARNING/, MEMORY/WORK/, MEMORY/RESEARCH/
→ Files content into appropriate wings/halls/rooms
```

**Example 3: Deep explore — find and fill gaps**
```
User: "Deep explore this project" / "What's missing in memory?"
→ Invokes DeepExplore workflow
→ Runs PalaceExplore.ts to scan project vs MemPalace state
→ Shows gap report: 36% coverage, 18 gaps (3 P0, 14 P1, 1 P2)
→ Mines P0 gaps first (skills, hooks, packs, API routes, schema)
→ Creates KG triples connecting artifacts to project entity
→ Reports before/after coverage improvement
```

**Example 4: Explore cross-domain connections**
```
User: "Find tunnels between my projects"
→ Invokes Explore workflow
→ Uses mempalace_find_tunnels to discover shared rooms across wings
→ Visualizes cross-wing connections
```

## Acceptance-Discovered Workarounds (RFC-0028)

The 2026-04-25 acceptance battery surfaced six lib-side defects that the bridge
cannot fix from the DOS side (the MCP server is invoked directly by agents and
bypasses the bridge entirely). Lib v3.3.4 (fork pointer) lands the fixes; the
historical workarounds remain documented below for context.

### W-1 — Lowercase `agent_name` (softened in v3.3.4)

`mempalace_diary_read` originally filtered case-sensitively, so writes as
`agent_name="Fox"` were invisible to reads with `agent_name="fox"`. The lib
now auto-folds case at write and read sites, so mixed-case calls work.
**Convention: lowercase agent names** (`fox`, `engineer`, `pentester`) is
still the canonical form for consistency across hooks and skills.

### W-2 — `list_drawers` preview is hardcoded ~200 chars

`mempalace_list_drawers` truncates `content_preview` at ~200 characters with no
`preview_chars` argument. When workflows need full content, the pattern is:

1. Call `mempalace_list_drawers(...)` to enumerate drawer IDs and the truncated
   preview.
2. For each drawer that needs full content, follow up with
   `mempalace_get_drawer(drawer_id=...)` which returns the entire stored body.

Do NOT rely on the preview for substantive matching — it cuts off mid-sentence.

### W-3 — Lean status (skip the ~6KB `status` payload) **[RETIRED-as-mandate — fixed in lib v3.3.4]**

`mempalace_status` originally returned palace_path + protocol prose + AAAK
dialect copy + 130 rooms — roughly 6KB of context per call. As of A5 in
v3.3.4, the default response is lean (~500 bytes); identity prose and AAAK
spec are opt-in. The `kg_stats() + list_wings()` pair is no longer required
as a workaround — `mempalace_status` is the recommended primary status check.
The pair pattern remains useful when you specifically want graph counts.

### W-4 — Search similarity reads as 0.0; rank by `distance` instead **[RETIRED — fixed in lib v3.3.4]**

The `similarity` field returned by `mempalace_search` originally clamped to
0.0 whenever the cosine `distance` exceeded 1.0 (the lib computed
`max(0, 1 - distance)`). A1 in v3.3.4 switches to graded similarity in the
0..1 range — use `similarity` directly for ranking and confidence gating.
Workflows that previously ranked by `distance` (lower is better) still work
but are no longer required.

### W-5 — `created_at: "unknown"` in search responses

The drawer metadata holds `filed_at`, but the search response field defaults
to `"unknown"`. Treat `created_at: "unknown"` as a display-side bug, not as
missing data. If a temporal filter is needed, pull the drawer via
`mempalace_get_drawer` and read `filed_at` directly.

### W-6 — `memories_filed_away` returns "quiet" despite recent activity

`mempalace_memories_filed_away` (now aliased as `mempalace_last_checkpoint` —
the canonical name in v3.3.4+) tracks SessionStop checkpoints, NOT drawer
additions. A "quiet" return does not mean the palace is idle — it means no
SessionStop checkpoint has fired since the window opened. To check actual
write activity, call `mempalace_kg_stats()` and compare against the last
known `triple_count`.

These workarounds are tracked as Tier A items in **RFC-0028
(`Plans/Specs/RFC-0028-mempalace-acceptance-fixes.md`)**. Each has a proposed
upstream issue body in that RFC; v3.3.4 (fork pointer) lands W-1, W-3, W-4
fixes. W-2, W-5, W-6 remain pre-fix but are tracked for upstream patches.

## Bridge Actions & MCP Tools (Reference)

RFC-0005 §13.1 R6 — every public surface is named here so `check-skill-md-drift.ts` catches additions or removals that never made it into the docs.

**Bridge actions** (`~/.claude/DOS/Tools/mempalace_bridge.py` ACTIONS dict):

- Drawers: `add_drawer`, `upsert_drawer`, `update_drawer`, `delete_drawer`, `list_drawers`, `audit_drawer` (cap 11 explainable-recall provenance bundle; hook/agent-internal, no user workflow)
- Knowledge graph: `add_kg_fact`, `invalidate`, `kg_query`, `kg_query_predicate`, `kg_timeline`, `kg_stats`, `update_entity`, `merge_entities`
- Search / status: `search`, `status`, `wake_up`, `fact_check`, `suggest_parent`, `last_checkpoint`, `memories_filed_away`
- Mining / reflection / diary: `mine_file`, `mine_dir`, `mine_convos`, `append_reflection`, `diary`
- Classification / navigation / tunnels: `classify`, `traverse`, `find_tunnels`, `create_tunnel`, `graph_stats`
- Maintenance / admin: `init`, `batch`, `reconcile`, `build_closets`, `rebuild_closets`, `backfill_closets`

**MCP tools** (`mempalace.mcp_server` — exposed as `mcp__mempalace__mempalace_<tool>`):

- Reads: `status`, `list_wings`, `list_rooms`, `get_taxonomy`, `search`, `check_duplicate`, `get_drawer`, `list_drawers`, `last_checkpoint` (alias: `memories_filed_away`), `last_checkpoint_at` (non-destructive "when?"), `get_aaak_spec`
- Writes: `add_drawer`, `update_drawer`, `delete_drawer`, `kg_add`, `kg_invalidate`
- KG reads: `kg_query`, `kg_timeline`, `kg_stats`
- Tunnels: `create_tunnel`, `list_tunnels`, `delete_tunnel`, `find_tunnels`, `follow_tunnels`, `traverse_graph`, `graph_stats`
- Diary: `diary_write`, `diary_read`
- Operational: `hook_settings`, `reconnect`

When either surface grows, add the name here and run `bun ~/Durante/Tools/check-skill-md-drift.ts` to verify coverage.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/mem-palace/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/mem-palace/` — active release submodule (versioned)
3. `Packs/*/src/mem-palace/` — pack source (distributable)
4. `Packs/agents/mem-palace/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
