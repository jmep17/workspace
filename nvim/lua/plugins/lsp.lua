-- LSP layer: Mason installs servers/tools, nvim-lspconfig provides server
-- definitions, native vim.lsp.config()/enable() (0.11+) wires them up.
--
-- Server choices (each a one-line swap by design):
--   TypeScript: vtsls        (swap candidate: tsgo when it matures)
--   Python:     basedpyright (swap candidate: pyrefly) + ruff for lint/format
return {
  {
    "mason-org/mason.nvim",
    cmd = "Mason",
    build = ":MasonUpdate",
    opts = {},
  },

  {
    "WhoIsSethDaniel/mason-tool-installer.nvim",
    dependencies = { "mason-org/mason.nvim" },
    event = "VeryLazy",
    opts = {
      ensure_installed = {
        -- formatters
        "prettier",
        "stylua",
        -- linters without an LSP (nvim-lint)
        "shellcheck",
        "hadolint",
        "markdownlint",
        -- debuggers
        "debugpy",
        "js-debug-adapter",
      },
    },
  },

  {
    "neovim/nvim-lspconfig",
    event = { "BufReadPre", "BufNewFile" },
    dependencies = {
      "mason-org/mason.nvim",
      { "mason-org/mason-lspconfig.nvim", opts = {} },
    },
    config = function()
      -- Diagnostics UI
      vim.diagnostic.config({
        underline = true,
        update_in_insert = false,
        severity_sort = true,
        virtual_text = { spacing = 2, source = "if_many" },
        float = { border = "rounded", source = "if_many" },
        signs = {
          text = {
            [vim.diagnostic.severity.ERROR] = "✘",
            [vim.diagnostic.severity.WARN] = "▲",
            [vim.diagnostic.severity.HINT] = "⚑",
            [vim.diagnostic.severity.INFO] = "»",
          },
        },
      })

      -- Server settings (overrides merged onto nvim-lspconfig defaults)
      vim.lsp.config("basedpyright", {
        settings = {
          basedpyright = {
            disableOrganizeImports = true, -- ruff owns imports
            analysis = {
              typeCheckingMode = "standard",
            },
          },
        },
      })

      vim.lsp.config("lua_ls", {
        settings = {
          Lua = {
            workspace = { checkThirdParty = false },
            completion = { callSnippet = "Replace" },
          },
        },
      })

      local servers = {
        "vtsls",
        "eslint",
        "basedpyright",
        "ruff",
        "lua_ls",
        "jsonls",
        "yamlls",
        "dockerls",
        "marksman",
        "html",
        "cssls",
        "tailwindcss",
      }

      -- mason-lspconfig maps these names to Mason packages and installs them;
      -- automatic_enable (its default) then calls vim.lsp.enable() for each.
      require("mason-lspconfig").setup({ ensure_installed = servers })

      -- Per-buffer LSP behavior
      vim.api.nvim_create_autocmd("LspAttach", {
        group = vim.api.nvim_create_augroup("wsnvim_lsp_attach", { clear = true }),
        callback = function(event)
          local client = vim.lsp.get_client_by_id(event.data.client_id)
          local buf = event.buf

          -- ruff: defer hover to basedpyright
          if client and client.name == "ruff" then
            client.server_capabilities.hoverProvider = false
          end

          -- stylua: ignore start
          local map = function(lhs, rhs, desc, mode)
            vim.keymap.set(mode or "n", lhs, rhs, { buffer = buf, desc = desc })
          end
          map("gd", function() Snacks.picker.lsp_definitions() end, "Goto definition")
          map("gr", function() Snacks.picker.lsp_references() end, "References")
          map("gI", function() Snacks.picker.lsp_implementations() end, "Goto implementation")
          map("gy", function() Snacks.picker.lsp_type_definitions() end, "Goto type definition")
          map("gD", vim.lsp.buf.declaration, "Goto declaration")
          map("<leader>ss", function() Snacks.picker.lsp_symbols() end, "Document symbols")
          map("<leader>sS", function() Snacks.picker.lsp_workspace_symbols() end, "Workspace symbols")
          map("K", function() vim.lsp.buf.hover({ border = "rounded" }) end, "Hover")
          map("gK", function() vim.lsp.buf.signature_help({ border = "rounded" }) end, "Signature help")
          map("<leader>ca", vim.lsp.buf.code_action, "Code action", { "n", "v" })
          map("<leader>cr", vim.lsp.buf.rename, "Rename")
          -- stylua: ignore end
        end,
      })

      -- eslint: fix all on save (runs before conform's format-on-save)
      vim.api.nvim_create_autocmd("BufWritePre", {
        group = vim.api.nvim_create_augroup("wsnvim_eslint_fix", { clear = true }),
        callback = function(event)
          if vim.g.autoformat == false or vim.b[event.buf].autoformat == false then
            return
          end
          local clients = vim.lsp.get_clients({ bufnr = event.buf, name = "eslint" })
          if #clients > 0 then
            vim.cmd("LspEslintFixAll")
          end
        end,
      })
    end,
  },

  -- Lua dev environment for editing this config
  {
    "folke/lazydev.nvim",
    ft = "lua",
    opts = {
      library = {
        { path = "${3rd}/luv/library", words = { "vim%.uv" } },
        { path = "snacks.nvim", words = { "Snacks" } },
        { path = "lazy.nvim", words = { "LazyVim" } },
      },
    },
  },
}
