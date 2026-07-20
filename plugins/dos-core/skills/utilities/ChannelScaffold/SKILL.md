---
disable-model-invocation: true
name: ChannelScaffold
description: Scaffold a new Channel Voice skill — the meta-pattern behind Cockburn, Fowler, UncleBob, EricEvans, KentBeck, GregYoung, SandiMetz, Feathers, and Pragmatic. Given a parameterized author brief (voice name, primary corpus, voice tic, lookup name, lookup code prefix, council-seat eligibility) it stamps a DRAFT channel-skill from the channel-voice-skill template bundle and hands it to CreateSkill. USE WHEN channel scaffold, channel voice scaffold, new voice skill, mint a voice skill, scaffold a fowler-shaped skill, build a channel-an-author skill, voice skill scaffold, generate a channel skill, channel-voice family, list channel skills, channel voice catalog.
role: executor
accepts:
  - text
roots:
  - INSTALL
visibility: public
capabilities:
  - artifact.write
  - customization.cascade
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChannelScaffold/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


# ChannelScaffold

**Primary Purpose:** scaffold a new **Channel Voice** skill from a parameterized
Voice brief (a single author or a co-author pair speaking as one).

Channel Voice is the DOS meta-pattern behind 9 hand-authored Voice skills —
**Cockburn**, **Fowler**, **UncleBob**, **EricEvans**, **KentBeck**, **GregYoung**,
**SandiMetz**, **Feathers**, **Pragmatic**. Each captures a single Voice's
authentic reasoning in a fixed 6-artifact extraction bundle (QuoteBank + Principles
+ Lookup + StepAsideTable + Biography + SKILL contract).

**Canonical references:**

- `MEMORY/CANONICAL/channel-voice-pattern.md` — meta-pattern doctrine + reserved colors/icons + sibling peer routes + IP-safety stance.
- `Packs/utilities/src/CreateSkill/Templates/VoiceChannelingSkill.md` — the 447-LOC playbook this skill is the automation of. ChannelScaffold EXECUTES the playbook; the playbook has 9-run-tested wisdom (Step 2.5 manifest layer, Step 2.6 pack-root docs, voice-distinction worksheet, brand-voice pre-flight, anti-patterns).
- `Packs/utilities/src/CreateSkill/Templates/voice-channeling-ip-policy.md` — IP policy.

ChannelScaffold is **not** a generic skill scaffolder — that is `CreateSkill`.
ChannelScaffold is Channel-Voice-specific: it knows the pattern's shape, asks the
right parameterized brief, stamps the `channel-voice-skill` template bundle, and
hands the result to CreateSkill for the generic build mechanics.

Each captures a single Voice's authentic reasoning (where "Voice" can be one
author or a co-author pair speaking as one, per the canonical Ubiquitous Language).

**ChannelScaffold is also distinct from CrunchScaffold.** They are siblings, not
duplicates:

| Scaffolder | Family | Output |
|---|---|---|
| **ChannelScaffold** (this) | Channel Voice | single-author 6-artifact bundle |
| **CrunchScaffold** | Surface Crunch | bifocal-Surface ranked Tiering skill |

## What it produces — a DRAFT, by design

ChannelScaffold stamps the Channel Voice *structure* and itemises the *judgment
work* — it never invents quotes or principles. The output is:

1. A **draft skill** in pack source `Packs/utilities/src/${VOICE_NAME}/` —
   skeleton with `[[VERBATIM_QUOTE: source=<>, page=<>]]` markers where verbatim
   citations are required, and `[[FILL: ...]]` markers where domain knowledge is
   required.
2. A **`decisions-checklist.md`** enumerating the irreducible domain work
   (verbatim quote curation, principle naming, peer step-aside selection).
3. A **provenance header** in every stamped file (`minted-by: ChannelScaffold`,
   brief-hash, mint timestamp) so a minted family is greppable and retirable in
   one sweep.

The draft is **deliberately not runnable** until the checklist is worked. This is
the Council ruling (Evans + SandiMetz, 2026-05-21): a scaffolder that fabricates
quotes or paraphrases produces plausible-but-wrong Voice skills.

## Workflow Routing

| Workflow | Trigger | File |
|---|---|---|
| **Scaffold** | "channel-scaffold a ${AUTHOR}", "mint a voice skill for ${AUTHOR}", "build a fowler-shaped skill for ${AUTHOR}" | `Workflows/Scaffold.md` |
| **Catalog** | "list channel skills", "channel voice family", "channel voice catalog", "what voice skills exist" | `Workflows/Catalog.md` |

**Default:** a request to *create* a Channel Voice skill routes to **Scaffold**; a
request to *inspect* the family routes to **Catalog**.

## Examples

**Example 1: Scaffold a new channel skill (Brooks)**
```
Operator: "Channel-scaffold a Brooks skill — corpus: The Mythical Man-Month and
           No Silver Bullet. Voice tic: I. Lookup: Brooks's Laws. Code prefix: BROOKS."
→ Routes to Workflows/Scaffold.md
→ Validates 6 required brief fields
→ Discovery-first probe confirms no existing instance
→ Stamps channel-voice-skill bundle → draft Packs/utilities/src/Brooks/
→ Emits decisions-checklist.md with verbatim-quote markers + IP-safety phases
→ Hands draft to CreateSkill (dos-build, lint, sentinel)
→ Operator gets a draft Voice skill + a checklist of the 4-8h quote curation work left
```

**Example 2: Decline — author corpus is too thin**
```
Operator: "Channel-scaffold a Bob-on-Twitter skill — corpus: 50 tweets."
→ Scaffold workflow's fit-check fails (no ≥50 verbatim citations in publishable corpus)
→ Skill DECLINES with reason; routes operator to a custom Agent compose instead
→ No draft written
```

**Example 3: Inspect the family**
```
Operator: "What Channel Voice skills exist?"
→ Routes to Workflows/Catalog.md
→ Reads channel-voice-pattern.md + greps skills/ for the provenance header
→ Returns the instance table: Cockburn, Fowler, UncleBob, Evans, Beck, Young, Metz, Feathers, Pragmatic, + any minted
```

## Sibling pattern

ChannelScaffold is the **scaffolder** of the Channel Voice family; the 9 existing
author-skills are its **instances**. ChannelScaffold composes — never duplicates —
`CreateSkill` for the generic skill-construction mechanics (`dos-build.ts`,
`scaffold-pack-docs.ts`, `lint-skills.ts`, Sentinel).

## Artifact Tracking

**MANDATORY for any workflow in this skill that writes output files via the Write tool.**

After writing any output file, resolve the ARTIFACTS path and append a JSONL log entry:

```bash
if [ -d "${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS"
elif [ -d "$(pwd)/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="$(pwd)/MEMORY/ARTIFACTS"
else
  ARTIFACTS_DIR="$HOME/.claude/MEMORY/ARTIFACTS"
fi
mkdir -p "$ARTIFACTS_DIR"

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"ChannelScaffold","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/utilities/ChannelScaffold/` — live install
2. `Releases/v0.0.16/.claude/skills/utilities/ChannelScaffold/` — submodule
3. `Packs/utilities/src/ChannelScaffold/` — pack source
4. `Packs/agents/ChannelScaffold/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
