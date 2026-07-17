# Session 3 — Crawl → auto-stub convergence loop, stub quality pass

Sessions 1–2 verified the plumbing and built the crawler. You build the loop
that runs them together until the instance has no unmatched API calls left,
then make the resulting stubs good enough that the app actually *works*
against them, and persist the result as a named stub set.

Read HANDOFF.md sessions 1–2 first: they contain the verified endpoint shapes,
the journal-reset route, the exact crawl command, and an example of what an
auto-generated stub looks like. Use those; do not guess.

## Step 1 — The convergence loop

Create `scripts/crawler/ui-crawler/crawl-and-stub.mjs` (same package as
session 2's crawler; reuse its code by import, don't duplicate). Contract —
implement exactly this, no creative extensions:

```
inputs: INSTANCE_ID (required, same validation as crawl.mjs),
        CONTROL_PLANE_URL, MAX_ROUNDS (default 5), plus all crawl.mjs vars
loop, for round = 1..MAX_ROUNDS:
  1. reset the instance's request journal        (session 1's route)
  2. run one full crawl                          (session 2's crawler, in-process)
  3. unmatched = GET discover-unmatched
  4. if unmatched is empty: print "converged after <round> rounds"; break
  5. print round summary: count + method+path of each unmatched request
  6. POST auto-stub-unmatched
  7. POST reload-stubs (only if session 1's HANDOFF says auto-stub does not
     already push live — follow what was verified, not this parenthetical)
after loop:
  - if still unmatched after MAX_ROUNDS: exit non-zero, print the survivors
    (this is a signal for a human, not an error to hide)
  - print total stubs created across all rounds
```

Notes for correctness:
- Convergence must compare against *this round's* unmatched set only — that
  is why the journal reset in step 1 exists. Do not accumulate across rounds.
- Requests to third-party-looking paths (analytics, telemetry) should not
  exist at all given zero-egress; if they appear in unmatched, list them in
  HANDOFF.md rather than silently stubbing around them.
- Add package script `"crawl-and-stub": "node crawl-and-stub.mjs"`.

Verify on the smoke instance: run it; expect convergence (a tiny app usually
converges in 1–2 rounds). Record rounds + stub counts in HANDOFF.md.

**[COMMIT]** `feat(crawler): crawl-and-stub convergence loop`

## Step 2 — Run against the real target

1. Launch `TARGET_ORG/TARGET_REPO@TARGET_BRANCH` via `POST /instances` (exact
   curl per session 1 HANDOFF). Wait for `launched`. If the launch itself
   fails (Dockerfile synthesis, build args), follow the BLOCKED protocol —
   fixing app builds is out of scope for this session.
2. Run the loop with seeds: `CRAWL_SEED_ROUTES=<KNOWN_UI_ROUTES>` (from
   PARAMETERS; omit if "auto"), full `CRAWL_MAX_PAGES`.
3. Record in HANDOFF.md: rounds to convergence (or survivors after
   MAX_ROUNDS), unmatched counts per round, total stubs created.

## Step 3 — Stub quality pass

Auto-generated stubs are skeletal (session 1's HANDOFF shows the exact shape —
typically a fixed status with an empty or generic body). An app that gets
`200 {}` where it expects `{"items": [...]}` renders a broken page. Fix the
ones that matter:

1. Open `http://<target-id>.localhost:3000` in a real browser. Walk the main
   routes. Open devtools console + network tab.
2. For every page that errors or renders obviously broken: find the API
   response it choked on, and improve that stub via the control plane's stub
   update route (PUT, shape per session 1 HANDOFF) — give it a minimal
   plausible body (right top-level shape, 1–2 fake items, obviously fake
   strings like `"Example Item"`). Keep the auto-stub's priority unless
   session 1's HANDOFF shows priorities would make your edit invisible.
3. Judgment rule for a weaker model: fix stubs ONLY where you observed
   breakage in the browser. Do not speculatively enrich stubs that no page
   complained about. When unsure what shape the app expects, read the app's
   fetch call in its source (the instance clone is under the control plane's
   workdir — session 1 HANDOFF notes the path) rather than inventing.
4. If an endpoint clearly belongs to "every app of this org always calls it"
   (auth/userinfo, feature flags), note it in HANDOFF.md as a candidate for
   `_add_missing_stubs()` in `lifecycle.py` — hard rule: that is the durable
   home for such stubs. Do NOT edit `lifecycle.py` yourself unless the fix is
   a single obvious addition following the existing entries' exact pattern;
   if you do, add/extend a pytest test and run `make test`.

## Step 4 — Persist and validate

1. Save the tuned stubs as a stub set named
   `<TARGET_REPO>-<TARGET_BRANCH>-crawl-r1` via the stub-set create route
   (shape per session 1 HANDOFF).
2. Run `/validate-stubs` against the saved set → must pass; paste failures
   into HANDOFF.md if any and fix before committing.
3. Secret sweep over anything you are about to commit (loop code, any stub
   JSON checked into the repo, HANDOFF.md):
   `grep -rE 'ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}' <paths>` →
   zero hits required. (Stub sets living only in SQLite are not committed;
   sweep applies to whatever lands in git.)

**[COMMIT]** `feat(crawler): auto-stub run for <TARGET_REPO>@<TARGET_BRANCH> + stub quality fixes`

## Acceptance checklist

- [ ] Loop implemented per the contract (journal reset per round, MAX_ROUNDS bound, non-zero exit on non-convergence)
- [ ] Smoke instance converges; rounds + counts in HANDOFF.md
- [ ] Real target crawled; per-round unmatched counts in HANDOFF.md
- [ ] Main routes of the target render without console errors caused by stub responses (walked in a real browser; list of pages checked in HANDOFF.md)
- [ ] Stub set persisted with the prescribed name; `/validate-stubs` passes
- [ ] `_add_missing_stubs()` candidates listed in HANDOFF.md (and if any were added: pattern-following edit + test + `make test` green)
- [ ] Secret sweep clean; HANDOFF.md updated with target instance id and any survivors/quirks for session 4
