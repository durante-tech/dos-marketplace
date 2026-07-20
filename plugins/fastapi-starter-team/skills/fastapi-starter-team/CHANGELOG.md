# FastAPIStarterTeam Changelog

## v0.5.0 — 2026-05-06 (parity lift)

**Identity rename.** `FastAPIStarter` → `fastapi-starter-team`. Symmetric with `makerkit-team` (Kit→Starter, Team→Team suffix). Old pack `~/Durante/Packs/FastAPIStarter/` deprecated; deletion at operator's confirmation.

**Parity with MakerkitTeam v0.5.2.** Lifted from v0.1.0 scaffold (6 files, planned-capabilities-only) to a fully-equipped 13-role delivery team with full workflow surface. Inherited:

- 13-role roster (3 reflavored: `ux→apidx` API DX Designer, `ui→schema` Schema Designer, `frontend→agent` Agent Engineer)
- 14 workflows (`BugFix`, `CodeReview`, `DeliverFeature`, `DesignReview`, `DocsRefresh`, `ExecuteOpenTodos`, `ExploreFeature`, `QuickFix`, `Refactor`, `ReviewOpenPRs`, `ReviewSinglePR`, `SecurityAudit`, `ShowRoster`, `TestAndValidate`)
- 5 shared partials (`_test-pyramid-gate`, `_algorithm-team-spawn`, `_commit-merge`, `_github-collaboration`, `_pr-loop-shared`)
- 6 TS/Bun tools (`BuildBrief`, `InvokeAgent`, `ParsePrTodos`, `ClassifyPrShape`, `RenderTodoComment`, `_shared`)
- `Data/Roster.json` (13 roles with `mcp_tools` cluster fields)
- `Data/McpToolMap.json` (6 clusters mapped to dos-fastapi-starter MCP server)
- `FrameworkDigest.md` (12-section synthesis of dos-fastapi-starter)

**Reflavoring (Python/FastAPI/Pydantic AI ecosystem):**

| Subsystem | makerkit-team | fastapi-starter-team |
|---|---|---|
| Test pyramid | Vitest unit + Playwright e2e | pytest unit + pytest integration (TestClient + httpx) |
| ORM | Prisma (TS) | SQLAlchemy 2.0 async (Python) |
| Migrations | `prisma migrate dev` | `alembic revision --autogenerate` |
| DTOs | Zod schemas | Pydantic v2 schemas |
| AI surface | (n/a in MakerkitTeam) | Pydantic AI agents (`@agent.tool`, lazy-init via `lru_cache`) |
| Observability | Sentry | Logfire (`logfire.instrument_fastapi`, `instrument_pydantic_ai`) |
| Job queue | (n/a in MakerkitTeam) | ARQ (Redis-backed, `queue.pool.enqueue_job`) |
| Auth | Better Auth | JWT (HS256, two-token: access + refresh cookie) + bcrypt |
| Pre-commit | ESLint + Prettier | ruff format + ruff check + mypy |
| Test runner | `pnpm --filter @kit/<pkg> test:unit` + `pnpm --filter web-e2e exec playwright test` | `uv run pytest tests/unit` + `uv run pytest tests/integration` |
| MCP namespace | `mcp__makerkit__*` (Makerkit MCP server, ~50 tools) | `mcp__dos_fastapi__*` (dos-fastapi-starter MCP server, 8+ tools) |
| Healthcheck tool | `mcp__makerkit__run_checks` | `mcp__dos_fastapi__run_checks` (ruff + mypy + pytest) |
| Component catalog | `mcp__makerkit__components_search` (read @kit/ui) | `mcp__dos_fastapi__list_routes` (read /openapi.json) |
| Framework digest source | `dos-prisma-saas-kit/docs/` (12 sections) | `~/Developer/dos-fastapi-starter/AGENTS.md` + `Plans/Specs/` (12 sections) |

**Coordination policy** preserved 1:1 from MakerkitTeam v0.5.2:

1. Auto-classify scope
2. DB Engineer always runs (with `alembic_check` MCP)
3. `/simplify` part of Phase 4 BUILD
4. Distinctive voices kept
5. ISC failures route to original implementer
6. Test pyramid non-negotiable (pytest unit + pytest integration)
7. Algorithm-driven + DAG default for parallel phases
8. Commit + merge hygiene (Conventional Commits + ruff/mypy pre-commit gates)
9. GitHub collaboration discipline

**MCP integration via dos-fastapi-starter MCP server.** The starter repo ships its own MCP at `tooling/mcp_server/` (entry: `uv run python -m dos_fastapi_mcp`). Six clusters mapped:

- `project_status` — `fork_status`, `check_prerequisites`, `list_forks`
- `migrations` — `alembic_current`, `alembic_history`, `alembic_check`
- `api_surface` — `list_routes`
- `mailbox` — `list_mailbox`
- `checks` — `run_checks`
- `env` — `read_env_local`

**Anti-overlap with MakerkitTeam.** Triggers explicitly suffix with "in starter" vs "in kit" to prevent skill collision when both packs are installed.

## v0.1.0 — 2026-05-06 (initial scaffold, deprecated)

Original 6-file scaffold (SKILL.md / extension.yaml / plugin.json / README.md / INSTALL.md / VERIFY.md) with planned-capabilities-only documentation. Superseded by v0.5.0 parity lift.

## Migration Notes (v0.1.0 → v0.5.0)

- Pack root renamed: `Packs/FastAPIStarter/` → `Packs/fastapi-starter-team/`
- Live skill name change: `~/.claude/skills/FastAPIStarter/` → `~/.claude/skills/fastapi-starter-team/`
- The legacy v0.1.0 SKILL.md mentioned 6 planned capabilities (Bootstrap, AddAgentEndpoint, AddDomain, AddBackgroundJob, DeployTo, AuditAuth). These map onto the new workflows as follows:
  - **Bootstrap** → `DeliverFeature` Phase 0 (slot allocation, dev compose) + `ShowRoster`
  - **AddAgentEndpoint** → `DeliverFeature` with Phase 4 owned by Agent Engineer
  - **AddDomain** → `DeliverFeature` with full pipeline (DB + Backend + Schema)
  - **AddBackgroundJob** → `DeliverFeature` Phase 4 (Backend) + ARQ-specific test path in Phase 6
  - **DeployTo** → `DeliverFeature` Phase 7 (DevOps) — Railway / Fly / Lambda concerns codified in deploy checklist
  - **AuditAuth** → `SecurityAudit`

No breaking changes to consumers — the new pack is additive. Deletion of old `Packs/FastAPIStarter/` requires explicit operator confirmation.
