# Studio Sync Tools

This directory holds the Studio-bound integration tools (`Save*ToStudio.ts`)
that ship local DOS data to Studio at SessionEnd. Despite living under the
`research` skill, these tools are NOT research utilities — the historical
location dates from when the first sync tool (the legacy `SaveToStudio.ts`,
since superseded by `SaveResearchVaultsToStudio.ts` and removed) lived
alongside the genuine research artifact emitters
(`BraveSearch.ts`, `Gemini.ts`, `Grok.ts`, `Perplexity.ts`,
`SearchPerspectives.ts`).

## Canonical source of truth

The list of tools, their endpoints, and their orchestration mode lives in
**`~/.claude/hooks/lib/tool-registry.ts`** (the `SYNC_TOOLS` array). The
orchestrator (`~/.claude/hooks/StudioSync.hook.ts`) iterates that array.
Adding a new sync tool is a one-line registry edit — do NOT edit the
hook's `main()` directly.

## Tools at a glance (19 total)

See `tool-registry.ts` for the authoritative ordering and per-tool args.
Summary by mode:

- **queue (14)** — `Sessions, Work, Reflections, Signals, Kg, Corrections,
  Failures, Learnings, MemoryStats, HookMetrics, VoiceEvents,
  RelationshipNotes, ResearchVaults, Plans` — DLQ-resilient, Phase-2 default.
- **direct (4)** — `SecurityEvents, Artifacts, Deferrals, Commitments` —
  bypass DLQ; Phase-3 migration target.
- **special (1)** — `Projects` — runs without `DOS_DLQ_QUEUE_ONLY=1` because
  it must direct-POST to seed the slug→Project.id table that every other
  tool's auth depends on.

## Modes

- **queue** — uses `queueOrPost()` DLQ-resilient transport. Atomic-rename
  writes, monotonic seq, owner-alive 3-check reclaim, circuit breaker per
  tool, gzip >64KB, UID quarantine. See `~/.claude/hooks/lib/dlq.ts`.
- **direct** — bypasses DLQ; tool POSTs directly with its own retry path.
- **special** — non-standard env. Currently only `Projects`.

## Adjacent files

- `~/.claude/hooks/lib/dlq.ts` — DLQ transport core
- `~/.claude/hooks/lib/dlq-ack-ledger.ts` — drain witness logging (Phase-2 sprout)
- `~/.claude/hooks/lib/tool-registry.ts` — single source of truth (SoT)
- `~/.claude/hooks/StudioSync.hook.ts` — SessionEnd orchestrator
- `~/.claude/hooks/DrainPending.hook.ts` — drains `.pending/` envelopes out-of-band
- `ReconcileStudio.ts` (this directory) — manual recovery: re-runs all sync
  tools sequentially with status

## Future home

The board review (2026-04-28) recommended promoting these tools to a
top-level `~/.claude/sync/` directory or `skills/StudioSync/Tools/`.
Deferred — physical move requires updating: `TOOLS_DIR` in the
orchestrator, `ReconcileStudio.ts`, 3 workflow markdowns, 4 pack-source
mirrors, and possible aliases in `.dos-sync-manifest.json`. This README
is the temporary discoverability fix.
