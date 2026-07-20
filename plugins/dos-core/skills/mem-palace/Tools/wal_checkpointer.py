#!/usr/bin/env python3
"""
MemPalace WAL Checkpointer — DOS-owned external WAL bounding (PRD
20260528-224846_mempalace-pure-uv-migration, MDC-1 VALIDATED gate).

The upstream `mempalace` library runs its KG SQLite in WAL mode but does not
expose a configurable checkpoint cadence, and the local WAL-bounding PRAGMA
patch (PR #1365) is unmerged and reaches no distributed user. This module is
the layer DOS controls: a periodic `PRAGMA wal_checkpoint(TRUNCATE)` that
bounds the WAL regardless of mempalace internals.

MDC-1 (load-bearing, empirically proven):
  (a) MUST use `PRAGMA wal_checkpoint(TRUNCATE)` — NOT passive. PASSIVE leaves
      the WAL file on disk; TRUNCATE shrinks it to zero.
  (b) MUST set `PRAGMA busy_timeout=500` on its connection. Without it a held
      reader balloons the WAL to 92MB and blocks 10s with lock errors.
  (c) MUST NOT hold a transaction across the checkpoint. We open in autocommit
      (isolation_level=None) and never BEGIN.
  (d) MUST treat a busy return (busy != 0) as a no-op — recover next tick.

This is pure stdlib (sqlite3 + fcntl) — it deliberately does NOT import the
`mempalace` package, so it runs under bare `python3` with no uv/mempalace
provisioning. The KG path is resolved via the same env semantics as
`_bridge_palace.get_palace_path()` (ISC-28): import the sibling resolver when
available, otherwise replicate its logic exactly.

Singleton lock (ISC-27): a non-blocking `flock(LOCK_EX | LOCK_NB)` on
`<palace>/.wal-checkpoint.lock` prevents N concurrent sessions from issuing a
thundering-herd of TRUNCATEs. If the lock is held, this is a clean no-op.

Idempotent, fire-and-forget. CLI entrypoint so a hook or daemon loop can
`python3 wal_checkpointer.py` it.
"""

import os
import sys
import fcntl
import sqlite3


def _resolve_palace_path() -> str:
    """Palace root, resolved via the same semantics as _bridge_palace.get_palace_path().

    Prefer importing the canonical resolver from the sibling bridge module so
    there is a single source of truth (ISC-28). Fall back to a byte-identical
    replication of its logic when the sibling cannot be imported (e.g. when this
    file is deployed standalone without the bridge on sys.path).
    """
    here = os.path.dirname(os.path.abspath(__file__))
    if here not in sys.path:
        sys.path.insert(0, here)
    try:
        from _bridge_palace import get_palace_path  # type: ignore
        return get_palace_path()
    except Exception:
        # Mirror _bridge_palace.get_palace_path() exactly.
        return os.environ.get("MEMPALACE_DIR", os.path.expanduser("~/.mempalace"))


def _kg_path(palace_dir: str) -> str:
    """Canonical KG file = join(palace, 'knowledge_graph.sqlite3')."""
    return os.path.join(palace_dir, "knowledge_graph.sqlite3")


def checkpoint_kg(palace_dir: str | None = None) -> dict:
    """Run a bounded WAL checkpoint against the KG SQLite database.

    Returns a result dict: {"status", "busy", "log", "ckpt", "kg", ...}.
    Never raises for expected conditions (missing DB, lock held, busy) — those
    return a structured no-op result so callers can fire-and-forget.

    busy/log/ckpt are the three integers returned by
    `PRAGMA wal_checkpoint(TRUNCATE)`:
      busy — 0 if the checkpoint ran, 1 if another connection blocked it.
      log  — pages written to the WAL (or -1).
      ckpt — pages checkpointed back into the DB (or -1).
    """
    palace = palace_dir or _resolve_palace_path()
    kg = _kg_path(palace)

    if not os.path.exists(kg):
        return {"status": "skip", "reason": "no-kg", "kg": kg}

    # ── Singleton lock (ISC-27) ───────────────────────────────────────────────
    # Non-blocking exclusive flock. If another session holds it, no-op cleanly.
    lock_path = os.path.join(palace, ".wal-checkpoint.lock")
    lock_fd = None
    try:
        lock_fd = os.open(lock_path, os.O_CREAT | os.O_RDWR, 0o644)
        try:
            fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except (BlockingIOError, OSError):
            return {"status": "skip", "reason": "lock-held", "kg": kg}

        # ── Checkpoint (MDC-1) ────────────────────────────────────────────────
        # autocommit (isolation_level=None) so we never hold a transaction (c).
        conn = sqlite3.connect(kg, timeout=10, isolation_level=None)
        try:
            conn.execute("PRAGMA busy_timeout=500")  # (b) non-negotiable
            row = conn.execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchone()  # (a)
            busy, log, ckpt = (row if row else (1, -1, -1))
            if busy != 0:
                # (d) busy → no-op, recover next tick.
                return {
                    "status": "busy",
                    "busy": busy,
                    "log": log,
                    "ckpt": ckpt,
                    "kg": kg,
                }
            return {
                "status": "ok",
                "busy": busy,
                "log": log,
                "ckpt": ckpt,
                "kg": kg,
            }
        finally:
            conn.close()
    except sqlite3.OperationalError as exc:
        # e.g. database locked beyond busy_timeout — treat as a recoverable no-op.
        return {"status": "busy", "reason": str(exc), "kg": kg}
    except Exception as exc:  # pragma: no cover — defensive; never crash a hook
        return {"status": "error", "reason": str(exc), "kg": kg}
    finally:
        if lock_fd is not None:
            try:
                fcntl.flock(lock_fd, fcntl.LOCK_UN)
            except Exception:
                pass
            try:
                os.close(lock_fd)
            except Exception:
                pass


def main(argv: list[str] | None = None) -> int:
    import json

    argv = argv if argv is not None else sys.argv[1:]
    palace_dir = argv[0] if argv else None
    result = checkpoint_kg(palace_dir)
    sys.stdout.write(json.dumps(result) + "\n")
    # Fire-and-forget contract: exit 0 for ok/skip/busy; non-zero only on a
    # genuine unexpected error so a supervising hook can log without alarm.
    return 0 if result.get("status") in ("ok", "skip", "busy") else 1


if __name__ == "__main__":
    sys.exit(main())
