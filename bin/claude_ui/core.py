"""Shared constants, machine-local config, and path/frontmatter helpers."""

from pathlib import Path
import json
import os
import re
import secrets



# this file lives at <repo>/bin/claude_ui/core.py
REPO = Path(__file__).resolve().parents[2]

SKILLS = REPO / "skills"

ARCHIVE = REPO / "archive"

CONFIG_FILE = REPO / ".claude-ui.json"

NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")

TYPES = {
    "skills": {"kind": "dir", "root": SKILLS},
    "commands": {"kind": "md", "root": REPO / "commands"},
    "agents": {"kind": "md", "root": REPO / "agents"},
    "output-styles": {"kind": "md", "root": REPO / "output-styles"},
}

CONFIG_FILES = ("CLAUDE.md", "settings.json", "keybindings.json", "statusline.sh")

MAPPINGS = {
    "skills": {"cfg": "skills", "kind": "dir"},
    "commands": {"cfg": "commands", "kind": "dir"},
    "agents": {"cfg": "agents", "kind": "dir"},
    "output-styles": {"cfg": "output-styles", "kind": "dir"},
    **{f: {"cfg": f, "kind": "file"} for f in CONFIG_FILES},
}

# top-level dirs that are never collections
NON_COLLECTIONS = {"bin", "docs", "archive", "claude", "skills", "commands",
                   "agents", "output-styles", "nvim", "tmux", "ghostty", "prompts"}

COLLECTION_MARKERS = ("skills", "commands", "agents", "output-styles",
                      "mcp-servers.json") + CONFIG_FILES

MCP_FILE = "mcp-servers.json"

CLAUDE_JSON = Path.home() / ".claude.json"  # user-scope mcpServers live here

# Per-run token: POSTs must echo it back, so a random webpage doing
# cross-origin/DNS-rebinding requests against 127.0.0.1 can't mutate config.
TOKEN = secrets.token_hex(16)

def collections():
    """Top-level dirs shaped like a Claude config (e.g. work/)."""
    out = []
    for e in sorted(REPO.iterdir()):
        if (not e.is_dir() or e.is_symlink() or e.name.startswith(".")
                or e.name in NON_COLLECTIONS):
            continue
        if any((e / m).exists() for m in COLLECTION_MARKERS):
            out.append(e.name)
    return out

def read_cfg():
    if CONFIG_FILE.is_file():
        try:
            return json.loads(CONFIG_FILE.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return {}

def write_cfg(cfg):
    if not cfg:
        CONFIG_FILE.unlink(missing_ok=True)
    else:
        CONFIG_FILE.write_text(json.dumps(cfg, indent=2) + "\n")

def config_dir():
    p = read_cfg().get("config_dir")
    if p:
        return Path(p).expanduser()
    env = os.environ.get("CLAUDE_CONFIG_DIR")
    return Path(env).expanduser() if env else Path.home() / ".claude"

def set_config_dir(path):
    cfg = read_cfg()
    if not path:
        cfg.pop("config_dir", None)
    else:
        p = Path(path).expanduser()
        if not p.is_absolute():
            raise ValueError("config dir must be an absolute path (or start with ~)")
        cfg["config_dir"] = str(p)
    write_cfg(cfg)

def get_source(fname):
    """Which copy of a config file is linked: 'claude' (shared) or a collection."""
    src = read_cfg().get("sources", {}).get(fname, "claude")
    return src if src == "claude" or src in collections() else "claude"

def set_source(fname, source):
    if fname not in CONFIG_FILES:
        raise ValueError("unknown config file")
    if source != "claude" and source not in collections():
        raise ValueError(f"{source}: no such collection")
    cfg = read_cfg()
    sources = cfg.setdefault("sources", {})
    if source == "claude":
        sources.pop(fname, None)
        if not sources:
            cfg.pop("sources", None)
    else:
        sources[fname] = source
    write_cfg(cfg)

def mapping_repo(mid):
    """Repo-side path for a mapping, honoring the selected file source."""
    m = MAPPINGS[mid]
    if m["kind"] == "dir":
        return TYPES[mid]["root"]
    src = get_source(mid)
    base = REPO / "claude" if src == "claude" else REPO / src
    return base / m["cfg"]

def parse_frontmatter(text):
    meta = {}
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return meta
    key = None
    buf = []
    for line in lines[1:]:
        if line.strip() == "---":
            break
        m = re.match(r"^([A-Za-z0-9_-]+):\s*(.*)$", line)
        if m:
            if key and buf:
                meta[key] = " ".join(buf).strip()
            val = m.group(2).strip()
            if val in (">", "|", ">-", "|-"):
                key, buf = m.group(1), []
            else:
                meta[m.group(1)] = val
                key, buf = None, []
        elif key and line.startswith((" ", "\t")):
            buf.append(line.strip())
    if key and buf:
        meta[key] = " ".join(buf).strip()
    return meta

def _read_json_object(path):
    """(data, error) — data is {} on missing file; error set on bad JSON."""
    if not path.is_file():
        return {}, None
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as e:
        return {}, str(e)
    return (data, None) if isinstance(data, dict) else ({}, "top level is not a JSON object")
