#!/usr/bin/env bun
/**
 * OrchestratorPrompt.hook.ts — RFC-0001 interactive runtime spine.
 *
 * Trigger: UserPromptSubmit
 *
 * Starts or resumes file-backed orchestrator state for Algorithm-class prompts
 * and injects the current phase contract. Claude stays interactive; state,
 * criteria mutations, phase completion, diagnostics, and gates are owned by
 * DOS/Tools/orchestrator.
 */

import { appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  EFFORT_DEFAULTS,
  FileStore,
  PHASE_SPECS,
  currentPhaseForRun,
  loadCapabilityRegistry,
  loadExtensionRegistry,
  makePhaseRecord,
  phaseContract,
  type EffortLevel,
} from "../DOS/Tools/orchestrator/index";
import { rank } from "../DOS/Tools/orchestrator/capability-select-core";
import { resolveActiveDoctrine } from "../DOS/Tools/resolve-active-doctrine";
import { startTimer, stopTimer } from "./lib/hook-io";
import { traceOrchestrator } from "./lib/orchestrator-trace";
import { loadProjectEnv } from "./lib/paths";
import { isMachineGeneratedPrompt } from "./lib/machine-text";

loadProjectEnv();

const DOS_DIR = process.env.DOS_DIR || join(homedir(), ".claude");
const STATE_DIR = process.env.DOS_ORCH_STATE_DIR || join(DOS_DIR, "MEMORY", "STATE", "orchestrator");
const ENABLED = process.env.DOS_ORCH_ENABLED !== "0";

// ─── Router emission rollout flag (spec clause C / single-authority clause E) ─
//
// DOS_ROUTER_SILENT_DEFAULT (clause C): when '1' (FLIP), IntentRetrieval.hook.ts
// is the SOLE mode-line authority (it calls classifyPrompt + renderModeLine) and
// THIS hook suppresses its own banner entirely on every class — closing the RT-2
// dual-banner recurrence clause E exists to kill. When unset/'0' (SHADOW), the
// legacy banner emits exactly as today (clause C: "current emission behavior
// unchanged"). Revert is the same single env var — config write, not code revert.
//
// Read once at hook start. Both this hook and IntentRetrieval read the IDENTICAL
// env name with the IDENTICAL default so no turn ever carries two banners or
// zero (partial-flip risk #2). Same set-point surface as SEARCH_MAX_DISTANCE —
// settings.json env or shell env, NOT .gateway.env.
const ROUTER_SILENT_DEFAULT = process.env.DOS_ROUTER_SILENT_DEFAULT === "1";

// Single source of truth — resolveActiveDoctrine() reads LATEST with regex
// validation + fallback. Resolved once at module load; restart hook on flip.
// Retained for the SHADOW-path legacy banner only (suppressed post-flip).
const ALGORITHM_BANNER = `♻︎ Entering the DOS ALGORITHM… (${resolveActiveDoctrine().version}) ═════════════`;

interface HookInput {
  session_id?: string;
  prompt?: string;
  transcript_path?: string;
}

async function readInput(): Promise<HookInput | null> {
  try {
    const raw = await Promise.race([
      Bun.stdin.text(),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error("timeout")), 1000)),
    ]);
    return raw.trim() ? (JSON.parse(raw) as HookInput) : null;
  } catch {
    return null;
  }
}

