# Claude Code Configuration Reference

Research date: 2026-07-22. All content is sourced from the official Claude Code documentation at `code.claude.com/docs` (the docs moved there from `docs.anthropic.com/en/docs/claude-code`; the old `/en/docs/claude-code/...` paths now 404 and pages live at `/docs/en/<page>`). Every section cites the exact page it came from. Raw page markdown was fetched from the `.md` endpoints (e.g. `https://code.claude.com/docs/en/settings.md`) on 2026-07-22.

**Documented Claude Code version context:** the docs describe behavior through roughly v2.1.214, with many `Requires Claude Code vX.Y.Z or later` annotations noted inline below where they matter.

---

## 1. Overview: the configuration surfaces

| Surface | What it holds | Source |
| --- | --- | --- |
| `settings.json` (user/project/local/managed) | Permissions, `env`, model, hooks, statusLine, sandbox, most behavior toggles | https://code.claude.com/docs/en/settings |
| `~/.claude.json` (global config) | OAuth session, UI/app state, MCP servers (user + local scopes), per-project state (allowed tools, trust), caches, and a small set of "global config settings" keys | https://code.claude.com/docs/en/settings#global-config-settings |
| Environment variables | API/provider routing, auth, timeouts, token budgets, feature toggles (~190 documented vars) | https://code.claude.com/docs/en/env-vars |
| CLI flags | Per-session overrides (`--model`, `--settings`, `--permission-mode`, ...) | https://code.claude.com/docs/en/cli-reference |
| `.mcp.json` (project root) | Project-scoped MCP servers, checked into VCS | https://code.claude.com/docs/en/mcp#mcp-installation-scopes |
| `CLAUDE.md` / `.claude/rules/*.md` | Persistent instructions (memory) | https://code.claude.com/docs/en/memory |
| `.claude/` directory files | skills/, agents/, output-styles/, workflows/, hooks scripts, keybindings.json (global), themes/ (global) | https://code.claude.com/docs/en/claude-directory |
| Managed settings (`managed-settings.json`, MDM, server-delivered) | Org policy; cannot be overridden | https://code.claude.com/docs/en/settings#settings-files |

Precedence (general rule): environment variable > settings-file field, when both control the same behavior; a variable set in a settings-file `env` block overrides the same variable exported in the shell. CLI flags and in-session commands vary per feature (`--model`/`/model` override `ANTHROPIC_MODEL`, but `CLAUDE_CODE_EFFORT_LEVEL` overrides `/effort`). Source: https://code.claude.com/docs/en/env-vars#precedence

---

## 2. API / provider configuration

### 2.1 Authentication credentials

Source: https://code.claude.com/docs/en/authentication (page name is `authentication`; there is no separate `iam` page on the current site).

