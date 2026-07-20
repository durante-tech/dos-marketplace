---
name: Docs Lookup
description: Route library/framework/SDK/API doc queries to the ref skill instead of multi-agent web research
status: STABLE
featured: false
successRate: 99.0
icon: BookOpen
bestPath:
  - title: "Intent Triage"
    description: "Confirm the request is for current authoritative docs of a named library/framework/SDK/CLI/cloud service."
  - title: "Delegate to Ref"
    description: "Invoke the ref skill's DocsLookup workflow (Search.ts → Read.ts, credit-metered via Studio gateway)."
  - title: "Cite + Synthesize"
    description: "Return verbatim markdown excerpts with canonical URLs; escalate to StandardResearch only if Ref returns no hits."
---

# Docs Lookup Workflow

**Mode:** Delegated to the ref skill (search + read via Studio gateway). | **Cost:** Flat per-call (1 credit × markup). | **Timeout:** 30 seconds per Ref call.

This workflow is Research's bridge into the **Ref** primitive. When the request is a documentation lookup — "find the Prisma transaction timeout option", "what does Next.js say about dynamic routes", "Stripe SDK webhook signature verification" — Research must NOT fan out 3-12 web-research agents. It must hand the query to Ref, which routes through `api.ref.tools` for authoritative, version-correct markdown.

## When to Use

Pick this workflow when ALL of the following are true:

- The request names (or implies) a specific library, framework, SDK, CLI, or cloud service
- The user wants **current authoritative documentation** (API surface, options, configuration, syntax)
- Generic web research would return noisy/blog-quality results vs. canonical docs

**Trigger phrases:** "look up X docs", "find the X API for Y", "what does the X documentation say about Y", "Prisma docs for Z", "Next.js docs for Z", "Stripe API reference", "Tailwind config option for Z", "AWS SDK method for Z", "show me how to use X in library Y".

**Do NOT use this workflow for:**

- Conceptual / language fundamentals (use StandardResearch or Claude WebSearch)
- Comparative analysis across libraries (use StandardResearch — multi-perspective is the point)
- News / recent events / changelog summaries (use QuickResearch with `--recency week`)
- Anything where the answer is unlikely to live on a vendor docs site (use OSINT or StandardResearch)

## When Ref is unavailable

The ref skill's primary path is the Studio gateway at `${STUDIO_API_URL}/api/v1/inference/ref/*`. If Studio is unavailable, deployed behind this checkout, misconfigured, or the upstream Ref API/network fails, use the operator-local fallback `bun ~/Durante/Tools/ref.ts search|read` with the local `REF_API_KEY` from `.gateway.env`. If both gateway and fallback fail, escalate to QuickResearch (Perplexity sonar); Perplexity often returns the canonical docs URL anyway and Read.ts can fetch it afterwards when Ref recovers.

## Workflow

### Step 1: Confirm doc-lookup intent

Before invoking Ref, sanity-check that the query is a docs lookup. Ask:

- Is there a specific library/framework/SDK/CLI/service named (or implied by 1-2 follow-up keywords)?
- Would the canonical answer live on the vendor's documentation site?

If yes, proceed. If the query is broader ("what's the best way to do X across libraries"), step out of this workflow and invoke StandardResearch instead.

### Step 2: Invoke the ref skill — Search

Hand off to the ref skill's DocsLookup workflow. The cleanest path is a direct CLI invocation (same effective behavior as `Skill('Ref')` for this workflow — Ref's CLI tools are its only execution surface):

```bash
bun ~/.claude/skills/ref/Tools/Search.ts \
  --query "<the user's library + intent, e.g. 'Prisma transaction timeout option'>" \
  --json
```

Parse the JSON output. The response contains:

- `results[]` — ranked entries with `url`, `overview`, `moduleId`
- `chargedCredits`, `generationId`, `cacheHit` — metering metadata

**Pick the top 1-3 most-relevant results.** Prefer entries whose `moduleId` matches the named library and whose `overview` mentions the user's specific question.

**Private docs:** if the operator has entitled private docs and the query is internal SDK / internal tooling, add `--ref-src private`. If unsure, default to `--ref-src public`.

### Step 3: Invoke the ref skill — Read

For each shortlisted URL, fetch the full markdown:

```bash
bun ~/.claude/skills/ref/Tools/Read.ts \
  --url "<canonical docs URL from Step 2>" \
  --json
```

Parse `content` (markdown). If multiple URLs are shortlisted, run reads in parallel (one Bash call per URL — independent operations).

### Step 4: Cite + Synthesize

Return the answer to the user with:

- The **verbatim excerpt** from the docs that answers the question (1-3 paragraphs max)
- The **canonical URL** (clickable)
- The library + version (from `moduleId` if Ref returned it; otherwise from the doc page itself)
- Any **adjacent gotchas** mentioned in the docs (deprecations, version constraints, default values)

Do NOT summarize away from the verbatim wording for API/syntax answers — operators copy these into their code.

### Step 5 (conditional): Escalate to StandardResearch

Escalate if ANY of the following:

- Ref returned zero results AND the operator-local fallback (`~/Durante/Tools/ref.ts`) also returned zero
- The docs answer is partial — the question requires synthesis across multiple library versions or comparison with another library
- The docs are present but stale (the library version on the docs site is older than what the user is using)

The boolean composition of those three conditions is deterministic and has one
tested owner — the `partial` and `stale` arguments are your judgment, the
AND/OR wiring is not. Compute the verdict with:

```bash
# args: <refResultCount> <fallbackResultCount> <isPartial> <isStale>
bun ~/.claude/skills/research/Tools/ResearchCli.ts should-escalate-docs 0 0 false false
# -> "true" / "false"
```

