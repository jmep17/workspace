-- gitsigns for in-buffer git; anything bigger goes through lazygit (snacks).
-- mini.diff is here solely for its overlay view (full diff rendered inside
-- the buffer: deleted lines, word-level changes). gitsigns keeps owning
-- signs, hunk operations, and navigation, so every overlapping mini.diff
-- feature is turned off: mappings disabled, and the "number" view style so
-- its always-on indicator lives in the number column, not the sign column.
return {
  {
    "nvim-mini/mini.diff",
    event = { "BufReadPre", "BufNewFile" },
    keys = {
      {
        "<leader>gho",
        function()
          require("mini.diff").toggle_overlay(0)
        end,
        desc = "Toggle diff overlay",
      },
    },
    opts = {
      view = { style = "number" },
      mappings = {
        apply = "",
        reset = "",
        textobject = "",
        goto_first = "",
        goto_prev = "",
        goto_next = "",
        goto_last = "",
      },
    },
  },
  {
    "lewis6991/gitsigns.nvim",
    event = { "BufReadPre", "BufNewFile" },
    opts = {
      signs = {
        add = { text = "▎" },
        change = { text = "▎" },
        delete = { text = "_" },
        topdelete = { text = "‾" },
        changedelete = { text = "▎" },
        untracked = { text = "▎" },
      },
      on_attach = function(buffer)
        local gs = package.loaded.gitsigns

        local function map(mode, l, r, desc)
          vim.keymap.set(mode, l, r, { buffer = buffer, desc = desc })
        end

        map("n", "]h", function()
          if vim.wo.diff then
            vim.cmd.normal({ "]c", bang = true })
          else
            gs.nav_hunk("next")
          end
        end, "Next hunk")
        map("n", "[h", function()
          if vim.wo.diff then
            vim.cmd.normal({ "[c", bang = true })
          else
            gs.nav_hunk("prev")
          end
        end, "Prev hunk")

        -- stylua: ignore start
        map({ "n", "v" }, "<leader>ghs", ":Gitsigns stage_hunk<CR>", "Stage hunk")
        map({ "n", "v" }, "<leader>ghr", ":Gitsigns reset_hunk<CR>", "Reset hunk")
        map("n", "<leader>ghS", gs.stage_buffer, "Stage buffer")
        map("n", "<leader>ghR", gs.reset_buffer, "Reset buffer")
        map("n", "<leader>ghp", gs.preview_hunk_inline, "Preview hunk inline")
        map("n", "<leader>ghb", function() gs.blame_line({ full = true }) end, "Blame line")
        map("n", "<leader>ghB", gs.blame, "Blame buffer")
        map("n", "<leader>ghd", gs.diffthis, "Diff this")
        map({ "o", "x" }, "ih", ":<C-U>Gitsigns select_hunk<CR>", "Select hunk")
        -- stylua: ignore end
      end,
    },
  },
}
