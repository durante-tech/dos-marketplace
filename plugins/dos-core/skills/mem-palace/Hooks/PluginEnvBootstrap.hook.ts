#!/usr/bin/env bun
/**
 * PluginEnvBootstrap.hook.ts — V23-W2-S3 Python-env bootstrap (SessionStart).
 *
 * Under a Claude Code *plugin install* (`CLAUDE_PLUGIN_DATA` set), this hook:
 *   1. derives the plugin-scoped env seams via lib/plugin-data-env.ts — the
 *      SAME derivation the plugin MCP template (MCP/mempalace.plugin.mcp.json)
 *      carries, so the hook and the MCP server resolve the SAME palace path
 *      (W2-S6 acceptance, parity-locked by the colocated test);
 *   2. creates the plugin-data directories (palace corpus, DOS_DIR/MEMORY/STATE,
 *      uv cache) and writes a `plugin-env.json` manifest for debuggability;
 *   3. provisions the exact vendored-patches.lock MemPalace version into a
 *      plugin-scoped uv venv — DETACHED, in the background, so session start
 *      is never blocked. A versioned marker makes matching re-runs no-ops.
 *
 * When NOT under a plugin install (operator/maintainer mode, CLAUDE_PLUGIN_DATA
 * unset), exits 0 silently — the maintainer topology (~/.mempalace + ~/.claude)
 * is untouched.
 *
 * FAIL-OPEN (blueprint §10.6, posthog pattern): every path exits 0; a bootstrap
 * error must never brick a customer session. Registered in the plugin's
 * hooks.json with the portable root form `${CLAUDE_PLUGIN_ROOT:-$PLUGIN_ROOT}`.
 *
 * Reference impl: carta-investors scripts/hooks/init-data-dir.js (SessionStart
 * mkdir into ${CLAUDE_PLUGIN_DATA} + prune, /tmp-tolerant, always exit 0).
 *
 * Env switches:
 *   DOS_PLUGIN_BOOTSTRAP_PROVISION=0  → skip the uv/chromadb provisioner
 *                                       (dirs + manifest still written; used by
 *                                       tests to stay offline/hermetic)
 */
