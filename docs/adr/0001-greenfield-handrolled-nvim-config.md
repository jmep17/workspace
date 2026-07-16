# Greenfield hand-rolled Neovim config instead of evolving LazyVim

A working, heavily-customized LazyVim config already existed (github.com/jmep17/nvim, 32 extras). We built a from-scratch config in this repo anyway because the goal is *owning and understanding* every line, not merely having a working editor — evolving the distro would have kept its framework between us and the behavior. The LazyVim config stays untouched as the daily driver until the workspace config earns cutover (side-by-side via `NVIM_APPNAME=nvim-ws`), so the decision is cheap to abandon but expensive to redo — hence this record.

Scope decisions made at the same time: first-class support is TypeScript/JavaScript + Python only; Dart/Flutter dropped; Jupyter/notebook editing deliberately out for now (heaviest, most brittle subsystem of the old config; additive later).
