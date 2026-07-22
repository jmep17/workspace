# 03 — Enable/disable for file items

**What to build:** every file-based inventory row gets a toggle. Disable moves the item into a visible `disabled/<type>/<name>` area inside the config dir; enable moves it back. The filesystem is the only state — the panel derives enabled/disabled purely from location. Disabled rows render greyed with the toggle available.

**Blocked by:** 02 — Inventory panel.

**Status:** ready-for-agent

- [ ] Disable and enable round-trip an item bit-for-bit via same-filesystem rename
- [ ] A name collision on either side is a hard stop that shows both entries and changes nothing
- [ ] Symlinked items move as symlinks; their targets are never touched
- [ ] Disabled items appear greyed in the inventory, derived from location alone
- [ ] No manifest or state file exists anywhere
