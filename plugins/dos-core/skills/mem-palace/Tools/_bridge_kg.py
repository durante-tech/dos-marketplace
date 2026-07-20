#!/usr/bin/env python3
"""
MemPalace Bridge — knowledge-graph module (split from bridge.py per RFC-0035 §MW3-F).

Knowledge-graph CRUD and query operations. Imports the cached KG handle from
the sibling _bridge_palace module.

Public actions exported by this module:
  - add_kg_fact, invalidate, update_entity, merge_entities
  - kg_query, kg_query_predicate, kg_timeline
  - kg_stats

Helpers (private to this module):
  - _parse_timeline_date  — ISO-date parser tolerant of trailing Z and bare YYYY-MM-DD
  - _timeline_since_date  — derive a since-cutoff from explicit since= or window_days
  - _filter_timeline_since  — post-filter timeline list by a since cutoff

V11.13 split: 2026-05-08. Pure refactor — zero behavior change.
"""

import json
import os
from datetime import datetime, timezone, timedelta

# Sibling-module import. The facade (bridge.py / mempalace_bridge.py) prepends
# the Tools/ directory to sys.path before dispatch.
from _bridge_palace import get_kg


# Feathers tripwire (Council ratification 2026-05-17): log every kg_query call
# that asks for one of the 3 predicates flagged for deprecation. Investigation
# 2026-05-17 surfaced ZERO readers in grep; the tripwire is the empirical
# 48h-14d proof BEFORE invalidating the 591 existing triples. Doomed predicates:
#   - queried_by_session  (intel-context.ts write-back, no consumers found)
#   - created_in_session  (TaskCreated.hook.ts write, no consumers found)
#   - health_score        (MemoryGardener report-only, no consumers found)
# A non-zero tripwire-fire count over the soak window blocks Phase 2 invalidation.
_TRIPWIRE_DOOMED_PREDICATES = frozenset({"queried_by_session", "created_in_session", "health_score"})


def _kg_tripwire_log(action: str, predicate: str, args: dict) -> None:
    """Best-effort tripwire write — never fails the parent kg_query call."""
    try:
        path = os.path.expanduser("~/.claude/MEMORY/STATE/kg-tripwire.jsonl")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        record = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "action": action,
            "predicate": predicate,
            "subject": args.get("subject"),
            "object": args.get("object"),
            "caller_hook": os.environ.get("DOS_CALLER_HOOK"),
            "session_id": os.environ.get("DOS_SESSION_ID") or os.environ.get("CLAUDE_SESSION_ID"),
        }
        with open(path, "a") as f:
            f.write(json.dumps(record) + "\n")
    except Exception:
        pass  # tripwire MUST NOT fail the parent call


def _kg_deny_log(args: dict) -> None:
    """Best-effort deny log — records every blocked telemetry-predicate write
    so we can identify the producer hook and convert it to a telemetry-log
    write before Phase 2 invalidation. Separate file from tripwire so reads
    vs writes stay distinguishable in the soak-window evidence."""
    try:
        path = os.path.expanduser("~/.claude/MEMORY/STATE/kg-deny.jsonl")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        record = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "predicate": args.get("predicate"),
            "subject": args.get("subject"),
            "object": args.get("object"),
            "caller_hook": os.environ.get("DOS_CALLER_HOOK"),
            "session_id": os.environ.get("DOS_SESSION_ID") or os.environ.get("CLAUDE_SESSION_ID"),
        }
        with open(path, "a") as f:
            f.write(json.dumps(record) + "\n")
    except Exception:
        pass  # deny log MUST NOT fail the parent call


