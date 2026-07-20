# SCHEMA — Vault Conventions (OKF v0.1)

This vault is an **agent-maintained synthesis layer**: interlinked markdown pages written and maintained by the agent over immutable sources. The operator reads it (Obsidian, the OKF visualizer, any editor) and reviews changes; the agent does the maintenance. This file governs every page. It co-evolves with the operator — schema changes are proposed by the agent and applied only after operator review.

## Layers (division of labor)

| Layer | Role | Ownership |
|---|---|---|
| Raw sources | RFCs, PRDs, receipts, articles, mined files | Immutable — the wiki NEVER edits a source |
| Knowledge graph | Fact store (MemPalace KG, when present) | Wiki cites it, never duplicates its authority |
| This vault | Prose synthesis citing facts and sources | Agent-owned; operator reads, never hand-edits |
| This schema | Page formats, link rules, gates | Co-evolved, operator-reviewed |

**Contradiction resolution direction: the KG wins for facts; the wiki wins for interpretation.**

## Serialization: OKF v0.1

The vault is an [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog) bundle: a directory of markdown files with YAML frontmatter.

- **One concept per file.** The file path is the concept's identity. Renaming a file is an identity change — update every inbound link in the same pass.
- **Frontmatter** (OKF standard fields; `type` is the only required one):

```yaml
---
type: concept            # REQUIRED — see Page Types below
title: Open Knowledge Format
description: One-sentence summary used by indexes and consumers.
resource: https://…      # optional — canonical external URL, if one exists
tags: [knowledge, format]
timestamp: 2026-07-07T21:00:00Z   # last substantive revision (not touch time)
citations:               # OKF extension key (this vault's convention)
  - source: Plans/Specs/RFC-0037-session-memory.md
  - kg: "project:durante | uses | okf-v0.1"
---
```

- **Links are standard markdown links**, relative to the vault root: `[customers](concepts/okf.md)`. Never `[[wikilinks]]` — standard links keep the bundle valid for every OKF consumer, and Obsidian renders them natively (graph view included).
- Arbitrary extra frontmatter keys are allowed (OKF extensibility); `citations:` is this vault's load-bearing extension.

## Page Types

| `type:` | Contents | Directory |
|---|---|---|
| `entity` | A person, org, system, or artifact — what it is, current state, history | `entities/` |
| `concept` | An idea, pattern, or term — definition, why it matters, relationships | `concepts/` |
| `synthesis` | A cross-source answer or analysis — the compile output of many sources | `syntheses/` |
| `decision` | A settled choice — what was decided, why, what it superseded | `decisions/` |
| `index` | Navigation only — no claims of its own | vault root / per-directory |

## Citation rule (split-brain guard)

**Every load-bearing factual claim on a page carries a citation** — either a `kg:` reference (subject | predicate | object, when a knowledge graph is present) or a source path. Interpretation and synthesis prose needs no citation, but the facts it rests on do.

- **Graceful degradation:** in a vault with no knowledge graph available, cite source paths only. Never fabricate `kg:` references.
- Lint verifies cited KG facts are still valid (not invalidated) and flags claims whose citations have gone stale.

## Page-worthiness gate

A source earns pages **only if it adds durable claims** — something that would change an answer six months from now. Session chatter, transient status, and boilerplate get a `log.md` entry at most, never a page. When in doubt, ask: "would Query ever cite this?" If no, don't write it.

## Vault fixtures

- `index.md` — root navigation: every page reachable within two hops. Updated on every ingest.
- `log.md` — append-only maintenance journal. One entry per operation: `## [YYYY-MM-DD HH:MM] <ingest|query|lint|init> | <title>` followed by 1-3 bullet lines (what changed, pages touched).
- `SCHEMA.md` — this file.
- `assets/` — images and attachments (fixed directory, keeps Obsidian and OKF consumers agreeing).
