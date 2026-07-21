-- noice.nvim: cmdline popup, message routing, LSP progress/doc rendering.
-- Notifications still render through snacks.notifier (noice routes to
-- vim.notify, which snacks replaces). Signature help stays with blink.cmp.
return {
  "folke/noice.nvim",
  event = "VeryLazy",
  dependencies = { "MunifTanjim/nui.nvim" },
  opts = {
    lsp = {
      override = {
        ["vim.lsp.util.convert_input_to_markdown_lines"] = true,
        ["vim.lsp.util.stylize_markdown"] = true,
      },
      signature = { enabled = false }, -- blink.cmp provides signature help
    },
    routes = {
      -- shove low-value writes/undo chatter into the mini view
      {
        filter = {
          event = "msg_show",
          any = {
            { find = "%d+L, %d+B" },
            { find = "; after #%d+" },
            { find = "; before #%d+" },
          },
        },
        view = "mini",
      },
    },
    presets = {
      bottom_search = true,
      command_palette = true,
      long_message_to_split = true,
    },
  },
  -- stylua: ignore
  keys = {
    { "<leader>snl", function() require("noice").cmd("last") end, desc = "Noice last message" },
    { "<leader>snh", function() require("noice").cmd("history") end, desc = "Noice history" },
    { "<leader>sna", function() require("noice").cmd("all") end, desc = "Noice all" },
    { "<leader>snd", function() require("noice").cmd("dismiss") end, desc = "Dismiss all" },
    { "<S-Enter>", function() require("noice").redirect(vim.fn.getcmdline()) end, mode = "c", desc = "Redirect cmdline output" },
  },
}
