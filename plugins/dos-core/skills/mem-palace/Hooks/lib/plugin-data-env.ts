/**
 * MemPalace plugin runtime environment — one derivation shared by hooks, the
 * detached bridge daemon, the MCP launcher, and the bootstrap provisioner.
 *
 * A static plugin manifest can concatenate `${CLAUDE_PLUGIN_DATA}`, but it
 * cannot hash it. That matters because macOS limits AF_UNIX `sun_path` to 104
 * bytes and real Claude plugin-data paths can already approach that limit.
 * The runtime therefore derives a short, install-specific socket under /tmp
 * from the full SHA-256 of the normalized plugin-data path. All durable state
 * remains under CLAUDE_PLUGIN_DATA; only the ephemeral socket lives in /tmp.
 */
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

export const AF_UNIX_SUN_PATH_MAX_BYTES = 104;
export const PLUGIN_SOCKET_DIR = '/tmp';
export const PROVISION_MARKER_NAME = '.mempalace-python-ready';
export const PLUGIN_DOS_TOOL_ASSETS = [
  'Inference.ts',
  'TranscriptParser.ts',
  'voice-constants.ts',
] as const;

export interface PluginCodePaths {
  source: 'pack-tree' | 'root-hook-tree';
  pluginRoot: string;
  memPalaceRoot: string;
  memPalaceToolsDir: string;
  vendoredPatchesLockPath: string;
  bridgePath: string;
  daemonPath: string;
  predicateVocabularyPath: string;
  observedBridgeWorkerPath: string;
  inferencePath: string;
  transcriptParserPath: string;
  voiceConstantsPath: string;
}

/**
 * Resolve executable plugin assets from either supported copy of this helper.
 *
 * dos-core intentionally emits hook libraries in two layouts:
 *
 * - `<plugin>/hooks/lib` for ownerless root hooks
 * - `<plugin>/skills/mem-palace/Hooks/lib` for pack-owned hooks
 *
 * Both layouts can locate the same canonical MemPalace lock. Deriving every
 * other code path from that lock avoids encoding one of the two directory
 * depths into byte-identical helper files.
 */
export function resolvePluginCodePaths(
  moduleUrl: string = import.meta.url,
  exists: (path: string) => boolean = existsSync,
): PluginCodePaths {
  const thisDir = dirname(fileURLToPath(moduleUrl));
  const packTreeLockPath = join(thisDir, '..', '..', 'Tools', 'vendored-patches.lock.json');
  const rootHookLockPath = join(
    thisDir,
    '..',
    '..',
    'skills',
    'mem-palace',
    'Tools',
    'vendored-patches.lock.json',
  );
  const usePackTree = exists(packTreeLockPath);
  const vendoredPatchesLockPath = usePackTree ? packTreeLockPath : rootHookLockPath;
  const memPalaceToolsDir = dirname(vendoredPatchesLockPath);
  const memPalaceRoot = dirname(memPalaceToolsDir);
  const pluginRoot = resolve(memPalaceRoot, '..', '..');
  const dosToolsDir = join(pluginRoot, 'DOS', 'Tools');

  return {
    source: usePackTree ? 'pack-tree' : 'root-hook-tree',
    pluginRoot,
    memPalaceRoot,
    memPalaceToolsDir,
    vendoredPatchesLockPath,
    bridgePath: join(memPalaceToolsDir, 'bridge.py'),
    daemonPath: join(memPalaceToolsDir, 'bridge_daemon.py'),
    predicateVocabularyPath: join(memPalaceRoot, 'PREDICATES.md'),
    observedBridgeWorkerPath: join(pluginRoot, 'hooks', 'ObservedBridgeWorker.ts'),
    inferencePath: join(dosToolsDir, 'Inference.ts'),
    transcriptParserPath: join(dosToolsDir, 'TranscriptParser.ts'),
    voiceConstantsPath: join(dosToolsDir, 'voice-constants.ts'),
  };
}

export const PLUGIN_CODE_PATHS = resolvePluginCodePaths();
export const VENDORED_PATCHES_LOCK_PATH = PLUGIN_CODE_PATHS.vendoredPatchesLockPath;

export interface PluginEnvSeams {
  /** Palace corpus root (ChromaDB + KG sqlite). */
  MEMPALACE_DIR: string;
  /** DOS root — routes all DOS memory/state writes under plugin data. */
  DOS_DIR: string;
  /** Short, deterministic Unix socket unique to this plugin-data install. */
  MEMPALACE_DAEMON_SOCKET: string;
  /** Daemon log (the upstream default is host-scoped). */
  MEMPALACE_DAEMON_LOG: string;
  /** uv cache shared by bootstrap, daemon fallback, and MCP fallback. */
  UV_CACHE_DIR: string;
  /** Python executable inside the uv-provisioned, plugin-scoped venv. */
  MEMPALACE_PYTHON: string;
}

export type RuntimeEnv = Record<string, string | undefined>;

export interface PythonLaunch {
  cmd: string[];
  env: RuntimeEnv;
  source: 'provisioned-venv' | 'uv-on-demand';
  packageSpec: string;
}

