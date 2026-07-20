# Regular Skill — Template

**Purpose:** Codify the standard pattern for non-voice-channeling skills (most DOS skills) so they ship with the canonical body shape, manifest layer, and distribution docs in one pass.

**Use when:** the user asks for a new skill that ISN'T a voice-channeling impersonation of a named author. (For voice-channeling, use `VoiceChannelingSkill.md` instead.)

**Skip when:** the request is for a voice-channeling skill, a sub-pack inside `Packs/utilities/src/`, or a runtime library (RFC-0001 §13 — those don't carry SKILL.md).

---

## The Lineage (canonical exemplars)

| Skill | Profile | Why it's canonical |
|---|---|---|
| **Research** | Researcher / multi-mode | Multi-mode skill with sub-pack hierarchy + extensive workflows; reference for Pattern 2 packs |
| **Brand** | Researcher / strategy | Frontmatter shape canon; minimal extension.yaml exemplar |
| **MemPalace** | Orchestrator / KG | Multi-bridge plugin.json exemplar; canonical customization |
| **ContextSearch** | Commands / search | Smallest viable skill (Commands type); single workflow + minimal Tools |

If the new skill maps to one of these archetypes, mirror its shape directly.

---

## One-Turn Delivery Pattern

Unlike voice-channeling (Turn 1 research vault → Turn 2 scaffold), regular skills usually have no "vault" prerequisite. The single turn is:

1. **sync-check baseline + memory recall** (single parallel batch)
2. **PRD stub** with 14-24 ISCs covering scaffold + ecosystem integration
3. **Single parallel batch:** invoke `GenerateWithPartials.ts` + author Workflows via `scaffold-workflow.ts` + create plugin.json + extension.yaml + scaffold pack-root docs (`scaffold-pack-docs.ts`)
4. **Lint** with R1-R14 (full surface) — all clean before commit
5. **Commit submodule first**, then `cd ~/Durante` and commit parent
6. **Reflection JSONL** appended at LEARN

---

## Canonical File Set (locked shape)

Every regular skill ships with this 7+-file set:

| File | Origin | Purpose |
|---|---|---|
| `Packs/<Name>/plugin.json` | hand-author or `scaffold-internal-pack.ts` for internal packs | RFC-0011 §5.2 distribution manifest |
| `Packs/<Name>/INSTALL.md` | `scaffold-pack-docs.ts` | AI-driven 5-phase install wizard |
| `Packs/<Name>/README.md` | `scaffold-pack-docs.ts` | User-facing description with frontmatter |
| `Packs/<Name>/VERIFY.md` | `scaffold-pack-docs.ts` | Post-install validation script |
| `Packs/<Name>/src/SKILL.md` | `dos-build.ts skill` (from partials) OR hand-authored | Routing + body |
| `Packs/<Name>/src/SKILL.partials.md` | `GenerateWithPartials.ts` | Partials source (default) |
| `Packs/<Name>/src/extension.yaml` | hand-author from RFC-0002 minimal template | Pack manifest (handlers, gates, slot_types, contributes) |
| `Packs/<Name>/src/Workflows/<W>.md` | `scaffold-workflow.ts` (one per workflow) | Workflow files |
| `Packs/<Name>/src/CHANGELOG.md` | hand-author from stub (see below) | Version chronology — anchored by R15 against SKILL.md `**Status:** vX.Y.Z` |

**CHANGELOG stub** (write at scaffold time when the pack ships any user-facing capability):

```markdown
# <Name> — Changelog

## v0.0.1 — YYYY-MM-DD

Initial scaffold.
```

Pair this with a `**Status:** v0.0.1 — <one-line description>` line in the SKILL.md body so R15 can verify they stay in sync. R15 fires WARN when SKILL.md Status drifts from the latest CHANGELOG `## vX.Y.Z` header. Pre-versioning packs (no Status, no CHANGELOG) skip R15 silently — adoption is gradual.
| `Packs/<Name>/src/Tools/<T>.ts` (optional) | hand-author | CLI tools per CliFirstArchitecture |

Total: 7 + N (workflows) + M (tools) files.

---

## SKILL.md Frontmatter (canonical)

```yaml
---
name: SkillName                       # PascalCase
description: [What it does]. USE WHEN [intent triggers using OR]. [Capabilities].
role: executor                        # advisor | analyzer | executor | orchestrator | researcher
accepts: [text]                       # text | code | design | etc.
icon: <LucideIconName>                # optional but recommended
colorVar: secondary
colorHex: "#xxxxxx"                   # optional but recommended for branded skills
tier: secondary                       # primary | secondary
category: <Category>                  # Engineering | Business | Personal | etc.
displayLabel: <DisplayName>
marketingDescription: <prose>
elevator: <one-line elevator pitch>
roots: [PROJECT.WORK, PROJECT.ARTIFACTS]   # RFC-0023 root scopes
visibility: public                    # public | internal | beta (R8 ERROR if missing)
artifact_tracking:                    # if skill writes output files
  enabled: true
  roots:
    - MEMORY/ARTIFACTS
  types:
    - report
    - summary
  log_path: MEMORY/ARTIFACTS/artifacts.jsonl
---
```

---

## SKILL.md Body Sections (mandatory shape)

```markdown
<!-- partial: _customization.md skill_name=<X> -->

# <X>

[1-2 sentence summary of what this skill does and when]

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Workflow1** | "trigger phrase" | `Workflows/Workflow1.md` |
| **Workflow2** | "another trigger" | `Workflows/Workflow2.md` |

## Examples

**Example 1: [Common use case]**
```
User: "[Typical user request]"
→ Invokes Workflow1 workflow
→ [What skill does]
→ [What user gets back]
```

**Example 2: [Another use case]**
```
User: "[Different request]"
→ [Process]
→ [Output]
```

<!-- partial: _artifact-tracking.md skill_name=<X> -->
<!-- partial: _four-copy-footer.md skill_name=<X> -->
```

**Required body sections (lint-enforced):**
- `## Customization` (R1) — provided by `_customization.md` partial
- `## Workflow Routing` (R5) — required if skill has workflows
- `## Examples` with ≥2 example blocks (R13)

(Voice notification was retired 2026-07-02 — R2 is gone and skills no longer carry a voice block.)

---

## Workflow File Body (mandatory shape)

> Completeness standard (2026-07-10, operator-directed): `description` non-empty, `bestPath`
> phases present, and a `## When to Use` section — the DeepInvestigation-class shape. Enforced
> warn-tier by lint R17; the scaffolder emits all three.

Each `Workflows/<Name>.md` should follow:

```markdown
---
name: WorkflowName
description: [What this workflow does — one faithful line; NEVER left empty]
status: STABLE
bestPath:
  - title: "[Phase 1]"
    description: "[What this phase accomplishes.]"
  - title: "[Phase 2]"
    description: "[What this phase accomplishes.]"
  - title: "[Phase 3]"
    description: "[What this phase accomplishes.]"
---

# WorkflowName Workflow

## When to Use

- User says "[trigger phrase from the SKILL.md routing table]"
- [The situation this workflow fits]
- NOT for [excluded case] (use [adjacent workflow])

## Steps

1. **Read context** — load relevant authoritative sources
2. **Determine inputs** — capture user intent
3. **Execute** — perform the action
4. **Surface results** — 1-2 sentence summary

## Intent-to-Flag Mapping  (REQUIRED if shelling out to CLI — R14)

| User Says | Flag | When to Use |
|-----------|------|-------------|
| "fast" | `--model haiku` | Speed |
| (default) | `--model opus` | Quality |

## Output

[Output shape]

## Done
```

**Required workflow sections (lint-enforced):**
- `## Intent-to-Flag Mapping` (R14) — REQUIRED if workflow shells out to `bun *.ts`, `python3 *.py`, or `./*.{ts,sh,py}`

Use `bun Tools/scaffold-workflow.ts --pack <X> --workflow <W> [--has-cli]` to generate this shape.

---

## Default Capabilities Selection

For most regular skills:

| Capability | Selected? | Reason |
|---|---|---|
| `Read`, `Write`, `Edit`, `Bash` | Yes | Primary scaffold work |
| `TaskCreate/Update` | Yes | Track scaffold steps |
| `Skill("code-review", "high")` | Yes if Tools/*.ts authored | Code-producing run gate |
| `Skill("thinking", "council")` | Conditional | If workflow naming, scope, or trade-offs warrant council |
| `Skill("code-review", "high")` post-EXECUTE | Yes if code | Quality scan |
| Agents (parallel) | Conditional | Only when ≥2 independent workstreams |

---

## ISC Template (regular-skill scaffold)

14-24 ISCs covering the live-skill scaffold:

```
Manifest layer (4):
- ISC-1: plugin.json created with correct dos.bridge[] declaration
- ISC-2: src/extension.yaml created from RFC-0002 minimal template
- ISC-3: src/SKILL.partials.md authored with full RFC-0011 frontmatter
- ISC-4: src/SKILL.md generated via dos-build.ts (or authored directly if inlined-mode)

Body (3):
- ISC-5: ## Workflow Routing table populated
- ISC-6: ## Examples section with 2-3 concrete patterns
- ISC-7: ## Customization via partials

Workflows (N — one per workflow):
- ISC-N: Workflows/<Name>.md authored (via scaffold-workflow.ts) with Steps + (Intent-to-Flag if CLI-shelling) + Output

Distribution docs (3):
- ISC-N+1: README.md generated via scaffold-pack-docs.ts
- ISC-N+2: INSTALL.md generated
- ISC-N+3: VERIFY.md generated

Lint + sync (4):
- ISC-N+4: bun lint-skills.ts (R1-R14) zero findings on this pack
- ISC-N+5: bun sync-check.ts exit 0 post-mirror
- ISC-N+6: Pre-commit gates 1, 6, 12, 13, 14 all green
- ISC-N+7: Pack mirrored to live install

Ecosystem (3):
- ISC-N+8: MemPalace KG `has_skill` registered
- ISC-N+9: Sentinel scan run
- ISC-N+10: Reflection JSONL appended at LEARN
```

---

## Anti-Patterns When Scaffolding (don't do these)

- **Don't `touch` workflow files.** Use `scaffold-workflow.ts` so the canonical body shape lands in the first draft.
- **Don't skip the manifest layer.** plugin.json + src/extension.yaml are R11 ERROR-equivalent (currently WARN during 14-day rollout). Authoring them after-the-fact creates remediation debt.
- **Don't skip the distribution docs.** R12 catches missing INSTALL/README/VERIFY at pack root.
- **Don't author SKILL.md without `## Examples`.** R13 catches this; the canonical pattern (Packs/README.md body convention) requires 2-3 concrete usage patterns.
- **Don't shell out to a CLI tool from a workflow without `## Intent-to-Flag Mapping`.** R14 catches this; the canonical pattern (CreateSkill workflow Step 6 + CliFirstArchitecture.md) requires natural-language → flag translation.
- **Don't hardcode `~/.claude/MEMORY/` paths in workflows.** Use the project-level resolution block from CreateSkill workflow Step 10.
- **Don't write code without invoking `Skill("code-review", "high")` post-EXECUTE.** It catches reuse, quality, and efficiency issues that pre-commit gates miss.
- **Don't commit submodule + parent in one shell session without `cd`.** Shell cwd persists across Bash tool calls — `cd ~/Durante` before parent commit (memory: `git-commit-cwd-in-submodule.md`).

---

## Quick Reference (cheat sheet)

```bash
# Setup paths
PACK_NAME=NewSkill
PACK_SRC=$HOME/Durante/Packs/$PACK_NAME/src

# Step 1 — sync-check baseline
bun $HOME/Durante/Tools/sync-check.ts

# Step 2 — generate SKILL.partials.md
bun $HOME/Durante/Packs/utilities/src/CreateSkill/Tools/GenerateWithPartials.ts \
  --use-partials \
  --pack $PACK_NAME \
  --description "<one-line description with USE WHEN clause>" \
  --role executor \
  --visibility public \
  --roots "[PROJECT.WORK, PROJECT.ARTIFACTS]" \
  --workflow "Run:run trigger:Workflows/Run.md" \
  --out $PACK_SRC/SKILL.partials.md

# Step 3 — build SKILL.md from partials
bun $HOME/Durante/Tools/dos-build.ts skill $PACK_SRC

# Step 4 — scaffold workflows
bun $HOME/Durante/Tools/scaffold-workflow.ts --pack $PACK_NAME --workflow Run --has-cli

# Step 5 — manifest layer
echo '{"name":"'$PACK_NAME'","dos":{"bridge":[]}}' > $HOME/Durante/Packs/$PACK_NAME/plugin.json
# (author src/extension.yaml from Brand exemplar)

# Step 6 — distribution docs
bun $HOME/Durante/Tools/scaffold-pack-docs.ts --pack $PACK_NAME

# Step 7 — verify
bun $HOME/Durante/Tools/dos-toolchain/lint-skills.ts --pack $PACK_NAME    # R11+R12+R13+R14
bun $HOME/Durante/Tools/sync-check.ts                                       # parity

# Step 8 — commit submodule + parent (cd back to ~/Durante)
```
