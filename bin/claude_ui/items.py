"""Skills and markdown items: scanning, groups, moves, trash, in-place editing."""

from pathlib import Path
import json
import os
import re
import secrets
import shutil
import time

from .core import ARCHIVE, NAME_RE, REPO, SKILLS, TYPES, collections, parse_frontmatter


SK_ARCHIVE = ARCHIVE / "skills"

def is_group(entry):
    """A group is a real (non-symlink) dir without its own SKILL.md."""
    return (entry.is_dir() and not entry.is_symlink()
            and not entry.name.startswith(".")
            and not (entry / "SKILL.md").is_file())

def skill_groups_map():
    """Every skill grouping: nested groups and collections' skills dirs."""
    m = {}
    if SKILLS.is_dir():
        for e in SKILLS.iterdir():
            if is_group(e):
                m[e.name] = e
    for c in collections():
        d = REPO / c / "skills"
        if d.is_dir():
            m[c] = d
    return m

def group_content_dir(g):
    return skill_groups_map().get(g, SKILLS / g)

def split_managed(name):
    """'<g>-<x>' -> (g, x) if g is a known grouping (longest match), else None."""
    names = set(skill_groups_map())
    if SK_ARCHIVE.is_dir():
        names.update(e.name for e in SK_ARCHIVE.iterdir() if is_group(e))
    for g in sorted(names, key=len, reverse=True):
        if name.startswith(g + "-") and len(name) > len(g) + 1:
            return g, name[len(g) + 1:]
    return None

def reconcile_links():
    """Keep top-level <group>-<name> skill symlinks in sync with group and
    collection contents, and <type>/<collection> dir symlinks for md types."""
    if SKILLS.is_dir():
        for g, d in skill_groups_map().items():
            for x in sorted(d.iterdir()):
                if x.is_dir() and not x.name.startswith("."):
                    link = SKILLS / f"{g}-{x.name}"
                    if not (link.exists() or link.is_symlink()):
                        link.symlink_to(Path(os.path.relpath(x, SKILLS)))
        for entry in SKILLS.iterdir():
            if not entry.is_symlink():
                continue
            raw = entry.readlink()
            target = raw if raw.is_absolute() else SKILLS / raw
            try:
                inside = target.resolve().is_relative_to(REPO.resolve())
            except OSError:
                inside = False
            if inside and not target.exists():
                entry.unlink()
    for t in (n for n, s in TYPES.items() if s["kind"] == "md"):
        root = TYPES[t]["root"]
        for c in collections():
            d = REPO / c / t
            if d.is_dir():
                root.mkdir(exist_ok=True)
                link = root / c
                if not (link.exists() or link.is_symlink()):
                    link.symlink_to(Path("..") / c / t)
        if root.is_dir():
            for e in root.iterdir():
                if not e.is_symlink():
                    continue
                raw = e.readlink()
                tgt = raw if raw.is_absolute() else root / raw
                try:
                    inside = tgt.resolve().is_relative_to(REPO.resolve())
                except OSError:
                    inside = False
                if inside and not tgt.exists():
                    e.unlink()

def skill_item(entry, scope, name=None, group=None):
    skill_md = entry / "SKILL.md"
    text = skill_md.read_text(errors="replace") if skill_md.is_file() else ""
    meta = parse_frontmatter(text)
    n = name or entry.name
    try:
        mtime = entry.stat().st_mtime
    except OSError:
        mtime = 0
    return {
        "name": n, "scope": scope, "symlink": entry.is_symlink(),
        "group": group, "managed": group is not None,
        "local": n.startswith("work-") or group == "work",
        "broken": False, "incomplete": not skill_md.is_file(),
        "description": meta.get("description", ""),
        "path": str(entry), "mtime": mtime,
        "todo": "TODO" in text,
        "name_mismatch": bool(meta.get("name")) and meta["name"] != n,
        "long_desc": len(meta.get("description", "")) > 1024,
        "movable": scope == "active" and (group is not None or not entry.is_symlink()),
    }

