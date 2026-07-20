# FrameworkDigest — dos-fastapi-starter

12-section synthesis of `~/Developer/dos-fastapi-starter` for agent briefings. Each Phase brief slices the relevant section(s) from this digest. Updated 2026-05-06.

> **Source authority:** the codebase at `~/Developer/dos-fastapi-starter` is the ground truth. This digest is a frozen snapshot — when in doubt, read the source.

---

## §1 — Architecture overview

**Single-package Python monolith.** All domain code lives under `src/app/`. No monorepo structure; no workspace tooling.

```
src/
  app/
    main.py            # FastAPI app entry — calls create_application(router, settings, lifespan)
    api/               # Versioned routers — currently /api/v1
    api/v1/            # health, login, logout, users, posts, tasks, tiers, rate_limits
    agents/            # Pydantic AI agent endpoints (router.py + service.py per feature)
    core/              # config, setup, security, problem-details, db, utils
    crud/              # FastCRUD generics (one file per model)
    models/            # SQLAlchemy 2.0 declarative ORM models
    schemas/           # Pydantic v2 DTOs (request/response/internal)
    middleware/        # ASGI middleware (cache, logging, auth glue)
    admin/             # CRUDAdmin wiring (optional, gated on CRUD_ADMIN_ENABLED)
    logs/              # logger pipeline
  migrations/          # Alembic versioned migrations (env.py, versions/)
  alembic.ini
```

**Entry chain:** `main.py` → `core/setup.py:create_application(...)` → returns `FastAPI()` instance with routers mounted, lifespan attached, middleware added, problem-details handlers registered, optional Logfire instrumentation.

**Lifespan:** async context manager that starts/stops Redis pools (cache, queue, rate-limiter), creates DB tables (greenfield only — Alembic handles the rest), instruments Logfire if `LOGFIRE_TOKEN` set.

---

## §2 — Async boundary discipline

**Hard Rule 4 (AGENTS.md):** Async-everywhere. All route handlers `async def`, all DB queries via `AsyncSession`, no synchronous LLM calls in handlers.

**Tools:** SQLAlchemy 2.0 async + asyncpg + Pydantic AI (async by default) + httpx async client + ARQ (asyncio-native).

**Anti-pattern:** `requests.get(...)` or any sync I/O in an async handler. Use `httpx.AsyncClient`. For unavoidable sync libraries, use `await asyncio.to_thread(...)`.

**Architect role's job:** flag any sync call introduction at design time, not at code-review time.

---

## §3 — Hard rules (codified in `~/Developer/dos-fastapi-starter/AGENTS.md`)

1. **Use `uv` for dependency management.** No `pip`, no `poetry`. `uv sync` mutates lock; `uv sync --frozen` for CI.
2. **Never return ORM models.** Always map through Pydantic DTOs with `ConfigDict(from_attributes=True)`.
3. **Versioned API routes.** All consumer routes under `api/v1/*`. Future `api/v2/*` for breaking changes.
4. **Async everywhere.** See §2.
5. **Streaming for long tasks.** Tasks >2s use `EventSourceResponse` (sse-starlette). Don't block the connection.
6. **Soft imports for optional deps.** Logfire, CRUDAdmin behind env guards (`if settings.X_ENABLED:`).
7. **FastCRUD ownership at call site.** CRUD instances aren't subclassed; handlers compose them directly.
8. **No emojis in code or commits.** Technical prose only.
9. **Module-level AGENTS.md.** Every `src/app/{domain}/` may have its own AGENTS.md for local guidance.
10. **Slot-aware infrastructure.** Every worktree gets a unique slot; ports derive deterministically.

---

## §4 — Architecture Decision Records (codified in `Plans/Specs/`)

Eight ADRs captured at the time of digest authoring. Architect role authors new ADRs at Phase 2 or Phase 7 of DeliverFeature.

- **ADR-001:** Manual JWT (no `fastapi-users`). Reasoning: starter must remain forkable without library lock-in; refresh-token cookie pattern is bespoke to the security model.
- **ADR-002:** RFC 9457 problem-details for HTTP errors. Reasoning: standard error envelope, machine-parseable, no PII leakage.
- **ADR-003:** FastCRUD generics over hand-rolled CRUD. Reasoning: pagination + filter + sort uniformity across all resources.
- **ADR-004:** ARQ (not Celery) for jobs. Reasoning: asyncio-native, single Redis dependency, lower memory.
- **ADR-005:** Pydantic AI for agent endpoints. Reasoning: Pydantic-native, lazy-init via `lru_cache` keeps API-key validation deferred.
- **ADR-006:** Logfire as observability primitive. Reasoning: Pydantic ecosystem integration, FastAPI auto-instrument.
- **ADR-007:** Slot allocator + parallel-fork registry (`~/.dos/forks/registry.json`). Reasoning: developer ergonomics for side-by-side feature work.
- **ADR-008:** MCP server decoupled from app. Reasoning: must respond when app is broken; deps minimal (`mcp` + `httpx` only).

---

## §5 — Auth + Security stack

