#!/usr/bin/env bun
/**
 * ============================================================================
 * INFERENCE - Unified inference tool with three run levels
 * ============================================================================
 *
 * PURPOSE:
 * Single inference tool with configurable speed/capability trade-offs:
 * - Fast: Haiku - quick tasks, simple generation, basic classification
 * - Standard: Sonnet - balanced reasoning, typical analysis
 * - Smart: Opus - deep reasoning, strategic decisions, complex analysis
 *
 * USAGE:
 *   bun Inference.ts --level fast <system_prompt> <user_prompt>
 *   bun Inference.ts --level standard <system_prompt> <user_prompt>
 *   bun Inference.ts --level smart <system_prompt> <user_prompt>
 *   bun Inference.ts --json --level fast <system_prompt> <user_prompt>
 *
 * OPTIONS:
 *   --level <fast|standard|smart>  Run level (default: standard)
 *   --json                         Expect and parse JSON response
 *   --timeout <ms>                 Custom timeout (default varies by level)
 *
 * DEFAULTS BY LEVEL:
 *   fast:     model=haiku,   timeout=15s
 *   standard: model=sonnet,  timeout=30s
 *   smart:    model=opus,    timeout=90s
 *
 * BILLING: Uses Claude CLI with subscription (not API key)
 *
 * ============================================================================
 */

import { spawn } from "child_process";

export type InferenceLevel = 'fast' | 'standard' | 'smart';

export interface InferenceOptions {
  systemPrompt: string;
  userPrompt: string;
  level?: InferenceLevel;
  expectJson?: boolean;
  timeout?: number;
}

export interface InferenceResult {
  success: boolean;
  output: string;
  parsed?: unknown;
  error?: string;
  latencyMs: number;
  level: InferenceLevel;
}

// Level configurations
const LEVEL_CONFIG: Record<InferenceLevel, { model: string; defaultTimeout: number }> = {
  fast: { model: 'haiku', defaultTimeout: 15000 },
  standard: { model: 'sonnet', defaultTimeout: 30000 },
  smart: { model: 'opus', defaultTimeout: 90000 },
};

/**
 * Extract the first balanced JSON value (object or array) from arbitrary LLM
 * output. Starts at the earliest `{`/`[`, then scans string-aware with a depth
 * counter so it returns exactly the JSON span — even when trailing prose (or a
 * `{{var}}` mustache token) contains stray braces. Returns `null` when no
 * opening bracket is present. Replaces the prior greedy `/\{[\s\S]*\}/` which
 * captured from the first `{` to the LAST `}` and broke on "JSON + prose".
 */
export function extractBalancedJson(output: string): string | null {
  const objIdx = output.indexOf('{');
  const arrIdx = output.indexOf('[');
  if (objIdx === -1 && arrIdx === -1) return null;
  let startIdx: number;
  let open: string;
  let close: string;
  if (arrIdx !== -1 && (objIdx === -1 || arrIdx < objIdx)) {
    startIdx = arrIdx; open = '['; close = ']';
  } else {
    startIdx = objIdx; open = '{'; close = '}';
  }
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = startIdx; i < output.length; i++) {
    const ch = output[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return output.slice(startIdx, i + 1);
    }
  }
  return null;
}

/**
 * Run inference with configurable level
 */
export async function inference(options: InferenceOptions): Promise<InferenceResult> {
  const level = options.level || 'standard';
  const config = LEVEL_CONFIG[level];
  const startTime = Date.now();
  const timeout = options.timeout || config.defaultTimeout;

  return new Promise((resolve) => {
    // Build environment WITHOUT ANTHROPIC_API_KEY to force subscription auth
    // Also unset CLAUDECODE so nested `claude` invocations don't trigger the
    // nested-session guard (hooks run inside Claude Code's environment).
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    delete env.CLAUDECODE;

    const args = [
      '--print',
      '--model', config.model,
      '--tools', '',  // Disable tools for faster response
      '--output-format', 'text',
      '--setting-sources', '',  // Disable hooks to prevent recursion
      '--system-prompt', options.systemPrompt,
    ];

    let stdout = '';
    let stderr = '';

    const proc = spawn('claude', args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Write prompt via stdin to avoid ARG_MAX limits on large inputs.
    // stdio:['pipe',...] above guarantees stdin/stdout/stderr are non-null
    // at runtime; the non-null assertions honor that invariant for TS.
    proc.stdin!.write(options.userPrompt);
    proc.stdin!.end();

    proc.stdout!.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr!.on('data', (data) => {
      stderr += data.toString();
    });

    // Handle timeout
    const timeoutId = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve({
        success: false,
        output: '',
        error: `Timeout after ${timeout}ms`,
        latencyMs: Date.now() - startTime,
        level,
      });
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (code !== 0) {
        resolve({
          success: false,
          output: stdout,
          error: stderr || `Process exited with code ${code}`,
          latencyMs,
          level,
        });
        return;
      }

      const output = stdout.trim();

      // Parse JSON if requested
      if (options.expectJson) {
        // First try the whole trimmed output (the common clean-JSON case),
        // then fall back to a balanced-brace scan that returns the JSON span
        // even when the model emits valid JSON followed by prose containing
        // stray braces (e.g. "{...}. Use {{var}} next.").
        for (const candidate of [output, extractBalancedJson(output)]) {
          if (!candidate) continue;
          try {
            const parsed = JSON.parse(candidate);
            resolve({
              success: true,
              output,
              parsed,
              latencyMs,
              level,
            });
            return;
          } catch { /* try next candidate */ }
        }
        resolve({
          success: false,
          output,
          error: 'Failed to parse JSON response',
          latencyMs,
          level,
        });
        return;
      }

      resolve({
        success: true,
        output,
        latencyMs,
        level,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        output: '',
        error: err.message,
        latencyMs: Date.now() - startTime,
        level,
      });
    });
  });
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse flags
  let expectJson = false;
  let timeout: number | undefined;
  let level: InferenceLevel = 'standard';
  const positionalArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') {
      expectJson = true;
    } else if (args[i] === '--level' && args[i + 1]) {
      const requestedLevel = args[i + 1].toLowerCase();
      if (['fast', 'standard', 'smart'].includes(requestedLevel)) {
        level = requestedLevel as InferenceLevel;
      } else {
        console.error(`Invalid level: ${args[i + 1]}. Use fast, standard, or smart.`);
        process.exit(1);
      }
      i++;
    } else if (args[i] === '--timeout' && args[i + 1]) {
      timeout = parseInt(args[i + 1], 10);
      i++;
    } else {
      positionalArgs.push(args[i]);
    }
  }

  if (positionalArgs.length < 2) {
    console.error('Usage: bun Inference.ts [--level fast|standard|smart] [--json] [--timeout <ms>] <system_prompt> <user_prompt>');
    process.exit(1);
  }

  const [systemPrompt, userPrompt] = positionalArgs;

  const result = await inference({
    systemPrompt,
    userPrompt,
    level,
    expectJson,
    timeout,
  });

  if (result.success) {
    if (expectJson && result.parsed) {
      console.log(JSON.stringify(result.parsed));
    } else {
      console.log(result.output);
    }
  } else {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main().catch(console.error);
}
