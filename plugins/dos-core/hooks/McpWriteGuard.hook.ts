#!/usr/bin/env bun
/**
 * McpWriteGuard.hook.ts — MCP Write Containment Gate (PreToolUse)
 *
 * Gates MCP tools that can write to the filesystem or mutate external services.
 * Validates target paths against `DOS/doc-placement-policy.json`. Required
 * because SecurityValidator's `Bash|Edit|Write|MultiEdit|Read` matchers do not
 * cover `mcp__*` tool names — MCP writes bypassed all deny/ask patterns.
 *
 * Decision semantics:
 *   - "block"  target violates deny-list or is outside filesystem roots
 *   - "ask"    skill-scoped violation (fall through to user approval)
 *   - exit 0   write is within policy; let normal permission flow continue
 *
 * Non-goal: MCP mutations without a path argument (github.merge_pull_request,
 * kit_db_reset) are gated via settings.json permissions.ask, not here.
 */

import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { readHookInput, startTimer, stopTimer } from "./lib/hook-io";
import { expandPath } from "./lib/paths";
import { emitPreToolUseDecision } from "./lib/hook-output";

const HOME = homedir();
const DOS_DIR = process.env.DOS_DIR || join(HOME, ".claude");
const POLICY_PATH = join(DOS_DIR, "DOS", "doc-placement-policy.json");

interface Policy {
  mcpFilesystemRoots?: string[];
  mcpWriteDenyPaths?: string[];
  skillWriteRoots?: Record<string, string[]>;
}

interface CachedPolicy {
  policy: Policy;
  mtimeMs: number;
}

const globCache = new Map<string, RegExp>();
let cachedPolicy: CachedPolicy | null = null;

function globToRegExp(glob: string): RegExp {
  const cached = globCache.get(glob);
  if (cached) return cached;

  const expanded = expandPath(glob);
  let re = "^";
  for (let i = 0; i < expanded.length; i += 1) {
    const c = expanded[i];
    if (c === "*") {
      if (expanded[i + 1] === "*") {
        re += ".*";
        i += 1;
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (/[.+^$(){}|\\[\]]/.test(c)) {
      re += `\\${c}`;
    } else {
      re += c;
    }
  }
  re += "$";
  const compiled = new RegExp(re);
  globCache.set(glob, compiled);
  return compiled;
}

function isInsideRoot(absTarget: string, root: string): boolean {
  const absRoot = expandPath(root).replace(/\/+$/, "");
  return absTarget === absRoot || absTarget.startsWith(`${absRoot}/`);
}

function deniedByGlob(absTarget: string, denyPaths: string[]): string | null {
  for (const pattern of denyPaths) {
    if (globToRegExp(pattern).test(absTarget)) return pattern;
  }
  return null;
}

function extractTargetPath(toolInput: Record<string, unknown> | undefined): string | null {
  if (!toolInput) return null;
  for (const key of ["path", "file_path", "destination", "dest", "target"]) {
    const v = toolInput[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

function loadPolicy(): Policy | null {
  try {
    const stat = statSync(POLICY_PATH);
    if (cachedPolicy && cachedPolicy.mtimeMs === stat.mtimeMs) {
      return cachedPolicy.policy;
    }
    const policy = JSON.parse(readFileSync(POLICY_PATH, "utf-8")) as Policy;
    cachedPolicy = { policy, mtimeMs: stat.mtimeMs };
    return policy;
  } catch {
    return null;
  }
}

function emit(kind: "block" | "ask", reason: string): never {
  // PreToolUse permission control is carried on
  // hookSpecificOutput.{permissionDecision, permissionDecisionReason}. "block"
  // maps to the `deny` permissionDecision (the only PreToolUse decision that
  // blocks the call); "ask" maps to `ask` (which actually prompts, where the
  // old top-level {decision:"ask"} never did).
  emitPreToolUseDecision(kind === "block" ? "deny" : "ask", reason);
  process.exit(0);
}

async function main(): Promise<void> {
  const input = (await readHookInput()) as unknown as
    | { tool_name?: string; tool_input?: Record<string, unknown> }
    | null;
  if (!input) process.exit(0);

  const toolName = input.tool_name ?? "";
  if (!toolName.startsWith("mcp__")) process.exit(0);

  const policy = loadPolicy();
  if (!policy) process.exit(0);

  const target = extractTargetPath(input.tool_input);
  if (!target) process.exit(0);

  // Reject relative paths — resolving against HOME would silently widen the
  // attack surface (`".ssh/id_rsa"` → `~/.ssh/id_rsa`). MCP filesystem server
  // already requires absolute paths; anything else is a protocol violation.
  const expandedTarget = expandPath(target);
  if (!expandedTarget.startsWith("/")) {
    emit(
      "block",
      `McpWriteGuard: target "${target}" is not absolute — MCP tools must supply fully-qualified paths. Refusing to resolve against $HOME.`,
    );
  }
  // Normalize `..`/`.` segments BEFORE any deny/containment check. Without this,
  // `~/Durante/../.ssh/id_rsa` passes deny-glob (literal string never matches
  // `$HOME/.ssh/**`) AND passes isInsideRoot (still string-prefixed by the
  // allowed root) — then the OS resolves the `..` and writes outside policy
  // (Forge H-043). resolve() collapses the segments so the checks see the real
  // destination; a `..` that stays inside a root (Packs/../Plans) still passes.
  const absTarget = resolve(expandedTarget);

  const denyMatch = deniedByGlob(absTarget, policy.mcpWriteDenyPaths ?? []);
  if (denyMatch) {
    emit(
      "block",
      `McpWriteGuard: target "${absTarget}" matches deny-path "${denyMatch}". See ${POLICY_PATH}.`,
    );
  }

  const roots = policy.mcpFilesystemRoots ?? [];
  if (roots.length > 0 && !roots.some((r) => isInsideRoot(absTarget, r))) {
    emit(
      "block",
      `McpWriteGuard: target "${absTarget}" is outside DOS-approved roots (${roots
        .map(expandPath)
        .join(", ")}). Update ${POLICY_PATH} → mcpFilesystemRoots if this is intentional.`,
    );
  }

  const skillName = process.env.CLAUDE_SKILL_NAME ?? "";
  const skillRoots = policy.skillWriteRoots ?? {};
  const allowed = skillRoots[skillName] ?? skillRoots._default ?? [];
  if (skillName && allowed.length > 0) {
    const insideAllowed = allowed.some((r) => {
      const asRoot = expandPath(r).replace(/\*+$/, "").replace(/\/+$/, "");
      return absTarget === asRoot || absTarget.startsWith(`${asRoot}/`);
    });
    if (!insideAllowed) {
      emit(
        "ask",
        `McpWriteGuard: skill "${skillName}" writing to "${absTarget}" outside declared roots (${allowed.join(", ")}).`,
      );
    }
  }

  process.exit(0);
}

const _t = startTimer("McpWriteGuard");
process.on("exit", () => stopTimer(_t, "PreToolUse"));
main().catch(() => process.exit(0));
