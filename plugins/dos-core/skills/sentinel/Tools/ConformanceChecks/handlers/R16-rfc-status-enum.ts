/**
 * R16 — RFC corpus `status:` frontmatter enum validity.
 *
 * RFC-0033 Rule 2 mandates that every `Plans/Specs/RFC-*.md` (and any archived
 * `Plans/Specs/Archive/**\/RFC-*.md`) carry a `status:` YAML frontmatter field
 * drawn from the corpus enum. Without it, the characterization manifest
 * (Rule 6) cannot answer "which RFCs are in flight, which are shipped,
 * which are tombstoned" — and the Walking Skeleton (RFC-0034 §5) cannot
 * gate v0.0.5 release because the corpus state is unobservable.
 *
 * Enum (Rule 2 + Council 4-of-4 ratified extension):
 *   - Literals (case-insensitive): draft, accepted, in-progress, shipped, withdrawn
 *   - Pattern: superseded-by:RFC-NNNN (4-digit RFC number)
 *   - Pattern: blocked-by:<reason> (any non-empty reason text)
 *   - Pattern: deferred-to-vX.Y.Z (semantic-version target — Fowler-Council
 *     extension for RFC-0042/0044 and any future deferred-by-release work)
 *
 * Failure modes:
 *   - status:  missing entirely → fail (no characterization possible)
 *   - status:  present but empty → fail
 *   - status:  literal not in the enum (e.g., "Implemented", "Shipped (Phase 0+1, ...)") → fail
 *
 * Case-insensitive on the literal set: `Draft`, `DRAFT`, `draft` all pass.
 * Case-sensitive on the patterns: `Superseded-by:RFC-0001` does NOT pass —
 * the convention is lowercase prefix + colon + capital RFC.
 *
 * Why R-class (not C-class): RFC-0033 names this as a Rule (load-bearing
 * doctrine), not a stylistic convention. R-class fits the requirement bucket.
 *
 * Scopes scanned (existsSync-gated — missing directories silently skip):
 *   - <repoRoot>/Plans/Specs/RFC-*.md (live corpus)
 *   - <repoRoot>/Plans/Specs/Archive/{any-depth}/RFC-*.md (archived corpus, recursive)
 *
 * Skip patterns: filenames not matching ^RFC-\d{4} are not RFC files; ignored.
 *
 * Evidence on PASS: the count of RFCs validated.
 * Evidence on FAIL: per-file {file, status_value, reason} list.
 *
 * Not_applicable: when neither Plans/Specs/ nor Plans/Specs/Archive/ exists
 * at the repoRoot — i.e., this project doesn't host an RFC corpus.
 */

import { existsSync, readdirSync, readFileSync, statSync, type Stats } from "fs";
import { join, relative } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const VALID_LITERALS = ["draft", "accepted", "in-progress", "shipped", "withdrawn"] as const;
const PATTERN_SUPERSEDED = /^superseded-by:RFC-\d{4}$/;
const PATTERN_BLOCKED = /^blocked-by:.+$/;
const PATTERN_DEFERRED = /^deferred-to-v\d+\.\d+\.\d+$/;

const RFC_FILENAME = /^RFC-\d{4}/;

interface RfcFinding {
  file: string;
  status_value: string | null;
  valid: boolean;
  reason: string | null;
}

function isValidStatus(raw: string | null): { valid: boolean; reason: string | null } {
  if (raw === null) return { valid: false, reason: "no `status:` field in YAML frontmatter" };
  const value = raw.trim();
  if (value.length === 0) return { valid: false, reason: "empty `status:` field" };

  // Literals are case-insensitive (existing corpus has `Draft`, `Accepted` etc.)
  const lower = value.toLowerCase();
  if ((VALID_LITERALS as readonly string[]).includes(lower)) {
    return { valid: true, reason: null };
  }

  // Patterns are case-sensitive (convention: lowercase prefix, capital RFC)
  if (PATTERN_SUPERSEDED.test(value)) return { valid: true, reason: null };
  if (PATTERN_BLOCKED.test(value)) return { valid: true, reason: null };
  if (PATTERN_DEFERRED.test(value)) return { valid: true, reason: null };

  return {
    valid: false,
    reason: `value "${value}" is not in the corpus enum (literals: ${VALID_LITERALS.join(" | ")} | patterns: superseded-by:RFC-NNNN | blocked-by:<reason> | deferred-to-vX.Y.Z)`,
  };
}

