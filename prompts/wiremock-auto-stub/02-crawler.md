# Session 2 — Instance crawler

You are building the traffic generator: a Crawlee `PlaywrightCrawler` that
walks every reachable route of a launched mock-harness instance, plus a
gremlins.js interaction pass on each page so interaction-triggered API calls
(typeaheads, lazy panels, tab switches, form submits) fire too. Session 1
verified the control-plane endpoints and left a smoke instance running — read
its HANDOFF.md section first and reuse its instance id and endpoint shapes
verbatim.

You are NOT implementing the auto-stub convergence loop (session 3). Your
deliverable is: given an instance id, the crawler drives the app and API
traffic demonstrably lands in the instance's WireMock journal.

Because instance API calls terminate at WireMock mocks (zero-egress platform),
crawler-triggered mutations are harmless — no GET-only restriction is needed.
The blocklist below exists only to keep the crawl *productive* (not to protect
data): logging out kills the session; navigating off-host wastes the budget.

## Step 1 — Scaffold

Create `scripts/crawler/ui-crawler/` as its own pnpm package (do NOT touch the
existing GraphQL introspection tool next to it, and do NOT add these deps to
the root workspace package.json unless the workspace file already
auto-includes `scripts/*` — check `pnpm-workspace.yaml` / root `package.json`
first and note what you found in HANDOFF.md):

```bash
cd scripts/crawler/ui-crawler
pnpm init
pnpm add crawlee playwright gremlins.js
pnpm exec playwright install chromium   # skip if chromium already present
```

Add `scripts/crawler/ui-crawler/storage/` to `.gitignore` (Crawlee queue
state).

## Step 2 — Auth strategy

Instances authenticate via the platform's mock OIDC server, so there is no
real login form to automate. Determine, in this order, which of these applies
to the smoke instance (and record which in HANDOFF.md):

1. **App redirects to mock-auth and completes automatically** (mock-auth
   auto-issues without a consent screen — check `auth_stub.py` and just try
   loading the app in the crawler's browser). If so: allow navigations to
   `auth.localhost:3000` during the crawl (redirect hops) but never *enqueue*
   links from it, and you're done — no seeding needed.
2. **App expects a bearer token on API calls.** Fetch one from the control
   plane (`GET /instances/{id}/token`, shape per HANDOFF.md) at crawler
   startup, and inject `Authorization: Bearer <token>` on all requests to the
   instance host via Playwright's `context.setExtraHTTPHeaders` (Crawlee:
   `preNavigationHooks` → `page.setExtraHTTPHeaders`). Token goes in memory
   only — never into a file or log.
3. **App keeps the token in localStorage/cookie after an OIDC callback.** Do
   flow 1 once manually in the crawler context, then rely on the shared
   browser context to stay authed (`useSessionPool: false`, single context).

Implement whichever applies; if none works within the debugging budget, follow
the BLOCKED protocol in `00-context.md`.

## Step 3 — The crawler

Create `scripts/crawler/ui-crawler/crawl.mjs`. Requirements — implement all:

- **Inputs via env, with validation.** `INSTANCE_ID` (required; refuse to run
  without it), `CONTROL_PLANE_URL` (default `http://localhost:8000`),
  `CRAWL_MAX_PAGES` (default 200), `CRAWL_GREMLIN_MS` (default 15000),
  `CRAWL_SEED_ROUTES` (comma-separated, default empty). Build the base URL as
  `http://${INSTANCE_ID}.localhost:3000` — hard-fail if `INSTANCE_ID` contains
  anything but `[a-z0-9-]` (mirrors the platform's hostname-safe rule).
  Hard-fail if any derived URL's host does not end in `.localhost` or equal
  `localhost` — this is the safety rule from `00-context.md`; do not remove it.
- **Startup check.** Before crawling, `GET ${CONTROL_PLANE_URL}/instances/${INSTANCE_ID}`
  and require `status == "launched"`; print a clear error otherwise.
- **Crawl scope.** `enqueueLinks({ strategy: 'same-hostname' })` so the crawl
  never leaves the instance. Additionally allow (but never enqueue from)
  `auth.localhost` if Step 2 case 1 applies.
- **Per-page sequence** in `requestHandler`:
  1. `await page.waitForLoadState('networkidle').catch(() => {})`
  2. `enqueueLinks(...)`
  3. Inject gremlins from the local file
     (`node_modules/gremlins.js/dist/gremlins.min.js`, read once at startup —
     never from a CDN; hard rule 1) via `page.evaluate(gremlinsSrc)`.
  4. Unleash a horde for `CRAWL_GREMLIN_MS`: species `clicker`, `formFiller`,
     `scroller`; `clicker` with a `canClick` filter that refuses elements
     whose text contains: `logout`, `log out`, `sign out` (kills the session)
     — and refuses anchors pointing off-host. Mutations are safe (mocked), so
     do NOT blocklist delete/save/submit buttons.
  5. Log `pageUrl` and the count of enqueued links.
- **SPA route seeding.** After `crawler.run([...])` seeds: base URL plus each
  route in `CRAWL_SEED_ROUTES`. (Session 4 passes `KNOWN_UI_ROUTES` here.)
- **Exit summary.** Print pages visited, pages failed, total runtime. Exit
  non-zero if zero pages succeeded.

Add package scripts: `"crawl": "node crawl.mjs"`.

Where this prompt's API differs from the Crawlee version you install, the
installed version wins — check its docs/types rather than forcing these exact
option names, and note any renames in HANDOFF.md.

## Step 4 — Prove traffic lands in WireMock

1. Ensure the smoke instance from session 1 is still `launched` (relaunch with
   session 1's recorded command if not).
2. Reset the instance's request journal (endpoint per session 1 HANDOFF).
3. Quick crawl: `INSTANCE_ID=<id> CRAWL_MAX_PAGES=10 CRAWL_GREMLIN_MS=5000 pnpm crawl`.
4. Call `discover-unmatched` for the instance. Expectation: if the smoke app
   makes any API calls beyond its stubs, they appear; at minimum the journal
   is non-empty (session 1 HANDOFF says how to see the full journal vs. only
   unmatched — use whichever proves traffic arrived). Record counts in
   HANDOFF.md.
5. Check auth health: if every API call in the journal is a 401/403 response,
   Step 2 failed — fix it before finishing (this is the single most likely
   silent failure; do not skip this check).

**[COMMIT]** `feat(crawler): add Crawlee + gremlins instance crawler`

## Acceptance checklist

- [ ] `pnpm crawl` with a valid `INSTANCE_ID` visits pages, stays on `*.localhost`, and prints the exit summary
- [ ] Hostname safety check present and tested (set `INSTANCE_ID=../evil` → refuses to run; note the exact error in HANDOFF.md)
- [ ] Auth strategy determined, implemented, and journal shows non-401 API responses
- [ ] Crawl traffic demonstrably lands in the instance's WireMock journal (counts in HANDOFF.md)
- [ ] Gremlins runs per page from the locally bundled file; no external asset fetches added anywhere
- [ ] `storage/` gitignored; no token values in code, logs you kept, or HANDOFF.md
- [ ] HANDOFF.md updated: exact crawl command, auth case (1/2/3), Crawlee API deviations, failed routes and why
