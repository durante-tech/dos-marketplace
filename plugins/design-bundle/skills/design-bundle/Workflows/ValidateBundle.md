---
name: ValidateBundle
description: Re-validate an already-assembled `claude-design-system-bundle/` without rebuilding it — assert the canonical DESIGN.md (9 VoltAgent sections), the multi-format token files (DTCG + shadcn + sandbox CSS), and the required context / intelligence / copy / press / meta / review artifacts are present, well-formed, and internally consistent. Read-only sibling to RunPipeline; emits a PASS/FAIL matrix, never mutates the bundle (unless `report:true`).
status: STABLE
bestPath:
  - title: "Resolve Bundle Root"
    description: "Locate the bundle directory from the given path or auto-detect it under the fork or cwd."
  - title: "Structural & Schema Checks"
    description: "Verify the required root files/dirs and the DESIGN.md 9-section schema are present."
  - title: "Token & Consistency Checks"
    description: "Validate the multi-format token files (DTCG/shadcn/sandbox CSS) and cross-file invariants."
  - title: "Verdict & Optional Report"
    description: "Render the PASS/FAIL matrix and, if `report:true`, write VALIDATION.md into the bundle."
---

# ValidateBundle Workflow

## When to Use

- Operator says "validate bundle", "check design bundle", "re-validate bundle", "is the bundle complete"
- An already-assembled `claude-design-system-bundle/` needs re-checking without rebuilding it — before dragging it into the Claude Design System form, or as a CI gate
- NOT for assembling or repairing a bundle (use RunPipeline) — this workflow is read-only by default

**Purpose:** A bundle is a long-lived artifact — it is edited by hand, re-consumed by Claude Design, and drifts. RunPipeline *assembles* the bundle; ValidateBundle *re-checks an existing one* so an operator (or a CI gate) can answer "is this bundle still complete and consistent?" before dragging it back into the Claude Design System form. It is the read-only sibling to RunPipeline: same canonical structure, same invariants, zero writes by default.

<!-- partial: _workflow-voice.md skill_name=DesignBundle workflow_name=ValidateBundle action_phrase="re-validate an assembled design-system bundle" -->


**Purpose:** A bundle is a long-lived artifact — it is edited by hand, re-consumed by Claude Design, and drifts. RunPipeline *assembles* the bundle; ValidateBundle *re-checks an existing one* so an operator (or a CI gate) can answer "is this bundle still complete and consistent?" before dragging it back into the Claude Design System form. It is the read-only sibling to RunPipeline: same canonical structure, same invariants, zero writes by default.

<!-- partial: _workflow-voice.md skill_name=DesignBundle workflow_name=ValidateBundle action_phrase="re-validate an assembled design-system bundle" -->

## Args Contract (structured JSON)

Pass **structured JSON, not prose** — a freeform string degrades to auto-detect-and-prompt. Shape:

```json
{
  "workflow": "ValidateBundle",
  "bundle_path": "/abs/path/to/claude-design-system-bundle",
  "strict": true,
  "checks": ["structure", "design-md", "tokens", "consistency", "floor"],
  "report": false
}
```

| Field | Required | Default | Meaning |
|---|---|---|---|
| `bundle_path` | **yes** | — | Absolute path to the bundle dir, OR to its parent fork repo (then `claude-design-system-bundle/` is appended). Fail closed if neither resolves to a directory. |
| `strict` | no | `true` | `true` → any FAIL makes the run exit non-zero (CI-gate mode). `false` → report FAILs but exit 0 (advisory mode). |
| `checks` | no | all five | Subset of `structure · design-md · tokens · consistency · floor` to run. |
| `report` | no | `false` | `true` → ALSO write `VALIDATION.md` into the bundle root (the only write this workflow ever performs) and log an artifact. `false` → surface the matrix in the response only (pure read-only). |

Unknown keys are ignored. If invoked with no `bundle_path`, auto-detect: use `claude-design-system-bundle/` under `git rev-parse --show-toplevel`, else under cwd; if neither exists, ask the operator for the path (`AskUserQuestion`) rather than guessing.

## Trigger Gate

ValidateBundle does NOT assemble or repair — it only inspects. If the bundle is missing entirely, it reports `BUNDLE NOT FOUND` and points the operator at RunPipeline; it never silently falls through to assembly.

## V0 — Resolve the bundle root

```bash
ARG_PATH="<bundle_path from args>"
if [ -d "$ARG_PATH/claude-design-system-bundle" ]; then
  BUNDLE="$ARG_PATH/claude-design-system-bundle"
elif [ -d "$ARG_PATH" ] && [ -f "$ARG_PATH/DESIGN.md" ]; then
  BUNDLE="$ARG_PATH"
elif [ -d "$ARG_PATH" ]; then
  BUNDLE="$ARG_PATH"   # dir given but DESIGN.md absent — structure check will catch it
else
  echo "⛔ BUNDLE NOT FOUND at '$ARG_PATH' — run the RunPipeline workflow to assemble one first."; exit 2
fi
echo "validating bundle: $BUNDLE"
PASS=0; FAIL=0
ok(){ echo "✓ $1"; PASS=$((PASS+1)); }
bad(){ echo "✗ $1"; FAIL=$((FAIL+1)); }
```

