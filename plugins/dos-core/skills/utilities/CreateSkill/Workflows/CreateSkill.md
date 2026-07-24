---
name: Create Skill
description: Scaffold a new DOS skill with frontmatter, TitleCase naming, folder structure, and validation.
status: STABLE
---

# CreateSkill Workflow

Create a new skill following the canonical structure with proper TitleCase naming.

## Step 1: Read the Authoritative Sources

**REQUIRED FIRST:**

1. Read the skill system documentation: `~/.claude/DOS/SkillSystem.md`
2. Read the canonical example: `~/.claude/skills/research/SKILL.md`

## Step 2: Understand the Request

Ask the user:
1. What does this skill do?
2. What should trigger it?
3. What workflows does it need?

## Step 3: Determine TitleCase Names

**All names must use TitleCase (PascalCase).**

| Component | Format | Example |
|-----------|--------|---------|
| Skill directory | TitleCase | `Blogging`, `Daemon`, `CreateSkill` |
| Workflow files | TitleCase.md | `Create.md`, `UpdateDaemonInfo.md` |
| Reference docs | TitleCase.md | `ProsodyGuide.md`, `ApiReference.md` |
| Tool files | TitleCase.ts | `ManageServer.ts` |
| Help files | TitleCase.help.md | `ManageServer.help.md` |

**Wrong naming (NEVER use):**
- `create-skill`, `create_skill`, `CREATESKILL` → Use `CreateSkill`
- `create.md`, `CREATE.md`, `create-info.md` → Use `Create.md`, `CreateInfo.md`

## Step 4: Create the Skill Directory

Author in **pack source** (the SoT) — deploy to the live install happens via `dos-build.ts` + `sync-check.ts`, or use `bun ~/Durante/Tools/scaffold-internal-pack.ts` which does this for you:

```bash
mkdir -p ~/Durante/Packs/[PackName]/src/Workflows
mkdir -p ~/Durante/Packs/[PackName]/src/Tools
```

**Example:**
```bash
mkdir -p ~/Durante/Packs/YourPack/src/Workflows
mkdir -p ~/Durante/Packs/YourPack/src/Tools
```

### Pack-level split ceiling (one pack, one secret)

The folder-structure doctrine (CreateSkill `SKILL.md` → "Folder Structure") sets a **per-skill** ceiling: a single skill with **10+ workflows OR distinct sub-domains** promotes to Pattern 2 (sub-skills). That governs the inside of one skill — it does NOT cap how many *unrelated* sub-skills one pack may accrete.

Add the **pack-level** ceiling: **a pack that spans more than ~8 unrelated sub-domains/sub-skills must split into focused packs — one pack, one secret.** When a pack's sub-skills stop sharing a single reason-to-be-discovered-together (one USE-WHEN concept, one owner, one mental model), the pack has become a junk-drawer and should be carved into cohesive packs.

| Scope | Rule | Source |
|---|---|---|
| Per-skill (existing) | 10+ workflows in ONE skill → split into sub-skills | folder-structure doctrine |
| Per-pack (this) | >~8 unrelated sub-skills in ONE pack → split into focused packs | this section |

**Cautionary example — `utilities`:** it currently carries 21 unrelated sub-skills (CLI generation, skill scaffolding, agent delegation, DOS upgrades, evals, document processing, parsing, audio editing, Fabric patterns, Cloudflare, browser automation, meta-prompting, aphorisms). That breadth is exactly the anti-pattern this ceiling exists to flag — a "misc tools" pack with no single secret. A new capability that does not clearly belong to an existing cohesive pack should start its own focused pack, NOT accrete into Utilities.

## Step 4b: Visibility Classification (MANDATORY)

**Decide before authoring SKILL.md:** is this pack `public` or `internal`?

| Visibility | Meaning | Examples |
|---|---|---|
| **public** | Ships in cc-durante-studio main; visible in fresh customer clones; tracked in submodule history | Most packs (Research, Brand, MakerkitTeam, Cockburn, etc.) |
| **internal** | Operator's competitive surface; gitignored in cc-durante-studio main; materializes only in maintainer-mode + admin-edition releases | AXDeepScan, Bdr, Compliance, Investigation, Sales (per RFC-0011 §6) |

