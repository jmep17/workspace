# Research: frontend libraries for the claude-ui migration

Status: resolved
Date: 2026-07-17 (library facts go stale — versions, sizes, and dates below were all verified on this date)

Question: `bin/claude-ui` embeds its whole SPA frontend in a Python string. We plan to split it into static files served by the same stdlib `http.server`. **Which libraries, if any, are worth adopting — especially ones usable with zero build tooling?**

Constraints: localhost-only personal tool, zero dependencies, zero build step, single `bin/claude-ui` entry point. The app is panels of forms/lists talking to a JSON API (~820 lines of vanilla JS today).

## Method

Primary sources only: official docs pages, GitHub repos via the GitHub API, the npm registry, the published package artifacts themselves, and the W3C WebDX `web-features` Baseline dataset. Sizes marked *measured* were downloaded from jsDelivr on 2026-07-17 and gzipped locally (`gzip -c | wc -c`) — i.e. measured from the published package, not quoted from anyone's marketing page.

---

## 1. Platform features (what the browser gives you for free)

Baseline status from the `web-features` dataset (the canonical source behind MDN/caniuse Baseline badges; queried from the published npm package `web-features` `data.json`, https://www.npmjs.com/package/web-features, 2026-07-17). "Widely available" = interoperable across all core browsers for 30+ months.

| Feature | Baseline | Interoperable since | Widely available since |
|---|---|---|---|
| JavaScript modules (`<script type="module">`, `import`) | Widely available | 2018-05-09 | 2020-11-09 |
| Import maps (`<script type="importmap">`) | Widely available | 2023-03-27 | 2025-09-27 |
| `<template>` | Widely available | 2015-11-12 | 2018-05-12 |
| Autonomous custom elements | Widely available | 2020-01-15 | 2022-07-15 |
| Shadow DOM | Widely available | 2020-01-15 | 2022-07-15 |
| Fetch | Widely available | 2017-03-27 | 2019-09-27 |
| Abortable fetch (`AbortController`) | Widely available | 2019-03-25 | 2021-09-25 |
| CSS Nesting | Widely available | 2023-12-11 | 2026-06-11 |
| `<dialog>` | Widely available | 2022-03-14 | 2024-09-14 |
| Popover API | Newly available | 2025-01-27 | — |

MDN confirms import maps as "Baseline Widely available … available across browsers since March 2023" and notes `es-module-shims` as a polyfill for stragglers (https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap).

**Takeaway:** everything the migration plan needs — native ES modules per panel, import maps for bare specifiers, `fetch`, `<template>` for row/panel cloning, CSS nesting to keep `style.css` flat-file friendly — is Baseline Widely available. For a personal localhost tool running a current browser, there is no platform gap that *requires* a library.

---

## 2. No-build-step candidates

### 2.1 Native ES modules + vanilla JS (baseline option)

- **No-build path:** the platform itself; Baseline Widely available since 2020 (table above).
- **Fit:** the current ~820-line frontend already is vanilla JS. Splitting it into `index.html` + `style.css` + per-panel ES modules changes file layout, not technology. `http.server` needs nothing new beyond serving `.js` with the `text/javascript` MIME type (Python's `mimetypes` already maps this). One real caveat from the platform: ES modules do not work over `file://` — Vue's docs state it plainly: "Due to security reasons, ES modules can only work over the `http://` protocol" (https://vuejs.org/guide/quick-start.html). Irrelevant here since the Python server already serves over HTTP.
- **Cost:** you keep writing imperative DOM updates (`innerHTML`/`createElement`) for list re-renders; that is the only pain a library would remove.

### 2.2 Preact + htm

- **Version:** preact 10.29.7, published 2026-07-08 (npm registry, https://registry.npmjs.org/preact); 11.0.0-beta.2 tagged 2026-07-15 (https://github.com/preactjs/preact/releases). htm 3.1.1, published 2022-04-26 (https://registry.npmjs.org/htm).
- **Maintenance:** Preact repo pushed 2026-07-17, 38.7k stars, 63 open issues, multiple releases per month through 2026 (GitHub API, https://api.github.com/repos/preactjs/preact; releases page). htm repo's last commit is 2022-06-03 (GitHub API, https://api.github.com/repos/developit/htm) — dormant for 4 years, but its README states "htm is stable, fast, well-tested and ready for production use" (https://github.com/developit/htm), it is a ~650 B tagged-template parser with no dependencies, and Preact's current official docs still recommend it (below).
- **License:** Preact MIT; htm Apache-2.0 (npm registry).
- **Size (measured 2026-07-17):** `preact.min.js` 11.4 KB raw / 4.8 KB gz; `htm/preact/standalone.module.js` (Preact + htm + hooks in one ESM file) 13.2 KB raw / 5.3 KB gz; htm alone 651 B gz.
- **No-build story (official):** Preact's Getting Started guide has a dedicated "No build tools route": "Preact is packaged to be used directly in the browser, and doesn't require any build or tools" (https://preactjs.com/guide/v10/getting-started#no-build-tools-route). A full companion guide, "No-Build Workflows" (https://preactjs.com/guide/v10/no-build-workflows), recommends import maps + esm.sh and htm in place of JSX ("a JSX-like syntax that works in standard JavaScript"), and claims the approach "can continue to work very well at all scales." Documented caveats: Preact must be a singleton (use `?external=preact` on esm.sh or a pinned import map to avoid duplicate copies), and JSX itself always needs a compiler — htm is the official substitute.
- **Fit:** best-in-class for this app's actual pain: declarative re-render of lists/forms from JSON state (`render(html\`...\`, panel)` after each `fetch`). Components map 1:1 to panels. The `htm/preact/standalone.module.js` file is a single self-contained ESM file — it can be **vendored into the repo** (13 KB) so the tool stays offline-capable with zero CDN dependency at runtime.

### 2.3 Lit

- **Version:** lit 3.3.3, published 2026-05-14 (npm registry, https://registry.npmjs.org/lit; https://github.com/lit/lit/releases).
- **Maintenance:** repo pushed 2026-06-23, 21.7k stars, 710 open issues across the monorepo (GitHub API, https://api.github.com/repos/lit/lit). Google-backed, steady patch cadence.
- **License:** BSD-3-Clause (npm registry, GitHub API).
- **Size (measured):** official `lit-core.min.js` bundle 15.7 KB raw / 6.1 KB gz.
- **No-build story (official):** lit.dev's Getting Started documents pre-built single-file CDN bundles for "if you would prefer to download a single file rather than use npm and build tools" — "standard JavaScript modules with no dependencies", e.g. `import {LitElement, html} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js'` (https://lit.dev/docs/getting-started/). Caveat in the same docs: if you use npm, use the `lit` package instead — the bundles deliberately ship everything in one file. Like Preact's standalone, the bundle is vendorable.
- **Fit:** genuinely no-build and well maintained, but it pushes you into web components + shadow DOM per panel — more ceremony (class per component, property declarations, style encapsulation fighting a shared `style.css`) than a small panels app needs. Its `lit-html` templating is the part this app would actually want, and Preact+htm gets the same ergonomics with a component model closer to plain functions.

### 2.4 petite-vue

- **Version:** 0.4.1, published 2022-01-18 (npm registry, https://registry.npmjs.org/petite-vue). Last commit to the repo: 2022-01-27 (GitHub API, https://api.github.com/repos/vuejs/petite-vue/commits).
- **Maintenance:** effectively unmaintained — no commit in 4.5 years, issue tracker disabled, "Feature requests are unlikely to be accepted at this time", and the README's Status section says: "There are probably bugs and there might still be API changes, so **use at your own risk**" (https://github.com/vuejs/petite-vue).
- **License:** MIT. **Size (measured):** IIFE build 16.9 KB raw / 7.1 KB gz (README claims ~6 KB).
- **Fit / verdict:** the ergonomics would suit the app, but adopting a "use at your own risk" library that has been frozen since January 2022 is a strictly worse deal than Alpine (same model, maintained) or Preact+htm. **Reject.**

### 2.5 Alpine.js

- **Version:** 3.15.12, published 2026-04-30 (npm registry, https://registry.npmjs.org/alpinejs).
- **Maintenance:** healthy — repo pushed 2026-07-14, 31.8k stars, only 5 open issues, near-monthly patch releases through 2026 (GitHub API, https://api.github.com/repos/alpinejs/alpine; https://github.com/alpinejs/alpine/releases).
- **License:** MIT (npm registry, GitHub API).
- **Size (measured):** `cdn.min.js` 46.3 KB raw / 16.7 KB gz.
- **No-build story (official):** first-class. Install is one deferred script tag: `<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>`; docs recommend pinning a version for production (https://alpinejs.dev/essentials/installation). Single vendorable file.
- **Fit:** designed for sprinkling behavior on server-rendered HTML via `x-data`/`x-for`/`x-model` attributes. claude-ui is the opposite shape: a JS-driven app that fetches JSON and renders everything client-side. You *can* build that with Alpine (`x-for` over fetched arrays), but complex per-panel logic ends up as JS expressions inside HTML attribute strings — worse to manage than the code being migrated. Viable, not the best fit.

### 2.6 htmx

- **Version:** 2.0.10, published 2026-04-21; a 4.0.0-beta5 is on the `next` dist-tag (npm registry, https://registry.npmjs.org/htmx.org). The htmx.org homepage says v4 is in beta with a target release of Summer '26 (https://htmx.org/, https://four.htmx.org/docs).
- **Maintenance:** very active — repo pushed 2026-07-17, 48.5k stars (GitHub API, https://api.github.com/repos/bigskysoftware/htmx).
- **License:** Zero-Clause BSD (LICENSE file, https://github.com/bigskysoftware/htmx/blob/master/LICENSE).
- **Size (measured):** `htmx.min.js` 51.2 KB raw / 16.6 KB gz.
- **No-build story (official):** one script tag, "no need for a build system to use it" (https://htmx.org/docs/).
- **Fit / verdict:** htmx's whole model is HTML-over-the-wire — "any element can issue an HTTP request … servers respond with HTML fragments, not JSON" (https://htmx.org/docs/). Adopting it means rewriting the Python side from a JSON API into ~40 HTML-fragment endpoints, i.e. moving the templating problem *into* the Python file we are trying to shrink. Plus a v2→v4 migration is on the horizon. **Reject for this app** — great library, wrong architecture for an existing JSON API.

### 2.7 Vue 3 via CDN

- **Version:** 3.5.40, published 2026-07-16 (npm registry, https://registry.npmjs.org/vue).
- **License:** MIT. **Size (measured):** `vue.global.prod.js` 165.6 KB raw / 60.5 KB gz; `vue.esm-browser.prod.js` 62.2 KB gz. These are the full builds that include the runtime template compiler, which the CDN/no-build path depends on (in-DOM `{{ }}` templates).
- **No-build story (official):** explicitly documented: "When using Vue from a CDN, there is no 'build step' involved … However, you won't be able to use the Single-File Component (SFC) syntax" (https://vuejs.org/guide/quick-start.html). ES-module build + import maps also documented. Additional caveat: `<script setup>` "requires build tools", so no-build code uses the `setup()` option form.
- **Fit / verdict:** works, but 60 KB gz for a tool that needs list rendering and form binding is 10x the Preact+htm cost, and the docs themselves point jQuery/Alpine-shaped use cases at petite-vue (which is abandoned). **Reject** — wrong weight class.

---

## 3. Build-step tier (for comparison only)

- **Vite** 8.1.5, published 2026-07-16 (npm registry, https://registry.npmjs.org/vite). Requires Node.js 20.19+ / 22.12+; bundles with Rolldown; `vite build` is "pre-configured to output highly optimized static assets for production" (https://vite.dev/guide/). The output is plain static files (default `dist/`), servable by any static server including our `http.server` — so a **committed-`dist/` workflow works mechanically** (the output has no server requirements), though no Vite doc blesses committing build output; it is simply a repo policy choice.
- **Cost for this repo:** a Node toolchain (`node_modules`, lockfile, `npm install` on every machine), a second language runtime for a Python tool, dev/prod drift between source and committed artifacts, and Vite major-version churn (v6→v7→v8 within ~20 months per npm dist-tags). This violates two of the tool's three core values (zero dependencies, zero build step) to solve a problem — bundling — that a 130 KB total frontend does not have.
- **Verdict: not worth it** at this scale. Preact via import map delivers the same authoring model (minus JSX/TSX and HMR) at zero tooling cost.

---

## 4. Recommendation: rendering layer

(See §8 for the visual/component-library recommendation, added 2026-07-17.)

**Primary: split into static files with native ES modules and no library.** Every platform feature needed (ES modules, import maps, `fetch`, `<template>`, `<dialog>`, CSS nesting) is Baseline Widely available. This is the only option that keeps the zero-dependency invariant literally intact, and the migration is then purely mechanical: extract `PAGE` into `index.html` + `style.css` + per-panel `panels/*.js` modules served by the existing server.

**If declarative rendering is wanted (recommended if any panel grows), adopt Preact + htm, vendored.** It is the only candidate that scores well on every axis: actively maintained (release 9 days ago), tiny (5.3 KB gz for the combined standalone file), MIT/Apache-2.0, an *officially documented* no-build path with its own dedicated guide, and a component model that matches a forms/lists/panels JSON app exactly. Vendor `htm/preact/standalone.module.js` (13 KB, one file) into the repo next to `app.js` and reference it via a pinned import map — no CDN at runtime, tool keeps working offline, and "zero dependencies" degrades only to "one 13 KB vendored file, no package manager, no build". Known risks, both acceptable: htm itself is dormant (stable-by-design, 651 B, still Preact's official recommendation) and Preact 11 is in beta (pin 10.x; the no-build guide is version-stable).

**Rejected:** htmx (requires converting the JSON API to HTML fragments — moves work into the Python file; v4 migration pending), petite-vue (unmaintained since Jan 2022, "use at your own risk"), Vue 3 CDN (60 KB gz, SFC/`<script setup>` unavailable without tooling), Lit (solid no-build story but web-component ceremony exceeds the app's needs — second choice if per-panel style encapsulation ever matters), Alpine (healthy but its HTML-attribute model fits server-rendered pages, not a JSON-driven SPA), Vite tier (Node toolchain violates the tool's core constraints for no benefit at this size).

---

# Part II: UI / component libraries for a beautiful UI

Added 2026-07-17. Same constraints (no build step preferred, vendorable, localhost personal tool) and same method: npm registry for versions/dates/licenses, GitHub API for repo health, sizes measured from the published artifacts on jsDelivr (gzipped locally, 2026-07-17), claims cited to official docs.

## 5. CSS-only frameworks

| Library | Version (date) | License | Size (gz, measured) | Model | Dark mode | Maintenance |
|---|---|---|---|---|---|---|
| Pico CSS | 2.1.1 (2025-03-15) | MIT | 11.7 KB (classless: 10.4 KB) | classless *or* minimal classes | automatic + `data-theme` | active |
| Water.css | 2.1.1 (2021-08-11) | MIT | 3.6 KB | classless | automatic | dormant |
| Simple.css | 2.3.7 (2025-05-29) | MIT | 2.8 KB | classless | automatic | GitHub archived; moved to Codeberg |
| Bootstrap | 5.3.8 (2025-08-26) | MIT | 31.1 KB CSS (+23.8 KB JS bundle) | class-based | `data-bs-theme`, no auto without JS | very active |
| Bulma | 1.0.4 (2025-04-19) | MIT | 66.0 KB | class-based, no JS | automatic + `data-theme` | active |
| Open Props | 1.7.23 (2026-01-31) | MIT | 7.7 KB (tokens only) | design tokens, not components | via its optional `normalize` extra | active; 2.0 in beta |

(Versions/dates/licenses: npm registry — https://registry.npmjs.org/@picocss/pico, /water.css, /simpledotcss, /bootstrap, /bulma, /open-props. Repo health: GitHub API, 2026-07-17.)

### 5.1 Pico CSS — best fit

- Repo pushed 2026-05-09, 16.7k stars, 124 open issues (https://api.github.com/repos/picocss/pico).
- **Classless option is official**: "a semantic option for wild HTML purists who prefer a stripped-down approach" — link `pico.classless.min.css` (or `pico.fluid.classless.min.css`) and `<header>`/`<main>`/`<footer>` become styled containers with no classes at all (https://picocss.com/docs/classless). The regular build also works with mostly-semantic HTML plus a handful of classes.
- **Dark mode**: "The Dark scheme is automatically enabled if the user has dark mode enabled `prefers-color-scheme: dark`", with `data-theme="light|dark"` to force a scheme per-document or per-element (https://picocss.com/docs/color-schemes).
- **Fit**: Pico styles exactly the vocabulary claude-ui already uses — forms, buttons, tables, `<details>` accordions, `<dialog>` modals, nav — from semantic HTML, in ~one vendored 83 KB raw / 11.7 KB gz file. Customization is plain CSS custom properties (`--pico-*`).

### 5.2 Water.css

Classless, automatic dark mode, tiny (3.6 KB gz measured from `water.min.css`). But the last npm release is 2021-08-11 and the last repo push 2024-02-11 (https://registry.npmjs.org/water.css; https://api.github.com/repos/kognise/water.css) — dormant for years, and it targets simple documents more than app UIs (no table/dialog polish comparable to Pico). Fine as a fallback aesthetic; not the pick.

### 5.3 Simple.css

Classless, 2.8 KB gz. The GitHub repo was **archived 2026-05-09**: "This repo is no longer maintained… I've moved all my open source projects over to Codeberg", with development continuing at codeberg.org/kevquirk/simple.css (https://github.com/kevquirk/simple.css). Still alive, but blog-/document-shaped rather than admin-panel-shaped, and the platform move adds friction. Not the pick.

### 5.4 Bootstrap

5.3.8, extremely active (repo pushed 2026-07-17, 174k stars — https://api.github.com/repos/twbs/bootstrap). Entirely usable from vendored files with no build (`bootstrap.min.css` + optional `bootstrap.bundle.min.js`). But: class-based markup means rewriting every panel's HTML into Bootstrap's class vocabulary; dark mode is `data-bs-theme` and "does not automatically toggle your project's color mode" — auto-following the OS preference requires the docs' JS snippet or a Sass rebuild with `$color-mode-type: media-query` (https://getbootstrap.com/docs/5.3/customize/color-modes/). 31 KB gz CSS + 24 KB gz JS is 5x Pico for a look that reads as generic Bootstrap. Workable, not the best fit.

### 5.5 Bulma

1.0.4, active (repo pushed 2026-03-01, 50k stars — https://api.github.com/repos/jgthms/bulma). No-JS by design; v1 has "automatic Dark mode" via `prefers-color-scheme` plus `data-theme`/`theme-dark` overrides and `--bulma-*` CSS variables (https://bulma.io/documentation/features/dark-mode/). But it is class-based (markup rewrite) and the full build measured a startling **678 KB raw / 66 KB gz** — the heaviest artifact in this whole survey. Not the pick.

### 5.6 Open Props

"Supercharged CSS variables… Expertly crafted web design tokens", explicitly "non-prescriptive": the props style nothing by default; visual styling comes from optional extras like `normalize.min.css` and `buttons.min.css` (https://open-props.style/). "No installation required" — one `<link>`/`@import` from CDN, fully vendorable (7.7 KB gz measured). This is a token palette for hand-rolling your own design, not a component look. Good complement if we keep a hand-written `style.css`; not a solution alone. Note 2.0 is in beta (npm dist-tags).

## 6. Web component libraries (framework-agnostic widgets)

### 6.1 Shoelace → Web Awesome transition (verified)

- **Shoelace is sunset.** The official site states: "Shoelace Is Sunset with no active development" and "Shoelace is now Web Awesome!… Still open source. Still free." (https://shoelace.style/). Last npm release: 2.20.1, 2025-03-11 (https://registry.npmjs.org/@shoelace-style/shoelace). The GitHub repo `shoelace-style/shoelace` is **archived** (GitHub API, 2026-07-17). Do not adopt Shoelace 2.x for new work.
- **Web Awesome is the successor and is active**: `@awesome.me/webawesome` 3.10.0, published 2026-06-30, MIT license (https://registry.npmjs.org/@awesome.me/webawesome); repo `shoelace-style/webawesome` pushed 2026-07-16 (GitHub API). A commercial "Pro" tier exists (paid components/icon kits); the core library is free and MIT per the published package.
- **No-build usage (official)**: two tags — `<link rel="stylesheet" href="https://ka-f.webawesome.com/webawesome@3.10.0/styles/webawesome.css">` + `<script type="module" src="https://ka-f.webawesome.com/webawesome@3.10.0/webawesome.loader.js"></script>` — then components are plain HTML tags like `<wa-button variant="brand">` (https://webawesome.com/docs/). The loader lazily registers components as they appear, so payload is per-component (loader itself: 1.4 KB raw / 0.5 KB gz measured; base css is a 195-byte shim).
- **Vendoring caveat**: because the autoloader fetches per-component files on demand, vendoring means copying the package's whole `dist-cdn/` tree from the npm tarball into the repo (a directory of many files), not one file. It works fully offline afterward, but it is a different commitment than a single vendored CSS file.
- **Styling model**: components "use a shadow DOM to encapsulate their styles and behaviors," so page CSS "can't simply target their internals"; customization flows through global `--wa-*` design tokens ("no preprocessor required"), component-scoped custom properties, `::part()` selectors, and `:state()` (https://webawesome.com/docs/customizing/).

### 6.2 Material Web (`@material/web`)

Latest release 2.5.0, published 2026-07-15, Apache-2.0 (https://registry.npmjs.org/@material/web) — but the README states: "**MWC is in maintenance mode pending new maintainers**", linking discussion #5642 (https://github.com/material-components/material-web). Releases still trickle out, but the project's own status notice disqualifies it for new adoption, and Material Design is a strong aesthetic commitment besides. Not recommended.

### 6.3 Other framework-agnostic sets

No other candidate surveyed combined (a) active maintenance, (b) an officially documented CDN/no-build path, and (c) a general-purpose widget set the way Web Awesome does; heavier enterprise kits (Vaadin, SAP UI5, Microsoft FAST/Fluent) were out of scope for a personal localhost tool and were not researched to the citation standard of this document — treat this subsection as a scoping note, not a verified survey.

## 7. Confirmed: does NOT work without a build step

- **Tailwind CSS**: the browser-only route is the Play CDN (`<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>`), and the official docs state plainly: "The Play CDN is designed for development purposes only, and is not intended for production" (https://tailwindcss.com/docs/installation/play-cdn). Production Tailwind requires a build (Vite plugin, PostCSS, or the Tailwind CLI, per the same installation docs). It is a runtime JIT compiler in a `<script>` tag — the opposite of this tool's constraints.
- **shadcn/ui**: by its own description "This is not a component library. It is how you build your component library" — a CLI-driven *source-code distribution* that copies component source into your project, where it inherits your framework and build toolchain (https://ui.shadcn.com/docs). The components are React-style framework code styled with Tailwind, so there is no build-free or framework-free path. Out of scope.

## 8. Recommendation: visual layer

**Adopt Pico CSS, vendored, as the base look.** It is the only surveyed option that simultaneously: styles the semantic HTML this app already has (forms, tables, `<dialog>`, `<details>`, nav) without a markup rewrite; ships automatic dark mode with a `data-theme` override (https://picocss.com/docs/color-schemes); is one MIT-licensed vendorable file at 11.7 KB gz; and is actively maintained (2.1.1, repo pushed 2026-05). Use the regular (class-capable) build rather than pure classless — the app will want `.grid`/`.container` and per-element opt-outs — and layer the existing custom styles on top via `--pico-*` variables in our own `style.css`. Water.css and Simple.css are smaller but dormant/moved and document-shaped; Bootstrap and Bulma demand class-vocabulary rewrites at 3–6x the weight.

**Add Web Awesome selectively — only if specific rich widgets earn their keep** (e.g. drawer, color picker, tooltip-heavy toolbars beyond what `<dialog>`/`<details>`/Popover cover natively). It is the sole actively-maintained, MIT, framework-agnostic web-component set with an official no-build path (https://webawesome.com/docs/), now that Shoelace is sunset (https://shoelace.style/) and Material Web is in maintenance mode (https://github.com/material-components/material-web).

**Does Pico + Web Awesome combine well? Yes, technically — with one honest caveat.** Web Awesome components are shadow-DOM-encapsulated, so Pico's element selectors cannot leak into them and vice versa (https://webawesome.com/docs/customizing/ — page CSS "can't simply target their internals"); the two coexist without selector fights by construction. The caveat is *theme coherence*: Pico themes via `--pico-*` tokens, Web Awesome via `--wa-*` tokens, so matching colors/radii/fonts across the boundary means writing a small bridge block in `style.css` that assigns shared values to both token sets (both are plain CSS custom properties, no tooling needed). That is a page of CSS, not a build step — acceptable, but it is why the default recommendation is **Pico alone first**, adding Web Awesome only when a concrete widget need appears.

**Rejected for this tool**: Shoelace 2.x (officially sunset, repo archived), Material Web (self-declared maintenance mode), Bootstrap/Bulma (class-based rewrite, 3–6x heavier, Bootstrap needs JS for auto dark mode), Water.css (dormant since 2021), Simple.css (GitHub archived, document-shaped), Tailwind and shadcn/ui (build-bound by their own docs). Open Props remains a nice-to-have token palette if we keep hand-rolling styles instead of adopting Pico.
