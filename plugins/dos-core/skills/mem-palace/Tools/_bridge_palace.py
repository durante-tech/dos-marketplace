#!/usr/bin/env python3
"""
MemPalace Bridge — palace/admin module (split from bridge.py per RFC-0035 §MW3-F).

Carries the shared infrastructure (palace path resolution, ChromaDB client cache,
KG handle cache, wing-index secondary table, embedding fallback, error shape
helper) plus all admin/lifecycle actions: init, status, wake_up, classify,
traverse, find_tunnels, create_tunnel, reconcile, suggest_parent, diary, batch,
fact_check, build_closets, rebuild_closets, backfill_closets, append_reflection,
graph_stats, last_checkpoint, memories_filed_away.

The drawers and kg sub-modules import from this file. The thin facade at
bridge.py re-exports every public name so existing callers (e.g.
`mempalace_bridge.py status`) continue to work byte-identically.

V11.13 split: 2026-05-08. Pure refactor — zero behavior change.
"""

import sys
import json
import os
import re
import uuid
import sqlite3
from pathlib import Path
from datetime import datetime, timezone, timedelta

# chromadb pins ONE Settings per persist-path within a process. Our bridge,
# mempalace's own backend (backends/chroma.py opens PersistentClient bare), and
# init() each construct a client — some with Settings(anonymized_telemetry=False),
# some bare. In the long-lived daemon the first-built settings win and any later
# divergent construction throws "An instance of Chroma already exists ... with
# different settings" (the false `chromadb: unavailable` DEGRADED symptom). Pinning
# the telemetry default process-wide makes EVERY construction resolve identical
# Settings (verified: chromadb 1.5.8 reads ANONYMIZED_TELEMETRY into the default).
# We FORCE (not setdefault) to match DOS's long-standing telemetry-off intent (the
# original code hard-passed Settings(anonymized_telemetry=False)) and to close the
# override-divergence /code-review flagged: a parent-exported ANONYMIZED_TELEMETRY=
# true would otherwise leave our explicit Settings(False) diverging from mempalace's
# bare open. Safe at module load: all chromadb imports here are lazy/in-function.
os.environ["ANONYMIZED_TELEMETRY"] = "False"


# RFC-0005 §13.2 R12: bridge __version__ tracks the installed mempalace
# library __version__ so status responses don't lie about drift. Falls
# back to a conservative sentinel if the library isn't importable yet
# (pre-install environments, uv spinning up the subprocess, etc.).
def _resolve_bridge_version() -> str:
    try:
        import mempalace  # type: ignore
        return getattr(mempalace, "__version__", "unknown")
    except Exception:
        return "unknown"


__version__ = _resolve_bridge_version()


# Module-level cache — shared within a single Python process (e.g. during batch calls
# or when the same action is invoked repeatedly via import). Persists for the lifetime
# of the Python interpreter, which for CLI usage is one subprocess invocation.
_CACHED_COLLECTION = None
_CACHED_KG = None
_WING_INDEX_INITIALIZED = False
_ACTIONS_CACHE: dict | None = None


def get_palace_path() -> str:
    """Resolve palace path from env or default."""
    return os.environ.get("MEMPALACE_DIR", os.path.expanduser("~/.mempalace"))


def _quarantine_ledger_path() -> str:
    """W1-S2 mint-ledger location. Env seam for tests; default co-locates with
    host-level STATE (hook telemetry, DLQ) — NEVER inside palace_path, so the
    ledger survives palace surgery and cannot recurse into a palace open."""
    override = os.environ.get("MEMPALACE_QUARANTINE_LEDGER")
    if override:
        return override
    dos_dir = os.environ.get("DOS_DIR", os.path.expanduser("~/.claude"))
    return os.path.join(dos_dir, "MEMORY", "STATE", "hnsw-quarantine-ledger.jsonl")


def _ledger_emit(event: dict) -> None:
    """Append one past-tense quarantine-lifecycle event as a JSONL line.

    W1-S2 forensic mint-ledger (Council: the event stream this subsystem owed
    itself — gravestones are reaper-deleted on a 24h clock, so the EVENTS must
    outlive the dirs). Constraints (RedTeam A5): pure O_APPEND file write, fails
    open with a single stderr note, and MUST NOT route through bridge/KG/chroma
    — any of those re-enters get_palace_collection inside its own first call.
    """
    try:
        line = json.dumps(
            {"ts": datetime.now(timezone.utc).isoformat(), **event},
            separators=(",", ":"),
            default=str,
        )
        path = _quarantine_ledger_path()
        os.makedirs(os.path.dirname(path), exist_ok=True)
        fd = os.open(path, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o644)
        try:
            os.write(fd, (line + "\n").encode("utf-8"))
        finally:
            os.close(fd)
    except Exception:
        try:
            sys.stderr.write("[mempalace-bridge] quarantine-ledger write failed\n")
        except Exception:
            pass


# W1-S2 decision-table boundary: collections created by mempalace PR #1191
# carry hnsw:sync_threshold=50000 (the _HNSW_BLOAT_GUARD). At or above this
# boundary, payload-without-pickle is the EXPECTED steady state — chromadb's
# Rust core only flushes HNSW (and only then writes index_metadata.pickle)
# every sync_threshold vectors, which this palace's write volume never reaches.
# 10000 is the Council-pinned regime boundary (decision table D3/D9) sitting 5x
# below the pkg's _HNSW_BLOAT_GUARD value (chroma.py:101-102) — the durable
# vectors-written-vs-threshold predicate belongs to the prepared upstream PR.
_HIGH_SYNC_THRESHOLD = 10000


