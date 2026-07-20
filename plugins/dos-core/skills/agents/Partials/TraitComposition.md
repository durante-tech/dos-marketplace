# Trait Composition for Agent Spawning

When a workflow spawns persona-based agents (councils, debates, reviews, red teams), compose each agent from traits rather than hardcoding identities.

## Pattern

For each agent to spawn:

1. Run: `bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts --traits "<expertise>,<personality>,<approach>" --output json`
2. Parse the JSON response
3. Use `prompt` field as the agent's system prompt
4. Use `voice_id` and `voice_settings` for voice notifications
5. Use `subagent_type: "general-purpose"` (always for composed agents)
6. Use `color` for visual differentiation

## When to Use

- Councils and debates with distinct perspectives
- Review gates with specialized viewpoints
- Red team / adversarial analysis
- Any workflow spawning 2+ agents with different roles

## When NOT to Use

- Model-routed agents (ClaudeResearcher, GeminiResearcher, etc.) — the `subagent_type` routes to a specific model/API
- DreamTeam named experts — their value comes from channeling real-world frameworks
- Simple parallel grunt work where all agents do the same thing

## Default Council Compositions

These trait combinations replace the legacy hardcoded council roles. Choose traits that match the TOPIC being debated — a sales strategy council should not use the same traits as a technical architecture council.

### Technical Council (default for code/architecture topics)

| Role | Traits | Perspective |
|------|--------|------------|
| architect | `technical, analytical, thorough` | System design, patterns, scalability |
| engineer | `technical, pragmatic, rapid` | Implementation reality, constraints |
| Critic | `security, contrarian, investigative` | Adversarial challenge, find flaws |
| Researcher | `research, investigative, systematic` | Evidence, precedent, external examples |

### Product Council (for strategy/business topics)

| Role | Traits | Perspective |
|------|--------|------------|
| Strategist | `product, analytical, thorough` | Market positioning, prioritization |
| Builder | `technical, pragmatic, rapid` | What's actually buildable |
| Challenger | `sales, contrarian, investigative` | Revenue reality, customer perspective |
| Creative | `creative, enthusiastic, parallel` | Novel approaches, unexplored angles |

### Security Council (for security/compliance topics)

| Role | Traits | Perspective |
|------|--------|------------|
| Auditor | `security, skeptical, thorough` | Systematic vulnerability assessment |
| Red Team | `security, contrarian, adversarial` | Actively tries to break things |
| architect | `technical, analytical, systematic` | Secure design patterns |
| compliance | `legal, cautious, meticulous` | Regulatory and legal requirements |

### Custom Composition

Any workflow can specify its own trait combinations. Pick one trait from each dimension:

- **Expertise** (12): security, technical, research, sales, brand, product, creative, legal, finance, medical, communications, data
- **Personality** (9): skeptical, analytical, enthusiastic, contrarian, pragmatic, cautious, bold, empathetic, meticulous
- **Approach** (10): thorough, rapid, systematic, investigative, parallel, exploratory, comparative, synthesizing, adversarial, consultative

Run `bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts --list` to see all available traits.
