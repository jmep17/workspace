-- octo.nvim: view and review GitHub pull requests without leaving nvim.
-- Complements the local-diff stack in git.lua: diffview answers "what did I
-- change", octo answers "what's on GitHub" (PRs, reviews, comments).
-- Requires an authenticated `gh` CLI.
-- Keybind mnemonic: <leader>gp = "git pull requests", then one letter for
-- the action (p = pick from list, v = view, c = create, r = review).
return {
  "pwntester/octo.nvim",
  cmd = "Octo",
  dependencies = {
    "nvim-lua/plenary.nvim",
    "folke/snacks.nvim",
    "nvim-tree/nvim-web-devicons",
  },
  keys = {
    { "<leader>gpp", "<cmd>Octo pr list<cr>", desc = "PRs: pick from open list" },
    { "<leader>gpv", "<cmd>Octo pr<cr>", desc = "PR: view current branch's" },
    { "<leader>gpc", "<cmd>Octo pr create<cr>", desc = "PR: create from current branch" },
    { "<leader>gpr", "<cmd>Octo review<cr>", desc = "PR: review (start/resume)" },
    { "<leader>gps", "<cmd>Octo search is:pr is:open author:@me<cr>", desc = "PRs: search mine (all repos)" },
    { "<leader>gpi", "<cmd>Octo issue list<cr>", desc = "Issues: pick from open list" },
  },
  opts = {
    picker = "snacks",
    -- Bare :Octo opens a picker of available commands, so nothing beyond
    -- the keybinds above needs memorizing.
    enable_builtin = true,
  },
}
