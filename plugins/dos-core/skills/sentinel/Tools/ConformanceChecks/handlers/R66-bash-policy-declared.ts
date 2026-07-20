/**
 * R66 — Bash policy declared: settings.json MUST declare
 * `dos.bashPolicy` as one of `"none" | "blacklist" | "whitelist" | "managed"`.
 *
 * Provenance: 28D sprint D11 (2026-05, indydevdan "Engineers, DELETE the BASH
 * Tool"). Agentic systems need an explicit, operator-declared bash-security
 * posture. DOS already ships RmGuard + BashAllowlistGuard hooks (effectively
 * a Level-3 "blacklist" posture), but the posture itself is never declared
 * as a first-class field — operators in different deployments can't tell
 * which guards SHOULD fire, only which DO fire today.
 *
 * R66 forces the declaration so that downstream pre-tool-use checks (R67+,
 * future) can gate behaviour on the declared policy rather than on the
 * presence/absence of specific hooks. Companion pack: DamageControl (scaffold
 * lands alongside this R-rule but is operator-gated — the baseline hook
 * ships as a `.template` file so it does not auto-activate).
 *
 * Allowed values:
 *   - "none"        — no bash policy enforcement (explicit opt-out)
 *   - "blacklist"   — block dangerous patterns; allow everything else (DamageControl baseline)
 *   - "whitelist"   — block everything; allow declared safe patterns
 *   - "managed"     — full policy engine: allow/block/prompt with audit trail
 *
 * Scope: scans `~/.claude/settings.json` only (singleton check — never skips).
 *
 * Algorithm:
 *   1. Resolve settings.json path (ctx.settingsPath override or default).
 *   2. Read + parse JSON.
 *   3. Read `dos.bashPolicy` field.
 *   4. pass: field present AND value in allowed set.
 *   5. fail: field absent (reason names the field) OR value not in allowed
 *      set (reason lists allowed values).
 *   6. not_applicable: settings.json missing or unparseable — the parent
 *      Sentinel scan should normally have surfaced this, but R66 fails open
 *      to not_applicable rather than masking a more fundamental file error.
 *
 * Test seam: ctx.settingsPath — fixture-friendly per the established R-rule
 * convention (R9, R18, R19 all use the same seam).
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  'settings.json must declare dos.bashPolicy as one of "none" | "blacklist" | "whitelist" | "managed"';

const ALLOWED_VALUES = ["none", "blacklist", "whitelist", "managed"] as const;
type BashPolicy = (typeof ALLOWED_VALUES)[number];

function isAllowedValue(v: unknown): v is BashPolicy {
  return typeof v === "string" && (ALLOWED_VALUES as readonly string[]).includes(v);
}

export async function r66BashPolicyDeclared(
  ctx: CheckContext,
): Promise<CheckResult> {
  const settingsPath =
    ctx.settingsPath ?? join(ctx.hooksRoot, "..", "settings.json");

  if (!existsSync(settingsPath)) {
    return {
      rId: "R66",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`settings.json not found at ${settingsPath}`],
    };
  }

  let raw: string;
  try {
    raw = readFileSync(settingsPath, "utf-8");
  } catch (err) {
    return {
      rId: "R66",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        `settings.json unreadable at ${settingsPath}: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  let settings: Record<string, unknown>;
  try {
    settings = JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    return {
      rId: "R66",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `settings.json is not valid JSON (${settingsPath}): ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  const dosBlock = settings.dos;
  const bashPolicy =
    dosBlock && typeof dosBlock === "object"
      ? (dosBlock as Record<string, unknown>).bashPolicy
      : undefined;

  if (bashPolicy === undefined) {
    return {
      rId: "R66",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `dos.bashPolicy field is absent from ${settingsPath} — operator must declare one of: ${ALLOWED_VALUES.join(", ")}`,
      ],
      loc: settingsPath,
    };
  }

  if (!isAllowedValue(bashPolicy)) {
    return {
      rId: "R66",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `dos.bashPolicy has invalid value ${JSON.stringify(bashPolicy)} in ${settingsPath} — allowed values: ${ALLOWED_VALUES.join(", ")}`,
      ],
      loc: settingsPath,
    };
  }

  return {
    rId: "R66",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [`dos.bashPolicy declared as "${bashPolicy}" in ${settingsPath}`],
    loc: settingsPath,
  };
}
