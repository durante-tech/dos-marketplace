---
name: Survey
description: Surface-crunch a project dependency tree for new releases, CVEs, and breaking changes.
status: STABLE
---

<!-- minted-by: CrunchScaffold v0.1.0 | brief-hash: f2904c | 2026-05-20T15:02:51Z -->

# Survey Workflow — a Surface Crunch over dependency releases, CVEs and breaking changes in a project dependency tree

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the Survey workflow in the DepWatch skill to crunch dependency releases, CVEs and breaking changes in a project dependency tree"
```

Running the **Survey** workflow in the **DepWatch** skill...

This workflow runs the **Surface Crunch** pattern: enumerate Surfaces → fan out
extraction Threads under contract → converge into a 4-tier ranked report.
Pattern doctrine: `MEMORY/CANONICAL/surface-crunch-pattern.md`.

---

## Step 1: Launch Threads in parallel

Spawn parallel extraction Threads (`Task`, `subagent_type: general-purpose`), up to
`6` per Outward Surface (shard a wide Surface across Threads). The Inward Surface is a
single Thread — one deterministic inventory enumeration. The bifocal mode for this
skill is `yes`.

### Inward Surface Threads

Look INWARD — who/what we are. Inward Surfaces for this skill: the repo package.json and lockfile — the installed dependency set.

For EACH Inward Surface, dispatch a Thread under this **Extraction Contract**:
> Return concrete, quoted artifacts — never a summary. Each item: what it is, where
> it came from (exact source + locator), and which Target it maps to. If a Surface
> yields no concrete artifact, return `skipped: <reason>` — do not dilute with prose.

Enumerate every installed dependency from `package.json` + the lockfile. Return one
JSON object per dependency: `{"name": "<pkg>", "ecosystem": "npm", "current_version":
"<semver>", "dependency_type": "direct" | "transitive", "declared_range": "<range from
package.json, or null for transitive>"}`. This inventory is the **Target set** — every
Outward Thread maps its findings onto a package in this list; findings for packages
not in the list are dropped.

### Outward Surface Threads

Look OUTWARD — what is out there. Outward Surfaces for this skill: npm and GitHub security advisories; dependency GitHub releases and changelogs; deprecation notices.

For EACH Outward Surface, dispatch a Thread under this **Extraction Contract**:
> Return concrete, quoted artifacts — never a summary. Each item: what it is, where
> it came from (exact source + locator), and which Target it maps to. If a Surface
> yields no concrete artifact, return `skipped: <reason>` — do not dilute with prose.

Per Outward Surface, return one JSON object per finding that maps to a package in the
inward inventory (skip findings for packages not installed): `{"package": "<name>",
"ecosystem": "npm", "kind": "cve" | "release" | "breaking" | "deprecation", "id": "<advisory ID / release
tag / changelog version>", "severity": "critical" | "high" | "moderate" | "low" |
"n/a", "affected_range": "<semver range, or null>", "fixed_version": "<version, or
null>", "summary": "<one line quoted from the source>", "source_url": "<exact link>"}`.
If a Surface yields nothing for the inventory, return `skipped: <reason>`.

---

## Step 2: Cross-run State dedup

Before converging, drop Extractions already surfaced in a prior run. Read
runtime-created `State/seen-extractions.json` in this skill's own directory; compare each Extraction's
dedup key against the `seen` array and keep only what is **new since the last run**.
See `State/README.md` for the file shape. The **dedup key** is the triple
`ecosystem:package:id` (e.g. `npm:lodash:GHSA-abcd` or `npm:react:v19.0.0`) — an
Extraction is the same across runs iff this triple matches.

---

## Step 3: Converge → score → Tier

Merge all Thread returns. Score each Extraction, then bucket into **4
tiers**: 🔴 CRITICAL, 🟠 HIGH, 🟡 MEDIUM, 🟢 LOW.

**Scoring rubric** — score each Extraction on three 1-10 axes:
- **relevance** — is the package installed AND does `current_version` fall inside the
  finding's `affected_range`? In-range = 9-10; out-of-range or already past
  `fixed_version` = 1-2; a release/deprecation for an installed package = 6-8.
- **impact** — security CVE by CVSS band (critical = 10, high = 8, moderate = 5,
  low = 3); breaking change = 7; deprecation = 5; minor/feature release = 2-3.
- **effort** — inverse difficulty (10 = easy): patch-version bump = 10; minor bump =
  7; major bump or breaking migration = 2-4.

`score = (relevance × 2) + impact + effort`  (range 4-40).

**Tier thresholds** —
- 🔴 CRITICAL — `score ≥ 30`, OR any in-range critical/high CVE regardless of score
- 🟠 HIGH — `score 22-29`
- 🟡 MEDIUM — `score 14-21`
- 🟢 LOW — `score < 14`

The interestingness ordering of *discoveries* is NOT the same as the priority
ordering of *recommendations* — keep them as separate orderings.

---

## Step 4: Emit the report — Discoveries first, Recommendations second, Detail third

**Anti-summary doctrine (verbatim — do not weaken):**
> Every output item must be a concrete artifact — a technique, a quote, a finding —
> not a recommendation to go look. Quote or block the actual content. Map every item
> to a named Target. If content has no extractable artifact, skip it with a reason;
> never dilute the report with vague summaries.

```markdown
# DepWatch — Surface Crunch Report
**Generated:** [timestamp]   **Surfaces:** [N inward / N outward]   **New since last run:** [N]

## ✨ Discoveries
| # | Discovery | Surface | Why it matters | Target |
|---|-----------|---------|----------------|--------|

## 🔥 Recommendations

### 🔴 CRITICAL — patch now
| # | Recommendation | Why | Effort | Package |
|---|----------------|-----|--------|---------|

### 🟠 HIGH — patch this week
| # | Recommendation | Why | Effort | Package |
|---|----------------|-----|--------|---------|

### 🟡 MEDIUM — schedule
| # | Recommendation | Why | Effort | Package |
|---|----------------|-----|--------|---------|

### 🟢 LOW — awareness
| # | Recommendation | Why | Effort | Package |
|---|----------------|-----|--------|---------|

## 🎯 Detail
[Per item: the quoted Extraction, the exact source locator, the mapped Target.]

## ⏭️ Skipped
[Surface / why no extractable artifact.]
```

---

## Step 5: Update State

Append the dedup key of every newly-surfaced Extraction to runtime-created `State/seen-extractions.json`
so the next run dedups against them.

**Quick mode** (`"CVEs only"`) — run only the advisory Outward Threads and emit only
the 🔴 CRITICAL tier; skip the release / changelog / deprecation Surfaces.

**Error handling** — if `package.json` or the lockfile is unreadable, abort with a
clear message: the inward inventory is required (it is the Target set). If an Outward
Surface is rate-limited or unreachable, mark it `skipped` in the report's ⏭️ Skipped
section rather than failing the whole run.