If **public** → no extra step; proceed to Step 5.

If **internal** → register the pack as internal-visibility BEFORE authoring any pack files:

```bash
# Adds the gitignore rules in the active submodule that exclude the body
# from cc-durante-studio main while preserving the extension.yaml shell.
# Idempotent — safe to re-run. Inserts alphabetically into the existing
# "Internal-visibility skill families" block.
bun ~/Durante/Tools/scaffold-internal-pack.ts <SkillName>

# Default exception is `extension.yaml` (matches AXDeepScan/Bdr/Compliance/
# Investigation precedent). For Sales-style precedent, override with:
# bun ~/Durante/Tools/scaffold-internal-pack.ts <SkillName> --exception plugin.json
```

After this, all subsequent writes to `~/.claude/skills/[SkillName]/` (which under symlink-mode IS the submodule) are correctly gitignored — they will NOT enter cc-durante-studio history. Verify with:

```bash
RELEASE_PATH=$(jq -r '.dos.releasePath' ~/.claude/settings.json)  # e.g. Releases/v0.0.19/.claude
cd ~/Durante/"$RELEASE_PATH"
git status --short -- skills/[SkillName]/  # should be empty
```

**Why this step exists:** RFC-0011 Phase 6 (commit `23a12dc`, 2026-04-19) deletes internal-pack bodies from the public submodule. A new internal pack created without this step would leak its body into the public submodule until someone manually edited the gitignore. The tool makes the gitignore rule the canonical SOT — `release.sh` Step 4c and `Tools/hydrate-internal-packs.ts` both parse it to discover internal packs at every freeze and every overlay refresh.

## Step 5: Create SKILL.md

**Default (RFC-0006 Phase 3 partials-mode):** author a `SKILL.partials.md` source file with include directives instead of inlined boilerplate. The canonical `SKILL.md` is then generated by `bun ~/Durante/Tools/dos-build.ts skill <pack-path>` (writes to all 3 copies — live, submodule, pack-source — with a `<!-- generated-from: SKILL.partials.md ... -->` banner).

### 5a. Use the scaffolder (recommended)

```bash
bun ~/Durante/Packs/utilities/src/CreateSkill/Tools/GenerateWithPartials.ts \
  --use-partials \
  --pack <SkillName> \
  --description "<one-line description with USE WHEN clause>" \
  [--icon <Lucide>] [--tier secondary] [--category <Category>] \
  [--workflow "Name1:Trigger1:File1"] \
  --out ~/Durante/Packs/<Family>/src/<SkillName>/SKILL.partials.md
```

Then run the build to emit the canonical `SKILL.md` to all 3 copies:

```bash
bun ~/Durante/Tools/dos-build.ts skill ~/Durante/Packs/<Family>/src/<SkillName>
```

### 5b. Manual partials-mode authoring (if scaffolder unavailable)

Create `SKILL.partials.md` directly with this shape:

```markdown
---
name: SkillName
description: [What it does]. USE WHEN [intent triggers using OR]. [Additional capabilities].
---

<!-- partial: _customization.md skill_name=SkillName -->

# SkillName

[Brief description]

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **WorkflowOne** | "trigger phrase" | `Workflows/WorkflowOne.md` |
| **WorkflowTwo** | "another trigger" | `Workflows/WorkflowTwo.md` |

## Examples

**Example 1: [Common use case]**
```
User: "[Typical user request]"
→ Invokes WorkflowOne workflow
→ [What skill does]
→ [What user gets back]
```

**Example 2: [Another use case]**
```
User: "[Different request]"
→ [Process]
→ [Output]
```

<!-- partial: _artifact-tracking.md skill_name=SkillName -->

<!-- partial: _four-copy-footer.md skill_name=SkillName -->
```

