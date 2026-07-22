# 01 — Teardown: strip repo-management machinery

**What to build:** claude-ui boots and serves with the repo-management era fully removed: no symlink links panel, no git commit plumbing, no transfer, no collections, no archive. The shared core shrinks to config-dir resolution, frontmatter parsing, and the CSRF token. The server no longer exposes any endpoint or panel for the deleted machinery.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] links, gitops, and transfer modules are deleted
- [ ] Collections and archive concepts are gone from the core and UI
- [ ] The app starts and serves its remaining panels without errors
- [ ] No dead endpoints remain in the server
