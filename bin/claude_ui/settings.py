"""settings.json schema + editing, and lifecycle hooks (incl. test-fire)."""

from pathlib import Path
import json
import re
import subprocess

from .core import CONFIG_FILES, atomic_write, config_dir, tilde


# User-scope settings.json keys, from https://code.claude.com/docs/en/settings
# and .scratch/claude-code-config-research/ (docs snapshot 2026-07-22).
#
# Control types the frontend understands:
#   bool             true/false dropdown (three-state with unset)
#   number           numeric input
#   string           free text input
#   enum             fixed-choice dropdown; requires "values"
#   combo            free text with suggested "values" (datalist); freeform still allowed
#   list             one-value-per-row editor; optional "item_values" suggestions per row
#   kv               key/value row editor. Optional "value_type": "number" for numeric
#                    values, or "values" to make each value a dropdown.
#   object           declared-field mini form; requires "fields":
#                    [{"key", "type", "values"?, "desc"?, "const"?}]. A field with
#                    "const" is always written and gets no input (e.g. type: "command").
#   json             raw-JSON textarea, for deeply nested / rarely-edited configs.
MODEL_ALIASES = ["default", "best", "fable", "sonnet", "opus", "haiku",
                 "sonnet[1m]", "opus[1m]", "opusplan", "opusplan[1m]"]
LANGS = ["en", "ja", "fr", "es", "de", "zh", "ko", "pt", "it", "ru"]

