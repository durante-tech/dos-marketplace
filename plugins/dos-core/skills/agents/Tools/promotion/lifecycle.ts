import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import { parse as parseYaml } from "yaml";
import { createHash } from "crypto";
import {
  AGENTS_DIR_USER,
  CUSTOM_AGENTS_DIR,
  MAX_EPHEMERAL_BLOB_BYTES,
  VALID_SLUG_PATTERN,
} from "./constants.ts";
import { computeCompositionIdentity } from "./identity.ts";
import { readCustomAgentFile, validatePromotionRequest, loadComposeAuthoredAgent } from "./source.ts";
import {
  evaluateGate,
  enforcePromotionGate,
  writePromotionOverrideAudit,
  auditForcedPromotion,
} from "./gate.ts";
import { pollForDisappearance, enforceNoScopeCollision } from "./registry.ts";
import {
  resolvePromotionTarget,
  previewPromotion,
  writePromotedAgentAtomically,
  reportPromotionOutcome,
} from "./target.ts";
import type { PromoteOptions } from "./types.ts";

const HOME = process.env.HOME || "~";

/**
 * Durable-lane promotion (§6.1). Writes to ~/.claude/agents/<name>.md and polls
 * `claude agents` for registration. Returns a numeric exit code.
 */
export function promoteAgent(opts: PromoteOptions): number {
  const validation = validatePromotionRequest(opts);
  if (!validation.ok) return validation.code;

  const source = loadComposeAuthoredAgent(opts.slug);
  if (!source.ok) return source.code;

  const gate = evaluateGate(source.value.identity, opts);
  const gateCheck = enforcePromotionGate(gate, source.value.identity, opts.force);
  if (!gateCheck.ok) return gateCheck.code;

  const target = resolvePromotionTarget(source.value, opts);
  if (!target.ok) return target.code;

  if (opts.dryRun) return previewPromotion(target.value, gate);

  const collisionCheck = enforceNoScopeCollision(target.value.targetName, opts.scope);
  if (!collisionCheck.ok) return collisionCheck.code;

  if (opts.force && !gate.permitted) {
    auditForcedPromotion(opts.slug, source.value.identity, gate, opts.scope);
  }

  writePromotedAgentAtomically(target.value);
  return reportPromotionOutcome(target.value, source.value.traits, opts.scope, opts.slug);
}

/**
 * Demote inverse (§11.1). Deletes ~/.claude/agents/<name>.md after verifying
 * the file was promoted by ComposeAgent (source-safeguard §11.3).
 */
