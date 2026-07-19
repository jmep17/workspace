"""The links panel: symlinking repo content into the Claude config dir."""

from pathlib import Path

from .core import MAPPINGS, REPO, collections, config_dir, get_source, mapping_repo


def link_state():
    cfg = config_dir()
    home = str(Path.home())
    rows = []
    for mid, m in MAPPINGS.items():
        repo_side = mapping_repo(mid)
        target = cfg / m["cfg"]
        row = {"id": mid, "kind": m["kind"],
               "repo": str(repo_side.relative_to(REPO)),
               "target": str(target).replace(home, "~", 1),
               "repo_exists": repo_side.exists()}
        if m["kind"] == "file":
            row["source"] = get_source(mid)
            row["candidates"] = [
                {"source": s, "exists": ((REPO / "claude" if s == "claude" else REPO / s)
                                         / m["cfg"]).is_file()}
                for s in ["claude"] + collections()
            ]
        if target.is_symlink():
            try:
                ok = target.resolve() == repo_side.resolve()
            except OSError:
                ok = False
            row["status"] = "linked" if ok else "elsewhere"
            if not ok:
                row["points_to"] = str(target.readlink()).replace(home, "~", 1)
        elif target.exists():
            row["status"] = "real" if repo_side.exists() else "adopt"
        else:
            row["status"] = "missing" if repo_side.exists() else "absent"
        rows.append(row)
    return rows

def do_link(mid):
    m = MAPPINGS.get(mid)
    if not m:
        raise ValueError("unknown link id")
    repo_side = mapping_repo(mid)
    target = config_dir() / m["cfg"]
    target.parent.mkdir(parents=True, exist_ok=True)
    backup = adopted = None
    if target.is_symlink():
        target.unlink()
    elif target.exists():
        if repo_side.exists():
            n = 0
            while True:
                backup = target.with_name(target.name + ".bak" + (str(n) if n else ""))
                if not (backup.exists() or backup.is_symlink()):
                    break
                n += 1
            target.rename(backup)
        else:
            repo_side.parent.mkdir(parents=True, exist_ok=True)
            target.rename(repo_side)
            adopted = True
    if not repo_side.exists():
        if m["kind"] == "file":
            raise ValueError(f"{repo_side.relative_to(REPO)} doesn't exist in the "
                             "repo or the config dir yet — nothing to link")
        repo_side.mkdir(parents=True, exist_ok=True)
    target.symlink_to(repo_side)
    return {"backup": str(backup) if backup else None, "adopted": bool(adopted)}

def do_unlink(mid):
    m = MAPPINGS.get(mid)
    if not m:
        raise ValueError("unknown link id")
    target = config_dir() / m["cfg"]
    if not target.is_symlink():
        raise ValueError(f"{m['cfg']}: not a symlink")
    target.unlink()
