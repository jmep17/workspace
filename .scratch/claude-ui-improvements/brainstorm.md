# claude-ui: improvement brainstorm

Status: brainstorm — not triaged into issues yet.

Context: `bin/claude-ui` is a single-file, stdlib-only local web UI for managing
Claude Code config (skills, commands, agents, output-styles, config files, MCP
servers, statusline, settings), gruvbox-dark themed, symlink-based. This is a
raw idea list for visual and functional improvements, roughly grouped and
ordered by impact-vs-effort within each group.

## Biggest functional gaps

1. **Edit items in place.** Config files (CLAUDE.md, settings.json, …) have an
   editor, but skills/commands/agents don't — you can create, move, archive,
   and delete a skill, yet you can't open its SKILL.md without leaving the UI.
   Add an "edit" action per item (reuse the existing `.fedit` editor; for
   skills, a small file list sidebar for supporting files).
2. **Git awareness.** The help text says "review & commit with git as usual",
   but the UI has no idea what's dirty. A small panel (or per-row dot) showing
   `git status` for managed paths, with per-file diff view and optional
   one-click commit, would close the loop the tool itself opens ("adopted —
   commit it!" toasts currently point at a black box).
3. **Replace `prompt()`/`confirm()` with real modals.** Move/new/import/adopt
   all use blocking browser prompts; they can't offer pickers (e.g. a dropdown
   of existing groups for "move"), defaults are clunky, and they look jarring.
   One generic modal component would upgrade ~8 flows at once, and enables
   drag-a-row-onto-a-group-chip as the move gesture.
4. **Rename and duplicate.** Renaming a skill/command today is
   archive-and-recreate or shell work. `rename` (with symlink reconciliation)
   and `duplicate` (start a new skill from an existing one) are cheap wins.
5. **Validation / lint pass.** The templates ship `TODO` placeholders; nothing
   flags them later. A per-item health badge: leftover TODOs, missing/overlong
   `description` (Claude Code truncates long ones), frontmatter `name` not
   matching the dir name, loose files at group level, name collisions between
   a collection skill's generated link and a shared skill.
6. **MCP: test connection + secret hygiene.** A "test" button per server
   (spawn the stdio command with a timeout / HEAD the URL) beats finding out
   in a session. Also scan configs being saved to *committed* sources for
   likely secrets (`env` values that look like tokens) and warn — collections
   like `work/` are gitignored, `claude/mcp-servers.json` is not.
7. **Structured hooks editor.** Hooks are the most error-prone settings key and
   are edited as raw JSON. A small builder (event → matcher → command rows)
   in the settings tab, mirroring the statusline builder's approach.
8. **Search that spans tabs and contents.** The filter box only matches
   name/description within the current tab. Make it global (show grouped
   results from all types) and optionally grep file contents server-side.

## Visual / UX polish

9. **Auto-collapse the links panel when healthy.** It's `open` by default and
   eats the top third of the page even when everything shows "✓ linked".
   Open it automatically only when something needs attention.
10. **Light theme.** Honor `prefers-color-scheme` with a gruvbox-light
    variant (the palette is already CSS variables — this is ~10 lines plus a
    toggle persisted to `.claude-ui.json`).
11. **Toast upgrades.** Toasts overwrite each other and vanish; error toasts
    with paths (backup locations!) disappear before you can copy them. Stack
    them, make errors sticky with a dismiss ×, and keep a small "last
    actions" log.
12. **Row layout on narrow screens.** `.row` is a single flex line with
    baseline alignment; badges and actions collide below ~700px. Switch to a
    two-line grid on small widths, and give actions an overflow "⋯" menu
    instead of three always-visible buttons per row.
13. **Sort and filter chips.** Sort by name/recently-modified; quick filter
    chips for the existing badges (gitignored, symlink, broken, group,
    incomplete).
14. **Tab icons + keyboard nav.** Small glyphs per tab, `/` to focus the
    filter, `1..7` to switch tabs, `Esc` to close editor/modal.
15. **Statusline preview realism.** Render the preview at a chosen terminal
    width (80/120/160 toggle) so line-length advice is visible, and let the
    preview run the *actual generated script* server-side against sample JSON
    (ANSI → HTML) so preview and reality can't drift.
16. **Markdown preview in the editor.** A minimal side-by-side or toggled
    preview for CLAUDE.md / SKILL.md edits; even a crude renderer beats none.
17. **Empty states with actions.** "nothing here" → a one-line explanation of
    what this type is plus New/Import buttons inline.

## Deeper functional bets

18. **Diff view for `differs` / `.bak` / adoption.** Wherever the UI knows two
    copies exist (MCP repo vs machine, `*.bak` left by linking, shared vs
    collection config file), show an actual diff and offer
    keep-mine/take-theirs. `.bak` files are currently created and then
    orphaned forever.
19. **Keybindings builder.** keybindings.json gets the raw editor only; a
    structured key-chord picker would match the statusline tab's philosophy.
20. **Live reload.** Poll a cheap server-side state hash (or watch mtimes) and
    refresh when files change externally — the tool coexists with editors and
    Claude Code itself, and the UI silently goes stale today.
21. **Collection export.** Download any collection (or the shared set) as a
    zip — the inverse of the folder-upload import path.
22. **Trash instead of hard delete.** Deletes are `shutil.rmtree` behind a
    `confirm()`. Move to `archive/trash/<timestamp>/` with a purge button;
    makes every destructive action reversible.
23. **Frontmatter surfaced as badges.** Parse and show `allowed-tools`,
    `model`, `disable-model-invocation` on rows, not just `description` —
    that's the metadata that changes behavior.
24. **Skill size stats.** Show SKILL.md word count and supporting-file count;
    warn near documented limits (long skills eat context).
25. **Command palette (Ctrl+K).** Every action already goes through small JS
    functions; a palette listing "new skill", "link settings.json", "apply
    all MCP", jump-to-item, would make the whole tool keyboard-first.

## Code health (enables the above)

26. **Split the file.** 3,400 lines with HTML/CSS/JS inside a Python string
    means no syntax highlighting or linting for two of the three languages.
    Even keeping single-file *distribution*, build it from `claude-ui/` parts
    (server.py, page.html, app.js, style.css) concatenated by a tiny build
    step — or just serve the static assets from a sibling dir.
27. **Escape-audit the HTML templating.** Most interpolations go through
    `esc()`, but several `onclick="...('${name}')"` sites interpolate names
    into JS-in-attribute contexts (e.g. MCP row actions, `doAct`). `NAME_RE`
    currently saves this from being exploitable, but it's one regex change
    away from breakage; move to `dataset` + `addEventListener`.
28. **Tests for the symlink logic.** `reconcile_links`, adopt/backup in
    `do_link`, group move/rename — the riskiest filesystem code has no tests.
    A pytest file with a tmpdir fixture would make the refactors above safe.
