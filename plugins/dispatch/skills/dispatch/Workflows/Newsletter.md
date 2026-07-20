---
name: Newsletter
description: Author a curated newsletter with mandatory metered research as Step 1
status: STABLE
bestPath:
  - title: "Extensive Research Gate"
    description: "Run the 12-agent research fan-out producing a candidate pool; blocks curation until it has 15+ citations."
  - title: "Curate & Annotate"
    description: "Select 5-15 items by editorial priority and write a 2-4 sentence annotation for each."
  - title: "URL Verification"
    description: "Verify every item's link returns HTTP 200 and drop any that fail."
  - title: "Frontmatter + Publish"
    description: "Resolve order, assemble frontmatter, get operator confirmation, generate hero image."
  - title: "Log & Distribute"
    description: "Log the artifact entry and optionally distribute via social-media."
---

# Newsletter Workflow

**Mode:** Mandatory extensive metered Research → curate → annotate → publish

## When to Use

- User says "newsletter", "this week's newsletter", "send a newsletter"
- Curation-heavy: 5-15 items with brief annotations, not a single argument
- Higher source-volume requirement than blog posts or dispatches
- Output: `apps/web/content/posts/newsletter-{YYYY-MM-DD}-{slug}.mdoc` (or wherever the newsletter pipeline expects)

## Workflow

### Step 1: MANDATORY extensive metered Research (cannot skip)

**INVOKE THIS NOW via the Skill tool with EXTENSIVE mode (12 agents) — newsletters need wide source coverage, not depth on a single topic.**

```
Skill("research", "Extensive research on <newsletter theme>. Output: 15-25 high-quality candidate items with verified URLs at MEMORY/RESEARCH/{YYYY-MM}/{slug}-newsletter-candidates.md. Each item: title, source URL, 1-line summary, why-it-matters note.")
```

This will spawn the full 12-agent fan-out (4 backends × 3 query variants). Studio meters every call. The output vault contains the candidate pool — you will curate down to the final 5-15 items in Step 2.

**Gate on the candidate vault before curating** — a roundup needs a deep candidate pool, so the floor is higher (≥ 15 citations). A non-zero exit BLOCKS curation (parity with WeeklyDispatch/BlogPost — the headline research mandate is mechanically enforced):

```bash
bun ~/.claude/skills/dispatch/Tools/VerifyResearchVault.ts check "MEMORY/RESEARCH/{YYYY-MM}/{slug}.md" --min-citations 15
```

Hard-gates the mechanical (vault exists · ≥ 15 distinct citations · not an empty stub); which items are newsletter-worthy stays your judgment in Step 2. If it FAILs, widen the query basket and re-run the fan-out — never curate a thin pool.

### Step 2: Curate

Read the candidate vault. Apply newsletter judgment:
- Keep items where the why-it-matters is sharp
- Drop items where the URL is paywalled, dead, or unreliable
- Drop items that are weeks old unless they're load-bearing context
- Order by editorial priority — top item is the one you most want the reader to click

Target final list: 5-15 items.

### Step 3: Annotate

For each kept item, write a 2-4 sentence annotation that:
- States what happened in plain language (no jargon for jargon's sake)
- Names the implication for the reader
- Links the source URL inline with the title or the first relevant noun

### Step 4: Verify EVERY URL

Per `Research/UrlVerificationProtocol.md`. The curl command shape and the pass/fail
decision (HTTP 200 passes, every other code drops) are pinned in
`Tools/VerifyUrlBatch.ts` (pure `isUrlVerified`/`buildVerifyCommand`, oracle-tested) so
the flags can't drift and the boundary can't be mis-read per run. Pass every item's link:

```bash
bun ~/.claude/skills/dispatch/Tools/VerifyUrlBatch.ts verify "URL_1" "URL_2" ...
# Prints `PASS <code> <url>` / `FAIL <code> <url>` per line; exits non-zero if any FAIL.
```

Drop any item reported `FAIL`. The judgment is yours: if a dropped item is load-bearing,
find an alternative source via the candidate vault or a fresh `Skill("research", "verify <claim>")` round.

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
title: "<newsletter title>"
label: "Newsletter · Issue NN"
description: "<2-3 sentence elevator>"
categories: ["Newsletter"]
tags: ["newsletter", "<topic-1>", "<topic-2>"]
image: "/site/images/newsletter-{YYYY-MM-DD}-{slug}.webp"
publishedAt: {YYYY-MM-DD}
status: "published"
order: $ORDER
---
```

**Confirm before publishing.** The write target
`apps/web/content/posts/newsletter-{YYYY-MM-DD}-{slug}.mdoc` ships with
`status: "published"`, so the Write goes live the moment it lands. Surface the resolved
path, the `$ORDER` value, and the issue title, and get explicit operator confirmation
(AskUserQuestion) BEFORE writing the `.mdoc`. Do not write the publish-target file
un-gated.

Then `Skill("media", "header image for newsletter on <theme>...")` for the hero.

### Step 6: Log artifact

Append one JSONL line to `MEMORY/ARTIFACTS/artifacts.jsonl`. The line is rendered
deterministically by `Tools/LogArtifact.ts` (pure helper, golden-tested for byte-parity)
— pass the newsletter title and the absolute `.mdoc` path with `--workflow Newsletter
--type newsletter` (`pack`/`wing` default to `dispatch` / `durante`, timestamp defaults
to now UTC, sessionId defaults to `$CLAUDE_SESSION_ID`):

```bash
bun ~/.claude/skills/dispatch/Tools/LogArtifact.ts render "<title>" "<absolute path to .mdoc>" --workflow Newsletter --type newsletter >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

### Step 7: Distribute (optional)

If the newsletter is also being mailed:
```
Skill("social-media", "share newsletter <title> as a LinkedIn post")
```

Or whatever the operator's distribution chain is. The Studio public blog is the canonical archive.

### Step 8: Return

Standard DOS output format including: items kept count, URLs verified count, total Studio credits charged.

## Intent-to-Flag Mapping

| Step intent | Command |
|---|---|
| Gate the candidate vault before curating (Step 1) | `bun ~/.claude/skills/dispatch/Tools/VerifyResearchVault.ts check <vault-path> --min-citations 15` (exit 1 BLOCKS curation) |
| Verify every item's URL (Step 4) | `bun ~/.claude/skills/dispatch/Tools/VerifyUrlBatch.ts verify <url> [<url> ...]` (exit 1 on any non-200) |
| Resolve the next `order:` (Step 5) | `bun ~/.claude/skills/dispatch/Tools/NextDispatchOrder.ts next apps/web/content/posts` |
| Log the artifact (Step 6) | `bun ~/.claude/skills/dispatch/Tools/LogArtifact.ts render <title> <path> --workflow Newsletter --type newsletter` |

The gate verdicts are deterministic (exit codes); which items are newsletter-worthy and the publish-confirmation decision stay your judgment.