The directives are expanded by `bun ~/Durante/Tools/dos-build.ts skill <pack-path>` into the canonical `SKILL.md`. The three canonical partials (`_customization.md`, `_artifact-tracking.md`, `_four-copy-footer.md`) live at `~/.claude/DOS/PARTIALS/`. For `skill_name=` parameter: pass the family name (e.g. `compliance`) for sub-skills whose family parent owns the customization path; pass the leaf skill name otherwise. See `Packs/compliance/src/PolicyEngine/SKILL.partials.md` for a canonical sub-skill example and `Packs/compliance/src/IncidentResponse/SKILL.partials.md` for the family-rooted customization parameter.

### 5c. Inlined-mode (legacy fallback for non-canonical packs)

If the new pack will need a non-canonical customization shape (non-`🚨`-prefixed heading, `Full documentation:` footer, `PREFERENCES.md` bullet, etc.), keep boilerplate inlined and SKIP authoring `SKILL.partials.md`. Document the divergence per `Phase3/Verification/slice-1-not-partializable.md` precedent. The legacy inlined template is preserved here for reference:

```yaml
---
name: SkillName
description: [What it does]. USE WHEN [intent triggers using OR]. [Additional capabilities].
---

# SkillName

[Brief description]

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **WorkflowOne** | "trigger phrase" | `Workflows/WorkflowOne.md` |
| **WorkflowTwo** | "another trigger" | `Workflows/WorkflowTwo.md` |

## Examples

**Example 1: [Common use case]**
```
User: "[Typical user request]"
→ Invokes WorkflowOne workflow
→ [What skill does]
→ [What user gets back]
```

**Example 2: [Another use case]**
```
User: "[Different request]"
→ [Process]
→ [Output]
```

## [Additional Documentation]

[Any other relevant info]
```

## Step 6: Create Workflow Files

**Canonical generator (recommended):** use `scaffold-workflow.ts` to scaffold each workflow in the routing section. The tool reads pack frontmatter and emits a body shape with Steps + (Intent-to-Flag block if `--has-cli`) + Output sections — preventing the empty-touch antipattern that allowed MakerkitTeam-style misses to ship.

```bash
PACK_SRC="$HOME/Durante/Packs/<SkillName>/src"

# Non-CLI workflow (no Intent-to-Flag block)
bun ~/Durante/Tools/scaffold-workflow.ts --pack <SkillName> --workflow <WorkflowName>

# CLI-shelling workflow (auto-includes Intent-to-Flag block per R14)
bun ~/Durante/Tools/scaffold-workflow.ts --pack <SkillName> --workflow <WorkflowName> --has-cli
```

The tool refuses to overwrite existing files unless `--force`. Pass `--dry-run` to preview output.

**Manual fallback (if tool unavailable):** `touch "$PACK_SRC/Workflows/<WorkflowName>.md"` then author the canonical body shape per `Templates/RegularSkill.md` "Workflow File Body" section.

### Workflow-to-Tool Integration (REQUIRED for workflows with CLI tools)

**If a workflow calls a CLI tool, it MUST include intent-to-flag mapping tables.** This requirement is enforced by **R14** (`bun Tools/dos-toolchain/lint-skills.ts --rule R14`) and **pre-commit Gate 14**. Ship without and the rule fires WARN; in BLOCK mode the commit is rejected.

This pattern translates natural language user requests into appropriate CLI flags:

```markdown
## Intent-to-Flag Mapping

### Model/Mode Selection

| User Says | Flag | When to Use |
|-----------|------|-------------|
| "fast", "quick", "draft" | `--model haiku` | Speed priority |
| (default), "best", "high quality" | `--model opus` | Quality priority |

### Output Options

| User Says | Flag | Effect |
|-----------|------|--------|
| "JSON output" | `--format json` | Machine-readable |
| "detailed" | `--verbose` | Extra information |

## Execute Tool

Based on user request, construct the CLI command:

\`\`\`bash
bun ToolName.ts \
  [FLAGS_FROM_INTENT_MAPPING] \
  --required-param "value"
\`\`\`
```

