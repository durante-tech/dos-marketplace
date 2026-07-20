# Test Pyramid Gate (binding)

Shared substrate for every change-producing FastAPIStarterTeam workflow. Defines the two-tier test pyramid for the Python/FastAPI ecosystem, the ships-with-tests gate, the canonical commands, file conventions, do/don't list, and the per-ISC layer-mapping rubric. Workflows reference this file rather than restating contracts inline.

**Source of truth:**
- `~/Developer/dos-fastapi-starter/AGENTS.md` (Hard Rule 4 async-everywhere; module AGENTS.md for tests)
- `~/Developer/dos-fastapi-starter/tests/conftest.py` (fixture patterns)
- `pytest`, `pytest-asyncio`, `httpx.AsyncClient`, FastAPI `TestClient`

**Sibling:** `MakerkitTeam/Workflows/_test-pyramid-gate.md` (Vitest + Playwright). Same gate shape, Python/FastAPI flavor below.

## The Two-Tier Pyramid

The starter prescribes exactly two test layers. There is no formal third tier — characterization tests fold into integration; pure-function tests are unit.

| Layer | Tool | Folder | What goes here |
|---|---|---|---|
| **Unit** | `pytest` + `pytest-asyncio` | `tests/unit/test_*.py` | Pure functions (validators, transformers, formatters), business logic, Pydantic schema validations, error-handling paths, edge cases in algorithms. NO live DB, NO Redis, NO httpx network calls. |
| **Integration** | `pytest` + FastAPI `TestClient` + `httpx.AsyncClient` | `tests/integration/test_*.py` | Endpoint flows, real test DB (Alembic-applied), real Redis (test slot), authenticated session bootstrapping, mailpit assertions, ARQ job assertions. |

**What NOT to unit-test:** FastAPI route handlers (push to integration). Database queries (push to integration with real test DB). External API integrations (integration with `respx` or recorded fixtures). Pydantic AI agents that hit Anthropic API (integration with `agent.override(...)` + `TestModel`).

## The Ships-With-Tests Gate (the hard rule)

No PR opens, no QuickFix completes, no BugFix verifies, no Refactor closes, no DeliverFeature reaches G7 unless ALL six checks pass:

1. **Unit-layer green** — `uv run pytest tests/unit` returns exit 0 and the new ISCs have at least one assertion in `tests/unit/test_*.py` covering them. Evidence captured in PRD `## Verification`.
2. **Integration-layer green** — `uv run pytest tests/integration` returns exit 0 with the slot's docker-compose stack running. Evidence captured in PRD `## Verification`.
3. **`mcp__dos_fastapi__run_checks` clean** — runs ruff + mypy + pytest sequentially; returns no failures across the three.
4. **Async discipline** — every new async helper has `@pytest.mark.asyncio` on its test (or uses `async def test_*` with `asyncio_mode = "auto"` configured in `pyproject.toml`).
5. **Bootstrap-fixture usage** — integration tests use `test_user`, `superuser`, `async_db`, `async_client` fixtures from `tests/conftest.py` for auth + DB setup. UI-equivalent (full POST /login → cookie roundtrip) is tested ONLY when the test's purpose is the login flow itself.
6. **Per-ISC layer mapping documented** — PRD `## Decisions → ### Test Pyramid Plan` maps every ISC to a layer (`unit-covered`, `integration-covered`, `verification-only (justified)`, or `documentation-only`).

Failure on any of the six routes through the standard ISC-failure remediation path: original implementer (agent / backend / database / e2e by code ownership) re-spawned with surgical-fix constraint, 3-strike escalation to operator.

## Canonical Commands

Verbatim — workflows MUST cite these forms, never invent new test commands.

### Unit (pytest)

```bash
uv run pytest tests/unit                         # all unit tests
uv run pytest tests/unit -k "<keyword>"          # filter
uv run pytest tests/unit/test_<module>.py        # single file
uv run pytest tests/unit -x                      # stop on first failure
uv run pytest tests/unit --cov=src/app --cov-report=term-missing   # coverage
```

### Integration (pytest + TestClient + httpx)

```bash
# Pre-flight: slot containers running
make compose-dev-up                              # postgres + redis + mailpit + (optional) crud-admin
mcp__dos_fastapi__fork_status                    # confirm slot_match=true

# Run integration suite
uv run pytest tests/integration                  # full suite
uv run pytest tests/integration -k "<feature>"   # filter
uv run pytest tests/integration -x --tb=short    # iterate fast
```

### Health (catch-all)

```bash
mcp__dos_fastapi__run_checks                     # ruff check + mypy + pytest (full)
# Or shell-equivalent:
uv run ruff check src tests
uv run mypy src
uv run pytest
```

