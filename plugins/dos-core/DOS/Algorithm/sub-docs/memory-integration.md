<!--
Sub-doc authored 2026-05-04 for Algorithm v0.0.7 (W-T10 per 20260504-191500_algorithm-v007-memory-integration).
Catalogs KG predicate reads and writes the Algorithm performs across its seven phases.
Loaded on demand by Algorithm v0.0.7.md.
-->

# Algorithm Memory Integration

Predicate catalog for KG reads and writes across the seven Algorithm phases. Load this sub-doc when implementing or auditing memory-write doctrine (ISC-1 through ISC-7, ISC-9).

Canonical predicate vocabulary: `~/.claude/skills/mem-palace/PREDICATES.md`.

All bridge calls use:
```
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py <action> '<json>'
```

---

## Phase Catalog

### OBSERVE

**Reads — prior-session recovery (ISC-2)**

| Intent | Bridge call |
|--------|-------------|
| Recover compaction digest from prior session | `kg_query '{"entity":"session-<prior-id>","direction":"out","predicate":"compacted_with_digest"}'` |
| Recover stop digest from prior session | `kg_query '{"entity":"session-<prior-id>","direction":"out","predicate":"stopped_with_digest"}'` |
| List entities already queried by intel-context this session | `kg_query_predicate '{"predicate":"queried_by_session"}'` |

> `<prior-id>` resolves from `wake_up` context or the most-recent session name in `~/.claude/MEMORY/STATE/session-names.json`.

**Writes — OBSERVE-end (ISC-1)**

| Intent | Bridge call |
|--------|-------------|
| Record session working on the current task | `add_kg_fact '{"subject":"session-<id>","predicate":"worked_on","object":"<task-slug>"}'` |

Write fires after the PRD stub exists. Use the PRD `slug` field as `<task-slug>`.

---

### THINK

**Reads — repetition detection (ISC-9)**

| Intent | Bridge call |
|--------|-------------|
| Surface prior decisions on topic | `kg_query '{"entity":"<topic>","direction":"out","predicate":"decided"}'` |
| Surface prior learnings on topic | `kg_query '{"entity":"<topic>","direction":"out","predicate":"learned"}'` |

Read before writing a new `decided` fact — skip the write if the fact is a duplicate.

**Writes — per Council verdict (ISC-3)**

| Intent | Bridge call |
|--------|-------------|
| Record a Council or solo decision | `add_kg_fact '{"subject":"session-<id>","predicate":"decided","object":"<decision-text>"}'` |

One fact per decision. `<decision-text>` is the decision summary in ≤80 chars.

---

### PLAN

**Reads**

None. PLAN reads PRD state, not KG.

**Writes — ISC commitment (ISC-4)**

| Intent | Bridge call |
|--------|-------------|
| Record commitment per ISC at PRD finalization | `add_kg_fact '{"subject":"session-<id>","predicate":"committed_to","object":"<isc-id>: <criterion-text>"}'` |

Write one fact per ISC. Fires at PRD finalization, before EXECUTE begins.

---

### BUILD

No KG reads or writes. BUILD produces artifacts; they are recorded at LEARN.

---

### EXECUTE

No KG reads or writes. EXECUTE drives tool calls; outcomes surface at VERIFY and LEARN.

---

### VERIFY

No KG reads or writes. VERIFY checks ISC pass/fail; findings land in the PRD and surface at LEARN.

---

### LEARN

**Reads — deduplication guard (ISC-9)**

| Intent | Source |
|--------|--------|
| Read last 5 reflections before writing a new one | `MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl` (flat file, not KG) |

**Writes — reflection artifacts (ISC-5, ISC-7)**

| Intent | Bridge call |
|--------|-------------|
| Record lesson per reflection Q1–Q4 bullet (ISC-5) | `add_kg_fact '{"subject":"session-<id>","predicate":"learned","object":"<lesson-text>"}'` |
| Save decision drawer to wing/decision-archives (ISC-7, at `phase: complete`) | `add_drawer '{"wing":"<project-wing>","room":"decision-archives","content":"<PRD-decisions-block>","added_by":"algorithm-learn"}'` |

The drawer write (ISC-7) fires once per PRD completion, not per ISC. `<PRD-decisions-block>` is the full `## Decisions` section text.

---

## Intent-to-Flag Table

Consolidated matrix — one row per phase × bridge-action pair.

| Phase | Intent | Bridge action | Predicate / Room |
|-------|--------|---------------|-----------------|
| OBSERVE | Recover compaction context | `kg_query` | `compacted_with_digest` |
| OBSERVE | Recover stop context | `kg_query` | `stopped_with_digest` |
| OBSERVE | List already-queried entities | `kg_query_predicate` | `queried_by_session` |
| OBSERVE-end | Session worked on task | `add_kg_fact` | `worked_on` |
| THINK | Prior decisions on topic | `kg_query` | `decided` |
| THINK | Prior learnings on topic | `kg_query` | `learned` |
| THINK-end | Record decision | `add_kg_fact` | `decided` |
| PLAN-end | Record ISC commitment | `add_kg_fact` | `committed_to` |
| LEARN | Record reflection lesson | `add_kg_fact` | `learned` |
| LEARN | Save decision drawer | `add_drawer` | room: `decision-archives` |

---

## Predicate Gate

All predicates above appear in `PREDICATES.md` §1.x (verified 2026-05-04):

| Predicate | Section |
|-----------|---------|
| `compacted_with_digest` | §1.8 |
| `stopped_with_digest` | §1.8 |
| `queried_by_session` | §1.8 |
| `worked_on` | §1.8 |
| `decided` | §1.4 |
| `committed_to` | §1.4 |
| `learned` | §1.6 |

**Block mode rule:** register in `PREDICATES.md` §1.x BEFORE referencing in doctrine prose. This applies to both this sub-doc and `v0.0.7.md` inline text. New predicates that skip registration are doctrine violations.

---

## Wing Slug Resolution

`<project-wing>` and `<slug>` resolve from the active PRD's project context. If unknown, query:
```
kg_query_predicate '{"predicate":"active_sprint"}'
```
to find the current sprint slug, then derive the wing from the sprint RFC's project field.