def scan_skills(root, scope):
    items = []
    if not root.is_dir():
        return items
    gmap = {}
    if root == SKILLS:
        for g, d in skill_groups_map().items():
            try:
                gmap[d.resolve()] = g
            except OSError:
                pass
    for entry in sorted(root.iterdir()):
        if entry.name.startswith("."):
            continue
        if is_group(entry):
            if root != SKILLS:  # archived group members have no links
                for d in sorted(entry.iterdir()):
                    if d.is_dir() and not d.name.startswith("."):
                        items.append(skill_item(d, scope, name=f"{entry.name}-{d.name}",
                                                group=entry.name))
            continue
        if not entry.is_dir():
            if entry.is_symlink():
                items.append({
                    "name": entry.name, "scope": scope, "broken": True,
                    "symlink": True, "group": None, "managed": False,
                    "local": entry.name.startswith("work-"), "movable": False,
                    "incomplete": False,
                    "description": "(broken symlink: " + str(entry.readlink()) + ")",
                })
            continue
        group = None
        if entry.is_symlink():
            try:
                group = gmap.get(entry.resolve().parent)
            except OSError:
                pass
        items.append(skill_item(entry, scope, group=group))
    return items

def skills_group_info():
    out = []
    for g, d in sorted(skill_groups_map().items()):
        if not d.is_dir():
            continue
        members = [x for x in d.iterdir() if x.is_dir() and not x.name.startswith(".")]
        out.append({
            "name": g,
            "members": len(members),
            "incomplete": sum(1 for x in members if not (x / "SKILL.md").is_file()),
            "loose_files": sum(1 for f in d.iterdir()
                               if f.is_file() and not f.name.startswith(".")),
            "removable": d.parent == SKILLS,
            "collection": d.parent != SKILLS,
        })
    return out

def resolve_skill(scope, name):
    if not NAME_RE.match(name or ""):
        raise ValueError("bad name")
    root = SKILLS if scope == "active" else SK_ARCHIVE
    path = root / name
    if path.parent != root:
        raise ValueError("bad path")
    return path

def skill_creation_path(name):
    sm = split_managed(name)
    return group_content_dir(sm[0]) / sm[1] if sm else SKILLS / name

def movable_skill(name):
    """(content_dir, managed_link_or_None) for a skill that can move/rename."""
    entry = resolve_skill("active", name)
    sm = split_managed(name)
    if sm and entry.is_symlink() and (group_content_dir(sm[0]) / sm[1]).is_dir():
        return group_content_dir(sm[0]) / sm[1], entry
    if entry.is_dir() and not entry.is_symlink():
        return entry, None
    raise ValueError(f"{name}: only real skill dirs and group members can do this")

def update_skill_name(d, new):
    """Keep the frontmatter name: in sync after a rename/duplicate."""
    md = d / "SKILL.md"
    if not md.is_file():
        return
    text = md.read_text(errors="replace")
    m = re.match(r"^(---\n)(.*?\n)(---\n?)", text, re.S)
    if m and re.search(r"(?m)^name:", m.group(2)):
        fm = re.sub(r"(?m)^name:\s*.*$", "name: " + new, m.group(2), count=1)
        md.write_text(m.group(1) + fm + m.group(3) + text[m.end():])

def md_rel(name):
    parts = [p for p in (name or "").split("/") if p]
    if not parts or any(not NAME_RE.match(p) for p in parts):
        raise ValueError("bad name")
    return Path(*parts)

def ensure_md_collection(type_, name):
    """If `name` targets a collection, make sure its type dir + bridge exist."""
    first = (name or "").split("/")[0]
    if first in collections():
        (REPO / first / type_).mkdir(exist_ok=True)
        reconcile_links()

def md_path(type_, scope, name):
    root = TYPES[type_]["root"] if scope == "active" else ARCHIVE / type_
    return root / md_rel(name).with_suffix(".md")

