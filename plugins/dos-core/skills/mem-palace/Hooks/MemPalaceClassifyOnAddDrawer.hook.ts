#!/usr/bin/env bun
/**
 * MemPalaceClassifyOnAddDrawer.hook.ts — Proactive classify enrichment on drawer writes
 *
 * PURPOSE:
 * Invoked after add_drawer succeeds (PostToolUse: mcp__mempalace__mempalace_add_drawer).
 * Classifies drawer content using the bridge `classify` action when content exceeds
 * 200 chars. If a primary memory type is identified (decision/preference/milestone/
 * problem/emotional) and the drawer room is not already a classify-type room, updates
 * the drawer room to the classified type — mirroring MemPalaceLearn's classify-then-route
 * pattern, applied post-add.
 *
 * WHY:
 * 2026-05-12 audit: classify fires only 4 times/4d despite 26 DOS call sites; 1 drawer
 * in corpus has `type` metadata (a smoke test). This hook shifts classify from reactive
 * to proactive for all add_drawer paths (MCP PostToolUse and standalone invocation),
 * enabling targeted recall ("show me all decisions about X") — ISC-30 from PRD
 * 20260512_mempalace-findings-delivery.
 *
 * TRIGGER: PostToolUse (matcher: mcp__mempalace__mempalace_add_drawer)
 * ALSO: standalone invocation — pipe {drawer_id, content, room} to stdin
 *
 * INPUT (stdin — two accepted shapes):
 *   PostToolUse envelope:
 *     { session_id, tool_name, tool_input: {wing, room, content, ...},
 *       tool_response: {drawer_id, status, ...} }   (tool_result accepted as legacy alias)
 *   Standalone invocation:
 *     { drawer_id, content, room? }
 *
 * OUTPUT:
 *   stdout: None
 *   stderr: [MemPalaceClassifyOnAddDrawer] status lines
 *   exit(0): Always (non-blocking — never fails the original add_drawer caller)
 *
 * SIDE EFFECTS:
 *   - bridgeSync("classify", {text: content.slice(0,2000)}) — read-only classification
 *   - bridgeFire("update_drawer", {drawer_id, content, room: <type>}) — updates room metadata
 *     to the classified type (e.g., "decision", "milestone") when applicable
 *
 * CONTENT LENGTH GATE:
 *   content.length <= 200 → silent no-op (prevents write amplification on tiny drawers)
 *
 * ROOM GATE:
 *   Drawer already in a classify-type room (decision/preference/milestone/problem/emotional)
 *   → skip update. Preserves intentional type routing by callers such as MemPalaceLearn.
 *
 * "TYPE METADATA" (ISC-31):
 *   After this hook fires, the drawer's `room` field in ChromaDB metadata is set to the
 *   classified type. Bridge search/get_drawer returns this as `room: "decision"` etc.
 *   That is the "type metadata" that ISC-31 verifies.
 *
 * INTER-HOOK RELATIONSHIPS:
 *   - Sibling of MemPalaceLearn (do NOT modify MemPalaceLearn — write a sibling hook only)
 *   - Independent of all other hooks
 *   - PostToolUse fires AFTER add_drawer result is committed — no race condition
 *
 * PERFORMANCE:
 *   - classify is pure regex (mempalace.general_extractor) — <200ms typical
 *   - update_drawer fires async (bridgeFire) — non-blocking
 *
 * FOUR COPIES (symlink mode — copies 1≡2):
 *   1≡2: ~/.claude/hooks/MemPalaceClassifyOnAddDrawer.hook.ts
 *   3:   Packs/mem-palace/src/Hooks/MemPalaceClassifyOnAddDrawer.hook.ts
 *
 * REFS:
 *   ISC-30, ISC-31 (PRD MEMORY/WORK/active/20260512_mempalace-findings-delivery/PRD.md)
 *   MEMORY/CANONICAL/MemPalace-capability-state.md §2.6
 *   MemPalaceLearn.hook.ts — observe classifyContent + finalRoom pattern
 *   2026-05-12 A6 stream delivery
 */

import { BRIDGE_PATH, bridgeSync, bridgeFire } from "./lib/mempalace";
import { existsSync } from "fs";
import { startTimer, stopTimer } from "./lib/hook-io";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Stable semantic types accepted as a drawer `type` label for typed recall.
 *
 * The first five are returned today by the bridge classify action
 * (mempalace.general_extractor). `relationship` + `goal` are additive
 * (cap 1 stable-typed-recall): they let "people"/"goals" memories carry an
 * explicit type so recall can isolate by category instead of overgeneralizing
 * across a flat blob. They are forward-compatible — the hook only writes a type
 * the classifier actually surfaces, so adding them here is harmless until the
 * classifier (or another typed writer such as MemoryHarvest) emits them.
 */
const CLASSIFY_TYPES = new Set([
  "decision",
  "preference",
  "milestone",
  "problem",
  "emotional",
  "relationship",
  "goal",
]);

/** Content length gate — no-op for tiny drawers. */
const CONTENT_MIN_LEN = 200;

// ─── Types ────────────────────────────────────────────────────────────────────

interface PostToolUseEnvelope {
  session_id?: string;
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: {
    content?: string;
    wing?: string;
    room?: string;
    [key: string]: unknown;
  };
  tool_response?: {
    drawer_id?: string;
    status?: string;
    [key: string]: unknown;
  };
  /** Legacy alias — some internal callers historically sent `tool_result`. */
  tool_result?: {
    drawer_id?: string;
    status?: string;
    [key: string]: unknown;
  };
}

