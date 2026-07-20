# Lazygit cheatsheet

Default keybindings (lazygit ≥ 0.40). Press `?` inside lazygit for the
authoritative, context-aware list — bindings change per panel. `esc` backs out
of almost anything; `z` undoes almost anything.

## Launching

| Command | What it does |
|---|---|
| `lazygit` | Open in the current repo |
| `lazygit -p <path>` | Open a specific repo |
| `lazygit log` / `status` / `branch` / `stash` | Jump straight to a panel |
| `lazygit -f <path>` | Filter commits by file path |

In this setup lazygit is also wired into nvim via snacks (`nvim/lua/plugins/git.lua`).

## Navigation (everywhere)

| Key | Action |
|---|---|
| `1`–`5` | Jump to panel: status, files, branches, commits, stash |
| `h` / `l` (or `←` / `→`) | Previous / next panel |
| `j` / `k` | Move selection down / up |
| `[` / `]` | Previous / next tab within a panel (e.g. Branches ↔ Remotes ↔ Tags) |
| `enter` | Drill into the selected item |
| `esc` | Back out / cancel |
| `/` | Search the current panel |
| `ctrl+u` / `ctrl+d`, `pgup` / `pgdn` | Scroll the main (diff) view |
| `+` / `_` | Cycle screen mode (normal → half → fullscreen) |
| `q` | Quit |

## Global

| Key | Action |
|---|---|
| `?` | Open keybindings menu for the current panel |
| `p` | Pull |
| `P` | Push (`--force-with-lease` prompt if branches diverged) |
| `z` | Undo (via reflog) |
| `ctrl+z` | Redo |
| `R` | Refresh |
| `x` | Options menu |
| `:` | Execute a custom shell command |
| `@` | Command log menu (see the actual git commands lazygit ran) |
| `W` (or `ctrl+e`) | Diffing menu — diff any two refs |
| `ctrl+s` | Filter view (e.g. filter commits by path/author) |
| `v` | Toggle range select (then `j`/`k` to extend; works on lines, commits, files) |
| `y` | Copy-to-clipboard menu for the selected item (SHA, file name, …) |

## Status panel (`1`)

| Key | Action |
|---|---|
| `e` / `o` | Edit / open lazygit config |
| `u` | Check for updates |
| `enter` | Switch to a recent repo |
| `a` | Show all-branches log graph |

## Files panel (`2`) — staging & committing

