---
name: View Results
description: View and analyze stored eval results for a use case.
status: STABLE
---

# ViewResults Workflow

Query and display evaluation results, generate reports, and track trends.

## Prerequisites

- Evaluations have been run
- Results exist in Results/ directory or SQLite database

## Execution

### Step 1: Identify Query

Ask the user:
1. Which use case?
2. What time range? (latest, last week, specific run)
3. What to show? (summary, details, comparison, trends)
4. What format? (table, report, chart)

### Step 2: Quick Status Check

**Latest Results for Use Case:**

```bash
# Show most recent run
RUN=$(ls -t ~/.claude/skills/utilities/Evals/Results/<use-case>/ | head -1)
python3 -m json.tool ~/.claude/skills/utilities/Evals/Results/<use-case>/$RUN/results.json | head -40
```

**All Recent Runs:**

```bash
# List last 10 runs (newest first)
ls -t ~/.claude/skills/utilities/Evals/Results/<use-case>/ | head -10
```

### Step 3: View Detailed Results

**Single Run Details:**

```bash
python3 -m json.tool ~/.claude/skills/utilities/Evals/Results/<use-case>/<run-id>/results.json
```

**Per-Test-Case Breakdown:**

```bash
jq '.results[] | {test_id, passed, score, failure_reason}' \
  ~/.claude/skills/utilities/Evals/Results/<use-case>/<run-id>/results.json
```

### Step 4: Generate Report

**Standard Report:**

```bash
# The run flow writes report.md next to results.json; read it directly
cat ~/.claude/skills/utilities/Evals/Results/<use-case>/<run-id>/report.md
# If absent, render one from results.json via the report template (next section)
```

**Using Report Template:**

```bash
# Render with template
bun run ~/.claude/skills/utilities/Prompting/Tools/RenderTemplate.ts \
  -t Evals/Report.hbs \
  -d ~/.claude/skills/utilities/Evals/Results/<use-case>/<run-id>/results.yaml \
  -o ~/.claude/skills/utilities/Evals/Results/<use-case>/<run-id>/report.md
```

### Step 5: Query Across Runs

There is no database — `Results/<use-case>/<run-id>/results.json` files are the store.

```bash
RES=~/.claude/skills/utilities/Evals/Results/<use-case>

# Recent runs with pass rate + mean score
for r in $(ls -t $RES | head -10); do
  jq -r --arg r "$r" '"\($r)  pass=\(.pass_rate)  mean=\(.mean_score)"' $RES/$r/results.json
done

# Failed test cases in one run
jq '.results[] | select(.passed == false) | {test_id, score, failure_reason}' \
  $RES/<run-id>/results.json

# Suite-level saturation trend
bun run ~/.claude/skills/utilities/Evals/Tools/SuiteManager.ts check-saturation <suite>
```

### Step 6: Compare Runs

**Two Runs Side-by-Side:**

```bash
# Side-by-side pass/score summary of two runs
for r in <run-id-1> <run-id-2>; do
  jq -r '"\(input_filename): pass_rate=\(.pass_rate) mean=\(.mean_score)"' \
    ~/.claude/skills/utilities/Evals/Results/<use-case>/$r/results.json
done
```

**Trend Analysis:**

```bash
RES=~/.claude/skills/utilities/Evals/Results/<use-case>
for r in $(ls -t $RES); do
  jq -r --arg r "$r" '"\(.created_at // $r)  pass=\(.pass_rate)  mean=\(.mean_score)"' $RES/$r/results.json
done
```

### Step 7: Report Summary

Use structured response format:

```markdown
📋 SUMMARY: Evaluation results for <use-case>

📊 STATUS:
| Metric | Value |
|--------|-------|
| Run ID | <run-id> |
| Date | <date> |
| Model | <model> |
| Pass Rate | X% |
| Mean Score | X.XX |
| Total Tests | N |
| Passed | N |
| Failed | N |

📖 STORY EXPLANATION:
1. Retrieved evaluation run from <date>
2. <N> test cases were evaluated
3. Deterministic scorers ran first (format, length, voice)
4. AI judges evaluated accuracy and style
5. Weighted scores calculated
6. <Pass rate>% passed the 0.75 threshold
7. <Key finding about top/bottom performers>
8. <Recommendation based on results>

🎯 COMPLETED: Results retrieved for <use-case>, <pass-rate>% pass rate.
```