**JWT scheme:** Manual, two-token (access + refresh).

| Token | TTL | Storage | Verification |
|---|---|---|---|
| Access | 30 min default | Authorization: Bearer header | HS256 + blacklist check |
| Refresh | 7 days default | HttpOnly cookie (SameSite=Lax, Secure in prod) | HS256 + blacklist + cookie binding |

**Passwords:** bcrypt with `bcrypt.gensalt()` (cost 12 default).

**Token blacklist:** `TokenBlacklist` model in DB with `(token, expires_at)`. Logout writes both access + refresh tokens.

**Rate limiting:** Redis keys `{user_id}:{sanitized_path}:{window_start}`. Per-user, per-route, per-window.

**Tier system:** `Tier` model with FK from `User`. Determines rate-limit ceiling.

**SECRET_KEY:** Pydantic `SecretStr`, never logged, never returned in error messages.

**Security role's beat:** verify every new endpoint adds `Depends(get_current_user)` or `Depends(get_current_superuser)` unless explicitly public; verify Pydantic validators on all user-controlled inputs; verify rate-limit key namespacing on new endpoints.

---

## §6 — Data layer

**SQLAlchemy 2.0 declarative async** with `MappedAsDataclass`. All models inherit from `Base = DeclarativeBase + MappedAsDataclass`.

**Common columns** (User example):

```python
id: Mapped[int] = mapped_column(autoincrement=True, primary_key=True)
uuid: Mapped[UUID] = mapped_column(default=uuid7, unique=True, index=True)
created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(UTC))
updated_at: Mapped[datetime | None] = mapped_column(default=None, onupdate=lambda: datetime.now(UTC))
is_deleted: Mapped[bool] = mapped_column(default=False)
deleted_at: Mapped[datetime | None] = mapped_column(default=None)
```

**Sessions:** `async_sessionmaker(..., expire_on_commit=False)`. Manual control of ORM reload behavior.

**Engine:** `create_async_engine(DATABASE_URL, echo=False, future=True)`. No statement caching for PgBouncer transaction-mode compatibility.

**Soft delete pattern:** `is_deleted` flag + `deleted_at` timestamp. CRUD methods filter `is_deleted=False` by default; explicit `include_deleted=True` to bypass.

**Database role's beat:** model design, migration generation, FK constraint design, index strategy (composite indexes for tenant-scoped queries), backfill plans for non-null adds.

---

## §7 — Migrations (Alembic)

**Config:** project file `./src/alembic.ini` — `script_location = migrations` relative to ini.

**Workflow:**

```bash
cd src
uv run alembic revision --autogenerate -m "<message>"  # generate from ORM
uv run alembic check                                    # detect ORM↔DB drift
uv run alembic upgrade head                             # apply
uv run alembic downgrade -1                             # rollback one step
```

**MCP surface:** read-only inspection via `mcp__dos_fastapi__alembic_current`, `alembic_history`, `alembic_check`. Generation/application via subprocess (intentional — keeps guardrails in operator hands).

**Backfill discipline:** any `ALTER TABLE ... ADD COLUMN ... NOT NULL` against a populated table requires:
1. Migration step 1: add column nullable
2. Code step: backfill in app code or migration data step
3. Migration step 2: alter to NOT NULL
4. Document the two-phase approach in the migration message

---

## §8 — Pydantic schemas (DTOs)

**Convention:** `src/app/schemas/{domain}.py` per resource.

**Pattern (User):**

```python
class UserBase(BaseModel):
    name: str
    username: Annotated[str, Field(min_length=2, max_length=30, pattern=r"^[\w]+$")]
    email: EmailStr

class UserRead(UserBase):
    id: int
    profile_image_url: str | None = None
    tier_id: int | None = None
    model_config = ConfigDict(from_attributes=True)

class UserCreate(UserBase):
    password: Annotated[str, Field(pattern=r"^.{8,}$|[0-9]+|[A-Z]+|[a-z]+|[^a-zA-Z0-9]+$")]

class UserUpdate(BaseModel):
    # all fields optional
    name: str | None = None
    username: str | None = None
    # ...

class UserCreateInternal(UserBase):
    hashed_password: str  # for CRUD layer; never accepts plain password
```

**Schema role's beat:** define this DTO ladder for every new resource; verify `from_attributes=True` on Read DTOs; verify field validators (regex, EmailStr, conint, etc.); verify response_model on every route.

---

## §9 — API DX (developer experience)

**Versioned routing:** `/api/v1/{resource}`. Future versions side-by-side.

**OpenAPI tag groupings:** one tag per resource family (`users`, `posts`, `tasks`, `agents`).

**RFC 9457 problem-details envelope:**

```json
{
  "type": "https://example.com/probs/out-of-credit",
  "title": "Insufficient credit",
  "status": 402,
  "detail": "User account has insufficient credits for this action.",
  "instance": "/api/v1/billing/charge"
}
```

Registered in `core/setup.py` for both `StarletteHTTPException` and `RequestValidationError`.

