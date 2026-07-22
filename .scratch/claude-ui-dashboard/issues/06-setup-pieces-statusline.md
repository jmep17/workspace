# 06 — Setup pieces: framework + statusline

**What to build:** a setup-pieces panel with its first end-to-end piece. Applying "statusline" drops the script into the config dir and sets the single statusline key in the user's settings — nothing else in the settings file changes. Whether a piece is installed is derived by looking at the target, never recorded. Each piece offers apply and remove.

**Blocked by:** 01 — Teardown.

**Status:** ready-for-agent

- [ ] Applying statusline drops its script and sets exactly one settings key; all other keys survive byte-identical semantics
- [ ] Applying twice yields an identical result (idempotent)
- [ ] Installed state is derived by inspection, with no record kept
- [ ] Remove deletes the dropped script and clears the key, touching nothing else
