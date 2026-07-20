#!/usr/bin/env python3
"""
MemPalace Bridge — drawers module (split from bridge.py per RFC-0035 §MW3-F).

Drawer write/read operations and content-mining. Imports infrastructure
(palace path, ChromaDB collection cache, embedding fallback, wing index) from
the sibling _bridge_palace module.

Public actions exported by this module:
  - add_drawer, upsert_drawer, update_drawer, delete_drawer
  - search (hybrid BM25+vector + Layer3 raw vector)
  - list_drawers (paginated enumeration with preview trimming, V11.14 item 5)
  - mine_file, mine_dir, mine_convos

Helpers (private to this module):
  - _get_dup_threshold  — dup-detection threshold resolver
  - _layer3_chromadb_search  — raw ChromaDB vector path
  - _smart_chunk  — frontmatter/code-fence-aware chunker

V11.13 split: 2026-05-08. Pure refactor — zero behavior change.
"""

import os
import re
import math
import uuid
import fnmatch
import hashlib
import fcntl
import time
import contextlib
from datetime import datetime, timezone

# Sibling-module import. The facade (bridge.py / mempalace_bridge.py) prepends
# the Tools/ directory to sys.path before dispatch, and individual entries (e.g.
# the test harness) do the same via `sys.path.insert(0, os.path.dirname(__file__))`.
from _bridge_palace import (
    get_palace_path,
    get_palace_collection,
    _collection_query,
    _collection_add_or_upsert,
    _wing_index_upsert,
    _get_wing_index_path,
)
import sqlite3


# ── Write-path quality gates (drawer-quality audit 2026-06) ────────────────
# W1 mine-excludes, MEMORY/WORK PRD section-gate, min-semantic-content gate,
# write-time content-hash dedup, and NS-3 search result dedup. Surgical and
# backward-compatible: callers/paths not matching a gate behave exactly as before.

# Paths matching any of these globs are NEVER mined (W1 pollution guard). A mix of
# path-fragment globs ('Releases/v0.0.*'), directory components ('node_modules'),
# and basename globs ('transcript*.jsonl'). Applied in mine_file AND mine_dir.
_DEFAULT_MINE_EXCLUDES = (
    "Releases/v0.0.*",
    ".claude/worktrees/agent-*",
    "transcript*.jsonl",
    "agent-tasks/*.jsonl",
    "node_modules",
    ".claude/projects/*",
)

# Minimum chars of real (non-header, non-provenance) text a drawer must carry to
# be worth storing; below this the body is a boilerplate stub / header-only
# fragment and is rejected at write. Tunable.
_MIN_SEMANTIC_CONTENT_CHARS = 120

# Section headers whose bodies carry durable PRD knowledge — the ONLY sections
# mined from a MEMORY/WORK PRD (section-gate). Everything else (ISC checklists,
# frontmatter, verification/tool-output) is dropped.
_PRD_DURABLE_HEADER_RE = re.compile(
    r"\b(decisions?|lessons?|learned|learnings?|learn|rationales?)\b",
    re.IGNORECASE,
)

# Lines that are pure provenance / hook telemetry, not semantic memory. Excluded
# from the semantic-content count so boilerplate stubs ('Hook: SessionEnd',
# 'source: digest-fallback ...', 'Timestamp: ...') fall under the floor.
_PROVENANCE_LINE_RE = re.compile(
    r"^\s*(?:[-*+]\s*)?(?:#{1,6}\s*)?"
    r"(timestamp|session|session[\s_-]?id|sid|agent|transcript|hook|source|"
    r"added[\s_-]?by|wing|room|saved|resume\s+hint|generated(?:\s+by)?|date)"
    r"\s*[:=]",
    re.IGNORECASE,
)


def _is_mine_excluded(path: str, excludes=_DEFAULT_MINE_EXCLUDES) -> bool:
    """True if `path` matches any W1 mine-exclude glob.

    Each glob is tested three ways against the POSIX-normalized path so it can
    target a path fragment, a directory component, or a basename:
      1. basename glob                 — 'transcript*.jsonl'
      2. '*<glob>' / '*<glob>/*'       — 'Releases/v0.0.*', '.claude/projects/*'
      3. exact path-segment equality   — 'node_modules'
    """
    if not path:
        return False
    norm = str(path).replace(os.sep, "/")
    base = norm.rsplit("/", 1)[-1]
    segments = norm.split("/")
    for pat in excludes:
        if fnmatch.fnmatchcase(base, pat):
            return True
        if fnmatch.fnmatchcase(norm, "*" + pat) or fnmatch.fnmatchcase(norm, "*" + pat + "/*"):
            return True
        if "/" not in pat and "*" not in pat and pat in segments:
            return True
    return False


def _is_work_prd(filepath: str) -> bool:
    """True for a MEMORY/WORK markdown PRD (the section-gate target set)."""
    norm = str(filepath).replace(os.sep, "/")
    return "MEMORY/WORK/" in norm and norm.endswith(".md")


def _strip_frontmatter(content: str) -> str:
    """Drop a leading '--- ... ---' YAML frontmatter block, if present."""
    if content.startswith("---\n"):
        end = content.find("\n---\n", 4)
        if end != -1:
            return content[end + 5:]
    return content


def _extract_prd_sections(content: str) -> str:
    """Return ONLY the durable sections of a MEMORY/WORK PRD body.

    Keeps headed sections whose title matches Decisions/Lessons/Rationale/LEARN
    (and their bodies, including nested non-durable subsections), drops the
    frontmatter and every other section (ISC acceptance checklists,
    verification/tool-output dumps, intro prose). Returns '' when the PRD has no
    durable section (the caller then skips the file).
    """
    body = _strip_frontmatter(content)
    kept: list[str] = []
    keep = False
    cur_level = 0
    for line in body.splitlines():
        m = re.match(r"^(#{1,6})\s+(.*\S)\s*$", line)
        if m:
            level = len(m.group(1))
            title = m.group(2)
            if _PRD_DURABLE_HEADER_RE.search(title):
                keep = True
                cur_level = level
                kept.append(line)
                continue
            # A non-durable header at or above the durable section's level closes
            # it; a deeper one is a subsection and stays inside the kept section.
            if keep and level <= cur_level:
                keep = False
            if keep:
                kept.append(line)
            continue
        if keep:
            kept.append(line)
    return "\n".join(kept).strip()


def _semantic_content_len(content: str) -> int:
    """Chars of 'real' text in a drawer body — excludes markdown headers, code
    fences, horizontal rules, and provenance/telemetry lines. Drives the
    min-semantic-content gate (a header/provenance-only stub scores ~0)."""
    if not content:
        return 0
    real = []
    for raw in content.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("#"):
            continue
        if line.startswith("```"):
            continue
        if set(line) <= {"-", "=", "*", "_", " "}:
            continue
        if _PROVENANCE_LINE_RE.match(line):
            continue
        real.append(line)
    return len("".join(real))


def _normalized_content_hash(content: str) -> str:
    """sha256 of whitespace-normalized content for exact write-time dedup and
    search-result dedup. Collapses whitespace runs and trims so trivially
    different re-writes (trailing newline, indent drift) hash equal."""
    norm = re.sub(r"\s+", " ", content or "").strip()
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()


def _dedup_search_by_content(results):
    """Collapse repeated hits of the SAME drawer in a search result list (NS-3).

    MemPalace closet-boost can surface one drawer once per closet pointer that
    references it (matched_via=drawer+closet), so a single drawer crowds top-k as
    if it were several distinct memories. Keep the FIRST (highest-ranked)
    occurrence of each drawer and drop the rest — deduped by drawer id, falling
    back to normalized-content hash when an id is absent. Order-preserving;
    non-dict / unkeyable entries pass through untouched.
    """
    if not isinstance(results, list):
        return results
    seen = set()
    deduped = []
    for r in results:
        if not isinstance(r, dict):
            deduped.append(r)
            continue
        key = r.get("id") or r.get("drawer_id")
        if not key:
            body = r.get("content") or r.get("text") or ""
            key = ("sha:" + _normalized_content_hash(body)) if body else None
        if key is None:
            deduped.append(r)
            continue
        if key in seen:
            continue
        seen.add(key)
        deduped.append(r)
    return deduped


def _get_dup_threshold(args: dict) -> float:
    """Resolve duplicate detection threshold.

    Priority: args.dup_threshold > MEMPALACE_DUP_THRESHOLD env var > 0.1 default.
    """
    if "dup_threshold" in args:
        return float(args["dup_threshold"])
    env = os.environ.get("MEMPALACE_DUP_THRESHOLD")
    if env:
        try:
            return float(env)
        except ValueError:
            pass
    return 0.1


def _palace_lock_dir() -> str:
    """The palace directory holding chroma.sqlite3 + the HNSW index — where the
    cross-process write lock lives, co-located with what it protects."""
    return os.path.join(get_palace_path(), "palace")


@contextlib.contextmanager
def palace_write_lock(palace_path, timeout: float = 10.0):
    """Cross-process exclusive lock serializing ChromaDB/HNSW writes across ALL
    bridge paths (warm-daemon thread + cold-spawn process). The daemon's
    threading.Lock covers intra-process only; this closes the inter-process gap
    that races the HNSW index into divergence (FIX-corruption-stop.md 2026-06-29).
    Fully resilient: any lock failure (missing dir, fs without flock, wedged
    holder past the bounded timeout) proceeds UNLOCKED with a stderr warning so a
    write is never blocked and the session never hangs (no same-boot-wedge)."""
    lock_path = os.path.join(palace_path, ".palace-write.lock")
    fd = None
    locked = False
    try:
        try:
            fd = os.open(lock_path, os.O_CREAT | os.O_RDWR, 0o600)
            deadline = time.monotonic() + timeout
            while True:
                try:
                    fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    locked = True
                    break
                except BlockingIOError:
                    if time.monotonic() >= deadline:
                        import sys as _sys
                        _sys.stderr.write("[mempalace-bridge] palace_write_lock timeout "
                                          "- proceeding UNLOCKED (race risk surfaced, not hidden)\n")
                        break
                    time.sleep(0.05)
        except Exception as _e:
            import sys as _sys
            _sys.stderr.write(f"[mempalace-bridge] palace_write_lock unavailable ({_e}) "
                              f"- proceeding UNLOCKED\n")
        yield locked
    finally:
        if fd is not None:
            if locked:
                with contextlib.suppress(Exception):
                    fcntl.flock(fd, fcntl.LOCK_UN)
            with contextlib.suppress(Exception):
                os.close(fd)


