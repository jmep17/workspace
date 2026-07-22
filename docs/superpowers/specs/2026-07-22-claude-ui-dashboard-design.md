# claude-ui v2: a dashboard + editor for the live Claude config

**Date:** 2026-07-22
**Status:** Approved design, pre-implementation
**Supersedes:** the copy+manifest install design of the same date (removed;
see git history). Prior-art research supporting the enable/disable placement
lives in `.scratch/claude-ui-item-installs/research-prior-art.md`.

## Problem

claude-ui grew up as a workspace-repo tool: it symlinked repo directories and
config files into the Claude config dir, with collections, adopt/backup
logic, and git commit plumbing. Meanwhile the config dir accumulated items
from other installers and by hand. The result: a skill could live in three
places, two link systems fought over `~/.claude/skills`, and it was never
clear what was authoritative or safe to touch. Inspection of the live config
showed the link layer barely deployed at all — the machinery managed a world
that never got built.

## Identity

claude-ui is a **local dashboard and editor for the user's live Claude
config**. It observes, edits on request, toggles enable/disable, and applies
one-shot setup patches.

It never owns, links, tracks, syncs, or manages. No manifest, no link
table, no repo management. The only repo involvement left is read-only:
setup-piece payloads are bundled alongside claude-ui's own code in its
checkout. Every action is a one-shot operation on the machine's own files,
leaving no claim behind.

It is a tool for any user's personal config: it imposes no process. If a
user wants history on `~/.claude`, that is their `git init`, not claude-ui's
business.

## Scope

- **In:** the Claude config dir (default `~/.claude`, honoring
  `CLAUDE_CONFIG_DIR` / the existing config-dir override) and user-scope MCP
  servers in `~/.claude.json`.
- **Out:** the workspace repo's `skills/`, `commands/`, etc. — those are
  ordinary files the user edits and versions by hand, with no UI over them.
- **Out:** anything claude-ui did not put there is displayed as-is, never
  rewritten, moved (except by an explicit enable/disable toggle), or deleted.

## Panels

### 1. Inventory

One view of everything discrete on the machine, grouped by kind:

- **Skills, commands, agents, output-styles** — read from
  `<config>/<type>/`. Whatever exists is shown: real dirs, single `.md`
  files, symlinks (displayed as items; their link-ness may be badged but is
  otherwise irrelevant). Name and frontmatter description shown per item.
- **MCP servers** — user-scope entries from `~/.claude.json` `mcpServers`.
  Beyond inventory and enable/disable, the MCP tab also supports **add**,
  **edit-in-place**, **delete**, and a reachability **test** for a server —
  the same edit-and-manage affordance the editor gives every other item.
  Add/delete are explicit, confirmed, per-server user actions (the same
  exception the enable/disable toggle carries), never bulk or implicit.
- **Config files** — `settings.json`, `CLAUDE.md`, `keybindings.json` (shown
  when present; absent files are simply absent).

Retained observability features (not part of the config surface but carried
forward from the tool): a context-**budget/insight** view and a **costs**
view (both read-only, parsing local session transcripts), lifecycle-**hook
test-fire**, and **`claude -p` assist** for improving/reviewing a file on
request. All are observe- or edit-on-request actions consistent with the
identity above.

There are no derived states, drift, or provenance — an item is *enabled* or
*disabled*, and that is all.

### 2. Editor

**If you can see it, you can edit it.** One generic file-view/edit endpoint
serves every panel: a skill's `SKILL.md` (and its sibling files), a
command's markdown, a config file, and — as structured JSON — an MCP
server's entry. Save rules:

- JSON files and MCP entries are parsed before write; invalid JSON is
  rejected with the error shown, file untouched.
- Everything else saves as-is.
- Writes go through a temp-file + atomic rename.

### 3. Setup pieces

Installable/patchable pieces of environment setup, shipped with claude-ui
(statusline) or sourced from the workspace repo's config dirs (fish, tmux,
ghostty). Applying a piece **patches the user's existing setup — it never
replaces or takes ownership of their files**:

- **Native drop-ins wherever the format has them (preferred):** fish gets a
  file in `~/.config/fish/conf.d/` (zero lines touched in the user's own
  config); statusline drops its script and sets one `settings.json` key.
- **Single include line where there is no drop-in dir:** tmux gets one
  `source-file` line appended to `~/.tmux.conf` if not already present.
