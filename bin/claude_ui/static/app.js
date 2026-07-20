let DATA = { types: {}, links: [], config_dir: "", collections: [] };
let TAB = location.hash.slice(1) || "skills";
let SORT = "name";

async function api(path, body) {
  const res = await fetch(path, body
    ? { method: "POST",
        headers: { "content-type": "application/json", "x-claude-ui": TOKEN },
        body: JSON.stringify(body) }
    : {});
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
}

// Theme: JS sets data-theme so a manual choice survives reloads.
(function () {
  let t = null;
  try { t = localStorage.getItem("claude-ui-theme"); } catch (e) {}
  if (t !== "light" && t !== "dark")
    t = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  document.documentElement.dataset.theme = t;
})();

function toggleTheme() {
  const t = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("claude-ui-theme", t); } catch (e) {}
}

// Toasts stack; errors stick around until dismissed (they may contain paths).
// An optional action ({label, fn}) renders as a button — used for undo.
function toast(msg, err, action) {
  const box = document.getElementById("toasts");
  const el = document.createElement("div");
  el.className = "toastmsg" + (err ? " err" : "");
  const span = document.createElement("span");
  span.textContent = msg;
  el.appendChild(span);
  if (action) {
    const ab = document.createElement("button");
    ab.className = "small";
    ab.textContent = action.label;
    ab.onclick = () => { el.remove(); action.fn(); };
    el.appendChild(ab);
  }
  const x = document.createElement("span");
  x.className = "x";
  x.textContent = "×";
  x.onclick = () => el.remove();
  el.appendChild(x);
  box.appendChild(el);
  while (box.children.length > 5) box.firstChild.remove();
  if (!err) setTimeout(() => el.remove(), action ? 10000 : 3500);
}

// Generic modal replacing prompt()/confirm(): resolves to {field: value} on OK,
// null on cancel/Escape. fields: [{id, label, type: "text"|"select", ...}]
function modal({ title, text, fields = [], ok = "OK", danger = false }) {
  return new Promise((resolve) => {
    const m = document.getElementById("modal");
    m.hidden = false;
    m.innerHTML = "";
    const box = document.createElement("div");
    box.className = "mbox";
    if (title) {
      const h = document.createElement("h3");
      h.textContent = title;
      box.appendChild(h);
    }
    if (text) {
      const p = document.createElement("div");
      p.className = "mtext";
      p.textContent = text;
      box.appendChild(p);
    }
    const inputs = {};
    for (const f of fields) {
      const row = document.createElement("div");
      row.className = "mrow";
      if (f.label) {
        const l = document.createElement("label");
        l.textContent = f.label;
        row.appendChild(l);
      }
      let inp;
      if (f.type === "select") {
        inp = document.createElement("select");
        for (const o of f.options) {
          const op = document.createElement("option");
          op.value = o.value !== undefined ? o.value : o;
          op.textContent = o.label !== undefined ? o.label : o;
          if (op.value === f.value) op.selected = true;
          inp.appendChild(op);
        }
      } else {
        inp = document.createElement("input");
        inp.type = "text";
        inp.value = f.value || "";
        if (f.placeholder) inp.placeholder = f.placeholder;
      }
      inputs[f.id] = inp;
      row.appendChild(inp);
      box.appendChild(row);
    }
    const done = (val) => {
      m.hidden = true;
      m.innerHTML = "";
      document.removeEventListener("keydown", onkey, true);
      resolve(val);
    };
    const submit = () => done(Object.fromEntries(
      Object.entries(inputs).map(([k, i]) => [k, i.value.trim()])));
    const onkey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); done(null); }
      else if (e.key === "Enter" && e.target.tagName !== "SELECT") {
        e.preventDefault();
        submit();
      }
    };
    document.addEventListener("keydown", onkey, true);
    m.onclick = (e) => { if (e.target === m) done(null); };
    const btns = document.createElement("div");
    btns.className = "mbtns";
    const cancel = document.createElement("button");
    cancel.textContent = "cancel";
    cancel.onclick = () => done(null);
    const okb = document.createElement("button");
    okb.textContent = ok;
    okb.className = danger ? "danger" : "primary";
    okb.onclick = submit;
    btns.append(cancel, okb);
    box.appendChild(btns);
    m.appendChild(box);
    const first = Object.values(inputs)[0];
    (first || okb).focus();
    if (first && first.select) first.select();
  });
}

const mconfirm = (title, text, ok) =>
  modal({ title, text, ok: ok || "confirm", danger: true }).then((r) => r !== null);

// Small popup menu anchored to a button (row overflow actions).
function openMenu(anchor, entries) {
  closeMenu();
  const m = document.createElement("div");
  m.className = "menu";
  m.id = "menu";
  for (const e of entries) {
    const b = document.createElement("button");
    b.textContent = e.label;
    if (e.danger) b.className = "danger";
    b.onclick = () => { closeMenu(); e.fn(); };
    m.appendChild(b);
  }
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + "px";
  m.style.top = Math.max(8, Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 8)) + "px";
  setTimeout(() => document.addEventListener("click", closeMenu, { once: true }));
}

function closeMenu() {
  const m = document.getElementById("menu");
  if (m) m.remove();
}

const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const STATUS_TEXT = {
  linked: ["✓ linked", "ok"],
  elsewhere: ["→ points elsewhere", "warn"],
  real: ["real (link backs it up first)", "warn"],
  adopt: ["real (link adopts it into the repo)", "warn"],
  missing: ["not linked", "warn"],
  absent: ["— nothing on either side", ""],
};

function renderLinks() {
  const box = document.getElementById("linkrows");
  box.innerHTML = "";
  let ok = 0, warn = 0;
  for (const l of DATA.links) {
    const [txt, cls] = STATUS_TEXT[l.status] || [l.status, ""];
    if (l.status === "linked") ok++;
    else if (l.status !== "absent") warn++;
    const row = document.createElement("div");
    row.className = "lrow";
    const extra = l.points_to ? " (" + esc(l.points_to) + ")" : "";
    const canLink = l.status !== "linked" && l.status !== "absent";
    const canUnlink = l.status === "linked" || l.status === "elsewhere";
    const canOpen = l.status !== "absent" && (l.status !== "missing" || l.repo_exists);
    const src = l.candidates
      ? `<select onchange="doSource('${l.id}', this.value)" title="which copy is linked">` +
        l.candidates.map((c) =>
          `<option value="${c.source}" ${c.source === l.source ? "selected" : ""}>` +
          `${c.source === "claude" ? "shared" : esc(c.source)}${c.exists ? "" : " (none)"}</option>`).join("") +
        "</select>"
      : "";
    row.innerHTML =
      `<span class="lname">${esc(l.target)}</span>` + src +
      `<span class="lstat ${cls}">${txt}${extra} · repo: ${esc(l.repo)}${l.repo_exists ? "" : " (missing)"}</span>` +
      (l.kind === "file" ? `<button class="small" onclick="openEditor('${l.id}')">edit</button>` : "") +
      (canOpen ? `<button class="small" onclick="doOpen('${l.id}')" title="open in the file manager">open</button>` : "") +
      (canLink ? `<button class="small" onclick="doLink('${l.id}')">link</button>` : "") +
      (canUnlink ? `<button class="small danger" onclick="doUnlink('${l.id}')">unlink</button>` : "");
    box.appendChild(row);
  }
  document.getElementById("linksum").innerHTML =
    ` — <span class="ok">${ok} linked</span>` + (warn ? `, <span class="warn">${warn} need attention</span>` : "");
  document.getElementById("cfgprefix").textContent = DATA.config_dir.replace(/\/?$/, "/");
  const row = document.getElementById("cfgrow");
  if (CFGEDIT) {
    row.innerHTML =
      `<span>config dir</span>` +
      `<input type="text" id="cfgdir" value="${esc(DATA.config_dir)}">` +
      `<button class="small" onclick="saveCfgDir()">save</button>` +
      `<button class="small" onclick="CFGEDIT=false;render()">cancel</button>`;
  } else {
    row.innerHTML =
      `<span>links are managed in <b>${esc(DATA.config_dir)}</b>` +
      (DATA.default_dir ? " (the default — Claude Code reads this automatically)" : "") +
      `</span><span style="flex:1"></span>` +
      `<button class="small" onclick="genBootstrap()" title="write a committable bootstrap.sh that links everything on a new machine">bootstrap.sh</button>` +
      `<button class="small" onclick="CFGEDIT=true;render()">change…</button>` +
      (DATA.default_dir ? "" : `<button class="small" onclick="resetCfgDir()">reset to default</button>`) +
      `<button class="small danger" onclick="resetLinks()" title="remove every managed symlink from the config dir and restore *.bak backups">reset links</button>`;
  }
  document.getElementById("cfghint").textContent = DATA.default_dir
    ? "" : "non-default config dir: Claude Code only uses it if CLAUDE_CONFIG_DIR is exported in your shell";
  if (!renderLinks.seen) {  // auto-open only when something needs attention
    renderLinks.seen = true;
    document.getElementById("links").open = warn > 0;
  }
}

let GITDIFF = {};

function diffEl(text) {
  const pre = document.createElement("pre");
  pre.className = "diff";
  for (const line of text.split("\n")) {
    const s = document.createElement("span");
    s.textContent = line + "\n";
    if (line.startsWith("+")) s.className = "add";
    else if (line.startsWith("-")) s.className = "del";
    else if (line.startsWith("@@")) s.className = "hunk";
    pre.appendChild(s);
  }
  return pre;
}

function renderGit() {
  const g = DATA.git || { files: [], branch: "", error: null };
  const sum = document.getElementById("gitsum");
  sum.innerHTML = g.error
    ? ' — <span class="warn">' + esc(g.error) + "</span>"
    : g.files.length
    ? ` — <span class="warn">${g.files.length} changed</span> on ${esc(g.branch)}`
    : ` — <span class="ok">clean</span> on ${esc(g.branch)}`;
  const el = document.getElementById("gitbody");
  el.innerHTML = "";
  if (g.error) return;
  if (!g.files.length) {
    el.innerHTML = '<div class="empty">working tree clean — nothing to commit</div>';
    return;
  }
  const msgVal = el._msg || "";
  for (const f of g.files) {
    const row = document.createElement("div");
    row.className = "lrow";
    row.innerHTML =
      `<span class="gxy">${esc(f.xy)}</span>` +
      `<span class="lstat">${esc(f.path)}</span>`;
    const b = document.createElement("button");
    b.className = "small";
    b.textContent = GITDIFF[f.path] !== undefined ? "hide" : "diff";
    b.onclick = async () => {
      if (GITDIFF[f.path] !== undefined) {
        delete GITDIFF[f.path];
        renderGit();
        return;
      }
      try {
        GITDIFF[f.path] = (await api("/api/git-diff", { path: f.path })).diff;
        renderGit();
      } catch (e) { toast(e.message, true); }
    };
    row.appendChild(b);
    if (GITDIFF[f.path] !== undefined) row.appendChild(diffEl(GITDIFF[f.path]));
    el.appendChild(row);
  }
  const bar = document.createElement("div");
  bar.className = "cfgdir";
  const inp = document.createElement("input");
  inp.type = "text";
  inp.id = "gitmsg";
  inp.placeholder = "commit message — stages & commits everything above";
  inp.value = msgVal;
  inp.oninput = () => { el._msg = inp.value; };
  bar.appendChild(inp);
  const cb = document.createElement("button");
  cb.className = "small primary";
  cb.textContent = "commit all";
  cb.onclick = async () => {
    const msg = inp.value.trim();
    if (!msg) { toast("commit message required", true); return; }
    try {
      const r = await api("/api/git-commit", { message: msg });
      toast(r.result);
      GITDIFF = {};
      el._msg = "";
      await refresh();
    } catch (e) { toast(e.message, true); }
  };
  bar.appendChild(cb);
  el.appendChild(bar);
}

async function doSource(id, source) {
  try {
    await api("/api/source", { id, source });
    toast(id + " source → " + (source === "claude" ? "shared" : source));
    await refresh();
  } catch (e) { toast(e.message, true); await refresh(); }
}

async function doLink(id) {
  try {
    const r = await api("/api/link", { id });
    toast(r.adopted ? "linked — existing content adopted into the repo (commit it!)"
      : r.backup ? "linked — previous content saved at " + r.backup : "linked");
    await refresh();
  } catch (e) { toast(e.message, true); }
}