# Cap-10 (cross-conversation-linking): match a "session-{id}" stamp anywhere in
# a source_file path so a drawer minted in one conversation can be filtered back
# out by its origin session in any later conversation.
_SESSION_FROM_SOURCE = re.compile(r"session-([A-Za-z0-9][A-Za-z0-9_-]*)")


def _resolve_session_id(args: dict) -> str | None:
    """Resolve the originating conversation/session id for a drawer write.

    Cap-10 (cross-conversation-linking). Precedence — additive + back-compatible,
    returns None (field omitted, ChromaDB metadata stays schemaless) when nothing
    resolves:
      1. explicit args["session_id"]
      2. a "session-{id}" stamp embedded in args["source_file"]
      3. DOS_SESSION_ID / CLAUDE_SESSION_ID env (the same pair the audit log reads)
    """
    explicit = args.get("session_id")
    if isinstance(explicit, str) and explicit.strip():
        return explicit.strip()
    source_file = args.get("source_file") or ""
    if isinstance(source_file, str):
        m = _SESSION_FROM_SOURCE.search(source_file)
        if m:
            return m.group(1)
    env_sid = os.environ.get("DOS_SESSION_ID") or os.environ.get("CLAUDE_SESSION_ID")
    if env_sid and env_sid.strip():
        return env_sid.strip()
    return None


def add_drawer(args: dict, _collection=None) -> dict:
    """Store verbatim content into a palace wing/room.

    v3.0.0: Enriches drawers with hall detection and entity metadata
    from MemPalace 3.3.0's miner module.

    Optional args:
        drawer_id    — explicit ID (for upserts). If omitted, a new ID is generated.
        dup_threshold — similarity threshold (0.0-2.0). Lower = stricter. Default 0.1.
    """
    wing = args["wing"]
    room = args["room"]
    content = args["content"]
    source_file = args.get("source_file", "")
    added_by = args.get("added_by", "dos-hook")
    dup_threshold = _get_dup_threshold(args)
    # W6 (NS-9): dup_scope controls whether the dup-check is scoped to the
    # destination wing/room ('bucket', default — unchanged behavior) or the WHOLE
    # palace ('global'). reconcile passes 'global' so an orphan whose content
    # already lives in ANY wing is skipped instead of re-filed into a second wing
    # (the cross-wing duplication source). Keeps reconcile idempotent.
    dup_scope = args.get("dup_scope", "bucket")

    # Min-semantic-content gate (write-path quality): reject boilerplate stubs and
    # header/provenance-only drawers below the real-text floor. Skipped for an
    # explicit drawer_id (deliberate upsert of a known drawer) and when the caller
    # opts out with allow_thin=true. Drawer-quality audit 2026-06 (tiny-under500).
    if "drawer_id" not in args and not args.get("allow_thin"):
        _sem_len = _semantic_content_len(content)
        if _sem_len < _MIN_SEMANTIC_CONTENT_CHARS:
            return {
                "status": "skipped",
                "reason": "min-semantic-content",
                "semantic_len": _sem_len,
                "wing": wing,
                "room": room,
            }

    collection = _collection if _collection is not None else get_palace_collection()

    drawer_id = args.get("drawer_id") or f"dos-{uuid.uuid4().hex[:12]}"
    content_sha256 = _normalized_content_hash(content)
    metadata = {
        "wing": wing,
        "room": room,
        "source_file": source_file,
        "added_by": added_by,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "content_sha256": content_sha256,
        # Provenance: how many times this exact fact has been observed. A fresh
        # drawer starts at 1; a byte-identical re-add increments the EXISTING
        # drawer's counter (see the content-hash dedup path below) instead of
        # discarding the repeat signal. Lets recall distinguish a repeated,
        # well-corroborated fact from a one-off mention (cap 2 / observed-count).
        # Optional + schemaless (ChromaDB metadata) — zero migration, default 1.
        "observed_count": 1,
    }

    # Optional 'type' field — classify-derived semantic label
    # (decision/preference/milestone/problem/emotional).
    # Added 2026-05-12 per PRD 20260512_mempalace-findings-delivery ISC-30 follow-up:
    # MemPalaceClassifyOnAddDrawer hook now writes `type` directly instead of
    # repurposing the `room` field. Avoids room-as-bucket vs room-as-type conflation.
    if "type" in args and args["type"]:
        metadata["type"] = args["type"]

    # Cap 3 (confidence-score): optional caller-supplied calibration in [0,1].
    # ChromaDB metadata is schemaless, so this needs NO migration. The
    # MemoryHarvest daemon forwards each extraction's confidence so every
    # surfaced drawer can carry a calibration signal (repeated/recent vs
    # single/old). Clamped defensively; a non-numeric value is ignored so
    # legacy callers see no behavior change. Mirrors KG triples.confidence,
    # already persisted + surfaced (_bridge_kg.py).
    if "confidence" in args and args["confidence"] is not None:
        try:
            metadata["confidence"] = max(0.0, min(1.0, float(args["confidence"])))
        except (TypeError, ValueError):
            pass

    # Temporal-validity-staleness capability (additive, schemaless — no migration):
    # an optional ISO-8601 `stale_after` marks when this drawer's content should be
    # treated as potentially outdated. Read-side `search` / `_layer3_chromadb_search`
    # flag retrieved rows past this cutoff with `stale:true` + `age_days` via
    # `_annotate_staleness`. Absent or unparseable -> field never written, so legacy
    # callers and drawers see no behavior change. Stored normalized to UTC ISO so it
    # compares lexically with the same shape as the `timestamp` field above. The KG
    # already carries valid_from/valid_to (_bridge_palace.py:777-784) for facts; this
    # is the drawer-side complement.
    if "stale_after" in args and args["stale_after"]:
        try:
            _sa_dt = datetime.fromisoformat(str(args["stale_after"]).replace("Z", "+00:00"))
            if _sa_dt.tzinfo is None:
                _sa_dt = _sa_dt.replace(tzinfo=timezone.utc)
            metadata["stale_after"] = _sa_dt.astimezone(timezone.utc).isoformat()
        except (ValueError, TypeError):
            # Date-like best-effort: store verbatim only if it carries separators
            # (so a bare garbage token never poisons the lexical compare). Pure
            # garbage is dropped — same defensive posture as _parse_since.
            _sa_raw = str(args["stale_after"])
            if "-" in _sa_raw or ":" in _sa_raw:
                metadata["stale_after"] = _sa_raw

    # Cap 7 (privacy-sensitivity-tagging): optional sensitivity classification
    # (public|personal|private). ChromaDB metadata is schemaless — no migration.
    # Surfaced on search rows and consulted by search()'s `max_sensitivity`
    # post-filter so a `private` drawer can be WITHHELD from a public-facing
    # context. Unknown / absent values leave the field unset; legacy drawers with
    # no sensitivity default to fully visible (see _result_sensitivity).
    if args.get("sensitivity") in _SENSITIVITY_ORDER:
        metadata["sensitivity"] = args["sensitivity"]

    # Cap-10 (cross-conversation-linking): stamp the originating session id so a
    # fact written in conversation A is retrievable in conversation B carrying its
    # origin (read-side filter via search/list_drawers `session_id`). Optional +
    # schemaless — omitted when nothing resolves, so legacy callers are unaffected.
    _session_id = _resolve_session_id(args)
    if _session_id:
        metadata["session_id"] = _session_id

    # Cap 6 (corrections-supersession): optional supersedes_drawer_id stamps lineage
    # on the new drawer. The predecessor is marked superseded inside the write-lock
    # block below, AFTER the primary write succeeds. Schemaless + additive — no
    # migration; absent on legacy drawers so the default search filter is a no-op.
    _supersedes_id = args.get("supersedes_drawer_id")
    if _supersedes_id:
        metadata["supersedes_drawer_id"] = str(_supersedes_id)

    # RFC-0005 §14.13 / Slice F (local variant): parse trust_type from the
    # added_by prefix convention (mechanical: / human: / llm_judge:) so
    # downstream consumers can filter `where={"trust_type": "human"}` without
    # re-parsing agent strings. Unrecognized prefixes leave trust_type unset —
    # legacy callers see no behavior change.
    if isinstance(added_by, str):
        for prefix in ("mechanical", "human", "llm_judge"):
            head = prefix + ":"
            if added_by.startswith(head) and len(added_by) > len(head):
                metadata["trust_type"] = prefix
                break

    # v3.3.0 enrichment: hall detection + entity metadata
    try:
        from mempalace.miner import detect_hall, _extract_entities_for_metadata
        metadata["hall"] = detect_hall(content)
        entities = _extract_entities_for_metadata(content)
        if entities:
            metadata["entities"] = entities
    except ImportError:
        pass  # Graceful fallback if miner module unavailable

    # Check for duplicates — skip if drawer_id was explicitly provided (caller wants upsert)
    if "drawer_id" not in args:
        # Exact-content dedup FIRST (precise complement to the fuzzy vector check
        # below): a byte-identical re-write of content already in the destination
        # bucket returns the existing drawer instead of minting a verbatim copy.
        # Keyed on the normalized-content sha256 stamped into metadata at write,
        # scoped to the destination wing/room (mirrors the vector-check scoping,
        # MP-043). Reads the sqlite metadata segment, so it works even when the
        # HNSW vector index is stale. Kills the verbatim-triplicate problem.
        try:
            _hash_clauses = []
            if dup_scope != "global":  # W6: global skips wing/room scoping
                if wing:
                    _hash_clauses.append({"wing": wing})
                if room:
                    _hash_clauses.append({"room": room})
            _sha_clause = {"content_sha256": content_sha256}
            _hash_where = {"$and": _hash_clauses + [_sha_clause]} if _hash_clauses else _sha_clause
            _hit = collection.get(where=_hash_where, limit=1, include=["metadatas"])
            _hit_ids = _hit.get("ids") or []
            if _hit_ids:
                # cap 2 (observed-count): a byte-identical re-add is fresh evidence
                # that the same fact was observed again. Increment the EXISTING
                # drawer's observed_count instead of throwing the repeat away.
                # Reads the metadata we already fetched; back-compatible default 1
                # for drawers written before this field existed. Best-effort — a
                # failed update never blocks the (idempotent) duplicate return.
                _existing_md = (_hit.get("metadatas") or [{}])[0] or {}
                try:
                    _prev_count = int(_existing_md.get("observed_count", 1) or 1)
                except (TypeError, ValueError):
                    _prev_count = 1
                _new_count = _prev_count + 1
                try:
                    _updated_md = dict(_existing_md)
                    _updated_md["observed_count"] = _new_count
                    # MEMP-004-B: this duplicate-path update is a Chroma write
                    # like any other — take the palace_write_lock rather than
                    # running ~60 lines ahead of the locked primary write path.
                    with palace_write_lock(_palace_lock_dir()):
                        collection.update(ids=[_hit_ids[0]], metadatas=[_updated_md])
                except Exception as exc:
                    import sys as _sys
                    _sys.stderr.write(
                        f"[mempalace-bridge] add_drawer observed_count increment failed (proceeding): {exc}\n"
                    )
                    _new_count = _prev_count
                return {
                    "status": "duplicate",
                    "drawer_id": _hit_ids[0],
                    "dedup": "content-hash",
                    "observed_count": _new_count,
                }
        except Exception as exc:
            import sys as _sys
            _sys.stderr.write(
                f"[mempalace-bridge] add_drawer content-hash dedup query failed (proceeding): {exc}\n"
            )
        try:
            # Scope the dup check to the DESTINATION bucket. A globally-nearest
            # neighbor in an unrelated wing/room is NOT a duplicate of content
            # targeting this wing/room — without the filter, cross-wing content
            # was silently dropped and the returned drawer_id pointed at the
            # wrong wing. room is always present (required arg) so both clauses
            # apply; fall back gracefully if either is absent.
            dup_where: dict | None
            if dup_scope == "global":
                dup_where = None  # W6: whole-palace neighbor search (cross-wing dedup)
            elif wing and room:
                dup_where = {"$and": [{"wing": wing}, {"room": room}]}
            elif wing:
                dup_where = {"wing": wing}
            else:
                dup_where = None
            query_kwargs = {"query_texts": [content], "n_results": 1}
            if dup_where is not None:
                query_kwargs["where"] = dup_where
            existing = _collection_query(collection, **query_kwargs)
            if (
                existing["distances"]
                and existing["distances"][0]
                and existing["distances"][0][0] < dup_threshold
            ):
                return {"status": "duplicate", "drawer_id": existing["ids"][0][0]}
        except Exception as exc:
            # MP-043: an empty collection / no-match is the benign expected case,
            # but a dup-query FAILURE (e.g. transient HNSW corruption) is
            # indistinguishable from it if swallowed silently — and then we fall
            # through and write, treating a failed query as 'no duplicate'.
            # Surface the failure to stderr so it is observable, but still never
            # block the primary write (the dup check is advisory).
            import sys as _sys
            _sys.stderr.write(
                f"[mempalace-bridge] add_drawer dup-check query failed (proceeding to write): {exc}\n"
            )

    # W6-lock: serialize the HNSW writes (drawer collection + closets) across
    # ALL bridge paths so concurrent writers cannot race the index into
    # divergence (FIX-corruption-stop.md). Proceed-unlocked on timeout.
    with palace_write_lock(_palace_lock_dir()):
        # Use upsert semantics when drawer_id was provided, else add
        if "drawer_id" in args:
            _collection_add_or_upsert(collection, documents=[content], metadatas=[metadata], ids=[drawer_id], upsert=True)
        else:
            _collection_add_or_upsert(collection, documents=[content], metadatas=[metadata], ids=[drawer_id], upsert=False)

        # Maintain the wing_index secondary index for fast status queries
        _wing_index_upsert(drawer_id, wing, room)

        # v3.3.0: generate closet pointer lines for searchability
        try:
            from mempalace.palace import (
                get_closets_collection, build_closet_lines, upsert_closet_lines,
            )
            import hashlib as _hashlib
            palace_path = os.path.join(get_palace_path(), "palace")
            closets_col = get_closets_collection(palace_path, create=True)
            lines = build_closet_lines(source_file or drawer_id, [drawer_id], content, wing, room)
            if lines:
                closet_id = f"closet_{_hashlib.sha256((source_file or drawer_id).encode()).hexdigest()[:16]}"
                upsert_closet_lines(closets_col, closet_id, lines,
                    {"wing": wing, "room": room, "source_file": source_file or drawer_id})
        except (ImportError, Exception):
            pass  # Closets are optional — never block drawer writes

        # Cap 6 (corrections-supersession): mark the predecessor superseded so the
        # search newest-wins filter can exclude it. Metadata-only update — no vector
        # rewrite. Best-effort: a failure here never blocks the primary write above.
        if _supersedes_id:
            try:
                _pred = collection.get(ids=[str(_supersedes_id)], include=["metadatas"])
                if _pred.get("ids"):
                    _pred_meta = dict((_pred.get("metadatas") or [{}])[0] or {})
                    _pred_meta["superseded"] = True
                    _pred_meta["superseded_by_drawer_id"] = drawer_id
                    collection.update(ids=[str(_supersedes_id)], metadatas=[_pred_meta])
            except Exception:
                pass  # predecessor-mark failure never blocks the primary write

    return {"status": "ok", "drawer_id": drawer_id, "wing": wing, "room": room}