Escalation = invoke `Workflows/StandardResearch.md` with the original query, noting in the report that Ref was tried first.

## Save Report (MANDATORY for non-trivial lookups)

For one-off "what's the flag for X" answers, no persistence is needed — return the answer inline. For substantive doc deep-dives (3+ pages fetched, multi-part question), persist:

```bash
# Resolve project-level RESEARCH dir (project -> cwd -> global), tested owner:
# Packs/research/src/Tools/ResearchCli.ts resolve-dir (mirrors getMemorySubdir).
RESEARCH_BASE="$(bun ~/.claude/skills/research/Tools/ResearchCli.ts resolve-dir)"
mkdir -p "$RESEARCH_BASE/$(date +%Y-%m)"
```

**Write report to:** `$RESEARCH_BASE/{YYYY-MM}/{YYYY-MM-DD}_{library}-{topic-slug}.md`

The report skeleton (frontmatter + section headings + empty-state slots) is
rendered by the golden-tested owner — do not hand-type it; fill `{Verbatim
excerpt}` and the source URLs from the Ref response:

```bash
bun ~/.claude/skills/research/Tools/ResearchRender.ts render-report \
  "$(jq -nc --arg date "$(date +%F)" --arg library "{library}" \
     --arg version "{version-or-latest}" --arg credits "{chargedCredits}" \
     --arg topic "{Topic}" \
     '{mode:"docs",date:$date,library:$library,version:$version,credits_charged:$credits,topic:$topic}')"
```

This emits, byte-identical:

```markdown
---
mode: docs-lookup
date: {YYYY-MM-DD}
library: {library}
version: {version-or-latest}
providers: 1 (ref.tools via Studio gateway)
credits_charged: {chargedCredits}
---

# {Library} — {Topic}

## Answer
{Verbatim excerpt or synthesis}

## Sources
- {Canonical docs URL #1}
- {Canonical docs URL #2}
```

### Log Artifact Entry

Immediately after the file is written:

```bash
VAULT_PATH="$RESEARCH_BASE/$(date +%Y-%m)/$(date +%Y-%m-%d)_{library}-{topic-slug}.md"
TS="$(date -u +%FT%TZ)"
TITLE="{Library} — {Topic}"
PREVIEW="$(head -c 200 "$VAULT_PATH" 2>/dev/null | tr '\n' ' ')"
mkdir -p "$DOS_DIR/MEMORY/ARTIFACTS"
printf '%s\n' "{\"pack\":\"Research\",\"workflow\":\"DocsLookup\",\"type\":\"research\",\"title\":$(printf '%s' "$TITLE" | jq -Rs .),\"path\":\"$VAULT_PATH\",\"contentPreview\":$(printf '%s' "$PREVIEW" | jq -Rs .),\"wing\":\"\",\"sessionId\":\"${DOS_SESSION_ID:-}\",\"timestamp\":\"$TS\"}" >> "$DOS_DIR/MEMORY/ARTIFACTS/artifacts.jsonl"
```

<!-- partial: _intent-to-flag-table.md skill_name=Research workflow_name=DocsLookup -->
## Intent-to-Flag Mapping

Step selection (which Ref tool to invoke):

| User Says | Tool | Effect |
|-----------|------|--------|
| "look up X in Y docs", "find docs for X" | `Ref/Tools/Search.ts` | Returns ranked URLs + overview snippets |
| "read this docs page at URL", "fetch URL as markdown" | `Ref/Tools/Read.ts` | Returns the URL's content as markdown |
| typical workflow ("explain Prisma transactions") | both | Search → pick top → Read top URLs |

Search.ts inputs:

| User Says | Flag | Effect |
|-----------|------|--------|
| Inline query | `--query <text>` | Required (or `--input-file` / stdin) |
| "search public docs" (default) | `--ref-src public` | Public docs corpus |
| "search our private docs" | `--ref-src private` | Entitled private corpus |
| "search everywhere" | `--ref-src all` | Public + private combined |

Read.ts inputs:

| User Says | Flag | Effect |
|-----------|------|--------|
| Inline URL | `--url <http-url>` | Required. Must be `http(s)://` |

Output / retry:

| User Says | Flag | Effect |
|-----------|------|--------|
| "give me raw JSON" | `--json` | Raw upstream JSON |
| "replay-safe" | `--idempotency-key <uuid>` | Studio dedups cached result |
| "verbose" | `--verbose, -v` | Metadata to stderr |

## Cost & Caching

Ref is **flat per-call** (1 credit × markup) regardless of result size. Studio caches:

- `read` responses: 7-day TTL on canonical URL
- `search` responses: 24-hour TTL on `inputHash(query)`

A repeated docs lookup on the same day for the same library is effectively free after the first call. For multi-page deep-dives, Read all the URLs in parallel — each is independently cached.

## Return Format

```markdown
📋 SUMMARY: Docs lookup for {topic} in {library}
🔍 ANALYSIS: {1-3 paragraph answer with verbatim excerpts}
⚡ ACTIONS: 1 Search + N Reads via Ref/Studio gateway
✅ RESULTS: {Direct answer to the user's question}
📊 STATUS: Docs Lookup mode — {credits} credits charged
📁 CAPTURE: Canonical URL(s): {url-1}{url-2}...
➡️ NEXT: {Suggest StandardResearch if comparative analysis needed; suggest deeper Read if user wants surrounding context}
📖 STORY EXPLANATION: {3-5 numbered points — keep brief}
🎯 COMPLETED: Docs answer for {topic}
```

## Speed Target

~5-15 seconds end-to-end (1 Search + 1-3 parallel Reads). Cache hits return in <1 second.
