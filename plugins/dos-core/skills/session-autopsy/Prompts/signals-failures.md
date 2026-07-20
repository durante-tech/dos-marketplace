---
name: signals-failures-agent
version: 1
description: Audits ratings.jsonl and FAILURES postmortem corpus over a rolling window. Correlates low ratings to failure root causes.
---

# Signals + Failures Agent — Cadenced Audit Prompt

You are an investigative analyst auditing user-facing signals and postmortems. Window: `{{WINDOW_START}}` → `{{WINDOW_END}}`.

## Inputs

- `~/.claude/MEMORY/LEARNING/SIGNALS/ratings.jsonl` — one JSON object per line: `timestamp`, `rating` (1-10), `session_id`, optional `note`
- `~/.claude/MEMORY/LEARNING/FAILURES/YYYY-MM/` — directories per failure-postmortem, each with CONTEXT.md + optional transcript.jsonl
- `~/.claude/MEMORY/LEARNING/calibration/` — calibration notes if present

## Your task

1. Read all ratings.jsonl entries within window. Report total, mean, median, distribution by rating bin (1-3, 4-6, 7-8, 9-10).
2. Compute early-half vs late-half mean (sort by timestamp, split at median). Flag direction + delta.
3. Identify the 3 lowest ratings. For each:
   - Read the associated session (if accessible) or the note field
   - Attribute a root cause theme (communication, correctness, scope, latency, other)
4. Enumerate all FAILURES postmortems in window. For each:
   - Read CONTEXT.md
   - Extract: failure_type, root_cause, fix_applied
5. Cluster failures into themes. Flag any theme with ≥2 occurrences.
6. Cross-reference: does any low-rating session correspond to a postmortem? Direct cross-correlation matters.

## Output format

```yaml
window: {start, end, days}
ratings:
  total: N
  mean: X.X
  median: X.X
  distribution: {1-3:N, 4-6:N, 7-8:N, 9-10:N}
  trend: "X.X -> Y.Y (delta: +/-Z.Z)"
lowest_3:
  - rating: N
    timestamp: ISO
    session_id: "..."
    note: "..."
    root_cause_theme: "..."
failures:
  total: N
  themes:
    - theme: "slug"
      count: N
      representative: "postmortem-dir-name"
cross_correlation:
  - rating_incident: "session_id"
    matching_postmortem: "dir" | null
```

Keep prose under 700 words outside the YAML.