def add_kg_fact(args: dict, _kg=None) -> dict:
    """Add a temporal fact to the knowledge graph.

    Note: The bridge accepts any Unicode in subject/predicate/object values
    (commas, colons, plus signs all work). The MCP server (`mempalace.mcp_server`)
    applies stricter `sanitize_name()` validation that rejects commas, colons,
    and plus signs. For KG facts with rich object values, use the bridge directly.

    Phase 1 telemetry write-deny (Council ratification 2026-05-17): writes to
    predicates in _TRIPWIRE_DOOMED_PREDICATES are rejected with error_type
    "telemetry-deprecated" to stop the bleed without invalidating the existing
    591 triples. The deny is logged so we can identify writers and convert them
    to telemetry-log writes before Phase 2 invalidation. Override:
    DOS_KG_TELEMETRY_DENY=off (emergency only).
    """
    predicate = args.get("predicate", "")
    if (
        predicate in _TRIPWIRE_DOOMED_PREDICATES
        and os.environ.get("DOS_KG_TELEMETRY_DENY", "on").lower() != "off"
    ):
        _kg_deny_log(args)
        return {
            "isError": True,
            "status": "error",
            "error_type": "telemetry-deprecated",
            "message": (
                f"Predicate '{predicate}' is deprecated for KG writes "
                "(Council 2026-05-17 cut). It belongs in a telemetry log, "
                "not the durable read-model. Existing triples remain queryable "
                "during Phase 1 soak. Override: DOS_KG_TELEMETRY_DENY=off."
            ),
            "action": "add_kg_fact",
        }

    kg = _kg if _kg is not None else get_kg()

    subject = args["subject"]
    obj = args["object"]
    valid_from = args.get("valid_from", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    confidence = args.get("confidence", 1.0)

    # W2-3 (memory campaign, CANDIDATES.md rank #5): write-time contradiction
    # detection for SINGLE-valued predicates. Upstream add_triple dedups
    # exact-match only (arXiv 2604.21284's exact critique), so rival objects
    # accumulate silently — 1,153 open (subject,predicate) rival groups measured
    # live 2026-07-01. For predicates the sidecar registry declares "single",
    # an open rival triggers: default = non-blocking contradiction_warning on
    # the response; DOS_KG_AUTOSUPERSEDE=1 = Graphiti-style close-the-prior
    # (invalidate rival at new fact's valid_from). Multi-valued/unregistered
    # predicates are untouched. Registry: predicates-cardinality.json (sibling).
    contradiction_warning = None
    superseded = []
    if predicate in _single_valued_predicates():
        try:
            rivals = [
                f for f in kg.query_entity(subject, direction="outgoing")
                if f.get("predicate") == predicate
                and not f.get("valid_to")
                and f.get("object") != obj
            ]
            if rivals:
                if os.environ.get("DOS_KG_AUTOSUPERSEDE", "0") == "1":
                    for r in rivals:
                        kg.invalidate(subject, predicate, r["object"], ended=valid_from)
                        superseded.append(r["object"])
                else:
                    contradiction_warning = {
                        "predicate_cardinality": "single",
                        "open_rivals": [r["object"] for r in rivals],
                        "hint": (
                            "single-valued predicate already has open rival object(s); "
                            "invalidate the stale fact or set DOS_KG_AUTOSUPERSEDE=1 "
                            "to close priors automatically"
                        ),
                    }
        except Exception:
            # Detection is additive — never block the write on a registry/query
            # failure; the fact lands exactly as before this feature existed.
            pass

    kg.add_triple(subject, predicate, obj, valid_from=valid_from, confidence=confidence)

    result = {
        "status": "ok",
        "fact": f'{subject} -> {predicate} -> {obj} (from {valid_from}, confidence={confidence})',
    }
    if contradiction_warning:
        result["contradiction_warning"] = contradiction_warning
    if superseded:
        result["superseded"] = superseded
    return result


# W2-3: predicate-cardinality registry (sidecar JSON, curated). Conservative by
# design — only predicates explicitly listed as single-valued ever warn; the
# 176-predicate canonical corpus is classified incrementally by curation, not
# guessed wholesale here. Module-level cache; missing/malformed file = empty.
_CARDINALITY_CACHE = None


def _single_valued_predicates() -> set:
    global _CARDINALITY_CACHE
    if _CARDINALITY_CACHE is None:
        try:
            _path = os.path.join(
                os.path.dirname(os.path.abspath(__file__)), "predicates-cardinality.json"
            )
            with open(_path, "r", encoding="utf-8") as _f:
                _CARDINALITY_CACHE = set(json.load(_f).get("single", []))
        except Exception:
            _CARDINALITY_CACHE = set()
    return _CARDINALITY_CACHE


def invalidate(args: dict, _kg=None) -> dict:
    """Mark a KG fact as no longer true."""
    kg = _kg if _kg is not None else get_kg()

    subject = args["subject"]
    predicate = args["predicate"]
    obj = args["object"]
    ended = args.get("ended", datetime.now(timezone.utc).strftime("%Y-%m-%d"))

    kg.invalidate(subject, predicate, obj, ended=ended)

    return {"status": "ok", "fact": f"{subject} -> {predicate} -> {obj}", "ended": ended}


def update_entity(args: dict, _kg=None) -> dict:
    """Update an entity's type or properties in the KG.

    Args:
        entity — required. The entity name.
        type   — optional. New type value (e.g., 'skill', 'pack', 'hook', 'agent', 'platform').
        properties — optional. JSON string of properties to merge.
    """
    kg = _kg if _kg is not None else get_kg()
    entity_name = args["entity"]
    new_type = args.get("type")
    new_props = args.get("properties")

    eid = kg._entity_id(entity_name)

    conn = kg._conn()
    # Check entity exists
    row = conn.execute("SELECT id, type, properties FROM entities WHERE id = ?", (eid,)).fetchone()
    if not row:
        return {"status": "error", "error_type": "not_found", "message": f"Entity '{entity_name}' (id={eid}) not found"}

    updates = []
    params = []
    if new_type is not None:
        updates.append("type = ?")
        params.append(new_type)
    if new_props is not None:
        updates.append("properties = ?")
        params.append(new_props if isinstance(new_props, str) else json.dumps(new_props))

    if not updates:
        return {"status": "ok", "message": "No updates provided", "entity": entity_name}

    params.append(eid)
    with conn:
        conn.execute(f"UPDATE entities SET {', '.join(updates)} WHERE id = ?", params)

    return {
        "status": "ok",
        "entity": entity_name,
        "entity_id": eid,
        "updated_fields": [u.split(" = ")[0] for u in updates],
    }


def merge_entities(args: dict, _kg=None) -> dict:
    """Merge one entity into another by repointing all triples.

    Args:
        source — required. Entity name to merge FROM (will be deleted).
        target — required. Entity name to merge INTO (will receive all triples).
        delete_source — optional (default true). Delete source entity after merge.

    All triples where source is subject or object get repointed to target.
    Duplicate triples (same subject+predicate+object after repoint) are skipped.
    """
    kg = _kg if _kg is not None else get_kg()
    source_name = args["source"]
    target_name = args["target"]
    delete_source = args.get("delete_source", True)

    source_id = kg._entity_id(source_name)
    target_id = kg._entity_id(target_name)

    if source_id == target_id:
        return {"status": "ok", "message": "Source and target are the same entity", "repointed": 0}

    conn = kg._conn()

    # Target must exist; source may exist only in triples (orphaned references)
    target_row = conn.execute("SELECT id FROM entities WHERE id = ?", (target_id,)).fetchone()
    if not target_row:
        return {"status": "error", "message": f"Target entity '{target_name}' (id={target_id}) not found"}

    # Check if source has any triples (even without an entity row)
    source_triple_count = conn.execute(
        "SELECT COUNT(*) FROM triples WHERE subject = ? OR object = ?", (source_id, source_id)
    ).fetchone()[0]
    if source_triple_count == 0:
        return {"status": "ok", "message": f"Source '{source_name}' has no triples to merge", "repointed": 0}

    repointed = 0
    skipped_dupes = 0

    with conn:
        # Repoint subject references (use rowid for NULL-id triples)
        subject_triples = conn.execute(
            "SELECT rowid, id, predicate, object FROM triples WHERE subject = ?", (source_id,)
        ).fetchall()
        for t in subject_triples:
            existing = conn.execute(
                "SELECT rowid FROM triples WHERE subject = ? AND predicate = ? AND object = ? AND valid_to IS NULL",
                (target_id, t["predicate"], t["object"])
            ).fetchone()
            if existing:
                conn.execute("DELETE FROM triples WHERE rowid = ?", (t["rowid"],))
                skipped_dupes += 1
            else:
                conn.execute("UPDATE triples SET subject = ? WHERE rowid = ?", (target_id, t["rowid"]))
                repointed += 1

        # Repoint object references
        object_triples = conn.execute(
            "SELECT rowid, id, subject, predicate FROM triples WHERE object = ?", (source_id,)
        ).fetchall()
        for t in object_triples:
            existing = conn.execute(
                "SELECT rowid FROM triples WHERE subject = ? AND predicate = ? AND object = ? AND valid_to IS NULL",
                (t["subject"], t["predicate"], target_id)
            ).fetchone()
            if existing:
                conn.execute("DELETE FROM triples WHERE rowid = ?", (t["rowid"],))
                skipped_dupes += 1
            else:
                conn.execute("UPDATE triples SET object = ? WHERE rowid = ?", (target_id, t["rowid"]))
                repointed += 1

        # Delete source entity (if it exists — some orphaned entities only exist in triples)
        if delete_source:
            conn.execute("DELETE FROM entities WHERE id = ?", (source_id,))
            # Defensive cleanup: SQLite allows NULL in a TEXT PRIMARY KEY column
            # (the NOT-NULL implication only applies to INTEGER PRIMARY KEY), so a
            # malformed/externally-corrupted NULL-id row CAN exist even though
            # _entity_id() never produces one. This sweeps any such row matching
            # the merged-away source name. No-op in normal operation.
            conn.execute("DELETE FROM entities WHERE name = ? AND id IS NULL", (source_name,))

    return {
        "status": "ok",
        "source": source_name,
        "target": target_name,
        "repointed": repointed,
        "skipped_duplicates": skipped_dupes,
        "source_deleted": delete_source,
    }


def _parse_timeline_date(value):
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(text).date()
    except ValueError:
        pass
    try:
        return datetime.fromisoformat(text[:10]).date()
    except ValueError:
        return None


def _timeline_since_date(args: dict):
    explicit_since = args.get("since")
    if explicit_since:
        parsed = _parse_timeline_date(explicit_since)
        return parsed, str(explicit_since) if parsed else None

    if "window_days" not in args:
        return None, None

    try:
        days = int(args.get("window_days"))
    except (TypeError, ValueError):
        return None, None
    if days <= 0:
        return None, None

    since_date = (datetime.now(timezone.utc) - timedelta(days=days)).date()
    return since_date, since_date.isoformat()


def _filter_timeline_since(timeline: list, since_date):
    if since_date is None:
        return timeline
    filtered = []
    for fact in timeline:
        fact_date = _parse_timeline_date(fact.get("valid_from"))
        if fact_date is not None and fact_date >= since_date:
            filtered.append(fact)
    return filtered


def kg_timeline(args: dict, _kg=None) -> dict:
    """Get chronological timeline for an entity, optionally since/window filtered."""
    kg = _kg if _kg is not None else get_kg()
    entity = args.get("entity")
    timeline = kg.timeline(entity) if entity else kg.timeline()
    since_date, since_value = _timeline_since_date(args)
    timeline = _filter_timeline_since(timeline, since_date)
    result = {"entity": entity, "timeline": timeline, "count": len(timeline)}
    if since_value:
        result["since"] = since_value
    if "window_days" in args:
        result["window_days"] = args.get("window_days")
    return result


def kg_query(args: dict, _kg=None) -> dict:
    """Query the knowledge graph by entity with direction filtering.

    Args:
        entity    — required. The entity name (subject or object depending on direction).
        direction — 'outgoing' (entity is subject, default), 'incoming' (entity is object),
                    or 'both'.
        as_of     — optional ISO date. Returns only facts valid on that date.
        predicate — optional. Filter results to only this predicate (client-side filter).
    """
    kg = _kg if _kg is not None else get_kg()

    entity = args["entity"]
    direction = args.get("direction", "outgoing")
    as_of = args.get("as_of")
    predicate_filter = args.get("predicate")

    facts = kg.query_entity(entity, as_of=as_of, direction=direction)

    if predicate_filter:
        facts = [f for f in facts if f.get("predicate") == predicate_filter]

    return {
        "entity": entity,
        "direction": direction,
        "as_of": as_of,
        "predicate_filter": predicate_filter,
        "facts": facts,
        "count": len(facts),
    }


def kg_query_predicate(args: dict, _kg=None) -> dict:
    """Query the knowledge graph by predicate, optionally filtered by subject/object.

    Args:
        predicate — required.
        subject   — optional. Return only facts where fact["subject"] == subject.
        object    — optional. Return only facts where fact["object"] == object.
        as_of     — optional ISO date.

    Note: kg.query_relationship() only accepts (predicate, as_of); subject/object
    filters are applied post-query. Before this filter was added, the bridge
    silently ignored callers' subject/object args — a latent defect that let
    PhaseCompleteGate false-positive-pass once any matching predicate existed
    in the corpus, regardless of session attribution.
    """
    kg = _kg if _kg is not None else get_kg()

    predicate = args["predicate"]
    as_of = args.get("as_of")
    subject = args.get("subject")
    obj = args.get("object")

    # Feathers tripwire — log query against a doomed predicate so we can
    # empirically verify zero readers during the 48h-14d soak window before
    # Phase 2 invalidation. See _TRIPWIRE_DOOMED_PREDICATES above.
    if predicate in _TRIPWIRE_DOOMED_PREDICATES:
        _kg_tripwire_log("kg_query_predicate", predicate, args)

    facts = kg.query_relationship(predicate, as_of=as_of)

    if subject is not None:
        facts = [f for f in facts if f.get("subject") == subject]
    if obj is not None:
        facts = [f for f in facts if f.get("object") == obj]

    return {
        "predicate": predicate,
        "subject": subject,
        "object": obj,
        "as_of": as_of,
        "facts": facts,
        "count": len(facts),
    }


def kg_stats(args: dict = None) -> dict:
    """Knowledge graph overview: entities, triples, relationship types.

    Mirrors fork's tool_kg_stats() at mcp_server.py:1191. Calls KnowledgeGraph.stats()
    directly. Args ignored — endpoint is parameterless on MCP and matches here.
    """
    try:
        kg = get_kg()
        return kg.stats()
    except Exception as exc:
        return {
            "status": "error",
            "error_type": "kg_stats_failed",
            "message": f"kg_stats failed: {exc}",
        }
