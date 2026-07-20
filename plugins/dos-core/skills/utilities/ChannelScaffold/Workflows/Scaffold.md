---
name: Scaffold
description: Stamp a new Channel Voice skill from a parameterized author brief; emits a DRAFT + decisions-checklist; never a finished skill.
status: STABLE
---

# Scaffold — Stamp a new Channel Voice skill

You are about to scaffold a new Channel Voice skill. Mechanical scaffolding is
fast (≤2 minutes); the irreducible domain work (verbatim quote curation,
principle naming, peer step-aside selection) belongs to the operator and is
captured in the emitted `decisions-checklist.md`.

**Canonical doctrine — read these BEFORE running this workflow:**

- `MEMORY/CANONICAL/channel-voice-pattern.md` — the meta-pattern + reserved colors/icons + sibling peer routes + IP-safety stance.
- `Packs/utilities/src/CreateSkill/Templates/VoiceChannelingSkill.md` — the 447-LOC canonical playbook this workflow is derived from. The playbook has 9-run-tested wisdom (Step 2.5 manifest layer, Step 2.6 pack-root docs, voice-distinction worksheet, brand-voice pre-flight, anti-patterns). This workflow EXECUTES the playbook; it does not replace it.
- `Packs/utilities/src/CreateSkill/Templates/voice-channeling-ip-policy.md` — IP policy enforced via QuoteBank.template.

**Template bundle:** `~/.claude/DOS/Scaffolds/channel-voice-skill/`.

## Two-turn delivery pattern (per playbook §"Two-Turn Delivery Pattern")

Channel Voice scaffolding genuinely takes two turns:

- **Turn 1 — Research Vault** (optional but recommended for first-of-Voice runs):
  3 parallel research agents extract the verbatim corpus into a `MEMORY/RESEARCH/{YYYY-MM-DD}_{author-slug}/` vault. See Step 4.5 below.
- **Turn 2 — Skill Scaffold** (this workflow): stamp the bundle, manifest layer, pack-root docs, brand-voice pre-flight.

If the operator already has a research vault from a prior turn → skip Step 4.5 and proceed to Step 5 (stamping).

---

## Step 0 — Voice notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running Scaffold workflow in ChannelScaffold skill to mint a new channel voice skill"
```

Output:
```
Running the **Scaffold** workflow in the **ChannelScaffold** skill to mint a new channel voice skill...
```

---

## Step 1 — Collect the brief

The operator brief is small — 6 required fields + 2 optional. Ask via
`AskUserQuestion` or accept from prose:

```yaml
voice_name: <PascalCase, will be dir name>          # required
voice_full_name: <full prose name>                  # required
corpus_primary: |                                   # required
  - <book/paper/talk 1, year>
  - <book/paper/talk 2, year>
voice_tic: I | we                                   # required (load-bearing)
lookup_name: <Voice's term for their lookup table>  # required
lookup_code_prefix: <3-5 uppercase letters>         # required
council_seat_eligible: yes | no                     # required
role_tagline: <5-8 word one-liner>                  # required

# optional
biography_note: <one paragraph>
known_peers:
  - <peer name + their primitives>
