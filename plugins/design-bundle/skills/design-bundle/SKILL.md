---
name: DesignBundle
description: Builds a fresh dos-prisma-saas-kit fork into a Claude Design System form-ready, launch-ready brand operating system. Configures the fork, mines DOS/sibling/fork/MEMORY context, runs competitive and ICP research, captures decisions, and creates <repo>/claude-design-system-bundle/ with DESIGN.md, context, DTCG/shadcn/CSS tokens, intelligence, copy, press, metadata, and review artifacts. Applies locked decisions and commits. USE WHEN design bundle, claude design system, institutional bundle, fork and bundle, anthropic design form, kit to bundle, durante.tech bundle, DESIGN.md, VoltAgent design, design system handoff, brand intelligence bundle, launch ready bundle, brand operating system, competitor research bundle, ICP audience bundle, press kit bundle, validate bundle. Invoke via /design-bundle; NOT for standalone brand research (use Brand) or design-system extraction (use DesignSystem).
role: executor
accepts: [text]
icon: Package
category: Branding
displayLabel: DesignBundle
writes: true
roots: []
visibility: public
capabilities:
  - customization.cascade
  - artifact.write
  - four-copy.sync
artifact_tracking:
  enabled: true
  roots:
    - claude-design-system-bundle
  types:
    - design-bundle
    - context-markdown
    - form-fill
  log_path: MEMORY/ARTIFACTS/artifacts.jsonl
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/DesignBundle/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# DesignBundle

End-to-end pipeline that takes a fresh dos-prisma-saas-kit fork to a Claude-Design-System-form-ready state. One workflow runs all 5 phases — Fork Configuration → Context Mining → Decision Capture → Bundle Assembly → Apply Locked Decisions + Commit.

## What it does

Given a freshly-cloned dos-prisma-saas-kit fork (e.g. `~/Developer/<product>-tech/`), the skill:

