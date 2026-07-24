# How People Build Checkout Bots

Research date: 2026-07-24. Educational/architectural overview of how automated
purchasing tools ("checkout bots", a.k.a. sneaker bots, cook bots, AIO bots,
Grinch bots) are designed. Written to explain the *engineering shape* of the
problem and the cat-and-mouse dynamics with retailer defenses — not as a build
guide. Anti-bot bypass specifics are described at the level a defender needs to
understand the threat, and the legal/ethical boundaries are covered in §7.

---

## 1. What a checkout bot actually is

A checkout bot is automation that races humans (and other bots) to buy
limited-supply inventory the instant it drops: sneakers (Nike SNKRS, Adidas
Confirmed, Shopify sites like Supreme), GPUs, game consoles, concert tickets,
Pokémon/Funko/collectibles, and so on. The value proposition is **speed and
concurrency**: monitor a release, add-to-cart, and complete checkout in
hundreds of milliseconds, across dozens or hundreds of parallel "tasks" (each a
separate identity/session), so the operator wins far more units than any person
clicking manually.

Two related but distinct tools:

- **Monitor bots** — watch sites/APIs for a product going live or restocking
  and emit an alert (often to Discord). They don't buy anything. Legal and
  widely used; also the discovery layer that feeds checkout bots.
- **Checkout bots / AIO ("all-in-one") bots** — the full pipeline: monitor →
  add-to-cart → solve challenges → check out. Commercial examples that get
  named publicly include Cybersole, Kodai, StellarAIO, Wrath, Balko, and the
  long-running AIO Bot / "AKKO". These are typically paid ($300–1000+ up front
  or via monthly renewals) and resold on a secondary market.

The ecosystem around them ("the aftermarket community", "cook groups") bundles
the bot with the *other* things you need to succeed: proxies, server hosting,
CAPTCHA solving, account generation, and release intel. A bot alone rarely
wins; the supporting stack is most of the battle.

---

## 2. Core architecture

Almost every checkout bot decomposes into the same four subsystems:

```
        ┌─────────────┐      product live / restock       ┌──────────────┐
        │   MONITOR   │ ────────────────────────────────► │ TASK ENGINE  │
        │ (poll APIs, │      (variant id, price, url)      │ (N parallel  │
        │  webhooks)  │                                    │   tasks)     │
        └─────────────┘                                    └──────┬───────┘
                                                                  │
   ┌──────────────────────────────────────────────────────────┐  │
   │ SESSION / IDENTITY LAYER                                  │  │
   │  proxies · cookies · TLS+browser fingerprints · accounts │◄─┘
   │  profiles (name/address/card)                            │
   └──────────────────────────────────────────────────────────┘
                                                                  │
                                                                  ▼
        ┌───────────────┐    challenge?    ┌──────────────┐   ┌──────────┐
        │  CHECKOUT     │ ───────────────► │  CHALLENGE   │   │ NOTIFIER │
        │  FLOW (ATC →  │ ◄─────────────── │  SOLVER      │   │ (Discord │
        │  addr → pay)  │   token/cookie   │ (CAPTCHA,JS) │   │ webhook) │
        └───────────────┘                  └──────────────┘   └──────────┘
```

### 2.1 The monitor
Detects "the thing is buyable now." Techniques, cheapest/fastest first:

- **Product/inventory API polling.** Shopify exposes `/products.json` and
  `/products/<handle>.js`; many storefronts have a JSON variant endpoint. The
  monitor polls on a tight loop (respecting or ignoring rate limits) and diffs
  the response to spot a new variant ID or an out-of-stock → in-stock flip.
- **Sitemap / collection / search-endpoint diffing** when there's no clean
  product API.
- **Keyword + variant pre-loading.** Operators pre-stage the exact variant IDs
  (size/colorway) before the drop so a task can skip straight to add-to-cart
  the moment the monitor fires.
- **Restock webhooks / third-party feeds** for sites that are hard to poll.

The monitor's output is a compact event (URL, variant/offer ID, price, maybe a
checkout token) pushed to the task engine with minimal latency.

### 2.2 The task engine
The concurrency core. A "task" is one attempt = {profile, proxy, session,
target}. The engine:

- spins up hundreds/thousands of tasks (async I/O — Python `asyncio`/`aiohttp`,
  Node, Go, or a compiled core; commercial bots are often C#/.NET or Go for
  throughput and packaging),
- assigns each task its own proxy + identity so they don't look correlated,
- exposes the tunable knobs operators obsess over: **task quantity, monitor
  delay, checkout delay, retry policy, and "modes"** (see §5),
- staggers/jitters timing to avoid a thundering-herd signature,
- handles retries and error classification (soft-ban vs hard-ban vs sold-out).

