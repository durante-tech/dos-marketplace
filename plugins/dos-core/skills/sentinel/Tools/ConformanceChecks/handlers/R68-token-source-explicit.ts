/**
 * R68 (D13 sprint) — Token source must be declared explicitly in settings.json.
 *
 * Background: per indydevdan "MAXIMIZE Subscription" video — when both
 * `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_API_KEY` are present in the runtime
 * environment, the API key silently wins. The user is then billed at API rates
 * instead of the OAuth-backed subscription. The Claude Code internal detection
 * line is `api_key_source: none` (= OAuth working) vs
 * `api_key_source: ANTHROPIC_API_KEY` (= API-key billing path).
 *
 * The remediation is operator declaration: settings.json MUST set
 *   dos.authMode: "oauth" | "api_key"
 *
 * Coherence checks:
 *   - oauth mode + env.ANTHROPIC_API_KEY set in settings.json → fail
 *     (settings.json env clobbers OAuth silently — same bug class).
 *   - api_key mode + env.ANTHROPIC_API_KEY absent AND no dos.authNote → fail
 *     (no documented source for the API key — drift target).
 *
 * Note: Agents/_runtime autonomous packs MUST use API key, never OAuth.
 *
 * Test seams (via CheckContext):
 *   - ctx.settingsPath: override settings.json location
 *     (default: <hooksRoot>/../settings.json).
 *
 * Tier: warning (presence + coherence — singleton scope like R18 / R66).
 *
 * Pass: authMode declared and consistent with env block.
 * Fail: authMode missing OR invalid OR clobber/drift detected.
 * Not_applicable: settings.json unreadable / not found.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "settings.json declares dos.authMode in {oauth, api_key}; oauth must not co-set env.ANTHROPIC_API_KEY; api_key must set env.ANTHROPIC_API_KEY or document via dos.authNote";

const VALID_MODES = ["oauth", "api_key"] as const;
type AuthMode = (typeof VALID_MODES)[number];

function isValidMode(v: unknown): v is AuthMode {
  return typeof v === "string" && (VALID_MODES as readonly string[]).includes(v);
}

export async function r68TokenSourceExplicit(ctx: CheckContext): Promise<CheckResult> {
  const settingsPath = ctx.settingsPath ?? join(ctx.hooksRoot, "..", "settings.json");

  if (!existsSync(settingsPath)) {
    return {
      rId: "R68",
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
      rId: "R68",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        `settings.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  const dos = (settings.dos ?? {}) as Record<string, unknown>;
  const env = (settings.env ?? {}) as Record<string, unknown>;
  const authMode = dos.authMode;
  const authNote = dos.authNote;
  const hasApiKeyInEnv =
    Object.prototype.hasOwnProperty.call(env, "ANTHROPIC_API_KEY") &&
    typeof env.ANTHROPIC_API_KEY === "string" &&
    (env.ANTHROPIC_API_KEY as string).length > 0;

  if (authMode === undefined || authMode === null) {
    return {
      rId: "R68",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        "dos.authMode is not declared in settings.json — operator must set it to \"oauth\" or \"api_key\"",
      ],
    };
  }

  if (!isValidMode(authMode)) {
    return {
      rId: "R68",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `dos.authMode has invalid value ${JSON.stringify(authMode)} — expected one of ${JSON.stringify(VALID_MODES)}`,
      ],
    };
  }

  if (authMode === "oauth" && hasApiKeyInEnv) {
    return {
      rId: "R68",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        "dos.authMode = \"oauth\" but env.ANTHROPIC_API_KEY is also set in settings.json — the API key silently clobbers OAuth (= billed at API rate, not subscription)",
        "remediation: remove env.ANTHROPIC_API_KEY from settings.json, OR switch dos.authMode to \"api_key\"",
      ],
    };
  }

  if (authMode === "api_key" && !hasApiKeyInEnv) {
    const hasNote = typeof authNote === "string" && authNote.length > 0;
    if (!hasNote) {
      return {
        rId: "R68",
        requirement: REQUIREMENT,
        status: "fail",
        evidence: [
          "dos.authMode = \"api_key\" but env.ANTHROPIC_API_KEY is absent and dos.authNote is not set — no documented source for the API key",
          "remediation: set env.ANTHROPIC_API_KEY in settings.json, OR set dos.authNote to document the alternative source (e.g., shell env)",
        ],
      };
    }
  }

  const evidence: string[] = [`dos.authMode = "${authMode}"`];
  if (authMode === "oauth") {
    evidence.push("env.ANTHROPIC_API_KEY not set in settings.json — OAuth path clean");
  } else {
    if (hasApiKeyInEnv) {
      evidence.push("env.ANTHROPIC_API_KEY set in settings.json — API key path explicit");
    } else {
      evidence.push(
        `env.ANTHROPIC_API_KEY not in settings.json but dos.authNote documents alternative source`,
      );
    }
  }

  return {
    rId: "R68",
    requirement: REQUIREMENT,
    status: "pass",
    evidence,
  };
}