interface StandaloneInput {
  drawer_id?: string;
  content?: string;
  room?: string;
  wing?: string;
}

type HookInput = PostToolUseEnvelope & StandaloneInput;

// ─── stdin reader ─────────────────────────────────────────────────────────────

async function readStdin(): Promise<HookInput | null> {
  try {
    const decoder = new TextDecoder();
    const reader = Bun.stdin.stream().getReader();
    let input = "";
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1500));
    const read = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        input += decoder.decode(value, { stream: true });
      }
    })();
    await Promise.race([read, timeout]);
    return input.trim() ? (JSON.parse(input.trim()) as HookInput) : null;
  } catch {
    return null;
  }
}

// ─── Core logic ──────────────────────────────────────────────────────────────

function classifyAndUpdate(
  drawerId: string,
  content: string,
  originalRoom: string,
): void {
  // Classify — synchronous so we can act on the returned type
  const classifyResult = bridgeSync(
    "classify",
    { text: content.slice(0, 2000) },
    5000,
  );

  if (!classifyResult.ok) {
    console.error(
      `[MemPalaceClassifyOnAddDrawer] classify failed (drawer ${drawerId}): ${classifyResult.reason ?? "unknown error"}`,
    );
    return;
  }

  const data = classifyResult.data as {
    types_found?: unknown[];
    count?: number;
  };
  const rawTypes = Array.isArray(data?.types_found) ? data.types_found : [];
  const types = rawTypes.filter((t): t is string => typeof t === "string");
  const primaryType = types.find((t) => CLASSIFY_TYPES.has(t));

  if (!primaryType) {
    console.error(
      `[MemPalaceClassifyOnAddDrawer] No classify type found for drawer ${drawerId}` +
        ` (types_found: [${types.join(", ") || "none"}])`,
    );
    return;
  }

  // Write the classified label into the dedicated `type` metadata field
  // (added to bridge schema 2026-05-12 per ISC-30 follow-up). Preserves
  // the original `room` so room-as-bucket and type-as-semantic-label remain
  // orthogonal. Replaces the prior room-overwrite workaround.
  // No `content` field: this is a metadata-only type-stamp. The bridge now
  // preserves the stored document when content is omitted (Forge H-095,
  // Gen 116) — the previous `content.slice(0, 4000)` REPLACED the document
  // body, truncating any drawer longer than 4000 chars on classification.
  bridgeFire("update_drawer", {
    drawer_id: drawerId,
    type: primaryType,
    added_by: "mechanical:classify-on-add-hook",
  });

  console.error(
    `[MemPalaceClassifyOnAddDrawer] Classified drawer ${drawerId}:` +
      ` type='${primaryType}' (room='${originalRoom}' preserved)`,
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const input = await readStdin();

  if (!input) {
    console.error("[MemPalaceClassifyOnAddDrawer] No stdin input — exiting");
    process.exit(0);
  }

  if (!existsSync(BRIDGE_PATH)) {
    console.error("[MemPalaceClassifyOnAddDrawer] Bridge not installed — skipping");
    process.exit(0);
  }

  let drawerId: string | undefined;
  let content: string | undefined;
  let originalRoom = "uncategorized";

  const toolResponse = input.tool_response ?? input.tool_result;
  if (input.tool_input !== undefined && toolResponse !== undefined) {
    // PostToolUse envelope — claude called mcp__mempalace__mempalace_add_drawer.
    // Claude Code delivers the tool output under `tool_response`; `tool_result`
    // is accepted as a legacy alias for any internal caller still sending it.
    const { tool_input } = input;

    if (toolResponse?.status !== "ok") {
      console.error(
        `[MemPalaceClassifyOnAddDrawer] tool_response.status='${toolResponse?.status}' — skipping`,
      );
      process.exit(0);
    }

    drawerId = toolResponse.drawer_id;
    content = tool_input?.content;
    originalRoom = tool_input?.room ?? "uncategorized";
  } else {
    // Standalone invocation — {drawer_id, content, room?}
    drawerId = input.drawer_id;
    content = input.content;
    originalRoom = input.room ?? "uncategorized";
  }

  if (!drawerId || !content) {
    console.error(
      "[MemPalaceClassifyOnAddDrawer] Missing drawer_id or content — skipping",
    );
    process.exit(0);
  }

  // Content length gate
  if (content.length <= CONTENT_MIN_LEN) {
    console.error(
      `[MemPalaceClassifyOnAddDrawer] Content too short (${content.length} ≤ ${CONTENT_MIN_LEN}) — skipping`,
    );
    process.exit(0);
  }

  console.error(
    `[MemPalaceClassifyOnAddDrawer] Processing drawer ${drawerId}` +
      ` (${content.length} chars, room='${originalRoom}')`,
  );

  classifyAndUpdate(drawerId, content, originalRoom);
  process.exit(0);
}

// ─── Entry ────────────────────────────────────────────────────────────────────

const _t = startTimer("MemPalaceClassifyOnAddDrawer");
process.on("exit", () => stopTimer(_t, "PostToolUse"));
main().catch((err) => {
  console.error("[MemPalaceClassifyOnAddDrawer] Fatal:", err);
  process.exit(0);
});