**Why this matters:**
- Tools have rich configuration via flags
- Workflows should expose this flexibility, not hardcode single patterns
- Users speak naturally; workflows translate to precise CLI

**Reference:** `~/.claude/DOS/CliFirstArchitecture.md` (Workflow-to-Tool Integration section)

**Examples (TitleCase):**
```bash
touch ~/Durante/Packs/YourPack/src/Workflows/UpdateDaemonInfo.md
touch ~/Durante/Packs/YourPack/src/Workflows/UpdatePublicRepo.md
touch ~/Durante/Packs/YourPack/src/Workflows/Create.md
touch ~/Durante/Packs/YourPack/src/Workflows/Publish.md
```

## Step 7: Verify TitleCase

Run this check:
```bash
ls ~/.claude/skills/[SkillName]/
ls ~/.claude/skills/[SkillName]/Workflows/
ls ~/.claude/skills/[SkillName]/Tools/
```

Verify ALL files use TitleCase:
- `SKILL.md` ✓ (exception - always uppercase)
- `WorkflowName.md` ✓
- `ToolName.ts` ✓
- `ToolName.help.md` ✓

## Step 8: Final Checklist

### Naming (TitleCase)
- [ ] Skill directory uses TitleCase (e.g., `Blogging`, `Daemon`)
- [ ] All workflow files use TitleCase (e.g., `Create.md`, `UpdateInfo.md`)
- [ ] All reference docs use TitleCase (e.g., `ProsodyGuide.md`)
- [ ] All tool files use TitleCase (e.g., `ManageServer.ts`)
- [ ] Routing table workflow names match file names exactly

### YAML Frontmatter
- [ ] `name:` uses TitleCase
- [ ] `description:` is single-line with embedded `USE WHEN` clause
- [ ] No separate `triggers:` or `workflows:` arrays
- [ ] Description uses intent-based language
- [ ] Description is under 1024 characters

### Markdown Body
- [ ] `## Workflow Routing` section with table format — R5
- [ ] All workflow files have routing entries
- [ ] `## Examples` section with **2-3 concrete usage patterns** — **R13** (lint-enforced)
- [ ] If the pack ships any user-facing capability, `./src/CHANGELOG.md` exists with `## v0.0.1 — YYYY-MM-DD` entry AND SKILL.md body has `**Status:** v0.0.1 — <description>` line — **R15** (lint-enforced; pre-versioning packs are exempt)

### Structure
- [ ] `tools/` directory exists (even if empty)
- [ ] No `backups/` directory inside skill

### CLI-First Integration (for skills with CLI tools)
- [ ] CLI tools expose configuration via flags (see CliFirstArchitecture.md)
- [ ] Workflows that call CLI tools have **`## Intent-to-Flag Mapping`** tables — **R14** (lint-enforced)
- [ ] Flag mappings cover: mode selection, output options, post-processing (where applicable)
- [ ] Verify with: `bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --rule R14 --pack <SkillName>`

### Verification
- [ ] Pressure-tested per Step 8b — baseline-fail evidence recorded (scenarios + before/after)

## Step 8b: Pressure-Test Before Shipping (TDD for skills)

Treat the skill like production code: prove the failure exists WITHOUT the skill, then prove the
skill fixes it. A skill whose baseline doesn't fail is redundant — stop and reassess scope before
shipping ceremony nobody needed. (The Archer pack-evolution loop is the in-house precedent: its
recipe benchmarks reconstruct baseline failures before every ratchet. Methodology adapted from the
obra/superpowers `writing-skills` skill — MIT, credited in the pack README.)

1. **Baseline (RED).** Spawn a subagent WITHOUT the skill and give it 2-3 representative scenarios
   the skill exists to handle. Save the transcripts — these are your failing tests. No failing
   baseline → no skill (same iron law as TDD).
2. **With the skill (GREEN).** Re-run the SAME scenarios in a fresh subagent with the skill
   loaded. The skill earns its place only if behavior measurably changes to the documented
   standard on the scenarios that failed.
