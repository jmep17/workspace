# Mission: Many branches, one port

## Why

Jorden wants to keep a stable branch of an app running while spinning up feature
branches for QA review — and compare branches side-by-side in the browser — but the
app's OAuth provider accepts **exactly** `http://localhost:3000/...` as the
redirect_uri and errors on anything else, even in development mode. The goal is to
genuinely understand the networking and OAuth mechanics involved, then build a
reliable multi-branch dev setup on top of that understanding.

## Success looks like

- Can explain *why* ports 3001/3002 and `feature.localhost` break the OAuth flow, citing the actual rule (RFC 9700 exact string matching)
- Can run a reverse proxy that owns `localhost:3000` and routes to N branches running on internal ports
- Can log in via OAuth on two different branches at the same time (e.g. two browser profiles) and compare them live
- Can spin up a new branch (worktree → port → proxy entry) in under a minute
- Can clone the setup on the work laptop and have the doorman running with one command (`docker compose up`) — no host-installed tooling beyond Docker

## Constraints

- Mechanics-first: build up from how ports, sockets, and redirect_uri validation work — no cargo-culted configs
- Stack is Next.js/Node dev servers *and* a SPA + separate API; examples should cover both
- macOS (Darwin), fish shell; a second (work) laptop must be able to run the same setup
- Prefer Docker Compose as the delivery mechanism — the setup should be a portable, checked-in artifact, not host configuration

## Out of scope

- Changing the OAuth provider's configuration (treat the exact-match redirect_uri as immovable)
- Production deployment, HTTPS certificates for real domains
