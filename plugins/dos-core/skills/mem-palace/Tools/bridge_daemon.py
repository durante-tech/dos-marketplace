#!/usr/bin/env python3
"""
MemPalace Bridge Daemon — RFC-0075 (V11.18).

Long-lived Python process that holds open ChromaDB + SQLite connections and
exposes the existing bridge action vocabulary over a Unix socket. Replaces
the per-call cold-start of `python3 mempalace_bridge.py <action>` (≈600-1500ms)
with sub-100ms socket round-trips on a warm process.

Architecture
------------
- Listens on `$DOS_DIR/MEMORY/STATE/.mempalace.sock` (override via env
  `MEMPALACE_DAEMON_SOCKET`). Always a Unix socket — no TCP, no HTTP, no
  cross-machine surface (RFC-0075 ISC-A.2).
- Single-threaded serial queue (RFC-0075 Q2 — ChromaDB + SQLite serialize at
  storage layer; threading wouldn't help). One client at a time. Concurrent
  connectors block on accept(); each request completes before next is read.
- JSON line-protocol matching the existing bridge contract:
      Request:  {"action": "search", "args": {"query": "...", "limit": 5}}\\n
      Response: {"status": "ok", ...action result...}\\n
  Errors mirror the CLI entrypoint response shape:
      {"isError": true, "content": [...], "status": "error", ...}
- Dispatch reuses the `ACTIONS` table from `bridge.py` so the daemon and
  subprocess paths return byte-identical results (RFC-0075 ISC-2).
- Caches: get_palace_collection() and get_kg() in _bridge_palace.py memoize
  at module level. Once the daemon makes the first call, every subsequent
  call reuses warmed handles. This is where the 30× speedup comes from.

Lifecycle (RFC-0075 Q1 — on-demand-spawn with idle TTL)
-------------------------------------------------------
- launchd plist `tech.durante.dos.mempalace-bridge-daemon.plist` is loaded
  with `KeepAlive=false` and `RunAtLoad=false` so the daemon is NOT started
  at boot. It is spawned on first connect by the TS shim's `connect-or-spawn`
  helper (Phase 3, hooks/lib/mempalace.ts).
- Idle TTL: if no client connects for `IDLE_TTL_SECONDS` (default 600 = 10
  min), the daemon shuts down cleanly (releases socket file, closes DB
  handles). The next bridge call respawns it.
- On SIGTERM/SIGINT: drain in-flight request, close socket, exit 0.

Fallback (RFC-0075 ISC-A.4)
---------------------------
The TS client's transparent fallback path (`bridgeAsync` / subprocess) MUST
keep working. This daemon NEVER replaces the subprocess — it short-circuits
when reachable. Hooks see no behavior change, only latency change.

Usage
-----
    python3 bridge_daemon.py [--foreground]
    python3 bridge_daemon.py --health
    python3 bridge_daemon.py --shutdown

Environment variables
---------------------
    DOS_DIR                          → defaults to ~/.claude
    MEMPALACE_DAEMON_SOCKET          → override socket path
    MEMPALACE_DAEMON_IDLE_TTL_SEC    → idle shutdown timer (default 600)
    MEMPALACE_DAEMON_LOG             → log file (default ~/Library/Logs/DOS/mempalace-bridge-daemon.log)
    MEMPALACE_DIR                    → palace root (forwarded to bridge)

V11.18 (2026-05-08): Phases 1+2+3 of RFC-0075 — daemon process, action
dispatch, status/health endpoints. Phase 4 hook migration deferred to a
follow-up agent run (large blast radius across 15+ hooks). Subprocess
fallback preserved as graceful-degradation surface — see hooks/lib/mempalace.ts
`bridgeAsyncDaemon` for the connect-or-spawn shim.

V11.18 wave 4 (2026-05-08): ISC-5/6 cache invalidation — the daemon now
detects external palace mutations from cron writers (kg-reconcile-weekly,
mine-historical-prds) and drops its module-level handles so the next
request rebuilds them. Four mutation signatures are tracked:

  1. `chroma.sqlite3` mtime change (palace data writes)
  2. `knowledge_graph.sqlite3` mtime change (KG writes)
  3. `knowledge_graph.sqlite3-wal` mtime — tracked/baselined but, per MP-035,
     deliberately EXCLUDED from the invalidation trigger set so the daemon's
     own WAL-mode KG writes don't self-invalidate the warm cache.
  4. `MEMORY/STATE/.mempalace-invalidate` marker file mtime (explicit
     invalidation — cron writers can `touch` this; daemon reacts on next
     request or on the next idle-watchdog tick).

Invalidation is structural, not file-watch — RFC-0075 Q3 recommended
file-watch but the simplest correct path is mtime polling baked into the
existing dispatch + idle-watchdog loops (zero extra threads, no inotify,
no fsevents). Cost is one os.stat per request which is sub-millisecond.

When invalidation fires, we drop the module-level handles in
`_bridge_palace` (`_CACHED_COLLECTION`, `_CACHED_KG`, `_WING_INDEX_INITIALIZED`).
The daemon process stays alive — only the cached handles are released,
so connection-pool warmup pays once per cron event, not once per request.

Closes RFC-0075 ISC-5 (palace_version mismatch triggers metadata reload
without restart) and ISC-6 (HNSW index rebuild triggers reload — same
signal because chromadb writes sqlite metadata when index rebuilds).
"""

import errno
import json
import os
import signal
import socket
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

# Make sibling modules importable (same trick bridge.py uses)
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

# chromadb settings-conflict guard (mirrors _bridge_palace.py module top): FORCE
# the telemetry default before the first lazy chromadb import so this long-lived
# process never builds two PersistentClients with divergent Settings for the same
# path (the daemon `status` "already exists ... with different settings" failure).
os.environ["ANONYMIZED_TELEMETRY"] = "False"

# W1-S2: the daemon binds its socket BEFORE its first palace open, so the
# quarantine classifier's holder probe (_bridge_palace._daemon_holder_alive)
# would always detect the daemon's OWN socket and mask the low-threshold row
# from inside the daemon. This flag tells the probe "you ARE the holder —
# there is no EXTERNAL holder to defer to" (review #4, daemon self-detection).
os.environ["MEMPALACE_IS_DAEMON"] = "1"

# MP-052: the long-lived daemon is the production palace accessor
# (DOS_USE_BRIDGE_DAEMON=1). The TS relay (hooks/lib/mempalace.ts) already
# writes the memory-events.jsonl NUMERATOR for every relayed call, so the
# daemon must NOT also emit it (double-count). DOS_BRIDGE_EMIT=ts makes the
# shared _record_bridge_action() suppress the memory-events write while still
# appending the bridge-actions.jsonl DENOMINATOR — the audit line that was
# missing for every daemon-served action.
os.environ["DOS_BRIDGE_EMIT"] = "ts"


# ─── Daemon configuration ──────────────────────────────────────────────────


def _resolve_dos_dir() -> str:
    return os.environ.get("DOS_DIR", os.path.expanduser("~/.claude"))


def _resolve_socket_path() -> str:
    """Where the daemon binds.

    Mirrors RFC-0075 §"Why Shape A specifically" — Unix socket under
    DOS_DIR/MEMORY/STATE so it co-locates with the rest of host-level
    state (DLQ, hook telemetry, etc.) and follows the project-eligible
    fallback chain when DOS_DIR is overridden in tests.

    Note: AF_UNIX paths have a hard 104-byte limit on macOS. We deliberately
    pick `.mempalace.sock` (one fewer byte than `mempalace.sock`) and place
    it under MEMORY/STATE which on a default install is well under the limit.
    """
    if "MEMPALACE_DAEMON_SOCKET" in os.environ:
        return os.environ["MEMPALACE_DAEMON_SOCKET"]
    state_dir = os.path.join(_resolve_dos_dir(), "MEMORY", "STATE")
    return os.path.join(state_dir, ".mempalace.sock")


def _resolve_log_path() -> str:
    if "MEMPALACE_DAEMON_LOG" in os.environ:
        return os.environ["MEMPALACE_DAEMON_LOG"]
    log_dir = os.path.expanduser("~/Library/Logs/DOS")
    return os.path.join(log_dir, "mempalace-bridge-daemon.log")


def _resolve_idle_ttl() -> float:
    raw = os.environ.get("MEMPALACE_DAEMON_IDLE_TTL_SEC", "600")
    try:
        return max(60.0, float(raw))  # floor at 60s to avoid pathological flapping
    except ValueError:
        return 600.0


def _resolve_wal_ckpt_interval() -> float:
    """Seconds between in-loop WAL checkpoints (PRD MDC-1, default 120).

    Set MEMPALACE_WAL_CKPT_SEC=0 to disable the daemon-side checkpoint tick
    (the SessionEnd hook still fires one deterministically). Floor at 30s to
    avoid pathological churn.
    """
    raw = os.environ.get("MEMPALACE_WAL_CKPT_SEC", "120")
    try:
        v = float(raw)
        return v if v <= 0 else max(30.0, v)
    except ValueError:
        return 120.0


