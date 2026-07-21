# nvim

Hand-rolled Neovim config for full-stack work (TypeScript/React + Python).
Built greenfield for ownership — every plugin here was a deliberate choice
(decision records live in [`../../docs/adr/`](../../docs/adr/)).

## Requirements

- Neovim ≥ 0.11 (built against 0.12)
- `git`, `node` (fnm), `python3`, `rg`, `fzf`, `lazygit`
- A Nerd Font

## Bootstrap

This is the active config: `~/.config/nvim -> ~/src/workspace/.config/nvim` (cutover
2026-07-16). On a fresh machine:

```fish
ln -s ~/src/workspace/.config/nvim ~/.config/nvim
```

First launch installs plugins (lazy.nvim), then LSP servers/formatters/
debuggers (Mason — watch `:Mason` for progress). Treesitter parsers compile
via `:TSUpdate` during install.

The retired LazyVim setup is preserved: config at
`~/.config/nvim-lazyvim-backup`, data/state/cache under the same
`-lazyvim-backup` suffix in `~/.local/share`, `~/.local/state`, `~/.cache`.
To roll back, delete the `~/.config/nvim` symlink and move those four
directories back to their original names.

## Layout

```
init.lua                 entry: options → lazy → theme → keymaps → autocmds
lua/config/
  options.lua            vim options, leaders, vim.g.autoformat default
  lazy.lua               lazy.nvim bootstrap
  theme.lua              colorscheme persistence (state file)
  keymaps.lua            plugin-independent keymaps
  autocmds.lua           QoL autocommands
lua/plugins/             one file per concern; lazy.nvim imports the dir
  lsp.lua                Mason + vtsls/basedpyright/ruff/eslint + LspAttach keymaps
  completion.lua         blink.cmp (pinned v1)
  treesitter.lua         nvim-treesitter main branch + autotag + commentstring
  formatting.lua         conform: prettier/ruff/stylua, format-on-save + toggles
  linting.lua            nvim-lint: shellcheck/hadolint/markdownlint
  testing.lua            neotest: pytest/vitest/jest
  dap.lua                nvim-dap + dap-ui: debugpy, js-debug
  snacks.lua             picker, notifier, indent, lazygit, + toggles
  oil.lua                file explorer (directory-as-buffer)
  git.lua                gitsigns, diffview, mini.diff
  octo.lua               octo.nvim: GitHub PRs/issues (<leader>gp…, needs gh CLI)
  ui.lua                 lualine, which-key
  editor.lua             mini.surround, mini.pairs, leap
  ai.lua                 claudecode.nvim (no Copilot — deliberate)
  colorscheme.lua        gruvbox (default), catppuccin, tokyonight
```

## Conventions

- Keymaps mirror LazyVim mnemonics (`<leader>ff`, `<leader>gg`, `]h`, `<leader>ca`, …)
- Format-on-save is on; `<leader>uf` toggles it, `:FormatDisable[!]` for buffer/global
- Swap-friendly server slots: vtsls → tsgo, basedpyright → pyrefly are one-line changes in `lsp.lua`
