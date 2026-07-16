# lazy.nvim over Neovim 0.12's native vim.pack

Neovim 0.12 ships a native plugin manager (`vim.pack`, core-maintained, real lockfile) and the 2026 consensus is that it's attractive for fresh configs — which this is. We picked lazy.nvim anyway: every plugin README documents a lazy.nvim spec (paste-ability while learning), the tooling is mature, and vim.pack was still officially experimental with no lazy-loading story. The ownership argument for vim.pack was heard and deliberately traded away for ecosystem friction-lessness.

Revisit if/when vim.pack gains lazy-loading and sheds the experimental label — migration at our plugin count (~36) is a known, bounded job.
