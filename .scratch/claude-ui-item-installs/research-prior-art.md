# Prior-art research: claude-ui copy-based item installs

**Date:** 2026-07-22
**For:** `docs/superpowers/specs/2026-07-22-claude-ui-item-installs-design.md`
**Method:** primary sources only — official docs, README/source on GitHub, man pages. Every claim carries a source URL.

Our design in one line: library repo → per-config-dir copies, a JSON manifest with
`installed_hash` per item, state (up to date / update available / modified / untracked)
derived by hashing, untracked never touched, enable/disable by rename into `.disabled/`.

---

## 1. `skills` CLI (vercel-labs/skills, skills.sh ecosystem)

Sources:
- README: https://github.com/vercel-labs/skills
- Global lock: https://github.com/vercel-labs/skills/blob/main/src/skill-lock.ts
- Project lock: https://github.com/vercel-labs/skills/blob/main/src/local-lock.ts
- Update flow: https://github.com/vercel-labs/skills/blob/main/src/update.ts
- Installer: https://github.com/vercel-labs/skills/blob/main/src/installer.ts

**Model.** `npx skills add owner/repo` installs skills into per-agent directories
(project `./<agent>/skills/`, global `~/<agent>/skills/`); "universal" agents share a
canonical dir (`~/.agents/skills` globally) and other agents get **symlinks to the
canonical copy** ("Symlink (Recommended): Creates symlinks from each agent to a
canonical copy. Single source of truth, easy updates.") or independent copies
(`--copy`) ([README](https://github.com/vercel-labs/skills)).

**Two lock files, two hash strategies:**

- Global: `~/.agents/.skill-lock.json` (or `$XDG_STATE_HOME/skills/`). Per-skill entry
  records `source`, `sourceType`, `sourceUrl`, `ref`, `skillPath`, timestamps, and
  `skillFolderHash` — a **GitHub tree SHA of the upstream folder**, not a local hash
  ([skill-lock.ts](https://github.com/vercel-labs/skills/blob/main/src/skill-lock.ts)).
- Project: `skills-lock.json` at repo root, checked into VCS, "Intentionally minimal
  and timestamp-free to minimize merge conflicts", keys sorted alphabetically for
  deterministic output. Its `computedHash` is a **SHA-256 computed from actual file
  contents on disk**: files collected recursively, "Sort by relative path for
  deterministic hashing", and "Include the path in the hash so renames are detected"
  ([local-lock.ts](https://github.com/vercel-labs/skills/blob/main/src/local-lock.ts)).
  This is nearly identical to our spec's hashing scheme (sorted relative file list +
  bytes).

**Update.** `npx skills update` clones each source to a temp dir, computes the
upstream folder hash, and marks a skill updatable when `latestHash !== entry.skillFolderHash`
([update.ts](https://github.com/vercel-labs/skills/blob/main/src/update.ts)). It then
re-runs `skills add <source> -y` for the skill. Skills whose source can't be
re-checked (local paths, raw git URLs, missing hash) are reported as
"cannot be checked automatically" with a per-skill reason — an explicit
untracked/unverifiable listing, like our untracked rows.

**What they solved that we should note:**
- **Upstream deletion flow**: update detects skills "deleted upstream" and prompts
  "Would you like to remove the local copies of these deleted skills?" — a concrete
  precedent for our `orphaned` state offering uninstall
  ([update.ts](https://github.com/vercel-labs/skills/blob/main/src/update.ts)).
- **Merge-friendly project manifest** (sorted, timestamp-free) — worth copying if our
  manifest ever lands in a shared repo.
- `skills generate-lock` retro-matches already-installed skills to sources "for update
  tracking" ([README](https://github.com/vercel-labs/skills)) — an adopt/re-track
  operation for the manifest-lost case.

**What they got wrong (validates our choices):**
- **No local-modification detection.** The update path compares upstream hash to lock
  hash only; nothing compares the *installed copy* to the lock. Install's
  `cleanAndCreateDirectory()` does `rm(path, {recursive, force})` then `mkdir`
  ([installer.ts](https://github.com/vercel-labs/skills/blob/main/src/installer.ts)),
  so `skills update` silently destroys user edits to an installed skill. Our
  `modified` state + confirm + `.bak` is exactly the missing piece.
- **Lock-version bumps wipe tracking.** `readSkillLock()` returns an empty lock
  "if old format (version < CURRENT_VERSION)"
  ([skill-lock.ts](https://github.com/vercel-labs/skills/blob/main/src/skill-lock.ts)) —
  every installed skill silently loses update tracking. Validates our
  "manifest corrupt/missing → degrade to untracked" direction, but argues for a
  schema `version` field with *migration*, not wipe.
- The remote tree-SHA hash means private/deleted repos and non-GitHub sources simply
  can't be checked; our library-side hash is computed locally and has no such gap.

The same codebase is published as `antfu/skills-cli` ("The open agent skills tool")
with the identical install model (https://github.com/antfu/skills-cli).

---

## 2. Claude Code plugins / marketplaces (first-party prior art)

Sources:
- https://code.claude.com/docs/en/plugins
- https://code.claude.com/docs/en/plugins-reference

**Model.** Plugins are self-contained dirs (`skills/`, `commands/`, `agents/`,
`hooks/`, …) with a `.claude-plugin/plugin.json` manifest. "For security and
verification purposes, Claude Code copies *marketplace* plugins to the user's local
**plugin cache** (`~/.claude/plugins/cache`) rather than using them in-place" —
i.e. Anthropic's own first-party answer is also **copy-based, not symlink-based**
([plugins-reference](https://code.claude.com/docs/en/plugins-reference)).

**Versioned immutable copies, delayed GC.** "Each installed version is a separate
directory in the cache. When you update or uninstall a plugin, the previous version
directory is marked as orphaned and removed automatically 14 days later. The grace
period lets concurrent Claude Code sessions that already loaded the old version keep
running without errors" ([plugins-reference](https://code.claude.com/docs/en/plugins-reference)).
Glob/Grep skip orphaned dirs. This is a Nix-like versioned-store approach: the cache
is tool-owned and treated as immutable; there is **no modified-copy story at all** —
user edits to the cache are unsupported and untracked.

**Version as cache key.** "Claude Code uses the plugin's version as the cache key that
determines whether an update is available." Resolution order: `version` in
`plugin.json` → `version` in the marketplace entry → git commit SHA → `unknown`.
Warning in the docs: "If you set `version` in `plugin.json`, you must bump it every
time you want users to receive changes" ([plugins-reference](https://code.claude.com/docs/en/plugins-reference)).
Declared-version drift detection is fragile in exactly the way our content-hash
approach avoids — the docs have to warn authors about it.

**Enable/disable is settings state, not file moves.** Install scope maps to a settings
file (`~/.claude/settings.json`, `.claude/settings.json`, `.claude/settings.local.json`),
and enablement is an `enabledPlugins` entry: "an entry for the plugin in
`enabledPlugins` at any settings scope … persists across plugin updates and
reinstalls" ([plugins-reference](https://code.claude.com/docs/en/plugins-reference)).
So the first-party disable mechanism never renames or moves files. That option is not
available to us for *standalone* items (there is no `enabledSkills` for plain
`~/.claude/skills/` entries), which is why our `.disabled/` rename exists; but it
means our mechanism is a workaround for a gap Anthropic may close — worth isolating
behind a small module.

**Mutable state lives outside the install.** `${CLAUDE_PLUGIN_DATA}`
(`~/.claude/plugins/data/<id>/`) "survives plugin updates"; the recommended pattern
for detecting when an update changed dependencies is to compare "the bundled manifest
against a copy in the data directory" — a copy-and-diff drift check, same shape as
our `installed_hash` ([plugins-reference](https://code.claude.com/docs/en/plugins-reference)).

**In-place loading exists too.** "Skills-directory plugins" (a folder under
`~/.claude/skills/` with a manifest) are "discovered in place rather than copied into
the plugin cache"; "There is no `uninstall` step because nothing was installed from a
marketplace" ([plugins-reference](https://code.claude.com/docs/en/plugins-reference)).
Also note: standalone-to-plugin migration docs state plugin skills are namespaced
(`/plugin-name:hello`) precisely to prevent name conflicts
([plugins](https://code.claude.com/docs/en/plugins)) — our name-collision hard stop
is the un-namespaced equivalent.

**Takeaways:** copy-based install validated by the first party; their versioned-dirs +
grace-period model handles concurrent running sessions, which our in-place overwrite
does not (acceptable for markdown items, but worth a note in the spec); their
enable/disable-in-settings shows a config-state alternative to renames.

---

## 3. chezmoi — the closest analog to copy + manifest + drift

Sources:
- Concepts: https://www.chezmoi.io/reference/concepts/
- Apply: https://www.chezmoi.io/reference/commands/apply/ (fetched via https://raw.githubusercontent.com/twpayne/chezmoi/master/assets/chezmoi.io/docs/reference/commands/apply.md)
- Status: https://www.chezmoi.io/reference/commands/status/
- Re-add: https://www.chezmoi.io/reference/commands/re-add/
- Architecture (persistent state): https://www.chezmoi.io/developer-guide/architecture/ (fetched via https://raw.githubusercontent.com/twpayne/chezmoi/master/assets/chezmoi.io/docs/developer-guide/architecture.md)
- Design FAQ: https://www.chezmoi.io/user-guide/frequently-asked-questions/design/ (fetched via https://raw.githubusercontent.com/twpayne/chezmoi/master/assets/chezmoi.io/docs/user-guide/frequently-asked-questions/design.md)

**Model.** Three states: **source** (the repo, `~/.local/share/chezmoi`), **target**
(desired, computed from source + config), **destination** (what's actually on disk).
`apply` "computes the target state for the current machine and then updates the
destination directory" ([concepts](https://www.chezmoi.io/reference/concepts/)).
It deliberately rejected symlinks: "Instead of using a symlink to redirect from the
dotfile's location to the centralized directory, chezmoi generates the dotfile as a
regular file in its final location"
([design FAQ](https://www.chezmoi.io/user-guide/frequently-asked-questions/design/)) —
the same library→real-copy conclusion our spec reached.

**Drift tracking = hash of last-written content, exactly our `installed_hash`.**
From the architecture doc: "an `EntryState` struct represents a serialization of an
`ActualEntryState` for storage in … chezmoi's persistent state. It stores a SHA256 of
the entry's contents, rather than the full contents, to avoid storing secrets" and
"chezmoi stores the `EntryState` of each entry that it writes in its persistent
state. chezmoi can then detect if a third party has updated a target since chezmoi
last wrote it" ([architecture](https://www.chezmoi.io/developer-guide/architecture/)).
The persistent state lives in `chezmoistate.boltdb` next to the config file
([global flags](https://www.chezmoi.io/reference/command-line-flags/global/)).

**Modified-copy protection on apply.** "If a target has been modified since chezmoi
last wrote it then the user will be prompted if they want to overwrite the file"
([apply](https://www.chezmoi.io/reference/commands/apply/)). This is precisely our
update-over-modified confirmation — chezmoi prompts but writes no backup; our `.bak`
is stronger.

**Our state table is chezmoi's `status` output.** `chezmoi status` prints two columns:
the first "indicates differences between the last state written by chezmoi and the
actual current state" (= our config-vs-installed axis, i.e. *modified*), the second
"between the actual state and the target state, showing what will happen when running
`chezmoi apply`" (= our library-vs-installed axis, i.e. *update available*)
([status](https://www.chezmoi.io/reference/commands/status/)). Independent
confirmation that two hash comparisons are the right decomposition.

**Push back = `chezmoi re-add`.** Re-add copies destination changes back over the
source; caveat: it "will not overwrite templates" — a reminder that push-back must
refuse when the library side is not a plain copy of what was installed
([re-add](https://www.chezmoi.io/reference/commands/re-add/)).

**Unmanaged files are structurally safe.** Apply iterates only source-state entries
("For each entry in the source state … compute its `TargetStateEntry` and read its
actual state"), so unmanaged files are never candidates for modification
([architecture](https://www.chezmoi.io/developer-guide/architecture/)). Same rule as
our "claude-ui writes only to manifest-listed paths."

**What chezmoi has that we lack:** `--dry-run` runs against "a temporary persistent
state in memory which remembers writes but does not persist them"
([architecture](https://www.chezmoi.io/developer-guide/architecture/)) — cheap to add
once operations are pure functions of (library, config, manifest); and interactivity
policy flags (`--force`, `--interactive`, `--less-interactive`: "Prompt before
applying changed or pre-existing targets",
[global flags](https://www.chezmoi.io/reference/command-line-flags/global/)).

---

## 4. GNU Stow — the symlink-farm counterpoint

Source: https://www.gnu.org/software/stow/manual/stow.html

- **Structural ownership, no manifest.** "Stow 'owns' everything living in the target
  tree that points into a package in the stow directory" and "Stow will never delete
  anything that it doesn't own." Ownership is derivable from the filesystem (does the
  symlink point into the stow dir?), so no state file is needed. Copies destroy this
  property — which is exactly why our design *must* carry a manifest. Good framing
  for the spec's rationale.
- **Two-phase conflict checking.** Stow "adopts a two-phase algorithm, first scanning
  for any potential conflicts before any stowing or unstowing operations are
  performed"; on conflict it terminates without touching the filesystem. Our
  per-item collision hard stop is weaker for bulk operations: "update all" or
  "migrate" should pre-scan all planned writes and abort before writing anything.
- **`--adopt` is our adopt.** With `--adopt`, an existing plain file is "moved to the
  same relative place within the package's installation image within the stow
  directory, and then stowing proceeds" — same semantics as our adopt operation
  (config file becomes the library copy).
- **Tree folding/unfolding** (single dir-level symlink until a second package needs
  the dir, then "the symlink /usr/local/bin is deleted; the directory … is created;
  links are made") is the machinery needed to make dir-level symlinks coexist with
  other writers — the precise complexity our spec's Problem section is escaping.
  Stow needed an algorithm for it; we're right to drop the model instead.

---

## 5. Package-manager patterns (dpkg conffiles, npm lock, Nix)

### dpkg conffiles — the modified-on-update decision table

Sources:
- Debian Policy §10.7: https://www.debian.org/doc/debian-policy/ch-files.html
- dpkg(1): https://manpages.debian.org/bookworm/dpkg/dpkg.1.en.html

Policy requirement: "local changes must be preserved during a package upgrade"
([Debian Policy](https://www.debian.org/doc/debian-policy/ch-files.html)). dpkg
implements this with a three-way comparison (shipped-old vs shipped-new vs local
file) and prompts **only** in one cell of the table: dpkg asks when "a conffile has
been modified and the version in the package did change"
([dpkg(1)](https://manpages.debian.org/bookworm/dpkg/dpkg.1.en.html)). Unmodified →
silently upgraded; modified but package unchanged → user's file kept silently. That
is exactly our table: only `modified + update available` needs confirmation.

Two further dpkg ideas map cleanly:

- **Non-interactive policies**: `--force-confold` / `--force-confnew` /
  `--force-confdef` / `--force-confask` let automation pick "keep mine" / "take
  theirs" per run ([dpkg(1)](https://manpages.debian.org/bookworm/dpkg/dpkg.1.en.html)).
  If claude-ui ever grows a CLI/batch mode, these are the named policies to copy.
- **Deletion is a change too**: `--force-confmiss` ("Always install the missing
  conffile without prompting. This is dangerous, since it means not preserving a
  change (removing) made to the file") treats a user-deleted config file as a
  deliberate local modification. Our spec defines a `missing` state but no actions
  for it; dpkg says reinstalling over `missing` deserves the same confirmation as
  overwriting `modified`.

### npm package-lock — integrity hashes and a cheap staleness heuristic

Source: https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json

The `integrity` field is "A `sha512` or `sha1` Standard Subresource Integrity string
for the artifact that was unpacked in this location" — manifest-recorded content
hashes verifying installed artifacts, same role as `installed_hash`. More
interesting: the hidden lockfile (`node_modules/.package-lock.json`) is trusted only
when "All package folders it references exist … No package folders exist in the
hierarchy that are not listed in the lockfile. The modified time of the file is at
least as recent as all of the package folders it references." Existence + no-extras +
**mtime** checks give npm an O(stat) fast path before any hashing — directly reusable
if per-refresh sha256 of every item ever gets slow in the panel.

### Nix — canonical serialization before hashing

Source: https://nix.dev/manual/nix/latest/store/file-system-object/content-address

Nix content-addresses a directory tree by serializing it canonically first: "The
simplest method is to serialise the entire file system object tree into a single
binary string, and then hash that binary string, yielding the content address" — via
the NAR format rather than tar/zip, so the same tree always hashes identically. Two
lessons for our hash definition: (1) the serialization must be **unambiguous** —
concatenating `relpath + bytes` (as both our spec and vercel's `computeSkillFolderHash`
do) is ambiguous without length prefixes or per-file digests; (2) NAR includes the
**executable bit**, which our spec's "sorted relative file list and each file's
bytes" does not — a `chmod +x` on a skill's script would be invisible to drift
detection. Claude Code's plugin cache (immutable versioned dirs, delayed GC) is the
Nix-store pattern applied to plugins (see §2).

---

## 6. Other published Claude Code config managers

- **davila7/claude-code-templates** (aitmpl.com) — `npx claude-code-templates
  --agent X --command Y` copies components into place; no lockfile/manifest or drift
  model is documented, install is fire-and-forget; has a `--health-check`
  diagnostics mode but no per-item state (https://github.com/davila7/claude-code-templates).
  Popularity of the copy-install UX, absence of any update/drift story — our manifest
  is the differentiator.
- **tc9011/skills-manager** — git push/pull of `~/.agents/` plus re-linking; notable
  ownership discipline: "This tool reads `.skill-lock.json` but never modifies it —
  that file is owned by vercel-labs/skills" (https://github.com/tc9011/skills-manager).
  Clean precedent for single-writer manifests (only claude-ui writes
  `.claude-ui-manifest.json`).
- **elizabethfuentes12/claude-code-dotfiles** — whole-`~/.claude` git sync ("Keep
  CLAUDE.md, commands, hooks and settings always in sync"), no per-item model
  (https://github.com/elizabethfuentes12/claude-code-dotfiles). Whole-dir sync has
  the same can't-coexist-with-local-items problem as our old whole-dir symlinks.
- **justcarlson/dotfiles-claude** — packages personal dotfiles as a Claude Code
  *plugin* installed via `/plugin marketplace add` + `/plugin install`
  (https://github.com/justcarlson/dotfiles-claude) — i.e. some users solve our
  problem by riding the first-party plugin system instead of managing item files.

No published tool found combines per-item copies + content-hash manifest + drift
states for standalone `~/.claude` items; the two serious manifest efforts
(vercel-labs/skills, Claude Code plugins) each lack the modified-copy axis.

---

## Implications for our spec

Concrete changes worth considering, in rough priority order:

1. **Make the item hash canonical and complete.** Hash a structured encoding, not
   bare concatenation (per-file: `sha256(relpath) + sha256(bytes)`, or NAR-style
   length-prefixed), and include the executable bit — skills ship `scripts/`, and a
   `chmod` is currently invisible. Also state how symlinks inside an item hash.
   (Nix NAR, vercel `computeSkillFolderHash` shares our ambiguity.)
2. **Add a manifest schema `version` field with a migration rule.** vercel-labs wipes
   the lock on version bump and silently drops all tracking; commit in the spec to
   "migrate, never wipe" (degrading to untracked only on genuine corruption, as
   already specified).
3. **Define actions for the `missing` state.** dpkg treats a user-deleted conffile as
   a preserved local change (`--force-confmiss` is documented as "dangerous").
   Reinstalling over `missing` should require the same explicit confirmation as
   overwriting `modified`; "update all" should skip `missing` just as it skips
   `modified`.
4. **Two-phase bulk operations.** Stow scans for *all* conflicts before touching the
   filesystem and aborts atomically. Migrate and "update all" should build a full
   plan (collisions, modified items, missing items) and present it before writing
   anything — this also gives a dry-run mode nearly for free (chezmoi implements
   dry-run as a throwaway in-memory state).
5. **Note the concurrent-session caveat for in-place updates.** Claude Code's own
   plugin cache keeps the old version directory for 14 days so running sessions don't
   break; our update rewrites an item in place under a possibly-running session.
   Likely fine for markdown items — but say so explicitly in Edge cases.
6. **Isolate the `.disabled/` mechanism behind one module.** The first-party
   enable/disable is settings state (`enabledPlugins`), not file moves; if Claude
   Code ever grows native per-skill disable for standalone items, we'll want to swap
   the mechanism without touching state derivation. Also verify (and cite in the
   spec) the claim that Claude Code skips dot-directories when scanning item dirs —
   the plugin docs don't state it for standalone skills.
7. **Consider dpkg's "keep mine but save theirs" option.** On modified + update,
   besides overwrite-with-`.bak`, offer the inverse: keep the modified copy and write
   the new library version alongside (dpkg's `.dpkg-dist` pattern) so the user can
   merge at leisure.
8. **Optional perf fast-path.** If hashing every item on each panel refresh gets
   slow, npm's hidden-lockfile rules (existence + no-extra-entries + mtime
   comparisons) are the proven cheap pre-check before rehashing.
9. **Keep single-writer manifest discipline.** State in the spec that only claude-ui
   writes `.claude-ui-manifest.json` (skills-manager's "reads but never modifies —
   that file is owned by vercel-labs/skills" is the good-citizen precedent).
