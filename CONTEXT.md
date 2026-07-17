# Workspace

Personal workspace repo; home to a hand-rolled Neovim configuration built
greenfield for ownership and understanding, plus matching terminal configs
(`tmux/`, `ghostty/`) bootstrapped the same way — symlinked into `~/.config`.

## Language

**Workspace config**:
The hand-rolled Neovim configuration at `nvim/`, loaded via `NVIM_APPNAME=nvim-ws` (fish: `vv`).
_Avoid_: new config, fresh config

**LazyVim backup**:
The pre-existing LazyVim configuration (github.com/jmep17/nvim), retired at cutover on 2026-07-16; preserved at `~/.config/nvim-lazyvim-backup` with its data dirs under the same `-lazyvim-backup` suffix.
_Avoid_: old config, daily driver

**Cutover**:
The moment the workspace config replaced LazyVim as plain `nvim` (happened 2026-07-16; a symlink move, fully reversible by restoring the `-lazyvim-backup` dirs).

**First-class language**:
A language with the full toolchain — LSP, formatting, linting, testing, debugging. Currently TypeScript/JavaScript and Python, by decision.

**Supporting tier**:
Formats that get LSP/formatting but no test/debug investment: JSON, YAML, Docker, Markdown, Lua, HTML/CSS/Tailwind.

**Swap slot**:
A server choice structured so replacing it is a one-line edit in `nvim/lua/plugins/lsp.lua`: vtsls → tsgo, basedpyright → pyrefly.
