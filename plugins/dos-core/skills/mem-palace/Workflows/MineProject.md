---
name: Mine Project
description: Scans the current project repo and files its key architectural artifacts into the project's MemPalace wing, seeding the baseline context WakeUp loads at session start.
status: STABLE
bestPath:
  - title: "Detect the Project Wing"
    description: "Match the current directory against PROJECTS.md to resolve the target wing."
  - title: "Survey Project Artifacts"
    description: "Identify priority files — identity, stack, schema, API routes — and confirm scope with the operator."
  - title: "File Summary and Mine Key Files"
    description: "Write a project summary drawer, then mine each priority file into its room."
  - title: "Extract KG Facts"
    description: "Add composed_of, targets, and has_feature triples for the project entity."
  - title: "Verify Persisted"
    description: "Confirm the drawer/KG-fact delta before reporting the mining complete."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "MemPalace workflow uses custom Bridge-action vocabulary (mempalace_mine_project); canonical Mode/Output two-table shape doesn't fit"
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "MemPalace workflow has bespoke Output Format section"
---

# Mine Current Project into MemPalace

Scan the current project directory and file key artifacts into the project's MemPalace wing. This creates the baseline context that WakeUp loads at session start.

## When to Use

- Trigger phrases: "mine this project", "mine project", "bootstrap project", "populate wing", "scan project".
- Situation: scanning a whole project repo and filing its key artifacts into the project's MemPalace wing.
- NOT for mining DOS's own MEMORY/ trees — use Mine (MineProject reads a project repo; Mine reads DOS's learnings/work/telos/research).

## Project Detection

**MANDATORY FIRST STEP:** Detect the current project using PROJECTS.md.

1. Read `~/.claude/DOS/USER/PROJECTS/PROJECTS.md`
2. Match the current working directory against the Path column
3. Get the Wing name from the Wing column

If no match: tell the user to add their project to PROJECTS.md first and provide the format.

## Bounded Ingest Contract (shared by Mine · MineDir · MineProject · SyncTelos)

Every mining write follows the same four-step contract — never open-code a divergent loop:
1. **Disk-guard** — run the Step-0 preflight (INV-2 / `MemPalaceCli.ts render-disk-guard`); abort below the 5GB floor.
2. **Warm daemon** — set `DOS_USE_BRIDGE_DAEMON=1` on every bridge call (amortizes the ~8-9s cold ONNX load to ~0.18s warm).
3. **Per-tree ingest** — prefer one `mine_dir` per directory over per-file `mine_file` loops (O(dirs) spawns, not O(files)).
4. **Verify-persisted** — confirm by a `kg_stats`/drawer-count DELTA (never `memories_filed_away`).

## Step 0: Disk-Guard Preflight

```bash
# Step 0 — Disk-Guard Preflight (MANDATORY before any mining write)
# 2026-06-22 disk-fill prevention: abort ingest if the palace volume is below the safety floor.
PALACE_DIR="${MEMPALACE_DIR:-$HOME/.mempalace}"
FREE_GB=$(df -Pk "$PALACE_DIR" 2>/dev/null | awk 'NR==2 {printf "%d", $4/1048576}')
if [ "${FREE_GB:-0}" -lt 5 ]; then
  echo "🔴 DISK-GUARD ABORT — ${FREE_GB}GB free on the palace volume (< 5GB floor)."
  echo "   Mining halted to prevent a disk-fill freeze (2026-06-22). Free space, then re-run."
  exit 2
fi
echo "🟢 DISK-GUARD — ${FREE_GB}GB free (>= 5GB floor); safe to mine."
```

## Step 1: Survey the Project

Scan for key artifacts. Prioritize files that provide architectural context:

