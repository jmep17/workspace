# Many Branches, One Port — Resources

## Knowledge

- [RFC 9700 — Best Current Practice for OAuth 2.0 Security (Jan 2025)](https://www.rfc-editor.org/rfc/rfc9700)
  The authoritative rule: authorization servers MUST use exact string matching on
  redirect URIs (§2.1), with attacks explained in §4.1. Use for: why the provider
  rejects every URI except the registered one.
- [RFC 8252 §7.3 — OAuth 2.0 for Native Apps, loopback redirect](https://www.rfc-editor.org/rfc/rfc8252#section-7.3)
  The *only* exception to exact matching: variable ports on loopback, for native
  apps only. Use for: understanding why web apps don't get this escape hatch.
- [RFC 6749 §3.1.2 — The OAuth 2.0 Authorization Framework, redirection endpoint](https://www.rfc-editor.org/rfc/rfc6749#section-3.1.2)
  The original definition of the redirection endpoint. Use for: base vocabulary
  (client, authorization server, redirection URI).
- [Beej's Guide to Network Programming](https://beej.us/guide/bgnet/)
  The classic, free sockets text. Use for: what bind/listen actually do, why one
  listener owns an (address, port) pair, EADDRINUSE.
- [Caddy — reverse_proxy directive](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)
  Official docs for the proxy we'll use. Use for: upstreams, handle blocks,
  header forwarding.
- [Caddy — reverse proxy quick-start](https://caddyserver.com/docs/quick-starts/reverse-proxy)
  Minimal working example. Use for: first hands-on proxy in lesson 2.

## Wisdom (Communities)

- [Caddy Community forum](https://caddy.community/)
  Moderated by the maintainers, high signal. Use for: reviewing your Caddyfile
  once it exists, unusual routing needs (cookie-based upstream selection).
- [r/webdev](https://www.reddit.com/r/webdev/)
  Broad but active. Use for: how other teams handle multi-branch local QA setups.

## Gaps

- No single high-trust write-up found yet for "session-cookie-based upstream
  selection behind one origin" — will likely need to synthesize from Caddy docs +
  forum threads for lesson 3.