def upsert_drawer(args: dict, _collection=None) -> dict:
    """Replace an existing drawer identified by (wing, room, source_file, added_by).

    Generates a deterministic ID from the identity tuple so repeated calls
    update the same drawer instead of creating new ones. Use this for
    sentinel scan outputs that should replace prior scan results.

    DO NOT USE for slug-bearing decision-archive entries (one drawer per
    LEARN-phase decision set per session). The default identity tuple
    (wing|room|""|"dos-hook") collides across sessions, so the second
    upsert silently overwrites the first session's decisions. Use
    `add_drawer` with `dup_threshold: 0.0` and the slug-bearing content
    instead — see PhaseCompleteGate.hook.ts remediation snippet.
    """
    import hashlib

    wing = args["wing"]
    room = args["room"]
    source_file = args.get("source_file", "")
    added_by = args.get("added_by", "dos-hook")

    # Deterministic ID from identity tuple
    identity = f"{wing}|{room}|{source_file}|{added_by}"
    drawer_id = f"dos-{hashlib.sha1(identity.encode()).hexdigest()[:12]}"

    # Delegate to add_drawer with explicit ID (triggers upsert path)
    return add_drawer({**args, "drawer_id": drawer_id}, _collection=_collection)


def update_drawer(args: dict, _collection=None) -> dict:
    """Update a drawer by its explicit drawer_id.

    Caller must provide drawer_id from a prior add/upsert/search result.
    """
    drawer_id = args["drawer_id"]
    wing = args.get("wing")
    room = args.get("room")

    collection = _collection if _collection is not None else get_palace_collection()

    # Preserve existing metadata AND document if not provided (Forge H-095,
    # Gen 116): `content` used to be hard-required, so a metadata-only update
    # (e.g. the classify hook's type-stamp) had to resend the body — and its
    # 4000-char truncation REPLACED the stored document for any longer drawer
    # (323 live candidates). ChromaDB upsert merges metadata but replaces
    # documents, so the fallback must come from the stored record.
    existing = collection.get(ids=[drawer_id], include=["metadatas", "documents"])
    # update_drawer is an UPDATE, not an upsert — refuse to materialize a phantom
    # drawer for an unknown id (mirrors delete_drawer's existence guard). Without
    # this, a typo'd drawer_id would silently create a fresh uncategorized drawer
    # and report action:updated. Callers wanting create-or-replace use add_drawer.
    if not existing.get("ids"):
        return {
            "status": "not_found",
            "drawer_id": drawer_id,
            "message": f"Drawer {drawer_id} not found",
        }
    existing_meta = (existing.get("metadatas") or [None])[0] or {}
    existing_doc = (existing.get("documents") or [None])[0]

    content = args.get("content")
    if content is None or content == "":
        content = existing_doc
    if content is None:
        return {
            "status": "error",
            "drawer_id": drawer_id,
            "message": "update_drawer: no content provided and no stored document to preserve",
        }

    metadata = {
        "wing": wing or existing_meta.get("wing", "uncategorized"),
        "room": room or existing_meta.get("room", "uncategorized"),
        "source_file": args.get("source_file", existing_meta.get("source_file", "")),
        "added_by": args.get("added_by", existing_meta.get("added_by", "dos-hook")),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        # Re-stamp the content hash so the write-time dedup index stays correct
        # after a body change (a stale hash would cause false dedup hits/misses).
        "content_sha256": _normalized_content_hash(content),
    }

    # Optional 'type' field — preserve existing if present; allow update via args.
    # See add_drawer for provenance. Added 2026-05-12 per PRD ISC-30 follow-up.
    incoming_type = args.get("type") or existing_meta.get("type")
    if incoming_type:
        metadata["type"] = incoming_type

    # NOTE: no explicit carry-forward of confidence / observed_count / stale_after /
    # sensitivity / session_id / superseded(+_by_drawer_id) / trust_type is needed
    # here. _collection_add_or_upsert writes via ChromaDB `upsert`, which MERGES
    # metadata — keys absent from THIS dict are retained from the stored record
    # (verified 2026-06-30 by a direct upsert probe + test_05). A minimal metadata dict
    # updates only the fields it names; all prior cap-metadata survives untouched, so
    # the classify hook's `type`-stamp does not lose provenance/calibration. (The
    # "update_drawer drops metadata" review premise assumed replace-semantics, which
    # ChromaDB upsert does not use.)

    # v3.3.0 enrichment on update
    try:
        from mempalace.miner import detect_hall, _extract_entities_for_metadata
        metadata["hall"] = detect_hall(content)
        entities = _extract_entities_for_metadata(content)
        if entities:
            metadata["entities"] = entities
    except ImportError:
        pass

    with palace_write_lock(_palace_lock_dir()):
        _collection_add_or_upsert(collection, documents=[content], metadatas=[metadata], ids=[drawer_id], upsert=True)

        # Maintain the wing_index
        _wing_index_upsert(drawer_id, metadata["wing"], metadata["room"])

    return {"status": "ok", "drawer_id": drawer_id, "action": "updated"}