### 2.3 The checkout flow
The actual purchase sequence, which differs per site "module" (see §5). Bots
overwhelmingly prefer **replaying the site's HTTP/API calls directly** ("request
mode") over driving a real browser, because raw requests are 10–100× faster and
far more scalable. A typical Shopify-style flow reproduced as requests:

1. add-to-cart (`/cart/add.js` with the variant ID),
2. create/advance checkout, capture the checkout token,
3. submit shipping/contact, select a shipping rate,
4. submit payment — real bots tokenize the card through the site's own payment
   processor (Stripe/Adyen/Braintree/Shopify Payments) exactly as the browser
   would, then post the payment token,
5. poll the order-status/processing endpoint for approve/decline.

Some sites can't be cleanly reversed, so bots fall back to **browser
automation** (Puppeteer/Playwright/Selenium, often with stealth patches) for
those steps — slower but more faithful to what the anti-bot system expects.

### 2.4 The identity / session layer
Cross-cuts everything: proxies, cookies, per-task fingerprints, generated
accounts, and the operator's **profiles** (billing/shipping/card data, often
many profiles with slight variations to dodge per-customer limits). Covered in
§3 and §4.

---

## 3. The supporting stack (what actually makes it work)

The bot is one line item. Practitioners describe the full kit as **bot +
proxies + CAPTCHA + server + accounts + intel**:

| Component | Why it exists | Notes |
|---|---|---|
| **Proxies** | Spread requests across many IPs so N tasks don't look like one machine; evade IP rate-limits and bans | Datacenter (cheap/fast, easily blocked) vs **residential**/mobile (real ISP IPs, ~$12–16/GB, much harder to block). "ISP proxies" = datacenter speed with residential-owned IPs |
| **Server / VPS** | Low latency to the retailer's data center and stable uptime; run tasks close to the origin (e.g. us-east near Shopify) | Serious operators rent VPS in the right region; "server groups" are sold in cook communities |
| **CAPTCHA / challenge solving** | Get past reCAPTCHA v2/v3, hCaptcha, Turnstile, and vendor JS challenges | Human-farm/AI solver services (2Captcha, CapMonster, NopeCHA-style), reCAPTCHA "harvesters" that pre-farm valid tokens on aged Google accounts, or request-based anti-bot solver APIs |
| **Accounts** | Aged/verified accounts pass trust checks; some drops are account-gated (SNKRS, Confirmed) | Bulk account generation + email/phone verification is its own sub-industry |
| **Profiles / payment** | The billing identities that place orders | Many profiles, sometimes many cards, to beat one-per-customer limits |
| **Release intel** | Knowing exactly when/what drops, early links, variant IDs | Cook groups sell this as a subscription |

The economics: this is a business. Operators run at scale, resell inventory
above retail, and the tooling market (bots, proxies, solvers, groups) is built
around that arbitrage.

---

## 4. The arms race: how sites detect bots, and how bots respond

Retailers of high-demand goods deploy commercial anti-bot platforms —
**Akamai Bot Manager, HUMAN/PerimeterX, DataDome, Cloudflare Bot Management,
Kasada** — plus their own defenses. Detection operates in layers, from the
network handshake up to behavior:

### 4.1 Network / transport layer
- **TLS fingerprinting (JA3/JA4).** The TLS ClientHello (cipher list, extension
  set and ordering, supported groups) forms a hash that identifies the client's
  TLS stack *before any HTTP or JavaScript runs*. Python `requests`,
  stock `curl`, and default HTTP libraries emit fingerprints that don't match
  real Chrome/Safari, so they're flagged immediately.
- **HTTP/2 fingerprinting**: pseudo-header order, SETTINGS frames, header
  casing/order that differ from a real browser.
- **IP reputation**: datacenter/VPN/known-proxy ranges are pre-scored as risky.

Bot response: libraries that **impersonate a real browser's TLS/HTTP2
signature** (e.g. `curl-impersonate`/`curl_cffi`, `tls-client`, uTLS in Go) so
the handshake matches Chrome, paired with residential/mobile proxies for IP
reputation.

