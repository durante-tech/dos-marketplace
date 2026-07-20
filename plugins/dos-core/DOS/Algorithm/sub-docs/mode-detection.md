<!--
Sub-doc lifted from upstream PAI ALGORITHM v6.3.0 / v6.2.0 (W-2.27/28/32/34 per MASTER_LIFT_MANIFEST.md §2.6).
Translated through DOS Anti-Corruption Layer 2026-05-04: PAI paths → DOS paths, {{DA_NAME}} → Durante, {{PRINCIPAL_NAME}} → Lucas, KNOWLEDGE/ → MemPalace/, Pulse → Studio, Forge/Anvil/Cato → Engineer-GPT/Engineer-Kimi/Auditor-GPT, ISA → PRD, IsaFormat → PRDFormat.
Loaded on demand by the active Algorithm doctrine (resolve via DOS/Algorithm/LATEST).
-->

# Mode & Parameter Detection (Algorithm v6.2.0)

Loaded by OBSERVE on demand when ideate, optimize, fast-path, or effort override modes are detected.

---

## Effort Override Detection

**Triggers:** `/e[1-5]` or `E[1-5]` as standalone token in message (case-insensitive)

**Mapping:** E1=Standard, E2=Extended, E3=Advanced, E4=Deep, E5=Comprehensive

When detected:
1. Set effort level to corresponding tier — this is an override, not a hint
2. Add `effort_source: explicit` to PRD frontmatter
3. Skip "Set effort level" auto-detection in OBSERVE
4. E1 additionally forces fast-path mode (OBSERVE→EXECUTE→VERIFY) when task structure allows
5. AI may note complexity mismatch in PRD but MUST proceed at specified level

**Interaction with modes:** E-level and mode (ideate/optimize/research) are orthogonal. Both can be set simultaneously. E-level sets the tier; mode sets the execution pattern.

> **NOTE (2026-06-12 — updated for the ratified router, classifier spec §een_contract):** Hook-side `/eN` detection is now IMPLEMENTED, and the prior swallow paths are closed. The earlier swallow — `/e[1-5]` dying in IntentRetrieval's slash-skip and a bare standalone `E[1-5]` dying in the `len < 10` skip — no longer happens: the router's per-`UserPromptSubmit` trace append runs BEFORE all gates (classifier spec B.1), so the override is always observed and logged, and GATE-0 carries two narrow exemptions (a leading `/e[1-5]` token is not treated as a slash-command skip; a standalone `E[1-5]` token is exempt from the `<10`-char skip). Detection lives in the single classifier (`detectEffortOverride`, after the machine-text strip, before the evidence classes). The override is applied **ratchet-only** (heuristics may up-route, never down-route): `/e2`–`/e5` (and standalone `E2`–`E5`) up-route the emission to the ALGORITHM-REQUIRED banner — they are the strongest positive evidence available — while `/e1` (Standard) NEVER down-routes (if positive evidence already yields ALGORITHM the banner stands and the trace records the mismatch; if the class is single-step or no-evidence, `/e1` mints no hint, because operator phrasing about effort is not task scope). `EscalationGate` stays silent on operator `/eN` by design (RFC-0066: operator explicit wins — gate emits no floor); the explicit level is consumed by the classifier, not the gate. The trace row carries `effort_source: explicit` + `explicit_level`, and an emitted banner appends one `effort_source: explicit (/eN operator override)` line so step 2 above is satisfied from the hook side rather than relying on model recall.

---

## Ideate Mode

**Triggers:** `ideate [problem]` | `id8 [problem]` | `generate ideas for` | `dream up solutions for`

1. Set `mode: ideate` in PRD frontmatter
2. Load `~/.claude/DOS/ALGORITHM/ideate-loop.md`
3. Map effort tier to `time_scale` per ideate-loop.md

## Optimize Mode

**Trigger:** `optimize [target]`

1. Determine `eval_mode`:
   - `metric_command` provided or code target → `eval_mode: metric`
   - Prompt/skill/agent target or explicit `eval_mode: eval` → `eval_mode: eval`
2. Set `mode: optimize` and `eval_mode` in PRD frontmatter

## Parameter Detection (Ideate & Optimize)

**Resolution order:** Preset → Focus → Individual overrides → Meta-Learner (ideate only)

1. Check for explicit **preset name** → `algorithm_config.preset`
2. Check for **focus value** (0.0–1.0) → `algorithm_config.focus`
3. Check for **individual param specs** → overrides
4. If no explicit params, infer from **tone**:

| Preset | Tone keywords |
|--------|---------------|
| `dream` | wild, dream, free-form, surprise me, hallucinate |
| `explore` | explore, broad, brainstorm |
| `directed` | focused, practical, actionable |
| `surgical` | precise, surgical, optimal |
| `cautious` (optimize) | careful, safe, production |
| `aggressive` (optimize) | bold, aggressive, fast |

