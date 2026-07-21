# Claude account switcher

## Problem

One machine, two Claude Code identities:

- **work** — company-provided **Anthropic API key** (Console billing)
- **personal** — **Claude Max subscription** (OAuth `/login`)

Claude Code has no built-in account switcher. Its auth precedence makes
mixing the two on one config dir fragile: an exported `ANTHROPIC_API_KEY`
silently outranks a subscription login, so a work env var leaking into a
personal session bills the work account (and vice versa loses Max access).

## Solution

`bin/claude-switch` — a dependency-free bash CLI (plus `python3` for JSON
merging, same baseline as `claude-ui`). Each **profile** is an isolated
`CLAUDE_CONFIG_DIR` holding its own credentials, history, and settings:

- **api-key profiles** never export the key. The key is stored in the
  macOS Keychain (0600 file fallback elsewhere) and served to Claude Code
  through an `apiKeyHelper` script written into the profile's
  `settings.json`, with `forceLoginMethod: "console"` as a guard.
- **subscription profiles** are a plain config dir with
  `forceLoginMethod: "claudeai"`; run `claude` once inside it and `/login`
  as usual. OAuth credentials land in that dir (Linux) or the Keychain
  (macOS).

Switching is just pointing `CLAUDE_CONFIG_DIR` at the right profile and
clearing any auth env vars (`ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`,
`CLAUDE_CODE_OAUTH_TOKEN`) that would override the profile's own auth.

## Commands

| Command | Effect |
| --- | --- |
| `add <name> --api-key\|--subscription [--dir PATH]` | create/adopt a profile (`--dir ~/.claude` adopts the existing default) |
| `run <name> [args…]` | launch `claude` under the profile, shell-agnostic |
| `env <name> [--fish]` | print export lines to eval/source — switches the current shell |
| `shim <name>` | install a `claude-<name>` wrapper into `~/.local/bin` |
| `list` / `current` | show profiles, auth mode, active marker |
| `remove <name>` | delete profile metadata, config dir (if managed), stored key |

State lives under `~/.claude-profiles/` (override: `CLAUDE_SWITCH_HOME`):
one `<name>.conf` metadata file per profile plus the managed config dirs.

## Known limits

- Two **subscription** profiles on macOS can collide: Claude Code keeps
  OAuth credentials in one Keychain entry regardless of config dir. Not an
  issue for this use case (only one OAuth profile).
- `claude-ui`'s links panel can target a profile dir to share
  skills/commands, but linking the shared `settings.json` over an api-key
  profile's own would drop its `apiKeyHelper`; `add` refuses to merge into
  a symlinked `settings.json` and says why.
- Each profile keeps its own `.claude.json` machine state (user-scope MCP
  servers, onboarding flags), so those are configured per profile — by
  design, but it means repeating MCP setup once per profile.
