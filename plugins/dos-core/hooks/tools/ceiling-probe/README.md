# PostToolUse hook-ceiling probe

Empirically measures how many `command` hooks in a **single PostToolUse matcher
group** actually execute, so the RFC-0110 fan-out inside
`StreamEventDispatcher.hook.ts` rests on a measured number instead of a believed
one.

## Background — the claim under test

RFC-0110 (2026-05-17) asserts Claude Code silently drops hooks past the 5th in a
matcher group ("keeps every matcher at ≤5 hooks, sidestepping Claude Code's
silent-drop ceiling"). That ceiling was **inferred from a symptom** (hooks
registered at positions 6+ not running), never measured. The fan-out spawns
`KgRetractOnPrdArchive`, `MinePRDOnWrite`, and `PRDConformanceGate` as
subprocesses to dodge it — but those same three are *also* directly registered
at positions 7-9 of the 9-hook Write/Edit/MultiEdit groups in `settings.json`.
So today either (a) the ceiling is real and positions 6-9 silently drop — which
means position 6 `CheckpointPerISC` is lost *and not fanned out* — or (b) the
ceiling is a myth and those three hooks **double-run** (once directly, once via
fan-out). This probe decides which world we live in.

## Method

1. Generate a settings file with one `PostToolUse` matcher group `"Edit"`
   holding **N sentinel hooks** (default 12), each a **unique** command that
   appends a unique marker `p01`..`pNN` to a shared counter file.
   - Uniqueness is load-bearing: the platform dedups identical `command` hooks
     by command string, so N copies of one command would collapse to one and
     the probe would read a false ceiling of 1.
2. Drive **exactly one** `Edit` tool call via `claude -p` against a throwaway
   target file (`alpha` → `beta`), with `--allowedTools Edit
   --permission-mode acceptEdits --model claude-haiku-4-5-...`.
3. Count **distinct** markers in the counter. One PostToolUse `Edit` event fires
   each registered hook once, so distinct-marker-count = hooks-that-executed.

## Usage

```bash
# from a PLAIN terminal (not nested inside a Claude Code session):
bun hooks/tools/ceiling-probe/run-probe.ts                 # 2 trials × 12 sentinels
bun hooks/tools/ceiling-probe/run-probe.ts --trials 3
bun hooks/tools/ceiling-probe/run-probe.ts --sentinels 8   # probe a lower N
bun hooks/tools/ceiling-probe/run-probe.ts --dry-run       # generate + print, never runs claude
bun hooks/tools/ceiling-probe/run-probe.ts --keep          # keep temp dirs to inspect
```

Flags: `--trials N` (default 2), `--sentinels K` (default 12), `--timeout SEC`
(default 180), `--model ID`, `--keep`, `--dry-run`.

## Output & interpretation

```
trial 1: EXECUTED=12/12 fired=[p01,...,p12] missing=[] edited=yes exit=0
trial 2: EXECUTED=12/12 fired=[p01,...,p12] missing=[] edited=yes exit=0
EXECUTED=12/12 -> CEILING=none
```

| Verdict | Meaning | Consequence for RFC-0110 |
|---|---|---|
| `CEILING=none` (EXECUTED=N/N) | No ceiling at N. All hooks in one group run. | Fan-out is unnecessary; the three hooks currently **double-run**. Delete the fan-out, keep direct registration. |
| `CEILING=V` with `V < N` | Only V hooks per group run; the rest silently drop. | The ceiling is real at V. Direct registration past position V is unsafe — fan-out (or a dispatcher) is required, and **every** hook past position V (not just the RFC-0110 three) must be covered. |
| `missing=[p06..p12]` (tail) | Dropping is **position-based** (first V by registration order survive). | Order in `settings.json` becomes load-bearing; document it. |
| `CEILING=indeterminate` | Trials disagreed. | Add `--trials`; suspect nondeterministic scheduling or contamination. |
| `CEILING=inconclusive` | No trial ran the Edit tool (`edited=no`, zero markers). | Environment problem (nesting hang, auth, model refusal) — not a ceiling. Re-run from a plain terminal. |

## Threats to validity

- **User-settings merge.** Each trial runs in a throwaway temp dir, so no
  *project* settings interfere. But `~/.claude/settings.json` (the DOS user
  settings) still loads and contributes its own 9-hook `Edit` group. Those hooks
  never write our counter, so they cannot *inflate* the count. They could
  *deflate* it only if the platform enforces the ceiling **per-(event) across
  all merged sources** rather than **per-matcher-group**. RFC-0110's own wording
  ("per matcher") assumes per-group; this probe tests that directly with a
  single group. If you need to rule the merge out entirely, re-run on a machine
  whose user settings have no `PostToolUse Edit` hooks. Kill switches
  (`DOS_STREAM_DISPATCH=off`, `DOS_FANOUT_DROPPED_HOOKS=off`) are set on the
  child to quiet the heaviest user hooks.
- **Nesting hang.** `claude -p` spawned from inside a Claude Code session can
  hang for minutes. Run this from a plain terminal. `--dry-run` exercises
  generation with zero nesting risk.
- **Model does zero edits.** If the model answers without calling Edit, no hooks
  fire; the trial is flagged `INCONCLUSIVE` and excluded from the verdict rather
  than being misread as `CEILING=0`.
- **Parallel append atomicity.** All matching hooks run in parallel; each
  sentinel appends a marker < 8 bytes, well under `PIPE_BUF`, so concurrent
  `>>` appends do not interleave-corrupt on macOS/Linux. Distinct-count is
  robust to duplicate lines if the model happens to edit more than once.

## Files

- `run-probe.ts` — the harness (bun). Generates the concrete settings per trial.
- `probe-settings.sample.json` — illustrative shape only; the harness bakes a
  real counter path in at runtime.
- `README.md` — this file.
