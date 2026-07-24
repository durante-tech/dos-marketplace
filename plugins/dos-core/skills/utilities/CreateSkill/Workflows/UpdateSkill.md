---
name: Update Skill
description: Modify or add workflows to an existing skill while maintaining canonical structure (RFC-0011 4-file contract + RFC-0002 extension manifest + RFC-0006 partials). Pack source is the source of truth.
status: STABLE
---

# UpdateSkill Workflow

**Purpose:** Add workflows, modify triggers, or update an existing skill while maintaining the canonical pack structure.

## Step 1: Read the Authoritative Sources

**REQUIRED FIRST:**

1. Read `~/.claude/DOS/SkillSystem.md` (canonical structure)
2. Read `~/.claude/skills/research/SKILL.md` (canonical example)
3. Read this skill's pack-root README at `Packs/<SkillName>/README.md` (operator-facing description)

---

## Step 2: Identify the Pack-Source Path (CRITICAL)

**Pack source is the source of truth — NEVER edit live install (`~/.claude/skills/<X>/`) directly.**

```bash
# Top-level pack (most cases):
PACK_SRC="$HOME/Durante/Packs/<SkillName>/src"

# Sub-pack under Utilities family:
PACK_SRC="$HOME/Durante/Packs/utilities/src/<SkillName>"
```

Read the current SKILL.md from pack source:

```bash
cat "$PACK_SRC/SKILL.md"
```

Note whether the skill uses `SKILL.partials.md` (RFC-0006 partials-mode) or has inlined SKILL.md only (legacy-inlined per RFC-0006 §5.2c).

---

## Step 3: Understand the Update

What needs to change?

- Adding a new workflow file under `Workflows/`?
- Modifying the description / triggers in SKILL.md frontmatter?
- Adding a new tool under `Tools/`?
- Updating documentation (README.md / INSTALL.md / VERIFY.md at pack root)?
- Adding handlers/gates to extension.yaml (RFC-0002)?
- Declaring new bridge actions in plugin.json (RFC-0004 §6.1)?

---

## Step 4: Make Changes (Pack Source ONLY)

### To Add a New Workflow

1. **Determine TitleCase name:**
   - ✓ `Create.md`, `UpdateDaemonInfo.md`, `SyncRepo.md`
   - ✗ `create.md`, `update-daemon-info.md`, `SYNC_REPO.md`

2. **Scaffold the workflow file via the canonical generator** (avoids the empty-touch antipattern that allowed MakerkitTeam-style misses to ship):
   ```bash
   # Non-CLI workflow
   bun ~/Durante/Tools/scaffold-workflow.ts --pack <SkillName> --workflow <WorkflowName>

   # CLI-shelling workflow (auto-includes ## Intent-to-Flag Mapping per R14)
   bun ~/Durante/Tools/scaffold-workflow.ts --pack <SkillName> --workflow <WorkflowName> --has-cli
   ```
   The tool reads pack frontmatter and emits the canonical body shape (Voice + Steps + (Intent-to-Flag if `--has-cli`) + Output). Refuses overwrite without `--force`.

3. **Add entry to `## Workflow Routing` section in SKILL.md (or SKILL.partials.md if partials-mode):**
   ```markdown
   | **NewWorkflow** | "new trigger" | `Workflows/NewWorkflow.md` |
   ```

4. **Customize the workflow content** — replace the scaffolded placeholder Steps with the actual logic.

5. **Update `metadata.workflows[]` in `src/extension.yaml`** (RFC-0002 — list each new workflow path).

### To Update Description / Triggers

Modify the single-line `description` in SKILL.md frontmatter (or SKILL.partials.md):

```yaml
description: [What it does]. USE WHEN [updated intent triggers using OR]. [Capabilities].
```

### To Add a Tool

```bash
touch "$PACK_SRC/Tools/<ToolName>.ts"
touch "$PACK_SRC/Tools/<ToolName>.help.md"
```

If the tool invokes `mempalace_bridge.py <action>`, add the action to `plugin.json`:

```json
{
  "name": "<SkillName>",
  "dos": {
    "bridge": ["existing_action", "new_action"]
  }
}
```

