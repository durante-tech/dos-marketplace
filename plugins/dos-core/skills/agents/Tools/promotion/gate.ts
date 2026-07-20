import { mkdirSync, appendFileSync } from "fs";
import { PROMOTION_OVERRIDES_PATH } from "./constants.ts";
import { computeCompositionIdentity, parseArtifactsJsonl, traitsFromContentPreview } from "./identity.ts";
import type { GateDecision, StepResult } from "./types.ts";

/**
 * Evaluate the §8.1 observability gate against artifacts.jsonl for a given identity.
 * Returns a GateDecision describing the outcome. `permitted` is true iff all
 * active sub-conditions pass.
 */
export function evaluateGate(
  identity: string,
  opts: {
    nSessions: number;
    freshnessDays: number;
    minDaysSpread: number;
    minPersistedRatio: number;
  },
): GateDecision {
  const rows = parseArtifactsJsonl();
  const nowMs = Date.now();
  const freshnessMs = opts.freshnessDays * 24 * 60 * 60 * 1000;

  const identityRows = rows.filter((r) => {
    if (r.pack !== "Agents") return false;
    if (r.workflow !== "compose") return false;
    if (r.type !== "composition") return false;
    const rowIdentity = computeCompositionIdentity(
      r.title || "",
      traitsFromContentPreview(r.contentPreview || ""),
    );
    return rowIdentity === identity;
  });

  const withinFreshness = identityRows.filter((r) => {
    const ts = Date.parse(r.timestamp);
    if (!Number.isFinite(ts)) return false;
    return nowMs - ts <= freshnessMs;
  });

  const persistedWithSession = withinFreshness.filter(
    (r) => r.persisted === true && r.sessionId && r.sessionId.length > 0,
  );

  const distinctSessions = new Set(persistedWithSession.map((r) => r.sessionId));
  const observed_n = distinctSessions.size;

  const sessionTimestamps = persistedWithSession
    .map((r) => Date.parse(r.timestamp))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const spreadMs =
    sessionTimestamps.length >= 2
      ? sessionTimestamps[sessionTimestamps.length - 1] - sessionTimestamps[0]
      : 0;
  const spreadDays = spreadMs / (24 * 60 * 60 * 1000);

  const totalInWindow = withinFreshness.length;
  const persistedInWindow = withinFreshness.filter((r) => r.persisted === true).length;
  const ratio = totalInWindow > 0 ? persistedInWindow / totalInWindow : 0;

  const n_ok = observed_n >= opts.nSessions;
  const min_days_ok = opts.minDaysSpread === 0 || spreadDays >= opts.minDaysSpread;
  const ratio_ok = opts.minPersistedRatio === 0 || ratio >= opts.minPersistedRatio;

  let reason = "gate passed";
  if (!n_ok) reason = `observed ${observed_n} distinct sessions < required ${opts.nSessions}`;
  else if (!min_days_ok) reason = `session spread ${spreadDays.toFixed(1)}d < required ${opts.minDaysSpread}d`;
  else if (!ratio_ok) reason = `persisted ratio ${ratio.toFixed(2)} < required ${opts.minPersistedRatio}`;

  return {
    permitted: n_ok && min_days_ok && ratio_ok,
    identity,
    required_n: opts.nSessions,
    observed_n,
    freshness_days: opts.freshnessDays,
    min_days_spread: spreadDays,
    persisted_ratio: ratio,
    min_days_ok,
    ratio_ok,
    reason,
  };
}

export function enforcePromotionGate(
  gate: GateDecision,
  identity: string,
  force: boolean,
): StepResult<void> {
  if (!gate.permitted && !force) {
    console.error(
      JSON.stringify({
        error: "gate_not_met",
        identity,
        required_n: gate.required_n,
        observed_n: gate.observed_n,
        freshness_days: gate.freshness_days,
        reason: gate.reason,
        exec_lane: "durable",
        suggestion: `compose this identity in ${Math.max(gate.required_n - gate.observed_n, 1)} more distinct sessions, or pass --force-promote`,
      }),
    );
    return { ok: false, code: 4 };
  }
  return { ok: true, value: undefined };
}

/**
 * Append a §14.7 audit row when `--force-promote` bypasses the gate.
 */
export function writePromotionOverrideAudit(row: {
  slug: string;
  identity: string;
  required_n: number;
  observed_n: number;
  scope: string;
  exec_lane: "durable" | "ephemeral";
  reason: string;
}): void {
  try {
    const dir = PROMOTION_OVERRIDES_PATH.substring(0, PROMOTION_OVERRIDES_PATH.lastIndexOf("/"));
    mkdirSync(dir, { recursive: true });
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      operator: process.env.USER || "unknown",
      ...row,
    });
    appendFileSync(PROMOTION_OVERRIDES_PATH, entry + "\n", "utf-8");
  } catch (e) {
    console.error(`[ComposeAgent] WARNING: failed to write force-promote audit row: ${e}`);
  }
}

export function auditForcedPromotion(
  slug: string,
  identity: string,
  gate: GateDecision,
  scope: "user" | "project",
): void {
  console.error(
    `⚠ --force-promote: gate observed ${gate.observed_n}/${gate.required_n} sessions (${gate.reason}). Audit row written.`,
  );
  writePromotionOverrideAudit({
    slug,
    identity,
    required_n: gate.required_n,
    observed_n: gate.observed_n,
    scope,
    exec_lane: "durable",
    reason: "force",
  });
}