### 4.2 Browser / device layer
- Anti-bot JS (e.g. Akamai's `sensor.js`, PerimeterX/HUMAN, DataDome scripts)
  runs a heavy fingerprint: canvas/WebGL vendor, audio context, fonts, screen,
  navigator properties, timezone, WebRTC, and known automation tells
  (`navigator.webdriver`, CDP artifacts, headless signatures). It bundles all
  of this into an encrypted sensor payload / cookie the server validates.

Bot response: **stealth-patched headless browsers** (puppeteer-extra-stealth,
patched Playwright, undetected-chromedriver, or hardened Chromium forks) to
scrub automation tells; or, for pure request bots, **generating a valid sensor
token** — either by reversing the script or by running it in a small headless
"token generator" and feeding the cookie into the request pipeline.

### 4.3 Behavioral layer
- **Delayed / probabilistic enforcement.** HUMAN/PerimeterX in particular
  builds a confidence score over a session (mouse dynamics, navigation timing,
  interaction cadence) and only enforces at a *valuable* action like checkout —
  intentionally making it hard to know which signal got you caught.
- **CAPTCHAs and interstitial JS challenges** injected at add-to-cart or
  payment when the score is borderline.
- **Virtual waiting rooms / queue systems** (e.g. Queue-it, Akamai
  Waiting Room, Nike's SNKRS draw, Shopify checkout throttle) randomize or
  serialize access so raw speed matters less.

Bot response: solver services and token harvesters for CAPTCHAs; queue-aware
logic that holds many positions; and for draw-style releases (SNKRS), lots of
aged accounts rather than pure speed.

### 4.4 Why request-mode dominates anyway
Even with all of the above, faithfully replaying HTTP requests wins on speed and
cost, so the sophisticated end of the market invests in *making requests look
browser-authentic* (TLS impersonation + valid anti-bot cookies + residential
IPs) rather than driving real browsers at scale. Browser automation is the
fallback for sites that resist reversal.

---

## 5. Two worlds: "site modules" and "modes"

A checkout bot isn't one flow — it's a collection of per-retailer **modules**,
because every site's cart/checkout API differs. The two big families:

- **Custom / enterprise sites** (Nike SNKRS, Adidas Confirmed, Footsites,
  Walmart, Target, Best Buy): bespoke APIs, account gating, draws, and the
  heaviest anti-bot. Each needs its own reverse-engineered module, and modules
  break whenever the retailer ships changes — a big part of a commercial bot's
  ongoing value is the dev team keeping modules alive.
- **Shopify** (Supreme, Kith, many DTC brands): a common platform, so one
  well-built Shopify module works across thousands of stores. Shopify has its
  own checkout throttle/queue and increasingly strong bot protection, so bots
  ship Shopify-specific tactics (pre-loading carts, "safe" vs "fast" modes,
  polling the queue).

**Modes** are the operator-facing strategies a module exposes, e.g.:
- *Safe / secure mode* — slower, browser-like, higher pass rate under heavy
  anti-bot;
- *Fast / request mode* — pure API replay, maximum speed;
- *Preload / pre-cart* — stage the checkout before the drop so only the final
  submit happens at go-time;
- *Account vs guest* — for gated releases.

Operators tune **task count, monitor delay, checkout delay, retry** per release
because the right settings differ by site and by how aggressive the anti-bot is
that day. Commercial bots advertise ~70–80% success rates on supported sites,
though that's marketing and highly release-dependent.

---

## 6. A minimal mental model (how a hobbyist starts)

For a *single, unprotected* site (e.g. a small Shopify store with no anti-bot),
the DIY path people follow is small and mostly legitimate web automation:

1. **Find the API.** Open devtools, watch the network tab through a manual
   add-to-cart + checkout, and identify the endpoints and payloads.
2. **Script the happy path.** Reproduce ATC → checkout → payment as HTTP
   requests (or drive it with Playwright if the flow is JS-heavy).
3. **Add a monitor loop** that polls the product JSON and triggers step 2 when
   the variant becomes available.
4. **Add a notifier** (Discord webhook) so you know when it succeeds/fails.
5. **Add resilience**: retries, error handling, config for size/profile.

This is the same skill set as ordinary web scraping and API integration. The
difficulty (and the ethical/legal weight) ramps up *only* when the target is a
protected, limited-inventory retailer and you start adding proxies at scale,
CAPTCHA solving, fingerprint spoofing, and dozens of identities to defeat
purchase limits — that's the line between "automating my own boring task" and
"industrial scalping."

---

## 7. Legal and ethical landscape

Building or running these tools sits on a spectrum, and the boundaries matter:

- **Tickets are specifically regulated.** The US **Better Online Ticket Sales
  (BOTS) Act of 2016** makes it illegal to use software to circumvent security
  measures / purchase limits on event tickets (events of 200+ capacity) and to
  resell tickets you know were obtained that way. Enforcement has been thin (the
  FTC has brought very few cases), but the statute is real. Several states and
  other countries (e.g. the UK) have their own ticket-bot bans.
- **Retail goods are a grey area — for now.** Sneaker/GPU/console scalping bots
  aren't federally illegal in the US today. The repeatedly-proposed
  **Stopping Grinch Bots Act** would extend BOTS-style prohibitions to retail
  (banning circumvention of purchase-limit/security controls and knowing resale
  of bot-obtained goods); as of this writing it has not passed. Some states have
  moved on their own.
- **Terms of Service.** Essentially every major retailer's ToS prohibits
  automated purchasing. Violating ToS isn't a crime by itself, but it grounds
  order cancellation, account bans, and civil action.
- **Adjacent conduct that *is* clearly illegal**: using stolen/"carded" payment
  data, creating fraudulent accounts at scale, bypassing access controls in ways
  that implicate anti-hacking statutes (e.g. CFAA theories), and money
  laundering the proceeds. Bots built around those cross a hard line.
- **Harm.** Even where legal, industrial scalping is a consumer-harm story:
  it's why consoles, GPUs, insulin-adjacent scarcity goods, and concert tickets
  spike above retail. This is why the *defensive* side (below) is a legitimate
  and growing engineering field.

Bottom line for a builder: automating a purchase for yourself on a site that
allows it is ordinarily fine; building tooling to defeat purchase limits and
anti-bot controls at scale to corner limited inventory is, at minimum, a ToS
violation and reputational/business risk, is illegal for tickets, and may soon
be illegal for retail.

---

## 8. The defensive view (the other half of the field)

Understanding bot construction is most useful for stopping them. Defenders
combine:

- **Layered fingerprinting**: TLS/JA3-JA4 + HTTP/2 + IP reputation at the edge,
  before app logic runs.
- **Behavioral scoring** with delayed enforcement so bots can't easily learn
  which signal tripped them.
- **Challenges** (invisible CAPTCHA, proof-of-work JS like Kasada, Turnstile)
  gating high-value actions.
- **Virtual waiting rooms / fair-queue systems** to neutralize raw speed.
- **Inventory & business logic**: per-account/per-address/per-card limits,
  velocity checks, holds and manual review, randomized draws instead of
  first-come-first-served, delayed order confirmation, and cancel-and-refund
  sweeps on detected bot orders.
- **Commercial platforms**: Akamai Bot Manager, HUMAN (PerimeterX), DataDome,
  Cloudflare Bot Management, Kasada, Queue-it.

The design lesson cuts both ways: raw speed is only decisive when the site lets
it be. Draws, queues, and strict purchase limits are what actually blunt bots,
which is why the most-botted releases keep moving toward those mechanisms.

---

## Sources

- [Best Sneaker Bots in 2025 — DowneLink](https://www.downelink.com/best-bots-for-shoes/)
- [How to get a sneaker bot: 2025 guide — SOAX](https://soax.com/blog/get-sneaker-bot)
- [AIO Bot Review — TheLinuxCode](https://thelinuxcode.com/aio-bot-review-an-in-depth-look-at-the-all-in-one-sneaker-bot/)
- [StellarAIO Review — Learn Retail Arbitrage](https://learnretailarbitrage.com/stellaraio-review/)
- [Master AIO Bots — GloryCloud](https://www.glorycloud.com/blog/aio-bot/)
- [Sneaker Bot Proxies: Setup & Strategy — Databay](https://databay.com/blog/sneaker-bot-proxies-guide)
- [How to Bypass Akamai Bot Detection in 2026 — DEV Community](https://dev.to/vhub_systems_ed5641f65d59/how-to-bypass-akamai-bot-detection-in-2026-5h3k)
- [How to Bypass PerimeterX when Web Scraping in 2026 — Scrapfly](https://scrapfly.io/blog/posts/how-to-bypass-perimeterx-human-anti-scraping)
- [Bypass Anti-Bot Protection (overview) — Scrapfly](https://scrapfly.io/bypass)
- [Captcha Solutions — Sneaker Dev](https://www.sneakerdev.com/categories/captcha)
- [JA3/JA4 TLS Fingerprinting: Detection and Evasion — Scrapfly](https://scrapfly.io/blog/posts/ja3-ja4-tls-fingerprinting-guide-to-detection-and-evasion)
- [TLS Fingerprinting in Playwright/Puppeteer — Browserless](https://www.browserless.io/blog/tls-fingerprinting-explanation-detection-and-bypassing-it-in-playwright-and-puppeteer)
- [When Handshakes Tell the Truth: Detecting Bad Bots via TLS — arXiv](https://arxiv.org/html/2602.09606v1)
- [What is Grinch Bots? — Friendly Captcha](https://friendlycaptcha.com/wiki/what-is-grinch-bots/)
- [Are Scalper Bots Illegal? — Kasada](https://www.kasada.io/scalper-bots/are-scalper-bots-illegal/)
- [BOTS Act passes Senate — TechCrunch](https://techcrunch.com/?p=1422907)
- [Congress bans ticket-scalping bots — NPR](https://www.npr.org/sections/thetwo-way/2016/12/08/504843205/bots-b-gone-congress-bans-ticket-scalpers-tool-blamed-for-quick-sell-outs)
- [Ticket-scalping thrives despite FTC effort — NY Senate](https://www.nysenate.gov/newsroom/in-the-news/2024/james-skoufis/high-prices-ravenous-bots-ticket-scalping-thrives-despite)
