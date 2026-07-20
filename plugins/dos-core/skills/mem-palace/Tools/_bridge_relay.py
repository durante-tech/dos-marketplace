#!/usr/bin/env python3
"""Daemon-first relay for the bridge CLI (G1 / dos#356).

Why this module exists
----------------------
`python3 bridge.py <action>` historically ALWAYS dispatched locally, opening
its own ChromaDB PersistentClient. When the RFC-0075 daemon is live, that
second concurrent open is the exact contention that deadlocks Chroma's rust
core (pthread_cond_wait) and wedges the serial daemon. Sage Fix #1
(2026-06-30) shipped the read-side guard in the TS shim
(hooks/lib/mempalace.ts) — the Python CLI never got it. dos#356 found eight
orphaned `bridge.py search` processes 24-28h old, each holding a read-write
chroma.sqlite3 handle, sustaining a warm-cache invalidation loop on the
daemon: 159 invalidations in 3.7h, p99 latency 20.3s (> the TS 12s read
budget) → relay-miss → cold-spawn suppression → `vector_ok=false` and
confident-empty recall for every session on the host.

Policy (mirror of hooks/lib/mempalace.ts tryDaemonRelay + Fix #1)
-----------------------------------------------------------------
1. If the daemon socket exists → send the action over the socket (same JSON
   line-protocol as the TS relay). The daemon dispatches through the same
   ACTIONS table, so the payload is identical to local dispatch
   (RFC-0075 ISC-2).
2. On relay miss (connect failure / timeout / non-JSON / `daemon_stopping`
   drain envelope) while the socket file is PRESENT:
     - READ action  → fail fast with a degraded JSON envelope; do NOT
       cold-open a second ChromaDB handle (concurrency-safety).
     - WRITE action → fall through to local dispatch (writes must complete;
       the cross-process palace write-lock serializes them).
3. Socket absent → local dispatch (daemon truly down; the cold path is the
   documented fallback, RFC-0075 ISC-A.4).

Escape hatches
--------------
- ``DOS_BRIDGE_FORCE_COLD=1``   → skip relay + guard entirely (operator
  diagnostics; accepts the concurrent-open risk explicitly).
- ``DOS_BRIDGE_EMIT=ts``        → the TS wrapper spawned this CLI as its own
  cold fallback and already ran the relay-or-suppress policy; go local.
- ``MEMPALACE_DIR`` set to a non-default palace → ALWAYS local. The daemon
  serves whatever store it was spawned with (unknowable from the client
  without a handshake), so relaying a custom-store call could read/write the
  WRONG palace (the probe-isolation leak class). If ``MEMPALACE_DAEMON_SOCKET``
  is ALSO set, that combination is flagged as a conflict — local dispatch with
  a stderr note (review #4, dos#369) — never trusted.
- ``MEMPALACE_DAEMON_SOCKET``   → socket path override (tests; only honored
  for the default palace).
- ``MEMPALACE_RELAY_TIMEOUT_MS`` → relay wait override (same env the TS relay
  client honors).

Stdlib-only by design: importable without chromadb/mempalace so tests and
callers never pay (or risk) a palace open to make a routing decision.
"""

import json
import os
import socket
import sys

# PRD-B: the mutating-action universe lives in ONE fixture —
# hooks/lib/fixtures/bridge-write-actions.json (pack layout:
# Hooks/lib/fixtures/) — which the TS consumers import directly. This relay is
# the wedged-daemon DATA-INTEGRITY path, so it loads the fixture with a baked
# fallback: a missing/corrupt fixture must never break a write. The fallback
# is pinned byte-equal to the fixture by tests/test_write_actions_fixture.py —
# drift fails the suite, not the write path. A write must complete even when
# the daemon is wedged; reads degrade to an explicit miss envelope instead of
# a second ChromaDB open.
_WRITE_ACTIONS_FALLBACK = frozenset({
    "add_drawer", "upsert_drawer", "update_drawer", "delete_drawer",
    "add_kg_fact", "invalidate", "update_entity", "merge_entities",
    "mine_file", "mine_dir", "mine_convos", "reconcile",
    "build_closets", "rebuild_closets", "backfill_closets",
    "append_reflection", "create_tunnel", "delete_tunnel", "batch",
})


