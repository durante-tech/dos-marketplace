#!/usr/bin/env python3
"""
MemPalace Bridge — Thin CLI for DOS hooks to call MemPalace.

DOS hooks are TypeScript (Bun). This bridge lets them interact with
MemPalace's Python API via subprocess. All operations are designed
to be called fire-and-forget from hooks (non-blocking).

Usage:
    python3 bridge.py <action> '<json_args>'

Actions:
    init                — Create palace directory, ChromaDB collection, and KG database
    add_drawer          — Store content in a wing/room (with hall + entity enrichment)
    upsert_drawer       — Replace drawer by (wing, room, source_file, added_by) identity
    update_drawer       — Update a drawer by explicit drawer_id
    delete_drawer       — Delete a drawer by explicit drawer_id (IRREVERSIBLE)
    add_kg_fact         — Add temporal entity-relationship fact
    invalidate          — Mark a KG fact as no longer true
    search              — Hybrid BM25+vector search (closet boost, drawer-grep)
    status              — Palace overview
    mine_file           — Mine a single file (smart markdown chunking)
    mine_dir            — Mine all .md files in a directory tree
    kg_query            — Query KG by entity + direction + optional predicate filter
    kg_query_predicate  — Query KG by predicate across all entities
    kg_timeline         — Get entity timeline
    wake_up             — Generate L0+L1 session start context
    classify            — Classify text into 5 memory types
    traverse            — Walk palace graph from a room
    find_tunnels        — Find rooms that bridge two wings
    mine_convos         — Mine conversation files
    diary               — Read/write agent diary entries
    batch               — Execute multiple operations in one subprocess call (shared resources)
    fact_check          — Check text for contradictions against KG and entity registry
    rebuild_closets     — Build closet index for existing drawers (migration utility)

Error handling:
    ALL errors return JSON on stdout with status="error". Exit code is always 0.
    Callers must check the status field, not the exit code.

Examples:
    python3 bridge.py init
    python3 bridge.py add_drawer '{"wing":"learnings","room":"algorithm","content":"..."}'
    python3 bridge.py add_kg_fact '{"subject":"auth-flow","predicate":"decided","object":"use bcrypt"}'
    python3 bridge.py search '{"query":"authentication decisions","limit":5}'
    python3 bridge.py mine_dir '{"dir":"~/.claude/MEMORY/LEARNING/ALGORITHM","wing":"learnings","room":"algorithm"}'
    python3 bridge.py status

V11.13 split (2026-05-08): the implementation lives in three sibling
modules — _bridge_palace.py (infra + admin actions), _bridge_drawers.py
(drawer/search/mine actions), _bridge_kg.py (knowledge-graph actions).
This file is now a thin facade that re-exports those names and owns the
CLI dispatch. RFC-0035 §MW3-F (Beck Tidy First).
"""

import sys
import os
import json
import importlib.util
import shutil
import subprocess

# Make sibling _bridge_*.py modules importable regardless of how this file is
# invoked. Both `python3 bridge.py` (canonical name in pack source) and
# `python3 mempalace_bridge.py` (install alias under ~/.claude/DOS/Tools/)
# use the same Tools/ directory; prepending it to sys.path lets the sibling
# modules use bare `import _bridge_palace` instead of relative-package syntax
# (the directory is not a package — there is no __init__.py).
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

# G1 (dos#356): stdlib-only daemon-first relay — importable before (and
# without) the heavy chromadb/mempalace runtime.
from _bridge_relay import run_relay_first  # noqa: E402


def _bridge_runtime_ready() -> bool:
    return (
        importlib.util.find_spec("mempalace") is not None
        and importlib.util.find_spec("chromadb") is not None
    )


def _shebang_interpreter(path: str | None) -> str | None:
    if not path or not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as handle:
            first = handle.readline().strip()
    except OSError:
        return None
    if not first.startswith("#!"):
        return None
    candidate = first[2:].strip().split()[0]
    return candidate if os.path.exists(candidate) and os.access(candidate, os.X_OK) else None


def _candidate_mempalace_python() -> str | None:
    candidates = [
        os.environ.get("MEMPALACE_PYTHON"),
        _shebang_interpreter(shutil.which("mempalace-mcp")),
        _shebang_interpreter(os.path.expanduser("~/.local/bin/mempalace-mcp")),
    ]
    current = os.path.realpath(sys.executable)
    probe = (
        "import importlib.util, sys; "
        "sys.exit(0 if importlib.util.find_spec('mempalace') "
        "and importlib.util.find_spec('chromadb') else 1)"
    )
    for candidate in candidates:
        if not candidate:
            continue
        candidate = os.path.realpath(candidate)
        if candidate == current:
            continue
        try:
            result = subprocess.run(
                [candidate, "-c", probe],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=3,
                check=False,
            )
        except Exception:
            continue
        if result.returncode == 0:
            return candidate
    return None


