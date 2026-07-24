---
name: Plan
description: Walk a DOS artifact and target project to produce a reviewable DELIVERY-PLAN.md (DAG, roles, rails, gaps)
status: STABLE
---

# Plan Workflow

Takes a source artifact (RFC, spec, session-prompt, brief, PRD) and a target project path. Produces `DELIVERY-PLAN.md` with inferred roles, dependency DAG partitioned into waves, discovered project rails, and explicit Gaps for the operator to fill. **The plan file IS the review surface** — operator edits it, then calls Emit.

## CLI Invocation

```bash
bun ~/Durante/Packs/utilities/src/Ensemble/Tools/RunPlan.ts \
  --artifact <path-to-artifact> \
  [--project <target-project-dir>] \
  [--llm-fallback] \
  [--out <work-dir>] \
  [--dry-run]
```

### Flag reference

| Flag | Meaning |
|------|---------|
| `--artifact` | **Required.** Path to the source artifact. Any markdown file works; structured RFCs extract cleanest. |
| `--project` | Path to the target project for rails discovery. Defaults to `$CLAUDE_PROJECT_DIR`, then cwd. |
| `--llm-fallback` | Enable Inference.ts CLI fallback for CLAUDE.md digest gaps. Requires `claude` CLI on PATH. |
| `--out` | Override default output directory. Default cascade: `$CLAUDE_PROJECT_DIR/MEMORY/WORK/` → `$CWD/MEMORY/WORK/` → `~/.claude/MEMORY/WORK/`. |
| `--dry-run` | Emit `DELIVERY-PLAN.md` to stdout only; no file write. |

## Steps

1. **Resolve artifact** — read the file, hash it (sha256), extract title from first `# ` heading.
2. **Discover target-project rails** — invoke `DiscoverRails.ts` on the project path. Runs the 10 grep signals in parallel:
   - Four-copy rule mention in CLAUDE.md
   - Submodule presence (`git submodule status`)
   - Sync-check manifest (`.dos-sync-manifest.json`)
   - Package manager (lockfile probe)
   - Monorepo shape (`pnpm-workspace.yaml` / `turbo.json` / `nx.json`)
   - Typecheck + test commands (`package.json` scripts)
   - Pre-commit hook presence
   - Commit-convention heuristic (last 20 git commits)
   - Available DOS skills (`~/.claude/skills/` inventory)
   With `--llm-fallback`, shells out to `bun ~/.claude/DOS/Tools/Inference.ts --level fast` for any CLAUDE.md sections grep didn't resolve. Whatever remains unresolved becomes Gaps.
3. **Load operator preferences** — read `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Ensemble/PREFERENCES.md` if present. Evaluate `when:` blocks against project path / wing / git remote. Merge over discovered rails; annotate every override in the plan (so the operator sees L2-discovered vs L3-overridden side by side).
4. **Extract work units** — walk the artifact's heading tree, numbered sections, and acceptance checkboxes. Each work unit gets: `id`, `title`, `artifact_section`, `acceptance_criteria`, `raw_content`.
5. **Infer roles + deps** — one `Inference.ts` (fast / Haiku) call passes the work units + rails context. Returns role proposals (not a fixed taxonomy — domain-appropriate names each time), unit→role assignments, file-zone claims, dep edges. Shape-validated inline (no Zod dependency).
6. **Build waves** — `BuildWaves.ts` topo-sorts dep edges into maximal-parallelism waves. Wave 0 = units with no deps. Wave N = units all of whose deps are in waves ≤ N-1. Throws on cycle detection.
7. **Render DELIVERY-PLAN.md** — produces the final plan markdown with: source artifact block, target rails block, roles + file-zones table, work-units DAG, waves partition, operator `## Gaps` checklist, open questions.
8. **Write** to `<out>/{YYYYMMDD-HHMMSS}_ensemble-{artifact-slug}/DELIVERY-PLAN.md` plus a machine-readable `PLAN-META.json` (consumed by Emit).

## Gaps convention — critical

`## Gaps` in DELIVERY-PLAN.md is an `- [ ]` checklist. **Every item is something Emit will refuse to proceed against.** Common categories:

- **Rails unknown** — no typecheck command found; verify manually
- **Role ambiguous** — two roles could own §X; pick one
- **Dep uncertain** — work unit W5 might depend on W3; confirm or remove
- **Acceptance missing** — work unit W7 has no acceptance criteria in the artifact; derive or defer
- **Skill unavailable** — proposed `use_skills: [X]` not installed; drop or replace

Operator either edits upstream (artifact, CLAUDE.md, PREFERENCES.md) and re-runs Plan, or edits DELIVERY-PLAN.md directly and checks the gap.

## Emitted artifacts

- `<out>/{slug}/DELIVERY-PLAN.md` — the review surface (markdown)
- `<out>/{slug}/PLAN-META.json` — structured rails + roles + waves (machine input for Emit)

## Next step

Review `DELIVERY-PLAN.md`. Resolve all Gaps checkboxes. Then run `/ensemble emit` (or `bun RunEmit.ts --plan <path>`).

## Artifact Tracking

On non-dry-run, appends a JSONL entry to `MEMORY/ARTIFACTS/artifacts.jsonl`:

```json
{"pack":"Utilities","workflow":"Ensemble.Plan","type":"delivery-plan","title":"<artifact-slug>","path":"<abs path to DELIVERY-PLAN.md>","wing":"<resolved>","sessionId":"<SESSION_ID>"}
```

The CLI writes this line itself when `--out` resolves successfully.
