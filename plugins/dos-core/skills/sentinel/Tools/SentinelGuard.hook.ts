#!/usr/bin/env bun
/**
 * SentinelGuard Hook — PostToolUse lightweight convention check
 *
 * Event: PostToolUse (fires after Write/Edit)
 * Speed: <2 seconds, NO inference
 * Behavior: Regex-based checks from .sentinel/conventions.json
 * Non-blocking: warnings only, never prevents work
 *
 * This hook is OPTIONAL — Sentinel works without it. Power users can enable it
 * via INSTALL.md for real-time convention feedback.
 */

import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";

interface HookInput {
  tool_name: string;
  tool_input: {
    file_path?: string;
    command?: string;
  };
  tool_output?: string;
}

interface ConventionRule {
  id: string;
  category: string;
  pattern: string;
  regex?: string;
  negative_regex?: string;
  applies_to: string[];
  scope: string;
  confidence: number;
}

interface ConventionCache {
  version: number;
  generated: string;
  project: string;
  conventions: ConventionRule[];
}

// Read hook input from stdin
const input: HookInput = await Bun.stdin.json();

// Only check Write and Edit tool calls
if (input.tool_name !== "Write" && input.tool_name !== "Edit") {
  process.exit(0);
}

const filePath = input.tool_input?.file_path;
if (!filePath) process.exit(0);

// Find .sentinel/conventions.json by walking up from the file
function findConventionCache(startPath: string): string | null {
  let dir = resolve(startPath, "..");
  for (let i = 0; i < 10; i++) {
    const cachePath = join(dir, ".sentinel", "conventions.json");
    if (existsSync(cachePath)) return cachePath;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const cachePath = findConventionCache(filePath);
if (!cachePath) process.exit(0); // No cache = Sentinel not initialized for this repo

// Load cache
let cache: ConventionCache;
try {
  cache = JSON.parse(readFileSync(cachePath, "utf-8"));
} catch {
  process.exit(0); // Invalid cache, skip silently
}

// Check file against applicable conventions
const fileName = filePath.split("/").pop() || "";
const warnings: string[] = [];

// Read the file content if it exists
let fileContent = "";
try {
  if (existsSync(filePath)) {
    fileContent = readFileSync(filePath, "utf-8");
  }
} catch {
  process.exit(0);
}

for (const rule of cache.conventions) {
  // Check if this rule applies to this file type. endsWith (not extname equality)
  // so multi-segment patterns like "*.test.ts" match — MUST stay in lockstep with
  // sweepApplies in SentinelScan.ts (the scan-time sweep): divergent matchers give
  // contradictory verdicts on the same conventions.json rule.
  const applies = rule.applies_to.some((pattern) => {
    if (pattern.startsWith("*")) return fileName.endsWith(pattern.slice(1));
    return fileName === pattern;
  });

  if (!applies) continue;

  // Check negative regex (patterns that should NOT appear)
  if (rule.negative_regex && fileContent) {
    try {
      const negRegex = new RegExp(rule.negative_regex, "m");
      if (negRegex.test(fileContent)) {
        warnings.push(`[${rule.category.toUpperCase()}] ${rule.pattern} (${rule.id})`);
      }
    } catch {
      // Invalid regex, skip
    }
  }
}

if (warnings.length > 0) {
  // Output warnings to stderr (non-blocking, informational)
  const output = [
    `Sentinel: ${warnings.length} convention warning(s) in ${fileName}:`,
    ...warnings.map((w) => `  - ${w}`),
  ].join("\n");

  console.error(output);
}

// Always exit 0 — non-blocking
process.exit(0);
