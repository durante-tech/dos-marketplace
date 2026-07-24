---
name: Sentinel
description: Architecture guardian that analyzes codebases, discovers conventions, populates knowledge systems, enforces patterns, and checks RFC conformance. The DOS initialization protocol — makes every feature immediately valuable when dropped into any repo. USE WHEN sentinel (scan, bootstrap, guard, conformance, evolve, status, review, memory-health, prd-lint, doctrine-drift), scan, guard, conventions, discover conventions, convention drift, convention health, architecture guardian, onboard, initialize, drop into repo, conformance, rfc compliance, check R<n>, analyze repo, empty repo init, check my changes, convention changed, review branch against conventions, memory health audit, memory subsystem audit, prd lint, doctrine drift, algorithm coverage. NOT for bug-hunting code review (use /code-review), PR fleet ops (use Github), shipping a feature end-to-end (use FeatureDelivery), expert design critique (use the council/voice packs), or palace/KG memory ops (use MemPalace).
role: analyzer
accepts:
  - text
roots:
  - PROTECTED_LOCAL
  - PROJECT.WORK
  - PROJECT.LEARNING
  - PROJECT.RESEARCH
  - PROJECT.ARTIFACTS
visibility: public
capabilities:
  - artifact.write
  - customization.cascade
  - four-copy.sync
composes: [/code-review, Github, FeatureDelivery, MemPalace]
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Sentinel/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Sentinel — Architecture Guardian

Sentinel solves the cold-start problem: when an AI operating system lands in a new repo, it knows nothing. Sentinel analyzes the codebase, discovers conventions, populates the knowledge graph, generates CLAUDE.md rules, and then guards those conventions going forward.

**Three modes:**
- **Scan** — analyze once, populate everything (the "awakening")
- **Guard** — enforce continuously, evolve when patterns change
- **Conformance** — verify RFC §13 profile obligations against live code

## Workflow Routing

| Request Pattern | Route To |
|---|---|
| sentinel scan, analyze repo, discover conventions, initialize, scan codebase | `Workflows/Scan.md` (auto-branches to `Workflows/Bootstrap.md` for empty projects) |
| sentinel bootstrap, empty repo init, scaffold new repo, no-code interview | `Workflows/Bootstrap.md` (also reached automatically from Scan on an empty repo) |
| sentinel guard, check conventions, convention check, check my changes, check my code | `Workflows/Guard.md` |
| sentinel conformance, rfc conformance, check R<n>, profile check, §13 check | `Workflows/Conformance.md` |
| sentinel review, review PR, review branch, architecture review | `Workflows/Review.md` |
| sentinel evolve, update convention, new pattern, convention changed | `Workflows/Evolve.md` |
| sentinel status, convention health, what conventions, show conventions | `Workflows/Status.md` |
| sentinel memory-health, mem health, check memory, memory observability | `Workflows/MemoryHealth.md` |
| sentinel prd-lint, lint prds, check prd compliance, prd hygiene | `Workflows/PRDLint.md` |
| sentinel doctrine-drift, doctrine coverage, check doctrine, algorithm coverage | `Workflows/DoctrineDrift.md` |
| sentinel version-review, version readiness review, version council review, pre-freeze review, "I'm about to tie a version" | native workflow (RFC-0121, Sentinel-owned) — invoke via `Workflow({ name: "version-council-review", args: { target: "<abs repo path>", versionLabel: "vX.Y.Z" } })`; optional args `maxPRDs` / `maxSubsystems` / `maxOppsPerRoute` / `scaffoldPRDs`. Read-only on the target. Sentinel COMPOSES the specialist council over its own artifacts here (typed `agentType` seats + schema-enforced returns); the critique itself is rendered by the specialist seats, preserving the pack boundary |

## Quick Reference

| Workflow | Purpose | Inference | Speed |
|----------|---------|-----------|-------|
| **Scan** | Full codebase analysis + KG population | Sonnet (1 call) | ~30-60s |
| **Bootstrap** | Empty project interview + scaffold (auto via Scan) | None | ~45-60s |
| **Guard** | Check staged changes against conventions | Sonnet (1 call) | ~10-20s |
| **Conformance** | Run RFC §13 profile matrix (pre-commit Gate 5) | None | ~2-5s |
| **Review** | Full branch review | Sonnet (1 call) | ~20-40s |
| **Evolve** | Update convention when patterns change | None | ~5s |
| **Status** | Show convention health | None | ~2s |
| **MemoryHealth** | Audit + score the memory subsystem (operator-gated `--fix`) | None | ~3-5s |
| **PRDLint** | Lint PRDs for frontmatter/ISC/memory-health hygiene | None | ~3-5s |
| **DoctrineDrift** | Check Algorithm-doctrine coverage against live code | None | ~3-5s |
| **VersionReview (native)** | Version-cut council: reconcile PRD claims vs code, specialist opportunities (typed seat returns), readiness verdict | agentType council (sonnet/opus staged) | ~10-20min, real spend |

