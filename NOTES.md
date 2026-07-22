# Teaching notes

## User preferences

- **Mechanics-first**: build from how things actually work (sockets, RFCs) before
  giving configs. Explicitly chose this over "fix first, theory later" (2026-07-18).
- Stack: Next.js/Node dev servers **and** SPA + separate API — cover both in examples.
- Environment: macOS, fish shell. Prefer copy-pasteable commands that work in fish.
- OAuth constraint confirmed as **exact URL only** (user's provider errors on any
  deviation, even in QA/dev mode).

## Curriculum plan (revise as records accumulate)

1. ✅ `0001-one-port-one-listener` — sockets/bind/EADDRINUSE + RFC 9700 exact
   matching + the reverse-proxy reframe.
2. ✅ `0002-the-doorman` — hands-on Caddy: two dummy upstreams, one front door on
   :3000, headers via echoing upstreams, hot-swap with `caddy reload`. Delivered
   2026-07-18; awaiting evidence the lab was completed (no learning record yet).
3. `0003-routing-the-callback` — the hard part: per-browser-session branch
   selection (cookie-based upstream choice), why side-by-side needs two browser
   profiles/containers (shared origin ⇒ shared cookies).
4. `0004-branch-factory` — git worktrees + deterministic port assignment +
   generated Caddyfile; fish function to spin up a branch in <1 min.
5. Possible: SPA + API dual-upstream nuances (CORS disappears behind one origin —
   nice payoff lesson).

## Artifacts (hosted guides)

- Doorman lab run guide: https://claude.ai/code/artifact/dca3640e-ad48-4fd5-9afe-2555cc4f7160
  (favicon 🚪). User prefers hosted artifact guides for labs — portable to the
  work laptop's browser. Update in place (pass `url` from other sessions);
  create one per future lab.

## Open threads

- Caddy was NOT installed as of 2026-07-18 (`which caddy` empty); lesson 2 lab
  starts with `brew install caddy`. Confirm install succeeded next session.
- Lab artifacts live in `labs/doorman/` (host version) and `labs/doorman-docker/`
  (compose version) inside the workspace.
- **Docker is the primary path** (resolved 2026-07-18): user wants the setup
  portable to their work laptop. Mission updated, learning record 0002 written.
  Docker path first in every future lab; host/brew variant is the alternative.
- If dockerized doorman + host-run dev servers becomes the real setup (likely in
  lesson 0004), upstreams must use `host.docker.internal`.
- **Port 3000 is contested on this machine**: the user runs an `ods-*` container
  stack whose `ods-webui` publishes `127.0.0.1:3000->8080`. Stopped 2026-07-18 to
  run the lab — remind the user to `docker start ods-webui` afterwards. Big flag
  for lesson 0004: the real doorman wants 3000 permanently, which collides with
  ods-webui; the user will have to move one of them. Also occupied: 3001, 3002,
  3005 (ods-dashboard, ods-dashboard-api, ods-token-spy) — pick branch ports
  clear of the 3000s, e.g. 3101+.
- Quiz retakes: suggest retaking lesson 1 quiz at next session start (spacing).