3. **Close loopholes (REFACTOR).** Where the with-skill run still deviates, the deviation's SHAPE
   tells you the fix form — don't default to prohibitions:

   | Observed failure | Fix with |
   |---|---|
   | Ignores a rule under pressure (deadline, sunk cost, "just this once") | Explicit prohibition + a rationalization counter-table |
   | Complies, but the output has the wrong shape | A positive recipe/contract stating what the output IS (its parts, in order) |
   | Omits a required element from output it already produces | A REQUIRED slot in the template it fills, not prose reminders |
   | Applies guidance in the wrong situations | A conditional keyed to an observable predicate |

4. **Keep the battery.** Record the scenario set + before/after evidence in the skill's PRD so
   future edits re-run the same scenarios — an EDIT to a skill re-enters this step, not just
   creation. (For an edit, the RED arm is the CURRENT skill version failing on the new
   scenarios — that failing transcript is what justifies the edit.)

## Step 9: Ecosystem Integration

After creating the skill structure, integrate it with the DOS ecosystem:

### 9a. MemPalace Integration

Register the new skill in the knowledge graph so MemPalace-aware workflows can discover it. Prefer the typed MemPalace client in TypeScript hooks/tools. Step 9c remains the SOT for the lower-level bridge contract.

From a TypeScript hook or tool:

```typescript
import { mempalaceClientFire } from '../lib/mempalace-client';

// Register skill in KG (project:{wing} / has_skill / {SkillName})
mempalaceClientFire.addKgFact({
  subject: 'project:{wing}',
  predicate: 'has_skill',
  object: '{SkillName}',
});

// Drawer in {wing}/skills with skill purpose + triggers
mempalaceClientFire.addDrawer({
  wing: '{wing}',
  room: 'skills',
  label: '{SkillName}',
  content: 'Purpose: {description}. Triggers: {USE WHEN triggers}',
});
```

The `mempalace_bridge.py` wrapper at `~/.claude/DOS/Tools/` is the underlying bridge surface — it handles `uv`/version management internally and degrades gracefully when the bridge is offline. **Direct `uv run --with mempalace` invocations are deprecated** — they bypass the bridge contract and break on package source changes.

### 9b. Project-Level MEMORY Paths

If the skill creates PRDs or work artifacts, it MUST use **relative project-level paths**:

- **Correct:** `MEMORY/WORK/{slug}/PRD.md` (relative to project root)
- **Wrong:** `~/.claude/MEMORY/WORK/{slug}/PRD.md` (absolute global path)

Project-level MEMORY ensures artifacts travel with the repo and are discoverable by `getAllWorkDirs()`. The Algorithm's `getWorkDir()` resolves project-level paths automatically with global fallback.

### 9c. MemPalace Bridge Pattern

If the skill needs to call MemPalace (search, KG queries, drawer operations), it MUST use the centralized bridge — never call python3 directly:

```typescript
// In hooks or tools:
import { mempalaceClient, mempalaceClientFire } from '../lib/mempalace-client';

// Synchronous (waits for result)
const result = mempalaceClient.search({ query: 'topic', limit: 5 });

// Fire-and-forget (no await)
mempalaceClientFire.addKgFact({ subject: 'x', predicate: 'y', object: 'z' });
```

The typed client delegates through the bridge wrappers, so audit logging, drift telemetry, daemon routing, and predicate gating stay intact. Direct `python3 bridge.py` calls bypass version management and break when the package source changes.

### 9d. Sentinel Registration

After creating the skill, run Sentinel to register any new conventions the skill introduces:

```
/sentinel scan
```

This updates the project's `.sentinel/conventions.json` and syncs convention data to Studio if configured.

### 9e. Required-files gate (MANDATORY)

After creating the skill structure, verify all canonical pack-manifest files are present per RFC-0002, RFC-0004 §6.1, RFC-0006 §5.4, and RFC-0011 §5.2:

```bash
bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --rule R11 --pack <SkillName>
```

R11 fires findings if any of these are missing:

- `Packs/<X>/plugin.json` — RFC-0011 §5.2 distribution manifest with `dos.bridge[]` declaration
- `Packs/<X>/src/extension.yaml` — RFC-0002 extension manifest (handlers, gates, slot_types, contributes)
- `Packs/<X>/src/SKILL.md` — Build artifact (or `SKILL.partials.md` + documented divergence per RFC-0006 §5.2c)

Reference canonical examples:

- `Packs/brand/plugin.json` — zero-bridge form (most user-invoked packs)
- `Packs/mem-palace/plugin.json` — multi-bridge form (memory-writing packs)
- `Packs/brand/src/extension.yaml` — Phase 2 user-invoked manifest with metadata block

If R11 fires findings, address them before commit. Pre-commit Gate 12 enforces this gate at submodule push time (default mode `warn` for 14-day rollout, then flip to `block` via `DOS_REQ_FILES_GATE_MODE=block`).

### 9f. Pack-root distribution docs (MANDATORY)

After Step 9e R11 verification passes, scaffold the 4-file pack-distribution contract from `Packs/README.md`:

```bash
bun ~/Durante/Tools/scaffold-pack-docs.ts --pack <SkillName>
```

This generates the three required pack-root files:

- `Packs/<X>/README.md` — User-facing description with frontmatter (pack-id, version, author, keywords)
- `Packs/<X>/INSTALL.md` — AI-driven 5-phase install wizard (system analysis → user questions → backup → install → verify)
- `Packs/<X>/VERIFY.md` — Post-install validation script (file checks + frontmatter check + functional test)

Reference canonical examples:
- `Packs/agents/README.md`, `INSTALL.md`, `VERIFY.md` — full skill exemplar
- `Packs/context-search/INSTALL.md` — Commands-type variant

The scaffolder is idempotent and refuses to overwrite without `--force`. Pre-commit Gate 13 enforces this gate at submodule push time.

After running, verify with:
```bash
bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --rule R12 --pack <SkillName>
```

## Step 10: Project-Level Path Resolution

**MANDATORY for any workflow that writes to a MEMORY/ subdirectory.**

DOS supports project-level memory. Hooks write to `{project}/MEMORY/{subdir}/` when the directory exists, falling back to `~/.claude/MEMORY/{subdir}/` otherwise. **Skill workflows must follow the same pattern.** Never hardcode `~/.claude/MEMORY/` in a workflow.

**The resolution block** — add this at the top of any workflow that writes to MEMORY:

```bash
# Resolve project-level MEMORY/{SUBDIR} (falls back to global)
if [ -d "${CLAUDE_PROJECT_DIR}/MEMORY/{{SUBDIR}}" ]; then
  {{VAR}}_BASE="${CLAUDE_PROJECT_DIR}/MEMORY/{{SUBDIR}}"
elif [ -d "$(pwd)/MEMORY/{{SUBDIR}}" ]; then
  {{VAR}}_BASE="$(pwd)/MEMORY/{{SUBDIR}}"
else
  {{VAR}}_BASE="$HOME/.claude/MEMORY/{{SUBDIR}}"
fi
mkdir -p "${{VAR}}_BASE/$(date +%Y-%m)"
```

Replace `{{SUBDIR}}` with the memory subdirectory (RESEARCH, ARTIFACTS, WORK, LEARNING, SECURITY, SALES, etc.) and `{{VAR}}` with a descriptive variable name (RESEARCH_BASE, SALES_BASE, etc.).

Then use `${{VAR}}_BASE/` everywhere in that workflow instead of `~/.claude/MEMORY/{{SUBDIR}}/`.

**For TypeScript code in workflows:**
```typescript
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const projectPath = `${projectDir}/MEMORY/{{SUBDIR}}`;
const basePath = require('fs').existsSync(projectPath)
  ? projectPath
  : `${process.env.HOME}/.claude/MEMORY/{{SUBDIR}}`;
```

**Project-eligible subdirs:** WORK, LEARNING, RESEARCH, ARTIFACTS, SECURITY, STATE
**Global-only subdirs (never resolve project-level):** VOICE, RELATIONSHIP

