---
name: DocsLookup
description: Search and read up-to-date library/framework/SDK documentation via Studio's credit-metered Ref gateway.
status: STABLE
bestPath:
  - title: "Search"
    description: "Run Search.ts against a query to get ranked URLs + overview snippets."
  - title: "Read"
    description: "Run Read.ts against a specific URL to fetch its content as markdown."
  - title: "Cost + Caching"
    description: "Track the flat per-call credit cost and the 7-day/24-hour cache TTLs."
  - title: "Error Handling"
    description: "Diagnose gateway errors by exit code and HTTP status."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Ref DocsLookup workflow uses workflow-specific intent-to-flag vocabulary; canonical Mode/Output two-table shape doesn't fit"
---

# DocsLookup — Search and read documentation via Studio gateway

**Pack:** Ref
**Tools:** `Tools/Search.ts`, `Tools/Read.ts`
**Cost:** Flat per-call (1 credit) × markup, debited from operator credit balance.

---

## When to Use

Reach for this workflow whenever an agent needs **current, authoritative documentation** for a library, framework, SDK, CLI, or cloud service. The Pack is the canonical replacement for the retired `ref-context` MCP server. Prefer it over web scraping, training-data recall, or per-operator API keys whenever:

- Library API surface might have changed since model knowledge cutoff
- A specific version's docs matter (e.g., Prisma v6 vs v7, Next.js 15 vs 16)
- The agent needs verbatim markdown to quote or cite

Skip this workflow for general programming concepts, language fundamentals, or content that's stable and well-known.

---

## Two-step pattern: Search → Read

```bash
# Step 1 — search returns ranked URLs + overview snippets
bun ~/.claude/skills/ref/Tools/Search.ts \
  --query "Prisma transaction timeout option"

# Step 2 — read a specific URL as markdown
bun ~/.claude/skills/ref/Tools/Read.ts \
  --url "https://www.prisma.io/docs/orm/reference/prisma-client-reference#transactionoptions"
```

Search output (default human-readable):

```
overview: page='Prisma Client API | Prisma Documentation' section='...transactionoptions > options-2'
url: https://www.prisma.io/docs/orm/reference/prisma-client-reference#options-2
moduleId: prisma
---
overview: ...
url: ...
moduleId: ...
```

Read output: markdown content of the URL, ready to feed into context.

---

## Flag reference

### Search.ts

| Flag | Required? | Description |
|------|-----------|-------------|
| `--query <text>` | one of | Search query string |
| `--input-file <path>` | one of | Read query from file |
| stdin | one of | Pipe query via stdin |
| `--ref-src <scope>` | optional | `public` (default) \| `private` \| `all` |
| `--idempotency-key <uuid>` | optional | Replay-safe retry key |
| `--json` | optional | Emit raw API JSON instead of human-readable |
| `--verbose, -v` | optional | Print response metadata to stderr |
| `--help, -h` | optional | Show help |

### Read.ts

| Flag | Required? | Description |
|------|-----------|-------------|
| `--url <http-url>` | yes | URL to fetch (must be `http://` or `https://`) |
| `--idempotency-key <uuid>` | optional | Replay-safe retry key |
| `--json` | optional | Emit raw API JSON instead of markdown |
| `--verbose, -v` | optional | Print response metadata to stderr |

---

## Intent-to-Flag Mapping

This workflow shells out to `Tools/Search.ts` and `Tools/Read.ts`. Translate operator phrasing into deterministic flag selection per CreateSkill workflow Step 6 + CliFirstArchitecture.md.

### Step Selection (which tool to invoke)

| User Says | Tool | Effect |
|-----------|------|--------|
| "search docs for X", "find docs about Y", "look up library Z" | `Search.ts` | Returns ranked URLs + overview snippets for the query |
| "read this URL", "fetch the docs page at X", "pull this docs page" | `Read.ts` | Returns the URL's content as markdown |

### Search.ts Inputs

| User Says | Flag | Effect |
|-----------|------|--------|
| "search for X", inline query string | `--query <text>` | Required (or via `--input-file` / stdin). Search query string |
| "use this query file" | `--input-file <path>` | Read query from a file instead of CLI |
| "search public docs only" (default) | `--ref-src public` | Restrict to public docs corpus |
| "search our private docs", "include internal SDK docs" | `--ref-src private` | Restrict to entitled private corpus |
| "search everywhere", "all sources" | `--ref-src all` | Combine public and private |

### Read.ts Inputs

