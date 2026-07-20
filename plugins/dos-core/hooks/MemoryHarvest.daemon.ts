#!/usr/bin/env bun
/**
 * MemoryHarvest.daemon.ts — Slow-path session-transcript harvester.
 *
 * PURPOSE:
 * Runs the Haiku inference + extraction filing pipeline OFF the SessionEnd
 * critical path. Spawned detached by `MemoryHarvest.hook.ts` after the
 * wrapper passes the message-count gate.
 *
 * RATIONALE (RFC-0037 follow-up, 2026-05-03):
 * Claude Code's SessionEnd reaper kills hooks that exceed ~5s. The unified
 * MemoryHarvest hook took 20-60s for Haiku inference and was SIGKILL'd
 * silently — `process.on('exit')` doesn't fire on SIGKILL, so no telemetry
 * landed in hook-timing.jsonl, no errors landed in hook-errors.jsonl. The
 * `memory-harvest-last.json` tracker was stuck on a synthetic test-harness
 * run from 2026-04-27 because no real SessionEnd invocation completed.
 *
 * Mirrors the SessionContextSnapshot.hook.ts → SessionContextEnrich.daemon.ts
 * split shipped for the same reason in RFC-0027.
 *
 * INPUT:
 * - env DOS_HARVEST_INPUT_FILE: tmp JSON file written by the wrapper with
 *   { sessionId, transcriptPath, targetWing, conversationText, messageCount,
 *     correctionQueue, correctionContext }
 *
 * OUTPUT:
 * - stderr: status messages (lost when stdio:'ignore' from spawn)
 * - Side effects: MemPalace drawers + KG facts via bridge
 * - Writes: MEMORY/STATE/memory-harvest-last.json (success tracker)
 * - Writes: MEMORY/LEARNING/SYS/harvest-bench.jsonl (RFC-0027 §5.5.1 telemetry)
 *
 * PERFORMANCE:
 * - 20-60s typical (Haiku inference dominates); detached so harness can't kill it
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync, appendFileSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { bridgeSync, batchOps, queueOp, type BridgeOp } from "./lib/mempalace";
import { isPluginInstall, PLUGIN_CODE_PATHS } from "./lib/plugin-data-env";
import { emitMemoryDigest } from './lib/memory-digest';
import { startTimer, stopTimer } from './lib/hook-io';
import { getMemorySubdir } from './lib/paths';

const DOS_DIR = process.env.DOS_DIR || join(homedir(), ".claude");
const STATE_DIR = join(DOS_DIR, "MEMORY", "STATE");
const HARVEST_LOG = join(STATE_DIR, "memory-harvest-last.json");
const INFERENCE_PATH = isPluginInstall()
  ? PLUGIN_CODE_PATHS.inferencePath
  : join(DOS_DIR, "DOS", "Tools", "Inference.ts");

// ─── Temporal Range Parsing ──────────────────────────────────

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function normalizeDeadline(text: string | null | undefined): string | null {
  if (!text || typeof text !== "string") return null;
  const cleaned = text.trim().toLowerCase();
  if (!cleaned) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  const now = new Date();
  const todayStr = () => now.toISOString().split("T")[0];
  const addDays = (d: Date, n: number): string => {
    const result = new Date(d);
    result.setDate(result.getDate() + n);
    return result.toISOString().split("T")[0];
  };

  if (cleaned === "today") return todayStr();
  if (cleaned === "tomorrow") return addDays(now, 1);

  const dayMatch = cleaned.match(/(?:by\s+|next\s+)?(\w+day)$/);
  if (dayMatch) {
    const targetDay = DAY_NAMES.indexOf(dayMatch[1]);
    if (targetDay !== -1) {
      const currentDay = now.getDay();
      let daysAhead = targetDay - currentDay;
      if (daysAhead <= 0) daysAhead += 7;
      return addDays(now, daysAhead);
    }
  }

  if (cleaned === "next week") {
    const currentDay = now.getDay();
    const daysToMonday = currentDay === 0 ? 1 : 8 - currentDay;
    return addDays(now, daysToMonday);
  }
  if (cleaned === "end of week" || cleaned === "end of the week" || cleaned === "eow") {
    const currentDay = now.getDay();
    const daysToSunday = currentDay === 0 ? 0 : 7 - currentDay;
    return addDays(now, daysToSunday);
  }
  if (cleaned === "end of month" || cleaned === "end of the month" || cleaned === "eom") {
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.toISOString().split("T")[0];
  }
  if (cleaned === "next sprint") return addDays(now, 14);
  return null;
}

// ─── Types ───────────────────────────────────────────────────

interface MemoryExtraction {
  // `relationship` + `goal` are additive (cap 1 stable-typed-recall): they let
  // people-facts and long-term goals be filed as their own stable type so recall
  // can isolate "who do I know" / "what am I working toward" instead of folding
  // them into facts/decisions. Back-compatible — older transcripts simply never
  // emit them.
  type: "correction" | "decision" | "fact" | "preference" | "gap" | "commitment" | "deferral" | "relationship" | "goal";
  content: string;
  old_value?: string;
  entity?: string;
  predicate?: string;
  confidence: number;
  assignee?: string;
  deadline?: string;
  reason?: string;
}

interface HarvestResult {
  extractions: MemoryExtraction[];
}

interface DaemonInput {
  sessionId: string;
  targetWing: string;
  conversationText: string;
  messageCount: number;
  correctionQueue: string[];
  correctionContext: string;
}

// ─── KG correction predicates + heuristic invalidation ───────

const KG_CORRECTION_PREDICATES = [
  "uses", "decided", "working_on", "deploys_on", "deploys_to",
  "built_with", "path_is", "hosted_on", "prefers", "runs_on",
  "configured_as", "uses_tool", "stack_includes",
  "committed_to", "has_status", "depends_on", "deferred",
];

function tryInvalidateContradictedFact(extraction: MemoryExtraction, wing: string): boolean {
  if (extraction.entity && extraction.predicate && extraction.old_value) return false;
  const oldValue = extraction.old_value;
  if (!oldValue || oldValue.trim().length < 2) return false;

  try {
    const kgResult = bridgeSync("kg_query", { entity: wing, direction: "outgoing" }, 8000);
    if (!kgResult.ok) return false;

    const facts = ((kgResult.data.facts || kgResult.data.triples || []) as Array<{
      subject?: string; predicate?: string; object?: string; valid_from?: string;
    }>);
    if (!Array.isArray(facts) || facts.length === 0) return false;

    const oldKeywords = oldValue.toLowerCase().split(/[\s,.\-_/]+/).filter((w) => w.length > 2);
    if (oldKeywords.length === 0) return false;

    for (const fact of facts) {
      if (!fact.object || !fact.predicate || !fact.subject) continue;
      if (!KG_CORRECTION_PREDICATES.includes(fact.predicate)) continue;
      const objectLower = fact.object.toLowerCase();
      if (!oldKeywords.some((kw) => objectLower.includes(kw))) continue;

      console.error(`[MemoryHarvest.daemon] KG invalidation: "${fact.subject} ${fact.predicate} ${fact.object}" contradicted by correction`);
      const invalidateResult = bridgeSync("invalidate", {
        subject: fact.subject, predicate: fact.predicate, object: fact.object,
      });
      if (invalidateResult.ok) {
        console.error(`[MemoryHarvest.daemon] Invalidated: ${fact.predicate}=${fact.object}`);
      }

      const today = new Date().toISOString().split("T")[0];
      bridgeSync("add_kg_fact", {
        subject: fact.subject, predicate: fact.predicate, object: extraction.content, valid_from: today,
      });
      console.error(`[MemoryHarvest.daemon] Added corrected fact: ${fact.predicate}=${extraction.content}`);
      return true;
    }
  } catch (err) {
    console.error(`[MemoryHarvest.daemon] KG invalidation error (non-fatal):`, err);
  }
  return false;
}

// ─── Per-type filing helpers ─────────────────────────────────

function fileExtraction(extraction: MemoryExtraction, wing: string, sessionId: string, ops: BridgeOp[]): void {
  const timestamp = new Date().toISOString();
  switch (extraction.type) {
    case "correction":   fileCorrection(extraction, wing, sessionId, ops, timestamp); break;
    case "decision":     fileDecision(extraction, wing, sessionId, ops, timestamp); break;
    case "fact":         fileFact(extraction, wing, sessionId, ops, timestamp); break;
    case "preference":   filePreference(extraction, wing, sessionId, ops, timestamp); break;
    case "gap":          fileGap(extraction, wing, sessionId, ops, timestamp); break;
    case "commitment":   fileCommitment(extraction, wing, sessionId, ops, timestamp); break;
    case "deferral":     fileDeferral(extraction, wing, sessionId, ops, timestamp); break;
    case "relationship": fileRelationship(extraction, wing, sessionId, ops, timestamp); break;
    case "goal":         fileGoal(extraction, wing, sessionId, ops, timestamp); break;
  }
}

function fileCorrection(extraction: MemoryExtraction, wing: string, sessionId: string, ops: BridgeOp[], timestamp: string): void {
  if (extraction.entity && extraction.predicate && extraction.old_value) {
    queueOp(ops, "invalidate", {
      subject: extraction.entity, predicate: extraction.predicate, object: extraction.old_value,
    });
  }
  if (extraction.entity && extraction.predicate) {
    queueOp(ops, "add_kg_fact", {
      subject: extraction.entity, predicate: extraction.predicate, object: extraction.content,
      valid_from: timestamp.split("T")[0], confidence: extraction.confidence,
    });
  }
  if (!(extraction.entity && extraction.predicate && extraction.old_value)) {
    try { tryInvalidateContradictedFact(extraction, wing); }
    catch (err) { console.error(`[MemoryHarvest.daemon] Gap C pipeline error (non-fatal):`, err); }
  }
  queueOp(ops, "add_drawer", {
    wing, room: "corrections",
    content: `[${timestamp}] CORRECTION: ${extraction.old_value ? `"${extraction.old_value}" → ` : ""}${extraction.content}`,
    source_file: `session-${sessionId}`,
    added_by: "mechanical:memory-harvest", confidence: extraction.confidence,
  });
}

function fileDecision(extraction: MemoryExtraction, wing: string, sessionId: string, ops: BridgeOp[], timestamp: string): void {
  queueOp(ops, "add_drawer", {
    wing, room: "decisions",
    content: `[${timestamp}] DECISION: ${extraction.content}`,
    source_file: `session-${sessionId}`,
    added_by: "mechanical:memory-harvest", confidence: extraction.confidence,
  });
}

function fileFact(extraction: MemoryExtraction, wing: string, sessionId: string, ops: BridgeOp[], timestamp: string): void {
  if (extraction.entity && extraction.predicate) {
    queueOp(ops, "add_kg_fact", {
      subject: extraction.entity, predicate: extraction.predicate, object: extraction.content,
      valid_from: timestamp.split("T")[0], confidence: extraction.confidence,
    });
  }
  queueOp(ops, "add_drawer", {
    wing, room: "facts",
    content: `[${timestamp}] FACT: ${extraction.content}`,
    source_file: `session-${sessionId}`,
    added_by: "mechanical:memory-harvest", confidence: extraction.confidence,
  });
}

function filePreference(extraction: MemoryExtraction, wing: string, sessionId: string, ops: BridgeOp[], timestamp: string): void {
  queueOp(ops, "add_drawer", {
    wing, room: "preferences",
    content: `[${timestamp}] PREFERENCE: ${extraction.content}`,
    source_file: `session-${sessionId}`,
    added_by: "mechanical:memory-harvest", confidence: extraction.confidence,
  });
}

function fileGap(extraction: MemoryExtraction, wing: string, sessionId: string, ops: BridgeOp[], timestamp: string): void {
  queueOp(ops, "add_drawer", {
    wing, room: "gaps",
    content: `[${timestamp}] MEMORY GAP: ${extraction.content}`,
    source_file: `session-${sessionId}`,
    added_by: "mechanical:memory-harvest", confidence: extraction.confidence,
  });
}

function fileCommitment(extraction: MemoryExtraction, wing: string, sessionId: string, ops: BridgeOp[], timestamp: string): void {
  const today = timestamp.split("T")[0];
  const assignee = extraction.assignee || "lucas";
  const deadlineIso = normalizeDeadline(extraction.deadline);
  const deadlineNote = deadlineIso
    ? ` (deadline: ${extraction.deadline}) [deadline: ${deadlineIso}]`
    : extraction.deadline ? ` (deadline: ${extraction.deadline})` : "";
  const commitObject = deadlineIso
    ? `${extraction.content} [deadline: ${deadlineIso}]`
    : extraction.content;

  queueOp(ops, "add_kg_fact", {
    subject: assignee, predicate: "committed_to", object: commitObject,
    valid_from: today, confidence: extraction.confidence,
  });
  if (extraction.entity) {
    queueOp(ops, "add_kg_fact", {
      subject: extraction.entity, predicate: "has_status", object: "pending", valid_from: today,
    });
  }
  if (extraction.entity && extraction.predicate === "depends_on") {
    queueOp(ops, "add_kg_fact", {
      subject: extraction.entity, predicate: "depends_on", object: extraction.content, valid_from: today,
    });
  }
  queueOp(ops, "add_drawer", {
    wing, room: "commitments",
    content: `[${today}] COMMITMENT (${assignee}): ${extraction.content}${deadlineNote}`,
    source_file: `session-${sessionId}`,
    added_by: "mechanical:memory-harvest", confidence: extraction.confidence,
  });
  console.error(`[MemoryHarvest.daemon] Commitment tracked: "${extraction.content}" by ${assignee}${deadlineNote}`);
}

function fileDeferral(extraction: MemoryExtraction, wing: string, sessionId: string, ops: BridgeOp[], timestamp: string): void {
  const today = timestamp.split("T")[0];
  const reasonNote = extraction.reason ? ` Reason: ${extraction.reason}` : "";

  queueOp(ops, "add_kg_fact", {
    subject: extraction.entity || wing, predicate: "deferred", object: extraction.content,
    valid_from: today, confidence: extraction.confidence,
  });
  if (extraction.entity) {
    queueOp(ops, "invalidate", {
      subject: extraction.entity, predicate: "has_status", object: "pending",
    });
    queueOp(ops, "add_kg_fact", {
      subject: extraction.entity, predicate: "has_status", object: "deferred", valid_from: today,
    });
  }
  queueOp(ops, "add_drawer", {
    wing, room: "deferrals",
    content: `[${today}] DEFERRED: ${extraction.content}${reasonNote}`,
    source_file: `session-${sessionId}`,
    added_by: "mechanical:memory-harvest", confidence: extraction.confidence,
  });
  console.error(`[MemoryHarvest.daemon] Deferral tracked: "${extraction.content}"${reasonNote}`);
}

// cap 1 (stable-typed-recall): file people-facts as their own stable `type`.
// Unlike the room-bucketed helpers above, these stamp the dedicated `type`
// metadata field (bridge add_drawer accepts arbitrary `type` since 2026-05-12)
// so a "who do I know / people" recall can filter `type:"relationship"` and get
// only relationship-typed drawers instead of an undifferentiated blob.
// NOTE: no KG fact is seeded here — a person/goal KG predicate (e.g. `knows`)
// is NOT yet canonical in PREDICATES.md, and predicate additions are
// operator-gated (RFC-0073). The drawer-side typed recall stands alone; the KG
// linkage is proposed, not auto-ratified (see proposals/ alongside this patch).
function fileRelationship(extraction: MemoryExtraction, wing: string, sessionId: string, ops: BridgeOp[], timestamp: string): void {
  queueOp(ops, "add_drawer", {
    wing, room: "relationships", type: "relationship",
    content: `[${timestamp}] RELATIONSHIP: ${extraction.content}`,
    source_file: `session-${sessionId}`,
    added_by: "mechanical:memory-harvest", confidence: extraction.confidence,
  });
}

// cap 1 (stable-typed-recall): file long-term goals as their own stable `type`
// so a "what am I working toward / goals" recall can filter `type:"goal"`.
function fileGoal(extraction: MemoryExtraction, wing: string, sessionId: string, ops: BridgeOp[], timestamp: string): void {
  queueOp(ops, "add_drawer", {
    wing, room: "goals", type: "goal",
    content: `[${timestamp}] GOAL: ${extraction.content}`,
    source_file: `session-${sessionId}`,
    added_by: "mechanical:memory-harvest", confidence: extraction.confidence,
  });
}

function flushOps(ops: BridgeOp[]): { mode: "batch" | "fallback"; count: number; errors: number } {
  if (ops.length === 0) return { mode: "batch", count: 0, errors: 0 };
  const items = ops.map(op => ({ op }));
  const { ok, failed, phase } = batchOps(items, {
    logFn: (entry) => {
      if (entry.phase !== 'batch-ok') {
        console.error(`[MemoryHarvest.daemon] ${entry.phase}: falling back to per-call`);
      }
    },
  });
  return {
    mode: phase === 'batch-ok' ? 'batch' : 'fallback',
    count: ok + failed,
    errors: failed,
  };
}

// clearCorrectionQueue REMOVED (Forge H-125, Gen 108 — Prospector Gen-41 handoff).
// The unlink raced SaveCorrectionsToStudio's concurrent SessionEnd scan (all
// SessionEnd hooks are async:true): a file whose first-ever scan hadn't reached
// it yet was deleted ~60s into the window → the correction never reached Studio
// or the DLQ. The wrapper reads the queue BEFORE spawning this daemon, so the
// unlink was pure GC, not needed for palace filing — and it mostly never fired
// anyway (harvest times out 62% of sessions; 1,651 files had accumulated).
// File retention now belongs to the H-008 STATE retention policy, never to a
// consumer that has a concurrent sibling reader.

// ─── Inference prompt ────────────────────────────────────────

const EXTRACTION_PROMPT = `You analyze Claude Code session transcripts to extract memory-worthy patterns.

Extract ONLY things that should be REMEMBERED for future sessions. Skip routine work output.

Return a JSON object with this exact schema:
{
  "extractions": [
    {
      "type": "correction" | "decision" | "fact" | "preference" | "gap" | "commitment" | "deferral" | "relationship" | "goal",
      "content": "the thing to remember (concise, factual)",
      "old_value": "what was wrong (corrections only, optional)",
      "entity": "KG entity name if applicable (e.g., 'dos', 'altyaa', 'lucas')",
      "predicate": "KG relationship if applicable (e.g., 'path_is', 'uses_tool', 'depends_on')",
      "confidence": 0.0-1.0,
      "assignee": "who committed (commitments only, default to user's name)",
      "deadline": "natural language deadline (commitments only, e.g., 'by Friday', 'next sprint', 'end of Q2')",
      "reason": "why it was deferred (deferrals only)"
    }
  ]
}

Types:
- correction: User corrected the AI about a fact (e.g., "no, the path is X not Y")
- decision: An architectural or design choice was made during the session
- fact: A new fact about the project/user/system was revealed
- preference: User expressed how they want things done (workflow, style, approach)
- gap: The AI was missing context it should have had (asked a question it shouldn't need to)
- commitment: Someone explicitly committed to doing something future ("I'll do X tomorrow", "let's tackle that next session", "we need to handle X before launch", "can you look into Y")
- deferral: Something was consciously postponed or rejected ("let's skip that for now", "not this sprint", "we decided not to do X", "parking lot this", "that's a Phase 3 item")
- relationship: A durable fact about a PERSON and their role/tie to the user (e.g., "Maria is my co-founder", "Dr. Lopez is my dentist", "Avenue Code is a past employer"). Put the person's name in entity. Use for people/roles/collaborators, NOT one-off mentions.
- goal: A long-term objective or direction the user is working toward (e.g., "wants DuranteOS to be the next-gen software platform", "growing Altyaa to profitability"). Put the project/entity in entity. Use for enduring goals, NOT a single task.

Rules:
- Only extract items with confidence >= 0.7 (exception: informal delegations may use 0.4-0.6)
- Keep content under 100 words per extraction
- Maximum 10 extractions per session (only the most important)
- For corrections: always include old_value if known
- For facts: include entity and predicate for knowledge graph
- For commitments: always include assignee and deadline if mentioned. Look for: "I'll", "we need to", "let's do", "tomorrow", "next week", "can you look into", informal delegation
- For informal delegation ("can you look into X", "we should check", "someone needs to"), capture as commitment with lower confidence (0.4-0.6) and assignee if mentioned. Use assignee="team" for "we should" and assignee="unassigned" for "someone needs to"
- For deadline fields, use parseable expressions when possible: "today", "tomorrow", "by {day_name}", "next week", "end of month", "next sprint", or YYYY-MM-DD format
- For deferrals: always include reason if stated. Look for: "not now", "later", "skip", "park", "Phase N", "next sprint", explicit rejection of a proposed approach
- Skip: routine code changes, tool output, file listings, debug logs
- Skip: things already captured by other systems (ratings, PRD content)

If nothing is memory-worthy, return {"extractions": []}`;

// ─── Daemon main ─────────────────────────────────────────────

function readDaemonInput(): DaemonInput | null {
  const inputFile = process.env.DOS_HARVEST_INPUT_FILE;
  if (!inputFile || !existsSync(inputFile)) return null;
  try {
    const raw = readFileSync(inputFile, "utf-8");
    return JSON.parse(raw) as DaemonInput;
  } catch (err) {
    console.error(`[MemoryHarvest.daemon] Failed to read input file ${inputFile}:`, err);
    return null;
  }
}

async function main(): Promise<void> {
  const input = readDaemonInput();
  if (!input) {
    console.error("[MemoryHarvest.daemon] No DOS_HARVEST_INPUT_FILE — exiting");
    return;
  }

  const { sessionId, targetWing, conversationText, messageCount, correctionQueue, correctionContext } = input;
  console.error(`[MemoryHarvest.daemon] Analyzing session ${sessionId.slice(0, 8)} (${messageCount} msgs, wing: ${targetWing})`);

  try {
    const { inference } = await import(INFERENCE_PATH);
    const result = await inference({
      systemPrompt: EXTRACTION_PROMPT,
      userPrompt: `PROJECT: ${targetWing}\nSESSION: ${sessionId}\n\nTRANSCRIPT (last ${messageCount} messages):\n\n${conversationText}${correctionContext}`,
      level: "fast",
      expectJson: true,
      timeout: 60000,
    });

    if (!result.success) {
      console.error("[MemoryHarvest.daemon] Inference failed:", result.error);
      return;
    }

    const harvest = result.parsed as HarvestResult | null;
    if (!harvest?.extractions || harvest.extractions.length === 0) {
      console.error("[MemoryHarvest.daemon] No memory-worthy patterns found");
      return;
    }

    const validExtractions = harvest.extractions.filter(
      (e) => e.confidence >= 0.7 || (e.type === "commitment" && e.confidence >= 0.4)
    );
    console.error(`[MemoryHarvest.daemon] Found ${validExtractions.length} extraction(s) (${harvest.extractions.length} total)`);

    const ops: BridgeOp[] = [];
    for (const extraction of validExtractions) {
      fileExtraction(extraction, targetWing, sessionId, ops);
      console.error(`[MemoryHarvest.daemon] Filed ${extraction.type}: ${extraction.content.slice(0, 60)}...`);
    }

    const harvestStart = Date.now();
    const flushResult = flushOps(ops);
    const harvestDurationMs = Date.now() - harvestStart;
    console.error(`[MemoryHarvest.daemon] Flushed ${flushResult.count} op(s) via ${flushResult.mode} in ${harvestDurationMs}ms${flushResult.errors > 0 ? ` (${flushResult.errors} errors)` : ""}`);

    try {
      const sysDir = join(getMemorySubdir('LEARNING'), 'SYS');
      mkdirSync(sysDir, { recursive: true });
      appendFileSync(join(sysDir, 'harvest-bench.jsonl'), JSON.stringify({
        ts: new Date().toISOString(),
        ops_count: flushResult.count,
        duration_ms: harvestDurationMs,
        ok_count: flushResult.count - flushResult.errors,
        fail_count: flushResult.errors,
        mode: flushResult.mode,
      }) + '\n');
    } catch { /* telemetry advisory */ }

    try {
      mkdirSync(STATE_DIR, { recursive: true });
      writeFileSync(HARVEST_LOG, JSON.stringify({
        timestamp: new Date().toISOString(),
        session_id: sessionId,
        wing: targetWing,
        extractions_found: harvest.extractions.length,
        extractions_filed: validExtractions.length,
        types: validExtractions.map((e) => e.type),
        inference_latency_ms: result.latencyMs,
      }), "utf-8");
    } catch { /* non-critical */ }

    if (correctionQueue.length > 0) {
      // Queue file deliberately NOT unlinked here — see H-125 note above.
      console.error(`[MemoryHarvest.daemon] Processed ${correctionQueue.length} queued correction(s)`);
    }

    if (validExtractions.length > 0) {
      const typeCounts: Record<string, number> = {};
      for (const e of validExtractions) typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
      const breakdown = Object.entries(typeCounts).map(([type, n]) => `${n} ${type}${n === 1 ? "" : "s"}`).join(", ");
      const topTitles = validExtractions.slice(0, 3).map(e => {
        const t = e.content.replace(/\s+/g, " ").trim();
        return `"${t.length > 60 ? t.slice(0, 60) + "…" : t}"`;
      }).join(", ");
      const noun = validExtractions.length === 1 ? "item" : "items";
      emitMemoryDigest(`harvest filed ${validExtractions.length} ${noun} (${breakdown}); top: ${topTitles}`);
    }
  } catch (err) {
    console.error("[MemoryHarvest.daemon] Error:", err);
  } finally {
    // Clean up the input file the wrapper wrote.
    const inputFile = process.env.DOS_HARVEST_INPUT_FILE;
    if (inputFile) {
      try { unlinkSync(inputFile); } catch { /* best-effort */ }
    }
  }
}

const _t = startTimer('MemoryHarvest.daemon');
process.on('exit', () => stopTimer(_t, 'SessionEnd'));
main().catch((err) => {
  console.error("[MemoryHarvest.daemon] Fatal:", err);
  process.exit(0);
});