```
Priority 1 (always mine):
  - CLAUDE.md, README.md (project identity)
  - package.json, tsconfig.json, Cargo.toml, pyproject.toml (stack/deps)
  - Database schemas (schema.prisma, migrations/, supabase/)
  - API routes and endpoints

Priority 2 (mine if present):
  - .env.example (config shape, never .env itself)
  - Docker/compose files (infrastructure)
  - CI/CD configs (.github/workflows/)
  - Architecture docs (docs/, ADR/, ARCHITECTURE.md)

Priority 3 (mine selectively — summarize, don't dump):
  - Key source files (entry points, main services, core modules)
  - Config files (feature flags, i18n, routing)

NEVER mine:
  - node_modules/, .git/, dist/, build/, .next/
  - .env files (secrets!)
  - Binary files, images, fonts
  - Lock files (package-lock.json, yarn.lock, bun.lockb)
  - Test fixtures, snapshots, coverage reports
```

Report what was found and get user confirmation before mining.

## Step 2: Create Project Summary Drawer

Before mining individual files, create a single high-level summary drawer that captures the project's identity. This becomes the top drawer in L1 wake-up.

Use `mempalace_add_drawer` with:
- **wing**: detected project wing
- **room**: `architecture`
- **content**: A concise summary (~500 chars) covering:
  - What the project is
  - Tech stack
  - Key directories
  - Current state/phase

## Step 3: Mine Key Files

For each file to mine, use the bridge's `mine_file` action or `mempalace_add_drawer` directly:

**Option A — Bridge mine_file** (auto-chunks large files). Build the bridge
command deterministically (correct JSON interpolation of filepath/wing/room)
rather than hand-typing it (RFC-0126 §9 B1, transcription-risk):

```bash
CMD=$(bun ~/.claude/skills/mem-palace/Tools/MemPalaceCli.ts render-mine-file-cmd "/path/to/file" "PROJECT_WING" "ROOM_NAME")
DOS_USE_BRIDGE_DAEMON=1 eval "$CMD"   # daemon-warm (INV-7): amortize the ~8-9s cold ONNX load to ~0.18s warm
# Renders: DOS_USE_BRIDGE_DAEMON=1 uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py mine_file '{"filepath":"/path/to/file","wing":"PROJECT_WING","room":"ROOM_NAME"}'
```

Helper: `renderMineFileCommand(filepath, wing, room)` in
`Packs/mem-palace/src/Tools/MemPalaceCli.ts` (golden-tested in `MemPalaceCli.test.ts`).

**Option B — Direct drawer** (for small files or summaries):
Use `mempalace_add_drawer` MCP tool with wing, room, and content.

**Room naming convention:**
| Content Type | Room Name |
|---|---|
| Project overview, architecture | `architecture` |
| Database schema, models | `database-schema` |
| API routes, endpoints | `api-routes` |
| Services, business logic | `services` |
| Configuration, feature flags | `configuration` |
| External integrations | `external-integrations` |
| Security, auth, RLS | `security-patterns` |
| Data fetching, state management | `data-patterns` |
| UI components, pages | `routes` |
| CI/CD, deployment | `infrastructure` |

## Step 4: Extract KG Facts

<!-- kg-writer: canonical predicates only (PREDICATES.md §3) -->
> **Predicate discipline (PREDICATES.md §3).** This workflow writes KG facts and MUST use only
> canonical predicates from PREDICATES.md §1. Resolve aliases to canonical AT WRITE TIME:
> built_with → composed_of, targets_market → targets. Validate with
> `python3 ~/.claude/skills/mem-palace/Tools/validate-predicates.py --scan-workflows ~/.claude/skills/mem-palace/Workflows`.

From the mined content, extract key facts into the knowledge graph:

```
mempalace_kg_add:
  subject: PROJECT_NAME
  predicate: composed_of
  object: "Next.js 16 + Supabase"

  subject: PROJECT_NAME
  predicate: targets
  object: "local businesses in Brazil"

  subject: PROJECT_NAME
  predicate: has_feature
  object: "multi-platform social media publishing"
```

Extract 5-15 core facts that capture what the project IS, what it's built with, who it's for, and what it does.

## Step 5: Verify Persisted

