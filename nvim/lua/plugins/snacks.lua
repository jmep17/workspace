-- snacks.nvim: deliberately adopted for its QoL modules (see ADR 0003).
-- explorer now owns the explorer slot (ADR 0005 — replaced oil.nvim for
-- path-yanking). dashboard/scroll stay off as eye candy we opted out of.
return {
  "folke/snacks.nvim",
  priority = 1000,
  lazy = false,
  opts = {
    bigfile = { enabled = true },
    indent = { enabled = true },
    input = { enabled = true },
    lazygit = {},
    notifier = { enabled = true },
    picker = { enabled = true },
    quickfile = { enabled = true },
    statuscolumn = { enabled = true },
    words = { enabled = true },
    explorer = { enabled = true }, -- also replaces netrw for `nvim <dir>`
    dashboard = { enabled = false },
    scroll = { enabled = false },
  },
  -- stylua: ignore
  keys = {
    -- find
    { "<leader>e", function() Snacks.explorer() end, desc = "Explorer" },
    { "<leader><space>", function() Snacks.picker.smart() end, desc = "Smart find files" },
    { "<leader>ff", function() Snacks.picker.files() end, desc = "Find files" },
    { "<leader>fb", function() Snacks.picker.buffers() end, desc = "Buffers" },
    { "<leader>fr", function() Snacks.picker.recent() end, desc = "Recent files" },
    { "<leader>fc", function() Snacks.picker.files({ cwd = vim.fn.stdpath("config") }) end, desc = "Find config file" },
    { "<leader>fp", function() Snacks.picker.projects() end, desc = "Projects" },
    -- search
    { "<leader>/", function() Snacks.picker.grep() end, desc = "Grep" },
    { "<leader>sg", function() Snacks.picker.grep() end, desc = "Grep" },
    { "<leader>sw", function() Snacks.picker.grep_word() end, desc = "Grep word/selection", mode = { "n", "x" } },
    { "<leader>sb", function() Snacks.picker.lines() end, desc = "Buffer lines" },
    { "<leader>sd", function() Snacks.picker.diagnostics() end, desc = "Diagnostics" },
    { "<leader>sD", function() Snacks.picker.diagnostics_buffer() end, desc = "Buffer diagnostics" },
    { "<leader>sh", function() Snacks.picker.help() end, desc = "Help pages" },
    { "<leader>sk", function() Snacks.picker.keymaps() end, desc = "Keymaps" },
    { "<leader>sr", function() Snacks.picker.resume() end, desc = "Resume last picker" },
    { "<leader>su", function() Snacks.picker.undo() end, desc = "Undo history" },
    { "<leader>n", function() Snacks.picker.notifications() end, desc = "Notification history" },
    { '<leader>s"', function() Snacks.picker.registers() end, desc = "Registers" },
    -- git
    { "<leader>gg", function() Snacks.lazygit() end, desc = "Lazygit" },
    { "<leader>gl", function() Snacks.lazygit.log() end, desc = "Lazygit log" },
    { "<leader>gs", function() Snacks.picker.git_status() end, desc = "Git status" },
    { "<leader>gb", function() Snacks.picker.git_branches() end, desc = "Git branches" },
    { "<leader>gB", function() Snacks.gitbrowse() end, desc = "Git browse", mode = { "n", "v" } },
    -- ui
    { "<leader>uC", function() Snacks.picker.colorschemes() end, desc = "Colorscheme picker" },
    { "<leader>un", function() Snacks.notifier.hide() end, desc = "Dismiss notifications" },
    -- words
    { "]]", function() Snacks.words.jump(vim.v.count1) end, desc = "Next reference" },
    { "[[", function() Snacks.words.jump(-vim.v.count1) end, desc = "Prev reference" },
    -- buffers
    { "<leader>bd", function() Snacks.bufdelete() end, desc = "Delete buffer" },
    { "<leader>bo", function() Snacks.bufdelete.other() end, desc = "Delete other buffers" },
  },
  init = function()
    vim.api.nvim_create_autocmd("User", {
      pattern = "VeryLazy",
      callback = function()
        -- Toggle keymaps (need Snacks loaded)
        Snacks.toggle
          .new({
            name = "Autoformat",
            get = function()
              return vim.g.autoformat ~= false
            end,
            set = function(state)
              vim.g.autoformat = state
            end,
          })
          :map("<leader>uf")
        Snacks.toggle.option("spell", { name = "Spelling" }):map("<leader>us")
        Snacks.toggle.option("wrap", { name = "Wrap" }):map("<leader>uw")
        Snacks.toggle.option("relativenumber", { name = "Relative number" }):map("<leader>uL")
        Snacks.toggle.diagnostics():map("<leader>ud")
        Snacks.toggle.inlay_hints():map("<leader>uh")
        Snacks.toggle.indent():map("<leader>ug")
      end,
    })
  end,
}
