# Session 2 — Automated crawler

You are building the traffic generator: a Crawlee `PlaywrightCrawler` that
walks every reachable route of the app, plus a gremlins.js interaction pass on
each page so interaction-triggered API calls (typeaheads, lazy panels, tab
switches) fire too. Session 1 already built the WireMock proxy; read its
HANDOFF.md section for the exact command that starts the app pointed at the
proxy — use it verbatim.

You will run the crawler against WireMock in GET-only recording mode to test
it, but the *real* recording run belongs to session 3. Delete stubs you
generate while testing, exactly as session 1 did after its smoke test.

## Step 1 — Scaffold

Create `tools/crawler/` as a standalone package (do NOT add these deps to the
app's own package.json):

```bash
cd tools/crawler
npm init -y
npm install crawlee playwright gremlins.js
npx playwright install chromium   # skip if the environment preinstalls browsers
```

Add `tools/crawler/storage/` and `tools/crawler/auth-state.json` to the repo's
`.gitignore` (crawlee writes queue state to `storage/`; auth-state contains a
live session).

## Step 2 — Auth session seeding

Read `AUTH_METHOD` and `TEST_ACCOUNT` from `00-context.md` PARAMETERS.

Create `tools/crawler/login.mjs`: a plain Playwright script that
1. launches chromium headless,
2. navigates to the app's login route,
3. fills the credential fields (credentials from the env vars named in
   `TEST_ACCOUNT` — read via `process.env`, never hardcode),
4. submits, waits for navigation to a logged-in page (assert some element that
   only exists when authed — pick one by inspecting the app, and write your
   selector choice into HANDOFF.md),
5. saves state: `await context.storageState({ path: 'auth-state.json' })`.

You must find the real selectors: start the app (against staging directly is
fine for this step — logging in is a read-safe flow), open the login page, and
read the DOM. Do not guess selectors; verify the script by running it and then
checking `auth-state.json` is non-empty and contains cookies or localStorage.

If `AUTH_METHOD` is an external OAuth/SSO redirect the script can't automate:
fall back to manual capture — run
`npx playwright codegen --save-storage=auth-state.json <APP_LOCAL_URL>`,
tell the user to log in by hand in the opened browser, then close it. Document
in HANDOFF.md that re-recording requires this manual login step.

## Step 3 — The crawler

Create `tools/crawler/crawl.mjs`. Requirements — implement all of them:

```js
import { PlaywrightCrawler, Configuration } from 'crawlee';
import fs from 'node:fs';

const START_URL   = process.env.CRAWL_START_URL ?? 'FILL from APP_LOCAL_URL';
const MAX_PAGES   = Number(process.env.CRAWL_MAX_PAGES ?? 200);
const GREMLIN_MS  = Number(process.env.CRAWL_GREMLIN_MS ?? 20000);
const gremlinsSrc = fs.readFileSync('node_modules/gremlins.js/dist/gremlins.min.js', 'utf8');

const crawler = new PlaywrightCrawler({
  maxRequestsPerCrawl: MAX_PAGES,
  launchContext: {
    launchOptions: { headless: true },
  },
  browserPoolOptions: {
    // reuse the authed session on every page
    postPageCreateHooks: [async (page) => {
      // storageState is applied via context below; nothing needed here
    }],
  },
  // apply auth state to every browser context
  preNavigationHooks: [async ({ page }) => {
    page.setDefaultTimeout(15000);
  }],
  async requestHandler({ page, enqueueLinks, request, log }) {
    log.info(`Crawling ${request.url}`);
    await page.waitForLoadState('networkidle').catch(() => {});
    // 1. discover same-origin links (never leave the app)
    await enqueueLinks({ strategy: 'same-origin' });
    // 2. gremlins interaction pass
    await page.evaluate(gremlinsSrc);
    await page.evaluate((ms) => new Promise((resolve) => {
      const horde = window.gremlins.createHorde({
        species: [
          window.gremlins.species.clicker({
            // never click destructive or session-ending controls
            canClick: (el) => {
              const t = (el.textContent || '').toLowerCase();
              const bad = ['logout', 'log out', 'sign out', 'delete', 'remove', 'archive', 'cancel account'];
              if (bad.some((w) => t.includes(w))) return false;
              if (el.closest('a[href^="http"]:not([href*="' + location.host + '"])')) return false;
              return true;
            },
          }),
          window.gremlins.species.formFiller(),
          window.gremlins.species.scroller(),
        ],
        mogwais: [window.gremlins.mogwais.gizmo({ maxErrors: 10 })],
        strategies: [window.gremlins.strategies.distribution({ delay: 50 })],
      });
      horde.unleash();
      setTimeout(() => { horde.stop(); resolve(); }, ms);
    }), GREMLIN_MS);
  },
  failedRequestHandler({ request, log }) {
    log.warning(`FAILED ${request.url}`);
  },
});

// seed: start URL + every route in KNOWN_ROUTES from 00-context.md
await crawler.run([
  START_URL,
  // + START_URL-prefixed KNOWN_ROUTES, written out literally here
]);
```

The snippet above is a skeleton, not a paste-and-pray artifact. You must:
- Wire `auth-state.json` in properly: `launchContext.launchOptions` does not
  take storageState — use `launchContext: { useIncognitoPages: true }` with
  `browserPoolOptions.postPageCreateHooks` adding cookies, OR simpler and
  preferred: pass `storageState` via
  `launchContext: { launchOptions: {} , userDataDir: undefined }` and
  `new PlaywrightCrawler({ ... , sessionPoolOptions })` — check the Crawlee
  docs for the current supported way to apply Playwright `storageState`
  (search: "crawlee playwright storageState"). Verify it works by crawling a
  page that requires auth and confirming it doesn't land on the login screen
  (log the final URL of each page).
- Write the seed list out literally from `KNOWN_ROUTES`.
- Keep the destructive-text blocklist in `canClick`. Extend it with any
  app-specific dangerous labels you notice. GET-only recording is the real
  safety net, but don't rely on it alone.

Add `tools/crawler/package.json` scripts: `"login": "node login.mjs"`,
`"crawl": "node crawl.mjs"`.

## Step 4 — Test run (against GET-only recording, then discard)

1. Start WireMock and recording exactly as session 1's scripts do
   (`mock-up`, `mock-record`).
2. Start the app pointed at the proxy (exact command from HANDOFF.md).
3. `cd tools/crawler && npm run login && npm run crawl` with
   `CRAWL_MAX_PAGES=10` and `CRAWL_GREMLIN_MS=5000` for a quick pass.
4. While it runs, confirm in the WireMock log (`docker compose ... logs -f`)
   that requests are flowing through the proxy.
5. `mock-stop` — expect a mapping count noticeably larger than session 1's
   smoke test (an authed SPA touching 10 pages typically yields dozens of GET
   mappings). Record the count in HANDOFF.md.
6. Check for auth failure: grep the recorded mappings for `"status" : 401`
   and `"status" : 403`. More than a stray one or two means the auth state
   didn't apply — fix step 2/3 before finishing this session.
7. Delete recorded mappings/__files (keep `.gitkeep`), `mock-reset`.

**[COMMIT]** `feat: add Crawlee + gremlins crawler for mock recording`

## Acceptance checklist

- [ ] `npm run login` produces a non-empty `auth-state.json` (or the manual codegen fallback is documented in HANDOFF.md)
- [ ] Crawler visits ≥ `CRAWL_MAX_PAGES` or exhausts links, stays same-origin, never hits logout
- [ ] Crawled pages are authenticated (spot-checked page URLs are not the login route; few/no 401/403 mappings)
- [ ] Gremlins pass runs on each page without crashing the crawl
- [ ] Test-run mapping count recorded in HANDOFF.md; test stubs deleted afterward
- [ ] `storage/` and `auth-state.json` gitignored; nothing sensitive committed
- [ ] HANDOFF.md updated with: crawl command incl. env vars, login selector notes, any routes that failed and why
