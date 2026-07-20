---
name: cadenced-audit
version: 1
cadence: "0 9 */14 * *"   # every 14 days at 9am (cron format)
trigger: /schedule or manual bun invocation
---

# Cadenced Council Audit Routine

RFC-0024 §5.8. Runs the 5-agent council over the previous 7 days, files findings, and diffs against previous audit to surface new recurring patterns.

## Manual invocation

```bash
bun "$DOS_DIR/Packs/session-autopsy/Tools/run-audit.ts" [--window-days 7] [--dry-run]
```

## Routine body

1. **Compute window.** `[now - 7d, now]` by default. Override with `--window-days`.
2. **Spawn 5 council agents in parallel** using the archived prompts. Each prompt is loaded as the `prompt` field; the prompt itself carries the full analysis structure for its seat.

   > **Deploy reality (be honest about the current install).** The 5 specialist subagents (`reflections-agent`, `session-pattern-agent`, `signals-failures-agent`, `work-palace-agent`, `capability-utilization-agent`) are **not yet deployed to the agent registry** (`~/.claude/agents/`) — the Copy-4 deployment is a tracked next step. **Until they are, every seat runs as `subagent_type: "general-purpose"` with the prompt seed** (the fallback below is the default path, not the exception). Once the specialists are deployed, the `subagent_type` activates the persona + voice + permissions of Council's native-subagent pattern (see `Packs/thinking/src/Council/Workflows/Debate.md` § Specialist Seat Composition) — the spawn-plan can then use the real specialist types. The analysis quality does not depend on the specialist persona; it is carried by the prompt.

   Specialist↔prompt matching (the intended mapping once the specialists deploy):

   ```ts
   // Reflections — historical/archaeological lens (mining past sessions for patterns)
   Task({
     subagent_type: "Feathers",
     description: "Cadenced audit — reflections",
     prompt: "<contents of Packs/session-autopsy/Prompts/reflections.md with {{WINDOW_START}}/{{WINDOW_END}} substituted>\n\nReturn YAML-structured findings per the prompt spec. Under 600 words."
   })

   // Session-pattern — workflow/use-case decomposition lens
   Task({
     subagent_type: "Cockburn",
     description: "Cadenced audit — session patterns",
     prompt: "<contents of Packs/session-autopsy/Prompts/session.md with {{WINDOW_START}}/{{WINDOW_END}} substituted>\n\nReturn YAML-structured findings per the prompt spec. Under 600 words."
   })

   // Signals + Failures — broken-windows / anti-pattern detection lens
   Task({
     subagent_type: "Pragmatic",
     description: "Cadenced audit — signals + failures",
     prompt: "<contents of Packs/session-autopsy/Prompts/signals-failures.md with {{WINDOW_START}}/{{WINDOW_END}} substituted>\n\nReturn YAML-structured findings per the prompt spec. Under 600 words."
   })

   // WORK + Palace — refactoring catalog / architectural drift lens + CLAUDE.md currency (version/sprint contradictions)
   Task({
     subagent_type: "Fowler",
     description: "Cadenced audit — work + palace + CLAUDE.md currency",
     prompt: "<contents of Packs/session-autopsy/Prompts/work-palace.md with {{WINDOW_START}}/{{WINDOW_END}} substituted>\n\nReturn YAML-structured findings per the prompt spec. Under 600 words."
   })

   // Capability-utilization — empirical-measurement lens (RFC-0134 C4): runs the deterministic capability-audit engine, reports invocation-breadth
   Task({
     subagent_type: "KentBeck",
     description: "Cadenced audit — capability utilization",
     prompt: "<contents of Packs/session-autopsy/Prompts/capability-utilization.md with {{WINDOW_START}}/{{WINDOW_END}} substituted>\n\nReturn YAML-structured findings per the prompt spec. Under 500 words."
   })
   ```

   Substitute `{{WINDOW_START}}` / `{{WINDOW_END}}` in each prompt before spawn. The runner writes `spawn-plan.json` with prompt paths, versions, specialist↔prompt mapping, and previous-audit pointer.

   **Specialist↔prompt mapping rationale:** Feathers' archaeological lens fits historical reflection-mining; Cockburn's use-case decomposition fits session-pattern analysis; Pragmatic's Broken Windows / Boiled Frog frame fits signals + failure-cluster detection; Fowler's refactoring catalog + architectural drift lens fits WORK + Palace audit — which also carries the **CLAUDE.md currency** check (version/sprint contradictions in `~/Durante/CLAUDE.md`, the failure class where a vX-LIVE line sits above a vY-most-recent-sprint line), recommending a `claude-md-management:claude-md-improver` remediation pass on any contradiction. KentBeck's empirical-software-design lens fits the **capability-utilization** seat (RFC-0134 C4) — it runs the deterministic `Tools/capability-audit.ts` engine and reports invocation-breadth without authoring any metric itself (the §10.4 anti-gaming contract). If a future audit shifts focus (e.g., adds a security-audit prompt), pick a different specialist that matches that lens — the mapping is per-audit, not load-bearing across versions.

   **Fallback:** If any specialist is unavailable in this install, fall back to `subagent_type: "general-purpose"` for that one seat — the prompt itself carries the analysis structure.