```

---

## Step 2 — Fit-check (REFUSE early when shape doesn't fit)

Before stamping ANY file, verify ALL of:

- [ ] Corpus has ≥50 verbatim citations available in publishable sources (book,
  paper, talk, archived blog).
- [ ] Voice has ≥10 named primitives (the operator can list them).
- [ ] Voice tic is `I` or `we` (no composite "I/we" — composites are not Voices).
- [ ] `lookup_code_prefix` is 3-5 uppercase letters AND unique vs existing skills:

```bash
grep -r "^| \`${lookup_code_prefix}-" ~/.claude/skills/ 2>/dev/null | head -3
# Should return EMPTY. If hits → STOP, prefix is taken.
```

**If ANY fit-check fails:** Skill DECLINES per Algorithm §4.2 Decline Protocol.
Surface the reason. Route the operator to a custom Agent compose, or to Surface
Crunch (for community discourse / multi-source synthesis). DO NOT stamp.

---

## Step 3 — Discovery-first probe

Confirm greenfield (no existing skill, no in-flight PRD):

```bash
ls ~/.claude/skills/${VOICE_NAME} 2>/dev/null && echo "EXISTING — refuse"
ls ~/Durante/Packs/utilities/src/${VOICE_NAME} 2>/dev/null && echo "EXISTING — refuse"
ls ~/Durante/MEMORY/WORK/active/*${VOICE_NAME_LOWER}* 2>/dev/null && echo "IN-FLIGHT PRD"
```

If ANY hit → STOP and route to operator (refuse to overwrite or duplicate).

---

## Step 3.5 — Voice-distinction worksheet (MANDATORY pre-stamp gate)

Per `VoiceChannelingSkill.md` §"Voice Distinction Worksheet" (load-bearing per
the 9-run playbook). Even before the bundle is stamped, the operator MUST be
able to fill in the worksheet — otherwise the stamped skill will collapse into
a sibling's voice and be dead weight.

Direct the operator (or stamp a copy at `~/Durante/Packs/utilities/src/${VOICE_NAME}/VoiceDistinctionWorksheet.md`) to fill in:

1. First-person register (with rationale)
2. Opening move (what ${VOICE_FULL_NAME} does at the start of essay/talk)
3. Closing move (what ${VOICE_FULL_NAME} does at the end)
4. Vocabulary register (lexical signature)
5. ≥6 anti-tells (concrete don'ts vs siblings)
6. **One-sentence distinction** — the load-bearing check

**If the operator cannot fill #6 confidently → ABORT this workflow.** Surface
to operator with the reason; route them to do more research before retrying.

Also verify reserved-palette distinctness:

```bash
# Check colorHex not reserved:
grep -E "^\| .* \| \`${COLOR_HEX}\`" ~/Durante/MEMORY/CANONICAL/channel-voice-pattern.md
# Should return empty. If hits → STOP, colorHex collides with a reserved sibling.

# Check icon not reserved (BookOpen / Hexagon / Layers / ListChecks / TestTube / GitBranch / Microscope / Diamond / ArrowDownUp):
case "${ICON}" in
  BookOpen|Hexagon|Layers|ListChecks|TestTube|GitBranch|Microscope|Diamond|ArrowDownUp)
    echo "COLLISION: icon ${ICON} is reserved"; exit 1 ;;
esac
```

## Step 3.7 — Turn 1 research vault — DISPATCH 3 parallel agents

This is the DIFFERENCE between ChannelScaffold today and the original Apr-27
playbook prompts: the original prompts dispatched 3 parallel research agents
that EXTRACTED verbatim quotes. ChannelScaffold automates that dispatch.

Skip ONLY if `--vault <existing-path>` is passed to the stamp tool in Step 5
(operator already has a vault from a prior turn). Otherwise this step is
MANDATORY when the goal is a runnable Voice skill (not just a checklist).

### Step 3.7.1 — Create vault directory

```bash
VAULT=~/Durante/MEMORY/RESEARCH/$(date -u +%Y-%m-%d)_${VOICE_NAME_LOWER}
mkdir -p "$VAULT"
```

### Step 3.7.2 — Pick the corpus-split shape

Per `Packs/utilities/src/CreateSkill/Templates/VoiceChannelingSkill.md`
§"Three-Agent Corpus Split":

**Split A — Single-author with broad book corpus** (UncleBob, Cockburn, Fowler,
KentBeck, EricEvans, Feathers, SandiMetz, GregYoung — 8 of 9 historical):

| Agent | Corpus |
|---|---|
| A | Architecture / core-discipline (central technical contribution) |
| B | Methodology / practices / secondary contributions |
| C | Voice + Bio + adjacent works (biographical hooks, cadence, peer engagements) |

**Split B — Co-author duo** (Pragmatic — Hunt + Thomas):

| Agent | Corpus |
|---|---|
| A | Tips/Concepts catalog (named bullets / patterns) |
| B | Practices + Anti-Patterns (applied advice) |
| C | Voice + Bio + Books (BOTH authors, with same-name disambiguation if needed) |

### Step 3.7.3 — Dispatch the 3 agents IN PARALLEL (single tool-use block)

Author the per-Voice brief for each agent. Each brief MUST include:

1. **Voice differentiation prose** — 1-2 paragraphs naming what makes this Voice
   distinct from all prior siblings (signature move, anti-tells, vocabulary
   register). Without this, the agents return generic content that collapses
   into a sibling. **Load-bearing.**
2. **Per-agent topic clusters** — concrete book chapters, paper titles, talk
   URLs the agent should mine. The original Apr-27 prompts listed 5-8 named
   sources per agent.
3. **IP-safety boilerplate** — every brief MUST cite
   `Packs/utilities/src/CreateSkill/Templates/voice-channeling-ip-policy.md`:
   short canonical terms `[verbatim]`, extended copyrighted prose `[paraphrase]`
   with faithful substance.
4. **Output contract** — write to `$VAULT/<file>.md` directly. Each agent owns
   distinct files (no merge conflicts):
   - Agent A → `$VAULT/Principles.md` + half of `$VAULT/QuoteBank.md`
     (sections 1-N for core technical)
   - Agent B → `$VAULT/Lookup.md` + second half of `$VAULT/QuoteBank.md`
     (sections N+1-M for methodology)
   - Agent C → `$VAULT/Biography.md` + `$VAULT/StepAsideTable.md` +
     `$VAULT/INDEX.md`
5. **Floor** — ≥10 verbatim quotes per agent (Agent A + B share QuoteBank),
   ≥30 total. Every quote tagged `[verbatim]` or `[paraphrase]`.
6. **Anti-tells** — no paraphrasing-as-verbatim, no drift into peer agents'
   corpora, no biographical filler in Agents A/B (that's Agent C's lane).
7. **Time budget** — 4-6 minutes per agent.

Dispatch all 3 agents in **one tool-use block** (single response, multiple
`Agent` calls). Subagent type: `Explore` (read-only research) or `general-purpose`.

### Step 3.7.4 — Assemble the vault

After all 3 agents return, write the 7th file:

- `$VAULT/SKILLDRAFT.md` — full SKILL.md draft, authored from the vault's
  Principles/QuoteBank/Lookup/StepAsideTable + the operator's voice-distinction
  worksheet. ~150-220 LOC. This is what the stamp tool will template-substitute.

### Step 3.7.5 — Hand vault to stamp tool

```bash
bun ~/Durante/Tools/stamp-channel-voice-skill.ts /tmp/${VOICE_NAME_LOWER}-brief.json \
    --vault "$VAULT"
```

The `--vault` flag tells the stamp tool to ingest the vault content INTO the
stamped pack source — substituting real verbatim quotes for `[[VERBATIM_QUOTE]]`
markers and copying filled Principles/Lookup/StepAside/Biography content.

**Without `--vault`** the tool falls back to template-stamping mode (the old
behavior), emitting placeholder markers + a 6-12h checklist.

### Reference instances

Read the existing 9 vaults to internalize the shape before authoring the brief:

```bash
ls ~/Durante/MEMORY/RESEARCH/2026-04-27_*/
# 2026-04-27_alistair-cockburn / 2026-04-27_eric-evans / ...
```

Each is ~860 LOC of filled content across 7 files. That's the target.

## Step 4 — Compute provenance hash + mint timestamp

```bash
PROVENANCE_HASH=$(echo "${VOICE_NAME}|${CORPUS_PRIMARY}|${VOICE_TIC}|${LOOKUP_CODE_PREFIX}|$(date -u +%s)" | shasum -a 256 | cut -c1-6)
MINT_TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
```

These get stamped into every file's `<!-- minted-by: ... -->` header.

---

## Step 5 — Stamp the bundle

Serialize the operator brief to a temporary JSON file (15 required fields), then
invoke the canonical stamp tool:

```bash
cat > /tmp/${VOICE_NAME_LOWER}-brief.json <<EOF
{
  "voice_name": "${VOICE_NAME}",
  "voice_full_name": "${VOICE_FULL_NAME}",
  "corpus_primary": "${CORPUS_PRIMARY}",
  "voice_tic": "${VOICE_TIC}",
  "lookup_name": "${LOOKUP_NAME}",
  "lookup_code_prefix": "${LOOKUP_CODE_PREFIX}",
  "council_seat_eligible": "${COUNCIL_SEAT_ELIGIBLE}",
  "role_tagline": "${ROLE_TAGLINE}",
  "color_hex": "${COLOR_HEX}",
  "icon": "${ICON}",
  "display_label": "${DISPLAY_LABEL}",
  "workflow_1_name": "${WORKFLOW_1_NAME}",
  "workflow_2_name": "${WORKFLOW_2_NAME}",
  "workflow_3_name": "${WORKFLOW_3_NAME}"
}
EOF