def _load_write_actions_fixture() -> frozenset:
    """Dual-layout fixture resolution (install: DOS/Tools ../../hooks/lib;
    pack: Tools ../Hooks/lib). Guarded — any failure returns the pinned
    fallback so the relay write path never depends on the fixture file."""
    import json as _json
    _here = os.path.dirname(os.path.abspath(__file__))
    for _cand in (
        os.path.join(_here, "..", "..", "hooks", "lib", "fixtures",
                     "bridge-write-actions.json"),
        os.path.join(_here, "..", "Hooks", "lib", "fixtures",
                     "bridge-write-actions.json"),
    ):
        try:
            with open(_cand) as _f:
                _acts = _json.load(_f)["write_actions"]
            if _acts:
                return frozenset(_acts)
        except Exception:
            continue
    return _WRITE_ACTIONS_FALLBACK


WRITE_ACTIONS = _load_write_actions_fixture()

# Review #3 (dos#369): the read relay wait must sit UNDER both budgets it
# lives inside — the TS shim's 12s search budget (PER_ACTION_TIMEOUT_MS in
# hooks/lib/mempalace.ts) this policy mirrors, and dos-memory-status's own
# 15s execFileSync around the CLI. At 10s the caller always sees OUR
# deliberate suppression envelope, never a raced client-side kill.
_DEFAULT_READ_TIMEOUT_MS = 10_000
_DEFAULT_WRITE_TIMEOUT_MS = 30_000
_MAX_RESPONSE_BYTES = 32 * 1024 * 1024  # hard cap so a runaway peer can't OOM us


def _resolve_dos_dir(env=None) -> str:
    env = os.environ if env is None else env
    return env.get("DOS_DIR", os.path.expanduser("~/.claude"))


def resolve_socket_path(env=None) -> str:
    """Same resolution as mempalace_daemon._resolve_socket_path."""
    env = os.environ if env is None else env
    override = env.get("MEMPALACE_DAEMON_SOCKET")
    if override:
        return override
    return os.path.join(_resolve_dos_dir(env), "MEMORY", "STATE", ".mempalace.sock")


def _is_default_palace(env) -> bool:
    raw = env.get("MEMPALACE_DIR")
    if not raw:
        return True
    default = os.path.realpath(os.path.expanduser("~/.mempalace"))
    return os.path.realpath(os.path.expanduser(raw)) == default


def relay_decision(action: str, known_action: bool, env=None) -> tuple:
    """Pure routing decision → ('relay' | 'local', reason). No I/O beyond
    an existsSync-equivalent stat on the socket path (mirrors relayCanRoute)."""
    env = os.environ if env is None else env
    if env.get("DOS_BRIDGE_FORCE_COLD") == "1":
        return ("local", "force-cold")
    if env.get("DOS_BRIDGE_EMIT") == "ts":
        return ("local", "ts-wrapper-owns-relay")
    if not known_action:
        return ("local", "unknown-action")
    if not _is_default_palace(env):
        # Review #4 (dos#369): NEVER relay a custom-store call — the daemon
        # serves whatever palace it was spawned with (unknowable from here
        # without a handshake), so relaying could read/write the WRONG store.
        # An explicit MEMPALACE_DAEMON_SOCKET alongside a custom MEMPALACE_DIR
        # is flagged as a conflict (run_relay_first emits a stderr note)
        # rather than trusted; local dispatch preserves probe isolation.
        if env.get("MEMPALACE_DAEMON_SOCKET"):
            return ("local", "custom-palace-socket-conflict")
        return ("local", "custom-palace")
    if not os.path.exists(resolve_socket_path(env)):
        return ("local", "socket-absent")
    return ("relay", "socket-present")