3. **Collect outputs.** Each agent returns YAML-structured findings per its prompt spec.

4. **Synthesize.** Primary writes `MEMORY/WORK/YYYYMMDD-council-audit-auto/findings.md`. Structure:
   ```yaml
   ---
   window: {start, end, days}
   prompt_version: 1            # from prompts' frontmatter; bump when prompts change
   generated_at: ISO
   ---

   # Council Audit — auto-generated

   ## Reflections agent
   <verbatim YAML block from agent>

   ## Session-pattern agent
   <verbatim YAML block>

   ## Signals + Failures agent
   <verbatim YAML block>

   ## WORK + Palace agent
   <verbatim YAML block>

   ## Cross-agent synthesis
   <primary's 400-word summary surfacing new recurring patterns>
   ```

5. **Diff against previous audit.** Find the most recent `MEMORY/WORK/*-council-audit-auto/findings.md` in the preceding 28 days. Compare theme lists (reflections + session mention-gaps + failure clusters).

   New pattern = theme that appears in current audit with ≥3 occurrences AND did not appear in previous audit (or appeared with < 1 occurrence).

   **CLAUDE.md currency contradictions are first-class — not frequency-gated.** The WORK + Palace agent's `claude_md_currency` block can flag a version/sprint contradiction (e.g. a vX-LIVE line sitting above a vY-most-recent-sprint line) that is a correctness defect on its FIRST appearance, not a pattern that must recur ≥3 times. Surface any such contradiction explicitly in the Cross-agent synthesis, and when `recommend_improver: true`, recommend an immediate `claude-md-management:claude-md-improver` remediation pass against `~/Durante/CLAUDE.md` rather than (or in addition to) seeding an RFC stub. A contradiction that survives into a later audit (present now, unresolved since a prior audit) is a regression — call it out in the diff.

   For each new pattern, write `Plans/Specs/RFC-XXXX-auto-<pattern-slug>.md` as Draft status with:
   - Parent RFC reference (this RFC)
   - Pattern name + recurrence count
   - Evidence paths
   - Recommended investigation (not implementation spec)

   Deterministic conformance probe:
   ```bash
   bun "$DOS_DIR/Packs/session-autopsy/Tools/run-audit.ts" \
     --work-dir /tmp/dos-audit-work \
     --specs-dir /tmp/dos-audit-specs \
     --date 20260425 \
     --synthetic-pattern missed-verification-loop=3
   ```
   The probe MUST create one `RFC-XXXX-auto-missed-verification-loop.md` stub in the temp specs directory.

