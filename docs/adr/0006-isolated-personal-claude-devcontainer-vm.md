# Isolated personal Claude: devcontainer by default, credential-free VM for hard cases

Using the personal Claude subscription near work code needs containment: it must see only the repo it's pointed at, and its access must fail closed. Config-level controls (permission deny rules, sandbox settings) were rejected as the primary mechanism — they block by enumeration, and a forgotten pattern or an approved prompt exposes the host. Isolation by construction won instead, in two tiers.

Tier one is a devcontainer (`.devcontainer/`, modeled on Anthropic's reference): only the repo is bind-mounted, and a default-deny egress firewall allowlists Anthropic/npm/GitHub. It's the daily driver because the bind mount keeps host-nvim editing live. Enforcement is wired into `claude-switch` as a per-profile `container` flag — the personal shim refuses to run uncontained rather than falling back silently (`--no-container` is the explicit escape hatch). Container auth lives in the container volume, not the host profile: macOS Keychain credentials can't cross a mount, and shouldn't.

Tier two is a UTM Linux VM holding zero credentials. Code enters as an rsync snapshot (`vm-in`) and leaves only as format-patch output (`vm-out`) reviewed and pushed from the host — git remotes never work inside the guest, so exfiltration via push is structurally impossible. Shared folders were declined for the same reason we chose a VM at all: a standing mount is a standing hole. The patch file is the review boundary; nothing auto-applies.

Neither tier changes where read data goes: everything a session sees still reaches Anthropic under consumer terms. That judgment — is this repo okay to share — stays a human decision made before either tier is invoked. See `docs/claude-isolation.md` for operation.
