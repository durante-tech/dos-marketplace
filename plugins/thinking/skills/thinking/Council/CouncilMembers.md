# Council Members

Reference for council member roles, perspectives, and voice assignments.

**Source of truth for persistent specialists:** `MEMORY/CANONICAL/specialist-directory.md`.
**Source of truth for default-council composition:** `~/.claude/skills/agents/Tools/compose/councils.yaml`
(consumed by `~/.claude/skills/agents/Tools/compose/commands/CouncilCommand.ts`). This doc explains the
mappings; it does NOT control recruitment at runtime.

## Default Council Members — `--council technical`

Recruitment is half persistent specialists (Task subagent_type) + half composed
dynamic agents — see `councils.yaml` for the authoritative mapping.

| Role | Source | Persona | subagent_type |
|------|--------|---------|----------------|
| **Architect** | persistent — `~/.claude/agents/Architect.md` | Serena Blackwood | `architect` |
| **Engineer** | persistent — `~/.claude/agents/Engineer.md` | Marcus Webb | `engineer` |
| **Critic** | composed — `[security, contrarian, investigative]` traits | (composed) | `general-purpose` |
| **Researcher** | persistent — `~/.claude/agents/PerplexityResearcher.md` | Ava Chen | `PerplexityResearcher` |

The **Designer** persistent specialist (Aditi Sharma) is NOT in the default
`technical` council. Add explicitly via "Council with Designer" for UI/UX
questions, or include in a future `--council product` shape.

## Optional Members

Add these as needed based on the topic:

| Agent | Perspective | When to Add |
|-------|-------------|-------------|
| **Designer** | UX, user needs, accessibility | UI/UX-heavy questions |
| **Security** | Risk, attack surface, compliance | Auth, data, APIs |
| **Fresh Eyes** (custom) | Fresh eyes, naive questions | Complex UX, onboarding |
| **Writer** | Communication, documentation | Public-facing, docs |

## Subagent-Type Quick Reference

Full persistent-specialist roster: `MEMORY/CANONICAL/specialist-directory.md`.

| Council Role | Task subagent_type | Persona |
|--------------|-------------------|-------------|
| architect | `architect` | Serena Blackwood |
| designer | `designer` | Aditi Sharma |
| engineer | `engineer` | Marcus Webb |
| Researcher (default) | `PerplexityResearcher` | Ava Chen |
| security | `Pentester` | Rook Blackburn |
| Fresh Eyes | `general-purpose` (via ComposeAgent) | Custom composed |
| Writer | `general-purpose` (via ComposeAgent) | Emma Hartley |
| Verifier (evidence seat) | `Verifier` | (RFC-0069 — mechanical claim verification, typed JSON return) |
| Skeptic (adversarial seat) | `HarnessSkeptic` | (refuted-until-proven; absence-claim manifest enforcement; opus) |
| Analyst (measurement seat) | `FitnessAnalyst` | (instrument readings into the round; dissent on contradiction; sonnet) |
| Hooks-native (domain seat) | `HooksNative` | (hooks-layer wiring truth + failure-class screening; prescribes to Forge; opus) |

## Custom Council Composition

- "Council with security" — adds Pentester persistent specialist
- "Council with designer" — adds Designer persistent specialist
- "Council with hooks-native" — adds the **HooksNative** persistent specialist (opus, read-only) as the HOOKS-LAYER DOMAIN SEAT: brings the real wiring (~28 events, matchers, spawn modes, SYNC_TOOLS registry, DLQ lifecycle) into rounds that land on the hooks layer; screens proposals against the named bug classes (blind monitors, muted spawns, TDZ cycles, lock wedges); PRESCRIBES to Forge, never edits. Recruit for councils touching telemetry stores, SessionEnd syncs, or event contracts.
- "Council with analyst" — adds the **FitnessAnalyst** persistent specialist (sonnet, read-only radiator CLIs) as the MEASUREMENT SEAT: brings raw instrument readings (memory radiator, seam census, sync parity, hook timing, ratings, workflow receipts) into the round; every position cites a reading; files a dissent when a seat claim contradicts a measurable. Recruit for councils whose verdict depends on system health or cost/impact numbers.
- "Council with skeptic" — adds the **HarnessSkeptic** persistent specialist (opus, read-only) as the ADVERSARIAL SEAT: refuted-until-proven on every load-bearing claim, enforces the absence-claim manifest (naked negatives get flagged), breaks optimistic sequencing, names the cheapest disconfirming probe per position. Recruit for councils whose verdict depends on claims that could be wrong in expensive ways. NOT a code reviewer (/code-review) or red-team (thinking/RedTeam).
- "Council with verifier" — adds the **Verifier** persistent specialist (RFC-0069, sonnet) as an EVIDENCE SEAT: it mechanically re-verifies repo-state claims other seats make during the round (file existence, code behavior, counts) and files a dissent when a claim fails verification. Recruit for councils whose verdict depends on claims about the codebase.
- "Council with fresh eyes" — adds custom composed agent
- "Just architect and engineer" — only specified members