async function doUnlink(id) {
  try { await api("/api/unlink", { id }); toast("unlinked"); await refresh(); }
  catch (e) { toast(e.message, true); }
}

async function doOpen(id) {
  try { await api("/api/open", { id }); }
  catch (e) { toast(e.message, true); }
}

async function resetLinks() {
  const linked = DATA.links.filter((l) => l.status === "linked" || l.status === "elsewhere");
  if (!linked.length) { toast("nothing linked — already reset"); return; }
  if (!(await mconfirm("reset links",
    "Remove " + linked.length + " symlink(s) from " + DATA.config_dir +
    " and restore *.bak backups where they exist. The repo keeps everything; " +
    "Claude Code goes back to whatever was there before linking.", "reset"))) return;
  try {
    const r = await api("/api/reset-links", {});
    toast("removed " + r.removed.length + " link(s)" +
      (r.restored.length ? ", restored " + r.restored.length + " backup(s)" : ""));
    await refresh();
  } catch (e) { toast(e.message, true); }
}

let CFGEDIT = false;

async function saveCfgDir() {
  const v = document.getElementById("cfgdir").value.trim();
  try {
    await api("/api/config-dir", { path: v === DATA.config_dir ? "" : v });
    CFGEDIT = false;
    toast("config dir updated");
    await refresh();
  } catch (e) { toast(e.message, true); }
}

async function resetCfgDir() {
  try { await api("/api/config-dir", { path: "" }); toast("config dir reset to default"); await refresh(); }
  catch (e) { toast(e.message, true); }
}

const EXTRA_TABS = ["mcp", "statusline", "settings", "insight", "costs", "doctor"];
const allTabs = () => [...Object.keys(DATA.types), ...EXTRA_TABS];

function renderTabs() {
  const el = document.getElementById("tabs");
  el.innerHTML = "";
  for (const t of allTabs()) {
    const b = document.createElement("button");
    b.textContent = t === "settings"
      ? "settings · " + Object.keys((DATA.settings || {}).data || {}).length
      : t === "mcp"
      ? "mcp · " + ((DATA.mcp || {}).servers || []).length
      : t === "statusline"
      ? "statusline" + ((DATA.statusline || {}).applied ? " ✓" : "")
      : t === "insight"
      ? "insight"
      : t === "costs"
      ? "costs"
      : t === "doctor"
      ? "doctor" + (DOCTOR && DOCTOR.warns ? " · " + DOCTOR.warns + "⚠" : "")
      : t + " · " + DATA.types[t].active.length;
    b.className = t === TAB ? "on" : "";
    b.onclick = () => { TAB = t; BULK.clear(); location.hash = t; render(); };
    el.appendChild(b);
  }
}

function settingsGet(key) {
  let node = (DATA.settings || {}).data || {};
  for (const p of key.split(".")) {
    if (node == null || typeof node !== "object") return undefined;
    node = node[p];
  }
  return node;
}

function settingRow(s) {
  const cur = settingsGet(s.key);
  const isSet = cur !== undefined;
  const row = document.createElement("div");
  row.className = "srow";
  const id = "set_" + s.key.replace(/[^a-zA-Z0-9]/g, "_");
  let ctrl = "";
  if (s.type === "bool" || s.type === "enum") {
    const vals = s.type === "bool" ? ["true", "false"] : s.values;
    ctrl = `<select onchange="saveSetting('${s.key}','${s.type}',this.value)">` +
      `<option value="">(unset${s.default !== undefined ? ", default: " + s.default : ""})</option>` +
      vals.map((v) => `<option ${isSet && String(cur) === String(v) ? "selected" : ""}>${v}</option>`).join("") +
      "</select>";
  } else if (s.type === "string" || s.type === "number") {
    ctrl = `<input type="text" id="${id}" value="${isSet ? esc(String(cur)) : ""}"` +
      ` placeholder="${s.default !== undefined ? "default: " + esc(String(s.default)) : "(unset)"}">` +
      `<button class="small" onclick="saveSetting('${s.key}','${s.type}',document.getElementById('${id}').value)">set</button>`;
  } else {
    let text = "";
    if (isSet) {
      if (s.type === "list") text = (cur || []).join("\n");
      else if (s.type === "kv") text = Object.entries(cur || {}).map(([k, v]) => k + "=" + v).join("\n");
      else text = JSON.stringify(cur, null, 2);
    }
    const ph = s.type === "list" ? "one entry per line"
      : s.type === "kv" ? "KEY=value, one per line" : "JSON";
    const rows = Math.min(10, Math.max(2, text.split("\n").length));
    ctrl = `<textarea id="${id}" rows="${rows}" placeholder="${ph}">${esc(text)}</textarea>` +
      `<button class="small" onclick="saveSetting('${s.key}','${s.type}',document.getElementById('${id}').value)">set</button>`;
  }
  row.innerHTML =
    `<div class="smeta"><span class="skey">${esc(s.key)}</span>` +
    (isSet ? '<span class="badge group">set</span>' : "") +
    `<div class="sdesc">${esc(s.desc)}</div></div>` +
    `<div class="sctrl">${ctrl}` +
    (isSet ? `<button class="small danger" onclick="saveSetting('${s.key}','clear','')">clear</button>` : "") +
    "</div>";
  return row;
}

const HOOK_EVENTS = ["SessionStart", "UserPromptSubmit", "PreToolUse",
  "PostToolUse", "Notification", "Stop", "SubagentStop", "PreCompact",
  "SessionEnd"];

function hooksList(data) {
  const hooks = data.hooks;
  if (hooks == null) return [];
  if (typeof hooks !== "object" || Array.isArray(hooks)) return null;
  const out = [];
  for (const [event, matchers] of Object.entries(hooks)) {
    if (!Array.isArray(matchers)) return null;
    matchers.forEach((m, mi) => {
      if (!m || typeof m !== "object") return;
      (Array.isArray(m.hooks) ? m.hooks : []).forEach((h, hi) => {
        out.push({ event, mi, hi, matcher: m.matcher || "",
          command: (h && h.command) || "", timeout: h && h.timeout });
      });
    });
  }
  return out;
}

async function hooksSave(newHooks) {
  await api("/api/settings-set", { key: "hooks",
    value: Object.keys(newHooks).length ? newHooks : null });
  await refresh();
}

async function hookAdd() {
  const r = await modal({ title: "add hook",
    text: "the command receives the event JSON on stdin; exit code 2 blocks the action (tool events)",
    fields: [
      { id: "e", label: "event", type: "select", options: HOOK_EVENTS },
      { id: "m", label: "matcher — tool name pattern, tool events only (blank = all)",
        placeholder: "e.g. Bash or Edit|Write" },
      { id: "c", label: "command" },
      { id: "t", label: "timeout seconds (optional)" }], ok: "add" });
  if (!r || !r.c) return;
  const hooks = JSON.parse(JSON.stringify(((DATA.settings || {}).data || {}).hooks || {}));
  const arr = (hooks[r.e] = hooks[r.e] || []);
  let entry = arr.find((m) => (m.matcher || "") === (r.m || ""));
  if (!entry) {
    entry = r.m ? { matcher: r.m, hooks: [] } : { hooks: [] };
    arr.push(entry);
  }
  const h = { type: "command", command: r.c };
  if (r.t && !isNaN(+r.t)) h.timeout = +r.t;
  (entry.hooks = entry.hooks || []).push(h);
  try {
    await hooksSave(hooks);
    toast("hook added — applies to new sessions");
  } catch (e) { toast(e.message, true); }
}

async function hookDelete(row) {
  if (!(await mconfirm("delete hook", row.event + ": " + row.command, "delete"))) return;
  const hooks = JSON.parse(JSON.stringify(DATA.settings.data.hooks));
  const m = hooks[row.event][row.mi];
  m.hooks.splice(row.hi, 1);
  if (!m.hooks.length) hooks[row.event].splice(row.mi, 1);
  if (!hooks[row.event].length) delete hooks[row.event];
  try {
    await hooksSave(hooks);
    toast("hook removed");
  } catch (e) { toast(e.message, true); }
}

async function hookFire(row) {
  toast("piping a sample " + row.event + " event into the command…");
  try {
    const r = await api("/api/hook-test", { command: row.command, event: row.event });
    const bits = [row.event + " test: " + r.detail];
    if ((r.stdout || "").trim()) bits.push("stdout: " + r.stdout.trim().slice(0, 300));
    if ((r.stderr || "").trim()) bits.push("stderr: " + r.stderr.trim().slice(0, 300));
    toast(bits.join(" · "), !r.ok);
  } catch (e) { toast(e.message, true); }
}

let SFILTER = { q: "", set: false };

function renderSettings() {
  const el = document.getElementById("settingsview");
  const st = DATA.settings || {};
  el.innerHTML =
    `<div class="sethead">editing <b>${esc(st.path || "")}</b>` +
    ` (source: ${st.source === "claude" ? "shared" : esc(st.source || "")}${st.exists ? "" : ", file will be created on first set"})` +
    " · changes apply to new sessions" +
    (st.linked ? "" : ' <span class="warn">— not linked into the config dir; link settings.json in the panel above for changes to take effect</span>') +
    "</div>";
  if (st.error) {
    const b = document.createElement("div");
    b.className = "banner warn";
    b.textContent = "settings.json has invalid JSON — fix the file by hand; form editing is disabled. " + st.error;
    el.appendChild(b);
    return;
  }

  // hooks builder
  const hooksH = document.createElement("h2");
  hooksH.textContent = "hooks";
  el.appendChild(hooksH);
  const rows = hooksList(st.data || {});
  const hbar = document.createElement("div");
  hbar.className = "bar";
  const note = document.createElement("span");
  note.style.cssText = "align-self:center;font-size:.75rem;color:var(--fg2);flex:1;min-width:12rem";
  note.textContent = rows === null
    ? "hooks config has a non-standard shape — edit it as raw JSON in the schema list below"
    : "lifecycle commands: each receives the event JSON on stdin; test fires a sample event";
  hbar.appendChild(note);
  if (rows !== null) {
    const addb = document.createElement("button");
    addb.className = "small primary";
    addb.textContent = "+ add hook";
    addb.onclick = hookAdd;
    hbar.appendChild(addb);
  }
  el.appendChild(hbar);
  for (const row of rows || []) {
    const d = document.createElement("div");
    d.className = "drow";
    d.innerHTML =
      `<span class="badge group">${esc(row.event)}</span>` +
      (row.matcher ? `<span class="badge link">${esc(row.matcher)}</span>` : "") +
      `<span class="dmsg">${esc(row.command)}</span>` +
      (row.timeout ? `<span class="badge ok">${esc(String(row.timeout))}s</span>` : "");
    const tb = document.createElement("button");
    tb.className = "small";
    tb.textContent = "test";
    tb.onclick = () => hookFire(row);
    d.appendChild(tb);
    const db = document.createElement("button");
    db.className = "small danger";
    db.textContent = "delete";
    db.onclick = () => hookDelete(row);
    d.appendChild(db);
    el.appendChild(d);
  }

  // schema-driven settings with filter
  const fbar = document.createElement("div");
  fbar.className = "bar";
  fbar.style.marginTop = "1.2rem";
  const fin = document.createElement("input");
  fin.type = "search";
  fin.id = "setq";
  fin.placeholder = "filter settings…";
  fin.value = SFILTER.q;
  fin.oninput = () => {
    SFILTER.q = fin.value;
    renderSettings();
    const nf = document.getElementById("setq");
    nf.focus();
    nf.setSelectionRange(nf.value.length, nf.value.length);
  };
  fbar.appendChild(fin);
  const ob = document.createElement("button");
  ob.className = "small" + (SFILTER.set ? " primary" : "");
  ob.textContent = "only set";
  ob.title = "show only keys that are set in the file";
  ob.onclick = () => { SFILTER.set = !SFILTER.set; renderSettings(); };
  fbar.appendChild(ob);
  el.appendChild(fbar);

  const q = SFILTER.q.toLowerCase();
  const match = (s) =>
    (!q || s.key.toLowerCase().includes(q) || (s.desc || "").toLowerCase().includes(q)) &&
    (!SFILTER.set || settingsGet(s.key) !== undefined);
  const cats = {};
  for (const s of SCHEMA) if (match(s)) (cats[s.cat] = cats[s.cat] || []).push(s);
  for (const [cat, items] of Object.entries(cats)) {
    const h = document.createElement("h2");
    h.textContent = cat;
    el.appendChild(h);
    for (const s of items) el.appendChild(settingRow(s));
  }
  const covered = new Set(SCHEMA.map((s) => s.key.split(".")[0]));
  const extra = Object.keys(st.data || {})
    .filter((k) => !covered.has(k))
    .map((k) => ({ key: k, type: "json",
      desc: "(not in the documented schema — edited as raw JSON)" }))
    .filter(match);
  if (extra.length) {
    const h = document.createElement("h2");
    h.textContent = "other keys in file";
    el.appendChild(h);
    for (const s of extra) el.appendChild(settingRow(s));
  }
}

