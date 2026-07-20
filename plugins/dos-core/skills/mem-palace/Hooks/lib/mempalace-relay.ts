#!/usr/bin/env bun
/**
 * mempalace-relay.ts — RFC-0122 synchronous daemon relay.
 *
 * A deliberately tiny, net-only process (NO chromadb/mempalace import → ~40ms
 * cold start) that `bridgeSync` spawns synchronously when
 * `DOS_USE_BRIDGE_DAEMON=1`. It connects to the RFC-0075 daemon socket, sends
 * one `{action,args}\n` request, prints the daemon's `\n`-delimited JSON
 * response verbatim to stdout (byte-identical to the `mempalace_bridge.py`
 * subprocess path — bridge_daemon._dispatch guarantees this), and exits 0.
 *
 * On any failure (daemon down, connect refused, timeout, early close) it writes
 * a short marker to stderr and exits NON-ZERO so `bridgeSync` falls back to the
 * cold subprocess path. It must never hang or emit partial stdout on failure.
 *
 * Exit discipline: NEVER process.exit() after a stream write — under Bun a
 * piped stdout/stderr write is not flushed before process.exit(), truncating
 * the marker/response (observed 2026-07-02: empty stderr in the relay tests).
 * Instead every terminal path sets process.exitCode and tears down the only
 * keep-alive handles (socket + timeout timer) so the process exits naturally
 * with streams flushed. "Never hang" is preserved: after finish() the event
 * loop holds no handles.
 *
 * Usage: bun mempalace-relay.ts <socketPath> <action> [argsJson]
 */
import { connect } from 'net';

const [sock, action, argsJson] = process.argv.slice(2);
let args: Record<string, unknown> = {};
let usageError: { code: number; msg: string } | null = null;
if (!sock || !action) {
  usageError = { code: 64, msg: 'relay-usage: <socket> <action> [argsJson]' };
} else if (argsJson) {
  try {
    args = JSON.parse(argsJson) as Record<string, unknown>;
  } catch {
    usageError = { code: 65, msg: 'relay-bad-args-json' };
  }
}

if (usageError) {
  process.stderr.write(usageError.msg);
  process.exitCode = usageError.code;
} else {
  const TIMEOUT_MS = Number(process.env.MEMPALACE_RELAY_TIMEOUT_MS) || 30000;
  // Accumulate raw Buffers and decode ONCE at completion — decoding per-chunk
  // (`d.toString()`) corrupts a multibyte UTF-8 sequence split across two TCP
  // chunks (e.g. accented memory content) into U+FFFD. The daemon's json.dumps
  // response is single-line with exactly one trailing '\n' (the ONLY literal
  // 0x0a), so the raw last byte is a sound, framing-safe end-of-message marker.
  const chunks: Buffer[] = [];
  let done = false;
  const sockConn = connect({ path: sock });
  const timer = setTimeout(() => fail(3, 'relay-timeout'), TIMEOUT_MS);

  /** Tear down every keep-alive handle; the process then exits on its own. */
  const finish = (code: number): void => {
    done = true;
    clearTimeout(timer);
    try { sockConn.destroy(); } catch { /* ignore */ }
    process.exitCode = code;
  };

  function fail(code: number, msg: string): void {
    if (done) return;
    process.stderr.write(msg);
    finish(code);
  }

  sockConn.on('connect', () => {
    sockConn.write(JSON.stringify({ action, args }) + '\n');
  });
  sockConn.on('data', (d: Buffer) => {
    if (done) return;
    chunks.push(d);
    if (d.length > 0 && d[d.length - 1] === 0x0a) {
      process.stdout.write(Buffer.concat(chunks).toString('utf8'));
      finish(0);
    }
  });
  sockConn.on('error', (e: NodeJS.ErrnoException) => fail(2, 'relay-unreachable:' + (e?.code ?? 'ERR')));
  sockConn.on('close', () => { if (!done) fail(4, 'relay-closed-early'); });
}
