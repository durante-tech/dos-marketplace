#!/usr/bin/env python3
"""migrate-drawer-filed-at.py — RFC-0028 §4.4 data backfill.

mempalace lib v3.3.4 (RFC-0028 Tier A §4.4) made the search response derive
`created_at` from `metadata.filed_at -> metadata.created_at -> "unknown"`.
Drawers mined before the fork landed `filed_at` set their timestamp under
`metadata.timestamp` (the dos-mine convention) and never set `filed_at` or
`created_at`. The result: post-fix searches show `created_at: "unknown"`
even for drawers whose mining time is recoverable.

This tool walks the ChromaDB collection, finds every drawer where
`metadata.filed_at` is missing/empty, derives the best available timestamp
from a fallback chain, and rewrites `metadata.filed_at` in place via
`collection.update`. Idempotent — re-runs report zero candidates.

FALLBACK CHAIN (per drawer):
    (a) metadata.created_at  — exact match for the lib's preferred key
    (b) metadata.timestamp   — the dominant historical key in this palace
                                (the dos-mine pipeline writes this; see live
                                audit 2026-04-26 — 3502/3502 missing-filed_at
                                drawers carry it as ISO-8601)
    (c) skip — leave filed_at unset; drawer continues showing "unknown" in
        search responses (honest signal that mining time is unrecoverable)

USAGE:
    python3 migrate-drawer-filed-at.py --help
    python3 migrate-drawer-filed-at.py             # default: --dry-run
    python3 migrate-drawer-filed-at.py --dry-run   # report only
    python3 migrate-drawer-filed-at.py --apply     # write changes

SAFETY:
    - --dry-run is the default; --apply is required to write.
    - --apply takes a timestamped backup of `chroma.sqlite3` first.
    - Per-drawer atomic update via collection.update(ids, metadatas).
    - Idempotent: re-running shows 0 candidates.
    - Per-100-drawer progress.

POST-APPLY:
    Run mempalace_reconnect (MCP tool) or restart the MCP server so the
    cached HNSW index does not serve pre-migration metadata.

DESIGN:
    Byte-identical between live (~/.claude/DOS/Tools/) and pack source
    (Packs/mem-palace/src/Tools/). No imports from hooks/lib so the same
    file ships to both copies.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from datetime import datetime
from typing import Any


def _load_palace_config() -> dict[str, Any]:
    """Read ~/.mempalace/config.json (the same path mempalace lib uses)."""
    cfg_path = os.path.expanduser("~/.mempalace/config.json")
    if not os.path.exists(cfg_path):
        sys.stderr.write(f"FATAL: palace config missing at {cfg_path}\n")
        sys.exit(2)
    with open(cfg_path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _open_collection(cfg: dict[str, Any]):
    """Return the ChromaDB collection. Lazy-imports chromadb."""
    import chromadb
    from chromadb.config import Settings

    palace_path = cfg["palace_path"]
    collection_name = cfg.get("collection_name") or "mempalace_drawers"
    client = chromadb.PersistentClient(
        path=palace_path,
        settings=Settings(anonymized_telemetry=False),
    )
    try:
        return client.get_collection(collection_name)
    except Exception as exc:  # chromadb.errors.NotFoundError and kin
        sys.stderr.write(
            f"FATAL: collection '{collection_name}' not found in palace at "
            f"{palace_path} ({type(exc).__name__}: {exc}). A backfill must not "
            f"create an empty collection — aborting.\n"
        )
        sys.exit(2)


def _backup_chroma(palace_path: str) -> str:
    """Copy chroma.sqlite3 to a timestamped .bak alongside the original."""
    src = os.path.join(palace_path, "chroma.sqlite3")
    if not os.path.exists(src):
        sys.stderr.write(f"FATAL: chroma.sqlite3 not found at {src}\n")
        sys.exit(2)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dst = f"{src}.bak.{stamp}"
    shutil.copy2(src, dst)
    return dst


def _is_iso8601(value: Any) -> bool:
    """Best-effort ISO-8601 string check. Avoids pulling dateutil."""
    if not isinstance(value, str) or len(value) < 10:
        return False
    if not value[:4].isdigit() or value[4] != "-" or value[7] != "-":
        return False
    # datetime.fromisoformat (3.11+) handles trailing 'Z' since 3.11; in 3.10
    # we do a manual swap. Either way, accept the parse-or-not signal.
    candidate = value.rstrip("Z")
    try:
        datetime.fromisoformat(candidate)
        return True
    except ValueError:
        return False


def _derive_filed_at(meta: dict[str, Any]) -> tuple[str | None, str | None]:
    """Apply the fallback chain. Returns (filed_at_value, source_key) or (None, None)."""
    cand = meta.get("created_at")
    if _is_iso8601(cand):
        return cand, "created_at"
    cand = meta.get("timestamp")
    if _is_iso8601(cand):
        return cand, "timestamp"
    return None, None


def _scan(collection, page: int = 500) -> dict[str, Any]:
    """Walk the collection and bucket drawers by migration status.

    Returns:
        dict with keys:
            total: int total drawers
            already_set: int drawers whose filed_at is already populated
            candidates: list[(drawer_id, filed_at_value, source_key)]
            unrecoverable: list[(drawer_id, list_of_keys)]   - need manual review
            by_source: dict[source_key, count]
    """
    total = collection.count()
    already_set = 0
    candidates: list[tuple[str, str, str]] = []
    unrecoverable: list[tuple[str, list[str]]] = []
    by_source: dict[str, int] = {}
    offset = 0
    last_progress = 0
    while offset < total:
        chunk = collection.get(limit=page, offset=offset, include=["metadatas"])
        ids = chunk.get("ids") or []
        metas = chunk.get("metadatas") or []
        for did, meta in zip(ids, metas):
            meta = meta or {}
            existing = meta.get("filed_at")
            if isinstance(existing, str) and existing:
                already_set += 1
                continue
            value, source = _derive_filed_at(meta)
            if value is None:
                unrecoverable.append((did, sorted(list(meta.keys()))))
            else:
                candidates.append((did, value, source))
                by_source[source] = by_source.get(source, 0) + 1
        offset += page
        if offset // 1000 > last_progress:
            last_progress = offset // 1000
            sys.stderr.write(f"  scanned {min(offset, total)}/{total}\r")
    if last_progress:
        sys.stderr.write(" " * 60 + "\r")  # clear progress line
    return {
        "total": total,
        "already_set": already_set,
        "candidates": candidates,
        "unrecoverable": unrecoverable,
        "by_source": by_source,
    }


def _apply(collection, candidates: list[tuple[str, str, str]]) -> tuple[int, int]:
    """Set filed_at on each candidate drawer. Returns (succeeded, failed)."""
    succeeded = 0
    failed = 0
    for idx, (did, value, _src) in enumerate(candidates, start=1):
        # Re-fetch to preserve every other key.
        current = collection.get(ids=[did], include=["metadatas"])
        meta_list = current.get("metadatas") or []
        if not meta_list:
            failed += 1
            sys.stderr.write(f"\n  fetch-miss: {did}\n")
            continue
        meta = dict(meta_list[0] or {})
        meta["filed_at"] = value
        try:
            collection.update(ids=[did], metadatas=[meta])
            succeeded += 1
        except Exception as exc:  # noqa: BLE001
            failed += 1
            sys.stderr.write(f"\n  update-fail {did}: {exc}\n")
        if idx % 100 == 0:
            sys.stderr.write(f"  applied {idx}/{len(candidates)}\r")
    sys.stderr.write(" " * 60 + "\r")
    return succeeded, failed


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Backfill metadata.filed_at on existing drawers (RFC-0028 §4.4 data fix).",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually write changes. Default is --dry-run.",
    )
    parser.add_argument(
        "--dry-run",
        dest="apply",
        action="store_false",
        help="Report only; do not write (default).",
    )
    parser.set_defaults(apply=False)
    args = parser.parse_args()

    cfg = _load_palace_config()
    palace_path = cfg["palace_path"]

    print("migrate-drawer-filed-at  (RFC-0028 §4.4 data backfill)")
    print(f"  palace_path: {palace_path}")
    print(f"  mode: {'APPLY' if args.apply else 'DRY-RUN'}")
    print()

    if args.apply:
        backup = _backup_chroma(palace_path)
        print(f"  backup: {backup}")
        print()

    collection = _open_collection(cfg)
    print("Scanning collection...")
    scan = _scan(collection)

    print()
    print("Scan:")
    print(f"  total drawers           : {scan['total']}")
    print(f"  already have filed_at   : {scan['already_set']}")
    print(f"  candidates (recoverable): {len(scan['candidates'])}")
    print(f"  unrecoverable (skipped) : {len(scan['unrecoverable'])}")
    print()
    if scan["by_source"]:
        print("Source-key distribution among candidates:")
        for src, count in sorted(scan["by_source"].items(), key=lambda x: -x[1]):
            print(f"  {src}: {count}")
        print()

    if scan["unrecoverable"]:
        print(f"First 5 unrecoverable drawers (will continue to show 'unknown' in search):")
        for did, keys in scan["unrecoverable"][:5]:
            print(f"  {did}  keys={keys}")
        print()

    if not scan["candidates"]:
        print("Nothing to migrate. Exit.")
        return 0

    if not args.apply:
        print(f"DRY-RUN: would update {len(scan['candidates'])} drawer(s). Re-run with --apply to write.")
        return 0

    print(f"Applying {len(scan['candidates'])} update(s)...")
    succeeded, failed = _apply(collection, scan["candidates"])
    print()
    print(f"Result: succeeded={succeeded} failed={failed}")
    print()
    print("NEXT STEPS:")
    print("  1. Run mempalace_reconnect MCP tool (or restart the MCP server)")
    print("     so the cached HNSW index does not serve pre-migration metadata.")
    print("  2. Smoke test: mempalace_search 'anything' should now show real")
    print("     ISO timestamps in `created_at`, not 'unknown'.")
    print("  3. Re-run this tool with --dry-run; candidate count should be 0.")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
