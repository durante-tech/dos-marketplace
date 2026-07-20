---
name: SentinelConformance
description: RFC §13 profile conformance — runs machine-readable profile manifests against the live repo, emits pass/fail matrix per requirement.
status: STABLE
bestPath:
  - title: "Select Scope"
    description: "Choose a profile, RFC, or single check via flags (--profile all, --check R<n>, --rfc)."
  - title: "Run Conformance Check"
    description: "Execute ValidateRfcConformance.ts against the live repo."
  - title: "Resolve Handlers"
    description: "Each requirement's check id resolves to a registered ast/presence/regex handler; unregistered checks report not_applicable."
  - title: "Render Pass/Fail Matrix"
    description: "Emit the three-state (pass/fail/not_applicable) report, opening with a degraded banner when a source is unreachable."
  - title: "Gate Decision"
    description: "A non-zero exit blocks the commit at pre-commit Gate 5 unless overridden."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Sentinel Conformance workflow uses workflow-specific intent-to-flag vocabulary; canonical Mode/Output two-table shape doesn't fit"
---

# Sentinel Conformance — RFC Profile Enforcement

Runs the machine-readable §13 conformance manifest of any RFC (default: RFC-0005) against the current repo and emits a per-requirement pass/fail matrix. Each requirement resolves to a concrete handler via `Packs/sentinel/src/Tools/ConformanceChecks/registry.ts`. Unregistered checks report `not_applicable` (not `pass` — silent-skip is prohibited by §1 Clause 2).

<!-- partial: _workflow-voice.md skill_name=Sentinel workflow_name=Conformance action_phrase=" to check RFC profile compliance" -->

## When to Use

- Triggered by "sentinel conformance", "rfc conformance", "check R<n>", "profile check", "§13 check".
- Fits verifying RFC §13 profile obligations (deterministic code-grep/AST checks) against the live repo, including the mandatory pre-commit Gate 5 sweep.
- NOT for free-form convention drift on staged changes — use Guard (Conformance runs the RFC §13 R-rule profile matrix, not convention drift).

## Intent-to-Flag Mapping

Canonical invocation path (run from the DOS repo root — `ts-morph` is a repo-root devDependency):

```bash
bun Packs/sentinel/src/Tools/ValidateRfcConformance.ts [flags]
```

The tool is **pack-source-only** (not mirrored into `~/.claude/skills/sentinel/`), matching the precedent of `Tools/sync-check.ts`. This keeps `ts-morph` scoped to the repo workspace where it belongs, instead of leaking node_modules into the runtime install.

| User Says | Flags | When to Use |
|-----------|------|-------------|
| "sentinel conformance" | `--profile all` | Full matrix across every profile in RFC-0005 |
| "check R<n>" | `--check R<n>` | Single R-point (e.g. `R2`) |
| "conformance v1-wired" | `--profile v1-wired` | One profile scope |
| "conformance rfc 9" (future) | `--rfc Plans/Specs/RFC-0009-*.md` | Any RFC with a §13 YAML manifest |
| "conformance --json" | `--json` | CI / machine consumption |

## Authoring Contract

The RFC markdown MUST contain a **machine-readable conformance manifest** — a YAML fenced block wrapped in tagged HTML comments. See RFC-0005 §13.0 for the canonical example. Required fields:

- `schema_version: 1` (bump when fields are added; never rename)
- `rfc: <RFC-ID>`
- `rfc_title: <string>`
- `profiles: { <name>: { section, requirements[] } }` where each requirement has `id`, `text`, `check`
- Optional `conventions: { <slug>: { text, source_section, check } }`

