# Roster Bootstrap — Provisioning the 13 Saved Compositions

`Data/Roster.json` names 13 roles whose system prompts live as saved compositions at `~/.claude/custom-agents/<slug>.md`. Those files are host state, not pack contents — a fresh host has none of them, and `Tools/InvokeAgent.ts --role <id>` hard-fails (uncaught throw, raw bun stack trace, exit 1) for every role until they exist. This file is the copy-pasteable provisioning block and the truthful description of what works without it.

## Provisioning block (run once per host)

Each command composes an agent from the role's traits via the agents skill and saves it to `~/.claude/custom-agents/`. The agents skill slugifies the composed name (lowercase, non-alphanumeric to `-`, truncated to 40 chars), which reproduces the roster slugs exactly — verified this session for `pm` (`product-strategy-expert-analytical-syste`) and `sm` (`communications-expert-empathetic-consult`).

```bash
COMPOSE=~/.claude/skills/agents/Tools/ComposeAgent.ts
bun $COMPOSE -r "product,analytical,systematic" --save        # pm        -> product-strategy-expert-analytical-syste
bun $COMPOSE -r "communications,empathetic,consultative" --save  # sm     -> communications-expert-empathetic-consult
bun $COMPOSE -r "creative,empathetic,exploratory" --save      # ux        -> creative-content-expert-empathetic-explo
bun $COMPOSE -r "creative,meticulous,thorough" --save         # ui        -> creative-content-expert-meticulous-thoro
bun $COMPOSE -r "technical,analytical,thorough" --save        # architect -> technical-specialist-analytical-thorough
bun $COMPOSE -r "technical,pragmatic,systematic" --save       # frontend  -> technical-specialist-pragmatic-systemati
bun $COMPOSE -r "technical,meticulous,systematic" --save      # backend   -> technical-specialist-meticulous-systemat
bun $COMPOSE -r "data,analytical,thorough" --save             # database  -> data-analyst-analytical-thorough
bun $COMPOSE -r "security,skeptical,adversarial" --save       # security  -> security-expert-skeptical-adversarial
bun $COMPOSE -r "technical,skeptical,thorough" --save         # qa        -> technical-specialist-skeptical-thorough
bun $COMPOSE -r "technical,contrarian,investigative" --save   # e2e       -> technical-specialist-contrarian-investig
bun $COMPOSE -r "technical,cautious,systematic" --save        # devops    -> technical-specialist-cautious-systematic
bun $COMPOSE -r "communications,meticulous,synthesizing" --save  # writer -> communications-expert-meticulous-synthes
```

Flag reference (from `ComposeAgent.ts --help`, the governed inter-pack contract): `-r, --traits <list>` takes comma-separated trait keys; `-s, --save` writes the composition to `~/.claude/custom-agents/`. `--save` is a FROZEN flag (name + semantics fixed).

## Verify

```bash
bun Tools/MakerkitCli.ts preflight
```

Expect `roster.ok: true` with `roster.missing_compositions: []`. Then spot-check role resolution:

```bash
bun Tools/InvokeAgent.ts --role sm | head -3   # prints the saved composition frontmatter
```

## What happens when compositions are missing (the actual degraded path)

Verified against `Tools/BuildBrief.ts` and `Tools/InvokeAgent.ts` this session:

- **Fan-out still works.** `BuildBrief.ts` reads only `Data/Roster.json` plus `FrameworkDigest.md` and `Data/McpToolMap.json` — it never touches `saved_agents_dir`. The brief it emits carries the role identity, owns/consumes/produces contract, digest slice, and MCP authorization, so the orchestrator can spawn each role as a base (uncomposed) subagent with the brief alone. What is lost is only the composed persona layer (trait-shaped system prompt) that `InvokeAgent.ts` would have supplied.
- **`InvokeAgent --role <id>` hard-fails today.** `loadSystemPrompt` (InvokeAgent.ts:53-61) throws `Saved composition not found at ~/.claude/custom-agents/<slug>.md` and `main()` does not catch it — the operator sees a raw bun stack trace, exit 1. There is no in-tool fallback.
- **`MakerkitCli.ts preflight` is the early warning.** It reports every missing composition under `roster.missing_compositions` with a warning pointing back to this file, before any workflow reaches the InvokeAgent failure. Run it at Phase 0 of any multi-agent workflow.

## Substitutions and removals (v0.8.0)

- `Browser` was removed from `qa` and `e2e` `composed_skills`: no `Browser` skill exists under `~/.claude/skills/` and no installed browser-automation skill lives there as a skills directory, so there is no truthful substitute to name. E2E browser work is covered by `playwright-e2e-expert` (kit-repo-level skill), which `e2e` retains.
- All voice fields were removed from `Data/Roster.json` (voice retired platform-wide 2026-07-02). `ComposeAgent` output may still mention voice metadata; the roster no longer carries it.
- Note on `roster.missing_skills`: the kit-specialist entries (`react-form-builder`, `server-actions-expert`, `prisma-expert`, `playwright-e2e-expert`, `frontend-design`) are repo-level skills that live in the target kit repo's `.claude/skills/`, not under `~/.claude/skills/` — preflight run from outside a kit checkout will list them as missing. That is expected; they resolve when the session cwd is the kit repo.