5. Resolve via `parameter-schema.md`
6. Write resolved `algorithm_config:` block to PRD frontmatter

## Fast-Path Detection (revised v6.2.0)

Available at **Standard tier (E1) only.** Compresses phases for simple tasks AND skips the mandatory `Skill("prd")` invocation that would otherwise fire at OBSERVE for E2+.

**The fast-path is a whitelist, not a heuristic.** A task qualifies for fast-path ONLY if every condition below holds. This is deliberate — the v5.0.0 BPE concern is that any heuristic-shaped bypass becomes a doctrine-evasion route. The whitelist closes that.

**Execute-and-verify archetype (E1 fast-path):**
ALL must hold:
- Effort tier is E1 (auto-detected or explicit `/e1`).
- Task is one of: rename a symbol, fix a typo, run a command, read-and-report-on a file, append a single line, format/lint, single-package install, single test run.
- Single file or single command in scope.
- No multi-step transformation.
- No new architecture, no new endpoints, no new dependencies, no migrations.

**How tier is established (2026-06-12 — ratified router model, classifier spec clauses A/E/G):** Runtime mode emission is governed by an **evidence-class table** and a **single-authority rule**. Every `UserPromptSubmit` is classified, in a fixed first-match-wins order, into exactly one of seven evidence classes — (1) machine-text, (2) greeting/rating, (3) multi-step, (4) single-step archetype, (5) repair-verb-ambiguous, (6) question/converse, (7) no-evidence — and that class alone decides the emission: an ALGORITHM-REQUIRED banner (classes 3/5-with-scope), a MINIMAL or NATIVE hint (classes 2/4), or **silence** (classes 1/6-without-evidence/7). The classifier never decides on raw prompt length; length is never evidence in either direction.

**Single authority:** EXACTLY ONE `UserPromptSubmit` hook emits a mode line per turn, on every class. The classifier is exported from `IntentRetrieval.hook.ts` and is the only mode classifier in the stage; `OrchestratorPrompt.hook.ts` suppresses its own mode line entirely (its internal effort/category logic may still drive memory behavior but emits no mode text), and `EscalationGate.hook.ts` emits a tier-FLOOR assertion (`MODE_FLOOR` `additionalContext` under the RFC-0066 model-side contract), never a banner. There is therefore no path by which two hooks disagree about the mode for one turn.

**Deliberate class-7 silence:** when a turn carries no work evidence, the router is SILENT by design — it does not assert any mode. So **absence of a banner reads as a logged verdict, not a hook outage**: every classification (including silent ones) writes a trace row to `LEARNING/SIGNALS/router-trace.jsonl` (project-first, global fallback) before any gate, so a silent turn is observable as `emission: silent` rather than a missing event. An optional mode-neutral reminder (the verbatim CLAUDE.md "Your first output MUST be the mode header…" quote) is available behind `DOS_ROUTER_NEUTRAL_REMINDER=1` (default OFF); it never asserts a mode for the current turn.

**Rollout state:** the single-authority emission flip is gated by `DOS_ROUTER_SILENT_DEFAULT=1`. In the shadow window (flag unset) the legacy banners still emit exactly as before while the evidence-class classifier and trace log run unconditionally; after the flip the classifier becomes the sole emitter. Either way, tier resolves model-side at OBSERVE per this doc's Effort Override Detection section, and the five fast-path conditions above are evaluated by the model, not gated by a precondition hook.

If ALL whitelist conditions hold:
- Set `mode: fast-path` in PRD frontmatter.
- Inline-write the minimal PRD (Goal + Criteria only — the E1 tier completeness floor) without invoking `Skill("prd")`.
- Compress to: OBSERVE → EXECUTE → VERIFY (skip THINK/PLAN/BUILD).

If ANY whitelist condition fails:
- Fast-path does NOT apply.
- Proceed with standard 7-phase Algorithm at the resolved tier (E2+ requires `Skill("prd")` invocation at OBSERVE).

**Research-only archetype:**
Analysis, review, or investigation with no code changes.
- Set `mode: research` in PRD frontmatter.
- Skip PRD creation only at E1 with the same whitelist conditions; otherwise scaffold via `Skill("prd")`.
- Compress to: OBSERVE → THINK → EXECUTE → VERIFY → LEARN.

**v6.2.0 doctrine note:** the whitelist exists because the new twelve-section PRD frame and `Skill("prd")` invocation pattern raise the OBSERVE-phase floor. Without an explicit whitelist, an E1 task could "feel like" a fast-path candidate to the model and bypass the skill silently — recreating the v5.0.0 BPE under-cut Lucas and Durante already closed at the mode-selection layer in v6.0.0. The whitelist is the same enforcement pattern, applied one level deeper.
