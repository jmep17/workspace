-- nvim-lint: only for linters that have no LSP.
-- (ESLint and Ruff run as language servers — see lsp.lua.)
return {
  "mfussenegger/nvim-lint",
  event = { "BufReadPost", "BufWritePost", "InsertLeave" },
  config = function()
    local lint = require("lint")
    -- MD013 (line-length) is noise for prose, and nothing autofixes it:
    -- prettier's default proseWrap never re-wraps existing lines.
    lint.linters.markdownlint.args = { "--disable", "MD013", "--stdin" }
    lint.linters_by_ft = {
      sh = { "shellcheck" },
      bash = { "shellcheck" },
      dockerfile = { "hadolint" },
      markdown = { "markdownlint" },
    }

    vim.api.nvim_create_autocmd({ "BufReadPost", "BufWritePost", "InsertLeave" }, {
      group = vim.api.nvim_create_augroup("wsnvim_lint", { clear = true }),
      callback = function()
        if vim.bo.modifiable then
          lint.try_lint()
        end
      end,
    })
  end,
}
