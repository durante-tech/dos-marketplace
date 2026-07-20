---
name: Canonicalize Skill
description: Restore an existing skill to the canonical structure (R1-R12 clean + 4-file pack-distribution contract + RFC-0002 extension manifest + RFC-0006 partials toolchain). Adds missing manifests via scaffold-pack-docs.ts and inferred templates.
status: STABLE
---

# CanonicalizeSkill Workflow

**Purpose:** Restructure an existing skill to match the canonical format — fix lint findings (R1-R12), add missing manifest files (plugin.json + src/extension.yaml), add missing distribution docs (INSTALL.md + README.md + VERIFY.md), enforce TitleCase + frontmatter shape.

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the CanonicalizeSkill workflow in the CreateSkill skill to restructure skill"
```

Running the **CanonicalizeSkill** workflow in the **CreateSkill** skill to restructure skill...

---

## Step 1: Read the Authoritative Sources

**REQUIRED FIRST:**

1. `~/.claude/DOS/SkillSystem.md` — canonical structure
2. `Packs/README.md` — 4-file pack-distribution contract
3. Run `ValidateSkill` workflow first to identify what's missing

---

## Step 2: Identify the Pack Type

```bash
# Top-level pack (most cases)
TOP_LEVEL_PATH="$HOME/Durante/Packs/<SkillName>"

# Sub-pack (Utilities family only)
SUB_PACK_PATH="$HOME/Durante/Packs/utilities/src/<SkillName>"
```

**Sub-packs share the parent's plugin.json + INSTALL.md + README.md + VERIFY.md**, so canonicalization is narrower for them (only R1-R10 apply, no manifest creation).

---

## Step 3: Backup

```bash
PACK_ROOT="$TOP_LEVEL_PATH"  # or $SUB_PACK_PATH
BACKUP="$HOME/.claude/Backups/canonicalize-<SkillName>-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"
cp -r "$PACK_ROOT" "$BACKUP/"
echo "Backed up to: $BACKUP"
```

**Backups go to `~/.claude/Backups/`, NEVER inside skill directories.**

---

## Step 4: Run Lint to Identify All Findings

```bash
bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --pack <SkillName>
```

Expected output: list of R11 + R12 + R13 + R14 findings (top-level packs).

For per-SKILL.md rules R1-R10, the same command surfaces them when invoked with `--pack <X>`. Tree-wide pass (no `--pack`) covers all packs:

```bash
bun ~/Durante/Tools/dos-toolchain/lint-skills.ts
```

Triage findings into:

- **Manifest layer missing** (R11): `plugin.json` / `src/extension.yaml` / `src/SKILL.md` absent
- **Distribution docs missing** (R12): `INSTALL.md` / `README.md` / `VERIFY.md` absent
- **Body sections missing** (R13): `## Examples` heading absent OR fewer than 2 example blocks
- **CLI Intent-to-Flag missing** (R14): workflow shells out to CLI but lacks `## Intent-to-Flag Mapping` table
- **Frontmatter shape violations** (R3, R4, R8): name / description / visibility missing
- **Other body section violations** (R1, R2, R5): customization / voice / workflow-routing missing
- **Naming violations**: TitleCase + workflow-routing-vs-file mismatch
- **Bridge drift** (R9, R10): undeclared invocations or prohibited names

---

## Step 5: Add Missing Manifest Layer (R11)

### If `plugin.json` is missing

Determine bridge actions via static analysis of pack body:

```bash
grep -rE "mempalace_bridge\.py\s+([a-z_]+)" "$PACK_ROOT/src/" 2>/dev/null \
  | grep -oE "mempalace_bridge\.py\s+([a-z_]+)" | awk '{print $2}' | sort -u
```

If zero invocations: write a zero-bridge plugin.json.

```bash
cat > "$PACK_ROOT/plugin.json" <<JSON
{
  "name": "<SkillName>",
  "dos": {
    "bridge": []
  }
}
JSON
```

Otherwise, list each invoked action in the bridge array.

### If `src/extension.yaml` is missing

Use the RFC-0002 minimal template (model after `Packs/brand/src/extension.yaml`):

```yaml
extension_id: <name-lowercase>/core
version: 1.0.0
protocol_version: ^1.0.0
schema: dos-extension/v1
conformance_profile: minimal

contributes: {}

requires: {}

metadata:
  pack: <SkillName>
  invocation: user                # or routine for cadenced skills
  skill_path: ./SKILL.md
  roots:
    - <from SKILL.md frontmatter `roots:`>
  workflows:
    - Workflows/<each-file>.md
  runtime_effects:
    - artifact_log_append
  phase_2_migration: true
```

