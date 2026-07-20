#!/usr/bin/env bun
/**
 * SkillRouteGuard.hook.ts — PreToolUse routing observer (Week 1: log-only).
 *
 * Fires on Bash invocations only and classifies whether a DOS skill
 * should have handled the call instead. Writes one JSONL line per
 * decision to `MEMORY/LEARNING/REFLECTIONS/skill-routing.jsonl`.
 *
 * Scope ruling (operator, 2026-07-12, decision 01KX9PXH2QS3YT36670MGHP4FY):
 * "Drop shape-routing for Read/Edit — telemetry keeps Bash/Skill/Agent only."
 * Read/Edit/MultiEdit produced 10,726 rows with 18 missed (pure coarse-shape
 * noise). WebFetch RESTORED by operator round-2 answer (2026-07-12, decision
 * 01KXA71MHMXC9T7SJ415D16PX9) — its 405 'missed' rows were the log's best
 * signal, worth keeping here alongside WebFetchRouter's dedicated telemetry
 * (RFC-0031). Skill and Agent telemetry live in SkillActivationWriter and
 * the spawn-attribution ledger.
 *
 * Week 1 constraint: MODE is hardcoded to "log". The hook NEVER emits
 * a decision object — it just logs and exits 0. Week 2 flips to warn,
 * Week 3 flips to block on verified routes. Schema at
 * `~/.claude/DOS/SELECTION-telemetry.md`.
 *
 * Fails open on every error path. Never breaks the underlying tool call.
 */

import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { readHookInput, startTimer, stopTimer } from "./lib/hook-io";
import { loadSelectionCache, classifyInputShape } from "./lib/selection-cache";

const HOME = homedir();
const DOS_DIR = process.env.DOS_DIR || join(HOME, ".claude");
const LOG_DIR = join(DOS_DIR, "MEMORY", "LEARNING", "REFLECTIONS");
const LOG_PATH = join(LOG_DIR, "skill-routing.jsonl");

const MODE = "log" as const;
const PRIMITIVE_TOOLS = new Set(["Bash", "WebFetch"]);

// A tie among more than this many skills is not a routing signal, it is the absence of one.
// classifyInputShape has only ~13 coarse shapes; the "text" bucket alone is 113 skills (the
// persona/advisory skills all accept [text,code,design]), so reading a source file "ties" every
// one of them. Ties this broad carry no actionable recommendation. The genuine-ambiguity band is
// small (2-5 closely-related skills); there is a natural gap in the observed distribution between
// 5 and 13. Broader ties are recorded as "na" with a distinct rule so the reason is preserved.
const AMBIGUITY_MAX_CANDIDATES = 5;

type Decision = "matched" | "missed" | "ambiguous" | "na";

function sampleInput(toolInput: Record<string, unknown>): string {
  const raw =
    (toolInput.url as string) ??
    (toolInput.file_path as string) ??
    (toolInput.path as string) ??
    (toolInput.command as string) ??
    JSON.stringify(toolInput).slice(0, 200);
  return String(raw).slice(0, 200);
}

function resolveCandidates(shape: string, acceptsIndex: Record<string, string[]>): string[] {
  return acceptsIndex[shape] ?? [];
}

function computeDecision(
  candidates: string[],
  rule: { candidates: string[]; rule: string } | undefined,
): { decision: Decision; recommendation: string | null; confidence: number; ruleMatched: string } {
  if (candidates.length === 0) {
    return { decision: "na", recommendation: null, confidence: 1.0, ruleMatched: "no-candidate" };
  }
  if (candidates.length === 1) {
    return {
      decision: "missed",
      recommendation: candidates[0],
      confidence: 0.9,
      ruleMatched: "single-candidate",
    };
  }
  // 2+ candidates — check if SELECTION.md has a curated rule
  if (rule?.candidates && rule.candidates.length > 0) {
    // Use first candidate in rule that exists in our index
    const preferred = rule.candidates.find((c) => candidates.some((cand) => cand.includes(c)));
    if (preferred) {
      return {
        decision: "missed",
        recommendation: preferred,
        confidence: 0.75,
        ruleMatched: "curated-rule",
      };
    }
  }
  // Coarse-bucket tie with no curated winner: only a genuine small-N tie is a real ambiguity
  // signal worth surfacing. A tie broader than the band is coarse-shape noise → "na" (no signal),
  // which stops it from burying the "missed" and small-tie signals the telemetry exists to catch.
  // (Forge H-121; log-only hook — this changes the recorded label, not any routing behavior.)
  if (candidates.length > AMBIGUITY_MAX_CANDIDATES) {
    return { decision: "na", recommendation: null, confidence: 1.0, ruleMatched: "too-broad-shape" };
  }
  return {
    decision: "ambiguous",
    recommendation: null,
    confidence: 1.0 / candidates.length,
    ruleMatched: "unresolved-tie",
  };
}

async function main(): Promise<void> {
  const start = performance.now();
  const input = (await readHookInput()) as unknown as {
    tool_name?: string;
    tool_input?: Record<string, unknown>;
    session_id?: string;
  } | null;
  if (!input) process.exit(0);

  const toolName = input.tool_name ?? "";
  if (!PRIMITIVE_TOOLS.has(toolName)) process.exit(0);

  const toolInput = input.tool_input ?? {};
  const shape = classifyInputShape(toolName, toolInput);

  let cache;
  try {
    cache = loadSelectionCache();
  } catch {
    process.exit(0); // fail-open: SELECTION.md unavailable
  }

  const candidates = resolveCandidates(shape, cache.acceptsIndex);
  const rule = cache.rules[shape];
  const { decision, recommendation, confidence, ruleMatched } = computeDecision(candidates, rule);

  const entry = {
    timestamp: new Date().toISOString(),
    session_id: input.session_id ?? null,
    tool_name: toolName,
    tool_input_shape: shape,
    input_sample: sampleInput(toolInput),
    decision,
    skill_candidates: candidates,
    skill_recommendation: recommendation,
    confidence: Number(confidence.toFixed(2)),
    rule_matched: ruleMatched,
    hook_latency_ms: Number((performance.now() - start).toFixed(2)),
    mode: MODE,
  };

  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_PATH, `${JSON.stringify(entry)}\n`);
  } catch {
    // Fail-open on log write.
  }
  // Log-only mode: NEVER emit decision object; tool call proceeds normally.
  process.exit(0);
}

const _t = startTimer("SkillRouteGuard");
process.on("exit", () => stopTimer(_t, "PreToolUse"));
main().catch(() => process.exit(0));