let MCPEDIT = null;

const MCP_TEMPLATE = {
  stdio: { type: "stdio", command: "/path/to/server", args: [], env: {} },
  http: { type: "http", url: "https://example.com/mcp", headers: {} },
};

function mcpSummary(cfg) {
  if (!cfg || typeof cfg !== "object") return "?";
  const t = cfg.type || (cfg.command ? "stdio" : cfg.url ? "http" : "?");
  const what = cfg.command
    ? cfg.command + (cfg.args && cfg.args.length ? " " + cfg.args.join(" ") : "")
    : cfg.url || "";
  return t + " · " + what;
}

function mcpEditPanel() {
  const p = document.createElement("div");
  p.className = "mcppanel";
  const srcs = ["claude", ...(DATA.collections || [])];
  p.innerHTML =
    `<div class="bar"><input type="text" id="mcpname" placeholder="server name"` +
    ` value="${esc(MCPEDIT.name || "")}" ${MCPEDIT.isNew ? "" : "disabled"}>` +
    `<select id="mcpsource">` +
    srcs.map((s) => `<option value="${s}" ${s === MCPEDIT.source ? "selected" : ""}>` +
      `${s === "claude" ? "shared" : esc(s)}</option>`).join("") +
    `</select><span style="flex:1"></span>` +
    (MCPEDIT.isNew ? "" :
      `<button class="small danger" onclick="mcpDelete()">delete from repo</button>`) +
    `</div>`;
  const ta = document.createElement("textarea");
  ta.id = "mcpjson";
  ta.className = "fedit";
  ta.rows = 12;
  ta.value = MCPEDIT.json;
  p.appendChild(ta);
  const bar = document.createElement("div");
  bar.className = "bar";
  bar.style.marginTop = ".6rem";
  bar.innerHTML =
    `<button class="primary" onclick="mcpSave()">save to repo</button>` +
    `<button onclick="MCPEDIT=null;render()">cancel</button>`;
  p.appendChild(bar);
  return p;
}

// Values in env/headers that look like real credentials, so saving them to a
// committed source can warn first (work/ is gitignored; claude/ is not).
function mcpSecretHits(cfg) {
  const hits = [];
  const scan = (obj) => {
    if (!obj || typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v !== "string") continue;
      const placeholder = v === "" || v.includes("${");
      if (placeholder) continue;
      if (/token|secret|key|pass|auth/i.test(k) && v.length >= 8) hits.push(k);
      else if (/^[A-Za-z0-9_-]{32,}$/.test(v)) hits.push(k);
    }
  };
  scan(cfg.env);
  scan(cfg.headers);
  return hits;
}

async function mcpSave() {
  let config;
  try { config = JSON.parse(document.getElementById("mcpjson").value); }
  catch (e) { toast("invalid JSON: " + e.message, true); return; }
  const name = (document.getElementById("mcpname").value || "").trim();
  const source = document.getElementById("mcpsource").value;
  const hits = source === "work" ? [] : mcpSecretHits(config);
  if (hits.length && !(await mconfirm(
    "possible secret in a committed file",
    hits.join(", ") + " look(s) like a real credential, and " +
    (source === "claude" ? "claude/" : source + "/") + " is committed to git. " +
    'Consider "${ENV_VAR}" expansion or the gitignored work/ collection.',
    "save anyway"))) return;
  try {
    await api("/api/mcp-save", { name, source, config,
      orig_source: MCPEDIT.isNew ? null : MCPEDIT.source });
    toast(name + " saved to " + (source === "claude" ? "shared" : source) +
      " — use apply to activate on this machine");
    MCPEDIT = null;
    await refresh();
  } catch (e) { toast(e.message, true); }
}

async function mcpDelete() {
  const onMachine = ["applied", "differs"].includes(MCPEDIT.status);
  const fields = onMachine
    ? [{ id: "m", label: "this machine's ~/.claude.json", type: "select", options: [
        { value: "", label: "keep the machine copy" },
        { value: "1", label: "remove from the machine too" }] }]
    : [];
  const r = await modal({ title: "delete " + MCPEDIT.name,
    text: "removes the repo definition", fields, ok: "delete", danger: true });
  if (r === null) return;
  try {
    await api("/api/mcp-delete", { name: MCPEDIT.name, source: MCPEDIT.source,
      from_machine: !!r.m });
    toast(MCPEDIT.name + " deleted");
    MCPEDIT = null;
    await refresh();
  } catch (e) { toast(e.message, true); }
}

async function mcpApply(name) {
  try {
    const r = await api("/api/mcp-apply", { name });
    toast(name === "*" ? r.applied + " server(s) applied to ~/.claude.json"
      : name + " applied to ~/.claude.json");
    await refresh();
  } catch (e) { toast(e.message, true); }
}

async function mcpRemoveMachine(name) {
  if (!(await mconfirm("remove " + name + " from this machine",
    "Removes it from ~/.claude.json; the repo definition, if any, is kept.",
    "remove"))) return;
  try {
    await api("/api/mcp-remove-machine", { name });
    toast(name + " removed from machine");
    await refresh();
  } catch (e) { toast(e.message, true); }
}

async function mcpAdopt(name) {
  const srcs = ["claude", ...(DATA.collections || [])];
  let source = "claude";
  if (srcs.length > 1) {
    const r = await modal({ title: "adopt " + name,
      text: "copies this machine's definition into the repo",
      fields: [{ id: "s", label: "into source", type: "select",
        options: srcs.map((s) => ({ value: s, label: s === "claude" ? "shared" : s })) }],
      ok: "adopt" });
    if (r === null) return;
    source = r.s;
  }
  try {
    await api("/api/mcp-adopt", { name, source });
    toast(name + " adopted into the repo — commit it" + (source === "work" ? " (gitignored: stays local)" : ""));
    await refresh();
  } catch (e) { toast(e.message, true); }
}

async function mcpNew() {
  const r = await modal({ title: "add MCP server", fields: [
    { id: "n", label: "server name" },
    { id: "k", label: "transport", type: "select", options: [
      { value: "stdio", label: "stdio — local command" },
      { value: "http", label: "http/sse — remote URL" }] }], ok: "create" });
  if (!r || !r.n) return;
  MCPEDIT = { name: r.n, source: "claude", isNew: true,
    json: JSON.stringify(MCP_TEMPLATE[r.k], null, 2) };
  render();
}

function renderMcp() {
  const el = document.getElementById("mcpview");
  const st = DATA.mcp || { servers: [] };
  let head =
    `<div class="sethead">server definitions live in the repo (shared <b>claude/${esc("mcp-servers.json")}</b>` +
    ` or a collection's copy) and are <b>applied</b> per machine into <b>${esc(st.machine_path)}</b>` +
    ` — Claude Code's user-scope MCP store${st.machine_exists ? "" : " (created on first apply)"}.</div>`;
  el.innerHTML = head;
  if (st.machine_error) {
    const b = document.createElement("div");
    b.className = "banner warn";
    b.textContent = "~/.claude.json has invalid JSON — machine actions disabled. " + st.machine_error;
    el.appendChild(b);
  }
  for (const e of st.errors || []) {
    const b = document.createElement("div");
    b.className = "banner warn";
    b.textContent = e;
    el.appendChild(b);
  }
  const bar = document.createElement("div");
  bar.className = "bar";
  bar.innerHTML =
    `<span style="flex:1"></span>` +
    `<button onclick="mcpApply('*')">apply all</button>` +
    `<button class="primary" onclick="mcpNew()">+ add server</button>`;
  el.appendChild(bar);
  if (MCPEDIT) el.appendChild(mcpEditPanel());
  if (!st.servers.length) {
    const d = document.createElement("div");
    d.className = "empty";
    d.textContent = "no MCP servers defined or on this machine";
    el.appendChild(d);
    return;
  }
  const machineOk = !st.machine_error;
  for (const s of st.servers) {
    const row = document.createElement("div");
    row.className = "row";
    const srcBadge = s.source
      ? `<span class="badge group">${s.source === "claude" ? "shared" : esc(s.source)}</span>`
      : "";
    const statusBadge = {
      applied: '<span class="badge ok">applied</span>',
      "repo-only": '<span class="badge link">not on this machine</span>',
      "machine-only": '<span class="badge local">machine only</span>',
      differs: '<span class="badge warn">differs from machine</span>',
    }[s.status] || "";
    row.innerHTML =
      `<span class="name">${esc(s.name)}</span>` + srcBadge + statusBadge +
      `<span class="desc">${esc(mcpSummary(s.config))}</span>`;
    const act = document.createElement("span");
    act.className = "actions";
    const btn = (label, fn, cls) => {
      const b = document.createElement("button");
      b.textContent = label;
      if (cls) b.className = cls;
      b.onclick = fn;
      act.appendChild(b);
    };
    if (s.source)
      btn("edit", () => {
        MCPEDIT = { name: s.name, source: s.source, status: s.status,
          isNew: false, json: JSON.stringify(s.config, null, 2) };
        render();
      });
    btn("test", () => mcpTest(s.name));
    if (machineOk && s.source && (s.status === "repo-only" || s.status === "differs"))
      btn("apply", () => mcpApply(s.name));
    if (machineOk && (s.status === "machine-only" || s.status === "differs"))
      btn("adopt", () => mcpAdopt(s.name));
    if (machineOk && s.status !== "repo-only")
      btn("remove from machine", () => mcpRemoveMachine(s.name), "danger");
    row.appendChild(act);
    el.appendChild(row);
  }
}

async function mcpTest(name) {
  toast("testing " + name + "…");
  try {
    const r = await api("/api/mcp-test", { name });
    toast(name + ": " + r.detail, !r.ok);
  } catch (e) { toast(e.message, true); }
}

let STL = null;
let STL_DRAG = null;

const STL_COLORS = { yellow: "var(--yellow)", blue: "var(--blue)", green: "var(--green)",
  aqua: "var(--aqua)", orange: "var(--orange)", gray: "var(--fg2)",
  purple: "var(--purple)", red: "var(--red)" };
let STL_WIDTH = null;  // preview truncation width in columns (null = full)

const STL_MAX_LINES = 4; // the config format has three line-break fields (br1-3)

// One-click starting layouts; colors and bold overrides are kept as-is.
const STL_PRESETS = {
  minimal: [["model", "dir", "branch", "context"]],
  standard: [["model", "effort", "dir", "branch", "context", "cost", "lines"]],
  "two-line": [["model", "effort", "repo", "branch", "context", "tokens"],
               ["cost", "costtoday", "duration", "lines", "rate5h", "rate7d"]],
};

function stlPreset(name) {
  const layout = STL_PRESETS[name];
  const used = new Set(layout.flat());
  STL.lines = layout.map((l) => [...l]);
  STL.palette = [...stlAvail().keys()]
    .filter((id) => !/^br[123]$/.test(id) && !used.has(id));
  STL.sel = null;
  renderStatusline();
}

function stlAvail() {
  return new Map(((DATA.statusline || {}).available || []).map((f) => [f.id, f]));
}

// The saved config is a flat ordered field list with br1-3 pseudo-fields as
// line breaks; the UI models it as lines of enabled chips plus a palette of
// unused fields, with color overrides kept aside so they survive removal.
function stlInit() {
  const st = DATA.statusline || {};
  const cfg = st.config || st.default || { separator: "  ", fields: [] };
  const avail = stlAvail();
  const lines = [[]];
  const palette = [];
  const colors = {};
  const bold = {};
  const seen = new Set();
  const all = [...(cfg.fields || [])];
  for (const f of st.available || [])
    if (!all.some((x) => x.id === f.id)) all.push({ id: f.id, enabled: false });
  for (const f of all) {
    if (!avail.has(f.id) || seen.has(f.id)) continue;
    seen.add(f.id);
    if (f.color) colors[f.id] = f.color;
    if (f.bold) bold[f.id] = true;
    if (/^br[123]$/.test(f.id)) {
      if (f.enabled && lines.length < STL_MAX_LINES) lines.push([]);
      continue;
    }
    if (f.enabled) lines[lines.length - 1].push(f.id);
    else palette.push(f.id);
  }
  STL = { separator: cfg.separator !== undefined ? cfg.separator : "  ",
    refresh: cfg.refresh || 0, lines, palette, colors, bold, sel: null };
}