// SELF-CONTAINED BY DESIGN: no ./lib/hook-io import — its timing telemetry
// transitively requires the live-install layout (../../DOS/Tools/...), which
// does not exist under a plugin root or when running from pack source. A
// plugin-mode hook must carry zero live-layout assumptions.
import { mkdirSync, openSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

try {
  const {
    isPluginInstall,
    derivePluginEnv,
    isProvisionedPluginPython,
    pluginProvisionMarker,
    readMempalacePackageSpec,
  } = await import('./lib/plugin-data-env');

  if (!isPluginInstall()) {
    // Operator/maintainer mode — not a plugin install. Silent no-op.
    process.exit(0);
  }

  const dataDir = process.env.CLAUDE_PLUGIN_DATA!.trim();
  const seams = derivePluginEnv(dataDir);
  const packageSpec = readMempalacePackageSpec();

  // ── 2. plugin-data directories + debug manifest (idempotent) ─────────────
  mkdirSync(seams.MEMPALACE_DIR, { recursive: true });
  // The short socket lives under /tmp, while durable daemon state/logs stay
  // under plugin data. Create both parents explicitly; deriving the state
  // directory from the socket stopped being valid once F7 moved the socket.
  mkdirSync(dirname(seams.MEMPALACE_DAEMON_SOCKET), { recursive: true });
  mkdirSync(dirname(seams.MEMPALACE_DAEMON_LOG), { recursive: true });
  mkdirSync(seams.UV_CACHE_DIR, { recursive: true });

  const manifestPath = join(dataDir, 'plugin-env.json');
  const manifest = JSON.stringify({ v: 2, seams, with_spec: packageSpec }, null, 2) + '\n';
  let prior = '';
  try {
    prior = readFileSync(manifestPath, 'utf-8');
  } catch {
    /* first run */
  }
  if (prior !== manifest) writeFileSync(manifestPath, manifest);

  // ── 3. uv + chromadb provisioning (detached, marker-gated) ───────────────
  const marker = pluginProvisionMarker(dataDir);
  if (isProvisionedPluginPython(dataDir, packageSpec)) {
    console.log(`[mempalace] plugin-env bootstrap: ready (palace=${seams.MEMPALACE_DIR})`);
    process.exit(0);
  }
  if (process.env.DOS_PLUGIN_BOOTSTRAP_PROVISION === '0') {
    console.log(
      `[mempalace] plugin-env bootstrap: dirs ready, provisioning skipped (palace=${seams.MEMPALACE_DIR})`,
    );
    process.exit(0);
  }

  const uvBinDir = join(dataDir, 'bin');
  const uvInstaller = join(dataDir, '.uv-0.11.28-install.sh');
  const lockDir = join(dataDir, '.provisioning.lock');
  const provisionLog = join(dataDir, 'bootstrap-provision.log');
  // POSIX sh, no bashisms. mkdir is the atomic concurrency lock (parallel
  // sessions both hitting a cold install spawn one provisioner, not N).
  // uv resolution order: PATH → plugin-local bin → curl-install into
  // plugin-local bin (UV_NO_MODIFY_PATH keeps the customer's shell untouched).
  // The shell body receives every dynamic path through environment variables;
  // no plugin-controlled path is interpolated into shell source. uv creates a
  // stable venv whose exact package spec is also recorded in the marker.
  const script = [
    'if ! mkdir "$DOS_PROVISION_LOCK" 2>/dev/null; then exit 0; fi',
    `trap 'rm -f "$DOS_UV_INSTALLER"; rmdir "$DOS_PROVISION_LOCK" 2>/dev/null' EXIT`,
    `if ! command -v uv >/dev/null 2>&1; then`,
    `  if [ ! -x "$DOS_UV_BIN_DIR/uv" ]; then`,
    `    curl -LsSf https://astral.sh/uv/0.11.28/install.sh -o "$DOS_UV_INSTALLER" || exit 0`,
    `    if command -v shasum >/dev/null 2>&1; then`,
    `      DOS_UV_ACTUAL_SHA="$(shasum -a 256 "$DOS_UV_INSTALLER" | awk '{print $1}')"`,
    `    elif command -v sha256sum >/dev/null 2>&1; then`,
    `      DOS_UV_ACTUAL_SHA="$(sha256sum "$DOS_UV_INSTALLER" | awk '{print $1}')"`,
    `    else`,
    `      exit 0`,
    `    fi`,
    `    [ "$DOS_UV_ACTUAL_SHA" = "$DOS_UV_INSTALLER_SHA256" ] || exit 0`,
    `    UV_INSTALL_DIR="$DOS_UV_BIN_DIR" UV_NO_MODIFY_PATH=1 sh "$DOS_UV_INSTALLER" || exit 0`,
    `  fi`,
    `  PATH="$DOS_UV_BIN_DIR:$PATH"; export PATH`,
    `fi`,
    `if [ ! -x "$MEMPALACE_PYTHON" ]; then`,
    `  uv venv "$(dirname "$MEMPALACE_PYTHON")" || exit 0`,
    `fi`,
    `uv pip install --python "$MEMPALACE_PYTHON" "$MEMPALACE_PACKAGE_SPEC" || exit 0`,
    `"$MEMPALACE_PYTHON" -c 'import chromadb, mempalace' || exit 0`,
    `printf '%s\\n' "$MEMPALACE_PACKAGE_SPEC" > "$DOS_PROVISION_MARKER"`,
  ].join('\n');

  // Provisioning receives only execution/TLS/proxy locale inputs. Do not
  // leak the caller's tokens, cloud credentials, or unrelated DOS secrets to
  // curl, the downloaded installer, uv, pip, or their lifecycle children.
  const safeInheritedEnv = Object.fromEntries(
    [
      'PATH',
      'HOME',
      'TMPDIR',
      'TMP',
      'TEMP',
      'LANG',
      'LC_ALL',
      'HTTPS_PROXY',
      'HTTP_PROXY',
      'NO_PROXY',
      'SSL_CERT_FILE',
      'SSL_CERT_DIR',
      'CURL_CA_BUNDLE',
    ]
      .map((key) => [key, process.env[key]])
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );

  const logFd = openSync(provisionLog, 'a');
  const child = spawn('/bin/sh', ['-c', script], {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: {
      ...safeInheritedEnv,
      ...seams,
      DOS_PROVISION_LOCK: lockDir,
      DOS_PROVISION_MARKER: marker,
      DOS_UV_BIN_DIR: uvBinDir,
      DOS_UV_INSTALLER: uvInstaller,
      DOS_UV_INSTALLER_SHA256: 'b7b3fe80cad1142a2a5794050b7db7b3291d1bac1423b0732571dd9366e8ca8b',
      MEMPALACE_PACKAGE_SPEC: packageSpec,
    },
  });
  child.unref();

  console.log(
    `[mempalace] plugin-env bootstrap: provisioning uv+chromadb in background ` +
      `(palace=${seams.MEMPALACE_DIR}, log=${provisionLog})`,
  );
} catch (err) {
  // FAIL-OPEN: never block session start on bootstrap problems.
  try {
    process.stderr.write(`[mempalace] plugin-env bootstrap error (fail-open): ${err}\n`);
  } catch {
    /* even stderr failure must not throw */
  }
}
process.exit(0);
