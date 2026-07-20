# GrowthProgram Tools

| Tool | Purpose |
|---|---|
| `EmitProgram.ts` | Deterministically scaffold the `docs/growth/` program skeleton from a preset + a campaign subject. Section templates + stable-ID scaffolding live in the script (out of the model's context — the carta renderer pattern); the workflows then FILL the skeleton. Never invents data. |
| `SoAVRun.ts` | Share-of-AI-Voice harness for the Measurement phase: `--scaffold` a results log from the Q* basket, then `--score` the filled log into a per-engine + blended scoreboard. Does NOT call the engines (the run is operator-time across logged-out sessions). |
| `VerifyProgram.ts` | The deterministic integrity gate (Coordination Step 7.0). Scans an emitted `docs/growth/` program and BLOCKS on the mechanically-checkable integrity violations — the non-self-graded floor that survives council degradation (when the `growth-skeptic` seat does not resolve). SHAPE only; the opus-Skeptic still judges whether a stat is true. |

## EmitProgram.ts
```bash
bun EmitProgram.ts --subject "be the default booking tool for salons, French-first" \
    --preset local-smb-french [--out docs/growth] [--force] [--artifacts-log MEMORY/ARTIFACTS/artifacts.jsonl]
```
- `--subject` (required) · `--preset` (one of `../Presets/*.yaml`, optional) · `--out` (default `docs/growth`) · `--force`.
- `--artifacts-log <path>` — **artifact tracking** (DOS convention). Off by default; appends one
  `{ts, pack, workflow, type, title, path, contentPreview, sessionId}` entry per file written. In a DOS
  install the `ArtifactAutoLogger` hook captures writes automatically; this flag is the portable
  alternative for non-DOS installs.
- Idempotent: existing non-empty files are skipped unless `--force`. Exit `0` ok · `2` bad args / unknown preset.

## SoAVRun.ts
```bash
# 1) scaffold the results log from the GeoPillar query basket
bun SoAVRun.ts --scaffold --basket docs/growth/geo/query-basket.md [--engines chatgpt,perplexity,gemini,claude,le_chat] [--out soav-results.jsonl]
# 2) (operator fills present/rank/sentiment/cited/total_brands/source/snippet from logged-out runs)
# 3) score
bun SoAVRun.ts --score soav-results.jsonl
```
Accepts a markdown query-basket (parses the `| Q* | … |` table) or a JSONL basket. SoAV per observation =
`1 / total_brands` when the subject is present, else `0`; rolled up per engine + blended. Exit `0` ok · `2` no data.

## VerifyProgram.ts
```bash
bun VerifyProgram.ts --verify docs/growth [--json]
```
The deterministic integrity gate — runs FIRST in Coordination Step 7 (the mechanical floor), then the
opus-Skeptic runs the truth-refutation pass. It mechanizes the integrity rules already authored as
assertions, SHAPE only (it never judges whether a number is *true* — that stays the Skeptic + web):
- **citation-presence** — every load-bearing number in body prose carries a `[source @ date]`/snippet ref
  or lives in a `> DO NOT CITE` block (Measurement.md).
- **quarantine-physical** — a quarantined stat must be struck at origin; a numeric token in BOTH a DO NOT
  CITE block and body prose fails (Coordination.md).
- **schema-without-data** — no `AggregateRating`/`Review` JSON-LD without a verified-data gate (integrity-guard.md).
- **id-collision** — a stable ID defined twice with conflicting meaning (output-contract.md; the GM8 class).
- **raci-one-a** — exactly one Accountable per RACI row (Coordination.md).

`## Output Template`, `## Worked example`, fenced code, and `> DO NOT CITE` blocks are exempt (illustrative,
not load-bearing). Exit `0` clean · `2` on any violation / bad args — a non-zero exit is a hard BLOCK
independent of the council verdict (the one check the LLM cannot rubber-stamp).
