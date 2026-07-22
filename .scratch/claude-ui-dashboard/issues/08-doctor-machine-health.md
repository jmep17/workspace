# 08 — Doctor: machine-config health

**What to build:** the doctor panel reports on the health of the live machine config — report-only, it never fixes anything. Findings: invalid JSON in the settings or user Claude JSON, orphaned entries in the disabled area whose live type directory has vanished, and dangling item symlinks.

**Blocked by:** 03 — Enable/disable, 04 — MCP inventory + toggle.

**Status:** ready-for-agent

- [ ] Each finding class fires on a crafted fixture and renders in the UI
- [ ] A healthy config reports clean
- [ ] Doctor performs no writes under any circumstances
