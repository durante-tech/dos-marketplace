---
name: ContextSearch
description: Search across prior DOS work and conversation history — search PRDs, git history, session names, and work directories with a single slash command, standalone or paired with a task. USE WHEN context search, search context, recall session, find prior work, resume work, what did we, search sessions, search PRDs, prior context, cs, context-search. NOT for semantic memory, knowledge-graph facts, or palace operations (use MemPalace) — ContextSearch answers from session history, PRDs, and git.
role: researcher
accepts:
  - text
icon: Search
colorVar: primary
colorHex: "#00e1ab"
tier: secondary
category: Research
displayLabel: Context Search
marketingDescription: Search across prior DOS work and conversation history
elevator: Search across prior work and conversation history
highlightWorkflows:
  - name: Search Context
    technicalName: SearchContext
  - name: Recall Session
    technicalName: RecallSession
roots: []
visibility: public
capabilities:
  - customization.cascade
  - four-copy.sync
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ContextSearch/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Context Search

Search prior work to add context to any request -- never lose context between sessions again.

## Commands

| Command | Purpose |
|---------|---------|
| `/context-search <topic>` | Full search across all sources |
| `/cs <topic>` | Shortcut for quick access (pointer to /context-search — alias-dedupe test pins it) |

**Procedure:** the full search procedure lives in `commands/context-search.md` (the command bodies ARE the workflow implementation — there is no `Workflows/` directory in this skill).

## Usage Modes

1. **Standalone** -- Search and browse previous work on a topic, then wait for a request
2. **Paired with a request** -- Search first, load the context, then execute an accompanying task informed by that context

## Data Sources

**Any Claude Code install:**
- Conversation History (`history.jsonl`)
- Git History (commit messages)
- Project Memory (auto-memory files)

**DOS-enhanced installs:**
- Session Registry (`work.json`)
- Work Directories (`MEMORY/WORK/`)
- Session Names
- PRD Content (full-text search)
- DOS Git History

## Examples

**Example 1: Standalone topic browse before deciding what to do**
```
User: "/cs authentication"
→ Runs the /context-search procedure (commands/context-search.md) in standalone mode
→ Searches conversation history, git commits, session names, work directories, and PRD content for "authentication"
→ User gets a unified results list grouped by source and waits for the user's next instruction
```

**Example 2: Paired search-plus-task to resume work with full context**
```
User: "/cs authentication" then "now add rate limiting"
→ Runs the /context-search procedure in paired mode
→ Loads all prior authentication context first, then executes the rate-limiting task informed by what the user already shipped
→ User gets a rate-limiting implementation that respects existing auth conventions and references the right prior PRDs
```

**Example 3: Recall a specific prior session by topic**
```
User: "What did we decide about the Studio sync DLQ retry policy last week?"
→ Searches session names + PRD content + git history
→ Surfaces the specific session and the PRD where the decision was recorded
→ User gets the decision summary plus a deep link to the original work directory for full context
```

**Four-copy note:** this skill exists in multiple copies — after editing any file here, verify parity with `bun ~/Durante/Tools/sync-check.ts` (full rule: Durante/CLAUDE.md "The Four Copies"). Artifact writes are auto-logged by ArtifactAutoLogger.hook.ts.