## Query Patterns

### By Time Range

```bash
# Last 24 hours
--since "24 hours ago"

# Last week
--since "7 days ago"

# Specific date range
--from "2024-01-01" --to "2024-01-15"
```

### By Score Threshold

```bash
# Only failed runs
--min-pass-rate 0 --max-pass-rate 0.74

# Only excellent runs
--min-pass-rate 0.90
```

### By Model

```bash
# Specific model
--model claude-3-5-sonnet-20241022

# Compare models
--compare-models
```

### By Test Case

```bash
# Specific test
--test-id 001-basic

# All failures
--failures-only
```

## Output Formats

### Table (Default)

```
┌──────────┬────────────────────────────┬───────────┬────────────┐
│ Run ID   │ Model                      │ Pass Rate │ Mean Score │
├──────────┼────────────────────────────┼───────────┼────────────┤
│ abc123   │ claude-3-5-sonnet-20241022 │ 92%       │ 4.3        │
│ def456   │ gpt-4o                     │ 88%       │ 4.1        │
└──────────┴────────────────────────────┴───────────┴────────────┘
```

### JSON

```bash
--format json
```

```json
{
  "run_id": "abc123",
  "use_case": "newsletter_summaries",
  "model": "claude-3-5-sonnet-20241022",
  "summary": {
    "total_cases": 12,
    "passed": 11,
    "failed": 1,
    "pass_rate": 0.917,
    "mean_score": 4.3,
    "std_dev": 0.5
  },
  "per_test_case": [...]
}
```

### Markdown Report

```bash
--format markdown
```

Uses Report.hbs template to generate full report.

### CSV Export

```bash
--format csv --output results.csv
```

For spreadsheet analysis.

## Trend Analysis

### Regression Detection

```bash
# Regression check: compare the two newest runs' mean scores (>10% drop = alert)
RES=~/.claude/skills/utilities/Evals/Results/<use-case>
ls -t $RES | head -2 | xargs -I{} jq -r '.mean_score' $RES/{}/results.json
```

### Performance Over Time

```
📈 Trend: newsletter_summaries (last 30 days)

Date       | Pass Rate | Mean Score | Change
-----------|-----------|------------|--------
2024-01-15 | 92%       | 4.3        | +5%
2024-01-10 | 87%       | 4.1        | -2%
2024-01-05 | 89%       | 4.2        | baseline

Trend: ↑ Improving
Alert: None
```

## Web UI Options

No web dashboard ships; `results.json` is directly consumable:

- JSON: already on disk per run
- CSV: `jq -r '.results[] | [.test_id, .score, .passed] | @csv' results.json`
- Suite health: `bun run ~/.claude/skills/utilities/Evals/Tools/SuiteManager.ts show <suite>`

## Common Queries

### "How did the last eval go?"

```bash
RES=~/.claude/skills/utilities/Evals/Results/<use-case>
jq '{pass_rate, mean_score, failed: [.results[] | select(.passed==false) | .test_id]}' \
  $RES/$(ls -t $RES | head -1)/results.json
```

### "Why did test X fail?"

```bash
jq '.results[] | select(.test_id == "<test-id>")' \
  ~/.claude/skills/utilities/Evals/Results/<use-case>/<run-id>/results.json
```

### "Is performance improving or declining?"

```bash
RES=~/.claude/skills/utilities/Evals/Results/<use-case>
for r in $(ls -t $RES | head -14); do jq -r '.mean_score' $RES/$r/results.json; done
```

### "Which model is best for this task?"

```bash
# Per-model runs live as separate run dirs (CompareModels workflow);
# compare their results.json pass rates side by side
RES=~/.claude/skills/utilities/Evals/Results/<use-case>
for r in $(ls -t $RES | head -5); do
  jq -r --arg r "$r" '"\($r)  model=\(.model // "agent")  pass=\(.pass_rate)"' $RES/$r/results.json
done
```

### "Show me all failures this week"

```bash
RES=~/.claude/skills/utilities/Evals/Results/<use-case>
find $RES -name results.json -mtime -7 \
  -exec jq '.results[] | select(.passed==false) | {test_id, failure_reason}' {} +
```

## Done

Results retrieved and reported. Use findings to guide prompt/model decisions.