def _reexec_with_mempalace_runtime_if_needed() -> None:
    if os.environ.get("MEMPALACE_BRIDGE_REEXECED") == "1" or _bridge_runtime_ready():
        return
    python = _candidate_mempalace_python()
    if not python:
        return
    env = dict(os.environ)
    env["MEMPALACE_BRIDGE_REEXECED"] = "1"
    os.execve(python, [python, os.path.abspath(__file__), *sys.argv[1:]], env)


# Interpreter selection is a CLI concern. Importers (including the shared
# classifier-parity suite) must be able to load bridge helpers without this
# module replacing their process and reinterpreting their argv as bridge args.
if __name__ == "__main__":
    _reexec_with_mempalace_runtime_if_needed()


# ─── Install-parity guard (ISC-58, 2026-05-12) ───────────────────────────────
# Env-gated: missing MEMPALACE_EXPECTED_VERSION = no-op (preserves hook compat).
# When set and divergent, fails loudly with exit code 2 rather than silently
# operating on a mismatched ChromaDB metadata shape. ISC-56 locked 2026-05-12:
# pin system pip to 3.3.5; ISC-57 (pip install) deferred to operator-approve.
_expected_mp_ver = os.environ.get("MEMPALACE_EXPECTED_VERSION")
if _expected_mp_ver:
    import mempalace as _mempalace_check  # noqa: E402 — after re-exec, always importable
    if _mempalace_check.__version__ != _expected_mp_ver:
        sys.stderr.write(
            f"FATAL: mempalace version mismatch — "
            f"expected {_expected_mp_ver}, got {_mempalace_check.__version__}\n"
        )
        sys.exit(2)


# --- Sibling-module imports + re-exports (back-compat for `from bridge import X`) ---
#
# We re-export the public action names plus a small set of public infra helpers
# (`get_palace_path`, `get_palace_collection`, `get_kg`) so existing callers
# that do `from bridge import status` or `from mempalace_bridge import get_kg`
# keep working byte-identically. Underscore-prefixed internals stay inside
# their owning modules — callers that need them should import the module.

from _bridge_palace import (  # noqa: E402,F401
    __version__,
    # shared infra (public)
    get_palace_path,
    get_palace_collection,
    get_kg,
    # palace actions
    init,
    status,
    wake_up,
    classify,
    traverse,
    find_tunnels,
    create_tunnel,  # V11.14 item 1 (RFC-0035 §3 item 3)
    suggest_parent,
    diary,
    batch,
    fact_check,
    build_closets,
    rebuild_closets,
    backfill_closets,  # V11.21 (RFC-0073 audit C.9)
    append_reflection,
    reconcile,
    graph_stats,
    last_checkpoint,
    last_checkpoint_at,
    memories_filed_away,
)
from _bridge_palace import _build_actions_table  # noqa: E402 — used below

from _bridge_drawers import (  # noqa: E402,F401
    add_drawer,
    upsert_drawer,
    update_drawer,
    delete_drawer,
    search,
    list_drawers,  # V11.14 item 5 (RFC-0035 §3 item 8)
    audit_drawer,  # cap 11 (auditability-explainable-recall)
    mine_file,
    mine_dir,
    mine_convos,
)

from _bridge_kg import (  # noqa: E402,F401
    add_kg_fact,
    invalidate,
    update_entity,
    merge_entities,
    kg_query,
    kg_query_predicate,
    kg_timeline,
    kg_stats,
)

import _bridge_drawers as _drawers_mod  # noqa: E402
import _bridge_kg as _kg_mod  # noqa: E402


# Build the dispatch table from the three split modules. The palace module
# memoizes the result so batch() reuses the same dict instead of rebuilding.
ACTIONS = _build_actions_table(_drawers_mod, _kg_mod)


# ─── B1 clean-shutdown drain (RFC-0075 HNSW corruption fix, facade path) ─────
#
# Subprocess-fallback path (when the V11.18 daemon socket is unreachable) runs
# the action inside THIS short-lived process. If a hook's 5s Bun.spawnSync
# timeout fires, the harness SIGTERMs us mid-write, leaving ChromaDB's HNSW
# header on disk with stale offsets → next call's index load crashes. The
# daemon's handler and this facade both delegate to the single drain owner,
# `_bridge_palace.drain_handles` (PRD-A) — the sequence is never copied.
#
# We release the KG sqlite connection and zero `_bridge_palace` module-level
# handles so the next ACTIONS[action] call rebuilds them cleanly. ChromaDB's
# PersistentClient has no public close — we drop the reference and let GC
# trigger __del__, then sleep briefly to give that __del__ time to flush.
#
# atexit covers normal exit; signal handlers cover SIGTERM/SIGINT.

import atexit as _atexit
import signal as _signal


def _facade_drain_palace_handles(reason: str) -> None:
    """Delegate to the single drain owner (PRD-A: `_bridge_palace.drain_handles`).

    The drain SEQUENCE lives in `_bridge_palace.drain_handles(reason)` — do not
    re-inline it here (the pre-PRD-A hand-kept copies drifted). This wrapper
    keeps facade policy only: tolerate `_bridge_palace` not being loaded (tests
    import this module standalone) and never raise from a shutdown hook.
    """
    try:
        palace_mod = sys.modules.get("_bridge_palace")
        if palace_mod is None:
            return
        drain = getattr(palace_mod, "drain_handles", None)
        if callable(drain):
            drain(reason)
    except Exception:
        # Never raise from a shutdown hook — the spawn-side caller is already
        # giving up on this process; we just want a clean HNSW state on disk.
        pass


