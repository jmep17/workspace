-- oil.nvim owns the explorer slot: a directory is a buffer, file
-- operations are text edits + :w. (snacks explorer deliberately disabled.)
return {
  "stevearc/oil.nvim",
  dependencies = { "nvim-tree/nvim-web-devicons" },
  lazy = false, -- must load eagerly to hijack `nvim <dir>` from netrw
  opts = {
    default_file_explorer = true,
    skip_confirm_for_simple_edits = true,
    view_options = {
      show_hidden = true,
    },
    keymaps = {
      ["q"] = "actions.close",
    },
  },
  keys = {
    { "-", "<cmd>Oil<cr>", desc = "Open parent directory (oil)" },
    {
      "<leader>e",
      function()
        require("oil").open_float()
      end,
      desc = "Explorer (oil float)",
    },
  },
}