// Back to the flat format: enabled fields line by line with br1-3 between
// lines, then the unused fields (disabled) so their order and colors persist.
function stlFields() {
  const fields = [];
  STL.lines.forEach((line, i) => {
    if (i > 0) fields.push({ id: "br" + i, enabled: true });
    for (const id of line) {
      const e = { id, enabled: true };
      if (STL.colors[id]) e.color = STL.colors[id];
      if (STL.bold[id]) e.bold = true;
      fields.push(e);
    }
  });
  for (let i = STL.lines.length; i <= 3; i++) fields.push({ id: "br" + i, enabled: false });
  for (const id of STL.palette) {
    const e = { id, enabled: false };
    if (STL.colors[id]) e.color = STL.colors[id];
    if (STL.bold[id]) e.bold = true;
    fields.push(e);
  }
  return fields;
}

function stlColor(id) {
  const c = STL.colors[id] || (stlAvail().get(id) || {}).color;
  return c && c.startsWith("#") ? c : STL_COLORS[c] || "var(--fg)";
}

function stlPalAdd(id) {
  STL.palette.push(id);
  const order = new Map([...stlAvail().keys()].map((k, i) => [k, i]));
  STL.palette.sort((a, b) => order.get(a) - order.get(b));
}

// Move the dragged chip (from a line or the palette) into line li; fi is the
// insertion index, or null to append.
function stlDrop(li, fi) {
  const d = STL_DRAG;
  STL_DRAG = null;
  if (!d) return;
  let at = fi;
  if (d.src === "line") {
    if (d.line === li && at !== null && d.idx < at) at--;
    STL.lines[d.line].splice(d.idx, 1);
  } else {
    STL.palette = STL.palette.filter((x) => x !== d.id);
  }
  const line = STL.lines[li];
  line.splice(at === null ? line.length : at, 0, d.id);
  renderStatusline();
}

function stlRemove(id) {
  for (const line of STL.lines) {
    const i = line.indexOf(id);
    if (i >= 0) line.splice(i, 1);
  }
  stlPalAdd(id);
  if (STL.sel === id) STL.sel = null;
  renderStatusline();
}

function stlSetColor(id, color) {
  if (color) STL.colors[id] = color;
  else delete STL.colors[id];
  renderStatusline();
}

function stlChip(id, li, fi) {
  const a = stlAvail().get(id);
  const col = stlColor(id);
  const chip = document.createElement("span");
  chip.className = "stlchip" + (STL.sel === id ? " sel" : "");
  chip.style.color = col;
  chip.style.borderColor = col;
  if (STL.bold[id]) chip.style.fontWeight = "bold";
  chip.title = a.desc + " (drag to move, click for colour & bold)";
  chip.draggable = true;
  chip.ondragstart = (e) => {
    STL_DRAG = { src: "line", line: li, idx: fi, id };
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    chip.classList.add("dragging");
  };
  chip.ondragend = () => { STL_DRAG = null; chip.classList.remove("dragging"); };
  chip.ondragover = (e) => {
    e.preventDefault();
    const r = chip.getBoundingClientRect();
    const left = e.clientX - r.left < r.width / 2;
    chip.classList.toggle("ins-l", left);
    chip.classList.toggle("ins-r", !left);
  };
  chip.ondragleave = () => chip.classList.remove("ins-l", "ins-r");
  chip.ondrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    chip.classList.remove("ins-l", "ins-r");
    const r = chip.getBoundingClientRect();
    stlDrop(li, e.clientX - r.left < r.width / 2 ? fi : fi + 1);
  };
  chip.onclick = () => { STL.sel = STL.sel === id ? null : id; renderStatusline(); };
  const label = document.createElement("span");
  label.textContent = a.label;
  chip.appendChild(label);
  const smp = document.createElement("span");
  smp.className = "smp";
  smp.textContent = a.sample;
  chip.appendChild(smp);
  const x = document.createElement("span");
  x.className = "x";
  x.textContent = "×";
  x.title = "remove from the statusline";
  x.onclick = (e) => { e.stopPropagation(); stlRemove(id); };
  chip.appendChild(x);
  return chip;
}

function stlPalChip(id) {
  const a = stlAvail().get(id);
  const chip = document.createElement("span");
  chip.className = "stlchip pal";
  chip.style.color = stlColor(id);
  chip.title = a.sample + " — " + a.desc + " (click or drag onto a line to add)";
  chip.draggable = true;
  chip.ondragstart = (e) => {
    STL_DRAG = { src: "palette", id };
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    chip.classList.add("dragging");
  };
  chip.ondragend = () => { STL_DRAG = null; chip.classList.remove("dragging"); };
  chip.onclick = () => {
    STL.palette = STL.palette.filter((x) => x !== id);
    STL.lines[STL.lines.length - 1].push(id);
    renderStatusline();
  };
  const label = document.createElement("span");
  label.textContent = a.label;
  chip.appendChild(label);
  return chip;
}

function stlColorPanel() {
  const id = STL.sel;
  const a = stlAvail().get(id);
  const box = document.createElement("div");
  box.className = "stlcolors";
  const cur = STL.colors[id] || null;
  const who = document.createElement("span");
  who.className = "who";
  who.textContent = "colour for " + a.label + ":";
  box.appendChild(who);
  for (const name of Object.keys(STL_COLORS)) {
    const b = document.createElement("button");
    b.className = "swatch" + (cur === name ? " on" : "");
    b.style.background = STL_COLORS[name];
    b.title = name;
    b.onclick = () => stlSetColor(id, name);
    box.appendChild(b);
  }
  const custom = document.createElement("input");
  custom.type = "color";
  custom.title = "custom colour (truecolor terminals)";
  if (cur && cur.startsWith("#")) { custom.value = cur; custom.classList.add("on"); }
  custom.oninput = () => stlSetColor(id, custom.value);
  box.appendChild(custom);
  const bold = document.createElement("button");
  bold.className = "small boldbtn" + (STL.bold[id] ? " on" : "");
  bold.textContent = "bold";
  bold.title = "toggle bold for this field";
  bold.onclick = () => {
    if (STL.bold[id]) delete STL.bold[id];
    else STL.bold[id] = true;
    renderStatusline();
  };
  box.appendChild(bold);
  const def = document.createElement("button");
  def.className = "small";
  def.textContent = cur ? "reset to default (" + a.color + ")" : "default (" + a.color + ")";
  def.disabled = !cur;
  def.onclick = () => stlSetColor(id, null);
  box.appendChild(def);
  const close = document.createElement("button");
  close.className = "small";
  close.textContent = "close";
  close.onclick = () => { STL.sel = null; renderStatusline(); };
  box.appendChild(close);
  return box;
}

function renderStatusline() {
  const el = document.getElementById("stlview");
  const st = DATA.statusline || {};
  if (!STL) stlInit();
  el.innerHTML = "";
  const head = document.createElement("div");
  head.className = "sethead";
  head.innerHTML =
    `generates <b>${esc(st.script_path || "")}</b>, linked into the config dir as ` +
    `<b>~/.claude/statusline.sh</b> and referenced from settings.json ` +
    (st.applied
      ? '<span style="color:var(--green)">✓ statusLine is set</span>'
      : '<span style="color:var(--orange)">— not set in settings.json yet; use save &amp; apply</span>') +
    `<br>no restart needed: Claude Code re-runs the script after every assistant ` +
    `message (and picks up settings.json edits on your next interaction); set a ` +
    `refresh interval below to also update while the session sits idle.`;
  el.appendChild(head);
  const term = document.createElement("div");
  term.className = "stlterm";
  term.innerHTML =
    '<div class="stltermhead"><span class="dot r"></span><span class="dot y"></span>' +
    '<span class="dot g"></span><span class="ttl">preview</span></div>';
  const wsel = document.createElement("span");
  wsel.className = "wsel";
  for (const w of [null, 120, 80]) {
    const b = document.createElement("button");
    b.className = "small" + (STL_WIDTH === w ? " on" : "");
    b.textContent = w ? w + " col" : "full";
    b.title = w ? "truncate the preview at ~" + w + " columns, like a narrow terminal"
      : "no truncation";
    b.onclick = () => { STL_WIDTH = w; renderStatusline(); };
    wsel.appendChild(b);
  }
  term.querySelector(".stltermhead").appendChild(wsel);
  const prev = document.createElement("div");
  prev.className = "stlpreview";
  if (STL_WIDTH) {
    prev.classList.add("trunc");
    prev.style.width = "calc(" + STL_WIDTH + "ch + 1.8rem)";
  }
  const raw = STL.separator;
  const sep = raw.trim()
    ? `<span class="psep">${esc(" " + raw.trim() + " ")}</span>` : esc(raw);
  const rendered = STL.lines
    .map((line) => line
      .map((id) => `<span style="color:${stlColor(id)}${STL.bold[id] ? ";font-weight:bold" : ""}">` +
                   `${esc(stlAvail().get(id).sample)}</span>`)
      .join(sep))
    .filter((l) => l.length);
  prev.innerHTML = rendered.length
    ? rendered.join("<br>")
    : '<span style="color:var(--bg2)">(no fields enabled — add some from the palette)</span>';
  term.appendChild(prev);
  el.appendChild(term);
  const bar = document.createElement("div");
  bar.className = "bar";
  bar.innerHTML =
    `<span style="align-self:center;font-size:.8rem;color:var(--fg2)"` +
    ` title="a visible separator automatically gets one space on each side; leave blank/spaces for space-only separation">separator</span>` +
    `<input type="text" id="stlsep" value="${esc(STL.separator)}" style="width:6rem"` +
    ` oninput="STL.separator=this.value" onchange="renderStatusline()">` +
    ["│", "·", "»"].map((ch) =>
      `<button class="small" title="separator preset"` +
      ` onclick="STL.separator='${ch}';renderStatusline()">${ch}</button>`).join("") +
    `<button class="small" title="plain spaces, no separator character"` +
    ` onclick="STL.separator='  ';renderStatusline()">space</button>` +
    `<span style="align-self:center;font-size:.8rem;color:var(--fg2)"` +
    ` title="Claude Code re-runs the script after each assistant message; a refresh interval also re-runs it every N seconds while idle, so edits show up without any interaction. 0 = only on updates.">` +
    `refresh every</span>` +
    `<input type="number" min="0" max="3600" value="${STL.refresh}" style="width:4.5rem"` +
    ` oninput="STL.refresh=Math.max(0,parseInt(this.value)||0)">` +
    `<span style="align-self:center;font-size:.8rem;color:var(--fg2)">s (0 = on updates only)</span>` +
    `<span style="flex:1"></span>` +
    `<button onclick="stlSave(false)">save</button>` +
    `<button class="primary" onclick="stlSave(true)">save &amp; apply</button>`;
  el.appendChild(bar);
  const grid = document.createElement("div");
  grid.className = "stlgrid";
  const build = document.createElement("div");
  build.className = "stlbuild";
  const presets = document.createElement("div");
  presets.className = "stlpresets";
  presets.append("presets:");
  for (const name of Object.keys(STL_PRESETS)) {
    const b = document.createElement("button");
    b.className = "small";
    b.textContent = name;
    b.title = "replace the current layout with the " + name + " preset " +
      "(colours and bold are kept)";
    b.onclick = () => stlPreset(name);
    presets.appendChild(b);
  }
  build.appendChild(presets);
  if (STL.sel && STL.lines.some((l) => l.includes(STL.sel))) build.appendChild(stlColorPanel());
  else STL.sel = null;
  STL.lines.forEach((line, li) => {
    const lineEl = document.createElement("div");
    lineEl.className = "stlline";
    lineEl.ondragover = (e) => { e.preventDefault(); lineEl.classList.add("drag"); };
    lineEl.ondragleave = () => lineEl.classList.remove("drag");
    lineEl.ondrop = (e) => { e.preventDefault(); stlDrop(li, null); };
    const lno = document.createElement("span");
    lno.className = "lno";
    lno.textContent = String(li + 1);
    lno.title = "line " + (li + 1);
    lineEl.appendChild(lno);
    line.forEach((id, fi) => lineEl.appendChild(stlChip(id, li, fi)));
    if (!line.length) {
      const ph = document.createElement("span");
      ph.className = "empty";
      ph.style.pointerEvents = "none";
      ph.textContent = "drop fields here";
      lineEl.appendChild(ph);
    }
    if (STL.lines.length > 1) {
      const del = document.createElement("button");
      del.className = "small ldel";
      del.textContent = "× line";
      del.title = "remove this line (its fields move to the line above)";
      del.onclick = () => {
        const dst = li > 0 ? li - 1 : 1;
        STL.lines[dst].push(...STL.lines[li]);
        STL.lines.splice(li, 1);
        renderStatusline();
      };
      lineEl.appendChild(del);
    }
    build.appendChild(lineEl);
  });
  const add = document.createElement("button");
  add.className = "small";
  add.textContent = "+ line";
  add.disabled = STL.lines.length >= STL_MAX_LINES;
  add.title = add.disabled
    ? "max " + STL_MAX_LINES + " lines (the config has three line breaks)"
    : "add a line — narrow terminals truncate long lines instead of wrapping";
  add.onclick = () => { STL.lines.push([]); renderStatusline(); };
  build.appendChild(add);
  grid.appendChild(build);
  const side = document.createElement("div");
  side.className = "stlside";
  side.innerHTML =
    `<h3>available fields</h3>` +
    `<div class="hint">click or drag onto a line · drag a chip back here to remove</div>`;
  side.ondragover = (e) => {
    if (STL_DRAG && STL_DRAG.src === "line") { e.preventDefault(); side.classList.add("drag"); }
  };
  side.ondragleave = () => side.classList.remove("drag");
  side.ondrop = (e) => {
    e.preventDefault();
    const d = STL_DRAG;
    STL_DRAG = null;
    if (!d || d.src !== "line") return;
    stlRemove(d.id);
  };
  if (!STL.palette.length) {
    const chips = document.createElement("div");
    chips.className = "stlchips";
    chips.innerHTML = '<span class="empty">all fields in use</span>';
    side.appendChild(chips);
  }
  const cats = new Map();
  for (const id of STL.palette) {
    const cat = (stlAvail().get(id) || {}).cat || "other";
    if (!cats.has(cat)) cats.set(cat, []);
    cats.get(cat).push(id);
  }
  for (const [cat, ids] of cats) {
    const h = document.createElement("h4");
    h.textContent = cat;
    side.appendChild(h);
    const chips = document.createElement("div");
    chips.className = "stlchips";
    for (const id of ids) chips.appendChild(stlPalChip(id));
    side.appendChild(chips);
  }
  grid.appendChild(side);
  el.appendChild(grid);
}