R9 lint will fire WARN/ERROR if `dos.bridge[]` is stale (declared but not invoked) or undeclared (invoked but not declared). Provider packs that export a full bridge surface use `dos.bridgeSurface[]`; ordinary skills do not.

### To Update Pack-Root Distribution Docs

If the change affects user-facing docs (new workflow, new install steps, new verification check):

```bash
# Re-run the scaffolder with --force to regenerate from updated SKILL.md/extension.yaml/plugin.json
bun ~/Durante/Tools/scaffold-pack-docs.ts --pack <SkillName> --force
```

This regenerates `INSTALL.md`, `README.md`, `VERIFY.md` from the updated source-of-truth files. Hand-tuned narrative in those files is overwritten — restore by re-applying the diff.

---

## Step 5: Rebuild SKILL.md from Partials (if partials-mode)

If the skill has `SKILL.partials.md`:

```bash
bun ~/Durante/Tools/dos-build.ts skill "$PACK_SRC"
```

This regenerates `SKILL.md` from `SKILL.partials.md` and writes it to all 3 copies (live, submodule, pack-source). The `<!-- generated-from: SKILL.partials.md ... -->` banner confirms regeneration.

---

## Step 6: Sync Pack Source to Live

```bash
bun ~/Durante/Tools/sync-pack-to-live.ts --pack <SkillName>
```

This propagates new files in pack source to live install. **It does NOT overwrite live files that differ** — pass `--update` only after reviewing.

---

## Step 7: Verify with R11 + R12 + R13 + R14

**MANDATORY — pre-commit Gates 12 + 13 + 14 enforce these.**

```bash
# R11 — required pack-manifest files (plugin.json + src/extension.yaml + src/SKILL.md)
bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --rule R11 --pack <SkillName>

# R12 — required pack-root distribution docs (INSTALL.md + README.md + VERIFY.md)
bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --rule R12 --pack <SkillName>

# R13 — SKILL.md `## Examples` body section with ≥2 concrete patterns
bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --rule R13 --pack <SkillName>

# R14 — Workflows shelling out to CLI must include `## Intent-to-Flag Mapping` table
bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --rule R14 --pack <SkillName>

# R15 — src/CHANGELOG.md presence + SKILL.md `**Status:** vX.Y.Z` ↔ latest CHANGELOG version match
bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --rule R15 --pack <SkillName>

# All five (default — runs R11 + R12 + R13 + R14 + R15 together)
bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --pack <SkillName>
```

All must report 0 findings before commit.

**Pre-edit nudge — version coupling (R15):** When the body change is non-trivial (new workflow, behavior change, breaking refactor, deprecation), bump BOTH:

1. `**Status:** vX.Y.Z` line in `./src/SKILL.md` (or `./src/SKILL.partials.md` if generated)
2. New `## vX.Y.Z — YYYY-MM-DD` entry at the TOP of `./src/CHANGELOG.md`

R15 catches the drift class where one is bumped without the other. Skip the bump only for cosmetic edits (typo fix, formatting). The lint surfaces the gap as a WARN — Gate 14 emits it on commit.

---

## Step 8: Verify with full skill linter

```bash
bun ~/Durante/Tools/dos-toolchain/lint-skills.ts          # R11 + R12 + R13 + R14 tree-wide
bun ~/Durante/Tools/sync-check.ts                          # four-copy parity
```

The lint-skills.ts driver runs R11-R14 (manifest + body) tree-wide. The R1-R10 surface (frontmatter, body sections via per-SKILL.md walk, banned vocab, partial freshness, bridge drift) is exercised through the per-pack invocation when `--pack <X>` is passed.

---

## Step 9: Final Checklist

### Naming
- [ ] New workflow files use TitleCase
- [ ] New tool files use TitleCase
- [ ] Routing table names match file names exactly

### Frontmatter
- [ ] YAML still has single-line description with `USE WHEN`
- [ ] No separate `triggers:` or `workflows:` arrays in YAML
- [ ] `visibility:` set to `public` | `internal` | `beta`

