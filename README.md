# workspace

Personal workspace repo: hand-rolled configs for Neovim, tmux, and Ghostty,
each symlinked into `~/.config`. Domain language lives in
[`CONTEXT.md`](CONTEXT.md); decisions in [`docs/adr/`](docs/adr/).

```
nvim/      Neovim config (see nvim/README.md for details)
tmux/      tmux.conf — C-a prefix, vi copy mode, gruvbox status line
ghostty/   Ghostty config — gruvbox theme, ⌘-key tmux bindings
skills/    Claude Code skills, symlinked as ~/.claude/skills
archive/   Retired skills — kept in git, not loaded by Claude Code
bin/       skills-ui — local web UI for managing skills
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
ln -s ~/src/workspace/skills ~/.claude/skills
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
- **Claude Code** reads `~/.claude/skills` — the symlink makes every skill
  in `skills/` available user-level, in every project on the machine. See
  [Claude Code skills](#claude-code-skills) for adding machine-local skills.

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

## Claude Code skills

`skills/` holds one directory per skill (each with a `SKILL.md`). With the
`~/.claude/skills` symlink from setup step 2, Claude Code discovers them as
user-level skills everywhere on the machine, and a `git pull` updates them
in place.

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

### skills-ui

`bin/skills-ui` (Python stdlib, no deps) serves a local gruvbox-styled page
at `http://127.0.0.1:7333` for managing skills: archive, restore, delete,
create groups and move skills between them, upload a folder from disk,
scaffold a new skill, filter, and spot problems (broken symlinks, missing
`SKILL.md`). Archiving moves a skill to `archive/` (group structure
preserved), which Claude Code doesn't scan, so it stops loading everywhere;
restore moves it back. Everything is plain file moves — review and commit
with git as usual (the `work` group stays gitignored).

Uploading a folder that itself contains skill folders (no top-level
`SKILL.md`) imports it as a whole group; naming an upload or new skill
`<group>-<name>` files it directly into that group.

A banner at the top shows whether `~/.claude/skills` points at this repo;
if not, a **link now** button sets up the symlink from step 2 for you
(an existing real directory is backed up to `~/.claude/skills.bak` first).
**⇪ upload** imports a folder via the browser's directory picker — name it
`work-*` at the prompt to keep it out of git.

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
