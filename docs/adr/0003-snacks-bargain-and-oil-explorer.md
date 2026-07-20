# snacks.nvim as a deliberate multi-module bargain; oil.nvim owns the explorer

> Explorer half superseded by [0005](0005-snacks-explorer-replaces-oil.md): oil.nvim was replaced by snacks.explorer. The snacks module bargain below still stands.

Choosing snacks.picker pulls in folke's kitchen-sink snacks.nvim, which cuts against hand-rolled minimalism unless used deliberately — so we took nine modules on purpose (picker, notifier, indent, input, bigfile, quickfile, lazygit, words, statuscolumn), each replacing a standalone plugin we'd otherwise evaluate. Dashboard and scroll are off as pure eye candy.

The explorer slot went to oil.nvim (directory-as-buffer editing; the most popular deliberately-chosen explorer at ~6.8k stars) instead of the free snacks.explorer, which is disabled so there's exactly one way to do the job. If a tree-at-a-glance view is missed, snacks.explorer is a one-line re-enable — that's the intended fallback, not neo-tree.
