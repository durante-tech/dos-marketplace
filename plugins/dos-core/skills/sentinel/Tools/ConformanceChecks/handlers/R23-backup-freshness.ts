/**
 * R23 — Last DOS-backup MANIFEST.json mtime <48h.
 *
 * Scans the backup root directory (default: ~/Library/Application Support/DOS/backups)
 * for the most recent MANIFEST.json. Reads its `_generated_at` or `created_at`
 * timestamp and verifies it is within the 48-hour freshness threshold.
 *
 * This is a dynamic/live-only check: it requires a backup to have run at least
 * once. If the backup root is absent or has no MANIFEST.json, returns
 * `not_applicable` (backup infrastructure not yet configured, not a violation).
 *
 * The distinction from RFC-0028's R18 (backup-health): R23 checks ONLY
 * freshness, not hook wiring. R18 is in the pre-2026-05-05 rule namespace.
 * R23 is the RFC-0059 §13.1 Tier-1 rule focused purely on the time-based
 * freshness invariant.
 *
 * Test seams (via CheckContext):
 *   - ctx.backupRootPath: override backup root (default: ~/Library/Application Support/DOS/backups)
 *   - ctx.nowMs: override Date.now() for deterministic age tests
 *
 * Failure modes:
 *   - Backup root not found → not_applicable
 *   - No MANIFEST.json found → not_applicable (backup never ran)
 *   - MANIFEST.json has no valid timestamp → fail
 *   - Backup age > 48h → fail
 *
 * Why R-class: backup freshness is a safety property mandated by the
 * post-tragedy P0 remediation plan (2026-05-04). Stale backups mean data
 * loss risk; silent staleness destroyed 1.4 GB in the triggering incident.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "Last DOS-backup MANIFEST.json must have a timestamp within 48 hours";

const BACKUP_AGE_LIMIT_HOURS = 48;

interface ManifestFile {
  _generated_at?: string;
  created_at?: string;
}

function findLatestManifest(backupRoot: string): string | null {
  if (!existsSync(backupRoot)) return null;

  let entries: string[];
  try {
    entries = readdirSync(backupRoot);
  } catch {
    return null;
  }

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

function backupAgeHours(manifestPath: string, nowMs: number): number | null {
  let parsed: ManifestFile;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, "utf-8")) as ManifestFile;
  } catch {
    return null;
  }
  const ts = parsed._generated_at ?? parsed.created_at;
  if (!ts) return null;
  const genMs = new Date(ts).getTime();
  if (isNaN(genMs)) return null;
  return (nowMs - genMs) / (1000 * 60 * 60);
}

export async function r23BackupFreshness(ctx: CheckContext): Promise<CheckResult> {
  const nowMs = ctx.nowMs ?? Date.now();

  const backupRoot =
    ctx.backupRootPath ??
    join(homedir(), "Library", "Application Support", "DOS", "backups");

  if (!existsSync(backupRoot)) {
    return {
      rId: "R23",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`Backup root not found at ${backupRoot} — backup infrastructure not configured`],
    };
  }

  const latestManifest = findLatestManifest(backupRoot);

  if (latestManifest === null) {
    return {
      rId: "R23",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`No backup MANIFEST.json found under ${backupRoot} — backup has never run`],
    };
  }

  const ageHours = backupAgeHours(latestManifest, nowMs);

  if (ageHours === null) {
    return {
      rId: "R23",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `MANIFEST.json at ${latestManifest} has no valid timestamp (checked _generated_at and created_at)`,
      ],
    };
  }

  if (ageHours > BACKUP_AGE_LIMIT_HOURS) {
    return {
      rId: "R23",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `Last backup is ${ageHours.toFixed(1)}h old (${latestManifest}) — exceeds ${BACKUP_AGE_LIMIT_HOURS}h threshold`,
      ],
    };
  }

  return {
    rId: "R23",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [
      `Last backup: ${ageHours.toFixed(1)}h ago (within ${BACKUP_AGE_LIMIT_HOURS}h window) — ${latestManifest}`,
    ],
  };
}
