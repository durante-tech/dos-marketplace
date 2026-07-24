---
name: Release
description: Freeze current DOS version and open the next one. Runs pre-release validation, 3-copy sync audit, manifest generation, version freeze, and new version setup.
status: STABLE
---

# DOS Release Workflow

Freeze the current version, validate everything, and open the next one. This is the one command that handles the entire release process.

## Trigger Phrases

- "release DOS", "freeze version", "ship it", "cut release", "open next version"
- "release freeze", "version freeze", "prepare release"

## Step 0: Read Current State

Read `settings.json` and `dos-manifest.json` to determine the current version:

```bash
# Current version from settings.json
CURRENT_VERSION=$(jq -r '.dos.version' ~/.claude/settings.json)
RELEASE_PATH=$(jq -r '.dos.releasePath' ~/.claude/settings.json)
echo "Current: v${CURRENT_VERSION} at ${RELEASE_PATH}"
```

Calculate the next version (bump patch):
```bash
# e.g., 0.0.3 → 0.0.4
NEXT_VERSION=$(echo "$CURRENT_VERSION" | awk -F. '{print $1"."$2"."$3+1}')
echo "Next: v${NEXT_VERSION}"
```

**Ask for confirmation before proceeding:**
"Ready to freeze v{CURRENT_VERSION} and open v{NEXT_VERSION}. Continue?"

## Step 1: Pre-Release Validation

Run ALL validation checks before touching anything. If any fail, stop and fix.

### 1a. Sync Audit (canonical verifier)

Run the canonical sync verifier — NOT ad-hoc `diff` loops (retired per `[R-sync-mechanism]`; the manifest handles aliases, exclusions, and generated files that hand-rolled loops miss):

```bash
bun ~/Durante/Tools/sync-check.ts            # exit 0 = clean, 1 = drift
bun ~/Durante/Tools/sync-check.ts --full     # per-file detail when drift found
```

**If ANY drift found:** resolve it (`--fix --dry-run` then `--fix`, or targeted deploy) before proceeding.

### 1b. Manifest Validation

```bash
bun ~/Durante/Tools/generate-manifest.ts --check
```

This validates CLAUDE.md and Playbook docs against computed counts. Fix any stale references.

### 1c. Secrets Check

```bash
bun ~/Durante/Tools/validate-protected.ts
```

### 1d. Gateway Lockdown Check

```bash
# No provider-specific env vars in error messages
count=$(grep -rn "throw.*CLIError.*\(REPLICATE\|OPENAI\|ELEVENLABS\|GOOGLE\|REMOVEBG\|XAI\|PERPLEXITY\|BRAVE\|APIFY\|FIRECRAWL\|BRIGHTDATA\).*\(KEY\|TOKEN\)" \
  ~/.claude/skills/ 2>/dev/null | grep -v node_modules | wc -l)
[ "$count" -gt 0 ] && echo "FAIL: $count provider key references in error messages" || echo "OK: Zero provider key leakage"
```

### 1e. Missing Docs Check

```bash
for pack in ~/Durante/Packs/*/; do
  name=$(basename "$pack")
  [ "$name" = "Agents" ] && continue
  [ ! -f "$pack/INSTALL.md" ] && echo "MISSING: $name/INSTALL.md"
  [ ! -f "$pack/VERIFY.md" ] && echo "MISSING: $name/VERIFY.md"
  [ ! -f "$pack/README.md" ] && echo "MISSING: $name/README.md"
done
```

### 1f. Bridge Tests

```bash
cd ~/Durante/Packs/mem-palace/src/Tools
uv run --with "mempalace>=3.3.0" --with pytest python3 -m pytest tests/test_bridge.py -v --tb=short
```

### 1g. Update Counts

```bash
bun ~/.claude/hooks/handlers/UpdateCounts.ts
```

Ensures settings.json has fresh counts before freezing.

**Report all results.** If all green, proceed to Step 2.

## Step 2: Generate Release Manifest

```bash
cd ~/Durante
bun Tools/generate-manifest.ts
```

This writes `dos-manifest.json` with computed counts, skill/hook/agent/pack enumerations. Commit it with the release.

## Step 3: Freeze Current Version

### 3a. Commit any uncommitted work in the submodule

```bash
cd ~/Durante/${RELEASE_PATH}
git status --short
# If anything uncommitted, stage EXPLICIT paths and commit.
# NEVER `git add -A` here: $CLAUDE_JOB_DIR lives inside the live submodule,
# and -A sweeps job-temp clones in as bogus gitlinks that break checkout.
git add <explicit-paths>
git commit -m "chore: pre-release cleanup for v${CURRENT_VERSION}"
git push origin main
```

### 3b. Tag the submodule — handled by release.sh

`release.sh` tags `v${CURRENT_VERSION}-final` itself as part of Step 3c. Only tag manually if you are NOT delegating to release.sh; tagging twice fails with "tag already exists".

```bash
git tag v${CURRENT_VERSION}-final
git push origin v${CURRENT_VERSION}-final
```

### 3c. Deinit the submodule and convert to flat copy — DELEGATE, do not hand-roll

