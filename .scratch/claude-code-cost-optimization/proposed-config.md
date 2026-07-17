# Proposed Claude Code configuration

Status: blueprint — nothing installed yet
Date: 2026-07-17
Layout: a `claude/` directory in this dotfiles repo, symlinked to `~/.claude` (matches the nvim/tmux/ghostty pattern). All local, no external services.

```
claude/
├── settings.json          # models, env, statusline, hooks, permissions
├── statusline.sh          # custom statusline (model / ctx% / tokens / session $ / weekly $)
├── hooks/
│   └── memory-capture.sh  # deterministic session-summary → auto-memory
└── CLAUDE.md              # user-level memory (kept minimal)
```

---

## 1. `claude/settings.json`

```json
{
  "model": "sonnet",
  "availableModels": ["sonnet", "haiku"],
  "cleanupPeriodDays": 30,
  "autoMemoryEnabled": true,
  "env": {
    "ENABLE_PROMPT_CACHING_1H": "1",
    "ANTHROPIC_SMALL_FAST_MODEL": "claude-haiku-4-5",
    "MAX_THINKING_TOKENS": "10000"
  },
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh",
    "refreshInterval": 10
  },
  "hooks": {
    "SessionEnd": [
      {
        "hooks": [
          { "type": "command", "command": "~/.claude/hooks/memory-capture.sh" }
        ]
      }
    ]
  },
  "permissions": {
    "deny": [
      "Read(./node_modules/**)",
      "Read(./dist/**)",
      "Read(./build/**)",
      "Read(./.venv/**)",
      "Read(**/*.min.js)",
      "Read(**/package-lock.json)"
    ]
  }
}
```

Rationale per key:
- `model: sonnet` — the cost/capability sweet spot ($3/$15 vs Opus $5/$25; Sonnet 5 intro pricing $2/$10 through Aug 2026). Escalate per-task with `/model`, don't default up.
- `availableModels` — fences off Opus/Fable tiers so an accidental `/model` can't 2–5× the bill. Remove if occasional Opus is wanted.
- `ENABLE_PROMPT_CACHING_1H=1` — API keys default to 5-minute cache TTL; 1-hour TTL (2× write vs 1.25×, still 0.1× reads) wins whenever there are >5-min gaps between prompts, i.e. normal interactive work. Single highest-leverage env var for API-key users.
- `ANTHROPIC_SMALL_FAST_MODEL` — background/summarization tasks on Haiku.
- `MAX_THINKING_TOKENS=10000` — caps thinking (billed as output tokens) on fixed-budget models; adaptive-reasoning models use `/effort` instead — keep it at medium unless a task is genuinely hard.
- `cleanupPeriodDays: 30` — default, but stated explicitly because weekly cost stats depend on local transcripts surviving ≥7 days.
- Permission deny rules — the supported replacement for the mythical `.claudeignore`; keeps giant generated files out of context. Scoped denies don't break the prompt cache.
- Not setting: `autoCompactEnabled: false` — leave auto-compact ON; running out of context mid-task is worse than the summarization call.

## 2. `claude/statusline.sh`

Requested: model, context %, session tokens, session cost, weekly total cost, MCP stats. Everything except weekly cost comes straight from the JSON Claude Code pipes on stdin; weekly cost comes from `ccusage` over local transcripts (`~/.claude/projects/**/*.jsonl`), cached for 5 minutes and refreshed in the background so the statusline never blocks on it.

```bash
#!/usr/bin/env bash
# Claude Code statusline: [model] ctx% | tokens (cache%) | session $ | weekly $
input=$(cat)

MODEL=$(jq -r '.model.display_name // "?"' <<<"$input")
PCT=$(jq -r '.context_window.used_percentage // 0 | floor' <<<"$input")
COST=$(jq -r '.cost.total_cost_usd // 0' <<<"$input")

IN=$(jq -r '.context_window.current_usage.input_tokens // 0' <<<"$input")
OUT=$(jq -r '.context_window.current_usage.output_tokens // 0' <<<"$input")
CR=$(jq -r '.context_window.current_usage.cache_read_input_tokens // 0' <<<"$input")
CW=$(jq -r '.context_window.current_usage.cache_creation_input_tokens // 0' <<<"$input")
CTX_TOK=$(( IN + CR + CW ))
CACHE_PCT=0
[ "$CTX_TOK" -gt 0 ] && CACHE_PCT=$(( CR * 100 / CTX_TOK ))

# Weekly cost: ccusage over local transcripts, 5-min file cache, refreshed async.
CACHE=~/.claude/cache/weekly-cost
mkdir -p "${CACHE%/*}"
AGE=$(( $(date +%s) - $(stat -c %Y "$CACHE" 2>/dev/null || echo 0) ))
if [ "$AGE" -gt 300 ]; then
  ( npx -y ccusage@latest daily --since "$(date -d '6 days ago' +%Y%m%d)" --json 2>/dev/null \
      | jq -r '.totals.totalCost // 0 | . * 100 | round / 100' > "$CACHE.tmp" \
      && mv "$CACHE.tmp" "$CACHE" ) &
fi
WEEK=$(cat "$CACHE" 2>/dev/null || echo "…")

# Optional MCP stats (only if a stats-capable local server is added later):
# mcp-memory-service: curl -s localhost:8000/api/health → memory count
# Serena:             curl -s localhost:24282/... → per-tool token estimates
MEM=""
if MEMC=$(curl -sf -m 0.3 localhost:8000/api/memories/count 2>/dev/null); then
  MEM=" | mem:${MEMC}"
fi

printf '[%s] ctx %s%% | %sk tok (%s%% cached) | $%.2f | $%s wk%s\n' \
  "$MODEL" "$PCT" "$(( CTX_TOK / 1000 ))" "$CACHE_PCT" "$COST" "$WEEK" "$MEM"
```

