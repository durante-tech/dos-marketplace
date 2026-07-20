---
name: EpisodeMemory
description: Persist episode to MemPalace — drawer + KG facts + episode index update
status: STABLE
bestPath:
  - title: "Notes Ingestion"
    description: "Read the episode Notes.md and parse frontmatter (title, guest, topics, timestamps)."
  - title: "Drawer Persistence"
    description: "Write the episode as a MemPalace drawer with structured tags."
  - title: "KG Fact Registration"
    description: "Register canonical KG facts (covers_topic, has_guest, relates_to) via the awaited bridge."
  - title: "Episode Index Update"
    description: "Append the episode entry to the global episode-index.json."
---

# EpisodeMemory Workflow

## When to Use

- Trigger phrases: "episode memory", "save episode", "persist episode"
- Persisting a completed episode's notes to MemPalace for cross-episode search and KG facts
- NOT the full post-stream content multiplier — PostStream calls this workflow as its persistence step; invoke EpisodeMemory directly only when you need memory persistence alone

**Purpose:** Persist a completed episode to MemPalace as a drawer with structured frontmatter, register KG facts for each entity (topic, guest, tools mentioned), update the global episode index.

**Budget:** ~10 sec, no credits.

<!-- partial: _workflow-voice.md skill_name=StreamRig workflow_name=EpisodeMemory action_phrase="persist the episode to memory" -->


**Purpose:** Persist a completed episode to MemPalace as a drawer with structured frontmatter, register KG facts for each entity (topic, guest, tools mentioned), update the global episode index.

**Budget:** ~10 sec, no credits.

<!-- partial: _workflow-voice.md skill_name=StreamRig workflow_name=EpisodeMemory action_phrase="persist the episode to memory" -->

## Inputs

- `n` — episode number (required)
- `wing` — MemPalace wing (defaults to `general` or `streamrig` if configured)

## Prerequisites

- `~/.claude/MEMORY/STREAMRIG/Episodes/{n}/Notes.md` exists (produced by PostStream Step 2)
- MemPalace bridge reachable (degrades to warned-only if not)

## Steps

### 1. Read episode notes

```bash
EPISODE_DIR=~/.claude/MEMORY/STREAMRIG/Episodes/$N
NOTES=$EPISODE_DIR/Notes.md
```

Parse frontmatter to extract: `title`, `guest`, `topics[]`, `startedAt`, `endedAt`, `runtime`, `markers[]`, `decisions[]`.

### 2. Write episode drawer

Use the centralized bridge (`hooks/lib/mempalace.ts → bridgeSync`):

```typescript
const drawer = await bridgeSync('add_drawer', {
  wing: wing,
  room: 'Episodes',
  title: `Episode ${n} — ${title}`,
  content: notesBody,                  // full Notes.md body
  tags: ['episode', `episode-${n}`, ...topics, guest && `guest:${guest}`].filter(Boolean),
  added_by: 'streamrig-episode-memory',
});
```

### 3. Register KG facts

One fact per entity. **Use the canonical action `add_kg_fact` via the AWAITED `bridgeSync`** —
NOT `bridgeFire('kg_add', …)`. `kg_add` is not a bridge action (the canonical is `add_kg_fact`,
verified in `Packs/mem-palace/src/Tools/bridge.py`), and `bridgeFire` is fire-and-forget (returns
void), so the old form silently no-op'd AND swallowed the unknown-action error — the "N KG facts
registered" count was a fabrication. `bridgeSync` is awaited and returns `{ok, reason}`, so the
count is real and any gate rejection surfaces.

**Predicate:** the canonical `add_kg_fact` runs under a BLOCK-mode predicate gate
(`_PREDICATE_GATE_ACTIONS={'add_kg_fact','invalidate'}`), so write **canonical predicates only**.
`covers_topic` (episode → topic, §1.6) and `has_guest` (episode → guest, §1.2) are now canonical —
ratified RFC-0140 2026-06-28 (`PREDICATES.md`) — so write them directly; both pass the BLOCK-mode
gate. `mentions` is an alias of `relates_to` (`PREDICATES.md`), so write `relates_to` for
tool/concept mentions. Pass explicit
`valid_from = startedAt` so facts carry the episode date, not the write date (the handler
auto-defaults `valid_from` to today; `source` is NOT a handler field — do not pass it).

```typescript
// Collect results so the reported count is REAL (awaited), not a fire-and-forget fabrication.
const kgFacts = [
  // topic facts — covers_topic (episode → topic), ratified RFC-0140 2026-06-28
  ...topics.map((topic) => ({ predicate: 'covers_topic', object: topic })),
  // guest fact — has_guest (episode → guest), ratified RFC-0140 2026-06-28
  ...(guest ? [{ predicate: 'has_guest', object: guest }] : []),
  // tool/concept mentions (relates_to is the canonical form of the `mentions` alias)
  ...mentionedTools.map((tool) => ({ predicate: 'relates_to', object: tool })),
];

let kgOk = 0;
for (const f of kgFacts) {
  const res = await bridgeSync('add_kg_fact', {
    subject: `episode-${n}`,
    predicate: f.predicate,
    object: f.object,
    valid_from: startedAt,             // episode date, not write date (temporal accuracy)
  });
  if (res?.ok) kgOk++;
  else console.error(`KG fact rejected: ${f.predicate} ${f.object} — ${res?.reason}`);
}
// kgOk is the REAL registered-fact count surfaced in the output.
```

### 4. (v0.2) Create cross-episode tunnels

**Deferred to v0.2.** When ≥2 episodes share a topic entity, create a tunnel:
```typescript
bridgeFire('create_tunnel', {
  from: `episode-${n}`,
  to: `episode-${priorN}`,
  type: 'topic-shared',
  label: sharedTopic,
});
```

For v0.0.1: skip tunnel creation; flag in the output that this is deferred.

### 5. Update episode index

```bash
INDEX=~/.claude/MEMORY/STREAMRIG/episode-index.json
# Append-only — read existing, append entry, write back
jq --argjson new "$NEW_ENTRY" '. += [$new]' "$INDEX" > "$INDEX.tmp" && mv "$INDEX.tmp" "$INDEX"
```

Entry shape: `{ n, title, guest, startedAt, endedAt, runtime, preset }`.

<!-- partial: _intent-to-flag-table.md skill_name=StreamRig workflow_name=EpisodeMemory -->
## Intent-to-Flag Mapping

### Persistence target

| User Says | Flag | Effect |
|-----------|------|--------|
| (default) | (no flag) | Use configured wing or `general` |
| "wing X" | `--wing X` | Override default wing |
| "preview", "what would be saved" | `--dry-run` | Print payloads, no bridge calls |

### KG depth

| User Says | Flag | Effect |
|-----------|------|--------|
| (default) | (no flag) | Topics + guest |
| "deep KG", "all entities" | `--kg deep` | Also extract entity mentions from Notes.md body |
| "minimal", "no KG" | `--kg none` | Drawer only, skip KG facts |

<!-- partial: _workflow-output-shape.md skill_name=StreamRig workflow_name=EpisodeMemory -->
## Output

- New MemPalace drawer in `<wing>/Episodes/Episode {n} — {title}`
- `kgOk` KG facts registered — the REAL awaited count (1 per topic + 1 per guest + 1 per mentioned tool); report any rejected facts (predicate gate / bridge error), not a fabricated total
- `~/.claude/MEMORY/STREAMRIG/episode-index.json` appended
- Drawer ID surfaced for later cross-reference

## Done

Episode persisted. Subsequent `Skill("mem-palace", "search episodes about <topic>")` will surface it.