Populate `metadata.workflows[]` from `ls $PACK_ROOT/src/Workflows/`.

### If `src/SKILL.md` is missing

This is structurally broken — author SKILL.md from scratch via CreateSkill workflow Step 5 (or 5b for legacy-inlined mode).

---

## Step 6: Add Missing Distribution Docs (R12)

```bash
bun ~/Durante/Tools/scaffold-pack-docs.ts --pack <SkillName>
```

The scaffolder reads SKILL.md frontmatter + lists src/ tree + reads plugin.json → emits `INSTALL.md`, `README.md`, `VERIFY.md` from canonical templates.

Pass `--force` to overwrite existing partial drafts.

---

## Step 7: Handle SKILL.partials.md Divergence

If the skill has `SKILL.md` only (no `SKILL.partials.md`) AND the SKILL.md uses non-canonical voice/customization shape (e.g., voice-channeling skills with author persona):

```bash
# Check whether divergence is already documented
grep -l "<SkillName>" $HOME/Durante/MEMORY/ARCHIVE/RFC-0006/Phase3/Verification/slice-*-not-partializable*.md
```

If documented: leave inlined-mode in place (RFC-0006 §5.2c escape hatch).

If NOT documented: either (a) author `SKILL.partials.md` source via CreateSkill Step 5b OR (b) document the divergence at `MEMORY/ARCHIVE/RFC-0006/Phase3/Verification/slice-<N>-not-partializable-<context>.md` (see slice-9-not-partializable-voice-channeling.md precedent for the 9 voice-channeling skills).

---

## Step 8: Enforce TitleCase Naming

### Skill directory
- ✓ `Blogging`, `CreateSkill`, `Daemon`
- ✗ `createskill`, `create-skill`, `CREATE_SKILL`

### Workflow files
```bash
cd "$PACK_ROOT/src/Workflows/"
# Rename non-TitleCase files
# mv create.md Create.md
# mv update-info.md UpdateInfo.md
```

### Tool files
```bash
cd "$PACK_ROOT/src/Tools/"
# Rename if needed
# mv manage-server.ts ManageServer.ts
```

After renames, update `metadata.workflows[]` in `src/extension.yaml` and `## Workflow Routing` table in SKILL.md.

---

## Step 9: Enforce Flat Folder Structure (max 2 levels deep)

```bash
find "$PACK_ROOT/src/" -type d -mindepth 2 -maxdepth 3
```

Common violations:
- `./Workflows/Company/DueDiligence.md` -> `./Workflows/CompanyDueDiligence.md`
- `./Tools/Utils/Helper.ts` -> `./Tools/Helper.ts`

**Exception:** sub-packs under `Packs/utilities/src/` are intentional (`Utilities/src/CreateSkill/`, `Utilities/src/Browser/`, etc.) — preserve them.

---

## Step 10: Convert YAML Frontmatter to Canonical Form

**From old format (WRONG):**
```yaml
---
name: skill-name
description: |
  What the skill does.

triggers:
  - USE WHEN user mentions X

workflows:
  - USE WHEN user wants to A: Workflows/a.md
---
```

**To canonical (CORRECT):**
```yaml
---
name: SkillName
description: What the skill does. USE WHEN user mentions X OR user wants to A. Additional capabilities.
role: <role-enum>
accepts: [text]
visibility: public
roots: [PROJECT.WORK, PROJECT.ARTIFACTS]
---
```

