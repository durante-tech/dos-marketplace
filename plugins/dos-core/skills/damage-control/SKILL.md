---
name: DamageControl
description: Level-3 global damage-control baseline — PreToolUse pattern-block for catastrophic shell commands (rm -rf /, dd if=, mkfs, drop database, kubectl delete ns, terraform destroy, aws delete-volume, gcloud sql delete). Operator-gated activation. USE WHEN damage control, bash blacklist, pretooluse guard, dangerous command, rm -rf, dd if, mkfs, drop database, kubectl delete, terraform destroy, aws delete-volume, gcloud sql delete, indydevdan damage control, level 3 baseline, agentic safety, bash policy, command block.
role: guardian
accepts:
  - text
icon: ShieldAlert
colorVar: danger
colorHex: "#ff5e57"
tier: secondary
category: Security
displayLabel: DamageControl
marketingDescription: Operator-gated PreToolUse pattern-block for catastrophic shell commands.
capabilities:
  - artifact.write
  - customization.cascade
divergence_from_canonical:
  _four-copy-footer.md:
    partial_version: 1.1.0
    reason: "Bespoke Four-Copy section — copies 1-2 are created only on operator activation and the sync-manifest note is pack-specific; the canonical footer would misstate the activation gating"
    rationale_link: null
elevator: PreToolUse pattern-block for catastrophic shell commands; operator-gated.
highlightWorkflows: []
roots:
  - PROJECT.WORK
  - PROJECT.SECURITY
visibility: public
feature_capabilities:
  - PreToolUse regex-block for catastrophic destructive shell patterns
  - Operator-gated activation (ships as .template; never auto-activates)
  - Detached subprocess that returns block + reason JSON to Claude Code
  - Companion to Sentinel R66 (dos.bashPolicy declaration)
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/DamageControl/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


# DamageControl

The Level-3 "global damage control" baseline. A PreToolUse hook that regex-blocks a fixed set of catastrophic shell patterns BEFORE Claude Code dispatches the Bash tool. Pattern set follows the indydevdan 2026-05 "Engineers, DELETE the BASH Tool" rubric.

**Scope.** This pack is a baseline, not a complete bash-policy engine. It catches the worst-of-the-worst — wholesale filesystem destruction, raw device writes, database drops, cluster-namespace deletion, infrastructure destroy commands. It does NOT and SHOULD NOT replace a real allowlist (whitelist posture) or managed policy engine; it is the floor under all postures.

## Threat model — read this before you trust it

DamageControl regex-tests the raw command **string**. That is a deliberate, bounded contract — name it so you don't over-trust the guard:

- **Who it defends against:** the *non-adversarial* agent — an LLM that hallucinates `terraform destroy` or fat-fingers a catastrophic command in good faith. It is NOT a defense against a prompt-injection adversary who controls the command string.
- **Precondition:** the command is a good-faith *literal*. **Postcondition:** listed catastrophic patterns are blocked. **The postcondition is VOID** the moment the command is obscured — variable expansion (`X=rf; rm -$X /`), command substitution (`$(echo rm) -rf /`), `eval`/`base64 -d`, empty quotes (`r''m -rf /`), `${IFS}` elision (`rm${IFS}-rf${IFS}/`), or script-file indirection (`bash bad.sh` — the hook only sees the wrapper). Equivalence of an obfuscated command to a blocked one under arbitrary shell evaluation is undecidable, so **no finite regex set closes this class.**
- **A deny-list fails OPEN** (anything unlisted is permitted). **Only the allowlist (whitelist) posture fails SAFE** — there, obfuscation fails *closed*. DamageControl is the deny-FLOOR *under* an allowlist, never a substitute for it. If you want a wall, set `dos.bashPolicy: "allowlist"`; DamageControl is the speed-bump for accidents beneath it.
- **Scope boundary: `tool_name === 'Bash'` only.** Background-bash is covered, but **MCP exec tools** (`mcp__*` docker / railway / sandbox exec) and other execution surfaces are OUT OF SCOPE and need their own guard. The name "global damage control" describes the *aspiration*, not the contract — the contract is the Bash-tool command string.