Use the mechanized freeze tooling. Hand-rolling the deinit/clone/copy here omits `release.sh` Step 4b (the `~/.claude` symlink retarget) and the `.dos-sync-manifest.json` retargeting (native-workflow `submodule_abs` paths) — a manual freeze leaves both pointing at the old version.

```bash
# Inspect the plan first (Strangler-Fig over release.sh, RFC-0116 §2):
bun ~/Durante/Tools/dos-release-freeze.ts --target ${NEXT_VERSION} --dry-run

# Execute (Phase C currently delegates the mutation to release.sh):
bash ~/Durante/Tools/release.sh ${NEXT_VERSION}
```

The canonical 8-step procedure is `Docs/VersionHistory.md`; the full FREEZE → BUILD → PUBLISH → VERIFY cycle is `Docs/Playbook/RELEASE-PROCESS.md`. Freezing alone does NOT publish the npm package.

### 3d. New submodule for next version — handled by release.sh

`release.sh` already registers the next-version submodule (`git submodule add` at the new `Releases/v${NEXT_VERSION}/.claude`) as part of Step 3c. Do NOT re-run `git submodule add` manually — it fails with "already exists in the index" against the tree release.sh just prepared. Only verify:

```bash
NEXT_RELEASE_PATH="Releases/v${NEXT_VERSION}/.claude"
git config --file .gitmodules --get-regexp path | grep "${NEXT_RELEASE_PATH}" && echo "OK submodule registered"
```

## Step 4: Update All Version References

**A freeze bumps SIX fields — miss any one and the system reports a stale version** (per `Durante/CLAUDE.md` "Version-bump sites (six)"):

1. `version.json` → `dos`
2. `version.json` → `installer` (tracks `dos`; the `algorithm` field is the doctrine version — do NOT bump it on a release)
3. `settings.json` → `dos.version`
4. `settings.json` → `dos.releasePath`
5. `npm-package/package.json` → `version`
6. `DOS-Install/version.json` → `dos` (its `installer` field is the Electron installer-app version — a SEPARATE scheme; do NOT bump)

Verify parity after bumping — this gate is mandatory:

```bash
bun ~/Durante/Tools/validate-version-parity.ts
```

### 4a. settings.json (sites 3+4)

```bash
jq ".dos.version = \"${NEXT_VERSION}\" | .dos.releasePath = \"${NEXT_RELEASE_PATH}\"" \
  ~/.claude/settings.json > /tmp/settings-tmp.json && \
  mv /tmp/settings-tmp.json ~/.claude/settings.json
```

### 4b. CLAUDE.md

Find-and-replace all references to the old release path:

```
Releases/v${CURRENT_VERSION}/.claude → Releases/v${NEXT_VERSION}/.claude
```

Sections to update:
- Repository Structure tree
- Four Copies table (copy 2 location)
- Mandatory Sync Verification examples
- Submodule Workflow commands
- Version freeze history (add new entry)

### 4c. Playbook docs

Update every file in `Docs/Playbook/` that references the release path:
- RELEASE-PROCESS.md — version history table, all code examples
- THREE-COPY-RULE.md — copy 2 location, all cp commands
- DAILY-OPS.md — all submodule commands
- BETA-DEPLOYMENT.md — install path

### 4d. dos-manifest.json

Regenerate with the new version:
```bash
bun Tools/generate-manifest.ts
```

## Step 5: Commit and Push

```bash
cd ~/Durante

# Stage everything
git add \
  Releases/ \
  CLAUDE.md \
  Docs/Playbook/ \
  dos-manifest.json \
  .gitmodules

git commit -m "release: freeze v${CURRENT_VERSION}, open v${NEXT_VERSION}"
git push origin main
```

## Step 6: Post-Release Verification

### 6a. Verify frozen version is plain files (no .git)

```bash
[ -d ~/Durante/Releases/v${CURRENT_VERSION}/.claude/.git ] && echo "FAIL: .git still exists" || echo "OK: frozen as plain files"
```

### 6b. Verify new submodule works

```bash
cd ~/Durante/Releases/v${NEXT_VERSION}/.claude
git status
git log --oneline -3
```

### 6c. Verify settings.json updated

```bash
jq '.dos' ~/.claude/settings.json
# Should show version: NEXT_VERSION, releasePath: NEXT_RELEASE_PATH
```

### 6d. Verify manifest

```bash
jq '.version' ~/Durante/dos-manifest.json
# Should show NEXT_VERSION
```

## Output

```
DOS Release Complete

  Frozen: v{CURRENT_VERSION}
    Tag: v{CURRENT_VERSION}-final (pushed to cc-durante-studio)
    Location: Releases/v{CURRENT_VERSION}/.claude/ (plain files)

  Opened: v{NEXT_VERSION}
    Submodule: Releases/v{NEXT_VERSION}/.claude/ (tracking main)
    settings.json: dos.version = {NEXT_VERSION}
    CLAUDE.md: all paths updated

  Pre-release checks: {N}/{N} passed
  Manifest: dos-manifest.json regenerated
  Commit: {hash}

  Next: start building v{NEXT_VERSION}
```
