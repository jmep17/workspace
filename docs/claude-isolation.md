# Running personal Claude Code in isolation

How to use a personal Claude subscription on code without giving it the
run of the machine — three layers, strictest last. Written for the
work-laptop case (personal Max sub, employer repos nearby that Claude
must never see), but the layers are general.

**The standing caveat:** these layers control what Claude *reads and
reaches*, not where what it reads *goes*. Everything a session does see
flows to Anthropic under the personal account's consumer terms — check
the training opt-out in account settings, and keep genuinely sensitive
repos out of scope entirely. Isolation is not permission.

## Layer 0 — accounts: `claude-switch`

`bin/claude-switch` keeps work (API key) and personal (subscription)
logins in separate `CLAUDE_CONFIG_DIR` profiles so they can't cross:

```fish
claude-switch add work --api-key
claude-switch add personal --subscription
claude-switch shim personal        # installs a claude-personal command
```

See the header of `bin/claude-switch` for the full command set.

## Layer 1 — devcontainer (the daily driver)

`.devcontainer/` in this repo defines a Docker container that sees only
the bind-mounted repo it's launched from, runs Claude as a non-root
user, and applies a default-deny egress firewall (`init-firewall.sh`)
allowing only Anthropic, npm, and GitHub. Other repos, `~/.ssh`, the
Keychain — none of it exists inside.

Copy the `.devcontainer/` directory into any repo that should get this
treatment, adjust the Dockerfile for its toolchain, and add whatever
registries the project needs to `ALLOWED_DOMAINS` in the firewall
script. Full usage — VS Code, plain CLI, nvim-inside-or-outside — is in
[`.devcontainer/README.md`](../.devcontainer/README.md).

The enforcement hook: mark the personal profile container-only, and its
shim refuses to run uncontained —

```fish
claude-switch container personal on
```

From then on `claude-personal` brings up the devcontainer of whatever
repo you're standing in and runs Claude inside it; in a repo without a
`.devcontainer/` it dies with instructions instead of quietly running on
the host. Escape hatch: `claude-switch run personal --no-container`.
Auth in container mode lives in the container's config volume (Keychain
credentials can't cross a mount), so `/login` once per repo.

What the devcontainer does **not** protect: whatever you deliberately
mount, and the repo itself — Claude can still push it wherever the
firewall allows. Keep the mount list short and the git token scoped to
the one repo.

## Layer 2 — UTM VM (the hard boundary)

For "physically cannot touch anything else": a Linux VM in UTM with
**no credentials at all** — no git token, no ssh keys, no Keychain.
Code goes in as an rsync snapshot and comes out as reviewed patches;
git never runs against a remote inside the guest.

One-time setup:

1. UTM → new Ubuntu Server guest (ARM64 image on Apple Silicon; a few
   CPUs, 8 GB RAM, ~40 GB disk). Install `git`, `nodejs`/`npm`, and
   Claude Code (`npm install -g @anthropic-ai/claude-code`).
2. Host alias in `~/.ssh/config` on the Mac:

   ```
   Host claude-vm
       HostName 192.168.64.5    # the guest's IP, from UTM
       User jorden
   ```

   The fish functions default to `claude-vm`; override per machine with
   `set -gx CLAUDE_VM <alias>`.
3. Sign in once inside the guest (`claude`, then `/login` with the
   personal account). Snapshot the VM here — this is the clean state to
   revert to.
4. Optional belt-and-suspenders: run the same `.devcontainer/` inside
   the guest, or apply the firewall allowlist directly with `ufw`. The
   VM isolates the filesystem; egress rules limit where bytes can go.

The loop, driven by two fish functions
([`vm-in`](../.config/fish/functions/vm-in.fish) /
[`vm-out`](../.config/fish/functions/vm-out.fish)):

```fish
cd ~/src/some-repo
vm-in                  # rsync snapshot → claude-vm:~/work/some-repo
ssh claude-vm          # run claude in there; have it COMMIT its work
vm-out                 # commits since vm-in → claude-<ts>.patch in repo root
git apply --stat claude-*.patch   # review — this is the boundary
git am claude-*.patch             # land it; push from the host as yourself
```

Rules of the loop:

- `vm-in` excludes `.env*`, `node_modules`, and old patches; secrets
  stay on the host. It records the copied HEAD in `.claude-vm-base` on
  the guest so `vm-out` knows exactly what Claude added.
- `vm-in` is a **snapshot, not a sync**. Re-running it overwrites the
  guest copy — it prompts first, but `vm-out` anything you care about
  before re-syncing.
- Patches only carry *commits*. `vm-out` warns when the guest tree is
  dirty; have Claude commit before exporting.
- Review happens on the host, at the patch. Nothing auto-applies.

## Choosing a layer

| Layer        | Boundary                  | Friction | Use when |
| ------------ | ------------------------- | -------- | -------- |
| claude-switch | config dirs               | none     | always — it underlies the others |
| devcontainer | container + egress firewall | low    | daily work on approved repos |
| UTM VM       | hardware virtualization, credential-free | rsync/patch round-trips | the repo or the policy demands a hard guarantee |

Devcontainer by default; VM when a mistake must be impossible rather
than merely prompted-for. Composing them (devcontainer inside the VM)
is legitimate and costs only maintenance.

## New-machine checklist

- [ ] Docker + `npm install -g @devcontainers/cli` (layer 1)
- [ ] `claude-switch add` the profiles; `container personal on`
- [ ] UTM guest built, `claude-vm` ssh alias, `/login` inside, snapshot (layer 2)
- [ ] Per repo: copy `.devcontainer/`, scope a git token to it, `/login` once