/** True when this process runs under a Claude Code plugin install. */
export function isPluginInstall(env: RuntimeEnv = process.env): boolean {
  const value = env.CLAUDE_PLUGIN_DATA;
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Deterministic, ASCII-only socket path with a fixed 81-byte upper bound.
 * The full 256-bit digest prevents two config dirs/installations for the same
 * user from sharing a daemon accidentally.
 */
export function pluginDaemonSocketPath(pluginDataDir: string): string {
  if (pluginDataDir.includes('${CLAUDE_PLUGIN_DATA}')) {
    // Symbolic values are serialization-only. Keep the placeholder intact;
    // the runtime launcher calls this again with the concrete path and gets
    // the short hashed socket. This legacy branch prevents accidental cwd
    // expansion in emitters that still inspect the symbolic seam map.
    return join(pluginDataDir, 'dos', 'MEMORY', 'STATE', '.mempalace.sock');
  }
  const identity = resolve(pluginDataDir);
  const digest = createHash('sha256').update(identity).digest('hex');
  return join(PLUGIN_SOCKET_DIR, `dos-mp-${digest}.sock`);
}

/** Pure derivation from the authoritative Claude plugin-data directory. */
export function derivePluginEnv(pluginDataDir: string): PluginEnvSeams {
  // Do not feed a literal plugin placeholder through path.resolve(): doing so
  // bakes the emitter's cwd into generated JSON. Concrete runtime inputs are
  // normalized; symbolic inputs remain symbolic until the launcher executes.
  const normalized = pluginDataDir.includes('${CLAUDE_PLUGIN_DATA}')
    ? pluginDataDir
    : resolve(pluginDataDir);
  const dosDir = join(normalized, 'dos');
  return {
    MEMPALACE_DIR: join(normalized, 'mempalace'),
    DOS_DIR: dosDir,
    MEMPALACE_DAEMON_SOCKET: pluginDaemonSocketPath(normalized),
    MEMPALACE_DAEMON_LOG: join(dosDir, 'MEMORY', 'STATE', 'mempalace-bridge-daemon.log'),
    UV_CACHE_DIR: join(normalized, 'uv-cache'),
    MEMPALACE_PYTHON: join(normalized, 'python-env', 'bin', 'python'),
  };
}

/** Return a copy with authoritative plugin seams overlaid when applicable. */
export function pluginRuntimeEnv(env: RuntimeEnv = process.env): RuntimeEnv {
  if (!isPluginInstall(env)) return { ...env };
  return { ...env, ...derivePluginEnv(env.CLAUDE_PLUGIN_DATA!.trim()) };
}

/**
 * Apply the seams to this hook process before importing callers compute their
 * module-level DOS_DIR/MEMPALACE_DIR constants. Non-plugin mode is a no-op.
 */
export function applyPluginEnvSeams(env: RuntimeEnv = process.env): RuntimeEnv {
  if (!isPluginInstall(env)) return env;
  Object.assign(env, derivePluginEnv(env.CLAUDE_PLUGIN_DATA!.trim()));
  return env;
}

/** Strictly read the package version that the vendored-patch contract pins. */
export function readMempalacePinnedVersion(lockPath: string = VENDORED_PATCHES_LOCK_PATH): string {
  const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as { pinned_version?: unknown };
  const version = lock.pinned_version;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:[A-Za-z0-9.+-]*)?$/.test(version)) {
    throw new Error(`invalid mempalace pinned_version in ${lockPath}`);
  }
  return version;
}

export function readMempalacePackageSpec(lockPath?: string): string {
  return `mempalace==${readMempalacePinnedVersion(lockPath)}`;
}

export function pluginProvisionMarker(pluginDataDir: string): string {
  return join(resolve(pluginDataDir), PROVISION_MARKER_NAME);
}

/** Marker and interpreter must both match before direct venv execution. */
export function isProvisionedPluginPython(
  pluginDataDir: string,
  packageSpec: string,
  exists: (path: string) => boolean = existsSync,
  readText: (path: string) => string = (path) => readFileSync(path, 'utf8'),
): boolean {
  const seams = derivePluginEnv(pluginDataDir);
  if (!exists(seams.MEMPALACE_PYTHON)) return false;
  try {
    return readText(pluginProvisionMarker(pluginDataDir)).trim() === packageSpec;
  } catch {
    return false;
  }
}

/**
 * Build the Python invocation used by both the hook daemon and MCP launcher.
 * Plugin installs never fall back to bare python3: they use the exact marked
 * venv or an exact-pin `uv run` against the same plugin-scoped cache.
 */
export function buildPluginPythonLaunch(
  pythonArgs: string[],
  env: RuntimeEnv = process.env,
  options: {
    packageSpec?: string;
    exists?: (path: string) => boolean;
    readText?: (path: string) => string;
  } = {},
): PythonLaunch {
  if (!isPluginInstall(env)) {
    throw new Error('plugin Python launch requires CLAUDE_PLUGIN_DATA');
  }
  const pluginDataDir = env.CLAUDE_PLUGIN_DATA!.trim();
  const runtimeEnv = pluginRuntimeEnv(env);
  const packageSpec = options.packageSpec ?? readMempalacePackageSpec();
  const exists = options.exists ?? existsSync;
  const readText = options.readText ?? ((path: string) => readFileSync(path, 'utf8'));
  const seams = derivePluginEnv(pluginDataDir);

  if (isProvisionedPluginPython(pluginDataDir, packageSpec, exists, readText)) {
    return {
      cmd: [seams.MEMPALACE_PYTHON, ...pythonArgs],
      env: runtimeEnv,
      source: 'provisioned-venv',
      packageSpec,
    };
  }

  const localUv = join(resolve(pluginDataDir), 'bin', 'uv');
  const uv = exists(localUv) ? localUv : 'uv';
  return {
    cmd: [uv, 'run', '--no-project', '--with', packageSpec, 'python', ...pythonArgs],
    env: runtimeEnv,
    source: 'uv-on-demand',
    packageSpec,
  };
}

/** Legacy helper retained for old template-focused tests and tooling. */
export function expandPluginDataTemplate(template: string, pluginDataDir: string): string {
  return template.replaceAll('${CLAUDE_PLUGIN_DATA}', pluginDataDir);
}