export function demoteAgentPromotion(opts: {
  slug: string;
  scope: "user" | "project";
}): number {
  if (!VALID_SLUG_PATTERN.test(opts.slug)) {
    console.error(
      JSON.stringify({
        error: "invalid_slug",
        slug: opts.slug,
        pattern: VALID_SLUG_PATTERN.source,
      }),
    );
    return 2;
  }

  const targetDir =
    opts.scope === "user"
      ? AGENTS_DIR_USER
      : `${process.env.CLAUDE_PROJECT_DIR || process.cwd()}/.claude/agents`;
  const targetPath = `${targetDir}/${opts.slug}.md`;

  if (!existsSync(targetPath)) {
    console.error(`[ComposeAgent] no promoted agent at ${targetPath}`);
    return 1;
  }

  const content = readFileSync(targetPath, "utf-8");
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) {
    console.error(`[ComposeAgent] ${targetPath} has no frontmatter — refusing to delete (not a ComposeAgent-promoted file)`);
    return 1;
  }
  let frontmatter: Record<string, unknown> = {};
  try {
    frontmatter = (parseYaml(fmMatch[1]) as Record<string, unknown>) || {};
  } catch {
    console.error(`[ComposeAgent] ${targetPath} frontmatter unparseable — refusing to delete`);
    return 1;
  }

  if (frontmatter.source !== "ComposeAgent" || frontmatter.custom_agent !== true) {
    console.error(
      `[ComposeAgent] ${targetPath} is missing 'source: "ComposeAgent"' or 'custom_agent: true' — refusing to delete (hand-authored agent safeguard §11.3)`,
    );
    return 1;
  }

  // Restore custom-agents copy if absent
  const customPath = `${CUSTOM_AGENTS_DIR}/${opts.slug}.md`;
  if (!existsSync(customPath)) {
    mkdirSync(CUSTOM_AGENTS_DIR, { recursive: true });
    // writeArtifact:exempt — custom-agents materialization (gitignored runtime state)
    writeFileSync(customPath, content, "utf-8");
  }

  unlinkSync(targetPath);

  const disappeared = pollForDisappearance(opts.slug, opts.scope);
  console.log(`✓ Demoted '${opts.slug}' → removed ${targetPath}`);
  console.log(`  Original saved composition: ${customPath} (restored)`);
  if (disappeared) {
    console.log(`  Deactivate NOW: run \`/agents\` in this session to drop the cached registry entry`);
    console.log(`  Or: will disappear on next \`claude\` session start`);
    console.log(`  Re-promote later: \`ComposeAgent --promote ${opts.slug}\` (subject to observability gate)`);
    return 0;
  }
  console.log(`  Registry still shows '${opts.slug}' — restart \`claude\` or run \`/agents\` to clear`);
  return 3;
}

/**
 * Ephemeral-lane (§7.1) — construct --agents JSON blob, print, exit.
 * With --ephemeral-exec (§7.2), also re-exec `claude --agents '...'` after state dump.
 */
