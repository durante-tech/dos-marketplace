---
name: Validate Skill
description: Verify an existing skill against the canonical structure (R1-R15 lint rules + RFC-0011 4-file pack-distribution contract + RFC-0002 extension manifest + RFC-0006 partials toolchain). Reports lint-clean vs structurally-compliant separately.
status: STABLE
---

# ValidateSkill Workflow

**Purpose:** Check if an existing skill follows the canonical structure: R1-R15 lint rules + manifest layer (plugin.json + extension.yaml + SKILL.md) + distribution docs (INSTALL.md + README.md + VERIFY.md) + frontmatter shape + TitleCase naming.

## Step 1: Read the Authoritative Sources

**REQUIRED FIRST:**

1. `~/.claude/DOS/SkillSystem.md` — canonical structure
2. `Packs/README.md` — 4-file pack-distribution contract
3. `Plans/Specs/RFC-0011-packs-distribution-release-authoring.md` — pack-root manifest spec

---

## Step 2: Identify the Pack Type

**CRITICAL — different validation surface for top-level vs sub-pack:**

```bash
# Top-level pack (most cases): Packs/<X>/src/SKILL.md
TOP_LEVEL=$([[ -d "$HOME/Durante/Packs/<X>/src" ]] && echo Y || echo N)

# Sub-pack (Utilities family only): Packs/utilities/src/<X>/SKILL.md
SUB_PACK=$([[ -d "$HOME/Durante/Packs/utilities/src/<X>" ]] && echo Y || echo N)
```