def delete_drawer(args: dict, _collection=None) -> dict:
    """Delete a drawer by its explicit drawer_id (IRREVERSIBLE).

    Used by MemoryGardener ghost-resolve applier. Removes the drawer from
    ChromaDB and the secondary wing_index. The bridge invocation log
    (~/.claude/MEMORY/STATE/bridge-actions.jsonl) is the audit trail; the
    drawer body itself is not preserved post-delete.

    Required args:
        drawer_id    — explicit drawer ID to remove.

    Returns:
        {"status": "ok", "drawer_id": <id>, "action": "deleted",
         "wing": <wing>, "room": <room>}  on success
        {"status": "not_found", "drawer_id": <id>, "message": "..."}  if absent
        {"status": "error", ...}  on missing arg or ChromaDB failure
    """
    if "drawer_id" not in args:
        return {"status": "error", "error": "delete_drawer requires drawer_id"}
    drawer_id = args["drawer_id"]

    collection = _collection if _collection is not None else get_palace_collection()

    existing = collection.get(ids=[drawer_id], include=["metadatas"])
    if not existing.get("ids"):
        return {
            "status": "not_found",
            "drawer_id": drawer_id,
            "message": f"Drawer {drawer_id} not found",
        }
    existing_meta = (existing.get("metadatas") or [None])[0] or {}
    wing = existing_meta.get("wing", "uncategorized")
    room = existing_meta.get("room", "uncategorized")

    # MEMP-004-A: deletes mutate the HNSW index just like adds/updates do —
    # serialize under the same palace_write_lock so a delete racing a
    # concurrent add_drawer/update_drawer cannot diverge the index (the
    # corruption class FIX-corruption-stop.md exists to stop).
    try:
        with palace_write_lock(_palace_lock_dir()):
            collection.delete(ids=[drawer_id])
    except Exception as exc:
        return {"status": "error", "drawer_id": drawer_id, "error": str(exc)}

    # Mirror the delete in the secondary wing_index. Best-effort — wing_index
    # drift is cosmetic (it's a query helper, not source of truth) so we never
    # fail the overall operation if this side-write errors.
    try:
        conn = sqlite3.connect(_get_wing_index_path())
        try:
            conn.execute("DELETE FROM wing_index WHERE drawer_id = ?", (drawer_id,))
            conn.commit()
        finally:
            conn.close()
    except Exception:
        pass

    return {
        "status": "ok",
        "drawer_id": drawer_id,
        "action": "deleted",
        "wing": wing,
        "room": room,
    }


def _layer3_chromadb_search(query: str, limit: int, wing: str | None, room: str | None, _collection=None) -> dict:
    """RFC-0005 §14.10 Layer3 raw-vector path — direct ChromaDB query.

    Bypasses MemPalace's BM25 + closet-boost pipeline to return drawers ranked
    solely by embedding cosine distance. Used when callers want unprocessed
    vector recall (e.g., audit paths, debugging BM25 skew). Also serves as the
    fallback when `mempalace.searcher` is unimportable.
    """
    collection = _collection if _collection is not None else get_palace_collection()

    # Build where clause with $and when both wing and room are set — ChromaDB
    # rejects a bare multi-key dict without an operator.
    _where_clauses = []
    if wing:
        _where_clauses.append({"wing": wing})
    if room:
        _where_clauses.append({"room": room})

    kwargs = {"query_texts": [query], "n_results": limit}
    if len(_where_clauses) > 1:
        kwargs["where"] = {"$and": _where_clauses}
    elif _where_clauses:
        kwargs["where"] = _where_clauses[0]

    results = _collection_query(collection, **kwargs)

    entries = []
    if results["documents"] and results["documents"][0]:
        for i, doc in enumerate(results["documents"][0]):
            entry = {
                "content": doc,
                "id": results["ids"][0][i] if results["ids"] else None,
                "distance": results["distances"][0][i] if results["distances"] else None,
            }
            if results["metadatas"] and results["metadatas"][0]:
                entry["metadata"] = results["metadatas"][0][i]
                # Cap-10: surface origin session_id at the top level (mirrors the
                # hybrid path) so cross-conversation recall is uniform across paths.
                _sid = (entry["metadata"] or {}).get("session_id")
                if _sid is not None:
                    entry["session_id"] = _sid
                # GAP-A fix (layer3 path): promote stored metadata signal fields
                # to the top level so callers don't have to unpack the nested
                # metadata dict.  Back-compat: only adds fields, never overwrites.
                _md = entry["metadata"] or {}
                for _fld in ("confidence", "type", "sensitivity",
                             "observed_count", "stale_after",
                             "superseded", "supersedes_drawer_id"):
                    if _fld in _md and _fld not in entry:
                        entry[_fld] = _md[_fld]
            entries.append(entry)

    # Temporal-validity-staleness: flag rows past their `stale_after` cutoff with
    # stale:true + age_days (read-side surfacing; no-op for rows without it).
    _annotate_staleness(entries)

    return {"query": query, "results": entries, "count": len(entries), "path": "layer3"}


def _annotate_staleness(results, _now=None):
    """Flag retrieved drawers whose `stale_after` cutoff is in the past.

    Read-side surfacing for the temporal-validity-staleness capability. A drawer
    written with an optional ISO-8601 `stale_after` (see add_drawer metadata) is,
    on retrieval, annotated in place:
      - stale: bool       True when stale_after < now (UTC), else False
      - stale_after: str  echoed (normalized UTC ISO) for transparency
      - age_days: int     whole days elapsed past stale_after (only when stale)
    Rows without a parseable `stale_after` are left untouched (back-compatible).
    A row may carry `stale_after` either top-level (hybrid searcher) or nested
    under `metadata` (layer3 raw-vector path); both shapes are honored. Mutates
    and returns the same list so callers can inline it.
    """
    from datetime import datetime, timezone
    now = _now or datetime.now(timezone.utc)
    for r in results or []:
        if not isinstance(r, dict):
            continue
        meta = r.get("metadata") if isinstance(r.get("metadata"), dict) else {}
        raw = r.get("stale_after") or meta.get("stale_after")
        if not raw:
            continue
        try:
            dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except (ValueError, TypeError):
            continue
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        dt = dt.astimezone(timezone.utc)
        is_stale = dt < now
        r["stale"] = is_stale
        r["stale_after"] = dt.isoformat()
        if is_stale:
            r["age_days"] = (now - dt).days
    return results


# Cap on the wing/room-scoped candidate set fetched for client-side recency
# sort/filter. Chroma's collection.get() has no ORDER BY and no string range
# filter, so `since` / `sort=recent` must fetch candidates and order them
# in-process; this bounds memory on a very large wing. When the cap is hit the
# response carries scan_capped=true (no silent truncation).
_RECENCY_SCAN_CAP = 10000


def _parse_since(since):
    """Resolve a `since` arg to a comparable ISO-8601 UTC cutoff string.

    Accepts a relative window ('24h', '7d', '30m', '2w', '90s') or an absolute
    ISO-8601 date/timestamp. Returns None when `since` is falsy. Stored drawer
    timestamps are datetime.now(timezone.utc).isoformat() (UTC, '+00:00'), which
    compares lexically, so the cutoff is normalized to the same shape for a
    correct string `>=` comparison. An unparseable absolute value is returned
    verbatim (best-effort lexical compare).
    """
    if not since:
        return None
    import re
    from datetime import datetime, timezone, timedelta
    s = str(since).strip()
    m = re.fullmatch(r"(\d+)\s*([smhdw])", s, re.IGNORECASE)
    if m:
        unit_seconds = {"s": 1, "m": 60, "h": 3600, "d": 86400, "w": 604800}
        delta = timedelta(seconds=unit_seconds[m.group(2).lower()] * int(m.group(1)))
        return (datetime.now(timezone.utc) - delta).isoformat()
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except (ValueError, TypeError):
        # Date-like (has separators) → best-effort verbatim lexical compare.
        # Pure garbage (e.g. "5") → return None so it's IGNORED rather than
        # lexically excluding every drawer (a bare digit sorts above "2026-…").
        return s if ("-" in s or ":" in s) else None


