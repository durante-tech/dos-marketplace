/**
 * registry — maps check identifiers (from the manifest `check:` field) to
 * concrete handler implementations. Keyed by `check:` not R-id, so multiple
 * requirements can share a handler. Unknown checks return `not_applicable`
 * with the manifest text as evidence — silent-skip is prohibited by §1
 * Clause 2.
 */

import { addedByPrefix } from "./handlers/added-by-prefix.ts";
import { c1ScrapingNoDirectAdapter } from "./handlers/C1-scraping-no-direct-adapter.ts";
import { c1SeedArrayCommitAdapterRequired } from "./handlers/C1-seed-array-commit-adapter-required.ts";
import { c2ResearchNoDirectResearcher } from "./handlers/C2-research-no-direct-researcher.ts";
import { r1BridgeActionsMapped } from "./handlers/R1-bridge-actions-mapped.ts";
import { r2AtomicStateWrites } from "./handlers/R2-atomic-state-writes.ts";
import { r3BridgeBootQuarantine } from "./handlers/R3-bridge-boot-quarantine.ts";
import { r4PkgSpecUpperBound } from "./handlers/R4-pkg-spec-upper-bound.ts";
import { r5PhaseRegex } from "./handlers/R5-phase-regex.ts";
import { r6SkillMdParity } from "./handlers/R6-skill-md-parity.ts";
import { r7DiscriminatedUnionReturn } from "./handlers/R7-discriminated-union-return.ts";
import { r8RingBufferExists } from "./handlers/R8-ring-buffer-exists.ts";
import { r9PreToolUseFactCheck } from "./handlers/R9-pretooluse-factcheck.ts";
import { r10SessionContextPrune } from "./handlers/R10-session-context-prune.ts";
import { r12BridgeVersionSync } from "./handlers/R12-bridge-version-sync.ts";
import { r13SessionEndSlowHookDetached } from "./handlers/R13-sessionend-slow-hook-detached.ts";
import { r14IntelPreFlightRulePresent } from "./handlers/R14-intel-pre-flight-rule-present.ts";
import { r15NoXApiKeyAgainstStudio } from "./handlers/R15-no-xapikey-against-studio.ts";
import { r16RfcStatusEnum } from "./handlers/R16-rfc-status-enum.ts";
import { r17ConventionsNoNullRule } from "./handlers/R17-conventions-no-null-rule.ts";
import { r18BackupHealth } from "./handlers/R18-backup-health.ts";
import { r19FrozenReleaseInvariant } from "./handlers/R19-frozen-release-invariant.ts";
// RFC-0059 handlers (R17-R35 in RFC-0059 namespace — distinct check: keys from RFC-0028 era)
import { r17PrdFrontmatterComplete } from "./handlers/R17-prd-frontmatter-complete.ts";
import { r18IscCountGate } from "./handlers/R18-isc-count-gate.ts";
import { r19PredicateVocabParity } from "./handlers/R19-predicate-vocab-parity.ts";
import { r20DatetimeGroundTruth } from "./handlers/R20-datetime-ground-truth.ts";
import { r21WorkingTreeCleanDoctrine } from "./handlers/R21-working-tree-clean-doctrine.ts";
import { r22ForkCanonicalAliasParity } from "./handlers/R22-fork-canonical-alias-parity.ts";
import { r23BackupFreshness } from "./handlers/R23-backup-freshness.ts";
import { r24DagPreDelegationContract } from "./handlers/R24-dag-pre-delegation-contract.ts";
import { r25PreFlightMemoryWrites } from "./handlers/R25-pre-flight-memory-writes.ts";
import { r26MemoryObservability } from "./handlers/R26-memory-observability.ts";
import { r27GetmemorysubdirCompliance } from "./handlers/R27-getmemorysubdir-compliance.ts";
import { r28SyncCheckParity } from "./handlers/R28-sync-check-parity.ts";
import { r29IntelFirstActive } from "./handlers/R29-intel-first-active.ts";
import { r30DriftTelemetryLiveness } from "./handlers/R30-drift-telemetry-liveness.ts";
import { r31PhasePredicateEmission } from "./handlers/R31-phase-predicate-emission.ts";
import { r32ReflectionJsonlParity } from "./handlers/R32-reflection-jsonl-parity.ts";
import { r33SessionContinuity } from "./handlers/R33-session-continuity.ts";
import { r34DirtyTreeAudit } from "./handlers/R34-dirty-tree-audit.ts";
import { r35PhaseCompleteGateActive } from "./handlers/R35-phase-complete-gate-active.ts";
// RFC-0068 handler (R36 — RFC-0068 ISC-5.2, mechanizes ISC-5.1 doctrine §6.1.e2)
import { r36DiscoveryFirstSection } from "./handlers/R36-discovery-first-section.ts";
// v0.0.10 Bucket B4 — R37 mechanizes DOSUpgrade reflection theme #4 (constraint discovery upfront)
import { r37MigrationConstraintDiscovery } from "./handlers/R37-migration-constraint-discovery.ts";
// V11.14 (RFC-0035 §3 item 9 residual) — R38 enforces 📚 MEMORY HEALTH: section on Deep+ PRDs
import { r38MemoryHealthPrdSection } from "./handlers/R38-memory-health-prd-section.ts";
// 2026-05-09 incident → R39-R43: registry asymmetry, declared-but-unprovisioned wing,
// statusline N×total math bug, resolver dual-path inconsistency, post-V11.13-split staleness
import { r39RegistryCanonicalParity } from "./handlers/R39-registry-canonical-parity.ts";
import { r40DeclaredWingProvisioned } from "./handlers/R40-declared-wing-provisioned.ts";
import { r41StatuslineNoSumGlobalTotals } from "./handlers/R41-statusline-no-sum-global-totals.ts";
import { r42ResolverSourceParity } from "./handlers/R42-resolver-source-parity.ts";
import { r43BridgeSymbolCoLocation } from "./handlers/R43-bridge-symbol-co-location.ts";
// V12.6-α (RFC-0085 / RFC-0080 council 2026-05-12) — vNext PRD presence checks
import { R44_parent_rfc_frontmatter as r44ParentRfcFrontmatter } from "./handlers/R44-parent-rfc-frontmatter.ts";
import { R45_ac_derivable_from_oos as r45AcDerivableFromOos } from "./handlers/R45-ac-derivable-from-oos.ts";
// V12.6-β (RFC-0085 §2 — 5 more vNext rules; R47 reserved for V13.4 ID-stability)
import { R46_prd_anti_criteria_form as r46PrdAntiCriteriaForm } from "./handlers/R46-prd-anti-criteria-form.ts";
import { R48_prd_feature_traceability as r48PrdFeatureTraceability } from "./handlers/R48-prd-feature-traceability.ts";
import { R49_prd_test_coverage as r49PrdTestCoverage } from "./handlers/R49-prd-test-coverage.ts";
import { R50_prd_changelog_format as r50PrdChangelogFormat } from "./handlers/R50-prd-changelog-format.ts";
import { R51_prd_verification_evidence as r51PrdVerificationEvidence } from "./handlers/R51-prd-verification-evidence.ts";
// V13.3a (RFC-0083 §5.5 split — partials doctrine version sweep forward-guard)
import { R52_partials_doctrine_version as r52PartialsDoctrineVersion } from "./handlers/R52-partials-doctrine-version.ts";
// V13.4 (RFC-0085 §2 deferred replacement — git-history ID-stability monotonicity)
import { R47_prd_id_stability as r47PrdIdStability } from "./handlers/R47-prd-id-stability.ts";
// v0.0.15 foundation-fix sprint (PRD-20260513-145627 ISC-25) — R53-R57 regression
// guards for ISC-4 SessionBaseline / ISC-5 GoalDeadlockDetect / ISC-6 runRoadmapReconcile
// / ISC-7 --alias-versions / CheckpointPerISC tryStaleClear.
import { r53SessionBaselineHook } from "./handlers/R53-session-baseline-hook.ts";
import { r54GoalDeadlockHook } from "./handlers/R54-goal-deadlock-hook.ts";
import { r55DriftCheckRoadmapSection } from "./handlers/R55-drift-check-roadmap-section.ts";
import { r56ReleaseAliasVersionsFlag } from "./handlers/R56-release-alias-versions-flag.ts";
import { r57CheckpointStaleClear } from "./handlers/R57-checkpoint-stale-clear.ts";
// PRD-20260513-190458 (v0.0.15 orphan handler audit) ISC-6 — handler files
// under hooks/handlers/ must be registered (direct OR 1-hop transitive via a
// registered .hook.ts importer); files in handlers/_inactive/ are excluded.
import { r58HandlerRegisteredOrInactive } from "./handlers/R58-handler-registered-or-inactive.ts";
// RFC-0098 (V16.1) — Sentinel R-rule batch R59-R64
import { r59ArtifactSpecFrontmatterComplete } from "./handlers/R59-artifact-spec-frontmatter-complete.ts";
import { r60ArtifactSpecBodySections } from "./handlers/R60-artifact-spec-body-sections.ts";
import { r61ArtifactSpecSampleMatchesProducer } from "./handlers/R61-artifact-spec-sample-matches-producer.ts";
import { r62ReflectionJsonlFieldsStable } from "./handlers/R62-reflection-jsonl-fields-stable.ts";
import { r63DeclinedLineMatchesCapability } from "./handlers/R63-declined-line-matches-capability.ts";
import { r64PredicateCanonical } from "./handlers/R64-predicate-canonical.ts";
// 28D delivery sprint (2026-05-15) — R65-R68 batch
//   R65 (D9):  PRD progress denominator audit — Algorithm v0.0.10 §6.1.e6 regression guard
//   R66 (D11): operator-declared bash-security posture — companion: damage-control pack
//   R67 (D12): hook type×stage compat — mirrors Claude Code v2.1.142 platform error
//   R68 (D13): explicit auth-mode declaration — closes ANTHROPIC_API_KEY clobber gotcha
import { r65PrdProgressDenominator } from "./handlers/R65-prd-progress-denominator.ts";
import { r66BashPolicyDeclared } from "./handlers/R66-bash-policy-declared.ts";
import { r67HookTypeStageCompat } from "./handlers/R67-hook-type-stage-compat.ts";
import { r68TokenSourceExplicit } from "./handlers/R68-token-source-explicit.ts";
// V16 track-bootstrap promotion (Tier 4) — 7-artifact invariant for the
// research-package meta-pattern (canonical: MEMORY/CANONICAL/track-bootstrap-pattern.md)
import { r69TrackBootstrapArtifactsComplete } from "./handlers/R69-track-bootstrap-artifacts-complete.ts";
// 2026-05-17 council ratification — R70 fat-criterion enforcement (Metz seat).
// Empirically justified by prd-projector baseline: 533 fat criteria across 111
// of 200 PRDs (55.5%). Splitting Test (§3.1) exists in doctrine but ignored at
// scale. See MEMORY/RESEARCH/2026-05/prd-projector-baseline-2026-05-17.md.
import { r70IscSingleAssertion } from "./handlers/R70-isc-single-assertion.ts";
// 2026-05-18 — R71 closes silent-verification-debt loophole identified by
// audit PRD 20260518-025157_unchecked-isc-rootcause-framework-audit.
// Spec: MEMORY/RESEARCH/2026-05/unchecked-isc-rootcause-framework-audit.md §6
// Closes R65 numerator gap + R17 cross-project subdir gap.
// Terminal set sourced from Packs/prd/src/lifecycle/terminal-phases.json (R-FW-6).
import { r71PrdClosureIscParity } from "./handlers/R71-prd-closure-isc-parity.ts";
// 2026-05-18 (Phase 1.5) — R72 promotion-debt advisory. Surfaces PRDs where
// progress=X/X but phase!=terminal AND age>=7d (Mode F per framework audit).
// Status=always-pass; evidence count is the signal. Advisory bucket.
import { r72PrdPromotionDebtAdvisory } from "./handlers/R72-prd-promotion-debt-advisory.ts";
// RFC-0107 Phase 1 (2026-05-19) — R73 curated-pointer Aggregate-identity guard.
// For any pack with `plugin.json.kind === "curated-pointer"`, enforces
// `plugin.json.upstream` is a non-empty http(s) URL. Co-ships with the Phase 1
// cohort (Cockburn C1 + Feathers C3 + Beck C4 convergent — not deferred).
import { r73CuratedPointerUpstream } from "./handlers/R73-curated-pointer-upstream.ts";
// Canonical-format campaign (2026-07-06) — R99 RFC-0011 §6.3 Appendix C roster
// ↔ pack frontmatter visibility parity (the Sentinel public-vs-internal and
// Security internal-vs-public drift class; both found+fixed at rule birth).
import { r99VisibilityRosterParity } from "./handlers/R99-visibility-roster-parity.ts";
// Canonical-format campaign Tier C (2026-07-06) — R100 Tools/ authoring stack
// presence tripwire (scaffold + lint + baseline + generated catalog + gate/CI
// wiring; an unwired checker is prose with extra steps).
import { r100ToolsLintWired } from "./handlers/R100-tools-lint-wired.ts";
// Amendment H §H.6 J4 (2026-05-25) — R74 QATesterGate contract guardian.
// Reads Docs/Contracts/qatester-gate-contract.md and asserts the 3-piece
// extract-interface holds against agents/QATester.md when Amendment H is
// Status: ACTIVE. Gated on Status: DRAFT (returns not_applicable) so the
// rule does NOT false-positive during the ratification window. Warning
// tier on first ship (Amendment E precedent — R44/R45). Spec:
// MEMORY/WORK/active/20260525-144641_qatester-gate-j-cluster-prereqs/PRD.md
import { r74QATesterGateContractGuardian } from "./handlers/R74-qatester-gate-contract-guardian.ts";
// A12 of v0.0.18 kickoff council Round 2 R2-D6 (Architect Finding 5) —
// R75 `presence.prd-verdict-roadmap-coherence`. Council named this R65
// verbally; integer-suffix bumped to R75 here to avoid collision with the
// existing R65 `prd-progress-denominator` handler (shipped 2026-05-15).
// Default mode = advisory; DOS_R75_MODE=strict promotes to fail-tier.
import { r75PrdVerdictRoadmapCoherence } from "./handlers/R75-prd-verdict-roadmap-coherence.ts";
// R78 — Council BEFORE artifact phase ordering, mechanized per UncleBob
// Council seat amendment in parent PRD `20260526-191054_reflection-upgrade-
// design-council` Decision D5. Design PRD `20260527-presence-council-before-
// body-rule` (22 ISCs) defines the 8-test contract; parent canonical
// `MEMORY/CANONICAL/patterns/council-before-artifact.md` §"Mechanical surface"
// names this R-rule. Ships at E3+ per §0 TierConfig ANTI-SKIP; grandfather
// cutoff = 2026-05-26 (parent ratification date) mirroring R46's pattern.
import { r78PresenceCouncilBeforeBody } from "./handlers/R78-presence-council-before-body.ts";
// R80 — lint.verifier-fail-on-empty (RFC-0129 clause #9 keystone, Wave-3).
// The corpus's FIRST `lint.*` static-source-scan rule: scans workflows/*.js for
// fan-out verifier shapes that can pass on zero output (false green). Ships
// WARN-ONLY (handler always returns `pass`; violations surface in evidence) and
// is intentionally ABSENT from Tools/sentinel/baseline.json's verdict_matrix —
// additive, zero change to existing verdicts. Companion `_runtime` helper:
// Packs/agents/_runtime/verifierFanout.ts (fail-on-empty contract). Council
// synthesis: MEMORY/ARCHIVE/2026-06/20260602_dos-upgrade-scan-disposition/
// wave2-4-ratification-and-spikes.md (per-clause #9).
import { r80LintVerifierFailOnEmpty } from "./handlers/R80-lint-verifier-fail-on-empty.ts";
// R81 — lint.ci-gate-canary (spike #22 promotion). The corpus's SECOND `lint.*`
// rule: a tamper-evident tripwire verifying CI gate files (.github/workflows/*.yml
// + Tools/sentinel/baseline.json) still hash to the blessed sha256 in
// .github/ci-canary.json. Decision logic in the reusable Tool ../ci-canary.ts
// (verifyCanary) — one decision function, also backing the CLI / future CI-step.
// Ships WARN-ONLY (handler always `pass`; trips surface in evidence) — the honest
// accident-catcher tier; fail-tier + CI-step + self-bless mitigation are the
// documented ladder (FP-soak + normalization + operator security decision).
import { r81LintCiGateCanary } from "./handlers/R81-lint-ci-gate-canary.ts";
// R91 — lint.false-green (RFC-0146 F3). The corpus's THIRD `lint.*` rule: scans
// gate/CI/test scripts for exit-code-laundering idioms (--passWithNoTests,
// pipe-without-pipefail, regen-then-self-compare). WARN-ONLY (always pass).
import { r91LintFalseGreen } from "./handlers/R91-lint-false-green.ts";
// R93 — lint.reflection-schema (§K.1 mechanism 3). The corpus's FOURTH `lint.*`
// rule: scans .sh/.ts/.py code surfaces for raw appends to the reflections log
// outside the bridge append_reflection writer. AUDIT-tier companion to the
// bridge validation (never the load-bearing gate). WARN-ONLY (always pass).
import { r93LintReflectionSchema } from "./handlers/R93-lint-reflection-schema.ts";
// R94 — lint.no-test-process-exit (fifth `lint.*` rule): process.exit in a
// test-runner-discoverable file truncates the whole suite at that point (the
// 2026-07-02 honest-gate incident: a spike's exit(0) masked ~25 failures for a
// month, locally and in CI). AUDIT-tier companion to the CI file-count floor
// (the load-bearing gate). WARN-ONLY (always pass).
import { r94NoTestProcessExit } from "./handlers/R94-no-test-process-exit.ts";
// R95 — lint.hook-timing-adoption (sixth `lint.*` rule): *.hook.ts files
// should use the hook-io timing wrapper (or opt out with a reason) so
// Tools/hook-profiler.ts can see them — ~5/97 adoption at 2026-07-02 audit.
// WARN-ONLY (always pass).
import { r95HookTimingAdoption } from "./handlers/R95-hook-timing-adoption.ts";
// R96 — lint.pack-version-bump (seventh `lint.*` rule): pack src/ changed in
// the recent history window without an extension.yaml version-line change —
// 39/50 versions were "stamped once" at the 2026-07-02 audit. WARN-ONLY.
import { r96PackVersionBump } from "./handlers/R96-pack-version-bump.ts";
// R97 — lint.archive-test-suffix (eighth `lint.*` rule): a runner-discoverable
// *.test file left under an archive/ dir is re-executed by `bun test Tools ...`
// against dead code (the 2026-07-02 archive sweep renamed each to .archived so
// discovery skips it). Sibling hazard to R94's truncator. WARN-ONLY.
import { r97ArchiveTestSuffix } from "./handlers/R97-archive-test-suffix.ts";
// R98 — presence.task-projection-wired (ninth guard): the RFC-0149 parity-lint
// (Tools/task-projection-check.ts + test) — the warn-tier teeth the §6.3 TASK
// PROJECTION doctrine substep points to — must stay present in-tree. WARN-ONLY.
import { r98TaskProjectionWired } from "./handlers/R98-task-projection-wired.ts";
// R92 (Wave D ISC-15) — presence.complete-prd-past-soak. Advisory (work-corpus):
// flags phase:complete PRDs left under MEMORY/WORK (flat + active/) past the 7d
// soak — a completed PRD ArchivePromote should have moved to MEMORY/ARCHIVE.
import { r92CompletePrdPastSoak } from "./handlers/R92-complete-prd-past-soak.ts";
// RFC-0060 handlers (R1-R3 in RFC-0060 namespace — distinct check: keys from RFC-0005 R1-R3)
import { r1PhaseCompleteGateHook } from "./handlers/R1-phase-complete-gate-hook.ts";
import { r2PhaseCompleteGateRegistered } from "./handlers/R2-phase-complete-gate-registered.ts";
import { r3LearnEvidenceOnCompletePrds } from "./handlers/R3-learn-evidence-on-complete-prds.ts";
// RFC-0061 handlers (R-ACL-1..R-ACL-4 — PAI-as-Port Anti-Corruption Layer enforcement)
import { rAcl1PaiOriginFilesDeclared } from "./handlers/R-ACL-1-pai-origin-files-declared.ts";
import { rAcl2NoPaiVocabularyLeak } from "./handlers/R-ACL-2-no-pai-vocabulary-leak.ts";
import { rAcl3FabricPatternsCatalogued } from "./handlers/R-ACL-3-fabric-patterns-catalogued.ts";
import { rAcl4MergeAuditTrailPresent } from "./handlers/R-ACL-4-merge-audit-trail-present.ts";
// RFC-0062 §9 handlers (R-DLQ-6 — F3 producer-side cross-tenant scope guard)
import { rDlq6CrossTenantIsolation } from "./handlers/R-DLQ-6-cross-tenant-isolation.ts";
// RFC-0134 C4 — R82 format.catalog-match-line (validates the §6.1.k `## Catalog Match` section)
import { r82FormatCatalogMatchLine } from "./handlers/R82-format-catalog-match-line.ts";
// RFC-0112 §11.3 item 6 — R83 SecurityValidator hardened-floor (no-patterns-file fail-closed)
import { r83SecurityValidatorHardenedFloor } from "./handlers/R83-security-validator-hardened-floor.ts";
import { r84WorktreeMemoryWriteGuard } from "./handlers/R84-worktree-memory-write-guard.ts";
import { r85RruleCatalogRegistryParity } from "./handlers/R85-rrule-catalog-registry-parity.ts";
import { r86CatalogStatusEnumValid } from "./handlers/R86-catalog-status-enum-valid.ts";
import { r87CatalogComposesResolves } from "./handlers/R87-catalog-composes-resolves.ts";
import { r88CatalogRefPathLive } from "./handlers/R88-catalog-ref-path-live.ts";
import { r89CatalogValidatesAgainstValid } from "./handlers/R89-catalog-validates-against-valid.ts";
// R90 (Telos #123 F2) — presence.drift-check-telos-anchor-section. Wiring canary
// (sibling of R55) asserting Tools/drift-check.ts keeps the runTelosAnchorAudit
// corpus→KG anchor audit section so the KG-invisibility gate can't silently regress.
import { r90DriftCheckTelosAnchorSection } from "./handlers/R90-drift-check-telos-anchor-section.ts";
import type { CheckHandler } from "./types.ts";