Every check below increments `PASS`/`FAIL` via `ok`/`bad` so V8 can render the verdict deterministically.

## V1 — `structure` — required tree + root files

Assert the always-fire skeleton RunPipeline emits (D1–D18):

```bash
# Root files
for f in DESIGN.md README.md FORM_FILL.md; do
  [ -f "$BUNDLE/$f" ] && ok "root/$f present" || bad "root/$f MISSING"
done
# Required dirs
for d in context code intelligence copy press meta review delta-reference assets; do
  [ -d "$BUNDLE/$d" ] && ok "$d/ present" || bad "$d/ MISSING"
done
# Context legs 01–10 (the three missing-leg files 08/09/10 are load-bearing)
for n in 01 02 03 04 05 06 07 08 09 10; do
  m=$(ls "$BUNDLE/context/$n-"*.md 2>/dev/null | head -1)
  [ -n "$m" ] && ok "context/$n-* present" || bad "context/$n-* MISSING"
done
# Sub-bundle file counts (skip-clean dirs still need their always-fire floor)
[ "$(ls "$BUNDLE/intelligence/"*.md 2>/dev/null | wc -l)" -ge 8 ] && ok "intelligence/ ≥8 files" || bad "intelligence/ below 8-file floor"
[ "$(ls "$BUNDLE/copy/"*.md 2>/dev/null | wc -l)" -ge 4 ] && ok "copy/ ≥4 files" || bad "copy/ below 4-file floor"
[ "$(ls "$BUNDLE/press/"*.md "$BUNDLE/press/"*/*.md 2>/dev/null | wc -l)" -ge 5 ] && ok "press/ ≥5 files" || bad "press/ below 5-file floor (note: skip-clean if Phase C scope was marketing-only)"
[ "$(ls "$BUNDLE/meta/"*.md 2>/dev/null | wc -l)" -ge 3 ] && ok "meta/ ≥3 files" || bad "meta/ below 3-file floor"
[ "$(ls "$BUNDLE/review/"*.md 2>/dev/null | wc -l)" -ge 4 ] && ok "review/ ≥4 files" || bad "review/ below 4-file floor"
```

## V2 — `design-md` — the canonical 9 sections

The DESIGN.md is the wire format for the Claude Design form (RunPipeline D10). All 9 sections MUST be present:

```bash
D="$BUNDLE/DESIGN.md"
for sec in "Visual Theme" "Color Palette" "Typography" "Component Styling" "Layout Principles" "Depth" "Do" "Responsive" "Agent Prompt"; do
  grep -qi "$sec" "$D" 2>/dev/null && ok "DESIGN.md §'$sec'" || bad "DESIGN.md missing §'$sec'"
done
```

(Match is case-insensitive substring against the section headings — `Do` covers "Do's and Don'ts", `Depth` covers "Depth & Elevation".)

## V3 — `tokens` — three converged formats, well-formed

RunPipeline D11 emits the token system in DTCG + shadcn + sandbox-CSS. Re-assert presence AND machine-validity:

```bash
T="$BUNDLE/code/tokens.json"; R="$BUNDLE/code/registry.json"; S="$BUNDLE/code/tokens-sandbox.css"
# DTCG tokens.json: valid JSON + carries DTCG $value tokens
if [ -f "$T" ] && python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$T" 2>/dev/null; then
  grep -q '\"\$value\"' "$T" && ok "tokens.json valid DTCG (has \$value)" || bad "tokens.json valid JSON but not DTCG-shaped (no \$value)"
else bad "tokens.json MISSING or invalid JSON"; fi
# shadcn registry.json: valid JSON + carries cssVars
if [ -f "$R" ] && python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$R" 2>/dev/null; then
  grep -q 'cssVars' "$R" && ok "registry.json valid shadcn (has cssVars)" || bad "registry.json valid JSON but missing cssVars"
else bad "registry.json MISSING or invalid JSON"; fi
# sandbox CSS exists
[ -f "$S" ] && ok "tokens-sandbox.css present" || bad "tokens-sandbox.css MISSING"
# Curated source CSS the bundle is built on
for c in theme.css globals.css custom.css ui-exports.json; do
  [ -f "$BUNDLE/code/$c" ] && ok "code/$c present" || bad "code/$c MISSING"
done
```

## V4 — `consistency` — the invariants that prose loses to gravity

These are the cross-file rules RunPipeline encodes; they are exactly the ones a hand-edit silently breaks:

