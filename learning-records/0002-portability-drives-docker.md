# Mission constraint added: the setup must travel to a second machine

The user explained why they want the lab (and the eventual real setup) in Docker:
portability — they want to hand the whole thing to their work laptop and run it
there unchanged. This upgrades Docker from a tooling preference to a mission
constraint: the final deliverable is a checked-in `docker-compose.yml` +
`Caddyfile` that brings up the doorman with one command, not a locally
brew-installed Caddy. `MISSION.md` updated accordingly (Docker removed from out
of scope; portability added to success criteria).

**Implications**: lesson 0004 (branch factory) should produce a committable
compose artifact as its win. Real dev servers will likely still run on the host,
so `host.docker.internal` upstreams become core material, not a sidenote. Assume
the work laptop may be more locked-down (no brew, possibly no admin) — another
reason the Docker path is the primary path in all future labs.
