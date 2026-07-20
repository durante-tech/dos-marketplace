#!/usr/bin/env python3
"""
validate-predicates.py — MemPalace KG predicate vocabulary validator.

Reads PREDICATES.md, parses the canonical predicate list and alias map,
opens the live MemPalace KG sqlite, and reports out-of-vocabulary predicates.

USAGE:
  python3 validate-predicates.py            # report mode (always exits 0)
  python3 validate-predicates.py --strict   # exit 1 on any unknowns
  python3 validate-predicates.py --json     # machine-readable JSON summary
  python3 validate-predicates.py --fixture-test  # self-test with synthetic KG

PREDICATES.md search order:
  1. ~/.claude/skills/mem-palace/PREDICATES.md  (live install)
  2. sibling directory: ../../PREDICATES.md     (pack source checkout)
  3. ../../../skills/mem-palace/PREDICATES.md    (relative from Packs/mem-palace/src/Tools/)

KG path (first that exists):
  MEMPALACE_KG_PATH env var, then $MEMPALACE_DIR/knowledge_graph.sqlite3
  (default ~/.mempalace/knowledge_graph.sqlite3 — same resolution the bridge uses)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import sys
import tempfile

# ─── PREDICATES.md resolution ────────────────────────────────────────────────

def _find_predicates_md() -> str | None:
    this_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        # Live install (preferred)
        os.path.expanduser("~/.claude/skills/mem-palace/PREDICATES.md"),
        # Pack source relative (Packs/mem-palace/src/Tools/ → Packs/mem-palace/)
        os.path.realpath(os.path.join(this_dir, "..", "..", "PREDICATES.md")),
        # One more fallback level
        os.path.realpath(os.path.join(this_dir, "..", "..", "..", "mem-palace", "PREDICATES.md")),
    ]
    for c in candidates:
        if os.path.isfile(c):
            return c
    return None


# ─── Parsing ─────────────────────────────────────────────────────────────────

def parse_canonical_predicates(text: str) -> set[str]:
    """Extract canonical predicate names from §1 markdown tables.

    Matches rows whose first column is a backtick-wrapped lowercase identifier:
      | `canonical_name` | ... |
    """
    canonicals: set[str] = set()
    in_section_1 = False
    for line in text.splitlines():
        # Track top-level section via '## N.' headings; only §1 declares
        # canonical predicates. §7 (auto-emitted triage) uses the same
        # table-row shape and must NOT be swept into the canonical set.
        heading = re.match(r"^##\s+(\d+)\.", line)
        if heading:
            in_section_1 = heading.group(1) == "1"
            continue
        if not in_section_1:
            continue
        m = re.match(r"^\|\s*`([a-z][a-z0-9_]*)`\s*\|", line)
        if m:
            canonicals.add(m.group(1))
    return canonicals


def parse_alias_map(text: str) -> dict[str, str]:
    """Extract the alias→canonical map from the §2 fenced JSON block."""
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
        sys.stderr.write(f"[validate-predicates] Failed to parse alias map JSON: {e}\n")
        return {}


# ─── KG access ───────────────────────────────────────────────────────────────

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


def get_kg_predicates(kg_path: str) -> list[str]:
    """Return all DISTINCT predicate values from the KG triples table.

    Returns [] if the file is empty, the table does not exist, or the DB
    cannot be opened — callers treat an empty list as 'no data yet'.
    """
    if not kg_path or os.path.getsize(kg_path) == 0:
        return []
    try:
        con = sqlite3.connect(f"file:{kg_path}?mode=ro", uri=True)
        try:
            tables = {
                r[0]
                for r in con.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()
            }
            if "triples" not in tables:
                return []
            rows = con.execute("SELECT DISTINCT predicate FROM triples").fetchall()
            return [r[0] for r in rows if r[0]]
        finally:
            con.close()
    except sqlite3.Error as e:
        sys.stderr.write(f"[validate-predicates] KG read error: {e}\n")
        return []


# ─── Classification ───────────────────────────────────────────────────────────

def classify_predicates(
    predicates: list[str],
    canonicals: set[str],
    aliases: dict[str, str],
) -> dict[str, list]:
    """Classify predicates into canonical, alias, or unknown buckets."""
    result: dict[str, list] = {"canonical": [], "alias": [], "unknown": []}
    for p in sorted(set(predicates)):
        if p in canonicals:
            result["canonical"].append(p)
        elif p in aliases:
            result["alias"].append({"predicate": p, "resolves_to": aliases[p]})
        else:
            result["unknown"].append(p)
    return result


# ─── Workflow scan (PRD 20260626 Feature-4 / ISC-24) ─────────────────────────

# Only workflow files that OPT IN via this marker are scanned for write-time
# predicate hygiene. The marker is emitted by the §3 predicate-citation block
# (PREDICATES.md §3) that the KG-writing workflows (SyncTelos / DeepExplore /
# MineProject) carry. Files without it (Mine, MineDir, reconcile examples, …)
# are not fact-writers and must NOT trip the gate on illustrative predicates.
WRITER_MARKER = "<!-- kg-writer:"

# Matches a predicate name in a bridge add-fact call, in either the JSON arg
# shape (`"predicate":"X"` / `"predicate": "X"`) or the python kwarg shape used
# by mempalace_kg_add (`predicate="X"` / `predicate = "X"`).
_PRED_RE = re.compile(r'(?:"predicate"\s*:|predicate\s*=)\s*"([a-z][a-z0-9_]*)"')


def extract_workflow_predicates(text: str) -> set[str]:
    """Extract predicate names written by a kg-writer workflow's bridge calls."""
    return set(_PRED_RE.findall(text))