**Authentication precedence** (when multiple credentials are present; from https://code.claude.com/docs/en/authentication#authentication-precedence):

1. Cloud provider credentials, when `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, or `CLAUDE_CODE_USE_FOUNDRY` is set.
2. `ANTHROPIC_AUTH_TOKEN` — sent as `Authorization: Bearer <token>`. For gateways/proxies that use bearer auth.
3. `ANTHROPIC_API_KEY` — sent as `X-Api-Key`. Interactive mode prompts once to approve the key (toggle later via "Use custom API key" in `/config`); in `-p` non-interactive mode the key is always used when present.
4. `apiKeyHelper` script output (settings key) — for rotating/vault credentials.
5. `CLAUDE_CODE_OAUTH_TOKEN` — long-lived (1-year) OAuth token from `claude setup-token`; for CI. Subscription-only; can only make model requests (no Remote Control, no claude.ai connectors). Not read in `--bare` mode.
6. Subscription OAuth credentials from `/login` (default for Pro/Max/Team/Enterprise).

A signed-in Claude apps gateway session sits outside this list and outranks the cloud-provider selection.

**Key facts:**

- `apiKeyHelper` (settings key): custom command run through the system shell (`/bin/sh` on macOS/Linux, `cmd` on Windows) whose stdout is the auth value, sent as **both** `X-Api-Key` and `Authorization: Bearer`. Cached 5 minutes by default; re-run on HTTP 401. Refresh interval: `CLAUDE_CODE_API_KEY_HELPER_TTL_MS` (ms). A helper slower than 10 s shows a warning; from v2.1.208 helper failures error out within three attempts. Sources: https://code.claude.com/docs/en/settings#available-settings, https://code.claude.com/docs/en/authentication#credential-management
- Credential storage: macOS Keychain; Linux `~/.claude/.credentials.json` (mode 0600); Windows `%USERPROFILE%\.claude\.credentials.json`; under `CLAUDE_CONFIG_DIR` if set (Linux/Windows). Source: https://code.claude.com/docs/en/authentication#credential-management
- CI provisioning: `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`), or `CLAUDE_CODE_OAUTH_REFRESH_TOKEN` + `CLAUDE_CODE_OAUTH_SCOPES` (e.g. `"user:profile user:inference user:sessions:claude_code"`) so `claude auth login` exchanges the token without a browser. Source: https://code.claude.com/docs/en/env-vars
- Workload identity federation: `ANTHROPIC_WORKSPACE_ID` targets a specific workspace when the federation rule spans several. Source: https://code.claude.com/docs/en/env-vars

**Login restriction settings** (managed settings; source: https://code.claude.com/docs/en/authentication#restrict-login-to-your-organization and https://code.claude.com/docs/en/settings#available-settings):

| Key | Purpose |
| --- | --- |
| `forceLoginMethod` | `claudeai`, `console`, or `gateway`. From v2.1.212 every first-party login path enforces it (VS Code, Agent SDK, `claude setup-token`, `/install-github-app`). |
| `forceLoginOrgUUID` | Single UUID (pre-selects org) or array of UUIDs. Empty array fails closed. Also blocks sessions authenticated by `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN`/`apiKeyHelper` (membership unverifiable). Cloud-provider sessions aren't blocked. |
| `forceLoginGatewayUrl` | Pre-fills/locks the gateway URL on the `/login` cloud-gateway screen. Managed tier only. |
| `DISABLE_LOGIN_COMMAND` / `DISABLE_LOGOUT_COMMAND` (env) | Hide `/login` / `/logout` when auth is handled externally. |

### 2.2 Endpoint and request routing

Source: https://code.claude.com/docs/en/env-vars unless noted.

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_BASE_URL` | Override the API endpoint (proxy/gateway routing). Changes where requests go, not which model answers. When set to a non-first-party host: MCP tool search disabled by default (`ENABLE_TOOL_SEARCH=true` re-enables if proxy forwards `tool_reference`), and from v2.1.196 Remote Control is disabled when it isn't `api.anthropic.com`. |
| `ANTHROPIC_CUSTOM_HEADERS` | Extra request headers, `Name: Value` format, newline-separated for multiple (use `\n` inside a JSON `env` block). |
| `ANTHROPIC_BETAS` | Comma-separated extra `anthropic-beta` header values. Works with all auth methods, unlike the `--betas` flag (API-key only). |
| `CLAUDE_CODE_EXTRA_BODY` | JSON object merged into the top level of every API request body (provider-specific params). From v2.1.206 a shell-exported value also reaches background sessions. |
| `CLAUDE_CODE_ATTRIBUTION_HEADER` | `0` omits the attribution block (client version + prompt fingerprint) from the system prompt start — improves prompt-cache hits through gateways. |
| `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` | `1` strips Anthropic-specific beta headers and beta tool-schema fields (`defer_loading`, `eager_input_streaming`) for strict proxies. Also forces all MCP tools to load upfront. |
| `DISABLE_INTERLEAVED_THINKING` | `1` prevents sending the interleaved-thinking beta header (for gateways that reject it). |
| `CLAUDE_CODE_DISABLE_THINKING` | `1` omits the `thinking` parameter entirely (proxy compatibility). |
| `CLAUDE_CODE_ENABLE_FINE_GRAINED_TOOL_STREAMING` | Tool-input streaming. Default on for Anthropic API; per-model on Bedrock/Agent Platform; off on Foundry/gateways. `0` opt-out, `1` force-on behind proxies. |
| `CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK` | `1` disables the non-streaming retry fallback when a stream fails mid-response (avoids duplicate tool execution through some proxies). |
| `CLAUDE_CODE_PROPAGATE_TRACEPARENT` | `1` propagates W3C `traceparent` when `ANTHROPIC_BASE_URL` points at a custom proxy (default: only on direct API). v2.1.152+. |
| `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST` | Set by embedding hosts; makes provider-selection/endpoint/auth variables in settings files ignored. |

### 2.3 Model selection

Source: https://code.claude.com/docs/en/model-config

**Ways to set the model, in priority order:** (1) `/model <alias|name>` during a session; (2) `claude --model ...` at startup; (3) `ANTHROPIC_MODEL` env var; (4) `model` field in settings. Since v2.1.153, `/model` in interactive mode saves the choice to user settings as the new-session default (`s` in the picker switches session-only); in `-p` mode it is session-only. Resumed sessions keep the transcript's model (not on providers with provider-specific IDs). Source: https://code.claude.com/docs/en/model-config#setting-your-model

**Model aliases** (https://code.claude.com/docs/en/model-config#model-aliases):

| Alias | Behavior |
| --- | --- |
| `default` | Clears any override; reverts to account-type default (or org default model if the admin set one). |
| `best` | Fable 5 where available, otherwise latest Opus. |
| `fable` | Claude Fable 5 (hardest/longest tasks). Requires v2.1.170+; not available under zero data retention. |
| `sonnet` / `opus` / `haiku` | Latest model of each family for the provider. |
| `sonnet[1m]` / `opus[1m]` | 1M-token context variants (also `[1m]` suffix on full model names). |
| `opusplan` | Opus during plan mode, Sonnet for execution. `opusplan[1m]` forces 1M for both phases. |

Alias resolution per provider (as of the docs snapshot): Anthropic API — `opus`→Opus 4.8, `sonnet`→Sonnet 5; Claude Platform on AWS — Opus 4.8/Sonnet 4.6; Bedrock & Google Cloud Agent Platform — Opus 4.8/Sonnet 4.5; Microsoft Foundry — Opus 4.6/Sonnet 4.5. `default` model by account: Opus 4.8 for Max/Team Premium/Enterprise PAYG/API and AWS/Bedrock/Agent Platform; Sonnet 5 for Pro/Team Standard/Enterprise seats; Sonnet 4.5 on Foundry.

**Model env vars** (https://code.claude.com/docs/en/model-config#environment-variables):

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_MODEL` | Model (alias or full name) for the session. |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | What `opus` resolves to (and `opusplan` in plan mode). |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | What `sonnet` resolves to (and `opusplan` outside plan mode). |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | What `haiku` resolves to, and the model for background functionality (session titles etc.). |
| `ANTHROPIC_DEFAULT_FABLE_MODEL` | What `fable` resolves to; also the ID recognized as Fable 5 for safety-fallback on third-party providers. |
| `ANTHROPIC_SMALL_FAST_MODEL` | **DEPRECATED** in favor of `ANTHROPIC_DEFAULT_HAIKU_MODEL`. |
| `ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION` | Region override for the Haiku-class model on Bedrock/Mantle (on Bedrock only effective when a Haiku model is pinned). |
| `CLAUDE_CODE_SUBAGENT_MODEL` | Model for all subagents, agent teams, and workflow agents; overrides per-invocation `model` and subagent frontmatter. `inherit` = normal resolution (v2.1.196+). |
| `ANTHROPIC_CUSTOM_MODEL_OPTION` (+`_NAME`, `_DESCRIPTION`, `_SUPPORTED_CAPABILITIES`) | Adds one custom entry to the `/model` picker (gateway/custom IDs); validation skipped. |
| `ANTHROPIC_DEFAULT_*_MODEL_NAME` / `_DESCRIPTION` / `_SUPPORTED_CAPABILITIES` | Display name/description and declared capabilities for pinned models on third-party providers/gateways. Capability values: `effort`, `xhigh_effort`, `max_effort`, `thinking`, `adaptive_thinking`, `interleaved_thinking`. |
| `CLAUDE_CODE_DISABLE_LEGACY_MODEL_REMAP` | `1` prevents auto-remap of Opus 4.0/4.1 to current Opus on the Anthropic API. |

**Settings keys for model governance** (https://code.claude.com/docs/en/model-config#restrict-model-selection and .../settings#available-settings):

- `model` — default model (initial selection, not enforcement).
- `availableModels` — allowlist (aliases, version prefixes, or full IDs); applies to main model, alias resolution, subagent/skill/advisor models, fast mode, fallback chains. Managed-source list replaces lower scopes (v2.1.175+); otherwise arrays merge.
- `enforceAvailableModels` — extends the allowlist to the Default picker option (v2.1.175+; no effect with unset/empty `availableModels`).
- `fallbackModel` (settings, array) / `--fallback-model` (flag, comma list) — fallback chain tried in order on overload/unavailability; capped at 3 models; `"default"` expands to the default model; does **not** merge across files. Switch lasts for the current turn.
- `modelOverrides` — map of Anthropic model IDs → provider-specific IDs (Bedrock inference-profile ARNs, Foundry deployment names, etc.). From v2.1.200 also applies to IDs passed via `--model`/`ANTHROPIC_MODEL`/`ANTHROPIC_DEFAULT_*_MODEL`.
- Organization-level (Enterprise, claude.ai admin console): model restrictions and org default model, delivered with account entitlements (v2.1.187+/v2.1.196+); not delivered to Bedrock/Agent Platform/Foundry/gateway sessions — use `availableModels` there.

**Effort & thinking** (https://code.claude.com/docs/en/model-config#adjust-effort-level, #extended-thinking):

- Effort levels `low`/`medium`/`high`/`xhigh`/`max` (model-dependent; default `high` on Fable 5/Sonnet 5/Opus 4.8/4.6/Sonnet 4.6, `xhigh` on Opus 4.7). Set via `/effort`, `/model` slider, `--effort` flag, `CLAUDE_CODE_EFFORT_LEVEL` env (highest precedence; accepts `auto`), `effortLevel` setting (persisted; accepts low/medium/high/xhigh only), or skill/subagent `effort` frontmatter. `ultracode` is a Claude Code setting (sends `xhigh` + workflow orchestration), session-only.
- `alwaysThinkingEnabled` (settings) — extended thinking on by default; `Option+T`/`Alt+T` toggles per session.
- `MAX_THINKING_TOKENS` — thinking-budget override; `0` disables thinking on the Anthropic API **except Fable 5** (cannot be turned off); on third-party providers `0` omits the `thinking` parameter. Nonzero values only apply under a fixed thinking budget (i.e. with `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1` on Opus 4.6/Sonnet 4.6; Fable 5/Sonnet 5/Opus 4.7+ always use adaptive reasoning). Ceiling: model max output tokens minus one.
- `showThinkingSummaries` (settings, default false) — show thinking summaries in interactive sessions.
- `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT` — `1` sends the effort parameter even for unrecognized (gateway) model IDs.

**Context window:** `CLAUDE_CODE_DISABLE_1M_CONTEXT=1` disables 1M-context variants (Sonnet 5 then treated as 200K). Sonnet 5 on the Anthropic API always runs the 1M window, auto-compacting near 967K by default; `CLAUDE_CODE_AUTO_COMPACT_WINDOW` changes the compaction capacity, `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` (1–100) compacts earlier. `CLAUDE_CODE_MAX_CONTEXT_TOKENS` overrides the assumed window for unrecognized model names (recognized Claude models only with `DISABLE_COMPACT`). Sources: https://code.claude.com/docs/en/model-config#extended-context, https://code.claude.com/docs/en/env-vars

### 2.4 Token limits, timeouts, retries, streaming

Source: https://code.claude.com/docs/en/env-vars

| Variable | Purpose / default |
| --- | --- |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | Max output tokens for most requests (defaults/caps vary by model). Raising it shrinks effective context before auto-compaction. |
| `MAX_THINKING_TOKENS` | See §2.3. |
| `API_TIMEOUT_MS` | Per-request timeout. Default 600000 (10 min); max 2147483647 (values above overflow and fail immediately). |
| `CLAUDE_CODE_MAX_RETRIES` | Retry count for failed API requests. Default 10; capped at 15 since v2.1.186 (cap removed when `CLAUDE_CODE_RETRY_WATCHDOG` set, v2.1.199+). |
| `CLAUDE_CODE_RETRY_WATCHDOG` | `1` for unattended sessions: retries 429/529 indefinitely with backoff up to 5 min (or until rate-limit reset); v2.1.199+ also raises other transient-error retries to 300. v2.1.186+. |
| `FALLBACK_FOR_ALL_PRIMARY_MODELS` | Non-empty: all models (not just Opus) stop retrying on repeated overload when no fallback model is configured. |
| `API_FORCE_IDLE_TIMEOUT` | Controls the 5-minute body idle timeout on streaming responses: `0` disable, `1` force-on everywhere. Unset: inactive on direct API/Claude-Platform-on-AWS (byte watchdog runs instead), active elsewhere. v2.1.169+. |
| `CLAUDE_STREAM_IDLE_TIMEOUT_MS` | Streaming idle-watchdog timeout; explicit values clamped to ≥300000. Unset defaults: event watchdog 300 s; byte watchdog 180 s (direct API) / 300 s (other). |
| `CLAUDE_ENABLE_STREAM_WATCHDOG` | `0`/`1` force event-level watchdog off/on (default on for all providers since v2.1.196). |
| `CLAUDE_ENABLE_BYTE_WATCHDOG` | `1`/`0` force byte-level watchdog; default on for direct API and Claude Platform on AWS. |
| `CLAUDE_ENABLE_BYTE_WATCHDOG_BEDROCK` | `1` enables byte watchdog for Bedrock eventstream responses (off by default). |
| `CLAUDE_CODE_CONNECT_TIMEOUT_MS` | **Removed in v2.1.186** (no-op). Use `API_TIMEOUT_MS`. |
| `MAX_STRUCTURED_OUTPUT_RETRIES` | Retries when output fails `--json-schema` validation in `-p` mode (default 5). |

### 2.5 Prompt caching

Sources: https://code.claude.com/docs/en/model-config#prompt-caching-configuration, https://code.claude.com/docs/en/env-vars

| Variable | Purpose |
| --- | --- |
| `DISABLE_PROMPT_CACHING` | `1` disables caching for all models (wins over per-model vars). |
| `DISABLE_PROMPT_CACHING_HAIKU` / `_SONNET` / `_OPUS` / `_FABLE` | Per-family disable. |
| `ENABLE_PROMPT_CACHING_1H` | Request 1-hour cache TTL instead of 5 min (API key, Bedrock, Agent Platform, Foundry, Claude Platform on AWS; billed higher). |
| `ENABLE_PROMPT_CACHING_1H_BEDROCK` | Deprecated → use `ENABLE_PROMPT_CACHING_1H`. |
| `FORCE_PROMPT_CACHING_5M` | `1` forces 5-minute TTL even when 1-hour would apply. |

### 2.6 Amazon Bedrock

Source: https://code.claude.com/docs/en/amazon-bedrock

```bash
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_REGION=us-east-1   # optional if the AWS profile sets a region (v2.1.172+)
```

- Region resolution order (v2.1.172+): `AWS_REGION` → `AWS_DEFAULT_REGION` → active profile's `region` (credentials file, then config file) → `us-east-1`. Active profile = `AWS_PROFILE` or `default`; `AWS_SHARED_CREDENTIALS_FILE` / `AWS_CONFIG_FILE` honored.
- Auth: standard AWS default credential chain; or `AWS_BEARER_TOKEN_BEDROCK` (Bedrock API key). `/logout` unavailable. WebSearch tool unavailable on Bedrock.
- Endpoint override: `ANTHROPIC_BEDROCK_BASE_URL`. Skip signing (gateway holds creds): `CLAUDE_CODE_SKIP_BEDROCK_AUTH=1`.
- Service tier: `ANTHROPIC_BEDROCK_SERVICE_TIER` = `default` | `flex` | `priority` (sent as `X-Amzn-Bedrock-Service-Tier`).
- Mantle endpoint: `CLAUDE_CODE_USE_MANTLE`, `ANTHROPIC_BEDROCK_MANTLE_BASE_URL`, `CLAUDE_CODE_SKIP_MANTLE_AUTH`. `availableModels` entries starting `anthropic.` become Mantle picker options.
- Model pinning (cross-region inference profile IDs, `us.` prefix; `us-gov.` in GovCloud):
  `ANTHROPIC_DEFAULT_OPUS_MODEL='us.anthropic.claude-opus-4-8'`, `ANTHROPIC_DEFAULT_SONNET_MODEL='us.anthropic.claude-sonnet-4-6'`, `ANTHROPIC_DEFAULT_HAIKU_MODEL='us.anthropic.claude-haiku-4-5-20251001-v1:0'`. Unpinned defaults: primary `us.anthropic.claude-opus-4-8`, small/fast `us.anthropic.claude-sonnet-4-5-20250929-v1:0`. Background tasks use the default Sonnet (not Haiku) unless a Haiku model is pinned.
  Multiple versions per family → `modelOverrides` (Anthropic ID → application inference profile ARN).
- Credential-refresh settings (settings.json): `awsAuthRefresh` (runs when creds expired; modifies `.aws`, output shown, e.g. `aws sso login --profile myprofile`) and `awsCredentialExport` (runs at session start/reload; must print JSON `{"Credentials":{AccessKeyId,SecretAccessKey,SessionToken,Expiration}}`, flat `aws configure export-credentials --format process` format accepted from v2.1.181; cached until 5 min before `Expiration`, else 1 h).
- Credential-chain behavior: `CLAUDE_CODE_AWS_CHAIN_RESOLVE_TIMEOUT_MS` (default 60000, v2.1.207+); `CLAUDE_CODE_SKIP_AWS_CRED_CACHE=1` disables per-request credential caching (v2.1.207+).
- `CLAUDE_CODE_DISABLE_BEDROCK_CONTENT_TYPE_GUARD=1` skips the eventstream content-type check when a gateway rewrites `Content-Type` (v2.1.208+).
- IAM: policy needs `bedrock:InvokeModel`, `bedrock:InvokeModelWithResponseStream`, `bedrock:ListInferenceProfiles` (see page for full policy).

### 2.7 Google Cloud's Agent Platform (Vertex AI)

Source: https://code.claude.com/docs/en/google-vertex-ai (the docs now call it "Google Cloud's Agent Platform")

```bash
export CLAUDE_CODE_USE_VERTEX=1
export CLOUD_ML_REGION=global        # or 'us', 'eu', or a region like us-east5
export ANTHROPIC_VERTEX_PROJECT_ID=YOUR-PROJECT-ID
```

- Project ID precedence: `GCLOUD_PROJECT` / `GOOGLE_CLOUD_PROJECT` / project in `GOOGLE_APPLICATION_CREDENTIALS` credential file override `ANTHROPIC_VERTEX_PROJECT_ID`; else gcloud config / attached service account.
- Auth: Google Application Default Credentials (supports X.509 workload identity federation from v2.1.121 via `GOOGLE_APPLICATION_CREDENTIALS`). `/logout` unavailable. Skip auth behind a gateway: `CLAUDE_CODE_SKIP_VERTEX_AUTH=1`. Endpoint override: `ANTHROPIC_VERTEX_BASE_URL`.
- `gcpAuthRefresh` (settings key): command run when ADC are expired/unloadable (e.g. `gcloud auth application-default login`); 3-minute timeout; workspace-trust-gated from project settings.
- Per-model region overrides when `CLOUD_ML_REGION=global` and a model lacks a global endpoint: `VERTEX_REGION_CLAUDE_*` family — documented variables: `VERTEX_REGION_CLAUDE_3_5_HAIKU`, `_3_5_SONNET`, `_3_7_SONNET`, `_4_0_OPUS`, `_4_0_SONNET`, `_4_1_OPUS`, `_4_5_OPUS`, `_4_5_SONNET`, `_4_6_OPUS`, `_4_6_SONNET`, `_4_7_OPUS` (v2.1.111+), `_4_8_OPUS` (v2.1.154+), `_5_SONNET` (v2.1.197+), `VERTEX_REGION_CLAUDE_FABLE_5` (v2.1.170+), `VERTEX_REGION_CLAUDE_HAIKU_4_5`. Source: https://code.claude.com/docs/en/env-vars
- Pinning examples: `ANTHROPIC_DEFAULT_OPUS_MODEL='claude-opus-4-8'`, `ANTHROPIC_DEFAULT_HAIKU_MODEL='claude-haiku-4-5@20251001'`. Unpinned defaults: primary `claude-opus-4-8`, small/fast `claude-sonnet-4-5@20250929`.
- MCP tool search off by default here (tools load upfront); `ENABLE_TOOL_SEARCH=true` for Sonnet 4.5+/Opus 4.5+.

### 2.8 Microsoft Foundry

Source: https://code.claude.com/docs/en/microsoft-foundry

```bash
export CLAUDE_CODE_USE_FOUNDRY=1
export ANTHROPIC_FOUNDRY_RESOURCE={resource}
# or: export ANTHROPIC_FOUNDRY_BASE_URL=https://{resource}.services.ai.azure.com/anthropic
```

Auth options: `ANTHROPIC_FOUNDRY_API_KEY` (portal API key); Azure default credential chain (used when neither key nor token set; e.g. `az login`); `ANTHROPIC_FOUNDRY_AUTH_TOKEN` (Entra bearer token, v2.1.203+, takes precedence over both). `CLAUDE_CODE_SKIP_FOUNDRY_AUTH` for gateways injecting their own `Authorization` header. No startup model check — pin deployment names via `ANTHROPIC_DEFAULT_*_MODEL`. `/logout` unavailable.

### 2.9 Claude Platform on AWS

Source: https://code.claude.com/docs/en/env-vars (dedicated page: https://code.claude.com/docs/en/claude-platform-on-aws)

`CLAUDE_CODE_USE_ANTHROPIC_AWS` selects the provider. `ANTHROPIC_AWS_WORKSPACE_ID` (required; sent as `anthropic-workspace-id` header), `ANTHROPIC_AWS_API_KEY` (workspace API key sent as `x-api-key`, wins over SigV4), `ANTHROPIC_AWS_BASE_URL` (default `https://aws-external-anthropic.{AWS_REGION}.api.aws`), `CLAUDE_CODE_SKIP_ANTHROPIC_AWS_AUTH` for self-signing gateways.

### 2.10 LLM gateways

Sources: https://code.claude.com/docs/en/llm-gateway, https://code.claude.com/docs/en/llm-gateway-connect, https://code.claude.com/docs/en/gateways

Minimal config: `ANTHROPIC_BASE_URL` (gateway URL) + one credential — `ANTHROPIC_AUTH_TOKEN` (bearer/`Authorization`), `ANTHROPIC_API_KEY` (`x-api-key`), or `apiKeyHelper` (sent in both headers; for rotating creds). Prefer the `env` block of `~/.claude/settings.json` (or `.claude/settings.local.json`, never the committed project file) so background agents also get it; a settings-file `env` value beats a shell export. Verify with `/status` (`Anthropic base URL` line).

Additional gateway config:
- `ANTHROPIC_CUSTOM_HEADERS` for tenant/routing headers.
- `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1` populates `/model` from the gateway's `/v1/models` (v2.1.129+; off by default).
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` for egress-restricted networks (see §2.12).
- Provider-format gateways: use the provider base-URL + skip-auth pairs instead of `ANTHROPIC_BASE_URL`: `ANTHROPIC_BEDROCK_BASE_URL`+`CLAUDE_CODE_SKIP_BEDROCK_AUTH`, `ANTHROPIC_VERTEX_BASE_URL`+`CLAUDE_CODE_SKIP_VERTEX_AUTH`, `ANTHROPIC_FOUNDRY_BASE_URL`(+key/token or `CLAUDE_CODE_SKIP_FOUNDRY_AUTH`), `ANTHROPIC_AWS_BASE_URL`+`CLAUDE_CODE_SKIP_ANTHROPIC_AWS_AUTH`.
- Subscriptions: while a gateway credential or `apiKeyHelper` is active, the claude.ai subscription is not used; `ANTHROPIC_BASE_URL` alone does not replace a saved login.
- Anthropic also ships **Claude apps gateway** (self-hosted, `claude gateway --config gateway.yaml`, SSO sign-in via `/login`, `forceLoginMethod: "gateway"`): https://code.claude.com/docs/en/claude-apps-gateway

### 2.11 Proxy, TLS, and mTLS

Source: https://code.claude.com/docs/en/network-config

- `HTTPS_PROXY` / `HTTP_PROXY` — standard proxy vars; basic auth via `http://user:pass@host:port`. SOCKS proxies are **not** supported.
- `NO_PROXY` — bypass list (space- or comma-separated; `*` bypasses all).
- `CLAUDE_CODE_PROXY_RESOLVES_HOSTS=1` — let the proxy do DNS resolution.
- CA trust: default `CLAUDE_CODE_CERT_STORE=bundled,system` (bundled Mozilla set + OS store; OS store needs `tls.getCACertificates` — native binary, or Node ≥22.15 for npm installs). Custom CA: `NODE_EXTRA_CA_CERTS=/path/ca.pem`. `CLAUDE_CODE_CERT_STORE` has no settings.json schema key — set it in `env`.
- mTLS: `CLAUDE_CODE_CLIENT_CERT`, `CLAUDE_CODE_CLIENT_KEY`, `CLAUDE_CODE_CLIENT_KEY_PASSPHRASE` (optional). Files re-read whenever settings apply; rotate by replacing files in place. Cloud sessions ignore these (plus `NODE_TLS_REJECT_UNAUTHORIZED`, `CLAUDE_CODE_OAUTH_SCOPES`) from settings `env` blocks.
- Background agents: set network vars in settings `env` (not shell exports) — the shared supervisor process won't reliably inherit shell exports. Corporate launcher: `processWrapper` setting / `CLAUDE_CODE_PROCESS_WRAPPER` env (v2.1.208+; env wins; user/managed settings only).
- Allowlist hosts (full table on the page): `api.anthropic.com`, `claude.ai`, `claude.com`, `platform.claude.com`, `mcp-proxy.anthropic.com`, `downloads.claude.ai`, `storage.googleapis.com`, `bridge.claudeusercontent.com`, `raw.githubusercontent.com`, two Datadog intake hosts (optional telemetry), `formulae.brew.sh`, `code.claude.com`.

### 2.12 Disabling non-essential traffic and telemetry

Sources: https://code.claude.com/docs/en/env-vars, https://code.claude.com/docs/en/network-config#network-access-requirements

| Variable | Effect |
| --- | --- |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | Any non-empty value disables auto-updates, telemetry, error reporting, `/feedback`, release notes, gateway model-discovery refresh, and availability checks (e.g. fast mode). Does not cover marketplace auto-install (see below). WebFetch preflight unaffected (use `skipWebFetchPreflight`). |
| `DISABLE_TELEMETRY` | `1` opts out of Anthropic operational telemetry (Statsig-style events); also disables feature-flag fetching (like `DISABLE_GROWTHBOOK`). |
| `DO_NOT_TRACK` | `1` — cross-tool convention, equivalent to `DISABLE_TELEMETRY`. |
| `DISABLE_ERROR_REPORTING` | `1` opts out of error reporting (Datadog intake). |
| `DISABLE_GROWTHBOOK` | `1` disables feature-flag fetching; code defaults used. |
| `DISABLE_AUTOUPDATER` | `1` disables background auto-updates (manual `claude update` still works). |
| `DISABLE_UPDATES` | `1` blocks all updates including manual `claude update`/`claude install`. |
| `CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL` | `1` skips auto-adding the official plugin marketplace on first run. |
| `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY` | `1` disables session quality surveys (also disabled by the three opt-outs above unless `CLAUDE_CODE_ENABLE_FEEDBACK_SURVEY_FOR_OTEL=1`). Sample rate: `feedbackSurveyRate` setting (0–1). |
| `skipWebFetchPreflight` (settings) | Skips WebFetch's per-hostname safety check against `api.anthropic.com` (for restricted-egress Bedrock/Vertex/Foundry deployments). |
| `CLAUDE_CODE_ENABLE_TELEMETRY` | `1` enables **OpenTelemetry** export (your own collector) — distinct from Anthropic telemetry. Configure with standard `OTEL_*` exporter vars; see https://code.claude.com/docs/en/monitoring-usage |

OpenTelemetry-related knobs (all in https://code.claude.com/docs/en/env-vars): `OTEL_METRICS_EXPORTER`, `OTEL_LOGS_EXPORTER`, `OTEL_EXPORTER_OTLP_ENDPOINT`/`_PROTOCOL`/`_HEADERS`, `OTEL_METRIC_EXPORT_INTERVAL`, `OTEL_RESOURCE_ATTRIBUTES` (standard); plus `OTEL_LOG_USER_PROMPTS`, `OTEL_LOG_ASSISTANT_RESPONSES` (v2.1.193+), `OTEL_LOG_TOOL_CONTENT`, `OTEL_LOG_TOOL_DETAILS`, `OTEL_LOG_RAW_API_BODIES` (`1` or `file:<dir>`), `OTEL_METRICS_INCLUDE_ACCOUNT_UUID` (default true), `OTEL_METRICS_INCLUDE_SESSION_ID` (default true), `OTEL_METRICS_INCLUDE_VERSION` (default false), `OTEL_METRICS_INCLUDE_ENTRYPOINT` (default false, v2.1.152+), `OTEL_METRICS_INCLUDE_RESOURCE_ATTRIBUTES` (default true, v2.1.161+), `OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT` (v2.1.214+), `CLAUDE_CODE_OTEL_CONTENT_MAX_LENGTH` (default 61440, v2.1.214+), `CLAUDE_CODE_OTEL_DIAG_STDERR` (v2.1.179+), `CLAUDE_CODE_OTEL_FLUSH_TIMEOUT_MS` (default 5000), `CLAUDE_CODE_OTEL_SHUTDOWN_TIMEOUT_MS` (default 2000), `CLAUDE_CODE_OTEL_HEADERS_HELPER_DEBOUNCE_MS` (default 1740000), and the `otelHeadersHelper` settings key (script generating dynamic OTel headers).

---

## 3. Settings files

Source: https://code.claude.com/docs/en/settings

### 3.1 Locations and precedence

Highest to lowest (https://code.claude.com/docs/en/settings#settings-precedence):

1. **Managed settings** — cannot be overridden, even by CLI args. Within the managed tier only ONE source wins (they are not merged), in this order: `policyHelper` output > remote server-managed (claude.ai admin console or Claude apps gateway) > MDM/OS policies > file-based (`managed-settings.json` + `managed-settings.d/*.json`, merged together) > HKCU registry (Windows, user-writable, lowest).
2. **Command-line arguments** — including `--settings <file-or-json>`, which merges key-by-key over lower layers.
3. **Local project settings** — `.claude/settings.local.json` (gitignored when Claude Code creates it; since v2.1.211 resolved to the git repository root, worktree-aware; also where "don't ask again" permission approvals are saved).
4. **Shared project settings** — `.claude/settings.json` (committed; its permission `allow` rules require workspace trust).
5. **User settings** — `~/.claude/settings.json`.

Merging: scalar values override; **array settings concatenate and deduplicate across scopes** (e.g. `permissions.allow`, `sandbox.filesystem.allowWrite`). Two exceptions: `fallbackModel` (highest-precedence file supplies the whole chain) and `availableModels` (managed list replaces lower scopes, v2.1.175+).

Managed settings delivery: macOS `com.anthropic.claudecode` plist domain; Windows `HKLM\SOFTWARE\Policies\ClaudeCode` (`Settings` value with JSON), user-level `HKCU\...`; file-based dirs — macOS `/Library/Application Support/ClaudeCode/`, Linux/WSL `/etc/claude-code/`, Windows `C:\Program Files\ClaudeCode\` (legacy `C:\ProgramData\ClaudeCode` unsupported since v2.1.75). Drop-in `managed-settings.d/` merges alphabetically (later files override scalars, arrays concat, objects deep-merge). Managed settings parse tolerantly (invalid entries stripped, rest enforced — v2.1.169+); user/project/local files are strict. `requiredMinimumVersion`/`requiredMaximumVersion` fail open by design.

Hot reload: most keys apply on file change (incl. `permissions`, `hooks`, `apiKeyHelper`); `model` and `outputStyle` are read once at startup. A `ConfigChange` hook fires per detected change. `$schema`: https://json.schemastore.org/claude-code-settings.json. Verify via `/status` → `Setting sources`. Claude Code keeps the five most recent timestamped config backups.

### 3.2 Available settings (settings.json keys)

Full table from https://code.claude.com/docs/en/settings#available-settings (defaults noted where documented):

| Key | Purpose (default) |
| --- | --- |
| `advisorModel` | Model for the server-side advisor tool (`"opus"`, `"sonnet"`, or full ID); unset disables. |
| `agent` | Run the main thread as a named subagent; default agent for `claude agents` dispatch. |
| `agentPushNotifEnabled` | (false) Proactive mobile pushes when Remote Control connected. v2.1.119+. |
| `allowAllClaudeAiMcps` | (Managed only) Load claude.ai connectors alongside `managed-mcp.json`. |
| `allowedChannelPlugins` | (Managed only) Allowlist of channel plugins. |
| `allowedHttpHookUrls` | Allowlist of URL patterns HTTP hooks may target (`*` wildcard; merges across sources). |
| `allowedMcpServers` | (Managed) Allowlist of MCP servers (`[{"serverName": "github"}]`); empty array = lockdown; denylist wins. |
| `allowManagedHooksOnly` | (Managed only) Only managed/SDK/force-enabled-plugin hooks load. |
| `allowManagedMcpServersOnly` | (Managed only) Only the managed MCP allowlist applies. |
| `allowManagedPermissionRulesOnly` | (Managed only) User/project permission rules ignored. |
| `alwaysThinkingEnabled` | Extended thinking on by default. |
| `apiKeyHelper` | Auth-value generator command (see §2.1). |
| `askUserQuestionTimeout` | ("never") Idle time before AskUserQuestion auto-continues: `"60s"`, `"5m"`, `"10m"`, `"never"`. v2.1.200+. |
| `attribution` | `{commit, pr, sessionUrl}` — commit-trailer / PR attribution text ("" hides); `sessionUrl` (default true) appends a `Claude-Session` trailer from web/Remote Control sessions. |
| `autoCompactEnabled` | (true) Auto-compact near context limit. |
| `autoMemoryDirectory` | Custom auto-memory dir (absolute or `~/`); trust-gated from project/local. |
| `autoMemoryEnabled` | (true) Auto memory on/off. |
| `autoMode` | Auto-mode classifier rules: `environment`, `allow`, `soft_deny`, `hard_deny` arrays; `"$defaults"` inherits built-ins. User/`--settings`/managed only. |
| `autoMode.classifyAllShell` | (false) Route every shell command through the classifier. v2.1.193+. |
| `autoScrollEnabled` | (true) Follow output to bottom in fullscreen renderer. |
| `autoUpdatesChannel` | ("latest") `"latest"` or `"stable"` release channel. |
| `availableModels` | Model allowlist (see §2.3). |
| `awaySummaryEnabled` | Session recap on return. |
| `awsAuthRefresh` / `awsCredentialExport` | AWS credential scripts (see §2.6). |
| `axScreenReader` | Screen-reader-friendly rendering. v2.1.181+. |
| `blockedMarketplaces` | (Managed only) Marketplace blocklist. |
| `browserExternalPageTools` | (Managed only) `"disabled"` blocks tools on external pages in the desktop Browser pane. |
| `channelsEnabled` | (Managed only) Allow channels for the org. |
| `claudeMd` | (Managed only) Org-injected CLAUDE.md-style instructions. |
| `claudeMdExcludes` | Globs/paths of CLAUDE.md files to skip. |
| `cleanupPeriodDays` | (30, min 1) Session-file retention sweep at startup; `0` invalid. |
| `companyAnnouncements` | Startup announcement strings (cycled randomly). |
| `defaultShell` | ("bash"; "powershell" on Windows w/o Git Bash) Shell for input-box `!` commands. |
| `deniedMcpServers` | (Managed) MCP denylist; wins over allowlist. |
| `disableAgentView` | Turn off background agents/agent view. |
| `disableAllHooks` | Disable all hooks and custom status line. |
| `disableArtifact` / `enableArtifact` | Artifact tool off / per-user enable (enable: user settings only, v2.1.196+). |
| `disableAutoMode` | `"disable"` prevents auto mode. |
| `disableBrowserExternalNavigation` | (Managed only) No external browsing in desktop Browser pane. |
| `disableBundledSkills` | Remove bundled skills/workflows. |
| `disableClaudeAiConnectors` | Don't fetch claude.ai MCP connectors; `true` in any scope wins. v2.1.182+. |
| `disableDeepLinkRegistration` | `"disable"` prevents `claude-cli://` handler registration. |
| `disabledMcpjsonServers` | Reject named servers from `.mcp.json`. |
| `disableRemoteControl` | Block Remote Control. v2.1.128+. |
| `disableSideloadFlags` | (Managed only) Reject `--plugin-dir`, `--plugin-url`, `--agents`, `--mcp-config`. v2.1.193+. |
| `disableSkillShellExecution` | Disable inline `` !`...` `` shell execution in skills/commands. |
| `disableWorkflows` | (false) Disable dynamic workflows. |
| `editorMode` | ("normal") `"normal"` or `"vim"`. |
| `effortLevel` | Persisted effort: low/medium/high/xhigh. |
| `enableAllProjectMcpServers` | Auto-approve all `.mcp.json` servers. |
| `enabledMcpjsonServers` | Approve named `.mcp.json` servers. |
| `enforceAvailableModels` | Extend allowlist to the Default model. v2.1.175+. |
| `env` | Env vars applied to every session and subprocess. `""` overrides a shell export with empty (treated as unset for provider selection). Host identity vars (`CLAUDE_CODE_REMOTE`, `CLAUDE_CODE_ACCOUNT_UUID`) ignored here (v2.1.195+). |
| `fallbackModel` | Fallback chain (see §2.3). |
| `fastMode` / `fastModePerSessionOptIn` | Fast mode default on / require per-session opt-in. |
| `feedbackSurveyRate` | Survey probability 0–1. |
| `fileCheckpointingEnabled` | (true) Snapshots for `/rewind`. |
| `fileSuggestion` | Custom `@`-autocomplete script `{type:"command", command}`. |
| `footerLinksRegexes` | Regex→URL footer badges. User/`--settings`/managed only. v2.1.176+. |
| `forceLoginMethod` / `forceLoginGatewayUrl` / `forceLoginOrgUUID` | Login restriction (see §2.1). |
| `forceRemoteSettingsRefresh` | (Managed only) Fail-closed startup until remote settings fetched. |
| `gcpAuthRefresh` | GCP ADC refresh command (see §2.7). |
| `hooks` | Lifecycle hook configuration (see §7.1). |
| `httpHookAllowedEnvVars` | Env-var names HTTP hooks may interpolate into headers. |
| `includeGitInstructions` | (true) Built-in commit/PR instructions + git status in system prompt. |
| `inputNeededNotifEnabled` | (false) Push when a prompt awaits input (Remote Control). v2.1.119+. |
| `language` | Preferred response language. |
| `minimumVersion` | Floor for updates (prevents downgrade; doesn't block startup). |
| `model` | Default model. |
| `modelOverrides` | Anthropic ID → provider ID map (see §2.3). |
| `otelHeadersHelper` | Dynamic OTel headers script. |
| `outputStyle` | Output style name (system-prompt adjustment). |
| `parentSettingsBehavior` | (Managed only; "first-wins") `"merge"` lets embedder-supplied managed settings apply under the admin tier. v2.1.133+. |
| `permissions` | See §3.3. |
| `plansDirectory` | (`~/.claude/plans`) Where plan files are stored. |
| `pluginSuggestionMarketplaces` | (Managed only) Marketplaces whose plugins may surface as suggestions. |
| `pluginTrustMessage` | (Managed only) Custom plugin trust-warning text. |
| `policyHelper` | (MDM/system file only) Executable computing managed settings: `{path, timeoutMs, refreshIntervalMs}`; helper prints `{"managedSettings": {...}, "claudeMd": ..., "appendSystemPrompt": ...}`; non-zero exit at startup blocks launch. v2.1.136+. |
| `preferredNotifChannel` | ("auto") auto / terminal_bell / iterm2 / iterm2_with_bell / kitty / ghostty / notifications_disabled. |
| `prefersReducedMotion` | Reduce UI animations. |
| `processWrapper` | Corporate launcher for background processes (managed/`--settings`/user only; env var wins). v2.1.210+. |
| `prUrlTemplate` | PR badge URL template (`{host} {owner} {repo} {number} {url}`). |
| `remoteControlAtStartup` | Auto-connect Remote Control each session. v2.1.119+. |
| `requiredMinimumVersion` / `requiredMaximumVersion` | (Managed only) Hard version floor/ceiling — blocks startup outside range. |
| `respectGitignore` | (true) `@` file picker respects .gitignore. |
| `respondToBashCommands` | (true) Claude responds after input-box `!` commands. v2.1.186+. |
| `sandbox` | See §3.4. |
| `showClearContextOnPlanAccept` | (false) Show "clear context" on plan accept. |
| `showThinkingSummaries` | (false) Full thinking summaries in interactive sessions. |
| `showTurnDuration` | (true) "Cooked for 1m 6s" messages. |
| `skillListingBudgetFraction` | (0.01) Context fraction for the skill listing. |
| `skillListingMaxDescChars` | (1536) Per-skill description cap. |
| `skillOverrides` | Per-skill visibility: on / name-only / user-invocable-only / off. v2.1.129+. |
| `skipWebFetchPreflight` | Skip WebFetch domain safety check. |
| `spinnerTipsEnabled` / `spinnerTipsOverride` / `spinnerVerbs` | Spinner tips & verbs customization. |
| `sshConfigs` | Desktop SSH connection presets (managed/user only). |
| `statusLine` | Custom status line `{type:"command", command, padding?, refreshInterval?, hideVimModeIndicator?}`. |
| `strictKnownMarketplaces` | (Managed only) Marketplace allowlist. |
| `strictPluginOnlyCustomization` | (Managed only) Block skills/agents/hooks/MCP from user+project sources (`true` or array of surfaces). |
| `syntaxHighlightingDisabled` | Disable syntax highlighting. |
| `teammateMode` | ("in-process") Agent-team display: in-process / auto / tmux / iterm2. |
| `terminalProgressBarEnabled` | (true) Terminal progress bar. |
| `theme` | ("dark") auto/dark/light/…-daltonized/…-ansi/custom:<slug>. |
| `tui` | `"fullscreen"` or `"default"` renderer. |
| `ultracode` | Session-only ultracode toggle (not read from settings.json; via `--settings`/SDK/`/effort ultracode`). |
| `useAutoModeDuringPlan` | (true) Plan mode uses auto-mode semantics. |
| `verbose` | (false) Full tool output. |
| `viewMode` | Startup transcript view: default/verbose/focus. |
| `vimInsertModeRemaps` | Two-key INSERT-mode → `<Esc>` remaps (user/`--settings`/managed only). v2.1.208+. |
| `voice` / `voiceEnabled` | Voice dictation settings / legacy alias. |
| `wheelScrollAccelerationEnabled` | (true) Wheel acceleration in fullscreen. v2.1.174+. |
| `workflowKeywordTriggerEnabled` | (true) `ultracode` keyword triggers workflows. v2.1.157+. |
| `wslInheritsWindowsSettings` | (Windows managed only) WSL reads Windows policy chain. |
| `worktree.*` | `baseRef` ("fresh"|"head"), `symlinkDirectories`, `sparsePaths`, `bgIsolation` ("worktree"|"none"). |

Note: `includeCoAuthoredBy` is no longer in the settings reference — commit/PR attribution is now configured via the `attribution` object. (Historical key; current docs document only `attribution`.)

### 3.3 Permission settings

Source: https://code.claude.com/docs/en/settings#permission-settings (rule syntax detail: https://code.claude.com/docs/en/permissions)

| Key | Purpose |
| --- | --- |
| `permissions.allow` | Allow rules, e.g. `"Bash(git diff *)"`. MCP tool-name globs only after a literal `mcp__<server>__` prefix. |
| `permissions.ask` | Confirmation rules. |
| `permissions.deny` | Deny rules; tool names accept globs (`"*"`, `"mcp__*"`); used to exclude sensitive files, e.g. `"Read(./.env)"`, `"Read(./secrets/**)"`. Replaces the deprecated `ignorePatterns`. |
| `permissions.additionalDirectories` | Extra working directories (file access only; `.claude/` config not discovered there). |
| `permissions.defaultMode` | Startup permission mode: `default`, `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions`, `manual` (alias of default, v2.1.200+). `auto` ignored in project/local settings (v2.1.142+). `--permission-mode` overrides per session. |
| `permissions.disableBypassPermissionsMode` | `"disable"` blocks bypassPermissions / `--dangerously-skip-permissions`. |
| `permissions.skipDangerousModePermissionPrompt` | Skip bypass-mode confirmation prompt (ignored in project settings). |

Rules are `Tool` or `Tool(specifier)`; evaluated deny → ask → allow, first match wins. Examples: `Bash(npm run *)`, `Read(./.env)`, `WebFetch(domain:example.com)`.

### 3.4 Sandbox settings (`sandbox.*`)

Source: https://code.claude.com/docs/en/settings#sandbox-settings (concept: https://code.claude.com/docs/en/sandboxing)

| Key | Purpose (default) |
| --- | --- |
| `enabled` | (false) Bash sandboxing on macOS/Linux/WSL2. |
| `failIfUnavailable` | (false) Exit at startup if sandbox can't start. |
| `autoAllowBashIfSandboxed` | (true) Auto-approve bash when sandboxed. |
| `excludedCommands` | Commands run outside the sandbox (`["docker *"]`). |
| `allowUnsandboxedCommands` | (true) Permit the `dangerouslyDisableSandbox` escape hatch; `false` forbids it. |
| `filesystem.allowWrite` / `denyWrite` / `denyRead` / `allowRead` | Path rules, merged across scopes and with Edit/Read permission rules. Path prefixes: `/` absolute, `~/` home, `./`/bare = project-relative (project settings) or `~/.claude`-relative (user settings); legacy `//` absolute still works. |
| `filesystem.allowManagedReadPathsOnly` | (Managed only, false) Only managed allowRead respected. |
| `credentials.files` | `{path, mode:"deny"}` credential files blocked from sandboxed reads. v2.1.187+. |
| `credentials.envVars` | `{name, mode:"deny"|"mask"}`; `deny` strips var from sandboxed env; `mask` (v2.1.199+, requires `network.tlsTerminate`; user/managed/`--settings` only) substitutes a sentinel, real value injected by the proxy on `injectHosts`. |
| `credentials.envVars[].injectHosts`, `credentials.allowPlaintextInject` | Mask substitution hosts; allow plain-HTTP injection (default false). |
| `network.allowedDomains` / `deniedDomains` | Outbound domain allow/deny (wildcards; deny wins; deny merges from all sources). |
| `network.allowManagedDomainsOnly` | (Managed only, false) Only managed allowlist domains. |
| `network.allowUnixSockets` (macOS) / `allowAllUnixSockets` | Unix socket access. |
| `network.allowLocalBinding` | (macOS, false) Bind localhost ports. |
| `network.allowMachLookup` | (macOS) Extra XPC/Mach services. |
| `network.httpProxyPort` / `socksProxyPort` | Bring-your-own sandbox proxy ports. |
| `network.tlsTerminate` | Experimental TLS termination in the sandbox proxy (`{}` = ephemeral CA, or `caCertPath`/`caKeyPath`). v2.1.199+. |
| `enableWeakerNestedSandbox` | (false) Weaker sandbox for unprivileged Docker (Linux/WSL2). Reduces security. |
| `enableWeakerNetworkIsolation` | (macOS, false) Allow `com.apple.trustd.agent` (for Go tools + MITM proxy). Reduces security. |
| `allowAppleEvents` | (macOS, false) Allow Apple Events (`open`, `osascript`). Removes code-exec isolation. User/managed/CLI settings only. |
| `bwrapPath` / `socatPath` | (Managed only, Linux/WSL2) Absolute paths to `bwrap`/`socat`. |

---

## 4. Environment variables — complete reference

Source: https://code.claude.com/docs/en/env-vars (single authoritative table; fetched 2026-07-22). Variables already detailed in §2 are listed briefly. Numeric vars accept scientific notation and digit separators (`2e3`, `64_000`) except where noted (v2.1.211+ behavior).

### Provider / API (see §2 for details)
`ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_CUSTOM_HEADERS`, `ANTHROPIC_BETAS`, `ANTHROPIC_MODEL`, `ANTHROPIC_SMALL_FAST_MODEL` (deprecated), `ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION`, `ANTHROPIC_DEFAULT_{FABLE,OPUS,SONNET,HAIKU}_MODEL` (+`_NAME`/`_DESCRIPTION`/`_SUPPORTED_CAPABILITIES`), `ANTHROPIC_CUSTOM_MODEL_OPTION` (+companions), `ANTHROPIC_WORKSPACE_ID`, `ANTHROPIC_AWS_API_KEY`, `ANTHROPIC_AWS_BASE_URL`, `ANTHROPIC_AWS_WORKSPACE_ID`, `ANTHROPIC_BEDROCK_BASE_URL`, `ANTHROPIC_BEDROCK_MANTLE_BASE_URL`, `ANTHROPIC_BEDROCK_SERVICE_TIER`, `ANTHROPIC_FOUNDRY_API_KEY`, `ANTHROPIC_FOUNDRY_AUTH_TOKEN`, `ANTHROPIC_FOUNDRY_BASE_URL`, `ANTHROPIC_FOUNDRY_RESOURCE`, `ANTHROPIC_VERTEX_BASE_URL`, `ANTHROPIC_VERTEX_PROJECT_ID`, `AWS_BEARER_TOKEN_BEDROCK`, `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY`, `CLAUDE_CODE_USE_MANTLE`, `CLAUDE_CODE_USE_ANTHROPIC_AWS`, `CLAUDE_CODE_SKIP_{BEDROCK,VERTEX,FOUNDRY,MANTLE,ANTHROPIC_AWS}_AUTH`, `CLAUDE_CODE_AWS_CHAIN_RESOLVE_TIMEOUT_MS`, `CLAUDE_CODE_SKIP_AWS_CRED_CACHE`, `CLAUDE_CODE_DISABLE_BEDROCK_CONTENT_TYPE_GUARD`, `VERTEX_REGION_CLAUDE_*` (full list in §2.7), `CLOUD_ML_REGION` (documented on the Vertex page).

### Timeouts / retries / streaming (see §2.4)
`API_TIMEOUT_MS`, `API_FORCE_IDLE_TIMEOUT`, `CLAUDE_CODE_MAX_RETRIES`, `CLAUDE_CODE_RETRY_WATCHDOG`, `CLAUDE_STREAM_IDLE_TIMEOUT_MS`, `CLAUDE_ENABLE_STREAM_WATCHDOG`, `CLAUDE_ENABLE_BYTE_WATCHDOG`, `CLAUDE_ENABLE_BYTE_WATCHDOG_BEDROCK`, `CLAUDE_CODE_CONNECT_TIMEOUT_MS` (removed v2.1.186), `FALLBACK_FOR_ALL_PRIMARY_MODELS`, `MAX_STRUCTURED_OUTPUT_RETRIES`.

### Tokens / caching / context (see §2.3–2.5)
`CLAUDE_CODE_MAX_OUTPUT_TOKENS`, `MAX_THINKING_TOKENS`, `CLAUDE_CODE_MAX_CONTEXT_TOKENS`, `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`, `CLAUDE_CODE_DISABLE_1M_CONTEXT`, `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING`, `CLAUDE_CODE_DISABLE_THINKING`, `CLAUDE_CODE_EFFORT_LEVEL`, `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT`, `DISABLE_PROMPT_CACHING{,_HAIKU,_SONNET,_OPUS,_FABLE}`, `ENABLE_PROMPT_CACHING_1H`(`_BEDROCK` deprecated), `FORCE_PROMPT_CACHING_5M`, `DISABLE_AUTO_COMPACT`, `DISABLE_COMPACT`, `DISABLE_INTERLEAVED_THINKING`.

### Auth / OAuth (see §2.1)
`CLAUDE_CODE_OAUTH_TOKEN`, `CLAUDE_CODE_OAUTH_REFRESH_TOKEN`, `CLAUDE_CODE_OAUTH_SCOPES`, `CLAUDE_CODE_API_KEY_HELPER_TTL_MS`.

### Proxy / TLS (see §2.11)
`HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`, `CLAUDE_CODE_PROXY_RESOLVES_HOSTS`, `CLAUDE_CODE_CERT_STORE`, `NODE_EXTRA_CA_CERTS`, `CLAUDE_CODE_CLIENT_CERT`, `CLAUDE_CODE_CLIENT_KEY`, `CLAUDE_CODE_CLIENT_KEY_PASSPHRASE`.

### Bash / shell tools

| Variable | Purpose (default) |
| --- | --- |
| `BASH_DEFAULT_TIMEOUT_MS` | Default bash command timeout (120000 = 2 min). |
| `BASH_MAX_TIMEOUT_MS` | Max timeout the model may set (600000 = 10 min). |
| `BASH_MAX_OUTPUT_LENGTH` | Char cap before output spills to a file with preview. |
| `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR` | Return to original cwd after each command. |
| `CLAUDE_CODE_SHELL` | Path to `bash`/`zsh` for the Bash tool (others unsupported; falls back to auto-detect). |
| `CLAUDE_CODE_SHELL_PREFIX` | Wrapper command for spawned shell commands/hooks/status line/stdio MCP (wrapper receives command as `$1`). |
| `CLAUDE_ENV_FILE` | Shell script sourced before each Bash command (persist venv/conda activation; also populated by SessionStart/Setup/CwdChanged/FileChanged hooks). |
| `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` | `1` strips Anthropic/cloud credentials from subprocess envs; Linux: isolated PID namespace. |
| `CLAUDE_CODE_SCRIPT_CAPS` | JSON `{substring: maxCalls}` per-session script-invocation caps (with env scrub). |
| `CLAUDE_CODE_USE_POWERSHELL_TOOL` | PowerShell tool control (auto on Windows w/o Git Bash; `1` opt-in elsewhere, needs `pwsh`). |
| `CLAUDE_CODE_POWERSHELL_RESPECT_EXECUTION_POLICY` | `1` stops passing `-ExecutionPolicy Bypass`. |
| `CLAUDE_CODE_GIT_BASH_PATH` | Windows: path to Git Bash `bash.exe`. |
| `CLAUDE_CODE_PERFORCE_MODE` | `1` Perforce-aware write protection (fail edits on non-writable synced files). |
| `CLAUDE_CODE_TMPDIR` | Override temp dir root. |
| `CLAUDE_PID` | Set in subprocesses to Claude Code's own PID. v2.1.214+. |
| `CLAUDECODE` | `1` in all subprocesses Claude Code spawns (and IDE integrated terminals). |
| `CLAUDE_CODE_CHILD_SESSION` | `1` only in subprocesses Claude Code itself spawns (not IDE terminals); nested interactive TUIs excluded from resume/history. v2.1.172+. |
| `CLAUDE_CODE_FORCE_SESSION_PERSISTENCE` | `1` forces transcript persistence for misclassified nested sessions. |
| `CLAUDE_CODE_SESSION_ID` | Set in tool/hook/stdio-MCP subprocesses to the session ID. |
| `CLAUDE_EFFORT` | Set in subprocesses to the turn's effort level. |
| `CLAUDE_CODE_BRIDGE_SESSION_ID` | Session `session_` ID in subprocesses while Remote Control connected. v2.1.199+. |

### MCP

| Variable | Purpose (default) |
| --- | --- |
| `MCP_TIMEOUT` | Server startup timeout (30000). |
| `MCP_TOOL_TIMEOUT` | Tool execution timeout (100000000 ≈ 28 h); HTTP/SSE/connector per-request limit 60 s unless raised; per-server `timeout` in `.mcp.json` overrides. |
| `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` | Idle timeout for MCP tool calls (defaults 5 min network / 30 min stdio; `0` disables). v2.1.187+. |
| `MAX_MCP_OUTPUT_TOKENS` | Max tokens in MCP tool responses (25000; warning at 10000). |
| `MCP_CONNECTION_NONBLOCKING` | `0` restores blocking 5 s startup connect wait (non-blocking default since v2.1.142). |
| `MCP_CONNECT_TIMEOUT_MS` | Blocking-startup connection batch wait (5000). |
| `MCP_SERVER_CONNECTION_BATCH_SIZE` | Parallel stdio server connects (3). |
| `MCP_REMOTE_SERVER_CONNECTION_BATCH_SIZE` | Parallel HTTP/SSE connects (20). |
| `MCP_CLIENT_SECRET` | OAuth client secret for pre-configured MCP credentials. |
| `MCP_OAUTH_CALLBACK_PORT` | Fixed OAuth callback port. |
| `CLAUDE_CODE_MCP_ALLOWLIST_ENV` | `1` spawns stdio servers with a safe baseline env only. |
| `CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS` | Time before a long MCP call backgrounds (120000; `0` off). v2.1.212+. |
| `ENABLE_TOOL_SEARCH` | MCP tool search: `true` / `auto` / `auto:N` / `false` (see §2.2 note). |
| `ENABLE_CLAUDEAI_MCP_SERVERS` | `false` disables claude.ai connectors. |
| `CLAUDE_AGENT_SDK_MCP_NO_PREFIX` | SDK: skip `mcp__<server>__` prefix. |

### Sessions, subagents, background work

| Variable | Purpose (default) |
| --- | --- |
| `CLAUDE_CODE_TASK_LIST_ID` | Share one task list across sessions. |
| `CLAUDE_CODE_ENABLE_TASKS` | `0` reverts Task tools to `TodoWrite` (Task tools default since v2.1.142). |
| `TASK_MAX_OUTPUT_LENGTH` | Subagent output cap (32000, max 160000; overflow saved to disk). |
| `CLAUDE_CODE_MAX_SUBAGENTS_PER_SESSION` | Subagent cap (200; plain digits only). v2.1.212+. |
| `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` | Parallel read-only tools/subagents (10). |
| `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION` | WebSearch cap (200). v2.1.212+. |
| `CLAUDE_CODE_MAX_TURNS` | Turn cap when `--max-turns` not passed. |
| `CLAUDE_ASYNC_AGENT_STALL_TIMEOUT_MS` | Background-subagent stall timeout (600000). |
| `CLAUDE_AUTO_BACKGROUND_TASKS` | `1` force auto-backgrounding of long tasks. |
| `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` | `1` disables all background-task functionality. |
| `CLAUDE_CODE_DISABLE_AGENT_VIEW` | `1` turns off agent view / background agents. |
| `CLAUDE_CODE_FORK_SUBAGENT` | `1`/`0` enable/disable forked subagents. |
| `CLAUDE_CODE_FORWARD_SUBAGENT_TEXT` | `1` = `--forward-subagent-text` via env. v2.1.211+. |
| `CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS` | `1` disables built-in subagent types (`-p` only). |
| `CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS` | `1` disables built-in Explore/Plan subagents. v2.1.198+. |
| `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS` | `-p` exit wait for background results (600000; `0` = indefinite). v2.1.182+. |
| `CLAUDE_CODE_EXIT_AFTER_STOP_DELAY` | Auto-exit delay after idle (SDK workflows). |
| `CLAUDE_CODE_RESUME_INTERRUPTED_TURN` / `_MAX_AGE_MS` / `CLAUDE_CODE_RESUME_PROMPT` | Auto-resume mid-turn sessions; age bound; custom continuation message. |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | `1` enables agent teams (experimental). |
| `CLAUDE_CODE_TEAM_TEARDOWN_PARK_TIMEOUT_MS` | Team teardown wait (10000; 1000–60000). v2.1.206+. |
| `CLAUDE_DISABLE_ADOPT` / `CLAUDE_CODE_DISABLE_BG_EXIT_HANDOFF` / `CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP` | Background handoff/reaping behavior toggles. |
| `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` | Max consecutive Stop/SubagentStop blocks (8; `0` = no cap). |
| `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` | SessionEnd hook budget (1.5 s default, auto-raised to max configured hook timeout ≤60 s). |

### Feature toggles & UI (selection; full list on the env-vars page)

| Variable | Purpose |
| --- | --- |
| `DISABLE_AUTOUPDATER`, `DISABLE_UPDATES`, `FORCE_AUTOUPDATE_PLUGINS`, `CLAUDE_CODE_PACKAGE_MANAGER_AUTO_UPDATE`, `DISABLE_INSTALLATION_CHECKS` | Update behavior. |
| `DISABLE_TELEMETRY`, `DO_NOT_TRACK`, `DISABLE_ERROR_REPORTING`, `DISABLE_GROWTHBOOK`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | See §2.12. |
| `DISABLE_COST_WARNINGS` | Hide cost warnings. |
| `DISABLE_DOCTOR_COMMAND`, `DISABLE_FEEDBACK_COMMAND` (`DISABLE_BUG_COMMAND` legacy), `DISABLE_EXTRA_USAGE_COMMAND`, `DISABLE_INSTALL_GITHUB_APP_COMMAND`, `DISABLE_LOGIN_COMMAND`, `DISABLE_LOGOUT_COMMAND`, `DISABLE_UPGRADE_COMMAND` | Hide individual slash commands. |
| `CLAUDE_CODE_DISABLE_TERMINAL_TITLE` | `1` disables terminal-title updates (and the title-generation model request in SDK/`-p`). |
| `USE_BUILTIN_RIPGREP` | `0` uses system `rg` instead of the bundled one. |
| `CLAUDE_CODE_USE_NATIVE_FILE_SEARCH` | `1` uses Node file APIs instead of ripgrep for command/agent/output-style discovery. |
| `CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS` | Token limit override for file reads. |
| `CLAUDE_CODE_GLOB_HIDDEN` / `CLAUDE_CODE_GLOB_NO_IGNORE` / `CLAUDE_CODE_GLOB_TIMEOUT_SECONDS` | Glob tool behavior (dotfiles; gitignore; 20 s timeout default, 60 s WSL). |
| `CLAUDE_CODE_DISABLE_ATTACHMENTS` | `1` — `@` mentions sent as plain text. |
| `CLAUDE_CODE_DISABLE_CLAUDE_MDS` | `1` — no CLAUDE.md memory files loaded. |
| `CLAUDE_CODE_DISABLE_AUTO_MEMORY` | `1`/`0` — auto memory off / force on. |
| `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD` | `1` loads memory files from `--add-dir` directories. |
| `CLAUDE_CODE_SKIP_PROMPT_HISTORY` | `1` — no transcripts/prompt history on disk. |
| `CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING` | `1` disables `/rewind` snapshots. |
| `CLAUDE_CODE_DISABLE_BUNDLED_SKILLS`, `CLAUDE_CODE_DISABLE_POLICY_SKILLS`, `CLAUDE_CODE_DISABLE_WORKFLOWS`, `CLAUDE_CODE_DISABLE_CRON`, `CLAUDE_CODE_DISABLE_ADVISOR_TOOL`, `CLAUDE_CODE_DISABLE_ARTIFACT`, `CLAUDE_CODE_DISABLE_FAST_MODE`, `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` | Feature disables (mirror settings keys where noted in §3.2). |
| `CLAUDE_CODE_SAFE_MODE` / `CLAUDE_CODE_SIMPLE` / `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT` | Safe mode (= `--safe-mode`); bare mode (= `--bare`); shorter system prompt. |
| `CLAUDE_CODE_ENABLE_APPEND_SUBAGENT_PROMPT` | Enables subagent-prompt appending (set automatically by the flag). v2.1.205+. |
| `CLAUDE_CODE_SYNC_SKILLS` (+`_INSTALL_TIMEOUT_MS`, `_WAIT_TIMEOUT_MS`) | Sync claude.ai skills into `~/.claude/skills/` in `-p` mode. |
| `CLAUDE_CODE_SYNC_PLUGIN_INSTALL` (+`_TIMEOUT_MS`), `CLAUDE_CODE_ENABLE_BACKGROUND_PLUGIN_REFRESH` | Plugin install synchronization in `-p` mode. |
| `CLAUDE_CODE_PLUGIN_CACHE_DIR`, `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` (120000), `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE`, `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`, `CLAUDE_CODE_PLUGIN_SEED_DIR` | Plugin system knobs. |
| `CLAUDE_CONFIG_DIR` | Override the config directory (default `~/.claude`); enables side-by-side accounts. |
| `CLAUDE_CODE_DEBUG_LOGS_DIR`, `CLAUDE_CODE_DEBUG_LOG_LEVEL`, `DEBUG` | Debug logging (path is a file despite the name; levels verbose/debug/info/warn/error; `DEBUG=1` = `--debug`). |
| `CLAUDE_CODE_IDE_HOST_OVERRIDE`, `CLAUDE_CODE_IDE_SKIP_AUTO_INSTALL`, `CLAUDE_CODE_IDE_SKIP_VALID_CHECK`, `CLAUDE_CODE_AUTO_CONNECT_IDE` | IDE integration overrides. |
| `CLAUDE_CODE_EFFORT_LEVEL`, `CLAUDE_AFK_TIMEOUT_MS`, `CLAUDE_AFK_COUNTDOWN_MS`, `CLAUDE_CLIENT_PRESENCE_FILE`, `CLAUDE_REMOTE_CONTROL_SESSION_NAME_PREFIX` | Session behavior. |
| UI/rendering: `CLAUDE_CODE_NO_FLICKER`, `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN`, `CLAUDE_CODE_ALT_SCREEN_FULL_REPAINT`, `CLAUDE_CODE_DISABLE_MOUSE`, `CLAUDE_CODE_DISABLE_MOUSE_CLICKS`, `CLAUDE_CODE_DISABLE_VIRTUAL_SCROLL`, `CLAUDE_CODE_SCROLL_SPEED`, `CLAUDE_CODE_NATIVE_CURSOR`, `CLAUDE_CODE_ACCESSIBILITY`, `CLAUDE_AX_SCREEN_READER`, `CLAUDE_CODE_FORCE_SYNC_OUTPUT`, `CLAUDE_CODE_FORCE_STRIKETHROUGH`, `CLAUDE_CODE_TMUX_TRUECOLOR`, `CLAUDE_CODE_SYNTAX_HIGHLIGHT`, `CLAUDE_CODE_HIDE_CWD`, `FORCE_HYPERLINK`, `NO_COLOR`, `FORCE_COLOR`, `IS_DEMO`, `CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION`, `CLAUDE_CODE_ENABLE_AWAY_SUMMARY`, `CLAUDE_CODE_ARTIFACT_AUTO_OPEN`, `CLAUDE_CODE_DISABLE_NOTIFICATION_PRESENCE_CHECK`, `CLAUDE_CODE_NEW_INIT`, `SLASH_COMMAND_TOOL_CHAR_BUDGET`. | See env-vars page rows. |
| Set automatically (read-only signals): `CLAUDE_CODE_REMOTE` (cloud session), `CLAUDE_CODE_REMOTE_SESSION_ID`, `CLAUDE_CODE_ACCOUNT_UUID`, `CLAUDECODE`, `CLAUDE_CODE_CHILD_SESSION`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_EFFORT`, `CLAUDE_PID`, `CLAUDE_CODE_BRIDGE_SESSION_ID`. | — |
| Misc: `CCR_FORCE_BUNDLE` (`--cloud` upload bundling), `CLAUDE_CODE_PROCESS_WRAPPER`, `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST`, `CLAUDE_CODE_SKIP_FAST_MODE_NETWORK_ERRORS`, `CLAUDE_CODE_SKIP_FAST_MODE_ORG_CHECK`, `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY`, `CLAUDE_CODE_ENABLE_FEEDBACK_SURVEY_FOR_OTEL`, `CLAUDE_CODE_ENABLE_AUTO_MODE` (no-op since v2.1.207). | — |

---

## 5. CLI reference

Source: https://code.claude.com/docs/en/cli-reference (fetched 2026-07-22)

### 5.1 Commands

`claude` (interactive), `claude "query"`, `claude -p "query"` (print/SDK mode), `cat file | claude -p`, `claude -c` / `--continue`, `claude -r "<session>"` / `--resume`, `claude update`, `claude install [stable|latest|version]`, `claude doctor`, `claude setup-token`, `claude gateway --config gateway.yaml`, `claude auth login [--email|--sso|--console]` / `auth logout` / `auth status [--text]`, `claude agents`, `claude attach <id>`, `claude logs <id>`, `claude respawn <id>`, `claude rm <id>`, `claude stop <id>` / `claude kill`, `claude daemon status` / `daemon stop --any`, `claude auto-mode defaults [--label]` / `auto-mode config` / `auto-mode reset [--yes]`, `claude mcp ...` (see §6.2), `claude mcp login|logout <name>`, `claude plugin ...`, `claude project purge [path] [--dry-run]`, `claude remote-control`, `claude ultrareview [target]`.

**`claude config` subcommands (`list`/`get`/`set`/`add`/`remove`)**: NOT present in the current CLI reference or settings docs. The historical `claude config` command family appears to have been removed from the documentation; configuration is now done by editing settings files, `/config` in-session, or CLI flags. UNVERIFIED whether the binary still accepts them as a hidden/legacy alias — treat them as deprecated.

### 5.2 Flags (complete list)

Configuration-relevant flags, all from https://code.claude.com/docs/en/cli-reference#cli-flags:

- Model/effort: `--model <alias|name>`, `--fallback-model <list>`, `--effort low|medium|high|xhigh|max|ultracode`, `--advisor <model>`, `--betas <list>` (API-key auth only).
- Settings/config: `--settings <file-or-json>`, `--setting-sources user,project,local`, `--add-dir <dirs>`, `--mcp-config <files/json>`, `--strict-mcp-config`, `--agents <json>`, `--plugin-dir`, `--plugin-url`, `--bare`, `--safe-mode`, `--disable-slash-commands`.
- Permissions: `--permission-mode default|acceptEdits|plan|auto|dontAsk|bypassPermissions|manual`, `--allowedTools`/`--allowed-tools`, `--disallowedTools`/`--disallowed-tools`, `--tools "Bash,Edit,Read"`, `--dangerously-skip-permissions`, `--allow-dangerously-skip-permissions`, `--permission-prompt-tool <mcp_tool>`.
- System prompt: `--system-prompt`, `--system-prompt-file`, `--append-system-prompt`, `--append-system-prompt-file`, `--append-subagent-system-prompt`, `--exclude-dynamic-system-prompt-sections`.
- Print/SDK mode: `-p`/`--print`, `--output-format text|json|stream-json`, `--input-format text|stream-json`, `--json-schema <schema>`, `--max-turns N`, `--max-budget-usd N`, `--no-session-persistence`, `--include-partial-messages`, `--include-hook-events`, `--forward-subagent-text`, `--replay-user-messages`, `--prompt-suggestions`, `--verbose`.
- Sessions: `--continue`/`-c`, `--resume`/`-r`, `--fork-session`, `--session-id <uuid>`, `--name`/`-n`, `--from-pr N`, `--teleport`, `--cloud` (`--remote` deprecated alias), `--bg`/`--background`, `--exec`, `--init`, `--init-only`, `--maintenance`.
- Environment/UX: `--ide`, `--chrome`/`--no-chrome`, `--worktree`/`-w` + `--tmux`, `--teammate-mode`, `--remote-control`/`--rc`, `--remote-control-session-name-prefix`, `--channels`, `--dangerously-load-development-channels`, `--ax-screen-reader`, `--debug [categories]`, `--debug-file <path>`, `--version`/`-v`.

---

## 6. Global config (`~/.claude.json`) vs settings.json; MCP configuration

### 6.1 `~/.claude.json`

Holds: OAuth session, MCP server configs for **user** and **local** scopes, per-project state (allowed tools, trust decisions), caches, and the "global config settings" keys below — these are **ignored if put in settings.json**. Sources: https://code.claude.com/docs/en/settings#settings-files, https://code.claude.com/docs/en/settings#global-config-settings, https://code.claude.com/docs/en/claude-directory#file-reference

Global config keys (in `~/.claude.json`): `autoConnectIde` (default false), `autoInstallIdeExtension` (default true), `diffTool` (default `auto`), `externalEditorContext` (default false), `permissionExplainerEnabled` (default true), `teammateDefaultModel`, `workflowSizeGuideline` (default `unrestricted`; v2.1.202+). Before v2.1.119, several `/config` preference keys (theme, verbose, editorMode, autoCompactEnabled, preferredNotifChannel) also lived here; they are now settings.json keys.

### 6.2 MCP configuration

Source: https://code.claude.com/docs/en/mcp

**Scopes** (https://code.claude.com/docs/en/mcp#mcp-installation-scopes):

| Scope | Loads in | Shared | Stored in |
| --- | --- | --- | --- |
| Local (default) | Current project only | No | `~/.claude.json` under `projects.<path>.mcpServers` |
| Project | Current project only | Yes (VCS) | `.mcp.json` at project root |
| User | All projects | No | `~/.claude.json` |

Precedence when the same server name exists in several places: local > project > user > plugin-provided > claude.ai connectors (whole entry wins; no field merging).

**`claude mcp` commands:** `claude mcp add [--transport http|sse|stdio] [--scope local|project|user] <name> <url|command>` (headers via `--header`, env via `--env`), `claude mcp add-json <name> '<json>'`, `claude mcp list`, `claude mcp get <name>`, `claude mcp remove <name>`, `claude mcp reset-project-choices`, `claude mcp login|logout <name>` (OAuth). In-session: `/mcp`.

**`.mcp.json` format:** `{"mcpServers": {"name": {"type": "stdio|http|sse|ws", "command", "args", "env", "url", "headers", "oauth": {...}, "timeout": <ms>, "alwaysLoad": true}}}`. Environment-variable expansion supported in `command`, `args`, `env`, `url`, `headers`: `${VAR}` and `${VAR:-default}`. Project-scoped servers require approval (or `enableAllProjectMcpServers` / `enabledMcpjsonServers` / `disabledMcpjsonServers` in settings). Managed MCP: `managed-mcp.json` + `allowedMcpServers`/`deniedMcpServers`/`allowManagedMcpServersOnly` (https://code.claude.com/docs/en/managed-mcp).

Session-level: `--mcp-config <file-or-json>` loads extra servers; `--strict-mcp-config` uses only those.

---

## 7. Other configuration surfaces (brief)

### 7.1 Hooks

Source: https://code.claude.com/docs/en/hooks

- Defined under the `hooks` key in any settings file; also plugin `hooks/hooks.json` and skill/agent frontmatter. Structure: event → matcher group → handler(s). Handler types: command (shell/exec form), HTTP endpoint, MCP tool, prompt, agent.
- Locations/scopes: `~/.claude/settings.json` (all projects), `.claude/settings.json` (project, shareable), `.claude/settings.local.json` (personal), managed policy, plugins, skill/agent frontmatter.
- Governance: `disableAllHooks`, `allowManagedHooksOnly` (managed), `allowedHttpHookUrls`, `httpHookAllowedEnvVars`; `/hooks` menu for interactive editing; `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`, `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` env knobs.
- Events referenced in the docs include PreToolUse, PostToolUse, Stop, SubagentStop, SessionStart, SessionEnd, Setup, CwdChanged, FileChanged, ConfigChange, WorktreeCreate (full lifecycle list on the hooks page).

### 7.2 Memory (CLAUDE.md)

Source: https://code.claude.com/docs/en/memory

Load order/locations: managed policy CLAUDE.md (`/Library/Application Support/ClaudeCode/CLAUDE.md`, `/etc/claude-code/CLAUDE.md`, `C:\Program Files\ClaudeCode\CLAUDE.md`) → user `~/.claude/CLAUDE.md` → project `./CLAUDE.md` or `./.claude/CLAUDE.md` → `CLAUDE.local.md` (personal, gitignore manually). Parent-directory files load at launch; subdirectory files load on demand. Topic rules: `.claude/rules/*.md` (optionally path-gated). Auto memory: `~/.claude/projects/<project>/memory/` (settings `autoMemoryEnabled`, `autoMemoryDirectory`; env `CLAUDE_CODE_DISABLE_AUTO_MEMORY`). Managed `claudeMd` settings key injects org memory; `claudeMdExcludes` skips files; `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1` disables all.

### 7.3 Status line

Source: https://code.claude.com/docs/en/statusline

`statusLine` settings key: `{"type": "command", "command": "~/.claude/statusline.sh", "padding": 0, "refreshInterval": <ms>, "hideVimModeIndicator": true}`. The command receives session JSON on stdin (model, workspace, cost, context-window fields incl. `used_percentage`); first stdout line becomes the status line. Set up interactively with `/statusline`. Disabled by `disableAllHooks`.

### 7.4 Output styles

Source: https://code.claude.com/docs/en/output-styles

`outputStyle` settings key (read at startup; system prompt rebuilt on `/clear`/restart). Custom styles are markdown files with frontmatter in `output-styles/` (user `~/.claude/output-styles/` or project `.claude/output-styles/`); switch with `/output-style`.

### 7.5 Subagents

Source: https://code.claude.com/docs/en/sub-agents, https://code.claude.com/docs/en/settings#subagent-configuration

Markdown + YAML frontmatter files in `~/.claude/agents/` (user) or `.claude/agents/` (project). Frontmatter includes `model` and `effort` among other fields. Related config: `agent` settings key, `--agents` JSON flag, `CLAUDE_CODE_SUBAGENT_MODEL`.

---

## 8. Notable gaps / UNVERIFIED items

- **`claude config list/get/set/add/remove`**: absent from the current official CLI reference and settings pages; treated as removed/deprecated. Not verified against the binary.
- **`includeCoAuthoredBy`**: not in the current settings reference; attribution is configured via the `attribution` object. Historical key status UNVERIFIED.
- **`--verbose`/`--max-turns` historical semantics** and any settings added after the docs snapshot (docs note the published JSON schema may lag recent CLI releases).
- The old task-spec paths (`/en/docs/claude-code/settings` etc.) return 404; equivalents are the `/docs/en/<page>` URLs cited throughout. The "iam" page is now `authentication`; "third-party-integrations" exists as an overview page; "llm-gateway" splits into gateway/connect/rollout/protocol pages.
- Changelog/GitHub repo (anthropics/claude-code) was not separately mined; version annotations above come from the docs' inline `min-version` notes (docs appear current through ~v2.1.214).

---

## 9. Sources (all fetched 2026-07-22)

| Page | URL |
| --- | --- |
| Settings reference | https://code.claude.com/docs/en/settings (raw: https://code.claude.com/docs/en/settings.md) |
| Environment variables | https://code.claude.com/docs/en/env-vars |
| CLI reference | https://code.claude.com/docs/en/cli-reference |
| Model configuration | https://code.claude.com/docs/en/model-config |
| Amazon Bedrock | https://code.claude.com/docs/en/amazon-bedrock |
| Google Cloud's Agent Platform (Vertex) | https://code.claude.com/docs/en/google-vertex-ai |
| Microsoft Foundry | https://code.claude.com/docs/en/microsoft-foundry |
| Claude Platform on AWS | https://code.claude.com/docs/en/claude-platform-on-aws (referenced; not fully mined) |
| Gateways overview | https://code.claude.com/docs/en/gateways |
| LLM gateways | https://code.claude.com/docs/en/llm-gateway |
| Connect to an LLM gateway | https://code.claude.com/docs/en/llm-gateway-connect |
| Network configuration | https://code.claude.com/docs/en/network-config |
| Authentication | https://code.claude.com/docs/en/authentication |
| MCP | https://code.claude.com/docs/en/mcp |
| Managed MCP | https://code.claude.com/docs/en/managed-mcp (referenced) |
| Hooks reference | https://code.claude.com/docs/en/hooks |
| Memory | https://code.claude.com/docs/en/memory |
| Status line | https://code.claude.com/docs/en/statusline |
| Output styles | https://code.claude.com/docs/en/output-styles |
| Subagents | https://code.claude.com/docs/en/sub-agents |
| .claude directory | https://code.claude.com/docs/en/claude-directory |
| Server-managed settings | https://code.claude.com/docs/en/server-managed-settings |
| Monitoring (OpenTelemetry) | https://code.claude.com/docs/en/monitoring-usage |
| Sandboxing | https://code.claude.com/docs/en/sandboxing |
| Third-party integrations | https://code.claude.com/docs/en/third-party-integrations |
| Costs | https://code.claude.com/docs/en/costs |
| Slash commands | https://code.claude.com/docs/en/slash-commands |
| Docs index | https://code.claude.com/docs/llms.txt |
