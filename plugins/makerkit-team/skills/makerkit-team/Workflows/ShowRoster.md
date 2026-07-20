---
name: ShowRoster
description: Read-only display of the 13-agent team roster (id, role, traits, ownership, composed skills) with a saved-composition health check against ~/.claude/custom-agents/.
status: STABLE
bestPath:
  - title: "Pre-flight & Load Roster"
    description: "Run the capability probe and read Data/Roster.json."
  - title: "Render Roster Table"
    description: "Output a compact table per role: id, role, traits, owns, composed_skills."
  - title: "Health Check Compositions"
    description: "Verify each saved composition exists at ~/.claude/custom-agents/, flagging any missing."
  - title: "Show Pipeline Summary"
    description: "Display the 8-phase pipeline summary and which workflows exist."
divergence_from_canonical:
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "MakerkitTeam workflows have bespoke per-pipeline Output sections (artifact paths + redline reports); canonical shape doesn't fit"
---

# ShowRoster Workflow

<!-- partial: _workflow-voice.md skill_name=MakerkitTeam workflow_name=ShowRoster action_phrase=" to display team" -->

Display the team roster. Read-only — no agent spawning.

## When to Use

- "show team", "list team", "team roster"
- Operator wants to see the 13-agent roster and composition health without spawning any agents

## Pipeline

1. Preflight: `bun Tools/MakerkitCli.ts preflight` — emit the capability manifest for this run (repo, roster health, scripts, doctrine). Exit 1 = unresolvable repo or invalid roster: STOP and remediate before proceeding.
2. Read `Data/Roster.json`
3. Output a compact table per role: id · role · traits · owns · composed_skills
4. Verify each saved composition exists at `~/.claude/custom-agents/<slug>.md` — flag any missing (remediation: `RosterBootstrap.md`). `bun Tools/MakerkitCli.ts preflight` runs the same roster health check as part of its capability manifest.
5. Show pipeline summary (8 phases) and which workflows exist

## Output

Console table. No artifact written.