SOCKET_PATH = _resolve_socket_path()
LOG_PATH = _resolve_log_path()
IDLE_TTL = _resolve_idle_ttl()
WAL_CKPT_INTERVAL = _resolve_wal_ckpt_interval()
SOCKET_BACKLOG = 16
# 2026-06-22 spawn-storm fix: a host-singleton PID file (sibling of the socket)
# stops a second daemon from binding a fresh socket inode beside a still-live
# peer and orphaning its ~0.5GB of RAM (lsof showed 7 daemons, 7 inodes, 3.8GB
# leaked). Bounded log rotation caps the daemon log that had grown unbounded
# to 6.3M with no rotation.
PID_PATH = SOCKET_PATH + ".pid"
LOG_MAX_BYTES = int(os.environ.get("MEMPALACE_DAEMON_LOG_MAX_BYTES") or 8 * 1024 * 1024)
LOG_KEEP = 3
# Per-connection read deadline (MP-016). A stalled client that connects but
# never sends a newline must not park the single-threaded serial server in
# recv() forever. settimeout turns that into a recoverable socket.timeout.
CONN_READ_TIMEOUT = 10.0

# Fix #4: dispatch-deadline self-kill seatbelt (Sage Fix #4).
# The main thread is single-threaded serial: a ChromaDB dispatch that wedges
# in pthread_cond_wait freezes the thread permanently — last_request_at is
# never updated so the idle-TTL watchdog never fires. _DISPATCH_DEADLINE_MS
# converts that infinite wedge into a ~90s blip: the watchdog checks the
# in-flight timestamp and calls os._exit(1) past the deadline, freeing the
# host singleton so MemPalaceDaemonEnsure can respawn a clean daemon.
# Override with env MEMPALACE_DAEMON_DISPATCH_DEADLINE_MS.
_DISPATCH_DEADLINE_MS: float = float(
    os.environ.get("MEMPALACE_DAEMON_DISPATCH_DEADLINE_MS", "90000")
)
# ─── Host-singleton wedge evidence (2026-07-02 reclaim-storm fix) ──────────
# A claimer may steal a LIVE holder's socket only after observing it dead for
# a sustained window INSIDE ONE PROCESS (a dwell loop watching ping, the
# heartbeat below, and the socket path). One failed short ping against a busy
# single-thread-serial daemon means BUSY, not wedged — the 2026-07-02 reclaim
# storm (234 socket steals in the log, 18 orphaned daemons, statusline
# pal:down flapping) was exactly that misjudgment amplified by every bridge
# client's autoSpawn-on-ECONNREFUSED. Cross-process stamp files were reviewed
# and rejected: a stamp with no continuity evidence converts two isolated
# busy blips separated by hours (or a laptop sleep) into "continuous failure".
#
# _WEDGE_CONFIRM_MS — dwell length when a socket file exists. Default =
#   dispatch deadline + 30s grace, so the claimer's definition of "wedged" is
#   never stricter than the daemon's own self-kill seatbelt (a truly wedged
#   dispatch dies at _DISPATCH_DEADLINE_MS, i.e. mid-dwell, and the dwell
#   notices the death).
# _ABSENT_CONFIRM_MS — dwell length while NO socket file exists: a live
#   daemon always has its socket bound (bind precedes palace open), so an
#   alive-pid-without-socket is either a sub-second startup window or a
#   recycled pid from an unclean shutdown; 10s is generous for the former and
#   keeps the latter from costing a 2-minute memory outage.
# _HB_FRESH_MS — heartbeat age below which the holder is presumed healthy
#   without any dwell (2.5 watchdog ticks at the default 60s tick).
_WEDGE_CONFIRM_MS: float = float(
    os.environ.get("MEMPALACE_DAEMON_WEDGE_CONFIRM_MS",
                   str(_DISPATCH_DEADLINE_MS + 30_000))
)
_ABSENT_CONFIRM_MS: float = float(
    os.environ.get("MEMPALACE_DAEMON_ABSENT_CONFIRM_MS", "10000")
)
_HB_FRESH_MS: float = float(
    os.environ.get("MEMPALACE_DAEMON_HB_FRESH_MS", "150000")
)
# A superseded daemon (pid file + socket path both taken by a successor) that
# cannot stop gracefully (main thread stuck outside a dispatch) hard-exits
# after this grace. Keeps the dispatch seatbelt authoritative for in-dispatch
# wedges (90s < 180s) while bounding the two-accessors-on-one-store window.
_SUPERSEDED_EXIT_MS: float = 180_000.0
# A reclaim/dwell lock older than this belongs to a dead claimer.
_RECLAIM_LOCK_STALE_MS: float = _WEDGE_CONFIRM_MS + 60_000.0
# Monotonic timestamp (time.monotonic()) set when a bridge action enters
# actions[action](args); cleared in a finally block when it returns or raises.
# Written on the main thread; read by the watchdog thread. Both sides hold
# _DISPATCH_LOCK to ensure consistent cross-thread visibility.
_dispatch_in_flight_since: float | None = None
_DISPATCH_LOCK = threading.Lock()

# Wire format constants
LINE_DELIMITER = b"\n"
MAX_LINE_BYTES = 8 * 1024 * 1024  # 8MB — generous for batch payloads, defensive against runaways


# ─── Logging (tiny, dependency-free) ───────────────────────────────────────


def _rotate_log_if_needed() -> None:
    """Size-based rotation: LOG_PATH → .1 → … → .{LOG_KEEP}. Never raises.

    Called before each append in _log. The daemon log is low-frequency, so the
    extra stat() per line is negligible; the file had grown unbounded to 6.3M
    (44k lines, no rotation) prior to the 2026-06-22 fix.
    """
    try:
        if os.path.getsize(LOG_PATH) < LOG_MAX_BYTES:
            return
    except OSError:
        return
    try:
        for i in range(LOG_KEEP - 1, 0, -1):
            src = f"{LOG_PATH}.{i}"
            if os.path.exists(src):
                os.replace(src, f"{LOG_PATH}.{i + 1}")
        os.replace(LOG_PATH, f"{LOG_PATH}.1")
    except OSError:
        pass


def _log(level: str, msg: str, **fields) -> None:
    """One JSON line per log event. Mirrors hook telemetry style.

    Never raises — log failures must not crash the daemon.
    """
    try:
        Path(os.path.dirname(LOG_PATH)).mkdir(parents=True, exist_ok=True)
        _rotate_log_if_needed()
        record = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": level,
            "msg": msg,
            **fields,
        }
        with open(LOG_PATH, "a") as f:
            f.write(json.dumps(record) + "\n")
    except Exception:
        pass


# ─── Health metrics (in-process, returned by `status` action) ──────────────