async function stlSave(apply) {
  try {
    await api("/api/statusline-save", {
      config: { separator: STL.separator, refresh: STL.refresh, fields: stlFields() },
      apply });
    toast(apply
      ? "statusline saved and statusLine set in settings.json — make sure statusline.sh and settings.json are linked"
      : "statusline script regenerated — a running Claude Code picks it up on its next update");
    STL = null;
    await refresh();
  } catch (e) { toast(e.message, true); }
}

async function saveSetting(key, type, raw) {
  let value = null;
  try {
    if (type !== "clear" && raw !== "" && raw != null) {
      if (type === "bool") value = raw === "true";
      else if (type === "number") {
        value = Number(raw);
        if (Number.isNaN(value)) throw new Error("not a number");
      } else if (type === "enum" || type === "string") value = raw;
      else if (type === "list") {
        value = raw.split("\n").map((l) => l.trim()).filter(Boolean);
        if (!value.length) value = null;
      } else if (type === "kv") {
        value = {};
        for (const line of raw.split("\n")) {
          const l = line.trim();
          if (!l) continue;
          const i = l.indexOf("=");
          if (i < 1) throw new Error("expected KEY=value: " + l);
          value[l.slice(0, i).trim()] = l.slice(i + 1).trim();
        }
        if (!Object.keys(value).length) value = null;
      } else if (type === "json") value = JSON.parse(raw);
    }
  } catch (e) { toast("invalid value: " + e.message, true); return; }
  try {
    await api("/api/settings-set", { key, value });
    toast(value === null ? key + " cleared" : key + " set");
    await refresh();
  } catch (e) { toast(e.message, true); }
}

let INSIGHT = null;
let DOCTOR = null;

const BUDGET_COLORS = { "CLAUDE.md": "var(--yellow)", skills: "var(--aqua)",
  commands: "var(--blue)", agents: "var(--purple)",
  "output-styles": "var(--orange)" };
const USAGE_KIND = { skills: "skill", commands: "command", agents: "agent" };

function tokfmt(n) {
  if (n < 1000) return String(n);
  let s = (n / 1000).toFixed(1);
  if (s.endsWith(".0")) s = s.slice(0, -2);
  return s + "k";
}

function relTime(iso) {
  if (!iso) return "never";
  const d = Date.now() - Date.parse(iso);
  if (!isFinite(d)) return iso;
  const day = 86400000;
  if (d < 3600000) return Math.max(1, Math.round(d / 60000)) + "m ago";
  if (d < day) return Math.round(d / 3600000) + "h ago";
  if (d < 30 * day) return Math.round(d / day) + "d ago";
  return Math.round(d / (30 * day)) + "mo ago";
}

async function renderInsight(rescan) {
  const el = document.getElementById("insightview");
  if (!INSIGHT || rescan) {
    el.innerHTML = '<div class="empty">estimating context cost and scanning session transcripts…</div>';
    try { INSIGHT = await api("/api/insight" + (rescan ? "?rescan" : "")); }
    catch (e) {
      el.innerHTML = '<div class="banner warn">' + esc(e.message) + "</div>";
      return;
    }
    if (TAB !== "insight") return;
  }
  const b = INSIGHT.budget, u = INSIGHT.usage;
  el.innerHTML = "";
  const head = document.createElement("div");
  head.className = "sethead";
  head.innerHTML =
    "what your config costs at the start of <i>every</i> session " +
    "(chars÷4 estimate — CLAUDE.md is injected wholesale, each active item " +
    "contributes its name + description), and what actually gets used " +
    "(session transcripts in <b>" + esc(u.dir) + "</b>, parsed locally)";
  el.appendChild(head);

  const used = u.by || {};
  const now = Date.now();
  const unused = [];
  for (const [t, kind] of Object.entries(USAGE_KIND)) {
    for (const s of (DATA.types[t] || {}).active || []) {
      const rec = (used[kind] || {})[s.name];
      const last = rec && rec.last ? Date.parse(rec.last) : 0;
      if (!last || now - last > 90 * 86400000)
        unused.push({ type: t, name: s.name, last });
    }
  }

  const tiles = document.createElement("div");
  tiles.className = "tiles";
  const tile = (num, lbl) =>
    `<div class="tile"><div class="tnum">${num}</div><div class="tlbl">${lbl}</div></div>`;
  tiles.innerHTML =
    tile(tokfmt(b.total), "tokens every session") +
    tile(tokfmt(b.claude_md), "CLAUDE.md") +
    tile(tokfmt((b.types.skills || {}).tokens || 0), "skill descriptions") +
    (u.available ? tile(u.sessions, "sessions scanned") : "") +
    (u.available && u.sessions ? tile(unused.length, "unused 90d+") : "");
  el.appendChild(tiles);

  const segs = [["CLAUDE.md", b.claude_md],
    ...Object.entries(b.types).map(([t, v]) => [t, v.tokens])];
  const bar = document.createElement("div");
  bar.className = "budgetbar";
  const key = document.createElement("div");
  key.className = "budgetkey";
  for (const [name, tok] of segs) {
    if (!tok) continue;
    const d = document.createElement("div");
    d.style.flex = String(tok);
    d.style.background = BUDGET_COLORS[name] || "var(--fg2)";
    d.title = name + ": ~" + tokfmt(tok) + " tokens";
    bar.appendChild(d);
    const k = document.createElement("span");
    k.innerHTML = `<span class="sw" style="background:${BUDGET_COLORS[name] || "var(--fg2)"}"></span>` +
      `${esc(name)} ~${tokfmt(tok)}`;
    key.appendChild(k);
  }
  el.appendChild(bar);
  el.appendChild(key);

  const table = (title, headers, rows) => {
    const h = document.createElement("h2");
    h.textContent = title;
    el.appendChild(h);
    const t = document.createElement("table");
    t.className = "itable";
    t.innerHTML = "<tr>" + headers.map((x) => `<th>${x}</th>`).join("") + "</tr>";
    for (const r of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = r;
      t.appendChild(tr);
    }
    el.appendChild(t);
  };

  const consumers = Object.entries(b.types)
    .flatMap(([t, v]) => v.items.map((it) => ({ type: t, ...it })))
    .sort((a, b2) => b2.tokens - a.tokens)
    .slice(0, 12);
  table("top context consumers", ["item", "type", "~tokens"],
    consumers.map((c) =>
      `<td>${esc(c.name)}</td><td class="dim">${esc(c.type)}</td>` +
      `<td class="num">${tokfmt(c.tokens)}</td>`));

  if (u.available && u.sessions) {
    const rows = [];
    for (const [kind, names] of Object.entries(used))
      for (const [name, rec] of Object.entries(names))
        rows.push({ kind, name, count: rec.count, last: rec.last });
    rows.sort((a, b2) => b2.count - a.count);
    table("most used (all transcripts)", ["name", "kind", "uses", "last used"],
      rows.slice(0, 15).map((r) =>
        `<td>${esc(r.name)}</td><td class="dim">${esc(r.kind)}</td>` +
        `<td class="num">${r.count}</td><td class="dim">${esc(relTime(r.last))}</td>`));
    if (unused.length)
      table("unused in 90+ days — archive candidates", ["name", "type", "last used"],
        unused.slice(0, 30).map((r) =>
          `<td>${esc(r.name)}</td><td class="dim">${esc(r.type)}</td>` +
          `<td class="dim">${r.last ? esc(relTime(new Date(r.last).toISOString())) : "never"}</td>`));
  } else if (!u.available) {
    const n = document.createElement("div");
    n.className = "empty";
    n.textContent = "no transcripts found at " + u.dir + " — usage analytics appear once Claude Code has recorded sessions on this machine";
    el.appendChild(n);
  }

  // permission advisor: Bash prefixes approved often -> propose allow rules
  if (u.available && u.sessions && u.bash) {
    const allow = (INSIGHT.allow || []).filter((r) => typeof r === "string");
    const covered = (prefix) => allow.some((r) => {
      if (!r.startsWith("Bash(")) return false;
      const inner = r.slice(5, -1).replace(/:?\*$/, "").trim();
      return inner && (prefix === inner || prefix.startsWith(inner + " "));
    });
    const cand = Object.entries(u.bash)
      .filter(([p, n]) => n >= 5 && !covered(p))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
    if (cand.length) {
      const h = document.createElement("h2");
      h.textContent = "permission advisor — frequent Bash commands with no allow rule";
      el.appendChild(h);
      const note = document.createElement("div");
      note.className = "sethead";
      note.textContent = "these ran repeatedly across your sessions; an allow rule in settings.json skips the permission prompt for them";
      el.appendChild(note);
      const t = document.createElement("table");
      t.className = "itable";
      t.innerHTML = "<tr><th>command</th><th>uses</th><th>proposed rule</th><th></th></tr>";
      for (const [prefix, n] of cand) {
        const rule = "Bash(" + prefix + ":*)";
        const tr = document.createElement("tr");
        tr.innerHTML =
          `<td>${esc(prefix)}</td><td class="num">${n}</td>` +
          `<td class="dim">${esc(rule)}</td>`;
        const td = document.createElement("td");
        const b = document.createElement("button");
        b.className = "small";
        b.textContent = "allow";
        b.onclick = async () => {
          try {
            await api("/api/settings-set", { key: "permissions.allow",
              value: [...allow, rule] });
            toast(rule + " added to permissions.allow");
            await refresh();
            INSIGHT = null;
            renderInsight();
          } catch (e) { toast(e.message, true); }
        };
        td.appendChild(b);
        tr.appendChild(td);
        t.appendChild(tr);
      }
      el.appendChild(t);
    }
  }

  const bar2 = document.createElement("div");
  bar2.className = "bar";
  const rb = document.createElement("button");
  rb.className = "small";
  rb.textContent = "rescan transcripts";
  rb.title = "drop the cache and re-read every transcript" +
    (u.scanned_now ? " (last run read " + u.scanned_now + " new file(s))" : "");
  rb.onclick = () => renderInsight(true);
  bar2.appendChild(rb);
  el.appendChild(bar2);
}

