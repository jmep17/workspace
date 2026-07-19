"""Health checks over the whole config surface, with safe fix actions."""

from pathlib import Path
import json
import os
import shutil
import time

from .core import REPO, SKILLS, TYPES, _read_json_object, config_dir
from .items import SK_ARCHIVE, TRASH, scan_md, scan_skills, skill_groups_map, trash_entries
from .links import link_state
from .mcp import mcp_state
from .settings import SETTINGS_SCHEMA, settings_state
from .statusline import STATUSLINE_SCRIPT, statusline_paths


def _first_cmd_word(cmd):
    return (cmd or "").strip().split()[0] if (cmd or "").strip() else ""

def _cmd_missing(cmd):
    """True if a hook/statusline command's executable clearly doesn't exist."""
    word = os.path.expanduser(_first_cmd_word(cmd))
    if not word or any(c in word for c in "$`("):  # shell expr — can't judge
        return False
    if word.startswith(("/", ".")) or os.sep in word:
        return not os.path.exists(word)
    return shutil.which(word) is None

def doctor():
    finds = []

    def add(level, area, msg, fix=None):
        finds.append({"level": level, "area": area, "msg": msg, "fix": fix})

    cfg = config_dir()
    home = str(Path.home())

    # leftover *.bak from linking
    if cfg.is_dir():
        for p in sorted(cfg.glob("*.bak*")):
            add("warn", "links",
                f"{str(p).replace(home, '~', 1)} — backup left behind by a "
                "link operation; delete once you're sure",
                {"action": "delete-bak", "path": str(p)})
        # broken symlinks in the config dir itself
        for p in sorted(cfg.iterdir()):
            if p.is_symlink() and not p.exists():
                add("warn", "links",
                    f"{str(p).replace(home, '~', 1)} — broken symlink "
                    f"(points at {p.readlink()})",
                    {"action": "rm-broken-link", "path": str(p)})

    tr = trash_entries()
    if tr:
        add("info", "trash",
            f"{len(tr)} deleted item(s) in archive/trash — restorable until purged",
            {"action": "purge-trash", "path": ""})

    # link rows needing attention
    for row in link_state():
        if row["status"] in ("elsewhere", "missing", "real", "adopt"):
            add("info", "links",
                f"{row['target']}: {row['status']} — see the links panel")

    # group bridge collisions: a real dir shadowing a would-be managed link
    for g, d in skill_groups_map().items():
        if not d.is_dir():
            continue
        for x in d.iterdir():
            if x.is_dir() and not x.name.startswith("."):
                link = SKILLS / f"{g}-{x.name}"
                if link.exists() and not link.is_symlink():
                    add("warn", "skills",
                        f"skills/{g}-{x.name} exists as a real dir and shadows "
                        f"the {g}/{x.name} bridge link")

    # settings.json: hooks / statusLine pointing at missing executables
    sdata = settings_state()["data"]
    hooks = sdata.get("hooks")
    if isinstance(hooks, dict):
        for event, matchers in hooks.items():
            for m in matchers if isinstance(matchers, list) else []:
                for h in (m.get("hooks") or []) if isinstance(m, dict) else []:
                    cmd = h.get("command") if isinstance(h, dict) else None
                    if cmd and _cmd_missing(cmd):
                        add("warn", "settings",
                            f"hooks.{event}: command not found: {_first_cmd_word(cmd)}")
    sl = sdata.get("statusLine")
    if isinstance(sl, dict) and sl.get("command") and _cmd_missing(sl["command"]):
        add("warn", "settings",
            f"statusLine.command not found: {_first_cmd_word(sl['command'])}")

    # settings keys outside the documented schema
    known = {s["key"].split(".")[0] for s in SETTINGS_SCHEMA}
    for k in sdata if isinstance(sdata, dict) else {}:
        if k not in known:
            add("info", "settings", f"settings.json key not in the documented "
                                    f"schema: {k}")

    # MCP: stdio commands that don't resolve on this machine
    for s in mcp_state()["servers"]:
        cmd = (s["config"] or {}).get("command")
        if cmd and _cmd_missing(cmd):
            add("warn", "mcp", f"{s['name']}: command not found: {cmd}")

    # statusline drift: script on disk differs from what the saved config
    # would generate (hand edits get overwritten on the next UI save)
    _, cfgp, scriptp = statusline_paths()
    if cfgp.is_file() and scriptp.is_file():
        saved, err = _read_json_object(cfgp)
        if not err and saved:
            expected = STATUSLINE_SCRIPT.replace(
                "__CONFIG__", json.dumps(json.dumps(saved)))
            if scriptp.read_text(errors="replace") != expected:
                add("warn", "statusline",
                    f"{scriptp.relative_to(REPO)} differs from the saved "
                    "statusline config — hand edits are lost on the next UI save")

    # item quality
    for t, spec in TYPES.items():
        items = (scan_skills(SKILLS, "active") if spec["kind"] == "dir"
                 else scan_md(t, "active"))
        for it in items:
            if it.get("broken"):
                add("warn", t, f"{it['name']}: broken symlink")
            if it.get("incomplete"):
                add("warn", t, f"{it['name']}: missing SKILL.md")
            if it.get("todo"):
                add("info", t, f"{it['name']}: leftover TODO placeholder")
            if it.get("name_mismatch"):
                add("info", t, f"{it['name']}: frontmatter name doesn't match "
                               "the folder name")
            if it.get("long_desc"):
                add("info", t, f"{it['name']}: description over 1024 chars")
            if (t == "skills" and it.get("description")
                    and "use when" not in it["description"].lower()
                    and not it.get("todo")):
                add("info", t, f"{it['name']}: description has no \"Use when …\" "
                               "trigger — Claude may not know when to load it")

    # plugin skills sharing a name with repo skills (one shadows the other)
    plugins_dir = Path.home() / ".claude" / "plugins"
    if plugins_dir.is_dir():
        ours = {i["name"] for i in scan_skills(SKILLS, "active")}
        try:
            for smd in list(plugins_dir.glob("*/*/skills/*/SKILL.md"))[:500] + \
                       list(plugins_dir.glob("*/*/*/skills/*/SKILL.md"))[:500]:
                pname = smd.parent.name
                if pname in ours:
                    add("info", "plugins",
                        f"installed plugin skill '{pname}' shares a name with "
                        f"your skill ({smd.parent}) — one may shadow the other")
        except OSError:
            pass

    # archive entries that collide with active names (restore would fail)
    for t, spec in TYPES.items():
        archived = (scan_skills(SK_ARCHIVE, "archived") if spec["kind"] == "dir"
                    else scan_md(t, "archived"))
        active = {i["name"] for i in
                  (scan_skills(SKILLS, "active") if spec["kind"] == "dir"
                   else scan_md(t, "active"))}
        for it in archived:
            if it["name"] in active:
                add("info", t, f"{it['name']}: exists in both active and "
                               "archive — restore would fail")

    order = {"warn": 0, "info": 1}
    finds.sort(key=lambda f: (order[f["level"]], f["area"]))
    return {"findings": finds,
            "warns": sum(1 for f in finds if f["level"] == "warn"),
            "ts": time.strftime("%H:%M:%S")}

def doctor_fix(action, path):
    if action == "purge-trash":
        shutil.rmtree(TRASH, ignore_errors=True)
        return
    p = Path(path)
    cfg = config_dir().resolve()
    try:
        inside = p.resolve(strict=False).is_relative_to(cfg)
    except OSError:
        inside = False
    parent_ok = p.parent.resolve() == cfg if p.parent.exists() else False
    if not (inside or parent_ok):
        raise ValueError("path is outside the config dir")
    if action == "delete-bak":
        if ".bak" not in p.name:
            raise ValueError("not a .bak path")
        if p.is_symlink() or p.is_file():
            p.unlink()
        elif p.is_dir():
            shutil.rmtree(p)
        else:
            raise ValueError(f"{p}: not found")
    elif action == "rm-broken-link":
        if not (p.is_symlink() and not p.exists()):
            raise ValueError(f"{p}: not a broken symlink")
        p.unlink()
    else:
        raise ValueError("unknown fix action")