function classifyEffort(prompt: string): EffortLevel {
  const trimmed = prompt.trim();
  if (/^(hi|hello|thanks|thank you|ok|yes|no)[.! ]*$/i.test(trimmed)) return "minimal";
  if (/\b(deep investigation|extensive research|deep research|comprehensive research|detailed research|market research|competitive research)\b/i.test(prompt)) return "extended";
  // F1 (v0.0.10) — high-impact ALGORITHM signal words trigger extended at
  // single-signal weight. Council debates, ratification, sprint events, and
  // RFC authoring are doctrinally ALGORITHM regardless of prompt length.
  if (/\b(let'?s council|run a council|council debate|ratify|cohort ratification|sprint (kickoff|close|wrap)|architectural decision|let'?s promote|promote (the )?draft|new RFC|RFC[- ]?\d{4})\b/i.test(prompt)) return "extended";
  const signals = [
    // F1 (v0.0.10) — expanded operator vocabulary. Original list missed council /
    // ratify / bucket / ship / promote / sprint / etc, which let multi-step
    // ratification work classify as `fast` and emit NATIVE banner.
    // Trace report: 2026-05-07 session retrospective, ROOT-CAUSE LAYER 1.
    /\b(end[- ]to[- ]end|comprehensive|full|rfc|prd|migrate|refactor|implement|deliver|orchestrat|investigate|research|council|debate|ratify|ratification|bucket|roadmap|audit|isc|promote|architect|design|spec|sprint|wave|cohort|cascade|baseline|tripwire|registry|ship)/i.test(prompt),
    /```/.test(prompt),
    /(?:^|\s)(?:\/|\.\/|[A-Za-z0-9_-]+\.(?:ts|tsx|js|json|md|prisma))/.test(prompt),
    prompt.length > 500,
  ].filter(Boolean).length;
  if (signals >= 2) return "extended";
  if (signals >= 1) return "standard";
  return "fast";
}

// ─── S4 (silence-the-siblings) — REMOVED for the single-authority rule (E) ───
//
// inferEscalationFloor() was the F2 banner-override. Its RFC-0066 trigger
// catalog is now the SHARED inferModeFloor() in lib/mode-classifier.ts, consumed
// by both EscalationGate.hook.ts and IntentRetrieval's classifyPrompt — one
// catalog, no drift. The F2 "banner-vs-MODE_FLOOR silent conflict" it patched is
// closed at the source: the same inferModeFloor result that emits MODE_FLOOR
// additionalContext also up-routes the single banner in IntentRetrieval.
//
// isOptionPickContinuation() (F3 option-pick up-route) is REHOMED to
// IntentRetrieval.hook.ts (it owns the single classifier and already receives
// transcript_path); it passes the result as opts.continuationEvidence to
// classifyPrompt, preserving the F3 up-route inside the single authority.
//
// bannerForEffort() and the early-banner block are deleted below — this hook
// emits NO mode text post-flip (clause E). classifyEffort/classifyCategory are
// RETAINED: they drive orchestrator state-machine effort/category, not a banner.

function classifyCategory(prompt: string): string {
  if (/\b(research|analyze|analysis|compare|review|investigate|competitive intelligence|market landscape)\b/i.test(prompt)) return "analysis";
  if (/\b(test|fix|code|implement|refactor|file|repo|schema|runtime|CLI)\b/i.test(prompt)) return "code";
  if (/\b(write|create|draft|build)\b/i.test(prompt)) return "creation";
  return "action";
}

/**
 * SHADOW-only legacy banner mapping (clause C). Post-flip this is never called —
 * IntentRetrieval's renderModeLine is the sole mode-line authority (clause E).
 * Kept ONLY so the shadow window preserves "current emission behavior unchanged"
 * while the new path classifies + logs unconditionally. Returns null for
 * `minimal` (acks/ratings stay banner-free per CLAUDE.md template).
 *
 * NOTE: the F2 escalation override and F3 option-pick override are GONE — the
 * shadow banner is now the plain effort→mode mapping only. Their up-route
 * survives post-flip via inferModeFloor (E4/E5 ratchet) and
 * opts.continuationEvidence inside the single classifier (IntentRetrieval).
 *
 * Spec: Plans/Specs/RFC-0001-amendment-mode-classifier.md
 */
function shadowBannerForEffort(effort: EffortLevel): string | null {
  switch (effort) {
    case "advanced":
    case "extended":
      return ALGORITHM_BANNER;
    case "standard":
    case "fast":
    case "compressed":
      return "════ DOS | NATIVE MODE ═══════════════════════";
    case "minimal":
    default:
      return null;
  }
}

function shouldStart(prompt: string): boolean {
  if (process.env.DOS_ORCH_FORCE === "1") return true;
  if (/^\s*(\/|#)/.test(prompt)) return false;
  // Never start a run on harness-generated text.
  if (isMachineGeneratedPrompt(prompt)) return false;
  return classifyEffort(prompt) !== "minimal";
}

async function main(): Promise<void> {
  traceOrchestrator({ hook: "prompt", event: "start", details: { state_dir: STATE_DIR } });

  // SINGLE-AUTHORITY RULE (spec clause E) — banner emission moved to
  // IntentRetrieval.hook.ts (the sole UserPromptSubmit mode-line authority).
  //
  // SHADOW (DOS_ROUTER_SILENT_DEFAULT unset/'0'): this block emits the legacy
  // banner exactly as before so "current emission behavior unchanged" holds
  // while IntentRetrieval classifies + logs unconditionally.
  // FLIP (DOS_ROUTER_SILENT_DEFAULT='1'): this block is SUPPRESSED entirely on
  // every class — only IntentRetrieval emits, killing the RT-2 dual-banner
  // recurrence. The orchestrator state-machine work below is unaffected by the
  // flag; only the mode TEXT is gated.
  // Spec: Plans/Specs/RFC-0001-amendment-mode-classifier.md
  const earlyInput = await readInput();
  // Mirror shouldStart's slash/hash guard into the banner path (closes the
  // banner-fires-on-slash-commands path) and skip harness-generated text.
  if (
    !ROUTER_SILENT_DEFAULT &&
    earlyInput?.prompt &&
    !/^\s*[\/#]/.test(earlyInput.prompt) &&
    !isMachineGeneratedPrompt(earlyInput.prompt)
  ) {
    const earlyEffort = classifyEffort(earlyInput.prompt);
    const earlyBanner = shadowBannerForEffort(earlyEffort);
    if (earlyBanner) {
      console.log(earlyBanner);
      console.log(`🗒️ TASK: [${earlyInput.prompt.slice(0, 80).replace(/\n/g, " ")}${earlyInput.prompt.length > 80 ? "..." : ""}]`);
      console.log("");
    }
  }

  if (!ENABLED) {
    traceOrchestrator({ hook: "prompt", event: "env-disabled", details: { state_dir: STATE_DIR } });
    process.exit(0);
  }
  const input = earlyInput;
  if (!input?.session_id || !input.prompt) {
    traceOrchestrator({
      hook: "prompt",
      event: "invalid-input",
      session_id: input?.session_id,
      details: { has_prompt: Boolean(input?.prompt) },
    });
    process.exit(0);
  }

  const statePath = join(STATE_DIR, `${input.session_id}.json`);
  const stateExists = existsSync(statePath);
  const effort = classifyEffort(input.prompt);
  const category = classifyCategory(input.prompt);
  if (!stateExists && !shouldStart(input.prompt)) {
    traceOrchestrator({
      hook: "prompt",
      event: "skipped-prompt",
      session_id: input.session_id,
      state_path: statePath,
      details: { effort, prompt_chars: input.prompt.length },
    });
    process.exit(0);
  }

  const store = new FileStore(input.prompt, input.session_id, STATE_DIR);
  let run = store.getRun();
  traceOrchestrator({
    hook: "prompt",
    event: stateExists ? "state-resumed" : "state-created",
    session_id: input.session_id,
    state_path: store.path,
    details: { effort, active_phases: run.activePhases },
  });

  if (run.activePhases.length === 0 && effort !== "minimal") {
    store.setEffort(effort, category, EFFORT_DEFAULTS[effort].activePhases);
    run = store.getRun();
    traceOrchestrator({
      hook: "prompt",
      event: "state-initialized",
      session_id: input.session_id,
      state_path: store.path,
      details: { effort, category, active_phases: run.activePhases },
    });
  }

  if (!run.phaseRecords.some((r) => r.phase === "CLASSIFY") && run.activePhases.includes("CLASSIFY")) {
    store.appendPhaseRecord(
      makePhaseRecord({
        runId: run.id,
        phase: "CLASSIFY",
        type: PHASE_SPECS.CLASSIFY.type,
        toolGate: PHASE_SPECS.CLASSIFY.toolGate,
        slots: { effort: run.effort, category: run.category, skill: null },
      }),
    );
    run = store.getRun();
    traceOrchestrator({
      hook: "prompt",
      event: "classify-appended",
      session_id: input.session_id,
      phase: "CLASSIFY",
      state_path: store.path,
      details: { effort: run.effort, category: run.category },
    });
  }

  const phase = currentPhaseForRun(run);
  if (!phase) {
    traceOrchestrator({
      hook: "prompt",
      event: "no-active-phase",
      session_id: input.session_id,
      state_path: store.path,
    });
    process.exit(0);
  }
  const capabilityRegistry = loadCapabilityRegistry(DOS_DIR, STATE_DIR);
  const extensionRegistry = await loadExtensionRegistry({ roots: [join(DOS_DIR, "Packs"), join(DOS_DIR, "skills")] });
  for (const diagnostic of extensionRegistry.diagnostics) {
    const latest = store.getRun();
    if (!latest.diagnostics.some((d) => d.code === diagnostic.code && d.message === diagnostic.message)) store.appendDiagnostic(diagnostic);
  }
  traceOrchestrator({
    hook: "prompt",
    event: "contract-injected",
    session_id: input.session_id,
    phase,
    mode: process.env.DOS_ORCH_GATE_MODE || "shadow",
    state_path: store.path,
    details: {
      registry_entries: capabilityRegistry.entries.length,
      registry_hash: capabilityRegistry.hash,
      extension_manifests: extensionRegistry.manifestCount ?? 0,
      extension_contributions: extensionRegistry.contributions.length,
      extension_diagnostics: extensionRegistry.diagnostics.length,
    },
  });

  // ── Capability routing advisor (RFC-0134 C1 — ADVISORY, roadmap P2.4) ──
  // rank() is the pure scorer core (µs over the in-memory registry). Every
  // decision — including abstention — appends one line to
  // MEMORY/STATE/routing-decisions.jsonl for misfire analysis; only a
  // non-abstained result prints, and it never gates.
  let advisorLine: string | null = null;
  try {
    const advisory = rank(input.prompt, capabilityRegistry.entries, { n: 3 });
    appendFileSync(
      join(DOS_DIR, "MEMORY", "STATE", "routing-decisions.jsonl"),
      JSON.stringify({
        ts: new Date().toISOString(),
        session_id: input.session_id,
        phase,
        abstained: advisory.abstained,
        top: advisory.candidates.map((c) => ({ id: c.id, score: c.score, matched: c.matchedTerms.slice(0, 6) })),
        registry_hash: capabilityRegistry.hash,
      }) + "\n",
    );
    if (!advisory.abstained && advisory.candidates.length > 0) {
      advisorLine = `Capability advisor (advisory): ${advisory.candidates.map((c) => `${c.id} (${c.score})`).join(" · ")}`;
    }
  } catch {
    /* advisory only — never block the contract */
  }

  console.log(`\n--- DOS RFC-0001 Orchestrator Contract ---`);
  console.log(phaseContract(store.getRun(), phase, capabilityRegistry, extensionRegistry));
  if (advisorLine) console.log(advisorLine);
  console.log(`State: ${store.path}`);
  console.log(`Gate mode: ${process.env.DOS_ORCH_GATE_MODE || "shadow"}`);
  console.log(`--- End Orchestrator Contract ---\n`);
}

const _t = startTimer("OrchestratorPrompt");
process.on("exit", () => stopTimer(_t, "UserPromptSubmit"));
main().catch((error) => {
  traceOrchestrator({
    hook: "prompt",
    event: "error",
    reason: error instanceof Error ? error.message : String(error),
  });
  console.error(`[OrchestratorPrompt] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(0);
});
