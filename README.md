# workspace

Personal workspace repo: hand-rolled configs for Neovim, tmux, and Ghostty,
each symlinked into `~/.config`. Domain language lives in
[`CONTEXT.md`](CONTEXT.md); decisions in [`docs/adr/`](docs/adr/).

```
nvim/      Neovim config (see nvim/README.md for details)
tmux/      tmux.conf — C-a prefix, vi copy mode, gruvbox status line
ghostty/   Ghostty config — gruvbox theme, ⌘-key tmux bindings
skills/    Claude Code skills      → linked as <config dir>/skills
commands/  Claude Code commands    → linked as <config dir>/commands
agents/    Claude Code subagents   → linked as <config dir>/agents
claude/    CLAUDE.md, settings.json, keybindings.json → linked as files
archive/   Retired skills/commands/agents — in git, not loaded
bin/       claude-ui — local web UI managing all of the above
```

## Fresh machine setup

Assumes the repo is cloned at `~/src/workspace` — adjust the symlink targets
if you clone elsewhere (e.g. on the work laptop).

### 1. Install the tools

```fish
brew install neovim tmux fish ripgrep fzf lazygit fnm
brew install --cask ghostty font-jetbrains-mono-nerd-font
```

`node` (via fnm) and `python3` are needed for the nvim LSP/DAP toolchain.

### 2. Symlink the configs

```fish
git clone git@github.com:jmep17/workspace.git ~/src/workspace
ln -s ~/src/workspace/nvim ~/.config/nvim
ln -s ~/src/workspace/tmux ~/.config/tmux
ln -s ~/src/workspace/ghostty ~/.config/ghostty
bin/claude-ui   # then click "link" on each Claude config mapping
```

If a config directory already exists (a work machine may ship defaults),
move it aside first: `mv ~/.config/nvim ~/.config/nvim.bak`.

- **nvim** reads `~/.config/nvim` — first launch installs plugins and Mason
  tools; see [`nvim/README.md`](nvim/README.md).
- **tmux** ≥ 3.1 reads `~/.config/tmux/tmux.conf` natively — no `~/.tmux.conf`
  needed. Reload a running server with `prefix r`.
- **Ghostty** reads `~/.config/ghostty/config` — reload with `cmd+shift+,`.
  Every window auto-attaches to the tmux session `main` (`command =` uses
  the Apple Silicon brew path; switch to `/usr/local/bin/tmux` on Intel).
