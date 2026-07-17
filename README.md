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

Machine-local skills (e.g. work-specific ones that must not be committed
here) live elsewhere and are symlinked in under a `work-` prefix, which
`.gitignore` excludes:

```fish
# skill content lives outside this repo, e.g. ~/work-skills/deploy-checklist
ln -s ~/work-skills/deploy-checklist ~/src/workspace/skills/work-deploy-checklist
```

Claude Code follows nested symlinks, so the skill loads like any other while
its content stays out of this repo — keep `~/work-skills` in its own
(private) repo if it should be versioned and backed up.

### skills-ui

`bin/skills-ui` (Python stdlib, no deps) serves a local gruvbox-styled page
at `http://127.0.0.1:7333` for managing skills: archive, restore, delete,
upload a skill folder from disk, scaffold a new one, filter, and spot
problems (broken symlinks, missing `SKILL.md`). Archiving moves a skill to
`archive/`, which Claude Code doesn't scan, so it stops loading everywhere;
restore moves it back. Moves are plain renames on disk — review and commit
them with git as usual (`work-*` skills stay gitignored).

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