/**
 * Extract the `status:` value from the leading YAML frontmatter block.
 * Frontmatter must start at line 1 with `---` and close with `---` on its own
 * line. Lightweight parser (no external YAML dep) — only reads the leading
 * fenced block, finds a top-level `^status:\s*(.+)$` line. Lines that begin
 * with whitespace (indented) are part of a parent value, not the status field
 * (e.g., RFC-0024 has multi-line `status_note:` content that must not be
 * mistaken for status).
 *
 * Returns null if no frontmatter, no status line, or status spans multiple
 * lines (which the strict parser refuses).
 */
function extractStatus(content: string): string | null {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) break;
    if (line.trim() === "---") break; // end of frontmatter

    // Top-level keys start at column 0 (no leading whitespace)
    const m = /^status:\s*(.*)$/.exec(line);
    if (m && m[1] !== undefined) {
      // Reject empty / whitespace-only / quoted-empty values
      const raw = m[1].trim();
      // Strip surrounding single or double quotes if present
      const unquoted = raw.replace(/^["']|["']$/g, "");
      return unquoted;
    }
  }
  return null;
}

function collectRfcFiles(root: string, recursive: boolean): string[] {
  const out: string[] = [];
  if (!existsSync(root)) return out;

  const entries = readdirSync(root);
  for (const entry of entries) {
    const abs = join(root, entry);
    let s: Stats;
    try {
      s = statSync(abs);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      if (recursive) out.push(...collectRfcFiles(abs, recursive));
      continue;
    }
    if (!s.isFile()) continue;
    if (!entry.endsWith(".md")) continue;
    if (!RFC_FILENAME.test(entry)) continue;
    out.push(abs);
  }
  return out;
}

export async function r16RfcStatusEnum(ctx: CheckContext): Promise<CheckResult> {
  const requirement =
    "Every RFC in Plans/Specs/ (and Plans/Specs/Archive/) has a valid `status:` frontmatter value (RFC-0033 Rule 2)";

  const repoRoot = ctx.repoRoot;
  if (!repoRoot) {
    return {
      rId: "R16",
      requirement,
      status: "not_applicable",
      evidence: ["repoRoot not provided in CheckContext"],
    };
  }

  const liveDir = join(repoRoot, "Plans", "Specs");
  const archiveDir = join(repoRoot, "Plans", "Specs", "Archive");

  if (!existsSync(liveDir) && !existsSync(archiveDir)) {
    return {
      rId: "R16",
      requirement,
      status: "not_applicable",
      evidence: [
        `neither ${relative(repoRoot, liveDir)} nor ${relative(repoRoot, archiveDir)} exists — this project does not host an RFC corpus`,
      ],
    };
  }

  const liveFiles = collectRfcFiles(liveDir, false);
  const archiveFiles = existsSync(archiveDir) ? collectRfcFiles(archiveDir, true) : [];
  const allFiles = [...liveFiles, ...archiveFiles];

  if (allFiles.length === 0) {
    return {
      rId: "R16",
      requirement,
      status: "not_applicable",
      evidence: [`Plans/Specs/ exists but no RFC-*.md files found`],
    };
  }

  const findings: RfcFinding[] = [];
  for (const file of allFiles) {
    let content: string;
    try {
      content = readFileSync(file, "utf-8");
    } catch (err) {
      findings.push({
        file: relative(repoRoot, file),
        status_value: null,
        valid: false,
        reason: `read error: ${(err as Error).message}`,
      });
      continue;
    }
    const status = extractStatus(content);
    const check = isValidStatus(status);
    findings.push({
      file: relative(repoRoot, file),
      status_value: status,
      valid: check.valid,
      reason: check.reason,
    });
  }

  const failures = findings.filter((f) => !f.valid);
  const passes = findings.length - failures.length;

  if (failures.length === 0) {
    return {
      rId: "R16",
      requirement,
      status: "pass",
      evidence: [`all ${passes} RFC files validated against the corpus enum`],
    };
  }

  return {
    rId: "R16",
    requirement,
    status: "fail",
    evidence: failures.map(
      (f) =>
        `${f.file}: ${f.status_value === null ? "(no status field)" : `status="${f.status_value}"`} — ${f.reason}`,
    ),
  };
}