bun ~/Durante/Tools/stamp-channel-voice-skill.ts /tmp/${VOICE_NAME_LOWER}-brief.json
```

The tool (`stamp-channel-voice-skill.ts`) does everything inline:

1. **Brief validation** — 15 required fields, types checked, `voice_tic` ∈ {I, we}, `council_seat_eligible` ∈ {yes, no}.
2. **Reserved-palette collision check** — `color_hex` and `icon` rejected if they collide with one of the 9 reserved entries.
3. **`lookup_code_prefix` format check** — 3-6 uppercase letters.
4. **Longest-first sed substitution** — defensive ordering (`VOICE_FULL_NAME_LOWER` before `VOICE_FULL_NAME`, etc.) baked into the tool.
5. **Provenance hash + UTC timestamp** — computed deterministically per brief.
6. **Stamp 7 templates** (skip `README.md` and `_USAGE.md` — bundle docs, not stamped). `Lookup.template.md` is renamed to `${LOOKUP_NAME_PASCAL}Lookup.md`.
7. **4-gate hardened verify** — checks (a) zero unresolved `${...}` placeholders, (b) zero partial-substitution corruption, (c) `≥1` `[[VERBATIM_QUOTE:]]` marker in QuoteBank.md, (d) every stamped `.md` file has a provenance header.
8. **Exit 0 only if all 4 gates pass.** Output destination path + file count + brief_hash + mint_ts.

For dry-run (writes to `/tmp/channel-voice-stamp-${hash}/` instead of `Packs/`):
```bash
bun ~/Durante/Tools/stamp-channel-voice-skill.ts /tmp/${VOICE_NAME_LOWER}-brief.json --dry-run
```

The tool refuses to overwrite an existing destination — if `Packs/utilities/src/${VOICE_NAME}/`
already exists, you'll get `FAIL: COLLISION:` and Step 3's discovery-first probe
caught a false-negative that needs investigation.

---

## Step 6 — Hand off to CreateSkill ecosystem

```bash
# Build canonical SKILL.md from SKILL.partials.md:
bun ~/Durante/Tools/dos-build.ts skill \
  ~/Durante/Packs/utilities/src/${VOICE_NAME}

