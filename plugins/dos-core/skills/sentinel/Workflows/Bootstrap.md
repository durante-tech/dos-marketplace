---
name: SentinelBootstrap
description: Empty project bootstrap — interview, scaffold, register, and populate MemPalace for new projects with no existing code.
status: STABLE
bestPath:
  - title: "Interview"
    description: "Ask five structured questions about project intent, stack, monorepo, database, and auth."
  - title: "Scaffold"
    description: "Init git if needed and write project structure, config files, README, and .gitignore."
  - title: "Generate CLAUDE.md"
    description: "Render a project-intent CLAUDE.md via the tested SentinelBootstrap helper."
  - title: "Register in DOS"
    description: "File PROJECTS.md, MemPalace KG facts and drawers, and Studio registration."
  - title: "Re-scan"
    description: "Run SentinelScan against the scaffolded structure to produce a real scan report and convention cache."
divergence_from_canonical:
  _workflow-voice.md:
    partial_version: 1.1.0
    reason: "Bespoke voice message ('Empty project detected. Entering bootstrap mode...') announces a runtime state-machine transition, not a workflow start. Canonical 'Running the X workflow in the Y skill' template doesn't fit this semantic."
    rationale_link: null
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Sentinel Bootstrap workflow uses workflow-specific intent-to-flag vocabulary; canonical Mode/Output two-table shape doesn't fit"
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "Sentinel Bootstrap workflow has bespoke Output section with workflow-specific shape"
---

# Sentinel Bootstrap — The First Breath

<!-- kg-writer: Bootstrap -->

When Sentinel detects an empty project (< 3 source files, no CLAUDE.md, no dependencies), it enters Bootstrap Mode instead of Discovery Mode. Bootstrap interviews the user about their intent, scaffolds a project structure, and populates DOS knowledge systems — so the first experience feels like DOS is working FOR them.

**This workflow is called by Scan.md when `isEmptyProject: true`.** It is not invoked directly by users.

## When to Use

- Triggered by "sentinel bootstrap", "empty repo init", "scaffold new repo", "no-code interview" — or automatically when Scan detects an empty project (< 3 source files, no CLAUDE.md, no dependencies).
- Fits brand-new projects with no existing code, where Discovery Mode has nothing to analyze yet.
- NOT for repos with existing code and conventions to discover — use Scan (Bootstrap is the auto-branch Scan takes only when the project is empty).

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Empty project detected. Entering bootstrap mode to set up your project."
```

Sentinel detected an empty project. Entering **Bootstrap Mode**...

## Pipeline (6 Steps)

### Progressive Narration (MANDATORY)

```
Bootstrap Step 1: Interviewing — what are you building?
Bootstrap Step 2: Initializing git repository...
Bootstrap Step 3: Scaffolding project structure...
Bootstrap Step 4: Generating CLAUDE.md with project intent...
Bootstrap Step 5: Registering project in DOS...
Bootstrap Step 6: Bootstrap complete — re-running scan on scaffolded structure.
```

### Step 1: Interview

Ask the user 5 questions to understand their project intent. Use AskUserQuestion with structured options.

**Question 1 — What are you building?**

Use AskUserQuestion with a free-text prompt:

```
Question: "What are you building? (one sentence describing the project)"
Header: "Project"
Options:
  - "SaaS application" — "Multi-tenant web app with auth, billing, and user management"
  - "API service" — "Backend API (REST or GraphQL) serving data to clients"
  - "CLI tool" — "Command-line utility or developer tool"
  - "Library / Package" — "Reusable code published to npm, PyPI, or similar"
```

The user can also select "Other" to provide a custom description. Store the answer as `PROJECT_DESCRIPTION`.

**Question 2 — Tech stack?**

```
Question: "What tech stack will you use?"
Header: "Stack"
Options:
  - "Next.js + TypeScript (Recommended)" — "Full-stack React framework with server components, API routes, and SSR"
  - "React + Vite + TypeScript" — "Client-side SPA with fast dev server and build tooling"
  - "Node.js + TypeScript" — "Backend-only with Express, Fastify, or Hono"
  - "Python" — "Python project with pip/uv, FastAPI or Django"
