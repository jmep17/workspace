# claude-ui: copy-based item installs (skills, commands, agents, output-styles)

**Date:** 2026-07-22
**Status:** Approved design, pre-implementation

## Problem

Skills, commands, agents, and output-styles currently reach the Claude config
dir through whole-directory symlinks managed by claude-ui's links panel
(`repo/skills → ~/.claude/skills`, etc.). This model breaks the moment
anything else writes into those directories: the whole-dir link can't coexist
with individually added items, custom items risk being orphaned by relink
operations, and it is unclear which copy of an item is authoritative. The
result is a config layout that is hard to reason about and feels unsafe to
modify.

## Goal

One comprehensible model: the workspace repo is a **library** of items; each
Claude config dir is an **installation target** holding real copies. No
directory-level symlinks for the four item types. Users can add their own
items directly to the config dir and they are never touched by tooling.

## Scope

- **In:** the four item-type directories — `skills/`, `commands/`, `agents/`,
  `output-styles/` — in the repo and in each Claude config dir.
- **Out:** the four single config files (`CLAUDE.md`, `settings.json`,
  `keybindings.json`, `statusline.sh`). These stay on the existing per-file
  symlink mechanism, including its collection-source selection.
- **Out:** anything in the config dirs that claude-ui did not install. Such
  items are listed as *untracked* and never modified, moved (except by an
  explicit per-item user toggle, below), or deleted by any operation.

## Mental model

From a config dir's point of view, every item is in one of three states:

| State | Meaning |
|---|---|
| Installed | Real dir/file in the config, recorded in the manifest, traceable to a library item |
| Untracked | Real dir/file in the config that claude-ui did not install; never touched |
| Available | In the library but not installed in this config |

A profile (via `claude-switch` / alternate config dirs) is just a different
installation target with its own manifest, installing its own subset of the
same library. Collections are no longer needed for the four item types.

## The manifest

One JSON file per config dir: `<config>/.claude-ui-manifest.json`. The
dot-name guarantees it can never collide with an item type directory.

```json
{
  "skills/brainstorming": {
    "source": "skills/brainstorming",
    "installed_hash": "<sha256>",
    "enabled": true
  }
}
```

- Keys are `<type>/<name>`. `source` is the library-relative path.
- `installed_hash` is a sha256 over the item's full content: for a directory
  item, the sorted relative file list and each file's bytes; for a single
  `.md` item, the file bytes.
- `enabled` defaults to `true` and may be `false` (see Enable/disable).
- Untracked items normally have **no** manifest entry. The single exception
  is a disabled untracked item, recorded as a stub
  (`{"untracked": true, "enabled": false}`) so it can be listed and restored.

**Derived state, never stored:** each panel refresh compares the current
config-side hash and current library-side hash against `installed_hash`:

| Config vs installed | Library vs installed | Shown state |
|---|---|---|
| same | same | up to date |
| same | differs | update available |
| differs | same | modified |
| differs | differs | modified + update available |
| config copy missing | — | missing |
| — | library item missing | orphaned |

## Safety rules

1. **claude-ui writes only to manifest-listed paths.** No install, update, or
   bulk operation ever creates, modifies, moves, or deletes an untracked item.
2. **Name collision is a hard stop.** Installing `foo` when an untracked
   `foo` exists in the config is an error, never an overwrite.
3. **Backups before destructive overwrite.** Updating an item whose installed
   copy is modified requires explicit confirmation and writes a `.bak`
   sibling first (same convention the links panel uses today).

## Operations

- **install** — copy library → config; add manifest entry with fresh hash.
  Error if target exists and is not manifest-tracked.
- **update** — re-copy library → config when the library changed. If the
  installed copy is also modified: confirm, then `.bak` the config copy
  first. Refresh `installed_hash`.
- **push back** — copy a modified installed item back over its library
  source, then commit through the existing `gitops.py` flow. Refresh
  `installed_hash`.
- **adopt** — copy an untracked config item into the library, then
  optionally start tracking it as installed.
- **uninstall** — remove the config copy (from the live dir or `.disabled/`)
  and its manifest entry. Untracked items have no delete action at all.
- **update all** — bulk update, applied only to items in the clean
  `update available` state; modified items are skipped and reported.

## Enable / disable

- Disabled items live in `<config>/.disabled/<type>/<name>`. Claude Code
  does not scan dot-directories, so the item stops loading; nothing leaves
  the config dir.
- Toggling is a same-filesystem rename — atomic, content never changes.
  The manifest records `"enabled": false`; the panel shows the item greyed
  out with its drift state intact.
- Untracked items can also be toggled: this is an explicit per-item user
  action (not claude-ui acting on its own), fully reversible, and the only
  case where claude-ui moves an untracked path. A manifest stub remembers
  its origin so it can be listed and restored exactly.
- Adopt and uninstall work on disabled items from `.disabled/`.

## UI (claude-ui panel)

The links panel's four directory-mapping rows are replaced by an **items
panel**: one row per item across library and config, grouped by type. Each
row shows name, state, and per-row actions appropriate to that state
(install / update / push back / adopt / enable–disable toggle / uninstall).
Disabled rows render greyed. A single bulk action, "update all clean items,"
sits at the top. The four config-file symlink rows remain unchanged below.

## Migration

One guided, idempotent **migrate** action per config dir. For each of the
four item types:

1. If `<config>/<type>` is a symlink into the repo: record the set of items
   it exposed, remove the symlink, create a real directory, and
   install-copy those items (manifest seeded with fresh hashes).
2. If `<config>/<type>` is already a real directory: create nothing, delete
   nothing. Its contents are untracked until individually installed or
   adopted.

Nothing is deleted at any point; the only structural change is
symlink → real directory plus copies. Re-running migrate is a no-op.

## Edge cases

- **Library item deleted while installed** → state `orphaned`; the copy
  keeps working; user may uninstall or adopt it back into the library.
- **Same item installed in two profiles** → independent manifest entries;
  each profile updates on its own schedule.
- **Hand-edits inside `.disabled/`** → detected as `modified`, same as
  enabled items.
- **Config references to a disabled item** (e.g. settings that name a
  skill) → out of scope; Claude Code simply sees the item as absent.
- **Manifest corrupt or missing** → all config items degrade to untracked
  (safe direction: nothing is writable until re-tracked); panel surfaces a
  warning with a re-scan option.

## Testing

- Unit-test hashing (dir vs single-file items, ordering stability) and
  state derivation (all rows of the state table).
- Unit-test each operation against a temp library + temp config dir,
  including the three safety rules (untracked untouched, collision stop,
  `.bak` on modified overwrite).
- Migration test: symlinked dir → migrated config equals the library
  content, manifest seeded, second run is a no-op.
- Existing links-panel tests for the four config files must keep passing
  unchanged.