# Scaffold pack-level docs if needed (channel-skills typically ship at skill root):
# bun ~/Durante/Tools/scaffold-pack-docs.ts <pack-source>

# Lint the new pack:
bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --pack Utilities

# Verify four-copy clean:
bun ~/Durante/Tools/sync-check.ts
```

All three must exit 0. If any fail → surface the error to operator, do NOT proceed
to Step 6.5.

---

## Step 6.5 — Manifest layer (MANDATORY per RFC-0011 + RFC-0002 + RFC-0004 §6.1)

Per `VoiceChannelingSkill.md` §"Step 2.5 — Manifest layer". The 2026-04-27
cohort shipped without these and required a 19-file remediation pass — this step
prevents that regression.

Three files are required for every voice-channeling pack:

```bash
# plugin.json — zero-bridge (voice-channeling skills don't invoke MemPalace):
cat > ~/Durante/Packs/${VOICE_NAME}/plugin.json <<EOF
{"name":"${VOICE_NAME}","dos":{"bridge":[]}}
EOF

# extension.yaml — RFC-0002 minimal manifest:
# Author with `contributes: {}`, `requires: {}`, and metadata block listing
# pack/invocation/skill_path/roots/workflows/runtime_effects/voice_channeling=true.
# Use ~/Durante/Packs/cockburn/src/extension.yaml as the canonical template.

