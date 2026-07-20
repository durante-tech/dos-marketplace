#!/usr/bin/env python3
"""
merge-predicates.py — Collapse alias predicates to canonical form in the live KG.

Reads the alias map from PREDICATES.md §2 and rewrites alias predicate values
in the KG `triples` table to their canonical forms.

USAGE:
  python3 merge-predicates.py --dry-run               # show counts, no writes
  python3 merge-predicates.py --dry-run --cluster decision  # single alias cluster
  python3 merge-predicates.py --apply                 # apply all alias clusters
  python3 merge-predicates.py --apply --cluster e2e_with  # single alias
  python3 merge-predicates.py --list-clusters         # list available alias clusters

SAFETY:
  --dry-run is the default when neither --dry-run nor --apply is specified.
  --apply writes to the live KG and is IRREVERSIBLE without a backup.
  Always --dry-run first; audit the output before --apply.

KG path resolution (first that exists):
  MEMPALACE_KG_PATH env var, then $MEMPALACE_DIR/knowledge_graph.sqlite3
  (default ~/.mempalace/knowledge_graph.sqlite3 — same resolution the bridge uses)

PREDICATES.md resolution:
  ~/.claude/skills/mem-palace/PREDICATES.md (live install), fallback to pack source.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sqlite3
import sys
from datetime import datetime, timezone

# ─── Resolve PREDICATES.md ────────────────────────────────────────────────────

def _find_predicates_md() -> str | None:
    this_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.expanduser("~/.claude/skills/mem-palace/PREDICATES.md"),
        os.path.realpath(os.path.join(this_dir, "..", "..", "PREDICATES.md")),
        os.path.realpath(os.path.join(this_dir, "..", "..", "..", "mem-palace", "PREDICATES.md")),
    ]
    for c in candidates:
        if os.path.isfile(c):
            return c
    return None


def parse_alias_map(text: str) -> dict[str, str]:
    """Extract alias→canonical map from §2 fenced JSON block."""
    in_block = False
    json_lines: list[str] = []
    for line in text.splitlines():
        if line.strip() == "```json":
            in_block = True
            continue
        if in_block and line.strip() == "```":
            break
        if in_block:
            json_lines.append(line)
    if not json_lines:
        return {}
    try:
        return json.loads("\n".join(json_lines))
    except json.JSONDecodeError as e:
        sys.stderr.write(f"[merge-predicates] Failed to parse alias map: {e}\n")
        return {}


# ─── KG access ────────────────────────────────────────────────────────────────

def _find_kg_path() -> str | None:
    env_path = os.environ.get("MEMPALACE_KG_PATH")
    if env_path and os.path.exists(env_path):
        return env_path
    # Mirror the bridge's get_palace_path(): MEMPALACE_DIR overrides the
    # ~/.mempalace root, and the canonical KG filename is knowledge_graph.sqlite3
    # living at the palace root (NOT in a palace/ subdir, NOT kg.sqlite3).
    palace_root = os.environ.get("MEMPALACE_DIR", os.path.expanduser("~/.mempalace"))
    default = os.path.join(palace_root, "knowledge_graph.sqlite3")
    if os.path.exists(default):
        return default
    return None


def get_alias_counts(con: sqlite3.Connection, alias_map: dict[str, str]) -> dict[str, int]:
    """Return {alias: row_count} for aliases that exist in the KG."""
    counts: dict[str, int] = {}
    for alias in alias_map:
        row = con.execute(
            "SELECT COUNT(*) FROM triples WHERE predicate = ?", (alias,)
        ).fetchone()
        n = row[0] if row else 0
        if n > 0:
            counts[alias] = n
    return counts


def merge_cluster(
    con: sqlite3.Connection,
    alias: str,
    canonical: str,
    dry_run: bool,
) -> int:
    """UPDATE triples SET predicate=canonical WHERE predicate=alias. Returns affected rows."""
    row = con.execute(
        "SELECT COUNT(*) FROM triples WHERE predicate = ?", (alias,)
    ).fetchone()
    count = row[0] if row else 0
    if count == 0:
        return 0
    if not dry_run:
        con.execute(
            "UPDATE triples SET predicate = ? WHERE predicate = ?",
            (canonical, alias),
        )
    return count


def backup_kg(kg_path: str) -> str:
    """Copy the KG sqlite to a timestamped .bak sibling before an --apply mutation.

    Mirrors migrate-drawer-filed-at.py's _backup_chroma. --apply is IRREVERSIBLE;
    this gives the operator a rollback artifact. Returns the backup path.
    """
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dst = f"{kg_path}.bak.{stamp}"
    shutil.copy2(kg_path, dst)
    return dst


def append_audit_log(entry: dict) -> None:
    """Append a JSONL audit record to MEMORY/STATE/merge-predicates.jsonl."""
    state_dir = os.path.expanduser("~/.claude/MEMORY/STATE")
    os.makedirs(state_dir, exist_ok=True)
    audit_path = os.path.join(state_dir, "merge-predicates.jsonl")
    try:
        with open(audit_path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry) + "\n")
    except OSError as e:
        sys.stderr.write(f"[merge-predicates] Audit log write failed: {e}\n")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Collapse alias predicates to canonical form in the MemPalace KG."
    )
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would change without writing (default behavior).",
    )
    mode_group.add_argument(
        "--apply",
        action="store_true",
        help="Apply the merge. IRREVERSIBLE. Always --dry-run first.",
    )
    parser.add_argument(
        "--list-clusters",
        action="store_true",
        help="Print all alias clusters from PREDICATES.md and exit.",
    )
    parser.add_argument(
        "--cluster",
        metavar="ALIAS",
        help="Restrict merge to a single alias cluster (e.g. --cluster decision).",
    )
    parser.add_argument(
        "--kg",
        metavar="PATH",
        help="Override KG sqlite path (also honored via MEMPALACE_KG_PATH env).",
    )
    args = parser.parse_args()

    # Default to dry-run when neither flag is given
    dry_run = not args.apply

    # ── Load PREDICATES.md ──────────────────────────────────────────────────
    predicates_path = _find_predicates_md()
    if not predicates_path:
        sys.stderr.write(
            "[merge-predicates] ERROR: PREDICATES.md not found.\n"
            "  Searched: ~/.claude/skills/mem-palace/PREDICATES.md and pack source.\n"
        )
        return 2

    with open(predicates_path, encoding="utf-8") as fh:
        predicates_text = fh.read()

    alias_map = parse_alias_map(predicates_text)
    if not alias_map:
        sys.stderr.write("[merge-predicates] ERROR: No aliases found in PREDICATES.md §2.\n")
        return 2

    # ── List clusters mode ──────────────────────────────────────────────────
    if args.list_clusters:
        sys.stdout.write(f"[merge-predicates] {len(alias_map)} alias clusters in {predicates_path}:\n")
        for alias, canonical in sorted(alias_map.items()):
            sys.stdout.write(f"  {alias} -> {canonical}\n")
        return 0

    # ── Restrict to single cluster ───────────────────────────────────────────
    if args.cluster:
        if args.cluster not in alias_map:
            sys.stderr.write(
                f"[merge-predicates] ERROR: '{args.cluster}' not in alias map. "
                "Use --list-clusters to see available aliases.\n"
            )
            return 2
        work_map = {args.cluster: alias_map[args.cluster]}
    else:
        work_map = alias_map

    # ── KG path ─────────────────────────────────────────────────────────────
    kg_path = args.kg or _find_kg_path()
    if not kg_path:
        sys.stderr.write(
            "[merge-predicates] ERROR: KG sqlite not found. "
            "Set MEMPALACE_KG_PATH or ensure ~/.mempalace/knowledge_graph.sqlite3 exists.\n"
        )
        return 2

    if os.path.getsize(kg_path) == 0:
        sys.stdout.write("[merge-predicates] KG is empty (0 bytes) — nothing to merge.\n")
        return 0

    try:
        con = sqlite3.connect(kg_path)
    except sqlite3.Error as e:
        sys.stderr.write(f"[merge-predicates] Cannot open KG: {e}\n")
        return 2

    try:
        tables = {
            r[0]
            for r in con.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        if "triples" not in tables:
            sys.stdout.write("[merge-predicates] KG has no 'triples' table — nothing to merge.\n")
            return 0

        # ── Check which alias clusters have KG rows ──────────────────────────
        alias_counts = get_alias_counts(con, work_map)

        if not alias_counts:
            sys.stdout.write(
                f"[merge-predicates] No alias predicates found in KG"
                f"{f' (cluster: {args.cluster})' if args.cluster else ''} — nothing to do.\n"
            )
            return 0

        mode_label = "DRY-RUN" if dry_run else "APPLY"
        sys.stdout.write(
            f"[merge-predicates] {mode_label}: "
            f"{len(alias_counts)} alias cluster(s) with rows in KG:\n"
        )
        for alias, count in sorted(alias_counts.items()):
            canonical = work_map[alias]
            sys.stdout.write(f"  {alias} ({count} rows) -> {canonical}\n")

        if dry_run:
            sys.stdout.write("[merge-predicates] Dry-run complete — no changes written.\n")
            sys.stdout.write(
                "[merge-predicates] Re-run with --apply to commit these changes.\n"
            )
            return 0

        # ── Apply ──────────────────────────────────────────────────────────────
        try:
            backup_path = backup_kg(kg_path)
            sys.stdout.write(f"[merge-predicates] Backup written: {backup_path}\n")
        except OSError as e:
            sys.stderr.write(
                f"[merge-predicates] ERROR: backup failed ({e}) — aborting --apply.\n"
            )
            return 2

        total_updated = 0
        merged_clusters: list[dict] = []

        for alias, count in sorted(alias_counts.items()):
            canonical = work_map[alias]
            affected = merge_cluster(con, alias, canonical, dry_run=False)
            merged_clusters.append({"alias": alias, "canonical": canonical, "rows": affected})
            total_updated += affected
            sys.stdout.write(f"  [updated] {alias} -> {canonical}: {affected} rows\n")

        # ── Dedup: a renamed alias row can collide with a pre-existing canonical
        # row on the same (subject, predicate, object); collapse those to one,
        # keeping the lowest id. Scoped to the canonicals we just merged into so
        # unrelated rows are never touched. Makes --apply truly idempotent.
        merged_canonicals = sorted({c["canonical"] for c in merged_clusters})
        if merged_canonicals:
            placeholders = ",".join("?" * len(merged_canonicals))
            con.execute(
                f"DELETE FROM triples "
                f"WHERE predicate IN ({placeholders}) "
                f"AND id NOT IN ("
                f"  SELECT MIN(id) FROM triples "
                f"  WHERE predicate IN ({placeholders}) "
                f"  GROUP BY subject, predicate, object"
                f")",
                merged_canonicals + merged_canonicals,
            )

        con.commit()
        sys.stdout.write(f"[merge-predicates] Applied: {total_updated} row(s) updated.\n")

        # ── Audit log ─────────────────────────────────────────────────────────
        audit_entry = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "kg_path": kg_path,
            "predicates_path": predicates_path,
            "mode": "apply",
            "cluster_filter": args.cluster,
            "merged": merged_clusters,
            "total_rows_updated": total_updated,
        }
        append_audit_log(audit_entry)
        sys.stdout.write("[merge-predicates] Audit log written to MEMORY/STATE/merge-predicates.jsonl\n")

        return 0

    finally:
        con.close()


if __name__ == "__main__":
    sys.exit(main())