def _facade_atexit_hook() -> None:
    # No sleep here — atexit fires during normal interpreter shutdown after
    # main() returned 0; PersistentClient.__del__ will run in the same
    # teardown phase even without an explicit sleep.
    _facade_drain_palace_handles("atexit")


def _facade_signal_handler(signum, _frame):  # noqa: ANN001
    """SIGTERM/SIGINT mirror of the daemon's handler. Drains then exits."""
    _facade_drain_palace_handles(f"signal-{signum}")
    # Give PersistentClient.__del__ time to flush HNSW before the process is
    # reaped. 0.2s matches the daemon-side budget (RFC-0075 V11.18 smoke
    # tests show ChromaDB atexit completes in <50ms on warm handles).
    import time as _drain_time  # local import — main `_time` lives below
    try:
        _drain_time.sleep(0.2)
    except Exception:
        pass
    # W1-S1 (2026-06-10): exit TRUTHFULLY with the signal-derived code
    # (128+signum: SIGTERM→143, SIGINT→130). The previous sys.exit(0) here
    # laundered EVERY timeout kill into exit-0-plus-empty-stdout — the TS
    # classifier (summarizeBridgeResult) saw a "successful" call with no
    # output and logged 'empty stdout' (162/day at the 2026-06-10 baseline,
    # status 92 + search 61), making the kill class undiagnosable. With the
    # honest code, callers that passed an explicit budget classify the kill
    # as degraded/budget-exceeded (by design); default-timeout kills surface
    # as err:exit=143 — a real alarm. The drain above still runs first, so
    # HNSW flush safety is unchanged; atexit still fires on SystemExit.
    sys.exit(128 + signum)


_atexit.register(_facade_atexit_hook)
try:
    _signal.signal(_signal.SIGTERM, _facade_signal_handler)
    _signal.signal(_signal.SIGINT, _facade_signal_handler)
except (ValueError, OSError):
    # signal.signal raises ValueError if not in main thread. The bridge CLI
    # facade always runs in main thread but tests may import this module
    # from a worker — fail-open so import doesn't crash.
    pass


# ─── Q1 + L: Predicate-gate + Bridge-actions audit-log at the aggregate seam ───
#
# Council Q1 verdict (audit 20260510-145902): the predicate gate must live at
# the Python bridge entry-point, not just the TS shim — direct CLI callers,
# the V11.18 daemon socket path, the V11.12 typed client, and 6 direct-CLI
# hooks all flow through here. Mirrors the canonical TS implementation in
# `~/.claude/hooks/lib/mempalace.ts` validatePredicate / queuePredicateProposal.
#
# L diagnosis (audit 20260510-145902): the Python bridge entry-point emits one
# `bridge-actions.jsonl` line per spawn (TS shim, daemon, direct CLI), so every
# invocation is observed exactly once in that audit trail. PREDICATES.md is the
# single SoT (RFC-0073 Rule 5.c).
#
# RFC-0128 D3 (retirement note): the original motivation here was the cross-file
# `bridge-event-ratio` = (memory-events.jsonl lines / bridge-actions.jsonl
# lines), once gated to [0.99, 1.01]. That ratio is RETIRED — a parity ratio
# between two independently-written logs is structurally fragile (a SIGTERM
# between the two appends tears the pair, with no correlation id to rejoin them).
# The live health signal now lives WITHIN memory-events.jsonl: write-success-rate
# + served-by distribution (see dos-memory-status.ts). bridge-actions.jsonl is
# KEPT as an informational audit trail (R26 audit invariant, R-FW-7 silent-debt
# baseline) — it is simply no longer half of a parity gate.

import datetime as _datetime
import hashlib as _hashlib
import re as _re
import time as _time

# Cache the parsed vocab for the lifetime of this Python process (one CLI
# invocation = one process; the daemon reuses across requests).
_PREDICATE_VOCAB_CACHE: dict | None = None

# Actions that ASSERT a predicate (write-side); these are gated. Read-side
# actions like `kg_query_predicate` accept any predicate string as a filter.
# PRD-B: gate set lives in the bridge-write-actions fixture (shared with the
# WRITE_ACTIONS universe); guarded load + pinned fallback — the gate must keep
# enforcing even if the fixture file is missing (fail to the KNOWN set, never
# fail-open to an empty one).
_PREDICATE_GATE_FALLBACK = frozenset({"add_kg_fact", "invalidate"})


def _load_predicate_gate_fixture() -> frozenset:
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
                _acts = _json.load(_f)["predicate_gate_actions"]
            if _acts:
                return frozenset(_acts)
        except Exception:
            continue
    return _PREDICATE_GATE_FALLBACK


_PREDICATE_GATE_ACTIONS = _load_predicate_gate_fixture()


