# workspace

Personal workspace repo: hand-rolled configs for Neovim, tmux, and Ghostty,
each symlinked into `~/.config`. Domain language lives in
[`CONTEXT.md`](CONTEXT.md); decisions in [`docs/adr/`](docs/adr/).

```
nvim/      Neovim config (see nvim/README.md for details)
tmux/      tmux.conf — C-a prefix, vi copy mode, gruvbox status line
ghostty/   Ghostty config — gruvbox theme, ⌘-key tmux bindings
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
```

If a config directory already exists (a work machine may ship defaults),
move it aside first: `mv ~/.config/nvim ~/.config/nvim.bak`.

- **nvim** reads `~/.config/nvim` — first launch installs plugins and Mason
  tools; see [`nvim/README.md`](nvim/README.md).
- **tmux** ≥ 3.1 reads `~/.config/tmux/tmux.conf` natively — no `~/.tmux.conf`
  needed. Reload a running server with `prefix r`.
- **Ghostty** reads `~/.config/ghostty/config` — reload with `cmd+shift+,`.

### 3. macOS settings (one-time, per machine)

Remap **Caps Lock → Control**: System Settings → Keyboard →
Keyboard Shortcuts… → Modifier Keys. This makes the tmux prefix a
home-row roll (Caps+A) with no third-party tools.

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
