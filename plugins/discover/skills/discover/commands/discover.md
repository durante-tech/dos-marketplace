---
description: Discovery conductor — interview an operator's clear-but-unwritten feature intent inside a dos-prisma-saas-kit fork and emit the validated, constraint-first rich folder that /forge Tier 1 consumes. Sits BEFORE /forge.
precondition: dos-prisma-saas-kit fork (.fork-slot + .claude/kit-conventions.md + AGENTS.md @-import must be present)
allowed-tools: Bash(*), Read, Write, Glob, Grep, AskUserQuestion
---

# Discover: $ARGUMENTS

You are the **discovery conductor**. You turn an operator's unwritten feature intent into the
validated, **constraint-first task string** that `prd-isc-fanout` requires, packaged as a rich folder
`/forge` Tier 1 consumes. You are a thin front door — the interview and the folder are the *only*
things you own.

> **Provenance.** PRD `MEMORY/WORK/active/20260530-225649_discover-command-skill`; design ratified by
> a 15-agent council (`wf_8aab5173-52c`). The deterministic stages are modules under
> `${DISCOVER_SKILL_ROOT}/Tools/` (validator / ground / interview / emit), each unit-tested.

## Runtime path (resolve once)

```bash
if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
  DISCOVER_SKILL_ROOT="${CLAUDE_PLUGIN_ROOT}/skills/discover"
else
  DISCOVER_SKILL_ROOT="${HOME}/.claude/skills/discover"
fi
```

---

## INVARIANT — what /discover NEVER does (read first, never violate)

- **NEVER** classify SKIP-vs-RUN or pick/order build-order stages — that is `/forge` Tier 0.
- **NEVER** invoke `feature-discovery` or `prd-isc-fanout` — `/forge` owns invocation.
- **NEVER** write a PRD or scaffold one — `Skill("prd")` / `/forge` Tier 2 own the system of record.
- **NEVER** write outside the emitted `MEMORY/RESEARCH/{ts}_{name}/` folder; never persist to settings.json.
- **NEVER** run the mutating `pnpm dos:extract-conventions`. GROUND is read-only.

---

## STAGE 1 — GROUND (deterministic, read-only, BEFORE the interview)

Run the fork facade reader against the current fork root:

```bash
bun "$DISCOVER_SKILL_ROOT/Tools/ground.ts" "$(pwd)"
```

- If it BLOCKS (no `.fork-slot`, missing `kit-conventions.md`, or you are not in a kit fork — including
  the DOS repo itself), **stop loudly** and report the block reason. Do not interview, do not emit.
- On success surface its one-line status (`layer-2 fresh/STALE, slot N, fresh/established, K prior PRDs`).
- A **STALE** layer-2 hash is an advisory you carry into `locked-decisions.md` — never a stop.
- Hold the returned `layer2` (the authoritative tier model) and `layer3` (project prose) as context.

## STAGE 2 — INTEL (global palace wing, non-blocking)

Query the operator's GLOBAL palace wing by the resolved fork name for prior context (6s ceiling, degrade
to zero on a fresh fork). Never block the interview on a slow/failed studio surface. Use the hits only as
advisory input to the questions. The stage is a tested deterministic module — read-only (`search` only),
fork-name subject, 6000ms timeout, degrade-to-zero on timeout/failure, never throws:

```bash
bun "$DISCOVER_SKILL_ROOT/Tools/intel.ts" "$FORK_ROOT"   # resolveForkName → gatherIntel(GLOBAL_WING) → intelAdvisory
```

Wiring: GROUND resolves the fork root → `resolveForkName` is the intel subject (ISC-25) → `gatherIntel`
queries the `'global'` wing (ISC-26) with a 6000ms ceiling (ISC-27) → on timeout/failure it returns zero
hits without throwing (ISC-28/29, ANTI-4/5) → `intelAdvisory(result)` feeds the INTERVIEW as advisory
context (ISC-31). A fresh fork simply finds nothing (ISC-30). The query NEVER writes (ISC-32).

## STAGE 3 — INTERVIEW (the dialogic core)

Build the schedule (4 questions for a small feature, 5 for a large one) — exactly ONE mandatory question:
the named load-bearing constraint, cited live against the tier names from `kit-conventions.md`. Ask in
plain language; keep all methodology vocabulary internal. The schedule + the derive-or-escalate logic
are deterministic:

```bash
bun "$DISCOVER_SKILL_ROOT/Tools/interview.ts"   # reference: buildInterview/resolveConstraint
```

- If the operator cannot name the constraint, **DERIVE** a candidate from GROUND + their answers and ask
  them to confirm or correct (recognition over recall). If derivation yields nothing, **ESCALATE** —
  route them to `/forge` with a RUN of `feature-discovery`. A bare refusal is never their first experience.
- The named constraint must be a domain shape (an aggregate / boundary / consistency rule), NOT a bare
  table / endpoint / library. If it is a pure stack-shape, re-ask toward the rule beneath it.

## STAGE 4 — EMIT + VALIDATE

Assemble the task string with the **named constraint FIRST**, then actor, boundary, stack. Emit through
the validator-gated writer — it fails closed and writes no folder if the constraint slot is empty:

```bash
# pseudo: import { emit } from "$DISCOVER_SKILL_ROOT/Tools/emit"
# emit({ researchRoot: getMemorySubdir('RESEARCH'), name, taskString, brief, lockedDecisions,
#         capabilitySelection, buildOrder, advisories })
```

The folder lands at `MEMORY/RESEARCH/{ts}_{name}/` with five files: `brief.md`, `locked-decisions.md`
(carrying any staleness advisory), `capability-selection.md`, `build-order.md`, and `task-string.md`.

## Output

1. The **GROUND status line** (proof the fork was read).
2. The emitted **`MEMORY/RESEARCH/{ts}_{name}/` path** (the rich selection record).
3. The next step: `/forge MEMORY/RESEARCH/{ts}_{name}/` — forge detects the record and SKIPs Tier 1.
