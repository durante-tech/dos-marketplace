---
name: RunProgram
description: Conductor — run the full 7-phase growth program from project knowledge + a campaign subject
status: STABLE
divergence_from_canonical:
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "Bespoke Output section with workflow-specific shape (growth-program 7-phase pipeline emits per-phase document sets, not the canonical output shape)"
    rationale_link: null
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Hand-authored variant table over the real EmitProgram.ts flag surface; the canonical generator directive does not expand in workflow docs, so the table is maintained inline"
    rationale_link: null
bestPath:
  - title: "Resolve Inputs"
    description: "Mine the repo, brand assets, and MemPalace into a project-knowledge brief before asking the operator anything."
  - title: "Select a Preset"
    description: "Detect the archetype and pick the matching starting-hypothesis preset, confirmed with the operator."
  - title: "Scaffold the Program"
    description: "Deterministically emit the docs/growth/ skeleton with stable-ID tables for every phase to fill."
  - title: "Run the 7 Phases"
    description: "Execute BrandChannelStrategy through Coordination in order, each filling its own artifact."
  - title: "Council Gate & Finalize"
    description: "Convene the 5-seat council, run the integrity guard, and log every artifact — stop at drafts, never publish."
---

# RunProgram Workflow

## When to Use
- Trigger phrases: "run the growth program", "full program for X", "go-to-market for X".
- Situation: kicking off (or re-running) the entire end-to-end growth program from a campaign subject, not just one phase.
- NOT for running a single phase in isolation (e.g. just the calendar or just GEO) — route directly to that phase's workflow instead.

**Purpose:** The conductor. Runs the 7 phases in order, convenes the 5-seat council, applies the integrity
guard, and writes the `docs/growth/` program. Social presence + calendar + materials are first-class; GEO
is one pillar. **Never auto-publishes** — emits the program + the first material batch as drafts.

**Budget:** ~20–60 min, credits scale with research + materials volume.

## Orchestrator Contract

RunProgram is the **GTM orchestrator**. Its contract with the operator and the council roster
(`References/council-roster.md`) is fixed:

**Inputs** (detail in *Inputs* below)
- `subject` — the campaign wedge (required).
- Project-knowledge brief — mined from `sentinel` + brand assets + `mem-palace` before asking the operator.

**Outputs** (detail in *Output* below + the full `References/output-contract.md`)
- The `docs/growth/` program (7 artifacts) emitted as **drafts** — never auto-published.
- An integrity verdict stamped on `coordination.md` (SIGNED / PASS-WITH-QUARANTINE / BLOCK).

**Handoffs to the growth-* roster** — each phase is led by the seat(s) that own its artifact; seat
identities + the seat-to-seat handoff edges are canonical in `References/council-roster.md`:

| Phase / workflow | Lead seat(s) | Produces |
|---|---|---|
| 1 · BrandChannelStrategy | Strategist + Channel + Creative | `strategy.md` |
| 2 · CampaignCalendar | Strategist (`C*`) + Channel (placement) | `campaigns.md`, `content-calendar.md` |
| 3 · MaterialsEngine | Creative (REQUIRED gate) | `materials/` + production spec |
| 4 · PresenceOps | Channel (ops loop) | `social-media-plan.md` |
| 5 · GeoPillar | Strategist + Analyst | `geo/*` |
| 6 · Measurement | Analyst (both lenses) | `measurement.md` |
| 7 · Coordination | Skeptic (integrity sign-off) | `coordination.md` (RACI, `M*`, gate) |

The **Skeptic** verify pass is cross-cutting (runs against every phase) and gates the whole program — it is
never skipped, even under council degradation (`References/council-roster.md` → *Handoff contract*).

## Inputs
- `subject` — the campaign subject / wedge (required)
- Project knowledge — mined first from the repo (`sentinel`) + brand assets + `mem-palace`; ask the operator
  only for ICP, channels, cadence, locale, pricing if not derivable.

## Steps
1. **Resolve inputs.** Sentinel repo/SEO baseline + MemPalace recall + brand assets → a project-knowledge brief.
2. **Select a preset.** Detect the archetype from the brief via `References/archetype-selector.md`; pick the
   matching `Presets/*.yaml` and confirm with the operator (a preset is a starting hypothesis — the council
   still tunes every cell). No confident match → run preset-less.
3. **Scaffold the program (deterministic).** Run
   `bun ~/.claude/skills/growth-program/Tools/EmitProgram.ts --subject "<subject>" --preset <preset>` to write the `docs/growth/` skeleton —
   every artifact with its section template, stable-ID tables (C*/M*/P*/PH*/Q*), and the preset's
   channel/cadence/GEO pre-fill. The phases FILL this skeleton; they never re-invent its structure, and the
   templates stay out of context.
4. **Phase 1–7** in order, each its own workflow, filling its artifact:
   `BrandChannelStrategy` → `CampaignCalendar` → `MaterialsEngine` → `PresenceOps` → `GeoPillar` →
   `Measurement` → `Coordination`.
5. **Council gate.** Convene the 5-seat council (canonical roster + handoffs: `References/council-roster.md`)
   for a 3-round debate; resolve tensions; the Skeptic runs the integrity guard (`References/integrity-guard.md`).
6. **Finalize.** Confirm every skeleton file is filled per `References/output-contract.md`. **Artifact
   tracking:** each produced `docs/growth/` file is logged to `MEMORY/ARTIFACTS/artifacts.jsonl` — the DOS
   `ArtifactAutoLogger` hook captures writes automatically; for non-DOS installs pass
   `~/.claude/skills/growth-program/Tools/EmitProgram.ts --artifacts-log <path>`. STOP at the program + first material batch — never publish
   to live channels.

## Intent-to-Flag Mapping

Step 3 shells `bun ~/.claude/skills/growth-program/Tools/EmitProgram.ts`. Map operator intent → flags:

| Intent | Flag |
|---|---|
| "scaffold the program for `<subject>`" | `--subject "<subject>"` (required) |
| "use the `<archetype>` preset" / auto-detected archetype | `--preset <name>` (one of `Presets/*.yaml`) |
| "write it to `<path>`" | `--out <path>` (default `docs/growth`) |
| "re-scaffold / overwrite what's there" | `--force` |

## Output
The `docs/growth/` program (strategy, campaigns, content-calendar, materials/, social-media-plan, geo/*,
measurement, coordination). STOP at the program + first material batch — do not publish to live channels.
