# Session 4 — Integration, docs, and end-to-end proof

Sessions 1–3 produced a working crawl→auto-stub loop and a tuned stub set for
the target branch. You make the workflow a first-class part of mock-harness:
one command, documented where this repo documents things, provable from a
clean start.

Read HANDOFF.md fully first — especially session 3's survivors list and
`_add_missing_stubs()` candidates.

## Step 1 — `make crawl` target

Add to the repo `Makefile`, following its existing style (look at how
`verify-routing` shells out to `scripts/`):

```make
crawl:  ## Crawl an instance and auto-stub unmatched calls: make crawl INSTANCE=<id>
	@test -n "$(INSTANCE)" || (echo "usage: make crawl INSTANCE=<instance-id>" && exit 1)
	cd scripts/crawler/ui-crawler && INSTANCE_ID=$(INSTANCE) pnpm crawl-and-stub
```

Match the Makefile's real conventions (tabs, `##` help comments if it uses
them, variable passthrough for `CRAWL_MAX_PAGES` etc. if other targets pass
variables through). Also pass through `CRAWL_SEED_ROUTES`, `MAX_ROUNDS`, and
`CONTROL_PLANE_URL` so `make dev` vs `make up` setups both work — session 1's
HANDOFF says which control-plane URL applies in each mode; default correctly.

Verify: `make crawl` with no INSTANCE prints usage and exits 1;
`make crawl INSTANCE=<smoke-id>` runs the loop end to end.

**[COMMIT]** `feat: make crawl target for instance auto-stubbing`

## Step 2 — Documentation, in this repo's places

This repo has established documentation homes; use all of them, briefly:

1. **README.md** — add a short "Auto-crawl an instance" subsection to the
   existing workflow docs: what it does (drives the UI, auto-stubs unmatched
   calls until convergence), the one command, the env knobs, and the two
   caveats (auto-stubs are skeletal until tuned; non-convergence exits
   non-zero and prints survivors).
2. **docs/ARCHITECTURE.md** — add `scripts/crawler/ui-crawler/` to the
   file-by-file guide, matching the existing entry format.
3. **docs/adr/** — one ADR, matching the numbering/format of existing ADRs:
   decision to use Crawlee+gremlins driving the existing control-plane
   auto-stub endpoints, alternatives considered (record-mode proxying against
   real backends — rejected: zero-egress; Playwright-only crawl without
   fuzzing — rejected: misses interaction-triggered calls), consequences
   (crawler is host-side dev tooling, not a container service).
4. **ui/src/components/AutoMockHelp.jsx** — this help panel documents the
   auto-mock workflow for users. Read it; if it describes the manual
   discover/auto-stub flow, add a sentence + the `make crawl INSTANCE=<id>`
   command as the automated alternative. Match the component's existing tone
   and markup exactly; no new dependencies, no external links (hard rule 1).
   Verify the UI still builds: `cd ui && pnpm build`.

**[COMMIT]** `docs: document auto-crawl workflow (README, ARCHITECTURE, ADR, help panel)`

## Step 3 — Clean-start end-to-end proof

Prove the whole feature from nothing, exactly as a new user would hit it:

1. `make clean`, then `make dev` (or `make up` if session 1's HANDOFF flagged
   dev-mode quirks — use whichever mode the sessions actually validated, and
   say which in HANDOFF.md).
2. Launch `TARGET_ORG/TARGET_REPO@TARGET_BRANCH` fresh via `POST /instances`.
3. `make crawl INSTANCE=<new-id>` — expect convergence within `MAX_ROUNDS`
   (session 3's HANDOFF says how many rounds this app needed; a fresh
   instance should need the same or fewer if stub sets persisted, more if
   stubs start from scratch — observe and record which happened; this tells
   you whether stub sets auto-apply on launch, an important fact for the
   HANDOFF).
4. Open the instance in a browser, walk the main routes: no blank pages, no
   console errors caused by stub responses.
5. `make test` — green. `cd ui && pnpm build` — green.
6. Record all evidence in HANDOFF.md: commands, rounds, final unmatched
   count, pages walked.

## Step 4 — Close out

1. Final HANDOFF.md section: state of the pipeline, the clean-start evidence,
   session 3's unresolved survivors (if any), and a short list of future
   improvements you noticed but did not do (do NOT do them — likely entries:
   stub-set auto-apply on launch if it turned out not to exist, a UI button
   for crawling, CI integration).
2. Secret sweep on everything committed this session:
   `grep -rE 'ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}' <changed paths>` → zero hits.
3. Commit, then push the branch:
   `git push -u origin <current branch>` (on network failure retry up to 4
   times with 2s/4s/8s/16s backoff).
4. Stop instances you launched during these sessions via the API (never
   `docker rm`), leaving the environment as you found it.

## Acceptance checklist

- [ ] `make crawl INSTANCE=<id>` works from both a fresh shell and the documented dev mode; missing-INSTANCE case prints usage
- [ ] README, ARCHITECTURE.md, ADR, and AutoMockHelp.jsx all updated in their existing formats; `pnpm build` (ui) green
- [ ] Clean-start proof passed: fresh instance → `make crawl` → convergence → browsable app; evidence in HANDOFF.md
- [ ] Whether stub sets auto-apply on fresh launch is now a recorded fact in HANDOFF.md
- [ ] `make test` green; secret sweep clean
- [ ] Final HANDOFF.md section written; branch pushed; borrowed instances stopped