## File Conventions

| Concern | Convention |
|---|---|
| Unit test file | `tests/unit/test_<module>.py` (mirrors `src/app/<module>.py` topology) |
| Integration test file | `tests/integration/test_<feature>.py` (one feature per file) |
| Conftest | `tests/conftest.py` (top-level — global fixtures); per-subdir `conftest.py` for layer-specific fixtures |
| Async test marker | `@pytest.mark.asyncio` decorator (or `asyncio_mode = "auto"` in pyproject) |
| Naming for assertions | `assert response.status_code == 201`, `assert body["field"] == value` (no `unittest.assertEqual`) |
| Faker usage | `fake: Faker` fixture from conftest; never `Faker()` constructed inline |
| Async DB fixture | `async_db: AsyncSession` (yields a session bound to the test transaction; rolls back on test exit) |
| Async client fixture | `async_client: httpx.AsyncClient` (against the FastAPI `app` via ASGI transport) |
| Authenticated fixture | `test_user` (returns `(User, access_token)` tuple); `superuser` for admin scope |

## Bootstrap Fixtures (auth + DB shortcuts)

From `tests/conftest.py`. Use these instead of UI-flow login whenever the test's purpose is not the login flow itself.

| Fixture | Use when |
|---|---|
| `async_client` | Test needs to call FastAPI endpoints (no auth) |
| `test_user` | Test needs an authenticated user — yields `(user, access_token)` |
| `superuser` | Test needs an admin account — yields `(user, access_token)` |
| `async_db` | Test needs raw DB session — yields `AsyncSession` with auto-rollback |
| `fake` | Test needs Faker — yields shared `Faker` instance |
| `tier_basic`, `tier_premium` | Test needs a tier-bound user (rate-limit testing) |

## TestClient + httpx Pattern

```python
import pytest
from httpx import AsyncClient
from src.app.main import app


@pytest.mark.asyncio
async def test_create_user(async_client: AsyncClient, fake) -> None:
    payload = {
        "name": fake.name(),
        "username": fake.user_name(),
        "email": fake.email(),
        "password": "Strong-Password-1",
    }
    response = await async_client.post("/api/v1/users/", json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["username"] == payload["username"]
    assert "hashed_password" not in body  # security invariant

    # Round-trip: GET the user
    user_id = body["id"]
    get_response = await async_client.get(f"/api/v1/users/{user_id}")
    assert get_response.status_code == 200
```

## Mailpit Assertion Pattern

```python
@pytest.mark.asyncio
async def test_signup_sends_welcome_email(async_client, fake) -> None:
    email = fake.email()
    response = await async_client.post("/api/v1/users/", json={..., "email": email})
    assert response.status_code == 201

    # MCP-driven mailbox inspection (or HTTP fetch fallback to mailpit on slot's smtp_ui port)
    # via the dos-fastapi MCP server: mcp__dos_fastapi__list_mailbox
    # The orchestrator surfaces the mailbox dump back to the test via fixture or recorded payload.

    # Fallback: direct httpx call against mailpit
    import httpx
    async with httpx.AsyncClient() as client:
        mailbox = await client.get("http://localhost:8025/api/v1/messages")
    messages = mailbox.json()["messages"]
    welcome = next((m for m in messages if email in str(m["To"])), None)
    assert welcome is not None
    assert "Welcome" in welcome["Subject"]
```

## ARQ Background-Job Assertion Pattern

```python
import asyncio
from arq.jobs import JobStatus

@pytest.mark.asyncio
async def test_long_task_enqueues_and_completes(async_client, queue_pool) -> None:
    response = await async_client.post("/api/v1/tasks/task?message=hello")
    assert response.status_code == 201
    job_id = response.json()["id"]

    # Polling assertion — never fixed sleep
    for _ in range(30):  # ~30s budget
        from arq.jobs import Job
        job = Job(job_id, queue_pool)
        status = await job.status()
        if status == JobStatus.complete:
            result = await job.result()
            assert result == "hello"
            return
        await asyncio.sleep(1)
    raise AssertionError(f"Job {job_id} did not complete in 30s")
```

## Pydantic AI Agent Test Pattern

```python
from pydantic_ai.models.test import TestModel

@pytest.mark.asyncio
async def test_chat_agent_responds() -> None:
    from src.app.agents.service import get_chat_agent
    chat_agent = get_chat_agent()

    # Override the model with TestModel — no Anthropic API call
    with chat_agent.override(model=TestModel()):
        result = await chat_agent.run("hello")

    assert result.output  # TestModel returns synthetic structured response
```

## Do's and Don'ts