**On a DOS host, this pack is largely redundant.** DOS already ships an always-on, fail-closed `SecurityValidator.hook.ts` (HARDENED_FALLBACK floor) plus `RmGuard.hook.ts`, which already cover these catastrophic forms — and more correctly. DamageControl's genuine value is as the **portable, dependency-free distillation** of that canonical floor for *non-DOS / public installs* that have no SecurityValidator. Its pattern set should be kept in parity with SecurityValidator's HARDENED_FALLBACK, never hand-forked.

**Sprint provenance.** Scaffold lands in 28D sprint D11 (2026-05-15) alongside Sentinel R66 (`presence.bash-policy-declared`). R66 forces operators to declare `dos.bashPolicy` in `settings.json`; DamageControl provides one concrete implementation that satisfies the `"blacklist"` posture.

**Activation state in this sprint: OFF.** The PreToolUse hook ships as `Hooks/DamageControlBaseline.hook.ts.template` (note the `.template` suffix). Operator activates by:

1. Reviewing the pattern set in the template file (some patterns may be too aggressive for the operator's workflow — e.g. blanket `aws .* delete-volume` blocks legitimate volume rotation).
2. Renaming the file to `DamageControlBaseline.hook.ts` (drop the `.template`).
3. Wiring into `settings.json` under `hooks.PreToolUse` as a detached subprocess.
4. Setting `dos.bashPolicy: "blacklist"` in `settings.json` (closes the R66 check).

Until those four steps run, this pack is documentation-only.

## Workflow Routing

This pack ships **no workflows** (`workflows: []`). Activation is the operator runbook in
**Activation state** above (review patterns → rename the `.template` → wire `settings.json` → set
`dos.bashPolicy`). A request to "set up / activate damage control" routes there, not to a workflow
file. (An earlier `Workflows/BaselineBlacklist.md` route was phantom — the file never existed.)

## Examples

**Example 1: Operator audits the pattern set before activation**
```
User: "Read the DamageControl baseline hook template and explain which patterns it blocks."
→ Open Hooks/DamageControlBaseline.hook.ts.template
→ Enumerate the BLOCK_PATTERNS array with one-line explanations per regex
→ Flag any pattern likely to false-positive in the operator's known workflows
```

**Example 2: Activate the baseline (operator-gated)**
```
User: "Activate DamageControl baseline."
→ Rename Hooks/DamageControlBaseline.hook.ts.template → DamageControlBaseline.hook.ts
→ Add a PreToolUse entry in settings.json pointing at the renamed file
→ Set dos.bashPolicy = "blacklist" in settings.json
→ Run bun ~/Durante/Tools/sync-check.ts to verify four-copy parity
```

**Example 3: Sentinel R66 surfaces a missing declaration**
```
Sentinel scan: "R66 fail — dos.bashPolicy field is absent"
→ Operator chooses a posture: "none" (opt out), "blacklist" (this pack), "whitelist", or "managed"
→ Update settings.json; re-run scan; R66 → pass
```

## Artifact Tracking

**MANDATORY for any workflow in this skill that writes output files via the Write tool.**

After writing any output file, resolve the ARTIFACTS path and append a JSONL log entry:

```bash
# Resolve ARTIFACTS dir (project-level first)
if [ -d "${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS"
elif [ -d "$(pwd)/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="$(pwd)/MEMORY/ARTIFACTS"
else
  ARTIFACTS_DIR="$HOME/.claude/MEMORY/ARTIFACTS"
fi
mkdir -p "$ARTIFACTS_DIR"

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"DamageControl","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only. The PreToolUse hook itself writes block-decision audit lines to `MEMORY/SECURITY/{YYYY}/{MM}/damage-control.jsonl` when activated — see the template's `recordBlock()` helper.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/damage-control/` — live install (what Claude Code runs) — created on operator activation
2. `Releases/v0.0.19/.claude/skills/damage-control/` — submodule (versioned, active release) — created on operator activation
3. `Packs/damage-control/src/` — pack source (distributable, lands this sprint)
4. `Packs/agents/DamageControl/` — not applicable (no agent runtime)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.

**Sync manifest note (operator-scoped).** This pack is NOT yet in `.dos-sync-manifest.json`. Adding it is an operator decision — D11 sprint deliverable is pack scaffold only; sync-manifest wiring is a follow-up step paired with the operator's activation choice.
