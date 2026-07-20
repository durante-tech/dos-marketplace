---
name: USMetrics
description: 68 US economic indicators from FRED + EIA (Treasury/BLS/Census/BEA data is aggregated through FRED) with trend analysis and cross-metric correlation. Updates Substrate dataset, produces economic overviews. USE WHEN GDP, inflation, unemployment, economic metrics, gas prices, how is the economy, update data, refresh data, get current state, economic overview, FRED, fetch FRED series, generate analysis, update substrate metrics, US metrics, economic trends.
role: generator
accepts:
  - text
icon: BarChart3
colorVar: tertiary
colorHex: "#ffb95a"
tier: secondary
category: Research
displayLabel: US Metrics
marketingDescription: 68 US economic indicators from FRED + EIA (agencies aggregated via FRED)
elevator: 68 economic indicators with trend analysis
highlightWorkflows:
  - name: Update Data
    technicalName: UpdateData
  - name: Get Current State
    technicalName: GetCurrentState
roots: []
visibility: public
capabilities:
  - artifact.write
  - customization.cascade
  - four-copy.sync
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/USMetrics/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# US Metrics - Economic & Social Indicator Analysis

**Purpose:** Analyze U.S. economic and social metrics using the Substrate US-Common-Metrics dataset. Provides trend analysis, cross-metric correlation, pattern detection, and research recommendations.

## Data Source

All metrics sourced from:
- **Location:** Configure your data directory path (e.g., `${DOS_DIR}/data/US-Common-Metrics/`)
- **Master Document:** `US-Common-Metrics.md` (68 metrics across 9 wired categories; category 10, Health & Crisis, is a documented future — see below)
- **Source Documentation:** `source.md` (full methodology)
- **Live source APIs (what the tools actually fetch):** **FRED** + **EIA**. Treasury / BLS / Census / BEA data is **aggregated through FRED** (the tools call FRED, not those agencies' own APIs). **CDC / EPA** (category 10 — Health & Crisis: deaths of despair, air quality, life expectancy) is **NOT yet wired** — a documented future, not a live source. Each metric's true provenance is carried in its `source` field.

## Workflow Routing

**When executing a workflow, output this notification directly:**

```
Running the **WorkflowName** workflow in the **USMetrics** skill to ACTION...
```

### Available Workflows

| Workflow | Description | Use When |
|----------|-------------|----------|
| **UpdateData** | Fetch live data from APIs and update Substrate dataset | "Update metrics", "refresh data", "pull latest", "update Substrate" |
| **GetCurrentState** | Comprehensive economic overview with multi-timeframe trend analysis | "How is the economy?", "economic overview", "get current state", "US metrics analysis" |

## Workflows

### UpdateData

**Full documentation:** `Workflows/UpdateData.md`

**Purpose:** Fetch live data from FRED, EIA, Treasury APIs and populate the Substrate US-Common-Metrics dataset files. This must run before GetCurrentState to ensure data is current.

**Execution:**
```bash
bun ~/.claude/skills/us-metrics/Tools/UpdateSubstrateMetrics.ts
```

**Outputs:**
- `US-Common-Metrics.md` - Updated with current values
- `us-metrics-current.csv` - Machine-readable snapshot
- `us-metrics-historical.csv` - Appended time series

**Trigger phrases:**
- "Update the US metrics"
- "Refresh the economic data"
- "Pull latest metrics"
- "Update Substrate dataset"

---

### GetCurrentState

**Full documentation:** `Workflows/GetCurrentState.md`

**Produces:** A comprehensive overview document analyzing:
- 10-year, 5-year, 2-year, and 1-year trends for all major metrics
- Cross-category interplay analysis
- Pattern detection and anomalies
- Research recommendations

**Trigger phrases:**
- "How is the US economy doing?"
- "Give me an economic overview"
- "What's the current state of US metrics?"
- "Analyze economic trends"
- "US metrics report"

## Metric Categories Covered

1. **Economic Output & Growth** - GDP, industrial production, retail sales
2. **Inflation & Prices** - CPI, PCE, gas prices, oil prices
3. **Employment & Labor** - Unemployment, payrolls, jobless claims, quit rate
4. **Housing** - Home prices, mortgage rates, housing starts
5. **Consumer & Personal Finance** - Sentiment, saving rate, credit
6. **Financial Markets** - Interest rates, Treasury yields, volatility
7. **Trade & International** - Trade balance, USD index
8. **Government & Fiscal** - Federal debt, budget deficit, spending
9. **Demographics & Social** - Population, inequality, poverty
10. **Health & Crisis** - Deaths of despair, air quality, life expectancy

## API Keys Required

For live data fetching:
- `FRED_API_KEY` - Federal Reserve Economic Data
- `EIA_API_KEY` - Energy Information Administration

## Tools

| Tool | Purpose |
|------|---------|
| `Tools/UpdateSubstrateMetrics.ts` | **Primary** - Fetch all metrics, update Substrate files |
| `Tools/FetchFredSeries.ts` | Fetch historical data from FRED API |
| `Tools/GenerateAnalysis.ts` | Generate analysis report from Substrate data |

## Examples

**Example 1: Refresh the Substrate dataset before analysis**
```
User: "Update the US metrics so I can run a fresh report"
→ Invokes UpdateData workflow
→ Runs UpdateSubstrateMetrics.ts to pull live values from FRED, EIA, Treasury APIs
→ Writes updated US-Common-Metrics.md, us-metrics-current.csv, us-metrics-historical.csv
```

**Example 2: Generate full economic overview**
```
User: "How is the US economy doing? Give me a full analysis"
→ Invokes GetCurrentState workflow
→ Reads Substrate files, calculates 10y/5y/2y/1y trends across 68 indicators
→ Returns markdown report with executive summary, trend analysis, cross-metric correlations
```

**Example 3: Targeted single-series fetch**
```
User: "Pull historical CPI data from FRED for the last 10 years"
→ Invokes UpdateData workflow with single-series scope
→ Runs FetchFredSeries.ts to pull CPIAUCSL series from FRED API
→ Returns time-series data ready to merge into the Substrate historical CSV
```

## Output Format

The GetCurrentState workflow produces a structured markdown document:

```markdown
# US Economic State Analysis
**Generated:** [timestamp]
**Data Sources:** FRED + EIA (Treasury/BLS/Census/BEA aggregated via FRED)

## Executive Summary
[Key findings in 3-5 bullets]

## Trend Analysis by Category
### Economic Output
[10y/5y/2y/1y trends with analysis]
...

## Cross-Metric Analysis
[Correlations, leading indicators, divergences]

## Pattern Detection
[Anomalies, regime changes, emerging trends]

## Research Recommendations
[Suggested areas for deeper investigation]
```

## Artifact Tracking

**MANDATORY for any workflow in this skill that writes output files via the Write tool.**

After writing any output file, resolve the ARTIFACTS path and append a JSONL log entry:

```bash
# Resolve ARTIFACTS dir (project-level first)
if [ -d "${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS"
elif [ -d "$(pwd)/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="$(pwd)/MEMORY/ARTIFACTS"
else
  ARTIFACTS_DIR="$HOME/.claude/MEMORY/ARTIFACTS"
fi
mkdir -p "$ARTIFACTS_DIR"

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"USMetrics","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/us-metrics/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/us-metrics/` — active release submodule (versioned)
3. `Packs/*/src/USMetrics/` — pack source (distributable)
4. `Packs/agents/USMetrics/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
