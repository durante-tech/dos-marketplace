#!/usr/bin/env python3
"""migrate-diary-agent-lowercase.py — RFC-0028 §9 R-4 migration.

mempalace lib v3.3.4 (RFC-0028 Tier A §4.2) made tool_diary_read filter on
the `agent` metadata key after lowercasing it. Diary entries written under
the previous version stored `agent` with the original capitalization (e.g.
"Fox", "LFox", "Lucius") and are unreachable from the post-fix read path.

This tool walks the ChromaDB collection, finds every drawer where
metadata.room == "diary" and metadata.agent has at least one uppercase
character, and rewrites that key to its lowercase form via
`collection.update`. Idempotent — a re-run reports zero candidates.

USAGE:
    python3 migrate-diary-agent-lowercase.py --help
    python3 migrate-diary-agent-lowercase.py             # default: --dry-run
    python3 migrate-diary-agent-lowercase.py --dry-run   # report only
    python3 migrate-diary-agent-lowercase.py --apply     # write changes

SAFETY:
    - --dry-run is the default; --apply is required to write.
    - --apply takes a timestamped backup of `chroma.sqlite3` first.
    - Per-drawer atomic update via collection.update(ids, metadatas).
    - Idempotent: re-running shows 0 candidates.

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
    collection_name = cfg.get("collection_name", "mempalace_drawers")
    client = chromadb.PersistentClient(
        path=palace_path,
        settings=Settings(anonymized_telemetry=False),
    )
    # MP-PY-04: never create an empty collection during a migration. The sibling
    # migrate-drawer-filed-at.py guards the same way — get_or_create silently
    # spawned an empty 'mempalace_drawers' collection when pointed at an
    # uninitialized store (e.g. a mis-set MEMPALACE_DIR), which then "migrated"
    # 0 entries and masked the misconfiguration. Abort loudly instead.
    try:
        return client.get_collection(collection_name)
    except Exception as exc:  # chromadb.errors.NotFoundError and kin
        sys.stderr.write(
            f"FATAL: collection '{collection_name}' not found in palace at "
            f"{palace_path} ({type(exc).__name__}: {exc}). A migration must not "
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


def _scan(collection, page: int = 500) -> dict[str, Any]:
    """Walk the collection and bucket drawers by migration status.

    Returns:
        dict with keys:
            total: int total drawers in collection
            diary_total: int drawers with room=="diary"
            candidates: list[(drawer_id, current_agent, lowered_agent, wing)]
            already_lowercase: int
            agent_missing: int
    """
    total = collection.count()
    candidates: list[tuple[str, str, str, str]] = []
    already_lowercase = 0
    agent_missing = 0
    diary_total = 0
    offset = 0
    while offset < total:
        chunk = collection.get(limit=page, offset=offset, include=["metadatas"])
        ids = chunk.get("ids") or []
        metas = chunk.get("metadatas") or []
        for did, meta in zip(ids, metas):
            meta = meta or {}
            if meta.get("room") != "diary":
                continue
            diary_total += 1
            agent = meta.get("agent")
            if agent is None or not isinstance(agent, str):
                agent_missing += 1
                continue
            lowered = agent.lower()
            if lowered == agent:
                already_lowercase += 1
                continue
            candidates.append((did, agent, lowered, str(meta.get("wing", ""))))
        offset += page
    return {
        "total": total,
        "diary_total": diary_total,
        "candidates": candidates,
        "already_lowercase": already_lowercase,
        "agent_missing": agent_missing,
    }


def _apply(collection, candidates: list[tuple[str, str, str, str]]) -> tuple[int, int]:
    """Rewrite metadata.agent in place. Returns (succeeded, failed)."""
    succeeded = 0
    failed = 0
    for did, _old, lowered, _wing in candidates:
        # Fetch current metadata so we preserve every other key.
        current = collection.get(ids=[did], include=["metadatas"])
        meta_list = current.get("metadatas") or []
        if not meta_list:
            failed += 1
            sys.stderr.write(f"  fetch-miss: {did}\n")
            continue
        meta = dict(meta_list[0] or {})
        meta["agent"] = lowered
        try:
            collection.update(ids=[did], metadatas=[meta])
            succeeded += 1
        except Exception as exc:  # noqa: BLE001
            failed += 1
            sys.stderr.write(f"  update-fail {did}: {exc}\n")
    return succeeded, failed


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Lowercase metadata.agent on existing diary drawers (RFC-0028 §9 R-4).",
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

    print("migrate-diary-agent-lowercase  (RFC-0028 §9 R-4)")
    print(f"  palace_path: {palace_path}")
    print(f"  mode: {'APPLY' if args.apply else 'DRY-RUN'}")
    print()

    if args.apply:
        backup = _backup_chroma(palace_path)
        print(f"  backup: {backup}")
        print()

    collection = _open_collection(cfg)
    scan = _scan(collection)

    print("Scan:")
    print(f"  total drawers           : {scan['total']}")
    print(f"  diary drawers           : {scan['diary_total']}")
    print(f"  agent already lowercase : {scan['already_lowercase']}")
    print(f"  agent missing (skipped) : {scan['agent_missing']}")
    print(f"  migration candidates    : {len(scan['candidates'])}")
    print()

    if not scan["candidates"]:
        print("Nothing to migrate. Exit.")
        return 0

    # Per-entry preview
    by_wing: dict[str, int] = {}
    print("Candidates:")
    for did, old, new, wing in scan["candidates"]:
        by_wing[wing] = by_wing.get(wing, 0) + 1
        print(f"  {did}  wing={wing}  agent: {old!r} -> {new!r}")
    print()
    print("Per-wing summary:")
    for wing, count in sorted(by_wing.items(), key=lambda x: -x[1]):
        print(f"  {wing}: {count}")
    print()

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
    print("  2. Smoke test: mempalace_diary_read('fox') should now return entries.")
    print("  3. Re-run this tool with --dry-run; candidate count should be 0.")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