def _relay_timeout_s(action: str, env) -> float:
    raw = env.get("MEMPALACE_RELAY_TIMEOUT_MS")
    if raw:
        try:
            return max(0.05, float(raw) / 1000.0)
        except ValueError:
            pass
    default_ms = (_DEFAULT_WRITE_TIMEOUT_MS if action in WRITE_ACTIONS
                  else _DEFAULT_READ_TIMEOUT_MS)
    return default_ms / 1000.0


def relay_request(socket_path: str, action: str, args: dict, timeout_s: float):
    """One request over the daemon socket. Returns the parsed dict, or None on
    any miss (connect failure, timeout, oversize, non-JSON, drain envelope)."""
    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as sock:
            sock.settimeout(timeout_s)
            sock.connect(socket_path)
            sock.sendall((json.dumps({"action": action, "args": args})
                          + "\n").encode("utf-8"))
            buf = b""
            while not buf.endswith(b"\n"):
                chunk = sock.recv(65536)
                if not chunk:
                    break
                buf += chunk
                if len(buf) > _MAX_RESPONSE_BYTES:
                    return None
        text = buf.decode("utf-8", errors="replace").strip()
        if not text or not (text.startswith("{") or text.startswith("[")):
            return None
        # W1-S1: a draining daemon answers queued requests with a
        # daemon_stopping envelope instead of dispatching — treat as a miss
        # (mirror of relayOutputOrNull in hooks/lib/mempalace.ts).
        if '"daemon_stopping"' in text:
            return None
        return json.loads(text)
    except (OSError, ValueError):
        return None


def suppression_envelope(action: str) -> dict:
    """The read-side fail-fast payload. Message string deliberately matches the
    TS shim's reason so radiators/log greps see ONE vocabulary for this state."""
    return {
        "isError": True,
        "content": [{
            "type": "text",
            "text": (
                f"daemon-relay-miss: the bridge daemon socket is live but did not "
                f"answer '{action}' in time. Cold-spawn suppressed (read, "
                f"concurrency-safety): opening a second ChromaDB handle beside a "
                f"busy daemon is the concurrent-open deadlock class (dos#356). "
                f"Retry shortly, or set DOS_BRIDGE_FORCE_COLD=1 to accept the "
                f"risk explicitly."
            ),
        }],
        "status": "error",
        "error_type": "daemon_relay_miss",
        "message": "daemon-relay-miss: cold-spawn suppressed (read, concurrency-safety)",
        "action": action,
    }


def run_relay_first(action: str, args: dict, known_action: bool = True,
                    env=None):
    """Daemon-first dispatch attempt for the CLI entry-point.

    Returns:
      (payload, "daemon-relay")      — daemon answered; print payload, done.
      (payload, "daemon-relay-miss") — READ suppressed on miss; print payload.
      None                           — caller must dispatch locally (cold).
    """
    env = os.environ if env is None else env
    decision, reason = relay_decision(action, known_action, env)
    if decision != "relay":
        if reason == "custom-palace-socket-conflict":
            # Review #4: loud local fallback — silent wrong-store relaying is
            # the probe-isolation leak class; silent ignoring of an explicit
            # socket override would be equally surprising. Say why.
            sys.stderr.write(
                "[mempalace-relay] MEMPALACE_DAEMON_SOCKET ignored: "
                "MEMPALACE_DIR points at a non-default palace and the daemon "
                "behind the socket cannot be verified to serve it — "
                "dispatching locally against MEMPALACE_DIR "
                "(custom-palace-socket-conflict).\n")
        return None
    result = relay_request(resolve_socket_path(env), action, args or {},
                           _relay_timeout_s(action, env))
    if result is not None:
        return (result, "daemon-relay")
    if action in WRITE_ACTIONS:
        return None  # writes must complete — local fallback keeps them alive
    return (suppression_envelope(action), "daemon-relay-miss")