## When to Use Which Workflow

The four convention-checking workflows overlap — pick by scope and write-intent:

- **Guard** — fast pre-commit check of *staged/unstaged changes* against the convention cache. Use before work lands. Read-only verdict, narrowest scope.
- **Review** — full *branch/PR* review (`git diff main...HEAD`) against conventions. Use when a feature is done. Broader than Guard, still read-only.
- **Conformance** — runs the *RFC §13 R-rule profiles* (`check R<n>` / profile matrix), not free-form convention drift. Use for doctrine/pre-commit Gate 5 obligations. Deterministic, code-grep based.
- **Status** — read-only *health snapshot* of stored conventions (counts, freshness). Use to inspect what Sentinel knows; it checks nothing against your diff.

Tie-break: a diff to verify → Guard (staged) or Review (branch); an R-rule or profile → Conformance; "what do we know / how healthy is it" → Status.

## Integration

### Uses
- **MemPalace** — KG triples + semantic drawers for convention storage
- **Inference.ts** — Sonnet-level pattern recognition
- **Project resolver** — Map repo path to MemPalace wing

### Feeds Into
- **FeatureDelivery** — Guard output feeds into the 10-point review checklist
- **MemPalace** — Scan populates project knowledge for all other DOS features

### Does NOT Replace
- **Compliance Pack** — Sentinel does architecture/conventions, Compliance does SAST/secrets/regulatory
- **FeatureDelivery Review** — Sentinel is one INPUT to the review, not a replacement
- **/code-review** — Sentinel checks architecture/convention conformance (does this match how the repo is built), NOT line-level correctness or bug hunting. For "find the bug in this diff", use `/code-review`.
- **Github** — Sentinel never touches the PR fleet. Listing PRs, posting comments, orchestrating multi-perspective PR reviews, and gating merges belong to the github pack.
- **the council/voice packs** — Sentinel renders mechanical convention/RFC verdicts, not named-expert design critique. For Fowler/Cockburn/UncleBob-style judgment, use the council/voice packs (`dream-team`, `thinking` council, the specialist seats).
- **memory-surface boundary** — Sentinel **MemoryHealth** audits + scores the memory subsystem and offers an operator-gated `--fix`; it is not the substrate. **MemPalace** (Garden/Status) owns palace-substrate recovery + KG status, and `dos-memory-status.ts` is the raw radiator. Sentinel reports on memory health; it does not rebuild the palace.

## Conformance R-Rule Catalog

**Do not hand-maintain the rule list here.** The authoritative catalog is GENERATED
from `Tools/ConformanceChecks/registry.ts` (the single source of truth for every
R-rule handler) and lives in `Workflows/Conformance.md` inside the
`<!-- BEGIN generated-catalog -->` / `<!-- END generated-catalog -->` block.
Regenerate it with:

```bash
bun Packs/sentinel/src/Tools/ConformanceChecks/catalog.ts --md
```

Registry ↔ catalog parity is enforced by the `presence.rrule-catalog-registry-parity`
handler (R85): if a rule is added to the registry but the generated block is stale, the
conformance run fails. The registry now ships ~100 keys (through the R85 namespace) — the
old hand-written "R1–R43" enumeration is retired because it implied R43 was the ceiling,
which has been false since the registry overtook the prose.

**RFC namespaces (orientation only — see the generated catalog for the live per-rule list):**
the rules span RFC-0005 (v1-wired MemPalace bridge + memory-write profile), RFC-0028
(session-end / intel / security / RFC-corpus), RFC-0059 (the three doctrine-coverage
profiles — `tier-1-doctrine-presence`, `tier-2-dynamic-traces`, `tier-3-system-coherence`),
RFC-0060 / RFC-0061 (later doctrine + resilience expansions), and RFC-0062 (DLQ ↔ Studio
reconciliation). R-IDs are scoped per RFC namespace, so the same R-ID may appear in more
than one RFC without collision. For the exact rule set on this version, read the generated
block in `Workflows/Conformance.md`, never this summary.

## Examples

**Example 1: Initialize a repository**

User: "sentinel scan"

Analyzes the current repo, populates KG + CLAUDE.md, and outputs the convention summary.

**Example 2: Guard current changes**

User: "sentinel guard"

Checks staged changes against known conventions and reports violations before the work lands.

**Example 3: Check doctrine coverage**

User: "sentinel conformance"

Runs the RFC profile matrix and reports per-R-point pass/fail/not_applicable.

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

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"Sentinel","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/sentinel/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/sentinel/` — active release submodule (versioned)
3. `Packs/*/src/Sentinel/` — pack source (distributable)
4. `Packs/agents/Sentinel/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
