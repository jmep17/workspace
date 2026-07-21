-- nvim-treesitter `main` branch (the maintained rewrite; `master` is frozen).
-- The main branch is install-only: highlighting/indent are enabled per-buffer
-- via core APIs in the FileType autocmd below.
return {
  {
    "nvim-treesitter/nvim-treesitter",
    branch = "main",
    build = ":TSUpdate",
    lazy = false,
    config = function()
      local parsers = {
        "bash",
        "css",
        "diff",
        "dockerfile",
        "fish",
        "gitcommit",
        "gitignore",
        "html",
        "javascript",
        "jsdoc",
        "json",
        "markdown",
        "markdown_inline",
        "python",
        "regex",
        "scss",
        "toml",
        "tsx",
        "typescript",
        "yaml",
      }
      require("nvim-treesitter").install(parsers)

      vim.api.nvim_create_autocmd("FileType", {
        group = vim.api.nvim_create_augroup("wsnvim_treesitter", { clear = true }),
        callback = function(event)
          local ok = pcall(vim.treesitter.start, event.buf)
          if ok then
            vim.bo[event.buf].indentexpr = "v:lua.require'nvim-treesitter'.indentexpr()"
          end
        end,
      })
    end,
  },

  -- Auto-close/rename JSX and HTML tags
  {
    "windwp/nvim-ts-autotag",
    event = { "BufReadPre", "BufNewFile" },
    opts = {},
  },

  -- Correct commentstring inside JSX/TSX for native `gc` commenting
  {
    "JoosepAlviste/nvim-ts-context-commentstring",
    event = { "BufReadPre", "BufNewFile" },
    config = function()
      require("ts_context_commentstring").setup({ enable_autocmd = false })
      local get_option = vim.filetype.get_option
      ---@diagnostic disable-next-line: duplicate-set-field
      vim.filetype.get_option = function(filetype, option)
        return option == "commentstring"
            and require("ts_context_commentstring.internal").calculate_commentstring()
          or get_option(filetype, option)
      end
    end,
  },
}
