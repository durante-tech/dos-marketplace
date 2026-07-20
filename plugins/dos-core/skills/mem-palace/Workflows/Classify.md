---
name: Classify
description: Classifies text into five memory types (decision, preference, milestone, problem, emotional) via MemPalace's zero-LLM regex extractor, then offers to file each segment.
status: STABLE
bestPath:
  - title: "Gather Content"
    description: "Accept the text to classify from direct input, a file, or a conversation excerpt."
  - title: "Run Regex Classification"
    description: "Call the bridge classify action to segment content into memory types with confidence scores."
  - title: "Offer to File"
    description: "Present classified segments with their target wing/room, then file accepted ones via add_drawer."
  - title: "Present Results"
    description: "Lead with a verdict — the count of classified segments and the memory types found."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "MemPalace workflow uses custom Bridge-action vocabulary (mempalace_classify); canonical Mode/Output two-table shape doesn't fit"
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "MemPalace workflow has bespoke Output Format section with structured KG-result shape"
---

# Classify Content into Memory Types

Analyze text and classify it into 5 memory types using MemPalace's general extractor. Zero LLM calls — pure regex heuristics.

## When to Use

- Trigger phrases: "classify", "content type", "memory type", "decision or preference".
- Situation: you have raw text and need to determine what kind of memory it is before filing it.
- NOT for filing content once its type is already known — use Save (Classify determines the type; Save files it).

## Your Task

Take text input and classify it into: decision, preference, milestone, problem, or emotional.

## Step 1: Get Content

Accept content from:
- Direct text: "classify this: we switched to bcrypt because..."
- A file: "classify the contents of this file"
- Clipboard/paste: user pastes content
- A conversation excerpt

## Step 2: Run Classification

**Via bridge:**
```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py classify '{"text":"YOUR_TEXT_HERE","min_confidence":0.3}'
```

The extractor returns an array of classified segments:
```json
{
  "memories": [
    {"content": "we switched to bcrypt because...", "memory_type": "decision", "chunk_index": 0},
    {"content": "the migration finally works!", "memory_type": "milestone", "chunk_index": 1}
  ],
  "types_found": ["decision", "milestone"]
}
```

**If the bridge call fails** (non-zero exit, no socket, or empty response), render the DEGRADED banner and stop — do not report a classification result:

```text
🔴 MEMPALACE DEGRADED — the memory bridge is unreachable.
   Reads/writes this session are NOT landing; do not assume anything persisted.
   Recover: run the Doctor workflow (`/MemPalace Doctor`) for the guided repair ladder.
```

## Step 3: Offer to File

For each classified segment, offer to file it into the palace.

> **Project-aware routing:** When in a mapped project directory, file to the project wing instead of the global wings listed below. Detect the project wing from PROJECTS.md. For example, a decision made in the Durante project files to `durante/decisions` rather than `learnings/decisions`. Fall back to the global wings only when no project context is detected.

| Memory Type | Project Wing (primary) | Global Wing (fallback) | Room |
|-------------|----------------------|----------------------|------|
| decision | {project}/decisions | learnings | decisions |
| preference | {project}/preferences | telos | preferences |
| milestone | {project}/milestones | work | milestones |
| problem | {project}/problems | learnings | problems |
| emotional | telos/reflections | telos | reflections |

Ask: "Want me to file these into MemPalace?"

If yes, use `mempalace_add_drawer` for each segment with the appropriate wing/room.

## Intent-to-Flag Mapping

This workflow shells out to the MemPalace bridge per CreateSkill workflow Step 6 + CliFirstArchitecture.md. Translate operator phrasing into deterministic action selection and JSON-arg shape.

### Mode / Action

| User Says | Bridge Action | Effect |
|-----------|---------------|--------|
| "classify this text" / "what kind of memory is this?" | `classify` | Regex-only segmentation into decision/preference/milestone/problem/emotional |
| "raise the confidence bar" | `classify` (with `min_confidence`) | Drop borderline matches below threshold |
| "now file the classified results" | `add_drawer` (per accepted segment) | Persist classified content to wing/room |

### JSON Argument Shape

| Action | Required JSON Args | Optional JSON Args |
|--------|--------------------|--------------------|
| `classify` | `text` (string) | `min_confidence` (float 0..1, default 0.3) |
| `add_drawer` | `wing`, `room`, `content` | `source_file`, `added_by` |

## Step 4: Present Results

Lead with the verdict — the count of classified segments and types found:

```
✅ Classified N segments into M memory types (0 segments → nothing above the confidence threshold)

Content Classification

  Input: [X chars, Y segments analyzed]

  Classified:
    1. DECISION: "we switched to bcrypt because of ecosystem support"
       → Would file to: learnings/decisions
    2. MILESTONE: "the migration finally works"
       → Would file to: work/milestones

  Types found: decision, milestone
  Unclassified segments: N (below confidence threshold)

  [Filed to MemPalace] or [File these? (y/n)]
```

## Memory Type Definitions

- **DECISION**: Explicit choices ("we went with X because Y", "chose", "switched to")
- **PREFERENCE**: Recurring preferences ("always use X", "never do Y", "I prefer Z")
- **MILESTONE**: Achievements ("breakthrough", "it works", "shipped", "v2.0")
- **PROBLEM**: Issues ("bug", "crashed", "root cause", "fixed it by...")
- **EMOTIONAL**: Feelings and relationships ("love", "scared", "proud", "vulnerable")