**Sentinel creates these dirs** during `/sentinel scan` (Phase 1b). If a project hasn't been scanned, the resolution falls back to global — no crash, just global storage.

## Step 11: Artifact Tracking

**MANDATORY for any skill that writes output files via the Write tool.**

After writing any output file, resolve the ARTIFACTS path and log:

```bash
# Resolve ARTIFACTS dir (project-level first)
if [ -d "${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS"
elif [ -d "$(pwd)/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="$(pwd)/MEMORY/ARTIFACTS"
else
  ARTIFACTS_DIR="$HOME/.claude/MEMORY/ARTIFACTS"
fi

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"{{PACK_NAME}}","workflow":"{{WORKFLOW_NAME}}","type":"{{ARTIFACT_TYPE}}","title":"{{TITLE}}","path":"{{ABSOLUTE_PATH}}","contentPreview":"{{FIRST_500_CHARS_ESCAPED}}","wing":"{{WING_OR_GENERAL}}","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

Replace template variables:
- `{{PACK_NAME}}`: The pack this skill belongs to
- `{{WORKFLOW_NAME}}`: The workflow that produced the output
- `{{ARTIFACT_TYPE}}`: The type of artifact (proposal, report, analysis, design-doc, policy, etc.)
- `{{TITLE}}`: Human-readable title extracted from the content
- `{{ABSOLUTE_PATH}}`: The full path where the file was written
- `{{FIRST_500_CHARS_ESCAPED}}`: First 500 characters of content with quotes escaped
- `{{WING_OR_GENERAL}}`: Project wing from context or "general"

This tracking enables Studio to index all skill-produced artifacts. If the skill is read-only (no Write tool usage), this step can be skipped.

## Step 12: Agent Composition Pattern (if applicable)

**MANDATORY for any skill that spawns agents with distinct perspectives (councils, debates, reviews, parallel analysis).**

If the skill's workflows launch multiple agents where each agent has a different role, perspective, or personality, integrate the **trait composition pattern** instead of hardcoding agent identities.

### When to Add This

- Skill has a council/debate workflow
- Skill spawns 2+ agents with different roles (e.g., reviewer + challenger + researcher)
- Skill creates parallel analysis agents with different perspectives

### How to Integrate

Reference the shared partial in each agent-spawning workflow. **Use the pack-source path, not the live install** (pack-source-as-SOT discipline per UpdateSkill.md Step 2):

```markdown
See `~/Durante/Packs/agents/src/Partials/TraitComposition.md` for the full pattern.
```

(The live install at `~/.claude/skills/agents/Partials/TraitComposition.md` is byte-equivalent under symlink mode but pack-source is the canonical reference for cross-host portability.)

For each agent, compose from traits before spawning:

```bash
bun run ~/Durante/Packs/agents/src/Tools/ComposeAgent.ts --traits "<expertise>,<personality>,<approach>" --output json
```

Use the returned `prompt` as the agent's system prompt and `subagent_type: "general-purpose"`.

### Available Traits

| Dimension | Options |
|-----------|---------|
| **Expertise** (7) | security, technical, research, sales, brand, product, creative |
| **Personality** (5) | skeptical, analytical, enthusiastic, contrarian, pragmatic |
| **Approach** (5) | thorough, rapid, systematic, investigative, parallel |

Run `bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts --list` to see the full catalog.

### What NOT to Change

- Skills that use **model-routed agents** (ClaudeResearcher, GeminiResearcher, etc.) should keep their `subagent_type` routing — traits don't help here
- Skills that spawn **identical worker clones** (same task, no role differentiation) don't need traits
- **DreamTeam** named experts with real-world frameworks should keep their hardcoded identities

### Checklist

- [ ] Agent-spawning workflows reference `TraitComposition.md` partial
- [ ] Each distinct agent role has a trait combination documented
- [ ] All composed agents use `subagent_type: "general-purpose"`
- [ ] Trait combos are adapted to the skill's domain (not copy-pasted from defaults)

## Done

Skill created following canonical structure with proper TitleCase naming and DOS ecosystem integration.
