-- gitsigns for in-buffer git; anything bigger goes through lazygit (snacks).
return {
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
}
