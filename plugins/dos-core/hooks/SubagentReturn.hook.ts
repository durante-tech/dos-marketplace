#!/usr/bin/env bun
/**
 * SubagentReturn.hook.ts — C1 Conformance Scanner (v0.0.4)
 *
 * Fires on PostToolUse:Task. Inspects the subagent's returned text for the
 * Subagent Algorithm Profile OBSERVE-lite triptych markers:
 *   🔎 FILES TO READ
 *   🧠 MEMORY TO RECALL
 *   🏹 CAPABILITIES
 *
 * Logs conformance result to MEMORY/LEARNING/REFLECTIONS/c1-conformance.jsonl.
 * Non-blocking — exits 0 always.
 *
 * Spec: RFC-0001 subagent runtime profile in DOS/PARTIALS/_algorithm-lite.md → Conformance C1.
 */

import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getMemorySubdir } from "./lib/paths";

const REFLECTIONS_DIR = join(getMemorySubdir("LEARNING"), "REFLECTIONS");
const C1_LOG = join(REFLECTIONS_DIR, "c1-conformance.jsonl");

const MARKERS = {
  files: /🔎\s*FILES TO READ\s*:/,
  memory: /🧠\s*MEMORY TO RECALL\s*:/,
  capabilities: /🏹\s*CAPABILITIES\s*:/,
};

// 4th pattern (ADVISORY — Tailor gen-069 handoff spec, Forge Gen 110): the
// structured-verdict council seats contract a parseable verdict-block heading
// in their return (headings verbatim from the agent defs). A missing heading
// means the seat drifted back to freeform prose — warn-tier fields on the same
// C1 log surface, never a block. Channeled-author seats (Fowler, KentBeck, …)
// are prose-by-contract and are NOT scanned. Field-level parsing is parked
// with the round-mechanization decision (gen-067 item 4).
const VERDICT_SEATS: Record<string, RegExp> = {
  HarnessSkeptic: /^##\s*Skeptic Verdict\b/m,
  FitnessAnalyst: /^##\s*Analyst Readings\b/m,
  HooksNative: /^##\s*Hooks-Native Reading\b/m,
};

function extractText(response: unknown): string {
  if (typeof response === "string") return response;
  if (response && typeof response === "object") {
    const asRecord = response as Record<string, unknown>;
    if (typeof asRecord.content === "string") return asRecord.content;
    if (Array.isArray(asRecord.content)) {
      return asRecord.content
        .map((block: unknown) =>
          typeof block === "string"
            ? block
            : block && typeof block === "object" && typeof (block as Record<string, unknown>).text === "string"
              ? ((block as Record<string, unknown>).text as string)
              : "",
        )
        .join("\n");
    }
    try {
      return JSON.stringify(response);
    } catch {
      return "";
    }
  }
  return "";
}

async function main(): Promise<void> {
  try {
    // Bound the stdin read: `await Bun.stdin.text()` alone waits for EOF forever,
    // so a lingering-open pipe would hang this PostToolUse:Task hook. A bare
    // Promise.race is NOT enough — the abandoned text() read keeps the process
    // alive until EOF anyway (verified). So the timeout force-exits the process.
    // 5s is far above any real envelope-arrival time (pipe-fast even for a large
    // subagent return); this hook is non-blocking, so a hung-stdin skip is safe.
    // (Forge Gen 21 / H-021 class.)
    const hardTimer = setTimeout(() => process.exit(0), 5000);
    const stdinText = await Bun.stdin.text();
    clearTimeout(hardTimer);
    if (!stdinText) {
      return;
    }
    const input = JSON.parse(stdinText) as Record<string, unknown>;
    const toolName = (input.tool_name as string | undefined) ?? "";

    // Only scan Task/Agent tool calls (the subagent spawn surface)
    if (toolName !== "Task" && toolName !== "Agent") {
      process.exit(0);
    }

    const text = extractText(input.tool_response);

    const markersSeen = {
      files: MARKERS.files.test(text),
      memory: MARKERS.memory.test(text),
      capabilities: MARKERS.capabilities.test(text),
    };
    const allPresent = markersSeen.files && markersSeen.memory && markersSeen.capabilities;

    const toolInput = input.tool_input as Record<string, unknown> | undefined;
    const subagentType = (toolInput?.subagent_type as string | undefined) ?? null;

    // 4th pattern: verdict-heading presence for structured-verdict seats only.
    // null = not a structured seat (no contract to check); true/false = scanned.
    const verdictPattern = subagentType ? VERDICT_SEATS[subagentType] : undefined;
    const verdictHeadingPresent = verdictPattern ? verdictPattern.test(text) : null;

    // tool_response.usage is not populated for Task — read tool_use_count from the transcript at SessionEnd.

    const entry = {
      timestamp: new Date().toISOString(),
      tool_use_id: (input.tool_use_id as string | undefined) ?? null,
      subagent_type: subagentType,
      description: (toolInput?.description as string | undefined) ?? null,
      all_markers_present: allPresent,
      markers_seen: markersSeen,
      verdict_seat: verdictPattern ? subagentType : null,
      verdict_heading_present: verdictHeadingPresent,
      snippet: text.slice(0, 400).replace(/\n/g, " ").trim(),
      text_length: text.length,
    };

    if (verdictPattern && verdictHeadingPresent === false) {
      // Warn-tier, same surface as C1 misses; advisory only — never blocks.
      console.error(
        `[SubagentReturn] verdict-heading MISSING: ${subagentType} returned without its contracted verdict block (Tailor gen-069 4th pattern)`,
      );
    }

    if (!existsSync(REFLECTIONS_DIR)) {
      mkdirSync(REFLECTIONS_DIR, { recursive: true });
    }
    appendFileSync(C1_LOG, `${JSON.stringify(entry)}\n`);
  } catch {
    // Swallow all errors — hook is fire-and-forget, must never break the Task path.
  }
  process.exit(0);
}

await main();
