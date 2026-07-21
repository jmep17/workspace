-- All three themes install; gruvbox is the default (see init.lua).
-- The last :colorscheme choice persists via lua/config/theme.lua.
-- Switch with <leader>uC (snacks colorscheme picker).
return {
  {
    "ellisonleao/gruvbox.nvim",
    lazy = false,
    priority = 1000,
    opts = {},
  },
  {
    "catppuccin/nvim",
    name = "catppuccin",
    lazy = false,
    priority = 999,
    opts = { flavour = "mocha" },
  },
  {
    "folke/tokyonight.nvim",
    lazy = false,
    priority = 999,
    opts = {},
  },
}