| User Says | Flag | Effect |
|-----------|------|--------|
| inline URL string | `--url <http-url>` | Required. Must start with `http://` or `https://` |

### Output and Retry Options (both tools)

| User Says | Flag | Effect |
|-----------|------|--------|
| "give me raw JSON", "machine-readable" | `--json` | Emit raw API JSON instead of human-readable / markdown |
| "show me the metadata", "verbose" | `--verbose, -v` | Print response metadata to stderr |
| "make it replay-safe", "retry the same call" | `--idempotency-key <uuid>` | Studio short-circuits second call to cached result |

## Architecture

```
Caller
  ↓
Pack CLI (Search.ts / Read.ts)
  ↓  POST {STUDIO_API_URL}/api/v1/inference/ref/{search|read}
  ↓  Authorization: Bearer ${STUDIO_API_KEY}
Studio Gateway Route
  ↓  auth → rate-limit → spend-cap → cache-dedup → reserve credits
Studio Worker (ref-worker.ts)
  ↓  GET https://api.ref.tools/{search_documentation|read}?...
  ↓  X-Ref-Api-Key: ${STUDIO_POOL_REF_API_KEY}
api.ref.tools
  ↓
Studio commits flat per-call cost × markup → credits debited
  ↓
Pack returns results / content + metadata
```

**Key invariant:** the Pack never sees `REF_API_KEY`. Studio's pool key handles all upstream auth; the Pack only authenticates to Studio.

---

## Cost model

Ref.tools charges 1 credit per call regardless of result size (Max plan: $200/mo for 30,000 credits = $0.0067/call). Studio applies markup before debiting the operator's credit balance.

**Cache behaviour (Studio side):**
- `read` responses cache for 7 days, keyed on canonical URL. Public docs ship daily but most reads dedup within a sprint.
- `search` responses cache for 24 hours, keyed on `inputHash(query)`. Aggressive enough to dedup same-day queries from a 13-agent swarm but fresh enough to surface newly indexed docs.

**Cache hits:** indicated by `cacheHit: true` in the response metadata. Cache hits incur the same flat cost (Studio's metering is per-call, not per-upstream-call).

---

## Studio gateway status

The Studio Ref gateway is shipped:

- `Platform/studio/apps/web/app/api/v1/inference/ref/{search,read}/route.ts`
- `Platform/studio/apps/web/lib/gateway/ref-worker.ts`
- `provider='REF'` pricing rows
- `STUDIO_POOL_REF_API_KEY` pool-key configuration

Use the Pack CLIs as the primary path:

```bash
bun ~/.claude/skills/ref/Tools/Search.ts --query "Prisma transaction timeout option"
bun ~/.claude/skills/ref/Tools/Read.ts --url "https://www.prisma.io/docs/..."
```

**Operator-only fallback (NOT shipped with the pack):** `bun ~/Durante/Tools/ref.ts search/read` is a separate BYOK CLI available **only to operators who run the full Durante repo** — it is not part of this pack and does not exist on a standalone install. Operators may reach for it when Studio is unavailable, the deployed Studio is behind this checkout, pool-key/pricing config is missing, or the upstream Ref API/network fails. **Customers** (pack-only installs) instead get an actionable gateway-down error and skip the lookup — they do not have, and are not pointed at, this tool. A 404 from the gateway means deployment drift or route disablement, not the normal expected state.

---

## Error handling

| Exit code | Meaning |
|-----------|---------|
| 0 | Success |
| 1 | Usage error (missing flag, bad value, or HTTP 4xx other than 404) |
| 2 | Missing Studio environment / config |
| 3 | HTTP 5xx, 404, or transport error |

Common error patterns:

- **HTTP 401 from gateway** → Studio credentials in `.gateway.env` are wrong. Re-run `bun ~/.claude/DOS/Tools/configure.ts`.
- **HTTP 404 from gateway** → Deployed Studio is behind this checkout or the route is disabled. Customer: verify `STUDIO_API_URL`/`.gateway.env` or contact your operator. Operator (full repo only): `bun ~/Durante/Tools/ref.ts` while deployment catches up.
- **HTTP 503 from gateway** → Studio Ref pricing or pool-key configuration is missing. Fix Studio config. (The operator-only `~/Durante` fallback can unblock an operator lookup; it is not available to pack-only customers.)
- **HTTP 429 from gateway** → Studio rate-limit hit. Back off or reduce parallel agent fan-out.
- **HTTP 402 from gateway** → spend-cap reached. Top up credits at Studio dashboard.
