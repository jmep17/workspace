# 07 — Setup pieces: fish, tmux, ghostty

**What to build:** the three dotfile pieces, each patching the user's existing setup rather than replacing it: fish via a drop-in in the native `conf.d/` directory (the user's own config untouched), tmux via a single `source-file` line appended only if absent, ghostty via its config's include/merge mechanism. Missing targets are created minimally.

**Blocked by:** 06 — Setup pieces framework (done). **Now blocked on payload
content decisions** — see note below.

**Status:** blocked — needs input

> The setup-pieces framework (ticket 06) is built and extensible; adding each
> dotfile piece is a registry entry plus apply/remove. But the payloads don't
> exist in a drop-in-ready form: the repo's `fish/` is a *full* config
> (config.fish + prompt functions), not a `conf.d/` snippet; there are no
> `tmux/` or `ghostty/` dirs at all; and fish is already deployed on this
> machine. Faithful patching needs the actual drop-in content decided first:
> what goes in the fish `conf.d/` snippet, the tmux `source-file` include, and
> the ghostty include/merge. Deferred until those payloads are authored.

- [ ] Fish: drop-in lands in `conf.d/`; the user's own config files are byte-for-byte untouched
- [ ] Tmux: exactly one include line is added if missing; user content around it survives byte-for-byte
- [ ] Ghostty: piece applies via the format's native include/merge; user settings survive
- [ ] Applying any piece twice yields an identical result
- [ ] Remove restores the pre-apply state for the piece's own artifacts