**Pagination:** offset-based (`page`, `items_per_page`). FastCRUD's `paginated_response()` returns `{ data: [...], total_count, has_more, page, items_per_page }`.

**Idempotency:** not yet codified. API DX role authors the `Idempotency-Key` header policy when first feature requires it.

**API DX role's beat:** Swagger UI examples (via `OpenAPI` config in route signatures), error envelope consistency, pagination semantics, idempotency keys, versioning strategy, deprecation policy.

---

## §10 — Testing

**Two-tier pyramid** — pytest unit + pytest integration.

**Unit tier:** `tests/unit/test_*.py` — pure-function tests, no DB, no network, no Redis. Fast, deterministic. `pytest-asyncio` for async functions. Faker for fixture data.

**Integration tier:** `tests/integration/test_*.py` — FastAPI `TestClient` + `httpx.AsyncClient` against a live test DB. Bootstrap fixture issues real JWTs against the test DB; never mocks JWT verification.

**Conftest:** `tests/conftest.py` provides:
- `client` (TestClient, session scope)
- `async_client` (httpx.AsyncClient against `app`)
- `db` (sync session for DB setup/teardown)
- `async_db` (AsyncSession for async tests)
- `fake` (Faker instance)
- `test_user`, `superuser` (auth bootstrap)

**Mailpit assertions:** integration tests for email flows use `mcp__dos_fastapi__list_mailbox` (or HTTP fetch against `http://localhost:{slot.smtp_ui}/api/v1/messages`) to assert email sent. Don't fake the SMTP layer.

**ARQ assertions:** integration tests for background jobs poll `arq` job status via redis (or `mcp__dos_fastapi__run_checks` if a dedicated polling helper exists).

**QA role's beat:** unit-tier authorship, edge case enumeration, Test Pyramid Plan with per-ISC layer mapping. **E2E role's beat:** integration-tier authorship, fixture composition, flake mitigation (deterministic seeds, isolated transactions, no fixed sleeps).

**Run commands:**

```bash
uv run pytest tests/unit                        # unit only
uv run pytest tests/integration                 # integration only
uv run pytest                                   # full suite
uv run pytest tests/integration -k "auth"       # filter
uv run pytest --cov=src/app                     # with coverage
```

---

## §11 — Deployment recipes

Three Docker-based recipes in `scripts/`:

| Recipe | When to use | Layout |
|---|---|---|
| `local_with_uvicorn/` | Local dev | Single container, uvicorn `--reload` |
| `gunicorn_managing_uvicorn_workers/` | Production single-machine | Gunicorn (4-8 workers) + Uvicorn worker class |
| `production_with_nginx/` | Production at scale | Nginx reverse proxy + Gunicorn app(s) + Postgres + Redis |

**Each recipe ships:** `Dockerfile`, `docker-compose.yml`, `.env.example`. All assume `uv` for dep install in the build stage.

**Migration application:** entrypoint script runs `alembic upgrade head` on container boot. Failure halts boot — operator inspects logs.

**MkDocs deployment guides:** `docs/deployments/{aws-lambda,fly,railway}.md`.

**DevOps role's beat:** Dockerfile diff per recipe when adding deps, `.env.example` updates, healthcheck wiring, Logfire token env var, Alembic migrate-deploy safety, slot allocator hygiene.

---

## §12 — Observability + AI surface

**Logfire instrumentation:** opt-in via `LOGFIRE_TOKEN` env var. Initialized in `core/setup.py`:

```python
import logfire  # soft import behind flag
logfire.configure(token=..., service_name=..., environment=...)
logfire.instrument_fastapi(application)
if callable(getattr(logfire, "instrument_pydantic_ai", None)):
    logfire.instrument_pydantic_ai()
```

Spans: all FastAPI handlers, all SQLAlchemy queries, all Pydantic AI agent runs, all httpx outbound calls.

**Pydantic AI agents:** `src/app/agents/{feature}/service.py` exports `get_<feature>_agent()` wrapped in `@lru_cache(maxsize=1)`. Construction is deferred until first request — keeps app boot decoupled from API-key availability.

**Tool registration:** `@agent.tool` decorator. Tool functions are async, take `ctx: RunContext[<DepsType>]` + typed args, return typed results.

**Streaming:** for tasks >2s, return `EventSourceResponse` (sse-starlette) wrapping `agent.run_stream(...)`.

**Agent Engineer role's beat:** agent construction, tool registration, system prompt design, lazy-init pattern, streaming correctness, Logfire span wiring.

---

## Quick lookup

| Need | Read |
|---|---|
| Hard rules | §3 + `~/Developer/dos-fastapi-starter/AGENTS.md` |
| New ADR | §4 + `~/Developer/dos-fastapi-starter/Plans/Specs/` |
| New endpoint | §1 (placement) + §2 (async) + §8 (DTOs) + §9 (DX) |
| New model | §6 (model) + §7 (migration) |
| New agent | §12 (Pydantic AI) + §1 (placement under `src/app/agents/`) |
| Test new feature | §10 (pyramid + commands) |
| Deploy plan | §11 |
| Auth review | §5 |
