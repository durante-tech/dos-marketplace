---
name: Catalog
description: Read-only inspection of the Channel Voice family — list instances, per-instance summary, drift signals against the invariants.
status: STABLE
---

# Catalog — Inspect the Channel Voice family

List or inspect the Channel Voice family of skills. Read-only workflow.

Canonical reference: `MEMORY/CANONICAL/channel-voice-pattern.md`.

---

## Step 0 — Voice notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running Catalog workflow in ChannelScaffold skill to inspect the channel voice family"
```

Output:
```
Running the **Catalog** workflow in the **ChannelScaffold** skill to inspect the channel voice family...
```

---

## Step 1 — Enumerate the family

The lineage source of truth is the canonical doc's machine-readable
`<!-- voice-lineage: ... -->` line. One source of truth; this workflow reads
from it, never duplicates the names.

```bash
# Parse legacy Voices from canonical doc (one source of truth).
# Word-split is forced via $(echo ...) for zsh/bash portability:
LEGACY=$(grep '^<!-- voice-lineage:' ~/Durante/MEMORY/CANONICAL/channel-voice-pattern.md \
         | sed 's|<!-- voice-lineage: ||;s| -->||')

# Legacy / hand-authored (predate ChannelScaffold):
for V in $(echo "$LEGACY"); do
  [ -d ~/.claude/skills/$V ] && echo "$V (hand-authored)"
done

# ChannelScaffold-minted — provenance header signature is the canonical detector:
grep -l 'minted-by: ChannelScaffold' ~/.claude/skills/*/SKILL.md 2>/dev/null \
  | xargs -I {} dirname {} | xargs -I {} basename {}
```

**As the family grows**, append new Voice names to the canonical doc's
`voice-lineage` line. This Catalog auto-updates with zero edits here.

---

## Step 2 — Per-instance summary

For each instance, capture:

| Field | Source |
|---|---|
| Voice name | dir name |
| Voice full name | `Biography.md` first line |
| Corpus primary | `SKILL.partials.md` description |
| Voice tic | `SKILL.partials.md` description ("speaks as ...") |
| Lookup name | filename of the Lookup table (e.g., `SmellsLookup.md`) |
| Lookup code prefix | grep `^| \`PREFIX-` in lookup file |
| Council seat eligible | grep "Co-recruits as Council seat" in SKILL.partials.md |
| Quote count | `grep -c '^### .*-Q-' QuoteBank.md` |
| Principle count | `grep -c '^### .*-P-' Principles.md` |
| Step-aside boundary count | count rows in StepAsideTable.md table |
| Mint timestamp | `<!-- minted-by: ... -->` header, or "(hand-authored)" |

Render as a markdown table for the operator.

---

## Step 3 — Optional: deep-inspect one Voice

If operator names a specific Voice ("inspect Fowler"):

```bash
echo "=== Files ==="
ls ~/.claude/skills/${VOICE_NAME}/

echo "=== SKILL description ==="
head -5 ~/.claude/skills/${VOICE_NAME}/SKILL.md

echo "=== Quote count ==="
grep -c '^### .*-Q-' ~/.claude/skills/${VOICE_NAME}/QuoteBank.md

echo "=== Principle count ==="
grep -c '^### .*-P-' ~/.claude/skills/${VOICE_NAME}/Principles.md

echo "=== Step-aside boundaries ==="
grep '^|' ~/.claude/skills/${VOICE_NAME}/StepAsideTable.md | head -10
```

---

## Step 4 — Surface drift signals

For each instance, flag:

- 🔴 CRITICAL: `[[VERBATIM_QUOTE` or `[[FILL` markers still present in shipped skill (means the decisions-checklist was not worked).
- 🟡 YELLOW: Quote count < 30 (mature target is 60-100).
- 🟢 GREEN: no markers + quote count ≥ 30.

Efficient implementation: hoist both signals out of the per-skill loop. One
filesystem walk for unfilled markers across all 9; one `grep -c` per QuoteBank.md
(no recursive scan needed since QuoteBank is a single file). Total ~11 subprocess
spawns instead of ~27.

```bash
# Pull lineage from canonical doc (single source of truth):
LEGACY=$(grep '^<!-- voice-lineage:' ~/Durante/MEMORY/CANONICAL/channel-voice-pattern.md \
         | sed 's|<!-- voice-lineage: ||;s| -->||')

# Build absolute paths for the present skills:
PATHS=""
for V in $(echo "$LEGACY"); do
  [ -d ~/.claude/skills/$V ] && PATHS="$PATHS $HOME/.claude/skills/$V"
done

# ONE filesystem walk: which skills have unfilled markers?
UNFILLED_SKILLS=$(grep -rlE '\[\[VERBATIM_QUOTE|\[\[FILL' $PATHS 2>/dev/null \
                  | awk -F/ '{print $(NF-1)}' | sort -u)

# Tier each skill by drift signal:
for V in $(echo "$LEGACY"); do
  [ -d ~/.claude/skills/$V ] || continue
  if echo "$UNFILLED_SKILLS" | grep -qx "$V"; then
    echo "$V: 🔴 unfilled markers present"
  else
    QB=~/.claude/skills/$V/QuoteBank.md
    if [ -f "$QB" ]; then
      # Three formats observed in the wild:
      #   - ChannelScaffold-template: `### CODE-Q-NNN`
      #   - Numbered list (most legacy 9): `1. ...`
      #   - Blockquote (KentBeck): `> "..."`
      QUOTES=$(grep -cE '^### .*-Q-|^[0-9]+\. |^> "' "$QB" 2>/dev/null)
    else
      QUOTES=0
    fi
    QUOTES=${QUOTES:-0}
    if [ "$QUOTES" -lt 30 ]; then
      echo "$V: 🟡 $QUOTES quotes (<30 mature target)"
    else
      echo "$V: 🟢 $QUOTES quotes"
    fi
  fi
done
```

---

## Step 5 — Return the catalog to operator

Output the table + drift signals. Do not modify any skill files — Catalog is
strictly read-only.
