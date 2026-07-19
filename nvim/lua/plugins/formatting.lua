-- conform.nvim: format-on-save, always on, with escape hatches:
--   <leader>uf  toggle globally (snacks toggle -> vim.g.autoformat)
--   :FormatDisable[!] / :FormatEnable   (! = buffer-only)
-- Prettier resolves the project-local node_modules binary first.
return {
  "stevearc/conform.nvim",
  event = { "BufWritePre" },
  cmd = { "ConformInfo" },
  keys = {
    {
      "<leader>cf",
      function()
        require("conform").format({ async = true, lsp_format = "fallback" })
      end,
      mode = { "n", "v" },
      desc = "Format buffer/selection",
    },
  },
  opts = {
    formatters_by_ft = {
      lua = { "stylua" },
      python = { "ruff_organize_imports", "ruff_format" },
      javascript = { "prettier" },
      javascriptreact = { "prettier" },
      typescript = { "prettier" },
      typescriptreact = { "prettier" },
      css = { "prettier" },
      scss = { "prettier" },
      html = { "prettier" },
      json = { "prettier" },
      jsonc = { "prettier" },
      yaml = { "prettier" },
      markdown = { "prettier" },
      graphql = { "prettier" },
    },
    formatters = {
      prettier = {
        -- deferred: conform isn't loaded yet when this spec table is parsed
        command = function(self, ctx)
          return require("conform.util").from_node_modules("prettier")(self, ctx)
        end,
        -- CLI flags beat any project .prettierrc, so semicolons are always
        -- added even in projects configured with `semi: false`
        prepend_args = { "--semi" },
      },
    },
    format_on_save = function(bufnr)
      if vim.g.autoformat == false or vim.b[bufnr].autoformat == false then
        return
      end
      return { timeout_ms = 3000, lsp_format = "fallback" }
    end,
  },
  init = function()
    vim.o.formatexpr = "v:lua.require'conform'.formatexpr()"
    vim.api.nvim_create_user_command("FormatDisable", function(args)
      if args.bang then
        vim.b.autoformat = false
      else
        vim.g.autoformat = false
      end
    end, { desc = "Disable format-on-save", bang = true })
    vim.api.nvim_create_user_command("FormatEnable", function()
      vim.b.autoformat = nil
      vim.g.autoformat = true
    end, { desc = "Enable format-on-save" })
  end,
}
