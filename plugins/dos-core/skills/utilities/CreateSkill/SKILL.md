---
disable-model-invocation: true
name: CreateSkill
description: Scaffold new DOS skills with proper YAML front matter, TitleCase naming, flat folder structure (SKILL.md + Workflows/ + Tools/), and validation against SkillSystem.md. USE WHEN create skill, new skill, skill structure, canonicalize, validate skill, update skill, fix skill structure, scaffold skill.
role: executor
accepts:
  - text
roots:
  - PROTECTED_LOCAL
visibility: public
capabilities:
  - customization.cascade
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/CreateSkill/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# CreateSkill

MANDATORY skill creation framework for ALL skill creation requests.

## Authoritative Source

**Before creating ANY skill, READ:** `~/.claude/DOS/SkillSystem.md`

**Canonical example to follow:** `~/.claude/skills/research/SKILL.md`

## Authoring Mode (Default: Partials)

**As of RFC-0006 Phase 3, new skills are scaffolded in partials-mode by default.** The boilerplate blocks (customization, artifact tracking, four-copy footer) are NOT inlined into the SKILL.md body — they are referenced via `<!-- partial: _customization.md skill_name=<Pack> -->` style include directives. The expanded SKILL.md (what Claude Code reads) is generated from a `SKILL.partials.md` source by `bun ~/Durante/Tools/dos-build.ts skill <pack-path>`.

**Default scaffolder invocation:**

```bash
bun ~/Durante/Packs/utilities/src/CreateSkill/Tools/GenerateWithPartials.ts \
  --use-partials \
  --pack <SkillName> \
  --description "<single-line description with USE WHEN clause>" \
  --out <pack-path>/SKILL.partials.md
```

This emits a partials-using `SKILL.partials.md` with the three canonical include directives pre-wired (`_customization.md`, `_artifact-tracking.md`, `_four-copy-footer.md`). (Voice notification was retired 2026-07-02 — no voice block is injected.) Then run `bun ~/Durante/Tools/dos-build.ts skill <pack-path>` to emit the canonical `SKILL.md` (what Claude Code reads) into all three copies (pack source, live, submodule). Step 5 below shows the expected source-of-truth shape.

**Why partials-mode is the new default:** repetition audit (RFC-0006 §2.1) measured 14% boilerplate across 96 SKILL.md files. Partials compress source-side boilerplate to a single canonical template per block while keeping the expanded artifact byte-identical to a hand-authored equivalent. Phase 0 / 1 / 2 evidence: Compliance + Phase-2B packs landed with byte-identical expand+eject roundtrips; pre-commit Gate 4 (`dos-build --check`) blocks staged drift between `SKILL.partials.md` and the generated `SKILL.md`.

**Inlined-mode (legacy fallback):** if a pack's existing voice/customization/artifact shape diverges from the canonical partials (e.g., compact one-liner voice block, non-canonical heading prefix without the `🚨` emoji, custom footer additions, extra customization bullets), keep the SKILL.md hand-authored and document the divergence per the `Phase3/Verification/slice-1-not-partializable.md` precedent. A future RFC will extend the partial templates to absorb these shapes.

**Eject path (RFC-0006 §7.1.1):** `bun ~/Durante/Tools/dos-eject.ts skill <pack-path>/SKILL.partials.md --in-place` re-inlines all partials and deletes the `.partials.md` source. One-command downgrade per pack — partials-mode is reversible.

## TitleCase Naming Convention

**All naming must use TitleCase (PascalCase).**

| Component | Format | Example |
|-----------|--------|---------|
| Skill directory | TitleCase | `Blogging`, `Daemon`, `CreateSkill` |
| Workflow files | TitleCase.md | `Create.md`, `UpdateDaemonInfo.md` |
| Reference docs | TitleCase.md | `ProsodyGuide.md`, `ApiReference.md` |
| Tool files | TitleCase.ts | `ManageServer.ts` |
| Help files | TitleCase.help.md | `ManageServer.help.md` |

**Wrong (NEVER use):**
- `createskill`, `create-skill`, `CREATE_SKILL`
- `create.md`, `update-info.md`, `SYNC_REPO.md`

---

## Folder Structure

DOS skills use **two structural patterns** depending on complexity:

### Pattern 1: Flat (Simple Skills)

For skills with < 10 workflows and a single domain. Maximum 2 levels deep.

```
skills/SkillName/
├── SKILL.md                    # Routing table
├── Workflows/Create.md         # One level deep
├── Tools/Manage.ts             # One level deep
└── QuickStartGuide.md          # Context file in root
```

