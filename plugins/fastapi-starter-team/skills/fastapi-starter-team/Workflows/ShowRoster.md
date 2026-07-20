---
name: ShowRoster
description: "Read-only meta-workflow that prints the 13-role team table (traits, MCP clusters) with no agent spawning or PRD."
status: STABLE
bestPath:
  - title: "Resolve Roster Data"
    description: "Run InvokeAgent.ts --list or read Data/Roster.json directly."
  - title: "Render Team Table"
    description: "Print the 13-role table with traits and MCP clusters."
  - title: "Surface Summary Counts"
    description: "Report the total roles, workflows, partials, and tools available."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "ShowRoster is a read-only roster command with one list flag; canonical Mode/Output two-table shape is too broad"
---

# ShowRoster Workflow

Print the 13-role team table. Read-only meta-workflow — no agent spawning, no PRD.

**Sibling:** `MakerkitTeam/Workflows/ShowRoster.md`.

## When to Use

- Trigger phrases: "show team", "list team", "team roster", "show starter team".
- Fits when you just need to see the 13-role roster and its traits/MCP clusters, with no phase ceremony.

## Intent-to-Flag Mapping

| Operator intent | Command / flag pattern | Notes |
|---|---|---|
| "show the FastAPI team roster" | `bun ~/.claude/skills/fastapi-starter-team/Tools/InvokeAgent.ts --list` | Prints the 13-role table. |
| "inspect the roster data" | read `~/.claude/skills/fastapi-starter-team/Data/Roster.json` | Use when the CLI is unavailable. |

## Execution

1. Voice notify: `bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running ShowRoster workflow in fastapi-starter-team skill to list team"`
2. Run:

```bash
bun ~/.claude/skills/fastapi-starter-team/Tools/InvokeAgent.ts --list
```

Or read `~/.claude/skills/fastapi-starter-team/Data/Roster.json` and render the team summary table:

| id | Role | Traits | MCP clusters |
|---|---|---|---|
| pm | Product Manager | product · analytical · systematic | project_status |
| sm | Scrum Master | communications · empathetic · consultative | project_status |
| apidx | API DX Designer | creative · empathetic · exploratory | api_surface |
| schema | Schema Designer | creative · meticulous · thorough | api_surface |
| architect | Software Architect | technical · analytical · thorough | project_status, migrations, api_surface |
| agent | Agent Engineer | technical · pragmatic · systematic | api_surface, checks |
| backend | Backend Developer | technical · meticulous · systematic | api_surface, checks, env |
| database | Database Engineer | data · analytical · meticulous | migrations, checks |
| security | Security Engineer | security · skeptical · adversarial | env, checks |
| qa | QA Engineer | technical · skeptical · thorough | checks |
| e2e | E2E Tester | technical · contrarian · investigative | mailbox, api_surface, checks |
| devops | DevOps / SRE | technical · cautious · systematic | env, migrations, checks, project_status |
| writer | Tech Writer | communications · meticulous · synthesizing | api_surface |

3. Surface counts: 13 roles · 14 workflows · 5 shared partials · 6 tools · 6 MCP clusters · 8+ MCP tools.

No phase ceremony, no team spawning, no operator gate. Returns immediately.
