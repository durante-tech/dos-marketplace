---
name: Weekly Dispatch
description: Author a weekly dispatch (Sunday-style retrospective on the week's events) with mandatory metered research as Step 1
status: STABLE
bestPath:
  - title: "Mandatory Research Gate"
    description: "Run extensive metered research producing a cited vault; blocks the draft until it has 5+ citations."
  - title: "Outline Against the Vault"
    description: "Identify the week's hook, supporting threads, and contrarian counter-thread."
  - title: "Draft Prose"
    description: "Write the dispatch body with inline citations and a callout signal block."
  - title: "URL Verification"
    description: "Verify every link returns HTTP 200 and drop any that fail."
  - title: "Publish & Log"
    description: "Resolve order, assemble frontmatter, confirm, generate hero image, log artifact."
---

# Weekly Dispatch Workflow

**Mode:** Mandatory metered Research → outline → draft → verify URLs → publish

## When to Use

- User says "weekly dispatch", "this week's dispatch", "weekend dispatch"
- Sunday-style retrospective covering 5-day windows
- Events synthesized into a single narrative thread
- Output: `apps/web/content/posts/dispatch-{YYYY-MM-DD}-{slug}.mdoc`

## Workflow

### Step 1: MANDATORY metered Research (cannot skip)

**INVOKE THIS NOW via the Skill tool — do not paraphrase, do not write prose first, do not assume training-data knowledge is sufficient.**

```
Skill("research", "Extensive research on <the week's topic>. Cover: primary sources, official announcements, partner reactions, comparable prior events, dissenting takes. Output a research vault at MEMORY/RESEARCH/{YYYY-MM}/{YYYY-MM-DD}_{slug}.md with verified URLs.")
```

The research skill will spawn metered subagents (BraveResearcher, PerplexityResearcher, ClaudeResearcher, GeminiResearcher) that hit `/api/v1/inference/perplexity/messages`, `/api/v1/search/brave/web`, etc. Studio meters every call. The output vault file is the substrate for Steps 2-N.

**Do not proceed to Step 2 until the research-vault gate passes.** This is the pack's headline invariant ("mandatory metered research") — it is mechanically enforced, not honor-system. Run the gate; a non-zero exit BLOCKS the draft:

```bash
bun ~/.claude/skills/dispatch/Tools/VerifyResearchVault.ts check "MEMORY/RESEARCH/{YYYY-MM}/{YYYY-MM-DD}_{slug}.md" --min-citations 5
```

It hard-gates the mechanical (vault exists · ≥ 5 distinct citations · not an empty stub). It does NOT judge research QUALITY — whether the citations are primary / on-topic / non-circular is your judgment (the same posture as the URL-gate's "the judgment is yours"). If it FAILs, run another `Skill("research", …)` round; never hand-wave past it.

### Step 2: Outline against the research vault

Read the vault file produced by Step 1. Identify:
- The single most consequential event of the week (the "hook")
- 2-4 supporting threads that connect to the hook
- The contrarian counter-thread (what's the dissenting frame?)
- The implication for the reader (indie founder / operator / builder)

Sketch the outline in `MEMORY/WORK/{slug}/outline.md` with one heading per thread and 2-3 bullet citations per heading drawn from the vault.

### Step 3: Draft prose

Write the dispatch body with:
- Single hook paragraph leading the headline event
- One H2 section per supporting thread, ordered by consequence
- Inline `[anchor text](url)` citations on every external claim — URLs MUST come from the research vault
- A "callout" block surfacing the week's signal in one sentence (use `{% callout type="warning" title="..." %}`)
- Closing implication tying threads back to the reader's situation

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

Resolve the `order:` value deterministically — `Tools/NextDispatchOrder.ts` scans the
posts dir, reads each post's `order:` frontmatter, and returns max+1 (or 1 when empty),
removing the per-run off-by-one / collision risk of hand-picking "the next number":

```bash
ORDER=$(bun ~/.claude/skills/dispatch/Tools/NextDispatchOrder.ts next apps/web/content/posts)
```

Write the final `.mdoc` to `apps/web/content/posts/dispatch-{YYYY-MM-DD}-{slug}.mdoc`,
substituting `$ORDER` for the `order:` value:

```yaml
---
title: "<title>"
label: "Weekly Dispatch · Week NN"
description: "<2-3 sentence elevator>"
categories: ["Dispatch"]
tags: ["weekly-dispatch", "<topic-1>", "<topic-2>"]
image: "/site/images/dispatch-{YYYY-MM-DD}-{slug}.webp"
publishedAt: {YYYY-MM-DD}
status: "published"
order: $ORDER
---
```

Then invoke `Skill("media", "header image for <topic>...")` to generate the hero — Media routes through `/api/v1/media/*` so image generation is metered.

### Step 6: Log artifact

Append one JSONL line to `MEMORY/ARTIFACTS/artifacts.jsonl`. The line is rendered
deterministically by `Tools/LogArtifact.ts` (pure helper, golden-tested for byte-parity)
— pass the dispatch title and the absolute `.mdoc` path; pack/workflow/type/wing default
to `dispatch` / `WeeklyDispatch` / `blog-post` / `durante`, timestamp defaults to now (UTC),
and sessionId defaults to `$CLAUDE_SESSION_ID`:

```bash
bun ~/.claude/skills/dispatch/Tools/LogArtifact.ts render "<title>" "<absolute path to .mdoc>" >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

### Step 7: Return

Standard DOS output format with summary, source count, citation count, credits charged via Studio.

## Intent-to-Flag Mapping

The deterministic steps shell tested gate-tools in `Tools/` — translate the workflow step into the exact CLI:

| Step intent | Command |
|---|---|
| Gate the research vault (Step 1) | `bun ~/.claude/skills/dispatch/Tools/VerifyResearchVault.ts check <vault-path> --min-citations 5` (exit 1 BLOCKS) |
| Verify load-bearing URLs (Step 4) | `bun ~/.claude/skills/dispatch/Tools/VerifyUrlBatch.ts verify <url> [<url> ...]` (exit 1 on any non-200) |
| Resolve the next `order:` | `bun ~/.claude/skills/dispatch/Tools/NextDispatchOrder.ts next <posts-dir>` |
| Log the artifact | `bun ~/.claude/skills/dispatch/Tools/LogArtifact.ts render <title> <path> [--workflow|--type|--wing]` |

The gate verdicts are deterministic (exit codes); the editorial judgment (what to write, which sources are on-topic) stays yours.
