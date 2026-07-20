# Wiki — Changelog

## v0.0.1 — 2026-07-07

- Initial release: agent-maintained OKF v0.1 knowledge vault.
- Four workflows: Init (vault bootstrap), Ingest (source → cited pages), Query (cited answers + decision-grade file-back), Lint (contradictions/orphans/stale/links, operator-gated apply).
- `Templates/Schema.md` vault constitution: OKF v0.1 frontmatter (`type` required, standard fields), `citations:` extension key, standard-markdown-link rule (Obsidian + OKF visualizer compatible), page-worthiness gate, KG-wins-for-facts contradiction direction.
- Standalone degradation: no MemPalace/Studio dependency — source-path citations only when no knowledge graph is present.
- Deferred to v2: SessionEnd auto-ingest hook, LoopSmith lint cadence, MEMORY/CANONICAL promotion path.
