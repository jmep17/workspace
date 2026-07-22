# 04 — MCP servers: inventory + toggle

**What to build:** the dashboard lists user-scope MCP servers from the user's Claude JSON config. Disable parks the server's entry verbatim in `disabled/mcp-servers.json` inside the config dir; enable moves it back. If the source JSON does not parse, the panel shows the error and goes read-only.

**Blocked by:** 01 — Teardown.

**Status:** ready-for-agent

- [ ] User-scope servers are listed with their transport/command summary
- [ ] Disable/enable move the entry verbatim between the live config and the parked file
- [ ] Re-enable into a name collision is a hard stop showing both entries
- [ ] Unparseable source JSON: error shown, panel read-only, no write ever attempted
