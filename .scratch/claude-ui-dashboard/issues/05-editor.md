# 05 — Editor: edit anything you can see

**What to build:** if the dashboard shows it, the user can open and edit it — a skill's markdown and sibling files, a command file, a config file, and (as structured JSON) an MCP server entry. One generic view/edit surface reused by every panel.

**Blocked by:** 02 — Inventory panel. (Attaches to 04's panel too once it exists, but does not gate on it.)

**Status:** ready-for-agent

- [ ] Any file behind an inventory row and any listed config file opens in an edit view
- [ ] JSON content is parsed before save; invalid JSON is rejected with the error shown and the file untouched
- [ ] Non-JSON content saves as-is
- [ ] Writes are atomic (temp file + rename)