```bash
# 1. FORM_FILL.md Notes field MUST point at the creative brief (RunPipeline D2)
grep -q '07-creative-brief' "$BUNDLE/FORM_FILL.md" && ok "FORM_FILL.md references context/07-creative-brief.md" || bad "FORM_FILL.md does NOT reference 07-creative-brief.md (Notes field rule)"
# 2. The rename invariant: delta-reference/ exists, brand-direction/ does NOT (D13)
if [ -d "$BUNDLE/delta-reference" ] && [ ! -d "$BUNDLE/brand-direction" ]; then ok "delta-reference/ rename applied (no stale brand-direction/)"; else bad "rename invariant broken — brand-direction/ still present or delta-reference/ absent"; fi
# 3. DELTA.md present — names the institutional inversions
[ -f "$BUNDLE/delta-reference/DELTA.md" ] && ok "delta-reference/DELTA.md present" || bad "delta-reference/DELTA.md MISSING (the rule-in-the-first-file)"
# 4. No secrets ever land in the bundle (D6 exclude rule)
if find "$BUNDLE" -name '.env*' -o -name '*.pem' -o -name 'id_rsa*' 2>/dev/null | grep -q .; then bad "secret-shaped file found inside bundle — D6 exclude rule violated"; else ok "no secret-shaped files in bundle"; fi
# 5. App code is untouched: the bundle is a sibling folder, never apps/* or packages/*
case "$BUNDLE" in *apps/*|*packages/*) bad "bundle path is inside apps/ or packages/ — sibling-folder invariant violated";; *) ok "bundle is a sibling folder (not under apps/ or packages/)";; esac
```

## V5 — `floor` — always-fire file count

Mirror RunPipeline E3: assert the floor, not a stale literal. A count below the always-fire floor means a D-step's output was deleted or never written.

```bash
COUNT=$(find "$BUNDLE" -type f | wc -l | tr -d ' ')
echo "bundle file count: $COUNT"
[ "$COUNT" -ge 50 ] && ok "file count $COUNT ≥ 50 always-fire floor" || bad "file count $COUNT below the ~50-file always-fire floor — a D-step output is missing"
```

## V8 — Verdict

```bash
echo "────────────────────────────"
echo "ValidateBundle: $PASS passed, $FAIL failed."
if [ "$FAIL" -eq 0 ]; then
  echo "✅ VALID — bundle is form-ready."
else
  echo "❌ INVALID — $FAIL check(s) failed (see ✗ lines above)."
fi
# strict mode (default) → non-zero exit on any failure, for CI gating
if [ "$FAIL" -gt 0 ] && [ "${STRICT:-true}" = "true" ]; then exit 1; fi
```

Surface a compact matrix in the final response: one row per check group (`structure · design-md · tokens · consistency · floor`) with PASS/FAIL and the failing items, plus the `$PASS`/`$FAIL` totals and the resolved `$BUNDLE` path. ValidateBundle does NOT edit the bundle to fix failures — it reports them; remediation is a deliberate RunPipeline re-run or a hand edit.

## Report mode (`report:true` — the only write)

When `report:true`, ALSO write the matrix to `"$BUNDLE/VALIDATION.md"` (timestamped, with the PASS/FAIL table and the resolved path) so the verdict travels with the bundle. This is the single Write this workflow performs; with `report:false` (default) the workflow is pure read-only.

## Invariants (CRITICAL)

1. **Read-only by default.** No bundle file is mutated unless `report:true` (which writes only `VALIDATION.md`).
2. **Assert floors, not literals.** Bundle file counts grow with active-fork captures; gate on the always-fire floor (≥50), never a stale exact count — this is the E3 lesson.
3. **Never fall through to assembly.** A missing bundle is a reported failure pointing at RunPipeline, not a trigger to build one.
4. **Same canonical structure as RunPipeline.** When RunPipeline's D-steps change, this workflow's checks must move with them — they describe the same artifact.

## Artifact Tracking

Read-only by default → this section is informational. When `report:true`, after writing `VALIDATION.md` append one JSONL line:

```bash
if [ -d "${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS" ]; then ARTIFACTS_DIR="${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS";
elif [ -d "$(pwd)/MEMORY/ARTIFACTS" ]; then ARTIFACTS_DIR="$(pwd)/MEMORY/ARTIFACTS";
else ARTIFACTS_DIR="$HOME/.claude/MEMORY/ARTIFACTS"; fi
mkdir -p "$ARTIFACTS_DIR"
echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"DesignBundle","workflow":"ValidateBundle","type":"design-bundle","title":"bundle validation report","path":"'$BUNDLE'/VALIDATION.md","contentPreview":"'$PASS' passed / '$FAIL' failed","wing":"<company-slug>","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

## Done

Verdict reported (`VALID` / `INVALID`) with the per-group PASS/FAIL matrix and the resolved bundle path. In strict mode the exit code gates CI; in advisory mode the operator decides whether to re-run RunPipeline.