def scan_md(type_, scope):
    root = TYPES[type_]["root"] if scope == "active" else ARCHIVE / type_
    items = []

    def walk(base, prefix, collection):
        if not base.is_dir():
            return
        for p in sorted(base.rglob("*.md")):
            rel = p.relative_to(base)
            if any(part.startswith(".") for part in rel.parts):
                continue
            full = str(Path(prefix) / rel)[:-3] if prefix else str(rel)[:-3]
            broken = p.is_symlink() and not p.exists()
            text = "" if broken else p.read_text(errors="replace")
            meta = parse_frontmatter(text)
            parent = str(Path(full).parent)
            group = parent if parent != "." else None
            try:
                mtime = 0 if broken else p.stat().st_mtime
            except OSError:
                mtime = 0
            items.append({
                "name": full, "scope": scope, "symlink": p.is_symlink() and not collection,
                "group": group, "managed": bool(collection),
                "local": (group or "").split("/")[0] == "work",
                "broken": broken, "incomplete": False,
                "description": ("(broken symlink: " + str(p.readlink()) + ")") if broken
                               else meta.get("description", ""),
                "path": str(p), "mtime": mtime,
                "todo": "TODO" in text,
                "long_desc": len(meta.get("description", "")) > 1024,
                "movable": scope == "active" and not broken,
            })

    walk(root, "", False)
    if scope == "active":
        for c in collections():
            walk(REPO / c / type_, c, True)
    return items

def md_group_info(type_):
    root = TYPES[type_]["root"]
    out = []

    def count(d, name, removable, collection):
        mds = [f for f in d.iterdir() if f.name.endswith(".md")]
        out.append({
            "name": name, "members": len(mds), "incomplete": 0,
            "loose_files": sum(1 for f in d.iterdir()
                               if f.is_file() and not f.name.endswith(".md")
                               and not f.name.startswith(".")),
            "removable": removable, "collection": collection,
        })

    if root.is_dir():
        for d in sorted(root.rglob("*")):
            if not d.is_dir() or d.is_symlink():
                continue
            rel = d.relative_to(root)
            if any(part.startswith(".") for part in rel.parts):
                continue
            count(d, str(rel), True, False)
    for c in collections():
        d = REPO / c / type_
        if d.is_dir():
            count(d, c, False, True)
    return out

def md_groups(type_):
    return [g["name"] for g in md_group_info(type_)]

TRASH = ARCHIVE / "trash"

def trash_put(src, type_, scope, name):
    """Move a path into archive/trash/<token>/ so deletes are undoable."""
    TRASH.mkdir(parents=True, exist_ok=True)
    token = time.strftime("%Y%m%d-%H%M%S") + "-" + secrets.token_hex(3)
    tdir = TRASH / token
    tdir.mkdir()
    entry = src.name
    orig = str(src)
    src.rename(tdir / entry)
    (tdir / "meta.json").write_text(json.dumps(
        {"type": type_, "scope": scope, "name": name,
         "orig": orig, "entry": entry}))
    return token

def undelete(token):
    if not re.fullmatch(r"[0-9]{8}-[0-9]{6}-[0-9a-f]{6}", token or ""):
        raise ValueError("bad trash token")
    tdir = TRASH / token
    try:
        meta = json.loads((tdir / "meta.json").read_text())
    except (OSError, json.JSONDecodeError):
        raise ValueError("trash entry not found") from None
    orig = Path(meta.get("orig") or "")
    try:
        ok = orig.resolve(strict=False).is_relative_to(REPO.resolve())
    except OSError:
        ok = False
    if not ok:
        raise ValueError("refusing to restore outside the repo")
    if orig.exists() or orig.is_symlink():
        raise ValueError(f"{orig.name}: exists again — restore by hand from {tdir}")
    orig.parent.mkdir(parents=True, exist_ok=True)
    (tdir / meta["entry"]).rename(orig)
    shutil.rmtree(tdir, ignore_errors=True)
    reconcile_links()
    return meta

def trash_entries():
    if not TRASH.is_dir():
        return []
    return sorted(e.name for e in TRASH.iterdir() if e.is_dir())

MAX_EDIT = 2 * 1024 * 1024

def _rel_repo(p):
    try:
        return str(p.resolve().relative_to(REPO.resolve()))
    except (OSError, ValueError):
        return str(p)

