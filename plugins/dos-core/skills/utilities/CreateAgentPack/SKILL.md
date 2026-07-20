---
disable-model-invocation: true
name: CreateAgentPack
description: Scaffold autonomous DOS agent packs — Gateway-routed, credit-metered TypeScript agents with the shared runtime. USE WHEN create agent, new agent pack, scaffold agent, autonomous agent, agent pack, create agent pack, build agent, multi-step agent pack.
role: executor
accepts:
  - text
roots:
  - PROJECT.WORK
visibility: public
capabilities:
  - customization.cascade
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/CreateAgentPack/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# CreateAgentPack

Scaffolds autonomous DOS agent packs — executable TypeScript agents that read Studio API data, synthesize via Gateway inference (provider-agnostic, credit-metered), and produce opinionated output.

**This is NOT CreateSkill.** CreateSkill builds prompt-based packs (SKILL.md + Workflows/). CreateAgentPack builds **executable agent packs** (TypeScript + shared runtime + CLI entry point). They complement each other.

## Architecture (Council-Decided)

Every agent pack follows the pattern established by the DailyBrief agent:

- **Standalone TypeScript script** — not Studio monolith, not CC remote agent
- **Gateway-routed inference** — provider-agnostic, credit-metered via Studio
- **Read-only Studio client** — GET only, no writes to production data
- **5-stage pipeline** — `collect → synthesize → render → store → notify`
- **Shared runtime** — `Packs/agents/_runtime/` (clients, collectors, pipeline)
- **Agent-specific config** — `sources.ts` (endpoints), `prompts.ts` (system prompt), `index.ts` (CLI)

## File Structure

```
Packs/agents/
├── _runtime/                        # Shared by ALL agent packs
│   ├── studio-client.ts             # ReadOnlyStudioClient (GET only)
│   ├── gateway-client.ts            # GatewayClient (provider-agnostic)
│   ├── sanitize.ts                  # Token/key sanitization
│   ├── data-collector.ts            # Parallel fetch via Promise.allSettled
│   └── agent-pipeline.ts            # 5-stage pipeline orchestrator
├── DailyBrief/                      # Reference implementation
│   ├── agent.yaml                   # M2 portable manifest (ant-compatible)
│   └── src/
│       ├── index.ts                 # CLI entry point
│       ├── config/sources.ts        # 12 data source endpoints
│       └── config/prompts.ts        # System prompt + message builder
└── {NewAgent}/                      # Created by this skill
    ├── agent.yaml                   # Portable manifest (generated, LLM packs only)
    └── src/
        ├── index.ts                 # CLI entry point (generated)
        ├── config/sources.ts        # Data source registry (generated)
        └── config/prompts.ts        # System prompt (generated)
```

## Workflow Routing

| Trigger | Workflow |
|---------|----------|
| "create agent pack", "new agent", "scaffold agent" | `Workflows/Create.md` |

## Quick Reference

- **Shared runtime:** `Packs/agents/_runtime/` — never duplicate these files
- **Reference agent:** `Packs/agents/DailyBrief/` — the canonical example
- **Gateway providers:** anthropic, google, xai, perplexity
- **Default model:** claude-sonnet-4-6 (cost-optimized for daily agents)
- **Guardrails:** read-only Studio access, circuit breaker, token sanitization, artifact tracking