SETTINGS_SCHEMA = [
    {"key": "model", "type": "combo", "values": MODEL_ALIASES, "cat": "model",
     "desc": "Model for the main session — alias (opus, sonnet, haiku…) or full model ID; read at startup"},
    {"key": "fallbackModel", "type": "list", "item_values": MODEL_ALIASES, "cat": "model",
     "desc": "Fallback model chain tried in order on overload, max 3 models"},
    {"key": "effortLevel", "type": "enum", "values": ["low", "medium", "high", "xhigh"], "cat": "model",
     "desc": "Persist reasoning effort level across sessions"},
    {"key": "alwaysThinkingEnabled", "type": "bool", "cat": "model",
     "desc": "Enable extended thinking by default"},
    {"key": "thinkingBudgetTokens", "type": "number", "cat": "model",
     "desc": "Token budget for extended thinking when always-thinking is on"},
    {"key": "advisorModel", "type": "combo", "values": ["opus", "sonnet", "haiku"], "cat": "model",
     "desc": "Model for the server-side advisor tool; unset to disable"},
    {"key": "fastMode", "type": "bool", "cat": "model",
     "desc": "Enable fast mode for sessions where available"},
    {"key": "fastModePerSessionOptIn", "type": "bool", "cat": "model",
     "desc": "Require per-session opt-in for fast mode"},

    {"key": "permissions.defaultMode", "type": "enum", "cat": "permissions",
     "values": ["default", "acceptEdits", "plan", "auto", "dontAsk", "bypassPermissions", "manual"],
     "desc": "Startup permission mode: prompt on first use / auto-accept edits / read-only plan / auto with safety checks / deny unless pre-approved / skip prompts / manual (alias of default)"},
    {"key": "permissions.allow", "type": "list", "cat": "permissions",
     "desc": "Rules to auto-approve, e.g. Bash(npm run test *)"},
    {"key": "permissions.ask", "type": "list", "cat": "permissions",
     "desc": "Rules that always require confirmation"},
    {"key": "permissions.deny", "type": "list", "cat": "permissions",
     "desc": "Rules to block, e.g. Read(./.env)"},
    {"key": "permissions.additionalDirectories", "type": "list", "cat": "permissions",
     "desc": "Extra directories Claude may access (like --add-dir)"},
    {"key": "permissions.disableBypassPermissionsMode", "type": "enum", "values": ["disable"], "cat": "permissions",
     "desc": "Set to 'disable' to prevent bypassPermissions mode"},

    {"key": "env", "type": "kv", "cat": "environment & hooks",
     "desc": "Environment variables applied to every session and subprocess"},
    {"key": "hooks", "type": "json", "cat": "environment & hooks",
     "desc": "Lifecycle hooks — use the hooks builder above; edit here only for non-standard shapes"},
    {"key": "disableAllHooks", "type": "bool", "cat": "environment & hooks",
     "desc": "Disable all hooks and custom status line"},
    {"key": "statusLine", "type": "object", "cat": "environment & hooks",
     "desc": "Custom status line: a command whose first stdout line is the status line",
     "fields": [
         {"key": "type", "const": "command"},
         {"key": "command", "type": "string", "desc": "command run each refresh, e.g. ~/.claude/statusline.sh"},
         {"key": "padding", "type": "number", "desc": "leading spaces (0 hugs the edge)"},
         {"key": "refreshInterval", "type": "number", "desc": "refresh interval in ms"},
         {"key": "hideVimModeIndicator", "type": "bool", "desc": "hide the vim mode indicator"},
     ]},

    {"key": "editorMode", "type": "enum", "values": ["normal", "vim"], "default": "normal", "cat": "interface",
     "desc": "Key binding mode for the input prompt"},
    {"key": "tui", "type": "enum", "values": ["default", "fullscreen"], "cat": "interface",
     "desc": "TUI renderer mode"},
    {"key": "theme", "type": "combo", "cat": "interface",
     "values": ["auto", "dark", "light", "dark-daltonized", "light-daltonized", "dark-ansi", "light-ansi"],
     "desc": "Color theme (or custom:<slug> for a themes/ file)"},
    {"key": "interfaceLanguage", "type": "combo", "values": LANGS, "cat": "interface",
     "desc": "Interface language, e.g. en, ja, fr"},
    {"key": "language", "type": "combo", "values": LANGS, "cat": "interface",
     "desc": "Preferred language for Claude's responses"},
    {"key": "outputStyle", "type": "combo", "values": ["default", "Explanatory", "Learning"], "cat": "interface",
     "desc": "Output rendering style (read at startup); your installed styles are suggested"},
    {"key": "preferredNotifChannel", "type": "enum", "cat": "interface", "default": "auto",
     "values": ["auto", "terminal_bell", "iterm2", "iterm2_with_bell", "kitty", "ghostty", "notifications_disabled"],
     "desc": "How desktop notifications are delivered"},
    {"key": "viewMode", "type": "enum", "values": ["default", "verbose", "focus"], "cat": "interface",
     "desc": "Startup transcript view mode"},
    {"key": "spinnerTipsEnabled", "type": "bool", "default": True, "cat": "interface",
     "desc": "Show tips while waiting for the model"},
    {"key": "autoScrollEnabled", "type": "bool", "default": True, "cat": "interface",
     "desc": "Follow new output to the bottom in fullscreen rendering"},
    {"key": "strikethrough", "type": "bool", "default": True, "cat": "interface",
     "desc": "Show strikethrough for deleted text"},
    {"key": "awaySummaryEnabled", "type": "bool", "default": True, "cat": "interface",
     "desc": "One-line session recap when returning after time away"},
    {"key": "interactiveEditingEnabled", "type": "bool", "default": True, "cat": "interface",
     "desc": "Inline editing UI for applying changes"},
    {"key": "askUserQuestionTimeout", "type": "enum", "values": ["60s", "5m", "10m", "never"],
     "default": "never", "cat": "interface",
     "desc": "Idle time before unanswered question dialogs auto-continue"},
    {"key": "axScreenReader", "type": "bool", "cat": "interface",
     "desc": "Screen-reader friendly flat text output"},
    {"key": "showHiddenFiles", "type": "bool", "default": False, "cat": "interface",
     "desc": "Show hidden files in file operations"},
    {"key": "keyBindings", "type": "json", "cat": "interface",
     "desc": "Custom keybindings for the input prompt"},
    {"key": "fileSuggestion", "type": "object", "cat": "interface",
     "desc": "Custom script for @-file autocomplete",
     "fields": [
         {"key": "type", "const": "command"},
         {"key": "command", "type": "string", "desc": "command that emits candidate paths"},
     ]},

    {"key": "attribution.commit", "type": "string", "cat": "git",
     "desc": "Custom commit attribution string (empty string hides it)"},
    {"key": "attribution.pr", "type": "string", "cat": "git",
     "desc": "Custom PR attribution string (empty string hides it)"},
    {"key": "attribution.sessionUrl", "type": "bool", "default": True, "cat": "git",
     "desc": "Append a Claude-Session trailer from web/Remote Control sessions"},
    {"key": "gitAttributionName", "type": "string", "cat": "git",
     "desc": "Name for commits/PRs when different from git config"},
    {"key": "gitAttributionEmail", "type": "string", "cat": "git",
     "desc": "Email for commits/PRs when different from git config"},
    {"key": "includeCoAuthoredBy", "type": "bool", "cat": "git",
     "desc": "Co-authored-by trailer in commits (older versions; superseded by attribution)"},

    {"key": "autoMemoryEnabled", "type": "bool", "default": True, "cat": "memory & context",
     "desc": "Auto memory: Claude reads and writes its memory directory"},
    {"key": "autoMemoryDirectory", "type": "string", "cat": "memory & context",
     "desc": "Custom auto-memory directory (absolute or ~/ path)"},
    {"key": "claudeMdExcludes", "type": "list", "cat": "memory & context",
     "desc": "Glob patterns of CLAUDE.md files to skip"},
    {"key": "autoCompactEnabled", "type": "bool", "default": True, "cat": "memory & context",
     "desc": "Auto-compact conversation near the context limit"},
    {"key": "maxCompactMessages", "type": "number", "cat": "memory & context",
     "desc": "Max messages to compact in one operation"},
    {"key": "sessionHistorySize", "type": "number", "cat": "memory & context",
     "desc": "Max messages retained in session history"},
    {"key": "cleanupPeriodDays", "type": "number", "default": 30, "cat": "memory & context",
     "desc": "Days before session files auto-delete (min 1)"},

    {"key": "enableAllProjectMcpServers", "type": "bool", "cat": "mcp & plugins",
     "desc": "Auto-approve every MCP server in project .mcp.json"},
    {"key": "enabledMcpjsonServers", "type": "list", "cat": "mcp & plugins",
     "desc": "Specific .mcp.json servers to approve"},
    {"key": "disabledMcpjsonServers", "type": "list", "cat": "mcp & plugins",
     "desc": "Specific .mcp.json servers to reject"},
    {"key": "mcpServerTimeouts", "type": "kv", "value_type": "number", "cat": "mcp & plugins",
     "desc": "Per-server startup timeout in seconds, e.g. github → 30"},
    {"key": "pluginMarketplaces", "type": "list", "cat": "mcp & plugins",
     "desc": "Custom plugin marketplace sources"},
    {"key": "skillOverrides", "type": "kv", "cat": "mcp & plugins",
     "values": ["on", "name-only", "user-invocable-only", "off"],
     "desc": "Per-skill visibility override (skill name → visibility)"},
    {"key": "disableBundledSkills", "type": "bool", "cat": "mcp & plugins",
     "desc": "Disable bundled skills and workflows"},
    {"key": "disableClaudeAiConnectors", "type": "bool", "cat": "mcp & plugins",
     "desc": "Disable auto-fetch of claude.ai MCP connectors"},

    {"key": "sandbox", "type": "json", "cat": "sandbox & security",
     "desc": "Sandbox config: {\"enabled\": true, \"filesystem\": {...}, \"network\": {...}}"},
    {"key": "warningOnSandboxEscape", "type": "bool", "default": True, "cat": "sandbox & security",
     "desc": "Warn when processes escape the sandbox"},
    {"key": "disableSkillShellExecution", "type": "bool", "cat": "sandbox & security",
     "desc": "Disable inline shell execution in skills/commands"},
    {"key": "invalidSSLWarning", "type": "bool", "cat": "sandbox & security",
     "desc": "Warn about self-signed certificates"},
    {"key": "apiKeyHelper", "type": "string", "cat": "sandbox & security",
     "desc": "Command generating an auth value (sent as X-Api-Key / Authorization)"},
    {"key": "awsAuthRefresh", "type": "string", "cat": "sandbox & security",
     "desc": "Script refreshing AWS credentials (.aws directory)"},
    {"key": "awsCredentialExport", "type": "string", "cat": "sandbox & security",
     "desc": "Script printing JSON with AWS credentials"},
    {"key": "proxy", "type": "json", "cat": "sandbox & security",
     "desc": "HTTP proxy configuration"},
    {"key": "autoMode", "type": "json", "cat": "sandbox & security",
     "desc": "Auto-mode classifier rules: environment/allow/soft_deny/hard_deny arrays"},

    {"key": "autoUpdatesChannel", "type": "enum", "values": ["latest", "stable"],
     "default": "latest", "cat": "system",
     "desc": "Release channel for auto-updates"},
    {"key": "defaultShell", "type": "enum", "values": ["bash", "powershell"], "cat": "system",
     "desc": "Shell for input-box ! commands"},
    {"key": "teammateMode", "type": "enum", "values": ["in-process", "auto", "tmux", "iterm2"],
     "default": "in-process", "cat": "system",
     "desc": "How agent-team members are displayed"},
    {"key": "restartOnConfigChange", "type": "bool", "cat": "system",
     "desc": "Restart session when config files change"},
    {"key": "telemetryEnabled", "type": "bool", "cat": "system",
     "desc": "Telemetry collection"},
    {"key": "verboseLogging", "type": "bool", "default": False, "cat": "system",
     "desc": "Verbose logging output"},
    {"key": "fileCheckpointingEnabled", "type": "bool", "default": True, "cat": "system",
     "desc": "Snapshot files before edits for /rewind"},
    {"key": "workspaceInitScript", "type": "string", "cat": "system",
     "desc": "Script run when opening a new workspace"},
    {"key": "skipFirstRunQuestions", "type": "bool", "cat": "system",
     "desc": "Skip first-run setup questions"},
    {"key": "ignoreGitignore", "type": "bool", "cat": "system",
     "desc": "Ignore .gitignore when searching files"},
    {"key": "llmConnectionTimeout", "type": "number", "cat": "system",
     "desc": "Model connection timeout (seconds)"},
    {"key": "llmRequestTimeout", "type": "number", "cat": "system",
     "desc": "Overall model request timeout (seconds)"},
    {"key": "feedbackSurveyRate", "type": "number", "cat": "system",
     "desc": "Probability 0–1 of the session quality survey"},
    {"key": "disableAgentView", "type": "bool", "cat": "system",
     "desc": "Disable background agents, agent view, supervisor"},
    {"key": "disableArtifact", "type": "bool", "cat": "system",
     "desc": "Disable the Artifact tool (publishes to claude.ai)"},
    {"key": "disableRemoteControl", "type": "bool", "cat": "system",
     "desc": "Disable Remote Control"},
    {"key": "disableWorkflows", "type": "bool", "default": False, "cat": "system",
     "desc": "Disable dynamic workflows and bundled workflow commands"},
    {"key": "agentPushNotifEnabled", "type": "bool", "default": False, "cat": "system",
     "desc": "Proactive push notifications when Remote Control is connected"},
    {"key": "worktree.baseRef", "type": "enum", "values": ["fresh", "head"], "cat": "system",
     "desc": "Base ref for new worktrees: clean tree or current HEAD"},
    {"key": "worktree.bgIsolation", "type": "enum", "values": ["worktree", "none"], "cat": "system",
     "desc": "Isolate background agents in their own worktree"},
]

