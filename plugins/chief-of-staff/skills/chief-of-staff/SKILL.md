---
name: ChiefOfStaff
description: Your local-first chief of staff — triages inbox, drafts briefs in your voice, captures commitments, and delivers morning briefs. USE WHEN triage, triage inbox, process inbox, meeting prep, prep for, brief me, morning brief, daily brief, followup, follow up, log meeting, capture commitments, action items, cos, chief of staff, secretary, executive assistant, EA.
role: executor
accepts:
  - text
icon: Inbox
colorVar: primary
colorHex: "#7fd4ff"
tier: primary
category: Operations
displayLabel: Chief of Staff
marketingDescription: A local-first chief of staff that compounds — memory across every channel, drafts in your voice, surfaces what you'd have missed.
capabilities:
  - artifact.write
  - customization.cascade
  - four-copy.sync
  - voice.emit
elevator: A chief of staff that remembers what you forgot you said.
highlightWorkflows:
  - name: Triage
    technicalName: Triage
  - name: Brief
    technicalName: Brief
  - name: Followup
    technicalName: Followup
  - name: Morning Brief
    technicalName: Morning
roots:
  - PRINCIPAL.SKILLCUSTOMIZATIONS
visibility: public
feature_capabilities:
  - Commitment ledger with day-12 circle-back discipline
  - Daily brief composition with aging open-loops surface
  - Inbox triage with four-bucket model + Processing Rules canon
  - One-screen pre-meeting dossier generator
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# ChiefOfStaff Skill

A local-first chief of staff for founders of small teams. Handles the highest-friction principal-ops surface — inbox, calendar prep, follow-ups, commitments, morning briefs — with memory that compounds across every session.

**Philosophy:** The elite EA's job is *converting ambient judgment into executable rules while holding the context the principal can't*. This skill encodes that loop — a living `principal.md` profile plus a living `rules.md` canon, read and written by every workflow.

**Copilot, not autopilot.** Drafts are drafts until the principal approves. Autonomy graduates per recipient class via the Processing Rules canon.

## Required Artifacts

Two user-owned files the skill reads at the start of every workflow:

- `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/principal.md` — living principal profile
- `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/rules.md` — Processing Rules canon

Starter templates live at `Templates/principal.md` and `Templates/rules.md`. If either user file is missing on first invocation, the skill copies the template to the user's customization directory and prompts the principal to fill in their details before proceeding.

**Session cache:** `principal.md` and `rules.md` are read once per session; subsequent workflows in the same session MAY reuse the loaded copy unless the file mtime has changed. Do not re-read on every workflow invocation within a single session.

## External Tool Integration (Capability Ports + Adapters)

**The chief-of-staff skill ships with no bundled tools.** It is an orchestration + memory layer. When actual email / calendar reads or writes are required, the workflows reference **logical capability ports** — never a vendor tool name — and this ONE adapter table resolves each port to the live tool. A server rename (or a different OAuth-server name on another install) is a one-line edit here, not a workflow rewrite (Ports-and-Adapters / anti-corruption layer).

| Port | Candidate tool (live `mcp__workspace-mcp__*` surface) | Fallback |
|---|---|---|
| `email.search` | `mcp__workspace-mcp__search_gmail_messages` | paste mode |
| `email.read` | `mcp__workspace-mcp__get_gmail_message_content` (· `...batch` · `get_gmail_thread_content`) | paste mode |
| `email.draft` | `mcp__workspace-mcp__draft_gmail_message` | present draft as text |
| `email.send` | `mcp__workspace-mcp__send_gmail_message` | present draft as text (rule-gated, below) |
| `email.archive` | `mcp__workspace-mcp__modify_gmail_message_labels` (apply/remove a label — **never delete**) | manual / paste |
| `email.auth` | `mcp__workspace-mcp__start_google_auth` | — |
| `calendar.read` | `use-spark` skill (reads calendar / availability) | paste mode — **no calendar MCP exists on this surface** |

**Resolve a port = pick the first candidate that is callable.** The probe is:

1. **Name-tolerant** — match the tool FAMILY (the candidate column), not a single literal, so a server rename is absorbed by editing this table, never the 4 workflows.
2. **Auth-aware** — the Gmail tools may be *registered but not yet callable* until OAuth completes; `email.auth` (`start_google_auth`) being present does NOT mean authed. Treat an auth-required error as "degrade to paste mode," never a hard mid-workflow failure (distinguish absent / unloaded / unauthed).
3. **Paste-mode floored.** If no candidate resolves, the workflow asks the principal to paste the relevant content (email text, calendar entry, transcript) into the chat. Paste mode is always available.

**Send autonomy (optional, rule-gated).** Even when the `email.send` / `email.draft` ports resolve, the skill NEVER sends without explicit permission. Direct send requires a Processing Rule in `rules.md` that explicitly allows it for the specific recipient class, for example:

```
- WHEN bucket is EA-Handles AND recipient domain is {vendor-domain}.com THEN mcp_send_ok
```

Absent such a rule, drafts are presented as text for the principal to copy-paste or for the `email.draft` port to stash as a draft — review-only in both cases.

**Redaction on the way out.** Before invoking any port that would send data to an external service, apply the `redact_patterns` from `principal.md` to the payload.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Triage** | "triage", "triage my inbox", "process inbox", "what's in my inbox", "run triage" | `Workflows/Triage.md` |
| **Brief** | "brief me", "prep for {name}", "meeting prep", "who am I meeting with", "dossier" | `Workflows/Brief.md` |
| **Followup** | "follow up", "log the meeting", "action items", "capture commitments", "meeting follow-up" | `Workflows/Followup.md` |
| **Morning** | "morning brief", "daily brief", "what's today", "good morning", "start my day" | `Workflows/Morning.md` |

This table is the single source of truth for top-level triggers. Individual workflow files may document workflow-internal sub-modes (e.g. "short brief") but never duplicate the top-level triggers above.

## Examples

**Example 1: Morning inbox triage with four-bucket model**
```
User: "Triage my inbox"
→ Invokes Triage workflow against the four-bucket model (Reply-Now, Schedule, EA-Handles, Defer)
→ Loads principal.md + rules.md, classifies each unread thread per Processing Rules canon, drafts replies in the principal's voice
→ User gets a one-screen rollup with draft replies queued for review and EA-Handles items already actioned per rules
```

**Example 2: Pre-meeting dossier for a calendar event**
```
User: "Brief me on my 3pm with Sarah Chen"
→ Invokes Brief workflow, pulls the calendar entry, walks prior threads + commitment ledger
→ For first-time attendees, fans out to the research skill for enrichment; assembles a one-screen dossier
→ User gets attendee context, prior commitments, open loops, suggested talking points — all on one screen
```

**Example 3: Capture commitments after a meeting**
```
User: "Log the meeting — here's the transcript: [paste]"
→ Invokes Followup workflow on the supplied transcript
→ Extracts action items, commitments-by-principal, commitments-to-principal; writes to the commitment ledger with day-12 circle-back triggers
→ User gets a clean action list plus drafts of any follow-up emails for review
```

## Integration

### Uses
- **Research** — Brief workflow invokes Research for first-time attendee enrichment when Research is installed

## Key Principles

1. **Memory over model weights** — The skill gets smarter by accumulating `rules.md` entries and `principal.md` refinements, not by retraining.
2. **Drafts-by-default** — Nothing sends without principal approval unless the Processing Rules canon explicitly allows it for that recipient class.
3. **One-screen discipline** — Every brief, dossier, and morning memo fits on one screen. Executive attention is the scarcest resource.
4. **Generic to ship, personal to thrive** — The Pack ships generic; the principal profile + rules canon carry all the personalization.
5. **Local-first** — All storage in the user's `~/.claude/` tree. No cloud, no telemetry, no export without explicit invocation.
6. **MCP-opportunistic** — Use MCP tools when present, fall back to paste when not. Never coupled to a specific vendor.

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

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"ChiefOfStaff","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/chief-of-staff/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/chief-of-staff/` — active release submodule (versioned)
3. `Packs/*/src/ChiefOfStaff/` — pack source (distributable)
4. `Packs/agents/ChiefOfStaff/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
