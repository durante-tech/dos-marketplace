---
name: Wiki
description: Agent-maintained knowledge vault — an interlinked OKF v0.1 markdown synthesis layer over immutable sources, with init, ingest, query, and lint workflows. USE WHEN wiki, knowledge vault, init vault, create wiki, ingest source, add to wiki, ingest into wiki, ask the wiki, query the wiki, what do we know about, wiki lint, check the wiki, synthesis layer, knowledge base, okf, open knowledge format, knowledge bundle. NOT for semantic memory search or knowledge-graph facts (use MemPalace — Wiki maintains the prose synthesis layer that cites them) and NOT for finding prior sessions or PRDs (use ContextSearch).
role: generator
accepts: [text]
icon: BookOpen
colorVar: primary
colorHex: "#00e1ab"
tier: secondary
category: Research
displayLabel: Wiki
marketingDescription: Agent-maintained OKF knowledge vault over your immutable sources
elevator: The agent maintains the wiki; you read the compounding synthesis
highlightWorkflows:
  - name: Ingest
    technicalName: Ingest
  - name: Query
    technicalName: Query
roots:
  - PROJECT.WIKI
  - PROJECT.ARTIFACTS
visibility: public
capabilities:
  - artifact.write
  - customization.cascade
  - four-copy.sync
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Wiki/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Wiki

**Status:** v0.0.1 — initial four-workflow release (Init / Ingest / Query / Lint), OKF v0.1 vault serialization.

An agent-maintained **synthesis layer**: a vault of interlinked markdown pages the agent writes and maintains over immutable sources. Raw memory is log-shaped — nothing revises a synthesis when new evidence arrives. The wiki is the missing compile step: the agent handles the drudgery of reading sources and updating cross-references; the operator reads the vault (Obsidian, the OKF visualizer, any editor) and reviews changes like code.

The vault serializes as an **[Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog) (OKF v0.1) bundle** — plain markdown files with YAML frontmatter, one concept per file, standard markdown links as graph edges. Any OKF consumer can read it; no SDK stands between a reader and the content.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Init** | "init vault", "create wiki" (auto-run by Ingest when no vault exists; Query/Lint suggest it) | `Workflows/Init.md` |
| **Ingest** | "ingest <source>", "add to wiki", "wiki this" | `Workflows/Ingest.md` |
| **Query** | "ask the wiki", "what do we know about" | `Workflows/Query.md` |
| **Lint** | "wiki lint", "check the wiki" | `Workflows/Lint.md` |

## The Contract (all workflows)

1. **Sources are immutable.** The wiki reads sources; it never edits, moves, or deletes one.
2. **Page-worthiness gate.** A source earns pages only if it adds durable claims — no transient boilerplate.
3. **Citation rule.** Every load-bearing factual claim cites a `kg:` fact or a source path. The KG wins for facts; the wiki wins for interpretation.
4. **Standalone degradation.** No MemPalace or Studio required — without a knowledge graph, cite source paths only; never fabricate `kg:` references.
5. **Operator-gated repair.** Lint proposes fixes; it never auto-applies them.
6. **Every operation logs.** `index.md` updated and `log.md` appended on every mutating run.

Vault conventions (page types, frontmatter spec, link rules) live in the vault's own `SCHEMA.md`, seeded from `Templates/Schema.md` at Init and co-evolved with the operator.

## Examples

**Example 1: Ingest a spec into the vault**
```
User: "Ingest RFC-0037 into the wiki"
→ Invokes Ingest workflow
→ Reads the RFC read-only, passes the page-worthiness gate, writes/updates entity and concept pages with citations, updates index.md, appends log.md
→ User gets a summary of pages created/updated with links into the vault
```

**Example 2: Ask the vault a question**
```
User: "What do we know about our memory architecture?"
→ Invokes Query workflow
→ Reads index.md, traverses relevant pages, synthesizes a cited answer; files it back as a synthesis page if decision-grade
→ User gets an answer where every factual claim traces to a page citation
```

**Example 3: Health-check the vault**
```
User: "wiki lint"
→ Invokes Lint workflow
→ Sweeps for contradictions against the KG, orphan pages, stale claims, broken links; emits a report with proposed fixes
→ User reviews and approves fixes before anything is applied
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

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"Wiki","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/wiki/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/wiki/` — active release submodule (versioned)
3. `Packs/*/src/Wiki/` — pack source (distributable)
4. `Packs/agents/Wiki/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
