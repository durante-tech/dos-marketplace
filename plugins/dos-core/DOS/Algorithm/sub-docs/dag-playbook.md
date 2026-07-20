<!--
  Algorithm v0.0.7 sub-doc — DAG with Parallel Teammates
  Status: Phase 1 (canonical, 2026-05-04)
  Source: 4 production deliveries on 2026-05-04 (post-tragedy 5-stream,
  mempalace-intel 4-stream, algorithm-v007 3-stream, datetime-dag-default
  solo-with-justification)
  Loaded on demand via "Sub-Docs" footer when DAG-WITH-TEAMMATES DEFAULT rule fires.
-->

# DAG with Parallel Teammates — The 8-Step Canonical Pattern

When PARALLELISM PRE-CHECK Q2 = yes AND scope ≥4 ISCs, this is the default execution mode. Skip silently if scope is solo-justified per DAG-WITH-TEAMMATES DEFAULT escape clause.

## When NOT to use (escape clauses)

- ≤3 files AND ≤6 ISCs (overhead exceeds work)
- Shared mutable state precludes file-zone partition (e.g. one config file all streams need to mutate)
- Narrative coherence required across all edits (e.g. doctrine writing where rules must read consistently against each other)
- Single-file work with no logical sub-zones

In all four cases: solo with explicit reason in PRD `## Decisions`. The escape clause is the worked example precedent — see this sub-doc's own delivery (`MEMORY/WORK/20260504-191500_algorithm-datetime-dag-default/PRD.md`).

## The 8-step pattern

### 1. PRD with Pre-Delegation Contract

PRD frontmatter as usual. Add to `## Context`:

```markdown
### Pre-Delegation Contract (file ownership)

| Stream | Owns (writes) | Forbidden |
|--------|---------------|-----------|
| **A — <name>** | `path/to/file1.ts`, `path/to/file2.ts` | files owned by other streams |
| **B — <name>** | `path/to/file3.ts` | files owned by other streams |
| ... | | |

**Conflict zones:** declare upfront when 2+ streams touch the same file on
disjoint line-ranges (e.g. "C and E both touch mempalace.ts; C owns body
lines 200-500; E owns const block lines 80-120; line-range partition
prevents conflicts").
```

### 2. TeamCreate

```
TeamCreate({
  team_name: "<descriptive-kebab-name>",
  description: "<N>-stream parallel delivery of <M> ISCs from <source>",
  agent_type: "team-lead"
})
```

If a previous team is still leader: `TeamDelete()` first, then `TeamCreate`.

### 3. TaskCreate per ISC (teammate-mode specialization)

One `TaskCreate` per ISC (subject ≤80 chars, description ≤200 chars). Then wire DAG dependencies via `TaskUpdate addBlockedBy: [<id>, ...]`.

Per-ISC granularity applies to THIS mode only (tasks are assignment units teammates claim). The general projection rule — solo-mode clustering, metadata contract, completion binding, re-projection — is defined once in `sub-docs/task-projection.md` (RFC-0149); this section is its teammate-mode specialization. Carry `metadata: {prd, iscs, phase, stream}` on each create per that contract.

### 4. Parallel Agent spawn (single message, multiple Agent calls)

```
[Agent for Stream A, Agent for Stream B, Agent for Stream C, ...] in one message
```

Each Agent call:
- `subagent_type: "Engineer"` (or appropriate specialist)
- `team_name: "<team-name>"`
- `name: "stream-<letter>-<descriptor>"`
- `model: "sonnet"` (rarely "opus" for the most strategic stream)
- `run_in_background: true` (NEVER blocking — wait for SendMessage notifications)

### 5. Per-stream prompt template

Each stream gets a self-contained prompt:

```markdown
You are Stream <letter> (<purpose>) of a <N>-stream parallel delivery team.
Team name: <team-name>.

CONTEXT
<one paragraph on why this work exists, what it follows up on>

Audit + delivery PRD: `<absolute-path>` — READ IT FIRST.

YOUR ISCs (<count> total)
- ISC-<id>: <subject>
- ...
Task IDs <range> in team task list.

LOCKED DECISIONS
<bullet list of principal-locked or THINK-locked decisions that constrain your work>

FILE OWNERSHIP (yours)
- <absolute path>
- ...

FORBIDDEN
- <other streams' zones>

REFERENCE READING (mandatory before BUILD)
- <files that explain context>

EXECUTION
1. Read PRD + reference files
2. Claim tasks via TaskUpdate (set owner)
3. <execution order>
4. Mark each task complete via TaskUpdate
5. SendMessage team-lead with: per-ISC evidence, sample output, sync-check exit
6. Go idle

CRITICAL
- chmod 755 on every new *.hook.ts and *.daemon.ts (lesson from post-tragedy)
- Run `bun ~/Durante/Tools/sync-check.ts --summary` after every multi-copy edit
- All 13 KG predicates already in PREDICATES.md §1.4 + §1.8 — gate accepts new writes
- Voice notifications FORBIDDEN (subagent rule per Algorithm doctrine)

START NOW.
```

### 6. Acknowledgment + TaskUpdate as streams complete

