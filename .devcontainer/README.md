# Claude Code devcontainer

An isolated environment for running Claude Code against **this repository only**.
Based on [Anthropic's reference devcontainer](https://code.claude.com/docs/en/devcontainer):
the container sees the bind-mounted repo and nothing else on your machine, and a
default-deny egress firewall limits outbound traffic to the domains Claude Code,
npm, and GitHub need.

## What this gives you

- **Filesystem isolation.** Only this repo is mounted (at `/workspace`). Other
  repos, `~/.ssh`, cloud credentials, and shell profiles on your host do not
  exist inside the container.
- **Network egress control.** `init-firewall.sh` runs at container start and
  blocks all outbound traffic except an allowlist (Anthropic API/auth, npm,
  GitHub, Claude Code docs). Anything else is rejected.
- **Persistent sign-in.** `~/.claude` (auth token, settings, history) lives in a
  named Docker volume, so you only sign in once per project, not per rebuild.
- **Non-root user.** Claude Code runs as the `node` user.

## Setup

1. Install [Docker](https://docs.docker.com/get-docker/), [VS Code](https://code.visualstudio.com/),
   and the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers).
2. Open this repository in VS Code and run **Dev Containers: Reopen in Container**
   from the Command Palette (`Cmd/Ctrl+Shift+P`).
3. Once the build finishes, open the integrated terminal and run `claude`, then
   follow the sign-in prompt. If the browser callback doesn't reach the
   container, paste the code shown in the browser back into the terminal.

To use this with another repository, copy the `.devcontainer/` directory there
and adjust the Dockerfile for that project's toolchain.

## Keeping it isolated (the parts config can't do for you)

- **Use a scoped git credential.** Don't mount `~/.ssh` or your global git
  credentials. Inside the container, authenticate with a fine-grained GitHub
  token scoped to this one repository (e.g. `git remote set-url origin
  https://x-access-token:<TOKEN>@github.com/<owner>/<repo>.git`, or `gh auth
  login` with a scoped token).
- **Mount only this repo.** Resist adding mounts for sibling directories in
  `devcontainer.json` — the isolation guarantee is exactly as strong as the
  mount list is short.
- **Pass secrets explicitly, if at all.** Anything the project truly needs goes
  in `containerEnv` or a `.env` inside the repo; nothing leaks in from your
  host shell environment.
- **Extend the allowlist deliberately.** If the project needs another registry
  or API, add the domain to `ALLOWED_DOMAINS` in `init-firewall.sh` rather than
  loosening the default-deny policy.

## Notes

- The firewall needs `NET_ADMIN`/`NET_RAW` (set in `runArgs`) and re-runs on
  every container start, so allowlisted IPs stay fresh.
- Because execution is confined to the container, running
  `claude --dangerously-skip-permissions` here is a reasonable trade-off for
  trusted repos — but skipping prompts means Claude's actions inside the
  container go unreviewed, and its credentials/workspace are still reachable by
  anything it runs. See the [warning in the docs](https://code.claude.com/docs/en/devcontainer).
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` turns off optional telemetry and
  error reporting, which also keeps the firewall allowlist minimal.
- Claude Code is installed at image build time and auto-update is disabled
  (`DISABLE_AUTOUPDATER=1`); rebuild the container to pick up new versions.