export const HANDLERS: Record<string, CheckHandler> = {
  "format.catalog-match-line": r82FormatCatalogMatchLine,
  "presence.security-validator-hardened-floor": r83SecurityValidatorHardenedFloor,
  // RFC-0137 (2026-06-26) — R84 worktree MEMORY write-guard presence check.
  "presence.worktree-memory-write-guard": r84WorktreeMemoryWriteGuard,
  // Sentinel vNext (2026-06-26) — R85 catalog↔registry parity (the generated
  // R-rule catalog in Conformance.md must list exactly these HANDLERS keys).
  "presence.rrule-catalog-registry-parity": r85RruleCatalogRegistryParity,
  // 2026-06-26 catalog self-compliance audit — R86 status-enum-validity. R59
  // confirms the `status` key is present; this closes the VALUE gap (the audit
  // found pages/ specs with out-of-enum `superseded`/`active`). Warning-tier
  // (RFC-0085 default for new presence checks) — ships in warn-mode until the
  // remediation pass remaps the two offenders.
  "presence.catalog-status-enum-valid": r86CatalogStatusEnumValid,
  // Same audit, batch — R87 composes resolution + well-formedness (26 danglers
  // + 1 YAML-object corruption), R88 ref-path-liveness (dead Docs/Artifacts/
  // citations), R89 validates_against validity (8 phantom check-keys). All
  // warning-tier (RFC-0085) — ship in warn-mode until the remediation pass.
  "presence.catalog-composes-resolves": r87CatalogComposesResolves,
  "presence.catalog-ref-path-live": r88CatalogRefPathLive,
  "presence.catalog-validates-against-valid": r89CatalogValidatesAgainstValid,
  "ast.atomic-state-writes": r2AtomicStateWrites,
  "ast.phase-regex": r5PhaseRegex,
  "ast.added-by-prefix": addedByPrefix,
  "presence.bridge-actions-mapped": r1BridgeActionsMapped,
  "presence.skill-md-parity": r6SkillMdParity,
  "presence.ring-buffer-exists": r8RingBufferExists,
  "presence.bridge-version-sync": r12BridgeVersionSync,
  "presence.bridge-boot-quarantine": r3BridgeBootQuarantine,
  "presence.pkg-spec-upper-bound": r4PkgSpecUpperBound,
  "presence.session-context-prune": r10SessionContextPrune,
  "presence.pretooluse-factcheck": r9PreToolUseFactCheck,
  "presence.sessionend-slow-hook-detached": r13SessionEndSlowHookDetached,
  "presence.intel-pre-flight-rule-present": r14IntelPreFlightRulePresent,
  "regex.no-xapikey-against-studio": r15NoXApiKeyAgainstStudio,
  "presence.rfc-status-enum-valid": r16RfcStatusEnum,
  "presence.conventions-no-null-rule": r17ConventionsNoNullRule,
  "presence.backup-health": r18BackupHealth,
  "presence.frozen-release-invariant": r19FrozenReleaseInvariant,
  "ast.discriminated-union-return": r7DiscriminatedUnionReturn,
  "workflow-regex.scraping-no-direct-adapter": c1ScrapingNoDirectAdapter,
  "workflow-regex.research-no-direct-researcher": c2ResearchNoDirectResearcher,
  "seed-array.commit-adapter-required": c1SeedArrayCommitAdapterRequired,
  // RFC-0059 §13.1 Tier-1 doctrine-presence rules
  "presence.prd-frontmatter-complete": r17PrdFrontmatterComplete,
  "presence.isc-count-gate": r18IscCountGate,
  "presence.predicate-vocab-parity": r19PredicateVocabParity,
  "presence.datetime-ground-truth": r20DatetimeGroundTruth,
  "presence.working-tree-clean-doctrine": r21WorkingTreeCleanDoctrine,
  "presence.fork-canonical-alias-parity": r22ForkCanonicalAliasParity,
  "presence.backup-freshness": r23BackupFreshness,
  // RFC-0059 §13.2 Tier-2 dynamic-traces rules
  "presence.dag-pre-delegation-contract": r24DagPreDelegationContract,
  "presence.pre-flight-memory-writes": r25PreFlightMemoryWrites,
  "presence.memory-observability": r26MemoryObservability,
  "presence.getmemorysubdir-compliance": r27GetmemorysubdirCompliance,
  "presence.sync-check-parity": r28SyncCheckParity,
  "presence.intel-first-active": r29IntelFirstActive,
  "presence.drift-telemetry-liveness": r30DriftTelemetryLiveness,
  // RFC-0059 §13.3 Tier-3 system-coherence rules
  "presence.phase-predicate-emission": r31PhasePredicateEmission,
  "presence.reflection-jsonl-parity": r32ReflectionJsonlParity,
  "presence.session-continuity": r33SessionContinuity,
  "presence.dirty-tree-audit": r34DirtyTreeAudit,
  // RFC-0059 §13.4 enforcement-active rules (RFC-0060)
  "presence.phase-complete-gate-active": r35PhaseCompleteGateActive,
  // RFC-0068 ISC-5.2 — mechanizes ISC-5.1 DISCOVERY-FIRST CHECKPOINT doctrine
  "presence.discovery-first-section": r36DiscoveryFirstSection,
  // v0.0.10 B4 — DOSUpgrade reflection theme #4 (constraint discovery upfront on migration PRDs)
  "presence.migration-constraint-discovery": r37MigrationConstraintDiscovery,
  // V11.14 (RFC-0035 §3 item 9) — Deep+ PRDs must include 📚 MEMORY HEALTH: snapshot
  "presence.memory-health-prd-section": r38MemoryHealthPrdSection,
  // 2026-05-09 incident — registry/resolver/math/co-location safety net
  "presence.registry-canonical-parity": r39RegistryCanonicalParity,
  "presence.declared-wing-provisioned": r40DeclaredWingProvisioned,
  "regex.statusline-no-sum-global-totals": r41StatuslineNoSumGlobalTotals,
  "presence.resolver-source-parity": r42ResolverSourceParity,
  "presence.bridge-symbol-co-location": r43BridgeSymbolCoLocation,
  // V12.6-α (RFC-0085) — vNext PRD presence checks (RFC-0080 council 2026-05-12)
  "presence.parent-rfc-frontmatter": r44ParentRfcFrontmatter,
  "presence.ac-derivable-from-oos": r45AcDerivableFromOos,
  // V12.6-β (RFC-0085 §2 — 5 more vNext rules; R47 reserved for V13.4 ID-stability)
  "presence.prd-anti-criteria-form": r46PrdAntiCriteriaForm,
  "presence.prd-feature-traceability": r48PrdFeatureTraceability,
  "presence.prd-test-coverage": r49PrdTestCoverage,
  "presence.prd-changelog-format": r50PrdChangelogFormat,
  "presence.prd-verification-evidence": r51PrdVerificationEvidence,
  // V13.3a (RFC-0083 §5.5 split — partials doctrine version sweep forward-guard)
  "presence.partials-doctrine-version": r52PartialsDoctrineVersion,
  // V13.4 (RFC-0085 §2 deferred replacement — git-history ID-stability monotonicity)
  "ast.prd-id-stability": r47PrdIdStability,
  // RFC-0060 §13.1 enforcement-active rules
  "presence.phase-complete-gate-hook": r1PhaseCompleteGateHook,
  "presence.phase-complete-gate-registered": r2PhaseCompleteGateRegistered,
  "presence.learn-evidence-on-complete-prds": r3LearnEvidenceOnCompletePrds,
  // RFC-0061 §13.1 PAI-as-Port ACL enforcement rules (R-ACL-1..R-ACL-4)
  // Registered under both the RFC §13 manifest check: keys (pai-acl.*) and the
  // presence.* convention namespace so ValidateRfcConformance and presence-style
  // callers both resolve correctly.
  "pai-acl.pai-origin-files-declared": rAcl1PaiOriginFilesDeclared,
  "pai-acl.no-pai-vocabulary-leak": rAcl2NoPaiVocabularyLeak,
  "pai-acl.fabric-patterns-catalogued": rAcl3FabricPatternsCatalogued,
  "pai-acl.merge-audit-trail-present": rAcl4MergeAuditTrailPresent,
  // presence.* aliases — PRD ISC-G.2..G.5 naming convention + downstream callers
  "presence.pai-origin-files-declared": rAcl1PaiOriginFilesDeclared,
  "presence.no-pai-vocabulary-leak": rAcl2NoPaiVocabularyLeak,
  "presence.fabric-patterns-catalogued": rAcl3FabricPatternsCatalogued,
  "presence.merge-audit-trail-present": rAcl4MergeAuditTrailPresent,
  // RFC-0062 §9 R-DLQ-6 — F3 producer-side cross-tenant scope guard
  "presence.dlq-cross-tenant-isolation": rDlq6CrossTenantIsolation,
  "dlq.cross-tenant-isolation": rDlq6CrossTenantIsolation,
  // v0.0.15 foundation-fix sprint (PRD-20260513-145627 ISC-25) — R53-R57
  // regression guards
  "presence.session-baseline-hook": r53SessionBaselineHook,
  "presence.goal-deadlock-hook": r54GoalDeadlockHook,
  "presence.drift-check-roadmap-section": r55DriftCheckRoadmapSection,
  // Telos #123 F2 (2026-06-27) — R90 corpus→KG anchor-vs-header wiring canary
  // (sibling of R55): asserts Tools/drift-check.ts keeps the runTelosAnchorAudit
  // section so the anchor-mint enforcement (anchor-less entities are invisible to
  // the purpose-graph KG) can't silently regress out of the drift radiator.
  "presence.drift-check-telos-anchor-section": r90DriftCheckTelosAnchorSection,
  "presence.release-alias-versions-flag": r56ReleaseAliasVersionsFlag,
  "presence.checkpoint-stale-clear": r57CheckpointStaleClear,
  // PRD-20260513-190458 (v0.0.15 orphan handler audit) ISC-6 — orphan-handler guard
  "presence.handler-registered-or-inactive": r58HandlerRegisteredOrInactive,
  // RFC-0098 (V16.1 — Sentinel R-rule batch R59-R64) — atomic-design catalog
  // presence checks + D5 reflection-JSONL drift resolver + R63 Decline Protocol
  // dual-write enforcement + R64 canonical-predicate complement to R19.
  "presence.artifact-spec-frontmatter-complete": r59ArtifactSpecFrontmatterComplete,
  "presence.artifact-spec-body-sections": r60ArtifactSpecBodySections,
  // Renamed 2026-05-25 (v0.0.18 A7, RFC-0098 §15.1 SPEC-BS-1 resolution) —
  // previously `presence.artifact-spec-matches-producer`. New slug is honest
  // about the sampling semantic (handler spot-checks first matching instance).
  "presence.artifact-spec-sample-matches-producer": r61ArtifactSpecSampleMatchesProducer,
  "presence.reflection-jsonl-fields-stable": r62ReflectionJsonlFieldsStable,
  "presence.declined-line-matches-capability": r63DeclinedLineMatchesCapability,
  "presence.predicate-canonical": r64PredicateCanonical,
  // 28D delivery sprint (2026-05-15) — R65-R68 batch
  "presence.prd-progress-denominator": r65PrdProgressDenominator,
  "presence.bash-policy-declared": r66BashPolicyDeclared,
  "presence.hook-type-stage-compat": r67HookTypeStageCompat,
  "presence.token-source-explicit": r68TokenSourceExplicit,
  "presence.track-bootstrap-artifacts-complete": r69TrackBootstrapArtifactsComplete,
  // 2026-05-17 council — R70 fat-criterion ban with pairing-exception escape
  "presence.isc-single-assertion": r70IscSingleAssertion,
  // 2026-05-18 — R71 silent-verification-debt detector (warning-tier).
  // Terminal-set canonical at Packs/prd/src/lifecycle/terminal-phases.json.
  // Grandfather baseline at MEMORY/STATE/closure-debt-baseline.json (R-FW-7).
  // Closes R65 numerator gap + R17 cross-project subdir-recursion gap.
  "presence.prd-closure-isc-parity": r71PrdClosureIscParity,
  // 2026-05-18 (Phase 1.5) — R72 promotion-debt advisory (Mode F).
  "presence.prd-promotion-debt-advisory": r72PrdPromotionDebtAdvisory,
  // RFC-0107 Phase 1 (2026-05-19) — R73 curated-pointer-upstream guard.
  "presence.curated-pointer-upstream": r73CuratedPointerUpstream,
  // Canonical-format campaign (2026-07-06) — R99 roster↔frontmatter visibility parity.
  "presence.visibility-roster-parity": r99VisibilityRosterParity,
  // Canonical-format campaign Tier C (2026-07-06) — R100 Tools/ stack tripwire.
  "presence.tools-lint-wired": r100ToolsLintWired,
  "presence.qatester-gate-contract-guardian": r74QATesterGateContractGuardian,
  // A12 of v0.0.18 kickoff council Round 2 R2-D6 (Architect Finding 5).
  // Council named this `R65` verbally; the integer suffix bumped to R75
  // here to avoid registry collision with the existing R65
  // `presence.prd-progress-denominator` (shipped 2026-05-15). The
  // load-bearing identity is the check: key (Evans seat — Ubiquitous
  // Language pin). Default mode = advisory (1 sprint of FP-rate
  // measurement); promote via DOS_R75_MODE=strict.
  "presence.prd-verdict-roadmap-coherence": r75PrdVerdictRoadmapCoherence,
  // R78 — Council BEFORE artifact phase ordering. Parent PRD slug:
  // `20260526-191054_reflection-upgrade-design-council` (D5 UncleBob amendment
  // + D9 self-validating). Design PRD slug:
  // `20260527-presence-council-before-body-rule`.
  "presence.council-before-body": r78PresenceCouncilBeforeBody,
  // R80 — lint.verifier-fail-on-empty (RFC-0129 clause #9). First `lint.*`
  // static-source-scan rule. WARN-ONLY (always pass; evidence-only signal);
  // absent from baseline verdict_matrix by design. Promote to fail-tier after
  // FP-rate measurement (R75 DOS_R75_MODE precedent).
  "lint.verifier-fail-on-empty": r80LintVerifierFailOnEmpty,
  // R81 — lint.ci-gate-canary (spike #22 promotion). Second `lint.*` rule: a
  // tamper-evident tripwire over CI gate files vs blessed sha256 in
  // .github/ci-canary.json. WARN-ONLY (always pass; trips surface in evidence).
  // Promote to fail-tier + CI-step + self-bless mitigation after FP-soak +
  // normalization policy + operator security decision (documented ladder).
  "lint.ci-gate-canary": r81LintCiGateCanary,
  // R91 — lint.false-green (RFC-0146 F3). Third `lint.*` rule: gate/CI/test
  // scripts must not launder a failing exit code into a green. WARN-ONLY (always
  // pass; evidence-only); absent from baseline verdict_matrix by design. Promote
  // after FP-rate soak (R75/R80 precedent).
  "lint.false-green": r91LintFalseGreen,
  // R93 — lint.reflection-schema (§K.1 mechanism 3). Fourth `lint.*` rule:
  // reflections reach algorithm-reflections.jsonl only through the bridge
  // append_reflection action (no raw >>/appendFile/open-'a' writes). AUDIT-tier
  // companion to the bridge validation — never the load-bearing gate. WARN-ONLY
  // (always pass; evidence-only). Promote after FP-rate soak (R75/R80/R91
  // precedent).
  "lint.reflection-schema": r93LintReflectionSchema,
  // R94 — lint.no-test-process-exit. Fifth `lint.*` rule: test files must not
  // call process.exit (suite truncation; the honest-gate incident's vector).
  // process.exitCode is the sanctioned form. AUDIT-tier companion to the CI
  // file-count floor — never the load-bearing gate. WARN-ONLY (always pass;
  // evidence-only). Promote after FP-rate soak (R75/R80/R91/R93 precedent).
  "lint.no-test-process-exit": r94NoTestProcessExit,
  // R95 — lint.hook-timing-adoption. Hooks without hook-io/startTimer (and no
  // opt-out) are invisible to the profiler. AUDIT-tier, WARN-ONLY (always
  // pass; evidence-only). Promote near ~80% adoption (R75/R80 precedent).
  "lint.hook-timing-adoption": r95HookTimingAdoption,
  // R96 — lint.pack-version-bump. Recently-changed pack src/ without a
  // version bump in the same window. AUDIT-tier, WARN-ONLY (always pass;
  // evidence-only). Promote only after the versioning convention is
  // operator-ratified (changes contributor workflow).
  "lint.pack-version-bump": r96PackVersionBump,
  // R97 — lint.archive-test-suffix. A runner-discoverable *.test file under an
  // archive/ dir is re-executed against retired code by `bun test Tools ...`;
  // the archive sweep's `.archived` rename is what keeps it out of discovery.
  // AUDIT-tier, WARN-ONLY (always pass; evidence-only). Promote after FP soak.
  "lint.archive-test-suffix": r97ArchiveTestSuffix,
  // R98 — presence.task-projection-wired. Guards that the RFC-0149 parity-lint
  // (Tools/task-projection-check.ts + test), the teeth the §6.3 TASK PROJECTION
  // substep invokes, is not silently deleted. Presence guard (f(HEAD),
  // committed-class), WARN-ONLY (always pass; missing artifacts in evidence).
  "presence.task-projection-wired": r98TaskProjectionWired,
  // R92 (Wave D ISC-15) — advisory (work-corpus): phase:complete PRDs past the 7d
  // soak still under MEMORY/WORK (flat + active/) should be in MEMORY/ARCHIVE.
  "presence.complete-prd-past-soak": r92CompletePrdPastSoak,
};

export function hasHandler(check: string): boolean {
  return Object.prototype.hasOwnProperty.call(HANDLERS, check);
}
