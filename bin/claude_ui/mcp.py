"""MCP servers: the machine's user-scope ~/.claude.json entries."""

import json
import os
import shutil
import urllib.error
import urllib.request

from .core import CLAUDE_JSON, NAME_RE, _read_json_object, atomic_write, tilde


def mcp_state():
    machine_data, merr = _read_json_object(CLAUDE_JSON)
    machine = machine_data.get("mcpServers", {})
    if not isinstance(machine, dict):
        machine, merr = {}, "mcpServers is not an object"
    servers = [{"name": n, "config": cfg} for n, cfg in machine.items()]
    servers.sort(key=lambda r: r["name"])
    return {"servers": servers, "machine_path": tilde(CLAUDE_JSON),
            "machine_exists": CLAUDE_JSON.is_file(), "machine_error": merr}

def validate_mcp_config(config):
    if not isinstance(config, dict):
        raise ValueError("server config must be a JSON object")
    if not (config.get("command") or config.get("url")):
        raise ValueError("server config needs a 'command' (stdio) or 'url' (http/sse/ws)")

def mcp_machine_set(name, config):
    """Set (or remove, config=None) a server in ~/.claude.json mcpServers."""
    if not NAME_RE.match(name or ""):
        raise ValueError("bad server name")
    data, err = _read_json_object(CLAUDE_JSON)
    if err:
        raise ValueError(f"~/.claude.json: {err} — refusing to touch it")
    servers = data.setdefault("mcpServers", {})
    if not isinstance(servers, dict):
        raise ValueError("~/.claude.json: mcpServers is not an object")
    if config is None:
        servers.pop(name, None)
        if not servers:
            data.pop("mcpServers", None)
    else:
        validate_mcp_config(config)
        servers[name] = config
    atomic_write(CLAUDE_JSON, json.dumps(data, indent=2) + "\n")

def mcp_test(name):
    row = next((r for r in mcp_state()["servers"] if r["name"] == name), None)
    if row is None:
        raise ValueError(f"{name}: unknown server")
    cfg = row["config"] or {}
    cmd = cfg.get("command")
    if cmd:
        exe = os.path.expanduser(cmd)
        found = shutil.which(exe)
        if not found and os.path.isfile(exe) and os.access(exe, os.X_OK):
            found = exe
        return {"ok": bool(found),
                "detail": cmd + (": found at " + found if found
                                 else ": not found on PATH (or not executable)")}
    url = cfg.get("url")
    if not url:
        raise ValueError("config has neither command nor url")
    if not url.startswith(("http://", "https://")):
        return {"ok": False, "detail": "unsupported url scheme: " + url}
    try:
        with urllib.request.urlopen(
                urllib.request.Request(url, method="HEAD"), timeout=6) as resp:
            return {"ok": True, "detail": f"HTTP {resp.status}"}
    except urllib.error.HTTPError as e:
        # 401/405/406 from an MCP endpoint still proves it's reachable
        return {"ok": True, "detail": f"reachable (HTTP {e.code})"}
    except (urllib.error.URLError, OSError) as e:
        return {"ok": False, "detail": str(getattr(e, "reason", e) or e)}
