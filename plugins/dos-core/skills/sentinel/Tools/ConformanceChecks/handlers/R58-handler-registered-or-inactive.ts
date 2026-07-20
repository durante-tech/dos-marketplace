/**
 * R58 — Every TypeScript file under `hooks/handlers/` (top-level only) MUST
 * be registered, either directly in `settings.json` hook chain commands OR
 * transitively (1-hop) by being imported from a registered hook entry-point
 * file. Files under `hooks/handlers/_inactive/` are explicitly excluded —
 * relocation to `_inactive/` is the sanctioned way to mark a handler
 * deliberately dormant without deleting it.
 *
 * Background: v0.0.15 drift audit Y2 (PRD-20260513-190458, "v0.0.15 orphan
 * handler audit") surfaced five handler files that did not appear directly
 * in settings.json — `DocCrossRefIntegrity.ts`, `SystemIntegrity.ts`,
 * `TabState.ts`, `UpdateCounts.ts`, `VoiceNotification.ts`. Authoritative
 * trace established that all five are 1-hop transitively imported by a
 * registered hook entry-point (`DocIntegrity.hook.ts`, `IntegrityCheck.hook.ts`,
 * `ResponseTabReset.hook.ts`, `UpdateCounts.hook.ts`, `VoiceCompletion.hook.ts`
 * respectively). The audit was wrong because it only checked direct
 * registration. This rule mechanizes the correct check so future drift
 * audits surface only genuine orphans.
 *
 * Convention: a handler file `hooks/handlers/Name.ts` is REGISTERED iff
 *   (a) some `settings.json` hook command string contains `handlers/Name`
 *       (direct registration; uncommon but possible), OR
 *   (b) some `.hook.ts` file referenced by a `settings.json` hook command
 *       contains an import / from-string that references `handlers/Name`
 *       (1-hop transitive — the common case).
 *
 * Files under `hooks/handlers/_inactive/` are skipped — that directory is
 * the sanctioned home for genuinely orphaned handlers preserved for
 * potential future reactivation (RFC-0092 artifact closure: relocation
 * over deletion).
 *
 * Pass condition: every top-level `*.ts` file under `hooks/handlers/` is
 * either directly registered or 1-hop transitively imported by a
 * registered hook.
 *
 * Fail condition: at least one top-level `*.ts` file under `hooks/handlers/`
 * is neither directly registered nor 1-hop transitively imported. The
 * remediation is one of:
 *   • register the handler in settings.json (if it should be active), OR
 *   • `git mv hooks/handlers/<file>.ts hooks/handlers/_inactive/<file>.ts`
 *     (if the handler is dormant by design).
 *
 * Not_applicable: hooks/handlers/ not present, or settings.json absent.
 *
 * Cross-reference: PRD-20260513-190458 (v0.0.15 orphan handler audit),
 * Drift audit Y2 (MEMORY/ARCHIVE/2026-05/v0015-drift-audit/audit.md).
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { basename, dirname, join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "Every hooks/handlers/*.ts file must be registered (direct in settings.json OR 1-hop transitive via a registered .hook.ts importer); files under handlers/_inactive/ are excluded";

interface HookEntry {
  type?: string;
  command?: string;
}

interface HookBlock {
  matcher?: string;
  hooks?: HookEntry[];
}

interface Settings {
  hooks?: Record<string, HookBlock[]>;
}

/**
 * Extract the list of hook entry-point file basenames referenced by any
 * `settings.json` hook command. We extract the substring after the LAST
 * `hooks/` segment so paths like `${DOS_DIR}/hooks/UpdateCounts.hook.ts`,
 * `<home>/.claude/hooks/DocIntegrity.hook.ts`, and bare
 * `hooks/IntegrityCheck.hook.ts` all yield the same basename token.
 */
function extractRegisteredHookFiles(settings: Settings): Set<string> {
  const files = new Set<string>();
  const events = settings.hooks ?? {};
  for (const eventName of Object.keys(events)) {
    const blocks = events[eventName] ?? [];
    for (const block of blocks) {
      for (const h of block.hooks ?? []) {
        const cmd = typeof h.command === "string" ? h.command : "";
        if (!cmd) continue;
        // Match every `<dir>/<file>.hook.ts`, `<dir>/<file>.ts`, or `<dir>/<file>.daemon.ts`
        // reference. The hook entry-point convention is .hook.ts at the top of hooks/,
        // but we also accept .ts and .daemon.ts to stay robust.
        const tokenRe = /hooks\/([A-Za-z0-9_.\-]+\.(?:hook\.ts|daemon\.ts|ts))/g;
        let m: RegExpExecArray | null;
        while ((m = tokenRe.exec(cmd)) !== null) {
          const fname = m[1];
          if (!fname) continue;
          // Drop any `handlers/Name.ts` matches — only collect entry-point hooks,
          // not direct registration of handler files (handled separately).
          if (fname.includes("/")) continue;
          files.add(fname);
        }
      }
    }
  }
  return files;
}