let COSTS = null;

function usd(n) {
  if (n >= 100) return "$" + Math.round(n);
  if (n >= 1) return "$" + n.toFixed(2);
  return "$" + n.toFixed(3);
}

async function renderCosts(rescan) {
  const el = document.getElementById("costsview");
  if (!COSTS || rescan) {
    el.innerHTML = '<div class="empty">reading transcripts and pricing usage…</div>';
    try { COSTS = await api("/api/costs" + (rescan ? "?rescan" : "")); }
    catch (e) {
      el.innerHTML = '<div class="banner warn">' + esc(e.message) + "</div>";
      return;
    }
    if (TAB !== "costs") return;
  }
  const c = COSTS;
  el.innerHTML = "";
  const head = document.createElement("div");
  head.className = "sethead";
  head.innerHTML =
    "estimated API-price cost of your Claude Code usage, computed locally from " +
    "the transcripts in <b>" + esc(c.dir) + "</b> (input/output/cache tokens × " +
    "list prices; cache writes at 1.25×, cache reads at 0.1×). On a Pro/Max " +
    "subscription this shows what the same usage <i>would</i> cost via the API.";
  el.appendChild(head);
  if (!c.available || !c.sessions) {
    el.innerHTML += '<div class="empty">no transcripts found — cost data appears once Claude Code has recorded sessions on this machine</div>';
    return;
  }
  const tiles = document.createElement("div");
  tiles.className = "tiles";
  const tile = (num, lbl) =>
    `<div class="tile"><div class="tnum">${num}</div><div class="tlbl">${lbl}</div></div>`;
  tiles.innerHTML =
    tile(usd(c.totals.today), "today") +
    tile(usd(c.totals.last7), "last 7 days") +
    tile(usd(c.totals.month), "month to date") +
    tile(usd(c.totals.all), "all time") +
    tile(usd(c.cache_savings), "saved by caching");
  el.appendChild(tiles);

  if (c.days.length) {
    const max = Math.max(...c.days.map((d) => d.cost), 0.0001);
    const chart = document.createElement("div");
    chart.className = "chart";
    for (const d of c.days) {
      const bar = document.createElement("div");
      bar.className = "cbar";
      bar.style.height = Math.max(2, (d.cost / max) * 100) + "%";
      bar.title = d.day + ": " + usd(d.cost) + "\n" +
        Object.entries(d.by).map(([m, v]) => m + ": " + usd(v)).join("\n");
      chart.appendChild(bar);
    }
    el.appendChild(chart);
    const key = document.createElement("div");
    key.className = "chartkey";
    key.innerHTML = `<span>${esc(c.days[0].day)}</span>` +
      `<span>daily cost, last ${c.days.length} active days</span>` +
      `<span>${esc(c.days[c.days.length - 1].day)}</span>`;
    el.appendChild(key);
  }

  const table = (title, headers, rows) => {
    const h = document.createElement("h2");
    h.textContent = title;
    el.appendChild(h);
    const t = document.createElement("table");
    t.className = "itable";
    t.innerHTML = "<tr>" + headers.map((x) => `<th>${x}</th>`).join("") + "</tr>";
    for (const r of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = r;
      t.appendChild(tr);
    }
    el.appendChild(t);
  };

  table("by model", ["model", "cost", "input", "output", "cache read", "msgs"],
    c.by_model.map((m) =>
      `<td>${esc(m.model)}</td><td class="num">${usd(m.cost)}</td>` +
      `<td class="dim">${tokfmt(m.in)}</td><td class="dim">${tokfmt(m.out)}</td>` +
      `<td class="dim">${tokfmt(m.cacheR)}</td><td class="dim">${m.msgs}</td>`));

  if (c.by_project.length > 1)
    table("by project", ["project", "cost", "assistant msgs"],
      c.by_project.map((p) =>
        `<td>${esc(p.cwd.replace(/^\/(home|Users)\/[^\/]+/, "~"))}</td>` +
        `<td class="num">${usd(p.cost)}</td><td class="dim">${p.msgs}</td>`));

  if (c.unknown_models.length) {
    const b = document.createElement("div");
    b.className = "banner warn";
    b.textContent = "no list price known for: " + c.unknown_models.join(", ") +
      " — priced at opus-tier; override via 'pricing' in .claude-ui.json";
    el.appendChild(b);
  }
  const bar = document.createElement("div");
  bar.className = "bar";
  const rb = document.createElement("button");
  rb.className = "small";
  rb.textContent = "rescan transcripts";
  rb.onclick = () => renderCosts(true);
  bar.appendChild(rb);
  el.appendChild(bar);
}

async function renderDoctor(rerun) {
  const el = document.getElementById("doctorview");
  if (!DOCTOR || rerun) {
    el.innerHTML = '<div class="empty">running checks…</div>';
    try { DOCTOR = await api("/api/doctor"); }
    catch (e) {
      el.innerHTML = '<div class="banner warn">' + esc(e.message) + "</div>";
      return;
    }
    if (TAB !== "doctor") return;
    renderTabs();
  }
  el.innerHTML = "";
  const head = document.createElement("div");
  head.className = "sethead";
  const warns = DOCTOR.warns;
  const infos = DOCTOR.findings.length - warns;
  head.innerHTML =
    (DOCTOR.findings.length
      ? `<b>${warns}</b> warning${warns === 1 ? "" : "s"}, ${infos} note${infos === 1 ? "" : "s"}`
      : '<span style="color:var(--green)">✓ nothing to report</span>') +
    ` · checked at ${esc(DOCTOR.ts)}`;
  el.appendChild(head);
  const bar = document.createElement("div");
  bar.className = "bar";
  const rb = document.createElement("button");
  rb.className = "small";
  rb.textContent = "run again";
  rb.onclick = () => renderDoctor(true);
  bar.appendChild(rb);
  el.appendChild(bar);
  for (const f of DOCTOR.findings) {
    const row = document.createElement("div");
    row.className = "drow";
    row.innerHTML =
      `<span class="badge ${f.level === "warn" ? "warn" : "link"}">${f.level}</span>` +
      `<span class="badge group">${esc(f.area)}</span>` +
      `<span class="dmsg">${esc(f.msg)}</span>`;
    if (f.fix) {
      const b = document.createElement("button");
      b.className = "small danger";
      b.textContent = "fix";
      b.title = f.fix.action + " " + (f.fix.path || "");
      b.onclick = async () => {
        if (!(await mconfirm("apply fix", f.fix.action + ": " + (f.fix.path || ""), "fix"))) return;
        try {
          await api("/api/doctor-fix", f.fix);
          toast("fixed");
          renderDoctor(true);
        } catch (e) { toast(e.message, true); }
      };
      row.appendChild(b);
    }
    el.appendChild(row);
  }
}

// ------------------------------------------------------------- command palette

let PAL = null;

function palItems() {
  const out = [];
  for (const [t, d] of Object.entries(DATA.types || {}))
    for (const s of d.active || [])
      if (!s.broken)
        out.push({ kind: t.replace(/s$/, ""), label: s.name,
          hint: s.description || "",
          run: () => openItemEditor("active", s.name, null, t) });
  for (const t of allTabs())
    out.push({ kind: "go to", label: t,
      run: () => { TAB = t; location.hash = t; render(); } });
  for (const t of Object.keys(DATA.types || {}))
    out.push({ kind: "action", label: "new " + t.replace(/s$/, ""),
      run: () => { TAB = t; location.hash = t; render(); newItem(); } });
  out.push({ kind: "action", label: "toggle light/dark theme", run: toggleTheme });
  out.push({ kind: "action", label: "apply all mcp servers", run: () => mcpApply("*") });
  out.push({ kind: "action", label: "run doctor",
    run: () => { TAB = "doctor"; location.hash = TAB; render(); renderDoctor(true); } });
  out.push({ kind: "action", label: "rescan usage analytics",
    run: () => { TAB = "insight"; location.hash = TAB; render(); renderInsight(true); } });
  return out;
}

function fuzzy(q, s) {
  s = s.toLowerCase();
  let score = 0, i = 0;
  for (const ch of q) {
    const j = s.indexOf(ch, i);
    if (j < 0) return -1;
    score += (j === i ? 3 : 1) + (j === 0 ? 2 : 0);
    i = j + 1;
  }
  return score - s.length / 100;
}

function palMatches() {
  const q = PAL.q.trim().toLowerCase();
  if (!q) return PAL.items.slice(0, 12);
  return PAL.items
    .map((it) => ({ it, s: fuzzy(q, it.kind + " " + it.label) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 12)
    .map((x) => x.it);
}

function closePalette() {
  PAL = null;
  const p = document.getElementById("palette");
  p.hidden = true;
  p.innerHTML = "";
}

function openPalette() {
  PAL = { q: "", sel: 0, items: palItems() };
  const p = document.getElementById("palette");
  p.hidden = false;
  p.innerHTML = "";
  const box = document.createElement("div");
  box.className = "palbox";
  const inp = document.createElement("input");
  inp.placeholder = "jump to anything — items, tabs, actions…";
  const listEl = document.createElement("div");
  listEl.className = "pallist";
  const renderList = () => {
    const list = palMatches();
    listEl.innerHTML = "";
    if (!list.length) {
      listEl.innerHTML = '<div class="palempty">no matches</div>';
      return;
    }
    list.forEach((it, i) => {
      const row = document.createElement("div");
      row.className = "palrow" + (i === PAL.sel ? " sel" : "");
      row.innerHTML =
        `<span class="pk">${esc(it.kind)}</span>` +
        `<span class="pl">${esc(it.label)}</span>` +
        `<span class="ph">${esc(it.hint || "")}</span>`;
      row.onclick = () => { closePalette(); it.run(); };
      listEl.appendChild(row);
    });
  };
  inp.oninput = () => { PAL.q = inp.value; PAL.sel = 0; renderList(); };
  inp.onkeydown = (e) => {
    const list = palMatches();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      PAL.sel = Math.min(PAL.sel + 1, list.length - 1);
      renderList();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      PAL.sel = Math.max(PAL.sel - 1, 0);
      renderList();
    } else if (e.key === "Enter") {
      const it = list[PAL.sel];
      if (it) { closePalette(); it.run(); }
    } else if (e.key === "Escape") {
      closePalette();
    }
  };
  box.appendChild(inp);
  box.appendChild(listEl);
  p.onclick = (e) => { if (e.target === p) closePalette(); };
  p.appendChild(box);
  renderList();
  inp.focus();
}

function renderGroups() {
  const el = document.getElementById("groups");
  const gs = (DATA.types[TAB] || {}).group_info || [];
  if (!gs.length) { el.hidden = true; return; }
  el.hidden = false;
  el.textContent = "folders: ";
  for (const g of gs) {
    const chip = document.createElement("span");
    chip.className = "chip" + (g.collection ? " coll" : "");
    let warn = "";
    if (!g.members) warn = "empty";
    else if (g.incomplete) warn = g.incomplete + " missing SKILL.md";
    if (g.loose_files) warn += (warn ? ", " : "") + g.loose_files + " loose files";
    chip.innerHTML =
      esc(g.name) + "/ · " + g.members + (g.collection ? " (collection)" : "") +
      (warn ? ' <span class="warn">⚠ ' + esc(warn) + "</span>" : "") +
      (g.collection
        ? ` <a href="/api/export?collection=${encodeURIComponent(g.name)}"` +
          ` style="color:var(--blue)" title="export collection as zip">⤓</a>`
        : "") +
      (g.removable && !g.members && !g.loose_files
        ? ` <a href="#" onclick="removeGroup('${g.name}');return false" title="remove empty folder">×</a>`
        : "");
    el.appendChild(chip);
  }
}

let EDITING = null;

async function openEditor(id) {
  try {
    EDITING = await api("/api/file?id=" + encodeURIComponent(id));
    render();
  } catch (e) { toast(e.message, true); }
}

async function openItemEditor(scope, name, file, type) {
  const t = type || TAB;
  try {
    const q = "type=" + encodeURIComponent(t) + "&scope=" + encodeURIComponent(scope) +
      "&name=" + encodeURIComponent(name) +
      (file ? "&file=" + encodeURIComponent(file) : "");
    EDITING = { item: true, ...(await api("/api/item?" + q)) };
    render();
  } catch (e) { toast(e.message, true); }
}

// Minimal markdown renderer for the editor preview (headings, lists, code
// fences, inline code/bold/italic/links, blockquotes) — enough to sanity-check
// a SKILL.md without any dependency.
function md2html(src) {
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\*([^*]+)\*/g, "<i>$1</i>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  let html = "";
  let inCode = false, inList = null, para = [];
  const flushPara = () => {
    if (para.length) { html += "<p>" + para.map(inline).join(" ") + "</p>"; para = []; }
  };
  const closeList = () => {
    if (inList) { html += "</" + inList + ">"; inList = null; }
  };
  for (const line of src.split("\n")) {
    if (line.trim().startsWith("```")) {
      flushPara(); closeList();
      html += inCode ? "</code></pre>" : "<pre><code>";
      inCode = !inCode;
      continue;
    }
    if (inCode) { html += esc(line) + "\n"; continue; }
    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      flushPara(); closeList();
      const n = m[1].length;
      html += `<h${n}>${inline(m[2])}</h${n}>`;
    } else if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      flushPara(); closeList();
      html += "<hr>";
    } else if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) {
      flushPara();
      if (inList !== "ul") { closeList(); html += "<ul>"; inList = "ul"; }
      html += "<li>" + inline(m[1]) + "</li>";
    } else if ((m = line.match(/^\s*\d+\.\s+(.*)$/))) {
      flushPara();
      if (inList !== "ol") { closeList(); html += "<ol>"; inList = "ol"; }
      html += "<li>" + inline(m[1]) + "</li>";
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      flushPara(); closeList();
      html += "<blockquote>" + inline(m[1]) + "</blockquote>";
    } else if (!line.trim()) {
      flushPara(); closeList();
    } else {
      para.push(line);
    }
  }
  flushPara(); closeList();
  if (inCode) html += "</code></pre>";
  return html;
}