def _resolve_predicates_md_path() -> str | None:
    """Search PREDICATES.md in priority order, mirroring TS shim (mempalace.ts:382-384)."""
    dos_dir = os.environ.get("DOS_DIR", os.path.expanduser("~/.claude"))
    # Resolution order, first hit wins:
    #   1. installed skill copy: $DOS_DIR/skills/mem-palace/PREDICATES.md (the
    #      live winner in the shipped/symlink layout)
    #   2. sibling-of-Tools fallback: 2 levels up from _HERE — in the live
    #      DOS/Tools/ layout this is DOS/PREDICATES.md (not currently present);
    #      in pack-source it is Packs/mem-palace/src/PREDICATES.md
    #   3. pack-source path: $DOS_DIR/../../Packs/mem-palace/PREDICATES.md (the
    #      maintainer repo path)
    candidates = [
        os.path.join(dos_dir, "skills", "mem-palace", "PREDICATES.md"),
        os.path.normpath(os.path.join(_HERE, "..", "..", "PREDICATES.md")),
        os.path.normpath(os.path.join(dos_dir, "..", "..", "Packs", "mem-palace", "PREDICATES.md")),
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return None


def _load_predicate_vocab() -> dict:
    """Parse PREDICATES.md → {canonicals: set, aliases: dict}. Fail-open if missing."""
    global _PREDICATE_VOCAB_CACHE
    if _PREDICATE_VOCAB_CACHE is not None:
        return _PREDICATE_VOCAB_CACHE

    canonicals: set[str] = set()
    aliases: dict[str, str] = {}
    path = _resolve_predicates_md_path()
    if path:
        try:
            with open(path, "r") as f:
                text = f.read()
            # MP-PY-02 (RE-APPLIED 2026-07-07 after operator ratification):
            # restrict the canonical sweep to §1, mirroring the auditor
            # validate-predicates.py `parse_canonical_predicates`. Only "## 1."
            # declares canonicals; §7 (auto-emitted pending triage) reuses the
            # same table-row shape, so a whole-file sweep made this write gate
            # MORE permissive than the auditor. Safe now: the one §7 predicate
            # with a live producer (`correction`, MemPalaceRate) was promoted
            # to §1 by operator ratification (RFC-0073, 2026-07-07). Keep this
            # loop in lockstep with the sibling parser.
            in_section_1 = False
            for line in text.split("\n"):
                heading = _re.match(r"^##\s+(\d+)\.", line)
                if heading:
                    in_section_1 = heading.group(1) == "1"
                    continue
                if not in_section_1:
                    continue
                m = _re.match(r"^\|\s*`([a-z][a-z0-9_]*)`\s*\|", line)
                if m:
                    canonicals.add(m.group(1))
            # Parse fenced JSON for alias map.
            jm = _re.search(r"```json\n([\s\S]*?)\n```", text)
            if jm:
                try:
                    alias_obj = json.loads(jm.group(1))
                    if isinstance(alias_obj, dict):
                        for alias, canonical in alias_obj.items():
                            if isinstance(alias, str) and isinstance(canonical, str):
                                aliases[alias] = canonical
                except Exception:
                    pass
        except Exception:
            pass

    _PREDICATE_VOCAB_CACHE = {"canonicals": canonicals, "aliases": aliases}
    return _PREDICATE_VOCAB_CACHE


def _validate_predicate(name: str) -> dict:
    """Validate predicate against PREDICATES.md. Fail-open when vocab missing."""
    vocab = _load_predicate_vocab()
    if not vocab["canonicals"]:
        return {"valid": True}  # fail-open: missing PREDICATES.md must not block
    if name in vocab["canonicals"] or name in vocab["aliases"]:
        return {"valid": True}
    return {
        "valid": False,
        "reason": f'unknown predicate "{name}" — not in PREDICATES.md canonical list or alias map',
    }


def _queue_predicate_proposal(*, attempted_predicate: str, subject: str, obj: str,
                               source_hook: str | None = None) -> None:
    """Append rejected-predicate proposal entry. Never raises."""
    _append_jsonl_safe(
        "DOS_PREDICATE_PROPOSALS_PATH",
        ("MEMORY", "STATE", "predicate-proposals.jsonl"),
        {
            "ts": _datetime.datetime.now(_datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
            "attempted_predicate": attempted_predicate,
            "subject": subject,
            "object": obj,
            "source_hook": source_hook,
            "session_id": (os.environ.get("CLAUDE_SESSION_ID")
                           or os.environ.get("CC_SESSION_ID")),
            "suggested_canonical": None,
        },
    )


def enforce_predicate_gate(action: str, args) -> dict | None:
    """Shared write-side predicate gate (RFC-0073 Rule 2 / Council Q1).

    Validates an asserting action's predicate against PREDICATES.md. Returns
    None when the action is allowed (not a gated action, no predicate present,
    gate disabled, or predicate valid). When the predicate is rejected under
    the locked default (block) mode, queues a proposal and returns the
    MCP-style isError payload the CLI emits — so the daemon socket path and
    batch sub-ops reject byte-identically to the cold CLI, and direct callers
    cannot bypass the gate (mempalace_bridge.py:655-694 was the only enforcer
    before this seam was extracted).

    Override env:
      DOS_PREDICATE_GATE=warn  → log to stderr, allow through (return None)
      DOS_PREDICATE_GATE=off   → disable entirely (return None)
    """
    if not (action in _PREDICATE_GATE_ACTIONS
            and isinstance(args, dict)
            and "predicate" in args):
        return None
    gate_mode = os.environ.get("DOS_PREDICATE_GATE", "block").lower()
    if gate_mode == "off":
        return None
    check = _validate_predicate(str(args.get("predicate", "")))
    if check["valid"]:
        return None
    if gate_mode == "warn":
        sys.stderr.write(
            f"[mempalace] predicate-gate WARN ({action}): {check['reason']}\n"
        )
        return None
    # block (locked default per RFC-0073 Rule 2)
    _queue_predicate_proposal(
        attempted_predicate=str(args.get("predicate", "")),
        subject=str(args.get("subject", "")),
        obj=str(args.get("object", "")),
        source_hook=os.environ.get("DOS_CALLER_HOOK"),
    )
    return {
        "isError": True,
        "content": [{
            "type": "text",
            "text": (f"Invalid input: predicate-gate rejected "
                     f"'{args.get('predicate')}': {check['reason']}. "
                     f"Run `bun ~/Durante/Tools/predicate-proposals.ts --list` "
                     f"to see queued proposals; --ratify to add to PREDICATES.md."),
        }],
        "status": "error",
        "error_type": "predicate-gate",
        "message": f"predicate-gate: {check['reason']}",
        "action": action,
    }


def _hash_args(args) -> str:
    """args_hash: first 16 hex of sha256(canonical JSON). Mirrors mempalace.ts hashArgs."""
    if not args or (isinstance(args, dict) and not args):
        return "empty___________"
    try:
        if isinstance(args, dict):
            canonical = json.dumps({k: args[k] for k in sorted(args.keys())},
                                   separators=(",", ":"), default=str)
        else:
            canonical = json.dumps(args, separators=(",", ":"), default=str)
        return _hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:16]
    except Exception:
        return "unhashable______"


def _append_jsonl_safe(env_key: str, default_subpath: tuple[str, ...], record: dict) -> None:
    """Append one JSON record to a JSONL file. Never raises.

    `env_key` overrides the path; otherwise `$DOS_DIR/<default_subpath...>` is used.
    Used by the dual-emit audit-log writer below — both bridge-actions.jsonl and
    memory-events.jsonl share path-resolution + mkdir + append semantics.
    """
    try:
        path = os.environ.get(env_key) or os.path.join(
            os.environ.get("DOS_DIR", os.path.expanduser("~/.claude")),
            *default_subpath,
        )
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "a") as f:
            f.write(json.dumps(record) + "\n")
    except Exception:
        pass  # audit log is advisory — never break a bridge call


