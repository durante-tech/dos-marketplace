---
name: Blog Post
description: Author a standalone blog post with mandatory metered research as Step 1
status: STABLE
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Step-intent -> fixed gate-tool invocations (VerifyResearchVault.ts / VerifyUrlBatch.ts / NextDispatchOrder.ts / LogArtifact.ts) — deterministic exit-code gates, no intent-variant flags to map; the section documents which tool serves which pipeline step, not the canonical Mode Selection flag-shape."
bestPath:
  - title: "Mandatory Research Gate"
    description: "Run metered research producing a cited vault; blocks the draft until it has 5+ citations."
  - title: "Outline & Draft"
    description: "Identify the single thesis and write prose with inline vault citations."
  - title: "URL Verification"
    description: "Verify every link returns HTTP 200 and drop any that fail."
  - title: "Frontmatter + Publish"
    description: "Resolve order, assemble frontmatter, get operator confirmation, generate hero image."
  - title: "Log Artifact"
    description: "Append the published post to MEMORY/ARTIFACTS/artifacts.jsonl."
---

# Blog Post Workflow

**Mode:** Mandatory metered Research → outline → draft → verify URLs → publish

## When to Use

- User says "write a blog post", "draft a blog", "blog post on X"
- Standalone post, not part of a weekly cadence
- Output: `apps/web/content/posts/{slug}.mdoc`

## Workflow

### Step 1: MANDATORY metered Research (cannot skip)

**INVOKE THIS NOW via the Skill tool. Even when the topic feels familiar (e.g., "we just shipped this, I know it cold"), Research is mandatory because (a) Studio metering is the visible telemetry that research happened, (b) external comparable context routinely surprises the author, (c) the research vault is reusable for follow-up posts.**

```
Skill("research", "Standard research on <topic>. Cover: prior art, comparable approaches, current discourse, dissenting takes. Output a research vault at MEMORY/RESEARCH/{YYYY-MM}/{slug}.md.")
```

Use **Quick** mode only when the post is a pure first-person retrospective on internal work where external research is genuinely supplementary. In all other cases use **Standard** (default, 4 metered subagents).

**Gate on the research vault before proceeding** — the same mechanical floor WeeklyDispatch enforces (parity, not honor-system). A non-zero exit BLOCKS the draft:

```bash
bun ~/.claude/skills/dispatch/Tools/VerifyResearchVault.ts check "MEMORY/RESEARCH/{YYYY-MM}/{slug}.md" --min-citations 5
```

Hard-gates the mechanical (vault exists · ≥ 5 distinct citations · not an empty stub); research QUALITY stays your judgment. If it FAILs, run another `Skill("research", …)` round — never draft on a thin vault (un-researched authoring is the exact failure mode this pack prevents).

### Step 2: Outline

Identify the single argument of the post. One thesis, one hook, 3-5 supporting beats. Cross-reference each beat to a vault citation.

### Step 3: Draft prose

Write with:
- Hook paragraph with the thesis
- One H2 section per supporting beat
- Inline `[text](url)` citations from the research vault — never invent a URL
- Code blocks where the post is technical
- A closing paragraph that names the implication for the reader

### Step 4: Verify EVERY URL

Per `Research/UrlVerificationProtocol.md`. The curl command shape and the pass/fail
decision (HTTP 200 passes, every other code drops) are pinned in
`Tools/VerifyUrlBatch.ts` (pure `isUrlVerified`/`buildVerifyCommand`, oracle-tested) so
the flags can't drift and the boundary can't be mis-read per run. Pass every link in
the draft:

```bash
bun ~/.claude/skills/dispatch/Tools/VerifyUrlBatch.ts verify "URL_1" "URL_2" ...
# Prints `PASS <code> <url>` / `FAIL <code> <url>` per line; exits non-zero if any FAIL.
```

Drop any link reported `FAIL`. The judgment is yours: if a dropped claim is load-bearing,
find an alternative source via the research vault or a fresh `Skill("research", "verify <claim>")` round.

### Step 5: Frontmatter + publish

Resolve the `order:` value deterministically against the live posts tree —
`Tools/NextDispatchOrder.ts` scans `apps/web/content/posts`, reads each post's `order:`
frontmatter, and returns max+1 (or 1 when empty), removing the per-run off-by-one /
collision risk of hand-picking "the next number":

```bash
ORDER=$(bun ~/.claude/skills/dispatch/Tools/NextDispatchOrder.ts next apps/web/content/posts)
```

Assemble the frontmatter, substituting `$ORDER` for the `order:` value:

```yaml
---
title: "<title>"
label: "<optional series label>"
description: "<2-3 sentence elevator>"
categories: ["<Category>"]
tags: ["<topic-1>", "<topic-2>", "<topic-3>"]
image: "/site/images/{slug}.webp"
publishedAt: {YYYY-MM-DD}
status: "published"
order: $ORDER
---
```

**Confirm before publishing.** The write target `apps/web/content/posts/{slug}.mdoc`
ships with `status: "published"`, so the Write goes live the moment it lands. Surface the
resolved path, the `$ORDER` value, and the title, and get explicit operator confirmation
(AskUserQuestion) BEFORE writing the `.mdoc`. Do not write the publish-target file
un-gated.

Then `Skill("media", "header image for <topic>...")` for the hero.

### Step 6: Log artifact

Append one JSONL line to `MEMORY/ARTIFACTS/artifacts.jsonl`. The line is rendered
deterministically by `Tools/LogArtifact.ts` (pure helper, golden-tested for byte-parity)
— pass the post title and the absolute `.mdoc` path with `--workflow BlogPost`
(`pack`/`type`/`wing` default to `dispatch` / `blog-post` / `durante`, timestamp defaults
to now UTC, sessionId defaults to `$CLAUDE_SESSION_ID`):

```bash
bun ~/.claude/skills/dispatch/Tools/LogArtifact.ts render "<title>" "<absolute path to .mdoc>" --workflow BlogPost >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

### Step 7: Return

Standard DOS output format.

## Intent-to-Flag Mapping

| Step intent | Command |
|---|---|
| Gate the research vault (Step 1) | `bun ~/.claude/skills/dispatch/Tools/VerifyResearchVault.ts check <vault-path> --min-citations 5` (exit 1 BLOCKS the draft) |
| Verify load-bearing URLs (Step 4) | `bun ~/.claude/skills/dispatch/Tools/VerifyUrlBatch.ts verify <url> [<url> ...]` (exit 1 on any non-200) |
| Resolve the next `order:` (Step 5) | `bun ~/.claude/skills/dispatch/Tools/NextDispatchOrder.ts next apps/web/content/posts` |
| Log the artifact (Step 6) | `bun ~/.claude/skills/dispatch/Tools/LogArtifact.ts render <title> <path> --workflow BlogPost` |

The gate verdicts are deterministic (exit codes); research QUALITY, the editorial argument, and the publish-confirmation decision stay your judgment.
