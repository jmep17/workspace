# Claude Code cost optimization — research findings

Status: research complete, nothing implemented yet
Date: 2026-07-17
Goal: a Claude Code configuration for work (employer-provided Anthropic API key, pay-per-token billing) that minimizes token spend, plus a custom statusline showing model, context %, session tokens, session cost, weekly total cost, and stats from any token-saving MCP servers.

---

## TL;DR recommendations

1. **Skip RAG.** Claude Code's creators tried embedding-based RAG and dropped it — agentic search (grep/glob + prompt caching) outperformed it for code. Don't build a vector index; invest in caching hygiene instead.
2. **The biggest levers are free:** protect the prompt cache (cache reads are 0.1× input price; don't toggle MCP servers/models mid-session), route routine work to cheaper models, keep CLAUDE.md under ~200 lines, `/clear` between unrelated tasks, cap thinking budget.
3. **`codebase-memory` exists** (DeusData, ~32k stars) and is credible, but **Serena** (oraios) is the better fit: free, fully local, no embedding bills, LSP symbol-level reads instead of whole-file reads, most actively maintained in the space — and the only one with a local stats API the statusline can poll. (This repo's `.gitignore` already lists `.serena/`.)
4. **The honest default is zero memory MCPs.** Every server adds always-paid schema overhead and cache-invalidation risk. Start with none, measure with `/context` and `/usage`, add Serena only if whole-file re-reads dominate spend.
5. **The statusline is fully feasible.** Claude Code pipes a JSON payload to a statusline command containing model, session cost, session tokens, and a pre-computed context-used percentage. Weekly cost comes from `ccusage` over the local `~/.claude/projects/**/*.jsonl` transcripts. Serena stats come from its local dashboard HTTP API.

---

## 1. Cost model (verified against official pricing, 2026-07)

Per MTok, from https://platform.claude.com/docs/en/about-claude/pricing:

| Model | Input | Output | Cache read | 5m cache write | 1h cache write |
|---|---|---|---|---|---|
| Fable 5 | $10 | $50 | $1.00 | $12.50 | $20 |
| Opus 4.8 | $5 | $25 | $0.50 | $6.25 | $10 |
| Sonnet 5 (intro until 2026-08-31) | $2 | $10 | $0.20 | $2.50 | $4 |
| Sonnet 4.6 / Sonnet 5 (from Sept) | $3 | $15 | $0.30 | $3.75 | $6 |
| Haiku 4.5 | $1 | $5 | $0.10 | $1.25 | $2 |

- Cache reads are **0.1×** input price; 5-min writes 1.25×; 1-hour writes 2×. Caching pays for itself after one read (5-min) or two reads (1-hour).
- API-key users get 5-min cache TTL by default; `ENABLE_PROMPT_CACHING_1H=1` opts into the 1-hour TTL.
- Caveat: Opus 4.7+, Sonnet 5, and Fable 5 use a newer tokenizer that produces **~30% more tokens for the same text** — factor this into cross-model comparisons.
- Anthropic's current baseline: **~$13/dev/day average, $150–250/month, 90% of users under $30/day** (the older "$6/day" figure is stale).
- Thinking tokens bill as **output** tokens — the most expensive category.

### What breaks the prompt cache (and what it costs)

Caching is a strict prefix match over `tools → system → messages`. Full invalidation is triggered by: switching models (`/model`), changing effort, toggling MCP servers or plugins, denying a built-in tool, `/compact`, upgrading Claude Code. With 200K tokens of context on Opus 4.8, a cache hit costs ~$0.10/request vs ~$1.25/request while rebuilding — **12.5×**. Rule: configure servers/models *before* starting a session; restart rather than toggle mid-task.

## 2. Cost-reduction tactics, ranked by impact

1. **Model routing.** Default to Sonnet; drop to Haiku for mechanical work (`/model`, or `model: haiku` in subagent frontmatter); escalate to Opus only when stuck. `ANTHROPIC_SMALL_FAST_MODEL` sets the background/summarization model. `availableModels` in settings.json can fence off expensive models entirely.
2. **Cache hygiene** (see above) + `ENABLE_PROMPT_CACHING_1H=1` if sessions have gaps longer than 5 minutes.
3. **Context discipline.** `/clear` between unrelated tasks (free; since v2.1.211 also resets the session cost counter); `/compact <focused instruction>` when continuity is needed; `/context` to audit what's eating the window. Keep CLAUDE.md < 200 lines; push detail into skills (loaded on demand).
4. **Thinking/effort budget.** Lower `/effort`; `MAX_THINKING_TOKENS=8000` (or `0` to disable) on fixed-budget models.
5. **Minimal MCP surface.** Tool schemas are deferred by default in current Claude Code (tool search), but each server still costs something and toggling breaks the cache. Prefer CLI tools (`gh`, `aws`) over MCP equivalents — zero schema cost. Community measurements before deferral: 15–55k tokens per turn for multi-server stacks.
6. **Plan mode** (Shift+Tab) for anything nontrivial — cheap planning beats expensive re-work.
7. **Specific prompts with verification targets** ("fix X in auth.ts, run `npm test` to confirm") so Claude self-checks instead of iterating with you.
8. **Subagents for verbose work** (test runs, doc fetches) so only summaries hit the main context — but note subagents build their own caches (5-min TTL) and agent teams cost ~7× a single session.
9. **No `.claudeignore`** — it isn't a real feature (folklore). Use permission `deny` rules on Read for noisy directories.
10. **Housekeeping:** `cleanupPeriodDays` (default 30) prunes old session data — note this also limits how far back local cost history goes (keep ≥ 8–30 days for weekly stats).

## 3. RAG verdict: not for code

- Boris Cherny (Claude Code's creator) has said early versions used RAG with a local vector DB and pure agentic search "outperformed everything. By a lot." Claude Code deliberately ships with no codebase index.
- Reasons: embeddings go stale on every edit; retrieval can't follow call chains; index infrastructure adds cost and a security surface. Prompt caching absorbs much of agentic search's extra input cost.
- RAG still wins for large *unstructured document* corpora — not code navigation.
- Embedding costs themselves are trivial (~$0.02–0.13/MTok; a large repo ≈ a few dollars) — the objection is staleness and machinery, not the embedding bill.

## 4. MCP server evaluation

| Server | Verdict | Why |
|---|---|---|
| **Serena** (oraios/serena, 26.5k★, release 2026-07-16) | **Recommended (if any)** | LSP symbol-level read/edit tools replace whole-file reads; free, local, no external services; local dashboard API at `http://localhost:24282` exposes per-tool call counts and estimated token usage with `record_tool_usage_stats: true` — scriptable for the statusline. Cost: ~20 tool schemas (mitigated by tool deferral) + language-server cold starts. |
| **codebase-memory** (DeusData/codebase-memory-mcp, ~32k★) | Solid runner-up | Real and hugely popular (asked about by name). Tree-sitter AST knowledge graph, single static binary, zero deps, fully local. "99% fewer tokens" claim is measured against a naive grep baseline — independent reproduction rated it "partially verified"; treat as directionally true. Younger, buggier (248 open issues); no usage-stats endpoint for the statusline (local SQLite is queryable for index contents only). |
| **claude-context** (Zilliz) | Skip | Vector-DB + embedding-key machinery, index staleness, vendor-measured ~40% savings; the vendor sells vector DBs. |
| **mem0/OpenMemory MCP** | Skip | MCP packaging unstable through 2026. |
| **chroma-mcp / qdrant MCP** | Skip | Raw primitives, not products. |
| **mcp-memory-service / Basic Memory** | Optional, different niche | Cross-session decision/note memory, local-first. This repo's `.scratch/` markdown tracker + CONTEXT.md already covers this need at zero token overhead. |
| **Context7** (Upstash) | Optional add-on | Vendor benchmark (published methodology): ~35% cost / ~37% token reduction *on library-doc lookups only*. Worth it only if doc lookups are frequent. |

## 5. Statusline design

Everything requested is feasible. Claude Code pipes JSON to the `statusLine` command on every refresh (docs: https://code.claude.com/docs/en/statusline.md).

| Requirement | Source |
|---|---|
| Model | `model.display_name` / `model.id` (native payload) |
| Context % used | `context_window.used_percentage` (native, pre-computed; excludes output tokens by design, matching `/context`) |
| Session tokens | `context_window.current_usage` — input, output, `cache_creation_input_tokens`, `cache_read_input_tokens` (native) |
| Session cost | `cost.total_cost_usd` (native; authoritative for API-key billing) |
| Weekly total cost | **Not native.** Aggregate `~/.claude/projects/**/*.jsonl` with `ccusage daily --since <monday>` (JSON output, summed) — local-only, no API key needed. Must be cached (e.g. 5-min file cache) so the statusline doesn't shell out to `npx` on every refresh. |
| MCP savings stats | **Serena:** poll the local dashboard HTTP API (`record_tool_usage_stats: true`). **Generic fallback:** parse per-MCP-tool token usage out of the session transcript (`transcript_path` is in the payload). Cache-read ratio from `current_usage` is itself a good "savings" proxy. |

Sketch (final version would be a small script with caching, likely `~/.claude/statusline.sh` or ccstatusline):

```
[Sonnet] ctx 42% | 8.5k in / 1.2k out / 94% cached | $0.87 session | $23.40 wk | serena: 31 calls ~12k tok saved
```

Notes:
- `ccusage` (https://github.com/ryoppippi/ccusage) is the de-facto standard for local cost aggregation and even has a `statusline` subcommand; `ccstatusline` (sirmalloc) is a configurable widget-based alternative supporting per-model weekly usage but not a single weekly-cost total — a small custom script gives exact control over the requested fields.
- `rate_limits.*` fields are subscription-only; irrelevant on an API key.
- Console usage page + workspace spend limits are the authoritative billing view for the employer key; `/usage` and `/cost` in-app show real spend for API-key users.

## 6. Proposed implementation (pending approval — NOT done)

1. `~/.claude/settings.json` (user-level) or `.claude/settings.json` here: `statusLine` command, `env` block (`ENABLE_PROMPT_CACHING_1H=1`, `MAX_THINKING_TOKENS`, optionally `ANTHROPIC_SMALL_FAST_MODEL=claude-haiku-4-5`), `cleanupPeriodDays` ≥ 30, sensible default `model`.
2. `~/.claude/statusline.sh`: jq over the stdin payload + cached `ccusage` weekly rollup + optional Serena dashboard poll.
3. Optional: Serena via `claude mcp add` with `record_tool_usage_stats: true` (`.serena/` is already gitignored here).
4. Trim/verify CLAUDE.md stays small; move any growth into skills.

## Key sources

- Statusline payload: https://code.claude.com/docs/en/statusline.md
- Cost docs: https://code.claude.com/docs/en/costs
- Prompt caching: https://code.claude.com/docs/en/prompt-caching.md
- Pricing: https://platform.claude.com/docs/en/about-claude/pricing
- ccusage: https://github.com/ryoppippi/ccusage · ccstatusline: https://github.com/sirmalloc/ccstatusline
- Serena: https://github.com/oraios/serena (dashboard: https://oraios.github.io/serena/02-usage/060_dashboard.html)
- codebase-memory: https://github.com/DeusData/codebase-memory-mcp (independent benchmark check: https://pantheon-org.github.io/agentic-context/benchmarks/deusdata-codebase-memory-mcp/)
- Why Claude Code skips RAG: https://vadim.blog/claude-code-no-indexing/
- MCP overhead measurements: https://www.mindstudio.ai/blog/claude-code-mcp-server-token-overhead · https://www.jdhodges.com/blog/claude-code-mcp-server-token-costs/
- Context7 benchmark: https://upstash.com/blog/context7-vs-web-search-benchmark