Example render: `[Sonnet] ctx 42% | 96k tok (94% cached) | $0.87 | $23.40 wk`

Notes:
- `used_percentage` is pre-computed by Claude Code and matches `/context` (excludes output tokens by design).
- The cache % is the live health indicator for lever #1 — if it drops near zero mid-session, something invalidated the prompt cache.
- Token figure shown is current context composition; cumulative session spend is what the `$` figure tracks (that's the number that matters for cost). If cumulative token counts are wanted too, `ccusage session --json` or parsing `transcript_path` can supply them — deliberately omitted v1 to keep the script fast.
- Weekly window is rolling 7 days (`--since` 6 days ago + today). For calendar weeks use `date -d 'last monday'` with a Monday edge-case guard.
- `date -d` is GNU; on macOS use `date -v-6d +%Y%m%d` / `stat -f %m`.
- The MCP-stats section degrades silently (300ms curl timeout) when no server is running — zero cost until one is added.

## 3. `claude/hooks/memory-capture.sh` — deterministic memory writing

Fills the gap that native auto-memory is model-initiated. On SessionEnd, summarize the session with a cheap Haiku call and append to auto-memory's topic files, where the native loader picks it up next session.

```bash
#!/usr/bin/env bash
# SessionEnd hook: guarantee a memory trail for substantive sessions.
input=$(cat)
transcript=$(jq -r '.transcript_path // empty' <<<"$input")
[ -f "$transcript" ] || exit 0

# Skip trivial sessions (< 10 user/assistant turns)
turns=$(jq -rs '[.[] | select(.type == "user" or .type == "assistant")] | length' "$transcript" 2>/dev/null || echo 0)
[ "$turns" -lt 10 ] && exit 0

memdir=$(jq -r '.memory_dir // empty' <<<"$input")
[ -z "$memdir" ] && memdir="$HOME/.claude/projects/$(pwd | tr '/' '-')/memory"
mkdir -p "$memdir"

# Cheap deterministic summary: last 300 lines of transcript → 3 bullets via Haiku.
tail -n 300 "$transcript" \
  | claude -p --model claude-haiku-4-5 --max-turns 1 \
      "Summarize this coding session in at most 3 terse bullets: decisions made, gotchas discovered, unfinished work. Output only the bullets." \
  >> "$memdir/sessions.md" 2>/dev/null && \
  printf '\n(^ %s, %s)\n\n' "$(date +%F)" "$(basename "$(pwd)")" >> "$memdir/sessions.md"
exit 0
```

Cost: one small Haiku call per substantive session — order of $0.001–0.01. Runs after the session, off the critical path. Zero-API alternative: append `git log --oneline -5` + `git diff --stat` instead of a summary (free, less useful). Maintenance: prune `sessions.md` during the weekly `/memory` review; promote durable facts to CLAUDE.md or `docs/`.

## 4. `claude/CLAUDE.md` (user-level) — keep near-empty

A handful of lines: preferred shell idioms, commit-message style, "prefer CLI tools (gh/aws) over MCP equivalents". Project rules stay in per-repo CLAUDE.md files under 200 lines, with path-scoped `.claude/rules/` for subsystem-specific guidance and skills for procedures. Include a `# Compact instructions` section in project CLAUDE.md files: "When compacting, preserve: current task state, decisions made, file paths being edited, test commands."

## 5. MCP servers: none by default

- Day one: zero MCP servers. Native auto-memory + the capture hook covers memory; agentic search covers retrieval (RAG rejected per research).
- Escalation 1 (repeated whole-file reads dominating spend, verified via `/context`): add **Serena** per-project — local, LSP symbol-level reads, stats API on :24282 for the statusline. `.serena/` already gitignored here.
- Escalation 2 (memory retrieval failing at ~100–200 sessions/project): add **mcp-memory-service** local mode (sqlite-vec + ONNX), pin the version, wire its REST API into the statusline.
- Never (fails local-only constraint): Context7, Supermemory, mem0 hosted, Zep/Graphiti, Cognee, claude-mem.
- Configure servers before starting a session, never toggle mid-session (full prompt-cache invalidation ≈ 12.5× per-request input cost until rebuilt).

## 6. Habits the config can't automate

- `/clear` between unrelated tasks; `/compact <focus>` only when continuity matters.
- Plan mode (Shift+Tab) for nontrivial work.
- `/usage` + Console usage page (authoritative for the employer key) weekly; workspace spend limits are an admin-side option.
- Weekly `/memory` review: prune stale, promote durable.

## Install sketch (when approved)

```bash
ln -s ~/workspace/claude ~/.claude           # or stow/individual symlinks
chmod +x ~/.claude/statusline.sh ~/.claude/hooks/memory-capture.sh
npx -y ccusage@latest daily >/dev/null       # warm the npx cache
```

Prerequisites: `jq`, Node ≥20 (for npx/ccusage), GNU coreutils (or the macOS date/stat variants noted above).
