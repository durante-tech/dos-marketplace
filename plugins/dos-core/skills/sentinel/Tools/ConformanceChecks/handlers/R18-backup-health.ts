/**
 * R18 — Memory backup health: MemoryBackup hook registered + last backup <48h.
 *
 * After the post-tragedy audit (2026-05-04), the P0 remediation added a
 * MemoryBackup.hook.ts that runs at SessionEnd (and on a 5-min cron) to
 * rsync MEMORY/MEMPALACE/, STATE/.pending/, and *.jsonl files to
 * ~/Library/Application Support/DOS/backups/{YYYY-MM-DD}/.
 *
 * This check verifies two things:
 *
 *   1. MemoryBackup hook is wired — settings.json must contain "MemoryBackup"
 *      in at least one hook group entry (any group, any event).
 *
 *   2. Last backup is fresh — the most recent MANIFEST.json under the backup
 *      root must have a `_generated_at` ISO timestamp within 48 hours.
 *      (Stream A's MemoryBackup.hook.ts writes this manifest on every run.)
 *
 * Failure modes:
 *   - settings.json missing → not_applicable
 *   - MemoryBackup absent from all hook groups → fail
 *   - No MANIFEST.json found anywhere under backup root → fail
 *   - Most recent MANIFEST._generated_at older than 48h → fail
 *
 * Test seams (via CheckContext):
 *   - ctx.settingsPath: override settings.json location (default: hooksRoot/../settings.json)
 *   - ctx.backupRootPath: override backup root (default: ~/Library/Application Support/DOS/backups)
 *   - ctx.nowMs: override Date.now() for deterministic age tests
 *
 * Why R-class: MemoryBackup is an operational safety requirement mandated by
 * the post-tragedy remediation plan, not a stylistic convention. Silent
 * failure (no backup) destroyed 1.4 GB of MEMORY/ data in the triggering
 * incident.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "MemoryBackup hook registered in settings.json + last backup MANIFEST.json within 48h";

const BACKUP_AGE_LIMIT_HOURS = 48;

interface ManifestFile {
  /** Written by ConventionCache.ts / fixture convention */
  _generated_at?: string;
  /** Written by Stream A's MemoryBackup.hook.ts (actual production field) */
  created_at?: string;
}

/** Walks backup root dir and returns the most recent MANIFEST.json path. */
function findLatestManifest(backupRoot: string): string | null {
  if (!existsSync(backupRoot)) return null;

  let entries: string[];
  try {
    entries = readdirSync(backupRoot);
  } catch {
    return null;
  }

  // Directories are named YYYY-MM-DD — sort descending for most-recent-first.
  const dateDirs = entries
    .filter((e) => {
      try {
        return statSync(join(backupRoot, e)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort()
    .reverse();

  for (const dir of dateDirs) {
    const manifestPath = join(backupRoot, dir, "MANIFEST.json");
    if (existsSync(manifestPath)) return manifestPath;
  }
  return null;
}

/** Returns age in hours, or null if no valid timestamp found.
 *  Accepts both `_generated_at` (fixture/convention) and `created_at`
 *  (Stream A MemoryBackup.hook.ts production format). */
function backupAgeHours(manifestPath: string, nowMs: number): number | null {
  let parsed: ManifestFile;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, "utf-8")) as ManifestFile;
  } catch {
    return null;
  }
  // Try _generated_at first (convention / fixtures), fall back to created_at (production)
  const ts = parsed._generated_at ?? parsed.created_at;
  if (!ts) return null;
  const genMs = new Date(ts).getTime();
  if (isNaN(genMs)) return null;
  return (nowMs - genMs) / (1000 * 60 * 60);
}

export async function r18BackupHealth(ctx: CheckContext): Promise<CheckResult> {
  const nowMs = ctx.nowMs ?? Date.now();

  // --- 1. Locate settings.json ---
  const settingsPath =
    ctx.settingsPath ?? join(ctx.hooksRoot, "..", "settings.json");

  if (!existsSync(settingsPath)) {
    return {
      rId: "R18",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`settings.json not found at ${settingsPath}`],
    };
  }

  let settings: Record<string, unknown>;
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf-8")) as Record<string, unknown>;
  } catch (err) {
    return {
      rId: "R18",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `settings.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  // --- 2. Check MemoryBackup hook presence ---
  const hooks = (settings.hooks ?? {}) as Record<string, unknown>;
  let memoryBackupPresent = false;

  for (const groupEntries of Object.values(hooks)) {
    if (!Array.isArray(groupEntries)) continue;
    for (const entry of groupEntries) {
      if (typeof entry === "string" && entry.includes("MemoryBackup")) {
        memoryBackupPresent = true;
        break;
      }
      if (typeof entry === "object" && entry !== null) {
        if (JSON.stringify(entry).includes("MemoryBackup")) {
          memoryBackupPresent = true;
          break;
        }
      }
    }
    if (memoryBackupPresent) break;
  }

  const evidence: string[] = [];

  if (!memoryBackupPresent) {
    evidence.push(
      "MemoryBackup hook not found in any settings.json hook group — backup is not wired",
    );
  }

  // --- 3. Check last backup age ---
  const backupRoot =
    ctx.backupRootPath ??
    join(homedir(), "Library", "Application Support", "DOS", "backups");

  const latestManifest = findLatestManifest(backupRoot);

  if (latestManifest === null) {
    evidence.push(
      `no backup MANIFEST.json found under ${backupRoot} — MemoryBackup has never run`,
    );
  } else {
    const ageHours = backupAgeHours(latestManifest, nowMs);
    if (ageHours === null) {
      evidence.push(
        `MANIFEST.json at ${latestManifest} has no valid timestamp (checked _generated_at and created_at)`,
      );
    } else if (ageHours > BACKUP_AGE_LIMIT_HOURS) {
      evidence.push(
        `last backup is ${ageHours.toFixed(1)}h old (${latestManifest}) — exceeds ${BACKUP_AGE_LIMIT_HOURS}h threshold`,
      );
    }
  }

  if (evidence.length > 0) {
    return {
      rId: "R18",
      requirement: REQUIREMENT,
      status: "fail",
      evidence,
    };
  }

  const ageHours = backupAgeHours(latestManifest!, nowMs)!;
  return {
    rId: "R18",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [
      "MemoryBackup hook registered in settings.json",
      `last backup: ${ageHours.toFixed(1)}h ago (within ${BACKUP_AGE_LIMIT_HOURS}h window)`,
    ],
  };
}
