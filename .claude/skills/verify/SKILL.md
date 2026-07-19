---
name: verify
description: How to run and verify bin/claude-ui changes end-to-end in a sandbox.
---

# Verifying bin/claude-ui

The app manages THIS repo (it reconciles symlinks in skills/, and its git
panel can commit), and its default config dir is ~/.claude. Never verify
against the live checkout — always run a sandboxed copy:

```bash
S=$(mktemp -d)
cp -a "$(git rev-parse --show-toplevel)" "$S/apprepo"
mkdir "$S/home"
git -C "$S/apprepo" config user.email t@t && git -C "$S/apprepo" config user.name t
HOME="$S/home" python3 "$S/apprepo/bin/claude-ui" --no-open --port 7455 &
```

- REPO is derived from `__file__`, so running the copy fully isolates it.
- `HOME=` isolates the config dir (~/.claude), ~/.claude.json, and the UI's
  machine-local `.claude-ui.json`.
- Server API is easy to drive with curl: GET `/api/state`, `/api/item?...`;
  POST `/api/new`, `/api/rename`, `/api/git-diff`, etc. Errors come back as
  `{"error": ...}` with HTTP 400.

## Syntax checks (both embedded languages)

```bash
python3 -m py_compile bin/claude-ui
# extract the inline <script> and check it with node:
python3 -c "
import re
from importlib.machinery import SourceFileLoader
mod = SourceFileLoader('cui', 'bin/claude-ui').load_module()
open('/tmp/app.js','w').write(re.search(r'<script>\n(.*)</script>', mod.PAGE, re.S).group(1))
"
node --check /tmp/app.js
```

## Browser drive

Playwright works with the preinstalled Chromium at
`/opt/pw-browsers/chromium-*/chrome-linux/chrome` (pass `executablePath`;
`npm install playwright` in a scratch dir, no browser download needed).

Flows worth driving: tab switching (incl. mcp/statusline/settings), the
item editor (edit button → file tabs → save), the ⋯ row menu + modal
(rename/delete), the git panel (diff/commit against the sandbox copy),
theme toggle, and a no-horizontal-overflow sweep:
`document.documentElement.scrollWidth <= clientWidth` per tab at 320/375/768/1280px.

Gotchas:
- headless Chromium defaults to `prefers-color-scheme: light`, so the page
  loads in the light theme there.
- don't `pkill -f claude-ui` — it matches the calling shell's own command
  line; keep `$!` and `kill` it.
