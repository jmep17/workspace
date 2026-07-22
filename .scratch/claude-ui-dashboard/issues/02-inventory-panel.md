# 02 — Inventory panel: file items + config files

**What to build:** the dashboard shows everything discrete in the live Claude config dir: skills, commands, agents, and output-styles (name plus frontmatter description, with badges for symlinked and broken entries), and the config files that are present (settings, CLAUDE.md, keybindings). Read-only — this ticket delivers the "visually see everything" moment.

**Blocked by:** 01 — Teardown.

**Status:** ready-for-agent

- [ ] All four item types list whatever exists in the config dir: real dirs, single markdown files, symlinks
- [ ] Symlinked items are badged; dangling symlinks are badged as broken
- [ ] Frontmatter descriptions appear where present
- [ ] Present config files are listed; absent ones simply do not appear
- [ ] Nothing on this panel writes to disk