class _Metrics:
    """Bare-bones counters. RFC-0075 Phase 5 health endpoint reads these."""

    def __init__(self) -> None:
        self.started_at = time.monotonic()
        self.started_at_wall = datetime.now(timezone.utc).isoformat()
        self.request_count = 0
        self.error_count = 0
        self.last_request_at: float | None = None
        self.latencies_ms: list[float] = []  # rolling window — see _record_latency
        self._lock = threading.Lock()

    def record(self, latency_ms: float, ok: bool) -> None:
        with self._lock:
            self.request_count += 1
            if not ok:
                self.error_count += 1
            self.last_request_at = time.monotonic()
            # Bounded ring buffer — keep last 1024 to compute p50/p99 cheaply
            self.latencies_ms.append(latency_ms)
            if len(self.latencies_ms) > 1024:
                self.latencies_ms = self.latencies_ms[-1024:]

    def snapshot(self) -> dict:
        with self._lock:
            uptime_sec = time.monotonic() - self.started_at
            sorted_lat = sorted(self.latencies_ms)
            n = len(sorted_lat)
            p50 = sorted_lat[n // 2] if n else None
            p99 = sorted_lat[max(0, int(n * 0.99) - 1)] if n else None
            return {
                "pid": os.getpid(),
                "started_at": self.started_at_wall,
                "uptime_seconds": round(uptime_sec, 2),
                "request_count": self.request_count,
                "error_count": self.error_count,
                "p50_latency_ms": round(p50, 2) if p50 is not None else None,
                "p99_latency_ms": round(p99, 2) if p99 is not None else None,
                "socket_path": SOCKET_PATH,
                "idle_ttl_seconds": IDLE_TTL,
            }


_METRICS = _Metrics()


# ─── Dispatch — reuse the existing bridge ACTIONS table ────────────────────


def _load_actions() -> dict:
    """Lazy-load the bridge ACTIONS table. Importing bridge has a side-effect
    of warming the ChromaDB + KG handles via _bridge_palace's module-level
    caches. Doing this here means the FIRST request pays the warmup cost;
    every subsequent request hits warm caches.

    We deliberately do NOT pre-warm at daemon start — keeps cold-start cheap
    and matches the existing subprocess semantics where the first call
    incurs the cost.

    Tries the pack-canonical name `bridge` first; if that fails (we're
    deployed as `mempalace_daemon.py` in `~/.claude/DOS/Tools/` where the
    sibling file is renamed `mempalace_bridge.py`), falls back to that name.
    The two files are byte-identical via the alias entry in
    .dos-sync-manifest.json.
    """
    try:
        import bridge  # pack canonical (Packs/mem-palace/src/Tools/bridge.py)
        return bridge.ACTIONS
    except ImportError:
        import mempalace_bridge  # install alias (~/.claude/DOS/Tools/...)
        return mempalace_bridge.ACTIONS


def _get_bridge_module():
    """Resolve the bridge module (pack-canonical `bridge` or install alias
    `mempalace_bridge`) so the daemon can reach the shared predicate-gate seam
    `enforce_predicate_gate`. Same byte-identical-via-alias contract as
    `_load_actions` above."""
    try:
        import bridge  # pack canonical
        return bridge
    except ImportError:
        import mempalace_bridge  # install alias
        return mempalace_bridge


_ACTIONS_CACHE: dict | None = None


def _get_actions() -> dict:
    global _ACTIONS_CACHE
    if _ACTIONS_CACHE is None:
        _ACTIONS_CACHE = _load_actions()
    return _ACTIONS_CACHE


# Built-in daemon meta-actions that don't go through the bridge surface.
# These are observable via the health endpoint and let the operator probe
# the daemon's state without forcing it to import chromadb just for a ping.
_DAEMON_META_ACTIONS = {"daemon_status", "daemon_shutdown", "daemon_invalidate"}


# ─── Cache invalidation (RFC-0075 ISC-5/6) ─────────────────────────────────
#
# The daemon caches palace + KG handles via module-level globals in
# `_bridge_palace` (`_CACHED_COLLECTION`, `_CACHED_KG`, `_WING_INDEX_INITIALIZED`).
# Cron writers (kg-reconcile-weekly, mine-historical-prds, manual python3
# bridge.py invocations) mutate the palace SQLite stores out-of-band and our
# cached handles wouldn't see those writes until the daemon restarted.
#
# The simplest correct invalidation is mtime polling on the two SQLite files
# plus an explicit marker file. The marker file is the escape hatch for
# writers that don't touch sqlite directly (e.g., a future tool that mutates
# only HNSW indexes, or an operator who wants to force a refresh).


class _PalaceWatch:
    """Tracks mtimes of palace mutation signatures and decides when to invalidate.

    Four mtimes are watched, in priority order:

    1. `chroma.sqlite3` — primary palace data file. ChromaDB writes this on
       any add/upsert/delete and on HNSW index rebuilds.
    2. `knowledge_graph.sqlite3` — KG fact writes. SQLite WAL mode delays
       mtime updates on the main file until checkpoint, so we also watch:
    3. `knowledge_graph.sqlite3-wal` — catches in-flight writes that have
       not yet checkpointed back to the main DB.
    4. `MEMORY/STATE/.mempalace-invalidate` — explicit marker file. Cron
       writers `touch` this when they don't trust sqlite mtime alone (e.g.
       a future tool that mutates only HNSW indexes).

    On first call, baseline mtimes are recorded and the watch is "primed".
    On subsequent calls, any mtime moving forward triggers invalidation.

    Failure mode: if any path is missing or stat fails, we treat it as
    "no change" (silent) — must never block a legitimate bridge call.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._primed = False
        self._chroma_mtime: float = 0.0
        self._kg_mtime: float = 0.0
        self._kg_wal_mtime: float = 0.0
        self._marker_mtime: float = 0.0
        self.invalidations = 0
        self.last_invalidation_at_wall: str | None = None
        self.last_invalidation_reason: str | None = None

    def _resolve_paths(self) -> tuple[str, str, str, str]:
        """Returns (chroma_sqlite, kg_sqlite, kg_wal, marker_file)."""
        # Honor MEMPALACE_DIR override (used in tests + by `mine-historical-prds`).
        # Mirrors `_bridge_palace.get_palace_path()` exactly so we watch the
        # same files the bridge actions read.
        palace_root = os.environ.get(
            "MEMPALACE_DIR", os.path.expanduser("~/.mempalace")
        )
        chroma = os.path.join(palace_root, "palace", "chroma.sqlite3")
        kg = os.path.join(palace_root, "knowledge_graph.sqlite3")
        kg_wal = os.path.join(palace_root, "knowledge_graph.sqlite3-wal")
        marker = os.path.join(_resolve_dos_dir(), "MEMORY", "STATE",
                              ".mempalace-invalidate")
        return chroma, kg, kg_wal, marker

    @staticmethod
    def _safe_mtime(path: str) -> float:
        try:
            return os.path.getmtime(path)
        except (FileNotFoundError, OSError):
            return 0.0

    def check_and_maybe_invalidate(self) -> str | None:
        """Inspect mtimes; if any moved forward, invalidate caches.

        Returns the reason string if invalidation fired, otherwise None.
        Reasons: 'chroma_sqlite', 'kg_sqlite', 'kg_wal', 'invalidate_marker'.
        """
        chroma_path, kg_path, kg_wal_path, marker_path = self._resolve_paths()
        with self._lock:
            chroma_now = self._safe_mtime(chroma_path)
            kg_now = self._safe_mtime(kg_path)
            kg_wal_now = self._safe_mtime(kg_wal_path)
            marker_now = self._safe_mtime(marker_path)

            if not self._primed:
                # First request — record baseline, do not invalidate.
                # The daemon's existing lazy-load semantics already give us
                # fresh handles on first call; we only care about subsequent
                # external mutations.
                self._chroma_mtime = chroma_now
                self._kg_mtime = kg_now
                self._kg_wal_mtime = kg_wal_now
                self._marker_mtime = marker_now
                self._primed = True
                return None

            reason: str | None = None
            if chroma_now > self._chroma_mtime:
                reason = "chroma_sqlite"
            elif kg_now > self._kg_mtime:
                reason = "kg_sqlite"
            elif marker_now > self._marker_mtime:
                reason = "invalidate_marker"
            # NOTE (MP-035): knowledge_graph.sqlite3-wal mtime is deliberately
            # NOT compared here. The daemon's OWN add_kg_fact/invalidate writes
            # go through the warm get_kg() handle in WAL mode, advancing the WAL
            # file mtime — which made the very next dispatch self-invalidate and
            # drop the warm cache, defeating the 30x speedup RFC-0075 exists for.
            # The WAL mtime is still tracked/baselined below so external cron
            # writers that checkpoint (advancing the kg main file) OR touch the
            # marker file still trigger invalidation; only the self-write WAL
            # signal is dropped from the trigger set.

            if reason is None:
                return None

            # Update baselines BEFORE invalidating so a self-write during
            # invalidation (e.g., a quarantine sweep that touches sqlite)
            # doesn't loop us into permanent invalidation.
            self._chroma_mtime = chroma_now
            self._kg_mtime = kg_now
            self._kg_wal_mtime = kg_wal_now
            self._marker_mtime = marker_now

            self.invalidations += 1
            self.last_invalidation_at_wall = datetime.now(timezone.utc).isoformat()
            self.last_invalidation_reason = reason

            _drop_palace_handles(reason)
            return reason

    def rebaseline(self) -> None:
        """Re-record current mtimes as the baseline WITHOUT invalidating (MP-050).

        Called after the daemon performs its OWN store-touching action (a
        successful dispatch, or the watchdog's WAL checkpoint). Those self-writes
        advance chroma.sqlite3 / knowledge_graph.sqlite3 mtimes; absorbing them
        into the baseline here stops the very NEXT top-of-dispatch check from
        misreading the daemon's own write as an external mutation and dropping
        the just-warmed cache — which defeated the 30x warm-cache speedup
        RFC-0075 exists to deliver. Only meaningful once primed.
        """
        chroma_path, kg_path, kg_wal_path, marker_path = self._resolve_paths()
        with self._lock:
            if not self._primed:
                return
            self._chroma_mtime = self._safe_mtime(chroma_path)
            self._kg_mtime = self._safe_mtime(kg_path)
            self._kg_wal_mtime = self._safe_mtime(kg_wal_path)
            self._marker_mtime = self._safe_mtime(marker_path)

    def record_manual_invalidation(self, reason: str = "manual") -> None:
        """Bump counters for an out-of-band invalidation (e.g., daemon_invalidate
        meta-action). Takes the lock so it composes cleanly with the
        check_and_maybe_invalidate / snapshot serialization model.
        """
        with self._lock:
            self.invalidations += 1
            self.last_invalidation_at_wall = datetime.now(timezone.utc).isoformat()
            self.last_invalidation_reason = reason

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "primed": self._primed,
                "invalidations": self.invalidations,
                "last_invalidation_at": self.last_invalidation_at_wall,
                "last_invalidation_reason": self.last_invalidation_reason,
            }


_PALACE_WATCH = _PalaceWatch()


def _drop_palace_handles(reason: str) -> None:
    """Release the module-level palace + KG handles in `_bridge_palace`.

    The next bridge action that calls `get_palace_collection()` or `get_kg()`
    will re-open them — these helpers lazy-build when their cache vars are
    None. We close the KG handle cleanly (it's a sqlite connection holding
    a WAL lock); ChromaDB's PersistentClient does not expose a public close
    so we just drop the reference and let the GC release it.
    """
    try:
        # The daemon imports bridge.py (or mempalace_bridge.py via the alias),
        # which transitively imports _bridge_palace at module-level. We reach
        # the same module here via sys.modules so we don't pay an import.
        palace_mod = sys.modules.get("_bridge_palace")
        if palace_mod is None:
            # Force the import path that matches the daemon's deployment alias.
            try:
                import _bridge_palace as palace_mod  # type: ignore
            except ImportError:
                _log("warn", "invalidation skipped — _bridge_palace not loaded",
                     reason=reason)
                return

        # PRD-A: the drain sequence lives in ONE place —
        # `_bridge_palace.drain_handles(reason)` (close KG, durable HNSW flush,
        # null handles, GC). This handler keeps daemon policy only (logging;
        # the signal path's 0.2s sleep stays at its call site). Note the flush
        # is NEW on the daemon path — the pre-PRD-A copy had drifted behind the
        # facade and dropped handles without flushing.
        drain = getattr(palace_mod, "drain_handles", None)
        if callable(drain):
            drain(reason)
        else:  # pack/live version skew — fall back to the minimal legacy drop
            cached_kg = getattr(palace_mod, "_CACHED_KG", None)
            if cached_kg is not None:
                try:
                    close = getattr(cached_kg, "close", None)
                    if callable(close):
                        close()
                except Exception as e:
                    _log("warn", "kg close raised during invalidation",
                         reason=reason, error=str(e))
            palace_mod._CACHED_COLLECTION = None
            palace_mod._CACHED_KG = None
            palace_mod._WING_INDEX_INITIALIZED = False

        _log("info", "palace handles drained — caches will rebuild lazily",
             reason=reason)
    except Exception as e:
        # Invalidation failure must never crash the daemon. Worst case we
        # serve a stale handle until the next event; logged so an operator
        # sees the signal.
        _log("error", "drop_palace_handles raised", reason=reason,
             error=str(e))


def _classify_result_status(r) -> str:
    """Three-bucket result classifier, kept in lockstep with the CLI's
    module-level copy in bridge.py and the TS port (summarizeBridgeResult)
    via the shared fixture hooks/lib/fixtures/bridge-classifier-truth-table.json
    (MP-008/MP-010 + W1-S1). 'ok' is reserved for genuinely persisted
    mutations; no-op/dropped statuses map to 'noop'; errors to 'error'.
    W1-S1 deny-by-shape: `error_type` presence denies 'ok' even when
    `status`/`isError` are absent (review finding #6 — this third copy had
    drifted behind the other two).
    MP-PY-01 (2026-07-03): 'skipped' (thin-content reject) and
    'schema-violation' (block-mode reflection reject) persist nothing → 'noop'.
    """
    if isinstance(r, dict) and (r.get("status") == "error"
                                or r.get("isError") is True
                                or "error_type" in r):
        return "error"
    if isinstance(r, dict):
        st = r.get("status")
        if st in {"duplicate", "skip", "skipped", "not_found", "partial",
                  "schema-violation"}:
            return "noop"
    return "ok"


def _record_daemon_action(action: str, args: dict, latency_ms: float,
                          result_status: str) -> None:
    """Emit the bridge-actions.jsonl audit row for a daemon-served action
    (MP-052). Delegates to the shared bridge recorder so the row shape matches
    the cold-CLI path exactly; with DOS_BRIDGE_EMIT=ts set at module top the
    memory-events numerator is suppressed (the TS relay owns it). The recorder
    already swallows all I/O errors, but we wrap defensively so audit-logging
    can NEVER break a served request.
    """
    try:
        _get_bridge_module()._record_bridge_action(
            action, args, latency_ms, result_status)
    except Exception as e:
        _log("warn", "daemon bridge-action audit write failed",
             action=action, error=str(e))


def _dispatch(action: str, args: dict) -> dict:
    """Route a single request to either a meta-action or the bridge ACTIONS
    table. Mirrors the CLI entrypoint shape so the daemon's response is
    byte-identical to the subprocess path.

    Cache invalidation (RFC-0075 ISC-5/6) runs at the top of every dispatch.
    The check is sub-millisecond (one stat per watched file) so the cost is
    negligible vs the bridge action itself. If an external mutation is
    detected, palace handles are dropped and the action below pays the
    re-open cost lazily — daemon process stays up.
    """
    invalidation_reason = _PALACE_WATCH.check_and_maybe_invalidate()
    if invalidation_reason:
        _log("info", "palace cache invalidated by external mutation",
             reason=invalidation_reason, action=action)

    if action == "daemon_status":
        return {
            "status": "ok",
            **_METRICS.snapshot(),
            "palace_watch": _PALACE_WATCH.snapshot(),
        }

    if action == "daemon_shutdown":
        # Special case — handled by the caller loop, not us. Returning a
        # marker lets the loop tear down cleanly.
        return {"status": "ok", "shutdown": True}

    if action == "daemon_invalidate":
        # Operator-forced invalidation, even when no mtime changed.
        # Useful for "clear caches and re-check" without touching the
        # marker file. Returns whether any handles were actually dropped.
        _drop_palace_handles("manual")
        _PALACE_WATCH.record_manual_invalidation("manual")
        return {"status": "ok", "invalidated": True, "reason": "manual"}

    actions = _get_actions()
    if action not in actions:
        return {
            "isError": True,
            "content": [{
                "type": "text",
                "text": f"Invalid input: unknown action '{action}'. "
                        f"Available actions: {', '.join(sorted(actions.keys()))}.",
            }],
            "status": "error",
            "error_type": "unknown_action",
            "message": f"Unknown action: {action}",
            "available": sorted(actions.keys()),
        }

    # ─── Q1 PREDICATE GATE (pre-dispatch, mirrors CLI main()) ─────────────
    # The daemon socket path is the production default (DOS_USE_BRIDGE_DAEMON=1)
    # and must enforce the same PREDICATES.md write-side gate the cold CLI does
    # at mempalace_bridge.py main(), so add_kg_fact/invalidate with a
    # non-canonical predicate are blocked + queued rather than written.
    try:
        _gate_rejection = _get_bridge_module().enforce_predicate_gate(action, args)
    except Exception:
        # Gate resolution must never crash the daemon — fail-open to the action
        # (matches the CLI's fail-open posture when PREDICATES.md is missing).
        _gate_rejection = None
    if _gate_rejection is not None:
        # MP-052: gate-rejected writes are an audit-relevant 'error' path,
        # mirroring the CLI main() which records before returning the rejection.
        _record_daemon_action(action, args, 0.0, "error")
        return _gate_rejection

    # MP-052: per-dispatch latency for the audit row (mirrors CLI's _latency_ms).
    _action_started = time.monotonic()

    def _latency_ms() -> float:
        return (time.monotonic() - _action_started) * 1000.0

    # Fix #4: record dispatch in-flight timestamp for the deadline-seatbelt
    # watchdog. Uses the same monotonic reference as the latency tracker.
    # Cleared unconditionally in the finally block below so the watchdog sees
    # None when the main thread is idle between requests.
    global _dispatch_in_flight_since
    with _DISPATCH_LOCK:
        _dispatch_in_flight_since = _action_started

    try:
        result = actions[action](args)
        # MP-052: append the bridge-actions denominator row for the served
        # action, classified the same way the cold CLI classifies it.
        _record_daemon_action(action, args, _latency_ms(),
                              _classify_result_status(result))
        # MP-050: this action may have written through the warm handles
        # (e.g. add_drawer bumps chroma.sqlite3, add_kg_fact bumps KG). Absorb
        # the daemon's own write into the watch baseline so the NEXT dispatch's
        # top-of-loop check doesn't misread it as an external mutation and
        # cold-drop the just-warmed cache.
        _PALACE_WATCH.rebaseline()
        return result
    except KeyError as e:
        _record_daemon_action(action, args, _latency_ms(), "error")
        return {
            "isError": True,
            "content": [{
                "type": "text",
                "text": f"Invalid input: action '{action}' is missing required argument {e}.",
            }],
            "status": "error",
            "error_type": "missing_arg",
            "message": f"Missing required argument: {e}",
            "action": action,
        }
    except Exception as e:
        _record_daemon_action(action, args, _latency_ms(), "error")
        message = str(e)
        payload = {
            "status": "error",
            "error_type": "action_failed",
            "message": message,
            "action": action,
        }
        if isinstance(e, ModuleNotFoundError) or "No module named" in message:
            if "chromadb" in message or "mempalace" in message:
                payload["recovery"] = (
                    "Run ~/Durante/Tools/install-mempalace.sh to reinstall the "
                    "mempalace fork + chromadb into the active python3."
                )
        return payload
    finally:
        # Fix #4: clear the in-flight marker so the watchdog stops counting.
        # Runs on every exit path: normal return, KeyError, and Exception.
        with _DISPATCH_LOCK:
            _dispatch_in_flight_since = None


# ─── Wire protocol — JSON lines over Unix socket ───────────────────────────


def _read_request_line(conn: socket.socket) -> bytes | None:
    """Read one newline-terminated request from the connection.

    Returns None on EOF (clean client disconnect). Raises on protocol
    violation (oversize line) so the caller can close the connection.
    """
    buf = bytearray()
    while True:
        chunk = conn.recv(4096)
        if not chunk:
            return None if not buf else bytes(buf)  # tolerate trailing newline-less line
        buf.extend(chunk)
        if LINE_DELIMITER in chunk:
            # Truncate at first newline — only one request per connection.
            line, _, _ = bytes(buf).partition(LINE_DELIMITER)
            return line
        if len(buf) > MAX_LINE_BYTES:
            raise ValueError(
                f"Request exceeds {MAX_LINE_BYTES} bytes — protocol violation"
            )


def _write_response(conn: socket.socket, payload: dict) -> None:
    """Send a JSON response followed by a newline. Single shot per connection."""
    body = json.dumps(payload).encode("utf-8") + LINE_DELIMITER
    conn.sendall(body)


def _handle_connection(conn: socket.socket, peer: str) -> bool:
    """Service one client. Returns True if shutdown was requested.

    Connection model: ONE request → ONE response → close. Keeps the protocol
    trivially correct and matches the existing bridge subprocess semantics
    (one CLI invocation = one action). RFC-0075 Q2 — single-thread serial
    queue.
    """
    request_started = time.monotonic()
    ok = False
    shutdown_requested = False

    try:
        line = _read_request_line(conn)
        if not line:
            return False

        try:
            request = json.loads(line.decode("utf-8"))
        except json.JSONDecodeError as e:
            _write_response(conn, {
                "isError": True,
                "content": [{
                    "type": "text",
                    "text": f"Invalid input: JSON request could not be parsed ({e})."
                            f" Send one JSON object per connection: "
                            f'{{"action": "...", "args": {{...}}}}.',
                }],
                "status": "error",
                "error_type": "invalid_json",
                "message": f"Invalid JSON: {e}",
            })
            return False

        if not isinstance(request, dict):
            _write_response(conn, {
                "status": "error",
                "error_type": "invalid_request",
                "message": "Request must be a JSON object",
            })
            return False

        action = request.get("action")
        args = request.get("args", {})
        if not isinstance(action, str) or not action:
            _write_response(conn, {
                "status": "error",
                "error_type": "missing_action",
                "message": "Request must include 'action' string",
            })
            return False
        if not isinstance(args, dict):
            _write_response(conn, {
                "status": "error",
                "error_type": "invalid_args",
                "message": "'args' must be a JSON object",
            })
            return False

        result = _dispatch(action, args)
        ok = (result.get("status") != "error" and not result.get("isError"))

        if action == "daemon_shutdown":
            shutdown_requested = True

        _write_response(conn, result)
        return shutdown_requested
    except ValueError as e:
        # Protocol violation (oversize line) — best-effort error response.
        try:
            _write_response(conn, {
                "status": "error",
                "error_type": "protocol_violation",
                "message": str(e),
            })
        except Exception:
            pass
        return False
    except Exception as e:
        _log("error", "connection handler crash", peer=peer, error=str(e))
        try:
            _write_response(conn, {
                "status": "error",
                "error_type": "daemon_internal",
                "message": str(e),
            })
        except Exception:
            pass
        return False
    finally:
        latency_ms = (time.monotonic() - request_started) * 1000.0
        _METRICS.record(latency_ms, ok)
        try:
            conn.close()
        except Exception:
            pass


# ─── Server loop ───────────────────────────────────────────────────────────


def _maybe_unlink_stale_socket(path: str) -> None:
    """Remove a leftover socket file from a prior crashed daemon.

    Racey-but-acceptable: if a live daemon owns the path, our connect probe
    will succeed and we'll exit with EADDRINUSE. If the path is dangling
    (no listener), unlink so we can bind.
    """
    if not os.path.exists(path):
        return
    try:
        probe = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        probe.settimeout(0.5)
        probe.connect(path)
        probe.close()
        # Live daemon — DON'T unlink. Caller will see EADDRINUSE.
        return
    except (ConnectionRefusedError, FileNotFoundError):
        # Dangling socket — true no-listener signal — safe to unlink.
        try:
            os.unlink(path)
            _log("info", "unlinked stale socket", path=path)
        except FileNotFoundError:
            pass
    except Exception:
        # MP-090: socket.timeout (an OSError, not ConnectionRefused/NotFound)
        # lands here too — a LIVE-but-slow daemon whose accept() doesn't service
        # the 0.5s probe in time must be treated as live, NEVER unlinked. Biasing
        # toward 'assume live, let bind fail loudly with EADDRINUSE' prevents the
        # split-brain where two daemons serve the same chroma/KG store.
        pass
    finally:
        try:
            probe.close()
        except Exception:
            pass


_STOP_REQUESTED = threading.Event()


def _install_signal_handlers() -> None:
    def _handler(signum, _frame):
        _log("info", "signal received, requesting stop", signal=signum)
        _STOP_REQUESTED.set()
        # ─── B1 clean-shutdown drain (RFC-0075 HNSW corruption fix) ─────────
        # Release ChromaDB + KG handles BEFORE the process exits so the
        # PersistentClient's __del__ can flush its HNSW index. A 5s
        # `Bun.spawnSync` timeout SIGTERMing the daemon mid-write was leaving
        # the HNSW header on disk with stale offsets — next startup blew up
        # on index load. Drop+sleep lets GC run __del__ for a clean flush.
        # Guarded so a flush error never blocks exit.
        try:
            _drop_palace_handles("shutdown")
            # Let PersistentClient.__del__ run on the dropped handle. The
            # 0.2s budget is empirical: ChromaDB's atexit hooks complete in
            # under 50ms on warm handles in the V11.18 smoke tests; 0.2s
            # gives 4x headroom without making operator-driven shutdowns
            # feel sluggish.
            time.sleep(0.2)
        except Exception as exc:
            # Flush failure during shutdown must NEVER abort the exit path.
            # Worst case: next daemon start pays the same corruption cost
            # we were trying to avoid — which is the pre-fix baseline.
            _log("error", "shutdown drain raised", error=str(exc))
    signal.signal(signal.SIGTERM, _handler)
    signal.signal(signal.SIGINT, _handler)


def _lost_host_singleton(bound_ino: tuple[int, int] | None = None) -> int | None:
    """Return the usurper's PID when a successor has genuinely taken over.

    None means we still own the host singleton (or the pid file is missing /
    unreadable / names a dead pid — none of which is positive evidence we
    were superseded, so the daemon keeps serving). Requires CORROBORATION:
    a pid-file entry alone is not enough, because a losing claimer briefly
    clobbering the file must never make the healthy socket owner exit. When
    `bound_ino` shows the socket path still carries OUR inode, we are still
    the serving owner — self-heal the pid file and stay. A real reclaim
    always unlinks our socket before claiming, so the inode check cleanly
    separates the two cases.
    """
    holder = _read_pid_holder()
    if holder == os.getpid():
        return None
    socket_ours = False
    if bound_ino is not None:
        try:
            _st = os.stat(SOCKET_PATH)
            socket_ours = (_st.st_dev, _st.st_ino) == bound_ino
        except OSError:
            socket_ours = False  # path gone or re-bound
    if socket_ours:
        # We are still the serving owner. Pid-file noise (a doomed claimer's
        # clobber, or the hole its EADDRINUSE-exit deletion leaves) is healed
        # in place so the singleton guard never goes missing under us.
        if holder != os.getpid():
            _claim_pid_file()
            _log("info", "pid file drifted while socket still ours — healed",
                 drift_pid=holder)
        return None
    if holder is not None and _pid_alive(holder):
        return holder
    return None


def _idle_watchdog(server_sock: socket.socket, bound_ino: tuple[int, int] | None = None) -> None:
    """Background thread: shut the daemon down after IDLE_TTL of inactivity.

    Also opportunistically polls the palace mutation signatures so an idle
    daemon notices a cron writer's mutation BEFORE the next session's first
    bridge call. The next request then goes straight to fresh handles
    instead of paying invalidation + rebuild on its own latency budget.

    We tickle the listener via socketpair-on-self if needed; here we simply
    set _STOP_REQUESTED and rely on the accept() timeout to notice.
    """
    last_ckpt = time.monotonic()
    superseded_since: float | None = None
    while not _STOP_REQUESTED.is_set() or superseded_since is not None:
        time.sleep(min(60.0, IDLE_TTL / 4.0))

        # Fix #4: dispatch-deadline seatbelt check.
        # The idle-TTL check below only fires when last_request_at stops
        # updating — but a wedged dispatch NEVER updates last_request_at
        # (the request never completes). Check the in-flight timestamp
        # independently. os._exit(1) is a hard kill because a wedged main
        # thread cannot participate in graceful shutdown; _release_host_singleton
        # frees the PID file first so MemPalaceDaemonEnsure can respawn.
        with _DISPATCH_LOCK:
            in_flight = _dispatch_in_flight_since
        healthy_main = True
        if in_flight is not None:
            elapsed_ms = (time.monotonic() - in_flight) * 1000.0
            healthy_main = elapsed_ms < _DISPATCH_DEADLINE_MS
            if elapsed_ms >= _DISPATCH_DEADLINE_MS:
                _log("error",
                     "dispatch deadline exceeded — hard exit to free host singleton",
                     elapsed_ms=round(elapsed_ms, 1),
                     deadline_ms=_DISPATCH_DEADLINE_MS)
                _release_host_singleton()
                os._exit(1)

        # Superseded check (2026-07-02): a wedge-confirm reclaim takes both the
        # socket path and the PID file. The old holder must notice and exit —
        # before this check, reclaimed daemons lingered up to IDLE_TTL (or
        # forever, when their main thread was stuck outside a dispatch),
        # accumulating as orphans: 18 live daemons observed during the
        # 2026-07-02 reclaim storm. Graceful stop first: any in-flight action
        # (whose client is still attached through the old socket inode)
        # completes, then the accept loop notices the flag within its 1s
        # accept timeout. No self-poke — SOCKET_PATH now routes to the NEW
        # daemon, not us. Deliberately NO `break`: this loop also carries the
        # dispatch seatbelt above, which must stay armed for the in-flight
        # action; the bounded hard-exit below covers a main thread stuck
        # OUTSIDE any dispatch (the one class neither seatbelt nor graceful
        # stop can reach).
        usurper = _lost_host_singleton(bound_ino)
        if usurper is not None:
            if superseded_since is None:
                superseded_since = time.monotonic()
                _log("info", "host singleton taken by another live daemon — stopping",
                     new_holder_pid=usurper)
                _STOP_REQUESTED.set()
            elif (time.monotonic() - superseded_since) * 1000.0 > _SUPERSEDED_EXIT_MS:
                _log("warn", "superseded daemon still alive past grace — hard exit",
                     new_holder_pid=usurper,
                     grace_ms=_SUPERSEDED_EXIT_MS)
                os._exit(0)

        # Heartbeat: positive liveness evidence for claimers. Beat only while
        # we are the rightful owner with a provably healthy main thread —
        # a superseded daemon beating the successor's heartbeat path would
        # falsely attest for it, and a wedged main thread must let the
        # heartbeat go stale so claimers can eventually act.
        if healthy_main and usurper is None and superseded_since is None \
                and not _STOP_REQUESTED.is_set():
            _beat_heartbeat()

        # NOTE: invalidation polling was REMOVED from this background thread.
        # _drop_palace_handles() closes the KG sqlite connection and nulls the
        # ChromaDB handle; calling it here raced the main accept-loop thread
        # mid-action (use-after-close → 'Cannot operate on a closed database').
        # The mempalace KnowledgeGraph opens sqlite with check_same_thread=False,
        # so the watchdog could close a connection an in-flight bridge action was
        # already holding. Invalidation now runs SOLELY on the request thread via
        # the per-dispatch check_and_maybe_invalidate() at the top of _dispatch
        # (which is serial with the action and can never overlap it). The
        # watchdog keeps only idle-shutdown + WAL-checkpoint duties.

        # Interval-gated WAL checkpoint (PRD MDC-1). Bounds the KG WAL on a
        # warm daemon between SessionEnd hook fires. The checkpointer flock-
        # guards a singleton lock, so concurrent sessions / the Stop hook
        # never collide — at most one TRUNCATE runs per tick across the host.
        # busy/lock-held returns are no-ops; recover next tick.
        if WAL_CKPT_INTERVAL > 0 and (time.monotonic() - last_ckpt) >= WAL_CKPT_INTERVAL:
            last_ckpt = time.monotonic()
            try:
                from wal_checkpointer import checkpoint_kg
                res = checkpoint_kg()
                if res.get("status") not in ("ok", "skip"):
                    _log("info", "watchdog wal checkpoint deferred",
                         status=res.get("status"), reason=res.get("reason"))
                else:
                    # MP-050: the TRUNCATE checkpoint rewrites the KG main file
                    # (and -wal), advancing their mtimes. Re-baseline so the next
                    # dispatch doesn't misread the daemon's own checkpoint as an
                    # external KG mutation and cold-drop the warm cache.
                    _PALACE_WATCH.rebaseline()
            except Exception as e:
                _log("warn", "watchdog wal checkpoint raised", error=str(e))

        last = _METRICS.last_request_at
        # Use start time as the "last activity" if no request has come in yet.
        reference = last if last is not None else _METRICS.started_at
        idle_for = time.monotonic() - reference
        if idle_for >= IDLE_TTL:
            _log("info", "idle timeout, requesting stop",
                 idle_seconds=round(idle_for, 1), ttl=IDLE_TTL)
            _STOP_REQUESTED.set()
            # Poke the listener with a self-connect so accept() returns.
            try:
                ping = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
                ping.settimeout(0.2)
                ping.connect(SOCKET_PATH)
                ping.close()
            except Exception:
                pass
            break


# ─── W1-S1 shutdown drain constants (ISC-21/22) ──────────────────────────────
# Total wall-clock the drain may spend serving the accept backlog at shutdown.
DRAIN_DEADLINE_SEC = 2.0
# Quiet window: one accept() wait this short with nothing queued ends the drain.
DRAIN_QUIET_SEC = 0.1
# Per-connection read timeout during drain — the watchdog's byte-less self-ping
# (it connects only to wake accept(), never sends) must time out fast instead
# of parking the drain on CONN_READ_TIMEOUT (10s) and stalling daemon exit.
DRAIN_CONN_TIMEOUT_SEC = 0.2


_DRAIN_REJECT_ENVELOPE = (json.dumps({
    "status": "error",
    "error_type": "daemon_stopping",
    "message": "daemon draining for shutdown; caller should retry via cold spawn",
}) + "\n").encode("utf-8")


def _drain_backlog(server: socket.socket) -> None:
    """Reject-serve connections queued in the accept backlog before teardown.

    W1-S1 (2026-06-10, revised in the review pass): the serial loop never has
    a concurrent in-flight connection when it exits, but clients that
    connect()ed during the stop decision sit queued in the backlog (plus any
    connect landing between the STOP flag and unlink). Closing without
    answering them yields client-side EOF-before-newline — the 'empty stdout'
    class (162/day at baseline) and the daemon-side EPIPE clusters.

    The first cut DISPATCHED queued actions here; the review pass (#1/#2)
    showed that is unboundable — a queued mine_dir/batch runs with no
    wall-clock limit, and on the SIGTERM path the signal handler has already
    dropped palace handles, so a drained palace action would pay a cold
    ChromaDB re-open mid-teardown. This version never dispatches: each queued
    connection gets a small daemon_stopping error envelope and a clean close.
    The TS client (relayOutputOrNull) treats that envelope as relay-miss and
    falls back to a cold spawn, so the request is still served — by the right
    process. Every step is socket I/O bounded by DRAIN_CONN_TIMEOUT_SEC, so
    the whole drain is genuinely deadline-bounded and touches NO palace
    handles (drop-order independent; safe on both the signal and idle-TTL
    exit paths). Still runs BEFORE close -> unlink (unlink-first widens the
    dual-accessor window, the #1161 segfault class).
    """
    deadline = time.monotonic() + DRAIN_DEADLINE_SEC
    drained = 0
    while time.monotonic() < deadline:
        try:
            server.settimeout(DRAIN_QUIET_SEC)
            conn, _ = server.accept()
        except socket.timeout:
            break  # quiet window, backlog empty
        except OSError:
            break
        try:
            conn.settimeout(DRAIN_CONN_TIMEOUT_SEC)
        except OSError:
            pass
        try:
            # Best-effort read of the request line (so well-behaved clients
            # are not surprised by a write-before-read), then the reject
            # envelope. Both bounded by DRAIN_CONN_TIMEOUT_SEC; a byte-less
            # connection (the watchdog self-ping shape) times out the recv
            # and still gets the envelope + close.
            try:
                conn.recv(65536)
            except OSError:
                pass
            conn.sendall(_DRAIN_REJECT_ENVELOPE)
            drained += 1
        except Exception as e:  # noqa: BLE001 — drain must never block exit
            _log("warn", "drain reject-serve raised", error=str(e))
        finally:
            try:
                conn.close()
            except OSError:
                pass
    if drained:
        _log("info", "shutdown drain reject-served queued connections", drained=drained)


def _pid_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True  # exists, owned by another user
    except OSError:
        return False


def _daemon_ping_healthy(timeout: float = 2.0) -> bool:
    """Attempt a daemon_status health ping to the existing socket holder.

    Returns True if the current SOCKET_PATH holder responds {"status": "ok"}
    within `timeout` seconds. Returns False on connection failure, timeout,
    or any parse error. Used by _acquire_host_singleton (Fix #4) to distinguish
    a live-healthy daemon from a live-but-wedged one (dispatch deadlock).

    Intentionally does NOT use _client_request (defined later in this file)
    to avoid a forward reference; the socket logic is duplicated here
    — both paths are identical in behavior.
    """
    payload = (
        json.dumps({"action": "daemon_status", "args": {}}) + "\n"
    ).encode("utf-8")
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
        sock.connect(SOCKET_PATH)
        sock.sendall(payload)
        buf = bytearray()
        while True:
            chunk = sock.recv(4096)
            if not chunk:
                break
            buf.extend(chunk)
            if b"\n" in chunk:
                break
        line, _, _ = bytes(buf).partition(b"\n")
        if not line:
            return False
        r = json.loads(line.decode("utf-8"))
        return r.get("status") == "ok"
    except Exception:
        return False
    finally:
        try:
            sock.close()
        except Exception:
            pass


def _read_pid_holder() -> int | None:
    """Parse PID_PATH; None when missing, unreadable, or empty.

    The single pid-file parse — _acquire_host_singleton, _release_host_singleton
    and _lost_host_singleton all route through here so error semantics can
    never diverge between the three call sites.
    """
    try:
        raw = open(PID_PATH).read().strip()
        return int(raw) if raw else None
    except (OSError, ValueError):
        return None


# ─── Heartbeat: positive liveness evidence written by the OWNER ────────────
# The watchdog thread touches HB_PATH every tick, but only while (a) this
# process owns the pid file / socket and (b) the main thread is provably
# healthy (no dispatch in flight past the deadline). A claimer that finds a
# fresh heartbeat backs off without any dwell; a claimer that finds a stale
# one still dwells and treats any mtime ADVANCE as proof of life (a relative
# comparison, immune to sleep/wake and NTP wall-clock steps).

HB_PATH = SOCKET_PATH + ".hb"


def _beat_heartbeat() -> None:
    try:
        os.utime(HB_PATH, None)
    except FileNotFoundError:
        try:
            with open(HB_PATH, "w") as f:
                f.write(str(os.getpid()))
        except OSError:
            pass
    except OSError:
        pass


def _heartbeat_mtime() -> float | None:
    try:
        return os.stat(HB_PATH).st_mtime
    except OSError:
        return None


# ─── Reclaim lock: one investigator/claimer at a time ──────────────────────
# O_EXCL create; doubles as the dwell lock so a spawn storm produces ONE
# dweller instead of N stacked ping loops against the busy holder's backlog.
# Serializing every pid-file claim through it also kills the clobber race
# where two concurrent os.replace claimers left the successful binder with
# no pid file (EADDRINUSE loser deleting its own clobber).

RECLAIM_LOCK_PATH = PID_PATH + ".reclaim"


def _acquire_reclaim_lock() -> bool:
    def _create() -> bool:
        try:
            fd = os.open(RECLAIM_LOCK_PATH, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            try:
                os.write(fd, str(os.getpid()).encode())
            finally:
                os.close(fd)
            return True
        except OSError:
            return False

    if _create():
        return True
    try:
        age_ms = (time.time() - os.stat(RECLAIM_LOCK_PATH).st_mtime) * 1000.0
        if age_ms > _RECLAIM_LOCK_STALE_MS or age_ms < 0:
            # Atomic rename-reclaim (dlq-lock pattern): exactly one reclaimer
            # wins the rename; stat-then-unlink would race two into writers.
            claim = f"{RECLAIM_LOCK_PATH}.claim.{os.getpid()}"
            os.rename(RECLAIM_LOCK_PATH, claim)
            os.unlink(claim)
            return _create()
    except OSError:
        pass
    return False


def _release_reclaim_lock() -> None:
    try:
        if open(RECLAIM_LOCK_PATH).read().strip() == str(os.getpid()):
            os.unlink(RECLAIM_LOCK_PATH)
    except OSError:
        pass


def _holder_confirmed_dead(holder: int) -> bool:
    """Dwell in-process until the holder shows life or the window elapses.

    Life signals (any one aborts the dwell as NOT dead):
      - the socket answers a daemon_status ping
      - the heartbeat mtime ADVANCES (holder's watchdog attests a healthy
        main thread; relative comparison so wall-clock steps can't lie)
      - the pid file changes hands (someone else resolved the situation)
    Death signals:
      - the holder pid vanishes (its own seatbelt fired) → confirmed
      - the full window elapses with zero life signals → confirmed
    Window: _ABSENT_CONFIRM_MS while no socket file exists; promoted to the
    full _WEDGE_CONFIRM_MS the moment one appears (a binding-in-progress
    successor must never be judged on the short clock).
    """
    started = time.monotonic()
    hb0 = _heartbeat_mtime()
    window_ms = _WEDGE_CONFIRM_MS if os.path.exists(SOCKET_PATH) else _ABSENT_CONFIRM_MS
    while (time.monotonic() - started) * 1000.0 < window_ms:
        time.sleep(min(2.0, max(0.05, window_ms / 5000.0)))
        if os.path.exists(SOCKET_PATH):
            window_ms = _WEDGE_CONFIRM_MS
            if _daemon_ping_healthy(timeout=2.0):
                return False
        hb = _heartbeat_mtime()
        if hb is not None and (hb0 is None or hb > hb0):
            return False
        if not _pid_alive(holder):
            return True
        if _read_pid_holder() != holder:
            return False
    return True


def _claim_pid_file() -> bool:
    """Atomically write our pid (tmp+replace). Callers hold the reclaim lock."""
    try:
        tmp = f"{PID_PATH}.tmp.{os.getpid()}"
        with open(tmp, "w") as f:
            f.write(str(os.getpid()))
        os.replace(tmp, PID_PATH)
        return True
    except OSError:
        return False


def _acquire_host_singleton() -> bool:
    """Claim the host-singleton PID file atomically.

    Returns True if we own it (proceed to bind), False if a LIVE daemon already
    owns the host (caller MUST exit 0 — a second daemon would orphan the live
    peer's ~0.5GB of RAM, the 2026-06-22 spawn-storm). Dead/stale holders are
    reclaimed via tmp+rename. Fails OPEN (returns True) if the PID file can't be
    created — the EADDRINUSE bind guard is the backstop, and a pid-file hiccup
    must never wedge memory shut.
    """
    try:
        fd = os.open(PID_PATH, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        try:
            os.write(fd, str(os.getpid()).encode())
        finally:
            os.close(fd)
        return True
    except FileExistsError:
        pass
    except OSError:
        return True  # fail open — never block the daemon on a pid-file error

    holder = _read_pid_holder()
    if holder == os.getpid():
        return True

    if holder is not None and _pid_alive(holder):
        # Fix #4 (revised 2026-07-02): PID is alive but may be wedged
        # (dispatch deadlock in ChromaDB's pthread_cond_wait). A single
        # failed ping is NOT wedge evidence — the daemon is single-thread
        # serial, so any in-flight action longer than the ping timeout
        # makes a healthy holder unresponsive. Cheap positive attestations
        # first; only then a lock-serialized dwell that must observe the
        # holder dead for a full window. Truly wedged dispatches self-kill
        # at _DISPATCH_DEADLINE_MS anyway (mid-dwell — the dwell sees the
        # pid vanish); this path exists for wedges the seatbelt cannot see
        # (e.g. a cold-open hang before any request, or a recycled pid).
        hb = _heartbeat_mtime()
        if hb is not None and 0 <= (time.time() - hb) * 1000.0 < _HB_FRESH_MS:
            return False  # owner's watchdog attests a healthy main thread
        if _daemon_ping_healthy(timeout=2.0):
            return False  # live + answering — do not reclaim
        if not _acquire_reclaim_lock():
            return False  # another claimer is already investigating
        try:
            if _read_pid_holder() != holder:
                return False  # resolved while we queued for the lock
            if not _holder_confirmed_dead(holder):
                return False
            _log("info", "host singleton held by wedged daemon — reclaiming",
                 holder_pid=holder, socket=SOCKET_PATH,
                 socket_present=os.path.exists(SOCKET_PATH))
            # Unlink the corpse's socket + heartbeat so our bind starts clean.
            # The wedged daemon's pending os._exit(1) path unlinks nothing, so
            # FileNotFoundError is the only benign surprise here.
            for stale in (SOCKET_PATH, HB_PATH):
                try:
                    os.unlink(stale)
                except OSError:
                    pass
            return _claim_pid_file()
        finally:
            _release_reclaim_lock()

    # Holder is dead (or the file is unreadable). Claim under the same lock —
    # two concurrent os.replace claimers previously left the successful binder
    # with no pid file when the EADDRINUSE loser deleted its own clobber.
    if not _acquire_reclaim_lock():
        return False
    try:
        current = _read_pid_holder()
        if current is not None and current != holder and _pid_alive(current):
            return False  # someone else claimed while we queued
        return _claim_pid_file()
    finally:
        _release_reclaim_lock()


def _release_host_singleton() -> None:
    try:
        if _read_pid_holder() == os.getpid():
            os.unlink(PID_PATH)
    except OSError:
        pass


def serve_forever() -> int:
    """Bind + accept loop. Single-thread serial. Returns process exit code."""
    Path(os.path.dirname(SOCKET_PATH)).mkdir(parents=True, exist_ok=True, mode=0o700)
    if not _acquire_host_singleton():
        _log("info", "host singleton held by a live daemon — exiting 0", path=PID_PATH)
        sys.stderr.write("[mempalace-daemon] another live daemon owns the host; exiting\n")
        return 0
    _maybe_unlink_stale_socket(SOCKET_PATH)

    server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    # MP-091: restrict the umask BEFORE bind so the socket file is created
    # 0o600 from the start. Without this there was a sliver between bind()
    # (file created at the inherited umask) and the post-bind os.chmod where a
    # multi-user host could connect. The post-bind chmod below stays as
    # belt-and-suspenders.
    _prev_umask = os.umask(0o077)
    bound_sock_ino: tuple[int, int] | None = None
    try:
        server.bind(SOCKET_PATH)
        # Ownership fingerprint, captured IMMEDIATELY after bind (before the
        # chmod below) to shrink the window where a racing reclaimer's
        # re-bind could be fingerprinted as ours. (st_dev, st_ino) pair —
        # st_ino alone can be recycled within the filesystem.
        try:
            _bind_st = os.stat(SOCKET_PATH)
            bound_sock_ino = (_bind_st.st_dev, _bind_st.st_ino)
        except OSError:
            bound_sock_ino = None
    except OSError as e:
        if e.errno == errno.EADDRINUSE:
            # Another daemon already bound this socket — it is authoritative.
            # Exit cleanly (0) so the connect-or-spawn shim uses the existing
            # daemon instead of treating this as a crash. (2026-06-22: the old
            # return-1 here contributed to 252 EADDRINUSE log lines + the
            # broken-pipe storm.)
            _release_host_singleton()
            _log("info", "bind EADDRINUSE — existing daemon authoritative, exiting 0",
                 path=SOCKET_PATH)
            return 0
        _log("error", "bind failed", path=SOCKET_PATH, error=str(e))
        sys.stderr.write(f"[mempalace-daemon] bind failed at {SOCKET_PATH}: {e}\n")
        _release_host_singleton()
        return 1
    finally:
        # Restore the inherited umask now that the socket file exists (MP-091).
        os.umask(_prev_umask)
    # Restrict permissions: socket is per-user only (belt-and-suspenders on
    # top of the pre-bind umask above).
    try:
        os.chmod(SOCKET_PATH, 0o600)
    except OSError:
        pass
    server.listen(SOCKET_BACKLOG)
    server.settimeout(1.0)  # non-blocking enough to check _STOP_REQUESTED
    # First heartbeat immediately — the watchdog's first tick is up to 60s
    # away, and a claimer that spawns during our cold palace load must see
    # fresh positive evidence, not an absent file.
    _beat_heartbeat()

    _install_signal_handlers()
    _log("info", "daemon listening", pid=os.getpid(), socket=SOCKET_PATH,
         idle_ttl=IDLE_TTL)
    sys.stderr.write(
        f"[mempalace-daemon] pid={os.getpid()} listening at {SOCKET_PATH} "
        f"(idle_ttl={IDLE_TTL}s)\n"
    )

    watchdog = threading.Thread(target=_idle_watchdog, args=(server, bound_sock_ino), daemon=True)
    watchdog.start()

    try:
        while not _STOP_REQUESTED.is_set():
            try:
                conn, _ = server.accept()
            except socket.timeout:
                continue
            except OSError as e:
                _log("error", "accept failed", error=str(e))
                continue
            # Per-connection read deadline (MP-016): a client that connect()s
            # but never sends a newline would otherwise park the single-threaded
            # serial server in conn.recv() forever, wedging ALL sessions until
            # SIGKILL. settimeout makes recv() raise socket.timeout (an OSError),
            # which _handle_connection's generic except catches → it writes an
            # error response and frees the serial loop for the next request.
            try:
                conn.settimeout(CONN_READ_TIMEOUT)
            except OSError:
                pass
            shutdown = _handle_connection(conn, peer="local")
            if shutdown:
                _log("info", "shutdown action received")
                _STOP_REQUESTED.set()
                break
    finally:
        # ─── B1 clean-shutdown drain — single choke point for ALL exit paths ──
        # The SIGTERM/SIGINT handler also drains, but idle-TTL expiry and the
        # daemon_shutdown action exit via this finally WITHOUT touching the
        # signal handler. Hoisting the drain here guarantees every exit path
        # releases ChromaDB + KG handles so PersistentClient.__del__ can flush
        # the HNSW index before the process is reaped (prevents the stale-offset
        # corruption RFC-0075 B1 targets). Idempotent: handles are None after
        # the first drop, so a prior signal-path drain makes this a no-op.
        # Guarded so a flush failure never blocks the exit path.
        # W1-S1 (ISC-21, review-revised): reject-serve the accept backlog FIRST
        # so queued clients get a parseable daemon_stopping envelope instead of
        # EOF-before-newline; they fall back to cold spawns. The drain touches
        # no palace handles, so it is correct on BOTH exit orders — the signal
        # path (handler already dropped handles before this finally runs) and
        # the idle-TTL/daemon_shutdown path (handles still live here).
        try:
            _drain_backlog(server)
        except Exception as e:
            _log("warn", "shutdown backlog drain raised", error=str(e))
        try:
            _drop_palace_handles("shutdown")
            time.sleep(0.2)
        except Exception as e:
            _log("error", "shutdown drain raised in serve_forever finally",
                 error=str(e))
        try:
            server.close()
        except Exception:
            pass
        try:
            # Unlink only the socket WE bound: fingerprint match AND pid-file
            # ownership, both required. If a reclaimer re-bound the path the
            # fingerprint differs and the file is theirs — deleting it would
            # knock the live daemon offline (the pre-2026-07-02 orphan-exit
            # flap). An unknown fingerprint (stat failed at bind) leaves the
            # file for the next starter's _maybe_unlink_stale_socket — never
            # an unconditional unlink.
            _exit_st = os.stat(SOCKET_PATH)
            if bound_sock_ino is not None \
                    and (_exit_st.st_dev, _exit_st.st_ino) == bound_sock_ino \
                    and _read_pid_holder() in (os.getpid(), None):
                os.unlink(SOCKET_PATH)
                try:
                    os.unlink(HB_PATH)
                except OSError:
                    pass
            else:
                _log("info", "socket not provably ours at shutdown — leaving it in place")
        except FileNotFoundError:
            pass
        except Exception as e:
            _log("warn", "unlink on shutdown failed", error=str(e))
        _release_host_singleton()
        _log("info", "daemon stopped",
             requests=_METRICS.request_count,
             errors=_METRICS.error_count)

    return 0


# ─── Tiny client utilities (used by --health and --shutdown CLI flags) ─────


def _client_request(action: str, args: dict | None = None,
                    timeout_seconds: float = 5.0) -> dict:
    """One-shot client: connect, send, read, close. Returns the JSON dict.

    Used by:
      - `bridge_daemon.py --health` (operator probe)
      - `bridge_daemon.py --shutdown` (operator-initiated cycle)
      - smoke tests (test/smoke_daemon.py)

    Hooks should NOT call this directly — they use the TS shim in
    hooks/lib/mempalace.ts which has the connect-or-spawn fallback path.
    """
    payload = {"action": action, "args": args or {}}
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.settimeout(timeout_seconds)
    try:
        sock.connect(SOCKET_PATH)
        sock.sendall(json.dumps(payload).encode("utf-8") + LINE_DELIMITER)
        # Read until newline or close
        buf = bytearray()
        while True:
            chunk = sock.recv(4096)
            if not chunk:
                break
            buf.extend(chunk)
            if LINE_DELIMITER in chunk:
                break
        line, _, _ = bytes(buf).partition(LINE_DELIMITER)
        if not line:
            return {"status": "error", "error_type": "empty_response",
                    "message": "daemon returned no data"}
        return json.loads(line.decode("utf-8"))
    finally:
        try:
            sock.close()
        except Exception:
            pass


def _cmd_health() -> int:
    try:
        result = _client_request("daemon_status", timeout_seconds=2.0)
    except (ConnectionRefusedError, FileNotFoundError):
        print(json.dumps({
            "status": "stopped",
            "message": "daemon not running",
            "socket": SOCKET_PATH,
        }, indent=2))
        return 1
    except Exception as e:
        print(json.dumps({
            "status": "unknown",
            "error": str(e),
            "socket": SOCKET_PATH,
        }, indent=2))
        return 2
    print(json.dumps(result, indent=2))
    return 0


def _cmd_shutdown() -> int:
    try:
        result = _client_request("daemon_shutdown", timeout_seconds=2.0)
        print(json.dumps(result, indent=2))
        return 0
    except (ConnectionRefusedError, FileNotFoundError):
        print(json.dumps({"status": "stopped", "message": "daemon not running"}))
        return 0
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
        return 2


# ─── CLI entry point ───────────────────────────────────────────────────────


def main() -> int:
    if len(sys.argv) > 1:
        flag = sys.argv[1]
        if flag in ("-h", "--help", "help"):
            print(__doc__)
            return 0
        if flag == "--health":
            return _cmd_health()
        if flag == "--shutdown":
            return _cmd_shutdown()
        if flag == "--foreground":
            pass  # default behavior
        else:
            sys.stderr.write(f"unknown flag: {flag}\n")
            return 2
    return serve_forever()


if __name__ == "__main__":
    sys.exit(main())