# slice-N-not-partializable doc — RFC-0006 §5.2c — voice-channeling skills MAY
# share one doc covering all of them. Check if a current one exists:
ls ~/Durante/MEMORY/ARCHIVE/RFC-0006/Phase3/Verification/slice-*-not-partializable-voice-channeling.md
# If yes: extend it. If no: author one citing this new Voice.
```

Verify R11 lint passes after manifest layer is in place:

```bash
bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --rule R11 --pack ${VOICE_NAME}
# Must exit 0. R11 + pre-commit Gate 12 enforce.
```

---

## Step 6.6 — Pack-root distribution docs (MANDATORY)

Per `VoiceChannelingSkill.md` §"Step 2.6". Required by the `Packs/README.md`
4-file contract — without these the pack cannot be installed standalone.

```bash
bun ~/Durante/Tools/scaffold-pack-docs.ts --pack ${VOICE_NAME}
```

This generates `INSTALL.md` + `README.md` + `VERIFY.md` at the pack root,
modeled on `Packs/agents/*` exemplars. The scaffolder reads SKILL.md frontmatter,
lists src/ tree, and templates per-pack content.

R12 + pre-commit Gate 13 enforce presence (warn → block after 14-day rollout).

---

## Step 6.7 — Brand-voice pre-flight (MANDATORY before commit)

Per `VoiceChannelingSkill.md` §"Brand-Voice Allowlist". **Use `--paths`** —
`DEFAULT_GLOBS` does NOT include `Packs/**`, so default-mode pre-flight is
silently incomplete.

Quick own-prose grep FIRST (catches own-prose drift before the validator):

```bash
rg -n -i "guarantee|leverage|seamless|empower|production-grade|production-ready|revolutioniz|game-changing|synergy|supercharg" ~/Durante/Packs/${VOICE_NAME}/src/
```

If hits in own prose → rephrase before pre-flight (Fowler's "multiplies" →
"compounds" precedent). If hits inside `[verbatim]` source → may need allowlist
addition (see below).

Then the validator:

```bash
bun ~/Durante/Tools/validate-brand-voice.ts --paths 'Packs/${VOICE_NAME}/src/**/*.md'
```

Empirical (per playbook): 5/9 ship clean, 2/9 need allowlist-add, 2/9 need
rephrase. If violation surfaces:

- **Verbatim canonical author terminology** → add file to `FULL_FILE_ALLOWLIST` in `validate-brand-voice.ts` with a comment explaining the source.
- **Own prose** → rephrase.

Re-run validator after fixes — must exit 0.

---

If any of Steps 6.5 / 6.6 / 6.7 fails → surface the error to operator, do NOT
proceed to Step 7.

---

## Step 7 — Surface the decisions-checklist

Print to console:

```
✅ Channel Voice skill DRAFT minted at:
   ~/Durante/Packs/utilities/src/${VOICE_NAME}/

📋 The skill is deliberately not runnable yet. Work the checklist:
   ~/Durante/Packs/utilities/src/${VOICE_NAME}/decisions-checklist.md

⏱  Estimated time: 4-8 hours (the quote curation is the heavy lift).

🔄 When the checklist is done, re-run:
   bun ~/Durante/Tools/dos-build.ts skill <pack-source>
   bun ~/Durante/Tools/lint-skills.ts --pack Utilities
   bun ~/Durante/Tools/sync-check.ts
```

---

## Step 8 — Append to ARTIFACTS ledger

```bash
echo '{"timestamp":"'$MINT_TS'","pack":"ChannelScaffold","workflow":"Scaffold","type":"draft-skill","title":"'${VOICE_FULL_NAME}'","path":"'~/Durante/Packs/utilities/src/${VOICE_NAME}'","brief_hash":"'$PROVENANCE_HASH'","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

---

## Step 9 — Done

Return the skill path + checklist path to the operator. Do not pre-fill any
verbatim quotes — that obligation is the operator's, and the load-bearing
invariant of the Channel Voice family.

---

## Anti-patterns (don't do these — playbook §"Anti-Patterns When Scaffolding")

- **Don't skip the voice-distinction worksheet (Step 3.5).** Skills that collapse into siblings' voices are dead weight.
- **Don't run `validate-brand-voice.ts` without `--paths`** for new packs — `DEFAULT_GLOBS` skips `Packs/**`, so default-mode pre-flight is silently incomplete.
- **Don't `cd ~/.claude` then forget to `cd ~/Durante` before parent commit** — shell cwd persists across Bash calls. (Memory: `git-commit-cwd-in-submodule.md`.)
- **Don't paraphrase verbatim quotes** — the entire skill is built on quote fidelity. Tag `[verbatim]` only for confirmed exact wording. See `voice-channeling-ip-policy.md`.
- **Don't reconstruct extended in-copyright prose and tag it `[verbatim]`** — IP overreach. Short canonical terms `[verbatim]`, extended body prose `[paraphrase]` with faithful substance.
- **Don't skip the own-prose grep before the validator runs.** The grep recipe in Step 6.7 catches own-prose violations before the validator does.
- **Don't conflate same-name authors** (Dave Thomas Pragmatic vs OTI; the two Marties: Fowler vs Martin). Disambiguate explicitly in StepAsideTable.md.
- **Don't skip Step 6.5 manifest layer** — the 2026-04-27 cohort shipped without it and required a 19-file remediation pass. R11 + pre-commit Gate 12 will block.