function edSync() {
  const ta = document.getElementById("fileeditor");
  if (ta) EDITING.content = ta.value;
}

async function edHistory() {
  edSync();
  try {
    const r = await api("/api/history", { path: EDITING.path });
    EDITING.hist = r.commits;
    if (!r.commits.length) toast("no git history for " + EDITING.path);
    render();
  } catch (e) { toast(e.message, true); }
}

async function edAssist() {
  edSync();
  const r = await modal({ title: "✨ ask claude",
    text: "runs `claude -p` locally with this file (uses your own Claude Code auth; can take a minute)",
    fields: [
      { id: "m", label: "task", type: "select", options: [
        { value: "improve", label: "improve — tighten description & triggers, return revised file" },
        { value: "review", label: "review — list concrete problems, no changes" },
        { value: "custom", label: "custom instruction…" }] },
      { id: "c", label: "custom instruction (for custom)",
        placeholder: "e.g. add a 'Use when' trigger list for CI debugging" }],
    ok: "run" });
  if (!r) return;
  toast("asking claude… (this can take a while)");
  try {
    const res = await api("/api/assist", { mode: r.m, custom: r.c,
      content: EDITING.content, path: EDITING.path });
    EDITING.assist = { text: res.result, replaces: res.replaces };
    render();
  } catch (e) { toast(e.message, true); }
}

function renderEditor() {
  const el = document.getElementById("editorview");
  const f = EDITING;
  el.innerHTML =
    `<div class="sethead">editing <b>${esc(f.path)}</b>` +
    (f.item
      ? (f.exists ? "" : " (new file — created on save)")
      : ` (source: ${f.source === "claude" ? "shared" : esc(f.source)}${f.exists ? "" : ", new file"})`) +
    (f.id === "CLAUDE.md" || f.id === "settings.json" ? " · applies to new sessions" : "") +
    (f.viewingRev ? ` <span class="warn">— viewing ${esc(f.viewingRev.slice(0, 8))} from git history; save to restore this version</span>` : "") +
    `</div>`;
  if (f.item && f.files && f.files.length > 1) {
    const tabs = document.createElement("div");
    tabs.className = "ftabs";
    for (const name of f.files) {
      const b = document.createElement("button");
      b.className = "small" + (name === f.file ? " on" : "");
      b.textContent = name;
      b.onclick = () => { openItemEditor(f.scope, f.name, name, f.type); };
      tabs.appendChild(b);
    }
    el.appendChild(tabs);
  }
  if (f.hist) {
    const hp = document.createElement("div");
    hp.className = "ftabs";
    for (const c of f.hist.slice(0, 12)) {
      const b = document.createElement("button");
      b.className = "small" + (f.viewingRev === c.rev ? " on" : "");
      b.textContent = c.date + " · " + c.subject.slice(0, 44);
      b.title = c.rev;
      b.onclick = async () => {
        try {
          const r = await api("/api/history-show", { rev: c.rev, path: f.path });
          f.content = r.content;
          f.viewingRev = c.rev;
          render();
        } catch (e) { toast(e.message, true); }
      };
      hp.appendChild(b);
    }
    const x = document.createElement("button");
    x.className = "small";
    x.textContent = "× close history";
    x.onclick = () => { edSync(); delete f.hist; delete f.viewingRev; render(); };
    hp.appendChild(x);
    el.appendChild(hp);
  }
  const isMd = (f.item ? f.file : f.path || "").endsWith(".md");
  if (f.preview && isMd) {
    const pv = document.createElement("div");
    pv.className = "mdprev";
    pv.innerHTML = md2html(f.content || "");
    el.appendChild(pv);
  } else {
    const ta = document.createElement("textarea");
    ta.id = "fileeditor";
    ta.rows = 24;
    ta.className = "fedit";
    ta.value = f.content;
    ta.oninput = () => { f.content = ta.value; };
    el.appendChild(ta);
  }
  if (f.assist) {
    const ap = document.createElement("div");
    ap.className = "assistout";
    ap.textContent = f.assist.text;
    el.appendChild(ap);
    const abar = document.createElement("div");
    abar.className = "bar";
    abar.style.marginTop = ".5rem";
    if (f.assist.replaces) {
      const use = document.createElement("button");
      use.className = "small primary";
      use.textContent = "use result";
      use.onclick = () => {
        f.content = f.assist.text;
        delete f.assist;
        render();
      };
      abar.appendChild(use);
    }
    const dis = document.createElement("button");
    dis.className = "small";
    dis.textContent = "dismiss";
    dis.onclick = () => { edSync(); delete f.assist; render(); };
    abar.appendChild(dis);
    el.appendChild(abar);
  }
  const bar = document.createElement("div");
  bar.className = "bar";
  bar.style.marginTop = ".75rem";
  const btn = (label, fn, cls, title) => {
    const b = document.createElement("button");
    b.textContent = label;
    if (cls) b.className = cls;
    if (title) b.title = title;
    b.onclick = fn;
    bar.appendChild(b);
    return b;
  };
  btn("save", saveFile, "primary");
  if (isMd)
    btn(f.preview ? "edit" : "preview", () => {
      edSync();
      f.preview = !f.preview;
      render();
    }, f.preview ? "small on" : "small");
  btn("history", edHistory, "small", "git history of this file — view & restore old versions");
  btn("✨ assist", edAssist, "small", "ask Claude (via the claude CLI) to improve or review this file");
  btn("close", closeEditor);
  el.appendChild(bar);
}

async function saveFile() {
  edSync();
  const content = EDITING.content;
  try {
    if (EDITING.item) {
      await api("/api/item-save", { type: EDITING.type, scope: EDITING.scope,
        name: EDITING.name, file: EDITING.file, content });
    } else {
      await api("/api/file-save", { id: EDITING.id, content });
    }
    toast(EDITING.path + " saved");
    EDITING.exists = true;
    if (EDITING.viewingRev) {
      delete EDITING.viewingRev;
      render();
    }
    if (EDITING.item && EDITING.files && !EDITING.files.includes(EDITING.file))
      EDITING.files.push(EDITING.file);
  } catch (e) { toast(e.message, true); }
}

function closeEditor() {
  EDITING = null;
  refresh();
}

function render() {
  closeMenu();
  renderLinks();
  renderGit();
  renderTabs();
  const views = { settings: "settingsview", mcp: "mcpview", statusline: "stlview",
    insight: "insightview", costs: "costsview", doctor: "doctorview" };
  const isEditor = !!EDITING;
  document.getElementById("editorview").hidden = !isEditor;
  if (isEditor) {
    document.getElementById("itemsview").hidden = true;
    for (const v of Object.values(views)) document.getElementById(v).hidden = true;
    renderEditor();
    return;
  }
  for (const [t, v] of Object.entries(views))
    document.getElementById(v).hidden = TAB !== t;
  document.getElementById("itemsview").hidden = TAB in views;
  if (TAB === "settings") { renderSettings(); return; }
  if (TAB === "mcp") { renderMcp(); return; }
  if (TAB === "statusline") { renderStatusline(); return; }
  if (TAB === "insight") { renderInsight(); return; }
  if (TAB === "costs") { renderCosts(); return; }
  if (TAB === "doctor") { renderDoctor(); return; }
  renderGroups();
  const q = document.getElementById("q").value.toLowerCase();
  const data = DATA.types[TAB] || { active: [], archived: [] };
  for (const scope of ["active", "archived"]) {
    const items = data[scope].filter(
      (s) => !q || s.name.toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q)
    );
    items.sort(SORT === "recent"
      ? (a, b) => (b.mtime || 0) - (a.mtime || 0)
      : (a, b) => a.name.localeCompare(b.name));
    document.getElementById("n-" + scope).textContent = "· " + data[scope].length;
    const box = document.getElementById(scope);
    box.innerHTML = "";
    if (!items.length) {
      box.innerHTML = '<div class="empty">' + (q ? "no matches" : "nothing here") + "</div>";
      continue;
    }
    for (const s of items) {
      const row = document.createElement("div");
      row.className = "row " + scope;
      const badges =
        (s.group ? `<span class="badge group">${esc(s.group)}/</span>` : "") +
        (s.local ? '<span class="badge local">gitignored</span>' : "") +
        (s.symlink && !s.managed ? '<span class="badge link">symlink</span>' : "") +
        (s.broken ? '<span class="badge warn">broken</span>' : "") +
        (s.incomplete && !s.broken ? '<span class="badge warn">no SKILL.md</span>' : "") +
        (s.todo ? '<span class="badge warn" title="leftover TODO placeholder inside">TODO</span>' : "") +
        (s.name_mismatch ? '<span class="badge warn" title="frontmatter name: does not match the folder name">name≠dir</span>' : "") +
        (s.long_desc ? '<span class="badge warn" title="description over 1024 characters — may be truncated">long desc</span>' : "");
      row.innerHTML =
        `<span class="name" title="${esc(s.path || "")}">${esc(s.name)}</span>` + badges +
        `<span class="desc">${esc(s.description || "")}</span>`;
      const key = scope + "\t" + s.name;
      const ck = document.createElement("input");
      ck.type = "checkbox";
      ck.title = "select for bulk actions";
      ck.checked = BULK.has(key);
      ck.onchange = () => {
        if (ck.checked) BULK.add(key);
        else BULK.delete(key);
        renderBulkBar();
      };
      row.prepend(ck);
      const act = document.createElement("span");
      act.className = "actions";
      const btn = (label, fn, cls, title) => {
        const b = document.createElement("button");
        b.textContent = label;
        if (cls) b.className = cls;
        if (title) b.title = title;
        b.onclick = fn;
        act.appendChild(b);
      };
      if (!s.broken) btn("edit", () => openItemEditor(scope, s.name));
      const entries = [];
      if (s.movable) {
        entries.push({ label: "move…", fn: () => moveToGroup(s.name) });
        entries.push({ label: "rename…", fn: () => renameItem(s.name) });
        entries.push({ label: "duplicate…", fn: () => duplicateItem(s.name) });
      }
      if (!s.broken)
        entries.push({ label: "export zip", fn: () => {
          location.href = "/api/export?type=" + encodeURIComponent(TAB) +
            "&scope=" + scope + "&name=" + encodeURIComponent(s.name);
        } });
      entries.push(scope === "active"
        ? { label: "archive", fn: () => doAct("archive", s.name) }
        : { label: "restore", fn: () => doAct("restore", s.name) });
      entries.push({ label: "delete…", danger: true,
        fn: () => doDelete(scope, s.name, s.managed) });
      btn("⋯", (e) => { e.stopPropagation(); openMenu(e.currentTarget, entries); },
        null, "move, rename, duplicate, export, archive, delete");
      row.appendChild(act);
      box.appendChild(row);
    }
  }
  renderBulkBar();
}

const BULK = new Set();

