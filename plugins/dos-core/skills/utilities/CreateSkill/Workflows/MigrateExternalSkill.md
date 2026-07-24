---
name: Migrate External Skill
description: Convert an external skill (e.g., from open-design or similar AI-skills collections) into a DOS Pack. Three tiers — Stub (Strategy-B curated-pointer per RFC-0107), Template (HTML-template skills), and FullImpl (real capability skills). All tiers enforce ValidateSkill + sync-check. Tiers 2-3 require a Capability Delegation Map entry.
status: STABLE
---

# MigrateExternalSkill Workflow

Convert an external skill into a DOS Pack. Authored 2026-05-19 as part of the open-design → DOS Packs migration to close the loop between the Phase 1 bespoke chain and the canonical CreateSkill discipline.

## Step 1: Classify the migration tier

External skills fall into three tiers based on their capability surface. Pick ONE:

| Tier | Use when | Scaffolding path | Effort |
|---|---|---|---|
| **Stub** | The skill is an external reference — body lives upstream, DOS pack just exposes discoverability + extension.yaml | **Bespoke chain** (steps in §3 below) | 5-10 min |
| **Template** | The skill is mostly HTML/CSS/asset templates — operator-facing UI is the deliverable | **CreateSkill workflow** + Templates/ migration | 30-45 min |
| **FullImpl** | The skill carries real logic (scripts, Workflows, Agents) and a genuine capability surface | **CreateSkill workflow** + full port | 1-3 hours |

If unsure, default to one tier higher than your first instinct. Under-tiered migrations skip discipline; over-tiered migrations are merely slower.

## Step 2: Capability Delegation Map (Tier 2-3 ONLY)

Tier 2 and Tier 3 migrations are full DOS skills with capability surface. They MUST identify which existing DOS skills they delegate to BEFORE scaffolding begins.

Default delegate table (extend per skill class):

| External-skill capability | Default DOS delegate | Invocation |
|---|---|---|
| Image generation | **Media** | `Skill("media", "generate image of {prompt}")` |
| AI video | **Media** | `Skill("media", "create video from {prompt or image}")` |
| Image editing | **Media** | `Skill("media", "edit image at {path}: {operation}")` |
| Diagrams / infographics | **Media** | `Skill("media", "diagram: {description}")` |
| Brand identity | **Brand** | `Skill("brand", "generate logo for {context}")` |
| Design system / shadcn | **DesignSystem** | `Skill("design-system", "build component {Name}")` |
| Research / docs | **Research** + **Ref** | `Skill("research", "...")` / `Skill("ref", "...")` |
| Animated pet / spritesheet | **HatchPet** | `Skill("hatch-pet", "...")` |
| Multi-vendor LLM inference | **OpenRouter** | `Skill("openrouter", "...")` |
| Speech / TTS / music | **Media** | `Skill("media", "speech: {text}")` |
| Custom-model inference | (D5 follow-up adapter) | see `MEMORY/RESEARCH/2026-05/dos-integration-adapter-pattern.md` |

**Mandatory output:** the new skill's `Workflows/{Name}.md` Step 1 MUST contain a `## Delegates To` block listing each DOS delegate with a one-line justification. Skills that genuinely need no delegate write `## Delegates To: none` explicitly — silence is not the same as a verified-no-delegate.

**Anti-pattern:** porting an external skill's image-gen code wholesale instead of delegating to Media. If you find yourself copying a `$imagegen` resolver, stop and route through Media. Same for any other capability in the table above.

## Step 3: Scaffold per tier

### Tier 1 (Stub) — bespoke chain

```bash
mkdir -p Packs/{Name}/src
bun GenerateWithPartials.ts --use-partials --pack {Name} --description "{converted}" --visibility beta --out Packs/{Name}/src/SKILL.partials.md
bun dos-build.ts skill Packs/{Name}/src
bun scaffold-pack-docs.ts --pack {Name}
```

Then hand-author:
- `plugin.json` — minimal: `{"name":"{Name}","dos":{"bridge":[]}}`
- `extension.yaml` — with `metadata.open_design.upstream` + `extension_id` + Strategy-B excludes block
- `.dos-sync-manifest.json` `pack_pairs` entry — extension-only `exclude` block

### Tier 2-3 (Template / FullImpl) — CreateSkill workflow

```
Skill("utilities", "CreateSkill for {SkillName} — migrating from open-design with delegates {DelegateList}")
```

CreateSkill scaffolds the four-file pack (SKILL.md, plugin.json, extension.yaml, INSTALL/README/VERIFY) + Workflows/ + Intent-to-Flag tables + Examples + artifact tracking + R-rule conformance.

After CreateSkill returns:
- **Tier 2:** copy `example.html` → target-pack runtime-created `src/Templates/example.html`; copy `assets/*.html` → target-pack runtime-created `src/Templates/assets/*.html`; update `extension.yaml metadata.open_design.preview`; document live-preview loss in target-pack runtime-created `src/References/migration-notes.md`.
- **Tier 3:** port full implementation (Python/TS scripts → Tools/, Workflows → Workflows/, References → References/, Examples → Examples/, Agents → Agents/). Smoke-test at least one workflow end-to-end.

## Step 4: ValidateSkill (MANDATORY, all tiers)

```bash
bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --pack {Name}
```

Apply CanonicalizeSkill recommendations if any fire. Re-run until 0 findings. Operator directive 2026-05-17: no skill is accepted into a migration batch with open findings.

## Step 5: sync-check

```bash
bun ~/Durante/Tools/sync-check.ts
```

Must show `0 drift, 0 missing` before commit.

## Step 6: Commit

Per the migration plan (`Plans/Roadmaps/open-design-migration-master-2026-05.md`), commits are batched. Stage:
- `Packs/{Name}/` (full pack tree)
- `.dos-sync-manifest.json` (new `pack_pairs` entry)
- `Plans/Roadmaps/open-design-migration-master-2026-05.md` (status table update)

Conventional-commit subject: `feat(packs): migrate {Name} from open-design — Tier {N}` with body explaining delegates (Tier 2-3) or external reference (Tier 1).

## Step 7: Update master tracker

In `Plans/Roadmaps/open-design-migration-master-2026-05.md` status table, mark the skill complete. The Sentinel/Gate Keeper role owns this in the migration plan; under autonomous operation, the migrating agent updates it.

## Workflow Lineage

This workflow consolidates:
- Phase 1 bespoke chain from `Plans/Roadmaps/open-design-migration-master-2026-05.md` §4 (Tier 1)
- Phase 2/3 CreateSkill amendment from §6/§7 (Tier 2-3)
- §11.5 Capability Delegation Map (Tier 2-3 requirement)
- D5 amendment: Media as default image-gen delegate

Before this workflow existed (pre-2026-05-19), Tier 2/3 migrations used the Tier 1 mechanical chain, missing CreateSkill discipline. The Phase 4 documentation step (W18) closed the loop too late. This workflow closes it at authoring time.
