---
name: Explore
description: Walks the palace graph (traverse, find_tunnels, graph_stats) to discover implicit cross-wing connections, and optionally curates explicit tunnels.
status: STABLE
bestPath:
  - title: "Choose a Starting Point"
    description: "Pick a room, a wing pair, or request an open discovery of all tunnels."
  - title: "Traverse or Query Tunnels"
    description: "Run traverse, find_tunnels, or graph_stats to surface connections."
  - title: "Follow or Curate Connections"
    description: "Explore deeper with more hops, or create/delete explicit tunnels as needed."
  - title: "Present Results"
    description: "Lead with a verdict — tunnel and connected-room counts — before the detailed graph view."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "MemPalace workflow uses custom Bridge-action vocabulary (mempalace_search/traverse/explore); canonical Mode/Output two-table shape doesn't fit"
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "MemPalace workflow has bespoke Output Format section"
---

# Explore Palace Graph — Discover Cross-Domain Connections

Walk the palace graph to find implicit connections between ideas across different wings and rooms.

## When to Use

- Trigger phrases: "explore", "traverse", "tunnels", "connections", "bridges", "graph walk".
- Situation: discovering implicit cross-domain or cross-wing connections already present in the palace graph.
- NOT for gap-filling a project's coverage — use DeepExplore (Explore walks existing connections; DeepExplore mines what's missing).

## Your Task

Use graph traversal to discover how topics relate across domains. This reveals insights that flat search misses — like "auth" being a tunnel between the "work" and "security" wings.

## Step 1: Choose Starting Point

Ask the user what to explore, or infer from context:
- A room name: "explore connections from auth"
- A wing: "what bridges learnings and work?"
- Open discovery: "show me all tunnels"

## Step 2: Graph Traversal

**For room-based exploration — use MCP or bridge:**

MCP: `mempalace_traverse(start_room="auth", max_hops=2)`

Bridge:
```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py traverse '{"start_room":"auth","max_hops":2}'
```

**For cross-wing bridges:**

MCP: `mempalace_find_tunnels(wing_a="durante", wing_b="altyaa")`

Bridge:
```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py find_tunnels '{"wing_a":"durante","wing_b":"altyaa"}'
```

> **Project wings as tunnel sources:** Project wings create natural tunnel opportunities. Cross-project tunnels (e.g., `durante <-> altyaa`) surface shared patterns like common auth approaches, database conventions, or API design decisions across codebases. Also try tunnels between project wings and global wings (e.g., `durante <-> learnings`) to connect project-specific work with general insights.

**For full graph overview:**

MCP: `mempalace_graph_stats()`

Bridge:
```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py graph_stats '{}'
```

For a palace-wide tunnel listing (no wing filter), use `find_tunnels` with empty args:
```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py find_tunnels '{}'
```

## Write Modes — Create and Delete Tunnels

Traversal, `find_tunnels`, `graph_stats`, and `search` are READ modes. The palace graph also exposes two WRITE modes for curating explicit tunnels: `create_tunnel` and `delete_tunnel`. Reach for these when a cross-wing connection is real but the implicit graph missed it (create), or when a surfaced tunnel is spurious and should be pruned (delete).

**Create an explicit cross-wing tunnel:**

MCP: `mempalace_create_tunnel(source_wing="durante", source_room="api-design", target_wing="altyaa", target_room="db-schema", label="shared auth model")`

Bridge:
```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py create_tunnel \
  '{"source_wing":"durante","source_room":"api-design","target_wing":"altyaa","target_room":"db-schema","label":"shared auth model"}'
```

**Delete a spurious tunnel by ID (MCP-only):**

MCP: `mempalace_delete_tunnel(tunnel_id="tunnel-1234")`

The bridge exposes no `delete_tunnel` action (verified against bridge v3.5.0 `--version`
truth — the action list has `create_tunnel` but deletion is MCP-surface only).

## Step 3: Follow Interesting Connections

For each tunnel or connected room found:
1. Run `mempalace_search` scoped to that room to see what's there
2. If a connection is surprising, highlight it
3. Offer to traverse deeper (increase max_hops)

## Intent-to-Flag Mapping

This workflow shells out to the MemPalace bridge per CreateSkill workflow Step 6 + CliFirstArchitecture.md. Translate operator phrasing into deterministic action selection and JSON-arg shape.

### Mode / Action

| User Says | Bridge Action | Effect |
|-----------|---------------|--------|
| "explore connections from <room>" / "show me what's connected to <room>" | `traverse` | Walk graph from a starting room outward by N hops |
| "what bridges <wing-a> and <wing-b>?" / "find tunnels between <wing-a> and <wing-b>" | `find_tunnels` | List rooms appearing in both wings (cross-wing concerns) |
| "show me all tunnels" / "give me the full graph overview" | `find_tunnels` (empty args) | List all tunnels palace-wide (no wing filter) |
| "give me the graph stats" / "how many rooms and tunnels are there?" | `graph_stats` | Counts: total rooms, tunnel connections, cross-wing edges |
| "search inside <room>" (after a tunnel is surfaced) | `search` | Scope a semantic search to that room for follow-up |
| "create a tunnel between <room-a> and <room-b>" / "link <wing-a> to <wing-b>" | `create_tunnel` | **WRITE** — add an explicit cross-wing tunnel |
| "delete tunnel <id>" / "remove that spurious tunnel" | `delete_tunnel` | **WRITE** — remove a tunnel by its ID |

### JSON Argument Shape

| Action | Required JSON Args | Optional JSON Args |
|--------|--------------------|--------------------|
| `traverse` | `start_room` (string) | `max_hops` (int, default 2) |
| `find_tunnels` | none — `{}` is valid | `wing_a`, `wing_b` (strings; both must be set to scope) |
| `graph_stats` | none — `{}` is valid | none |
| `search` | `query` (string) | `wing`, `room`, `limit` (int) |
| `create_tunnel` (WRITE) | `source_wing`, `source_room`, `target_wing`, `target_room` (strings) | `label`, `source_drawer_id`, `target_drawer_id` (strings) |
| `delete_tunnel` (WRITE) | `tunnel_id` (string) | none |

## Step 4: Present Results

Lead with the verdict — a single top line that states the outcome before any detail:

```
VERDICT — [N] tunnels / [M] connected rooms across [K] wings from "[starting point]" (or "no cross-domain connections found").

Palace Graph Exploration: "[starting point]"

  Connected Rooms (2 hops):
    auth → [work/project-x, security/recon, learnings/decisions]
    project-x → [work/api-design, telos/goals]

  Tunnels (rooms bridging wings):
    "auth" bridges: work <-> security (3 drawers each)
    "api-design" bridges: work <-> learnings (5 drawers each)

  Insights:
    - "auth" appears across 3 wings — this is a cross-cutting concern
    - "api-design" connects your work to past learnings

  Explore deeper?
    - "search auth decisions" — see what's in the auth room
    - "traverse from api-design" — follow that connection
```

## If the Bridge Is Unreachable

Every step above shells out to the MemPalace bridge (or the MCP surface). If a bridge/MCP call errors out or the daemon socket is dead, the graph you would render is stale or empty — STOP and surface the DEGRADED banner verbatim instead of presenting a misleading "no connections" verdict:

```text
🔴 MEMPALACE DEGRADED — the memory bridge is unreachable.
   Reads/writes this session are NOT landing; do not assume anything persisted.
   Recover: run the Doctor workflow (`/MemPalace Doctor`) for the guided repair ladder.
```