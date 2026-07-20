---
name: cs
description: Search prior work to add context to a request, or browse previous sessions on a topic. Shortcut for /context-search.
argument-hint: [topic]
---

# Context Search (`/cs` — alias of `/context-search`)

`/cs` is the shortcut for `/context-search`. It runs the **exact same** Context Search procedure — there is no separate behavior, so the two cannot drift.

Search all prior work for: **$ARGUMENTS**

**Execute the full Context Search procedure from the canonical skill resource** for the topic `$ARGUMENTS`: use `${CLAUDE_PLUGIN_ROOT}/skills/context-search/commands/context-search.md` in a plugin install, or `~/.claude/skills/context-search/commands/context-search.md` in a maintainer install. Use the first path that exists. That file is the single source of the procedure; this alias deliberately carries no copy of it. In brief, it:

1. **Detects the environment** (vanilla Claude Code vs DOS-enhanced — `MEMORY/WORK/` present).
2. **Searches the available sources in parallel** — A–C on any install (conversation history, current-project git, project memory) plus D–H when DOS-enhanced (session registry, work directories, DOS git, session names, PRD content), and the **opt-in semantic branch** (the MemPalace `search` bridge action; grep is always SoT, semantic is additive, silently skipped when the bridge is offline).
3. **Presents** the `═══ CONTEXT SEARCH ═══` summary (omitting empty sections).
4. **After results** — Mode 1 (standalone: load context, then ask what to do) or Mode 2 (paired with a request: load context, then execute the request informed by it).

Read that canonical skill resource for the authoritative step detail (source field schemas, the exact semantic invocation, the output template). Do not re-expand the procedure here — keeping `/cs` a pointer is what stops the shortcut from diverging from its principal.