def item_rel(fname):
    parts = [p for p in (fname or "").split("/") if p]
    if not parts or any(p.startswith(".") or p == ".." for p in parts):
        raise ValueError("bad file name")
    return Path(*parts)

def item_root(type_, scope, name):
    """Filesystem location of an item: a file for md kinds, a dir for skills."""
    if TYPES[type_]["kind"] == "md":
        return md_path(type_, scope, name)
    if scope == "active":
        return resolve_skill("active", name)
    sm = split_managed(name)
    if sm and (SK_ARCHIVE / sm[0] / sm[1]).is_dir():
        return SK_ARCHIVE / sm[0] / sm[1]
    return resolve_skill("archived", name)

def item_read(type_, scope, name, fname=None):
    root = item_root(type_, scope, name)
    if TYPES[type_]["kind"] == "md":
        if not root.is_file():
            raise ValueError(f"{name}: not found")
        return {"type": type_, "scope": scope, "name": name,
                "files": [root.name], "file": root.name, "exists": True,
                "content": root.read_text(errors="replace"),
                "path": _rel_repo(root)}
    if not root.is_dir():  # follows the managed symlink
        raise ValueError(f"{name}: not found")
    files = sorted(
        str(p.relative_to(root)) for p in root.rglob("*")
        if p.is_file() and p.stat().st_size <= MAX_EDIT
        and not any(part.startswith(".") for part in p.relative_to(root).parts)
    )[:200]
    f = fname or ("SKILL.md" if "SKILL.md" in files or not files else files[0])
    target = root / item_rel(f)
    return {"type": type_, "scope": scope, "name": name,
            "files": files, "file": f, "exists": target.is_file(),
            "content": target.read_text(errors="replace") if target.is_file() else "",
            "path": _rel_repo(target)}

def item_save(type_, scope, name, fname, content):
    if not isinstance(content, str) or len(content) > MAX_EDIT:
        raise ValueError("bad content")
    root = item_root(type_, scope, name)
    if TYPES[type_]["kind"] == "md":
        if not root.is_file():
            raise ValueError(f"{name}: not found")
        root.write_text(content)
        return {"path": _rel_repo(root)}
    if not root.is_dir():
        raise ValueError(f"{name}: not found")
    target = root / item_rel(fname or "SKILL.md")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)
    return {"path": _rel_repo(target)}

SKILL_TEMPLATE = """---
name: {name}
description: TODO — one sentence on what this does, then "Use when ..." triggers.
---

# {name}

TODO: instructions.
"""

COMMAND_TEMPLATE = """---
description: TODO — what this command does.
---

TODO: prompt. Use $ARGUMENTS for arguments passed after the command.
"""

AGENT_TEMPLATE = """---
name: {name}
description: TODO — when to use this agent.
---

TODO: system prompt for the agent.
"""

OUTPUT_STYLE_TEMPLATE = """---
name: {name}
description: TODO — what this output style changes.
---

TODO: instructions that replace the default output style.
"""

TEMPLATES = {"commands": COMMAND_TEMPLATE, "agents": AGENT_TEMPLATE,
             "output-styles": OUTPUT_STYLE_TEMPLATE}

def migrate_legacy_work():
    """Move pre-collection layout (skills/work/, commands/work/, agents/work/)
    into the top-level work/ collection. Idempotent; never clobbers."""
    for t in TYPES:
        legacy = TYPES[t]["root"] / "work"
        if not legacy.is_dir() or legacy.is_symlink():
            continue
        dest = REPO / "work" / t
        dest.mkdir(parents=True, exist_ok=True)
        for item in list(legacy.iterdir()):
            tgt = dest / item.name
            if not (tgt.exists() or tgt.is_symlink()):
                item.rename(tgt)
        try:
            legacy.rmdir()
            print(f"claude-ui: migrated {t}/work/ -> work/{t}/")
        except OSError:
            print(f"claude-ui: {t}/work/ partially migrated — "
                  f"name clashes left behind in {legacy}")
    reconcile_links()
