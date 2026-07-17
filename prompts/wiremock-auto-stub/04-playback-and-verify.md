# Session 4 — Offline dev mode, unmatched policy, docs, final verification

Sessions 1–3 produced committed, sanitized stubs. You make playback a
first-class dev mode, decide what happens to unrecorded requests, document
everything, and prove the app runs with no network access to staging.

Read HANDOFF.md fully first — especially session 3's list of known-unmatched
endpoints.

## Step 1 — One-command offline dev mode

Add a `dev-offline` entry next to the scripts from session 1 (`package.json`
scripts / Makefile / justfile — whichever session 1 used) that:

1. starts WireMock (`mock-up`),
2. waits for `http://localhost:8080/__admin/health` to report healthy
   (poll loop, max 30s),
3. starts the app with the base-URL env var(s) pointing at the WireMock
   port(s) — exact command from HANDOFF.md session 1.

Verify it works from a clean state (`mock-down` first, then `dev-offline`).

## Step 2 — Unmatched-request policy

Decision (fixed, do not revisit): unmatched requests must **fail loudly**, not
fall through to the real network — that is how developers discover the app
makes a call nobody recorded. WireMock already returns 404 with a near-miss
diff by default; your job is to make that visible and actionable:

1. Work through session 3's known-unmatched list. For each endpoint, either:
   - it should have been recorded → record it now (targeted: start the app,
     trigger it, use the session-1 record scripts with a `urlPathPattern`
     filter for just that path), sanitize with `sanitize.mjs`, commit; or
   - it's third-party noise (analytics, error reporting) → add a explicit
     catch-all stub returning `200 {}` for that path with `"priority": 10`,
     so it stops polluting the unmatched log. Create these by hand in
     `mappings/third-party-noise.json` (one file, array form
     `{"mappings": [...]}` is fine).
2. Add a helper script `mock-unmatched` →
   `curl -s http://localhost:8080/__admin/requests/unmatched | <jq/python one-liner printing method + url per line>`
   so devs can ask "what did I just hit that isn't stubbed?".

After this step: run the app offline, walk every route in `KNOWN_ROUTES`, and
get `mock-unmatched` down to zero entries. That is the bar; iterate
(record → sanitize → commit) until you hit it.

## Step 3 — The offline proof

Prove the app no longer needs staging:

1. `mock-down && mock-up` (playback only), start the app via `dev-offline`.
2. Break access to staging for the app process — pick the simplest that works
   in this repo's environment and document which you used:
   - set the base-URL env var to WireMock and additionally set a bogus value
     for any fallback (e.g. point a second env var at `http://127.0.0.1:9`), or
   - add the staging hostname to `/etc/hosts` as `127.0.0.1` for the duration
     of the test (revert afterwards).
3. Walk all `KNOWN_ROUTES` plus the recorded mutation flows. Everything must
   render from stubs; `mock-unmatched` stays empty; zero requests reach staging.
4. Capture the evidence in HANDOFF.md: routes walked, unmatched count, how
   staging access was blocked.

## Step 4 — Documentation

Write `docs/api-mocking.md` (or the repo's equivalent docs location — check
for an existing docs convention first) covering, concretely and briefly:

- What this is: WireMock record/replay stubs so the app runs offline.
- Daily use: `dev-offline`, and `mock-unmatched` when something 404s.
- "I added a new API call, now what": the targeted re-record recipe
  (start recording with a path filter → trigger the call → stop → run
  `sanitize.mjs --fix` → commit the new mapping). Spell out each command.
- Full re-record: `npm run login && npm run crawl` against staging with
  recording on — copy the exact commands from HANDOFF.md; mention the GET-only
  filter and why it exists.
- Safety notes: staging only; sanitize before commit; what sanitize.mjs checks.
- Known limitations from HANDOFF.md (endpoints stubbed as noise, flows that
  need manual login, etc.).

**[COMMIT]** `feat: offline dev mode with WireMock playback + docs`

## Step 5 — Close out

Append the final HANDOFF.md section: state of the pipeline, the offline-proof
evidence, and a short list of future improvements you noticed but did not do
(do NOT do them). Commit and push the branch:
`git push -u origin <current branch>` (retry with backoff on network failure).

## Acceptance checklist

- [ ] `dev-offline` brings up WireMock + app in one command from a clean state
- [ ] Every session-3 unmatched endpoint either recorded or explicitly stubbed as noise
- [ ] Offline proof passed: all KNOWN_ROUTES + mutation flows work with staging unreachable, `mock-unmatched` empty
- [ ] `docs/api-mocking.md` written with exact commands (no placeholders left)
- [ ] `sanitize.mjs` run after any new recordings this session; exits 0
- [ ] Final HANDOFF.md section written; branch pushed
