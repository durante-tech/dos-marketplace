#!/usr/bin/env bun
/**
 * mempalace-prewarm-worker.ts — RFC-0122 ISC-12 detached daemon pre-warm worker.
 *
 * Spawned (detached, unref'd) by MemPalaceDaemonPrewarm.hook.ts at SessionStart.
 * Runs OUTSIDE the hook's lifetime so the hook returns instantly and never
 * blocks session startup. Its job: trigger the one-time ~11s daemon cold-load
 * NOW (during session boot) so it is NOT paid on the user's first prompt.
 *
 * `bridgeAsyncDaemon` with autoSpawn=true does connect-or-spawn: it starts the
 * daemon if the socket is absent, then sends one cheap `search` request — that
 * request is what forces the daemon to load the onnx model + collection + KG +
 * closets (the cold tax). Once warm, the daemon serves the session's real
 * recall calls in ~50ms via the relay paths (bridgeSync/Async/Fire).
 *
 * Fully fail-open: the daemon client is dynamic-imported AFTER the flag check
 * and inside try/catch, so a missing module (pack-only install without the
 * submodule daemon client), an unreachable daemon, a spawn failure, or a
 * timeout all just mean the first real call pays the cold tax as before — no
 * worse than today, never a hard crash.
 */
export {}; // module marker — enables top-level await (no static imports here)

if (process.env.DOS_USE_BRIDGE_DAEMON !== '1') process.exit(0);

try {
  const { bridgeAsyncDaemon } = await import('./mempalace-daemon');
  // requestTimeoutMs generous — the cold load can take ~11s on first request;
  // we WANT to wait it out here (in the background) so the session's first
  // prompt finds a warm daemon. A short timeout would defeat the pre-warm.
  await bridgeAsyncDaemon(
    'search',
    { query: 'daemon prewarm', limit: 1 },
    { autoSpawn: true, requestTimeoutMs: 60_000 },
  );
} catch {
  // Fail-open: the first real recall call will cold-load instead. No-op.
}
process.exit(0);
