#!/usr/bin/env bun
/**
 * Runtime MCP launcher for plugin installs.
 *
 * Static plugin JSON cannot hash `${CLAUDE_PLUGIN_DATA}`, so it cannot safely
 * express an install-unique AF_UNIX socket under macOS's 104-byte limit. This
 * launcher derives the exact same runtime seams as hook-spawned MemPalace,
 * then starts the MCP server from the exact pinned, uv-provisioned environment.
 */
import {
  derivePluginEnv,
  isProvisionedPluginPython,
  isPluginInstall,
  pluginRuntimeEnv,
  readMempalacePackageSpec,
  type RuntimeEnv,
} from './lib/plugin-data-env';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export const DEFAULT_MCP_BOOTSTRAP_TIMEOUT_MS = 60_000;
export const MAX_MCP_BOOTSTRAP_TIMEOUT_MS = 120_000;
export const DEFAULT_MCP_BOOTSTRAP_POLL_MS = 100;
export const MAX_MCP_BOOTSTRAP_POLL_MS = 1_000;

const BOOTSTRAP_HOOK_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  'PluginEnvBootstrap.hook.ts',
);

export interface McpReadinessResult {
  state: 'already-ready' | 'became-ready';
  waitedMs: number;
  packageSpec: string;
}

export interface McpReadinessOptions {
  timeoutMs?: number;
  pollMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  isReady?: (pluginDataDir: string, packageSpec: string) => boolean;
  startBootstrap?: (env: RuntimeEnv) => void | Promise<void>;
}

export interface PluginBootstrapLaunch {
  cmd: [string, string];
  env: RuntimeEnv;
}

function boundedMs(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(value!)));
}

function envMs(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Start the same marker-gated bootstrap the SessionStart hook uses.
 *
 * The hook immediately detaches its atomic-lock provisioner. Starting another
 * copy is therefore safe when SessionStart already won the race: the second
 * provisioner exits at the shared mkdir lock while this launcher waits for the
 * exact marker. process.execPath keeps the launcher independent of PATH.
 */
export function buildPluginBootstrapLaunch(
  env: RuntimeEnv = process.env,
): PluginBootstrapLaunch {
  return { cmd: [process.execPath, BOOTSTRAP_HOOK_PATH], env };
}

export function startPluginBootstrap(env: RuntimeEnv = process.env): void {
  const launch = buildPluginBootstrapLaunch(env);
  const child = Bun.spawn(launch.cmd, {
    stdin: 'ignore',
    stdout: 'ignore',
    stderr: 'inherit',
    env: launch.env,
  });
  child.unref();
}

/**
 * Ensure the MCP server's exact pinned interpreter exists before launch.
 *
 * This is intentionally deadline-bounded. A failed/offline provision never
 * turns into an unbounded MCP startup and never falls through to a host-global
 * `uv`; the caller receives a diagnostic pointing at the provision log.
 */
export async function ensureMcpPythonReady(
  env: RuntimeEnv = process.env,
  options: McpReadinessOptions = {},
): Promise<McpReadinessResult> {
  if (!isPluginInstall(env)) {
    throw new Error('MemPalaceMcpLauncher requires CLAUDE_PLUGIN_DATA');
  }

  const pluginDataDir = env.CLAUDE_PLUGIN_DATA!.trim();
  const packageSpec = readMempalacePackageSpec();
  const timeoutMs = boundedMs(
    options.timeoutMs ?? envMs(env.DOS_MCP_BOOTSTRAP_TIMEOUT_MS),
    DEFAULT_MCP_BOOTSTRAP_TIMEOUT_MS,
    1,
    MAX_MCP_BOOTSTRAP_TIMEOUT_MS,
  );
  const pollMs = boundedMs(
    options.pollMs ?? envMs(env.DOS_MCP_BOOTSTRAP_POLL_MS),
    DEFAULT_MCP_BOOTSTRAP_POLL_MS,
    1,
    MAX_MCP_BOOTSTRAP_POLL_MS,
  );
  const now = options.now ?? Date.now;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const isReady = options.isReady ?? isProvisionedPluginPython;
  const startBootstrap = options.startBootstrap ?? startPluginBootstrap;

  if (isReady(pluginDataDir, packageSpec)) {
    return { state: 'already-ready', waitedMs: 0, packageSpec };
  }

  await startBootstrap(env);
  const startedAt = now();
  const deadline = startedAt + timeoutMs;

  while (true) {
    if (isReady(pluginDataDir, packageSpec)) {
      return {
        state: 'became-ready',
        waitedMs: Math.max(0, now() - startedAt),
        packageSpec,
      };
    }

    const remainingMs = deadline - now();
    if (remainingMs <= 0) break;
    await sleep(Math.min(pollMs, remainingMs));
  }

  const provisionLog = join(pluginDataDir, 'bootstrap-provision.log');
  throw new Error(
    `MemPalace Python environment was not ready after ${timeoutMs}ms; ` +
      `see ${provisionLog}`,
  );
}

export function buildMcpLaunch(env: RuntimeEnv = process.env) {
  if (!isPluginInstall(env)) {
    throw new Error('MemPalaceMcpLauncher requires CLAUDE_PLUGIN_DATA');
  }
  const pluginDataDir = env.CLAUDE_PLUGIN_DATA!.trim();
  const seams = derivePluginEnv(pluginDataDir);
  return {
    cmd: [seams.MEMPALACE_PYTHON, '-m', 'mempalace.mcp_server'],
    env: pluginRuntimeEnv(env),
    source: 'provisioned-venv' as const,
    packageSpec: readMempalacePackageSpec(),
  };
}

async function main(): Promise<void> {
  const launch = buildMcpLaunch(process.env);
  if (process.env.DOS_MCP_LAUNCHER_DRY_RUN === '1') {
    process.stdout.write(JSON.stringify(launch) + '\n');
    return;
  }

  await ensureMcpPythonReady(process.env);

  const child = Bun.spawn(launch.cmd, {
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
    env: launch.env,
  });

  const forward = (signal: NodeJS.Signals) => {
    try {
      child.kill(signal);
    } catch {
      /* child already exited */
    }
  };
  process.once('SIGINT', () => forward('SIGINT'));
  process.once('SIGTERM', () => forward('SIGTERM'));

  const exitCode = await child.exited;
  process.exit(exitCode);
}

if (import.meta.main) {
  main().catch((error) => {
    process.stderr.write(`[mempalace] MCP launcher failed: ${String(error)}\n`);
    process.exit(1);
  });
}
