# Claude-only AI: claudecode.nvim, no Copilot, no ghost text

The old config ran Copilot inline completions plus custom Codex chat integrations. The workspace config drops all of it in favor of a single integration: coder/claudecode.nvim, which embeds the real Claude Code CLI (custom statusline, /cost, skills intact — it does not reimplement the UI) and syncs editor context over the same WebSocket protocol as the official IDE extensions. Ghost-text completion was declined outright, not deferred — blink.cmp's ghost_text stays disabled.

Chose the Coder plugin specifically over forks that reimplement the Claude UI (e.g. douglasjordan2/claudecode.nvim), because preserving the CLI experience was the point. It also depends on snacks.nvim, which we already ship (ADR 0003).