### Pattern 2: Sub-Skill Hierarchy (Complex Packs)

For packs with 10+ workflows spanning distinct sub-domains. Each sub-domain gets its own SKILL.md with routing.

```
skills/PackName/
├── SKILL.md                    # Top-level routing → sub-skills
├── SubDomainA/
│   ├── SKILL.md                # Sub-skill routing
│   └── Workflows/Action.md
├── SubDomainB/
│   ├── SKILL.md
│   ├── Workflows/Action.md
│   └── Tools/Script.ts
└── Workflows/Audit.md          # Pack-level workflows (if any)
```

**Packs using sub-skill pattern:** Compliance (8), Media (10), Security (5), Scraping (3), Investigation (2), Sales (4), SocialMedia (3), Thinking (6), Utilities (21), Telos (2), Brand (7)

### When to Use Which

- **< 10 workflows, single domain** → Pattern 1 (flat)
- **10+ workflows OR distinct sub-domains** → Pattern 2 (sub-skills)
- **Never flatten a sub-skill pack** — the hierarchy is intentional

### Rules for Both Patterns

- **Context files** go in skill root, NOT in Resources/ or Docs/
- **Workflows/** and **Tools/** are the functional subdirectories
- **TitleCase** naming everywhere
- **SKILL.md** at every routing level (pack root + each sub-skill)

---

## Dynamic Loading Pattern (Large Skills)

**For skills with SKILL.md > 100 lines:** Use dynamic loading to reduce context on skill invocation.

### How Loading Works

**Session startup:** Only frontmatter loads for routing
**Skill invocation:** Full SKILL.md loads
**Context files:** Load only when workflows reference them

### The Pattern

**SKILL.md** = Minimal (30-50 lines) - loads on skill invocation
- YAML frontmatter with triggers
- Brief description
- Workflow routing table
- Quick reference
- Pointers to context files

**Additional .md files** = Context files - SOPs for specific aspects (loaded on-demand)
- These are Standard Operating Procedures, not just documentation
- They provide specific handling instructions
- Can reference Workflows/, Tools/, etc.

### 🚨 CRITICAL: NO Context/ Subdirectory 🚨

**NEVER create Context/ or Docs/ subdirectories.**

Additional .md files ARE the context files. They live **directly in skill root**.

**WRONG:**
```
skills/media/Art/
├── SKILL.md
└── Context/              ❌ NEVER CREATE THIS
    └── Aesthetic.md
```

**CORRECT:**
```
skills/media/Art/
├── SKILL.md
├── Aesthetic.md          ✅ Context file in skill root
├── Examples.md           ✅ Context file in skill root
└── Tools.md              ✅ Context file in skill root
```

**The skill directory IS the context.**

### Example Structure

```
skills/media/Art/
├── SKILL.md              # 40 lines - minimal routing
├── Aesthetic.md          # Context file - SOP for aesthetic
├── Examples.md           # Context file - SOP for examples
├── Tools.md              # Context file - SOP for tools
├── Workflows/            # Workflows
│   └── Essay.md
└── Tools/                # CLI tools
    └── Generate.ts
```

### Minimal SKILL.md Template

```markdown
---
name: SkillName
description: Brief. USE WHEN triggers.
# Optional: structured artifact-tracking manifest (2026-04-24 — replaces
# prose-only "Step 10 artifact tracking" convention with a machine-readable
# declaration. Future DocPlacementGuard hook reads this field to validate
# the skill's writes are landing in declared roots.)
artifact_tracking:
  enabled: true
  roots:
    - MEMORY/ARTIFACTS
    - MEMORY/WORK
  types:
    - prd
    - report
    - summary
  log_path: MEMORY/ARTIFACTS/artifacts.jsonl
---

# SkillName

Brief description.

## Workflow Routing

| Trigger | Workflow |
|---------|----------|
| "trigger" | `Workflows/WorkflowName.md` |

## Quick Reference

**Key points** (3-5 bullet points)

**Full Documentation:**
- Detail 1: `SkillSearch('skillname detail1')` → loads Detail1.md
- Detail 2: `SkillSearch('skillname detail2')` → loads Detail2.md
```

### `artifact_tracking:` Frontmatter Field (2026-04-24)

**Status:** optional, additive. Skills without this field remain valid — existing `ArtifactAutoLogger.hook.ts` continues to log writes via path heuristics.

**Purpose:** Promote the "every skill logs one line to `MEMORY/ARTIFACTS/artifacts.jsonl`" convention from prose instruction (Step 10 of CreateSkill historical workflow) to structured data that hooks and tools can read programmatically.

**Schema:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `enabled` | boolean | no | Defaults to `true` when field is present. Set `false` to opt the skill out of auto-logging (rare — mainly for test/scaffolding skills). |
| `roots` | string[] | yes if `enabled` | Declared write roots for this skill. Paths relative to project root or `$HOME`-prefixed. Future `DocPlacementGuard` PreToolUse hook will validate built-in Write/Edit targets against this list. |
| `types` | string[] | no | Free-form taxonomy for artifact classification (prd, report, summary, diagram, policy, etc.). Informational — used by dashboards / artifact search. |
| `log_path` | string | no | Override the default `MEMORY/ARTIFACTS/artifacts.jsonl` location. Rarely needed. |

**Interop:** `doc-placement-policy.json` → `skillWriteRoots` field currently lists a parallel allowlist for MCP write-gate purposes. Over time, declared `artifact_tracking.roots` in each SKILL.md will become the source of truth and `skillWriteRoots` will be generated from them at `dos-build` time. Until that build step ships, the two lists must be kept manually consistent — prefer SKILL.md frontmatter as the authoring surface.

### When To Use

✅ **Use dynamic loading for:**
- SKILL.md > 100 lines
- Multiple documentation sections
- Extensive API reference
- Detailed examples

❌ **Don't use for:**
- Simple skills (< 50 lines)
- Pure utility wrappers (use DOS/Tools.md instead)

### Benefits

- **Token Savings:** 70%+ reduction on skill invocation (when full docs not needed)
- **Organization:** SKILL.md = routing, context files = SOPs for specific aspects
- **Efficiency:** Workflows load only what they actually need
- **Maintainability:** Easier to update individual sections

**See:** `~/.claude/DOS/SkillSystem.md` (Dynamic Loading Pattern section)

---

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **CreateSkill** | "create a new skill" | `Workflows/CreateSkill.md` |
| **ValidateSkill** | "validate skill", "check skill" | `Workflows/ValidateSkill.md` |
| **UpdateSkill** | "update skill", "add workflow" | `Workflows/UpdateSkill.md` |
| **CanonicalizeSkill** | "canonicalize", "fix skill structure" | `Workflows/CanonicalizeSkill.md` |

**Note:** Built-in slash commands (`/init`, `/review`, `/security-review`) are now reachable via the Skill tool — no wrapper skill needed (Claude Code v2.1.108+).

## Examples

**Example 1: Create a new skill from scratch**
```
User: "Create a skill for managing my recipes"
→ Invokes CreateSkill workflow
→ Reads SkillSystem.md for structure requirements
→ Creates skill directory with TitleCase naming
→ Creates SKILL.md, Workflows/, tools/
→ Generates USE WHEN triggers based on intent
```

**Example 2: Fix an existing skill that's not routing properly**
```
User: "The research skill isn't triggering - validate it"
→ Invokes ValidateSkill workflow
→ Checks SKILL.md against canonical format
→ Verifies TitleCase naming throughout
→ Verifies USE WHEN triggers are intent-based
→ Reports compliance issues with fixes
```

**Example 3: Canonicalize a skill with old naming**
```
User: "Canonicalize the daemon skill"
→ Invokes CanonicalizeSkill workflow
→ Renames workflow files to TitleCase
→ Updates routing table to match
→ Ensures Examples section exists
→ Verifies all checklist items
```

## Post-Creation Ecosystem Integration

After creating or updating a skill, complete these DOS ecosystem steps (see CreateSkill.md Steps 9-11 for details):

1. **MemPalace** — Register the skill in KG (`has_skill` predicate) and create a drawer in the wing's `skills` room
2. **Project-Level Paths** — NEVER hardcode `~/.claude/MEMORY/` in workflows. Use the resolution block from Step 10 (project→cwd→global cascade). Eligible subdirs: WORK, LEARNING, RESEARCH, ARTIFACTS, SECURITY, SALES.
3. **Artifact Tracking** — Skills that write output files must log to `$ARTIFACTS_DIR/artifacts.jsonl` using the resolved path (Step 11)
4. **MemPalace Bridge** — Always use centralized `bridgeSync`/`bridgeFire` from `hooks/lib/mempalace.ts` — never call python3 directly
5. **Sentinel** — Run `/sentinel scan` to register any conventions the new skill introduces
