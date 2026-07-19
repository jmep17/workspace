"""Git integration: status/diff/commit, per-file history, live-reload fingerprint."""

from pathlib import Path
import os
import re
import subprocess
import zlib

from .core import ARCHIVE, REPO, TYPES, collections, config_dir


def _git_repo(*args, timeout=15):
    try:
        r = subprocess.run(["git", "-C", str(REPO), *args],
                           capture_output=True, text=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired) as e:
        return None, str(e)
    if r.returncode != 0:
        return None, (r.stderr.strip() or r.stdout.strip()
                      or f"git exited {r.returncode}")
    return r.stdout, None

def git_state():
    out, err = _git_repo("status", "--porcelain")
    if err:
        return {"error": err, "files": [], "branch": ""}
    files = []
    for line in out.splitlines():
        if len(line) < 4:
            continue
        path = line[3:]
        if " -> " in path:
            path = path.rsplit(" -> ", 1)[1]
        files.append({"xy": line[:2], "path": path.strip('"')})
    branch, _ = _git_repo("rev-parse", "--abbrev-ref", "HEAD")
    return {"error": None, "files": files, "branch": (branch or "").strip()}

def git_diff(path):
    st = git_state()
    row = next((f for f in st["files"] if f["path"] == path), None)
    if row is None:
        raise ValueError(f"{path}: not a changed file")
    if row["xy"] == "??":
        p = REPO / path
        if p.is_dir():
            names = sorted(str(x.relative_to(REPO)) for x in p.rglob("*") if x.is_file())
            return "untracked directory:\n" + "\n".join("+ " + n for n in names)
        text = p.read_text(errors="replace") if p.is_file() else ""
        return "".join("+" + l + "\n" for l in text.splitlines()) or "(empty file)"
    out, err = _git_repo("diff", "HEAD", "--", path)
    if err:
        raise ValueError(err)
    return out or "(no textual diff)"

def _repo_rel(rel):
    """Validate a repo-relative path (for git history endpoints)."""
    parts = Path(rel or "").parts
    if not parts or any(p in ("..", "") or p.startswith("/") for p in parts):
        raise ValueError("bad path")
    p = REPO / rel
    try:
        if not p.resolve(strict=False).is_relative_to(REPO.resolve()):
            raise ValueError("bad path")
    except OSError:
        raise ValueError("bad path") from None
    return str(Path(rel))

def file_history(rel):
    rel = _repo_rel(rel)
    out, err = _git_repo("log", "--follow", "--format=%H%x09%ad%x09%s",
                         "--date=short", "-n", "40", "--", rel)
    if err:
        raise ValueError(err)
    commits = []
    for line in (out or "").splitlines():
        parts = line.split("\t", 2)
        if len(parts) == 3:
            commits.append({"rev": parts[0], "date": parts[1], "subject": parts[2]})
    return commits

def file_at_rev(rev, rel):
    if not re.fullmatch(r"[0-9a-f]{7,40}", rev or ""):
        raise ValueError("bad revision")
    rel = _repo_rel(rel)
    out, err = _git_repo("show", f"{rev}:{rel.replace(os.sep, '/')}")
    if err:
        raise ValueError(err)
    return out

def fingerprint():
    """Cheap hash over managed-tree mtimes so the UI can live-reload."""
    crc = 0
    n = 0
    roots = ([spec["root"] for spec in TYPES.values()]
             + [REPO / c for c in collections()]
             + [REPO / "claude", ARCHIVE, REPO / ".git" / "HEAD",
                config_dir() / "settings.json"])
    for root in roots:
        for p in ([root] if not root.is_dir()
                  else sorted(root.rglob("*"))[:4000]):
            n += 1
            if n > 20000:
                break
            try:
                st = p.stat() if not p.is_symlink() else p.lstat()
            except OSError:
                continue
            crc = zlib.crc32(f"{p}:{st.st_mtime_ns}:{st.st_size};".encode(), crc)
    return format(crc, "08x")

def git_commit(message):
    if not isinstance(message, str) or not message.strip():
        raise ValueError("commit message required")
    st = git_state()
    if st["error"]:
        raise ValueError(st["error"])
    if not st["files"]:
        raise ValueError("nothing to commit")
    _, err = _git_repo("add", "-A")
    if err:
        raise ValueError(err)
    out, err = _git_repo("commit", "-m", message.strip())
    if err:
        raise ValueError(err)
    return (out or "").strip().splitlines()[0] if out else "committed"