**Verdict first.** Lead the verify report with a one-line verdict —
`✅ PERSISTED — Drawers +N, KG facts +M` or `🔴 NOT PERSISTED — delta 0` —
before any room/drawer detail.

Get the bridge status command from the CLI — do NOT hand-type the long
`uv run ...` prefix (RFC-0126 §9 B8); it is shared with Step 3's mine_file
callsite via one constant. Run it daemon-warm (INV-7):

```bash
DOS_USE_BRIDGE_DAEMON=1 $(bun ~/.claude/skills/mem-palace/Tools/MemPalaceCli.ts render-verify-cmd)
```

Helper: `renderBridgeStatusCommand()` in
`Packs/mem-palace/src/Tools/MemPalaceCli.ts` (golden-tested in
`MemPalaceCli.test.ts`). Show the updated wing with room breakdown and drawer
counts.

## Verify Persisted (read-back delta — never `memories_filed_away`)

1. BEFORE writing, capture a baseline count via `kg_stats` (KG facts) and/or `status` (drawer count).
2. AFTER writing, re-read the same counts and report the DELTA (e.g. "Drawers persisted: +N, KG facts: +M").
3. If the delta is 0 after a write, the write did NOT land — surface the INV-1 DEGRADED banner.
4. Surface the bridge-event ratio from `dos-memory-status.ts` (healthy band [0.99, 1.01]) as the persistence signal.

If the bridge or daemon is unreachable at any point, surface the DEGRADED banner:

```text
🔴 MEMPALACE DEGRADED — the memory bridge is unreachable.
   Reads/writes this session are NOT landing; do not assume anything persisted.
   Recover: run the Doctor workflow (`/MemPalace Doctor`) for the guided repair ladder.
```

## Intent-to-Flag Mapping

This workflow shells out to the MemPalace bridge per CreateSkill workflow Step 6 + CliFirstArchitecture.md. Translate operator phrasing into deterministic action selection and JSON-arg shape.

### Mode / Action

| User Says | Bridge Action | Effect |
|-----------|---------------|--------|
| "mine this project" / "bootstrap project memory" | `mine_file` (per priority artifact) | Auto-chunked file ingest, one drawer per chunk |
| "create a project summary drawer" | `add_drawer` | One concise architecture summary in `<wing>/architecture` |
| "tag the project with key facts" | `add_kg_fact` | Project-entity relationships (composed_of, targets, has_feature) |
| "verify the wing afterwards" | `status` | Show updated wing/room/drawer breakdown |
| "scan a directory in bulk" (alternative to per-file) | `mine_dir` | Recursively mine all eligible files under a path |

### JSON Argument Shape

| Action | Required JSON Args | Optional JSON Args |
|--------|--------------------|--------------------|
| `mine_file` | `filepath`, `wing`, `room` | `chunk_size` (int) |
| `mine_dir` | `dir`, `wing` | `room`, `include_globs`, `exclude_globs` |
| `add_drawer` | `wing`, `room`, `content` | `source_file`, `added_by` |
| `add_kg_fact` | `subject`, `predicate`, `object` | `valid_from` |
| `status` | none | none |

## Output Format

The mining-complete summary is a deterministic render of the run tallies — do
NOT hand-type the skeleton (RFC-0126 §9 B2). Render it via the CLI, passing a
JSON data file with the counts you recorded during this run:

```bash
# data.json = { project_name, wing_name, files_scanned, drawers_created,
#               kg_facts_added, rooms: [["architecture",4],["api-routes",7]] }
bun ~/.claude/skills/mem-palace/Tools/MemPalaceCli.ts render-mine-summary data.json
```

Helper: `renderMineProjectSummary(data)` in
`Packs/mem-palace/src/Tools/MemPalaceCli.ts` (golden-tested in `MemPalaceCli.test.ts`).
It emits the Wing / Files-scanned / Drawers-created / KG-facts / Rooms skeleton plus
the L1-wake-up footer byte-for-byte from the tallies.