```

Store as `STACK`. If user selects "Other", ask them to specify.

**Question 3 — Monorepo?**

```
Question: "Will this be a monorepo with multiple packages?"
Header: "Monorepo"
Options:
  - "No (Recommended)" — "Single package — simpler setup, easier to start"
  - "Yes — Turborepo" — "Monorepo with Turborepo for build orchestration"
```

Store as `MONOREPO` (boolean).

**Question 4 — Database?**

```
Question: "What database will you use?"
Header: "Database"
Options:
  - "Prisma + PostgreSQL (Recommended)" — "Type-safe ORM with migrations, works with Supabase or standalone Postgres"
  - "Supabase" — "Postgres + Auth + Realtime + Storage as a service, with client SDK"
  - "MongoDB" — "Document database with Mongoose ODM"
  - "None yet" — "Skip database setup for now"
```

Store as `DATABASE`.

**Question 5 — Auth?**

```
Question: "What auth solution will you use?"
Header: "Auth"
Options:
  - "Better Auth (Recommended)" — "Open-source, self-hosted auth with social logins and magic links"
  - "NextAuth / Auth.js" — "Popular Next.js auth with provider adapters"
  - "Clerk" — "Managed auth service with pre-built UI components"
  - "None yet" — "Skip auth setup for now"
```

Store as `AUTH`.

**Post-Interview Enhancement (OPTIONAL):**

If the user provided a detailed project description (> 20 words) AND/OR dropped files or context during the interview, consider using a quick council (via thinking skill — council mode) to recommend stack choices. This is NOT mandatory — only do this when the user has given enough context to make recommendations meaningful. Skip for terse answers.

### Step 2: Git Init

Check if the current directory is already a git repository:

```bash
git rev-parse --is-inside-work-tree 2>/dev/null
```

If NOT a git repo, initialize one:

```bash
git init
```

Report: "Initialized git repository" or "Git repository already exists"

### Step 3: Scaffold

Based on the interview answers, create the project structure. All files are written using the Write tool.

**3a — Core DOS directories (always created):**

```bash
mkdir -p MEMORY/WORK
mkdir -p MEMORY/LEARNING
mkdir -p MEMORY/RESEARCH
mkdir -p MEMORY/ARTIFACTS
mkdir -p MEMORY/SECURITY
mkdir -p Plans/Specs
```

**3b — .gitignore (stack-appropriate):**

The `.gitignore` body is generated by a tested helper, not hand-typed — the "all stacks"
base block plus the stack-specific tail (nextjs/react-vite share the Next.js/Vite block;
node and python have their own). Write its output to `.gitignore`:

```bash
# generateGitignore(stack) in SentinelBootstrap.ts is the byte-exact source of truth.
# stack ∈ nextjs | react-vite | node | python. Golden-pinned in SentinelBootstrap.test.ts.
bun ~/.claude/skills/sentinel/Tools/SentinelBootstrap.ts gitignore <stack> > .gitignore
```

**3c — Stack-specific config files:**

The stack config files are generated by a tested helper, not hand-typed. It returns a
`{ path: contents }` map — `package.json` + `tsconfig.json` for JS/TS stacks (with the
database/auth dependency additions and monorepo `turbo.json` + `workspaces` appended per
the locked interview answers), or `pyproject.toml` for Python. Write each entry with the
Write tool:

```bash
# generateStackConfig(spec) in SentinelBootstrap.ts is the byte-exact source of truth
# for every config-file body (package.json, tsconfig.json, pyproject.toml) and for the
# database/auth/monorepo append rules. Golden-pinned in SentinelBootstrap.test.ts.
bun ~/.claude/skills/sentinel/Tools/SentinelBootstrap.ts stack-config <spec.json>
```

**StackConfigSpec shape:** `stack` (nextjs | react-vite | node | python), `database`
(`prisma-postgres` | `supabase` | `mongodb` | none), `auth` (`better-auth` | `nextauth`
| `clerk` | none), `monorepo` (boolean), `projectName`, `projectDescription` (Python
pyproject only). The helper output is the map of files to write — no per-file
transcription, so the configs cannot drift from this prose.

**3d — README.md:**

```markdown
# {PROJECT_NAME}