export function ephemeralPromote(opts: {
  slug: string;
  exec: boolean;
  abortSeconds: number;
  nSessions: number;
  freshnessDays: number;
  minDaysSpread: number;
  minPersistedRatio: number;
  force: boolean;
}): number {
  if (!VALID_SLUG_PATTERN.test(opts.slug)) {
    console.error(
      JSON.stringify({
        error: "invalid_slug",
        slug: opts.slug,
        pattern: VALID_SLUG_PATTERN.source,
      }),
    );
    return 2;
  }

  let source: { frontmatter: Record<string, unknown>; body: string; rawFrontmatter: string };
  try {
    source = readCustomAgentFile(opts.slug);
  } catch (e) {
    console.error(`[ComposeAgent] ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }

  const fm = source.frontmatter;
  if (fm.custom_agent !== true || fm.source !== "ComposeAgent") {
    console.error(
      `[ComposeAgent] ${opts.slug} is missing 'custom_agent: true' or 'source: "ComposeAgent"' — not a ComposeAgent-authored file. Refusing to promote.`,
    );
    return 1;
  }

  const title =
    typeof fm.display_name === "string"
      ? fm.display_name
      : typeof fm.name === "string"
        ? fm.name
        : opts.slug;
  const traitsList = Array.isArray(fm.traits)
    ? (fm.traits as unknown[]).map((t) => String(t))
    : [];
  const identity = computeCompositionIdentity(title, traitsList);

  const gate = evaluateGate(identity, {
    nSessions: opts.nSessions,
    freshnessDays: opts.freshnessDays,
    minDaysSpread: opts.minDaysSpread,
    minPersistedRatio: opts.minPersistedRatio,
  });

  if (!gate.permitted && !opts.force) {
    console.error(
      JSON.stringify({
        error: "gate_not_met",
        identity,
        required_n: gate.required_n,
        observed_n: gate.observed_n,
        freshness_days: gate.freshness_days,
        reason: gate.reason,
        exec_lane: "ephemeral",
        suggestion: `compose this identity in ${Math.max(gate.required_n - gate.observed_n, 1)} more distinct sessions, or pass --force-promote`,
      }),
    );
    return 4;
  }

  if (opts.force && !gate.permitted) {
    console.error(
      `⚠ --force-promote: gate observed ${gate.observed_n}/${gate.required_n} sessions (${gate.reason}). Audit row written.`,
    );
    writePromotionOverrideAudit({
      slug: opts.slug,
      identity,
      required_n: gate.required_n,
      observed_n: gate.observed_n,
      scope: "n/a",
      exec_lane: "ephemeral",
      reason: "force",
    });
  }

  const name = String(fm.name || opts.slug);
  const description =
    typeof fm.description === "string"
      ? fm.description
      : `Composed agent from traits: ${traitsList.length > 0 ? traitsList.join(", ") : "unknown"}`;

  const blob: Record<string, { description: string; prompt: string }> = {};
  blob[name] = { description, prompt: source.body.trim() };
  const serialized = JSON.stringify(blob);

  if (Buffer.byteLength(serialized, "utf-8") > MAX_EPHEMERAL_BLOB_BYTES) {
    console.error(
      `[ComposeAgent] ephemeral blob ${Buffer.byteLength(serialized, "utf-8")} bytes exceeds ${MAX_EPHEMERAL_BLOB_BYTES} byte limit (§14.3)`,
    );
    return 1;
  }

  const fingerprint = createHash("sha256").update(serialized).digest("hex");

  if (!opts.exec) {
    console.log(`--agents JSON (sha256: ${fingerprint}):`);
    console.log(serialized);
    console.log("");
    console.log(`To inject into a fresh session:`);
    console.log(`  claude --agents '${serialized.replace(/'/g, `'\\''`)}'`);
    console.log("");
    console.log(`To re-exec immediately (destroys current session state):`);
    console.log(`  ComposeAgent --promote ${opts.slug} --ephemeral --ephemeral-exec`);
    return 0;
  }

  // --ephemeral-exec — destructive opt-in
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dumpDir = `${HOME}/.claude/MEMORY/WORK/${stamp}_compose-exec`;
  mkdirSync(dumpDir, { recursive: true });

  const envScrubbed: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined) continue;
    if (/_TOKEN$|_KEY$|_SECRET$/i.test(k)) {
      envScrubbed[k] = "<scrubbed>";
    } else {
      envScrubbed[k] = v;
    }
  }
  writeFileSync(`${dumpDir}/session-env.json`, JSON.stringify(envScrubbed, null, 2), "utf-8"); // writeArtifact:exempt — session debug dump (state)
  writeFileSync(`${dumpDir}/cwd.txt`, process.cwd(), "utf-8"); // writeArtifact:exempt — session debug dump (state)
  writeFileSync(`${dumpDir}/blob.json`, serialized, "utf-8"); // writeArtifact:exempt — session debug dump (state)
  writeFileSync(`${dumpDir}/blob.sha256`, fingerprint, "utf-8"); // writeArtifact:exempt — session debug dump (state)

  console.error(`⚠ --ephemeral-exec will re-execute claude with a fresh session.`);
  console.error(`  Current session state (env, cwd) dumped to: ${dumpDir}`);
  console.error(`  Your in-memory todos, conversation transcript, and pending tool approvals WILL be lost.`);
  console.error(`  Proceed? Set ABORT=1 to cancel within ${opts.abortSeconds} seconds.`);

  const abortEnd = Date.now() + opts.abortSeconds * 1000;
  while (Date.now() < abortEnd) {
    const chunk = Math.min(100, abortEnd - Date.now());
    if (chunk > 0) Bun.sleepSync(chunk);
  }
  if (process.env.ABORT === "1") {
    console.error(`Aborted.`);
    return 1;
  }

  // Re-exec via argv array — never sh -c (§14.2)
  const child = Bun.spawn(["claude", "--agents", serialized], {
    stdio: ["inherit", "inherit", "inherit"],
  });
  // Abandon current session; exit immediately — child lifetime is operator's concern
  void child;
  process.exit(0);
}