### Do's
- Each test creates its own data via Faker fixture
- Use polling assertions for async operations (ARQ jobs, mailpit) — never fixed sleeps
- Add descriptive test names: `test_create_user_with_duplicate_email_returns_409`
- Run tests locally with `-x --tb=short` before pushing
- Use `respx` to mock outbound httpx calls; use `TestModel` to mock Pydantic AI agents
- Use bootstrap fixtures for auth setup
- Run `mcp__dos_fastapi__run_checks` before declaring green

### Don'ts
- Don't create test dependencies between specs — each test must seed its own data
- Don't use vague names like `test_works`
- Don't leave `@pytest.mark.skip` without an `xfail` reason in the marker
- Don't unit-test FastAPI route handlers (push to integration)
- Don't unit-test database queries (push to integration with real test DB)
- Don't rely on transaction-isolation assumptions across separate sessions
- Don't issue real Anthropic API calls in agent tests — use `TestModel` or `agent.override`

## Per-ISC Layer Mapping Rubric

Every ISC in a change-producing workflow's PRD MUST be tagged with one of these four labels in the `### Test Pyramid Plan` table:

| Label | When |
|---|---|
| `unit-covered` | Pure logic, validators, transformers, Pydantic schema validations, error-path branches, business-rule helpers. pytest test in `tests/unit/test_<module>.py`. |
| `integration-covered` | Endpoint flow, auth boundary, real-DB query path, mailpit-asserted email flow, ARQ job round-trip, Pydantic AI agent endpoint. pytest test in `tests/integration/test_<feature>.py`. |
| `verification-only (justified)` | ISC verifiable by `mcp__dos_fastapi__run_checks`, `mcp__dos_fastapi__alembic_check`, `mcp__dos_fastapi__list_routes`, code-read inspection, or a non-test artifact. Justification (≤16 words) required in the table. |
| `documentation-only` | Doc / changelog / mdoc edit with no behavioral surface. Tests not applicable. |

The Test Pyramid Plan table goes in PRD `## Decisions → ### Test Pyramid Plan`:

```markdown
### Test Pyramid Plan

| ISC | Layer | Test path | Notes |
|---|---|---|---|
| ISC-1 | unit-covered | `tests/unit/test_password_validators.py` | regex edge cases |
| ISC-2 | integration-covered | `tests/integration/test_signup.py` | flow + mailpit assertion |
| ISC-3 | verification-only (justified) | `mcp__dos_fastapi__alembic_check` output | drift check; no behavior |
| ISC-4 | documentation-only | n/a | docs/auth.md only |
```

## QA + E2E Pyramid Reviewer Framing (PR loop)

When QA or E2E roles review a PR, in addition to their normal framing prompts (see `ReviewSinglePR.md` reviewer table), they MUST emit a **pyramid completeness check** for the diff:

- **QA** — for every changed file under `src/app/**` whose path doesn't have a matching `tests/unit/test_<basename>.py` or where the existing unit suite lacks coverage of the new code path, emit one TODO: `(agent:qa) (priority:high) Add pytest unit test for <function or module> in tests/unit/`. File-level heuristic only — no branch-coverage parsing.
- **E2E** — for every new user-facing endpoint added in the diff (signals: new route in `src/app/api/v1/`, new agent endpoint in `src/app/agents/`), check whether `tests/integration/` already contains a spec covering the flow. If absent, emit: `(agent:e2e) (priority:high) Add pytest integration test for <flow> in tests/integration/`.

These TODOs join the existing auto-CRITICAL stream from `mcp__dos_fastapi__run_checks` failures and follow the same TODO checklist markdown protocol from `_pr-loop-shared.md`.

## Anti-Patterns to Catch

- **Generic "test plan" with no layer mapping** — every QA-produced test plan MUST be a Test Pyramid Plan with the per-ISC table.
- **Integration-only coverage for business logic** — if logic is testable at the unit layer (pure function, no I/O), unit-test it. Integration is selective.
- **UI login round-trip used for auth setup** — use `test_user` / `superuser` fixtures; full POST /login round-trip is tested ONLY when the test's purpose is the login flow.
- **`@pytest.mark.asyncio` missing on `async def test_*`** — silently skipped or wrong-event-loop errors. Either add the marker or set `asyncio_mode = "auto"` in pyproject.
- **Real Anthropic API calls in tests** — flaky, slow, expensive. Use `TestModel` or `agent.override(model=TestModel())`.
- **Fixed `time.sleep()` in async tests** — replace with polling loop + timeout (see ARQ pattern above).
- **Test depends on prior test's state** — every test must seed its own data via Faker.
- **`SECRET_KEY` exposed in test output** — security invariant. Pydantic `SecretStr` masks it; assertions should not deref `.get_secret_value()` unless absolutely necessary.
