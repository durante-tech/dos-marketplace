#!/usr/bin/env bun
/**
 * MemPalaceRate.hook.ts - Record Ratings as KG Facts (UserPromptSubmit)
 *
 * PURPOSE:
 * When DOS's RatingCapture detects a user rating (explicit or implicit),
 * this hook records it as a temporal fact in MemPalace's knowledge graph.
 * This enables queries like "timeline of satisfaction" or "what work was
 * rated poorly?" via KG traversal.
 *
 * Also files the rated response context as a palace drawer for semantic
 * retrieval of what was happening when ratings were given.
 *
 * TRIGGER: UserPromptSubmit
 *
 * INPUT:
 * - stdin: Hook input JSON (session_id, prompt)
 * - Files: MEMORY/LEARNING/SIGNALS/ratings.jsonl (last entry)
 *
 * OUTPUT:
 * - stdout: None
 * - stderr: Status messages
 * - exit(0): Always (non-blocking)
 *
 * SIDE EFFECTS:
 * - Calls bridge.py add_kg_fact for each new rating
 * - Calls bridge.py add_drawer for rated context
 *
 * INTER-HOOK RELATIONSHIPS:
 * - MUST RUN AFTER: RatingCapture (needs ratings.jsonl to be updated)
 * - INDEPENDENT OF: other UserPromptSubmit hooks
 *
 * PERFORMANCE:
 * - Non-blocking: Yes (fire-and-forget subprocess)
 * - Typical execution: <100ms
 */

import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { resolveProjectWingFromEnv } from "./lib/project-resolver";
import { BRIDGE_PATH, bridgeFire } from "./lib/mempalace";
import { getMemorySubdir } from "./lib/paths";
import { startTimer, stopTimer } from './lib/hook-io';
import { emitMemoryDigest } from './lib/memory-digest';

const RATINGS_FILE = join(getMemorySubdir("LEARNING"), "SIGNALS", "ratings.jsonl");
// Watermark MUST be project-scoped to match the project-scoped RATINGS_FILE.
// A global watermark (DOS_DIR) desyncs across projects: a rating in Project B
// with a timestamp below Project A's global watermark is silently dropped
// forever (watermark only moves forward). getMemorySubdir('STATE') resolves
// project-first, aligning the two (H-066).
const LAST_RATING_FILE = join(getMemorySubdir("STATE"), "mempalace-last-rating.txt");
// First-run backfill cap: with no watermark (fresh install / after the H-066
// project-scoping / state wipe) the whole history would be processed at once,
// flooding bridgeFire spawns. Cap to the most recent N (H-067).
const FIRST_RUN_BACKFILL_CAP = 20;

interface HookInput {
  session_id: string;
  prompt: string;
  hook_event_name: string;
}

interface RatingEntry {
  timestamp: string;
  rating: number;
  session_id: string;
  source: "explicit" | "implicit";
  sentiment_summary?: string;
  confidence?: number;
  comment?: string;
  response_preview?: string;
}

async function readHookInput(): Promise<HookInput | null> {
  try {
    const decoder = new TextDecoder();
    const reader = Bun.stdin.stream().getReader();
    let input = "";

    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 500));
    const read = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        input += decoder.decode(value, { stream: true });
      }
    })();

    await Promise.race([read, timeout]);
    return input.trim() ? (JSON.parse(input) as HookInput) : null;
  } catch {
    return null;
  }
}

function getLastProcessedTimestamp(): string | null {
  try {
    if (existsSync(LAST_RATING_FILE)) {
      return readFileSync(LAST_RATING_FILE, "utf-8").trim();
    }
  } catch {
    // First run
  }
  return null;
}

function updateLastProcessedTimestamp(ts: string): void {
  try {
    writeFileSync(LAST_RATING_FILE, ts, "utf-8");
  } catch {
    // Non-critical
  }
}

