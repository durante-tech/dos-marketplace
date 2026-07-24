---
name: Generate
description: Pack an RFC slice into a self-contained /loop prompt and pre-committed PRD stub
status: STABLE
---

# Generate Workflow

Generates a copy-paste `/loop` block (RFC slice + ISC + rails + gates) and a PRD stub from any RFC in `Plans/Specs/`.

## Step 1: Resolve the RFC

Ask the caller for the RFC identifier if not already provided. Acceptable forms:

- `0007` — numeric prefix
- `RFC-0007` — filename prefix
- `verifiable completion` — title substring
- `Plans/Specs/RFC-0007-verifiable-completion-protocol.md` — full path

Invoke the CLI:

```bash
bun ~/Durante/Packs/utilities/src/RfcToLoop/Tools/GeneratePrompt.ts \
  --rfc "$RFC" \
  [--slice "$SLICE"] \
  [--effort extended] \
  [--dry-run]
```

The CLI exits **2** with a candidate list if the `--rfc` value matches more than one file. Disambiguate and retry.

## Step 2: Pick a slice (optional)

If `--slice` is omitted, the CLI walks headings under the RFC body and selects the first section that:

- contains `Pending`, `Not started`, `Planned`, `TODO`, or
- contains at least one unchecked `- [ ]` checkbox.

If the CLI finds zero or multiple unfinished candidates, it exits **3** with the list. Provide `--slice "10.3 Phase 3"` or similar to disambiguate.

## Step 3: Review the emitted block

The `/loop` block printed to stdout contains:

1. **Opening fence** with the `/loop` invocation line.
2. **Task line** and target slug.
3. **RFC excerpt** — the selected slice inlined verbatim.
4. **ISC checklist** seed — derived from slice acceptance criteria or emitted as a TODO list if none were found.
5. **Constitutional rails** — four-copy rule, sync-check gate, voice-lint exempt pragma, commit attribution, submodule-first order.
6. **Completion gates** — typecheck / test / sync-check / reflection JSONL command.
7. **Closing fence**.

Copy the block and paste it into a fresh Claude Code session under the target project.

## Step 4: Inspect the pre-committed artifacts

Unless `--dry-run` was passed, the CLI wrote two files under the resolved work directory:

- `PRD.md` — frontmatter only (`phase: observe`, `progress: 0/N`), ready for the fresh session to populate.
- `PROMPT.md` — the `/loop` block saved for reference / re-paste.

The work directory resolution cascade:

1. `--out <path>` (explicit override)
2. `$CLAUDE_PROJECT_DIR/MEMORY/WORK/`
3. `$CWD/MEMORY/WORK/`
4. `~/.claude/MEMORY/WORK/`

## Step 5: Ship it

In the fresh session, paste the `/loop` block. The Algorithm's OBSERVE phase will:

- Read the inlined RFC excerpt (no external lookup required).
- Decompose the ISC seed into atomic criteria.
- Honor the constitutional rails as mandatory preconditions.
- Run the completion gates at VERIFY.
- Append the reflection JSONL at LEARN.

## Examples

**Example 1: Pack the next unfinished slice of RFC-0007**
```bash
bun ~/Durante/Packs/utilities/src/RfcToLoop/Tools/GeneratePrompt.ts --rfc 0007
```

**Example 2: Dry-run a specific slice**
```bash
bun ~/Durante/Packs/utilities/src/RfcToLoop/Tools/GeneratePrompt.ts \
  --rfc 0007 --slice "10.3 Phase 3" --dry-run
```

**Example 3: Target a non-DOS project**
```bash
CLAUDE_PROJECT_DIR=~/Experiments/altyaa \
  bun ~/Durante/Packs/utilities/src/RfcToLoop/Tools/GeneratePrompt.ts \
  --rfc altyaa-onboarding --effort advanced
```

## Artifact Tracking

On successful (non-dry-run) invocation, append an entry to `MEMORY/ARTIFACTS/artifacts.jsonl`:

```json
{"pack":"Utilities","workflow":"RfcToLoop.Generate","type":"loop-prompt","title":"<rfc-id> :: <slice>","path":"<resolved-out>/PROMPT.md","wing":"<resolved-from-cwd>","sessionId":"<SESSION_ID>"}
```

The CLI writes this line itself when `--out` resolves successfully.
