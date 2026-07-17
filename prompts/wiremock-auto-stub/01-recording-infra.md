# Session 1 — Recording infrastructure

You are setting up WireMock as a recording reverse proxy and wiring the app to
route its API traffic through it. You are NOT building the crawler (session 2)
and NOT recording real stubs yet (session 3). A smoke-test recording at the end
of this session is expected and fine; delete it before finishing.

Prerequisite reading (already done if you followed README): `00-context.md`.

## Step 1 — Find how the app resolves its API base URL

`API_BASE_URL_CONFIG` in PARAMETERS tells you where to look. Verify it:

1. Grep the app source for the staging host and for common patterns:
   `grep -rn "API_STAGING_URL-hostname" src/` and
   `grep -rniE "baseURL|API_URL|API_BASE" src/ --include='*.{ts,tsx,js,jsx,py}'`
2. Identify the single place the base URL enters the code. Write the file path
   and line into HANDOFF.md.

Outcome A — it's already an env var: note the variable name and move on.

Outcome B — it's hardcoded: refactor to an env var with the hardcoded value as
default, e.g. `const API_BASE = import.meta.env.VITE_API_URL ?? "https://<old value>"`
(adapt to the app's config system — Vite/Next/CRA read env differently; match
whatever the app already uses elsewhere for env config). Change nothing else.
Verify: `APP_START_CMD` still starts and the app still works against staging
with the env var unset. **[COMMIT]** `chore: read API base URL from env var`

If `EXTRA_UPSTREAMS` is not "none", repeat for each extra upstream and record
each variable name in HANDOFF.md. Each upstream will get its own WireMock
container on its own port (8080, 8180, 8280, ...).

## Step 2 — Docker compose for WireMock

Create `tools/api-mocks/docker-compose.yml`:

```yaml
services:
  wiremock:
    image: wiremock/wiremock:3.13.2
    ports:
      - "8080:8080"
    volumes:
      - ./service-mocks:/home/wiremock
    command: ["--verbose"]
```

One additional service per extra upstream (ports 8180, 8280, ...; volume
`./service-mocks-<name>`). Create `tools/api-mocks/service-mocks/mappings/.gitkeep`
and `tools/api-mocks/service-mocks/__files/.gitkeep`.

Verify:
- `docker compose -f tools/api-mocks/docker-compose.yml up -d`
- `curl -s http://localhost:8080/__admin/health` → JSON containing `"status" : "healthy"` (WireMock 3.x).

## Step 3 — Record / playback control scripts

Create `tools/api-mocks/record-start.sh`, `record-stop.sh` (make both
executable). WireMock in this setup always runs the same way; record vs
playback is controlled through the admin API:

`record-start.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
TARGET="${1:?usage: record-start.sh <target-base-url> [port]}"
PORT="${2:-8080}"
curl -sf -X POST "http://localhost:${PORT}/__admin/recordings/start" \
  -H 'Content-Type: application/json' \
  -d '{
    "targetBaseUrl": "'"${TARGET}"'",
    "filters": { "method": "GET" },
    "requestBodyPattern": { "matcher": "equalToJson", "ignoreExtraElements": true },
    "repeatsAsScenarios": false,
    "persist": true
  }'
echo "Recording GET traffic, proxying to ${TARGET}"
```

Note the `"method": "GET"` filter — this is the safety rule from
`00-context.md`. Do not remove it. (Session 3 handles mutations separately.)

`record-stop.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
PORT="${1:-8080}"
curl -sf -X POST "http://localhost:${PORT}/__admin/recordings/stop"
echo
echo "Mappings now on disk:"
ls tools/api-mocks/service-mocks/mappings/ | grep -v .gitkeep | wc -l
```

Add convenience entries where the repo keeps its scripts (`package.json`
scripts, `Makefile`, or `justfile` — match what exists; if none exists, use a
`Makefile`):

- `mock-up`      → `docker compose -f tools/api-mocks/docker-compose.yml up -d`
- `mock-down`    → `docker compose -f tools/api-mocks/docker-compose.yml down`
- `mock-record`  → `tools/api-mocks/record-start.sh $API_STAGING_URL`
- `mock-stop`    → `tools/api-mocks/record-stop.sh`
- `mock-reset`   → `curl -sf -X POST http://localhost:8080/__admin/mappings/reset` (reloads mappings from disk)

**[COMMIT]** `feat: add WireMock recording proxy infrastructure`

## Step 4 — Smoke test the full loop

1. `mock-up`, then `mock-record`.
2. Point the app at WireMock: start it with the env var from step 1 set to
   `http://localhost:8080` (e.g. `VITE_API_URL=http://localhost:8080 npm run dev`).
   Record the exact command in HANDOFF.md — session 2 and 3 will reuse it verbatim.
3. Open `APP_LOCAL_URL` in a browser (or `curl` one known API path through
   the proxy: `curl -s http://localhost:8080/<some-known-GET-path>`). Expect a
   real staging response to come back through the proxy.
4. `mock-stop`. Expect the mapping count printed to be ≥ 1.
5. Inspect one file in `tools/api-mocks/service-mocks/mappings/` — it must
   contain the request matcher and response you saw.
6. Clean up the smoke test: delete everything under `mappings/` and `__files/`
   except `.gitkeep` (session 3 records for real), then `mock-reset`.

CORS note: if the browser app fails with CORS errors when pointed at WireMock,
add `--enable-stub-cors` to the `command:` list in docker-compose.yml, restart,
and note this in HANDOFF.md.

## Acceptance checklist (all must be verified, not assumed)

- [ ] App reads API base URL(s) from env var(s); names recorded in HANDOFF.md
- [ ] `mock-up` starts WireMock; `/__admin/health` reports healthy
- [ ] `mock-record` → traffic through proxy → `mock-stop` produced ≥ 1 mapping in the smoke test
- [ ] Recording filter restricts to GET (visible in record-start.sh)
- [ ] Smoke-test mappings deleted; `mappings/` and `__files/` contain only `.gitkeep`
- [ ] HANDOFF.md updated (env var names, exact app-under-proxy start command, port map, CORS flag if needed) and committed
