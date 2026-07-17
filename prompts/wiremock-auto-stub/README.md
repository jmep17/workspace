# Mock-harness auto-crawl pipeline — session prompts

Goal: add **automatic crawling** to mock-harness so that launching an app
instance can be followed by one command that drives the app's UI, discovers
every API call it makes, auto-stubs the unmatched ones through the existing
control-plane endpoints, and converges on a complete, persisted stub set for
that repo/branch.

Mock-harness already has the hard parts: per-instance WireMock containers,
recording/discovery endpoints (`/instances/{id}/recordings/*`,
`{id}/discover-unmatched`, `{id}/auto-stub-unmatched`), stub-set persistence
in SQLite, and mocked OAuth. These sessions add the traffic generator and the
convergence loop on top — they do NOT rebuild any of that.

The work is split into four Claude Code sessions, run **in order**, each a
separate conversation in the **mock-harness repo**.

## Before running any session

1. Open `00-context.md` and fill in every field in the `PARAMETERS` block.
   Sessions must not guess these values.
2. Confirm you have: Docker running, `pnpm` installed, `make dev` working
   (host uvicorn :8000 + Vite :5173), and a GitHub token that can read the
   target org (`GITHUB_TOKEN` or `gh auth token`).

## Running the sessions

Start each session with exactly this message (change the number):

> Read `prompts/wiremock-auto-stub/00-context.md` in full, then read
> `prompts/wiremock-auto-stub/HANDOFF.md` if it exists, then execute
> `prompts/wiremock-auto-stub/01-recording-plumbing.md` step by step.

| Session | Prompt file | Produces |
|---|---|---|
| 1 | `01-recording-plumbing.md` | Verified map of the existing stub/recording endpoints; minimal gap-fill endpoints (+ tests) the crawler needs |
| 2 | `02-crawler.md` | Crawlee + gremlins crawler in `scripts/crawler/ui-crawler/`, authed against a launched instance |
| 3 | `03-crawl-and-autostub.md` | Crawl → discover-unmatched → auto-stub → reload loop that converges; persisted stub set; stub quality pass |
| 4 | `04-integrate-and-verify.md` | `make crawl INSTANCE=<id>` target, docs + ADR, AutoMockHelp update, end-to-end proof on a real org branch |

Each session appends a dated section to `prompts/wiremock-auto-stub/HANDOFF.md`
describing what it did, what it discovered (exact endpoint shapes, quirks),
and anything the next session must know. **Do not start session N+1 until
session N's acceptance checklist is fully checked.**

## Safety rules (repeated in every prompt, non-negotiable)

- All crawler traffic targets `*.localhost:3000` (Traefik) or `localhost:8000`
  (control plane) only. Instance API calls land on per-instance WireMock mocks
  under the platform's zero-egress design — nothing real is ever called, so
  mutations during crawling are safe. Never point the crawler at a
  non-localhost host, and never weaken the zero-egress setup to "fix" a crawl.
- Real secrets exist on the host: `GITHUB_TOKEN` and `BUILD_ARGS`. They must
  never appear in stub mappings, crawler logs, HANDOFF.md, or commits.
- Respect the repo's Hard Rules (restated in `00-context.md`): no external
  CDN/telemetry assets, `ids.py` validation for new untrusted inputs, additive
  SQLite migrations only, WireMock admin errors passed through verbatim.