def _record_bridge_action(action: str, args, latency_ms: float, result_status: str,
                          result_detail: str | None = None,
                          relay: bool = False,
                          denominator: bool = True) -> None:
    """Append one record to BOTH memory-events.jsonl AND bridge-actions.jsonl.

    G1 (dos#356 review #1): `denominator=False` emits the memory-events
    NUMERATOR only. Used by the CLI's daemon-relay success path — the daemon
    already appends the sole bridge-actions denominator row for every action
    it serves (MP-052, bridge_daemon._record_daemon_action), so the relaying
    CLI writing a second one would double-count the invocation log (one action
    = one denominator row, whoever DISPATCHES owns it). `relay=True` stamps
    the numerator so servedByOf() (dos-memory-status.ts) attributes the call
    to the warm daemon, mirroring the TS recordMemoryEvent relay field.

    memory-events.jsonl carries the LIVE health signal (RFC-0128 D3):
    write-success-rate + served-by distribution, both computed WITHIN this one
    log (see dos-memory-status.ts). bridge-actions.jsonl is an informational
    audit trail (R26 audit invariant, R-FW-7 silent-debt baseline). We emit
    both from the Python entry-point so direct-CLI callers (V11.18 daemon path,
    V11.12 typed client, 6 direct-subprocess hooks) all stay observed exactly
    once.

    RETIRED (RFC-0128 D3): the old cross-file `bridge-event-ratio`
        ratio = (memory-events.jsonl lines) / (bridge-actions.jsonl lines)
    gated to [0.99, 1.01] no longer gates anything — a parity ratio between two
    independently-written logs is structurally fragile (a crash between the two
    appends tears the pair, with no correlation id to rejoin them). Do not
    reason about this dual-emit as half of a parity gate.

    Write order is deliberate: memory-events FIRST, bridge-actions SECOND, so
    the survivor state after a mid-write crash favors the numerator log that
    carries the live signal.
    """
    ts = _datetime.datetime.now(_datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    session_id = (os.environ.get("DOS_SESSION_ID")
                  or os.environ.get("CLAUDE_SESSION_ID"))
    caller = os.environ.get("DOS_CALLER_HOOK")
    latency_int = max(0, int(round(latency_ms)))

    # args_summary: short JSON repr (≤80 chars), matching the TS truncation
    try:
        arg_str = json.dumps(args, separators=(",", ":"), default=str) if args else "{}"
    except Exception:
        arg_str = "<unrepresentable>"
    if len(arg_str) > 80:
        arg_str = arg_str[:77] + "…"

    # ─── memory-events.jsonl FIRST (numerator of the ratio metric) ──────────
    # RFC-0128 D2: when the TS wrapper cold-spawns this CLI, it ALREADY wrote
    # the numerator via recordMemoryEvent and sets DOS_BRIDGE_EMIT=ts so we
    # don't double-count it (the surface-2 over-count the bridge-event-ratio
    # was tripping on). ALL THREE TS cold-spawn paths set the flag
    # (bridgeSync, bridgeAsync, bridgeFire — mempalace.ts; comment corrected
    # W1-S1 ISC-41: an earlier version of this note wrongly claimed bridgeAsync
    # did not). Direct-CLI callers (no flag) emit the numerator here so they
    # stay observed exactly once. The denominator (bridge-actions, below) is
    # ALWAYS written — a TS cold-spawn IS a spawn, so it counts either way.
    # W1-S1 D8: DOS_BRIDGE_TEST_SINK=1 diverts test-fixture telemetry to
    # *-test.jsonl siblings so fixtures never pollute production metrics.
    _test_sink = os.environ.get("DOS_BRIDGE_TEST_SINK") == "1"
    if os.environ.get("DOS_BRIDGE_EMIT") != "ts":
        _append_jsonl_safe(
            "MEMORY_EVENTS_LOG_PATH",
            ("MEMORY", "STATE",
             "memory-events-test.jsonl" if _test_sink else "memory-events.jsonl"),
            {
                "ts": ts,
                # v2 (W1-S1): both writers classify via the shared truth table
                # from this version on; metrics that must not mix pre-fix
                # misclassified TS rows filter on v>=2.
                "v": 2,
                "session_id": session_id,
                "op_kind": action,
                "via": "bridgeCli",  # Python CLI (vs TS-side bridgeSync/Async/Fire)
                "args_summary": arg_str,
                # W1-S1 ISC-29: detail suffix lets the radiator separate
                # by-design rejections (missing_arg, predicate-gate) from
                # genuine failures without a schema change — result_summary is
                # the free-text field with no downstream contract.
                "result_summary": (f"{result_status}:{result_detail}"
                                   if result_detail else result_status),
                "duration_ms": latency_int,
                "status": result_status,
                # G1: served-by attribution (servedByOf in dos-memory-status.ts
                # returns 'relay' when true) — mirrors the TS recordMemoryEvent
                # relay field for daemon-relayed CLI calls.
                "relay": relay,
            },
        )

    # ─── bridge-actions.jsonl SECOND (denominator; safe-side ordering) ──────
    # G1 (dos#356 review #1): skipped on the CLI daemon-relay success path —
    # the daemon owns the denominator for actions it serves (MP-052).
    if not denominator:
        return
    record = {
        "ts": ts,
        "action": action,
        "args_hash": _hash_args(args),
        "latency_ms": latency_int,
        "result_status": result_status,
        "session_id": session_id,
    }
    if caller:
        record["caller_hook"] = caller
    _append_jsonl_safe(
        "BRIDGE_ACTIONS_LOG_PATH",
        ("MEMORY", "STATE",
         "bridge-actions-test.jsonl" if _test_sink else "bridge-actions.jsonl"),
        record,
    )


# --- CLI Entry Point ---


def _print_help():
    """Print action list and exit."""
    print(f"mempalace_bridge.py v{__version__} — DOS hook interface to MemPalace\n")
    print("Usage: python3 bridge.py <action> [json_args]")
    print("       python3 bridge.py --version\n")
    print("WHEN NOT TO USE (R9 contract):")
    print("  - Finding prior sessions/PRDs/git history by topic -> /context-search, not the bridge")
    print("  - Exact-subject fact lookup -> kg_query; conceptual/thematic recall -> search")
    print("    (kg_query returns nothing for themes; search returns nothing for bare KG subjects)")
    print("Sequence: diagnose with `status` BEFORE any repair/rebuild action; writes go through")
    print("  add_drawer/upsert_drawer only (the bridge is the single write path).")
    print("Field gotcha: a wrong `wing` filters SILENTLY — zero results looks identical to no")
    print("  data; verify wing spelling before concluding memory is empty.\n")
    print("Actions:")
    groups = {
        "Palace": ["init", "status", "search", "suggest_parent"],
        "Drawers": ["add_drawer", "upsert_drawer", "update_drawer", "delete_drawer", "list_drawers", "audit_drawer"],
        "Reflections": ["append_reflection"],
        "Knowledge Graph": ["add_kg_fact", "invalidate", "update_entity", "merge_entities", "kg_query", "kg_query_predicate", "kg_timeline"],
        "Mining": ["mine_file", "mine_dir", "mine_convos"],
        "Graph Navigation": ["traverse", "find_tunnels", "create_tunnel"],
        "Enhanced": ["wake_up", "classify", "diary"],
        "v3.3.0": ["fact_check", "build_closets", "rebuild_closets", "backfill_closets", "reconcile"],
        "Stats/Checkpoint": ["kg_stats", "graph_stats", "last_checkpoint", "memories_filed_away"],
        "Batch": ["batch"],
    }
    for group, actions in groups.items():
        print(f"\n  {group}:")
        for a in actions:
            if a in ACTIONS:
                doc = (ACTIONS[a].__doc__ or "").strip().split("\n")[0]
                print(f"    {a:24} — {doc}")


# MP-008 / MP-010: canonical three-bucket result classifier shared with the
# TS writer (Hooks/lib/mempalace.ts summarizeBridgeResult — the verbatim port
# landed in W1-S1, 2026-06-10). The write-success-rate metric counts only
# result_status=='ok' as a persisted mutation, so dropped/no-op writes
# (duplicate / skip / not_found / partial) MUST NOT score as 'ok' — they map to
# a distinct 'noop' bucket, and genuine errors map to 'error'. W1-S1 addition
# on BOTH sides: `error_type` presence denies 'ok' even when `status`/`isError`
# are absent (deny-by-shape guard). Shared fixture pins both classifiers:
# hooks/lib/fixtures/bridge-classifier-truth-table.json. Module-level (not
# nested in main) so the fixture test can import it.
# MP-PY-01 (2026-07-03): 'skipped' (thin-content min-semantic-content reject,
# _bridge_drawers.py) and 'schema-violation' (block-mode reflection reject,
# _bridge_palace.py) persist NOTHING — they are no-ops, not 'ok' mutations.
def _classify_result_status(r) -> str:
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


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help", "help"):
        _print_help()
        sys.exit(0)

    if sys.argv[1] in ("-v", "--version", "version"):
        print(json.dumps({"version": __version__, "actions": sorted(ACTIONS.keys())}))
        sys.exit(0)

    action = sys.argv[1]

    if action not in ACTIONS:
        # MEMP-001-A: every spawn must emit exactly one bridge event
        # (RFC-0035 §6 invariant) — pre-dispatch exits included.
        _record_bridge_action(action, {}, 0, "error", result_detail="unknown-action")
        # M7: MCP-style Tool Execution Error (model-visible, not call-killing)
        print(json.dumps({
            "isError": True,
            "content": [{
                "type": "text",
                "text": f"Invalid input: unknown action '{action}'. "
                        f"Available actions: {', '.join(sorted(ACTIONS.keys()))}.",
            }],
            "status": "error",
            "error_type": "unknown_action",
            "message": f"Unknown action: {action}",
            "available": sorted(ACTIONS.keys()),
        }))
        sys.exit(0)

    # Subcommands that accept a positional string as a shorthand for their primary
    # text field (M16). A raw string like `search "DOSUpgrade"` is promoted to
    # {"query": "DOSUpgrade"} instead of being rejected as invalid JSON.
    POSITIONAL_FIELD = {
        "search": "query",
        "suggest_parent": "task",
        "kg_query": "entity",
        "kg_query_predicate": "predicate",
        "kg_timeline": "entity",
        "classify": "text",
        "fact_check": "text",
        "traverse": "start_room",
        "mine_file": "filepath",
        "mine_dir": "dir",
        "mine_convos": "dir",
        "build_closets": "source_file",
    }

    def _looks_like_json(s: str) -> bool:
        s = s.lstrip()
        return s.startswith("{") or s.startswith("[")

    args: object = {}
    if len(sys.argv) > 2:
        raw = sys.argv[2]
        # Fast path: if it looks like JSON, parse it (preserves existing behavior).
        if _looks_like_json(raw):
            try:
                args = json.loads(raw)
            except json.JSONDecodeError as e:
                # M7: Return MCP-style Tool Execution Error (model-visible, not call-killing)
                # so the model can read the diagnostic text and self-correct.
                print(json.dumps({
                    "isError": True,
                    "content": [{
                        "type": "text",
                        "text": f"Invalid input: JSON args could not be parsed ({e}). "
                                f"Pass a JSON object like '{{\"query\": \"...\"}}' or, for "
                                f"subcommands like search/kg_query/classify, a plain "
                                f"positional string.",
                    }],
                    # Legacy fields retained so existing hook callers that check `status`
                    # continue to see an error.
                    "status": "error",
                    "error_type": "invalid_json",
                    "message": f"Invalid JSON args: {e}",
                }))
                sys.exit(0)
        elif action in POSITIONAL_FIELD:
            # M16: Accept positional string shorthand. Join any remaining argv so
            # unquoted multi-word inputs (`search foo bar baz`) still work.
            positional = " ".join(sys.argv[2:]).strip()
            args = {POSITIONAL_FIELD[action]: positional}
        else:
            # M7: Non-JSON, non-positional-supported action — return MCP-style error.
            print(json.dumps({
                "isError": True,
                "content": [{
                    "type": "text",
                    "text": f"Invalid input: action '{action}' requires JSON args "
                            f"(e.g. '{{\"key\": \"value\"}}'), but received a plain string. "
                            f"Positional-string shorthand is only supported for: "
                            f"{', '.join(sorted(POSITIONAL_FIELD.keys()))}.",
                }],
                "status": "error",
                "error_type": "invalid_json",
                "message": f"Action '{action}' does not accept positional string args",
            }))
            sys.exit(0)

    # ─── Q1 PREDICATE GATE (pre-dispatch) ─────────────────────────────────
    # Council Q1 verdict: validate write-side predicates against PREDICATES.md
    # at the bridge entry-point so direct CLI / daemon / typed-client callers
    # cannot bypass the gate that the TS shim already enforces. Override env:
    #   DOS_PREDICATE_GATE=warn  → log to stderr, allow through
    #   DOS_PREDICATE_GATE=off   → disable entirely (emergency)
    _gate_rejection = enforce_predicate_gate(action, args)
    if _gate_rejection is not None:
        _record_bridge_action(action, args, 0, "error", result_detail="predicate-gate")
        print(json.dumps(_gate_rejection))
        sys.exit(0)

    # ─── L AUDIT LOG (post-dispatch on every code path) ──────────────────
    _t_start = _time.monotonic()
    _latency_ms = lambda: (_time.monotonic() - _t_start) * 1000.0  # noqa: E731

    # Classifier lifted to module level in W1-S1 so the shared truth-table
    # fixture test can import it — see _classify_result_status above main().

    # ─── G1 DAEMON-FIRST RELAY (dos#356) ──────────────────────────────────
    # When the RFC-0075 daemon socket is live, route through the warm daemon
    # instead of opening a second ChromaDB handle in this process — the
    # concurrent-open is the deadlock class that wedged the daemon (Sage
    # Fix #1 shipped this policy TS-side 2026-06-30; this is the CLI mirror).
    # On a relay miss with the socket present, READS fail fast with a
    # degraded envelope; WRITES fall through to local dispatch below.
    # Escape hatches + full policy: _bridge_relay.py module docstring.
    _relay = run_relay_first(action, args, known_action=action in ACTIONS)
    if _relay is not None:
        _payload, _served = _relay
        if _served == "daemon-relay":
            # Review #1 (dos#369): numerator ONLY — the daemon appends the sole
            # bridge-actions denominator row for every action it serves
            # (MP-052); a second row here would break the one-line-per-action
            # invocation-log contract and skew served-by/write-success metrics.
            _record_bridge_action(action, args, _latency_ms(),
                                  _classify_result_status(_payload),
                                  result_detail="daemon-relay",
                                  relay=True, denominator=False)
        else:  # daemon-relay-miss → read suppressed (concurrency-safety).
            # The daemon never served this action, so this spawn IS the sole
            # observer — full record (numerator + denominator).
            _record_bridge_action(action, args, _latency_ms(), "degraded",
                                  result_detail="coldspawn-suppressed")
        print(json.dumps(_payload, indent=2))
        sys.exit(0)

    try:
        result = ACTIONS[action](args)
        # In-band error/no-op statuses are recorded distinctly for the audit +
        # health log even though the subprocess exit code is 0.
        _result_status = _classify_result_status(result)
        _result_detail = (str(result.get("error_type"))
                          if _result_status == "error" and isinstance(result, dict)
                          and result.get("error_type") else None)
        _record_bridge_action(action, args, _latency_ms(), _result_status,
                              result_detail=_result_detail)
        print(json.dumps(result, indent=2))
        sys.exit(0)
    except KeyError as e:
        _record_bridge_action(action, args, _latency_ms(), "error",
                              result_detail="missing_arg")
        # M7: Missing-arg is an input validation error — return MCP-style so the
        # model can read the diagnostic and self-correct with the right key.
        print(json.dumps({
            "isError": True,
            "content": [{
                "type": "text",
                "text": f"Invalid input: action '{action}' is missing required argument {e}.",
            }],
            "status": "error",
            "error_type": "missing_arg",
            "message": f"Missing required argument: {e}",
            "action": action,
        }))
        sys.exit(0)
    except Exception as e:
        _record_bridge_action(action, args, _latency_ms(), "error")
        message = str(e)
        payload = {
            "status": "error",
            "error_type": "action_failed",
            "message": message,
            "action": action,
        }
        # Surface the runbook when a missing-runtime ImportError surfaces
        # (chromadb or mempalace). Mise python rebuilds wipe site-packages,
        # so this triggers any time the active interpreter has been re-laid-down.
        if isinstance(e, ModuleNotFoundError) or "No module named" in message:
            if "chromadb" in message or "mempalace" in message:
                payload["recovery"] = (
                    "Run ~/Durante/Tools/install-mempalace.sh to reinstall the "
                    "mempalace fork + chromadb into the active python3."
                )
        print(json.dumps(payload))
        sys.exit(0)


if __name__ == "__main__":
    main()
