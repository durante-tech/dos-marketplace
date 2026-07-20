# Council roster — the growth-program subagent contract (canonical)

The **single source of truth** for the 5-seat council. Every workflow that convenes the council references
THIS file instead of re-listing the seats; the orchestrator binds phases to these seats in
`Workflows/RunProgram.md` → *Orchestrator Contract*. Per-seat **behavioral** detail lives in each
`Agents/growth-*.md` (the executable seat definition) — this file is the roster index + the handoff edges,
not a second copy of the agent prompts. Lazy-loaded by the conductor (not auto-loaded).

## The 5 seats

| Seat | Agent file | Model | Owns (artifacts + IDs) | Hands off to |
|---|---|---|---|---|
| **Strategist** | `Agents/growth-strategist.md` | sonnet | The wedge + campaign set (`C*`), GEO answer-targets, sequencing across presence **and** the GEO pillar | Channel (placement), Creative (craft), Analyst + Skeptic (every market figure) |
| **Channel** | `Agents/growth-channel.md` | sonnet | Platform mix, per-channel cadence, dated `content-calendar.md` placement, the publish→engage→insights loop, ToS | Creative (asset briefs), Analyst (insights pull) |
| **Creative** | `Agents/growth-creative.md` | sonnet | Brand-locked craft + the **repeatable** production spec — `materials/` + asset IDs | Channel (publish-ready assets) |
| **Analyst** | `Agents/growth-analyst.md` | sonnet | `measurement.md` — **both lenses**: social insights + Share-of-AI-Voice (`Q*` basket) | Strategist (what's working → calendar), Skeptic (every figure) |
| **Skeptic** | `Agents/growth-skeptic.md` | opus | The cross-cutting **integrity guard** (`References/integrity-guard.md`) + the program-wide sign-off | Gates `status: shipped` for the whole program |

## Handoff contract (the load-bearing rules)

- **Skeptic is non-negotiable.** Under council degradation (solo-conductor, or an unresolved
  `Task(subagent_type:"growth-skeptic")` seat), the other four collapse to a single self-review pass — but
  the Skeptic verify pass is **never** skipped, and the deterministic floor (`Tools/VerifyProgram.ts`) still
  runs (Coordination §7.0).
- **Every market figure routes Strategist/Analyst → Skeptic before it is load-bearing.** A stat the Skeptic
  cannot confirm moves to a `> DO NOT CITE — unverified` block and is struck wherever it carried weight.
- **One accountable owner per artifact.** The RACI in `coordination.md` keys each artifact to exactly one of
  these seats as Accountable; Responsible (`R`) may be shared, Accountable (`A`) never.
- **Seats consume, never re-derive.** A downstream seat reads the upstream artifact by its stable ID
  (`C*`/`M*`/`P*`/`PH*`/`Q*`); it does not re-invent it.

> Roster changes (add / rename / retire a seat) update THIS file **and** the corresponding
> `Agents/growth-*.md`; every other workflow inherits the change by reference. Do not re-enumerate the seats
> elsewhere — point at this file.