- **Claude Code** reads its config dir (`~/.claude`, or `$CLAUDE_CONFIG_DIR`
  if exported) — claude-ui's links panel symlinks `skills`, `commands`,
  `agents`, `CLAUDE.md`, `settings.json`, and `keybindings.json` into it.
  See [Claude Code config](#claude-code-config).

### 3. macOS settings (one-time, per machine)

Remap **Caps Lock → Control**: System Settings → Keyboard →
Keyboard Shortcuts… → Modifier Keys. This makes the tmux prefix a
home-row roll (Caps+A) with no third-party tools.

### 4. First-launch check (Ghostty)

Inside tmux, press `⌘1` — it should select tmux window 1, not a Ghostty
tab. Ghostty 1.2 ships `cmd+1..9 = goto_tab` defaults; our config
overrides them with the same `physical:` digit triggers, but if a digit
chord still switches Ghostty tabs on your version, add explicit
`keybind = cmd+physical:one=unbind` lines (one through nine) above the
digit bindings in `ghostty/config`, then reload with `cmd+shift+,`.

## Claude Code config

All user-level Claude Code config is versioned here and symlinked into the
config dir: `skills/` (one directory per skill, each with a `SKILL.md`),
`commands/` (one `.md` per slash command; subdirs namespace natively, so
`commands/git/pr.md` is `/git:pr`), `agents/` (one `.md` per subagent), and
`claude/` (`CLAUDE.md`, `settings.json`, `keybindings.json`, linked as
individual files). A `git pull` updates everything in place.

### Collections

Any other top-level dir shaped like a Claude config — containing `skills/`,
`commands/`, `agents/`, or the config files — is a **collection** (e.g.
`work/`). Collections merge into the live config automatically: their
skills get top-level `<collection>-<name>` links, their commands/agents get
a `<type>/<collection>` dir symlink (so `work/commands/standup.md` is
`/work:standup`), and their `CLAUDE.md`/`settings.json`/`keybindings.json`
become selectable sources in the links panel — pick per machine which copy
is the linked one, since Claude Code reads exactly one of each. A
collection's `CLAUDE.md` can start with `@~/src/workspace/claude/CLAUDE.md`
to import the shared memory instead of replacing it.

The `work/` collection is gitignored wholesale — one private folder for all
work config, easy to back up as its own repo or delete when leaving. Upload
any config-shaped folder in the UI to add more collections; the old
per-type `work` folders migrate into `work/` automatically at startup.

### Groups (nested folders)

Skills can be organized into nested folders ("groups"): any directory under
`skills/` without its own `SKILL.md` — e.g. `skills/work/`, `skills/ai/`.
Claude Code only discovers **direct children** of the skills dir, so nesting
alone would hide a skill; skills-ui bridges this by auto-maintaining a
top-level `<group>-<name>` symlink for every group member (created and
pruned on each page load). The skill's name as Claude Code sees it is the
link name, e.g. `skills/ai/prompter/` loads as `ai-prompter`. Commit both
the content dir and the generated link for shared groups.

The `work` group is special: `.gitignore` excludes `skills/work/` and all
`work-*` entries, so work-specific skills live there — fully functional,
never committed. External skills can also be symlinked in by hand
(`ln -s ~/elsewhere/skill skills/work-name`); the manager leaves foreign
symlinks alone.

### claude-ui

`bin/claude-ui` (Python stdlib, no deps; `bin/skills-ui` still works as an
alias) serves a local gruvbox-styled page at `http://127.0.0.1:7333` with a
tab per config type. Every type supports archive/restore (to `archive/`,
which Claude Code doesn't scan), delete, move into nested folders, upload
from disk via the browser's folder picker, scaffolding, and filtering.
Everything is plain file moves — review and commit with git as usual (a
folder named `work` stays gitignored in every type).

The **links panel** at the top shows each mapping — `skills`, `commands`,
`agents`, `CLAUDE.md`, `settings.json`, `keybindings.json` — with its live
status (linked here, points elsewhere, real file/dir, missing) and
link/unlink buttons. Linking over a real file or dir backs it up first
(`<name>.bak`); if the repo side doesn't exist yet, linking **adopts** the
existing content instead — moves it into the repo and symlinks back — which
is how you first import a machine's config. The panel also sets the target
config dir (persisted to the gitignored `.claude-ui.json`); note Claude
Code itself only reads a non-default location if `CLAUDE_CONFIG_DIR` is
exported in your shell.

Uploading a folder of skill folders (no top-level `SKILL.md`) imports it as
a whole group; naming a skill upload or scaffold `<group>-<name>` files it
into that group.

The **settings** tab is a form editor for the selected `settings.json`
source: every documented user-scope setting (from
[the settings reference](https://code.claude.com/docs/en/settings)) rendered
as a toggle, dropdown, list, or JSON editor, grouped by category — model,
permissions, env & hooks, interface, git, memory, MCP, sandbox, system.
Set values are badged and clearable; keys not in the schema are still
editable as raw JSON; unknown values never get clobbered. Changes write
straight to the file (created on first set), so they take effect once
`settings.json` is linked.

## Keybinding model

Three layers, each owning what it's best at:

1. **tmux** owns multiplexing: `C-a` prefix (Caps+A after the remap),
   `|`/`-` splits, vim-style `h/j/k/l` pane movement, vi copy mode.
2. **Ghostty** turns ⌘ chords into tmux sequences (`text:` keybinds), since
   the shell never sees cmd: `⌘T` new window, `⌘D`/`⌘⇧D` splits,
   `⌘1–9` window select, `⌘⇧[`/`⌘⇧]` prev/next window, `⌘A` bare prefix.
   These only fire in Ghostty locally — over SSH from another terminal,
   fall back to the plain `C-a` bindings, which always work.
3. **nvim** keymaps mirror LazyVim mnemonics (see `nvim/README.md`).