def list_drawers(args: dict = None, _collection=None) -> dict:
    """List drawers with optional content preview trimming and recency ordering.

    V11.14 item 5 (RFC-0035 §3 item 8): a paginated drawer enumeration that
    returns trimmed previews instead of full content. Avoids overwhelming
    callers (especially status-line / hook output) when the corpus is large
    or when individual drawers are multi-kB markdown chunks.

    Args:
        wing          — optional. Filter to drawers tagged with this wing.
        room          — optional. Filter to drawers tagged with this room.
        limit         — int, max drawers to return (default 50).
        offset        — int, page offset (default 0).
        preview_chars — int, max chars of `content` to return per drawer
                        (default 200). Set to 0 to return full content.
        since         — optional. ISO-8601 timestamp/date OR relative window
                        ('24h', '7d', '30m', '2w', '90s'). Returns only drawers
                        whose metadata timestamp is >= the cutoff (drawers with
                        no timestamp are excluded). Engages the recency path.
        sort          — optional. 'recent' returns newest-first by timestamp
                        (drawers without a timestamp sort last). Engages the
                        recency path.

    Recency path (when `since` or `sort=recent` is set): chroma's collection.get()
    cannot order or range-filter server-side, so a wing/room-scoped candidate set
    (capped at _RECENCY_SCAN_CAP) is fetched and filtered/sorted in-process, then
    paged with limit/offset. Default calls (no since/sort) keep the exact prior
    chroma pagination semantics. Every drawer now also carries its `timestamp`.

    Returns:
        {
            "status": "ok",
            "drawers": [
                {"id": str, "wing": str, "room": str, "source_file": str | None,
                 "added_by": str | None, "timestamp": str | None,
                 "content": str (trimmed), "truncated": bool, "full_length": int},
                ...
            ],
            "count": int, "wing": str | None, "room": str | None,
            "limit": int, "offset": int, "preview_chars": int,
            "total_in_collection": int,
            # recency path only: "since": str | None, "sort": str | None,
            #                    "matched": int, "scanned": int, "scan_capped": bool
        }
    """
    args = args or {}
    wing = args.get("wing")
    room = args.get("room")
    # cap 1 (stable-typed-recall): optional filter on the dedicated `type`
    # metadata label (decision/preference/relationship/goal/...). Additive — a
    # caller that omits it sees the exact prior wing/room-only behavior.
    type_filter = args.get("type")
    # Cap-10 (cross-conversation-linking): optional origin-session filter so a
    # later conversation can enumerate exactly the drawers a prior session wrote.
    session_id = args.get("session_id")
    try:
        limit = int(args.get("limit", 50))
    except (TypeError, ValueError):
        limit = 50
    try:
        offset = int(args.get("offset", 0))
    except (TypeError, ValueError):
        offset = 0
    try:
        preview_chars = int(args.get("preview_chars", 200))
    except (TypeError, ValueError):
        preview_chars = 200

    since_cutoff = _parse_since(args.get("since"))
    sort = (args.get("sort") or "").lower() or None
    recency_mode = bool(since_cutoff) or sort == "recent"

    collection = _collection if _collection is not None else get_palace_collection()

    # Chroma's `where` requires a top-level $and when combining 2+ clauses.
    # type_filter (cap 1) and session_id (Cap-10) compose with wing/room.
    _clauses: list = []
    if wing:
        _clauses.append({"wing": wing})
    if room:
        _clauses.append({"room": room})
    if type_filter:
        _clauses.append({"type": type_filter})
    if session_id:
        _clauses.append({"session_id": session_id})
    where_filter: dict = {}
    if len(_clauses) >= 2:
        where_filter = {"$and": _clauses}
    elif _clauses:
        where_filter = _clauses[0]

    def _project(did, meta, doc):
        meta = meta or {}
        doc = doc if isinstance(doc, str) else ""
        full_length = len(doc)
        if preview_chars > 0 and full_length > preview_chars:
            content, truncated = doc[:preview_chars], True
        else:
            content, truncated = doc, False
        return {
            "id": did,
            "wing": meta.get("wing"),
            "room": meta.get("room"),
            # cap 1 (stable-typed-recall): surface the semantic `type` label on
            # each row so callers can see/verify typed recall (read-side half).
            "type": meta.get("type"),
            "source_file": meta.get("source_file"),
            "added_by": meta.get("added_by"),
            "timestamp": meta.get("timestamp"),
            # Cap-10: carry the origin session so cross-conversation recall can
            # attribute a drawer to the conversation that wrote it (None if unset).
            "session_id": meta.get("session_id"),
            "content": content,
            "truncated": truncated,
            "full_length": full_length,
        }

    # ── Recency path: fetch a scoped candidate set and order/filter in-process,
    # because chroma .get() has neither ORDER BY nor a string range filter. ──
    if recency_mode:
        scan_kwargs: dict = {
            "include": ["documents", "metadatas"],
            "limit": _RECENCY_SCAN_CAP,
        }
        if where_filter:
            scan_kwargs["where"] = where_filter
        try:
            page = collection.get(**scan_kwargs)
        except Exception as e:
            return {"status": "error", "message": str(e), "wing": wing, "room": room}

        ids = page.get("ids", []) or []
        docs = page.get("documents", []) or []
        metas = page.get("metadatas", []) or []
        candidates = [
            _project(did, metas[i] if i < len(metas) else None,
                     docs[i] if i < len(docs) else "")
            for i, did in enumerate(ids)
        ]
        # `since`: keep only drawers whose timestamp is >= cutoff. A drawer with
        # no timestamp cannot satisfy a lower bound, so it is excluded.
        if since_cutoff:
            candidates = [
                d for d in candidates if d["timestamp"] and d["timestamp"] >= since_cutoff
            ]
        # Newest-first; drawers missing a timestamp sort last.
        candidates.sort(key=lambda d: d["timestamp"] or "", reverse=True)
        matched = len(candidates)
        windowed = candidates[offset:offset + limit] if limit > 0 else candidates[offset:]

        try:
            total_in_collection = collection.count()
        except Exception:
            total_in_collection = -1

        return {
            "status": "ok",
            "drawers": windowed,
            "count": len(windowed),
            "matched": matched,
            "scanned": len(ids),
            "scan_capped": len(ids) >= _RECENCY_SCAN_CAP,
            "wing": wing,
            "room": room,
            "type": type_filter,
            # Cap-10: echo the applied session_id filter so callers can verify
            # the scope without re-parsing the request (None = unfiltered).
            "session_id": session_id,
            "since": since_cutoff,
            "sort": sort,
            "limit": limit,
            "offset": offset,
            "preview_chars": preview_chars,
            "total_in_collection": total_in_collection,
        }

    kwargs: dict = {
        "include": ["documents", "metadatas"],
        "limit": max(1, limit),
        "offset": max(0, offset),
    }
    if where_filter:
        kwargs["where"] = where_filter

    try:
        page = collection.get(**kwargs)
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "wing": wing,
            "room": room,
        }

    ids = page.get("ids", []) or []
    docs = page.get("documents", []) or []
    metas = page.get("metadatas", []) or []

    drawers = [
        _project(did, metas[i] if i < len(metas) else None,
                 docs[i] if i < len(docs) else "")
        for i, did in enumerate(ids)
    ]

    try:
        total_in_collection = collection.count()
    except Exception:
        total_in_collection = -1

    return {
        "status": "ok",
        "drawers": drawers,
        "count": len(drawers),
        "wing": wing,
        "room": room,
        "type": type_filter,
        # Cap-10: echo the applied session_id filter (None = unfiltered).
        "session_id": session_id,
        "limit": limit,
        "offset": offset,
        "preview_chars": preview_chars,
        "total_in_collection": total_in_collection,
    }


# Cap 7 (privacy-sensitivity-tagging): sensitivity ordering for the write-path
# stamp AND the search `max_sensitivity` post-filter. Higher index == more
# sensitive. The triple is fixed (not operator-gated taxonomy): it gates
# VISIBILITY, it does not name predicates.
_SENSITIVITY_ORDER = {"public": 0, "personal": 1, "private": 2}


def _result_sensitivity(row: dict) -> str:
    """Sensitivity of a search-result row, defaulting to 'public' when untagged.

    Reads the field from the top-level row (hybrid searcher shape) OR the nested
    `metadata` dict (layer3 raw-vector shape). Back-compat: legacy drawers carry
    no sensitivity and must stay fully visible, so an absent/unknown value maps
    to the least-sensitive bucket.
    """
    s = row.get("sensitivity")
    if s is None and isinstance(row.get("metadata"), dict):
        s = row["metadata"].get("sensitivity")
    return s if s in _SENSITIVITY_ORDER else "public"


def _apply_sensitivity_filter(result: dict, max_sensitivity) -> dict:
    """Withhold result rows above the caller's `max_sensitivity` ceiling.

    Used for public-facing contexts: a query that passes `max_sensitivity:
    "public"` must not surface `personal`/`private` drawers. Withheld rows are
    NOT silently dropped — they are listed in `withheld[]` flagged 'available but
    withheld' so the caller knows memory exists but was suppressed. Additive: a
    None / unknown ceiling is a no-op, so default search behavior is unchanged.
    """
    if not isinstance(result, dict) or max_sensitivity not in _SENSITIVITY_ORDER:
        return result
    rows = result.get("results")
    if not isinstance(rows, list):
        return result
    ceiling = _SENSITIVITY_ORDER[max_sensitivity]
    allowed: list = []
    withheld: list = []
    for r in rows:
        level = _result_sensitivity(r) if isinstance(r, dict) else "public"
        if _SENSITIVITY_ORDER[level] <= ceiling:
            allowed.append(r)
        else:
            withheld.append({
                "drawer_id": (r.get("id") or r.get("drawer_id")) if isinstance(r, dict) else None,
                "sensitivity": level,
                "status": "available but withheld",
            })
    result["results"] = allowed
    result["count"] = len(allowed)
    result["max_sensitivity"] = max_sensitivity
    result["withheld"] = withheld
    result["withheld_count"] = len(withheld)
    return result


