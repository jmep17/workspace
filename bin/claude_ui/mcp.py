"""MCP servers: repo definitions vs the machine's ~/.claude.json, apply/test."""

from pathlib import Path
import json
import os
import shutil
import urllib.error
import urllib.parse
import urllib.request

from .core import CLAUDE_JSON, MCP_FILE, NAME_RE, REPO, _read_json_object, collections


def mcp_repo_sources():
    yield "claude", REPO / "claude" / MCP_FILE
    for c in collections():
        yield c, REPO / c / MCP_FILE

def mcp_state():
    machine_data, merr = _read_json_object(CLAUDE_JSON)
    machine = machine_data.get("mcpServers", {})
    if not isinstance(machine, dict):
        machine, merr = {}, "mcpServers is not an object"
    rows = {}
    errors = []
    for source, path in mcp_repo_sources():
        data, err = _read_json_object(path)
        if err:
            errors.append(f"{path.relative_to(REPO)}: {err}")
            continue
        servers = data.get("mcpServers", {})
        if isinstance(servers, dict):
            for n, cfg in servers.items():
                rows[n] = {"name": n, "source": source, "config": cfg}
    out = []
    for n, r in rows.items():
        m = machine.get(n)
        status = "repo-only" if m is None else ("applied" if m == r["config"] else "differs")
        out.append({**r, "status": status,
                    "machine_config": m if status == "differs" else None})
    for n, cfg in machine.items():
        if n not in rows:
            out.append({"name": n, "source": None, "config": cfg, "status": "machine-only"})
    out.sort(key=lambda r: r["name"])
    home = str(Path.home())
    return {"servers": out, "machine_path": str(CLAUDE_JSON).replace(home, "~", 1),
            "machine_exists": CLAUDE_JSON.is_file(), "machine_error": merr,
            "errors": errors}

def validate_mcp_config(config):
    if not isinstance(config, dict):
        raise ValueError("server config must be a JSON object")
    if not (config.get("command") or config.get("url")):
        raise ValueError("server config needs a 'command' (stdio) or 'url' (http/sse/ws)")

def mcp_write_repo(source, name, config):
    """Set (or delete, config=None) a server in a repo-side mcp-servers.json."""
    if not NAME_RE.match(name or ""):
        raise ValueError("bad server name")
    if source != "claude" and source not in collections():
        raise ValueError(f"{source}: no such collection")
    path = (REPO / "claude" if source == "claude" else REPO / source) / MCP_FILE
    data, err = _read_json_object(path)
    if err:
        raise ValueError(f"{path.relative_to(REPO)}: {err} — fix it by hand first")
    servers = data.setdefault("mcpServers", {})
    if not isinstance(servers, dict):
        raise ValueError(f"{path.relative_to(REPO)}: mcpServers is not an object")
    if config is None:
        servers.pop(name, None)
        if not servers:
            data.pop("mcpServers", None)
    else:
        validate_mcp_config(config)
        servers[name] = config
    if data:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, indent=2) + "\n")
    elif path.is_file():
        path.unlink()

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
    CLAUDE_JSON.write_text(json.dumps(data, indent=2) + "\n")

def mcp_repo_config(name):
    for source, path in mcp_repo_sources():
        data, err = _read_json_object(path)
        if err:
            continue
        servers = data.get("mcpServers", {})
        if isinstance(servers, dict) and name in servers:
            return servers[name]
    raise ValueError(f"{name}: not defined in the repo")

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