# dedupe (keep first occurrence)
_seen = set()

SETTINGS_SCHEMA = [s for s in SETTINGS_SCHEMA
                   if not (s["key"] in _seen or _seen.add(s["key"]))]

SETTINGS_KEY_RE = re.compile(r"^[A-Za-z0-9_$][A-Za-z0-9_.$-]*$")

def settings_state():
    path = config_dir() / "settings.json"
    st = {"path": tilde(path), "exists": path.is_file(), "data": {}, "error": None}
    if path.is_file():
        try:
            data = json.loads(path.read_text())
            if isinstance(data, dict):
                st["data"] = data
            else:
                st["error"] = "top level is not a JSON object"
        except json.JSONDecodeError as e:
            st["error"] = str(e)
    return st

def file_read(mid):
    if mid not in CONFIG_FILES:
        raise ValueError("not an editable config file")
    path = config_dir() / mid
    return {"id": mid, "path": tilde(path), "exists": path.is_file(),
            "content": path.read_text(errors="replace") if path.is_file() else ""}

def file_save(mid, content):
    if mid not in CONFIG_FILES:
        raise ValueError("not an editable config file")
    if not isinstance(content, str) or len(content) > 2 * 1024 * 1024:
        raise ValueError("bad content")
    if mid.endswith(".json") and content.strip():
        try:
            json.loads(content)
        except json.JSONDecodeError as e:
            raise ValueError(f"invalid JSON: {e}") from None
    atomic_write(config_dir() / mid, content)