{PROJECT_DESCRIPTION}

## Getting Started

{Stack-appropriate install + dev commands from package.json scripts or pyproject.toml}

## Tech Stack

- **Language:** {STACK language}
- **Framework:** {STACK framework}
- **Database:** {DATABASE}
- **Auth:** {AUTH}

---

Bootstrapped by [DOS Sentinel](https://github.com/durante-tech/dos).
```

Report: "Scaffolded {N} files: {list of created files}"

### Step 4: Generate CLAUDE.md

Create a CLAUDE.md tailored to the project intent, NOT discovered patterns (there are
none yet). The CLAUDE.md body is rendered by a tested helper, not hand-typed — Tech
Stack list, the auto-generated Sentinel Conventions comment + "No conventions discovered
yet" note, the Recommended Conventions bullets, and the Setup commands:

```bash
# generateClaudeMd(spec) in SentinelBootstrap.ts is the byte-exact source of truth for
# the bootstrapped CLAUDE.md skeleton. Golden-pinned in SentinelBootstrap.test.ts. Write
# its output to CLAUDE.md.
bun ~/.claude/skills/sentinel/Tools/SentinelBootstrap.ts claude-md <spec.json> > CLAUDE.md
```

**ClaudeMdSpec shape:** `projectName`, `projectDescription`, `language`, `framework`,
`runtime` (Node/Bun/Python from STACK), `database`, `auth`, `packageManager`
(npm/pnpm/bun/uv from STACK), `date`, `recommendedConventions` (stack-standard bullet
strings — the agent's judgment about which conventions fit the chosen stack, e.g. the
Next.js `src/` + PascalCase + `@/` alias + `.test.ts` co-location set), `installCommand`,
`devCommand`, `buildCommand`. The render is deterministic; only the recommended-
convention wording is the agent's stack judgment, passed in as data.

### Step 5: Register in DOS

**5a — PROJECTS.md Registration:**

Check `~/.claude/DOS/USER/PROJECTS/PROJECTS.md` for an existing entry matching the project path.

If not found, derive the wing name through the tested `deriveWing(null, root)` helper —
exposed as a CLI subcommand so this prose never re-derives the "lowercase, kebab-case"
rule by hand (single source of truth shared with Scan registration):

```bash
WING=$(bun ~/.claude/skills/sentinel/Tools/SentinelScan.ts resolve wing "$(pwd)")
```

Then append:

```
| {project_name} | {path} | `{wing}` | - | {stack_summary} | Bootstrapped project |
```

**5b — MemPalace Population (robust batch write):**

<!-- partial: _robust-kg-write.md -->

Build ONE batch with every stack fact, the project type, the start/scan
timestamps, AND the two semantic drawers — then submit it once per the
robust-write contract above. Predicates are canonicalized per
`Packs/mem-palace/PREDICATES.md` §1: language + framework → `uses_framework`,
database → `uses_db`, auth → `uses_tool`, project type → `is_a`, bootstrap
timestamp → `started_on`, scan marker → `scanned_by_sentinel` (the legacy
`uses` / `bootstrapped_at` predicates are aliases/unregistered — never emit
them).

```bash
# Replace WING / LANGUAGE / FRAMEWORK / DATABASE / AUTH / PROJECT_TYPE /
# PROJECT_DESCRIPTION / STACK_SUMMARY / TODAY with the locked interview answers.
cat > /tmp/sentinel-bootstrap-batch.json <<'EOF'
{
  "operations": [
    {"action": "add_kg_fact", "args": {"subject": "project:WING", "predicate": "uses_framework", "object": "LANGUAGE", "valid_from": "TODAY"}},
    {"action": "add_kg_fact", "args": {"subject": "project:WING", "predicate": "uses_framework", "object": "FRAMEWORK", "valid_from": "TODAY"}},
    {"action": "add_kg_fact", "args": {"subject": "project:WING", "predicate": "uses_db", "object": "DATABASE", "valid_from": "TODAY"}},
    {"action": "add_kg_fact", "args": {"subject": "project:WING", "predicate": "uses_tool", "object": "AUTH", "valid_from": "TODAY"}},
    {"action": "add_kg_fact", "args": {"subject": "project:WING", "predicate": "is_a", "object": "PROJECT_TYPE", "valid_from": "TODAY"}},
    {"action": "add_kg_fact", "args": {"subject": "project:WING", "predicate": "started_on", "object": "TODAY", "valid_from": "TODAY"}},
    {"action": "add_kg_fact", "args": {"subject": "project:WING", "predicate": "scanned_by_sentinel", "object": "TODAY", "valid_from": "TODAY"}},
    {"action": "add_drawer",  "args": {"wing": "WING", "room": "architecture", "content": "Building PROJECT_DESCRIPTION with STACK. Database: DATABASE. Auth: AUTH.", "source_file": "sentinel-bootstrap", "added_by": "sentinel"}},
    {"action": "add_drawer",  "args": {"wing": "WING", "room": "stack", "content": "STACK_SUMMARY", "source_file": "sentinel-bootstrap", "added_by": "sentinel"}}
  ]
}
EOF

# Submit — ONE process, ONE SQLite connection, ONE WAL transaction
RESPONSE=$(uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py batch "$(cat /tmp/sentinel-bootstrap-batch.json)")

# Parse the status — NOT the exit code or tail -1 (the bridge always exits 0)
bun ~/.claude/skills/sentinel/Tools/SentinelScan.ts parse-batch "$RESPONSE" \
  || { echo 'Bootstrap 5b batch FAILED — abort, do not claim success'; exit 1; }

# MANDATORY direct-SQLite verification — source of truth, quote these counts
sqlite3 ~/.mempalace/knowledge_graph.sqlite3 \
  "SELECT COUNT(*) FROM triples WHERE subject='project:WING'"   # expect 7 KG facts
sqlite3 ~/.mempalace/wing_index.db \
  "SELECT COUNT(*) FROM wing_index WHERE wing='WING'"           # expect 2 drawers
```

If either count is below expected, report the bootstrap as a partial failure in
the final summary — never claim "{N} KG triples filed" without these numbers.

**5c — Studio Registration (fire-and-forget):**

If `STUDIO_API_URL` and `STUDIO_API_KEY` are set:

```bash
bun ~/.claude/skills/sentinel/Tools/SaveProjectToStudio.ts \
  --name "{project_name}" \
  --slug "{wing}" \
  --path "{project_path}" \
  --stack "{stack_summary}"
```

### Step 6: Re-scan

Now that the project has scaffolded files, run SentinelScan.ts again to produce a proper scan report:

```bash
bun ~/.claude/skills/sentinel/Tools/SentinelScan.ts "$(pwd)"
```

This time `isEmptyProject` will be `false` (CLAUDE.md exists, package.json has deps). The scan report populates `.sentinel/scan-report.json` with accurate data.

**Do NOT re-enter the full Scan pipeline** (no Phase 2 inference, no Phase 3 MemPalace, etc.) — there's no real code to analyze yet. The re-scan is just to produce a valid scan report for the convention cache and Guard hook.

Generate the convention cache:

```bash
bun ~/.claude/skills/sentinel/Tools/ConventionCache.ts
```

## Intent-to-Flag Mapping

This workflow shells out to `Tools/SentinelScan.ts`, `Tools/ConventionCache.ts`, `Tools/SaveProjectToStudio.ts`, and the MemPalace bridge. Translate operator phrasing into deterministic flag selection per CreateSkill workflow Step 6 + CliFirstArchitecture.md.

### Step Selection (which tool to invoke)

| Bootstrap Stage | Tool | Effect |
|-----------------|------|--------|
| Re-scan after scaffold (Step 6) | `SentinelScan.ts` | Generates `.sentinel/scan-report.json` for the now-populated tree |
| Build convention cache (Step 6) | `ConventionCache.ts` | Reads KG state, writes `.sentinel/conventions.json` for the Guard hook |
| Register project in Studio (Step 5c) | `SaveProjectToStudio.ts` | Files the project row in the Studio projects table |
| File KG triples + drawers (Step 5b) | MemPalace bridge `<add_kg_fact>` / `<add_drawer>` | Writes stack facts and architecture intent into the wing |

### SentinelScan.ts and ConventionCache.ts Inputs

| User Says | Argument | Effect |
|-----------|----------|--------|
| "scan this dir" / positional path | `<path>` (positional) | Repo root to scan; defaults to `.` |
| "show usage", "help" | `--help, -h` | Prints help text and exits |

### SaveProjectToStudio.ts Inputs

| User Says | Flag | Effect |
|-----------|------|--------|
| "register from the scan report" | `--from-scan <path>` | Reads project metadata from `.sentinel/scan-report.json` |
| "register with this name" | `--name <text>` | Project display name |
| "use this slug / wing" | `--slug <slug>` | Wing slug used by MemPalace and KG triples |
| "track this repo" | `--repo <org/repo>` | Optional GitHub repo identifier |
| "anchor at this path" | `--path <root>` | Absolute project root |
| "stack is X,Y,Z" | `--stack <comma,sep,tech>` | Comma-separated tech tags |

## Output

```
## Sentinel Bootstrap Complete

**Project:** {name}
**Path:** {path}
**Stack:** {language} + {framework}
**Database:** {database}
**Auth:** {auth}

### Scaffolded Files
- CLAUDE.md — project intent and recommended conventions
- README.md — project description and getting started
- .gitignore — stack-appropriate ignores
- {package.json / pyproject.toml} — dependencies and scripts
- {tsconfig.json} — TypeScript configuration (if applicable)
- MEMORY/ — DOS project memory directories (5 subdirs)
- Plans/Specs/ — for future specs and RFCs

### DOS Registration
- Registered in PROJECTS.md (wing: `{wing}`)
- Filed {N} KG triples in MemPalace
- Filed {N} drawers in wing `{wing}`
- {Synced to Studio | Studio sync skipped (no API key)}

### Next Steps
- Install dependencies: `{install command}`
- Start building — write your first feature
- Run `sentinel scan` after adding code to discover actual conventions
- Run `sentinel guard` to check changes against conventions
```

## Error Handling

- If AskUserQuestion fails or user cancels: abort bootstrap, report "Bootstrap cancelled"
- If git init fails: warn and continue (project still usable without git)
- If MemPalace bridge fails: warn and continue (registration still works)
- If Studio sync fails: silently skip (fire-and-forget pattern)
- If ConventionCache fails: warn and continue (Guard won't work until next scan)

## Timing

- Step 1 (interview): ~30 seconds (user input)
- Step 2 (git init): < 1 second
- Step 3 (scaffold): 2-3 seconds
- Step 4 (CLAUDE.md): 1-2 seconds
- Step 5 (register): 5-10 seconds (MemPalace bridge calls)
- Step 6 (re-scan): 2-5 seconds
- **Total: ~45-60 seconds** (including user interview time)
