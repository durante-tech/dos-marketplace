/loop

════════════════════════════════════════════════════════════════
  RFC Delivery — {{RFC_ID}} :: {{SLICE_HEADING}}
  Source: {{RFC_FILE}} (line {{SLICE_LINE}})
  Effort: {{EFFORT}}
  Slug:   {{SLUG}}
  Workdir: {{WORK_DIR}}/{{SLUG}}/
════════════════════════════════════════════════════════════════

## Task

Deliver the RFC slice reproduced verbatim below. The PRD stub is already pre-committed at `{{WORK_DIR}}/{{SLUG}}/PRD.md` — your job is to populate it through the Algorithm phases and ship the slice.

## RFC excerpt (inlined — no external lookup required)

```markdown
{{SLICE_BODY}}
```

## ISC seed (decompose to atomic in OBSERVE)

{{ISC_LINES}}

## Constitutional rails (non-negotiable)

1. **Four-copy rule.** If the slice touches files that exist in pack / live / submodule, update all applicable copies. After any multi-copy edit, run:
   ```bash
   bun ~/Durante/Tools/sync-check.ts --summary
   ```
   Exit 0 is required before commit. Use `--fix --dry-run` then `--fix` on drift.

2. **Submodule-first commit order.** Commit inside the active release submodule (`Releases/<active-version>/.claude`, reachable as `~/.claude`) first, then the parent repo.

3. **Voice-lint exempt pragma.** When the slice cites banned vocabulary inside Clause-style normative statements, wrap with `<!-- brand-voice:exempt -->` exactly as RFC-0008 Clause 8 demonstrates.

4. **Commit attribution.** Do NOT manually add Co-Authored-By lines to commit heredocs — the global `attribution` setting in `~/.claude/settings.json` handles it.

5. **No backwards-compat shims.** If the slice removes something, remove it — don't leave renamed `_vars`, re-exports, or `// removed` comments.

6. **Surgical scope.** Only touch files the slice requires. Bundle bonus refactors into a separate commit and ask first.

## Completion gates (run before declaring done at VERIFY)

- ```bash
  bun ~/Durante/Tools/sync-check.ts --summary
  ```
- Typecheck the modified surface:
  ```bash
  bun x tsc --noEmit   # or the pack-appropriate equivalent
  ```
- Run affected tests (contract tests for schema slices, unit tests for logic slices).
- PRD `progress: N/N` with every ISC ticked; PRD `phase: complete`.

## Reflection JSONL (LEARN phase — mandatory for Standard+ effort)

Append one line:

```bash
python3 ~/.claude/DOS/Tools/mempalace_bridge.py append_reflection '{"entry":{"timestamp":"<ISO>","effort_level":"{{EFFORT}}","task_description":"<from TASK line>","criteria_count":<N>,"criteria_passed":<N>,"criteria_failed":0,"prd_id":"{{SLUG}}","implied_sentiment":<1-10>,"reflection_q1":"<>","reflection_q2":"<>","reflection_q3":"<>","within_budget":true}}'
```
(RFC-0148: raw `echo >>` appends are withdrawn — the bridge gate validates the shape and returns `expected_shapes` to self-correct against on rejection.)

════════════════════════════════════════════════════════════════
End of /loop block.
════════════════════════════════════════════════════════════════
