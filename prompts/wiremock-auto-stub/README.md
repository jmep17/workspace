# WireMock auto-stub pipeline — session prompts

Goal: stand up a record-and-replay mock of every API our app calls, using
WireMock as a recording reverse proxy and an automated crawler (no E2E tests
exist) to generate the traffic. End state: `make mock-playback` (or the npm
equivalent) lets anyone develop the app fully offline against committed stubs.

The work is split into four Claude Code sessions, run **in order**. Each
session is a separate conversation in the **target app repo** (not this
workspace repo — copy the whole `prompts/wiremock-auto-stub/` directory into
the app repo first, or reference it by path).

## Before running any session

1. Open `00-context.md` and fill in every field in the `PARAMETERS` block.
   Sessions must not guess these values.
2. Confirm you have: Docker running, a **staging** deployment of the backend
   (never production), and test-account credentials for the app.

## Running the sessions

Start each session with exactly this message (change the number):

> Read `prompts/wiremock-auto-stub/00-context.md` in full, then read
> `prompts/wiremock-auto-stub/HANDOFF.md` if it exists, then execute
> `prompts/wiremock-auto-stub/01-recording-infra.md` step by step.

| Session | Prompt file | Produces |
|---|---|---|
| 1 | `01-recording-infra.md` | WireMock docker-compose, record/playback scripts, app base-URL wiring |
| 2 | `02-crawler.md` | Crawlee crawler + gremlins interaction pass, auth session seeding |
| 3 | `03-record-and-sanitize.md` | Recorded stub mappings, secret sanitization, matcher loosening, committed stubs |
| 4 | `04-playback-and-verify.md` | Offline dev mode, unmatched-request policy, docs, end-to-end verification |

Each session appends a dated section to `prompts/wiremock-auto-stub/HANDOFF.md`
describing what it did, what it discovered, and anything the next session must
know. **Do not start session N+1 until session N's acceptance checklist (at the
bottom of its prompt file) is fully checked.**

## Safety rules (repeated in every prompt, non-negotiable)

- Recording proxies real traffic to the backend named in `PARAMETERS`. That
  must be a staging/sandbox environment. Never point recording at production.
- The crawler and monkey-tester click things. First recording pass is
  GET-only (enforced by a WireMock recording filter). Mutations are recorded
  in a separate, human-supervised pass.
- Recorded mappings may contain tokens, cookies, and PII. Nothing under the
  stub directory is committed until session 3's sanitization checklist passes.