# ── Wave B: importance-aware recall re-ranking ──────────────────────────────
# The upstream searcher ranks purely by effective_distance (semantic similarity
# minus closet boost). The importance signals stored on every drawer —
# confidence, corroboration (observed_count), drawer type, canonical status —
# and the read-side staleness flag never enter that sort, so a deliberately-saved
# high-value memory ties with lexically-closer auto-harvested noise (drawer-quality
# audit 2026-06). These helpers fold those signals into the ranking as a BOUNDED
# distance adjustment (same magnitude class as closet_boost, ≤0.40) so importance
# nudges ranking without overriding clear semantic relevance. Opt-out per call via
# the DOS_RECALL_IMPORTANCE_RERANK=0 env flag (default on).
_IMPORTANCE_DISCOUNT_CAP = 0.30   # ceiling on the importance nudge (< closet max 0.40)
_STALE_RANK_PENALTY = 0.20        # push a stale-flagged row down the ranking
_TYPE_RANK_BONUS = {
    "canonical": 0.25,   # operator-curated "what is true now"
    "decision": 0.10,
    "milestone": 0.08,
    "problem": 0.06,
    "fact": 0.05,
    "preference": 0.05,
}


def _row_field(row: dict, name: str, default=None):
    """Read a per-drawer field from the row top level or its nested metadata dict."""
    v = row.get(name)
    if v is None:
        v = (row.get("metadata") or {}).get(name)
    return default if v is None else v


def _is_canonical_row(row: dict) -> bool:
    """True for a canonical drawer (ISC-8): type/flag == canonical, OR sourced from
    a MEMORY/CANONICAL/ file. The operator-curated truth layer is mined into drawers
    but carries no canonical type marker, so detect it by source path (read-side) —
    those ~137 canonical drawers then get their ranking preference without a
    re-index. source_path comes from the searcher; metadata.source_file (full path)
    is attached by the GAP-A surfacing that runs before the re-rank."""
    if str(_row_field(row, "type", "") or "").lower() == "canonical":
        return True
    if _row_field(row, "canonical") in (True, "true", "True", 1, "1"):
        return True
    _md = row.get("metadata") or {}
    for _sp in (row.get("source_path"), _md.get("source_file"), _md.get("source_path")):
        if isinstance(_sp, str) and "/CANONICAL/" in _sp.replace(os.sep, "/"):
            return True
    return False


def _importance_discount(row: dict) -> float:
    """Bounded rank discount (subtracted from effective_distance; larger = better
    rank) folding in confidence + corroboration + drawer-type/canonical. Capped at
    _IMPORTANCE_DISCOUNT_CAP. Missing or malformed signals contribute 0 so a drawer
    carrying no importance metadata ranks exactly as before (backward-safe)."""
    discount = 0.0
    # Confidence in [0,1] -> up to 0.10.
    try:
        conf = float(_row_field(row, "confidence"))
        if 0.0 <= conf <= 1.0:
            discount += 0.10 * conf
    except (TypeError, ValueError):
        pass
    # Corroboration: observed_count > 1 -> up to 0.06 (log-scaled, saturates ~oc=8).
    try:
        oc = int(_row_field(row, "observed_count", 1) or 1)
        if oc > 1:
            discount += min(0.06, 0.02 * math.log2(oc))
    except (TypeError, ValueError):
        pass
    # Drawer type / canonical status. Canonical (typed, flagged, or MEMORY/CANONICAL-
    # sourced) gets the strongest single bonus; otherwise the drawer's type bonus.
    if _is_canonical_row(row):
        discount += _TYPE_RANK_BONUS["canonical"]
    else:
        dtype = str(_row_field(row, "type", "") or "").lower()
        discount += _TYPE_RANK_BONUS.get(dtype, 0.0)
    return min(_IMPORTANCE_DISCOUNT_CAP, discount)


def _row_base_distance(row: dict) -> float:
    """The searcher's ranking scalar (lower = better): effective_distance, then raw
    distance, then a similarity-derived value, then a neutral 1.0."""
    for _k in ("effective_distance", "distance"):
        _v = row.get(_k)
        if isinstance(_v, (int, float)):
            return float(_v)
    _sim = row.get("similarity")
    if isinstance(_sim, (int, float)):
        return max(0.0, 1.0 - float(_sim))
    return 1.0


def _importance_rerank(results: list) -> list:
    """Stable re-sort of search hits by (effective_distance - importance_discount +
    stale_penalty), ascending. The searcher's semantic+closet ranking is the base;
    ties keep their original order (enumerate tiebreak) so equal-score rows are
    untouched."""
    def _key(item):
        idx, row = item
        adj = _row_base_distance(row) - _importance_discount(row)
        if _row_field(row, "stale") in (True, "true", "True"):
            adj += _STALE_RANK_PENALTY
        return (adj, idx)
    return [row for _, row in sorted(enumerate(results), key=_key)]


def _rerank_overfetch(limit: int) -> int:
    """Candidate window fetched before the importance re-rank + trim, so a
    high-importance drawer ranked just outside top-`limit` can still surface.
    Only used when the re-rank is ENABLED (see _search_fetch_window). Bounded:
    3x limit, floor 15, extra capped so the window never exceeds max(limit, 60) —
    this keeps the per-row metadata-surfacing cost modest and never fetches fewer
    than `limit`."""
    try:
        n = int(limit)
    except (TypeError, ValueError):
        return 15
    return max(n, min(n * 3, 60), 15)


def _search_fetch_window(limit: int, rerank_on: bool) -> int:
    """Candidate window search() fetches/keeps before the final trim to `limit`.

    When the importance re-rank is ON, over-fetch (a high-importance drawer just
    outside top-`limit` can then surface). When OFF, fetch EXACTLY `limit` — this
    is a true kill-switch: the upstream searcher's final order depends on the
    candidate pool (its BM25 term is min-max normalized WITHIN the returned pool),
    so a wider pool would silently change the trimmed top-`limit` even with the
    re-rank disabled. Matching `n_results=limit` reproduces the pre-Wave-B result
    exactly."""
    try:
        lim = int(limit)
    except (TypeError, ValueError):
        lim = 5
    return _rerank_overfetch(lim) if rerank_on else lim