def scan_workflows(
    workflows_dir: str,
    canonicals: set[str],
    aliases: dict[str, str],
) -> tuple[int, dict]:
    """Scan kg-writer workflow files for non-canonical predicate writes.

    A workflow may write a predicate only if it is CANONICAL. Aliases must be
    resolved to their canonical form at write time, and unknown predicates are
    forbidden — so any alias or unknown found in a writer file fails the gate.
    Returns (exit_code, report); exit_code is 1 when any finding exists.
    """
    import glob

    findings: dict[str, dict] = {}
    scanned: list[str] = []
    md_files = sorted(glob.glob(os.path.join(workflows_dir, "*.md")))
    for path in md_files:
        try:
            with open(path, encoding="utf-8") as fh:
                text = fh.read()
        except OSError:
            continue
        if WRITER_MARKER not in text:
            continue
        scanned.append(os.path.basename(path))
        preds = extract_workflow_predicates(text)
        bad_alias = sorted(p for p in preds if p in aliases)
        bad_unknown = sorted(p for p in preds if p not in canonicals and p not in aliases)
        if bad_alias or bad_unknown:
            findings[os.path.basename(path)] = {
                "alias": [{"predicate": p, "resolves_to": aliases[p]} for p in bad_alias],
                "unknown": bad_unknown,
            }
    return (1 if findings else 0), {"workflows_dir": workflows_dir, "scanned": scanned, "findings": findings}


# ─── Fixture test ─────────────────────────────────────────────────────────────

