# Shared context — read this in full before doing anything

You are one session in a four-session pipeline that adds automatic UI crawling
to **mock-harness**, so that a launched app instance can be auto-driven until
every API call it makes is discovered and stubbed. `README.md` in this
directory explains the split. Your session's prompt file tells you which part
is yours. Do only your part.

## The platform you are working inside

Mock-harness launches GitHub-org app branches as Docker containers, each
paired with its own WireMock container that mocks the app's APIs, plus a mock
OAuth2/OIDC server. Key facts you must not rediscover from scratch:

- Control plane: FastAPI app (`control-plane/app/`), reachable at
  `http://localhost:8000` under `make dev`. Interactive API docs at
  `http://localhost:8000/docs` — use them to confirm exact routes/verbs.
- Instances: `http://<instance-id>.localhost:3000` via Traefik. Launched with
  `POST /instances` `{org, repo, branch}`; status polled via
  `GET /instances/{id}`.
- Stub/recording endpoints live in `control-plane/app/routes/stubsets.py`:
  stubs CRUD under `/instances/{id}/stubs*`, plus `{id}/reload-stubs`,
  `{id}/recordings/*`, `{id}/discover-unmatched`, `{id}/auto-stub-unmatched`,
  and `/validate-stubs`. WireMock's admin API has **no host port** — all
  WireMock interaction goes through these control-plane endpoints
  (`control-plane/app/wiremock.py` is the client). Never bypass them.
- Auth: instances authenticate against the mock OIDC server
  (`auth.localhost:3000`, code in `auth_stub.py`); a token for an instance is
  available from `GET /instances/{id}/token`.
- Stub priorities: auto-generated-from-OpenAPI stubs are priority 5, curated
  "missing stubs" (hardcoded in `_add_missing_stubs()` in `lifecycle.py`) are
  priority 4 (lower number wins in WireMock).
- Tooling: Python via `make test` (pytest, `control-plane/tests/`); JS via
  **pnpm** (never npm/yarn). `make dev` for host hacking, `make up` for full
  containers. Docs conventions: `docs/ARCHITECTURE.md`, `docs/adr/` for
  decision records, `docs/DECISIONS.md` for the autonomous-decision log.

A NOTE ON TRUST: the summary above is believed correct but the code is the
authority. Session 1 verifies the exact endpoint shapes and writes them into
HANDOFF.md; later sessions use HANDOFF.md, not guesses.

## PARAMETERS (filled in by a human — if any field says FILL_ME, STOP and ask)

```
TARGET_ORG:      FILL_ME           # GitHub org for the real-app crawl target
TARGET_REPO:     FILL_ME           # an org app with a browser UI (used in sessions 2-4)
TARGET_BRANCH:   FILL_ME           # branch to launch, e.g. "main"
SMOKE_REPO:      FILL_ME or "fixtures/hello-flask"
                                   # smallest launchable app for smoke tests; session 1
                                   # determines whether the fixture can be launched via the
                                   # API or only via integration tests, and records the answer
KNOWN_UI_ROUTES: FILL_ME or "auto" # comma-separated routes of TARGET_REPO worth seeding
                                   # into the crawl, e.g. "/, /dashboard"; "auto" = links only
```

## Fixed decisions — do not revisit, do not substitute alternatives

- Crawler: **Crawlee `PlaywrightCrawler`** plus **gremlins.js** for per-page
  interaction fuzzing. No other crawler, no Puppeteer, no Selenium.
- Crawler code lives in `scripts/crawler/ui-crawler/` as its own pnpm package
  (a sibling of the existing GraphQL introspection tool in `scripts/crawler/`;
  do not modify that tool).
- All stub/recording operations go through control-plane HTTP endpoints, never
  directly against a WireMock container.
- The crawl loop's contract is: crawl → `discover-unmatched` →
  `auto-stub-unmatched` → `reload-stubs` → re-crawl, until no new unmatched
  requests appear (bounded rounds). Session 3 implements it exactly so.
- New backend endpoints (if session 1 needs any) follow existing patterns in
  `routes/stubsets.py`, validate inputs via `ids.py`, and ship with pytest
  tests in the same commit.

## Repo hard rules (from the project; violating these fails review)

1. No external dependencies at runtime: no telemetry, no CDN assets, no
   external font loads. The crawler's npm deps are dev-time and local — fine —
   but nothing it does may add external fetches to the platform or UI.
2. All untrusted input (org/repo/branch/instance-id) validated via `ids.py`;
   Docker calls via SDK or list-form subprocess, never `shell=True`.
3. Instance IDs are hostname-safe; reserved names live in `ids.RESERVED`.
4. SQLite schema changes: additive only, via `db._migrate()`.
5. When an app calls an undocumented endpoint that should always be stubbed,
   the durable fix is `_add_missing_stubs()` in `lifecycle.py` (priority 4) —
   not a one-off stub in a stub set.
6. In request-body validation code, use `object` type, not concrete types.
7. Pass WireMock admin API error responses through verbatim.

## Working conventions for every session

1. Work on the current git branch. Commit at each milestone marked **[COMMIT]**
   with the message given there. Run `make test` before every commit that
   touches `control-plane/`; it must pass.
2. When your prompt says "verify", actually run the command and check the
   output against the stated expectation. Never mark a checklist item done
   without having seen the expected output. If output differs, stop and debug
   that step; do not continue on top of a failed one.
3. If a step fails and 30 minutes of debugging doesn't fix it: write what you
   tried and the exact error into HANDOFF.md under a `## BLOCKED` heading,
   commit, and end the session telling the user what is blocked. Do NOT invent
   a different architecture to route around the failure.
4. Before ending your session, append to `prompts/wiremock-auto-stub/HANDOFF.md`
   a `## Session N — <date>` section: what you completed, exact paths touched,
   deviations (with reasons), and facts the next session needs (verified
   endpoint shapes, instance IDs used, quirks). Commit that too.
5. Do not modify prompt files other than HANDOFF.md.

## Safety rules — non-negotiable

- The crawler may only ever target hosts matching `*.localhost:3000`,
  `localhost:3000`, or `localhost:8000`. Refuse anything else, including
  values smuggled in via env vars. Instance API traffic terminates at
  per-instance WireMock mocks (zero-egress platform), so crawler-triggered
  mutations are safe by design — that safety derives from the architecture;
  never weaken zero-egress or point an instance at a real backend to "fix" a
  crawl problem.
- `GITHUB_TOKEN` and `BUILD_ARGS` are real host secrets. They must never
  appear in stub mappings, stub sets, crawler output, HANDOFF.md, or any
  commit. Before each commit that adds stub data, run:
  `grep -rE 'ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}' <paths>` and
  require zero hits. Mock-auth JWTs are fake and fine to commit in test
  fixtures, but don't commit them gratuitously.
- Do not stop/delete instances you didn't launch; other work may be using them.