## Specialist Seats (voice-channeling first-class subagents)

Specialist seats spawn **native subagents** by `subagent_type` (e.g. `Fowler`, `UncleBob`). Each specialist has a first-class agent definition at `~/.claude/agents/{Specialist}.md` that wires up: voice prosody (ElevenLabs), persona archetype, permissions allowlist, Subagent Algorithm Profile, and Return Format labels for `SubagentReturn.hook.ts`. The agent's startup-load pulls `SKILL.md` + `QuoteBank.md` + `Principles.md` from the specialist's pack — Council passes only debate-specific prompt content.

| Specialist | `subagent_type` | Voice / Color | Persona Anchor |
|------------|----------------|---------------|----------------|
| **Fowler** | `Fowler` | Drew (29vD33...) / green | Refactoring catalog, PoEAA, microservices, bliki |
| **UncleBob** | `UncleBob` | Arnold (VR6Aew...) / red | SOLID, TDD three laws, Clean Architecture |
| **KentBeck** | `KentBeck` | Freya (jsCqWA...) / cyan | TDD, XP, Tidy First, Empirical Software Design |
| **SandiMetz** | `SandiMetz` | Matthew (Yko7PK...) / pink | Four Rules, Squint Test, the wrong abstraction |
| **EricEvans** | `EricEvans` | Grace (oWAxZD...) / indigo | DDD, Bounded Context, Ubiquitous Language |
| **GregYoung** | `GregYoung` | Fin (D38z5R...) / orange | CQRS, Event Sourcing, projections |
| **Cockburn** | `Cockburn` | Emily (LcfcDJ...) / teal | Hexagonal, Use Cases, Crystal methodology |
| **Feathers** | `Feathers` | Brian (nPczCj...) / gray | Legacy code, seams, characterization tests |
| **Pragmatic** | `Pragmatic` | Jeremy (bVMeCy...) / brown | 100 Tips, DRY, orthogonality, tracer bullets |
| **MemPalaceSage** | `MemPalaceSage` | Rachel (21m00T...) / purple | MemPalace substrate (domain-native, read-only): degraded-signal triage, recovery-rung prescription, KG-curation adjudication |

The author seats above channel external authorities; **MemPalaceSage** is the first **domain-native** seat — recruit it for memory-architecture decisions (HNSW-vs-sqlite durability, closet boost-not-gate, bi-temporal KG invalidation, the daemon re-exec trap) alongside GregYoung/Feathers.

**Recruitment trigger:** When the user names ≥2 specialists (e.g., *"Council with Fowler, UncleBob, KentBeck on event sourcing"*), the Council skill recruits each as a Specialist Seat. Solo invocation (*"channel Fowler"*) still routes to the specialist's own workflow — Council does NOT preempt single-specialist requests.

**Seat composition pattern:** See `Workflows/Debate.md` § Specialist Seat Composition. Council spawns `Task({subagent_type: "<Specialist>", prompt: COUNCIL_DEBATE_ROUND_<N>_INSTRUCTIONS + transcript_so_far})`. The agent's startup loads its persona files automatically. No more parent-side prompt assembly.

**Mixed councils:** Trait-composed seats (`general-purpose` + ComposeAgent) and specialist seats (native subagent_types) can coexist in the same debate. Round 2/3 transcript-passing concatenates output from both kinds verbatim — the specialist sees trait-agent positions and vice versa.

**Seat return delivery (routes by TOOLSET):** read-only seats (the HarnessSkeptic /
FitnessAnalyst / HooksNative class — no `SendMessage` in their toolset) deliver a round
contribution as their FINAL transcript text; the orchestrator recovers it from the seat's
transcript (newest agent jsonl in the session's project directory, last assistant text
block). An idle notification from such a seat is a completion signal, not a delivery —
never instruct a read-only seat to "send" or "post" its position (unexecutable; produces
the idle-dance). Seats with `SendMessage` post their contribution AND leave it as final
text.
