return {
  -- Surround: gsa (add), gsd (delete), gsr (replace) — LazyVim mappings
  {
    "echasnovski/mini.surround",
    event = "VeryLazy",
    opts = {
      mappings = {
        add = "gsa",
        delete = "gsd",
        find = "gsf",
        find_left = "gsF",
        highlight = "gsh",
        replace = "gsr",
        update_n_lines = "gsn",
      },
    },
  },

  -- Auto-close brackets/quotes
  {
    "echasnovski/mini.pairs",
    event = "InsertEnter",
    opts = {},
  },

  -- Jump anywhere with s/S
  {
    -- moved from github ggandor/leap.nvim (notice in that repo's README)
    url = "https://codeberg.org/andyg/leap.nvim",
    name = "leap.nvim",
    event = "VeryLazy",
    dependencies = { "tpope/vim-repeat" },
    config = function()
      -- explicit s/S only — create_default_mappings() also claims gs,
      -- which collides with the mini.surround gs* prefix and oil's gs
      vim.keymap.set({ "n", "x", "o" }, "s", "<Plug>(leap-forward)", { desc = "Leap forward" })
      vim.keymap.set({ "n", "x", "o" }, "S", "<Plug>(leap-backward)", { desc = "Leap backward" })
    end,
  },
}