def settings_set(key, value):
    if not SETTINGS_KEY_RE.match(key or ""):
        raise ValueError("bad settings key")
    path = config_dir() / "settings.json"
    data = {}
    if path.is_file():
        try:
            data = json.loads(path.read_text())
        except json.JSONDecodeError as e:
            raise ValueError(f"{path.name} has invalid JSON — fix it by hand first ({e})")
        if not isinstance(data, dict):
            raise ValueError(f"{path.name}: top level is not a JSON object")
    parts = key.split(".")
    node = data
    for p in parts[:-1]:
        nxt = node.get(p)
        if not isinstance(nxt, dict):
            if value is None:
                return
            nxt = {}
            node[p] = nxt
        node = nxt
    if value is None:
        node.pop(parts[-1], None)

        def prune(d):
            for k in list(d):
                if isinstance(d[k], dict):
                    prune(d[k])
                    if not d[k]:
                        del d[k]
        prune(data)
    else:
        node[parts[-1]] = value
    atomic_write(path, json.dumps(data, indent=2) + "\n")

HOOK_EVENTS = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse",
               "Notification", "Stop", "SubagentStop", "PreCompact", "SessionEnd"]

def hook_sample(event):
    """Representative stdin payload for test-firing a hook command."""
    base = {"session_id": "claude-ui-test", "transcript_path": "/tmp/transcript.jsonl",
            "cwd": str(Path.home()), "hook_event_name": event}
    if event in ("PreToolUse", "PostToolUse"):
        base.update(tool_name="Bash", tool_input={"command": "echo hello"})
        if event == "PostToolUse":
            base["tool_response"] = {"stdout": "hello\n", "stderr": ""}
    elif event == "UserPromptSubmit":
        base["prompt"] = "test prompt from claude-ui"
    elif event == "Notification":
        base["message"] = "test notification"
    elif event == "SessionStart":
        base["source"] = "startup"
    return base

def hook_test(command, event):
    if not isinstance(command, str) or not command.strip():
        raise ValueError("command required")
    if event not in HOOK_EVENTS:
        event = "PreToolUse"
    try:
        r = subprocess.run(command, shell=True, cwd=str(Path.home()),
                           input=json.dumps(hook_sample(event)),
                           capture_output=True, text=True, timeout=10)
    except subprocess.TimeoutExpired:
        return {"ok": False, "exit": None, "stdout": "", "stderr": "",
                "detail": "timed out after 10s"}
    return {"ok": r.returncode == 0, "exit": r.returncode,
            "stdout": r.stdout[-2000:], "stderr": r.stderr[-2000:],
            "detail": f"exit {r.returncode}"}
