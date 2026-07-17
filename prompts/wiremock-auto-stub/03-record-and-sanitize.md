# Session 3 — Full recording run, sanitization, and commit

Sessions 1–2 built the proxy and the crawler. You run the real recording,
then make the output safe and stable enough to commit. Read HANDOFF.md
sections from sessions 1 and 2 first — they contain the exact commands.

## Step 1 — Full GET recording run

1. `mock-up`, `mock-record` (GET filter stays ON).
2. Start the app pointed at the proxy (command from HANDOFF.md).
3. Run the crawler at full size: `npm run login && npm run crawl` with
   `CRAWL_MAX_PAGES=200` (or higher if HANDOFF.md session 2 suggests the app
   is bigger) and default `CRAWL_GREMLIN_MS`.
4. `mock-stop`. Record the mapping count in HANDOFF.md.

## Step 2 — Targeted mutation recording (human-in-the-loop)

Automated crawling must never record mutations, but the app needs POST/PUT/
DELETE stubs for its core flows. Do this instead:

1. Ask the user for a short list of mutation flows that matter (e.g. "create
   an item", "update settings"). If the user is unavailable, derive 3–5
   candidates from the app's UI and list them in HANDOFF.md, but do NOT
   execute any flow whose effect you can't undo on staging.
2. Start a second recording **without** the GET filter but with a path filter
   scoped to the API paths those flows use:
   `curl -sf -X POST http://localhost:8080/__admin/recordings/start -H 'Content-Type: application/json' -d '{"targetBaseUrl":"<API_STAGING_URL>","filters":{"urlPathPattern":"/api/.*"},"requestBodyPattern":{"matcher":"equalToJson","ignoreExtraElements":true},"repeatsAsScenarios":true,"persist":true}'`
   (adjust `urlPathPattern`; note `repeatsAsScenarios: true` here so
   read-after-write sequences replay correctly).
3. Drive each flow yourself with Playwright (a short throwaway script per
   flow, stepping through the UI), or ask the user to click through them.
   NO crawler, NO gremlins during this recording.
4. `mock-stop`.

## Step 3 — Sanitization (blocking; nothing is committed until this passes)

Write `tools/api-mocks/sanitize.mjs` (node, no deps) that walks every JSON
file under `service-mocks/mappings/` and every file under
`service-mocks/__files/` and:

1. **Deletes captured auth material.** In each mapping: remove any
   `request.headers.Authorization` / `Cookie` matchers; remove
   `response.headers["Set-Cookie"]`; note each removal to stdout.
2. **Flags secrets it can't safely auto-fix.** Regex-scan all files for:
   - JWTs: `eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+`
   - bearer-ish tokens: `(?i)(api[_-]?key|token|secret|password)"\s*:\s*"[^"]{8,}`
   - the test account's email/username (read from env, same vars as TEST_ACCOUNT)
   Print file + line for every hit and exit non-zero if any hit remains.
3. **Replaces flagged values** in response bodies with obvious fakes
   (`"REDACTED_TOKEN"`, `"user@example.test"`) when run with `--fix`.

Run it, apply `--fix`, re-run until it exits 0. Then do a manual spot check:
open 5 random mapping files and 5 `__files` bodies and read them — the regexes
are a floor, not a guarantee. Look for personal data (names, emails, IDs that
look real) and redact.

## Step 4 — Matcher loosening and dedup

Recorded matchers are stricter than replay needs. For each mapping file:

1. If the request matcher includes volatile query params (timestamps `_t=`,
   cache busters, request IDs), replace the exact `url` with `urlPath` +
   `queryParameters` entries only for params that matter, or drop the param
   matching entirely. Heuristic: a param whose value looks like a timestamp,
   UUID, or random hex is volatile.
2. Delete duplicate mappings: same method + same `urlPath`/`url` + same
   response body hash → keep one. (Write a small script; don't eyeball 200
   files.) Report the before/after count.
3. Do NOT hand-edit response bodies beyond sanitization.

This step is mechanical but judgment-based; when unsure whether a matcher
element is load-bearing, keep it and note it in HANDOFF.md rather than
deleting.

## Step 5 — Replay smoke test, then commit

1. Restart clean: `mock-down`, `mock-up` (no recording started — WireMock now
   serves from the mappings on disk).
2. Start the app pointed at the proxy. Click through the main routes from
   `KNOWN_ROUTES` and one recorded mutation flow.
3. Check the near-miss log: `curl -s http://localhost:8080/__admin/requests/unmatched | head -100`.
   A handful of unmatched requests is expected (session 4 handles policy);
   dozens means step 4 over-loosened or under-loosened — fix before commit.
4. `sanitize.mjs` one final time (exit 0 required).

**[COMMIT]** `feat: record and sanitize WireMock stubs for <APP_NAME>`
(This commit includes `service-mocks/mappings/`, `service-mocks/__files/`,
`sanitize.mjs`, and any dedup script.)

## Acceptance checklist

- [ ] Full crawl recording completed; mapping count in HANDOFF.md
- [ ] Mutation flows recorded in a separate supervised pass with `repeatsAsScenarios: true`
- [ ] `sanitize.mjs` exists, exits 0; manual spot check of 10 files done
- [ ] No Authorization/Set-Cookie/JWT/API-key material anywhere under `service-mocks/` (`grep -rE 'eyJ[A-Za-z0-9_-]{10,}\.' tools/api-mocks/service-mocks/` returns nothing)
- [ ] Volatile params loosened; duplicates removed; before/after counts in HANDOFF.md
- [ ] Replay smoke test: main routes render from stubs; unmatched-request list reviewed
- [ ] Stubs committed; HANDOFF.md updated (counts, loosening decisions, known-unmatched endpoints for session 4)
