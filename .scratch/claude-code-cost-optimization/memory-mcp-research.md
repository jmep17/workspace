# Memory MCP research — findings

Status: research complete, nothing implemented
Date: 2026-07-17
Constraints applied: (1) fully local, no external calls; (2) automatic memory writing; (3) minimal token overhead / cost.

---

## TL;DR

1. **Claude Code already writes memory automatically.** Native auto-memory (on by default in 2026 builds) maintains `~/.claude/projects/<project>/memory/MEMORY.md` + topic files, loads the first 200 lines/25KB at session start, survives `/compact`, and is entirely local. Docs: https://code.claude.com/docs/en/memory.md#auto-memory. It is *model-initiated* (opportunistic), not deterministic.
2. **If deterministic hook-based auto-capture is required, `mcp-memory-service` (doobidoo) is the only fully-local MCP that does it** — SessionStart memory injection + Stop-hook auto-capture, on-device ONNX embeddings, sqlite-vec storage, no API keys. Bonus: it ships a local REST API/dashboard, so its stats can feed the planned statusline.
3. **A DIY SessionEnd/Stop hook writing into native auto-memory's topic files is the zero-overhead alternative** — deterministic capture with no tool schemas, no third-party code, no extra API calls.
4. **The effectiveness evidence for memory systems is weak and vendor-inflated.** The headline benchmark (LoCoMo) has a ~6.4% wrong answer key and a judge that passes wrong answers 62.8% of the time; the mem0-vs-Zep dispute saw the same system score 58–84% depending on who ran it. The only coding-specific research (SWE-ContextBench, "Learning When to Remember", 2026) finds memory helps **only** when injected context is compact and precisely selected — naive always-inject retrieval is frequently net-negative. Whatever is adopted must be pruned.
5. No conversational-recall benchmark predicts coding outcomes, and nobody has published the comparison that actually matters: memory MCP vs a well-kept CLAUDE.md. Community consensus (and Anthropic's own converged design) is native-first: CLAUDE.md + auto-memory + skills + docs-in-repo.

## Decision matrix under the constraints

| Candidate | Fully local | Auto-capture | Auto-inject | Token overhead | Verdict |
|---|---|---|---|---|---|
| **Native auto-memory** | ✅ local files | ⚠️ model-initiated | ✅ first 200 lines of MEMORY.md | ~0 (no schemas) | **Baseline — keep on** |
| **mcp-memory-service** (doobidoo, v11.5.2 2026-07-15) | ✅ sqlite-vec + ONNX embeddings on-device | ✅ Stop-hook, noise-gated | ✅ SessionStart injection | Moderate (v11 consolidated tools) | **Top third-party pick** |
| **DIY hook → auto-memory files** | ✅ | ✅ deterministic | ✅ via native loading | ~0 | **Recommended alternative** |
| claude-mem (87.5k★, v13.11.0) | ⚠️ storage local; compression runs headless Claude Agent SDK sessions on your key | ✅ 5 hooks, PostToolUse streams everything | ✅ SessionStart | High: background token burn every session, unquantified | Conditional fail: extra Anthropic spend + reliability record (silent hook failures, Windows broken, startup process bloat) |
| Letta claude-subconscious (2.9k★) | ❌ defaults to Letta Cloud; self-host = run Letta server + LLM for background memory agent | ✅ fully automatic (4 hooks) | ✅ whisper/full injection, **zero MCP schemas** | Low in-session; LLM burn server-side | Elegant design, fails locality without heavy self-host infra |
| Basic Memory (3.4k★, AGPL) | ✅ markdown + FastEmbed local | ❌ deliberate capture (plugin adds session briefings + pre-compact checkpoints) | ✅ partial | High (~20+ tools, markdown returns) | Fails auto-write |
| Engram (5.5k★, v1.19.0) | ✅ Go binary + SQLite FTS5, `~/.engram/engram.db` | ❌ explicit tools only | ❌ | High (20 tools) | Fails auto-write |
| Beads (25.4k★) | ✅ Dolt, local | ❌ explicit (`bd remember`); `bd prime` injects on demand | ⚠️ semi | Low-moderate | Task-graph niche, fails auto-write; interesting for issue tracking, overlaps `.scratch/` tracker |
| Official `server-memory` (npm 2026.7.4) | ✅ single JSONL, zero deps | ❌ prompt-driven only | ❌ | Low (9 terse tools; `read_graph` grows unbounded) | Fails auto-write |
| mcp-knowledge-graph (shaneholloman) | ✅ JSONL, per-project `.aim/` | ❌ | ❌ | Low (10 compact tools) | Fails auto-write |
| Neo4j memory (contrib, Labs no-SLA) | ✅ vs local Neo4j | ❌ | ❌ | Low (9 tools) | Fails auto-write; needs a DB for less than sqlite gives |
| mem0 self-hosted (61k★; OpenMemory **sunset**) | ⚠️ server local but `add()` = 2 LLM passes + embeddings (OpenAI default; local Ollama possible = heavy) | ⚠️ plugin hooks exist but built around hosted MCP | ✅ via plugin | Moderate (11 tools) | Fails locality in practice |
| Zep/Graphiti MCP (28.8k★, mcp-v1.0.2) | ❌ every episode = multiple LLM extraction calls + embeddings on your key | ❌ explicit only | ❌ | 13 tools; heaviest write-path burn of all | Fails locality + auto-write |
| Cognee (28k★) | ❌ requires LLM_API_KEY for graph extraction | ❌ | ❌ | 7 tools | Fails locality |
| Supermemory (28.4k★) | ❌ hosted MCP; plugin ships session content to their cloud (local mode exists but not the CC integration) | ✅ (cloud) | ✅ (cloud) | Low schemas | Fails locality — compliance risk on employer key |
| memento-mcp | ❌ OpenAI embeddings required | ❌ | ❌ | 17–20 tools | Unmaintained (no release since 2025-05) |
| Redis agent-memory-server | ❌ embeddings hard-require OpenAI | ✅ server-side extraction | ❌ | 10 tools | OSS demoted to "V0 research foundation"; steers to paid Redis Iris |

## Effectiveness evidence (skeptical read)

- **LoCoMo is unreliable**: Penfield Labs audit found 6.4% of the answer key wrong; the LLM judge accepts topically-adjacent wrong answers 62.8% of the time. mem0 scored Zep 58.44–65.99% while Zep self-scored 75–84% (an arithmetic error inflated the original 84%); mem0's own SOTA claims compare against a full-context-replay baseline nobody uses.
- **Coding-specific findings (2026)**: SWE-ContextBench (arXiv 2602.08316) — context reuse helps only when compact and correctly selected; free retrieval often hurts. "Learning When to Remember" (arXiv 2604.27283) — removing the abstention option raised false-positive memory injections from 0% to 17.5% and worsened outcomes.
- **Failure modes in the wild**: stale memories served with full confidence after refactors; duplicate/unbounded growth (servers now ship dedup/consolidation because of it); claude-mem's issue tracker (silent worker failures, per-prompt 10s hook blocking, Windows-broken hooks).
- **Scale threshold**: flat markdown memory reportedly works to ~200 sessions per project before retrieval precision degrades (HN, 1,100-session user). Below that, curated markdown beats semantic memory for code because it's versioned with the code.
- **Token economics**: ~1k tokens per MCP tool schema (mitigated by Claude Code's tool deferral); injected memories are the recurring cost. Nobody has measured memory-MCP-vs-good-CLAUDE.md.

## Recommended configuration (pending approval)

1. **Keep native auto-memory on** (verify with `/memory`) — local, free, survives `/compact`.
2. **Add a small deterministic capture hook**: SessionEnd/Stop hook that appends a structured session summary (task, decisions, gotchas) into auto-memory's topic files or MEMORY.md. Zero schema overhead, zero third-party code, composes with native loading. This covers "automatic memory writing" at no token cost.
3. **Only if that proves insufficient** (expect at 100–200+ sessions/project): add **mcp-memory-service** in local sqlite-vec mode with its claude-hooks (SessionStart inject + Stop capture), pin the version, schedule periodic consolidation/pruning, and wire its local REST API into the statusline for memory-count/injection stats. Risks to accept: single maintainer, fast churn, GitHub→Codeberg migration.
4. **Do not adopt**: claude-mem (background Claude spend + reliability), anything cloud (Supermemory/mem0 hosted/Zep/Redis Iris — employer-code compliance), anything requiring external embedding/LLM keys (Graphiti, Cognee, memento, Redis OSS, mem0 self-hosted in default config).

## Sources

Native memory: https://code.claude.com/docs/en/memory.md · https://code.claude.com/docs/en/context-window.md
mcp-memory-service: https://codeberg.org/doobidoo/mcp-memory-service (moved from GitHub) · https://pypi.org/project/mcp-memory-service/
claude-mem: https://github.com/thedotmack/claude-mem (issues: 2369, 2891, 2106; context bloat: anthropics/claude-code#29971)
Letta subconscious: https://github.com/letta-ai/claude-subconscious
mem0/OpenMemory sunset: https://github.com/mem0ai/mem0 (openmemory/ README) · Zep/Graphiti: https://github.com/getzep/graphiti/tree/main/mcp_server
Official server: https://www.npmjs.com/package/@modelcontextprotocol/server-memory · fork: https://github.com/shaneholloman/mcp-knowledge-graph
Engram: https://github.com/Gentleman-Programming/engram · Beads: https://github.com/gastownhall/beads
Benchmarks & critique: mem0 paper arXiv 2504.19413 · Zep rebuttal https://blog.getzep.com/lies-damn-lies-statistics-is-mem0-really-sota-in-agent-memory/ · getzep/zep-papers#5 · LoCoMo audit https://penfieldlabs.substack.com/p/we-audited-locomo-64-of-the-answer · SWE-ContextBench arXiv 2602.08316 · Learning When to Remember arXiv 2604.27283 · LongMemEval arXiv 2410.10813
Community consensus: https://mcp.directory/blog/claude-code-memory-mcp-servers-2026 · https://harrisonsec.com/blog/claude-code-memory-first-principles-tradeoffs/ · https://thehumansintheloop.substack.com/p/agentic-memory-mcp-memory-service