For each stream report:
- `SendMessage` ack with confirmed wins + cross-stream coordination notes
- `TaskUpdate` mark each ISC complete (some streams self-complete; if so the IDs return "Task not found" — that's fine)
- Update delivery PRD progress counter

### 7. Integration: sync-check + commit submodule + commit parent + push

```
bun ~/Durante/Tools/sync-check.ts --summary
# expect: exit 0, X identical, 0 drift, 0 missing

cd Releases/v0.0.6/.claude
git add <explicit list — NEVER -A>
git commit -m "<message>"
# pre-commit 16-gate dispatch fires (sync, voice, build, conformance, R9/R10,
# manifest, env, studio, back-port, doctor) — fix any ERROR before continuing
git push origin main

cd ~/Durante
git add <explicit list> Releases/v0.0.6/.claude
git commit -m "<message>"
git push origin main
# pre-push gate runs sync-check; expect ✓ pre-push: sync-check clean
```

Common gate failures and fixes:

| Gate | Symptom | Fix |
|------|---------|-----|
| Voice (G3) | "guarantee/guaranteed/seamless/leverage/etc forbidden" | Swap word; preserve meaning |
| R9 lint (G6) | "undeclared bridge invocation" in plugin.json | Add action to dos.bridge[] in plugin.json (3 copies) |
| sync-check (G1) | "drift detected" | `bun ~/Durante/Tools/sync-check.ts --fix` |
| chmod | "Permission denied at hook fire time" | `chmod 755 *.hook.ts *.daemon.ts` |

### 8. Reflection + shutdown

```
# Append to reflections JSONL (use fresh `date -u` per DATETIME GROUND TRUTH)
cat >> ~/.claude/MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl <<'EOF'
{"timestamp":"<run date -u>","effort_level":"<tier>",...}
EOF

# Shutdown each teammate
SendMessage to each: {"type": "shutdown_request", "reason": "<thanks>"}

# Wait for shutdown_approved + teammate_terminated notifications
# Team auto-dissolves
```

## Pre-Delegation Contract examples (from real deliveries)

### Example 1: post-tragedy 5-stream (2026-05-04)

| Stream | Owns | Forbidden |
|--------|------|-----------|
| A — Backup/Safety | hooks/{MemoryBackup,RmGuard,DrainPressure,ArchivePromote}.hook.ts; settings.json hook entries | other streams' files |
| B — Statusbar | statusline/segments/memory.ts; new voice-health.ts | hooks, bridge code |
| C — Bridge | KgMerge.hook.ts, KgReconcile.hook.ts, hooks/lib/mempalace.ts BODY | mempalace.ts KNOWN_BRIDGE_ACTIONS const |
| D — Sentinel | Packs/sentinel/src/Tools/* + .sentinel/ regen | hooks |
| E — Tidies | mempalace.ts lines 82-110 ONLY + lines 530-545 ONLY; .gitignore | mempalace.ts BODY (C owns) |

Conflict zone disclosed: C+E both touch mempalace.ts on disjoint line-ranges. Zero merge conflicts at integration.

### Example 2: mempalace-intel 4-stream (2026-05-04)

Cross-stream coordination win: Stream P added `queried_by_session` to PREDICATES.md before Stream I needed it. Disjoint mempalace.ts sections (P near bridgeSync line 334; I near top line 40). Per-stream prompts explicitly named the coordination expectation.

### Example 3: algorithm-v007 3-stream (2026-05-04)

Single-file delivery (v0.0.7.md) with 3 streams editing 3 disjoint line-zones (R: 147-329, W: 330-561, X: 562-end + new sub-doc). Proved the line-range partition pattern works for single-file work too.

## Anti-patterns to avoid

1. **chmod 755 forgotten on new hooks** — caught in post-tragedy delivery; user hit "Permission denied" at hook fire time. Fix in Pre-Delegation Contract: bake `chmod 755 *.hook.ts *.daemon.ts` into the per-stream checklist.
2. **Voice-gate banned vocabulary** — caught in mempalace-intel; "guaranteed" in Pin.md required retry commit. Run `bun Tools/validate-brand-voice.ts --staged` BEFORE commit.
3. **Predicate not in PREDICATES.md** — predicate gate is BLOCK MODE. Augment PREDICATES.md FIRST (Stream P sequencing pattern), then write doctrine that references new predicates.
4. **Stream prompts missing reference reading** — sub-agents fabricate when context is summary-of-summary. Always include absolute paths to ground-truth files.
5. **Solo execution when DAG would be faster** — historically 7.1/10 sentiment for solo vs 8.3-8.8/10 orchestrated. The DAG-WITH-TEAMMATES DEFAULT rule exists to counteract momentum bias.
6. **Parent-centric commits leaving submodule edits behind** — the 2026-05-04 audit (commits 7186e77 + 1af5c5dd) found that every PRD/ISC session commit was parent-only: submodule working trees in `Platform/studio` and `Releases/v0.0.6/.claude` carried uncommitted work that existed nowhere in git history. Root cause: "commit submodule first" is doctrine-only; no gate fails the algorithm's phase transition when submodules are dirty. Fix: WORKING-TREE-CLEAN GATE rule in LEARN phase (v0.0.7.md) blocks `phase: complete` until `bun ~/Durante/Tools/working-tree-clean-gate.ts --format json` exits 0.

## Cross-references

- **PARALLELISM PRE-CHECK** (PLAN phase, doctrine main): the gate that triggers this playbook
- **DAG-WITH-TEAMMATES DEFAULT** (PLAN phase, doctrine main): the rule that says "use this by default"
- **Pre-Delegation Contract** (BUILD phase, doctrine main): the file-ownership table that goes in PRD
- **DATETIME GROUND TRUTH** (PRD-stub section, doctrine main): use `date -u` for reflection timestamps too
- **PREDICATES.md** (`~/.claude/skills/mem-palace/PREDICATES.md`): canonical predicate vocabulary for KG writes
- **memory-integration.md** (sub-doc): catalog of predicates Algorithm reads/writes per phase