def search(args: dict, _collection=None) -> dict:
    """Hybrid BM25+vector search across palace drawers (v3.3.0).

    Uses MemPalace's full search pipeline by default: closet boost, BM25
    re-ranking, drawer-grep context expansion. Passing `path: 'layer3'`
    skips the BM25 pipeline and returns raw ChromaDB vector results (RFC-0005
    §14.10). Falls back to the Layer3 path automatically if the searcher
    module is unavailable.

    Cap 7: passing `max_sensitivity` (public|personal|private) withholds any
    result row tagged more sensitive than the ceiling (see
    _apply_sensitivity_filter). Default (arg absent) is unchanged behavior.
    """
    query = args["query"]
    limit = args.get("limit", 5)
    wing = args.get("wing")
    room = args.get("room")
    hall = args.get("hall")
    # Cap-10 (cross-conversation-linking): optional origin-session post-filter,
    # mirroring `hall` (the hybrid searcher doesn't scope on it natively).
    session_id = args.get("session_id")
    path = args.get("path", "hybrid")
    max_distance = args.get("max_distance", 0.0)
    max_sensitivity = args.get("max_sensitivity")
    # Cap 8 (honest-abstention): report when a caller-supplied max_distance>0 filters
    # all results. Additive — default 0.0 leaves behavior unchanged (no gate).
    # Cap 9 (disambiguation): additive flag; groups results by wing+room.
    # Cap 6 (supersession): by default exclude superseded predecessors (newest-wins).
    include_superseded = bool(args.get("include_superseded", False))
    disambiguate = bool(args.get("disambiguate", False))

    # Wave B (importance-aware recall): resolve the re-rank flag + candidate window
    # once. OFF => fetch exactly `limit` (true kill-switch: the searcher's BM25 term
    # is pool-normalized, so a wider pool would change the trimmed head even with the
    # re-rank disabled). ON => over-fetch so importance can pull a buried drawer up.
    _rerank_on = os.environ.get("DOS_RECALL_IMPORTANCE_RERANK", "1") != "0"
    _fetch_window = _search_fetch_window(limit, _rerank_on)

    # RFC-0005 §14.10: `path: 'layer3'` bypasses BM25 + closet-boost.
    if path == "layer3":
        return _apply_sensitivity_filter(
            _layer3_chromadb_search(query, limit, wing, room, _collection),
            max_sensitivity,
        )

    palace_path = os.path.join(get_palace_path(), "palace")

    try:
        from mempalace.searcher import search_memories
        if room or wing:
            # Widen-then-filter (RFC-0126 follow-up). search_memories' room/wing path
            # effectively post-filters a top-K window AND leans on the ANN/HNSW index, so
            # it returned 0 for drawers that ARE in the room when the query ranked them
            # outside top-K or the drawer was freshly written (HNSW unflushed). Over-fetch
            # UNFILTERED (the hybrid BM25 path scans everything, incl. fresh drawers), then
            # filter by wing/room here and trim to limit.
            over = max(limit * 10, 50)
            raw = search_memories(
                query=query,
                palace_path=palace_path,
                wing=None,
                room=None,
                n_results=over,
                max_distance=max_distance,
            )
            _rs = raw.get("results", []) if isinstance(raw, dict) else []
            if wing:
                _rs = [r for r in _rs if (r.get("wing") or (r.get("metadata", {}) or {}).get("wing")) == wing]
            if room:
                _rs = [r for r in _rs if (r.get("room") or (r.get("metadata", {}) or {}).get("room")) == room]

            # W2-1 (memory campaign, RFC-0150 §6 / RFC-0126 0-hit class): the
            # widen-then-filter arm above still starves any wing whose relevant
            # drawers rank below the global top-`over` window. Add a NATIVE
            # metadata-filtered vector arm (index-level exact scope via chroma
            # `where`) as a union partner: it cannot be starved by the global
            # window, while the hybrid arm above keeps BM25 quality and covers
            # HNSW-unflushed fresh drawers. Hybrid rows keep their rank; native
            # rows append (distance-ordered) only when the drawer is not already
            # present. Kill-switch: DOS_SCOPED_SEARCH_NATIVE=0 restores the
            # exact prior behavior (house pattern, cf. DOS_RECALL_IMPORTANCE_RERANK).
            if os.environ.get("DOS_SCOPED_SEARCH_NATIVE", "1") != "0":
                try:
                    _seen_keys = set()
                    for _r in _rs:
                        _body = _r.get("content") or _r.get("text") or ""
                        if _body:
                            _seen_keys.add(_normalized_content_hash(_body))
                    _native = _layer3_chromadb_search(
                        query, _fetch_window, wing, room, _collection
                    ).get("results", [])
                    for _n in _native:
                        _nbody = _n.get("content") or ""
                        if not _nbody or _normalized_content_hash(_nbody) in _seen_keys:
                            continue
                        _seen_keys.add(_normalized_content_hash(_nbody))
                        # Normalize to the hybrid row shape: downstream converts
                        # `text` → `content`; carry both so either path is safe.
                        _n.setdefault("text", _nbody)
                        _n.setdefault("wing", (_n.get("metadata") or {}).get("wing"))
                        _n.setdefault("room", (_n.get("metadata") or {}).get("room"))
                        _n.setdefault("source_path", (_n.get("metadata") or {}).get("source_path")
                                      or (_n.get("metadata") or {}).get("source_file"))
                        _n["matched_via"] = "scoped-native-vector"
                        _rs.append(_n)
                except Exception:
                    # Native arm is additive — any failure degrades to the exact
                    # prior widen-then-filter behavior, never blocks the search.
                    pass

            result = {
                "query": query,
                "filters": {"wing": wing, "room": room},
                "total_before_filter": raw.get("total_before_filter", len(raw.get("results", []))) if isinstance(raw, dict) else 0,
                # NS-3: collapse same-drawer closet repeats BEFORE trimming so we
                # still return DISTINCT drawers. Wave B: trim to the fetch window
                # (== `limit` when re-rank off); the final trim to `limit` runs
                # post-re-rank. The room/wing fetch pool (over=50) is unchanged, so
                # this branch's ranking is stable regardless of the flag.
                "results": _dedup_search_by_content(_rs)[:_fetch_window],
            }
        else:
            # Wave B: fetch the candidate window (== `limit` when the re-rank is
            # off — true kill-switch; over-fetched when on so a high-importance
            # drawer just outside top-`limit` can surface). Trimmed to `limit`
            # after the importance re-rank below.
            result = search_memories(
                query=query,
                palace_path=palace_path,
                wing=wing,
                room=room,
                n_results=_fetch_window,
                max_distance=max_distance,
            )

        # Post-filter by hall if requested (search_memories doesn't support it natively)
        if hall and "results" in result:
            result["results"] = [r for r in result["results"] if r.get("hall") == hall
                                 or (r.get("metadata", {}) or {}).get("hall") == hall]

        # Cap-10: post-filter by origin session_id (same shape as the hall filter).
        if session_id and "results" in result:
            result["results"] = [
                r for r in result["results"]
                if r.get("session_id") == session_id
                or (r.get("metadata", {}) or {}).get("session_id") == session_id
            ]

        # Backward compat: search_memories returns "text", hooks expect "content"
        if "results" in result:
            # GAP-A fix (hybrid path): search_memories surfaces wing/room/content but
            # omits per-drawer signal fields (confidence, type, sensitivity, session_id,
            # etc.) and does NOT include drawer IDs in its result rows.  Recover the
            # stored metadata via content-hash lookup so every result row carries the
            # full metadata envelope at the top level.  One collection.get() per result
            # row (at most `limit`, typically 5); each is a fast SQLite metadata scan.
            # Proceeds unlocked on any failure — metadata surfacing never blocks search.
            _col_for_meta = _collection if _collection is not None else get_palace_collection()
            for r in result["results"]:
                if "text" in r:
                    r["content"] = r.pop("text")
                _content_hash = _normalized_content_hash(r.get("content") or "")
                _clauses: list = [{"content_sha256": _content_hash}]
                if r.get("wing"):
                    _clauses.append({"wing": r["wing"]})
                if r.get("room"):
                    _clauses.append({"room": r["room"]})
                _hash_where = {"$and": _clauses} if len(_clauses) > 1 else _clauses[0]
                try:
                    _mb = _col_for_meta.get(where=_hash_where, limit=1, include=["metadatas"])
                    if _mb.get("ids"):
                        _md = ((_mb.get("metadatas") or [{}])[0]) or {}
                        # Attach the full metadata dict if absent / None on this path.
                        if not isinstance(r.get("metadata"), dict):
                            r["metadata"] = _md
                        for _fld in ("confidence", "type", "sensitivity",
                                     "session_id", "observed_count", "stale_after",
                                     "superseded", "supersedes_drawer_id"):
                            if _fld in _md and _fld not in r:
                                r[_fld] = _md[_fld]
                except Exception as _me:
                    import sys as _sys
                    _sys.stderr.write(
                        f"[mempalace-bridge] search metadata fetch failed (proceeding): {_me}\n"
                    )
                # Cap-10: lift session_id out of nested metadata to the top level
                # so callers see a drawer's origin conversation without re-digging.
                if "session_id" not in r:
                    _sid = (r.get("metadata", {}) or {}).get("session_id")
                    if _sid is not None:
                        r["session_id"] = _sid
            # NS-3: collapse multi-closet hits of the SAME drawer so one drawer
            # can't crowd top-k via closet-boost (matched_via=drawer+closet).
            result["results"] = _dedup_search_by_content(result["results"])
            result["count"] = len(result["results"])
            # Temporal-validity-staleness: flag rows past their `stale_after` cutoff
            # with stale:true + age_days (read-side surfacing; no-op for rows without it).
            _annotate_staleness(result["results"])
            # Cap 6 (corrections-supersession): exclude rows marked superseded by a
            # newer correction unless the caller opts in with include_superseded:true.
            # Reports superseded_excluded counter so callers know newest-wins filtered.
            _before_sup = len(result["results"])
            if not include_superseded:
                result["results"] = [
                    r for r in result["results"]
                    if not (r.get("superseded") or (r.get("metadata") or {}).get("superseded"))
                ]
            result["superseded_excluded"] = _before_sup - len(result["results"])
            result["count"] = len(result["results"])

            # Wave B (importance-aware recall): fold the stored importance signals
            # (confidence, corroboration, drawer type/canonical) and the read-side
            # staleness flag into the ranking as a bounded distance adjustment, then
            # trim the over-fetched window to `limit`. When the flag is OFF the fetch
            # window is already `limit` (no over-fetch), so this block is skipped and
            # the result is the exact pre-Wave-B top-`limit`.
            if _rerank_on:
                result["results"] = _importance_rerank(result["results"])
                result["results"] = result["results"][:limit]
                result["count"] = len(result["results"])

        # Cap 8 (honest-abstention): when the caller supplied max_distance>0 and ALL
        # results were filtered by the distance gate, signal abstained:true + reason
        # instead of returning a misleading nearest hit. abstained:false when hits
        # survive. The zero default leaves existing call-sites unchanged (no gate).
        _has_gate = isinstance(max_distance, (int, float)) and max_distance > 0.0
        result["abstained"] = _has_gate and len(result.get("results", [])) == 0
        if result["abstained"]:
            result["reason"] = (
                f"max_distance={max_distance} excluded all candidates; "
                "no sufficiently similar results found"
            )

        # Cap 9 (ambiguity-disambiguation): when disambiguate:true, group the surviving
        # results by wing+room and return candidate_interpretations ranked by best score.
        if disambiguate:
            _survivors = result.get("results") or []
            if _survivors:
                from collections import defaultdict as _defaultdict
                _groups: dict = _defaultdict(list)
                for _r in _survivors:
                    _w = _r.get("wing") or (_r.get("metadata") or {}).get("wing") or "unknown"
                    _rm = _r.get("room") or (_r.get("metadata") or {}).get("room") or "unknown"
                    _groups[f"{_w}/{_rm}"].append(_r)
                _interps = []
                for _ent, _rows in _groups.items():
                    _dists = [_rx.get("distance") for _rx in _rows if _rx.get("distance") is not None]
                    _best = min(_dists) if _dists else 1.0
                    _interps.append({
                        "entity": _ent,
                        "count": len(_rows),
                        "representative": (_rows[0].get("content") or "")[:100],
                        "score": _best,
                    })
                _interps.sort(key=lambda x: x["score"])
                result["candidate_interpretations"] = _interps
            else:
                result["candidate_interpretations"] = []

        result["path"] = "hybrid"
        return _apply_sensitivity_filter(result, max_sensitivity)
    except ImportError:
        # Searcher unavailable — fall through to the Layer3 path.
        return _apply_sensitivity_filter(
            _layer3_chromadb_search(query, limit, wing, room, _collection),
            max_sensitivity,
        )


def _smart_chunk(content: str, chunk_size: int = 2000) -> list[str]:
    """Chunk markdown/text preserving YAML frontmatter and code blocks.

    Rules:
    1. YAML frontmatter (--- ... ---) stays attached to first chunk
    2. Code blocks (``` ... ```) never split mid-block
    3. Paragraph boundaries preferred; line boundaries as fallback
    4. Last chunk may be smaller than chunk_size
    """
    if len(content) <= chunk_size:
        return [content.strip()] if content.strip() else []

    # Extract frontmatter if present
    frontmatter = ""
    body = content
    if content.startswith("---\n"):
        end = content.find("\n---\n", 4)
        if end != -1:
            frontmatter = content[: end + 5]
            body = content[end + 5 :]

    # Walk body line-by-line, tracking code-block state
    chunks = []
    current = frontmatter if frontmatter else ""
    in_code = False

    for para in body.split("\n\n"):
        # Track code fences across the paragraph
        para_opens_close = para.count("```") % 2 == 1
        would_add = (current + "\n\n" + para) if current else para

        if len(would_add) > chunk_size and not in_code and current.strip():
            chunks.append(current.strip())
            current = para
        else:
            current = would_add

        if para_opens_close:
            in_code = not in_code

    if current.strip():
        chunks.append(current.strip())

    return chunks