function renderBulkBar() {
  const el = document.getElementById("bulkbar");
  el.hidden = BULK.size === 0;
  el.innerHTML = "";
  if (!BULK.size) return;
  const lbl = document.createElement("span");
  lbl.style.cssText = "align-self:center;font-size:.8rem;color:var(--fg2)";
  lbl.textContent = BULK.size + " selected";
  el.appendChild(lbl);
  const btn = (label, fn, cls) => {
    const b = document.createElement("button");
    b.className = "small" + (cls ? " " + cls : "");
    b.textContent = label;
    b.onclick = fn;
    el.appendChild(b);
  };
  const parts = () => [...BULK].map((k) => {
    const i = k.indexOf("\t");
    return { scope: k.slice(0, i), name: k.slice(i + 1) };
  });
  const run = async (fn, done) => {
    let ok = 0, fail = 0;
    for (const p of parts()) {
      try { await fn(p); ok++; }
      catch (e) { fail++; toast(p.name + ": " + e.message, true); }
    }
    BULK.clear();
    toast(done + " " + ok + " item(s)" + (fail ? ", " + fail + " failed" : ""), !!fail);
    await refresh();
  };
  btn("archive", () => run(async (p) => {
    if (p.scope === "active") await api("/api/archive", { type: TAB, name: p.name });
  }, "archived"));
  btn("restore", () => run(async (p) => {
    if (p.scope === "archived") await api("/api/restore", { type: TAB, name: p.name });
  }, "restored"));
  btn("delete", async () => {
    if (!(await mconfirm("delete " + BULK.size + " item(s)",
      "All moved to archive/trash (undoable via doctor until purged).", "delete"))) return;
    run((p) => api("/api/delete", { type: TAB, scope: p.scope, name: p.name }), "deleted");
  }, "danger");
  btn("clear", () => { BULK.clear(); render(); });
}

async function refresh() {
  DATA = await api("/api/state");
  if (!EXTRA_TABS.includes(TAB) && !DATA.types[TAB]) TAB = Object.keys(DATA.types)[0];
  render();
}

async function doAct(action, name) {
  try {
    await api("/api/" + action, { type: TAB, name });
    toast(name + (action === "archive" ? " → archive/" : " restored"));
    await refresh();
  } catch (e) { toast(e.message, true); }
}

async function moveToGroup(name) {
  const gs = (DATA.types[TAB] || {}).groups || [];
  const fields = [{ id: "g", label: "into folder / collection", type: "select",
    options: [{ value: "", label: "(top level)" },
      ...gs.map((g) => ({ value: g, label: g + "/" }))] }];
  if (TAB !== "skills")
    fields.push({ id: "n", label: "…or a new folder",
      placeholder: "leave empty to use the pick above" });
  const r = await modal({ title: "move " + name, fields, ok: "move" });
  if (r === null) return;
  try {
    const res = await api("/api/move", { type: TAB, name, group: r.n || r.g || "" });
    toast(name + " → " + res.name);
    await refresh();
  } catch (e) { toast(e.message, true); }
}

async function renameItem(name) {
  const r = await modal({ title: "rename " + name,
    text: TAB === "skills"
      ? "a '<group>-' prefix files it into that group"
      : "use folder/name to move it while renaming",
    fields: [{ id: "n", label: "new name", value: name }], ok: "rename" });
  if (!r || !r.n || r.n === name) return;
  try {
    const res = await api("/api/rename", { type: TAB, name, new_name: r.n });
    toast(name + " → " + res.name);
    await refresh();
  } catch (e) { toast(e.message, true); }
}

async function duplicateItem(name) {
  const r = await modal({ title: "duplicate " + name,
    fields: [{ id: "n", label: "copy's name", value: name + "-copy" }],
    ok: "duplicate" });
  if (!r || !r.n) return;
  try {
    const res = await api("/api/duplicate", { type: TAB, name, new_name: r.n });
    toast(name + " copied to " + res.name);
    await refresh();
  } catch (e) { toast(e.message, true); }
}

async function importUrl() {
  const r = await modal({ title: "import from GitHub",
    text: "repo root, branch, or subdir URL — a config-shaped repo (skills/, commands/, CLAUDE.md…) imports as a collection",
    fields: [
      { id: "u", label: "URL",
        placeholder: "https://github.com/owner/repo[/tree/branch[/subdir]]" },
      { id: "n", label: TAB === "skills"
        ? "import as (skill / group / collection name)"
        : "import into (folder or collection name)" }],
    ok: "import" });
  if (!r || !r.u || !r.n) return;
  toast("downloading " + r.u + "…");
  try {
    const res = await api("/api/import-url", { url: r.u, name: r.n, type: TAB });
    toast("imported " + res.kind + " " + res.path + " (" + res.files + " files)");
    await refresh();
  } catch (e) { toast(e.message, true); }
}

async function genBootstrap() {
  try {
    const r = await api("/api/bootstrap", {});
    toast(r.path + " written — commit it; on a new machine, clone + ./bootstrap.sh links everything and applies MCP servers");
  } catch (e) { toast(e.message, true); }
}

async function newGroup() {
  const r = await modal({ title: "new folder", text: "'work' stays out of git",
    fields: [{ id: "n", label: "name" }], ok: "create" });
  if (!r || !r.n) return;
  try {
    await api("/api/group", { type: TAB, name: r.n });
    toast(r.n + "/ created — use move to file items into it");
    await refresh();
  } catch (e) { toast(e.message, true); }
}

async function removeGroup(name) {
  try {
    await api("/api/group-remove", { type: TAB, name });
    toast(name + "/ removed");
    await refresh();
  } catch (e) { toast(e.message, true); }
}

async function doDelete(scope, name, managed) {
  const msg = managed
    ? "Deletes " + name + " and the files inside its folder (moved to archive/trash, undoable)."
    : "Deletes " + name + " (moved to archive/trash, undoable; a symlink's target is untouched).";
  if (!(await mconfirm("delete " + name, msg, "delete"))) return;
  try {
    const res = await api("/api/delete", { type: TAB, scope, name });
    if (res.trash) {
      toast(name + " deleted", false, { label: "undo", fn: async () => {
        try {
          await api("/api/undelete", { token: res.trash });
          toast(name + " restored");
          await refresh();
        } catch (e) { toast(e.message, true); }
      } });
    } else {
      toast(name + " deleted");
    }
    await refresh();
  } catch (e) { toast(e.message, true); }
}

async function newItem() {
  const hint = TAB === "skills"
    ? "kebab-case; a '<group>-' prefix files it in that group; 'work-' stays out of git"
    : "use folder/name for nesting; work/ stays out of git";
  const r = await modal({ title: "new " + TAB.replace(/s$/, ""), text: hint,
    fields: [{ id: "n", label: "name" }], ok: "create" });
  if (!r || !r.n) return;
  try {
    const res = await api("/api/new", { type: TAB, name: r.n });
    toast("created " + res.path);
    await refresh();
  } catch (e) { toast(e.message, true); }
}

async function encodeFiles(files, stripRoot) {
  const payload = [];
  for (const f of files) {
    const rel = stripRoot
      ? f.webkitRelativePath.split("/").slice(1).join("/")
      : f.name;
    if (!rel) continue;
    const buf = new Uint8Array(await f.arrayBuffer());
    let bin = "";
    for (const b of buf) bin += String.fromCharCode(b);
    payload.push({ path: rel, content_b64: btoa(bin) });
  }
  return payload;
}

const COLLECTION_MARKS = ["skills/", "commands/", "agents/"];
const CONFIG_FILE_NAMES = ["CLAUDE.md", "settings.json", "keybindings.json"];

async function uploadItems(ev) {
  const files = [...ev.target.files].filter(
    (f) => !/(^|\/)(\.git|node_modules)(\/|$)|(^|\/)\.DS_Store$/.test(f.webkitRelativePath)
  );
  ev.target.value = "";
  if (!files.length) return;
  const root = files[0].webkitRelativePath.split("/")[0];
  const rels = files.map((f) => f.webkitRelativePath.split("/").slice(1).join("/"));
  const isCollection = rels.some((r) =>
    COLLECTION_MARKS.some((m) => r.startsWith(m)) || CONFIG_FILE_NAMES.includes(r));
  if (isCollection) {
    const m = await modal({ title: "import collection",
      text: "this folder looks like a whole Claude config — 'work' stays out of git",
      fields: [{ id: "n", label: "import as", value: root }], ok: "import" });
    if (!m || !m.n) return;
    try {
      const payload = await encodeFiles(files, true);
      const r = await api("/api/upload-collection", { name: m.n, files: payload });
      toast("imported collection " + r.path + "/ — " +
        r.skills + " skills, " + r.commands + " commands, " + r.agents + " agents" +
        (r.config_files.length ? ", files: " + r.config_files.join(", ") : ""));
      await refresh();
    } catch (e) { toast(e.message, true); }
    return;
  }
  const m = await modal({ title: "import " + TAB,
    text: TAB === "skills" ? "a folder of skills becomes a group" : undefined,
    fields: [{ id: "n",
      label: TAB === "skills" ? "import as" : "into folder (blank = top level)",
      value: TAB === "skills" ? root : "" }], ok: "import" });
  if (m === null) return;
  try {
    const payload = await encodeFiles(files, true);
    const r = await api("/api/upload", { type: TAB, name: m.n, files: payload });
    toast(r.kind === "group"
      ? "imported " + r.path + "/ as a group — " + r.skills + " skill" + (r.skills === 1 ? "" : "s") + " linked"
      : "imported " + (r.path || TAB) + " (" + r.files + " files)");
    await refresh();
  } catch (e) { toast(e.message, true); }
}

async function uploadFiles(ev) {
  const files = [...ev.target.files];
  ev.target.value = "";
  if (!files.length) return;
  const m = await modal({ title: "add files",
    text: TAB === "skills"
      ? "an existing skill name, or a new one (a lone .md becomes its SKILL.md)"
      : undefined,
    fields: [{ id: "n",
      label: TAB === "skills" ? "into skill" : "into folder (blank = top level)" }],
    ok: "add" });
  if (m === null) return;
  try {
    const payload = await encodeFiles(files, false);
    const ep = TAB === "skills" ? "/api/upload-files" : "/api/upload";
    const r = await api(ep, { type: TAB, name: m.n, files: payload });
    toast(r.created
      ? "created " + r.path + " (" + r.files + " files)"
      : "added " + r.files + " file" + (r.files === 1 ? "" : "s") + " to " + (r.path || TAB));
    await refresh();
  } catch (e) { toast(e.message, true); }
}

document.getElementById("up").addEventListener("change", uploadItems);
document.getElementById("upf").addEventListener("change", uploadFiles);
document.getElementById("q").addEventListener("input", render);
document.getElementById("themebtn").addEventListener("click", toggleTheme);
document.getElementById("sortsel").addEventListener("change", (e) => {
  SORT = e.target.value;
  render();
});

// Keyboard: Ctrl/Cmd+K palette, "/" focuses the filter, Escape closes
// editor/menu, 1-9 switch tabs.
document.addEventListener("keydown", (e) => {
  if (!document.getElementById("modal").hidden) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (PAL) closePalette();
    else openPalette();
    return;
  }
  if (PAL) return;  // the palette input handles its own keys
  const tag = e.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    if (e.key === "Escape") e.target.blur();
    return;
  }
  if (e.key === "/") {
    if (EDITING || EXTRA_TABS.includes(TAB)) return;
    e.preventDefault();
    document.getElementById("q").focus();
  } else if (e.key === "Escape") {
    closeMenu();
    if (EDITING) closeEditor();
  } else if (e.key >= "1" && e.key <= "9" && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const t = allTabs()[+e.key - 1];
    if (t) { TAB = t; location.hash = t; render(); }
  }
});

// Live reload: poll a cheap server-side fingerprint; refresh when files change
// externally (another editor, a running Claude session). Paused while typing,
// editing, or any overlay is open.
let FP = null;
setInterval(async () => {
  if (document.hidden || EDITING || PAL) return;
  if (!document.getElementById("modal").hidden) return;
  if (document.getElementById("menu")) return;
  const ae = document.activeElement;
  if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.tagName === "SELECT")) return;
  try {
    const r = await fetch("/api/fingerprint");
    if (!r.ok) return;
    const j = await r.json();
    if (FP !== null && j.fp !== FP) {
      FP = j.fp;
      await refresh();
    } else {
      FP = j.fp;
    }
  } catch (e) { /* server briefly unavailable — retry next tick */ }
}, 4000);

refresh();