| Type | Has its own plugin.json / extension.yaml / INSTALL.md / README.md / VERIFY.md? | R11/R12 apply? |
|------|---|---|
| Top-level pack | YES (4-file contract at pack root) | YES |
| Sub-pack | NO (shares parent's manifests) | NO — only R1-R10 apply |

---

## Step 3: Run the Canonical Linter

**For top-level packs:**

```bash
bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --pack <SkillName>
```

This runs R11 + R12 + R13 + R14 + R15 (pack-manifest + distribution docs + SKILL.md `## Examples` + Workflows `## Intent-to-Flag` presence + CHANGELOG version anchoring). Report findings count and exit code.

Per-rule scoping:

```bash
bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --rule R11 --pack <X>   # plugin.json + extension.yaml + SKILL.md
bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --rule R12 --pack <X>   # INSTALL.md + README.md + VERIFY.md
bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --rule R13 --pack <X>   # SKILL.md `## Examples` ≥2 patterns
bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --rule R14 --pack <X>   # Workflows CLI-shelling Intent-to-Flag
bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --rule R15 --pack <X>   # src/CHANGELOG.md ↔ SKILL.md Status version
```

**For sub-packs:**

R11-R14 don't apply (sub-packs share parent's manifests + body conventions). Run only the per-SKILL.md rules via the lint-skills.ts driver:

```bash
# Per-SKILL.md rules (R1-R10) walk all SKILL.md files; sub-packs ARE checked for R1-R10.
# Use --pack <SubPackName> to scope output:
bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --pack <SubPackName>
```

---

## Step 4: Verify the 4-File Pack-Distribution Contract (top-level only)

For top-level packs, all 4 root files MUST exist:

```bash
PACK_ROOT="$HOME/Durante/Packs/<SkillName>"
[ -f "$PACK_ROOT/plugin.json"    ] && echo "OK plugin.json"    || echo "MISSING plugin.json (RFC-0011 §5.2 + RFC-0004 §6.1)"
[ -f "$PACK_ROOT/INSTALL.md"     ] && echo "OK INSTALL.md"     || echo "MISSING INSTALL.md (Packs/README.md contract)"
[ -f "$PACK_ROOT/README.md"      ] && echo "OK README.md"      || echo "MISSING README.md (Packs/README.md contract)"
[ -f "$PACK_ROOT/VERIFY.md"      ] && echo "OK VERIFY.md"      || echo "MISSING VERIFY.md (Packs/README.md contract)"
[ -f "$PACK_ROOT/src/extension.yaml" ] && echo "OK src/extension.yaml" || echo "MISSING src/extension.yaml (RFC-0002)"
[ -f "$PACK_ROOT/src/SKILL.md"   ] && echo "OK src/SKILL.md"   || echo "MISSING src/SKILL.md (RFC-0006 §5.4)"
```

For sub-packs, only `src/SKILL.md` is required at the sub-pack root (parent pack carries the manifests).

---

## Step 5: Verify TitleCase Naming

```bash
# Skill directory name
echo "Skill: <SkillName>"  # ✓ TitleCase: Blogging, CreateSkill, Daemon
                           # ✗ Wrong: createskill, create-skill, CREATE_SKILL

# Workflow file names
ls "$PACK_ROOT/src/Workflows/" 2>/dev/null
# ✓ TitleCase: Create.md, UpdateDaemonInfo.md, SyncRepo.md
# ✗ Wrong: create.md, update-daemon-info.md, SYNC_REPO.md

# Tool files
ls "$PACK_ROOT/src/Tools/" 2>/dev/null
# ✓ TitleCase: ManageServer.ts, ManageServer.help.md
# ✗ Wrong: manage-server.ts, MANAGE_SERVER.ts
```

---

## Step 6: Verify YAML Frontmatter

The SKILL.md frontmatter MUST contain:

```yaml
---
name: SkillName                       # TitleCase, R3 (ERROR if missing)
description: [...]. USE WHEN [...].   # Single-line, ≤1024 chars, R4 (ERROR if missing or empty)
role: <role>                          # ADVISORY (pending RFC) — recorded union canon: advisor | analyzer | executor | extractor | generator | guardian | orchestrator | researcher | thinker | validator
accepts: [text|url|repo_path|...]     # ADVISORY, OPTIONAL (absence = unconstrained) — 12-token list in Tools/lint-skill-frontmatter.ts
visibility: public | internal | beta  # R8 (ERROR if missing)
roots: [<root scope list>]
---
```

**Enforcement tiers (2026-07-02 council, `Tools/lint-skill-frontmatter.ts` + pre-commit Gate 22):** the ENFORCED tier is exactly what SkillSystem.md ratifies — `name:` present, `description:` present + single-line + `USE WHEN` + ≤1024 chars, no banned fields (`selection_rule:`/`parent:`). `role:`/`accepts:` are ADVISORY until an RFC + a real consumer (capability-select routing) ratify the taxonomy — the lint reports them but never fails on them, and their ABSENCE is not a violation.

**Common violations:**
- Multi-line description using `|` block (WRONG — must be single line)
- Missing `USE WHEN` keyword in description (degrades discovery)
- Description over 1024 characters (Anthropic hard limit — enforced tier)
- Separate `triggers:` or `workflows:` arrays (OLD FORMAT — both moved into description / body)
- `visibility:` missing or invalid (R8 ERROR)

---

## Step 7: Verify SKILL.md Body Structure

Run the canonical R13 check (lint-driven, identical heuristic to pre-commit Gate 14):

```bash
bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --rule R13 --pack <SkillName>
```

Or hand-grep:

```bash
# Heading presence (R13 first check)
grep -E "^## (Workflow Routing|Examples|Customization)" "$PACK_ROOT/src/SKILL.md"

# Example block count (R13 second check — requires ≥2)
awk '/^## Examples/,0' "$PACK_ROOT/src/SKILL.md" | grep -cE "^(\*\*Example [0-9]+:|### Example [0-9]+:|Example [0-9]+:)"
```

Required body sections (lint-enforced):

- `## Workflow Routing` with `| Workflow | Trigger | File |` table (R5)
- `## Examples` with **2-3 concrete usage patterns** (**R13** — heading + ≥2 example blocks)
- Voice notification block (R2)
- `## Customization` block (R1, partial-included if partials-mode)

---

## Step 8: Verify plugin.json + extension.yaml (top-level only)

```bash
cat "$PACK_ROOT/plugin.json"
# Expect: {"name":"<X>","dos":{"bridge":[<actions>]}}

cat "$PACK_ROOT/src/extension.yaml"
# Expect:
#   extension_id: <name>/core
#   version: 1.0.0
#   protocol_version: ^1.0.0
#   schema: dos-extension/v1
#   conformance_profile: minimal
#   contributes: {...}
#   metadata:
#     pack: <Name>
#     workflows: [...]
```

R9 lint reconciles `plugin.json` `dos.bridge[]` against actual bridge invocations in pack body files. Provider packs that export a full bridge surface use `dos.bridgeSurface[]` in addition to invoked-action `dos.bridge[]`.

---

## Step 9: Report Results

### Lint-clean assertion

```
R1-R8 (per-SKILL.md):     [PASS / N findings]
R9-R10 (bridge drift):    [PASS / N findings]
R11 (pack manifests):     [PASS / N findings]   (top-level only)
R12 (distribution docs):  [PASS / N findings]   (top-level only)
R13 (SKILL.md ## Examples): [PASS / N findings]   (top-level only)
R14 (Workflows Intent-to-Flag): [PASS / N findings]   (top-level only)
R15 (CHANGELOG ↔ Status version): [PASS / N findings]   (top-level only)
```

### Structurally-compliant assertion

```
4-file contract:         [COMPLETE / MISSING <files>]
Frontmatter:             [VALID / INVALID <field>]
Body sections:           [COMPLETE / MISSING <section>]
TitleCase naming:        [PASS / FAIL <file>]
```

### CLI-First Integration (for skills with CLI tools)

```bash
ls "$PACK_ROOT/src/Tools/" | grep -E '\.ts$|\.sh$|\.py$'
```

For each tool, verify flag-based config (`--help`, `--dry-run`, `--json`, etc.).

For each workflow under `src/Workflows/`, verify that any CLI-shelling workflow includes a `## Intent-to-Flag Mapping` table — this is **R14** (lint-enforced):

```bash
# Canonical R14 check
bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --rule R14 --pack <SkillName>

# Or hand-grep — identifies CLI-shelling + Intent-to-Flag presence per workflow
for wf in "$PACK_ROOT/src/Workflows/"*.md; do
  shells_cli=$(grep -qE 'bun [^ ]+\.(ts|sh)|python3? [^ ]+\.py|^\s*\./[^ ]+\.(ts|sh|py)' "$wf" && echo Y || echo N)
  has_intent=$(grep -q "^## Intent-to-Flag" "$wf" && echo Y || echo N)
  if [ "$shells_cli" = "Y" ] && [ "$has_intent" = "N" ]; then
    echo "MISSING-IntentFlag: $wf"
  fi
done
```

### Ecosystem Integration

- [ ] Skill registered in MemPalace KG (`has_skill` predicate) — `bun lint-skills.ts` doesn't check this; manual verify via the MemPalace bridge `<query-action>` invocation (action name lives in `Plans/Specs/RFC-0005` §6.3 and is intentionally not inlined here to avoid cross-pack R9 lint debt)
- [ ] Workflows creating PRDs use relative `MEMORY/WORK/{slug}/` (not absolute `~/.claude/MEMORY/...`)
- [ ] MemPalace calls use typed client or `bridgeSync`/`bridgeFire`/`bridgeAsync`, not bare `python3`
- [ ] Sentinel scan run post-creation (`/sentinel scan`)

---

## Step 10: Final Verdict

**COMPLIANT** if all of:
- All R1-R15 lint rules report 0 findings
- All 4 pack-root files present (top-level packs)
- Frontmatter valid, body sections complete, TitleCase clean
- Workflows shelling out to CLI all include `## Intent-to-Flag Mapping` tables
- **R15 gate (top-level packs):** `src/CHANGELOG.md` exists AND its latest `## vX.Y.Z` header matches the SKILL.md `**Status:** vX.Y.Z` line — a version-drift anchor; COMPLIANT REQUIRES this version-anchor match, not only the manifest / distribution-docs / examples / intent-flag rules

**NON-COMPLIANT** if any failure. Recommend running `CanonicalizeSkill` workflow to restore canonical structure (handles missing manifests + missing distribution docs + missing Examples + missing Intent-to-Flag tables).

---

## Quick Reference

| Check | Command |
|-------|---------|
| Per-pack R11-R15 | `bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --pack <X>` |
| Tree-wide R11-R15 | `bun ~/Durante/Tools/dos-toolchain/lint-skills.ts` |
| R11 only | `bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --rule R11 --pack <X>` |
| R12 only | `bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --rule R12 --pack <X>` |
| R13 only | `bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --rule R13 --pack <X>` |
| R14 only | `bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --rule R14 --pack <X>` |
| R15 only | `bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --rule R15 --pack <X>` |
| Sync parity | `bun ~/Durante/Tools/sync-check.ts --summary` |

## Done

Skill structurally validated against R1-R15 lint rules and the 4-file pack-distribution contract.