| Key | Action |
|---|---|
| `space` | Stage / unstage selected file |
| `a` | Stage / unstage everything |
| `enter` | Enter the file to stage individual hunks/lines (see below) |
| `c` | Commit staged changes |
| `w` | Commit skipping pre-commit hooks |
| `C` | Commit using the git editor |
| `A` | Amend last commit with staged changes |
| `ctrl+f` | Find base commit for a fixup (auto-picks which commit your changes belong to) |
| `d` | Discard changes to file (menu) |
| `D` | Reset menu (soft/mixed/hard, nuke working tree, discard untracked) |
| `s` | Stash all changes |
| `S` | Stash options (include untracked, staged-only, …) |
| `i` | Add to .gitignore |
| `f` | Fetch |
| `M` | Open external merge tool |
| `ctrl+b` | Filter files by status |
| `` ` `` | Toggle file tree view |
| `-` / `=` | Collapse / expand all tree nodes |

### Inside a file (staging panel) — patching the index

`enter` on a file opens its diff so you can stage *parts* of it:

| Key | Action |
|---|---|
| `space` | Stage / unstage the selected line(s) |
| `v` | Start range select, extend with `j`/`k`, then `space` |
| `a` | Select / stage the whole current hunk |
| `←` / `→` | Jump between hunks |
| `tab` | Switch between unstaged and staged view (in staged view, `space` unstages) |
| `e` | Edit the hunk in your editor (like `git add -e`) |
| `c` | Commit right from here |
| `esc` | Back to the files panel |

## Branches panel (`3`)

| Key | Action |
|---|---|
| `space` | Checkout selected branch |
| `n` | New branch off the selected branch |
| `c` | Checkout by name (type a ref) |
| `-` | Checkout previous branch |
| `F` | Force checkout (discards local changes) |
| `d` | Delete branch (menu: local / remote) |
| `M` | Merge selected branch into current |
| `r` | Rebase current branch onto selected |
| `R` | Rename branch |
| `f` | Fast-forward selected branch from its upstream |
| `u` | Upstream options (set / unset / view) |
| `g` | Reset menu (reset current branch to selected) |
| `T` | Create tag |
| `o` | Create pull request |
| `G` | Open pull request in browser |
| `s` | Change sort order |
| `enter` | View the branch's commits |

Tabs in this window: **Local branches / Remotes / Tags / Worktrees** (`[` / `]`).

## Commits panel (`4`) — rewriting history

These shorthands run a one-step interactive rebase behind the scenes:

| Key | Action |
|---|---|
| `s` | Squash into the commit below |
| `f` | Fixup into the commit below (discard this message) |
| `r` | Reword commit |
| `R` | Reword with editor |
| `d` | Drop (delete) commit |
| `e` | Edit — stop the rebase at this commit |
| `i` | Start interactive rebase here (edit the todo list in-app, then `m` → continue) |
| `ctrl+j` / `ctrl+k` | Move commit down / up |
| `A` | Amend commit with currently staged changes |
| `a` | Amend commit attribute (reset author, add co-author) |
| `F` | Create a `fixup!` commit for the selected commit |
| `S` | Apply all `fixup!` commits above (squash them in, like `--autosquash`) |
| `t` | Revert commit |
| `T` | Tag commit |
| `g` | Reset menu — soft / mixed / hard reset to this commit |
| `space` | Checkout commit (detached HEAD) |
| `B` | Mark commit as base for rebase ("rebase from here onto…") |
| `C` | Copy commit (cherry-pick) — see below |
| `V` | Paste copied commits (cherry-pick onto current branch) |
| `enter` | View the commit's files (entry point for custom patches) |
| `y` | Copy SHA / message / URL to clipboard |

During a conflicted rebase/merge: `m` opens the rebase options (continue,
abort, skip).

### Cherry-picking

1. In any commits view (including another branch's, via Branches → `enter`), press `C` on each commit to copy it (range-select with `v` works too).
2. Checkout the target branch.
3. In its commits panel press `V` to paste. `esc` clears the copied set.

## Custom patches — "how to patch"

Pull specific files or lines *out of an existing commit* (split a commit, move
code between commits, extract to index):

1. **Commits panel** → `enter` on the commit to see its files.
2. Build the patch:
   - `space` on a file → toggle the whole file into the patch (green = whole file, yellow = partial), or
   - `enter` on a file → select lines (`v` for ranges, `a` for hunks) and `space` to toggle them into the patch.
3. Press `ctrl+p` to open the **custom patch options** menu:
   - **Remove patch from commit** — deletes those changes from the commit (they vanish entirely)
   - **Move patch out into index** — pulls the changes out of the commit and leaves them staged
   - **Move patch into new commit** — splits the commit, placing the patch in a new commit after it
   - **Move patch to selected commit** — select another commit first, then move the changes into it
   - **Apply patch** / **apply in reverse** — apply to the working tree
   - **Copy patch to clipboard**

If a step causes conflicts, resolve them (see below) and continue with `m`.
`ctrl+p` also shows "reset patch" to start over.

## Stash panel (`5`)

| Key | Action |
|---|---|
| `space` | Apply stash (keep it) |
| `g` | Pop stash (apply + drop) |
| `d` | Drop stash |
| `n` | New branch from stash |
| `r` | Rename stash |
| `enter` | View stash files |

Creating stashes happens from the **files** panel (`s` / `S`).

## Merge conflicts

Conflicted files show up in the files panel; `enter` opens conflict resolution:

| Key | Action |
|---|---|
| `←` / `→` | Jump between conflicts |
| `space` | Pick the selected hunk |
| `b` | Pick both hunks |
| `z` | Undo pick |
| `e` | Edit file directly |
| `M` | Open external merge tool |
| `m` | Continue / abort the merge or rebase (once all conflicts resolved) |

## Handy workflows

- **Amend an old commit**: stage the changes (files panel) → commits panel → select the commit → `A`. Or `ctrl+f` in the files panel to auto-find the target and create a fixup.
- **Split the last commit**: commits panel → `g` → soft reset to the commit before → restage and commit in pieces.
- **Undo a bad rebase**: `z` (repeatedly) — it walks the reflog.
- **See what git commands lazygit runs**: `@` → toggle command log; great for learning the underlying git.
- **Diff two branches**: `W` on the first ref → move to the second → `W` → view diff; `esc` exits diff mode.
- **Bisect**: commits panel → `b` on a bad commit → mark good/bad as it steps.
