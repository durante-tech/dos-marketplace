---
name: Telos
description: Life OS and project analysis — goals, dependencies, beliefs, wisdom, books, movies, narrative points, interview extraction, McKinsey reports, and project dashboards. USE WHEN Telos, life goals, projects, dependencies, books, movies, beliefs, wisdom, update TELOS, narrative points, interview extraction, write report, McKinsey report, TELOS report, project analysis, dashboard, n=24.
role: extractor
accepts:
  - text
icon: Target
colorVar: destructive
colorHex: "#ffb4ab"
tier: secondary
category: Thinking
displayLabel: Telos
marketingDescription: "Life OS: goals, beliefs, dependencies, McKinsey reports"
elevator: Life OS with goals, beliefs, and project analysis
highlightWorkflows:
  - name: Project Dashboard
    technicalName: ProjectDashboard
  - name: Goal Sync
    technicalName: GoalSync
  - name: Belief Audit
    technicalName: BeliefAudit
roots:
  - PRINCIPAL.TELOS
  - PROJECT.WORK
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
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Telos/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Telos

**TELOS** (Telic Evolution and Life Operating System) is a comprehensive context-gathering system with two applications:

1. **Personal TELOS** - {PRINCIPAL.NAME}'s life context system (beliefs, goals, lessons, wisdom) at `~/.durante/user/TELOS/`
2. **Project TELOS** - Analysis framework for organizations/projects (relationships, dependencies, goals, progress)

## Workflow Routing

**When executing a workflow, output this notification directly:**

```
Running the **WorkflowName** workflow in the **Telos** skill to ACTION...
```

| Workflow | Trigger | File |
|----------|---------|------|
| **Update** | "add to TELOS", "update my goals", "add book to TELOS" | `Workflows/Update.md` |
| **InterviewExtraction** | "extract content", "extract interviews", "analyze interviews" | `Workflows/InterviewExtraction.md` |
| **CreateNarrativePoints** | "create narrative", "narrative points", "TELOS report", "n=24" | `Workflows/CreateNarrativePoints.md` |
| **WriteReport** | "write report", "McKinsey report", "create TELOS report", "professional report" | `Workflows/WriteReport.md` |

**Note:** For general project analysis, dashboards, dependency mapping, and executive summaries, the skill handles these directly without a separate workflow file.

## Examples

**Example 1: Update personal TELOS**
```
User: "add Project Hail Mary to my TELOS books"
--> Invokes Update workflow
--> Creates timestamped backup of books.md
--> Adds book entry with formatted metadata
--> Logs change in updates.md with timestamp
```

**Example 2: Analyze project with TELOS**
```
User: "analyze ~/Projects/MyApp with TELOS"
--> Scans all .md and .csv files in directory
--> Extracts entities, relationships, dependencies
--> Returns analysis with dependency chains and progress metrics
```

**Example 3: Build project dashboard**
```
User: "build a dashboard for TELOSAPP"
--> Launches up to 10 parallel engineers
--> Creates Next.js dashboard with shadcn/ui + Aceternity
--> Returns interactive dashboard with dependency graphs, metrics cards, progress tables
```

**Example 4: Generate narrative points**
```
User: "create TELOS narrative for Acme Corp, n=24"
--> Invokes CreateNarrativePoints workflow
--> Analyzes TELOS context (situation, problems, recommendations)
--> Returns 24 crisp bullet points (8-12 words each)
--> Output is slide-ready for presentations or customer briefings
```

**Example 5: Generate McKinsey-style report**
```
User: "write a TELOS report for Acme Corp"
--> Invokes WriteReport workflow
--> First runs CreateNarrativePoints to generate story content
--> Maps narrative to McKinsey report structure
--> Generates web-based report with professional styling
--> Output at {project_dir}/report - run `bun dev` to view
--> White background, subtle Tokyo Night Storm accents
--> Includes: cover page, executive summary, findings, recommendations, roadmap
```

---

## Context Detection

**How {DAIDENTITY.NAME} determines which TELOS context:**

| User Request | Context | Location |
|--------------|---------|----------|
| "my TELOS", "my goals", "my beliefs", "add to TELOS" | Personal TELOS | `~/.durante/user/TELOS/` |
| "Alma", "TELOSAPP", "analyze [project]", "dashboard for" | Project TELOS | User-specified directory |
| "analyze ~/path/to/project" | Project TELOS | Specified path |

---

# Part 1: Personal TELOS ({PRINCIPAL.NAME}'s Life)

## Location