def run_fixture_test(canonicals: set[str], aliases: dict[str, str]) -> int:
    """Self-test with a synthetic KG containing known canonical, alias, and unknown predicates.

    Creates a temp sqlite DB, inserts known-mix predicates, classifies them,
    and asserts the categorization is correct. Exits 1 on assertion failure.
    """
    # Invariant: no parsed canonical name may also be an alias-map key. This
    # guards the §7-triage-table over-parse regression (a row that lands in both
    # buckets makes validate and merge disagree on the same predicate).
    overlap = sorted(set(canonicals) & set(aliases.keys()))
    if overlap:
        sys.stderr.write(
            "[validate-predicates] FIXTURE TEST FAILED: "
            f"{len(overlap)} predicate(s) are BOTH canonical and alias keys "
            f"(canonical/alias buckets must be disjoint): {overlap}\n"
        )
        return 1

    # Pick stable representatives from the loaded vocabulary
    test_canonical = sorted(canonicals)[:3] if len(canonicals) >= 3 else sorted(canonicals)
    test_alias_entries = list(aliases.items())[:2] if len(aliases) >= 2 else list(aliases.items())
    test_unknowns = ["__fixture_unknown_abc__", "__fixture_unknown_xyz__"]

    insert_predicates = (
        test_canonical
        + [k for k, _ in test_alias_entries]
        + test_unknowns
    )

    with tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False) as f:
        tmp_path = f.name

    try:
        con = sqlite3.connect(tmp_path)
        con.execute(
            "CREATE TABLE triples "
            "(id INTEGER PRIMARY KEY, subject TEXT, predicate TEXT, object TEXT)"
        )
        for p in insert_predicates:
            con.execute(
                "INSERT INTO triples (subject, predicate, object) VALUES (?, ?, ?)",
                ("fixture-subject", p, "fixture-object"),
            )
        con.commit()
        con.close()

        # Classify
        preds = get_kg_predicates(tmp_path)
        cls = classify_predicates(preds, canonicals, aliases)

        failures: list[str] = []

        # Assert canonical bucket contains expected entries
        found_canonicals = set(cls["canonical"])
        for p in test_canonical:
            if p not in found_canonicals:
                failures.append(f"Expected '{p}' in canonical bucket, not found")

        # Assert alias bucket contains expected alias entries
        found_alias_preds = {e["predicate"] for e in cls["alias"]}
        for alias, _ in test_alias_entries:
            if alias not in found_alias_preds:
                failures.append(f"Expected alias '{alias}' in alias bucket, not found")

        # Assert unknown bucket contains exactly the synthetic unknowns
        found_unknowns = set(cls["unknown"])
        for u in test_unknowns:
            if u not in found_unknowns:
                failures.append(f"Expected '{u}' in unknown bucket, not found")

        # ── scan-workflows sub-test (ISC-24): marker discrimination + gating ──
        import shutil

        good_pred = sorted(canonicals)[0] if canonicals else "is_a"
        alias_pred = next(iter(aliases)) if aliases else None
        scan_dir = tempfile.mkdtemp(prefix="vp-scan-")
        try:
            fact = 'add_kg_fact \'{"subject":"s","predicate":"%s","object":"o"}\'\n'
            # (a) GOOD writer: marker + canonical predicate write -> exit 0
            with open(os.path.join(scan_dir, "Good.md"), "w", encoding="utf-8") as gh:
                gh.write(WRITER_MARKER + " canonical predicates only -->\n")
                gh.write(fact % good_pred)
            code_good, _ = scan_workflows(scan_dir, canonicals, aliases)
            if code_good != 0:
                failures.append(
                    f"scan: GOOD fixture (canonical '{good_pred}') expected exit 0, got {code_good}"
                )
            if alias_pred:
                # (b) BAD writer: marker + alias predicate write -> exit 1
                with open(os.path.join(scan_dir, "Bad.md"), "w", encoding="utf-8") as bh:
                    bh.write(WRITER_MARKER + " canonical predicates only -->\n")
                    bh.write(fact % alias_pred)
                code_bad, _ = scan_workflows(scan_dir, canonicals, aliases)
                if code_bad != 1:
                    failures.append(
                        f"scan: BAD fixture (alias '{alias_pred}') expected exit 1, got {code_bad}"
                    )
                # (c) same alias write but NO marker -> ignored (exit 0)
                with open(os.path.join(scan_dir, "Bad.md"), "w", encoding="utf-8") as bh:
                    bh.write(fact % alias_pred)
                code_nomark, _ = scan_workflows(scan_dir, canonicals, aliases)
                if code_nomark != 0:
                    failures.append(
                        f"scan: unmarked file with alias '{alias_pred}' should be ignored, "
                        f"expected exit 0, got {code_nomark}"
                    )
        finally:
            shutil.rmtree(scan_dir, ignore_errors=True)

        if failures:
            sys.stderr.write("[validate-predicates] FIXTURE TEST FAILED:\n")
            for f in failures:
                sys.stderr.write(f"  - {f}\n")
            return 1

        sys.stdout.write(
            f"[validate-predicates] Fixture test PASSED — "
            f"{len(test_canonical)} canonical, {len(test_alias_entries)} alias, "
            f"{len(test_unknowns)} unknown correctly categorized.\n"
        )
        return 0

    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate MemPalace KG predicates against canonical vocabulary."
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit 1 on any out-of-vocabulary predicates.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable JSON summary to stdout.",
    )
    parser.add_argument(
        "--fixture-test",
        action="store_true",
        help="Run a self-test with a synthetic KG (overrides normal operation).",
    )
    parser.add_argument(
        "--scan-workflows",
        metavar="DIR",
        help="Scan kg-writer workflow markdown in DIR; exit 1 on alias/unknown predicate writes.",
    )
    parser.add_argument(
        "--kg",
        metavar="PATH",
        help="Override the KG sqlite path (also honored via MEMPALACE_KG_PATH env).",
    )
    args = parser.parse_args()

    # ── Load PREDICATES.md ──────────────────────────────────────────────────
    predicates_path = _find_predicates_md()
    if not predicates_path:
        sys.stderr.write(
            "[validate-predicates] ERROR: PREDICATES.md not found. "
            "Searched: ~/.claude/skills/mem-palace/PREDICATES.md and pack source.\n"
        )
        return 2

    with open(predicates_path, encoding="utf-8") as fh:
        predicates_text = fh.read()

    canonicals = parse_canonical_predicates(predicates_text)
    aliases = parse_alias_map(predicates_text)

    if not args.json:
        sys.stdout.write(
            f"[validate-predicates] Loaded {len(canonicals)} canonical predicates, "
            f"{len(aliases)} aliases from {predicates_path}\n"
        )

    # ── Fixture test mode ───────────────────────────────────────────────────
    if args.fixture_test:
        return run_fixture_test(canonicals, aliases)

    # ── Workflow scan mode (ISC-24) ─────────────────────────────────────────
    if args.scan_workflows:
        if not os.path.isdir(args.scan_workflows):
            sys.stderr.write(
                f"[validate-predicates] scan dir not found: {args.scan_workflows}\n"
            )
            return 2
        code, report = scan_workflows(args.scan_workflows, canonicals, aliases)
        if args.json:
            sys.stdout.write(json.dumps(report) + "\n")
        else:
            sys.stdout.write(
                f"[validate-predicates] scan-workflows: {len(report['scanned'])} "
                f"kg-writer file(s) scanned in {args.scan_workflows}\n"
            )
            if report["findings"]:
                for fname, f in report["findings"].items():
                    for a in f["alias"]:
                        sys.stdout.write(
                            f"  {fname}: ALIAS '{a['predicate']}' must be canonicalized "
                            f"to '{a['resolves_to']}'\n"
                        )
                    for u in f["unknown"]:
                        sys.stdout.write(
                            f"  {fname}: UNKNOWN '{u}' is not in PREDICATES.md\n"
                        )
                sys.stderr.write(
                    "[validate-predicates] SCAN: workflow(s) write non-canonical "
                    "predicates — exit 1\n"
                )
            else:
                sys.stdout.write(
                    "  All kg-writer workflows write only canonical predicates.\n"
                )
        return code

    # ── KG path ─────────────────────────────────────────────────────────────
    if args.kg:
        kg_path: str | None = args.kg
        if not os.path.exists(kg_path):
            sys.stderr.write(f"[validate-predicates] KG not found at: {kg_path}\n")
            return 2
    else:
        kg_path = _find_kg_path()

    if not kg_path:
        msg = (
            "[validate-predicates] KG sqlite not found "
            "(set MEMPALACE_KG_PATH or ensure ~/.mempalace/knowledge_graph.sqlite3 exists)\n"
        )
        if args.json:
            sys.stdout.write(
                json.dumps({
                    "error": "kg_not_found",
                    "predicates_path": predicates_path,
                    "canonical_count": len(canonicals),
                    "alias_count": len(aliases),
                })
                + "\n"
            )
            return 0
        sys.stderr.write(msg)
        # Non-fatal in report mode: report vocab sizes and exit 0.
        sys.stdout.write("[validate-predicates] KG unavailable — vocabulary loaded but no predicates to check.\n")
        return 0

    # ── Classify KG predicates ───────────────────────────────────────────────
    kg_predicates = get_kg_predicates(kg_path)

    if not kg_predicates:
        if args.json:
            sys.stdout.write(
                json.dumps({
                    "kg_path": kg_path,
                    "predicates_path": predicates_path,
                    "kg_predicate_count": 0,
                    "canonical_count": len(canonicals),
                    "alias_count": len(aliases),
                    "classified": {"canonical": [], "alias": [], "unknown": []},
                    "unknown_count": 0,
                })
                + "\n"
            )
        else:
            sys.stdout.write(
                "[validate-predicates] KG has no predicates (empty or table missing) — nothing to validate.\n"
            )
        return 0

    classified = classify_predicates(kg_predicates, canonicals, aliases)
    unknown_count = len(classified["unknown"])

    if args.json:
        sys.stdout.write(
            json.dumps({
                "kg_path": kg_path,
                "predicates_path": predicates_path,
                "kg_predicate_count": len(kg_predicates),
                "canonical_count": len(canonicals),
                "alias_count": len(aliases),
                "classified": classified,
                "unknown_count": unknown_count,
            })
            + "\n"
        )
    else:
        total = len(kg_predicates)
        n_can = len(classified["canonical"])
        n_alias = len(classified["alias"])
        sys.stdout.write(
            f"[validate-predicates] {total} distinct predicates in KG:\n"
            f"  canonical : {n_can}\n"
            f"  alias     : {n_alias}\n"
            f"  unknown   : {unknown_count}\n"
        )
        if classified["alias"]:
            sys.stdout.write("  Aliases found (can be migrated with merge-predicates.py):\n")
            for entry in classified["alias"]:
                sys.stdout.write(f"    {entry['predicate']} -> {entry['resolves_to']}\n")
        if classified["unknown"]:
            sys.stdout.write("  Unknown predicates (not in PREDICATES.md):\n")
            for u in classified["unknown"]:
                sys.stdout.write(f"    {u}\n")

    if args.strict and unknown_count > 0:
        sys.stderr.write(
            f"[validate-predicates] STRICT: {unknown_count} unknown predicate(s) found — exit 1\n"
        )
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