def _read_sync_threshold_tristate(palace_path: str, collection_name: str = "mempalace_drawers"):
    """Wrapper-owned tri-state sync_threshold read: ('value', N) | ('row-missing', None) | ('error', None).

    Deliberately NOT mempalace's _read_sync_threshold — that reader swallows
    every exception into a 1000 default (chroma.py line-491 class), which under
    a concurrent cold-spawn SQLITE_BUSY would silently classify this palace as
    low-threshold and re-arm the false-positive quarantine (RedTeam A2). Here
    error and row-missing are distinct, inspectable states that both fail
    toward SKIP — a missed quarantine is recoverable; a false one renames a
    live segment out from under its holder.
    """
    db_path = os.path.join(palace_path, "chroma.sqlite3")
    if not os.path.isfile(db_path):
        return ("error", None)
    try:
        # timeout=0.25: under SQLITE_BUSY (external writer mid-flush — exactly
        # the moment cold spawns pile up) error fails toward SKIP, so a short
        # wait is safe and keeps the gate out of PreToolUse hook budgets.
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True, timeout=0.25)
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT cm.int_value
                FROM collection_metadata cm
                JOIN collections c ON cm.collection_id = c.id
                WHERE c.name = ? AND cm.key = 'hnsw:sync_threshold'
                """,
                (collection_name,),
            )
            row = cur.fetchone()
            if row and row[0] is not None:
                return ("value", int(row[0]))
            return ("row-missing", None)
        finally:
            conn.close()
    except Exception:
        return ("error", None)


def _daemon_socket_path() -> str:
    """Mirror of mempalace_daemon._resolve_socket_path — same env override,
    same default, so the holder probe and the daemon can never disagree about
    which socket means 'a holder may be alive'."""
    if "MEMPALACE_DAEMON_SOCKET" in os.environ:
        return os.environ["MEMPALACE_DAEMON_SOCKET"]
    dos_dir = os.environ.get("DOS_DIR", os.path.expanduser("~/.claude"))
    return os.path.join(dos_dir, "MEMORY", "STATE", ".mempalace.sock")


def _daemon_holder_alive(timeout_sec: float = 0.1) -> bool:
    """Read-only liveness probe for a palace-holding daemon.

    connect-success -> True. connect-TIMEOUT -> True (MP-090 bias: a busy
    single-threaded daemon that cannot accept within the probe window is
    ASSUMED LIVE — failing toward skip is the safe direction). ENOENT /
    ECONNREFUSED -> False (dangling socket is a true no-holder signal).
    NEVER unlinks, NEVER spawns, NEVER sends protocol bytes (RedTeam A4:
    clients are strictly read-only on the socket; only daemon startup may
    unlink, under its own _maybe_unlink_stale_socket protocol).

    Known platform bias (review 2026-06-11): on Linux a FULL accept backlog
    yields immediate ECONNREFUSED (reads as no-holder) where macOS blocks then
    times out (assume-live). The unsafe arm only matters on low-threshold
    palaces; the host fleet is Darwin today. Revisit at LEG-3 distribution.

    In-daemon self-detection guard: the daemon binds its socket BEFORE its
    first palace open, so probing from inside the daemon would always read
    'live-holder' from ITSELF and mask the low-threshold row. The daemon sets
    MEMPALACE_IS_DAEMON=1 at startup; treat that as no-external-holder.
    """
    if os.environ.get("MEMPALACE_IS_DAEMON") == "1":
        return False
    sock_path = _daemon_socket_path()
    if not os.path.exists(sock_path):
        return False
    import socket as _socket
    s = _socket.socket(_socket.AF_UNIX, _socket.SOCK_STREAM)
    s.settimeout(timeout_sec)
    try:
        s.connect(sock_path)
        return True
    except _socket.timeout:
        return True
    except OSError:
        return False
    finally:
        try:
            s.close()
        except Exception:
            pass


def _bad_pickle_present(palace_path: str) -> bool:
    """True when any LIVE candidate segment has index_metadata.pickle PRESENT
    but failing the byte sniff (>=16 bytes, head 0x80, tail 0x2e).

    A present-but-malformed pickle is genuine corruption under ANY
    sync_threshold (an interrupted flush at the 50k crossing, RedTeam A3) —
    distinct from pickle-ABSENT, which is the healthy steady state under the
    #1191 high-threshold config. Same candidate filter as upstream
    quarantine_stale_hnsw. Errors read as bad (conservative: lets the
    default-threshold sweep inspect).

    DELIBERATELY NOT pkg _segment_appears_healthy (chroma.py:134): that helper
    returns False for pickle-ABSENT-with-payload — importing it would resurrect
    the RED#1 false positive this classifier exists to kill. The byte constants
    (16-byte floor, 0x80 head, 0x2e tail) are a pinned fork of its sniff; the
    parity tripwire lives in test_quarantine_classifier.py."""
    try:
        for name in os.listdir(palace_path):
            if "-" not in name or name.startswith(".") or ".drift-" in name or ".corrupt-" in name:
                continue
            seg_dir = os.path.join(palace_path, name)
            if not os.path.isdir(seg_dir):
                continue
            meta_path = os.path.join(seg_dir, "index_metadata.pickle")
            if not os.path.isfile(meta_path):
                continue
            try:
                if os.path.getsize(meta_path) < 16:
                    return True
                with open(meta_path, "rb") as f:
                    head = f.read(2)
                    f.seek(-1, 2)
                    tail = f.read(1)
                if not (len(head) == 2 and head[0] == 0x80 and tail == b"\x2e"):
                    return True
            except OSError:
                return True
    except Exception:
        return False
    return False


def _reap_drift_segments(palace_path: str) -> int:
    """Reap aged HNSW quarantine gravestones (MP-006 / MP-009).

    quarantine_stale_hnsw moves torn HNSW state into `<uuid>.drift-YYYYMMDD-HHMMSS`
    dirs but nothing in the pack ever deleted them, so they accumulate on disk
    forever (the radiator's ttl-due only fires at 30d, by which time the palace
    has re-corrupted dozens of times). These dirs are dead the instant they are
    created — never durable data — so we rmtree any older than a SHORT reaper TTL.
    Advisory like the quarantine itself: any failure is swallowed and never blocks
    a live bridge call. Env-gate the TTL via MEMPALACE_DRIFT_TTL_DAYS (default 1).

    Returns the number of dirs reaped (0 on any error).
    """
    import shutil
    import time as _time
    try:
        ttl_days = float(os.environ.get("MEMPALACE_DRIFT_TTL_DAYS", "1"))
    except (TypeError, ValueError):
        ttl_days = 1.0
    cutoff = _time.time() - (ttl_days * 86400.0)
    reaped = 0
    try:
        for entry in os.scandir(palace_path):
            if not entry.is_dir():
                continue
            # '.corrupt-' included since W1-S2 review: the wrapper now runs
            # quarantine_invalid_hnsw_metadata on the DOS path, which mints
            # <uuid>.corrupt-<stamp> gravestones — without this they would
            # accumulate forever (the exact MP-006 regression).
            if ".drift-" not in entry.name and ".corrupt-" not in entry.name:
                continue
            try:
                mtime = entry.stat().st_mtime
                if mtime < cutoff:
                    # Ledger BEFORE rmtree — DOS owns this mutation, so the
                    # before-ordering is enforceable here (RedTeam A5). The
                    # reap event is the only durable trace once the dir is gone.
                    _ledger_emit({
                        "event": "SegmentReaped",
                        "gravestone": entry.name,
                        "gravestone_mtime": mtime,
                        "ttl_days": ttl_days,
                        "palace": palace_path,
                    })
                    shutil.rmtree(entry.path, ignore_errors=True)
                    if os.path.exists(entry.path):
                        # rmtree(ignore_errors) can fail silently (EPERM,
                        # immutable flag): the ledger must not assert a
                        # deletion that never happened (review #10).
                        _ledger_emit({
                            "event": "ReapFailed",
                            "gravestone": entry.name,
                            "palace": palace_path,
                        })
                    else:
                        reaped += 1
            except Exception:
                # Per-entry failure must not abort the sweep.
                continue
    except Exception:
        # Reaper is advisory — never block a live bridge call.
        return 0
    return reaped


def _maybe_quarantine_stale_hnsw(palace_path: str) -> None:
    """W1-S2 state-classifier around the upstream HNSW quarantine sweep.

    PR #1191 set hnsw:sync_threshold=50000 on this palace's collections, making
    payload-without-pickle the EXPECTED steady state — but upstream
    quarantine_stale_hnsw's integrity sniff still reads that state as torn, so
    every cold open harvested a false-positive rename (the .drift-* cycle, and
    the #1161 daemon-death class when the rename landed under a live holder).
    This wrapper CLASSIFIES palace state before delegating (predicate
    correction, not suppression — Council 2026-06-11, RedTeam-amended):

      threshold error/missing             -> mtime leg OFF (fail toward skip)
      high T + no bad pickle              -> mtime leg OFF (healthy steady state)
      high T + bad pickle + live holder   -> mtime leg OFF (deferred: rename-under-holder kills it)
      high T + bad pickle + no holder     -> default sweep (genuine corruption)
      low T + live holder                 -> mtime leg OFF (deferred, same reason)
      low T + no holder                   -> default sweep (pre-#1191 palaces)
      classifier failure (fd exhaustion…) -> mtime leg OFF (advisory never blocks)

    quarantine_invalid_hnsw_metadata runs FIRST, per-segment, so a malformed
    pickle is handled by the metadata pass and cannot downgrade healthy
    siblings to the 300s sweep.

    The mtime leg is disabled via stale_seconds=inf, which by upstream
    construction (payload_corrupt computed BEFORE the mtime gate, chroma.py
    246-249 — pinned by the tripwire test) leaves the ratio>10x leg ALWAYS
    armed: real link_lists bloat quarantines in every row. Silent no-op on any
    error; a failure here must not block a legitimate bridge call.
    """
    # Phase 1 — invalid-metadata pass FIRST (pkg-path parity, RedTeam A3):
    # ChromaBackend._prepare_palace_for_open runs quarantine_invalid_hnsw_metadata
    # before every pkg open; the DOS wrapper path historically skipped it. Running
    # it before classification means a malformed pickle is handled PER-SEGMENT
    # here, and the classifier below judges what qihm left behind — one bad
    # neighbor no longer downgrades the whole palace to the 300s sweep
    # (review #1: the bad-pickle row was palace-wide and outranked live-holder).
    moved_meta = []
    try:
        if any(
            os.path.isfile(os.path.join(palace_path, n, "index_metadata.pickle"))
            for n in os.listdir(palace_path)
            if "-" in n and not n.startswith(".") and ".drift-" not in n and ".corrupt-" not in n
        ):
            from mempalace.backends.chroma import quarantine_invalid_hnsw_metadata
            moved_meta = quarantine_invalid_hnsw_metadata(palace_path) or []
            for moved in moved_meta:
                _ledger_emit({
                    "event": "SegmentQuarantined",
                    "reason": "invalid-metadata",
                    "gravestone": os.path.basename(str(moved)),
                    "palace": palace_path,
                })
    except Exception:
        pass

    # Phase 2 — classify. Entire phase guarded: under fd exhaustion or any
    # probe failure the sweep degrades to the safe row instead of hard-failing
    # the bridge call (review #6 — 'advisory, never block' must hold here too).
    # The holder probe is LAZY: it only runs when it can change the outcome
    # (review #7 — on the dominant high-threshold path it cost 100-250ms per
    # cold spawn to compute a log label). Probe order: holder OUTRANKS
    # bad-pickle (review #1 — a rename-under-holder kills the daemon; a
    # deferred quarantine waits for the holder to go away).
    holder = None  # None = not probed (outcome could not depend on it)
    try:
        threshold_state, threshold_value = _read_sync_threshold_tristate(palace_path)
        if threshold_state != "value":
            row, stale_seconds = f"threshold-{threshold_state}", float("inf")
        elif threshold_value >= _HIGH_SYNC_THRESHOLD:
            bad_pickle = _bad_pickle_present(palace_path)
            if bad_pickle:
                holder = _daemon_holder_alive()
                if holder:
                    row, stale_seconds = "live-holder", float("inf")
                else:
                    row, stale_seconds = "bad-pickle", 300.0
            else:
                row, stale_seconds = f"high-threshold({threshold_value})", float("inf")
        else:
            holder = _daemon_holder_alive()
            if holder:
                row, stale_seconds = "live-holder", float("inf")
            else:
                row, stale_seconds = f"low-threshold({threshold_value})", 300.0
    except Exception:
        # Classifier failure fails toward SKIP (missed quarantine recoverable;
        # false quarantine kills the holder). Ratio leg still runs below.
        threshold_state, threshold_value = "error", None
        row, stale_seconds = "classifier-error", float("inf")

    _ledger_emit({
        "event": "SweepStarted",
        "row": row,
        "sync_threshold": threshold_value,
        "threshold_state": threshold_state,
        "holder": holder,
        "palace": palace_path,
    })

    # Phase 3 — the stale sweep with the classified stale_seconds.
    try:
        from mempalace.backends.chroma import quarantine_stale_hnsw
        quarantined = quarantine_stale_hnsw(palace_path, stale_seconds=stale_seconds)
        if quarantined:
            for moved in quarantined:
                _ledger_emit({
                    "event": "SegmentQuarantined",
                    "reason": "stale-sweep",
                    "row": row,
                    "gravestone": os.path.basename(str(moved)),
                    "palace": palace_path,
                })
            sys.stderr.write(
                f"[mempalace-bridge] quarantine_stale_hnsw moved {len(quarantined)} stale file(s)\n"
            )
        elif not moved_meta:
            _ledger_emit({
                "event": "QuarantineSkipped",
                "row": row,
                "palace": palace_path,
            })
    except Exception:
        # Quarantine is advisory — never block a live bridge call.
        pass

    # Phase 4 — seed the pkg-side once-per-process gate (RedTeam A1) so
    # same-process pkg delegations (searcher.search_memories, palace
    # .get_collection, convo_miner, layers, diary, closets — all reached from
    # _bridge_drawers/_bridge_kg) do NOT re-run their own UNGATED default-300s
    # sweep at ChromaBackend._prepare_palace_for_open. In-memory only — no
    # site-packages edit. Seed BOTH the verbatim and canonicalized forms: the
    # pkg config canonicalizes via abspath(expanduser()) while get_palace_path
    # returns $MEMPALACE_DIR verbatim, and the gate is string-membership
    # (review #5). A missing/renamed attr is ledgered, never silent — that
    # regression re-opens the bypass and the forensic log must say so.
    try:
        from mempalace.backends.chroma import ChromaBackend
        gate = getattr(ChromaBackend, "_quarantined_paths", None)
        if isinstance(gate, set):
            gate.add(palace_path)
            gate.add(os.path.abspath(os.path.expanduser(palace_path)))
        else:
            _ledger_emit({
                "event": "SeedGateMissing",
                "detail": "ChromaBackend._quarantined_paths absent or not a set — pkg-delegation bypass re-opened",
                "palace": palace_path,
            })
    except Exception:
        pass
    # MP-006 / MP-009: reap aged drift gravestones on the same first-call hot path
    # that already produces and counts them, so disk does not fill monotonically.
    try:
        reaped = _reap_drift_segments(palace_path)
        if reaped:
            sys.stderr.write(
                f"[mempalace-bridge] reaped {reaped} aged drift segment(s)\n"
            )
    except Exception:
        pass


def get_palace_collection():
    """Get or create the ChromaDB collection.

    Cached at module level — repeat calls within the same Python process
    return the same client/collection instance. First call per process runs
    the §14.5 stale-HNSW quarantine sweep.
    """
    global _CACHED_COLLECTION
    if _CACHED_COLLECTION is not None:
        return _CACHED_COLLECTION

    import chromadb
    from chromadb.config import Settings

    palace_path = os.path.join(get_palace_path(), "palace")
    _maybe_quarantine_stale_hnsw(palace_path)
    # anonymized_telemetry=False silences the "capture() takes 1 positional argument"
    # telemetry warnings that otherwise pollute stderr on every invocation.
    #
    # Long-lived-process hardening (daemon): the module-top ANONYMIZED_TELEMETRY
    # pin makes our Settings match mempalace's bare-default open, so this should
    # not conflict. Dormant belt-and-suspenders: if some in-process opener ever
    # claimed chromadb's per-path singleton with a DIFFERENT telemetry setting,
    # binding fails with "already exists ... with different settings"; re-open bare
    # to adopt the existing singleton. NOTE (code-review): the bare retry resolves
    # only a TELEMETRY-only delta — a non-telemetry Settings divergence (e.g.
    # allow_reset) would re-raise. No DOS/mempalace path sets non-default
    # non-telemetry Settings, so this is sufficient today.
    try:
        client = chromadb.PersistentClient(
            path=palace_path,
            settings=Settings(anonymized_telemetry=False),
        )
    except Exception as exc:
        if "already exists" in str(exc) and "different settings" in str(exc):
            client = chromadb.PersistentClient(path=palace_path)
        else:
            raise
    _CACHED_COLLECTION = client.get_or_create_collection("mempalace_drawers")
    return _CACHED_COLLECTION


def _fallback_embedding(text: str, dims: int = 384) -> list[float]:
    """Deterministic local embedding fallback when Chroma's ONNX path fails."""
    import hashlib
    values = []
    seed = text.encode("utf-8", errors="ignore")
    counter = 0
    while len(values) < dims:
        digest = hashlib.sha256(seed + str(counter).encode("ascii")).digest()
        values.extend(((byte / 127.5) - 1.0) for byte in digest)
        counter += 1
    vector = values[:dims]
    norm = sum(v * v for v in vector) ** 0.5 or 1.0
    return [v / norm for v in vector]


def _is_embedding_backend_error(exc: Exception) -> bool:
    message = str(exc)
    return "ONNXRuntimeError" in message or "Error compiling model" in message or "working directory appropriate for URL" in message


def _collection_query(collection, **kwargs):
    try:
        return collection.query(**kwargs)
    except Exception as exc:
        if not _is_embedding_backend_error(exc) or "query_texts" not in kwargs:
            raise
        # MP-044: the dup-check / search query also degrades to the hash fallback
        # when the ONNX backend fails. A query embedded with a non-semantic
        # vector cannot match drawers embedded semantically, so dup detection is
        # silently unreliable here — surface it rather than degrade quietly.
        sys.stderr.write(
            "[mempalace-bridge] embedding backend failed; query degraded to "
            "non-semantic fallback-hash vector (dup/search results unreliable)\n"
        )
        query_texts = kwargs.pop("query_texts")
        kwargs["query_embeddings"] = [_fallback_embedding(str(text)) for text in query_texts]
        return collection.query(**kwargs)


def _flush_collection_durably(collection) -> None:
    """Best-effort durability barrier for a Chroma write (MP-007 / MP-013).

    collection.add/upsert writes Chroma's sqlite segment but leaves the HNSW
    header flush to PersistentClient.__del__/GC. A 5s hook SIGTERM that reaps the
    process before that finalizer runs leaves sqlite newer than the HNSW header,
    which the next open detects as torn and auto-quarantines (the recurring
    `.drift-*` accumulation). This forces the index to flush before the write
    reports success instead of trusting GC + a timed sleep.

    EVERY call is guarded so a chromadb that does not expose a given API can never
    break the write path — we probe several known persist/flush surfaces in order
    and silently stop at the first that exists (or none).
    """
    # 1) Collection-level persist (some chromadb builds expose it directly).
    try:
        persist = getattr(collection, "persist", None)
        if callable(persist):
            persist()
    except Exception:
        pass
    # 2) Underlying client persist (legacy chromadb).
    try:
        client = getattr(collection, "_client", None)
        client_persist = getattr(client, "persist", None) if client is not None else None
        if callable(client_persist):
            client_persist()
    except Exception:
        pass
    # 3) Segment-manager flush (modern chromadb auto-persists but does not fsync
    #    the HNSW header synchronously; flush the producer if reachable).
    try:
        sysdb = getattr(getattr(collection, "_client", None), "_server", None)
        seg_mgr = getattr(sysdb, "_manager", None) if sysdb is not None else None
        flush = getattr(seg_mgr, "flush", None) if seg_mgr is not None else None
        if callable(flush):
            flush()
    except Exception:
        pass


def drain_handles(reason: str) -> None:
    """Single-owner shutdown/invalidation drain (PRD-A, 2026-07-10; RFC-0075 lineage).

    The ONE place the drain ritual lives. Both signal-handler paths call this:
    the daemon's `_drop_palace_handles` and the facade's
    `_facade_drain_palace_handles` are thin delegators — the drain sequence
    itself must never be copied again (the two hand-kept copies drifted: the
    daemon's lacked the durable HNSW flush the facade had).

    Sequence (each step guarded — a drain must never abort shutdown):
      1. close the KG sqlite connection (releases its WAL lock),
      2. flush the cached collection durably (`_flush_collection_durably` —
         MP-005/MP-007/MP-013: never trust PersistentClient.__del__ under
         SIGTERM),
      3. null the three module-level handles so the next action lazy-rebuilds,
      4. gc.collect() so PersistentClient.__del__ runs deterministically.

    Callers may add their OWN post-drain policy (the daemon logs + the facade's
    signal path sleeps 0.2s then exits 128+signum) — policy stays at the call
    site; the ritual lives here.
    """
    global _CACHED_COLLECTION, _CACHED_KG, _WING_INDEX_INITIALIZED
    try:
        if _CACHED_KG is not None:
            try:
                close = getattr(_CACHED_KG, "close", None)
                if callable(close):
                    close()
            except Exception:
                pass
        if _CACHED_COLLECTION is not None:
            try:
                _flush_collection_durably(_CACHED_COLLECTION)
            except Exception:
                pass
        _CACHED_COLLECTION = None
        _CACHED_KG = None
        _WING_INDEX_INITIALIZED = False
        try:
            import gc as _gc
            _gc.collect()
        except Exception:
            pass
    except Exception:
        # Never raise from a drain — worst case is the pre-fix baseline.
        pass


def _collection_add_or_upsert(collection, *, documents, metadatas, ids, upsert: bool = False) -> None:
    method = collection.upsert if upsert else collection.add
    try:
        method(documents=documents, metadatas=metadatas, ids=ids)
    except Exception as exc:
        if not _is_embedding_backend_error(exc):
            raise
        # MP-044: the ONNX embedding backend failed; we fall back to a
        # deterministic sha256 hash vector so the write still persists. That
        # vector is NOT semantic — the drawer is unfindable by vector search.
        # Stamp a metadata marker so the drawer is detectable/re-embeddable and
        # emit a one-line stderr signal instead of degrading silently to 'ok'.
        for _meta in metadatas:
            if isinstance(_meta, dict):
                _meta["embedding"] = "fallback-hash"
        sys.stderr.write(
            "[mempalace-bridge] embedding backend failed; wrote "
            f"{len(documents)} drawer(s) with non-semantic fallback-hash vectors "
            "(unfindable by vector search until re-embedded)\n"
        )
        method(
            documents=documents,
            metadatas=metadatas,
            ids=ids,
            embeddings=[_fallback_embedding(str(doc)) for doc in documents],
        )
    # MP-007 / MP-013: force HNSW durability before returning so a post-return
    # SIGTERM cannot tear the index. Fully guarded — never raises.
    _flush_collection_durably(collection)


def get_kg():
    """Get KnowledgeGraph instance.

    Cached at module level — see get_palace_collection() for rationale.
    """
    global _CACHED_KG
    if _CACHED_KG is not None:
        return _CACHED_KG

    from mempalace.knowledge_graph import KnowledgeGraph

    # Use the active palace root (honors MEMPALACE_DIR in tests), with the
    # canonical knowledge_graph.sqlite3 filename used by the MCP server.
    _CACHED_KG = KnowledgeGraph(os.path.join(get_palace_path(), "knowledge_graph.sqlite3"))
    return _CACHED_KG


# --- Wing Index (secondary SQLite index for fast status queries) ---


def _get_wing_index_path() -> str:
    """Path to the wing_index SQLite database."""
    return os.path.join(get_palace_path(), "wing_index.db")


def _ensure_wing_index() -> sqlite3.Connection:
    """Create wing_index table if it does not exist. Returns open connection.

    The wing_index is a secondary index maintained alongside ChromaDB so that
    status queries do not need to iterate all drawer metadata. Every add_drawer,
    upsert_drawer, and update_drawer call updates this index.

    Schema:
        drawer_id  TEXT PRIMARY KEY  — matches ChromaDB drawer ID
        wing       TEXT NOT NULL
        room       TEXT NOT NULL
    """
    global _WING_INDEX_INITIALIZED
    conn = sqlite3.connect(_get_wing_index_path())
    if not _WING_INDEX_INITIALIZED:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS wing_index (
                drawer_id TEXT PRIMARY KEY,
                wing TEXT NOT NULL,
                room TEXT NOT NULL
            )"""
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_wing ON wing_index(wing)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_wing_room ON wing_index(wing, room)")
        conn.commit()
        _WING_INDEX_INITIALIZED = True
    return conn


def _wing_index_upsert(drawer_id: str, wing: str, room: str) -> None:
    """Record or update a drawer in the wing index. Failures are silent
    so that wing_index never blocks a drawer write."""
    try:
        conn = _ensure_wing_index()
        conn.execute(
            "INSERT OR REPLACE INTO wing_index (drawer_id, wing, room) VALUES (?, ?, ?)",
            (drawer_id, wing, room),
        )
        conn.commit()
        conn.close()
    except Exception:
        pass  # Index is advisory — do not fail the primary write


def _import_err(module: str, err: Exception) -> dict:
    """Consistent error shape for optional dependency failures."""
    return {
        "status": "error",
        "error_type": "missing_dependency",
        "module": module,
        "message": f"Required MemPalace module '{module}' could not be imported: {err}",
        "fix": "Ensure the 'mempalace' Python package is installed (pip install mempalace or check PYTHONPATH)",
    }


# --- Actions ---


def init(args: dict = None) -> dict:
    """Create palace directory, ChromaDB collection, and KG database.

    Non-interactive. Safe to call multiple times (idempotent).
    """
    palace_root = get_palace_path()
    palace_dir = os.path.join(palace_root, "palace")

    # Create directories
    os.makedirs(palace_dir, exist_ok=True)
    os.makedirs(os.path.join(palace_root, "agents"), exist_ok=True)

    # Initialize ChromaDB collection (creates DB files on disk)
    import chromadb

    # MP-088: run the §14.5 stale-HNSW quarantine sweep before opening, mirroring
    # get_palace_collection(). If a torn HNSW segment exists when init runs, the
    # two entry points must not diverge on the same corruption hazard — the sweep
    # is idempotent and silent on a healthy palace.
    _maybe_quarantine_stale_hnsw(palace_dir)
    client = chromadb.PersistentClient(path=palace_dir)
    collection = client.get_or_create_collection("mempalace_drawers")

    # Initialize KG database (uses MemPalace's default path: knowledge_graph.sqlite3)
    kg_path = os.path.join(palace_root, "knowledge_graph.sqlite3")
    try:
        from mempalace.knowledge_graph import KnowledgeGraph

        KnowledgeGraph(kg_path)
    except Exception:
        # Fall back to direct SQLite creation. The CREATE TABLE statements must
        # byte-match mempalace.knowledge_graph.KnowledgeGraph._init_db so that
        # if the library is unimportable here (transient mid-install failure)
        # but importable on a later call, add_kg_fact/merge_entities/update_entity
        # operate against a schema the library understands (valid_to/confidence/
        # TEXT id/entities table — NOT the old divergent `ended`/INTEGER-id form).
        import sqlite3

        conn = sqlite3.connect(kg_path)
        conn.executescript(
            """
            PRAGMA journal_mode=WAL;

            CREATE TABLE IF NOT EXISTS entities (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT DEFAULT 'unknown',
                properties TEXT DEFAULT '{}',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS triples (
                id TEXT PRIMARY KEY,
                subject TEXT NOT NULL,
                predicate TEXT NOT NULL,
                object TEXT NOT NULL,
                valid_from TEXT,
                valid_to TEXT,
                confidence REAL DEFAULT 1.0,
                source_closet TEXT,
                source_file TEXT,
                source_drawer_id TEXT,
                adapter_name TEXT,
                extracted_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (subject) REFERENCES entities(id),
                FOREIGN KEY (object) REFERENCES entities(id)
            );

            CREATE INDEX IF NOT EXISTS idx_triples_subject ON triples(subject);
            CREATE INDEX IF NOT EXISTS idx_triples_object ON triples(object);
            CREATE INDEX IF NOT EXISTS idx_triples_predicate ON triples(predicate);
            CREATE INDEX IF NOT EXISTS idx_triples_valid ON triples(valid_from, valid_to);
            """
        )
        conn.commit()
        conn.close()

    # Write minimal config
    config_path = os.path.join(palace_root, "config.json")
    if not os.path.exists(config_path):
        import json as _json

        with open(config_path, "w") as f:
            _json.dump({"palace_path": palace_dir, "version": "1.0.0"}, f, indent=2)

    return {
        "status": "ok",
        "palace_path": palace_root,
        "palace_db": palace_dir,
        "kg_db": kg_path,
        "collection_count": collection.count(),
    }


# RFC-0148 PROP-1 — the two canonical reflection shapes (council-ratified,
# warn-first). An entry CONFORMS iff all required keys of exactly one shape
# are present AND no key falls outside that shape's required+optional set.
_REFLECTION_SHAPES = {
    "doctrine_12": {
        "required": (
            "timestamp",
            "effort_level",
            "task_description",
            "criteria_count",
            "criteria_passed",
            "criteria_failed",
            "prd_id",
            "implied_sentiment",
            "reflection_q1",
            "reflection_q2",
            "reflection_q3",
            "within_budget",
        ),
        "optional": ("reflection_q4",),
    },
    "runtime_8": {
        "required": (
            "timestamp",
            "effort",
            "phase",
            "prd_id",
            "implied_sentiment",
            "reflection",
            "session_id",
        ),
        "optional": ("tags", "backfill_provenance"),
    },
}


def _reflection_expected_shapes() -> dict:
    """Corrective payload for block-mode rejections: each shape's key list,
    optional keys suffixed with '?'."""
    return {
        name: list(shape["required"]) + ["%s?" % k for k in shape["optional"]]
        for name, shape in _REFLECTION_SHAPES.items()
    }


def _validate_reflection_shape(entry: dict) -> list:
    """Check `entry` against the canonical shapes.

    Returns [] when the entry conforms to at least one shape; otherwise a
    list of human-readable error strings diagnosing the closest shape
    (fewest missing+extra keys) by naming its missing and unexpected fields.
    """
    keys = set(entry.keys())
    diagnoses = []
    for name, shape in _REFLECTION_SHAPES.items():
        required = set(shape["required"])
        allowed = required | set(shape["optional"])
        missing = required - keys
        extra = keys - allowed
        if not missing and not extra:
            return []
        diagnoses.append((len(missing) + len(extra), name, missing, extra))

    _, name, missing, extra = min(diagnoses, key=lambda d: d[0])
    errors = [
        "entry matches neither canonical reflection shape (closest: %s)" % name
    ]
    if missing:
        errors.append("%s: missing required keys: %s" % (name, ", ".join(sorted(missing))))
    if extra:
        errors.append("%s: unexpected keys: %s" % (name, ", ".join(sorted(extra))))
    return errors


def _format_reflection_utc_z(dt: datetime) -> str:
    """Serialize an aware-UTC datetime as YYYY-MM-DDTHH:MM:SSZ, preserving
    milliseconds only when the sub-second part is non-zero."""
    millis = dt.microsecond // 1000
    if millis:
        return dt.strftime("%Y-%m-%dT%H:%M:%S") + ".%03dZ" % millis
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _normalize_reflection_timestamp(ts) -> tuple:
    """Normalize an entry timestamp to canonical UTC-Z form.

    Returns (normalized, error):
      - aware (UTC or offset) ISO-8601 string → (UTC-Z string, None);
        an already-Z input is returned byte-identical.
      - naive ISO-8601 string → (UTC-Z string assuming UTC, error) —
        a violation, but warn mode can still write the normalized value.
      - non-string or unparseable → (None, error) — unrecoverable; warn
        mode writes the value as-is.
    """
    if not isinstance(ts, str) or not ts:
        return None, "timestamp must be a non-empty ISO-8601 string (got %r)" % (ts,)
    try:
        parsed = datetime.fromisoformat(ts[:-1] + "+00:00" if ts.endswith("Z") else ts)
    except ValueError:
        return None, "timestamp %r is not a parseable ISO-8601 string" % ts
    if parsed.tzinfo is None:
        assumed = parsed.replace(tzinfo=timezone.utc)
        return (
            _format_reflection_utc_z(assumed),
            "timestamp %r has no timezone; assumed UTC" % ts,
        )
    if ts.endswith("Z"):
        return ts, None
    return _format_reflection_utc_z(parsed.astimezone(timezone.utc)), None


_REFLECTION_FIELD_TYPES = {
    # Type contract mirrored from the canonical reader's checkRuntimeTypes
    # (reflection-jsonl-entry.ts) — the bridge must not certify what the
    # upcaster quarantines (CATO parity / code-review F6).
    "timestamp": (str,),
    "prd_id": (str,),
    "implied_sentiment": (int, float),
    "effort": (str,),
    "phase": (str,),
    "reflection": (str,),
    "session_id": (str,),
    "effort_level": (str,),
    "task_description": (str,),
    "criteria_count": (int,),
    "criteria_passed": (int,),
    "criteria_failed": (int,),
    "reflection_q1": (str,),
    "reflection_q2": (str,),
    "reflection_q3": (str,),
    "reflection_q4": (str,),
    "within_budget": (bool,),
    "tags": (list,),
}


def _validate_reflection_types(entry: dict) -> list:
    """Value-type checks over whichever canonical keys are present."""
    errors = []
    for key, allowed in _REFLECTION_FIELD_TYPES.items():
        if key not in entry:
            continue
        value = entry[key]
        # bool is an int subclass — reject it where a number is expected.
        if isinstance(value, bool) and bool not in allowed:
            errors.append("%s: expected %s, got bool" % (key, "/".join(t.__name__ for t in allowed)))
            continue
        if not isinstance(value, tuple(allowed)):
            errors.append(
                "%s: expected %s, got %s" % (key, "/".join(t.__name__ for t in allowed), type(value).__name__)
            )
    return errors


def _diagnose_reflection_shape(entry: dict) -> dict:
    """Structured diagnosis for the violation log (RFC-0148 §2 field set).

    Returns {} when the entry conforms; otherwise the nearest shape's name
    plus its missing/extra key lists.
    """
    keys = set(entry.keys())
    diagnoses = []
    for name, shape in _REFLECTION_SHAPES.items():
        required = set(shape["required"])
        allowed = required | set(shape["optional"])
        missing = required - keys
        extra = keys - allowed
        if not missing and not extra:
            return {}
        diagnoses.append((len(missing) + len(extra), name, missing, extra))
    _, name, missing, extra = min(diagnoses, key=lambda d: d[0])
    return {
        "nearest_shape": name,
        "missing_keys": sorted(missing),
        "extra_keys": sorted(extra),
    }


def _log_reflection_schema_violation(
    violations_path: str, entry: dict, errors: list, mode: str, verdict: str
) -> None:
    """Append one small JSON line to the violation log (the soak instrument).

    Field set per RFC-0148 §2 — {timestamp, mode, verdict, nearest_shape,
    missing_keys, extra_keys, source} — plus prd_id/keys/errors for
    operator forensics. Fires for EVERY violation in BOTH modes (a block-mode
    rejection must be visible to the arm-criterion soak, else the flip is
    measured blind — CATO-RFC0148-01).

    Plain open-append on purpose: the line is far below PIPE_BUF so O_APPEND
    is already atomic, and this MUST NOT call append_reflection (recursion).
    """
    parent = os.path.dirname(violations_path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    diagnosis = _diagnose_reflection_shape(entry)
    line = json.dumps(
        {
            "timestamp": _format_reflection_utc_z(datetime.now(timezone.utc)),
            "mode": mode,
            "verdict": verdict,
            "nearest_shape": diagnosis.get("nearest_shape"),
            "missing_keys": diagnosis.get("missing_keys", []),
            "extra_keys": diagnosis.get("extra_keys", []),
            "source": "append_reflection",
            "prd_id": entry.get("prd_id"),
            "keys": sorted(entry.keys()),
            "errors": errors,
        },
        ensure_ascii=False,
    ) + "\n"
    with open(violations_path, "a", encoding="utf-8") as f:
        f.write(line)


def append_reflection(args: dict) -> dict:
    """Atomically append a reflection JSONL entry.

    Closes the doctrine gap: Algorithm v0.0.7-enhanced LEARN prescribes
    `echo '{...}' >> algorithm-reflections.jsonl`. POSIX O_APPEND atomicity
    is guaranteed only at sizes <= PIPE_BUF (4096 bytes); reflection lines
    routinely exceed that, so concurrent writers can interleave bytes.
    PhaseCompleteGate then JSON.parses each line and silently skips any
    that fail — the matching prd_id appears "missing".

    This action wraps the write in fcntl.flock + write + fsync so the line
    lands as one atomic unit and is durable before return. The serialized
    line is constructed from the entry dict so callers cannot smuggle in
    unescaped quotes or newlines.

    Schema validation (RFC-0148 PROP-1, warn-first): the entry is checked
    against the two canonical shapes (DOCTRINE_12, RUNTIME_8) and its
    timestamp is normalized to YYYY-MM-DDTHH:MM:SSZ in BOTH modes (offset
    timezones converted to UTC, milliseconds preserved when non-zero,
    already-Z inputs byte-identical). DOS_REFLECTION_SCHEMA_MODE selects
    the posture — 'warn' (default, and the default for any unrecognized
    value): write anyway, append one JSON line to the violations log, and
    return schema_warnings; 'block': write nothing and return a corrective
    {"status": "schema-violation"} payload (never raises — callers need
    the expected_shapes to self-correct).

    Args:
        entry — required. Dict that becomes the JSON line.
        path  — optional. Override target. Defaults to
                ~/.claude/MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl.
        violations_path — optional. Override the warn-mode violation log.
                Defaults to ~/.claude/MEMORY/STATE/reflection-schema-violations.jsonl.
    """
    import fcntl

    entry = args.get("entry")
    if entry is None:
        raise KeyError("entry")
    if not isinstance(entry, dict):
        raise TypeError("entry must be a dict")

    path = args.get("path") or os.path.join(
        os.path.expanduser("~"),
        ".claude",
        "MEMORY",
        "LEARNING",
        "REFLECTIONS",
        "algorithm-reflections.jsonl",
    )
    violations_path = args.get("violations_path") or os.path.join(
        os.path.expanduser("~"),
        ".claude",
        "MEMORY",
        "STATE",
        "reflection-schema-violations.jsonl",
    )

    mode = os.environ.get("DOS_REFLECTION_SCHEMA_MODE", "warn").strip().lower()
    if mode != "block":
        mode = "warn"

    errors = _validate_reflection_shape(entry)
    errors.extend(_validate_reflection_types(entry))

    if "timestamp" in entry:
        normalized, ts_error = _normalize_reflection_timestamp(entry["timestamp"])
        if ts_error is not None:
            errors.append(ts_error)
        if normalized is not None and normalized != entry["timestamp"]:
            entry = dict(entry)
            entry["timestamp"] = normalized

    if errors and mode == "block":
        try:
            _log_reflection_schema_violation(
                violations_path, entry, errors, mode, "rejected-block"
            )
        except OSError:
            pass  # soak instrument is best-effort; the rejection payload still returns
        return {
            "status": "schema-violation",
            "mode": "block",
            "errors": errors,
            "expected_shapes": _reflection_expected_shapes(),
        }

    os.makedirs(os.path.dirname(path), exist_ok=True)

    line = json.dumps(entry, ensure_ascii=False) + "\n"

    fd = os.open(path, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o644)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        try:
            os.write(fd, line.encode("utf-8"))
            os.fsync(fd)
        finally:
            fcntl.flock(fd, fcntl.LOCK_UN)
    finally:
        os.close(fd)

    if errors:
        try:
            _log_reflection_schema_violation(
                violations_path, entry, errors, mode, "accepted-warn"
            )
        except OSError:
            pass  # the reflection is already durable; never fail the write over telemetry
        return {
            "status": "ok",
            "path": path,
            "bytes": len(line),
            "schema_warnings": errors,
        }

    return {"status": "ok", "path": path, "bytes": len(line)}


# RFC-0010 §9.1 — artifact-id pattern for `suggest_parent`.
# Matches the five canonical lineage types: RFC-\d+, SPEC-*, PLAN-*, ROADMAP-*,
# and timestamped PRD slugs like 20260421-114954_lineage-graph-ingest-phase-b1.
_ARTIFACT_ID_RE = re.compile(
    r"\b(?:RFC|SPEC|PLAN|ROADMAP)-[A-Za-z0-9_-]+"
    r"|\b\d{8}-\d{6}_[a-z0-9][a-z0-9_-]*"
)

# Calibrated against the Durante corpus (Phase 3.a.1, 2026-04-21).
# Under Chroma's cosine distance → (1 - distance) mapping, direct hits
# (e.g., "RFC-0010 lineage protocol" against the RFC-0010 drawer) top
# out at ~0.21. RFC-0010 §9.3's 0.8 is aspirational for an ideal
# embedding where identical content scores near 1.0 — our BGE-small
# embeddings don't reach that ceiling in practice. 0.15 is the
# honest "signal above noise" floor against the current corpus; the
# caller can still pass a higher value for stricter filtering.
SUGGEST_PARENT_DEFAULT_MIN_CONFIDENCE = 0.15


def _find_projects_file(start: str | None = None) -> str | None:
    """Walk cwd (or `start`) up to $HOME looking for `.dos-projects.json`.

    Probes both `<ancestor>/Tools/.dos-projects.json` (canonical per
    Tools/lineage.ts DEFAULT_PROJECTS_JSON_PATH, emitted by
    `bun Tools/lineage.ts projects`) and `<ancestor>/.dos-projects.json`
    (repo-root fallback, in case a project opts in without a Tools/ dir).

    Returns the absolute path to the first match, or None if none found
    before hitting $HOME or the filesystem root. RFC-0010 §11.4 — the
    file's presence is the opt-in signal for lineage tooling; projects
    that don't carry it should never see suggestion hooks.
    """
    cwd = os.path.abspath(start or os.getcwd())
    home = os.path.expanduser("~")
    cursor = cwd
    while True:
        for rel in ("Tools/.dos-projects.json", ".dos-projects.json"):
            candidate = os.path.join(cursor, rel)
            if os.path.isfile(candidate):
                return candidate
        parent = os.path.dirname(cursor)
        # Stop at filesystem root OR once we pass above $HOME.
        if parent == cursor or cursor == home:
            return None
        cursor = parent


def suggest_parent(args: dict, _collection=None) -> dict:
    """RFC-0010 §9 — rank candidate parent artifacts for a PRD task description.

    Thin post-processor over `search`. Returns candidates whose drawer content
    mentions an artifact id (RFC/SPEC/PLAN/ROADMAP or timestamped PRD slug) AND
    whose similarity score meets the caller's `min_confidence` threshold.

    Args:
      task (str, required): the PRD task description to match against.
      limit (int, default 3): max candidates to return.
      min_confidence (float, default 0.15 — see calibration note below).
      wing (str, optional): restrict search to a specific wing.
      require_projects_file (bool, default False): if True, hard-gate on
        `.dos-projects.json` presence walking cwd up to $HOME. Missing file
        short-circuits to `{gated: True, reason: "no-projects-file"}`
        WITHOUT invoking MemPalace. RFC-0010 §11.4 opt-in gate.

    Returns:
      {
        "query": str,
        "threshold": float,
        "candidates": [
          {"artifactId": str, "title": str, "confidence": float,
           "signal_source": "hybrid" | "distance"},
          ...
        ],
        "count": int,
        "gated": bool (only present when require_projects_file gate fires),
        "reason": str (only present on early-exit paths),
      }

    Confidence is normalized to [0, 1]:
      - Hybrid (`mempalace.searcher`) path: when `score` is returned directly,
        used verbatim and tagged `signal_source: "hybrid"`.
      - Layer3 / distance-only: `confidence = max(0, 1 - distance)`, tagged
        `signal_source: "distance"`.
    Drawers with neither signal (or no extractable artifact id) are skipped.

    Calibration note: RFC-0010 §9.3 specifies 0.8 as the aspirational "signal
    above noise" threshold — that target assumes an ideal embedding where
    identical content scores near 1.0. Against the live Durante corpus with
    BGE-small cosine-distance embeddings, direct hits top out near 0.21.
    The 0.15 default is empirically calibrated — permissive enough to surface
    real matches, restrictive enough to drop obvious noise. Callers tuning
    against richer corpora (larger models, longer drawers, etc.) can pass
    higher thresholds.

    This action MUST NOT write `parent:` anywhere — it only returns candidates.
    """
    # Lazy import to avoid circular dep: drawers imports palace; palace.suggest_parent
    # calls drawers.search. Sibling-module import works because the facade prepends
    # this directory to sys.path before dispatch.
    import _bridge_drawers as _drawers
    task = (args.get("task") or args.get("text") or "").strip()
    try:
        min_confidence = float(args.get("min_confidence", SUGGEST_PARENT_DEFAULT_MIN_CONFIDENCE))
    except (TypeError, ValueError):
        min_confidence = SUGGEST_PARENT_DEFAULT_MIN_CONFIDENCE

    # Opt-in gate: bail before any MemPalace work when requested by caller
    # and `.dos-projects.json` is absent from cwd..$HOME.
    if args.get("require_projects_file"):
        projects_path = _find_projects_file()
        if projects_path is None:
            return {
                "query": task,
                "threshold": min_confidence,
                "candidates": [],
                "count": 0,
                "gated": True,
                "reason": "no-projects-file",
            }

    if not task:
        return {
            "query": "",
            "threshold": min_confidence,
            "candidates": [],
            "count": 0,
            "reason": "empty-task",
        }

    try:
        limit = int(args.get("limit", 3))
    except (TypeError, ValueError):
        limit = 3
    wing = args.get("wing")

    # Overfetch so post-filter + extraction still yields `limit` hits.
    search_limit = max(limit * 3, 10)
    search_args = {"query": task, "limit": search_limit}
    if wing:
        search_args["wing"] = wing

    try:
        raw = _drawers.search(search_args, _collection)
    except Exception as exc:  # pragma: no cover — defensive: never crash OBSERVE
        return {
            "query": task,
            "threshold": min_confidence,
            "candidates": [],
            "count": 0,
            "reason": f"search-error: {exc}",
        }

    results = raw.get("results", []) if isinstance(raw, dict) else []
    candidates = []
    seen_ids = set()

    for r in results:
        if not isinstance(r, dict):
            continue
        meta = r.get("metadata") or {}
        content = r.get("content") or r.get("text") or ""

        # Prefer explicit metadata.artifactId; fall back to regex on first 500 chars.
        artifact_id = meta.get("artifactId") if isinstance(meta, dict) else None
        if not artifact_id and isinstance(content, str):
            match = _ARTIFACT_ID_RE.search(content[:500])
            if match:
                artifact_id = match.group(0)
        if not artifact_id or artifact_id in seen_ids:
            continue

        # Confidence: hybrid path returns `score` (higher = better);
        # Layer3 returns cosine `distance` (lower = better). Track which
        # so downstream calibration can partition results by path.
        score = r.get("score")
        distance = r.get("distance")
        confidence = None
        signal_source = None
        if score is not None:
            try:
                confidence = max(0.0, min(1.0, float(score)))
                signal_source = "hybrid"
            except (TypeError, ValueError):
                confidence = None
        if confidence is None and distance is not None:
            try:
                confidence = max(0.0, 1.0 - float(distance))
                signal_source = "distance"
            except (TypeError, ValueError):
                confidence = None
        if confidence is None or confidence < min_confidence:
            continue

        title = None
        if isinstance(meta, dict):
            title = meta.get("title")
        if not title and isinstance(content, str) and content.strip():
            # Skip YAML frontmatter delimiters, blank lines, and frontmatter
            # keys. Pick the first prose line (commonly a markdown heading
            # or the `title:` value from frontmatter).
            for raw_line in content.splitlines():
                line = raw_line.strip()
                if not line or line == "---":
                    continue
                if line.lower().startswith("title:"):
                    title = line.split(":", 1)[1].strip().strip('"\'')[:140]
                    if title:
                        break
                if line.startswith("#"):
                    title = line.lstrip("#").strip()[:140]
                    if title:
                        break
                # Skip any frontmatter-shaped line: `key:` or `key: value`
                # (lowercase identifier followed by colon and whitespace).
                if re.match(r"^[A-Za-z_][A-Za-z0-9_-]*:\s", line) or re.fullmatch(r"[A-Za-z_][A-Za-z0-9_-]*:", line):
                    continue
                # Non-heading non-frontmatter content — use verbatim.
                title = line[:140]
                break
        if not title:
            title = artifact_id

        candidates.append({
            "artifactId": artifact_id,
            "title": title,
            "confidence": round(confidence, 3),
            "signal_source": signal_source or "distance",
        })
        seen_ids.add(artifact_id)
        if len(candidates) >= limit:
            break

    return {
        "query": task,
        "threshold": min_confidence,
        "candidates": candidates,
        "count": len(candidates),
    }


def status(args: dict = None) -> dict:
    """Palace overview: wings, rooms, drawer counts.

    Uses the wing_index secondary SQLite table for O(wings*rooms) aggregation
    instead of iterating every drawer's metadata. Falls back to metadata
    iteration if the wing_index is empty or stale (migration path).

    Optional args:
        skip_wings — bool, skip wing/room breakdown (just total count)
        rebuild_index — bool, rebuild wing_index from ChromaDB metadata before querying
    """
    args = args or {}
    skip_wings = args.get("skip_wings", False)
    rebuild_index = args.get("rebuild_index", False)

    collection = get_palace_collection()
    total = collection.count()

    # Auto-detect wing_index drift — convo_miner and other bulk write paths
    # bypass _wing_index_upsert, leaving wing_index stale. If indexed-row
    # count differs from chromadb total by >5%, force a rebuild here so the
    # caller (typically a statusline render or `palace status` query) sees
    # accurate per-wing counts. Override-able by passing rebuild_index=false
    # explicitly is NOT honored — drift detection is mandatory.
    if not skip_wings and not rebuild_index and total > 0:
        try:
            probe_conn = _ensure_wing_index()
            indexed = probe_conn.execute("SELECT COUNT(*) FROM wing_index").fetchone()[0]
            probe_conn.close()
            if indexed < int(total * 0.95):
                rebuild_index = True
        except Exception:
            pass  # Drift detection is best-effort; fall through to slow path

    # Optionally rebuild the wing_index from ChromaDB (migration helper)
    if rebuild_index and total > 0:
        try:
            conn = _ensure_wing_index()
            conn.execute("DELETE FROM wing_index")
            page_size = 1000
            offset = 0
            while offset < total:
                page = collection.get(include=["metadatas"], limit=page_size, offset=offset)
                ids = page.get("ids", [])
                metas = page.get("metadatas", [])
                rows = []
                for i, meta in enumerate(metas):
                    if not meta or i >= len(ids):
                        continue
                    rows.append((
                        ids[i],
                        meta.get("wing", "uncategorized"),
                        meta.get("room", "uncategorized"),
                    ))
                if rows:
                    conn.executemany(
                        "INSERT OR REPLACE INTO wing_index (drawer_id, wing, room) VALUES (?, ?, ?)",
                        rows,
                    )
                offset += page_size
                if len(metas) < page_size:
                    break
            conn.commit()
            conn.close()
        except Exception:
            pass  # Fall through to the slow path below

    wings: dict = {}
    index_source = "wing_index"

    if not skip_wings and total > 0:
        # Fast path: read aggregated counts directly from wing_index
        try:
            conn = _ensure_wing_index()
            cur = conn.execute(
                "SELECT wing, room, COUNT(*) FROM wing_index GROUP BY wing, room"
            )
            rows = cur.fetchall()
            conn.close()

            if rows:
                for wing, room, count in rows:
                    wings.setdefault(wing, {})
                    wings[wing][room] = count
            else:
                # wing_index empty — fall back to metadata scan (migration path)
                index_source = "metadata_fallback"
                page_size = 1000
                offset = 0
                while offset < total:
                    page = collection.get(
                        include=["metadatas"], limit=page_size, offset=offset
                    )
                    for meta in page.get("metadatas", []):
                        if not meta:
                            continue
                        wing = meta.get("wing", "uncategorized")
                        room = meta.get("room", "uncategorized")
                        wings.setdefault(wing, {})
                        wings[wing][room] = wings[wing].get(room, 0) + 1
                    offset += page_size
                    if len(page.get("metadatas", [])) < page_size:
                        break
        except Exception as e:
            index_source = f"error: {e}"

    # KG stats — prefer native stats() method
    kg_stats: dict = {}
    try:
        kg = get_kg()
        if hasattr(kg, "stats"):
            kg_stats = kg.stats()
        else:
            kg_stats = {"status": "stats method unavailable"}
    except Exception as e:
        kg_stats = {"status": "not initialized", "error": str(e)}

    # Hall distribution — scan metadata for hall field counts
    halls: dict = {}
    if not skip_wings and total > 0:
        try:
            page_size = 1000
            offset = 0
            while offset < total:
                page = collection.get(include=["metadatas"], limit=page_size, offset=offset)
                for meta in page.get("metadatas", []):
                    if meta and "hall" in meta:
                        h = meta["hall"]
                        halls[h] = halls.get(h, 0) + 1
                offset += page_size
                if len(page.get("metadatas", [])) < page_size:
                    break
        except Exception:
            pass

    return {
        "total_drawers": total,
        "wings": {w: {"rooms": rooms, "total": sum(rooms.values())} for w, rooms in wings.items()},
        "wing_count": len(wings),
        "halls": halls,
        "knowledge_graph": kg_stats,
        "palace_path": get_palace_path(),
        "index_source": index_source,
        "version": __version__,
    }


def wake_up(args: dict = None) -> dict:
    """Generate L0+L1 wake-up context for session start.

    Returns token-optimized context (~600-900 tokens) with identity
    and essential story from the palace. Optionally scoped to a wing.
    """
    args = args or {}
    try:
        from mempalace.layers import MemoryStack
    except ImportError as e:
        return _import_err("mempalace.layers", e)

    palace_path = os.path.join(get_palace_path(), "palace")

    try:
        stack = MemoryStack(palace_path=palace_path)
        wing = args.get("wing")
        context = stack.wake_up(wing=wing)
    except Exception as e:
        return {
            "status": "error",
            "error_type": "wake_up_failed",
            "message": str(e),
            "wing": args.get("wing"),
        }

    token_estimate = len(context) // 4  # Rough estimate

    return {
        "status": "ok",
        "context": context,
        "token_estimate": token_estimate,
        "wing": args.get("wing"),
    }


def classify(args: dict) -> dict:
    """Classify text into memory types using general_extractor.

    Returns decision/preference/milestone/problem/emotional labels.
    Zero LLM calls — pure regex heuristics.
    """
    try:
        from mempalace.general_extractor import extract_memories
    except ImportError as e:
        return _import_err("mempalace.general_extractor", e)

    text = args["text"]
    min_confidence = args.get("min_confidence", 0.3)

    try:
        memories = extract_memories(text, min_confidence=min_confidence)
    except Exception as e:
        return {"status": "error", "message": str(e)}

    return {
        "status": "ok",
        "memories": memories,
        "count": len(memories),
        "types_found": list(set(m.get("memory_type", "unknown") for m in memories)),
    }


def traverse(args: dict) -> dict:
    """Walk the palace graph from a room, discovering connections.

    BFS traversal through connected rooms across wings. Finds implicit
    cross-domain relationships (the "tunnels" between wings).
    """
    try:
        from mempalace.palace_graph import traverse as graph_traverse
    except ImportError as e:
        return _import_err("mempalace.palace_graph", e)

    start_room = args["start_room"]
    max_hops = args.get("max_hops", 2)

    try:
        connected = graph_traverse(start_room, max_hops=max_hops)
    except Exception as e:
        return {"status": "error", "message": str(e)}

    return {
        "status": "ok",
        "start_room": start_room,
        "max_hops": max_hops,
        "connected": connected,
        "count": len(connected),
    }


def find_tunnels(args: dict = None) -> dict:
    """Find rooms that bridge two wings — cross-domain connections.

    With wing_a + wing_b: rooms in both. With only wing_a: all tunnels from it.
    No args: all tunnel rooms (rooms appearing in 2+ wings).
    """
    try:
        from mempalace.palace_graph import find_tunnels as graph_find_tunnels
    except ImportError as e:
        return _import_err("mempalace.palace_graph", e)

    args = args or {}
    wing_a = args.get("wing_a")
    wing_b = args.get("wing_b")

    try:
        tunnels = graph_find_tunnels(wing_a=wing_a, wing_b=wing_b)
    except Exception as e:
        return {"status": "error", "message": str(e)}

    return {
        "status": "ok",
        "wing_a": wing_a,
        "wing_b": wing_b,
        "tunnels": tunnels,
        "count": len(tunnels),
    }


def create_tunnel(args: dict) -> dict:
    """Create an explicit cross-wing tunnel between two (wing, room) endpoints.

    V11.14 item 1 (RFC-0035 §3 item 3): a thin alias over
    `mempalace.palace_graph.create_tunnel`, exposing the upstream tunnel-creation
    surface to DOS hooks alongside `find_tunnels` / `follow_tunnels` /
    `list_tunnels`. The persistence target (`~/.mempalace/tunnels.json`) and
    canonical-ID derivation are owned by the upstream library — this action is
    a shape-preserving wrapper so callers do not have to import mempalace
    directly.

    Args:
        source_wing      — required. Wing name on the source side.
        source_room      — required. Room within source_wing.
        target_wing      — required. Wing name on the target side.
        target_room      — required. Room within target_wing.
        label            — optional human-readable description (default '').
        source_drawer_id — optional drawer-level anchor on the source side.
        target_drawer_id — optional drawer-level anchor on the target side.
        kind             — optional tunnel kind (default 'explicit'). Upstream
                           reserves 'topic' / 'inferred' for compute_topic_tunnels.

    Returns:
        {"status": "ok", "tunnel": {...}}  — the upstream tunnel record.
        {"status": "error", "message": ...} — on import or runtime failure.
    """
    try:
        from mempalace.palace_graph import create_tunnel as graph_create_tunnel
    except ImportError as e:
        return _import_err("mempalace.palace_graph", e)

    # Required keys — let KeyError surface to the CLI's MCP-style missing_arg path.
    source_wing = args["source_wing"]
    source_room = args["source_room"]
    target_wing = args["target_wing"]
    target_room = args["target_room"]

    label = args.get("label", "")
    source_drawer_id = args.get("source_drawer_id")
    target_drawer_id = args.get("target_drawer_id")
    kind = args.get("kind", "explicit")

    try:
        tunnel = graph_create_tunnel(
            source_wing=source_wing,
            source_room=source_room,
            target_wing=target_wing,
            target_room=target_room,
            label=label,
            source_drawer_id=source_drawer_id,
            target_drawer_id=target_drawer_id,
            kind=kind,
        )
    except Exception as e:
        return {"status": "error", "message": str(e)}

    return {
        "status": "ok",
        "tunnel": tunnel,
        "source_wing": source_wing,
        "source_room": source_room,
        "target_wing": target_wing,
        "target_room": target_room,
        "kind": kind,
    }


def batch(args) -> dict:
    """Execute multiple operations in a single subprocess call.

    Dramatically reduces overhead for bulk operations (e.g. sentinel scan writing
    16 KG triples + 5 drawers). Shares ONE ChromaDB client and ONE KG connection
    across all operations.

    Args (two accepted forms — prefer the dict form for new code):

        Dict form (preferred):
            {"operations": [{"action": "...", "args": {...}}, ...]}

        List form (legacy / shorthand):
            [{"action": "...", "args": {...}}, ...]

    Each operation must be a dict with:
        action — required. Must be one of the registered action names.
        args   — optional dict. Defaults to {}.

    Returns:
        {
            "status": "ok" | "partial",
            "results": [{status per op}, ...],
            "count": N,
            "errors": N,
            "validation_errors": [{index, reason}, ...]  # only if any
        }
    """
    # Reuse the cached ACTIONS table built by the facade at import time.
    # Falls back to building locally if the facade hasn't run yet (e.g. when
    # batch() is called from a unit test that imports _bridge_palace directly
    # without going through bridge.py).
    ACTIONS = _get_or_build_actions()

    # Accept raw list or {"operations": [...]}
    if isinstance(args, list):
        operations = args
    elif isinstance(args, dict):
        operations = args.get("operations", [])
    else:
        return {
            "status": "error",
            "error_type": "invalid_batch_args",
            "message": f"batch expects a list or dict with 'operations' key, got {type(args).__name__}",
        }

    if not operations:
        return {"status": "error", "error_type": "empty_batch", "message": "No operations provided"}

    # Validate all operations up-front — better errors before any side effects
    validation_errors = []
    for i, op in enumerate(operations):
        if not isinstance(op, dict):
            validation_errors.append({"index": i, "reason": f"Not a dict: {type(op).__name__}"})
            continue
        if "action" not in op:
            validation_errors.append({"index": i, "reason": "Missing 'action' key"})
            continue
        if op["action"] not in ACTIONS:
            validation_errors.append({
                "index": i,
                "reason": f"Unknown action: {op['action']}",
                "available": sorted(ACTIONS.keys()),
            })
            continue
        if "args" in op and not isinstance(op["args"], dict):
            validation_errors.append({
                "index": i,
                "reason": f"'args' must be a dict, got {type(op['args']).__name__}",
            })

    if validation_errors:
        return {
            "status": "error",
            "error_type": "validation_failed",
            "message": f"{len(validation_errors)} operation(s) failed validation",
            "validation_errors": validation_errors,
            "count": 0,
            "errors": len(validation_errors),
        }

    # Lazily create shared resources — only if any op needs them
    shared_collection = None
    shared_kg = None

    def get_shared_collection():
        nonlocal shared_collection
        if shared_collection is None:
            shared_collection = get_palace_collection()
        return shared_collection

    def get_shared_kg():
        nonlocal shared_kg
        if shared_kg is None:
            shared_kg = get_kg()
        return shared_kg

    # Actions that take a collection
    COLLECTION_ACTIONS = {"add_drawer", "upsert_drawer", "update_drawer"}
    # Actions that take a KG
    KG_ACTIONS = {"add_kg_fact", "invalidate", "kg_query", "kg_query_predicate", "kg_timeline", "update_entity", "merge_entities"}

    # Resolve the shared write-side predicate gate once. batch() dispatches
    # sub-ops directly via ACTIONS[action] (never re-entering bridge.py main()),
    # so without this the PREDICATES.md gate is fully bypassed for KG writes
    # routed through batch. Lazy import avoids the module-level cycle
    # (bridge imports _bridge_palace at startup; here the module is already
    # fully loaded by call time). Fail-open if unresolvable.
    def _resolve_predicate_gate():
        try:
            import bridge  # pack canonical
            return bridge.enforce_predicate_gate
        except Exception:
            try:
                import mempalace_bridge  # install alias
                return mempalace_bridge.enforce_predicate_gate
            except Exception:
                return None

    _predicate_gate = _resolve_predicate_gate()

    results = []
    errors = 0

    def _is_error_result(r) -> bool:
        return isinstance(r, dict) and (r.get("status") == "error" or r.get("isError") is True)

    for i, op in enumerate(operations):
        try:
            action = op["action"]
            op_args = op.get("args", {})

            if action not in ACTIONS:
                results.append({"status": "error", "message": f"Unknown action: {action}", "index": i})
                errors += 1
                continue

            # Predicate gate per sub-op (mirrors CLI main() + daemon dispatch),
            # so add_kg_fact/invalidate with a non-canonical predicate are
            # rejected in-band rather than persisted.
            if _predicate_gate is not None:
                rejection = _predicate_gate(action, op_args)
                if rejection is not None:
                    rejection = {**rejection, "index": i}
                    results.append(rejection)
                    errors += 1
                    continue

            fn = ACTIONS[action]

            # Inject shared resource for batched actions
            if action in COLLECTION_ACTIONS:
                result = fn(op_args, _collection=get_shared_collection())
            elif action in KG_ACTIONS:
                result = fn(op_args, _kg=get_shared_kg())
            else:
                # Other actions run standalone (no sharing available)
                result = fn(op_args)

            results.append(result)
            # Count in-band failures too — a sub-op returning {status:error}
            # (e.g. update_entity not_found, telemetry-deprecated deny) must
            # surface as a batch failure so TS callers route per-op onFailure
            # (DLQ re-queue / retry) instead of masking with status=ok.
            if _is_error_result(result):
                errors += 1
        except Exception as e:
            results.append({"status": "error", "message": str(e), "index": i})
            errors += 1

    return {
        "status": "ok" if errors == 0 else "partial",
        "results": results,
        "count": len(results),
        "errors": errors,
    }


def diary(args: dict) -> dict:
    """Read or write agent diary entries via ChromaDB room=diary.

    Unified 2026-05-12 per RFC-0094 Option A (ISC-33 locked, see PRD
    20260512_mempalace-findings-delivery). Previously this routed to
    `~/.mempalace/palace/agents/{agent}/diary.jsonl` (orphan path, never
    auto-populated by hooks — confirmed via 2026-05-12 audit). Now delegates
    to mempalace.mcp_server.tool_diary_{read,write} so bridge writes are
    visible to MCP reads (and vice versa) — single source of truth.
    """
    try:
        from mempalace.mcp_server import tool_diary_write, tool_diary_read
    except ImportError as e:
        return _import_err("mempalace.mcp_server", e)

    action = args.get("action", "read")
    agent_name = args["agent_name"]

    if action == "write":
        entry = args["entry"]
        topic = args.get("topic", "general")
        wing = args.get("wing", "")
        result = tool_diary_write(
            agent_name=agent_name, entry=entry, topic=topic, wing=wing
        )
        if result.get("success"):
            return {
                "status": "ok",
                "agent_name": agent_name,
                "topic": topic,
                "entry_id": result.get("entry_id"),
                "timestamp": result.get("timestamp"),
            }
        return {"status": "error", "message": result.get("error", "unknown error")}
    else:
        last_n = args.get("last_n", 10)
        wing = args.get("wing", "")
        result = tool_diary_read(agent_name=agent_name, last_n=last_n, wing=wing)
        if "error" in result:
            return {"status": "error", "message": result["error"]}
        entries = result.get("entries", [])
        return {
            "status": "ok",
            "agent_name": agent_name,
            "entries": entries,
            "count": len(entries),
        }


def _scan_stored_conflicts(kg_db_path: str) -> list:
    """Scan STORED knowledge-graph facts against each other for contradictions.

    Conflict-detection (RFC-0037 §Claim, eval capability 5): two facts that
    share a ``(subject, predicate)`` but disagree on the ``object`` while their
    validity windows overlap are CONFLICTED — they must be surfaced, not
    silently merged or arbitrarily collapsed to one. A fact is treated as
    currently valid when it has no closed validity end (``valid_to`` NULL/empty),
    mirroring the ``current = valid_to is None`` convention already used by
    ``KnowledgeGraph.query_entity``.

    Each emitted issue is additive to the ``fact_check`` ``issues[]`` contract
    and carries:
      - ``type``              = "contradiction"  (the typed-issue discriminator)
      - ``status``            = "conflicted"     (RFC-0037 ``Claim.status``)
      - ``contradicted_fact``  reference to a rival currently-valid fact

    Read-only: opens the KG SQLite directly and never writes — the bridge stays
    the single write boundary. No schema migration needed: the ``triples`` table
    already persists subject/predicate/object/valid_to/confidence.
    """
    if not kg_db_path or not os.path.exists(kg_db_path):
        return []
    try:
        conn = sqlite3.connect(kg_db_path)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT t.id AS triple_id,
                   t.subject AS sid, t.predicate AS predicate, t.object AS oid,
                   es.name AS subject_name, eo.name AS object_name,
                   t.valid_from AS valid_from, t.confidence AS confidence
            FROM triples t
            JOIN entities es ON t.subject = es.id
            JOIN entities eo ON t.object = eo.id
            WHERE t.valid_to IS NULL OR t.valid_to = ''
            ORDER BY t.subject, t.predicate, t.valid_from
            """
        ).fetchall()
        conn.close()
    except Exception:
        return []  # a KG read failure must not break the text-side fact_check

    from collections import defaultdict

    groups = defaultdict(list)
    for r in rows:
        groups[(r["sid"], r["predicate"])].append(r)

    conflicts = []
    for (_sid, predicate), members in groups.items():
        if len({m["oid"] for m in members}) < 2:
            continue  # one currently-valid object → no contradiction
        subject_name = members[0]["subject_name"]
        facts = [
            {
                "subject": m["subject_name"],
                "predicate": predicate,
                "object": m["object_name"],
                "valid_from": m["valid_from"],
                "confidence": m["confidence"],
            }
            for m in members
        ]
        objects = [m["object_name"] for m in members]
        # Cap 5: triple_ids — the IDs of all conflicting KG triples, enabling
        # callers to invalidate them precisely via bridge invalidate action.
        triple_ids = [m["triple_id"] for m in members if m["triple_id"]]
        conflicts.append(
            {
                "type": "contradiction",
                "status": "conflicted",  # RFC-0037 Claim.status
                "subject": subject_name,
                "predicate": predicate,
                "objects": objects,
                "triple_ids": triple_ids,
                "facts": facts,
                "contradicted_fact": facts[1],
                "detail": (
                    f"{subject_name} -> {predicate} -> "
                    + " / ".join(sorted(set(objects)))
                    + " (multiple currently-valid objects; needs newest-wins or"
                    + " operator resolution, not a silent merge)"
                ),
            }
        )
    return conflicts


def fact_check(args: dict) -> dict:
    """Check text for contradictions against entity registry and knowledge graph.

    Returns similar-name issues, relationship mismatches, and stale facts. Also
    scans STORED knowledge-graph facts against each other for contradictions
    (same subject+predicate, divergent object, overlapping validity) and appends
    them as typed ``contradiction`` issues (eval capability 5, RFC-0037 Claim).
    Offline — no network calls.

    `text` is optional: callers primarily interested in the stored-fact scan
    (scan_stored:true) may omit it and receive the conflict structure with an
    empty text-side issues list. Legacy callers that pass text see no change.
    """
    try:
        from mempalace.fact_checker import check_text
    except ImportError as e:
        return _import_err("mempalace.fact_checker", e)

    # Cap 5: text is optional — scan_stored-only callers do not need to supply
    # input text. An absent / empty text produces an empty text-side issues list;
    # the stored-conflict scan runs independently of it.
    text = args.get("text") or ""
    palace_path = os.path.join(get_palace_path(), "palace")

    try:
        issues = check_text(text, palace_path=palace_path)
    except Exception as e:
        return {"status": "error", "message": str(e)}

    # Cap 5 (conflict-detection): scan STORED facts vs each other. Additive —
    # text-side issues are preserved and conflict issues are appended. Opt out
    # via scan_stored:false for callers wanting only the text-vs-registry check.
    stored_conflicts = []
    if args.get("scan_stored", True):
        kg_db_path = os.path.join(get_palace_path(), "knowledge_graph.sqlite3")
        stored_conflicts = _scan_stored_conflicts(kg_db_path)

    issues = list(issues) + stored_conflicts

    return {
        "status": "ok",
        "issues": issues,
        "count": len(issues),
        "types_found": list(set(i.get("type", "unknown") for i in issues)),
        "conflicts": stored_conflicts,
        "conflict_count": len(stored_conflicts),
    }


def build_closets(args: dict) -> dict:
    """Build closet pointer lines for a specific source file's drawers.

    Finds all drawers matching the source_file, generates closet lines
    from their content, and upserts to the closets collection.
    """
    try:
        from mempalace.palace import (
            get_collection, get_closets_collection,
            build_closet_lines, upsert_closet_lines, purge_file_closets,
        )
    except ImportError as e:
        return _import_err("mempalace.palace", e)

    source_file = args["source_file"]
    palace_path = os.path.join(get_palace_path(), "palace")

    try:
        drawers_col = get_collection(palace_path, create=False)
        closets_col = get_closets_collection(palace_path, create=True)
    except Exception as e:
        return {"status": "error", "message": f"Cannot open palace: {e}"}

    # Find all drawers for this source file
    results = drawers_col.get(
        where={"source_file": source_file},
        include=["documents", "metadatas"],
    )

    ids = results.get("ids", [])
    docs = results.get("documents", [])
    metas = results.get("metadatas", [])

    if not ids:
        return {"status": "ok", "message": f"No drawers found for {source_file}", "closets_created": 0}

    # Combine content and build closets
    import hashlib
    wing = metas[0].get("wing", "uncategorized") if metas else "uncategorized"
    room = metas[0].get("room", "uncategorized") if metas else "uncategorized"
    combined = "\n\n".join(d for d in docs if d)

    # MEMP-004-C: closet purge/upsert mutate the closets HNSW index — take the
    # same palace_write_lock add_drawer holds for its closet writes, so a
    # rebuild racing a hook add_drawer cannot diverge the index.
    import _bridge_drawers as _drawers

    lines = build_closet_lines(source_file, ids, combined, wing, room)

    closets_created = 0
    with _drawers.palace_write_lock(_drawers._palace_lock_dir()):
        purge_file_closets(closets_col, source_file)
        if lines:
            closet_id = f"closet_{hashlib.sha256(source_file.encode()).hexdigest()[:16]}"
            closets_created = upsert_closet_lines(
                closets_col, closet_id, lines,
                {"wing": wing, "room": room, "source_file": source_file},
            )

    return {
        "status": "ok",
        "source_file": source_file,
        "drawers_found": len(ids),
        "closets_created": closets_created,
    }


def rebuild_closets(args: dict = None) -> dict:
    """Rebuild closet index for existing drawers.

    Migration utility for upgrading from pre-3.3.0 palaces. Scans all drawers,
    generates closet pointer lines, and upserts to the closets collection.
    """
    try:
        from mempalace.palace import (
            get_collection, get_closets_collection,
            build_closet_lines, upsert_closet_lines, purge_file_closets,
        )
    except ImportError as e:
        return _import_err("mempalace.palace", e)

    args = args or {}
    palace_path = os.path.join(get_palace_path(), "palace")
    wing_filter = args.get("wing")

    try:
        drawers_col = get_collection(palace_path, create=False)
        closets_col = get_closets_collection(palace_path, create=True)
    except Exception as e:
        return {"status": "error", "message": f"Cannot open palace: {e}"}

    total = drawers_col.count()
    if total == 0:
        return {"status": "ok", "message": "No drawers to index", "closets_created": 0}

    import hashlib
    # MEMP-004-C: lock per write-pair (not the whole pagination loop) so a
    # long rebuild cannot starve concurrent hook add_drawer writers.
    import _bridge_drawers as _drawers
    closets_created = 0
    drawers_processed = 0
    page_size = 100
    offset = 0

    while offset < total:
        page = drawers_col.get(
            include=["documents", "metadatas"],
            limit=page_size, offset=offset,
        )
        ids = page.get("ids", [])
        docs = page.get("documents", [])
        metas = page.get("metadatas", [])

        for i, (did, doc, meta) in enumerate(zip(ids, docs, metas)):
            if not doc or not meta:
                continue
            wing = meta.get("wing", "uncategorized")
            if wing_filter and wing != wing_filter:
                continue
            room = meta.get("room", "uncategorized")
            source = meta.get("source_file", did)

            lines = build_closet_lines(source, [did], doc, wing, room)
            if lines:
                closet_id = f"closet_{hashlib.sha256(source.encode()).hexdigest()[:16]}"
                with _drawers.palace_write_lock(_drawers._palace_lock_dir()):
                    purge_file_closets(closets_col, source)
                    n = upsert_closet_lines(
                        closets_col, closet_id, lines,
                        {"wing": wing, "room": room, "source_file": source},
                    )
                closets_created += n
            drawers_processed += 1

        offset += page_size
        if len(ids) < page_size:
            break

    return {
        "status": "ok",
        "drawers_processed": drawers_processed,
        "closets_created": closets_created,
        "wing_filter": wing_filter,
    }


def backfill_closets(args: dict = None) -> dict:
    """Backfill closet pointer lines for drawers that lack closet coverage.

    V11.21 (RFC-0073 audit C.9): closet coverage at 17.3% in the live palace
    means BM25 boost paths are silent for the other 82.7% of drawers. Unlike
    `rebuild_closets`, this action is *incremental* — it scans the closets
    collection first to learn which `source_file` values are already covered,
    then only emits new closets for drawers whose source is uncovered. Safe to
    run repeatedly (idempotent: re-runs are no-ops once coverage = 100%).

    Designed for the weekly launchd fire (mirrors KgReconcile pattern). Reports
    a starting / ending coverage percentage so the operator can watch the gap
    close across runs.

    Args:
        wing      — optional. Restrict backfill to this wing.
        max_files — optional int. Cap the number of source_files processed in
                    one run (lets the weekly cron stay bounded; default 0 = no
                    cap). Useful when the gap is large and you want to chip
                    away rather than spike CPU on a single run.
        dry_run   — optional bool. If true, computes coverage and identifies
                    candidates without writing closets. Default false.

    Returns:
        {
            "status": "ok",
            "starting_coverage": float,      # drawers_covered / drawers_in_scope, percent
            "ending_coverage": float,        # post-backfill, percent (same semantics)
            "drawers_total": int,            # ALL drawers (un-filtered count)
            "drawers_in_scope": int,         # drawers matching wing_filter (or all if None)
            "drawers_covered": int,          # in-scope drawers whose source already has a closet
            "drawers_uncovered": int,        # in-scope drawers whose source has no closet
            "files_processed": int,
            "closets_created": int,
            "wing_filter": str | None,
            "max_files": int,
            "dry_run": bool,
        }

    Coverage semantics (Council Q2 verdict, audit 20260510-145902):
        starting_coverage = drawers_covered / drawers_in_scope * 100
    Prior formula `closet_total / drawers_total` was structurally wrong — a
    closet covers many drawers, so the ratio compared apples to oranges and
    routinely reported sub-1% on healthy palaces. Path 1 rename in place:
    Beck's empirical zero-consumers check (audit 2026-05-10) confirmed no
    downstream readers, so single-name swap with new semantics is safe.
    """
    try:
        from mempalace.palace import (
            get_collection, get_closets_collection,
            build_closet_lines, upsert_closet_lines,
        )
    except ImportError as e:
        return _import_err("mempalace.palace", e)

    args = args or {}
    palace_path = os.path.join(get_palace_path(), "palace")
    wing_filter = args.get("wing")
    try:
        max_files = int(args.get("max_files", 0))
    except (TypeError, ValueError):
        max_files = 0
    dry_run = bool(args.get("dry_run", False))

    try:
        drawers_col = get_collection(palace_path, create=False)
        closets_col = get_closets_collection(palace_path, create=True)
    except Exception as e:
        return {"status": "error", "message": f"Cannot open palace: {e}"}

    drawers_total = drawers_col.count()
    if drawers_total == 0:
        return {
            "status": "ok",
            "message": "No drawers — nothing to backfill",
            "starting_coverage": 0.0,
            "ending_coverage": 0.0,
            "drawers_total": 0,
            "drawers_in_scope": 0,
            "drawers_covered": 0,
            "drawers_uncovered": 0,
            "files_processed": 0,
            "closets_created": 0,
            "wing_filter": wing_filter,
            "max_files": max_files,
            "dry_run": dry_run,
        }

    # --- Step 1: enumerate source_file values that already have closet coverage. ---
    # Closet metadata carries source_file; we scan the closets collection once and
    # collect that set so the backfill can skip already-covered files.
    covered_sources: set[str] = set()
    try:
        closet_total = closets_col.count()
        page_size = 1000
        offset = 0
        while offset < closet_total:
            page = closets_col.get(include=["metadatas"], limit=page_size, offset=offset)
            for meta in page.get("metadatas", []):
                if meta and isinstance(meta, dict):
                    src = meta.get("source_file")
                    if src:
                        covered_sources.add(src)
            offset += page_size
            if len(page.get("metadatas", [])) < page_size:
                break
    except Exception:
        # If we can't read the closets collection, treat coverage as 0 — better
        # to over-write than to silently skip the backfill.
        closet_total = 0

    # --- Step 2: walk drawers, group by source_file, skip covered files. ---
    # Group drawer ids/content by source_file so multi-chunk files emit one
    # combined closet (matching `build_closets` semantics for single files).
    # Also tally drawers_in_scope and drawers_covered so coverage is computed
    # against drawers we actually considered (Council Q2 verdict — semantics
    # apply per-wing when wing_filter is set; closet_total / drawers_total
    # would mix scopes).
    by_source: dict[str, dict] = {}
    page_size = 500
    offset = 0
    drawers_in_scope = 0
    drawers_covered = 0
    drawers_uncovered = 0
    while offset < drawers_total:
        page = drawers_col.get(
            include=["documents", "metadatas"],
            limit=page_size, offset=offset,
        )
        ids = page.get("ids", [])
        docs = page.get("documents", [])
        metas = page.get("metadatas", [])

        for i, did in enumerate(ids):
            meta = metas[i] if i < len(metas) else None
            doc = docs[i] if i < len(docs) else None
            if not meta or not doc:
                continue
            wing = meta.get("wing", "uncategorized")
            if wing_filter and wing != wing_filter:
                continue
            drawers_in_scope += 1
            source = meta.get("source_file") or did
            if source in covered_sources:
                drawers_covered += 1
                continue  # already covered — skip closet emission
            drawers_uncovered += 1

            entry = by_source.setdefault(source, {
                "wing": wing,
                "room": meta.get("room", "uncategorized"),
                "ids": [],
                "docs": [],
            })
            entry["ids"].append(did)
            entry["docs"].append(doc)

        offset += page_size
        if len(ids) < page_size:
            break

    # Compute starting_coverage AFTER the walk so wing_filter scope is honored.
    # `closet_total` (line ~1409) was the wrong numerator — a closet covers
    # many drawers, so closet_total / drawers_total is a category error.
    # New formula: drawers_covered / drawers_in_scope (Council Q2 Path 1).
    starting_coverage = round(
        drawers_covered / max(drawers_in_scope, 1) * 100, 1
    )

    # --- Step 3: emit closets for uncovered files (respecting max_files cap). ---
    files_processed = 0
    closets_created = 0
    processed_sources: set[str] = set()  # successfully-upserted sources only
    if not dry_run:
        import hashlib
        # MEMP-004-C: same per-write locking as build/rebuild_closets.
        import _bridge_drawers as _drawers
        for source, entry in by_source.items():
            if max_files > 0 and files_processed >= max_files:
                break
            combined = "\n\n".join(d for d in entry["docs"] if d)
            lines = build_closet_lines(
                source, entry["ids"], combined, entry["wing"], entry["room"],
            )
            if not lines:
                continue
            closet_id = f"closet_{hashlib.sha256(source.encode()).hexdigest()[:16]}"
            try:
                with _drawers.palace_write_lock(_drawers._palace_lock_dir()):
                    n = upsert_closet_lines(
                        closets_col, closet_id, lines,
                        {"wing": entry["wing"], "room": entry["room"], "source_file": source},
                    )
                closets_created += n
                files_processed += 1
                processed_sources.add(source)
            except Exception:
                # Per-file failures are non-fatal — keep chipping away.
                continue

    # --- Step 4: recompute ending coverage from the actual upsert successes. ---
    # processed_sources tracks ONLY sources whose upsert succeeded (the Step-3
    # `if not lines: continue` branches and exception-continues are excluded).
    # This avoids the over-count failure mode of "first N items of by_source".
    drawers_newly_covered = sum(
        len(by_source[src]["ids"]) for src in processed_sources
    )
    ending_drawers_covered = drawers_covered + drawers_newly_covered
    ending_coverage = round(
        ending_drawers_covered / max(drawers_in_scope, 1) * 100, 1
    )

    return {
        "status": "ok",
        "starting_coverage": starting_coverage,
        "ending_coverage": ending_coverage,
        "drawers_total": drawers_total,
        "drawers_in_scope": drawers_in_scope,
        "drawers_covered": drawers_covered,
        "drawers_uncovered": drawers_uncovered,
        "files_processed": files_processed,
        "closets_created": closets_created,
        "wing_filter": wing_filter,
        "max_files": max_files,
        "dry_run": dry_run,
    }


def _load_projects_registry() -> list[dict]:
    """Load project entries from `.dos-projects.json` (canonical registry).

    Walks cwd up to $HOME via `_find_projects_file()` to locate the file.
    Returns list of {name, path, wing} dicts. Expands ~ in paths. Rows with
    null wing or null root_path (e.g. placeholder entries) are skipped.

    The historical PROJECTS.md markdown-table reader was removed; JSON is
    the single source of truth, also consumed by `injection-observe.ts`
    wing-drift detection and `Tools/lineage.ts projects`.
    """
    projects_path = _find_projects_file()
    if not projects_path:
        return []

    home = os.path.expanduser("~")
    entries: list[dict] = []
    try:
        with open(projects_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        for proj in data.get("projects", []):
            wing = proj.get("wing")
            raw_path = proj.get("root_path")
            if not wing or not raw_path:
                continue
            expanded = raw_path.replace("~", home)
            entries.append({
                "name": proj.get("name") or proj.get("id") or wing,
                "path": expanded,
                "wing": wing,
            })
    except Exception:
        pass

    return entries


def _resolve_wing_from_path(fpath: str, projects: list[dict]) -> str:
    """Resolve wing from file path using PROJECTS.md entries.

    Longest path match wins (Studio under Durante).
    Falls back to 'learnings' for global ~/.claude/MEMORY/.
    """
    best_wing = None
    best_len = 0

    for proj in projects:
        proj_path = proj["path"]
        if fpath.startswith(proj_path + "/") or fpath.startswith(proj_path + os.sep):
            if len(proj_path) > best_len:
                best_len = len(proj_path)
                best_wing = proj["wing"]

    if best_wing:
        return best_wing

    # Global fallback
    home = os.path.expanduser("~")
    if fpath.startswith(os.path.join(home, ".claude")):
        return "learnings"

    return "general"


def reconcile(args: dict = None) -> dict:
    """Audit MEMORY/ files against MemPalace index. Reports orphans, ghosts, and gaps.

    Scans ALL registered projects from PROJECTS.md plus global MEMORY/.
    Compares source_file metadata in drawers against files on disk.
    Optionally re-indexes orphaned files with auto wing detection.

    Args:
        paths       — list of directories to scan (default: all projects + global)
        wing        — override wing for all newly indexed files
        fix         — bool, if true re-indexes orphaned files via add_drawer (default: false)
        skip        — list of subdirectories to skip (default: ['STATE', 'VOICE', 'RELATIONSHIP'])
        max_size_kb — max file size in KB to index (default: 100, skip larger files)
        verbose     — bool, if true additionally returns `ghost_files` (sorted list of
                      source_file paths whose file is gone) and `ghost_drawers`
                      (list of {drawer_id, source_file, wing, room}) so callers
                      like MemoryGardener's ghost-resolve producer can enumerate
                      per-drawer details, not just counts. Default: false (count-only).
    """
    # Lazy import: drawers.add_drawer + drawers._smart_chunk are needed in fix mode.
    # Bare-name import (not relative): bridge.py prepends the Tools/ directory to
    # sys.path, so the sibling modules import as flat names. The previous
    # `from . import _bridge_drawers` failed when bridge.py runs as a script
    # because there is no parent package — flat-dir layout, no __init__.py.
    import _bridge_drawers as _drawers
    args = args or {}
    fix_mode = args.get("fix", False)
    verbose = args.get("verbose", False)
    wing_override = args.get("wing")
    # Default skip_dirs (2026-05-12 ISC-48): SECURITY added — security events
    # route to Studio via SaveSecurityEventsToStudio, NOT MemPalace. Pre-fix,
    # SECURITY/ JSONL churn was 64.6% (277 of 429) of all orphans per the C1
    # investigation in PRD 20260512_mempalace-findings-delivery. ARCHIVE added
    # to skip committed git-history files (48 of 429). ARTIFACTS + MEMPALACE
    # added (2026-05-30): ARTIFACTS holds ephemeral per-agent-task telemetry
    # (`agent-tasks/*.jsonl`, 719 on disk) and append-only sync logs — never
    # mined into drawers, yet they accounted for 436 of 744 false orphans.
    # MEMPALACE is the palace's own Chroma/SQLite data dir, never indexable.
    # Same churn-not-drawer-source rationale as SECURITY/ARCHIVE. Callers can
    # still pass `skip: [...]` to override the default.
    skip_dirs = set(args.get("skip", ["STATE", "VOICE", "RELATIONSHIP", "SECURITY", "ARCHIVE", "ARTIFACTS", "MEMPALACE"]))
    max_size_kb = args.get("max_size_kb", 100)
    max_size_bytes = max_size_kb * 1024

    # Load projects registry for path scanning and wing resolution
    projects = _load_projects_registry()

    # Determine scan paths — all projects + global
    scan_paths = args.get("paths")
    if not scan_paths:
        home = os.path.expanduser("~")
        seen_real = set()
        scan_paths = []

        # Add all project MEMORY/ dirs
        for proj in projects:
            mem_dir = os.path.join(proj["path"], "MEMORY")
            if os.path.isdir(mem_dir):
                real = os.path.realpath(mem_dir)
                if real not in seen_real:
                    seen_real.add(real)
                    scan_paths.append(mem_dir)

        # Add cwd MEMORY/ if not already covered
        cwd_mem = os.path.join(os.getcwd(), "MEMORY")
        if os.path.isdir(cwd_mem) and os.path.realpath(cwd_mem) not in seen_real:
            seen_real.add(os.path.realpath(cwd_mem))
            scan_paths.append(cwd_mem)

        # Add global MEMORY/
        global_mem = os.path.join(home, ".claude", "MEMORY")
        if os.path.isdir(global_mem) and os.path.realpath(global_mem) not in seen_real:
            seen_real.add(os.path.realpath(global_mem))
            scan_paths.append(global_mem)

    if not scan_paths:
        return {"status": "error", "message": "No MEMORY/ directories found to scan"}

    # Realpath canonicalization (2026-05-30). The disk walk yields symlink-prefixed
    # paths (e.g. ~/.claude/MEMORY/... when ~/.claude -> Durante/Releases/vX/.claude),
    # but the mempalace miner stores `source_file` as the realpath. Without
    # canonicalizing BOTH sides, every drawer under the global ~/.claude tree reads
    # as a ghost-on-the-index AND an orphan-on-disk even though it is correctly
    # indexed. We compare realpath<->realpath. Dir-level cache keeps it cheap:
    # thousands of files share a handful of directories, so realpath() runs once
    # per directory, not per file.
    _realpath_cache: dict = {}

    def _canon_path(p: str) -> str:
        d, b = os.path.split(p)
        rp = _realpath_cache.get(d)
        if rp is None:
            rp = os.path.realpath(d)
            _realpath_cache[d] = rp
        return os.path.join(rp, b)

    # --- Step 1: Collect files on disk ---
    on_disk = {}  # path -> category
    skipped_oversize = 0
    for base in scan_paths:
        for root, dirs, files in os.walk(base):
            # Skip excluded subdirectories
            rel = os.path.relpath(root, base)
            top_dir = rel.split(os.sep)[0]
            if top_dir in skip_dirs:
                continue
            for fname in files:
                if fname.endswith((".md", ".jsonl", ".txt")):
                    fpath = os.path.join(root, fname)
                    # Skip oversized files (e.g. transcript.jsonl)
                    try:
                        if max_size_bytes > 0 and os.path.getsize(fpath) > max_size_bytes:
                            skipped_oversize += 1
                            continue
                    except OSError:
                        continue
                    on_disk[_canon_path(fpath)] = top_dir

    # --- Step 2: Collect indexed source files from MemPalace ---
    # Pre-fetch covered_sources (closet metadata source_file set) so we can
    # tally per-drawer coverage during the same walk. Council Q2 verdict
    # (audit 20260510-145902): drawers_with_coverage / total_drawers is the
    # meaningful metric — `closet_count / total_drawers` was a category error
    # (one closet covers many drawers).
    covered_sources: set[str] = set()
    try:
        import chromadb as _chromadb
        from chromadb.config import Settings as _Settings
        _palace_path = os.path.join(get_palace_path(), "palace")
        _client = _chromadb.PersistentClient(
            path=_palace_path, settings=_Settings(anonymized_telemetry=False),
        )
        try:
            _closets_col = _client.get_collection("mempalace_closets")
            _ct = _closets_col.count()
            _off = 0
            while _off < _ct:
                _pg = _closets_col.get(include=["metadatas"], limit=1000, offset=_off)
                for _m in _pg.get("metadatas", []):
                    if _m and isinstance(_m, dict):
                        _src = _m.get("source_file")
                        if _src:
                            covered_sources.add(_src)
                _off += 1000
                if len(_pg.get("metadatas", [])) < 1000:
                    break
        except Exception:
            pass
    except ImportError:
        pass

    collection = get_palace_collection()
    total_drawers = collection.count()
    indexed_files = set()
    # Verbose mode: also build src -> [{drawer_id, wing, room}, ...] so the
    # post-diff step can enumerate ghost drawers for the producer downstream.
    # Skipped in non-verbose mode to avoid the per-drawer dict-build overhead
    # on the hot daily-cron path.
    indexed_drawers_by_src: dict = {} if verbose else None
    drawers_with_closet = 0
    page_size = 200
    offset = 0
    while offset < total_drawers:
        page = collection.get(include=["metadatas"], limit=page_size, offset=offset)
        metas = page.get("metadatas", [])
        ids = page.get("ids", [])
        for did, meta in zip(ids, metas):
            if meta and meta.get("source_file"):
                src = meta["source_file"]
                csrc = _canon_path(src)
                # indexed set + verbose map keyed by realpath so the disk<->index
                # diff is symlink-agnostic. Closet coverage keeps the RAW src match
                # (covered_sources is closet metadata stored the same raw way).
                indexed_files.add(csrc)
                if src in covered_sources:
                    drawers_with_closet += 1
                if verbose:
                    indexed_drawers_by_src.setdefault(csrc, []).append({
                        "drawer_id": did,
                        "wing": meta.get("wing", "uncategorized"),
                        "room": meta.get("room", "uncategorized"),
                    })
        offset += page_size
        if len(metas) < page_size:
            break

    # --- Step 3: Diff ---
    disk_set = set(on_disk.keys())
    orphaned_all = disk_set - indexed_files
    # Split genuine orphans from WORK/LEARNING scratch + telemetry (2026-05-30).
    # WORK and LEARNING are markdown-knowledge dirs: the knowledge unit is a `.md`
    # (PRD.md, COUNCIL.md, ALGORITHM/SYSTEM/FAILURES summaries). The non-`.md`
    # files are NOT drawer-source — WORK holds command-capture scratch
    # (stdout.txt / stderr.txt / search.txt / compose-*.txt) and LEARNING holds
    # event-stream telemetry (SIGNALS / REFLECTIONS / ENFORCEMENT *.jsonl) that
    # syncs to Studio, never the palace. Counting them inflated orphaned_count
    # (2026-05-30: 312 raw, ~all scratch/telemetry) and dragged the gardener
    # score on non-work. Headline `orphaned_count` is genuine-only; scratch is
    # reported separately. Mirrors the ghost genuine/by-design split.
    def _is_work_learning_scratch(path: str, cat: str) -> bool:
        return cat in ("WORK", "LEARNING") and not path.endswith(".md")

    orphaned = {f for f in orphaned_all if not _is_work_learning_scratch(f, on_disk.get(f, "other"))}
    orphaned_scratch = orphaned_all - orphaned
    # Only count ghosts that are real file paths (not sentinel-scan, etc.)
    # AND whose source_file does not actually exist on disk. The previous
    # `indexed_files - disk_set` formula over-counted because `disk_set` only
    # contains files reachable by the 11 declared MEMORY/ scan paths — drawers
    # whose source_file lives outside those scans (Releases/ snapshots,
    # project-local paths not in .dos-projects.json, etc.) were flagged as
    # ghosts even though the file is alive. Use os.path.exists() so a drawer
    # is a ghost iff the underlying file truly is gone. V11.1d (2026-05-11).
    ghost_candidates = {
        sf for sf in indexed_files if sf.startswith("/") and not os.path.exists(sf)
    }
    # Split genuine ghosts from by-design ones. A drawer whose source_file lives
    # in the rotating MEMORY/ substrate, a frozen /Releases/ snapshot, or an
    # ephemeral git /worktrees/ tree is the durable system of record — its
    # source going absent is NORMAL (WORK PRDs archive, LEARNING rotates,
    # version freezes gitignore-strip files), not a stale ghost. Mirrors
    # MemoryGardener's ghost-resolve proposer (isMinedMemorySource +
    # isEphemeralPath) so the AUDIT and the PROPOSER agree on what counts.
    # Headline `ghost_count` is genuine-only (deleted-CODE ghosts); by-design
    # ghosts are reported separately so they stay visible without dragging the
    # gardener health score. 2026-05-30: 897 of 909 raw ghosts were by-design.
    def _is_by_design_ghost(sf: str) -> bool:
        return ("/MEMORY/" in sf) or ("/Releases/" in sf) or ("/worktrees/" in sf)

    ghosts_by_design = {sf for sf in ghost_candidates if _is_by_design_ghost(sf)}
    ghosts = ghost_candidates - ghosts_by_design

    # Categorize orphans
    orphan_cats = {}
    for f in orphaned:
        cat = on_disk.get(f, "other")
        orphan_cats.setdefault(cat, []).append(f)

    # --- Step 4: Closet coverage ---
    # Two metrics surfaced (Council Q2 verdict, audit 20260510-145902):
    #   closet_count           — raw closets count (cardinality of closets collection)
    #   closet_coverage_pct    — drawers_with_closet / total_drawers, the meaningful
    #                            "what fraction of memory is BM25-boostable" metric
    # Prior `closet_pct = closet_count / total_drawers` was a category error
    # (one closet covers many drawers) — replaced in place per Path 1.
    closet_count = len(covered_sources)  # alias for backward-compat reporting
    try:
        import chromadb
        from chromadb.config import Settings
        palace_path = os.path.join(get_palace_path(), "palace")
        client = chromadb.PersistentClient(path=palace_path, settings=Settings(anonymized_telemetry=False))
        try:
            closets_col = client.get_collection("mempalace_closets")
            closet_count = closets_col.count()
        except Exception:
            pass
    except ImportError:
        pass

    closet_coverage_pct = round(
        drawers_with_closet / max(total_drawers, 1) * 100, 1
    )

    # --- Step 5: KG health ---
    kg_health = {}
    try:
        kg = get_kg()
        if hasattr(kg, "stats"):
            kg_health = kg.stats()
    except Exception:
        kg_health = {"status": "unavailable"}

    # --- Step 6: Build report ---
    report = {
        "status": "ok",
        "scan_paths": scan_paths,
        "projects_scanned": len([p for p in projects if os.path.isdir(os.path.join(p["path"], "MEMORY"))]),
        "files_on_disk": len(on_disk),
        "files_indexed": len(indexed_files),
        "total_drawers": total_drawers,
        "orphaned_count": len(orphaned),
        "orphaned_scratch_count": len(orphaned_scratch),
        "orphaned_count_all": len(orphaned_all),
        "orphaned_by_category": {cat: len(files) for cat, files in sorted(orphan_cats.items())},
        "ghost_count": len(ghosts),
        "ghost_by_design_count": len(ghosts_by_design),
        "ghost_count_all": len(ghost_candidates),
        "skipped_dirs": sorted(skip_dirs),
        "skipped_oversize": skipped_oversize,
        "max_size_kb": max_size_kb,
        "closet_coverage": f"{closet_coverage_pct}% ({drawers_with_closet}/{total_drawers} drawers; {closet_count} closets)",
        "kg_health": kg_health,
    }

    # --- Step 6b: Verbose ghost details ---
    # Callers like MemoryGardener's ghost-resolve producer need per-drawer
    # details, not just counts. Skipped in default mode to keep the daily-cron
    # payload small.
    # `ghost_files`/`ghost_drawers` carry GENUINE ghosts only (ghosts is now
    # genuine-only) — this both aligns with the proposer's own filters and
    # shrinks the payload dramatically (2026-05-30: 20,717 → ~12 drawers).
    # `ghost_files_by_design` preserves visibility into the substrate/frozen
    # ghosts without inflating the headline or the per-drawer enumeration.
    if verbose:
        report["ghost_files"] = sorted(ghosts)
        report["ghost_files_by_design"] = sorted(ghosts_by_design)
        ghost_drawers_list = []
        for src in sorted(ghosts):
            for d in (indexed_drawers_by_src or {}).get(src, []):
                ghost_drawers_list.append({**d, "source_file": src})
        report["ghost_drawers"] = ghost_drawers_list

    # --- Step 7: Fix mode ---
    if fix_mode and orphaned:
        fixed = 0
        fix_errors = 0

        for fpath in sorted(orphaned):
            try:
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                if not content.strip() or len(content.strip()) < 50:
                    continue

                # Determine wing from path via PROJECTS.md
                cat = on_disk.get(fpath, "general")
                wing = wing_override or _resolve_wing_from_path(fpath, projects)

                # Determine room from category
                room_map = {
                    "WORK": "work",
                    "LEARNING": "learnings",
                    "RESEARCH": "research",
                    "ARTIFACTS": "artifacts",
                    "SECURITY": "security",
                }
                room = room_map.get(cat, cat.lower())

                # Section-gate MEMORY/WORK PRDs — index ONLY the durable
                # Decisions/Lessons/Rationale/LEARN sections, never whole PRD
                # bodies. reconcile fix-mode is the #1 palace writer; without this
                # gate it re-inflated the exact ISC-checklist / frontmatter /
                # verification-dump noise mine_file strips (2026-06 drawer-quality
                # audit), silently undoing that hygiene on every run. Mirrors
                # _drawers.mine_file's gate.
                if _drawers._is_work_prd(fpath):
                    gated = _drawers._extract_prd_sections(content)
                    if not gated.strip():
                        continue  # PRD has no durable section — skip entirely
                    content = gated

                # Chunk large files
                chunks = _drawers._smart_chunk(content, chunk_size=2000)
                for chunk in chunks:
                    result = _drawers.add_drawer(
                        {
                            "wing": wing,
                            "room": room,
                            "content": chunk,
                            "source_file": fpath,
                            "added_by": "dos-reconcile",
                            # W6 (NS-9): dedup ACROSS wings — an orphan whose content
                            # already lives in ANY wing returns status:duplicate
                            # (skipped below) instead of being re-filed into a second
                            # wing (the cross-wing duplication source). Idempotent.
                            "dup_scope": "global",
                        },
                    )
                    if result.get("status") == "ok":
                        fixed += 1
                    elif result.get("status") == "duplicate":
                        pass  # Already indexed, skip
                    else:
                        fix_errors += 1
            except Exception:
                fix_errors += 1

        report["fix_applied"] = True
        report["fixed_count"] = fixed
        report["fix_errors"] = fix_errors
    elif fix_mode:
        report["fix_applied"] = True
        report["fixed_count"] = 0
        report["message"] = "No orphaned files to fix"

    return report


# --- CLI Entry Point ---

# Upstream-canonical aliases (RFC-0028 + v3.3.4 contract).
# These mirror the MCP tool surface from upstream mempalace
# (tool_kg_stats / tool_graph_stats / tool_memories_filed_away with last_checkpoint
# alias) so any DOS spec or hook calling the bridge by the canonical action
# name resolves instead of erroring "unknown action".


def graph_stats(args: dict = None) -> dict:
    """Palace graph overview: nodes, tunnels, edges, connectivity.

    Mirrors fork's tool_graph_stats() at mcp_server.py:789. Calls
    mempalace.palace_graph.graph_stats(col=collection).
    """
    try:
        from mempalace.palace_graph import graph_stats as _graph_stats
        col = get_palace_collection()
        if col is None:
            return {
                "status": "no_palace",
                "message": "Palace collection not initialized",
            }
        return _graph_stats(col=col)
    except Exception as exc:
        return {
            "status": "error",
            "error_type": "graph_stats_failed",
            "message": f"graph_stats failed: {exc}",
        }


def _hook_state_dir() -> str:
    """Resolve the hook-state directory holding the checkpoint ack file.

    Hardcoded to ~/.mempalace/hook_state to match the ack WRITER (the mempalace
    library's hooks_cli.py STATE_DIR and the fork MCP server's tool, both of
    which use Path.home()/".mempalace"/"hook_state" and do NOT honor
    MEMPALACE_DIR). Honoring MEMPALACE_DIR here would desync the reader from the
    writer. MEMPALACE_STATE_DIR is a test-only override (unset in production →
    the real path), so hermetic tests never touch the live ~/.mempalace.
    """
    import os
    return os.environ.get("MEMPALACE_STATE_DIR") or os.path.expanduser(
        "~/.mempalace/hook_state"
    )


def _persist_checkpoint_sidecar(state_dir: str, data: dict) -> None:
    """Best-effort write of a NON-destructive 'last_checkpoint_at' sidecar.

    Captures the most recent checkpoint's timestamp + count so last_checkpoint_at
    can answer "when was the last checkpoint?" AFTER the consume-on-read mailbox
    (last_checkpoint) unlinks the ack. Never raises — a failed sidecar write must
    never break the consume path or the Stop hook that drives it.
    """
    import os
    try:
        ts = data.get("ts")
        if not ts:
            return
        os.makedirs(state_dir, exist_ok=True)
        sidecar = os.path.join(state_dir, "last_checkpoint_at")
        with open(sidecar, "w", encoding="utf-8") as fh:
            fh.write(json.dumps({"ts": ts, "msgs": data.get("msgs", 0)}))
    except (OSError, TypeError, ValueError):
        pass


def _humanize_age(seconds: int) -> str:
    """Compact human age string: '12s ago' / '5m ago' / '3h ago' / '2d ago'."""
    if seconds < 0:
        seconds = 0
    if seconds < 60:
        return f"{seconds}s ago"
    if seconds < 3600:
        return f"{seconds // 60}m ago"
    if seconds < 86400:
        return f"{seconds // 3600}h ago"
    return f"{seconds // 86400}d ago"


def last_checkpoint(args: dict = None) -> dict:
    """Return whether a recent SessionStop checkpoint was filed (consume-on-read).

    Mirrors fork's tool_memories_filed_away() at mcp_server.py:1396 (RFC-0028 §4.6
    renamed it; the legacy name is preserved on the MCP side, here we expose the
    clearer `last_checkpoint` per fork's documented alias). NOT a drawer-count
    query — for palace size use `status`. This is a one-shot MAILBOX: the first
    read consumes (unlinks) the ack. For a non-destructive "when?" probe that is
    safe to poll, use `last_checkpoint_at`.
    """
    import os
    state_dir = _hook_state_dir()
    ack_file = os.path.join(state_dir, "last_checkpoint")
    if not os.path.isfile(ack_file):
        return {
            "status": "quiet",
            "message": "No recent journal entry",
            "count": 0,
            "timestamp": None,
        }
    try:
        with open(ack_file, "r", encoding="utf-8") as fh:
            data = json.loads(fh.read())
        # Persist a NON-destructive sidecar BEFORE consuming the ack, so a later
        # last_checkpoint_at probe can still answer "when?" after this read
        # unlinks the one-shot mailbox. The consume semantics below are unchanged.
        _persist_checkpoint_sidecar(state_dir, data)
        os.unlink(ack_file)
        msgs = data.get("msgs", 0)
        return {
            "status": "ok",
            "message": f"✦ {msgs} messages tucked into drawers",
            "count": msgs,
            "timestamp": data.get("ts", None),
        }
    except (json.JSONDecodeError, OSError):
        try:
            os.unlink(ack_file)
        except OSError:
            pass
        return {
            "status": "error",
            "message": "✦ Journal entry filed in the palace",
            "count": 0,
            "timestamp": None,
        }


# Legacy name alias preserved for back-compat (mirrors fork's MCP-side dual name).
def memories_filed_away(args: dict = None) -> dict:
    """Legacy alias for last_checkpoint. See fork mcp_server.py RFC-0028 §4.6."""
    return last_checkpoint(args)


def last_checkpoint_at(args: dict = None) -> dict:
    """NON-destructive "when was the last checkpoint?" health probe.

    Unlike last_checkpoint (a consume-on-read mailbox that unlinks the ack on
    read), this NEVER consumes anything — it is safe to poll from a status
    radiator. It reports the most recent checkpoint timestamp + age, taking the
    newer of two non-destructive sources:
      1. the live ack file, PEEKED (never unlinked) — an un-consumed checkpoint
      2. the persistent 'last_checkpoint_at' sidecar that last_checkpoint() writes
         when it consumes an ack (so the timestamp survives consumption)

    Returns {status:'ok', timestamp, age_seconds, age_human, count} when a
    checkpoint is known, else {status:'quiet', timestamp:None, ...}.
    """
    import os
    state_dir = _hook_state_dir()
    candidates = []  # (ts_str, msgs)

    for fname in ("last_checkpoint", "last_checkpoint_at"):
        path = os.path.join(state_dir, fname)
        if not os.path.isfile(path):
            continue
        try:
            with open(path, "r", encoding="utf-8") as fh:
                data = json.loads(fh.read())
            ts = data.get("ts")
            if ts:
                candidates.append((str(ts), data.get("msgs", 0)))
        except (json.JSONDecodeError, OSError, TypeError):
            continue

    if not candidates:
        return {
            "status": "quiet",
            "message": "No checkpoint recorded yet",
            "timestamp": None,
            "age_seconds": None,
            "age_human": None,
            "count": 0,
        }

    # ISO-8601 UTC timestamps sort correctly lexically; take the newest.
    ts, msgs = max(candidates, key=lambda c: c[0])
    age_seconds = None
    age_human = None
    try:
        from datetime import datetime, timezone

        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            # The ack WRITER (mempalace hooks_cli.py: `now = datetime.now()`)
            # stamps NAIVE LOCAL time. Compare naive-local-to-naive-local so the
            # age is correct regardless of the host's UTC offset — assuming UTC
            # here would skew the age by that offset (e.g. +3h on America/
            # Sao_Paulo, or negative→clamped-to-0 in positive-offset zones).
            age_seconds = int((datetime.now() - dt).total_seconds())
        else:
            age_seconds = int((datetime.now(timezone.utc) - dt).total_seconds())
        age_human = _humanize_age(age_seconds)
    except (ValueError, TypeError):
        pass

    return {
        "status": "ok",
        "message": f"Last checkpoint {age_human}" if age_human else "Last checkpoint recorded",
        "timestamp": ts,
        "age_seconds": age_seconds,
        "age_human": age_human,
        "count": msgs,
    }


# ─── RFC-0155 Phase 1 — KG shadow fact log (operator-ACCEPTED 2026-07-10) ────
# Append-only JSONL of KG write events at the bridge boundary, beside the
# sqlite store ({palace}/kg-events.jsonl — RFC §7.1 palace-adjacent). SHADOW:
# the lib call stays the source of truth; a failed append NEVER fails the
# write (stderr + guarded). Every wrapped invocation appends EXACTLY ONE
# record regardless of outcome — the record carries the raw result_status so
# the Phase-2 fold decides what counts as a persisted mutation (this avoids
# re-inlining the classifier the Gen-56 fixture just de-duplicated).
# KNOWN BLIND SPOT (RFC §5, documented not hidden): the MCP surface bypasses
# the bridge and therefore this log (ADR-001 / upstream #1982).
# DEVIATION from the RFC record spec, recorded: no `seq` field — file order IS
# the sequence (a cross-process monotonic seq needs read-back under lock;
# Phase 2's fold assigns fold-time seqs). `batch` KG sub-operations DO route
# through these wrapped entries (per-fact records — RFC §7.3 resolved).

_KG_EVENT_TYPES = {
    "add_kg_fact": "FactAsserted",
    "invalidate": "FactInvalidated",
    "update_entity": "EntityUpdated",
    "merge_entities": "EntityMerged",
}


def _kg_event_append(action: str, args: dict, result) -> None:
    """Append one shadow-log record. Guarded — never raises, never blocks."""
    try:
        import json as _json
        from datetime import datetime, timezone
        rec = {
            "schema": 1,
            "ts": datetime.now(timezone.utc).isoformat(),
            "type": _KG_EVENT_TYPES[action],
            "actor": {
                "action": action,
                "session_id": os.environ.get("CLAUDE_SESSION_ID"),
            },
            "payload": args if isinstance(args, dict) else {"raw": str(args)[:2000]},
            "result_status": (result.get("status")
                              if isinstance(result, dict) else None),
        }
        path = os.path.join(get_palace_path(), "kg-events.jsonl")
        with open(path, "a", encoding="utf-8") as f:
            f.write(_json.dumps(rec, ensure_ascii=False, default=str) + "\n")
    except Exception as exc:
        try:
            sys.stderr.write(f"[kg-shadow-log] append failed (write unaffected): {exc}\n")
        except Exception:
            pass


def _wrap_kg_shadow(action_name: str, fn):
    """Decorate a KG write action with the shadow-log append (post-call).

    Accepts **kwargs because batch() injects a shared handle (`_kg=`) into KG
    sub-ops — the wrapper must pass it through (caught by the bridge suite's
    batch tests on first wiring). Consequence: batch KG sub-ops route through
    these same wrapped entries, so they emit PER-FACT records — RFC-0155 §7.3
    resolved in the per-fact direction by construction."""
    def _wrapped(args, **kwargs):
        result = fn(args, **kwargs)
        _kg_event_append(action_name, args, result)
        return result
    _wrapped.__doc__ = fn.__doc__
    _wrapped.__name__ = getattr(fn, "__name__", action_name)
    return _wrapped


def _get_or_build_actions() -> dict:
    """Return the cached ACTIONS table, building it lazily on first access.

    The facade calls _build_actions_table() once at import time and the result
    is memoized in _ACTIONS_CACHE. batch() (and any other internal call site)
    can reuse the cache instead of paying the dict-construction cost on every
    invocation.
    """
    global _ACTIONS_CACHE
    if _ACTIONS_CACHE is not None:
        return _ACTIONS_CACHE
    import _bridge_drawers as _drawers
    import _bridge_kg as _kg
    _ACTIONS_CACHE = _build_actions_table(_drawers, _kg)
    return _ACTIONS_CACHE


def _build_actions_table(drawers_mod, kg_mod) -> dict:
    """Compose the canonical ACTIONS dispatch table from the three split modules.

    Used by `batch()` to dispatch sub-operations and by the facade's CLI entry
    point. Keeping this function in the palace module (rather than the facade)
    means `batch` does not need a back-reference to the facade — avoiding the
    cycle where `bridge.py` and `mempalace_bridge.py` (its install alias) become
    distinct sys.modules entries.

    Memoizes the result in _ACTIONS_CACHE so subsequent calls (e.g. from
    `batch()`) reuse the same dict rather than rebuilding it.
    """
    global _ACTIONS_CACHE
    _ACTIONS_CACHE = {
        "init": init,
        "add_drawer": drawers_mod.add_drawer,
        "upsert_drawer": drawers_mod.upsert_drawer,
        "update_drawer": drawers_mod.update_drawer,
        "delete_drawer": drawers_mod.delete_drawer,
        "append_reflection": append_reflection,
        "add_kg_fact": _wrap_kg_shadow("add_kg_fact", kg_mod.add_kg_fact),  # RFC-0155 P1
        "invalidate": _wrap_kg_shadow("invalidate", kg_mod.invalidate),  # RFC-0155 P1
        "update_entity": _wrap_kg_shadow("update_entity", kg_mod.update_entity),  # RFC-0155 P1
        "merge_entities": _wrap_kg_shadow("merge_entities", kg_mod.merge_entities),  # RFC-0155 P1
        "search": drawers_mod.search,
        "suggest_parent": suggest_parent,
        "status": status,
        "mine_file": drawers_mod.mine_file,
        "mine_dir": drawers_mod.mine_dir,
        "kg_query": kg_mod.kg_query,
        "kg_query_predicate": kg_mod.kg_query_predicate,
        "kg_timeline": kg_mod.kg_timeline,
        "wake_up": wake_up,
        "classify": classify,
        "traverse": traverse,
        "find_tunnels": find_tunnels,
        "create_tunnel": create_tunnel,  # V11.14 item 1 (RFC-0035 §3 item 3)
        "mine_convos": drawers_mod.mine_convos,
        "diary": diary,
        "batch": batch,
        "fact_check": fact_check,
        "build_closets": build_closets,
        "rebuild_closets": rebuild_closets,
        "backfill_closets": backfill_closets,  # V11.21 (RFC-0073 audit C.9)
        "list_drawers": drawers_mod.list_drawers,  # V11.14 item 5 (RFC-0035 §3 item 8)
        "audit_drawer": drawers_mod.audit_drawer,  # cap 11 (auditability-explainable-recall)
        "reconcile": reconcile,
        # Fork-canonical aliases (RFC-0028 + v3.3.4)
        "kg_stats": kg_mod.kg_stats,
        "graph_stats": graph_stats,
        "last_checkpoint": last_checkpoint,
        "last_checkpoint_at": last_checkpoint_at,
        "memories_filed_away": memories_filed_away,
    }
    return _ACTIONS_CACHE
