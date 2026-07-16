return {
  -- Statusline
  {
    "nvim-lualine/lualine.nvim",
    dependencies = { "nvim-tree/nvim-web-devicons" },
    event = "VeryLazy",
    opts = {
      options = {
        theme = "auto",
        globalstatus = true,
        disabled_filetypes = { statusline = { "snacks_dashboard" } },
      },
      sections = {
        lualine_a = { "mode" },
        lualine_b = { "branch" },
        lualine_c = {
          { "diagnostics" },
          { "filename", path = 1 },
        },
        lualine_x = {
          {
            -- attached LSP clients
            function()
              local clients = vim.lsp.get_clients({ bufnr = 0 })
              if #clients == 0 then
                return ""
              end
              local names = {}
              for _, client in ipairs(clients) do
                names[#names + 1] = client.name
              end
              return table.concat(names, " ")
            end,
          },
          "diff",
        },
        lualine_y = { "progress" },
        lualine_z = { "location" },
      },
      extensions = { "lazy", "nvim-dap-ui", "oil", "quickfix" },
    },
  },

  -- Keymap discoverability
  {
    "folke/which-key.nvim",
    event = "VeryLazy",
    keys = {
      {
        "<leader>?",
        function()
          require("which-key").show({ global = false })
        end,
        desc = "Buffer-local keymaps (which-key)",
      },
    },
    opts = {
      spec = {
        { "<leader>a", group = "ai (claude)" },
        { "<leader>b", group = "buffer" },
        { "<leader>c", group = "code" },
        { "<leader>d", group = "debug" },
        { "<leader>f", group = "find" },
        { "<leader>g", group = "git" },
        { "<leader>gh", group = "hunks" },
        { "<leader>s", group = "search" },
        { "<leader>sn", group = "noice" },
        { "<leader>t", group = "test" },
        { "<leader>u", group = "ui/toggles" },
        { "<leader>x", group = "lists" },
      },
    },
  },
}