Tag boundaries (line-anchored — line-start required so prose mentions don't match):

```
<!-- conformance-machine-readable -->
```yaml
...
```
<!-- /conformance-machine-readable -->
```

Quote any YAML value containing a literal `:` (e.g. `"^phase:"`) to avoid nested-mapping parse errors.

## Check Identifier Convention

Each requirement's `check:` field names the handler in registry.ts. Convention:

- `ast.<thing>` — requires AST walking (ts-morph). Use for code-semantic checks.
- `presence.<thing>` — filesystem / presence / regex-sufficient checks.
- `<rfc-id>.<thing>` — (future) namespace for cross-RFC checks when a second spec with §13 profiles lands.

Multiple requirements MAY route to the same handler (shared check identifier).

## Pre-commit Gate 5

Every commit runs:

```
bun Packs/sentinel/src/Tools/ValidateRfcConformance.ts --profile all
```

Non-zero exit blocks the commit. Override via `DOS_CONFORMANCE_GATE_MODE=warn` (soft, discouraged) or `git commit --no-verify` (same escape hatch as gates 1–4).

## Adding a Handler (Future PRs)

1. Create `Packs/sentinel/src/Tools/ConformanceChecks/handlers/<R-id>-<slug>.ts` exporting a `CheckHandler`
2. Register it in `registry.ts` keyed by the manifest's `check:` identifier
3. Add a companion `<R-id>-<slug>.test.ts` with a seeded failing fixture under `__fixtures__/<R-id>-fail/` and a compliant fixture under `__fixtures__/<R-id>-pass/`
4. Run `bun test Packs/sentinel/src/Tools/ConformanceChecks/` — both fixtures must behave as expected
5. From the DOS source checkout (dev machines only — operators on a standard install skip this), run `bun Tools/sync-check.ts --fix` to propagate to the other copies

Gate 5 picks up new handlers automatically — no pre-commit edit needed.

## Registered Handlers

This catalog is **generated** from `Tools/ConformanceChecks/registry.ts` — do not hand-edit.
Regenerate after adding or removing a handler:

```bash
bun Packs/sentinel/src/Tools/ConformanceChecks/catalog.ts --md
```

`101` handlers are registered. The `presence.rrule-catalog-registry-parity` handler
(R85) FAILS if the block below drifts from the registry. R-ids are scoped per RFC namespace —
the same R-id can appear under distinct check-keys (e.g. RFC-0028 R17 `presence.conventions-no-null-rule`
vs RFC-0059 R17 `presence.prd-frontmatter-complete`).

<!-- BEGIN generated-catalog -->
| R-id | Check id | Category | Enforced by |
|---|---|---|---|
| — | `ast.added-by-prefix` | ast | sentinel conformance (ts-morph AST) |
| R2 | `ast.atomic-state-writes` | ast | sentinel conformance (ts-morph AST) |
| R7 | `ast.discriminated-union-return` | ast | sentinel conformance (ts-morph AST) |
| R5 | `ast.phase-regex` | ast | sentinel conformance (ts-morph AST) |
| R47 | `ast.prd-id-stability` | ast | sentinel conformance (ts-morph AST) |
| R-DLQ-6 | `dlq.cross-tenant-isolation` | dlq | DLQ isolation profile (RFC-0062) |
| R82 | `format.catalog-match-line` | format | sentinel conformance (format check) |
| R97 | `lint.archive-test-suffix` | lint | lint-skills / CI canary |
| R81 | `lint.ci-gate-canary` | lint | lint-skills / CI canary |
| R91 | `lint.false-green` | lint | lint-skills / CI canary |
| R95 | `lint.hook-timing-adoption` | lint | lint-skills / CI canary |
| R94 | `lint.no-test-process-exit` | lint | lint-skills / CI canary |
| R96 | `lint.pack-version-bump` | lint | lint-skills / CI canary |
| R93 | `lint.reflection-schema` | lint | lint-skills / CI canary |
| R80 | `lint.verifier-fail-on-empty` | lint | lint-skills / CI canary |
| R-ACL-3 | `pai-acl.fabric-patterns-catalogued` | pai-acl | PAI-as-Port ACL profile (RFC-0061) |
| R-ACL-4 | `pai-acl.merge-audit-trail-present` | pai-acl | PAI-as-Port ACL profile (RFC-0061) |
| R-ACL-2 | `pai-acl.no-pai-vocabulary-leak` | pai-acl | PAI-as-Port ACL profile (RFC-0061) |
| R-ACL-1 | `pai-acl.pai-origin-files-declared` | pai-acl | PAI-as-Port ACL profile (RFC-0061) |
| R45 | `presence.ac-derivable-from-oos` | presence | sentinel conformance |
| R60 | `presence.artifact-spec-body-sections` | presence | sentinel conformance |
| R59 | `presence.artifact-spec-frontmatter-complete` | presence | sentinel conformance |
| R61 | `presence.artifact-spec-sample-matches-producer` | presence | sentinel conformance |
| R23 | `presence.backup-freshness` | presence | sentinel conformance |
| R18 | `presence.backup-health` | presence | sentinel conformance |
| R66 | `presence.bash-policy-declared` | presence | sentinel conformance |
| R1 | `presence.bridge-actions-mapped` | presence | sentinel conformance |
| R3 | `presence.bridge-boot-quarantine` | presence | sentinel conformance |
| R43 | `presence.bridge-symbol-co-location` | presence | sentinel conformance |
| R12 | `presence.bridge-version-sync` | presence | sentinel conformance |
| R87 | `presence.catalog-composes-resolves` | presence | sentinel conformance |
| R88 | `presence.catalog-ref-path-live` | presence | sentinel conformance |
| R86 | `presence.catalog-status-enum-valid` | presence | sentinel conformance |
| R89 | `presence.catalog-validates-against-valid` | presence | sentinel conformance |
| R57 | `presence.checkpoint-stale-clear` | presence | sentinel conformance |
| R92 | `presence.complete-prd-past-soak` | presence | sentinel conformance |
| R17 | `presence.conventions-no-null-rule` | presence | sentinel conformance |
| R78 | `presence.council-before-body` | presence | sentinel conformance |
| R73 | `presence.curated-pointer-upstream` | presence | sentinel conformance |
| R24 | `presence.dag-pre-delegation-contract` | presence | sentinel conformance |
| R20 | `presence.datetime-ground-truth` | presence | sentinel conformance |
| R40 | `presence.declared-wing-provisioned` | presence | sentinel conformance |
| R63 | `presence.declined-line-matches-capability` | presence | sentinel conformance |
| R34 | `presence.dirty-tree-audit` | presence | sentinel conformance |
| R36 | `presence.discovery-first-section` | presence | sentinel conformance |
| R-DLQ-6 | `presence.dlq-cross-tenant-isolation` | presence | sentinel conformance |
| R55 | `presence.drift-check-roadmap-section` | presence | sentinel conformance |
| R90 | `presence.drift-check-telos-anchor-section` | presence | sentinel conformance |
| R30 | `presence.drift-telemetry-liveness` | presence | sentinel conformance |
| R-ACL-3 | `presence.fabric-patterns-catalogued` | presence | sentinel conformance |
| R22 | `presence.fork-canonical-alias-parity` | presence | sentinel conformance |
| R19 | `presence.frozen-release-invariant` | presence | sentinel conformance |
| R27 | `presence.getmemorysubdir-compliance` | presence | sentinel conformance |
| R54 | `presence.goal-deadlock-hook` | presence | sentinel conformance |
| R58 | `presence.handler-registered-or-inactive` | presence | sentinel conformance |
| R67 | `presence.hook-type-stage-compat` | presence | sentinel conformance |
| R29 | `presence.intel-first-active` | presence | sentinel conformance |
| R14 | `presence.intel-pre-flight-rule-present` | presence | sentinel conformance |
| R18 | `presence.isc-count-gate` | presence | sentinel conformance |
| R70 | `presence.isc-single-assertion` | presence | sentinel conformance |
| R3 | `presence.learn-evidence-on-complete-prds` | presence | sentinel conformance |
| R38 | `presence.memory-health-prd-section` | presence | sentinel conformance |
| R26 | `presence.memory-observability` | presence | sentinel conformance |
| R-ACL-4 | `presence.merge-audit-trail-present` | presence | sentinel conformance |
| R37 | `presence.migration-constraint-discovery` | presence | sentinel conformance |
| R-ACL-2 | `presence.no-pai-vocabulary-leak` | presence | sentinel conformance |
| R-ACL-1 | `presence.pai-origin-files-declared` | presence | sentinel conformance |
| R44 | `presence.parent-rfc-frontmatter` | presence | sentinel conformance |
| R52 | `presence.partials-doctrine-version` | presence | sentinel conformance |
| R35 | `presence.phase-complete-gate-active` | presence | sentinel conformance |
| R1 | `presence.phase-complete-gate-hook` | presence | sentinel conformance |
| R2 | `presence.phase-complete-gate-registered` | presence | sentinel conformance |
| R31 | `presence.phase-predicate-emission` | presence | sentinel conformance |
| R4 | `presence.pkg-spec-upper-bound` | presence | sentinel conformance |
| R46 | `presence.prd-anti-criteria-form` | presence | sentinel conformance |
| R50 | `presence.prd-changelog-format` | presence | sentinel conformance |
| R71 | `presence.prd-closure-isc-parity` | presence | sentinel conformance |
| R48 | `presence.prd-feature-traceability` | presence | sentinel conformance |
| R17 | `presence.prd-frontmatter-complete` | presence | sentinel conformance |
| R65 | `presence.prd-progress-denominator` | presence | sentinel conformance |
| R72 | `presence.prd-promotion-debt-advisory` | presence | sentinel conformance |
| R49 | `presence.prd-test-coverage` | presence | sentinel conformance |
| R75 | `presence.prd-verdict-roadmap-coherence` | presence | sentinel conformance |
| R51 | `presence.prd-verification-evidence` | presence | sentinel conformance |
| R25 | `presence.pre-flight-memory-writes` | presence | sentinel conformance |
| R64 | `presence.predicate-canonical` | presence | sentinel conformance |
| R19 | `presence.predicate-vocab-parity` | presence | sentinel conformance |
| R9 | `presence.pretooluse-factcheck` | presence | sentinel conformance |
| R74 | `presence.qatester-gate-contract-guardian` | presence | sentinel conformance |
| R62 | `presence.reflection-jsonl-fields-stable` | presence | sentinel conformance |
| R32 | `presence.reflection-jsonl-parity` | presence | sentinel conformance |
| R39 | `presence.registry-canonical-parity` | presence | sentinel conformance |
| R56 | `presence.release-alias-versions-flag` | presence | sentinel conformance |
| R42 | `presence.resolver-source-parity` | presence | sentinel conformance |
| R16 | `presence.rfc-status-enum-valid` | presence | sentinel conformance |
| R8 | `presence.ring-buffer-exists` | presence | sentinel conformance |
| R85 | `presence.rrule-catalog-registry-parity` | presence | sentinel conformance |
| R83 | `presence.security-validator-hardened-floor` | presence | sentinel conformance |
| R53 | `presence.session-baseline-hook` | presence | sentinel conformance |
| R10 | `presence.session-context-prune` | presence | sentinel conformance |
| R33 | `presence.session-continuity` | presence | sentinel conformance |
| R13 | `presence.sessionend-slow-hook-detached` | presence | sentinel conformance |
| R6 | `presence.skill-md-parity` | presence | sentinel conformance |
| R28 | `presence.sync-check-parity` | presence | sentinel conformance |
| R98 | `presence.task-projection-wired` | presence | sentinel conformance |
| R68 | `presence.token-source-explicit` | presence | sentinel conformance |
| R100 | `presence.tools-lint-wired` | presence | sentinel conformance |
| R69 | `presence.track-bootstrap-artifacts-complete` | presence | sentinel conformance |
| R99 | `presence.visibility-roster-parity` | presence | sentinel conformance |
| R21 | `presence.working-tree-clean-doctrine` | presence | sentinel conformance |
| R84 | `presence.worktree-memory-write-guard` | presence | sentinel conformance |
| R15 | `regex.no-xapikey-against-studio` | regex | sentinel conformance (source regex) |
| R41 | `regex.statusline-no-sum-global-totals` | regex | sentinel conformance (source regex) |
| C1 | `seed-array.commit-adapter-required` | seed-array | sentinel conformance (seed-array) |
| C2 | `workflow-regex.research-no-direct-researcher` | workflow-regex | sentinel conformance (workflow regex) |
| C1 | `workflow-regex.scraping-no-direct-adapter` | workflow-regex | sentinel conformance (workflow regex) |
<!-- END generated-catalog -->

## Output

Conformance is the Gate-5 verdict surface, so its output must be unambiguous —
three DISTINCT states, never folded. Render the result matrix with
`renderConformanceMatrix` from `Tools/render-report.ts` (golden-tested): one glyph
per requirement plus a tallied footer that surfaces all three states.

- ✅ **pass** — requirement verified against the live tree
- ❌ **fail** — requirement violated (the actionable rows)
- ⊘ **not_applicable** — requirement out of scope here (e.g. KG-dependent check in a
  repo with no palace) — NEVER rendered as pass

Open the report with the shared `renderReportHeader` band (project · wing · UTC ·
`Conformance` · OK/DEGRADED). When the run is degraded (a KG/bridge-dependent
profile could not reach its source), open with `renderDegradedBanner` FIRST — a
`not_applicable` from an unreachable source must not read as a clean pass.

```text
── Sentinel Conformance · acme · wing acme · 2026-06-26T12:00:00Z · OK ──

✅ R17 — prd-frontmatter-complete
✅ R18 — isc-count-gate
❌ R44 — 2/7 applicable PRDs missing parent_rfc
⊘ R19 — predicate-vocab-parity (KG not initialised — not applicable here)

✅ 2 pass · ❌ 1 fail · ⊘ 1 not_applicable  (4 checks)
```

Every headline percentage in this report renders `X% (n of m)` via `renderPercent`
— a bare `%` with no denominator (or one that silently dropped `not_applicable`
from the count) is the dark-pattern this surface exists to prevent.

## Related

- **RFC-0005 §13** — source-of-truth for requirements
- **RFC-0005 §13.0** — machine-readable manifest
- **Workflows/Guard.md** — lightweight regex convention checks (adjacent, not replaced)
- **Workflows/Scan.md** — cold-start codebase analysis (orthogonal)
