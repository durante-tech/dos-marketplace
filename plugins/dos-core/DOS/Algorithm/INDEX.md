# DOS Algorithm Doctrine — Overlay INDEX

Active = `~/.claude/DOS/Algorithm/LATEST` (today `v0.0.11`). Resolution chain: **v0.0.11** (Amendment S banner stub — operative text is `v0.0.10.md` Parts 1–16 per the no-version-fork ratification) → **v0.0.10** (Amendment F consolidated file, now carrying Parts 1–16) → **v0.0.9** (V12.x amendments) → **v0.0.8** (host spec). Higher version supersedes lower on conflict; all unreplaced rules carry forward. Behavior is preserved across overlays — `v0.0.{8,9,10}.md` headers explicitly assert it.

## v0.0.8 — host spec + 10 ratified upgrades (`v0.0.8.md`, 1005 lines)

| § | Rule | Origin |
|---|---|---|
| §0 | TierConfig (E1–E5 effort tiers) · Thresholds | host |
| §1.2 | Task Profile Classifier · **Audit Quality Gate column** | host · **v0.0.8 proposal #3** |
| §1.3 | Walking Skeleton WHITELIST (E1 fast-path) | host |
| §2 | PRD as System of Record · format v2.1 | host |
| §3 | ISC Decomposition · Splitting Test · 3-Column Template | host |
| §3.3 | ISC Count Gate — **PLAN-time recheck** | **v0.0.8 proposal #8** |
| §4 | Capability Invocation Contract · closed-list vocabulary · **Decline Protocol dual-write** | host · host · **v0.0.8 proposal #2** |
| §4.2 | Orchestration Trigger Check · **`/code-review` MANDATORY EXECUTE→VERIFY** · **`/batch` decline-reason** | host · **v0.0.8 proposal #1** · **v0.0.8 proposal #4** |
| §4.3.1 | **Worktree Isolation Hygiene** | **v0.0.8 proposal #7** |
| §5 | Phase Entry Ritual | host |
| §6 | 7-phase ceremony (OBSERVE → THINK → PLAN → BUILD → EXECUTE → VERIFY → LEARN) | host |
| §6.1.b | MEMORY RECALL · **hard-trigger on PRD/RFC/slug references** | **v0.0.8 proposal #5** |
| §6.1.e2 | **ADJACENT-CONTRACT SCAN** (route/handler/hook/skill) | **v0.0.8 proposal #6** |
| §6.4 | Pre-Delegation Contract · **item 6 Inline context bundle** | host · **v0.0.8 proposal #9** |
| §6.6 | VERIFY — **/code-review Invocation Gate** · **Decisions `Declined:` scan** | **v0.0.8 proposals #1 + #2** |
| §7 | Critical Rules (Zero Exceptions) | host |
| §7.9 | No Silent Stalls — **extends to "considered but skipped"** | **v0.0.8 proposal #10** |
| §7.11 | **/code-review Invocation Gate (CRITICAL)** | **v0.0.8 proposal #1** |
| App. B | Doctrine Self-Test Invariants | host |

## v0.0.9 — V12.x amendments overlay (`v0.0.9.md`, 5 amendments)

| Amendment | What | Affects |
|---|---|---|
| **A** | PRDFORMAT.md v3.0 supersedes §2.2 — vNext (`format_version`, `parent_rfc`); 9 body sections; AC ⊂ OoS subset (R45); R38 header-agnostic detection; dual-mode read window for v2.1 | §2 |
| **B** | OBSERVE stub emits `format_version: 3` + `parent_rfc:`; orphan PRDs declare `🪶 ORPHAN STRATEGIC INTENT:` line in `## Goal` | §6.1.g |
| **C** | `Skill("prd", ...)` row added to Orchestration Trigger Check (PRD authoring + lifecycle) | §4.2 |
| **D** | VERIFY scans for `🚨 PRD CONFORMANCE:` line emitted by PRDConformanceGate.hook.ts (non-blocking) | §6.6 |
| **E** | **R44** `presence.parent-rfc-frontmatter` + **R45** `presence.ac-derivable-from-oos` (warning-tier; RFC-0085 V12.6-α) | Sentinel registry |

## v0.0.10 — Foundation-First overlay (`v0.0.10.md`, 1 amendment)

| Amendment | What | Affects |
|---|---|---|
| **F** | **Foundation-First Discipline** — when surface and foundation fixes are both viable, prefer the foundation. Diagnostic: affirmative on 2-of-5 self-similar-friction signals → re-PLAN with broader scope. Supersedes §6.4 minimal-scope for foundation work. Does NOT exempt §7.11 `/code-review` gate. Does NOT apply to true emergencies, throwaway scripts, unrelated tickets, or operator-explicit OoS | §6.4 |

## Lookup

- **By section anchor** — grep `§N.M` (e.g., `§6.1.e2`) — rightmost column names introducing version
- **By keyword** — grep the rule name (`Decline Protocol`, `Foundation-First`, `MEMORY RECALL`)
- **Sentinel R-rules** — namespace at RFC-0085; handlers at `Packs/sentinel/src/Tools/ConformanceChecks/handlers/`
- **Rollback** — see §10 of any version file for `echo vX.Y.Z > LATEST` invocations

## Lineage

Authored 2026-05-14 under v0.0.16 V16.7 disposition (Bucket B). Council split 2v2 on consolidate-vs-overlay (Feathers + EricEvans → consolidate-to-v0.0.11 on Ubiquitous Language grounds; Cockburn + Fowler → keep-overlay on Crystal-weight + YAGNI grounds). Operator selected Cockburn's compromise: ship this INDEX in v0.0.16, defer full consolidation decision to v0.0.17 with INDEX as informational scaffold. Cascade target: v0.0.17 `algorithm-doctrine-consolidation` (Feathers + EricEvans dissent preserved; 5th seat GregYoung CQRS framing for doctrine-as-aggregate). Provenance: `MEMORY/WORK/20260514-044500_v016-kickoff-council/COUNCIL-RATIFICATION.md` §3 + §8.1.