/**
 * Extract the set of handler basenames directly referenced by `settings.json`
 * commands via the `handlers/Name` substring pattern. This is the (a) limb
 * of the OR — rare but legal direct registration.
 */
function extractDirectlyRegisteredHandlers(settings: Settings): Set<string> {
  const direct = new Set<string>();
  const events = settings.hooks ?? {};
  for (const eventName of Object.keys(events)) {
    const blocks = events[eventName] ?? [];
    for (const block of blocks) {
      for (const h of block.hooks ?? []) {
        const cmd = typeof h.command === "string" ? h.command : "";
        if (!cmd) continue;
        const m = cmd.match(/handlers\/([A-Za-z0-9_.\-]+?)(?:\.ts)?(?:\b|$)/g);
        if (!m) continue;
        for (const tok of m) {
          // Strip trailing `.ts` for normalization
          const base = tok.replace(/^handlers\//, "").replace(/\.ts$/, "");
          direct.add(base);
        }
      }
    }
  }
  return direct;
}

/**
 * From a directory of registered hook entry-point files, scan each file
 * for `handlers/Name` substring references and return the set of handler
 * basenames each one imports. This is the (b) 1-hop transitive limb.
 */
function extractTransitivelyImportedHandlers(
  hooksRoot: string,
  registeredHookFiles: Set<string>,
): Set<string> {
  const transitive = new Set<string>();
  for (const hookFile of registeredHookFiles) {
    const hookPath = join(hooksRoot, hookFile);
    if (!existsSync(hookPath)) continue;
    let content: string;
    try {
      content = readFileSync(hookPath, "utf-8");
    } catch {
      continue;
    }
    // Match every `handlers/Name` reference. Captures the handler basename
    // (without .ts). Accepts: `./handlers/Foo`, `'./handlers/Foo'`,
    // `from './handlers/Foo'`, `handlers/Foo.ts` etc.
    const re = /handlers\/([A-Za-z0-9_\-]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const name = m[1];
      if (!name) continue;
      // Skip `_inactive` — it's a subdir name, not a handler basename.
      if (name === "_inactive") continue;
      transitive.add(name);
    }
  }
  return transitive;
}

export async function r58HandlerRegisteredOrInactive(
  ctx: CheckContext,
): Promise<CheckResult> {
  const handlersDir = join(ctx.hooksRoot, "handlers");
  const settingsPath = ctx.settingsPath ?? join(dirname(ctx.hooksRoot), "settings.json");

  if (!existsSync(handlersDir)) {
    return {
      rId: "R58",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`handlers/ not found at ${handlersDir}`],
    };
  }

  if (!existsSync(settingsPath)) {
    return {
      rId: "R58",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`settings.json not found at ${settingsPath} — cannot determine registration`],
    };
  }

  let settings: Settings;
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf-8")) as Settings;
  } catch (err) {
    return {
      rId: "R58",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `${settingsPath}: invalid JSON — ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  // Walk top-level handlers/*.ts only — _inactive/ and any other subdir
  // is structurally excluded per convention.
  let entries: string[];
  try {
    entries = readdirSync(handlersDir);
  } catch (err) {
    return {
      rId: "R58",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `${handlersDir} unreadable: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  const handlerFiles: string[] = [];
  for (const ent of entries) {
    const p = join(handlersDir, ent);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (!s.isFile()) continue;
    if (!ent.endsWith(".ts")) continue;
    // Skip test files — convention puts tests in a sibling dir, but be defensive
    if (ent.endsWith(".test.ts")) continue;
    handlerFiles.push(ent);
  }

  if (handlerFiles.length === 0) {
    return {
      rId: "R58",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [`${handlersDir}: no top-level handler .ts files to check`],
    };
  }

  const registeredHooks = extractRegisteredHookFiles(settings);
  const direct = extractDirectlyRegisteredHandlers(settings);
  const transitive = extractTransitivelyImportedHandlers(ctx.hooksRoot, registeredHooks);

  const orphans: string[] = [];
  const registered: string[] = [];
  for (const fname of handlerFiles) {
    const base = basename(fname, ".ts");
    if (direct.has(base) || transitive.has(base)) {
      registered.push(fname);
    } else {
      orphans.push(fname);
    }
  }

  if (orphans.length === 0) {
    return {
      rId: "R58",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [
        `${handlersDir}: ${registered.length} handler file(s) checked, all registered (${direct.size} direct + ${transitive.size} 1-hop transitive importable from ${registeredHooks.size} registered hook entry-point(s))`,
      ],
    };
  }

  return {
    rId: "R58",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [
      `${orphans.length} of ${handlerFiles.length} handler file(s) under ${handlersDir} are orphaned (neither directly registered in settings.json nor 1-hop transitively imported by a registered hook):`,
      ...orphans.map((f) => `  - handlers/${f}`),
      `Remediation: either register in settings.json (active) OR \`git mv\` to handlers/_inactive/ (dormant). See PRD-20260513-190458 (v0.0.15 orphan handler audit).`,
    ],
  };
}
