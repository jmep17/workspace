# claude-ui: improvement brainstorm

Status: first implementation pass landed (2026-07-19). Shipped: #1 in-place
item editor, #2 git panel (status/diff/commit), #3 modals replacing all
prompt()/confirm(), #4 rename+duplicate, #5 validation badges (TODO,
name≠dir, long desc), #6 MCP test button + committed-secret warning,
#9 links auto-collapse, #10 light theme, #11 toast stack w/ sticky errors,
#12 responsive rows + overflow menu (no horizontal scroll at any width),
#13 sort (a–z/recent), #14 keyboard nav (/, Esc, 1-9), #15 statusline
preview width toggle (80/120 col), #27 escape-audit of row actions.
Still open: #7 hooks builder, #8 cross-tab search, #16 markdown preview,
#18 diff-anywhere, #19-26, #28 tests.

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

## Round 2 — toward an incredible config manager

Wave 1 landed (2026-07-19): #29 context-budget dashboard + #30 transcript
usage analytics (insight tab), #32 doctor tab with fix actions, #43
CSRF/rebinding hardening (per-run POST token + Host validation), and #47
command palette (Ctrl/⌘-K). Remaining waves still open.

Ambition level up: not just "manage the files" but own the whole config
lifecycle — insight, authoring, distribution, and safety. Grouped by theme;
★ marks the ideas that would most differentiate the tool.

### Insight: know what your config costs and does

29. ★ **Context-budget dashboard.** Every session starts by loading
    CLAUDE.md + every skill description + agent/command frontmatter into
    context. Estimate tokens per piece (chars/4 is fine) and render a
    stacked bar: "your config costs ~6.2k tokens of every session — 3.1k
    of it is skill descriptions, and these 5 skills are half of that."
    Nothing else surfaces this today, and it changes how people write
    descriptions. Per-row token chips; warn at a configurable budget.
30. ★ **Usage analytics from transcripts.** `~/.claude/projects/**/*.jsonl`
    records every session. Parse locally (stdlib, cached) to get per-skill /
    per-command invocation counts and last-used dates → a "last used"
    column, "never used in 90 days — archive?" hints, busiest projects,
    sessions per day. Turns archiving from guesswork into hygiene.
31. ★ **Permission advisor.** Scan transcripts for Bash/tool permission
    prompts the user approved repeatedly; propose concrete
    `permissions.allow` rules with one-click add to settings.json (the
    /fewer-permission-prompts idea, productized with a review UI).
32. **Doctor tab.** One button, full health sweep: broken/orphaned symlinks,
    `*.bak` leftovers, archive orphans, group/collection name collisions,
    hooks pointing at missing scripts, MCP commands not on PATH, settings
    keys not in the schema, skills missing "Use when" triggers, statusline
    script drift vs saved config. Each finding with a fix action. (Absorbs
    the old #5/#16 into one place.)

### Authoring: make writing config a first-class experience

33. ★ **Claude-assisted authoring.** The manager sits next to a `claude`
    CLI — shell out headless (`claude -p`, user's own auth) for: "draft a
    skill from this one-line description", "review this skill's triggers
    and tighten the description", "explain why this hook config is wrong".
    Show the diff, apply on accept. The tool that manages Claude config
    should be able to ask Claude.
34. **Hooks builder with test-fire.** Structured rows (event → matcher →
    command → timeout) over settings.hooks, a recipe library (format on
    save, guard dangerous Bash, notify on Stop), and a "test" button that
    pipes a sample event JSON into the command and shows stdout/exit code.
35. **Frontmatter-as-form editor.** For skills/commands/agents: name,
    description, allowed-tools (multiselect of real tool names), model
    picker as form fields above the markdown body; body gets a rendered
    markdown preview toggle (small hand-rolled renderer, keep stdlib-only).
36. **Keybindings builder** with a key-capture input and conflict
    detection against defaults + existing bindings.
37. **Settings power-ups:** filter box; "differs from default" filter;
    settings.local.json support; deprecated/unknown-key badges; per-key
    link to the docs anchor; masked display for env values that look secret.

### Distribution: config that travels

38. ★ **New-machine bootstrap.** Generate a one-liner (`curl | sh` or
    `npx`-style) + a committed `bootstrap.sh` that clones the repo, runs a
    headless link-everything pass (same code as the links panel), applies
    MCP servers, and prints what it did. The links panel becomes: "set up
    this machine" on first run.
39. **Machine manifest.** Commit a small `machines.json` (hostname →
    linked sources, last-seen); the UI shows every machine's link/source
    choices and staleness ("laptop is 12 commits behind"). Pull button.
40. **Import from URL.** Paste a GitHub repo/gist URL of a skill or
    collection → fetch, preview the file tree, import. Inverse: export any
    item/group/collection as a zip.
41. **Plugin & marketplace awareness.** Read `~/.claude/plugins` +
    configured marketplaces: list installed plugins and their
    skills/commands next to yours (read-only at first), flag name shadowing
    between plugin skills and repo skills.
42. **Project-level config registry.** Register project repos (or scan
    common dirs) and manage their `.claude/` — settings, CLAUDE.md,
    `.mcp.json` — from the same UI: compare project vs user config,
    promote a project skill to user level, push a user command down into a
    project. Today the tool stops at user scope; real setups live in both.

### Safety and trust

43. ★ **CSRF/rebinding hardening.** Any webpage can POST to
    127.0.0.1:7333 today. Mint a per-run token, embed it in the page,
    require it on every POST, and validate the Host header. Cheap, and it
    makes "config manager with a commit button" defensible.
44. **Trash + undo toast.** Deletes move to `archive/trash/<ts>/` with a
    5s "undo" toast and a purge button (upgrade of old #22).
45. **Config time machine.** Per-item history from git (`git log --follow`),
    view any version, restore with one click; a global "what changed this
    week" feed of the config repo.
46. **Session-restart awareness.** Mark each mutation with whether a
    running session picks it up live (statusline, skills) or needs a new
    session (settings.json, CLAUDE.md) — one honest badge instead of
    folklore.

### UX: the daily-driver feel

47. **Command palette (Ctrl+K):** fuzzy jump to any item, any action
    ("link settings", "new agent", "apply all mcp"), any tab.
48. **Global search** across all types and file contents (server-side
    grep), with hit previews (absorbs old #8).
49. **Bulk select:** checkboxes on rows → archive/move/delete many at once.
50. **Drag-and-drop everywhere:** drop a folder on the page to import;
    drag a row onto a folder chip to move it.
51. **Live reload:** poll a cheap state hash (or SSE) so external edits —
    including ones made by a running Claude session — appear without a
    manual refresh; flash the changed row.
52. **PWA manifest** so the UI installs as an app window with the ⚙️ icon.

### Sequencing sketch

Wave 1 (insight, mostly read-only, high wow): #29 token dashboard,
#30 usage analytics, #32 doctor, #43 CSRF.
Wave 2 (authoring): #34 hooks builder, #35 frontmatter forms, #37 settings
power-ups, #47 palette, #48 search.
Wave 3 (reach): #33 claude -p integration, #38 bootstrap, #42 project
registry, #45 time machine.

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