6. **Persist findings to MemPalace.** Each major finding becomes a KG fact under `subject: "audit:cadenced-{YYYYMMDD}"` so cross-audit trend analysis can query the graph directly (not just diff markdown). Build ONE `batch` operations list and submit via the bridge — same pattern Sentinel uses in `Workflows/Scan.md` (cross-pack ref to Packs/sentinel/src/Workflows/Scan.md; this pack does not contain it — generated at runtime by the comparable example) Phase 3 (one Python process, one SQLite connection, one WAL transaction).

   ```bash
   AUDIT_ID="audit:cadenced-$(date +%Y%m%d)"
   TODAY=$(date +%Y-%m-%d)

   # Build operations from the synthesized findings.
   # One add_kg_fact per major finding (verdict, new-pattern, theme-recurrence).
   # One add_drawer with the full synthesized findings.md for semantic recall.
   cat > /tmp/autopsy-batch.json <<EOF
   {
     "operations": [
       {"action": "add_kg_fact", "args": {"subject": "$AUDIT_ID", "predicate": "window_start", "object": "$WINDOW_START", "valid_from": "$TODAY"}},
       {"action": "add_kg_fact", "args": {"subject": "$AUDIT_ID", "predicate": "window_end",   "object": "$WINDOW_END",   "valid_from": "$TODAY"}},
       {"action": "add_kg_fact", "args": {"subject": "$AUDIT_ID", "predicate": "new_pattern",  "object": "<pattern-slug>", "valid_from": "$TODAY"}},
       {"action": "add_kg_fact", "args": {"subject": "$AUDIT_ID", "predicate": "theme_recurs", "object": "<theme>:<count>", "valid_from": "$TODAY"}},
       {"action": "add_drawer",  "args": {"wing": "audits", "room": "cadenced", "content": "<verbatim findings.md content>", "source_file": "MEMORY/WORK/YYYYMMDD-council-audit-auto/findings.md", "added_by": "session-autopsy"}}
     ]
   }
   EOF

   RESPONSE=$(uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py batch "$(cat /tmp/autopsy-batch.json)")

   # MANDATORY: parse status (bridge always exits 0 — must check JSON status field)
   echo "$RESPONSE" | python3 -c "
   import json, sys
   r = json.load(sys.stdin)
   status = r.get('status')
   ok = sum(1 for x in r.get('results', []) if x.get('status') == 'ok')
   total = r.get('count', 0)
   print(f'autopsy batch: status={status} ok={ok}/{total}')
   sys.exit(0 if status == 'ok' else 1)
   " || echo 'MemPalace persistence failed — findings.md still written; cross-audit trend query will be incomplete'
   ```

   **Why KG facts (not just markdown):** Markdown-only findings make every cross-audit query a regex-grep across `MEMORY/WORK/*-council-audit-auto/findings.md`. KG facts let `kg_query_predicate(predicate="new_pattern")` and `kg_query(subject_prefix="audit:cadenced-")` return structured trend lines across all prior audits without re-parsing markdown. This is what makes "find every audit that flagged the same anti-pattern in the last 90 days" a one-shot bridge call instead of a corpus scan.

   **Fallback:** If the bridge is unavailable, skip this step and log `kg_persistence: skipped` in findings.md frontmatter. Markdown findings remain SoT until the next audit fires.

7. **Emit notification.** Voice announcement: `bash "$DOS_DIR/DOS/Tools/voice.sh" main "Council audit complete — N findings, M new patterns."`

8. **Studio post.** POST the findings to `/api/v1/work` for dashboard visibility (fire-and-forget per StudioSync pattern).

## Repeatability invariant

Prompt files have a `version:` field in frontmatter. Changes to a prompt MUST bump its version. The synthesized findings report records each prompt's version so trend comparisons stay apples-to-apples. If any prompt version changes between consecutive audits, the diff step MUST note the prompt-version delta rather than flag false "new patterns" that are actually measurement changes.

## Failure modes + mitigations

- **Agent spawn fails** → retry once with the same prompt; on second failure, log to findings.md under "degraded" and proceed.
- **MemPalace bridge unavailable** (WORK+Palace agent) → run without KG queries; mark kg_health fields as "unavailable" in findings.
- **Previous audit missing** → skip diff step; mark this as the baseline run.
- **Findings path collision** → append `-b`, `-c`, ... suffix. Always preserve prior.
