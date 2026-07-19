"""Upload staging/normalization shared by folder upload and URL import."""

from pathlib import Path
import base64

from .core import COLLECTION_MARKERS, CONFIG_FILES


def stage_upload(files):
    staged = []
    total = 0
    for f in files or []:
        rel = f.get("path", "")
        parts = [p for p in rel.split("/") if p]
        if not parts or rel.startswith("/") or ".." in parts:
            raise ValueError(f"bad file path in upload: {rel}")
        data = base64.b64decode(f.get("content_b64", ""))
        total += len(data)
        if total > 20 * 1024 * 1024:
            raise ValueError("upload too large (>20 MB)")
        staged.append((Path(*parts), data))
    if not staged:
        raise ValueError("no files in upload")
    return staged

def write_staged(staged, base):
    written = []
    try:
        for rel, data in staged:
            dest = base / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            written.append(dest)
    except OSError:
        for w in written:
            w.unlink(missing_ok=True)
        raise

def normalize_skill_upload(staged):
    """Strip redundant wrapper dirs when nothing valid exists at this level."""
    for _ in range(8):
        paths = {p for p, _ in staged}
        if any(p.parts == ("SKILL.md",) for p in paths):
            break
        if any(len(p.parts) == 2 and p.parts[1] == "SKILL.md" for p in paths):
            break
        tops = {p.parts[0] for p in paths}
        if len(tops) != 1 or any(len(p.parts) == 1 for p in paths):
            break
        staged = [(Path(*p.parts[1:]), d) for p, d in staged]
    return staged

def classify_skill_upload(staged):
    paths = {p for p, _ in staged}
    if any(p.parts == ("SKILL.md",) for p in paths):
        return "skill", 1
    skill_dirs = {p.parts[0] for p in paths
                  if len(p.parts) == 2 and p.parts[1] == "SKILL.md"}
    if not skill_dirs:
        raise ValueError(
            "no SKILL.md found in upload — a single skill needs SKILL.md at "
            "its root; a group import needs one in each skill subfolder")
    return "group", len(skill_dirs)

def is_collection_upload(staged):
    return any(p.parts[0] in COLLECTION_MARKERS if len(p.parts) > 1
               else p.parts[0] in CONFIG_FILES
               for p, _ in staged)

def normalize_collection_upload(staged):
    for _ in range(8):
        if is_collection_upload(staged):
            return staged
        tops = {p.parts[0] for p, _ in staged}
        if len(tops) != 1 or any(len(p.parts) == 1 for p, _ in staged):
            break
        staged = [(Path(*p.parts[1:]), d) for p, d in staged]
    return staged if is_collection_upload(staged) else None
