"""HTTP handler, static file serving, and the CLI entry point."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import errno
import json
import os
import shutil
import sys
import urllib.error
import urllib.parse
import urllib.request
import webbrowser

from .core import CONFIG_FILES, NAME_RE, NON_COLLECTIONS, REPO, SKILLS, TOKEN, TYPES, collections, config_dir, read_cfg, set_config_dir, set_source
from .items import SKILL_TEMPLATE, SK_ARCHIVE, TEMPLATES, ensure_md_collection, group_content_dir, is_group, item_read, item_save, md_group_info, md_groups, md_path, md_rel, migrate_legacy_work, movable_skill, reconcile_links, resolve_skill, scan_md, scan_skills, skill_creation_path, skill_groups_map, skills_group_info, split_managed, trash_put, undelete, update_skill_name
from .links import do_link, do_open, do_reset, do_unlink, link_state
from .uploads import classify_skill_upload, normalize_collection_upload, normalize_skill_upload, stage_upload, write_staged
from .mcp import mcp_machine_set, mcp_repo_config, mcp_state, mcp_test, mcp_write_repo
from .settings import SETTINGS_SCHEMA, file_read, file_save, hook_test, settings_set, settings_state
from .statusline import statusline_save, statusline_state
from .insight import cost_stats, insight_budget, usage_stats
from .gitops import file_at_rev, file_history, fingerprint, git_commit, git_diff, git_state
from .assist import assist
from .transfer import export_zip, import_from_url, link_all, write_bootstrap
from .doctor import doctor, doctor_fix


STATIC = Path(__file__).resolve().parent / "static"
STATIC_FILES = {"/style.css": ("style.css", "text/css; charset=utf-8"),
                "/app.js": ("app.js", "text/javascript; charset=utf-8")}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def send(self, code, body, ctype="application/json", extra=None):
        if isinstance(body, bytes):
            data = body
        else:
            data = body.encode() if isinstance(body, str) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header("content-type", ctype)
        self.send_header("content-length", str(len(data)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        n = int(self.headers.get("content-length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def host_ok(self):
        """Reject non-loopback Host headers (DNS-rebinding protection)."""
        host = (self.headers.get("host") or "").rsplit(":", 1)[0].strip("[]")
        if host in ("127.0.0.1", "localhost", "::1"):
            return True
        self.send(403, {"error": "bad host"})
        return False

    def do_GET(self):
        if not self.host_ok():
            return
        if self.path == "/":
            page = (STATIC / "index.html").read_text()
            self.send(200, page.replace("__SCHEMA__", json.dumps(SETTINGS_SCHEMA))
                              .replace("__TOKEN__", TOKEN),
                      "text/html; charset=utf-8", {"cache-control": "no-cache"})
        elif self.path in STATIC_FILES:
            fname, ctype = STATIC_FILES[self.path]
            self.send(200, (STATIC / fname).read_text(), ctype,
                      {"cache-control": "no-cache"})
        elif self.path in ("/favicon.ico", "/icon.svg"):
            self.send(200, "<svg xmlns='http://www.w3.org/2000/svg' "
                           "viewBox='0 0 16 16'><text y='13' font-size='13'>"
                           "⚙️</text></svg>", "image/svg+xml")
        elif self.path == "/manifest.webmanifest":
            self.send(200, {"name": "claude config", "short_name": "claude-ui",
                            "start_url": "/", "display": "standalone",
                            "background_color": "#282828", "theme_color": "#282828",
                            "icons": [{"src": "/icon.svg", "sizes": "any",
                                       "type": "image/svg+xml"}]},
                      "application/manifest+json")
        elif self.path == "/api/fingerprint":
            self.send(200, {"fp": fingerprint()})
        elif self.path.startswith("/api/export?"):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            get = lambda k: (q.get(k) or [""])[0]
            try:
                data, fname = export_zip(get("type") or None,
                                         get("scope") or "active",
                                         get("name") or None,
                                         get("collection") or None)
                self.send(200, data, "application/zip",
                          {"content-disposition": f'attachment; filename="{fname}"'})
            except (ValueError, OSError) as e:
                self.send(400, {"error": str(e)})
        elif self.path == "/api/state":
            reconcile_links()
            types = {}
            for t, spec in TYPES.items():
                if spec["kind"] == "dir":
                    types[t] = {
                        "active": scan_skills(SKILLS, "active"),
                        "archived": scan_skills(SK_ARCHIVE, "archived"),
                        "groups": sorted(skill_groups_map()),
                        "group_info": skills_group_info(),
                    }
                else:
                    types[t] = {
                        "active": scan_md(t, "active"),
                        "archived": scan_md(t, "archived"),
                        "groups": md_groups(t),
                        "group_info": md_group_info(t),
                    }
            home = str(Path.home())
            self.send(200, {
                "types": types,
                "links": link_state(),
                "settings": settings_state(),
                "mcp": mcp_state(),
                "statusline": statusline_state(),
                "git": git_state(),
                "collections": collections(),
                "config_dir": str(config_dir()).replace(home, "~", 1),
                "default_dir": "config_dir" not in read_cfg()
                               and not os.environ.get("CLAUDE_CONFIG_DIR"),
            })
        elif self.path.startswith("/api/file?"):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            try:
                self.send(200, file_read((q.get("id") or [""])[0]))
            except ValueError as e:
                self.send(400, {"error": str(e)})
        elif self.path.startswith("/api/item?"):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            get = lambda k, d="": (q.get(k) or [d])[0]
            try:
                type_ = get("type")
                if type_ not in TYPES:
                    raise ValueError("unknown type")
                scope = get("scope", "active")
                if scope not in ("active", "archived"):
                    raise ValueError("bad scope")
                self.send(200, item_read(type_, scope, get("name"), get("file") or None))
            except (ValueError, OSError) as e:
                self.send(400, {"error": str(e)})
        elif self.path.startswith("/api/insight"):
            rescan = "rescan" in self.path
            self.send(200, {"budget": insight_budget(),
                            "usage": usage_stats(rescan=rescan),
                            "allow": (settings_state()["data"]
                                      .get("permissions", {}) or {}).get("allow", [])})
        elif self.path.startswith("/api/costs"):
            self.send(200, cost_stats(rescan="rescan" in self.path))
        elif self.path == "/api/doctor":
            self.send(200, doctor())
        else:
            self.send(404, {"error": "not found"})

    def handle_skills(self, action, req):
        name = req.get("name", "")
        if action == "archive":
            src = resolve_skill("active", name)
            sm = split_managed(name)
            if sm and src.is_symlink() and (group_content_dir(sm[0]) / sm[1]).is_dir():
                g, x = sm
                adir = SK_ARCHIVE / g
                if (adir / x).exists():
                    raise ValueError(f"{name}: already exists in archive/skills/{g}/")
                adir.mkdir(parents=True, exist_ok=True)
                (group_content_dir(g) / x).rename(adir / x)
                src.unlink()
            else:
                if not (src.is_dir() or src.is_symlink()):
                    raise ValueError(f"{name}: not found")
                SK_ARCHIVE.mkdir(parents=True, exist_ok=True)
                dst = SK_ARCHIVE / name
                if dst.exists() or dst.is_symlink():
                    raise ValueError(f"{name}: already exists in archive/skills/")
                src.rename(dst)
        elif action == "restore":
            sm = split_managed(name)
            if sm and (SK_ARCHIVE / sm[0] / sm[1]).is_dir():
                g, x = sm
                gdir = group_content_dir(g)
                if (gdir / x).exists():
                    raise ValueError(f"{name}: already exists in {g}/")
                gdir.mkdir(parents=True, exist_ok=True)
                (SK_ARCHIVE / g / x).rename(gdir / x)
                reconcile_links()
            else:
                src = resolve_skill("archived", name)
                if not (src.is_dir() or src.is_symlink()):
                    raise ValueError(f"{name}: not found")
                dst = SKILLS / name
                if dst.exists() or dst.is_symlink():
                    raise ValueError(f"{name}: already exists in skills/")
                src.rename(dst)
        elif action == "delete":
            scope = req.get("scope", "")
            if scope not in ("active", "archived"):
                raise ValueError("bad scope")
            path = resolve_skill(scope, name)
            sm = split_managed(name)
            content = None
            if sm:
                content = (group_content_dir(sm[0]) if scope == "active"
                           else SK_ARCHIVE / sm[0]) / sm[1]
            if scope == "active" and content and path.is_symlink() and content.is_dir():
                path.unlink()
                return {"ok": True, "trash": trash_put(content, "skills", scope, name)}
            elif (scope == "archived" and content and content.is_dir()
                    and not (path.exists() or path.is_symlink())):
                return {"ok": True, "trash": trash_put(content, "skills", scope, name)}
            elif path.is_symlink():
                path.unlink()
            elif path.is_dir():
                return {"ok": True, "trash": trash_put(path, "skills", scope, name)}
            else:
                raise ValueError(f"{name}: not found")
        elif action == "move":
            dest_g = (req.get("group") or "").strip()
            if dest_g and not NAME_RE.match(dest_g):
                raise ValueError("bad group name")
            src, link = movable_skill(name)
            base = src.name
            if dest_g:
                gmap = skill_groups_map()
                if dest_g not in gmap:
                    raise ValueError(f"{dest_g}: no such group or collection "
                                     "(create it with + folder)")
                dst, new_name = gmap[dest_g] / base, f"{dest_g}-{base}"
                taken = SKILLS / new_name
                if taken.exists() or taken.is_symlink():
                    raise ValueError(f"{new_name}: name already taken")
            else:
                dst, new_name = SKILLS / base, base
            if dst == src:
                raise ValueError(f"{name}: already there")
            if dst.exists() or dst.is_symlink():
                raise ValueError(f"{dst.name}: already exists")
            src.rename(dst)
            if link:
                link.unlink()
            reconcile_links()
            return {"ok": True, "name": new_name}
        elif action in ("rename", "duplicate"):
            new = (req.get("new_name") or "").strip()
            if not NAME_RE.match(new):
                raise ValueError("bad name")
            if new == name:
                raise ValueError("same name")
            src, link = movable_skill(name)
            dst = skill_creation_path(new)
            taken = SKILLS / new
            if dst.exists() or dst.is_symlink() or taken.exists() or taken.is_symlink():
                raise ValueError(f"{new}: already exists")
            dst.parent.mkdir(parents=True, exist_ok=True)
            if action == "rename":
                src.rename(dst)
                if link:
                    link.unlink()
            else:
                shutil.copytree(src, dst)
            update_skill_name(dst, new)
            reconcile_links()
            return {"ok": True, "name": new}
        elif action == "group":
            if not NAME_RE.match(name):
                raise ValueError("bad group name")
            gdir = SKILLS / name
            if gdir.exists() or gdir.is_symlink() or name in collections():
                raise ValueError(f"{name}: already exists")
            gdir.mkdir()
        elif action == "group-remove":
            gdir = resolve_skill("active", name)
            if not is_group(gdir):
                raise ValueError(f"{name}: not a removable folder")
            try:
                gdir.rmdir()
            except OSError:
                raise ValueError(f"{name}: not empty") from None
        elif action == "upload":
            link = resolve_skill("active", name)
            path = skill_creation_path(name)
            if link.exists() or link.is_symlink() or path.exists():
                raise ValueError(f"{name}: already exists")
            staged = normalize_skill_upload(stage_upload(req.get("files")))
            kind, nskills = classify_skill_upload(staged)
            write_staged(staged, path)
            reconcile_links()
            return {"ok": True, "files": len(staged), "kind": kind, "skills": nskills,
                    "path": str(path.relative_to(REPO))}
        elif action == "upload-files":
            staged = stage_upload(req.get("files"))
            if any(len(p.parts) != 1 for p, _ in staged):
                raise ValueError("single-file upload expects plain file names")
            entry = resolve_skill("active", name)
            sm = split_managed(name)
            if sm and entry.is_symlink() and (group_content_dir(sm[0]) / sm[1]).is_dir():
                dest, created = group_content_dir(sm[0]) / sm[1], False
            elif entry.is_dir():
                dest, created = entry, False
            else:
                dest, created = skill_creation_path(name), True
                if dest.exists():
                    raise ValueError(f"{name}: already exists")
                if not any(p.name == "SKILL.md" for p, _ in staged):
                    mds = [p for p, _ in staged if p.suffix == ".md"]
                    if len(mds) == 1:
                        staged = [(Path("SKILL.md") if p == mds[0] else p, d)
                                  for p, d in staged]
                    else:
                        raise ValueError(
                            f"{name} doesn't exist — to create it, include a "
                            "SKILL.md (or upload exactly one .md to become it)")
            for rel, _ in staged:
                if (dest / rel).exists():
                    raise ValueError(f"{rel}: already exists in {name}")
            if created:
                dest.mkdir(parents=True)
            write_staged(staged, dest)
            if created:
                reconcile_links()
            return {"ok": True, "files": len(staged), "created": created,
                    "path": name}
        elif action == "new":
            link = resolve_skill("active", name)
            path = skill_creation_path(name)
            if link.exists() or link.is_symlink() or path.exists():
                raise ValueError(f"{name}: already exists")
            path.mkdir(parents=True)
            (path / "SKILL.md").write_text(SKILL_TEMPLATE.format(name=name))
            reconcile_links()
            return {"ok": True, "path": str(path.relative_to(REPO))}
        else:
            raise ValueError("unknown action")
        return {"ok": True}

    def handle_md(self, type_, action, req):
        name = req.get("name", "")
        root = TYPES[type_]["root"]
        if action == "archive":
            src = md_path(type_, "active", name)
            if not src.is_file():
                raise ValueError(f"{name}: not found")
            dst = md_path(type_, "archived", name)
            if dst.exists():
                raise ValueError(f"{name}: already archived")
            dst.parent.mkdir(parents=True, exist_ok=True)
            src.rename(dst)
        elif action == "restore":
            src = md_path(type_, "archived", name)
            if not src.is_file():
                raise ValueError(f"{name}: not found")
            ensure_md_collection(type_, name)
            dst = md_path(type_, "active", name)
            if dst.exists():
                raise ValueError(f"{name}: already exists")
            dst.parent.mkdir(parents=True, exist_ok=True)
            src.rename(dst)
        elif action == "delete":
            scope = req.get("scope", "")
            if scope not in ("active", "archived"):
                raise ValueError("bad scope")
            path = md_path(type_, scope, name)
            if path.is_symlink():
                path.unlink()
            elif path.is_file():
                return {"ok": True, "trash": trash_put(path, type_, scope, name)}
            else:
                raise ValueError(f"{name}: not found")
        elif action == "move":
            dest_g = (req.get("group") or "").strip()
            src = md_path(type_, "active", name)
            if not src.is_file():
                raise ValueError(f"{name}: not found")
            base = md_rel(name).name
            new_name = f"{dest_g}/{base}" if dest_g else base
            ensure_md_collection(type_, new_name)
            dst = md_path(type_, "active", new_name)
            if dst == src or (dst.exists() and dst.samefile(src)):
                raise ValueError(f"{name}: already there")
            if dst.exists():
                raise ValueError(f"{new_name}: already exists")
            dst.parent.mkdir(parents=True, exist_ok=True)
            src.rename(dst)
            return {"ok": True, "name": new_name}
        elif action in ("rename", "duplicate"):
            new = (req.get("new_name") or "").strip()
            src = md_path(type_, "active", name)
            if not src.is_file():
                raise ValueError(f"{name}: not found")
            new = str(md_rel(new))
            if new == name:
                raise ValueError("same name")
            ensure_md_collection(type_, new)
            dst = md_path(type_, "active", new)
            if dst.exists():
                raise ValueError(f"{new}: already exists")
            dst.parent.mkdir(parents=True, exist_ok=True)
            if action == "rename":
                src.rename(dst)
            else:
                shutil.copy2(src, dst)
            return {"ok": True, "name": new}
        elif action == "group":
            if name in collections():
                ensure_md_collection(type_, name)
            else:
                gdir = root / md_rel(name)
                if gdir.exists():
                    raise ValueError(f"{name}: already exists")
                gdir.mkdir(parents=True)
        elif action == "group-remove":
            gdir = root / md_rel(name)
            if not gdir.is_dir() or gdir.is_symlink():
                raise ValueError(f"{name}: not a removable folder")
            try:
                gdir.rmdir()
            except OSError:
                raise ValueError(f"{name}: not empty") from None
        elif action == "upload":
            ensure_md_collection(type_, name)
            base = root / md_rel(name) if name else root
            staged = stage_upload(req.get("files"))
            if not any(p.suffix == ".md" for p, _ in staged):
                raise ValueError(f"no .md files in upload — {type_} are markdown files")
            for rel, _ in staged:
                if (base / rel).exists():
                    raise ValueError(f"{rel}: already exists")
            base.mkdir(parents=True, exist_ok=True)
            write_staged(staged, base)
            return {"ok": True, "files": len(staged),
                    "path": str(base.relative_to(REPO)) if base != root else type_}
        elif action == "new":
            ensure_md_collection(type_, name)
            path = md_path(type_, "active", name)
            if path.exists():
                raise ValueError(f"{name}: already exists")
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(TEMPLATES[type_].format(name=md_rel(name).name))
            return {"ok": True, "path": str(path.relative_to(REPO))}
        else:
            raise ValueError("unknown action")
        return {"ok": True}

    def handle_collection_upload(self, req):
        name = req.get("name", "")
        if not NAME_RE.match(name) or name in NON_COLLECTIONS:
            raise ValueError("bad collection name")
        dest = REPO / name
        if dest.exists() or dest.is_symlink():
            raise ValueError(f"{name}: already exists at the repo root")
        staged = normalize_collection_upload(stage_upload(req.get("files")))
        if staged is None:
            raise ValueError(
                "this doesn't look like a Claude config folder — expected "
                "skills/, commands/, agents/, or CLAUDE.md/settings.json inside")
        write_staged(staged, dest)
        reconcile_links()
        skills_n = sum(1 for d in (dest / "skills").iterdir()
                       if d.is_dir() and (d / "SKILL.md").is_file()) \
            if (dest / "skills").is_dir() else 0
        cmd_n = len(list((dest / "commands").rglob("*.md"))) \
            if (dest / "commands").is_dir() else 0
        ag_n = len(list((dest / "agents").rglob("*.md"))) \
            if (dest / "agents").is_dir() else 0
        cfg_files = [f for f in CONFIG_FILES if (dest / f).is_file()]
        return {"ok": True, "path": name, "skills": skills_n, "commands": cmd_n,
                "agents": ag_n, "config_files": cfg_files}

    def do_POST(self):
        if not self.host_ok():
            return
        if self.headers.get("x-claude-ui") != TOKEN:
            self.send(403, {"error": "bad or missing token — reload the page"})
            return
        try:
            req = self.body()
            action = self.path.removeprefix("/api/")
            if action == "link":
                self.send(200, {"ok": True, **do_link(req.get("id", ""))})
                return
            if action == "unlink":
                do_unlink(req.get("id", ""))
                self.send(200, {"ok": True})
                return
            if action == "reset-links":
                self.send(200, {"ok": True, **do_reset()})
                return
            if action == "open":
                self.send(200, {"ok": True, **do_open(req.get("id", ""))})
                return
            if action == "config-dir":
                set_config_dir((req.get("path") or "").strip())
                self.send(200, {"ok": True})
                return
            if action == "source":
                set_source(req.get("id", ""), req.get("source", ""))
                self.send(200, {"ok": True})
                return
            if action == "upload-collection":
                self.send(200, self.handle_collection_upload(req))
                return
            if action == "settings-set":
                settings_set(req.get("key", ""), req.get("value"))
                self.send(200, {"ok": True})
                return
            if action == "file-save":
                file_save(req.get("id", ""), req.get("content", ""))
                self.send(200, {"ok": True})
                return
            if action == "item-save":
                type_ = req.get("type", "")
                if type_ not in TYPES:
                    raise ValueError("unknown type")
                scope = req.get("scope", "active")
                if scope not in ("active", "archived"):
                    raise ValueError("bad scope")
                self.send(200, {"ok": True, **item_save(
                    type_, scope, req.get("name", ""),
                    req.get("file"), req.get("content", ""))})
                return
            if action == "git-diff":
                self.send(200, {"ok": True, "diff": git_diff(req.get("path", ""))})
                return
            if action == "git-commit":
                self.send(200, {"ok": True, "result": git_commit(req.get("message", ""))})
                return
            if action == "mcp-test":
                self.send(200, mcp_test(req.get("name", "")))
                return
            if action == "doctor-fix":
                doctor_fix(req.get("action", ""), req.get("path", ""))
                self.send(200, {"ok": True})
                return
            if action == "hook-test":
                self.send(200, hook_test(req.get("command", ""), req.get("event", "")))
                return
            if action == "history":
                self.send(200, {"ok": True, "commits": file_history(req.get("path", ""))})
                return
            if action == "history-show":
                self.send(200, {"ok": True, "content": file_at_rev(
                    req.get("rev", ""), req.get("path", ""))})
                return
            if action == "assist":
                self.send(200, assist(req.get("mode", ""), req.get("custom", ""),
                                      req.get("content", ""), req.get("path", "")))
                return
            if action == "undelete":
                meta = undelete(req.get("token", ""))
                self.send(200, {"ok": True, "name": meta.get("name", "")})
                return
            if action == "import-url":
                self.send(200, {"ok": True, **import_from_url(
                    req.get("url", ""), (req.get("name") or "").strip(),
                    req.get("type", "skills"))})
                return
            if action == "bootstrap":
                self.send(200, {"ok": True, "path": write_bootstrap()})
                return
            if action == "statusline-save":
                statusline_save(req.get("config"), bool(req.get("apply")))
                self.send(200, {"ok": True})
                return
            if action == "mcp-save":
                name = req.get("name", "")
                mcp_write_repo(req.get("source", "claude"), name, req.get("config"))
                orig = req.get("orig_source")
                if orig and orig != req.get("source"):
                    mcp_write_repo(orig, name, None)
                self.send(200, {"ok": True})
                return
            if action == "mcp-delete":
                mcp_write_repo(req.get("source", "claude"), req.get("name", ""), None)
                if req.get("from_machine"):
                    mcp_machine_set(req.get("name", ""), None)
                self.send(200, {"ok": True})
                return
            if action == "mcp-apply":
                name = req.get("name", "")
                if name == "*":
                    applied = 0
                    for row in mcp_state()["servers"]:
                        if row["source"] and row["status"] in ("repo-only", "differs"):
                            mcp_machine_set(row["name"], row["config"])
                            applied += 1
                    self.send(200, {"ok": True, "applied": applied})
                else:
                    mcp_machine_set(name, mcp_repo_config(name))
                    self.send(200, {"ok": True})
                return
            if action == "mcp-remove-machine":
                mcp_machine_set(req.get("name", ""), None)
                self.send(200, {"ok": True})
                return
            if action == "mcp-adopt":
                st = mcp_state()
                row = next((r for r in st["servers"]
                            if r["name"] == req.get("name") and r["status"] in ("machine-only", "differs")), None)
                if row is None:
                    raise ValueError(f"{req.get('name')}: nothing to adopt from this machine")
                cfg = row["machine_config"] if row["status"] == "differs" else row["config"]
                mcp_write_repo(req.get("source", "claude"), req.get("name", ""), cfg)
                self.send(200, {"ok": True})
                return
            type_ = req.get("type", "skills")
            if type_ not in TYPES:
                raise ValueError("unknown type")
            if action not in ("archive", "restore", "delete", "move", "rename",
                             "duplicate", "group", "group-remove", "upload",
                             "upload-files", "new"):
                self.send(404, {"error": "not found"})
                return
            if TYPES[type_]["kind"] == "dir":
                result = self.handle_skills(action, req)
            else:
                if action == "upload-files":  # md items ARE files; same handler
                    action = "upload"
                result = self.handle_md(type_, action, req)
            self.send(200, result)
        except (ValueError, OSError, json.JSONDecodeError) as e:
            self.send(400, {"error": str(e)})

def main():
    ap = argparse.ArgumentParser(
        description="Local web UI for managing Claude Code config in this repo "
                    "(see bin/claude-ui's docstring for the full model)")
    ap.add_argument("--port", type=int, default=7333)
    ap.add_argument("--no-open", action="store_true", help="don't open a browser")
    ap.add_argument("--link-all", action="store_true",
                    help="headless: link every mapping into the config dir, "
                         "apply MCP servers, and exit (used by bootstrap.sh)")
    args = ap.parse_args()
    migrate_legacy_work()
    if args.link_all:
        link_all()
        return
    srv = None
    for port in range(args.port, args.port + 20):
        try:
            srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
            break
        except OSError as e:
            if e.errno not in (errno.EADDRINUSE, errno.EACCES):
                raise
    if srv is None:
        sys.exit(f"claude-ui: ports {args.port}-{args.port + 19} all in use")
    if port != args.port:
        print(f"claude-ui: port {args.port} in use, using {port}")
    url = f"http://127.0.0.1:{port}"
    print(f"claude-ui: {url}  (repo: {REPO}, config dir: {config_dir()})")
    if not args.no_open:
        webbrowser.open(url)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print()
        sys.exit(0)
