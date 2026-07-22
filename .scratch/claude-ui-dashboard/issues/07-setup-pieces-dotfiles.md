# 07 — Setup pieces: fish, tmux, ghostty

**What to build:** the three dotfile pieces, each patching the user's existing setup rather than replacing it: fish via a drop-in in the native `conf.d/` directory (the user's own config untouched), tmux via a single `source-file` line appended only if absent, ghostty via its config's include/merge mechanism. Missing targets are created minimally.

**Blocked by:** 06 — Setup pieces framework.

**Status:** ready-for-agent

- [ ] Fish: drop-in lands in `conf.d/`; the user's own config files are byte-for-byte untouched
- [ ] Tmux: exactly one include line is added if missing; user content around it survives byte-for-byte
- [ ] Ghostty: piece applies via the format's native include/merge; user settings survive
- [ ] Applying any piece twice yields an identical result
- [ ] Remove restores the pre-apply state for the piece's own artifacts