**CRITICAL PATH:** All personal TELOS files are located at:
```
~/.durante/user/TELOS/
```

**Resolution rule (getTelosDir):** the TELOS directory is `$DURANTE_TELOS_DIR` when that
environment variable is set, otherwise `~/.durante/user/TELOS/`. TypeScript consumers call
`getTelosDir()` from `hooks/lib/paths.ts`; prose workflows apply the same rule textually.

Personal TELOS lives under `~/.durante/user/` (operator data, outside the `~/.claude` install),
NOT under the telos skill directory.

## Personal TELOS Framework

All files located in `~/.durante/user/TELOS/`:

### Core Philosophy
- **telos.md** - Main framework document
- **mission.md** - Life mission statement
- **beliefs.md** - Core beliefs and world model
- **wisdom.md** - Accumulated wisdom

### Life Data
- **books.md** - Favorite books
- **movies.md** - Favorite movies
- **learned.md** - Lessons learned over time
- **wrong.md** - Things {PRINCIPAL.NAME} was wrong about (growth tracking)

### Mental Models
- **frames.md** - Mental frames and perspectives
- **models.md** - Mental models used for decision-making
- **narratives.md** - Personal narratives and self-stories
- **strategies.md** - Strategies being employed in life

### Goals & Challenges
- **goals.md** - Life goals (short-term and long-term)
- **projects.md** - Active projects
- **problems.md** - Problems to solve
- **challenges.md** - Current challenges being faced
- **predictions.md** - Predictions about the future
- **traumas.md** - Past traumas (for context and healing)

### Change Tracking
- **updates.md** - Comprehensive changelog of all TELOS updates

## Working with Personal TELOS

### Read Files

```bash
# View specific file
read ~/.durante/user/TELOS/goals.md
read ~/.durante/user/TELOS/beliefs.md

# View recent updates
read ~/.durante/user/TELOS/updates.md
```

### Update Personal TELOS

**CRITICAL:** Never manually edit. Use the Update workflow.

**Workflow:** `Workflows/Update.md`

The workflow provides:
- Automatic timestamped backups
- Change logging in updates.md
- Version history preservation
- Proper formatting and structure

**Valid files for updates:**
beliefs.md, books.md, challenges.md, frames.md, goals.md, learned.md, mission.md, models.md, movies.md, narratives.md, predictions.md, problems.md, projects.md, strategies.md, telos.md, traumas.md, wisdom.md, wrong.md

---

# Part 2: Project TELOS (Organizational Analysis)

## Capabilities

For any project directory, TELOS provides:

1. **Relationship Discovery** - Find how files/entities connect
2. **Dependency Mapping** - Identify what depends on what
3. **Goal Extraction** - Discover stated and implied objectives
4. **Progress Analysis** - Track advancement and metrics
5. **Narrative Generation** - Create executive summaries
6. **Visual Dashboards** - Build beautiful UIs with data

## Target Directory Detection

**Flexible file discovery - no required structure:**

```bash
# User specifies directory
"Analyze ~/Cloud/Projects/TELOSAPP"
--> {DAIDENTITY.NAME} scans for .md and .csv files anywhere in tree

# {DAIDENTITY.NAME} automatically finds all .md and .csv files regardless of structure
```

## Analysis Workflow

### Step 1: Identify Target

**Auto-detection:**
- User mentions project name (TELOSAPP, Alma, etc.)
- User provides path explicitly
- {DAIDENTITY.NAME} looks for common project locations

### Step 2: Scan Files

Discover all markdown and CSV files:
```bash
find $TARGET_DIR -type f \( -name "*.md" -o -name "*.csv" \)
```

Index:
- Markdown structure (headings, sections, links)
- CSV schema (columns, data types)
- Cross-references and mentions
- Entities (people, teams, projects, problems)

### Step 3: Relationship Analysis

Build relationship graph:
1. **Entity Extraction** - Identify unique entities
2. **Connection Discovery** - Find explicit/implicit links
3. **Dependency Mapping** - Trace dependencies
4. **Network Construction** - Build directed graph

### Step 4: Generate Insights

Produce analytics:
- **Dependency Chains**: PROBLEMS --> GOALS --> STRATEGIES --> PROJECTS
- **Bottlenecks**: What blocks progress?
- **Goal Alignment**: Projects aligned with objectives?
- **Progress Metrics**: Completion percentages
- **Risk Areas**: Overdue items, blocked work

### Step 5: Create Outputs

**Output Formats:**