### Manifests (RFC-0002 + RFC-0011 + RFC-0004)
- [ ] `src/extension.yaml` updated with new workflows in `metadata.workflows[]`
- [ ] `plugin.json` `dos.bridge[]` matches actual MemPalace bridge invocations
- [ ] Provider-only: `plugin.json` `dos.bridgeSurface[]` matches exported bridge actions
- [ ] R11 lint clean: `bun lint-skills.ts --rule R11 --pack <X>` exit 0

### Distribution docs (Packs/README.md 4-file contract)
- [ ] `INSTALL.md` reflects current src/ tree (re-scaffold via `scaffold-pack-docs.ts --force` if structure changed)
- [ ] `README.md` reflects current capabilities + workflow routing
- [ ] `VERIFY.md` reflects current files
- [ ] R12 lint clean: `bun lint-skills.ts --rule R12 --pack <X>` exit 0

### Body (R13 + R14 — pre-commit Gate 14)
- [ ] `## Workflow Routing` section present (R5)
- [ ] All workflow files have routing entries
- [ ] All routes point to existing files
- [ ] **`## Examples` section present with ≥2 concrete usage patterns** (R13)
- [ ] **All CLI-shelling workflows include `## Intent-to-Flag Mapping` tables** (R14) — generate via `scaffold-workflow.ts --pack <X> --workflow <Name> --has-cli`
- [ ] R13 lint clean: `bun lint-skills.ts --rule R13 --pack <X>` exit 0
- [ ] R14 lint clean: `bun lint-skills.ts --rule R14 --pack <X>` exit 0
- [ ] **NEVER flatten sub-skill hierarchies** — preserve sub-pack structure for complex packs (Utilities/CreateSkill etc.)

### Version coupling (R15 — SKILL.md Status ↔ CHANGELOG version)
- [ ] If the body change is non-trivial, **`**Status:** vX.Y.Z`** line in SKILL.md bumped
- [ ] Matching **`## vX.Y.Z — YYYY-MM-DD`** entry prepended to `./src/CHANGELOG.md`
- [ ] R15 lint clean: `bun lint-skills.ts --rule R15 --pack <X>` exit 0

### Project-Level Path Compliance
- [ ] No hardcoded `~/.claude/MEMORY/` paths in workflow files (use the project-level resolution block from CreateSkill.md Step 10)
- [ ] STATE, VOICE, RELATIONSHIP paths remain global (by design)

### Artifact Tracking Compliance
- [ ] If skill writes output files, `## Artifact Tracking` section present (CreateSkill.md Step 11)
- [ ] Uses resolved `$ARTIFACTS_DIR`, not hardcoded `~/.claude/MEMORY/ARTIFACTS/`

### Agent Composition Compliance

**Step 1: Detect agent spawning** (CreateSkill.md Step 12 has full detail).

```bash
grep -rl "Agent tool\|subagent_type\|Task(\|parallel.*agent\|launch.*agent\|spawn.*agent\|council\|debate" "$PACK_SRC/" 2>/dev/null
```

**Step 2: Classify by pattern.** Persona agents → integrate `~/.claude/skills/agents/Partials/TraitComposition.md`.

---

## Step 10: Ecosystem Re-registration

If the update changed triggers, description, or added new workflows:

1. **Update MemPalace drawer** — re-register the skill's purpose and triggers in the wing's `skills` room
2. **Run `/sentinel scan`** — pick up any new conventions

See CreateSkill.md Step 9 for full ecosystem integration details.

---

## Step 11: Commit

Pre-commit gates that fire:

- **Gate 1** (sync-check): four-copy parity
- **Gate 6** (lint-skills R9/R10): bridge drift
- **Gate 12** (R11): required pack-manifest files
- **Gate 13** (R12): required pack-root distribution docs
- **Gate 14** (R13 + R14): SKILL.md `## Examples` + Workflows `## Intent-to-Flag Mapping`

If any blocks, address per the gate's error message before bypass.

---

## Done

Skill updated while maintaining canonical structure, manifests, distribution docs, and body content. All R1-R14 lint rules pass. Pre-commit Gates 12 + 13 + 14 will accept the change.
