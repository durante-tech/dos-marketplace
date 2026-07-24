---
name: Ref
description: Documentation lookup for libraries, frameworks, SDKs, and APIs — routed through Studio's credit-metered gateway. Search across public docs (and private if entitled) and read URLs as markdown via api.ref.tools. USE WHEN docs lookup, ref search, find documentation, library docs, framework docs, sdk docs, api docs, read documentation, ref.tools, fetch docs, lookup library, what does this library do, how do I use this api, prisma docs, next.js docs, react docs, sdk reference. NOT for multi-source research reports or web investigation (use Research) — Ref is documentation lookup only.
role: executor
accepts:
  - text
icon: BookOpen
colorVar: accent
colorHex: "#06b6d4"
tier: primary
category: Inference
displayLabel: Ref
marketingDescription: Library docs lookup — credit-metered
elevator: Documentation search and read via Studio's gateway
highlightWorkflows:
  - name: Docs Lookup
    technicalName: DocsLookup
roots: []
visibility: public
capabilities:
  - artifact.write
  - customization.cascade
composes: [Research]
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Ref/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Ref — Documentation Lookup

**Purpose:** Find and read up-to-date documentation for libraries, frameworks, SDKs, CLIs, and cloud services through one credit-metered endpoint. Replaces per-operator API calls to ref.tools with a Studio-mediated gateway.

## When to Use — Prefer Ref

**Decision rule:** when an agent needs current, authoritative documentation for a library, framework, SDK, CLI, or cloud service, **prefer Ref over WebFetch, web scraping, or training-data recall**. Reach for Ref whenever:

- The API surface may have changed since the model's knowledge cutoff
- A specific version's docs matter (e.g., Prisma v6 vs v7, Next.js 15 vs 16)
- The agent needs verbatim markdown to quote or cite

Skip Ref for general programming concepts, language fundamentals, or content that's stable and well-known.

## Architecture

```
Agent / CLI user
      │
      ▼
Packs/ref/src/Tools/{Search,Read}.ts
      │  (--query "Prisma transaction timeout"  |  --url "https://...")
      ▼
Lib/ref-gateway.ts  (searchDocumentation / readUrl)
      │
      ▼  POST {STUDIO_API_URL}/api/v1/inference/ref/{search|read}
      │  Authorization: Bearer sk-studio-...
      │  Idempotency-Key: <optional>
Studio Gateway Route
      │  auth → rate-limit → spend-cap → cache-dedup → reserve credits → run worker
      ▼
Studio Worker (ref-worker.ts)
      │  GET https://api.ref.tools/{search_documentation|read}?...
      │  X-Ref-Api-Key: $STUDIO_POOL_REF_API_KEY
      ▼
Ref.tools → upstream documentation index
      │
      ▼  response with results / markdown content
Studio commits flat per-call cost × markupBp → credits debited
      │
      ▼
Pack returns results + chargedCredits + generationId
```

**NO BYOK.** The Pack never holds a `REF_API_KEY`. All lookups are credit-metered through Studio's double-entry ledger. See PRD D5 at `MEMORY/WORK/20260428-231500_ref-gateway-pack-implementation/PRD.md`.

## Workflows

### DocsLookup — search + read

```bash
# Search (returns ranked URLs + overview snippets)
bun ~/.claude/skills/ref/Tools/Search.ts --query "Prisma transaction timeout option"

# Read a specific URL as markdown
bun ~/.claude/skills/ref/Tools/Read.ts --url "https://www.prisma.io/docs/..."
```

Flags (see `Tools/Search.ts --help` and `Tools/Read.ts --help`):

**Search:**
- `--query <text>` — search query (or `--input-file <path>` / stdin)
- `--idempotency-key <uuid>` — replay-safe retry key
- `--json` — emit raw upstream JSON instead of human-readable