- **Structured key merges for JSON:** read, set only the keys the piece
  needs, write back; all other keys untouched.
- No marker blocks; no full-file ownership.

Applying is idempotent — re-apply replaces the drop-in and re-sets the same
keys. No record of application is kept; "installed?" is answered by looking
(does the drop-in exist, is the key set), and removal is deleting the
drop-in / clearing the key, offered as an action per piece.

Implemented piece: **statusline** (self-contained via `statusline.py`) —
apply generates the script and sets the one `settings.json` key; remove
deletes the script and clears the key. The `setup.py` registry is the
extension point for further pieces.

The originally-envisioned **fish/tmux/ghostty** pieces are **parked** (decided
2026-07-22): on this machine `~/.config/fish` is a symlink into the repo (fish
is already versioned, so a copy-based piece fights the symlink), while tmux and
ghostty are machine-local with no repo payload. A dotfile piece would mean
authoring new snippets for a need that isn't concrete yet. The framework makes
adding one later a single registry entry once a real payload and need appear.

## Enable / disable

The only stateful action, and the filesystem is the entire state:

- **File items:** disable moves `<config>/<type>/<name>` to
  `<config>/disabled/<type>/<name>`; enable moves it back. `disabled/` is a
  plain visible sibling — it is outside the directories Claude Code scans,
  so no assumptions about dot-directory behavior are needed. Moves are
  same-filesystem renames; content is never modified. Symlinked items are
  moved as symlinks (the link relocates; its target is untouched).
- **MCP servers:** disable moves the entry verbatim from `~/.claude.json`
  `mcpServers` into `<config>/disabled/mcp-servers.json`; enable moves it
  back. Name collision on re-enable (a new server of the same name was
  added meanwhile) is a hard stop with both entries shown.
- No manifest or state file records any of this. The panel derives
  enabled/disabled purely from location.

## Teardown

- **Delete:** `links.py`, `gitops.py`, `transfer.py`, the collections
  concept (`collections()`, `NON_COLLECTIONS`, `COLLECTION_MARKERS`,
  sources config), the archive concept (`ARCHIVE`), and `items.py`'s
  repo-side browsing. `MAPPINGS`/`TYPES` repo roots go with them.
- **Rewrite:** `items.py` → the machine inventory described above;
  `doctor.py` → machine-config health (valid JSON in settings/`.claude.json`,
  orphaned `disabled/` entries whose type dir vanished, dangling item
  symlinks — report-only).
- **Keep/adapt:** `server.py` (panel wiring), `settings.py`, `mcp.py`,
  `statusline.py`, `core.py` (shrinks to config-dir resolution, frontmatter
  parsing, the CSRF token), `.claude-ui.json` (retains only `config_dir`).
- **Migration:** none. Live inspection confirmed nothing is currently
  symlinked by the links layer; teardown is pure code deletion.

## Edge cases

- **Disable when `disabled/<type>/<name>` already exists** (stale copy from
  an earlier toggle): hard stop, show both, user resolves by hand.
- **Item is a symlink whose target is gone:** shown with a broken badge;
  still toggleable (the rename moves the link), edit disabled.
- **`~/.claude.json` unparseable:** MCP panel shows the parse error and goes
  read-only; no write is ever attempted against a file that did not parse.
- **Concurrent Claude session while toggling/editing:** files change under a
  running session the same as any hand edit would; atomic renames keep each
  individual change consistent. No versioned-cache scheme is attempted.
- **Setup piece target missing** (no `~/.tmux.conf`, no fish config dir):
  create the minimal target (empty file / `conf.d/` dir) — creating the
  user's setup is in-scope for an explicit install action; rewriting it is
  not.

## Testing

- Inventory: temp config dir with real dirs, `.md` files, symlinks (valid
  and dangling), and a populated fake `~/.claude.json`; assert listing,
  badges, and enabled/disabled derivation.
- Toggle: round-trip file items and MCP entries, collision hard stops,
  symlink moves leave targets untouched.
- Editor: JSON validation rejects bad saves untouched; atomic write path.
- Setup pieces: apply twice → identical result (idempotence); user content
  around the touched keys/lines survives byte-for-byte; removal restores
  the pre-apply state for the piece's own artifacts.
- Doctor: each report-only finding fires on a crafted fixture.
