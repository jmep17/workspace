# 07 — Setup pieces: fish, tmux, ghostty

**What to build:** the three dotfile pieces, each patching the user's existing setup rather than replacing it: fish via a drop-in in the native `conf.d/` directory (the user's own config untouched), tmux via a single `source-file` line appended only if absent, ghostty via its config's include/merge mechanism. Missing targets are created minimally.

**Blocked by:** 06 — Setup pieces framework (done).

**Status:** parked by decision (2026-07-22)

> Investigating the real setup showed the dotfile pieces don't fit as designed:
> `~/.config/fish` is a symlink to `~/src/workspace/fish`, so fish is already
> versioned — a copy/drop-in piece would fight the symlink and add nothing.
> `~/.tmux.conf` (2.5 KB) and the ghostty config (`~/Library/Application
> Support/com.mitchellh.ghostty/config`, Codex-managed) are machine-local with
> no repo payload, so a piece would mean authoring brand-new snippets for a
> need that doesn't concretely exist yet.
>
> Decision: **park this ticket, keep the extensible framework** (`setup.py`
> registry). Adding a dotfile piece later is one registry entry plus
> apply/remove, once a concrete payload and need appear. The statusline piece
> (ticket 06) covers the one real, self-contained case today.

- [ ] Fish: drop-in lands in `conf.d/`; the user's own config files are byte-for-byte untouched
- [ ] Tmux: exactly one include line is added if missing; user content around it survives byte-for-byte
- [ ] Ghostty: piece applies via the format's native include/merge; user settings survive
- [ ] Applying any piece twice yields an identical result
- [ ] Remove restores the pre-apply state for the piece's own artifacts
