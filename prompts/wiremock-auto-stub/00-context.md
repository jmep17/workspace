# Shared context — read this in full before doing anything

You are one session in a four-session pipeline that records every API call our
frontend app makes and turns the recordings into WireMock stubs, so the app can
be developed offline. `README.md` in this directory explains the split. Your
session's prompt file tells you which part is yours. Do only your part.

## PARAMETERS (filled in by a human — if any field says FILL_ME, STOP and ask)

```
APP_NAME:            FILL_ME            # short name, used in file paths
APP_START_CMD:       FILL_ME            # e.g. "npm run dev"
APP_LOCAL_URL:       FILL_ME            # e.g. "http://localhost:3000"
API_STAGING_URL:     FILL_ME            # e.g. "https://api.staging.example.com" — MUST be staging
API_BASE_URL_CONFIG: FILL_ME            # how the app learns its API base URL today, e.g.
                                        # "env var VITE_API_URL" or "hardcoded in src/lib/api.ts"
AUTH_METHOD:         FILL_ME            # e.g. "email+password form at /login" or "OAuth redirect"
TEST_ACCOUNT:        FILL_ME            # where credentials live, e.g. "env vars CRAWL_USER / CRAWL_PASS"
KNOWN_ROUTES:        FILL_ME            # comma-separated app routes worth crawling, e.g. "/, /dashboard, /settings"
EXTRA_UPSTREAMS:     FILL_ME or "none"  # other API hosts the app calls besides API_STAGING_URL
```

## Fixed decisions — do not revisit, do not substitute alternatives

- Mock server: **WireMock standalone, Docker image `wiremock/wiremock:3.13.2`**.
  Do not upgrade/downgrade the version. Do not switch to MSW, nock, Prism, or
  anything else, even if you think it fits better.
- Crawler: **Crawlee (`PlaywrightCrawler`)** plus **gremlins.js** for
  per-page interaction fuzzing. No other crawler.
- All mock tooling lives under `tools/api-mocks/` in the app repo.
  Recorded stubs live in `tools/api-mocks/service-mocks/` (WireMock's
  `mappings/` and `__files/` go under there).
- WireMock listens on host port **8080** (admin API at
  `http://localhost:8080/__admin`). If 8080 is taken, use 8081 and record the
  change in HANDOFF.md.

## Working conventions for every session

1. Work on the current git branch. Commit at each milestone your prompt file
   marks with **[COMMIT]**, using the message given there.
2. When your prompt says "verify", actually run the command and check the
   output against the stated expectation. Never mark a checklist item done
   without having seen the expected output. If output differs, stop and debug
   that step; do not continue to the next step on top of a failed one.
3. If a step fails and 30 minutes of debugging doesn't fix it: write what you
   tried and the exact error into HANDOFF.md under a `## BLOCKED` heading,
   commit, and end the session by telling the user what is blocked. Do NOT
   invent a different architecture to route around the failure.
4. Before ending your session, append to `prompts/wiremock-auto-stub/HANDOFF.md`:
   a `## Session N — <date>` section containing: what you completed, exact
   paths of files you created/changed, any deviations from the prompt (with
   reasons), and facts the next session needs (discovered env var names,
   ports, quirks). Commit that too.
5. Do not modify prompt files other than HANDOFF.md.

## Safety rules — non-negotiable

- `API_STAGING_URL` must never be a production host. If you have any reason to
  suspect it is (the word "prod" anywhere, no "staging"/"sandbox"/"dev" marker,
  the same host the public site uses), STOP and ask the user before any
  recording or crawling.
- Automated traffic (crawler, gremlins) may only run while WireMock's recording
  filter restricts proxied traffic to `GET` (sessions 2 and 3 show the exact
  filter JSON). Never run the crawler with mutations unfiltered.
- Never commit files containing `Authorization` header values, `Set-Cookie`
  values, JWTs (strings matching `eyJ[A-Za-z0-9_-]+\.`), or API keys. Session 3
  owns sanitization, but every session must refuse to commit such content.
