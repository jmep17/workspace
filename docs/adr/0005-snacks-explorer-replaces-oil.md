# snacks.explorer replaces oil.nvim in the explorer slot

Supersedes the explorer half of [0003](0003-snacks-bargain-and-oil-explorer.md); the snacks module bargain there is unchanged.

Oil's directory-as-buffer model has no built-in way to copy a file's path, which turned out to be a daily need. snacks.explorer has it natively (`y` yanks the path of the file under the cursor / selection to the clipboard) and was already named in 0003 as the intended fallback, so this is the one-line re-enable that ADR promised — not a new plugin evaluation. oil.nvim is removed; there is still exactly one way to do the job. `<leader>e` toggles the explorer (it reveals the current file by default), and snacks takes over netrw's `nvim <dir>` duty.
