# Session 1 — Verify the recording/auto-stub plumbing, fill crawler-facing gaps

Mock-harness already ships the stub/recording machinery. Your job is to
(a) verify it end-to-end against a live instance, (b) write down the *exact*
verified endpoint contracts so sessions 2–3 never guess, and (c) implement the
few small endpoints the crawler loop needs **only if they are missing**. You
are NOT building the crawler and NOT changing how WireMock containers are
launched.

## Step 1 — Read before running

Read, in this order (skim is fine, but you must be able to answer the
questions below from them):

1. `docs/ARCHITECTURE.md`
2. `control-plane/app/routes/stubsets.py` and `routes/instances.py`
3. `control-plane/app/wiremock.py`, `stubs.py`, `models.py`
4. `control-plane/tests/` — find the integration test that launches a real
   instance; note how it does it and whether it uses `fixtures/hello-flask`.

Answer in HANDOFF.md (with `file:line` references):
- Exact method+path+request/response shape of: stubs CRUD, `reload-stubs`,
  every `recordings/*` route, `discover-unmatched`, `auto-stub-unmatched`,
  `validate-stubs`, `GET /instances/{id}/token`.
- What `auto-stub-unmatched` generates for an unmatched request (status?
  body? priority? does it persist to a StubSet or only push to WireMock?).
- Whether the WireMock request journal can be reset per instance via any
  existing endpoint, and how `discover-unmatched` decides what is "unmatched"
  (full journal vs. since-last-call).
- How a launchable instance is created in dev: can `SMOKE_REPO` from
  PARAMETERS be launched through `POST /instances`, or is the fixture
  test-only? If test-only, name the smallest real org repo that works and use
  it as the smoke target for all sessions (record it in HANDOFF.md).

## Step 2 — Live verification

1. Start the stack: `make dev` (keep it running; Docker must be up).
2. Launch the smoke instance via the API (exact `curl` per your Step 1
   findings). Poll `GET /instances/{id}` until `status == "launched"`. Record
   the instance id in HANDOFF.md.
3. Confirm the app answers:
   `curl -s -o /dev/null -w '%{http_code}' http://<id>.localhost:3000/`
   → expect 200 (or the app's real landing status; record whatever it is).
4. Generate one unmatched request on purpose:
   `curl -s http://<id>.localhost:3000/api/definitely-not-stubbed-xyz`
   (adjust the path so it actually traverses the app's API→WireMock path — if
   the app only proxies known prefixes, pick an unstubbed path under a known
   prefix).
5. `discover-unmatched` for the instance → expect your request to appear.
   Paste the response into HANDOFF.md — this exact shape is the crawler
   loop's input.
6. `auto-stub-unmatched` → then re-issue the same curl → `discover-unmatched`
   again → expect it no longer unmatched. Also fetch the created stub via the
   stubs listing and paste its JSON into HANDOFF.md (sessions 3–4 need to know
   what auto-stubs look like: status code, body, priority).
7. `GET /instances/{id}/token` → confirm you get a token; decode the JWT
   payload (`base64 -d` the middle segment) and note the claim names and
   expiry in HANDOFF.md. Do NOT paste the full token anywhere.

## Step 3 — Gap analysis and minimal implementation

The crawler loop (session 3) needs exactly these capabilities. For each, mark
in HANDOFF.md "EXISTS: <route>" or implement it:

1. **List unmatched requests, machine-readable** — almost certainly
   `discover-unmatched` already is this. Only note its shape.
2. **Reset the request journal for an instance** — needed so each crawl round
   only sees its own unmatched traffic. If no existing route does this, add
   `POST /instances/{id}/requests/reset` to `stubsets.py`, implemented via a
   new `WireMockClient` method calling WireMock admin
   `DELETE /__admin/requests`. Follow the file's existing handler patterns;
   validate `{id}` the same way neighboring routes do (`ids.py`); pass
   WireMock errors through verbatim (hard rule 7 in `00-context.md`).
3. **Unmatched count without full bodies** (cheap convergence check) — if
   `discover-unmatched` returns full request objects, that is fine; do NOT add
   a count endpoint just for elegance. Only add one if the full response is
   demonstrably huge (>1 MB on the smoke instance).

For anything you add: pytest tests in `control-plane/tests/` following the
style of the existing stubsets tests (mock the WireMock client the same way
they do), plus a one-line entry in `docs/DECISIONS.md` matching its format.

`make test` must pass. **[COMMIT]** `feat(control-plane): <exact scope you added>`
— or, if nothing was missing, no code commit; just the HANDOFF update.

## Step 4 — Leave the environment ready

- Leave the smoke instance running (session 2 uses it) and record its id,
  URL, and the exact launch command in HANDOFF.md.
- If you launched anything else, stop it via the API (never `docker rm`).

## Acceptance checklist (all verified, not assumed)

- [ ] HANDOFF.md contains verified method+path+shape for every endpoint listed in Step 1, with `file:line` refs
- [ ] Live loop proven by hand: unmatched request seen in `discover-unmatched`, auto-stubbed, then no longer unmatched
- [ ] Example auto-generated stub JSON pasted into HANDOFF.md (status/body/priority noted)
- [ ] Journal-reset capability exists (found or implemented) and is documented in HANDOFF.md
- [ ] Any new code has pytest tests; `make test` passes; `docs/DECISIONS.md` updated
- [ ] Smoke instance running; id + URL + token-retrieval command in HANDOFF.md
- [ ] No secrets (GITHUB_TOKEN, full JWTs) in HANDOFF.md or commits
