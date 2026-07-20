---
name: Scaffold
description: Stamp a new Surface Crunch skill from the surface-crunch-skill template bundle.
status: STABLE
---

# Scaffold Workflow

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the Scaffold workflow in the CrunchScaffold skill to stamp a new Surface Crunch skill"
```

Running the **Scaffold** workflow in the **CrunchScaffold** skill...

Stamps a new **Surface Crunch** skill from the `surface-crunch-skill` template bundle.
Pattern doctrine: `MEMORY/CANONICAL/surface-crunch-pattern.md`. Bundle:
`~/.claude/DOS/Scaffolds/surface-crunch-skill/` (see its `_USAGE.md`).

**Trigger:** "scaffold a surface crunch skill", "new research-package skill", "build a
DOSUpgrade-shaped skill for X".

---

## Step 1: Collect the domain brief

A Surface Crunch is parameterized. Collect these fields — from the operator's request
where stated, inferred and surfaced as a decision artifact where not:

| Field | Meaning | Required |
|---|---|---|
| `skill_name` | TitleCase name of the new skill | yes |
| `domain` | One-line description of what it crunches | yes |
| `bifocal` | `yes` \| `inward-only` \| `outward-only` | yes |
| `inward_surfaces` | Self/context sources (omit if `outward-only`) | conditional |
| `outward_surfaces` | External sources (omit if `inward-only`) | conditional |
| `tier_count` | Number of priority Tiers | yes (default 4) |
| `tier_labels` | Ordered Tier labels | yes (default 🔴 CRITICAL, 🟠 HIGH, 🟡 MEDIUM, 🟢 LOW) |
| `fan_out` | Max parallel extraction Threads per Surface | yes (default 6) |

## Intent-to-Flag Mapping

Translate the operator's natural-language request into brief parameters:

### Bifocal mode
| User says | `bifocal` |
|---|---|
| "compares us against X", "our position vs the market" | `yes` |
| "monitors external sources", "watches what's out there" | `outward-only` |
| "mines our own X", "looks at our reflections / corpus" | `inward-only` |

### Tiering
| User says | `tier_count` / `tier_labels` |
|---|---|
| (default), "priority tiers" | `4` / 🔴 CRITICAL, 🟠 HIGH, 🟡 MEDIUM, 🟢 LOW |
| "just a ranked list", "two buckets" | operator-specified count + labels |

### Fan-out
| User says | `fan_out` |
|---|---|
| (default) | `6` |
| "lightweight", "few sources" | `3` |
| "deep sweep", "many sources" | `8`-`12` (mind tier max-parallel-agents) |

If a required field cannot be inferred, present the inferred brief as a decision
artifact and confirm with the operator before stamping (Algorithm DECISION ARTIFACT
RULE).

## Step 2: Fit-check (decline gate)

Surface Crunch applies ONLY when the task is "enumerate a wide Surface → parallel
extraction → ranked, prioritized output". DECLINE — and route to `CreateSkill`
(generic) — if: there is no enumerable Surface, the output is a single answer, or it
is a linear transform. Record the decline per Algorithm §4.2 Decline Protocol.

## Step 3: Discovery-first probe

Before stamping, probe for collision:
```bash
ls ~/.claude/skills/utilities/${skill_name} 2>/dev/null
grep -rl "minted-by: CrunchScaffold" ~/.claude/skills/utilities/ 2>/dev/null
```
If `${skill_name}` already exists, OR an existing Surface Crunch instance already
covers `${domain}`, STOP and surface the collision. Do not overwrite.

## Step 4: Stamp the bundle

Follow `~/.claude/DOS/Scaffolds/surface-crunch-skill/_USAGE.md` "Stamping order". Each
brief field maps to the uppercased placeholder token — `skill_name` → `${SKILL_NAME}`,
`domain` → `${DOMAIN}`, `bifocal` → `${BIFOCAL}`, and so on.

1. Compute provenance: `${FACTORY_VERSION}` (this skill's version), `${BRIEF_HASH}`
   (short hash of the serialized brief), `${TS_UTC}` (`date -u`, captured once).
2. Substitute every `${...}` placeholder across the five stamped templates. A
   correctly stamped draft has **zero `${...}` tokens left**.
3. Resolve the `${BIFOCAL}` gate in `Survey.workflow.template`: delete the
   `<!-- BIFOCAL-GATE:inward -->` block when `outward-only`; delete the
   `<!-- BIFOCAL-GATE:outward -->` block when `inward-only`; keep both when `yes`.
4. Write the draft into pack source `Packs/utilities/src/${skill_name}/` —
   `SKILL.partials.md`, `Workflows/Survey.md`, `sources.json`, `State/README.md`.
   Retain `[[FILL: ...]]` markers — they are the operator's domain work.

## Step 5: Emit the decisions-checklist

Stamp `decisions-checklist.template.md` → `Packs/utilities/src/${skill_name}/decisions-checklist.md`.
Verify: every `[[FILL: ...]]` marker in the draft has a matching checklist line.

## Step 6: Stop — do not build the draft yet

The draft carries `[[FILL: ...]]` markers. Building it now (`dos-build.ts`) would ship
those markers into the SKILL.md. **Do not run `dos-build.ts`, lint, or `/sentinel scan`
at scaffold time.**

CrunchScaffold composes — never reimplements — `CreateSkill`. Once the operator has
worked `decisions-checklist.md` and every `[[FILL]]` marker is resolved, the build is a
single delegation: run `CreateSkill/Workflows/CreateSkill.md` Steps 5–12 against
`Packs/utilities/src/${skill_name}/` — that owns `dos-build.ts`, `lint-skills.ts`,
Utilities routing-table registration, `/sentinel scan`, and four-copy sync. Do not
re-spell those steps here.

## Step 7: Report to the operator

Surface: the draft path, the provenance header values, and the `decisions-checklist.md`
contents. State plainly that the skill is a **draft** — not runnable until the
checklist is worked. The first checklist-completed skill is instance #4 of the family
and a falsification test of the pattern (see bundle `_USAGE.md`).

## Artifact Tracking

After writing the draft, log to `MEMORY/ARTIFACTS/artifacts.jsonl` per the skill's
Artifact Tracking section (`type: "skill-draft"`).