def mine_file(args: dict, _collection=None) -> dict:
    """Mine a single file into the palace.

    Uses smart chunking that respects YAML frontmatter and markdown code blocks.

    Args:
        filepath    — required path to file
        wing        — target wing (default 'learnings')
        room        — target room (default 'general')
        chunk_size  — max chars per chunk (default 2000)
    """
    filepath = args["filepath"]
    wing = args.get("wing", "learnings")
    room = args.get("room", "general")
    chunk_size = args.get("chunk_size", 2000)

    # W1 pollution guard: never mine excluded paths (frozen Releases snapshots,
    # ephemeral agent worktrees, raw transcript/agent-task dumps, node_modules,
    # .claude/projects). Applied here AND in mine_dir so direct mine_file calls
    # are protected too.
    if _is_mine_excluded(filepath):
        return {"status": "skip", "message": "excluded by mine policy",
                "filepath": filepath, "excluded": True}

    if not os.path.exists(filepath):
        return {"status": "error", "message": f"File not found: {filepath}"}

    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    if not content.strip():
        return {"status": "skip", "message": "Empty file"}

    # Section-gate MEMORY/WORK PRDs: mine ONLY the durable Decisions/Lessons/
    # Rationale/LEARN sections, never whole PRD bodies (ISC acceptance-checkbox
    # lists, frontmatter, and verification/tool-output blocks were the dominant
    # palace noise per the 2026-06 drawer-quality audit). Files outside
    # MEMORY/WORK mine unchanged.
    if _is_work_prd(filepath):
        gated = _extract_prd_sections(content)
        if not gated.strip():
            return {"status": "skip",
                    "message": "PRD has no durable (Decisions/Lessons/Rationale/LEARN) sections",
                    "filepath": filepath}
        content = gated

    chunks = _smart_chunk(content, chunk_size=chunk_size)

    results = []
    for chunk in chunks:
        result = add_drawer(
            {
                "wing": wing,
                "room": room,
                "content": chunk,
                "source_file": filepath,
                "added_by": "dos-mine",
            },
            _collection=_collection,
        )
        results.append(result)

    return {
        "status": "ok",
        "filepath": filepath,
        "chunks": len(results),
        "results": results,
    }


def mine_dir(args: dict) -> dict:
    """Mine all .md/.jsonl files in a directory tree into a wing/room.

    Walks the directory recursively. Each file becomes one or more drawers.
    """
    directory = os.path.expanduser(args["dir"])
    wing = args.get("wing", "general")
    room = args.get("room", "general")
    extensions = args.get("extensions", [".md", ".jsonl", ".txt"])

    if not os.path.isdir(directory):
        return {"status": "error", "message": f"Directory not found: {directory}"}

    filed = 0
    duplicates = 0
    skipped = 0
    errors = 0

    for root, _dirs, files in os.walk(directory):
        # W1 pollution guard: prune excluded directories in-place so os.walk never
        # descends into frozen Releases, agent worktrees, node_modules, etc.
        _dirs[:] = [d for d in _dirs if not _is_mine_excluded(os.path.join(root, d))]
        for fname in files:
            if not any(fname.endswith(ext) for ext in extensions):
                continue
            filepath = os.path.join(root, fname)
            if _is_mine_excluded(filepath):
                skipped += 1
                continue
            try:
                result = mine_file({"filepath": filepath, "wing": wing, "room": room})
                if result.get("status") == "ok":
                    # MP-010: count genuinely-persisted chunks separately from
                    # dup-dropped ones so drawers_filed reflects real new drawers.
                    chunk_results = result.get("results") or []
                    new_chunks = sum(
                        1 for cr in chunk_results
                        if isinstance(cr, dict) and cr.get("status") == "ok"
                    )
                    dup_chunks = sum(
                        1 for cr in chunk_results
                        if isinstance(cr, dict) and cr.get("status") == "duplicate"
                    )
                    if chunk_results:
                        filed += new_chunks
                        duplicates += dup_chunks
                    else:
                        filed += result.get("chunks", 1)
                elif result.get("status") == "skip":
                    skipped += 1
                else:
                    errors += 1
            except Exception:
                errors += 1

    return {
        "status": "ok",
        "directory": directory,
        "wing": wing,
        "room": room,
        "drawers_filed": filed,
        "duplicates": duplicates,
        "skipped": skipped,
        "errors": errors,
    }


def mine_convos(args: dict) -> dict:
    """Mine conversation files (Claude Code JSONL, ChatGPT JSON, Slack, plain text).

    Uses MemPalace's convo_miner which handles multiple export formats
    and chunks by Q+A exchange pairs or by memory type classification.
    """
    # Lazy import: _import_err lives in palace; circular avoided because we
    # only call into palace, never the other way.
    from _bridge_palace import _import_err
    try:
        from mempalace.convo_miner import mine_convos as do_mine_convos
    except ImportError as e:
        return _import_err("mempalace.convo_miner", e)

    convo_dir = os.path.expanduser(args["dir"])
    wing = args.get("wing")
    extract_mode = args.get("extract_mode", "exchange")
    limit = args.get("limit", 0)

    if not os.path.isdir(convo_dir):
        return {"status": "error", "message": f"Directory not found: {convo_dir}"}

    palace_path = os.path.join(get_palace_path(), "palace")

    # Capture stdout since mine_convos prints progress
    import io
    import contextlib

    output = io.StringIO()
    try:
        with contextlib.redirect_stdout(output):
            do_mine_convos(
                convo_dir,
                palace_path,
                wing=wing,
                extract_mode=extract_mode,
                limit=limit,
            )
    except Exception as e:
        return {"status": "error", "message": str(e), "wing": wing}

    # NOTE on wing_index sync:
    # mempalace.convo_miner writes directly to ChromaDB and bypasses
    # _wing_index_upsert, so wing_index lags behind after bulk mines.
    # We do NOT refresh inline here — convo_miner has already opened chromadb
    # with its own settings in this process, and a second open via
    # get_palace_collection() conflicts ("Chroma already exists … with
    # different settings"). Instead, status() auto-detects drift and rebuilds
    # the index on next call (see status()'s drift check).

    return {
        "status": "ok",
        "directory": convo_dir,
        "wing": wing,
        "extract_mode": extract_mode,
        "output": output.getvalue()[-500:],  # Last 500 chars of progress
    }


def audit_drawer(args: dict, _collection=None) -> dict:
    """Compose a full provenance audit bundle for a single drawer (cap 11).

    Composes existing primitives — collection.get(drawer_id) + KG triples by
    source_drawer_id — into a single explainable-recall envelope. Touches no
    existing write path; all reads are additive and non-destructive.

    Args:
        drawer_id  — required. ID of the drawer to audit.

    Returns:
        {found: True, drawer_id, claim, source, observed_count, confidence,
         valid_from, stale, stale_after, supersedes, superseded,
         conflicts, kg_facts, wing, room, type}
        or {found: False, drawer_id} when the id is absent from the collection.
    """
    drawer_id = args["drawer_id"]
    collection = _collection if _collection is not None else get_palace_collection()

    hit = collection.get(ids=[drawer_id], include=["documents", "metadatas"])
    if not (hit.get("ids") or []):
        return {"found": False, "drawer_id": drawer_id}

    meta = (hit.get("metadatas") or [{}])[0] or {}
    doc = (hit.get("documents") or [""])[0] or ""

    # Annotate staleness using the existing helper (reads stale_after from meta).
    row: dict = {"id": drawer_id, "content": doc, **meta}
    _annotate_staleness([row])

    # Collect KG facts linked by source_drawer_id via the triples table.
    kg_facts: list = []
    try:
        from _bridge_palace import get_kg
        _kg = get_kg()
        _cur = _kg.execute(
            "SELECT subject, predicate, object, confidence, valid_from, valid_to "
            "FROM triples WHERE source_drawer_id = ? AND valid_to IS NULL",
            (drawer_id,),
        )
        for _r in _cur.fetchall():
            kg_facts.append({
                "subject": _r[0],
                "predicate": _r[1],
                "object": _r[2],
                "confidence": _r[3],
                "valid_from": _r[4],
                "valid_to": _r[5],
            })
    except Exception:
        pass  # KG unavailable or triples schema absent — return empty list

    return {
        "found": True,
        "drawer_id": drawer_id,
        # First 500 chars of the drawer content as the human-readable "claim".
        "claim": doc[:500],
        "source": meta.get("source_file"),
        "observed_count": meta.get("observed_count", 1),
        "confidence": meta.get("confidence"),
        # valid_from mirrors the drawer's write timestamp (closest analogue to KG valid_from).
        "valid_from": meta.get("timestamp"),
        "stale": row.get("stale"),
        "stale_after": meta.get("stale_after"),
        # Supersession chain fields (cap 6): None on legacy drawers.
        "supersedes": meta.get("supersedes_drawer_id"),
        "superseded": bool(meta.get("superseded", False)),
        "superseded_by": meta.get("superseded_by_drawer_id"),
        # Conflict scan is future work (cap 5 lives in fact_check); placeholder here.
        "conflicts": [],
        "kg_facts": kg_facts,
        # Location metadata for context.
        "wing": meta.get("wing"),
        "room": meta.get("room"),
        "type": meta.get("type"),
        # GAP-B fix: sensitivity (cap 7) and session_id (cap 10) were stored
        # correctly by add_drawer but omitted from the audit_drawer return dict,
        # causing them to surface as None to callers.  Additive — None for legacy
        # drawers that pre-date these fields.
        "sensitivity": meta.get("sensitivity"),
        "session_id": meta.get("session_id"),
    }