1. **Markdown Report** - Static analysis with Mermaid diagrams
2. **Web Dashboard** - Interactive app with shadcn/ui + Aceternity
3. **JSON Export** - Structured data
4. **Executive Summary** - Narrative overview
5. **Custom Format** - As requested

## Building Dashboards

### Parallel Engineer Strategy

**CRITICAL: When building UIs, use up to 16 parallel engineers.**

**Launch Strategy:**
Use single message with 10 Task calls in parallel:

```
Engineer 1: Project structure + layout + navigation
Engineer 2: Overview page with metrics cards
Engineer 3: Projects page with progress tracking
Engineer 4: Teams page with performance tables
Engineer 5: Vulnerabilities/issues page
Engineer 6: Progress timeline visualization
Engineer 7: Data parsing library (MD/CSV)
Engineer 8: Shared components (cards, badges, tables)
Engineer 9: Design polish and theme
Engineer 10: Integration and testing
```

### Dashboard Requirements

**Tech Stack:**
- Next.js 14 + TypeScript
- shadcn/ui for UI components
- Aceternity UI for layouts
- Tailwind CSS
- Tokyo Night Day theme (professional light)

**Features:**
- Dependency graphs (Mermaid or D3.js)
- Progress tables (sortable, filterable)
- Metrics cards (KPIs, stats)
- Timeline visualizations
- Relationship networks

**Design:**
```css
--background: #ffffff
--foreground: #1a1b26
--primary: #2e7de9
--accent: #9854f1
--destructive: #f52a65
--success: #33b579
--warning: #f0a020
```

## Common TELOS Files

**Standard Project TELOS Structure** (auto-detected):

### Context Files
- **OVERVIEW.md** - Project overview
- **COMPANY.md** - Organization context
- **PROBLEMS.md** - Issues to solve
- **GOALS.md** - Objectives
- **MISSION.md** - Mission statement
- **STRATEGIES.md** - Strategic approaches
- **PROJECTS.md** - Active initiatives

### Operational Files
- **EMPLOYEES.md** - Team members
- **ENGINEERING_TEAMS.md** - Team structure
- **BUDGET.md** - Financial tracking
- **KPI_TRACKING.md** - Metrics
- **APPLICATIONS.md** - App inventory
- **TOOLS.md** - Tooling
- **VENDORS.md** - Third parties

### Security Files
- **VULNERABILITIES.md** - Security issues
- **SECURITY_POSTURE.md** - Security state
- **THREAT_MODEL.md** - Threats

### Data Files (CSV)
- **data/VULNERABILITIES.csv** - Vuln tracking
- **data/INCIDENTS.csv** - Incident log
- **data/VENDORS.csv** - Vendor data

**Note:** Files are optional. TELOS adapts to whatever exists.

## Visualization Types

**Available Visualizations:**

- **Dependency Graphs** - Mermaid or D3.js network
- **Progress Tables** - shadcn/ui tables with filters
- **Metrics Cards** - Aceternity card layouts
- **Timeline Charts** - Progress over time
- **Status Dashboards** - KPI overviews
- **Relationship Networks** - Force-directed graphs
- **Bar Charts** - Recharts for comparisons
- **Line Charts** - Trend analysis

---

## Security & Privacy

**Personal TELOS:**
- NEVER commit to public repos
- NEVER share publicly
- Always backup before changes
- Use Update workflow only

**Project TELOS:**
- May contain sensitive data
- Ask before sharing externally
- Redact sensitive info in examples
- Follow DOS security protocols

---

## Key Principles

1. **Dual Context** - Handles both personal and project TELOS in the same workflow
   - Personal TELOS: `~/.durante/user/TELOS/` (in CORE USER directory)
   - Project TELOS: User-specified directories
2. **Auto-Detection** - Determines context from user question
3. **Flexible Discovery** - Finds files regardless of structure
4. **TELOS Methodology** - Applies relationships, dependencies, goals, narratives
5. **Parallel Execution** - Up to 10 engineers for dashboard builds
6. **Visual Excellence** - Beautiful outputs with shadcn/ui + Aceternity
7. **Privacy-Aware** - Respects sensitive data
8. **Integrated** - Works with development, research, and other skills

---

**TELOS is {PRINCIPAL.NAME}'s life operating system AND project analysis framework. One skill, two powerful contexts.**

**Remember:** Personal TELOS files live at `~/.durante/user/TELOS/` (in the CORE USER directory)

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

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"Telos","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/telos/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/telos/` — active release submodule (versioned)
3. `Packs/*/src/Telos/` — pack source (distributable)
4. `Packs/agents/Telos/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
