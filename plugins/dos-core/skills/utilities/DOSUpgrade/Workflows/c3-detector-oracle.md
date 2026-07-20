# C3 Detector Oracle — provenance & lessons

Companion to `c3-detector-oracle.json`. This is the labeled acceptance corpus for the **RFC-0120 C3 detector** — the pure function (`pack-procedure structure -> {verdict, evidence}`, zero writes) that the deferred `WorkflowScaffold` generator depends on. The detector must score this corpus correctly before it ships.

## Why this file exists

The corpus previously lived **only** inside a session-journal JSON in the submodule working tree (`wf_b3fcf644-68e.json`). Session transcripts rotate; that file is not a tracked fixture. This file locks the ground truth and — critically — corrects a framing error that would have produced a broken detector.

## What was mis-remembered (and corrected here)

The RFC-0120 / RFC-0117 prose shorthands the miner run as a "13:1 below-bar ratio." The actual run output is **1 clears-bar / 2 borderline / 11 below-bar** (14 deduped candidates). Collapsing the 2 borderlines into "below" hides the cases where a weak detector will actually fail.

## The headline lesson: unit-count is NOT the discriminator

The literal RFC-0117 §2.1 "≥~10 independent units" leg **inverts on the two most important cases**:

| units | verdict | candidate |
|---:|---|---|
| **12** | **SKIP** | `mempalace-bridge-parity-sync` (heterogeneous bespoke edits; mechanical slice already = `sync-check --fix`) |
| **9** | **EMIT** | `dos-upgrade-scan` (the only workflow we shipped) |

A detector keyed on unit-count would **skip the winner and emit the highest-unit reject.** The real discriminators are the **qualitative legs**: genuine independence of units, a deterministic merge/reduce core, and long-running/context-overflow.

## The 3 positives qualify via *different* legs

This is why they are a good 3-instance proof — and a good oracle. The detector cannot pass by checking one leg:

| positive | carrying leg(s) | loop? | overflow? | det. merge core? |
|---|---|:---:|:---:|:---:|
| `dos-upgrade-scan` | **overflow** (564K subagent tokens) | no (fixed 9-scatter) | yes | yes |
| `prd-isc-fanout` | **overflow** (200+ ISCs) + **merge core** | yes (per-domain N) | yes | yes |
| `feature-discovery` | **loop** (completeness-loop-until-dry) + overflow | **yes — the only one** | yes | partial |

## Honest provenance caveats (recorded so the detector isn't trained on a silently-inconsistent set)

1. **Mixed provenance of the positives.** Only `dos-upgrade-scan` was miner-scored in `wf_b3fcf644-68e`. `prd-isc-fanout` (RFC-0123) and `feature-discovery` (RFC-0124) were hand-authored fixtures added *later* — different provenance than the 13 miner-scored negatives.
2. **`feature-discovery` is QUARANTINED (P3, 2026-05-29).** Its attestation came from a **cap-bounded** run (`wf_a19f7f7b-449` hit `MAX_ROUNDS=3` with 2 `uncovered_gaps` — not a dry-converged pass). Flagged `quarantined_pending_reattestation: true` in the fixture; until a dry-converged re-attestation it is a **provisional** positive (emit set = 2 confirmed + 1 provisional). Cato cross-vendor note, RFC-0067.
3. **RESOLVED (P3, 2026-05-29) — all 8 formerly-shallow negatives deep-scored.** Verified against git artifacts; **none is a hidden EMIT** (the only failure mode that would poison the gate). The two fan-out-named candidates were false flags: `mempalace-recall-isc-fanout` is RFC-0122 recall *debugging* (the "isc-fanout" is a PRD's ISC list, not parallel reducer units); `atom-primitive-red-first-green-flip` is the same single episode as `atom-primitive-redgreen-batch` (commits `7da020e2`+`e08a0035`), its `recurrence=8` counting within-run atoms. **Miner artifact found:** the 3 `atom-primitive-*` entries are ONE episode triple-counted — the 13-negative set is ~11 distinct episodes (does not affect the gate; all SKIP). All 16 cases are now `scoring_depth: deep`.

## C3 acceptance test (what the detector must achieve)

- Score **3/3 emit** and **13/13 skip** (11 clear + 2 borderline).
- Produce **defensible evidence** on the 2 borderlines (`doctrine-rfc-ratify-panel`, `design-bundle-fork-pipeline`) — both resolve to SKIP, but they are where false-positives concentrate.
- Do **not** use raw unit-count as the primary signal (the inversion table proves why).

## Source

- Miner run: `wf_b3fcf644-68e` ("best-workflow-use-case", 2026-05-29T17:55:42Z).
- Journal: `Releases/v0.0.18/.claude/projects/[REDACTED:operator-project-slug]/28476b48-6f28-4d22-8e99-37332baf509b/workflows/wf_b3fcf644-68e.json`.
- Related: RFC-0120 §6 (C3), RFC-0117 §2.1 (the bar), RFC-0121 (distribution), RFC-0123/0124 (positives #2/#3), RFC-0105 (same-family council finding behind `doctrine-rfc-ratify-panel`).