function getNewRatings(): RatingEntry[] {
  if (!existsSync(RATINGS_FILE)) return [];

  const lastTs = getLastProcessedTimestamp();

  try {
    const content = readFileSync(RATINGS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    // Read from the end — only process new entries
    const newEntries: RatingEntry[] = [];
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]) as RatingEntry;
        if (lastTs && entry.timestamp <= lastTs) break;
        if (entry.rating != null) {
          newEntries.unshift(entry);
        }
        // First run (no watermark): cap the backfill to the most recent N so a
        // large accumulated history doesn't flood bridgeFire spawns in one turn
        // (H-067). The newest N are filed; the watermark then advances so the
        // next run is incremental. Older ratings are skipped by design.
        if (!lastTs && newEntries.length >= FIRST_RUN_BACKFILL_CAP) {
          console.error(
            `[MemPalaceRate] first-run backfill capped at ${FIRST_RUN_BACKFILL_CAP} — older ratings skipped to avoid spawn flood`,
          );
          break;
        }
      } catch {
        // Skip malformed lines
      }
    }

    return newEntries;
  } catch {
    return [];
  }
}

function spawnBridge(action: string, args: Record<string, unknown>): void {
  if (!existsSync(BRIDGE_PATH)) return;

  try {
    bridgeFire(action, args);
  } catch {
    // Fire-and-forget
  }
}

async function main() {
  const input = await readHookInput();
  if (!input) {
    process.exit(0);
  }

  if (!existsSync(BRIDGE_PATH)) {
    process.exit(0);
  }

  // Small delay to let RatingCapture write first
  await new Promise((resolve) => setTimeout(resolve, 200));

  const newRatings = getNewRatings();
  if (newRatings.length === 0) {
    process.exit(0);
  }

  console.error(
    `[MemPalaceRate] Processing ${newRatings.length} new rating(s)`
  );

  const { wing: projectWing } = resolveProjectWingFromEnv();
  const ratingsWing = projectWing || "ratings";

  for (const rating of newRatings) {
    const dateStr = rating.timestamp.split("T")[0];
    const month = dateStr.substring(0, 7); // YYYY-MM

    // 1. Add KG fact: session -> rated -> score
    spawnBridge("add_kg_fact", {
      subject: `session-${rating.session_id?.substring(0, 8) || "unknown"}`,
      predicate: "rated",
      object: `${rating.rating}/10${rating.sentiment_summary ? ` — ${rating.sentiment_summary}` : ""}`,
      valid_from: dateStr,
    });

    // 2. Failure bookmark: low ratings get high-confidence correction triples
    if (rating.rating <= 5 && ratingsWing !== "ratings") {
      const confidence = rating.rating <= 3 ? 1.0 : 0.7;
      const correctionText = rating.sentiment_summary
        || rating.comment
        || `Low-rated session (${rating.rating}/10)`;
      spawnBridge("add_kg_fact", {
        subject: ratingsWing,
        predicate: "correction",
        object: correctionText.substring(0, 200),
        valid_from: dateStr,
        confidence,
      });
      console.error(`[MemPalaceRate] Failure bookmark: ${correctionText.substring(0, 60)} (confidence: ${confidence})`);
    }

    // 2. File context as drawer (if we have a response preview)
    if (rating.response_preview || rating.sentiment_summary || rating.comment) {
      const content = [
        `Rating: ${rating.rating}/10 (${rating.source})`,
        rating.confidence ? `Confidence: ${rating.confidence}` : null,
        rating.comment ? `Comment: ${rating.comment}` : null,
        rating.sentiment_summary
          ? `Sentiment: ${rating.sentiment_summary}`
          : null,
        rating.response_preview
          ? `\nResponse:\n${rating.response_preview}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");

      spawnBridge("add_drawer", {
        wing: ratingsWing,
        room: month,
        content,
        source_file: RATINGS_FILE,
        added_by: "dos-rate-hook",
      });
    }

    // Update last processed timestamp
    updateLastProcessedTimestamp(rating.timestamp);
  }

  console.error("[MemPalaceRate] Done");

  // Stdout digest via shared helper (gate + wrapper centralized in lib/memory-digest).
  // Emit only when at least one rating was processed (no-op turns stay silent).
  if (newRatings.length > 0) {
    const count = newRatings.length;
    const noun = count === 1 ? "rating" : "ratings";
    emitMemoryDigest(`rate captured ${count} ${noun} + filed drawer in ${ratingsWing} wing`);
  }

  process.exit(0);
}

const _t = startTimer('MemPalaceRate');
process.on('exit', () => stopTimer(_t, 'UserPromptSubmit'));
main().catch((err) => {
  console.error("[MemPalaceRate] Fatal:", err);
  process.exit(0);
});
