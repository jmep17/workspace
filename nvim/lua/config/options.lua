-- Leaders must be set before lazy.nvim loads any plugin
vim.g.mapleader = " "
vim.g.maplocalleader = "\\"

-- Format-on-save is on by default; toggled via <leader>uf / :FormatToggle
vim.g.autoformat = true

local opt = vim.opt

opt.number = true
opt.relativenumber = true
opt.cursorline = true
opt.signcolumn = "yes"
opt.termguicolors = true
opt.laststatus = 3

opt.expandtab = true
opt.shiftwidth = 2
opt.tabstop = 2
opt.shiftround = true
opt.smartindent = true

opt.ignorecase = true
opt.smartcase = true
opt.inccommand = "nosplit"

opt.splitright = true
opt.splitbelow = true
opt.splitkeep = "screen"

opt.undofile = true
opt.undolevels = 10000
opt.updatetime = 200
opt.timeoutlen = 300

opt.scrolloff = 4
opt.sidescrolloff = 8
opt.mouse = "a"
opt.clipboard = "unnamedplus"
opt.confirm = true
opt.wrap = true
opt.winminwidth = 5
opt.completeopt = "menu,menuone,noselect"
opt.pumheight = 10
opt.list = true
opt.fillchars = { fold = " ", foldsep = " ", diff = "╱", eob = " " }

opt.foldlevel = 99
opt.foldmethod = "indent"

opt.spelllang = { "en" }
opt.virtualedit = "block"
opt.shortmess:append({ W = true, I = true, c = true, C = true })