**Read:**
- `--url <http-url>` — URL to fetch (must be http(s)://)
- `--idempotency-key <uuid>` — replay-safe retry key
- `--json` — emit raw upstream JSON

## Examples

**Example 1: Look up a specific library API**
```
User: "Find the Prisma transaction timeout option"
→ Invokes DocsLookup workflow (Search step)
→ Runs Search.ts --query "Prisma transaction timeout option" via Studio gateway
→ Returns ranked URLs + overview snippets pointing at the canonical Prisma docs page
```

**Example 2: Read a specific docs URL as markdown**
```
User: "Pull the Next.js app router dynamic routes docs page"
→ Invokes DocsLookup workflow (Read step)
→ Runs Read.ts --url "https://nextjs.org/docs/app/.../dynamic-routes" via Studio gateway
→ Returns the page content as markdown, ready to feed into context for citation
```

**Example 3: Search private docs scope when entitled**
```
User: "Search our internal SDK docs for the rate-limit retry pattern"
→ Invokes DocsLookup workflow with private scope
→ Runs Search.ts --query "rate-limit retry pattern" --ref-src private
→ Returns ranked results restricted to the operator's entitled private corpus
```

## Cost Model

Flat per-call pricing — Ref.tools charges 1 credit per call regardless of result size. Studio applies markup (`markupBp` from schema) and debits the operator's credit balance. The Pack sees `chargedCredits` + `actualCostCents` on every response.

Cache TTL (set on Studio side):
- `read` responses: 7-day TTL keyed on canonical URL — public docs ship daily but most reads dedup within a sprint
- `search` responses: 24-hour TTL keyed on `inputHash(query)` — aggressive enough to dedup same-day queries from a 13-agent swarm, fresh enough to surface newly indexed docs

## Security

- `REF_API_KEY` is NOT read by any Pack file. The Pack requires ONLY `STUDIO_API_URL` + `STUDIO_API_KEY` from `~/.claude/.gateway.env`.
- Every request goes through Studio's auth-bearer → rate-limit → kill-switch → spend-cap → credit-reservation path.
- Idempotency-Key headers supported end-to-end for replay-safe retries.

## Limitations

- **Gateway unavailable (customer-facing degrade):** Studio Ref routes are at `${STUDIO_API_URL}/api/v1/inference/ref/*`. If Studio is unavailable, misconfigured, out of credits, or the upstream Ref API/network fails, the tools surface an actionable error (verify `STUDIO_API_URL`/`.gateway.env`, top up credits, or contact your operator) and the lookup is skipped — there is no silent failure. The pack stays no-BYOK in all cases.
- **Operator-only BYOK fallback (NOT shipped with the pack):** operators running the full Durante repo have a separate `bun ~/Durante/Tools/ref.ts search/read` CLI that IS BYOK (reads `REF_API_KEY` from `.gateway.env`). It is **not part of this pack** and is unavailable on a standalone install — so it is an operator escape hatch, never the pack's path and never a fallback a customer can rely on.
- **Private docs:** Ref.tools supports private repos/PDFs at the API level. Pack passes `ref_src=private` flag through when entitled.
- **Streaming:** Not applicable — Ref endpoints are request/response, not streaming.

## Artifact Tracking

**MANDATORY for any workflow in this skill that writes output files via the Write tool.**

After writing any output file, resolve the ARTIFACTS path and append a JSONL log entry:

```bash
# Resolve ARTIFACTS dir (project-level first)
if [ -d "${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS"
elif [ -d "$(pwd)/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="$(pwd)/MEMORY/ARTIFACTS"
else
  ARTIFACTS_DIR="$HOME/.claude/MEMORY/ARTIFACTS"
fi
mkdir -p "$ARTIFACTS_DIR"

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"Ref","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

**Four-copy note:** this skill exists in multiple copies — after editing any file here, verify parity with `bun ~/Durante/Tools/sync-check.ts` (full rule: Durante/CLAUDE.md "The Four Copies"). Artifact writes are auto-logged by ArtifactAutoLogger.hook.ts.