1. **Phase A — Fork Configuration** (skipped if already done): swaps `origin` → upstream + new origin, pushes `develop`, sets GitHub default branch, runs `pnpm fork:init` to claim a parallel-fork slot.
2. **Phase B — Context Mining**: fans out 6 parallel `Explore` agents across DOS root (`~/Durante/`), sibling SaaS (e.g. `~/Developer/durante-studio/`), current fork (Tailwind tokens + `@kit/ui` exports + layouts), project MEMORY, global MEMORY index, and `USER/`. Also fires `intel-context.ts` for INTEL-FIRST compliance.
3. **Phase C — Decision Capture**: 4-5 `AskUserQuestion` prompts to lock scope (marketing-only / +auth / full), institutional positioning, tagline approach, languages, deploy target. Every option carries consequence text.
4. **Phase D — Bundle Assembly**: writes ~56 files to `<repo>/claude-design-system-bundle/` —
   - **`DESIGN.md`** at the root (★ canonical single-file spec per [VoltAgent/awesome-claude-design 9-section format](https://github.com/VoltAgent/awesome-claude-design)).
   - `README.md` + `FORM_FILL.md` (with provenance "because" lines on every locked decision).
   - `context/01–10-*.md` — 10 context markdowns: company / founder / products / brand-voice / design-language / tech-stack / **creative-brief** / **component-anatomy** / **interaction-grammar** / **accessibility**.
   - `code/` — verbatim source copies (theme.css/globals.css/custom.css/ui-exports.json + 6 components + 2 layouts) + multi-format tokens (`tokens.json` W3C DTCG 2025.10 + `registry.json` shadcn schema + `tokens-sandbox.css` sanctioned mutation surface).
   - `delta-reference/` (★ renamed from `brand-direction/`) — sibling project brand for *contrast*, not *copy*, gated by `DELTA.md` naming the three institutional inversions.
   - `assets/` (placeholder or populated by D6).

   **Active-fork sub-steps D6–D9** add coverage when the fork has populated `apps/web/public/`, `apps/web/i18n/messages/`, custom `(public)/` route subtree, or in-repo `BRAND*.md`/`DESIGN*.md`/`brand/` docs — each skips clean when absent, so fresh forks still pass.

   **Always-fire steps D10–D13** add the canonical DESIGN.md, the multi-format token bundle, the three missing-leg context files (component anatomy / interaction grammar / accessibility), and the delta-reference rename + DELTA.md — these encode the design-system frontier patterns identified in the 2026-05-27 research sweep (Perplexity + Claude WebSearch + Gemini + Designer agent + WebFetch of awesome-claude-design).

   **Always-fire steps D14–D18** add the **brand intelligence layer**: `intelligence/` (8 files — competitive landscape, competitor profiles, AX benchmark, competitor tech, ICP/audience, stakes-based narrative, Telos alignment, press targets), `copy/` (4 files — brandscript, founder narrative, headline bank, voice-audit template), `press/` (5 files — founder bio, pitch deck scaffold, investor-readiness, press assets specs, launch press release draft), `meta/` (3 files — AX readiness, SEO strategy, Sentinel conformance), and `review/` (4 files — DreamTeam critique template, captured positioning debate, memory-check scaffold, prior-work index). Together with the design layer (D1–D13), the bundle becomes a **launch-ready brand operating system** — not just a design system.
5. **Phase E — Apply Locked Decisions + Commit**: edits FORM_FILL.md + context/01 + context/04 + context/06 with `(LOCKED YYYY-MM-DD)` stamps, then `git add` + conventional commit `docs(brand): Claude design system bundle — <company> institutional context`.

The output bundle is designed to be dragged into the Claude.ai Design System form ("Set up your design system"), with `FORM_FILL.md` providing copy-pasteable values for every form field.

## Invariants (CRITICAL)

The workflow MUST preserve these at every phase:

1. **Institutional vs product positioning distinction.** The site being bundled is the COMPANY's institutional site, never a re-pitch of any single product. If a sibling SaaS has product-brand work (taglines, archetypes), use as REFERENCE — never COPY directly.
2. **No brand fabrication.** Every claim in the markdown traces to a source file path. Verbatim quotes preferred over paraphrase.
3. **No app-code modification.** Bundle is a sibling folder at the repo root; `apps/*` and `packages/*` are untouched.
4. **No external asset downloads.** `assets/` is placeholder-only until operator provides finalized logos/fonts.
5. **`brand-direction/` is REFERENCE, not COPY.** Sibling project's brand is one product line; institutional site develops its own treatment.
6. **`/code-review` decline allowed** for documentation+verbatim-copy bundles — explicit `Declined:` line in response output (operator structural review at form-submission step is the audit gate).

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **CommandAdapter** | Every direct `/design-bundle` invocation; normalize `$ARGUMENTS`, flags, state, and preflight before selecting work | `Workflows/CommandAdapter.md` |
| **RunPipeline** | "design bundle", "fork and bundle", "kit to bundle", "set up claude design system" | `Workflows/RunPipeline.md` |
| **ValidateBundle** | "validate bundle", "check design bundle", "re-validate bundle", "verify design system bundle", "is the bundle complete" | `Workflows/ValidateBundle.md` |

For direct invocation, **always read and execute `Workflows/CommandAdapter.md` first**. It preserves the `--quick`, `--launch-ready`, `--research-only`, `--copy-only`, `--validate`, and `--skip-research` contracts while ensuring this skill remains the plugin's only `design-bundle` invocation surface.

## Args Contract (structured JSON)

Both workflows accept **structured JSON args, not prose** — a freeform string silently degrades to a skeleton run (the workflow falls back to auto-detect + interactive prompts). Pass the JSON object for the chosen workflow; every field is optional unless marked required.

**RunPipeline:**
```json
{
  "workflow": "RunPipeline",
  "company": "durante-tech",
  "repo_path": "/abs/path/to/fork",
  "sibling_path": "/abs/path/to/sibling-saas",
  "github_dest": "org/repo",
  "phases": { "skip_a": false, "skip_b": false, "dry_run": false },
  "depth": "standard"
}
```

**ValidateBundle:**
```json
{
  "workflow": "ValidateBundle",
  "bundle_path": "/abs/path/to/claude-design-system-bundle",
  "strict": true,
  "checks": ["structure", "design-md", "tokens", "consistency", "floor"],
  "report": false
}
```

`company` (RunPipeline) and `bundle_path` (ValidateBundle) are required for their workflow. Unknown keys are ignored; missing optional keys fall back to the documented defaults (`repo_path`→cwd, `depth`→`standard`, `strict`→`true`, `checks`→all five, `report`→`false`). Field-level semantics live in each workflow file.

## Examples

**Example 1: Fresh institutional-site fork**
```
User: "design bundle for durante-tech"
→ Detects ~/Developer/durante-tech/ is fork-state but lacks bundle
→ Phase A: skips (already configured per .fork-slot=16)
→ Phase B: fires 6 parallel Explore agents + intel-context
→ Phase C: asks 4 questions (scope, positioning, tagline, languages, deploy)
→ Phase D: writes ~56 files to claude-design-system-bundle/
→ Phase E: applies locked decisions + commits
→ User drops the bundle folder into the Claude Design System form
```

**Example 2: Brand-new kit fork from scratch**
```
User: "fork and bundle for a new client called Acme Robotics"
→ Phase A: gh repo view acme-tech/acme-tech → empty repo
→ Phase A: git remote rename origin upstream → add new origin → push develop → gh default branch → pnpm fork:init (claims slot)
→ Phase B-E: same as Example 1
→ User gets bundle + a properly-configured fork on a new slot
```

**Example 3: Re-run after decisions change**
```
User: "kit to bundle — but switch deploy to Cloudflare Pages and add ES locale"
→ Detects existing claude-design-system-bundle/ on develop branch
→ Phase A: skips (configured)
→ Phase B: skips mining (offers to re-mine or reuse existing context/*)
→ Phase C: re-asks decision questions; carries forward unchanged answers
→ Phase D: re-writes FORM_FILL.md + context/06-tech-stack.md with new locks
→ Phase E: amends commit OR creates follow-up commit (operator choice)
```

## Worked Example (canonical reference)

The pattern was first executed on `durante-tech` (2026-05-27) and committed at `7773302` on `develop`. Reference bundle at `~/Developer/durante-tech/claude-design-system-bundle/` — 23 files, ~136KB, ~2000 lines. Locked decisions: positioning = "operating-systems firm for AI-native software"; no launch tagline; EN+PT-BR with switcher; Railway deploy.

## Trigger Gate

This skill assumes the operator is **inside the fork's working tree** (the freshly-cloned kit). It does NOT clone the kit. The workflow auto-detects fork state via `git remote -v` + `cat .fork-slot 2>/dev/null` and adapts:
- Both signals present + remote points at expected destination → **skip Phase A**.
- Either missing → **run Phase A in full**.

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

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"DesignBundle","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/design-bundle/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/design-bundle/` — active release submodule (versioned)
3. `Packs/*/src/DesignBundle/` — pack source (distributable)
4. `Packs/agents/DesignBundle/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