Key changes:
- `name` in TitleCase
- Single-line `description` with embedded `USE WHEN`
- Drop `triggers:` and `workflows:` arrays (workflows move to body's `## Workflow Routing` table)
- Add `visibility:` (R8 ERROR if missing)
- Add `role:`, `accepts:`, `roots:` (per RFC-0011 + RFC-0024)

---

## Step 11: Add `## Workflow Routing` to Body

```markdown
## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **WorkflowOne** | "trigger phrase one" | `Workflows/WorkflowOne.md` |
| **WorkflowTwo** | "trigger phrase two" | `Workflows/WorkflowTwo.md` |
```

Workflow names MUST match file names exactly (TitleCase).

---

## Step 12: Add `## Examples` Section

REQUIRED — every skill needs **2-3 concrete usage patterns** per R13 (lint-enforced via Gate 14):

```markdown
## Examples

**Example 1: [Common use case]**
```
User: "[Typical request]"
→ Invokes WorkflowName workflow
→ [What skill does]
→ [What user gets back]
```

**Example 2: [Different use case]**
```
User: "[Another typical request]"
→ Invokes OtherWorkflow workflow
→ [What skill does]
→ [What user gets back]
```

**Example 3: [Third pattern]** (optional but encouraged for discoverability)
```
User: "[Edge or specialized request]"
→ [Process]
→ [Output]
```
```

Verify with: `bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --rule R13 --pack <SkillName>` — must report 0 findings.

---

## Step 12.5: Recover `## Intent-to-Flag Mapping` Tables (R14)

For each workflow under `src/Workflows/` that shells out to a CLI tool (any `bun *.ts`, `python3 *.py`, or `./*.{ts,sh,py}` invocation), the workflow MUST include a `## Intent-to-Flag Mapping` table per CreateSkill workflow Step 6.

**Detect missing Intent-to-Flag tables:**

```bash
bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --rule R14 --pack <SkillName>
```

**Remediate via the canonical generator (recommended):**

For each finding, regenerate the workflow with `--has-cli` and re-merge custom content:

```bash
# CAUTION: --force overwrites the existing workflow file. Backup first or hand-edit.
cp "$PACK_ROOT/src/Workflows/<WorkflowName>.md" "$BACKUP/<WorkflowName>.md.before-canonicalize"
bun ~/Durante/Tools/scaffold-workflow.ts --pack <SkillName> --workflow <WorkflowName> --has-cli --force

# Then merge the original Steps + content into the regenerated scaffold's Steps section.
diff "$BACKUP/<WorkflowName>.md.before-canonicalize" "$PACK_ROOT/src/Workflows/<WorkflowName>.md"
```

**Or hand-author** (if scaffolder regen would lose too much custom content): paste the canonical Intent-to-Flag block from `Templates/RegularSkill.md` "Workflow File Body" section into the workflow file just before the `## Output` section.

Verify post-fix: `bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --rule R14 --pack <SkillName>` — must report 0 findings.

---

## Step 13: Sync Pack Source to Live

```bash
bun ~/Durante/Tools/sync-pack-to-live.ts --pack <SkillName>
```

If the canonicalization moved files (renames), some live files may be orphaned. Manually clean live install:

```bash
ls -la "$HOME/.claude/skills/<SkillName>/"
# rm orphaned <old-name>.md files
```

---

## Step 14: Re-build SKILL.md from Partials (if applicable)

```bash
[ -f "$PACK_ROOT/src/SKILL.partials.md" ] && bun ~/Durante/Tools/dos-build.ts skill "$PACK_ROOT/src"
```

---

## Step 15: Final Verification

```bash
bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --pack <SkillName>
# Expected: 0 findings (R11 + R12 + R13 + R14)

bun ~/Durante/Tools/sync-check.ts --summary
# Expected: 0 drift, 0 missing
```

---

## Step 16: Ecosystem Re-registration

After canonicalization:

1. **Update MemPalace KG** — if skill name changed, update `has_skill` fact and drawer label
2. **Refresh MemPalace drawer** — purpose + triggers in wing's `skills` room
3. **Run `/sentinel scan`** — re-register conventions

See CreateSkill.md Step 9 for full ecosystem details.

---

## TitleCase Reference

| Type | Wrong | Correct |
|------|-------|---------|
| Skill directory | `createskill`, `create-skill` | `CreateSkill` |
| Workflow file | `create.md`, `CREATE.md` | `Create.md` |
| Multi-word workflow | `update-info.md`, `UPDATE_INFO.md` | `UpdateInfo.md` |
| Tool file | `manage-server.ts` | `ManageServer.ts` |
| Reference doc | `api-reference.md` | `ApiReference.md` |

---

## Internal-pack note

If the pack is `visibility: internal` (per RFC-0011 §6), AND the gitignore registration is missing:

```bash
bun ~/Durante/Tools/scaffold-internal-pack.ts <SkillName>
```

This adds the pack to the active release submodule's `.gitignore` (`Releases/<active-version>/.claude/.gitignore`) so its body stays out of `cc-durante-studio` main while preserving `extension.yaml` shell.

---

## Done

Skill matches canonical structure: R1-R12 lint clean, 4-file pack-distribution contract complete, frontmatter + body sections + TitleCase all valid. Ecosystem re-registered.
